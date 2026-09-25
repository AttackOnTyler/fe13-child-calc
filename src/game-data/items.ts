/**
 * Weapons, staves, tomes, stones and items (#115), and the forge rules. The list is generated from Serenes Forest's
 * inventory tables with Fire Emblem Wiki's effects (items/list.ts); SF's forging page gives the rules.
 */
import { ITEM_LIST } from './items/list';

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
