/**
 * Curated synergy edges: "A wants B, because…". Opinions, not game data; shown as notes on a build that holds both
 * skills, never scored (#10). Seeded from the research's synergy list (research/builds-and-synergies §2, #6).
 */
import type { SkillId } from '../game-data/skills';
import type { SourceId } from './sources';

/** An edge between two skills, with its one-line reason and the registry sources it rests on (#99). */
export type SkillEdge = { readonly a: SkillId; readonly b: SkillId; readonly note: string; readonly sources: readonly SourceId[] };

export const SYNERGIES: readonly SkillEdge[] = [
  { a: 'vantage', b: 'vengeance', note: 'Vantage works below half HP, exactly when Vengeance hits hardest.' , sources: ['S3', 'S4', 'S5', 'S6', 'S7'] },
  { a: 'vengeance', b: 'wrath', note: 'Wrath adds +20 crit in the same low-HP state; a crit triples the Vengeance hit.' , sources: ['S3', 'S4', 'S5'] },
  { a: 'vantage', b: 'wrath', note: 'Both switch on below half HP.' , sources: ['S3', 'S4', 'S5'] },
  { a: 'vantage', b: 'dual-strike-plus', note: 'A reliable Vantage kill needs dual strikes; Dual Strike+ is worth 40 combined Skl.' , sources: ['S3', 'S5'] },
  { a: 'vengeance', b: 'lifetaker', note: 'Lifetaker heals only on the user’s turn, so it doesn’t undo the low-HP state.' , sources: ['S4', 'S5'] },
  { a: 'galeforce', b: 'luna', note: 'Galeforce needs the kill; a stable proc makes it reliable.' , sources: ['S3', 'S4'] },
  { a: 'galeforce', b: 'vengeance', note: 'Vengeance fires about 100% at Skl ≥ 50, so Galeforce kills are reliable.' , sources: ['S3', 'S4'] },
  { a: 'galeforce', b: 'lifetaker', note: 'Every Galeforce trigger is also a kill that heals 50%.' , sources: ['S4', 'S5'] },
  { a: 'luna', b: 'aether', note: 'Two procs is the sweet spot: Aether at Skl/2 % plus Luna at Skl %.' , sources: ['S3', 'S4'] },
  { a: 'luna', b: 'astra', note: 'Two procs is the sweet spot: Astra at Skl/2 % plus Luna at Skl %.' , sources: ['S3', 'S4'] },
  { a: 'luna', b: 'ignis', note: 'A second proc raises the chance that one fires.' , sources: ['S3', 'S4'] },
  { a: 'luna', b: 'rightful-king', note: 'Rightful King is worth about one extra proc at Apotheosis Skl.' , sources: ['S3', 'S4'] },
  { a: 'aether', b: 'rightful-king', note: 'Rightful King adds a flat +10% to low-rate Aether.' , sources: ['S3', 'S4', 'S6'] },
  { a: 'astra', b: 'rightful-king', note: 'Rightful King adds a flat +10% to low-rate Astra.' , sources: ['S3', 'S4', 'S6'] },
  { a: 'lethality', b: 'rightful-king', note: 'Lethality’s Skl/4 % base rate needs the +10%.' , sources: ['S6'] },
  { a: 'armsthrift', b: 'rightful-king', note: 'Rightful King reaches 100% Armsthrift below 50 Luck.' , sources: ['S3', 'S5'] },
  { a: 'armsthrift', b: 'galeforce', note: 'An unbreakable forged Brave weapon on a unit that acts twice.' , sources: ['S4', 'S5', 'S6', 'S7'] },
  { a: 'pavise', b: 'aegis', note: 'Together they halve every weapon type.' , sources: ['S4', 'S5', 'S6', 'S7'] },
  { a: 'pavise', b: 'renewal', note: 'The classic main-story tank: halve the damage, heal 30% a turn.' , sources: ['S4', 'S5', 'S6', 'S7'] },
  { a: 'aegis', b: 'renewal', note: 'The classic main-story tank: halve the damage, heal 30% a turn.' , sources: ['S4', 'S5', 'S6', 'S7'] },
  { a: 'pavise', b: 'rightful-king', note: 'Rightful King adds +10% to Pavise.' , sources: ['S6'] },
  { a: 'aegis', b: 'rightful-king', note: 'Rightful King adds +10% to Aegis.' , sources: ['S6'] },
  { a: 'aggressor', b: 'limit-breaker', note: 'Two of the “Big Three” DLC boosts that break Apotheosis.' , sources: ['S3', 'S4'] },
  { a: 'wrath', b: 'focus', note: 'Crit stacking toward the crit target.' , sources: ['S3', 'S4'] },
  { a: 'wrath', b: 'gamble', note: 'Crit stacking toward the crit target.' , sources: ['S3', 'S4'] },
  { a: 'lancebreaker', b: 'avoid-plus-10', note: 'Stacks Avoid to zero out a lance user’s hit rate.' , sources: ['S3'] },
  { a: 'rally-spectrum', b: 'rally-heart', note: 'Rallies stack with Spectrum and Heart, and rallying uses the turn: keep them on one unit.' , sources: ['S3', 'S4', 'S5'] },
];

/**
 * Curated conflict (anti-synergy) edges: "A gets in B's way, because…". Shown on the Skill card, never scored; the
 * template lint fails if a build template holds both ends of one in different slots (#10). Seeded from the research's
 * anti-synergy list (research/builds-and-synergies §2, #6). Only one proc fires per hit, in a fixed priority.
 */
export const CONFLICTS: readonly SkillEdge[] = [
  ...(['lethality', 'aether', 'astra', 'sol', 'luna', 'ignis'] as const).map((b) => ({
    a: 'vengeance' as const,
    b,
    note: 'Vengeance is last in the proc order: any other proc that fires replaces its near-certain trigger.',
    sources: ['S2', 'S3'] as const,
  })),
  ...(['luna', 'ignis', 'astra', 'lethality'] as const).map((b) => ({
    a: 'sol' as const,
    b,
    note: 'Only one proc fires per hit, so a heal proc and a damage proc crowd each other out: pick heal or damage.',
    sources: ['S2', 'S4'] as const,
  })),
  { a: 'sol', b: 'vantage', note: 'Healing on enemy phase lifts HP back above the half-HP Vantage threshold; Lifetaker heals on your turn only.' , sources: ['S4', 'S5'] },
  { a: 'renewal', b: 'vantage', note: 'Renewal heals 30% each turn, pulling HP back above the half-HP Vantage threshold.' , sources: ['S4', 'S5'] },
  { a: 'renewal', b: 'vengeance', note: 'Renewal heals 30% each turn, shrinking the missing HP Vengeance adds.' , sources: ['S4', 'S5'] },
];
