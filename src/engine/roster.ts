/**
 * Roster state: run facts, unit states and marriages, as plain serialisable data, and the blocked-pairing
 * evaluation that reads it. Tables and the leaderboard only read the roster; it never changes a score.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import { CHROM_FALLBACK_PARTNER, ROBIN_SUPPORTS, S_SUPPORTS } from '../game-data/supports';
import type { Assumptions } from './assumptions';
import type { Pairing, ParentRef } from './types';

/** A unit the roster tracks: a first-gen unit, Robin (of the run's gender) or a child. */
export type RosterUnit = UnitId | ChildId | 'robin';

/** Where a unit stands in the run. Not yet recruited prunes nothing; Benched is soft; Missed and Dead are hard. */
export type UnitState = 'available' | 'not-recruited' | 'benched' | 'missed' | 'dead';

/** Facts fixed at the start of a playthrough; null while not set. They remove pairings rather than block them. */
export type RunFacts = { readonly gender: Gender | null; readonly asset: Stat | null; readonly flaw: Stat | null };

/** A marriage that happened (hard), or a planned marriage the player has pinned (soft). */
export type Bond = 'married' | 'pinned';

/** A unit's spouse and how they are bound. */
export type Spouse = { readonly partner: RosterUnit; readonly bond: Bond };

export type Roster = {
  readonly run: RunFacts;
  /** Units not listed are Available. */
  readonly states: Readonly<Partial<Record<RosterUnit, UnitState>>>;
  /** Each unit's one spouse, recorded both ways. */
  readonly spouses: Readonly<Partial<Record<RosterUnit, Spouse>>>;
};

export const EMPTY_ROSTER: Roster = { run: { gender: null, asset: null, flaw: null }, states: {}, spouses: {} };

export const UNIT_STATES: readonly UnitState[] = ['available', 'not-recruited', 'benched', 'missed', 'dead'];

export const stateOf = (roster: Roster, u: RosterUnit): UnitState => roster.states[u] ?? 'available';

export function withState(roster: Roster, u: RosterUnit, state: UnitState): Roster {
  const states = { ...roster.states };
  if (state === 'available') delete states[u];
  else states[u] = state;
  return { ...roster, states };
}

/** Records `a`'s spouse (or none), dropping both units' previous spouses: one spouse per unit. */
export function withSpouse(roster: Roster, a: RosterUnit, b: RosterUnit | null, bond: Bond = 'pinned'): Roster {
  const spouses = { ...roster.spouses };
  for (const u of b ? [a, b] : [a]) {
    const old = spouses[u];
    if (old) delete spouses[old.partner];
    delete spouses[u];
  }
  if (b) {
    spouses[a] = { partner: b, bond };
    spouses[b] = { partner: a, bond };
  }
  return { ...roster, spouses };
}

/** A unit that can no longer take part in a planned marriage (benched, missed or dead). */
const outOfPlay = (roster: Roster, u: RosterUnit) => ['dead', 'missed', 'benched'].includes(stateOf(roster, u));

/** Why a unit's pin is void (either side dead, missed or benched), or undefined if it holds or there is no pin. */
export function voidPinReason(roster: Roster, u: RosterUnit): string | undefined {
  const s = roster.spouses[u];
  if (s?.bond !== 'pinned') return undefined;
  const lost = [u, s.partner].find((x) => outOfPlay(roster, x));
  return lost && `${unitName(lost, roster.run.gender)} ${STATE_PHRASES[stateOf(roster, lost)]}`;
}

/** The unit's pin or marriage, unless it is a void pin (which frees the unit). */
function bondOf(roster: Roster, u: RosterUnit) {
  const s = roster.spouses[u];
  return s && (s.bond === 'married' || !voidPinReason(roster, u)) ? s : undefined;
}

const STATE_PHRASES: Readonly<Record<UnitState, string>> = {
  available: 'is available',
  'not-recruited': 'is not yet recruited',
  benched: 'is benched',
  missed: 'was missed',
  dead: 'is dead',
};

/** A pairing's status on the roster: its hard and soft reasons, plus notes that block nothing. */
export type Blocking = {
  readonly status: 'open' | 'planned' | 'married' | 'soft' | 'hard';
  readonly hard: readonly string[];
  readonly soft: readonly string[];
  readonly notes: readonly string[];
};

export function unitName(u: RosterUnit, gender: Gender | null = null): string {
  if (u === 'robin') return gender ? `Robin (${gender})` : 'Robin';
  return u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].name : FIRST_GEN_UNITS[u as UnitId].name;
}

const parentUnit = (ref: ParentRef): RosterUnit => (ref.kind === 'robin' ? 'robin' : ref.id);

/** The marriages a pairing needs: the child's parents, and a second-gen partner's own parents. */
function marriagesOf(pairing: Pairing): [RosterUnit, RosterUnit][] {
  const fixed = CHILD_UNITS[pairing.child].fixedParent;
  const vp = pairing.variableParent;
  const out: [RosterUnit, RosterUnit][] = [[fixed, parentUnit(vp)]];
  if (vp.kind === 'child') out.push([CHILD_UNITS[vp.id].fixedParent, parentUnit(vp.variableParent)]);
  return out;
}

/** Evaluates one pairing against the roster. Pure: (pairing, roster, assumptions) → reasons. */
export function evaluateBlocking(pairing: Pairing, roster: Roster, assumptions: Assumptions): Blocking {
  const marriages = marriagesOf(pairing);
  const units = [...new Set<RosterUnit>([pairing.child, ...marriages.flat()])];
  const gender = roster.run.gender;
  const name = (u: RosterUnit) => unitName(u, gender);
  const hard: string[] = [];
  const soft: string[] = [];
  const notes: string[] = [];
  let allMarried = true;
  let allPlanned = true;
  for (const [a, b] of marriages) {
    const [ba, bb] = [bondOf(roster, a), bondOf(roster, b)];
    if (ba?.partner === b) {
      if (ba.bond === 'pinned') allMarried = false;
      continue;
    }
    allMarried = allPlanned = false;
    for (const [u, bond] of [[a, ba], [b, bb]] as const) {
      if (!bond) continue;
      if (bond.bond === 'married') hard.push(`${name(u)} is married to ${name(bond.partner)}`);
      else soft.push(`${name(u)} is planned with ${name(bond.partner)}`);
    }
  }
  // A parent in one of the pairing's marriages that has already happened.
  const wed = (u: RosterUnit) => marriages.some(([a, b]) => (u === a || u === b) && roster.spouses[a]?.partner === b && roster.spouses[a]?.bond === 'married');
  for (const u of units) {
    const st = stateOf(roster, u);
    if (wed(u) && st === 'benched') continue;
    if (wed(u) && st === 'dead' && assumptions['child-after-parent-death']) notes.push(`${name(u)} died after marrying: the child still comes ⚠`);
    else if (st === 'dead' || st === 'missed') hard.push(`${name(u)} ${STATE_PHRASES[st]}`);
    else if (st === 'benched') soft.push(`${name(u)} ${STATE_PHRASES[st]}`);
  }
  const status = hard.length ? 'hard' : soft.length ? 'soft' : allMarried ? 'married' : allPlanned ? 'planned' : 'open';
  return { status, hard, soft, notes };
}

/** A unit as the Roster page lists it. */
export type RosterEntry = {
  readonly id: RosterUnit;
  readonly name: string;
  readonly gender: Gender;
  readonly kind: 'robin' | 'first-gen' | 'child';
  /** A first-gen unit that can marry only Robin. */
  readonly robinOnly: boolean;
  /** False for Robin and Chrom: their deaths are a Game Over, so a kept save never has them dead or missed. */
  readonly canBeLost: boolean;
  /** Who the unit can marry in this run, in data order. */
  readonly partners: readonly RosterUnit[];
};

const UNIT_IDS = (Object.keys(FIRST_GEN_UNITS) as UnitId[]).filter((u) => u !== CHROM_FALLBACK_PARTNER);
const CHILD_IDS = Object.keys(CHILD_UNITS) as ChildId[];

/** A first-gen unit's S-support partners other than Robin (Chrom also has his fallback wife, the Maiden). */
function firstGenPartners(u: UnitId): UnitId[] {
  const own = S_SUPPORTS[u];
  if (own) return [...own];
  const men = UNIT_IDS.filter((w) => S_SUPPORTS[w]?.includes(u));
  return u === 'chrom' ? [...men, CHROM_FALLBACK_PARTNER] : men;
}

/**
 * Every unit the roster tracks in this run: Robin once the run's gender is set, the first-gen units (not the
 * Maiden, who is never recruited) and the children, with only the run's Morgan once Robin's gender is known.
 */
export function rosterUnits(run: RunFacts): RosterEntry[] {
  const g = run.gender;
  const robinPartners: readonly RosterUnit[] = g ? ROBIN_SUPPORTS[g] : [];
  const withRobin = (u: RosterUnit, others: readonly RosterUnit[]) => (robinPartners.includes(u) ? [...others, 'robin' as const] : others);
  const robin: RosterEntry[] = g ? [{ id: 'robin', name: `Robin (${g})`, gender: g, kind: 'robin', robinOnly: false, canBeLost: false, partners: robinPartners }] : [];
  const firstGen = UNIT_IDS.map((id): RosterEntry => {
    const own = firstGenPartners(id);
    const { name, gender } = FIRST_GEN_UNITS[id];
    return { id, name, gender, kind: 'first-gen', robinOnly: own.length === 0, canBeLost: id !== 'chrom', partners: withRobin(id, own) };
  });
  const children = CHILD_IDS.filter((id) => !g || CHILD_UNITS[id].fixedParent !== 'robin' || CHILD_UNITS[id].gender !== g).map(
    (id): RosterEntry => ({ id, name: CHILD_UNITS[id].name, gender: CHILD_UNITS[id].gender, kind: 'child', robinOnly: false, canBeLost: true, partners: withRobin(id, []) }),
  );
  return [...robin, ...firstGen, ...children];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStat = (v: unknown): v is Stat => (STATS as readonly unknown[]).includes(v);

/** Reads a saved roster, dropping anything stale or corrupt: unknown units or states, and one-sided or impossible marriages. */
export function parseRoster(raw: unknown): Roster {
  if (!isObject(raw)) return EMPTY_ROSTER;
  const r = isObject(raw.run) ? raw.run : {};
  const asset = isStat(r.asset) ? r.asset : null;
  const run: RunFacts = {
    gender: r.gender === 'M' || r.gender === 'F' ? r.gender : null,
    asset,
    flaw: isStat(r.flaw) && r.flaw !== asset ? r.flaw : null,
  };
  const units = new Map(rosterUnits(run).map((u) => [u.id as string, u]));
  // The Maiden is never listed, but she can be Chrom's wife.
  const partnersOf = (id: string): readonly string[] =>
    id === CHROM_FALLBACK_PARTNER ? ['chrom'] : (units.get(id)?.partners ?? []);
  const states: Partial<Record<RosterUnit, UnitState>> = {};
  if (isObject(raw.states)) {
    for (const [id, st] of Object.entries(raw.states)) {
      if (units.has(id) && st !== 'available' && UNIT_STATES.includes(st as UnitState)) states[id as RosterUnit] = st as UnitState;
    }
  }
  const spouses: Partial<Record<RosterUnit, Spouse>> = {};
  const saved = isObject(raw.spouses) ? raw.spouses : {};
  for (const [id, s] of Object.entries(saved)) {
    if (!isObject(s) || typeof s.partner !== 'string' || (s.bond !== 'married' && s.bond !== 'pinned')) continue;
    const back = saved[s.partner];
    if (!isObject(back) || back.partner !== id || back.bond !== s.bond || !partnersOf(id).includes(s.partner)) continue;
    spouses[id as RosterUnit] = { partner: s.partner as RosterUnit, bond: s.bond };
  }
  return { run, states, spouses };
}

/**
 * Changes the run facts. A flaw equal to the new asset is cleared, and marriages that can't exist in the new run
 * (Robin's, when Robin's gender changes) are dropped.
 */
export function withRun(roster: Roster, next: Partial<RunFacts>): Roster {
  const run = { ...roster.run, ...next };
  return parseRoster({ ...roster, run: { ...run, flaw: run.flaw === run.asset ? null : run.flaw } });
}
