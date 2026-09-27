/**
 * Anchors that tie the usage guide to real controls. A control the guide points at carries `data-guide="<id>"`, added
 * through `guide()`, so the guide finds it whatever its class names or label text. `guide.test.ts` fails when a target
 * has no anchor left in the UI source. #212 removed the Plan page's anchors and the Roster's Deploy, deployment-role
 * and Bench anchors with their controls, and the guide entries that pointed at them.
 */
export const GUIDE_TARGETS = [
  // Header
  'play-context',
  'validation',
  // Roster
  'run-setup',
  'run-facts',
  'state-strip',
  'spouse-picker',
  'married',
  // Wishlist
  'children-ledger',
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
  'prep-loadouts',
  'prep-supply',
  'prep-seals',
  'how-to-run',
  'maps-list',
  'map-data',
  'unit-class-tree',
  'unit-partners',
  'robin-preview',
  'front-door-pairings',
  'unit-opinion',
  // Tables
  'leaderboard',
  'child-table',
  'skills-drawer',
  'robin-heatmap',
  // Scoring sidebar
  'scoring-preset',
  'scoring-basis',
  'spd-target',
] as const;

export type GuideTarget = (typeof GUIDE_TARGETS)[number];

/** The `data-guide` attribute for `h()`: `h('button', { ...guide('prepare'), … })`. */
export const guide = (id: GuideTarget): { readonly 'data-guide': GuideTarget } => ({ 'data-guide': id });
