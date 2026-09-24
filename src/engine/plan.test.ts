import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEED,
  EMPTY_ROSTER,
  STATS,
  createEngine,
  diffPlans,
  parseRoster,
  rosterUnits,
  withRuleOut,
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

const RUN = { gender: 'M', asset: 'spd', flaw: 'hp' } as const;

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
    const run = { gender: 'F', asset: null, flaw: null } as const;
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
    expect(lucina).toMatchObject({ preset: 'physical-lead', priority: 3 });
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
  it('defaults per child, follows the play context, and falls back to the global preset', () => {
    const at = (context: PlanSettings['context']) => ({ context, preset: 'battery', overrides: {} }) as const;
    expect(engine.planPreset('kjelle', at('all'))).toBe('physical-lead');
    expect(engine.planPreset('kjelle', at('main-story'))).toBe('tank');
    expect(engine.planPreset('morgan-f', at('apotheosis'))).toBe('battery');
    expect(engine.planPreset('kjelle', { ...at('main-story'), overrides: { kjelle: 'lancekiller' } })).toBe('lancekiller');
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

  it('diffs Σ, children lost, spouse moves and score changes', () => {
    const before = engine.evaluatePlan(saved, RUN, settings);
    const after = engine.evaluatePlan({ ...saved, marriages: [['stahl', 'tharja'], ['chrom', 'sumia'], ['frederick', 'lissa']] }, RUN, settings);
    const diff = diffPlans(before, after);
    expect(diff.before).toBe(before.total);
    expect(diff.after).toBe(after.total);
    // Olivia no longer marries: Inigo is lost.
    expect(diff.lost.map((c) => c.child)).toEqual(['inigo']);
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
    expect(diff.lost.map((c) => c.child)).toContain('inigo');
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
  it('holds an override in every play context, while defaulted children follow the context', () => {
    const roster = { ...EMPTY_ROSTER, run: RUN };
    const s = { ...settings, overrides: { kjelle: 'lancekiller' } } as const;
    const presets = (context: PlanSettings['context']) =>
      new Map(engine.plan(roster, { ...s, context }).marriages.flatMap((m) => m.children.map((c) => [c.child, c.preset] as const)));
    const all = presets('all');
    const main = presets('main-story');
    expect(all.get('kjelle')).toBe('lancekiller');
    expect(main.get('kjelle')).toBe('lancekiller');
    expect(all.get('nah')).toBe('battery');
    expect(main.get('nah')).toBe('nostank');
  });

  it('tells the curated default apart from the preset in force', () => {
    const s = { context: 'main-story', preset: 'battery', overrides: { kjelle: 'lancekiller' } } as const;
    expect(engine.defaultPlanPreset('kjelle', s)).toBe('tank');
    expect(engine.planPreset('kjelle', s)).toBe('lancekiller');
    expect(engine.defaultPlanPreset('morgan-f', s)).toBe('battery');
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
