/**
 * Join data (#100): when each first-gen unit and Robin joins, how, in which class and level, their base stats and their
 * starting skills.
 *
 * Source: SF base stats (main story) and SF recruitment (main story), cross-checked against the FEW per-character
 * `CharStats FE13` blocks (research/unit-page-data, #79): 33 of 35 units agree on every stat, level and skill.
 * Bases are stored without skill or weapon bonuses (SF writes Virion's Skl as `9+2`; this stores 9). A unit without a
 * Hard or Lunatic row has its Normal bases there. Resolved disagreements: U1 (Olivia), U2 (Aversa); see
 * disagreements.ts.
 *
 * Starting skills can fall outside a unit's class set: Walhart (Conquest), Aversa (Shadowgift), Emmeryn (Magic +2,
 * Focus) and Priam (Swordbreaker, Lancebreaker, Luna). A unit keeps every skill it learns, so these are reachable too.
 */
import type { ClassId } from './classes';
import type { SkillId } from './skills';
import type { Stat } from './stats';
import type { UnitId } from './units';

export type BaseStats = Readonly<Record<Stat, number>>;

/** Where a unit joins: the prologue, a chapter (`chapter-4`) or a paralogue (`paralogue-17`). */
export type JoinChapter = 'prologue' | `chapter-${number}` | `paralogue-${number}`;

export type JoinData = {
  readonly chapter: JoinChapter;
  /** How it's recruited, in SF's words; null when it joins with the story. */
  readonly recruit: string | null;
  readonly joinClass: ClassId;
  readonly level: number;
  readonly normal: BaseStats;
  /** Absent: the same as Normal. */
  readonly hard?: BaseStats;
  /** Absent: the same as Hard (or Normal). */
  readonly lunatic?: BaseStats;
  readonly startingSkills: readonly SkillId[];
};

/** The SpotPass paralogue units: they support no one but Robin (SF supports; research/unit-page-data §3.2). */
export const SPOTPASS_UNITS = ['gangrel', 'walhart', 'emmeryn', 'yenfay', 'aversa', 'priam'] as const satisfies readonly UnitId[];

export const JOIN_DATA: Readonly<Record<Exclude<UnitId, 'maiden'> | 'robin', JoinData>> = {
  robin: { chapter: 'prologue', recruit: null, joinClass: 'tactician', level: 1, normal: { hp: 19, str: 6, mag: 5, skl: 5, spd: 6, lck: 4, def: 6, res: 4 }, startingSkills: ['veteran'] },
  chrom: { chapter: 'prologue', recruit: null, joinClass: 'lord', level: 1, normal: { hp: 20, str: 7, mag: 1, skl: 8, spd: 8, lck: 5, def: 7, res: 1 }, startingSkills: ['dual-strike-plus'] },
  lissa: { chapter: 'prologue', recruit: null, joinClass: 'priest', level: 1, normal: { hp: 17, str: 1, mag: 5, skl: 4, spd: 4, lck: 8, def: 3, res: 4 }, startingSkills: ['miracle'] },
  frederick: { chapter: 'prologue', recruit: null, joinClass: 'great-knight', level: 1, normal: { hp: 28, str: 13, mag: 2, skl: 12, spd: 10, lck: 6, def: 14, res: 3 }, startingSkills: ['discipline', 'outdoor-fighter'] },
  sully: { chapter: 'chapter-1', recruit: 'Automatically from Turn 2', joinClass: 'cavalier', level: 2, normal: { hp: 20, str: 7, mag: 1, skl: 8, spd: 8, lck: 6, def: 7, res: 2 }, startingSkills: ['discipline'] },
  virion: { chapter: 'chapter-1', recruit: 'Automatically from Turn 2', joinClass: 'archer', level: 2, normal: { hp: 19, str: 6, mag: 0, skl: 9, spd: 5, lck: 7, def: 6, res: 1 }, startingSkills: ['skill-plus-2'] },
  stahl: { chapter: 'chapter-2', recruit: null, joinClass: 'cavalier', level: 2, normal: { hp: 22, str: 8, mag: 0, skl: 7, spd: 6, lck: 5, def: 8, res: 1 }, startingSkills: ['discipline'] },
  vaike: { chapter: 'chapter-2', recruit: null, joinClass: 'fighter', level: 3, normal: { hp: 24, str: 9, mag: 0, skl: 8, spd: 6, lck: 4, def: 5, res: 0 }, startingSkills: ['hp-plus-5'] },
  miriel: { chapter: 'chapter-2', recruit: 'Automatically from Turn 2', joinClass: 'mage', level: 1, normal: { hp: 18, str: 0, mag: 6, skl: 5, spd: 7, lck: 6, def: 3, res: 4 }, startingSkills: ['magic-plus-2'] },
  sumia: { chapter: 'chapter-3', recruit: null, joinClass: 'pegasus-knight', level: 1, normal: { hp: 18, str: 6, mag: 3, skl: 11, spd: 11, lck: 8, def: 5, res: 7 }, startingSkills: ['speed-plus-2'] },
  kellam: { chapter: 'chapter-3', recruit: 'NPC, talk with Chrom', joinClass: 'knight', level: 5, normal: { hp: 21, str: 10, mag: 0, skl: 7, spd: 5, lck: 3, def: 12, res: 2 }, startingSkills: ['defence-plus-2'] },
  donnel: { chapter: 'paralogue-1', recruit: 'End of chapter if he gained a Level', joinClass: 'villager', level: 1, normal: { hp: 16, str: 4, mag: 0, skl: 2, spd: 3, lck: 11, def: 3, res: 0 }, startingSkills: ['aptitude'] },
  lonqu: { chapter: 'chapter-4', recruit: 'End of chapter', joinClass: 'myrmidon', level: 4, normal: { hp: 20, str: 6, mag: 1, skl: 12, spd: 13, lck: 7, def: 7, res: 2 }, startingSkills: ['avoid-plus-10'] },
  ricken: { chapter: 'chapter-5', recruit: null, joinClass: 'mage', level: 3, normal: { hp: 20, str: 3, mag: 8, skl: 6, spd: 5, lck: 10, def: 6, res: 3 }, startingSkills: ['magic-plus-2'] },
  maribelle: { chapter: 'chapter-5', recruit: null, joinClass: 'troubadour', level: 3, normal: { hp: 18, str: 0, mag: 5, skl: 4, spd: 6, lck: 5, def: 3, res: 6 }, startingSkills: ['resistance-plus-2'] },
  panne: { chapter: 'chapter-6', recruit: 'Automatically from Turn 2', joinClass: 'taguel', level: 6, normal: { hp: 28, str: 8, mag: 1, skl: 9, spd: 10, lck: 8, def: 7, res: 3 }, startingSkills: ['even-rhythm'] },
  gaius: { chapter: 'chapter-6', recruit: 'Enemy, talk with Chrom', joinClass: 'thief', level: 5, normal: { hp: 22, str: 7, mag: 0, skl: 13, spd: 15, lck: 6, def: 5, res: 2 }, startingSkills: ['locktouch'] },
  cordelia: { chapter: 'chapter-7', recruit: 'Automatically from Turn 3', joinClass: 'pegasus-knight', level: 7, normal: { hp: 25, str: 9, mag: 3, skl: 13, spd: 12, lck: 9, def: 8, res: 8 }, startingSkills: ['speed-plus-2'] },
  gregor: { chapter: 'chapter-8', recruit: null, joinClass: 'mercenary', level: 10, normal: { hp: 30, str: 12, mag: 0, skl: 13, spd: 11, lck: 8, def: 10, res: 2 }, lunatic: { hp: 31, str: 13, mag: 0, skl: 14, spd: 12, lck: 8, def: 11, res: 2 }, startingSkills: ['armsthrift', 'patience'] },
  nowi: { chapter: 'chapter-8', recruit: null, joinClass: 'manakete', level: 3, normal: { hp: 18, str: 4, mag: 0, skl: 2, spd: 3, lck: 8, def: 2, res: 2 }, lunatic: { hp: 19, str: 5, mag: 0, skl: 3, spd: 4, lck: 9, def: 3, res: 3 }, startingSkills: ['odd-rhythm'] },
  libra: { chapter: 'chapter-9', recruit: 'NPC, talk with Chrom', joinClass: 'war-monk', level: 1, normal: { hp: 38, str: 14, mag: 15, skl: 13, spd: 13, lck: 10, def: 11, res: 16 }, hard: { hp: 39, str: 14, mag: 16, skl: 13, spd: 14, lck: 10, def: 11, res: 16 }, lunatic: { hp: 40, str: 15, mag: 16, skl: 13, spd: 14, lck: 11, def: 12, res: 17 }, startingSkills: ['healtouch', 'miracle'] },
  tharja: { chapter: 'chapter-9', recruit: 'Enemy, talk with Chrom', joinClass: 'dark-mage', level: 10, normal: { hp: 25, str: 4, mag: 11, skl: 5, spd: 12, lck: 3, def: 10, res: 7 }, lunatic: { hp: 26, str: 4, mag: 12, skl: 5, spd: 13, lck: 3, def: 10, res: 7 }, startingSkills: ['hex', 'anathema'] },
  anna: { chapter: 'paralogue-4', recruit: 'NPC, talk with Chrom', joinClass: 'trickster', level: 1, normal: { hp: 35, str: 12, mag: 17, skl: 22, spd: 21, lck: 25, def: 8, res: 10 }, hard: { hp: 36, str: 12, mag: 17, skl: 23, spd: 22, lck: 26, def: 8, res: 10 }, lunatic: { hp: 37, str: 13, mag: 18, skl: 23, spd: 22, lck: 27, def: 9, res: 11 }, startingSkills: ['movement-plus-1', 'locktouch'] },
    // U1: Skl 8 (SF, Fandom) over 9 (FEW).
  olivia: { chapter: 'chapter-11', recruit: null, joinClass: 'dancer', level: 1, normal: { hp: 18, str: 3, mag: 1, skl: 8, spd: 9, lck: 5, def: 3, res: 2 }, startingSkills: ['luck-plus-4'] },
  cherche: { chapter: 'chapter-12', recruit: null, joinClass: 'wyvern-rider', level: 12, normal: { hp: 30, str: 14, mag: 1, skl: 12, spd: 11, lck: 8, def: 15, res: 2 }, hard: { hp: 31, str: 15, mag: 1, skl: 13, spd: 12, lck: 9, def: 16, res: 2 }, lunatic: { hp: 33, str: 16, mag: 2, skl: 14, spd: 13, lck: 10, def: 17, res: 2 }, startingSkills: ['strength-plus-2', 'tantivy'] },
  henry: { chapter: 'chapter-13', recruit: null, joinClass: 'dark-mage', level: 12, normal: { hp: 28, str: 6, mag: 13, skl: 14, spd: 8, lck: 10, def: 12, res: 5 }, hard: { hp: 29, str: 6, mag: 14, skl: 15, spd: 9, lck: 10, def: 13, res: 5 }, lunatic: { hp: 31, str: 7, mag: 15, skl: 16, spd: 10, lck: 11, def: 14, res: 6 }, startingSkills: ['hex', 'anathema'] },
  sayri: { chapter: 'chapter-15', recruit: 'NPC, talk with Chrom', joinClass: 'swordmaster', level: 1, normal: { hp: 39, str: 17, mag: 7, skl: 23, spd: 26, lck: 20, def: 12, res: 10 }, hard: { hp: 41, str: 18, mag: 7, skl: 24, spd: 27, lck: 21, def: 13, res: 11 }, lunatic: { hp: 43, str: 19, mag: 8, skl: 26, spd: 29, lck: 22, def: 14, res: 12 }, startingSkills: ['avoid-plus-10', 'vantage'] },
  tiki: { chapter: 'paralogue-17', recruit: 'End of chapter', joinClass: 'manakete', level: 20, normal: { hp: 39, str: 18, mag: 10, skl: 14, spd: 16, lck: 18, def: 15, res: 12 }, hard: { hp: 44, str: 20, mag: 12, skl: 17, spd: 19, lck: 21, def: 17, res: 14 }, lunatic: { hp: 49, str: 23, mag: 14, skl: 20, spd: 22, lck: 24, def: 20, res: 17 }, startingSkills: ['odd-rhythm', 'wyrmsbane'] },
  basilio: { chapter: 'chapter-23', recruit: 'Automatically after defeating Validar', joinClass: 'warrior', level: 10, normal: { hp: 56, str: 30, mag: 3, skl: 25, spd: 21, lck: 18, def: 20, res: 8 }, hard: { hp: 62, str: 34, mag: 4, skl: 28, spd: 25, lck: 20, def: 23, res: 9 }, lunatic: { hp: 67, str: 37, mag: 4, skl: 31, spd: 28, lck: 23, def: 25, res: 10 }, startingSkills: ['hp-plus-5', 'zeal', 'rally-strength'] },
  flavia: { chapter: 'chapter-23', recruit: 'Automatically after defeating Validar', joinClass: 'hero', level: 10, normal: { hp: 48, str: 25, mag: 5, skl: 28, spd: 26, lck: 21, def: 23, res: 11 }, hard: { hp: 53, str: 28, mag: 6, skl: 32, spd: 30, lck: 24, def: 25, res: 13 }, lunatic: { hp: 58, str: 31, mag: 7, skl: 35, spd: 35, lck: 27, def: 27, res: 14 }, startingSkills: ['armsthrift', 'patience', 'sol'] },
  gangrel: { chapter: 'paralogue-18', recruit: 'Enemy, talk with Chrom 3 times', joinClass: 'trickster', level: 15, normal: { hp: 49, str: 21, mag: 20, skl: 29, spd: 33, lck: 15, def: 18, res: 17 }, hard: { hp: 54, str: 26, mag: 25, skl: 34, spd: 37, lck: 17, def: 20, res: 19 }, lunatic: { hp: 58, str: 31, mag: 29, skl: 38, spd: 41, lck: 19, def: 22, res: 22 }, startingSkills: ['movement-plus-1', 'locktouch', 'lucky-seven', 'acrobat'] },
  walhart: { chapter: 'paralogue-19', recruit: 'End of chapter, if Chrom fought him in this chapter', joinClass: 'conqueror', level: 30, normal: { hp: 71, str: 39, mag: 15, skl: 33, spd: 32, lck: 30, def: 35, res: 19 }, hard: { hp: 79, str: 44, mag: 16, skl: 36, spd: 35, lck: 33, def: 38, res: 21 }, lunatic: { hp: 80, str: 49, mag: 17, skl: 38, spd: 37, lck: 35, def: 42, res: 23 }, startingSkills: ['conquest'] },
  emmeryn: { chapter: 'paralogue-20', recruit: 'End of chapter, if she survived this chapter', joinClass: 'sage', level: 10, normal: { hp: 42, str: 5, mag: 26, skl: 23, spd: 25, lck: 13, def: 12, res: 20 }, hard: { hp: 47, str: 6, mag: 31, skl: 27, spd: 29, lck: 17, def: 14, res: 23 }, lunatic: { hp: 52, str: 6, mag: 35, skl: 30, spd: 32, lck: 21, def: 16, res: 25 }, startingSkills: ['magic-plus-2', 'focus', 'rally-magic'] },
  yenfay: { chapter: 'paralogue-21', recruit: 'NPC, talk with Say’ri', joinClass: 'swordmaster', level: 20, normal: { hp: 60, str: 30, mag: 5, skl: 39, spd: 40, lck: 28, def: 21, res: 18 }, hard: { hp: 66, str: 34, mag: 6, skl: 43, spd: 45, lck: 32, def: 23, res: 20 }, lunatic: { hp: 72, str: 38, mag: 6, skl: 46, spd: 49, lck: 35, def: 25, res: 22 }, startingSkills: ['avoid-plus-10', 'swordfaire', 'vantage', 'astra'] },
    // U2: Normal Res 28 and Lunatic Skl 36 (SF, Fandom, FEW’s P22 NPC row) over 26 and 34 (FEW playable row).
  aversa: { chapter: 'paralogue-22', recruit: 'End of chapter, if she (NPC version) survived this chapter', joinClass: 'dark-flier', level: 20, normal: { hp: 55, str: 24, mag: 31, skl: 29, spd: 32, lck: 26, def: 21, res: 28 }, hard: { hp: 60, str: 26, mag: 35, skl: 32, spd: 36, lck: 30, def: 23, res: 30 }, lunatic: { hp: 65, str: 28, mag: 38, skl: 36, spd: 39, lck: 34, def: 25, res: 33 }, startingSkills: ['speed-plus-2', 'relief', 'rally-movement', 'galeforce', 'shadowgift'] },
  priam: { chapter: 'paralogue-23', recruit: 'End of chapter', joinClass: 'hero', level: 20, normal: { hp: 74, str: 40, mag: 3, skl: 44, spd: 38, lck: 35, def: 39, res: 25 }, hard: { hp: 80, str: 45, mag: 4, skl: 47, spd: 41, lck: 38, def: 42, res: 26 }, lunatic: { hp: 80, str: 45, mag: 4, skl: 47, spd: 42, lck: 41, def: 42, res: 27 }, startingSkills: ['swordbreaker', 'lancebreaker', 'axebreaker', 'sol', 'luna'] },
};

/** A unit's bases on a difficulty. */
export const basesOn = (d: JoinData, difficulty: 'normal' | 'hard' | 'lunatic'): BaseStats =>
  difficulty === 'normal' ? d.normal : difficulty === 'hard' ? (d.hard ?? d.normal) : (d.lunatic ?? d.hard ?? d.normal);
