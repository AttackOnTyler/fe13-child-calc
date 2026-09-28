import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHECKED_RULES,
  EMPTY_ROSTER,
  OPEN_RULES,
  SETUP_STAKES,
  addEntry,
  answerRule,
  createEngine,
  editEntry,
  exportRun,
  importRun,
  latestEntry,
  modelChanged,
  reopenRule,
  resolveAssumptions,
  runFromRoster,
  withCheckObserved,
  withEntryChecks,
  withRun,
  type CheckedRules,
  type Plan,
  type PlanLineup,
  type RuleStake,
  type Run,
} from './index';

/**
 * In-play checks (#209), through the facade: the open rules, settling a raw observation (checked, switched, unexpected,
 * model mismatch), hand answers and reopening, the model switch, the free checks a map offers and the setup checks.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', mode: 'classic', gender: 'M', asset: 'mag', flaw: 'hp' });
const all = engine.mapOrder(runFromRoster(facts)).steps.map((s) => s.map);
/** Every map but the last two (Chapter 25, then Endgame) recorded, every unit Lv 10 with the same fair stats. */
function late(): Run {
  const played = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const stats = { hp: 50, str: 26, mag: 26, skl: 28, spd: 28, lck: 22, def: 22, res: 20 };
  return editEntry(played, latestEntry(played)!.id, (s) => ({ ...s, units: Object.fromEntries(Object.entries(s.units).map(([u, x]) => [u, { ...x!, level: 10, stats: x!.stats && stats }])) }), 1);
}
const run = late();
const seed = engine.seedPlan(run);
const evidence = { run: 'Normal Classic, Main story', map: 'chapter-24' };
const overrides = (rules: CheckedRules) => Object.fromEntries(Object.entries(rules.answers).map(([id, a]) => [id, a.value]));
const withLineup = (plan: Plan, l: PlanLineup): Plan => ({ ...plan, roadmap: { ...plan.roadmap, lineups: [...plan.roadmap.lineups.filter((x) => x.key !== l.key), l] } });

describe('the open rules (#209)', () => {
  it('are #150’s checklist, the tome-miss check and the registry’s rules play can settle, all open at first', () => {
    const ids = engine.openRules(EMPTY_CHECKED_RULES).map((s) => s.rule.id);
    for (const id of ['rally-exp', 'back-without-dual-strike', 'back-kill-lead-exp', 'veteran-as-back', 'seal-exp-bar', 'class-change-internal-level', 'deadlord-boss-bonus', 'support-past-threshold', 'pair-up-back-level', 'attack-stance-supports', 'parent-skill-swap', 'booster-to-child', 'booster-at-cap', 'tonic-stacking', 'item-in-preparations', 'over-cap-reclass', 'boss-drop-npc', 'tome-miss-use'])
      expect(ids).toContain(id);
    expect(engine.openRules(EMPTY_CHECKED_RULES).every((s) => s.state === 'open' && s.reading === 'best')).toBe(true);
  });
});

describe('settling a check (#209)', () => {
  it('turns the best reading into a checked rule, with its evidence', () => {
    const { rules, outcome } = engine.settleCheck(EMPTY_CHECKED_RULES, 'tome-miss-use', 1, evidence, 5);
    expect(outcome).toBe('checked');
    expect(rules.answers['tome-miss-use']).toEqual({ value: 'costs-a-use', how: 'check', evidence, at: 5 });
    expect(engine.openRules(rules).find((s) => s.rule.id === 'tome-miss-use')).toMatchObject({ state: 'checked', reading: 'best' });
  });

  it('switches the model at once on the other reading', () => {
    const { rules, outcome } = engine.settleCheck(EMPTY_CHECKED_RULES, 'veteran-as-back', 7, evidence, 5);
    expect(outcome).toBe('switched');
    expect(modelChanged(EMPTY_CHECKED_RULES, rules, 'veteran-as-back')).toBe(true);
    expect(resolveAssumptions(overrides(rules))['veteran-as-back']).toBe('paired');
    // The model reads it: Robin's Dual Strike as the back gets Veteran's ×1.5 (5 → 7 against a foe of Robin's level).
    const foe = { level: 10, advanced: false, boss: false, classBonus: 0 };
    const hit = { internalLevel: 10, foe, outcome: 'damage' as const, difficulty: 'normal' as const, pair: 'back' as const, veteran: true };
    expect(engine.combatExp(hit)).toBe(5);
    expect(createEngine(resolveAssumptions(overrides(rules))).combatExp(hit)).toBe(7);
  });

  it('keeps an observation matching neither reading open, marked unexpected; the same value twice is a model mismatch', () => {
    const once = engine.settleCheck(EMPTY_CHECKED_RULES, 'class-change-internal-level', 22, evidence, 5);
    expect(once.outcome).toBe('unexpected');
    expect(engine.openRules(once.rules).find((s) => s.rule.id === 'class-change-internal-level')).toMatchObject({ state: 'open', unexpected: [{ value: 22 }] });
    // A different unexpected value stays unexpected.
    const other = engine.settleCheck(once.rules, 'class-change-internal-level', 25, evidence, 6);
    expect(other.outcome).toBe('unexpected');
    const twice = engine.settleCheck(other.rules, 'class-change-internal-level', 22, { run: 'Normal Classic, Main story', map: 'chapter-25' }, 7);
    expect(twice.outcome).toBe('mismatch');
    const status = engine.openRules(twice.rules).find((s) => s.rule.id === 'class-change-internal-level')!;
    expect(status.state).toBe('mismatch');
    expect(status.mismatch?.evidence).toHaveLength(2);
    // Forecasts keep the best reading.
    expect(resolveAssumptions(overrides(twice.rules))['class-change-internal-level']).toBe('research');
  });

  it('changes nothing when the situation didn’t happen', () => {
    expect(engine.settleCheck(EMPTY_CHECKED_RULES, 'rally-exp', 'didnt-happen', evidence, 5)).toEqual({ rules: EMPTY_CHECKED_RULES, outcome: 'none' });
    // Rally's other reading is any EXP at all.
    expect(engine.settleCheck(EMPTY_CHECKED_RULES, 'rally-exp', 3, evidence, 5).outcome).toBe('switched');
  });

  it('answers any rule by hand, and reopens it: the model reverts', () => {
    const answered = answerRule(EMPTY_CHECKED_RULES, 'support-past-threshold', 'other', evidence, 9);
    expect(answered.answers['support-past-threshold']).toMatchObject({ value: 'bank', how: 'hand' });
    expect(engine.openRules(answered).find((s) => s.rule.id === 'support-past-threshold')).toMatchObject({ state: 'answered', reading: 'other' });
    const reopened = reopenRule(answered, 'support-past-threshold');
    expect(reopened.answers).toEqual({});
    expect(modelChanged(answered, reopened, 'support-past-threshold')).toBe(true);
    expect(resolveAssumptions(overrides(reopened))['support-past-threshold']).toBe('clamp');
    // Reopening a mismatch clears it.
    const mm = engine.settleCheck(engine.settleCheck(EMPTY_CHECKED_RULES, 'tome-miss-use', 3, evidence, 1).rules, 'tome-miss-use', 3, evidence, 2).rules;
    expect(reopenRule(mm, 'tome-miss-use')).toEqual({ answers: {}, mismatches: [] });
  });
});

describe('checks on a map (#209)', () => {
  const key = seed.roadmap.order[0]!;
  const robinFielded = (lineups: readonly PlanLineup[]) => lineups.find((l) => [...l.pairs.flatMap((p) => [p.lead, p.back]), ...l.solo].includes('robin'))!;
  const lineups = engine.roadmapLineups(run, seed);
  const withRobinBack = (() => {
    const l = robinFielded(lineups);
    const lead = l.pairs.find((p) => p.lead !== 'robin' && p.back !== 'robin')!.lead;
    const pairs = l.pairs.filter((p) => p.lead !== lead && p.lead !== 'robin' && p.back !== 'robin' && p.back !== lead);
    const loose = l.pairs.filter((p) => !pairs.includes(p)).flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]).filter((u) => u !== lead && u !== 'robin');
    return { key: l.key, pairs: [...pairs, { lead, back: 'robin' as const }], solo: [...l.solo, ...loose] };
  })();

  it('lists a free check where the roadmap sets up the rule’s situation, and none once it’s checked', () => {
    const checks = engine.mapChecks(run, seed, withRobinBack.key, { lineup: withRobinBack });
    const vet = checks.find((c) => c.rule === 'veteran-as-back')!;
    expect(vet.text).toMatch(/^Robin backs .+: after a Dual Strike/);
    expect(vet.ask).toMatchObject({ kind: 'number', best: [5], other: [7] });
    // A pair sets up the back's rules too.
    expect(checks.map((c) => c.rule)).toEqual(expect.arrayContaining(['back-without-dual-strike', 'back-kill-lead-exp']));
    const checked = engine.settleCheck(EMPTY_CHECKED_RULES, 'veteran-as-back', 5, evidence, 1).rules;
    expect(engine.mapChecks(run, seed, withRobinBack.key, { lineup: withRobinBack, rules: checked }).map((c) => c.rule)).not.toContain('veteran-as-back');
  });

  it('orders the checks by stakes', () => {
    const stakes: RuleStake[] = [
      { rule: 'back-kill-lead-exp', gain: 0, margin: 0, runs: 0, modelled: false },
      { rule: 'veteran-as-back', gain: -0.03, margin: 0.01, runs: 8, modelled: true },
    ];
    const checks = engine.mapChecks(run, seed, withRobinBack.key, { lineup: withRobinBack, stakes });
    expect(checks[0]!.rule).toBe('veteran-as-back');
    expect(checks[0]!.stake?.gain).toBe(-0.03);
  });

  it('offers a setup check only above about 1 point of stakes and when no map left sets it up, with the edit that does', () => {
    const noRobinBack = lineups.map((l) => ({ ...l, pairs: l.pairs.map((p) => (p.back === 'robin' ? { lead: 'robin' as const, back: p.lead } : p)) }));
    const plan = noRobinBack.reduce(withLineup, seed);
    const stake = (gain: number): RuleStake[] => [{ rule: 'veteran-as-back', gain, margin: 0.002, runs: 24, modelled: true }];
    // Low stakes are only ever free.
    expect(engine.setupChecks(run, plan, { stakes: stake(SETUP_STAKES / 2), lineups: noRobinBack })).toEqual([]);
    const [setup] = engine.setupChecks(run, plan, { stakes: stake(0.02), lineups: noRobinBack });
    expect(setup).toMatchObject({ rule: 'veteran-as-back', stake: { gain: 0.02 } });
    expect(setup!.edit!.label).toMatch(/^Robin backs /);
    // The edited plan sets it up, so it's a free check there.
    const edited = setup!.edit!.plan;
    const l = edited.roadmap.lineups.find((x) => x.pairs.some((p) => p.back === 'robin'))!;
    expect(engine.mapChecks(run, edited, l.key, { lineup: l }).map((c) => c.rule)).toContain('veteran-as-back');
    // Once a map sets it up, no setup check.
    expect(engine.setupChecks(run, withLineup(plan, withRobinBack), { stakes: stake(0.02), lineups: [...noRobinBack.filter((x) => x.key !== withRobinBack.key), withRobinBack] })).toEqual([]);
    // A rule the model doesn't read never makes one.
    expect(engine.setupChecks(run, plan, { stakes: [{ rule: 'attack-stance-supports', gain: 0.5, margin: 0, runs: 0, modelled: false }], lineups: noRobinBack })).toEqual([]);
    expect(key).toBeTruthy();
  });

  it('offers no check that needs EXP gain for a map-only setup, which gains none (#243)', () => {
    // The Premonition's Lv 20 Chrom and Robin (EXP "–"): no back's EXP, lead's EXP or Veteran check.
    const exp = OPEN_RULES.filter((r) => r.exp).map((r) => r.id);
    const premonition: PlanLineup = { key: 'premonition', pairs: [{ lead: 'chrom', back: 'robin' }], solo: [] };
    const rules = engine.mapChecks(run, seed, 'premonition', { lineup: premonition }).map((c) => c.rule);
    for (const id of exp) expect(rules).not.toContain(id);
    // The same pair on a map where they earn EXP sets all three up.
    const elsewhere = engine.mapChecks(run, seed, withRobinBack.key, { lineup: { ...premonition, key: withRobinBack.key } }).map((c) => c.rule);
    expect(elsewhere).toEqual(expect.arrayContaining(['back-without-dual-strike', 'back-kill-lead-exp', 'veteran-as-back']));
    // Nor does a setup check pair Robin as the back there: no edit sets it up.
    const plan: Plan = { ...seed, roadmap: { ...seed.roadmap, order: ['premonition'], lineups: [{ key: 'premonition', pairs: [{ lead: 'chrom' }], solo: ['robin'] }] } };
    const [setup] = engine.setupChecks(run, plan, { stakes: [{ rule: 'veteran-as-back', gain: 0.02, margin: 0.002, runs: 24, modelled: true }], lineups: plan.roadmap.lineups });
    expect(setup).toMatchObject({ rule: 'veteran-as-back' });
    expect(setup!.edit).toBeUndefined();
  });
});

describe('a map’s checks on its entry (#209)', () => {
  it('keep the checks offered and each observation, and read back from the saved run', () => {
    const added = addEntry(run, 'chapter-25', 5);
    const id = latestEntry(added)!.id;
    const offered = withEntryChecks(added, id, [{ rule: 'tome-miss-use', text: 'Miriel carries Elfire: note its uses.' }, { rule: 'rally-exp', text: 'Rally once.' }]);
    const seen = withCheckObserved(withCheckObserved(offered, id, 'tome-miss-use', 1, 'checked'), id, 'rally-exp', 'didnt-happen', 'none');
    expect(latestEntry(importRun(exportRun(seen)))!.checks).toEqual([
      { rule: 'tome-miss-use', text: 'Miriel carries Elfire: note its uses.', observed: 1, outcome: 'checked' },
      { rule: 'rally-exp', text: 'Rally once.', observed: 'didnt-happen', outcome: 'none' },
    ]);
  });
});

describe('corrections and checks (#209)', () => {
  it('name the open check that touches a unit whose learned correction is beyond about ×1.3', () => {
    const casual = withRun(facts, { mode: 'casual' });
    const lord = { class: 'Lord', level: 5, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], supports: [], inventory: [] };
    const first = addEntry(runFromRoster(casual), all[0]!, 1);
    const start = editEntry(first, latestEntry(first)!.id, (s) => ({ ...s, units: { ...s.units, chrom: lord } }), 1);
    const added = addEntry(start, all[1]!, 2);
    const id = latestEntry(added)!.id;
    // Forecast 100 EXP; he gained 200: ×1.5.
    const f = { chance: 0.5, margin: 0.05, key: all[1]!, map: all[1]!, exp: [{ unit: 'chrom' as const, exp: 100, level: { low: 5.6, median: 6, high: 6.4 } }], readings: [] };
    const learned = editEntry({ ...added, entries: added.entries.map((e) => (e.id === id ? { ...e, forecast: f } : e)) }, id, (s) => ({ ...s, units: { ...s.units, chrom: { ...lord, level: 7 } } }), 1);
    const leads = { ...seed, roadmap: { ...seed.roadmap, lineups: [{ key: all[2]!, pairs: [{ lead: 'chrom' as const, back: 'frederick' as const }], solo: [] }] } };
    expect(engine.correctionChecks(learned, leads, EMPTY_CHECKED_RULES)).toEqual([{ unit: 'chrom', factor: 1.5, rules: [{ id: 'back-kill-lead-exp', label: 'The lead’s EXP when the back lands the kill' }] }]);
    // Checked, it's no longer named; with no rule touching him, nothing.
    const checked = engine.settleCheck(EMPTY_CHECKED_RULES, 'back-kill-lead-exp', true, evidence, 1).rules;
    expect(engine.correctionChecks(learned, leads, checked)).toEqual([]);
    expect(engine.correctionChecks(learned, undefined, EMPTY_CHECKED_RULES)).toEqual([]);
  });
});

describe('stakes (#209)', () => {
  it('are none for a rule the model doesn’t read, and a paired re-run for one it does', () => {
    expect(engine.ruleStakes(run, seed, 'pair-up-back-level')).toEqual({ rule: 'pair-up-back-level', gain: 0, margin: 0, runs: 0, modelled: false });
    const s = engine.ruleStakes(run, seed, 'tome-miss-use', { runs: 2 });
    expect(s).toMatchObject({ rule: 'tome-miss-use', modelled: true, runs: 2 });
    expect(Math.abs(s.gain)).toBeLessThanOrEqual(1);
  });

  it('every modelled rule names a registry assumption with an alternative', () => {
    for (const r of OPEN_RULES) if (r.assumption) expect(r.other.value).not.toEqual(r.best.value);
  });
});
