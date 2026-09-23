import './style.css';
import {
  MOD_STATS,
  RALLY_OPTIONS,
  STATS,
  STAT_LABELS,
  createEngine,
  resolveAssumptions,
  type AssumptionId,
  type Assumptions,
  type ChildId,
  type ChildResult,
  type ClassId,
  type ClassMode,
  type ClassSummary,
  type Engine,
  type Gender,
  type LeaderboardEntry,
  type LeaderboardOptions,
  type Overrides,
  type PairingFilter,
  type PairingGroup,
  type PairingScore,
  type PlayContext,
  type RobinMode,
  type Preset,
  type ScoreBasis,
  type ScoreSettings,
  type Scoring,
  type ScoringRole,
  type SelfTestReport,
  type SpeedReading,
  type Stat,
  type SupportRank,
  type Weights,
} from '../engine';
import { h } from './dom';
import { loadOverrides, saveOverrides } from './overrides';
import {
  BASES,
  CONTEXTS,
  CONTEXT_LABELS,
  RANKS,
  RANK_CHOICES,
  ROLES,
  basisOf,
  dlcReachable,
  effectivePreset,
  isModified,
  loadPrefs,
  roleOf,
  savePrefs,
  speedSettings,
  targetOf,
  withPreset,
  type ColumnGroup,
  type ScoringPrefs,
} from './scoring-prefs';
import { validationPanel, withOverride } from './validation';

let overrides: Overrides = loadOverrides();
let assumptions: Assumptions = resolveAssumptions(overrides);
let engine: Engine = createEngine(assumptions);
let selfTest = engine.selfTest();
let prefs: ScoringPrefs = loadPrefs(engine);

// View state only; all domain answers come from the engine.
/** A child's table, or the All children leaderboard. */
let selected: ChildId | 'all' = 'lucina';
let view: 'table' | 'validation' = selfTest.passed ? 'table' : 'validation';
/** A Robin group row's identity across children: `child|group key`. */
const groupId = (child: ChildId, group: PairingGroup) => `${child}|${group.key}`;
/** Robin group rows (by group id) with their asset × flaw heatmap open. */
const expanded = new Set<string>();
/** The asset/flaw pairing pinned into a Robin group row, by group id; otherwise the row shows its best. */
const pinned = new Map<string, string>();
let filter: { parent: string; secondGen: boolean } = { parent: '', secondGen: true };
type SortCol = 'parent' | 'class' | 'score' | 'speed' | 'count' | `cap:${Stat}` | `mod:${Stat}` | `growth:${Stat}`;
let sort: { col: SortCol; dir: 1 | -1 } = { col: 'score', dir: -1 };
const FIRST_PAGE = 200;
const MORE = 500;
let limit = FIRST_PAGE;
/** The leaderboard's Robin mode (with the combo Pick shows) and sort. */
let board: { robin: 'all' | 'best' | 'pick'; pick: Exclude<RobinMode, string>; sort: LeaderboardOptions['sort'] } = {
  robin: 'best',
  pick: { asset: 'spd', flaw: 'def' },
  sort: 'score',
};
/** Leaderboard cards (by pairing key) showing their growth / modifier / cap matrix. */
const openCards = new Set<string>();
/** The scoring panel as a bottom sheet (phone width only). */
let sheetOpen = false;
/** The Pair-up Spd helper's inputs: a support class, rank and raw Spd. */
let helper: { cls: ClassId; rank: SupportRank; rawSpd: number } = { cls: 'swordmaster', rank: 'S', rawSpd: 30 };

// ---- scoring ----

const currentPreset = (): Preset => engine.presets().find((p) => p.id === prefs.preset)!;

/** The scoring role in force: the global override, else the preset's. */
const role = (): ScoringRole => roleOf(prefs, currentPreset());
const support = () => role() === 'support';
/** The basis in force (Growths falls back to Caps+LB in the Support role). */
const basis = (): ScoreBasis => basisOf(prefs, role(), engine);

const scoreSettings = (): ScoreSettings => {
  const { weights, mixed } = effectivePreset(currentPreset(), prefs);
  return {
    weights,
    mixed,
    basis: basis(),
    classMode: prefs.classMode,
    dlc: dlcReachable(prefs, engine),
    speed: speedSettings(prefs, engine),
    role: role(),
    supportRank: prefs.supportRank,
  };
};

let scoringCache: { settings: string; engine: Engine; scoring: Scoring } | undefined;
/** Every pairing's score under the current settings, recomputed only when they change. */
function scoring(): Scoring {
  const settings = scoreSettings();
  const k = JSON.stringify(settings);
  if (scoringCache?.settings !== k || scoringCache.engine !== engine) {
    scoringCache = { settings: k, engine, scoring: engine.score(settings) };
  }
  return scoringCache.scoring;
}

function setPrefs(next: Partial<ScoringPrefs>, parts: Part[] = ['rail', 'main', 'panel']): void {
  prefs = { ...prefs, ...next };
  savePrefs(prefs);
  renderParts(parts);
}

const presetLabel = (p: Preset) => `${p.name}${isModified(p, prefs.edits[p.id]) ? '*' : ''}`;

// ---- assumptions ----

/** Replaces the overrides, saves them and recomputes every pairing. */
function applyOverrides(next: Overrides): void {
  overrides = next;
  saveOverrides(overrides);
  assumptions = resolveAssumptions(overrides);
  engine = createEngine(assumptions);
  selfTest = engine.selfTest();
  render();
}

const setOverride = (id: AssumptionId, value: unknown) => applyOverrides(withOverride(overrides, id, value));

// ---- formatting ----

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

/** Topbar toggle for the validation panel, showing the self-test result and how many assumptions are overridden. */
function validationButton(report: SelfTestReport): HTMLElement {
  const passed = report.cases.filter((c) => c.passed).length;
  const overridden = engine.assumptions().filter((a) => !a.isDefault).length;
  return h(
    'button',
    {
      class: `validation-toggle${report.passed ? '' : ' fail'}${view === 'validation' ? ' on' : ''}`,
      title: 'Assumptions, resolved source disagreements and the self-test',
      'aria-pressed': String(view === 'validation'),
      onclick: () => {
        view = view === 'validation' ? 'table' : 'validation';
        render();
      },
    },
    'Validation ',
    h('span', { class: report.passed ? 'pos' : 'neg' }, `Self-test ${report.passed ? '✓' : '✕'} ${passed}/${report.cases.length}`),
    overridden > 0 ? h('span', { class: 'warn' }, ` · ${overridden} overridden`) : null,
  );
}

// ---- rail ----

function rail(): HTMLElement[] {
  const sc = scoring();
  const children = engine.children();
  const top = children.map((c) => sc.best(c.id)?.score).filter((s) => s !== undefined);
  const item = (id: ChildId | 'all', name: string, title: string, score: number | undefined) =>
    h(
      'button',
      {
        class: `rail-item${id === 'all' ? ' all' : ''}${id === selected && view === 'table' ? ' on' : ''}`,
        title,
        onclick: () => {
          selected = id;
          view = 'table';
          expanded.clear();
          openCards.clear();
          limit = FIRST_PAGE;
          render();
        },
      },
      h('span', {}, name),
      h('b', { class: 'num' }, String(score ?? '—')),
    );
  return [
    h('div', { class: 'muted small rail-head' }, `Best · ${presetLabel(currentPreset())}`),
    item('all', 'All children', 'Leaderboard of every child’s pairings', top.length ? Math.max(...top) : undefined),
    ...children.map((c) => item(c.id, c.name, `${c.pairingCount} pairings`, sc.best(c.id)?.score)),
  ];
}

// ---- table ----

/** ⚠ on a row that rests on an assumption, naming each one (and its current value) on hover. */
function warnMark(results: readonly ChildResult[]): HTMLElement | null {
  const used = new Set(results.flatMap((r) => r.assumptionsUsed));
  if (used.size === 0) return null;
  const title = engine
    .assumptions()
    .filter((a) => used.has(a.id))
    .map((a) => `Assumption: ${a.label} = ${a.current}${a.isDefault ? '' : ' (overridden)'}`)
    .join('\n');
  return h('span', { class: 'warn', title, 'aria-label': title }, ' ⚠');
}

/** A table line: one pairing, or a Robin group shown through its best (or pinned) asset/flaw. */
type Line = {
  readonly label: string;
  readonly result: ChildResult;
  readonly score: PairingScore;
  /** Set on a Robin group row. */
  readonly group?: PairingGroup;
  /** Score range over the group, when it varies. */
  readonly range?: string;
  /** The row shows a pinned asset/flaw rather than the group's best. */
  readonly pinned?: boolean;
};

function sortValue(line: Line, col: SortCol, gender: Gender): number | string | undefined {
  const { score, result } = line;
  if (col === 'parent') return line.label.toLowerCase();
  if (col === 'class') return score.class && engine.className(score.class, gender);
  if (col === 'score') return score.raw;
  if (col === 'speed') return support() ? score.values?.spd : score.speed?.total;
  if (col === 'count') return result.classSet.length;
  const [kind, stat] = col.split(':') as ['cap' | 'mod' | 'growth', Stat];
  if (kind === 'cap') return score.values?.[stat];
  if (kind === 'mod') return stat === 'hp' ? undefined : result.modifiers[stat];
  return result.growths[stat];
}

/** Sorts lines by the current column; lines that can't be scored in the pinned class always go last. */
function sortLines(lines: Line[], gender: Gender): Line[] {
  const keyed = lines.map((line, i) => ({ line, i, v: sortValue(line, sort.col, gender), dead: !line.score.class }));
  keyed.sort((a, b) => {
    if (a.dead !== b.dead) return a.dead ? 1 : -1;
    if (a.v === b.v) return a.i - b.i;
    if (a.v === undefined) return 1;
    if (b.v === undefined) return -1;
    return (a.v < b.v ? -1 : 1) * sort.dir;
  });
  return keyed.map((k) => k.line);
}

const weighted = (s: Stat): boolean => scoring().weightedStats.includes(s);

const BASIS_LABELS: Record<ScoreBasis, string> = { 'caps-lb': 'Caps+LB', caps: 'Caps', growths: 'Growths' };
const capsHeader = () =>
  support() ? 'Pair-up bonus' : basis() === 'growths' ? 'Growth in class' : `Effective caps${basis() === 'caps-lb' ? ' + LB' : ''}`;

function scoreCell(line: Line): HTMLElement {
  const { score } = line;
  const tag = score.attack
    ? h('sup', { class: 'tag', title: score.attack === 'S' ? 'Scored on Str' : 'Scored on Mag' }, score.attack)
    : null;
  const text = !score.class ? '' : score.score === undefined ? '—' : String(score.score);
  return h(
    'td',
    { class: 'num score gstart', title: score.raw === undefined ? '' : `raw ${score.raw}` },
    text,
    tag,
    line.range ? h('div', { class: 'range' }, line.range) : null,
  );
}

/** The Speed tint class (bp0 = below every breakpoint) and hover text for a Speed total. */
function speedTint(speed: SpeedReading): { cls: string; title: string } {
  const bps = engine.breakpoints();
  // One tint per breakpoint cleared (bp1 = the lowest); a list longer than five shares the top tint.
  const step = speed.cleared === undefined ? 0 : Math.min(5, bps.indexOf(speed.cleared) + 1);
  const target = targetOf(prefs, engine);
  const title =
    speed.cleared === undefined
      ? `Below every breakpoint (${bps[0]})`
      : `Clears ${speed.cleared} by ${speed.over}` + (target === null ? '' : speed.total >= target ? ` · meets target ${target}` : ` · ${target - speed.total} short of target ${target}`);
  return { cls: `bp${step}`, title };
}

/** `63 · 60 (+3)`: the total, then the breakpoint cleared and by how much. */
const speedText = (speed: SpeedReading): (HTMLElement | string)[] => [
  h('b', {}, String(speed.total)),
  speed.cleared === undefined ? h('span', { class: 'muted' }, ' · —') : ` · ${speed.cleared} (+${speed.over})`,
];

/** `63 · 60 (+3)`, tinted by the breakpoint cleared (none: below every breakpoint). */
function speedCell(speed: SpeedReading | undefined): HTMLElement {
  if (!speed) return h('td', { class: 'num spd gstart' }, '');
  const { cls, title } = speedTint(speed);
  return h('td', { class: `num spd gstart ${cls}`, title }, ...speedText(speed));
}

/** Support role: the Spd pair-up bonus the unit gives its lead. */
function pairUpSpdCell(values: PairingScore['values']): HTMLElement {
  return h('td', { class: 'num spd gstart' }, values ? h('b', {}, `+${values.spd}`) : '');
}

/** The class scored in, `(Auto)` when Auto chose it; undefined when unreachable. */
const classLabel = (score: PairingScore, gender: Gender) =>
  score.class && `${engine.className(score.class, gender)}${score.auto ? ' (Auto)' : ''}`;

function lineRow(line: Line, gender: Gender, cls: string, head: HTMLElement): HTMLElement {
  const { score, result: r } = line;
  const values = score.values;
  const cells: HTMLElement[] = [
    head,
    h(
      'td',
      { class: 'cls gstart' },
      classLabel(score, gender) ?? h('span', { class: 'muted' }, 'unreachable'),
    ),
    scoreCell(line),
  ];
  if (prefs.cols.speed) cells.push(support() ? pairUpSpdCell(values) : speedCell(score.speed));
  if (prefs.cols.caps) {
    // In the Support role the values are pair-up bonuses, and HP gets none.
    const cap = (s: Stat) => (!values ? '' : !support() ? String(values[s]) : s === 'hp' ? '—' : `+${values[s]}`);
    cells.push(...STATS.map((s, i) => h('td', { class: `num gcap${i === 0 ? ' gstart' : ''}${weighted(s) ? ' weighted' : ''}` }, cap(s))));
  }
  if (prefs.cols.mods) {
    cells.push(
      ...MOD_STATS.map((s, i) =>
        h('td', { class: `num gmod ${tone(r.modifiers[s])}${i === 0 ? ' gstart' : ''}` }, signed(r.modifiers[s])),
      ),
    );
  }
  if (prefs.cols.growths) {
    cells.push(...STATS.map((s, i) => h('td', { class: `num ggro${i === 0 ? ' gstart' : ''}` }, String(r.growths[s]))));
  }
  cells.push(
    h('td', { class: 'num gstart muted', title: r.classSet.map((c) => engine.className(c, gender)).join(', ') }, String(r.classSet.length)),
  );
  return h(
    'tr',
    { 'data-key': r.key, class: [cls, score.class ? '' : 'unreachable'].filter(Boolean).join(' ') || undefined },
    ...cells,
  );
}

/** Lines for a child's groups: single pairings as they are, Robin groups as their pinned or best asset/flaw. */
function linesFor(child: ChildId, groups: readonly PairingGroup[], sc: Scoring): Line[] {
  return groups.map((g) => {
    if (g.results.length === 1) {
      const r = g.results[0]!;
      return { label: g.label, result: r, score: sc.get(r.key) };
    }
    const { best, range } = sc.groupBest(g);
    const pin = g.results.find((r) => r.key === pinned.get(groupId(child, g)));
    const shown = pin ?? best;
    return {
      label: g.label,
      result: shown,
      score: sc.get(shown.key),
      group: g,
      range: range && range.lo !== range.hi ? `${range.lo}–${range.hi}` : undefined,
      pinned: !!pin,
    };
  });
}

/** Red (this parent's worst combo) through green (its best). */
const heatColour = (position: number | undefined) =>
  position === undefined ? 'transparent' : `hsl(${Math.round(position * 120)} 55% 30%)`;

/** The asset × flaw heatmap under an open Robin group row; clicking a cell pins it into the row, again unpins. */
function heatmapRow(child: ChildId, line: Line, gender: Gender, sc: Scoring, ncols: number): HTMLElement {
  const g = line.group!;
  const map = sc.heatmap(g)!;
  const byAF = new Map(map.cells.map((c) => [`${c.asset}/${c.flaw}`, c]));
  const shownKey = line.result.key;
  const fmt = (v: number | undefined) => (v === undefined ? '—' : v.toFixed(1));
  const morgan = !!line.result.pairing.fixedRobin;

  const grid = h(
    'table',
    { class: 'heat', 'aria-label': `${g.label}: score by Robin’s asset and flaw` },
    h(
      'thead',
      {},
      h('tr', {}, h('th', { scope: 'col', class: 'corner' }, 'asset ↓ flaw →'), ...STATS.map((f) => h('th', { scope: 'col' }, `−${STAT_LABELS[f]}`))),
    ),
    h(
      'tbody',
      {},
      ...STATS.map((a) =>
        h(
          'tr',
          {},
          h('th', { scope: 'row' }, `+${STAT_LABELS[a]}`),
          ...STATS.map((f) => {
            const c = byAF.get(`${a}/${f}`);
            if (!c) return h('td', { class: 'diag', 'aria-hidden': 'true' });
            const s = sc.get(c.key);
            const isPinned = pinned.get(groupId(child, g)) === c.key;
            const detail = [
              c.label,
              s.class ? engine.className(s.class, gender) : 'unreachable',
              support() ? (s.values ? `Spd pair-up +${s.values.spd}` : '') : s.speed ? `Spd ${s.speed.total}` : '',
              c === map.best ? 'best' : '',
              isPinned ? 'pinned: click to unpin' : 'click to pin',
            ].filter(Boolean);
            return h(
              'td',
              {
                class: ['cell', c === map.best ? 'best' : '', c.key === shownKey ? 'shown' : ''].filter(Boolean).join(' '),
                style: `background:${heatColour(c.position)}`,
                title: detail.join(' · '),
                role: 'button',
                tabindex: '0',
                'aria-pressed': String(isPinned),
                onclick: () => togglePin(child, g, c.key),
                onkeydown: (e) => {
                  const k = (e as KeyboardEvent).key;
                  if (k === 'Enter' || k === ' ') (e.preventDefault(), togglePin(child, g, c.key));
                },
              },
              fmt(c.scaled),
            );
          }),
        ),
      ),
    ),
  );
  const note = h(
    'div',
    { class: 'heatnote muted small' },
    h('div', {}, 'Best for ', h('b', {}, presetLabel(currentPreset())), ': ', h('span', { class: 'af' }, map.best.label), ` → ${fmt(map.best.scaled)}`),
    h(
      'div',
      {},
      'Row shows: ',
      h('span', { class: 'af' }, engine.robinLabel(line.result.pairing) ?? ''),
      line.pinned ? h('span', {}, ' (pinned; click it again to go back to best) ', h('button', { class: 'ghost', onclick: () => togglePin(child, g, shownKey) }, 'Unpin')) : ' (best)',
    ),
    map.spread ? h('div', {}, `Colour: red = worst, green = best combo for this parent (${fmt(map.spread.lo)}–${fmt(map.spread.hi)}).`) : null,
    h('div', {}, 'Click a cell to pin that combo into the row. Outline = best, ring = shown.'),
    morgan ? h('div', {}, 'This is the fixed Robin’s asset/flaw.') : null,
  );
  return h('tr', { class: 'heat-row' }, h('td', { colspan: String(ncols) }, h('div', { class: 'heatwrap' }, grid, note)));
}

function togglePin(child: ChildId, g: PairingGroup, key: string): void {
  const id = groupId(child, g);
  if (pinned.get(id) === key) pinned.delete(id);
  else pinned.set(id, key);
  renderParts(['main']);
}

/** The rows a line renders to: itself, plus the asset × flaw heatmap when its Robin group is open. */
function rowsFor(child: ChildId, line: Line, gender: Gender, sc: Scoring, ncols: number): HTMLElement[] {
  const g = line.group;
  if (!g) return [lineRow(line, gender, '', h('th', { class: 'stick', scope: 'row' }, line.label, warnMark([line.result])))];
  const id = groupId(child, g);
  const open = expanded.has(id);
  const head = h(
    'th',
    { class: 'stick', scope: 'row' },
    h(
      'button',
      {
        class: 'expander',
        'aria-expanded': String(open),
        title: `${open ? 'Hide' : 'Show'} the asset × flaw heatmap of Robin’s ${g.results.length} combos`,
        onclick: () => {
          if (open) expanded.delete(id);
          else expanded.add(id);
          renderParts(['main']);
        },
      },
      open ? '▾ ' : '▸ ',
      line.label,
    ),
    h(
      'span',
      { class: `af${line.pinned ? ' pinned' : ''}`, title: line.pinned ? 'Pinned asset/flaw' : `Best of ${g.results.length} asset/flaw pairings` },
      ` ${engine.robinLabel(line.result.pairing) ?? ''}`,
    ),
    line.pinned ? h('span', { class: 'muted small' }, ' 📌') : null,
    warnMark(g.results),
  );
  const rows = [lineRow(line, gender, 'group-row', head)];
  if (open) rows.push(heatmapRow(child, line, gender, sc, ncols));
  return rows;
}

function sortHeader(col: SortCol, label: string, cls = '', title?: string): HTMLElement {
  const on = sort.col === col;
  return h(
    'th',
    {
      class: `sortable ${cls}${on ? ' sorted' : ''}`,
      scope: 'col',
      title,
      'aria-sort': on ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined,
      onclick: () => {
        // Text columns start ascending, numbers descending.
        const firstDir = col === 'parent' || col === 'class' ? 1 : -1;
        sort = on ? { col, dir: sort.dir === 1 ? -1 : 1 } : { col, dir: firstDir };
        renderParts(['main']);
      },
    },
    label,
    on ? (sort.dir > 0 ? ' ▴' : ' ▾') : '',
  );
}

const COLUMN_GROUPS: readonly { id: ColumnGroup; label: string }[] = [
  { id: 'caps', label: 'caps' },
  { id: 'mods', label: 'mods' },
  { id: 'growths', label: 'growths' },
  { id: 'speed', label: 'speed' },
];

function columnToggles(): HTMLElement {
  return h(
    'span',
    { class: 'coltog' },
    'Columns:',
    ...COLUMN_GROUPS.map((c) =>
      h(
        'label',
        {},
        h('input', {
          type: 'checkbox',
          checked: prefs.cols[c.id],
          onchange: (e) => setPrefs({ cols: { ...prefs.cols, [c.id]: (e.target as HTMLInputElement).checked } }, ['main']),
        }),
        c.label,
      ),
    ),
  );
}

function childTable(child: ChildId): HTMLElement[] {
  const summary = engine.children().find((c) => c.id === child)!;
  const sc = scoring();
  const pairingFilter: PairingFilter = { parent: filter.parent, secondGen: filter.secondGen };
  const groups = engine.groups(child, pairingFilter);
  const allGroups = engine.groups(child).length;
  const cols = prefs.cols;
  const ncols = 1 + 2 + (cols.speed ? 1 : 0) + (cols.caps ? STATS.length : 0) + (cols.mods ? MOD_STATS.length : 0) + (cols.growths ? STATS.length : 0) + 1;
  const lines = sortLines(linesFor(child, groups, sc), summary.gender);
  const rows = lines.flatMap((l) => rowsFor(child, l, summary.gender, sc, ncols));
  const shown = rows.slice(0, limit);

  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, summary.name),
    h(
      'span',
      { class: 'muted' },
      `Fixed parent: ${summary.fixedParentName} · ${summary.pairingCount} pairings` +
        (groups.length < allGroups ? ` · ${groups.length} of ${allGroups} parents shown` : ''),
    ),
    columnToggles(),
    h(
      'button',
      { class: 'only-phone', 'aria-expanded': String(sheetOpen), onclick: () => ((sheetOpen = true), renderParts(['panel'])) },
      'Scoring ⚙',
    ),
  );
  // Without weights (Rallybot / Dancer) Auto has nothing to maximise and rows show their start class.
  const classHead = prefs.classMode === 'auto' && scoreSettings().weights ? 'Class (Auto)' : 'Class';
  const table = h(
    'table',
    { class: 'grid' },
    h(
      'thead',
      {},
      h(
        'tr',
        { class: 'grp' },
        h('th', { class: 'stick' }, ''),
        h('th', { colspan: '2', class: 'gstart' }, 'Result'),
        cols.speed ? h('th', { class: 'gstart' }, '') : null,
        cols.caps
          ? h('th', { colspan: String(STATS.length), class: 'gcap gstart', title: capsTitle() }, `${capsHeader()} (${BASIS_LABELS[basis()]})`)
          : null,
        cols.mods ? h('th', { colspan: String(MOD_STATS.length), class: 'gmod gstart', title: 'father + mother + 1' }, 'Max-stat modifiers') : null,
        cols.growths
          ? h('th', { colspan: String(STATS.length), class: 'gstart', title: 'floor((father + mother + child) / 3), before class growths' }, 'Inherited growths')
          : null,
        h('th', { class: 'gstart' }, ''),
      ),
      h(
        'tr',
        {},
        sortHeader('parent', 'Variable parent', 'stick'),
        sortHeader('class', classHead, 'gstart'),
        sortHeader('score', 'Score', 'num gstart'),
        ...(cols.speed ? [sortHeader('speed', support() ? 'Pair-up Spd' : 'Speed', 'num gstart', speedTitle())] : []),
        ...(cols.caps
          ? STATS.map((s, i) => sortHeader(`cap:${s}`, STAT_LABELS[s], `num gcap${i === 0 ? ' gstart' : ''}${weighted(s) ? ' weighted' : ''}`))
          : []),
        ...(cols.mods ? MOD_STATS.map((s, i) => sortHeader(`mod:${s}`, STAT_LABELS[s], `num gmod${i === 0 ? ' gstart' : ''}`)) : []),
        ...(cols.growths ? STATS.map((s, i) => sortHeader(`growth:${s}`, STAT_LABELS[s], `num${i === 0 ? ' gstart' : ''}`)) : []),
        sortHeader('count', '#Cls', 'num gstart', 'Base classes in the class set (hover a count to list them)'),
      ),
    ),
    h(
      'tbody',
      {},
      ...shown,
      rows.length > limit
        ? h(
            'tr',
            { class: 'more' },
            h(
              'td',
              { colspan: String(ncols) },
              h(
                'button',
                { onclick: () => ((limit += MORE), renderParts(['main'])) },
                `Show ${Math.min(MORE, rows.length - limit)} more`,
              ),
              h('span', { class: 'muted' }, ` · ${limit} of ${rows.length} rows shown`),
            ),
          )
        : null,
    ),
  );
  return [head, h('div', { class: 'scroll' }, table)];
}

// ---- leaderboard ----

const ROBIN_MODE_NAMES = { all: 'All', best: 'Best per pairing', pick: 'Pick one' } as const;
const BOARD_SORT_NAMES = { score: 'Score', speed: 'Spd' } as const;

function setBoard(next: Partial<typeof board>): void {
  board = { ...board, ...next };
  limit = FIRST_PAGE;
  renderParts(['main']);
}

/** Robin mode, the combo Pick shows, and the sort. */
function boardControls(): HTMLElement {
  const statSelect = (label: string, value: Stat, options: readonly Stat[], sign: string, onpick: (s: Stat) => void) =>
    h(
      'select',
      { 'aria-label': label, onchange: (e) => onpick((e.target as HTMLSelectElement).value as Stat) },
      ...options.map((s) => h('option', { value: s, selected: s === value }, `${sign}${STAT_LABELS[s]}`)),
    );
  const { asset, flaw } = board.pick;
  return h(
    'div',
    { class: 'board-controls' },
    segmented('Robin', ['all', 'best', 'pick'] as const, board.robin, ROBIN_MODE_NAMES, (robin) => setBoard({ robin })),
    board.robin === 'pick'
      ? h(
          'span',
          { class: 'blk pick' },
          statSelect('Robin’s asset', asset, STATS, '+', (a) => setBoard({ pick: { asset: a, flaw: a === flaw ? STATS.find((s) => s !== a)! : flaw } })),
          statSelect('Robin’s flaw', flaw, STATS.filter((s) => s !== asset), '−', (f) => setBoard({ pick: { asset, flaw: f } })),
        )
      : null,
    segmented('Sort', ['score', 'speed'] as const, board.sort, BOARD_SORT_NAMES, (sort) => setBoard({ sort })),
  );
}

/** A card's per-stat values: what the score counts, as bars scaled to the highest value of that stat on the board. */
function barStrip(e: LeaderboardEntry, statMax: Readonly<Record<Stat, number>>): HTMLElement {
  const values = e.score.values;
  const stats = support() ? STATS.filter((s) => s !== 'hp') : STATS;
  return h(
    'div',
    { class: 'bars', 'aria-label': capsHeader() },
    ...stats.map((s) => {
      const v = values?.[s];
      const pct = v === undefined || statMax[s] <= 0 ? 0 : Math.max(0, Math.min(100, (v / statMax[s]) * 100));
      return h(
        'div',
        { class: `bar${weighted(s) ? ' weighted' : ''}`, title: `${STAT_LABELS[s]} ${v === undefined ? '—' : support() ? `+${v}` : v}` },
        h('span', { class: 'lbl' }, STAT_LABELS[s]),
        h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${pct.toFixed(1)}%` })),
        h('span', { class: 'num' }, v === undefined ? '—' : support() ? `+${v}` : String(v)),
      );
    }),
  );
}

/** Inherited growth, max-stat modifier and effective cap in the scored class, plus what's scored when that differs. */
function matrix(e: LeaderboardEntry): HTMLElement {
  const { result: r, score } = e;
  const lb = basis() !== 'caps';
  const caps = score.class && engine.effectiveCaps(r, score.class, lb);
  const row = (label: string, title: string, cell: (s: Stat) => HTMLElement | string) =>
    h('tr', {}, h('th', { scope: 'row', title }, label), ...STATS.map((s) => h('td', { class: 'num' }, cell(s))));
  const mod = (s: Stat) => (s === 'hp' ? '—' : h('span', { class: tone(r.modifiers[s]) }, signed(r.modifiers[s])));
  const rows = [
    row('Growth', 'Inherited growth: floor((father + mother + child) / 3), before class growths', (s) => String(r.growths[s])),
    row('Mod', 'Max-stat modifier: father + mother + 1', mod),
    row('Cap', `Effective cap in the scored class: class max + modifier${lb ? ' + 10 (not HP) with Limit Breaker' : ''}`, (s) =>
      caps ? String(caps[s]) : '—',
    ),
  ];
  if (score.values && (support() || basis() === 'growths')) {
    rows.push(
      row(support() ? 'Pair-up' : 'In class', capsTitle(), (s) => (support() ? (s === 'hp' ? '—' : `+${score.values![s]}`) : String(score.values![s]))),
    );
  }
  return h(
    'table',
    { class: 'matrix' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...STATS.map((s) => h('th', { scope: 'col', class: weighted(s) ? 'weighted' : undefined }, STAT_LABELS[s])))),
    h('tbody', {}, ...rows),
  );
}

function card(e: LeaderboardEntry, statMax: Readonly<Record<Stat, number>>): HTMLElement {
  const { score, result: r } = e;
  const tint = score.speed && speedTint(score.speed);
  const open = openCards.has(r.key);
  const speed = support()
    ? score.values && h('span', { class: 'chip spd', title: 'Spd pair-up bonus to its lead' }, `Spd +${score.values.spd}`)
    : score.speed && tint && h('span', { class: `chip spd ${tint.cls}`, title: tint.title }, 'Spd ', ...speedText(score.speed));
  const toggle = () => {
    if (open) openCards.delete(r.key);
    else openCards.add(r.key);
    const next = card(e, statMax);
    const focused = document.activeElement === el;
    el.replaceWith(next);
    if (focused) next.focus();
  };
  const el = h(
    'article',
    {
      class: `card${open ? ' open' : ''}${score.class ? '' : ' unreachable'}`,
      'data-key': r.key,
      role: 'button',
      tabindex: '0',
      'aria-expanded': String(open),
      title: open ? 'Hide the growth / modifier / cap matrix' : 'Show the growth / modifier / cap matrix',
      onclick: toggle,
      onkeydown: (ev) => {
        const k = (ev as KeyboardEvent).key;
        if ((k === 'Enter' || k === ' ') && ev.target === el) (ev.preventDefault(), toggle());
      },
    },
    h('div', { class: 'rank num' }, `#${e.rank}`),
    h(
      'div',
      { class: 'big num', title: score.raw === undefined ? '' : `raw ${score.raw}` },
      !score.class ? '' : score.score === undefined ? '—' : String(score.score),
      score.attack ? h('sup', { class: 'tag', title: score.attack === 'S' ? 'Scored on Str' : 'Scored on Mag' }, score.attack) : null,
    ),
    h(
      'div',
      { class: 'who' },
      h('b', {}, e.child),
      ' × ',
      e.parent,
      e.robin ? h('span', { class: 'chip af' }, e.robin) : null,
      warnMark([r]),
    ),
    h(
      'div',
      { class: 'meta' },
      h('span', { class: 'cls' }, classLabel(score, e.gender) ?? 'unreachable'),
      speed ?? null,
    ),
    barStrip(e, statMax),
    open ? matrix(e) : null,
  );
  return el;
}

function leaderboard(): HTMLElement[] {
  const sc = scoring();
  const entries = sc.leaderboard({ robin: board.robin === 'pick' ? board.pick : board.robin, sort: board.sort, filter });
  const statMax = Object.fromEntries(STATS.map((s) => [s, Math.max(0, ...entries.map((e) => e.score.values?.[s] ?? 0))])) as Record<Stat, number>;
  const shown = entries.slice(0, limit);
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, 'All children'),
    h('span', { class: 'muted' }, `${entries.length} pairings · ${presetLabel(currentPreset())} · bars: ${capsHeader()} (${BASIS_LABELS[basis()]})`),
    boardControls(),
    h(
      'button',
      { class: 'only-phone', 'aria-expanded': String(sheetOpen), onclick: () => ((sheetOpen = true), renderParts(['panel'])) },
      'Scoring ⚙',
    ),
  );
  const more =
    entries.length > limit
      ? h(
          'div',
          { class: 'more' },
          h('button', { onclick: () => ((limit += MORE), renderParts(['main'])) }, `Show ${Math.min(MORE, entries.length - limit)} more`),
          h('span', { class: 'muted' }, ` · ${limit} of ${entries.length} shown`),
        )
      : null;
  return [head, h('div', { class: 'scroll' }, h('div', { class: 'cards' }, ...shown.map((e) => card(e, statMax))), more)];
}

function speedTitle(): string {
  if (support()) return `Spd pair-up bonus this unit gives its lead, at support rank ${RANK_CHOICE_NAMES[prefs.supportRank]}`;
  const lb = basis() === 'caps' ? '' : ' + 10 (Limit Breaker)';
  return `Spd cap in the class${lb} + Rally ${prefs.rally} + Tonic ${prefs.tonic ? 2 : 0} + Pair-up ${prefs.pairUp} · highest breakpoint cleared (by how much)`;
}

function capsTitle(): string {
  const caps = `class max + modifier${basis() === 'caps-lb' ? ' + 10 (not HP) with Limit Breaker' : ''}`;
  if (support()) {
    return `What this unit gives its lead: +1/+2/+3 at 10/20/30 of (${caps}), plus the class pair-up bonus, plus the rank bonus (C/B +1, A/S +2) where the class bonus is non-zero. HP gets none.`;
  }
  if (basis() === 'growths') return 'inherited growth + class growth';
  return caps;
}

// ---- scoring panel ----

/** One slider per weight; Spd has two, to target (0–20) and beyond (0–10). */
type WeightSlider = { stat: keyof Weights; max: number; label: string; title?: string };
const WEIGHT_STATS: readonly WeightSlider[] = STATS.flatMap((s): WeightSlider[] =>
  s === 'spd'
    ? [
        { stat: 'spd', max: 20, label: 'Spd→T', title: 'Per Spd point up to the target breakpoint + margin' },
        { stat: 'spdBeyond', max: 10, label: 'Spd+', title: 'Per Spd point beyond the target breakpoint + margin' },
      ]
    : [{ stat: s, max: 10, label: STAT_LABELS[s] }],
);

const withoutEdit = (id: Preset['id']): ScoringPrefs['edits'] => {
  const { [id]: _, ...rest } = prefs.edits;
  return rest;
};

function editPreset(change: (edit: { weights: Weights; mixed: boolean }) => void): void {
  const p = currentPreset();
  const base = effectivePreset(p, prefs);
  if (!base.weights) return;
  const edit = { weights: { ...base.weights }, mixed: base.mixed };
  change(edit);
  prefs = { ...prefs, edits: { ...prefs.edits, [p.id]: edit } };
  if (!isModified(p, edit)) prefs = { ...prefs, edits: withoutEdit(p.id) };
  savePrefs(prefs);
}

/** A button group; `disabled` gives the reason an option can't be picked, if it can't. */
function segmented<T extends string>(
  label: string,
  options: readonly T[],
  current: T,
  names: Record<T, string>,
  onpick: (v: T) => void,
  disabled: (v: T) => string | undefined = () => undefined,
): HTMLElement {
  return h(
    'div',
    { class: 'blk', role: 'group', 'aria-label': label },
    h('span', { class: 'lbl' }, label),
    h(
      'span',
      { class: 'seg' },
      ...options.map((o) =>
        h(
          'button',
          { class: o === current ? 'on' : '', 'aria-pressed': String(o === current), disabled: !!disabled(o), title: disabled(o), onclick: () => onpick(o) },
          names[o],
        ),
      ),
    ),
  );
}

const ROLE_NAMES: Record<ScoringRole, string> = { lead: 'Lead', support: 'Support' };
const RANK_CHOICE_NAMES: Record<SupportRank, string> = { none: '—', C: 'C/B', B: 'C/B', A: 'A/S', S: 'A/S' };
/** The rank input's choice for a rank: C/B and A/S each give the same bonus. */
const rankChoice = (r: SupportRank): SupportRank => (r === 'B' ? 'C' : r === 'S' ? 'A' : r);

/** Lead/Support, set by the preset; picking the other one overrides it until ↺ or a new preset. */
function roleControl(): HTMLElement {
  const fromPreset = currentPreset().role ?? 'lead';
  const el = segmented('Role', ROLES, role(), ROLE_NAMES, (r) => setPrefs({ role: r === fromPreset ? 'preset' : r }));
  if (prefs.role !== 'preset') {
    el.append(h('button', { class: 'ghost', title: 'Follow the preset’s role', onclick: () => setPrefs({ role: 'preset' }) }, '↺'));
  }
  return el;
}

const TIER_LABELS: Record<ClassSummary['tier'], string> = { base: 'Base', advanced: 'Advanced', special: 'Special' };

function panel(): HTMLElement[] {
  const p = currentPreset();
  const { weights, mixed } = effectivePreset(p, prefs);
  const modified = isModified(p, prefs.edits[p.id]);
  const tiers = ['base', 'advanced', 'special'] as const;

  const presetSelect = h(
    'select',
    {
      'aria-label': 'Preset',
      onchange: (e) => setPrefs(withPreset(prefs, (e.target as HTMLSelectElement).value as Preset['id'])),
    },
    ...engine.presets().map((q) => h('option', { value: q.id, selected: q.id === p.id }, presetLabel(q))),
  );

  const sliders = weights
    ? h(
        'div',
        { class: 'weights' },
        ...WEIGHT_STATS.map(({ stat, max, label, title }) => {
          const out = h('b', { class: 'num' }, String(weights[stat]));
          // Support scores the Spd pair-up bonus linearly at Spd→T: there's no beyond.
          const off = stat === 'spdBeyond' && support();
          return h(
            'label',
            { class: `w${off ? ' off' : ''}`, title: off ? 'No Spd beyond in the Support role: the Spd pair-up bonus scores at Spd→T' : title },
            h('span', {}, label),
            h('input', {
              type: 'range',
              min: '0',
              max: String(max),
              step: '1',
              value: String(weights[stat]),
              disabled: off,
              'aria-label': `${label} weight`,
              oninput: (e) => {
                const v = Number((e.target as HTMLInputElement).value);
                out.textContent = String(v);
                editPreset((edit) => (edit.weights = { ...edit.weights, [stat]: v }));
                // Keep the slider being dragged: refresh the preset name in place, re-render only the results.
                const opt = presetSelect.querySelector<HTMLOptionElement>(`option[value="${p.id}"]`);
                if (opt) opt.textContent = presetLabel(p);
                resetButton.hidden = !isModified(p, prefs.edits[p.id]);
                renderParts(['rail', 'main']);
              },
            }),
            out,
          );
        }),
        h(
          'label',
          { class: 'w mixed', title: 'Score whichever of Str or Mag is higher, at the higher of their weights' },
          h('input', {
            type: 'checkbox',
            checked: mixed,
            onchange: (e) => {
              editPreset((edit) => (edit.mixed = (e.target as HTMLInputElement).checked));
              renderParts(['rail', 'main', 'panel']);
            },
          }),
          ' Mixed (max Str/Mag)',
        ),
      )
    : h('p', { class: 'muted' }, 'Rallybot / Dancer isn’t ranked on stats: scores show “—”.');

  const resetButton = h(
    'button',
    {
      class: 'ghost',
      hidden: !modified,
      title: 'Back to the curated weights',
      onclick: () => {
        setPrefs({ edits: withoutEdit(p.id) });
      },
    },
    '↺ Reset',
  );

  return [
    h(
      'div',
      { class: 'panel-head' },
      h('h3', {}, 'Scoring'),
      h('button', { class: 'only-phone ghost', 'aria-label': 'Close scoring', onclick: () => ((sheetOpen = false), renderParts(['panel'])) }, '✕'),
    ),
    h('label', { class: 'blk' }, h('span', { class: 'lbl' }, 'Preset'), presetSelect, resetButton),
    ...(weights ? [roleControl()] : []),
    ...(support() && weights
      ? [segmented('Support rank', RANK_CHOICES, rankChoice(prefs.supportRank), RANK_CHOICE_NAMES, (supportRank) => setPrefs({ supportRank }))]
      : []),
    segmented('Basis', BASES, basis(), BASIS_LABELS, (basis) => setPrefs({ basis }), (b) =>
      engine.scoreBases(role()).includes(b) ? undefined : 'Not in the Support role: the pair-up bonus comes from caps',
    ),
    h(
      'label',
      { class: 'blk' },
      h('span', { class: 'lbl' }, 'Class'),
      h(
        'select',
        {
          'aria-label': 'Class for caps and score',
          onchange: (e) => setPrefs({ classMode: (e.target as HTMLSelectElement).value as ClassMode }),
        },
        h('option', { value: 'auto', selected: prefs.classMode === 'auto' }, 'Auto (best final-tier class per row)'),
        ...tiers.map((t) =>
          h(
            'optgroup',
            { label: TIER_LABELS[t] },
            ...engine
              .classes()
              .filter((c) => c.tier === t)
              .map((c) => h('option', { value: c.id, selected: c.id === prefs.classMode }, `${c.name}${c.dlc ? ' (DLC)' : ''}`)),
          ),
        ),
      ),
    ),
    h('h4', {}, 'Weights ', h('span', { class: 'muted small' }, 'per stat point')),
    sliders,
    ...speedControls(),
    h('h4', {}, 'Filters'),
    h(
      'div',
      { class: 'blk col' },
      h('input', {
        type: 'search',
        placeholder: 'Variable parent…',
        'aria-label': 'Filter by variable parent',
        value: filter.parent,
        oninput: (e) => {
          filter = { ...filter, parent: (e.target as HTMLInputElement).value };
          limit = FIRST_PAGE;
          renderParts(['main']);
        },
      }),
      h(
        'label',
        {},
        h('input', {
          type: 'checkbox',
          checked: filter.secondGen,
          onchange: (e) => {
            filter = { ...filter, secondGen: (e.target as HTMLInputElement).checked };
            limit = FIRST_PAGE;
            renderParts(['main']);
          },
        }),
        ' Second-gen parents (Morgan)',
      ),
      h(
        'label',
        {
          title: engine.contextReachesDlc(prefs.context)
            ? `DLC is reachable in ${CONTEXT_LABELS[prefs.context]}: Auto can pick DLC classes`
            : 'Let Auto pick DLC classes (Dread Fighter, Bride)',
        },
        h('input', {
          type: 'checkbox',
          checked: dlcReachable(prefs, engine),
          disabled: engine.contextReachesDlc(prefs.context),
          onchange: (e) => setPrefs({ dlc: (e.target as HTMLInputElement).checked }),
        }),
        ' DLC classes',
      ),
    ),
  ];
}

// ---- speed ----

const RALLY_NAMES: Record<string, string> = { '0': 'None', '4': '+4', '8': '+8', '10': '+10' };
const RANK_NAMES: Record<SupportRank, string> = { none: '—', C: 'C', B: 'B', A: 'A', S: 'S' };
const RAW_SPD_TIERS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'under 10' },
  { value: 10, label: '10+' },
  { value: 20, label: '20+' },
  { value: 30, label: '30+' },
];

/** An integer input 0–max; an invalid entry is discarded on re-render. */
function numberInput(label: string, value: number, max: number, onset: (v: number) => void): HTMLElement {
  return h('input', {
    type: 'number',
    min: '0',
    max: String(max),
    step: '1',
    value: String(value),
    'aria-label': label,
    class: 'numin',
    onchange: (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (Number.isInteger(v) && v >= 0 && v <= max) onset(v);
      else renderParts(['panel']);
    },
  });
}

/** Pair-up Spd from a support's class, rank and raw Spd; "Use" copies it into Pair-up Spd. */
function pairUpHelper(): HTMLElement {
  const classes = engine.classes().filter((c) => engine.pairUpSpd(c.id, 'none', 0) > 0);
  const value = engine.pairUpSpd(helper.cls, helper.rank, helper.rawSpd);
  const setHelper = (next: Partial<typeof helper>) => {
    helper = { ...helper, ...next };
    renderParts(['panel']);
  };
  return h(
    'details',
    { class: 'helper' },
    h('summary', { class: 'muted small' }, 'Helper: from a support’s class and rank'),
    h(
      'div',
      { class: 'blk' },
      h(
        'select',
        { 'aria-label': 'Support class', onchange: (e) => setHelper({ cls: (e.target as HTMLSelectElement).value as ClassId }) },
        ...classes.map((c) =>
          h('option', { value: c.id, selected: c.id === helper.cls }, `${c.name} (Spd +${engine.pairUpSpd(c.id, 'none', 0)})`),
        ),
      ),
      h(
        'select',
        { 'aria-label': 'Support’s raw Spd', onchange: (e) => setHelper({ rawSpd: Number((e.target as HTMLSelectElement).value) }) },
        ...RAW_SPD_TIERS.map((t) => h('option', { value: String(t.value), selected: t.value === helper.rawSpd }, `raw Spd ${t.label}`)),
      ),
    ),
    segmented('Rank', RANKS, helper.rank, RANK_NAMES, (rank) => setHelper({ rank })),
    h(
      'div',
      { class: 'blk' },
      h('span', {}, 'Pair-up Spd ', h('b', { class: 'num' }, `+${value}`)),
      h('button', { disabled: value === prefs.pairUp, onclick: () => setPrefs({ pairUp: value }) }, 'Use'),
    ),
  );
}

/** Rally, Tonic, Pair-up Spd, the target breakpoint and the speed margin. */
function speedControls(): HTMLElement[] {
  const def = engine.defaultTargetBreakpoint(prefs.context);
  const target = targetOf(prefs, engine);
  const bps = engine.breakpoints();
  const listed = target === null || bps.includes(target) ? bps : [...bps, target].sort((a, b) => a - b);
  const assumedDefault = def.assumption && engine.assumptions().find((a) => a.id === def.assumption);
  const warn =
    prefs.target === 'context' && assumedDefault
      ? h('span', { class: 'warn', title: `Assumption: ${assumedDefault.label} = ${assumedDefault.current}` }, ' ⚠')
      : null;
  return [
    h('h4', {}, 'Speed ', h('span', { class: 'muted small' }, 'Speed column and Spd curve')),
    segmented('Rally', RALLY_OPTIONS.map(String), String(prefs.rally), RALLY_NAMES, (v) => setPrefs({ rally: Number(v) })),
    h(
      'label',
      { class: 'blk' },
      h('input', { type: 'checkbox', checked: prefs.tonic, onchange: (e) => setPrefs({ tonic: (e.target as HTMLInputElement).checked }) }),
      ' Speed Tonic (+2)',
    ),
    h(
      'label',
      { class: 'blk' },
      h('span', { class: 'lbl' }, 'Pair-up Spd'),
      numberInput('Pair-up Spd', prefs.pairUp, 10, (pairUp) => setPrefs({ pairUp })),
    ),
    pairUpHelper(),
    h(
      'label',
      { class: 'blk', title: 'Spd up to target + margin scores at Spd→T, beyond it at Spd+. None: Spd is linear at Spd→T.' },
      h('span', { class: 'lbl' }, 'Target'),
      h(
        'select',
        {
          'aria-label': 'Target breakpoint',
          onchange: (e) => {
            const v = (e.target as HTMLSelectElement).value;
            setPrefs({ target: v === 'context' ? 'context' : v === 'none' ? null : Number(v) });
          },
        },
        h('option', { value: 'context', selected: prefs.target === 'context' }, `${def.value} (${CONTEXT_LABELS[prefs.context]} default)`),
        h('option', { value: 'none', selected: prefs.target === null }, 'None (Spd linear)'),
        ...listed.map((bp) => h('option', { value: String(bp), selected: prefs.target === bp }, String(bp))),
      ),
      warn,
      prefs.target === 'context'
        ? null
        : h('button', { class: 'ghost', title: 'Follow the play context’s default', onclick: () => setPrefs({ target: 'context' }) }, '↺'),
    ),
    h(
      'label',
      { class: 'blk', title: 'Extra Spd above the target that still scores at Spd→T' },
      h('span', { class: 'lbl' }, 'Margin'),
      '+',
      numberInput('Speed margin', prefs.margin, 10, (margin) => setPrefs({ margin })),
    ),
  ];
}

function contextSelect(): HTMLElement {
  return h(
    'label',
    { class: 'context', title: 'What you’re building for: sets the default target breakpoint and whether DLC is reachable' },
    h('span', { class: 'muted' }, 'Play context '),
    h(
      'select',
      { 'aria-label': 'Play context', onchange: (e) => setPrefs({ context: (e.target as HTMLSelectElement).value as PlayContext }) },
      ...CONTEXTS.map((c) => h('option', { value: c, selected: c === prefs.context }, CONTEXT_LABELS[c])),
    ),
  );
}

// ---- shell ----

type Part = 'rail' | 'main' | 'panel';
const regions: Partial<Record<Part, HTMLElement>> = {};

function renderParts(parts: readonly Part[]): void {
  const { rail: railEl, main, panel: panelEl } = regions;
  if (!railEl || !main || !panelEl) return render();
  if (parts.includes('rail')) railEl.replaceChildren(...rail());
  if (parts.includes('main')) {
    main.replaceChildren(
      ...(view === 'validation'
        ? [validationPanel({ engine, assumptions, selfTest, setOverride, resetAll: () => applyOverrides({}), render })]
        : selected === 'all'
          ? leaderboard()
          : childTable(selected)),
    );
  }
  if (parts.includes('panel')) {
    panelEl.replaceChildren(...panel());
    panelEl.classList.toggle('open', sheetOpen);
  }
}

function render(): void {
  const app = document.getElementById('app')!;
  regions.rail = h('nav', { class: 'rail', 'aria-label': 'Children' });
  regions.main = h('section', { class: 'main' });
  regions.panel = h('aside', { class: 'panel', 'aria-label': 'Scoring' });
  app.replaceChildren(
    h(
      'div',
      { class: 'shell' },
      h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'FE13 Child Calc'), contextSelect(), validationButton(selfTest)),
      regions.rail,
      regions.main,
      regions.panel,
    ),
  );
  renderParts(['rail', 'main', 'panel']);
}

render();
