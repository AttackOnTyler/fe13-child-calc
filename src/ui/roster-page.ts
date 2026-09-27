import {
  STATS,
  DEPLOYMENT_ROLES,
  STAT_LABELS,
  UNIT_STATES,
  deploymentOf,
  isDeployable,
  pinLoss,
  rosterUnits,
  stateOf,
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
  type Roster,
  type RosterEntry,
  type RosterUnit,
  type Stat,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { LABELS, PIN_LOSS_UI, ROLE_UI, STATE_UI } from './labels';
import { compositionStrip, priorityControl, roleChip, sourceChip, type ChildPlanControls } from './plan-page';
import { unitLink } from './unit-links';
import { DIFFICULTIES, type Difficulty } from '../engine/roster';

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = { normal: 'Normal', hard: 'Hard', lunatic: 'Lunatic', 'lunatic-plus': 'Lunatic+' };
import { spouseOptions } from './spouse-options';

/** What the Roster page reads, and how it changes the roster. */
export type RosterContext = {
  readonly engine: Engine;
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  /** Sets the roster after a Deploy or deployment-role edit, noting the edit for the guide. */
  readonly setDeployment: (next: Roster) => void;
  /** Wipes the run, `run:v2` (after the user confirms); scoring settings and checked rules are left alone. */
  readonly clearAll: () => void;
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
          // The guide's bench step is about children: a benched first-gen unit leaves the marriage plan (#127).
          ...(st === 'benched' && u.kind === 'child' ? guide('bench') : {}),
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
  const choice = <T extends string>(label: string, value: T | null, options: readonly (readonly [T, string])[], on: (v: T | null) => void) =>
    h(
      'select',
      { 'aria-label': label, onchange: (e) => on(((e.target as HTMLSelectElement).value || null) as T | null) },
      h('option', { value: '', selected: value === null }, '— not set'),
      ...options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)),
    );
  return h(
    'section',
    { ...guide('run-facts'), class: 'rsec run', 'aria-label': LABELS.runFacts },
    h('h3', {}, LABELS.runFacts),
    h('p', { class: 'muted' }, 'Fixed at the start of a playthrough. They remove the other Robin, the other Morgan and Robin’s other asset/flaws entirely.'),
    h(
      'div',
      { ...guide('run-setup'), class: 'facts' },
      h(
        'span',
        { class: 'blk' },
        h('span', { class: 'lbl' }, 'Difficulty'),
        choice('Difficulty', run.difficulty, DIFFICULTIES.map((d) => [d, DIFFICULTY_LABELS[d]] as const), (difficulty) => setRun({ difficulty })),
        h('span', { class: 'lbl' }, 'Mode'),
        choice('Mode', run.mode, [['classic', 'Classic'], ['casual', 'Casual']] as const, (mode) => setRun({ mode })),
        h('span', { class: 'lbl' }, 'Route'),
        choice('Route', run.route, [['main-story', 'Main story'], ['full-route', 'Full route']] as const, (route) => setRun({ route })),
      ),
    ),
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
        title: 'Wipe the whole run: run facts, unit states, marriages, pins and the chapter log (scoring settings and checked rules are kept)',
        onclick: () => {
          if (confirm('Clear the whole run: run facts, unit states, marriages, pins and the chapter log? Export it first from the Run view to keep it. Scoring settings and checked rules are kept.')) ctx.clearAll();
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
    ),
  ];
}
