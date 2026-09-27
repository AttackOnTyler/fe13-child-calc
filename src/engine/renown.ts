/**
 * Renown along the run (#191; spec #175, Gold, items and upkeep): asked once per run (the file's starting renown and
 * the rewards already claimed), then derived: +10 for each story map cleared, a paralogue or DLC map per the
 * `paralogue-renown` assumption (0 by default). Every reward crossed arrives on the map that crosses it; the Renown menu
 * opens after Chapter 3, so one reached before then arrives with Chapter 3. A reward reached and not claimed is held
 * from now (claimed at the next preparations).
 *
 * Unrecorded, the run reads as starting at 0 with every reward reached so far already claimed (so nothing is counted
 * twice): only rewards crossed on the maps ahead count.
 */
import { MAPS } from '../game-data/chapters';
import { RENOWN } from '../game-data/gold';
import { itemByName, sellPrice } from '../game-data/items';
import { renownGain, renownRewards } from './gold';
import type { Run } from './run';

/** The run's renown as asked once (#191): the file's renown before its first map, and the rewards already claimed. */
export type RunRenown = { readonly start: number; readonly claimed: readonly string[] };

/** A map ahead: renown after it, and the rewards that arrive on it. */
export type RenownStop = { readonly key: string; readonly map: string; readonly renown: number; readonly rewards: readonly string[] };

export type RenownAhead = {
  /** Whether the run's renown is recorded (else read as described in the module comment). */
  readonly recorded: boolean;
  /** Renown after the maps logged. */
  readonly now: number;
  /** Rewards reached, not claimed, with the menu open: held from now. */
  readonly waiting: readonly string[];
  readonly stops: readonly RenownStop[];
};

const gainOf = (map: string, paralogueRenown: number): number => {
  const data = MAPS.find((m) => m.id === map);
  return data ? renownGain(data, paralogueRenown) : 0;
};

/** Renown now and where each reward ahead arrives, over the map order's steps still to play. */
export function renownAhead(run: Run, steps: readonly { readonly key: string; readonly map: string }[], paralogueRenown: number): RenownAhead {
  const logged = run.entries.filter((e) => e.map !== 'other').map((e) => e.map);
  const now = (run.renown?.start ?? 0) + logged.reduce((a, m) => a + gainOf(m, paralogueRenown), 0);
  let open = logged.includes(RENOWN.menuOpensAfter);
  const claimed = new Set(run.renown ? run.renown.claimed : renownRewards(-1, now).map((r) => r.item));
  let pending = renownRewards(-1, now).map((r) => r.item).filter((i) => !claimed.has(i));
  const waiting = open ? pending : [];
  if (open) pending = [];
  let renown = now;
  const stops = steps.map((s) => {
    const after = renown + gainOf(s.map, paralogueRenown);
    const crossed = renownRewards(renown, after).map((r) => r.item).filter((i) => !claimed.has(i));
    renown = after;
    if (!open && s.map === RENOWN.menuOpensAfter) open = true;
    const rewards = open ? [...pending, ...crossed] : [];
    if (open) pending = [];
    else pending.push(...crossed);
    return { key: s.key, map: s.map, renown: after, rewards };
  });
  return { recorded: !!run.renown, now, waiting, stops };
}

/** What renown rewards add to a run's gold and seals: Bullion is sold; seals are held; other rewards are held items. */
export function rewardsValue(items: readonly string[]): { readonly gold: number; readonly master: number; readonly second: number } {
  let gold = 0;
  for (const i of items) if (/^Bullion \([SML]\)$/.test(i)) gold += sellPrice(itemByName(i)!);
  return { gold, master: items.filter((i) => i === 'Master Seal').length, second: items.filter((i) => i === 'Second Seal').length };
}

/** Records the run's renown (asked once); undefined clears it. */
export function withRenown(run: Run, renown: RunRenown | undefined): Run {
  const { renown: _, ...rest } = run;
  return renown ? { ...rest, renown: { start: Math.max(0, Math.floor(renown.start)), claimed: [...new Set(renown.claimed)] } } : rest;
}

/** A stored run's renown: a start and the claimed rewards; undefined when unreadable or absent. */
export function parseRenown(v: unknown): RunRenown | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  if (typeof r.start !== 'number' || !Number.isFinite(r.start)) return undefined;
  const known = new Set(RENOWN.rewards.map((x) => x.item));
  const claimed = Array.isArray(r.claimed) ? r.claimed.filter((c): c is string => typeof c === 'string' && known.has(c)) : [];
  return { start: Math.max(0, Math.floor(r.start)), claimed };
}
