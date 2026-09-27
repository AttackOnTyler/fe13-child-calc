/**
 * The map simulation (#181; spec #175, The map simulation and Noise): one map played turn by turn, player phase then
 * enemy phase, until a rout or the boss's defeat. The play is deterministic given the army's stats and the lineup;
 * its **no-death chance** is exact: the product of the lead's survival in every exchange the play creates, each worked
 * out from the map solver's combat math (`exchange`). Seeded draws only settle what the chapter data leaves open
 * (Lunatic+ skills today); later tickets sample what changes the route between maps.
 *
 * The turn loop, and where later tickets plug in:
 * - Start of turn: `recover` (full HP today; #182 spends actions on sustain instead), then arrivals (`clearArrivals`,
 *   `arrivalsAt('turn-start')`). Mid-map recruits (#184) join here on their turn.
 * - `playerPhase`: each acting group (a pair's lead, or a unit alone) has one action a turn, an equal share (a stated
 *   blind spot). `chooseAction` picks the best action left and `apply` plays it. Actions are a union so #182 (heal,
 *   Dance, Rally), #183 (stance: separate, pair up, switch) and #195 (EXP priority: who lands kills, waiting) add
 *   kinds and policy, not a new loop. Ally phase (#184) goes between player and enemy phase.
 * - `enemyPhase`: arrivals free to act (Hard and up), then each exposed front takes one attack from the worst foe left
 *   for it (one worst attacker per pair, a stated blind spot), each foe attacking once. #183's stances make each unit
 *   of a pair apart its own front.
 * - Tallies per unit (combats, kills per foe group, combats with each partner) feed EXP (#186, #195) and supports
 *   (#188); the per-turn log feeds the Why panel.
 *
 * Each exchange plays out at its likely result given the lead survives: its expected HP after, and the foe falls when
 * that's more likely than not (else keeps its expected HP). The no-death chance is conditioned the same way: the
 * product runs along the play in which nobody has died yet.
 */
import type { GameItem } from '../../game-data/items';
import { bestWeapon, matchup, type Fighter, type Foe, type Matchup, type SupportLevel } from '../solver';
import { exchange, type Exchange, type Initiator } from './exchange';
import { createRng, type Rng } from './random';
import type { BlindSpotId } from '../assumptions';

/** A unit in the lineup: who it is, its fighter (recorded stats) and the weapons it can pick from. */
export type SimUnit = {
  readonly id: string;
  readonly fighter: Fighter;
  readonly weapons: readonly NonNullable<Fighter['weapon']>[];
};

/** A pair (lead + back) or a unit alone: one front, one action a turn. */
export type SimGroup = {
  readonly lead: SimUnit;
  readonly back?: SimUnit;
  readonly support: SupportLevel | null;
};

/** A group of like foes. `key` names it in tallies and logs (kills per foe group). */
export type SimFoeGroup = {
  readonly key: string;
  readonly foe: Foe;
  /** Lunatic+: the pool its two extra skills are drawn from, when they weren't recorded. */
  readonly pool?: readonly string[];
  /** The boss whose defeat wins a boss map. */
  readonly target?: boolean;
};

/** Reinforcements: on Normal they join at the start of a turn; on Hard and up at the start of enemy phase, free to act. */
export type SimWave = {
  readonly label: string;
  readonly turns: readonly number[];
  /** Unlimited reinforcements: `perTurn` foes every turn from this one, the kinds in turn. */
  readonly everyTurnFrom?: number;
  readonly perTurn?: number;
  /** Joins when the field is clear, in order (Apotheosis's waves), instead of on a turn. */
  readonly onClear?: boolean;
  readonly joins: 'turn-start' | 'enemy-phase';
  readonly groups: readonly SimFoeGroup[];
};

export type SimMap = {
  readonly id: string;
  /** Rout the enemy, or defeat the boss marked `target`. */
  readonly victory: 'rout' | 'boss';
  readonly foes: readonly SimFoeGroup[];
  readonly waves: readonly SimWave[];
  /** Waves the play doesn't model (a talk or a first defeat sets them off), by label. */
  readonly skipped: readonly string[];
};

export type MapPlayInput = {
  readonly map: SimMap;
  readonly lineup: readonly SimGroup[];
  /** A boss map: the turn the solve picks to defeat the boss. Absent: the boss is fought once nothing else is left. */
  readonly bossTurn?: number;
};

export type SimFight = {
  readonly phase: Initiator;
  readonly lead: string;
  readonly back?: string;
  /** The foe group's key. */
  readonly foe: string;
  /** The lead's chance to survive this exchange: one factor of the no-death chance. */
  readonly survive: number;
  /** Whether the foe fell (the likely result). */
  readonly kill: boolean;
};

export type SimTurn = {
  readonly turn: number;
  readonly arrivals: readonly { readonly group: string; readonly count: number }[];
  readonly fights: readonly SimFight[];
  /** Foes on the field at the turn's end. */
  readonly foesLeft: number;
  /** The no-death chance so far. */
  readonly noDeath: number;
};

export type SimUnitTally = {
  /** Exchanges it fought as a lead or alone. */
  readonly combats: number;
  /** Foes it felled, by foe group key. */
  readonly kills: Readonly<Record<string, number>>;
  /** Exchanges it fought paired with each partner (as lead or back). */
  readonly together: Readonly<Record<string, number>>;
};

export type MapPlay = {
  readonly map: string;
  /** The chance nobody dies on the map, exact given the play. */
  readonly noDeath: number;
  readonly turns: number;
  /** How it ended: a rout, the boss's defeat, or out of turns with foes left. */
  readonly ended: 'rout' | 'boss' | 'stalled';
  readonly units: Readonly<Record<string, SimUnitTally>>;
  readonly groups: readonly { readonly key: string; readonly name: string; readonly className: string; readonly count: number; readonly felled: number }[];
  readonly log: readonly SimTurn[];
  /** The Lunatic+ skills drawn for each foe group without recorded skills. */
  readonly skills: Readonly<Record<string, readonly string[]>>;
  /** The stated blind spots this number rests on. */
  readonly blindSpots: readonly BlindSpotId[];
};

/** A map that runs this long without victory is stalled: the army can't finish it. */
export const MAX_TURNS = 50;
const LUNATIC_PLUS_DRAWS = 2;
const BLIND_SPOTS: readonly BlindSpotId[] = ['one-worst-attacker', 'equal-share-of-actions', 'full-hp-each-turn', 'likely-result', 'bosses-hold'];

type FoeInstance = { readonly g: number; hp: number };

/** What a group can do with its action. Later tickets add kinds (heal, dance, rally, separate, pair up, switch, wait). */
type Action = { readonly kind: 'attack'; readonly group: number; readonly foe: FoeInstance; readonly ex: Exchange; readonly value: number };

type Tally = { combats: number; kills: Record<string, number>; together: Record<string, number> };

/** A lead's matchup against one foe (its best weapon for it), and the exchanges worked out from it, by HPs. */
type Combat = { readonly m: Matchup; readonly weapon: GameItem | undefined; readonly exchanges: Map<number, Exchange> };

/**
 * Combats outlive a play: a solve plays the same lineup on the same map many times, so each (group, foe, drawn
 * skills) matchup and its exchanges are worked out once. Keyed by object identity, so nothing leaks between inputs.
 */
const COMBATS = new WeakMap<SimGroup, WeakMap<Foe, Map<string, Combat>>>();

function combatOf(grp: SimGroup, base: Foe, drawn: readonly string[]): Combat {
  let byFoe = COMBATS.get(grp);
  if (!byFoe) COMBATS.set(grp, (byFoe = new WeakMap()));
  let bySkills = byFoe.get(base);
  if (!bySkills) byFoe.set(base, (bySkills = new Map()));
  const k = drawn.join(',');
  let c = bySkills.get(k);
  if (!c) {
    const foe = drawn.length ? { ...base, skills: [...base.skills, ...drawn] } : base;
    const back = grp.back?.fighter;
    const best = grp.lead.weapons.length ? bestWeapon(grp.lead.fighter, grp.lead.weapons, back, grp.support, foe, []) : undefined;
    c = best
      ? { m: best.result, weapon: best.weapon?.item, exchanges: new Map() }
      : { m: matchup(grp.lead.fighter, back, grp.support, foe), weapon: grp.lead.fighter.weapon?.item, exchanges: new Map() };
    bySkills.set(k, c);
  }
  return c;
}

class MapState {
  readonly groups: SimFoeGroup[] = [];
  readonly foes: FoeInstance[] = [];
  readonly hp: number[];
  readonly tallies = new Map<string, Tally>();
  readonly log: SimTurn[] = [];
  readonly spawned: number[] = [];
  readonly felled: number[] = [];
  readonly skills: Record<string, readonly string[]> = {};
  noDeath = 1;
  turn = 0;
  fights: SimFight[] = [];
  arrivals: { group: string; count: number }[] = [];
  ended: MapPlay['ended'] | undefined;
  /** Whether anything moved this turn: a foe hurt or felled, or an arrival. A turn without is a stall. */
  progress = false;
  /** Each lineup group's combat against each foe group, by [group][foe group]. */
  private readonly combats: (Combat | undefined)[][];
  private readonly drawn: (readonly string[])[] = [];
  private readonly waveGroup = new Map<SimFoeGroup, number>();
  /** The foe groups on the field from the start (the boss opens once they're gone, unless the solve picks a turn). */
  private readonly starting = new Set<number>();
  private clearQueue: SimWave[];
  private endless = 0;

  constructor(
    readonly input: MapPlayInput,
    readonly rng: Rng,
  ) {
    this.hp = input.lineup.map((g) => g.lead.fighter.stats.hp);
    this.combats = input.lineup.map(() => []);
    for (const g of input.map.foes) {
      const i = this.groupIndex(g);
      this.starting.add(i);
      this.spawn(i, g.foe.count);
    }
    this.clearQueue = input.map.waves.filter((w) => w.onClear);
    for (const g of input.lineup) for (const u of [g.lead, g.back]) if (u) this.tallies.set(u.id, { combats: 0, kills: {}, together: {} });
  }

  /** A foe group's index, its Lunatic+ skills drawn the first time it's seen. */
  private groupIndex(g: SimFoeGroup): number {
    const known = this.waveGroup.get(g);
    if (known !== undefined) return known;
    const drawn = g.pool?.length ? this.rng.sample(g.pool.filter((s) => !g.foe.skills.includes(s)), LUNATIC_PLUS_DRAWS) : [];
    if (g.pool?.length) this.skills[g.key] = drawn;
    this.groups.push(g);
    this.drawn.push(drawn);
    this.spawned.push(0);
    this.felled.push(0);
    this.waveGroup.set(g, this.groups.length - 1);
    return this.groups.length - 1;
  }

  private spawn(g: number, count: number) {
    for (let i = 0; i < count; i++) this.foes.push({ g, hp: this.groups[g]!.foe.stats.hp });
    this.spawned[g]! += count;
    if (count > 0) this.progress = true;
  }

  private arrive(g: SimFoeGroup, count: number) {
    if (count <= 0) return;
    const i = this.groupIndex(g);
    this.spawn(i, count);
    const a = this.arrivals.find((x) => x.group === g.key);
    if (a) a.count += count;
    else this.arrivals.push({ group: g.key, count });
  }

  /** The waves joining now: on their turns, every turn for unlimited ones. */
  arrivalsAt(joins: SimWave['joins']) {
    for (const w of this.input.map.waves) {
      if (w.joins !== joins || w.onClear) continue;
      if (w.turns.includes(this.turn)) for (const g of w.groups) this.arrive(g, g.foe.count);
      if (w.everyTurnFrom !== undefined && this.turn >= w.everyTurnFrom && w.groups.length) {
        for (let i = 0; i < (w.perTurn ?? w.groups.length); i++) this.arrive(w.groups[this.endless++ % w.groups.length]!, 1);
      }
    }
  }

  /** Recovery at the start of a turn: every unit at full HP (a stated blind spot until #182 spends actions on sustain). */
  recover() {
    this.input.lineup.forEach((g, i) => (this.hp[i] = g.lead.fighter.stats.hp));
  }

  /** The foes on the field (the fallen are dropped as they fall). */
  alive(): readonly FoeInstance[] {
    return this.foes;
  }

  exchangeOf(gi: number, f: FoeInstance, initiator: Initiator): Exchange {
    const row = this.combats[gi]!;
    const c = (row[f.g] ??= combatOf(this.input.lineup[gi]!, this.groups[f.g]!.foe, this.drawn[f.g]!));
    const hp = this.hp[gi]!;
    const key = (initiator === 'player' ? 0 : 1 << 21) + hp * 1024 + f.hp;
    let ex = c.exchanges.get(key);
    if (!ex) c.exchanges.set(key, (ex = exchange(c.m, c.weapon, hp, f.hp, initiator)));
    return ex;
  }

  armed(gi: number): boolean {
    const lead = this.input.lineup[gi]!.lead;
    return lead.weapons.length > 0 || !!lead.fighter.weapon;
  }

  /** Plays out an exchange: the chance multiplies in, HPs move to the likely result, and the tallies count it. */
  fight(gi: number, f: FoeInstance, ex: Exchange, phase: Initiator) {
    const grp = this.input.lineup[gi]!;
    const key = this.groups[f.g]!.key;
    this.noDeath *= ex.survive;
    if (ex.survive > 0) {
      this.hp[gi] = ex.leadHp;
      if (ex.foeHp < f.hp) this.progress = true;
      f.hp = ex.foeHp;
    }
    const kill = f.hp <= 0;
    if (kill) this.foes.splice(this.foes.indexOf(f), 1);
    const t = this.tallies.get(grp.lead.id)!;
    t.combats++;
    if (kill) {
      t.kills[key] = (t.kills[key] ?? 0) + 1;
      this.felled[f.g]!++;
    }
    if (grp.back) {
      t.together[grp.back.id] = (t.together[grp.back.id] ?? 0) + 1;
      const b = this.tallies.get(grp.back.id)!;
      b.together[grp.lead.id] = (b.together[grp.lead.id] ?? 0) + 1;
    }
    this.fights.push({ phase, lead: grp.lead.id, ...(grp.back ? { back: grp.back.id } : {}), foe: key, survive: ex.survive, kill });
  }

  /**
   * Whether the target boss can be fought now: from the turn the solve picks, or once the foes the map starts with
   * are gone (reinforcements don't hold it back: Endgame's never stop).
   */
  private bossOpen(): boolean {
    if (this.input.bossTurn !== undefined) return this.turn >= this.input.bossTurn;
    return this.foes.every((f) => this.groups[f.g]!.target || !this.starting.has(f.g));
  }

  /**
   * The best action left for the groups that haven't acted: an attack that does something (fells the foe or wears it
   * down) and that the lead more likely survives than not, since waiting doesn't keep it out of enemy phase. Valued by
   * the chance it fells the foe (the target boss first once it's open), a little for the damage it does, less the
   * chance the lead dies. Undefined when no action is worth taking.
   */
  chooseAction(acted: ReadonlySet<number>, memo: Map<number, Action | null>): Action | undefined {
    const open = this.bossOpen();
    // One candidate per foe group: its most worn-down foe.
    const worn = new Map<number, FoeInstance>();
    for (const f of this.foes) {
      const s = worn.get(f.g);
      if (!s || f.hp < s.hp) worn.set(f.g, f);
    }
    let best: Action | undefined;
    for (let gi = 0; gi < this.input.lineup.length; gi++) {
      if (acted.has(gi) || !this.armed(gi)) continue;
      for (const f of worn.values()) {
        const k = gi * 65536 + f.g;
        let a = memo.get(k);
        if (a === undefined || (a && a.foe !== f)) memo.set(k, (a = this.attack(gi, f, open)));
        if (a && (!best || a.value > best.value)) best = a;
      }
    }
    return best;
  }

  /** An attack by group `gi` on foe `f`, if it's worth taking (see `chooseAction`); null if not. */
  private attack(gi: number, f: FoeInstance, open: boolean): Action | null {
    const target = !!this.groups[f.g]!.target;
    if (target && !open) return null;
    const ex = this.exchangeOf(gi, f, 'player');
    if (!ex.leadStrikes || ex.survive < 0.5) return null;
    const dealt = ex.foeHp < f.hp ? (f.hp - ex.foeHp) / f.hp : 0;
    const gain = ex.kill * (target ? 100 : 1) + 0.5 * dealt;
    if (gain <= 0) return null;
    return { kind: 'attack', group: gi, foe: f, ex, value: ex.survive * gain - (1 - ex.survive) };
  }

  /** Whether the map is won: the target boss fell, or the field is clear with no wave waiting on it. */
  checkVictory(): boolean {
    if (this.input.map.victory === 'boss') {
      const target = this.groups.findIndex((g) => g.target);
      if (target >= 0 && this.felled[target]! > 0) this.ended = 'boss';
    } else if (!this.alive().length && !this.clearQueue.length) this.ended = 'rout';
    return !!this.ended;
  }

  /** Whether a wave is still to come. */
  wavesAhead(): boolean {
    return (this.clearQueue.length > 0 && !this.foes.length) || this.input.map.waves.some((w) => !w.onClear && (w.everyTurnFrom !== undefined || w.turns.some((t) => t > this.turn)));
  }

  /** The next wave that waits for a clear field joins at the start of the turn after it clears. */
  clearArrivals() {
    if (this.alive().length || !this.clearQueue.length) return;
    const w = this.clearQueue.shift()!;
    for (const g of w.groups) this.arrive(g, g.foe.count);
  }

  playerPhase() {
    const acted = new Set<number>();
    // Each group's best attack on each foe group, kept while that group's most worn-down foe is unchanged.
    const memo = new Map<number, Action | null>();
    for (;;) {
      const wasOpen = this.bossOpen();
      const a = this.chooseAction(acted, memo);
      if (!a) return;
      acted.add(a.group);
      this.fight(a.group, a.foe, a.ex, 'player');
      if (this.checkVictory()) return;
      // The foe's HP moved: its group's attacks are worked out again (and every one when the boss opens).
      if (wasOpen !== this.bossOpen()) memo.clear();
      else for (const k of [...memo.keys()]) if (k % 65536 === a.foe.g) memo.delete(k);
    }
  }

  /**
   * Each armed front takes one attack from the worst foe left for it, each foe attacking once: the pairings with the
   * lowest survival first. Bosses hold their ground (they only fight back). Units with no weapon stay out of reach.
   */
  enemyPhase() {
    const attackers = this.alive().filter((f) => {
      const foe = this.groups[f.g]!.foe;
      return !!foe.weapon && !foe.boss;
    });
    if (!attackers.length) return;
    const fronts = this.input.lineup.map((_, i) => i).filter((i) => this.armed(i));
    const byGroup = new Map<number, FoeInstance[]>();
    for (const f of attackers) byGroup.set(f.g, [...(byGroup.get(f.g) ?? []), f]);
    // The foe that attacks from a group is its healthiest.
    for (const list of byGroup.values()) list.sort((a, b) => b.hp - a.hp);
    const options = fronts.flatMap((gi) => [...byGroup.entries()].map(([g, list]) => ({ gi, g, s: this.exchangeOf(gi, list[0]!, 'enemy').survive })));
    options.sort((a, b) => a.s - b.s || a.gi - b.gi || a.g - b.g);
    const hit = new Set<number>();
    for (const o of options) {
      if (hit.has(o.gi)) continue;
      const list = byGroup.get(o.g)!;
      const f = list.find((x) => x.hp > 0);
      if (!f) continue;
      list.splice(list.indexOf(f), 1);
      hit.add(o.gi);
      this.fight(o.gi, f, this.exchangeOf(o.gi, f, 'enemy'), 'enemy');
      if (this.checkVictory()) return;
    }
  }

  endTurn() {
    this.log.push({ turn: this.turn, arrivals: this.arrivals, fights: this.fights, foesLeft: this.alive().length, noDeath: this.noDeath });
    this.arrivals = [];
    this.fights = [];
  }
}

/** Plays one map (see the module comment). The same input and seed give the same play. */
export function playMap(input: MapPlayInput, seed: number): MapPlay {
  const s = new MapState(input, createRng(seed));
  while (!s.ended && s.turn < MAX_TURNS) {
    // A turn that moved nothing, with no wave to come, would repeat forever: the army can't finish the map.
    if (s.turn > 0 && !s.progress && !s.wavesAhead()) break;
    s.progress = false;
    s.turn++;
    s.recover();
    s.clearArrivals();
    s.arrivalsAt('turn-start');
    if (s.checkVictory()) break;
    s.playerPhase();
    if (!s.ended) {
      s.arrivalsAt('enemy-phase');
      s.enemyPhase();
      s.checkVictory();
    }
    s.endTurn();
  }
  if (s.ended && s.log.length < s.turn) s.endTurn();
  const units = Object.fromEntries(s.tallies);
  return {
    map: input.map.id,
    noDeath: s.noDeath,
    turns: s.turn,
    ended: s.ended ?? 'stalled',
    units,
    groups: s.groups.map((g, i) => ({ key: g.key, name: g.foe.name, className: g.foe.className, count: s.spawned[i]!, felled: s.felled[i]! })),
    log: s.log,
    skills: s.skills,
    blindSpots: BLIND_SPOTS,
  };
}

/** The mean no-death chance over `runs` plays, each with its own seed from `seed` (Lunatic+ skills drawn anew). */
export function meanNoDeath(input: MapPlayInput, seeds: readonly number[]): number {
  if (!seeds.length) return 1;
  return seeds.reduce((a, sd) => a + playMap(input, sd).noDeath, 0) / seeds.length;
}
