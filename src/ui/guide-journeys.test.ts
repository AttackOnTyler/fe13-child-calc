import { describe, expect, it } from 'vitest';
import type { GuideFacts } from './guide-facts';
import { LEDGER_UI, NOT_BORN_UI, PIN_LOSS_UI } from './labels';
import { JOURNEYS, journeyProgress, stepDone, type JourneyStep } from './guide-journeys';

const none: GuideFacts = {
  contextChosen: false,
  deployEdited: false,
  prioritiesSet: false,
  rolesSuggested: false,
  robinLocked: false,
  unitBenched: false,
  planAdopted: false,
  planCurrent: false,
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

  it('has the twelve steps, ending on Pin or rule out, Adopt and Lock', () => {
    expect(steps).toHaveLength(12);
    expect(steps[9]!.title).toBe('Pin or rule out marriages');
    expect(steps[10]!.target).toBe('adopt');
    expect(steps[11]).toMatchObject({ view: 'plan', target: 'robin-lock' });
  });

  it('tracks context, deploy, bench, priorities, Suggest roles, Adopt and Lock', () => {
    expect(journeyProgress(steps, none)).toEqual({ done: 0, tracked: 7 });
    expect(journeyProgress(steps, all)).toEqual({ done: 7, tracked: 7 });
    const ticks = (facts: Partial<GuideFacts>) => steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ contextChosen: true })).toEqual(['play-context']);
    expect(ticks({ deployEdited: true })).toEqual(['deploy']);
    expect(ticks({ unitBenched: true })).toEqual(['bench']);
    expect(ticks({ prioritiesSet: true })).toEqual(['priority']);
    expect(ticks({ rolesSuggested: true })).toEqual(['suggest-roles']);
    expect(ticks({ planAdopted: true })).toEqual(['adopt']);
    expect(ticks({ robinLocked: true })).toEqual(['robin-lock']);
  });
});

describe('the After a loss journey', () => {
  const { steps } = JOURNEYS.loss;

  it('follows Fresh run on the switch', () => {
    expect(Object.keys(JOURNEYS)).toEqual(['fresh', 'loss']);
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
    expect(ticks({ planCurrent: true })).toEqual(['adopt']);
    expect(ticks({ planAdopted: true })).toEqual([]);
  });

  it('names left out, can’t be born, broken and on hold as the app shows them', () => {
    const copy = steps.map((s) => `${s.title} ${s.takeaway} ${s.note ?? ''}`).join(' ');
    for (const label of [LEDGER_UI['left-out'].label, NOT_BORN_UI.unborn, NOT_BORN_UI.leftOut, PIN_LOSS_UI.broken.label, PIN_LOSS_UI['on-hold'].label])
      expect(copy).toContain(label);
  });
});
