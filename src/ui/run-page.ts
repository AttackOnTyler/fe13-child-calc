/**
 * The Run view (#116): the chapter log, newest first, and the Maps list. Each entry is tagged with the map played and
 * holds a snapshot: every unit's class, level, EXP, stats, skills, inventory and supports, plus the convoy and gold.
 * A new entry copies the one before; editing a past entry never reaches later ones, which are flagged instead.
 */
import type { Assumptions, Ceiling, ChildId, CloseCall, Gender, Reading, Readings, SuggestedPin, Engine, FlawlessChance, FlawlessOptions, GoldSpread, HeldItem, ItemPin, ItemPlanRow, ItemUsed, MapOrderStep, Milestone, MilestonePoint, PinCost, Plan, PlanPin, PlanProposal, PlanRobin, PrunedComp, RobinCost, RobinCursor, RobinStep, RosterUnit, Run, RunEntry, Snapshot, SupportLevel, UnitInternalLevel, UnitSnapshot } from '../engine';
import { chanceText, chanceWithMargin, differenceText, noDeathText, stressText } from './chance';
import { startSolve } from './solve-client';
import { SOLVE_SECONDS, STEP_BUDGET, rescoreSeed, rosterUnits, type RunSim, type StressCase } from '../engine';
import { EMPTY_SNAPSHOT, FLAWLESS_SEED, SUPPORT_LEVELS, addEntry, childJoinFrom, chromWedding, editEntry, exportRun, flaggedEntries, heldProblems, importRun, latestEntry, nextMaps, recordFallen, recordMarriage, removeEntry, rosterOf, unitName, waitsForRobin, withUnit } from '../engine';
import { removeClassChange, tierOfClass, withClassChange, withCountOverride, type Seal } from '../engine';
import { entryAfterShopping, goldAfterShopping, removeShopLine, shopPrice, withShopLine, type ShopKind, type ShopLine } from '../engine';
import { withRenown, withSideGoalPin, withSideGoalSecured, type SideGoalDecision, type SideGoalId } from '../engine';
import { runItemPins, withItemPin, withItemsUsed } from '../engine';
import { robinLock, withRobinLock, withoutPins } from '../engine';
import { adoptedOf, dismissMigrationNote, withEdit, withPin, withPlanHeld } from '../engine';
import { CHILD_UNITS } from '../game-data/children';
import { STATS, STAT_LABELS, type Stat } from '../game-data/stats';
import { h } from './dom';
import { guide } from './guide';
import { mapsView, type MapsContext } from './maps-page';
import { beforeTheLock, inboxNudge, inboxProgress, inboxRobinMoved, inboxView, lockOffer, robinName, type RobinBest } from './inbox';
import { GAME_OVER_UNITS, forecastBefore, openLosses, proposalId, recordMissed, unrecordLoss, withEntryForecast, type Comparison, type WhatItCost } from '../engine';
import { openAssumptions, setComparison, whyText, type WhyMark } from './why';

/** A chance as `chanceText` writes it, in a line: the first one. */
const CHANCE_IN = /over 99\.9%|under 0\.1%|\d+(?:\.\d)?%/;
import { calibration, learnCorrections, withLearned } from '../engine';
import { withEntryChecks, type CheckedRules } from '../engine';
import { currentRules, ruleEvidence } from './checked-rules';
import { checksProgress, checksStep, lineupOf } from './checks-view';

export type RunContext = {
  readonly engine: Engine;
  /** The resolved assumptions the engine was built with: a child's join stats read them (#155). */
  readonly assumptions?: Assumptions;
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
  /** The marriages the player pinned (#198) and the run's item pins (#193): the seed keeps them, so the flawless chance's plan does. */
  readonly pins?: () => readonly PlanPin[];
  /** Called when the solve's progress for the run changes (#203: the Wishlist tab and its count follow it). */
  readonly onProgress?: () => void;
  /**
   * Changes the checked rules (#209: a check settled in Record results): main.ts saves them, rebuilds the model and
   * relearns the corrections. Absent: the Checks step shows the checks without taking answers.
   */
  readonly setRules?: (rules: CheckedRules) => void;
};

/** What the headline reads: the Wishlist tab draws it too (#203), so opening it first starts the solve. */
export type HeadlineContext = Pick<RunContext, 'engine' | 'assumptions' | 'run' | 'setRun' | 'pins' | 'onProgress'>;

const RECORD_STEPS = ['Deployed units', 'Recruits', 'Deaths and marriages', 'Convoy and gold', 'Shopping', 'Side goals and renown', 'Items used', 'Checks'] as const;

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

/**
 * The run with a map's entry added (#118), keeping the headline as it stands before the map on it (#206: What changed
 * reads it against the headline worked out after, so the forecast isn't lost once the run moves on).
 */
export function withMapRecorded(ctx: Pick<RunContext, 'engine' | 'run' | 'now' | 'assumptions' | 'pins'>, map: string, label?: string): Run {
  const s = solveState(ctx.run);
  const before = s?.chance && forecastBefore(ctx.run, s.chance, s.readings);
  // The plan the map is played by is held from here (#208): a loss recorded on it is read against it, never against a
  // plan seeded after the loss. Recorded before the solve had a plan: the plan the player would get on the run as it
  // stood (the seed, worked out once here, on the click).
  const pins = ctx.pins?.();
  const held = adoptedOf(ctx.run) ? undefined : (s?.plan ?? ctx.engine.adoptedPlan(ctx.run, pins ? { pins } : {}));
  const next = addEntry(held ? withPlanHeld(ctx.run, held) : ctx.run, map, ctx.now(), label, ctx.assumptions);
  const id = latestEntry(next)!.id;
  const kept = before ? withEntryForecast(next, id, before) : next;
  // The checks the map offered (#209), as the plan stood before it: Record results' Checks step lists only these.
  const offered = s ? offeredChecks(ctx, s.plan, s.chance, map) : [];
  return offered.length ? withEntryChecks(kept, id, offered) : kept;
}

/** The free checks a map offers on the plan before it's recorded (#209), with the stakes worked out so far. */
function offeredChecks(ctx: Pick<RunContext, 'engine' | 'run'>, plan: Plan, chance: FlawlessChance | undefined, map: string): { readonly rule: string; readonly text: string }[] {
  const key = ctx.engine.mapOrder(ctx.run).steps.find((x) => x.map === map)?.key;
  if (!key) return [];
  const rules = currentRules();
  const stakes = checksProgress(ctx.run, plan, rules)?.stakes;
  const d = chance?.maps.find((m) => m.key === key)?.lineup;
  const where = d ? { lineup: lineupOf(key, d) } : { lineups: plan.roadmap.lineups };
  return ctx.engine.mapChecks(ctx.run, plan, key, { rules, ...(stakes ? { stakes } : {}), ...where }).map((c) => ({ rule: c.rule, text: c.text }));
}

/**
 * The maps the run can play next (#118): the story's next map first; Record results starts its entry. After the Lock,
 * the inbox's open items above read as a nudge here, never a gate (#206).
 */
function nextMapSection(ctx: RunContext): HTMLElement {
  const offers = nextMaps(ctx.run);
  const label = (id: string) => {
    const m = ctx.engine.maps().find((x) => x.id === id)!;
    return m.kind === 'xenologue' ? m.label : `${m.label}: ${m.title}`;
  };
  const record = (map: string) => {
    const next = withMapRecorded(ctx, map);
    ctx.setRun(next);
    ctx.setRecording({ entry: latestEntry(next)!.id, step: 0 });
  };
  const row = (o: (typeof offers)[number], first: boolean) =>
    h(
      'div',
      { class: `row${first ? ' next-first' : ''}` },
      h('b', {}, label(o.map)),
      o.note ? h('span', { class: 'muted small' }, o.note) : null,
      h('button', { ...(first ? guide('prepare') : {}), class: first ? '' : 'mini', title: 'Get ready for this map: your army and the units joining on it', onclick: () => ctx.prepare(o.map) }, 'Prepare'),
      waitsForRobin(ctx.run, o.map)
        ? h('span', { class: 'small warn' }, 'Lock Robin first: this map recruits Robin, who needs a gender, asset and flaw.')
        : h('button', { ...(first ? guide('record-results') : {}), class: first ? '' : 'mini', title: 'Played it: record how it went', onclick: () => record(o.map) }, 'Record results'),
    );
  const story = offers.filter((o) => o.kind === 'story');
  const rest = offers.filter((o) => o.kind !== 'story');
  return h(
    'div',
    { ...guide('next-map'), class: 'banner next-map' },
    h('b', {}, 'Next map'),
    beforeTheLock(ctx.run) ? null : inboxNudge(ctx),
    ...(offers.length ? [...story.map((o, i) => row(o, i === 0)), ...(rest.length ? [h('details', {}, h('summary', { class: 'small' }, `Also open (${rest.length})`), ...rest.map((o) => row(o, false)))] : [])] : [h('span', { class: 'muted' }, 'Nothing left to play on this route.')]),
  );
}

const ROUTE_NAMES = { 'main-story': 'Main story', 'full-route': 'Full route' } as const;

/**
 * The map order still to play (#179), as the Run view writes it: a title naming the route and its endpoint, and one
 * row per map, marking the child paralogues the plan places, Infinite Regalia as optional, and the endpoint.
 */
export function mapOrderReadout(engine: Engine, run: Run): { readonly title: string; readonly rows: readonly string[] } {
  const order = engine.mapOrder(run);
  const name = (s: MapOrderStep, short = false) => {
    const m = engine.maps().find((x) => x.id === s.map)!;
    const base = short || m.kind === 'xenologue' ? m.label : `${m.label}: ${m.title}`;
    return s.secret ? `${base} (secret route)` : base;
  };
  const row = (s: MapOrderStep) =>
    [name(s), s.movable ? '(the plan places it)' : '', s.optional ? '(optional)' : '', s.key === order.endpoint.key ? '(endpoint)' : ''].filter(Boolean).join(' ');
  return {
    title: `Map order: ${ROUTE_NAMES[order.route]}, to ${name(order.endpoint, true)}, deploying ${order.endpoint.deploy}`,
    rows: order.steps.map(row),
  };
}

/** The roadmap as the Run view writes it: its milestones, and each unit's reading (#197) once read. */
export type RoadmapReadout = {
  readonly title: string;
  readonly rows: readonly string[];
  readonly readings: readonly string[];
  readonly note: string;
  /** The plan's map-level choices (spec #175 story 31): each optional map on the order, played or skipped. */
  readonly choices: readonly string[];
  /** The numbers in its rows and readings, for the Why panel (#210): each milestone's chance. */
  readonly marks?: { readonly rows: readonly (readonly WhyMark[])[]; readonly readings: readonly (readonly WhyMark[])[] };
};

/**
 * The plan's roadmap as the Run view lists it (#194): its milestones in order, one row each, naming what must be true
 * before which map, and flagging non-starters, wasted passes and seals that aren't sure. With the plan's readings
 * (#197), each milestone's chance, and each unit's reading, behind first (`readingRow`).
 */
export function roadmapReadout(engine: Engine, run: Run, plan: Plan, readings?: Readings, labels?: ReadonlyMap<string, string>): RoadmapReadout {
  const ms = engine.milestones(run, plan);
  const gender = run.roster.run.gender;
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  const before = (p: MilestonePoint) => (p.when === 'end' ? `by the end of ${p.label}` : `before ${p.label}`);
  const row = (m: Milestone): string => {
    switch (m.kind) {
      case 'support': {
        const { earliest, latest, maps } = m.window;
        if (m.wedding) {
          const wife = m.pair[0] === 'chrom' ? m.pair[1] : m.pair[0];
          const head = `Chrom marries ${name(wife)} at the end of ${m.at.label} (fixed)`;
          const span = `${maps} map${maps === 1 ? '' : 's'}`;
          if (m.wedding.needs === 'olivia-points') {
            const rivals = listOf(m.wedding.rivals.map(name));
            if (m.wedding.shutOutBy) return `${head} · non-starter: ${listOf(m.wedding.shutOutBy.map(name))} already has a C with him viewed`;
            if (m.nonStarter) return `${head} · non-starter: ${name(wife)} isn’t fielded on ${m.at.label}`;
            return `${head}: 2 points with him on ${m.at.label} (3 combats as his Support Unit)${rivals ? `, with no C with him viewed for ${rivals}` : ''}`;
          }
          if (m.nonStarter) return `${head} · non-starter: a C with him viewed before ${m.at.label} needs ${span} together${earliest ? `, from ${earliest.label} on` : ''}`;
          return `${head}: a C with him viewed before ${m.at.label}; ${maps ? `start fighting together between ${earliest!.label} and ${latest!.label} (${span})` : 'viewed already'}`;
        }
        const head = `${name(m.pair[0])} and ${name(m.pair[1])} reach ${m.rank} ${before(m.at)}${m.fixed ? ' (fixed)' : ''}`;
        if (m.nonStarter) return `${head} · non-starter: ${maps} maps together needed${earliest ? `, from ${earliest.label} on` : ''}`;
        return `${head}: start fighting together between ${earliest!.label} and ${latest!.label} (${maps} maps)`;
      }
      case 'skill': {
        const via = m.learn ? ` (${m.learn.className} Lv ${m.learn.level})` : '';
        const wasted = m.wasted === 'child-has' ? ' · wasted: the child already has it' : m.wasted === 'both-parents' ? ' · wasted: the other parent passes it too' : '';
        return m.for.kind === 'pass'
          ? `${name(m.unit)} learns ${m.name}${via} and equips it last ${before(m.at)}, for ${name(m.for.child)}${wasted}`
          : `${name(m.unit)} learns ${m.name}${via} ${before(m.at)}`;
      }
      case 'recruit':
        return `Recruit ${name(m.child)} (${name(m.parents[0])} and ${name(m.parents[1])}) on ${m.at.label}${m.needed ? `, ${before(m.needed)}` : ''}`;
      case 'class': {
        const seal = m.seal === 'master' ? 'Master Seal' : 'Second Seal';
        const s = m.source;
        const from = s.how === 'held' ? `a ${seal} held` : s.how === 'found' ? `a ${seal} found on ${s.at.label} (${s.note})` : s.how === 'armory' ? `a ${seal} bought from ${s.at.label}’s armory` : `a ${seal}`;
        return `${name(m.unit)} reaches ${m.className} ${before(m.at)}: ${from}${m.risk ? ` · at risk: ${m.risk}` : ''}`;
      }
    }
  };
  const stuck = ms.filter((m) => m.kind === 'support' && m.nonStarter).length;
  const chances = new Map(readings?.readings.flatMap((r) => r.milestones.map((m) => [m.id, m.chance] as const)) ?? []);
  const withChance = (m: Milestone) => {
    if (!readings || !chances.has(m.id)) return row(m);
    const c = chances.get(m.id);
    return `${row(m)} · ${c === undefined ? 'no run reaches it with nobody lost' : chanceText(c)}`;
  };
  const notOn = readings?.readings.filter((r) => r.reading !== 'on-track').length ?? 0;
  const title = `Roadmap: ${ms.length} milestone${ms.length === 1 ? '' : 's'}${stuck ? ` · ${stuck} non-starter${stuck === 1 ? '' : 's'}` : ''}${readings ? ` · ${notOn ? `${notOn} unit${notOn === 1 ? '' : 's'} not on track` : 'every unit on track'}` : ''}`;
  const note = readings
    ? `A unit reads on track when its worst milestone’s chance is 80% or more, at risk when one suggested change brings it back to 80% without pushing another below (“at risk?” until the changes are read), and behind when none does or its deadline map has started. Behind first, each by the flawless chance lost (${readings.lostBy === 'worth' ? 'its worth times the share of runs missing it' : 'the share of runs missing its worst milestone'}). Recorded stats show as percentiles of the spread the level-ups since the entry before could roll; they never change a reading.`
    : '';
  const rowMarks = ms.map((m): WhyMark[] => {
    const c = chances.get(m.id);
    return readings && c !== undefined ? [[chanceText(c), `milestone:${m.id}`]] : [];
  });
  const kept = new Set(plan.roadmap.optional ?? []);
  const choices = engine
    .mapOrder(run)
    .steps.filter((s) => s.optional)
    .map((s) => `${labels?.get(s.key) ?? engine.maps().find((m) => m.id === s.map)?.label ?? s.key} (optional): ${kept.has(s.key) ? 'played: the plan keeps it for its rewards' : 'skipped: played only when its rewards earn its risk'}`);
  return {
    title,
    choices,
    rows: ms.map(withChance),
    readings: readings?.readings.map((r) => readingRow(r, ms, gender, labels)) ?? [],
    note,
    marks: { rows: rowMarks, readings: (readings?.readings ?? []).map(readingMarks) },
  };
}

/** A reading's numbers (#210): its worst milestone's chance. */
export function readingMarks(r: Reading): WhyMark[] {
  return r.worst?.reached ? [[chanceText(r.worst.chance), `milestone:${r.worst.id}`]] : [];
}

const READING_TEXT = { 'on-track': 'on track', 'at-risk': 'at risk', behind: 'behind' } as const;

/** A milestone in a few words, as a reading names it for `unit`. */
export function milestoneShort(m: Milestone, unit: RosterUnit, gender: Gender | null | undefined): string {
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  const by = m.at.when === 'end' ? `by the end of ${m.at.label}` : `before ${m.at.label}`;
  switch (m.kind) {
    case 'support': {
      const other = m.pair[0] === unit ? m.pair[1] : m.pair[1] === unit ? m.pair[0] : undefined;
      return other ? `${m.wedding ? 'marrying' : 'S with'} ${name(other)} ${by}` : `${name(m.pair[0])} and ${name(m.pair[1])} at S ${by}`;
    }
    case 'skill':
      return `${m.name} ${by}${m.for.kind === 'pass' ? ` (for ${name(m.for.child)})` : ''}`;
    case 'recruit':
      return `recruited on ${m.at.label}`;
    case 'class':
      return `${m.className} ${by}`;
  }
}

/** A suggested change's span pin in words: "raise Lissa's EXP priority from Ch 3 to Ch 7". */
export function pinText(pin: SuggestedPin, gender: Gender | null | undefined, labels?: ReadonlyMap<string, string>): string {
  const name = (u: RosterUnit) => unitName(u, gender);
  const span = pin.from === pin.to ? `on ${labels?.get(pin.from) ?? pin.from}` : `from ${labels?.get(pin.from) ?? pin.from} to ${labels?.get(pin.to) ?? pin.to}`;
  switch (pin.kind) {
    case 'priority':
      return `${pin.value === 'high' ? 'raise' : 'lower'} ${name(pin.unit)}’s EXP priority ${span}`;
    case 'pair':
      return `pair ${name(pin.unit)} as Lead with ${name(pin.value)} as Back ${span}`;
    case 'field':
      return `field ${name(pin.unit)} ${span}${pin.benched.length ? `, benching ${listOf(pin.benched.map(name))}` : ''}`;
  }
}

/**
 * One unit's reading (#197) as the roadmap writes it: the reading, its worst milestone and chance, why it's behind or
 * the change that restores it, and its recorded stats as percentiles.
 */
export function readingRow(r: Reading, ms: readonly Milestone[], gender: Gender | null | undefined, labels?: ReadonlyMap<string, string>): string {
  const head = `${unitName(r.unit, gender)}: ${READING_TEXT[r.reading]}${r.pending ? '?' : ''}`;
  const m = r.worst && ms.find((x) => x.id === r.worst!.id);
  const worst = !r.worst ? 'no milestones left' : `${m ? milestoneShort(m, r.unit, gender) : r.worst.id} ${r.worst.reached ? chanceText(r.worst.chance) : '(no run reaches it with nobody lost)'}`;
  const why =
    r.why === 'non-starter'
      ? 'a non-starter: the pair can’t reach it in the maps left'
      : r.why === 'deadline'
        ? 'its deadline map has started'
        : r.why === 'no-change'
          ? 'no single change brings it back to 80%'
          : r.change
            ? `${pinText(r.change.pin, gender, labels)}: ${chanceText(r.change.chance)}`
            : r.pending
              ? 'reading the changes that could bring it back'
              : '';
  const stats = r.stats.length ? `recorded ${r.stats.map((s) => `${STAT_LABELS[s.stat]} p${s.percentile}`).join(', ')}` : '';
  return [head, worst, why, stats].filter(Boolean).join(' · ');
}

const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What the headline is worked out from: the seed's runs and the player's pins (#198). */
export type FlawlessReadoutOptions = Pick<FlawlessOptions, 'seed' | 'runs'> & { readonly pins?: readonly PlanPin[] };

/** Where the solve's Web Worker stands (#199): its latest best plan, the chance re-scored for it, and what it found. */
export type SolveProgress = {
  readonly best: Plan;
  /** The plan the search started from (#204): the adopted plan, or the seed when none is. */
  readonly start?: Plan;
  readonly chance: FlawlessChance;
  /** The best plan's ceiling (#189) on the chance's runs, worked out in the worker with the chance; absent: none (yet). */
  readonly ceiling?: Ceiling;
  readonly proposals: readonly PlanProposal[];
  readonly closeCalls: readonly CloseCall[];
  readonly pruned: readonly PrunedComp[];
  /** The worker is done: converged, or out of time. */
  readonly done: boolean;
  readonly converged: boolean;
  /** The pins' cost together (#200), worked out once the search is done, while the worker is idle. */
  readonly pinCost?: PinCost;
  /** The best plan's readings (#197), worked out once the search is done, while the worker is idle. */
  readonly readings?: Readings;
  /** An open loss's re-solve (#208): the best plan found from the loss item's proposal, and its chance. */
  readonly loss?: { readonly plan: Plan; readonly chance: number; readonly margin: number };
  /** What it cost for the latest recorded map (#208), priced after the readings; undefined inside: nothing to price. */
  readonly cost?: { readonly value: WhatItCost | undefined };
  /**
   * The best plan re-run under each stressed blind spot's bad case (#211), on the headline's seed and runs, by case:
   * worked out once the search is done, while the worker is idle.
   */
  readonly stress?: Readonly<Partial<Record<StressCase, RunSim>>>;
};

export type FlawlessReadout = {
  readonly text: string;
  readonly detail: string;
  readonly rows: readonly string[];
  /** The search's improvements, close calls and pruned marriages, one line each (#199; the inbox is #204). */
  readonly found: readonly string[];
  /** What the search found less its improvements and close calls: the inbox lists those as its own items (#204). */
  readonly notes: readonly string[];
  /** With a 0% headline (no run gets through), where the runs die, shown under the chance itself (`noRunGetsThrough`). */
  readonly dies?: { readonly text: string; readonly marks: readonly WhyMark[] };
  /** The plan's roadmap (#194); absent once the endpoint is recorded. */
  readonly roadmap?: RoadmapReadout;
  /** The plan's item plan (#193), and the plan itself (its wishlist offers the item pins' units); absent once the endpoint is recorded. */
  readonly items?: ItemPlanReadout;
  readonly plan?: Plan;
  /**
   * The stress-test ranges (#211): for each blind spot that can be stressed and moves the chance, how low it could go
   * ("as low as 31.8% if two attackers reach each exposed pair"), each with its explanation's id.
   */
  readonly stress: readonly { readonly text: string; readonly id: string }[];
  /** The headline's own chance and the readings it shows (#206: a map's record keeps them for What changed). */
  readonly chance?: FlawlessChance;
  readonly readings?: Readings;
  /**
   * The numbers in its lines, for the Why panel (#210): the headline's and the ceiling's, each map's no-death chance,
   * gold and side goals, and what the search found; and the differences it shows, to hand the panel.
   */
  readonly why?: {
    readonly text: readonly WhyMark[];
    readonly rows: readonly (readonly WhyMark[])[];
    readonly found: readonly (readonly WhyMark[])[];
    readonly notes: readonly (readonly WhyMark[])[];
    readonly comparisons: readonly WhyComparison[];
  };
};

/**
 * The stress-test ranges (#211) beside a chance: each stressed blind spot's bad case that moves it, in words, with its
 * explanation's id (`stress:<case>`).
 */
export function stressRanges(engine: Engine, chance: number, stressed: Readonly<Partial<Record<StressCase, { readonly chance: number }>>> | undefined): { readonly text: string; readonly id: string }[] {
  return engine.stressTests().flatMap((t) => {
    const s = stressed?.[t.id];
    const text = s && stressText(chance, s.chance, t.bad);
    return text ? [{ text, id: `stress:${t.id}` }] : [];
  });
}

/** A difference the page shows, as the Why panel takes it (`setComparison`). */
export type WhyComparison = { readonly key: string; readonly comparison: Comparison; readonly plans?: { readonly other: Plan; readonly base: Plan } };

/**
 * The headline flawless chance (#186), as the Run view writes it: the seed plan's (#198: its marriages, Robin and
 * lineups, the player's pinned marriages kept) with its simulation error (±, 95%) and the ceiling beside it (#189), what
 * it covers and rests on (units whose seal history is read as 0, units it can't simulate, maps whose foes carry no
 * weapons, the blind spots), each map's no-death chance for the runs that reach it with nobody lost, and the plan's
 * roadmap (#194). Worked out here, on the page; with the solve's Web Worker the headline is `solvedReadout`'s.
 */
/**
 * The search's close calls worth showing: a close call with both plans at 0% on every run (no difference, no error,
 * under a 0% headline) and no difference in turns it would show carries no information, so it's left out until a run
 * gets through. One that saves turns, or whose runs get further or less far (#242), still reads.
 */
export function closeCallsShown(progress: Pick<SolveProgress, 'closeCalls' | 'chance'>): readonly CloseCall[] {
  const blank = progress.chance.chance === 0;
  const tenths = (x: number | undefined) => Math.round(Math.abs(x ?? 0) * 10);
  return progress.closeCalls.filter((c) => !(blank && c.gain === 0 && c.margin === 0 && tenths(c.turns) === 0 && tenths(c.cleared?.gain) === 0));
}

/** Where the runs die, most first: at most this many maps named when no run gets through. */
const DEATH_MAPS = 3;

/**
 * When no run gets through (a 0% headline), the line the inbox leads with: where the runs die (the maps with the lowest
 * no-death chance, the Why panel's "where the points go" by map), and the first map no run reaches with nobody lost.
 * With the runs' maps cleared, how far they get on average: what ranks the plans at 0% (#242).
 */
export function noRunGetsThrough(r: Pick<FlawlessChance, 'chance' | 'maps'> & Partial<Pick<FlawlessChance, 'clearedSamples'>>): { readonly text: string; readonly marks: WhyMark[] } | undefined {
  if (r.chance > 0 || !r.maps.length) return undefined;
  const worst = r.maps
    .filter((m): m is typeof m & { noDeath: number } => m.noDeath !== undefined && m.noDeath < 1)
    .sort((a, b) => a.noDeath - b.noDeath)
    .slice(0, DEATH_MAPS);
  const unreached = r.maps.find((m) => m.noDeath === undefined);
  const where = worst.map((m) => `${m.label} (${noDeathText(m.noDeath)})`);
  const cleared = r.clearedSamples?.length ? r.clearedSamples.reduce((a, b) => a + b, 0) / r.clearedSamples.length : undefined;
  const far = cleared === undefined ? '' : ` Runs clear ${cleared.toFixed(1)} of ${r.maps.length} maps with nobody lost, on average: at 0%, plans are ranked by how far runs get.`;
  const text = `No run gets through with nobody lost.${where.length ? ` Where the runs die: ${listOf(where)}.` : ''}${unreached ? ` No run reaches ${unreached.label} with nobody lost.` : ''}${far}`;
  return { text, marks: worst.map((m): WhyMark => [noDeathText(m.noDeath), `map:${m.key}`]) };
}

export function flawlessReadout(engine: Engine, run: Run, options: FlawlessReadoutOptions = {}): FlawlessReadout {
  const { pins, ...sim } = options;
  const plan = engine.adoptedPlan(run, { ...(pins ? { pins } : {}) });
  // The EXP forecast is the flawless chance's own simulation with the milestones checked: the readings' first pass (#197).
  const forecast = engine.expForecast(run, plan, sim);
  const readings = forecast.maps.length ? engine.readings(run, plan, { ...sim, forecast }) : undefined;
  return readoutOf(engine, run, plan, forecast, forecast.maps.length ? engine.ceiling(run, { runs: forecast.runs, plan }) : undefined, pins, undefined, readings);
}

/**
 * The headline as the solve's Web Worker improves it (#199): the best plan found so far, its chance re-scored on fresh
 * runs (so picking it doesn't inflate it), and what the search found: improvements on the plan (proposals, never
 * applied), close calls ("no measurable difference (−0.2 ±0.3)") and marriages pruned by their ceiling.
 */
export function solvedReadout(engine: Engine, run: Run, progress: SolveProgress, pins?: readonly PlanPin[]): FlawlessReadout {
  // The ceiling is the worker's, posted with the step: never worked out here, where every reply would pay for it (a few
  // hundred ms of simulation on Lunatic+, per reply, blocked the page for minutes).
  return readoutOf(engine, run, progress.best, progress.chance, progress.ceiling, pins, progress, progress.readings);
}

function readoutOf(
  engine: Engine,
  run: Run,
  plan: Plan,
  r: FlawlessChance,
  ceiling: Ceiling | undefined,
  pins: readonly PlanPin[] | undefined,
  progress: SolveProgress | undefined,
  readings?: Readings,
): FlawlessReadout {
  if (!r.maps.length) return { text: 'Flawless chance: the endpoint is recorded, nothing left to simulate.', detail: '', rows: [], found: [], notes: [], stress: [] };
  const gender = run.roster.run.gender;
  const names = (us: readonly RosterUnit[]) => listOf(us.map((u) => unitName(u, gender)));
  const first = r.maps[0]!.label;
  const last = r.maps[r.maps.length - 1]!.label;
  const children = r.notSimulated.filter((n) => n.why === 'child').map((n) => n.unit);
  const blank = r.notSimulated.filter((n) => n.why !== 'child').map((n) => n.unit);
  const LEAN = { high: 'may read high', low: 'may read low', either: 'either way' } as const;
  const spots = engine.blindSpots().filter((b) => r.blindSpots.includes(b.id));
  const seedPlan = `marriages${run.roster.run.gender && run.roster.run.asset && run.roster.run.flaw ? '' : ' and Robin'} matched on how much of ${ceiling?.label ?? 'the endpoint'} each child could beat at caps and how long it’s in the army, ${pins?.length ? 'your pinned marriages kept, ' : ''}the endpoint fielded as the plan’s army would fight it at caps, and each parent passing the skill its child’s build wants`;
  const detail = [
    `The chance no unit dies from ${first}${r.maps.length > 1 ? ` to ${last}` : ''} (${r.maps.length} map${r.maps.length === 1 ? '' : 's'}), each played by its suggested deployment while EXP and level-ups are rolled, over ${r.runs} simulated run${r.runs === 1 ? '' : 's'}; the ± is the simulation error (95%).`,
    progress
      ? `It’s the best plan the search has found ${progress.done ? '' : 'so far '}(single edits on the seed plan: ${seedPlan}), each edit kept only when it beats the plan on the same runs by more than twice their error; its chance is worked out again on fresh runs, so picking it doesn’t inflate it.`
      : run.adopted
        ? 'It’s your plan’s: the one you adopted (a proposal accepted, a Robin chosen, an edit made).'
        : `It’s the seed plan’s: ${seedPlan}.`,
    ceiling?.chance !== undefined
      ? `The ceiling is the chance no unit dies on ${ceiling.label} with every unit at its effective caps (a base class promoted) and its recorded skills and weapons: the most any plan for this army could reach there.`
      : '',
    ceiling?.unarmed.length
      ? `${listOf(ceiling.unarmed)} ${ceiling.unarmed.length === 1 ? 'isn’t' : 'aren’t'} simulated yet: ${ceiling.unarmed.length === 1 ? 'its' : 'their'} foes carry no weapons in the chapter data, so the chance counts no risk there${ceiling.chance === undefined ? ' and there’s no ceiling' : ''}.`
      : '',
    r.unknownHistory.length
      ? `${names(r.unknownHistory)} ${r.unknownHistory.length === 1 ? 'was' : 'were'} first logged in a class ${r.unknownHistory.length === 1 ? 'it' : 'they'} can’t join in: the Second Seal count before the log is read as 0 (set it on the chapter log if it isn’t).`
      : '',
    blank.length ? `Not simulated, no stats recorded: ${names(blank)}.` : '',
    `Gold per map is each run’s gold at the map’s end, 10th to 90th percentile: what it held (from your latest entry after its recorded shopping), plus Bullion no play can lose, the side goals it secured and renown’s Bullion (sold at the next armory), less its rebuys, seals and endpoint kit.`,
    r.goldUnrecorded ? 'Your latest entry records no gold, so the runs start with none: record it in the chapter log.' : '',
    r.sideGoals.length ? 'A side goal the plan chases costs actions on its map; the share is the runs that secure it.' : '',
    r.renown.recorded
      ? `Renown is ${r.renown.now} now; each reward arrives on the map that crosses it${r.renown.waiting.length ? `, and ${listOf(r.renown.waiting)} ${r.renown.waiting.length === 1 ? 'is' : 'are'} waiting to be claimed` : ''}.`
      : `Renown isn’t recorded: it reads as 10 per story map logged (${r.renown.now}), every reward so far claimed. Record it in Record results.`,
    children.length ? `Children who don’t join the simulated army (their fixed parent isn’t married in the log or the plan, or a parent isn’t simulated): ${names(children)}.` : '',
    `Rests on: ${spots.map((b) => `${b.label[0]!.toLowerCase()}${b.label.slice(1)} (${LEAN[b.lean]})`).join(', ')}.`,
  ].filter(Boolean);
  const calls = progress ? closeCallsShown(progress) : [];
  const improvements = progress ? [...progress.proposals.map((p) => `Improvement: ${p.edits.join('; ')}: ${differenceText(p.gain, p.margin, p.close, p.turns, p.cleared)}`), ...calls.map((c) => `${c.label}: ${differenceText(c.gain, c.margin, true, c.turns, c.cleared)}`)] : [];
  const dies = noRunGetsThrough(r);
  const notes = [
    ...(progress
      ? [
        ...progress.pruned.map((c) => `Not tried: ${c.label} (its ceiling ${chanceText(c.ceiling)} is below the best found, ${chanceText(c.best)})`),
        ...(progress.pinCost?.pins.length
          ? [
              `Your ${progress.pinCost.pins.length === 1 ? 'pin costs' : `${progress.pinCost.pins.length} pins cost`} ${differenceText(progress.pinCost.cost, progress.pinCost.margin, progress.pinCost.verdict === 'close' || progress.pinCost.verdict === 'unclear')}: the best plan found with ${progress.pinCost.pins.length === 1 ? 'it' : 'them'} lifted, less the best found with ${progress.pinCost.pins.length === 1 ? 'it' : 'them'}`,
            ]
          : []),
      ]
      : []),
  ];
  const status = progress ? (progress.done ? (progress.converged ? ' · searched' : '') : ' · searching…') : '';
  // The numbers, for the Why panel (#210), and the differences it explains: each against the plan the search started from.
  const start = progress?.start ?? progress?.best;
  const comparisons: WhyComparison[] = progress
    ? [
        ...progress.proposals.map((p) => ({ key: `proposal:${proposalId(p)}`, comparison: { kind: 'proposal' as const, label: p.edits.join('; '), gain: p.gain, margin: p.margin, runs: p.runs, ...(p.close ? { close: true } : {}), ...(p.turns !== undefined ? { turns: p.turns } : {}) }, ...(start ? { plans: { other: p.plan, base: start } } : {}) })),
        ...calls.map((c) => ({ key: `close:${c.key}`, comparison: { kind: 'close-call' as const, label: c.label, gain: c.gain, margin: c.margin, runs: c.runs, close: true, ...(c.turns !== undefined ? { turns: c.turns } : {}) }, ...(start ? { plans: { other: c.plan, base: start } } : {}) })),
        ...(progress.pinCost?.pins.length
          ? [{ key: 'pin-cost', comparison: { kind: 'pin-cost' as const, label: 'Your pins’ cost', gain: progress.pinCost.cost, margin: progress.pinCost.margin, runs: progress.pinCost.runs, close: progress.pinCost.verdict === 'close' || progress.pinCost.verdict === 'unclear' } }]
          : []),
      ]
    : [];
  const why = {
    text: [[chanceWithMargin(r), 'flawless'], ...(ceiling?.chance !== undefined ? [[chanceText(ceiling.chance), 'ceiling'] as WhyMark] : [])] as WhyMark[],
    rows: r.maps.map((m): WhyMark[] => [
      ...(m.noDeath !== undefined ? [[noDeathText(m.noDeath), `map:${m.key}`] as WhyMark] : []),
      ...(m.noDeath !== undefined && m.gold ? [[goldRange(m.gold), `gold:${m.key}`] as WhyMark] : []),
      ...r.sideGoals.filter((g) => g.key === m.key && g.chase && g.secured !== undefined).map((g): WhyMark => [`secured ${chanceText(g.secured!)}`, `side-goal:${g.id}`]),
    ]),
    found: [] as (readonly WhyMark[])[],
    notes: notes.map((n): WhyMark[] => (progress?.pinCost && n.startsWith('Your ') ? [[differenceText(progress.pinCost.cost, progress.pinCost.margin, progress.pinCost.verdict === 'close' || progress.pinCost.verdict === 'unclear'), 'edit:pin-cost']] : [])),
    comparisons,
  };
  if (progress)
    why.found = [
      ...progress.proposals.map((p): WhyMark[] => [[differenceText(p.gain, p.margin, p.close, p.turns, p.cleared), `edit:proposal:${proposalId(p)}`]]),
      ...calls.map((c): WhyMark[] => [[differenceText(c.gain, c.margin, true, c.turns, c.cleared), `edit:close:${c.key}`]]),
      ...why.notes,
    ];
  return {
    items: itemPlanReadout(engine, run, plan, r, pins),
    plan,
    text: `Flawless chance: ${chanceWithMargin(r)} · ${ceiling?.chance !== undefined ? `ceiling ${chanceText(ceiling.chance)}` : 'no ceiling yet'}${status}`,
    detail: detail.join(' '),
    rows: r.maps.map((m) => {
      // Its side goals (#191): the share of runs that secure each one chased; and renown's rewards arriving on it.
      const goals = r.sideGoals
        .filter((g) => g.key === m.key)
        .map((g) => `${g.label.slice(g.label.indexOf(': ') + 2)} ${!g.chase ? 'skipped' : g.secured === undefined ? 'chased' : `secured ${chanceText(g.secured)}`}`);
      const rewards = r.renown.stops.find((s) => s.key === m.key)?.rewards ?? [];
      const extra = [...goals, ...(rewards.length ? [`renown: ${listOf(rewards)}`] : [])].map((x) => ` · ${x}`).join('');
      return `${m.label}: ${m.noDeath === undefined ? 'no run gets here with nobody lost' : `${noDeathText(m.noDeath)}${m.gold ? ` · ${goldRange(m.gold)}` : ''}`}${extra}`;
    }),
    // The roadmap and its readings are the adopted plan's (#206): the plan the search started from.
    roadmap: roadmapReadout(engine, run, progress?.start ?? plan, readings, new Map(r.maps.map((m) => [m.key, m.label]))),
    chance: r,
    stress: stressRanges(engine, r.chance, progress?.stress),
    ...(readings ? { readings } : {}),
    found: [...improvements, ...notes],
    notes,
    ...(dies ? { dies } : {}),
    why,
  };
}

/** One item plan row as the Run view writes it (#193), with what its pin select offers. */
export type ItemRowView = {
  readonly source: string;
  readonly item: string;
  readonly text: string;
  /** Its numbers, for the Why panel (#210). */
  readonly marks?: readonly WhyMark[];
  /** The pin it takes (a booster pin for boosters and Boots, a carrier pin for weapons), its unit if pinned, and its map. */
  readonly pin: { readonly kind: ItemPin['kind']; readonly unit: RosterUnit | undefined; readonly key: string } | undefined;
};

export type ItemPlanReadout = { readonly summary: string; readonly rows: readonly ItemRowView[]; readonly tonics: readonly string[] };

const ITEM_IDLE = {
  'outside-model': 'your call, outside the model (it has no movement): pin it to assign them',
  'no-rank': 'no planned use: it counts only where a rank unlocks a weapon on the route or in the kit, and weapon ranks aren’t recorded',
  uncounted: 'not counted',
  'no-gain': 'no planned use: no wishlist unit wins more with it',
} as const;

/**
 * The item plan (#193) as the Run view writes it: one row per held item, owned or expected, with its planned use (a
 * weapon's carrier from each map on), its arrival chance when it arrives only in some runs, and, with no use, why and
 * its sell price; then tonics to buy per map ("Endgame: 6 tonics, 900G").
 */
export function itemPlanReadout(engine: Engine, run: Run, plan: Plan, chance: FlawlessChance | undefined, pins: readonly PlanPin[] = []): ItemPlanReadout {
  const gender = run.roster.run.gender;
  const name = (u: RosterUnit) => unitName(u, gender);
  const steps = engine.mapOrder(run).steps;
  const label = (key: string) => {
    const st = steps.find((x) => x.key === key);
    const m = st && engine.maps().find((x) => x.id === st.map);
    return m ? `${m.label}${st!.secret ? ' (secret route)' : ''}` : key;
  };
  const p = engine.itemPlan(run, plan, { ...(chance ? { chance } : {}), pins });
  const where = (r: ItemPlanRow) => (r.after ? `, ${label(r.after)}` : r.holder ? ` (${name(r.holder)} holds it)` : ' (held)');
  const rows = p.rows.map((r): ItemRowView => {
    const use =
      r.kind === 'weapon'
        ? r.uses.map((u) => `${name(u.unit)} from ${label(u.key)}`).join(', ')
        : r.uses.map((u) => `${name(u.unit)} at ${label(u.key)}`).join(', ');
    const arrives = r.uses.length && r.arrival !== undefined && (r.after || r.arrival < 1) ? ` · arrives in ${chanceText(r.arrival, { miss: 'misses', make: 'arrives' })} of runs` : '';
    const idle = r.idle ? `${r.idle === 'uncounted' ? `${ITEM_IDLE.uncounted} (${r.note})` : ITEM_IDLE[r.idle]}${r.sell && r.idle !== 'outside-model' ? ` · sell: ${goldText(r.sell)}` : ''}` : '';
    const text = `${r.item}${where(r)}: ${use || idle}${r.pinned ? ' (pinned)' : ''}${arrives}`;
    const at = r.uses[0]?.key ?? (r.after ? steps[steps.findIndex((x) => x.key === r.after) + 1]?.key : steps[0]?.key);
    const pinKind = r.kind === 'booster' || r.kind === 'boots' ? 'booster' : r.kind === 'weapon' ? 'carrier' : undefined;
    const pinned = runItemPins(run).find((x) => x.kind === pinKind && x.item === r.item);
    const marks: WhyMark[] = arrives && r.uses[0] ? [[chanceText(r.arrival!, { miss: 'misses', make: 'arrives' }), `item:${r.uses[0].key}:${r.source}`]] : [];
    return { source: r.source, item: r.item, text, marks, pin: pinKind && at ? { kind: pinKind, unit: pinned?.unit, key: pinned?.key ?? at } : undefined };
  });
  const tonics = p.tonics.map((t) => `${label(t.key)}: ${t.count} tonic${t.count === 1 ? '' : 's'}, ${goldText(t.gold)}`);
  const used = p.rows.filter((r) => r.uses.length).length;
  return { summary: `Item plan: ${used} of ${p.rows.length} held items used${p.tonics.length ? `, tonics on ${p.tonics.length} map${p.tonics.length === 1 ? '' : 's'}` : ''}`, rows, tonics };
}

/** The item plan section (#193): its rows with their pin selects, and the tonics to buy per map. */
function itemPlanSection(ctx: HeadlineContext, r: ItemPlanReadout | undefined, plan: Plan | undefined): HTMLElement {
  const gender = ctx.run.roster.run.gender;
  const choices = plan?.wishlist.units.map((u) => u.unit) ?? [];
  const pin = (row: ItemRowView, unit: string) => {
    if (!row.pin) return;
    const u = (unit || row.pin.unit) as RosterUnit;
    const p: ItemPin = row.pin.kind === 'booster' ? { kind: 'booster', item: row.item, unit: u } : { kind: 'carrier', item: row.item, unit: u, key: row.pin.key };
    ctx.setRun(withItemPin(ctx.run, p, !unit));
  };
  return h(
    'details',
    { class: 'banner item-plan' },
    h('summary', {}, h('b', {}, r?.summary ?? 'Item plan: working it out…')),
    ...(r?.rows ?? []).map((row) =>
      h(
        'div',
        { class: 'row small' },
        h('span', {}, ...whyText(row.text, row.marks ?? [])),
        row.pin
          ? h(
              'select',
              { 'aria-label': `${row.item}: ${row.pin.kind === 'booster' ? 'who drinks it' : 'who carries it'}`, onchange: (ev) => pin(row, (ev.target as HTMLSelectElement).value) },
              h('option', { value: '', ...(row.pin.unit ? {} : { selected: 'selected' }) }, 'Plan decides'),
              ...[...new Set([...choices, ...(row.pin.unit ? [row.pin.unit] : [])])].map((u) => h('option', { value: u, ...(row.pin!.unit === u ? { selected: 'selected' } : {}) }, unitName(u, gender))),
            )
          : null,
      ),
    ),
    r?.tonics.length ? h('div', { class: 'small' }, h('b', {}, 'Tonics to buy: '), r.tonics.join(' · ')) : null,
    r ? h('span', { class: 'muted small' }, 'Boosters give +2 (+5 HP) from their map on, never past the cap; tonics +2 for one map, past it; weapons go to their carrier. Each is used in the map’s preparations (the early forced maps have none). A pin keeps your choice; the plan places the rest where they win the wishlist the most.') : null,
  );
}

/** A side goal's decision as the Run view writes it (#191): a pin, or the default rule's reason. */
const DECISION_TEXT = {
  pinned: { chase: 'always take (pinned)', skip: 'always skip (pinned)' },
  planned: { chase: 'chase (the plan’s choice)', skip: 'skip (the plan’s choice)' },
  default: { chase: 'chase (at most one action a turn)', skip: 'skip (more than one action a turn)' },
} as const;

/** The side goals on the map order still to play, each with the plan's decision (#191), for the Run view's pins. */
export function sideGoalPlanReadout(engine: Engine, run: Run, plan?: Plan): readonly { readonly id: SideGoalId; readonly label: string; readonly what: string; readonly pin: SideGoalDecision | undefined; readonly text: string }[] {
  const ahead = new Set(engine.mapOrder(run).steps.map((s) => s.map));
  return engine
    .sideGoals(run, plan)
    .filter((c) => ahead.has(c.goal.map))
    .map((c) => ({ id: c.goal.id, label: c.goal.label, what: c.goal.what, pin: c.pinned ? c.decision : undefined, text: `${c.goal.label}: ${DECISION_TEXT[c.pinned ? 'pinned' : c.planned ? 'planned' : 'default'][c.decision]}` }));
}

/** Side goals ahead, each pinnable to always take or skip (#191). */
function sideGoalsSection(ctx: RunContext): HTMLElement {
  const plan = solveState(ctx.run)?.plan;
  const rows = sideGoalPlanReadout(ctx.engine, ctx.run, plan);
  const chased = ctx.engine.sideGoals(ctx.run, plan).filter((c) => rows.some((r) => r.id === c.goal.id) && c.decision === 'chase').length;
  const pin = (id: SideGoalId, v: string) => ctx.setRun(withSideGoalPin(ctx.run, id, v === 'chase' || v === 'skip' ? v : undefined));
  return h(
    'details',
    { class: 'banner side-goals' },
    h('summary', {}, h('b', {}, 'Side goals'), h('span', { class: 'muted small' }, rows.length ? ` · ${chased} of ${rows.length} chased` : ' · none left on the map order')),
    ...rows.map((r) =>
      h(
        'div',
        { class: 'row small' },
        h('b', { title: r.what }, r.text),
        h(
          'select',
          { 'aria-label': `${r.label}: take or skip`, onchange: (ev) => pin(r.id, (ev.target as HTMLSelectElement).value) },
          ...([['', 'Plan decides'], ['chase', 'Always take'], ['skip', 'Always skip']] as const).map(([v, t]) => h('option', { value: v, ...((r.pin ?? '') === v ? { selected: 'selected' } : {}) }, t)),
        ),
        h('span', { class: 'muted' }, r.what),
      ),
    ),
    h('span', { class: 'muted small' }, 'Chasing costs actions on the map (a Thief killed, a village visited, a chest opened, a villager guarded) by the turn it would be lost; the flawless chance shows the share of runs that secure each one.'),
  );
}

/** The Run view's forecast learning (#196), as the page writes it. */
export type ForecastLearningReadout = {
  /** The learned corrections as a stated assumption, or switched off. */
  readonly assumption: string;
  readonly off: boolean;
  /** Each unit's factor with its evidence and each recorded result's percentile. */
  readonly corrections: readonly string[];
  readonly calibration: string;
  /** The fall log against the no-death forecast (#208); undefined with no map recorded against one. */
  readonly falls: string | undefined;
};

/**
 * The learned EXP corrections and calibration (#196): each unit's factor (as the runs apply it) with the maps, EXP and
 * forecast it was learned from and its recorded results' percentiles; the share of recorded results inside the
 * forecast's 10th–90th percentile and their mean percentile; and the falls against the no-death forecast.
 */
export function forecastLearningReadout(run: Run, touched: readonly { readonly unit: RosterUnit; readonly rules: readonly { readonly label: string }[] }[] = []): ForecastLearningReadout {
  const gender = run.roster.run.gender;
  const off = !!run.corrections?.off;
  const factors = run.corrections?.units ?? {};
  const rows = run.calibration ?? [];
  const p = (x: number) => `p${Math.round(x * 100)}`;
  const corrections = learnCorrections(run).flatMap((c) => {
    const factor = factors[c.unit];
    if (factor === undefined) return [];
    const ps = rows.filter((r) => r.unit === c.unit).map((r) => p(r.percentile));
    // Beyond about ×1.3 or ×0.77 where an open check touches the unit's situation (#209): the check could explain it.
    const checks = touched.find((t) => t.unit === c.unit)?.rules ?? [];
    const named = checks.length ? `; an open check touches this: ${checks.map((r) => r.label).join(', ')}` : '';
    return [`${unitName(c.unit, gender)} ×${factor.toFixed(2)} (${c.maps} map${c.maps === 1 ? '' : 's'}: ${c.earned} EXP against ${c.forecast} forecast${ps.length ? `; recorded at ${ps.join(', ')}` : ''}${named})`];
  });
  const c = calibration(run);
  return {
    assumption: off ? 'Learned EXP corrections, switched off: the forecast reads uncorrected.' : 'Learned EXP corrections, assumed on every map after the last recorded one:',
    off,
    corrections,
    calibration: c.results
      ? `Calibration: ${c.inside} of ${c.results} recorded result${c.results === 1 ? '' : 's'} inside the forecast’s 10th–90th percentile (about 80% if it’s honest); mean percentile ${p(c.meanPercentile!)} (about p50 if unbiased).`
      : 'Calibration: no recorded result against a forecast yet.',
    falls: c.falls.maps ? `Falls: ${c.falls.observed} of ${c.falls.maps} map${c.falls.maps === 1 ? '' : 's'} with a fall or death, against ${c.falls.expected.toFixed(1)} expected by the no-death forecast.` : undefined,
  };
}

/**
 * The forecast learning section (#196): the calibration line and the falls. The learned corrections are stated
 * assumptions: they're listed, with their switch, in the Why panel's Stated assumptions (#211), which this links to.
 */
function forecastLearningSection(ctx: RunContext): HTMLElement {
  const r = forecastLearningReadout(ctx.run);
  return h(
    'details',
    { class: 'banner forecast-learning' },
    h('summary', {}, h('b', {}, 'Forecast learning'), h('span', { class: 'muted small' }, ` · ${r.corrections.length ? `${r.corrections.length} correction${r.corrections.length === 1 ? '' : 's'}${r.off ? ' (off)' : ''}` : 'no corrections'}`)),
    h('div', { class: 'small' }, r.calibration),
    r.falls ? h('div', { class: 'small' }, r.falls) : null,
    h(
      'div',
      { class: 'small muted' },
      'Each recorded map teaches each unit an EXP factor against the forecast kept on its entry (shrunk toward ×1, ×0.5–×2). ',
      h('button', { class: 'linkish', type: 'button', title: 'The learned corrections, with the switch to compare the forecast without them', onclick: () => openAssumptions() }, 'The corrections are in Stated assumptions'),
      '.',
    ),
  );
}

/**
 * Record results' side goals and renown step (#191), as the Run view writes it: each side goal on the entry's map,
 * secured as recorded or pre-filled from what the map gave, and the run's renown after the map with the rewards reached.
 */
export function sideGoalsReadout(engine: Engine, run: Run, entry: string): { readonly goals: readonly { readonly id: SideGoalId; readonly label: string; readonly what: string; readonly secured: boolean; readonly note: string }[]; readonly renown: string } {
  const goals = engine.sideGoalsSecured(run, entry).map((g) => ({
    id: g.goal.id,
    label: g.goal.label,
    what: g.goal.what,
    secured: g.secured,
    note: g.recorded ? 'as you recorded it' : g.found.length ? `pre-filled from the map’s finds: ${listOf(g.found)}` : 'pre-filled: none of its items found',
  }));
  const i = run.entries.findIndex((e) => e.id === entry);
  const before = engine.renown({ ...run, entries: run.entries.slice(0, i) }).now;
  const after = engine.renown({ ...run, entries: run.entries.slice(0, i + 1) }).now;
  const crossed = engine.renownRewards(before, after).map((r) => r.item);
  const renown = run.renown
    ? `Renown after this map: ${after}${crossed.length ? ` (reached: ${listOf(crossed)})` : ''}.`
    : 'Renown isn’t recorded yet: enter the renown this file started with, then the rewards already claimed (asked once for the run).';
  return { goals, renown };
}

/** The side goals and renown step (#191): each goal's secured box, and renown asked once (start, claimed rewards). */
function sideGoalsStep(ctx: RunContext, e: RunEntry): HTMLElement[] {
  const r = sideGoalsReadout(ctx.engine, ctx.run, e.id);
  const rec = ctx.run.renown;
  const set = (start: number, claimed: readonly string[]) => ctx.setRun(withRenown(ctx.run, { start, claimed }));
  const reached = rec ? ctx.engine.renownRewards(-1, ctx.engine.renown(ctx.run).now) : [];
  const editor = [
    h('label', { class: 'small' }, 'Renown when this file started ', input(rec?.start ?? '', (v) => set(Math.max(0, Number(v) || 0), rec?.claimed ?? []), { class: 'num-in', 'aria-label': 'Starting renown' })),
    rec && reached.length
      ? h(
          'div',
          { class: 'row small' },
          'Claimed already: ',
          ...reached.map((x) =>
            h(
              'label',
              {},
              h('input', { type: 'checkbox', checked: rec.claimed.includes(x.item), onchange: (ev) => set(rec.start, (ev.target as HTMLInputElement).checked ? [...rec.claimed, x.item] : rec.claimed.filter((c) => c !== x.item)) }),
              ` ${x.item} (${x.renown})`,
            ),
          ),
        )
      : null,
  ];
  return [
    h('p', { class: 'muted small' }, 'Side goals on this map, pre-filled from what the map gave against the entry before: tick what you secured.'),
    ...(r.goals.length
      ? r.goals.map((g) =>
          h(
            'div',
            { class: 'row' },
            h('label', { title: g.what }, h('input', { type: 'checkbox', checked: g.secured, onchange: (ev) => ctx.setRun(withSideGoalSecured(ctx.run, e.id, g.id, (ev.target as HTMLInputElement).checked, ctx.now())) }), ` ${g.label} secured`),
            h('span', { class: 'muted small' }, g.note),
          ),
        )
      : [h('p', { class: 'muted' }, 'No side goals on this map.')]),
    h('div', { class: 'banner renown' }, h('b', {}, 'Renown'), h('div', { class: 'small' }, r.renown), ...(rec ? [h('details', {}, h('summary', { class: 'small' }, 'Change the recorded renown'), ...editor)] : editor)),
  ];
}

/**
 * Record results' items used step (#193), as the Run view writes it: the items used in the map's preparations as
 * recorded, else pre-filled from the "before this map" list of `plan` (the plan before this entry), each with a tick.
 */
export function itemsUsedReadout(engine: Engine, run: Run, entry: string, plan: Plan | undefined): { readonly note: string; readonly items: readonly (ItemUsed & { readonly used: boolean; readonly text: string })[] } {
  const r = engine.itemsUsed(run, entry, plan);
  const planned = r.recorded ? engine.itemsUsed({ ...run, entries: run.entries.map((e) => (e.id === entry ? { ...e, itemsUsed: undefined } : e)) }, entry, plan).items : [];
  const all = [...r.items, ...planned.filter((p) => !r.items.some((x) => x.item === p.item && x.unit === p.unit))];
  const gender = run.roster.run.gender;
  return {
    note: r.recorded ? 'As you recorded it: tick what was used.' : all.length ? 'Pre-filled from the plan’s “before this map” list: untick what you didn’t use, add what you did.' : 'The plan used no items before this map: add any you used.',
    items: all.map((x) => ({ ...x, used: r.items.includes(x), text: `${x.item} → ${unitName(x.unit, gender)}` })),
  };
}

/** The plans before each entry (#193), by the entry before it: the items used step pre-fills from them. */
const PLANS_BEFORE = new WeakMap<object, Plan>();
const NO_ENTRY = {};

/** The items used step (#193): ticks pre-filled from the plan, and a row to add an item used. */
function itemsUsedStep(ctx: RunContext, e: RunEntry): HTMLElement[] {
  const i = ctx.run.entries.findIndex((x) => x.id === e.id);
  const prev = ctx.run.entries[i - 1] ?? NO_ENTRY;
  let plan = PLANS_BEFORE.get(prev);
  if (!plan) {
    const pins = ctx.pins?.();
    plan = ctx.engine.seedPlan({ ...ctx.run, entries: ctx.run.entries.slice(0, i) }, { ...(pins ? { pins } : {}) });
    PLANS_BEFORE.set(prev, plan);
  }
  const r = itemsUsedReadout(ctx.engine, ctx.run, e.id, plan);
  const set = (items: readonly ItemUsed[]) => ctx.setRun(withItemsUsed(ctx.run, e.id, items, ctx.now()));
  const used = r.items.filter((x) => x.used).map(({ item, unit }) => ({ item, unit }));
  const units = Object.keys(e.snapshot.units) as RosterUnit[];
  let item = '';
  let unit: RosterUnit | '' = '';
  return [
    h('p', { class: 'muted small' }, r.note),
    ...r.items.map((x) =>
      h(
        'label',
        { class: 'row' },
        h('input', { type: 'checkbox', checked: x.used, onchange: (ev) => set((ev.target as HTMLInputElement).checked ? [...used, { item: x.item, unit: x.unit }] : used.filter((u) => !(u.item === x.item && u.unit === x.unit))) }),
        ` ${x.text}`,
      ),
    ),
    h(
      'div',
      { class: 'row small' },
      'Also used: ',
      input('', (v) => (item = v.trim()), { placeholder: 'Energy Drop', 'aria-label': 'Item used' }),
      ' by ',
      h('select', { 'aria-label': 'Used by', onchange: (ev) => (unit = (ev.target as HTMLSelectElement).value as RosterUnit) }, h('option', { value: '' }, '—'), ...units.map((u) => h('option', { value: u }, unitName(u, ctx.run.roster.run.gender)))),
      h('button', { class: 'mini', onclick: () => item && unit && set([...used, { item, unit }]) }, 'Add'),
    ),
    h('span', { class: 'muted small' }, 'Asked rather than read from stat jumps: a +2 over what was expected could be a level-up.'),
  ];
}

/** Gold as the app writes it: 12,500G. */
export const goldText = (g: number) => `${Math.round(g).toLocaleString('en-US')}G`;

/** A gold spread as a range, 10th to 90th percentile (#190): "4,000–6,500G", or one amount when every run agrees. */
export const goldRange = (g: GoldSpread) => (g.low === g.high ? goldText(g.low) : `${Math.round(g.low).toLocaleString('en-US')}–${goldText(g.high)}`);

/** Readouts already worked out, by run: a run is replaced, never edited, so a new run works it out again. */
const READOUTS = new WeakMap<Run, FlawlessReadout>();
/**
 * Whether this visit has run a full solve yet: the first is full (about 30 s), later ones re-solves (about 5 s). Once a
 * map is recorded every solve is a re-solve (#206): recording a map triggers one, and its improvements are proposals.
 */
let solvedOnce = false;
const recorded = (run: Run) => run.entries.some((e) => e.map !== 'other');
/** The run the worker is solving, so a re-render of the same run doesn't restart it. */
let solving: Run | undefined;
/** The section on the page now, for the run it shows: updates land on it, whichever render drew it. */
let live: { run: Run; el: HTMLElement } | undefined;
/** The solve's latest progress, by run (#203: the Wishlist tab reads the same best plan and readings). */
const PROGRESS = new WeakMap<Run, SolveProgress>();

/**
 * Where the solve stands for a run (#203): the plan the page shows (#206: the adopted plan the search started from,
 * never its best so far; the adopted plan or the seed where there's no worker), its progress, whether the worker is
 * still at it (the search, the pin cost, the readings), and the headline's chance and readings.
 * Undefined until the headline has been drawn for the run.
 */
export function solveState(run: Run): { readonly plan: Plan; readonly progress: SolveProgress | undefined; readonly working: boolean; readonly chance: FlawlessChance | undefined; readonly readings: Readings | undefined } | undefined {
  const progress = PROGRESS.get(run);
  const readout = READOUTS.get(run);
  // The adopted plan (#206, as the inbox reads it): the one the search started from, never its best so far.
  const plan = progress?.start ?? progress?.best ?? readout?.plan;
  return plan && { plan, progress, working: solving === run, chance: progress?.chance ?? readout?.chance, readings: progress?.readings ?? readout?.readings };
}

/**
 * The flawless chance (#186) under the map order. The solve's Web Worker (#199) works it out off the page: the
 * headline updates as it improves the best plan, with what it found listed below (a full solve the first time, about
 * 30 s; a re-solve after an edit or a recorded map, about 5 s). Without a worker the page works out the seed plan's. The item plan (#193) reads the same plan and runs.
 */
export function flawlessSection(ctx: HeadlineContext, inInbox = false): HTMLElement {
  const draw = (r: FlawlessReadout | undefined) => {
    // The differences it shows, for the Why panel (#210).
    for (const c of r?.why?.comparisons ?? []) setComparison(c.key, c.comparison, c.plans);
    const marked = (text: string, marks: readonly WhyMark[] | undefined) => whyText(text, marks ?? []);
    const shown = inInbox ? r?.notes : r?.found;
    const shownMarks = inInbox ? r?.why?.notes : r?.why?.found;
    return h(
      'details',
      { ...guide('flawless-headline'), class: 'banner flawless' },
      h(
        'summary',
        {},
        h('b', {}, ...(r ? marked(r.text, r.why?.text) : ['Flawless chance: working it out…'])),
        // No run gets through: where they die leads, in plain sight (not folded away with the detail).
        r?.dies ? h('div', { class: 'small dies' }, ...marked(r.dies.text, r.dies.marks)) : null,
        // The stress-test ranges (#211), each explained in the Why panel; the stated assumptions tab beside them.
        h(
          'span',
          { class: 'small stress-ranges' },
          ...(r?.stress ?? []).flatMap((s, i) => [i ? '; ' : '', ...marked(s.text, [[CHANCE_IN.exec(s.text)?.[0] ?? '', s.id]])]),
          (r?.stress.length ? ' · ' : ''),
          h(
            'button',
            {
              ...guide('stated-assumptions'),
              class: 'linkish',
              type: 'button',
              title: 'Everything the numbers rest on: blind spots, open rules, mismatches, learned corrections and checked rules',
              onclick: (e: Event) => {
                // Inside the summary: open the panel, not the headline.
                e.preventDefault();
                e.stopPropagation();
                openAssumptions();
              },
            },
            'Stated assumptions',
          ),
        ),
      ),
      r?.detail ? h('p', { class: 'muted small' }, r.detail) : null,
      r?.rows.length ? h('ol', { class: 'small' }, ...r.rows.map((x, i) => h('li', {}, ...marked(x, r.why?.rows[i])))) : null,
      r?.roadmap && (r.roadmap.rows.length || r.roadmap.readings.length)
        ? h(
            'details',
            { class: 'roadmap' },
            h('summary', {}, h('b', {}, r.roadmap.title)),
            r.roadmap.readings.length ? h('ul', { class: 'small readings' }, ...r.roadmap.readings.map((x, i) => h('li', {}, ...marked(x, r.roadmap!.marks?.readings[i])))) : null,
            r.roadmap.note ? h('p', { class: 'muted small' }, r.roadmap.note) : null,
            ...r.roadmap.choices.map((x) => h('p', { class: 'small' }, x)),
            h('ol', { class: 'small' }, ...r.roadmap.rows.map((x, i) => h('li', {}, ...marked(x, r.roadmap!.marks?.rows[i])))),
          )
        : null,
      shown?.length ? h('ul', { class: 'small solve-found' }, ...shown.map((x, i) => h('li', {}, ...marked(x, shownMarks?.[i])))) : null,
      r?.items ? itemPlanSection(ctx, r.items, r.plan) : null,
    );
  };
  const run = ctx.run;
  const el = draw(READOUTS.get(run));
  const here = { run, el };
  live = here;
  const show = (r: FlawlessReadout) => {
    READOUTS.set(run, r);
    ctx.onProgress?.();
    if (live !== here || !here.el.isConnected) return;
    const next = draw(r);
    // Keep the panel open across updates.
    if ((here.el as HTMLDetailsElement).open) (next as HTMLDetailsElement).open = true;
    here.el.replaceWith(next);
    here.el = next;
  };
  if (READOUTS.has(run) && solving !== run) return el;
  const pins = ctx.pins?.();
  if (solving !== run && ctx.assumptions) {
    let chance: FlawlessChance | undefined;
    let last: SolveProgress | undefined;
    // The search starts from the adopted plan (#204), else the seed. With a loss open, the loss item's re-solve follows
    // it; after a recorded map, What it cost comes after the readings (#208).
    const adopted = adoptedOf(run);
    const loss = openLosses(run, adopted).length > 0;
    const entry = latestEntry(run);
    const cost = !!entry && entry.map !== 'other' && run.entries.length > 1 && !(run.dismissedChanges ?? []).includes(entry.id);
    const started = startSolve(
      {
        kind: 'solve',
        assumptions: ctx.assumptions,
        run,
        seed: FLAWLESS_SEED,
        budget: STEP_BUDGET,
        seconds: solvedOnce || recorded(run) ? SOLVE_SECONDS.resolve : SOLVE_SECONDS.full,
        ...(adopted ? { plan: adopted } : {}),
        ...(pins ? { pins } : {}),
        ...(loss ? { loss } : {}),
        ...(cost ? { cost } : {}),
      },
      (reply) => {
        if (reply.done && solving === run) {
          solving = undefined;
          // The worker is free: the stress tests (#211) may start.
          setTimeout(() => {
            askStress(ctx, run, (p) => show(solvedReadout(ctx.engine, run, p, pins)));
          }, 0);
        }
        // The loss's re-solve (#208), the pin cost (#200), the readings (#197) and What it cost (#208) come once the
        // search is done, while the worker is idle.
        if (reply.kind === 'pin-cost' || reply.kind === 'readings' || reply.kind === 'loss' || reply.kind === 'what-it-cost') {
          if (!last) return void ctx.onProgress?.();
          last =
            reply.kind === 'pin-cost'
              ? { ...last, pinCost: reply.cost }
              : reply.kind === 'loss'
                ? { ...last, loss: { plan: reply.plan, chance: reply.chance, margin: reply.margin } }
                : reply.kind === 'what-it-cost'
                  ? { ...last, cost: { value: reply.cost } }
                  : { ...last, ...(reply.readings ? { readings: reply.readings } : {}) };
          PROGRESS.set(run, last);
          inboxProgress(run, last);
          show(solvedReadout(ctx.engine, run, last, pins));
          return;
        }
        if (reply.kind !== 'step') return;
        const s = reply.step;
        chance = s.chance ?? chance;
        if (!chance) return;
        const start = s.cursor.search?.start ?? last?.start;
        last = { ...(last?.readings && last.best === s.best ? { readings: last.readings } : {}), ...(last?.loss ? { loss: last.loss } : {}), ...(last?.cost ? { cost: last.cost } : {}), best: s.best, ...(start ? { start } : {}), chance, ...(reply.ceiling ? { ceiling: reply.ceiling } : {}), proposals: s.proposals, closeCalls: s.closeCalls, pruned: s.pruned, done: reply.searched, converged: s.converged };
        PROGRESS.set(run, last);
        inboxProgress(run, last);
        show(solvedReadout(ctx.engine, run, last, pins));
      },
    );
    if (started) {
      solvedOnce = true;
      solving = run;
      return el;
    }
  }
  if (solving === run) return el;
  setTimeout(() => {
    if (!here.el.isConnected) return;
    show(READOUTS.get(run) ?? flawlessReadout(ctx.engine, run, { ...(pins ? { pins } : {}) }));
  }, 0);
  return el;
}

/**
 * The stress tests (#211), once the headline's search is done: the best plan re-run under each stressed blind spot the
 * headline rests on, in their own worker, on the headline's seed and runs (so each pairs with it); each range lands on
 * the run's progress as it comes in.
 */
function askStress(ctx: HeadlineContext, run: Run, shown: (p: SolveProgress) => void): void {
  const p = PROGRESS.get(run);
  if (!p || !ctx.assumptions || p.stress) return;
  const cases = ctx.engine
    .stressTests()
    .filter((t) => p.chance.blindSpots.includes(t.blindSpot))
    .map((t) => t.id);
  if (!cases.length) return;
  const best = p.best;
  startSolve(
    { kind: 'stress', assumptions: ctx.assumptions, run, plan: best, seed: rescoreSeed(FLAWLESS_SEED), runs: p.chance.runs, cases },
    (reply) => {
      const now = PROGRESS.get(run);
      if (reply.kind !== 'stress' || !now || now.best !== best) return;
      const next = { ...now, stress: { ...now.stress, [reply.stress]: reply.chance } };
      PROGRESS.set(run, next);
      inboxProgress(run, next);
      shown(next);
    },
    'stress',
  );
}

export { robinName };

export type RobinReadout = {
  readonly title: string;
  readonly status: string;
  /** Each solved Robin, the reference first, and whether it can be locked from here. */
  readonly solved: readonly { readonly key: string; readonly robin: PlanRobin; readonly plan: Plan; readonly text: string; readonly lock: boolean }[];
  /** The options not solved: seed and ceiling, and whether a solve can be asked for. */
  readonly rest: readonly { readonly key: string; readonly text: string; readonly solve: boolean }[];
  /** Once locked: what the lock cost. */
  readonly lock?: string;
  /** Every solved Robin at 0% (#242): they're ranked by how far runs get, and whether more solves could change the pick. */
  readonly atZero?: string;
  /** The no-Robin view, when toggled on. */
  readonly noRobin?: string;
  /** The numbers in its lines (#210): each solved Robin's cost (by its key), the lock's, the no-Robin view's. */
  readonly marks?: { readonly solved: Readonly<Record<string, readonly WhyMark[]>>; readonly lock: readonly WhyMark[]; readonly noRobin: readonly WhyMark[]; readonly comparisons: readonly WhyComparison[] };
};

/** A solved Robin's cost against the reference, with how far runs get when both are at 0% (#242). */
const robinCostText = (c: RobinCost): string => differenceText(c.gain, c.margin, c.verdict === 'close', undefined, c.cleared);

/**
 * With every solved Robin at 0% (#242): what ranks them, and whether solving more could change the pick. Only an
 * unsolved Robin whose ceiling is above 0% could get a run through; how far an unsolved Robin's runs get has no bound.
 */
function atZeroText(z: NonNullable<RobinStep['atZero']>): string {
  const lead = 'Every Robin solved reads 0%, so they’re ranked by how far runs get: the maps cleared with nobody lost.';
  const { unsolved, couldGetThrough: could } = z;
  if (!unsolved) return lead;
  const bound = 'which no ceiling bounds';
  if (!could) return `${lead} None of the ${unsolved} not solved has a ceiling above 0%: more solves can’t find a Robin that gets a run through, only change the ranking on how far runs get, ${bound}.`;
  const one = could === 1;
  const up = `${could === unsolved ? `All ${unsolved}` : `${could} of the ${unsolved}`} not solved ${one ? 'has' : 'have'} a ceiling above 0% (or none read yet): solving ${one ? 'it' : 'them'} could find a Robin that gets a run through.`;
  const rest = unsolved - could;
  return `${lead} ${up}${rest ? ` Solving the other ${rest} could only change the ranking on how far runs get, ${bound}.` : ''}`;
}

const PICKS = { gender: (r: PlanRobin) => ` (the best ${r.gender === 'M' ? 'Male' : 'Female'} Robin)`, ceiling: () => ' (its ceiling could beat the best)', requested: () => ' (asked)', locked: () => '' } as const;

/**
 * The Robin alternatives (#201), as the Run view writes them: each solved Robin's whole-wishlist chance with its cost
 * against the best (or, once locked, the locked Robin) on the same runs and how its wishlist differs; every other
 * option with its seed's spouse and ceiling and a solve button; once locked, what the lock cost; the no-Robin view.
 */
export function robinReadout(engine: Engine, run: Run, step: RobinStep | undefined, noRobin: boolean): RobinReadout {
  const locked = robinLock(run)?.robin;
  const title = locked ? `Robin: locked, ${robinName(locked)}` : `Robin: open${step ? ` · ${step.solved.length} of ${step.options.length} solved` : ''}`;
  if (!step) return { title, status: 'Compare every Robin option by what it does to the whole wishlist.', solved: [], rest: [], ...(noRobin ? { noRobin: 'No-Robin view: working it out…' } : {}) };
  const who = (u: RosterUnit, r: PlanRobin) => unitName(u, u === 'robin' ? null : r.gender);
  const married = (r: PlanRobin, spouse: RosterUnit | null) => `${robinName(r)}${spouse ? `, marrying ${who(spouse, r)}` : ''}`;
  const against = locked ? 'the locked Robin' : 'the best';
  const couple = (c: readonly [RosterUnit, RosterUnit], r: PlanRobin) => `${who(c[0], r)} × ${who(c[1], r)}`;
  const solved = step.solved.map((s) => {
    const d = s.differences;
    const r = s.robin;
    const parts = [
      d.marriages.added.length || d.marriages.removed.length ? `marries ${listOf(d.marriages.added.map((c) => couple(c, r))) || 'no one new'}${d.marriages.removed.length ? ` (not ${listOf(d.marriages.removed.map((c) => couple(c, r)))})` : ''}` : '',
      d.units.added.length || d.units.removed.length ? `fields ${listOf(d.units.added.map((u) => who(u, r))) || 'no one new'}${d.units.removed.length ? ` (not ${listOf(d.units.removed.map((u) => who(u, r)))})` : ''}` : '',
      ...d.classes.map((c) => `${who(c.unit, r)} as ${engine.className(c.to, r.gender)} (not ${engine.className(c.from, r.gender)})`),
    ].filter(Boolean);
    const spouse = s.plan.wishlist.marriages.find((c) => c.includes('robin'))?.find((u) => u !== 'robin') ?? null;
    const cost = s.cost ? ` · ${robinCostText(s.cost)} against ${against} · ${parts.length ? parts.join('; ') : 'the same wishlist'}` : s.key === step.reference ? ` · ${locked ? 'locked' : 'the best'}` : '';
    // At 0% (#242), how far its runs get: what ranks the Robins there.
    const far = step.atZero && s.cleared !== undefined ? `, runs clear ${s.cleared.toFixed(1)} maps` : '';
    return { key: s.key, robin: r, plan: s.plan, text: `${married(r, spouse)}: ${chanceWithMargin(s)}${far}${cost}${PICKS[s.pick](r)}`, lock: !locked };
  });
  const rest = step.options
    .filter((o) => o.status !== 'solved')
    .map((o) => ({
      key: o.key,
      text: `${married(o.robin, o.spouse)}: ${!o.screened ? 'not screened yet' : o.ceiling === undefined ? 'no ceiling' : `ceiling ${chanceText(o.ceiling)}`}${o.status === 'solving' ? ' · solving…' : o.status === 'queued' ? ' · queued' : ''}`,
      solve: o.status === 'open',
    }));
  const screened = step.options.filter((o) => o.screened).length;
  // The differences, for the Why panel (#210): each against the reference's plan on the same runs.
  const refPlan = step.solved.find((s) => s.key === step.reference)?.plan;
  const comparisons: WhyComparison[] = [];
  const solvedMarks: Record<string, WhyMark[]> = {};
  for (const s of step.solved) {
    if (!s.cost) continue;
    const close = s.cost.verdict === 'close';
    comparisons.push({ key: `robin:${s.key}`, comparison: { kind: 'robin', label: `Robin: ${robinName(s.robin)}`, gain: s.cost.gain, margin: s.cost.margin, runs: s.cost.runs, close }, ...(refPlan ? { plans: { other: s.plan, base: refPlan } } : {}) });
    solvedMarks[s.key] = [[robinCostText(s.cost), `edit:robin:${s.key}`]];
  }
  const lc = locked ? step.lockCost : undefined;
  if (lc) comparisons.push({ key: 'robin-lock', comparison: { kind: 'robin', label: 'What this lock cost', gain: lc.gain, margin: lc.margin, runs: lc.runs } });
  const nrc = noRobin ? step.noRobin : undefined;
  if (nrc) comparisons.push({ key: 'no-robin', comparison: { kind: 'robin', label: 'The no-Robin view', gain: nrc.cost.gain, margin: nrc.cost.margin, runs: nrc.cost.runs, close: nrc.cost.verdict === 'close' }, ...(refPlan ? { plans: { other: nrc.plan, base: refPlan } } : {}) });
  const lock = locked
    ? step.lockCost
      ? `What this lock cost: ${differenceText(step.lockCost.gain, step.lockCost.margin)} (${robinName(step.solved.find((s) => s.key === step.lockCost!.key)!.robin)} does better)`
      : 'What this lock cost: nothing measurable, among the Robins solved'
    : undefined;
  const nr = step.noRobin;
  const noRobinText = !noRobin
    ? undefined
    : nr
      ? `No-Robin view (Robin no one’s parent: no Morgan${nr.spouse ? `, ${unitName(nr.spouse, nr.plan.robin.gender)} unmarried` : ''}): ${chanceWithMargin(nr)}, ${differenceText(nr.cost.gain, nr.cost.margin, nr.cost.verdict === 'close')} against ${against}: what Robin’s marriage is worth`
      : step.converged && step.reference && !step.solved.find((s) => s.key === step.reference)?.plan.wishlist.marriages.some((c) => c.includes('robin'))
        ? 'No-Robin view: Robin marries no one in the best plan, so Robin is no one’s parent already'
        : 'No-Robin view: working it out…';
  return {
    title,
    marks: {
      solved: solvedMarks,
      lock: lc ? [[differenceText(lc.gain, lc.margin), 'edit:robin-lock']] : [],
      noRobin: nrc ? [[differenceText(nrc.cost.gain, nrc.cost.margin, nrc.cost.verdict === 'close'), 'edit:no-robin']] : [],
      comparisons,
    },
    status: step.converged
      ? `${screened} of ${step.options.length} options screened by their seed and ceiling`
      : screened < step.options.length
        ? `Screening ${screened} of ${step.options.length} options by their seed and ceiling…`
        : `${screened} of ${step.options.length} options screened · solving the picks (${step.solved.length} solved)…`,
    solved,
    rest,
    ...(lock ? { lock } : {}),
    ...(step.atZero ? { atZero: atZeroText(step.atZero) } : {}),
    ...(noRobinText ? { noRobin: noRobinText } : {}),
  };
}

/**
 * The Robin alternatives' state on the page (#201): the worker's latest step and cursor, the solves asked for, and the
 * no-Robin toggle, for one run as the alternatives read it (its log, route and pins, the Robin Lock aside): locking
 * keeps them, recording a map starts them again.
 */
let robinState: { key: string; step?: RobinStep; cursor?: RobinCursor; asked: string[]; noRobin: boolean; running: boolean } | undefined;
/**
 * The Robin section's Compare button: its words, and whether it's disabled (comparing, or done). The comparison runs in
 * its own worker (the 'robin' slot), so it starts on the click, never waiting behind the headline's search.
 */
export function robinButton(s: { readonly running: boolean; readonly step?: Pick<RobinStep, 'converged'> }): { text: string; disabled: boolean } {
  const text = s.running ? 'Comparing…' : s.step ? 'Carry on' : 'Compare Robins';
  return { text, disabled: s.running || !!s.step?.converged };
}
/** The Robin section on the page now, and how to draw it again: the worker's replies land on it, whichever render drew it. */
let robinView: { el: HTMLElement; draw: () => HTMLElement } | undefined;
const redraw = () => {
  const v = robinView;
  if (!v?.el.isConnected) return;
  const next = v.draw();
  // Unchanged: kept, so a click across a reply isn't lost.
  if (next.isEqualNode(v.el)) return;
  v.el.replaceWith(next);
  v.el = next;
};

/**
 * The Robin search's best so far for this run (#241 runthrough): its reference solved Robin and wishlist, while no
 * Robin is locked. "Lock Robin and start" offers it before the player has chosen.
 */
export function robinSearchBest(run: Run): RobinBest | undefined {
  const step = robinState?.key === robinStateKey(run) ? robinState.step : undefined;
  if (!step || step.locked || robinLock(run)) return undefined;
  const best = step.solved.find((s) => s.key === step.reference);
  return best && { robin: best.robin, plan: best.plan };
}

const robinStateKey = (run: Run) => {
  const lock = robinLock(run);
  const facts = { ...run.roster.run, ...Object.fromEntries((lock?.open ?? []).map((f) => [f, null])) };
  return JSON.stringify([facts, run.entries.map((e) => e.id), (run.pins ?? []).filter((p) => p.kind !== 'robin-lock'), run.sideGoals ?? {}]);
};

/**
 * The Robin section (#201): the alternatives worked out by their own Web Worker (beside the headline's search),
 * a solve button per option, Lock Robin, and the no-Robin toggle. In the inbox before the Lock (#204) it's the Robin
 * card, the first decision: the alternatives start on their own, and each solved Robin is chosen (its whole wishlist
 * adopted) rather than locked; "Lock Robin and start" is the inbox's last card.
 */
function robinSection(ctx: RunContext, inInbox = false): HTMLElement | null {
  const { run } = ctx;
  if (!ctx.assumptions || !nextMaps(run).length) return null;
  const key = robinStateKey(run);
  if (robinState?.key !== key) robinState = { key, asked: [], noRobin: false, running: false };
  const state = robinState;
  const pins = ctx.pins?.();
  const start = () => {
    if (!ctx.assumptions || state !== robinState) return;
    const started = startSolve(
      {
        kind: 'robin',
        assumptions: ctx.assumptions,
        run,
        seed: FLAWLESS_SEED,
        budget: STEP_BUDGET,
        seconds: SOLVE_SECONDS.full * 4,
        ...(state.cursor ? { cursor: state.cursor } : {}),
        ...(state.asked.length ? { solve: state.asked } : {}),
        ...(state.noRobin ? { noRobin: true } : {}),
        ...(pins ? { pins } : {}),
      },
      (reply) => {
        if (reply.kind !== 'robin' || state !== robinState) return;
        state.step = reply.step;
        state.cursor = reply.step.cursor;
        if (reply.done) state.running = false;
        redraw();
        inboxRobinMoved();
      },
      'robin',
    );
    state.running = !!started;
    redraw();
  };
  const ask = start;
  const draw = () => {
    const r = robinReadout(ctx.engine, run, state.step, state.noRobin);
    for (const c of r.marks?.comparisons ?? []) setComparison(c.key, c.comparison, c.plans);
    const locked = robinLock(run);
    // The Robin the Lock takes: yours once chosen, else the search's best (#241 runthrough), never an unchosen default.
    const offer = lockOffer(run, solveState(run)?.progress, robinSearchBest(run));
    const chosen = offer.from === 'default' ? undefined : offer.robin;
    const button = robinButton({ running: state.running, ...(state.step ? { step: state.step } : {}) });
    return h(
      'details',
      // Kept open or closed across redraws; in the inbox it starts open (Robin is the first decision).
      { ...guide('robin-card'), class: 'banner robin', ...((robinView?.el.isConnected ? robinView.el.hasAttribute('open') : inInbox) ? { open: 'open' } : {}) },
      h('summary', {}, h('b', {}, r.title)),
      h(
        'div',
        { class: 'row small' },
        h('span', { class: 'muted' }, r.status),
        h('button', { class: 'mini', title: 'Work out the Robin alternatives in the background, beside the headline’s search', disabled: button.disabled, onclick: ask }, button.text),
        locked ? h('button', { class: 'mini ghost', title: 'Unlock Robin: every option is solved again', onclick: () => ctx.setRun(withoutPins(run, [locked])) }, 'Unlock') : null,
      ),
      r.lock ? h('p', { class: 'small' }, h('b', {}, ...whyText(r.lock, r.marks?.lock ?? []))) : null,
      r.atZero ? h('p', { class: 'small' }, r.atZero) : null,
      r.solved.length
        ? h(
            'ul',
            { class: 'small' },
            ...r.solved.map((x) =>
              h(
                'li',
                {},
                ...whyText(x.text, r.marks?.solved[x.key] ?? []),
                !inInbox
                  ? x.lock
                    ? h('button', { class: 'mini', title: 'Lock this Robin into the run facts and start: only Robin is locked, the rest stays editable', onclick: () => ctx.setRun(withRobinLock(run, x.robin)) }, 'Lock Robin and start')
                    : null
                  : robinKeyOf(x.robin) === robinKeyOf(chosen) && offer.from !== 'search'
                    ? h('span', { class: 'chip small' }, 'your Robin')
                    : h(
                        'span',
                        {},
                        robinKeyOf(x.robin) === robinKeyOf(chosen) ? h('span', { class: 'chip small', title: 'Nothing chosen yet: Lock Robin and start takes the search’s best' }, 'the Lock takes this') : null,
                        h('button', { class: 'mini', title: 'Take this Robin and its whole wishlist as your plan (lock it with the last card)', onclick: () => ctx.setRun(withEdit(run, { label: `Robin: ${robinName(x.robin)}`, plan: x.plan, accepted: true })) }, 'Choose'),
                      ),
              ),
            ),
          )
        : null,
      r.rest.length
        ? h(
            'details',
            {},
            h('summary', { class: 'small' }, `${r.rest.length} more Robin${r.rest.length === 1 ? '' : 's'}: seed and ceiling`),
            h(
              'ul',
              { class: 'small' },
              ...r.rest.map((x) =>
                h('li', {}, x.text, x.solve ? h('button', { class: 'mini', onclick: () => (state.asked = [...new Set([...state.asked, x.key])], ask()) }, 'Solve') : null),
              ),
            ),
          )
        : null,
      h(
        'label',
        { class: 'small', title: 'The best plan with Robin no one’s parent (no Morgan): how much Robin’s marriage is worth' },
        h('input', { type: 'checkbox', checked: state.noRobin, onchange: (e) => ((state.noRobin = (e.target as HTMLInputElement).checked), state.noRobin && state.step ? ask() : redraw()) }),
        ' No-Robin view',
      ),
      r.noRobin ? h('p', { class: 'small' }, ...whyText(r.noRobin, r.marks?.noRobin ?? [])) : null,
    );
  };
  // In the inbox, Robin is the first decision: the alternatives start on their own, in their own worker.
  if (inInbox && !state.step && !state.running) ask();
  const el = draw();
  robinView = { el, draw };
  // After a Lock the alternatives are read again (the locked Robin solved), once the worker is free.
  if (state.step && !state.running && robinKeyOf(state.step.locked) !== robinKeyOf(robinLock(run)?.robin)) ask();
  return el;
}

const robinKeyOf = (r: PlanRobin | undefined) => (r ? `${r.gender}-${r.asset}-${r.flaw}` : '');

function mapOrderSection(ctx: RunContext): HTMLElement {
  const { title, rows } = mapOrderReadout(ctx.engine, ctx.run);
  return h(
    'details',
    { class: 'banner map-order' },
    h('summary', {}, h('b', {}, title), h('span', { class: 'muted small' }, ` · ${rows.length} maps to go`)),
    rows.length
      ? h('ol', { class: 'small' }, ...rows.map((r) => h('li', {}, r)))
      : h('span', { class: 'muted' }, 'The endpoint is recorded: nothing left on the map order.'),
    h('span', { class: 'muted small' }, 'Child paralogues sit where the route puts them for now: the plan chooses whether and where to play each.'),
  );
}

/**
 * Where a child recruit's stats came from (#155), or which parent kept them blank: its parents in the entry before the
 * map. Null for anyone who isn't a child.
 */
export function childStatsNote(run: Run, e: RunEntry, u: RosterUnit, assumptions?: Assumptions): string | null {
  if (!(u in CHILD_UNITS)) return null;
  const i = run.entries.findIndex((x) => x.id === e.id);
  const j = childJoinFrom(run, run.entries[i - 1]?.snapshot ?? EMPTY_SNAPSHOT, u as ChildId, assumptions);
  const name = (x: RosterUnit | 'maiden') => (x === 'maiden' ? 'the Maiden' : unitName(x, run.roster.run.gender));
  const child = name(u);
  if (j.unmarried) return `${child}: ${name(j.unmarried)} isn’t married in the entry before this map, so ${child}’s stats are blank: record them from the game.`;
  if (j.missing.length) {
    const who = j.missing.map(name).join(' and ');
    return `${child}: ${who}’s stats aren’t logged in the entry before this map, so ${child}’s stats are blank: record them from the game.`;
  }
  if (!j.join || !j.parents) return null;
  const maiden = j.parents[1] === 'maiden' ? ' (the Maiden’s side is an assumption)' : '';
  return `${child}: worked out from ${j.parents.map(name).join(' and ')} as they were on entering this map${maiden}.`;
}

/**
 * Record results (#118): the entry is already a copy of the last, so every step only records changes: deployed units,
 * the map's recruits (pre-filled), deaths and marriages, convoy and gold at the map's end, shopping (#192), then side
 * goals secured (pre-filled from the map's finds) and renown, asked once for the run (#191), then the items used in the
 * map's preparations (pre-filled from the plan's "before this map" list, #193).
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
        return [h('p', { class: 'muted small' }, 'Update who levelled, promoted or reclassed. Leave the rest: it’s copied from last time.'), unitTable(ctx, e, veterans, true), classChanges(ctx, e)];
      case 1: {
        const notes = recruits.map((u) => childStatsNote(ctx.run, e, u, ctx.assumptions)).filter((n): n is string => n !== null);
        return recruits.length
          ? [
              h('p', { class: 'muted small' }, 'Filled in from their join data; a child’s stats from its parents as they were on entering this map.'),
              ...notes.map((n) => h('p', { class: 'small' }, n)),
              unitTable(ctx, e, recruits.filter((u) => e.snapshot.states[u] !== 'missed')),
              missedRow(ctx, e, recruits),
            ]
          : [h('p', { class: 'muted' }, 'No one joined on this map.')];
      }
      case 2:
        return [
          h(
            'p',
            { class: 'muted small' },
            casual
              ? 'Casual: a unit that falls comes back after the map with its place in the plan, so it isn’t a loss. Record it anyway: the fall is logged to check the forecast, and What changed prices the rest of the map it missed.'
              : 'Classic: a unit that falls is dead for good. The inbox then offers a re-solve for the army that’s left.',
          ),
          h(
            'div',
            { class: 'row' },
            ...all
              .filter((u) => roster.states[u] !== 'dead' && roster.states[u] !== 'missed' && !GAME_OVER_UNITS.includes(u) && !e.fell?.includes(u))
              .map((u) => h('button', { class: 'mini', title: casual ? `${name(u)} fell (and came back after the map)` : `${name(u)} fell: dead for good`, onclick: () => ctx.setRun(recordFallen(ctx.run, e.id, u, ctx.now())) }, `✝ ${name(u)}`)),
          ),
          h('p', { class: 'muted small' }, 'Chrom or Robin falling is a Game Over: reload your save and play the map again; there’s nothing to record.'),
          lossesHere(ctx, e),
          chromWeddingRow(ctx, e),
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
            'Marriages recorded here: ',
            Object.entries(e.snapshot.spouses)
              .filter(([u, sp]) => sp?.bond === 'married' && ctx.run.entries[i - 1]?.snapshot.spouses[u as RosterUnit]?.bond !== 'married')
              .map(([u, sp]) => `${name(u as RosterUnit)} × ${name(sp!.partner)}`)
              .join(', ') || 'none yet',
          ),
        ];
      case 3:
        return [h('p', { class: 'muted small' }, 'Gold and items as the map ended, before any shopping.'), goldAndConvoy(ctx, e), problems(e.snapshot)];
      case 4:
        return [shoppingSection(ctx, e)];
      case 5:
        return sideGoalsStep(ctx, e);
      case 6:
        return itemsUsedStep(ctx, e);
      default:
        return checksStep({ engine: ctx.engine, run: ctx.run, rules: currentRules(), setRules: ctx.setRules ?? (() => undefined), setRun: ctx.setRun, evidence: { ...ruleEvidence(ctx.run), map: e.map }, now: ctx.now }, e);
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
        ? // The map's end teaches the forecast (#196): corrections and calibration relearned from the log.
          h('button', { onclick: () => (ctx.setRun(withLearned(ctx.run)), ctx.setRecording(undefined), ctx.setOpenEntry(undefined)) }, 'Done')
        : h('button', { onclick: () => ctx.setRecording({ entry: e.id, step: step + 1 }) }, 'Next →'),
      h('span', { class: 'muted small' }, 'Anything you skip keeps its copied value.'),
    ),
  );
}

/**
 * The falls, deaths and misses recorded on an entry (#208), as Record results lists them: "Frederick died", "Frederick
 * fell (Casual: logged)", "Missed Kjelle", each with an undo for a mistake.
 */
export function lossesRecorded(run: Run, e: RunEntry): readonly { readonly unit: RosterUnit; readonly text: string }[] {
  const i = run.entries.findIndex((x) => x.id === e.id);
  const before = run.entries[i - 1]?.snapshot.states ?? {};
  const name = (u: RosterUnit) => unitName(u, run.roster.run.gender);
  return [
    ...(Object.entries(e.snapshot.states) as [RosterUnit, string][]).flatMap(([u, st]) =>
      before[u] === st ? [] : st === 'dead' ? [{ unit: u, text: `${name(u)} died` }] : st === 'missed' ? [{ unit: u, text: `Missed ${name(u)}` }] : [],
    ),
    ...(e.fell ?? []).map((u) => ({ unit: u, text: `${name(u)} fell (Casual: back after the map, logged)` })),
  ];
}

function lossesHere(ctx: RunContext, e: RunEntry): HTMLElement {
  const rows = lossesRecorded(ctx.run, e);
  return h(
    'div',
    { class: 'small' },
    'Recorded here: ',
    ...(rows.length
      ? rows.map((r) => h('span', { class: 'chip small' }, r.text, ' ', h('button', { class: 'mini ghost', title: 'A mistake: undo it', onclick: () => ctx.setRun(unrecordLoss(ctx.run, e.id, r.unit, ctx.now())) }, 'Undo')))
      : ['nothing yet']),
  );
}

/** A recruit on the map that wasn't recruited (#208): Missed, a loss like a death. */
function missedRow(ctx: RunContext, e: RunEntry, recruits: readonly RosterUnit[]): HTMLElement {
  const name = (u: RosterUnit) => unitName(u, ctx.run.roster.run.gender);
  const open = recruits.filter((u) => !GAME_OVER_UNITS.includes(u) && e.snapshot.states[u] !== 'missed' && e.snapshot.states[u] !== 'dead');
  const missed = recruits.filter((u) => e.snapshot.states[u] === 'missed');
  return h(
    'div',
    { class: 'row small' },
    open.length ? 'Not recruited? ' : null,
    ...open.map((u) => h('button', { class: 'mini', title: `${name(u)} wasn’t recruited: missed for good, a loss like a death`, onclick: () => ctx.setRun(recordMissed(ctx.run, e.id, u, ctx.now())) }, `Missed ${name(u)}`)),
    ...missed.map((u) => h('span', { class: 'chip small' }, `Missed ${name(u)} `, h('button', { class: 'mini ghost', title: 'A mistake: undo it', onclick: () => ctx.setRun(unrecordLoss(ctx.run, e.id, u, ctx.now())) }, 'Undo'))),
  );
}

/**
 * Chapter 11 with Chrom unmarried (#154): the game married him at the map's end, so ask to whom. The candidates not
 * married to someone else and the Maiden are offered; one is pre-selected only when his logged ranks decide it.
 */
function chromWeddingRow(ctx: RunContext, e: RunEntry): HTMLElement | null {
  const ask = chromWedding(ctx.run, e.id, ctx.assumptions?.['chrom-wedding-lost-candidate']);
  if (!ask) return null;
  const name = (u: RosterUnit) => unitName(u, ctx.run.roster.run.gender);
  let wife: RosterUnit | '' = ask.preselect ?? '';
  return h(
    'div',
    { class: 'banner' },
    h('b', {}, 'The game married Chrom at the end of Chapter 11'),
    h(
      'div',
      { class: 'row' },
      'Chrom × ',
      h(
        'select',
        { 'aria-label': 'Chrom’s wife', onchange: (ev) => (wife = (ev.target as HTMLSelectElement).value as RosterUnit) },
        h('option', { value: '', selected: !ask.preselect }, '—'),
        ...ask.options.map((u) => h('option', { value: u, selected: u === ask.preselect }, name(u))),
      ),
      h('button', { class: 'mini', onclick: () => wife && ctx.setRun(recordMarriage(ctx.run, e.id, 'chrom', wife, ctx.now())) }, 'Record marriage'),
    ),
    h(
      'span',
      { class: 'muted small' },
      ask.preselect === 'maiden'
        ? 'Every candidate is married to someone else, so he marries the Maiden.'
        : ask.preselect
        ? 'He marries the candidate he has the highest viewed support rank with; his logged ranks point to this one.'
        : 'He marries the candidate he has the highest viewed support rank with; with no rank to decide it, the game goes by support points the app can’t see (Olivia wins from 2 points with him if nobody else has a C, and it’s the Maiden if he has almost none with any): pick who he married.',
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
            const input = e.target as HTMLInputElement;
            const f = input.files?.[0];
            input.value = '';
            if (!f || !confirm('Replace this run with the file’s? Export first to keep it.')) return;
            try {
              ctx.setRun(importRun(await f.text()));
            } catch {
              alert(`${f.name} isn’t a run file.`);
            }
          },
        }),
      ),
    ),
    migrationNoteSection(ctx),
    // The top is the inbox, headline first, above Next map: before the Lock (#204) with Robin as the first decision;
    // after it (#206) titled "Before <map>", What changed above it, and Robin (what the lock cost) below Next map.
    ...(beforeTheLock(run) ? [inboxView(ctx, flawlessSection(ctx, true), robinSection(ctx, true)), nextMapSection(ctx)] : [inboxView(ctx, flawlessSection(ctx, true), null), nextMapSection(ctx), robinSection(ctx)]),
    sideGoalsSection(ctx),
    forecastLearningSection(ctx),
    mapOrderSection(ctx),
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
              if (waitsForRobin(ctx.run, pick)) return void alert('Lock Robin first (or set Robin in Run facts): this map recruits Robin.');
              const label = pick === 'other' ? (prompt('What did you play?') ?? 'Other') : undefined;
              const next = withMapRecorded(ctx, pick, label);
              ctx.setRun(next);
              ctx.setOpenEntry(next.entries[next.entries.length - 1]!.id);
            },
          },
          'Add entry',
        ),
      ),
      h('span', { class: 'muted small' }, 'A new entry starts as a copy of the last; the map’s recruits are filled in from their join data, a child’s from its parents.'),
    ),
    ...newest.map((e, i) => entryBlock(ctx, e, i === 0, flagged.has(e.id))),
  );
}

/**
 * The one-time migration note (#205), as the Run view shows it until dismissed: what of the old plan was kept as pins
 * and what was dropped, and a keep-in pin to take for each child the former priorities rated high (those already kept
 * in or out left off). Undefined when there's no note.
 */
export function migrationNoteReadout(run: Run): { readonly kept: readonly string[]; readonly dropped: readonly string[]; readonly keepIn: readonly { readonly unit: RosterUnit; readonly text: string }[] } | undefined {
  const note = run.migration;
  if (!note) return undefined;
  const kept = new Set((run.pins ?? []).flatMap((p) => (p.kind === 'keep' ? [p.unit] : [])));
  const keepIn = note.keepIn.filter((u) => !kept.has(u)).map((unit) => ({ unit, text: `Keep ${unitName(unit, run.roster.run.gender)} in` }));
  return { kept: note.kept, dropped: note.dropped, keepIn };
}

function migrationNoteSection(ctx: RunContext): HTMLElement | null {
  const r = migrationNoteReadout(ctx.run);
  if (!r) return null;
  const list = (title: string, rows: readonly string[]) => (rows.length ? h('div', {}, h('b', {}, title), h('ul', {}, ...rows.map((x) => h('li', {}, x)))) : null);
  return h(
    'div',
    { class: 'banner migration-note' },
    h('b', {}, 'Your run moved to endpoint-first planning'),
    list('Kept as pins', r.kept),
    list('Dropped', r.dropped),
    r.keepIn.length
      ? h(
          'div',
          { class: 'row' },
          h('span', { class: 'muted small' }, 'Your old priorities rated these children high: keep them in the wishlist?'),
          ...r.keepIn.map((k) => h('button', { class: 'mini', onclick: () => ctx.setRun(withPin(ctx.run, { kind: 'keep', unit: k.unit, keep: 'in' })) }, k.text)),
        )
      : null,
    h('div', { class: 'row' }, h('button', { class: 'ghost small', onclick: () => ctx.setRun(dismissMigrationNote(ctx.run)) }, 'Got it')),
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
      h('span', { class: 'muted small' }, `${units} units${e.snapshot.gold !== null ? ` · ${goldText(e.snapshot.gold)}${e.shopping?.length ? ` → ${goldText(goldAfterShopping(e)!)} after shopping` : ''}` : ''}${latest ? ' · latest' : ''}`),
      flagged ? h('span', { class: 'chip small warn', title: 'An earlier entry was edited after this one was copied from it: check whether the fix applies here too' }, '⚠ earlier entry edited') : null,
      ctx.engine.classChangeProposals(ctx.run).some((p) => p.entry === e.id)
        ? h('span', { class: 'chip small warn', title: 'A unit’s level reset here: open the entry to record the class change' }, '⚠ class change to record')
        : null,
      !latest || ctx.run.entries.length > 1
        ? h('button', { class: 'mini', title: 'Remove this entry', onclick: () => confirm('Remove this entry?') && ctx.setRun(withLearned(removeEntry(ctx.run, e.id))) }, '✕')
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

const TIER_LABELS = { base: 'Base', advanced: 'Advanced', special: 'Special' } as const;

/** The Promoted box as a readout (#185): the tier from the class data, or a flag for a class it doesn't know. */
const tierCell = (tier: UnitInternalLevel['tier']) =>
  tier
    ? h('td', { class: 'muted small', title: 'From the class data (a special class counts as unpromoted)' }, TIER_LABELS[tier])
    : h('td', { class: 'warn small', title: 'Not a class in the class data: check the spelling. Its tier isn’t guessed.' }, '⚠ unknown class');

/**
 * The unit's internal level and its Second Seal count (#185). The count box stands in for history the log can't see:
 * what's typed is the count as of this entry, so the override is that less what the log's class changes add.
 */
function internalCell(ctx: RunContext, unit: RosterUnit, lv: UnitInternalLevel | undefined): HTMLElement {
  if (!lv) return h('td', {});
  const logged = lv.count - (ctx.run.countOverrides?.[unit] ?? 0);
  return h(
    'td',
    { class: 'small' },
    h('b', { title: `Level ${lv.level}${lv.tier === 'advanced' ? ' + 20 (advanced)' : ''} + count ${lv.count}, capped by difficulty` }, String(lv.internal ?? '?')),
    ' (',
    input(lv.count, (v) => ctx.setRun(withCountOverride(ctx.run, unit, v.trim() === '' ? null : Math.max(0, (Number(v) || 0) - logged))), {
      class: 'num-in',
      'aria-label': `${unit} Second Seal count`,
      title: 'Second Seal count: worked out from the log’s class changes. Set it for history the log can’t see; clear it to go back.',
    }),
    ')',
    lv.unknownHistory
      ? h('span', { class: 'chip small warn', title: 'First seen in a class it can’t join in: enter its Second Seal count from before the log (0 if it has none). Read as 0 until then.' }, '? count before the log')
      : null,
    ...lv.problems.slice(lv.tier ? 0 : 1).map((p) => h('div', { class: 'warn' }, `⚠ ${p}`)),
  );
}

/**
 * Class changes on an entry (#185): the ones the log proposes from a level reset, pre-filled from the entry before and
 * correctable before they're recorded, then the recorded ones.
 */
function classChanges(ctx: RunContext, e: RunEntry): HTMLElement | null {
  const proposals = ctx.engine.classChangeProposals(ctx.run).filter((p) => p.entry === e.id);
  const recorded = e.classChanges ?? [];
  if (!proposals.length && !recorded.length) return null;
  const name = (u: RosterUnit) => unitName(u, ctx.run.roster.run.gender);
  const sealName = (s: Seal) => (s === 'master' ? 'Master Seal' : 'Second Seal');
  return h(
    'div',
    { class: 'banner' },
    h('b', {}, 'Class changes'),
    ...proposals.map((p) => {
      let seal = p.seal;
      let level = p.level;
      return h(
        'div',
        { class: 'row' },
        `${name(p.unit)}: ${p.from} → ${p.to}, `,
        h('select', { 'aria-label': `${p.unit} seal`, onchange: (ev) => (seal = (ev.target as HTMLSelectElement).value as Seal) }, ...(['master', 'second'] as const).map((s) => h('option', { value: s, selected: s === p.seal }, sealName(s)))),
        ' used at Lv ',
        input(level, (v) => (level = Number(v) || level), { class: 'num-in', 'aria-label': `${p.unit} level at use` }),
        h('button', { class: 'mini', onclick: () => ctx.setRun(withClassChange(ctx.run, e.id, { ...p, seal, level })) }, 'Record class change'),
      );
    }),
    proposals.length ? h('span', { class: 'muted small' }, 'Seen from a level reset and pre-filled from the last entry, which is right for a seal used before the map. Correct the level for one used mid-map.') : null,
    ...recorded.map((c, k) =>
      h('div', { class: 'row small' }, `✓ ${name(c.unit)}: ${c.from} → ${c.to}, ${sealName(c.seal)} at Lv ${c.level}`, h('button', { class: 'mini', title: 'Remove this class change', onclick: () => ctx.setRun(removeClassChange(ctx.run, e.id, k)) }, '✕')),
    ),
  );
}

/** Units' rows in an entry, every field editable; `quick` shows only class, level, tier, EXP and internal level. */
function unitTable(ctx: RunContext, e: RunEntry, units: readonly RosterUnit[], quick = false): HTMLElement {
  const edit = (f: (s: Snapshot) => Snapshot) => ctx.setRun(editEntry(ctx.run, e.id, f, ctx.now()));
  const levels = ctx.engine.internalLevels(ctx.run, e.id);
  const unitRow =(unit: RosterUnit, u: UnitSnapshot) => {
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
      // Promoted follows the class data; an unknown class keeps the last value.
      h('td', {}, input(u.class, (v) => set({ class: v, promoted: tierOfClass(v) ? tierOfClass(v) === 'advanced' : u.promoted }), { class: 'cls-in', 'aria-label': `${unit} class` })),
      h('td', {}, input(u.level, (v) => set({ level: Number(v) || 1 }), { class: 'num-in', 'aria-label': `${unit} level` })),
      tierCell(levels.get(unit)?.tier),
      h('td', {}, input(u.exp, (v) => set({ exp: Number(v) || 0 }), { class: 'num-in', 'aria-label': `${unit} EXP` })),
      internalCell(ctx, unit, levels.get(unit)),
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
  const heads = ['Unit', 'Class', 'Lv', 'Tier', 'EXP', 'Internal Lv (count)', ...(quick ? [] : [...STATS.map((x) => STAT_LABELS[x]), 'Skills', 'Inventory (item uses [forge +Mt/+Hit/+Crit])', 'Supports'])];
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
    h('label', { title: 'Gold as the map ended; shopping after it is recorded in the Shopping step' }, 'Gold at the map’s end ', input(e.snapshot.gold ?? '', (v) => edit((sn) => ({ ...sn, gold: numOrNull(v) })), { class: 'num-in' })),
    h('label', {}, 'Convoy ', input(heldText(e.snapshot.convoy), (v) => edit((sn) => ({ ...sn, convoy: parseHeldText(v) })), { class: 'wide-in', placeholder: 'Iron Sword 40; Vulnerary 3' })),
  );
}

const SHOP_VERBS = { buy: 'Bought', sell: 'Sold', forge: 'Forged' } as const;

/**
 * The shopping step as the Run view writes it (#192): the gold at the map's end and after shopping with what went on
 * upkeep, seals and the kit, each recorded line, and what the map used and found against the entry before.
 */
export function shoppingReadout(engine: Engine, run: Run, entry: string): { readonly gold: string; readonly lines: readonly string[]; readonly used: string; readonly found: string } {
  const s = engine.shopping(run, entry)!;
  const name = (u?: RosterUnit) => (u ? unitName(u, run.roster.run.gender) : 'the convoy');
  const lines = s.lines.map((l) => {
    const what = `${l.count && l.count > 1 ? `${l.count} × ` : ''}${l.item}${l.forge ? ` [${l.forge.name} +${l.forge.mt}/+${l.forge.hit}/+${l.forge.crit}]` : ''}`;
    return `${SHOP_VERBS[l.kind]} ${what} ${l.kind === 'sell' ? 'from' : 'for'} ${name(l.unit)}: ${l.kind === 'sell' ? '+' : '−'}${goldText(l.gold)}`;
  });
  const { upkeep, seals, kit, sold } = s.spend;
  const parts = [upkeep ? `upkeep ${goldText(upkeep)}` : '', seals ? `seals ${goldText(seals)}` : '', kit ? `kit ${goldText(kit)}` : '', sold ? `sold ${goldText(sold)}` : ''].filter(Boolean);
  const gold =
    s.goldAtEnd === null
      ? 'Gold at the map’s end isn’t recorded: record it in Convoy and gold.'
      : `Gold at the map’s end ${goldText(s.goldAtEnd)} → after shopping ${goldText(s.goldAfter!)}${parts.length ? ` (${parts.join(', ')})` : ''}`;
  const i = run.entries.findIndex((e) => e.id === entry);
  const first = i <= 0;
  return {
    gold,
    lines,
    used: first ? '' : `Uses spent on this map: ${s.used.map((u) => `${u.item} ${u.uses}`).join(', ') || 'none'}`,
    found: first
      ? ''
      : `Found on this map: ${s.found.map((f) => `${f.count > 1 ? `${f.count} × ` : ''}${f.item}${f.from === 'random' ? ' (random find)' : ''}`).join(', ') || 'nothing'}`,
  };
}

/**
 * The shopping step (#192): buys, sales and forges after the map, each with its gold, pre-filled at the game's price
 * (blank keeps it). A buy joins its holder at full uses; a sale leaves it; a forge sets the held weapon's forge.
 */
function shoppingSection(ctx: RunContext, e: RunEntry): HTMLElement {
  const r = shoppingReadout(ctx.engine, ctx.run, e.id);
  const name = (u: RosterUnit) => unitName(u, ctx.run.roster.run.gender);
  const holders = Object.keys(e.snapshot.units) as RosterUnit[];
  let kind: ShopKind = 'buy';
  let item = '';
  let unit: RosterUnit | '' = '';
  let count = 1;
  let gold = '';
  const forge = { name: '', mt: 0, hit: 0, crit: 0 };
  const record = () => {
    if (!item.trim()) return;
    const after = entryAfterShopping(e);
    const list = unit ? (after.units[unit]?.inventory ?? []) : after.convoy;
    const held = list.find((x) => x.item.trim().toLowerCase() === item.trim().toLowerCase());
    const line: Omit<ShopLine, 'gold'> = {
      kind,
      item: item.trim(),
      ...(unit ? { unit } : {}),
      ...(kind !== 'forge' && count > 1 ? { count } : {}),
      ...(kind === 'forge' ? { forge: { ...forge, name: forge.name || held?.forge?.name || item.trim() } } : {}),
    };
    const price = gold.trim() === '' ? shopPrice(line, held) : Math.max(0, Number(gold) || 0);
    ctx.setRun(withShopLine(ctx.run, e.id, { ...line, gold: price }, ctx.now()));
  };
  const num = (label: string, set: (n: number) => void, value = 0) => input(value, (v) => set(Number(v) || 0), { class: 'num-in', 'aria-label': label });
  return h(
    'div',
    { class: 'banner shopping' },
    h('b', {}, 'Shopping after the map'),
    h('div', { class: 'small' }, r.gold),
    ...r.lines.map((t, k) => h('div', { class: 'row small' }, `✓ ${t}`, h('button', { class: 'mini', title: 'Remove this line', onclick: () => ctx.setRun(removeShopLine(ctx.run, e.id, k, ctx.now())) }, '✕'))),
    h(
      'div',
      { class: 'row' },
      h('select', { 'aria-label': 'Buy, sell or forge', onchange: (ev) => (kind = (ev.target as HTMLSelectElement).value as ShopKind) }, ...(['buy', 'sell', 'forge'] as const).map((k) => h('option', { value: k }, k[0]!.toUpperCase() + k.slice(1)))),
      input('', (v) => (item = v), { 'aria-label': 'Item', placeholder: 'Steel Sword' }),
      h('select', { 'aria-label': 'Held by', onchange: (ev) => (unit = (ev.target as HTMLSelectElement).value as RosterUnit) }, h('option', { value: '' }, 'Convoy'), ...holders.map((u) => h('option', { value: u }, name(u)))),
      h('label', { class: 'small', title: 'How many bought or sold' }, '× ', num('Count', (n) => (count = Math.max(1, Math.floor(n))), 1)),
      h('label', { class: 'small', title: 'A forge: its name and bonuses after it' }, 'forge ', input('', (v) => (forge.name = v), { class: 'num-in', 'aria-label': 'Forge name' }), ' +', num('Forge Mt', (n) => (forge.mt = n)), '/+', num('Forge Hit', (n) => (forge.hit = n)), '/+', num('Forge Crit', (n) => (forge.crit = n))),
      h('label', { class: 'small', title: 'Blank: the game’s price (worth for a buy, by uses left for a sale, by forge steps for a forge)' }, 'gold ', input('', (v) => (gold = v), { class: 'num-in', 'aria-label': 'Gold', placeholder: 'price' })),
      h('button', { class: 'mini', onclick: record }, 'Record'),
    ),
    r.used ? h('div', { class: 'muted small' }, r.used) : null,
    r.found ? h('div', { class: 'muted small', title: 'Items gained with no buy or map item (a chest, a village, a drop, a side goal) behind them are random finds' }, r.found) : null,
    h('span', { class: 'muted small' }, 'The next entry starts from the army as it left the shop, and so do the flawless chance’s runs.'),
  );
}

function snapshotEditor(ctx: RunContext, e: RunEntry): HTMLElement {
  const s = e.snapshot;
  const units = Object.entries(s.units) as [RosterUnit, UnitSnapshot][];
  return h(
    'div',
    { ...guide('log-snapshot'), class: 'snapshot small' },
    goldAndConvoy(ctx, e),
    shoppingSection(ctx, e),
    unitTable(ctx, e, units.map(([u]) => u)),
    classChanges(ctx, e),
    units.some(([, u]) => !u.stats) ? h('div', { class: 'muted' }, 'Blank stats: a child’s stats depend on its parents, so record them from the game.') : null,
    problems(s),
    h('div', { class: 'muted' }, 'Stats as the stat screen shows them, without pair-up. Unit states and marriages are edited on the Roster page; they’re recorded in the latest entry.'),
  );
}
