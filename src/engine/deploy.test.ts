import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, EMPTY_ROSTER, deployMax, deployRoleOf, foesOf, createEngine, itemByName, quotasFor, suggestDeployment, suggestLoadout, withRun, type DeployCandidate, type Fighter, type PlanSettings } from './index';

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
