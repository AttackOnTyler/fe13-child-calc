/**
 * A map's gold income and renown (#180), read from the chapter data and research/gold-economy: the Bullion on the map
 * at its sale price, Paralogue 13's gold, and what play can lose of either. Nothing here guesses what a run collects:
 * the gold forecast (#190) and side goals (#191) turn the `play` flags into chances.
 */
import type { ChapterData, PlayDependence } from '../game-data/chapters';
import { RENOWN, type RenownReward } from '../game-data/gold';
import { itemByName, sellPrice } from '../game-data/items';

export type GoldRow = {
  /** The item (`Bullion (M)`), or FEW's name for the gold (`500G`). */
  readonly item: string;
  readonly how: string;
  readonly kind: 'bullion' | 'gold';
  /** What it's worth in gold: a Bullion's sale price times `count`, or the gold paid (each `per`, if given). */
  readonly gold: number;
  /** How many Bullion the row holds (Roster Rescue's seven). */
  readonly count: number;
  readonly per?: string;
  readonly play: PlayDependence | undefined;
};

const BULLION = /^(Bullion \([SML]\))(?: \(×(\d+)\))?$/;

/** The map's Bullion and gold, in the chapter data's item order. */
export function mapGold(map: ChapterData): GoldRow[] {
  const rows: GoldRow[] = [];
  for (const r of map.items) {
    if (r.gold) rows.push({ item: r.item, how: r.how, kind: 'gold', gold: r.gold.amount, count: 1, ...(r.gold.per ? { per: r.gold.per } : {}), play: r.play });
    const m = BULLION.exec(r.item);
    if (!m) continue;
    const count = m[2] ? Number(m[2]) : 1;
    rows.push({ item: m[1]!, how: r.how, kind: 'bullion', gold: sellPrice(itemByName(m[1]!)!) * count, count, play: r.play });
  }
  return rows;
}

/** Renown for clearing the map: 10 for a story map, the assumption's value for a paralogue or DLC map. */
export const renownGain = (map: ChapterData, paralogueRenown: number): number => (map.kind === 'story' ? RENOWN.perStoryMap : paralogueRenown);

/** The rewards crossed going from `from` renown to `to`: each reached at its threshold. */
export const renownRewards = (from: number, to: number): readonly RenownReward[] => RENOWN.rewards.filter((r) => r.renown > from && r.renown <= to);
