/**
 * Support curves per pair (#177): a pair's thresholds and how many maps together each rank takes.
 *
 * Growth rules from research/support-growth (#139): a pair gains at most 3 points a map from combats together (§1.2,
 * §3), and its points stop at the next rank's threshold until the conversation is viewed between maps, so at most one
 * rank a map (§4.2, inferred: the "clamp" model, the more pessimistic one). A slow pair then needs 8 maps to S, a
 * fast or medium pair 7 (§5).
 */
import { SUPPORT_CURVES, SUPPORT_PAIRS, supportCurveOf, type SupportCurve, type SupportThresholds, type SupportUnit } from '../game-data/supports';
import type { SupportLevel } from './run';

/** The most points a pair gains from one map's combats together (SF Support Basics). */
export const SUPPORT_POINTS_PER_MAP = 3;

/** A pair's curve: its thresholds (total points per rank), maps to each rank at full speed, and maps to S. */
export type PairCurve = {
  readonly curve: SupportCurve;
  readonly thresholds: SupportThresholds;
  /** Maps together to each rank at 3 points a map, one rank a map at most. No S for a non-romantic pair. */
  readonly mapsTo: Readonly<Partial<Record<SupportLevel, number>>>;
  /** The fewest maps together to S: slow 8, fast or medium 7; undefined for a non-romantic pair. */
  readonly mapsToS: number | undefined;
};

/** A pair that can support, with its curve. */
export type SupportPairCurve = PairCurve & { readonly a: SupportUnit; readonly b: SupportUnit };

const RANKS: readonly SupportLevel[] = ['C', 'B', 'A', 'S'];

/** Maps to each rank at `perMap` points a map, points held at each threshold until the map ends. */
export function mapsToRanks(thresholds: SupportThresholds, perMap: number = SUPPORT_POINTS_PER_MAP): Partial<Record<SupportLevel, number>> {
  const out: Partial<Record<SupportLevel, number>> = {};
  let points = 0;
  let maps = 0;
  for (const rank of RANKS) {
    const need = thresholds[rank];
    if (need === undefined) break;
    while (points < need) {
      points = Math.min(need, points + perMap);
      maps++;
    }
    out[rank] = maps;
  }
  return out;
}

const curves: Readonly<Record<SupportCurve, PairCurve>> = Object.fromEntries(
  (Object.keys(SUPPORT_CURVES) as SupportCurve[]).map((curve) => {
    const thresholds = SUPPORT_CURVES[curve];
    const mapsTo = mapsToRanks(thresholds);
    return [curve, { curve, thresholds, mapsTo, mapsToS: mapsTo.S }];
  }),
) as Record<SupportCurve, PairCurve>;

/** A pair's curve, either way round; undefined when the two can't support. */
export function pairCurve(a: SupportUnit, b: SupportUnit): PairCurve | undefined {
  const curve = supportCurveOf(a, b);
  return curve && curves[curve];
}

/** Every pair that can support (Robin (M) and Robin (F) apart), with its curve. */
export const SUPPORT_PAIR_CURVES: readonly SupportPairCurve[] = SUPPORT_PAIRS.map((p) => ({ a: p.a, b: p.b, ...curves[p.curve] }));
