/**
 * Curated skill ranks: integers 1–5 (S = 5 … D = 1), unranked = 0 (left out). Opinions, not game data; additive,
 * never blended with a stat score (#11). Sparse per-context overrides follow the play context; All uses `default`.
 *
 * Seeded from the builds research (research/builds-and-synergies, #6): Galeforce is the most valued skill
 * everywhere; Luna/Vengeance are the stable procs, Vengeance best in Apotheosis; Sol and Lethality are good for
 * main-story sustain and poor in Apotheosis (Dragonskin); Pavise/Aegis carry the main story and fade in
 * Apotheosis; Rally Spectrum and Rally Heart lead the rallies (S4).
 */
import type { SkillId } from '../game-data/skills';

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
  astra: { default: 4 },
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
  wrath: { default: 3 },
  renewal: { default: 3, mainStory: 4 },
  lifetaker: { default: 3 },
  armsthrift: { default: 3, mainStory: 4 },
  counter: { default: 3, apotheosis: 1 },
  'speed-plus-2': { default: 3, apotheosis: 4 },
  'strength-plus-2': { default: 3 },
  'magic-plus-2': { default: 3 },
  'all-stats-plus-2': { default: 3 },
  defender: { default: 3 },
  anathema: { default: 3 },
  'hit-rate-plus-20': { default: 3 },
  prescience: { default: 3 },
  'dual-support-plus': { default: 3 },
  'rally-speed': { default: 3 },
  'rally-strength': { default: 3 },
  'rally-magic': { default: 3 },
  'rally-movement': { default: 3 },
  lethality: { default: 2, apotheosis: 1 },
  'dual-guard-plus': { default: 2 },
  'skill-plus-2': { default: 2 },
  'even-rhythm': { default: 2 },
  hex: { default: 2 },
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
  demoiselle: { default: 1 },
  tantivy: { default: 1 },
  relief: { default: 1 },
};
