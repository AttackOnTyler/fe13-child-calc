/**
 * The chapter log (#116; Map: Route planner #87): a run's copy-forward record, one entry per map played. Each entry
 * holds a snapshot of the army: every unit's class, level, EXP, actual stats, equipped skills, inventory and support
 * ranks, plus the convoy, gold, unit states and marriages. The roster's unit states and spouses come from the latest
 * entry; everything else on the roster (Run facts, rule-outs, the saved plan, deploy flags) stays on the run.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { MAPS, type ChapterData } from '../game-data/chapters';
import type { ClassId } from '../game-data/classes';
import { JOIN_DATA, basesOn } from '../game-data/join';
import { ASSET_FLAW, ROBIN_MODIFIERS } from '../game-data/robin';
import { MOD_STATS, STATS, type Gender, type ModStat, type Modifiers, type Stat } from '../game-data/stats';
import { childParalogueGates } from './child-paralogues';
import { DEFAULT_ASSUMPTIONS, type Assumptions } from './assumptions';
import { childJoinStats, classBaseStats, type ChildJoinStats, type JoinParent } from './child-join';
import { className, startClass } from './classes';
import { classIdByName } from './supply';
import { robinBases } from './unit-page';
import { FORGE, forgeProblem, itemByName } from '../game-data/items';
import { SKILLS } from '../game-data/skills';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { parseClassChanges, parseCountOverrides, type ClassChange } from './internal-level';
import { entryAfterShopping, parseShopLines, type ShopLine } from './shopping';
import { parseSideGoalPlan, parseSideGoalsSecured, type SideGoalId, type SideGoalPlan } from './side-goals';
import { parseRenown, type RunRenown } from './renown';
import { parseItemsUsed, type ItemUsed } from './item-plan';
import type { Plan, PlanPin } from './solve/plan';
import { parsePins } from './solve/pins';
import type { CheckOutcome, Observation } from './checks';
import { EMPTY_ROSTER, parseRoster, withSpouse, withState, type Roster, type RosterUnit, type RunFacts } from './roster';

export type SupportLevel = 'C' | 'B' | 'A' | 'S';
export const SUPPORT_LEVELS: readonly SupportLevel[] = ['C', 'B', 'A', 'S'];

/** An item a unit or the convoy holds: uses left, and its forge (name and bonuses) if forged. */
export type HeldItem = {
  readonly item: string;
  readonly uses: number | null;
  readonly forge?: { readonly name: string; readonly mt: number; readonly hit: number; readonly crit: number };
};

/** One unit as its stat screen shows it, without pair-up. Stats are null until recorded (a child's recruit). */
export type UnitSnapshot = {
  readonly class: string;
  readonly level: number;
  readonly promoted: boolean;
  readonly reclassed: boolean;
  readonly exp: number;
  readonly stats: Readonly<Record<Stat, number>> | null;
  /** Equipped skills, at most 5. */
  readonly skills: readonly string[];
  readonly inventory: readonly HeldItem[];
  readonly supports: readonly { readonly partner: RosterUnit; readonly rank: SupportLevel }[];
};

export type Snapshot = {
  readonly units: Readonly<Partial<Record<RosterUnit, UnitSnapshot>>>;
  readonly convoy: readonly HeldItem[];
  readonly gold: number | null;
  readonly states: Roster['states'];
  readonly spouses: Roster['spouses'];
};

/** `other`: a map the planner doesn't offer (a skirmish, a grind or gold map, the log's starting point). */
export type RunEntry = {
  readonly id: string;
  /** A map id from the chapter data, or `other`. */
  readonly map: string;
  /** For `other`, what was played. */
  readonly label?: string;
  readonly snapshot: Snapshot;
  readonly createdAt: number;
  /** When it was last edited after later entries were copied from it. */
  readonly editedAt?: number;
  /** Class changes made on this map (#185): never copied forward. */
  readonly classChanges?: readonly ClassChange[];
  /**
   * The shopping step (#192): buys, sales and forges after the map, each with its gold. The snapshot's gold is gold at
   * the map's end; the next entry copies the snapshot after shopping (`entryAfterShopping`).
   */
  readonly shopping?: readonly ShopLine[];
  /** The side goals on this map secured or not, as Record results set them (#191); absent: pre-filled from the convoy. */
  readonly sideGoals?: Readonly<Partial<Record<SideGoalId, boolean>>>;
  /** The items used in this map's preparations, as Record results set them (#193); absent: pre-filled from the plan. */
  readonly itemsUsed?: readonly ItemUsed[];
  /**
   * What the plan forecast before this map was recorded (#206): the headline and the EXP forecast for the map it
   * expected next, and each unit's reading. What changed reads it against the headline after; absent: not worked out
   * when the map was recorded.
   */
  readonly forecast?: EntryForecast;
  /**
   * Units that fell on the map on Casual (#208): each came back after it, keeping its slot and children, so it isn't a
   * loss; the fall is logged for calibration (`falls`) and What it cost prices the rest of the map it missed.
   */
  readonly fell?: readonly RosterUnit[];
  /**
   * The checks this map offered (#209), kept when the map's entry is made (Record results' Checks step lists only these),
   * each with the raw observation once taken and what it did to the rule.
   */
  readonly checks?: readonly EntryCheck[];
};

/** A check a map offered (#209): the rule, what to do and note, and, once Record results took it, the observation and its outcome. */
export type EntryCheck = {
  readonly rule: string;
  readonly text: string;
  readonly observed?: Observation;
  readonly outcome?: CheckOutcome;
};

/**
 * The plan's forecast as it stood when a map was recorded (#206; What changed): the headline flawless chance with its ±,
 * the map it expected next (its key on the map order, and the map), each unit's forecast EXP there (mean, and its level
 * at the map's end, 10th percentile to 90th, EXP as the fraction), and each unit's reading (`pending`: "at risk?").
 * #208 adds the map's no-death chance (the fall log's calibration reads it) and the plan's spending at the armory stop
 * after the map (What it cost's over-plan spending row reads the recorded shopping against it).
 */
export type EntryForecast = {
  readonly chance: number;
  readonly margin: number;
  readonly key: string;
  readonly map: string;
  readonly noDeath?: number;
  readonly spend?: number;
  /**
   * Each unit's forecast EXP on the map and its level spread; `factor`: the learned correction it was forecast under
   * (#196; absent: none), which learning takes back out to read against the uncorrected forecast.
   */
  readonly exp: readonly { readonly unit: RosterUnit; readonly exp: number; readonly level: { readonly low: number; readonly median: number; readonly high: number }; readonly factor?: number }[];
  readonly readings: readonly { readonly unit: RosterUnit; readonly reading: 'on-track' | 'at-risk' | 'behind'; readonly pending?: true }[];
};

/**
 * The playthrough as `run:v2` stores it (#205; spec #175, Pages, storage and migration): the chapter log with its
 * Record results steps, the pins (marriage and rule-out, keep-in/out, span, item, side goal, and the Robin Lock once
 * #201 adds its kind), dismissed proposals and What changed cards (#206), learned corrections and the calibration log
 * (#196), and the one-time migration note. A `run:v1` save is migrated once (`migrateRun`); export and import carry
 * the run as it is.
 */
export type Run = {
  readonly version: 2;
  /** Lunatic+ random skills the player saw on a map's enemies (#120): map id → foe key → skills. */
  readonly seen?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /**
   * Everything on the roster but unit states and spouses: Run facts. A migrated run's rule-outs are empty (they became
   * pins); nothing writes them since #212 retired the Plan page.
   */
  readonly roster: Roster;
  /** In play order. */
  readonly entries: readonly RunEntry[];
  /** Each unit's Second Seal count from history the log can't see, set by hand (#185). */
  readonly countOverrides?: Readonly<Partial<Record<RosterUnit, number>>>;
  /** Side goals pinned to always take or skip (#191); the rest follow the default rule. */
  readonly sideGoals?: SideGoalPlan;
  /** The file's renown, asked once (#191): its start and the rewards already claimed. */
  readonly renown?: RunRenown;
  /**
   * The player's pins (#200): marriage, span, keep-in/out and item pins (#193), hard constraints on the solve. Side goals
   * stay in `sideGoals` and read as pins (`runPins`). A save from before #200 kept item pins as `itemPins`; they're read in.
   */
  readonly pins?: readonly PlanPin[];
  /** Proposals the player dismissed (#204, #206), by id (`proposalId`). */
  readonly dismissedProposals?: readonly string[];
  /**
   * The adopted plan (#204): the plan the player took (a proposal or close call accepted, a Robin chosen, a plan edit
   * made), which the solve starts from and every edit's cost is read against. Absent: the seed. Proposals never
   * replace it on their own.
   */
  readonly adopted?: Plan;
  /** The player's edits (#204), in the order made: each pin it set and the adopted plan it replaced, for undo. */
  readonly edits?: readonly RunEdit[];
  /** Entries whose What changed card was dismissed with "got it" (#206), by entry id. */
  readonly dismissedChanges?: readonly string[];
  /** Learned corrections (#196): each unit's EXP factor (×0.5–×2), and whether the player switched them off. */
  readonly corrections?: LearnedCorrections;
  /** The calibration log (#196): each recorded result's percentile in its forecast. */
  readonly calibration?: readonly CalibrationRow[];
  /** The one-time migration note (#205): shown on the Run view until dismissed. */
  readonly migration?: MigrationNote;
  /**
   * Losses the player has settled (#208): a death, a missed recruit or an off-plan marriage whose loss item was accepted
   * (or seen, when it changed nothing), by key (`dead:<unit>`, `missed:<unit>`, `married:<a>+<b>`). Until then, the
   * adopted plan predates it.
   */
  readonly settledLosses?: readonly string[];
};

/**
 * One of the player's edits (#204), as "Your edits" lists it: its words, the pins it set (#200) and, for an edit of the
 * adopted plan, the plan it replaced (`before`; null: the seed), so undo lifts the pins or restores the plan. `cost` is
 * what it cost when made, where read; `accepted` marks one taken from the search (a proposal, a close call).
 */
export type RunEdit = {
  readonly label: string;
  readonly pins?: readonly PlanPin[];
  readonly before?: Plan | null;
  readonly cost?: { readonly gain: number; readonly margin: number; readonly verdict: 'better' | 'worse' | 'close' | 'unclear' };
  readonly accepted?: true;
};

export type LearnedCorrections = {
  readonly units: Readonly<Partial<Record<RosterUnit, number>>>;
  /** Switched off: forecasts read uncorrected. */
  readonly off?: true;
};

/** A recorded result against its forecast: the unit's EXP (or level) percentile, 0–1, on an entry. */
export type CalibrationRow = { readonly entry: string; readonly unit: RosterUnit; readonly percentile: number };

/**
 * What the migration from `run:v1` and `plan:v1` kept (as pins) and dropped, in the player's words, and the children
 * the former priorities suggest keeping in.
 */
export type MigrationNote = {
  readonly kept: readonly string[];
  readonly dropped: readonly string[];
  readonly keepIn: readonly RosterUnit[];
};

/** Clamp for a learned correction's factor. */
export const CORRECTION_RANGE = { min: 0.5, max: 2 } as const;

export const EMPTY_SNAPSHOT: Snapshot = { units: {}, convoy: [], gold: null, states: {}, spouses: {} };

/** A run whose first entry is an existing roster (#116 migration): its unit states and marriages, nothing else yet. */
export function runFromRoster(roster: Roster, now = 0): Run {
  const first: RunEntry = {
    id: 'e1',
    map: 'other',
    label: 'Before the chapter log',
    snapshot: { ...EMPTY_SNAPSHOT, states: roster.states, spouses: roster.spouses },
    createdAt: now,
  };
  return { version: 2, roster: { ...roster, states: {}, spouses: {} }, entries: [first] };
}

export const EMPTY_RUN: Run = runFromRoster(EMPTY_ROSTER);

export const latestEntry = (run: Run): RunEntry | undefined => run.entries[run.entries.length - 1];

/** The roster the rest of the app reads: unit states and spouses from the latest entry. */
export function rosterOf(run: Run): Roster {
  const e = latestEntry(run);
  return e ? { ...run.roster, states: e.snapshot.states, spouses: e.snapshot.spouses } : run.roster;
}

/** A roster edit written back: unit states and spouses into the latest entry, the rest onto the run. */
export function withRoster(run: Run, roster: Roster): Run {
  const e = latestEntry(run);
  const base = { ...roster, states: {}, spouses: {} };
  if (!e) return { ...run, roster: base, entries: [{ id: 'e1', map: 'other', label: 'Before the chapter log', snapshot: { ...EMPTY_SNAPSHOT, states: roster.states, spouses: roster.spouses }, createdAt: 0 }] };
  const entries = [...run.entries];
  entries[entries.length - 1] = { ...e, snapshot: { ...e.snapshot, states: roster.states, spouses: roster.spouses } };
  return { ...run, roster: base, entries };
}

const UNIT_BY_NAME = new Map<string, RosterUnit>([
  ['Robin', 'robin'],
  ...(Object.entries(FIRST_GEN_UNITS).map(([id, u]) => [u.name as string, id as RosterUnit]) as [string, RosterUnit][]),
  ...(Object.entries(CHILD_UNITS).map(([id, u]) => [u.name as string, id as RosterUnit]) as [string, RosterUnit][]),
]);

/** Every roster unit's id. */
const UNIT_BY_NAME_IDS = new Set<string>(['robin', ...Object.keys(FIRST_GEN_UNITS), ...Object.keys(CHILD_UNITS)]);

/** The roster unit chapter data names (`Robin`, `Lon'qu`, `Morgan`…). */
export const unitNamed = (name: string): RosterUnit | undefined => UNIT_BY_NAME.get(name);

type MapRecruit = ChapterData['recruits'][number];

/** A setup used only on its map (Premonition's Chrom and Robin, #131): fielded there, never joining the army. */
const mapOnly = (r: MapRecruit) => r.stats !== undefined;

/** A stat of a setup used only on one map, as FEW prints it (`38 (35 if flaw, 43 if asset)`), for the run's Robin. */
function setupStat(text: string, stat: Stat, run: RunFacts): number {
  const m = text.match(/^(\d+)(?: \((\d+) if flaw, (\d+) if asset\))?/);
  if (!m) return 0;
  return Number(stat === run.asset && m[3] ? m[3] : stat === run.flaw && m[2] ? m[2] : m[1]);
}

/** A unit's gender in the run: Robin's from the run facts (null until set). */
function genderIn(run: Run, u: RosterUnit): Gender | null {
  if (u === 'robin') return run.roster.run.gender ?? null;
  return u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].gender : FIRST_GEN_UNITS[u as UnitId].gender;
}

/** Where a child's join stats stand in the log (#155): worked out, or why not. */
export type ChildJoin = {
  /** Its parents: the fixed one, then its recorded spouse (the Maiden, if recorded as Chrom's wife); null if unmarried. */
  readonly parents: readonly [RosterUnit, RosterUnit | 'maiden'] | null;
  /** The fixed parent with no spouse in the log. */
  readonly unmarried?: RosterUnit;
  /** Parents whose stats, or a class with known bases, aren't logged. */
  readonly missing: readonly RosterUnit[];
  /** The child's start class, when its parents are known (Morgan's follows the spouse). */
  readonly startClass: ClassId | null;
  readonly join: ChildJoinStats | null;
};

/** Morgan's start class: the spouse's starting class, or a Tactician after a Lord, Dancer or Conqueror (classes.ts). */
export function morganStart(child: ChildId, spouse: RosterUnit | 'maiden', assumptions: Assumptions): ClassId | null {
  if (spouse === 'maiden' || spouse === 'robin') return null;
  const secondGen = spouse in CHILD_UNITS;
  const baseClass = secondGen ? CHILD_UNITS[spouse as ChildId].defaultClassSet[0] : FIRST_GEN_UNITS[spouse as UnitId].classes[0];
  return baseClass ? startClass(CHILD_UNITS[child], { baseClass, secondGen }, assumptions).startClass : null;
}

/** A first-gen parent's or Robin's cap modifiers; a child parent's depend on its own parents, so they're left out. */
function parentModifiers(run: Run, u: RosterUnit | 'maiden'): Modifiers | undefined {
  if (u === 'robin') {
    const { asset, flaw } = run.roster.run;
    if (!asset || !flaw) return undefined;
    return Object.fromEntries(MOD_STATS.map((s) => [s, ROBIN_MODIFIERS[s] + (ASSET_FLAW[asset].assetModifier[s] ?? 0) + (ASSET_FLAW[flaw].flawModifier[s] ?? 0)])) as Record<ModStat, number>;
  }
  return u in CHILD_UNITS ? undefined : FIRST_GEN_UNITS[u as UnitId].modifiers;
}

/**
 * A child's join stats from a snapshot of its parents (#155): the entry before its map, so the parents as they were on
 * entering. Its parents are the fixed one and that one's recorded spouse (Morgan: Robin's). The Maiden, recorded as
 * Chrom's wife (#154), has no stats: her side is an assumption. The stats are worked out only when both parents' stats
 * and classes are logged there.
 */
export function childJoinFrom(run: Run, before: Snapshot, child: ChildId, assumptions: Assumptions = DEFAULT_ASSUMPTIONS): ChildJoin {
  const fixed: RosterUnit = CHILD_UNITS[child].fixedParent;
  const bond = before.spouses[fixed];
  const spouse = bond?.bond === 'married' ? bond.partner : undefined;
  if (!spouse) return { parents: null, unmarried: fixed, missing: [], startClass: null, join: null };
  const start = CHILD_UNITS[child].fixedParent === 'robin' ? morganStart(child, spouse, assumptions) : (CHILD_UNITS[child].defaultClassSet[0] ?? null);
  const missing: RosterUnit[] = [];
  const parentOf = (u: RosterUnit | 'maiden'): JoinParent | null => {
    if (u === 'maiden') return 'maiden';
    const snap = before.units[u];
    const cls = snap && classIdByName(snap.class);
    const gender = genderIn(run, u);
    if (!snap?.stats || !cls || !gender || !classBaseStats(cls, gender)) return (missing.push(u), null);
    return { stats: snap.stats, class: cls, gender };
  };
  const a = parentOf(fixed);
  const b = parentOf(spouse);
  const parents = [fixed, spouse] as const;
  if (!a || !b || !start) return { parents, missing, startClass: start, join: null };
  const ma = parentModifiers(run, fixed);
  const mb = parentModifiers(run, spouse);
  const modifiers = ma && mb && (Object.fromEntries(MOD_STATS.map((s) => [s, ma[s] + mb[s] + 1])) as Record<ModStat, number>);
  return { parents, missing, startClass: start, join: childJoinStats({ child, parents: [a, b], startClass: start, ...(modifiers ? { modifiers } : {}) }, assumptions) };
}

/**
 * A recruit's first snapshot (#116): a first-gen unit or Robin from its join data. A child's comes from its parents in
 * `before`, the snapshot before its map (#155); without them its stats stay blank. A setup used only on one map
 * (Premonition's Chrom and Robin, #131) is the map's record, stats and all.
 */
export function recruitSnapshot(
  unit: RosterUnit,
  run: Run,
  fromMap?: Pick<MapRecruit, 'class' | 'level' | 'inventory' | 'stats'>,
  before: Snapshot = EMPTY_SNAPSHOT,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
): UnitSnapshot {
  if (fromMap?.stats) {
    const stats = Object.fromEntries(STATS.map((s) => [s, setupStat(fromMap.stats![s], s, run.roster.run)])) as Record<Stat, number>;
    return { class: fromMap.class, level: Number(fromMap.level) || 1, promoted: false, reclassed: false, exp: 0, stats, skills: [], inventory: startingItems(fromMap), supports: [] };
  }
  const difficulty = run.roster.run.difficulty === 'normal' ? 'normal' : run.roster.run.difficulty === 'hard' ? 'hard' : run.roster.run.difficulty ? 'lunatic' : 'normal';
  if (unit !== 'robin' && unit in CHILD_UNITS) {
    const child = unit as ChildId;
    const j = childJoinFrom(run, before, child, assumptions);
    const cls = j.startClass ? className(j.startClass, CHILD_UNITS[child].gender) : (fromMap?.class ?? '');
    return { class: cls, level: Number(fromMap?.level) || 1, promoted: false, reclassed: false, exp: 0, stats: j.join?.stats ?? null, skills: [], inventory: startingItems(fromMap), supports: [] };
  }
  const j = JOIN_DATA[unit as Exclude<UnitId, 'maiden'> | 'robin'];
  // Robin's bases shift with the run's asset and flaw.
  const r = run.roster.run;
  const bases = unit === 'robin' && r.gender && r.asset && r.flaw ? robinBases({ kind: 'robin', gender: r.gender, asset: r.asset, flaw: r.flaw }) : basesOn(j, difficulty);
  const gender = unit === 'robin' ? (run.roster.run.gender ?? 'M') : (FIRST_GEN_UNITS[unit as UnitId].gender as Gender);
  return {
    class: className(j.joinClass, gender),
    level: j.level,
    promoted: false,
    reclassed: false,
    exp: 0,
    stats: Object.fromEntries(STATS.map((s) => [s, bases[s]])) as Record<Stat, number>,
    // By name, as Record results writes skills and the combat math reads them (the join data keys them by id).
    skills: j.startingSkills.slice(0, 5).map((id) => SKILLS[id].name),
    inventory: startingItems(fromMap),
    supports: [],
  };
}

/** The items a recruit joins with (the map's record), each at full uses. */
function startingItems(fromMap?: { readonly inventory?: readonly string[] }): HeldItem[] {
  return (fromMap?.inventory ?? []).map((name) => {
    const it = itemByName(name);
    return { item: it?.name ?? name, uses: it?.uses ?? null };
  });
}

/**
 * What's wrong with a held item against the item data (#117): an unknown item, more uses than it has, or a forge the
 * rules don't allow (a weapon that can't be forged, bonuses off the +1 Mt / +5 Hit / +3 Crit steps, or past the limits).
 */
export function heldProblems(h: HeldItem): string[] {
  const it = itemByName(h.item);
  if (!it) return [`${h.item}: not an item in the data`];
  const out: string[] = [];
  if (h.uses !== null && it.uses !== undefined && (h.uses < 0 || h.uses > it.uses)) out.push(`${it.name}: ${h.uses} uses, but it has at most ${it.uses}`);
  if (h.forge) {
    const levels = { mt: h.forge.mt / FORGE.step.mt, hit: h.forge.hit / FORGE.step.hit, crit: h.forge.crit / FORGE.step.crit };
    if (!Number.isInteger(levels.hit) || !Number.isInteger(levels.crit)) out.push(`${it.name}: forge bonuses come in +${FORGE.step.hit} Hit and +${FORGE.step.crit} Crit steps`);
    else {
      const problem = forgeProblem(it, levels);
      if (problem) out.push(`${it.name}: ${problem}`);
    }
  }
  return out;
}

/**
 * The next entry, for the map played: a copy of the latest snapshot after its shopping (#192), with the map's recruits the snapshot doesn't have
 * yet filled in (#116), a child's stats from its parents in that snapshot (#155). The Robin and Morgan recruits are
 * skipped until Robin's gender is set, and a setup used only on the map (Premonition's, #131) never joins the army.
 */
export function addEntry(run: Run, map: string, now: number, label?: string, assumptions: Assumptions = DEFAULT_ASSUMPTIONS): Run {
  const last = latestEntry(run);
  const prev = last ? entryAfterShopping(last) : EMPTY_SNAPSHOT;
  const units: Partial<Record<RosterUnit, UnitSnapshot>> = { ...prev.units };
  for (const [unit, r] of newRecruits(run, prev, map)) if (!mapOnly(r)) units[unit] = recruitSnapshot(unit, run, r, prev, assumptions);
  const n = run.entries.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0) + 1;
  const entry: RunEntry = { id: `e${n}`, map, ...(label ? { label } : {}), snapshot: { ...prev, units }, createdAt: now };
  return { ...run, entries: [...run.entries, entry] };
}

/**
 * A map's recruits the snapshot doesn't have yet, as roster units. The Robin recruit waits for Robin's gender, and so
 * does Morgan, who is the other gender.
 */
function newRecruits(run: Run, snap: Snapshot, map: string): [RosterUnit, MapRecruit][] {
  const robin = run.roster.run.gender;
  return (MAPS.find((m) => m.id === map)?.recruits ?? []).flatMap((r): [RosterUnit, MapRecruit][] => {
    const unit = r.unit === 'Morgan' ? robin && (robin === 'M' ? 'morgan-f' : 'morgan-m') : UNIT_BY_NAME.get(r.unit);
    return unit && !snap.units[unit] && (unit !== 'robin' || run.roster.run.gender) ? [[unit, r]] : [];
  });
}

/** A unit lost for good (#208): dead or missed, on the run facts or in the snapshot. */
export const isLost = (run: Run, snap: Snapshot, u: RosterUnit): boolean => [run.roster.states[u], snap.states[u]].some((s) => s === 'dead' || s === 'missed');

/** A recruit who comes after the map starts (turn 2 on, a talk, the map's end): listed with when, never in the opening lineup. */
export type LaterRecruit = { readonly unit: RosterUnit; readonly how: string | null };

export type PrepUnits = {
  /** The latest entry's living units, then the units on the map from its start. */
  readonly units: readonly (readonly [RosterUnit, UnitSnapshot])[];
  /** Recruits on the map from turn 1, who join the army. */
  readonly joining: readonly RosterUnit[];
  /** Units fielded with a setup used only on this map (Premonition's), who never join the army. */
  readonly mapOnly: readonly RosterUnit[];
  readonly later: readonly LaterRecruit[];
};

/**
 * The units a map's preparation page can field (#131): the army from the latest entry (after its shopping, #192), plus the recruits on the map
 * from turn 1, built as Record results will build them, and any setup used only on this map. Later recruits are listed
 * apart. Like Record results, the Robin recruit waits for Robin's gender; a unit already in the army or dead is left out.
 */
export function prepUnits(run: Run, map: string): PrepUnits {
  const last = latestEntry(run);
  const snap = last ? entryAfterShopping(last) : EMPTY_SNAPSHOT;
  const alive = (u: RosterUnit) => !isLost(run, snap, u);
  const units = (Object.entries(snap.units) as [RosterUnit, UnitSnapshot][]).filter(([u]) => alive(u));
  const joining: RosterUnit[] = [];
  const onlyHere: RosterUnit[] = [];
  const later: LaterRecruit[] = [];
  for (const [unit, r] of newRecruits(run, snap, map)) {
    if (!alive(unit)) continue;
    if (mapOnly(r) || /^Automatically from turn 1\b/.test(r.how ?? '')) {
      units.push([unit, recruitSnapshot(unit, run, r, snap)]);
      (mapOnly(r) ? onlyHere : joining).push(unit);
    } else later.push({ unit, how: r.how });
  }
  return { units, joining, mapOnly: onlyHere, later };
}

/** Edits an entry's snapshot. A past entry's edit never reaches later entries: they're flagged instead. */
export function editEntry(run: Run, id: string, edit: (s: Snapshot) => Snapshot, now: number): Run {
  const i = run.entries.findIndex((e) => e.id === id);
  if (i < 0) return run;
  const entries = [...run.entries];
  const past = i < entries.length - 1;
  entries[i] = { ...entries[i]!, snapshot: edit(entries[i]!.snapshot), ...(past ? { editedAt: now } : {}) };
  return { ...run, entries };
}

/** Removes an entry (the latest, or a mistaken one); the log keeps at least its first entry. */
export function removeEntry(run: Run, id: string): Run {
  if (run.entries.length <= 1) return run;
  return { ...run, entries: run.entries.filter((e) => e.id !== id) };
}

/** Entries copied before an earlier entry was edited: the correction might matter to them. */
export function flaggedEntries(run: Run): ReadonlySet<string> {
  const out = new Set<string>();
  run.entries.forEach((e, i) => {
    if (run.entries.slice(0, i).some((p) => p.editedAt !== undefined && p.editedAt > e.createdAt)) out.add(e.id);
  });
  return out;
}

/** Sets one unit's snapshot in an entry, or removes it (null). */
export const withUnit = (s: Snapshot, unit: RosterUnit, u: UnitSnapshot | null): Snapshot => {
  const { [unit]: _, ...rest } = s.units;
  return { ...s, units: u ? { ...rest, [unit]: u } : rest };
};

// ---- next-map offers and Record results (#118) ----

/** A map the run can play next, and anything to know before counting on it. */
export type MapOffer = { readonly map: string; readonly kind: 'story' | 'paralogue' | 'xenologue'; readonly note?: string };

/** Paralogues with more to them than their unlocking chapter (SF gaiden chapters; research/chapter-data §2). */
const PARALOGUE_NOTES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`paralogue-${i + 18}`, 'Needs SpotPass data, which may no longer be downloadable now the 3DS online services have ended.'])),
};

/** The units a snapshot has married (a pin doesn't count). */
export const marriedUnits = (s: Snapshot): Set<RosterUnit> =>
  new Set((Object.entries(s.spouses) as [RosterUnit, Roster['spouses'][RosterUnit]][]).filter(([, sp]) => sp?.bond === 'married').map(([u]) => u));

/**
 * The maps the run can play next (#118): story and paralogues its cleared maps have unlocked (the Premonition to start),
 * and on a Full route every DLC xenologue it hasn't played. A child paralogue also needs its parent married in the
 * latest entry and its location reachable (#152). Grind maps are never offered: log them as “other”.
 */
export function nextMaps(run: Run): MapOffer[] {
  const cleared = new Set(run.entries.map((e) => e.map));
  const unlocked = new Set<string>(['premonition']);
  for (const m of MAPS) if (cleared.has(m.id)) m.unlocks.forEach((u) => unlocked.add(u));
  const married = marriedUnits(latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT);
  for (const g of childParalogueGates({ cleared, married })) if (!g.playable) unlocked.delete(g.map);
  const offers: MapOffer[] = [];
  for (const m of MAPS) {
    if (cleared.has(m.id) || m.grind) continue;
    if (m.kind === 'xenologue') {
      if (run.roster.run.route === 'full-route') offers.push({ map: m.id, kind: 'xenologue' });
      continue;
    }
    if (unlocked.has(m.id)) offers.push({ map: m.id, kind: m.kind, ...(PARALOGUE_NOTES[m.id] ? { note: PARALOGUE_NOTES[m.id] } : {}) });
  }
  // The story first, then paralogues, then the DLC; each in map order (a stable sort keeps it).
  const rank = { story: 0, paralogue: 1, xenologue: 2 } as const;
  return offers.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** An entry's roster (its states and spouses on the run's facts), to edit with the roster functions. */
const entryRoster = (run: Run, e: RunEntry): Roster => ({ ...run.roster, states: e.snapshot.states, spouses: e.snapshot.spouses });

const withEntryRoster = (run: Run, id: string, edit: (r: Roster) => Roster, now: number): Run =>
  editEntry(
    run,
    id,
    (s) => {
      const e = run.entries.find((x) => x.id === id)!;
      const r = edit(entryRoster(run, e));
      return { ...s, states: r.states, spouses: r.spouses };
    },
    now,
  );

/** Units whose fall is a Game Over (#208; spec #175, Record results): the save is reloaded, so it's never recorded. */
export const GAME_OVER_UNITS: readonly RosterUnit[] = ['chrom', 'robin'];

/** The run with entry `id` changed by `edit`, marked edited when later entries were copied from it. */
function withEntry(run: Run, id: string, edit: (e: RunEntry) => RunEntry, now: number): Run {
  const i = run.entries.findIndex((e) => e.id === id);
  if (i < 0) return run;
  const entries = [...run.entries];
  entries[i] = { ...edit(entries[i]!), ...(i < entries.length - 1 ? { editedAt: now } : {}) };
  return { ...run, entries };
}

/**
 * A unit fell on the map (#208). Classic: dead for good (a loss). Casual: it comes back after the map, keeping its slot
 * and children, so it isn't a loss: the fall is logged on the entry (`RunEntry.fell`) for calibration. Chrom's or
 * Robin's fall is a Game Over, never recorded: the run comes back unchanged.
 */
export function recordFallen(run: Run, id: string, unit: RosterUnit, now: number): Run {
  if (GAME_OVER_UNITS.includes(unit)) return run;
  if (run.roster.run.mode === 'casual') return withEntry(run, id, (e) => (e.fell?.includes(unit) ? e : { ...e, fell: [...(e.fell ?? []), unit] }), now);
  return withEntryRoster(run, id, (r) => withState(r, unit, 'dead'), now);
}

/** A recruit on the map wasn't recruited (#208): missed for good, a loss like a death. Never Chrom or Robin. */
export function recordMissed(run: Run, id: string, unit: RosterUnit, now: number): Run {
  if (GAME_OVER_UNITS.includes(unit)) return run;
  return withEntryRoster(run, id, (r) => withState(r, unit, 'missed'), now);
}

/**
 * Undoes a fall, death or miss recorded on entry `id` (a mistake): the unit's state as the entry before had it, and
 * out of the entry's fall log.
 */
export function unrecordLoss(run: Run, id: string, unit: RosterUnit, now: number): Run {
  const i = run.entries.findIndex((e) => e.id === id);
  if (i < 0) return run;
  const was = run.entries[i - 1]?.snapshot.states[unit] ?? 'available';
  const fell = run.entries[i]!.fell?.filter((u) => u !== unit);
  const logged = withEntry(
    run,
    id,
    (e) => {
      const { fell: _, ...rest } = e;
      return fell?.length ? { ...rest, fell } : rest;
    },
    now,
  );
  return withEntryRoster(logged, id, (r) => withState(r, unit, was), now);
}

/** Two units married during the map. */
export const recordMarriage = (run: Run, id: string, a: RosterUnit, b: RosterUnit, now: number): Run =>
  withEntryRoster(run, id, (r) => withSpouse(r, a, b, 'married'), now);

/** Records the Lunatic+ skills seen on one of a map's foes; an empty list clears them. */
export function withSeenSkills(run: Run, map: string, foe: string, skills: readonly string[]): Run {
  const { [foe]: _, ...rest } = run.seen?.[map] ?? {};
  const forMap = skills.length ? { ...rest, [foe]: skills } : rest;
  const { [map]: __, ...others } = run.seen ?? {};
  const seen = Object.keys(forMap).length ? { ...others, [map]: forMap } : others;
  return { ...run, ...(Object.keys(seen).length ? { seen } : { seen: undefined }) };
}

// ---- storage: parse, export, import ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function parseHeld(v: unknown): HeldItem | null {
  if (!isObject(v) || typeof v.item !== 'string') return null;
  const f = isObject(v.forge) ? v.forge : null;
  return {
    item: v.item,
    uses: typeof v.uses === 'number' ? v.uses : null,
    ...(f ? { forge: { name: str(f.name), mt: num(f.mt, 0), hit: num(f.hit, 0), crit: num(f.crit, 0) } } : {}),
  };
}

function parseUnit(v: unknown): UnitSnapshot | null {
  if (!isObject(v)) return null;
  const stats = isObject(v.stats) && STATS.every((s) => typeof (v.stats as Record<string, unknown>)[s] === 'number') ? (v.stats as Record<Stat, number>) : null;
  return {
    class: str(v.class),
    level: num(v.level, 1),
    promoted: v.promoted === true,
    reclassed: v.reclassed === true,
    exp: num(v.exp, 0),
    stats: stats && (Object.fromEntries(STATS.map((s) => [s, stats[s]])) as Record<Stat, number>),
    skills: Array.isArray(v.skills) ? v.skills.filter((s): s is string => typeof s === 'string').slice(0, 5) : [],
    inventory: Array.isArray(v.inventory) ? v.inventory.map(parseHeld).filter((x): x is HeldItem => x !== null) : [],
    supports: Array.isArray(v.supports)
      ? v.supports.flatMap((p) => (isObject(p) && typeof p.partner === 'string' && SUPPORT_LEVELS.includes(p.rank as SupportLevel) ? [{ partner: p.partner as RosterUnit, rank: p.rank as SupportLevel }] : []))
      : [],
  };
}

function parseSnapshot(v: unknown, run: Roster['run']): Snapshot {
  if (!isObject(v)) return EMPTY_SNAPSHOT;
  // States and spouses go through the roster parser, which drops anything stale.
  const r = parseRoster({ run, states: v.states, spouses: v.spouses });
  const units: Partial<Record<RosterUnit, UnitSnapshot>> = {};
  for (const [k, u] of Object.entries(isObject(v.units) ? v.units : {})) {
    const p = parseUnit(u);
    if (p) units[k as RosterUnit] = p;
  }
  return {
    units,
    convoy: Array.isArray(v.convoy) ? v.convoy.map(parseHeld).filter((x): x is HeldItem => x !== null) : [],
    gold: typeof v.gold === 'number' && Number.isFinite(v.gold) ? v.gold : null,
    states: r.states,
    spouses: r.spouses,
  };
}

/**
 * A stored or imported `run:v2`; anything unreadable falls back to an empty run. A `run:v1` isn't read here: it's
 * migrated (`migrateRun`, `importRun`).
 */
export function parseRun(raw: unknown): Run {
  if (!isObject(raw) || raw.version !== 2) return EMPTY_RUN;
  const run = parseRunFields(raw);
  const strings = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter(isText))] : []);
  const dismissedProposals = strings(raw.dismissedProposals);
  const dismissedChanges = strings(raw.dismissedChanges);
  const settledLosses = strings(raw.settledLosses);
  const corrections = parseCorrections(raw.corrections);
  const calibration = (Array.isArray(raw.calibration) ? raw.calibration : []).flatMap((r): CalibrationRow[] =>
    isObject(r) && isText(r.entry) && isText(r.unit) && typeof r.percentile === 'number' && r.percentile >= 0 && r.percentile <= 1 ? [{ entry: r.entry, unit: r.unit as RosterUnit, percentile: r.percentile }] : [],
  );
  const migration = parseMigrationNote(raw.migration);
  const adopted = parsePlan(raw.adopted);
  const edits = (Array.isArray(raw.edits) ? raw.edits : []).flatMap((e): RunEdit[] => {
    if (!isObject(e) || !isText(e.label)) return [];
    const pins = parsePins(e.pins);
    const c = e.cost;
    const cost =
      isObject(c) && typeof c.gain === 'number' && typeof c.margin === 'number' && ['better', 'worse', 'close', 'unclear'].includes(c.verdict as string)
        ? { gain: c.gain, margin: c.margin, verdict: c.verdict as NonNullable<RunEdit['cost']>['verdict'] }
        : undefined;
    return [
      {
        label: e.label,
        ...(pins.length ? { pins } : {}),
        ...('before' in e ? { before: parsePlan(e.before) ?? null } : {}),
        ...(cost ? { cost } : {}),
        ...(e.accepted === true ? { accepted: true as const } : {}),
      },
    ];
  });
  return {
    ...run,
    ...(adopted ? { adopted } : {}),
    ...(edits.length ? { edits } : {}),
    ...(dismissedProposals.length ? { dismissedProposals } : {}),
    ...(dismissedChanges.length ? { dismissedChanges } : {}),
    ...(settledLosses.length ? { settledLosses } : {}),
    ...(corrections ? { corrections } : {}),
    ...(calibration.length ? { calibration } : {}),
    ...(migration ? { migration } : {}),
  };
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** A stored plan (#204): kept as it was saved when it has a plan's shape (Robin, wishlist, roadmap), else dropped. */
function parsePlan(v: unknown): Plan | undefined {
  if (!isObject(v) || !isObject(v.robin) || !isObject(v.wishlist) || !isObject(v.roadmap)) return undefined;
  const w = v.wishlist;
  const r = v.roadmap;
  const lists = [w.units, w.marriages, w.children, w.reserves, r.order, r.lineups, r.seals, r.items];
  return lists.every(Array.isArray) && isText(w.endpoint) ? (v as unknown as Plan) : undefined;
}

function parseCorrections(v: unknown): LearnedCorrections | undefined {
  if (!isObject(v)) return undefined;
  const units: Partial<Record<RosterUnit, number>> = {};
  for (const [u, f] of Object.entries(isObject(v.units) ? v.units : {}))
    if (typeof f === 'number' && Number.isFinite(f)) units[u as RosterUnit] = Math.min(CORRECTION_RANGE.max, Math.max(CORRECTION_RANGE.min, f));
  const off = v.off === true;
  return Object.keys(units).length || off ? { units, ...(off ? { off: true as const } : {}) } : undefined;
}

function parseMigrationNote(v: unknown): MigrationNote | undefined {
  if (!isObject(v)) return undefined;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter(isText) : []);
  const note = { kept: list(v.kept), dropped: list(v.dropped), keepIn: list(v.keepIn) as RosterUnit[] };
  return note.kept.length || note.dropped.length || note.keepIn.length ? note : undefined;
}

/**
 * The fields `run:v1` and `run:v2` share (the chapter log, Run facts, seen skills, counts, side goals, renown, pins),
 * whatever the version: what `parseRun` and the migration from `run:v1` read. The roster keeps its v1 fields
 * (rule-outs, saved plan, deploy flags) for the migration to turn into pins or drop.
 */
const READING_KINDS = ['on-track', 'at-risk', 'behind'] as const;

/** A stored entry forecast (#206), its rows that don't read dropped; undefined when it has no headline. */
function parseEntryForecast(v: unknown): EntryForecast | undefined {
  if (!isObject(v) || typeof v.chance !== 'number' || typeof v.margin !== 'number' || !isText(v.key) || !isText(v.map)) return undefined;
  const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  const exp = (Array.isArray(v.exp) ? v.exp : []).flatMap((x): EntryForecast['exp'][number][] =>
    isObject(x) && isText(x.unit) && n(x.exp) && isObject(x.level) && n(x.level.low) && n(x.level.median) && n(x.level.high)
      ? [
          {
            unit: x.unit as RosterUnit,
            exp: x.exp as number,
            level: { low: x.level.low as number, median: x.level.median as number, high: x.level.high as number },
            ...(n(x.factor) && (x.factor as number) > 0 && x.factor !== 1 ? { factor: x.factor as number } : {}),
          },
        ]
      : [],
  );
  const readings = (Array.isArray(v.readings) ? v.readings : []).flatMap((x): EntryForecast['readings'][number][] =>
    isObject(x) && isText(x.unit) && READING_KINDS.includes(x.reading as (typeof READING_KINDS)[number])
      ? [{ unit: x.unit as RosterUnit, reading: x.reading as (typeof READING_KINDS)[number], ...(x.pending === true ? { pending: true as const } : {}) }]
      : [],
  );
  return {
    chance: v.chance,
    margin: v.margin,
    key: v.key,
    map: v.map,
    ...(n(v.noDeath) ? { noDeath: v.noDeath as number } : {}),
    ...(n(v.spend) ? { spend: v.spend as number } : {}),
    exp,
    readings,
  };
}

const OUTCOMES: readonly CheckOutcome[] = ['checked', 'switched', 'unexpected', 'mismatch', 'none'];

/** An entry's checks as saved (#209): a rule and its words; an observation a number, yes/no or "didn't happen". */
function parseEntryChecks(v: unknown): EntryCheck[] {
  return (Array.isArray(v) ? v : []).flatMap((c): EntryCheck[] => {
    if (!isObject(c) || !isText(c.rule) || typeof c.text !== 'string') return [];
    const o = c.observed;
    const observed = (typeof o === 'number' && Number.isFinite(o)) || typeof o === 'boolean' || o === 'didnt-happen' ? (o as Observation) : undefined;
    const outcome = OUTCOMES.find((x) => x === c.outcome);
    return [{ rule: c.rule, text: c.text, ...(observed !== undefined ? { observed } : {}), ...(outcome ? { outcome } : {}) }];
  });
}

/** The run with the checks a map offered kept on its entry (#209), replacing any kept before. */
export function withEntryChecks(run: Run, id: string, checks: readonly { readonly rule: string; readonly text: string }[]): Run {
  return { ...run, entries: run.entries.map((e) => (e.id === id ? { ...e, checks: checks.map((c) => ({ rule: c.rule, text: c.text })) } : e)) };
}

/** The run with one of an entry's checks observed (#209): the raw observation and what it did to the rule. */
export function withCheckObserved(run: Run, id: string, rule: string, observed: Observation, outcome: CheckOutcome): Run {
  return {
    ...run,
    entries: run.entries.map((e) => (e.id === id ? { ...e, checks: (e.checks ?? []).map((c) => (c.rule === rule ? { ...c, observed, outcome } : c)) } : e)),
  };
}

export function parseRunFields(raw: Record<string, unknown>): Run {
  const roster = parseRoster(raw.roster);
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((e, i): RunEntry[] => {
    if (!isObject(e)) return [];
    const map = typeof e.map === 'string' && (e.map === 'other' || MAPS.some((m) => m.id === e.map)) ? e.map : 'other';
    const classChanges = parseClassChanges(e.classChanges);
    const shopping = parseShopLines(e.shopping);
    const sideGoals = parseSideGoalsSecured(e.sideGoals);
    const itemsUsed = parseItemsUsed(e.itemsUsed);
    const forecast = parseEntryForecast(e.forecast);
    const fell = Array.isArray(e.fell) ? [...new Set(e.fell.filter((u): u is RosterUnit => typeof u === 'string' && UNIT_BY_NAME_IDS.has(u)))] : [];
    const checks = parseEntryChecks(e.checks);
    return [
      {
        id: typeof e.id === 'string' && e.id ? e.id : `e${i + 1}`,
        map,
        ...(typeof e.label === 'string' ? { label: e.label } : {}),
        snapshot: parseSnapshot(e.snapshot, roster.run),
        createdAt: num(e.createdAt, 0),
        ...(typeof e.editedAt === 'number' ? { editedAt: e.editedAt } : {}),
        ...(classChanges.length ? { classChanges } : {}),
        ...(shopping.length ? { shopping } : {}),
        ...(Object.keys(sideGoals).length ? { sideGoals } : {}),
        ...(itemsUsed ? { itemsUsed } : {}),
        ...(forecast ? { forecast } : {}),
        ...(fell.length ? { fell } : {}),
        ...(checks.length ? { checks } : {}),
      },
    ];
  });
  const seen: Record<string, Record<string, string[]>> = {};
  for (const [map, foes] of Object.entries(isObject(raw.seen) ? raw.seen : {}))
    for (const [foe, skills] of Object.entries(isObject(foes) ? foes : {}))
      if (Array.isArray(skills)) (seen[map] ??= {})[foe] = skills.filter((x): x is string => typeof x === 'string');
  const base: Run = entries.length ? { version: 2, roster: { ...roster, states: {}, spouses: {} }, entries } : runFromRoster(roster);
  const counts = parseCountOverrides(raw.countOverrides);
  const withCounts: Run = Object.keys(counts).length ? { ...base, countOverrides: counts } : base;
  const goals = parseSideGoalPlan(raw.sideGoals);
  const renown = parseRenown(raw.renown);
  // The pins (#200), #193's item pins (`itemPins`, before #200) read into them.
  const pins = parsePins(raw.pins, raw.itemPins);
  const withGoals: Run = { ...withCounts, ...(Object.keys(goals).length ? { sideGoals: goals } : {}), ...(renown ? { renown } : {}), ...(pins.length ? { pins } : {}) };
  return Object.keys(seen).length ? { ...withGoals, seen } : withGoals;
}

/** The run as a file (JSON): `run:v2` as it is, read back by `importRun`. */
export const exportRun = (run: Run): string => JSON.stringify(run, null, 1);

