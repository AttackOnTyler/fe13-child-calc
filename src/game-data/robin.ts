/**
 * Robin (the Avatar): personal growths and modifiers before asset/flaw, and the asset/flaw delta tables.
 *
 * Sources (research/stat-inheritance, #2):
 * - Growths and growth deltas: SF https://serenesforest.net/awakening/characters/growth-rates/base/ and the
 *   `mods`/`mods1` arrays in https://serenesforest.net/app/java/chargrowth13-2.js .
 * - Modifier deltas: SF https://serenesforest.net/awakening/characters/maximum-stats/modifiers/ and the
 *   `assets`/`flaws` arrays in https://serenesforest.net/app/java/fe13maxstats.js .
 * - Base modifiers all 0: FEW https://fireemblemwiki.org/wiki/Robin/Stats .
 * All three agree, as does Marigold's bundled dataset (#8). HP may be the asset or the flaw, and the two must
 * differ, so there are 8 × 7 = 56 combos.
 */
import type { Growths, Modifiers, ModStat, Stat } from './stats';

export const ROBIN_GROWTHS: Growths = { hp: 40, str: 40, mag: 35, skl: 35, spd: 35, lck: 55, def: 30, res: 20 };
export const ROBIN_MODIFIERS: Modifiers = { str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };

type AssetFlaw = {
  readonly assetGrowth: Partial<Record<Stat, number>>;
  readonly flawGrowth: Partial<Record<Stat, number>>;
  readonly assetModifier: Partial<Record<ModStat, number>>;
  readonly flawModifier: Partial<Record<ModStat, number>>;
};

/** Signed deltas: an asset adds its row, a flaw adds its (negative) row. */
export const ASSET_FLAW: Readonly<Record<Stat, AssetFlaw>> = {
  hp: {
    assetGrowth: { hp: 30, def: 5, res: 5 },
    flawGrowth: { hp: -20, def: -5, res: -5 },
    assetModifier: { str: 1, mag: 1, lck: 2, def: 2, res: 2 },
    flawModifier: { str: -1, mag: -1, lck: -1, def: -1, res: -1 },
  },
  str: {
    assetGrowth: { str: 15, skl: 5, def: 5 },
    flawGrowth: { str: -10, skl: -5, def: -5 },
    assetModifier: { str: 4, skl: 2, def: 2 },
    flawModifier: { str: -3, skl: -1, def: -1 },
  },
  mag: {
    assetGrowth: { mag: 15, spd: 5, res: 5 },
    flawGrowth: { mag: -10, spd: -5, res: -5 },
    assetModifier: { mag: 4, spd: 2, res: 2 },
    flawModifier: { mag: -3, spd: -1, res: -1 },
  },
  skl: {
    assetGrowth: { skl: 15, str: 5, def: 5 },
    flawGrowth: { skl: -10, str: -5, def: -5 },
    assetModifier: { skl: 4, str: 2, def: 2 },
    flawModifier: { skl: -3, str: -1, def: -1 },
  },
  spd: {
    assetGrowth: { spd: 15, skl: 5, lck: 5 },
    flawGrowth: { spd: -10, skl: -5, lck: -5 },
    assetModifier: { spd: 4, skl: 2, lck: 2 },
    flawModifier: { spd: -3, skl: -1, lck: -1 },
  },
  lck: {
    assetGrowth: { lck: 15, str: 5, mag: 5 },
    flawGrowth: { lck: -10, str: -5, mag: -5 },
    assetModifier: { lck: 4, str: 2, mag: 2 },
    flawModifier: { lck: -3, str: -1, mag: -1 },
  },
  def: {
    assetGrowth: { def: 15, lck: 5, res: 5 },
    flawGrowth: { def: -10, lck: -5, res: -5 },
    assetModifier: { def: 4, lck: 2, res: 2 },
    flawModifier: { def: -3, lck: -1, res: -1 },
  },
  res: {
    assetGrowth: { res: 15, mag: 5, spd: 5 },
    flawGrowth: { res: -10, mag: -5, spd: -5 },
    assetModifier: { res: 4, mag: 2, spd: 2 },
    flawModifier: { res: -3, mag: -1, spd: -1 },
  },
};
