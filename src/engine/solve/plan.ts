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
import { pinLoss, type Roster, type RosterUnit } from '../roster';

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

/** A held item's planned use or carrier (#193): the item, who holds or uses it, and from which map. */
export type PlanItem = { readonly item: string; readonly unit: RosterUnit; readonly key: string };

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
};

/** Robin as the plan has it: the run facts, with whatever they leave open chosen by the plan. */
export type PlanRobin = { readonly gender: Gender; readonly asset: Stat; readonly flaw: Stat };

export type Plan = {
  readonly robin: PlanRobin;
  readonly wishlist: Wishlist;
  readonly roadmap: Roadmap;
};

/**
 * A pin (#200 adds span, carrier, side-goal and keep-in/out pins): a hard constraint on the solve. A marriage pin keeps
 * a couple the player wants. Recorded facts are never pins.
 */
export type PlanPin = { readonly kind: 'marriage'; readonly couple: readonly [RosterUnit, RosterUnit] };

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
  converged: boolean;
};

/** Where the search stands between steps (#199): plain JSON the caller passes back unchanged. */
export type SolveCursor = {
  /** Evaluations spent over every step so far. */
  readonly evaluations: number;
  readonly search?: SearchState;
};

/**
 * The roster's pinned marriages as marriage pins, each couple once: what the player kept on today's Plan page, until
 * the pins move into the plan's edits (#205). A lost pin (either unit dead, missed or benched) isn't one.
 */
export function marriagePins(roster: Roster): PlanPin[] {
  const out: PlanPin[] = [];
  for (const [u, s] of Object.entries(roster.spouses) as [RosterUnit, Roster['spouses'][RosterUnit]][])
    if (s?.bond === 'pinned' && !pinLoss(roster, u) && !out.some((p) => p.couple.includes(u))) out.push({ kind: 'marriage', couple: [u, s.partner] });
  return out;
}
