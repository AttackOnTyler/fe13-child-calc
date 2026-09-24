import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  adoptPlan,
  createEngine,
  lockRobin,
  quotasFor,
  withRun,
  withSpouse,
  withState,
  type PlanSettings,
  type Roster,
} from '../engine';
import { guideFacts, offPlanMarriages } from './guide-facts';
import { DEFAULT_PLAN_PREFS, withDeployEdited, withPriority, withSuggestedPresets, type PlanPrefs } from './plan-prefs';
import { DEFAULT_PREFS } from './scoring-prefs';

const engine = createEngine();

const settings: PlanSettings = {
  context: 'all',
  preset: 'physical-lead',
  edits: {},
  basis: 'caps-lb',
  dlc: false,
  speed: DEFAULT_SPEED,
  supportRank: 'A',
  priorities: {},
  overrides: {},
};

const fresh = () => guideFacts(EMPTY_ROSTER, DEFAULT_PLAN_PREFS, DEFAULT_PREFS.context);
const factsFor = (roster: Roster) => guideFacts(roster, DEFAULT_PLAN_PREFS, DEFAULT_PREFS.context);
const factsForPrefs = (prefs: PlanPrefs) => guideFacts(EMPTY_ROSTER, prefs, DEFAULT_PREFS.context);

describe('guide facts', () => {
  it('say the plan is adopted once Adopt saves it', () => {
    expect(fresh().planAdopted).toBe(false);
    const adopted = adoptPlan(EMPTY_ROSTER, engine.plan(EMPTY_ROSTER, settings));
    expect(factsFor(adopted).planAdopted).toBe(true);
  });

  it('say the play context is chosen once it leaves the default', () => {
    expect(fresh().contextChosen).toBe(false);
    expect(guideFacts(EMPTY_ROSTER, DEFAULT_PLAN_PREFS, 'apotheosis').contextChosen).toBe(true);
  });

  it('say Robin is locked once the Plan’s Lock fills every run fact, and not while one is open', () => {
    expect(fresh().robinLocked).toBe(false);
    expect(factsFor(withRun(EMPTY_ROSTER, { gender: 'F', asset: 'spd' })).robinLocked).toBe(false);
    expect(factsFor(lockRobin(EMPTY_ROSTER, engine.plan(EMPTY_ROSTER, settings))).robinLocked).toBe(true);
  });

  it('say a unit is benched', () => {
    expect(fresh().unitBenched).toBe(false);
    expect(factsFor(withState(EMPTY_ROSTER, 'lucina', 'benched')).unitBenched).toBe(true);
  });

  it('say a unit is lost once one is dead or missed, but not benched', () => {
    expect(fresh().unitLost).toBe(false);
    expect(factsFor(withState(EMPTY_ROSTER, 'frederick', 'benched')).unitLost).toBe(false);
    expect(factsFor(withState(EMPTY_ROSTER, 'frederick', 'dead')).unitLost).toBe(true);
    expect(factsFor(withState(EMPTY_ROSTER, 'gregor', 'missed')).unitLost).toBe(true);
  });

  it('say a real marriage is recorded, which a pin is not', () => {
    expect(fresh().marriageRecorded).toBe(false);
    expect(factsFor(withSpouse(EMPTY_ROSTER, 'chrom', 'sumia', 'pinned')).marriageRecorded).toBe(false);
    expect(factsFor(withSpouse(EMPTY_ROSTER, 'chrom', 'sumia', 'married')).marriageRecorded).toBe(true);
  });

  describe('say the adopted plan is current', () => {
    const adopt = (roster: Roster) => adoptPlan(roster, engine.plan(roster, settings));
    const adopted = adopt(EMPTY_ROSTER);
    const [husband, wife] = adopted.savedPlan!.marriages[0]!;

    it('once Adopt saves a plan, and not before', () => {
      expect(fresh().adoptedPlanHolds).toBe(false);
      expect(factsFor(adopted).adoptedPlanHolds).toBe(true);
    });

    it('not once a partner in it dies or is missed, until the re-plan is adopted', () => {
      const lost = withState(adopted, husband, 'dead');
      expect(factsFor(lost).adoptedPlanHolds).toBe(false);
      expect(factsFor(withState(adopted, wife, 'missed')).adoptedPlanHolds).toBe(false);
      expect(factsFor(adopt(lost)).adoptedPlanHolds).toBe(true);
    });

    it('through a bench, which is only a what-if', () => {
      expect(factsFor(withState(adopted, husband, 'benched')).adoptedPlanHolds).toBe(true);
    });

    it('through a marriage the plan made, even if a partner dies after it', () => {
      const married = withSpouse(adopted, husband, wife, 'married');
      expect(factsFor(married).adoptedPlanHolds).toBe(true);
      expect(factsFor(withState(married, wife, 'dead')).adoptedPlanHolds).toBe(true);
    });

    it('not once an off-plan marriage is recorded, until the re-plan is adopted', () => {
      const other = adopted.savedPlan!.marriages.find(([h]) => h !== husband)![1];
      const offPlan = withSpouse(adopted, husband, other, 'married');
      expect(factsFor(offPlan).adoptedPlanHolds).toBe(false);
      expect(factsFor(adopt(offPlan)).adoptedPlanHolds).toBe(true);
    });

    it('lists the real marriages the adopted plan doesn’t hold, which the loss prompt shares', () => {
      const other = adopted.savedPlan!.marriages.find(([h]) => h !== husband)![1];
      expect(offPlanMarriages(withSpouse(EMPTY_ROSTER, husband, other, 'married'))).toEqual([]);
      expect(offPlanMarriages(withSpouse(adopted, husband, wife, 'married'))).toEqual([]);
      expect(offPlanMarriages(withSpouse(adopted, husband, other, 'pinned'))).toEqual([]);
      expect(offPlanMarriages(withSpouse(adopted, husband, other, 'married'))).toEqual([[husband, other]]);
    });
  });

  it('say Suggest roles ran once its picks are written, even when it picked nothing', () => {
    expect(fresh().rolesSuggested).toBe(false);
    const picks = engine.suggestRoles(EMPTY_ROSTER, settings, quotasFor('all')).overrides;
    expect(factsForPrefs(withSuggestedPresets(DEFAULT_PLAN_PREFS, picks)).rolesSuggested).toBe(true);
    expect(factsForPrefs(withSuggestedPresets(DEFAULT_PLAN_PREFS, {})).rolesSuggested).toBe(true);
  });

  it('say priorities are set once a child’s priority is, even back to its default', () => {
    expect(fresh().prioritiesSet).toBe(false);
    expect(factsForPrefs(withPriority(DEFAULT_PLAN_PREFS, 'lucina', 3)).prioritiesSet).toBe(true);
    expect(factsForPrefs(withPriority(DEFAULT_PLAN_PREFS, 'lucina', 1)).prioritiesSet).toBe(true);
  });

  it('say deploy is edited once the Roster’s Deploy or role controls write the flag', () => {
    expect(fresh().deployEdited).toBe(false);
    expect(factsForPrefs(withDeployEdited(DEFAULT_PLAN_PREFS)).deployEdited).toBe(true);
  });
});
