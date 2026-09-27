/**
 * The flawless chance of today's plan across the map order (#186; spec #175, The objective, Noise, and EXP, supports
 * and internal level; ADR 0001). Every map from the next one to the endpoint is played (`playMap`) by the plan's lineup
 * for it; what changes the route between maps is sampled: each unit's EXP from its combats (`combatExp` at its internal
 * level), and its level-ups one at a time from its growths (personal plus class), clamped at its effective caps. Each
 * simulated run carries the product of its maps' no-death chances; the flawless chance is their mean, with its
 * simulation error (±, 95%).
 *
 * The plan: each map's lineup is today's suggested deployment (`suggestDeployment`, as the preparation page picks it)
 * over the army as a projection with average growths would have it on that map. It is chosen once and every run plays
 * it, so runs differ only by their rolls, as edits compared on the same runs need.
 *
 * Cost: a run stops at the map where it has lost a unit (its chance of nobody lost falls below `LOST`), and the plan's
 * lineups are worked out only as far as some run gets, so a plan that fails early is cheap. A run that plays every map
 * of the Full route costs about 0.3 s, and the plan's projection about 0.8 s (the anytime solve's worker, #199, takes
 * that off the page).
 *
 * Each run's state is a `RunState`, walked map by map: `beforeMap` (joins, promotions), the play, then `afterMap` (EXP
 * and level-ups, later recruits). Later tickets extend the same walk:
 * - #187: a child joins at paralogue entry in `beforeMap`, its join stats from its parents' stats in this run's state
 *   (`childJoinStats` over `state.army`), as another `RunSimMap.joining`-like list keyed by the child's paralogue.
 * - #188: support points per pair per map from `play.units[id].together`, kept on `state.supports` in `afterMap`.
 * - #190: gold and held items per run on `state.gold`, Bullion in `afterMap`, the shopping list in `beforeMap`.
 * - #194 replaces the promotion rule below (`PROMOTION_RULE`) with the roadmap's class-reached milestones.
 */
import { CLASSES, type ClassData, type ClassId, type ClassTier } from '../../game-data/classes';
import { STATS, type Gender, type Growths, type Modifiers, type Stat } from '../../game-data/stats';
import type { DeploymentRole } from '../../curated/deployment';
import type { Assumptions, BlindSpotId, RunBlindSpotId } from '../assumptions';
import { classBaseStats } from '../child-join';
import { classGrowths, classMaxStats, className, promotionsOf } from '../classes';
import { suggestDeployment, type DeployCandidate, type Deployment } from '../deploy';
import { COUNT_CAP, combatExp, expFoeOf, type ExpFoe } from '../exp';
import type { Difficulty, RosterUnit } from '../roster';
import type { Fighter, Foe, SupportLevel } from '../solver';
import { playMap, type MapPlay, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit } from './map-play';
import { createRng, runSeed, type Rng } from './random';

export type Weapon = NonNullable<Fighter['weapon']>;

/**
 * A unit as it enters the simulation: its recorded state (or its join data, for a recruit), and what its growths and
 * caps are read from.
 */
export type ArmyUnit = {
  readonly id: RosterUnit;
  readonly name: string;
  readonly gender: Gender;
  readonly classId: ClassId;
  readonly level: number;
  readonly exp: number;
  /** The Second Seal count its internal level adds (uncapped: the difficulty's cap applies when EXP is worked out). */
  readonly count: number;
  /** The internal level's tier bonus: 20 in an advanced class under the research's reading. */
  readonly bonus: number;
  readonly stats: Readonly<Record<Stat, number>>;
  /** Personal growths (the class's are added from the class data). */
  readonly growths: Growths;
  /** Max-stat modifiers, for its effective caps. */
  readonly modifiers: Modifiers;
  readonly skills: readonly string[];
  readonly weapons: readonly Weapon[];
  readonly supports: readonly { readonly partner: RosterUnit; readonly rank: SupportLevel }[];
  readonly role: DeploymentRole;
};

/** One map of the map order, as a run plays it. */
export type RunSimMap = {
  /** Unique on the order (`apotheosis-secret` for the secret route). */
  readonly key: string;
  readonly label: string;
  readonly map: SimMap;
  /** How many units it deploys. */
  readonly deploy: number;
  /** Units always fielded (Chrom on most story maps, the map's opening recruits). */
  readonly forced: readonly RosterUnit[];
  /** Recruits on the map from its start: they join the army and are fielded here. */
  readonly joining: readonly ArmyUnit[];
  /** A setup fielded only on this map (Premonition's): it never joins the army. */
  readonly mapOnly: readonly ArmyUnit[];
  /** Recruits who come later in the map (a talk, a later turn): in the army from the next map. */
  readonly later: readonly ArmyUnit[];
  /** Whether Master Seals are sold in an armory by this map's preparations (a merchant's aren't counted on). */
  readonly masterSeals: boolean;
};

export type RunSimInput = {
  readonly army: readonly ArmyUnit[];
  readonly maps: readonly RunSimMap[];
  readonly difficulty: Difficulty;
  /** Master Seals held at the start (convoy and inventories). */
  readonly masterSealsHeld?: number;
};

/** A stat's spread over the runs at the endpoint: 10th percentile, median, 90th, and the effective cap. */
export type StatSpread = { readonly low: number; readonly median: number; readonly high: number; readonly cap: number };

/** A unit's expected stats entering the endpoint: its likeliest class and a spread over the runs. */
export type UnitForecast = {
  readonly id: RosterUnit;
  readonly name: string;
  /** The class it's in, in most runs. */
  readonly className: string;
  readonly level: StatSpread;
  readonly exp: number;
  readonly stats: Readonly<Record<Stat, StatSpread>>;
};

export type RunSimMapResult = {
  readonly key: string;
  readonly label: string;
  /** The chance of reaching it with nobody lost: the flawless chance through the map before. */
  readonly reach: number;
  /**
   * The map's no-death chance for the runs that reach it with nobody lost (each run weighted by its chance of getting
   * there); undefined when none does.
   */
  readonly noDeath: number | undefined;
  /** The plan's lineup for it; undefined past the maps any run reached with nobody lost (never worked out). */
  readonly lineup: Deployment | undefined;
  /** The expected turns, weighted the same way; undefined when no run reaches it. */
  readonly turns: number | undefined;
};

export type RunSim = {
  /** The flawless chance: the mean over runs of each run's product of no-death chances. */
  readonly chance: number;
  /** Its simulation error: 1.96 standard errors (95%). */
  readonly margin: number;
  readonly runs: number;
  /** Each run's flawless chance, in run order, for paired comparisons on the same runs. */
  readonly samples: readonly number[];
  readonly maps: readonly RunSimMapResult[];
  /**
   * Expected stats entering the endpoint (the last map), for the units in the army there, over the runs that reach it
   * with nobody lost; empty when none does.
   */
  readonly units: readonly UnitForecast[];
  /** The stated blind spots it rests on: the map simulation's, then the run simulation's own. */
  readonly blindSpots: readonly (BlindSpotId | RunBlindSpotId)[];
};

/**
 * The promotion rule until the roadmap plans class changes (#194): a unit in a base class at its level cap is
 * promoted with a Master Seal in the next map's preparations, when one is held or an armory sells them by then, to the
 * promotion that raises its class bases most. A stated blind spot (`promotes-at-cap`).
 */
export const PROMOTION_RULE = { level: 20 } as const;

/** The run simulation's own blind spots (see BLIND_SPOTS): what it simplifies between maps. */
const RUN_BLIND_SPOTS: readonly RunBlindSpotId[] = ['promotes-at-cap', 'lead-takes-exp', 'no-new-children', 'kit-as-recorded'];

/** Special classes (Dancer, Villager, Taguel, Manakete, the DLC classes) level to 30; base and advanced to 20. */
export const levelCap = (tier: ClassTier): number => (tier === 'special' ? 30 : 20);

/** A unit in one run: where it stands now. Stats are fractional in the plan's projection (average growths). */
type Live = {
  readonly base: ArmyUnit;
  classId: ClassId;
  tier: ClassTier;
  level: number;
  exp: number;
  count: number;
  bonus: number;
  readonly stats: Record<Stat, number>;
};

/** One run's state, walked map by map. Later tickets add supports (#188) and gold and items (#190) here. */
export type RunState = {
  readonly army: Map<RosterUnit, Live>;
  masterSealsHeld: number;
};

/** Class growths by class and gender, per set of assumptions (Conqueror's are assumed). */
const CLASS_GROWTHS = new WeakMap<Assumptions, Map<string, Growths>>();
function totalGrowth(u: Live, assumptions: Assumptions, s: Stat): number {
  let byClass = CLASS_GROWTHS.get(assumptions);
  if (!byClass) CLASS_GROWTHS.set(assumptions, (byClass = new Map()));
  const k = `${u.classId}|${u.base.gender}`;
  let g = byClass.get(k);
  if (!g) byClass.set(k, (g = classGrowths(u.classId, u.base.gender, assumptions)));
  return u.base.growths[s] + g[s];
}

/** Effective caps: the class's max stats plus the unit's modifiers, plus 10 (not HP) with Limit Breaker equipped. */
function capsOf(u: Live): Record<Stat, number> {
  const max = classMaxStats(u.classId, u.base.gender);
  const lb = u.base.skills.includes('Limit Breaker') ? 10 : 0;
  const out = {} as Record<Stat, number>;
  for (const s of STATS) out[s] = s === 'hp' ? max.hp : max[s] + u.base.modifiers[s] + lb;
  return out;
}

const liveOf = (a: ArmyUnit): Live => ({ base: a, classId: a.classId, tier: CLASSES[a.classId].tier, level: a.level, exp: a.exp, count: a.count, bonus: a.bonus, stats: { ...a.stats } });

/** One level-up: each stat grows by 1 on its growth's roll (or by the growth's fraction in the projection), up to its cap. */
function levelUp(u: Live, rng: Rng | null, assumptions: Assumptions) {
  u.level++;
  const caps = capsOf(u);
  for (const s of STATS) {
    if (u.stats[s] >= caps[s]) continue;
    const g = Math.max(0, Math.min(100, totalGrowth(u, assumptions, s)));
    u.stats[s] = Math.min(caps[s], u.stats[s] + (rng ? (rng.next() * 100 < g ? 1 : 0) : g / 100));
  }
}

/** EXP earned: level-ups one at a time; at the level cap the rest is lost. */
function gainExp(u: Live, exp: number, rng: Rng | null, assumptions: Assumptions) {
  const cap = levelCap(u.tier);
  if (u.level >= cap) return void (u.exp = 0);
  u.exp += exp;
  while (u.exp >= 100 && u.level < cap) {
    u.exp -= 100;
    levelUp(u, rng, assumptions);
  }
  if (u.level >= cap) u.exp = 0;
}

/** The promotion that raises its class bases most (first listed on a tie), with the gains. */
function promotionOf(u: Live): { to: ClassId; gains: Record<Stat, number> } | undefined {
  const from = classBaseStats(u.classId, u.base.gender);
  let best: { to: ClassId; gains: Record<Stat, number>; total: number } | undefined;
  for (const to of promotionsOf(u.classId)) {
    const t = classBaseStats(to, u.base.gender);
    const lock = (CLASSES[to] as ClassData).genderLock;
    if (!from || !t || (lock && lock !== u.base.gender)) continue;
    const gains = Object.fromEntries(STATS.map((s) => [s, Math.max(0, t[s] - from[s])])) as Record<Stat, number>;
    const total = STATS.reduce((a, s) => a + gains[s], 0);
    if (!best || total > best.total) best = { to, gains, total };
  }
  return best;
}

/** The promotion rule (`PROMOTION_RULE`), in a map's preparations. */
function promote(state: RunState, step: RunSimMap, reading: Assumptions['class-change-internal-level']) {
  for (const u of state.army.values()) {
    if (u.tier !== 'base' || u.level < PROMOTION_RULE.level) continue;
    if (!step.masterSeals && state.masterSealsHeld <= 0) continue;
    const p = promotionOf(u);
    if (!p) continue;
    if (!step.masterSeals) state.masterSealsHeld--;
    const levelAtUse = u.level;
    u.classId = p.to;
    u.tier = CLASSES[p.to].tier;
    u.level = 1;
    u.exp = 0;
    // Research: a Master Seal only adds the advanced tier's +20. +1 per class change: the level at use carries on.
    if (reading === 'plus-one') u.count += levelAtUse;
    else u.bonus = 20;
    const caps = capsOf(u);
    for (const s of STATS) u.stats[s] = Math.min(Math.max(caps[s], u.stats[s]), u.stats[s] + p.gains[s]);
  }
}

const internalOf = (u: Live, difficulty: Difficulty) => u.level + u.bonus + Math.min(u.count, COUNT_CAP[difficulty]);

/** Rounded stats as the combat math reads them. */
const shownStats = (u: Live): Record<Stat, number> => Object.fromEntries(STATS.map((s) => [s, Math.floor(u.stats[s] + 1e-9)])) as Record<Stat, number>;

const fighterOf = (u: Live, stats: Record<Stat, number>): Fighter => ({
  name: u.base.name,
  className: className(u.classId, u.base.gender),
  stats,
  skills: u.base.skills,
  weapon: u.base.weapons[0],
});

/** Each foe group's EXP foe on a map, by key (undefined for a class the EXP data doesn't know: it gives none). */
const EXP_FOES = new WeakMap<SimMap, Map<string, ExpFoe | undefined>>();
function expFoes(map: SimMap): Map<string, ExpFoe | undefined> {
  let m = EXP_FOES.get(map);
  if (!m) {
    m = new Map();
    const groups: SimFoeGroup[] = [...map.foes, ...map.waves.flatMap((w) => w.groups)];
    for (const g of groups) m.set(g.key, expFoeOf(g.foe.className, g.foe.level ?? 1, g.foe.boss));
    EXP_FOES.set(map, m);
  }
  return m;
}

/**
 * The EXP each fight gives, in the play's order, landing on the lead (a kill, or damage when the foe lived). A back's
 * Dual Strike EXP isn't counted (#195 splits EXP), nor the Lunatic cut for a foe's repeat engagements.
 */
function earn(state: RunState, map: SimMap, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions) {
  const foes = expFoes(map);
  const lunatic = difficulty === 'lunatic' || difficulty === 'lunatic-plus';
  for (const turn of play.log) {
    for (const f of turn.fights) {
      const u = state.army.get(f.lead as RosterUnit);
      const foe = foes.get(f.foe);
      if (!u || !foe) continue;
      const veteran = u.base.skills.includes('Veteran') ? 1.5 : 1;
      gainExp(u, combatExp(internalOf(u, difficulty), foe, f.kill ? 'kill' : 'damage', false, lunatic, 1, veteran), rng, assumptions);
    }
  }
}

/** Interned lineup objects: the same unit and stats (and the same pair) is the same object across runs, so the map simulation's combat caches hit. */
type Interner = { readonly units: Map<string, SimUnit>; readonly keys: Map<SimUnit, string>; readonly groups: Map<string, SimGroup> };

const newInterner = (): Interner => ({ units: new Map(), keys: new Map(), groups: new Map() });

function lineupOf(state: RunState, d: Deployment, extra: ReadonlyMap<RosterUnit, Live>, interner: Interner): SimGroup[] {
  const unit = (id: RosterUnit): SimUnit | undefined => {
    const u = state.army.get(id) ?? extra.get(id);
    if (!u) return undefined;
    const stats = shownStats(u);
    const key = `${id}|${u.classId}|${STATS.map((s) => stats[s]).join(',')}`;
    let su = interner.units.get(key);
    if (!su) {
      interner.units.set(key, (su = { id, fighter: fighterOf(u, stats), weapons: u.base.weapons }));
      interner.keys.set(su, key);
    }
    return su;
  };
  const group = (lead: SimUnit, back: SimUnit | undefined, support: SupportLevel | null): SimGroup => {
    const k = `${interner.keys.get(lead)}#${back ? interner.keys.get(back) : ''}#${support ?? ''}`;
    let g = interner.groups.get(k);
    if (!g) interner.groups.set(k, (g = { lead, ...(back ? { back } : {}), support: back ? support : null }));
    return g;
  };
  const out: SimGroup[] = [];
  for (const p of d.pairs) {
    const lead = unit(p.lead);
    const back = p.back ? unit(p.back) : undefined;
    if (lead) out.push(group(lead, back, p.support));
    else if (back) out.push(group(back, undefined, null));
  }
  for (const id of d.solo) {
    const s = unit(id);
    if (s) out.push(group(s, undefined, null));
  }
  return out;
}

/** The units a map can field: the army, its opening recruits and its own setups. */
function candidatesOf(state: RunState, extra: ReadonlyMap<RosterUnit, Live>): DeployCandidate[] {
  return [...state.army.values(), ...extra.values()].map((u) => ({ unit: u.base.id, role: u.base.role, fighter: fighterOf(u, shownStats(u)), weapons: u.base.weapons, supports: u.base.supports }));
}

/** A map's preparations: its opening recruits join (and its own setups are fielded), then promotions. */
function beforeMap(state: RunState, step: RunSimMap, reading: Assumptions['class-change-internal-level']): Map<RosterUnit, Live> {
  for (const a of step.joining) if (!state.army.has(a.id)) state.army.set(a.id, liveOf(a));
  promote(state, step, reading);
  return new Map(step.mapOnly.map((a) => [a.id, liveOf(a)]));
}

/** After a map: EXP and level-ups from its fights, then the recruits who came during it. */
function afterMap(state: RunState, step: RunSimMap, play: MapPlay, rng: Rng | null, difficulty: Difficulty, assumptions: Assumptions) {
  earn(state, step.map, play, rng, difficulty, assumptions);
  for (const a of step.later) if (!state.army.has(a.id)) state.army.set(a.id, liveOf(a));
}

const newState = (input: RunSimInput): RunState => ({ army: new Map(input.army.map((a) => [a.id, liveOf(a)])), masterSealsHeld: input.masterSealsHeld ?? 0 });

/**
 * The plan's lineups: the map order walked with average growths (no rolls), each map's lineup the suggested deployment
 * over the army as that projection has it there. Lunatic+ skills are drawn from `seed`. Walked only as far as asked
 * (`lineup(i)`), so maps no run reaches cost nothing.
 */
function planner(input: RunSimInput, seed: number, assumptions: Assumptions): (i: number) => Deployment {
  const reading = assumptions['class-change-internal-level'];
  const state = newState(input);
  const interner = newInterner();
  const done: Deployment[] = [];
  return (i) => {
    while (done.length <= i) {
      const k = done.length;
      const step = input.maps[k]!;
      const extra = beforeMap(state, step, reading);
      const pools = new Map<Foe, readonly string[]>(step.map.foes.map((g) => [g.foe, g.pool ?? []]));
      const d = suggestDeployment({
        candidates: candidatesOf(state, extra),
        forced: step.forced,
        max: step.deploy || state.army.size + extra.size,
        foes: step.map.foes.map((g) => g.foe),
        pool: (f) => pools.get(f) ?? [],
      });
      const play = playMap({ map: step.map, lineup: lineupOf(state, d, extra, interner) }, runSeed(seed, k));
      afterMap(state, step, play, null, input.difficulty, assumptions);
      done.push(d);
    }
    return done[i]!;
  };
}

/** The plan's lineup for every map (see `planner`). */
export function planLineups(input: RunSimInput, seed: number, assumptions: Assumptions): Deployment[] {
  const lineup = planner(input, seed, assumptions);
  return input.maps.map((_, i) => lineup(i));
}

/**
 * A run whose chance of having lost nobody falls below this has lost a unit: it stops there (its later maps would
 * move the flawless chance by less than this), which keeps runs that fail early cheap.
 */
const LOST = 1e-9;

type Endpoint = Map<RosterUnit, { name: string; classes: Map<string, { runs: number; caps: Record<Stat, number>; levelCap: number }>; level: number[]; exp: number[]; stats: Record<Stat, number[]> }>;

/** One run's army entering the endpoint, for the expected stats' spread. */
function recordEndpoint(atEnd: Endpoint, state: RunState) {
  for (const u of state.army.values()) {
    let e = atEnd.get(u.base.id);
    if (!e) atEnd.set(u.base.id, (e = { name: u.base.name, classes: new Map(), level: [], exp: [], stats: Object.fromEntries(STATS.map((s) => [s, []])) as unknown as Record<Stat, number[]> }));
    const cls = className(u.classId, u.base.gender);
    const c = e.classes.get(cls);
    e.classes.set(cls, { runs: (c?.runs ?? 0) + 1, caps: c?.caps ?? capsOf(u), levelCap: levelCap(u.tier) });
    e.level.push(u.level);
    e.exp.push(u.exp);
    for (const s of STATS) e.stats[s].push(u.stats[s]);
  }
}

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

/**
 * The flawless chance over `runs` simulated runs from `seed` (see the module comment). The same input, seed and run
 * count give the same result; more runs narrow the margin.
 */
export function simulateRuns(input: RunSimInput, seed: number, runs: number, assumptions: Assumptions): RunSim {
  const n = Math.max(1, Math.floor(runs));
  const plan = planner(input, seed, assumptions);
  const lineups: (Deployment | undefined)[] = input.maps.map(() => undefined);
  const reading = assumptions['class-change-internal-level'];
  const interner = newInterner();
  const samples: number[] = [];
  const reach = input.maps.map(() => 0);
  const noDeath = input.maps.map(() => 0);
  const turns = input.maps.map(() => 0);
  const atEnd: Endpoint = new Map();
  const spots = new Set<BlindSpotId>();
  const last = input.maps.length - 1;
  for (let r = 0; r < n; r++) {
    const rs = runSeed(seed, r);
    const rng = createRng(rs);
    const state = newState(input);
    let flawless = 1;
    for (let i = 0; i <= last; i++) {
      // A run that has lost a unit adds nothing more to the chance, the maps' chances or the endpoint's stats.
      if (flawless < LOST) break;
      const step = input.maps[i]!;
      const extra = beforeMap(state, step, reading);
      if (i === last) recordEndpoint(atEnd, state);
      const play = playMap({ map: step.map, lineup: lineupOf(state, (lineups[i] ??= plan(i)), extra, interner) }, runSeed(rs, i));
      reach[i]! += flawless;
      noDeath[i]! += flawless * play.noDeath;
      turns[i]! += flawless * play.turns;
      flawless *= play.noDeath;
      for (const b of play.blindSpots) spots.add(b);
      afterMap(state, step, play, rng, input.difficulty, assumptions);
    }
    samples.push(flawless < LOST ? 0 : flawless);
  }
  const chance = samples.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? samples.reduce((a, b) => a + (b - chance) ** 2, 0) / (n - 1) : 0;
  const spread = (xs: number[], cap: number): StatSpread => {
    const sorted = [...xs].sort((a, b) => a - b);
    return { low: quantile(sorted, 0.1), median: quantile(sorted, 0.5), high: quantile(sorted, 0.9), cap };
  };
  return {
    chance,
    margin: 1.96 * Math.sqrt(variance / n),
    runs: n,
    samples,
    blindSpots: [...spots, ...RUN_BLIND_SPOTS],
    maps: input.maps.map((m, i) => ({
      key: m.key,
      label: m.label,
      reach: reach[i]! / n,
      noDeath: reach[i]! > 0 ? noDeath[i]! / reach[i]! : undefined,
      lineup: lineups[i],
      turns: reach[i]! > 0 ? turns[i]! / reach[i]! : undefined,
    })),
    units: [...atEnd.entries()].map(([id, e]) => {
      const [cls, { caps, levelCap: top }] = [...e.classes.entries()].sort((a, b) => b[1].runs - a[1].runs)[0]!;
      return {
        id,
        name: e.name,
        className: cls,
        level: spread(e.level, top),
        exp: spread(e.exp, 100).median,
        stats: Object.fromEntries(STATS.map((s) => [s, spread(e.stats[s], caps[s])])) as Record<Stat, StatSpread>,
      };
    }),
  };
}
