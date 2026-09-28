/**
 * Parses a decompressed Awakening Chapter save into ground truth: the army, the dead, gold and renown.
 * Layout from the fire-editor-awakening format notes (see docs/research/awakening-state-capture.md on
 * research/awakening-state-capture), re-implemented here; offsets are US-region.
 */
import ids from './ids.json';

/** Offsets in the `EDNI` index count from the start of the raw file, whose plain header is 0xC0 bytes (US). */
const INDEX_BASE = 0xc0;
const STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'] as const;
export type RawStat = (typeof STATS)[number];

// Unit record: fixed blocks plus two length-prefixed ones (supports, then an unknown block).
const BLOCK1 = 0x1a;
const INVENTORY = 0x19;
const BLOCK2 = 0x10;
const FLAGS = 0x2a;
const LEARNED = 0x0d;
const BLOCK_END = 0x3f;
const LOGBOOK_US = 0x188;
const CHILD = 0x25;
/** Logbook name field (US), then the main block whose first two bytes are asset and flaw. */
const LOGBOOK_NAME_US = 0x1a;

export type SaveItem = { readonly id: number; readonly name: string; readonly uses: number; readonly equipped: boolean };

export type SaveUnit = {
  readonly unitId: number;
  readonly unit: string;
  readonly classId: number;
  readonly className: string;
  readonly level: number;
  readonly exp: number;
  readonly currentHp: number;
  /** Stat points gained over the class base and the unit's own additions: level-ups, boosters, etc. */
  readonly gains: Readonly<Record<RawStat, number>>;
  readonly movementBonus: number;
  readonly position: readonly [number, number];
  readonly items: readonly SaveItem[];
  readonly equippedSkills: readonly string[];
  readonly learnedSkills: readonly string[];
  /** Weapon EXP by the save's weapon order: sword, lance, axe, bow, tome, staff. */
  readonly weaponExp: readonly number[];
  readonly supportPoints: readonly number[];
  /** Robin's logbook, when present: asset/flaw as 1-based indexes into hp..res (0 = none). */
  readonly logbook: { readonly name: string; readonly asset: number; readonly flaw: number } | null;
  readonly hasChildBlock: boolean;
};

export type ChapterSave = {
  readonly gold: number;
  readonly renown: number;
  readonly chaptersCleared: number;
  /** Unit groups: 3 is the army, 4 the dead; 0/1/2/5 only appear in mid-map saves. */
  readonly groups: Readonly<Record<number, readonly SaveUnit[]>>;
};

const name = (table: Record<string, unknown>, id: number): string => {
  const v = table[String(id)];
  if (v === undefined) return `#${id}`;
  return typeof v === 'string' ? v : (v as { name: string }).name;
};

const tag = (b: Uint8Array, at: number): string => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

const u16 = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number): number => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

const utf16 = (b: Uint8Array, at: number, bytes: number): string => {
  let s = '';
  for (let i = 0; i + 1 < bytes; i += 2) {
    const c = u16(b, at + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
};

/** Block start offsets in the body, read from the `EDNI` index (user, map, units, then the rest). */
export const blockOffsets = (body: Uint8Array): number[] => {
  if (tag(body, 0) !== 'EDNI') throw new Error('decompressed save does not start with the EDNI index');
  const out: number[] = [];
  for (let at = 4; at < 0x44; at += 4) {
    const v = u32(body, at);
    if (v === 0) break;
    out.push(v - INDEX_BASE);
  }
  return out;
};

const parseUnit = (b: Uint8Array, start: number): { unit: SaveUnit; end: number } => {
  let at = start;
  const unitId = u16(b, at + 1);
  const classId = b[at + 3];
  const gains = Object.fromEntries(STATS.map((s, i) => [s, b[at + 0x0a + i]])) as Record<RawStat, number>;
  const level = b[at + 0x12];
  const exp = b[at + 0x13];
  const currentHp = b[at + 0x14];
  const movementBonus = b[at + 0x15];
  const position: [number, number] = [b[at + 0x16], b[at + 0x17]];
  at += BLOCK1;

  const items: SaveItem[] = [];
  for (let i = 0; i < 5; i++) {
    const it = at + i * 5;
    const id = u16(b, it + 1);
    if (id !== 0) items.push({ id, name: name(ids.items, id), uses: b[it + 3], equipped: (b[it + 4] & 0x10) !== 0 });
  }
  at += INVENTORY;

  const equippedSkills: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = u16(b, at + i * 2);
    if (id !== 0) equippedSkills.push(name(ids.skills, id));
  }
  const weaponExp = Array.from(b.slice(at + 10, at + 16));
  at += BLOCK2;

  const supportLen = b[at];
  const supportPoints = Array.from(b.slice(at + 1, at + 1 + supportLen));
  at += 1 + supportLen;
  at += 1 + b[at]; // unknown block, seen in map saves
  at += FLAGS;

  // Learned skills: a bitfield, low bit first within each byte, bit n = skill id n.
  const learnedSkills: string[] = [];
  for (let n = 0; n < LEARNED * 8; n++) {
    if (b[at + (n >> 3)] & (1 << (n & 7))) learnedSkills.push(name(ids.skills, n));
  }
  at += LEARNED;
  at += BLOCK_END;

  // The last two bytes of the fixed record flag what follows: 01 06 = a logbook (Robin, avatars), 00 01 = a child block.
  const f0 = b[at - 2];
  const f1 = b[at - 1];
  let logbook: SaveUnit['logbook'] = null;
  let hasChildBlock = false;
  if (f0 === 1 && f1 === 6) {
    const log = at;
    logbook = { name: utf16(b, log, LOGBOOK_NAME_US), asset: b[log + LOGBOOK_NAME_US], flaw: b[log + LOGBOOK_NAME_US + 1] };
    at += LOGBOOK_US;
    if (b[at - 1] === 1) {
      hasChildBlock = true;
      at += CHILD;
    }
  } else if (f0 === 0 && f1 === 1) {
    hasChildBlock = true;
    at += CHILD;
  }

  const unit: SaveUnit = {
    unitId, unit: name(ids.units, unitId), classId, className: name(ids.classes, classId), level, exp, currentHp, gains,
    movementBonus, position, items, equippedSkills, learnedSkills, weaponExp, supportPoints, logbook, hasChildBlock,
  };
  return { unit, end: at };
};

const parseUnits = (b: Uint8Array, start: number, end: number): ChapterSave['groups'] => {
  if (tag(b, start) !== 'TINU') throw new Error(`expected TINU at 0x${start.toString(16)}`);
  const groups: Record<number, SaveUnit[]> = {};
  let at = start + 5;
  for (let g = 0; g <= 5 && at < end; g++) {
    if (b[at] !== g) continue; // an empty group is simply absent
    const count = b[at + 1];
    at += 2;
    const list: SaveUnit[] = [];
    for (let i = 0; i < count; i++) {
      const r = parseUnit(b, at);
      list.push(r.unit);
      at = r.end;
    }
    groups[g] = list;
  }
  return groups;
};

// User block: a 5-byte header, 0x10 bytes (playtime, chapter counters), the cleared-chapter list, then the tail.
const USER_HEADER = 5;
const USER_BLOCK1 = 0x10;
const USER_FIXED = 0xee;
const USER_CHAPTER = 0x10;

const parseUser = (b: Uint8Array, start: number, end: number) => {
  if (tag(b, start) !== 'RESU') throw new Error(`expected RESU at 0x${start.toString(16)}`);
  const chapters = Math.floor((end - start - USER_FIXED) / USER_CHAPTER);
  const block1 = start + USER_HEADER;
  const tail = block1 + USER_BLOCK1 + 1 + chapters * USER_CHAPTER;
  return { chaptersCleared: chapters, gold: u32(b, tail + 0x69), renown: u32(b, tail + 0x6d) };
};

/** Blocks by their 4-char tag, each with its end (the next block's start). Chapter and bookmark saves order them differently. */
export const blocks = (body: Uint8Array): Map<string, { start: number; end: number }> => {
  const offsets = blockOffsets(body);
  return new Map(offsets.map((start, i) => [tag(body, start), { start, end: offsets[i + 1] ?? body.length }]));
};

/** A Chapter save or a bookmark (`Temporary`): the same container, its blocks found by tag. */
export const parseChapter = (body: Uint8Array): ChapterSave => {
  const found = blocks(body);
  const user = found.get('RESU');
  const units = found.get('TINU');
  if (!user || !units) throw new Error(`save lacks RESU/TINU blocks (has ${[...found.keys()].join(', ')})`);
  return { ...parseUser(body, user.start, user.end), groups: parseUnits(body, units.start, units.end) };
};
