/**
 * The adopted plan and the player's edits (#204; spec #175, The inbox, Run view and Wishlist tab): where they live on
 * the run (`Run.adopted`, `Run.edits`), and how an edit is made and undone.
 *
 * - **The adopted plan** is the plan the player took: a proposal or close call accepted, a Robin chosen, a plan edit
 *   made (a build skill, a lineup, a seal…). The solve starts from it and every edit's cost is read against it; the
 *   search's improvements only ever arrive as proposals. Without one, the seed is the adopted plan.
 * - **An edit** either sets pins (#200: a marriage, a rule-out, keep-in or keep-out, a side goal), which hold whatever
 *   plan is adopted later, or replaces the adopted plan (an edit the pins can't say). Either way it's listed in "Your
 *   edits" with an undo: undo lifts its pins, or restores the plan it replaced (and so drops the plan edits made on
 *   top of it; their pins stay).
 * - **A dismissed proposal** is hidden by its id (`proposalId`): the edits it makes, in order.
 */
import type { Run, RunEdit } from '../run';
import type { Plan, PlanPin, PlanProposal } from './plan';
import { withPin, withoutPins } from './pins';
/** A proposal's id, for dismissing it: the edits it makes to the adopted plan, in order. */
export const proposalId = (p: Pick<PlanProposal, 'edits'>): string => p.edits.join(' · ');

/** The run with a proposal dismissed (hidden from the inbox). */
export function withDismissedProposal(run: Run, id: string): Run {
  const ids = run.dismissedProposals ?? [];
  return ids.includes(id) ? run : { ...run, dismissedProposals: [...ids, id] };
}

/**
 * The adopted plan as the solve can start from it: none when its Robin contradicts the run facts (a Robin set by hand
 * or locked since), so the seed for that Robin takes over.
 */
export function adoptedOf(run: Run): Plan | undefined {
  const plan = run.adopted;
  if (!plan) return undefined;
  const f = run.roster.run;
  const r = plan.robin;
  return (f.gender && f.gender !== r.gender) || (f.asset && f.asset !== r.asset) || (f.flaw && f.flaw !== r.flaw) ? undefined : plan;
}

/**
 * The run with the plan it's played by held (#208): recording a map adopts the plan the player held (the seed, when
 * nothing was adopted), so a loss recorded on it is read against the plan as it stood before it. Without this the held
 * plan is the seed of the run as recorded, which already plans around the loss (the loss item then reads "it broke
 * nothing"). An adopted plan that still fits the run facts is kept.
 */
export function withPlanHeld(run: Run, plan: Plan): Run {
  return adoptedOf(run) ? run : { ...run, adopted: plan };
}

/** An edit as it's made: its words, the pins it sets, the plan it adopts, and its cost if read. */
export type NewEdit = Omit<RunEdit, 'before' | 'pins'> & { readonly pins?: readonly PlanPin[]; readonly plan?: Plan };

/** The run with an edit made: its pins set, its plan adopted (the one it replaced kept for undo), and listed. */
export function withEdit(run: Run, edit: NewEdit): Run {
  const { plan, pins = [], ...rest } = edit;
  let next = pins.reduce(withPin, run);
  if (plan) next = { ...next, adopted: plan };
  const made: RunEdit = { ...rest, ...(pins.length ? { pins } : {}), ...(plan ? { before: run.adopted ?? null } : {}) };
  return { ...next, edits: [...(run.edits ?? []), made] };
}

/**
 * The run with the `index`th edit undone: its pins lifted; for a plan edit, the plan it replaced adopted again (none:
 * the seed), and the plan edits made after it dropped with it (they were made on the plan it replaced). Pins set by
 * later edits stay.
 */
export function withoutEdit(run: Run, index: number): Run {
  const edits = run.edits ?? [];
  const e = edits[index];
  if (!e) return run;
  let next = e.pins?.length ? withoutPins(run, e.pins) : run;
  const planEdit = 'before' in e;
  const kept = edits.filter((x, i) => i < index || (i > index && !(planEdit && 'before' in x)));
  if (planEdit) {
    const { adopted: _, ...rest } = next;
    next = e.before ? { ...rest, adopted: e.before } : rest;
  }
  const { edits: _e, ...base } = next;
  return kept.length ? { ...base, edits: kept } : base;
}
