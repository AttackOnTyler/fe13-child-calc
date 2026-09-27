import { describe, expect, it } from 'vitest';
import { createEngine, fixedPass, resolveAssumptions } from './index';

/** The skills a child joins with (#187; research/child-recruitment §3, §4.3). */
const engine = createEngine();
const chrom = { skills: ['Dual Strike+', 'Charm', 'Aether'], fixed: fixedPass('chrom', 'F') };

describe('the skills a child joins with (#187)', () => {
  it('gives Lucina her class’s Lv 1 and Lv 10 skills, Chrom’s Aether and her mother’s bottom skill', () => {
    const r = engine.childSkills({ child: 'lucina', parents: [chrom, { skills: ['Speed +2', 'Galeforce', 'Relief'] }] });
    expect(r.skills).toEqual(['Dual Strike+', 'Charm', 'Aether', 'Relief']);
    expect(r.passed).toEqual(['Aether', 'Relief']);
  });

  it('passes Chrom’s fixed skill by the child’s gender, learned or not, and nothing from the Maiden', () => {
    expect(fixedPass('chrom', 'M')).toBe('rightful-king');
    expect(fixedPass('walhart', 'F')).toBe('conquest');
    expect(fixedPass('sumia', 'F')).toBeUndefined();
    // A Chrom child parenting Morgan passes Chrom's skill for its own gender.
    expect(fixedPass('lucina', 'M', true)).toBe('aether');
    const r = engine.childSkills({ child: 'lucina', parents: [{ skills: [], fixed: fixedPass('chrom', 'F') }, 'maiden'] });
    expect(r.passed).toEqual(['Aether', null]);
  });

  it('skips Special Dance and DLC skills at the bottom for the next eligible skill up', () => {
    const olivia = { skills: ['Luna', 'Special Dance', 'Limit Breaker'] };
    expect(engine.childSkills({ child: 'inigo', parents: [olivia, { skills: ['Vantage'] }] }).passed).toEqual(['Luna', 'Vantage']);
    // The alternative reading: an ineligible bottom skill passes nothing.
    const strict = createEngine(resolveAssumptions({ 'inherit-ineligible-bottom': 'nothing' }));
    expect(strict.childSkills({ child: 'inigo', parents: [olivia, { skills: ['Vantage'] }] }).passed).toEqual([null, 'Vantage']);
  });

  it('passes the other parent’s next skill up when both would pass the same one', () => {
    const sully = { skills: ['Luna', 'Galeforce'] };
    const stahl = { skills: ['Sol', 'Galeforce'] };
    const r = engine.childSkills({ child: 'kjelle', parents: [sully, stahl] });
    expect(r.passed).toEqual(['Galeforce', 'Sol']);
    expect(r.skills).toEqual(['Defence +2', 'Indoor Fighter', 'Galeforce', 'Sol']);
    // Under the one-copy alternative the second inheritance is lost.
    const oneCopy = createEngine(resolveAssumptions({ 'inherit-same-skill': 'one-copy' }));
    expect(oneCopy.childSkills({ child: 'kjelle', parents: [sully, stahl] }).passed).toEqual(['Galeforce', null]);
  });

  it('wastes a passed skill the child already starts with', () => {
    // Nah starts a Manakete with Odd Rhythm (its Lv 15 skill isn't learned at Lv 10).
    const r = engine.childSkills({ child: 'nah', parents: [{ skills: ['Wyrmsbane', 'Odd Rhythm'] }, { skills: ['Vantage'] }] });
    expect(r.skills).toEqual(['Odd Rhythm', 'Vantage']);
    expect(r.passed).toEqual([null, 'Vantage']);
    const next = createEngine(resolveAssumptions({ 'inherit-duplicate-skill': 'next-skill' }));
    expect(next.childSkills({ child: 'nah', parents: [{ skills: ['Wyrmsbane', 'Odd Rhythm'] }, { skills: ['Vantage'] }] }).passed).toEqual(['Wyrmsbane', 'Vantage']);
  });
});
