import { describe, expect, it } from 'vitest';
import type { GuideFacts } from './guide-facts';
import * as welcome from './guide-welcome';
import { JUST_EXPLORE, PLAN_A_RUN, startProgress, stepDone } from './guide-welcome';

const none: GuideFacts = { runSetUp: false, robinLocked: false };
const all: GuideFacts = { runSetUp: true, robinLocked: true };

describe('the welcome', () => {
  it('offers Plan a run and Just explore, nothing else: the journeys retired (#213)', () => {
    expect([PLAN_A_RUN.title, JUST_EXPLORE.title]).toEqual(['Plan a run', 'Just explore']);
    expect(Object.keys(welcome)).not.toContain('JOURNEYS');
    const copy = JSON.stringify([PLAN_A_RUN, JUST_EXPLORE]);
    for (const gone of ['Fresh run', 'After a loss', 'Re-plan', 'dock', 'Plan page']) expect(copy).not.toContain(gone);
  });

  it('plans a run in Run facts, then on the inbox’s Robin card', () => {
    expect(PLAN_A_RUN.steps.map((s) => [s.view, s.target])).toEqual([
      ['roster', 'run-facts'],
      ['run', 'robin-card'],
    ]);
    expect(PLAN_A_RUN.steps[1]!.takeaway).toMatch(/inbox/);
    expect(PLAN_A_RUN.steps[1]!.takeaway).toMatch(/flawless chance/);
  });

  it('ticks the run set up, then Robin locked', () => {
    expect(startProgress(PLAN_A_RUN.steps, none)).toEqual({ done: 0, of: 2 });
    expect(startProgress(PLAN_A_RUN.steps, all)).toEqual({ done: 2, of: 2 });
    const ticks = (facts: Partial<GuideFacts>) => PLAN_A_RUN.steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ runSetUp: true })).toEqual(['run-facts']);
    expect(ticks({ robinLocked: true })).toEqual(['robin-card']);
  });

  it('explores from the Table view', () => {
    expect([JUST_EXPLORE.view, JUST_EXPLORE.target]).toEqual(['table', 'child-table']);
  });
});
