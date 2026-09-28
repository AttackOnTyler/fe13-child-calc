import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, rosterOf, rosterUnits, runFromRoster, unitName, withPin, withRoster, withRun, withSpouse, withState, type EditCost, type ReservesStep, type RosterUnit, type UnitWorth, type WorthStep } from '../engine';
import { childrenLedger, costText, notOnTrack, plannedUnits, unitEditsReadout, wishlistReadout, worthText } from './wishlist-page';
import type { UnitEditView } from './solve-client';

const worth = (w: Partial<UnitWorth> & { unit: RosterUnit }): UnitWorth => ({ forced: false, worth: undefined, margin: undefined, utility: undefined, utilityMargin: undefined, runs: 0, children: [], settled: false, ...w });

describe('the Wishlist tab’s sheet (#203)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const start = runFromRoster(facts);
  const all = engine.mapOrder(start).steps.map((s) => s.map);
  const run = all.slice(0, -2).reduce((r, m, i) => addEntry(r, m, i + 1), start);
  const plan = engine.seedPlan(run);
  const name = (u: RosterUnit) => unitName(u, 'M');

  it('has a row for every wishlist unit: Lead / Back, class, 5-skill build, and a child’s parents and passes', () => {
    const r = wishlistReadout(engine, run, plan);
    const shown = r.rows.flatMap((x) => [x.lead, ...(x.back ? [x.back] : [])]);
    expect(shown.map((u) => u.unit).sort()).toEqual(plan.wishlist.units.map((w) => w.unit).sort());
    for (const w of plan.wishlist.units) {
      const u = shown.find((x) => x.unit === w.unit)!;
      expect(u.name).toBe(name(w.unit));
      expect(u.cls).not.toBe('');
      expect(u.build).toHaveLength(w.build.length);
      expect(u.position).toBe(w.position === 'lead' ? 'Lead' : w.position === 'back' ? 'Back' : 'Solo');
      expect(u.worth).toBe('worth …');
    }
    // A pair's Back sits beside its Lead.
    const pair = r.rows.find((x) => x.back)!;
    expect(plan.wishlist.units.find((w) => w.unit === pair.lead.unit)!.partner).toBe(pair.back!.unit);
    const child = plan.wishlist.children.find((c) => shown.some((u) => u.unit === c.child));
    if (child) expect(shown.find((u) => u.unit === child.child)!.parents).toMatch(new RegExp(`^${name(child.parents[0])} × .* · passes .* / `));
    expect(r.title).toBe(`Wishlist for Endgame: ${plan.wishlist.units.length} fielded`);
  });

  it('shows worth as it arrives, Chrom and Robin as forced, and each unit’s reading with the count not on track', () => {
    const units = plan.wishlist.units.map((w) => w.unit);
    const other = units.find((u) => u !== 'chrom' && u !== 'robin')!;
    const step = { units: [worth({ unit: 'chrom', forced: true }), worth({ unit: other, worth: 0.123, margin: 0.02, runs: 8, settled: true })], converged: false, evaluations: 0, cursor: { evaluations: 0 } } as WorthStep;
    const readings = engine.readings(run, plan, { runs: 2 });
    const r = wishlistReadout(engine, run, plan, { worth: step, readings });
    const row = (u: RosterUnit) => r.rows.flatMap((x) => [x.lead, ...(x.back ? [x.back] : [])]).find((x) => x.unit === u)!;
    expect(row('chrom').worth).toBe('forced');
    expect(row(other).worth).toBe('worth 12.3 ±2.0');
    const count = readings.readings.filter((x) => x.reading !== 'on-track').length;
    expect(r.notOnTrack).toBe(count);
    expect(notOnTrack(plan, readings)).toBe(count);
    // Out of the units the plan counts on (fielded and off the lineup), never more than it shows.
    const planned = new Set([...units, ...readings.readings.map((x) => x.unit)]).size;
    expect(plannedUnits(plan, readings)).toBe(planned);
    expect(count).toBeLessThanOrEqual(planned);
    expect(r.title).toBe(`Wishlist for Endgame: ${units.length} fielded · ${count ? `${count} of ${planned} planned units not on track` : 'every planned unit on track'}`);
    for (const x of readings.readings) {
      const shown = row(x.unit) ?? r.others.find((o) => o.unit === x.unit);
      expect(shown?.reading?.text).toBe(`${{ 'on-track': 'on track', 'at-risk': 'at risk', behind: 'behind' }[x.reading]}${x.pending ? '?' : ''}`);
      expect(shown?.reading?.title.startsWith(`${name(x.unit)}: `)).toBe(true);
    }
  });

  it('keeps a children ledger read from the run and the plan, never a score (#212)', () => {
    const ledger = childrenLedger(run, plan);
    const children = rosterUnits(run.roster.run).filter((u) => u.kind === 'child').map((u) => u.id);
    expect(ledger.map((e) => e.child)).toEqual(children);
    for (const e of ledger) {
      const wished = plan.wishlist.children.find((c) => c.child === e.child);
      expect(e.status).toBe(wished ? 'wished' : 'out');
      expect(e.parents).toBe(wished ? `${name(wished.parents[0])} × ${name(wished.parents[1])}` : '—');
      if (wished) expect(e.passes).toMatch(/^passes .* \/ /);
    }
    // The Roster's facts win: a dead child, a missed one, and a child whose parents the log marries.
    const lucina = ledger.find((e) => e.child === 'lucina')!;
    const facts2 = withState(withState(withSpouse(rosterOf(run), 'lissa', 'lonqu', 'married'), 'lucina', 'dead'), 'kjelle', 'missed');
    const after = childrenLedger(withRoster(run, facts2), plan);
    expect(after.find((e) => e.child === 'lucina')).toMatchObject({ status: 'dead', parents: lucina.parents });
    expect(after.find((e) => e.child === 'kjelle')!.status).toBe('missed');
    expect(after.find((e) => e.child === 'owain')!.status).toBe('married');
  });

  it('lists the reserves in order, each naming the loss it mainly covers, and gives them no reading', () => {
    const [a] = plan.wishlist.units.map((w) => w.unit).filter((u) => u !== 'chrom' && u !== 'robin');
    const reserves = { reserves: [{ unit: 'frederick', covers: a, restores: 0.05, margin: 0.01, runs: 8 }, { unit: 'kellam', covers: null, restores: 0.01, margin: 0.01, runs: 8 }], losses: [], plan, converged: true, evaluations: 0, cursor: { evaluations: 0 } } as unknown as ReservesStep;
    const readings = engine.readings(run, plan, { runs: 2 });
    const r = wishlistReadout(engine, run, plan, { reserves, readings });
    expect(r.reserves.map((x) => x.text)).toEqual([`1. Frederick covers ${name(a!)} · restores +5.0 ±1.0`, '2. Kellam covers no single loss · restores +1.0 ±1.0']);
    expect(r.others.some((o) => o.unit === 'frederick' || o.unit === 'kellam')).toBe(false);
    expect(wishlistReadout(engine, run, plan).reservesNote).toBe('The reserves are chosen once the search is done, after each unit’s worth.');
  });
});

describe('a unit’s worth on its row (#202, #203)', () => {
  it('reads forced, a pending worth, and the points lost with its children and utility', () => {
    expect(worthText(undefined, 'M')).toBe('worth …');
    expect(worthText(worth({ unit: 'robin', forced: true }), 'M')).toBe('forced');
    expect(worthText(worth({ unit: 'lissa', worth: 0.05, margin: 0.03, runs: 4 }), 'M')).toBe('worth 5.0 ±3.0 (provisional)');
    expect(worthText(worth({ unit: 'lissa', worth: 0.05, margin: 0.01, runs: 32, children: ['owain'], utility: 0.02, utilityMargin: 0.01, settled: true }), 'M')).toBe('worth 5.0 ±1.0 with Owain · utility 2.0 ±1.0');
  });
});

describe('a unit’s edits and their costs (#203)', () => {
  const run = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal' }));
  const cost = (c: Partial<EditCost>): EditCost => ({ gain: 0, margin: 0, runs: 8, verdict: 'unclear', settled: false, ...c });

  it('reads “costing…”, then provisional, then settled', () => {
    expect(costText(undefined)).toEqual({ text: 'costing…', phase: 'costing' });
    expect(costText(cost({ gain: 0.012, margin: 0.03, runs: 2 }))).toEqual({ text: '≈ +1.2 ±3.0, provisional (2 runs)', phase: 'provisional' });
    expect(costText(cost({ gain: -0.05, margin: 0.01, runs: 16, verdict: 'worse', settled: true }))).toEqual({ text: '−5.0 ±1.0', phase: 'settled' });
    expect(costText(cost({ gain: -0.002, margin: 0.003, runs: 32, verdict: 'close', settled: true }))).toEqual({ text: 'no measurable difference (−0.2 ±0.3)', phase: 'settled' });
    expect(costText(cost({ runs: 0, verdict: 'close', settled: true })).text).toBe('no measurable difference: the simulation doesn’t read it');
  });

  it('groups the edits by kind with keeping it in or out last, and marks those whose pins are set', () => {
    const edits: UnitEditView[] = [
      { kind: 'keep', key: 'keep:lissa:out', label: 'Keep Lissa out of the wishlist', pins: [{ kind: 'keep', unit: 'lissa', keep: 'out' }] },
      { kind: 'marriage', key: 'm1', label: 'Lissa marries Vaike instead of Frederick', pins: [{ kind: 'marriage', couple: ['vaike', 'lissa'] }] },
      { kind: 'build', key: 'b1', label: 'Lissa’s build: Miracle instead of Renewal', pins: [] },
    ];
    const pinned = withPin(run, { kind: 'marriage', couple: ['vaike', 'lissa'] });
    const r = unitEditsReadout(pinned, edits, new Map([['b1', cost({ runs: 0, verdict: 'close', settled: true })]]));
    expect(r.groups.map((g) => g.title)).toEqual(['Marriages', 'Build skills', 'Keep in or out']);
    expect(r.groups[0]!.rows[0]).toMatchObject({ label: 'Lissa marries Vaike instead of Frederick', cost: 'costing…', pinned: true });
    expect(r.groups[2]!.rows[0]).toMatchObject({ pinned: false, cost: 'costing…' });
    expect(r.summary).toBe('3 edits touch it · 1 settled');
    expect(unitEditsReadout(run, undefined, new Map()).summary).toBe('Listing the edits that touch it…');
  });
});
