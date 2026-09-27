import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, latestEntry, recordMarriage, runFromRoster, withRenown, withRun, withShopLine, withSideGoalPin, withSideGoalSecured, withItemPin, withItemsUsed, unitName, type Route, type RosterUnit, type Run, type Snapshot, type UnitSnapshot } from '../engine';
import { childStatsNote, flawlessReadout, heldText, itemPlanReadout, itemsUsedReadout, mapOrderReadout, solvedReadout, parseHeldText, parseSupportsText, roadmapReadout, shoppingReadout, sideGoalPlanReadout, sideGoalsReadout, supportsText } from './run-page';
import { chanceText } from './chance';

describe('the map order readout (#179)', () => {
  const engine = createEngine();
  const run = (route: Route, ...maps: string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(withRun(EMPTY_ROSTER, { route, difficulty: 'lunatic' })));

  it('lists the Full route’s maps still to play, marking the plan’s choices and the endpoint', () => {
    const r = mapOrderReadout(engine, run('full-route', 'premonition', 'prologue', 'chapter-1'));
    expect(r.title).toBe('Map order: Full route, to Apotheosis (secret route), deploying 20');
    expect(r.rows.slice(0, 2)).toEqual(['Chapter 2: Shepherds', 'Chapter 3: Warrior Realm']);
    expect(r.rows).toContain('Paralogue 5: Scion of Legend (the plan places it)');
    expect(r.rows).toContain('Infinite Regalia (optional)');
    expect(r.rows.slice(-2)).toEqual(['Apotheosis', 'Apotheosis (secret route) (endpoint)']);
  });

  it('ends the Main story at Endgame, and says when the endpoint is recorded', () => {
    const r = mapOrderReadout(engine, run('main-story'));
    expect(r.title).toBe('Map order: Main story, to Endgame, deploying 16');
    expect(r.rows[0]).toBe('Premonition: Invisible Ties');
    expect(r.rows.at(-1)).toBe('Endgame: Grima (endpoint)');
    const all = engine.mapOrder(run('main-story')).steps.map((s) => s.map);
    expect(mapOrderReadout(engine, run('main-story', ...all)).rows).toEqual([]);
  });
});

describe('the flawless chance readout (#186)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);

  it('shows the chance with its ± and says what it covers', () => {
    const run = played(all.slice(0, -2));
    const r = flawlessReadout(engine, run, { runs: 3 });
    const sim = engine.flawlessChance(run, { runs: 3, plan: engine.seedPlan(run) });
    const ceiling = engine.ceiling(run, { runs: 3, plan: engine.seedPlan(run) })!;
    expect(r.text).toBe(`Flawless chance: ${chanceText(sim.chance)} ±${(sim.margin * 100).toFixed(1)} · ceiling ${chanceText(ceiling.chance!)}`);
    expect(r.detail).toContain('The ceiling is the chance no unit dies on Endgame with every unit at its effective caps');
    expect(r.detail).toContain('from Chapter 25 to Endgame (2 maps)');
    expect(r.detail).toContain('over 3 simulated runs; the ± is the simulation error (95%)');
    expect(r.detail).toContain('Rests on: one worst attacker per pair (may read high)');
    expect(r.detail).toContain('class changes at the level cap or when needed (either way), each fight’s EXP goes to its lead (may read low)');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatch(/^Chapter 25: /);
    expect(r.roadmap?.title).toMatch(/^Roadmap: [0-9]+ milestones?/);
  });

  it('reads the seed plan’s chance, keeping the marriages the player pinned (#198)', () => {
    const run = played(all.slice(0, -2));
    expect(flawlessReadout(engine, run, { runs: 1 }).detail).toContain('It’s the seed plan’s: marriages matched on how much of Endgame each child could beat at caps');
    const pins = [{ kind: 'marriage', couple: ['vaike', 'sully'] }] as const;
    const pinned = flawlessReadout(engine, run, { runs: 1, pins });
    const sim = engine.flawlessChance(run, { runs: 1, plan: engine.seedPlan(run, { pins }) });
    expect(pinned.text).toMatch(new RegExp(`^Flawless chance: ${chanceText(sim.chance).replace(/[.()]/g, '\\$&')} ±`));
    expect(pinned.detail).toContain('your pinned marriages kept');
    // Robin left open: the seed picks one.
    const open = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal' }));
    expect(flawlessReadout(engine, open, { runs: 1 }).detail).toContain('marriages and Robin matched');
  });

  it('shows each map’s gold at its end as a range, and says when the log records none (#190)', () => {
    const atLatest = (run: Run, edit: (s: Snapshot) => Snapshot) => editEntry(run, latestEntry(run)!.id, edit, 1);
    const run = atLatest(played(all.slice(0, -2)), (s) => ({ ...s, gold: 12500 }));
    const r = flawlessReadout(engine, run, { runs: 2 });
    const sim = engine.flawlessChance(run, { runs: 2, plan: engine.seedPlan(run) });
    const g = sim.maps[0]!.gold!;
    expect(g.low).toBeLessThanOrEqual(g.high);
    const range = g.low === g.high ? `${g.low.toLocaleString('en-US')}G` : `${g.low.toLocaleString('en-US')}–${g.high.toLocaleString('en-US')}G`;
    // Renown's rewards arriving on the map follow it (#191).
    const rewards = engine.renown(run).stops[0]!.rewards;
    expect(r.rows[0]).toBe(`Chapter 25: ${chanceText(sim.maps[0]!.noDeath!)} · ${range}${rewards.length ? ` · renown: ${rewards.join(', ')}` : ''}`);
    expect(r.detail).toContain('Gold per map is each run’s gold at the map’s end, 10th to 90th percentile');
    expect(r.detail).not.toContain('records no gold');
    expect(flawlessReadout(engine, played(all.slice(0, -2)), { runs: 1 }).detail).toContain('Your latest entry records no gold, so the runs start with none');
  });

  it('names a unit whose seal history is read as 0, and says when the endpoint is recorded', () => {
    const run = editEntry(played(all.slice(0, -1)), 'e1', (s) => ({ ...s, units: { ...s.units, chrom: { class: 'Great Lord', level: 5, promoted: true, reclassed: false, exp: 0, stats: { hp: 40, str: 20, mag: 3, skl: 20, spd: 20, lck: 20, def: 15, res: 10 }, skills: [], inventory: [], supports: [] } } }), 1);
    expect(flawlessReadout(engine, run, { runs: 1 }).detail).toContain('Chrom was first logged in a class it can’t join in: the Second Seal count before the log is read as 0');
    expect(flawlessReadout(engine, played(all), { runs: 1 }).text).toBe('Flawless chance: the endpoint is recorded, nothing left to simulate.');
  });

  it('shows the solve’s best plan with its fresh chance, and lists what the search found (#199)', () => {
    const run = played(all.slice(0, -2));
    const best = engine.seedPlan(run);
    const chance = engine.flawlessChance(run, { runs: 2, plan: best, seed: 9 });
    const progress = {
      best,
      chance,
      proposals: [{ plan: best, label: 'Vaike marries Sully', edits: ['Chrom marries Olivia', 'Vaike marries Sully'], gain: 0.012, margin: 0.004, runs: 32 }],
      closeCalls: [{ key: 'k', plan: best, label: 'Stahl marries Miriel', gain: -0.002, margin: 0.003, runs: 32 }],
      pruned: [{ label: 'Gaius marries Nowi', ceiling: 0.2, best: 0.5 }],
      done: false,
      converged: false,
    };
    const r = solvedReadout(engine, run, progress);
    expect(r.text).toMatch(new RegExp(`^Flawless chance: ${chanceText(chance.chance).replace(/[.()]/g, '\\$&')} ±.* · searching…$`));
    expect(r.detail).toContain('It’s the best plan the search has found so far');
    expect(r.detail).toContain('worked out again on fresh runs, so picking it doesn’t inflate it');
    expect(r.found).toEqual([
      'Improvement: Chrom marries Olivia; Vaike marries Sully: +1.2 ±0.4',
      'Stahl marries Miriel: no measurable difference (−0.2 ±0.3)',
      'Not tried: Gaius marries Nowi (its ceiling 20.0% is below the best found, 50.0%)',
    ]);
    expect(solvedReadout(engine, run, { ...progress, done: true, converged: true }).text).toMatch(/ · searched$/);
    // Worked out on the page, there's nothing found to list.
    expect(flawlessReadout(engine, run, { runs: 1 }).found).toEqual([]);
  });

  it('shows the ceiling at Apotheosis, now that its foes carry their forged weapons (#189)', () => {
    const full = withRun(EMPTY_ROSTER, { route: 'full-route', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
    const order = engine.mapOrder(runFromRoster(full)).steps.map((s) => s.map);
    // Played up to the last story chapter: Apotheosis (both routes) is what's left.
    const run = order.slice(0, order.indexOf('apotheosis')).reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(full));
    const r = flawlessReadout(engine, run, { runs: 1 });
    const ceiling = engine.ceiling(run, { runs: 1, plan: engine.seedPlan(run) })!;
    expect(r.text).toMatch(new RegExp(` · ceiling ${chanceText(ceiling.chance!).replace(/[.()]/g, '\\$&')}$`));
    expect(r.detail).toContain('The ceiling is the chance no unit dies on Apotheosis (secret route)');
    expect(r.detail).not.toContain('simulated yet');
  });
});

describe('the roadmap readout (#194)', () => {
  const engine = createEngine();
  const fresh = runFromRoster(withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' }));
  const plan = engine.seedPlan(fresh, { pins: [{ kind: 'marriage', couple: ['chrom', 'sumia'] }, { kind: 'marriage', couple: ['stahl', 'sully'] }] });
  const r = roadmapReadout(engine, fresh, plan);
  const milestones = engine.milestones(fresh, plan);

  it('lists the plan’s milestones in order, one row each', () => {
    const stuck = milestones.filter((m) => m.kind === 'support' && m.nonStarter).length;
    expect(r.title).toBe(`Roadmap: ${milestones.length} milestones${stuck ? ` · ${stuck} non-starter${stuck === 1 ? '' : 's'}` : ''}`);
    expect(r.rows).toHaveLength(milestones.length);
    const chrom = milestones.findIndex((m) => m.id === 'support:chrom+sumia');
    expect(r.rows[chrom]).toMatch(/^Chrom marries Sumia at the end of Chapter 11 \(fixed\): a C with him viewed before Chapter 11; start fighting together between Chapter \d+ and Chapter \d+ \(1 map\)$/);
    const olivia = engine.seedPlan(fresh, { pins: [{ kind: 'marriage', couple: ['chrom', 'olivia'] }] });
    expect(roadmapReadout(engine, fresh, olivia).rows).toContain(
      'Chrom marries Olivia at the end of Chapter 11 (fixed): 2 points with him on Chapter 11 (3 combats as his Support Unit), with no C with him viewed for Sumia, Sully and Maribelle',
    );
    const kjelle = milestones.findIndex((m) => m.id === 'recruit:kjelle');
    expect(r.rows[kjelle]).toBe('Recruit Kjelle (Sully and Stahl) on Paralogue 8, before Endgame');
    const pass = milestones.find((m) => m.kind === 'skill' && m.unit === 'sumia' && m.for.kind === 'pass' && m.for.child === 'lucina');
    expect(r.rows[milestones.indexOf(pass!)]).toMatch(/^Sumia learns \S.* \(.* Lv \d+\) and equips it last before Chapter 13, for Lucina$/);
    const chromClass = milestones.findIndex((m) => m.id === 'class:chrom:great-lord');
    expect(r.rows[chromClass]).toBe('Chrom reaches Great Lord before Endgame: a Master Seal found on Chapter 8 (Visit the western village)');
  });

  it('flags non-starters, wasted passes and seals play can lose', () => {
    const robin = milestones.findIndex((m) => m.kind === 'class' && m.risk);
    expect(r.rows[robin]).toContain(' · at risk: ');
    const wasted = { ...plan, wishlist: { ...plan.wishlist, children: plan.wishlist.children.map((c) => (c.child === 'kjelle' ? { ...c, passes: ['luna', 'luna'] as const } : c)) } };
    expect(roadmapReadout(engine, fresh, wasted).rows).toContain('Stahl learns Luna (Great Knight Lv 5) and equips it last before Paralogue 8, for Kjelle · wasted: the other parent passes it too');
    // Olivia joins in Chapter 11: too late to reach S with Donnel before Paralogue 6 where the route puts it (the seed
    // moves it later, #199; here, the route's template order and that marriage).
    const stuckPlan = engine.seedPlan(fresh, { pins: [{ kind: 'marriage', couple: ['donnel', 'olivia'] }] });
    const template = { ...stuckPlan, roadmap: { ...stuckPlan.roadmap, order: engine.mapOrder(fresh).steps.map((s) => s.key) } };
    const t = roadmapReadout(engine, fresh, template);
    const tm = engine.milestones(fresh, template);
    const olivia = tm.findIndex((m) => m.id === 'support:donnel+olivia');
    expect(t.rows[olivia]).toBe('Donnel and Olivia reach S before Paralogue 6 · non-starter: 8 maps together needed, from Chapter 11 on');
    expect(t.rows.filter((x) => x.includes('non-starter'))).toHaveLength(tm.filter((m) => m.kind === 'support' && m.nonStarter).length);
  });
});

describe('the chapter log’s short text fields', () => {
  it('round-trip inventory with uses and forges', () => {
    const items = [
      { item: 'Iron Sword', uses: 40 },
      { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
      { item: 'Falchion', uses: null },
    ];
    expect(heldText(items)).toBe('Iron Sword 40; Steel Sword 30 [Kiri +2/+10/+0]; Falchion');
    expect(parseHeldText(heldText(items))).toEqual(items);
  });

  it('round-trip supports, dropping anything that isn’t a rank', () => {
    const s = [{ partner: 'sumia' as const, rank: 'A' as const }];
    expect(parseSupportsText(supportsText(s))).toEqual(s);
    expect(parseSupportsText('sumia Z; lissa C')).toEqual([{ partner: 'lissa', rank: 'C' }]);
  });
});

describe('Record results’ recruits step (#155)', () => {
  const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str', difficulty: 'lunatic', route: 'main-story' });
  const stats = { hp: 46, str: 24, mag: 16, skl: 37, spd: 37, lck: 30, def: 10, res: 25 };
  const unit = (cls: string, st: UnitSnapshot['stats']): UnitSnapshot => ({ class: cls, level: 10, promoted: true, reclassed: false, exp: 0, stats: st, skills: [], inventory: [], supports: [] });
  const recorded = (units: Partial<Record<RosterUnit, UnitSnapshot>>, wife: RosterUnit | null) => {
    let run = editEntry(runFromRoster(facts), 'e1', (s) => ({ ...s, units }), 1);
    if (wife) run = recordMarriage(run, 'e1', 'chrom', wife, 1);
    run = addEntry(run, 'chapter-13', 2);
    return (u: RosterUnit) => childStatsNote(run, latestEntry(run)!, u);
  };

  it('names the parent whose stats kept a child’s blank', () => {
    const note = recorded({ chrom: unit('Great Lord', stats), sumia: unit('Dark Flier', null) }, 'sumia');
    expect(note('lucina')).toBe('Lucina: Sumia’s stats aren’t logged in the entry before this map, so Lucina’s stats are blank: record them from the game.');
    expect(note('chrom')).toBeNull();
  });

  it('says which parents a child’s stats were worked out from', () => {
    expect(recorded({ chrom: unit('Great Lord', stats), sumia: unit('Dark Flier', stats) }, 'sumia')('lucina')).toBe('Lucina: worked out from Chrom and Sumia as they were on entering this map.');
    expect(recorded({ chrom: unit('Great Lord', stats) }, 'maiden')('lucina')).toBe('Lucina: worked out from Chrom and the Maiden as they were on entering this map (the Maiden’s side is an assumption).');
    expect(recorded({ chrom: unit('Great Lord', stats) }, null)('lucina')).toBe('Lucina: Chrom isn’t married in the entry before this map, so Lucina’s stats are blank: record them from the game.');
  });
});

describe('Record results’ shopping step (#192)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const chrom: UnitSnapshot = { class: 'Lord', level: 5, promoted: false, reclassed: false, exp: 0, stats: null, skills: [], inventory: [{ item: 'Iron Sword', uses: 30 }], supports: [] };

  it('shows gold at the map’s end and after shopping, each line, and what the map used and found', () => {
    let run = editEntry(addEntry(runFromRoster(facts), 'prologue', 1), 'e2', (s) => ({ ...s, gold: 3000, units: { chrom } }), 1);
    run = withShopLine(run, 'e2', { kind: 'buy', item: 'Master Seal', gold: 2500 }, 1);
    run = withShopLine(run, 'e2', { kind: 'forge', item: 'Iron Sword', unit: 'chrom', gold: 260, forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } }, 1);
    const r = shoppingReadout(engine, run, 'e2');
    expect(r.gold).toBe('Gold at the map’s end 3,000G → after shopping 240G (seals 2,500G, kit 260G)');
    expect(r.lines).toEqual(['Bought Master Seal for the convoy: −2,500G', 'Forged Iron Sword [Edge +1/+0/+0] for Chrom: −260G']);
    run = addEntry(run, 'chapter-2', 2);
    run = editEntry(run, 'e3', (s) => ({ ...s, units: { chrom: { ...s.units.chrom!, inventory: [{ ...s.units.chrom!.inventory[0]!, uses: 25 }] } }, convoy: [...s.convoy, { item: 'Elixir', uses: 3 }] }), 2);
    const next = shoppingReadout(engine, run, 'e3');
    expect(next.gold).toBe('Gold at the map’s end 240G → after shopping 240G');
    expect(next.used).toBe('Uses spent on this map: Iron Sword 5');
    expect(next.found).toBe('Found on this map: Elixir (random find)');
  });
});

describe('side goals and renown on the Run view (#191)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);

  it('lists the side goals ahead with the plan’s decision, and a pin overrides it', () => {
    const run = played(all.slice(0, all.indexOf('chapter-16')));
    expect(sideGoalPlanReadout(engine, run).map((r) => r.text)).toEqual(['Chapter 16: Thieves: chase (at most one action a turn)', 'Chapter 18: Falling chests: chase (at most one action a turn)']);
    const pinned = withSideGoalPin(run, 'chapter-18-chests', 'skip');
    expect(sideGoalPlanReadout(engine, pinned)[1]).toMatchObject({ text: 'Chapter 18: Falling chests: always skip (pinned)', pin: 'skip' });
  });

  it('shows each chased goal’s share of runs on its map’s row, and says renown isn’t recorded', () => {
    const run = played(all.slice(0, all.indexOf('chapter-18')));
    const r = flawlessReadout(engine, run, { runs: 1 });
    const goal = engine.flawlessChance(run, { runs: 1 }).sideGoals.find((g) => g.id === 'chapter-18-chests')!;
    expect(r.rows[0]).toMatch(/^Chapter 18: /);
    expect(r.rows[0]).toContain(` · Falling chests ${goal.secured === undefined ? 'chased' : `secured ${chanceText(goal.secured)}`}`);
    expect(r.detail).toContain('A side goal the plan chases costs actions on its map');
    expect(r.detail).toContain('Renown isn’t recorded: it reads as 10 per story map logged');
    expect(flawlessReadout(engine, withRenown(run, { start: 0, claimed: [] }), { runs: 1 }).detail).toContain('Renown is ');
  });

  it('pre-fills Record results’ side goals from the map’s finds, and asks for renown once', () => {
    let run = played(['chapter-10']);
    run = editEntry(run, 'e2', (s) => ({ ...s, convoy: ['Bullion (M)', 'Wyrmslayer', 'Master Seal', 'Seraph Robe'].map((item) => ({ item, uses: null })) }), 1);
    const r = sideGoalsReadout(engine, run, 'e2');
    expect(r.goals).toEqual([{ id: 'chapter-10-thieves', label: 'Chapter 10: Thieves', what: 'Kill the four Ruffian Thieves before they escape', secured: true, note: 'pre-filled from the map’s finds: Bullion (M), Wyrmslayer, Master Seal and Seraph Robe' }]);
    expect(r.renown).toBe('Renown isn’t recorded yet: enter the renown this file started with, then the rewards already claimed (asked once for the run).');
    const recorded = withSideGoalSecured(withRenown(run, { start: 45, claimed: [] }), 'e2', 'chapter-10-thieves', false, 2);
    const after = sideGoalsReadout(engine, recorded, 'e2');
    expect(after.goals[0]).toMatchObject({ secured: false, note: 'as you recorded it' });
    expect(after.renown).toBe('Renown after this map: 55 (reached: Glass Sword).');
  });
});

describe('the item plan on the Run view and Record results’ items used (#193)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[], from = runFromRoster(facts)) => maps.reduce((r, m, i) => addEntry(r, m, from.entries.length + i + 1), from);
  const steps = engine.mapOrder(played([])).steps;
  const all = steps.map((s) => s.map);
  const start = played(all.slice(0, -2));
  const run = editEntry(start, latestEntry(start)!.id, (s) => ({ ...s, convoy: [{ item: 'Energy Drop', uses: 1 }, { item: 'Boots', uses: 1 }] }), 1);
  const label = (key: string) => engine.maps().find((m) => m.id === steps.find((s) => s.key === key)!.map)!.label;
  const plan = engine.seedPlan(run);
  const drop = plan.roadmap.items.find((p) => p.item === 'Energy Drop')!;

  it('shows each held item’s planned use, Boots outside the model, and the tonics to buy per map', () => {
    const r = itemPlanReadout(engine, run, plan, undefined);
    expect(r.rows.find((x) => x.item === 'Energy Drop')).toMatchObject({ text: `Energy Drop (held): ${unitName(drop.unit, 'M')} at ${label(drop.key)}`, pin: { kind: 'booster', unit: undefined } });
    expect(r.rows.find((x) => x.item === 'Boots')!.text).toBe('Boots (held): your call, outside the model (it has no movement): pin it to assign them');
    const buys = plan.roadmap.items.filter((p) => p.source === 'buy');
    expect(r.tonics).toEqual(buys.length ? [`Endgame: ${buys.length} tonic${buys.length === 1 ? '' : 's'}, ${(buys.length * 150).toLocaleString('en-US')}G`] : []);
    expect(r.summary).toMatch(/^Item plan: \d+ of \d+ held items used/);
  });

  it('keeps a pin, marked as pinned', () => {
    const pinned = withItemPin(run, { kind: 'booster', item: 'Energy Drop', unit: 'chrom' });
    const pins = pinned.itemPins!;
    const r = itemPlanReadout(engine, pinned, engine.seedPlan(pinned, { pins }), undefined, pins);
    const row = r.rows.find((x) => x.item === 'Energy Drop')!;
    expect(row.text).toMatch(/^Energy Drop \(held\): Chrom at .* \(pinned\)$/);
    expect(row.pin).toMatchObject({ kind: 'booster', unit: 'chrom' });
  });

  it('pre-fills the items used step from the plan before the map, and keeps what’s recorded', () => {
    const map = steps.find((s) => s.key === drop.key)!.map;
    const done = played(all.slice(all.length - 2, all.indexOf(map) + 1), run);
    const entry = latestEntry(done)!.id;
    const r = itemsUsedReadout(engine, done, entry, plan);
    expect(r.note).toBe('Pre-filled from the plan’s “before this map” list: untick what you didn’t use, add what you did.');
    expect(r.items).toContainEqual({ item: 'Energy Drop', unit: drop.unit, used: true, text: `Energy Drop → ${unitName(drop.unit, 'M')}` });
    const recorded = itemsUsedReadout(engine, withItemsUsed(done, entry, [], 2), entry, plan);
    expect(recorded.note).toBe('As you recorded it: tick what was used.');
    expect(recorded.items).toContainEqual(expect.objectContaining({ item: 'Energy Drop', used: false }));
  });
});
