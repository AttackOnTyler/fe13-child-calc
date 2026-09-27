/**
 * Where a run's gold comes from (#180; research/gold-economy, #158). Awakening pays no gold for clearing a map: a run
 * starts with 5,000G (FEW Gold, oldid 763531; LP Archive screenshots), and its money is Bullion sold at an armory
 * (sellPrice in items.ts) plus Paralogue 13's gold (the map's item rows, `gold`). Each map's items, and what play can
 * lose of them, are in the chapter data (`items`, `play`).
 */

export const STARTING_GOLD = 5000;

export type RenownReward = { readonly renown: number; readonly item: string };

/**
 * Renown (SF Renown; FEW Renown, oldid 762420; the 2ch wiki 名声; pegasusknight; toragame): +10 for each story map
 * cleared, whatever the difficulty. Whether paralogues and DLC maps give any isn't published (G6): the
 * `paralogue-renown` assumption says. Rewards are claimed once per file from the world map's Renown menu, which opens
 * after Chapter 3; claiming doesn't spend renown. A new file starts with the highest renown of any cleared file, so a
 * run's starting renown is recorded, not derived.
 */
export const RENOWN: {
  readonly perStoryMap: number;
  readonly menuOpensAfter: string;
  readonly rewards: readonly RenownReward[];
  readonly source: string;
} = {
  perStoryMap: 10,
  menuOpensAfter: 'chapter-3',
  rewards: [
    [50, 'Glass Sword'],
    [100, 'Second Seal'],
    [150, "Orsin's Hatchet"],
    [210, 'Seed of Trust'],
    [270, 'Levin Sword'],
    [330, 'Energy Drop'],
    [400, 'Beast Killer'],
    [470, 'Spirit Dust'],
    [550, "Celica's Gale"],
    [630, 'Secret Book'],
    [720, 'Longbow'],
    [810, "Ephraim's Lance"],
    [900, 'Goddess Icon'],
    [1000, 'Bullion (L)'],
    [1200, 'Speedwing'],
    [1500, "Leif's Blade"],
    [1800, 'Bolt Axe'],
    [2200, 'Seraph Robe'],
    [2600, "Innes' Bow"],
    [3000, 'Mercurius'],
    [3500, 'Dracoshield'],
    [4000, 'Noble Rapier'],
    [4500, "Tiki's Tear"],
    [5000, 'Parthia'],
    [5750, "Sigurd's Lance"],
    [6500, 'Talisman'],
    [7250, "Hector's Axe"],
    [8000, "Alm's Blade"],
    [9000, "Micaiah's Pyre"],
    [10000, 'Gradivus'],
    [30000, "Naga's Tear"],
    [50000, 'Boots'],
    [99999, 'Supreme Emblem'],
  ].map(([renown, item]) => ({ renown: renown as number, item: item as string })),
  source: 'SF Renown; FEW Renown (oldid 762420); 2ch wiki 名声; pegasusknight wiki; toragame (research/gold-economy §1.5)',
};
