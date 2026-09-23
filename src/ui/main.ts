import './style.css';
import {
  MOD_STATS,
  STATS,
  STAT_LABELS,
  createEngine,
  resolveAssumptions,
  type AssumptionId,
  type Assumptions,
  type ChildId,
  type ChildResult,
  type ClassId,
  type ClassSummary,
  type Gender,
  type Engine,
  type Overrides,
  type PairingGroup,
  type SelfTestReport,
} from '../engine';
import { h } from './dom';
import { loadOverrides, saveOverrides } from './overrides';
import { validationPanel, withOverride } from './validation';

let overrides: Overrides = loadOverrides();
let assumptions: Assumptions = resolveAssumptions(overrides);
let engine: Engine = createEngine(assumptions);
let selfTest = engine.selfTest();

// View state only; all domain answers come from the engine.
let selected: ChildId = 'lucina';
let view: 'table' | 'validation' = selfTest.passed ? 'table' : 'validation';
/** Group rows (by group key) currently listing one row per Robin asset/flaw. */
const expanded = new Set<string>();
/** The class the caps are shown in: each row's start class, or one pinned class. */
let capsClass: ClassId | 'start' = 'start';
let limitBreaker = true;

/** Replaces the overrides, saves them and recomputes every pairing. */
function applyOverrides(next: Overrides): void {
  overrides = next;
  saveOverrides(overrides);
  assumptions = resolveAssumptions(overrides);
  engine = createEngine(assumptions);
  selfTest = engine.selfTest();
  render();
}

const setOverride = (id: AssumptionId, value: unknown) => applyOverrides(withOverride(overrides, id, value));

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

/** Topbar toggle for the validation panel, showing the self-test result and how many assumptions are overridden. */
function validationButton(report: SelfTestReport): HTMLElement {
  const passed = report.cases.filter((c) => c.passed).length;
  const overridden = engine.assumptions().filter((a) => !a.isDefault).length;
  return h(
    'button',
    {
      class: `validation-toggle${report.passed ? '' : ' fail'}${view === 'validation' ? ' on' : ''}`,
      title: 'Assumptions, resolved source disagreements and the self-test',
      'aria-pressed': String(view === 'validation'),
      onclick: () => {
        view = view === 'validation' ? 'table' : 'validation';
        render();
      },
    },
    'Validation ',
    h('span', { class: report.passed ? 'pos' : 'neg' }, `Self-test ${report.passed ? '✓' : '✕'} ${passed}/${report.cases.length}`),
    overridden > 0 ? h('span', { class: 'warn' }, ` · ${overridden} overridden`) : null,
  );
}

function rail(): HTMLElement {
  return h(
    'nav',
    { class: 'rail', 'aria-label': 'Children' },
    ...engine.children().map((c) =>
      h(
        'button',
        {
          class: `rail-item${c.id === selected && view === 'table' ? ' on' : ''}`,
          onclick: () => {
            selected = c.id;
            view = 'table';
            expanded.clear();
            render();
          },
        },
        h('span', {}, c.name),
        h('span', { class: 'muted' }, String(c.pairingCount)),
      ),
    ),
  );
}

/** ⚠ on a row that rests on an assumption, naming each one (and its current value) on hover. */
function warnMark(results: readonly ChildResult[]): HTMLElement | null {
  const used = new Set(results.flatMap((r) => r.assumptionsUsed));
  if (used.size === 0) return null;
  const title = engine
    .assumptions()
    .filter((a) => used.has(a.id))
    .map((a) => `Assumption: ${a.label} = ${a.current}${a.isDefault ? '' : ' (overridden)'}`)
    .join('\n');
  return h('span', { class: 'warn', title, 'aria-label': title }, ' ⚠');
}

/** The class a row's caps are shown in. */
const rowClass = (r: ChildResult): ClassId => (capsClass === 'start' ? r.startClass : capsClass);

/** Class count, class name and effective caps cells; `caps` is undefined when the child can't reach the class. */
function classCells(r: ChildResult, gender: Gender, caps: ((s: (typeof STATS)[number]) => string) | undefined): HTMLElement[] {
  const cls = rowClass(r);
  return [
    h(
      'td',
      { class: 'num gstart', title: r.classSet.map((c) => engine.className(c, gender)).join(', ') },
      String(r.classSet.length),
    ),
    h('td', { class: 'cls' }, caps ? engine.className(cls, gender) : ''),
    ...STATS.map((s, i) => h('td', { class: `num gcap${i === 0 ? ' gstart' : ''}` }, caps ? caps(s) : '')),
  ];
}

function row(r: ChildResult, label: string, gender: Gender, cls = ''): HTMLElement {
  const caps = engine.effectiveCaps(r, rowClass(r), limitBreaker);
  return h(
    'tr',
    { 'data-key': r.key, class: [cls, caps ? '' : 'unreachable'].filter(Boolean).join(' ') || undefined },
    h('th', { class: 'stick', scope: 'row' }, label, warnMark([r])),
    ...classCells(r, gender, caps && ((s) => String(caps[s]))),
    ...STATS.map((s, i) => h('td', { class: `num${i === 0 ? ' gstart' : ''}` }, String(r.growths[s]))),
    ...MOD_STATS.map((s, i) =>
      h('td', { class: `num gmod ${tone(r.modifiers[s])}${i === 0 ? ' gstart' : ''}` }, signed(r.modifiers[s])),
    ),
  );
}

/** `lo–hi` over a group's rows, or one value when they agree. */
function range(values: number[], fmt: (n: number) => string): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
}

/** A group row over Robin's asset/flaw pairings, showing each stat's range; expands into one row per asset/flaw. */
function groupRows(g: PairingGroup, gender: Gender): HTMLElement[] {
  const open = expanded.has(g.key);
  // Robin's asset/flaw changes stats only: every row in a group shares its class set and start class.
  const first = g.results[0]!;
  const caps = g.results.map((r) => engine.effectiveCaps(r, rowClass(r), limitBreaker));
  const head = h(
    'tr',
    { class: `group-row${caps[0] ? '' : ' unreachable'}`, 'data-group': g.key },
    h(
      'th',
      { class: 'stick', scope: 'row' },
      h(
        'button',
        {
          class: 'expander',
          'aria-expanded': String(open),
          title: `${open ? 'Hide' : 'List'} Robin’s ${g.results.length} asset/flaw pairings`,
          onclick: () => {
            if (open) expanded.delete(g.key);
            else expanded.add(g.key);
            render();
          },
        },
        open ? '▾ ' : '▸ ',
        g.label,
      ),
      h('span', { class: 'muted count' }, ` ×${g.results.length}`),
      warnMark(g.results),
    ),
    ...classCells(first, gender, caps[0] && ((s) => range(caps.map((c) => c![s]), String))),
    ...STATS.map((s, i) =>
      h('td', { class: `num range${i === 0 ? ' gstart' : ''}` }, range(g.results.map((r) => r.growths[s]), String)),
    ),
    ...MOD_STATS.map((s, i) =>
      h('td', { class: `num gmod range${i === 0 ? ' gstart' : ''}` }, range(g.results.map((r) => r.modifiers[s]), signed)),
    ),
  );
  if (!open) return [head];
  return [head, ...g.results.map((r) => row(r, engine.robinLabel(r.pairing) ?? r.key, gender, 'robin-row'))];
}

const TIER_LABELS: Record<ClassSummary['tier'], string> = { base: 'Base', advanced: 'Advanced', special: 'Special' };

/** Picks the class the caps are shown in, and whether Limit Breaker is assumed. */
function capsControls(): HTMLElement {
  const tiers = ['base', 'advanced', 'special'] as const;
  const option = (c: ClassSummary) =>
    h('option', { value: c.id, selected: c.id === capsClass }, `${c.name}${c.dlc ? ' (DLC)' : ''}`);
  return h(
    'div',
    { class: 'caps-controls' },
    h(
      'label',
      {},
      'Class ',
      h(
        'select',
        {
          'aria-label': 'Class for effective caps',
          onchange: (e) => {
            capsClass = (e.target as HTMLSelectElement).value as ClassId | 'start';
            render();
          },
        },
        h('option', { value: 'start', selected: capsClass === 'start' }, 'Start class (per row)'),
        ...tiers.map((t) =>
          h('optgroup', { label: TIER_LABELS[t] }, ...engine.classes().filter((c) => c.tier === t).map(option)),
        ),
      ),
    ),
    h(
      'label',
      { title: 'Limit Breaker raises every cap but HP by 10' },
      h('input', {
        type: 'checkbox',
        checked: limitBreaker,
        onchange: (e) => {
          limitBreaker = (e.target as HTMLInputElement).checked;
          render();
        },
      }),
      ' Limit Breaker',
    ),
  );
}

function childTable(child: ChildId): HTMLElement {
  const summary = engine.children().find((c) => c.id === child)!;
  // Rows whose child can't reach the pinned class sort last (stable).
  const all = engine.groups(child);
  const reaches = (g: PairingGroup) => engine.canReach(g.results[0]!, rowClass(g.results[0]!));
  const groups = [...all.filter(reaches), ...all.filter((g) => !reaches(g))];
  const capsLabel =
    capsClass === 'start' ? 'Effective caps (start class)' : `Effective caps (${engine.className(capsClass, summary.gender)})`;
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, summary.name),
    h(
      'span',
      { class: 'muted' },
      `Fixed parent: ${summary.fixedParentName} · ${summary.pairingCount} pairings` +
        (groups.length < summary.pairingCount ? ` in ${groups.length} rows` : ''),
    ),
    capsControls(),
  );
  const table = h(
    'table',
    { class: 'grid' },
    h(
      'thead',
      {},
      h(
        'tr',
        { class: 'grp' },
        h('th', { class: 'stick' }, ''),
        h('th', { colspan: '2', class: 'gstart' }, 'Classes'),
        h(
          'th',
          { colspan: String(STATS.length), class: 'gcap gstart', title: `class max + modifier${limitBreaker ? ' + 10 (not HP) with Limit Breaker' : ''}` },
          `${capsLabel}${limitBreaker ? ' + LB' : ''}`,
        ),
        h('th', { colspan: String(STATS.length), class: 'gstart', title: 'floor((father + mother + child) / 3), before class growths' }, 'Growths (personal)'),
        h('th', { colspan: String(MOD_STATS.length), class: 'gmod gstart', title: 'father + mother + 1' }, 'Max-stat modifiers'),
      ),
      h(
        'tr',
        {},
        h('th', { class: 'stick', scope: 'col' }, 'Variable parent'),
        h('th', { class: 'num gstart', scope: 'col', title: 'Base classes in the class set (hover a count to list them)' }, '#'),
        h('th', { scope: 'col' }, 'Class'),
        ...STATS.map((s, i) => h('th', { class: `num gcap${i === 0 ? ' gstart' : ''}`, scope: 'col' }, STAT_LABELS[s])),
        ...STATS.map((s, i) => h('th', { class: `num${i === 0 ? ' gstart' : ''}`, scope: 'col' }, STAT_LABELS[s])),
        ...MOD_STATS.map((s, i) => h('th', { class: `num gmod${i === 0 ? ' gstart' : ''}`, scope: 'col' }, STAT_LABELS[s])),
      ),
    ),
    h(
      'tbody',
      {},
      ...groups.flatMap((g) =>
        g.results.length === 1 ? [row(g.results[0]!, g.label, summary.gender)] : groupRows(g, summary.gender),
      ),
    ),
  );
  return h('section', { class: 'main' }, head, h('div', { class: 'scroll' }, table));
}

function render(): void {
  const app = document.getElementById('app')!;
  app.replaceChildren(
    h(
      'div',
      { class: 'shell' },
      h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'FE13 Child Calc'), validationButton(selfTest)),
      rail(),
      view === 'validation'
        ? validationPanel({ engine, assumptions, selfTest, setOverride, resetAll: () => applyOverrides({}), render })
        : childTable(selected),
      h('aside', { class: 'panel', 'aria-label': 'Scoring' }, h('h3', {}, 'Scoring'), h('p', { class: 'muted' }, 'No scoring controls yet.')),
    ),
  );
}

render();
