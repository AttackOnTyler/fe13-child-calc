/**
 * The guide's journeys as data: each step names its view and the control it points at, and ticks from `guideFacts`
 * where there is a state to detect. Copy interpolates the labels module, so a rename there reaches the guide.
 *
 * #212 retired the Plan page and the Roster's Deploy, Bench and Pinned controls, and with them every step that pointed
 * at one; the journeys themselves retire in #213.
 */
import type { GuideTarget } from './guide';
import type { DeeperId } from './guide-deeper';
import type { GuideFacts } from './guide-facts';
import { LABELS, LEDGER_UI, STATE_UI } from './labels';
import { CONTEXT_LABELS } from './scoring-prefs';

/** The views a journey step lives on; a click switches to it. */
export type GuideView = 'roster' | 'wishlist';

export type JourneyStep = {
  readonly view: GuideView;
  readonly target: GuideTarget;
  readonly title: string;
  /** The one thing to take away, with glossary definitions where a term first appears. */
  readonly takeaway: string;
  /** Where the control is, e.g. "Roster › Run facts". */
  readonly where: string;
  /** The fact (or every fact) that ticks the step; none leaves it untracked. */
  readonly tick?: keyof GuideFacts | readonly (keyof GuideFacts)[];
  /** A note shown after the step. */
  readonly note?: string;
  /** Going deeper entries the step links to with “↳ <question>”. */
  readonly deeper?: readonly DeeperId[];
};

export type JourneyContent = {
  /** The journey's name on the switch, the welcome box and the pill. */
  readonly title: string;
  /** The question the journey answers. */
  readonly ask: string;
  readonly steps: readonly JourneyStep[];
};

export const VIEW_NAMES: Readonly<Record<GuideView, string>> = { roster: LABELS.roster, wishlist: 'Wishlist' };

const { married, lock, roster, runFacts, playContext, assumption, validation, ledgerStatus } = LABELS;
const stateLabel = (s: keyof typeof STATE_UI) => `${STATE_UI[s].icon} ${STATE_UI[s].label}`;
const ledgerLabel = (s: keyof typeof LEDGER_UI) => `${LEDGER_UI[s].mark} ${LEDGER_UI[s].label}`;

const FRESH: JourneyContent = {
  title: 'Fresh run',
  ask: `I’m starting a run: who should everyone marry? Set up the run on ${roster} first; the Run view then proposes a wishlist.`,
  steps: [
    {
      view: 'roster',
      target: 'run-setup',
      where: `${roster} › ${runFacts}`,
      title: 'Set the difficulty, mode and route',
      takeaway:
        `Your run’s difficulty (Normal to Lunatic+), mode (Classic: the fallen stay dead; Casual: they come back) and route: ` +
        `${CONTEXT_LABELS['main-story']}, or ${CONTEXT_LABELS['full-route']} (the non-grind DLC woven into the campaign, ending at Apotheosis). ` +
        `They’re ${runFacts}: the route also sets the explorer’s ${playContext} to match.`,
      tick: 'runSetUp',
    },
    {
      view: 'roster',
      target: 'play-context',
      where: `Header › ${playContext}`,
      title: 'Check your play context',
      takeaway:
        `What the explorer (the pairing tables and unit pages) builds for: ${CONTEXT_LABELS.apotheosis}, ${CONTEXT_LABELS['main-story']} (Lunatic/+), ` +
        `${CONTEXT_LABELS['full-route']} or ${CONTEXT_LABELS.all}. It starts from your route; change it to explore builds for another ` +
        'context, which never changes your run: the wishlist reads its build templates from the route.',
      tick: 'contextChosen',
    },
    {
      view: 'roster',
      target: 'run-facts',
      where: `${roster} › ${runFacts}`,
      title: 'Set Robin now, or leave Robin open',
      takeaway:
        `${runFacts} are Robin’s gender, asset and flaw: once set, the other Robins and Morgans drop out. Set them now if you ` +
        `know your Robin. Otherwise leave them open: the Run view’s Robin card compares Robins by flawless chance, and you ${lock} one there before the Prologue.`,
      tick: 'robinLocked',
      deeper: ['robin'],
    },
  ],
};

const LOSS: JourneyContent = {
  title: 'After a loss',
  ask: `A unit died, a recruit was missed, or a marriage went off-plan. Record what happened, then read the loss item in the Run view’s inbox.`,
  steps: [
    {
      view: 'roster',
      target: 'state-strip',
      where: `${roster} › unit rows › state strip`,
      title: `Mark ${stateLabel('dead')} or ${stateLabel('missed')}`,
      takeaway:
        `Both are hard (red, struck through) and can’t be undone in your game: ${stateLabel('dead')} and ${stateLabel('missed')} are gone for good, ` +
        `and pairings that need the unit are hard-blocked. Mark ${stateLabel('missed')} only once recruiting is truly impossible; ` +
        `${stateLabel('not-recruited')} prunes nothing. Record results in the Run view marks a death or miss for you.`,
      tick: 'unitLost',
      note:
        `Died after their ${married} S-support? Mark ${stateLabel('dead')} anyway. The app assumes their child can still be recruited; ` +
        `that rule is unverified (${assumption}), and you can override it in ${validation} if your run says otherwise.`,
    },
    {
      view: 'roster',
      target: 'spouse-picker',
      where: `${roster} › unit rows › spouse picker`,
      title: 'Record every real marriage, off-plan ones too',
      takeaway: `Pick the spouse for every S-support that happened in your game, including ones the plan didn’t want: it shows ${married}. A marriage is a fact the plan re-solves around.`,
      tick: 'marriageRecorded',
    },
    {
      view: 'wishlist',
      target: 'children-ledger',
      where: 'Wishlist › children ledger',
      title: 'Scan the children ledger',
      takeaway:
        `One row per child, beside the army on the Wishlist tab, with its fixed parent (the one it always has), the wishlist’s parents for it and the skills they pass. ${ledgerStatus} tells you where it stands: ` +
        `${ledgerLabel('wished')}, ${ledgerLabel('out')}, ${ledgerLabel('married')}, ${ledgerLabel('missed')} or ${ledgerLabel('dead')}. ` +
        'What the loss costs, and the re-solve that recovers from it, is the loss item in the Run view’s inbox.',
    },
  ],
};

/** Just look around: no steps, only Going deeper. */
const EXPLORE: JourneyContent = {
  title: 'Explore',
  ask: 'Look around at your own pace. Each question jumps to the view that answers it.',
  steps: [],
};

/** The journeys the dock can show, in switch order. */
export const JOURNEYS = { fresh: FRESH, loss: LOSS, explore: EXPLORE } as const;

export type GuideJourney = keyof typeof JOURNEYS;

/** Whether a step is done; undefined when it has nothing to detect. */
export function stepDone(step: JourneyStep, facts: GuideFacts): boolean | undefined {
  if (step.tick === undefined) return undefined;
  const ticks: readonly (keyof GuideFacts)[] = typeof step.tick === 'string' ? [step.tick] : step.tick;
  return ticks.every((t) => facts[t]);
}

/** Done steps out of the tracked ones, for the pill. */
export function journeyProgress(steps: readonly JourneyStep[], facts: GuideFacts): { done: number; tracked: number } {
  const states = steps.map((s) => stepDone(s, facts)).filter((d) => d !== undefined);
  return { done: states.filter(Boolean).length, tracked: states.length };
}
