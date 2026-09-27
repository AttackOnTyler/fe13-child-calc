/**
 * Readings (#197; spec #175, Milestones, the map order and readings; design #147): how each unit stands against the
 * adopted plan's milestones (#194), from their milestone chances (#195).
 *
 * - A unit's reading is its **worst open milestone**'s chance (a milestone no run reaches with nobody lost reads 0%):
 *   **on track** at 80% or more; **at risk** when one suggested change (#195) restores 80% without pushing another
 *   milestone below 80%; **behind** when none does, or the milestone can't be acted on any more: a support that's a
 *   non-starter, or a milestone due at the next map's start (its deadline map has started: no map is left to change).
 *   A unit with no open milestones reads on track, "no milestones left". Reserves get no reading. Stats never count.
 * - Who a milestone counts against (spec): a support against both partners, a skill (for a build or passed) against the
 *   unit that learns it, a class change against the unit, a recruitment against the child, which also takes the worst
 *   of the supports that lead to it (its parents' marriage). A wasted pass counts against nobody: it gives nothing.
 * - **Suggestions are expensive** (one flawless chance per candidate change, ~70 s for 25), so they're an input: the
 *   cheap first pass reads a unit below 80% whose milestone can still be acted on as at risk, **pending** ("at risk?"),
 *   and lists the milestones whose suggested changes it needs (`pending`). The worker works those out one milestone at
 *   a time (`SUGGEST_RUNS` runs each, within `READING_SECONDS`) and the page reads again with them.
 * - **Order:** behind, at risk, on track; within each, by the flawless chance lost: the unit's worth (#202) times the
 *   share of runs missing its worst milestone, when every unit's worth is read (Chrom and Robin, forced, weigh the
 *   plan's whole chance); else the milestone's **stake**, the share of runs missing it alone, every unit weighted alike.
 *   Then the lower chance, the earlier milestone, the unit.
 * - **Recorded stats** read as percentiles in the expected spread ("Str p12"): the spread the level-ups since the entry
 *   before the latest roll (as the flawless chance's runs roll them), not the combat that earned them, so a map the runs
 *   rarely survive still has one. Shown beside the reading; they never change it.
 */
import { STATS, type Stat } from '../game-data/stats';
import type { Assumptions } from './assumptions';
import { classGrowths } from './classes';
import { flawlessInput, type FlawlessOptions } from './flawless';
import { ON_TRACK, type ExpForecast, type SuggestedChange } from './exp-forecast';
import type { Milestone } from './milestones';
import type { RosterUnit } from './roster';
import { latestEntry, removeEntry, type Run } from './run';
import { effectiveCaps } from './sim/ceiling';
import type { MilestoneChance } from './sim/run-sim';
import type { Plan } from './solve/plan';
import type { UnitWorth } from './solve/worth';

/** The runs each milestone's suggested changes are read on, in the worker. */
export const SUGGEST_RUNS = 8;
/** The worker's time budget for the suggested changes, after the solve (seconds). */
export const READING_SECONDS = 120;

export type ReadingKind = 'on-track' | 'at-risk' | 'behind';

/** A recorded stat's place in the expected spread: "Str p12". */
export type StatPercentile = { readonly stat: Stat; readonly value: number; readonly percentile: number };

/** A unit's recorded stats at the latest recorded map, as percentiles of the spread expected there. */
export type UnitStats = { readonly unit: RosterUnit; readonly map: string; readonly stats: readonly StatPercentile[] };

export type Reading = {
  readonly unit: RosterUnit;
  readonly reading: ReadingKind;
  /** At risk until its worst milestone's suggested changes are read ("at risk?"). */
  readonly pending: boolean;
  /** Its worst open milestone and that milestone's chance; undefined with none left ("no milestones left"). */
  readonly worst: { readonly id: string; readonly chance: number; readonly reached: boolean } | undefined;
  /** Every open milestone counted against it, in roadmap order, with its chance (undefined: no run reaches it). */
  readonly milestones: readonly { readonly id: string; readonly chance: number | undefined }[];
  /** Behind: a non-starter support, a deadline map that has started, or no single change restoring 80%. */
  readonly why?: 'non-starter' | 'deadline' | 'no-change';
  /** At risk: the best suggested change that restores 80% without breaking another milestone. */
  readonly change?: SuggestedChange;
  /** The flawless chance lost (see the module comment): what orders readings within a kind. */
  readonly lost: number;
  /** Its recorded stats as percentiles; never part of the reading. */
  readonly stats: readonly StatPercentile[];
};

export type Readings = {
  /** Behind first, then at risk, then on track; each by flawless chance lost. */
  readonly readings: readonly Reading[];
  /** What `lost` is read from: unit worth (#202), or each milestone's stake. */
  readonly lostBy: 'worth' | 'stake';
  /** The milestones whose suggested changes the pending readings still need, by id. */
  readonly pending: readonly string[];
  /** The recorded stats' percentiles, to hand back on the next read. */
  readonly stats: readonly UnitStats[];
};

export type ReadingsOptions = Pick<FlawlessOptions, 'seed' | 'runs' | 'roleOf'> & {
  /** The plan's EXP forecast (#195), when already worked out; else it's simulated. */
  readonly forecast?: ExpForecast;
  /** Suggested changes read so far, by milestone id (#195, `suggestedChanges`). */
  readonly suggestions?: Readonly<Record<string, readonly SuggestedChange[]>>;
  /** The plan's unit worth (#202), when read. */
  readonly worth?: readonly UnitWorth[];
  /** The recorded stats' percentiles from an earlier read. */
  readonly stats?: readonly UnitStats[];
};

const KIND_ORDER: Readonly<Record<ReadingKind, number>> = { behind: 0, 'at-risk': 1, 'on-track': 2 };

/**
 * The readings of units against milestones (see the module comment), given each milestone's chance. `units` are the
 * units to read besides those the milestones count against (the wishlist's); `reserves` get no reading.
 */
export function readUnits(
  ms: readonly Milestone[],
  chances: readonly MilestoneChance[],
  context: {
    readonly units?: readonly RosterUnit[];
    readonly reserves?: readonly RosterUnit[];
    readonly suggestions?: Readonly<Record<string, readonly SuggestedChange[]>>;
    readonly worth?: readonly UnitWorth[];
    /** The plan's flawless chance: a forced unit's weight when reading by worth. */
    readonly chance?: number;
    readonly stats?: readonly UnitStats[];
  } = {},
): Readings {
  const reserves = new Set(context.reserves ?? []);
  const chanceOf = new Map(chances.map((c) => [c.id, c.chance]));
  const open = ms.filter((m) => !(m.kind === 'skill' && m.wasted));
  // Who each milestone counts against; a child's recruitment also takes its parents' supports.
  const against = new Map<RosterUnit, Milestone[]>();
  const add = (u: RosterUnit, m: Milestone) => {
    const list = against.get(u) ?? [];
    if (!list.includes(m)) list.push(m);
    against.set(u, list);
  };
  for (const m of open) for (const u of m.units) add(u, m);
  for (const m of open) {
    if (m.kind !== 'recruit') continue;
    for (const s of open) if (s.kind === 'support' && s.children.includes(m.child)) add(m.child, s);
  }
  const units = [...new Set([...against.keys(), ...(context.units ?? [])])].filter((u) => !reserves.has(u));
  // Roadmap order: where each event falls (a map's start before its end), then as listed.
  const order = new Map(ms.map((m, i) => [m.id, (m.at.index * 2 + (m.at.when === 'end' ? 1 : 0)) * ms.length + i]));
  const worthOf = new Map((context.worth ?? []).map((w) => [w.unit, w]));
  const lostBy = context.worth && units.every((u) => worthOf.get(u)?.forced || worthOf.get(u)?.worth !== undefined) ? 'worth' : 'stake';
  const pending = new Set<string>();

  const readings = units.map((unit): Reading => {
    const list = (against.get(unit) ?? []).slice().sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const stats = context.stats?.find((s) => s.unit === unit)?.stats ?? [];
    const milestones = list.map((m) => ({ id: m.id, chance: chanceOf.get(m.id) }));
    const chance = (m: Milestone) => chanceOf.get(m.id) ?? 0;
    const worst = list.reduce<Milestone | undefined>((w, m) => (!w || chance(m) < chance(w) ? m : w), undefined);
    if (!worst) return { unit, reading: 'on-track', pending: false, worst: undefined, milestones, lost: 0, stats };
    const c = chance(worst);
    const w = worthOf.get(unit);
    const weight = lostBy === 'worth' ? (w?.forced ? (context.chance ?? 1) : (w?.worth ?? 0)) : 1;
    const base = { unit, worst: { id: worst.id, chance: c, reached: chanceOf.get(worst.id) !== undefined }, milestones, lost: weight * (1 - c), stats };
    if (c >= ON_TRACK) return { ...base, reading: 'on-track', pending: false };
    if (worst.kind === 'support' && worst.nonStarter) return { ...base, reading: 'behind', pending: false, why: 'non-starter' };
    if (worst.at.index === 0 && worst.at.when === 'start') return { ...base, reading: 'behind', pending: false, why: 'deadline' };
    const suggested = context.suggestions?.[worst.id];
    if (!suggested) {
      pending.add(worst.id);
      return { ...base, reading: 'at-risk', pending: true };
    }
    const change = suggested.find((s) => s.reaches && !s.breaks.length);
    return change ? { ...base, reading: 'at-risk', pending: false, change } : { ...base, reading: 'behind', pending: false, why: 'no-change' };
  });

  readings.sort(
    (a, b) =>
      KIND_ORDER[a.reading] - KIND_ORDER[b.reading] ||
      b.lost - a.lost ||
      (a.worst?.chance ?? 1) - (b.worst?.chance ?? 1) ||
      (a.worst ? order.get(a.worst.id)! : Infinity) - (b.worst ? order.get(b.worst.id)! : Infinity) ||
      a.unit.localeCompare(b.unit),
  );
  return { readings, lostBy, pending: [...pending], stats: context.stats ?? [] };
}

/**
 * A recorded stat's percentile after `levels` level-ups from `from`, each adding 1 on a roll of `growth`% (0–100, as
 * the simulation rolls it), up to `cap`: its mid-rank in that spread (the share below it, plus half the share equal to
 * it), 1 to 99.
 */
export function growthPercentile(from: number, levels: number, growth: number, cap: number, value: number): number {
  const p = Math.max(0, Math.min(100, growth)) / 100;
  let below = 0;
  let equal = 0;
  // Binomial(levels, p) gains, the cap taking whatever is over it.
  let term = (1 - p) ** levels;
  for (let k = 0; k <= levels; k++) {
    if (k > 0) term = p === 1 ? (k === levels ? 1 : 0) : (term * (levels - k + 1) * p) / (k * (1 - p));
    const v = Math.min(cap, from + k);
    if (v < value) below += term;
    else if (v === value) equal += term;
  }
  return Math.round(Math.min(99, Math.max(1, 100 * (below + equal / 2))));
}

/**
 * The recorded stats at the latest recorded map as percentiles of the spread expected there (see the module comment):
 * each unit recorded in the same class on the entry before it and levelled since, its stats placed among the level-ups'
 * rolls from there (personal plus class growth, up to its effective caps), as the flawless chance's runs roll them. A
 * class change or a stat booster in between isn't read: such a unit gets none.
 */
export function recordedStats(run: Run, assumptions: Assumptions, options: Pick<FlawlessOptions, 'roleOf'> = {}): UnitStats[] {
  const latest = latestEntry(run);
  if (!latest || run.entries.length < 2) return [];
  const before = removeEntry(run, latest.id);
  const prior = latestEntry(before)!.snapshot;
  const { input } = flawlessInput(before, assumptions, options.roleOf);
  return input.army.flatMap((a) => {
    const now = latest.snapshot.units[a.id];
    const was = prior.units[a.id];
    if (!now?.stats || !was?.stats || now.class !== was.class || now.level <= was.level) return [];
    const growths = classGrowths(a.classId, a.gender, assumptions);
    const caps = effectiveCaps(a.classId, a.gender, a.modifiers, a.skills);
    const levels = now.level - was.level;
    const stats = STATS.map((stat) => ({ stat, value: now.stats![stat], percentile: growthPercentile(was.stats![stat], levels, a.growths[stat] + growths[stat], caps[stat], now.stats![stat]) }));
    return [{ unit: a.id, map: latest.map, stats }];
  });
}

/** A plan's readings for a run (see `readUnits`), its milestones read from its EXP forecast. */
export function readings(
  run: Run,
  plan: Plan,
  ms: readonly Milestone[],
  forecast: ExpForecast,
  assumptions: Assumptions,
  options: ReadingsOptions,
): Readings {
  const reserves = plan.wishlist.reserves.map((r) => r.unit);
  const units = [...plan.wishlist.units.map((w) => w.unit), ...plan.wishlist.children.map((c) => c.child)];
  const stats = options.stats ?? recordedStats(run, assumptions, options);
  return readUnits(ms, forecast.milestones, {
    units,
    reserves,
    ...(options.suggestions ? { suggestions: options.suggestions } : {}),
    ...(options.worth ? { worth: options.worth } : {}),
    chance: forecast.chance,
    stats,
  });
}
