import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, deployCount, editEntry, foesOf, forcedOn, itemByName, latestEntry, mapSpanPin, prepUnits, runFromRoster, simLineup, suggestDeployment, unitName, withPin, withRun, type Difficulty, type Plan, type Run, type SimGroup, type Snapshot } from '../engine';
import { PREP_STEPS, fighterOf, noDeathReadout, prepReadout, shoppingReadout, type PrepReadout } from './prep-page';

describe('the shopping list (#190)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const atLatest = (run: Run, edit: (s: Snapshot) => Snapshot) => editEntry(run, latestEntry(run)!.id, edit, 1);
  const chrom = { class: 'Great Lord', level: 15, promoted: true, reclassed: false, exp: 0, stats: { hp: 60, str: 35, mag: 5, skl: 35, spd: 35, lck: 35, def: 30, res: 20 }, skills: [], supports: [] };

  it('lists the next armory stop’s buys, with why, what they cost and the chance a run makes each', () => {
    // One use left on Chrom’s only weapon: it runs dry on Chapter 25, whose armory sells a Silver Lance that wins the
    // Great Lord more matchups there (the realism pass re-arms the lineup on the way), so that's what the runs buy.
    const run = atLatest(played(all.slice(0, -2)), (s) => ({ ...s, gold: 3000, units: { chrom: { ...chrom, inventory: [{ item: 'Iron Sword', uses: 1 }] } } }));
    const s = shoppingReadout(engine, run, { runs: 2 });
    expect(s.title).toBe('Shopping list: Chapter 25');
    expect(s.note).toMatch(/^Gold on arrival: 3,000G\. What the simulated runs buy here, in priority order: rebuys/);
    expect(s.rows[0]).toEqual(['Chrom', 'Buy Silver Lance (arms the lineup for this map)', '1,560G', '100%']);
  });

  it('says when nothing is to be bought: no gold, or nothing left to play', () => {
    const run = atLatest(played(all.slice(0, -2)), (s) => ({ ...s, gold: 0 }));
    expect(shoppingReadout(engine, run, { runs: 1 }).rows).toEqual([]);
    expect(shoppingReadout(engine, played(all), { runs: 1 })).toMatchObject({ title: 'Shopping list', rows: [] });
  });
});

/** Every action on the page: the checklist's steps, then On the map. */
const actionsOf = (r: PrepReadout) => [...r.before.flatMap((s) => s.actions), ...r.onMap];

describe('the preparation page (#207): pair cards beside one checklist', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp', mode: 'classic' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const order = engine.mapOrder(played([])).steps.map((s) => s.map);
  const readout = (run: Run, map: string, plan: Plan = engine.seedPlan(run)) => prepReadout(engine, run, map, { plan, forecast: engine.expForecast(run, plan, { runs: 1 }) });
  const name = (u: string) => unitName(u as never, 'M');
  // Chapter 3 on a fresh run (the first map with preparations), read once for the tests below.
  const ch3Run = played(order.slice(0, 4));
  let ch3: PrepReadout | undefined;
  const chapter3 = () => (ch3 ??= readout(ch3Run, 'chapter-3'));

  it('plays a forced map with no preparation phase: a banner, the cards and On the map only (#131)', () => {
    const r = readout(played(['premonition']), 'prologue');
    expect(r.noPrep).toBe(true);
    expect(r.banner).toBe('No preparation phase: the game fields Chrom, Robin (M), Lissa and Frederick and starts the map at once. Nothing here is done in menus; it’s a plan for the map itself.');
    expect(r.before).toEqual([]);
    expect(r.shopping).toBeUndefined();
    expect(actionsOf(r).every((a) => a.step === 'map')).toBe(true);
    // A card for each pair and unit alone: the whole forced lineup, marked as joining here.
    const members = r.cards.flatMap((c) => c.members);
    expect(members.map((m) => m.name).sort()).toEqual(['Chrom', 'Frederick', 'Lissa', 'Robin (M)']);
    expect(members.every((m) => m.forced && m.joins === 'joins')).toBe(true);
    expect(r.head.noDeath).toMatch(/^No-death chance on this map: /);
    expect(r.head.flawless).toMatch(/^The plan’s flawless chance: .* ±\d+\.\d$/);
    expect(r.head.deploy).toBe('deploy 4 of 4 (forced)');
  });

  it('shows each action’s worth in flawless points once the worker has costed its removal (#175 story 59)', () => {
    const plan = engine.seedPlan(ch3Run);
    const forecast = engine.expForecast(ch3Run, plan, { runs: 1 });
    const bare = prepReadout(engine, ch3Run, 'chapter-3', { plan, forecast });
    const [a, b] = actionsOf(bare).filter((x) => x.step === 'units');
    expect(a!.worth).toBeUndefined();
    const worth = new Map([
      [a!.id, { gain: -0.012, margin: 0.004, runs: 32, verdict: 'worse' as const, settled: true }],
      [b!.id, { gain: 0.001, margin: 0.003, runs: 32, verdict: 'close' as const, settled: true }],
    ]);
    const r = prepReadout(engine, ch3Run, 'chapter-3', { plan, forecast, worth });
    const [x, y] = actionsOf(r).filter((z) => z.step === 'units');
    expect(x).toMatchObject({ worth: 0.012, worthText: 'worth +1.2 ±0.4' });
    expect(y).toMatchObject({ worthText: 'worth no measurable difference (−0.1 ±0.3)' });
  });

  it('gives each pair its positions, jobs, EXP priority and expected EXP, milestone, stance plan and threats', () => {
    const run = ch3Run;
    const r = chapter3();
    expect(r.noPrep).toBe(false);
    expect(r.title).toBe('Prepare: Chapter 3: Warrior Realm');
    const pairs = r.cards.filter((c) => c.members.length === 2);
    expect(pairs.length).toBeGreaterThan(0);
    for (const c of r.cards) {
      expect(c.members.map((m) => m.position)).toEqual(c.members.length === 2 ? ['Lead', 'Back'] : ['Solo']);
      expect(c.title).toBe(c.members.map((m) => m.name).join(' + '));
      for (const m of c.members) {
        expect(m.job).toMatch(/^(fights|backs|heals|dances|rallies|talks|waits)/);
        expect(['High', 'Normal', 'Low']).toContain(m.priority);
        expect(m.exp).toMatch(/^(≈\d+ EXP · Lv \d+|—)/);
      }
      // The stance plan, turn by turn, from the play's stances.
      if (c.members.length === 2) expect(c.stances[0]).toMatchObject({ turns: expect.stringMatching(/^T1/), text: expect.stringMatching(/^(together, .+ in front|side by side|apart)/) });
      else expect(c.stances).toEqual([]);
      for (const t of c.threats) expect(t.chance).toMatch(/^(under 0\.1%|\d+\.\d%)$/);
    }
    // A unit whose worst round kills it flags its card.
    for (const t of r.threats.filter((x) => x.worstKills)) {
      const victim = t.worst.replace(/^.* HP on /, '');
      const c = r.cards.find((x) => x.members.some((m) => m.name === victim));
      expect(c?.worstKills).toContain(`HP on ${victim}`);
    }
    // Threats: the cautious worst case beside each group's chance of killing someone and who takes it.
    expect(r.threats.length).toBeGreaterThan(0);
    for (const t of r.threats) {
      expect(t.worst).toMatch(/^Worst round \d+ \/ \d+ HP on /);
      expect(t.chance).toMatch(/^(0%|under 0\.1%|\d+\.\d%)$/);
    }
    expect(r.threats.some((t) => t.who !== '—')).toBe(true);
  });

  it('lists each action once, in the game’s menu order with why, and the cards count and link theirs', () => {
    const r = chapter3();
    const acts = actionsOf(r);
    expect(new Set(acts.map((a) => a.id)).size).toBe(acts.length);
    const steps = r.before.map((s) => PREP_STEPS.indexOf(s.step));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(r.before[0]!.label).toBe('Pick units and pair up');
    for (const a of acts) expect(a.why).not.toBe('');
    // Each pair is picked and paired up in the menu, with the support it grows (or the lineup) as why.
    for (const c of r.cards.filter((x) => x.members.length === 2)) {
      const [lead, back] = c.members;
      const a = acts.find((x) => x.id === `pair:${lead!.unit}`)!;
      expect(a.text).toBe(`Pair up ${lead!.name} and ${back!.name}: ${lead!.name} leads`);
      expect(a.why).toMatch(/^(support .+|the plan’s lineup \(\d+ of \d+\))/);
    }
    // A card's to-dos are the actions for its units, by id: nothing is written twice.
    for (const c of r.cards) expect(c.todo).toEqual(acts.filter((a) => a.units.some((u) => c.members.some((m) => m.unit === u))).map((a) => a.id));
    // Chrom talks Kellam into joining on the map.
    expect(r.onMap.find((a) => a.id === 'talk:kellam')).toMatchObject({ step: 'map', text: 'Turn 1: Chrom talks to Kellam', why: 'recruits Kellam' });
  });

  it('lists the units not fielded with their reason, arrivals among them, and keeps this map’s pins', () => {
    const run = ch3Run;
    const r = chapter3();
    expect(r.notFielded.find((x) => x.unit === 'kellam')?.reason).toMatch(/^arrive/);
    const fielded = r.cards.flatMap((c) => c.members.map((m) => m.unit));
    const [lead, back, dropped] = fielded.filter((u) => !r.cards.some((c) => c.members.some((m) => m.unit === u && m.forced)));
    // Picking a back and dropping a unit are span pins over this map only.
    const pinned = withPin(withPin(run, mapSpanPin(lead!, 'lead', 'chapter-3', back!)), mapSpanPin(dropped!, 'out', 'chapter-3'));
    const p = readout(pinned, 'chapter-3');
    expect(p.cards.find((c) => c.title === `${name(lead!)} + ${name(back!)}`)?.pinned).toBe(true);
    expect(p.notFielded.find((x) => x.unit === dropped)).toMatchObject({ reason: 'dropped here (a pin over this map only)', dropped: true });
    expect(p.cards.some((c) => c.members.some((m) => m.unit === dropped))).toBe(false);
  });
});

describe('the checklist’s items and armory (#207)', () => {
  const engine = createEngine();
  const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const chrom = { class: 'Great Lord', level: 15, promoted: true, reclassed: false, exp: 0, stats: { hp: 60, str: 35, mag: 5, skl: 35, spd: 35, lck: 35, def: 30, res: 20 }, skills: [], supports: [] };

  it('buys this map’s shopping-list lines in the armory step, on the card of the unit they’re for', () => {
    const before = played(all.slice(0, -2));
    const run = editEntry(before, latestEntry(before)!.id, (s) => ({ ...s, gold: 3000, units: { chrom: { ...chrom, inventory: [{ item: 'Iron Sword', uses: 1 }] } } }), 1);
    const plan = engine.seedPlan(run);
    const r = prepReadout(engine, run, all[all.length - 2]!, { plan, forecast: engine.expForecast(run, plan, { runs: 2 }) });
    const armory = r.before.find((s) => s.step === 'armory')!;
    expect(armory.label).toBe('Armory and forge');
    expect(armory.actions[0]).toMatchObject({ id: 'shop:0', text: 'Buy Silver Lance for Chrom (1,560G)', why: 'shopping list: arms the lineup for this map; 100% of runs', units: ['chrom'] });
    expect(r.cards.find((c) => c.members.some((m) => m.unit === 'chrom'))!.todo).toContain('shop:0');
  });

  it('puts the item plan’s handovers under Inventory and trade and its boosters and tonics under Use items', () => {
    const run = editEntry(played(all.slice(0, -2)), 'e1', (s) => ({ ...s, convoy: [{ item: 'Levin Sword', uses: 25 }] }), 1);
    const seed = engine.seedPlan(run);
    const items = [
      { item: 'Energy Drop', unit: 'chrom' as const, key: 'endgame', source: 'held:Energy Drop#0' },
      { item: 'Strength Tonic', unit: 'chrom' as const, key: 'endgame', source: 'buy' },
      { item: 'Levin Sword', unit: 'robin' as const, key: 'endgame', source: 'held:convoy:Levin Sword#0' },
    ];
    const plan = { ...seed, roadmap: { ...seed.roadmap, items } };
    const r = prepReadout(engine, run, 'endgame', { plan, forecast: engine.expForecast(run, plan, { runs: 1 }) });
    const texts = (step: string) => r.before.find((s) => s.step === step)?.actions.map((a) => a.text);
    expect(texts('trade')).toEqual(['Hand over Levin Sword: the convoy → Robin (M)']);
    expect(texts('items')!.slice(0, 2)).toEqual(['Drink Energy Drop: Chrom', 'Drink Strength Tonic: Chrom (buy it first: 150G)']);
    expect(r.before.find((s) => s.step === 'items')!.actions[0]!.why).toBe('item plan: +2 for good');
    expect(r.before.map((s) => s.step).slice(0, 3)).toEqual(['units', 'trade', 'items']);
  });
});

const unit = {
  class: 'Great Knight',
  level: 1,
  promoted: true,
  reclassed: false,
  exp: 0,
  stats: { hp: 28, str: 13, mag: 2, skl: 12, spd: 10, lck: 6, def: 14, res: 3 },
  skills: ['Discipline'],
  inventory: [
    { item: 'Vulnerary', uses: 3 },
    { item: 'Silver Lance', uses: 20 },
    { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
  ],
  supports: [
    { partner: 'sully' as const, rank: 'C' as const },
    { partner: 'cordelia' as const, rank: 'A' as const },
  ],
};

describe('the preparation page’s fighters', () => {
  it('take a unit’s weapons from its inventory, with forges, skipping items', () => {
    const f = fighterOf('Frederick', unit)!;
    expect(f.weapons.map((w) => w.item.name)).toEqual(['Silver Lance', 'Steel Sword']);
    expect(f.weapons[1]!.forge).toEqual({ mt: 2, hit: 10, crit: 0 });
    expect(fighterOf('Nobody', { ...unit, stats: null })).toBeUndefined();
  });

  it('carry its staves and potions with the uses left, for the simulation’s sustain (#182)', () => {
    const f = fighterOf('Frederick', { ...unit, inventory: [...unit.inventory, { item: 'Heal', uses: 12 }, { item: 'Vulnerary', uses: 0 }] })!;
    expect(f.items.map((i) => [i.item.name, i.uses])).toEqual([
      ['Vulnerary', 3],
      ['Heal', 12],
    ]);
  });

});

describe('the next map’s no-death chance (#181)', () => {
  const engine = createEngine();
  const stats = (hp: number, str: number, skl: number, spd: number, lck: number, def: number) => ({ hp, str, mag: 0, skl, spd, lck, def, res: 0 });
  const member = (id: string, s: ReturnType<typeof stats>) => {
    const weapon = { item: itemByName('Silver Sword')! };
    return { id, fighter: { name: id, className: 'Swordmaster', stats: s, skills: [], weapon }, weapons: [weapon] };
  };

  it('reads the chance with the edge wording, and how the map ends', () => {
    const strong: SimGroup[] = [{ lead: member('chrom', stats(60, 40, 40, 40, 30, 30)), support: null }];
    const r = noDeathReadout(engine, 'chapter-2', 'lunatic', strong);
    expect(r.text).toBe('No-death chance: 100%');
    expect(r.detail).toMatch(/^Played turn by turn with this lineup and your latest stats: a rout in \d+ turns?\./);
    const frail: SimGroup[] = [{ lead: member('chrom', stats(18, 7, 6, 6, 4, 5)), support: null }];
    expect(noDeathReadout(engine, 'chapter-2', 'lunatic', frail).text).toMatch(/^No-death chance: (\d+\.\d%|under 0\.1%|0%)( \((loses a unit|flawless) about 1 run in [\d,]+\))?$/);
  });

  it('asks for recorded stats when nobody can be fielded', () => {
    expect(noDeathReadout(engine, 'chapter-2', 'lunatic', []).text).toBe('No-death chance: record your units’ stats in the chapter log to see it.');
  });
});

describe('the no-death chance of a fresh run’s first maps (#183)', () => {
  const engine = createEngine();
  /**
   * The lineup the preparation page fields for `map` on a fresh run: the chapter log through the maps before it, each
   * map's recruits at their join stats and inventory, the deployment the page suggests (roster roles).
   */
  function freshLineup(difficulty: Difficulty, map: string, before: readonly string[]): SimGroup[] {
    let run = runFromRoster(withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'hp', difficulty, mode: 'classic', route: 'main-story' }));
    before.forEach((m, i) => (run = addEntry(run, m, i + 1)));
    const prep = prepUnits(run, map);
    const table = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
    const m = engine.maps().find((x) => x.id === map)!;
    const candidates = prep.units.flatMap(([unit, u]) => {
      const f = fighterOf(unitName(unit, 'M'), u);
      return f ? [{ unit, fighter: f.fighter, weapons: f.weapons, items: f.items, supports: u.supports }] : [];
    });
    const opening = [...prep.joining, ...prep.mapOnly];
    const max = deployCount(m.conditions[table]?.deploy ?? '', opening.map((u) => unitName(u))) || candidates.length;
    const deployment = suggestDeployment({ candidates, forced: [...forcedOn(map), ...opening], max, foes: foesOf(m, table, false), pool: () => [] });
    return simLineup(deployment, new Map(candidates.map((c) => [c.unit, c])));
  }
  const chance = (difficulty: Difficulty, map: string, before: readonly string[]) => engine.mapNoDeath({ map: engine.simMap(map, difficulty), lineup: freshLineup(difficulty, map, before) }, 1);

  // A careful player clears these essentially always: Frederick fights, the weak units wait out of reach (#183).
  it.each([
    ['normal', 'prologue', ['premonition']],
    ['hard', 'prologue', ['premonition']],
    ['lunatic', 'prologue', ['premonition']],
    ['normal', 'chapter-1', ['premonition', 'prologue']],
    ['normal', 'chapter-2', ['premonition', 'prologue', 'chapter-1']],
    ['normal', 'chapter-3', ['premonition', 'prologue', 'chapter-1', 'chapter-2']],
  ] as const)('reads %s %s as nearly always flawless', (difficulty, map, before) => {
    expect(freshLineup(difficulty, map, before).length).toBeGreaterThan(0);
    expect(chance(difficulty, map, before)).toBeGreaterThanOrEqual(0.9);
  });
});
