import {
  STATS,
  DEPLOYMENT_ROLES,
  STAT_LABELS,
  UNIT_STATES,
  composition,
  deploymentOf,
  isDeployable,
  pinLoss,
  rosterUnits,
  stateOf,
  unitName,
  withDeploy,
  withDeployRole,
  withRun,
  withSpouse,
  withState,
  type Bond,
  type DeployableUnit,
  type DeploymentRole,
  type Engine,
  type Gender,
  type LedgerEntry,
  type Roster,
  type RosterEntry,
  type RosterUnit,
  type Stat,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { LABELS, LEDGER_UI, LEFT_OUT_UI, PIN_LOSS_UI, ROLE_UI, STATE_UI } from './labels';
import { compositionStrip, presetControl, priorityControl, roleChip, type ChildPlanControls } from './plan-page';
import { spouseOptions } from './spouse-options';

/** What the Roster page reads, and how it changes the roster. */
export type RosterContext = {
  readonly engine: Engine;
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  /** Sets the roster after a Deploy or deployment-role edit, noting the edit for the guide. */
  readonly setDeployment: (next: Roster) => void;
  /** Wipes the roster (after the user confirms); scoring settings are left alone. */
  readonly clearAll: () => void;
  /** The children ledger edits the same priorities and plan presets as the Plan sidebar. */
  readonly plan: ChildPlanControls;
};

const BOND_UI: Readonly<Record<Bond, string>> = { pinned: LABELS.pinned, married: LABELS.married };

function stateStrip(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const current = stateOf(ctx.roster, u.id);
  return h(
    'span',
    { ...guide('state-strip'), class: 'seg states', role: 'group', 'aria-label': `${u.name}: state` },
    ...UNIT_STATES.map((st) => {
      const locked = !u.canBeLost && (st === 'dead' || st === 'missed');
      const { icon, label, hint } = STATE_UI[st];
      return h(
        'button',
        {
          ...(st === 'benched' ? guide('bench') : {}),
          class: `st-${st}${st === current ? ' on' : ''}`,
          'aria-pressed': String(st === current),
          'aria-label': label,
          title: locked ? `${u.name}’s death is a Game Over` : `${label}: ${hint}`,
          disabled: locked,
          onclick: () => ctx.setRoster(withState(ctx.roster, u.id, st)),
        },
        icon,
      );
    }),
  );
}

function spousePicker(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const { roster } = ctx;
  const spouse = roster.spouses[u.id];
  if (u.partners.length === 0) {
    return h('span', { class: 'spouse muted small' }, u.kind === 'child' ? 'Can’t marry in this run' : 'Only Robin: set Robin’s gender');
  }
  const bond = spouse?.bond ?? 'pinned';
  const loss = pinLoss(roster, u.id);
  return h(
    'span',
    { class: 'spouse' },
    h(
      'select',
      {
        ...guide('spouse-picker'),
        'aria-label': `${u.name}: spouse`,
        onchange: (e) => {
          const v = (e.target as HTMLSelectElement).value;
          ctx.setRoster(withSpouse(roster, u.id, v ? (v as RosterUnit) : null, bond));
        },
      },
      h('option', { value: '', selected: !spouse }, '— no spouse'),
      ...spouseOptions(roster, u).map((o) => h('option', { value: o.value, selected: spouse?.partner === o.value }, o.label)),
    ),
    h(
      'span',
      { class: 'seg' },
      ...(['pinned', 'married'] as const).map((b) =>
        h(
          'button',
          {
            ...(b === 'married' ? guide('married') : {}),
            class: spouse?.bond === b ? 'on' : '',
            'aria-pressed': String(spouse?.bond === b),
            disabled: !spouse,
            title: b === 'pinned' ? 'Pinned (soft): the plan keeps this marriage. It breaks if either unit dies or is missed, and goes on hold while either is benched' : 'Married (hard): the S-support happened',
            onclick: () => spouse && ctx.setRoster(withSpouse(roster, u.id, spouse.partner, b)),
          },
          BOND_UI[b],
        ),
      ),
    ),
    loss
      ? h(
          'span',
          { class: `small pin-${loss.status}`, title: PIN_LOSS_UI[loss.status].hint },
          ` ${PIN_LOSS_UI[loss.status].label}: ${loss.reason}`,
        )
      : null,
  );
}

/** A first-gen unit's Deploy flag and deployment-role tag (defaulted from the curated table). */
function deployControl(ctx: RosterContext, u: RosterEntry & { id: DeployableUnit }): HTMLElement {
  const tag = deploymentOf(ctx.roster, u.id);
  return h(
    'span',
    { class: 'deploy' },
    h(
      'label',
      { ...guide('deploy'), title: 'Deploy: counts toward the composition quotas in its role' },
      h('input', {
        type: 'checkbox',
        checked: tag.deploy,
        'aria-label': `${u.name}: deploy`,
        onchange: (e) => ctx.setDeployment(withDeploy(ctx.roster, u.id, (e.target as HTMLInputElement).checked)),
      }),
      ' Deploy',
    ),
    h(
      'select',
      {
        ...guide('deploy-role'),
        'aria-label': `${u.name}: deployment role`,
        onchange: (e) => ctx.setDeployment(withDeployRole(ctx.roster, u.id, (e.target as HTMLSelectElement).value as DeploymentRole)),
      },
      ...DEPLOYMENT_ROLES.map((r) => h('option', { value: r, selected: r === tag.role }, ROLE_UI[r].label)),
    ),
  );
}

function unitRow(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const st = stateOf(ctx.roster, u.id);
  const deployable = u.kind !== 'child' && isDeployable(u.id);
  return h(
    'div',
    { class: `unit st-${st}`, 'data-unit': u.id },
    h(
      'span',
      { class: 'uname' },
      u.name,
      u.robinOnly ? h('span', { class: 'chip', title: 'Can S-support only Robin' }, 'Robin only') : null,
      deployable ? deployControl(ctx, u as RosterEntry & { id: DeployableUnit }) : null,
    ),
    stateStrip(ctx, u),
    spousePicker(ctx, u),
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function ledgerRow(ctx: RosterContext, e: LedgerEntry): HTMLElement {
  const gender = ctx.roster.run.gender;
  const st = LEDGER_UI[e.status];
  const pairing = (c: LedgerEntry['planned']) =>
    c ? [h('span', {}, c.parent), ' ', h('b', { class: 'num' }, c.score === undefined ? '—' : String(c.score))] : [h('span', { class: 'muted' }, '—')];
  const same = e.best && e.best.key === e.planned?.key;
  // A plan-broken row adds why its saved pairing can't happen, one reason per line.
  const statusHint = [e.leftOut ? `${st.hint}. ${LEFT_OUT_UI[e.leftOut].hint}` : st.hint, ...(e.saved?.reasons ?? [])].join('\n');
  return h(
    'tr',
    { class: `ledger-${e.status}` },
    h('td', { class: 'uname' }, e.name, ' ', roleChip(ctx.plan, e.child)),
    h('td', { class: 'muted' }, unitName(e.fixedParent, gender)),
    h(
      'td',
      { title: e.status === 'married' ? 'Its parents’ marriage' : 'The marriage plan’s pairing' },
      ...(e.saved ? [h('s', {}, e.saved.parent), ' → '] : []),
      ...pairing(e.planned),
    ),
    h(
      'td',
      { title: 'Its best pairing in its plan preset that can still happen, whatever the rest of the plan' },
      ...(same ? [h('span', { class: 'muted' }, '= plan')] : pairing(e.best)),
      e.delta ? h('span', { class: `small ${e.delta > 0 ? 'pos' : 'neg'}` }, ` ${signed(e.delta)}`) : null,
    ),
    h(
      'td',
      { class: `lstatus ${e.status}`, title: statusHint },
      `${st.mark} ${st.label}`,
      e.leftOut ? h('span', { class: 'small' }, ` · ${LEFT_OUT_UI[e.leftOut].label}`) : null,
      e.notes.length ? h('span', { class: 'warn', title: e.notes.join('\n'), 'aria-label': e.notes.join('. ') }, ' ⚠') : null,
    ),
    h('td', {}, priorityControl(ctx.plan, e.child, e.name)),
    h('td', {}, presetControl(ctx.plan, e.child, e.name)),
  );
}

/** Each child: fixed parent, plan or marriage, best remaining pairing with Δ vs the plan, status, and its plan controls. */
function childrenLedger(ctx: RosterContext): HTMLElement {
  const ledger = ctx.engine.ledger(ctx.roster, ctx.plan.settings);
  return h(
    'section',
    { ...guide('children-ledger'), class: 'rsec ledger', 'aria-label': 'Children ledger' },
    h('h3', {}, 'Children ledger'),
    h('p', { class: 'muted' }, 'Each child scored in its plan preset. Priority and preset are the same controls as the Plan sidebar.'),
    h(
      'div',
      { class: 'ledger-scroll' },
      h(
        'table',
        { class: 'grid ledger' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, 'Child'),
            h('th', {}, 'Fixed parent'),
            h('th', {}, 'Plan / marriage'),
            h('th', {}, LABELS.bestRemaining),
            h('th', {}, LABELS.ledgerStatus),
            h('th', {}, 'Priority'),
            h('th', {}, 'Plan preset'),
          ),
        ),
        h('tbody', {}, ...ledger.map((e) => ledgerRow(ctx, e))),
      ),
    ),
    compositionStrip(composition(ctx.roster, ctx.engine.plan(ctx.roster, ctx.plan.settings), ctx.plan.quotas)),
  );
}

function runFacts(ctx: RosterContext): HTMLElement {
  const { run } = ctx.roster;
  const setRun = (next: Partial<Roster['run']>) => ctx.setRoster(withRun(ctx.roster, next));
  const statSelect = (label: string, value: Stat | null, sign: string, exclude: Stat | null, onpick: (s: Stat | null) => void) =>
    h(
      'select',
      { 'aria-label': label, onchange: (e) => onpick(((e.target as HTMLSelectElement).value || null) as Stat | null) },
      h('option', { value: '', selected: value === null }, '— not set'),
      ...STATS.filter((s) => s !== exclude).map((s) => h('option', { value: s, selected: s === value }, `${sign}${STAT_LABELS[s]}`)),
    );
  const genders: readonly (Gender | null)[] = [null, 'M', 'F'];
  return h(
    'section',
    { ...guide('run-facts'), class: 'rsec run', 'aria-label': LABELS.runFacts },
    h('h3', {}, LABELS.runFacts),
    h('p', { class: 'muted' }, 'Fixed at the start of a playthrough. They remove the other Robin, the other Morgan and Robin’s other asset/flaws entirely.'),
    h(
      'div',
      { class: 'facts' },
      h(
        'span',
        { class: 'blk' },
        h('span', { class: 'lbl' }, 'Robin'),
        h(
          'span',
          { class: 'seg', role: 'group', 'aria-label': 'Robin’s gender' },
          ...genders.map((g) =>
            h('button', { class: run.gender === g ? 'on' : '', 'aria-pressed': String(run.gender === g), onclick: () => setRun({ gender: g }) }, g ?? '—'),
          ),
        ),
      ),
      h(
        'span',
        { class: 'blk' },
        h('span', { class: 'lbl' }, 'Asset'),
        statSelect('Robin’s asset', run.asset, '+', null, (asset) => setRun({ asset })),
        h('span', { class: 'lbl' }, 'Flaw'),
        statSelect('Robin’s flaw', run.flaw, '−', run.asset, (flaw) => setRun({ flaw })),
      ),
    ),
  );
}

export function rosterPage(ctx: RosterContext): HTMLElement[] {
  const units = rosterUnits(ctx.roster.run);
  const spouses = Object.values(ctx.roster.spouses);
  const count = (b: Bond) => spouses.filter((s) => s?.bond === b).length / 2;
  const lost = units.filter((u) => ['dead', 'missed'].includes(stateOf(ctx.roster, u.id))).length;
  const section = (title: string, list: readonly RosterEntry[]) =>
    h('section', { class: 'rsec', 'aria-label': title }, h('h3', {}, title), ...list.map((u) => unitRow(ctx, u)));
  const byGender = (g: Gender) => units.filter((u) => u.kind !== 'child' && u.gender === g);
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, LABELS.roster),
    h('span', { class: 'muted' }, `${count('married')} married · ${count('pinned')} pinned · ${lost} dead or missed`),
    h(
      'button',
      {
        class: 'clear-all',
        title: 'Wipe run facts, unit states and marriages (scoring settings are kept)',
        onclick: () => {
          if (confirm('Clear the whole roster: run facts, unit states and marriages? Scoring settings are kept.')) ctx.clearAll();
        },
      },
      'Clear all',
    ),
  );
  return [
    head,
    h(
      'div',
      { class: 'scroll roster' },
      runFacts(ctx),
      section('Men', byGender('M')),
      section('Women', byGender('F')),
      section('Children', units.filter((u) => u.kind === 'child')),
      childrenLedger(ctx),
    ),
  ];
}
