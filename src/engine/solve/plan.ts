/**
 * The plan (#198; spec #175, The objective and The joint solve): a wishlist plus its roadmap, ranked by its flawless
 * chance. The seed (`seed.ts`) proposes the first one, the local search (`step.ts`, #199) improves it one edit at a time (`edits.ts`), and pins
 * (#200) constrain it; the flawless chance evaluates it (`flawlessChance(run, { plan })`).
 *
 * A plan is plain JSON: ids and keys only, no class instances or functions, so it can be stored (#205), posted from the
 * solve's Web Worker (#199) and compared by value. The same plan, record and seed always give the same chance.
 *
 * What already happened is the starting state, never part of the plan's choice: a recorded marriage stays whatever the
 * plan lists (the simulation reads the log first), and maps already played aren't on the roadmap.
 */
import type { ChildId } from '../../game-data/children';
import type { ClassId } from '../../game-data/classes';
import type { SkillId } from '../../game-data/skills';
import type { Gender, Stat } from '../../game-data/stats';
import type { RosterUnit } from '../roster';
import type { SideGoalDecision, SideGoalId, SideGoalPlan } from '../side-goals';

/** Where a unit stands in one map's lineup: Lead (with or without a Back), Back, or Solo (fielded unpaired). */
export type Position = 'lead' | 'back' | 'solo';

/** A unit of the wishlist: its place in the endpoint's lineup, its endpoint class and its 5-skill build. */
export type WishlistUnit = {
  readonly unit: RosterUnit;
  readonly position: Position;
  /** A Lead's Back, or a Back's Lead; absent for a Solo unit or a Lead with no Back. */
  readonly partner?: RosterUnit;
  /** The class it fights the endpoint in. */
  readonly classId: ClassId;
  /** Its 5-skill build, in the template's slot order (fewer when the template's slots can't all be filled). */
  readonly build: readonly SkillId[];
};

/**
 * A child the plan recruits: its parents (the fixed parent first; Chrom's wife may be the Maiden) and the skill each
 * passes at paralogue entry (null: none planned, e.g. the Maiden, or a child already recruited).
 */
export type WishlistChild = {
  readonly child: ChildId;
  readonly parents: readonly [RosterUnit, RosterUnit | 'maiden'];
  readonly passes: readonly [SkillId | null, SkillId | null];
};

/** A reserve (#202): who steps in first, and the likely loss it mainly covers. */
export type WishlistReserve = { readonly unit: RosterUnit; readonly covers: RosterUnit | null };

/** The army the plan fields at its endpoint, with its builds, its children's inheritance, marriages and reserves. */
export type Wishlist = {
  /** The endpoint's key on the map order (`apotheosis-secret` on the Full route). */
  readonly endpoint: string;
  /** The endpoint's lineup, in lineup order: each Lead followed by its Back, then Solo units. */
  readonly units: readonly WishlistUnit[];
  /** Every couple the plan marries (the recorded ones included), each once. */
  readonly marriages: readonly (readonly [RosterUnit, RosterUnit])[];
  readonly children: readonly WishlistChild[];
  /** Ordered: who steps in first. Empty until the reserves are chosen (#202). */
  readonly reserves: readonly WishlistReserve[];
};

/** One map's lineup on the roadmap: its pairs (Lead, and Back if any) and units fielded alone. */
export type PlanLineup = {
  /** The map's key on the map order. */
  readonly key: string;
  readonly pairs: readonly { readonly lead: RosterUnit; readonly back?: RosterUnit }[];
  readonly solo: readonly RosterUnit[];
};

/**
 * A class change the roadmap plans (#194), a class-reached milestone: the unit, the class it reaches, the seal, and the
 * map that needs the class (it's used by that map's preparations at the latest; at the unit's level cap if sooner).
 */
export type PlanSeal = { readonly unit: RosterUnit; readonly classId: ClassId; readonly seal: 'master' | 'second'; readonly key: string };

/**
 * A unit's EXP priority over a span of the map order (#195), both ends included by map key: high takes the kills, low
 * chips and waits for the others. A unit on a map no priority names is normal.
 */
export type PlanPriority = { readonly unit: RosterUnit; readonly priority: 'high' | 'low'; readonly from: string; readonly to: string };

/**
 * A held item's planned use or carrier (#193; `item-plan.ts`): the item, the unit, the map key, and which copy
 * (`source`, an `ItemSource` id). A booster is drunk by the unit in that map's preparations; a tonic too (a held one
 * first, else bought at an open armory there: `source` is `buy`); a weapon is handed to its carrier there and stays
 * with it until the weapon's next entry. Boots and the Arms Scroll get one only from a pin, and it moves nothing.
 */
export type PlanItem = { readonly item: string; readonly unit: RosterUnit; readonly key: string; readonly source: string };

/** The way from today to the wishlist. */
export type Roadmap = {
  /**
   * The maps still to play, in play order, through the endpoint: the map order's keys, child paralogues where the plan
   * places them. A plan whose order isn't the map order's maps plays the map order's template.
   */
  readonly order: readonly string[];
  /**
   * The lineups the plan decides, by map. A map without one plays the greedy lineup: forced units first, then pairs by
   * coverage (`suggestDeployment`) over the army as the plan's projection has it there, each couple the plan marries
   * paired until it marries. The seed decides only the endpoint's (the wishlist's); the search adds the rest as it edits
   * them. `roadmapLineups` resolves every map's.
   */
  readonly lineups: readonly PlanLineup[];
  /** Planned class changes, each unit's in the order it makes them: a unit with none never changes class. */
  readonly seals: readonly PlanSeal[];
  /** Planned item uses; empty until the item plan (#193). */
  readonly items: readonly PlanItem[];
  /**
   * The EXP priorities the plan sets (#195). Absent: everyone normal in the flawless chance; the EXP forecast then
   * reads the default from the milestones (`defaultPriorities`).
   */
  readonly priorities?: readonly PlanPriority[];
  /**
   * The optional maps the plan plays (spec #175 story 31: Infinite Regalia on the Full route, kept only if its rewards
   * earn its risk), by key. An optional map not listed is skipped: `order` still lists it, the runs pass it by. Absent
   * or empty: every optional map skipped (the seed's rule; the search's `optional` edit keeps one when it pays).
   */
  readonly optional?: readonly string[];
  /**
   * The plan's side goal decisions (spec #175 story 48): each goal on the maps ahead chased or skipped. The seed takes
   * the default rule (`chaseByDefault`); the search's `side-goal` edit turns one. The player's pins (`Run.sideGoals`)
   * win over them; a goal with none here follows the default rule.
   */
  readonly sideGoals?: SideGoalPlan;
};

/**
 * The roadmap's map-level choices a rebuilt plan keeps as they were (a marriage or Robin edit, a unit's worth): the
 * optional maps it plays and its side goal decisions.
 */
export const keptChoices = (plan: Plan): Pick<Roadmap, 'optional' | 'sideGoals'> => ({
  ...(plan.roadmap.optional ? { optional: plan.roadmap.optional } : {}),
  ...(plan.roadmap.sideGoals ? { sideGoals: plan.roadmap.sideGoals } : {}),
});

/** Robin as the plan has it: the run facts, with whatever they leave open chosen by the plan. */
export type PlanRobin = { readonly gender: Gender; readonly asset: Stat; readonly flaw: Stat };

export type Plan = {
  readonly robin: PlanRobin;
  readonly wishlist: Wishlist;
  readonly roadmap: Roadmap;
};

/**
 * A pin (#200; spec #175, The joint solve): a hard constraint on the solve. The seed and every edit keep it, and the
 * runs play it; what keeping them costs is the **pin cost** (`pinCost`). Recorded facts are never pins: a pin on what
 * already happened (a couple the log marries, a span that's all played, a side goal on a recorded map) or on a unit
 * that is dead or missed is dropped (`livePins`). Stored on the run (`Run.pins`; side goals in `Run.sideGoals`).
 *
 * - **Marriage:** a couple the player wants; or, with `forbid`, a couple ruled out (#205: the retired Plan page's rule-outs migrate to these),
 *   which no plan marries. Either way the same choice (`pinKey`), so pinning a ruled-out couple replaces the rule-out.
 * - **Span:** a position (Lead, Back, Solo, or out of the lineup) or a pair (with `partner`) kept over a span of the
 *   map order: one map (`to` = `from`, the preparation page's default: `mapSpanPin`), a range, or from a map on (`to`
 *   absent: to the endpoint). "Robin leads Prologue–Ch 9"; "Chrom backs Robin from Ch 5".
 * - **Keep-in / keep-out:** a unit in the wishlist (fielded at the endpoint), or out of it and never fielded (unless a
 *   map forces it or a span pin fields it there).
 * - **Side goal:** always take or skip (#191); stored as `Run.sideGoals`, read as pins.
 * - **Item (#193):** overrides the item plan for the first copy of its item the plan holds (by the time it arrives): a
 *   booster pin gives a booster (or Boots) to a unit, on a map when `key` is set, else on the first map the unit can
 *   drink it; a carrier pin hands a weapon to a unit from a map on ("Gradivus stays with Lucina from P21").
 * - **Robin Lock (#201):** the Robin the player starts the game with. Locking writes it into the run facts (`withRobinLock`),
 *   so only that Robin is solved from then on; `open` names the facts it filled, which lifting the lock opens again (the
 *   Robin alternatives read "what this lock cost" on the run with it lifted).
 */
export type PlanPin = MarriagePin | SpanPin | KeepPin | SideGoalPin | ItemPin | RobinLockPin;

/** The run facts a Robin Lock can fill. */
export type RobinFact = 'gender' | 'asset' | 'flaw';

export type RobinLockPin = { readonly kind: 'robin-lock'; readonly robin: PlanRobin; readonly open: readonly RobinFact[] };

export type MarriagePin = {
  readonly kind: 'marriage';
  readonly couple: readonly [RosterUnit, RosterUnit];
  /** A rule-out: the couple never marries in a plan. */
  readonly forbid?: true;
};

/** A marriage pin the plan must make (not a rule-out). */
export const isMarriagePin = (p: PlanPin): p is MarriagePin => p.kind === 'marriage' && !p.forbid;
/** A marriage pin ruling its couple out. */
export const isRuleOut = (p: PlanPin): p is MarriagePin => p.kind === 'marriage' && p.forbid === true;

/** Where a span pin keeps its unit: a position, or out of the lineup. */
export type SpanPosition = Position | 'out';

export type SpanPin = {
  readonly kind: 'span';
  readonly unit: RosterUnit;
  readonly position: SpanPosition;
  /** Lead or Back: the unit it pairs with; absent: any (a Lead may have none). */
  readonly partner?: RosterUnit;
  /** The first map's key on the map order. */
  readonly from: string;
  /** The last map's key; absent: to the endpoint. */
  readonly to?: string;
};

export type KeepPin = { readonly kind: 'keep'; readonly unit: RosterUnit; readonly keep: 'in' | 'out' };

export type SideGoalPin = { readonly kind: 'side-goal'; readonly goal: SideGoalId; readonly decision: SideGoalDecision };

/** The item pins (#193): a booster to a unit, a weapon's carrier from a map on. */
export type ItemPin =
  | { readonly kind: 'booster'; readonly item: string; readonly unit: RosterUnit; readonly key?: string }
  | { readonly kind: 'carrier'; readonly item: string; readonly unit: RosterUnit; readonly key: string };

/**
 * A span pin over one map: what the preparation page sets ("pick a back", "drop a unit"), defaulting to that map only.
 * Widen it with `to` (a later key), or drop `to` for "from this map on".
 */
export function mapSpanPin(unit: RosterUnit, position: SpanPosition, key: string, partner?: RosterUnit): SpanPin {
  return { kind: 'span', unit, position, ...(partner ? { partner } : {}), from: key, to: key };
}

/** An improvement the search found (#199): the plan with the edit, what it changes, and its gain in flawless chance. */
export type PlanProposal = {
  readonly plan: Plan;
  /** The edit that made it. */
  readonly label: string;
  /** Every edit it makes to the adopted plan, in the order the search kept them (this one last). */
  readonly edits: readonly string[];
  /** Flawless chance gained over the adopted plan, on the same runs. */
  readonly gain: number;
  /** Its paired simulation error (±, 95%). */
  readonly margin: number;
  /** The runs compared. */
  readonly runs: number;
};

/**
 * An edit still unclear at the run cap (#199): no measurable difference either way, so the player can pick whichever
 * they like. Its gain over the best plan and the paired error (±, 95%).
 */
export type CloseCall = {
  readonly key: string;
  readonly plan: Plan;
  readonly label: string;
  readonly gain: number;
  readonly margin: number;
  readonly runs: number;
};

/** A set of marriages (or a Robin) the search didn't evaluate: its ceiling is below the best found (#199). */
export type PrunedComp = { readonly label: string; readonly ceiling: number; readonly best: number };

/** The edit the search is comparing with the best plan, and the runs it has of it (#199). */
export type SearchTrial = {
  readonly kind: string;
  readonly key: string;
  readonly label: string;
  readonly plan: Plan;
  readonly samples: number[];
  /** The runs it's compared on this time. */
  target: number;
  /** Its non-starter couples (#194). */
  readonly stuck?: string[][];
};

/** The local search's whole state between steps (#199): plain JSON. */
export type SearchState = {
  /** The plan the search started from: the adopted plan, or the seed. */
  start: Plan;
  best: Plan;
  /** The best plan's runs on the search's seed, in run order. */
  bestSamples: number[];
  /** The start's runs, kept once the best plan moves off it (proposals' gains are over the start). */
  startSamples: number[] | null;
  /** Labels of the edits kept, in order. */
  kept: string[];
  proposals: PlanProposal[];
  closeCalls: CloseCall[];
  pruned: PrunedComp[];
  round: number;
  /** Keys of the edits tried this round. */
  tried: string[];
  /** This round kept an edit. */
  improved: boolean;
  trial: SearchTrial | null;
  /** The best plan's displayed chance is worked out. */
  scored: boolean;
  /** The maps the best plan loses the most on, riskiest first (its re-score's). */
  riskiest: string[];
  /** The best plan's non-starter couples (#194); null until read. */
  stuck: string[][] | null;
  converged: boolean;
};

/** Where the search stands between steps (#199): plain JSON the caller passes back unchanged. */
export type SolveCursor = {
  /** Evaluations spent over every step so far. */
  readonly evaluations: number;
  readonly search?: SearchState;
};
