/**
 * Labels a view and the guide both show. Views render these constants rather than string literals, so the guide can
 * name a control and be sure it matches what the visitor sees.
 */
import type { DeploymentRole, LedgerStatus, LeftOutReason, PinLoss, ScoringRole } from '../engine';

const PIN = '📌';

export const LABELS = {
  /** A marriage the player told the plan to keep: the Plan's pin control, and Roster's bond button. */
  pin: PIN,
  pinned: `${PIN} Pinned`,
  married: '✓ Married',
  /** The Plan's rule-out control, and its tooltip. */
  ruleOut: '🚫',
  ruleOutHint: 'Rule out: the plan won’t use this marriage',
  ruledOut: '🚫 Ruled out',
  adoptPlan: 'Adopt the new plan',
  /** The Plan's pick line: lock the solver's Robin into Run facts. Reserved for this button. */
  lock: 'Lock',
  suggestRoles: 'Suggest roles',
  freeReplan: 'Free re-plan',
} as const;

/** A lost pin on Roster and the Plan banner: broken (red, gone for good) or on hold (amber, back on un-bench). */
export const PIN_LOSS_UI: Readonly<Record<PinLoss['status'], { readonly label: string; readonly banner: string; readonly hint: string }>> = {
  broken: {
    label: 'broken',
    banner: `${PIN} Broken pins`,
    hint: 'Broken: a partner is dead or missed, so the pin is gone for good and the other partner is free',
  },
  'on-hold': {
    label: 'on hold',
    banner: `${PIN} Pins on hold`,
    hint: 'On hold: a partner is benched, so the other partner is free until you un-bench them and the pin comes back',
  },
};

/** Deployment roles as visitors see them, with the letter Plan rows use. */
export const ROLE_UI: Readonly<Record<DeploymentRole, { readonly label: string; readonly short: string }>> = {
  lead: { label: 'Lead', short: 'L' },
  battery: { label: 'Battery', short: 'B' },
  staff: { label: 'Staff/Rally', short: 'S' },
  dancer: { label: 'Dancer', short: 'D' },
};

/** Scoring roles under their deployment-role names: a Support preset gives the deployment role Battery. */
export const SCORING_ROLE_UI: Readonly<Record<ScoringRole, { readonly label: string; readonly hint: string }>> = {
  lead: { label: ROLE_UI.lead.label, hint: 'Lead: scored on its own stats' },
  support: { label: ROLE_UI.battery.label, hint: 'Battery: scored on the pair-up bonus it gives its lead' },
};

/** A child's status on the children ledger: its mark, word and hint. On hold wears the bench mark, not the pin. */
export const LEDGER_UI: Readonly<Record<LedgerStatus, { readonly mark: string; readonly label: string; readonly hint: string }>> = {
  open: { mark: '○', label: 'open', hint: 'Nothing is pinned or married for it yet' },
  pinned: { mark: PIN, label: 'pinned', hint: 'Its parents are pinned' },
  'on-hold': { mark: '⏸', label: PIN_LOSS_UI['on-hold'].label, hint: 'Its parents’ pin is on hold: a partner is benched, and the pin comes back on un-bench' },
  married: { mark: '✓', label: 'parents married', hint: 'Its parents are married: it will be born' },
  broken: { mark: '⚠', label: `plan ${PIN_LOSS_UI.broken.label}`, hint: 'The saved plan’s pairing for it (or, with no saved plan, its parents’ pin) can no longer happen' },
  'left-out': { mark: '◌', label: 'left out', hint: 'It can still be born, but the current plan doesn’t produce it' },
  unborn: { mark: '✕', label: 'can’t be born', hint: 'No pairing that can still happen produces it' },
  dead: { mark: '☠', label: 'dead', hint: 'Dead' },
};

/**
 * Children a re-plan stops producing: can’t be born (red, gone for good) or left out (amber, reversible through its
 * priority or a pin).
 */
export const NOT_BORN_UI = {
  unborn: `${LEDGER_UI.unborn.mark} Can’t be born`,
  leftOut: 'Left out by this plan',
} as const;

/** Why the plan leaves a child out, and the fix. */
export const LEFT_OUT_UI: Readonly<Record<LeftOutReason, { readonly label: string; readonly hint: string }>> = {
  'no-score': { label: 'no score', hint: 'Its plan preset gives it no score, so the plan values it at 0: pick a scored preset, or pin its parent' },
  'priority-0': { label: 'priority 0', hint: 'Its priority is 0, so the plan values it at 0: raise its priority, or pin its parent' },
  outscored: { label: 'outscored', hint: 'Too few husbands to go round, and higher-valued children won: raise its priority, or pin its parent' },
  benched: { label: 'parent benched', hint: 'Its parent is benched, so the plan won’t marry them: un-bench them' },
};
