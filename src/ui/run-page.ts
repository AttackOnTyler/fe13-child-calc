/**
 * The Run view (#116): the chapter log, newest first, and the Maps list. Each entry is tagged with the map played and
 * holds a snapshot: every unit's class, level, EXP, stats, skills, inventory and supports, plus the convoy and gold.
 * A new entry copies the one before; editing a past entry never reaches later ones, which are flagged instead.
 */
import type { Engine, HeldItem, RosterUnit, Run, RunEntry, Snapshot, SupportLevel, UnitSnapshot } from '../engine';
import { SUPPORT_LEVELS, addEntry, editEntry, exportRun, flaggedEntries, heldProblems, importRun, latestEntry, nextMaps, recordFallen, recordMarriage, removeEntry, rosterOf, unitName, withUnit } from '../engine';
import { STATS, STAT_LABELS, type Stat } from '../game-data/stats';
import { h } from './dom';
import { guide } from './guide';
import { mapsView, type MapsContext } from './maps-page';

export type RunContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly setRun: (run: Run) => void;
  readonly now: () => number;
  /** The open entry's id (view state). */
  readonly openEntry: string | undefined;
  readonly setOpenEntry: (id: string | undefined) => void;
  /** Showing the Maps list or a map rather than the log (view state). */
  readonly showingMaps: boolean;
  readonly setShowingMaps: (on: boolean) => void;
  readonly maps: MapsContext;
  /** Record results in progress: the entry it created and the step (view state). */
  readonly recording: { readonly entry: string; readonly step: number } | undefined;
  readonly setRecording: (r: { readonly entry: string; readonly step: number } | undefined) => void;
  /** Opens a map's preparation page (#119). */
  readonly prepare: (map: string) => void;
};

const RECORD_STEPS = ['Deployed units', 'Recruits', 'Deaths and marriages', 'Convoy and gold'] as const;

export function runView(ctx: RunContext): HTMLElement[] {
  if (ctx.showingMaps || ctx.maps.map) {
    return [
      h('div', { class: 'units' }, h('button', { class: 'ghost small', onclick: () => (ctx.maps.open(undefined), ctx.setShowingMaps(false)) }, '← Chapter log')),
      ...mapsView(ctx.maps),
    ];
  }
  const rec = ctx.recording && ctx.run.entries.find((e) => e.id === ctx.recording!.entry);
  return [rec ? recordResults(ctx, rec, ctx.recording!.step) : chapterLog(ctx)];
}

/** The maps the run can play next (#118): the story's next map first; Record results starts its entry. */
function nextMapSection(ctx: RunContext): HTMLElement {
  const offers = nextMaps(ctx.run);
  const label = (id: string) => {
    const m = ctx.engine.maps().find((x) => x.id === id)!;
    return m.kind === 'xenologue' ? m.label : `${m.label}: ${m.title}`;
  };
  const record = (map: string) => {
    const next = addEntry(ctx.run, map, ctx.now());
    ctx.setRun(next);
    ctx.setRecording({ entry: latestEntry(next)!.id, step: 0 });
  };
  const row = (o: (typeof offers)[number], first: boolean) =>
    h(
      'div',
      { class: `row${first ? ' next-first' : ''}` },
      h('b', {}, label(o.map)),
      o.note ? h('span', { class: 'muted small' }, o.note) : null,
      h('button', { ...(first ? guide('prepare') : {}), class: first ? '' : 'mini', title: 'Matchups for this map from your latest entry', onclick: () => ctx.prepare(o.map) }, 'Prepare'),
      h('button', { ...(first ? guide('record-results') : {}), class: first ? '' : 'mini', title: 'Played it: record how it went', onclick: () => record(o.map) }, 'Record results'),
    );
  const story = offers.filter((o) => o.kind === 'story');
  const rest = offers.filter((o) => o.kind !== 'story');
  return h(
    'div',
    { ...guide('next-map'), class: 'banner next-map' },
    h('b', {}, 'Next map'),
    ...(offers.length ? [...story.map((o, i) => row(o, i === 0)), ...(rest.length ? [h('details', {}, h('summary', { class: 'small' }, `Also open (${rest.length})`), ...rest.map((o) => row(o, false)))] : [])] : [h('span', { class: 'muted' }, 'Nothing left to play on this route.')]),
  );
}

/**
 * Record results (#118): the entry is already a copy of the last, so every step only records changes: deployed units,
 * the map's recruits (pre-filled), deaths and marriages, then convoy and gold.
 */
function recordResults(ctx: RunContext, e: RunEntry, step: number): HTMLElement {
  const i = ctx.run.entries.findIndex((x) => x.id === e.id);
  const before = ctx.run.entries[i - 1]?.snapshot.units ?? {};
  const all = Object.keys(e.snapshot.units) as RosterUnit[];
  const recruits = all.filter((u) => !before[u]);
  const veterans = all.filter((u) => before[u]);
  const roster = rosterOf({ ...ctx.run, entries: ctx.run.entries.slice(0, i + 1) });
  const name = (u: RosterUnit) => unitName(u, ctx.run.roster.run.gender);
  const casual = ctx.run.roster.run.mode === 'casual';
  let a: RosterUnit | '' = '';
  let b: RosterUnit | '' = '';
  const body = (() => {
    switch (step) {
      case 0:
        return [h('p', { class: 'muted small' }, 'Update who levelled, promoted or reclassed. Leave the rest: it’s copied from last time.'), unitTable(ctx, e, veterans, true)];
      case 1:
        return recruits.length
          ? [h('p', { class: 'muted small' }, 'Filled in from their join data (a child’s stats come from the game).'), unitTable(ctx, e, recruits)]
          : [h('p', { class: 'muted' }, 'No one joined on this map.')];
      case 2:
        return [
          h('p', { class: 'muted small' }, casual ? 'Casual: a unit that falls comes back after the map, so nothing changes.' : 'Classic: a unit that falls is dead for good.'),
          h(
            'div',
            { class: 'row' },
            ...all
              .filter((u) => roster.states[u] !== 'dead')
              .map((u) => h('button', { class: 'mini', disabled: casual, title: `${name(u)} fell`, onclick: () => ctx.setRun(recordFallen(ctx.run, e.id, u, ctx.now())) }, `✝ ${name(u)}`)),
          ),
          h(
            'div',
            { class: 'row' },
            'Married: ',
            h('select', { onchange: (ev) => (a = (ev.target as HTMLSelectElement).value as RosterUnit) }, h('option', { value: '' }, '—'), ...all.map((u) => h('option', { value: u }, name(u)))),
            ' × ',
            h('select', { onchange: (ev) => (b = (ev.target as HTMLSelectElement).value as RosterUnit) }, h('option', { value: '' }, '—'), ...all.map((u) => h('option', { value: u }, name(u)))),
            h('button', { class: 'mini', onclick: () => a && b && a !== b && ctx.setRun(recordMarriage(ctx.run, e.id, a, b, ctx.now())) }, 'Record marriage'),
          ),
          h(
            'div',
            { class: 'small' },
            'Recorded here: ',
            [
              ...Object.entries(e.snapshot.states).filter(([u, st]) => st === 'dead' && !ctx.run.entries[i - 1]?.snapshot.states[u as RosterUnit]).map(([u]) => `${name(u as RosterUnit)} fell`),
              ...Object.entries(e.snapshot.spouses).filter(([u, sp]) => sp?.bond === 'married' && ctx.run.entries[i - 1]?.snapshot.spouses[u as RosterUnit]?.bond !== 'married').map(([u, sp]) => `${name(u as RosterUnit)} × ${name(sp!.partner)}`),
            ].join(', ') || 'nothing yet',
          ),
        ];
      default:
        return [goldAndConvoy(ctx, e), problems(e.snapshot)];
    }
  })();
  const last = step === RECORD_STEPS.length - 1;
  return h(
    'section',
    { ...guide('record-flow'), class: 'units run-log' },
    h('h2', {}, `Record results: ${mapLabel(ctx.engine, e)}`),
    h('div', { class: 'chips' }, ...RECORD_STEPS.map((t, k) => h('span', { class: `chip${k === step ? ' plan' : ''}` }, `${k + 1}. ${t}`))),
    ...body,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'ghost', disabled: step === 0, onclick: () => ctx.setRecording({ entry: e.id, step: step - 1 }) }, '← Back'),
      last
        ? h('button', { onclick: () => (ctx.setRecording(undefined), ctx.setOpenEntry(undefined)) }, 'Done')
        : h('button', { onclick: () => ctx.setRecording({ entry: e.id, step: step + 1 }) }, 'Next →'),
      h('span', { class: 'muted small' }, 'Anything you skip keeps its copied value.'),
    ),
  );
}

const mapLabel = (engine: Engine, e: RunEntry) =>
  e.map === 'other' ? (e.label ?? 'Other') : (engine.maps().find((m) => m.id === e.map)?.label ?? e.map);

// ---- inventory and supports as short text ----

/** `Iron Sword 40; Steel Sword 30 [Kiri +2/+10/+0]; Vulnerary 3` */
export const heldText = (items: readonly HeldItem[]) =>
  items.map((i) => `${i.item}${i.uses !== null ? ` ${i.uses}` : ''}${i.forge ? ` [${i.forge.name} +${i.forge.mt}/+${i.forge.hit}/+${i.forge.crit}]` : ''}`).join('; ');

export function parseHeldText(text: string): HeldItem[] {
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const forge = s.match(/\[(.*?)\s*\+(\d+)\/\+(\d+)\/\+(\d+)\]\s*$/);
      const rest = forge ? s.slice(0, forge.index).trim() : s;
      const uses = rest.match(/\s(\d+)$/);
      return {
        item: uses ? rest.slice(0, uses.index).trim() : rest,
        uses: uses ? Number(uses[1]) : null,
        ...(forge ? { forge: { name: forge[1]!.trim(), mt: Number(forge[2]), hit: Number(forge[3]), crit: Number(forge[4]) } } : {}),
      };
    });
}

/** `sumia A; frederick C` */
export const supportsText = (s: UnitSnapshot['supports']) => s.map((x) => `${x.partner} ${x.rank}`).join('; ');
export const parseSupportsText = (text: string): UnitSnapshot['supports'] =>
  text
    .split(';')
    .map((s) => s.trim().split(/\s+/))
    .flatMap(([partner, rank]) => (partner && SUPPORT_LEVELS.includes(rank as SupportLevel) ? [{ partner: partner as RosterUnit, rank: rank as SupportLevel }] : []));

// ---- the log ----

function chapterLog(ctx: RunContext): HTMLElement {
  const { engine, run } = ctx;
  const flagged = flaggedEntries(run);
  const offerable = engine.maps().filter((m) => !m.grind);
  let pick = offerable.find((m) => !run.entries.some((e) => e.map === m.id))?.id ?? 'other';
  const newest = [...run.entries].reverse();
  return h(
    'section',
    { ...guide('chapter-log'), class: 'units run-log' },
    h('h2', {}, 'Run'),
    h(
      'div',
      { class: 'row' },
      h('button', { ...guide('maps-link'), class: 'ghost small', onclick: () => ctx.setShowingMaps(true) }, 'Maps →'),
      h('button', { class: 'ghost small', title: 'Save the run as a file', onclick: () => download(exportRun(run)) }, 'Export'),
      h(
        'label',
        { class: 'ghost small', title: 'Replace this run with one from a file' },
        'Import ',
        h('input', {
          type: 'file',
          accept: 'application/json,.json',
          onchange: async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f && confirm('Replace this run with the file’s? Export first to keep it.')) ctx.setRun(importRun(await f.text()));
          },
        }),
      ),
    ),
    nextMapSection(ctx),
    h(
      'div',
      { ...guide('log-add'), class: 'banner' },
      h('b', {}, 'Log another map (a skirmish, a grind or gold map, or one out of order)'),
      h(
        'div',
        { class: 'row' },
        h(
          'select',
          { 'aria-label': 'Map played', onchange: (e) => (pick = (e.target as HTMLSelectElement).value) },
          ...offerable.map((m) => h('option', { value: m.id, selected: m.id === pick }, `${m.label}${m.kind === 'story' ? `: ${m.title}` : ''}`)),
          h('option', { value: 'other', selected: pick === 'other' }, 'Other (a skirmish, a grind or gold map)'),
        ),
        h(
          'button',
          {
            onclick: () => {
              const label = pick === 'other' ? (prompt('What did you play?') ?? 'Other') : undefined;
              const next = addEntry(run, pick, ctx.now(), label);
              ctx.setRun(next);
              ctx.setOpenEntry(next.entries[next.entries.length - 1]!.id);
            },
          },
          'Add entry',
        ),
      ),
      h('span', { class: 'muted small' }, 'A new entry starts as a copy of the last; the map’s recruits are filled in from their join data.'),
    ),
    ...newest.map((e, i) => entryBlock(ctx, e, i === 0, flagged.has(e.id))),
  );
}

function download(text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = 'fe13-run.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function entryBlock(ctx: RunContext, e: RunEntry, latest: boolean, flagged: boolean): HTMLElement {
  const open = ctx.openEntry === e.id;
  const units = Object.keys(e.snapshot.units).length;
  return h(
    'div',
    { class: `opinion entry${latest ? ' latest' : ''}` },
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'linkish', 'aria-expanded': String(open), onclick: () => ctx.setOpenEntry(open ? undefined : e.id) }, `${open ? '▾' : '▸'} ${mapLabel(ctx.engine, e)}`),
      h('span', { class: 'muted small' }, `${units} units${e.snapshot.gold !== null ? ` · ${e.snapshot.gold}G` : ''}${latest ? ' · latest' : ''}`),
      flagged ? h('span', { class: 'chip small warn', title: 'An earlier entry was edited after this one was copied from it: check whether the fix applies here too' }, '⚠ earlier entry edited') : null,
      !latest || ctx.run.entries.length > 1
        ? h('button', { class: 'mini', title: 'Remove this entry', onclick: () => confirm('Remove this entry?') && ctx.setRun(removeEntry(ctx.run, e.id)) }, '✕')
        : null,
    ),
    open ? snapshotEditor(ctx, e) : null,
  );
}

/** Inventory and convoy entries the item data doesn't allow (#117), listed under the editor. */
function problems(s: Snapshot): HTMLElement | null {
  const list = [
    ...(Object.entries(s.units) as [RosterUnit, UnitSnapshot][]).flatMap(([unit, u]) => u.inventory.flatMap(heldProblems).map((p) => `${unit}: ${p}`)),
    ...s.convoy.flatMap(heldProblems).map((p) => `Convoy: ${p}`),
  ];
  return list.length ? h('ul', { class: 'warn small' }, ...list.map((p) => h('li', {}, `⚠ ${p}`))) : null;
}

const input = (value: string | number, onset: (v: string) => void, attrs: Record<string, string> = {}) =>
  h('input', { value: String(value), ...attrs, onchange: (ev) => onset((ev.target as HTMLInputElement).value) });
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/** Units' rows in an entry, every field editable; `quick` shows only class, level, promoted and EXP. */
function unitTable(ctx: RunContext, e: RunEntry, units: readonly RosterUnit[], quick = false): HTMLElement {
  const edit = (f: (s: Snapshot) => Snapshot) => ctx.setRun(editEntry(ctx.run, e.id, f, ctx.now()));
  const unitRow = (unit: RosterUnit, u: UnitSnapshot) => {
    const set = (patch: Partial<UnitSnapshot>) => edit((sn) => withUnit(sn, unit, { ...u, ...patch }));
    const stat = (st: Stat) =>
      h(
        'td',
        {},
        input(u.stats?.[st] ?? '', (v) => set({ stats: { ...(u.stats ?? (Object.fromEntries(STATS.map((x) => [x, 0])) as Record<Stat, number>)), [st]: Number(v) || 0 } }), { class: 'num-in', 'aria-label': `${unit} ${STAT_LABELS[st]}` }),
      );
    return h(
      'tr',
      {},
      h('td', {}, unitName(unit, ctx.run.roster.run.gender)),
      h('td', {}, input(u.class, (v) => set({ class: v }), { class: 'cls-in', 'aria-label': `${unit} class` })),
      h('td', {}, input(u.level, (v) => set({ level: Number(v) || 1 }), { class: 'num-in', 'aria-label': `${unit} level` })),
      h('td', {}, h('input', { type: 'checkbox', checked: u.promoted, title: 'Promoted', onchange: (ev) => set({ promoted: (ev.target as HTMLInputElement).checked }) })),
      h('td', {}, input(u.exp, (v) => set({ exp: Number(v) || 0 }), { class: 'num-in', 'aria-label': `${unit} EXP` })),
      ...(quick
        ? []
        : [
            ...STATS.map(stat),
            h('td', {}, input(u.skills.join(', '), (v) => set({ skills: v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5) }), { 'aria-label': `${unit} skills` })),
            h('td', {}, input(heldText(u.inventory), (v) => set({ inventory: parseHeldText(v) }), { 'aria-label': `${unit} inventory` })),
            h('td', {}, input(supportsText(u.supports), (v) => set({ supports: parseSupportsText(v) }), { 'aria-label': `${unit} supports` })),
          ]),
    );
  };
  const heads = ['Unit', 'Class', 'Lv', 'Pro', 'EXP', ...(quick ? [] : [...STATS.map((x) => STAT_LABELS[x]), 'Skills', 'Inventory (item uses [forge +Mt/+Hit/+Crit])', 'Supports'])];
  return h(
    'div',
    { class: 'scroll-x' },
    h(
      'table',
      { class: 'grid' },
      h('thead', {}, h('tr', {}, ...heads.map((t) => h('th', {}, t)))),
      h('tbody', {}, ...units.flatMap((unit) => (e.snapshot.units[unit] ? [unitRow(unit, e.snapshot.units[unit]!)] : []))),
    ),
  );
}

function goldAndConvoy(ctx: RunContext, e: RunEntry): HTMLElement {
  const edit = (f: (s: Snapshot) => Snapshot) => ctx.setRun(editEntry(ctx.run, e.id, f, ctx.now()));
  return h(
    'div',
    { class: 'row' },
    h('label', {}, 'Gold ', input(e.snapshot.gold ?? '', (v) => edit((sn) => ({ ...sn, gold: numOrNull(v) })), { class: 'num-in' })),
    h('label', {}, 'Convoy ', input(heldText(e.snapshot.convoy), (v) => edit((sn) => ({ ...sn, convoy: parseHeldText(v) })), { class: 'wide-in', placeholder: 'Iron Sword 40; Vulnerary 3' })),
  );
}

function snapshotEditor(ctx: RunContext, e: RunEntry): HTMLElement {
  const s = e.snapshot;
  const units = Object.entries(s.units) as [RosterUnit, UnitSnapshot][];
  return h(
    'div',
    { ...guide('log-snapshot'), class: 'snapshot small' },
    goldAndConvoy(ctx, e),
    unitTable(ctx, e, units.map(([u]) => u)),
    units.some(([, u]) => !u.stats) ? h('div', { class: 'muted' }, 'Blank stats: a child’s stats depend on its parents, so record them from the game.') : null,
    problems(s),
    h('div', { class: 'muted' }, 'Stats as the stat screen shows them, without pair-up. Unit states and marriages are edited on the Roster page; they’re recorded in the latest entry.'),
  );
}
