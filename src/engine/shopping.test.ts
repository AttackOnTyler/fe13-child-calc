import { describe, expect, it } from 'vitest';
import {
  EMPTY_ROSTER,
  addEntry,
  createEngine,
  editEntry,
  exportRun,
  flaggedEntries,
  importRun,
  latestEntry,
  parseRun,
  prepUnits,
  removeShopLine,
  runFromRoster,
  shopPrice,
  withRun,
  withShopLine,
  type Run,
  type ShopLine,
  type Snapshot,
  type UnitSnapshot,
} from './index';

/** The shopping step of Record results (#192), through the chapter log's functions and the facade. */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const unit = (inventory: UnitSnapshot['inventory']): UnitSnapshot => ({
  class: 'Lord',
  level: 5,
  promoted: false,
  reclassed: false,
  exp: 0,
  stats: { hp: 25, str: 9, mag: 0, skl: 10, spd: 10, lck: 8, def: 7, res: 2 },
  skills: [],
  inventory,
  supports: [],
});
const at = (run: Run, id: string, edit: (s: Snapshot) => Snapshot) => editEntry(run, id, edit, 1);
const shop = (run: Run, id: string, ...lines: ShopLine[]) => lines.reduce((r, l) => withShopLine(r, id, l, 1), run);

/** Chrom after the Prologue with 3,000G, then a shopping trip: a Steel Sword and a forge for him, a spare Iron Sword and a seal for the convoy, his Vulnerary sold. */
function shopped(): Run {
  let run = at(addEntry(runFromRoster(facts), 'prologue', 1), 'e2', (s) => ({ ...s, gold: 3000, convoy: [], units: { chrom: unit([{ item: 'Iron Sword', uses: 30 }, { item: 'Vulnerary', uses: 3 }]) } }));
  run = shop(
    run,
    'e2',
    { kind: 'buy', item: 'Steel Sword', unit: 'chrom', gold: 840 },
    { kind: 'forge', item: 'Iron Sword', unit: 'chrom', gold: 260, forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } },
    { kind: 'buy', item: 'Iron Sword', gold: 520 },
    { kind: 'buy', item: 'Master Seal', gold: 2500 },
    { kind: 'sell', item: 'Vulnerary', unit: 'chrom', gold: 150 },
  );
  return run;
}

describe('the shopping step (#192)', () => {
  it('prices each line as the game does: a buy at its worth, a sale by uses left, a forge by its steps', () => {
    expect(shopPrice({ kind: 'buy', item: 'Steel Sword' })).toBe(840);
    expect(shopPrice({ kind: 'buy', item: 'Vulnerary', count: 3 })).toBe(900);
    expect(shopPrice({ kind: 'sell', item: 'Vulnerary' }, { uses: 3 })).toBe(150);
    expect(shopPrice({ kind: 'forge', item: 'Iron Sword', forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } })).toBe(260);
    // From +1 Mt to +2 Mt: the second step only.
    expect(shopPrice({ kind: 'forge', item: 'Iron Sword', forge: { name: 'Edge', mt: 2, hit: 0, crit: 0 } }, { uses: 40, forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } })).toBe(520);
  });

  it('keeps the entry’s gold at the map’s end and derives gold after shopping, split into upkeep, seals and kit', () => {
    const s = engine.shopping(shopped(), 'e2')!;
    expect(s.goldAtEnd).toBe(3000);
    expect(s.goldAfter).toBe(3000 - 840 - 260 - 520 - 2500 + 150);
    expect(s.spend).toEqual({ upkeep: 520, seals: 2500, kit: 840 + 260, sold: 150 });
    expect(s.lines).toHaveLength(5);
  });

  it('starts the next entry from the snapshot after shopping', () => {
    const run = addEntry(shopped(), 'chapter-1', 2);
    const s = latestEntry(run)!.snapshot;
    expect(s.gold).toBe(3000 - 840 - 260 - 520 - 2500 + 150);
    expect(s.units.chrom!.inventory).toEqual([
      { item: 'Iron Sword', uses: 30, forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } },
      { item: 'Steel Sword', uses: 35 },
    ]);
    expect(s.convoy).toEqual([
      { item: 'Iron Sword', uses: 40 },
      { item: 'Master Seal', uses: 1 },
    ]);
    // The preparation page fields the army as it left the shop.
    expect(prepUnits(shopped(), 'chapter-1').units.find(([u]) => u === 'chrom')![1].inventory).toHaveLength(2);
  });

  it('derives uses spent from uses left between entries, and random finds from items with nothing behind them', () => {
    // Chapter 2's items are an Iron Sword and an Iron Lance dropped by its foes.
    let run = addEntry(shopped(), 'chapter-2', 2);
    run = at(run, 'e3', (s) => ({
      ...s,
      gold: 1200,
      units: { ...s.units, chrom: { ...s.units.chrom!, inventory: [{ item: 'Iron Sword', uses: 22, forge: { name: 'Edge', mt: 1, hit: 0, crit: 0 } }, { item: 'Steel Sword', uses: 33 }, { item: 'Iron Lance', uses: 40 }] } },
      convoy: [...s.convoy, { item: 'Elixir', uses: 3 }],
    }));
    const s = engine.shopping(run, 'e3')!;
    expect(s.used).toEqual([
      { item: 'Iron Sword', uses: 8 },
      { item: 'Steel Sword', uses: 2 },
    ]);
    expect(s.found).toEqual([
      { item: 'Iron Lance', count: 1, from: 'map' },
      { item: 'Elixir', count: 1, from: 'random' },
    ]);
    // A bought item is never a find, and a recruit's own items aren't counted.
    expect(engine.shopping(run, 'e2')!.found).toEqual([]);
  });

  it('flags later entries when a past entry’s shopping changes', () => {
    const run = addEntry(shopped(), 'chapter-1', 2);
    expect(flaggedEntries(run).size).toBe(0);
    const fixed = removeShopLine(run, 'e2', 4, 3);
    expect(engine.shopping(fixed, 'e2')!.lines).toHaveLength(4);
    expect(flaggedEntries(fixed).has('e3')).toBe(true);
  });

  it('saves and loads the shopping, and still loads a run saved before it', () => {
    const run = shopped();
    expect(importRun(exportRun(run))).toEqual(run);
    const old = JSON.parse(exportRun(run));
    delete old.entries[1].shopping;
    const loaded = parseRun(old);
    expect(loaded.entries[1]!.shopping).toBeUndefined();
    expect(engine.shopping(loaded, 'e2')!.goldAfter).toBe(3000);
    // Unreadable lines are dropped; a forge needs its forge.
    const bad = parseRun({ ...JSON.parse(exportRun(run)), entries: [{ id: 'e1', map: 'other', snapshot: {}, shopping: [{ kind: 'steal', item: 'Iron Sword', gold: 0 }, { kind: 'forge', item: 'Iron Sword', gold: 10 }, { kind: 'buy', item: 'Vulnerary', gold: 300 }] }] });
    expect(bad.entries[0]!.shopping).toEqual([{ kind: 'buy', item: 'Vulnerary', gold: 300 }]);
  });
});

describe('the gold forecast re-anchors on the recorded shopping (#192)', () => {
  const played = (maps: readonly string[]) => maps.reduce((r, m, i) => addEntry(r, m, i + 1), runFromRoster(facts));
  const all = engine.mapOrder(played([])).steps.map((s) => s.map);
  const base = played(all.slice(0, -2));
  const id = latestEntry(base)!.id;

  it('starts every run from gold, items and seals after shopping', () => {
    const withShop = shop(at(base, id, (s) => ({ ...s, gold: 12500 })), id, { kind: 'buy', item: 'Master Seal', gold: 2500 });
    const asIfHeld = at(base, id, (s) => ({ ...s, gold: 10000, convoy: [...s.convoy, { item: 'Master Seal', uses: 1 }] }));
    const a = engine.flawlessChance(withShop, { runs: 1 });
    const b = engine.flawlessChance(asIfHeld, { runs: 1 });
    expect(a.maps).toEqual(b.maps);
    expect(a.shopping).toEqual(b.shopping);
    const unshopped = engine.flawlessChance(at(base, id, (s) => ({ ...s, gold: 12500 })), { runs: 1 });
    expect(unshopped.maps[0]!.gold).not.toEqual(a.maps[0]!.gold);
  });
});
