/**
 * Anchors that tie the usage guide to real controls. A control the guide points at carries `data-guide="<id>"`, added
 * through `guide()`, so the guide finds it whatever its class names or label text. `guide.test.ts` fails when a target
 * has no anchor left in the UI source.
 */
export const GUIDE_TARGETS = [
  // Header
  'play-context',
  'validation',
  // Roster
  'run-setup',
  'run-facts',
  'deploy',
  'deploy-role',
  'state-strip',
  'bench',
  'spouse-picker',
  'married',
  'children-ledger',
  // Plan
  'marriage-table',
  'priority',
  'quota-bar',
  'quota-edit',
  'role-matrix',
  'units-rail',
  'run-rail',
  'chapter-log',
  'maps-link',
  'log-add',
  'log-snapshot',
  'next-map',
  'record-results',
  'record-flow',
  'prep-page',
  'prepare',
  'matchup-foe',
  'matchup-table',
  'prep-threats',
  'danger-flags',
  'lplus-checklist',
  'maps-list',
  'map-data',
  'unit-class-tree',
  'unit-partners',
  'robin-preview',
  'front-door-pairings',
  'unit-opinion',
  'no-robin',
  'robin-first',
  'robin-gain',
  'plan-preset',
  'plan-preset-reset',
  'pin',
  'rule-out',
  'free-replan',
  'adopt',
  'robin-lock',
  'broken-pins',
  'plan-diff',
  // Tables
  'leaderboard',
  'child-table',
  'score-with-plan-preset',
  'skills-drawer',
  'robin-heatmap',
  // Scoring sidebar
  'scoring-preset',
  'scoring-basis',
  'spd-target',
] as const;

export type GuideTarget = (typeof GUIDE_TARGETS)[number];

/** The `data-guide` attribute for `h()`: `h('button', { ...guide('adopt'), … })`. */
export const guide = (id: GuideTarget): { readonly 'data-guide': GuideTarget } => ({ 'data-guide': id });
