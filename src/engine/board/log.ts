/**
 * The position plan's board as the run records it (#266): the turn-1 board of the map from the run's lineup, then every
 * input the player gives on the Prepare page, replayed in order — each action played (with its tapped outcome), each
 * enemy phase as confirmed or fixed, a unit put where it really stands, an HP set by hand, an enemy's rolled skills.
 * The board is never stored, only these events, so the same run always gives the same board.
 */
import type { ChapterDifficulty } from '../../game-data/chapters';
import type { RosterUnit } from '../roster';
import type { DeployCandidate } from '../deploy';
import { capturedMap, sameTile, type Tile } from './captured';
import { boardFromMap, classMov, enemyById, playerById, withEnemy, withPieces, withPlayer, type Board, type PlayerPiece } from './board';
import { wake, type EnemyAction } from './enemy-phase';
import { applyAction, switched, type AttackOutcome, type PlannedAction } from './solve';

export type PositionEvent =
  | { readonly kind: 'act'; readonly action: PlannedAction; readonly outcome?: AttackOutcome }
  /** An enemy phase as it went: the predicted one confirmed, or with fixes. Ends the turn. */
  | { readonly kind: 'enemy'; readonly actions: readonly EnemyAction[] }
  | { readonly kind: 'place'; readonly unit: string; readonly to: Tile }
  | { readonly kind: 'hp'; readonly unit: string; readonly hp: number }
  | { readonly kind: 'skills'; readonly enemy: string; readonly skills: readonly string[] };

/** The board after the events, and the units that have acted this turn. */
export function replay(start: Board, events: readonly PositionEvent[]): { readonly board: Board; readonly acted: readonly string[] } {
  let b = start;
  let acted: string[] = [];
  for (const e of events) {
    switch (e.kind) {
      case 'act': {
        // The pair as it acts (after a switch): its back has acted too, even when the action drops it (a Separate).
        const before = e.action.switched ? switched(b, e.action.unit) : b;
        const back = playerById(before, e.action.unit)?.back;
        b = applyAction(b, e.action, e.outcome);
        acted = [...acted, e.action.unit, ...(back ? [back] : [])];
        break;
      }
      case 'enemy': {
        b = wake(b).board;
        for (const a of e.actions) {
          const foe = enemyById(b, a.enemy);
          if (!foe) continue;
          b = withEnemy(b, { ...foe, at: a.to, ...(a.result ? { hp: a.result.enemyHp } : {}), awake: true });
          const t = a.target ? playerById(b, a.target) : undefined;
          if (t && a.result) b = withPlayer(b, { ...t, hp: a.result.targetHp });
        }
        b = { ...b, turn: b.turn + 1 };
        acted = [];
        break;
      }
      case 'place': {
        const u = playerById(b, e.unit);
        if (u && !u.carriedBy) {
          b = withPlayer(b, { ...u, at: e.to });
          if (u.back) b = withPlayer(b, { ...playerById(b, u.back)!, at: e.to });
        }
        const f = enemyById(b, e.unit);
        if (f) b = withEnemy(b, { ...f, at: e.to });
        break;
      }
      case 'hp': {
        const u = playerById(b, e.unit);
        if (u) b = withPlayer(b, { ...u, hp: e.hp });
        const f = enemyById(b, e.unit);
        if (f) b = withEnemy(b, { ...f, hp: e.hp });
        break;
      }
      case 'skills': {
        const f = enemyById(b, e.enemy);
        if (f) b = withEnemy(b, { ...f, foe: { ...f.foe, skills: e.skills } });
        break;
      }
    }
  }
  return { board: b, acted: [...new Set(acted)] };
}

/** Robin's placement: the player names Robin, so the ROM's person is the player's own. */
const isRobin = (pid: string) => pid.startsWith('PID_プレイヤー');

/**
 * The turn-1 board of a captured map from the run's lineup (units as the Prepare page builds them): each unit on its
 * named placement (Chrom on Chrom's), the rest on the deployment slots in order, all unpaired (the solver pairs them).
 * Undefined when the map isn't captured or no unit has a tile.
 */
export function lineupBoard(
  mapId: string,
  difficulty: ChapterDifficulty | 'lunatic-plus',
  units: readonly DeployCandidate[],
  name: (u: RosterUnit) => string,
): Board | undefined {
  const map = capturedMap(mapId);
  if (!map) return undefined;
  const slots = map.spawns.filter((s) => s.faction === 'Player' && s.team === 'player');
  const taken = new Set<number>();
  const tileOf = (u: DeployCandidate): Tile | undefined => {
    const i = slots.findIndex((s, j) => !taken.has(j) && (u.unit === 'robin' ? isRobin(s.pid) : s.name === name(u.unit)));
    if (i >= 0) {
      taken.add(i);
      return slots[i]!.to;
    }
    return undefined;
  };
  const placed = units.map((u) => [u, tileOf(u)] as const);
  const pieces: PlayerPiece[] = placed.flatMap(([u, at]) => {
    let tile = at;
    if (!tile) {
      const j = slots.findIndex((s, k) => !taken.has(k) && (s.deploySlot || (!s.name && !isRobin(s.pid))));
      if (j < 0) return [];
      taken.add(j);
      tile = slots[j]!.to;
    }
    return [
      {
        id: u.unit,
        name: name(u.unit),
        fighter: u.fighter,
        weapons: u.weapons,
        items: (u.items ?? []).map((i) => ({ item: i.item.name, uses: i.uses })),
        hp: u.fighter.stats.hp,
        at: tile,
        supports: Object.fromEntries(u.supports.map((s) => [s.partner, s.rank])),
        mov: classMov(u.fighter.className),
      },
    ];
  });
  if (!pieces.length) return undefined;
  // Two units on one tile (a map listing fewer tiles than the lineup) can't both stand: the later waits off the map.
  const ok = pieces.filter((p, i) => !pieces.slice(0, i).some((q) => sameTile(q.at, p.at)));
  const b = boardFromMap(mapId, difficulty, ok);
  return b && withPieces(b, ok);
}
