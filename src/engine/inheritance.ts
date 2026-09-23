import { MOD_STATS, STATS, type Growths, type Modifiers } from '../game-data/stats';

/** What one parent passes to a child, resolved to concrete values. */
export type ParentProfile = { readonly growths: Growths; readonly modifiers: Modifiers };

/**
 * Growth = floor((father + mother + child personal) / 3), per stat.
 * SF chargrowth13-2.js `calculateChild`; FEW Module:ReclassGrowths `childFE13` makes the floor explicit.
 */
export function inheritGrowths(a: ParentProfile, b: ParentProfile, personal: Growths): Growths {
  const out = {} as Record<(typeof STATS)[number], number>;
  for (const s of STATS) out[s] = Math.floor((a.growths[s] + b.growths[s] + personal[s]) / 3);
  return out;
}

/** Modifier = father + mother + 1, per stat (SF children page; SF fe13maxstats.js). */
export function inheritModifiers(a: ParentProfile, b: ParentProfile): Modifiers {
  const out = {} as Record<(typeof MOD_STATS)[number], number>;
  for (const s of MOD_STATS) out[s] = a.modifiers[s] + b.modifiers[s] + 1;
  return out;
}
