/**
 * The captured maps (#237, #261): each story map's and paralogue's terrain grid and placements, extracted from the
 * user's own ROM into `src/game-data/maps` by `scripts/play/maps/extract.ts`. This module types them and reads the
 * terrain: a tile's type, its Def/Avo, and the movement cost of entering it for a class.
 */
import * as MAPS from '../../game-data/maps';
import { CLASS_MOVE_ROW, MOVE_COSTS, TERRAIN, TERRAIN_CATEGORIES } from '../../game-data/maps';

export type Tile = readonly [x: number, y: number];

/** A placement's AI (research #254 §1.1): when it starts moving, its standing mission, whom it attacks, where it walks. */
export type PlacementAi = {
  readonly start?: string;
  readonly startParam?: string;
  readonly mission?: string;
  readonly missionParam?: string;
  readonly attack?: string;
  readonly attackParam?: string;
  readonly move?: string;
  readonly moveParam?: string;
};

/** One placement in a map's dispos (the ROM's own), as extracted. */
export type Placement = {
  readonly faction: string;
  readonly pid: string;
  readonly team: 'player' | 'enemy' | 'ally';
  /** A named person's English name (none for Robin, whom the player names, or generic foes). */
  readonly name?: string;
  /** Where it appears, and where it walks to (the same for a normal start). */
  readonly at: Tile;
  readonly to: Tile;
  readonly difficulties: readonly string[];
  readonly deploySlot?: boolean;
  readonly forced?: boolean;
  /** Its class (the chapter's person file) and the items the placement lists (the Normal-tier weapons). */
  readonly class?: string;
  readonly items?: readonly string[];
  readonly ai?: PlacementAi;
  /** Its band: units sharing a nonzero group wake together (research #254 §2.2). */
  readonly group?: number;
  /** The "can't move" flag: it attacks only what its weapon reaches from its tile (Garrick). */
  readonly stationary?: boolean;
  readonly boss?: boolean;
};

export type CapturedMap = {
  readonly id: string;
  readonly rom: string;
  readonly terrainFile: string;
  readonly width: number;
  readonly height: number;
  /** One string per row; each char indexes TERRAIN. */
  readonly rows: readonly string[];
  readonly spawns: readonly Placement[];
};

const BY_ID = new Map<string, CapturedMap>(
  Object.entries(MAPS)
    .filter(([k]) => k.startsWith('MAP_'))
    .map(([, m]) => [(m as unknown as CapturedMap).id, m as unknown as CapturedMap]),
);

/** A map's captured grid and placements, when the ROM has it (every story map and paralogue). */
export const capturedMap = (id: string): CapturedMap | undefined => BY_ID.get(id);

type TerrainType = (typeof TERRAIN)[number];
const BY_CHAR = new Map<string, TerrainType>(TERRAIN.map((t) => [t.char, t]));

/** The terrain type on a tile; undefined off the map. */
export function terrainAt(map: CapturedMap, [x, y]: Tile): TerrainType | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return BY_CHAR.get(map.rows[y]![x]!);
}

/** The Def and Avoid a tile gives the unit on it. */
export function tileBonus(map: CapturedMap, t: Tile): { readonly def: number; readonly avo: number } {
  const c = terrainAt(map, t);
  const cat = c ? TERRAIN_CATEGORIES[c.category] : undefined;
  return { def: cat?.def ?? 0, avo: cat?.avo ?? 0 };
}

/** A class's movement row (by its English name, gender marks dropped); Plain-walkers' row 0 when unknown. */
export function moveRow(className: string): number {
  return CLASS_MOVE_ROW[className.replace(/ \([MF]\)$/, '')] ?? 0;
}

/** The movement cost of entering a tile for a movement row; null when it can't. */
export function moveCost(map: CapturedMap, t: Tile, row: number): number | null {
  const c = terrainAt(map, t);
  if (!c) return null;
  return MOVE_COSTS[row]?.[c.category] ?? null;
}

/**
 * Whether a map counts as outdoors for Outdoor Fighter: it has no indoor floor (terrain category 11: Floor, an indoor
 * Bridge, a Breach). A heuristic: which tiles the game counts is open (research #255 §4).
 */
export function isOutdoors(map: CapturedMap): boolean {
  return !map.rows.some((row) => [...row].some((ch) => BY_CHAR.get(ch)?.category === 11));
}

export const manhattan = (a: Tile, b: Tile): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const sameTile = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];
export const tileKey = ([x, y]: Tile): number => y * 64 + x;
export const keyTile = (k: number): Tile => [k % 64, Math.floor(k / 64)];
export const NEIGHBOURS: readonly Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
