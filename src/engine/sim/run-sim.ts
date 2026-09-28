/**
 * The flawless chance of today's plan across the map order (#186; spec #175, The objective, Noise, and EXP, supports
 * and internal level; ADR 0001). Every map from the next one to the endpoint is played (`playMap`) by the plan's lineup
 * for it; what changes the route between maps is sampled: each unit's EXP from its combats (`combatExp` at its internal
 * level), and its level-ups one at a time from its growths (personal plus class), clamped at its effective caps. Each
 * simulated run carries the product of its maps' no-death chances (a map its play can't win in `MAX_TURNS` counts as
 * lost: the plan isn't shown to clear it); the flawless chance is their mean, with its simulation error (±, 95%).
 *
 * The plan: each map's lineup is today's suggested deployment (`suggestDeployment`, as the preparation page picks it)
 * over the army as a projection with average growths would have it on that map. It is chosen once and every run plays
 * it, so runs differ only by their rolls, as edits compared on the same runs need.
 *
 * Cost: a run stops at the map where it has lost a unit (its chance of nobody lost falls below `LOST`), and the plan's
 * lineups are worked out only as far as some run gets, so a plan that fails early is cheap, and a play stops once its
 * run is lost (`stopBelow`). A run that plays every map of the Main story costs about 0.2–0.3 s, and the plan's
 * projection about 0.4–0.6 s, shared by every seed when no map draws Lunatic+ skills (the anytime solve's worker, #199,
 * takes that off the page).
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
 * dry; the nearest weapon of its kind sold when the item itself isn't), seals (a Master Seal at its armory price only
 * when a promotion needs one and the run holds none), then on the way the weapons and Vulneraries that arm the map's
 * lineup better (the projection's `kitFor` off the shelf, within the ranks `wields` reads, keeping the gold the plan's
 * seals still need: `arms-on-the-way`), and at the endpoint the endpoint kit (`endpointKit`, trimmed by `buyDown` when
 * gold is short). A purchase the run can't afford is
 * skipped; a weapon at 0 uses is gone, a rebuy restores it unforged. Each stop's purchases are reported with the share of
 * runs that made them (`shopping`), and each map's gold at its end as a spread.
 *
 * Side goals (#191): a map's side goals the plan chases cost actions in its play (`MapPlayInput.chase`); each part whose
 * actions were spent in time pays the run (its Bullion sold, gold, free seals), and each goal reports the share of runs
 * that secured all of it (`sideGoals`). A skipped one is never counted. Renown's rewards come in as sure income.
 *
 * Class changes (#194) are the roadmap's class-reached milestones (`seals`, see `class-changes.ts`): each is used in the
 * preparations after its unit reaches its level cap, or before the map that needs the class, whichever comes first,
 * from Lv 10, with a seal held or bought there. Each unit's learned skills are tracked (its class's skills as it levels
 * and changes class), so a parent passes the skill the plan names at its child's paralogue entry only when it has
 * learned it by then in that run; otherwise its bottom skill passes, as the game has it.
 *
 * Held items (#193): each run holds its boosters, tonics and convoy weapons (`held`, then each map's `finds` after it:
 * a find tied to a side goal's part arrives only when that part is secured). In a map's preparations (none on the early
 * forced maps) the plan's uses (`uses`) are made when the run holds the item: a booster adds +2 (+5 HP) to its unit's
 * stats from then on, clamped at its caps (`booster-at-cap`), before children are read on entry (`booster-to-child`); a
 * weapon goes to its carrier; then, at the shopping, a tonic adds as much for this map only (past the cap; the same tonic
 * twice per `tonic-stacking`), a held one first, else bought where an open armory sells it (`item-in-preparations`).
 * Each use reports the share of runs that made it (`items`): its arrival chance, for an item only some runs hold.
 */
import { CLASSES, type ClassId, type ClassTier } from '../../game-data/classes';
import { STATS, type Gender, type Growths, type Modifiers, type Stat } from '../../game-data/stats';
import type { Assumptions, BlindSpotId, RunBlindSpotId } from '../assumptions';
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import { CLASS_SKILLS, SKILLS, type SkillId } from '../../game-data/skills';
import type { PlanPriority, PlanSeal } from '../solve/plan';
import { pinnedLineup, rulesBroken, type LineupRule } from '../solve/pins';
import { SEAL_LEVEL, classChangeGains, plannedSeals, sealReaches } from './class-changes';
import { childJoinStats, classBaseStats, type JoinParent } from '../child-join';
import { childParalogueGates, isChildParalogue } from '../child-paralogues';
import { childSkills, type SkillParent } from '../child-skills';
import { classGrowths, className, effectiveCaps } from '../classes';
import { leadsByDefault, suggestDeployment, type DeployCandidate, type Deployment, type Pair } from '../deploy';
import { COUNT_CAP, combatExp, danceExp, mapExpFoe, secondSealCount, staffExp, tierBonus, type ExpFoe } from '../exp';
import type { Difficulty, RosterUnit } from '../roster';
import type { Fighter, Foe, SupportLevel } from '../solver';
import { CHROM_WEDDING_CANDIDATES, CHROM_WEDDING_MAP } from '../../game-data/supports';
import { chromWifeByPoints, type ChromStanding } from '../chrom-wedding';
import { SUPPORT_LEVELS } from '../run';
import { addPoints, mapSupportGains, pairThresholds, pointsOfRank, rankOf } from './support-growth';
import { playMap, type ExpPriority, type MapPlay, type MapPlayInput, type SimChase, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit, type StressCase } from './map-play';
import { createRng, runSeed, type Rng } from './random';
import type { SimItem } from './sustain';
import { STAT_BOOSTERS, TONICS, itemByName, statItemGain, type GameItem } from '../../game-data/items';
import type { StockItem } from '../supply';
import { buyDown, endpointKit, forgedWeapon, freshWeapon, mapUpkeep, type KitPiece, type MapUpkeep } from './upkeep';
import { classWeaponKinds } from '../supply';
import { foesOfMap, loadout } from './loadout';

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
  /**
   * The skill the plan has each parent pass (#198), fixed parent first: passed only when the parent has learned it by
   * entry in the run (#194); otherwise its bottom skill passes.
   */
  readonly passes?: readonly [SkillId | undefined, SkillId | undefined];
  /** Morgan's start class (its other parent's); every other child joins in its fixed class. */
  readonly startClass?: ClassId;
  readonly growths: Growths;
  readonly modifiers: Modifiers;
  readonly weapons: readonly Weapon[];
  readonly items?: readonly SimItem[];
  /**
   * A parent who died after marrying (#208, `child-after-parent-death`): its stats, class and skills from before the
   * loss, read in its place (it isn't in the army), fixed parent first. Its pass is frozen: its fixed pass, else its
   * bottom skill.
   */
  readonly lost?: readonly [LostParent | undefined, LostParent | undefined];
};

/** A parent lost after marrying, as it stood at its death (#208). */
export type LostParent = { readonly stats: Readonly<Record<Stat, number>>; readonly classId: ClassId; readonly gender: Gender; readonly skills: readonly string[] };

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
  /** Its side goals (#191): each chased or skipped by the plan, paying per part when the play spends its actions in time. */
  readonly sideGoals?: readonly RunSimSideGoal[];
  /** Held items picked up on it (#193): the run's from the next map (a side goal's only when its part is secured). */
  readonly finds?: readonly ItemFind[];
  /** The plan's item uses in its preparations (#193), in order. */
  readonly uses?: readonly SimItemUse[];
  /** The map has no preparation phase (the early forced maps): no item is used and nothing is bought before it. */
  readonly noPreparations?: boolean;
};

/**
 * A held item a run can use (#193): a booster, tonic or other item, or a weapon with its own forge and uses left.
 * `holder` is the unit that holds a weapon at the start (it's already among that unit's weapons); absent: the convoy.
 */
export type ItemSource = {
  readonly id: string;
  readonly item: string;
  readonly weapon?: Weapon;
  readonly uses?: number;
  readonly holder?: RosterUnit;
};

/** An item picked up on a map (#193): sure, or only when the side goal part `part` (a `SimChase` id) is secured. */
export type ItemFind = ItemSource & { readonly part?: string };

/**
 * A planned item use in a map's preparations (#193, the plan's `PlanItem`): drink a booster, drink (or buy) a tonic,
 * or hand a weapon to its carrier. `source` names the copy (an `ItemSource` id; `buy` for a tonic to buy).
 */
export type SimItemUse = { readonly kind: 'booster' | 'tonic' | 'carry'; readonly item: string; readonly unit: RosterUnit; readonly source: string };

/** A planned item use over the runs (#193). */
export type ItemUseForecast = SimItemUse & {
  /** The map's key and label. */
  readonly key: string;
  readonly label: string;
  /**
   * The share of the runs playing the map with nobody lost before it in which the use was made (the item held, or a
   * tonic bought): an item that arrives only sometimes reads its arrival chance here. Undefined when none gets there.
   */
  readonly share: number | undefined;
};

/** A side goal as a run plays it (#191): chased parts cost actions in the play (`SimChase`); each secured part pays. */
export type RunSimSideGoal = {
  readonly id: string;
  readonly label: string;
  readonly chase: boolean;
  readonly parts: readonly { readonly chase: SimChase; readonly gold: number; readonly seals: { readonly master: number; readonly second: number } }[];
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
  /** Held items at the start (#193): boosters, tonics and convoy weapons, and weapons the plan may hand from their holders. */
  readonly held?: readonly ItemSource[];
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
  /**
   * The plan's class changes (#194), each needed by its map (`key`); a unit with none never changes class. Absent: each
   * unit in a base class reaches its best promotion by the endpoint (`plannedSeals`).
   */
  readonly seals?: readonly PlanSeal[];
  /**
   * Units that fight in the runs but take none of their sustain, Dance, Rally or Rescue actions (#202, a unit's
   * utility). The plan's projection still plays them in full, so the lineups are the plan's.
   */
  readonly idle?: readonly RosterUnit[];
  /**
   * The pins' lineup rules (#200), by map in `maps` order (`lineupRules`): every lineup the runs play there, named by
   * the plan or greedy, keeps them (`pinnedLineup`).
   */
  readonly pins?: readonly (readonly LineupRule[] | undefined)[];
  /**
   * Each map's EXP priorities (#195), by map in `maps` order and unit: who lands kills in its play (`MapPlayInput.priority`).
   * Absent, or a map without one: everyone normal.
   */
  readonly priority?: readonly (Readonly<Partial<Record<RosterUnit, ExpPriority>>> | undefined)[];
  /** The roadmap's milestones (#194) as the runs check them (#195): each one's chance of being met is counted over the runs. */
  readonly milestones?: readonly MilestoneCheck[];
  /**
   * The plan's build for each unit (#198, the wishlist's), by unit: each skill of it is equipped once the unit has learned
   * it (the realism pass), the rest of its five slots its recorded skills. Absent: units keep the skills they have.
   */
  readonly builds?: Readonly<Partial<Record<RosterUnit, readonly SkillId[]>>>;
  /**
   * The learned corrections (#196), by unit: each EXP the unit earns on these maps (all after the last recorded one) is
   * multiplied by its factor. Absent, or a unit without one: ×1.
   */
  readonly expFactor?: Readonly<Partial<Record<RosterUnit, number>>>;
  /**
   * A stated blind spot's bad case (#211, the stress test): each run plays its maps under it (`MapPlayInput.stress`).
   * The plan's projection doesn't: the lineups are the plan's, as without it.
   */
  readonly stress?: StressCase;
};

/**
 * A lineup a plan names for one map (#198): its pairs (a Lead, and its Back if any) and its units alone. A pair a span
 * pin keeps (`kept`, #195) stays paired in the play while that's safe, as a couple still to marry does.
 */
export type LineupPlan = {
  readonly pairs: readonly { readonly lead: RosterUnit; readonly back?: RosterUnit; readonly kept?: boolean }[];
  readonly solo: readonly RosterUnit[];
};

/**
 * A milestone (#194) as a run checks it (#195): whether it holds in the run at its point on the map order (map `index`'s
 * start, after its preparations, or its end): a skill learned, a class reached, a pair at S (or married), a child
 * recruited.
 */
export type MilestoneCheck = {
  readonly id: string;
  readonly index: number;
  readonly when: 'start' | 'end';
  /** Who it counts against; a suggested change is for the first. */
  readonly units: readonly RosterUnit[];
  readonly test:
    | { readonly kind: 'skill'; readonly unit: RosterUnit; readonly skill: SkillId }
    | { readonly kind: 'class'; readonly unit: RosterUnit; readonly classId: ClassId }
    | { readonly kind: 'support'; readonly pair: readonly [RosterUnit, RosterUnit] }
    | { readonly kind: 'recruit'; readonly child: RosterUnit };
};

/** A milestone's chance (#195): the share of the runs reaching its point with nobody lost in which it holds. */
export type MilestoneChance = {
  readonly id: string;
  /** Undefined when no run reaches its point. */
  readonly chance: number | undefined;
  readonly runs: number;
  /** A skill or class milestone: the unit's median level there (in the class it's in; undefined when not in the army). */
  readonly level: number | undefined;
};

/**
 * One map of the EXP forecast (#195), over the runs that play it with nobody lost before it: each fielded unit's
 * expected EXP, its level at the map's end, and the kills it lands per foe group (a mean over runs; never which foe on
 * which turn).
 */
export type MapExp = {
  readonly key: string;
  readonly label: string;
  readonly runs: number;
  /** The map's foe groups (as the first run met them), by key. */
  readonly groups: readonly { readonly key: string; readonly name: string; readonly className: string; readonly count: number }[];
  readonly units: readonly UnitExp[];
};

export type UnitExp = {
  readonly unit: RosterUnit;
  readonly name: string;
  readonly priority: ExpPriority;
  /** Mean EXP earned on the map (combat, Dual Strikes, staves, Dances; before the level cap takes any). */
  readonly exp: number;
  /** Its level at the map's end, with EXP as the fraction (Lv 5, 40 EXP → 5.4): 10th percentile, median, 90th. */
  readonly level: { readonly low: number; readonly median: number; readonly high: number };
  /** Mean kills per run, by foe group key (groups it never fells are left out). */
  readonly kills: Readonly<Record<string, number>>;
};

/**
 * A plan's EXP priorities (#195) as the runs read them: by map in `maps` order, each unit's priority there. A span whose
 * keys aren't on the order is dropped; a later span overrides an earlier one where they overlap. Span pins win where
 * they overlap (#200, `rules`: each map's lineup rules): a unit a pin keeps out, or as a Back, has no priority there
 * (it lands no kills of its own).
 */
export function priorityByMap(
  maps: readonly { readonly key: string }[],
  spans: readonly PlanPriority[],
  rules?: readonly (readonly LineupRule[] | undefined)[],
): (Partial<Record<RosterUnit, ExpPriority>> | undefined)[] {
  const out: (Partial<Record<RosterUnit, ExpPriority>> | undefined)[] = maps.map(() => undefined);
  const index = new Map(maps.map((m, i) => [m.key, i]));
  for (const p of spans) {
    const from = index.get(p.from);
    const to = index.get(p.to);
    if (from === undefined || to === undefined) continue;
    for (let i = from; i <= to; i++) {
      if (rules?.[i]?.some((r) => r.unit === p.unit && (r.position === 'out' || r.position === 'back'))) continue;
      out[i] = { ...out[i], [p.unit]: p.priority };
    }
  }
  return out;
}

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
   * The share of those runs (weighted the same way) in which the play ran out of turns with the map unwon (`stalled`):
   * the plan isn't shown to clear it there, so those runs count it as lost (`noDeath` reads 0 for them).
   */
  readonly stalled: number | undefined;
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
  /**
   * Why: a rebuy of an item running dry (or the nearest weapon of its kind sold, when it isn't), a seal a promotion
   * needs, a tonic the item plan drinks (#193), a weapon or Vulnerary re-arming the lineup for this map on the way
   * (`arms`), or a piece of the endpoint kit.
   */
  readonly kind: 'rebuy' | 'seal' | 'tonic' | 'arms' | 'kit';
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

/** A side goal over the runs (#191). */
export type SideGoalForecast = {
  readonly id: string;
  readonly label: string;
  /** The map's key. */
  readonly key: string;
  readonly chase: boolean;
  /**
   * The share of the runs that play its map with nobody lost before it in which every part is secured (0 when
   * skipped); undefined when no run gets there.
   */
  readonly secured: number | undefined;
};

export type RunSim = {
  /** The flawless chance: the mean over runs of each run's product of no-death chances. */
  readonly chance: number;
  /** Its simulation error: 1.96 standard errors (95%). */
  readonly margin: number;
  readonly runs: number;
  /** Each run's flawless chance, in run order, for paired comparisons on the same runs. */
  readonly samples: readonly number[];
  /** Each run's turns, over the maps it played until it lost a unit, in run order (ties go to fewer expected turns). */
  readonly turnSamples: readonly number[];
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
  /** Each side goal on the maps ahead, in map order (#191). */
  readonly sideGoals: readonly SideGoalForecast[];
  /** Each planned item use on the maps ahead, in map order (#193). */
  readonly items: readonly ItemUseForecast[];
  /**
   * The likely losses (#202): each unit's share of the chance lost, over the runs. A map's lost chance (the run's chance
   * of getting there, less its chance of getting through) is split among the units that fought on it by each one's
   * death risk there (the log of its fights' survival); a unit's chance here is how often the runs lose it. Units with
   * none aren't listed; most lost first.
   */
  readonly losses: readonly { readonly unit: string; readonly chance: number }[];
  /** The EXP forecast (#195): each map some run played with nobody lost before it, in map order. */
  readonly exp: readonly MapExp[];
  /** Each of the input's milestones, its chance over the runs (#195). */
  readonly milestones: readonly MilestoneChance[];
  /** The stated blind spots it rests on: the map simulation's, then the run simulation's own. */
  readonly blindSpots: readonly (BlindSpotId | RunBlindSpotId)[];
};

/** The run simulation's own blind spots (see BLIND_SPOTS): what it simplifies between maps. */
const RUN_BLIND_SPOTS: readonly RunBlindSpotId[] = ['class-change-at-cap', 'exp-from-likely-play', 'supports-from-pair-combats', 'side-goal-actions', 'kit-by-matchups-won', 'arms-on-the-way', 'loadout-for-the-map'];

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
  /**
   * Skills it has learned (#194): its equipped ones, its class's up to its level, and each class's as it levels and
   * changes class in the run. Skills of classes before the log's aren't known.
   */
  readonly learned: Set<SkillId>;
  /** Its equipped skills, by name: the plan's build as far as it has learned it, then its recorded ones (`equip`). */
  skills: readonly string[];
  /** Tonics drunk for this map (#193): added to its shown stats until the map's end. */
  boost: Partial<Record<Stat, number>>;
  /** What its boosters added (#193), for a child that doesn't read them (`booster-to-child`). */
  readonly drunk: Partial<Record<Stat, number>>;
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
  /** The plan's class changes (#194), shared by every run, and those this run has made (by index). */
  readonly classChanges: readonly ClassChange[];
  readonly changed: Set<number>;
  /** Held items not in a unit's hands (#193): boosters, tonics and convoy weapons, by source id. */
  readonly pool: Map<string, ItemSource>;
  /** Who holds each held weapon handed out or held from the start (#193), by source id. */
  readonly carriers: Map<string, RosterUnit>;
  /** Which of this map's planned uses were made (#193), in `uses` order. */
  made: boolean[];
  /** The plan's builds (`RunSimInput.builds`). */
  readonly builds: RunSimInput['builds'];
  /** The learned corrections (`RunSimInput.expFactor`). */
  readonly expFactor: RunSimInput['expFactor'];
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
function capsOf(u: Live): Readonly<Record<Stat, number>> {
  return effectiveCaps(u.classId, u.base.gender, u.base.modifiers, u.skills.includes('Limit Breaker'));
}

/** Weapons' ids for the interner's keys (a weapon object is shared across runs). */
const WEAPON_IDS = new WeakMap<Weapon, number>();
let nextWeaponId = 0;
const weaponId = (w: Weapon) => WEAPON_IDS.get(w) ?? (WEAPON_IDS.set(w, ++nextWeaponId), nextWeaponId);

/** An item's full uses: none (unbreakable) is endless. */
const fullUses = (item: GameItem) => item.uses ?? Infinity;

/** Weapon ranks, lowest first (the item data's `rank`). */
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

/**
 * Whether a unit can wield a weapon off the shelf (`weapon-rank-by-level`): the simulation keeps no weapon EXP, so a
 * unit's rank in a kind is read as the best it holds there, or what its level and tier suggest when that's higher
 * (a base class D, C from Lv 10; an advanced or special class B, A from Lv 10).
 */
function wields(u: Live, item: GameItem): boolean {
  if (item.only) return false;
  // Stones have no rank: whoever's class takes them wields them.
  const need = RANKS.indexOf(item.rank ?? '');
  if (need < 0) return !item.rank;
  const byLevel = (u.tier === 'base' ? 1 : 3) + (u.level >= 10 ? 1 : 0);
  let held = -1;
  for (const g of u.gear) if (g.weapon.item.kind === item.kind) held = Math.max(held, RANKS.indexOf(g.weapon.item.rank ?? ''));
  return need <= Math.max(held, byLevel);
}

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
    learned: new Set(a.skills.flatMap((n) => SKILL_BY_NAME.get(n) ?? [])),
    skills: a.skills,
    boost: {},
    drunk: {},
  };
  for (const s of CLASS_SKILLS[a.classId]) if (s.level <= a.level) u.learned.add(s.skill);
  refresh(u);
  return u;
}

const SKILL_BY_NAME = new Map(Object.entries(SKILLS).map(([id, s]) => [s.name, id as SkillId]));

/** Skills a unit can equip at once. */
const SKILL_SLOTS = 5;

/**
 * Its equipped skills (the realism pass): each skill of the plan's build it has learned, in the build's order, then its
 * recorded skills, five at most. The combat math reads them (Dual Strike+, Limit Breaker, Veteran, Healtouch, Rally…).
 */
function equip(u: Live, build: readonly SkillId[] | undefined) {
  if (!build?.length) return;
  const out: string[] = [];
  for (const id of build) if (u.learned.has(id) && !out.includes(SKILLS[id].name)) out.push(SKILLS[id].name);
  for (const n of u.base.skills) if (out.length < SKILL_SLOTS && !out.includes(n)) out.push(n);
  u.skills = out.slice(0, SKILL_SLOTS);
}

/** The skills its class teaches at its level (#194). */
function learn(u: Live) {
  for (const s of CLASS_SKILLS[u.classId]) if (s.level === u.level) u.learned.add(s.skill);
}

/** One level-up: each stat grows by 1 on its growth's roll (or by the growth's fraction in the projection), up to its cap. */
function levelUp(u: Live, rng: Rng | null, assumptions: Assumptions) {
  u.level++;
  learn(u);
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

/** A planned class change and the map index it's needed by (past the last map when it isn't on the order). */
type ClassChange = { readonly seal: PlanSeal; readonly by: number };

const SEAL_ITEM = { master: 'Master Seal', second: 'Second Seal' } as const;

/**
 * The plan's class changes in map `at`'s preparations (#194): each unit's next planned change is used when the unit is
 * at its level cap or the map needing the class has come, from Lv 10, with a seal the run holds, else one bought here
 * when an armory sells it and the gold covers it (#190); otherwise it waits. A Master Seal adds the class bases it
 * gains; a Second Seal moves each stat by the difference in class bases. The unit restarts at Lv 1 and learns its new
 * class's Lv 1 skill.
 */
function changeClasses(state: RunState, step: RunSimMap, at: number, reading: Assumptions['class-change-internal-level'], bar: Assumptions['seal-exp-bar'] = 'reset') {
  const next = new Map<RosterUnit, number>();
  state.classChanges.forEach((c, i) => {
    if (!state.changed.has(i) && !next.has(c.seal.unit)) next.set(c.seal.unit, i);
  });
  for (const [id, i] of next) {
    const u = state.army.get(id);
    const { seal, by } = state.classChanges[i]!;
    if (!u) continue;
    if (u.classId === seal.classId) {
      state.changed.add(i);
      continue;
    }
    if (u.level < SEAL_LEVEL || (u.level < levelCap(u.tier) && at < by)) continue;
    const gains = sealReaches(u.classId, seal.classId, u.base.gender, seal.seal) ? classChangeGains(u.classId, seal.classId, u.base.gender, seal.seal) : undefined;
    if (!gains) continue;
    if (seal.seal === 'master' && state.masterSealsHeld > 0) state.masterSealsHeld--;
    else if (seal.seal === 'second' && state.secondSealsHeld > 0) state.secondSealsHeld--;
    else {
      const item = SEAL_ITEM[seal.seal];
      const price = priceIn(step, item);
      if (price === undefined || !pay(state, { kind: 'seal', action: 'buy', item, unit: u.base.id, name: u.base.name, cost: price })) continue;
    }
    state.changed.add(i);
    const levelAtUse = u.level;
    const fromTier = u.tier;
    u.classId = seal.classId;
    u.tier = CLASSES[seal.classId].tier;
    u.level = 1;
    // The EXP bar through the seal (#209, open rule `seal-exp-bar`): reset with the level, or kept.
    if (bar === 'reset') u.exp = 0;
    // Research: a Master Seal only adds the advanced tier's +20, a Second Seal adds to the count. +1 per class change:
    // the level at use carries on.
    if (reading === 'plus-one') u.count += levelAtUse;
    else {
      if (seal.seal === 'second') u.count += secondSealCount(levelAtUse, fromTier);
      u.bonus = tierBonus(u.tier);
    }
    const caps = capsOf(u);
    for (const s of STATS)
      u.stats[s] = seal.seal === 'master' ? Math.min(Math.max(caps[s], u.stats[s]), u.stats[s] + gains[s]) : Math.max(0, Math.min(caps[s], u.stats[s] + gains[s]));
    learn(u);
  }
}

const internalOf = (u: Live, difficulty: Difficulty) => u.level + u.bonus + Math.min(u.count, COUNT_CAP[difficulty]);

/** Rounded stats as the combat math reads them, with this map's tonics (#193). */
const shownStats = (u: Live): Record<Stat, number> => Object.fromEntries(STATS.map((s) => [s, Math.floor(u.stats[s] + 1e-9) + (u.boost[s] ?? 0)])) as Record<Stat, number>;

const fighterOf = (u: Live, stats: Readonly<Record<Stat, number>>): Fighter => ({
  name: u.base.name,
  className: className(u.classId, u.base.gender),
  stats,
  skills: u.skills,
  weapon: u.weapons[0],
});

/** Each foe group's EXP foe on a map, by key (undefined for a class the EXP data doesn't know: it gives none). */
const EXP_FOES = new WeakMap<SimMap, Partial<Record<Assumptions['deadlord-boss-bonus'], Map<string, ExpFoe | undefined>>>>();
function expFoes(map: SimMap, deadlordBoss: Assumptions['deadlord-boss-bonus']): Map<string, ExpFoe | undefined> {
  let byReading = EXP_FOES.get(map);
  if (!byReading) EXP_FOES.set(map, (byReading = {}));
  let m = byReading[deadlordBoss];
  if (!m) {
    m = byReading[deadlordBoss] = new Map();
    const groups: SimFoeGroup[] = [...map.foes, ...map.waves.flatMap((w) => w.groups)];
    // A Deadlord carries its +20 unit bonus; the boss +20 on top is an open rule (#209, `deadlord-boss-bonus`).
    for (const g of groups) m.set(g.key, mapExpFoe(g.foe.name, g.foe.className, g.foe.level ?? 1, g.foe.boss, deadlordBoss));
  }
  return m;
}

/**
 * The EXP a map gives (#185, #195), in the play's order, at each unit's internal level then: each fight's front gets
 * kill EXP when the foe falls, damage EXP when it lived through the front's strikes and none when it wasn't hurt, cut
 * on Lunatic from a foe's 4th engagement; Veteran ×1.5 when its holder leads a pair. A paired back gets half its damage
 * EXP from its own Dual Strikes, never kill EXP, weighted by the chance it lands one (the play's expected share). Then
 * each staff use and each Dance, each times the unit's learned correction (#196). Returns the EXP each unit earned.
 */
function earn(state: RunState, map: SimMap, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions): Map<RosterUnit, number> {
  const foes = expFoes(map, assumptions['deadlord-boss-bonus']);
  const lunatic = difficulty === 'lunatic' || difficulty === 'lunatic-plus';
  const veteranBack = assumptions['veteran-as-back'] === 'paired';
  const earned = new Map<RosterUnit, number>();
  const give = (u: Live, given: number) => {
    // The unit's learned correction (#196) scales everything it earns.
    const factor = state.expFactor?.[u.base.id];
    const exp = factor === undefined ? given : Math.round(given * factor);
    if (exp <= 0) return;
    earned.set(u.base.id, (earned.get(u.base.id) ?? 0) + exp);
    gainExp(u, exp, rng, assumptions);
  };
  for (const turn of play.log) {
    for (const f of turn.fights) {
      const foe = foes.get(f.foe);
      if (!foe) continue;
      const u = state.army.get(f.lead as RosterUnit);
      if (u) give(u, combatExp(internalOf(u, difficulty), foe, f.kill ? 'kill' : f.dealt ? 'damage' : 'miss', false, lunatic, f.engagement, f.back && u.skills.includes('Veteran') ? 1.5 : 1));
      const b = f.back && f.dualStrike ? state.army.get(f.back as RosterUnit) : undefined;
      // Veteran on the back (#209, open rule `veteran-as-back`): only while leading, or whenever paired.
      if (b) give(b, Math.round(f.dualStrike! * combatExp(internalOf(b, difficulty), foe, 'damage', true, lunatic, f.engagement, veteranBack && b.skills.includes('Veteran') ? 1.5 : 1)));
    }
  }
  for (const [id, t] of Object.entries(play.units)) {
    const u = state.army.get(id as RosterUnit);
    if (!u) continue;
    for (const [item, n] of Object.entries(t.used)) for (let k = 0; k < n; k++) give(u, staffExp(internalOf(u, difficulty), item, u.tier, difficulty));
    for (let k = 0; k < t.dances; k++) give(u, danceExp(internalOf(u, difficulty)));
  }
  return earned;
}

/** Interned lineup objects: the same unit and stats (and the same pair) is the same object across runs, so the map simulation's combat caches hit. */
type Interner = { readonly units: Map<string, SimUnit>; readonly keys: Map<SimUnit, string>; readonly groups: Map<string, SimGroup> };

const newInterner = (): Interner => ({ units: new Map(), keys: new Map(), groups: new Map() });

function lineupOf(state: RunState, d: Deployment, extra: ReadonlyMap<RosterUnit, Live>, interner: Interner, foes: readonly Foe[]): SimGroup[] {
  const unit = (id: RosterUnit): SimUnit | undefined => {
    const u = state.army.get(id) ?? extra.get(id);
    if (!u) return undefined;
    const stats = shownStats(u);
    // What it carries into this map (five items, `loadout`).
    const kit = carriedBy(u, stats, foes);
    const key = `${id}|${u.classId}|${STATS.map((s) => stats[s]).join(',')}|${kit.weapons.map(weaponId).join(',')}/${kit.items.map((i) => `${i.item.name}:${i.uses}`).join(',')}`;
    let su = interner.units.get(key);
    if (!su) {
      interner.units.set(key, (su = { id, fighter: { ...fighterOf(u, stats), weapon: kit.weapons[0] }, weapons: kit.weapons, ...(kit.items.length ? { items: kit.items } : {}) }));
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

/** What a unit carries into a map with these foes (`loadout`: five items). */
function carriedBy(u: Live, stats: Readonly<Record<Stat, number>>, foes: readonly Foe[]) {
  return loadout(fighterOf(u, stats), u.weapons, u.items, foes);
}

/** The units a map can field: the army, its opening recruits and its own setups, each with what it would carry there. */
function candidatesOf(state: RunState, extra: ReadonlyMap<RosterUnit, Live>, foes: readonly Foe[]): DeployCandidate[] {
  return [...state.army.values(), ...extra.values()].map((u) => {
    const stats = shownStats(u);
    const kit = carriedBy(u, stats, foes);
    return {
      unit: u.base.id,
      fighter: { ...fighterOf(u, stats), weapon: kit.weapons[0] },
      weapons: kit.weapons,
      ...(kit.items.length ? { items: kit.items } : {}),
      supports: supportsOf(state, u.base.id),
    };
  });
}

/** Whether a map is entered in this run: a child paralogue only when its gates hold (Chapter 13 cleared, its parent married, its place reachable). */
function entered(state: RunState, step: RunSimMap): boolean {
  const id = step.map.id;
  if (!isChildParalogue(id)) return true;
  return childParalogueGates({ cleared: state.cleared, married: state.married }).some((g) => g.map === id && g.playable);
}

/**
 * A child as it joins (#187): join stats from its parents' stats and classes as they stand on entry (stored stats; the
 * projection's are fractional, which the formula's floor absorbs), skills from their equipped skills; a parent lost
 * after marrying as it stood at its death (#208). Undefined when a parent isn't in the run's army (never simulated) or
 * is in a class with no published bases.
 */
function childOf(state: RunState, c: ChildRecruit, assumptions: Assumptions): Live | undefined {
  // A parent passes its fixed skill; else the plan's, once it has learned it (and, the plan has it, equipped it last).
  const side = (u: RosterUnit | 'maiden', fixed: SkillId | undefined, planned: SkillId | undefined, lost: LostParent | undefined): { join: JoinParent; skills: SkillParent } | undefined => {
    if (u === 'maiden') return { join: 'maiden', skills: 'maiden' };
    const p = state.army.get(u);
    // A parent lost after marrying (#208): as it stood at its death.
    if (!p && lost) return classBaseStats(lost.classId, lost.gender) ? { join: { stats: lost.stats, class: lost.classId, gender: lost.gender }, skills: { skills: lost.skills, ...(fixed ? { fixed } : {}) } } : undefined;
    if (!p || !classBaseStats(p.classId, p.base.gender)) return undefined;
    const pass = fixed ?? (planned && p.learned.has(planned) ? planned : undefined);
    // Its boosters drunk before entry feed the child, under `booster-to-child` (#193).
    const stats = assumptions['booster-to-child'] === 'feeds' ? p.stats : (Object.fromEntries(STATS.map((s) => [s, p.stats[s] - (p.drunk[s] ?? 0)])) as Record<Stat, number>);
    return { join: { stats, class: p.classId, gender: p.base.gender }, skills: { skills: p.skills, ...(pass ? { fixed: pass } : {}) } };
  };
  const a = side(c.parents[0], c.fixed?.[0], c.passes?.[0], c.lost?.[0]);
  const b = side(c.parents[1], c.fixed?.[1], c.passes?.[1], c.lost?.[1]);
  if (!a || !b) return undefined;
  const join = childJoinStats({ child: c.id, parents: [a.join, b.join], ...(c.startClass ? { startClass: c.startClass } : {}), modifiers: c.modifiers }, assumptions);
  const { skills } = childSkills({ child: c.id, parents: [a.skills, b.skills], startClass: join.class, level: join.level }, assumptions);
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
  });
}

/**
 * A run's shopping at an armory stop besides seals (#190): `need` is what the plan's projection spends of a unit's item
 * from this map to the next stop, `kit` the endpoint kit when this is the endpoint's stop.
 */
type Shop = {
  readonly need: (unit: RosterUnit, item: string) => number;
  /** This stop's kit: the endpoint's (forged, every gold piece it can use), or a stop's on the way (off the shelf). */
  readonly kit?: () => readonly KitPiece[];
  readonly endpoint?: boolean;
};

/** Rebuys: an item whose uses left are below what it will spend before the next stop, when sold here. */
function rebuy(state: RunState, step: RunSimMap, shop: Shop) {
  for (const u of state.army.values()) {
    let changed = false;
    const receipt = (item: GameItem, cost: number): Receipt => ({ kind: 'rebuy', action: 'buy', item: item.name, unit: u.base.id, name: u.base.name, cost });
    const substitutes: { weapon: Weapon; uses: number }[] = [];
    for (const g of u.gear) {
      const item = g.weapon.item;
      const need = shop.need(u.base.id, item.name);
      if (!item.uses || need <= 0 || g.uses >= need) continue;
      const price = priceIn(step, item.name);
      if (price === undefined) {
        // Not sold here (a Killing Edge, a Silver Lance early on): a careful player buys the nearest weapon of its kind
        // the armory sells and the unit can wield, rather than field it unarmed or weaker, unless it already holds one
        // as strong with the uses the maps ahead spend.
        const sub = substituteFor(u, item, step);
        const covered = (x: { weapon: Weapon; uses: number }) => x !== g && x.weapon.item.kind === item.kind && (x.weapon.item.mt ?? 0) >= (sub?.item.mt ?? 0) && x.uses >= need;
        if (sub && !u.gear.some(covered) && !substitutes.some(covered) && pay(state, receipt(sub.item, sub.cost))) {
          substitutes.push({ weapon: freshWeapon(sub.item), uses: fullUses(sub.item) });
          changed = true;
        }
        continue;
      }
      if (!pay(state, receipt(item, price))) continue;
      // A copy bought joins the one held (the convoy merges them); a broken one comes back unforged.
      if (g.uses <= 0) g.weapon = freshWeapon(item);
      g.uses += item.uses!;
      changed = true;
    }
    u.gear.push(...substitutes);
    // Every weapon it holds has run dry, the maps ahead or not (the plan's projection never wears one out): a careful
    // player never leaves a fighter unarmed at an armory. Its strongest broken weapon again, else the nearest sold.
    if (u.gear.length && u.gear.every((g) => g.uses <= 0)) {
      const g = [...u.gear].sort((a, b) => (b.weapon.item.mt ?? 0) - (a.weapon.item.mt ?? 0))[0]!;
      const item = g.weapon.item;
      const price = item.uses ? priceIn(step, item.name) : undefined;
      if (price !== undefined) {
        if (pay(state, receipt(item, price))) {
          g.weapon = freshWeapon(item);
          g.uses = item.uses!;
          changed = true;
        }
      } else {
        const sub = substituteFor(u, item, step);
        if (sub && pay(state, receipt(sub.item, sub.cost))) {
          u.gear.push({ weapon: freshWeapon(sub.item), uses: fullUses(sub.item) });
          changed = true;
        }
      }
    }
    for (const s of u.stock) {
      // A staff or potion is kept to a third of its uses at least as well (the realism pass): the projection's use of
      // it is one play's, and a healer run dry mid-map leaves the army with no way to buy HP back.
      const need = Math.max(shop.need(u.base.id, s.item.name), s.item.uses ? Math.ceil(s.item.uses / 3) : 0);
      const price = s.item.uses && need > 0 && s.uses < need ? priceIn(step, s.item.name) : undefined;
      if (price === undefined || !pay(state, receipt(s.item, price))) continue;
      s.uses += s.item.uses!;
      changed = true;
    }
    if (changed) refresh(u);
  }
}

/**
 * The weapon a unit gets for one running dry that no armory here sells: of the same kind, one it can wield, the closest
 * in Mt at or below the one it replaces (else the weakest above it), the cheaper on a tie.
 */
function substituteFor(u: Live, item: GameItem, step: RunSimMap): { item: GameItem; cost: number } | undefined {
  let best: { item: GameItem; cost: number } | undefined;
  const mt = item.mt ?? 0;
  const rank = (x: GameItem) => ((x.mt ?? 0) <= mt ? 1000 + (x.mt ?? 0) : -(x.mt ?? 0));
  for (const s of step.armory ?? []) {
    const it = itemByName(s.item);
    if (!it || it.kind !== item.kind || s.cost === null || !it.uses || !wields(u, it)) continue;
    if (!best || rank(it) > rank(best.item) || (rank(it) === rank(best.item) && s.cost < best.cost)) best = { item: it, cost: s.cost };
  }
  return best;
}

/**
 * A kit bought down with the gold left above `reserve` (`buyDown`): pieces for units the run has, forges of weapons it
 * holds.
 */
function buyKit(state: RunState, pieces: readonly KitPiece[], reserve = 0, kind: 'arms' | 'kit' = 'kit') {
  const holds = (u: Live, p: KitPiece) => p.action === 'buy' || p.after !== undefined || u.gear.some((g) => g.uses > 0 && g.weapon.item === p.item);
  const usable = pieces.map((p) => {
    const u = state.army.get(p.unit as RosterUnit);
    return u && holds(u, p) ? p : { ...p, cost: Infinity };
  });
  for (const i of buyDown(usable, Math.max(0, state.gold - reserve))) {
    const p = usable[i]!;
    const u = state.army.get(p.unit as RosterUnit)!;
    pay(state, { kind, action: p.action, item: p.item.name, unit: u.base.id, name: u.base.name, cost: p.cost });
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

/** A held item's copy for a use (#193): the named one, else another copy of the same item the run holds. */
function takeFromPool(state: RunState, use: SimItemUse): ItemSource | undefined {
  let src = state.pool.get(use.source);
  if (!src) for (const s of state.pool.values()) if (s.item === use.item && !s.holder) (src ??= s);
  if (src) state.pool.delete(src.id);
  return src;
}

/**
 * The plan's boosters and handovers in a map's preparations (#193): a booster adds its gain to the unit's stats,
 * clamped at its caps (at the cap it's wasted, or refused and kept, per `booster-at-cap`); a weapon moves to its
 * carrier from the convoy or from whoever holds it. A use whose item the run doesn't hold, or whose unit isn't in the
 * army, isn't made.
 */
function drinkAndCarry(state: RunState, step: RunSimMap, assumptions: Assumptions) {
  (step.uses ?? []).forEach((use, j) => {
    const u = state.army.get(use.unit);
    if (!u || use.kind === 'tonic') return;
    if (use.kind === 'booster') {
      const stat = STAT_BOOSTERS[use.item];
      if (!stat) return;
      const cap = capsOf(u)[stat];
      if (u.stats[stat] >= cap && assumptions['booster-at-cap'] === 'refused') return;
      if (!takeFromPool(state, use)) return;
      const gain = Math.max(0, Math.min(cap, u.stats[stat] + statItemGain(stat)) - u.stats[stat]);
      u.stats[stat] += gain;
      u.drunk[stat] = (u.drunk[stat] ?? 0) + gain;
      state.made[j] = true;
      return;
    }
    // A weapon: from the convoy, or from the unit holding it.
    const holder = state.carriers.get(use.source);
    if (holder === use.unit) return void (state.made[j] = true);
    let piece: { weapon: Weapon; uses: number } | undefined;
    const from = holder ? state.army.get(holder) : undefined;
    if (from) {
      const k = from.gear.findIndex((g) => g.weapon.item.name === use.item);
      if (k >= 0) {
        piece = from.gear.splice(k, 1)[0]!;
        refresh(from);
      }
    } else {
      const src = state.pool.get(use.source);
      if (src?.weapon) {
        state.pool.delete(src.id);
        piece = { weapon: src.weapon, uses: src.uses ?? fullUses(src.weapon.item) };
      }
    }
    if (!piece) return;
    u.gear.push(piece);
    refresh(u);
    state.carriers.set(use.source, use.unit);
    state.made[j] = true;
  });
}

/**
 * The plan's tonics at a map's shopping (#193): a held one first, else one bought where an open armory sells it. Each
 * adds its gain to the unit's shown stats for this map, past the cap; the same tonic twice per `tonic-stacking`. Left
 * out when items can't be used in preparations (`item-in-preparations`).
 */
function drinkTonics(state: RunState, step: RunSimMap, assumptions: Assumptions) {
  if (assumptions['item-in-preparations'] !== 'free') return;
  (step.uses ?? []).forEach((use, j) => {
    const u = state.army.get(use.unit);
    const stat = TONICS[use.item];
    if (!u || use.kind !== 'tonic' || !stat) return;
    if (u.boost[stat] && assumptions['tonic-stacking'] === 'no-stack') return;
    if (!takeFromPool(state, use)) {
      const price = priceIn(step, use.item);
      if (price === undefined || !pay(state, { kind: 'tonic', action: 'buy', item: use.item, unit: u.base.id, name: u.base.name, cost: price })) return;
    }
    u.boost[stat] = (u.boost[stat] ?? 0) + statItemGain(stat);
    state.made[j] = true;
  });
}

/**
 * A map's preparations: its opening recruits join (and its own setups are fielded), the plan's boosters and handovers
 * (#193), its children are read from their parents on entry, then the shopping list in priority order: rebuys, seals
 * with promotions, the plan's tonics (#193), the endpoint kit (#190). A map with no preparation phase has none of the
 * item uses (the world map's armories still sell before it). Undefined when the map isn't entered in this run (a closed
 * child paralogue).
 */
function beforeMap(state: RunState, step: RunSimMap, at: number, assumptions: Assumptions, shop?: Shop): Map<RosterUnit, Live> | undefined {
  if (!entered(state, step)) return undefined;
  for (const a of step.joining) if (!state.army.has(a.id)) join(state, a);
  state.made = (step.uses ?? []).map(() => false);
  const prep = !step.noPreparations;
  if (prep) drinkAndCarry(state, step, assumptions);
  state.arriving = [];
  for (const c of step.children ?? []) {
    if (state.army.has(c.id) || state.arriving.some((u) => u.base.id === c.id) || c.parents[1] !== spouseIn(state, c.parents[0])) continue;
    const u = childOf(state, c, assumptions);
    if (u) state.arriving.push(u);
  }
  const stop = !!step.armory?.length;
  if (shop && stop) rebuy(state, step, shop);
  changeClasses(state, step, at, assumptions['class-change-internal-level'], assumptions['seal-exp-bar']);
  // The plan's build skills learned by now are equipped (a skill is equipped in the preparations, like a class change).
  if (state.builds) for (const u of state.army.values()) equip(u, state.builds[u.base.id]);
  if (prep) handOver(state);
  if (prep) drinkTonics(state, step, assumptions);
  // On the way, the gold the plan's seals still to buy need stays in hand.
  if (shop?.kit && stop) buyKit(state, shop.kit(), shop.endpoint ? 0 : sealReserve(state), shop.endpoint ? 'kit' : 'arms');
  return new Map(step.mapOnly.map((a) => [a.id, liveOf(a)]));
}

/**
 * Weapons a unit holds but can't wield (Chapter 2's Miriel carries Vaike's Iron Axe; a class change leaves a kind
 * behind) go, in the preparations, to a unit that can and holds none of that kind: the unarmed first, then in army order.
 */
function handOver(state: RunState) {
  const units = [...state.army.values()];
  const kinds = new Map(units.map((u) => [u, classWeaponKinds(className(u.classId, u.base.gender))]));
  const holds = (u: Live, kind: string) => u.gear.some((g) => g.uses > 0 && g.weapon.item.kind === kind);
  for (const from of units) {
    for (let k = from.gear.length - 1; k >= 0; k--) {
      const g = from.gear[k]!;
      const kind = g.weapon.item.kind;
      if (g.uses <= 0 || kinds.get(from)!.has(kind) || g.weapon.item.only) continue;
      const takers = units.filter((u) => u !== from && kinds.get(u)!.has(kind) && !holds(u, kind));
      const to = takers.find((u) => !u.gear.some((x) => x.uses > 0)) ?? takers[0];
      if (!to) continue;
      from.gear.splice(k, 1);
      to.gear.push(g);
      refresh(from);
      refresh(to);
    }
  }
}

/** The gold kept for the plan's class changes still to make that the seals held don't cover. */
function sealReserve(state: RunState): number {
  const left = state.classChanges.length - state.changed.size;
  return Math.max(0, left - state.masterSealsHeld - state.secondSealsHeld) * SEAL_PRICE;
}

/**
 * After map `at`: EXP and level-ups from its fights, support points from its combats together and the marriages they
 * make, the recruits and children who came during it, then (Chapter 11) Chrom's wedding.
 */
function afterMap(state: RunState, step: RunSimMap, at: number, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions, spent?: MapUpkeep): Map<RosterUnit, number> {
  if (spent) upkeep(state, step, spent);
  secure(state, step, play);
  // Tonics last the map; its finds are held from the next (a side goal's only when its part was secured, #193).
  for (const u of state.army.values()) u.boost = {};
  for (const f of step.finds ?? []) if (!f.part || play.chased?.[f.part] === true) state.pool.set(f.id, f);
  const earned = earn(state, step.map, play, rng, difficulty, assumptions);
  // Chrom's wedding reads the ranks viewed before Chapter 11: those its points reached by the map before.
  const viewed = step.map.id === CHROM_WEDDING_MAP ? new Map(state.supports) : undefined;
  growSupports(state, play, at, assumptions['support-past-threshold']);
  for (const a of step.later) if (!state.army.has(a.id)) join(state, a);
  for (const u of state.arriving) if (!state.army.has(u.base.id)) state.army.set(u.base.id, u);
  state.arriving = [];
  state.cleared.add(step.map.id);
  if (viewed) chromWedding(state, at, viewed, assumptions);
  return earned;
}

/** The chased side goals' parts, as the map play takes them (#191); undefined when the plan chases none there. */
const CHASES = new WeakMap<RunSimMap, readonly SimChase[] | undefined>();
function chasesOf(step: RunSimMap): readonly SimChase[] | undefined {
  if (!CHASES.has(step)) {
    const cs = (step.sideGoals ?? []).flatMap((g) => (g.chase ? g.parts.map((p) => p.chase) : []));
    CHASES.set(step, cs.length ? cs : undefined);
  }
  return CHASES.get(step);
}

/**
 * The map play's input for map `i`: the lineup, the couples to keep together (#184) and the pairs a span pin keeps
 * (#195), the side goals chased (#191), the EXP priorities (#195) and, in the runs only, the idle units (#202).
 */
function playInput(state: RunState, input: RunSimInput, i: number, lineup: readonly SimGroup[], idle?: readonly RosterUnit[]): MapPlayInput {
  const step = input.maps[i]!;
  const chase = chasesOf(step);
  const kept = (input.lineups?.[i]?.pairs ?? []).flatMap((p) => (p.kept && p.back ? [[p.lead, p.back] as const] : []));
  const priority = input.priority?.[i];
  return { map: step.map, lineup, bonds: [...couplesToMarry(state), ...kept], ...(chase ? { chase } : {}), ...(priority ? { priority } : {}), ...(idle?.length ? { idle } : {}) };
}

/** Each unit's share of a play's lost chance (#202): its death risk there, the log of its fights' survival, over all of theirs. */
function lossShares(play: MapPlay): Map<string, number> {
  const risk = new Map<string, number>();
  let total = 0;
  for (const t of play.log)
    for (const f of t.fights) {
      const r = -Math.log(Math.max(f.survive, 1e-300));
      if (r <= 0) continue;
      risk.set(f.lead, (risk.get(f.lead) ?? 0) + r);
      total += r;
    }
  if (total > 0) for (const [u, r] of risk) risk.set(u, r / total);
  return risk;
}

/** Whether a run secured a side goal on the map it played: chased, with every part's actions spent in time. */
const secured = (g: RunSimSideGoal, play: MapPlay): boolean => g.chase && g.parts.every((p) => play.chased?.[p.chase.id] === true);

/** A side goal's parts secured in the play pay the run (#191): Bullion sold at the next armory, gold, free seals. */
function secure(state: RunState, step: RunSimMap, play: MapPlay) {
  for (const g of step.sideGoals ?? []) {
    if (!g.chase) continue;
    for (const p of g.parts) {
      if (play.chased?.[p.chase.id] !== true) continue;
      state.gold += p.gold;
      state.masterSealsHeld += p.seals.master;
      state.secondSealsHeld += p.seals.second;
    }
  }
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

/**
 * Chrom's wedding at the end of Chapter 11 when he's unmarried, by the game's rule over the run's points. A rank is
 * viewed only if `viewed` (the points as Chapter 11 began) reached it: one reached on Chapter 11 itself is pending, no
 * new rank and 0 points to go, as there's no world-map stop before the wedding. A candidate out of the army (lost) is
 * skipped only under the `chrom-wedding-lost-candidate` reading that says so.
 */
function chromWedding(state: RunState, at: number, viewed: ReadonlyMap<string, number>, assumptions: Assumptions) {
  if (state.married.has('chrom')) return;
  const candidates: RosterUnit[] = [...CHROM_WEDDING_CANDIDATES, ...(state.robin === 'F' ? (['robin'] as const) : [])];
  const standing: Partial<Record<RosterUnit, ChromStanding>> = {};
  for (const c of candidates) {
    const t = pairThresholds('chrom', c, state.robin);
    if (!t) continue;
    const points = state.supports.get(pairKey('chrom', c)) ?? 0;
    const rank = rankOf(viewed.get(pairKey('chrom', c)) ?? 0, t, false);
    const next = SUPPORT_LEVELS.slice(rank ? SUPPORT_LEVELS.indexOf(rank) + 1 : 0).map((r) => t[r]).find((need) => need !== undefined);
    standing[c] = { points, rank, toNext: next === undefined ? Infinity : Math.max(0, next - points) };
  }
  const lost = (c: RosterUnit) => assumptions['chrom-wedding-lost-candidate'] === 'skipped' && !state.army.has(c);
  const out = new Set(candidates.filter((c) => state.married.has(c) || lost(c)));
  marry(state, 'chrom', chromWifeByPoints(candidates, out, standing), at);
}

/** Robin's gender, from the army or a recruit. */
const robinOf = (input: RunSimInput): Gender | undefined =>
  [...input.army, ...input.maps.flatMap((m) => [...m.joining, ...m.later])].find((a) => a.id === 'robin')?.gender;

/** The plan's class changes with the map index each is needed by (`plannedSeals` when the input names none). */
const CHANGES = new WeakMap<RunSimInput, readonly ClassChange[]>();
function classChangesOf(input: RunSimInput): readonly ClassChange[] {
  let out = CHANGES.get(input);
  if (!out) {
    const index = new Map(input.maps.map((m, i) => [m.key, i]));
    out = (input.seals ?? plannedSeals(input)).map((seal) => ({ seal, by: index.get(seal.key) ?? input.maps.length }));
    CHANGES.set(input, out);
  }
  return out;
}

function newState(input: RunSimInput): RunState {
  const state: RunState = {
    classChanges: classChangesOf(input),
    changed: new Set(),
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
    pool: new Map(),
    carriers: new Map(),
    made: [],
    builds: input.builds,
    expFactor: input.expFactor,
  };
  for (const [a, b] of input.married ?? []) marry(state, a, b, undefined);
  for (const a of input.army) join(state, a);
  for (const s of input.held ?? []) {
    if (s.holder) state.carriers.set(s.id, s.holder);
    else state.pool.set(s.id, s);
  }
  return state;
}

/** The lineup of a map no run enters. */
const NOBODY: Deployment = { max: 0, deployed: [], pairs: [], solo: [], forced: [] };

/** The plan's projection: each map's lineup, the uses it expects each unit to spend there, and the endpoint kit. */
type Plan = {
  readonly lineup: (i: number) => Deployment;
  readonly wear: (i: number) => MapUpkeep;
  /** The kit an armory stop buys (the endpoint's, or a stop's on the way); empty elsewhere. */
  readonly kit: (i: number) => readonly KitPiece[];
};

const NO_WEAR: MapUpkeep = new Map();

/**
 * The endpoint kit over the projection's army and the plan's endpoint lineup (`endpointKit`): its leads' weapons and
 * forges, and a Vulnerary for each unit it fields.
 */
function kitFor(state: RunState, step: RunSimMap, d: Deployment, endpoint = true): KitPiece[] {
  // On the way, every unit fielded is armed for the map (a back may fight alone), off the shelf and within its ranks.
  const fronts = endpoint
    ? [...d.pairs.map((p) => [p.lead, p.back] as const), ...d.solo.map((u) => [u, undefined] as const)]
    : [...d.pairs.flatMap((p) => [[p.lead, p.back] as const, ...(p.back ? [[p.back, undefined] as const] : [])]), ...d.solo.map((u) => [u, undefined] as const)];
  const leads = fronts.flatMap(([lead, back]) => {
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
  if (endpoint) return endpointKit({ leads, deployed, foes, stock: step.armory ?? [] });
  return endpointKit({ leads, deployed, foes, stock: step.armory ?? [], forge: false, wields: (unit, item) => { const u = state.army.get(unit as RosterUnit); return !!u && wields(u, item); } });
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
  const kits: (readonly KitPiece[])[] = [];
  const walk = (i: number) => {
    while (done.length <= i) {
      const k = done.length;
      const step = input.maps[k]!;
      const extra = beforeMap(state, step, k, assumptions);
      if (!extra) {
        done.push(NOBODY);
        wear.push(NO_WEAR);
        kits.push([]);
        continue;
      }
      const d = deploymentFor(state, input, k, extra);
      // An armory stop's kit (#190; on the way, the realism pass): the projection buys it all (its gold is unlimited),
      // so the lineups after it are worked out armed as the runs will be.
      kits[k] = step.armory?.length ? kitFor(state, step, d, k === last) : [];
      if (k !== last && kits[k]!.length) buyKit(state, kits[k]!);
      const lineup = lineupOf(state, d, extra, interner, foesOfMap(step.map));
      const play = playMap(playInput(state, input, k, lineup), runSeed(seed, k));
      wear.push(mapUpkeep(step.map, play, lineup, null, assumptions['tome-miss-use']));
      afterMap(state, step, k, play, null, input.difficulty, assumptions);
      done.push(d);
    }
  };
  return {
    lineup: (i) => (walk(i), done[i]!),
    wear: (i) => (walk(i), wear[i]!),
    kit: (i) => (walk(i), kits[i]!),
  };
}

/** The first map from `k` on whose child the couple brings (its paralogue), by index; past the order when none does. */
function childDue(input: RunSimInput, k: number, [a, b]: readonly [RosterUnit, RosterUnit]): number {
  for (let j = k; j < input.maps.length; j++)
    if (input.maps[j]!.children?.some((c) => (c.parents[0] === a && c.parents[1] === b) || (c.parents[0] === b && c.parents[1] === a))) return j;
  return input.maps.length;
}

/**
 * The lineup a map is played with, from where the army stands (`state`): the plan's (#198), else the greedy one
 * (`suggestDeployment`, each couple the plan marries paired until it marries, #188), both keeping the pins' rules (#200).
 */
function deploymentFor(state: RunState, input: RunSimInput, k: number, extra: ReadonlyMap<RosterUnit, Live>): Deployment {
  const step = input.maps[k]!;
  const pools = new Map<Foe, readonly string[]>(step.map.foes.map((g) => [g.foe, g.pool ?? []]));
  const here = (u: RosterUnit) => state.army.has(u) || extra.has(u);
  // Who of a couple leads (#212: no role tag): a forced unit, else an armed unit that isn't a Dancer.
  const leads = (u: RosterUnit) => {
    const l = (state.army.get(u) ?? extra.get(u))!;
    return step.forced.includes(u) || leadsByDefault({ fighter: fighterOf(l, shownStats(l)), weapons: l.weapons });
  };
  const max = step.deploy || state.army.size + extra.size;
  // The plan pairs each couple it marries until they marry (#188), the one that leads in front: the couples whose
  // child's paralogue comes first, in half the slots at most (one couple at least; the realism pass). A careful player
  // builds supports alongside a fighting core, not with every slot of the army.
  const pinned = [...state.couples.values()]
    .filter(([a, b]) => here(a) && here(b) && !state.married.has(a) && !state.married.has(b))
    .map((c) => ({ c, due: childDue(input, k, c) }))
    .sort((x, y) => x.due - y.due)
    .slice(0, Math.max(1, Math.floor(max / 4)))
    .map(({ c: [a, b] }) => (leads(b) && !leads(a) ? { lead: b, back: a } : { lead: a, back: b }));
  const planned = input.lineups?.[k];
  // The pins' rules on this map (#200): the greedy lineup starts from their pairs and leaves out who's kept out;
  // either lineup then keeps them.
  const rules = input.pins?.[k];
  const kept = { max, forced: step.forced, here };
  const rank = (a: RosterUnit, b: RosterUnit) => rankIn(state, a, b);
  let d = planned
    ? plannedDeployment(pinnedLineup(planned, rules, kept), step.forced, max, here, rank)
    : suggestDeployment({
        candidates: candidatesOf(state, extra, foesOfMap(step.map)),
        forced: step.forced,
        pinned: [...(rules ?? []).flatMap((r) => (r.partner && (r.position === 'lead' || r.position === 'back') ? [r.position === 'lead' ? { lead: r.unit, back: r.partner } : { lead: r.partner, back: r.unit }] : [])), ...pinned],
        ...(rules?.some((r) => r.position === 'out') ? { excluded: new Set(rules.filter((r) => r.position === 'out').map((r) => r.unit)) } : {}),
        max,
        foes: step.map.foes.map((g) => g.foe),
        pool: (f) => pools.get(f) ?? [],
      });
  if (!planned && rules) {
    const greedy: LineupPlan = { pairs: d.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo: d.solo };
    const fixed = pinnedLineup(greedy, rules, kept);
    if (rulesBroken(greedy, rules, step.forced, here) > 0) d = plannedDeployment(fixed, step.forced, max, here, rank);
  }
  return d;
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

/**
 * The plan's projection for an input and seed, walked once and kept while the input lives (#199): the solve simulates
 * one plan's runs in batches (`simulateRuns`' `first`), and every batch plays the same lineups.
 */
const PROJECTIONS = new WeakMap<RunSimInput, WeakMap<Assumptions, Map<number, Plan>>>();
/** A stressed input's unstressed one (`withStress`): the stress leaves the projection alone, so they share it. */
const UNSTRESSED = new WeakMap<RunSimInput, RunSimInput>();

/**
 * An input with its runs played under a blind spot's bad case (#211), kept per input and case, sharing the input's
 * projection: the plan's lineups are the same, only the runs' plays change.
 */
const STRESSED = new WeakMap<RunSimInput, Map<StressCase, RunSimInput>>();
export function withStress(input: RunSimInput, stress: StressCase): RunSimInput {
  const base = UNSTRESSED.get(input) ?? input;
  let byCase = STRESSED.get(base);
  if (!byCase) STRESSED.set(base, (byCase = new Map()));
  let out = byCase.get(stress);
  if (!out) {
    byCase.set(stress, (out = { ...base, stress }));
    UNSTRESSED.set(out, base);
  }
  return out;
}

function projection(given: RunSimInput, seed: number, assumptions: Assumptions): Plan {
  const input = UNSTRESSED.get(given) ?? given;
  let byAssumptions = PROJECTIONS.get(input);
  if (!byAssumptions) PROJECTIONS.set(input, (byAssumptions = new WeakMap()));
  let bySeed = byAssumptions.get(assumptions);
  if (!bySeed) byAssumptions.set(assumptions, (bySeed = new Map()));
  // The seed only draws Lunatic+ skills in the projection's plays: with no map to draw them on, one projection serves
  // every seed.
  const k = drawsSkills(input) ? seed : 0;
  let plan = bySeed.get(k);
  if (!plan) bySeed.set(k, (plan = planner(input, seed, assumptions)));
  return plan;
}

/** Whether any map of the input draws Lunatic+ skills for its foes (a pool to draw from). */
const DRAWS = new WeakMap<RunSimInput, boolean>();
function drawsSkills(input: RunSimInput): boolean {
  let d = DRAWS.get(input);
  if (d === undefined) {
    d = input.maps.some((m) => [...m.map.foes, ...m.map.waves.flatMap((w) => w.groups)].some((g) => !!g.pool?.length));
    DRAWS.set(input, d);
  }
  return d;
}

/** The plan's lineup for every map (see `planner`). */
export function planLineups(input: RunSimInput, seed: number, assumptions: Assumptions): Deployment[] {
  const plan = projection(input, seed, assumptions);
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
    if (!e) atEnd.set(u.base.id, (e = { name: u.base.name, skills: u.skills, classes: new Map(), level: [], exp: [], stats: Object.fromEntries(STATS.map((s) => [s, []])) as unknown as Record<Stat, number[]> }));
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

const KIND_ORDER: Readonly<Record<ShoppingLine['kind'], number>> = { rebuy: 0, seal: 1, tonic: 2, arms: 3, kit: 4 };

/** A stop's shopping list: its lines in priority order (rebuys, seals, kit), the likeliest first within each. */
function shoppingStop(step: RunSimMap, s: StopTally): ShoppingStop {
  const lines = [...s.lines.values()]
    .map(({ receipt, runs }) => ({ ...receipt, share: runs / s.runs }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.share - a.share || a.name.localeCompare(b.name) || Number(a.action === 'forge') - Number(b.action === 'forge'));
  return { key: step.key, label: step.label, gold: goldSpread(s.gold), runs: s.runs, lines };
}

/** Whether a milestone holds in a run as it stands now (see `MilestoneCheck`). */
function holds(state: RunState, c: MilestoneCheck): boolean {
  const t = c.test;
  switch (t.kind) {
    case 'skill':
      return !!state.army.get(t.unit)?.learned.has(t.skill);
    case 'class':
      return state.army.get(t.unit)?.classId === t.classId || state.classChanges.some((x, i) => state.changed.has(i) && x.seal.unit === t.unit && x.seal.classId === t.classId);
    case 'support':
      return state.spouses.get(t.pair[0]) === t.pair[1] || rankIn(state, t.pair[0], t.pair[1]) === 'S';
    case 'recruit':
      return state.army.has(t.child) || state.arriving.some((u) => u.base.id === t.child);
  }
}

/** The unit whose level a milestone reports: a skill's learner, a class change's unit. */
const levelUnit = (c: MilestoneCheck): RosterUnit | undefined => (c.test.kind === 'skill' || c.test.kind === 'class' ? c.test.unit : undefined);

/** One map's EXP over the runs that play it (#195): each unit's EXP, levels at the map's end and kills by foe group. */
type ExpTally = { runs: number; readonly groups: MapPlay['groups']; readonly units: Map<RosterUnit, { readonly name: string; exp: number; readonly levels: number[]; readonly kills: Record<string, number> }> };

function tallyExp(t: ExpTally, state: RunState, play: MapPlay, earned: ReadonlyMap<RosterUnit, number>) {
  t.runs++;
  for (const [id, tally] of Object.entries(play.units)) {
    const u = state.army.get(id as RosterUnit);
    if (!u) continue;
    let e = t.units.get(u.base.id);
    if (!e) t.units.set(u.base.id, (e = { name: u.base.name, exp: 0, levels: [], kills: {} }));
    e.exp += earned.get(u.base.id) ?? 0;
    e.levels.push(u.level + u.exp / 100);
    for (const [g, n] of Object.entries(tally.kills)) e.kills[g] = (e.kills[g] ?? 0) + n;
  }
}

/**
 * The flawless chance over `runs` simulated runs from `seed` (see the module comment). The same input, seed and run
 * count give the same result; more runs narrow the margin. `first` starts at a later run index (#199): runs `first` to
 * `first + runs - 1` of the same seed, so a plan's runs can be simulated in batches and compared on the same runs.
 */
export function simulateRuns(input: RunSimInput, seed: number, runs: number, assumptions: Assumptions, first = 0): RunSim {
  const n = Math.max(1, Math.floor(runs));
  const plan = projection(input, seed, assumptions);
  const lineups: (Deployment | undefined)[] = input.maps.map(() => undefined);
  const interner = newInterner();
  const samples: number[] = [];
  const turnSamples: number[] = [];
  const reach = input.maps.map(() => 0);
  const noDeath = input.maps.map(() => 0);
  const turns = input.maps.map(() => 0);
  const stalls = input.maps.map(() => 0);
  const atEnd: Endpoint = new Map();
  const bonds: Bonds = { runs: 0, points: new Map(), weddings: new Map() };
  const spots = new Set<BlindSpotId>();
  const last = input.maps.length - 1;
  // Gold at each map's end, and each armory stop's arrivals and purchases (#190).
  const golds: number[][] = input.maps.map(() => []);
  const stops = input.maps.map(() => ({ runs: 0, gold: [] as number[], lines: new Map<string, { receipt: Receipt; runs: number }>() }));
  // Runs securing each side goal, by map index and goal (#191); counted over the runs in `golds`.
  const goals = new Map<string, number>();
  // Runs entering each map with nobody lost, and those making each of its planned item uses (#193).
  const entering = input.maps.map(() => 0);
  const made = input.maps.map((m) => (m.uses ?? []).map(() => 0));
  // The chance each unit is lost, summed over the runs (#202).
  const lost = new Map<string, number>();
  // The EXP forecast by map, and each milestone's runs reaching its point, runs meeting it, and levels there (#195).
  const expTallies: (ExpTally | undefined)[] = input.maps.map(() => undefined);
  const checks = input.milestones ?? [];
  const checksAt = new Map<string, number[]>();
  checks.forEach((c, k) => checksAt.set(`${c.index}|${c.when}`, [...(checksAt.get(`${c.index}|${c.when}`) ?? []), k]));
  const checked = checks.map(() => ({ runs: 0, met: 0, levels: [] as number[] }));
  const check = (state: RunState, i: number, when: MilestoneCheck['when']) => {
    for (const k of checksAt.get(`${i}|${when}`) ?? []) {
      const c = checks[k]!;
      const x = checked[k]!;
      x.runs++;
      if (holds(state, c)) x.met++;
      const u = levelUnit(c);
      const live = u ? state.army.get(u) : undefined;
      if (live) x.levels.push(live.level);
    }
  };
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
  for (let r = first; r < first + n; r++) {
    const rs = runSeed(seed, r);
    const rng = createRng(rs);
    // Hits are drawn from their own stream, so upkeep never moves the level-up rolls.
    const hits = createRng(runSeed(rs, WEAR_STREAM));
    const state = newState(input);
    let flawless = 1;
    let played = 0;
    for (let i = 0; i <= last; i++) {
      // A run that has lost a unit adds nothing more to the chance, the maps' chances or the endpoint's stats.
      if (flawless < LOST) break;
      const step = input.maps[i]!;
      const arriving = state.gold;
      state.receipts = [];
      const extra = beforeMap(state, step, i, assumptions, { need: need(i), kit: () => plan.kit(i), endpoint: i === last });
      const receipts = state.receipts;
      state.receipts = null;
      check(state, i, 'start');
      if (i === last) {
        recordEndpoint(atEnd, state);
        recordBonds(bonds, state);
      }
      // A child paralogue whose gates don't hold in this run isn't played.
      if (!extra) {
        check(state, i, 'end');
        continue;
      }
      entering[i]!++;
      state.made.forEach((ok, j) => ok && made[i]![j]!++);
      if (step.armory?.length) recordStop(stops[i]!, arriving, receipts);
      // A map the plan's projection never entered (a child paralogue whose gates held only in some runs) is played by
      // this run's own lineup.
      const planned = (lineups[i] ??= plan.lineup(i));
      const lineup = lineupOf(state, planned === NOBODY ? deploymentFor(state, input, i, extra) : planned, extra, interner, foesOfMap(step.map));
      // A run already this unlikely to have lost nobody stops playing once the map takes it under `LOST` (it counts 0).
      const play = playMap({ ...playInput(state, input, i, lineup, input.idle), stopBelow: LOST / flawless, ...(input.stress ? { stress: input.stress } : {}) }, runSeed(rs, i));
      if (play.noDeath < 1) for (const [u, share] of lossShares(play)) lost.set(u, (lost.get(u) ?? 0) + flawless * (1 - play.noDeath) * share);
      // A map the play can't win in its turns isn't cleared: the run doesn't get past it (the plan isn't shown to).
      const stalled = play.ended === 'stalled';
      const cleared = stalled ? 0 : play.noDeath;
      reach[i]! += flawless;
      noDeath[i]! += flawless * cleared;
      turns[i]! += flawless * play.turns;
      played += play.turns;
      if (stalled) stalls[i]! += flawless;
      flawless *= cleared;
      for (const b of play.blindSpots) spots.add(b);
      const earned = afterMap(state, step, i, play, rng, input.difficulty, assumptions, mapUpkeep(step.map, play, lineup, hits, assumptions['tome-miss-use']));
      tallyExp((expTallies[i] ??= { runs: 0, groups: play.groups, units: new Map() }), state, play, earned);
      check(state, i, 'end');
      golds[i]!.push(state.gold);
      for (const g of step.sideGoals ?? []) if (secured(g, play)) goals.set(`${i}|${g.id}`, (goals.get(`${i}|${g.id}`) ?? 0) + 1);
    }
    samples.push(flawless < LOST ? 0 : flawless);
    turnSamples.push(played);
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
    turnSamples,
    blindSpots: [...spots, ...RUN_BLIND_SPOTS],
    maps: input.maps.map((m, i) => ({
      key: m.key,
      label: m.label,
      reach: reach[i]! / n,
      noDeath: reach[i]! > 0 ? noDeath[i]! / reach[i]! : undefined,
      lineup: lineups[i],
      turns: reach[i]! > 0 ? turns[i]! / reach[i]! : undefined,
      stalled: reach[i]! > 0 ? stalls[i]! / reach[i]! : undefined,
      gold: golds[i]!.length ? goldSpread(golds[i]!) : undefined,
    })),
    shopping: stops.flatMap((s, i) => (s.runs ? [shoppingStop(input.maps[i]!, s)] : [])),
    sideGoals: input.maps.flatMap((m, i) =>
      (m.sideGoals ?? []).map((g) => ({ id: g.id, label: g.label, key: m.key, chase: g.chase, secured: golds[i]!.length ? (goals.get(`${i}|${g.id}`) ?? 0) / golds[i]!.length : undefined })),
    ),
    items: input.maps.flatMap((m, i) => (m.uses ?? []).map((u, j) => ({ ...u, key: m.key, label: m.label, share: entering[i]! ? made[i]![j]! / entering[i]! : undefined }))),
    losses: [...lost].map(([unit, c]) => ({ unit, chance: c / n })).sort((a, b) => b.chance - a.chance || a.unit.localeCompare(b.unit)),
    exp: expTallies.flatMap((t, i) => {
      if (!t) return [];
      const m = input.maps[i]!;
      const units = [...t.units].map(([unit, e]): UnitExp => {
        const sorted = [...e.levels].sort((a, b) => a - b);
        return {
          unit,
          name: e.name,
          priority: input.priority?.[i]?.[unit] ?? 'normal',
          exp: e.exp / t.runs,
          level: { low: quantile(sorted, 0.1), median: quantile(sorted, 0.5), high: quantile(sorted, 0.9) },
          kills: Object.fromEntries(Object.entries(e.kills).map(([g, n]) => [g, n / t.runs])),
        };
      });
      return [{ key: m.key, label: m.label, runs: t.runs, groups: t.groups.map(({ key, name, className, count }) => ({ key, name, className, count })), units }];
    }),
    milestones: checks.map((c, k) => {
      const x = checked[k]!;
      const sorted = [...x.levels].sort((a, b) => a - b);
      return { id: c.id, chance: x.runs ? x.met / x.runs : undefined, runs: x.runs, level: sorted.length ? quantile(sorted, 0.5) : undefined };
    }),
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
