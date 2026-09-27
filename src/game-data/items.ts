/**
 * Weapons, staves, tomes, stones and items (#115), and the forge rules. The list is generated from Serenes Forest's
 * inventory tables with Fire Emblem Wiki's effects (items/list.ts); SF's forging page gives the rules.
 */
import { ITEM_LIST } from './items/list';
import type { Stat } from './stats';

export type ItemKind = 'sword' | 'lance' | 'axe' | 'bow' | 'tome' | 'staff' | 'stone' | 'beaststone' | 'item';
/** A weapon deals bonus damage (three times Mt) to these units. */
export type Effectiveness = 'fell dragon' | 'dragon' | 'flying' | 'armored' | 'beast' | 'monster';

export type GameItem = {
  readonly name: string;
  readonly kind: ItemKind;
  /** E–S weapon rank, or `Prf`-like text for personal weapons. */
  readonly rank?: string;
  readonly mt?: number;
  readonly hit?: number;
  readonly crit?: number;
  /** e.g. `1`, `1~2`, `1~Mag/2`. */
  readonly range?: string;
  readonly uses?: number;
  /** Price in the shop (0 or absent: can't be bought or sold). */
  readonly worth?: number;
  /** A staff's EXP per use. */
  readonly exp?: number;
  readonly effective?: readonly Effectiveness[];
  /** Strikes twice. */
  readonly brave?: boolean;
  /** A physical weapon that deals magic damage (Levin Sword). */
  readonly magic?: boolean;
  /** Who can use it, e.g. `Archer and Sniper`. */
  readonly only?: string;
  readonly forgeable: boolean;
  /** FEW's effects and notes, else SF's description. */
  readonly notes?: string;
  readonly description?: string;
};

export const ITEMS: readonly GameItem[] = ITEM_LIST;

/**
 * Forging (SF Forging): a weapon with a non-zero worth can be forged (except Mire). Mt, Hit and Crit each rise through
 * up to 5 intervals, 8 intervals in all, and Crit tops out at 50. Raising a stat to interval n costs COST[n] × the
 * weapon's worth at full uses, per stat: Steel Sword (840G) to +2 Mt, +15 Hit, +3 Crit costs (1.5 + 3.0 + 0.5) × 840 =
 * 4200G. Enemies' weapons can go past these limits.
 */
export const FORGE = {
  step: { mt: 1, hit: 5, crit: 3 },
  maxPerStat: 5,
  maxTotal: 8,
  maxCrit: 50,
  /** Worth multiplier to reach each interval (index = interval). */
  cost: [0, 0.5, 1.5, 3.0, 5.0, 7.5],
  source: 'SF Forging (https://serenesforest.net/awakening/miscellaneous/forging/)',
} as const;

export type ForgeLevels = { readonly mt: number; readonly hit: number; readonly crit: number };

/** Why a forge isn't allowed, or undefined when it is. */
export function forgeProblem(item: GameItem, levels: ForgeLevels): string | undefined {
  if (!item.forgeable) return `${item.name} can’t be forged`;
  const all = [levels.mt, levels.hit, levels.crit];
  if (all.some((l) => l < 0 || l > FORGE.maxPerStat || !Number.isInteger(l))) return `Each stat takes 0–${FORGE.maxPerStat} intervals`;
  if (all.reduce((a, b) => a + b, 0) > FORGE.maxTotal) return `At most ${FORGE.maxTotal} intervals in all`;
  return undefined;
}

/** A forged weapon's Mt, Hit and Crit (Crit capped at 50). */
export function forgedStats(item: GameItem, levels: ForgeLevels): { mt: number; hit: number; crit: number } {
  return {
    mt: (item.mt ?? 0) + levels.mt * FORGE.step.mt,
    hit: (item.hit ?? 0) + levels.hit * FORGE.step.hit,
    crit: Math.min(FORGE.maxCrit, (item.crit ?? 0) + levels.crit * FORGE.step.crit),
  };
}

/** The gold to forge a fresh weapon to these levels, or to go from `from` to `to`. */
export function forgeCost(item: GameItem, to: ForgeLevels, from: ForgeLevels = { mt: 0, hit: 0, crit: 0 }): number {
  const worth = item.worth ?? 0;
  const stat = (k: keyof ForgeLevels) => (FORGE.cost[to[k]]! - FORGE.cost[from[k]]!) * worth;
  return Math.round(stat('mt') + stat('hit') + stat('crit'));
}

/**
 * What an armory pays (#180; research/gold-economy §2; FEW Worth, oldid 756230): half the worth, scaled by the uses left.
 * The 50 items of the event-tile and Barracks pool pay a quarter: the item notes say so for 43, and SF's inventory
 * footnotes and the 2ch wiki's prices add the seven below. Legendary weapons, the Falchions, the Goddess Staff and the DLC
 * rewards have no worth and pay nothing; the Supreme Emblem has none but sells for 99,999G. How a used item's price is
 * rounded isn't published (G2): it is rounded down, as the quarter prices at full uses are. A forged weapon's price isn't
 * published either (G1): it sells as the unforged one.
 */
export type SellRate = { readonly kind: 'half' | 'quarter' | 'none' } | { readonly kind: 'fixed'; readonly gold: number };

const QUARTER_UNNOTED = new Set(['Sweet Tincture', "Gaius's Confect", "Kris's Confect", "Tiki's Tear", 'Seed of Trust', 'Reeking Box', 'Rift Door']);
const FIXED_SELL: Readonly<Record<string, number>> = { 'Supreme Emblem': 99999 };

export function sellRate(item: GameItem): SellRate {
  const fixed = FIXED_SELL[item.name];
  if (fixed !== undefined) return { kind: 'fixed', gold: fixed };
  if (!item.worth) return { kind: 'none' };
  if (QUARTER_UNNOTED.has(item.name) || /Sells for 1\/4/.test(item.notes ?? '')) return { kind: 'quarter' };
  return { kind: 'half' };
}

/** The gold an armory pays for the item with `usesLeft` uses (default: full). Bullion has no uses: half its worth. */
export function sellPrice(item: GameItem, usesLeft?: number): number {
  const rate = sellRate(item);
  if (rate.kind === 'fixed') return rate.gold;
  if (rate.kind === 'none') return 0;
  const share = (item.worth ?? 0) * (rate.kind === 'half' ? 1 / 2 : 1 / 4);
  const left = item.uses ? Math.min(usesLeft ?? item.uses, item.uses) / item.uses : 1;
  return Math.floor(share * left + 1e-9);
}

/**
 * Stat boosters and tonics (#193; SF items, the list's descriptions; the item-plan grilling, #166): a booster raises its
 * stat for good by 2 (the Seraph Robe HP by 5) and never raises the cap; a tonic raises it by as much until the map's
 * end, and can pass the cap. Boots (+2 Move, once per unit) and the Arms Scroll (every weapon rank +1 level) are held
 * items too, but the simulation has no movement or weapon ranks.
 */
export const STAT_BOOSTERS: Readonly<Record<string, Stat>> = {
  'Seraph Robe': 'hp',
  'Energy Drop': 'str',
  'Spirit Dust': 'mag',
  'Secret Book': 'skl',
  Speedwing: 'spd',
  'Goddess Icon': 'lck',
  Dracoshield: 'def',
  Talisman: 'res',
};
export const TONICS: Readonly<Record<string, Stat>> = {
  'HP Tonic': 'hp',
  'Strength Tonic': 'str',
  'Magic Tonic': 'mag',
  'Skill Tonic': 'skl',
  'Speed Tonic': 'spd',
  'Luck Tonic': 'lck',
  'Defense Tonic': 'def',
  'Resistance Tonic': 'res',
};
/** What a booster or tonic adds to its stat: +5 HP, else +2. */
export const statItemGain = (stat: Stat): number => (stat === 'hp' ? 5 : 2);

/** Weapon and item disagreements between SF and FEW: SF's value is used (the ticket's primary source). */
export type ItemDisagreement = { readonly id: string; readonly item: string; readonly used: string; readonly other: string; readonly status: 'open' | 'resolved'; readonly why: string };

export const ITEM_DISAGREEMENTS: readonly ItemDisagreement[] = [
  { id: 'I1', item: 'Rapier worth', used: 'SF: 1,600', other: 'FEW list: 1,470', status: 'open', why: 'FEW’s 1,470 is Killing Edge’s worth, one row down; possibly a copy slip. No third source read.' },
  { id: 'I2', item: 'Balmung and Mystletainn Mt/Hit/Crit', used: 'SF: Balmung 13/90/10, Mystletainn 14/85/15', other: 'FEW list: the two swapped', status: 'open', why: 'The sites swap the pair; a third source (the game data) would settle it.' },
  { id: 'I3', item: 'Gáe Bolg and Gungnir Mt/Hit', used: 'SF: Gáe Bolg 15/75, Gungnir 16/70', other: 'FEW list: the two swapped', status: 'open', why: 'As I2.' },
  { id: 'I4', item: 'Underdog Bow worth', used: 'SF: 950', other: 'FEW list: 990', status: 'open', why: 'No third source read.' },
];

/** One spelling for FEW's and SF's names (curly apostrophes, British spelling). */
const normName = (name: string) => name.replace(/’/g, "'").replace(/Armour/g, 'Armor').replace(/Defence/g, 'Defense').trim().toLowerCase();
const BY_NAME = new Map(ITEM_LIST.map((i) => [normName(i.name), i]));

/** An item by name, however either source spells it; case doesn't matter. */
export const itemByName = (name: string): GameItem | undefined => BY_NAME.get(normName(name));
