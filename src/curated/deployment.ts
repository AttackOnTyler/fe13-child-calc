/**
 * Curated deployment data (#19): each first-gen unit's default Deploy flag and deployment-role tag, and the
 * composition quotas per play context. Opinions, not game data.
 *
 * Deployed by default: Robin and Chrom (forced onto most maps) and Olivia (the army's one Dancer), since the children
 * fill most of the cap. Staff/Rally tags go to the healers, Battery tags to the sturdy pair-up backs, Lead to the rest.
 */
import type { UnitId } from '../game-data/units';

/** The job a deployed unit does in the army. No child can be a Dancer. */
export type DeploymentRole = 'lead' | 'battery' | 'staff' | 'dancer';

export const DEPLOYMENT_ROLES: readonly DeploymentRole[] = ['lead', 'battery', 'staff', 'dancer'];

/** The deployment roles a child can take. */
export type ChildDeploymentRole = Exclude<DeploymentRole, 'dancer'>;

export type DeploymentTag = { readonly deploy: boolean; readonly role: DeploymentRole };

/** A min–max count of deployed units. */
export type QuotaRange = { readonly min: number; readonly max: number };

export type Quotas = { readonly cap: number; readonly roles: Readonly<Record<DeploymentRole, QuotaRange>> };

const tag = (role: DeploymentRole, deploy = false): DeploymentTag => ({ role, deploy });

/** Every first-gen unit the roster lists, and Robin. The Maiden is never recruited. */
export const FIRST_GEN_DEPLOYMENT: Readonly<Record<Exclude<UnitId, 'maiden'> | 'robin', DeploymentTag>> = {
  robin: tag('lead', true),
  chrom: tag('lead', true),
  lissa: tag('staff'),
  frederick: tag('battery'),
  sully: tag('lead'),
  virion: tag('lead'),
  stahl: tag('lead'),
  vaike: tag('lead'),
  miriel: tag('lead'),
  sumia: tag('lead'),
  kellam: tag('battery'),
  donnel: tag('lead'),
  lonqu: tag('lead'),
  ricken: tag('lead'),
  maribelle: tag('staff'),
  panne: tag('lead'),
  gaius: tag('lead'),
  cordelia: tag('lead'),
  gregor: tag('battery'),
  nowi: tag('lead'),
  libra: tag('staff'),
  tharja: tag('lead'),
  anna: tag('lead'),
  olivia: tag('dancer', true),
  cherche: tag('battery'),
  henry: tag('lead'),
  sayri: tag('lead'),
  tiki: tag('lead'),
  basilio: tag('battery'),
  flavia: tag('lead'),
  gangrel: tag('lead'),
  walhart: tag('lead'),
  emmeryn: tag('staff'),
  yenfay: tag('lead'),
  aversa: tag('lead'),
  priam: tag('lead'),
};

const quotas = (cap: number, lead: [number, number], battery: [number, number], staff: [number, number], dancer: [number, number]): Quotas => ({
  cap,
  roles: {
    lead: { min: lead[0], max: lead[1] },
    battery: { min: battery[0], max: battery[1] },
    staff: { min: staff[0], max: staff[1] },
    dancer: { min: dancer[0], max: dancer[1] },
  },
});

const MAIN_STORY = quotas(14, [3, 5], [3, 5], [2, 3], [1, 1]);

/** The seed quotas per play context. All has none of its own: it uses Main story's, edits included. */
export const COMPOSITION_QUOTAS = {
  apotheosis: quotas(20, [4, 6], [4, 6], [3, 4], [1, 1]),
  'main-story': MAIN_STORY,
  'full-route': MAIN_STORY,
} as const satisfies Record<string, Quotas>;
