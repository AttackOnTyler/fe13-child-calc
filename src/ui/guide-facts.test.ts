import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, withRun } from '../engine';
import { guideFacts } from './guide-facts';

describe('guide facts', () => {
  it('say Robin is locked once every run fact is set, and not while one is open', () => {
    expect(guideFacts(EMPTY_ROSTER).robinLocked).toBe(false);
    expect(guideFacts(withRun(EMPTY_ROSTER, { gender: 'F', asset: 'spd' })).robinLocked).toBe(false);
    expect(guideFacts(withRun(EMPTY_ROSTER, { gender: 'F', asset: 'spd', flaw: 'def' })).robinLocked).toBe(true);
  });

  it('say the run is set up once difficulty and route are set (#108)', () => {
    expect(guideFacts(EMPTY_ROSTER).runSetUp).toBe(false);
    expect(guideFacts(withRun(EMPTY_ROSTER, { difficulty: 'lunatic' })).runSetUp).toBe(false);
    expect(guideFacts(withRun(EMPTY_ROSTER, { difficulty: 'lunatic', route: 'main-story' })).runSetUp).toBe(true);
  });

  it('read only what the welcome’s Plan a run ticks: the journeys’ facts retired with them (#213)', () => {
    expect(Object.keys(guideFacts(EMPTY_ROSTER)).sort()).toEqual(['robinLocked', 'runSetUp']);
  });
});
