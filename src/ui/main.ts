import './style.css';
import {
  MOD_STATS,
  RALLY_OPTIONS,
  STATS,
  STAT_LABELS,
  RANK_LETTERS,
  buildSortKey,
  createEngine,
  quotaContext,
  quotasFor,
  describeSource,
  resolveAssumptions,
  EMPTY_ROSTER,
  type AssumptionId,
  type Blocking,
  type BuildMatch,
  type SourceRef,
  type BuildSlotMatch,
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
  type PlanSettings,
  type PlannedChild,
  type PlayContext,
  type PresetId,
  type RobinMode,
  type Roster,
  type Preset,
  type ScoreBasis,
  type ScoreSettings,
  type Scoring,
  type ScoringRole,
  type SelfTestReport,
  type SkillCard,
  type PageSubject,
  type Pairing,
  type PageUnitId,
  type RobinRef,
  type SkillCardEdge,
  type SkillId,
  type SkillRef,
  type SkillSource,
  type SpeedReading,
  type Stat,
  type SupportRank,
  type Weights,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { guideChild } from './guide-deeper';
import { guideFacts, lossPrompt, noteLosses, settleLosses } from './guide-facts';
import { collapseDock, hasSavedRun, loadGuidePrefs, saveGuidePrefs, welcomeShows, type GuidePrefs } from './guide-prefs';
import { guideButton, guideLayer, type GuideContext } from './guide-ui';
import { BASIS_LABELS, LABELS, SCORING_ROLE_UI } from './labels';
import { loadOverrides, saveOverrides } from './overrides';
import {
  BASES,
  CONTEXTS,
  CONTEXT_LABELS,
  RANKS,
  RANK_CHOICES,
  ROLES,
  basisOf,
  changePrefs,
  dlcReachable,
  effectivePreset,
  isModified,
  loadPrefs,
  roleOf,
  savePrefs,
  scoreSettingsOf,
  speedSettings,
  targetOf,
  visitPrefs,
  withPreset,
  type ColumnGroup,
  type ScoringPrefs,
} from './scoring-prefs';
import { validationPanel, withOverride } from './validation';
import { rosterPage } from './roster-page';
import { unitsView, type UnitsContext } from './unit-page';
import { CHILD_UNITS } from '../game-data/children';
import { unitLink, type OpenUnit } from './unit-links';
import { clearRoster, loadRoster, saveRoster } from './roster-store';
import { planPage, planSidebar, type ChildPlanControls, type PlanPageContext } from './plan-page';
import {
  loadPlanPrefs,
  resetPlanPrefs,
  savePlanPrefs,
  withDeployEdited,
  withPlanPreset,
  withRoleOverride,
  withPriority,
  withQuotas,
  type PlanPrefs,
} from './plan-prefs';

/** Phone width, where the Scoring panel and the open guide dock are bottom sheets (the stylesheet's breakpoint). */
const phone = (): boolean => matchMedia('(max-width: 700px)').matches;

/** The guide's preferences: survive Clear all. On a phone the dock starts as its pill, whatever was left open. */
let guidePrefs: GuidePrefs = phone() ? collapseDock(loadGuidePrefs()) : loadGuidePrefs();
/** The welcome box is showing: by itself only for a new visitor, read before anything this visit saves. */
let welcomeOpen = welcomeShows(guidePrefs, hasSavedRun());

let overrides: Overrides = loadOverrides();
let assumptions: Assumptions = resolveAssumptions(overrides);
let engine: Engine = createEngine(assumptions);
let selfTest = engine.selfTest();
let prefs: ScoringPrefs = loadPrefs(engine);
/** Run state: read by the tables and the leaderboard, never by scoring. */
let roster: Roster = loadRoster();
// Losses already saved aren't new: the loss prompt is for those recorded from here on.
guidePrefs = noteLosses(roster, guidePrefs);
/** Plan preferences (priorities, plan presets): survive Clear all. */
let planPrefs: PlanPrefs = loadPlanPrefs(engine);
/** The Plan view's Free re-plan toggle. */
let freeReplan = false;
/** The Plan's no-Robin view (#98): view state, carried in the plan settings. */
let noRobinView = false;
/** The Plan sidebar's quota editor is open. */
let editingQuotas = false;

// View state only; all domain answers come from the engine.
/** A child's table, or the All children leaderboard. */
let selected: ChildId | 'all' = 'lucina';
/** The last child the visitor opened from the left rail, which the guide's table jumps show again. */
let childOpened: ChildId | undefined;
/** A new visitor starts on Roster, under the welcome box: setup comes first. */
type View = 'table' | 'validation' | 'roster' | 'plan' | 'units';
let view: View = !selfTest.passed ? 'validation' : welcomeOpen ? 'roster' : 'table';
/** The Units view's open unit page (#101); undefined shows the list. */
let unitOpen: PageUnitId | 'robin' | ChildId | undefined;
/** Robin's page preview (#103): page state only, never written to the Run facts. */
let robinPreview: RobinRef = { kind: 'robin', gender: 'M', asset: 'mag', flaw: 'str' };
/** Where a unit page's back link returns: the view (and unit page) it was opened from, and its scroll. */
/** A unit page's Partners show every row (view state). */
let allPartners = false;
let unitBack: { view: View; unit: PageUnitId | 'robin' | ChildId | undefined; scroll: number } | undefined;
/** A Robin group row's identity across children: `child|group key`. */
const groupId = (child: ChildId, group: PairingGroup) => `${child}|${group.key}`;
/** Robin group rows (by group id) with their asset × flaw heatmap open. */
const expanded = new Set<string>();
/** The asset/flaw pairing pinned into a Robin group row, by group id; otherwise the row shows its best. */
const pinned = new Map<string, string>();
/** The one table line (by line id) with its Skills drawer open. */
let openSkills: string | undefined;
/** The build card expanded in the open drawer (by line id); null when the user collapsed it, else the best build. */
let openBuild: { line: string; id: string | null } | undefined;
/** The skill whose Skill card is pinned atop the scoring panel, for the drawer of this line. */
let inspected: { line: string; id: SkillId } | undefined;
/** The open drawer's pairing as last rendered, which the Skill card reads; cleared on each render of the main part. */
let drawerPairing: { line: string; result: ChildResult; title: string } | undefined;
/**
 * `template`: a build template id to match every row against, or '' for each row's best build. `hideBlocked` leaves
 * out hard-blocked rows.
 */
let filter: { parent: string; secondGen: boolean; template: string; hideBlocked: boolean } = {
  parent: '',
  secondGen: true,
  template: '',
  hideBlocked: false,
};
/** The table filter as the engine takes it, with the run facts. */
const pairingFilter = (): PairingFilter => ({ parent: filter.parent, secondGen: filter.secondGen, run: roster.run });
type SortCol = 'parent' | 'class' | 'score' | 'speed' | 'build' | 'count' | `cap:${Stat}` | `mod:${Stat}` | `growth:${Stat}`;
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

/** On a phone, collapses the open guide dock (a bottom sheet there) to its pill. */
function collapseDockOnPhone(): void {
  const collapsed = phone() ? collapseDock(guidePrefs) : guidePrefs;
  if (collapsed !== guidePrefs) saveGuidePrefs((guidePrefs = collapsed));
}

/** Opens the Scoring sheet; on a phone the guide dock collapses to its pill, as only one sheet is open at a time. */
function openScoring(): void {
  sheetOpen = true;
  collapseDockOnPhone();
}
/** The Pair-up Spd helper's inputs: a support class, rank and raw Spd. */
let helper: { cls: ClassId; rank: SupportRank; rawSpd: number } = { cls: 'swordmaster', rank: 'S', rawSpd: 30 };

// ---- scoring ----

/**
 * A visit from the Plan's marriage table to a child's table: the table scores with the child's plan preset, and the
 * plan's pairing (`key`) is highlighted. View state: it ends when the visitor leaves the table or the sidebar sets the
 * preset, role or class.
 */
let visit: { child: ChildId; preset: PresetId; key: string } | undefined;
/** The planned row still to scroll into view once the table renders. */
let scrollToPlanned = false;

/** The visit, while its child's table is in view. */
const activeVisit = () => (visit && view === 'table' && selected === visit.child ? visit : undefined);
/** The prefs the view scores with: the global ones, or on a visit its plan preset (the sidebar shows and edits these). */
const viewPrefs = (): ScoringPrefs => {
  const v = activeVisit();
  return v ? visitPrefs(prefs, v.preset) : prefs;
};

const presetOf = (p: ScoringPrefs): Preset => engine.presets().find((q) => q.id === p.preset)!;
const currentPreset = (): Preset => presetOf(viewPrefs());

/** The scoring role in force: the global override, else the preset's. */
const role = (): ScoringRole => roleOf(viewPrefs(), currentPreset());
const support = () => role() === 'support';
/** The basis in force (Growths falls back to Caps+LB in the Support role). */
const basis = (): ScoreBasis => basisOf(viewPrefs(), role(), engine);

const scoreSettings = (p: ScoringPrefs = viewPrefs()): ScoreSettings => scoreSettingsOf(p, engine);

/** The last few scorings by settings: a visit's table and the rail score under different ones. */
const scoringCache = new Map<string, Scoring>();
let scoringEngine: Engine | undefined;
/** Every pairing's score under the view's settings (or `p`'s), recomputed only when they change. */
function scoring(p: ScoringPrefs = viewPrefs()): Scoring {
  const settings = scoreSettings(p);
  const k = JSON.stringify(settings);
  if (scoringEngine !== engine) {
    scoringCache.clear();
    scoringEngine = engine;
  }
  let found = scoringCache.get(k);
  if (!found) {
    // A few settings are live at once (the view's, the rail's); past that the oldest are stale.
    if (scoringCache.size >= 4) scoringCache.clear();
    scoringCache.set(k, (found = engine.score(settings)));
  }
  return found;
}

function setPrefs(next: Partial<ScoringPrefs>, parts: Part[] = ['rail', 'main', 'panel']): void {
  const change = changePrefs(prefs, activeVisit()?.preset, next);
  prefs = change.prefs;
  savePrefs(prefs);
  if (change.endsVisit) visit = undefined;
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

// ---- roster ----

/** The parts a roster change refreshes: the Plan sidebar lists the run's children. */
const rosterParts = (): Part[] => (view === 'plan' ? ['rail', 'main', 'panel'] : ['rail', 'main']);

function setRoster(next: Roster): void {
  roster = next;
  saveRoster(roster);
  renderParts(rosterParts());
}

/** A Deploy or deployment-role edit: the roster holds it, and the plan preferences note the act for the guide. */
function setDeployment(next: Roster): void {
  planPrefs = withDeployEdited(planPrefs);
  savePlanPrefs(planPrefs);
  setRoster(next);
}

function clearRosterState(): void {
  roster = EMPTY_ROSTER;
  clearRoster();
  renderParts(rosterParts());
}

// ---- marriage plan ----

function setPlanPrefs(next: PlanPrefs): void {
  planPrefs = next;
  savePlanPrefs(planPrefs);
  renderParts(['main', 'panel']);
}

/** Each child scores in its plan preset (with the user's weight edits), Auto class, and the global rest. */
const planSettings = (): PlanSettings => ({
  context: prefs.context,
  preset: prefs.preset,
  edits: prefs.edits,
  basis: prefs.basis,
  dlc: dlcReachable(prefs, engine),
  speed: speedSettings(prefs, engine),
  supportRank: prefs.supportRank,
  priorities: planPrefs.priorities,
  overrides: planPrefs.overrides,
  roleOverrides: planPrefs.roleOverrides,
  quotas: quotasFor(prefs.context, planPrefs.quotas),
  noRobin: noRobinView,
});

/** The scroll position of the main view. */
const mainScroll = (): number => regions.main?.querySelector('.scroll')?.scrollTop ?? regions.main?.scrollTop ?? 0;

/** Opens any unit's page (#107): a child's front door, Robin's page on this Robin, a first-gen unit's page. */
const openAnyUnit: OpenUnit = (u, robin) => {
  if (u !== 'maiden') openUnit(u as PageUnitId | 'robin' | ChildId, robin);
};

/** A pairing's variable parent as a link: its page, Robin's (on this Robin) or, for Morgan's child parent, its front door. */
function parentLink(pairing: Pairing, label: string): HTMLElement {
  const v = pairing.variableParent;
  return v.kind === 'robin' ? unitLink(openAnyUnit, 'robin', label, v) : unitLink(openAnyUnit, v.id, label);
}

/** Opens a unit's page, remembering where its back link returns. */
/** The Robin Robin's page shows: the run facts, with anything they leave open taken from the preview. */
const pageRobin = (): RobinRef => ({
  kind: 'robin',
  gender: roster.run.gender ?? robinPreview.gender,
  asset: roster.run.asset ?? robinPreview.asset,
  flaw: roster.run.flaw ?? (roster.run.asset && roster.run.asset === robinPreview.flaw ? robinPreview.asset : robinPreview.flaw),
});
/** The open child, when the Units view shows a front door. */
const doorOpen = (): ChildId | undefined => (unitOpen && unitOpen in CHILD_NAMES ? (unitOpen as ChildId) : undefined);
const pageSubject = (): PageSubject | undefined => (unitOpen === 'robin' ? pageRobin() : doorOpen() ? undefined : (unitOpen as PageUnitId | undefined));

function openUnit(unit: PageUnitId | 'robin' | ChildId, preview?: RobinRef): void {
  if (preview) robinPreview = preview;
  unitBack = { view, unit: view === 'units' ? unitOpen : undefined, scroll: mainScroll() };
  view = 'units';
  unitOpen = unit;
  renderParts(['rail', 'main', 'panel']);
}

const VIEW_LABELS: Readonly<Record<View, string>> = { table: 'Pairings', validation: 'Validation', roster: LABELS.roster, plan: LABELS.plan, units: 'Units' };

const unitsContext = (): UnitsContext => ({
  engine,
  settings: skillSettings(),
  unit: pageSubject(),
  door: doorOpen() && engine.frontDoor(doorOpen()!, roster, scoreSettings(prefs), prefs.context),
  children: childrenInRun().map((c) => ({ id: c.id, name: c.name })),
  openTable: (child) => {
    showTable(child);
    childOpened = child;
    renderParts(['rail', 'main', 'panel']);
  },
  open: openUnit,
  preview:
    unitOpen === 'robin' && !(roster.run.gender && roster.run.asset && roster.run.flaw)
      ? {
          open: { gender: !roster.run.gender, asset: !roster.run.asset },
          set: (r) => {
            robinPreview = r;
            renderParts(['main', 'panel']);
          },
        }
      : undefined,
  back: () => {
    const b: { view: View; unit: PageUnitId | 'robin' | ChildId | undefined; scroll: number } = unitBack ?? { view: 'units', unit: undefined, scroll: 0 };
    view = b.view;
    unitOpen = b.unit;
    unitBack = undefined;
    renderParts(['rail', 'main', 'panel']);
    const el = regions.main?.querySelector('.scroll') ?? regions.main;
    if (el) el.scrollTop = b.scroll;
  },
  backLabel: unitBack
    ? unitBack.view === 'units' && unitBack.unit
      ? unitBack.unit === 'robin'
        ? 'Robin'
        : unitBack.unit in CHILD_NAMES
          ? CHILD_NAMES[unitBack.unit as ChildId]!
          : engine.pageUnits().find((u) => u.id === unitBack!.unit)!.name
      : VIEW_LABELS[unitBack.view]
    : 'Units',
  skillChip,
  buildCard,
  roster,
  planSettings: planSettings(),
  presetLabel: (id: PresetId) => presetLabel(engine.presets().find((p) => p.id === id)!),
  openPairing: (child, key) => {
    showTable(child);
    visit = { child, preset: engine.planPreset(child, roster, planSettings()), key };
    scrollToPlanned = true;
    renderParts(['rail', 'main', 'panel']);
  },
  openPlan: () => {
    view = 'plan';
    renderParts(['rail', 'main', 'panel']);
  },
  allPartners,
  setAllPartners: (all) => {
    allPartners = all;
    renderParts(['main']);
  },
});

/** The priority and plan-preset controls: the Plan sidebar and the Roster page's ledger edit the same values. */
const planControls = (): ChildPlanControls => ({
  engine,
  roster,
  settings: planSettings(),
  setPriority: (child, priority) => setPlanPrefs(withPriority(planPrefs, child, priority)),
  setPlanPreset: (child, preset) => setPlanPrefs(withPlanPreset(planPrefs, child, preset)),
  setRoleOverride: (child, role) => setPlanPrefs(withRoleOverride(planPrefs, child, role)),
  openRoles: () => {
    view = 'plan';
    render();
    document.querySelector('[data-guide="role-matrix"]')?.scrollIntoView({ block: 'start' });
  },
  openUnit: openAnyUnit,
  openRunFacts: () => {
    view = 'roster';
    render();
    document.querySelector('[data-guide="run-facts"]')?.scrollIntoView({ block: 'start' });
  },
  presetLabel: (id: PresetId) => presetLabel(engine.presets().find((p) => p.id === id)!),
  quotas: quotasFor(prefs.context, planPrefs.quotas),
});

const planContext = (): PlanPageContext => ({
  ...planControls(),
  setRoster,
  free: freeReplan,
  setFree: (free) => {
    freeReplan = free;
    renderParts(['main']);
  },
  setNoRobin: (on) => {
    noRobinView = on;
    render();
  },
  resetPlanPrefs: () => setPlanPrefs(resetPlanPrefs(planPrefs)),
  quotasEdited: !!planPrefs.quotas[quotaContext(prefs.context)],
  setQuotas: (quotas) => setPlanPrefs(withQuotas(planPrefs, quotaContext(prefs.context), quotas)),
  editingQuotas,
  setEditingQuotas: (open) => {
    editingQuotas = open;
    renderParts(['panel']);
  },
  openChild,
});

/**
 * The child's plan preset as a chip on its table: the tables keep the global preset, and this sets it. On a visit from
 * the marriage table the table already scores with it, for this visit; the chip still makes it the global preset.
 */
function planPresetChip(child: ChildId): HTMLElement {
  const id = engine.planPreset(child, roster, planSettings());
  const name = presetLabel(engine.presets().find((p) => p.id === id)!);
  const global = id === prefs.preset && (!activeVisit() || prefs.role === 'preset');
  // On a visit the table scores differently from the global prefs unless they already match it.
  const visiting = !!activeVisit() && !(global && prefs.classMode === 'auto');
  const title = visiting
    ? `Scored with the plan preset (its scoring role, Auto class) for this visit${global ? '' : `: make ${name} the global preset`}`
    : global
      ? 'The table already scores with the plan preset'
      : `The table scores with ${presetLabel(currentPreset())}: switch the global preset to ${name}`;
  return h(
    'button',
    {
      ...guide('score-with-plan-preset'),
      class: `chip plan-preset${visiting ? ' visit' : ''}`,
      disabled: global,
      title,
      // Only the preset and its role: a visit goes on (it still scores in Auto class).
      onclick: () => setPrefs({ preset: id, role: 'preset' }),
    },
    `Plan: ${name}`,
    visiting ? ` ✓ ${LABELS.thisVisit}` : global ? ' ✓' : ` ${LABELS.scoreWithThis}`,
  );
}

/** Opens a child's table from the marriage table: scored with its plan preset for this visit, its planned pairing in view. */
function openChild(c: PlannedChild): void {
  showTable(c.child);
  visit = { child: c.child, preset: c.preset, key: c.key };
  scrollToPlanned = true;
  renderParts(['rail', 'main', 'panel']);
}

let planKeysCache: { roster: Roster; engine: Engine; keys: ReadonlySet<string> } | undefined;
/** The saved plan's pairings, which the tables mark ◆. */
function planKeys(): ReadonlySet<string> {
  if (planKeysCache?.roster !== roster || planKeysCache.engine !== engine) planKeysCache = { roster, engine, keys: engine.planKeys(roster) };
  return planKeysCache.keys;
}

/** ◆ when any of the results is in the saved plan. */
function planChip(results: readonly ChildResult[]): HTMLElement | null {
  const inPlan = results.find((r) => planKeys().has(r.key));
  if (!inPlan) return null;
  const af = results.length > 1 ? engine.robinLabel(inPlan.pairing) : undefined;
  const title = `In the saved marriage plan${af ? ` (${af})` : ''}`;
  return h('span', { class: 'chip block in-plan', title, 'aria-label': title }, LABELS.inPlan);
}

const BLOCK_CHIPS: Readonly<Record<Blocking['status'], { mark: string; label: string } | undefined>> = {
  open: undefined,
  married: { mark: '✓', label: LABELS.married },
  pinned: { mark: LABELS.pin, label: LABELS.pinned },
  soft: { mark: '!', label: 'Soft-blocked' },
  hard: { mark: '✕', label: 'Hard-blocked' },
};

/** The roster's state chip for a pairing, with every reason on hover; null when the roster says nothing about it. */
function blockChip(b: Blocking): HTMLElement | null {
  const chip = BLOCK_CHIPS[b.status];
  if (!chip && b.notes.length === 0) return null;
  const title = [chip?.label ?? '', ...b.hard.map((r) => `✕ ${r}`), ...b.soft.map((r) => `! ${r}`), ...b.notes].filter(Boolean).join('\n');
  return h('span', { class: `chip block ${b.status}`, title, 'aria-label': title }, chip?.mark ?? LABELS.assumption, chip && b.notes.length ? ` ${LABELS.assumption}` : '');
}

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
      ...guide('validation'),
      class: `validation-toggle${report.passed ? '' : ' fail'}${view === 'validation' ? ' on' : ''}`,
      title: 'Assumptions, resolved source disagreements and the self-test',
      'aria-pressed': String(view === 'validation'),
      onclick: () => {
        view = view === 'validation' ? 'table' : 'validation';
        render();
      },
    },
    `${LABELS.validation} `,
    h('span', { class: report.passed ? 'pos' : 'neg' }, `Self-test ${report.passed ? '✓' : '✕'} ${passed}/${report.cases.length}`),
    overridden > 0 ? h('span', { class: 'warn' }, ` · ${overridden} overridden`) : null,
  );
}

// ---- rail ----

/** The children with a pairing in this run (the run facts remove the other Morgan), in rail order. */
const childrenInRun = () => engine.children().filter((c) => engine.groups(c.id, { run: roster.run }).length > 0);

/**
 * Switches to a child's table or the leaderboard, with rows collapsed. A child's table opens on its plan preset (#97):
 * a visit, which the Scoring sidebar's preset ends to explore others — the plan never reads the table's preset.
 */
function showTable(id: ChildId | 'all'): void {
  selected = id;
  view = 'table';
  visit = id === 'all' ? undefined : { child: id, preset: engine.planPreset(id, roster, planSettings()), key: '' };
  expanded.clear();
  openCards.clear();
  limit = FIRST_PAGE;
}

function rail(): HTMLElement[] {
  // The rail stays on the global preset, whatever the table in view scores with.
  const sc = scoring(prefs);
  const children = engine.children();
  // Each child's best among the pairings that exist in this run (the run facts remove the other Robin and Morgan).
  const bestInRun = new Map(
    children.map((c) => {
      const scores = engine.groups(c.id, { run: roster.run }).map((g) => sc.get(sc.groupBest(g).best.key).score);
      const defined = scores.filter((s) => s !== undefined);
      return [c.id, { exists: scores.length > 0, score: defined.length ? Math.max(...defined) : undefined }];
    }),
  );
  const top = children.map((c) => bestInRun.get(c.id)!.score).filter((s) => s !== undefined);
  const item = (id: ChildId | 'all', name: string, title: string, score: number | undefined) =>
    h(
      'button',
      {
        class: `rail-item${id === 'all' ? ' all' : ''}${id === selected && view === 'table' ? ' on' : ''}`,
        title,
        onclick: () => {
          showTable(id);
          if (id !== 'all') childOpened = id;
          render();
        },
      },
      h('span', {}, name),
      h('b', { class: 'num' }, String(score ?? '—')),
    );
  const married = Object.values(roster.spouses).filter((s) => s?.bond === 'married').length / 2;
  return [
    h(
      'button',
      {
        class: `rail-item roster-item${view === 'roster' ? ' on' : ''}`,
        title: 'Run facts, unit states and marriages',
        onclick: () => {
          view = 'roster';
          render();
        },
      },
      h('span', {}, LABELS.roster),
      h('b', { class: 'num muted', title: 'Marriages' }, married ? `✓${married}` : ''),
    ),
    h(
      'button',
      {
        class: `rail-item roster-item${view === 'plan' ? ' on' : ''}`,
        title: 'The whole-roster marriage plan',
        onclick: () => {
          view = 'plan';
          render();
        },
      },
      h('span', {}, LABELS.plan),
      h('b', { class: 'num muted', title: 'A saved plan' }, roster.savedPlan ? LABELS.inPlan : ''),
    ),
    h(
      'button',
      {
        ...guide('units-rail'),
        class: `rail-item roster-item${view === 'units' ? ' on' : ''}`,
        title: 'Each unit on its own: classes, skills, builds and what it passes on',
        onclick: () => {
          view = 'units';
          unitOpen = unitBack = undefined;
          render();
        },
      },
      h('span', {}, 'Units'),
    ),
    h('div', { class: 'muted small rail-head' }, `Best · ${presetLabel(presetOf(prefs))}`),
    item('all', LABELS.allChildren, 'Leaderboard of every child’s pairings', top.length ? Math.max(...top) : undefined),
    ...children
      .filter((c) => bestInRun.get(c.id)!.exists)
      .map((c) => item(c.id, c.name, `${c.pairingCount} pairings`, bestInRun.get(c.id)!.score)),
  ];
}

// ---- table ----

/** ⚠ (`LABELS.assumption`) on a row that rests on an assumption, naming each one (and its current value) on hover. */
function warnMark(results: readonly ChildResult[]): HTMLElement | null {
  const used = new Set(results.flatMap((r) => r.assumptionsUsed));
  if (used.size === 0) return null;
  const title = engine
    .assumptions()
    .filter((a) => used.has(a.id))
    .map((a) => `Assumption: ${a.label} = ${a.current}${a.isDefault ? '' : ' (overridden)'}`)
    .join('\n');
  return h('span', { class: 'warn', title, 'aria-label': title }, ` ${LABELS.assumption}`);
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
  /** On a visit from the marriage table: the line holds the plan's pairing (a Robin group row shows it, unless pinned). */
  readonly planned?: boolean;
  /** How the roster blocks the shown pairing. */
  readonly blocking: Blocking;
};

/** What the Skills drawer and the builds are matched under: the play context and whether DLC is reachable. */
const skillSettings = () => ({ context: prefs.context, dlc: dlcReachable(prefs, engine) });

/** The template filter, if it names a template of the current play context. */
const templateFilter = (): string | undefined =>
  engine.buildTemplates(prefs.context).some((t) => t.id === filter.template) ? filter.template : undefined;

/** A line's Best build: its best-ranked build, or the filtered template's match. */
const buildOf = (line: Line): BuildMatch | undefined => engine.bestBuild(line.result, skillSettings(), templateFilter());

function sortValue(line: Line, col: SortCol, gender: Gender): number | string | undefined {
  const { score, result } = line;
  if (col === 'parent') return line.label.toLowerCase();
  if (col === 'class') return score.class && engine.className(score.class, gender);
  if (col === 'score') return score.raw;
  if (col === 'speed') return support() ? score.values?.spd : score.speed?.total;
  if (col === 'build') return buildSortKey(buildOf(line));
  if (col === 'count') return result.classSet.length;
  const [kind, stat] = col.split(':') as ['cap' | 'mod' | 'growth', Stat];
  if (kind === 'cap') return score.values?.[stat];
  if (kind === 'mod') return stat === 'hp' ? undefined : result.modifiers[stat];
  return result.growths[stat];
}

/** Sorts lines by the current column; hard-blocked lines, then lines that can't be scored in the pinned class, go last. */
function sortLines(lines: Line[], gender: Gender): Line[] {
  const keyed = lines.map((line, i) => ({
    line,
    i,
    v: sortValue(line, sort.col, gender),
    dead: !line.score.class,
    hard: line.blocking.status === 'hard',
  }));
  keyed.sort((a, b) => {
    if (a.hard !== b.hard) return a.hard ? 1 : -1;
    if (a.dead !== b.dead) return a.dead ? 1 : -1;
    if (a.v === b.v) return a.i - b.i;
    if (a.v === undefined) return 1;
    if (b.v === undefined) return -1;
    return (a.v < b.v ? -1 : 1) * sort.dir;
  });
  return keyed.map((k) => k.line);
}

const weighted = (s: Stat): boolean => scoring().weightedStats.includes(s);

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

function buildCell(m: BuildMatch | undefined): HTMLElement {
  if (!m) return h('td', { class: 'build gstart muted', title: 'No build template reaches 3/5' }, '—');
  const title = `${m.template.presetName} · quality ${m.quality} · reclass ${m.reclassCost}`;
  return h('td', { class: 'build gstart', title }, h('span', { class: `tier t${m.tier}` }, `${m.tier}/5`), ` ${m.template.name}`);
}

/** The class scored in, `(Auto)` when Auto chose it; undefined when unreachable. */
const classLabel = (score: PairingScore, gender: Gender) =>
  score.class && `${engine.className(score.class, gender)}${score.auto ? ' (Auto)' : ''}`;

const PLANNED_TITLE = 'The marriage plan’s pairing for this child';

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
  if (prefs.cols.build) cells.push(buildCell(buildOf(line)));
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
  const blocked = line.blocking.status === 'hard' || line.blocking.status === 'soft' ? `blocked-${line.blocking.status}` : '';
  return h(
    'tr',
    {
      'data-key': r.key,
      class: [cls, score.class ? '' : 'unreachable', blocked, line.planned ? 'planned' : ''].filter(Boolean).join(' ') || undefined,
      title: line.planned ? PLANNED_TITLE : undefined,
    },
    ...cells,
  );
}

/**
 * Lines for a child's groups: single pairings as they are, Robin groups as their pinned asset/flaw, else on a visit
 * the plan's, else their best.
 */
function linesFor(child: ChildId, groups: readonly PairingGroup[], sc: Scoring): Line[] {
  const plannedKey = activeVisit()?.key;
  return groups.map((g) => {
    const plan = plannedKey === undefined ? undefined : g.results.find((r) => r.key === plannedKey);
    if (g.results.length === 1) {
      const r = g.results[0]!;
      return { label: g.label, result: r, score: sc.get(r.key), planned: !!plan, blocking: engine.blocking(r, roster) };
    }
    const { best, range } = sc.groupBest(g);
    const pin = g.results.find((r) => r.key === pinned.get(groupId(child, g)));
    const shown = pin ?? plan ?? best;
    return {
      label: g.label,
      result: shown,
      score: sc.get(shown.key),
      group: g,
      range: range && range.lo !== range.hi ? `${range.lo}–${range.hi}` : undefined,
      pinned: !!pin,
      planned: shown === plan,
      blocking: engine.blocking(shown, roster),
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
      line.pinned ? h('span', {}, ' (pinned; click it again to go back to best) ', h('button', { class: 'ghost', onclick: () => togglePin(child, g, shownKey) }, 'Unpin')) : line.planned ? ' (the marriage plan’s)' : ' (best)',
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

// ---- Skills drawer ----

/** A line's identity across renders: its Robin group, else its pairing. */
const lineId = (child: ChildId, line: Line) => (line.group ? groupId(child, line.group) : line.result.key);

function skillsButton(id: string): HTMLElement {
  const open = openSkills === id;
  return h(
    'button',
    {
      ...guide('skills-drawer'),
      class: `skills-btn${open ? ' on' : ''}`,
      'aria-expanded': String(open),
      title: `${open ? 'Hide' : 'Show'} this pairing’s skills`,
      onclick: () => {
        openSkills = open ? undefined : id;
        openBuild = undefined;
        inspected = undefined;
        renderParts(['main']);
      },
    },
    LABELS.skills,
  );
}

const sourcesTitle = (sources: readonly SkillSource[]) => sources.map(describeSource).join('\n');

/** ⟳ reclass, ↑ inherited, ◇ DLC skill book. */
const sourceMark = (s: SkillSource): string =>
  s.kind === 'parent' ? ' ↑' : s.kind === 'book' ? ' ◇' : s.kind === 'start' ? ' ★' : s.reclass ? ' ⟳' : '';

/** A build slot as a chip: the skill with its source marker, or its first choice dashed and struck through. */
function slotChip(slot: BuildSlotMatch): HTMLElement {
  if (!slot.skill) {
    const names = slot.options.map((o) => o.name).join(' / ');
    return inspectable(h('span', { class: `skill r${slot.options[0]!.rank} miss`, title: `${names}: ${slot.reason}` }, slot.options[0]!.name), slot.options[0]!.id);
  }
  return skillChip(slot.skill, [sourceMark(slot.source!)], `${slot.skill.name} — ${describeSource(slot.source!)}`);
}

/** One slot's source line, or why it stays empty. */
function slotLine(slot: BuildSlotMatch): HTMLElement {
  if (!slot.skill) {
    const names = slot.options.flatMap((o, i) => [...(i ? [' / '] : []), inspectable(h('s', {}, o.name), o.id)]);
    return h('li', { class: 'miss' }, ...names, ` — ${slot.reason}`);
  }
  return h('li', {}, inspectable(h('b', {}, slot.skill.name), slot.skill.id), ` — ${describeSource(slot.source!)}`);
}

/** The expanded build: role, contexts, confidence, reclass cost, where each slot comes from, synergies, its preset. */
/** Registry sources as links, by name (#99). */
function sourceLinks(refs: readonly SourceRef[]): (string | HTMLElement)[] {
  return refs.flatMap((r, i) => [
    ...(i ? [', '] : []),
    h('a', { href: r.link, target: '_blank', rel: 'noopener', title: `${r.id}: ${r.name}` }, r.name),
  ]);
}

function buildCard(m: BuildMatch): HTMLElement {
  const t = m.template;
  const current = viewPrefs().preset === t.preset;
  return h(
    'div',
    { class: 'build-card' },
    h(
      'div',
      { class: 'muted small' },
      `${t.presetName} · ${t.contexts.map((c) => CONTEXT_LABELS[c]).join(', ')} · ${t.confidence} (`,
      ...sourceLinks(t.sources),
      ')',
    ),
    h(
      'div',
      { class: 'small' },
      m.reclassCost ? `Reclass cost ${m.reclassCost}: ${m.reclassClasses.join(', ')}` : 'Reclass cost 0: every class skill is on the starting class line',
    ),
    h('ul', { class: 'slots' }, ...m.slots.map(slotLine)),
    m.synergies.length ? h('ul', { class: 'notes muted small' }, ...m.synergies.map((n) => h('li', {}, n))) : null,
    h(
      'button',
      { disabled: current, title: current ? 'Already the preset' : `Score pairings with ${t.presetName}`, onclick: () => setPrefs(withPreset(prefs, t.preset)) },
      current ? `Scoring with ${t.presetName}` : 'Use this build’s preset',
    ),
  );
}

/** Matched builds grouped by tier, best first; a line expands into its build card (the best starts expanded). */
function buildsSection(line: Line, id: string): HTMLElement {
  const builds = engine.builds(line.result, skillSettings());
  const open = openBuild?.line === id ? openBuild.id : builds[0]?.template.id;
  const tiers = [...new Set(builds.map((b) => b.tier))];
  return h(
    'section',
    { class: 'builds' },
    h('h4', {}, 'Builds'),
    builds.length ? null : h('p', { class: 'muted small' }, `No build template reaches 3/5 in ${CONTEXT_LABELS[prefs.context]}.`),
    ...tiers.map((tier) =>
      h(
        'div',
        { class: 'tier-group' },
        h('div', { class: 'muted small' }, `${tier}/5`),
        ...builds
          .filter((b) => b.tier === tier)
          .map((b) => {
            const on = b.template.id === open;
            return h(
              'div',
              { class: `build${on ? ' open' : ''}` },
              h(
                'button',
                {
                  class: 'build-line',
                  'aria-expanded': String(on),
                  title: on ? 'Collapse' : 'Show where each skill comes from',
                  onclick: () => {
                    openBuild = { line: id, id: on ? null : b.template.id };
                    renderParts(['main']);
                  },
                },
                h('span', { class: `tier t${b.tier}` }, `${b.tier}/5`),
                h('span', { class: 'name' }, b.template.name),
                h('span', { class: 'chips' }, ...b.slots.map(slotChip)),
                h('span', { class: 'muted small cost', title: 'Reclass cost: classes beyond the starting class line' }, `⟳${b.reclassCost}`),
              ),
              on ? buildCard(b) : null,
            );
          }),
      ),
    ),
  );
}

/** A skill chip coloured by rank, followed by its source markers; clicking it opens its Skill card. */
function skillChip(skill: SkillRef, marks: (HTMLElement | string)[], title: string, cls = ''): HTMLElement {
  return inspectable(h('span', { class: `skill r${skill.rank}${cls ? ` ${cls}` : ''}`, title }, skill.name, ...marks), skill.id);
}

/**
 * Makes a skill name in the drawer open its Skill card atop the scoring panel (the bottom sheet on phone). The
 * inspected skill is outlined wherever it appears. Stops the click so a chip inside a build line doesn't toggle it.
 */
function inspectable(el: HTMLElement, id: SkillId): HTMLElement {
  el.classList.add('pick');
  if (inspected?.id === id && inspected.line === cardLine()) el.classList.add('sel');
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const go = (e: Event) => {
    e.stopPropagation();
    inspect(id);
  };
  el.addEventListener('click', go);
  el.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      go(e);
    }
  });
  return el;
}

/** The Skill card's owner: the open unit page, else the open Skills drawer. */
const cardLine = (): string | undefined => (view === 'units' && unitOpen ? `unit:${unitOpen}` : openSkills);
/** Children's names by id. */
const CHILD_NAMES: Readonly<Record<string, string>> = Object.fromEntries(engine.children().map((c) => [c.id, c.name]));

function inspect(id: SkillId): void {
  const line = cardLine();
  if (!line) return;
  inspected = { line, id };
  openScoring();
  renderParts(['main', 'panel']);
}

/** The drawer under a pairing row: header and legend, matched builds, rally coverage, parents, class skills by rank. */
function skillsRow(line: Line, id: string, ncols: number): HTMLElement {
  const v = engine.skillView(line.result, skillSettings());
  const robin = line.group ? engine.robinLabel(line.result.pairing) : undefined;
  drawerPairing = { line: id, result: line.result, title: `${v.child} × ${line.label}${robin ? ` ${robin}` : ''}` };
  const head = h(
    'div',
    { class: 'drawer-head' },
    h('b', {}, `${v.child} × ${line.label}`),
    robin ? h('span', { class: 'af' }, robin) : null,
    h('span', { class: 'muted' }, `Starts as ${v.startClass} · ${v.classCount} classes · ${CONTEXT_LABELS[v.context]} · DLC ${v.dlc ? 'on' : 'off'}`),
    h(
      'span',
      { class: 'legend muted small' },
      '⟳ reclass · ↑ inherited · ◇ DLC skill book · colour = rank ',
      ...[5, 4, 3, 2, 1].map((r) => h('span', { class: `skill r${r}` }, RANK_LETTERS[r]!)),
    ),
    h('button', { class: 'ghost close', title: 'Close the Skills drawer', onclick: () => ((openSkills = inspected = undefined), renderParts(['main'])) }, '✕'),
  );

  const covered = v.rallies.filter((r) => r.sources.length).length;
  const rallies = h(
    'section',
    {},
    h('h4', {}, `Rally coverage ${covered}/10`),
    h(
      'div',
      { class: 'dots' },
      ...v.rallies.map((r) =>
        inspectable(
          h(
            'span',
            { class: `dot${r.sources.length ? ' on' : ''}`, title: `${r.skill.name}: ${r.sources.length ? sourcesTitle(r.sources) : r.reason}` },
            h('i', {}),
            r.skill.name.replace(/^Rally /, ''),
          ),
          r.skill.id,
        ),
      ),
    ),
  );

  const parents = h(
    'section',
    {},
    h('h4', {}, 'From parents (one each)'),
    ...v.parents.map((p) =>
      h(
        'div',
        { class: 'parent' },
        h(
          'div',
          {},
          h('b', {}, p.parent),
          h('span', { class: 'muted small' }, p.side === 'fixed' ? ' · fixed parent' : ' · variable parent'),
          p.fixed ? h('span', { class: 'chip' }, 'always') : null,
        ),
        h(
          'div',
          { class: 'chips' },
          ...(p.skills.length
            ? p.skills.map((k) => skillChip(k, [' ↑'], k.unique ? `${k.name}: only ${p.parent} can give it` : k.name, k.unique ? 'unique' : ''))
            : [h('span', { class: 'muted' }, 'nothing')]),
        ),
        h('div', { class: 'muted small' }, p.note),
      ),
    ),
    ...v.caveats.map((c) => h('div', { class: 'muted small' }, c)),
    h('div', { class: 'muted small' }, 'Outlined: no class of this child teaches it, and the other parent can’t pass it.'),
  );

  const ranks = h(
    'section',
    {},
    h('h4', {}, 'Class skills by rank'),
    ...v.ranks.map((b) =>
      h(
        'div',
        { class: 'bucket' },
        h('span', { class: `rank-badge r${b.rank}`, title: b.rank ? `Rank ${b.letter}` : 'Unranked' }, b.letter),
        h(
          'div',
          { class: 'chips' },
          ...b.skills.map((k) => {
            const cls = k.sources.find((s) => s.kind === 'class');
            const marks: (HTMLElement | string)[] =
              cls?.kind === 'class' ? [h('span', { class: 'src' }, ` ${cls.className} ${cls.level}${cls.reclass ? ' ⟳' : ''}`)] : [];
            if (k.sources.some((s) => s.kind === 'parent')) marks.push(' ↑');
            return skillChip(k, marks, sourcesTitle(k.sources));
          }),
        ),
      ),
    ),
    v.books.length
      ? h(
          'div',
          { class: 'bucket' },
          h('span', { class: 'rank-badge', title: 'DLC skill books' }, '◇'),
          h('div', { class: 'chips' }, ...v.books.map((k) => skillChip(k, [' ◇'], `${k.name}: DLC skill book`))),
        )
      : null,
  );

  const builds = buildsSection(line, id);
  return h(
    'tr',
    { class: 'skills-row' },
    h(
      'td',
      { colspan: String(ncols) },
      h('div', { class: 'drawer' }, head, h('div', { class: 'drawer-cols' }, builds, h('div', { class: 'skills-col' }, rallies, parents, ranks))),
    ),
  );
}

/**
 * The rows a line renders to: itself, the asset × flaw heatmap when its Robin group is open, and the Skills drawer
 * when it is the open one.
 */
function rowsFor(child: ChildId, line: Line, gender: Gender, sc: Scoring, ncols: number): HTMLElement[] {
  const rows = lineRows(child, line, gender, sc, ncols);
  const id = lineId(child, line);
  if (openSkills === id) rows.push(skillsRow(line, id, ncols));
  return rows;
}

function lineRows(child: ChildId, line: Line, gender: Gender, sc: Scoring, ncols: number): HTMLElement[] {
  const g = line.group;
  const skills = skillsButton(lineId(child, line));
  if (!g) {
    // A Robin group the run facts narrowed to one asset/flaw still names it.
    const af = engine.robinLabel(line.result.pairing);
    const head = h(
      'th',
      { class: 'stick', scope: 'row' },
      parentLink(line.result.pairing, line.label),
      af ? h('span', { class: 'af' }, ` ${af}`) : null,
      warnMark([line.result]),
      blockChip(line.blocking),
      planChip([line.result]),
      skills,
    );
    return [lineRow(line, gender, '', head)];
  }
  const id = groupId(child, g);
  const open = expanded.has(id);
  const head = h(
    'th',
    { class: 'stick', scope: 'row' },
    h(
      'button',
      {
        ...guide('robin-heatmap'),
        class: 'expander',
        'aria-expanded': String(open),
        title: `${open ? 'Hide' : 'Show'} the asset × flaw heatmap of Robin’s ${g.results.length} combos`,
        onclick: () => {
          if (open) expanded.delete(id);
          else expanded.add(id);
          renderParts(['main']);
        },
      },
      open ? '▾' : '▸',
    ),
    ' ',
    parentLink(line.result.pairing, line.label),
    h(
      'span',
      {
        class: `af${line.pinned ? ' pinned' : ''}`,
        title: line.pinned ? 'Pinned asset/flaw' : line.planned ? 'The marriage plan’s asset/flaw' : `Best of ${g.results.length} asset/flaw pairings`,
      },
      ` ${engine.robinLabel(line.result.pairing) ?? ''}`,
    ),
    line.pinned ? h('span', { class: 'muted small' }, ' 📌') : null,
    warnMark(g.results),
    blockChip(line.blocking),
    planChip(g.results),
    skills,
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
  { id: 'build', label: 'build' },
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
  const groups = engine.groups(child, pairingFilter());
  const inRun = engine.groups(child, { run: roster.run });
  const allGroups = inRun.length;
  // The run facts leave some pairings out of this run entirely.
  const pairingCount = inRun.reduce((n, g) => n + g.results.length, 0);
  const cols = prefs.cols;
  const ncols = 1 + 2 + (cols.speed ? 1 : 0) + (cols.build ? 1 : 0) + (cols.caps ? STATS.length : 0) + (cols.mods ? MOD_STATS.length : 0) + (cols.growths ? STATS.length : 0) + 1;
  const byTemplate = templateFilter();
  const all = linesFor(child, groups, sc).filter((l) => !(filter.hideBlocked && l.blocking.status === 'hard'));
  const lines = sortLines(byTemplate ? all.filter((l) => buildOf(l)) : all, summary.gender);
  const hardCount = lines.filter((l) => l.blocking.status === 'hard').length;
  const lineRowsOf = lines.map((l) => rowsFor(child, l, summary.gender, sc, ncols));
  const rows = lineRowsOf.flat();
  // On a visit the table shows rows far enough to include the planned one (filters may hide it).
  const planned = lines.findIndex((l) => l.planned);
  const plannedAt = planned < 0 ? -1 : lineRowsOf.slice(0, planned).flat().length;
  if (plannedAt >= limit) limit = plannedAt + 1;
  const shown = rows.slice(0, limit);

  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, unitLink(openAnyUnit, child, summary.name)),
    h(
      'span',
      { class: 'muted' },
      'Fixed parent: ',
      unitLink(openAnyUnit, CHILD_UNITS[child].fixedParent, summary.fixedParentName),
      ` · ${pairingCount} pairings` +
        (lines.length < allGroups ? ` · ${lines.length} of ${allGroups} parents shown` : '') +
        (hardCount ? ` · ${hardCount} blocked` : ''),
    ),
    planPresetChip(child),
    columnToggles(),
  );
  // Without weights (Rallybot / Dancer) Auto has nothing to maximise and rows show their start class.
  const classHead = viewPrefs().classMode === 'auto' && scoreSettings().weights ? 'Class (Auto)' : 'Class';
  const table = h(
    'table',
    { ...guide('child-table'), class: 'grid' },
    h(
      'thead',
      {},
      h(
        'tr',
        { class: 'grp' },
        h('th', { class: 'stick' }, ''),
        h('th', { colspan: '2', class: 'gstart' }, 'Result'),
        cols.speed ? h('th', { class: 'gstart' }, '') : null,
        cols.build ? h('th', { class: 'gstart' }, '') : null,
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
        ...(cols.build
          ? [
              sortHeader(
                'build',
                byTemplate ? 'Build' : 'Best build',
                'gstart',
                `${byTemplate ? 'The filtered template' : 'The best-ranked build template'} in ${CONTEXT_LABELS[prefs.context]}: tier → quality → first preferences → reclass cost`,
              ),
            ]
          : []),
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

const blockedClass = (b: Blocking | undefined) => (b?.status === 'hard' || b?.status === 'soft' ? ` blocked-${b.status}` : '');

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
      class: `card${open ? ' open' : ''}${score.class ? '' : ' unreachable'}${blockedClass(e.blocking)}`,
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
      e.blocking ? blockChip(e.blocking) : null,
      planChip([r]),
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
  const entries = sc.leaderboard({
    robin: board.robin === 'pick' ? board.pick : board.robin,
    sort: board.sort,
    filter: pairingFilter(),
    roster,
    hideBlocked: filter.hideBlocked,
  });
  const statMax = Object.fromEntries(STATS.map((s) => [s, Math.max(0, ...entries.map((e) => e.score.values?.[s] ?? 0))])) as Record<Stat, number>;
  const shown = entries.slice(0, limit);
  const head = h(
    'div',
    { class: 'main-head' },
    h('h2', {}, LABELS.allChildren),
    h('span', { class: 'muted' }, `${entries.length} pairings · ${presetLabel(currentPreset())} · bars: ${capsHeader()} (${BASIS_LABELS[basis()]})`),
    boardControls(),
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
  return [head, h('div', { class: 'scroll' }, h('div', { ...guide('leaderboard'), class: 'cards' }, ...shown.map((e) => card(e, statMax))), more)];
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

// ---- Skill card ----

/** The inspected skill and the open drawer's pairing, when the card belongs to that drawer. */
/** The inspected skill on the open unit page (#101). */
const unitCardTarget = () => (view === 'units' && pageSubject() && inspected?.line === `unit:${unitOpen}` ? { id: inspected.id, unit: pageSubject()! } : undefined);
const cardTarget = () => (inspected && drawerPairing?.line === inspected.line ? { id: inspected.id, ...drawerPairing } : undefined);

/** The inspected skill's card, when its drawer is the open one. */
function currentCard(): { card: SkillCard; title: string } | undefined {
  const u = unitCardTarget();
  if (u) return { card: engine.unitSkillCard(u.unit, u.id, skillSettings()), title: engine.unitPage(u.unit, skillSettings()).name };
  const t = cardTarget();
  return t && { card: engine.skillCard(t.result, t.id, skillSettings()), title: t.title };
}

/** What the Skill card depends on, so the panel refreshes when it changes. */
const cardKey = (): string => {
  const u = unitCardTarget();
  if (u) return `${u.id}|unit:${JSON.stringify(u.unit)}|${skillSettings().context}|${skillSettings().dlc}`;
  const t = cardTarget();
  if (!t) return '';
  const { context, dlc } = skillSettings();
  return `${t.id}|${t.result.key}|${context}|${dlc}`;
};

/** One synergy or conflict: ✓/✕ for this pairing reaching the partner (clickable), and why the edge exists. */
function edgeLine(e: SkillCardEdge): HTMLElement {
  const partner = h(
    'button',
    { class: `skill r${e.skill.rank} linkish`, title: `Show ${e.skill.name}’s card`, onclick: () => inspect(e.skill.id) },
    e.skill.name,
  );
  return h(
    'li',
    {},
    h('span', { class: e.reachable ? 'pos' : 'neg', title: `${unitCardTarget() ? 'This unit' : 'This pairing'} can${e.reachable ? '' : '’t'} reach it` }, e.reachable ? '✓ ' : '✕ '),
    partner,
    ` ${e.note}`,
    e.sources.length ? h('span', { class: 'muted small' }, ' (', ...sourceLinks(e.sources), ')') : null,
    e.reason ? h('div', { class: 'muted small' }, `Out of reach: ${e.reason}.`) : null,
    e.oneParent ? h('div', { class: 'warn small' }, `⚠ Both come only from ${e.oneParent}, who passes one skill: not together.`) : null,
  );
}

/** The Skill card pinned atop the scoring panel: the inspected skill seen from the open drawer's pairing. */
function skillCardEl(card: SkillCard, title: string): HTMLElement {
  const edges = (label: string, list: readonly SkillCardEdge[]) =>
    list.length ? [h('h4', {}, label), h('ul', { class: 'edges' }, ...list.map(edgeLine))] : [];
  return h(
    'section',
    { class: 'skill-card', 'aria-label': `${card.name} skill card` },
    h(
      'div',
      { class: 'panel-head' },
      h('h3', {}, 'Skill'),
      h('button', { class: 'ghost', 'aria-label': 'Close the Skill card', onclick: () => ((inspected = undefined), (sheetOpen = false), renderParts(['main', 'panel'])) }, '✕'),
    ),
    h('div', { class: 'card-name' }, h('b', {}, card.name), card.dlc ? h('span', { class: 'chip' }, 'DLC') : null),
    h('div', { class: 'muted small' }, `for ${title}`),
    h('p', {}, card.description),
    h('div', { class: 'small' }, card.rally ? 'Rally: a command, used instead of acting' : card.rate ? `Activation: ${card.rate}` : 'Always on'),
    h(
      'div',
      { class: 'ranks small' },
      ...card.ranks.map((r) =>
        h(
          r.current ? 'b' : 'span',
          { title: r.current ? 'The current play context' : undefined },
          `${CONTEXT_LABELS[r.context]} `,
          h('span', { class: `rank-badge r${r.rank}` }, r.letter),
        ),
      ),
    ),
    h('h4', {}, unitCardTarget() ? `How ${title} gets it` : 'How this pairing gets it'),
    card.sources.length
      ? h('ul', { class: 'sources small' }, ...card.sources.map((src) => h('li', {}, describeSource(src))))
      : h('p', { class: 'small neg' }, `Unreachable: ${card.reason}.`),
    h('div', { class: 'muted small' }, card.inheritance.note),
    ...card.sourceCalls.map((c) =>
      h('div', { class: 'small', title: c.why }, `${c.context}: ${c.ours} here, ${c.source} ${c.theirs} (${c.call})`),
    ),
    ...edges('Synergies', card.synergies),
    ...edges('Conflicts', card.conflicts),
    h('h4', {}, 'Builds using it'),
    card.builds.length
      ? h('ul', { class: 'small' }, ...card.builds.map((b) => h('li', {}, h('span', { class: `tier t${b.tier}` }, `${b.tier}/5`), ` ${b.name} · slot ${b.slot}`)))
      : h('p', { class: 'muted small' }, `None of this pairing’s builds (3/5 and up) in ${CONTEXT_LABELS[prefs.context]}.`),
  );
}

// ---- scoring panel ----

/** One slider per weight; Spd has two, to target (0–20) and beyond (0–10). */
type WeightSlider = { stat: keyof Weights; max: number; label: string; title?: string };
const WEIGHT_STATS: readonly WeightSlider[] = STATS.flatMap((s): WeightSlider[] =>
  s === 'spd'
    ? [
        { stat: 'spd', max: 20, label: LABELS.spdToTarget, title: 'Per Spd point up to the target breakpoint + margin' },
        { stat: 'spdBeyond', max: 10, label: LABELS.spdBeyond, title: 'Per Spd point beyond the target breakpoint + margin' },
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
  hints: Partial<Record<T, string>> = {},
  anchor: Partial<ReturnType<typeof guide>> = {},
): HTMLElement {
  return h(
    'div',
    { ...anchor, class: 'blk', role: 'group', 'aria-label': label },
    h('span', { class: 'lbl' }, label),
    h(
      'span',
      { class: 'seg' },
      ...options.map((o) =>
        h(
          'button',
          { class: o === current ? 'on' : '', 'aria-pressed': String(o === current), disabled: !!disabled(o), title: disabled(o) ?? hints[o], onclick: () => onpick(o) },
          names[o],
        ),
      ),
    ),
  );
}

const RANK_CHOICE_NAMES: Record<SupportRank, string> = { none: '—', C: 'C/B', B: 'C/B', A: 'A/S', S: 'A/S' };
/** The rank input's choice for a rank: C/B and A/S each give the same bonus. */
const rankChoice = (r: SupportRank): SupportRank => (r === 'B' ? 'C' : r === 'S' ? 'A' : r);

/** Lead/Battery (the Lead/Support scoring role), set by the preset; picking the other one overrides it until ↺ or a new preset. */
function roleControl(): HTMLElement {
  // The role applies globally: following the global preset's role is 'preset'.
  const fromPreset = presetOf(prefs).role ?? 'lead';
  const names = { lead: SCORING_ROLE_UI.lead.label, support: SCORING_ROLE_UI.support.label };
  const hints = { lead: SCORING_ROLE_UI.lead.hint, support: SCORING_ROLE_UI.support.hint };
  const el = segmented('Role', ROLES, role(), names, (r) => setPrefs({ role: r === fromPreset ? 'preset' : r }), undefined, hints);
  if (viewPrefs().role !== 'preset') {
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
      ...guide('scoring-preset'),
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

  const inspecting = currentCard();
  return [
    ...(view === 'plan' ? [planSidebar(planContext())] : []),
    ...(inspecting ? [skillCardEl(inspecting.card, inspecting.title)] : []),
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
    segmented(
      'Basis',
      BASES,
      basis(),
      BASIS_LABELS,
      (basis) => setPrefs({ basis }),
      (b) => (engine.scoreBases(role()).includes(b) ? undefined : 'Not in the Support role: the pair-up bonus comes from caps'),
      {},
      guide('scoring-basis'),
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
        h('option', { value: 'auto', selected: viewPrefs().classMode === 'auto' }, 'Auto (best final-tier class per row)'),
        ...tiers.map((t) =>
          h(
            'optgroup',
            { label: TIER_LABELS[t] },
            ...engine
              .classes()
              .filter((c) => c.tier === t)
              .map((c) => h('option', { value: c.id, selected: c.id === viewPrefs().classMode }, `${c.name}${c.dlc ? ' (DLC)' : ''}`)),
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
        { title: 'Leave out pairings the roster hard-blocks (a unit dead, missed, or married to someone else)' },
        h('input', {
          type: 'checkbox',
          checked: filter.hideBlocked,
          onchange: (e) => {
            filter = { ...filter, hideBlocked: (e.target as HTMLInputElement).checked };
            limit = FIRST_PAGE;
            renderParts(['main']);
          },
        }),
        ' Hide blocked rows',
      ),
      h(
        'select',
        {
          'aria-label': 'Filter by build template',
          title: 'Only rows that reach this template at 3/5 or better; the Build column shows its match',
          onchange: (e) => {
            filter = { ...filter, template: (e.target as HTMLSelectElement).value };
            limit = FIRST_PAGE;
            renderParts(['main']);
          },
        },
        h('option', { value: '', selected: !templateFilter() }, 'Any build template'),
        ...engine
          .buildTemplates(prefs.context)
          .map((t) => h('option', { value: t.id, selected: t.id === templateFilter() }, `${t.id} ${t.name}`)),
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
          ...guide('spd-target'),
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
    { ...guide('play-context'), class: 'context', title: 'What you’re building for: sets the default target breakpoint and whether DLC is reachable' },
    h('span', { class: 'muted' }, `${LABELS.playContext} `),
    h(
      'select',
      { 'aria-label': LABELS.playContext, onchange: (e) => setPrefs({ context: (e.target as HTMLSelectElement).value as PlayContext }) },
      ...CONTEXTS.map((c) => h('option', { value: c, selected: c === prefs.context }, CONTEXT_LABELS[c])),
    ),
  );
}

// ---- guide ----

const guideContext = (): GuideContext => ({
  prefs: guidePrefs,
  facts: guideFacts(roster, planPrefs, prefs.context),
  loss: lossPrompt(roster, guidePrefs),
  welcome: welcomeOpen,
  setPrefs: (next) => {
    guidePrefs = next;
    welcomeOpen = false;
    saveGuidePrefs(guidePrefs);
    // On a phone the open dock is a bottom sheet: the Scoring sheet closes under it.
    if (phone() && next.dock === 'open' && sheetOpen) {
      sheetOpen = false;
      return renderParts(['panel']);
    }
    renderGuide();
  },
  showWelcome: () => {
    welcomeOpen = true;
    if (view === 'roster') return renderGuide();
    view = 'roster';
    renderParts(['rail', 'main', 'panel']);
  },
  go: (next) => {
    if (view === next) return renderGuide();
    view = next;
    renderParts(['rail', 'main', 'panel']);
  },
  goDeeper: (jump) => {
    let shown: string | undefined;
    if (jump.to === 'leaderboard') showTable('all');
    else if (jump.to === 'validation') view = 'validation';
    else if (jump.to === 'unit' || jump.to === 'robin' || jump.to === 'door') {
      unitBack = { view, unit: undefined, scroll: mainScroll() };
      view = 'units';
      if (jump.to === 'door') {
        const inRun = childrenInRun();
        const child = guideChild(childOpened, planPrefs.priorities, inRun.map((c) => c.id));
        unitOpen = child;
        shown = inRun.find((c) => c.id === child)!.name;
      } else {
        unitOpen = jump.to === 'robin' ? 'robin' : 'lonqu';
        shown = jump.to === 'robin' ? 'Robin' : 'Lon’qu';
      }
    } else if (jump.to === 'child') {
      const inRun = childrenInRun();
      const child = guideChild(childOpened, planPrefs.priorities, inRun.map((c) => c.id));
      showTable(child);
      const robin = jump.robinRow ? engine.groups(child, pairingFilter()).find((g) => g.results.length > 1) : undefined;
      if (robin) expanded.add(groupId(child, robin));
      shown = inRun.find((c) => c.id === child)!.name;
    }
    // The Scoring sidebar is on every view: its jump stays put.
    renderParts(['rail', 'main', 'panel']);
    return shown;
  },
  makeRoom: (target) => {
    if (!phone()) return;
    collapseDockOnPhone();
    sheetOpen = regions.panel?.querySelector(`[data-guide="${target}"]`) != null;
    renderParts(['panel']);
  },
  refresh: renderGuide,
});

/**
 * The guide follows every change: its ticks read the roster, plan preferences and play context, and losses recorded
 * where the loss prompt can't show are noted as seen.
 */
function renderGuide(): void {
  const layer = regions.guide;
  if (!layer) return;
  const settled = settleLosses(roster, guidePrefs);
  if (settled !== guidePrefs) saveGuidePrefs((guidePrefs = settled));
  const scrollTop = layer.querySelector('.gd')?.scrollTop ?? 0;
  layer.replaceChildren(...guideLayer(guideContext()));
  const dock = layer.querySelector('.gd');
  if (dock) dock.scrollTop = scrollTop;
}

// ---- shell ----

type Part = 'rail' | 'main' | 'panel';
const regions: Partial<Record<Part | 'guide', HTMLElement>> = {};

function renderParts(parts: readonly Part[]): void {
  const { rail: railEl, main, panel: panelEl } = regions;
  if (!railEl || !main || !panelEl) return render();
  // A visit ends when the visitor leaves its table.
  if (visit && !activeVisit()) visit = undefined;
  if (parts.includes('rail')) railEl.replaceChildren(...rail());
  const card = cardKey();
  if (parts.includes('main')) {
    drawerPairing = undefined;
    main.replaceChildren(
      ...(view === 'validation'
        ? [validationPanel({ engine, assumptions, selfTest, setOverride, resetAll: () => applyOverrides({}), render })]
        : view === 'roster'
          ? rosterPage({ engine, roster, setRoster, setDeployment, clearAll: clearRosterState, plan: planControls() })
          : view === 'plan'
          ? planPage(planContext())
          : view === 'units'
          ? unitsView(unitsContext())
          : selected === 'all'
          ? leaderboard()
          : childTable(selected)),
    );
    if (scrollToPlanned) {
      scrollToPlanned = false;
      main.querySelector('tr.planned')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }
  // The Skill card lives in the panel but follows the drawer: refresh the panel when the card would change.
  if (parts.includes('panel') || cardKey() !== card) {
    panelEl.replaceChildren(...panel());
    panelEl.classList.toggle('open', sheetOpen);
  }
  renderGuide();
}

function render(): void {
  const app = document.getElementById('app')!;
  regions.rail = h('nav', { class: 'rail', 'aria-label': 'Children' });
  regions.main = h('section', { class: 'main' });
  regions.panel = h('aside', { class: 'panel', 'aria-label': 'Scoring' });
  regions.guide = h('div', { class: 'guide-layer' });
  app.replaceChildren(
    h(
      'div',
      { class: 'shell' },
      h('header', { class: 'topbar' }, h('span', { class: 'brand' }, 'FE13 Child Calc'), contextSelect(), guideButton(guideContext), validationButton(selfTest)),
      regions.rail,
      regions.main,
      regions.panel,
      h('button', { class: 'sheet-handle', title: 'Open scoring', onclick: () => (openScoring(), renderParts(['panel'])) }, 'Scoring ⚙'),
    ),
    regions.guide,
  );
  renderParts(['rail', 'main', 'panel']);
}

render();
