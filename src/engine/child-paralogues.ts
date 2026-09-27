/**
 * The child paralogue gates (#152; research/child-recruitment §1, C9): Chapter 13 cleared, the fixed parent married,
 * and the map's location reachable. Pure over which maps are cleared and who is married, so the chapter log and a
 * simulated run evaluate them the same way.
 */
import { CHILD_PARALOGUES, CHILD_PARALOGUES_AFTER } from '../game-data/child-paralogues';
import type { RosterUnit } from './roster';

export type ParalogueGateState = {
  /** Maps played. */
  readonly cleared: ReadonlySet<string>;
  /** Units married (a pin doesn't count). */
  readonly married: ReadonlySet<RosterUnit>;
};

/** A child paralogue's gates: open (Chapter 13 cleared and the parent married, or already played), and reachable. */
export type ChildParalogueGate = { readonly map: string; readonly open: boolean; readonly reachable: boolean; readonly playable: boolean };

export const isChildParalogue = (map: string): boolean => map in CHILD_PARALOGUES;

/**
 * Every child paralogue's gates in map order. `playable`: open, reachable and not yet played. A paralogue played
 * before its marriage was recorded still counts as open, for the maps reached through it.
 */
export function childParalogueGates(state: ParalogueGateState): ChildParalogueGate[] {
  const opened = (map: string) => {
    const p = CHILD_PARALOGUES[map];
    return !!p && (state.cleared.has(map) || (state.cleared.has(CHILD_PARALOGUES_AFTER) && state.married.has(p.parent)));
  };
  // A route names story chapters (cleared) and child paralogues (open).
  const met = (map: string) => (isChildParalogue(map) ? opened(map) : state.cleared.has(map));
  return Object.entries(CHILD_PARALOGUES).map(([map, p]) => {
    const open = opened(map);
    const reachable = p.reach.some((route) => route.every(met));
    return { map, open, reachable, playable: open && reachable && !state.cleared.has(map) };
  });
}
