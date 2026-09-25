/**
 * The chapter log (#116; Map: Route planner #87): a run's copy-forward record, one entry per map played. Each entry
 * holds a snapshot of the army: every unit's class, level, EXP, actual stats, equipped skills, inventory and support
 * ranks, plus the convoy, gold, unit states and marriages. The roster's unit states and spouses come from the latest
 * entry; everything else on the roster (Run facts, rule-outs, the saved plan, deploy flags) stays on the run.
 */
import { CHILD_UNITS } from '../game-data/children';
import { MAPS } from '../game-data/chapters';
import { JOIN_DATA, basesOn } from '../game-data/join';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import { className } from './classes';
import { FORGE, forgeProblem, itemByName } from '../game-data/items';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { EMPTY_ROSTER, parseRoster, type Roster, type RosterUnit } from './roster';

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
};

export type Run = {
  readonly version: 1;
  /** Everything on the roster but unit states and spouses: Run facts, rule-outs, the saved plan, deploy flags. */
  readonly roster: Roster;
  /** In play order. */
  readonly entries: readonly RunEntry[];
};

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
  return { version: 1, roster: { ...roster, states: {}, spouses: {} }, entries: [first] };
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

/** A recruit's first snapshot (#116): a first-gen unit or Robin from its join data, a child from the map's record. */
export function recruitSnapshot(unit: RosterUnit, run: Run, fromMap?: { readonly class: string; readonly level: string; readonly inventory?: readonly string[] }): UnitSnapshot {
  const difficulty = run.roster.run.difficulty === 'normal' ? 'normal' : run.roster.run.difficulty === 'hard' ? 'hard' : run.roster.run.difficulty ? 'lunatic' : 'normal';
  if (unit !== 'robin' && unit in CHILD_UNITS) {
    // A child's stats depend on its parents: record them from the game.
    return { class: fromMap?.class ?? '', level: Number(fromMap?.level) || 1, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], inventory: startingItems(fromMap), supports: [] };
  }
  const j = JOIN_DATA[unit as Exclude<UnitId, 'maiden'> | 'robin'];
  const bases = basesOn(j, difficulty);
  const gender = unit === 'robin' ? (run.roster.run.gender ?? 'M') : (FIRST_GEN_UNITS[unit as UnitId].gender as Gender);
  return {
    class: className(j.joinClass, gender),
    level: j.level,
    promoted: false,
    reclassed: false,
    exp: 0,
    stats: Object.fromEntries(STATS.map((s) => [s, bases[s]])) as Record<Stat, number>,
    skills: j.startingSkills.slice(0, 5),
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
 * The next entry, for the map played: a copy of the latest snapshot, with the map's recruits the snapshot doesn't have
 * yet filled in (#116). The Robin recruit is skipped until Robin's gender is set.
 */
export function addEntry(run: Run, map: string, now: number, label?: string): Run {
  const prev = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const units: Partial<Record<RosterUnit, UnitSnapshot>> = { ...prev.units };
  const data = MAPS.find((m) => m.id === map);
  for (const r of data?.recruits ?? []) {
    const unit = UNIT_BY_NAME.get(r.unit);
    if (!unit || units[unit] || (unit === 'robin' && !run.roster.run.gender)) continue;
    units[unit] = recruitSnapshot(unit, run, r);
  }
  const n = run.entries.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0) + 1;
  const entry: RunEntry = { id: `e${n}`, map, ...(label ? { label } : {}), snapshot: { ...prev, units }, createdAt: now };
  return { ...run, entries: [...run.entries, entry] };
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

/** A stored or imported run; anything unreadable falls back to an empty run. */
export function parseRun(raw: unknown): Run {
  if (!isObject(raw) || raw.version !== 1) return EMPTY_RUN;
  const roster = parseRoster(raw.roster);
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((e, i): RunEntry[] => {
    if (!isObject(e)) return [];
    const map = typeof e.map === 'string' && (e.map === 'other' || MAPS.some((m) => m.id === e.map)) ? e.map : 'other';
    return [
      {
        id: typeof e.id === 'string' && e.id ? e.id : `e${i + 1}`,
        map,
        ...(typeof e.label === 'string' ? { label: e.label } : {}),
        snapshot: parseSnapshot(e.snapshot, roster.run),
        createdAt: num(e.createdAt, 0),
        ...(typeof e.editedAt === 'number' ? { editedAt: e.editedAt } : {}),
      },
    ];
  });
  return entries.length ? { version: 1, roster: { ...roster, states: {}, spouses: {} }, entries } : runFromRoster(roster);
}

/** The run as a file (JSON), read back by importRun. */
export const exportRun = (run: Run): string => JSON.stringify(run, null, 1);
export const importRun = (text: string): Run => parseRun(JSON.parse(text));

