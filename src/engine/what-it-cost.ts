/**
 * What it cost (#208; spec #175, Record results, losses and What changed): the What changed card's list of what each
 * event on the map recorded did to the flawless chance, in flawless points. Each row is one event undone on the same
 * simulated runs (paired: same seed, same rolls), so its difference is the event's price with a small error:
 *
 * - **Died / Missed** (and **Married off-plan**): the run with the loss undone, under the adopted plan, against the run
 *   as recorded under the plan the loss item proposes (the reserves stepping in, the re-solved marriages): what the loss
 *   costs once recovered from. It lists what it broke: the adopted plan's milestones on the unit (or the couple).
 * - **Missed milestones:** each of the adopted plan's milestones due on the map (a support rank, a skill equipped, a
 *   class) that the record doesn't show, priced as if it had been met. The inbox links each to its behind re-solve.
 * - **Fell** (Casual): the unit at the level the forecast expected at the map's end (the rest of the map it missed), at
 *   its average growths.
 * - **Levels against the forecast:** each unit the forecast fielded whose recorded level is outside its spread, moved to
 *   the forecast's median: a cost below it, a gain above it.
 * - **Over-plan spending:** one row when the map's shopping spent more gold than the plan's stop after it (the forecast
 *   kept on the entry, `EntryForecast.spend`): the run with that excess back, and the endpoint kit pieces the excess
 *   costs (the kit shrinking).
 *
 * Rows under about 0.1 points either way roll up into one line.
 */
import type { Growths } from '../game-data/stats';
import { STATS } from '../game-data/stats';
import { runLosses, type RunLoss } from './losses';
import type { Milestone } from './milestones';
import type { RosterUnit } from './roster';
import type { Run, RunEntry, Snapshot, UnitSnapshot } from './run';
import type { RunSim } from './sim/run-sim';
import { paired } from './solve/paired';
import type { Plan } from './solve/plan';
import { SUPPORT_LEVELS, mapProgress } from './run';

/** Rows smaller than this either way (0.1 flawless points) are rolled up. */
export const COST_ROLL_UP = 0.001;

export type CostRowKind = 'died' | 'missed' | 'married' | 'milestone' | 'fell' | 'level' | 'over-plan';

export type CostRow = {
  readonly key: string;
  readonly kind: CostRowKind;
  /** The unit it's about (a marriage's first partner; none for over-plan spending). */
  readonly unit?: RosterUnit;
  readonly couple?: readonly [RosterUnit, RosterUnit];
  /** The event's price in flawless chance: negative a cost, positive a gain; and its paired error (±, 95%). */
  readonly points: number;
  readonly margin: number;
  /** A loss: the adopted plan's milestones it broke. */
  readonly broke?: readonly Milestone[];
  /** A missed milestone. */
  readonly milestone?: Milestone;
  /** A fall or a level: the recorded level and the forecast's (EXP as the fraction). */
  readonly level?: { readonly recorded: number; readonly forecast: number };
  /** Over-plan spending: the gold spent over the plan, and the endpoint kit pieces it costs. */
  readonly excess?: number;
  readonly kit?: readonly { readonly item: string; readonly unit: RosterUnit; readonly name: string }[];
};

export type WhatItCost = {
  /** The entry priced (the latest). */
  readonly entry: string;
  /** Rows of at least `COST_ROLL_UP` either way: costs first (largest first), then gains. */
  readonly rows: readonly CostRow[];
  /** The rows rolled up: how many, and their points together. */
  readonly small: { readonly count: number; readonly points: number } | undefined;
  readonly runs: number;
};

/** What pricing needs from the engine: the runs simulated for a run and plan, and the plan's milestones and recovery. */
export type CostDeps = {
  readonly sim: (run: Run, plan: Plan) => RunSim;
  readonly milestones: (run: Run, plan: Plan) => readonly Milestone[];
  /** The loss item's proposal for the run as recorded. */
  readonly recovery: (run: Run, plan: Plan) => Plan;
  readonly growths: (run: Run, unit: RosterUnit) => Growths | undefined;
};

/** The run with its latest entry's snapshot edited. */
function withLatest(run: Run, edit: (s: Snapshot, e: RunEntry) => Snapshot): Run {
  const i = run.entries.length - 1;
  const entries = [...run.entries];
  entries[i] = { ...entries[i]!, snapshot: edit(entries[i]!.snapshot, entries[i]!) };
  return { ...run, entries };
}

const withUnitSnap = (s: Snapshot, u: RosterUnit, next: UnitSnapshot): Snapshot => ({ ...s, units: { ...s.units, [u]: next } });

/** The run with a loss undone: the unit's state as before the map, or the couple unmarried. */
function undone(run: Run, loss: RunLoss): Run {
  return withLatest(run, (s) => {
    if (loss.kind === 'married') {
      const spouses = { ...s.spouses };
      for (const u of loss.couple ?? []) delete spouses[u];
      return { ...s, spouses };
    }
    const states = { ...s.states };
    const was = run.entries[run.entries.length - 2]?.snapshot.states[loss.unit];
    if (was) states[loss.unit] = was;
    else delete states[loss.unit];
    return { ...s, states };
  });
}

/** A unit moved to a level (EXP as the fraction), its stats changed by its average growths for the levels between. */
function atLevel(u: UnitSnapshot, level: number, growths: Growths | undefined): UnitSnapshot {
  const lv = Math.floor(level);
  const exp = Math.round((level - lv) * 100);
  const levels = lv - u.level;
  const stats = u.stats && growths ? (Object.fromEntries(STATS.map((s) => [s, Math.max(0, u.stats![s] + (growths[s] / 100) * levels)])) as Record<(typeof STATS)[number], number>) : u.stats;
  return { ...u, level: lv, exp, stats };
}

/** Whether the record shows a milestone met on the latest snapshot. */
function met(m: Milestone, s: Snapshot): boolean {
  const lower = (x: string) => x.trim().toLowerCase();
  switch (m.kind) {
    case 'support': {
      const [a, b] = m.pair;
      if (s.spouses[a]?.bond === 'married' && s.spouses[a]?.partner === b) return true;
      const rank = s.units[a]?.supports.find((p) => p.partner === b)?.rank ?? s.units[b]?.supports.find((p) => p.partner === a)?.rank;
      return !!rank && SUPPORT_LEVELS.indexOf(rank) >= SUPPORT_LEVELS.indexOf(m.rank);
    }
    case 'skill':
      return !!s.units[m.unit]?.skills.some((k) => lower(k) === lower(m.name));
    case 'class':
      return lower(s.units[m.unit]?.class ?? '') === lower(m.className);
    case 'recruit':
      return !!s.units[m.child];
  }
}

/** The snapshot with a milestone met (see `met`); a class change keeps the unit's level and stats. */
function meeting(m: Milestone, s: Snapshot): Snapshot {
  switch (m.kind) {
    case 'support': {
      const [a, b] = m.pair;
      const set = (u: RosterUnit, p: RosterUnit) => {
        const x = s.units[u];
        return x ? { [u]: { ...x, supports: [...x.supports.filter((q) => q.partner !== p), { partner: p, rank: m.rank }] } } : {};
      };
      return { ...s, units: { ...s.units, ...set(a, b), ...set(b, a) } };
    }
    case 'skill': {
      const u = s.units[m.unit];
      return u ? withUnitSnap(s, m.unit, { ...u, skills: [...u.skills.slice(0, 4), m.name] }) : s;
    }
    case 'class': {
      const u = s.units[m.unit];
      return u ? withUnitSnap(s, m.unit, { ...u, class: m.className, ...(m.seal === 'master' ? { promoted: true } : { reclassed: true }) }) : s;
    }
    case 'recruit':
      return s;
  }
}

/**
 * What it cost for the latest entry (see the module comment), under `plan` (the adopted one); undefined when the latest
 * entry isn't a map recorded after another.
 */
export function whatItCost(run: Run, plan: Plan, deps: CostDeps): WhatItCost | undefined {
  const i = run.entries.length - 1;
  const e = run.entries[i];
  if (!e || i < 1 || e.map === 'other') return undefined;
  const before: Run = { ...run, entries: run.entries.slice(0, i) };
  const f = e.forecast && e.forecast.map === e.map ? e.forecast : undefined;
  const losses = runLosses(run, plan).filter((l) => l.entry === e.id);
  const recovery = losses.length ? deps.recovery(run, plan) : plan;
  const actual = deps.sim(run, recovery);
  const planned = deps.milestones(before, plan);
  const rows: CostRow[] = [];
  const price = (cf: RunSim) => paired(cf.samples, actual.samples);
  const lost = new Set(losses.flatMap((l) => (l.kind === 'married' ? [] : [l.unit])));

  for (const l of losses) {
    const p = price(deps.sim(undone(run, l), plan));
    const on = l.couple ?? [l.unit];
    const broke = planned.filter((m) => m.units.some((u) => on.includes(u)));
    rows.push({ key: l.key, kind: l.kind, unit: l.unit, ...(l.couple ? { couple: l.couple } : {}), points: p.gain, margin: p.margin, broke });
  }

  // Milestones due on the map (the forecast's), not met in the record: each priced as met.
  if (f)
    for (const m of planned) {
      if (m.at.index !== 0 || m.kind === 'recruit' || (m.kind === 'support' && m.wedding) || m.units.some((u) => lost.has(u)) || met(m, e.snapshot)) continue;
      const p = price(deps.sim(withLatest(run, (s) => meeting(m, s)), recovery));
      rows.push({ key: `milestone:${m.id}`, kind: 'milestone', unit: m.units[0]!, points: p.gain, margin: p.margin, milestone: m });
    }

  // Falls (Casual) and levels outside the forecast's spread, moved to its median.
  const fell = new Set(e.fell ?? []);
  for (const x of f?.exp ?? []) {
    const u = e.snapshot.units[x.unit];
    if (!u || lost.has(x.unit)) continue;
    const recorded = u.level + u.exp / 100;
    const outside = recorded < x.level.low - 0.05 || recorded > x.level.high + 0.05;
    // A level copied forward unchanged wasn't updated: no result to price.
    if (!fell.has(x.unit) && (!outside || mapProgress(run, i, x.unit)?.kind === 'unchanged')) continue;
    if (Math.abs(recorded - x.level.median) < 0.05) continue;
    const cf = withLatest(run, (s) => withUnitSnap(s, x.unit, atLevel(u, x.level.median, deps.growths(run, x.unit))));
    const p = price(deps.sim(cf, recovery));
    rows.push({ key: `${fell.has(x.unit) ? 'fell' : 'level'}:${x.unit}`, kind: fell.has(x.unit) ? 'fell' : 'level', unit: x.unit, points: p.gain, margin: p.margin, level: { recorded, forecast: x.level.median } });
  }
  // A unit that fell with no forecast for it still gets its row (nothing to price it against).
  for (const u of fell) if (!rows.some((r) => r.kind === 'fell' && r.unit === u)) rows.push({ key: `fell:${u}`, kind: 'fell', unit: u, points: 0, margin: 0 });

  // Over-plan spending: one row, with the kit pieces the excess costs at the endpoint.
  const spent = (e.shopping ?? []).reduce((g, l) => g + (l.kind === 'sell' ? -l.gold : l.gold), 0);
  if (f?.spend !== undefined && spent > f.spend && e.snapshot.gold !== null) {
    const excess = spent - f.spend;
    const cf = deps.sim(
      withLatest(run, (s) => ({ ...s, gold: s.gold! + excess })),
      recovery,
    );
    const p = price(cf);
    const kitOf = (r: RunSim) => r.shopping.flatMap((st) => st.lines.filter((x) => x.kind === 'kit' && x.share >= 0.5));
    const now = kitOf(actual);
    const kit = kitOf(cf)
      .filter((x) => !now.some((y) => y.item === x.item && y.unit === x.unit && y.action === x.action))
      .map((x) => ({ item: x.action === 'forge' ? `${x.item} (forged)` : x.item, unit: x.unit, name: x.name }));
    rows.push({ key: 'over-plan', kind: 'over-plan', points: p.gain, margin: p.margin, excess, kit });
  }

  // Losses and over-plan spending always show; the rest roll up under the threshold.
  const shown = (r: CostRow) => r.kind === 'died' || r.kind === 'missed' || r.kind === 'married' || r.kind === 'fell' || r.kind === 'over-plan' || Math.abs(r.points) >= COST_ROLL_UP;
  const small = rows.filter((r) => !shown(r));
  const cost = (r: CostRow) => r.points < 0;
  const kept = rows.filter(shown).sort((a, b) => (cost(a) !== cost(b) ? (cost(a) ? -1 : 1) : cost(a) ? a.points - b.points : b.points - a.points));
  return {
    entry: e.id,
    rows: kept,
    small: small.length ? { count: small.length, points: small.reduce((a, r) => a + r.points, 0) } : undefined,
    runs: actual.runs,
  };
}
