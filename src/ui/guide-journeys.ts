/**
 * The guide's journeys as data: each step names its view and the control it points at, and ticks from `guideFacts`
 * where there is a state to detect. Copy interpolates the labels module, so a rename there reaches the guide.
 */
import type { GuideTarget } from './guide';
import type { DeeperId } from './guide-deeper';
import type { GuideFacts } from './guide-facts';
import { LABELS, LEDGER_UI, LEFT_OUT_UI, NOT_BORN_UI, PIN_LOSS_UI, ROLE_UI, STATE_UI } from './labels';
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

export const VIEW_NAMES: Readonly<Record<GuideView, string>> = { roster: LABELS.roster, plan: LABELS.plan };

const { pinned, married, ruleOut, adoptPlan, lock, freeReplan, pin, roster, plan, runFacts, playContext, changedVsSaved, bestRemaining } =
  LABELS;
const { total, swap, assumption, validation, ledgerStatus } = LABELS;
const stateLabel = (s: keyof typeof STATE_UI) => `${STATE_UI[s].icon} ${STATE_UI[s].label}`;
const roles = Object.values(ROLE_UI);
const ledgerLabel = (s: keyof typeof LEDGER_UI) => `${LEDGER_UI[s].mark} ${LEDGER_UI[s].label}`;
const { broken, 'on-hold': onHold } = PIN_LOSS_UI;
const leftOutReasons = Object.values(LEFT_OUT_UI).map((r) => r.label).join(', ');

const FRESH: JourneyContent = {
  title: 'Fresh run',
  ask: `I’m starting a run: who should everyone marry? Set up the run on ${roster} first, then plan.`,
  steps: [
    {
      view: 'roster',
      target: 'run-setup',
      where: `${roster} › ${runFacts}`,
      title: 'Set the difficulty, mode and route',
      takeaway:
        `Your run’s difficulty (Normal to Lunatic+), mode (Classic: the fallen stay dead; Casual: they come back) and route: ` +
        `${CONTEXT_LABELS['main-story']}, or ${CONTEXT_LABELS['full-route']} (the non-grind DLC woven into the campaign, ending at Apotheosis). ` +
        `They’re ${runFacts}: the route also sets the ${playContext} to match.`,
      tick: 'runSetUp',
    },
    {
      view: 'roster',
      target: 'play-context',
      where: `Header › ${playContext}`,
      title: 'Check your play context',
      takeaway:
        `What you’re building for: ${CONTEXT_LABELS.apotheosis}, ${CONTEXT_LABELS['main-story']} (Lunatic/+), ` +
        `${CONTEXT_LABELS['full-route']} or ${CONTEXT_LABELS.all}. It starts from your route; change it to explore builds for another ` +
        `context, which never changes your run. It sets the Spd target, DLC reach, and the defaults the ${plan} starts from.`,
      tick: 'contextChosen',
    },
    {
      view: 'roster',
      target: 'run-facts',
      where: `${roster} › ${runFacts}`,
      title: 'Set Robin now, or leave Robin open',
      takeaway:
        `${runFacts} are Robin’s gender, asset and flaw: once set, the other Robins and Morgans drop out. Set them now if you ` +
        `know your Robin, or if Robin’s own marriage is the goal. Otherwise leave them open: the plan picks a Robin and you ${lock} it at the end. ` +
        `Until Robin is set, the ${plan}’s Roles matrix asks you to set Robin first, and Morgan’s rows read “needs Robin”.`,
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
        `The app’s pick of one spouse per unit, maximising ${total} priority × score over the children. A child’s score (0–100) is ` +
        `how good its best pairing is under its plan preset, in its best class. Its letter is its deployment role: ` +
        `${roles.map((r) => `${r.short} ${r.label}`).join(', ')}. Click a child to see its pairings scored the plan’s way, ` +
        'with the plan’s pairing highlighted.',
      deeper: ['why-spouse', 'pairing-build'],
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
        'counts unless it’s benched. Army fit meets the ranges on its own, moving the children it costs least. ' +
        '✎ edits the ranges if your army differs. Out of range is a warning, never a block.',
    },
    {
      view: 'plan',
      target: 'plan-preset',
      where: `${plan} › Roles › preset override`,
      title: 'Pin the roles and presets you disagree with',
      takeaway:
        'A plan preset is how a child is judged (lead, support, tank, staff…), and it sets the child’s deployment letter. ' +
        'The Roles matrix shows where each child stands in every role: derived is its best role, or where army fit moved it ' +
        '(marked, with the quota that forced it). Click a cell to pin a role (its preset stays derived), or pick a preset ' +
        'in the menu to pin that; ↺ goes back to derived.',
      deeper: ['preset'],
    },
    {
      view: 'plan',
      target: 'robin-gain',
      where: `${plan} › Roles › Robin gain, No Robin`,
      title: 'Weigh what Robin is worth to each child',
      takeaway:
        'Robin is the best parent for nearly every child, and can marry only one. Robin gain is how much more a child ' +
        'scores (under its Lead role preset) with Robin in the gene pool than without, naming both pairings: your Robin ' +
        'once set, else its best Robin. Tick No Robin to see the cast in a world without Robin: Robin is no one’s parent, ' +
        'Morgan leaves the cast and Robin isn’t deployed, and standings, roles and the plan rerun.',
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
      deeper: ['robin'],
    },
  ],
};

const LOSS: JourneyContent = {
  title: 'After a loss',
  ask:
    `A unit died, a recruit was missed, or a marriage went off-plan. Record what happened on ${roster}, see which children ` +
    `it hurts, then re-plan and adopt on ${plan}.`,
  steps: [
    {
      view: 'roster',
      target: 'state-strip',
      where: `${roster} › unit rows › state strip`,
      title: `Mark ${stateLabel('dead')}, ${stateLabel('missed')} or ${stateLabel('benched')}`,
      takeaway:
        `Hard (red, struck through) can’t be undone in your game: ${stateLabel('dead')} and ${stateLabel('missed')} are gone for good, ` +
        `a pin through the unit is ${broken.label} and frees the partner, and pairings that need it are hard-blocked. ` +
        `Soft (amber) is your choice and reversible: ${stateLabel('benched')} puts a pin through the unit ${onHold.label}, freeing ` +
        `the partner until un-benching brings the pin back. Mark ${stateLabel('missed')} ` +
        `only once recruiting is truly impossible; ${stateLabel('not-recruited')} prunes nothing. Bench is also a what-if: bench a unit ` +
        `to ask “what if I drop them?”, read the ${plan}, and un-bench if you don’t like it.`,
      tick: 'unitLost',
      note:
        `Died after their ${married} S-support? Mark ${stateLabel('dead')} anyway. The app assumes their child can still be recruited; ` +
        `that rule is unverified (${assumption}), and you can override it in ${validation} if your run says otherwise.`,
    },
    {
      view: 'roster',
      target: 'married',
      where: `${roster} › unit rows › spouse picker + ${married}`,
      title: 'Record every real marriage, off-plan ones too',
      takeaway:
        `Pick the spouse and press ${married} for every S-support that happened in your game, including ones the plan didn’t want. ` +
        `A marriage is hard: it overrides pins through either partner.`,
      tick: 'marriageRecorded',
    },
    {
      view: 'roster',
      target: 'children-ledger',
      where: `${roster} › children ledger`,
      title: 'Scan the children ledger',
      takeaway:
        `One row per child, with its fixed parent (the one it always has). ${ledgerStatus} tells you which children are hurt: ` +
        `${ledgerLabel('broken')} (the saved pairing can’t happen: it is struck through in the plan column, and hovering the status says why), ${ledgerLabel('on-hold')} (a parent is benched), ` +
        `${ledgerLabel('left-out')} (it can still be born, but this plan doesn’t produce it: ${leftOutReasons}), ` +
        `${ledgerLabel('unborn')}, ${ledgerLabel('dead')}. The plan’s pairing column already shows the re-plan; ${bestRemaining} is ` +
        'the best the child could still get if you prioritised it: raise its priority if that’s worth chasing. ' +
        'A ⚠ after a status is a note that blocks nothing, such as a parent who died after marrying (the child still comes): hover it to read it.',
      deeper: ['why-spouse'],
    },
    {
      view: 'plan',
      target: 'plan-diff',
      where: `${plan} › ${broken.banner} / ${onHold.banner} + ${changedVsSaved}`,
      title: 'Read what broke and what replaces it',
      takeaway:
        `The banners list the pins that are ${broken.label} or ${onHold.label}. ${changedVsSaved} tells you why and what replaces it: ` +
        `${total} before → after; ${NOT_BORN_UI.unborn} (red, gone for good); ${NOT_BORN_UI.leftOut} (amber, with the reason, so you know ` +
        `whether raising its priority or pinning its parent would help); and ${swap}, every spouse swap.`,
    },
    {
      view: 'plan',
      target: 'free-replan',
      where: `${plan} › ${freeReplan}`,
      title: 'Keep your pins; go free only to see their cost',
      takeaway:
        `Keep pins by default: a pin usually means supports already being built. ${freeReplan} shows the best plan without them. ` +
        `Go free only when the gain beats restarting the pairings its ${swap} line lists.`,
    },
    {
      view: 'plan',
      target: 'adopt',
      where: `${plan} › ${adoptPlan}`,
      title: `${adoptPlan}, every time`,
      takeaway:
        'Always adopt after recording a loss. Otherwise the next diff compares against a dead plan, and the ' +
        `${broken.banner} banner keeps growing. Ticks once the adopted plan has no dead or missed partner and holds every real marriage.`,
      tick: 'adoptedPlanHolds',
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
