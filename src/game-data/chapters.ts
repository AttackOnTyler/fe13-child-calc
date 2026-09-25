/**
 * Chapter data (#109; Map: Route planner #87): cited facts for every map on every difficulty. One record per map, from
 * Fire Emblem Wiki's chapter page at a fixed revision (oldid), cross-checked against Serenes Forest's boss data, shops,
 * merchants and item locations (research/chapter-data, #90). Stats and counts keep FEW's text: Normal and Hard enemies
 * get random growths, so FEW prints their stats as `min~max` ranges; Lunatic stats are fixed.
 *
 * Lunatic+ is Lunatic plus a rule (LUNATIC_PLUS), not separate enemy data.
 */
import { EARLY_MAPS } from './chapters/early';
import { CHAPTERS_7_12 } from './chapters/ch07-12';
import { CHAPTERS_13_19 } from './chapters/ch13-19';

export type ChapterDifficulty = 'normal' | 'hard' | 'lunatic';
export const CHAPTER_DIFFICULTIES: readonly ChapterDifficulty[] = ['normal', 'hard', 'lunatic'];

export type MapKind = 'story' | 'paralogue' | 'xenologue';

export type StatText = Readonly<Record<'hp' | 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res' | 'mov', string>>;
export type MapItem = { readonly name: string; readonly drop?: boolean; readonly forged?: boolean };

/** A group of like enemies on one difficulty: FEW's `ChapUnitCellFE13` row. */
export type EnemyGroup = {
  readonly name: string;
  readonly class: string;
  readonly level: string;
  /** How many, as FEW writes it (with any hover note). */
  readonly count: string;
  readonly stats: StatText;
  readonly items: readonly MapItem[];
  readonly skills?: readonly string[];
  /** e.g. `Can have 0–1 skill(s) at random`. */
  readonly randomSkills?: string;
  /** Movement triggers and AI, e.g. `Begins moving unprovoked on turn 3`. */
  readonly notes?: string;
};

export type BossRow = {
  /** From SF's boss data, which names every boss (FEW's boss blocks don't). */
  readonly name?: string;
  readonly class: string;
  readonly level: string;
  readonly stats: StatText;
  readonly items: readonly MapItem[];
  readonly skills: readonly string[];
};

export type MapConditions = {
  readonly victory: string;
  readonly defeat: string;
  /** Deploy count as FEW writes it: a count or range, with mid-map joins. */
  readonly deploy: string;
  readonly enemies: string;
};

export type ChapterData = {
  readonly id: string;
  readonly kind: MapKind;
  /** Where it sits in the Maps list. */
  readonly order: number;
  /** e.g. `Chapter 4` or `Prologue`. */
  readonly label: string;
  readonly title: string;
  readonly location?: string;
  readonly conditions: Readonly<Partial<Record<ChapterDifficulty, MapConditions>>>;
  readonly recruits: readonly { readonly unit: string; readonly class: string; readonly level: string; readonly how: string | null }[];
  readonly forced: readonly string[];
  readonly items: readonly { readonly item: string; readonly how: string }[];
  readonly shop: {
    readonly location: string;
    /** The armory opens after this map is cleared. */
    readonly opensAfter: string | null;
    readonly armory: readonly { readonly item: string; readonly cost: number | null }[];
    /** A merchant's extra pool: it sells three of these at random. */
    readonly merchant: readonly { readonly item: string; readonly cost: number | null }[];
  } | null;
  readonly eventTiles: number;
  readonly enemies: Readonly<Partial<Record<ChapterDifficulty, readonly EnemyGroup[]>>>;
  /** FEW's reinforcement list, one line per turn or group (nested lines indented), difficulty notes kept. */
  readonly reinforcements: readonly string[];
  /** The Lunatic+ skill pool the page prints (none on Premonition). */
  readonly lunaticPlusPool: readonly string[];
  readonly bosses: Readonly<Partial<Record<ChapterDifficulty, readonly BossRow[]>>>;
  /** What clearing it opens next. */
  readonly unlocks: readonly string[];
  /** A grind map (Golden Gaffe, EXPonential Growth, Infinite Regalia): never offered as a next map. */
  readonly grind?: boolean;
  readonly source: { readonly page: string; readonly oldid: number };
};

/**
 * Lunatic+: Lunatic enemies plus two extra skills each, at random from the pool; before Chapter 3 the pool leaves out
 * Counter, Aegis+ and Pavise+ (FEW Difficulty, oldid 737046; every FEW chapter page prints its pool). When the two are
 * rolled, whether the draw is uniform and whether bosses get them isn't published: show them as possibilities.
 */
export const LUNATIC_PLUS = {
  extraSkills: 2,
  pool: ['Pass', 'Hawkeye', 'Luna+', 'Vantage+', 'Counter', 'Aegis+', 'Pavise+'],
  notBefore: { skills: ['Counter', 'Aegis+', 'Pavise+'], map: 'chapter-3' },
  source: 'FEW Difficulty (oldid 737046)',
} as const;

/** The Lunatic+ pool on a map: the whole pool from Chapter 3 on, the four-skill pool before. */
export function lunaticPlusPoolFor(map: ChapterData): readonly string[] {
  if (map.kind !== 'story' || map.order >= mapOrder(LUNATIC_PLUS.notBefore.map)) return LUNATIC_PLUS.pool;
  return LUNATIC_PLUS.pool.filter((s) => !(LUNATIC_PLUS.notBefore.skills as readonly string[]).includes(s));
}

/**
 * When reinforcements appear (FEW Reinforcement, oldid 699855; Difficulty): on Normal at the start of a turn, before
 * player phase; on Hard and up at the start of enemy phase, and they can act that turn (ambush spawns), sometimes on
 * earlier turns than on Normal.
 */
export const REINFORCEMENT_RULE: Readonly<Record<'normal' | 'hard+', string>> = {
  normal: 'Reinforcements appear at the start of a turn, before player phase.',
  'hard+': 'Reinforcements appear at the start of enemy phase and can act that turn (ambush spawns), sometimes on earlier turns than on Normal.',
};

/**
 * Seals (research/chapter-data §6; SF shops and merchants): Master Seals from the Port Ferox armory after Chapter 12,
 * Second Seals from the Mila Tree armory after Chapter 16. Before that, merchants from the Prologue through Chapter 10
 * (and Paralogues 1–3) can offer either, but a merchant appears at random and sells three random picks, so a plan can't
 * count on them. The preparations shop is disabled on Hard and up.
 */
export const SEAL_RULES = {
  masterSeal: { armoryAfter: 'chapter-12', location: 'Port Ferox' },
  secondSeal: { armoryAfter: 'chapter-16', location: 'Mila Tree' },
  merchantsUntil: 'chapter-10',
  prepShopOnHardUp: false,
} as const;

/** A chapter-data disagreement between FEW and SF (research/chapter-data §7): the value used, and whether it's settled. */
export type ChapterDisagreement = {
  readonly id: string;
  readonly map: string;
  readonly item: string;
  readonly used: string;
  readonly other: string;
  readonly status: 'resolved' | 'open';
  readonly why: string;
};

export const CHAPTER_DISAGREEMENTS: readonly ChapterDisagreement[] = [
  {
    id: 'C11',
    map: 'chapter-5',
    item: 'Lunatic reinforcement turns',
    used: 'FEW: turns 3, 4 (Hard/Lunatic only: 2 Wyvern Riders) and 5',
    other: 'SF wiki: turns 3, 5 and 6',
    status: 'open',
    why: 'FEW is the primary source; no independent third source was read (kamikouryaku.com is the tie-breaker). Check in game.',
  },  {
    id: 'C6',
    map: 'chapter-9',
    item: 'Campari’s Hard weapon',
    used: 'FEW: Short Spear',
    other: 'SF boss data: Short Axe',
    status: 'resolved',
    why: 'SF’s own Normal and Lunatic rows give Short Spear; its Hard row is the odd one out.',
  },
  {
    id: 'C13',
    map: 'chapter-11',
    item: 'Spirit Dust',
    used: 'FEW: dropped by an enemy Sage',
    other: 'SF item locations: a chest',
    status: 'open',
    why: 'No third source was read. Check in game.',
  },  {
    id: 'C14',
    map: 'chapter-18',
    item: 'Killer Lance',
    used: 'FEW: an enemy drop',
    other: 'SF item locations: a chest',
    status: 'open',
    why: 'No third source was read. Check in game.',
  },
];

/** Every map with chapter data, in Maps-list order. */
export const MAPS: readonly ChapterData[] = [...EARLY_MAPS, ...CHAPTERS_7_12, ...CHAPTERS_13_19].sort((a, b) => a.order - b.order);

export function mapOrder(id: string): number {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`No chapter data for ${id}`);
  return m.order;
}
