/**
 * Support growth in a simulated run (#188; spec #175, EXP, supports and internal level; research/support-growth §1.2,
 * §3, §4). Pure and cheap: a run calls it once per map with the map's combats together (`MapPlay.units[id].together`).
 *
 * A map's points per pair: combats together F give round(6F / 9), at most 3 (1, 1, 2, then 3 from 4 combats). Each
 * unit's pairs of the map are ranked by those points, and its top three keep up to 3, 2 and 1, the rest nothing; a pair
 * gets the lower of its two units' allowances. Only combats together count: adjacency alone earns nothing (and the map
 * simulation has none). Points then stop at the next rank's threshold (the `support-past-threshold` assumption: the
 * clamp, at most one rank a map), or carry past it (the bank).
 */
import { supportCurveOf, SUPPORT_CURVES, type SupportThresholds, type SupportUnit } from '../../game-data/supports';
import type { Gender } from '../../game-data/stats';
import type { Assumptions } from '../assumptions';
import type { RosterUnit } from '../roster';
import { SUPPORT_LEVELS, type SupportLevel } from '../run';
import { SUPPORT_POINTS_PER_MAP } from '../support-curves';

/** The allowances of a unit's top three pairs of a map (SF Support Basics). */
export const TOP_PAIR_POINTS: readonly number[] = [3, 2, 1];

/** A pair's gain on one map. */
export type SupportGain = { readonly a: RosterUnit; readonly b: RosterUnit; readonly points: number };

/** Combats together per unit, per partner (a map's `MapPlay.units[id].together`). */
export type Together = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** A roster unit as its support lists have it: Robin by gender. */
export const supportUnitOf = (u: RosterUnit, robin: Gender | undefined): SupportUnit => (u === 'robin' ? (robin === 'F' ? 'robin-f' : 'robin-m') : (u as SupportUnit));

/** The pair's thresholds, or undefined when the two can't support (a parent and child, a sibling, a SpotPass pair). */
export function pairThresholds(a: RosterUnit, b: RosterUnit, robin: Gender | undefined): SupportThresholds | undefined {
  const curve = supportCurveOf(supportUnitOf(a, robin), supportUnitOf(b, robin));
  return curve && SUPPORT_CURVES[curve];
}

/** Points from combats together on one map, before the per-unit allowances: round(6F / 9), at most 3. */
export const combatPoints = (combats: number): number => Math.min(SUPPORT_POINTS_PER_MAP, Math.round((6 * combats) / 9));

/**
 * The map's gain per pair from its combats together (see the module comment). Pairs that can't support gain nothing
 * and take no allowance. Ties between a unit's pairs go to more combats, then the partner first by id (the game's
 * tie is its support list order, which the data doesn't carry).
 */
export function mapSupportGains(together: Together, robin: Gender | undefined): SupportGain[] {
  const raw = new Map<string, { a: RosterUnit; b: RosterUnit; points: number; combats: number }>();
  for (const [u, partners] of Object.entries(together)) {
    for (const [p, combats] of Object.entries(partners)) {
      const [a, b] = (u < p ? [u, p] : [p, u]) as [RosterUnit, RosterUnit];
      const k = `${a}+${b}`;
      if (raw.has(k) || !pairThresholds(a, b, robin)) continue;
      // Either side's count: both tally each exchange fought together.
      const c = Math.max(combats, together[p]?.[u] ?? 0);
      const points = combatPoints(c);
      if (points > 0) raw.set(k, { a, b, points, combats: c });
    }
  }
  const allowance = new Map<string, number>();
  const byUnit = new Map<RosterUnit, { k: string; partner: RosterUnit; points: number; combats: number }[]>();
  for (const [k, r] of raw) {
    for (const [u, partner] of [[r.a, r.b], [r.b, r.a]] as const) {
      let list = byUnit.get(u);
      if (!list) byUnit.set(u, (list = []));
      list.push({ k, partner, points: r.points, combats: r.combats });
    }
  }
  for (const [u, list] of byUnit) {
    list.sort((x, y) => y.points - x.points || y.combats - x.combats || (x.partner < y.partner ? -1 : 1));
    list.forEach((e, i) => allowance.set(`${u}|${e.k}`, TOP_PAIR_POINTS[i] ?? 0));
  }
  const out: SupportGain[] = [];
  for (const [k, r] of raw) {
    const points = Math.min(r.points, allowance.get(`${r.a}|${k}`) ?? 0, allowance.get(`${r.b}|${k}`) ?? 0);
    if (points > 0) out.push({ a: r.a, b: r.b, points });
  }
  return out;
}

/** The rank a pair's points reach (S only when `sAllowed`: the pair is to marry), or null below C. */
export function rankOf(points: number, t: SupportThresholds, sAllowed: boolean): SupportLevel | null {
  let rank: SupportLevel | null = null;
  for (const r of SUPPORT_LEVELS) {
    const need = t[r];
    if (need === undefined || (r === 'S' && !sAllowed) || points < need) break;
    rank = r;
  }
  return rank;
}

/**
 * Points after a map's gain: under the clamp they stop at the next rank's threshold (from the rank held at the map's
 * start); under the bank they carry, up to the top threshold. S counts only when `sAllowed`.
 */
export function addPoints(points: number, gain: number, t: SupportThresholds, sAllowed: boolean, rule: Assumptions['support-past-threshold']): number {
  const ranks = SUPPORT_LEVELS.filter((r) => t[r] !== undefined && (r !== 'S' || sAllowed));
  const top = t[ranks[ranks.length - 1]!]!;
  if (rule === 'bank') return Math.min(top, points + gain);
  const next = ranks.map((r) => t[r]!).find((need) => need > points);
  return next === undefined ? points : Math.min(next, points + gain);
}

/** The points a recorded rank stands for: its threshold (the conversation viewed, nothing past it known). */
export const pointsOfRank = (rank: SupportLevel, t: SupportThresholds): number => t[rank] ?? t.A;
