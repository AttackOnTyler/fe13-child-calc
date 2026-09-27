/**
 * Class changes in the chapter log and each unit's internal level (#185, from #149; spec #175 "EXP, supports and
 * internal level"). The log records every class change on the entry for the map it happened on: the unit, its class
 * before and after, the seal, and the displayed level at use. The internal level is worked out by walking the log, with
 * the tier read from the class data, so the player never enters a tier or a count. A per-unit count override stands in
 * for history the log can't see (before a unit's first entry).
 */
import { CHILD_UNITS } from '../game-data/children';
import { CLASSES, type ClassId, type ClassTier } from '../game-data/classes';
import { JOIN_DATA } from '../game-data/join';
import type { Assumptions } from './assumptions';
import { className } from './classes';
import { COUNT_CAP, secondSealCount, tierBonus, tierOfClass } from './exp';
import type { RosterUnit } from './roster';
import type { Run, RunEntry } from './run';

export type Seal = 'master' | 'second';

/** A Master or Second Seal used on a unit, recorded on the entry for the map it happened on. */
export type ClassChange = {
  readonly unit: RosterUnit;
  readonly from: string;
  readonly to: string;
  readonly seal: Seal;
  /** The displayed level at use (kept for a Master Seal too, so either reading can run over the same log). */
  readonly level: number;
};

/** A class change Record results proposes on an entry, from a level reset since the entry before. */
export type ProposedClassChange = ClassChange & { readonly entry: string };

export type ClassChangeReading = Assumptions['class-change-internal-level'];

/** One unit's internal level as of an entry, and what it rests on. */
export type UnitInternalLevel = {
  readonly unit: RosterUnit;
  readonly class: string;
  readonly level: number;
  /** From the class data; undefined for a class name it doesn't know (flagged in `problems`, never guessed). */
  readonly tier: ClassTier | undefined;
  /** The running count from class changes, plus the override; uncapped (the cap applies in `internal`). */
  readonly count: number;
  readonly overridden: boolean;
  /** First seen in a class it can't join in, with no override: the count before the log is unknown and read as 0. */
  readonly unknownHistory: boolean;
  /** Undefined while the tier is unknown. */
  readonly internal: number | undefined;
  readonly problems: readonly string[];
};

const CLASS_ID = new Map<string, ClassId>((Object.keys(CLASSES) as ClassId[]).flatMap((id) => (['M', 'F'] as const).map((g) => [className(id, g), id] as const)));

/** Whether a unit can join the army in a class: its join class, or for a child any class but an advanced one. */
function canJoinIn(unit: RosterUnit, cls: string): boolean {
  const join = (JOIN_DATA as Partial<Record<RosterUnit, { readonly joinClass: ClassId }>>)[unit];
  if (join && !(unit in CHILD_UNITS)) return CLASS_ID.get(cls.trim()) === join.joinClass;
  const tier = tierOfClass(cls);
  return tier !== undefined && tier !== 'advanced';
}

/** What a class change adds to the count under a reading; undefined when the class before isn't in the data. */
function added(c: ClassChange, reading: ClassChangeReading): number | undefined {
  if (reading === 'plus-one') return c.level;
  if (c.seal === 'master') return 0;
  const tier = tierOfClass(c.from);
  return tier && secondSealCount(c.level, tier);
}

/**
 * Every unit's internal level as of an entry (the latest by default), walking the log's class changes up to it. Under
 * the research's reading it is `level + 20 if advanced + min(count, cap)`, the count growing at each Second Seal. Under
 * +1 per class change, the tier bonus is the one the unit was first seen with and each class change adds its level.
 */
export function internalLevels(run: Run, reading: ClassChangeReading, entry?: string): Map<RosterUnit, UnitInternalLevel> {
  const end = entry === undefined ? run.entries.length - 1 : run.entries.findIndex((e) => e.id === entry);
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const first = new Map<RosterUnit, string>();
  const counts = new Map<RosterUnit, number>();
  const problems = new Map<RosterUnit, string[]>();
  for (const e of run.entries.slice(0, end + 1)) {
    const changes = e.classChanges ?? [];
    for (const [unit, u] of Object.entries(e.snapshot.units) as [RosterUnit, NonNullable<RunEntry['snapshot']['units'][RosterUnit]>][])
      if (!first.has(unit)) first.set(unit, changes.find((c) => c.unit === unit)?.from ?? u.class);
    for (const c of changes) {
      const n = added(c, reading);
      if (n === undefined) (problems.get(c.unit) ?? problems.set(c.unit, []).get(c.unit)!).push(`${c.from}: not a class in the data, so its Second Seal adds nothing`);
      counts.set(c.unit, (counts.get(c.unit) ?? 0) + (n ?? 0));
    }
  }
  const out = new Map<RosterUnit, UnitInternalLevel>();
  const last = run.entries[end];
  if (!last) return out;
  for (const [unit, u] of Object.entries(last.snapshot.units) as [RosterUnit, NonNullable<RunEntry['snapshot']['units'][RosterUnit]>][]) {
    const override = run.countOverrides?.[unit];
    const count = (override ?? 0) + (counts.get(unit) ?? 0);
    const tier = tierOfClass(u.class);
    const firstTier = tierOfClass(first.get(unit) ?? u.class);
    const bonus = reading === 'plus-one' ? (firstTier ? tierBonus(firstTier) : undefined) : tier && tierBonus(tier);
    out.set(unit, {
      unit,
      class: u.class,
      level: u.level,
      tier,
      count,
      overridden: override !== undefined,
      unknownHistory: override === undefined && !canJoinIn(unit, first.get(unit) ?? u.class),
      internal: tier === undefined || bonus === undefined ? undefined : u.level + bonus + Math.min(count, COUNT_CAP[difficulty]),
      problems: [...(tier ? [] : [`${u.class || 'No class'}: not a class in the data, so the tier and internal level are unknown`]), ...(problems.get(unit) ?? [])],
    });
  }
  return out;
}

/**
 * The class changes the log suggests but doesn't hold (#185): wherever a unit's level went down since the entry before,
 * or its class changed to another known class, with no class change recorded for it there. Pre-filled from the entry
 * before: its class and level at use, a Master Seal for base to advanced and a Second Seal otherwise. Old entries get
 * the same back-filled proposals.
 */
export function classChangeProposals(run: Run): ProposedClassChange[] {
  return run.entries.flatMap((e, i) => {
    const prev = run.entries[i - 1]?.snapshot.units;
    if (!prev) return [];
    return (Object.entries(e.snapshot.units) as [RosterUnit, NonNullable<RunEntry['snapshot']['units'][RosterUnit]>][]).flatMap(([unit, u]): ProposedClassChange[] => {
      const p = prev[unit];
      if (!p || e.classChanges?.some((c) => c.unit === unit)) return [];
      const [from, to] = [tierOfClass(p.class), tierOfClass(u.class)];
      if (!(u.level < p.level || (from && to && u.class.trim() !== p.class.trim()))) return [];
      return [{ entry: e.id, unit, from: p.class, to: u.class, seal: from === 'base' && to === 'advanced' ? 'master' : 'second', level: p.level }];
    });
  });
}

const editChanges = (run: Run, entry: string, edit: (cs: readonly ClassChange[]) => readonly ClassChange[]): Run => ({
  ...run,
  entries: run.entries.map((e) => {
    if (e.id !== entry) return e;
    const { classChanges, ...rest } = e;
    const next = edit(classChanges ?? []);
    return next.length ? { ...rest, classChanges: next } : rest;
  }),
});

/** Records a class change on an entry (a proposal as the player corrected it). */
export const withClassChange = (run: Run, entry: string, c: ClassChange): Run =>
  editChanges(run, entry, (cs) => [...cs, { unit: c.unit, from: c.from, to: c.to, seal: c.seal, level: c.level }]);

/** Removes an entry's `index`-th class change. */
export const removeClassChange = (run: Run, entry: string, index: number): Run => editChanges(run, entry, (cs) => cs.filter((_, k) => k !== index));

/** Sets a unit's count from history the log can't see, or clears it (null). */
export function withCountOverride(run: Run, unit: RosterUnit, count: number | null): Run {
  const { [unit]: _, ...rest } = run.countOverrides ?? {};
  const next = count === null ? rest : { ...rest, [unit]: Math.max(0, Math.floor(count)) };
  const { countOverrides: __, ...base } = run;
  return Object.keys(next).length ? { ...base, countOverrides: next } : base;
}

// ---- storage ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A stored entry's class changes; anything unreadable is dropped. */
export function parseClassChanges(v: unknown): ClassChange[] {
  return (Array.isArray(v) ? v : []).flatMap((c): ClassChange[] =>
    isObject(c) && typeof c.unit === 'string' && typeof c.from === 'string' && typeof c.to === 'string' && (c.seal === 'master' || c.seal === 'second') && typeof c.level === 'number' && Number.isFinite(c.level)
      ? [{ unit: c.unit as RosterUnit, from: c.from, to: c.to, seal: c.seal, level: c.level }]
      : [],
  );
}

/** Stored count overrides; anything but a non-negative number is dropped. */
export function parseCountOverrides(v: unknown): Partial<Record<RosterUnit, number>> {
  return Object.fromEntries(Object.entries(isObject(v) ? v : {}).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) as Partial<Record<RosterUnit, number>>;
}
