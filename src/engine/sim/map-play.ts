/**
 * The map simulation (#181; spec #175, The map simulation and Noise): one map played turn by turn, player phase then
 * enemy phase, until a rout or the boss's defeat. The play is deterministic given the army's stats and the lineup;
 * its **no-death chance** is exact: the product of the lead's survival in every exchange the play creates, each worked
 * out from the map solver's combat math (`exchange`). Seeded draws only settle what the chapter data leaves open
 * (Lunatic+ skills today); later tickets sample what changes the route between maps.
 *
 * The turn loop, and where later tickets plug in:
 * - Start of turn: `startTurn` (last turn's Rally and Rescues wear off; HP carries over from the turn before), then
 *   arrivals (`clearArrivals`, `arrivalsAt('turn-start')`). Foes that leave on their own go; mid-map arrivals (#184)
 *   are on the field from their turn, with no action before it.
 * - Stances (#183, `chooseStances`): each pair picks how it plays the turn: together (either unit in front), or apart
 *   (each unit its own front with its own action; adjacent, in Attack Stance, at the rate the army spread allows).
 *   Pair Up and Separate cost the action the game charges; Switch is free. The turn's **fronts** follow from it.
 * - `playerPhase`: each front not spent has one action, an equal share (a stated blind spot); a Dance gives one more.
 *   `chooseAction` picks the next action by the policy's tiers (`POLICY`) and `apply` plays it. Actions are a union:
 *   #182 added sustain (a heal, Fortify, Rescue, a potion), Dance and Rally (`sustain.ts`); #183 added the bait (a
 *   front waits in reach); the EXP priority (#195, `MapPlayInput.priority`) only reorders the fighting tiers: who lands
 *   kills, a lower unit chipping or waiting for a higher one, never an extra action. Talks
 *   (#184) come first: a talker spends its action on the turn the solve sends it, and the recruit joins. Then the side
 *   goals chased (#191, `MapPlayInput.chase`): each costs actions by a turn, and the play reports whether it was met.
 * - `allyPhase` (#184): the third party (an NPC the army must keep alive, a recruit before it joins) acts between player
 *   and enemy phase. Its deaths count; its kills aren't played. Other NPCs are scenery and aren't played at all.
 * - **Exposure** is the player's choice (#183): a front that attacks, or baits, is in reach on enemy phase; one that
 *   holds back isn't. A careful player only exposes a front that very likely lives through it (`EXPOSURE_RISK`), and
 *   when nothing is that safe, engages once a turn with the least risk: the sturdiest front baits, or the safest attack.
 *   A front already in reach is weighed at its HP now (a Dance's second attack risks the survival it loses). A front
 *   that would live through the enemy phase in reach and counter waits there as bait (the realism pass); a bait moves
 *   the map on, so the rest stay out of reach. Damage on the target boss is part of the victory, and with
 *   reinforcements that never stop the boss is open from the start.
 * - HP is carried: damage stays until an action buys it back. A staff reaches a pair with the chance the assumed army
 *   spread gives (`MapPlayInput.spread`), and heals its expected HP.
 * - `enemyPhase`: arrivals free to act (Hard and up), then each exposed front takes one attack from the worst foe left
 *   for it (one worst attacker per pair, a stated blind spot), each foe attacking once. A blind spot's bad case
 *   (`stress`, #211) plays two attackers per front, or no Rally.
 * - Tallies per unit (combats, kills per foe group, combats paired with each partner) feed EXP (#186, #195) and
 *   supports (#188); the per-turn log (fights, acts, stances, exposed fronts) feeds the Why panel and the stance plan.
 *
 * Each exchange plays out at its likely result given the lead survives: its expected HP after, and the foe falls when
 * that's more likely than not (else keeps its expected HP). The no-death chance is conditioned the same way: the
 * product runs along the play in which nobody has died yet.
 */
import type { GameItem } from '../../game-data/items';
import { bestWeapon, matchup, type Fighter, type Foe, type Matchup, type SupportLevel } from '../solver';
import { exchange, leadHpAfter, type Exchange, type Initiator } from './exchange';
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
  /** Leaves the map on its own at the start of this turn, unfelled (Death's Embrace's Algol, #184). */
  readonly leaves?: number;
  /**
   * When it begins moving on its own (the chapter data's AI notes; the second realism pass): the turn it does, Infinity
   * when only a unit coming to it sets it off (it holds, attacking nobody, until a front attacks it). Absent: from the
   * start. A foe that doesn't move yet is no threat on enemy phase: a careful player draws such foes out one at a time.
   */
  readonly moves?: number;
};

/**
 * A third-party unit whose death is a failure though it never joins (#184): Chapter 6's Emmeryn. It stands where the
 * chapter puts it: an NPC with no weapon is out of the foes' reach while the army holds them off (a stated blind spot),
 * and in it on a turn the army moves nothing.
 */
export type SimAlly = { readonly unit: SimUnit };

/**
 * A recruit on the map (#184): a mid-map arrival, on the field from its turn; a talk recruit, joining on the turn the
 * solve sends a talker (`MapPlayInput.talks`, the first turn by default) and acting from the next; or an NPC who joins
 * at the end if it survives. Until it joins, a talk recruit is an NPC (on the third party's side, its death a failure)
 * or a foe (`foe`: never attacked, not needed for a rout, and gone from the enemy side once it joins). With no talker in
 * the lineup it's never recruited: an NPC is scenery, a foe is a foe like any other.
 */
export type SimRecruit = {
  /** The roster's id, the one the lineup uses. */
  readonly id: string;
  /** The unit as it joins (its fighter and weapons); absent, the recruit happens but isn't played as a unit. */
  readonly unit?: SimUnit;
  /** On the field from this turn (acting that turn), a mid-map arrival; an NPC until then when `npc`. */
  readonly arrives?: number;
  /** A talk: the units that can talk to it (itself, when it's the one who talks), and how many talks it takes. */
  readonly talk?: { readonly by: readonly string[]; readonly times: number };
  /** An NPC until it joins (or, with no talk and no arrival turn, the whole map: it joins at the end if it survives). */
  readonly npc?: boolean;
  /** A foe until it joins: its foe group's key. */
  readonly foe?: string;
  /** A foe that leaves the map once talked to, joining nobody (The Future Past's masked boss). */
  readonly departs?: boolean;
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
  /** Third-party units the army must keep alive (#184). */
  readonly allies?: readonly SimAlly[];
  /** Units who join during the map (#184). */
  readonly recruits?: readonly SimRecruit[];
  /** What the map's own rules add that the play doesn't model (Chapter 3's door keys). */
  readonly blindSpots?: readonly BlindSpotId[];
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
  /** The turn the solve sends a talker to each talk recruit, by the recruit's id (#184); the first turn by default. */
  readonly talks?: Readonly<Record<string, number>>;
  /**
   * Pairs whose support growth matters (by unit id, either order): a couple the plan still has to marry (#188). Such a
   * pair stays together while together it has safe work (combats together are what supports grow from), and splits
   * only when together it has none and apart it has; Pair Up brings it back once together is safe again.
   */
  readonly bonds?: readonly (readonly [string, string])[];
  /**
   * The side goals the plan chases on this map (#191), each as the actions it costs (a Thief killed, a village visited,
   * a chest opened, a villager guarded) by a turn. Those actions come first, after the talks.
   */
  readonly chase?: readonly SimChase[];
  /**
   * Units that fight but take none of their sustain, Dance, Rally or Rescue actions for others (no staff, no Dance, no
   * Rally; a potion on itself is its own fighting), by id: a unit's utility (#202) is the flawless chance lost this way.
   */
  readonly idle?: readonly string[];
  /**
   * Each unit's EXP priority on this map (#195), by unit id; absent: normal. It decides who lands kills, never how many
   * actions anyone gets: a unit doesn't take a kill a higher unit still to act could take (it chips another foe, or
   * waits), and a lower unit chips first, into a higher unit's kill range. The foes left alive cost turns.
   */
  readonly priority?: Readonly<Partial<Record<string, ExpPriority>>>;
  /**
   * Stop the play once its no-death chance falls below this (the run simulation's: a run whose chance of having lost
   * nobody is that small counts as lost, #186), ending `lost`. Absent: play the map out.
   */
  readonly stopBelow?: number;
  /** A stated blind spot's bad case (#211, the stress test), played instead of the model's reading. Absent: the model's. */
  readonly stress?: StressCase;
};

/**
 * The bad case of a stated blind spot that can be stressed (#211): `two-attackers` (one worst attacker per pair), each
 * exposed front takes up to two attacks on enemy phase, from the two foes worst for it, each foe still attacking once;
 * `no-rally` (Rally reaches every pair), a Rally reaches no pair, so its holder never rallies and acts otherwise.
 */
export type StressCase = 'two-attackers' | 'no-rally';

/** Who lands kills (#195): a lower unit chips or waits for a higher one; normal by default. */
export type ExpPriority = 'high' | 'normal' | 'low';
const RANK: Readonly<Record<ExpPriority, number>> = { low: 0, normal: 1, high: 2 };

/**
 * A side goal's cost in the play (#191): `actions` actions spent by the end of turn `by`'s player phase, paced from the
 * first turn (ceil(actions / by) a turn, so a map won early rarely leaves one owed), each by a front with its action
 * left, the last in the lineup first. The chaser isn't put in the foes' reach for it: the play has no map positions (a
 * stated blind spot). A map won with actions still owed misses it.
 */
export type SimChase = { readonly id: string; readonly actions: number; readonly by: number };

/**
 * An action other than an attack (#182): a heal (one pair, or every pair in reach with Fortify), a Rescue out of
 * enemy phase, a potion on the unit's own lead (its own, or traded over, `from`), a Dance (the target acts again) or a Rally (every other pair's stats
 * up for the turn); a bait (#183): the front waits in the foes' reach, to take their attack and counter; a talk
 * (#184) to a recruit (`target`), which spends the talker's action; and a side goal's action (#191, `target` its id).
 */
export type SimAct = {
  readonly kind: 'heal' | 'rescue' | 'item' | 'dance' | 'rally' | 'bait' | 'talk' | 'chase';
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
  /** A potion traded over from another unit (a trade costs no action): the unit it came from. */
  readonly from?: string;
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
  /** Whether the front's strikes hurt the foe (the likely result): a kill, or damage it lived through. */
  readonly dealt: boolean;
  /** The foe's engagements so far, this one included: the Lunatic EXP cut reads it (#195). */
  readonly engagement: number;
  /** Paired: the chance the back lands a Dual Strike in the exchange (its half damage EXP, #195). */
  readonly dualStrike?: number;
  /** Lunatic+: the foe's two drawn skills (each foe draws its own). */
  readonly drawn?: readonly string[];
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
  /** Units joining the army this turn (#184): mid-map arrivals, and talk recruits (acting from the next turn). */
  readonly joins: readonly string[];
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
  /**
   * How it ended: a rout, the boss's defeat, out of turns with foes left, or stopped once the chance of nobody dying fell
   * below `MapPlayInput.stopBelow` (`lost`: a run has lost a unit there, and the rest of the map can't change that).
   */
  readonly ended: 'rout' | 'boss' | 'stalled' | 'lost';
  readonly units: Readonly<Record<string, SimUnitTally>>;
  readonly groups: readonly { readonly key: string; readonly name: string; readonly className: string; readonly count: number; readonly felled: number }[];
  readonly log: readonly SimTurn[];
  /** The Lunatic+ skills drawn for each foe group without recorded skills, over its foes (each draws its own two: `SimFight.drawn`). */
  readonly skills: Readonly<Record<string, readonly string[]>>;
  /** The stated blind spots this number rests on. */
  readonly blindSpots: readonly BlindSpotId[];
  /** Each chased side goal (`MapPlayInput.chase`, #191): whether all its actions were spent by its turn. Absent with no chase. */
  readonly chased?: Readonly<Record<string, boolean>>;
};

/** A map that runs this long without victory is stalled: the army can't finish it. */
export const MAX_TURNS = 50;
/**
 * The most death risk a careful player takes to put a front in the foes' reach for one turn (#183): an attack's own
 * risk and the enemy phase after it. Riskier engagements wait, unless nothing safer moves the map on that turn.
 */
export const EXPOSURE_RISK = 0.01;
/** The most foes that come at one wall on an enemy phase: the four tiles next to it (see `drawToWalls`). */
export const WALL_REACH = 4;
const LUNATIC_PLUS_DRAWS = 2;
const BLIND_SPOTS: readonly BlindSpotId[] = ['one-worst-attacker', 'held-back-out-of-reach', 'equal-share-of-actions', 'likely-result', 'bosses-hold', 'skills-in-combat'];
/** A heal's small worth beyond the danger it lifts: HP topped up now is HP in hand for the turns to come. */
const TOP_UP = 0.01;
/** Choices this close count as equal (a stance change needs a real difference). */
const EPS = 1e-9;

/** A foe on the field: its group, HP, engagements so far (`n`), and whether it moves yet (see `SimFoeGroup.moves`). */
type FoeInstance = { readonly g: number; hp: number; n?: number; awake?: boolean; bound?: number };

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
  | { readonly kind: 'item'; readonly group: number; readonly item: number; readonly holder: number; readonly hp: number; readonly value: number }
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

/** A unit alone, made once per unit so its combats are cached like any lineup group's (the third party, recruits). */
const SOLO = new WeakMap<SimUnit, SimGroup>();

function soloOf(u: SimUnit): SimGroup {
  let g = SOLO.get(u);
  if (!g) SOLO.set(u, (g = { lead: u, support: null }));
  return g;
}

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
type Combat = { readonly m: Matchup; readonly weapon: GameItem | undefined; readonly exchanges: Map<number, Exchange>; dists?: Map<number, Map<number, number>> };

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
  /** The turn it's on the field from (#184): 1 for the lineup, a mid-map arrival's turn; a foe recruit once it joins. */
  from: number;
  /** An NPC before this turn (#184): on the third party's side, acting in the ally phase (Infinity: until it joins, or all map). */
  npcUntil: number;
  /** Joined the army this map (a talk recruit): no longer the third party's. */
  joined?: boolean;
};

/** A talk recruit's talks still to come (#184): who can talk, how many talks are left, and what it is until it joins. */
type Talk = {
  readonly id: string;
  /** Unit indices that can talk to it; empty when it talks itself. */
  readonly by: readonly number[];
  left: number;
  /** The first turn the solve sends a talker. */
  readonly at: number;
  /** Its unit's pair, when it's played. */
  readonly pair?: Pair;
  /** Its foe group while it's a foe. */
  readonly group?: number;
  /** It leaves the map once talked to, joining nobody. */
  readonly departs?: boolean;
  done: boolean;
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
  /** The fronts whose Rally was weighed this turn (see `bestRally`). */
  private rallyWeighed = new Set<number>();
  /** This enemy phase, by front: its HP before the first attack on it, and each attacker's group and HP (see `drawToWalls`). */
  private readonly phaseSurvival = new Map<number, { readonly start: number; readonly hits: { readonly g: number; readonly hp: number }[] }>();
  /** Whether a wall drew more than one foe this map (the `walls-draw-foes` blind spot applies). */
  walled = false;
  /** Whether a potion was traded over this map (the `potions-traded` blind spot applies). */
  traded = false;
  /** Whether a heal or potion restored HP this turn: the army is recovering, and needn't engage (see `engage`). */
  private recovered = false;
  /** This turn, the front kept out of the fighting to press the boss (see `keepPresser`); -1 none, undefined not decided. */
  private reserved: number | undefined;
  /** Foes on the field at the start of the first turn, and whether this turn starts with as many or more (`pressing`). */
  private fieldBefore = Infinity;
  private filling = false;
  /** The least risk of an attack on the boss seen on earlier turns, and this turn (see `pressBoss`). */
  private pressSeen = Infinity;
  private pressSeenNow = Infinity;
  private pressWeighed = false;
  /** Whether the target boss was attacked on this turn's player phase (see `pressBoss`). */
  bossHit = false;
  /** Whether any pair stood apart (the Attack Stance blind spot applies). */
  splitAny = false;
  /** Each unit's staves, potions, Dance and Rally, and the uses left of each item (by [unit][item]). */
  readonly kits: Kit[];
  readonly uses: number[][];
  readonly pairs: Pair[] = [];
  private readonly actors: Actor[] = [];
  /** Bonded pairs (`MapPlayInput.bonds`), as `lead|back` both ways. */
  private readonly bonds = new Set<string>();
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
  /** Foes on the field by group that move already (see `SimFoeGroup.moves`): the ones that can attack on enemy phase. */
  private readonly awakeLeft: number[] = [];
  /**
   * This turn: each foe group's attacks already spoken for by the fronts in reach, as those fronts' survival against it
   * (each foe attacks once, the pairings a front is least likely to survive first), and the arrivals at enemy phase by
   * group.
   */
  private readonly claimed: number[][] = [];
  /** Who holds each claim in `claimed` (the front's actor id, parallel to it): a front never counts its own. */
  private readonly claimers: number[][] = [];
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
  /** Each group's first group of its kind (itself, or the group a Lunatic+ copy was made from; see `instanceGroup`). */
  private readonly baseOf: number[] = [];
  private readonly waveGroup = new Map<SimFoeGroup, number>();
  /** The foe groups on the field from the start (the boss opens once they're gone, unless the solve picks a turn). */
  private readonly starting = new Set<number>();
  private clearQueue: SimWave[];
  /** The next of the unlimited reinforcements' kinds to join (their groups in turn). */
  private endlessNext = 0;
  /** The map has reinforcements that never stop. */
  private readonly endless: boolean;
  /** Talk recruits' talks (#184), the foe groups that are recruits still to talk to, and the arrivals by turn. */
  private readonly talks: Talk[] = [];
  private readonly pending = new Set<number>();
  private readonly arriving: [Pair, string, number][] = [];
  /** This turn: the fronts that are NPCs (they act in the ally phase), and the units joining the army. */
  private npcFronts = new Set<number>();
  /** The units that are NPCs this turn: an NPC can't keep out of reach the way the army's units do. */
  private npcUnits = new Set<number>();
  /** Whether an NPC stood on the field this map (the ally-phase blind spots apply), and one with no weapon. */
  npcAny = false;
  npcUnarmed = false;
  talked = false;
  joins: string[] = [];
  /** The side goals chased (#191), with the actions spent on each so far. */
  readonly chases: { readonly c: SimChase; spent: number }[];
  /** Each unit's EXP priority (#195) as a rank (low 0, normal 1, high 2), and whether the lineup's ranks differ at all. */
  private readonly ranks: number[] = [];
  private ranked = false;

  constructor(
    readonly input: MapPlayInput,
    readonly rng: Rng,
  ) {
    this.adjacency = input.spread ? reachChance(1, input.spread) : 1;
    for (const [a, b] of input.bonds ?? []) this.bonds.add(`${a}|${b}`).add(`${b}|${a}`);
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
        this.pairs.push({ lead, alone: actor(pi, lead, g), stance: { kind: 'together', front: 0 }, from: 1, npcUntil: 1 });
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
        from: 1,
        npcUntil: 1,
      });
    });
    // The third party and the recruits (#184): each a unit alone, on the field from its turn, an NPC until it joins.
    const alone = (u: SimUnit, from: number, npcUntil: number): Pair => {
      const i = unitIndex(u);
      const p: Pair = { lead: i, alone: actor(this.pairs.length, i, soloOf(u)), stance: { kind: 'together', front: 0 }, from, npcUntil };
      this.pairs.push(p);
      return p;
    };
    for (const a of input.map.allies ?? []) alone(a.unit, 1, Infinity);
    for (const g of input.map.foes) {
      const i = this.groupIndex(g);
      this.starting.add(i);
      this.spawn(i, g.foe.count);
    }
    const lineupIds = new Map(this.units.map((u, i) => [u.id, i]));
    for (const r of input.map.recruits ?? []) {
      const foeGroup = r.foe !== undefined ? input.map.foes.find((g) => g.key === r.foe) : undefined;
      const group = foeGroup ? this.waveGroup.get(foeGroup)! : -1;
      if (r.talk) {
        const self = r.talk.by.includes(r.id);
        const by = r.talk.by.flatMap((t) => (lineupIds.has(t) ? [lineupIds.get(t)!] : []));
        // No one to talk to it: never recruited (an NPC is scenery, a foe stays a foe).
        if (!self && !by.length) continue;
        const pair = r.unit ? (group >= 0 ? alone(r.unit, Infinity, 1) : alone(r.unit, 1, Infinity)) : undefined;
        if (group >= 0) this.pending.add(group);
        this.talks.push({ id: r.id, by: self ? [] : by, left: Math.max(1, r.talk.times), at: input.talks?.[r.id] ?? 1, ...(pair ? { pair } : {}), ...(group >= 0 ? { group } : {}), ...(r.departs ? { departs: true } : {}), done: false });
      } else if (r.unit && r.arrives !== undefined) {
        const p = alone(r.unit, r.npc ? 1 : r.arrives, r.npc ? r.arrives : 1);
        this.arriving.push([p, r.id, r.arrives]);
      } else if (r.unit && r.npc) alone(r.unit, 1, Infinity);
    }
    const idle = new Set(input.idle ?? []);
    // Under the Rally stress (#211) a Rally reaches nobody: no one rallies.
    const noRally = input.stress === 'no-rally';
    this.kits = this.units.map((u) =>
      idle.has(u.id) ? { ...kitOf(u, input.spread), staves: [], dances: false, rally: undefined } : noRally ? { ...kitOf(u, input.spread), rally: undefined } : kitOf(u, input.spread),
    );
    if (input.priority) {
      for (const u of this.units) this.ranks.push(RANK[input.priority[u.id] ?? 'normal']);
      this.ranked = this.ranks.some((r) => r !== this.ranks[0]);
    }
    this.uses = this.units.map((u) => (u.items ?? []).map((i) => i.uses));
    this.clearQueue = input.map.waves.filter((w) => w.onClear);
    this.endless = input.map.waves.some((w) => w.everyTurnFrom !== undefined && w.groups.length > 0);
    this.chases = (input.chase ?? []).map((c) => ({ c, spent: 0 }));
  }

  /** The side goals' actions due this turn (#191, see `SimChase`), after the talks. */
  private chase(acted: Set<number>) {
    for (const ch of this.chases) {
      const { id, actions, by } = ch.c;
      if (this.turn > by) continue;
      let due = Math.min(actions, Math.ceil(actions / Math.max(1, by)) * this.turn) - ch.spent;
      for (let gi = this.front.length - 1; gi >= 0 && due > 0; gi--) {
        if (acted.has(gi) || this.npcFronts.has(gi)) continue;
        acted.add(gi);
        ch.spent++;
        due--;
        // The army moved something on: a turn spent chasing isn't a stall.
        this.progress = true;
        this.acts.push({ kind: 'chase', unit: this.units[this.front[gi]!.unit]!.id, target: id });
      }
    }
  }

  /** A foe group's index, its Lunatic+ skills drawn the first time it's seen. */
  private groupIndex(g: SimFoeGroup): number {
    const known = this.waveGroup.get(g);
    if (known !== undefined) return known;
    const i = this.addGroup(g, this.draw(g));
    this.waveGroup.set(g, i);
    return i;
  }

  /** Each foe group's count and felled, a group's Lunatic+ copies (see `instanceGroup`) counted with it. */
  groupTotals(): MapPlay['groups'] {
    const out = new Map<string, { key: string; name: string; className: string; count: number; felled: number }>();
    this.groups.forEach((g, i) => {
      const t = out.get(g.key);
      if (t) {
        t.count += this.spawned[i]!;
        t.felled += this.felled[i]!;
      } else out.set(g.key, { key: g.key, name: g.foe.name, className: g.foe.className, count: this.spawned[i]!, felled: this.felled[i]! });
    });
    return [...out.values()];
  }

  /** A foe's Lunatic+ skills: two from its group's pool, less the skills it has (none without a pool). */
  private draw(g: SimFoeGroup): readonly string[] {
    return g.pool?.length ? this.rng.sample(g.pool.filter((s) => !g.foe.skills.includes(s)), LUNATIC_PLUS_DRAWS) : [];
  }

  private addGroup(g: SimFoeGroup, drawn: readonly string[], base?: number): number {
    if (g.pool?.length) this.skills[g.key] = [...new Set([...(this.skills[g.key] ?? []), ...drawn])];
    this.groups.push(g);
    this.drawn.push(drawn);
    this.baseOf.push(base ?? this.groups.length - 1);
    this.spawned.push(0);
    this.felled.push(0);
    this.left.push(0);
    this.awakeLeft.push(0);
    this.claimed.push([]);
    this.claimers.push([]);
    const i = this.groups.length - 1;
    if (base !== undefined && this.starting.has(base)) this.starting.add(i);
    return i;
  }

  /**
   * The group a new foe of group `g` joins (the second realism pass): on Lunatic+ each foe draws its own two skills
   * (FEW Difficulty: every enemy gains two), so a foe whose draw differs from its group's first joins a copy of the
   * group with that draw (same key: its fights, kills and EXP read as the group's). The group's first foe keeps the
   * draw made when the group was first seen.
   */
  private instanceGroup(g: number): number {
    const grp = this.groups[g]!;
    if (!grp.pool?.length || !this.spawned[g]) return g;
    const drawn = this.draw(grp);
    const k = [...drawn].sort().join(',');
    for (let i = 0; i < this.groups.length; i++) if (this.baseOf[i] === g && [...this.drawn[i]!].sort().join(',') === k) return i;
    return this.addGroup(grp, drawn, g);
  }

  private spawn(g: number, count: number) {
    for (let i = 0; i < count; i++) {
      const at = this.instanceGroup(g);
      const awake = this.turn >= (this.groups[at]!.moves ?? 1);
      this.foes.push({ g: at, hp: this.groups[at]!.foe.stats.hp, awake });
      this.spawned[at]!++;
      this.left[at]!++;
      if (awake) this.awakeLeft[at]!++;
    }
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
    let endless = this.endlessNext;
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
        for (let i = 0; i < (w.perTurn ?? w.groups.length); i++) this.arrive(w.groups[this.endlessNext++ % w.groups.length]!, 1);
      }
    }
  }

  /** The start of a turn: last turn's Rally and Rescues wear off. HP carries over: only actions buy it back (#182). */
  startTurn() {
    for (const f of this.foes) {
      delete f.bound;
      if (!f.awake && this.turn >= (this.groups[f.g]!.moves ?? 1)) this.wake(f);
    }
    this.bossHit = false;
    this.recovered = false;
    this.phaseSurvival.clear();
    this.safe.clear();
    this.exposed.clear();
    this.dropSurvival();
    for (const c of this.claimed) c.length = 0;
    for (const c of this.claimers) c.length = 0;
    if (this.bonus.some((b) => b)) this.dropRallied();
    this.leave();
    for (const [, id, t] of this.arriving) if (t === this.turn && t > 1) this.joins.push(id);
  }

  /** Foes that leave the map on their own this turn go, unfelled (#184). */
  private leave() {
    for (let g = 0; g < this.groups.length; g++) {
      const at = this.groups[g]!.leaves;
      if (at === undefined || at > this.turn || !this.left[g]) continue;
      this.removeGroup(g);
    }
  }

  /** Takes every foe of group `g` off the field, unfelled: it left, or joined the army. */
  /** Whether foe `f`, alive, can attack front `gi` this enemy phase: not one bound to another front's provocation. */
  private canAttack(f: FoeInstance, gi: number): boolean {
    return f.hp > 0 && (f.bound === undefined || f.bound === this.front[gi]!.id);
  }

  /** A foe that didn't move yet does from now on: its turn came (see `SimFoeGroup.moves`). */
  private wake(f: FoeInstance) {
    f.awake = true;
    this.awakeLeft[f.g]!++;
    this.foeVersion++;
  }

  /**
   * A foe that didn't move yet, attacked, moves from now on; this enemy phase it attacks only the front that set it
   * off (it stood in that front's reach, not the others'). The rest of its group waits.
   */
  private provoke(f: FoeInstance, by: number) {
    this.wake(f);
    f.bound = by;
  }

  private removeGroup(g: number) {
    for (let i = this.foes.length - 1; i >= 0; i--) if (this.foes[i]!.g === g) this.foes.splice(i, 1);
    this.left[g] = 0;
    this.awakeLeft[g] = 0;
    this.foeVersion++;
    this.progress = true;
  }

  /**
   * The talks this turn (#184), before anyone else acts: from the turn the solve sends a talker, the first talker on the
   * field with its action left spends it; the recruit joins once its talks are done, acting from the next turn. A foe
   * recruit felled before then never joins.
   */
  private talk(acted: Set<number>) {
    for (const t of this.talks) {
      if (t.done || this.turn < t.at) continue;
      if (t.group !== undefined && !this.left[t.group]) {
        t.done = true;
        this.pending.delete(t.group);
        continue;
      }
      if (t.by.length) {
        let who: number | undefined;
        const gi = this.front.findIndex((a, i) => {
          if (acted.has(i) || this.npcFronts.has(i)) return false;
          who = t.by.find((u) => u === a.unit || u === a.back);
          return who !== undefined;
        });
        if (gi < 0) continue;
        acted.add(gi);
        this.acts.push({ kind: 'talk', unit: this.units[who!]!.id, target: t.id });
      }
      this.talked = true;
      if (--t.left <= 0) this.recruit(t);
    }
  }

  /** The units with a talk to make this turn: for each talk due, the first who can talk that's on the army's field. */
  private dueTalkers(): Set<number> {
    const out = new Set<number>();
    for (const t of this.talks) {
      if (t.done || this.turn < t.at || !t.by.length || (t.group !== undefined && !this.left[t.group])) continue;
      const u = t.by.find((b) => this.pairs.some((p) => (p.lead === b || p.back === b) && this.turn >= p.from && (p.joined || this.turn >= p.npcUntil)));
      if (u !== undefined) out.add(u);
    }
    return out;
  }

  /** A talk recruit joins: off the enemy side, out of the third party's, acting from the next turn. */
  private recruit(t: Talk) {
    t.done = true;
    if (t.group !== undefined) {
      this.pending.delete(t.group);
      this.removeGroup(t.group);
    }
    if (t.pair) {
      t.pair.joined = true;
      t.pair.npcUntil = this.turn + 1;
      if (t.pair.from === Infinity) t.pair.from = this.turn + 1;
    }
    if (!t.departs) this.joins.push(t.id);
    this.progress = true;
  }

  /**
   * The ally phase (#184), between player and enemy phase: each NPC with a weapon moves on the foes as its AI does, into
   * their reach. Its own attacks aren't played (a stated blind spot); an NPC with none stays where the chapter puts it.
   */
  allyPhase() {
    for (const gi of this.npcFronts) {
      const a = this.front[gi]!;
      if (!this.pairs[a.pair]!.joined && this.unitArmed(a.unit)) this.expose(gi);
    }
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
    return this.unitArmed(a.unit) || (a.back !== undefined && this.unitArmed(a.back)) || this.npcUnits.has(a.unit);
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
    const engagement = (f.n = (f.n ?? 0) + 1);
    const dealt = ex.survive > 0 && ex.foeHp < f.hp;
    const dualStrike = back && ex.leadStrikes ? this.dualStrikeChance(gi, f) : 0;
    this.noDeath *= ex.survive;
    this.foeVersion++;
    if (ex.survive > 0) {
      this.hp[a.unit] = ex.leadHp;
      if (ex.foeHp < f.hp) this.progress = true;
      f.hp = ex.foeHp;
    }
    const kill = f.hp <= 0;
    if (phase === 'player' && this.groups[f.g]!.target) this.bossHit = true;
    if (!f.awake) this.provoke(f, a.id);
    if (kill) {
      this.foes.splice(this.foes.indexOf(f), 1);
      this.left[f.g]!--;
      if (f.awake) this.awakeLeft[f.g]!--;
    }
    // A front in reach already that fights again (a Dance) faces the enemy phase at its new HP: its claim moves.
    if (phase === 'player') {
      if (this.exposed.has(gi)) this.reclaim(gi);
      else this.expose(gi);
    }
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
    this.fights.push({ phase, lead: lead.id, ...(back ? { back: back.id } : {}), foe: key, survive: ex.survive, kill, dealt, engagement, ...(dualStrike > 0 ? { dualStrike } : {}), ...(this.drawn[f.g]!.length ? { drawn: this.drawn[f.g]! } : {}) });
  }

  /**
   * The chance a paired back lands at least one Dual Strike in front `gi`'s exchange with foe `f` (#195): each of the
   * lead's strikes rolls one, at the matchup's Dual Strike rate and the back's hit; 0 when the back can't hurt the foe.
   */
  private dualStrikeChance(gi: number, f: FoeInstance): number {
    const a = this.front[gi]!;
    const bonus = this.bonus[gi];
    const { m } = this.combatWith(bonus ? ralliedGroup(a.grp, bonus) : a.grp, a.rows, bonus ? 1 : 0, f);
    if (m.backDamage <= 0) return 0;
    const p = (m.dualStrikeRate / 100) * (m.backHit / 100);
    return 1 - (1 - p) ** Math.max(1, m.hits);
  }

  /**
   * Puts front `gi` in the foes' reach for this enemy phase: the foe it would face is spoken for, so the next front
   * exposed reckons with the foes left (each foe attacks once).
   */
  private expose(gi: number) {
    if (this.exposed.has(gi)) return;
    this.exposed.add(gi);
    this.claim(gi);
  }

  /** Speaks for the foe front `gi` would face on enemy phase at its HP now (see `expose`). */
  private claim(gi: number) {
    const a = this.front[gi]!;
    if (!this.reachable(a) || this.safe.has(gi)) return;
    let worst: { g: number; s: number } | undefined;
    this.refreshThreats();
    for (const f of this.threatList) {
      if (f.bound !== undefined && f.bound !== a.id) continue;
      const s = this.exchangeOf(gi, f, 'enemy').survive;
      if (this.free(f.g, s, -1, a.id) && (!worst || s < worst.s)) worst = { g: f.g, s };
    }
    if (worst) {
      this.claimed[worst.g]!.push(worst.s);
      this.claimers[worst.g]!.push(a.id);
      this.dropSurvival([worst.g]);
    }
  }

  /**
   * A front in reach whose HP moved (it fought again, or was healed): the foe it would face is worked out again at its
   * HP now, so the fronts after it reckon with the claim as it stands.
   */
  private reclaim(gi: number) {
    const id = this.front[gi]!.id;
    for (let g = 0; g < this.claimers.length; g++) {
      const k = this.claimers[g]!.indexOf(id);
      if (k < 0) continue;
      this.claimers[g]!.splice(k, 1);
      this.claimed[g]!.splice(k, 1);
      // A foe freed can lower any survival, not only those it set.
      this.dropSurvival();
    }
    this.claim(gi);
  }

  /**
   * Whether a foe of group `g` is left to attack a front that survives it with `s` (one of group `without` about to
   * fall): the enemy phase pairs off the least survivable pairings first, so fronts that fare worse against it come first.
   */
  private free(g: number, s: number, without: number, self: number): boolean {
    let before = g === without ? 1 : 0;
    const claims = this.claimed[g]!;
    const by = this.claimers[g]!;
    // A front already in reach doesn't stand in its own way: the foe it spoke for is still the one it faces.
    for (let k = 0; k < claims.length; k++) if (claims[k]! <= s && by[k] !== self) before++;
    return before < this.awakeLeft[g]! + (this.incomingCount.get(g) ?? 0);
  }

  /**
   * Whether the target boss can be fought now: from the turn the solve picks, from the start when reinforcements never
   * stop (Endgame's), or once the foes the map starts with are gone.
   */
  private bossOpen(): boolean {
    if (this.input.bossTurn !== undefined) return this.turn >= this.input.bossTurn;
    // Reinforcements that never stop (Endgame's) make every turn spent on the rest a turn more in reach: a careful
    // player goes for the boss from the start (the realism pass).
    if (this.endless) return true;
    return this.foes.every((f) => this.groups[f.g]!.target || !this.starting.has(f.g) || this.pending.has(f.g));
  }

  /** The policy's context for one choice. */
  private context(acted: ReadonlySet<number>, memo: Map<number, Attack | null>): PolicyContext {
    this.refreshThreats();
    return { acted, memo, open: this.bossOpen(), threats: this.threatList, worn: this.worn(), sustain: new Map(), survival: this.survCache, relief: new Map() };
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
    const now = new Map(list.map((f) => [f.g, { hp: f.hp, left: this.awakeLeft[f.g]! }] as const));
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
   * - A bonded pair (`MapPlayInput.bonds`: a couple still to marry) stays together while together has safe work, its
   *   support growing from each combat; a unit with a talk due (#184) keeps its action, in front.
   * The game's costs: Separate spends the front's action (its back, dropped beside it, still acts); Pair Up spends the
   * mover's (the other acts, paired); Switch is free, once a turn, before the pair moves (it loses the move left).
   */
  chooseStances() {
    const joining = this.joining('enemy-phase').map(([g, n]) => [this.groupIndex(g), n] as const);
    this.foeVersion++;
    this.incoming = joining.map(([g]) => ({ g, hp: this.groups[g]!.foe.stats.hp, awake: true }));
    this.incomingCount = new Map();
    for (const [g, n] of joining) this.incomingCount.set(g, (this.incomingCount.get(g) ?? 0) + n);
    const ctx = this.context(new Set(), new Map());
    this.stances = [];
    this.front = [];
    this.spent = new Set();
    this.npcFronts = new Set();
    this.npcUnits = new Set();
    const talkers = this.dueTalkers();
    const healers: [number, number][] = [];
    for (const q of this.pairs) {
      if (this.turn < q.from || (!q.joined && this.turn < q.npcUntil)) continue;
      for (const u of q.back === undefined ? [q.lead] : [q.lead, q.back]) {
        for (const s of this.kits[u]!.staves) if (s.effect.kind !== 'rescue' && this.uses[u]![s.item]! > 0) healers.push([u, s.reach * Math.min(s.effect.amount, 999)]);
      }
    }
    for (const p of this.pairs) {
      // Not on the field yet (a mid-map arrival before its turn, a foe recruit before it joins): no action, out of reach.
      if (this.turn < p.from) continue;
      if (p.alone) {
        if (!p.joined && this.turn < p.npcUntil) {
          this.npcFronts.add(this.front.length);
          this.npcUnits.add(p.lead);
          this.npcAny = true;
          if (!this.unitArmed(p.lead)) this.npcUnarmed = true;
        }
        this.front.push(p.alone);
        continue;
      }
      const was = p.stance;
      // The most a healer of the army's (another pair's unit) can restore to this pair's front this turn, expected.
      let heal = 0;
      for (const [u, h] of healers) if (u !== p.lead && u !== p.back) heal = Math.max(heal, h);
      const units = [p.lead, p.back!] as const;
      // The safe work each way: apart, each unit with a safe attack alone (or, unarmed, a staff, Dance or Rally to use);
      // together, one action if either front has a safe attack. A unit apart with nothing safe to do holds back.
      const safe = new Map<Actor, boolean>();
      const hasSafe = (a: Actor) => {
        let v = safe.get(a);
        if (v === undefined) safe.set(a, (v = this.unitArmed(a.unit) && this.hasSafeAttack(a, ctx)));
        return v;
      };
      const splitsForWork = () => {
        const togetherWork = p.together!.some(hasSafe) ? 1 : 0;
        // Together, splitting needs more work apart than together; apart, as much. Stop counting once that's settled.
        const needed = was.kind === 'together' ? togetherWork + 1 : togetherWork;
        let apartWork = 0;
        for (let k = 0; k < 2 && apartWork < needed && apartWork + 2 - k >= needed; k++) {
          const u = units[k]!;
          if (this.unitArmed(u) ? hasSafe(p.apart![k]!) : this.useful(u)) apartWork++;
        }
        return apartWork >= needed;
      };
      // A unit with a talk to make this turn (#184) keeps its action: its pair stays as it is, the talker in front.
      const talker: 0 | 1 | undefined = talkers.has(p.lead) ? 0 : talkers.has(p.back!) ? 1 : undefined;
      // A bonded pair (a couple still to marry) stays together, or pairs up again, while together has safe work.
      const bonded = this.bonds.has(`${this.units[p.lead]!.id}|${this.units[p.back!]!.id}`);
      const splits = talker !== undefined ? was.kind === 'apart' : bonded && p.together!.some(hasSafe) ? false : splitsForWork();
      let change: SimStance['change'];
      if (splits) {
        p.stance = { kind: 'apart' };
        if (was.kind === 'together') {
          change = 'separate';
          this.spent.add(this.front.length + was.front);
        }
        this.front.push(p.apart![0]!, p.apart![1]!);
      } else {
        // Its engagement's risk: 0 with safe work, else its least risky attack or waiting in reach (the second realism
        // pass: the front was picked by the waiting alone, and a Great Knight fronted into a Hammer).
        // A hurt unit in front can be healed before it engages (a staff targets a pair's front): its risk at that HP.
        const risk = (k: 0 | 1) => {
          const a = p.together![k]!;
          if (!this.unitArmed(a.unit)) return Infinity;
          if (hasSafe(a)) return 0;
          const hp = Math.min(this.units[a.unit]!.fighter.stats.hp, this.hp[a.unit]! + heal);
          let r = 1 - this.survivalOf(a, undefined, hp, ctx, -1);
          for (const f of ctx.worn) r = Math.min(r, this.attackRisk(a, undefined, false, f, ctx, false, hp)?.risk ?? 1);
          return r;
        };
        const cur: 0 | 1 = was.kind === 'together' ? was.front : 0;
        const other: 0 | 1 = cur === 0 ? 1 : 0;
        // As safe either way, with the same EXP priority: the sturdier unit fronts (the second realism pass), the HP it
        // keeps through the worst foe's attack, as a careful player puts the wall where the foes come.
        const sturdy = (k: 0 | 1) => {
          const a = p.together![k]!;
          let left = Infinity;
          for (const f of ctx.threats) {
            const ex = this.exchangeFor(a, undefined, f, 'enemy', this.hp[a.unit]!);
            left = Math.min(left, ex.survive * ex.leadHp);
          }
          return left;
        };
        const rOther = risk(other);
        const rCur = risk(cur);
        const even = ctx.threats.length > 0 && Math.abs(rOther - rCur) <= EPS && rCur < Infinity && (!this.ranked || this.ranks[units[0]] === this.ranks[units[1]]);
        const front = talker ?? (rOther < rCur - EPS || (even && sturdy(other) >= sturdy(cur) + 1) ? other : cur);
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
    this.rallyWeighed = new Set();
    this.reserved = undefined;
    if (this.turn === 1) this.fieldBefore = this.foes.length;
    this.filling = this.turn > 1 && this.foes.length >= this.fieldBefore;
    this.pressSeen = this.pressSeenNow;
    this.pressSeenNow = Infinity;
    this.pressWeighed = false;
  }

  /** Whether an unarmed unit has something to do apart: a staff with uses, a Dance or a Rally. */
  private useful(u: number): boolean {
    const kit = this.kits[u]!;
    return kit.dances || !!kit.rally || kit.staves.some((s) => this.uses[u]![s.item]! > 0 && s.reach > 0);
  }

  /** Whether an actor has an attack now within `EXPOSURE_RISK`, exposure to enemy phase included. */
  private hasSafeAttack(a: Actor, ctx: PolicyContext): boolean {
    // Its enemy-phase survival where it stands, before anyone is in reach: an attack only lowers its HP, so when that's
    // already short of safe, only an attack felling a foe of the group that sets it can be safe (the rest aren't tried).
    const now = this.reachable(a) ? this.survivalOf(a, undefined, this.hp[a.unit]!, ctx, -1) : 1;
    const worst = this.survWorst;
    const short = now < 1 - EXPOSURE_RISK;
    for (const f of ctx.worn) {
      if (short && f.g !== worst) continue;
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
  /**
   * An attack on a foe that doesn't move yet sets it off, and its group with it (see `SimFoeGroup.moves`, `provoke`):
   * they attack on enemy phase. The front's survival of the worst of those attacks at the HP the exchange leaves: the
   * foe itself if it stands, a fresh one of its group if any is left (1 when none, or the foe already moves).
   */
  private woken(a: Actor, bonus: RallyBonus | undefined, f: FoeInstance, ex: Exchange): number {
    const foe = this.groups[f.g]!.foe;
    if (f.awake || !foe.weapon || foe.boss || !this.reachable(a)) return 1;
    return ex.foeHp > 0 ? this.exchangeFor(a, bonus, { g: f.g, hp: ex.foeHp }, 'enemy', ex.leadHp).survive : 1;
  }

  private attackRisk(a: Actor, bonus: RallyBonus | undefined, exposed: boolean, f: FoeInstance, ctx: PolicyContext, bound = false, hp = this.hp[a.unit]!): { ex: Exchange; risk: number; exact: boolean } | null {
    if (this.groups[f.g]!.target && !ctx.open) return null;
    const ex = this.exchangeFor(a, bonus, f, 'player', hp);
    if (!ex.leadStrikes || ex.survive < 0.5 || (ex.foeHp >= f.hp && ex.kill <= 0)) return null;
    if (exposed) return { ex, risk: 1 - ex.survive, exact: true };
    if (bound && 1 - ex.survive > EXPOSURE_RISK) return { ex, risk: 1 - ex.survive, exact: false };
    const floor = bound ? (1 - EXPOSURE_RISK) / ex.survive : 0;
    const after = Math.min(this.survivalOf(a, bonus, ex.leadHp, ctx, ex.foeHp <= 0 ? f.g : -1, floor), this.woken(a, bonus, f, ex));
    return { ex, risk: 1 - ex.survive * after, exact: after >= floor };
  }

  /**
   * A Rally, before anyone fights, when it's worth the rallier's action (the second realism pass): its bonus on the
   * fronts still to act (their best attacks, risk and enemy phase after included, with the bonus against without) is
   * worth more than what the rallier would do instead (its own safe attack or sustain). A rallier with nothing else to
   * do rallies: it costs nothing. Each holder is weighed once a turn.
   */
  bestRally(ctx: PolicyContext): Action | undefined {
    if (!this.foes.length || this.front.length < 2) return undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || this.rallyWeighed.has(gi)) continue;
      const bonus = this.kitOf(gi).rally;
      if (!bonus) continue;
      this.rallyWeighed.add(gi);
      if (this.rallyWorth(gi, bonus, ctx)) return { kind: 'rally', group: gi, value: 1 };
    }
    return undefined;
  }

  /** Whether front `gi`'s Rally is worth its action now (see `bestRally`). */
  private rallyWorth(gi: number, bonus: RallyBonus, ctx: PolicyContext): boolean {
    const others = [...this.front.keys()].filter((t) => t !== gi && !ctx.acted.has(t) && !this.npcFronts.has(t) && this.armed(t));
    if (!others.length) return false;
    // Each front's best attack at any risk, valued as the policy values it (a safer attack is worth more), or nothing.
    const fresh = (): PolicyContext => ({ ...ctx, memo: new Map(), sustain: new Map(), relief: new Map() });
    const worth = (c: PolicyContext) => others.reduce((v, t) => v + Math.max(0, this.bestAttackOf(t, c, 1)?.value ?? 0), 0);
    const own = Math.max(0, this.armed(gi) ? (this.bestAttackOf(gi, fresh())?.value ?? 0) : 0, this.sustainOf(gi, fresh())?.value ?? 0);
    // Nothing else to do: the Rally costs nothing (HP it saves over the turns isn't in the worth below).
    if (own <= EPS) return true;
    const before = worth(fresh());
    const was = this.bonus;
    this.bonus = this.bonus.map((b, t) => (t === gi ? b : b ? mergeRally(b, bonus) : bonus));
    this.dropRallied();
    this.dropSurvival();
    const after = worth(fresh());
    this.bonus = was;
    this.dropRallied();
    this.dropSurvival();
    const gain = after - before;
    return gain > EPS && gain > own;
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
    if (this.ranked) return this.rankedAttack(ctx, all, maxRisk);
    let best: Attack | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || gi === this.reserved || (!all && ctx.held?.has(gi))) continue;
      const a = this.bestAttackOf(gi, ctx, maxRisk);
      if (a && (!best || a.value > best.value)) best = a;
    }
    return best;
  }

  /**
   * The next attack under EXP priorities (#195), from the same fronts and attacks within `maxRisk` as `bestAttack`:
   * - a kill, the highest front's first, but never one a higher front still to act could take on the same foe (that
   *   kill is left for it);
   * - else a chip, the lowest front's first, one that brings its foe into a higher front's kill range before any other.
   * A front with nothing left but kills kept for others waits (this tier gives it nothing). Each front still has one
   * action: priority only orders who acts on what.
   */
  private rankedAttack(ctx: PolicyContext, all: boolean, maxRisk: number): Attack | undefined {
    const open: number[] = [];
    for (let gi = 0; gi < this.front.length; gi++) if (!ctx.acted.has(gi) && gi !== this.reserved && (all || !ctx.held?.has(gi))) open.push(gi);
    const rank = (gi: number) => this.ranks[this.front[gi]!.unit]!;
    const kills: Attack[] = [];
    const chips: Attack[] = [];
    // Damage on the target boss is the victory itself, whoever deals it (the second realism pass): it goes before
    // any EXP routing, the most valuable first.
    let boss: Attack | undefined;
    for (const gi of open) {
      for (const a of this.attacksOf(gi, ctx)) {
        this.exposure(a, ctx, maxRisk < 1);
        if (a.risk > maxRisk) continue;
        if (this.groups[a.foe.g]!.target) {
          if (!boss || a.value > boss.value) boss = a;
        } else (a.ex.foeHp <= 0 ? kills : chips).push(a);
      }
    }
    if (boss) return boss;
    let best: Attack | undefined;
    for (const a of kills) {
      const r = rank(a.group);
      if (kills.some((b) => b.foe === a.foe && rank(b.group) > r)) continue;
      if (!best || r > rank(best.group) || (r === rank(best.group) && a.value > best.value)) best = a;
    }
    if (best || !chips.length) return best;
    const low = Math.min(...chips.map((a) => rank(a.group)));
    let bestSetUp = false;
    for (const a of chips) {
      if (rank(a.group) !== low) continue;
      const setUp = open.some((gj) => gj !== a.group && rank(gj) > low && this.fells(gj, a.foe.g, a.ex.foeHp, ctx));
      if (!best || (setUp && !bestSetUp) || (setUp === bestSetUp && a.value > best.value)) {
        best = a;
        bestSetUp = setUp;
      }
    }
    return best;
  }

  /** Whether front `gi` likely fells a foe of group `g` left at `hp`, living through it (a chip's set-up, #195). */
  private fells(gi: number, g: number, hp: number, ctx: PolicyContext): boolean {
    if (!this.armed(gi) || (this.groups[g]!.target && !ctx.open)) return false;
    const ex = this.exchangeOf(gi, { g, hp }, 'player');
    return ex.leadStrikes && ex.survive >= 0.5 && ex.foeHp <= 0;
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
      // In reach already (it fights again after a Dance): the enemy phase it faced is taken, but at the HP this
      // exchange leaves it, the risk it adds is what it loses against the survival it has now.
      const front = this.front[a.group]!;
      const bonus = this.bonus[a.group];
      const now = this.safe.has(a.group) ? 1 : this.survivalOf(front, bonus, this.hp[front.unit]!, ctx, -1);
      const after = this.safe.has(a.group) ? 1 : Math.min(this.survivalOf(front, bonus, ex.leadHp, ctx, ex.foeHp <= 0 ? a.foe.g : -1), this.woken(front, bonus, a.foe, ex));
      a.risk = now > 0 ? Math.max(0, 1 - (ex.survive * after) / now) : 1;
      a.exact = true;
    } else if (bound && 1 - ex.survive > EXPOSURE_RISK) {
      a.risk = 1 - ex.survive;
      a.exact = false;
    } else {
      const floor = bound ? (1 - EXPOSURE_RISK) / ex.survive : 0;
      const after = Math.min(this.survivalOf(this.front[a.group]!, this.bonus[a.group], ex.leadHp, ctx, ex.foeHp <= 0 ? a.foe.g : -1, floor), this.woken(this.front[a.group]!, this.bonus[a.group], a.foe, ex));
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
      // A recruit still to talk to is never attacked.
      if (this.pending.has(f.g)) continue;
      const s = worn.get(f.g);
      if (!s || f.hp < s.hp) worn.set(f.g, f);
    }
    return (this.wornList = [...worn.values()]);
  }

  /** An attack by front `gi` on foe `f` that does something and that it more likely survives than not; null if not. */
  /**
   * How much safer each armed front stands on enemy phase with one foe of group `g` gone (see `attack`): its survival
   * without it less with it, at its HP now, by front. Worked out once a choice.
   */
  private relief(g: number, ctx: PolicyContext): ReadonlyMap<number, number> {
    const known = ctx.relief.get(g);
    if (known) return known;
    const r = new Map<number, number>();
    ctx.relief.set(g, r);
    if (!ctx.threats.some((f) => f.g === g)) return r;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (this.npcFronts.has(gi) || this.safe.has(gi) || !this.armed(gi)) continue;
      const a = this.front[gi]!;
      if (!this.reachable(a)) continue;
      const hp = this.hp[a.unit]!;
      const now = this.survivalOf(a, this.bonus[gi], hp, ctx, -1);
      const without = this.survivalOf(a, this.bonus[gi], hp, ctx, g);
      if (without > now + EPS) r.set(gi, without - now);
    }
    return r;
  }

  private attack(gi: number, f: FoeInstance, ctx: PolicyContext): Attack | null {
    if (this.groups[f.g]!.target && !ctx.open) return null;
    const ex = this.exchangeOf(gi, f, 'player');
    if (!ex.leadStrikes || ex.survive < 0.5) return null;
    const target = !!this.groups[f.g]!.target;
    const dealt = ex.foeHp < f.hp ? (f.hp - ex.foeHp) / f.hp : 0;
    // Damage is part of a kill, worth what the kill is: on the target boss, part of the victory (its HP carries).
    // A kill also makes the others safer: the survival it buys them against this foe's attack, and damage is part of
    // that too (the second realism pass: a careful player fells the Hammer fighter that keeps its Great Knight out of
    // the fight first).
    let worth = target ? 100 : 1;
    for (const [k, v] of this.relief(f.g, ctx)) if (k !== gi) worth += v;
    const gain = worth * (ex.kill + 0.5 * dealt);
    if (gain <= 0) return null;
    return { kind: 'attack', group: gi, foe: f, ex, gain, raw: ex.survive * gain - (1 - ex.survive), risk: 1, exact: false, value: -1, at: -1 };
  }

  /**
   * Whether this turn must press the boss (see `pressBoss`): reinforcements never stop, the field is filling (as many
   * foes at this turn's start as at the first turn's, or more: the stream outpaces the army), and the boss is open and
   * not yet hit this turn.
   */
  private pressing(ctx: PolicyContext): boolean {
    return this.endless && this.input.map.victory === 'boss' && !this.bossHit && ctx.open && this.filling;
  }

  /**
   * Keeps a presser for the boss (see `pressBoss`), before anyone fights: when no front has a safe attack on it this
   * turn, the front whose attack on it would be least risky at full HP stays out of the fighting (a hurt one is healed
   * first), so it presses after the rest have drawn the foes' attacks. Never an action itself.
   */
  keepPresser(ctx: PolicyContext): undefined {
    if (this.reserved !== undefined || !this.pressing(ctx)) return undefined;
    let rested: { gi: number; risk: number } | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || this.npcFronts.has(gi) || !this.armed(gi)) continue;
      for (const f of ctx.worn) {
        if (!this.groups[f.g]!.target) continue;
        // A safe attack on the boss now: the fighting tier takes it (boss damage is worth the victory), nobody waits.
        const now = this.attackRisk(this.front[gi]!, this.bonus[gi], false, f, ctx);
        if (now && now.risk <= EXPOSURE_RISK) return (this.reserved = -1), undefined;
        const r = this.attackRisk(this.front[gi]!, this.bonus[gi], false, f, ctx, false, this.maxHp(gi));
        if (r && (!rested || r.risk < rested.risk)) rested = { gi, risk: r.risk };
      }
    }
    this.reserved = rested?.gi ?? -1;
    return undefined;
  }

  /**
   * Reinforcements that never stop (Endgame's) and a target boss that fights back (the second realism pass): a turn
   * that doesn't hurt the boss only lets the field fill, however safely the army fells the stream. The model reads
   * waiting as free (each exposed pair still meets one attacker as the field fills), so an army with no safe attack on
   * the boss farmed the stream to the turn cap. Once the field fills (`pressing`) and the rest have fought and healed, a
   * turn that hasn't hurt the boss yet sends the least risky attack on it (the presser kept back, usually), over the 1%
   * a careful player takes for free: when that risk has stopped falling since last turn, and never a death more likely
   * than not. A turn it waits, the presser fights like anyone else.
   */
  pressBoss(ctx: PolicyContext): Action | undefined {
    if (!this.endless || this.input.map.victory !== 'boss' || this.bossHit || !ctx.open) return undefined;
    let best: Attack | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || this.npcFronts.has(gi)) continue;
      for (const a of this.attacksOf(gi, ctx)) {
        if (!this.groups[a.foe.g]!.target) continue;
        this.exposure(a, ctx, false);
        if (!best || a.risk < best.risk - EPS || (a.risk <= best.risk + EPS && a.value > best.value)) best = a;
      }
    }
    if (!best) return undefined;
    // Weighed once a turn. Waiting is free in the model, so the press waits while its risk is falling turn on turn (the
    // field thinning, the presser healing), and never takes a death more likely than not.
    if (this.pressWeighed) return undefined;
    this.pressWeighed = true;
    this.pressSeenNow = best.risk;
    if (!this.pressing(ctx) || best.risk >= 0.5 || best.risk < this.pressSeen - EPS) {
      // Not this turn: the presser kept back fights like anyone else.
      this.reserved = -1;
      return undefined;
    }
    return best;
  }

  /**
   * When nobody is in the foes' reach yet this turn and foes are left, the army engages once, with the least risk: the
   * safest attack by anyone (whatever its risk), or a bait (a front waits in reach, to take one attack and counter),
   * whichever risks less. Otherwise holding back would never finish the map. A turn with a talk (#184) has moved the
   * map on already: nobody needs to. A turn that restored HP (the second realism pass) waits for the next rather than
   * send a front more likely to die than not: the army is healing up (a hurt Chrom drinking a potion left only a Lv 1
   * Robin to engage, at a near-certain death).
   */
  engage(ctx: PolicyContext): Action | undefined {
    if (this.exposed.size || !this.foes.length || this.acts.some((a) => a.kind === 'talk')) return undefined;
    // Nothing left that attacks (only bosses holding their ground): waiting costs nothing, so a careful player heals up
    // before the risky attack, while a staff can still lift a hurt front (the realism pass).
    if (!ctx.threats.length && this.healingLeft()) return undefined;
    let best: { readonly action: Action; readonly risk: number } | undefined;
    const consider = (action: Action, risk: number) => {
      if (!best || risk < best.risk - EPS) best = { action, risk };
    };
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || gi === this.reserved || !this.armed(gi)) continue;
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
    // A turn that restored HP can wait for the next rather than send a front more likely to die than not.
    if (best && this.recovered && (best as { readonly risk: number }).risk >= 0.5) return undefined;
    return (best as { readonly action: Action } | undefined)?.action;
  }

  /**
   * A safe bait (the realism pass): a front with nothing safe to attack that would live through the enemy phase in reach
   * (within `EXPOSURE_RISK`) and counter the foe it faces waits in reach, as a careful player lets a wall take the
   * attacks. The sturdiest such front first.
   */
  safeBait(ctx: PolicyContext): Action | undefined {
    if (!ctx.threats.length) return undefined;
    let best: { readonly action: Action; readonly risk: number } | undefined;
    for (let gi = 0; gi < this.front.length; gi++) {
      if (ctx.acted.has(gi) || gi === this.reserved || this.exposed.has(gi) || this.safe.has(gi) || !this.armed(gi) || this.npcFronts.has(gi)) continue;
      const risk = 1 - this.survival(gi, this.hp[this.front[gi]!.unit]!, ctx);
      if (risk > EXPOSURE_RISK || (best && risk >= best.risk - EPS) || !this.counters(gi, ctx)) continue;
      best = { action: { kind: 'bait', group: gi, risk, value: 0 }, risk };
    }
    return best?.action;
  }

  /** The army's units on the field this turn (fronts and their backs; not NPCs): who can trade a potion over. */
  private fielded(): number[] {
    const out: number[] = [];
    this.front.forEach((a, gi) => {
      if (this.npcFronts.has(gi)) return;
      out.push(a.unit);
      if (a.back !== undefined) out.push(a.back);
    });
    return out;
  }

  /** Whether any unit of the army on the field still holds a potion with uses. */
  private potionsLeft(): boolean {
    return this.fielded().some((u) => this.kits[u]!.potions.some((p) => this.uses[u]![p.item]! > 0));
  }

  /** Whether a staff with uses could still heal an armed front that's hurt (a healer that acted heals next turn). */
  private healingLeft(): boolean {
    const hurt = this.front.some((a, gi) => this.armed(gi) && !this.npcFronts.has(gi) && this.hp[a.unit]! < this.units[a.unit]!.fighter.stats.hp);
    if (!hurt) return false;
    return this.front.some((a) => this.kits[a.unit]!.staves.some((st) => st.effect.kind !== 'rescue' && st.reach > 0 && this.uses[a.unit]![st.item]! > 0));
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
   * staff, its potion) is worth more than its best attack. They fight later if nothing better turns up. A potion it
   * could have traded over doesn't hold a fighter back: the healers' staves come first, a trade is the fallback.
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
        if (t === d || this.kitOf(t).dances || this.npcFronts.has(t)) continue;
        const a = this.bestAttackOf(t, ctx);
        if (a && a.value > 0 && (!best || a.value > best.value)) best = { kind: 'dance', group: d, target: t, value: a.value };
      }
    }
    return best;
  }

  /**
   * The best sustain action by any front that hasn't acted: the unarmed healers' first (their action has no other use),
   * then anyone's, a fighter's potion among them (the second realism pass: a fighter drank a potion a staff was there
   * to give, and lost its action to it).
   */
  bestSustain(ctx: PolicyContext): Action | undefined {
    for (const pass of [false, true]) {
      let best: Action | undefined;
      for (let gi = 0; gi < this.front.length; gi++) {
        if (ctx.acted.has(gi) || (!pass && this.armed(gi))) continue;
        const a = this.sustainOfCached(gi, ctx);
        if (a && (!best || a.value > best.value)) best = a;
      }
      if (best) return best;
    }
    return undefined;
  }

  /**
   * The foes that can attack on enemy phase (armed, not a boss holding its ground): each group's healthiest, the one
   * that would attack, and the arrivals joining at its start.
   */
  private threats(): FoeInstance[] {
    const by = new Map<number, FoeInstance>();
    const out: FoeInstance[] = [];
    for (const list of [this.foes, this.incoming]) {
      for (const f of list) {
        const foe = this.groups[f.g]!.foe;
        if (!foe.weapon || foe.boss || !f.awake) continue;
        // A foe set off by an attack this turn threatens only its provoker (see provoke): listed on its own.
        if (f.bound !== undefined) {
          out.push(f);
          continue;
        }
        const s = by.get(f.g);
        if (!s || f.hp > s.hp) by.set(f.g, f);
      }
    }
    by.forEach((f) => out.push(f));
    // The hardest hitters first: a survival check with a floor meets its worst early.
    const power = (f: FoeInstance) => {
      const foe = this.groups[f.g]!.foe;
      return Math.max(foe.stats.str, foe.stats.mag) + (foe.weapon?.mt ?? 0) + (foe.weapon?.crit ?? 0) / 4;
    };
    return out.sort((a, b) => power(b) - power(a));
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
      if (f.bound !== undefined && f.bound !== a.id) continue;
      const x = this.exchangeFor(a, bonus, f, 'enemy', hp).survive;
      if (x < s && this.free(f.g, x, without, a.id)) {
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
    const a = kit.staves.length || kit.potions.length || (this.armed(gi) && this.potionsLeft()) ? this.sustainOf(gi, ctx) : undefined;
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
    // A potion: its own, or one traded from another unit of the army on the field (a trade costs no action; the second
    // realism pass), the holder's with the most uses left first.
    const own = this.front[gi]!.unit;
    let pick: { holder: number; item: number; heal: number; rank: number } | undefined;
    for (const holder of this.armed(gi) ? this.fielded() : [own]) {
      for (const p of this.kits[holder]!.potions) {
        const left = this.uses[holder]![p.item]!;
        if (left <= 0) continue;
        const rank = p.heal * 1e6 + (holder === own ? 1e5 : 0) + left;
        if (!pick || rank > pick.rank) pick = { holder, item: p.item, heal: p.heal, rank };
      }
    }
    if (pick) {
      const hp = Math.min(pick.heal, this.maxHp(gi) - hpOf(gi));
      consider({ kind: 'item', group: gi, item: pick.item, holder: pick.holder, hp, value: this.healWorth(gi, hp, ctx) });
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
    // A use of an item, from the unit holding it (a potion traded over is the holder's use).
    const spend = (item: number, holder = unit) => {
      this.uses[holder]![item]!--;
      const u = this.units[holder]!;
      const name = u.items![item]!.item.name;
      const ht = this.tallies.get(u.id)!;
      ht.used[name] = (ht.used[name] ?? 0) + 1;
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
          if (h.hp > 0) this.progress = this.recovered = true;
          if (h.hp > 0 && this.exposed.has(h.group)) this.reclaim(h.group);
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
        const item = spend(a.item, a.holder);
        if (a.holder !== unit) this.traded = true;
        this.hp[unit]! += a.hp;
        if (a.hp > 0) this.progress = this.recovered = true;
        if (a.hp > 0 && this.exposed.has(a.group)) this.reclaim(a.group);
        forget(a.group);
        this.acts.push({ kind: 'item', unit: lead.id, item, hp: a.hp, ...(a.holder !== unit ? { from: this.units[a.holder]!.id } : {}) });
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
        // Waiting in reach to take an attack and counter is how the army moves the map on: the rest stay out of reach.
        this.progress = true;
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
    } else if (!this.clearQueue.length && this.foes.every((f) => this.pending.has(f.g))) {
      // Only recruits still to talk to are left: the talks go ahead and the map is won.
      for (const t of this.talks) if (!t.done && t.group !== undefined && this.pending.has(t.group)) this.recruit(t);
      this.ended = 'rout';
    }
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
    // Fronts spent by this turn's Separate have no action left; NPCs take none from the army. Talks go first.
    const acted = new Set<number>([...this.spent, ...this.npcFronts]);
    this.talk(acted);
    this.chase(acted);
    if (this.checkVictory()) return;
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
      return !!foe.weapon && !foe.boss && f.awake;
    });
    if (!attackers.length) return;
    // An army that moved nothing this turn can't keep away: the foes close in on every front.
    if (!this.progress) this.front.forEach((_, gi) => this.exposed.add(gi));
    const fronts = [...this.exposed].filter((i) => this.reachable(this.front[i]!) && !this.safe.has(i)).sort((a, b) => a - b);
    const byGroup = new Map<number, FoeInstance[]>();
    for (const f of attackers) byGroup.set(f.g, [...(byGroup.get(f.g) ?? []), f]);
    // The foe that attacks from a group is its healthiest.
    for (const list of byGroup.values()) list.sort((a, b) => b.hp - a.hp);
    // Under the attackers' stress (#211) each front takes a second attack, from the foes left, after every front's first.
    const rounds = this.input.stress === 'two-attackers' ? 2 : 1;
    for (let round = 0; round < rounds; round++) {
      const options = fronts.flatMap((gi) =>
        [...byGroup.entries()].flatMap(([g, list]) => {
          const f = list.find((x) => this.canAttack(x, gi));
          return f ? [{ gi, g, s: this.exchangeOf(gi, f, 'enemy').survive }] : [];
        }),
      );
      options.sort((a, b) => a.s - b.s || a.gi - b.gi || a.g - b.g);
      const hit = new Set<number>();
      for (const o of options) {
        if (hit.has(o.gi)) continue;
        const list = byGroup.get(o.g)!;
        const f = list.find((x) => this.canAttack(x, o.gi));
        if (!f) continue;
        list.splice(list.indexOf(f), 1);
        hit.add(o.gi);
        this.enemyAttack(o.gi, f, this.exchangeOf(o.gi, f, 'enemy'));
        if (this.checkVictory()) return;
      }
    }
    this.drawToWalls(fronts, byGroup);
  }

  /**
   * Foe `f` attacks front `gi` on enemy phase. A front's first attack plays as any exchange; a later one in the same
   * enemy phase (the stress case's second attacker, a wall's) is worked out over every HP the attacks before it can
   * leave (`phaseChain`), not from their likely result: the chance multiplied in is this attack's given the ones
   * before, and the play goes on from the expected HP given it lived through them all.
   */
  private enemyAttack(gi: number, f: FoeInstance, ex: Exchange) {
    let w = this.phaseSurvival.get(gi);
    if (!w) this.phaseSurvival.set(gi, (w = { start: this.hp[this.front[gi]!.unit]!, hits: [] }));
    if (!w.hits.length) {
      w.hits.push({ g: f.g, hp: f.hp });
      this.fight(gi, f, ex, 'enemy');
      return;
    }
    const before = this.phaseChain(gi, w);
    const s = total(before);
    const next = this.hpAfter(gi, f, before);
    const after = total(next);
    w.hits.push({ g: f.g, hp: f.hp });
    let sum = 0;
    for (const [hp, p] of next) sum += hp * p;
    this.fight(gi, f, after > 0 ? { ...ex, survive: s > 0 ? after / s : 0, leadHp: Math.round(sum / after) } : { ...ex, survive: 0 }, 'enemy');
  }

  /** Front `gi`'s HP over its endings after the attacks it took so far this enemy phase (see `enemyAttack`). */
  private phaseChain(gi: number, w: { readonly start: number; readonly hits: readonly { readonly g: number; readonly hp: number }[] }): Map<number, number> {
    let dist = new Map([[w.start, 1]]);
    for (const h of w.hits) dist = this.hpAfter(gi, h, dist);
    return dist;
  }

  /**
   * Walls (the second realism pass): after every exposed front's attacks, a front that can take more draws the foes
   * still free, one at a time, the worst left for it first: a careful player stands a sturdy unit where the foes come,
   * so each counters in turn. It draws another only while its chance of living through every attack this enemy phase
   * stays within `EXPOSURE_RISK` (worked out exactly over the HP each attack can leave, not from the likely result), its
   * counter hurts the foe, and fewer than `WALL_REACH` foes have come at it. Every foe still attacks once. Where the
   * map lets a wall stand, and how many foes really come, are the stated blind spot `walls-draw-foes`.
   */
  private drawToWalls(fronts: readonly number[], byGroup: Map<number, FoeInstance[]>) {
    for (const gi of fronts) {
      const w = this.phaseSurvival.get(gi);
      // Not reached at all: no foe was left for it.
      if (!w?.hits.length) continue;
      let dist = this.phaseChain(gi, w);
      if (total(dist) < 1 - EXPOSURE_RISK) continue;
      while (w.hits.length < WALL_REACH) {
        let best: { f: FoeInstance; ex: Exchange } | undefined;
        for (const list of byGroup.values()) {
          const f = list.find((x) => this.canAttack(x, gi));
          if (!f) continue;
          const ex = this.exchangeOf(gi, f, 'enemy');
          if (!best || ex.survive < best.ex.survive) best = { f, ex };
        }
        if (!best || !best.ex.leadStrikes || best.ex.foeHp >= best.f.hp) break;
        // A trade in the wall's favour: its counter takes a larger share of the foe's HP than the attack takes of its own.
        const hpNow = this.hp[this.front[gi]!.unit]!;
        if ((best.f.hp - best.ex.foeHp) / best.f.hp < (hpNow - best.ex.leadHp) / this.maxHp(gi)) break;
        const next = this.hpAfter(gi, best.f, dist);
        const after = total(next);
        if (after < 1 - EXPOSURE_RISK) break;
        const list = byGroup.get(best.f.g)!;
        list.splice(list.indexOf(best.f), 1);
        this.walled = true;
        this.enemyAttack(gi, best.f, best.ex);
        dist = next;
        if (this.checkVictory()) return;
      }
    }
  }

  /**
   * The lead's HP over its endings after foe `f` attacks front `gi`, from each HP in `from` (with its chance): the
   * endings it lives through, weighted by `from`'s chances. Apart, the Attack Stance mix at the spread's rate.
   */
  private hpAfter(gi: number, f: { readonly g: number; readonly hp: number }, from: ReadonlyMap<number, number>): Map<number, number> {
    const a = this.front[gi]!;
    const bonus = this.bonus[gi];
    const out = new Map<number, number>();
    const add = (grp: SimGroup, slot: 0 | 2, share: number, hp: number, p: number) => {
      if (share <= 0) return;
      const c = this.combatWith(bonus ? ralliedGroup(grp, bonus) : grp, a.rows, slot + (bonus ? 1 : 0), f);
      const k = hp * 1024 + f.hp;
      let d = (c.dists ??= new Map()).get(k);
      if (!d) c.dists.set(k, (d = leadHpAfter(c.m, c.weapon, hp, f.hp, 'enemy')));
      for (const [h, q] of d) out.set(h, (out.get(h) ?? 0) + p * share * q);
    };
    for (const [hp, p] of from) {
      if (a.adj) {
        add(a.adj, 2, this.adjacency, hp, p);
        add(a.grp, 0, 1 - this.adjacency, hp, p);
      } else add(a.grp, 0, 1, hp, p);
    }
    return out;
  }

  endTurn() {
    const exposed = [...this.exposed].sort((a, b) => a - b).map((gi) => this.units[this.front[gi]!.unit]!.id);
    this.log.push({ turn: this.turn, arrivals: this.arrivals, joins: this.joins, stances: this.stances, fights: this.fights, acts: this.acts, exposed, foesLeft: this.alive().length, noDeath: this.noDeath });
    this.arrivals = [];
    this.joins = [];
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
  /** How much safer each front stands with one foe of a group gone, by group (see `relief`), once worked out. */
  readonly relief: Map<number, ReadonlyMap<number, number>>;
  /** Fronts keeping their action from the fighting tier (see `heldBack`). */
  held?: ReadonlySet<number>;
};

/**
 * The action policy, tier by tier: the first tier with an action worth taking acts, then the policy starts over.
 * 1. A planned Rally, before anyone fights (its bonus is assumed to reach every pair: a stated blind spot).
 * 1b. With reinforcements that never stop and no safe attack on the target boss, a presser is kept out of the fighting
 *     (`keepPresser`; never an action).
 * 2. Safe fighting (within `EXPOSURE_RISK`), by fronts not held back (dancers, and fronts whose own sustain is worth
 *    more than their attack).
 * 3. A Dance for the front with the best safe attack left, which then acts in tier 2.
 * 4. Sustain: a heal, Fortify, Rescue or potion, by the enemy-phase survival it buys.
 * 4b. With reinforcements that never stop, a turn that hasn't hurt the boss yet presses it: the least risky attack on
 *     it, whatever its risk (`pressBoss`).
 * 5. Safe fighting by anyone left, held back or not.
 * 6. A safe bait (the realism pass): a front that lives through the enemy phase in reach and counters waits there.
 * 7. Engaging (#183): nobody is in reach yet, so the least risky attack or bait goes ahead; the rest hold back.
 * EXP priorities (#195) change who fights in tiers 2 and 5 (`rankedAttack`), not the tiers.
 */
const POLICY: readonly ((s: MapState, ctx: PolicyContext) => Action | undefined)[] = [
  (s, ctx) => s.bestRally(ctx),
  (s, ctx) => s.keepPresser(ctx),
  (s, ctx) => s.bestAttack(ctx),
  (s, ctx) => s.bestDance(ctx),
  (s, ctx) => s.bestSustain(ctx),
  (s, ctx) => s.pressBoss(ctx),
  (s, ctx) => s.bestAttack(ctx, true),
  (s, ctx) => s.safeBait(ctx),
  (s, ctx) => s.engage(ctx),
];

/** The total chance over an HP distribution's endings. */
function total(dist: ReadonlyMap<number, number>): number {
  let s = 0;
  for (const p of dist.values()) s += p;
  return Math.min(1, s);
}

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
    if (input.stopBelow !== undefined && s.noDeath < input.stopBelow) {
      s.ended = 'lost';
      break;
    }
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
      s.allyPhase();
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
  if (s.walled) spots.push('walls-draw-foes');
  if (s.traded) spots.push('potions-traded');
  if (Object.keys(s.skills).length) spots.push('lunatic-plus-draws');
  if (s.groups.some((g) => g.moves !== undefined && g.moves > 1)) spots.push('foes-wait');
  if (s.npcAny) spots.push('npc-kills');
  if (s.npcUnarmed) spots.push('npc-screened');
  if (s.talked) spots.push('talk-reaches');
  for (const b of input.map.blindSpots ?? []) if (!spots.includes(b)) spots.push(b);
  return {
    map: input.map.id,
    noDeath: s.noDeath,
    turns: s.turn,
    ended: s.ended ?? 'stalled',
    units,
    groups: s.groupTotals(),
    log: s.log,
    skills: s.skills,
    blindSpots: spots,
    ...(input.chase ? { chased: Object.fromEntries(s.chases.map(({ c, spent }) => [c.id, spent >= c.actions])) } : {}),
  };
}

/** The mean no-death chance over `runs` plays, each with its own seed from `seed` (Lunatic+ skills drawn anew). */
export function meanNoDeath(input: MapPlayInput, seeds: readonly number[]): number {
  if (!seeds.length) return 1;
  return seeds.reduce((a, sd) => a + playMap(input, sd).noDeath, 0) / seeds.length;
}
