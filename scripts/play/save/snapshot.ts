/**
 * Ground-truth snapshot of an Awakening Chapter save, for diffing against the app's plan and ledger.
 *
 *   npx vite-node scripts/play/save/cli.ts [slot 0-2 | path] [--json]
 *
 * Reads a copy of the save (never the live file), so it is safe while Azahar is running.
 */
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLASS_BASES } from '../../../src/game-data/class-bases';
import { CLASSES, type ClassId } from '../../../src/game-data/classes';
import { CHILD_UNITS } from '../../../src/game-data/children';
import { ASSET_FLAW, ROBIN_MODIFIERS } from '../../../src/game-data/robin';
import { STATS, type Stat } from '../../../src/game-data/stats';
import { FIRST_GEN_UNITS } from '../../../src/game-data/units';
import { parseChapter, type SaveUnit } from './chapter';
import { decompressSave } from './huffman';
import ids from './ids.json';

const SAVE_DIR = join(
  process.env.APPDATA ?? '',
  'Azahar/sdmc/Nintendo 3DS/00000000000000000000000000000000/00000000000000000000000000000000/title/00040000/000a0500/data/00000001',
);

export const GROUPS: Readonly<Record<number, string>> = { 0: 'blue (map)', 1: 'red (map)', 2: 'green (map)', 3: 'army', 4: 'dead', 5: 'other' };

/** The save's class names ("Mercenary (F)", "Cleric") to the app's class ids and the gender they imply. */
const CLASS_ALIASES: Readonly<Record<string, ClassId>> = { cleric: 'priest', 'war-cleric': 'war-monk' };
export const appClass = (saveName: string): { id: ClassId | null; gender: 'M' | 'F' | null } => {
  const g = /\((M|F)\)$/.exec(saveName)?.[1] as 'M' | 'F' | undefined;
  const slug = saveName.replace(/\s*\((M|F)\)$/, '').toLowerCase().replace(/\s+/g, '-');
  const id = (CLASS_ALIASES[slug] ?? (slug in CLASSES ? slug : null)) as ClassId | null;
  return { id, gender: g ?? null };
};

const slug = (s: string) => s.toLowerCase().replace(/\(.*\)/, '').replace(/[^a-z]/g, '');
/** The save's unit names to the app's unit ids; the avatars are Robin. */
export const appUnit = (saveName: string): string | null => {
  if (saveName.startsWith('Avatar')) return 'robin';
  const s = slug(saveName);
  for (const [id, u] of [...Object.entries(FIRST_GEN_UNITS), ...Object.entries(CHILD_UNITS)]) if (slug(u.name) === s) return id;
  return null;
};

export type FinalStats = {
  readonly stats: Readonly<Record<Stat, number>> | null;
  /** Why stats are missing or which unverified rule they rest on. */
  readonly notes: readonly string[];
};

/**
 * Final stat = class base + the unit's additions + gains, capped at the class max + the unit's modifier.
 * Robin's asset/flaw base effect (+2 asset, -1 flaw, -2 for a Luck flaw) is fire-editor's rule and unverified.
 */
export const finalStats = (u: SaveUnit): FinalStats => {
  const notes: string[] = [];
  const cls = appClass(u.className);
  const unitId = appUnit(u.unit);
  const gender = cls.gender ?? (unitId && unitId in FIRST_GEN_UNITS ? FIRST_GEN_UNITS[unitId as keyof typeof FIRST_GEN_UNITS].gender : null);
  const baseEntry = cls.id ? CLASS_BASES[cls.id] : undefined;
  const base = baseEntry?.any ?? (gender ? baseEntry?.[gender] : undefined);
  if (!base) return { stats: null, notes: [`no class base for "${u.className}"`] };
  const additions = [...(ids.units as Record<string, { additions: number[] }>)[String(u.unitId)]?.additions ?? []];
  if (additions.length !== 8) return { stats: null, notes: [`no additions for unit #${u.unitId}`] };

  let modifiers: Partial<Record<Stat, number>> | null = null;
  if (unitId === 'robin' && u.logbook) {
    const a = STATS[u.logbook.asset - 1];
    const f = STATS[u.logbook.flaw - 1];
    if (a) additions[u.logbook.asset - 1] += 2;
    if (f) additions[u.logbook.flaw - 1] -= f === 'lck' ? 2 : 1;
    notes.push('Robin asset/flaw base effect: unverified rule (+2/-1)');
    const m: Record<string, number> = { ...ROBIN_MODIFIERS };
    for (const [k, v] of Object.entries(a ? ASSET_FLAW[a].assetModifier : {})) m[k] = (m[k] ?? 0) + v;
    for (const [k, v] of Object.entries(f ? ASSET_FLAW[f].flawModifier : {})) m[k] = (m[k] ?? 0) + v;
    modifiers = m;
  } else if (unitId && unitId in FIRST_GEN_UNITS) {
    modifiers = FIRST_GEN_UNITS[unitId as keyof typeof FIRST_GEN_UNITS].modifiers;
  } else {
    notes.push('uncapped: modifiers unknown (child or unmapped unit)');
  }

  const clsData = cls.id ? CLASSES[cls.id] : null;
  const maxRaw = clsData?.maxStats as unknown;
  const max = maxRaw && typeof maxRaw === 'object' && 'male' in (maxRaw as object)
    ? gender === 'F' ? (maxRaw as { female: Record<Stat, number> }).female : (maxRaw as { male: Record<Stat, number> }).male
    : (maxRaw as Record<Stat, number> | undefined);

  const stats = Object.fromEntries(STATS.map((s, i) => {
    let v = base.stats[s] + additions[i] + u.gains[s];
    if (max && modifiers) v = Math.min(v, max[s] + (s === 'hp' ? 0 : (modifiers[s] ?? 0)));
    return [s, v];
  })) as Record<Stat, number>;
  return { stats, notes };
};

export const readSave = (slotOrPath: string): Uint8Array => {
  const src = /^[0-2]$/.test(slotOrPath) ? join(SAVE_DIR, `Chapter${slotOrPath}`) : slotOrPath;
  const copy = join(mkdtempSync(join(tmpdir(), 'fe13-snap-')), 'save');
  copyFileSync(src, copy);
  return new Uint8Array(readFileSync(copy));
};

export const main = (args: readonly string[]) => {
  const json = args.includes('--json');
  const target = args.find((a) => a !== '--json') ?? '0';
  const save = parseChapter(decompressSave(readSave(target)));
  const units = Object.entries(save.groups).flatMap(([g, list]) =>
    list.map((u) => ({ group: GROUPS[Number(g)] ?? g, appUnit: appUnit(u.unit), appClass: appClass(u.className).id, ...u, final: finalStats(u) })));
  if (json) {
    console.log(JSON.stringify({ gold: save.gold, renown: save.renown, chaptersCleared: save.chaptersCleared, units }, null, 1));
    return;
  }
  console.log(`gold ${save.gold} · renown ${save.renown} · chapters cleared ${save.chaptersCleared}`);
  for (const u of units) {
    const s = u.final.stats;
    const statLine = s ? STATS.map((k) => `${k} ${s[k]}`).join(' ') : '(no stats)';
    console.log(`\n[${u.group}] ${u.logbook?.name ?? u.unit} · ${u.className} Lv ${u.level} · EXP ${u.exp} · HP ${u.currentHp}`);
    console.log(`  ${statLine}`);
    console.log(`  items: ${u.items.map((i) => `${i.name} (${i.uses})${i.equipped ? '*' : ''}`).join(', ') || '-'}`);
    console.log(`  skills: ${u.equippedSkills.join(', ') || '-'}`);
    for (const n of u.final.notes) console.log(`  note: ${n}`);
  }
};

