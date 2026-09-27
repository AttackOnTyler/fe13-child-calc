/**
 * The Why panel's second tab (#211; spec #175, The Why panel and In-play checks and stated assumptions): the whole
 * stated assumptions list, everything the numbers rest on that isn't read from the player's game, in order:
 *
 * 1. the blind spots, each with its lean, where it bites and, where it can be stressed, its stress-test range (the
 *    headline's plan re-run under its bad case, explained in the Why tab);
 * 2. the open rules by stakes, each with its check (and the edit that sets it up, when the stakes call for one);
 * 3. the model mismatches (a rule play contradicted twice the same way);
 * 4. the learned EXP corrections, with the switch to compare the forecast without them;
 * 5. the checked rules (collapsed).
 *
 * Any open rule (or mismatch) can be answered by hand ("from outside this run") and any checked rule reopened here:
 * the list lives only in the panel, reachable from the Run view's and the Wishlist tab's headline.
 */
import {
  answerRule,
  openRule,
  reopenRule,
  withCorrectionsOff,
  type Assumptions,
  type BlindSpotTouch,
  type CheckedRules,
  type Engine,
  type Plan,
  type RuleStake,
  type Run,
  type StressCase,
} from '../engine';
import { askChecks, checksProgress, latestStakes, rulesReadout, setupRows, type ChecksProgress, type RuleRow, type RulesContext } from './checks-view';
import { chanceText, stressText } from './chance';
import { h } from './dom';
import { forecastLearningReadout, type ForecastLearningReadout } from './run-page';
import { LEAN, whyText } from './why';

/** The list's sections, in the spec's order. */
export const STATED_SECTIONS = ['Blind spots', 'Open rules', 'Model mismatches', 'Learned corrections', 'Checked rules'] as const;

/** Where a blind spot bites, by what it touches. */
const BITES: Readonly<Record<BlindSpotTouch, string>> = {
  map: 'map chances',
  flawless: 'the walk between maps',
  fight: 'fight kill chances',
  milestone: 'milestones and the EXP forecast',
};

const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export type StatedBlindSpot = {
  readonly id: string;
  readonly label: string;
  /** Its lean chip's words: "▲ may read high". */
  readonly lean: string;
  readonly leanClass: string;
  readonly leanMeans: string;
  readonly why: string;
  /** "Bites: map chances and fight kill chances". */
  readonly bites: string;
  /** Its stress-test range with the explanation's id, or, while being worked out, a note; none where it can't be stressed. */
  readonly stress?: { readonly text: string; readonly id?: string };
};

export type StatedRule = RuleRow & {
  /** "Check in play: EXP from one Rally …". */
  readonly check: string;
  /** The check worth setting up, with its edit's cost, when the stakes call for one. */
  readonly setup?: string;
};

export type StatedAssumptionsReadout = {
  readonly blindSpots: readonly StatedBlindSpot[];
  readonly open: readonly StatedRule[];
  readonly mismatches: readonly StatedRule[];
  readonly corrections: ForecastLearningReadout;
  readonly settled: readonly StatedRule[];
};

export type StatedOptions = {
  readonly rules: CheckedRules;
  /** Each open rule's stakes worked out so far. */
  readonly stakes?: readonly RuleStake[];
  /** The checks' progress (setup checks and their costs). */
  readonly progress?: ChecksProgress;
  /** The adopted plan: a learned correction beyond range names the open checks touching its unit. */
  readonly plan?: Plan;
  /** The headline's chance and its plan re-run under each stressed blind spot, as far as they're in. */
  readonly headline?: { readonly chance: number; readonly stress?: Readonly<Partial<Record<StressCase, { readonly chance: number }>>> };
  readonly label?: (map: string) => string;
};

/** The stated assumptions list, as the tab writes it (see the module comment). */
export function statedAssumptionsReadout(engine: Engine, run: Run, o: StatedOptions): StatedAssumptionsReadout {
  const tests = engine.stressTests();
  const blindSpots = engine.blindSpots().map((b): StatedBlindSpot => {
    const t = tests.find((x) => x.blindSpot === b.id);
    const s = t && o.headline?.stress?.[t.id];
    const text = s && o.headline && stressText(o.headline.chance, s.chance, t.bad);
    const stress = !t
      ? undefined
      : text
        ? { text, id: `stress:${t.id}` }
        : s
          ? { text: `${chanceText(s.chance)} if ${t.bad}: no lower than the headline on this plan`, id: `stress:${t.id}` }
          : { text: `Stress test (if ${t.bad}): worked out once the search is done` };
    return {
      id: b.id,
      label: b.label,
      lean: LEAN[b.lean][0],
      leanMeans: LEAN[b.lean][1],
      leanClass: `lean-${LEAN[b.lean][2]}`,
      why: b.why,
      bites: `Bites: ${listOf(b.touches.map((x) => BITES[x]))}`,
      ...(stress ? { stress } : {}),
    };
  });
  const read = rulesReadout(engine.openRules(o.rules), o.stakes ?? [], o.label);
  const setups = new Map(setupRows(o.progress).map((r) => [r.key.slice('setup:'.length), r.text]));
  const withCheck = (r: RuleRow): StatedRule => {
    const setup = setups.get(r.id);
    return { ...r, check: `Check in play: ${openRule(r.id)?.ask.question ?? ''}`, ...(setup ? { setup: `Worth setting up: ${setup}` } : {}) };
  };
  const touched = engine.correctionChecks(run, o.plan, o.rules);
  return { blindSpots, open: read.open.map(withCheck), mismatches: read.mismatches.map(withCheck), corrections: forecastLearningReadout(run, touched), settled: read.settled.map(withCheck) };
}

// ---- the tab ---------------------------------------------------------------------------------------------------------

/** What the tab reads and changes: the checked rules (main.ts's `setRules`), the run (the corrections' switch). */
export type StatedContext = RulesContext & {
  readonly assumptions?: Assumptions;
  readonly setRun: (run: Run) => void;
  readonly plan?: Plan;
  /** The headline as the page worked it out; `solved`: the search is done (the stakes may be asked for). */
  readonly headline?: StatedOptions['headline'] & { readonly solved: boolean };
};

/** The Why panel's stated assumptions tab (#211): the list, in order, with its answer, reopen and switch controls. */
export function statedAssumptionsTab(ctx: StatedContext): HTMLElement[] {
  // Each open rule's stakes: one background re-run of the plan each, asked for once the search is done.
  if (ctx.plan && ctx.headline?.solved) askChecks(ctx, ctx.plan, ctx.rules);
  const progress = ctx.plan ? checksProgress(ctx.run, ctx.plan, ctx.rules) : undefined;
  const maps = new Map(ctx.engine.maps().map((m) => [m.id, m.label]));
  const r = statedAssumptionsReadout(ctx.engine, ctx.run, {
    rules: ctx.rules,
    stakes: progress?.stakes ?? latestStakes(),
    ...(progress ? { progress } : {}),
    ...(ctx.plan ? { plan: ctx.plan } : {}),
    ...(ctx.headline ? { headline: ctx.headline } : {}),
    label: (id) => maps.get(id) ?? id,
  });
  const answer = (id: string, reading: 'best' | 'other') => ctx.setRules(answerRule(ctx.rules, id, reading, ctx.evidence, ctx.now()));
  const rule = (x: StatedRule) =>
    h(
      'article',
      { class: 'assumption open-rule', 'data-rule': x.id },
      h('div', {}, h('strong', {}, x.label), h('span', { class: 'muted' }, ` · ${x.status}`)),
      ...x.notes.map((n) => h('div', { class: 'small muted' }, n)),
      h('p', { class: 'a-why small' }, x.why),
      h('div', { class: 'small' }, x.check),
      x.setup ? h('div', { class: 'small' }, x.setup) : null,
      h(
        'div',
        { class: 'a-control' },
        ...(x.can === 'answer'
          ? [
              h('span', { class: 'small' }, 'From outside this run: '),
              h('button', { class: 'mini', type: 'button', title: 'Answer it by hand: the model keeps this reading', onclick: () => answer(x.id, 'best') }, x.best),
              h('button', { class: 'mini', type: 'button', title: 'Answer it by hand: the model switches to this reading', onclick: () => answer(x.id, 'other') }, x.other),
            ]
          : [h('button', { class: 'mini ghost', type: 'button', title: 'Open it again: the model goes back to the best reading', onclick: () => ctx.setRules(reopenRule(ctx.rules, x.id)) }, 'Reopen')]),
      ),
    );
  const c = r.corrections;
  return [
    h(
      'p',
      { class: 'muted small' },
      'Everything the numbers rest on that isn’t read from your game. Answers to rules are kept for every run and survive Clear all; the learned corrections are this run’s.',
    ),
    h('h4', {}, STATED_SECTIONS[0]),
    ...r.blindSpots.map((b) =>
      h(
        'div',
        { class: 'why-spot small', 'data-blind-spot': b.id },
        h('span', { class: `chip ${b.leanClass}`, title: b.leanMeans }, b.lean),
        ' ',
        h('b', {}, b.label),
        ' ',
        h('span', { class: 'muted' }, b.why),
        h('div', { class: 'muted' }, b.bites),
        b.stress ? h('div', {}, ...(b.stress.id ? whyText(b.stress.text, [[/over 99\.9%|under 0\.1%|\d+(?:\.\d)?%/.exec(b.stress.text)?.[0] ?? '', b.stress.id]]) : [h('span', { class: 'muted' }, b.stress.text)])) : null,
      ),
    ),
    h('h4', {}, STATED_SECTIONS[1]),
    h(
      'p',
      { class: 'muted small' },
      'Game rules no source settles, each read on its best reading until play checks it (Record results asks when a map offered its check). Stakes are the flawless points that turn on it: the plan re-run under its other reading.',
    ),
    ...(r.open.length ? r.open.map(rule) : [h('div', { class: 'muted small' }, 'None open.')]),
    h('h4', {}, STATED_SECTIONS[2]),
    ...(r.mismatches.length ? r.mismatches.map(rule) : [h('div', { class: 'muted small' }, 'None: play has agreed with a reading every time.')]),
    h('h4', {}, STATED_SECTIONS[3]),
    c.corrections.length
      ? h(
          'div',
          { class: 'small' },
          h('div', {}, c.assumption),
          ...c.corrections.map((t) => h('div', { class: c.off ? 'muted' : '' }, t)),
          h(
            'label',
            { class: 'small', title: 'Compare the forecast with and without what the recorded maps taught it' },
            h('input', { type: 'checkbox', checked: !c.off, onchange: (ev: Event) => ctx.setRun(withCorrectionsOff(ctx.run, !(ev.target as HTMLInputElement).checked)) }),
            ' Apply the learned corrections',
          ),
        )
      : h('div', { class: 'muted small' }, 'None yet: each recorded map teaches each unit an EXP factor against the forecast kept on its entry (shrunk toward ×1, ×0.5–×2).'),
    h('details', {}, h('summary', {}, `${STATED_SECTIONS[4]} (${r.settled.length})`), ...(r.settled.length ? r.settled.map(rule) : [h('div', { class: 'muted small' }, 'None checked or answered yet.')])),
  ];
}
