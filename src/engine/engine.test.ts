import { describe, expect, it } from 'vitest';
import { createEngine, DEFAULT_ASSUMPTIONS, resolveAssumptions, type AssumptionId, type ChildId, type Engine } from './index';
import { INHERITANCE_FIXTURES } from './fixtures';

const engine = createEngine();

const ASSET_FLAWS = 56; // Robin's 8 assets × 7 flaws
const nonRobin = (child: ChildId) => engine.pairings(child).filter((r) => r.pairing.variableParent.kind === 'unit');
const groupLabels = (child: ChildId) => engine.groups(child).map((g) => g.label);

describe('pairing enumeration (non-Robin)', () => {
  it('lists Lucina’s mothers: Chrom’s S-support partners plus the Maiden', () => {
    const mothers = nonRobin('lucina').map((r) => engine.parentName(r.pairing.variableParent));
    expect(mothers.sort()).toEqual(['Maiden', 'Maribelle', 'Olivia', 'Sully', 'Sumia']);
  });

  it('respects Sumia’s restricted list for Cynthia', () => {
    const fathers = nonRobin('cynthia').map((r) => engine.parentName(r.pairing.variableParent));
    expect(fathers.sort()).toEqual(['Chrom', 'Frederick', 'Gaius', 'Henry']);
  });

  it('lets Chrom father Brady, Kjelle and Inigo but not Owain', () => {
    const hasChrom = (child: ChildId) =>
      nonRobin(child).some((r) => r.pairing.variableParent.kind === 'unit' && r.pairing.variableParent.id === 'chrom');
    expect(hasChrom('brady')).toBe(true);
    expect(hasChrom('kjelle')).toBe(true);
    expect(hasChrom('inigo')).toBe(true);
    expect(hasChrom('owain')).toBe(false);
  });

  it('gives a general mother the twelve general fathers', () => {
    expect(nonRobin('severa')).toHaveLength(12);
    expect(nonRobin('owain')).toHaveLength(12);
  });

  it('keeps keys stable across engine instances and resolves them', () => {
    const again = createEngine();
    expect(again.pairings().map((r) => r.key)).toEqual(engine.pairings().map((r) => r.key));
    expect(engine.result('lucina|sumia')?.pairing).toEqual({ child: 'lucina', variableParent: { kind: 'unit', id: 'sumia' } });
    expect(engine.result('nope|nobody')).toBeUndefined();
  });
});

describe('pairing enumeration (Robin and Morgan)', () => {
  it('adds a Robin (F) pairing per asset/flaw to Lucina, and a Robin (M) one to every child with a fixed mother', () => {
    const robinRows = (child: ChildId) => engine.pairings(child).filter((r) => r.pairing.variableParent.kind === 'robin');
    expect(robinRows('lucina')).toHaveLength(ASSET_FLAWS);
    expect(robinRows('lucina').every((r) => r.pairing.variableParent.kind === 'robin' && r.pairing.variableParent.gender === 'F')).toBe(true);
    for (const child of ['owain', 'inigo', 'brady', 'kjelle', 'cynthia', 'severa', 'gerome', 'yarne', 'laurent', 'noire', 'nah'] as const) {
      const rows = robinRows(child);
      expect(rows, child).toHaveLength(ASSET_FLAWS);
      expect(rows.every((r) => r.pairing.variableParent.kind === 'robin' && r.pairing.variableParent.gender === 'M')).toBe(true);
    }
  });

  it('covers each asset/flaw choice exactly once, never with the same stat twice', () => {
    const choices = engine.pairings('kjelle').flatMap((r) =>
      r.pairing.variableParent.kind === 'robin' ? [`${r.pairing.variableParent.asset}/${r.pairing.variableParent.flaw}`] : [],
    );
    expect(new Set(choices).size).toBe(ASSET_FLAWS);
    expect(choices.some((c) => c.split('/')[0] === c.split('/')[1])).toBe(false);
  });

  it('marries Morgan (F)’s father Robin (M) to any woman he can S-support, each × 56 asset/flaws', () => {
    // 17 first-gen women (11 with children + 6 Robin-only), then the six daughters with each of their mothers/fathers.
    expect(groupLabels('morgan-f')).toEqual([
      'Lissa', 'Sully', 'Miriel', 'Sumia', 'Maribelle', 'Panne', 'Cordelia', 'Nowi', 'Tharja', 'Anna', 'Olivia', 'Cherche',
      "Say'ri", 'Tiki', 'Flavia', 'Emmeryn', 'Aversa',
      'Lucina ← Sully', 'Lucina ← Sumia', 'Lucina ← Maribelle', 'Lucina ← Olivia', 'Lucina ← Maiden',
      ...['Kjelle ← Chrom', 'Kjelle ← Frederick', 'Kjelle ← Virion', 'Kjelle ← Vaike', 'Kjelle ← Stahl', 'Kjelle ← Kellam', "Kjelle ← Lon'qu",
        'Kjelle ← Ricken', 'Kjelle ← Gaius', 'Kjelle ← Gregor', 'Kjelle ← Libra', 'Kjelle ← Henry', 'Kjelle ← Donnel'],
      'Cynthia ← Chrom', 'Cynthia ← Frederick', 'Cynthia ← Gaius', 'Cynthia ← Henry',
      ...['Frederick', 'Virion', 'Vaike', 'Stahl', 'Kellam', "Lon'qu", 'Ricken', 'Gaius', 'Gregor', 'Libra', 'Henry', 'Donnel'].map((f) => `Severa ← ${f}`),
      ...['Frederick', 'Virion', 'Vaike', 'Stahl', 'Kellam', "Lon'qu", 'Ricken', 'Gaius', 'Gregor', 'Libra', 'Henry', 'Donnel'].map((f) => `Noire ← ${f}`),
      ...['Frederick', 'Virion', 'Vaike', 'Stahl', 'Kellam', "Lon'qu", 'Ricken', 'Gaius', 'Gregor', 'Libra', 'Henry', 'Donnel'].map((f) => `Nah ← ${f}`),
    ]);
    expect(engine.groups('morgan-f').every((g) => g.results.length === ASSET_FLAWS)).toBe(true);
    expect(engine.pairings('morgan-f')).toHaveLength((17 + 5 + 13 + 4 + 3 * 12) * ASSET_FLAWS);
  });

  it('marries Morgan (M)’s mother Robin (F) to any man she can S-support, each × 56 asset/flaws', () => {
    const labels = groupLabels('morgan-m');
    const firstGen = labels.filter((l) => !l.includes('←'));
    expect(firstGen).toEqual([
      'Chrom', 'Frederick', 'Virion', 'Stahl', 'Vaike', 'Kellam', 'Donnel', "Lon'qu", 'Ricken', 'Gaius', 'Gregor', 'Libra', 'Henry',
      'Basilio', 'Gangrel', 'Walhart', "Yen'fay", 'Priam',
    ]);
    const sons = new Set(labels.filter((l) => l.includes('←')).map((l) => l.split(' ← ')[0]));
    expect([...sons]).toEqual(['Owain', 'Inigo', 'Brady', 'Gerome', 'Yarne', 'Laurent']);
    // Owain 12, Inigo 13, Brady 13, Gerome 12, Yarne 12, Laurent 12.
    expect(engine.pairings('morgan-m')).toHaveLength((18 + 12 + 13 + 13 + 12 + 12 + 12) * ASSET_FLAWS);
  });

  it('never lets a second-gen parent’s own variable parent be Robin', () => {
    for (const child of ['morgan-m', 'morgan-f'] as const) {
      for (const r of engine.pairings(child)) {
        const vp = r.pairing.variableParent;
        if (vp.kind === 'child') expect(vp.variableParent.kind).toBe('unit');
        expect(r.pairing.fixedRobin?.gender).toBe(child === 'morgan-m' ? 'F' : 'M');
      }
    }
  });

  it('keeps Robin-only units and second-gen parents to Morgan only', () => {
    const robinOnly = ['sayri', 'flavia', 'anna', 'tiki', 'emmeryn', 'aversa', 'basilio', 'gangrel', 'walhart', 'yenfay', 'priam'];
    for (const r of engine.pairings()) {
      if (r.pairing.child === 'morgan-m' || r.pairing.child === 'morgan-f') continue;
      const vp = r.pairing.variableParent;
      expect(vp.kind).not.toBe('child');
      if (vp.kind === 'unit') expect(robinOnly).not.toContain(vp.id);
      expect(r.pairing.fixedRobin).toBeUndefined();
    }
  });

  it('enumerates every pairing with unique keys', () => {
    // 132 non-Robin + 12 children × 56 Robin + Morgan (F) 75 × 56 + Morgan (M) 92 × 56.
    const all = engine.pairings();
    expect(all).toHaveLength(132 + 12 * ASSET_FLAWS + 75 * ASSET_FLAWS + 92 * ASSET_FLAWS);
    expect(new Set(all.map((r) => r.key)).size).toBe(all.length);
  });

  it('builds readable keys and resolves them back', () => {
    expect(engine.result('lucina|robin:spd/def')?.pairing).toEqual({
      child: 'lucina',
      variableParent: { kind: 'robin', gender: 'F', asset: 'spd', flaw: 'def' },
    });
    expect(engine.result('morgan-f|robin:spd/hp|lucina<olivia')?.pairing).toEqual({
      child: 'morgan-f',
      fixedRobin: { kind: 'robin', gender: 'M', asset: 'spd', flaw: 'hp' },
      variableParent: { kind: 'child', id: 'lucina', variableParent: { kind: 'unit', id: 'olivia' } },
    });
    expect(engine.result('morgan-m|robin:str/mag|walhart')).toBeDefined();
  });

  it('names Robin and second-gen parents for the table', () => {
    const lucina = engine.result('lucina|robin:spd/def')!;
    expect(engine.parentName(lucina.pairing.variableParent)).toBe('Robin (F) +Spd −Def');
    expect(engine.robinLabel(lucina.pairing)).toBe('+Spd −Def');
    const morgan = engine.result('morgan-f|robin:spd/hp|lucina<olivia')!;
    expect(engine.parentName(morgan.pairing.variableParent)).toBe('Lucina ← Olivia');
    expect(engine.robinLabel(morgan.pairing)).toBe('+Spd −HP');
    expect(engine.robinLabel(engine.result('lucina|sumia')!.pairing)).toBeUndefined();
  });

  it('groups each child’s rows by variable parent, folding Robin’s 56 asset/flaw pairings into one group', () => {
    const groups = engine.groups('lucina');
    expect(groups.map((g) => [g.label, g.results.length])).toEqual([
      ['Sully', 1], ['Sumia', 1], ['Maribelle', 1], ['Olivia', 1], ['Maiden', 1], ['Robin (F)', ASSET_FLAWS],
    ]);
    expect(groups.flatMap((g) => g.results)).toEqual(engine.pairings('lucina'));
    expect(new Set(engine.groups('morgan-m').map((g) => g.key)).size).toBe(engine.groups('morgan-m').length);
  });

  it('lists every child for the rail with pairing counts and Morgan’s Robin', () => {
    const rail = engine.children();
    expect(rail).toHaveLength(14);
    expect(rail.find((c) => c.id === 'lucina')).toMatchObject({ name: 'Lucina', fixedParentName: 'Chrom', pairingCount: 5 + ASSET_FLAWS });
    expect(rail.find((c) => c.id === 'morgan-f')).toMatchObject({ fixedParentName: 'Robin (M)', pairingCount: 75 * ASSET_FLAWS });
  });

  it('builds everything quickly at startup', () => {
    const t0 = performance.now();
    createEngine().pairings();
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});

describe('Robin and Morgan inheritance', () => {
  it('folds the asset/flaw into Robin: +Spd/−Lck matches SF’s worked example', () => {
    // SF: Robin +Spd/−Lck growths 40/35/30/40/50/50/30/20, modifiers −1/−1/+2/+4/−1/0/0.
    // Kjelle = floor((Sully + Robin + Kjelle) / 3); modifiers = Sully + Robin + 1.
    const r = engine.result('kjelle|robin:spd/lck')!;
    expect(r.growths).toEqual({ hp: 40, str: 35, mag: 25, skl: 40, spd: 45, lck: 55, def: 35, res: 20 });
    expect(r.modifiers).toEqual({ str: -1, mag: -1, skl: 5, spd: 7, lck: 0, def: 0, res: 1 });
  });

  it('gives Morgan no +1 when the other parent is a child, but +1 with a first-gen one', () => {
    // Robin (M) +Spd/−Lck modifiers −1/−1/+2/+4/−1/0/0; Lucina (Chrom × Sully) +1/0/+4/+4/+2/−1/0 (research #2 derived example).
    expect(engine.result('morgan-f|robin:spd/lck|lucina<sully')?.modifiers).toEqual({ str: 0, mag: -1, skl: 6, spd: 8, lck: 1, def: -1, res: 0 });
    expect(engine.result('morgan-f|robin:spd/lck|lucina<sully')?.growths).toEqual({ hp: 39, str: 35, mag: 28, skl: 40, spd: 43, lck: 56, def: 28, res: 22 });
    // Sully −1/−1/+2/+2/0/−1/0 + Robin + 1.
    expect(engine.result('morgan-f|robin:spd/lck|sully')?.modifiers).toEqual({ str: -1, mag: -1, skl: 5, spd: 7, lck: 0, def: 0, res: 1 });
  });
});

describe('inheritance fixtures (published values)', () => {
  it.each(INHERITANCE_FIXTURES)('$id $label', (fx) => {
    const r = engine.result(fx.key);
    expect(r).toBeDefined();
    const totals = Object.fromEntries(
      Object.entries(r!.growths).map(([s, g]) => [s, g + fx.classGrowths[s as keyof typeof fx.classGrowths]]),
    );
    expect(totals).toEqual(fx.expectedGrowths);
    expect(r!.modifiers).toEqual(fx.expectedModifiers);
  });

  it('guards against the SF Maribelle!Lucina Lck typo (+3); the right value is +5', () => {
    expect(engine.result('lucina|maribelle')?.modifiers.lck).toBe(5);
  });
});

describe('assumptions', () => {
  it('flags the Maiden pairing, and Morgan through Lucina ← Maiden, as resting on unknown growths', () => {
    const flagged = engine.pairings().filter((r) => r.assumptionsUsed.length > 0);
    expect(flagged.filter((r) => r.pairing.child !== 'morgan-f').map((r) => r.key)).toEqual(['lucina|maiden']);
    expect(flagged.filter((r) => r.pairing.child === 'morgan-f')).toHaveLength(ASSET_FLAWS);
    expect(flagged.every((r) => r.key === 'lucina|maiden' || r.key.endsWith('|lucina<maiden'))).toBe(true);
    expect(flagged.every((r) => r.assumptionsUsed.join() === 'maiden-growths')).toBe(true);
  });

  it('takes the Maiden’s growths from the assumptions passed in, changing only her pairing', () => {
    const maidenGrowths = { hp: 30, str: 30, mag: 30, skl: 30, spd: 30, lck: 30, def: 30, res: 30 };
    const other = createEngine({ ...DEFAULT_ASSUMPTIONS, 'maiden-growths': maidenGrowths });
    // Lucina 45 + Chrom 40 + Maiden 30 = 115 → 38 Spd.
    expect(other.result('lucina|maiden')?.growths.spd).toBe(38);
    const changed = other.pairings().filter((r) => r.growths.spd !== engine.result(r.key)?.growths.spd);
    expect(changed.every((r) => r.key === 'lucina|maiden' || r.key.endsWith('|lucina<maiden'))).toBe(true);
    expect(changed.map((r) => r.key)).toContain('lucina|maiden');
    expect(changed.some((r) => r.key.endsWith('|lucina<maiden'))).toBe(true);
  });

  it('keeps the Maiden’s published modifiers: Lucina+Maiden = Chrom + 1', () => {
    expect(engine.result('lucina|maiden')?.modifiers).toEqual({ str: 2, mag: 1, skl: 2, spd: 2, lck: 2, def: 0, res: 0 });
  });

  it('clamps modifiers only where an overridden modifier cap binds, and flags exactly those pairings', () => {
    const capped = createEngine(resolveAssumptions({ 'modifier-cap': 5 }));
    // Kjelle × Robin (M) +Spd −Lck: Skl +5, Spd +7 uncapped (SF worked example) → Spd clamps to +5.
    expect(capped.result('kjelle|robin:spd/lck')?.modifiers).toEqual({ str: -1, mag: -1, skl: 5, spd: 5, lck: 0, def: 0, res: 1 });
    expect(capped.result('kjelle|robin:spd/lck')?.assumptionsUsed).toContain('modifier-cap');
    // Severa (Cordelia × Henry) peaks at Skl +5, so the cap doesn't bind.
    expect(capped.result('severa|henry')?.modifiers).toEqual({ str: 3, mag: 1, skl: 5, spd: 3, lck: -2, def: 2, res: -1 });
    expect(capped.result('severa|henry')?.assumptionsUsed).not.toContain('modifier-cap');
    for (const r of capped.pairings()) {
      const before = engine.result(r.key)!;
      const changed = JSON.stringify(r.modifiers) !== JSON.stringify(before.modifiers);
      expect(r.assumptionsUsed.includes('modifier-cap'), r.key).toBe(changed);
      expect(Object.values(r.modifiers).every((m) => Math.abs(m) <= 5)).toBe(true);
    }
  });

  it('by default applies no modifier cap and flags no pairing with it', () => {
    expect(engine.pairings().some((r) => r.assumptionsUsed.includes('modifier-cap'))).toBe(false);
    expect(engine.result('kjelle|robin:spd/lck')?.modifiers.spd).toBe(7);
  });

  it('changes no pairing when the Conqueror growth is overridden (15 → 20), since Conqueror is never inherited', () => {
    const other = createEngine(resolveAssumptions({ 'conqueror-skl-spd-growth': 20 }));
    expect(other.pairings().map((r) => [r.key, r.growths, r.modifiers, r.assumptionsUsed])).toEqual(
      engine.pairings().map((r) => [r.key, r.growths, r.modifiers, r.assumptionsUsed]),
    );
  });
});

describe('assumption overrides', () => {
  it('resolves defaults, applies valid overrides and ignores invalid or unknown ones', () => {
    expect(resolveAssumptions({})).toEqual(DEFAULT_ASSUMPTIONS);
    expect(DEFAULT_ASSUMPTIONS['conqueror-skl-spd-growth']).toBe(15);
    expect(DEFAULT_ASSUMPTIONS['modifier-cap']).toBeNull();
    const resolved = resolveAssumptions({
      'conqueror-skl-spd-growth': 20,
      'modifier-cap': 'lots',
      'maiden-growths': { hp: 10 },
      'no-such-assumption': 3,
    });
    expect(resolved['conqueror-skl-spd-growth']).toBe(20);
    expect(resolved['modifier-cap']).toBeNull();
    expect(resolved['maiden-growths']).toEqual(DEFAULT_ASSUMPTIONS['maiden-growths']);
  });

  it('reports each assumption’s current value against its default, with sources and how many pairings rest on it', () => {
    const status = (e: Engine, id: AssumptionId) => e.assumptions().find((a) => a.id === id)!;
    expect(engine.assumptions().map((a) => a.id)).toEqual([
      'conqueror-skl-spd-growth', 'maiden-growths', 'modifier-cap', 'morgan-second-gen-start-class',
    ]);
    expect(engine.assumptions().every((a) => a.sources.length > 0 && a.why.length > 0)).toBe(true);
    expect(status(engine, 'maiden-growths')).toMatchObject({ isDefault: true, pairingsAffected: 1 + ASSET_FLAWS });
    expect(status(engine, 'conqueror-skl-spd-growth')).toMatchObject({ isDefault: true, current: '15', default: '15', pairingsAffected: 0 });
    const other = createEngine(resolveAssumptions({ 'conqueror-skl-spd-growth': 20 }));
    expect(status(other, 'conqueror-skl-spd-growth')).toMatchObject({ isDefault: false, current: '20', default: '15' });
  });

  it('lists the resolved source disagreements with winning and losing values and links', () => {
    const ds = engine.disagreements();
    expect(ds.map((d) => d.id)).toEqual(expect.arrayContaining(['D1a', 'D2', 'D3', 'D4', 'D5', 'D6', 'maiden-modifiers']));
    const flavia = ds.find((d) => d.id === 'D2')!;
    expect(flavia.winning.value).toBe('+2');
    expect(flavia.losing.map((l) => l.value)).toEqual(['+1']);
    for (const d of ds) {
      for (const s of [...d.winning.sources, ...d.losing.flatMap((l) => l.sources)]) expect(s.url).toMatch(/^https?:\/\//);
    }
  });
});

describe('self-test', () => {
  it('runs every fixture and passes', () => {
    const report = engine.selfTest();
    expect(report.cases.map((c) => c.id)).toEqual(INHERITANCE_FIXTURES.map((f) => f.id));
    expect(report.passed).toBe(true);
    expect(report.cases.every((c) => c.passed && c.mismatches.length === 0)).toBe(true);
  });
});
