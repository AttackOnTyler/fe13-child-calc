/**
 * The Roster (#212: hard facts only): Run facts, each unit's state (Available, Not yet recruited, Missed, Dead) and a
 * marriage that happened, picked in the spouse picker. Deploy, deployment roles, Benched, pinned marriages and presets
 * are gone: a preference is an edit with a visible cost (the Wishlist tab), never a roster field.
 */
import {
  STATS,
  STAT_LABELS,
  rosterUnits,
  stateOf,
  withRun,
  withSpouse,
  withState,
  type Engine,
  type Gender,
  type Roster,
  type RosterEntry,
  type RosterUnit,
  type Stat,
  type UnitState,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { LABELS, STATE_UI } from './labels';
import { DIFFICULTIES, type Difficulty } from '../engine/roster';

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = { normal: 'Normal', hard: 'Hard', lunatic: 'Lunatic', 'lunatic-plus': 'Lunatic+' };
import { spouseOptions } from './spouse-options';

/** What the Roster page reads, and how it changes the roster. */
export type RosterContext = {
  readonly engine: Engine;
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  /** Wipes the run, `run:v2` (after the user confirms); scoring settings and checked rules are left alone. */
  readonly clearAll: () => void;
};

/** The states the Roster offers: hard facts only (#212). Benched went: keeping a unit out is a keep-out edit. */
export const ROSTER_STATES: readonly UnitState[] = ['available', 'not-recruited', 'missed', 'dead'];

function stateStrip(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const current = stateOf(ctx.roster, u.id);
  return h(
    'span',
    { ...guide('state-strip'), class: 'seg states', role: 'group', 'aria-label': `${u.name}: state` },
    ...ROSTER_STATES.map((st) => {
      const locked = !u.canBeLost && (st === 'dead' || st === 'missed');
      const { icon, label, hint } = STATE_UI[st];
      return h(
        'button',
        {
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

/** The spouse picker: a marriage that happened in your game (hard). Picking a spouse records it as ✓ Married. */
function spousePicker(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const { roster } = ctx;
  const spouse = roster.spouses[u.id];
  if (u.partners.length === 0) {
    return h('span', { class: 'spouse muted small' }, u.kind === 'child' ? 'Can’t marry in this run' : 'Only Robin: set Robin’s gender');
  }
  return h(
    'span',
    { class: 'spouse' },
    h(
      'select',
      {
        ...guide('spouse-picker'),
        'aria-label': `${u.name}: spouse`,
        title: 'Married (hard): the S-support happened in your game',
        onchange: (e) => {
          const v = (e.target as HTMLSelectElement).value;
          ctx.setRoster(withSpouse(roster, u.id, v ? (v as RosterUnit) : null, 'married'));
        },
      },
      h('option', { value: '', selected: !spouse }, '— not married'),
      ...spouseOptions(roster, u).map((o) => h('option', { value: o.value, selected: spouse?.partner === o.value }, o.label)),
    ),
    spouse?.bond === 'married' ? h('span', { ...guide('married'), class: 'small pos', title: 'Married (hard): the S-support happened' }, ` ${LABELS.married}`) : null,
  );
}

function unitRow(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const st = stateOf(ctx.roster, u.id);
  return h(
    'div',
    { class: `unit st-${st}`, 'data-unit': u.id },
    h('span', { class: 'uname' }, u.name, u.robinOnly ? h('span', { class: 'chip', title: 'Can S-support only Robin' }, 'Robin only') : null),
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
  const married = spouses.filter((s) => s?.bond === 'married').length / 2;
  const lost = units.filter((u) => ['dead', 'missed'].includes(stateOf(ctx.roster, u.id))).length;
  const section = (title: string, list: readonly RosterEntry[]) =>
    h('section', { class: 'rsec', 'aria-label': title }, h('h3', {}, title), ...list.map((u) => unitRow(ctx, u)));
  const byGender = (g: Gender) => units.filter((u) => u.kind !== 'child' && u.gender === g);
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, LABELS.roster),
    h('span', { class: 'muted' }, `${married} married · ${lost} dead or missed`),
    h(
      'button',
      {
        class: 'clear-all',
        title: 'Wipe the whole run: run facts, unit states, marriages, your edits and pins, and the chapter log (scoring settings and checked rules are kept)',
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
