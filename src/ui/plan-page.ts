import {
  DEFAULT_PRIORITY,
  PLAN_PRIORITIES,
  STAT_LABELS,
  CANDIDATE_PRESETS,
  CHILD_DEPLOYMENT_ROLES,
  DEPLOYMENT_ROLES,
  adoptPlan,
  canPin,
  composition,
  diffPlans,
  deploymentRoleOf,
  lockRobin,
  rosterUnits,
  unitName,
  withRuleOut,
  withSpouse,
  type ChildDeploymentRole,
  type ChildId,
  type Composition,
  type Derivation,
  type DeploymentRole,
  type Engine,
  type LeftOut,
  type MarriagePlan,
  type PinLoss,
  type PlanDiff,
  type PlanMarriage,
  type PlanSettings,
  type PlannedChild,
  type PresetId,
  type RobinGainSide,
  type RoleAssignment,
  type RoleSource,
  type Quotas,
  type Roster,
  type RosterUnit,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { LABELS, LEFT_OUT_UI, NOT_BORN_UI, PIN_LOSS_UI, ROLE_UI } from './labels';
import { editQuota } from './plan-prefs';
import { unitLink, type OpenUnit } from './unit-links';
import { shownDelta, shownTotal } from './plan-totals';

/** A child's plan controls (priority, plan preset), shared by the Plan sidebar and the Roster page's ledger. */
export type ChildPlanControls = {
  readonly engine: Engine;
  readonly settings: PlanSettings;
  readonly setPriority: (child: ChildId, priority: number) => void;
  /** Sets a child's preset override; null returns it to derived. */
  readonly setPlanPreset: (child: ChildId, preset: PresetId | null) => void;
  /** Sets a child's role override; null returns it to derived. */
  readonly setRoleOverride: (child: ChildId, role: ChildDeploymentRole | null) => void;
  /** Opens the Plan's role matrix, where roles and presets are set. */
  readonly openRoles: () => void;
  /** Opens the Run facts, where Robin is set. */
  readonly openRunFacts: () => void;
  /** Opens a unit's page, Robin's or a child's front door (#107). */
  readonly openUnit: OpenUnit;
  /** A preset's name, with `*` when the user edited it. */
  readonly presetLabel: (id: PresetId) => string;
  /** The play context's composition quotas (the user's, else the curated seed). */
  readonly quotas: Quotas;
  /** The roster the plan is solved for: army fit reads it. */
  readonly roster: Roster;
};

/** What the Plan view reads, and how it changes the roster and the plan preferences. */
export type PlanPageContext = ChildPlanControls & {
  readonly setRoster: (next: Roster) => void;
  /** Free re-plan: ignore the pins (view state). */
  readonly free: boolean;
  readonly setFree: (free: boolean) => void;
  readonly resetPlanPrefs: () => void;
  /** The user edited this play context's quotas. */
  readonly quotasEdited: boolean;
  /** Sets this play context's quotas; null resets them to the curated seed. */
  readonly setQuotas: (quotas: Quotas | null) => void;
  /** The quota editor is open (view state). */
  readonly editingQuotas: boolean;
  readonly setEditingQuotas: (open: boolean) => void;
  /** Opens the child's pairing table, scored with its plan preset for that visit, with this pairing highlighted. */
  readonly openChild: (child: PlannedChild) => void;
  /** Turns the no-Robin view on or off (view state; it lives in the plan settings). */
  readonly setNoRobin: (on: boolean) => void;
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
  const a = ctl.engine.roles(ctl.roster, ctl.settings).get(id);
  const role = a?.role ?? deploymentRoleOf(ctl.engine.planPreset(id, ctl.roster, ctl.settings));
  const from = a ? (a.source === 'army fit' ? `moved by army fit: ${a.reason}` : a.source) : 'the global preset';
  return h('span', { class: `chip role role-${role}`, title: `Deployment role: ${ROLE_UI[role].label} (${from})` }, ROLE_UI[role].short);
}

const OUT_OF_CAST = { dead: 'dead', unborn: 'can’t be born', 'needs-robin': 'needs Robin', 'no-robin': 'out: no-Robin view' } as const;

/** The child's derived best role and role preset (#95), read-only: where it stands against the cast. */
function derivedLine(ctl: ChildPlanControls, d: Derivation, id: ChildId): HTMLElement {
  const out = d.leftOut.get(id);
  if (out) return h('span', { class: 'derived muted small' }, `Best role: — (${OUT_OF_CAST[out]})`);
  const r = d.roles.find((x) => x.child === id)!;
  const preset = r.rolePreset[r.bestRole];
  return h(
    'span',
    {
      class: 'derived muted small',
      title: `Standing ${Math.round(r.roleStanding[r.bestRole] * 100)} of 100 against the cast, on its best pairing that can still happen`,
    },
    `Best role: ${ROLE_UI[r.bestRole].label} · ${ctl.presetLabel(preset)}`,
  );
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

const fmt = (n: number) => String(shownTotal(n));
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

function childChip(ctx: PlanPageContext, c: PlannedChild, saved: ReadonlyMap<ChildId, PlannedChild> | undefined): HTMLElement {
  const was = saved?.get(c.child);
  const delta = was && c.score !== undefined && was.score !== undefined ? c.score - was.score : undefined;
  const title = [
    `${c.name} × ${c.parent}`,
    `Plan preset: ${ctx.presetLabel(c.preset)} · priority ${c.priority}`,
    was ? `Saved plan: ${was.name} × ${was.parent}, ${was.score ?? '—'}` : 'Not in the saved plan',
    ...c.notes,
    `Open ${c.name}’s pairings scored with ${ctx.presetLabel(c.preset)}`,
  ].join('\n');
  return h(
    'button',
    { class: `pchild${c.priority === 0 ? ' muted' : ''}`, title, onclick: () => ctx.openChild(c) },
    h('span', {}, c.name),
    c.notes.length ? h('span', { class: 'warn', 'aria-label': c.notes.join('. ') }, ' ⚠') : null,
    ' ',
    h('b', { class: 'num' }, c.score === undefined ? '—' : String(c.score)),
    delta ? h('span', { class: `small ${tone(delta)}` }, ` ${signed(delta)}`) : null,
    !was && saved ? h('span', { class: 'small pos' }, ' new') : null,
  );
}

function marriageRow(ctx: PlanPageContext, plan: MarriagePlan, m: PlanMarriage, saved: ReadonlyMap<ChildId, PlannedChild> | undefined): HTMLElement {
  const spouse = (u: RosterUnit) => unitLink(ctx.openUnit, u, unitName(u, plan.robin.gender), u === 'robin' ? plan.robin : undefined);
  const pinned = m.bond === 'pinned';
  const locked = !canPin(ctx.roster, m);
  const actions =
    m.bond === 'married'
      ? []
      : [
          h(
            'button',
            {
              ...guide('pin'),
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
              ...guide('rule-out'),
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
    h('td', { class: 'uname' }, spouse(m.husband)),
    h('td', { class: 'muted' }, '×'),
    h('td', { class: 'uname' }, spouse(m.wife)),
    h(
      'td',
      { class: 'children' },
      ...(m.children.length
        ? m.children.map((c) =>
            h(
              'span',
              { class: 'pchild-wrap' },
              childChip(ctx, c, saved),
              h('button', { class: 'unit-link about', title: `${c.name}’s front door`, onclick: () => ctx.openUnit(c.child) }, 'about'),
            ),
          )
        : [h('span', { class: 'muted' }, 'no child can be born')]),
    ),
    h('td', { class: 'acts' }, ...actions),
  );
}

function diffBanner(ctx: PlanPageContext, plan: MarriagePlan, diff: PlanDiff | undefined): HTMLElement {
  const title = ctx.free
    ? 'Save this free re-plan and pin every marriage it proposes: pins it moves are replaced'
    : 'Save this plan and pin every marriage it proposes';
  const adoptButton = h('button', { ...guide('adopt'), class: 'adopt', title, onclick: () => ctx.setRoster(adoptPlan(ctx.roster, plan)) }, LABELS.adoptPlan);
  if (!diff) return h('div', { class: 'banner' }, h('span', {}, 'No saved plan yet. '), adoptButton);
  if (diff.same) return h('div', { ...guide('plan-diff'), class: 'banner ok' }, '✓ Matches the saved plan.');
  const name = (u: RosterUnit | undefined) => (u ? unitName(u, plan.robin.gender) : '—');
  const change = shownDelta(diff.before, diff.after);
  return h(
    'div',
    { ...guide('plan-diff'), class: 'banner warn-b' },
    h('div', {}, h('b', {}, LABELS.changedVsSaved), ` ${LABELS.total} ${fmt(diff.before)} → ${fmt(diff.after)} `, h('span', { class: tone(change) }, `(${signed(change)})`)),
    diff.unborn.length
      ? h('div', { class: 'neg' }, `${NOT_BORN_UI.unborn}: `, diff.unborn.map((c) => `${c.name} (${c.score ?? '—'})`).join(', '))
      : null,
    leftOutLine(diff.leftOut, true),
    diff.gained.length ? h('div', { class: 'pos' }, '+ New children: ', diff.gained.map((c) => `${c.name} (${c.score ?? '—'})`).join(', ')) : null,
    diff.moves.length ? h('div', {}, `${LABELS.swap} `, diff.moves.map((m) => `${name(m.unit)}: ${name(m.from)} → ${name(m.to)}`).join(' · ')) : null,
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

/** Left out by this plan (amber): each child with its reason, and the fix on hover; with its saved score in the diff. */
function leftOutLine(children: readonly LeftOut[], withScore: boolean): HTMLElement | null {
  if (!children.length) return null;
  const entry = (c: LeftOut) => {
    const ui = LEFT_OUT_UI[c.reason];
    return h('span', { class: 'why', title: ui.hint }, `${c.name} (${withScore ? `${c.score ?? '—'} · ` : ''}${ui.label})`);
  };
  return h('div', { class: 'left-out' }, `${NOT_BORN_UI.leftOut}: `, ...children.flatMap((c, i) => [i ? ', ' : '', entry(c)]));
}

/** 📌 Broken pins (red: gone for good) or 📌 Pins on hold (amber: back on un-bench), each re-planned around. */
function lostPinsBanner(plan: MarriagePlan, status: PinLoss['status']): HTMLElement | null {
  const pins = plan.lostPins.filter((p) => p.status === status);
  if (!pins.length) return null;
  const ui = PIN_LOSS_UI[status];
  return h(
    'div',
    { ...(status === 'broken' ? guide('broken-pins') : {}), class: `banner pin-${status}`, title: ui.hint },
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
  const before = roster.savedPlan ? engine.evaluatePlan(roster.savedPlan, roster, settings) : undefined;
  const ms = Math.round(performance.now() - t0);
  const diff = before && diffPlans(before, plan);
  const saved = before && new Map(before.marriages.flatMap((m) => m.children.map((c) => [c.child, c] as const)));
  const [pinnedPlan, freePlan] = ctx.free ? [other, plan] : [plan, other];
  const pinCost = shownDelta(pinnedPlan.total, freePlan.total);
  const robinMarried = plan.marriages.some((m) => m.husband === 'robin' || m.wife === 'robin');
  const { gender, asset, flaw } = plan.robin;

  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, 'Marriage plan'),
    h('b', { class: 'num' }, `${LABELS.total} ${fmt(plan.total)}`),
    h('span', { class: 'muted small' }, `priority × score · ${plan.marriages.length} marriages · solved in ${ms} ms`),
    h(
      'label',
      { ...guide('free-replan'), class: 'small', title: 'Ignore the pins (not marriages) to see what keeping them costs' },
      h('input', { type: 'checkbox', checked: ctx.free, onchange: (e) => ctx.setFree((e.target as HTMLInputElement).checked) }),
      ` ${LABELS.freeReplan}`,
    ),
  );

  const notes: (HTMLElement | null)[] = [
    plan.robinOpen
      ? h(
          'div',
          { class: 'muted robin-pick' },
          `Run facts leave Robin open: the solver picked Robin (${gender}) +${STAT_LABELS[asset]} −${STAT_LABELS[flaw]}. `,
          h(
            'button',
            {
              ...guide('robin-lock'),
              class: 'lock',
              title: robinMarried
                ? 'Set the open Run facts to this Robin, and pin Robin’s marriage'
                : 'Set the open Run facts to this Robin (the plan doesn’t marry Robin, so nothing is pinned)',
              onclick: () => ctx.setRoster(lockRobin(roster, plan)),
            },
            LABELS.lock,
          ),
        )
      : null,
    lostPinsBanner(plan, 'broken'),
    lostPinsBanner(plan, 'on-hold'),
    pinCost > 0
      ? h(
          'div',
          { class: 'muted' },
          ctx.free
            ? `Ignoring the pins gains ${LABELS.total} ${signed(pinCost)} over keeping them (${fmt(pinnedPlan.total)}).`
            : `Keeping the pins costs ${LABELS.total} ${fmt(pinCost)}: a free re-plan reaches ${fmt(freePlan.total)}.`,
        )
      : null,
    diffBanner(ctx, plan, diff),
  ];

  const table = h(
    'table',
    { ...guide('marriage-table'), class: 'grid plan' },
    h(
      'thead',
      {},
      h('tr', {}, h('th', {}), h('th', {}, 'Husband'), h('th', {}), h('th', {}, 'Wife'), h('th', {}, before ? 'Children (score, Δ vs saved)' : 'Children (score)'), h('th', {})),
    ),
    h('tbody', {}, ...plan.marriages.map((m) => marriageRow(ctx, plan, m, saved))),
  );

  const notBorn =
    plan.unborn.length || plan.leftOut.length
      ? h(
          'div',
          { class: 'not-born' },
          h('div', { class: 'muted' }, 'Not born in this plan:'),
          plan.unborn.length ? h('div', { class: 'neg' }, `${NOT_BORN_UI.unborn}: `, plan.unborn.map((c) => unitName(c)).join(', ')) : null,
          leftOutLine(plan.leftOut, false),
        )
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

  return [head, h('div', { class: 'scroll plan-view' }, ...notes, table, notBorn, ruleOuts, roleMatrix(ctx))];
}

/** A child's priority, 0–3. */
export function priorityControl(ctl: ChildPlanControls, id: ChildId, name: string): HTMLElement {
  const priority = ctl.settings.priorities[id] ?? DEFAULT_PRIORITY;
  return h(
    'span',
    { ...guide('priority'), class: 'seg', role: 'group', 'aria-label': `${name}: priority` },
    ...PLAN_PRIORITIES.map((p) =>
      h('button', { class: p === priority ? 'on' : '', 'aria-pressed': String(p === priority), onclick: () => ctl.setPriority(id, p) }, String(p)),
    ),
  );
}

/** Staffbot scores as Lead but deploys as Staff/Rally (#71): it sits with Staff/Rally, override only. */
const OVERRIDE_ONLY: readonly PresetId[] = ['staffbot'];

/**
 * A child's preset override: "derived (X)" — its role preset, where army fit may have moved it — or any preset the
 * user pins, candidates by role and niche presets last; ↺ returns it to derived.
 */
export function presetControl(ctl: ChildPlanControls, id: ChildId, name: string, fallback: PresetId): HTMLElement {
  const { engine, settings } = ctl;
  const own = settings.overrides[id];
  const candidates = new Set<PresetId>(CHILD_DEPLOYMENT_ROLES.flatMap((r) => CANDIDATE_PRESETS[r]));
  const opt = (p: PresetId) => h('option', { value: p, selected: p === own }, ctl.presetLabel(p));
  return h(
    'span',
    { class: 'ppreset' },
    h(
      'select',
      {
        ...guide('plan-preset'),
        'aria-label': `${name}: preset override`,
        title: own
          ? `Pinned: ${ctl.presetLabel(own)} in every play context (derived ${ctl.presetLabel(fallback)})`
          : 'Derived from where it stands against the cast',
        onchange: (e) => ctl.setPlanPreset(id, ((e.target as HTMLSelectElement).value || null) as PresetId | null),
      },
      h('option', { value: '', selected: !own }, `derived (${ctl.presetLabel(fallback)})`),
      ...CHILD_DEPLOYMENT_ROLES.map((r) =>
        h('optgroup', { label: ROLE_UI[r].label }, ...[...CANDIDATE_PRESETS[r], ...(r === 'staff' ? OVERRIDE_ONLY : [])].map(opt)),
      ),
      h(
        'optgroup',
        { label: 'Niche (override only)' },
        ...engine
          .presets()
          .map((p) => p.id)
          .filter((p) => !candidates.has(p) && !OVERRIDE_ONLY.includes(p))
          .map(opt),
      ),
    ),
    h(
      'button',
      { ...guide('plan-preset-reset'), class: 'mini', disabled: !own, title: own ? 'Back to derived' : 'Derived', onclick: () => ctl.setPlanPreset(id, null) },
      '↺',
    ),
  );
}

const SOURCE_UI: Readonly<Record<RoleSource, { readonly label: string; readonly cls: string }>> = {
  derived: { label: 'derived', cls: 'derived' },
  'army fit': { label: 'army fit', cls: 'fit' },
  'role override': { label: 'role pinned', cls: 'pinned' },
  'preset override': { label: 'preset pinned', cls: 'pinned' },
};

/** Where a child's plan preset comes from, as a chip; army fit's says which quota moved it. */
export function sourceChip(a: RoleAssignment | undefined): HTMLElement {
  if (!a) return h('span', { class: 'chip src', title: 'Out of the cast: the global preset' }, 'global');
  const ui = SOURCE_UI[a.source];
  return h('span', { class: `chip src ${ui.cls}`, title: a.reason ? `Moved by army fit: ${a.reason}` : ui.label }, ui.label);
}

/**
 * The role matrix (#97): a row per child, a column per deployment role. Each cell is the child's standing there, with
 * its role preset; tags mark its best role, army fit's move and a pinned role. Clicking a cell pins that role (again
 * unpins it); the row's menu pins a preset.
 */
function roleMatrix(ctx: PlanPageContext): HTMLElement {
  const { engine, roster, settings } = ctx;
  const derivation = engine.deriveRoles(roster, settings);
  const derived = new Map(derivation.roles.map((r) => [r.child, r]));
  const roles = engine.roles(roster, settings);
  // What each child would get without preset overrides: the "derived (X)" option. Asked once, not per row, as the
  // engine caches one settings at a time.
  const unpinned = engine.roles(roster, { ...settings, overrides: {} });
  const qualified = engine.staffQualified(roster, settings);
  const children = rosterUnits(roster.run).filter((u) => u.kind === 'child');
  const comp = composition(roster, engine.plan(roster, settings, { free: ctx.free }), ctx.quotas, settings.noRobin);
  const gains = engine.robinGain(roster, settings);
  const robinSet = !!(roster.run.gender && roster.run.asset && roster.run.flaw);
  const setRobin = () => h('button', { class: 'mini', onclick: ctx.openRunFacts }, 'Set Robin');
  const gainCell = (id: ChildId) => {
    const g = gains.get(id);
    if (!g) return h('td', { class: 'muted' }, '—');
    const side = (x: RobinGainSide | undefined) => (x ? `${x.parent} (${x.score})` : 'nothing left');
    return h(
      'td',
      { class: 'num', title: `Under ${ctx.presetLabel(g.preset)}: with Robin ${side(g.with)} · without ${side(g.without)}` },
      g.gain > 0 ? `+${Math.round(g.gain * 10) / 10}` : '0',
      h('div', { class: 'small muted' }, g.gain > 0 ? `${g.with.parent} vs ${g.without?.parent ?? '—'}` : g.with.parent),
    );
  };
  const cell = (id: ChildId, role: ChildDeploymentRole) => {
    const d = derived.get(id)!;
    const a = roles.get(id);
    const standing = Math.round(d.roleStanding[role] * 100);
    const pinned = settings.roleOverrides[id] === role;
    const disq = role === 'staff' && !qualified.has(id);
    const on = a?.role === role;
    return h(
      'td',
      {
        class: `rm-cell${on ? ' on' : ''}${pinned ? ' pinned' : ''}${disq ? ' disq' : ''}`,
        title: disq
          ? 'Doesn’t reach a staff class or rally skill on its planned pairing: pinning it here warns'
          : pinned
            ? 'Pinned: click to unpin'
            : `Click to pin ${ROLE_UI[role].label}`,
        onclick: () => ctx.setRoleOverride(id, pinned ? null : role),
      },
      h('div', { class: 'rm-bar' }, h('i', { style: `width:${standing}%` })),
      h('span', { class: 'num' }, String(standing)),
      ' ',
      h('span', { class: 'small' }, ctx.presetLabel(d.rolePreset[role])),
      d.bestRole === role ? h('span', { class: 'tag' }, 'best') : null,
      on && a?.source === 'army fit' ? h('span', { class: 'tag fit', title: a.reason ?? '' }, '← army fit') : null,
      pinned ? h('span', { class: 'tag pinned' }, 'pinned') : null,
      pinned && disq ? h('span', { class: 'tag warn' }, '⚠ doesn’t qualify') : null,
    );
  };
  return h(
    'section',
    { ...guide('role-matrix'), class: 'role-matrix' },
    h(
      'div',
      { class: 'panel-head' },
      h('h3', {}, 'Roles'),
      compositionStrip(comp),
      h(
        'label',
        { ...guide('no-robin'), class: 'small', title: 'A world without Robin: Robin is no one’s parent, Morgan leaves the cast and Robin isn’t deployed' },
        h('input', { type: 'checkbox', checked: !!settings.noRobin, onchange: (e) => ctx.setNoRobin((e.target as HTMLInputElement).checked) }),
        ' No Robin',
      ),
    ),
    !robinSet && !settings.noRobin
      ? h(
          'div',
          { ...guide('robin-first'), class: 'banner' },
          'Set Robin first: Morgan waits on Robin, and Robin is the best parent for nearly every child. ',
          setRobin(),
        )
      : null,
    settings.noRobin ? h('div', { class: 'banner' }, 'No-Robin view: standings, roles and the plan are for a world without Robin.') : null,
    h('p', { class: 'muted small' }, 'Standing (0–100) against the cast in each deployment role. Click a cell to pin that role; the menu pins a preset.'),
    h(
      'table',
      { class: 'grid rm' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, 'Child'),
          ...CHILD_DEPLOYMENT_ROLES.map((r) => h('th', {}, ROLE_UI[r].label)),
          h('th', {}, 'Plan preset'),
          h('th', {}, 'Preset override'),
          h('th', { ...guide('robin-gain'), title: 'Best score under the Lead role preset with Robin in the gene pool, minus without' }, 'Robin gain'),
        ),
      ),
      h(
        'tbody',
        {},
        ...children.map((u) => {
          const id = u.id as ChildId;
          const out = derivation.leftOut.get(id);
          if (out)
            return h(
              'tr',
              { class: 'out' },
              h('td', {}, u.name),
              h('td', { colspan: '6', class: 'muted' }, OUT_OF_CAST[out], out === 'needs-robin' ? ' ' : null, out === 'needs-robin' ? setRobin() : null),
            );
          const a = roles.get(id);
          return h(
            'tr',
            {},
            h('td', {}, u.name),
            ...CHILD_DEPLOYMENT_ROLES.map((r) => cell(id, r)),
            h('td', {}, h('b', {}, ctx.presetLabel(a?.preset ?? settings.overrides[id] ?? settings.preset)), ' ', sourceChip(a)),
            h('td', {}, presetControl(ctx, id, u.name, unpinned.get(id)?.preset ?? settings.preset)),
            gainCell(id),
          );
        }),
      ),
    ),
  );
}

/** The Plan sidebar: the composition strip, then each child's priority, plan preset and deployment role. */
export function planSidebar(ctx: PlanPageContext): HTMLElement {
  const children = rosterUnits(ctx.roster.run).filter((u) => u.kind === 'child');
  const comp = composition(ctx.roster, ctx.engine.plan(ctx.roster, ctx.settings, { free: ctx.free }), ctx.quotas, ctx.settings.noRobin);
  const derived = ctx.engine.deriveRoles(ctx.roster, ctx.settings);
  return h(
    'section',
    { class: 'plan-side', 'aria-label': 'Child priorities and plan presets' },
    h(
      'div',
      { class: 'panel-head' },
      h('h3', {}, LABELS.plan),
      h(
        'button',
        { class: 'ghost small', title: 'Reset every child’s priority and plan preset, and the quotas of every play context', onclick: ctx.resetPlanPrefs },
        'Reset plan preferences',
      ),
    ),
    h(
      'div',
      { ...guide('quota-bar'), class: 'comp' },
      compositionStrip(comp),
      h(
        'button',
        {
          ...guide('quota-edit'),
          class: `mini${ctx.editingQuotas ? ' on' : ''}`,
          'aria-pressed': String(ctx.editingQuotas),
          title: ctx.quotasEdited ? 'Edit the quotas (edited for this play context)' : 'Edit the quotas for this play context',
          onclick: () => ctx.setEditingQuotas(!ctx.editingQuotas),
        },
        ctx.quotasEdited ? '✎*' : '✎',
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
        derivedLine(ctx, derived, id),
        priorityControl(ctx, id, u.name),
      );
    }),
  );
}
