/**
 * The chapter log (#116; Map: Route planner #87): a run's copy-forward record, one entry per map played. Each entry
 * holds a snapshot of the army: every unit's class, level, EXP, actual stats, equipped skills, inventory and support
 * ranks, plus the convoy, gold, unit states and marriages. The roster's unit states and spouses come from the latest
 * entry; everything else on the roster (Run facts, rule-outs, the saved plan, deploy flags) stays on the run.
 */
import { CHILD_UNITS } from '../game-data/children';
import { MAPS, type ChapterData } from '../game-data/chapters';
import { JOIN_DATA, basesOn } from '../game-data/join';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import { className } from './classes';
import { robinBases } from './unit-page';
import { FORGE, forgeProblem, itemByName } from '../game-data/items';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
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
};

export type Run = {
  readonly version: 1;
  /** Lunatic+ random skills the player saw on a map's enemies (#120): map id → foe key → skills. */
  readonly seen?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
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

/**
 * A recruit's first snapshot (#116): a first-gen unit or Robin from its join data, a child from the map's record. A
 * setup used only on one map (Premonition's Chrom and Robin, #131) is the map's record, stats and all.
 */
export function recruitSnapshot(unit: RosterUnit, run: Run, fromMap?: Pick<MapRecruit, 'class' | 'level' | 'inventory' | 'stats'>): UnitSnapshot {
  if (fromMap?.stats) {
    const stats = Object.fromEntries(STATS.map((s) => [s, setupStat(fromMap.stats![s], s, run.roster.run)])) as Record<Stat, number>;
    return { class: fromMap.class, level: Number(fromMap.level) || 1, promoted: false, reclassed: false, exp: 0, stats, skills: [], inventory: startingItems(fromMap), supports: [] };
  }
  const difficulty = run.roster.run.difficulty === 'normal' ? 'normal' : run.roster.run.difficulty === 'hard' ? 'hard' : run.roster.run.difficulty ? 'lunatic' : 'normal';
  if (unit !== 'robin' && unit in CHILD_UNITS) {
    // A child's stats depend on its parents: record them from the game.
    return { class: fromMap?.class ?? '', level: Number(fromMap?.level) || 1, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], inventory: startingItems(fromMap), supports: [] };
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
 * yet filled in (#116). The Robin recruit is skipped until Robin's gender is set, and a setup used only on the map
 * (Premonition's, #131) never joins the army.
 */
export function addEntry(run: Run, map: string, now: number, label?: string): Run {
  const prev = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const units: Partial<Record<RosterUnit, UnitSnapshot>> = { ...prev.units };
  for (const [unit, r] of newRecruits(run, prev, map)) if (!mapOnly(r)) units[unit] = recruitSnapshot(unit, run, r);
  const n = run.entries.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0) + 1;
  const entry: RunEntry = { id: `e${n}`, map, ...(label ? { label } : {}), snapshot: { ...prev, units }, createdAt: now };
  return { ...run, entries: [...run.entries, entry] };
}

/** A map's recruits the snapshot doesn't have yet, as roster units. The Robin recruit waits for Robin's gender. */
function newRecruits(run: Run, snap: Snapshot, map: string): [RosterUnit, MapRecruit][] {
  return (MAPS.find((m) => m.id === map)?.recruits ?? []).flatMap((r): [RosterUnit, MapRecruit][] => {
    const unit = UNIT_BY_NAME.get(r.unit);
    return unit && !snap.units[unit] && (unit !== 'robin' || run.roster.run.gender) ? [[unit, r]] : [];
  });
}

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
 * The units a map's preparation page can field (#131): the army from the latest entry, plus the recruits on the map
 * from turn 1, built as Record results will build them, and any setup used only on this map. Later recruits are listed
 * apart. Like Record results, the Robin recruit waits for Robin's gender; a unit already in the army or dead is left out.
 */
export function prepUnits(run: Run, map: string): PrepUnits {
  const snap = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const alive = (u: RosterUnit) => run.roster.states[u] !== 'dead' && snap.states[u] !== 'dead';
  const units = (Object.entries(snap.units) as [RosterUnit, UnitSnapshot][]).filter(([u]) => alive(u));
  const joining: RosterUnit[] = [];
  const onlyHere: RosterUnit[] = [];
  const later: LaterRecruit[] = [];
  for (const [unit, r] of newRecruits(run, snap, map)) {
    if (!alive(unit)) continue;
    if (mapOnly(r) || /^Automatically from turn 1\b/.test(r.how ?? '')) {
      units.push([unit, recruitSnapshot(unit, run, r)]);
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
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`paralogue-${i + 5}`, 'Opens once the child’s parent is married (after Chapter 13).'])),
  'paralogue-7': 'Opens once Maribelle has an S support (after Chapter 13).',
  'paralogue-12': 'Opens once Robin is married (after Chapter 13).',
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`paralogue-${i + 18}`, 'Needs SpotPass data, which may no longer be downloadable now the 3DS online services have ended.'])),
};

/**
 * The maps the run can play next (#118): story and paralogues its cleared maps have unlocked (the Premonition to start),
 * and on a Full route every DLC xenologue it hasn't played. Grind maps are never offered: log them as “other”.
 */
export function nextMaps(run: Run): MapOffer[] {
  const cleared = new Set(run.entries.map((e) => e.map));
  const unlocked = new Set<string>(['premonition']);
  for (const m of MAPS) if (cleared.has(m.id)) m.unlocks.forEach((u) => unlocked.add(u));
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

/** A unit fell on the map: dead for good on Classic; on Casual it comes back, so nothing changes. */
export function recordFallen(run: Run, id: string, unit: RosterUnit, now: number): Run {
  if (run.roster.run.mode === 'casual') return run;
  return withEntryRoster(run, id, (r) => withState(r, unit, 'dead'), now);
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
  const seen: Record<string, Record<string, string[]>> = {};
  for (const [map, foes] of Object.entries(isObject(raw.seen) ? raw.seen : {}))
    for (const [foe, skills] of Object.entries(isObject(foes) ? foes : {}))
      if (Array.isArray(skills)) (seen[map] ??= {})[foe] = skills.filter((x): x is string => typeof x === 'string');
  const base: Run = entries.length ? { version: 1, roster: { ...roster, states: {}, spouses: {} }, entries } : runFromRoster(roster);
  return Object.keys(seen).length ? { ...base, seen } : base;
}

/** The run as a file (JSON), read back by importRun. */
export const exportRun = (run: Run): string => JSON.stringify(run, null, 1);
export const importRun = (text: string): Run => parseRun(JSON.parse(text));

