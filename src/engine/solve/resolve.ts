/**
 * The re-solve after a recorded map (#206; spec #175, Milestones, the map order and readings: "After each recorded map
 * the solve runs again…"): what the inbox after the Lock reads besides the search's own proposals.
 *
 * - **A broken plan:** the adopted roadmap can no longer be met once a unit it needs is lost (dead or missed), a
 *   recorded marriage isn't one of its couples (or takes a partner it marries elsewhere), or one of its supports is a
 *   non-starter in the maps left. The re-solve's proposal is then **required** before the next map (the tool still
 *   never applies it: the player accepts it).
 * - **Milestone moves:** a proposal comes with the milestones it adds, drops or moves (its event, or a support's
 *   window), against the adopted plan's.
 * - **Behind fixes:** a behind unit's re-solve proposal is the best proposal that moves one of its milestones and
 *   leaves the wishlist as it is (roadmap-only: lineups, pairs, places, seals, priorities), then one that changes the
 *   wishlist, shown only when it beats the best roadmap-only option.
 * - **An at-risk unit's suggested change** (#195) becomes one edit: a pair or field change is a span pin over the
 *   change's maps (the unit leading with its Back, or fielded alone), an EXP priority change is a plan edit (the
 *   adopted plan's priority spans with the change's last, so it wins where they overlap).
 */
import type { SuggestedPin } from '../exp-forecast';
import type { Milestone, MilestonePoint } from '../milestones';
import type { RosterUnit } from '../roster';
import type { Run } from '../run';
import type { Plan, PlanPin, PlanPriority, PlanProposal, SpanPin } from './plan';

/** Why the adopted roadmap can no longer be met. */
export type PlanBreak =
  | { readonly kind: 'lost'; readonly unit: RosterUnit; readonly state: 'dead' | 'missed' }
  | { readonly kind: 'married'; readonly couple: readonly [RosterUnit, RosterUnit] }
  | { readonly kind: 'non-starter'; readonly milestone: string; readonly pair: readonly [RosterUnit, RosterUnit] };

const same = (c: readonly RosterUnit[], a: RosterUnit, b: RosterUnit) => c.includes(a) && c.includes(b);

/** What `plan` can no longer meet on `run` (see the module comment), given its milestones there; empty when it holds. */
export function planBreaks(run: Run, plan: Plan, ms: readonly Milestone[]): PlanBreak[] {
  const last = run.entries[run.entries.length - 1]?.snapshot;
  if (!last) return [];
  const w = plan.wishlist;
  const needed = new Set<RosterUnit>([
    ...w.units.map((u) => u.unit),
    ...w.marriages.flat(),
    ...w.children.flatMap((c) => [c.child, ...c.parents.filter((p): p is RosterUnit => p !== 'maiden')]),
  ]);
  const out: PlanBreak[] = [];
  for (const u of needed) {
    const s = last.states[u];
    if (s === 'dead' || s === 'missed') out.push({ kind: 'lost', unit: u, state: s });
  }
  const seen = new Set<string>();
  for (const [a, sp] of Object.entries(last.spouses) as [RosterUnit, (typeof last.spouses)[RosterUnit]][]) {
    if (sp?.bond !== 'married') continue;
    const b = sp.partner;
    const key = [a, b].sort().join('+');
    if (seen.has(key)) continue;
    seen.add(key);
    if (!w.marriages.some((c) => same(c, a, b))) out.push({ kind: 'married', couple: [a, b] });
  }
  for (const m of ms) if (m.kind === 'support' && m.nonStarter) out.push({ kind: 'non-starter', milestone: m.id, pair: m.pair });
  return out;
}

/** The milestones a plan adds, drops or moves against another's. */
export type MilestoneMoves = {
  readonly added: readonly Milestone[];
  readonly dropped: readonly Milestone[];
  /** Its milestone, and where it fell before (a support whose window moved keeps its event). */
  readonly moved: readonly { readonly milestone: Milestone; readonly from: MilestonePoint }[];
};

const pointKey = (p: MilestonePoint | undefined) => (p ? `${p.key}:${p.when}` : '');

/** How `after`'s milestones differ from `before`'s, by id. */
export function milestoneMoves(before: readonly Milestone[], after: readonly Milestone[]): MilestoneMoves {
  const was = new Map(before.map((m) => [m.id, m]));
  const now = new Set(after.map((m) => m.id));
  const moved = after.flatMap((m) => {
    const b = was.get(m.id);
    if (!b) return [];
    const window = m.kind === 'support' && b.kind === 'support' && (pointKey(m.window.earliest) !== pointKey(b.window.earliest) || pointKey(m.window.latest) !== pointKey(b.window.latest));
    return pointKey(m.at) !== pointKey(b.at) || window ? [{ milestone: m, from: b.at }] : [];
  });
  return { added: after.filter((m) => !was.has(m.id)), dropped: before.filter((m) => !now.has(m.id)), moved };
}

/** Whether two plans field the same wishlist: Robin, units, classes, builds, marriages, children and passes (reserves aside). */
export function sameWishlist(a: Plan, b: Plan): boolean {
  const key = (p: Plan) => JSON.stringify([p.robin, p.wishlist.endpoint, p.wishlist.units, p.wishlist.marriages, p.wishlist.children]);
  return key(a) === key(b);
}

/** A proposal and the milestones it moves. */
export type MovedProposal = { readonly proposal: PlanProposal; readonly moves: MilestoneMoves };

/**
 * A behind unit's re-solve proposals (see the module comment): the best roadmap-only proposal that moves one of its
 * milestones, then the best that changes the wishlist, only when it gains more than that one (or there is none).
 */
export function behindFixes(unit: RosterUnit, adopted: Plan, proposals: readonly MovedProposal[]): { readonly roadmap?: PlanProposal; readonly wishlist?: PlanProposal } {
  const touches = (m: MilestoneMoves) => [...m.added, ...m.dropped, ...m.moved.map((x) => x.milestone)].some((x) => x.units.includes(unit));
  const mine = proposals.filter((p) => touches(p.moves)).map((p) => p.proposal);
  const best = (ps: readonly PlanProposal[]) => ps.reduce<PlanProposal | undefined>((b, p) => (!b || p.gain > b.gain ? p : b), undefined);
  const roadmap = best(mine.filter((p) => sameWishlist(adopted, p.plan)));
  const wishlist = best(mine.filter((p) => !sameWishlist(adopted, p.plan)));
  return { ...(roadmap ? { roadmap } : {}), ...(wishlist && (!roadmap || wishlist.gain > roadmap.gain) ? { wishlist } : {}) };
}

/**
 * An at-risk unit's suggested change as one edit (see the module comment): its span pin(s), or the adopted plan with
 * the priority span added to `priorities` (the plan's own, or the default its milestones give).
 */
export function suggestedEdit(plan: Plan, pin: SuggestedPin, priorities: readonly PlanPriority[]): { readonly pins: readonly PlanPin[] } | { readonly plan: Plan } {
  const span = { from: pin.from, to: pin.to };
  switch (pin.kind) {
    case 'pair':
      return { pins: [{ kind: 'span', unit: pin.unit, position: 'lead', partner: pin.value, ...span } satisfies SpanPin] };
    case 'field':
      return { pins: [{ kind: 'span', unit: pin.unit, position: 'solo', ...span } satisfies SpanPin] };
    case 'priority':
      return { plan: { ...plan, roadmap: { ...plan.roadmap, priorities: [...priorities, { unit: pin.unit, priority: pin.value, ...span }] } } };
  }
}
