import { MOD_STATS, STATS, type Growths, type Modifiers } from '../game-data/stats';

/** What one parent passes to a child, resolved to concrete values. */
export type ParentProfile = {
  readonly growths: Growths;
  readonly modifiers: Modifiers;
  /** A child unit acting as a parent (only ever Morgan's). Its modifiers already carry its own +1. */
  readonly secondGen: boolean;
};

/**
 * Growth = floor((father + mother + child personal) / 3), per stat.
 * SF chargrowth13-2.js `calculateChild`; FEW Module:ReclassGrowths `childFE13` makes the floor explicit.
 * A second-gen parent's growths are its own floored personal growths; floor(floor(x)/3) = floor(x/3), so this is
 * the same as flooring once (#8).
 */
export function inheritGrowths(a: ParentProfile, b: ParentProfile, personal: Growths): Growths {
  const out = {} as Record<(typeof STATS)[number], number>;
  for (const s of STATS) out[s] = Math.floor((a.growths[s] + b.growths[s] + personal[s]) / 3);
  return out;
}

/**
 * Modifier = father + mother + 1, per stat (SF children page; SF fe13maxstats.js), with no +1 when a parent is
 * itself a child (Morgan with a second-gen parent; SF modifiers page, FEW Inheritance).
 * `cap` (the modifier-cap assumption, null for none) clamps each stat to ±cap; `capped` says whether it bound.
 */
export function inheritModifiers(
  a: ParentProfile,
  b: ParentProfile,
  cap: number | null,
): { readonly modifiers: Modifiers; readonly capped: boolean } {
  const bonus = a.secondGen || b.secondGen ? 0 : 1;
  const out = {} as Record<(typeof MOD_STATS)[number], number>;
  let capped = false;
  for (const s of MOD_STATS) {
    const sum = a.modifiers[s] + b.modifiers[s] + bonus;
    out[s] = cap === null ? sum : Math.max(-cap, Math.min(cap, sum));
    capped ||= out[s] !== sum;
  }
  return { modifiers: out, capped };
}
