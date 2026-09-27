/**
 * The simulation's seeded random numbers (#181; spec #175, Noise): every facade call that simulates takes a seed, and
 * the same inputs and seed give the same result. Mulberry32: small, fast and good enough for sampling level-ups, the
 * EXP split, gold and Lunatic+ skill draws. Never use `Math.random` in the engine.
 */
export type Rng = {
  /** A number in [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  /** `k` distinct items of `items`, in draw order. */
  sample<T>(items: readonly T[], k: number): T[];
  /** A new stream derived from this one's next draw, for a sub-simulation that mustn't shift this one's draws. */
  fork(): Rng;
};

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    sample: (items, k) => {
      const pool = [...items];
      const out: (typeof pool)[number][] = [];
      while (out.length < k && pool.length) out.push(pool.splice(int(pool.length), 1)[0]!);
      return out;
    },
    fork: () => createRng(Math.floor(next() * 4294967296)),
  };
}

/** The seed of the `i`th of several runs from one seed: each run gets its own stream. */
export const runSeed = (seed: number, i: number): number => (Math.imul(seed >>> 0, 0x9e3779b1) + Math.imul(i + 1, 0x85ebca6b)) >>> 0;
