/**
 * Pair-up: the bonus a support unit gives its lead, per stat (SF pair-up,
 * https://serenesforest.net/awakening/miscellaneous/pair-up/ ; #20 Scoring). HP gets none.
 */
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import type { ModStat } from '../game-data/stats';
import type { SupportRank } from './types';

/** Support rank bonus on the class bonus: C/B +1, A/S +2. */
const RANK_BONUS: Readonly<Record<SupportRank, number>> = { none: 0, C: 1, B: 1, A: 2, S: 2 };

/** +1/+2/+3 at 10/20/30 of the support's raw stat. */
export const statTier = (raw: number): number => Math.min(3, Math.max(0, Math.floor(raw / 10)));

/** The class's pair-up bonus to a stat, plus the rank bonus where that class bonus is non-zero. */
export function classBonus(supportClass: ClassId, stat: ModStat, rank: SupportRank): number {
  const data: ClassData = CLASSES[supportClass];
  const cls = data.pairUp[stat] ?? 0;
  return cls + (cls > 0 ? RANK_BONUS[rank] : 0);
}

/** The Spd part of the pair-up bonus (max +10): the raw-Spd tier plus the class and rank bonus. */
export const pairUpSpd = (supportClass: ClassId, rank: SupportRank, rawSpd: number): number =>
  statTier(rawSpd) + classBonus(supportClass, 'spd', rank);
