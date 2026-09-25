import { describe, expect, it } from 'vitest';
import {
  quotasFor,
  DEFAULT_SPEED,
  adoptPlan,
  lockRobin,
  EMPTY_ROSTER,
  STATS,
  createEngine,
  diffPlans,
  parseRoster,
  resolveAssumptions,
  rosterUnits,
  withRuleOut,
  withRun,
  withSavedPlan,
  withSpouse,
  withState,
  type Couple,
  type Gender,
  type MarriagePlan,
  type PlanSettings,
  type Roster,
  type RosterUnit,
  type SavedPlan,
  type Stat,
} from './index';
import { ledgerStatus } from './plan';

const engine = createEngine();

/** Room in every role: army fit moves nobody, so these tests see the solver alone. */
const ROOMY = {
  cap: 99,
  roles: { lead: { min: 0, max: 99 }, battery: { min: 0, max: 99 }, staff: { min: 0, max: 99 }, dancer: { min: 0, max: 99 } },
} as const;

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
  roleOverrides: {},
  quotas: ROOMY,
};

const RUN = { ...EMPTY_ROSTER.run, gender: 'M', asset: 'spd', flaw: 'hp' } as const;

/** A roster where every unit but `keep` is benched: small enough to brute-force. */
function small(keep: readonly RosterUnit[], run: Roster['run'] = RUN): Roster {
  let roster: Roster = { ...EMPTY_ROSTER, run };
  for (const u of rosterUnits(run)) if (!keep.includes(u.id)) roster = withState(roster, u.id, 'benched');
  return roster;
}

/** Every set of marriages among the units (each unit married once at most). */
function* matchings(units: readonly RosterUnit[], partners: (u: RosterUnit) => readonly RosterUnit[]): Generator<Couple[]> {
  const [u, ...rest] = units;
  if (!u) {
    yield [];
    return;
  }
  yield* matchings(rest, partners);
  for (const p of partners(u)) {
    if (!rest.includes(p)) continue;
    for (const m of matchings(rest.filter((x) => x !== p), partners)) yield [[u, p], ...m];
  }
}

/** The best total over every set of marriages among the free units, and every asset/flaw the run leaves open. */
function bruteForce(roster: Roster, keep: readonly RosterUnit[], s: PlanSettings = settings): number {
  const run = roster.run;
  const gender = run.gender as Gender;
  const entries = new Map(rosterUnits(run).map((u) => [u.id, u]));
  const units = [...keep, 'maiden' as RosterUnit].filter((u) => u === 'maiden' || entries.has(u));
  const partners = (u: RosterUnit) =>
    (u === 'maiden' ? ['chrom' as RosterUnit] : (entries.get(u)?.partners ?? [])).filter((p) => !roster.ruleOuts.some((c) => c.includes(u) && c.includes(p)));
  const assets = run.asset ? [run.asset] : STATS;
  const flaws = (a: Stat) => (run.flaw ? [run.flaw] : STATS).filter((f) => f !== a);
  let best = -Infinity;
  for (const marriages of matchings(units, partners)) {
    for (const asset of assets) {
      for (const flaw of flaws(asset)) {
        const plan = engine.evaluatePlan({ robin: { gender, asset, flaw }, marriages }, roster.run, s);
        best = Math.max(best, plan.total);
      }
    }
  }
  return best;
}

const couples = (plan: MarriagePlan) => plan.marriages.map((m) => [m.husband, m.wife].sort().join(' × '));
const couple = (a: RosterUnit, b: RosterUnit) => [a, b].sort().join(' × ');

describe('marriage plan solver: brute force on small rosters', () => {
  it('matches brute force with first-gen units only', () => {
    const keep: RosterUnit[] = ['chrom', 'frederick', 'gaius', 'vaike', 'sumia', 'olivia', 'lissa', 'sully'];
    const roster = small(keep);
    expect(engine.plan(roster, settings).total).toBeCloseTo(bruteForce(roster, keep), 6);
  });

  it('matches brute force when Robin can marry a first-gen unit or a child', () => {
    const keep: RosterUnit[] = ['robin', 'chrom', 'frederick', 'sumia', 'olivia', 'lucina', 'cynthia'];
    const roster = small(keep);
    const plan = engine.plan(roster, settings);
    expect(plan.total).toBeCloseTo(bruteForce(roster, keep), 6);
  });

  it('matches brute force while Robin’s asset/flaw is open, and reports the pick', () => {
    const run = { ...EMPTY_ROSTER.run, gender: 'F' } as const;
    const keep: RosterUnit[] = ['robin', 'chrom', 'vaike', 'lissa'];
    const roster = small(keep, run);
    const plan = engine.plan(roster, settings);
    expect(plan.total).toBeCloseTo(bruteForce(roster, keep), 6);
    expect(plan.robin).toMatchObject({ gender: 'F' });
    expect(plan.robinOpen).toBe(true);
  });

  it('values priority × score, each child in its plan preset', () => {
    const keep: RosterUnit[] = ['chrom', 'frederick', 'sumia', 'olivia'];
    const s = { ...settings, priorities: { lucina: 3, cynthia: 0, inigo: 2 } };
    const roster = small(keep);
    const plan = engine.plan(roster, s);
    expect(plan.total).toBeCloseTo(bruteForce(roster, keep, s), 6);
    for (const m of plan.marriages) {
      for (const c of m.children) expect(c.value).toBeCloseTo(c.priority * (c.scaled ?? 0), 9);
    }
    const lucina = plan.marriages.flatMap((m) => m.children).find((c) => c.child === 'lucina')!;
    expect(lucina).toMatchObject({ preset: engine.planPreset('lucina', roster, s), priority: 3 });
  });
});

describe('marriage plan solver: the roster', () => {
  it('searches Chrom × Maiden', () => {
    const roster = small(['chrom']);
    const plan = engine.plan(roster, settings);
    expect(couples(plan)).toEqual([couple('chrom', 'maiden')]);
    expect(plan.marriages[0]!.children.map((c) => c.key)).toEqual(['lucina|maiden']);
  });

  it('keeps marriages and pins fixed', () => {
    const roster = withSpouse(withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'chrom', 'olivia', 'married'), 'frederick', 'sumia', 'pinned');
    const plan = engine.plan(roster, settings);
    expect(couples(plan)).toContain(couple('chrom', 'olivia'));
    expect(couples(plan)).toContain(couple('frederick', 'sumia'));
    expect(plan.marriages.find((m) => m.husband === 'chrom')!.bond).toBe('married');
    expect(plan.marriages.find((m) => m.husband === 'frederick')!.bond).toBe('pinned');
  });

  it('never plans a ruled-out marriage', () => {
    const roster = small(['chrom', 'frederick', 'sumia', 'olivia']);
    const first = engine.plan(roster, settings);
    const [top] = first.marriages;
    const ruled = withRuleOut(roster, top!.husband, top!.wife, true);
    expect(couples(engine.plan(ruled, settings))).not.toContain(couple(top!.husband, top!.wife));
    // Reversible.
    expect(couples(engine.plan(withRuleOut(ruled, top!.husband, top!.wife, false), settings))).toEqual(couples(first));
  });

  it('rules a pinned marriage out by dropping the pin', () => {
    const pinned = withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'stahl', 'olivia', 'pinned');
    const ruled = withRuleOut(pinned, 'olivia', 'stahl', true);
    expect(ruled.spouses).toEqual({});
    expect(couples(engine.plan(ruled, settings))).not.toContain(couple('stahl', 'olivia'));
  });

  it('reports a pin broken by a death and re-solves around it', () => {
    const pinned = withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'vaike', 'lissa', 'pinned');
    expect(couples(engine.plan(pinned, settings))).toContain(couple('vaike', 'lissa'));
    const dead = withState(pinned, 'vaike', 'dead');
    const plan = engine.plan(dead, settings);
    expect(plan.lostPins).toEqual([{ couple: ['vaike', 'lissa'], status: 'broken', reason: 'Vaike is dead' }]);
    expect(plan.marriages.some((m) => m.husband === 'vaike' || m.wife === 'vaike')).toBe(false);
    // Lissa is free again and marries someone else.
    expect(plan.marriages.some((m) => m.wife === 'lissa')).toBe(true);
  });

  it('puts a pin through a benched unit on hold, and keeps it again on un-bench', () => {
    const pinned = withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'vaike', 'lissa', 'pinned');
    const benched = withState(pinned, 'vaike', 'benched');
    const plan = engine.plan(benched, settings);
    expect(plan.lostPins).toEqual([{ couple: ['vaike', 'lissa'], status: 'on-hold', reason: 'Vaike is benched' }]);
    expect(couples(plan)).not.toContain(couple('vaike', 'lissa'));
    const back = engine.plan(withState(benched, 'vaike', 'available'), settings);
    expect(back.lostPins).toEqual([]);
    expect(back.marriages.find((m) => m.husband === 'vaike')).toMatchObject({ wife: 'lissa', bond: 'pinned' });
  });

  it('never plans a new marriage for a dead, missed or benched unit, and leaves a dead child unborn', () => {
    const roster = withState(withState(withState({ ...EMPTY_ROSTER, run: RUN }, 'gaius', 'dead'), 'henry', 'missed'), 'owain', 'dead');
    const plan = engine.plan(roster, settings);
    const inPlan = new Set(plan.marriages.flatMap((m) => [m.husband, m.wife]));
    expect(inPlan.has('gaius') || inPlan.has('henry')).toBe(false);
    expect(plan.marriages.flatMap((m) => m.children).some((c) => c.child === 'owain')).toBe(false);
    expect(plan.unborn).toContain('owain');
  });

  it('shows what keeping the pins costs with a free re-plan', () => {
    // Pin a poor marriage: the free re-plan ignores it and does at least as well.
    const pinned = withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'chrom', 'maiden', 'pinned');
    const kept = engine.plan(pinned, settings);
    const free = engine.plan(pinned, settings, { free: true });
    expect(couples(kept)).toContain(couple('chrom', 'maiden'));
    expect(couples(free)).not.toContain(couple('chrom', 'maiden'));
    expect(free.total).toBeGreaterThan(kept.total);
  });

  it('gives Robin’s marriage to a child the Morgan whose other grandparent the plan picks', () => {
    const roster = withSpouse(withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'robin', 'lucina', 'married'), 'chrom', 'sumia', 'married');
    const plan = engine.plan(roster, settings);
    const robin = plan.marriages.find((m) => m.husband === 'robin')!;
    expect(robin.children.map((c) => c.key)).toEqual(['morgan-f|robin:spd/hp|lucina<sumia']);
  });
});

describe('marriage plan: plan presets', () => {
  it('is derived without an override, and an override wins (#96)', () => {
    const roster = { ...EMPTY_ROSTER, run: RUN };
    const derived = engine.deriveRoles(roster, settings).roles.find((r) => r.child === 'kjelle')!;
    const assigned = engine.roles(roster, settings).get('kjelle')!;
    expect(assigned.preset).toBe(derived.rolePreset[assigned.role]);
    expect(engine.planPreset('kjelle', roster, { ...settings, overrides: { kjelle: 'lancekiller' } })).toBe('lancekiller');
    expect(engine.roles(roster, { ...settings, overrides: { kjelle: 'lancekiller' } }).get('kjelle')!.source).toBe('preset override');
  });

  it('keeps the derived role preset inside a role override', () => {
    const roster = { ...EMPTY_ROSTER, run: RUN };
    const s = { ...settings, roleOverrides: { kjelle: 'battery' } } as const;
    expect(engine.roles(roster, s).get('kjelle')).toMatchObject({ role: 'battery', preset: 'battery', source: 'role override' });
  });

  it('gives a child out of the cast the global preset (Morgan before Robin is set)', () => {
    expect(engine.planPreset('morgan-f', EMPTY_ROSTER, { ...settings, preset: 'battery' })).toBe('battery');
  });

  it('scores Rallybot / Dancer children as 0 in Σ', () => {
    const keep: RosterUnit[] = ['chrom', 'frederick', 'sumia', 'olivia'];
    const roster = small(keep);
    const rally = { ...settings, overrides: { lucina: 'rallybot', cynthia: 'rallybot', inigo: 'rallybot' } } as const;
    const plan = engine.plan(roster, rally);
    const kids = plan.marriages.flatMap((m) => m.children);
    expect(kids.length).toBeGreaterThan(0);
    for (const c of kids.filter((c) => c.preset === 'rallybot')) expect(c).toMatchObject({ score: undefined, value: 0 });
    expect(plan.total).toBe(kids.reduce((a, c) => a + c.value, 0));
  });
});

describe('the saved plan', () => {
  const saved: SavedPlan = {
    robin: { gender: 'M', asset: 'spd', flaw: 'hp' },
    marriages: [
      ['stahl', 'olivia'],
      ['chrom', 'sumia'],
      ['vaike', 'lissa'],
    ],
  };

  it('diffs Σ, children left out, spouse moves and score changes', () => {
    const before = engine.evaluatePlan(saved, RUN, settings);
    const after = engine.evaluatePlan({ ...saved, marriages: [['stahl', 'tharja'], ['chrom', 'sumia'], ['frederick', 'lissa']] }, RUN, settings);
    const diff = diffPlans(before, after);
    expect(diff.before).toBe(before.total);
    expect(diff.after).toBe(after.total);
    // Olivia no longer marries: Inigo is left out, though he can still be born.
    expect(diff.leftOut.map((c) => c.child)).toEqual(['inigo']);
    expect(diff.unborn).toEqual([]);
    expect(diff.moves).toContainEqual({ unit: 'stahl', from: 'olivia', to: 'tharja' });
    expect(diff.moves).toContainEqual({ unit: 'olivia', from: 'stahl', to: undefined });
    expect(diff.moves).toContainEqual({ unit: 'lissa', from: 'vaike', to: 'frederick' });
    expect(diff.moves.some((m) => m.unit === 'chrom' || m.unit === 'sumia')).toBe(false);
    // Owain's father changed; Lucina's and Cynthia's pairings didn't.
    expect(diff.changes.map((c) => c.child)).toEqual(['owain']);
    expect(diff.changes[0]).toMatchObject({ before: { key: 'owain|vaike' }, after: { key: 'owain|frederick' } });
    expect(diff.gained.map((c) => c.child)).toEqual(['noire']);
    expect(diff.same).toBe(false);
    expect(diffPlans(before, before).same).toBe(true);
  });

  it('shows what a death costs it: the saved plan as adopted against the re-plan around the loss', () => {
    // Adopted: pinned, with Stahl × Olivia; then Olivia dies.
    let roster = withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved);
    for (const [a, b] of saved.marriages) roster = withSpouse(roster, a, b, 'pinned');
    roster = withState(roster, 'olivia', 'dead');
    const before = engine.evaluatePlan(saved, roster.run, settings);
    expect(before.marriages.find((m) => m.wife === 'olivia')!.children.map((c) => c.key)).toEqual(['inigo|stahl']);
    const after = engine.plan(roster, settings);
    expect(after.lostPins).toEqual([{ couple: ['stahl', 'olivia'], status: 'broken', reason: 'Olivia is dead' }]);
    const diff = diffPlans(before, after);
    expect(diff.unborn.map((c) => c.child)).toContain('inigo');
    expect(diff.leftOut.map((c) => c.child)).not.toContain('inigo');
    expect(diff.moves).toContainEqual({ unit: 'olivia', from: 'stahl', to: undefined });
    expect(after.unborn).toContain('inigo');
  });

  it('marks its pairings for the ◆ chip', () => {
    const roster = withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved);
    expect([...engine.planKeys(roster)].sort()).toEqual(['cynthia|chrom', 'inigo|stahl', 'lucina|sumia', 'owain|vaike']);
    expect(engine.planKeys({ ...EMPTY_ROSTER, run: RUN }).size).toBe(0);
  });

  it('is run state: saved with the roster, dropped when corrupt', () => {
    const roster = withRuleOut(withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved), 'chrom', 'maiden', true);
    expect(parseRoster(JSON.parse(JSON.stringify(roster)))).toEqual(roster);
    const parsed = parseRoster({
      run: RUN,
      ruleOuts: [['chrom', 'lissa'], ['chrom', 'sumia'], ['sumia', 'chrom'], 'x'],
      savedPlan: { robin: { gender: 'M', asset: 'spd', flaw: 'spd' }, marriages: [['stahl', 'olivia'], ['stahl', 'sumia'], ['chrom', 'lissa']] },
    });
    expect(parsed.ruleOuts).toEqual([['chrom', 'sumia']]);
    expect(parsed.savedPlan).toEqual({ robin: null, marriages: [['stahl', 'olivia']] });
    expect(parseRoster({ savedPlan: 'nope' }).savedPlan).toBeNull();
  });
});

describe('plan preset overrides', () => {
  it('holds a preset override in every play context', () => {
    const roster = { ...EMPTY_ROSTER, run: RUN };
    const s = { ...settings, overrides: { kjelle: 'lancekiller' } } as const;
    const presets = (context: PlanSettings['context']) =>
      new Map(engine.plan(roster, { ...s, context }).marriages.flatMap((m) => m.children.map((c) => [c.child, c.preset] as const)));
    expect(presets('all').get('kjelle')).toBe('lancekiller');
    expect(presets('main-story').get('kjelle')).toBe('lancekiller');
  });
});

describe('children ledger', () => {
  // Mid-run: Chrom × Sumia married, Stahl × Olivia pinned, the saved plan's Vaike × Lissa broken by Vaike's death,
  // Nowi dead before marrying, Severa dead, Sully untouched.
  const saved: SavedPlan = {
    robin: null,
    marriages: [
      ['chrom', 'sumia'],
      ['stahl', 'olivia'],
      ['vaike', 'lissa'],
    ],
  };
  let roster: Roster = withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved);
  roster = withSpouse(roster, 'chrom', 'sumia', 'married');
  roster = withSpouse(roster, 'stahl', 'olivia', 'pinned');
  roster = withSpouse(roster, 'vaike', 'lissa', 'pinned');
  roster = withState(withState(withState(roster, 'vaike', 'dead'), 'nowi', 'dead'), 'severa', 'dead');
  const ledger = engine.ledger(roster, settings);
  const row = (c: string) => ledger.find((e) => e.child === c)!;

  it('lists the run’s children with their fixed parent', () => {
    expect(ledger.map((e) => e.child)).toEqual(rosterUnits(RUN).filter((u) => u.kind === 'child').map((u) => u.id));
    expect(row('lucina').fixedParent).toBe('chrom');
    expect(row('morgan-f').fixedParent).toBe('robin');
  });

  it('gives each child a status', () => {
    expect(row('lucina').status).toBe('married');
    expect(row('cynthia').status).toBe('married');
    expect(row('inigo').status).toBe('pinned');
    expect(row('owain').status).toBe('broken');
    expect(row('nah').status).toBe('unborn');
    expect(row('severa').status).toBe('dead');
    expect(row('kjelle').status).toBe('open');
  });

  it('keeps a child re-pinned away from the saved plan as pinned, not broken', () => {
    const repinned = withSpouse(roster, 'stahl', 'tharja', 'pinned');
    const ledger = engine.ledger(repinned, settings);
    // Stahl leaves Olivia for Tharja: Noire is pinned; Inigo is open again, not broken.
    expect(ledger.find((e) => e.child === 'noire')!.status).toBe('pinned');
    expect(ledger.find((e) => e.child === 'inigo')!.status).toBe('open');
  });

  it('shows a child whose pin is on hold as on hold, not open, and pinned again on un-bench', () => {
    const benched = withState(roster, 'olivia', 'benched');
    expect(engine.ledger(benched, settings).find((e) => e.child === 'inigo')!.status).toBe('on-hold');
    expect(engine.ledger(withState(benched, 'olivia', 'available'), settings).find((e) => e.child === 'inigo')!.status).toBe('pinned');
  });

  it('shows a benched child whose parents are pinned as pinned, and the same on un-bench', () => {
    const benched = withState(roster, 'inigo', 'benched');
    expect(engine.ledger(benched, settings).find((e) => e.child === 'inigo')!.status).toBe('pinned');
    expect(engine.ledger(withState(benched, 'inigo', 'available'), settings).find((e) => e.child === 'inigo')!.status).toBe('pinned');
  });

  it('shows a child whose pin is broken as plan broken, without a saved plan', () => {
    const pinned = withState(withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'stahl', 'olivia', 'pinned'), 'stahl', 'dead');
    expect(engine.ledger(pinned, settings).find((e) => e.child === 'inigo')!.status).toBe('broken');
  });

  it('shows the plan’s pairing or the marriage', () => {
    expect(row('lucina').planned).toMatchObject({ key: 'lucina|sumia', parent: 'Sumia' });
    expect(row('inigo').planned).toMatchObject({ key: 'inigo|stahl' });
    expect(row('nah').planned).toBeUndefined();
    expect(row('severa').planned).toBeUndefined();
  });

  it('shows the best remaining pairing in the plan preset, with Δ vs the plan', () => {
    expect(row('nah').best).toBeUndefined();
    expect(row('severa').best).toBeUndefined();
    // Owain can no longer have Vaike.
    expect(row('owain').best?.key).not.toBe('owain|vaike');
    for (const e of ledger) {
      if (e.planned?.score !== undefined && e.best?.score !== undefined) {
        expect(e.delta).toBe(e.best.score - e.planned.score);
        expect(e.delta).toBeGreaterThanOrEqual(0);
      } else expect(e.delta).toBeUndefined();
    }
    // A tie goes to the plan's pairing.
    for (const e of ledger) if (e.planned && e.best && e.best.scaled === e.planned.scaled) expect(e.best.key).toBe(e.planned.key);
    // Lucina's best is her best-scoring pairing that isn't hard-blocked: Sumia is married to Chrom, so nothing better is open.
    expect(row('lucina').best?.key).toBe('lucina|sumia');
  });
});

describe('roster notes on the ledger and plan (#47)', () => {
  const note = 'Sumia died after marrying: the child still comes ⚠';
  // Chrom × Sumia married, then Sumia died; Robin married Lucina, so Morgan's pairing spans that marriage too.
  let roster: Roster = withSpouse({ ...EMPTY_ROSTER, run: RUN }, 'chrom', 'sumia', 'married');
  roster = withState(withSpouse(roster, 'robin', 'lucina', 'married'), 'sumia', 'dead');
  const planned = (plan: MarriagePlan, child: string) => plan.marriages.flatMap((m) => m.children).find((c) => c.child === child);

  it('gives a married child with a dead parent the pairing’s notes on its ledger row', () => {
    const ledger = engine.ledger(roster, settings);
    const row = (c: string) => ledger.find((e) => e.child === c)!;
    expect(row('lucina')).toMatchObject({ status: 'married', notes: [note] });
    expect(row('cynthia')).toMatchObject({ status: 'married', notes: [note] });
    expect(row('morgan-f')).toMatchObject({ status: 'married', notes: [note] });
    expect(row('kjelle').notes).toEqual([]);
  });

  it('gives the plan’s child the same notes', () => {
    const plan = engine.plan(roster, settings);
    expect(planned(plan, 'lucina')!.notes).toEqual([note]);
    expect(planned(plan, 'morgan-f')!.notes).toEqual([note]);
    expect(planned(plan, 'kjelle')?.notes ?? []).toEqual([]);
    for (const c of plan.marriages.flatMap((m) => m.children)) if (!['lucina', 'cynthia', 'morgan-f'].includes(c.child)) expect(c.notes).toEqual([]);
  });

  it('has no notes when a dead parent blocks the child', () => {
    const strict = createEngine(resolveAssumptions({ 'child-after-parent-death': false }));
    const lucina = strict.ledger(roster, settings).find((e) => e.child === 'lucina')!;
    expect(lucina).toMatchObject({ status: 'unborn', notes: [] });
    expect(planned(strict.plan(roster, settings), 'lucina')).toBeUndefined();
  });
});

/** Children left out for a reason other than a benched parent (`small` benches most of the roster). */
const leftOut = (plan: MarriagePlan) => plan.leftOut.filter((c) => c.reason !== 'benched').map((c) => [c.child, c.reason]);

describe('re-plan: can’t be born vs left out (#58)', () => {
  // Inigo has no score and Noire priority 0: both are worth 0, so which one Stahl marries is a tie.
  const s: PlanSettings = { ...settings, overrides: { inigo: 'rallybot' }, priorities: { noire: 0 } };
  const saved: SavedPlan = { robin: null, marriages: [['lonqu', 'olivia'], ['stahl', 'tharja']] };
  /** Adopt Lon'qu × Olivia and Stahl × Tharja, then mark Lon'qu married to Cordelia: Stahl is the one husband left. */
  function repro(): Roster {
    const roster = small(['lonqu', 'stahl', 'olivia', 'tharja', 'cordelia']);
    return withSpouse(adoptPlan(roster, engine.evaluatePlan(saved, RUN, s)), 'lonqu', 'cordelia', 'married');
  }
  const replan = (roster: Roster, free = false) => diffPlans(engine.evaluatePlan(saved, RUN, s), engine.plan(roster, s, { free }));

  it('reports Inigo as left out with no score, not as can’t be born', () => {
    const diff = replan(repro());
    expect(diff.leftOut.map((c) => [c.child, c.reason])).toEqual([['inigo', 'no-score']]);
    expect(diff.unborn).toEqual([]);
  });

  it('keeps the same child left out when Free re-plan is toggled', () => {
    const roster = repro();
    const left = (free: boolean) => replan(roster, free).leftOut.map((c) => c.child);
    expect(left(true)).toEqual(['inigo']);
    expect(left(false)).toEqual(['inigo']);
  });

  it('reports a child whose every pairing is gone as can’t be born', () => {
    const saved: SavedPlan = { robin: null, marriages: [['stahl', 'olivia']] };
    const roster = withState(withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved), 'olivia', 'dead');
    const diff = diffPlans(engine.evaluatePlan(saved, RUN, settings), engine.plan(roster, settings));
    expect(diff.unborn.map((c) => c.child)).toEqual(['inigo']);
    expect(diff.leftOut).toEqual([]);
    expect(engine.plan(roster, settings).unborn).toContain('inigo');
  });

  describe('left-out reasons', () => {
    // Stahl is the only husband for Olivia and Tharja: one mother stays single.
    const keep: RosterUnit[] = ['stahl', 'olivia', 'tharja'];
    const reason = (s: PlanSettings) => leftOut(engine.plan(small(keep), s));

    it('no score: its plan preset has none', () => {
      expect(reason({ ...settings, overrides: { inigo: 'rallybot' } })).toEqual([['inigo', 'no-score']]);
    });

    it('priority 0', () => {
      expect(reason({ ...settings, priorities: { noire: 0 } })).toEqual([['noire', 'priority-0']]);
    });

    it('outscored: a higher-valued child won the husband', () => {
      expect(reason({ ...settings, priorities: { noire: 3 } })).toEqual([['inigo', 'outscored']]);
    });

    it('benched: its fixed parent is benched', () => {
      const benched = withState(small(keep), 'olivia', 'benched');
      expect(engine.plan(benched, settings).leftOut.map((c) => [c.child, c.reason])).toContainEqual(['inigo', 'benched']);
    });
  });
});

describe('re-plan: stability tiebreak', () => {
  // Priority 0 for both: Stahl × Olivia and Stahl × Tharja are worth the same.
  const keep: RosterUnit[] = ['stahl', 'olivia', 'tharja'];
  const tie = { ...settings, priorities: { inigo: 0, noire: 0 } };
  const wife = (roster: Roster, s = tie) => engine.plan(roster, s).marriages.find((m) => m.husband === 'stahl')!.wife;
  const savedWith = (w: RosterUnit) => withSavedPlan(small(keep), { robin: null, marriages: [['stahl', w]] });

  it('keeps the saved plan’s children among equal plans', () => {
    expect(wife(savedWith('olivia'))).toBe('olivia');
    expect(wife(savedWith('tharja'))).toBe('tharja');
  });

  it('has no effect without a saved plan', () => {
    const none = engine.plan(small(keep), tie);
    const empty = engine.plan(withSavedPlan(small(keep), { robin: null, marriages: [] }), tie);
    // A saved plan whose children are none of Inigo and Noire doesn't pull the tie either way.
    const unrelated = engine.plan(withSavedPlan(small(keep), { robin: null, marriages: [['chrom', 'sumia']] }), tie);
    expect(couples(empty)).toEqual(couples(none));
    expect(couples(unrelated)).toEqual(couples(none));
    expect(empty.total).toBe(none.total);
  });

  it('never beats a better plan', () => {
    expect(wife(savedWith('olivia'), { ...settings, priorities: { inigo: 0, noire: 1 } })).toBe('tharja');
  });
});

describe('children ledger: left out', () => {
  it('reads plan broken before Adopt, and left out after', () => {
    // Adopted Stahl × Olivia and Vaike × Tharja; then Stahl dies, leaving Vaike the only husband, and Noire is worth more.
    const keep: RosterUnit[] = ['stahl', 'vaike', 'olivia', 'tharja'];
    const s = { ...settings, priorities: { noire: 3 } };
    const saved: SavedPlan = { robin: null, marriages: [['stahl', 'olivia'], ['vaike', 'tharja']] };
    let roster = withSavedPlan(small(keep), saved);
    for (const [a, b] of saved.marriages) roster = withSpouse(roster, a, b, 'pinned');
    roster = withState(roster, 'stahl', 'dead');
    const inigo = (r: Roster) => engine.ledger(r, s).find((e) => e.child === 'inigo')!;
    expect(inigo(roster).status).toBe('broken');
    const adopted = adoptPlan(roster, engine.plan(roster, s));
    expect(inigo(adopted)).toMatchObject({ status: 'left-out', leftOut: 'outscored' });
  });
});

describe('children ledger: why the plan broke (#48)', () => {
  const saved: SavedPlan = {
    robin: { gender: 'M', asset: 'spd', flaw: 'hp' },
    marriages: [
      ['chrom', 'sumia'],
      ['stahl', 'cordelia'],
      ['robin', 'lucina'],
      ['vaike', 'olivia'],
    ],
  };
  const adopted = withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, saved);
  const row = (r: Roster, c: string) => engine.ledger(r, settings).find((e) => e.child === c)!;

  it('names the saved pairing and why it can’t happen', () => {
    const severa = row(withState(adopted, 'stahl', 'dead'), 'severa');
    expect(severa.status).toBe('broken');
    expect(severa.saved).toEqual({ parent: 'Stahl', reasons: ['Stahl is dead'] });
    expect(severa.planned?.parent).not.toBe('Stahl');
  });

  it('names a parent married to someone else', () => {
    const inigo = row(withSpouse(adopted, 'vaike', 'sully', 'married'), 'inigo');
    expect(inigo).toMatchObject({ status: 'broken', saved: { parent: 'Vaike', reasons: ['Vaike is married to Sully'] } });
  });

  it('lists every reason, in the second-gen form of the label', () => {
    const morgan = row(withSpouse(withState(adopted, 'lucina', 'dead'), 'stahl', 'sumia', 'married'), 'morgan-f');
    expect(morgan.status).toBe('broken');
    expect(morgan.saved?.parent).toBe('Lucina ← Sumia');
    expect(morgan.saved?.reasons).toEqual(expect.arrayContaining(['Lucina is dead', 'Sumia is married to Stahl']));
  });

  it('labels a broken Robin pairing in the Robin-variant form', () => {
    const robinCordelia = withSavedPlan({ ...EMPTY_ROSTER, run: RUN }, { ...saved, marriages: [['robin', 'cordelia']] });
    const severa = row(withSpouse(robinCordelia, 'robin', 'olivia', 'married'), 'severa');
    expect(severa).toMatchObject({ status: 'broken', saved: { parent: 'Robin (M) +Spd −HP', reasons: ['Robin (M) is married to Olivia'] } });
  });

  it('says nothing for any other status', () => {
    const ledger = engine.ledger(withState(adopted, 'stahl', 'dead'), settings);
    for (const e of ledger) if (e.status !== 'broken') expect(e.saved).toBeUndefined();
  });
});

describe('children ledger: status precedence', () => {
  const none = { dead: false, bornable: true, married: false, broken: false, onHold: false, leftOut: false, pinned: false };
  // dead > can't be born > parents married > plan broken > on hold > left out > pinned > open
  const steps = [
    ['dead', { dead: true }],
    ['unborn', { bornable: false }],
    ['married', { married: true }],
    ['broken', { broken: true }],
    ['on-hold', { onHold: true }],
    ['left-out', { leftOut: true }],
    ['pinned', { pinned: true }],
  ] as const;

  it('opens with nothing set', () => {
    expect(ledgerStatus(none)).toBe('open');
  });

  steps.forEach(([status], i) => {
    it(`${status} outranks everything below it`, () => {
      const below = Object.assign({}, none, ...steps.slice(i).map(([, f]) => f));
      expect(ledgerStatus(below)).toBe(status);
    });
  });
});

describe('Lock Robin from the plan’s pick (#59)', () => {
  const OPEN = EMPTY_ROSTER.run;
  const robinSpouse = (r: Roster) => r.spouses.robin;
  const robinMarriage = (plan: MarriagePlan) => plan.marriages.find((m) => m.husband === 'robin' || m.wife === 'robin');

  it('fills the open Run facts with the plan’s Robin and pins Robin’s marriage', () => {
    const roster = small(['robin', 'chrom', 'vaike', 'lissa'], OPEN);
    const plan = engine.plan(roster, settings);
    const m = robinMarriage(plan)!;
    expect(m).toBeDefined();
    const locked = lockRobin(roster, plan);
    const { gender, asset, flaw } = plan.robin;
    expect(locked.run).toMatchObject({ gender, asset, flaw });
    expect(robinSpouse(locked)).toEqual({ partner: m.husband === 'robin' ? m.wife : m.husband, bond: 'pinned' });
    expect(engine.plan(locked, settings).robinOpen).toBe(false);
  });

  it('keeps the Run facts already set', () => {
    const run = { ...EMPTY_ROSTER.run, gender: 'F', asset: 'mag' } as const;
    const roster = small(['robin', 'chrom', 'vaike', 'lissa'], run);
    const plan = engine.plan(roster, settings);
    const locked = lockRobin(roster, plan);
    expect(locked.run).toMatchObject({ gender: 'F', asset: 'mag', flaw: plan.robin.flaw });
    // A stale pick never overwrites a fact set since.
    const stale = lockRobin(withRun(roster, { asset: 'skl' }), plan);
    expect(stale.run).toMatchObject({ gender: 'F', asset: 'skl' });
  });

  it('pins nothing from a plan solved for the other gender', () => {
    const roster = small(['robin', 'chrom', 'vaike', 'lissa'], OPEN);
    const plan = engine.plan(roster, settings);
    expect(robinMarriage(plan)).toBeDefined();
    const other = plan.robin.gender === 'M' ? 'F' : 'M';
    expect(robinSpouse(lockRobin(withRun(roster, { gender: other }), plan))).toBeUndefined();
  });

  it('sets the facts without pinning anything when the plan doesn’t marry Robin', () => {
    const roster = withState(small(['chrom', 'sumia'], OPEN), 'robin', 'benched');
    const plan = engine.plan(roster, settings);
    expect(robinMarriage(plan)).toBeUndefined();
    const locked = lockRobin(roster, plan);
    const { gender, asset, flaw } = plan.robin;
    expect(locked.run).toMatchObject({ gender, asset, flaw });
    expect(locked.spouses).toEqual(roster.spouses);
  });

  it('leaves a married Robin married', () => {
    const roster = withSpouse(small(['robin', 'chrom', 'vaike', 'lissa'], { ...EMPTY_ROSTER.run, gender: 'M' }), 'robin', 'lissa', 'married');
    const locked = lockRobin(roster, engine.plan(roster, settings));
    expect(robinSpouse(locked)).toEqual({ partner: 'lissa', bond: 'married' });
  });

  it('gives the same roster whether Lock or Adopt comes first', () => {
    const roster = small(['robin', 'chrom', 'frederick', 'vaike', 'sumia', 'lissa', 'olivia'], OPEN);
    const onPlan = (r: Roster, step: typeof lockRobin) => step(r, engine.plan(r, settings));
    const lockFirst = onPlan(onPlan(roster, lockRobin), adoptPlan);
    const adoptFirst = onPlan(onPlan(roster, adoptPlan), lockRobin);
    expect(robinSpouse(lockFirst)?.bond).toBe('pinned');
    // The saved plan lists married and pinned couples first, so compare its marriages as a set.
    const norm = (r: Roster) => ({ ...r, savedPlan: r.savedPlan && { ...r.savedPlan, marriages: r.savedPlan.marriages.map(([a, b]) => couple(a, b)).sort() } });
    expect(norm(lockFirst)).toEqual(norm(adoptFirst));
  });
});
