/**
 * Curated synergy edges: "A wants B, because…". Opinions, not game data; shown as notes on a build that holds both
 * skills, never scored (#10). Seeded from the research's synergy list (research/builds-and-synergies §2, #6).
 */
import type { SkillId } from '../game-data/skills';

export type SkillEdge = { readonly a: SkillId; readonly b: SkillId; readonly note: string };

export const SYNERGIES: readonly SkillEdge[] = [
  { a: 'vantage', b: 'vengeance', note: 'Vantage works below half HP, exactly when Vengeance hits hardest.' },
  { a: 'vengeance', b: 'wrath', note: 'Wrath adds +20 crit in the same low-HP state; a crit triples the Vengeance hit.' },
  { a: 'vantage', b: 'wrath', note: 'Both switch on below half HP.' },
  { a: 'vantage', b: 'dual-strike-plus', note: 'A reliable Vantage kill needs dual strikes; Dual Strike+ is worth 40 combined Skl.' },
  { a: 'vengeance', b: 'lifetaker', note: 'Lifetaker heals only on the user’s turn, so it doesn’t undo the low-HP state.' },
  { a: 'galeforce', b: 'luna', note: 'Galeforce needs the kill; a stable proc makes it reliable.' },
  { a: 'galeforce', b: 'vengeance', note: 'Vengeance fires about 100% at Skl ≥ 50, so Galeforce kills are reliable.' },
  { a: 'galeforce', b: 'lifetaker', note: 'Every Galeforce trigger is also a kill that heals 50%.' },
  { a: 'luna', b: 'aether', note: 'Two procs is the sweet spot: Aether at Skl/2 % plus Luna at Skl %.' },
  { a: 'luna', b: 'astra', note: 'Two procs is the sweet spot: Astra at Skl/2 % plus Luna at Skl %.' },
  { a: 'luna', b: 'ignis', note: 'A second proc raises the chance that one fires.' },
  { a: 'luna', b: 'rightful-king', note: 'Rightful King is worth about one extra proc at Apotheosis Skl.' },
  { a: 'aether', b: 'rightful-king', note: 'Rightful King adds a flat +10% to low-rate Aether.' },
  { a: 'astra', b: 'rightful-king', note: 'Rightful King adds a flat +10% to low-rate Astra.' },
  { a: 'lethality', b: 'rightful-king', note: 'Lethality’s Skl/4 % base rate needs the +10%.' },
  { a: 'armsthrift', b: 'rightful-king', note: 'Rightful King reaches 100% Armsthrift below 50 Luck.' },
  { a: 'armsthrift', b: 'galeforce', note: 'An unbreakable forged Brave weapon on a unit that acts twice.' },
  { a: 'pavise', b: 'aegis', note: 'Together they halve every weapon type.' },
  { a: 'pavise', b: 'renewal', note: 'The classic main-story tank: halve the damage, heal 30% a turn.' },
  { a: 'aegis', b: 'renewal', note: 'The classic main-story tank: halve the damage, heal 30% a turn.' },
  { a: 'pavise', b: 'rightful-king', note: 'Rightful King adds +10% to Pavise.' },
  { a: 'aegis', b: 'rightful-king', note: 'Rightful King adds +10% to Aegis.' },
  { a: 'aggressor', b: 'limit-breaker', note: 'Two of the “Big Three” DLC boosts that break Apotheosis.' },
  { a: 'wrath', b: 'focus', note: 'Crit stacking toward the crit target.' },
  { a: 'wrath', b: 'gamble', note: 'Crit stacking toward the crit target.' },
  { a: 'lancebreaker', b: 'avoid-plus-10', note: 'Stacks Avoid to zero out a lance user’s hit rate.' },
  { a: 'rally-spectrum', b: 'rally-heart', note: 'Rallies stack with Spectrum and Heart, and rallying uses the turn: keep them on one unit.' },
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
  })),
  ...(['luna', 'ignis', 'astra', 'lethality'] as const).map((b) => ({
    a: 'sol' as const,
    b,
    note: 'Only one proc fires per hit, so a heal proc and a damage proc crowd each other out: pick heal or damage.',
  })),
  { a: 'sol', b: 'vantage', note: 'Healing on enemy phase lifts HP back above the half-HP Vantage threshold; Lifetaker heals on your turn only.' },
  { a: 'renewal', b: 'vantage', note: 'Renewal heals 30% each turn, pulling HP back above the half-HP Vantage threshold.' },
  { a: 'renewal', b: 'vengeance', note: 'Renewal heals 30% each turn, shrinking the missing HP Vengeance adds.' },
];
