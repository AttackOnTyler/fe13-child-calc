/**
 * The guide's journeys as data: each step names its view and the control it points at, and ticks from `guideFacts`
 * where there is a state to detect. Copy interpolates the labels module, so a rename there reaches the guide.
 */
import type { GuideTarget } from './guide';
import type { GuideFacts } from './guide-facts';
import { LABELS, ROLE_UI, STATE_UI } from './labels';
import { CONTEXT_LABELS } from './scoring-prefs';

/** The views a journey step lives on; a click switches to it. */
export type GuideView = 'roster' | 'plan';

export type JourneyStep = {
  readonly view: GuideView;
  readonly target: GuideTarget;
  readonly title: string;
  /** The one thing to take away, with glossary definitions where a term first appears. */
  readonly takeaway: string;
  /** Where the control is, e.g. "Plan › pick line › Lock". */
  readonly where: string;
  /** The fact (or every fact) that ticks the step; none leaves it untracked. */
  readonly tick?: keyof GuideFacts | readonly (keyof GuideFacts)[];
  /** A note shown after the step. */
  readonly note?: string;
};

export type JourneyContent = {
  /** The journey's name on the switch, the welcome box and the pill. */
  readonly title: string;
  /** The question the journey answers. */
  readonly ask: string;
  readonly steps: readonly JourneyStep[];
};

export const VIEW_NAMES: Readonly<Record<GuideView, string>> = { roster: LABELS.roster, plan: LABELS.plan };

const { pinned, married, ruleOut, adoptPlan, lock, suggestRoles, freeReplan, pin, roster, plan, runFacts, playContext } = LABELS;
const stateLabel = (s: keyof typeof STATE_UI) => `${STATE_UI[s].icon} ${STATE_UI[s].label}`;
const roles = Object.values(ROLE_UI);

const FRESH: JourneyContent = {
  title: 'Fresh run',
  ask: `I’m starting a run: who should everyone marry? Set up the run on ${roster} first, then plan.`,
  steps: [
    {
      view: 'roster',
      target: 'play-context',
      where: `Header › ${playContext}`,
      title: 'Pick your play context',
      takeaway:
        `What you’re building for: ${CONTEXT_LABELS.apotheosis}, ${CONTEXT_LABELS['main-story']} (Lunatic/+), ` +
        `${CONTEXT_LABELS['full-route']} (one playthrough weaving the non-grind DLC into the campaign, ending at Apotheosis) ` +
        `or ${CONTEXT_LABELS.all}. It sets the Spd target, DLC reach, and the defaults the ${plan} starts from, so everything after depends on it.`,
      tick: 'contextChosen',
    },
    {
      view: 'roster',
      target: 'run-facts',
      where: `${roster} › ${runFacts}`,
      title: 'Set Robin now, or leave Robin open',
      takeaway:
        `${runFacts} are Robin’s gender, asset and flaw: once set, the other Robins and Morgans drop out. Set them now if you ` +
        `know your Robin, or if Robin’s own marriage is the goal. Otherwise leave them open: the plan picks a Robin and you ${lock} it at the end.`,
    },
    {
      view: 'roster',
      target: 'deploy',
      where: `${roster} › Deploy`,
      title: 'Tick who you’ll deploy, with their role',
      takeaway:
        `Deploy is whether you’ll field a unit, and its deployment role is its job: ${ROLE_UI.lead.label} fights, ` +
        `${ROLE_UI.battery.label} pairs up behind a lead, ${ROLE_UI.staff.label} heals or rallies, ${ROLE_UI.dancer.label} dances. ` +
        `Children get theirs from their plan preset (how the ${plan} judges them). These count toward the ${plan}’s role quotas, so do it before reading a plan.`,
      tick: 'deployEdited',
    },
    {
      view: 'roster',
      target: 'bench',
      where: `${roster} › ${STATE_UI.benched.icon} Bench`,
      title: 'Bench who you won’t field, children too',
      takeaway:
        `${stateLabel('benched')} is your choice and reversible: a benched child stays in the marriage plan, just not counted as deployed. ` +
        'Every child the plan produces counts as deployed, so benching is the only way under the deploy cap (how many units you’ll field).',
      tick: 'unitBenched',
      note:
        `Skip for now: ${stateLabel('not-recruited')} (changes nothing), ${stateLabel('missed')} and ${stateLabel('dead')} (they’re for After a loss), ` +
        `and ${married}. Use the spouse picker and ${pinned} only for a marriage already decided. A pinned marriage is one ` +
        'you’ve told the plan to keep, and you can undo it; a married one happened in your game.',
    },
    {
      view: 'plan',
      target: 'marriage-table',
      where: `${plan} › marriage table`,
      title: 'Read the marriage plan',
      takeaway:
        'The app’s pick of one spouse per unit, maximising Σ priority × score over the children. A child’s score (0–100) is ' +
        `how good its best pairing is under its plan preset, in its best class. Its letter is its deployment role: ` +
        `${roles.map((r) => `${r.short} ${r.label}`).join(', ')}.`,
    },
    {
      view: 'plan',
      target: 'priority',
      where: `${plan} › priority`,
      title: 'Set each child’s priority',
      takeaway: 'Priority 0–3 is how much you care about a child: 0 = don’t care, 3 = must be great. Everything after this weighs by it.',
      tick: 'prioritiesSet',
    },
    {
      view: 'plan',
      target: 'quota-bar',
      where: `${plan} › quota bar`,
      title: 'Check the quota bar',
      takeaway:
        'How many of each deployment role you want, and the deploy cap. Every child the plan produces ' +
        'counts unless it’s benched. ✎ edits the ranges if your army differs. Out of range is a warning, never a block.',
    },
    {
      view: 'plan',
      target: 'suggest-roles',
      where: `${plan} › ${suggestRoles}`,
      title: `Run ${suggestRoles}`,
      takeaway: `${suggestRoles} re-picks the plan presets still on their default so the army fits the quotas. Its picks are marked suggested.`,
      tick: 'rolesSuggested',
    },
    {
      view: 'plan',
      target: 'plan-preset',
      where: `${plan} › plan preset`,
      title: 'Override the plan presets you disagree with',
      takeaway:
        'A plan preset is how a child is judged (lead, support, tank, staff…), and it sets the child’s deployment letter. ' +
        'default is the curated pick for this play context; ↺ goes back to it.',
    },
    {
      view: 'plan',
      target: 'pin',
      where: `${plan} › ${pin} / ${ruleOut}, ${freeReplan}`,
      title: 'Pin or rule out marriages',
      takeaway:
        `${pin} Pin keeps a marriage; ${ruleOut} Rule out forbids it (rule-outs are listed under the table, with ↺ to rule back in). ` +
        `${freeReplan} shows the best plan without your pins, and what keeping them costs.`,
    },
    {
      view: 'plan',
      target: 'adopt',
      where: `${plan} › ${adoptPlan}`,
      title: adoptPlan,
      takeaway: 'Makes this plan the baseline that later changes are compared to, and pins its marriages (not Robin’s while Robin is open).',
      tick: 'planAdopted',
    },
    {
      view: 'plan',
      target: 'robin-lock',
      where: `${plan} › pick line › ${lock}`,
      title: 'Lock Robin, then create them in the game',
      takeaway:
        `${lock} writes the plan’s Robin into ${runFacts} and pins Robin’s marriage. From here on, re-plans respect the Robin you actually ` +
        'have. If you set Robin at step 2, there’s no pick line and nothing to lock: this step is already done.',
      tick: 'robinLocked',
    },
  ],
};

/** The journeys the dock can show, in switch order. */
export const JOURNEYS = { fresh: FRESH } as const;

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
