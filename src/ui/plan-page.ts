import {
  DEFAULT_PRIORITY,
  PLAN_PRIORITIES,
  STAT_LABELS,
  DEPLOYMENT_ROLES,
  adoptPlan,
  canPin,
  composition,
  diffPlans,
  deploymentRoleOf,
  rosterUnits,
  unitName,
  withRuleOut,
  withSpouse,
  type ChildId,
  type Composition,
  type DeploymentRole,
  type Engine,
  type MarriagePlan,
  type PinLoss,
  type PlanDiff,
  type PlanMarriage,
  type PlanSettings,
  type PlannedChild,
  type PresetId,
  type Quotas,
  type Roster,
  type RosterUnit,
} from '../engine';
import { h } from './dom';
import { LABELS, PIN_LOSS_UI, ROLE_UI } from './labels';
import { editQuota } from './plan-prefs';

/** A child's plan controls (priority, plan preset), shared by the Plan sidebar and the Roster page's ledger. */
export type ChildPlanControls = {
  readonly engine: Engine;
  readonly settings: PlanSettings;
  readonly setPriority: (child: ChildId, priority: number) => void;
  /** Sets a child's plan preset; null resets it to the default. */
  readonly setPlanPreset: (child: ChildId, preset: PresetId | null) => void;
  /** A preset's name, with `*` when the user edited it. */
  readonly presetLabel: (id: PresetId) => string;
  /** The play context's composition quotas (the user's, else the curated seed). */
  readonly quotas: Quotas;
  /** Children whose plan preset Suggest roles picked. */
  readonly suggested: ReadonlySet<ChildId>;
};

/** What the Plan view reads, and how it changes the roster and the plan preferences. */
export type PlanPageContext = ChildPlanControls & {
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  /** Free re-plan: ignore the pins (view state). */
  readonly free: boolean;
  readonly setFree: (free: boolean) => void;
  readonly resetPlanPrefs: () => void;
  /** Rewrites the plan preset of every child on its default (or on an earlier suggestion) to meet the quotas. */
  readonly suggestRoles: () => void;
  /** The user edited this play context's quotas. */
  readonly quotasEdited: boolean;
  /** Sets this play context's quotas; null resets them to the curated seed. */
  readonly setQuotas: (quotas: Quotas | null) => void;
  /** The quota editor is open (view state). */
  readonly editingQuotas: boolean;
  readonly setEditingQuotas: (open: boolean) => void;
};

const QUOTA_HINT = { ok: 'In range', under: 'Below the minimum', over: 'Over the maximum' } as const;

const BENCH_HINT = 'Every planned child counts as deployed, whatever its priority. Set the children you won’t field to ⏸ Benched (Roster › Children): they stay planned but aren’t counted.';

/**
 * `Lead n / min–max · … · Deployed n / cap`: green in range, amber below min, red over max or over the cap. Never blocks.
 * When red and planned children are counted, says that benching is how to leave one out.
 */
export function compositionStrip(c: Composition): HTMLElement {
  const parts = c.roles.map((r) =>
    h(
      'span',
      { class: `q q-${r.status}`, title: `${ROLE_UI[r.role].label}: ${QUOTA_HINT[r.status]} (${r.min}–${r.max})` },
      `${ROLE_UI[r.role].label} ${r.count} / ${r.min === r.max ? r.min : `${r.min}–${r.max}`}`,
    ),
  );
  const d = c.deployed;
  const showBenchHint = d.children > 0 && (d.status === 'over' || c.roles.some((r) => r.status === 'over'));
  const deployed = h(
    'span',
    {
      class: `q q-${d.status}`,
      title: `${d.status === 'over' ? 'Over the deploy cap' : 'Within the deploy cap'}: ${d.count - d.children} first-gen + ${d.children} planned children.${showBenchHint ? ` ${BENCH_HINT}` : ''}`,
    },
    `Deployed ${d.count} / ${d.cap}`,
  );
  return h(
    'div',
    { class: 'comp-strip', 'aria-label': 'Deployment composition' },
    ...[...parts, deployed].flatMap((p, i) => (i ? [h('span', { class: 'muted' }, ' · '), p] : [p])),
    showBenchHint ? h('p', { class: 'comp-note muted small' }, BENCH_HINT) : null,
  );
}

/** A child's deployment role, from its plan preset: read-only. */
export function roleChip(ctl: ChildPlanControls, id: ChildId): HTMLElement {
  const role = deploymentRoleOf(ctl.engine.planPreset(id, ctl.settings));
  return h('span', { class: `chip role role-${role}`, title: `Deployment role: ${ROLE_UI[role].label} (from its plan preset)` }, ROLE_UI[role].short);
}

/** The composition quotas for the play context: min–max per role and the deploy cap. */
function quotaEditor(ctx: PlanPageContext): HTMLElement {
  const q = ctx.quotas;
  const num = (label: string, value: number, set: (n: number) => void) =>
    h('input', {
      type: 'number',
      min: '0',
      max: '99',
      value: String(value),
      'aria-label': label,
      onchange: (e: Event) => set(Number((e.target as HTMLInputElement).value)),
    });
  return h(
    'div',
    { class: 'quota-edit' },
    ...DEPLOYMENT_ROLES.map((role) => {
      const { label } = ROLE_UI[role];
      const r = q.roles[role];
      return h(
        'label',
        {},
        h('span', {}, label),
        num(`${label} minimum`, r.min, (n) => ctx.setQuotas(editQuota(q, role, n, 'min'))),
        '–',
        num(`${label} maximum`, r.max, (n) => ctx.setQuotas(editQuota(q, role, n, 'max'))),
      );
    }),
    h('label', {}, h('span', {}, 'Deploy cap'), num('Deploy cap', q.cap, (n) => ctx.setQuotas(editQuota(q, 'cap', n)))),
    h(
      'button',
      { class: 'ghost small', disabled: !ctx.quotasEdited, title: 'Back to the curated quotas for this play context', onclick: () => ctx.setQuotas(null) },
      '↺ Curated quotas',
    ),
  );
}

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
            LABELS.pin,
          ),
          h(
            'button',
            {
              class: 'mini',
              disabled: locked,
              'aria-label': LABELS.ruleOutHint,
              title: locked ? 'Set Robin’s gender to rule out Robin’s marriage' : LABELS.ruleOutHint,
              onclick: () => ctx.setRoster(withRuleOut(ctx.roster, m.husband, m.wife, true)),
            },
            LABELS.ruleOut,
          ),
        ];
  return h(
    'tr',
    { class: m.bond ?? 'proposed' },
    h('td', { class: 'bond', title: m.bond === 'married' ? LABELS.married : pinned ? LABELS.pinned : 'Proposed by the solver' }, m.bond === 'married' ? '✓' : pinned ? LABELS.pin : ''),
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
  const adoptButton = h('button', { class: 'adopt', title, onclick: () => ctx.setRoster(adoptPlan(ctx.roster, plan)) }, LABELS.adoptPlan);
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
    diff.roleMoves.length
      ? h('div', {}, 'Roles: ', diff.roleMoves.map((m) => `${m.name}: ${ROLE_UI[m.from].label} → ${ROLE_UI[m.to].label}`).join(' · '))
      : null,
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

/** 📌 Broken pins (red: gone for good) or 📌 Pins on hold (amber: back on un-bench), each re-planned around. */
function lostPinsBanner(plan: MarriagePlan, status: PinLoss['status']): HTMLElement | null {
  const pins = plan.lostPins.filter((p) => p.status === status);
  if (!pins.length) return null;
  const ui = PIN_LOSS_UI[status];
  return h(
    'div',
    { class: `banner pin-${status}`, title: ui.hint },
    `${ui.banner}: `,
    pins.map((p) => `${unitName(p.couple[0], plan.robin.gender)} × ${unitName(p.couple[1], plan.robin.gender)} (${p.reason})`).join(' · '),
    status === 'broken' ? ' — re-planned around them.' : ' — re-planned around them until un-benched.',
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
      ` ${LABELS.freeReplan}`,
    ),
  );

  const notes: (HTMLElement | null)[] = [
    plan.robinOpen && robinMarried
      ? h('div', { class: 'muted' }, `Run facts leave Robin open: the solver picked Robin (${gender}) +${STAT_LABELS[asset]} −${STAT_LABELS[flaw]}.`)
      : null,
    lostPinsBanner(plan, 'broken'),
    lostPinsBanner(plan, 'on-hold'),
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
        h('span', { class: 'muted' }, `${LABELS.ruledOut}: `),
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

/** A child's priority, 0–3. */
export function priorityControl(ctl: ChildPlanControls, id: ChildId, name: string): HTMLElement {
  const priority = ctl.settings.priorities[id] ?? DEFAULT_PRIORITY;
  return h(
    'span',
    { class: 'seg', role: 'group', 'aria-label': `${name}: priority` },
    ...PLAN_PRIORITIES.map((p) =>
      h('button', { class: p === priority ? 'on' : '', 'aria-pressed': String(p === priority), onclick: () => ctl.setPriority(id, p) }, String(p)),
    ),
  );
}

/** A child's plan preset: "default (X)" or the user's, which holds in every play context; ↺ resets it. */
export function presetControl(ctl: ChildPlanControls, id: ChildId, name: string): HTMLElement {
  const { engine, settings } = ctl;
  const own = settings.overrides[id];
  const fallback = engine.defaultPlanPreset(id, settings);
  return h(
    'span',
    { class: 'ppreset' },
    h(
      'select',
      {
        'aria-label': `${name}: plan preset`,
        title: own ? `Set: ${ctl.presetLabel(own)} in every play context (default ${ctl.presetLabel(fallback)})` : 'Follows the play context',
        onchange: (e) => ctl.setPlanPreset(id, ((e.target as HTMLSelectElement).value || null) as PresetId | null),
      },
      h('option', { value: '', selected: !own }, `default (${ctl.presetLabel(fallback)})`),
      ...engine.presets().map((p) => h('option', { value: p.id, selected: p.id === own }, ctl.presetLabel(p.id))),
    ),
    own
      ? ctl.suggested.has(id)
        ? h('span', { class: 'chip suggested', title: 'Picked by Suggest roles: the next run may change it; ↺ resets it' }, 'suggested')
        : h('span', { class: 'chip set', title: 'Set by you: holds in every play context' }, 'set')
      : null,
    h('button', { class: 'mini', disabled: !own, title: own ? 'Reset to the default' : 'On the default', onclick: () => ctl.setPlanPreset(id, null) }, '↺'),
  );
}

/** The Plan sidebar: the composition strip, then each child's priority, plan preset and deployment role. */
export function planSidebar(ctx: PlanPageContext): HTMLElement {
  const children = rosterUnits(ctx.roster.run).filter((u) => u.kind === 'child');
  const comp = composition(ctx.roster, ctx.engine.plan(ctx.roster, ctx.settings, { free: ctx.free }), ctx.quotas);
  return h(
    'section',
    { class: 'plan-side', 'aria-label': 'Child priorities and plan presets' },
    h(
      'div',
      { class: 'panel-head' },
      h('h3', {}, 'Plan'),
      h(
        'button',
        { class: 'ghost small', title: 'Reset every child’s priority and plan preset, and the quotas of every play context', onclick: ctx.resetPlanPrefs },
        'Reset plan preferences',
      ),
    ),
    h(
      'div',
      { class: 'comp' },
      compositionStrip(comp),
      h(
        'button',
        {
          class: `mini${ctx.editingQuotas ? ' on' : ''}`,
          'aria-pressed': String(ctx.editingQuotas),
          title: ctx.quotasEdited ? 'Edit the quotas (edited for this play context)' : 'Edit the quotas for this play context',
          onclick: () => ctx.setEditingQuotas(!ctx.editingQuotas),
        },
        ctx.quotasEdited ? '✎*' : '✎',
      ),
      h(
        'button',
        {
          class: 'ghost small',
          title: 'Pick a plan preset for every child on its default so the army meets the quotas, then re-plan. Your own presets stay.',
          onclick: ctx.suggestRoles,
        },
        LABELS.suggestRoles,
      ),
    ),
    ctx.editingQuotas ? quotaEditor(ctx) : null,
    h('p', { class: 'muted small' }, 'Priority 0 = don’t care · 3 = must be great. Each child scores in its plan preset, in Auto class.'),
    ...children.map((u) => {
      const id = u.id as ChildId;
      return h(
        'div',
        { class: 'prio' },
        h('span', { class: 'pname' }, u.name, ' ', roleChip(ctx, id)),
        priorityControl(ctx, id, u.name),
        presetControl(ctx, id, u.name),
      );
    }),
  );
}
