/**
 * Curated build templates: 5-slot skill loadouts for one role, tagged with the play contexts they suit. Opinions, not
 * game data; edited in code only (#10). Each slot is one skill, or an ordered preference group (first = preferred).
 *
 * Seeded from the builds research catalog B01–B23 (research/builds-and-synergies, #6). Its context tags map as
 * A = Apotheosis, L = Main story, G = Apotheosis + Main story (#10). Sources cite the source registry
 * (sources.ts, #99).
 *
 * Full route is seeded with every A, L and G template, pending the user's curation from their own play (#10 seeds it
 * with the templates whose DLC skills come from non-grind xenologues; which xenologue gives which DLC skill is unchecked).
 *
 * Seed edits against the research:
 * - B12 drops Sol from its sustain group ("Renewal (or Sol / Lifetaker)"): Sol would steal Luna's triggers (#6 §2).
 * - Alternatives the catalog gives in prose ("or Astra", "Even Rhythm / breaker", "weaponfaire") become preference
 *   groups in the order written.
 * - B23 (Dancer Olivia) is left out: no child can be a Dancer.
 */
import type { SkillId } from '../game-data/skills';
import type { PresetId } from './presets';
import type { SourceId } from './sources';

/** The play contexts a template suits; All shows every template. */
export type BuildContext = 'apotheosis' | 'main-story' | 'full-route';

/** The research's confidence tag: 3+ sources agree, 2 agree, or 1 source only. */
export type Confidence = 'Wide' | 'Multi' | 'Single';

/** One skill, or an ordered preference group. */
export type BuildSlot = readonly SkillId[];

export type BuildTemplate = {
  readonly id: string;
  readonly name: string;
  /** The scoring preset the role maps to ("Use this build's preset"). */
  readonly role: PresetId;
  readonly contexts: readonly BuildContext[];
  readonly slots: readonly [BuildSlot, BuildSlot, BuildSlot, BuildSlot, BuildSlot];
  /** The source registry entries it rests on (#99). */
  readonly sources: readonly SourceId[];
  readonly confidence: Confidence;
};

const FAIRES: BuildSlot = ['bowfaire', 'swordfaire', 'axefaire', 'lancefaire', 'tomefaire'];
const A: readonly BuildContext[] = ['apotheosis', 'full-route'];
const L: readonly BuildContext[] = ['main-story', 'full-route'];
const G: readonly BuildContext[] = ['apotheosis', 'main-story', 'full-route'];

/** In catalog order, the tie-break order wherever builds rank equal. */
export const BUILD_TEMPLATES: readonly BuildTemplate[] = [
  {
    id: 'B01',
    name: 'Galeforce proc archer',
    role: 'physical-lead',
    contexts: G,
    slots: [['galeforce'], ['bowfaire'], ['luna'], ['aether', 'astra'], ['speed-plus-2', 'defender', 'anathema']],
    sources: ['S3', 'S4'],
    confidence: 'Multi',
  },
  {
    id: 'B02',
    name: 'Galeforce proc caster',
    role: 'magical-lead',
    contexts: G,
    slots: [['galeforce'], ['tomefaire'], ['luna'], ['astra', 'aether'], ['magic-plus-2', 'defender']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B03',
    name: 'Galeforce Vengeance Sniper',
    role: 'physical-lead',
    contexts: A,
    slots: [['galeforce'], ['bowfaire'], ['vengeance'], ['anathema'], ['speed-plus-2']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B04',
    name: 'DLC Galeboy',
    role: 'physical-lead',
    contexts: A,
    slots: [['galeforce'], FAIRES, ['luna', 'vengeance'], ['aggressor'], ['limit-breaker']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B05',
    name: 'DLC Galegirl',
    role: 'physical-lead',
    contexts: A,
    slots: [['galeforce'], ['aether'], ['luna'], ['dual-strike-plus'], ['limit-breaker']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B06',
    name: 'Berserker hard support',
    role: 'physical-hard-support',
    contexts: A,
    slots: [['axefaire'], ['strength-plus-2'], ['hit-rate-plus-20'], ['prescience'], ['even-rhythm', 'tomebreaker', 'axebreaker', 'swordbreaker', 'lancebreaker']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B06d',
    name: 'Berserker hard support (DLC)',
    role: 'physical-hard-support',
    contexts: A,
    slots: [['axefaire'], ['aggressor'], ['limit-breaker'], ['hit-rate-plus-20'], ['prescience']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B07',
    name: 'Sage hard support',
    role: 'magical-hard-support',
    contexts: A,
    slots: [['tomefaire'], ['magic-plus-2'], ['anathema'], ['dual-support-plus'], ['tomebreaker']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B08',
    name: 'Classic partner support',
    role: 'battery',
    contexts: G,
    slots: [
      ['limit-breaker'],
      [...FAIRES, 'aggressor'],
      ['dual-guard-plus'],
      ['dual-support-plus'],
      ['lancebreaker', 'swordbreaker', 'axebreaker', 'bowbreaker', 'tomebreaker', 'anathema', 'hex', 'solidarity', 'charm'],
    ],
    sources: ['S4'],
    confidence: 'Single',
  },
  {
    id: 'B09',
    name: 'Vantage/Vengeance Sage',
    role: 'vv-lead',
    contexts: G,
    slots: [['vantage'], ['vengeance'], ['tomefaire'], ['galeforce'], ['hit-rate-plus-20']],
    sources: ['S3', 'S4', 'S5', 'S7'],
    confidence: 'Wide',
  },
  {
    id: 'B10',
    name: 'Crisis-mode crit',
    role: 'crisis-crit',
    contexts: G,
    slots: [['vantage'], ['vengeance', 'astra'], ['wrath'], ['focus', 'gamble', 'anathema'], ['galeforce', 'miracle', 'limit-breaker']],
    sources: ['S3', 'S4', 'S5'],
    confidence: 'Wide',
  },
  {
    id: 'B11',
    name: 'Nostank Sorcerer',
    role: 'nostank',
    contexts: L,
    slots: [['vengeance'], ['armsthrift'], ['lifetaker'], ['galeforce'], ['limit-breaker']],
    sources: ['S4', 'S5'],
    confidence: 'Multi',
  },
  {
    id: 'B12',
    name: 'Pavise/Aegis tank',
    role: 'tank',
    contexts: G,
    slots: [['pavise'], ['aegis'], ['renewal', 'lifetaker'], ['luna', 'lancebreaker', 'swordbreaker', 'axebreaker'], ['limit-breaker']],
    sources: ['S4', 'S5', 'S6', 'S7'],
    confidence: 'Wide',
  },
  {
    id: 'B13',
    name: 'Armsthrift brave bruiser',
    role: 'armsthrift-bruiser',
    contexts: G,
    slots: [['galeforce'], ['armsthrift'], ['sol'], ['bowfaire', 'swordfaire', 'axefaire', 'lancefaire', 'axebreaker'], ['limit-breaker', 'patience']],
    sources: ['S7', 'S9'],
    confidence: 'Multi',
  },
  {
    id: 'B14',
    name: 'Counter Sniper',
    role: 'vv-lead',
    contexts: L,
    slots: [['galeforce'], ['counter'], ['vantage'], ['vengeance'], ['limit-breaker']],
    sources: ['S5', 'S7'],
    confidence: 'Multi',
  },
  {
    id: 'B15',
    name: 'Lancekiller',
    role: 'lancekiller',
    contexts: A,
    slots: [['lancebreaker'], ['avoid-plus-10'], ['galeforce'], ['vengeance'], ['anathema']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B16',
    name: 'Rightful King procstack',
    role: 'physical-lead',
    contexts: G,
    slots: [['galeforce'], ['bowfaire'], ['luna'], ['astra'], ['rightful-king']],
    sources: ['S3', 'S5', 'S6'],
    confidence: 'Multi',
  },
  {
    id: 'B17',
    name: 'Triple-proc Sniper',
    role: 'physical-lead',
    contexts: A,
    slots: [['bowfaire'], ['aether'], ['luna'], ['rightful-king'], ['dual-strike-plus']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B18',
    name: '100% Dual Strike pair',
    role: 'physical-lead',
    contexts: A,
    slots: [['limit-breaker'], ['galeforce'], ['bowfaire'], ['vengeance'], ['all-stats-plus-2']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B19',
    name: 'Duo rallybot, male',
    role: 'rallybot',
    contexts: G,
    slots: [['rally-strength'], ['rally-skill'], ['rally-luck'], ['rally-defence'], ['rally-resistance']],
    sources: ['S3', 'S4'],
    confidence: 'Multi',
  },
  {
    id: 'B20',
    name: 'Duo rallybot, female',
    role: 'rallybot',
    contexts: G,
    slots: [['rally-magic'], ['rally-speed'], ['rally-movement'], ['rally-spectrum'], ['rally-heart']],
    sources: ['S3', 'S4'],
    confidence: 'Multi',
  },
  {
    id: 'B21',
    name: 'Solo rallybot',
    role: 'rallybot',
    contexts: A,
    slots: [['rally-spectrum'], ['rally-heart'], ['rally-speed'], ['rally-skill'], ['rally-magic', 'rally-strength']],
    sources: ['S3'],
    confidence: 'Single',
  },
  {
    id: 'B22',
    name: 'Staffbot',
    role: 'staffbot',
    contexts: A,
    slots: [['tomefaire', 'lancefaire'], ['acrobat', 'healtouch'], ['movement-plus-1'], ['magic-plus-2'], ['all-stats-plus-2', 'hex', 'charm', 'anathema']],
    sources: ['S3'],
    confidence: 'Single',
  },
];
