import { describe, expect, it } from 'vitest';
import { deployCount, deployMax, foesOf, forcedOn, createEngine, itemByName, leadsByDefault, suggestDeployment, suggestLoadout, type DeployCandidate, type Fighter } from './index';

const engine = createEngine();
const ch3 = engine.maps().find((m) => m.id === 'chapter-3')!;
const foes = foesOf(ch3, 'normal');
const noPool = () => [];
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const w = (name: string) => ({ item: itemByName(name)! });
const cand = (unit: string, s: ReturnType<typeof stats>, weapons: string[], className = 'Cavalier', supports: DeployCandidate['supports'] = []): DeployCandidate => {
  const ws = weapons.map(w);
  const fighter: Fighter = { name: unit, className, stats: s, skills: [], weapon: ws[0] };
  return { unit: unit as never, fighter, weapons: ws, supports };
};
/** An unarmed healer: a staff and nothing to fight with. */
const healer = (unit: string, s: ReturnType<typeof stats>, className = 'Priest'): DeployCandidate => ({
  unit: unit as never,
  fighter: { name: unit, className, stats: s, skills: [], weapon: undefined },
  weapons: [],
  items: [{ item: itemByName('Heal')!, uses: 30 }],
  supports: [],
});

const army = [
  cand('chrom', stats(22, 9, 1, 10, 10, 7, 8, 1), ['Falchion'], 'Lord', [{ partner: 'sumia' as never, rank: 'C' }]),
  cand('frederick', stats(30, 15, 2, 13, 11, 6, 15, 4), ['Silver Lance'], 'Great Knight'),
  cand('sully', stats(22, 9, 1, 10, 10, 6, 8, 2), ['Iron Lance']),
  cand('sumia', stats(19, 7, 3, 12, 12, 8, 6, 7), ['Iron Lance'], 'Pegasus Knight', [{ partner: 'chrom' as never, rank: 'C' }]),
  cand('vaike', stats(25, 10, 0, 8, 6, 4, 6, 0), ['Iron Axe'], 'Fighter'),
  healer('lissa', stats(18, 1, 6, 5, 5, 9, 3, 5)),
  cand('stahl', stats(23, 9, 0, 8, 7, 5, 9, 1), ['Steel Sword']),
];

describe('deployment, pairs and loadouts (#121)', () => {
  it('reads the deploy count at the map’s start from FEW’s text', () => {
    expect(deployMax('1–8+1 (Upon Sumia arriving)+1 (Upon Kellam being recruited)')).toBe(8);
    expect(deployMax('4+2 (Upon Sully and Virion arriving)')).toBe(4);
    expect(deployMax('20')).toBe(20);
    expect(deployMax(ch3.conditions.normal!.deploy)).toBe(8);
  });

  it('deploys forced units first, pairs armed units, and stays within the deploy count', () => {
    const d = suggestDeployment({ candidates: army, forced: ['chrom'], max: 5, foes, pool: noPool });
    expect(d.deployed.length).toBeLessThanOrEqual(5);
    expect(d.deployed[0]).toBe('chrom');
    for (const p of d.pairs) expect(leadsByDefault(army.find((c) => c.unit === p.lead)!)).toBe(true);
    // The healer is never taken as a back: it heals from its own tile.
    expect(d.pairs.some((p) => p.back === 'lissa')).toBe(false);
    expect(d.pairs[0]!.lead).toBe('chrom');
  });

  it('keeps a healer’s slot ahead of the leads: one from six slots, two from twelve (realism pass)', () => {
    const d = suggestDeployment({ candidates: army, forced: ['chrom'], max: 6, foes, pool: noPool });
    expect(d.deployed).toContain('lissa');
    expect(d.deployed).toHaveLength(6);
    // Too few slots to spare one: the fighting comes first.
    expect(suggestDeployment({ candidates: army, forced: ['chrom'], max: 5, foes, pool: noPool }).deployed).not.toContain('lissa');
    const maribelle = healer('maribelle', stats(18, 1, 7, 5, 6, 8, 3, 6), 'Troubadour');
    const more = [...army, maribelle, ...['a', 'b', 'c', 'd', 'e'].map((x) => cand(x, stats(22, 9, 1, 10, 10, 6, 8, 2), ['Iron Lance']))];
    const big = suggestDeployment({ candidates: more, forced: ['chrom'], max: 12, foes, pool: noPool });
    expect(big.deployed).toEqual(expect.arrayContaining(['lissa', 'maribelle']));
  });

  it('never has a unit with nothing to fight with lead a pair, forced or not (realism pass)', () => {
    const unarmed = cand('vaike', stats(25, 10, 0, 8, 6, 4, 6, 0), [], 'Fighter');
    const candidates = [...army.filter((c) => c.unit !== 'vaike'), unarmed];
    for (const max of [4, 6, 8]) {
      const d = suggestDeployment({ candidates, forced: ['chrom', 'vaike'], max, foes, pool: noPool });
      expect(d.deployed).toContain('vaike');
      expect(d.pairs.map((p) => p.lead)).not.toContain('vaike');
    }
  });

  it('keeps the player’s pairs and leaves out units they drop, recomputing the rest', () => {
    const d = suggestDeployment({ candidates: army, forced: ['chrom'], max: 8, foes, pool: noPool, pinned: [{ lead: 'frederick', back: 'lissa' }], excluded: new Set(['vaike' as never]) });
    expect(d.pairs.find((p) => p.lead === 'frederick')!.back).toBe('lissa');
    expect(d.deployed).not.toContain('vaike');
  });
  it('suggests a loadout from the inventory and convoy weapons of a kind it carries', () => {
    const fred = army[1]!;
    const l = suggestLoadout(fred, undefined, [{ item: 'Silver Lance', uses: 20 }, { item: 'Vulnerary', uses: 3 }], [{ item: 'Javelin', uses: 20 }, { item: 'Iron Bow', uses: 45 }], foes, noPool);
    const names = l.items.map((i) => i.item);
    expect(names).toContain('Silver Lance');
    expect(names).not.toContain('Iron Bow');
    expect(names[names.length - 1]).toBe('Vulnerary');
  });
});

describe('the greedy lineup reads no role tag (#212)', () => {
  const olivia = cand('olivia', stats(18, 3, 1, 5, 8, 6, 2, 2), ['Iron Sword'], 'Dancer');

  it('has an armed unit lead, never a Dancer, and never takes a Dancer or an unarmed healer as a back', () => {
    expect(leadsByDefault(army[0]!)).toBe(true);
    expect(leadsByDefault(olivia)).toBe(false);
    expect(leadsByDefault(army[5]!)).toBe(false);
    for (const max of [4, 6, 8, 9]) {
      const d = suggestDeployment({ candidates: [...army, olivia], forced: ['chrom'], max, foes, pool: noPool });
      const inPairs = d.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]);
      expect(inPairs).not.toContain('olivia');
      expect(inPairs).not.toContain('lissa');
    }
  });
});

/** A candidate as a lead, a Dancer or an unarmed healer, for the property tests. */
type Kind = 'armed' | 'dancer' | 'healer';
const as = (c: DeployCandidate, kind: Kind): DeployCandidate =>
  kind === 'armed'
    ? c.weapons.length
      ? c
      : { ...c, weapons: [w('Iron Sword')], fighter: { ...c.fighter, className: 'Myrmidon', weapon: w('Iron Sword') }, items: [] }
    : kind === 'dancer'
      ? { ...c, weapons: c.weapons.length ? c.weapons : [w('Iron Sword')], fighter: { ...c.fighter, className: 'Dancer', weapon: c.fighter.weapon ?? w('Iron Sword') } }
      : healer(c.unit, c.fighter.stats);

describe('deployment with too few leads (#133)', () => {
  const [chrom, frederick, , , , lissa] = army;
  const robin = cand('robin', stats(19, 6, 5, 6, 6, 4, 6, 4), ['Bronze Sword', 'Thunder'], 'Tactician');

  it('deploys all four on the Prologue, with a pair', () => {
    const d = suggestDeployment({ candidates: [chrom!, robin, frederick!, lissa!], forced: ['chrom'], max: 4, foes, pool: noPool });
    expect([...d.deployed].sort()).toEqual(['chrom', 'frederick', 'lissa', 'robin']);
    expect(d.pairs.some((p) => p.back)).toBe(true);
  });

  it('leaves no slot empty while a candidate is undeployed and not dropped, whatever the units are', () => {
    const kinds = ['armed', 'armed', 'healer', 'dancer'] as const;
    for (let seed = 0; seed < 64; seed++) {
      const candidates = army.map((c, i) => as(c, kinds[(seed >> (i % 6)) % 4]!));
      for (const max of [3, 5, 8]) {
        const excluded = new Set(seed % 3 ? [] : ['vaike' as never]);
        const d = suggestDeployment({ candidates, forced: ['chrom'], max, foes, pool: noPool, excluded });
        expect(d.deployed.length).toBe(Math.min(max, candidates.length - excluded.size));
        expect(new Set(d.deployed).size).toBe(d.deployed.length);
        const inPairs = d.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]);
        expect(new Set(inPairs).size).toBe(inPairs.length);
      }
    }
  });

  it('lets the player make a back lead, and drops a pinned back another pin already took', () => {
    const d = suggestDeployment({
      candidates: army,
      forced: ['chrom'],
      max: 8,
      foes,
      pool: noPool,
      pinned: [
        { lead: 'sumia', back: 'chrom' },
        { lead: 'frederick', back: 'chrom' },
      ],
    });
    expect(d.pairs.find((p) => p.lead === 'sumia')!.back).toBe('chrom');
    expect(d.pairs.find((p) => p.lead === 'frederick')!.back).not.toBe('chrom');
    expect(d.pairs.filter((p) => p.lead === 'chrom' || p.back === 'chrom')).toHaveLength(1);
  });
});

describe('forced units on the preparation page (#132)', () => {
  it('reads a map’s forced units as roster units', () => {
    expect(forcedOn('chapter-1')).toEqual(['chrom']);
    expect(forcedOn('chapter-23')).toEqual(['chrom', 'robin']);
    expect(forcedOn('prologue')).toEqual([]);
  });

  it('deploys Robin on Chapter 23 whatever Robin is, even with one slot to spare', () => {
    const robin = cand('robin', stats(40, 20, 20, 20, 20, 20, 20, 20), ['Levin Sword'], 'Grandmaster');
    for (const kind of ['armed', 'dancer', 'healer'] as const) {
      const d = suggestDeployment({ candidates: [...army, as(robin, kind)], forced: forcedOn('chapter-23'), max: 2, foes, pool: noPool });
      expect(d.deployed, kind).toEqual(expect.arrayContaining(['chrom', 'robin']));
    }
  });
});

describe('review fixes (#131–#133 review)', () => {
  it('adds the slots a map gives for recruits on it from turn 1, and only those', () => {
    const count = (map: string, opening: string[]) => deployCount(engine.maps().find((m) => m.id === map)!.conditions.normal!.deploy, opening);
    expect(count('chapter-3', ['Sumia'])).toBe(9);
    expect(count('chapter-5', ['Ricken', 'Maribelle'])).toBe(11);
    expect(count('chapter-2', ['Stahl', 'Vaike'])).toBe(8);
    expect(count('prologue', ['Chrom', 'Robin', 'Lissa', 'Frederick'])).toBe(4);
  });

  it('never drops a forced unit, even when the player tries to', () => {
    const d = suggestDeployment({ candidates: army, forced: ['chrom', 'lissa'], max: 3, foes, pool: noPool, excluded: new Set(['chrom', 'lissa'] as never[]) });
    expect(d.deployed).toEqual(expect.arrayContaining(['chrom', 'lissa']));
    expect(d.forced).toEqual(['chrom', 'lissa']);
  });

  it('pairs a unit left over with one already deployed alone when only one slot is left', () => {
    const [chrom, , , sumia] = army;
    const d = suggestDeployment({ candidates: [chrom!, sumia!], forced: ['chrom'], max: 2, foes, pool: noPool });
    expect(d.deployed).toHaveLength(2);
    expect(d.pairs.filter((p) => p.back)).toHaveLength(1);
  });
});
