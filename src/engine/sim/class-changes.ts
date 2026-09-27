/**
 * The class changes a roadmap plans (#194; spec #175, Milestones): each a unit, the class it reaches, the seal it uses
 * and the map it's needed by (`PlanSeal`). They are the roadmap's **class-reached milestones**, and the run simulation
 * plays them (`simulateRuns`): a planned change is used in the preparations after the unit reaches its level cap, or
 * before the map that needs the class, whichever comes first, once the unit is Lv 10 or more and a seal is held or
 * sold there (blind spot `class-change-at-cap`).
 *
 * `plannedSeals` is the seed's class plan: every unit the roadmap has (the army, its recruits and the plan's children)
 * reaches the class its wishlist entry fights the endpoint in, by the endpoint; a unit off the wishlist, or whose
 * wishlist class one Master Seal doesn't reach, takes the promotion that raises its class bases most (`fullClass`).
 */
import { CHILD_UNITS } from '../../game-data/children';
import { CLASSES, type ClassData, type ClassId } from '../../game-data/classes';
import type { Gender, Stat } from '../../game-data/stats';
import { STATS } from '../../game-data/stats';
import { classBaseStats } from '../child-join';
import { promotionsOf } from '../classes';
import type { RosterUnit } from '../roster';
import type { PlanSeal } from '../solve/plan';
import { fullClass } from './ceiling';
import type { RunSimInput } from './run-sim';

/** The lowest level a Master or Second Seal can be used at. */
export const SEAL_LEVEL = 10;

/** Every unit the input fields at some point, with the class it enters the roadmap in: the army, its recruits, the children. */
function unitsOf(input: RunSimInput): { readonly id: RosterUnit; readonly classId: ClassId; readonly gender: Gender }[] {
  const out = new Map<RosterUnit, { id: RosterUnit; classId: ClassId; gender: Gender }>();
  for (const a of [...input.army, ...input.maps.flatMap((m) => [...m.joining, ...m.later])]) if (!out.has(a.id)) out.set(a.id, { id: a.id, classId: a.classId, gender: a.gender });
  for (const c of input.maps.flatMap((m) => m.children ?? [])) {
    const child = CHILD_UNITS[c.id];
    const classId = c.startClass ?? child.defaultClassSet[0];
    if (classId && !out.has(c.id)) out.set(c.id, { id: c.id, classId, gender: child.gender });
  }
  return [...out.values()];
}

/**
 * The seed's class changes (see the module comment): a unit in a base class is promoted with a Master Seal (to its
 * wishlist class when that's one of its promotions); a unit already advanced whose wishlist class is another advanced
 * class reclasses with a Second Seal. Each is needed by `key` (the endpoint's by default).
 */
export function plannedSeals(input: RunSimInput, target: (u: RosterUnit) => ClassId | undefined = () => undefined, key = input.maps[input.maps.length - 1]?.key ?? ''): PlanSeal[] {
  const out: PlanSeal[] = [];
  for (const u of unitsOf(input)) {
    const want = target(u.id);
    const tier = CLASSES[u.classId].tier;
    if (tier === 'base') {
      const to = want && promotionsOf(u.classId).includes(want) ? want : fullClass(u.classId, u.gender);
      if (to !== u.classId) out.push({ unit: u.id, classId: to, seal: 'master', key });
    } else if (tier === 'advanced' && want && want !== u.classId && CLASSES[want].tier === 'advanced') out.push({ unit: u.id, classId: want, seal: 'second', key });
  }
  return out;
}

/**
 * What a class change does to a unit's stats: the difference in class bases (a promotion's never lowers a stat, a
 * reclass's can), before the new class's caps. Undefined when either class has no published bases.
 */
export function classChangeGains(from: ClassId, to: ClassId, gender: Gender, seal: PlanSeal['seal']): Record<Stat, number> | undefined {
  const a = classBaseStats(from, gender);
  const b = classBaseStats(to, gender);
  if (!a || !b) return undefined;
  return Object.fromEntries(STATS.map((s) => [s, seal === 'master' ? Math.max(0, b[s] - a[s]) : b[s] - a[s]])) as Record<Stat, number>;
}

/** Whether a seal can take a class to another: a Master Seal to one of its promotions, a Second Seal to any other class the gender allows. */
export function sealReaches(from: ClassId, to: ClassId, gender: Gender, seal: PlanSeal['seal']): boolean {
  const lock = (CLASSES[to] as ClassData).genderLock;
  if (from === to || (lock && lock !== gender)) return false;
  return seal === 'master' ? CLASSES[from].tier === 'base' && promotionsOf(from).includes(to) : true;
}
