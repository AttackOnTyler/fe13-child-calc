import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHECKED_RULES,
  EMPTY_ROSTER,
  addEntry,
  answerRule,
  createEngine,
  latestEntry,
  runFromRoster,
  withCheckObserved,
  withEntryChecks,
  withRun,
  type Deployment,
  type FlawlessChance,
  type PlanLineup,
  type RosterUnit,
} from '../engine';
import { checksStepReadout, rulesReadout, setChecksProgress, setupRows, stakeText } from './checks-view';
import { afterLockReadout, type AfterLockItem, type InboxState } from './inbox';
import type { SolveProgress } from './run-page';

/**
 * In-play checks on the pages (#209): the open rules list by stakes, Record results' Checks step, and the inbox's
 * checks this map offers and checks worth setting up, as the pages draw them.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
const all = engine.mapOrder(fresh).steps.map((s) => s.map);
// Two maps left (Chapter 25, then Endgame).
const late = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
const seed = engine.seedPlan(late);
const evidence = { run: 'Normal Classic, Main story', map: 'chapter-24' };

describe('the open rules list (#209)', () => {
  it('lists open rules by stakes, then model mismatches, then checked and answered rules', () => {
    const rules = answerRule(engine.settleCheck(engine.settleCheck(EMPTY_CHECKED_RULES, 'tome-miss-use', 3, evidence, 1).rules, 'tome-miss-use', 3, evidence, 2).rules, 'booster-at-cap', 'other', evidence, 3);
    const stakes = [
      { rule: 'support-past-threshold', gain: -0.004, margin: 0.002, runs: 24, modelled: true },
      { rule: 'veteran-as-back', gain: 0.021, margin: 0.008, runs: 24, modelled: true },
      { rule: 'rally-exp', gain: 0, margin: 0, runs: 0, modelled: false },
    ];
    const r = rulesReadout(engine.openRules(rules), stakes, (id) => engine.maps().find((m) => m.id === id)!.label);
    expect(r.open.slice(0, 2).map((x) => x.id)).toEqual(['veteran-as-back', 'support-past-threshold']);
    expect(r.open[0]!.status).toBe('open (Only while leading a pair (FEW, JP) until checked) · stakes 2.1 ±0.8 points');
    expect(r.open.find((x) => x.id === 'rally-exp')!.status).toContain('no stakes: the model doesn’t read it');
    expect(r.open.find((x) => x.id === 'seal-exp-bar')!.status).toContain('stakes being worked out');
    expect(r.mismatches.map((x) => [x.id, x.can])).toEqual([['tome-miss-use', 'answer']]);
    expect(r.mismatches[0]!.notes).toEqual(['Seen 3 twice (Normal Classic, Main story, Chapter 24; Normal Classic, Main story, Chapter 24)']);
    expect(r.settled.map((x) => [x.id, x.can, x.status])).toEqual([['booster-at-cap', 'reopen', 'answered by hand: Refused: the game won’t use it, so it stays held (the model switched)']]);
  });

  it('words stakes', () => {
    expect(stakeText(undefined)).toBe('stakes being worked out');
    expect(stakeText({ rule: 'x', gain: -0.0123, margin: 0.004, runs: 24, modelled: true })).toBe('stakes 1.2 ±0.4 points');
  });
});

describe('Record results’ Checks step (#209)', () => {
  it('lists only the checks the map offered, each with its question and, once seen, what it did', () => {
    const run = addEntry(late, all[all.length - 2]!, 99);
    const id = latestEntry(run)!.id;
    expect(checksStepReadout(latestEntry(run)!)).toEqual({ rows: [], note: 'This map offered no checks.' });
    const offered = withEntryChecks(run, id, [
      { rule: 'veteran-as-back', text: 'Robin backs Chrom: note Robin’s EXP.' },
      { rule: 'rally-exp', text: 'Lissa can Rally: note the EXP.' },
    ]);
    const seen = withCheckObserved(offered, id, 'veteran-as-back', 7, 'switched');
    const r = checksStepReadout(latestEntry(seen)!);
    expect(r.rows.map((x) => [x.rule, x.ask.kind, x.observed, x.outcome])).toEqual([
      ['veteran-as-back', 'number', 7, 'Play says Whenever paired, the back included (SF): the model reads it now, and the plan is re-solved (its proposals arrive in the inbox).'],
      ['rally-exp', 'number', undefined, ''],
    ]);
  });
});

describe('the inbox’s checks (#209)', () => {
  const [next] = engine.mapOrder(late).steps;
  const lineup = engine.roadmapLineups(late, seed).find((l) => l.key === next!.key)!;
  // Robin backs the first lead that isn't Robin on the next map.
  const lead = [...lineup.pairs.map((p) => p.lead), ...lineup.solo].find((u) => u !== 'robin')!;
  const others = (u: RosterUnit) => u !== lead && u !== 'robin';
  const pairs = lineup.pairs.filter((p) => others(p.lead) && (!p.back || others(p.back)));
  const loose = lineup.pairs.filter((p) => !pairs.includes(p)).flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]).filter(others);
  const robinBack: PlanLineup = { key: lineup.key, pairs: [...pairs, { lead, back: 'robin' }], solo: [...lineup.solo.filter(others), ...loose] };
  const deployment: Deployment = {
    max: 16,
    deployed: [...robinBack.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...robinBack.solo],
    pairs: robinBack.pairs.map((p) => ({ lead: p.lead, back: p.back, support: null, coverage: 0 })),
    solo: robinBack.solo,
    forced: [],
  };
  const chance = { chance: 0.42, margin: 0.05, runs: 24, maps: [{ key: next!.key, label: 'Chapter 25', reach: 1, noDeath: 1, lineup: deployment, turns: 5, stalled: 0, gold: undefined }] } as unknown as FlawlessChance;
  const progress: SolveProgress = { best: seed, start: seed, chance, proposals: [], closeCalls: [], pruned: [], done: true, converged: true };
  const state: InboxState = { progress, choices: undefined, costs: new Map(), query: '', pinCosts: new Map() };
  const item = <K extends AfterLockItem['kind']>(kind: K) => afterLockReadout(engine, late, state).items.find((i): i is Extract<AfterLockItem, { kind: K }> => i.kind === kind);

  it('lists the checks the next map offers, with their stakes', () => {
    const checks = item('checks')!;
    expect(checks.title).toBe('Checks Chapter 25 offers');
    const vet = checks.rows.find((r) => r.key === 'check:veteran-as-back')!;
    expect(vet.text).toMatch(/^Veteran on the back: Robin backs .+ \(stakes being worked out\)$/);
  });

  it('offers a setup check as a costed edit once the stakes call for one', () => {
    expect(item('setup-checks')).toBeUndefined();
    const edited = { ...seed, roadmap: { ...seed.roadmap, lineups: [...seed.roadmap.lineups, robinBack] } };
    setChecksProgress(late, seed, EMPTY_CHECKED_RULES, {
      stakes: [{ rule: 'seal-exp-bar', gain: 0.03, margin: 0.01, runs: 24, modelled: true }],
      setup: [
        { rule: 'seal-exp-bar', label: 'The EXP bar through a seal', stake: { rule: 'seal-exp-bar', gain: 0.03, margin: 0.01, runs: 24, modelled: true } },
        { rule: 'veteran-as-back', label: 'Veteran on the back', stake: { rule: 'veteran-as-back', gain: 0.02, margin: 0.01, runs: 24, modelled: true }, edit: { label: 'Robin backs Chrom on Chapter 25', plan: edited } },
      ],
      costs: new Map([['veteran-as-back', { gain: -0.002, margin: 0.004, runs: 16, verdict: 'close', settled: true }]]),
      done: true,
    });
    const setup = item('setup-checks')!;
    expect(setup.rows.map((r) => r.text)).toEqual([
      'The EXP bar through a seal (stakes 3.0 ±1.0 points): no single edit sets it up; answer it by hand if you know it',
      'Veteran on the back (stakes 2.0 ±1.0 points): Robin backs Chrom on Chapter 25 sets it up; the edit costs no measurable difference (−0.2 ±0.4) points',
    ]);
    expect(setup.rows[1]!.edit).toMatchObject({ label: 'Set up a check: Robin backs Chrom on Chapter 25', plan: edited, cost: { verdict: 'close' } });
    // The stakes order the next map's checks.
    expect(item('checks')!.rows.find((r) => r.key === 'check:veteran-as-back')!.text).toContain('stakes being worked out');
    expect(setupRows(undefined)).toEqual([]);
  });
});
