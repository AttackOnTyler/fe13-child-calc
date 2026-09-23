/**
 * Scoring: a pairing's raw value is Σ weight × stat points in a class, under a score basis; the total is min-max
 * scaled over every enumerated pairing to 0–100 (#11, revised by #15). Spd scores through the Spd curve around the
 * target breakpoint. Pure: settings in, scores out.
 */
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import type { Weights } from '../curated/presets';
import { readSpeed, speedBuffs, spdCurve } from './speed';
import type { ChildResult, PairingScore, ScoreSettings, SpeedReading } from './types';

/** What scoring needs from the engine, per row and per class. */
export type ScoringContext = {
  readonly results: readonly ChildResult[];
  readonly genderOf: (r: ChildResult) => Gender;
  readonly reachOf: (r: ChildResult) => ReadonlySet<ClassId>;
  readonly classMaxStats: (id: ClassId, gender: Gender) => Readonly<Record<Stat, number>>;
  readonly classGrowths: (id: ClassId, gender: Gender) => Readonly<Record<Stat, number>>;
  /** Ascending Speed breakpoints. */
  readonly breakpoints: readonly number[];
};

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const STR = STATS.indexOf('str');
const MAG = STATS.indexOf('mag');
const SPD = STATS.indexOf('spd');

/**
 * Auto candidates: promoted classes and single-tier specials, never Villager; DLC ones only when DLC is reachable.
 * In class data order, which breaks ties.
 */
function isAutoCandidate(id: ClassId, dlc: boolean): boolean {
  const c: ClassData = CLASSES[id];
  return c.tier !== 'base' && id !== 'villager' && (dlc || !c.dlc);
}

/**
 * Raw value of per-stat values (in STATS order) under the weights; Mixed scores max(Str, Mag) at the attack weight.
 * Spd is left out: the caller adds its curve term.
 */
function rawValue(w: readonly number[], v: readonly number[], mixed: boolean): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    if (i === SPD || (mixed && (i === STR || i === MAG))) continue;
    sum += w[i]! * v[i]!;
  }
  if (mixed) sum += Math.max(w[STR]!, w[MAG]!) * Math.max(v[STR]!, v[MAG]!);
  return sum;
}

const toRecord = (v: readonly number[]): Record<Stat, number> => {
  const out = {} as Record<Stat, number>;
  STATS.forEach((s, i) => (out[s] = v[i]!));
  return out;
};

/** Per-point weights in STATS order; Spd's is the to-target weight (the curve adds `spdBeyond`). */
const weightVector = (w: Weights): number[] => STATS.map((s) => w[s]);

/** A row's scoring inputs as vectors in STATS order, prepared once per engine. */
type PreparedRow = {
  readonly r: ChildResult;
  readonly gender: Gender;
  readonly reach: ReadonlySet<ClassId>;
  /** Max-stat modifiers, with 0 for HP. */
  readonly mods: readonly number[];
  readonly growths: readonly number[];
};

/** Prepares every row once; the returned function rescores them all for a set of settings. */
export function createScorer(ctx: ScoringContext): (settings: ScoreSettings) => Map<string, PairingScore> {
  const rows: PreparedRow[] = ctx.results.map((r) => ({
    r,
    gender: ctx.genderOf(r),
    reach: ctx.reachOf(r),
    mods: STATS.map((s) => (s === 'hp' ? 0 : r.modifiers[s])),
    growths: STATS.map((s) => r.growths[s]),
  }));
  const maxCache = new Map<string, readonly number[]>();
  const growthCache = new Map<string, readonly number[]>();
  const vector = (cache: Map<string, readonly number[]>, block: (id: ClassId, g: Gender) => Readonly<Record<Stat, number>>) =>
    (id: ClassId, g: Gender): readonly number[] => {
      const k = `${id}:${g}`;
      let v = cache.get(k);
      if (!v) {
        const b = block(id, g);
        cache.set(k, (v = STATS.map((s) => b[s])));
      }
      return v;
    };
  const maxOf = vector(maxCache, ctx.classMaxStats);
  const growthOf = vector(growthCache, ctx.classGrowths);
  const candidateCache = new Map<string, Map<ReadonlySet<ClassId>, ClassId[]>>();

  return (settings) => {
    const { weights, mixed, basis, classMode, dlc, speed } = settings;
    const w = weights && weightVector(weights);
    const growthsBasis = basis === 'growths';
    const lb = basis === 'caps-lb' ? 10 : 0;
    // The Speed total uses Limit Breaker unless the basis is Caps (Growths reads Caps + LB).
    const speedLb = basis === 'caps' ? 0 : 10;
    const buffs = speedBuffs(speed);

    // Auto candidates per reach set (rows share reach sets).
    let byReach = candidateCache.get(String(dlc));
    if (!byReach) candidateCache.set(String(dlc), (byReach = new Map()));
    const candidatesOf = (reach: ReadonlySet<ClassId>): ClassId[] => {
      let c = byReach.get(reach);
      if (!c) byReach.set(reach, (c = CLASS_IDS.filter((id) => reach.has(id) && isAutoCandidate(id, dlc))));
      return c;
    };

    const values = new Array<number>(STATS.length);
    /** Fills `values` with the row's stats in a class under the basis: effective caps, or growth in class. */
    const fill = (row: PreparedRow, id: ClassId): number[] => {
      if (growthsBasis) {
        const b = growthOf(id, row.gender);
        for (let i = 0; i < values.length; i++) values[i] = b[i]! + row.growths[i]!;
      } else {
        const b = maxOf(id, row.gender);
        values[0] = b[0]!; // HP: no modifier, no Limit Breaker
        for (let i = 1; i < values.length; i++) values[i] = b[i]! + row.mods[i]! + lb;
      }
      return values;
    };
    /** Spd effective cap in the class + buffs. */
    const speedTotal = (row: PreparedRow, id: ClassId): number => maxOf(id, row.gender)[SPD]! + row.mods[SPD]! + speedLb + buffs;
    /** Raw value of the values `fill` just wrote, with Spd through the curve. */
    const score = (w: readonly number[], row: PreparedRow, id: ClassId, v: readonly number[]): number =>
      rawValue(w, v, mixed) +
      spdCurve(speedTotal(row, id), w[SPD]!, weights!.spdBeyond, speed, growthsBasis ? v[SPD] : undefined);

    type Pick = {
      r: ChildResult;
      cls: ClassId | undefined;
      auto: boolean;
      raw: number | undefined;
      v: number[] | undefined;
      spd: SpeedReading | undefined;
    };
    const picks: Pick[] = [];
    const pick = (row: PreparedRow, cls: ClassId | undefined, auto: boolean, raw: number | undefined): Pick => ({
      r: row.r,
      cls,
      auto,
      raw,
      v: cls && [...fill(row, cls)],
      spd: cls && readSpeed(speedTotal(row, cls), ctx.breakpoints),
    });
    for (const row of rows) {
      if (classMode !== 'auto') {
        const cls = row.reach.has(classMode) ? classMode : undefined;
        picks.push(pick(row, cls, false, w && cls ? score(w, row, cls, fill(row, cls)) : undefined));
        continue;
      }
      if (!w) {
        picks.push(pick(row, row.r.startClass, false, undefined));
        continue;
      }
      let best: ClassId | undefined;
      let bestRaw = -Infinity;
      for (const id of candidatesOf(row.reach)) {
        const raw = score(w, row, id, fill(row, id));
        if (raw > bestRaw) {
          best = id;
          bestRaw = raw;
        }
      }
      picks.push(pick(row, best, true, best && bestRaw));
    }

    let lo = Infinity;
    let hi = -Infinity;
    for (const p of picks) {
      if (p.raw === undefined) continue;
      if (p.raw < lo) lo = p.raw;
      if (p.raw > hi) hi = p.raw;
    }
    const scale = (raw: number) => (hi > lo ? ((raw - lo) / (hi - lo)) * 100 : 0);

    const out = new Map<string, PairingScore>();
    for (const { r, cls, auto, raw, v, spd } of picks) {
      const scaled = raw === undefined ? undefined : scale(raw);
      out.set(r.key, {
        key: r.key,
        class: cls,
        auto,
        values: v && toRecord(v),
        speed: spd,
        raw,
        scaled,
        score: scaled === undefined ? undefined : Math.round(scaled),
        attack: mixed && raw !== undefined && v ? (v[STR]! >= v[MAG]! ? 'S' : 'M') : undefined,
      });
    }
    return out;
  };
}
