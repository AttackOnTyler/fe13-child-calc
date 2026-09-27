/**
 * Reinforcement waves (#178; Spec: Endpoint-first planning #175): the chapter data's reinforcement lines, FEW's free
 * text, read into waves: the turns each joins on a difficulty, the foe groups in it, and any condition kept as text.
 * The generated chapter files stay as FEW writes them; this layer reads them, so a regenerate needs no hand edits.
 *
 * FEW writes a wave as a header (`Turn 5 (Hard/Lunatic)/6 (Normal)`, `Turns 3 and 5`, `On the turn after Severa speaks
 * with Holland`) and one indented line per group (`2 (Normal/Hard)/3 (Lunatic) Wyvern Riders with Steel Axes
 * (Normal/Hard)/Silver Axes (Lunatic) from …`, a trailing `(Lunatic only)`), with notes nested under a group. A line
 * this can't read is kept in `unparsed`, text and all, never dropped.
 *
 * Each group gets a foe the map solver can fight (`foeOf`): FEW gives no stats for reinforcements, so they are the
 * chapter data's own group of that class on the difficulty (the one with the same weapon, else the highest level),
 * with the wave's weapon and count. Apotheosis's waves are its enemy tabs, with their own stats.
 */
import type { BossRow, ChapterData, ChapterDifficulty, EnemyGroup, MapItem } from '../game-data/chapters';
import { MAPS } from '../game-data/chapters';
import { itemByName } from '../game-data/items';
import { foeOf, statValue, type Foe } from './solver';

/** One group of like foes in a wave. */
export type WaveGroup = {
  readonly count: number;
  /** The class, as the chapter data names it (singular). */
  readonly class: string;
  /** A named foe (Lost Bloodlines' Einherjar, Validar returning). */
  readonly name?: string;
  /** Its weapons and drops on this difficulty, as FEW lists them. */
  readonly items: readonly MapItem[];
  /** Where it appears. */
  readonly from?: string;
  /** A note FEW nests under the group. */
  readonly note?: string;
  readonly boss?: boolean;
  /**
   * The chapter data's enemy table lists it among the starting foes: count it once. A named arrival whose row is past
   * FEW's reinforcement divider (Lost Bloodlines' turn-1 arrivals) isn't: it comes with its wave (#184).
   */
  readonly inEnemyTable?: boolean;
  /**
   * The group as a foe for the map solver, `count` included; undefined when the map has no group of that class on the
   * difficulty to take stats from.
   */
  readonly foe: Foe | undefined;
};

/** A batch of reinforcements on one difficulty. */
export type Wave = {
  /** FEW's header, or Apotheosis's wave name. */
  readonly label: string;
  /** The turns it joins on (each of them, for `Turns 3–5`); empty when it joins on a condition. */
  readonly turns: readonly number[];
  /** Unlimited reinforcements: they join every turn from this one until the map ends. */
  readonly everyTurnFrom?: number;
  /** Unlimited reinforcements: how many join each turn, from the kinds in `groups`; null where FEW doesn't say. */
  readonly perTurn?: number | null;
  /** What sets it off, as FEW writes it. */
  readonly condition?: string;
  readonly groups: readonly WaveGroup[];
  readonly notes: readonly string[];
};

/** A map's waves on one difficulty, sorted by turn (conditional ones last), its notes, and any line not read. */
export type MapWaves = {
  readonly waves: readonly Wave[];
  readonly notes: readonly string[];
  readonly unparsed: readonly string[];
};

const DIFFS: readonly ChapterDifficulty[] = ['normal', 'hard', 'lunatic'];

/** `Hard/Lunatic only` → hard, lunatic; undefined unless every part names a difficulty. */
function difficultiesIn(text: string): ChapterDifficulty[] | undefined {
  const parts = text.replace(/\s*only\s*$/i, '').split('/').map((p) => p.trim().toLowerCase());
  return parts.length && parts.every((p) => (DIFFS as readonly string[]).includes(p)) ? (parts as ChapterDifficulty[]) : undefined;
}

/**
 * FEW's per-difficulty alternatives, `Iron Axe (Normal)/Steel Axe (Hard)/Silver Axe (Lunatic)`: the one for the
 * difficulty, undefined if none is; text without alternatives comes back as it is.
 */
function pick(text: string, d: ChapterDifficulty): string | undefined {
  const t = text.trim();
  if (!/\((?:Normal|Hard|Lunatic)[^)]*\)/.test(t)) return t;
  for (const m of t.matchAll(/\s*\/?\s*([^()/]+?)\s*\(([^)]*)\)/g)) if (difficultiesIn(m[2]!)?.includes(d)) return m[1]!.trim();
  return undefined;
}

/** The turns a header gives each difficulty, or undefined when it isn't a turn header. */
function headerTurns(header: string): Map<ChapterDifficulty, number[]> | undefined {
  const rest = header.replace(/^At the start of /i, '');
  if (!/^Turns? \d/i.test(rest)) return undefined;
  const seg = /\s*\/?\s*(?:Turns?\s*)?(\d+)(?:\s*(–|-|and)\s*(\d+))?\s*(?:\(([^)]*)\))?/iy;
  const out = new Map<ChapterDifficulty, number[]>();
  let any = false;
  let all: number[] | undefined;
  seg.lastIndex = 0;
  while (seg.lastIndex < rest.length) {
    const m = seg.exec(rest);
    if (!m) return undefined;
    const a = +m[1]!;
    const b = m[3] ? +m[3] : undefined;
    const turns = b === undefined ? [a] : m[2] === 'and' ? [a, b] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
    if (m[4] === undefined) {
      all = turns;
      continue;
    }
    const ds = difficultiesIn(m[4]);
    if (!ds) return undefined;
    any = true;
    for (const d of ds) out.set(d, turns);
  }
  if (!any && all) for (const d of DIFFS) out.set(d, all);
  return out;
}

/** Every class the chapter data names, for turning FEW's plurals (`Heroes`, `Warrior(s)`) back into class names. */
const CLASS_NAMES = new Set(MAPS.flatMap((m) => [...Object.values(m.enemies).flat(), ...Object.values(m.bosses).flat()].map((g) => g!.class)));

function singularClass(text: string): string | undefined {
  const t = text.replace(/\((?:es|s)\)$/, '').trim();
  return [t, t.replace(/es$/, ''), t.replace(/s$/, '')].find((c) => CLASS_NAMES.has(c));
}

/** An item as the item data names it: `an Iron Axe` → Iron Axe, `Silver Axes` → Silver Axe, `Silver Sword(s)`. */
function singularItem(text: string): string {
  const t = text.replace(/^(?:a|an)\s+/i, '').replace(/\*/g, '').replace(/\((?:es|s)\)$/, '').trim();
  return [t, t.replace(/es$/, ''), t.replace(/s$/, '')].find((n) => itemByName(n)) ?? t;
}

type Draft = Omit<WaveGroup, 'foe'> & { readonly source?: EnemyGroup | BossRow };
const FAIL = { fail: true } as const;
const ABSENT = { absent: true } as const;
type Read = { readonly group: Draft } | typeof ABSENT | typeof FAIL;

/** A named foe from the map's own tables (enemies first, then bosses). */
function named(map: ChapterData, d: ChapterDifficulty, name: string): Draft | undefined {
  const enemy = (map.enemies[d] ?? []).find((g) => g.name === name);
  if (enemy) return { count: 1, class: enemy.class, name, items: enemy.items, ...(enemy.reinforcement ? {} : { inEnemyTable: true }), source: enemy };
  const boss = (map.bosses[d] ?? []).find((b) => b.name === name);
  return boss ? { count: 1, class: boss.class, name, items: boss.items, boss: true, source: boss } : undefined;
}

/** One indented group line on a difficulty: `N Class with Weapon that drops Item from Place`. */
function readGroup(map: ChapterData, d: ChapterDifficulty, line: string): Read {
  let text = line.trim();
  const only = /\s*\(([^()]*only)\)\s*$/i.exec(text);
  if (only) {
    const ds = difficultiesIn(only[1]!);
    if (!ds) return FAIL;
    if (!ds.includes(d)) return ABSENT;
    text = text.slice(0, only.index);
  }
  // Chapter 21: `Each turn, 1 Sorcerer with Mire will appear from one of …`.
  text = text.replace(/^Each turn,\s*/i, '').replace(/\s+will appear\s+/i, ' ');
  const count = /^(\d+(?:\s*\([^)]*\))?(?:\/\d+\s*\([^)]*\))*)\s+(.*)$/.exec(text);
  if (!count) return FAIL;
  const n = parseInt(pick(count[1]!, d) ?? '', 10);
  if (!n) return ABSENT;
  const [main, spread] = count[2]!.split(/;\s*/, 2) as [string, string | undefined];
  const parts = /^(.+?)(?:\s+with\s+(.+?))?(?:\s+that drops\s+(.+?))?(?:\s+(?:(?:one|two|three)\s+)?from\s+(.+))?$/.exec(main);
  if (!parts) return FAIL;
  const cls = singularClass(parts[1]!);
  if (!cls) return FAIL;
  const items: MapItem[] = [];
  for (const w of parts[2]?.split(/\s+and\s+/) ?? []) {
    const name = pick(w, d);
    if (name) items.push({ name: singularItem(name) });
  }
  if (parts[3]) items.push({ name: singularItem(parts[3]), drop: true });
  // Chapter 21 goes on after the place: `… beyond the walls. The first appears from …` is kept as a note.
  const [from, ...more] = (parts[4]?.trim() ?? spread?.trim() ?? '').split(/(?<=\.)\s+/);
  const note = more.join(' ');
  return { group: { count: n, class: cls, items, ...(from ? { from: from.replace(/\.$/, '') } : {}), ...(note ? { note } : {}) } };
}

/** A group line: counted groups, or named foes (`Ethlyn and Quan from …`, `The Risen Chief appears …`), one group each. */
function readGroups(map: ChapterData, d: ChapterDifficulty, line: string): { readonly groups: Draft[] } | typeof ABSENT | typeof FAIL {
  const text = line.trim();
  if (!/^\d/.test(text.replace(/^Each turn,\s*/i, ''))) {
    const m = /^(?:The\s+)?(.+?)\s+(?:from|appears)\s+(.*)$/.exec(text);
    if (!m) return FAIL;
    const groups = m[1]!.split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map((n) => named(map, d, n));
    return groups.every((g) => g) ? { groups: groups.map((g) => ({ ...g!, from: m[2]!.trim() })) } : FAIL;
  }
  const r = readGroup(map, d, line);
  return 'group' in r ? { groups: [r.group] } : r;
}

/**
 * The chapter data's group to take a wave group's stats from: same class, same weapon if one has it, else highest
 * level; FEW's own reinforcement rows first (#184), and never a boss's row while another will do (Death's Embrace's
 * Berserkers aren't Algol).
 */
function statSource(map: ChapterData, d: ChapterDifficulty, g: Draft): EnemyGroup | BossRow | undefined {
  if (g.source) return g.source;
  const bosses = new Set((map.bosses[d] ?? []).map((b) => `${b.class}|${statValue(b.stats.hp)}`));
  const all = (map.enemies[d] ?? []).filter((e) => e.class === g.class);
  const plain = all.filter((e) => !bosses.has(`${e.class}|${statValue(e.stats.hp)}`));
  const pool = plain.length ? plain : all;
  const reinforcing = pool.filter((e) => e.reinforcement);
  const weapons = new Set(g.items.map((i) => i.name));
  for (const same of [reinforcing, pool]) {
    const hit = same.find((e) => e.items.some((i) => weapons.has(i.name)));
    if (hit) return hit;
  }
  const by = reinforcing.length ? reinforcing : pool;
  return [...by].sort((a, b) => statValue(b.level) - statValue(a.level))[0];
}

const isWeapon = (name: string) => ['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone'].includes(itemByName(name)?.kind ?? '');

function finish(map: ChapterData, d: ChapterDifficulty, g: Draft): WaveGroup {
  const { source: _, ...group } = g;
  const base = statSource(map, d, g);
  // The wave's weapon when FEW names one; else the base group's weapons, and any drop.
  const armed = g.items.some((i) => isWeapon(i.name));
  const foe = base ? { ...foeOf({ ...base, items: armed ? g.items : [...base.items, ...g.items] }, !!g.boss), count: g.count } : undefined;
  return { ...group, foe };
}

/** The map's starting enemy groups on a difficulty, bosses left out (as `foesOf` does). */
function startingGroups(map: ChapterData, d: ChapterDifficulty): readonly EnemyGroup[] {
  const bosses = new Set((map.bosses[d] ?? []).map((b) => `${b.class}|${statValue(b.stats.hp)}`));
  return (map.enemies[d] ?? []).filter((e) => !e.reinforcement && !bosses.has(`${e.class}|${statValue(e.stats.hp)}`));
}

type Line = { readonly indent: number; readonly text: string };

/** Apotheosis: its waves are its enemy tabs; each comes after the one before on its route. */
function apotheosisWaves(map: ChapterData, d: ChapterDifficulty): Wave[] {
  const enemies = map.enemies[d] ?? [];
  const labels = [...new Set(enemies.map((e) => e.wave).filter((w): w is string => !!w && w !== 'Wave 1'))];
  const bosses = (map.bosses[d] ?? []).map((b) => `${b.class}|${statValue(b.stats.hp)}|${b.wave}`);
  const numberOf = (l: string) => parseInt(/\d+/.exec(l)![0], 10);
  return labels.map((label) => {
    const secret = /^Secret/i.test(label);
    const k = numberOf(label);
    const variants = labels.filter((l) => !/^Secret/i.test(l) && numberOf(l) === k).length;
    const before = secret ? (k === 1 ? 'Wave 1' : `Secret wave ${k - 1}`) : `Wave ${k - 1}`;
    const condition = `${secret ? 'Secret' : 'Normal'} route, after ${before}${!secret && variants > 1 ? ' (one of two versions, the player’s choice)' : ''}`;
    const groups = enemies
      .filter((e) => e.wave === label)
      .map((e) => finish(map, d, { count: parseInt(e.count, 10) || 1, class: e.class, items: e.items, boss: bosses.includes(`${e.class}|${statValue(e.stats.hp)}|${label}`), source: e }));
    return { label, turns: [], condition, groups, notes: [] };
  });
}

/** A map's reinforcement waves on a difficulty. */
export function mapWaves(map: ChapterData, d: ChapterDifficulty): MapWaves {
  if (map.id === 'apotheosis') return { waves: apotheosisWaves(map, d), notes: [], unparsed: [] };
  const lines: Line[] = map.reinforcements.map((r) => ({ indent: r.length - r.trimStart().length, text: r.trim() }));
  const waves: Wave[] = [];
  const notes: string[] = [];
  const unparsed: string[] = [];
  let unlimited: { wave: Wave; groups: Draft[] } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const { text } = lines[i]!;
    const block: Line[] = [];
    while (lines[i + 1] && lines[i + 1]!.indent > 0) block.push(lines[++i]!);
    const turns = headerTurns(text);
    const condition = /^On the turn after /i.test(text) ? text : undefined;
    if (turns || condition) {
      if (turns && !turns.has(d)) continue;
      const groups: Draft[] = [];
      // A note nested under a group goes with it, and is dropped with a group absent on this difficulty.
      let skipNote = false;
      for (const l of block) {
        if (l.indent > 2) {
          const last = groups[groups.length - 1];
          if (last && !skipNote) groups[groups.length - 1] = { ...last, note: last.note ? `${last.note} ${l.text}` : l.text };
          continue;
        }
        skipNote = false;
        const r = readGroups(map, d, l.text);
        if ('fail' in r) unparsed.push(l.text);
        else if ('groups' in r) groups.push(...r.groups);
        else skipNote = true;
      }
      if (groups.length) waves.push({ label: text, turns: turns?.get(d) ?? [], ...(condition ? { condition } : {}), groups: groups.map((g) => finish(map, d, g)), notes: [] });
      continue;
    }
    const note = /^Note:\s*(.*)$/.exec(text);
    if (note) {
      notes.push(note[1]!);
      continue;
    }
    // Chapter 23: `After Validar is defeated once, he will reappear south of the easternmost stairs.`
    const returns = /^(After (.+?) is defeated once), (?:he|she) will reappear (.+?)\.?$/.exec(text);
    if (returns && named(map, d, returns[2]!)) {
      const g = named(map, d, returns[2]!)!;
      waves.push({ label: text, turns: [], condition: returns[1]!, groups: [finish(map, d, { ...g, from: returns[3]! })], notes: [] });
      continue;
    }
    // Unlimited reinforcements (Endgame, Future Past 3): prose, read for when they start and how many come.
    const endless = /\b(?:unlimited|infinite) in number\b/i.test(text);
    if (endless) {
      const start = /starting on turn (\d+)/i.exec(text);
      const wave: Wave = { label: text, turns: [], everyTurnFrom: start ? +start[1]! : undefined, perTurn: null, groups: [], notes: [text] };
      // `the same weapon setup as the initial units of their classes`: the kinds are the map's starting groups.
      const kinds: Draft[] = /same weapon setup as the initial units/i.test(text) ? startingGroups(map, d).map((e) => ({ count: 1, class: e.class, items: e.items, source: e })) : [];
      unlimited = { wave, groups: kinds };
      continue;
    }
    // Endgame: `On turn 2, reinforcements will appear from the four sigils …; On Lunatic mode, … an additional set of four sigils`.
    const sigils = /^On turn (\d+), reinforcements will appear from the (\w+) sigils(?:.*?On Lunatic mode,.*?additional set of (\w+) sigils)?/i.exec(text);
    const WORDS: Readonly<Record<string, number>> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    if (unlimited && sigils && WORDS[sigils[2]!.toLowerCase()]) {
      const base = WORDS[sigils[2]!.toLowerCase()]!;
      const extra = sigils[3] ? WORDS[sigils[3].toLowerCase()] ?? 0 : 0;
      unlimited.wave = { ...unlimited.wave, everyTurnFrom: +sigils[1]!, perTurn: base + (d === 'lunatic' ? extra : 0), notes: [...unlimited.wave.notes, text, 'Read as one foe per sigil.'] };
      continue;
    }
    // Future Past 3: `Enemies that spawn from the sigils include:` and one kind per nested line.
    const include = /^Enemies that spawn from (.+?) include:$/i.exec(text);
    if (unlimited && include) {
      for (const l of block) {
        const m = /^(.+?) with (.+)$/.exec(l.text);
        const cls = m && singularClass(m[1]!);
        if (!m || !cls) {
          unparsed.push(l.text);
          continue;
        }
        // The first weapon listed: `Silver Axes, or Brave Axes* (Normal)/Silver Axes* (Hard/Lunatic) and Tomahawks`.
        const first = pick(m[2]!.split(/,\s*|\s+or\s+|\s+and\s+/)[0]!, d);
        unlimited.groups.push({ count: 1, class: cls, items: first ? [{ name: singularItem(first) }] : [], from: include[1]!, note: l.text });
      }
      continue;
    }
    unparsed.push(text, ...block.map((l) => l.text));
  }
  if (unlimited) waves.push({ ...unlimited.wave, groups: unlimited.groups.map((g) => finish(map, d, g)) });
  const firstTurn = (w: Wave) => w.turns[0] ?? w.everyTurnFrom ?? Infinity;
  return { waves: waves.map((w, i) => [w, i] as const).sort(([a, i], [b, j]) => firstTurn(a) - firstTurn(b) || i - j).map(([w]) => w), notes, unparsed };
}
