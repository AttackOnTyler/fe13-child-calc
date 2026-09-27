import { describe, expect, it } from 'vitest';
import type { ChildId } from '../engine';
import { DEEPER, DEEPER_GROUPS, deeperEntry, deeperView, guideChild } from './guide-deeper';
import { PLAN_A_RUN } from './guide-welcome';
import { EXPLORER_NOTE, OPINION_NOTE } from './labels';

/** Everything an entry says: its question, answer (either way) and terms. */
const copyOf = (e: (typeof DEEPER)[number]) =>
  [e.question, ...deeperView(e, false).answer, e.lockedAnswer ?? '', ...e.terms.flatMap((t) => [t.term, t.def])].join(' ');

describe('Going deeper', () => {
  it('groups its questions into Your run and Exploring (#213)', () => {
    expect(DEEPER_GROUPS.map((g) => g.title)).toEqual(['Your run', 'Exploring']);
    expect(DEEPER_GROUPS.map((g) => g.ids.map((id) => deeperEntry(id).question))).toEqual([
      [
        'Where do I start a run?',
        'Which Robin should my run use?',
        'What needs me before the run starts?',
        'What is my run working towards?',
        'Where does this number come from?',
        'Can my units handle the next map?',
        'Who should I deploy, paired with whom?',
        'What should I watch out for on this map?',
        'What should I buy, forge or promote before this map?',
        'What do I do after clearing a map?',
        'What needs me before the next map?',
        'A unit died, a recruit was missed, or a marriage went off the plan: what now?',
        'How do I record my run?',
        'What am I facing on this map?',
        'How do experienced players run this map?',
        'What does ⚠ mean?',
      ],
      [
        'Who’s strongest overall?',
        'What does this pairing build?',
        'Which Robin does this child want?',
        'Which preset suits this child?',
        'Can I change how children are scored?',
        'What does the Play context change?',
        'What can this unit become?',
        'Who should this unit marry?',
        'What does Robin’s page show before Robin is set?',
        'What’s true of this child whoever its parents are?',
        'What do the experts say about this unit?',
      ],
    ]);
  });

  it('puts every entry in exactly one group', () => {
    const grouped = DEEPER_GROUPS.flatMap((g) => g.ids);
    expect([...grouped].sort()).toEqual(DEEPER.map((e) => e.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('jumps your run’s questions to the Run view, the Wishlist tab and Roster', () => {
    const jumps = Object.fromEntries(DEEPER.map((e) => [e.id, [e.jump.to, e.jump.target]]));
    expect(jumps).toMatchObject({
      start: ['roster', 'run-facts'],
      'robin-choice': ['log', 'robin-card'],
      'inbox-before': ['log', 'inbox'],
      wishlist: ['wishlist', 'wishlist-army'],
      why: ['log', 'flawless-headline'],
      assumption: ['log', 'stated-assumptions'],
      'record-results': ['log', 'next-map'],
      'inbox-after': ['log', 'inbox'],
      loss: ['roster', 'state-strip'],
      matchups: ['log', 'prepare'],
      'play-context': ['here', 'play-context'],
      strongest: ['leaderboard', 'leaderboard'],
      robin: ['child', 'robin-heatmap'],
    });
    expect(deeperEntry('robin').jump).toMatchObject({ robinRow: true });
  });

  it('has nothing to choose, and no jump, for a child’s Robin once Robin is locked', () => {
    const robin = deeperEntry('robin');
    expect(deeperView(robin, false).jump).toEqual(robin.jump);
    expect(deeperView(robin, true)).toEqual({ answer: ['Robin is locked, so there’s nothing left to choose.'], jump: undefined });
    for (const id of ['strongest', 'robin-choice'] as const) expect(deeperView(deeperEntry(id), true).jump).toEqual(deeperEntry(id).jump);
  });

  it('defines the drill-down words in its Terms folds', () => {
    const terms = DEEPER.flatMap((e) => e.terms.map((t) => t.term)).join(' | ');
    for (const word of ['pairing', 'variable parent', 'blocked pairing', 'build template', 'coverage', 'score basis', 'effective cap', 'target breakpoint', 'speed margin', 'Mixed', 'weights', 'preset vs wishlist'])
      expect(terms).toContain(word);
    for (const word of ['flawless chance', 'ceiling', 'edit', 'pin', 'worth', 'reserve', 'milestone', 'reading', 'loss item', 'blind spot', 'Robin Lock']) expect(terms).toContain(word);
  });

  it('never asks about retired things: the Plan page, presets for the plan, army fit, quotas, the journeys or the dock (#212, #213)', () => {
    const copy = DEEPER.map(copyOf).join(' ');
    for (const gone of ['plan preset', 'Roles matrix', 'saved plan', 'Plan →', 'marriage plan', 'army fit', 'quota', 'Fresh run', 'After a loss', 'Just look around', 'dock', 'Benched', 'Deploy column', 'standing', 'Σ'])
      expect(copy).not.toContain(gone);
  });

  it('splits the inbox before and after the Lock, and Record results, into their own questions', () => {
    const before = copyOf(deeperEntry('inbox-before'));
    for (const said of ['Before the run: what needs you', 'Robin card', 'Accept', 'Dismiss', 'Close calls', 'Take it', 'Anything else you want different?', 'Pin it', 'Make it', 'Your edits', 'Undo', 'Lock Robin and start'])
      expect(before).toContain(said);
    const after = copyOf(deeperEntry('inbox-after'));
    for (const said of ['at risk', 'behind', 'required', 'loss item', 'What changed', 'Got it', 'What it cost', 'checks the map offers', 'checks worth setting up', 'Checks step']) expect(after).toContain(said);
    const record = copyOf(deeperEntry('record-results'));
    for (const said of ['Next map', 'Record results', 'Shopping', 'Side goals and renown', 'Items used', 'The Checks step', 'checked rule', 'class change', 'Chapter 11', 'Undo', 'Forecast learning']) expect(record).toContain(said);
    expect(record).not.toContain('After the Lock the inbox');
  });

  it('points at the Wishlist tab, the Why panel and the explorer as they are', () => {
    expect(copyOf(deeperEntry('wishlist'))).toMatch(/Lead and Back.*Reserves.*children ledger/s);
    expect(copyOf(deeperEntry('why'))).toMatch(/Why panel.*blind spots.*Stated assumptions/s);
    expect(deeperView(deeperEntry('preset'), false).answer.join(' ')).toMatch(/flawless chance/);
    expect(deeperEntry('preset').terms[0]!.def).toContain(EXPLORER_NOTE);
    expect(deeperView(deeperEntry('unit-opinion'), false).answer.join(' ')).toContain(OPINION_NOTE);
    expect(deeperView(deeperEntry('unit-partners'), false).answer.join(' ')).toContain('Wishlist entry →');
    expect(copyOf(deeperEntry('play-context'))).toMatch(/wishlist reads its build templates from the route/);
  });
});

describe('Plan a run links into Going deeper', () => {
  it('from its Robin card step, to the inbox and the wishlist', () => {
    expect(PLAN_A_RUN.steps.map((s) => s.deeper ?? [])).toEqual([[], ['inbox-before', 'wishlist']]);
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
