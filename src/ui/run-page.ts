/**
 * The Run view (#116): the chapter log, newest first, and the Maps list. Each entry is tagged with the map played and
 * holds a snapshot: every unit's class, level, EXP, stats, skills, inventory and supports, plus the convoy and gold.
 * A new entry copies the one before; editing a past entry never reaches later ones, which are flagged instead.
 */
import type { Engine, HeldItem, RosterUnit, Run, RunEntry, Snapshot, SupportLevel, UnitSnapshot } from '../engine';
import { SUPPORT_LEVELS, addEntry, editEntry, exportRun, flaggedEntries, heldProblems, importRun, removeEntry, unitName, withUnit } from '../engine';
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
};

export function runView(ctx: RunContext): HTMLElement[] {
  if (ctx.showingMaps || ctx.maps.map) {
    return [
      h('div', { class: 'units' }, h('button', { class: 'ghost small', onclick: () => (ctx.maps.open(undefined), ctx.setShowingMaps(false)) }, '← Chapter log')),
      ...mapsView(ctx.maps),
    ];
  }
  return [chapterLog(ctx)];
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
    h(
      'div',
      { ...guide('log-add'), class: 'banner' },
      h('b', {}, 'Record a map played'),
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

function snapshotEditor(ctx: RunContext, e: RunEntry): HTMLElement {
  const edit = (f: (s: Snapshot) => Snapshot) => ctx.setRun(editEntry(ctx.run, e.id, f, ctx.now()));
  const s = e.snapshot;
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const input = (value: string | number, onset: (v: string) => void, attrs: Record<string, string> = {}) =>
    h('input', { value: String(value), ...attrs, onchange: (ev) => onset((ev.target as HTMLInputElement).value) });
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
      ...STATS.map(stat),
      h('td', {}, input(u.skills.join(', '), (v) => set({ skills: v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5) }), { 'aria-label': `${unit} skills` })),
      h('td', {}, input(heldText(u.inventory), (v) => set({ inventory: parseHeldText(v) }), { 'aria-label': `${unit} inventory` })),
      h('td', {}, input(supportsText(u.supports), (v) => set({ supports: parseSupportsText(v) }), { 'aria-label': `${unit} supports` })),
    );
  };
  const units = Object.entries(s.units) as [RosterUnit, UnitSnapshot][];
  return h(
    'div',
    { ...guide('log-snapshot'), class: 'snapshot small' },
    h(
      'div',
      { class: 'row' },
      h('label', {}, 'Gold ', input(s.gold ?? '', (v) => edit((sn) => ({ ...sn, gold: num(v) })), { class: 'num-in' })),
      h('label', {}, 'Convoy ', input(heldText(s.convoy), (v) => edit((sn) => ({ ...sn, convoy: parseHeldText(v) })), { class: 'wide-in', placeholder: 'Iron Sword 40; Vulnerary 3' })),
    ),
    h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'grid' },
        h('thead', {}, h('tr', {}, ...['Unit', 'Class', 'Lv', 'Pro', 'EXP', ...STATS.map((x) => STAT_LABELS[x]), 'Skills', 'Inventory (item uses [forge +Mt/+Hit/+Crit])', 'Supports'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...units.map(([unit, u]) => unitRow(unit, u))),
      ),
    ),
    units.some(([, u]) => !u.stats) ? h('div', { class: 'muted' }, 'Blank stats: a child’s stats depend on its parents, so record them from the game.') : null,
    problems(s),
    h('div', { class: 'muted' }, 'Stats as the stat screen shows them, without pair-up. Unit states and marriages are edited on the Roster page; they’re recorded in the latest entry.'),
  );
}
