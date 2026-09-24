import {
  ASSUMPTION_REGISTRY,
  STATS,
  STAT_LABELS,
  isDefaultValue,
  type AssumptionDef,
  type AssumptionId,
  type AssumptionStatus,
  type Assumptions,
  type Citation,
  type Engine,
  type Growths,
  type SelfTestReport,
} from '../engine';
import { h } from './dom';
import { LABELS } from './labels';

/** What the validation panel reads, and how it changes the assumption overrides. */
export type ValidationContext = {
  readonly engine: Engine;
  readonly assumptions: Assumptions;
  readonly selfTest: SelfTestReport;
  /** Sets one override; undefined or the default value clears it. */
  readonly setOverride: (id: AssumptionId, value: unknown) => void;
  readonly resetAll: () => void;
  /** Re-renders, discarding an invalid edit. */
  readonly render: () => void;
};

function sourceLinks(sources: readonly Citation[]): HTMLElement {
  return h(
    'span',
    { class: 'sources' },
    ...sources.flatMap((s, i) => [i > 0 ? ' · ' : '', h('a', { href: s.url, target: '_blank', rel: 'noreferrer' }, s.label)]),
  );
}

function selfTestSection(report: SelfTestReport): HTMLElement {
  return h(
    'section',
    { class: 'vsec', 'aria-label': 'Self-test' },
    h('h3', {}, `Self-test ${report.passed ? '✓' : '✕'}`),
    h('p', { class: 'muted' }, 'Sourced inheritance and class-set fixtures, run against the engine on load and after every override.'),
    h(
      'ul',
      { class: 'selftest-list' },
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
}

/** The control that edits one assumption's value. Edits are validated by the registry's own `parse`. */
function assumptionControl(a: AssumptionStatus, ctx: ValidationContext): HTMLElement {
  const d = ASSUMPTION_REGISTRY[a.id] as AssumptionDef;
  const value: unknown = ctx.assumptions[a.id];
  const label = `Override ${d.label}`;
  const commit = (candidate: unknown) => {
    const parsed = d.parse(candidate);
    if (parsed === undefined) ctx.render();
    else ctx.setOverride(a.id, parsed);
  };
  switch (d.input) {
    case 'choice': {
      const options = [{ label: `${d.format(d.default as never)} (default)`, value: d.default }, ...d.alternatives];
      const current = options.findIndex((o) => JSON.stringify(o.value) === JSON.stringify(value));
      return h(
        'select',
        { 'aria-label': label, onchange: (e) => commit(options[Number((e.target as HTMLSelectElement).value)]?.value) },
        ...options.map((o, i) => h('option', { value: String(i), selected: i === current }, o.label)),
      );
    }
    case 'growths': {
      const g = value as Growths;
      return h(
        'span',
        { class: 'growth-inputs', role: 'group', 'aria-label': label },
        ...STATS.map((s) =>
          h(
            'label',
            {},
            h('span', { class: 'muted' }, STAT_LABELS[s]),
            h('input', {
              type: 'number',
              min: '0',
              max: '100',
              step: '5',
              value: String(g[s]),
              'aria-label': `${d.label} ${STAT_LABELS[s]}`,
              onchange: (e) => commit({ ...g, [s]: Number((e.target as HTMLInputElement).value) }),
            }),
          ),
        ),
      );
    }
    case 'cap':
      return h(
        'label',
        { class: 'cap-input' },
        '± ',
        h('input', {
          type: 'number',
          min: '0',
          max: '20',
          placeholder: 'none',
          value: value === null ? '' : String(value),
          'aria-label': label,
          onchange: (e) => {
            const raw = (e.target as HTMLInputElement).value.trim();
            commit(raw === '' ? null : Number(raw));
          },
        }),
      );
    case 'list':
      return h('input', {
        type: 'text',
        class: 'list-input',
        value: (value as readonly number[]).join('/'),
        placeholder: 'e.g. 55/60/66',
        title: 'Ascending whole numbers, separated by / or commas',
        'aria-label': label,
        onchange: (e) => {
          const parts = (e.target as HTMLInputElement).value.split(/[\s,/]+/).filter(Boolean);
          commit(parts.map(Number));
        },
      });
  }
}

function assumptionsSection(ctx: ValidationContext): HTMLElement {
  const statuses = ctx.engine.assumptions();
  return h(
    'section',
    { class: 'vsec', 'aria-label': 'Assumptions' },
    h(
      'h3',
      {},
      'Assumptions ',
      statuses.some((a) => !a.isDefault) ? h('button', { class: 'reset', onclick: ctx.resetAll }, '↺ Reset all to defaults') : null,
    ),
    h('p', { class: 'muted' }, 'Values the sources couldn’t verify. Overriding one recomputes every pairing and is saved in this browser.'),
    ...statuses.map((a) =>
      h(
        'article',
        { class: `assumption${a.isDefault ? '' : ' overridden'}`, 'data-assumption': a.id },
        h(
          'div',
          {},
          h('strong', {}, a.label),
          h(
            'span',
            { class: 'muted' },
            a.affects
              ? ` · affects ${a.affects} ⚠`
              : ` · ${a.pairingsAffected} ${a.pairingsAffected === 1 ? 'pairing' : 'pairings'} ⚠`,
          ),
        ),
        h(
          'div',
          {},
          'Current: ',
          h('b', {}, a.current),
          a.isDefault ? h('span', { class: 'muted' }, ' (default)') : h('span', { class: 'warn' }, ` · overridden, default ${a.default}`),
        ),
        h(
          'div',
          { class: 'a-control' },
          assumptionControl(a, ctx),
          a.isDefault ? null : h('button', { class: 'reset', onclick: () => ctx.setOverride(a.id, undefined) }, '↺ Reset'),
        ),
        h('p', { class: 'a-why' }, a.why),
        h('div', { class: 'muted' }, 'Sources: ', sourceLinks(a.sources)),
      ),
    ),
  );
}

function disagreementsSection(engine: Engine): HTMLElement {
  return h(
    'section',
    { class: 'vsec', 'aria-label': 'Resolved source disagreements' },
    h('h3', {}, 'Resolved source disagreements'),
    h(
      'table',
      { class: 'dtable' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Used'), h('th', {}, 'Rejected'), h('th', {}, 'Why'))),
      h(
        'tbody',
        {},
        ...engine.disagreements().map((d) =>
          h(
            'tr',
            { 'data-disagreement': d.id },
            h('th', { scope: 'row' }, h('span', { class: 'muted' }, `${d.id} `), d.item),
            h('td', {}, h('div', { class: 'pos' }, d.winning.value), sourceLinks(d.winning.sources)),
            h('td', {}, ...d.losing.map((l) => h('div', {}, h('div', { class: 'neg' }, l.value), sourceLinks(l.sources)))),
            h('td', { class: 'muted' }, d.why),
          ),
        ),
      ),
    ),
  );
}

/** Assumptions (with override controls), resolved source disagreements and the self-test. */
export function validationPanel(ctx: ValidationContext): HTMLElement {
  return h(
    'section',
    { class: 'main' },
    h('div', { class: 'main-head' }, h('h2', {}, LABELS.validation)),
    h('div', { class: 'scroll vpanel' }, selfTestSection(ctx.selfTest), assumptionsSection(ctx), disagreementsSection(ctx.engine)),
  );
}

/** The next overrides after setting one: a value equal to the default (or undefined) removes the override. */
export function withOverride(overrides: Readonly<Record<string, unknown>>, id: AssumptionId, value: unknown): Record<string, unknown> {
  const next = { ...overrides };
  if (value === undefined || isDefaultValue(id, value)) delete next[id];
  else next[id] = value;
  return next;
}
