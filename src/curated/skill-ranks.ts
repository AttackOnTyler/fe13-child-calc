/**
 * Curated skill ranks: integers 1–5 (S = 5 … D = 1), unranked = 0 (left out). Opinions, not game data; additive,
 * never blended with a stat score (#11). Sparse per-context overrides follow the play context; All uses `default`.
 *
 * Seeded from the builds research (research/builds-and-synergies, #6): Galeforce is the most valued skill
 * everywhere; Luna/Vengeance are the stable procs, Vengeance best in Apotheosis; Sol and Lethality are good for
 * main-story sustain and poor in Apotheosis (Dragonskin); Pavise/Aegis carry the main story and fade in
 * Apotheosis; Rally Spectrum and Rally Heart lead the rallies (S4).
 *
 * S10 pass (#106): Ellery's tier lists (research/ellery-roles q8), split into main story (Lunatic+, no grinding) and
 * Apotheosis, compared with these ranks. Every call two or more steps from a source is in RANK_DECISIONS with both
 * values, whether the rank moved or not.
 */
import type { SkillId } from '../game-data/skills';
import type { SourceId } from './sources';

export type SkillRank = {
  readonly default: number;
  readonly apotheosis?: number;
  readonly mainStory?: number;
  readonly fullRoute?: number;
};

export const SKILL_RANKS: Readonly<Partial<Record<SkillId, SkillRank>>> = {
  galeforce: { default: 5 },
  aether: { default: 5 },
  'limit-breaker': { default: 5 },
  luna: { default: 4, apotheosis: 5 },
  vengeance: { default: 4, apotheosis: 5 },
  astra: { default: 4, mainStory: 3 },
  'rightful-king': { default: 4 },
  'dual-strike-plus': { default: 4 },
  vantage: { default: 4 },
  bowfaire: { default: 4 },
  swordfaire: { default: 4 },
  tomefaire: { default: 4 },
  axefaire: { default: 4 },
  lancefaire: { default: 4 },
  pavise: { default: 4, apotheosis: 2, mainStory: 5 },
  aegis: { default: 4, apotheosis: 2, mainStory: 5 },
  aggressor: { default: 5, mainStory: 3 },
  'rally-spectrum': { default: 4 },
  'rally-heart': { default: 4 },
  sol: { default: 3, apotheosis: 1, mainStory: 5, fullRoute: 4 },
  ignis: { default: 3 },
  wrath: { default: 3, apotheosis: 4 },
  renewal: { default: 3, mainStory: 4 },
  lifetaker: { default: 3 },
  armsthrift: { default: 3, mainStory: 3 },
  counter: { default: 3, apotheosis: 1 },
  'speed-plus-2': { default: 3, apotheosis: 4 },
  'strength-plus-2': { default: 3 },
  'magic-plus-2': { default: 3 },
  'all-stats-plus-2': { default: 3, apotheosis: 4 },
  defender: { default: 3 },
  anathema: { default: 3, mainStory: 4 },
  'hit-rate-plus-20': { default: 3 },
  prescience: { default: 3 },
  'dual-support-plus': { default: 3, mainStory: 4 },
  'rally-speed': { default: 3 },
  'rally-strength': { default: 3 },
  'rally-magic': { default: 3 },
  'rally-movement': { default: 3 },
  lethality: { default: 2, apotheosis: 1 },
  'dual-guard-plus': { default: 3, mainStory: 4 },
  'skill-plus-2': { default: 2 },
  'even-rhythm': { default: 2 },
  hex: { default: 2, mainStory: 4 },
  miracle: { default: 2 },
  patience: { default: 2 },
  focus: { default: 2 },
  gamble: { default: 2 },
  axebreaker: { default: 2 },
  swordbreaker: { default: 2 },
  lancebreaker: { default: 2 },
  bowbreaker: { default: 2 },
  tomebreaker: { default: 2 },
  'rally-skill': { default: 2 },
  'rally-defence': { default: 2 },
  'rally-resistance': { default: 2 },
  acrobat: { default: 2 },
  'movement-plus-1': { default: 2 },
  deliverer: { default: 2 },
  charm: { default: 2 },
  solidarity: { default: 2 },
  'rally-luck': { default: 1 },
  demoiselle: { default: 1, mainStory: 3 },
  tantivy: { default: 1 },
  relief: { default: 1 },
};

/** A rank call against a source (#106): the rank the app keeps, the source's value in its own words, and why. */
export type RankDecision = {
  readonly skill: SkillId;
  readonly context: 'mainStory' | 'apotheosis';
  /** The app's rank after the call (1–5; 0 unranked). */
  readonly ours: number;
  readonly source: SourceId;
  readonly theirs: string;
  readonly call: 'adopted' | 'partly adopted' | 'kept';
  readonly why: string;
};

export const RANK_DECISIONS: readonly RankDecision[] = [
  { skill: 'astra', context: 'mainStory', ours: 3, source: 'S10', theirs: 'C: “virtually unusable in Lunatic+”', call: 'partly adopted', why: 'Five hits into an enemy Counter are real in Lunatic+ (now a conflict), but S3 and S4 rate it A as a second proc.' },
  { skill: 'armsthrift', context: 'mainStory', ours: 3, source: 'S10', theirs: 'C: “the most overrated skill”', call: 'partly adopted', why: 'Without grinding, weapon uses rarely run out; S5 and S6 still value it for forged and legendary weapons.' },
  { skill: 'hex', context: 'mainStory', ours: 4, source: 'S10', theirs: 'S (with Anathema)', call: 'adopted', why: 'Ellery’s main-story backs lean on the Hex/Anathema pair; no other source ranks Hex.' },
  { skill: 'anathema', context: 'mainStory', ours: 4, source: 'S10', theirs: 'S (with Hex)', call: 'adopted', why: 'S3 already uses Anathema to fix a back’s hit; Ellery ranks the aura pair top.' },
  { skill: 'dual-support-plus', context: 'mainStory', ours: 4, source: 'S10', theirs: 'S (with Demoiselle)', call: 'adopted', why: 'An aura back is a main-story staple in Ellery’s teams.' },
  { skill: 'demoiselle', context: 'mainStory', ours: 3, source: 'S10', theirs: 'S (with Dual Support+)', call: 'partly adopted', why: 'Only helps nearby men, so it stays below Dual Support+.' },
  { skill: 'dual-guard-plus', context: 'mainStory', ours: 4, source: 'S10', theirs: 'S: stops Hawkeye, Luna+ and Counter from the back', call: 'adopted', why: 'S4’s first choice of partner skill too; S3 treats it as filler.' },
  { skill: 'wrath', context: 'apotheosis', ours: 4, source: 'S10', theirs: 'S (Vantage + Vengeance + Wrath)', call: 'adopted', why: 'The crisis trio is Apotheosis’s famous solo strategy (S3, S4, S5).' },
  { skill: 'all-stats-plus-2', context: 'apotheosis', ours: 4, source: 'S10', theirs: 'S', call: 'adopted', why: 'A cheap stat boost that helps reach the Apotheosis Spd tiers.' },
  { skill: 'aether', context: 'mainStory', ours: 5, source: 'S10', theirs: 'B: “limited users”', call: 'kept', why: 'The rank is the skill’s worth on a unit that has it; few children reaching it shows in coverage, not rank.' },
  { skill: 'veteran', context: 'mainStory', ours: 0, source: 'S10', theirs: 'S', call: 'kept', why: 'An EXP skill: great for training Robin’s partner, but it fills no combat build.' },
  { skill: 'swordbreaker', context: 'mainStory', ours: 2, source: 'S10', theirs: 'S: the Breakers, for dodge tanking', call: 'kept', why: 'A breaker covers one weapon type; the Dodge tank template (E02) carries them where they matter.' },
  { skill: 'lancebreaker', context: 'mainStory', ours: 2, source: 'S10', theirs: 'S: the Breakers, for dodge tanking', call: 'kept', why: 'As Swordbreaker.' },
  { skill: 'charm', context: 'mainStory', ours: 2, source: 'S10', theirs: 'A', call: 'kept', why: 'An aura that needs the pair to stand next to the fight; S3 and S4 don’t rank it.' },
  { skill: 'solidarity', context: 'mainStory', ours: 2, source: 'S10', theirs: 'A', call: 'kept', why: 'As Charm.' },
];
