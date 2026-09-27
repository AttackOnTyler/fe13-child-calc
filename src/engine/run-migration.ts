/**
 * The one-time migration to `run:v2` (#205; spec #175, Pages, storage and migration), and the run file's import.
 *
 * From `run:v1` (and a roster from before the chapter log) and `plan:v1`:
 * - **Kept, as pins:** each pinned marriage (a pinned bond in the chapter log) becomes a marriage pin; each rule-out a
 *   marriage pin with `forbid`; an unticked Deploy or a Benched unit a keep-out pin. A pin already on the run stays and
 *   wins over the same choice migrated. A pin broken by a dead or missed unit is dropped.
 * - **Dropped:** a ticked Deploy, the adopted marriage plan, deployment roles, and all of `plan:v1`: priorities, preset
 *   and role overrides, composition quotas and the guide's act flags. The chapter log, Run facts and everything else on
 *   the run come across as they are; unit states lose Benched (a keep-out now), spouses lose their pinned bonds (pins
 *   now).
 * - **The migration note** lists what was kept and dropped, and suggests keep-in pins for the children the priorities
 *   rated above the default. Nothing to list, no note.
 *
 * The migration only reads: `run:v1` and `plan:v1` stay as they are (the storage module keeps `run:v1` as a backup).
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { pinLoss, unitName, type Couple, type Roster, type RosterUnit, type UnitState } from './roster';
import { EMPTY_RUN, parseRun, parseRunFields, rosterOf, type MigrationNote, type Run } from './run';
import type { KeepPin, MarriagePin, PlanPin } from './solve/plan';
import { uniquePins } from './solve/pins';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `plan:v1`'s priorities: 0 (don't care) to 3 (must be great), 1 by default. */
const OLD_PRIORITIES = [0, 1, 2, 3];
const OLD_DEFAULT_PRIORITY = 1;
const PLAY_CONTEXTS: Readonly<Record<string, string>> = { 'main-story': 'Main story', 'full-route': 'Full route', all: 'All' };

/** A child id of `plan:v1`'s maps, in the table's order. */
const childKeys = (v: unknown): ChildId[] => (isObject(v) ? (Object.keys(v).filter((k) => k in CHILD_UNITS) as ChildId[]) : []);

/**
 * A `run:v1` (as stored, or a file exported before #205) and `plan:v1` (as stored; absent for a file) as one
 * `run:v2` with its migration note (see the module comment). Anything unreadable gives an empty run.
 */
export function migrateRun(runV1: unknown, planV1?: unknown): Run {
  if (!isObject(runV1)) return EMPTY_RUN;
  const old = parseRunFields(runV1);
  const roster = rosterOf(old);
  const gender = roster.run.gender;
  const name = (u: RosterUnit) => unitName(u, gender);
  const names = (us: readonly RosterUnit[]) => us.map(name).join(', ');
  const couple = ([a, b]: Couple) => `${name(a)} and ${name(b)}`;
  const kept: string[] = [];
  const dropped: string[] = [];
  const pins: PlanPin[] = [];

  // Pinned marriages, each couple once; a broken one (dead or missed) is dropped.
  const seen = new Set<RosterUnit>();
  for (const [u, s] of Object.entries(roster.spouses) as [RosterUnit, Roster['spouses'][RosterUnit]][]) {
    if (s?.bond !== 'pinned' || seen.has(u)) continue;
    seen.add(u).add(s.partner);
    const loss = pinLoss(roster, u);
    if (loss?.status === 'broken') dropped.push(`Marriage pin: ${couple([u, s.partner])} (broken: ${loss.reason})`);
    else {
      pins.push({ kind: 'marriage', couple: [u, s.partner] } satisfies MarriagePin);
      kept.push(`Marriage pin: ${couple([u, s.partner])}`);
    }
  }
  for (const c of old.roster.ruleOuts) {
    pins.push({ kind: 'marriage', couple: [c[0], c[1]], forbid: true } satisfies MarriagePin);
    kept.push(`Rule-out: ${couple(c)}`);
  }

  // Keep-outs: an unticked Deploy, a Benched unit.
  const why = new Map<RosterUnit, string[]>();
  const out = (u: RosterUnit, reason: string) => why.set(u, [...(why.get(u) ?? []), reason]);
  const ticked: RosterUnit[] = [];
  for (const [u, deploy] of Object.entries(old.roster.deploy) as [RosterUnit, boolean | undefined][]) {
    if (deploy === false) out(u, 'Deploy unticked');
    else if (deploy === true) ticked.push(u);
  }
  for (const [u, st] of Object.entries(roster.states) as [RosterUnit, UnitState | undefined][]) if (st === 'benched') out(u, 'Benched');
  for (const [u, reasons] of why) {
    pins.push({ kind: 'keep', unit: u, keep: 'out' } satisfies KeepPin);
    kept.push(`Keep-out: ${name(u)} (${reasons.join(', ')})`);
  }

  if (ticked.length) dropped.push(`Deploy ticked: ${names(ticked)}`);
  if (old.roster.savedPlan) dropped.push('The adopted marriage plan');
  const roles = Object.keys(old.roster.deployRoles) as RosterUnit[];
  if (roles.length) dropped.push(`Deployment roles: ${names(roles)}`);

  // plan:v1: all dropped; priorities above the default suggest keep-in pins.
  const plan = isObject(planV1) ? planV1 : {};
  const priorities = isObject(plan.priorities) ? plan.priorities : {};
  const rated = childKeys(priorities).filter((c) => OLD_PRIORITIES.includes(priorities[c] as number));
  if (rated.length) dropped.push(`Priorities: ${rated.map((c) => `${name(c)} ${priorities[c]}`).join(', ')}`);
  const gone = (u: RosterUnit) => why.has(u) || ['dead', 'missed'].includes(roster.states[u] ?? 'available');
  const keepIn = rated
    .filter((c) => (priorities[c] as number) > OLD_DEFAULT_PRIORITY && !gone(c))
    .sort((a, b) => (priorities[b] as number) - (priorities[a] as number));
  const presets = childKeys(plan.overrides);
  if (presets.length) dropped.push(`Preset overrides: ${names(presets)}`);
  const roleOverrides = childKeys(plan.roleOverrides);
  if (roleOverrides.length) dropped.push(`Role overrides: ${names(roleOverrides)}`);
  const quotas = isObject(plan.quotas) ? Object.keys(plan.quotas).filter((k) => k in PLAY_CONTEXTS) : [];
  if (quotas.length) dropped.push(`Composition quotas: ${quotas.map((k) => PLAY_CONTEXTS[k]).join(', ')}`);

  // The run: pinned bonds and Benched leave the chapter log; the roster keeps only its facts.
  const entries = old.entries.map((e) => {
    const states = Object.fromEntries(Object.entries(e.snapshot.states).filter(([, st]) => st !== 'benched'));
    const spouses = Object.fromEntries(Object.entries(e.snapshot.spouses).filter(([, s]) => s?.bond !== 'pinned'));
    return { ...e, snapshot: { ...e.snapshot, states, spouses } };
  });
  const all = uniquePins([...pins, ...(old.pins ?? [])]);
  const note: MigrationNote = { kept, dropped, keepIn };
  const { pins: _, ...rest } = old;
  return {
    ...rest,
    version: 2,
    roster: { ...old.roster, ruleOuts: [], savedPlan: null, deploy: {}, deployRoles: {} },
    entries,
    ...(all.length ? { pins: all } : {}),
    ...(kept.length || dropped.length || keepIn.length ? { migration: note } : {}),
  };
}

/** A run file: a `run:v2` as it is; one exported before #205 (`run:v1`) is migrated (without `plan:v1`). */
export function importRun(text: string): Run {
  const raw: unknown = JSON.parse(text);
  return isObject(raw) && raw.version === 1 ? migrateRun(raw) : parseRun(raw);
}

/** The run with its migration note dismissed. */
export function dismissMigrationNote(run: Run): Run {
  const { migration: _, ...rest } = run;
  return rest;
}
