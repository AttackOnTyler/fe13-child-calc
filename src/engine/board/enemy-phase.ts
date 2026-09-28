/**
 * The enemy phase on a board (#263; research #254): who wakes, where each enemy moves and whom it attacks, in order.
 *
 * - **Waking** (§2): an `Everytime` unit acts from enemy phase 1; `AttackRange` once a player unit is inside its reach
 *   (Mov + weapon range over the terrain, player units blocking) at the start of an enemy phase; `Turn(n)` from turn n;
 *   `TurnAttackRange(n)` either way (OR); `BandRange` when two members of its band have a player unit in reach (plausible,
 *   not confirmed). One member waking wakes its whole band (group). A `Null` or flag-waited unit stays put (event flags
 *   aren't modelled). Once awake, a unit stays awake.
 * - **Movement:** the terrain's cost for its class, player units blocking, its own side passable; a can't-move unit
 *   (Garrick) attacks only what its weapon reaches from its tile.
 * - **Targeting** (§4, folklore): a swappable rule, so corrections can score it. The default takes a kill when it has one
 *   (the surest), else the most damage after hit chance, preferring no counter; it never declines an attack it dies to.
 *   A paired back can't be targeted. Its tile: one the target can't counter from, then the best terrain, then the
 *   shortest walk.
 * - **Order:** the dispos order, except that an enemy that can kill someone goes first (folklore).
 * - An enemy that can reach no one walks toward the nearest player unit (`AI_MV_NearestEnemy`).
 *
 * Each attack's result is predicted with the likeliest reading (a strike at 50% or more lands; no crits), and the next
 * enemy acts on that board. Not modelled: healers and staves, Dual Guard and Dual Strike rolls in the prediction,
 * reinforcements, event flags, AI missions (villages, chests), Person-only attackers.
 */
import { exchange } from '../sim/exchange';
import { NEIGHBOURS, keyTile, manhattan, moveCost, moveRow, sameTile, tileBonus, tileKey, type Tile } from './captured';
import {
  forecast,
  leads,
  liveEnemies,
  movement,
  playFight,
  reaches,
  strikeOrder,
  threatTiles,
  weaponOf,
  withEnemy,
  withPieces,
  withPlayer,
  type Board,
  type EnemyPiece,
  type Landing,
  type PlayerPiece,
} from './board';
import type { Matchup } from '../solver';

/** One way an enemy can attack a player lead: from which tile, and the fight's numbers. */
export type AttackOption = {
  readonly enemy: EnemyPiece;
  readonly target: PlayerPiece;
  readonly tile: Tile;
  readonly range: number;
  /** The fight from the target's side (its matchup against this enemy, on their tiles). */
  readonly m: Matchup;
  /** Whether the target counters from there. */
  readonly countered: boolean;
  /** Whether every non-crit strike landing kills the target, and the chance it dies (Dual Guard and Dual Strike rolled). */
  readonly lethal: boolean;
  readonly killChance: number;
  /** Expected damage to the target, crits aside. */
  readonly expected: number;
};

/** Picks an enemy's attack among its options (one per target, at its best tile); undefined declines. */
export type Targeting = (options: readonly AttackOption[]) => AttackOption | undefined;

/** Folklore targeting (research #254 §4): the surest kill, else the most expected damage, preferring no counter. */
export const folkloreTargeting: Targeting = (options) => {
  let best: AttackOption | undefined;
  let bestKey = -Infinity;
  for (const o of options) {
    const key = (o.killChance > 0 ? 1e6 + o.killChance * 1e5 : 0) + o.expected * 10 + (o.countered ? 0 : 5);
    if (key > bestKey) [best, bestKey] = [o, key];
  }
  return best;
};

/** One enemy's action in the phase: where it ends, whom it attacks, and the predicted HP after. */
export type EnemyAction = {
  readonly enemy: string;
  readonly from: Tile;
  readonly to: Tile;
  readonly target?: string;
  readonly range?: number;
  /** The fight's predicted result (the likeliest reading), when it attacks. */
  readonly result?: { readonly targetHp: number; readonly enemyHp: number };
  readonly lethal?: boolean;
  readonly killChance?: number;
};

const turnParam = (p: string | undefined) => {
  const n = parseInt((p ?? '').split(',')[0]!, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Whether a player lead stands inside an enemy's reach (its Mov + weapon range, or its weapon alone when it can't move). */
export function inReach(b: Board, e: EnemyPiece): boolean {
  const t = threatTiles(b, e);
  return leads(b).some((p) => t.has(tileKey(p.at)));
}

/**
 * The start-of-enemy-phase wake checks (research #254 §2): each sleeping enemy whose trigger fires wakes, and so does
 * its band. Returns the board with the new awake set, and who woke.
 */
export function wake(b: Board): { board: Board; woke: string[] } {
  const live = liveEnemies(b);
  const reach = new Map<string, boolean>();
  const near = (e: EnemyPiece) => reach.get(e.id) ?? (reach.set(e.id, inReach(b, e)), reach.get(e.id)!);
  const bandNear = (e: EnemyPiece) => e.group !== 0 && live.filter((x) => x.group === e.group && near(x)).length >= 2;
  const fires = (e: EnemyPiece): boolean => {
    const s = e.ai.start ?? 'Everytime';
    const n = turnParam(e.ai.startParam);
    switch (s) {
      case 'Everytime':
        return true;
      case 'AttackRange':
      case 'AttackRangeExcludePerson':
      case 'FlagTrueAttackRange':
      case 'FlagTrueAttackRangeExcludePerson':
        return near(e);
      case 'Turn':
        return n !== undefined && b.turn >= n;
      case 'TurnAttackRange':
      case 'TurnAttackRangeHealRange':
        return (n !== undefined && b.turn >= n) || near(e);
      case 'BandRange':
        return bandNear(e);
      case 'TurnBandRange':
        return (n !== undefined && b.turn >= n) || bandNear(e);
      default:
        return false;
    }
  };
  const woke = new Set(live.filter((e) => !e.awake && fires(e)).map((e) => e.id));
  // A band wakes together.
  const bands = new Set(live.filter((e) => (woke.has(e.id) || e.awake) && e.group !== 0).map((e) => e.group));
  for (const e of live) if (!e.awake && e.group !== 0 && bands.has(e.group) && e.ai.start !== 'Null') woke.add(e.id);
  if (!woke.size) return { board: b, woke: [] };
  return { board: withPieces(b, b.players, b.enemies.map((e) => (woke.has(e.id) ? { ...e, awake: true } : e))), woke: [...woke] };
}

/** Every attack an enemy can make this phase, one per target at its best tile (see the module comment). */
export function attackOptions(b: Board, e: EnemyPiece): AttackOption[] {
  if (e.ai.attack === 'Null') return [];
  const w = weaponOf(e);
  const from = e.stationary ? new Map([[tileKey(e.at), 0]]) : movement(b, e);
  const out: AttackOption[] = [];
  for (const target of leads(b)) {
    let best: { tile: Tile; spent: number; range: number; countered: boolean; bonus: number } | undefined;
    for (const [k, spent] of from) {
      const tile = keyTile(k);
      const d = manhattan(tile, target.at);
      if (!reaches(w, d)) continue;
      const countered = reaches(target.fighter.weapon?.item, d);
      const tb = tileBonus(b.map, tile);
      const bonus = tb.avo + tb.def * 10;
      const better = !best || (best.countered && !countered) || (best.countered === countered && (bonus > best.bonus || (bonus === best.bonus && spent < best.spent)));
      if (better) best = { tile, spent, range: d, countered, bonus };
    }
    if (!best) continue;
    const m = forecast(b, target, e, target.at, best.tile);
    const strikes = strikeOrder(m, 'enemy', best.countered, true).filter((s) => s === 'enemy').length;
    const lethal = m.worstHit * strikes >= target.hp;
    const killChance = lethal ? 1 - exchange(best.countered ? m : { ...m, hits: 0 }, best.countered ? target.fighter.weapon?.item : undefined, target.hp, e.hp, 'enemy').survive : 0;
    out.push({ enemy: e, target, tile: best.tile, range: best.range, m, countered: best.countered, lethal, killChance, expected: (m.worstHit * strikes * m.foeHit) / 100 });
  }
  return out;
}

/**
 * The tile an enemy with no one to attack walks to: the reachable tile nearest (by its walking cost) to a tile from
 * which it could strike a player lead; it stays when none is nearer.
 */
export function approachTile(b: Board, e: EnemyPiece): Tile {
  if (e.stationary || e.ai.move === 'Null') return e.at;
  const row = moveRow(e.foe.className);
  const blocked = new Set(leads(b).map((p) => tileKey(p.at)));
  const w = weaponOf(e);
  // Goals: enterable tiles from which the weapon reaches a player lead (a melee foe: adjacent tiles).
  const dist = new Map<number, number>();
  const queue: [number, number][] = [];
  for (let y = 0; y < b.map.height; y++)
    for (let x = 0; x < b.map.width; x++) {
      const k = tileKey([x, y]);
      if (blocked.has(k) || moveCost(b.map, [x, y], row) === null) continue;
      if (leads(b).some((p) => reaches(w, manhattan([x, y], p.at)) || (!w && manhattan([x, y], p.at) === 1))) {
        dist.set(k, 0);
        queue.push([k, 0]);
      }
    }
  // Walking back from the goals: stepping from u into v costs v's terrain.
  while (queue.length) {
    queue.sort((a, c) => a[1] - c[1]);
    const [k, d] = queue.shift()!;
    if (d > (dist.get(k) ?? Infinity)) continue;
    const v = keyTile(k);
    const enter = moveCost(b.map, v, row)!;
    for (const [dx, dy] of NEIGHBOURS) {
      const u: Tile = [v[0] + dx, v[1] + dy];
      const uk = tileKey(u);
      if (blocked.has(uk) || moveCost(b.map, u, row) === null) continue;
      if (d + enter < (dist.get(uk) ?? Infinity)) {
        dist.set(uk, d + enter);
        queue.push([uk, d + enter]);
      }
    }
  }
  let best = e.at;
  let bestD = dist.get(tileKey(e.at)) ?? Infinity;
  for (const [k] of movement(b, e)) {
    const d = dist.get(k) ?? Infinity;
    if (d < bestD) [best, bestD] = [keyTile(k), d];
  }
  return best;
}

/** One enemy acting on the board: its action and the board after (the likeliest reading unless `landing` says). */
export function act(b: Board, e: EnemyPiece, targeting: Targeting = folkloreTargeting, landing: { player: Landing; enemy: Landing } = LIKELY): { action: EnemyAction; board: Board } {
  const pick = targeting(attackOptions(b, e));
  if (!pick) {
    const to = approachTile(b, e);
    return { action: { enemy: e.id, from: e.at, to }, board: sameTile(to, e.at) ? b : withEnemy(b, { ...e, at: to }) };
  }
  const order = strikeOrder(pick.m, 'enemy', pick.countered, true);
  const r = playFight(pick.m, order, pick.target.hp, e.hp, landing.player, landing.enemy);
  let next = withEnemy(b, { ...e, at: pick.tile, hp: r.enemyHp });
  next = withPlayer(next, { ...pick.target, hp: r.playerHp });
  // A lead that falls drops its back on its tile (the back survives, unpaired).
  if (r.playerHp <= 0 && pick.target.back) {
    const back = next.players.find((p) => p.id === pick.target.back)!;
    const { back: _, ...lead } = next.players.find((p) => p.id === pick.target.id)!;
    const { carriedBy: __, ...freed } = back;
    next = withPlayer(withPlayer(next, lead as PlayerPiece), { ...freed, at: pick.target.at } as PlayerPiece);
  }
  return {
    action: { enemy: e.id, from: e.at, to: pick.tile, target: pick.target.id, range: pick.range, result: { targetHp: r.playerHp, enemyHp: r.enemyHp }, lethal: pick.lethal, killChance: pick.killChance },
    board: next,
  };
}
const LIKELY = { player: 'likely', enemy: 'likely' } as const;

/**
 * The enemy phase: the wake checks, then each awake enemy acts in turn (one that can kill first, else the dispos
 * order) on the board the ones before it left. Returns the actions in order and the board after, turn unchanged.
 */
export function enemyPhase(b: Board, targeting: Targeting = folkloreTargeting): { actions: EnemyAction[]; board: Board; woke: string[] } {
  const w = wake(b);
  let board = w.board;
  const actions: EnemyAction[] = [];
  const done = new Set<string>();
  for (;;) {
    const ready = liveEnemies(board)
      .filter((e) => e.awake && !done.has(e.id))
      .sort((a, c) => a.order - c.order);
    if (!ready.length) break;
    const killer = ready.find((e) => {
      const pick = targeting(attackOptions(board, e));
      return !!pick && pick.killChance > 0;
    });
    const e = killer ?? ready[0]!;
    done.add(e.id);
    const r = act(board, e, targeting);
    actions.push(r.action);
    board = r.board;
  }
  return { actions, board: withPieces(board, board.players, board.enemies), woke: w.woke };
}
