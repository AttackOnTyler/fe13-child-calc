import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, proposalId, runFromRoster, withDismissedProposal, withEdit, withRobinLock, withRun, withoutEdit, type EditCost, type FlawlessChance, type Plan, type PlanRobin, type RosterUnit, type Run } from '../engine';
import { SHOWN_MATCHES, beforeTheLock, costText, editPinsKey, inboxReadout, type InboxItem, type InboxState } from './inbox';
import type { SolveProgress } from './run-page';
import type { UnitEditView } from './solve-client';

/** The inbox before the Lock (#204), as the page draws it from the solve's progress and the costs read so far. */
const run = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal' }));
const spd: PlanRobin = { gender: 'F', asset: 'spd', flaw: 'lck' };
const str: PlanRobin = { gender: 'M', asset: 'str', flaw: 'lck' };
const plan = (robin: PlanRobin, spouse: RosterUnit): Plan => ({
  robin,
  wishlist: {
    endpoint: 'endgame',
    units: [
      { unit: 'chrom', position: 'lead', partner: 'robin', classId: 'great-lord', build: [] },
      { unit: 'robin', position: 'back', partner: 'chrom', classId: 'grandmaster', build: [] },
      { unit: spouse, position: 'solo', classId: 'hero', build: [] },
    ],
    marriages: [['robin', spouse]],
    children: [],
    reserves: [{ unit: 'frederick', covers: spouse }],
  },
  roadmap: { order: ['endgame'], lineups: [], seals: [], items: [] },
});
const seed = plan(spd, 'lonqu');
const better = plan(str, 'sumia');
const chance = { chance: 0.4, margin: 0.05, runs: 24, maps: [] } as unknown as FlawlessChance;
const proposal = { plan: better, label: 'Vaike marries Sully', edits: ['Robin’s asset: Str', 'Vaike marries Sully'], gain: 0.012, margin: 0.004, runs: 32 };
const progress: SolveProgress = {
  best: better,
  start: seed,
  chance,
  proposals: [proposal],
  closeCalls: [{ key: 'k', plan: better, label: 'Stahl marries Miriel', gain: -0.002, margin: 0.003, runs: 32 }],
  pruned: [],
  done: false,
  converged: false,
};
const state = (over: Partial<InboxState> = {}): InboxState => ({ progress, choices: undefined, costs: new Map(), query: '', pinCosts: new Map(), ...over });
const item = <K extends InboxItem['kind']>(r: Run, kind: K, over: Partial<InboxState> = {}) => inboxReadout(r, state(over)).items.find((i): i is Extract<InboxItem, { kind: K }> => i.kind === kind)!;

describe('the inbox before the Lock (#204)', () => {
  it('lists what needs you in order: headline, Robin, improvements, close calls, anything else, your edits, the wishlist, the Lock', () => {
    const r = inboxReadout(run, state());
    expect(r.title).toBe('Before the run: what needs you');
    expect(r.items.map((i) => i.kind)).toEqual(['headline', 'robin', 'proposals', 'close-calls', 'anything-else', 'your-edits', 'wishlist', 'lock']);
    // Nothing found yet: no improvement or close call to show.
    expect(inboxReadout(run, state({ progress: { ...progress, proposals: [], closeCalls: [] } })).items.map((i) => i.kind)).toEqual(['headline', 'robin', 'anything-else', 'your-edits', 'wishlist', 'lock']);
  });

  it('leaves out close calls with both plans at 0% (no information), and keeps the rest', () => {
    const zero = { ...chance, chance: 0, margin: 0 } as FlawlessChance;
    const blank = { key: 'z', plan: better, label: 'Gaius marries Panne', gain: 0, margin: 0, runs: 32 };
    const calls = [blank, progress.closeCalls[0]!];
    expect(item(run, 'close-calls', { progress: { ...progress, chance: zero, closeCalls: calls } }).rows.map((r) => r.call.key)).toEqual(['k']);
    expect(inboxReadout(run, state({ progress: { ...progress, chance: zero, closeCalls: [blank] } })).items.map((i) => i.kind)).not.toContain('close-calls');
    // One that saves turns still carries information (ties go to fewer expected turns).
    expect(item(run, 'close-calls', { progress: { ...progress, chance: zero, closeCalls: [{ ...blank, turns: -1.2 }] } }).rows.map((r) => r.text)).toEqual(['Gaius marries Panne: no measurable difference (0.0 ±0.0); 1.2 fewer turns']);
    // Under a headline above 0%, a 0.0 ±0.0 call still reads.
    expect(item(run, 'close-calls', { progress: { ...progress, closeCalls: calls } }).rows).toHaveLength(2);
  });

  it('is the run’s until Robin is locked or a map is recorded', () => {
    expect(beforeTheLock(run)).toBe(true);
    expect(beforeTheLock(withRobinLock(run, spd))).toBe(false);
    expect(beforeTheLock(addEntry(run, 'premonition', 1))).toBe(false);
  });

  it('offers the search’s improvements to accept or dismiss, and close calls to pick on taste', () => {
    const p = item(run, 'proposals');
    expect(p.title).toBe('The search found better');
    expect(p.rows.map((x) => x.text)).toEqual(['Robin’s asset: Str; Vaike marries Sully: +1.2 ±0.4']);
    expect(item(run, 'close-calls')).toMatchObject({ title: 'Close calls: no measurable difference; pick whichever you like', rows: [{ text: 'Stahl marries Miriel: no measurable difference (−0.2 ±0.3)' }] });
    // Accepting applies it: the adopted plan is the proposal's, the wishlist and the Robin to lock follow it.
    const accepted = withEdit(run, { label: proposal.edits.join('; '), plan: proposal.plan, accepted: true, cost: { gain: 0.012, margin: 0.004, verdict: 'better' } });
    expect(accepted.adopted).toBe(better);
    expect(item(accepted, 'wishlist').lines).toContain('Sumia, solo');
    expect(item(accepted, 'lock').robin).toEqual(str);
    expect(item(accepted, 'your-edits').rows).toEqual([{ index: 0, text: 'Robin’s asset: Str; Vaike marries Sully (accepted)', cost: 'gained +1.2 ±0.4', ask: false }]);
    // Dismissing hides it; the plan stays as it was.
    const dismissed = withDismissedProposal(run, proposalId(proposal));
    expect(inboxReadout(dismissed, state()).items.map((i) => i.kind)).not.toContain('proposals');
    expect(dismissed.adopted).toBeUndefined();
  });

  it('searches every edit, each costing…, then provisional, then settled, made as a pin or a plan edit', () => {
    const choices: UnitEditView[] = [
      { kind: 'keep', key: 'keep:frederick:out', label: 'Keep Frederick out of the wishlist', pins: [{ kind: 'keep', unit: 'frederick', keep: 'out' }] },
      { kind: 'build', key: 'build:frederick:0:luna', label: 'Frederick’s build: Luna instead of Sol', pins: [] },
      { kind: 'marriage', key: 'marriage:x', label: 'Frederick marries Olivia', pins: [{ kind: 'marriage', couple: ['frederick', 'olivia'] }] },
      { kind: 'class', key: 'class:vaike:berserker', label: 'Vaike promotes to Berserker instead of Warrior', pins: [] },
    ];
    const provisional: EditCost = { gain: -0.012, margin: 0.03, runs: 2, verdict: 'unclear', settled: false };
    const settled: EditCost = { gain: -0.012, margin: 0.004, runs: 32, verdict: 'worse', settled: true };
    const costs = new Map([
      ['keep:frederick:out', provisional],
      ['marriage:x', settled],
    ]);
    const a = item(run, 'anything-else', { choices, costs, query: 'frederick' });
    expect(a.title).toBe('Anything else you want different?');
    expect(a.rows.map((r) => [r.label, r.cost, r.apply, r.ready])).toEqual([
      ['Keep Frederick out of the wishlist', '≈ −1.2 ±3.0, provisional', 'pin', true],
      ['Frederick’s build: Luna instead of Sol', 'costing…', 'edit', false],
      ['Frederick marries Olivia', '−1.2 ±0.4', 'pin', true],
    ]);
    // Every term must match; the search lists how many edits there are when empty.
    expect(item(run, 'anything-else', { choices, costs, query: 'olivia frederick' }).rows.map((r) => r.label)).toEqual(['Frederick marries Olivia']);
    expect(item(run, 'anything-else', { choices, query: '' }).note).toBe('Search every edit (4): a unit, a marriage, a skill, keep someone in or out, a side goal. Each is costed against your plan.');
    expect(item(run, 'anything-else', { choices, query: 'Walhart' }).note).toBe('No edits match.');
    expect(item(run, 'anything-else', { query: 'frederick' }).note).toBe('Listing every edit: once the search has read the plan.');
    const many = Array.from({ length: SHOWN_MATCHES + 3 }, (_, i): UnitEditView => ({ kind: 'lineup', key: `l${i}`, label: `On Endgame, field Frederick instead of unit ${i}`, pins: [] }));
    const m = item(run, 'anything-else', { choices: many, query: 'frederick' });
    expect(m.rows).toHaveLength(SHOWN_MATCHES);
    expect(m.note).toBe('3 more: narrow the search.');
    expect(costText({ gain: 0.001, margin: 0.004, runs: 32, verdict: 'close', settled: true })).toBe('no measurable difference (+0.1 ±0.4)');
  });

  it('lists your edits with their pins’ cost together, one pin’s on request, and an undo', () => {
    const keep = { kind: 'keep', unit: 'frederick', keep: 'out' } as const;
    const edited = withEdit(withEdit(run, { label: 'Keep Frederick out of the wishlist', pins: [keep] }), { label: 'Frederick’s build: Luna instead of Sol', plan: better, cost: { gain: -0.001, margin: 0.004, verdict: 'close' } });
    const pinCost = { pins: [keep], cost: 0.031, margin: 0.012, runs: 32, verdict: 'better', settled: true } as const;
    const y = item(edited, 'your-edits', { progress: { ...progress, pinCost } });
    expect(y.rows).toEqual([
      { index: 0, text: 'Keep Frederick out of the wishlist (pin)', cost: undefined, ask: true },
      { index: 1, text: 'Frederick’s build: Luna instead of Sol (plan edit)', cost: 'cost when made no measurable difference (−0.1 ±0.4)', ask: false },
    ]);
    expect(y.pinCost).toBe('Your pin costs +3.1 ±1.2: the best plan found with it lifted, less the best found with it');
    const own = item(edited, 'your-edits', { pinCosts: new Map([[editPinsKey([keep]), pinCost]]) });
    expect(own.rows[0]).toMatchObject({ cost: 'costs +3.1 ±1.2', ask: false });
    // Undo: the pin lifted; the plan edit's plan gone back to the one before.
    expect(withoutEdit(edited, 1).adopted).toBeUndefined();
    expect(item(withoutEdit(withoutEdit(edited, 1), 0), 'your-edits')).toMatchObject({ rows: [], note: 'No edits yet. Everything is the tool’s proposal.' });
  });

  it('shows the wishlist in one collapsed line, and Lock Robin and start last, locking only Robin', () => {
    expect(item(run, 'wishlist')).toEqual({ kind: 'wishlist', summary: 'The wishlist (3 fielded, 1 reserves)', lines: ['Chrom + Robin', "Lon'qu, solo", "Reserves: Frederick (covers Lon'qu)"] });
    const lock = item(run, 'lock');
    expect(lock.robin).toEqual(spd);
    expect(lock.text).toBe('Lock Robin (Female, +Spd −Lck) and start the run. This locks only Robin; the rest of the wishlist stays editable and re-solves after every map.');
    const locked = withRobinLock(run, lock.robin!);
    expect(locked.roster.run).toMatchObject({ gender: 'F', asset: 'spd', flaw: 'lck', route: 'main-story' });
    expect(locked.pins?.map((p) => p.kind)).toEqual(['robin-lock']);
    // Landing on the Run view: the inbox before the Lock is done.
    expect(beforeTheLock(locked)).toBe(false);
    expect(item(run, 'lock', { progress: undefined })).toMatchObject({ robin: undefined, text: 'Lock Robin and start: waiting for the plan’s Robin.' });
  });
});
