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
 * - Stances (#183, `chooseStances`): each pair picks how it plays the turn: together (either unit in front), or apart
 *   (each unit its own front with its own action; adjacent, in Attack Stance, at the rate the army spread allows).
 *   Pair Up and Separate cost the action the game charges; Switch is free. The turn's **fronts** follow from it.
 * - `playerPhase`: each front not spent has one action, an equal share (a stated blind spot); a Dance gives one more.
 *   `chooseAction` picks the next action by the policy's tiers (`POLICY`) and `apply` plays it. Actions are a union:
 *   #182 added sustain (a heal, Fortify, Rescue, a potion), Dance and Rally (`sustain.ts`); #183 added the bait (a
 *   front waits in reach); #195 (EXP priority: who lands kills, waiting) adds kinds and tiers, not a new loop. Ally
 *   phase (#184) goes between player and enemy phase.
 * - **Exposure** is the player's choice (#183): a front that attacks, or baits, is in reach on enemy phase; one that
 *   holds back isn't. A careful player only exposes a front that very likely lives through it (`EXPOSURE_RISK`), and
 *   when nothing is that safe, engages once a turn with the least risk: the sturdiest front baits, or the safest attack.
 * - HP is carried: damage stays until an action buys it back. A staff reaches a pair with the chance the assumed army
 *   spread gives (`MapPlayInput.spread`), and heals its expected HP.
 * - `enemyPhase`: arrivals free to act (Hard and up), then each exposed front takes one attack from the worst foe left
 *   for it (one worst attacker per pair, a stated blind spot), each foe attacking once.
 * - Tallies per unit (combats, kills per foe group, combats paired with each partner) feed EXP (#186, #195) and
 *   supports (#188); the per-turn log (fights, acts, stances, exposed fronts) feeds the Why panel and the stance plan.
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

/** A pair (lead + back) or a unit alone, as the lineup starts the map: the stance can change it turn by turn (#183). */
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
   * with the share of them within reach, and a pair apart is adjacent (Attack Stance, #183) with the share at 1 tile.
   * Absent: every staff reaches and every pair apart stays adjacent. The engine fills in the `army-spread` assumption.
   */
  readonly spread?: ArmySpread;
};

/**
 * An action other than an attack (#182): a heal (one pair, or every pair in reach with Fortify), a Rescue out of
 * enemy phase, a potion on the unit's own lead, a Dance (the target acts again) or a Rally (every other pair's stats
 * up for the turn); and a bait (#183): the front waits in the foes' reach, to take their attack and counter.
 */
export type SimAct = {
  readonly kind: 'heal' | 'rescue' | 'item' | 'dance' | 'rally' | 'bait';
  /** The acting unit (its front). */
  readonly unit: string;
  /** The front of the pair it's for (a heal or Fortify names each pair it heals, one act each). */
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
  /** The front that fought, and its paired back. */
  readonly lead: string;
  readonly back?: string;
  /** The foe group's key. */
  readonly foe: string;
  /** The lead's chance to survive this exchange: one factor of the no-death chance. */
  readonly survive: number;
  /** Whether the foe fell (the likely result). */
  readonly kill: boolean;
};

/**
 * A pair's stance for one turn (#183): together with one unit in front (the other its back: Dual Guard and pair-up
 * stats, one action), adjacent (apart in Attack Stance: each unit its own front and action, with the other as its
 * Support unit but no pair-up stats) or apart (each alone). The Stance plan reads these turn by turn.
 */
export type SimStance = {
  /** The pair, named by its lead in the lineup. */
  readonly pair: string;
  readonly stance: 'together' | 'adjacent' | 'apart';
  /** Together: the unit in front. */
  readonly front?: string;
  /** Adjacent: the chance the two stand adjacent, from the assumed army spread (the rest of the time, apart). */
  readonly adjacency?: number;
  /**
   * How it got there this turn: Separate (the front drops its back: the front's action), Pair Up (one unit moves onto
   * the other: the mover's action) or Switch (free, once a turn). Absent: as last turn (turn 1: as the lineup starts).
   */
  readonly change?: 'separate' | 'pair-up' | 'switch';
};

export type SimTurn = {
  readonly turn: number;
  readonly arrivals: readonly { readonly group: string; readonly count: number }[];
  /** Each pair's stance this turn (units alone have none). */
  readonly stances: readonly SimStance[];
  readonly fights: readonly SimFight[];
  /** Sustain, Dance, Rally and bait taken this turn, in order. */
  readonly acts: readonly SimAct[];
  /** The fronts in the foes' reach on enemy phase (they attacked or baited); the rest held back. */
  readonly exposed: readonly string[];
  /** Foes on the field at the turn's end. */
  readonly foesLeft: number;
  /** The no-death chance so far. */
  readonly noDeath: number;
};

export type SimUnitTally = {
  /** Exchanges it fought as a front (paired, adjacent or alone). */
  readonly combats: number;
  /** Foes it felled, by foe group key. */
  readonly kills: Readonly<Record<string, number>>;
  /** Exchanges it fought paired up with each partner, as front or back: the combats together supports grow from (#188). */
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
/**
 * The most death risk a careful player takes to put a front in the foes' reach for one turn (#183): an attack's own
 * risk and the enemy phase after it. Riskier engagements wait, unless nothing safer moves the map on that turn.
 */
export const EXPOSURE_RISK = 0.01;
const LUNATIC_PLUS_DRAWS = 2;
const BLIND_SPOTS: readonly BlindSpotId[] = ['one-worst-attacker', 'held-back-out-of-reach', 'equal-share-of-actions', 'likely-result', 'bosses-hold'];
/** A heal's small worth beyond the danger it lifts: HP topped up now is HP in hand for the turns to come. */
const TOP_UP = 0.01;
/** Choices this close count as equal (a stance change needs a real difference). */
const EPS = 1e-9;

type FoeInstance = { readonly g: number; hp: number };

/**
 * What a front can do with its action, valued on one scale: the chance of felling a foe, less the chance of a death it
 * risks (in the exchange and, for a front not yet in reach, the enemy phase after); a sustain action by the enemy-phase
 * survival it buys. `risk` is the death chance an attack or bait takes on.
 */
type Action =
  | Attack
  /** A staff heal: one pair, or each pair in reach (Fortify), each by its expected HP. */
  | { readonly kind: 'heal'; readonly group: number; readonly item: number; readonly reach: number; readonly heals: readonly { readonly group: number; readonly hp: number }[]; readonly value: number }
  | { readonly kind: 'rescue'; readonly group: number; readonly item: number; readonly reach: number; readonly target: number; readonly value: number }
  | { readonly kind: 'item'; readonly group: number; readonly item: number; readonly hp: number; readonly value: number }
  | { readonly kind: 'dance'; readonly group: number; readonly target: number; readonly value: number }
  | { readonly kind: 'rally'; readonly group: number; readonly value: number }
  | { readonly kind: 'bait'; readonly group: number; readonly risk: number; readonly value: number };

/**
 * An attack: its exchange and its worth before exposure (`raw`: the kill chance and damage, less the exchange's death
 * chance), then, worked out lazily and again when the survivals change (`at`), its risk with the enemy phase after
 * (`exact` false: only known to be over `EXPOSURE_RISK`) and its worth with it.
 */
type Attack = {
  readonly kind: 'attack';
  readonly group: number;
  readonly foe: FoeInstance;
  readonly ex: Exchange;
  readonly gain: number;
  readonly raw: number;
  risk: number;
  exact: boolean;
  value: number;
  at: number;
};

type Tally = { combats: number; kills: Record<string, number>; together: Record<string, number>; used: Record<string, number>; dances: number; rallies: number };

/** What a unit brings besides weapons: its staves and potions (by index in `items`), Dance, and Rally. */
type Kit = {
  readonly staves: readonly { readonly item: number; readonly effect: StaffEffect; readonly reach: number }[];
  readonly potions: readonly { readonly item: number; readonly heal: number }[];
  readonly dances: boolean;
  readonly rally: RallyBonus | undefined;
};

/** Groups whose back is an adjacent ally, not paired (Attack Stance): no pair-up stats in their matchups. */
const ADJACENT = new WeakSet<SimGroup>();

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
    if (ADJACENT.has(grp)) ADJACENT.add(g);
    byBonus.set(k, g);
  }
  return g;
}

/**
 * A pair's other arrangements, made once per lineup group so their combats stay cached across plays: switched (the
 * back in front), each unit alone, and each unit in Attack Stance with the other adjacent.
 */
type Variants = { readonly switched: SimGroup; readonly alone: readonly [SimGroup, SimGroup]; readonly adjacent: readonly [SimGroup, SimGroup] };
const VARIANTS = new WeakMap<SimGroup, Variants>();

function variantsOf(grp: SimGroup): Variants {
  let v = VARIANTS.get(grp);
  if (!v) {
    const { lead, support } = grp;
    const back = grp.back!;
    const adjacent: [SimGroup, SimGroup] = [
      { lead, back, support },
      { lead: back, back: lead, support },
    ];
    for (const g of adjacent) ADJACENT.add(g);
    v = { switched: { lead: back, back: lead, support }, alone: [{ lead, support: null }, { lead: back, support: null }], adjacent };
    VARIANTS.set(grp, v);
  }
  return v;
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
    const paired = !ADJACENT.has(grp);
    const best = grp.lead.weapons.length ? bestWeapon(grp.lead.fighter, grp.lead.weapons, back, grp.support, foe, [], paired) : undefined;
    c = best
      ? { m: best.result, weapon: best.weapon?.item, exchanges: new Map() }
      : { m: matchup(grp.lead.fighter, back, grp.support, foe, [], paired), weapon: grp.lead.fighter.weapon?.item, exchanges: new Map() };
    bySkills.set(k, c);
  }
  return c;
}

/**
 * One exchange from two ways it can go: `a` with chance `p` (a pair apart standing adjacent), else `b` (alone). The
 * result reads like any exchange: survival summed, and what follows given survival weighted by each way's share of it.
 */
function mixExchange(a: Exchange, b: Exchange, p: number): Exchange {
  if (p >= 1) return a;
  if (p <= 0) return b;
  const sa = p * a.survive;
  const sb = (1 - p) * b.survive;
  const survive = sa + sb;
  if (survive <= 0) return { ...b, survive: 0, kill: 0 };
  const w = sa / survive;
  const kill = w * a.kill + (1 - w) * b.kill;
  return {
    survive,
    kill,
    leadHp: Math.round(w * a.leadHp + (1 - w) * b.leadHp),
    foeHp: kill >= 0.5 ? 0 : Math.max(1, Math.round(w * a.foeHp + (1 - w) * b.foeHp)),
    leadStrikes: a.leadStrikes || b.leadStrikes,
    foeStrikes: a.foeStrikes || b.foeStrikes,
  };
}

/**
 * One way a pair (or a unit alone) can stand on the field: a front, the unit that acts and takes the hits, with its
 * paired back or, apart, its partner adjacent at the spread's rate. `rows` cache its combats by foe group this play.
 */
type Actor = {
  /** Its index among the play's actors (a cache key). */
  readonly id: number;
  /** Its pair's index in the lineup. */
  readonly pair: number;
  /** The front unit, and the paired back (by unit index). */
  readonly unit: number;
  readonly back?: number;
  readonly grp: SimGroup;
  /** Apart: the Attack Stance group (the partner adjacent), when the spread lets them stand adjacent. */
  readonly adj?: SimGroup;
  readonly rows: (Combat | undefined)[][];
  /** Apart: its exchanges mixed from the two (see `mixExchange`), by foe group, Rally, initiator and HPs. */
  readonly mix: Map<number, Exchange>;
};

/** A pair in the lineup: its units (by index), its actors, and its stance now. */
type Pair = {
  readonly lead: number;
  readonly back?: number;
  /** Together with each unit in front, and each unit apart; a unit alone has only `alone`. */
  readonly together?: readonly [Actor, Actor];
  readonly apart?: readonly [Actor, Actor];
  readonly alone?: Actor;
  /** Together with `front` (0 the lineup's lead, 1 its back) in front, or apart. */
  stance: { readonly kind: 'together'; readonly front: 0 | 1 } | { readonly kind: 'apart' };
};

class MapState {
  readonly groups: SimFoeGroup[] = [];
  readonly foes: FoeInstance[] = [];
  /** Every unit in the lineup (leads and backs), and each one's HP now. */
  readonly units: SimUnit[] = [];
  readonly hp: number[] = [];
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
  stances: SimStance[] = [];
  ended: MapPlay['ended'] | undefined;
  /** Whether anything moved this turn: a foe hurt or felled, HP restored, or an arrival. A turn without is a stall. */
  progress = false;
  /** Whether any pair stood apart (the Attack Stance blind spot applies). */
  splitAny = false;
  /** Each unit's staves, potions, Dance and Rally, and the uses left of each item (by [unit][item]). */
  readonly kits: Kit[];
  readonly uses: number[][];
  readonly pairs: Pair[] = [];
  private readonly actors: Actor[] = [];
  /** The chance a pair apart stands adjacent (Attack Stance), from the spread. */
  private readonly adjacency: number;
  /** This turn's fronts, in lineup order; the policy's group indices are indices into it. */
  front: Actor[] = [];
  /** This turn, by front: its Rally bonus, whether it's Rescued out of enemy phase, in reach, or spent before acting. */
  private bonus: (RallyBonus | undefined)[] = [];
  private readonly safe = new Set<number>();
  readonly exposed = new Set<number>();
  spent = new Set<number>();
  /** The foes arriving at the start of this turn's enemy phase: a careful player reads the schedule. */
  private incoming: FoeInstance[] = [];
  /**
   * Foes on the field by group, the foes that can attack on enemy phase (see `threats`), and the enemy-phase survivals
   * worked out against them (by actor, Rally, HP and foe group gone), kept until the threats change.
   */
  private readonly left: number[] = [];
  /**
   * This turn: each foe group's attacks already spoken for by the fronts in reach, as those fronts' survival against it
   * (each foe attacks once, the pairings a front is least likely to survive first), and the arrivals at enemy phase by
   * group.
   */
  private readonly claimed: number[][] = [];
  private incomingCount = new Map<number, number>();
  private threatList: FoeInstance[] = [];
  private threatState = new Map<number, { readonly hp: number; readonly left: number }>();
  /** Bumped whenever a foe arrives, is hurt or falls, or the arrivals read ahead change: threats and worn foes follow. */
  private foeVersion = 0;
  private threatsAt = -1;
  private wornAt = -1;
  private wornList: FoeInstance[] = [];
  private readonly survCache = new Map<number, number>();
  private readonly survBound = new Map<number, number>();
  private readonly survArg = new Map<number, number>();
  private survWorst = -1;
  /** Bumped whenever the survivals are dropped: an attack's exposure worked out before then is worked out again. */
  private riskVersion = 0;
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
    this.adjacency = input.spread ? reachChance(1, input.spread) : 1;
    const unitIndex = (u: SimUnit) => {
      this.units.push(u);
      this.hp.push(u.fighter.stats.hp);
      this.tallies.set(u.id, { combats: 0, kills: {}, together: {}, used: {}, dances: 0, rallies: 0 });
      return this.units.length - 1;
    };
    const actor = (pair: number, unit: number, grp: SimGroup, back?: number, adj?: SimGroup): Actor => {
      const a: Actor = { id: this.actors.length, pair, unit, ...(back !== undefined ? { back } : {}), grp, ...(adj ? { adj } : {}), rows: [[], []], mix: new Map() };
      this.actors.push(a);
      return a;
    };
    input.lineup.forEach((g, pi) => {
      const lead = unitIndex(g.lead);
      if (!g.back) {
        this.pairs.push({ lead, alone: actor(pi, lead, g), stance: { kind: 'together', front: 0 } });
        return;
      }
      const back = unitIndex(g.back);
      const v = variantsOf(g);
      const adj = this.adjacency > 0;
      this.pairs.push({
        lead,
        back,
        together: [actor(pi, lead, g, back), actor(pi, back, v.switched, lead)],
        apart: [actor(pi, lead, v.alone[0], undefined, adj ? v.adjacent[0] : undefined), actor(pi, back, v.alone[1], undefined, adj ? v.adjacent[1] : undefined)],
        stance: { kind: 'together', front: 0 },
      });
    });
    this.kits = this.units.map((u) => kitOf(u, input.spread));
    this.uses = this.units.map((u) => (u.items ?? []).map((i) => i.uses));
    for (const g of input.map.foes) {
      const i = this.groupIndex(g);
      this.starting.add(i);
      this.spawn(i, g.foe.count);
    }
    this.clearQueue = input.map.waves.filter((w) => w.onClear);
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
    this.left.push(0);
    this.claimed.push([]);
    this.waveGroup.set(g, this.groups.length - 1);
    return this.groups.length - 1;
  }

  private spawn(g: number, count: number) {
    for (let i = 0; i < count; i++) this.foes.push({ g, hp: this.groups[g]!.foe.stats.hp });
    this.spawned[g]! += count;
    this.left[g]! += count;
    this.foeVersion++;
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

  /** The wave groups joining now, and how many of each: on their turns, every turn for unlimited ones. */
  private joining(joins: SimWave['joins']): [SimFoeGroup, number][] {
    const out: [SimFoeGroup, number][] = [];
    let endless = this.endless;
    for (const w of this.input.map.waves) {
      if (w.joins !== joins || w.onClear) continue;
      if (w.turns.includes(this.turn)) for (const g of w.groups) out.push([g, g.foe.count]);
      if (w.everyTurnFrom !== undefined && this.turn >= w.everyTurnFrom && w.groups.length) {
        for (let i = 0; i < (w.perTurn ?? w.groups.length); i++) out.push([w.groups[endless++ % w.groups.length]!, 1]);
      }
    }
    return out;
  }

  /** The waves joining now. */
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
    this.exposed.clear();
    this.dropSurvival();
    for (const c of this.claimed) c.length = 0;
    if (this.bonus.some((b) => b)) this.dropRallied();
  }

  /**
   * Drops the enemy-phase survivals worked out (the threats, the claims on them or the Rally bonus changed), or only
   * those set by the foe groups given.
   */
  private dropSurvival(groups?: readonly number[]) {
    this.riskVersion++;
    if (!groups) {
      this.survCache.clear();
      this.survBound.clear();
      this.survArg.clear();
      return;
    }
    // Only the survivals these foe groups set: the rest stand (fewer foes free only lifts a survival they set).
    for (const [k, g] of this.survArg) {
      if (!groups.includes(g)) continue;
      this.survArg.delete(k);
      this.survCache.delete(k);
      this.survBound.delete(k);
    }
  }

  /** Drops the combats worked out with a Rally bonus (the bonus changed). */
  private dropRallied() {
    for (const a of this.actors) {
      a.rows[1] = a.rows[3] = [];
      a.mix.clear();
    }
  }

  /** The foes on the field (the fallen are dropped as they fall). */
  alive(): readonly FoeInstance[] {
    return this.foes;
  }

  /** An actor's exchange with foe `f` from `hp`, with a Rally bonus on it; apart, Attack Stance at the spread's rate. */
  private exchangeFor(a: Actor, bonus: RallyBonus | undefined, f: FoeInstance, initiator: Initiator, hp: number): Exchange {
    if (!a.adj) return this.exchangeWith(a.grp, a.rows, 0, bonus, f, initiator, hp);
    const k = (((f.g * 2 + (bonus ? 1 : 0)) * 2 + (initiator === 'player' ? 0 : 1)) * 1024 + hp) * 1024 + f.hp;
    let ex = a.mix.get(k);
    if (!ex) {
      const alone = this.exchangeWith(a.grp, a.rows, 0, bonus, f, initiator, hp);
      a.mix.set(k, (ex = mixExchange(this.exchangeWith(a.adj, a.rows, 2, bonus, f, initiator, hp), alone, this.adjacency)));
    }
    return ex;
  }

  private exchangeWith(grp: SimGroup, rows: (Combat | undefined)[][], slot: 0 | 2, bonus: RallyBonus | undefined, f: FoeInstance, initiator: Initiator, hp: number): Exchange {
    const c = this.combatWith(bonus ? ralliedGroup(grp, bonus) : grp, rows, slot + (bonus ? 1 : 0), f);
    const key = (initiator === 'player' ? 0 : 1 << 21) + hp * 1024 + f.hp;
    let ex = c.exchanges.get(key);
    if (!ex) c.exchanges.set(key, (ex = exchange(c.m, c.weapon, hp, f.hp, initiator)));
    return ex;
  }

  /** A group's combat against foe `f`'s group, cached in the actor's row `r` (alone or adjacent, rallied or not). */
  private combatWith(grp: SimGroup, rows: (Combat | undefined)[][], r: number, f: FoeInstance): Combat {
    const row = (rows[r] ??= []);
    return (row[f.g] ??= combatOf(grp, this.groups[f.g]!.foe, this.drawn[f.g]!));
  }

  /** Front `gi`'s exchange with foe `f`, from `hp` (its HP now by default), with this turn's Rally bonus on it. */
  exchangeOf(gi: number, f: FoeInstance, initiator: Initiator, hp?: number): Exchange {
    const a = this.front[gi]!;
    return this.exchangeFor(a, this.bonus[gi], f, initiator, hp ?? this.hp[a.unit]!);
  }

  private unitArmed(u: number): boolean {
    const unit = this.units[u]!;
    return unit.weapons.length > 0 || !!unit.fighter.weapon;
  }

  armed(gi: number): boolean {
    return this.unitArmed(this.front[gi]!.unit);
  }

  /**
   * Whether an actor can be attacked: an armed front, or any pair together (its back fights for it). A unit alone with
   * no weapon (a healer, a dancer) stays out of reach.
   */
  private reachable(a: Actor): boolean {
    return this.unitArmed(a.unit) || (a.back !== undefined && this.unitArmed(a.back));
  }

  private maxHp(gi: number): number {
    return this.units[this.front[gi]!.unit]!.fighter.stats.hp;
  }

  /** Plays out an exchange: the chance multiplies in, HPs move to the likely result, and the tallies count it. */
  fight(gi: number, f: FoeInstance, ex: Exchange, phase: Initiator) {
    const a = this.front[gi]!;
    const lead = this.units[a.unit]!;
    const back = a.back !== undefined ? this.units[a.back]! : undefined;
    const key = this.groups[f.g]!.key;
    this.noDeath *= ex.survive;
    this.foeVersion++;
    if (ex.survive > 0) {
      this.hp[a.unit] = ex.leadHp;
      if (ex.foeHp < f.hp) this.progress = true;
      f.hp = ex.foeHp;
    }
    const kill = f.hp <= 0;
    if (kill) {
      this.foes.splice(this.foes.indexOf(f), 1);
      this.left[f.g]!--;
    }
    if (phase === 'player') this.expose(gi);
    const t = this.tallies.get(lead.id)!;
    t.combats++;
    if (kill) {
      t.kills[key] = (t.kills[key] ?? 0) + 1;
      this.felled[f.g]!++;
    }
    if (back) {
      t.together[back.id] = (t.together[back.id] ?? 0) + 1;
      const b = this.tallies.get(back.id)!;
      b.together[lead.id] = (b.together[lead.id] ?? 0) + 1;
    }
    this.fights.push({ phase, lead: lead.id, ...(back ? { back: back.id } : {}), foe: key, survive: ex.survive, kill });
  }

  /**
   * Puts front `gi` in the foes' reach for this enemy phase: the foe it would face is spoken for, so the next front
   * exposed reckons with the foes left (each foe attacks once).
   */
  private expose(gi: number) {
    if (this.exposed.has(gi)) return;
    this.exposed.add(gi);
    const a = this.front[gi]!;
    if (!this.reachable(a) || this.safe.has(gi)) return;
    let worst: { g: number; s: number } | undefined;
    this.refreshThreats();
    for (const f of this.threatList) {
      const s = this.exchangeOf(gi, f, 'enemy').survive;
      if (this.free(f.g, s, -1) && (!worst || s < worst.s)) worst = { g: f.g, s };
    }
    if (worst) {
      this.claimed[worst.g]!.push(worst.s);
      this.dropSurvival([worst.g]);
    }
  }

  /**
   * Whether a foe of group `g` is left to attack a front that survives it with `s` (one of group `without` about to
   * fall): the enemy phase pairs off the least survivable pairings first, so fronts that fare worse against it come first.
   */
  private free(g: number, s: number, without: number): boolean {
    let before = g === without ? 1 : 0;
    for (const c of this.claimed[g]!) if (c <= s) before++;
    return before < this.left[g]! + (this.incomingCount.get(g) ?? 0);
  }

  /**
   * Whether the target boss can be fought now: from the turn the solve picks, or once the foes the map starts with
   * are gone (reinforcements don't hold it back: Endgame's never stop).
   */
  private bossOpen(): boolean {
    if (this.input.bossTurn !== undefined) return this.turn >= this.input.bossTurn;
    return this.foes.every((f) => this.groups[f.g]!.target || !this.starting.has(f.g));
  }

  /** The policy's context for one choice. */
  private context(acted: ReadonlySet<number>, memo: Map<number, Attack | null>): PolicyContext {
    this.refreshThreats();
    return { acted, memo, open: this.bossOpen(), threats: this.threatList, worn: this.worn(), sustain: new Map(), survival: this.survCache };
  }

  /**
   * Works out the threats again; true when they changed in what they do (a group's healthiest HP, or how many are left),
   * which drops the survivals worked out against them.
   */
  private refreshThreats(): boolean {
    if (this.threatsAt === this.foeVersion) return false;
    this.threatsAt = this.foeVersion;
    const list = this.threats();
    this.threatList = list;
    // A group that's weaker than before (hurt, fewer left, gone) only moves the survivals it set; one that's new or
    // stronger can move any.
    const was = this.threatState;
    const now = new Map(list.map((f) => [f.g, { hp: f.hp, left: this.left[f.g]! }] as const));
    this.threatState = now;
    let full = false;
    const weaker: number[] = [];
    for (const [g, x] of now) {
      const y = was.get(g);
      if (!y || x.hp > y.hp || x.left > y.left) full = true;
      else if (x.hp < y.hp || x.left < y.left) weaker.push(g);
    }
    for (const g of was.keys()) if (!now.has(g)) weaker.push(g);
    if (full) this.dropSurvival();
    else if (weaker.length) this.dropSurvival(weaker);
    return full || weaker.length > 0;
  }

  /**
   * The next action, by the policy's tiers (`POLICY`): the first tier with an action worth taking gives the best of its
   * kind. Undefined when nothing is worth doing.
   */
  chooseAction(acted: ReadonlySet<number>, memo: Map<number, Attack | null>): Action | undefined {
    const ctx = this.context(acted, memo);
    ctx.held = this.heldBack(ctx);
    for (const tier of POLICY) {
      const a = tier(this, ctx);
      if (a) return a;
    }
    return undefined;
  }

  /**
   * Each pair's stance this turn (#183), as a careful player picks it before moving, and the turn's fronts:
   * - Apart when that's more safe work than together (as much, once apart): a unit's safe work is an attack within
   *   `EXPOSURE_RISK` (or, unarmed, a staff, Dance or Rally to use); together has one action. Each unit apart then
   *   acts, and is only exposed if it attacks; one with nothing safe to do holds back.
   * - Together otherwise, with the front whose engagement is safest (its safest attack or bait): pair-up stats and
   *   Dual Guard on the one that fights, and the back never takes a hit.
   * The game's costs: Separate spends the front's action (its back, dropped beside it, still acts); Pair Up spends the
   * mover's (the other acts, paired); Switch is free, once a turn, before the pair moves (it loses the move left).
   */
  chooseStances() {
    const joining = this.joining('enemy-phase').map(([g, n]) => [this.groupIndex(g), n] as const);
    this.foeVersion++;
    this.incoming = joining.map(([g]) => ({ g, hp: this.groups[g]!.foe.stats.hp }));
    this.incomingCount = new Map();
    for (const [g, n] of joining) this.incomingCount.set(g, (this.incomingCount.get(g) ?? 0) + n);
    const ctx = this.context(new Set(), new Map());
    this.stances = [];
    this.front = [];
    this.spent = new Set();
    for (const p of this.pairs) {
      if (p.alone) {
        this.front.push(p.alone);
        continue;
      }
      const was = p.stance;
      const units = [p.lead, p.back!] as const;
      // The safe work each way: apart, each unit with a safe attack alone (or, unarmed, a staff, Dance or Rally to use);
      // together, one action if either front has a safe attack. A unit apart with nothing safe to do holds back.
      const safe = new Map<Actor, boolean>();
      const hasSafe = (a: Actor) => {
        let v = safe.get(a);
        if (v === undefined) safe.set(a, (v = this.unitArmed(a.unit) && this.hasSafeAttack(a, ctx)));
        return v;
      };
      const togetherWork = p.together!.some(hasSafe) ? 1 : 0;
      // Together, splitting needs more work apart than together; apart, as much. Stop counting once that's settled.
      const needed = was.kind === 'together' ? togetherWork + 1 : togetherWork;
      let apartWork = 0;
      for (let k = 0; k < 2 && apartWork < needed && apartWork + 2 - k >= needed; k++) {
        const u = units[k]!;
        if (this.unitArmed(u) ? hasSafe(p.apart![k]!) : this.useful(u)) apartWork++;
      }
      const splits = apartWork >= needed;
      let change: SimStance['change'];
      if (splits) {
        p.stance = { kind: 'apart' };
        if (was.kind === 'together') {
          change = 'separate';
          this.spent.add(this.front.length + was.front);
        }
        this.front.push(p.apart![0]!, p.apart![1]!);
      } else {
        const risk = (k: 0 | 1) => {
          const a = p.together![k]!;
          if (!this.unitArmed(a.unit)) return Infinity;
          return hasSafe(a) ? 0 : 1 - this.survivalOf(a, undefined, this.hp[a.unit]!, ctx, -1);
        };
        const cur: 0 | 1 = was.kind === 'together' ? was.front : 0;
        const other: 0 | 1 = cur === 0 ? 1 : 0;
        const front = risk(other) < risk(cur) - EPS ? other : cur;
        p.stance = { kind: 'together', front };
        if (was.kind === 'apart') change = 'pair-up';
        else if (front !== was.front) change = 'switch';
        this.front.push(p.together![front]!);
      }
      this.splitAny ||= p.stance.kind === 'apart';
      const st = p.stance;
      this.stances.push({
        pair: this.units[p.lead]!.id,
        ...(st.kind === 'together'
          ? { stance: 'together' as const, front: this.units[units[st.front]]!.id }
          : this.adjacency > 0
            ? { stance: 'adjacent' as const, adjacency: this.adjacency }
            : { stance: 'apart' as const }),
        ...(change ? { change } : {}),
      });
    }
    this.bonus = this.front.map(() => undefined);
  }

  /** Whether an unarmed unit has something to do apart: a staff with uses, a Dance or a Rally. */
  private useful(u: number): boolean {
    const kit = this.kits[u]!;
    return kit.dances || !!kit.rally || kit.staves.some((s) => this.uses[u]![s.item]! > 0 && s.reach > 0);
  }

  /** Whether an actor has an attack now within `EXPOSURE_RISK`, exposure to enemy phase included. */
  private hasSafeAttack(a: Actor, ctx: PolicyContext): boolean {
    for (const f of ctx.worn) {
      const r = this.attackRisk(a, undefined, false, f, ctx, true);
      if (r && r.risk <= EXPOSURE_RISK) return true;
    }
    return false;
  }

  /**
   * An attack by actor `a` on foe `f`: the exchange, and its death risk: the exchange's, then (unless the front is
   * already in reach) the enemy phase after, at the HP it's left with, against the foes that would be left. Null when it
   * can't strike, the boss isn't open, or it more likely dies than not. With `bound`, a risk over `EXPOSURE_RISK` may
   * be a low estimate (`exact` false): enough to tell it's not safe.
   */
  private attackRisk(a: Actor, bonus: RallyBonus | undefined, exposed: boolean, f: FoeInstance, ctx: PolicyContext, bound = false): { ex: Exchange; risk: number; exact: boolean } | null {
    if (this.groups[f.g]!.target && !ctx.open) return null;
    const ex = this.exchangeFor(a, bonus, f, 'player', this.hp[a.unit]!);
    if (!ex.leadStrikes || ex.survive < 0.5 || (ex.foeHp >= f.hp && ex.kill <= 0)) return null;
    if (exposed) return { ex, risk: 1 - ex.survive, exact: true };
    if (bound && 1 - ex.survive > EXPOSURE_RISK) return { ex, risk: 1 - ex.survive, exact: false };
    const floor = bound ? (1 - EXPOSURE_RISK) / ex.survive : 0;
    const after = this.survivalOf(a, bonus, ex.leadHp, ctx, ex.foeHp <= 0 ? f.g : -1, floor);
    return { ex, risk: 1 - ex.survive * after, exact: after >= floor };
  }

  /** A planned Rally: a Rally skill's holder rallies first, before anyone fights, while foes are left to fight. */
  bestRally(ctx: PolicyContext): Action | undefined {
    if (!this.foes.length || this.front.length < 2) return undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (!ctx.acted.has(gi) && this.kitOf(gi).rally) return { kind: 'rally', group: gi, value: 1 };
    }
    return undefined;
  }

  private kitOf(gi: number): Kit {
    return this.kits[this.front[gi]!.unit]!;
  }

  /**
   * The best attack by a front that hasn't acted (and, unless `all`, isn't held back), within `maxRisk`: one that does
   * something (fells the foe or wears it down) and that the lead more likely survives than not. Valued by the chance it
   * fells the foe (the target boss first once it's open), a little for the damage it does, less the chance of a death.
   */
  bestAttack(ctx: PolicyContext, all = false, maxRisk = EXPOSURE_RISK): Attack | undefined {
    let best: Attack | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || (!all && ctx.held?.has(gi))) continue;
      const a = this.bestAttackOf(gi, ctx, maxRisk);
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /** Front `gi`'s attacks, one per foe group (its most worn-down foe), memoised while that foe and the front are unchanged. */
  private attacksOf(gi: number, ctx: PolicyContext): Attack[] {
    const out: Attack[] = [];
    if (!this.armed(gi)) return out;
    for (const f of ctx.worn) {
      const k = gi * 65536 + f.g;
      let a = ctx.memo.get(k);
      if (a === undefined || (a && a.foe !== f)) ctx.memo.set(k, (a = this.attack(gi, f, ctx)));
      if (a) out.push(a);
    }
    return out;
  }

  /**
   * Front `gi`'s best attack within `maxRisk`. Exposure only lowers an attack's worth, so attacks are checked best
   * `raw` first, stopping once none left could beat the best found.
   */
  private bestAttackOf(gi: number, ctx: PolicyContext, maxRisk = EXPOSURE_RISK): Attack | undefined {
    let best: Attack | undefined;
    for (const a of this.attacksOf(gi, ctx).sort((x, y) => y.raw - x.raw)) {
      if (best && best.value >= a.raw) break;
      this.exposure(a, ctx, maxRisk < 1);
      if (a.risk <= maxRisk && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /**
   * An attack's risk with the enemy phase after it: the exchange's death chance, then, unless the front is already in
   * reach, its survival at the HP it's left with against the foes that would be left. With `bound`, a risk over
   * `EXPOSURE_RISK` may stop at a low estimate (`exact` false).
   */
  private exposure(a: Attack, ctx: PolicyContext, bound: boolean) {
    if (a.at === this.riskVersion && (a.exact || bound)) return;
    const { ex } = a;
    if (this.exposed.has(a.group)) {
      a.risk = 1 - ex.survive;
      a.exact = true;
    } else if (bound && 1 - ex.survive > EXPOSURE_RISK) {
      a.risk = 1 - ex.survive;
      a.exact = false;
    } else {
      const floor = bound ? (1 - EXPOSURE_RISK) / ex.survive : 0;
      const after = this.survivalOf(this.front[a.group]!, this.bonus[a.group], ex.leadHp, ctx, ex.foeHp <= 0 ? a.foe.g : -1, floor);
      a.risk = 1 - ex.survive * after;
      a.exact = after >= floor;
    }
    a.value = (1 - a.risk) * a.gain - a.risk;
    a.at = this.riskVersion;
  }

  /** Each foe group's most worn-down foe. */
  private worn(): FoeInstance[] {
    if (this.wornAt === this.foeVersion) return this.wornList;
    this.wornAt = this.foeVersion;
    const worn = new Map<number, FoeInstance>();
    for (const f of this.foes) {
      const s = worn.get(f.g);
      if (!s || f.hp < s.hp) worn.set(f.g, f);
    }
    return (this.wornList = [...worn.values()]);
  }

  /** An attack by front `gi` on foe `f` that does something and that it more likely survives than not; null if not. */
  private attack(gi: number, f: FoeInstance, ctx: PolicyContext): Attack | null {
    if (this.groups[f.g]!.target && !ctx.open) return null;
    const ex = this.exchangeOf(gi, f, 'player');
    if (!ex.leadStrikes || ex.survive < 0.5) return null;
    const target = !!this.groups[f.g]!.target;
    const dealt = ex.foeHp < f.hp ? (f.hp - ex.foeHp) / f.hp : 0;
    const gain = ex.kill * (target ? 100 : 1) + 0.5 * dealt;
    if (gain <= 0) return null;
    return { kind: 'attack', group: gi, foe: f, ex, gain, raw: ex.survive * gain - (1 - ex.survive), risk: 1, exact: false, value: -1, at: -1 };
  }

  /**
   * When nobody is in the foes' reach yet this turn and foes are left, the army engages once, with the least risk: the
   * safest attack by anyone (whatever its risk), or a bait (a front waits in reach, to take one attack and counter),
   * whichever risks less. Otherwise holding back would never finish the map.
   */
  engage(ctx: PolicyContext): Action | undefined {
    if (this.exposed.size || !this.foes.length) return undefined;
    let best: { readonly action: Action; readonly risk: number } | undefined;
    const consider = (action: Action, risk: number) => {
      if (!best || risk < best.risk - EPS) best = { action, risk };
    };
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || !this.armed(gi)) continue;
      // Its least risky attack, then waiting in reach.
      for (const a of this.attacksOf(gi, ctx)) {
        this.exposure(a, ctx, false);
        consider(a, a.risk);
      }
      if (ctx.threats.length && !this.safe.has(gi) && this.counters(gi, ctx)) {
        const risk = 1 - this.survival(gi, this.hp[this.front[gi]!.unit]!, ctx);
        consider({ kind: 'bait', group: gi, risk, value: 0 }, risk);
      }
    }
    return (best as { readonly action: Action } | undefined)?.action;
  }

  /** Whether front `gi` would hurt the foe worst for it on enemy phase: a bait that can't counter moves nothing. */
  private counters(gi: number, ctx: PolicyContext): boolean {
    let worst: Exchange | undefined;
    let foe: FoeInstance | undefined;
    for (const f of ctx.threats) {
      const ex = this.exchangeOf(gi, f, 'enemy');
      if (!worst || ex.survive < worst.survive) [worst, foe] = [ex, f];
    }
    return !!worst && !!foe && worst.leadStrikes && worst.foeHp < foe.hp;
  }

  /**
   * Fronts that keep their action from the fighting tier: a dancer (it dances), and a front whose own sustain (its
   * staff, its potion) is worth more than its best attack. They fight later if nothing better turns up.
   */
  private heldBack(ctx: PolicyContext): Set<number> {
    const held = new Set<number>();
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi)) continue;
      const kit = this.kitOf(gi);
      if (kit.dances) held.add(gi);
      else if ((kit.staves.length || kit.potions.length) && this.armed(gi)) {
        const own = this.sustainOfCached(gi, ctx);
        if (own && own.value > (this.bestAttackOf(gi, ctx)?.value ?? 0)) held.add(gi);
      }
    }
    return held;
  }

  /** A Dance: a dancer gives another action to the front that has acted with the best safe attack left to make. */
  bestDance(ctx: PolicyContext): Action | undefined {
    let best: Action | undefined;
    for (let d = 0; d < this.front.length; d++) {
      if (ctx.acted.has(d) || !this.kitOf(d).dances) continue;
      for (const t of ctx.acted) {
        if (t === d || this.kitOf(t).dances) continue;
        const a = this.bestAttackOf(t, ctx);
        if (a && a.value > 0 && (!best || a.value > best.value)) best = { kind: 'dance', group: d, target: t, value: a.value };
      }
    }
    return best;
  }

  /** The best sustain action by any front that hasn't acted. */
  bestSustain(ctx: PolicyContext): Action | undefined {
    let best: Action | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi)) continue;
      const a = this.sustainOfCached(gi, ctx);
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /**
   * The foes that can attack on enemy phase (armed, not a boss holding its ground): each group's healthiest, the one
   * that would attack, and the arrivals joining at its start.
   */
  private threats(): FoeInstance[] {
    const by = new Map<number, FoeInstance>();
    for (const list of [this.foes, this.incoming]) {
      for (const f of list) {
        const foe = this.groups[f.g]!.foe;
        if (!foe.weapon || foe.boss) continue;
        const s = by.get(f.g);
        if (!s || f.hp > s.hp) by.set(f.g, f);
      }
    }
    // The hardest hitters first: a survival check with a floor meets its worst early.
    const power = (f: FoeInstance) => {
      const foe = this.groups[f.g]!.foe;
      return Math.max(foe.stats.str, foe.stats.mag) + (foe.weapon?.mt ?? 0) + (foe.weapon?.crit ?? 0) / 4;
    };
    return [...by.values()].sort((a, b) => power(b) - power(a));
  }

  /**
   * The chance an actor survives the worst enemy-phase attack on it at `hp`, from the foes not yet spoken for (one of
   * group `without` about to fall): 1 out of reach (a unit alone with no weapon). Given a `floor`, it may stop at the
   * first threat that takes it below.
   */
  private survivalOf(a: Actor, bonus: RallyBonus | undefined, hp: number, ctx: PolicyContext, without: number, floor = 0): number {
    if (!this.reachable(a)) return 1;
    // One foe fewer only matters when its group is the one setting the survival.
    const s = this.survivalScan(a, bonus, hp, ctx, -1, floor);
    if (without < 0 || this.survWorst !== without) return s;
    return this.survivalScan(a, bonus, hp, ctx, without, floor);
  }

  /** `survivalOf`'s scan, cached; `survWorst` names the foe group that sets it (-1: none). */
  private survivalScan(a: Actor, bonus: RallyBonus | undefined, hp: number, ctx: PolicyContext, without: number, floor: number): number {
    const k = ((a.id * 2 + (bonus ? 1 : 0)) * 1024 + hp) * 1024 + (without + 1);
    let s = ctx.survival.get(k);
    if (s !== undefined) {
      this.survWorst = this.survArg.get(k)!;
      return s;
    }
    // A bound found before (a survival at most this) settles any floor above it.
    const b = this.survBound.get(k);
    if (b !== undefined && b < floor) {
      this.survWorst = this.survArg.get(k)!;
      return b;
    }
    s = 1;
    let worst = -1;
    for (const f of ctx.threats) {
      const x = this.exchangeFor(a, bonus, f, 'enemy', hp).survive;
      if (x < s && this.free(f.g, x, without)) {
        s = x;
        worst = f.g;
        // Below the floor: that's all the caller needs to know (kept as a bound, not the survival).
        if (s < floor) {
          this.survBound.set(k, s);
          this.survArg.set(k, worst);
          this.survWorst = worst;
          return s;
        }
      }
    }
    ctx.survival.set(k, s);
    this.survArg.set(k, worst);
    this.survWorst = worst;
    return s;
  }

  /** Front `gi`'s enemy-phase survival at `hp`: 1 when Rescued. */
  private survival(gi: number, hp: number, ctx: PolicyContext): number {
    if (this.safe.has(gi)) return 1;
    return this.survivalOf(this.front[gi]!, this.bonus[gi], hp, ctx, -1);
  }

  /** What restoring `gain` HP to front `gi` is worth: the enemy-phase survival it buys, plus a little for the HP. */
  private healWorth(gi: number, gain: number, ctx: PolicyContext): number {
    if (gain <= 0) return 0;
    const hp = this.hp[this.front[gi]!.unit]!;
    return this.survival(gi, hp + gain, ctx) - this.survival(gi, hp, ctx) + (TOP_UP * gain) / this.maxHp(gi);
  }

  /** `sustainOf`, worked out once per choice. */
  private sustainOfCached(gi: number, ctx: PolicyContext): Action | undefined {
    if (ctx.sustain.has(gi)) return ctx.sustain.get(gi);
    const kit = this.kitOf(gi);
    const a = kit.staves.length || kit.potions.length ? this.sustainOf(gi, ctx) : undefined;
    ctx.sustain.set(gi, a);
    return a;
  }

  /** Front `gi`'s best sustain action: a staff on another front (heal, Fortify, Rescue) or a potion on itself. */
  private sustainOf(gi: number, ctx: PolicyContext): Action | undefined {
    const kit = this.kitOf(gi);
    const uses = this.uses[this.front[gi]!.unit]!;
    const n = this.front.length;
    let best: Action | undefined;
    const consider = (a: Action) => {
      if (a.value > 0 && (!best || a.value > best.value)) best = a;
    };
    const hpOf = (t: number) => this.hp[this.front[t]!.unit]!;
    for (const p of kit.potions) {
      if (uses[p.item]! <= 0) continue;
      const hp = Math.min(p.heal, this.maxHp(gi) - hpOf(gi));
      consider({ kind: 'item', group: gi, item: p.item, hp, value: this.healWorth(gi, hp, ctx) });
    }
    for (const s of kit.staves) {
      if (uses[s.item]! <= 0 || s.reach <= 0) continue;
      const { effect, reach } = s;
      // The expected HP a heal restores to a front: the heal times the chance the staff reaches it.
      const gainOf = (t: number) => (this.armed(t) ? Math.round(reach * Math.min(effect.amount, this.maxHp(t) - hpOf(t))) : 0);
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
        // Rescue plays at its likely result: a front in reach is pulled out of enemy phase when it's more likely
        // reached than not.
        for (const t of this.exposed) {
          if (t === gi || this.safe.has(t)) continue;
          consider({ kind: 'rescue', group: gi, item: s.item, reach, target: t, value: 1 - this.survival(t, hpOf(t), ctx) });
        }
      }
    }
    return best;
  }

  /** Plays a chosen action. */
  apply(a: Action, acted: Set<number>, memo: Map<number, Attack | null>) {
    acted.add(a.group);
    const unit = this.front[a.group]!.unit;
    const lead = this.units[unit]!;
    const t = this.tallies.get(lead.id)!;
    const idOf = (gi: number) => this.units[this.front[gi]!.unit]!.id;
    const spend = (item: number) => {
      this.uses[unit]![item]!--;
      const name = lead.items![item]!.item.name;
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
        // The foe's HP moved: its group's attacks are worked out again, and the attacker's (every one when the boss
        // opens). Exposures follow the survivals on their own (`riskVersion`).
        if (wasOpen !== this.bossOpen()) memo.clear();
        else {
          for (const k of [...memo.keys()]) if (k % 65536 === a.foe.g) memo.delete(k);
          forget(a.group);
        }
        return;
      }
      case 'heal': {
        const item = spend(a.item);
        for (const h of a.heals) {
          this.hp[this.front[h.group]!.unit]! += h.hp;
          if (h.hp > 0) this.progress = true;
          forget(h.group);
          this.acts.push({ kind: 'heal', unit: lead.id, target: idOf(h.group), item, reach: a.reach, hp: h.hp });
        }
        return;
      }
      case 'rescue': {
        const item = spend(a.item);
        this.safe.add(a.target);
        this.acts.push({ kind: 'rescue', unit: lead.id, target: idOf(a.target), item, reach: a.reach });
        return;
      }
      case 'item': {
        const item = spend(a.item);
        this.hp[unit]! += a.hp;
        if (a.hp > 0) this.progress = true;
        forget(a.group);
        this.acts.push({ kind: 'item', unit: lead.id, item, hp: a.hp });
        return;
      }
      case 'dance': {
        acted.delete(a.target);
        t.dances++;
        this.acts.push({ kind: 'dance', unit: lead.id, target: idOf(a.target) });
        return;
      }
      case 'rally': {
        const bonus = this.kitOf(a.group).rally!;
        this.bonus.forEach((b, gi) => {
          if (gi !== a.group) this.bonus[gi] = b ? mergeRally(b, bonus) : bonus;
        });
        this.dropRallied();
        this.dropSurvival();
        memo.clear();
        t.rallies++;
        this.acts.push({ kind: 'rally', unit: lead.id });
        return;
      }
      case 'bait': {
        this.expose(a.group);
        memo.clear();
        this.acts.push({ kind: 'bait', unit: lead.id });
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
    // Fronts spent by this turn's Separate have no action left.
    const acted = new Set<number>(this.spent);
    // Each front's best attack on each foe group, kept while that group's most worn-down foe and its own HP are unchanged.
    const memo = new Map<number, Attack | null>();
    for (;;) {
      const a = this.chooseAction(acted, memo);
      if (!a) return;
      this.apply(a, acted, memo);
      if (this.checkVictory()) return;
    }
  }

  /**
   * Each exposed front (it attacked or baited) takes one attack from the worst foe left for it, each foe attacking
   * once: the pairings with the lowest survival first. Bosses hold their ground (they only fight back). Fronts that held
   * back stay out of reach, and so do units alone with no weapon and pairs Rescued this turn.
   */
  enemyPhase() {
    // The arrivals a careful player read ahead are on the field now.
    this.incoming = [];
    this.foeVersion++;
    this.incomingCount = new Map();
    const attackers = this.alive().filter((f) => {
      const foe = this.groups[f.g]!.foe;
      return !!foe.weapon && !foe.boss;
    });
    if (!attackers.length) return;
    // An army that moved nothing this turn can't keep away: the foes close in on every front.
    if (!this.progress) this.front.forEach((_, gi) => this.exposed.add(gi));
    const fronts = [...this.exposed].filter((i) => this.reachable(this.front[i]!) && !this.safe.has(i)).sort((a, b) => a - b);
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
    const exposed = [...this.exposed].sort((a, b) => a - b).map((gi) => this.units[this.front[gi]!.unit]!.id);
    this.log.push({ turn: this.turn, arrivals: this.arrivals, stances: this.stances, fights: this.fights, acts: this.acts, exposed, foesLeft: this.alive().length, noDeath: this.noDeath });
    this.arrivals = [];
    this.stances = [];
    this.fights = [];
    this.acts = [];
  }
}

/** What the policy's tiers read: who has acted, the attack memo, whether the boss is open, the foes that can attack. */
type PolicyContext = {
  readonly acted: ReadonlySet<number>;
  readonly memo: Map<number, Attack | null>;
  readonly open: boolean;
  readonly threats: readonly FoeInstance[];
  /** Each foe group's most worn-down foe: the one an attack on that group picks. */
  readonly worn: readonly FoeInstance[];
  /** Each front's best sustain action, once worked out. */
  readonly sustain: Map<number, Action | undefined>;
  /** Enemy-phase survival by actor, HP and foe group gone, once worked out. */
  readonly survival: Map<number, number>;
  /** Fronts keeping their action from the fighting tier (see `heldBack`). */
  held?: ReadonlySet<number>;
};

/**
 * The action policy, tier by tier: the first tier with an action worth taking acts, then the policy starts over.
 * 1. A planned Rally, before anyone fights (its bonus is assumed to reach every pair: a stated blind spot).
 * 2. Safe fighting (within `EXPOSURE_RISK`), by fronts not held back (dancers, and fronts whose own sustain is worth
 *    more than their attack).
 * 3. A Dance for the front with the best safe attack left, which then acts in tier 2.
 * 4. Sustain: a heal, Fortify, Rescue or potion, by the enemy-phase survival it buys.
 * 5. Safe fighting by anyone left, held back or not.
 * 6. Engaging (#183): nobody is in reach yet, so the least risky attack or bait goes ahead; the rest hold back.
 * #195 (EXP priority, waiting) adds its tiers here.
 */
const POLICY: readonly ((s: MapState, ctx: PolicyContext) => Action | undefined)[] = [
  (s, ctx) => s.bestRally(ctx),
  (s, ctx) => s.bestAttack(ctx),
  (s, ctx) => s.bestDance(ctx),
  (s, ctx) => s.bestSustain(ctx),
  (s, ctx) => s.bestAttack(ctx, true),
  (s, ctx) => s.engage(ctx),
];

/** A unit's kit: its staves (with each one's reach chance against the spread), potions, Dance and Rally. */
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
    s.chooseStances();
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
  const spots: BlindSpotId[] = [...BLIND_SPOTS];
  if (s.kits.some((k) => k.rally)) spots.push('rally-reaches-every-pair');
  if (s.splitAny) spots.push('attack-stance-adjacency');
  return {
    map: input.map.id,
    noDeath: s.noDeath,
    turns: s.turn,
    ended: s.ended ?? 'stalled',
    units,
    groups: s.groups.map((g, i) => ({ key: g.key, name: g.foe.name, className: g.foe.className, count: s.spawned[i]!, felled: s.felled[i]! })),
    log: s.log,
    skills: s.skills,
    blindSpots: spots,
  };
}

/** The mean no-death chance over `runs` plays, each with its own seed from `seed` (Lunatic+ skills drawn anew). */
export function meanNoDeath(input: MapPlayInput, seeds: readonly number[]): number {
  if (!seeds.length) return 1;
  return seeds.reduce((a, sd) => a + playMap(input, sd).noDeath, 0) / seeds.length;
}
