/**
 * The re-solve a loss proposes (#208; spec #175, Record results, losses and What changed): after a recorded death, a
 * missed recruit or an off-plan marriage, the adopted plan predates what happened. The loss item's proposal is the plan
 * for the army that's left, never applied until the player accepts it:
 *
 * - **Reserves step in:** each reserve that covers a lost wishlist unit (`Wishlist.reserves`, #202) is kept in the
 *   wishlist (the caller puts a keep-in pin for it on the run, `steppingIn`).
 * - **Marriages re-solve:** the plan's couples that still can marry are kept (pinned while the seed matches the rest);
 *   a couple with a partner lost (unmarried) or married to someone else is dropped, and the recorded marriages are
 *   facts. The partners freed are matched again with everyone the plan left unmarried.
 * - **Passed skills and the roadmap re-solve:** the wishlist is rebuilt for the new couples (`rebuilt`: children, passes,
 *   the endpoint's lineup), keeping the passes of children whose parents didn't change, the map order, the other
 *   lineups, class changes and EXP priorities; a lineup, seal, priority or item use naming a lost unit is dropped (its
 *   map plays the greedy lineup).
 */
import { CHROM_FALLBACK_PARTNER } from '../../game-data/supports';
import type { Couple, RosterUnit } from '../roster';
import { isLost, latestEntry, type Run } from '../run';
import { rebuilt } from './edits';
import { isMarriagePin, type MarriagePin, type Plan, type PlanPin } from './plan';
import { seedPlan, type SeedContext, type SeedOptions } from './seed';

/** The recorded marriages on the latest entry, both ways. */
function recordedSpouses(run: Run): Map<RosterUnit, RosterUnit> {
  const out = new Map<RosterUnit, RosterUnit>();
  const spouses = latestEntry(run)?.snapshot.spouses ?? {};
  for (const [u, sp] of Object.entries(spouses) as [RosterUnit, (typeof spouses)[RosterUnit]][]) if (sp?.bond === 'married') out.set(u, sp.partner);
  return out;
}

/** Whether a unit is lost for good (dead or missed) on the run's latest entry. */
export function lostOn(run: Run): (u: RosterUnit) => boolean {
  const snap = latestEntry(run)?.snapshot;
  return (u) => !!snap && isLost(run, snap, u);
}

/** The reserves stepping in (#202's reserves): each covering a lost wishlist unit, itself neither lost nor in the wishlist. */
export function steppingIn(run: Run, plan: Plan): { readonly unit: RosterUnit; readonly for: RosterUnit }[] {
  const lost = lostOn(run);
  const inWishlist = new Set(plan.wishlist.units.map((w) => w.unit));
  const gone = new Set(plan.wishlist.units.map((w) => w.unit).filter(lost));
  const out: { unit: RosterUnit; for: RosterUnit }[] = [];
  for (const r of plan.wishlist.reserves)
    if (r.covers !== null && gone.has(r.covers) && !lost(r.unit) && !inWishlist.has(r.unit) && !out.some((x) => x.unit === r.unit || x.for === r.covers)) out.push({ unit: r.unit, for: r.covers! });
  return out;
}

/** The plan's couples that can still marry: neither partner lost unmarried, nor married to someone else. */
export function keptCouples(run: Run, plan: Plan): Couple[] {
  const lost = lostOn(run);
  const married = recordedSpouses(run);
  return plan.wishlist.marriages.filter(([a, b]) => married.get(a) === b || (!lost(a) && !lost(b) && !married.has(a) && !married.has(b)));
}

/**
 * The loss item's proposal (see the module comment) for `plan` on `run`. `run` carries the stepping-in reserves' keep-in
 * pins (and `options.pins` its live pins): the endpoint's lineup keeps them.
 */
export function lossPlan(run: Run, ctx: SeedContext, options: SeedOptions, plan: Plan): Plan {
  const lost = lostOn(run);
  const married = recordedSpouses(run);
  // The couples kept are pinned while the seed matches the rest (Chrom's wedding it decides itself).
  const kept: MarriagePin[] = keptCouples(run, plan)
    .filter((c) => !c.includes(CHROM_FALLBACK_PARTNER as RosterUnit) && married.get(c[0]) !== c[1])
    .map((c) => ({ kind: 'marriage', couple: c }));
  const has = new Set((options.pins ?? []).filter(isMarriagePin).map((p) => [...p.couple].sort().join('+')));
  const pins: PlanPin[] = [...(options.pins ?? []), ...kept.filter((p) => !has.has([...p.couple].sort().join('+')))];
  const seeded = seedPlan(run, ctx, { ...options, pins });
  const next = rebuilt(run, ctx, options, plan, seeded.robin, seeded.wishlist.marriages);
  const names = (us: readonly (RosterUnit | undefined)[]) => us.some((u) => u !== undefined && lost(u));
  return {
    ...next,
    wishlist: { ...next.wishlist, children: next.wishlist.children.filter((c) => !lost(c.child)), reserves: next.wishlist.reserves.filter((r) => !lost(r.unit) && (r.covers === null || !lost(r.covers))) },
    roadmap: {
      ...next.roadmap,
      lineups: next.roadmap.lineups.filter((l) => !names([...l.pairs.flatMap((p) => [p.lead, p.back]), ...l.solo])),
      seals: next.roadmap.seals.filter((s) => !lost(s.unit)),
      items: next.roadmap.items.filter((i) => !lost(i.unit)),
      ...(next.roadmap.priorities ? { priorities: next.roadmap.priorities.filter((p) => !lost(p.unit)) } : {}),
    },
  };
}
