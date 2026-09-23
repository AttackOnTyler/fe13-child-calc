import {
  STATS,
  STAT_LABELS,
  UNIT_STATES,
  rosterUnits,
  stateOf,
  unitName,
  voidPinReason,
  withRun,
  withSpouse,
  withState,
  type Bond,
  type Engine,
  type Gender,
  type Roster,
  type RosterEntry,
  type RosterUnit,
  type Stat,
  type UnitState,
} from '../engine';
import { h } from './dom';

/** What the Roster page reads, and how it changes the roster. */
export type RosterContext = {
  readonly engine: Engine;
  readonly roster: Roster;
  readonly setRoster: (next: Roster) => void;
  /** Wipes the roster (after the user confirms); scoring settings are left alone. */
  readonly clearAll: () => void;
};

const STATE_UI: Readonly<Record<UnitState, { icon: string; label: string; hint: string }>> = {
  available: { icon: '●', label: 'Available', hint: 'Recruited and usable' },
  'not-recruited': { icon: '◌', label: 'Not yet recruited', hint: 'Joins later: prunes nothing' },
  benched: { icon: '⏸', label: 'Benched', hint: 'Won’t be used: soft, and breaks a pin through the unit' },
  missed: { icon: '⊘', label: 'Missed', hint: 'Can no longer be recruited: blocks every pairing that needs the unit' },
  dead: { icon: '☠', label: 'Dead', hint: 'Blocks every pairing that still needs the unit' },
};

const BOND_UI: Readonly<Record<Bond, string>> = { pinned: '★ Planned', married: '✓ Married' };

function stateStrip(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const current = stateOf(ctx.roster, u.id);
  return h(
    'span',
    { class: 'seg states', role: 'group', 'aria-label': `${u.name}: state` },
    ...UNIT_STATES.map((st) => {
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

function spousePicker(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const { roster } = ctx;
  const gender = roster.run.gender;
  const spouse = roster.spouses[u.id];
  if (u.partners.length === 0) {
    return h('span', { class: 'spouse muted small' }, u.kind === 'child' ? 'Can’t marry in this run' : 'Only Robin: set Robin’s gender');
  }
  const option = (p: RosterUnit) => {
    const theirs = roster.spouses[p];
    const note = theirs && theirs.partner !== u.id ? ` (${theirs.bond === 'married' ? 'married to' : 'planned with'} ${unitName(theirs.partner, gender)})` : '';
    return h('option', { value: p, selected: spouse?.partner === p }, `${unitName(p, gender)}${note}`);
  };
  const bond = spouse?.bond ?? 'pinned';
  const voided = voidPinReason(roster, u.id);
  return h(
    'span',
    { class: 'spouse' },
    h(
      'select',
      {
        'aria-label': `${u.name}: spouse`,
        onchange: (e) => {
          const v = (e.target as HTMLSelectElement).value;
          ctx.setRoster(withSpouse(roster, u.id, v ? (v as RosterUnit) : null, bond));
        },
      },
      h('option', { value: '', selected: !spouse }, '— no spouse'),
      ...u.partners.map(option),
    ),
    h(
      'span',
      { class: 'seg' },
      ...(['pinned', 'married'] as const).map((b) =>
        h(
          'button',
          {
            class: spouse?.bond === b ? 'on' : '',
            'aria-pressed': String(spouse?.bond === b),
            disabled: !spouse,
            title: b === 'pinned' ? 'A planned marriage (soft): it breaks by itself if either unit is benched, missed or dead' : 'Married (hard): the S-support happened',
            onclick: () => spouse && ctx.setRoster(withSpouse(roster, u.id, spouse.partner, b)),
          },
          BOND_UI[b],
        ),
      ),
    ),
    voided ? h('span', { class: 'warn small', title: 'A pin through a lost unit is void and frees the partner' }, ` void: ${voided}`) : null,
  );
}

function unitRow(ctx: RosterContext, u: RosterEntry): HTMLElement {
  const st = stateOf(ctx.roster, u.id);
  return h(
    'div',
    { class: `unit st-${st}`, 'data-unit': u.id },
    h(
      'span',
      { class: 'uname' },
      u.name,
      u.robinOnly ? h('span', { class: 'chip', title: 'Can S-support only Robin' }, 'Robin only') : null,
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
  return h(
    'section',
    { class: 'rsec run', 'aria-label': 'Run facts' },
    h('h3', {}, 'Run facts'),
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
    h('h2', {}, 'Roster'),
    h('span', { class: 'muted' }, `${count('married')} married · ${count('pinned')} planned · ${lost} dead or missed`),
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
    ),
  ];
}
