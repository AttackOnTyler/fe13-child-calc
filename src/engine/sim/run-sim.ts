/**
 * The flawless chance of today's plan across the map order (#186; spec #175, The objective, Noise, and EXP, supports
 * and internal level; ADR 0001). Every map from the next one to the endpoint is played (`playMap`) by the plan's lineup
 * for it; what changes the route between maps is sampled: each unit's EXP from its combats (`combatExp` at its internal
 * level), and its level-ups one at a time from its growths (personal plus class), clamped at its effective caps. Each
 * simulated run carries the product of its maps' no-death chances; the flawless chance is their mean, with its
 * simulation error (±, 95%).
 *
 * The plan: each map's lineup is today's suggested deployment (`suggestDeployment`, as the preparation page picks it)
 * over the army as a projection with average growths would have it on that map. It is chosen once and every run plays
 * it, so runs differ only by their rolls, as edits compared on the same runs need.
 *
 * Cost: a run stops at the map where it has lost a unit (its chance of nobody lost falls below `LOST`), and the plan's
 * lineups are worked out only as far as some run gets, so a plan that fails early is cheap. A run that plays every map
 * of the Full route costs about 0.3 s, and the plan's projection about 0.8 s (the anytime solve's worker, #199, takes
 * that off the page).
 *
 * Each run's state is a `RunState`, walked map by map: `beforeMap` (joins, children read at entry, promotions), the
 * play, then `afterMap` (EXP and level-ups, later recruits and children). Children (#187): a child paralogue is entered
 * only when its gates hold in the run (`childParalogueGates` over the run's cleared maps and marriages; a closed one
 * isn't played); on entry the child's join stats (`childJoinStats`) and skills (`childSkills`) are read from its
 * parents as they stand in this run, and it joins the army after the map (Lucina: read at the start of Chapter 13,
 * joining at its end, as the chapter data has her).
 *
 * Supports (#188) grow in `afterMap` from the map's combats together (`mapSupportGains`: at most 3 points a pair, each
 * unit's top three pairs 3, 2 and 1, stopping at each rank's threshold under the clamp), from the recorded ranks. A
 * planned couple marries in a run only once the pair reaches S there, and the plan pairs it until then; at the end of
 * Chapter 11 an unmarried Chrom marries by the game's rule (`chromWifeByPoints`). A child's parents are then the run's
 * marriage: `children` lists one recruit per spouse its fixed parent can have, and the run takes the one it married.
 *
 * Gold and items (#190): each run carries its own gold (`state.gold`) and each unit its weapons, staves and potions with
 * their uses. After a map the run spends the uses its fights and staves took (`mapUpkeep`: per hit, the back paying for
 * its Dual Strikes, Armsthrift, a tome's miss per `tome-miss-use`) and gains the map's sure income (its Bullion no play
 * can lose, sold at the next armory, and Paralogue 13's; nothing else is sold) and sure free seals. At an armory stop (a
 * map whose preparations have an open armory) it buys down the shopping list in priority order: rebuys (an item whose
 * uses left are below what the plan's projection spends of it before the next stop: the last stop before it would run
 * dry), seals (a Master Seal at its armory price only when a promotion needs one and the run holds none), then at the
 * endpoint the endpoint kit (`endpointKit`, trimmed by `buyDown` when gold is short). A purchase the run can't afford is
 * skipped; a weapon at 0 uses is gone, a rebuy restores it unforged. Each stop's purchases are reported with the share of
 * runs that made them (`shopping`), and each map's gold at its end as a spread.
 *
 * Later tickets extend the same walk:
 * - #194 replaces the promotion rule below (`PROMOTION_RULE`) with the roadmap's class-reached milestones.
 */
import { CLASSES, type ClassData, type ClassId, type ClassTier } from '../../game-data/classes';
import { STATS, type Gender, type Growths, type Modifiers, type Stat } from '../../game-data/stats';
import type { DeploymentRole } from '../../curated/deployment';
import type { Assumptions, BlindSpotId, RunBlindSpotId } from '../assumptions';
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import type { SkillId } from '../../game-data/skills';
import { childJoinStats, classBaseStats, type JoinParent } from '../child-join';
import { childParalogueGates, isChildParalogue } from '../child-paralogues';
import { childSkills, type SkillParent } from '../child-skills';
import { classGrowths, classMaxStats, className, promotionsOf } from '../classes';
import { suggestDeployment, type DeployCandidate, type Deployment, type Pair } from '../deploy';
import { COUNT_CAP, combatExp, expFoeOf, tierBonus, type ExpFoe } from '../exp';
import type { Difficulty, RosterUnit } from '../roster';
import type { Fighter, Foe, SupportLevel } from '../solver';
import { CHROM_WEDDING_CANDIDATES, CHROM_WEDDING_MAP } from '../../game-data/supports';
import { chromWifeByPoints, type ChromStanding } from '../chrom-wedding';
import { SUPPORT_LEVELS } from '../run';
import { addPoints, mapSupportGains, pairThresholds, pointsOfRank, rankOf } from './support-growth';
import { playMap, type MapPlay, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit } from './map-play';
import { createRng, runSeed, type Rng } from './random';
import type { SimItem } from './sustain';
import type { GameItem } from '../../game-data/items';
import type { StockItem } from '../supply';
import { buyDown, endpointKit, forgedWeapon, freshWeapon, mapUpkeep, type KitPiece, type MapUpkeep } from './upkeep';

export type Weapon = NonNullable<Fighter['weapon']>;

/**
 * A unit as it enters the simulation: its recorded state (or its join data, for a recruit), and what its growths and
 * caps are read from.
 */
export type ArmyUnit = {
  readonly id: RosterUnit;
  readonly name: string;
  readonly gender: Gender;
  readonly classId: ClassId;
  readonly level: number;
  readonly exp: number;
  /** The Second Seal count its internal level adds (uncapped: the difficulty's cap applies when EXP is worked out). */
  readonly count: number;
  /** The internal level's tier bonus: 20 in an advanced class under the research's reading. */
  readonly bonus: number;
  readonly stats: Readonly<Record<Stat, number>>;
  /** Personal growths (the class's are added from the class data). */
  readonly growths: Growths;
  /** Max-stat modifiers, for its effective caps. */
  readonly modifiers: Modifiers;
  readonly skills: readonly string[];
  readonly weapons: readonly Weapon[];
  /** Each weapon's uses left, in `weapons` order (#190); absent or null: full (the item's uses; endless for an unbreakable one). */
  readonly weaponUses?: readonly (number | null)[];
  /** Staves and potions it can spend uses of (#182's sustain), with the uses left: spent map by map (#190). */
  readonly items?: readonly SimItem[];
  readonly supports: readonly { readonly partner: RosterUnit; readonly rank: SupportLevel }[];
  readonly role: DeploymentRole;
};

/**
 * A child who joins when its map is entered (#187): what doesn't depend on the run. Its join stats and skills are read
 * from its parents as they stand in the run on entry, and it joins the army after the map. A map lists one per spouse
 * its fixed parent can have (#188); a run takes the one whose parents it married (Lucina's with the Maiden while Chrom
 * is unmarried).
 */
export type ChildRecruit = {
  readonly id: ChildId;
  readonly name: string;
  /** The fixed parent, then its spouse (recorded, or the plan's); the Maiden as Chrom's wife when he marries no one else. */
  readonly parents: readonly [RosterUnit, RosterUnit | 'maiden'];
  /** A parent's fixed pass (Chrom's, Walhart's, Aversa's, or a Chrom child's to Morgan), fixed parent first. */
  readonly fixed?: readonly [SkillId | undefined, SkillId | undefined];
  /** Morgan's start class (its other parent's); every other child joins in its fixed class. */
  readonly startClass?: ClassId;
  readonly growths: Growths;
  readonly modifiers: Modifiers;
  readonly weapons: readonly Weapon[];
  readonly items?: readonly SimItem[];
  readonly role: DeploymentRole;
};

/** One map of the map order, as a run plays it. */
export type RunSimMap = {
  /** Unique on the order (`apotheosis-secret` for the secret route). */
  readonly key: string;
  readonly label: string;
  readonly map: SimMap;
  /** How many units it deploys. */
  readonly deploy: number;
  /** Units always fielded (Chrom on most story maps, the map's opening recruits). */
  readonly forced: readonly RosterUnit[];
  /** Recruits on the map from its start: they join the army and are fielded here. */
  readonly joining: readonly ArmyUnit[];
  /** A setup fielded only on this map (Premonition's): it never joins the army. */
  readonly mapOnly: readonly ArmyUnit[];
  /** Recruits who come later in the map (a talk, a later turn): in the army from the next map. */
  readonly later: readonly ArmyUnit[];
  /** Children read on entering it (a child paralogue, or Chapter 13 for Lucina), in the army from the next map (#187). */
  readonly children?: readonly ChildRecruit[];
  /**
   * Whether Master Seals are sold in an armory by this map's preparations (a merchant's aren't counted on): at the
   * seal's price (2,500G), when `armory` isn't given.
   */
  readonly masterSeals: boolean;
  /** What the open armories sell in this map's preparations, with prices (#190); absent or empty: no armory stop. */
  readonly armory?: readonly StockItem[];
  /** The map's sure income (#190): its Bullion no play can lose at its sale price, and Paralogue 13's gold; added after it. */
  readonly income?: number;
  /** Seals picked up on the map that no play can lose (#190): held from the next map. */
  readonly seals?: { readonly master: number; readonly second: number };
};

export type RunSimInput = {
  readonly army: readonly ArmyUnit[];
  readonly maps: readonly RunSimMap[];
  readonly difficulty: Difficulty;
  /** Master Seals held at the start (convoy and inventories). */
  readonly masterSealsHeld?: number;
  /** Second Seals held at the start (#190). */
  readonly secondSealsHeld?: number;
  /** Gold held at the start (#190); absent: none. */
  readonly gold?: number;
  /** Maps already played (the chapter log's): a child paralogue's gates read them (#187). */
  readonly cleared?: readonly string[];
  /** The recorded marriages (facts): married from the start of every run. */
  readonly married?: readonly (readonly [RosterUnit, RosterUnit | 'maiden'])[];
  /**
   * The plan's marriages still to make (#188): a couple marries in a run once the pair reaches S there, and the plan's
   * lineups pair it until then.
   */
  readonly couples?: readonly (readonly [RosterUnit, RosterUnit])[];
  /**
   * The plan's lineups (#198), by map in `maps` order: a map with one plays it (`plannedDeployment`); a map without one
   * plays the greedy lineup (`suggestDeployment` over the projection's army, the couples paired until they marry).
   */
  readonly lineups?: readonly (LineupPlan | undefined)[];
};

/** A lineup a plan names for one map (#198): its pairs (a Lead, and its Back if any) and its units alone. */
export type LineupPlan = {
  readonly pairs: readonly { readonly lead: RosterUnit; readonly back?: RosterUnit }[];
  readonly solo: readonly RosterUnit[];
};

/** A stat's spread over the runs at the endpoint: 10th percentile, median, 90th, and the effective cap. */
export type StatSpread = { readonly low: number; readonly median: number; readonly high: number; readonly cap: number };

/** A unit's expected stats entering the endpoint: its likeliest class and a spread over the runs. */
export type UnitForecast = {
  readonly id: RosterUnit;
  readonly name: string;
  /** The class it's in, in most runs. */
  readonly className: string;
  readonly level: StatSpread;
  readonly exp: number;
  readonly stats: Readonly<Record<Stat, StatSpread>>;
  /** Its equipped skills: as recorded, or a child's as it joined (its class's and its parents' passes, #187). */
  readonly skills: readonly string[];
};

/** A pair's support entering the endpoint, over the runs that reach it with nobody lost (#188). */
export type SupportForecast = {
  readonly a: RosterUnit;
  readonly b: RosterUnit;
  /** Its points: the spread's cap is its top rank's threshold. */
  readonly points: StatSpread;
  /** The rank it holds in most of those runs (null below C). */
  readonly rank: SupportLevel | null;
};

/** A marriage entering the endpoint (#188): recorded, made by S, or Chrom's at the end of Chapter 11. */
export type MarriageForecast = {
  readonly a: RosterUnit;
  readonly b: RosterUnit | 'maiden';
  /** The share of the runs reaching the endpoint with nobody lost in which it's made. */
  readonly share: number;
  /** The map after which it's made in most of those runs (its key); undefined when it's recorded. */
  readonly after: string | undefined;
};

export type RunSimMapResult = {
  readonly key: string;
  readonly label: string;
  /**
   * The chance of reaching it with nobody lost: the flawless chance through the map before. A child paralogue whose
   * gates don't hold in a run isn't played there, and that run isn't counted here (#187).
   */
  readonly reach: number;
  /**
   * The map's no-death chance for the runs that reach it with nobody lost (each run weighted by its chance of getting
   * there); undefined when none does.
   */
  readonly noDeath: number | undefined;
  /** The plan's lineup for it; undefined past the maps any run reached with nobody lost (never worked out). */
  readonly lineup: Deployment | undefined;
  /** The expected turns, weighted the same way; undefined when no run reaches it. */
  readonly turns: number | undefined;
  /**
   * Gold at the map's end (#190), its sure income added, over the runs that play it with nobody lost before it;
   * undefined when none does.
   */
  readonly gold: GoldSpread | undefined;
};

/** Gold over the runs: 10th percentile, median and 90th. */
export type GoldSpread = { readonly low: number; readonly median: number; readonly high: number };

/** One purchase at an armory stop (#190), over the runs that reach the stop with nobody lost. */
export type ShoppingLine = {
  /** Why: a rebuy of an item running dry, a seal a promotion needs, or a piece of the endpoint kit. */
  readonly kind: 'rebuy' | 'seal' | 'kit';
  readonly action: 'buy' | 'forge';
  readonly item: string;
  /** Who it's for (its id and name). */
  readonly unit: RosterUnit;
  readonly name: string;
  /** Its price; a forge's cost to +5 Mt. */
  readonly cost: number;
  /** The share of those runs that make it. */
  readonly share: number;
};

/** An armory stop's shopping list (#190): the purchases the runs make there, in priority order (rebuys, seals, kit). */
export type ShoppingStop = {
  readonly key: string;
  readonly label: string;
  /** Gold on arrival, before shopping. */
  readonly gold: GoldSpread;
  /** Runs reaching it with nobody lost. */
  readonly runs: number;
  readonly lines: readonly ShoppingLine[];
};

export type RunSim = {
  /** The flawless chance: the mean over runs of each run's product of no-death chances. */
  readonly chance: number;
  /** Its simulation error: 1.96 standard errors (95%). */
  readonly margin: number;
  readonly runs: number;
  /** Each run's flawless chance, in run order, for paired comparisons on the same runs. */
  readonly samples: readonly number[];
  readonly maps: readonly RunSimMapResult[];
  /**
   * Expected stats entering the endpoint (the last map), for the units in the army there, over the runs that reach it
   * with nobody lost; empty when none does.
   */
  readonly units: readonly UnitForecast[];
  /** Supports entering the endpoint, pairs with points only, over the same runs (#188). */
  readonly supports: readonly SupportForecast[];
  /** Marriages entering the endpoint, over the same runs (#188). */
  readonly marriages: readonly MarriageForecast[];
  /** Each armory stop some run reached with nobody lost, in map order, with what the runs bought there (#190). */
  readonly shopping: readonly ShoppingStop[];
  /** The stated blind spots it rests on: the map simulation's, then the run simulation's own. */
  readonly blindSpots: readonly (BlindSpotId | RunBlindSpotId)[];
};

/**
 * The promotion rule until the roadmap plans class changes (#194): a unit in a base class at its level cap is
 * promoted with a Master Seal in the next map's preparations, when one is held or an armory sells them by then, to the
 * promotion that raises its class bases most. A stated blind spot (`promotes-at-cap`).
 */
export const PROMOTION_RULE = { level: 20 } as const;

/** The run simulation's own blind spots (see BLIND_SPOTS): what it simplifies between maps. */
const RUN_BLIND_SPOTS: readonly RunBlindSpotId[] = ['promotes-at-cap', 'lead-takes-exp', 'supports-from-pair-combats', 'sure-income-only', 'kit-by-matchups-won'];

/** Special classes (Dancer, Villager, Taguel, Manakete, the DLC classes) level to 30; base and advanced to 20. */
export const levelCap = (tier: ClassTier): number => (tier === 'special' ? 30 : 20);

/** A unit in one run: where it stands now. Stats are fractional in the plan's projection (average growths). */
type Live = {
  readonly base: ArmyUnit;
  classId: ClassId;
  tier: ClassTier;
  level: number;
  exp: number;
  count: number;
  bonus: number;
  readonly stats: Record<Stat, number>;
  /** Its weapons with their uses left (a broken one stays at 0 until rebought), and its staves and potions (#190). */
  readonly gear: { weapon: Weapon; uses: number }[];
  readonly stock: { readonly item: GameItem; uses: number }[];
  /** What it fights and heals with: the gear and stock with uses left (`refresh`), and their key for the interner. */
  weapons: readonly Weapon[];
  items: readonly SimItem[];
  gearKey: string;
};

/** A purchase a run made at a stop, before it's counted over the runs. */
type Receipt = Omit<ShoppingLine, 'share'>;

/** One run's state, walked map by map. */
export type RunState = {
  readonly army: Map<RosterUnit, Live>;
  masterSealsHeld: number;
  secondSealsHeld: number;
  /** Gold held (#190); the plan's projection has unlimited gold, so it buys what it needs. */
  gold: number;
  /** This stop's purchases (a run's; the projection keeps none). */
  receipts: Receipt[] | null;
  /** Maps played, recorded ones included: the child paralogues' gates read them. */
  readonly cleared: Set<string>;
  /** Who is married to whom (both ways; the Maiden only as Chrom's wife). */
  readonly spouses: Map<RosterUnit, RosterUnit | 'maiden'>;
  /** Units married: the child paralogues' gates read them. */
  readonly married: Set<RosterUnit>;
  /** Support points by pair (`pairKey`), from the recorded ranks on (#188). */
  readonly supports: Map<string, number>;
  /** The map index after which each marriage the run made was made, by `pairKey`. */
  readonly weddings: Map<string, number>;
  /** The plan's couples still to marry, by `pairKey`. */
  readonly couples: ReadonlyMap<string, readonly [RosterUnit, RosterUnit]>;
  /** Robin's gender, for Robin's support curves. */
  readonly robin: Gender | undefined;
  /** Children read on entering this map, who join after it. */
  arriving: Live[];
};

/** Class growths by class and gender, per set of assumptions (Conqueror's are assumed). */
const CLASS_GROWTHS = new WeakMap<Assumptions, Map<string, Growths>>();
function totalGrowth(u: Live, assumptions: Assumptions, s: Stat): number {
  let byClass = CLASS_GROWTHS.get(assumptions);
  if (!byClass) CLASS_GROWTHS.set(assumptions, (byClass = new Map()));
  const k = `${u.classId}|${u.base.gender}`;
  let g = byClass.get(k);
  if (!g) byClass.set(k, (g = classGrowths(u.classId, u.base.gender, assumptions)));
  return u.base.growths[s] + g[s];
}

/** Effective caps: the class's max stats plus the unit's modifiers, plus 10 (not HP) with Limit Breaker equipped. */
function capsOf(u: Live): Record<Stat, number> {
  const max = classMaxStats(u.classId, u.base.gender);
  const lb = u.base.skills.includes('Limit Breaker') ? 10 : 0;
  const out = {} as Record<Stat, number>;
  for (const s of STATS) out[s] = s === 'hp' ? max.hp : max[s] + u.base.modifiers[s] + lb;
  return out;
}

/** Weapons' ids for the interner's keys (a weapon object is shared across runs). */
const WEAPON_IDS = new WeakMap<Weapon, number>();
let nextWeaponId = 0;
const weaponId = (w: Weapon) => WEAPON_IDS.get(w) ?? (WEAPON_IDS.set(w, ++nextWeaponId), nextWeaponId);

/** An item's full uses: none (unbreakable) is endless. */
const fullUses = (item: GameItem) => item.uses ?? Infinity;

/** Its fighting weapons and items from its gear and stock (#190). */
function refresh(u: Live) {
  u.weapons = u.gear.filter((g) => g.uses > 0).map((g) => g.weapon);
  u.items = u.stock.filter((s) => s.uses > 0).map((s) => ({ item: s.item, uses: s.uses }));
  u.gearKey = `${u.weapons.map(weaponId).join(',')}/${u.items.map((i) => `${i.item.name}:${i.uses}`).join(',')}`;
}

function liveOf(a: ArmyUnit): Live {
  const u: Live = {
    base: a,
    classId: a.classId,
    tier: CLASSES[a.classId].tier,
    level: a.level,
    exp: a.exp,
    count: a.count,
    bonus: a.bonus,
    stats: { ...a.stats },
    gear: a.weapons.map((weapon, i) => ({ weapon, uses: a.weaponUses?.[i] ?? fullUses(weapon.item) })),
    stock: (a.items ?? []).map((s) => ({ item: s.item, uses: s.uses })),
    weapons: [],
    items: [],
    gearKey: '',
  };
  refresh(u);
  return u;
}

/** One level-up: each stat grows by 1 on its growth's roll (or by the growth's fraction in the projection), up to its cap. */
function levelUp(u: Live, rng: Rng | null, assumptions: Assumptions) {
  u.level++;
  const caps = capsOf(u);
  for (const s of STATS) {
    if (u.stats[s] >= caps[s]) continue;
    const g = Math.max(0, Math.min(100, totalGrowth(u, assumptions, s)));
    u.stats[s] = Math.min(caps[s], u.stats[s] + (rng ? (rng.next() * 100 < g ? 1 : 0) : g / 100));
  }
}

/** EXP earned: level-ups one at a time; at the level cap the rest is lost. */
function gainExp(u: Live, exp: number, rng: Rng | null, assumptions: Assumptions) {
  const cap = levelCap(u.tier);
  if (u.level >= cap) return void (u.exp = 0);
  u.exp += exp;
  while (u.exp >= 100 && u.level < cap) {
    u.exp -= 100;
    levelUp(u, rng, assumptions);
  }
  if (u.level >= cap) u.exp = 0;
}

/** The promotion that raises its class bases most (first listed on a tie), with the gains. */
function promotionOf(u: Live): { to: ClassId; gains: Record<Stat, number> } | undefined {
  const from = classBaseStats(u.classId, u.base.gender);
  let best: { to: ClassId; gains: Record<Stat, number>; total: number } | undefined;
  for (const to of promotionsOf(u.classId)) {
    const t = classBaseStats(to, u.base.gender);
    const lock = (CLASSES[to] as ClassData).genderLock;
    if (!from || !t || (lock && lock !== u.base.gender)) continue;
    const gains = Object.fromEntries(STATS.map((s) => [s, Math.max(0, t[s] - from[s])])) as Record<Stat, number>;
    const total = STATS.reduce((a, s) => a + gains[s], 0);
    if (!best || total > best.total) best = { to, gains, total };
  }
  return best;
}

/** A seal's price in the armories when `armory` isn't given. */
const SEAL_PRICE = 2500;

/** An item's price in this map's armories, or undefined where none sells it. */
function priceIn(step: RunSimMap, item: string): number | undefined {
  if (step.armory) return step.armory.find((a) => a.item === item)?.cost ?? undefined;
  return item === 'Master Seal' && step.masterSeals ? SEAL_PRICE : undefined;
}

/** Pays for a purchase when the gold covers it, keeping its receipt. */
function pay(state: RunState, r: Receipt): boolean {
  if (state.gold < r.cost) return false;
  state.gold -= r.cost;
  state.receipts?.push(r);
  return true;
}

/**
 * The promotion rule (`PROMOTION_RULE`), in a map's preparations: with a Master Seal the run holds, else one bought
 * here when an armory sells it and the gold covers it (#190); otherwise it waits.
 */
function promote(state: RunState, step: RunSimMap, reading: Assumptions['class-change-internal-level']) {
  for (const u of state.army.values()) {
    if (u.tier !== 'base' || u.level < PROMOTION_RULE.level) continue;
    const p = promotionOf(u);
    if (!p) continue;
    if (state.masterSealsHeld > 0) state.masterSealsHeld--;
    else {
      const price = priceIn(step, 'Master Seal');
      if (price === undefined || !pay(state, { kind: 'seal', action: 'buy', item: 'Master Seal', unit: u.base.id, name: u.base.name, cost: price })) continue;
    }
    const levelAtUse = u.level;
    u.classId = p.to;
    u.tier = CLASSES[p.to].tier;
    u.level = 1;
    u.exp = 0;
    // Research: a Master Seal only adds the advanced tier's +20. +1 per class change: the level at use carries on.
    if (reading === 'plus-one') u.count += levelAtUse;
    else u.bonus = 20;
    const caps = capsOf(u);
    for (const s of STATS) u.stats[s] = Math.min(Math.max(caps[s], u.stats[s]), u.stats[s] + p.gains[s]);
  }
}

const internalOf = (u: Live, difficulty: Difficulty) => u.level + u.bonus + Math.min(u.count, COUNT_CAP[difficulty]);

/** Rounded stats as the combat math reads them. */
const shownStats = (u: Live): Record<Stat, number> => Object.fromEntries(STATS.map((s) => [s, Math.floor(u.stats[s] + 1e-9)])) as Record<Stat, number>;

const fighterOf = (u: Live, stats: Readonly<Record<Stat, number>>): Fighter => ({
  name: u.base.name,
  className: className(u.classId, u.base.gender),
  stats,
  skills: u.base.skills,
  weapon: u.weapons[0],
});

/** Each foe group's EXP foe on a map, by key (undefined for a class the EXP data doesn't know: it gives none). */
const EXP_FOES = new WeakMap<SimMap, Map<string, ExpFoe | undefined>>();
function expFoes(map: SimMap): Map<string, ExpFoe | undefined> {
  let m = EXP_FOES.get(map);
  if (!m) {
    m = new Map();
    const groups: SimFoeGroup[] = [...map.foes, ...map.waves.flatMap((w) => w.groups)];
    for (const g of groups) m.set(g.key, expFoeOf(g.foe.className, g.foe.level ?? 1, g.foe.boss));
    EXP_FOES.set(map, m);
  }
  return m;
}

/**
 * The EXP each fight gives, in the play's order, landing on the lead (a kill, or damage when the foe lived). A back's
 * Dual Strike EXP isn't counted (#195 splits EXP), nor the Lunatic cut for a foe's repeat engagements.
 */
function earn(state: RunState, map: SimMap, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions) {
  const foes = expFoes(map);
  const lunatic = difficulty === 'lunatic' || difficulty === 'lunatic-plus';
  for (const turn of play.log) {
    for (const f of turn.fights) {
      const u = state.army.get(f.lead as RosterUnit);
      const foe = foes.get(f.foe);
      if (!u || !foe) continue;
      const veteran = u.base.skills.includes('Veteran') ? 1.5 : 1;
      gainExp(u, combatExp(internalOf(u, difficulty), foe, f.kill ? 'kill' : 'damage', false, lunatic, 1, veteran), rng, assumptions);
    }
  }
}

/** Interned lineup objects: the same unit and stats (and the same pair) is the same object across runs, so the map simulation's combat caches hit. */
type Interner = { readonly units: Map<string, SimUnit>; readonly keys: Map<SimUnit, string>; readonly groups: Map<string, SimGroup> };

const newInterner = (): Interner => ({ units: new Map(), keys: new Map(), groups: new Map() });

function lineupOf(state: RunState, d: Deployment, extra: ReadonlyMap<RosterUnit, Live>, interner: Interner): SimGroup[] {
  const unit = (id: RosterUnit): SimUnit | undefined => {
    const u = state.army.get(id) ?? extra.get(id);
    if (!u) return undefined;
    const stats = shownStats(u);
    const key = `${id}|${u.classId}|${STATS.map((s) => stats[s]).join(',')}|${u.gearKey}`;
    let su = interner.units.get(key);
    if (!su) {
      interner.units.set(key, (su = { id, fighter: fighterOf(u, stats), weapons: u.weapons, ...(u.items.length ? { items: u.items } : {}) }));
      interner.keys.set(su, key);
    }
    return su;
  };
  const group = (lead: SimUnit, back: SimUnit | undefined, support: SupportLevel | null): SimGroup => {
    const k = `${interner.keys.get(lead)}#${back ? interner.keys.get(back) : ''}#${support ?? ''}`;
    let g = interner.groups.get(k);
    if (!g) interner.groups.set(k, (g = { lead, ...(back ? { back } : {}), support: back ? support : null }));
    return g;
  };
  const out: SimGroup[] = [];
  for (const p of d.pairs) {
    const lead = unit(p.lead);
    const back = p.back ? unit(p.back) : undefined;
    if (lead) out.push(group(lead, back, back ? rankIn(state, p.lead, p.back!) : null));
    else if (back) out.push(group(back, undefined, null));
  }
  for (const id of d.solo) {
    const s = unit(id);
    if (s) out.push(group(s, undefined, null));
  }
  return out;
}

/** The units a map can field: the army, its opening recruits and its own setups. */
function candidatesOf(state: RunState, extra: ReadonlyMap<RosterUnit, Live>): DeployCandidate[] {
  return [...state.army.values(), ...extra.values()].map((u) => ({
    unit: u.base.id,
    role: u.base.role,
    fighter: fighterOf(u, shownStats(u)),
    weapons: u.weapons,
    ...(u.items.length ? { items: u.items } : {}),
    supports: supportsOf(state, u.base.id),
  }));
}

/** Whether a map is entered in this run: a child paralogue only when its gates hold (Chapter 13 cleared, its parent married, its place reachable). */
function entered(state: RunState, step: RunSimMap): boolean {
  const id = step.map.id;
  if (!isChildParalogue(id)) return true;
  return childParalogueGates({ cleared: state.cleared, married: state.married }).some((g) => g.map === id && g.playable);
}

/**
 * A child as it joins (#187): join stats from its parents' stats and classes as they stand on entry (stored stats; the
 * projection's are fractional, which the formula's floor absorbs), skills from their equipped skills. Undefined when a
 * parent isn't in the run's army (lost, or never simulated) or is in a class with no published bases.
 */
function childOf(state: RunState, c: ChildRecruit, assumptions: Assumptions): Live | undefined {
  const side = (u: RosterUnit | 'maiden'): { join: JoinParent; skills: SkillParent } | undefined => {
    if (u === 'maiden') return { join: 'maiden', skills: 'maiden' };
    const p = state.army.get(u);
    if (!p || !classBaseStats(p.classId, p.base.gender)) return undefined;
    return { join: { stats: p.stats, class: p.classId, gender: p.base.gender }, skills: { skills: p.base.skills } };
  };
  const a = side(c.parents[0]);
  const b = side(c.parents[1]);
  if (!a || !b) return undefined;
  const fixed = (s: SkillParent, f: SkillId | undefined): SkillParent => (f && s !== 'maiden' ? { ...s, fixed: f } : s);
  const join = childJoinStats({ child: c.id, parents: [a.join, b.join], ...(c.startClass ? { startClass: c.startClass } : {}), modifiers: c.modifiers }, assumptions);
  const { skills } = childSkills({ child: c.id, parents: [fixed(a.skills, c.fixed?.[0]), fixed(b.skills, c.fixed?.[1])], startClass: join.class, level: join.level }, assumptions);
  const gender = CHILD_UNITS[c.id].gender;
  return liveOf({
    id: c.id,
    name: c.name,
    gender,
    classId: join.class,
    level: join.level,
    exp: 0,
    count: 0,
    bonus: tierBonus(CLASSES[join.class].tier),
    stats: join.stats,
    growths: c.growths,
    modifiers: c.modifiers,
    skills,
    weapons: c.weapons,
    ...(c.items ? { items: c.items } : {}),
    supports: [],
    role: c.role,
  });
}

/**
 * A run's shopping at an armory stop besides seals (#190): `need` is what the plan's projection spends of a unit's item
 * from this map to the next stop, `kit` the endpoint kit when this is the endpoint's stop.
 */
type Shop = { readonly need: (unit: RosterUnit, item: string) => number; readonly kit?: () => readonly KitPiece[] };

/** Rebuys: an item whose uses left are below what it will spend before the next stop, when sold here. */
function rebuy(state: RunState, step: RunSimMap, shop: Shop) {
  for (const u of state.army.values()) {
    let changed = false;
    const receipt = (item: GameItem, cost: number): Receipt => ({ kind: 'rebuy', action: 'buy', item: item.name, unit: u.base.id, name: u.base.name, cost });
    for (const g of u.gear) {
      const item = g.weapon.item;
      const need = shop.need(u.base.id, item.name);
      const price = item.uses && need > 0 && g.uses < need ? priceIn(step, item.name) : undefined;
      if (price === undefined || !pay(state, receipt(item, price))) continue;
      // A copy bought joins the one held (the convoy merges them); a broken one comes back unforged.
      if (g.uses <= 0) g.weapon = freshWeapon(item);
      g.uses += item.uses!;
      changed = true;
    }
    for (const s of u.stock) {
      const need = shop.need(u.base.id, s.item.name);
      const price = s.item.uses && need > 0 && s.uses < need ? priceIn(step, s.item.name) : undefined;
      if (price === undefined || !pay(state, receipt(s.item, price))) continue;
      s.uses += s.item.uses!;
      changed = true;
    }
    if (changed) refresh(u);
  }
}

/** The endpoint kit, bought down with the gold left (`buyDown`): pieces for units the run has, forges of weapons it holds. */
function buyKit(state: RunState, pieces: readonly KitPiece[]) {
  const holds = (u: Live, p: KitPiece) => p.action === 'buy' || p.after !== undefined || u.gear.some((g) => g.uses > 0 && g.weapon.item === p.item);
  const usable = pieces.map((p) => {
    const u = state.army.get(p.unit as RosterUnit);
    return u && holds(u, p) ? p : { ...p, cost: Infinity };
  });
  for (const i of buyDown(usable, state.gold)) {
    const p = usable[i]!;
    const u = state.army.get(p.unit as RosterUnit)!;
    pay(state, { kind: 'kit', action: p.action, item: p.item.name, unit: u.base.id, name: u.base.name, cost: p.cost });
    if (p.action === 'buy' && p.item.kind === 'item') u.stock.push({ item: p.item, uses: p.item.uses ?? 1 });
    else if (p.action === 'buy') u.gear.push({ weapon: freshWeapon(p.item), uses: fullUses(p.item) });
    else {
      const g = p.after !== undefined ? u.gear.find((x) => x.weapon === freshWeapon(p.item)) : u.gear.find((x) => x.uses > 0 && x.weapon.item === p.item);
      if (g) g.weapon = forgedWeapon(g.weapon);
    }
    refresh(u);
  }
}

/**
 * After a map (#190): each unit spends the uses the play took (a weapon at 0 is gone until rebought), then the map's sure
 * income and free seals are the run's.
 */
function upkeep(state: RunState, step: RunSimMap, spent: MapUpkeep) {
  for (const [id, items] of spent) {
    const u = state.army.get(id as RosterUnit);
    if (!u) continue;
    for (const [name, n] of items) {
      let left = n;
      for (const e of [...u.gear.filter((g) => g.weapon.item.name === name), ...u.stock.filter((s) => s.item.name === name)]) {
        if (left <= 0) break;
        const take = Math.min(e.uses, left);
        e.uses -= take;
        left -= take;
      }
    }
    refresh(u);
  }
  state.gold += step.income ?? 0;
  state.masterSealsHeld += step.seals?.master ?? 0;
  state.secondSealsHeld += step.seals?.second ?? 0;
}

/**
 * A map's preparations: its opening recruits join (and its own setups are fielded), its children are read from their
 * parents on entry, then the shopping list in priority order: rebuys, seals with promotions, the endpoint kit (#190).
 * Undefined when the map isn't entered in this run (a closed child paralogue).
 */
function beforeMap(state: RunState, step: RunSimMap, assumptions: Assumptions, shop?: Shop): Map<RosterUnit, Live> | undefined {
  if (!entered(state, step)) return undefined;
  for (const a of step.joining) if (!state.army.has(a.id)) join(state, a);
  state.arriving = [];
  for (const c of step.children ?? []) {
    if (state.army.has(c.id) || state.arriving.some((u) => u.base.id === c.id) || c.parents[1] !== spouseIn(state, c.parents[0])) continue;
    const u = childOf(state, c, assumptions);
    if (u) state.arriving.push(u);
  }
  const stop = !!step.armory?.length;
  if (shop && stop) rebuy(state, step, shop);
  promote(state, step, assumptions['class-change-internal-level']);
  if (shop?.kit && stop) buyKit(state, shop.kit());
  return new Map(step.mapOnly.map((a) => [a.id, liveOf(a)]));
}

/**
 * After map `at`: EXP and level-ups from its fights, support points from its combats together and the marriages they
 * make, the recruits and children who came during it, then (Chapter 11) Chrom's wedding.
 */
function afterMap(state: RunState, step: RunSimMap, at: number, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions, spent?: MapUpkeep) {
  if (spent) upkeep(state, step, spent);
  earn(state, step.map, play, rng, difficulty, assumptions);
  growSupports(state, play, at, assumptions['support-past-threshold']);
  for (const a of step.later) if (!state.army.has(a.id)) join(state, a);
  for (const u of state.arriving) if (!state.army.has(u.base.id)) state.army.set(u.base.id, u);
  state.arriving = [];
  state.cleared.add(step.map.id);
  if (step.map.id === CHROM_WEDDING_MAP) chromWedding(state, at, assumptions);
}

const pairKey = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** A fixed parent's spouse in the run: Chrom's is the Maiden until he marries (Lucina's other parent). */
const spouseIn = (state: RunState, u: RosterUnit): RosterUnit | 'maiden' | undefined => state.spouses.get(u) ?? (u === 'chrom' ? 'maiden' : undefined);

/** The plan's couples still to marry in the run: the map play keeps them together while that's safe (#184). */
const couplesToMarry = (state: RunState): (readonly [RosterUnit, RosterUnit])[] => [...state.couples.values()].filter(([a, b]) => !state.married.has(a) && !state.married.has(b));

/** Whether a pair can reach S in the run: married to each other, or a plan's couple with neither married yet. */
const sAllowed = (state: RunState, a: RosterUnit, b: RosterUnit): boolean =>
  state.spouses.get(a) === b || (state.couples.has(pairKey(a, b)) && !state.married.has(a) && !state.married.has(b));

/** The pair's rank in the run (S when married to each other), or null. */
function rankIn(state: RunState, a: RosterUnit, b: RosterUnit): SupportLevel | null {
  if (state.spouses.get(a) === b) return 'S';
  const points = state.supports.get(pairKey(a, b));
  const t = points ? pairThresholds(a, b, state.robin) : undefined;
  return t ? rankOf(points!, t, sAllowed(state, a, b)) : null;
}

/** A unit's supports in the run, as a deployment reads them. */
function supportsOf(state: RunState, id: RosterUnit): { partner: RosterUnit; rank: SupportLevel }[] {
  const out: { partner: RosterUnit; rank: SupportLevel }[] = [];
  for (const k of state.supports.keys()) {
    const [a, b] = k.split('+') as [RosterUnit, RosterUnit];
    if (a !== id && b !== id) continue;
    const partner = a === id ? b : a;
    const rank = rankIn(state, id, partner);
    if (rank) out.push({ partner, rank });
  }
  const spouse = state.spouses.get(id);
  if (spouse && spouse !== 'maiden' && !out.some((s) => s.partner === spouse)) out.push({ partner: spouse, rank: 'S' });
  return out;
}

/** A unit joins the army, its recorded supports seeding the run's points (each rank at its threshold). */
function join(state: RunState, a: ArmyUnit) {
  state.army.set(a.id, liveOf(a));
  for (const s of a.supports) {
    const t = pairThresholds(a.id, s.partner, state.robin);
    if (!t) continue;
    const k = pairKey(a.id, s.partner);
    state.supports.set(k, Math.max(state.supports.get(k) ?? 0, pointsOfRank(s.rank, t)));
  }
}

function marry(state: RunState, a: RosterUnit, b: RosterUnit | 'maiden', at: number | undefined) {
  state.spouses.set(a, b);
  state.married.add(a);
  if (b !== 'maiden') {
    state.spouses.set(b, a);
    state.married.add(b);
    const s = pairThresholds(a, b, state.robin)?.S;
    if (s !== undefined) state.supports.set(pairKey(a, b), s);
  }
  if (at !== undefined) state.weddings.set(pairKey(a, b), at);
}

/** Map `at`'s support points (`mapSupportGains`), then the plan's couples that reached S marry. */
function growSupports(state: RunState, play: MapPlay, at: number, rule: Assumptions['support-past-threshold']) {
  const together: Record<string, Readonly<Record<string, number>>> = {};
  for (const [id, t] of Object.entries(play.units)) together[id] = t.together;
  for (const g of mapSupportGains(together, state.robin)) {
    const k = pairKey(g.a, g.b);
    state.supports.set(k, addPoints(state.supports.get(k) ?? 0, g.points, pairThresholds(g.a, g.b, state.robin)!, sAllowed(state, g.a, g.b), rule));
  }
  for (const [a, b] of state.couples.values()) if (!state.married.has(a) && !state.married.has(b) && rankIn(state, a, b) === 'S') marry(state, a, b, at);
}

/** Chrom's wedding at the end of Chapter 11 when he's unmarried, by the game's rule over the run's points. */
function chromWedding(state: RunState, at: number, assumptions: Assumptions) {
  if (state.married.has('chrom')) return;
  const candidates: RosterUnit[] = [...CHROM_WEDDING_CANDIDATES, ...(state.robin === 'F' ? (['robin'] as const) : [])];
  const standing: Partial<Record<RosterUnit, ChromStanding>> = {};
  for (const c of candidates) {
    const t = pairThresholds('chrom', c, state.robin);
    if (!t) continue;
    const points = state.supports.get(pairKey('chrom', c)) ?? 0;
    const next = SUPPORT_LEVELS.map((r) => t[r]).find((need) => need !== undefined && need > points);
    standing[c] = { points, rank: rankOf(points, t, false), toNext: next === undefined ? Infinity : next - points };
  }
  const marriedElsewhere = new Set(candidates.filter((c) => state.married.has(c)));
  marry(state, 'chrom', chromWifeByPoints(candidates, marriedElsewhere, standing, assumptions), at);
}

/** Robin's gender, from the army or a recruit. */
const robinOf = (input: RunSimInput): Gender | undefined =>
  [...input.army, ...input.maps.flatMap((m) => [...m.joining, ...m.later])].find((a) => a.id === 'robin')?.gender;

function newState(input: RunSimInput): RunState {
  const state: RunState = {
    army: new Map(),
    masterSealsHeld: input.masterSealsHeld ?? 0,
    secondSealsHeld: input.secondSealsHeld ?? 0,
    gold: input.gold ?? 0,
    receipts: null,
    cleared: new Set(input.cleared ?? []),
    spouses: new Map(),
    married: new Set(),
    supports: new Map(),
    weddings: new Map(),
    couples: new Map((input.couples ?? []).map((c) => [pairKey(c[0], c[1]), c])),
    robin: robinOf(input),
    arriving: [],
  };
  for (const [a, b] of input.married ?? []) marry(state, a, b, undefined);
  for (const a of input.army) join(state, a);
  return state;
}

/** The lineup of a map no run enters. */
const NOBODY: Deployment = { max: 0, deployed: [], pairs: [], solo: [], forced: [] };

/** The plan's projection: each map's lineup, the uses it expects each unit to spend there, and the endpoint kit. */
type Plan = {
  readonly lineup: (i: number) => Deployment;
  readonly wear: (i: number) => MapUpkeep;
  readonly kit: () => readonly KitPiece[];
};

const NO_WEAR: MapUpkeep = new Map();

/**
 * The endpoint kit over the projection's army and the plan's endpoint lineup (`endpointKit`): its leads' weapons and
 * forges, and a Vulnerary for each unit it fields.
 */
function kitFor(state: RunState, step: RunSimMap, d: Deployment): KitPiece[] {
  const leads = [...d.pairs.map((p) => [p.lead, p.back] as const), ...d.solo.map((u) => [u, undefined] as const)].flatMap(([lead, back]) => {
    const u = state.army.get(lead);
    if (!u) return [];
    const b = back ? state.army.get(back) : undefined;
    return [{ unit: lead as string, fighter: fighterOf(u, shownStats(u)), weapons: u.weapons, back: b ? fighterOf(b, shownStats(b)) : undefined, support: b ? rankIn(state, lead, back!) : null }];
  });
  const deployed = d.deployed.flatMap((id) => {
    const u = state.army.get(id);
    return u ? [{ unit: id as string, items: u.items }] : [];
  });
  const foes = [...step.map.foes, ...step.map.waves.flatMap((w) => w.groups)].map((g) => g.foe);
  return endpointKit({ leads, deployed, foes, stock: step.armory ?? [] });
}

/**
 * The plan's projection: the map order walked with average growths (no rolls), each map's lineup the suggested
 * deployment over the army as that projection has it there, the uses that play is expected to spend (`mapUpkeep`
 * without draws: the rebuys' guide; the projection itself never runs dry, and buys what it needs), and at the endpoint
 * the kit. Lunatic+ skills are drawn from `seed`. Walked only as far as asked, so maps no run reaches cost nothing.
 */
function planner(input: RunSimInput, seed: number, assumptions: Assumptions): Plan {
  const state = newState(input);
  state.gold = Infinity;
  const interner = newInterner();
  const done: Deployment[] = [];
  const wear: MapUpkeep[] = [];
  const last = input.maps.length - 1;
  let kit: KitPiece[] = [];
  const walk = (i: number) => {
    while (done.length <= i) {
      const k = done.length;
      const step = input.maps[k]!;
      const extra = beforeMap(state, step, assumptions);
      if (!extra) {
        done.push(NOBODY);
        wear.push(NO_WEAR);
        continue;
      }
      const pools = new Map<Foe, readonly string[]>(step.map.foes.map((g) => [g.foe, g.pool ?? []]));
      const here = (u: RosterUnit) => state.army.has(u) || extra.has(u);
      const leads = (u: RosterUnit) => step.forced.includes(u) || (state.army.get(u) ?? extra.get(u))!.base.role === 'lead';
      // The plan pairs each couple it marries until they marry (#188), the one that leads in front.
      const pinned = [...state.couples.values()]
        .filter(([a, b]) => here(a) && here(b) && !state.married.has(a) && !state.married.has(b))
        .map(([a, b]) => (leads(b) && !leads(a) ? { lead: b, back: a } : { lead: a, back: b }));
      const max = step.deploy || state.army.size + extra.size;
      const planned = input.lineups?.[k];
      const d = planned
        ? plannedDeployment(planned, step.forced, max, here, (a, b) => rankIn(state, a, b))
        : suggestDeployment({
            candidates: candidatesOf(state, extra),
            forced: step.forced,
            pinned,
            max,
            foes: step.map.foes.map((g) => g.foe),
            pool: (f) => pools.get(f) ?? [],
          });
      if (k === last && step.armory?.length) kit = kitFor(state, step, d);
      const lineup = lineupOf(state, d, extra, interner);
      const play = playMap({ map: step.map, lineup, bonds: couplesToMarry(state) }, runSeed(seed, k));
      wear.push(mapUpkeep(step.map, play, lineup, null, assumptions['tome-miss-use']));
      afterMap(state, step, k, play, null, input.difficulty, assumptions);
      done.push(d);
    }
  };
  return {
    lineup: (i) => (walk(i), done[i]!),
    wear: (i) => (walk(i), wear[i]!),
    kit: () => (walk(last), kit),
  };
}

/**
 * A plan's lineup for a map (#198) as the deployment the runs play: its pairs and units alone as it names them, less
 * any unit not in the army there (a Back whose Lead is missing fights alone), forced units added alone, within the
 * deploy count (forced units first). Pairs aren't scored: their coverage reads 0.
 */
function plannedDeployment(
  plan: LineupPlan,
  forced: readonly RosterUnit[],
  max: number,
  here: (u: RosterUnit) => boolean,
  rank: (a: RosterUnit, b: RosterUnit) => SupportLevel | null,
): Deployment {
  const room = Math.max(max, forced.filter(here).length);
  const deployed: RosterUnit[] = forced.filter(here);
  const taken = new Set<RosterUnit>();
  const fits = (n: number) => deployed.length + n <= room;
  const add = (u: RosterUnit) => {
    taken.add(u);
    if (!deployed.includes(u)) deployed.push(u);
  };
  const cost = (u: RosterUnit) => (deployed.includes(u) ? 0 : 1);
  const pairs: Pair[] = [];
  for (const p of plan.pairs) {
    const lead = here(p.lead) && !taken.has(p.lead) ? p.lead : undefined;
    const back = p.back && here(p.back) && !taken.has(p.back) ? p.back : undefined;
    const [l, b] = lead ? [lead, back] : [back, undefined];
    if (!l || !fits(cost(l) + (b ? cost(b) : 0))) continue;
    add(l);
    if (b) add(b);
    pairs.push({ lead: l, back: b, support: b ? rank(l, b) : null, coverage: 0 });
  }
  const solo: RosterUnit[] = [];
  for (const u of [...plan.solo, ...forced]) {
    if (!here(u) || taken.has(u) || !fits(cost(u))) continue;
    add(u);
    solo.push(u);
  }
  return { max, deployed, pairs, solo, forced: forced.filter(here) };
}

/** The plan's lineup for every map (see `planner`). */
export function planLineups(input: RunSimInput, seed: number, assumptions: Assumptions): Deployment[] {
  const plan = planner(input, seed, assumptions);
  return input.maps.map((_, i) => plan.lineup(i));
}

/**
 * A run whose chance of having lost nobody falls below this has lost a unit: it stops there (its later maps would
 * move the flawless chance by less than this), which keeps runs that fail early cheap.
 */
const LOST = 1e-9;

type Endpoint = Map<RosterUnit, { name: string; skills: readonly string[]; classes: Map<string, { runs: number; caps: Record<Stat, number>; levelCap: number }>; level: number[]; exp: number[]; stats: Record<Stat, number[]> }>;

/** One run's army entering the endpoint, for the expected stats' spread. */
function recordEndpoint(atEnd: Endpoint, state: RunState) {
  for (const u of state.army.values()) {
    let e = atEnd.get(u.base.id);
    if (!e) atEnd.set(u.base.id, (e = { name: u.base.name, skills: u.base.skills, classes: new Map(), level: [], exp: [], stats: Object.fromEntries(STATS.map((s) => [s, []])) as unknown as Record<Stat, number[]> }));
    const cls = className(u.classId, u.base.gender);
    const c = e.classes.get(cls);
    e.classes.set(cls, { runs: (c?.runs ?? 0) + 1, caps: c?.caps ?? capsOf(u), levelCap: levelCap(u.tier) });
    e.level.push(u.level);
    e.exp.push(u.exp);
    for (const s of STATS) e.stats[s].push(u.stats[s]);
  }
}

/** Supports and marriages entering the endpoint: each pair's points and each marriage's map, one slot per run recorded. */
type Bonds = { runs: number; readonly points: Map<string, number[]>; readonly weddings: Map<string, { a: RosterUnit; b: RosterUnit | 'maiden'; at: (number | undefined)[] }> };

function recordBonds(bonds: Bonds, state: RunState) {
  const r = bonds.runs++;
  for (const [k, points] of state.supports) {
    let xs = bonds.points.get(k);
    if (!xs) bonds.points.set(k, (xs = []));
    xs[r] = points;
  }
  for (const [a, b] of state.spouses) {
    if (b !== 'maiden' && b < a) continue;
    const k = pairKey(a, b);
    let w = bonds.weddings.get(k);
    if (!w) bonds.weddings.set(k, (w = { a, b, at: [] }));
    w.at.push(state.weddings.get(k));
  }
}

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

/** The stream a run's hits are drawn from (#190): apart from its maps' seeds and its level-up rolls. */
const WEAR_STREAM = 1 << 20;

function goldSpread(xs: readonly number[]): GoldSpread {
  const sorted = [...xs].sort((a, b) => a - b);
  return { low: quantile(sorted, 0.1), median: quantile(sorted, 0.5), high: quantile(sorted, 0.9) };
}

type StopTally = { runs: number; readonly gold: number[]; readonly lines: Map<string, { receipt: Receipt; runs: number }> };

/** One run's arrival and purchases at a stop: each line counted once a run. */
function recordStop(s: StopTally, gold: number, receipts: readonly Receipt[] | null) {
  s.runs++;
  s.gold.push(gold);
  const seen = new Set<string>();
  for (const r of receipts ?? []) {
    const k = `${r.kind}|${r.action}|${r.item}|${r.unit}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const line = s.lines.get(k);
    if (line) line.runs++;
    else s.lines.set(k, { receipt: r, runs: 1 });
  }
}

const KIND_ORDER: Readonly<Record<ShoppingLine['kind'], number>> = { rebuy: 0, seal: 1, kit: 2 };

/** A stop's shopping list: its lines in priority order (rebuys, seals, kit), the likeliest first within each. */
function shoppingStop(step: RunSimMap, s: StopTally): ShoppingStop {
  const lines = [...s.lines.values()]
    .map(({ receipt, runs }) => ({ ...receipt, share: runs / s.runs }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.share - a.share || a.name.localeCompare(b.name) || Number(a.action === 'forge') - Number(b.action === 'forge'));
  return { key: step.key, label: step.label, gold: goldSpread(s.gold), runs: s.runs, lines };
}

/**
 * The flawless chance over `runs` simulated runs from `seed` (see the module comment). The same input, seed and run
 * count give the same result; more runs narrow the margin.
 */
export function simulateRuns(input: RunSimInput, seed: number, runs: number, assumptions: Assumptions): RunSim {
  const n = Math.max(1, Math.floor(runs));
  const plan = planner(input, seed, assumptions);
  const lineups: (Deployment | undefined)[] = input.maps.map(() => undefined);
  const interner = newInterner();
  const samples: number[] = [];
  const reach = input.maps.map(() => 0);
  const noDeath = input.maps.map(() => 0);
  const turns = input.maps.map(() => 0);
  const atEnd: Endpoint = new Map();
  const bonds: Bonds = { runs: 0, points: new Map(), weddings: new Map() };
  const spots = new Set<BlindSpotId>();
  const last = input.maps.length - 1;
  // Gold at each map's end, and each armory stop's arrivals and purchases (#190).
  const golds: number[][] = input.maps.map(() => []);
  const stops = input.maps.map(() => ({ runs: 0, gold: [] as number[], lines: new Map<string, { receipt: Receipt; runs: number }>() }));
  // Each stop's next stop: a rebuy covers what the plan spends until then.
  const nextStop = input.maps.map((_, i) => {
    let j = i + 1;
    while (j <= last && !input.maps[j]!.armory?.length) j++;
    return j;
  });
  const need = (i: number) => (unit: RosterUnit, item: string) => {
    let spend = 0;
    for (let j = i; j < nextStop[i]!; j++) spend += plan.wear(j).get(unit)?.get(item) ?? 0;
    return spend;
  };
  for (let r = 0; r < n; r++) {
    const rs = runSeed(seed, r);
    const rng = createRng(rs);
    // Hits are drawn from their own stream, so upkeep never moves the level-up rolls.
    const hits = createRng(runSeed(rs, WEAR_STREAM));
    const state = newState(input);
    let flawless = 1;
    for (let i = 0; i <= last; i++) {
      // A run that has lost a unit adds nothing more to the chance, the maps' chances or the endpoint's stats.
      if (flawless < LOST) break;
      const step = input.maps[i]!;
      const arriving = state.gold;
      state.receipts = [];
      const extra = beforeMap(state, step, assumptions, { need: need(i), ...(i === last ? { kit: plan.kit } : {}) });
      const receipts = state.receipts;
      state.receipts = null;
      if (i === last) {
        recordEndpoint(atEnd, state);
        recordBonds(bonds, state);
      }
      // A child paralogue whose gates don't hold in this run isn't played.
      if (!extra) continue;
      if (step.armory?.length) recordStop(stops[i]!, arriving, receipts);
      const lineup = lineupOf(state, (lineups[i] ??= plan.lineup(i)), extra, interner);
      const play = playMap({ map: step.map, lineup, bonds: couplesToMarry(state) }, runSeed(rs, i));
      reach[i]! += flawless;
      noDeath[i]! += flawless * play.noDeath;
      turns[i]! += flawless * play.turns;
      flawless *= play.noDeath;
      for (const b of play.blindSpots) spots.add(b);
      afterMap(state, step, i, play, rng, input.difficulty, assumptions, mapUpkeep(step.map, play, lineup, hits, assumptions['tome-miss-use']));
      golds[i]!.push(state.gold);
    }
    samples.push(flawless < LOST ? 0 : flawless);
  }
  const chance = samples.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? samples.reduce((a, b) => a + (b - chance) ** 2, 0) / (n - 1) : 0;
  const spread = (xs: number[], cap: number): StatSpread => {
    const sorted = [...xs].sort((a, b) => a - b);
    return { low: quantile(sorted, 0.1), median: quantile(sorted, 0.5), high: quantile(sorted, 0.9), cap };
  };
  return {
    chance,
    margin: 1.96 * Math.sqrt(variance / n),
    runs: n,
    samples,
    blindSpots: [...spots, ...RUN_BLIND_SPOTS],
    maps: input.maps.map((m, i) => ({
      key: m.key,
      label: m.label,
      reach: reach[i]! / n,
      noDeath: reach[i]! > 0 ? noDeath[i]! / reach[i]! : undefined,
      lineup: lineups[i],
      turns: reach[i]! > 0 ? turns[i]! / reach[i]! : undefined,
      gold: golds[i]!.length ? goldSpread(golds[i]!) : undefined,
    })),
    shopping: stops.flatMap((s, i) => (s.runs ? [shoppingStop(input.maps[i]!, s)] : [])),
    units: [...atEnd.entries()].map(([id, e]) => {
      const [cls, { caps, levelCap: top }] = [...e.classes.entries()].sort((a, b) => b[1].runs - a[1].runs)[0]!;
      return {
        id,
        name: e.name,
        className: cls,
        level: spread(e.level, top),
        exp: spread(e.exp, 100).median,
        stats: Object.fromEntries(STATS.map((s) => [s, spread(e.stats[s], caps[s])])) as Record<Stat, StatSpread>,
        skills: e.skills,
      };
    }),
    ...bondsOf(bonds, input, spread, sAllowedAtEnd(input)),
  };
}

/** Whether a pair's forecast rank can be S: the plan's couples and the recorded marriages. */
const sAllowedAtEnd = (input: RunSimInput) => {
  const keys = new Set([...(input.couples ?? []), ...(input.married ?? [])].map(([a, b]) => pairKey(a, b)));
  return (k: string) => keys.has(k);
};

function bondsOf(bonds: Bonds, input: RunSimInput, spread: (xs: number[], cap: number) => StatSpread, canS: (k: string) => boolean): Pick<RunSim, 'supports' | 'marriages'> {
  const robin = robinOf(input);
  const supports: SupportForecast[] = [];
  for (const [k, xs] of bonds.points) {
    const [a, b] = k.split('+') as [RosterUnit, RosterUnit];
    const t = pairThresholds(a, b, robin);
    if (!t) continue;
    const all = Array.from({ length: bonds.runs }, (_, i) => xs[i] ?? 0);
    const married = bonds.weddings.get(k)?.at.length ?? 0;
    const ranks = new Map<SupportLevel | null, number>();
    all.forEach((p) => {
      const r = rankOf(p, t, canS(k) || married > 0);
      ranks.set(r, (ranks.get(r) ?? 0) + 1);
    });
    const rank = [...ranks.entries()].sort((x, y) => y[1] - x[1])[0]![0];
    supports.push({ a, b, points: spread(all, t.S !== undefined && canS(k) ? t.S : t.A), rank });
  }
  const marriages: MarriageForecast[] = [...bonds.weddings.values()].map((w) => {
    const made = w.at.filter((x): x is number => x !== undefined).sort((x, y) => x - y);
    return { a: w.a, b: w.b, share: w.at.length / Math.max(1, bonds.runs), after: made.length ? input.maps[quantile(made, 0.5)]!.key : undefined };
  });
  return { supports, marriages };
}
