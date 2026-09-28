/**
 * Can the held-back units stay out of reach? (#248). The run-level play assumes a unit it holds back is out of every
 * foe's reach (`held-back-out-of-reach`); on a captured map that can be checked per turn: each held-back unit needs a
 * tile it can get to that no living enemy can strike (a sleeping one counts: standing in its reach wakes it), and the
 * units need different tiles. A back its lead separates can only be set down next to a tile the lead can reach.
 */
import { NEIGHBOURS, keyTile, moveCost, moveRow, tileKey } from './captured';
import { leads, liveEnemies, movement, occupant, playerById, threatTiles, type Board } from './board';

export type HoldBack = {
  /** Every held-back unit has a tile out of reach, all different. */
  readonly feasible: boolean;
  /** Units with no tile out of reach at all. */
  readonly stuck: readonly string[];
  /** A formation that works, by unit, when there is one. */
  readonly tiles: Readonly<Record<string, readonly [number, number]>>;
  /** The enemies whose reach covers the stuck units' tiles. */
  readonly threats: readonly string[];
};

/** Whether `holders` (unit ids: leads, or backs to be separated) can all stand out of reach on this board. */
export function holdBack(b: Board, holders: readonly string[]): HoldBack {
  const enemies = liveEnemies(b);
  const reach = new Map(enemies.map((e) => [e.id, threatTiles(b, e)]));
  const covered = new Set<number>();
  for (const r of reach.values()) for (const k of r) covered.add(k);
  const candidates = new Map<string, number[]>();
  for (const id of holders) {
    const u = playerById(b, id);
    if (!u) continue;
    let tiles: number[];
    if (u.carriedBy) {
      // Separated from its lead: set down next to a tile the lead reaches (the lead's action).
      const lead = playerById(b, u.carriedBy)!;
      const row = moveRow(u.fighter.className);
      const out = new Set<number>();
      for (const k of movement(b, lead).keys()) {
        const t = keyTile(k);
        for (const [dx, dy] of NEIGHBOURS) {
          const n: [number, number] = [t[0] + dx, t[1] + dy];
          if (moveCost(b.map, n, row) !== null && !occupant(b, n)) out.add(tileKey(n));
        }
      }
      tiles = [...out];
    } else tiles = [...movement(b, u).keys()];
    candidates.set(id, tiles.filter((k) => !covered.has(k)));
  }
  const stuck = holders.filter((id) => !(candidates.get(id)?.length ?? 0));
  // Different tiles for all: a small backtracking search, the fewest choices first.
  const order = [...candidates.keys()].sort((a, c) => candidates.get(a)!.length - candidates.get(c)!.length);
  const used = new Set<number>(leads(b).filter((p) => !holders.includes(p.id)).map((p) => tileKey(p.at)));
  const chosen: Record<string, readonly [number, number]> = {};
  const place = (i: number): boolean => {
    if (i === order.length) return true;
    const id = order[i]!;
    for (const k of candidates.get(id)!) {
      if (used.has(k)) continue;
      used.add(k);
      chosen[id] = keyTile(k);
      if (place(i + 1)) return true;
      used.delete(k);
    }
    return false;
  };
  const feasible = !stuck.length && place(0);
  const threats = new Set<string>();
  for (const id of stuck.length ? stuck : feasible ? [] : holders) {
    const u = playerById(b, id);
    if (!u) continue;
    const own = u.carriedBy ? movement(b, playerById(b, u.carriedBy)!) : movement(b, u);
    for (const e of enemies) if ([...own.keys()].some((k) => reach.get(e.id)!.has(k))) threats.add(e.id);
  }
  return { feasible, stuck, tiles: feasible ? chosen : {}, threats: [...threats] };
}
