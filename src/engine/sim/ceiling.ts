/**
 * The ceiling (#189; spec #175, The objective): the endpoint's flawless chance with every unit of today's plan at its
 * effective caps. It brackets the flawless chance from above (found ≤ best ≤ ceiling) and stands in for what grinding
 * could reach, so the solve can drop a plan whose ceiling is below the best found.
 *
 * The army at the endpoint is the one the run simulation would field there: the army today plus every recruit on the
 * way (`joining`, `later`), the endpoint's own setups, and every child the plan's marriages produce on a map before
 * the endpoint (`children`, #187), in its start class with the skills it inherits from its parents' in the plan.
 * Each unit is at its full build: a base class promoted as the run simulation's promotion rule picks (the promotion
 * raising its class bases most), every stat at its effective cap (the class's max stats plus its
 * modifiers, plus 10 but HP with Limit Breaker), with its recorded skills and weapons (`kit-as-recorded`). No spread:
 * nothing is rolled, so only Lunatic+ skill draws vary between runs, on the seeds the flawless chance's runs play the
 * endpoint with.
 *
 * A map whose foes carry no weapon in the chapter data (Apotheosis's did until its lower-case item templates were
 * parsed, #189) can't hurt anyone in the simulation. The ceiling names such maps (`unarmed`) and has no chance when
 * the endpoint is one, rather than a 100% nothing earned.
 */
import { CLASSES, type ClassData, type ClassId } from '../../game-data/classes';
import { STATS, type Gender, type Modifiers, type Stat } from '../../game-data/stats';
import { CHILD_UNITS } from '../../game-data/children';
import type { SkillId } from '../../game-data/skills';
import type { Assumptions, BlindSpotId, RunBlindSpotId } from '../assumptions';
import { classBaseStats } from '../child-join';
import { childSkills, type SkillParent } from '../child-skills';
import { classMaxStats, className, promotionsOf } from '../classes';
import { suggestDeployment, type DeployCandidate, type Deployment } from '../deploy';
import type { RosterUnit } from '../roster';
import type { Foe } from '../solver';
import { playMap, type SimMap } from './map-play';
import { runSeed } from './random';
import type { ArmyUnit, ChildRecruit, RunSimInput, RunSimMap } from './run-sim';
import { simLineup } from './sim-map';

/** A unit as the ceiling fields it: its class after promotion, and its stats at its effective caps. */
export type CeilingUnit = {
  readonly id: RosterUnit;
  readonly name: string;
  readonly classId: ClassId;
  readonly className: string;
  readonly stats: Readonly<Record<Stat, number>>;
  readonly skills: readonly string[];
};

export type Ceiling = {
  /** The endpoint's key and label on the map order. */
  readonly key: string;
  readonly label: string;
  /** The endpoint's no-death chance at caps; undefined when its foes carry no weapons (see `unarmed`). */
  readonly chance: number | undefined;
  readonly runs: number;
  /** The suggested deployment of the capped army there. */
  readonly lineup: Deployment | undefined;
  readonly units: readonly CeilingUnit[];
  /** Labels of the maps ahead (the endpoint included) whose foes carry no weapons in the chapter data. */
  readonly unarmed: readonly string[];
  readonly blindSpots: readonly (BlindSpotId | RunBlindSpotId)[];
};

/** Effective caps: the class's max stats plus the unit's modifiers, plus 10 (not HP) with Limit Breaker. */
export function effectiveCaps(classId: ClassId, gender: Gender, modifiers: Modifiers, skills: readonly string[]): Record<Stat, number> {
  const max = classMaxStats(classId, gender);
  const lb = skills.includes('Limit Breaker') ? 10 : 0;
  return Object.fromEntries(STATS.map((s) => [s, s === 'hp' ? max.hp : max[s] + modifiers[s] + lb])) as Record<Stat, number>;
}

/** The class a unit ends in: a base class's promotion raising its class bases most (first listed on a tie), else its own. */
export function fullClass(classId: ClassId, gender: Gender): ClassId {
  if (CLASSES[classId].tier !== 'base') return classId;
  const from = classBaseStats(classId, gender);
  let best: { to: ClassId; total: number } | undefined;
  for (const to of promotionsOf(classId)) {
    const t = classBaseStats(to, gender);
    const lock = (CLASSES[to] as ClassData).genderLock;
    if (!from || !t || (lock && lock !== gender)) continue;
    const total = STATS.reduce((a, s) => a + Math.max(0, t[s] - from[s]), 0);
    if (!best || total > best.total) best = { to, total };
  }
  return best?.to ?? classId;
}

/** A unit at its full build, as a deployment candidate. */
function capped(a: ArmyUnit): DeployCandidate & { readonly shown: CeilingUnit } {
  const classId = fullClass(a.classId, a.gender);
  const stats = effectiveCaps(classId, a.gender, a.modifiers, a.skills);
  const name = className(classId, a.gender);
  return {
    unit: a.id,
    role: a.role,
    fighter: { name: a.name, className: name, stats, skills: a.skills, weapon: a.weapons[0] },
    weapons: a.weapons,
    ...(a.items?.length ? { items: a.items } : {}),
    supports: a.supports,
    shown: { id: a.id, name: a.name, classId, className: name, stats, skills: a.skills },
  };
}

/**
 * A child the plan produces, as the army unit its caps are read from (#187): its start class (Morgan's other parent's,
 * else its first class) and the skills it inherits from its parents' skills in the plan (`childSkills`). Its stats
 * are left at 0: the ceiling reads only its caps. Undefined when a parent isn't in the plan's army.
 */
function childUnit(c: ChildRecruit, army: ReadonlyMap<RosterUnit, ArmyUnit>, assumptions: Assumptions): ArmyUnit | undefined {
  const side = (u: RosterUnit | 'maiden', fixed: SkillId | undefined): SkillParent | undefined => {
    if (u === 'maiden') return 'maiden';
    const p = army.get(u);
    return p ? { skills: p.skills, ...(fixed ? { fixed } : {}) } : undefined;
  };
  const a = side(c.parents[0], c.fixed?.[0]);
  const b = side(c.parents[1], c.fixed?.[1]);
  const child = CHILD_UNITS[c.id];
  const classId = c.startClass ?? child.defaultClassSet[0];
  if (!a || !b || !classId) return undefined;
  const { skills } = childSkills({ child: c.id, parents: [a, b], startClass: classId, level: 10 }, assumptions);
  return {
    id: c.id,
    name: c.name,
    gender: child.gender,
    classId,
    level: 10,
    exp: 0,
    count: 0,
    bonus: 0,
    stats: Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>,
    growths: c.growths,
    modifiers: c.modifiers,
    skills,
    weapons: c.weapons,
    ...(c.items ? { items: c.items } : {}),
    supports: [],
    role: c.role,
  };
}

/** Whether any foe on the map, from the start or in a wave, carries a weapon. */
const armed = (map: SimMap) => [...map.foes, ...map.waves.flatMap((w) => w.groups)].some((g) => g.foe.weapon);

/**
 * The ceiling of a plan (see the module comment): undefined when there's no map left to play. Lunatic+ plays the
 * endpoint `runs` times, run `r` on the seed the flawless chance's run `r` plays it with, so both draw the same skills;
 * the other difficulties have nothing to draw and play it once.
 */
export function simulateCeiling(input: RunSimInput, seed: number, runs: number, assumptions: Assumptions): Ceiling | undefined {
  const last = input.maps.length - 1;
  const at = ceilingArmy(input, assumptions);
  if (!at) return undefined;
  const { end, fielded, lineup, children } = at;
  const n = input.difficulty === 'lunatic-plus' ? Math.max(1, Math.floor(runs)) : 1;
  const blindSpots = new Set<BlindSpotId | RunBlindSpotId>();
  let chance: number | undefined;
  if (armed(end.map)) {
    const play = { map: end.map, lineup: simLineup(lineup, new Map(fielded.map((c) => [c.unit, c]))) };
    let sum = 0;
    for (let r = 0; r < n; r++) {
      const p = playMap(play, runSeed(runSeed(seed, r), last));
      sum += p.noDeath;
      for (const b of p.blindSpots) blindSpots.add(b);
    }
    chance = sum / n;
  }
  blindSpots.add('kit-as-recorded');
  if (children) blindSpots.add('supports-from-pair-combats');
  return {
    key: end.key,
    label: end.label,
    chance,
    runs: n,
    lineup,
    units: fielded.map((c) => c.shown),
    unarmed: input.maps.filter((m) => !armed(m.map)).map((m) => m.label),
    blindSpots: [...blindSpots],
  };
}

/** A unit of the ceiling's army: a deployment candidate at its full build, and how the ceiling shows it. */
export type CappedUnit = DeployCandidate & { readonly shown: CeilingUnit };

/**
 * The army the ceiling fields at the endpoint (see the module comment), each unit at its full build, and its suggested
 * deployment there; undefined when there's no map left to play. The seed's wishlist (#198) is this lineup.
 */
export function ceilingArmy(
  input: RunSimInput,
  assumptions: Assumptions,
): { readonly end: RunSimMap; readonly fielded: readonly CappedUnit[]; readonly lineup: Deployment; readonly children: boolean } | undefined {
  const last = input.maps.length - 1;
  const end = input.maps[last];
  if (!end) return undefined;
  const army = new Map<RosterUnit, ArmyUnit>();
  const before = input.maps.slice(0, last);
  for (const a of [...input.army, ...before.flatMap((m) => [...m.joining, ...m.later]), ...end.joining, ...end.mapOnly]) if (!army.has(a.id)) army.set(a.id, a);
  // Children read on a map before the endpoint have joined by then; one read on the endpoint joins after it. A map lists
  // one recruit per spouse the fixed parent can have (#188): the ceiling takes the plan's (recorded or planned) couple.
  const children = planChildren(before.flatMap((m) => m.children ?? []), [...(input.married ?? []), ...(input.couples ?? [])]);
  for (const c of children) {
    const u = army.has(c.id) ? undefined : childUnit(c, army, assumptions);
    if (u) army.set(u.id, u);
  }
  const fielded = [...army.values()].map(capped);
  const pools = new Map<Foe, readonly string[]>(end.map.foes.map((g) => [g.foe, g.pool ?? []]));
  const lineup = suggestDeployment({
    candidates: fielded,
    forced: end.forced,
    max: end.deploy || fielded.length,
    foes: end.map.foes.map((g) => g.foe),
    pool: (f) => pools.get(f) ?? [],
  });
  return { end, fielded, lineup, children: children.length > 0 };
}

/** Each child once, as the recruit whose parents are a couple of the plan; otherwise its first listed recruit. */
function planChildren(recruits: readonly ChildRecruit[], couples: readonly (readonly [RosterUnit, RosterUnit | 'maiden'])[]): ChildRecruit[] {
  const wed = (a: RosterUnit, b: RosterUnit | 'maiden') => couples.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const byChild = new Map<ChildRecruit['id'], ChildRecruit>();
  for (const r of recruits) if (!byChild.has(r.id) || (wed(...r.parents) && !wed(...byChild.get(r.id)!.parents))) byChild.set(r.id, r);
  return [...byChild.values()];
}
