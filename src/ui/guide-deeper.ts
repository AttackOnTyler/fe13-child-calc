/**
 * The guide's Going deeper questions as data: each has a one-line answer (or, for Why this spouse?, three steps), a
 * jump to the view and control that answers it, and a Terms fold for the drill-down-only words. Entries never tick.
 */
import { DEFAULT_PRIORITY, type ChildId } from '../engine';
import type { GuideTarget } from './guide';
import { BASIS_LABELS, LABELS, ROLE_UI } from './labels';

export type DeeperId = 'strongest' | 'why-spouse' | 'pairing-build' | 'robin' | 'preset' | 'scoring' | 'assumption' | 'unit-class-tree' | 'unit-partners' | 'robin-preview';

/**
 * Where an entry's jump goes: the All children leaderboard, a child's table (the one `guideChild` picks, with its Robin
 * row open for `robinRow`), the Validation panel, the Scoring sidebar on the current view, or Lon'qu's unit page. Then it highlights `target`.
 */
export type DeeperJump = {
  readonly to: 'leaderboard' | 'child' | 'validation' | 'scoring' | 'unit' | 'robin';
  readonly target: GuideTarget;
  readonly robinRow?: true;
};

export type DeeperTerm = { readonly term: string; readonly def: string };

export type DeeperEntry = {
  readonly id: DeeperId;
  readonly question: string;
  /** One line, or the ordered steps when the answer is a sequence. */
  readonly answer: string | readonly string[];
  readonly jump: DeeperJump;
  /** The answer once Robin is locked, with no jump: nothing is left to choose. */
  readonly lockedAnswer?: string;
  readonly terms: readonly DeeperTerm[];
};

const { runFacts, inPlan, scoreWithThis, allChildren, skills, assumption, validation, plan, spdToTarget, spdBeyond, lock } = LABELS;
const bases = Object.values(BASIS_LABELS).join(' / ');

const PAIRING: DeeperTerm = {
  term: 'pairing',
  def: 'One way a child can be born: its variable parent, plus Robin’s asset and flaw wherever Robin is involved. One pairing is one table row.',
};
const SCORE: DeeperTerm = {
  term: 'score',
  def: `0–100: how good a pairing’s child is, in its best class. The tables score with the Scoring sidebar’s preset; the ${LABELS.plan} scores each child with its plan preset.`,
};

export const DEEPER: readonly DeeperEntry[] = [
  {
    id: 'strongest',
    question: 'Who’s strongest overall?',
    answer: `${allChildren}: every child’s best score, ranked.`,
    jump: { to: 'leaderboard', target: 'leaderboard' },
    terms: [SCORE, PAIRING],
  },
  {
    id: 'why-spouse',
    question: 'Why this spouse for this child?',
    answer: [
      'Open the child from the left rail.',
      `Click “${plan}: ‹preset› ${scoreWithThis}”, so the table scores with the preset the ${plan} uses.`,
      `Find the ${inPlan} row: that’s the plan’s pairing. The rows above it score higher alone, but the plan weighs every child at once.`,
    ],
    jump: { to: 'child', target: 'score-with-plan-preset' },
    terms: [
      PAIRING,
      { term: 'variable parent', def: 'The parent your marriage picks (the other, the fixed parent, it always has). The table compares them row by row.' },
      {
        term: 'blocked pairing',
        def: 'A pairing your roster contradicts: hard (✕) when it can no longer happen (a unit is dead, missed or married to someone else), soft (!) when it only goes against a pin or a bench.',
      },
      { term: inPlan, def: `The row is in the saved marriage plan (${LABELS.adoptPlan}).` },
    ],
  },
  {
    id: 'pairing-build',
    question: 'What does this pairing build?',
    answer: `Press ${skills} on any row: its drawer lists the build templates the pairing reaches, the skills it can inherit, and its class skills.`,
    jump: { to: 'child', target: 'skills-drawer' },
    terms: [
      { term: 'build template', def: 'A curated 5-skill loadout for one job, tagged with the play contexts it suits.' },
      { term: 'coverage (5/5)', def: 'How many of a build template’s five skills the pairing can reach: 5/5, 4/5 or 3/5. Below 3/5 isn’t shown.' },
    ],
  },
  {
    id: 'robin',
    question: 'Which Robin does this child want?',
    answer: `Expand the child’s Robin row: its asset × flaw heatmap scores every Robin. To get that Robin, raise the child’s priority and ${lock} Robin from the ${plan}’s pick line.`,
    jump: { to: 'child', target: 'robin-heatmap', robinRow: true },
    lockedAnswer: 'Robin is locked, so there’s nothing left to choose.',
    terms: [],
  },
  {
    id: 'preset',
    question: 'Which preset suits this child?',
    answer: `Its plan preset is derived: the preset where it stands highest against the cast, in its best role. Switch the Scoring sidebar’s preset to compare its table under others, and pin a role or preset on the ${plan}’s Roles matrix if you want a different build.`,
    jump: { to: 'child', target: 'scoring-preset' },
    terms: [
      {
        term: 'sidebar preset vs plan preset',
        def:
          `The Scoring sidebar’s preset is how the tables score, for every child at once. A plan preset is how the ${plan} judges ` +
          `one child, and it sets the child’s ${ROLE_UI.lead.short}/${ROLE_UI.battery.short}/${ROLE_UI.staff.short} letter. A child’s table opens on its plan preset; picking a sidebar preset explores others and never changes the plan.`,
      },
    ],
  },
  {
    id: 'scoring',
    question: 'Can I change how children are scored?',
    answer:
      `Yes: the basis, the Spd target and edits to a preset’s weights change the ${plan} (editing a preset’s weights re-scores every ` +
      'child on that preset). Picking a sidebar preset only changes the tables.',
    jump: { to: 'scoring', target: 'scoring-basis' },
    terms: [
      {
        term: `score basis (${bases})`,
        def: `What a score measures: effective caps with Limit Breaker (${BASIS_LABELS['caps-lb']}), without it (${BASIS_LABELS.caps}), or growth rates, the no-grind stand-in (${BASIS_LABELS.growths}).`,
      },
      { term: 'effective cap', def: 'A child’s max for a stat in a class: the class max plus the child’s modifier, plus 10 (not HP) with Limit Breaker.' },
      {
        term: `target breakpoint and speed margin (${spdToTarget}, ${spdBeyond})`,
        def: `The Spd total a unit should reach to be fast enough (the sidebar’s Target), plus a margin against debuffs and faster enemies. Spd up to both scores at the ${spdToTarget} weight, beyond them at the small ${spdBeyond} weight.`,
      },
      { term: 'Mixed', def: 'A preset that scores whichever of Str or Mag is higher and ignores the other.' },
      { term: 'weights', def: 'How much each stat point counts in a preset’s score. ↺ Reset goes back to the curated weights.' },
    ],
  },
  {
    id: 'assumption',
    question: `What does ${assumption} mean?`,
    answer: `A game rule the app couldn’t verify. ${validation} lists each one and lets you override it for your run.`,
    jump: { to: 'validation', target: 'validation' },
    terms: [],
  },
  {
    id: 'unit-class-tree',
    question: 'What can this unit become?',
    answer: [
      'Units in the rail opens a page for each first-gen unit.',
      'Its class tree lists each class in its set and what a Master Seal promotes it to, with the skills each teaches and at which level; DLC classes are dimmed.',
      '★ marks a starting skill: kept for good, even when no class it can reach teaches it (Walhart’s Conquest).',
      'Build coverage matches the build templates against everything it can reach, in the play context.',
    ],
    jump: { to: 'unit', target: 'unit-class-tree' },
    terms: [
      { term: 'unit page', def: 'A first-gen unit seen on its own: its join data, class tree, build coverage, what it passes as a parent, and pair-up.' },
      { term: 'class tree', def: 'A unit’s classes as base → promotion lines plus DLC classes, each with its skills and levels.' },
      { term: 'starting skill', def: 'A skill a unit joins with. It keeps it whatever its class.' },
    ],
  },
  {
    id: 'unit-partners',
    question: 'Who should this unit marry?',
    answer: [
      'Partners on a unit page lists everyone it can S-support, Robin included, with the children each marriage produces.',
      'Each child is scored in its plan preset; rows are sorted by the best child, so one great child beats two middling ones.',
      `Marks show a marriage that happened, the saved plan’s pick (◆), a dead partner, and a blocked marriage with why.`,
      `It never changes your plan: Plan → opens the ${plan}, where pinning the marriage shows what it costs the rest.`,
    ],
    jump: { to: 'unit', target: 'unit-partners' },
    terms: [{ term: 'Partners', def: 'A unit page’s list of possible spouses and the children each marriage produces, read-only.' }],
  },
  {
    id: 'robin-preview',
    question: 'What does Robin’s page show before Robin is set?',
    answer: [
      `Robin’s page follows the ${runFacts}: your Robin’s gender and asset/flaw.`,
      'Until they’re set, a Preview bar lets you try any Robin. The page, its builds and its Partners follow the preview, and nothing is saved.',
      'Partners show Morgan, plus the partner’s own child where Robin is a parent. With a child partner, Morgan uses that child’s saved-plan pairing, else its best pairing left, and says which.',
    ],
    jump: { to: 'robin', target: 'robin-preview' },
    terms: [{ term: 'preview', def: 'A Robin tried on Robin’s page while the Run facts leave Robin open. It never writes to the Run facts.' }],
  },
];

/** The entry with this id. */
export const deeperEntry = (id: DeeperId): DeeperEntry => DEEPER.find((e) => e.id === id)!;

/** What an entry shows: its answer as a list of lines, and its jump; none once Robin is locked where that leaves nothing to choose. */
export function deeperView(entry: DeeperEntry, robinLocked: boolean): { answer: readonly string[]; jump: DeeperJump | undefined } {
  if (robinLocked && entry.lockedAnswer) return { answer: [entry.lockedAnswer], jump: undefined };
  return { answer: typeof entry.answer === 'string' ? [entry.answer] : entry.answer, jump: entry.jump };
}

/**
 * The child a table jump shows: the last child opened, else the top-priority child (the first of `children` on a tie).
 * `children` are the ones in this run, in rail order.
 */
export function guideChild(lastOpened: ChildId | undefined, priorities: Readonly<Partial<Record<ChildId, number>>>, children: readonly ChildId[]): ChildId {
  if (lastOpened && children.includes(lastOpened)) return lastOpened;
  const priority = (c: ChildId) => priorities[c] ?? DEFAULT_PRIORITY;
  return children.reduce((best, c) => (priority(c) > priority(best) ? c : best), children[0]!);
}

