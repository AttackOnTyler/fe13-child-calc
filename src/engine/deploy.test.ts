import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, EMPTY_ROSTER, deployCount, deployMax, deployRoleOf, foesOf, forcedOn, createEngine, itemByName, quotasFor, suggestDeployment, suggestLoadout, withRun, type DeployCandidate, type Fighter, type PlanSettings } from './index';

const engine = createEngine();
const ch3 = engine.maps().find((m) => m.id === 'chapter-3')!;
const foes = foesOf(ch3, 'normal');
const noPool = () => [];
const stats = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number) => ({ hp, str, mag, skl, spd, lck, def, res });
const w = (name: string) => ({ item: itemByName(name)! });
const cand = (unit: string, role: DeployCandidate['role'], s: ReturnType<typeof stats>, weapons: string[], className = 'Cavalier', supports: DeployCandidate['supports'] = []): DeployCandidate => {
  const ws = weapons.map(w);
  const fighter: Fighter = { name: unit, className, stats: s, skills: [], weapon: ws[0] };
  return { unit: unit as never, role, fighter, weapons: ws, supports };
};

const army = [
  cand('chrom', 'lead', stats(22, 9, 1, 10, 10, 7, 8, 1), ['Falchion'], 'Lord', [{ partner: 'sumia' as never, rank: 'C' }]),
  cand('frederick', 'lead', stats(30, 15, 2, 13, 11, 6, 15, 4), ['Silver Lance'], 'Great Knight'),
  cand('sully', 'lead', stats(22, 9, 1, 10, 10, 6, 8, 2), ['Iron Lance']),
  cand('sumia', 'battery', stats(19, 7, 3, 12, 12, 8, 6, 7), ['Iron Lance'], 'Pegasus Knight', [{ partner: 'chrom' as never, rank: 'C' }]),
  cand('vaike', 'battery', stats(25, 10, 0, 8, 6, 4, 6, 0), ['Iron Axe'], 'Fighter'),
  cand('lissa', 'staff', stats(18, 1, 6, 5, 5, 9, 3, 5), ['Heal'], 'Priest'),
  cand('stahl', 'lead', stats(23, 9, 0, 8, 7, 5, 9, 1), ['Steel Sword']),
];

describe('deployment, pairs and loadouts (#121)', () => {
  it('reads the deploy count at the map’s start from FEW’s text', () => {
    expect(deployMax('1–8+1 (Upon Sumia arriving)+1 (Upon Kellam being recruited)')).toBe(8);
    expect(deployMax('4+2 (Upon Sully and Virion arriving)')).toBe(4);
    expect(deployMax('20')).toBe(20);
    expect(deployMax(ch3.conditions.normal!.deploy)).toBe(8);
  });

  it('deploys forced units first, pairs leads with batteries, and stays within the deploy count', () => {
    const d = suggestDeployment({ candidates: army, forced: ['chrom'], max: 5, foes, pool: noPool });
    expect(d.deployed.length).toBeLessThanOrEqual(5);
    expect(d.deployed[0]).toBe('chrom');
    for (const p of d.pairs) expect(army.find((c) => c.unit === p.lead)!.role).toBe('lead');
    const backs = d.pairs.flatMap((p) => (p.back ? [p.back] : []));
    expect(backs.every((b) => ['sumia', 'vaike'].includes(b))).toBe(true);
    expect(d.pairs[0]!.lead).toBe('chrom');
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

describe('deployment with too few leads (#133)', () => {
  const [chrom, frederick, , , , lissa] = army;
  const robin = cand('robin', 'battery', stats(19, 6, 5, 6, 6, 4, 6, 4), ['Bronze Sword', 'Thunder'], 'Tactician');
  const as = (c: DeployCandidate, role: DeployCandidate['role']): DeployCandidate => ({ ...c, role });
  const prologue = (roles: Record<'chrom' | 'robin' | 'frederick', DeployCandidate['role']>) => [as(chrom!, roles.chrom), as(robin, roles.robin), as(frederick!, roles.frederick), lissa!];

  it('deploys all four on the Prologue with no Lead, with a pair', () => {
    const d = suggestDeployment({ candidates: prologue({ chrom: 'battery', robin: 'battery', frederick: 'battery' }), forced: ['chrom'], max: 4, foes, pool: noPool });
    expect([...d.deployed].sort()).toEqual(['chrom', 'frederick', 'lissa', 'robin']);
    expect(d.pairs.some((p) => p.back)).toBe(true);
  });

  it('deploys a spare Battery once the only Lead has its back', () => {
    const d = suggestDeployment({ candidates: prologue({ chrom: 'battery', robin: 'lead', frederick: 'battery' }), forced: ['chrom'], max: 4, foes, pool: noPool });
    expect([...d.deployed].sort()).toEqual(['chrom', 'frederick', 'lissa', 'robin']);
  });

  it('leaves no slot empty while a candidate is undeployed and not dropped, whatever the roles', () => {
    const roles = ['lead', 'battery', 'staff', 'dancer'] as const;
    for (let seed = 0; seed < 64; seed++) {
      const candidates = army.map((c, i) => as(c, roles[(seed >> (i % 6)) % 4]!));
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

describe('roles for the solver come from derived roles and army fit', () => {
  it('uses army fit for children and the roster’s tag for first-gen units', () => {
    const settings = { context: 'all', preset: 'physical-lead', edits: {}, basis: 'caps-lb', dlc: false, speed: DEFAULT_SPEED, supportRank: 'A', priorities: {}, overrides: {}, roleOverrides: {}, quotas: quotasFor('all') } as PlanSettings;
    const roster = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'str' });
    const roles = engine.roles(roster, settings);
    for (const [child, a] of roles) expect(deployRoleOf(child, roster, roles)).toBe(a.role);
    expect(deployRoleOf('lissa', roster, roles)).toBe('staff');
    expect(deployRoleOf('chrom', roster, roles)).toBe('lead');
  });
});

describe('forced units on the preparation page (#132)', () => {
  it('reads a map’s forced units as roster units', () => {
    expect(forcedOn('chapter-1')).toEqual(['chrom']);
    expect(forcedOn('chapter-23')).toEqual(['chrom', 'robin']);
    expect(forcedOn('prologue')).toEqual([]);
  });

  it('deploys Robin on Chapter 23 whatever Robin’s role, even with one slot to spare', () => {
    const robin = (role: DeployCandidate['role']) => cand('robin', role, stats(40, 20, 20, 20, 20, 20, 20, 20), ['Levin Sword'], 'Grandmaster');
    for (const role of ['lead', 'battery', 'staff', 'dancer'] as const) {
      const d = suggestDeployment({ candidates: [...army, robin(role)], forced: forcedOn('chapter-23'), max: 2, foes, pool: noPool });
      expect(d.deployed, role).toEqual(expect.arrayContaining(['chrom', 'robin']));
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
    const d = suggestDeployment({ candidates: [{ ...chrom!, role: 'battery' }, sumia!], forced: ['chrom'], max: 2, foes, pool: noPool });
    expect(d.deployed).toHaveLength(2);
    expect(d.pairs.filter((p) => p.back)).toHaveLength(1);
  });
});
