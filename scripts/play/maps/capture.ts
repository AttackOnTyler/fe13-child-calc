/**
 * Captures a map's units from a bookmark (the game's suspend, written to `Temporary`) as instances linked to the
 * chapter data's enemy groups, for the play log's settled entries.
 *
 *   npx vite-node scripts/play/maps/capture.ts <map id> <difficulty> [bookmark path] [--json]
 *
 * Reads a copy of the bookmark and never writes it.
 */
import { join } from 'node:path';
import { MAPS, type ChapterDifficulty, type EnemyGroup } from '../../../src/game-data/chapters';
import { STATS, type Stat } from '../../../src/game-data/stats';
import { parseChapter, type SaveUnit } from '../save/chapter';
import { decompressSave } from '../save/huffman';
import { finalStats, readSave } from '../save/snapshot';

const TEAMS: Readonly<Record<number, string>> = { 0: 'player', 1: 'enemy', 2: 'ally' };

export type Instance = {
  readonly team: string;
  readonly x: number;
  readonly y: number;
  readonly class: string;
  readonly level: number;
  readonly currentHp: number;
  /** Full stats for roster units; null for map-only units (see instanceStats). */
  readonly stats: Readonly<Record<Stat, number>> | null;
  readonly items: readonly string[];
  readonly skills: readonly string[];
  /** Index into the chapter data's groups for this difficulty (enemies, or npcs for allies); null when none matches. */
  readonly groupRef: number | null;
  /** Stats where the instance and its group disagree: [instance, group]. */
  readonly differs: Readonly<Partial<Record<Stat, readonly [number, string]>>>;
};

/**
 * Stats the save states outright. Roster units: class base + additions + gains. Map-only units (enemies, the
 * Premonition's Chrom and Robin) are built at runtime from their ROM person record and store no gains, so the save
 * gives only their current HP (max HP on turn 1); their other stats are read off the game's stat panel in play.
 */
const instanceStats = (u: SaveUnit): Record<Stat, number> | null => {
  if (u.unit.startsWith('#')) return null;
  return (finalStats(u).stats as Record<Stat, number> | null) ?? null;
};

const saveClassName = (s: string) => s.replace(/\s*\((M|F)\)$/, '');

const matchGroup = (u: SaveUnit, stats: Record<Stat, number> | null, groups: readonly EnemyGroup[]) => {
  const candidates = groups
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.class === saveClassName(u.className) && g.level.split(/\D/)[0] === String(u.level));
  const known: Partial<Record<Stat, number>> = stats ?? { hp: u.currentHp };
  const agrees = (g: EnemyGroup) => Object.entries(known).every(([s, v]) => String(v) === (g.stats[s as Stat] ?? '').split(/\D/)[0]);
  const pick = candidates.find(({ g }) => agrees(g)) ?? candidates[0];
  if (!pick) return { groupRef: null, differs: {} };
  const differs: Partial<Record<Stat, readonly [number, string]>> = {};
  for (const [s, v] of Object.entries(known) as [Stat, number][]) if (String(v) !== (pick.g.stats[s] ?? '').split(/\D/)[0]) differs[s] = [v, pick.g.stats[s]];
  return { groupRef: pick.i, differs };
};

export const capture = (mapId: string, difficulty: ChapterDifficulty, bookmark: Uint8Array): Instance[] => {
  const map = MAPS.find((m) => m.id === mapId);
  if (!map) throw new Error(`no map ${mapId}`);
  const save = parseChapter(decompressSave(bookmark));
  const out: Instance[] = [];
  for (const g of [0, 1, 2]) {
    const groups = g === 1 ? map.enemies[difficulty] ?? [] : g === 2 ? map.npcs?.[difficulty] ?? [] : [];
    for (const u of save.groups[g] ?? []) {
      const stats = instanceStats(u);
      const { groupRef, differs } = g === 0 ? { groupRef: null, differs: {} } : matchGroup(u, stats, groups);
      out.push({
        team: TEAMS[g], x: u.position[0], y: u.position[1], class: u.className, level: u.level, currentHp: u.currentHp, stats,
        items: u.items.map((i) => i.name), skills: u.equippedSkills, groupRef, differs,
      });
    }
  }
  return out;
};

const SAVE_DIR = join(process.env.APPDATA ?? '', 'Azahar/sdmc/Nintendo 3DS/00000000000000000000000000000000/00000000000000000000000000000000/title/00040000/000a0500/data/00000001');

export const main = (args: readonly string[]) => {
  const [mapId, difficulty, path] = args.filter((a) => a !== '--json');
  if (!mapId || !difficulty) throw new Error('usage: capture.ts <map id> <difficulty> [bookmark path] [--json]');
  const instances = capture(mapId, difficulty as ChapterDifficulty, readSave(path ?? join(SAVE_DIR, 'Temporary')));
  if (args.includes('--json')) return console.log(JSON.stringify(instances, null, 1));
  for (const i of instances) {
    const s = i.stats ? STATS.map((k) => `${k} ${i.stats![k]}`).join(' ') : `HP ${i.currentHp} (other stats: read the stat panel)`;
    const link = i.team === 'player' ? '' : i.groupRef === null ? ' · NO GROUP' : ` · group ${i.groupRef}`;
    const diff = Object.entries(i.differs).map(([k, [a, b]]) => `${k} ${a}≠${b}`).join(', ');
    console.log(`[${i.team}] (${i.x},${i.y}) ${i.class} Lv ${i.level}${link}${diff ? ` · differs: ${diff}` : ''}\n  ${s}\n  items: ${i.items.join(', ') || '-'}`);
  }
};
