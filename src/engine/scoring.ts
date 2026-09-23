/**
 * Scoring: a pairing's raw value is Σ weight × stat points in a class, under a score basis; the total is min-max
 * scaled over every enumerated pairing to 0–100 (#11, revised by #15). Pure: settings in, scores out.
 */
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import type { Weights } from '../curated/presets';
import type { ChildResult, PairingScore, ScoreSettings } from './types';

/** What scoring needs from the engine, per row and per class. */
export type ScoringContext = {
  readonly results: readonly ChildResult[];
  readonly genderOf: (r: ChildResult) => Gender;
  readonly reachOf: (r: ChildResult) => ReadonlySet<ClassId>;
  readonly classMaxStats: (id: ClassId, gender: Gender) => Readonly<Record<Stat, number>>;
  readonly classGrowths: (id: ClassId, gender: Gender) => Readonly<Record<Stat, number>>;
};

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
const STR = STATS.indexOf('str');
const MAG = STATS.indexOf('mag');

/**
 * Auto candidates: promoted classes and single-tier specials, never Villager; DLC ones only when DLC is reachable.
 * In class data order, which breaks ties.
 */
function isAutoCandidate(id: ClassId, dlc: boolean): boolean {
  const c: ClassData = CLASSES[id];
  return c.tier !== 'base' && id !== 'villager' && (dlc || !c.dlc);
}

/** Raw value of per-stat values (in STATS order) under the weights; Mixed scores max(Str, Mag) at the attack weight. */
function rawValue(w: readonly number[], v: readonly number[], mixed: boolean): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    if (mixed && (i === STR || i === MAG)) continue;
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

/** Per-point weights in STATS order. Spd is linear at its to-target weight until the Spd curve lands. */
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
    const { weights, mixed, basis, classMode, dlc } = settings;
    const w = weights && weightVector(weights);
    const growthsBasis = basis === 'growths';
    const lb = basis === 'caps-lb' ? 10 : 0;

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

    type Pick = { r: ChildResult; cls: ClassId | undefined; auto: boolean; raw: number | undefined; v: number[] | undefined };
    const picks: Pick[] = [];
    for (const row of rows) {
      const { r } = row;
      if (classMode !== 'auto') {
        const v = row.reach.has(classMode) ? [...fill(row, classMode)] : undefined;
        picks.push({ r, cls: v && classMode, auto: false, raw: w && v ? rawValue(w, v, mixed) : undefined, v });
        continue;
      }
      if (!w) {
        picks.push({ r, cls: r.startClass, auto: false, raw: undefined, v: [...fill(row, r.startClass)] });
        continue;
      }
      let best: ClassId | undefined;
      let bestRaw = -Infinity;
      for (const id of candidatesOf(row.reach)) {
        const raw = rawValue(w, fill(row, id), mixed);
        if (raw > bestRaw) {
          best = id;
          bestRaw = raw;
        }
      }
      picks.push({ r, cls: best, auto: true, raw: best && bestRaw, v: best && [...fill(row, best)] });
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
    for (const { r, cls, auto, raw, v } of picks) {
      const scaled = raw === undefined ? undefined : scale(raw);
      out.set(r.key, {
        key: r.key,
        class: cls,
        auto,
        values: v && toRecord(v),
        raw,
        scaled,
        score: scaled === undefined ? undefined : Math.round(scaled),
        attack: mixed && raw !== undefined && v ? (v[STR]! >= v[MAG]! ? 'S' : 'M') : undefined,
      });
    }
    return out;
  };
}
