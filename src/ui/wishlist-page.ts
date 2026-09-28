/**
 * The Wishlist tab (#203; spec #175, The wishlist, and The inbox, Run view and Wishlist tab): the endpoint army as
 * Lead / Back rows, each unit with its class, 5-skill build, worth (and utility), parents and passed skills, and its
 * reading; clicking a unit lists every edit that touches it with its cost ("costing…", then provisional, then settled),
 * keeping it in or out among them; the reserves in order, each naming the loss it mainly covers; and the children
 * ledger (child, fixed parent, the wishlist's parents and passes, status; #212). The reference is variant D on branch `prototype/wishlist-editing` (its variant B sheet is this tab).
 *
 * It reads the solve the Run view's headline runs (`solveState`): the adopted plan (#206: the plan the search started
 * from, as the inbox reads it and every edit is costed against; never the search's best, which is a proposal) and its
 * readings. Once the solve
 * is done the page starts the worker's idle work (#202: unit worth and utility, then the reserves), and a unit's edits
 * are listed and costed in the worker's second slot, so opening a unit never stops the search.
 */
import {
  EDIT_COST_BUDGET,
  FLAWLESS_SEED,
  STEP_BUDGET,
  pinKey,
  rosterOf,
  rosterUnits,
  stateOf,
  unitName,
  withPin,
  withoutPins,
  type EditCost,
  type Engine,
  type Gender,
  type Milestone,
  type Plan,
  type PlanPin,
  type Reading,
  type ReserveReading,
  type Readings,
  type ReservesStep,
  type RosterUnit,
  type Run,
  type UnitWorth,
  type WorthStep,
} from '../engine';
import { adoptedOf } from '../engine';
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { SKILLS } from '../game-data/skills';
import { differenceText, marginText, pointsText } from './chance';
import { h } from './dom';
import { guide } from './guide';
import { LABELS, LEDGER_UI, type LedgerStatus } from './labels';
import { flawlessSection, readingRow, solveState, type HeadlineContext } from './run-page';
import { startSolve, type UnitEditView } from './solve-client';
import { unitLink, type OpenUnit } from './unit-links';
import { setComparison, setWorth, whyNumber, whyText, type WhyMark } from './why';

export type WishlistContext = HeadlineContext & {
  /** The unit whose edits are open (view state). */
  readonly open: RosterUnit | undefined;
  readonly setOpen: (unit: RosterUnit | undefined) => void;
  /** Draws the page again: the worker's replies land through it. */
  readonly refresh: () => void;
  /** Opens a unit's page: the children ledger's links. */
  readonly openUnit: OpenUnit;
};

// ---- readouts ----

/** A unit's worth as its row reads it: "forced" for Chrom and Robin, else the points lost without it, and its utility. */
export function worthText(w: UnitWorth | undefined, gender: Gender | null | undefined): string {
  if (!w) return 'worth …';
  if (w.forced) return 'forced';
  if (w.worth === undefined) return 'worth …';
  const pm = w.margin !== undefined && Number.isFinite(w.margin) ? ` ${marginText(w.margin)}` : '';
  const withChildren = w.children.length ? ` with ${w.children.map((c) => unitName(c, gender)).join(' and ')}` : '';
  const utility = w.utility !== undefined && w.utility > 0 ? ` · utility ${pointsText(w.utility)}${w.utilityMargin !== undefined && Number.isFinite(w.utilityMargin) ? ` ${marginText(w.utilityMargin)}` : ''}` : '';
  return `worth ${pointsText(w.worth)}${pm}${withChildren}${utility}${w.settled ? '' : ' (provisional)'}`;
}

/** A worth's numbers (#210): the worth and its utility, each explained as the worth. */
export function worthMarks(w: UnitWorth | undefined): WhyMark[] {
  if (!w || w.forced || w.worth === undefined) return [];
  const pm = w.margin !== undefined && Number.isFinite(w.margin) ? ` ${marginText(w.margin)}` : '';
  const utility = w.utility !== undefined && w.utility > 0 ? `utility ${pointsText(w.utility)}` : '';
  return [[`worth ${pointsText(w.worth)}${pm}`, `worth:${w.unit}`], ...(utility ? [[utility, `worth:${w.unit}`] as WhyMark] : [])];
}

const READING_WORDS = { 'on-track': 'on track', 'at-risk': 'at risk', behind: 'behind' } as const;

/** One unit on the sheet: what its row shows. */
export type UnitRowView = {
  readonly unit: RosterUnit;
  readonly name: string;
  readonly position: 'Lead' | 'Back' | 'Solo';
  readonly cls: string;
  /** Its build's skill names, in slot order. */
  readonly build: readonly string[];
  readonly worth: string;
  /** Its worth's numbers, for the Why panel (#210): the worth and the utility. */
  readonly worthMarks?: readonly WhyMark[];
  /** Its reading (#197), with the roadmap's line for it as the hover; undefined until the readings are in. `why`: its worst milestone's explanation. */
  readonly reading?: { readonly kind: Reading['reading']; readonly text: string; readonly title: string; readonly why?: string };
  /** A child's parents and the skills each passes: "Chrom × Olivia · passes Aether / Galeforce". */
  readonly parents?: string;
};

export type WishlistReadout = {
  /** "Wishlist for Endgame: 16 fielded · 40 of 52 planned units not on track". */
  readonly title: string;
  /** Lead / Back rows in lineup order, then Solo units. */
  readonly rows: readonly { readonly lead: UnitRowView; readonly back?: UnitRowView }[];
  /** Units the plan needs off the endpoint lineup (a parent there for its child), with their worth and reading. */
  readonly others: readonly UnitRowView[];
  /** The reserves in order, each naming the loss it mainly covers; empty until they're chosen. `marks`: what it restores, for the Why panel. */
  readonly reserves: readonly { readonly unit: RosterUnit; readonly text: string; readonly marks?: readonly WhyMark[] }[];
  readonly reservesNote: string;
  /** Units not on track (the tab's count). */
  readonly notOnTrack: number;
};

/** How many units a plan's readings have not on track (the Wishlist tab's count): reserves get no reading. */
export function notOnTrack(plan: Plan, readings: Readings | undefined): number {
  const reserves = new Set(plan.wishlist.reserves.map((r) => r.unit));
  return readings?.readings.filter((r) => r.reading !== 'on-track' && !reserves.has(r.unit)).length ?? 0;
}

/**
 * The units the plan counts on, whose readings the count not on track is out of: the endpoint lineup's (fielded), and
 * the units off it the readings name (a parent there for its child, a child on its way); reserves aside.
 */
export function plannedUnits(plan: Plan, readings: Readings | undefined): number {
  const reserves = new Set(plan.wishlist.reserves.map((r) => r.unit));
  return new Set([...plan.wishlist.units.map((w) => w.unit), ...(readings?.readings.map((r) => r.unit) ?? [])].filter((u) => !reserves.has(u))).size;
}

/** The count not on track in words, out of the planned units: "40 of 52 planned units not on track". */
export function notOnTrackText(count: number, planned: number): string {
  return count ? `${count} of ${planned} planned unit${planned === 1 ? '' : 's'} not on track` : 'every planned unit on track';
}

const skillName = (id: string) => (SKILLS as Readonly<Record<string, { readonly name: string } | undefined>>)[id]?.name ?? id;

/**
 * The Wishlist tab's sheet for a plan (#203): the endpoint army's rows, the units off it the plan still needs, the
 * reserves and the count not on track. Worth, reserves and readings come as the worker works them out.
 */
export function wishlistReadout(
  engine: Engine,
  run: Run,
  plan: Plan,
  given: { readonly worth?: WorthStep; readonly reserves?: ReservesStep; readonly readings?: Readings; readonly idleDone?: boolean } = {},
): WishlistReadout {
  const gender = run.roster.run.gender ?? plan.robin.gender;
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  // Unit states and spouses live in the latest entry.
  const roster = rosterOf(run);
  const genders = new Map<RosterUnit, Gender>(rosterUnits({ ...run.roster.run, gender }).map((u) => [u.id, u.gender]));
  const genderOf = (u: RosterUnit): Gender | undefined => (u === 'robin' ? plan.robin.gender : (genders.get(u) ?? (u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].gender : undefined)));
  const worth = new Map(given.worth?.units.map((w) => [w.unit, w]) ?? []);
  const reserveList = given.reserves?.reserves ?? plan.wishlist.reserves;
  const reserves = new Set(reserveList.map((r) => r.unit));
  const milestones: readonly Milestone[] = given.readings ? engine.milestones(run, plan) : [];
  const reading = (u: RosterUnit): UnitRowView['reading'] => {
    if (!given.readings || reserves.has(u)) return undefined;
    const r = given.readings.readings.find((x) => x.unit === u);
    if (!r) return { kind: 'on-track', text: 'on track', title: 'No milestones left' };
    return { kind: r.reading, text: `${READING_WORDS[r.reading]}${r.pending ? '?' : ''}`, title: readingRow(r, milestones, gender), ...(r.worst ? { why: `milestone:${r.worst.id}` } : {}) };
  };
  const child = (u: RosterUnit) => plan.wishlist.children.find((c) => c.child === u);
  const view = (u: RosterUnit, position: UnitRowView['position'], classId?: string, build: readonly string[] = []): UnitRowView => {
    const c = child(u);
    const r = reading(u);
    return {
      unit: u,
      name: name(u),
      position,
      cls: classId ? engine.className(classId as never, genderOf(u)) : '',
      build: build.map(skillName),
      worth: worthText(worth.get(u), gender),
      worthMarks: worthMarks(worth.get(u)),
      ...(r ? { reading: r } : {}),
      ...(c ? { parents: `${name(c.parents[0])} × ${name(c.parents[1])} · passes ${c.passes.map((p) => (p ? skillName(p) : '—')).join(' / ')}` } : {}),
    };
  };
  const units = plan.wishlist.units;
  const rows: { lead: UnitRowView; back?: UnitRowView }[] = [];
  for (const w of units) {
    if (w.position === 'back' && units.some((x) => x.position === 'lead' && x.partner === w.unit)) continue;
    const back = w.position === 'lead' && w.partner ? units.find((x) => x.unit === w.partner && x.position === 'back') : undefined;
    const lead = view(w.unit, w.position === 'solo' ? 'Solo' : w.position === 'back' ? 'Back' : 'Lead', w.classId, w.build);
    rows.push({ lead, ...(back ? { back: view(back.unit, 'Back', back.classId, back.build) } : {}) });
  }
  const fielded = new Set(units.map((w) => w.unit));
  const needed = [...new Set([...(given.readings?.readings.map((r) => r.unit) ?? []), ...(given.worth?.units.map((w) => w.unit) ?? [])])].filter((u) => !fielded.has(u) && !reserves.has(u));
  const others = needed.map((u) => view(u, 'Solo'));
  const reserveRows = reserveList.map((r, i) => {
    const restores = 'restores' in r ? differenceText((r as ReserveReading).restores, (r as ReserveReading).margin) : '';
    return {
      unit: r.unit,
      text: `${i + 1}. ${name(r.unit)} covers ${r.covers ? name(r.covers) : 'no single loss'}${restores ? ` · restores ${restores}` : ''}`,
      ...(restores ? { marks: [[restores, `edit:reserve:${r.unit}`]] as WhyMark[] } : {}),
    };
  });
  const reservesNote = reserveRows.length
    ? 'In order: who steps in first. Each covers the likely loss it restores the most flawless chance for (the loss it mainly covers), weighted by how often the plan’s runs lose that unit.'
    : given.idleDone
      ? 'No unit off the wishlist restores any flawless chance for the likely losses.'
      : 'The reserves are chosen once the search is done, after each unit’s worth.';
  const held = { ...plan, wishlist: { ...plan.wishlist, reserves: reserveList } };
  const count = notOnTrack(held, given.readings);
  const end = engine.mapOrder(run).endpoint;
  const endLabel = engine.maps().find((m) => m.id === end.map)?.label ?? end.key;
  return {
    title: `Wishlist for ${endLabel}: ${units.length} fielded${given.readings ? ` · ${notOnTrackText(count, plannedUnits(held, given.readings))}` : ''}`,
    rows,
    others,
    reserves: reserveRows,
    reservesNote,
    notOnTrack: count,
  };
}

const KIND_TITLES: Readonly<Record<UnitEditView['kind'], string>> = {
  marriage: 'Marriages',
  robin: 'Robin',
  class: 'Endpoint class',
  build: 'Build skills',
  pass: 'Passed skills',
  lineup: 'Endpoint lineup',
  pair: 'Endpoint pairs',
  priority: 'EXP priority',
  place: 'Paralogue places',
  optional: 'Optional maps',
  seal: 'Seals',
  item: 'Items',
  'side-goal': 'Side goals',
  keep: 'Keep in or out',
};

/** An edit's cost as its row reads it: "costing…", then provisional, then settled (spec #175 story 11). */
export function costText(cost: EditCost | undefined): { readonly text: string; readonly phase: 'costing' | 'provisional' | 'settled' } {
  if (!cost) return { text: 'costing…', phase: 'costing' };
  if (cost.runs === 0) return { text: 'no measurable difference: the simulation doesn’t read it', phase: 'settled' };
  if (!cost.settled) return { text: `≈ ${differenceText(cost.gain, cost.margin)}, provisional (${cost.runs} runs)`, phase: 'provisional' };
  return { text: differenceText(cost.gain, cost.margin, cost.verdict === 'close' || cost.verdict === 'unclear'), phase: 'settled' };
}

export type EditRowView = {
  readonly key: string;
  readonly label: string;
  readonly cost: string;
  readonly phase: ReturnType<typeof costText>['phase'];
  /** Its pins, when a pin kind holds it; none: it can only come as the search's proposal. */
  readonly pins: readonly PlanPin[];
  /** Every one of its pins is already the run's. */
  readonly pinned: boolean;
};

/** A unit's edits grouped by kind, in the search's order with keeping it in or out last, each with its cost. */
export function unitEditsReadout(run: Run, edits: readonly UnitEditView[] | undefined, costs: ReadonlyMap<string, EditCost>): { readonly groups: readonly { readonly title: string; readonly rows: readonly EditRowView[] }[]; readonly summary: string } {
  if (!edits) return { groups: [], summary: 'Listing the edits that touch it…' };
  const has = new Set((run.pins ?? []).map(pinKey));
  const kinds = [...new Set(edits.map((e) => e.kind))].sort((a, b) => (a === 'keep' ? 1 : 0) - (b === 'keep' ? 1 : 0));
  const groups = kinds.map((kind) => ({
    title: KIND_TITLES[kind],
    rows: edits
      .filter((e) => e.kind === kind)
      .map((e) => {
        const c = costText(costs.get(e.key));
        return { key: e.key, label: e.label, cost: c.text, phase: c.phase, pins: e.pins, pinned: e.pins.length > 0 && e.pins.every((p) => has.has(pinKey(p))) };
      }),
  }));
  const costed = edits.filter((e) => costs.get(e.key)?.settled).length;
  return { groups, summary: `${edits.length} edit${edits.length === 1 ? '' : 's'} touch${edits.length === 1 ? 'es' : ''} it · ${costed} settled` };
}

// ---- worker state ----

/** A plan's idle work (#202) as it arrives: worth and utility, then the reserves. */
type IdleState = { worth?: WorthStep; reserves?: ReservesStep; done: boolean };
const IDLE = new WeakMap<Plan, IdleState>();

/**
 * A unit's worth to the run's adopted plan, once the idle work has it (#202); undefined before. Unit pages read it to
 * show unit opinion beside the worth where they strongly disagree (#212).
 */
export function unitWorthOf(run: Run, unit: RosterUnit): UnitWorth | undefined {
  const plan = solveState(run)?.plan;
  return plan ? IDLE.get(plan)?.worth?.units.find((w) => w.unit === unit) : undefined;
}
/** A unit's edits on a plan, as the worker lists and costs them. */
type EditsState = { edits?: readonly UnitEditView[]; costs: Map<string, EditCost>; done: boolean };
const EDITS = new WeakMap<Plan, Map<RosterUnit, EditsState>>();
/** The idle work's time budget: unit worth takes about 10 s at a few runs, the reserves as long again. */
const IDLE_SECONDS = 120;

/** Starts the idle work for the plan once the solve is done (it stops if a new solve starts). */
function idleFor(ctx: WishlistContext, plan: Plan, working: boolean): IdleState | undefined {
  const held = IDLE.get(plan);
  if (held || working || !ctx.assumptions) return held;
  const pins = ctx.pins?.();
  const state: IdleState = { done: false };
  const started = startSolve(
    { kind: 'idle', assumptions: ctx.assumptions, run: ctx.run, plan, seed: FLAWLESS_SEED, budget: STEP_BUDGET, seconds: IDLE_SECONDS, ...(pins ? { pins } : {}) },
    (reply) => {
      if (reply.kind !== 'idle') return;
      state.worth = reply.worth;
      if (reply.reserves) state.reserves = reply.reserves;
      state.done = reply.done;
      ctx.refresh();
    },
  );
  if (!started) return undefined;
  IDLE.set(plan, state);
  return state;
}

/** Lists and costs a unit's edits on the plan in the worker's second slot, once per plan and unit. */
function editsFor(ctx: WishlistContext, plan: Plan, unit: RosterUnit): EditsState | undefined {
  let byUnit = EDITS.get(plan);
  if (!byUnit) EDITS.set(plan, (byUnit = new Map()));
  const held = byUnit.get(unit);
  if (held || !ctx.assumptions) return held;
  const pins = ctx.pins?.();
  const state: EditsState = { costs: new Map(), done: false };
  const started = startSolve(
    { kind: 'edits', assumptions: ctx.assumptions, run: ctx.run, plan, unit, seed: FLAWLESS_SEED, budgets: [EDIT_COST_BUDGET.provisional, EDIT_COST_BUDGET.settled], ...(pins ? { pins } : {}) },
    (reply) => {
      if (reply.kind === 'edits') {
        state.edits = reply.edits;
        state.done = reply.done;
      } else if (reply.kind === 'edit-cost') state.costs.set(reply.key, reply.cost);
      else return;
      ctx.refresh();
    },
    'edits',
  );
  if (!started) return undefined;
  byUnit.set(unit, state);
  return state;
}

// ---- the page ----

/** Whether Robin is locked (#201): its pin kind lands with that ticket. */
const robinLocked = (run: Run) => (run.pins ?? []).some((p) => (p as { readonly kind: string }).kind === 'robin-lock');

function unitCell(ctx: WishlistContext, u: UnitRowView): HTMLElement {
  const on = ctx.open === u.unit;
  return h(
    'div',
    { class: `wl-unit${on ? ' sel' : ''}` },
    h(
      'div',
      {},
      h('span', { class: 'muted small' }, u.position),
      ' ',
      h('button', { class: 'linkish', title: on ? 'Close its edits' : 'Every edit that touches it, with its cost', 'aria-expanded': on ? 'true' : 'false', onclick: () => ctx.setOpen(on ? undefined : u.unit) }, h('b', {}, u.name)),
      u.cls ? h('span', { class: 'muted small' }, ` ${u.cls}`) : null,
      ' ',
      h('span', { class: 'small wl-worth', title: 'Unit worth: the flawless chance the plan loses without it, over every lineup it plays in (a parent’s includes its children); utility is the part from its sustain (a heal, a potion, Rescue), Dance or Rally actions' }, ...whyText(u.worth, u.worthMarks ?? [])),
      u.reading
        ? u.reading.why
          ? h('button', { type: 'button', class: `chip wl-reading why-chip ${u.reading.kind}`, title: u.reading.title, 'data-why': u.reading.why }, u.reading.text)
          : h('span', { class: `chip wl-reading ${u.reading.kind}`, title: u.reading.title }, u.reading.text)
        : null,
    ),
    u.build.length ? h('div', { class: 'small wl-build' }, ...u.build.map((s) => h('span', { class: 'skill' }, s))) : null,
    u.parents ? h('div', { class: 'muted small' }, u.parents) : null,
  );
}

function editsMenu(ctx: WishlistContext, plan: Plan, unit: RosterUnit, name: string): HTMLElement {
  const state = editsFor(ctx, plan, unit);
  const r = unitEditsReadout(ctx.run, state?.edits, state?.costs ?? new Map());
  const locked = robinLocked(ctx.run);
  /** An edit's cost, explained in the Why panel (#210). */
  const costOf = (row: EditRowView): string | HTMLElement => {
    const c = state?.costs.get(row.key);
    if (!c || c.runs === 0) return row.cost;
    setComparison(`unit:${unit}:${row.key}`, { kind: 'edit', label: row.label, gain: c.gain, margin: c.margin, runs: c.runs, close: c.settled && (c.verdict === 'close' || c.verdict === 'unclear'), settled: c.settled });
    return whyNumber(row.cost, `edit:unit:${unit}:${row.key}`);
  };
  const act = (row: EditRowView) =>
    row.pinned
      ? h('button', { class: 'mini', title: 'Lift its pins', onclick: () => ctx.setRun(withoutPins(ctx.run, row.pins)) }, 'undo')
      : row.pins.length
        ? h('button', { class: 'mini', title: locked ? 'Accept it: its pins hold it from now on' : 'Pin it: a hard constraint on the solve, with its cost among your pins', onclick: () => ctx.setRun(row.pins.reduce(withPin, ctx.run)) }, locked ? 'accept' : 'pin')
        : h('span', { class: 'muted small', title: 'No pin holds this edit: it comes as one of the search’s proposals' }, '');
  return h(
    'div',
    { class: 'wl-menu' },
    h('b', {}, locked ? `Proposals for ${name}` : `${name}: what if…`),
    ' ',
    h('span', { class: 'muted small' }, state ? r.summary : 'Its edits are listed once the solve’s worker is available.'),
    ...r.groups.map((g) =>
      h(
        'details',
        { ...(g.rows.length <= 6 ? { open: true } : {}) },
        h('summary', { class: 'small' }, `${g.title} (${g.rows.length})`),
        ...g.rows.map((row) =>
          h('div', { class: `row small wl-edit${row.pinned ? ' on' : ''}` }, h('span', {}, row.label), ' ', h('span', { class: `cost ${row.phase}` }, costOf(row)), ' ', act(row)),
        ),
      ),
    ),
  );
}

/** One child's row on the children ledger (#212): its fixed parent, the wishlist's parents and passes, and its status. */
export type LedgerRow = {
  readonly child: ChildId;
  readonly name: string;
  readonly fixedParent: RosterUnit;
  /** "Chrom × Olivia", or "—" when the wishlist doesn't recruit it. */
  readonly parents: string;
  /** "passes Aether / Galeforce" (the fixed parent's, then the spouse's); empty when not in the wishlist. */
  readonly passes: string;
  readonly status: LedgerStatus;
};

/**
 * The children ledger (moved here from the Roster, #203; #212 reads it from the run and the plan only, never a score):
 * each child of the run with its fixed parent, the wishlist's parents and passes, and its status: dead or missed from
 * the Roster, parents married once the log records it, else in the wishlist or not.
 */
export function childrenLedger(run: Run, plan: Plan): LedgerRow[] {
  const gender = run.roster.run.gender ?? plan.robin.gender;
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  // Unit states and spouses live in the latest entry.
  const roster = rosterOf(run);
  return rosterUnits({ ...run.roster.run, gender }).flatMap((u): LedgerRow[] => {
    if (u.kind !== 'child') return [];
    const child = u.id as ChildId;
    const fixedParent = CHILD_UNITS[child].fixedParent;
    const wished = plan.wishlist.children.find((c) => c.child === child);
    const st = stateOf(roster, child);
    const married = roster.spouses[fixedParent]?.bond === 'married';
    const status: LedgerStatus = st === 'dead' ? 'dead' : st === 'missed' ? 'missed' : married ? 'married' : wished ? 'wished' : 'out';
    return [
      {
        child,
        name: u.name,
        fixedParent,
        parents: wished ? `${name(wished.parents[0])} × ${name(wished.parents[1])}` : '—',
        passes: wished ? `passes ${wished.passes.map((p) => (p ? skillName(p) : '—')).join(' / ')}` : '',
        status,
      },
    ];
  });
}

function ledgerSection(ctx: WishlistContext, plan: Plan): HTMLElement {
  const gender = ctx.run.roster.run.gender ?? plan.robin.gender;
  const row = (e: LedgerRow) => {
    const st = LEDGER_UI[e.status];
    return h(
      'tr',
      { class: `ledger-${e.status}` },
      h('td', { class: 'uname' }, unitLink(ctx.openUnit, e.child, e.name)),
      h('td', { class: 'muted' }, unitLink(ctx.openUnit, e.fixedParent, unitName(e.fixedParent, gender))),
      h('td', { title: 'The wishlist’s parents for it' }, e.parents, e.passes ? h('span', { class: 'muted small' }, ` · ${e.passes}`) : null),
      h('td', { class: `lstatus ${e.status}`, title: st.hint }, `${st.mark} ${st.label}`),
    );
  };
  return h(
    'section',
    { ...guide('children-ledger'), class: 'rsec ledger', 'aria-label': 'Children ledger' },
    h('h3', {}, 'Children ledger'),
    h('p', { class: 'muted' }, 'Each child with its fixed parent, the wishlist’s parents and the skills they pass, and its status.'),
    h(
      'div',
      { class: 'ledger-scroll' },
      h(
        'table',
        { class: 'grid ledger' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Child'), h('th', {}, 'Fixed parent'), h('th', {}, 'Wishlist'), h('th', {}, LABELS.ledgerStatus))),
        h('tbody', {}, ...childrenLedger(ctx.run, plan).map(row)),
      ),
    ),
  );
}

export function wishlistPage(ctx: WishlistContext): HTMLElement[] {
  const headline = flawlessSection(ctx);
  const state = solveState(ctx.run);
  const head = h('div', { class: 'main-head' }, h('h2', {}, 'Wishlist'));
  if (!state) {
    // Until the solve's first reply: the ledger of the plan adopted, if any. The seed plan is the worker's to work out
    // (most of a second on Lunatic+), never the page's.
    const adopted = adoptedOf(ctx.run);
    return [head, h('div', { class: 'scroll wishlist' }, headline, h('p', { class: 'muted' }, 'Working out the plan…'), adopted ? ledgerSection(ctx, adopted) : null)];
  }
  const { plan, progress, working } = state;
  const idle = idleFor(ctx, plan, working);
  // What the Why panel explains here (#210): each unit's worth, and what each reserve restores.
  if (idle?.worth) setWorth(plan, idle.worth.units);
  for (const x of idle?.reserves?.reserves ?? [])
    setComparison(`reserve:${x.unit}`, { kind: 'reserve', label: `${unitName(x.unit, ctx.run.roster.run.gender ?? plan.robin.gender)} as a reserve`, gain: x.restores, margin: x.margin, runs: x.runs });
  const r = wishlistReadout(ctx.engine, ctx.run, plan, {
    ...(idle?.worth ? { worth: idle.worth } : {}),
    ...(idle?.reserves ? { reserves: idle.reserves } : {}),
    ...(progress?.readings ? { readings: progress.readings } : {}),
    idleDone: !!idle?.done,
  });
  const menu = (u: UnitRowView | undefined) => (u && ctx.open === u.unit ? editsMenu(ctx, plan, u.unit, u.name) : null);
  const status = working
    ? 'The search is still at it: what it finds arrives as proposals in the Run view’s inbox; the rows are your plan.'
    : !idle
      ? ''
      : idle.done
        ? ''
        : 'Working out each unit’s worth, then the reserves, while the worker is idle…';
  return [
    h('div', { class: 'main-head' }, h('h2', {}, 'Wishlist'), h('span', { class: 'muted' }, r.title.slice(r.title.indexOf(': ') + 2))),
    h(
      'div',
      { class: 'scroll wishlist' },
      headline,
      status ? h('p', { class: 'muted small' }, status) : null,
      h(
        'table',
        { ...guide('wishlist-army'), class: 'grid wl-sheet', 'aria-label': r.title },
        h('thead', {}, h('tr', {}, h('th', {}, 'Lead / Solo'), h('th', {}, 'Back'))),
        h(
          'tbody',
          {},
          ...r.rows.flatMap((row) => {
            const open = menu(row.lead) ?? menu(row.back);
            return [
              h('tr', {}, h('td', {}, unitCell(ctx, row.lead)), h('td', {}, row.back ? unitCell(ctx, row.back) : '')),
              ...(open ? [h('tr', {}, h('td', { colspan: '2' }, open))] : []),
            ];
          }),
        ),
      ),
      r.others.length
        ? h('section', { class: 'rsec', 'aria-label': 'Also in the plan' }, h('h3', {}, 'Also in the plan'), h('p', { class: 'muted small' }, 'Units the plan needs off the endpoint lineup: a parent there for its child.'), ...r.others.flatMap((u) => [unitCell(ctx, u), menu(u)].filter((x): x is HTMLElement => !!x)))
        : null,
      h(
        'section',
        { class: 'rsec', 'aria-label': 'Reserves' },
        h('h3', {}, 'Reserves'),
        h('p', { class: 'muted small' }, r.reservesNote),
        ...r.reserves.flatMap((x) => {
          const u = { unit: x.unit, name: unitName(x.unit, ctx.run.roster.run.gender ?? plan.robin.gender) } as UnitRowView;
          return [
            h(
              'div',
              { class: `row wl-res${ctx.open === x.unit ? ' sel' : ''}` },
              h('button', { class: 'linkish', title: 'Every edit that touches it, with its cost', onclick: () => ctx.setOpen(ctx.open === x.unit ? undefined : x.unit) }, x.marks?.length ? x.text.slice(0, x.text.indexOf(x.marks[0]![0])) : x.text),
              ...(x.marks?.length ? whyText(x.text.slice(x.text.indexOf(x.marks[0]![0])), x.marks) : []),
            ),
            menu(u),
          ].filter((e): e is HTMLElement => !!e);
        }),
      ),
      ledgerSection(ctx, plan),
    ),
  ];
}
