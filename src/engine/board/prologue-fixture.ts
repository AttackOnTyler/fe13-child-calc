/**
 * The Lunatic Prologue as attempt 1's turn-1 bookmark captured it (`docs/play-log/p02-prologue/instances-t1.json` on
 * `play/azahar-harness`): the four units with their stats, skills and items, and the skills each enemy rolled. For the
 * position engine's tests; a run's own board comes from its snapshot.
 */
import { itemByName } from '../../game-data/items';
import type { Stat } from '../../game-data/stats';
import { boardFromMap, classMov, weaponsOf, type Board, type PlayerPiece } from './board';
import type { Tile } from './captured';

const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number): Record<Stat, number> => ({ hp, str, mag, skl, spd, lck, def, res });

const unit = (id: string, name: string, className: string, s: Record<Stat, number>, skills: string[], inventory: string[], at: Tile): PlayerPiece => {
  const weapons = weaponsOf(inventory);
  return {
    id,
    name,
    fighter: { name, className, stats: s, skills, weapon: weapons[0] },
    weapons,
    items: inventory.filter((i) => !weapons.some((w) => w.item.name === i)).map((item) => ({ item, uses: itemByName(item)?.uses ?? null })),
    hp: s.hp,
    at,
    supports: {},
    mov: classMov(className),
  };
};

/** The four at their turn-1 tiles: Chrom (3,13), Lissa (1,13), Frederick (2,14), Robin (4,14). */
export const PROLOGUE_UNITS: readonly PlayerPiece[] = [
  unit('chrom', 'Chrom', 'Lord', stats(20, 7, 1, 8, 8, 5, 7, 1), ['Dual Strike+'], ['Falchion', 'Rapier', 'Vulnerary'], [3, 13]),
  unit('lissa', 'Lissa', 'Cleric', stats(17, 1, 5, 4, 4, 8, 3, 4), ['Miracle'], ['Heal', 'Vulnerary'], [1, 13]),
  unit('frederick', 'Frederick', 'Great Knight', stats(28, 13, 2, 12, 10, 6, 14, 3), ['Discipline', 'Outdoor Fighter'], ['Silver Lance'], [2, 14]),
  unit('robin', 'Robin', 'Tactician', stats(19, 8, 5, 5, 6, 4, 5, 4), ['Veteran'], ['Thunder', 'Bronze Sword'], [4, 14]),
];

/** What each enemy rolled (P02-S2): two Myrmidons Avoid +10, the Elthunder Mage Focus; the rest nothing but Garrick's Gamble. */
export const PROLOGUE_ROLLED: Readonly<Record<string, readonly string[]>> = {
  '8,1': ['Gamble'],
  '7,3': [],
  '9,3': ['Avoid +10'],
  '8,2': ['Focus'],
  '6,2': [],
  '10,2': [],
  '10,6': [],
  '7,9': [],
  '4,10': ['Avoid +10'],
  '1,8': [],
  '9,12': [],
};

/** The Lunatic Prologue's turn-1 board, with the units moved and paired as given (`lead: back`). */
export function prologueBoard(at: Readonly<Record<string, Tile>> = {}, pairs: Readonly<Record<string, string>> = {}): Board {
  const carried = new Map(Object.entries(pairs).map(([lead, back]) => [back, lead]));
  const players = PROLOGUE_UNITS.map((u): PlayerPiece => {
    const lead = carried.get(u.id);
    const tile = lead ? (at[lead] ?? PROLOGUE_UNITS.find((x) => x.id === lead)!.at) : (at[u.id] ?? u.at);
    return { ...u, at: tile, ...(pairs[u.id] ? { back: pairs[u.id] } : {}), ...(lead ? { carriedBy: lead } : {}) };
  });
  return boardFromMap('prologue', 'lunatic', players, PROLOGUE_ROLLED)!;
}
