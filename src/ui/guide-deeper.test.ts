import { describe, expect, it } from 'vitest';
import type { ChildId } from '../engine';
import { DEEPER, deeperEntry, deeperView, guideChild, type DeeperId } from './guide-deeper';
import { JOURNEYS } from './guide-journeys';

describe('Going deeper', () => {
  it('asks its eighteen questions in order', () => {
    expect(DEEPER.map((e) => e.question)).toEqual([
      'Who’s strongest overall?',
      'Why this spouse for this child?',
      'What does this pairing build?',
      'Which Robin does this child want?',
      'Which preset suits this child?',
      'Can I change how children are scored?',
      'What does ⚠ mean?',
      'What can this unit become?',
      'Who should this unit marry?',
      'What does Robin’s page show before Robin is set?',
      'What’s true of this child whoever its parents are?',
      'What do the experts say about this unit?',
      'What am I facing on this map?',
      'How do I record my run?',
      'What do I do after clearing a map?',
      'Can my units handle the next map?',
      'What should I watch out for on this map?',
      'Who should I deploy, paired with whom?',
    ]);
  });

  it('jumps each entry to its view and control', () => {
    expect(DEEPER.map((e) => [e.jump?.to, e.jump?.target])).toEqual([
      ['leaderboard', 'leaderboard'],
      ['child', 'score-with-plan-preset'],
      ['child', 'skills-drawer'],
      ['child', 'robin-heatmap'],
      ['child', 'scoring-preset'],
      ['scoring', 'scoring-basis'],
      ['validation', 'validation'],
      ['unit', 'unit-class-tree'],
      ['unit', 'unit-partners'],
      ['robin', 'robin-preview'],
      ['door', 'front-door-pairings'],
      ['unit', 'unit-opinion'],
      ['map', 'map-data'],
      ['log', 'chapter-log'],
      ['log', 'next-map'],
      ['log', 'prepare'],
      ['log', 'prepare'],
      ['log', 'prepare'],
    ]);
    expect(deeperEntry('robin').jump).toMatchObject({ robinRow: true });
  });

  it('answers Why this spouse? in three steps', () => {
    const steps = deeperView(deeperEntry('why-spouse'), false).answer;
    expect(steps).toHaveLength(3);
    expect(steps[1]).toContain('→ score with this');
    expect(steps[2]).toContain('◆');
  });

  it('has nothing to choose, and no jump, once Robin is locked', () => {
    const robin = deeperEntry('robin');
    expect(deeperView(robin, false).jump).toEqual(robin.jump);
    expect(deeperView(robin, true)).toEqual({ answer: ['Robin is locked, so there’s nothing left to choose.'], jump: undefined });
    const other = deeperEntry('strongest');
    expect(deeperView(other, true).jump).toEqual(other.jump);
  });

  it('defines the drill-down words in its Terms folds', () => {
    const terms = DEEPER.flatMap((e) => e.terms.map((t) => t.term));
    for (const word of ['pairing', 'variable parent', 'blocked pairing', '◆', 'build template', 'coverage', 'score basis', 'effective cap', 'target breakpoint', 'speed margin', 'Mixed', 'weights'])
      expect(terms.join(' | ')).toContain(word);
    expect(terms.some((t) => t.includes('plan preset') && t.includes('sidebar preset'))).toBe(true);
  });
});

describe('journey steps link into Going deeper', () => {
  const links = (journey: keyof typeof JOURNEYS) =>
    JOURNEYS[journey].steps.flatMap((s, i): [number, DeeperId[]][] => (s.deeper ? [[i + 1, [...s.deeper]]] : []));

  it('from Fresh run steps 6, 9 and 13', () => {
    expect(links('fresh')).toEqual([
      [6, ['why-spouse', 'pairing-build']],
      [9, ['preset']],
      [13, ['robin']],
    ]);
  });

  it('from the After a loss ledger step', () => {
    expect(links('loss')).toEqual([[3, ['why-spouse']]]);
    expect(JOURNEYS.loss.steps[2]!.target).toBe('children-ledger');
  });
});

describe('the child a table jump shows', () => {
  const order: ChildId[] = ['lucina', 'owain', 'inigo', 'brady'];

  it('is the last child opened', () => {
    expect(guideChild('inigo', { brady: 3 }, order)).toBe('inigo');
  });

  it('else the plan’s top-priority child, the first on a tie', () => {
    expect(guideChild(undefined, { brady: 3, owain: 3 }, order)).toBe('owain');
    expect(guideChild(undefined, { lucina: 0 }, order)).toBe('owain');
    expect(guideChild(undefined, {}, order)).toBe('lucina');
  });

  it('skips a last-opened child that isn’t in this run', () => {
    expect(guideChild('morgan-m', {}, order)).toBe('lucina');
  });
});
