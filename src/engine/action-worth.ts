/**
 * What each preparation checklist action is worth (spec #175 story 59: "what it's worth in flawless points"): the
 * flawless chance the plan loses by not doing it, the cost of the edit that removes it from the plan. Each action the
 * preparation page lists (#207) that the plan makes has one removal, keyed by the page's own action id:
 *
 * - **Pair up** (`pair:<lead>`): the pair fights apart on this map (its Back fielded alone, a one-map span pin).
 * - **Field** (`field:<unit>`): the unit sits this map out (a one-map span pin); a forced unit has none.
 * - **An item use** (`item:<n>`, the n-th of the map's "before this map" list): the plan without that use.
 * - **Equip a skill** (a skill milestone's id): the build without it, or the pass not made.
 * - **A class change** (a class milestone's id; its seal's buy or pick-up read the same): the plan without that change.
 * - **Chase a side goal** (`goal:<id>`): the goal skipped (under a skip pin, so a pin to chase it can't hide it).
 *
 * Shopping lines, talks and recruiting a child aren't the plan's choices to drop: they have none. The Web Worker costs
 * them one by one (`actionWorthStep`, background.ts); the page shows each as it lands.
 */
import type { BeforeMapItem } from './item-plan';
import type { Milestone } from './milestones';
import type { RosterUnit } from './roster';
import type { SideGoalId } from './side-goals';
import { mapSpanPin, type Plan, type PlanLineup } from './solve/plan';
import type { UnitEdit } from './solve/step';

/** What an action's removal needs from the plan on this map. */
export type ActionContext = {
  /** The map's key on the order. */
  readonly key: string;
  /** The map's lineup as the plan plays it (named or greedy); absent when no run plays it. */
  readonly lineup: PlanLineup | undefined;
  /** Units the map fields whatever the plan says. */
  readonly forced: readonly RosterUnit[];
  /** The map has no preparation phase: nothing is set up before it. */
  readonly noPrep: boolean;
  /** Its "before this map" item list, in the page's order. */
  readonly before: readonly BeforeMapItem[];
  readonly milestones: readonly Milestone[];
  /** The side goals chased on it. */
  readonly chased: readonly SideGoalId[];
};

/** The removal of each checklist action the plan makes on a map, keyed by the preparation page's action id. */
export function actionEdits(plan: Plan, c: ActionContext): UnitEdit[] {
  const out: UnitEdit[] = [];
  const add = (key: string, kind: UnitEdit['kind'], label: string, make: () => Plan, play: UnitEdit['play'] = []) => out.push({ kind, key, label, pins: [], play, make });
  const same = () => plan;
  if (!c.noPrep && c.lineup) {
    for (const p of c.lineup.pairs) {
      if (p.back) add(`pair:${p.lead}`, 'pair', `${p.lead} and ${p.back} fight apart`, same, [mapSpanPin(p.back, 'solo', c.key)]);
      else if (!c.forced.includes(p.lead)) add(`field:${p.lead}`, 'lineup', `${p.lead} sits out`, same, [mapSpanPin(p.lead, 'out', c.key)]);
    }
    for (const u of c.lineup.solo) if (!c.forced.includes(u)) add(`field:${u}`, 'lineup', `${u} sits out`, same, [mapSpanPin(u, 'out', c.key)]);
  }
  if (!c.noPrep)
    c.before.forEach((b, i) => {
      const items = plan.roadmap.items.filter((p) => !(p.key === c.key && p.item === b.item && p.unit === b.unit));
      if (items.length < plan.roadmap.items.length) add(`item:${i}`, 'item', `no ${b.item} for ${b.unit}`, () => ({ ...plan, roadmap: { ...plan.roadmap, items } }));
    });
  for (const m of c.milestones) {
    if (m.kind === 'skill' && m.at.key === c.key && !m.wasted) {
      if (m.for.kind === 'build') {
        const unit = m.unit;
        add(m.id, 'build', `${unit} without ${m.name}`, () => ({ ...plan, wishlist: { ...plan.wishlist, units: plan.wishlist.units.map((w) => (w.unit === unit ? { ...w, build: w.build.filter((s) => s !== m.skill) } : w)) } }));
      } else {
        const child = m.for.child;
        add(m.id, 'pass', `${m.unit} passes nothing to ${child}`, () => ({
          ...plan,
          wishlist: { ...plan.wishlist, children: plan.wishlist.children.map((x) => (x.child === child ? { ...x, passes: x.passes.map((p) => (p === m.skill ? null : p)) as unknown as typeof x.passes } : x)) },
        }));
      }
    }
    if (m.kind === 'class' && (m.at.key === c.key || ('at' in m.source && m.source.at?.key === c.key))) {
      const seals = plan.roadmap.seals.filter((s) => !(s.unit === m.unit && s.classId === m.classId));
      if (seals.length < plan.roadmap.seals.length) add(m.id, 'seal', `${m.unit} stays out of ${m.className}`, () => ({ ...plan, roadmap: { ...plan.roadmap, seals } }));
    }
  }
  for (const id of c.chased) add(`goal:${id}`, 'side-goal', `skip ${id}`, () => ({ ...plan, roadmap: { ...plan.roadmap, sideGoals: { ...plan.roadmap.sideGoals, [id]: 'skip' } } }), [{ kind: 'side-goal', goal: id, decision: 'skip' }]);
  return out;
}
