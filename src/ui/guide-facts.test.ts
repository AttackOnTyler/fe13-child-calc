import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, withRun, withSpouse, withState, type Roster } from '../engine';
import { guideFacts, lossPrompt, noteLosses, settleLosses } from './guide-facts';
import { DEFAULT_GUIDE_PREFS, dismissLoss, takeLoss, type GuidePrefs } from './guide-prefs';
import { DEFAULT_PREFS } from './scoring-prefs';

const fresh = () => guideFacts(EMPTY_ROSTER, DEFAULT_PREFS.context);
const factsFor = (roster: Roster) => guideFacts(roster, DEFAULT_PREFS.context);

describe('guide facts', () => {
  it('say the play context is chosen once it leaves the default', () => {
    expect(fresh().contextChosen).toBe(false);
    expect(guideFacts(EMPTY_ROSTER, 'apotheosis').contextChosen).toBe(true);
  });

  it('say Robin is locked once every run fact is set, and not while one is open', () => {
    expect(fresh().robinLocked).toBe(false);
    expect(factsFor(withRun(EMPTY_ROSTER, { gender: 'F', asset: 'spd' })).robinLocked).toBe(false);
    expect(factsFor(withRun(EMPTY_ROSTER, { gender: 'F', asset: 'spd', flaw: 'def' })).robinLocked).toBe(true);
  });

  it('say a unit is lost once one is dead or missed', () => {
    expect(fresh().unitLost).toBe(false);
    expect(factsFor(withState(EMPTY_ROSTER, 'frederick', 'dead')).unitLost).toBe(true);
    expect(factsFor(withState(EMPTY_ROSTER, 'gregor', 'missed')).unitLost).toBe(true);
  });

  it('say a real marriage is recorded', () => {
    expect(fresh().marriageRecorded).toBe(false);
    expect(factsFor(withSpouse(EMPTY_ROSTER, 'chrom', 'sumia', 'married')).marriageRecorded).toBe(true);
  });

  it('no longer read the Plan page’s facts (#212)', () => {
    expect(Object.keys(fresh()).sort()).toEqual(['contextChosen', 'marriageRecorded', 'robinLocked', 'runSetUp', 'unitLost']);
  });
});

describe('the loss prompt', () => {
  const onFresh: GuidePrefs = { ...DEFAULT_GUIDE_PREFS, seen: true, journey: 'fresh', dock: 'open' };

  it('offers After a loss for a new death or missed unit', () => {
    expect(lossPrompt(EMPTY_ROSTER, onFresh)).toEqual([]);
    expect(lossPrompt(withState(EMPTY_ROSTER, 'frederick', 'dead'), onFresh)).toEqual(['dead:frederick']);
    expect(lossPrompt(withState(EMPTY_ROSTER, 'gregor', 'missed'), onFresh)).toEqual(['missed:gregor']);
  });

  it('not for a marriage: a marriage off the plan is the inbox’s loss item (#208)', () => {
    expect(lossPrompt(withSpouse(EMPTY_ROSTER, 'chrom', 'sumia', 'married'), onFresh)).toEqual([]);
  });

  it('doesn’t come back for an event once taken or dismissed, but does for the next one', () => {
    const dead = withState(EMPTY_ROSTER, 'frederick', 'dead');
    const dismissed = dismissLoss(onFresh, lossPrompt(dead, onFresh));
    expect(lossPrompt(dead, dismissed)).toEqual([]);
    expect(lossPrompt(withState(dead, 'gregor', 'missed'), dismissed)).toEqual(['missed:gregor']);
    const taken = takeLoss(onFresh, lossPrompt(dead, onFresh));
    expect(lossPrompt(dead, { ...taken, journey: 'fresh' })).toEqual([]);
  });

  it('shows on the open dock or its pill in Fresh run or Explore, never when closed or already on After a loss', () => {
    const dead = withState(EMPTY_ROSTER, 'frederick', 'dead');
    expect(lossPrompt(dead, { ...onFresh, dock: 'pill' })).toEqual(['dead:frederick']);
    expect(lossPrompt(dead, { ...onFresh, journey: 'explore' })).toEqual(['dead:frederick']);
    expect(lossPrompt(dead, { ...onFresh, dock: 'closed' })).toEqual([]);
    expect(lossPrompt(dead, { ...onFresh, journey: 'loss' })).toEqual([]);
  });

  it('counts only losses recorded where it can show: not those from before the page loaded, while closed, or on After a loss', () => {
    const dead = withState(EMPTY_ROSTER, 'frederick', 'dead');
    const loaded = noteLosses(dead, onFresh);
    expect(lossPrompt(dead, loaded)).toEqual([]);
    for (const where of [{ dock: 'closed' }, { journey: 'loss' }] as const) {
      const settled = settleLosses(dead, { ...onFresh, ...where });
      expect(lossPrompt(dead, { ...onFresh, lossEvents: settled.lossEvents })).toEqual([]);
    }
  });

  it('leaves the prompt’s events for it to show while it can, and changes nothing with nothing new', () => {
    const dead = withState(EMPTY_ROSTER, 'frederick', 'dead');
    expect(settleLosses(dead, onFresh)).toBe(onFresh);
    const closed: GuidePrefs = { ...onFresh, dock: 'closed', lossEvents: ['dead:frederick'] };
    expect(settleLosses(dead, closed)).toBe(closed);
  });
});

describe('run setup (#108)', () => {
  it('ticks once difficulty and route are set', () => {
    expect(fresh().runSetUp).toBe(false);
    expect(factsFor(withRun(EMPTY_ROSTER, { difficulty: 'lunatic' })).runSetUp).toBe(false);
    expect(factsFor(withRun(EMPTY_ROSTER, { difficulty: 'lunatic', route: 'main-story' })).runSetUp).toBe(true);
  });
});
