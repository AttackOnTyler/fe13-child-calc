import { describe, expect, it } from 'vitest';
import type { ChildId } from '../engine';
import { DEEPER, deeperEntry, deeperView, guideChild, type DeeperId } from './guide-deeper';
import { JOURNEYS } from './guide-journeys';
import { EXPLORER_NOTE, OPINION_NOTE } from './labels';

describe('Going deeper', () => {
  it('asks its nineteen questions in order', () => {
    expect(DEEPER.map((e) => e.question)).toEqual([
      'Who’s strongest overall?',
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
      'What should I buy, forge or promote before this map?',
      'How do experienced players run this map?',
    ]);
  });

  it('jumps each entry to its view and control', () => {
    expect(DEEPER.map((e) => [e.jump?.to, e.jump?.target])).toEqual([
      ['leaderboard', 'leaderboard'],
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
      ['log', 'prepare'],
      ['map', 'how-to-run'],
    ]);
    expect(deeperEntry('robin').jump).toMatchObject({ robinRow: true });
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
    for (const word of ['pairing', 'variable parent', 'blocked pairing', 'build template', 'coverage', 'score basis', 'effective cap', 'target breakpoint', 'speed margin', 'Mixed', 'weights'])
      expect(terms.join(' | ')).toContain(word);
    expect(terms).toContain('preset vs wishlist');
  });

  it('never asks about the retired Plan page, plan presets, army fit or quotas (#212)', () => {
    const copy = DEEPER.map((e) => [e.question, ...deeperView(e, false).answer, ...e.terms.flatMap((t) => [t.term, t.def])].join(' ')).join(' ');
    for (const gone of ['plan preset', 'Roles matrix', 'saved plan', 'Plan →', 'marriage plan', 'army fit', 'quota']) expect(copy).not.toContain(gone);
  });

  it('says the explorer isn’t the plan, and labels unit opinion as not read by the wishlist', () => {
    expect(deeperView(deeperEntry('preset'), false).answer.join(' ')).toMatch(/flawless chance/);
    expect(deeperEntry('preset').terms[0]!.def).toContain(EXPLORER_NOTE);
    expect(deeperView(deeperEntry('unit-opinion'), false).answer.join(' ')).toContain(OPINION_NOTE);
    expect(deeperView(deeperEntry('unit-partners'), false).answer.join(' ')).toContain('Wishlist entry →');
  });
});

describe('journey steps link into Going deeper', () => {
  const links = (journey: keyof typeof JOURNEYS) =>
    JOURNEYS[journey].steps.flatMap((s, i): [number, DeeperId[]][] => (s.deeper ? [[i + 1, [...s.deeper]]] : []));

  it('from Fresh run’s Robin step', () => {
    expect(links('fresh')).toEqual([[3, ['robin']]]);
  });

  it('none from After a loss', () => {
    expect(links('loss')).toEqual([]);
    expect(JOURNEYS.loss.steps[2]!.target).toBe('children-ledger');
  });
});

describe('the child a table jump shows', () => {
  const order: ChildId[] = ['lucina', 'owain', 'inigo', 'brady'];

  it('is the last child opened', () => {
    expect(guideChild('inigo', order)).toBe('inigo');
  });

  it('else the first child in the run', () => {
    expect(guideChild(undefined, order)).toBe('lucina');
  });

  it('skips a last-opened child that isn’t in this run', () => {
    expect(guideChild('morgan-m', order)).toBe('lucina');
  });
});
