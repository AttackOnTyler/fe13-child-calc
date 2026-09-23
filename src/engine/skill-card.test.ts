import { describe, expect, it } from 'vitest';
import { BUILD_TEMPLATES, type BuildTemplate } from '../curated/builds';
import { templateConflicts } from './builds';
import { createEngine, type ChildResult } from './index';

const engine = createEngine();

const get = (key: string): ChildResult => {
  const r = engine.result(key);
  if (!r) throw new Error(`No pairing ${key}`);
  return r;
};
const MAIN = { context: 'main-story', dlc: false } as const;

describe('the Skill card', () => {
  // Lucina × Sumia: Lord / Cavalier / Archer plus Sumia's Pegasus Knight / Knight / Cleric.
  const lucina = get('lucina|sumia');

  it('gives the description, activation rate and rank per play context with the current one marked', () => {
    const card = engine.skillCard(lucina, 'luna', MAIN);
    expect(card).toMatchObject({ id: 'luna', name: 'Luna', description: 'Ignores half the enemy’s Def or Res.', rate: 'Skl %', rally: false });
    expect(card.ranks).toEqual([
      { context: 'apotheosis', rank: 5, letter: 'S', current: false },
      { context: 'main-story', rank: 4, letter: 'A', current: true },
      { context: 'full-route', rank: 4, letter: 'A', current: false },
      { context: 'all', rank: 4, letter: 'A', current: false },
    ]);
  });

  it('lists every way the pairing gets it: Great Knight by reclass, or Sumia’s pick', () => {
    const card = engine.skillCard(lucina, 'luna', MAIN);
    expect(card.reason).toBeUndefined();
    expect(card.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'class', class: 'great-knight', reclass: true }),
        { kind: 'parent', side: 'variable', parent: 'Sumia', fixed: false },
      ]),
    );
  });

  it('puts Chrom’s fixed Aether first', () => {
    expect(engine.skillCard(lucina, 'aether', MAIN).sources[0]).toEqual({ kind: 'parent', side: 'fixed', parent: 'Chrom', fixed: true });
  });

  it('says why an unreachable skill is out of reach', () => {
    const card = engine.skillCard(lucina, 'counter', MAIN);
    expect(card.sources).toEqual([]);
    expect(card.reason).toBe('Warrior is male-only, and neither parent can pass it');
  });

  it('says whether the skill can ever be inherited', () => {
    expect(engine.skillCard(lucina, 'luna', MAIN).inheritance).toEqual({ inheritable: true, note: expect.stringMatching(/last equipped/) });
    expect(engine.skillCard(lucina, 'limit-breaker', MAIN).inheritance).toEqual({ inheritable: false, note: 'Never inherited: DLC skills don’t pass.' });
    expect(engine.skillCard(lucina, 'special-dance', MAIN).inheritance.inheritable).toBe(false);
    expect(engine.skillCard(lucina, 'shadowgift', MAIN).inheritance).toEqual({
      inheritable: false,
      note: 'Only by fixed inheritance: Aversa always passes it to Morgan.',
    });
  });

  it('checks each synergy partner’s reachability, with the edge’s reason', () => {
    const card = engine.skillCard(lucina, 'luna', MAIN);
    const galeforce = card.synergies.find((e) => e.skill.id === 'galeforce')!;
    expect(galeforce).toMatchObject({ reachable: true, note: expect.stringMatching(/Galeforce/) });
    // Astra is Swordmaster's; neither Lucina's classes nor Sumia's give Myrmidon.
    const astra = card.synergies.find((e) => e.skill.id === 'astra')!;
    expect(astra).toMatchObject({ reachable: false, reason: 'Swordmaster isn’t reachable for Lucina, and neither parent can pass it' });
  });

  it('lists conflicts both ways round', () => {
    const partners = (id: 'vengeance' | 'luna') => engine.skillCard(lucina, id, MAIN).conflicts.map((e) => e.skill.id);
    expect(partners('vengeance')).toContain('luna');
    expect(partners('luna')).toContain('vengeance');
    expect(partners('luna')).toContain('sol');
  });

  it('flags a partner that only the same parent can give, since each parent passes one skill', () => {
    // Kjelle can't be a Barbarian or Berserker, so Wrath and Gamble both hang on Vaike's one pick.
    const card = engine.skillCard(get('kjelle|vaike'), 'wrath', MAIN);
    expect(card.synergies.find((e) => e.skill.id === 'gamble')).toMatchObject({ reachable: true, oneParent: 'Vaike' });
    expect(engine.skillCard(lucina, 'luna', MAIN).synergies.every((e) => e.oneParent === undefined)).toBe(true);
  });

  it('lists this pairing’s builds that use it, with tier and slot', () => {
    const card = engine.skillCard(lucina, 'luna', MAIN);
    expect(card.builds).toContainEqual({ id: 'B01', name: 'Galeforce proc archer', tier: 5, slot: 3 });
    // Pavise/Aegis tank takes Luna in slot 4, its proc-or-breaker slot.
    expect(card.builds).toContainEqual(expect.objectContaining({ id: 'B12', slot: 4 }));
    // Counter is unreachable, so no build uses it.
    expect(engine.skillCard(lucina, 'counter', MAIN).builds).toEqual([]);
  });
});

describe('the template lint', () => {
  const template = (slots: BuildTemplate['slots']): BuildTemplate => ({
    id: 'X',
    name: 'Test',
    role: 'physical-lead',
    contexts: ['apotheosis'],
    slots,
    source: 'test',
    confidence: 'Single',
  });

  it('finds two skills joined by a conflict edge in different slots', () => {
    const t = template([['galeforce'], ['luna'], ['vengeance'], ['bowfaire'], ['limit-breaker']]);
    expect(templateConflicts(t)).toEqual([expect.objectContaining({ a: 'vengeance', b: 'luna' })]);
  });

  it('lets conflicting skills be alternatives in one slot', () => {
    expect(templateConflicts(template([['galeforce'], ['luna', 'vengeance'], ['bowfaire'], ['aggressor'], ['limit-breaker']]))).toEqual([]);
  });

  it('passes on every curated template', () => {
    for (const t of BUILD_TEMPLATES) expect(templateConflicts(t), t.id).toEqual([]);
  });
});
