/**
 * The flawless chance of a recorded run (#186): the run simulation's input built from the chapter log and the map
 * order. The army is the latest entry's living units with recorded stats (each unit's internal level walked from the
 * log, #185); every map still to play, next first, is simulated with its chapter data (`simMap`), its deploy count and
 * forced units, and its recruits joining as Record results would add them (`recruitSnapshot`). Children aren't added
 * yet: they join at paralogue entry with #187.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { MAPS, type ChapterDifficulty } from '../game-data/chapters';
import { ASSET_FLAW, ROBIN_GROWTHS, ROBIN_MODIFIERS } from '../game-data/robin';
import { MOD_STATS, STATS, type Gender, type Growths, type Modifiers } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { itemByName } from '../game-data/items';
import { CLASSES } from '../game-data/classes';
import type { DeploymentRole } from '../curated/deployment';
import { assumed, isAssumed, type Assumptions } from './assumptions';
import { deployCount, deployRoleOf, forcedOn } from './deploy';
import { COUNT_CAP, tierBonus } from './exp';
import { internalLevels } from './internal-level';
import { remainingMapOrder } from './map-order';
import { unitName, type Difficulty, type RosterUnit } from './roster';
import { EMPTY_SNAPSHOT, latestEntry, recruitSnapshot, unitNamed, type Run, type Snapshot, type UnitSnapshot } from './run';
import type { Fighter } from './solver';
import type { SimItem } from './sim/sustain';
import { classIdByName, sealAvailability, sealsHeld } from './supply';
import { simMapById } from './sim/sim-map';
import { simulateRuns, type ArmyUnit, type RunSim, type RunSimInput, type RunSimMap } from './sim/run-sim';

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/**
 * A recorded unit as a fighter: its first weapon (the one it would equip), its weapons to choose from, and the staves
 * and other items it can spend uses of on the map (#182; the simulation uses the ones that heal or Rescue).
 */
export function fighterOf(name: string, u: UnitSnapshot): { fighter: Fighter; weapons: NonNullable<Fighter['weapon']>[]; items: SimItem[] } | undefined {
  if (!u.stats) return undefined;
  const weapons = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    return item && WEAPON_KINDS.has(item.kind) ? [{ item, ...(h.forge ? { forge: { mt: h.forge.mt, hit: h.forge.hit, crit: h.forge.crit } } : {}) }] : [];
  });
  const items = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    const uses = h.uses ?? item?.uses ?? 0;
    return item && (item.kind === 'staff' || item.kind === 'item') && uses > 0 ? [{ item, uses }] : [];
  });
  return { fighter: { name, className: u.class, stats: u.stats, skills: u.skills, weapon: weapons[0] }, weapons, items };
}

/** Why a unit of the army isn't in the simulation. */
export type NotSimulated = { readonly unit: RosterUnit; readonly why: 'no-stats' | 'unknown-class' | 'child' };

export type FlawlessOptions = {
  /** Every chance is seeded: the same run, options and seed give the same chance. */
  readonly seed?: number;
  readonly runs?: number;
  /** Each unit's deployment role for the lineups (the preparation page's); by default the roster's tag, a child leads. */
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
};

export type FlawlessChance = RunSim & {
  /** Units of the army the simulation leaves out, and why. */
  readonly notSimulated: readonly NotSimulated[];
  /** Units first seen in a class they can't join in, with no count override: their Second Seal count before the log is read as 0. */
  readonly unknownHistory: readonly RosterUnit[];
  /** The map order's endpoint key; `maps` is empty once it's recorded. */
  readonly endpoint: string;
};

/**
 * The default run count. Today's plays lose a unit early on most routes, so the Full route's headline takes 0.05–0.4 s;
 * a plan whose runs all reach the endpoint would take several seconds (about 0.3 s a run), which the anytime solve's
 * Web Worker (#199) takes off the page. The ± says how far 24 runs can be trusted.
 */
export const FLAWLESS_RUNS = 24;
export const FLAWLESS_SEED = 1;

const genderOf = (run: Run, u: RosterUnit): Gender => (u === 'robin' ? (run.roster.run.gender ?? 'M') : u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].gender : FIRST_GEN_UNITS[u as UnitId].gender);

/** Robin's growths and modifiers with the run's asset and flaw. */
function robinSide(run: Run): { growths: Growths; modifiers: Modifiers } {
  const { asset, flaw } = run.roster.run;
  const a = asset ? ASSET_FLAW[asset] : undefined;
  const f = flaw ? ASSET_FLAW[flaw] : undefined;
  return {
    growths: Object.fromEntries(STATS.map((s) => [s, ROBIN_GROWTHS[s] + (a?.assetGrowth[s] ?? 0) + (f?.flawGrowth[s] ?? 0)])) as Growths,
    modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, ROBIN_MODIFIERS[s] + (a?.assetModifier[s] ?? 0) + (f?.flawModifier[s] ?? 0)])) as Modifiers,
  };
}

/** A first-gen unit's or Robin's personal growths and modifiers. */
function ownSide(run: Run, u: RosterUnit, assumptions: Assumptions): { growths: Growths; modifiers: Modifiers } | undefined {
  if (u === 'robin') return robinSide(run);
  if (u in CHILD_UNITS) return undefined;
  const d = FIRST_GEN_UNITS[u as UnitId];
  return { growths: isAssumed(d.growths) ? assumed(d.growths, assumptions) : d.growths, modifiers: d.modifiers };
}

/**
 * A unit's growths and modifiers: a child's from its recorded parents (growth floor((father + mother + own) / 3),
 * modifier father + mother + 1) when both are first-gen units or Robin, else its own growths and no modifiers.
 */
function sideOf(run: Run, snap: Snapshot, u: RosterUnit, assumptions: Assumptions): { growths: Growths; modifiers: Modifiers } {
  const own = ownSide(run, u, assumptions);
  if (own) return own;
  const child = CHILD_UNITS[u as ChildId];
  const fixed = child.fixedParent;
  const bond = snap.spouses[fixed];
  const a = ownSide(run, fixed, assumptions);
  const b = bond?.bond === 'married' ? ownSide(run, bond.partner, assumptions) : undefined;
  if (!a || !b) return { growths: child.growths, modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, 0])) as Modifiers };
  return {
    growths: Object.fromEntries(STATS.map((s) => [s, Math.floor((a.growths[s] + b.growths[s] + child.growths[s]) / 3)])) as Growths,
    modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, a.modifiers[s] + b.modifiers[s] + 1])) as Modifiers,
  };
}

/**
 * The simulation's input for a run: the army, the maps still to play and the seals held. Units the simulation can't
 * play are listed in `notSimulated`; units whose seal history is unknown in `unknownHistory`.
 */
export function flawlessInput(run: Run, assumptions: Assumptions, roleOf?: (u: RosterUnit) => DeploymentRole): { readonly input: RunSimInput; readonly notSimulated: readonly NotSimulated[]; readonly unknownHistory: readonly RosterUnit[]; readonly endpoint: string } {
  const difficulty: Difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const order = remainingMapOrder(run);
  const snap = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const role = roleOf ?? ((u: RosterUnit) => deployRoleOf(u, run.roster, new Map()));
  const alive = (u: RosterUnit) => run.roster.states[u] !== 'dead' && snap.states[u] !== 'dead';
  const levels = internalLevels(run, assumptions['class-change-internal-level']);
  const notSimulated: NotSimulated[] = [];
  const unknownHistory: RosterUnit[] = [];
  const gender = run.roster.run.gender;

  const armyUnit = (u: RosterUnit, s: UnitSnapshot, count: number, bonus: number | undefined): ArmyUnit | undefined => {
    const f = fighterOf(unitName(u, gender), s);
    const classId = classIdByName(s.class.trim());
    if (!f) return (notSimulated.push({ unit: u, why: 'no-stats' }), undefined);
    if (!classId) return (notSimulated.push({ unit: u, why: 'unknown-class' }), undefined);
    const side = sideOf(run, snap, u, assumptions);
    return {
      id: u,
      name: f.fighter.name,
      gender: genderOf(run, u),
      classId,
      level: s.level,
      exp: s.exp,
      count,
      bonus: bonus ?? tierBonus(CLASSES[classId].tier),
      stats: s.stats!,
      growths: side.growths,
      modifiers: side.modifiers,
      skills: s.skills,
      weapons: f.weapons,
      supports: s.supports,
      role: role(u),
    };
  };

  const army: ArmyUnit[] = [];
  for (const [u, s] of Object.entries(snap.units) as [RosterUnit, UnitSnapshot][]) {
    if (!alive(u)) continue;
    const il = levels.get(u);
    const count = il?.count ?? 0;
    const bonus = il?.internal !== undefined ? il.internal - s.level - Math.min(count, COUNT_CAP[difficulty]) : undefined;
    const a = armyUnit(u, s, count, bonus);
    if (!a) continue;
    army.push(a);
    if (il?.unknownHistory) unknownHistory.push(u);
  }

  // Recruits join as Record results adds them: the first time a map names them, from the snapshot before it.
  const seenUnits = new Set<RosterUnit>(Object.keys(snap.units) as RosterUnit[]);
  const cleared = new Set(run.entries.map((e) => e.map));
  const maps: RunSimMap[] = order.steps.map((step) => {
    const data = MAPS.find((m) => m.id === step.map)!;
    const joining: ArmyUnit[] = [];
    const mapOnly: ArmyUnit[] = [];
    const later: ArmyUnit[] = [];
    for (const r of data.recruits) {
      const u = r.unit === 'Morgan' ? gender && (gender === 'M' ? 'morgan-f' : 'morgan-m') : unitNamed(r.unit);
      if (!u || (u === 'robin' && !gender) || !alive(u)) continue;
      const onlyHere = r.stats !== undefined;
      if (!onlyHere && seenUnits.has(u)) continue;
      if (u in CHILD_UNITS) {
        if (!notSimulated.some((l) => l.unit === u)) notSimulated.push({ unit: u, why: 'child' });
        continue;
      }
      const a = armyUnit(u, recruitSnapshot(u, run, r, snap, assumptions), 0, undefined);
      if (!a) continue;
      if (onlyHere) mapOnly.push(a);
      else {
        seenUnits.add(u);
        (/^Automatically from turn 1\b/.test(r.how ?? '') ? joining : later).push(a);
      }
    }
    const opening = [...joining, ...mapOnly];
    const endpoint = step.key === order.endpoint.key;
    const m: RunSimMap = {
      key: step.key,
      label: `${data.label}${step.secret ? ' (secret route)' : ''}`,
      map: simMapById(step.map, difficulty, { seen: run.seen?.[step.map] ?? {}, ...(step.map === 'apotheosis' ? { route: step.secret ? 'secret' : 'normal' } : {}) }),
      deploy: endpoint ? order.endpoint.deploy : deployCount(data.conditions[table]?.deploy ?? '', opening.map((a) => a.name)),
      forced: [...forcedOn(step.map), ...opening.map((a) => a.id)],
      joining,
      mapOnly,
      later,
      masterSeals: sealAvailability(cleared).master === 'armory',
    };
    cleared.add(step.map);
    return m;
  });
  const held = sealsHeld([...snap.convoy, ...Object.values(snap.units).flatMap((u) => u?.inventory ?? [])]).master;
  return { input: { army, maps, difficulty, masterSealsHeld: held }, notSimulated, unknownHistory, endpoint: order.endpoint.key };
}

/** The flawless chance of a run from the next map to the endpoint (see `simulateRuns`). */
export function flawlessChance(run: Run, assumptions: Assumptions, options: FlawlessOptions = {}): FlawlessChance {
  const { input, notSimulated, unknownHistory, endpoint } = flawlessInput(run, assumptions, options.roleOf);
  const sim = simulateRuns(input, options.seed ?? FLAWLESS_SEED, options.runs ?? FLAWLESS_RUNS, assumptions);
  return { ...sim, notSimulated, unknownHistory, endpoint };
}

