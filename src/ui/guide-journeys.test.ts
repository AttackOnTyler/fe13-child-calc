import { describe, expect, it } from 'vitest';
import type { GuideFacts } from './guide-facts';
import { LEDGER_UI, NOT_BORN_UI, PIN_LOSS_UI } from './labels';
import { JOURNEYS, journeyProgress, stepDone, type JourneyStep } from './guide-journeys';

const none: GuideFacts = {
  runSetUp: false,
  contextChosen: false,
  deployEdited: false,
  prioritiesSet: false,
  robinLocked: false,
  childBenched: false,
  planAdopted: false,
  adoptedPlanHolds: false,
  unitLost: false,
  marriageRecorded: false,
};
const all: GuideFacts = Object.fromEntries(Object.keys(none).map((k) => [k, true])) as GuideFacts;

const step = (tick?: JourneyStep['tick']): JourneyStep => ({ view: 'plan', target: 'adopt', where: 'w', title: 't', takeaway: 'x', tick });

describe('journey steps', () => {
  it('stay untracked with nothing to detect', () => {
    expect(stepDone(step(), all)).toBeUndefined();
  });

  it('tick from their fact, or from every fact in a list', () => {
    expect(stepDone(step('planAdopted'), none)).toBe(false);
    expect(stepDone(step('planAdopted'), { ...none, planAdopted: true })).toBe(true);
    expect(stepDone(step(['planAdopted', 'robinLocked']), { ...none, planAdopted: true })).toBe(false);
    expect(stepDone(step(['planAdopted', 'robinLocked']), { ...none, planAdopted: true, robinLocked: true })).toBe(true);
  });
});

describe('the Fresh run journey', () => {
  const { steps } = JOURNEYS.fresh;

  it('has the thirteen steps, from setting up the run to Pin or rule out, Adopt and Lock', () => {
    expect(steps).toHaveLength(13);
    expect(steps[0]).toMatchObject({ view: 'roster', target: 'run-setup' });
    expect(steps[10]!.title).toBe('Pin or rule out marriages');
    expect(steps[11]!.target).toBe('adopt');
    expect(steps[12]).toMatchObject({ view: 'plan', target: 'robin-lock' });
  });

  it('tracks run setup, context, deploy, bench, priorities, Adopt and Lock', () => {
    expect(journeyProgress(steps, none)).toEqual({ done: 0, tracked: 7 });
    expect(journeyProgress(steps, all)).toEqual({ done: 7, tracked: 7 });
    const ticks = (facts: Partial<GuideFacts>) => steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ runSetUp: true })).toEqual(['run-setup']);
    expect(ticks({ contextChosen: true })).toEqual(['play-context']);
    expect(ticks({ deployEdited: true })).toEqual(['deploy']);
    expect(ticks({ childBenched: true })).toEqual(['bench']);
    expect(ticks({ prioritiesSet: true })).toEqual(['priority']);
    expect(ticks({ planAdopted: true })).toEqual(['adopt']);
    expect(ticks({ robinLocked: true })).toEqual(['robin-lock']);
  });

  it('benches children only: a first-gen unit you won’t field unticks Deploy, since benching drops it from the plan', () => {
    const bench = steps.find((s) => s.target === 'bench')!;
    expect(bench.title).toMatch(/children/);
    expect(bench.title).not.toMatch(/too/);
    expect(bench.where).toContain('Children');
    expect(bench.takeaway).toMatch(/first-gen unit you won’t field.*Deploy/);
    expect(bench.takeaway).toMatch(/out of the marriage plan/);
    // Only the children they're the fixed parent of drop out; a benched child can't be Robin's planned spouse.
    expect(bench.takeaway).toMatch(/fixed parent/);
    expect(bench.takeaway).toMatch(/benched child isn’t planned to marry Robin/);
  });
});

describe('Explore', () => {
  it('has no steps, so nothing to tick', () => {
    expect(JOURNEYS.explore.steps).toEqual([]);
    expect(journeyProgress(JOURNEYS.explore.steps, all)).toEqual({ done: 0, tracked: 0 });
  });
});

describe('the After a loss journey', () => {
  const { steps } = JOURNEYS.loss;

  it('follows Fresh run on the switch, before Explore', () => {
    expect(Object.keys(JOURNEYS)).toEqual(['fresh', 'loss', 'explore']);
  });

  it('records on Roster, reads the ledger, then re-plans and adopts on Plan', () => {
    expect(steps.map((s) => [s.view, s.target])).toEqual([
      ['roster', 'state-strip'],
      ['roster', 'married'],
      ['roster', 'children-ledger'],
      ['plan', 'plan-diff'],
      ['plan', 'free-replan'],
      ['plan', 'adopt'],
    ]);
  });

  it('ticks a loss, a real marriage and adopting the re-plan', () => {
    expect(journeyProgress(steps, none)).toEqual({ done: 0, tracked: 3 });
    const ticks = (facts: Partial<GuideFacts>) => steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ unitLost: true })).toEqual(['state-strip']);
    expect(ticks({ marriageRecorded: true })).toEqual(['married']);
    expect(ticks({ adoptedPlanHolds: true })).toEqual(['adopt']);
    expect(ticks({ planAdopted: true })).toEqual([]);
  });

  it('names left out, can’t be born, broken and on hold as the app shows them', () => {
    const copy = steps.map((s) => `${s.title} ${s.takeaway} ${s.note ?? ''}`).join(' ');
    for (const label of [LEDGER_UI['left-out'].label, NOT_BORN_UI.unborn, NOT_BORN_UI.leftOut, PIN_LOSS_UI.broken.label, PIN_LOSS_UI['on-hold'].label])
      expect(copy).toContain(label);
  });
});
