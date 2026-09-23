/**
 * Curated plan presets: the preset each child is scored with in the marriage plan, by play context (#18). Opinions,
 * not game data; sparse per-context overrides follow the play context, and All uses `default`. A child with no entry
 * (Morgan: its builds follow whichever lead archetype its parents suit) uses the global preset.
 *
 * Seeded from the per-child consensus in the builds research (research/builds-and-synergies §6, #6): Galeforce
 * leads where the child reaches Galeforce, Mixed where the variable parent decides between a physical and a caster
 * build; Gerome, Yarne and Laurent as hard supports; Nah as the battery behind a lead; Kjelle and Gerome as main-story
 * tanks, and Nah as a main-story Nosferatu tank.
 */
import type { ChildId } from '../game-data/children';
import type { PresetId } from './presets';
import type { ChildDeploymentRole } from './deployment';

export type PlanPresetEntry = {
  readonly default: PresetId;
  readonly apotheosis?: PresetId;
  readonly mainStory?: PresetId;
  readonly fullRoute?: PresetId;
};

export const PLAN_PRESETS: Readonly<Partial<Record<ChildId, PlanPresetEntry>>> = {
  lucina: { default: 'physical-lead' },
  owain: { default: 'mixed-lead' },
  inigo: { default: 'mixed-lead' },
  brady: { default: 'magical-lead' },
  kjelle: { default: 'physical-lead', mainStory: 'tank' },
  cynthia: { default: 'mixed-lead' },
  severa: { default: 'physical-lead' },
  gerome: { default: 'physical-hard-support', mainStory: 'tank' },
  yarne: { default: 'physical-hard-support' },
  laurent: { default: 'magical-hard-support' },
  noire: { default: 'physical-lead' },
  nah: { default: 'battery', mainStory: 'nostank' },
};

/**
 * What Suggest roles scores a child with in a role its plan preset isn't in (#37): a per-child entry, else the global
 * table. Nah, a battery by default, leads as the Nosferatu tank it is in the main story.
 */
export const DEPLOYMENT_ROLE_PRESETS: Readonly<Record<ChildDeploymentRole, PresetId>> = { lead: 'physical-lead', battery: 'battery', staff: 'rallybot' };

export const CHILD_DEPLOYMENT_ROLE_PRESETS: Readonly<Partial<Record<ChildId, Partial<Record<ChildDeploymentRole, PresetId>>>>> = {
  nah: { lead: 'nostank' },
};
