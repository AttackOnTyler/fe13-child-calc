/**
 * The map simulation (#181; spec #175, The map simulation and Noise): one map played turn by turn, player phase then
 * enemy phase, until a rout or the boss's defeat. The play is deterministic given the army's stats and the lineup;
 * its **no-death chance** is exact: the product of the lead's survival in every exchange the play creates, each worked
 * out from the map solver's combat math (`exchange`). Seeded draws only settle what the chapter data leaves open
 * (Lunatic+ skills today); later tickets sample what changes the route between maps.
 *
 * The turn loop, and where later tickets plug in:
 * - Start of turn: `startTurn` (last turn's Rally and Rescues wear off; HP carries over from the turn before), then
 *   arrivals (`clearArrivals`, `arrivalsAt('turn-start')`). Mid-map recruits (#184) join here on their turn.
 * - `playerPhase`: each acting group (a pair's lead, or a unit alone) has one action a turn, an equal share (a stated
 *   blind spot); a Dance gives one more. `chooseAction` picks the next action by the policy's tiers (`POLICY`) and
 *   `apply` plays it. Actions are a union: #182 added sustain (a heal, Fortify, Rescue, a potion), Dance and Rally
 *   (`sustain.ts`); #183 (stance: separate, pair up, switch) and #195 (EXP priority: who lands kills, waiting) add
 *   kinds and tiers, not a new loop. Ally phase (#184) goes between player and enemy phase.
 * - HP is carried: damage stays until an action buys it back. A staff reaches a pair with the chance the assumed army
 *   spread gives (`MapPlayInput.spread`), and heals its expected HP.
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
import { dances, mergeRally, potionHeal, rallied, rallyKey, rallyOf, reachChance, staffEffect, type ArmySpread, type RallyBonus, type SimItem, type StaffEffect } from './sustain';

/**
 * A unit in the lineup: who it is, its fighter (recorded stats), the weapons it can pick from, and the staves and potions
 * it can spend uses of (sustain, #182). A Dancer dances; an equipped Rally skill is a planned Rally.
 */
export type SimUnit = {
  readonly id: string;
  readonly fighter: Fighter;
  readonly weapons: readonly NonNullable<Fighter['weapon']>[];
  readonly items?: readonly SimItem[];
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
  /**
   * The distances from a staff user to the pairs on this map (the assumed army spread, #182): a staff reaches a pair
   * with the share of them within reach. Absent: every staff reaches. The engine fills in the `army-spread` assumption.
   */
  readonly spread?: ArmySpread;
};

/**
 * An action other than an attack (#182): a heal (one pair, or every pair in reach with Fortify), a Rescue out of
 * enemy phase, a potion on the unit's own lead, a Dance (the target acts again) or a Rally (every other pair's stats
 * up for the turn).
 */
export type SimAct = {
  readonly kind: 'heal' | 'rescue' | 'item' | 'dance' | 'rally';
  /** The acting unit (its group's lead). */
  readonly unit: string;
  /** The lead of the pair it's for (a heal or Fortify names each pair it heals, one act each). */
  readonly target?: string;
  /** The staff or potion spent. */
  readonly item?: string;
  /** A staff: the chance it reaches the pair, from the assumed army spread. */
  readonly reach?: number;
  /** HP restored (expected, for a staff). */
  readonly hp?: number;
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
  /** Sustain, Dance and Rally taken this turn, in order. */
  readonly acts: readonly SimAct[];
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
  /** Uses spent, by staff or potion name (staff EXP reads these). */
  readonly used: Readonly<Record<string, number>>;
  /** Dances given (Dance EXP) and Rallies used. */
  readonly dances: number;
  readonly rallies: number;
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
const BLIND_SPOTS: readonly BlindSpotId[] = ['one-worst-attacker', 'equal-share-of-actions', 'likely-result', 'bosses-hold'];
/** A heal's small worth beyond the danger it lifts: HP topped up now is HP in hand for the turns to come. */
const TOP_UP = 0.01;

type FoeInstance = { readonly g: number; hp: number };

/**
 * What a group can do with its action, valued on one scale: the chance of felling a foe, less the chance of a death it
 * risks; a sustain action by the enemy-phase survival it buys. Later tickets add kinds (separate, pair up, switch, wait).
 */
type Action =
  | { readonly kind: 'attack'; readonly group: number; readonly foe: FoeInstance; readonly ex: Exchange; readonly value: number }
  /** A staff heal: one pair, or each pair in reach (Fortify), each by its expected HP. */
  | { readonly kind: 'heal'; readonly group: number; readonly item: number; readonly reach: number; readonly heals: readonly { readonly group: number; readonly hp: number }[]; readonly value: number }
  | { readonly kind: 'rescue'; readonly group: number; readonly item: number; readonly reach: number; readonly target: number; readonly value: number }
  | { readonly kind: 'item'; readonly group: number; readonly item: number; readonly hp: number; readonly value: number }
  | { readonly kind: 'dance'; readonly group: number; readonly target: number; readonly value: number }
  | { readonly kind: 'rally'; readonly group: number; readonly value: number };

type Tally = { combats: number; kills: Record<string, number>; together: Record<string, number>; used: Record<string, number>; dances: number; rallies: number };

/** What a group's lead brings besides weapons: its staves and potions (by index in `items`), Dance, and Rally. */
type Kit = {
  readonly staves: readonly { readonly item: number; readonly effect: StaffEffect; readonly reach: number }[];
  readonly potions: readonly { readonly item: number; readonly heal: number }[];
  readonly dances: boolean;
  readonly rally: RallyBonus | undefined;
};

/** A group with a Rally bonus on its units, made once per group and bonus so its combats are cached like any other. */
const RALLIED = new WeakMap<SimGroup, Map<string, SimGroup>>();

function ralliedGroup(grp: SimGroup, bonus: RallyBonus): SimGroup {
  let byBonus = RALLIED.get(grp);
  if (!byBonus) RALLIED.set(grp, (byBonus = new Map()));
  const k = rallyKey(bonus);
  let g = byBonus.get(k);
  if (!g) {
    const up = (u: SimUnit): SimUnit => ({ ...u, fighter: rallied(u.fighter, bonus) });
    g = { ...grp, lead: up(grp.lead), ...(grp.back ? { back: up(grp.back) } : {}) };
    byBonus.set(k, g);
  }
  return g;
}

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
  acts: SimAct[] = [];
  arrivals: { group: string; count: number }[] = [];
  ended: MapPlay['ended'] | undefined;
  /** Whether anything moved this turn: a foe hurt or felled, HP restored, or an arrival. A turn without is a stall. */
  progress = false;
  /** Each group's staves, potions, Dance and Rally, and the uses left of each item (by [group][item]). */
  readonly kits: Kit[];
  readonly uses: number[][];
  /** This turn: each group's Rally bonus (from the others' Rallies), and the groups Rescued out of enemy phase. */
  private readonly bonus: (RallyBonus | undefined)[];
  private readonly safe = new Set<number>();
  /** Each lineup group's combat against each foe group, by [group][foe group]; `ralliedCombats` while rallied. */
  private readonly combats: (Combat | undefined)[][];
  private readonly ralliedCombats: (Combat | undefined)[][];
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
    this.ralliedCombats = input.lineup.map(() => []);
    this.bonus = input.lineup.map(() => undefined);
    this.kits = input.lineup.map((g) => kitOf(g.lead, input.spread));
    this.uses = input.lineup.map((g) => (g.lead.items ?? []).map((i) => i.uses));
    for (const g of input.map.foes) {
      const i = this.groupIndex(g);
      this.starting.add(i);
      this.spawn(i, g.foe.count);
    }
    this.clearQueue = input.map.waves.filter((w) => w.onClear);
    for (const g of input.lineup) for (const u of [g.lead, g.back]) if (u) this.tallies.set(u.id, { combats: 0, kills: {}, together: {}, used: {}, dances: 0, rallies: 0 });
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

  /** The start of a turn: last turn's Rally and Rescues wear off. HP carries over: only actions buy it back (#182). */
  startTurn() {
    this.safe.clear();
    if (this.bonus.some((b) => b)) {
      this.bonus.fill(undefined);
      for (const row of this.ralliedCombats) row.length = 0;
    }
  }

  /** The foes on the field (the fallen are dropped as they fall). */
  alive(): readonly FoeInstance[] {
    return this.foes;
  }

  /** Group `gi`'s exchange with foe `f`, from `hp` (its HP now by default), with this turn's Rally bonus on it. */
  exchangeOf(gi: number, f: FoeInstance, initiator: Initiator, hp = this.hp[gi]!): Exchange {
    const bonus = this.bonus[gi];
    const row = (bonus ? this.ralliedCombats : this.combats)[gi]!;
    const grp = bonus ? ralliedGroup(this.input.lineup[gi]!, bonus) : this.input.lineup[gi]!;
    const c = (row[f.g] ??= combatOf(grp, this.groups[f.g]!.foe, this.drawn[f.g]!));
    const key = (initiator === 'player' ? 0 : 1 << 21) + hp * 1024 + f.hp;
    let ex = c.exchanges.get(key);
    if (!ex) c.exchanges.set(key, (ex = exchange(c.m, c.weapon, hp, f.hp, initiator)));
    return ex;
  }

  armed(gi: number): boolean {
    const lead = this.input.lineup[gi]!.lead;
    return lead.weapons.length > 0 || !!lead.fighter.weapon;
  }

  private maxHp(gi: number): number {
    return this.input.lineup[gi]!.lead.fighter.stats.hp;
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
   * The next action, by the policy's tiers (`POLICY`): the first tier with an action worth taking gives the best of its
   * kind. Undefined when nothing is worth doing.
   */
  chooseAction(acted: ReadonlySet<number>, memo: Map<number, Action | null>): Action | undefined {
    const ctx: PolicyContext = { acted, memo, open: this.bossOpen(), threats: this.threats(), worn: this.worn(), sustain: new Map(), survival: new Map() };
    ctx.held = this.heldBack(ctx);
    for (const tier of POLICY) {
      const a = tier(this, ctx);
      if (a) return a;
    }
    return undefined;
  }

  /** A planned Rally: a Rally skill's holder rallies first, before anyone fights, while foes are left to fight. */
  bestRally(ctx: PolicyContext): Action | undefined {
    if (!this.foes.length || this.input.lineup.length < 2) return undefined;
    for (let gi = 0; gi < this.input.lineup.length; gi++) {
      if (!ctx.acted.has(gi) && this.kits[gi]!.rally) return { kind: 'rally', group: gi, value: 1 };
    }
    return undefined;
  }

  /**
   * The best attack by a group that hasn't acted (and, unless `all`, isn't held back): one that does something (fells
   * the foe or wears it down) and that the lead more likely survives than not, since waiting doesn't keep it out of
   * enemy phase. Valued by the chance it fells the foe (the target boss first once it's open), a little for the damage
   * it does, less the chance the lead dies.
   */
  bestAttack(ctx: PolicyContext, all = false): Action | undefined {
    let best: Action | undefined;
    for (let gi = 0; gi < this.input.lineup.length; gi++) {
      if (ctx.acted.has(gi) || (!all && ctx.held?.has(gi))) continue;
      const a = this.bestAttackOf(gi, ctx);
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /** Group `gi`'s best attack, one candidate per foe group (its most worn-down foe), memoised while those are unchanged. */
  private bestAttackOf(gi: number, ctx: PolicyContext): Action | undefined {
    if (!this.armed(gi)) return undefined;
    let best: Action | undefined;
    for (const f of ctx.worn) {
      const k = gi * 65536 + f.g;
      let a = ctx.memo.get(k);
      if (a === undefined || (a && a.kind === 'attack' && a.foe !== f)) ctx.memo.set(k, (a = this.attack(gi, f, ctx.open)));
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /** Each foe group's most worn-down foe. */
  private worn(): FoeInstance[] {
    const worn = new Map<number, FoeInstance>();
    for (const f of this.foes) {
      const s = worn.get(f.g);
      if (!s || f.hp < s.hp) worn.set(f.g, f);
    }
    return [...worn.values()];
  }

  /** An attack by group `gi` on foe `f`, if it's worth taking (see `bestAttack`); null if not. */
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

  /**
   * Groups that keep their action from the fighting tier: a dancer (it dances), and a group whose own sustain (its
   * staff, its potion) is worth more than its best attack. They fight later if nothing better turns up.
   */
  private heldBack(ctx: PolicyContext): Set<number> {
    const held = new Set<number>();
    for (let gi = 0; gi < this.input.lineup.length; gi++) {
      if (ctx.acted.has(gi)) continue;
      const kit = this.kits[gi]!;
      if (kit.dances) held.add(gi);
      else if ((kit.staves.length || kit.potions.length) && this.armed(gi)) {
        const own = this.sustainOfCached(gi, ctx);
        if (own && own.value > (this.bestAttackOf(gi, ctx)?.value ?? 0)) held.add(gi);
      }
    }
    return held;
  }

  /** A Dance: a dancer gives another action to the group that has acted with the best attack left to make. */
  bestDance(ctx: PolicyContext): Action | undefined {
    let best: Action | undefined;
    for (let d = 0; d < this.input.lineup.length; d++) {
      if (ctx.acted.has(d) || !this.kits[d]!.dances) continue;
      for (const t of ctx.acted) {
        if (t === d || this.kits[t]!.dances) continue;
        const a = this.bestAttackOf(t, ctx);
        if (a && a.value > 0 && (!best || a.value > best.value)) best = { kind: 'dance', group: d, target: t, value: a.value };
      }
    }
    return best;
  }

  /** The best sustain action by any group that hasn't acted. */
  bestSustain(ctx: PolicyContext): Action | undefined {
    let best: Action | undefined;
    for (let gi = 0; gi < this.input.lineup.length; gi++) {
      if (ctx.acted.has(gi)) continue;
      const a = this.sustainOfCached(gi, ctx);
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /**
   * The foes that can attack on enemy phase (armed, not a boss holding its ground): each group's healthiest, the one
   * that would attack.
   */
  private threats(): FoeInstance[] {
    const by = new Map<number, FoeInstance>();
    for (const f of this.foes) {
      const foe = this.groups[f.g]!.foe;
      if (!foe.weapon || foe.boss) continue;
      const s = by.get(f.g);
      if (!s || f.hp > s.hp) by.set(f.g, f);
    }
    return [...by.values()];
  }

  /** The chance group `gi` survives the worst enemy-phase attack on it at `hp`: 1 out of reach (unarmed, Rescued). */
  private survival(gi: number, hp: number, ctx: PolicyContext): number {
    if (!this.armed(gi) || this.safe.has(gi)) return 1;
    const k = gi * 65536 + hp;
    let s = ctx.survival.get(k);
    if (s === undefined) {
      s = 1;
      for (const f of ctx.threats) s = Math.min(s, this.exchangeOf(gi, f, 'enemy', hp).survive);
      ctx.survival.set(k, s);
    }
    return s;
  }

  /** What restoring `gain` HP to group `gi` is worth: the enemy-phase survival it buys, plus a little for the HP. */
  private healWorth(gi: number, gain: number, ctx: PolicyContext): number {
    if (gain <= 0) return 0;
    const hp = this.hp[gi]!;
    return this.survival(gi, hp + gain, ctx) - this.survival(gi, hp, ctx) + (TOP_UP * gain) / this.maxHp(gi);
  }

  /** `sustainOf`, worked out once per choice. */
  private sustainOfCached(gi: number, ctx: PolicyContext): Action | undefined {
    if (ctx.sustain.has(gi)) return ctx.sustain.get(gi);
    const a = this.kits[gi]!.staves.length || this.kits[gi]!.potions.length ? this.sustainOf(gi, ctx) : undefined;
    ctx.sustain.set(gi, a);
    return a;
  }

  /** Group `gi`'s best sustain action: a staff on another pair (heal, Fortify, Rescue) or a potion on itself. */
  private sustainOf(gi: number, ctx: PolicyContext): Action | undefined {
    const kit = this.kits[gi]!;
    const uses = this.uses[gi]!;
    const n = this.input.lineup.length;
    let best: Action | undefined;
    const consider = (a: Action) => {
      if (a.value > 0 && (!best || a.value > best.value)) best = a;
    };
    for (const p of kit.potions) {
      if (uses[p.item]! <= 0) continue;
      const hp = Math.min(p.heal, this.maxHp(gi) - this.hp[gi]!);
      consider({ kind: 'item', group: gi, item: p.item, hp, value: this.healWorth(gi, hp, ctx) });
    }
    for (const s of kit.staves) {
      if (uses[s.item]! <= 0 || s.reach <= 0) continue;
      const { effect, reach } = s;
      // The expected HP a heal restores to a pair: the heal times the chance the staff reaches it.
      const gainOf = (t: number) => (this.armed(t) ? Math.round(reach * Math.min(effect.amount, this.maxHp(t) - this.hp[t]!)) : 0);
      if (effect.kind === 'heal') {
        for (let t = 0; t < n; t++) {
          if (t === gi) continue;
          const hp = gainOf(t);
          consider({ kind: 'heal', group: gi, item: s.item, reach, heals: [{ group: t, hp }], value: this.healWorth(t, hp, ctx) });
        }
      } else if (effect.kind === 'fortify') {
        const heals = [...Array(n).keys()].filter((t) => t !== gi).map((t) => ({ group: t, hp: gainOf(t) })).filter((h) => h.hp > 0);
        consider({ kind: 'heal', group: gi, item: s.item, reach, heals, value: heals.reduce((v, h) => v + this.healWorth(h.group, h.hp, ctx), 0) });
      } else if (reach >= 0.5) {
        // Rescue plays at its likely result: a pair that has fought is pulled out of enemy phase when it's more likely
        // reached than not.
        for (const t of ctx.acted) {
          if (t === gi || !this.armed(t) || this.safe.has(t)) continue;
          consider({ kind: 'rescue', group: gi, item: s.item, reach, target: t, value: 1 - this.survival(t, this.hp[t]!, ctx) });
        }
      }
    }
    return best;
  }

  /** Plays a chosen action. */
  apply(a: Action, acted: Set<number>, memo: Map<number, Action | null>) {
    acted.add(a.group);
    const grp = this.input.lineup[a.group]!;
    const t = this.tallies.get(grp.lead.id)!;
    const spend = (item: number) => {
      this.uses[a.group]![item]!--;
      const name = grp.lead.items![item]!.item.name;
      t.used[name] = (t.used[name] ?? 0) + 1;
      return name;
    };
    const forget = (gi: number) => {
      for (const k of [...memo.keys()]) if (Math.floor(k / 65536) === gi) memo.delete(k);
    };
    switch (a.kind) {
      case 'attack': {
        const wasOpen = this.bossOpen();
        this.fight(a.group, a.foe, a.ex, 'player');
        // The foe's HP moved: its group's attacks are worked out again (and every one when the boss opens).
        if (wasOpen !== this.bossOpen()) memo.clear();
        else for (const k of [...memo.keys()]) if (k % 65536 === a.foe.g) memo.delete(k);
        forget(a.group);
        return;
      }
      case 'heal': {
        const item = spend(a.item);
        for (const h of a.heals) {
          this.hp[h.group]! += h.hp;
          if (h.hp > 0) this.progress = true;
          forget(h.group);
          this.acts.push({ kind: 'heal', unit: grp.lead.id, target: this.input.lineup[h.group]!.lead.id, item, reach: a.reach, hp: h.hp });
        }
        return;
      }
      case 'rescue': {
        const item = spend(a.item);
        this.safe.add(a.target);
        this.acts.push({ kind: 'rescue', unit: grp.lead.id, target: this.input.lineup[a.target]!.lead.id, item, reach: a.reach });
        return;
      }
      case 'item': {
        const item = spend(a.item);
        this.hp[a.group]! += a.hp;
        if (a.hp > 0) this.progress = true;
        this.acts.push({ kind: 'item', unit: grp.lead.id, item, hp: a.hp });
        return;
      }
      case 'dance': {
        acted.delete(a.target);
        t.dances++;
        this.acts.push({ kind: 'dance', unit: grp.lead.id, target: this.input.lineup[a.target]!.lead.id });
        return;
      }
      case 'rally': {
        const bonus = this.kits[a.group]!.rally!;
        this.bonus.forEach((b, gi) => {
          if (gi !== a.group) this.bonus[gi] = b ? mergeRally(b, bonus) : bonus;
        });
        for (const row of this.ralliedCombats) row.length = 0;
        memo.clear();
        t.rallies++;
        this.acts.push({ kind: 'rally', unit: grp.lead.id });
        return;
      }
    }
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
    // Each group's best attack on each foe group, kept while that group's most worn-down foe and its own HP are unchanged.
    const memo = new Map<number, Action | null>();
    for (;;) {
      const a = this.chooseAction(acted, memo);
      if (!a) return;
      this.apply(a, acted, memo);
      if (this.checkVictory()) return;
    }
  }

  /**
   * Each armed front takes one attack from the worst foe left for it, each foe attacking once: the pairings with the
   * lowest survival first. Bosses hold their ground (they only fight back). Units with no weapon stay out of reach, and
   * so do pairs Rescued this turn.
   */
  enemyPhase() {
    const attackers = this.alive().filter((f) => {
      const foe = this.groups[f.g]!.foe;
      return !!foe.weapon && !foe.boss;
    });
    if (!attackers.length) return;
    const fronts = this.input.lineup.map((_, i) => i).filter((i) => this.armed(i) && !this.safe.has(i));
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
    this.log.push({ turn: this.turn, arrivals: this.arrivals, fights: this.fights, acts: this.acts, foesLeft: this.alive().length, noDeath: this.noDeath });
    this.arrivals = [];
    this.fights = [];
    this.acts = [];
  }
}

/** What the policy's tiers read: who has acted, the attack memo, whether the boss is open, the foes that can attack. */
type PolicyContext = {
  readonly acted: ReadonlySet<number>;
  readonly memo: Map<number, Action | null>;
  readonly open: boolean;
  readonly threats: readonly FoeInstance[];
  /** Each foe group's most worn-down foe: the one an attack on that group picks. */
  readonly worn: readonly FoeInstance[];
  /** Each group's best sustain action, once worked out. */
  readonly sustain: Map<number, Action | undefined>;
  /** Each group's enemy-phase survival by HP, once worked out. */
  readonly survival: Map<number, number>;
  /** Groups keeping their action from the fighting tier (see `heldBack`). */
  held?: ReadonlySet<number>;
};

/**
 * The action policy, tier by tier: the first tier with an action worth taking acts, then the policy starts over.
 * 1. A planned Rally, before anyone fights (its bonus is assumed to reach every pair: a stated blind spot).
 * 2. Fighting, by groups not held back (dancers, and groups whose own sustain is worth more than their attack).
 * 3. A Dance for the group with the best attack left, which then acts in tier 2.
 * 4. Sustain: a heal, Fortify, Rescue or potion, by the enemy-phase survival it buys.
 * 5. Fighting by anyone left, held back or not.
 * #183 (stances) and #195 (EXP priority, waiting) add their tiers here.
 */
const POLICY: readonly ((s: MapState, ctx: PolicyContext) => Action | undefined)[] = [
  (s, ctx) => s.bestRally(ctx),
  (s, ctx) => s.bestAttack(ctx),
  (s, ctx) => s.bestDance(ctx),
  (s, ctx) => s.bestSustain(ctx),
  (s, ctx) => s.bestAttack(ctx, true),
];

/** A lead's kit: its staves (with each one's reach chance against the spread), potions, Dance and Rally. */
function kitOf(u: SimUnit, spread: ArmySpread | undefined): Kit {
  const items = u.items ?? [];
  return {
    staves: items.flatMap((it, i) => {
      const effect = staffEffect(u.fighter, it.item);
      return effect ? [{ item: i, effect, reach: spread ? reachChance(effect.reach, spread) : 1 }] : [];
    }),
    potions: items.flatMap((it, i) => {
      const heal = potionHeal(it.item);
      return heal ? [{ item: i, heal }] : [];
    }),
    dances: dances(u.fighter),
    rally: rallyOf(u.fighter),
  };
}

/** The chance a unit's staff reaches a pair under the spread (0 for an item that isn't a healing or Rescue staff). */
export function staffReach(u: SimUnit, item: GameItem, spread: ArmySpread): number {
  const effect = staffEffect(u.fighter, item);
  return effect ? reachChance(effect.reach, spread) : 0;
}

/** Plays one map (see the module comment). The same input and seed give the same play. */
export function playMap(input: MapPlayInput, seed: number): MapPlay {
  const s = new MapState(input, createRng(seed));
  while (!s.ended && s.turn < MAX_TURNS) {
    // A turn that moved nothing, with no wave to come, would repeat forever: the army can't finish the map.
    if (s.turn > 0 && !s.progress && !s.wavesAhead()) break;
    s.progress = false;
    s.turn++;
    s.startTurn();
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
    blindSpots: s.kits.some((k) => k.rally) ? [...BLIND_SPOTS, 'rally-reaches-every-pair'] : BLIND_SPOTS,
  };
}

/** The mean no-death chance over `runs` plays, each with its own seed from `seed` (Lunatic+ skills drawn anew). */
export function meanNoDeath(input: MapPlayInput, seeds: readonly number[]): number {
  if (!seeds.length) return 1;
  return seeds.reduce((a, sd) => a + playMap(input, sd).noDeath, 0) / seeds.length;
}
