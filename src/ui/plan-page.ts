import {
  DEFAULT_PRIORITY,
  PLAN_PRIORITIES,
  STAT_LABELS,
  adoptPlan,
  canPin,
  diffPlans,
  rosterUnits,
  unitName,
  withRuleOut,
  withSpouse,
  type ChildId,
  type Engine,
  type MarriagePlan,
  type PlanDiff,
  type PlanMarriage,
  type PlanSettings,
  type PlannedChild,
  type PresetId,
  type Roster,
  type RosterUnit,
} from '../engine';
import { h } from './dom';

/** What the Plan view reads, and how it changes the roster and the plan preferences. */
export type PlanPageContext = {
  readonly engine: Engine;
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  readonly settings: PlanSettings;
  /** Free re-plan: ignore the pins (view state). */
  readonly free: boolean;
  readonly setFree: (free: boolean) => void;
  readonly setPriority: (child: ChildId, priority: number) => void;
  readonly resetPlanPrefs: () => void;
  /** A preset's name, with `*` when the user edited it. */
  readonly presetLabel: (id: PresetId) => string;
};

const fmt = (n: number) => String(Math.round(n));
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

function childChip(ctx: PlanPageContext, c: PlannedChild, saved: ReadonlyMap<ChildId, PlannedChild> | undefined): HTMLElement {
  const was = saved?.get(c.child);
  const delta = was && c.score !== undefined && was.score !== undefined ? c.score - was.score : undefined;
  const title = [
    `${c.name} × ${c.parent}`,
    `Plan preset: ${ctx.presetLabel(c.preset)} · priority ${c.priority}`,
    was ? `Saved plan: ${was.name} × ${was.parent}, ${was.score ?? '—'}` : 'Not in the saved plan',
  ].join('\n');
  return h(
    'span',
    { class: `pchild${c.priority === 0 ? ' muted' : ''}`, title },
    h('span', {}, c.name),
    ' ',
    h('b', { class: 'num' }, c.score === undefined ? '—' : String(c.score)),
    delta ? h('span', { class: `small ${tone(delta)}` }, ` ${signed(delta)}`) : null,
    !was && saved ? h('span', { class: 'small pos' }, ' new') : null,
  );
}

function marriageRow(ctx: PlanPageContext, plan: MarriagePlan, m: PlanMarriage, saved: ReadonlyMap<ChildId, PlannedChild> | undefined): HTMLElement {
  const name = (u: RosterUnit) => unitName(u, plan.robin.gender);
  const pinned = m.bond === 'pinned';
  const locked = !canPin(ctx.roster, m);
  const actions =
    m.bond === 'married'
      ? []
      : [
          h(
            'button',
            {
              class: `mini${pinned ? ' on' : ''}`,
              'aria-pressed': String(pinned),
              disabled: locked,
              title: locked ? 'Set Robin’s gender to pin Robin’s marriage' : pinned ? 'Unpin: the solver may move them' : 'Pin: the solver keeps this marriage',
              onclick: () => ctx.setRoster(withSpouse(ctx.roster, m.husband, pinned ? null : m.wife, 'pinned')),
            },
            '📌',
          ),
          h(
            'button',
            {
              class: 'mini',
              disabled: locked,
              title: locked ? 'Set Robin’s gender to rule out Robin’s marriage' : 'Rule this marriage out of the plan',
              onclick: () => ctx.setRoster(withRuleOut(ctx.roster, m.husband, m.wife, true)),
            },
            '✕',
          ),
        ];
  return h(
    'tr',
    { class: m.bond ?? 'proposed' },
    h('td', { class: 'bond', title: m.bond === 'married' ? 'Married' : pinned ? 'Pinned' : 'Proposed by the solver' }, m.bond === 'married' ? '✓' : pinned ? '📌' : ''),
    h('td', { class: 'uname' }, name(m.husband)),
    h('td', { class: 'muted' }, '×'),
    h('td', { class: 'uname' }, name(m.wife)),
    h(
      'td',
      { class: 'children' },
      ...(m.children.length ? m.children.map((c) => childChip(ctx, c, saved)) : [h('span', { class: 'muted' }, 'no child can be born')]),
    ),
    h('td', { class: 'acts' }, ...actions),
  );
}

function diffBanner(ctx: PlanPageContext, plan: MarriagePlan, diff: PlanDiff | undefined): HTMLElement {
  const title = ctx.free
    ? 'Save this free re-plan and pin every marriage it proposes: pins it moves are replaced'
    : 'Save this plan and pin every marriage it proposes';
  const adoptButton = h('button', { class: 'adopt', title, onclick: () => ctx.setRoster(adoptPlan(ctx.roster, plan)) }, 'Adopt the new plan');
  if (!diff) return h('div', { class: 'banner' }, h('span', {}, 'No saved plan yet. '), adoptButton);
  if (diff.same) return h('div', { class: 'banner ok' }, '✓ Matches the saved plan.');
  const name = (u: RosterUnit | undefined) => (u ? unitName(u, plan.robin.gender) : '—');
  const change = diff.after - diff.before;
  return h(
    'div',
    { class: 'banner warn-b' },
    h('div', {}, h('b', {}, 'Changed vs saved plan'), ` Σ ${fmt(diff.before)} → ${fmt(diff.after)} `, h('span', { class: tone(change) }, `(${signed(change)})`)),
    diff.lost.length
      ? h('div', { class: 'neg' }, '✕ Children lost: ', diff.lost.map((c) => `${c.name} (${c.score ?? '—'})`).join(', '))
      : null,
    diff.gained.length ? h('div', { class: 'pos' }, '+ New children: ', diff.gained.map((c) => `${c.name} (${c.score ?? '—'})`).join(', ')) : null,
    diff.moves.length ? h('div', {}, '⇄ ', diff.moves.map((m) => `${name(m.unit)}: ${name(m.from)} → ${name(m.to)}`).join(' · ')) : null,
    diff.changes.length
      ? h(
          'div',
          {},
          'Scores: ',
          diff.changes
            .map((c) => {
              const who = c.before.key === c.after.key ? '' : ` (${c.before.parent} → ${c.after.parent})`;
              return `${c.after.name} ${c.before.score ?? '—'} → ${c.after.score ?? '—'}${who}`;
            })
            .join(' · '),
        )
      : null,
    adoptButton,
  );
}

export function planPage(ctx: PlanPageContext): HTMLElement[] {
  const { engine, roster, settings } = ctx;
  const t0 = performance.now();
  const plan = engine.plan(roster, settings, { free: ctx.free });
  const other = engine.plan(roster, settings, { free: !ctx.free });
  const before = roster.savedPlan ? engine.evaluatePlan(roster.savedPlan, roster.run, settings) : undefined;
  const ms = Math.round(performance.now() - t0);
  const diff = before && diffPlans(before, plan);
  const saved = before && new Map(before.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
  const [pinnedPlan, freePlan] = ctx.free ? [other, plan] : [plan, other];
  const pinCost = freePlan.total - pinnedPlan.total;
  const robinMarried = plan.marriages.some((m) => m.husband === 'robin' || m.wife === 'robin');
  const { gender, asset, flaw } = plan.robin;

  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, 'Marriage plan'),
    h('b', { class: 'num' }, `Σ ${fmt(plan.total)}`),
    h('span', { class: 'muted small' }, `priority × score · ${plan.marriages.length} marriages · solved in ${ms} ms`),
    h(
      'label',
      { class: 'small', title: 'Ignore the pins (not marriages) to see what keeping them costs' },
      h('input', { type: 'checkbox', checked: ctx.free, onchange: (e) => ctx.setFree((e.target as HTMLInputElement).checked) }),
      ' Free re-plan',
    ),
  );

  const notes: (HTMLElement | null)[] = [
    plan.robinOpen && robinMarried
      ? h('div', { class: 'muted' }, `Run facts leave Robin open: the solver picked Robin (${gender}) +${STAT_LABELS[asset]} −${STAT_LABELS[flaw]}.`)
      : null,
    plan.brokenPins.length
      ? h(
          'div',
          { class: 'banner hard' },
          '📌✕ Broken pins: ',
          plan.brokenPins.map((b) => `${unitName(b.couple[0], gender)} × ${unitName(b.couple[1], gender)} (${b.reason})`).join(' · '),
          ' — re-planned around them.',
        )
      : null,
    pinCost > 0.5
      ? h(
          'div',
          { class: 'muted' },
          ctx.free
            ? `Ignoring the pins gains Σ ${signed(pinCost)} over keeping them (${fmt(pinnedPlan.total)}).`
            : `Keeping the pins costs Σ ${fmt(pinCost)}: a free re-plan reaches ${fmt(freePlan.total)}.`,
        )
      : null,
    diffBanner(ctx, plan, diff),
  ];

  const table = h(
    'table',
    { class: 'grid plan' },
    h(
      'thead',
      {},
      h('tr', {}, h('th', {}), h('th', {}, 'Husband'), h('th', {}), h('th', {}, 'Wife'), h('th', {}, before ? 'Children (score, Δ vs saved)' : 'Children (score)'), h('th', {})),
    ),
    h('tbody', {}, ...plan.marriages.map((m) => marriageRow(ctx, plan, m, saved))),
  );

  const unborn = plan.unborn.length
    ? h('div', { class: 'muted' }, 'Not born in this plan: ', plan.unborn.map((c) => unitName(c)).join(', '))
    : null;
  const ruleOuts = roster.ruleOuts.length
    ? h(
        'div',
        { class: 'ruleouts' },
        h('span', { class: 'muted' }, 'Ruled out: '),
        ...roster.ruleOuts.map(([a, b]) =>
          h(
            'span',
            { class: 'chip' },
            `${unitName(a, gender)} × ${unitName(b, gender)} `,
            h('button', { class: 'mini', title: 'Rule back in', onclick: () => ctx.setRoster(withRuleOut(roster, a, b, false)) }, '↺'),
          ),
        ),
      )
    : null;

  return [head, h('div', { class: 'scroll plan-view' }, ...notes, table, unborn, ruleOuts)];
}

/** The Plan sidebar: each child's plan preset and priority. */
export function planSidebar(ctx: PlanPageContext): HTMLElement {
  const { engine, settings } = ctx;
  const children = rosterUnits(ctx.roster.run).filter((u) => u.kind === 'child');
  return h(
    'section',
    { class: 'plan-side', 'aria-label': 'Child priorities' },
    h('div', { class: 'panel-head' }, h('h3', {}, 'Plan'), h('button', { class: 'ghost small', title: 'Reset every child’s priority', onclick: ctx.resetPlanPrefs }, 'Reset plan preferences')),
    h('p', { class: 'muted small' }, 'Priority 0 = don’t care · 3 = must be great. Each child scores in its plan preset, in Auto class.'),
    ...children.map((u) => {
      const id = u.id as ChildId;
      const priority = settings.priorities[id] ?? DEFAULT_PRIORITY;
      const preset = engine.planPreset(id, settings);
      return h(
        'div',
        { class: 'prio' },
        h('span', { class: 'pname' }, u.name),
        h('span', { class: 'muted small ppreset', title: `Plan preset: ${ctx.presetLabel(preset)}` }, ctx.presetLabel(preset)),
        h(
          'span',
          { class: 'seg', role: 'group', 'aria-label': `${u.name}: priority` },
          ...PLAN_PRIORITIES.map((p) =>
            h('button', { class: p === priority ? 'on' : '', 'aria-pressed': String(p === priority), onclick: () => ctx.setPriority(id, p) }, String(p)),
          ),
        ),
      );
    }),
  );
}
