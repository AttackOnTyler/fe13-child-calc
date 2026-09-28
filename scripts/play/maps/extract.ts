/**
 * Extracts every story map's and paralogue's terrain grid and placements from the user's own romfs into
 * `src/game-data/maps/`. Only derived facts are written; the romfs itself stays outside the repo.
 *
 *   ctrtool -p --ncch=0 --romfsdir=<scratch>/romfs "<the decrypted .cci>"    (about 15 s, 1.1 GB, outside the repo)
 *   npx vite-node scripts/play/maps/extract.ts <scratch>/romfs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bin, messages } from './rom';

const romfs = process.argv[2];
if (!romfs) throw new Error('usage: extract.ts <romfs dir>');
const OUT = join(__dirname, '../../../src/game-data/maps');

/** One printable char per terrain index (71 in the US game). */
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+-=?@^~';

/** ROM chapter ids to the app's map ids; the Premonition borrows Chapter 23's terrain. */
const chapters: { rom: string; id: string; terrain: string }[] = [
  { rom: 'P001', id: 'premonition', terrain: '023' },
  { rom: 'P002', id: 'prologue', terrain: 'P002' },
  ...Array.from({ length: 25 }, (_, i) => {
    const rom = String(i + 1).padStart(3, '0');
    return { rom, id: `chapter-${i + 1}`, terrain: rom };
  }),
  { rom: '026', id: 'endgame', terrain: '026' },
  ...Array.from({ length: 23 }, (_, i) => {
    const rom = `X${String(i + 1).padStart(3, '0')}`;
    return { rom, id: `paralogue-${i + 1}`, terrain: rom };
  }),
];

const game = Bin.load(join(romfs, 'data/GameData.bin.lz'));
const text = messages(join(romfs, 'm/E/GameData.bin.lz'));

// Terrain types: 71 records of 28 bytes; the category pointer indexes TerrainCategoryData (4 bytes each).
const TERRAIN_RECORD = 28;
const terrainAt = game.label('TerrainData');
const categoryAt = game.label('TerrainCategoryData');
const terrainCount = game.u32(game.label('TerrainDataNum'));
const terrain = Array.from({ length: terrainCount }, (_, i) => {
  const at = terrainAt + i * TERRAIN_RECORD;
  const key = game.str(at + 4) ?? '';
  return { index: i, char: CHARS[i], key: game.str(at) ?? '', name: text.get(key) ?? key, category: ((game.ptr(at + 8) ?? categoryAt) - categoryAt) / 4 };
});
const categoryCount = game.u32(game.label('TerrainCostData'));
const categories = Array.from({ length: categoryCount }, (_, c) => ({
  def: game.u8(categoryAt + c * 4), avo: game.u8(categoryAt + c * 4 + 1), heal: game.u8(categoryAt + c * 4 + 2),
}));
// Movement costs: u32 column count, then rows of that many costs padded to 4; 0xFF = impassable.
const costAt = game.label('TerrainCostData') + 4;
const stride = (categoryCount + 3) & ~3;
const jobs = [...game.labels].filter(([k]) => k.startsWith('JID_')).sort((a, b) => a[1] - b[1]);
const jobStride = jobs[1][1] - jobs[0][1];
const classRows = new Map<string, number>();
for (const [, at] of jobs) {
  const key = game.str(at + 0x10);
  const name = key ? text.get(key) : undefined;
  if (name && !classRows.has(name)) classRows.set(name, game.u8(at + 0x50));
}
const rowCount = Math.max(...classRows.values()) + 1;
/** Each class id (`JID_*`) to its English name. */
const jobNames = new Map(jobs.flatMap(([jid, at]) => {
  const key = game.str(at + 0x10);
  const name = key ? text.get(key) : undefined;
  return name ? [[jid, name] as const] : [];
}));
/** A person file's people (`data/person/<name>`): each `PID_*` to its class's English name. */
const peopleIn = (file: string): Map<string, string> => {
  const path = join(romfs, `data/person/${file}.bin.lz`);
  if (!existsSync(path)) return new Map();
  const p = Bin.load(path);
  const out = new Map<string, string>();
  for (const q of p.pointers) {
    const pid = p.str(q);
    const jid = pid?.startsWith('PID_') ? p.str(q + 8) : null;
    const name = jid ? jobNames.get(jid) : undefined;
    if (pid && name) out.set(pid, name);
  }
  return out;
};
/** The named characters every chapter shares (`static`), then a chapter's own people. */
const STATIC_PEOPLE = peopleIn('static');
const peopleOf = (rom: string): Map<string, string> => new Map([...STATIC_PEOPLE, ...peopleIn(rom)]);
const moveCosts = Array.from({ length: rowCount }, (_, r) =>
  Array.from({ length: categoryCount }, (_, c) => { const v = game.u8(costAt + r * stride + c); return v === 0xff ? null : v; }));

const ts = (v: unknown) => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ');

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'terrain.ts'), `/**
 * Awakening's terrain types, their Def/Avo/Heal, and movement cost per movement row, from the game's own GameData
 * (extracted by scripts/play/maps/extract.ts on play/azahar-harness). Don't hand-edit: re-extract.
 * A map grid's char is a terrain type's \`char\`; a class's movement row is CLASS_MOVE_ROW; null cost = impassable.
 */
export const TERRAIN = ${JSON.stringify(terrain, null, 1)} as const;

export const TERRAIN_CATEGORIES = ${ts(categories)} as const;

export const MOVE_COSTS: readonly (readonly (number | null)[])[] = ${ts(moveCosts)};

/** The game's English class names to their movement row. */
export const CLASS_MOVE_ROW: Readonly<Record<string, number>> = ${JSON.stringify(Object.fromEntries(classRows), null, 1)};
`);

// Placements: a faction list of {ptr name, ptr table, u32 count}, then 0x74-byte records.
const SPAWN = 0x74;
const difficulties = (f1: number, f2: number) => {
  const d = [f1 & 0x40 && 'normal', f1 & 0x80 && 'hard', f2 & 0x01 && 'lunatic'].filter(Boolean) as string[];
  return d.length ? d : ['normal', 'hard', 'lunatic'];
};
const index: string[] = [];
for (const ch of chapters) {
  const t = Bin.load(join(romfs, `data/terrain/${ch.terrain}.bin.lz`));
  const width = t.u32(0);
  const height = t.u32(4);
  const rows = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => CHARS[t.u8(8 + y * 32 + x)]).join(''));
  const d = Bin.load(join(romfs, `data/dispos/${ch.rom}.bin.lz`));
  const spawns: object[] = [];
  const people = peopleOf(ch.rom);
  for (let f = 0; d.ptr(f * 12) !== null; f++) {
    const faction = d.str(f * 12);
    const table = d.ptr(f * 12 + 4);
    const count = d.u32(f * 12 + 8);
    if (table === null) continue;
    for (let i = 0; i < count; i++) {
      const at = table + i * SPAWN;
      const f1 = d.u8(at + 0x10);
      const f2 = d.u8(at + 0x11);
      const team = ['player', 'enemy', 'ally'][d.u8(at + 0x14)] ?? d.u8(at + 0x14);
      // The AI commands (#261, research #254 §1.1): action (when it starts moving), mission, attack and move, each with its
      // param; 0x69 the band (group) that wakes together; flags2 0x10 can't move, 0x08 boss.
      const ai = () => {
        const cmd = (off: number, prefix: string) => d.str(at + off)?.replace(prefix, '') || undefined;
        const param = (off: number) => d.str(at + off) || undefined;
        const out: Record<string, string> = {};
        for (const [k, off, prefix] of [['start', 0x44, 'AI_AC_'], ['mission', 0x4c, 'AI_MI_'], ['attack', 0x54, 'AI_AT_'], ['move', 0x5c, 'AI_MV_']] as const) {
          const c = cmd(off, prefix);
          if (c) out[k] = c;
          const p = param(off + 4);
          if (p) out[`${k}Param`] = p;
        }
        return Object.keys(out).length ? { ai: out } : {};
      };
      // Its class (the chapter's person file) and the items the placement lists (the Normal-tier weapons; harder
      // difficulties upgrade them in the game, and the chapter data carries those).
      const unit = () => {
        const pid = d.str(at);
        const items = Array.from({ length: 5 }, (_, k) => d.str(at + 0x1c + k * 8)).flatMap((iid) => (iid ? [text.get(`M${iid}`) ?? iid] : []));
        const cls = pid ? people.get(pid) : undefined;
        return { ...(cls ? { class: cls } : {}), ...(items.length ? { items } : {}) };
      };
      spawns.push({
        faction, pid: d.str(at), team,
        at: [d.u8(at + 0x16), d.u8(at + 0x17)], to: [d.u8(at + 0x18), d.u8(at + 0x19)],
        difficulties: difficulties(f1, f2), ...(f1 & 0x10 ? { deploySlot: true } : {}), ...(f1 & 0x02 ? { forced: true } : {}),
        ...(team === 'player' ? {} : { ...unit(), ...ai(), group: d.u8(at + 0x69), ...(f2 & 0x10 ? { stationary: true } : {}), ...(f2 & 0x08 ? { boss: true } : {}) }),
      });
    }
  }
  const name = text.get(`MCID_${ch.rom}`) ?? ch.id;
  const constName = `MAP_${ch.id.toUpperCase().replace(/-/g, '_')}`;
  writeFileSync(join(OUT, `${ch.id}.ts`), `/** ${name}: terrain (chars index TERRAIN in ./terrain) and placements, from the game's own map data (ROM ${ch.rom}, terrain ${ch.terrain}). Don't hand-edit: re-extract. */
export const ${constName} = {
 id: '${ch.id}', rom: '${ch.rom}', terrainFile: '${ch.terrain}', width: ${width}, height: ${height},
 rows: ${JSON.stringify(rows, null, 2).replace(/\n/g, '\n ')},
 spawns: [
${spawns.map((s) => `  ${JSON.stringify(s)},`).join('\n')}
 ],
} as const;
`);
  index.push(`export { ${constName} } from './${ch.id}';`);
}
writeFileSync(join(OUT, 'index.ts'), `// Generated by scripts/play/maps/extract.ts.\nexport * from './terrain';\n${index.join('\n')}\n`);
console.log(`${chapters.length} maps, ${terrain.length} terrain types, ${categoryCount} categories, ${rowCount} movement rows, ${classRows.size} classes`);
