import { describe, expect, it } from 'vitest';
import type { GuideFacts } from './guide-facts';
import { LEDGER_UI } from './labels';
import { JOURNEYS, journeyProgress, stepDone, type JourneyStep } from './guide-journeys';

const none: GuideFacts = {
  runSetUp: false,
  contextChosen: false,
  robinLocked: false,
  unitLost: false,
  marriageRecorded: false,
};
const all: GuideFacts = Object.fromEntries(Object.keys(none).map((k) => [k, true])) as GuideFacts;

const step = (tick?: JourneyStep['tick']): JourneyStep => ({ view: 'roster', target: 'run-facts', where: 'w', title: 't', takeaway: 'x', tick });

describe('journey steps', () => {
  it('stay untracked with nothing to detect', () => {
    expect(stepDone(step(), all)).toBeUndefined();
  });

  it('tick from their fact, or from every fact in a list', () => {
    expect(stepDone(step('runSetUp'), none)).toBe(false);
    expect(stepDone(step('runSetUp'), { ...none, runSetUp: true })).toBe(true);
    expect(stepDone(step(['runSetUp', 'robinLocked']), { ...none, runSetUp: true })).toBe(false);
    expect(stepDone(step(['runSetUp', 'robinLocked']), { ...none, runSetUp: true, robinLocked: true })).toBe(true);
  });
});

describe('the Fresh run journey', () => {
  const { steps } = JOURNEYS.fresh;

  it('keeps only the Run facts and play context steps: the Plan page’s went with it (#212)', () => {
    expect(steps.map((s) => [s.view, s.target])).toEqual([
      ['roster', 'run-setup'],
      ['roster', 'play-context'],
      ['roster', 'run-facts'],
    ]);
  });

  it('tracks run setup, context and Robin', () => {
    expect(journeyProgress(steps, none)).toEqual({ done: 0, tracked: 3 });
    expect(journeyProgress(steps, all)).toEqual({ done: 3, tracked: 3 });
    const ticks = (facts: Partial<GuideFacts>) => steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ runSetUp: true })).toEqual(['run-setup']);
    expect(ticks({ contextChosen: true })).toEqual(['play-context']);
    expect(ticks({ robinLocked: true })).toEqual(['run-facts']);
  });

  it('says the play context is the explorer’s, and the wishlist reads the route', () => {
    const context = steps.find((s) => s.target === 'play-context')!;
    expect(context.takeaway).toMatch(/explorer/);
    expect(context.takeaway).toMatch(/wishlist reads its build templates from the route/);
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

  it('records on Roster, then reads the ledger on the Wishlist tab', () => {
    expect(steps.map((s) => [s.view, s.target])).toEqual([
      ['roster', 'state-strip'],
      ['roster', 'spouse-picker'],
      ['wishlist', 'children-ledger'],
    ]);
  });

  it('ticks a loss and a real marriage', () => {
    expect(journeyProgress(steps, none)).toEqual({ done: 0, tracked: 2 });
    const ticks = (facts: Partial<GuideFacts>) => steps.filter((s) => stepDone(s, { ...none, ...facts })).map((s) => s.target);
    expect(ticks({ unitLost: true })).toEqual(['state-strip']);
    expect(ticks({ marriageRecorded: true })).toEqual(['spouse-picker']);
  });

  it('names the ledger’s statuses as the app shows them', () => {
    const copy = steps.map((s) => `${s.title} ${s.takeaway} ${s.note ?? ''}`).join(' ');
    for (const s of Object.values(LEDGER_UI)) expect(copy).toContain(s.label);
    expect(copy).not.toMatch(/Bench|benched|priority/);
  });
});
