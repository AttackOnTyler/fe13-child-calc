/**
 * Losses (#208; spec #175, Record results, losses and What changed): what Record results can record that the adopted
 * plan didn't plan for, and the fall log.
 *
 * - **A loss** is a death (Classic), a missed recruit, or a marriage off the adopted plan, recorded on a map (a state in
 *   the first entry, from before the chapter log, predates every plan and isn't one). Each puts **one loss item** at
 *   the top of the inbox: the re-solve's proposal (`lossPlan`: reserves step in; marriages, passed skills and the
 *   roadmap re-solve) with the flawless chance before and after, never applied until the player accepts it. Until then
 *   the loss is **open** and Prepare says the plan predates it. Accepting (or, when the proposal changes nothing, seeing
 *   it) **settles** it (`Run.settledLosses`).
 * - **A fall on Casual** isn't a loss: the unit comes back after the map with its slot and children. It's **logged**
 *   (`RunEntry.fell`) with each recorded map's no-death forecast, so the fall log reads how often units actually fell
 *   against how often the forecast said they would (`falls`).
 * - **Chrom's or Robin's death** is a Game Over: the save is reloaded, so it's never recorded (`GAME_OVER_UNITS`).
 */
import type { Milestone } from './milestones';
import type { RosterUnit } from './roster';
import type { Run } from './run';
import type { Plan } from './solve/plan';

export type LossKind = 'died' | 'missed' | 'married';

/** A loss recorded on a map (see the module comment): the unit (or couple, married off the plan) and the entry. */
export type RunLoss = {
  /** `dead:<unit>`, `missed:<unit>` or `married:<a>+<b>`: settled by it. */
  readonly key: string;
  readonly kind: LossKind;
  /** The unit that died or was missed; for a marriage, its first partner. */
  readonly unit: RosterUnit;
  /** An off-plan marriage's couple. */
  readonly couple?: readonly [RosterUnit, RosterUnit];
  readonly entry: string;
  readonly map: string;
};

const pairKey = (a: RosterUnit, b: RosterUnit) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/**
 * Every loss the log records after its first entry, in play order: deaths and misses, and, given the adopted plan,
 * marriages it doesn't hold.
 */
export function runLosses(run: Run, plan?: Plan): RunLoss[] {
  const out: RunLoss[] = [];
  const planned = new Set((plan?.wishlist.marriages ?? []).map(([a, b]) => pairKey(a, b)));
  run.entries.forEach((e, i) => {
    const prev = run.entries[i - 1]?.snapshot;
    if (!prev) return;
    for (const [u, st] of Object.entries(e.snapshot.states) as [RosterUnit, string][]) {
      if ((st !== 'dead' && st !== 'missed') || prev.states[u] === st) continue;
      out.push({ key: `${st}:${u}`, kind: st === 'dead' ? 'died' : 'missed', unit: u, entry: e.id, map: e.map });
    }
    if (!plan) return;
    const seen = new Set<string>();
    for (const [a, sp] of Object.entries(e.snapshot.spouses) as [RosterUnit, (typeof e.snapshot.spouses)[RosterUnit]][]) {
      if (sp?.bond !== 'married' || prev.spouses[a]?.bond === 'married') continue;
      const k = pairKey(a, sp.partner);
      if (seen.has(k) || planned.has(k)) continue;
      seen.add(k);
      const couple = [a, sp.partner].sort() as [RosterUnit, RosterUnit];
      out.push({ key: `married:${k}`, kind: 'married', unit: couple[0], couple, entry: e.id, map: e.map });
    }
  });
  // A unit whose state later changed back (an undo) is no loss.
  const last = run.entries[run.entries.length - 1]?.snapshot;
  return out.filter((l) => l.kind === 'married' || (last?.states[l.unit] === (l.kind === 'died' ? 'dead' : 'missed')));
}

/** The losses not settled yet: the adopted plan predates them. */
export function openLosses(run: Run, plan?: Plan): RunLoss[] {
  const settled = new Set(run.settledLosses ?? []);
  return runLosses(run, plan).filter((l) => !settled.has(l.key));
}

/** The run with losses settled (their loss item accepted or seen). */
export function withLossesSettled(run: Run, keys: readonly string[]): Run {
  const had = run.settledLosses ?? [];
  const more = keys.filter((k) => !had.includes(k));
  return more.length ? { ...run, settledLosses: [...had, ...more] } : run;
}

/**
 * The loss item (#208): the open losses; what they broke (the adopted plan's milestones on a lost unit, or the couple
 * married off it, and the children it no longer brings); the headline before the loss (as it stood when its map was
 * recorded); the re-solve's proposal (`lossPlan`) with what it changes: the reserves stepping in, the marriages and
 * units it adds and drops, the passes it changes. The chance after is the worker's: it re-solves from the proposal.
 */
export type LossItem = {
  readonly losses: readonly RunLoss[];
  readonly broke: readonly Milestone[];
  readonly before: { readonly chance: number; readonly margin: number } | undefined;
  readonly plan: Plan;
  readonly steppingIn: readonly { readonly unit: RosterUnit; readonly for: RosterUnit }[];
  readonly marriages: { readonly added: readonly (readonly [RosterUnit, RosterUnit])[]; readonly removed: readonly (readonly [RosterUnit, RosterUnit])[] };
  readonly units: { readonly added: readonly RosterUnit[]; readonly removed: readonly RosterUnit[] };
  readonly passes: readonly { readonly child: RosterUnit; readonly parent: RosterUnit; readonly from: string | null; readonly to: string | null }[];
  /** The proposal changes nothing in the adopted plan: seeing it settles the losses. */
  readonly same: boolean;
};

/** One recorded map in the fall log: its no-death forecast (when recorded with one), who fell (Casual) or died. */
export type FallRow = { readonly entry: string; readonly map: string; readonly noDeath: number | undefined; readonly fell: readonly RosterUnit[]; readonly died: readonly RosterUnit[] };

/**
 * The fall log (#208), for calibration: every recorded map, and over those with a no-death forecast, the falls
 * expected (the sum of each map's chance of losing someone) against the maps where someone fell or died.
 */
export type FallLog = { readonly maps: readonly FallRow[]; readonly forecast: number; readonly expected: number; readonly observed: number };

export function falls(run: Run): FallLog {
  const maps = run.entries.flatMap((e, i): FallRow[] => {
    if (e.map === 'other') return [];
    const prev = run.entries[i - 1]?.snapshot.states ?? {};
    const died = (Object.entries(e.snapshot.states) as [RosterUnit, string][]).filter(([u, st]) => st === 'dead' && prev[u] !== 'dead').map(([u]) => u);
    return [{ entry: e.id, map: e.map, noDeath: e.forecast?.map === e.map ? e.forecast.noDeath : undefined, fell: e.fell ?? [], died }];
  });
  const known = maps.filter((m) => m.noDeath !== undefined);
  return {
    maps,
    forecast: known.length,
    expected: known.reduce((a, m) => a + (1 - m.noDeath!), 0),
    observed: known.filter((m) => m.fell.length || m.died.length).length,
  };
}
