/**
 * The ceiling (#189; spec #175, The objective): the endpoint's flawless chance with every unit of today's plan at its
 * effective caps. It brackets the flawless chance from above (found ≤ best ≤ ceiling) and stands in for what grinding
 * could reach, so the solve can drop a plan whose ceiling is below the best found.
 *
 * The army at the endpoint is the one the run simulation would field there: the army today plus every recruit on the
 * way (`joining`, `later`) and the endpoint's own setups. #187's children join the same way once they're on the maps.
 * Each unit is at its full build: a base class promoted as the run simulation's promotion rule picks (the promotion
 * raising its class bases most), every stat at its effective cap (the class's max stats plus its
 * modifiers, plus 10 but HP with Limit Breaker), with its recorded skills and weapons (`kit-as-recorded`). No spread:
 * nothing is rolled, so only Lunatic+ skill draws vary between runs, on the seeds the flawless chance's runs play the
 * endpoint with.
 *
 * A map whose foes carry no weapon in the chapter data (Apotheosis: its pages list inventories the parser doesn't read)
 * can't hurt anyone in the simulation. The ceiling names such maps (`unarmed`) and has no chance when the endpoint is
 * one, rather than a 100% nothing earned.
 */
import { CLASSES, type ClassData, type ClassId } from '../../game-data/classes';
import { STATS, type Gender, type Modifiers, type Stat } from '../../game-data/stats';
import type { BlindSpotId, RunBlindSpotId } from '../assumptions';
import { classBaseStats } from '../child-join';
import { classMaxStats, className, promotionsOf } from '../classes';
import { suggestDeployment, type DeployCandidate, type Deployment } from '../deploy';
import type { RosterUnit } from '../roster';
import type { Foe } from '../solver';
import { playMap, type SimMap } from './map-play';
import { runSeed } from './random';
import type { ArmyUnit, RunSimInput } from './run-sim';
import { simLineup } from './sim-map';

/** A unit as the ceiling fields it: its class after promotion, and its stats at its effective caps. */
export type CeilingUnit = {
  readonly id: RosterUnit;
  readonly name: string;
  readonly className: string;
  readonly stats: Readonly<Record<Stat, number>>;
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
function fullClass(classId: ClassId, gender: Gender): ClassId {
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
    supports: a.supports,
    shown: { id: a.id, name: a.name, className: name, stats },
  };
}

/** Whether any foe on the map, from the start or in a wave, carries a weapon. */
const armed = (map: SimMap) => [...map.foes, ...map.waves.flatMap((w) => w.groups)].some((g) => g.foe.weapon);

/**
 * The ceiling of a plan (see the module comment): undefined when there's no map left to play. Lunatic+ plays the
 * endpoint `runs` times, run `r` on the seed the flawless chance's run `r` plays it with, so both draw the same skills;
 * the other difficulties have nothing to draw and play it once.
 */
export function simulateCeiling(input: RunSimInput, seed: number, runs: number): Ceiling | undefined {
  const last = input.maps.length - 1;
  const end = input.maps[last];
  if (!end) return undefined;
  const army = new Map<RosterUnit, ArmyUnit>();
  for (const a of [...input.army, ...input.maps.slice(0, last).flatMap((m) => [...m.joining, ...m.later]), ...end.joining, ...end.mapOnly]) if (!army.has(a.id)) army.set(a.id, a);
  const fielded = [...army.values()].map(capped);
  const pools = new Map<Foe, readonly string[]>(end.map.foes.map((g) => [g.foe, g.pool ?? []]));
  const lineup = suggestDeployment({
    candidates: fielded,
    forced: end.forced,
    max: end.deploy || fielded.length,
    foes: end.map.foes.map((g) => g.foe),
    pool: (f) => pools.get(f) ?? [],
  });
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
