/**
 * Map order templates (#179; spec #175, milestones #144): the ordered maps a roadmap plays to its endpoint, one template
 * per route. Map ids are the chapter data's; `apotheosis-secret` is Apotheosis on its secret route, played after its
 * normal route.
 *
 * - Full route: the user's own order, recorded on #144 (2026-09-25), verbatim. The Golden Gaffe and EXPonential Growth
 *   stay out; Infinite Regalia is optional; Paralogue 23 sits after Endgame for its difficulty.
 * - Main story: the story chapters, with each paralogue in reveal order before the next chapter (child paralogues
 *   after Chapter 13, which opens them, in number order). No xenologues and no SpotPass paralogues (18–23).
 *
 * Child paralogues (5–16) sit at template positions only: the plan chooses whether and where to play each, and the
 * template's position breaks ties.
 */

/** Apotheosis on its secret route: the Full route's endpoint. */
export const APOTHEOSIS_SECRET = 'apotheosis-secret';

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);

export const FULL_ROUTE_ORDER: readonly string[] = [
  'premonition',
  'prologue',
  'chapter-1',
  'chapter-2',
  'chapter-3',
  'paralogue-1',
  'chapter-4',
  'champions-of-yore-1',
  'champions-of-yore-2',
  'chapter-5',
  'paralogue-2',
  'chapter-6',
  'chapter-7',
  'paralogue-3',
  'chapter-8',
  'chapter-9',
  'paralogue-4',
  'champions-of-yore-3',
  'chapter-10',
  'chapter-11',
  'chapter-12',
  'chapter-13',
  'paralogue-12',
  'paralogue-8',
  'chapter-14',
  'chapter-15',
  'paralogue-5',
  'chapter-16',
  'paralogue-7',
  'paralogue-9',
  'chapter-17',
  ...range('lost-bloodlines', 3),
  'paralogue-14',
  'paralogue-13',
  'chapter-18',
  ...range('smash-brethren', 3),
  'summer-scramble',
  'harvest-scramble',
  'chapter-19',
  'paralogue-15',
  'chapter-20',
  'paralogue-10',
  'chapter-21',
  'paralogue-6',
  'chapter-22',
  'paralogue-11',
  'chapter-23',
  'paralogue-16',
  'paralogue-17',
  'hot-spring-scramble',
  'chapter-24',
  ...range('rogues-redeemers', 3),
  'deaths-embrace',
  'five-anna-firefight',
  'roster-rescue',
  'chapter-25',
  'paralogue-18',
  'paralogue-22',
  'paralogue-21',
  'paralogue-20',
  'paralogue-19',
  ...range('the-future-past', 3),
  'endgame',
  'paralogue-23',
  'infinite-regalia',
  'apotheosis',
  APOTHEOSIS_SECRET,
];

export const MAIN_STORY_ORDER: readonly string[] = [
  'premonition',
  'prologue',
  'chapter-1',
  'chapter-2',
  'chapter-3',
  'paralogue-1',
  'chapter-4',
  'chapter-5',
  'paralogue-2',
  'chapter-6',
  'chapter-7',
  'paralogue-3',
  'chapter-8',
  'chapter-9',
  'paralogue-4',
  'chapter-10',
  'chapter-11',
  'chapter-12',
  'chapter-13',
  ...Array.from({ length: 12 }, (_, i) => `paralogue-${i + 5}`),
  'chapter-14',
  'chapter-15',
  'chapter-16',
  'chapter-17',
  'chapter-18',
  'paralogue-17',
  'chapter-19',
  'chapter-20',
  'chapter-21',
  'chapter-22',
  'chapter-23',
  'chapter-24',
  'chapter-25',
  'endgame',
];

/** Maps on a template the plan may leave out: kept only when its rewards earn its risk. */
export const OPTIONAL_MAPS: readonly string[] = ['infinite-regalia'];
