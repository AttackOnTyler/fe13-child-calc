import { describe, expect, it } from 'vitest';
import { createEngine, resolveAssumptions, type ChildResult } from './index';

const engine = createEngine();

const get = (key: string): ChildResult => {
  const r = engine.result(key);
  if (!r) throw new Error(`No pairing ${key}`);
  return r;
};
const fromFixed = (key: string) => get(key).skillCandidates.fromFixed;
const fromVariable = (key: string) => get(key).skillCandidates.fromVariable;

// research/skill-inheritance (#4) §1–2.
describe('inheritable-skill candidates', () => {
  it('fixes Aether from Chrom for Lucina, whoever her mother is', () => {
    for (const r of engine.pairings('lucina')) expect(r.skillCandidates.fromFixed, r.key).toEqual({ skills: ['aether'], fixed: true });
  });

  it('fixes Aether for Chrom’s other daughters and Rightful King for his sons', () => {
    expect(fromVariable('cynthia|chrom')).toEqual({ skills: ['aether'], fixed: true });
    expect(fromVariable('kjelle|chrom')).toEqual({ skills: ['aether'], fixed: true });
    expect(fromVariable('inigo|chrom')).toEqual({ skills: ['rightful-king'], fixed: true });
    expect(fromVariable('brady|chrom')).toEqual({ skills: ['rightful-king'], fixed: true });
  });

  it('lets a parent pass any inheritable skill from its class set and promotions', () => {
    const sumia = fromVariable('lucina|sumia');
    expect(sumia.fixed).toBe(false);
    // Pegasus Knight → Dark Flier, Knight → Great Knight, Priest → War Cleric.
    expect(sumia.skills).toEqual(expect.arrayContaining(['galeforce', 'luna', 'pavise', 'renewal', 'speed-plus-2', 'miracle']));
    expect(sumia.skills).not.toContain('bowfaire');
  });

  it('passes Luck +4 from Olivia but never Special Dance', () => {
    expect(fromVariable('lucina|olivia').skills).toContain('luck-plus-4');
    for (const r of engine.pairings()) {
      for (const c of [r.skillCandidates.fromFixed, r.skillCandidates.fromVariable]) expect(c.skills, r.key).not.toContain('special-dance');
    }
  });

  it('never passes a DLC skill', () => {
    const dlcSkills = ['limit-breaker', 'aggressor', 'resistance-plus-10', 'rally-heart', 'bond', 'all-stats-plus-2', 'paragon', 'iotes-shield'];
    // One expect for every pairing is too slow: collect the offenders.
    const passing = engine.pairings().flatMap((r) =>
      [...r.skillCandidates.fromFixed.skills, ...r.skillCandidates.fromVariable.skills].filter((s) => dlcSkills.includes(s)).map((s) => `${r.key}: ${s}`),
    );
    expect(passing).toEqual([]);
  });

  it('gives the Maiden nothing to pass', () => {
    expect(fromVariable('lucina|maiden')).toEqual({ skills: [], fixed: false });
  });

  it('lets Robin pass every regular class skill for Robin’s gender', () => {
    const robinF = fromVariable('lucina|robin:spd/def').skills;
    expect(robinF).toEqual(expect.arrayContaining(['ignis', 'rally-spectrum', 'galeforce', 'dual-support-plus']));
    expect(robinF).not.toContain('counter'); // Warrior is male-only
    const robinM = fromVariable('kjelle|robin:spd/def').skills;
    expect(robinM).toEqual(expect.arrayContaining(['ignis', 'counter', 'wrath']));
    expect(robinM).not.toContain('galeforce');
  });

  it('passes Morgan Robin’s own pool from the fixed side', () => {
    expect(fromFixed('morgan-m|robin:spd/def|frederick').skills).toEqual(expect.arrayContaining(['ignis', 'rally-spectrum', 'galeforce']));
  });

  it('fixes Aversa’s Shadowgift and Walhart’s Conquest for Morgan', () => {
    expect(fromVariable('morgan-f|robin:spd/def|aversa')).toEqual({ skills: ['shadowgift'], fixed: true });
    expect(fromVariable('morgan-m|robin:spd/def|walhart')).toEqual({ skills: ['conquest'], fixed: true });
  });

  it('fixes Aether from Lucina or a Chrom-fathered daughter and Rightful King from a Chrom-fathered son, as Morgan’s parent', () => {
    expect(fromVariable('morgan-f|robin:spd/def|lucina<sumia')).toEqual({ skills: ['aether'], fixed: true });
    expect(fromVariable('morgan-f|robin:spd/def|cynthia<chrom')).toEqual({ skills: ['aether'], fixed: true });
    expect(fromVariable('morgan-m|robin:spd/def|inigo<chrom')).toEqual({ skills: ['rightful-king'], fixed: true });
  });

  it('lets any other second-gen parent pass what it learns or inherited itself', () => {
    // Owain fathered by Vaike: his classes (Myrmidon, Priest, Barbarian, Fighter, Thief) plus Lissa’s and Vaike’s picks.
    const owain = fromVariable('morgan-m|robin:spd/def|owain<vaike');
    expect(owain.fixed).toBe(false);
    expect(owain.skills).toEqual(expect.arrayContaining(['astra', 'counter', 'lethality']));
    // Galeforce comes only through Lissa (Pegasus Knight → Dark Flier), whom Owain can inherit from.
    expect(owain.skills).toContain('galeforce');
  });
});

describe('skill-inheritance edge cases', () => {
  it('are in the assumptions registry', () => {
    for (const id of ['inherit-duplicate-skill', 'inherit-same-skill', 'inherit-ineligible-bottom', 'inherit-last-skill'] as const) {
      const status = engine.assumptions().find((a) => a.id === id);
      expect(status?.affects, id).toBeTruthy();
    }
  });

  it('reword the drawer notes when overridden, without touching any pairing', () => {
    const other = createEngine(resolveAssumptions({ 'inherit-last-skill': 'most-recent', 'inherit-duplicate-skill': 'next-skill' }));
    const settings = { context: 'all', dlc: false } as const;
    const before = engine.skillView(get('nah|lonqu'), settings);
    const after = other.skillView(other.result('nah|lonqu')!, settings);
    expect(before.parents[1].note).toContain('lowest equipped');
    expect(after.parents[1].note).toContain('most recently');
    expect(before.caveats.join()).toContain('nothing new');
    expect(after.caveats.join()).toContain('next skill up');
    expect(other.pairings()).toEqual(engine.pairings());
  });
});

describe('the Skills drawer', () => {
  const view = engine.skillView(get('lucina|sumia'), { context: 'all', dlc: false });

  it('heads with the start class and class count', () => {
    expect(view.child).toBe('Lucina');
    expect(view.fixedParent).toBe('Chrom');
    expect(view.variableParent).toBe('Sumia');
    expect(view.startClass).toBe('Lord');
    expect(view.classCount).toBe(6);
  });

  it('shows the ten rallies with a source or the reason one is missing', () => {
    const by = new Map(view.rallies.map((r) => [r.skill.id, r]));
    expect(view.rallies).toHaveLength(10);
    expect(by.get('rally-speed')!.sources[0]).toMatchObject({ kind: 'class', class: 'falcon-knight', level: 5, reclass: true });
    expect(by.get('rally-strength')!.sources).toEqual([]);
    expect(by.get('rally-strength')!.reason).toMatch(/Warrior is male-only/);
    expect(by.get('rally-spectrum')!.reason).toMatch(/Grandmaster isn’t reachable/);
    expect(by.get('rally-heart')!.reason).toMatch(/DLC/);
    const covered = view.rallies.filter((r) => r.sources.length).map((r) => r.skill.id);
    expect(covered.sort()).toEqual(['rally-defence', 'rally-luck', 'rally-magic', 'rally-movement', 'rally-skill', 'rally-speed']);
  });

  it('reaches Rally Heart through Bride once DLC is on', () => {
    const dlc = engine.skillView(get('lucina|sumia'), { context: 'all', dlc: true });
    expect(dlc.rallies.find((r) => r.skill.id === 'rally-heart')!.sources[0]).toMatchObject({ kind: 'class', class: 'bride', dlc: true });
  });

  it('gets a rally from a parent when no class of the child teaches it', () => {
    const kjelle = engine.skillView(get('kjelle|robin:spd/def'), { context: 'all', dlc: false });
    const strength = kjelle.rallies.find((r) => r.skill.id === 'rally-strength')!;
    expect(strength.sources).toEqual([{ kind: 'parent', side: 'variable', parent: 'Robin (M) +Spd −Def', fixed: false }]);
  });

  it('lists what each parent can pass, outlining what only that parent gives', () => {
    const [chrom, sumia] = view.parents;
    expect(chrom).toMatchObject({ parent: 'Chrom', fixed: true });
    expect(chrom.skills.map((s) => s.id)).toEqual(['aether']);
    // Lucina learns Aether as a Great Lord anyway, and Sumia’s classes all pass to her.
    expect(chrom.skills[0]!.unique).toBe(false);
    expect(sumia.skills.some((s) => s.unique)).toBe(false);

    // Dancer never passes as a class, so Olivia’s Luck +4 comes only from her.
    const olivia = engine.skillView(get('lucina|olivia'), { context: 'all', dlc: false }).parents[1];
    expect(olivia.skills.filter((s) => s.unique).map((s) => s.id)).toEqual(['luck-plus-4']);
    // Robin (F) passes Lucina every regular class, so nothing Robin can pass is Robin’s alone.
    const robin = engine.skillView(get('lucina|robin:spd/def'), { context: 'all', dlc: false }).parents[1];
    expect(robin.skills.some((s) => s.unique)).toBe(false);
  });

  it('buckets class skills by rank, S first, each with class, level and reclass marker', () => {
    expect(view.ranks.map((b) => b.letter)).toEqual(['S', 'A', 'B', 'C', 'D', '–']);
    const s = view.ranks[0]!.skills.map((k) => k.id);
    expect(s).toEqual(['aether', 'galeforce']);
    const aether = view.ranks[0]!.skills[0]!;
    // Great Lord is in Lucina’s starting line, so no reclass; Chrom’s fixed inheritance ranks first.
    expect(aether.sources[0]).toMatchObject({ kind: 'parent', fixed: true });
    expect(aether.sources[1]).toMatchObject({ kind: 'class', class: 'great-lord', level: 5, reclass: false });
  });

  it('lists the DLC skill books only when DLC is reachable', () => {
    expect(view.books).toEqual([]);
    const dlc = engine.skillView(get('lucina|sumia'), { context: 'all', dlc: true });
    expect(dlc.books.map((b) => b.id)).toEqual(['all-stats-plus-2', 'paragon', 'iotes-shield', 'limit-breaker']);
  });

  it('ranks by play context', () => {
    expect(engine.skillRank('sol', 'apotheosis')).toBe(1);
    expect(engine.skillRank('sol', 'main-story')).toBe(5);
    expect(engine.skillRank('sol', 'all')).toBe(3);
    expect(engine.skillRank('veteran', 'all')).toBe(0);
  });
});
