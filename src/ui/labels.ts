/**
 * Labels a view and the guide both show. Views render these constants rather than string literals, so the guide can
 * name a control and be sure it matches what the visitor sees.
 */
import type { ScoreBasis, ScoringRole, UnitState } from '../engine';

const PIN = '📌';

export const LABELS = {
  /** A pinned marriage from a run saved before `run:v2` (the pairing tables' block chip). */
  pin: PIN,
  pinned: `${PIN} Pinned`,
  married: '✓ Married',
  /** The Run view's Robin card: lock the chosen Robin into Run facts. */
  lock: 'Lock',
  /** The children ledger's status column. */
  ledgerStatus: 'Status',
  /** A game rule the app couldn't verify, and the panel that shows and overrides it. */
  assumption: '⚠',
  validation: 'Validation',
  /** The Roster, as the left rail names it. */
  roster: 'Roster',
  runFacts: 'Run facts',
  playContext: 'Play context',
  /** The header button that brings the guide back. */
  guide: '? Guide',
  /** The left rail's leaderboard entry. */
  allChildren: 'All children',
  /** A table row's button that opens its Skills drawer. */
  skills: 'Skills',
  /** The Scoring sidebar's Spd weights: up to the target breakpoint + margin, and beyond it. */
  spdToTarget: 'Spd→T',
  spdBeyond: 'Spd+',
} as const;

/** The explorer's header (#212; spec #175, user story 99): the Table view and unit pages are not the plan. */
export const EXPLORER_NOTE = 'The wishlist ranks by flawless chance; this explorer ranks by your presets.';

/** Unit opinion's label (#212; spec #175, Pages, storage and migration). */
export const OPINION_NOTE = 'What the community says. The wishlist doesn’t read this; it ranks by flawless chance.';

/** The Scoring sidebar's score bases. */
export const BASIS_LABELS: Readonly<Record<ScoreBasis, string>> = { 'caps-lb': 'Caps+LB', caps: 'Caps', growths: 'Growths' };

/** A unit's state on Roster: its icon, word and hint. Benched is only ever read from a run saved before #212. */
export const STATE_UI: Readonly<Record<UnitState, { icon: string; label: string; hint: string }>> = {
  available: { icon: '●', label: 'Available', hint: 'Recruited and usable' },
  'not-recruited': { icon: '◌', label: 'Not yet recruited', hint: 'Joins later: prunes nothing' },
  benched: { icon: '⏸', label: 'Benched', hint: 'Benched in a run saved before the wishlist: keeping a unit out is now a keep-out edit' },
  missed: { icon: '⊘', label: 'Missed', hint: 'Can no longer be recruited: blocks every pairing that needs the unit' },
  dead: { icon: '☠', label: 'Dead', hint: 'Blocks every pairing that still needs the unit' },
};

/** The explorer's scoring roles: a Lead preset scores a unit's own stats, a Support preset the pair-up bonus it gives. */
export const SCORING_ROLE_UI: Readonly<Record<ScoringRole, { readonly label: string; readonly hint: string }>> = {
  lead: { label: 'Lead', hint: 'Lead: scored on its own stats' },
  support: { label: 'Support', hint: 'Support: scored on the pair-up bonus it gives its lead' },
};

/** A child's status on the children ledger (#212: from the run and the adopted plan, never a score). */
export type LedgerStatus = 'dead' | 'missed' | 'married' | 'wished' | 'out';

/** Each ledger status: its mark, word and hint. */
export const LEDGER_UI: Readonly<Record<LedgerStatus, { readonly mark: string; readonly label: string; readonly hint: string }>> = {
  dead: { mark: '☠', label: 'dead', hint: 'Dead' },
  missed: { mark: '⊘', label: 'missed', hint: 'It can no longer be recruited' },
  married: { mark: '✓', label: 'parents married', hint: 'Its parents are married: it comes once its paralogue is played' },
  wished: { mark: '◆', label: 'in the wishlist', hint: 'The plan marries its parents and recruits it' },
  out: { mark: '○', label: 'not in the wishlist', hint: 'The plan doesn’t recruit it: its parents marry others, or its fixed parent stays unmarried' },
};
