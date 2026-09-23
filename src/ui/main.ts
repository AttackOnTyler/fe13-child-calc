import './style.css';
import {
  ASSUMPTION_NOTES,
  MOD_STATS,
  STATS,
  STAT_LABELS,
  createEngine,
  type ChildId,
  type ChildResult,
  type SelfTestReport,
} from '../engine';

const engine = createEngine();
const selfTest = engine.selfTest();

// View state only; all domain answers come from the engine.
let selected: ChildId = 'lucina';
let selfTestOpen = !selfTest.passed;

type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;

function h(tag: string, attrs: Attrs = {}, ...children: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null) el.append(c);
  return el;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

function selfTestBadge(report: SelfTestReport): HTMLElement {
  const passed = report.cases.filter((c) => c.passed).length;
  const badge = h(
    'button',
    {
      class: `selftest ${report.passed ? 'ok' : 'fail'}`,
      title: 'Sourced inheritance fixtures, run against the engine on load',
      'aria-expanded': String(selfTestOpen),
      onclick: () => {
        selfTestOpen = !selfTestOpen;
        render();
      },
    },
    `Self-test ${report.passed ? '✓' : '✕'} ${passed}/${report.cases.length}`,
  );
  if (!selfTestOpen) return badge;
  const detail = h(
    'div',
    { class: 'selftest-detail', onclick: (e) => e.stopPropagation() },
    h(
      'ul',
      {},
      ...report.cases.map((c) =>
        h(
          'li',
          {},
          h('span', { class: c.passed ? 'pos' : 'neg' }, c.passed ? '✓ ' : '✕ '),
          `${c.id} ${c.label}`,
          ...c.mismatches.map((m) => h('div', { class: 'mm' }, m)),
        ),
      ),
    ),
  );
  return h('span', { class: 'selftest-wrap' }, badge, detail);
}

function rail(): HTMLElement {
  return h(
    'nav',
    { class: 'rail', 'aria-label': 'Children' },
    ...engine.children().map((c) =>
      h(
        'button',
        {
          class: `rail-item${c.id === selected ? ' on' : ''}`,
          disabled: c.pairingCount === 0,
          title: c.pairingCount === 0 ? 'Robin pairings are not enumerated yet' : undefined,
          onclick: () => {
            selected = c.id;
            render();
          },
        },
        h('span', {}, c.name),
        h('span', { class: 'muted' }, String(c.pairingCount)),
      ),
    ),
  );
}

function row(r: ChildResult): HTMLElement {
  const warn =
    r.assumptionsUsed.length > 0
      ? h('span', { class: 'warn', title: r.assumptionsUsed.map((a) => ASSUMPTION_NOTES[a]).join('\n') }, ' ⚠')
      : null;
  return h(
    'tr',
    { 'data-key': r.key },
    h('th', { class: 'stick', scope: 'row' }, engine.parentName(r.pairing.variableParent), warn),
    ...STATS.map((s, i) => h('td', { class: `num${i === 0 ? ' gstart' : ''}` }, String(r.growths[s]))),
    ...MOD_STATS.map((s, i) =>
      h('td', { class: `num gmod ${tone(r.modifiers[s])}${i === 0 ? ' gstart' : ''}` }, signed(r.modifiers[s])),
    ),
  );
}

function childTable(child: ChildId): HTMLElement {
  const summary = engine.children().find((c) => c.id === child)!;
  const results = engine.pairings(child);
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, summary.name),
    h('span', { class: 'muted' }, `Fixed parent: ${summary.fixedParentName} · ${results.length} pairings`),
  );
  if (results.length === 0) {
    return h('section', { class: 'main' }, head, h('p', { class: 'empty muted' }, 'No pairings enumerated yet.'));
  }
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
        h('th', { colspan: String(STATS.length), class: 'gstart', title: 'floor((father + mother + child) / 3), before class growths' }, 'Growths (personal)'),
        h('th', { colspan: String(MOD_STATS.length), class: 'gmod gstart', title: 'father + mother + 1' }, 'Max-stat modifiers'),
      ),
      h(
        'tr',
        {},
        h('th', { class: 'stick', scope: 'col' }, 'Variable parent'),
        ...STATS.map((s, i) => h('th', { class: `num${i === 0 ? ' gstart' : ''}`, scope: 'col' }, STAT_LABELS[s])),
        ...MOD_STATS.map((s, i) => h('th', { class: `num gmod${i === 0 ? ' gstart' : ''}`, scope: 'col' }, STAT_LABELS[s])),
      ),
    ),
    h('tbody', {}, ...results.map(row)),
  );
  return h('section', { class: 'main' }, head, h('div', { class: 'scroll' }, table));
}

function render(): void {
  const app = document.getElementById('app')!;
  app.replaceChildren(
    h(
      'div',
      { class: 'shell' },
      h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'FE13 Child Calc'), selfTestBadge(selfTest)),
      rail(),
      childTable(selected),
      h('aside', { class: 'panel', 'aria-label': 'Scoring' }, h('h3', {}, 'Scoring'), h('p', { class: 'muted' }, 'No scoring controls yet.')),
    ),
  );
}

render();
