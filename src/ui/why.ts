/**
 * The Why panel (#210; spec #175, The Why panel): every number on the Run view and the Wishlist tab opens it beside the
 * page. It renders the facade's explanation (`engine.explain`) and nothing else: the value, one sentence on what it is,
 * its math, the rows that moved it (each drilling further, with breadcrumbs), where the trail stops, and the blind
 * spots touching it with their lean. Its second tab is the stated assumptions list (#211 fills it; `setAssumptionsTab`).
 *
 * A number is made clickable by one helper, `whyText` (or `whyNumber`): a button carrying its explanation's id in
 * `data-why`. One click handler on the document (`installWhy`) opens the panel on it, so pages never wire their own.
 * Differences the page shows (proposals, close calls, costs) are handed over with `setComparison`; their per-map rows
 * need the other plan's runs, which the solve's worker works out in its own slot when the panel asks.
 */
import {
  FLAWLESS_SEED,
  rescoreSeed,
  rosterUnits,
  type Assumptions,
  type Comparison,
  type DeploymentRole,
  type Engine,
  type ExplainContext,
  type Explanation,
  type ExplanationRow,
  type Plan,
  type PlanPin,
  type RosterUnit,
  type Run,
  type RunSim,
  type UnitWorth,
} from '../engine';
import { chanceText, differenceText, killText } from './chance';
import { h } from './dom';
import { startSolve } from './solve-client';

/** A number in a line of text: the text it reads as, and its explanation's id. */
export type WhyMark = readonly [text: string, id: string];

/** A number the Why panel explains: a button that reads as the number (styled as text with a dotted underline). */
export function whyNumber(text: string, id: string): HTMLElement {
  return h('button', { class: 'why-num', 'data-why': id, title: 'Why this number?', type: 'button' }, text);
}

/**
 * A line of text with its numbers made clickable: each mark's text, found in order after the one before, becomes a
 * `whyNumber`. A mark whose text isn't there is skipped, so the line always reads as it did.
 */
export function whyText(text: string, marks: readonly (WhyMark | undefined | false)[]): (string | HTMLElement)[] {
  return splitMarks(text, marks).map((p) => (p.id ? whyNumber(p.text, p.id) : p.text));
}

/** A line split at its numbers (see `whyText`): the pieces, in order, a number's with its id. */
export function splitMarks(text: string, marks: readonly (WhyMark | undefined | false)[]): { readonly text: string; readonly id?: string }[] {
  const out: { text: string; id?: string }[] = [];
  let at = 0;
  for (const m of marks) {
    if (!m || !m[0]) continue;
    const i = text.indexOf(m[0], at);
    if (i < 0) continue;
    if (i > at) out.push({ text: text.slice(at, i) });
    out.push({ text: m[0], id: m[1] });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

// ---- state ----

/** The drill path: the number opened first, then each row followed. */
let path: string[] = [];
let tab: 'why' | 'assumptions' = 'why';
let changed: (() => void) | undefined;
/** Comparisons the page shows, by key, with the plans their per-map rows compare (the other, and the one it's against). */
const comparisons = new Map<string, { comparison: Comparison; plans?: { readonly other: Plan; readonly base: Plan } }>();
/** Both plans' runs worked out, by comparison key; the plan's runs without each unit (and the plan's own), by unit. */
const others = new Map<string, { other: RunSim; base: RunSim }>();
const withouts = new Map<string, { without: RunSim; base: RunSim }>();
/** The worth the page read, for the plan it read it on. */
let worthRead: { plan: Plan; units: readonly UnitWorth[] } | undefined;
/** What's being worked out now, so the panel asks once. */
let asking: string | undefined;

/** The Why panel is open. */
export const whyOpen = (): boolean => path.length > 0 || tab === 'assumptions';

/** Opens the panel on a number (the start of a new path). */
export function openWhy(id: string): void {
  path = [id];
  tab = 'why';
  changed?.();
}

export function closeWhy(): void {
  path = [];
  tab = 'why';
  changed?.();
}

/**
 * One handler for every number (#210): a click on a `whyNumber` anywhere in `root` opens the panel on it; `redraw`
 * draws the panel again whenever it changes. Install once.
 */
export function installWhy(root: Document | HTMLElement, redraw: () => void): void {
  changed = redraw;
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-why]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    openWhy(el.dataset.why!);
  });
}

/**
 * Hands the panel a difference the page shows (`edit:<key>`), and the two plans it compares (the other, and the one
 * it's against), for its per-map rows.
 */
export function setComparison(key: string, comparison: Comparison, plans?: { readonly other: Plan; readonly base: Plan }): void {
  const held = comparisons.get(key);
  if (held && (held.plans?.other !== plans?.other || held.plans?.base !== plans?.base)) others.delete(key);
  comparisons.set(key, { comparison: plans ? { ...comparison, drill: true } : comparison, ...(plans ? { plans } : {}) });
}

/** Hands the panel the worth the Wishlist tab read, on its plan. */
export function setWorth(plan: Plan, units: readonly UnitWorth[]): void {
  if (worthRead?.plan !== plan) withouts.clear();
  worthRead = { plan, units };
}

/** The assumptions tab's content (#211 fills it); by default the blind spots and a note. */
let assumptionsTab: ((ctx: WhyContext) => HTMLElement[]) | undefined;
export function setAssumptionsTab(draw: (ctx: WhyContext) => HTMLElement[]): void {
  assumptionsTab = draw;
}

// ---- the panel ----

/** What the panel reads from the page: the engine, the run and how the page's headline was worked out. */
export type WhyContext = {
  readonly engine: Engine;
  readonly assumptions?: Assumptions;
  readonly run: Run;
  /** The headline's plan and runs, the adopted plan's readings, and whether the solve's worker worked it out. */
  readonly headline: { readonly plan: Plan; readonly chance: RunSim; readonly readings?: ExplainContext['readings']; readonly solved: boolean } | undefined;
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
  readonly pins?: () => readonly PlanPin[];
  /** Opens a map's matchups (the Maps list), where a fight's trail stops. */
  readonly openMap?: (map: string) => void;
};

/** The explanation context from what the page holds. */
export function explainContext(ctx: WhyContext, id?: string): ExplainContext {
  const hd = ctx.headline;
  const worth = worthRead?.units;
  const unit = id?.startsWith('worth:') ? id.slice(6) : undefined;
  const w = unit ? withouts.get(unit) : undefined;
  const comps = Object.fromEntries([...comparisons].map(([k, v]) => [k, others.has(k) ? { ...v.comparison, ...others.get(k)! } : v.comparison]));
  return {
    run: ctx.run,
    ...(hd ? { plan: w ? worthRead!.plan : hd.plan, chance: w ? w.base : hd.chance, seed: hd.solved ? rescoreSeed(FLAWLESS_SEED) : FLAWLESS_SEED } : {}),
    ...(hd?.readings ? { readings: hd.readings } : {}),
    ...(ctx.roleOf ? { roleOf: ctx.roleOf } : {}),
    ...(worth ? { worth } : {}),
    ...(w && unit ? { without: { [unit]: w.without } } : {}),
    comparisons: comps,
  };
}

/** Asks the solve's worker for the runs an explanation's rows wait for, once. */
function ask(ctx: WhyContext, id: string, e: Explanation): void {
  if (!e.pending || !ctx.assumptions || !ctx.headline || asking === id) return;
  const seed = ctx.headline.solved ? rescoreSeed(FLAWLESS_SEED) : FLAWLESS_SEED;
  const runs = ctx.headline.chance.runs;
  const roles = ctx.roleOf ? Object.fromEntries(rosterUnits(ctx.run.roster.run).map((u) => [u.id, ctx.roleOf!(u.id)])) : undefined;
  const pins = ctx.pins?.();
  if (e.pending === 'other') {
    const key = id.slice('edit:'.length);
    const held = comparisons.get(key);
    if (!held?.plans) return;
    const started = startSolve({ kind: 'why', assumptions: ctx.assumptions, run: ctx.run, plan: held.plans.other, base: held.plans.base, seed, runs, ...(roles ? { roles } : {}) }, (reply) => {
      if (reply.kind !== 'why' || !reply.base) return;
      others.set(key, { other: reply.chance, base: reply.base });
      if (asking === id) asking = undefined;
      changed?.();
    }, 'why');
    if (started) asking = id;
    return;
  }
  const unit = id.slice('worth:'.length) as RosterUnit;
  const plan = worthRead?.plan;
  if (!plan) return;
  const started = startSolve({ kind: 'why', assumptions: ctx.assumptions, run: ctx.run, plan, unit, seed: FLAWLESS_SEED, runs, ...(pins ? { pins } : {}), ...(roles ? { roles } : {}) }, (reply) => {
    if (reply.kind !== 'why' || !reply.base) return;
    withouts.set(unit, { without: reply.chance, base: reply.base });
    if (asking === id) asking = undefined;
    changed?.();
  }, 'why');
  if (started) asking = id;
}

const LEAN = { high: ['▲ may read high', 'the real chance is probably lower', 'warn'], low: ['▼ may read low', 'the real chance is probably higher', 'ok'], either: ['◆ either way', 'it could go either way', 'dim'] } as const;

/** A signed number of points: 0.012 → "+1.2", −0.034 → "−3.4". */
const signed = (p: number) => {
  const s = (Math.abs(p) * 100).toFixed(1);
  return s === '0.0' ? s : `${p < 0 ? '−' : '+'}${s}`;
};

/** An explanation's value as the panel reads it (the ± of a difference with it; the headline's in its math). */
export function valueText(e: Pick<Explanation, 'value' | 'format' | 'margin' | 'close'>): string {
  switch (e.format) {
    case 'chance':
      return chanceText(e.value);
    case 'kill':
      return killText(e.value);
    case 'difference':
      return differenceText(e.value, e.margin ?? Number.NaN, e.close);
    case 'points':
      return `${(e.value * 100).toFixed(1)} points`;
    case 'gold':
      return `${Math.round(e.value).toLocaleString('en-US')}G`;
    case 'exp':
      return `${Math.round(e.value)} EXP`;
  }
}

/** A row's value cell: its words, else its chance. */
const rowValue = (r: ExplanationRow) => r.value ?? (r.chance === undefined ? '' : r.kill ? killText(r.chance) : chanceText(r.chance));

/**
 * An explanation as the panel draws it (#210): breadcrumbs (`crumbs`: each explanation on the path, the last this one),
 * the value, its lead, its math, its rows (a drillable row calls `drill`), where the trail stops, and its blind spots.
 */
export function explanationView(
  e: Explanation,
  crumbs: readonly { readonly id: string; readonly title: string }[],
  on: { readonly drill: (id: string) => void; readonly crumb: (i: number) => void; readonly close: () => void; readonly matchup?: (map: string) => void },
): HTMLElement {
  const max = Math.max(0.0001, ...(e.rows ?? []).map((r) => Math.abs(r.points ?? 0)));
  return h(
    'div',
    { class: 'why-body' },
    h(
      'div',
      { class: 'why-crumbs' },
      ...crumbs.flatMap((c, i) => [
        i ? ' › ' : '',
        i === crumbs.length - 1 ? h('b', {}, c.title) : h('button', { class: 'linkish', type: 'button', onclick: () => on.crumb(i) }, c.title),
      ]),
      h('button', { class: 'mini ghost why-close', type: 'button', title: 'Close the Why panel', onclick: on.close }, '✕'),
    ),
    h('div', { class: 'why-value' }, valueText(e)),
    h('p', { class: 'why-lead' }, e.lead),
    e.math.length ? h('ul', { class: 'why-math small' }, ...e.math.map((m) => h('li', {}, m))) : null,
    e.rows?.length
      ? h(
          'div',
          {},
          h('h4', {}, e.rowsTitle ?? 'What moved it'),
          h(
            'table',
            { class: 'why-rows small' },
            h(
              'tbody',
              {},
              ...e.rows.map((r) =>
                h(
                  'tr',
                  { class: r.drillTo ? 'drill' : '', ...(r.drillTo ? { title: 'Why?', onclick: () => on.drill(r.drillTo!) } : {}) },
                  h('td', {}, r.drillTo ? h('button', { class: 'linkish', type: 'button' }, r.label) : r.label),
                  h('td', { class: 'v' }, rowValue(r)),
                  h('td', { class: `v ${r.points === undefined ? '' : r.points < 0 ? 'neg' : 'pos'}` }, r.points === undefined ? '' : signed(r.points)),
                  h('td', { class: 'bar' }, r.points === undefined ? '' : h('i', { class: r.points < 0 ? 'neg' : 'pos', style: `width:${Math.round((Math.abs(r.points) / max) * 100)}%` })),
                  h('td', {}, r.drillTo ? '›' : ''),
                ),
              ),
            ),
          ),
        )
      : null,
    e.stop
      ? h(
          'p',
          { class: 'why-stop small' },
          e.stop,
          e.matchup && on.matchup ? ' ' : null,
          e.matchup && on.matchup ? h('button', { class: 'linkish', type: 'button', onclick: () => on.matchup!(e.matchup!.map) }, 'Open the matchup') : null,
        )
      : null,
    h(
      'div',
      { class: 'why-spots' },
      h('h4', {}, 'Not counted in this number'),
      ...(e.blindSpots.length
        ? e.blindSpots.map((b) =>
            h('div', { class: 'why-spot small' }, h('span', { class: `chip lean-${LEAN[b.lean][2]}`, title: LEAN[b.lean][1] }, LEAN[b.lean][0]), ' ', h('b', {}, b.label), ' ', h('span', { class: 'muted' }, b.why)),
          )
        : [h('div', { class: 'muted small' }, 'No stated blind spot touches it.')]),
    ),
  );
}

/** The panel beside the page: the Why tab (the path's explanation) or the stated assumptions. */
export function whyPanel(ctx: WhyContext): HTMLElement[] {
  const tabs = h(
    'div',
    { class: 'why-tabs' },
    h('button', { type: 'button', class: tab === 'why' ? 'on' : '', onclick: () => ((tab = 'why'), changed?.()) }, 'Why'),
    h('button', { type: 'button', class: tab === 'assumptions' ? 'on' : '', onclick: () => ((tab = 'assumptions'), changed?.()) }, 'Stated assumptions'),
  );
  if (tab === 'assumptions') {
    const body = assumptionsTab
      ? assumptionsTab(ctx)
      : [
          h('p', { class: 'muted small' }, 'Everything the numbers rest on that isn’t read from your game. The blind spots, each with where it bites and its lean; open rules by stakes, model mismatches, learned corrections and checked rules come with the in-play checks.'),
          ...ctx.engine.blindSpots().map((b) => h('div', { class: 'why-spot small' }, h('span', { class: `chip lean-${LEAN[b.lean][2]}`, title: LEAN[b.lean][1] }, LEAN[b.lean][0]), ' ', h('b', {}, b.label), ' ', h('span', { class: 'muted' }, b.why))),
        ];
    return [h('div', { class: 'why' }, tabs, h('div', { class: 'why-crumbs' }, h('b', {}, 'Stated assumptions'), h('button', { class: 'mini ghost why-close', type: 'button', onclick: closeWhy }, '✕')), ...body)];
  }
  const id = path[path.length - 1]!;
  const explained = path.map((p) => ({ id: p, e: ctx.engine.explain(p, explainContext(ctx, p)) }));
  const e = explained[explained.length - 1]!.e;
  if (e) ask(ctx, id, e);
  const crumbs = explained.map((x) => ({ id: x.id, title: x.e ? (x.e.title.length > 36 ? `${x.e.title.slice(0, 34)}…` : x.e.title) : x.id }));
  const on = {
    drill: (to: string) => {
      path = [...path, to];
      changed?.();
    },
    crumb: (i: number) => {
      path = path.slice(0, i + 1);
      changed?.();
    },
    close: closeWhy,
    ...(ctx.openMap ? { matchup: ctx.openMap } : {}),
  };
  return [
    h(
      'div',
      { class: 'why' },
      tabs,
      e
        ? explanationView(e, crumbs, on)
        : h(
            'div',
            { class: 'why-body' },
            h('div', { class: 'why-crumbs' }, h('b', {}, crumbs[crumbs.length - 1]!.title), h('button', { class: 'mini ghost why-close', type: 'button', onclick: closeWhy }, '✕')),
            h('p', { class: 'muted' }, 'Nothing to explain yet: this number is still being worked out.'),
          ),
    ),
  ];
}
