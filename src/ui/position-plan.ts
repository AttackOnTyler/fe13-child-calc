/**
 * The Prepare page's position plan (#266; variant D of #258, the loop of #262), on a map with a captured grid:
 *
 * - **Headline** (#285): "Proven: rout on turn N" (or the best found so far while the search runs, with its progress),
 *   the game-over chance and the expected worth lost against the map's risk budget, the play's estimate, and where the
 *   play's "held back" can't keep its units out of reach (#248).
 * - **Left:** a turn stepper over the whole line, turn 1 to the rout. The open turn lists its actions (unit → tile,
 *   trade, command, target, forecast, why, the weapon it ends holding); every other turn is one line, a click opens it.
 * - **Right (sticky):** the safety verdict per unit, a "danger to" picker and the board: terrain, the danger zone
 *   (can be hit, or killed without a crit), the planned moves numbered with ghosts where units start, and the predicted
 *   enemy moves.
 * - **Confirm or correct:** outcome taps on each combat; after the player phase, the predicted enemy phase with ✓ or
 *   fix on its attacks; "a unit is elsewhere" and HP fallbacks. Played as planned, the page follows the line it has
 *   (`planAhead`); an input that leaves it (a miss, a crit, a fixed attack, another stop, a unit elsewhere, a tried
 *   move) re-solves from the real board (#278). Every input is kept in the run (`run.positions`), and the board is
 *   replayed from them.
 * - **Try a move:** a unit, a tile, then the game's command menu there; the turn re-solves around it and the page lists
 *   what's better, worse and the same against the plan; use it, go back, or try another tile.
 * - **Turn-1 skill taps:** each enemy's random skills, cautious (all) until tapped.
 */
import {
  actionText,
  applyAction,
  capturedMap,
  enemyById,
  enemyPhase,
  forecast,
  manhattan,
  playFight,
  reaches,
  strikeOrder,
  actingTiles,
  holdBack,
  leads,
  lineupBoard,
  liveEnemies,
  menuAt,
  onMap,
  playerById,
  replay,
  safety,
  solvePositions,
  terrainAt,
  threatTiles,
  tileKey,
  withPositionEvents,
  type AttackOutcome,
  type Board,
  type ChapterDifficulty,
  type DeployCandidate,
  type EnemyAction,
  type PlannedAction,
  type PositionEvent,
  type PositionPlan,
  type RosterUnit,
  type SearchProgress,
  type Run,
  type Safety,
  type Tile,
  type TurnPlan,
} from '../engine';
import { h } from './dom';
import { guide } from './guide';
import { startSolve } from './solve-client';

export type PositionContext = {
  readonly run: Run;
  readonly setRun: (run: Run) => void;
  readonly map: string;
  readonly difficulty: ChapterDifficulty | 'lunatic-plus';
  /** The lineup's units as the page builds them. */
  readonly units: readonly DeployCandidate[];
  readonly name: (u: RosterUnit) => string;
  /** The run-level play's held-back units by turn (#248), and its turns (the rout target). */
  readonly heldBack: readonly { readonly turn: number; readonly units: readonly string[] }[];
  readonly playTurns?: string;
  /** Re-draws the note beside the no-death chance (#248). */
  readonly note?: HTMLElement;
  /** What prices a death (#282, #285): unit worth, the map's budget, and where they came from (`riskBudget`). */
  readonly risk?: RiskBudget;
};

/** Unit worth and the map's budget of expected worth lost, as the solve takes them, and a note on their source. */
export type RiskBudget = { readonly worth: Readonly<Record<string, number>>; readonly budget?: number; readonly note: string };

/**
 * The run plan's pricing for a map (#278): each deployed unit's worth (Chrom and Robin have none: their death is game
 * over), and the budget, the worth the plan already expects to lose here, read as the chance someone dies on the map
 * (1 − its no-death chance) at the lineup's mean worth: an approximation, the simulation doesn't say who. When no worth
 * is costed yet, or every one reads about 0 (a run at 0% has nothing to lose), deaths couldn't be priced: the solver's
 * default stands (a death costs 1, a budget of 0.2), and the note says so.
 */
export function riskBudget(worths: Readonly<Record<string, number | undefined>>, noDeath: number | undefined): RiskBudget {
  const known = Object.entries(worths).filter((e): e is [string, number] => e[1] !== undefined);
  if (noDeath === undefined || !known.length || known.every(([, w]) => w < 1e-4))
    return { worth: {}, note: `default: ${noDeath === undefined || !known.length ? 'unit worth not costed yet' : 'the run reads 0%, so unit worth can’t price a death'}` };
  const mean = known.reduce((n, [, w]) => n + w, 0) / known.length;
  return { worth: Object.fromEntries(known), budget: (1 - noDeath) * mean, note: 'the run plan’s expected loss on this map' };
}

const sameAction = (a: PlannedAction, b: PlannedAction) =>
  JSON.stringify([a.unit, a.to, a.command, a.trade ?? null, !!a.switched, a.equip ?? null]) === JSON.stringify([b.unit, b.to, b.command, b.trade ?? null, !!b.switched, b.equip ?? null]);
const sameEnemy = (a: readonly EnemyAction[], b: readonly EnemyAction[]) =>
  JSON.stringify(a.map((x) => [x.enemy, x.to, x.target ?? null, x.result ?? null])) === JSON.stringify(b.map((x) => [x.enemy, x.to, x.target ?? null, x.result ?? null]));

/**
 * The plan's line ahead of the inputs played since it was solved (#285): the rest of the current turn, then the turns
 * after. Undefined once play leaves it: an action other than the next one, an outcome other than the forecast, an enemy
 * phase other than the predicted one, a unit put elsewhere, an HP set or a skill tapped.
 */
export function planAhead(plan: PositionPlan, played: readonly PositionEvent[]): PositionPlan | undefined {
  let ti = 0;
  let ai = 0;
  for (const e of played) {
    const t = plan.turns[ti];
    if (!t) return undefined;
    if (e.kind === 'act') {
      const a = t.actions[ai];
      if (!a || !sameAction(a, e.action) || (e.outcome && (e.outcome.ours !== 'forecast' || (e.outcome.counter && e.outcome.counter !== 'forecast')))) return undefined;
      ai++;
    } else if (e.kind === 'enemy') {
      if (ai < t.actions.length || !sameEnemy(t.enemy, e.actions)) return undefined;
      ti++;
      ai = 0;
    } else return undefined;
  }
  const t = plan.turns[ti];
  return { ...plan, turns: t ? [{ ...t, actions: t.actions.slice(ai) }, ...plan.turns.slice(ti + 1)] : [] };
}

// ---- the readout (pure) -----------------------------------------------------------------------------------------

export type HeldBackNote = { readonly turn: number; readonly units: readonly string[]; readonly threats: readonly string[] };

/**
 * Where the play's "held back" fails on the plan's boards (#248): each detailed turn whose held-back units can't all
 * stand out of reach at its start. A back whose lead is held back too rides with it.
 */
export function heldBackNotes(plan: PositionPlan, heldBack: PositionContext['heldBack']): HeldBackNote[] {
  return plan.turns.flatMap((t): HeldBackNote[] => {
    const held = heldBack.find((x) => x.turn === t.turn)?.units ?? [];
    const onBoard = held.filter((u) => {
      const p = playerById(t.before, u);
      return p && p.hp > 0 && !(p.carriedBy && held.includes(p.carriedBy));
    });
    if (!onBoard.length) return [];
    const r = holdBack(t.before, onBoard);
    return r.feasible ? [] : [{ turn: t.turn, units: onBoard, threats: r.threats.map((id) => enemyById(t.before, id)?.name ?? id) }];
  });
}

const pct = (x: number) => (x <= 0 ? '0%' : x < 0.001 ? 'under 0.1%' : `${(x * 100).toFixed(1)}%`);
const listOf = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** The headline (#285): the rout and its proof, the risk against the budget, the play's estimate, the held-back notes. */
export function headline(plan: PositionPlan, notes: readonly HeldBackNote[], name: (id: string) => string, playTurns?: string, budgetNote?: string): { readonly verdict: string; readonly ok: boolean; readonly lines: readonly string[] } {
  const ok = plan.withinRisk && plan.routTurn !== undefined;
  const verdict = !plan.withinRisk
    ? 'Over the risk budget: this is the least-risk line'
    : plan.routTurn === undefined
      ? 'No rout found within the risk budget: this line gets furthest'
      : plan.proven
        ? `Proven: rout on turn ${plan.routTurn}`
        : `Best found so far: rout on turn ${plan.routTurn}`;
  const worth = (x: number) => (x === 0 ? '0' : x < 0.001 ? x.toExponential(1) : String(Math.round(x * 1000) / 1000));
  const lines = [
    `Risk: game over ${pct(plan.gameOver)} · expected worth lost ${worth(plan.worthLost)} of ${worth(plan.budget)}${budgetNote ? ` (${budgetNote})` : ''}`,
    ...(playTurns ? [`The play estimated ${playTurns}`] : []),
    ...notes.map((n) => `The stance plan holds ${listOf(n.units.map(name))} back on T${n.turn}, but no formation keeps them all out of reach there (${listOf([...new Set(n.threats)])}). The play’s no-death chance assumes it anyway; this plan doesn’t.`),
  ];
  return { verdict, ok, lines };
}

/** One turn in a line: safe or not, crit, kills, wakes. */
export function turnLine(t: TurnPlan, name: (id: string) => string): string {
  const kills = t.actions.filter((a) => a.forecast?.targetHp === 0).length;
  const unsafe = t.safety.units.filter((u) => u.dies).map((u) => name(u.unit));
  const risk = t.safety.units.reduce((n, u) => n + u.deathChance, 0);
  return [
    `T${t.turn}`,
    t.safety.safe ? '✓ no death without a crit' : `✗ ${unsafe.length ? `${listOf(unsafe)} can die` : 'a counter can kill'}`,
    risk > 0 ? `death risk ${pct(risk)}` : '',
    kills ? `${kills} kill${kills > 1 ? 's' : ''}` : '',
    t.woke.length ? `wakes ${t.woke.length}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** An action's forecast in words: "27×1 at 100%, crit 0% · no counter (from 2)". */
export function forecastText(a: PlannedAction): string {
  const f = a.forecast;
  if (!f) return '';
  const counter = f.countered ? `counter ${f.counterDamage}${f.counterStrikes > 1 ? `×${f.counterStrikes}` : ''} at ${f.counterHit}%${f.counterCrit ? `, crit ${f.counterCrit}%` : ''}` : 'no counter';
  return `${f.damage}×${f.hits} at ${f.hit}%, crit ${f.crit}%${f.dualStrike ? `, Dual Strike ${f.dualStrike}%` : ''} · ${counter} · after: ${f.targetHp ? `${f.targetHp} HP left` : 'it falls'}, ${f.unitHp} HP`;
}

/** How a tried move compares with the plan: what's better, worse and the same (#262). */
export function compare(mine: PositionPlan, theirs: PositionPlan, name: (id: string) => string): { readonly good: string[]; readonly bad: string[]; readonly same: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  const same: string[] = [];
  const put = (label: string, a: number, b: number, higherBetter: boolean, fmt: (x: number) => string = String) => {
    if (a === b) same.push(`${label}: ${fmt(a)}`);
    else ((a > b) === higherBetter ? good : bad).push(`${label}: ${fmt(a)} (plan ${fmt(b)})`);
  };
  const m = mine.turns[0];
  const t = theirs.turns[0];
  if (!m || !t) return { good, bad, same };
  put('No death without a crit this turn', m.safety.safe ? 1 : 0, t.safety.safe ? 1 : 0, true, (x) => (x ? 'kept' : 'broken'));
  put('Attacks whose counter can kill', m.safety.lethalCounters.length, t.safety.lethalCounters.length, false);
  const kills = (x: TurnPlan) => x.actions.filter((a) => a.forecast?.targetHp === 0).length;
  put('Kills this turn', kills(m), kills(t), true);
  const dealt = (x: TurnPlan) => x.before.enemies.reduce((n, e) => n + e.hp - Math.max(0, enemyById(applied(x), e.id)?.hp ?? 0), 0);
  put('Damage dealt', dealt(m), dealt(t), true);
  put('Foes left after the enemy phase', liveEnemies(m.after).length, liveEnemies(t.after).length, false);
  put('Foes the enemy phase draws', m.enemy.filter((a) => a.target).length, t.enemy.filter((a) => a.target).length, false);
  put('Wakes', m.woke.length, t.woke.length, false);
  const worst = (s: Safety) => Math.max(0, ...s.units.map((u) => u.total / u.hp));
  put('Worst case (share of a unit’s HP)', Math.round(worst(m.safety) * 100), Math.round(worst(t.safety) * 100), false, (x) => `${x}%`);
  for (const p of t.after.players) {
    const q = playerById(m.after, p.id);
    if (q) put(`${name(p.id)}’s HP after`, q.hp, p.hp, true);
  }
  put('Rout turn', -(mine.routTurn ?? 99), -(theirs.routTurn ?? 99), true, (x) => (x === -99 ? 'none' : `T${-x}`));
  return { good, bad, same };
}

/** A turn's player phase applied (its board before the enemy phase). */
const APPLIED = new WeakMap<TurnPlan, Board>();
function applied(t: TurnPlan): Board {
  let b = APPLIED.get(t);
  if (!b) {
    b = t.actions.reduce((x, a) => applyAction(x, a), t.before);
    APPLIED.set(t, b);
  }
  return b;
}

// ---- state --------------------------------------------------------------------------------------------------------

type UiState = {
  /** The detailed turn open (index into the plan's turns). */
  view: number;
  /** Danger to whom on the board: a unit id, or everyone. */
  danger: string;
  /** Trying a move: the unit, then the tile, then the action, then its plan. */
  trying?: { unit: string; tile?: Tile; action?: PlannedAction; plan?: PositionPlan };
  /** The move the player chose to use instead of the plan's (pinned in the solve). */
  mine?: PlannedAction;
  /** "A unit is elsewhere": the unit picked, waiting for its tile. */
  placing?: string;
  /** Fixing the enemy phase: by enemy id, its attack as it went. */
  fixes: Record<string, { target: string; foe: StrikeTap; unit: StrikeTap }>;
  fixing: boolean;
  /** Where a foe really stopped, by enemy id, when the game picked another of its equal tiles (#273). */
  stops: Record<string, Tile>;
  /** The turn-1 skill taps: the enemy shown. */
  skillAt: number;
  /** An attack's counter as tapped before its outcome. */
  counter: 'forecast' | 'hit' | 'missed';
};
const UI = new Map<string, UiState>();
const stateOf = (map: string): UiState => UI.get(map) ?? (UI.set(map, { view: 0, danger: 'all', fixes: {}, fixing: false, stops: {}, skillAt: 0, counter: 'forecast' }), UI.get(map)!);

/** Solved plans by board and pin, the few latest. */
const PLANS = new Map<string, PositionPlan>();
const planKey = (map: string, events: readonly PositionEvent[], pinned?: PlannedAction, units?: string) => `${map}|${units}|${JSON.stringify(events)}|${pinned ? JSON.stringify(pinned) : ''}`;
function remember(k: string, p: PositionPlan) {
  if (PLANS.size > 12) PLANS.delete(PLANS.keys().next().value!);
  PLANS.set(k, p);
}

/** The line being followed per map and lineup, and the inputs it was solved at (#285). */
const ACTIVE = new Map<string, { readonly events: readonly PositionEvent[]; readonly plan: PositionPlan }>();
/** A running solve's progress, by plan key. */
const PROGRESS = new Map<string, SearchProgress>();
const isPrefix = (a: readonly PositionEvent[], b: readonly PositionEvent[]) => a.length <= b.length && JSON.stringify(a) === JSON.stringify(b.slice(0, a.length));

/** A solve's progress, starting it the first time it's asked for (a progress redraw must not restart it). */
function solving(k: string, board: Board, acted: readonly string[], pinned: PlannedAction | undefined, risk: RiskBudget | undefined, done: () => void): SearchProgress {
  if (!PROGRESS.has(k)) {
    PROGRESS.set(k, { expanded: 0, bound: board.turn });
    solve(k, board, acted, pinned, risk, done);
  }
  return PROGRESS.get(k)!;
}

/** Solves in the worker (else here, after the page draws), then calls back; progress redraws as it comes. */
function solve(k: string, board: Board, acted: readonly string[], pinned: PlannedAction | undefined, risk: RiskBudget | undefined, done: () => void): void {
  const options = { acted, ...(pinned ? { pinned } : {}), ...(risk && Object.keys(risk.worth).length ? { worth: risk.worth } : {}), ...(risk?.budget !== undefined ? { budget: risk.budget } : {}) };
  const stop = startSolve({ kind: 'positions', board, options, assumptions: {} as never, run: undefined as never, seed: 0 } as never, (reply) => {
    if (reply.kind === 'positions-progress') {
      PROGRESS.set(k, reply.progress);
      return done();
    }
    if (reply.kind !== 'positions') return;
    PROGRESS.delete(k);
    remember(k, reply.plan);
    done();
  }, 'positions');
  if (!stop)
    setTimeout(() => {
      remember(k, solvePositions(board, options));
      done();
    }, 0);
}

// ---- the section ------------------------------------------------------------------------------------------------

/** The position plan's section for a captured map, or null (no grid, or no unit on it). */
export function positionSection(ctx: PositionContext): HTMLElement | null {
  if (!capturedMap(ctx.map)) return null;
  const start = lineupBoard(ctx.map, ctx.difficulty, ctx.units, ctx.name);
  if (!start) return null;
  const root = h('section', { ...guide('position-plan'), class: 'prep-box positions' });
  const draw = () => root.replaceChildren(...content(ctx, start, draw).filter((x): x is HTMLElement => !!x));
  draw();
  return root;
}

function content(ctx: PositionContext, start: Board, redraw: () => void): (HTMLElement | null)[] {
  const ui = stateOf(ctx.map);
  const events = ctx.run.positions?.[ctx.map] ?? [];
  const { board, acted } = replay(start, events);
  const nm = (id: string) => playerById(board, id)?.name ?? enemyById(board, id)?.name ?? id;
  const units = ctx.units.map((u) => u.unit).join(',');
  const push = (e: PositionEvent | PositionEvent[]) => {
    ui.trying = undefined;
    ui.mine = undefined;
    ui.fixing = false;
    ui.fixes = {};
    ui.stops = {};
    ctx.setRun(withPositionEvents(ctx.run, ctx.map, [...events, ...(Array.isArray(e) ? e : [e])]));
  };
  // Played as planned, follow the line already solved; off it (or trying a move), solve from the real board (#285).
  const lineKey = `${ctx.map}|${units}`;
  const active = ACTIVE.get(lineKey);
  const k = planKey(ctx.map, events, ui.mine, units);
  let plan = !ui.mine && active && isPrefix(active.events, events) ? planAhead(active.plan, events.slice(active.events.length)) : undefined;
  if (!plan) {
    plan = PLANS.get(k);
    if (plan) ACTIVE.set(lineKey, { events, plan });
  }
  if (!plan) {
    const p = solving(k, board, acted, ui.mine, ctx.risk, () => root());
    return [
      h('h3', {}, 'Position plan'),
      h('p', { class: 'muted' }, `Searching every turn to the rout on the captured map… ${p.expanded} line${p.expanded === 1 ? '' : 's'} explored${p.bestRout ? ` · best so far: rout on turn ${p.bestRout}` : ''} · nothing routs before turn ${p.bound}`),
    ];
  }
  function root() {
    redraw();
  }
  const notes = heldBackNotes(plan, ctx.heldBack);
  if (ctx.note) ctx.note.replaceChildren(...notes.map((n) => h('div', { class: 'small warn-t' }, `⚠ T${n.turn}: the play holds ${listOf(n.units.map(nm))} back, but on the map no formation keeps them all out of reach; the no-death chance above assumes it anyway.`)));
  const head = headline(plan, notes, nm, ctx.playTurns, ctx.risk?.note);
  const done = !liveEnemies(board).length;
  const turn = plan.turns[Math.min(ui.view, plan.turns.length - 1)];
  const current = plan.turns[0];
  const playerPhaseOver = !done && leads(board).every((p) => acted.includes(p.id));
  const reset = () => {
    UI.delete(ctx.map);
    ctx.setRun(withPositionEvents(ctx.run, ctx.map, []));
  };

  // Headline.
  const top = h(
    'div',
    { class: `pos-head ${head.ok ? 'ok' : 'broken'}` },
    h('b', {}, `${head.ok ? '✓' : '✗'} ${head.verdict}`),
    ...head.lines.map((l) => h('div', { class: 'small' }, l)),
    h('div', { class: 'muted small' }, `Board: turn ${board.turn}${events.length ? ` · ${events.length} input${events.length > 1 ? 's' : ''} kept` : ''} · every choice says why; played as planned it follows this line, and a tap that leaves it re-solves. `, events.length ? h('button', { class: 'linkish', title: 'Forget every input on this map and start from turn 1', onclick: reset }, 'Start over') : null),
  );
  if (done) return [h('h3', {}, 'Position plan'), top, h('p', {}, '✓ Routed. Record results when the map ends.')];

  // Left: the turn stepper and the script.
  const stepper = h(
    'div',
    { class: 'chips pos-stepper' },
    ...plan.turns.map((t, i) => h('button', { class: `mini${i === ui.view ? ' on' : ''}${t.safety.safe ? '' : ' neg'}`, onclick: () => ((ui.view = i), redraw()) }, `T${t.turn}${t.safety.safe ? '' : ' ✗'}`)),
  );
  const played = eventsThisTurn(events);
  const script = h(
    'ol',
    { class: 'pos-actions' },
    ...(ui.view === 0 ? played.map((e) => h('li', { class: 'done muted' }, `✓ ${actionText(start, e.action)}${e.outcome && e.outcome.ours !== 'forecast' ? ` (${e.outcome.ours})` : ''}`)) : []),
    ...(turn ? turn.actions.map((a, i) => actionItem(turn.before, a, ui.view === 0 && i === 0 ? { push, ui, redraw } : undefined)) : []),
  );
  // Every other turn of the line, one line each; a click opens it.
  const others = h('ul', { class: 'small pos-others' }, ...plan.turns.map((t, i) => (i === ui.view ? null : h('li', {}, h('button', { class: 'linkish', title: 'Open this turn', onclick: () => ((ui.view = i), redraw()) }, turnLine(t, nm))))));
  const taps =
    ui.view === 0 && current && current.actions.length
      ? h(
          'div',
          { ...guide('position-taps'), class: 'row pos-taps' },
          h('button', { class: 'primary', title: 'Every remaining action went as its forecast', onclick: () => push(current.actions.map((a) => ({ kind: 'act' as const, action: a }))) }, '✓ Played as planned'),
          h('span', { class: 'muted small' }, 'or tap how each fight went, in order: the rest re-solves after each.'),
        )
      : null;
  const enemy = playerPhaseOver ? enemyPanel(board, ui, push, redraw) : null;
  const skills = board.turn === 1 && !acted.length ? skillTaps(board, ui, push, redraw) : null;
  const fallbacks = fallbackRow(board, ui, push, redraw);
  const left = h(
    'div',
    { class: 'pos-left' },
    stepper,
    turn ? h('div', { class: 'small' }, h('b', {}, turnLine(turn, nm))) : null,
    enemy ?? script,
    enemy ? null : taps,
    others,
    skills,
    fallbacks,
  );

  // Right: verdict, danger picker, board, try a move.
  const shown = ui.view === 0 ? board : (turn?.before ?? board);
  const verdict = turn ? safetyList(turn.safety, nm) : null;
  const picker = h(
    'label',
    { class: 'small' },
    'Danger to ',
    h('select', { onchange: (e) => ((ui.danger = (e.target as HTMLSelectElement).value), redraw()) }, h('option', { value: 'all', selected: ui.danger === 'all' }, 'everyone'), ...leads(shown).map((p) => h('option', { value: p.id, selected: ui.danger === p.id }, p.name))),
  );
  const right = h('div', { class: 'pos-right' }, verdict, picker, boardView(shown, turn, ui, redraw, ui.view === 0 && !playerPhaseOver, push), tryPanel(ctx, board, acted, plan, ui, redraw, events, units));
  return [h('h3', {}, 'Position plan'), top, h('div', { class: 'pos-cols' }, left, right)];
}

/** The actions played since the last enemy phase. */
function eventsThisTurn(events: readonly PositionEvent[]): Extract<PositionEvent, { kind: 'act' }>[] {
  const i = events.map((e) => e.kind).lastIndexOf('enemy');
  return events.slice(i + 1).filter((e): e is Extract<PositionEvent, { kind: 'act' }> => e.kind === 'act');
}

const OUTCOMES: readonly (readonly [AttackOutcome['ours'], string])[] = [
  ['forecast', 'as forecast'],
  ['missed', 'missed'],
  ['crit', 'crit'],
  ['killed', 'killed'],
  ['dual-strike', 'Dual Strike'],
];

/** One scripted action: what, the forecast, why; the next one to play carries its taps. */
function actionItem(b: Board, a: PlannedAction, live?: { push: (e: PositionEvent) => void; ui: UiState; redraw: () => void }): HTMLElement {
  const holds = a.command.kind === 'attack' ? ` · ends holding the ${a.command.weapon}` : '';
  const kids: (HTMLElement | string | null)[] = [
    h('b', {}, actionText(b, a)),
    a.forecast ? h('div', { class: 'small' }, forecastText(a)) : null,
    h('div', { class: 'muted small' }, `Why: ${a.why}${holds}`),
  ];
  if (live) {
    const { push, ui, redraw } = live;
    if (a.command.kind === 'attack') {
      if (a.forecast?.countered)
        kids.push(
          h(
            'div',
            { class: 'chips small' },
            'Counter: ',
            ...(['forecast', 'hit', 'missed'] as const).map((c) => h('button', { class: `mini${ui.counter === c ? ' on' : ''}`, onclick: () => ((ui.counter = c), redraw()) }, c === 'forecast' ? 'as forecast' : c)),
          ),
        );
      kids.push(
        h(
          'div',
          { class: 'chips' },
          ...OUTCOMES.map(([o, label]) =>
            h('button', { class: 'mini', onclick: () => push({ kind: 'act', action: a, outcome: { ours: o, ...(ui.counter !== 'forecast' ? { counter: ui.counter } : {}) } }) }, label),
          ),
        ),
      );
    } else kids.push(h('div', { class: 'chips' }, h('button', { class: 'mini', onclick: () => push({ kind: 'act', action: a }) }, '✓ done')));
  }
  return h('li', { class: live ? 'next' : '' }, ...kids);
}

const TAPS: readonly StrikeTap[] = ['hit', 'missed', 'crit', 'killed'];

/**
 * The predicted enemy phase: ✓ as predicted, or fix its attacks (target, whose strikes landed, a crit, a kill). A foe
 * with equal tiles to stop on (#273: the game rolls among them) shows each as a tap, so a correction is a click, not a
 * count of tiles.
 */
function enemyPanel(b: Board, ui: UiState, push: (e: PositionEvent) => void, redraw: () => void): HTMLElement {
  const ep = enemyPhase(b);
  const attacks = ep.actions.filter((a) => a.target);
  const movers = ep.actions.filter((a) => !a.target && (a.to[0] !== a.from[0] || a.to[1] !== a.from[1]));
  const nm = (id: string) => playerById(b, id)?.name ?? enemyById(b, id)?.name ?? id;
  const stop = (a: EnemyAction): Tile => ui.stops[a.enemy] ?? a.to;
  const fixed = (): EnemyAction[] =>
    ep.actions.map((a) => {
      const f = ui.fixing ? ui.fixes[a.enemy] : undefined;
      if (!f) return ui.stops[a.enemy] ? { ...a, to: stop(a) } : a;
      if (!f.target) return { enemy: a.enemy, from: a.from, to: stop(a) };
      const e = enemyById(b, a.enemy)!;
      const t = playerById(b, f.target)!;
      // The fight as it went: its strikes and the counter as tapped.
      const r = fightAs(b, e.id, t.id, stop(a), f.foe, f.unit);
      return { enemy: a.enemy, from: a.from, to: stop(a), target: t.id, result: r };
    });
  // The tiles a foe could as well have stopped on: the predicted one first, each a tap.
  const stops = (a: EnemyAction, label: string) =>
    a.alternatives?.length
      ? h(
          'div',
          { class: 'chips small' },
          label,
          ...[a.to, ...a.alternatives].map((t) => {
            const on = stop(a)[0] === t[0] && stop(a)[1] === t[1];
            return h('button', { class: `mini${on ? ' on' : ''}`, onclick: () => ((ui.stops[a.enemy] = t), redraw()) }, `(${t[0]},${t[1]})`);
          }),
        )
      : null;
  return h(
    'div',
    { ...guide('position-enemy'), class: 'pos-enemy' },
    h('b', {}, `Enemy phase ${b.turn}: predicted`),
    ep.woke.length ? h('div', { class: 'small warn-t' }, `Wakes: ${ep.woke.map(nm).join(', ')}`) : null,
    h(
      'ol',
      { class: 'small' },
      ...attacks.map((a) => {
        const f = ui.fixes[a.enemy];
        return h(
          'li',
          {},
          `${nm(a.enemy)} → (${a.to[0]},${a.to[1]}) attacks ${nm(a.target!)} from ${a.range}: ${a.result ? `${nm(a.target!)} ${a.result.targetHp} HP, ${nm(a.enemy)} ${a.result.enemyHp || 'falls'}` : ''}`,
          stops(a, 'Attacked from: '),
          ui.fixing
            ? h(
                'div',
                { class: 'chips' },
                h(
                  'select',
                  { 'aria-label': `${nm(a.enemy)}'s target`, onchange: (e) => ((ui.fixes[a.enemy] = { ...(f ?? { foe: 'hit', unit: 'hit' }), target: (e.target as HTMLSelectElement).value }), redraw()) },
                  h('option', { value: '', selected: f?.target === '' }, 'didn’t attack'),
                  ...leads(b).map((p) => h('option', { value: p.id, selected: (f?.target ?? a.target) === p.id }, p.name)),
                ),
              )
            : null,
          ui.fixing
            ? h(
                'div',
                { class: 'chips small' },
                'Its strikes: ',
                ...TAPS.map((o) => h('button', { class: `mini${(f?.foe ?? 'hit') === o ? ' on' : ''}`, onclick: () => ((ui.fixes[a.enemy] = { target: f?.target ?? a.target!, unit: f?.unit ?? 'hit', foe: o }), redraw()) }, o === 'killed' ? `killed ${nm(f?.target || a.target!)}` : o)),
              )
            : null,
          ui.fixing
            ? h(
                'div',
                { class: 'chips small' },
                'Counter: ',
                ...TAPS.map((o) => h('button', { class: `mini${(f?.unit ?? 'hit') === o ? ' on' : ''}`, onclick: () => ((ui.fixes[a.enemy] = { target: f?.target ?? a.target!, foe: f?.foe ?? 'hit', unit: o }), redraw()) }, o === 'killed' ? `killed ${nm(a.enemy)}` : o)),
              )
            : null,
        );
      }),
    ),
    movers.length ? h('div', { class: 'muted small' }, `Moving only (on the board): ${movers.map((a) => `${nm(a.enemy)} → (${a.to[0]},${a.to[1]})${a.alternatives?.length ? ' or another tile' : ''}`).join('; ')}`) : null,
    ...movers.filter((a) => a.alternatives?.length).map((a) => stops(a, `${nm(a.enemy)} stopped on: `)),
    attacks.length ? null : h('div', { class: 'muted small' }, 'No enemy attacks.'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'primary', onclick: () => push({ kind: 'enemy', actions: fixed() }) }, ui.fixing || Object.keys(ui.stops).length ? '✓ As fixed' : '✓ As predicted'),
      attacks.length ? h('button', { class: 'ghost', onclick: () => ((ui.fixing = !ui.fixing), redraw()) }, ui.fixing ? 'Back' : 'Fix an attack') : null,
      h('span', { class: 'muted small' }, 'A foe that ended elsewhere: “A unit is elsewhere” below.'),
    ),
  );
}

/** How one side's strikes went in a fixed enemy attack: all hit, all missed, the first a crit, or the fight killed. */
export type StrikeTap = 'hit' | 'missed' | 'crit' | 'killed';

/**
 * An enemy's attack played out as tapped (#274): `foe` is how the enemy's strikes on the unit went, `unit` how the unit's
 * counter went. Hit or missed plays every strike of that side, or none; a crit triples that side's first strike; killed
 * ends the fight on that side's first strike, the other side at 0 whatever the numbers say.
 */
export function fightAs(b: Board, enemy: string, target: string, from: Tile, foe: StrikeTap, unit: StrikeTap): { targetHp: number; enemyHp: number } {
  const e = enemyById(b, enemy)!;
  const t = playerById(b, target)!;
  const m = forecast(b, t, e, t.at, from);
  const d = manhattan(from, t.at);
  let p = t.hp;
  let q = e.hp;
  let critFoe = foe === 'crit';
  let critUnit = unit === 'crit';
  for (const s of strikeOrder(m, 'enemy', reaches(t.fighter.weapon?.item, d), true)) {
    if (p <= 0 || q <= 0) break;
    if (s === 'enemy' && foe !== 'missed') {
      p = foe === 'killed' ? 0 : p - m.worstHit * (critFoe ? 3 : 1);
      critFoe = false;
    } else if (s === 'player' && unit !== 'missed') {
      q = unit === 'killed' ? 0 : q - m.damage * (critUnit ? 3 : 1);
      critUnit = false;
    }
  }
  return { targetHp: Math.max(0, p), enemyHp: Math.max(0, q) };
}

/** Turn 1: each enemy's random skills, cautious (all) until tapped. */
function skillTaps(b: Board, ui: UiState, push: (e: PositionEvent) => void, redraw: () => void): HTMLElement | null {
  const foes = liveEnemies(b).filter((e) => !e.boss && e.foe.skills.length);
  if (!foes.length) return null;
  const i = Math.min(ui.skillAt, foes.length - 1);
  const e = foes[i]!;
  const step = (d: number) => ((ui.skillAt = (i + d + foes.length) % foes.length), redraw());
  return h(
    'details',
    { class: 'small pos-skills' },
    h('summary', {}, 'Turn 1: what did they roll? (optional: cautious until tapped)'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'mini', onclick: () => step(-1) }, '‹'),
      h('span', {}, `${e.name} at (${e.at[0]},${e.at[1]}): ${e.foe.skills.join(', ') || 'none'}`),
      h('button', { class: 'mini', onclick: () => step(1) }, '›'),
    ),
    h(
      'div',
      { class: 'chips' },
      h('button', { class: 'mini', onclick: () => push({ kind: 'skills', enemy: e.id, skills: [] }) }, 'rolled none'),
      ...e.foe.skills.map((s) => h('button', { class: 'mini', onclick: () => push({ kind: 'skills', enemy: e.id, skills: [s] }) }, `only ${s}`)),
    ),
  );
}

/** The fallbacks: a unit (or foe) is elsewhere; set an HP. */
function fallbackRow(b: Board, ui: UiState, push: (e: PositionEvent) => void, redraw: () => void): HTMLElement {
  const all = [...leads(b).map((p) => [p.id, p.name] as const), ...liveEnemies(b).map((e) => [e.id, `${e.name} (${e.at[0]},${e.at[1]})`] as const)];
  const hpUnit = h('select', { 'aria-label': 'Unit whose HP to set' }, ...all.map(([id, n]) => h('option', { value: id }, n)));
  const hpValue = h('input', { type: 'number', min: '0', class: 'num-in', 'aria-label': 'HP' }) as HTMLInputElement;
  return h(
    'details',
    { class: 'small pos-fallbacks' },
    h('summary', {}, 'The board is off? A unit is elsewhere, or an HP'),
    h(
      'div',
      { class: 'row' },
      h('select', { 'aria-label': 'Unit that is elsewhere', onchange: (e) => ((ui.placing = (e.target as HTMLSelectElement).value || undefined), redraw()) }, h('option', { value: '' }, 'A unit is elsewhere…'), ...all.map(([id, n]) => h('option', { value: id, selected: ui.placing === id }, n))),
      ui.placing ? h('span', { class: 'warn-t' }, 'now click its real tile on the board') : null,
    ),
    h('div', { class: 'row' }, 'Set HP: ', hpUnit, hpValue, h('button', { class: 'mini', onclick: () => hpValue.value !== '' && push({ kind: 'hp', unit: (hpUnit as HTMLSelectElement).value, hp: Math.max(0, Number(hpValue.value)) }) }, 'Set')),
  );
}

/** The verdict per unit: "Lissa 24/17 from Mage". */
function safetyList(s: Safety, nm: (id: string) => string): HTMLElement {
  return h(
    'ul',
    { class: 'small pos-verdict' },
    ...s.units.map((u) => h('li', { class: u.dies ? 'neg' : '' }, `${u.dies ? '✗' : '✓'} ${nm(u.unit)} ${u.total === Infinity ? '∞' : u.total}/${u.hp}${u.threats.length ? ` from ${u.threats.map((t) => t.name).join(', ')}` : ' · out of reach'}${u.deathChance > 0 && !u.dies ? ` · crit ${pct(u.deathChance)}` : ''}`)),
    ...s.lethalCounters.map((c) => h('li', { class: 'neg' }, `✗ ${nm(c.unit)} attacking ${nm(c.enemy)}: its counter (${c.counter}) can kill at ${c.hp} HP`)),
  );
}

const TERRAIN_CLASS: Readonly<Record<number, string>> = { 0: 'wall', 2: 'woods', 3: 'sand', 4: 'hill', 5: 'water', 6: 'block', 7: 'fort', 8: 'fort', 14: 'fort' };

/** The board: terrain, the danger zone, units, planned moves and ghosts, predicted enemy moves. */
function boardView(b: Board, turn: TurnPlan | undefined, ui: UiState, redraw: () => void, live: boolean, push: (e: PositionEvent) => void): HTMLElement {
  const map = b.map;
  // The danger zone: tiles an awake (or woken) foe can strike; for one unit, those where the gang-up worst case kills it.
  // Awake enemies' reach; a sleeping group's, lighter (standing there wakes it).
  const threat = new Map<number, number>();
  const sleeping = new Set<number>();
  for (const e of liveEnemies(b)) for (const k of threatTiles(b, e)) e.awake ? threat.set(k, (threat.get(k) ?? 0) + 1) : sleeping.add(k);
  const who = ui.danger !== 'all' ? playerById(b, ui.danger) : undefined;
  const kills = new Set<number>();
  if (who) {
    for (const k of threat.keys()) {
      const at: Tile = [k % 64, Math.floor(k / 64)];
      const moved = { ...b, players: b.players.map((p) => (p.id === who.id ? { ...p, at } : p)) };
      const u = safety(moved).units.find((x) => x.unit === who.id);
      if (u?.dies) kills.add(k);
    }
  }
  const planned = new Map<number, number[]>();
  const ghosts = new Set<number>();
  turn?.actions.forEach((a, i) => {
    const k = tileKey(a.to);
    planned.set(k, [...(planned.get(k) ?? []), i + 1]);
    if (a.from[0] !== a.to[0] || a.from[1] !== a.to[1]) ghosts.add(tileKey(a.from));
  });
  const foeMoves = new Set((turn?.enemy ?? []).filter((a) => a.to[0] !== a.from[0] || a.to[1] !== a.from[1]).map((a) => tileKey(a.to)));
  // The equal tiles the game may pick instead (#273).
  const foeMaybe = new Set((turn?.enemy ?? []).flatMap((a) => (a.alternatives ?? []).map(tileKey)));
  // Trying a pair's back: its lead moves the pair, then Switch (#274, #291): the lead's reach either way.
  const trying = ui.trying?.unit ? playerById(b, ui.trying.unit) : undefined;
  const reach = trying ? actingTiles(b, trying.id) : undefined;
  const click = (at: Tile) => {
    // The outer ring isn't on the playable map (#271): nothing stands there.
    if (!live || !onMap(map, at)) return;
    if (ui.placing) {
      push({ kind: 'place', unit: ui.placing, to: at });
      ui.placing = undefined;
      return;
    }
    const p = leads(b).find((x) => x.at[0] === at[0] && x.at[1] === at[1]);
    if (ui.trying?.unit && (reach?.has(tileKey(at)) || (p && p.id !== ui.trying.unit))) {
      ui.trying = { unit: ui.trying.unit, tile: at };
      return redraw();
    }
    if (p) {
      ui.trying = { unit: p.id };
      return redraw();
    }
  };
  const cells: HTMLElement[] = [];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const k = tileKey([x, y]);
      const t = terrainAt(map, [x, y]);
      const p = b.players.find((q) => !q.carriedBy && q.hp > 0 && q.at[0] === x && q.at[1] === y);
      const e = liveEnemies(b).find((q) => q.at[0] === x && q.at[1] === y);
      const off = !onMap(map, [x, y]);
      const cls = [
        'cell',
        off ? 'off' : `t-${TERRAIN_CLASS[t?.category ?? 1] ?? 'plain'}`,
        who && kills.has(k) ? 'd-kill' : threat.has(k) ? 'd-hit' : sleeping.has(k) ? 'd-sleep' : '',
        ghosts.has(k) ? 'ghost' : '',
        foeMoves.has(k) ? 'foe-move' : foeMaybe.has(k) ? 'foe-maybe' : '',
        reach?.has(k) ? 'reach' : '',
        ui.trying?.tile && ui.trying.tile[0] === x && ui.trying.tile[1] === y ? 'picked' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const label = p ? `${p.name[0]}${p.back ? `+${playerById(b, p.back)?.name[0] ?? ''}` : ''}` : e ? e.name[0]!.toLowerCase() : '';
      cells.push(
        h(
          'div',
          { class: cls, title: `(${x},${y}) ${off ? 'off the map' : (t?.name ?? '')}${p ? ` · ${p.name} ${p.hp}/${p.fighter.stats.hp}` : ''}${e ? ` · ${e.name} ${e.hp}/${e.foe.stats.hp}${e.awake ? '' : ' (asleep)'}` : ''}`, onclick: () => click([x, y]) },
          label ? h('span', { class: p ? 'pc' : `pf${e?.awake ? '' : ' asleep'}` }, label) : null,
          planned.has(k) ? h('i', { class: 'step' }, planned.get(k)!.join(',')) : null,
        ),
      );
    }
  return h(
    'div',
    { ...guide('position-board'), class: 'pos-board-wrap' },
    h('div', { class: 'pos-board', style: `grid-template-columns: repeat(${map.width}, var(--cell))` }, ...cells),
    h('div', { class: 'muted small' }, `${who ? 'Dark red: the gang-up worst case kills ' + who.name + ' there. ' : ''}Red: an awake enemy can strike there; orange: a sleeping group’s reach (standing there wakes it); hatched: the edge, off the playable map. Numbers: this turn’s moves; dashed: where they start; red dash: predicted enemy moves; dotted: a tile the game may pick instead, as near. ${live ? 'Click a unit to try a move.' : ''}`),
  );
}

/** Try a move: the unit's menu at the picked tile, then the turn re-solved around it and compared with the plan. */
function tryPanel(ctx: PositionContext, b: Board, acted: readonly string[], plan: PositionPlan, ui: UiState, redraw: () => void, events: readonly PositionEvent[], units: string): HTMLElement | null {
  const t = ui.trying;
  const nm = (id: string) => playerById(b, id)?.name ?? enemyById(b, id)?.name ?? id;
  if (!t) return h('div', { ...guide('position-try'), class: 'muted small' }, 'Try a move: click one of your units on the board, then a tile.');
  const u = playerById(b, t.unit);
  if (!u) return null;
  const back = h('button', { class: 'ghost mini', onclick: () => ((ui.trying = undefined), redraw()) }, 'Back');
  // A pair: try it as it stands, or with the back leading after a Switch at the tile (#274, #291). A switched pair acts on its lead's action (a
  // unit that paired up can still take the lead), so it's the lead that must not have acted.
  const lead = u.carriedBy ? playerById(b, u.carriedBy) : undefined;
  if (acted.includes(lead?.id ?? u.id)) return h('div', { ...guide('position-try'), class: 'small' }, `${lead?.name ?? u.name} has acted this turn. `, back);
  const partner = u.back ?? lead?.id;
  const switchButton = partner
    ? h('button', { class: `mini${u.carriedBy ? ' on' : ''}`, onclick: () => ((ui.trying = { unit: partner }), redraw()) }, u.carriedBy ? `Switched: ${u.name} leads (undo)` : `Switch at the tile (${nm(partner)} leads)`)
    : null;
  if (!t.tile) return h('div', { ...guide('position-try'), class: 'small' }, `${u.name}${lead ? `, after ${lead.name} moves the pair and Switches` : ''}: click a tile ${lead ? `${lead.name} can` : 'it can'} reach (outlined). `, switchButton, back);
  if (!t.action) {
    const menu = menuAt(b, u.id, t.tile);
    return h(
      'div',
      { ...guide('position-try'), class: 'small pos-menu' },
      h('b', {}, `${u.name} at (${t.tile[0]},${t.tile[1]}):`),
      menu.length
        ? h(
            'ul',
            {},
            ...menu.map((a) =>
              h(
                'li',
                {},
                h('button', { class: 'linkish', onclick: () => ((ui.trying = { ...t, action: a }), redraw()) }, actionText(b, a).replace(/^[^:]*: /, '')),
                a.forecast ? h('span', { class: 'muted' }, ` · ${forecastText(a)}`) : null,
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'It can’t get there this turn.'),
      back,
      h('button', { class: 'ghost mini', onclick: () => ((ui.trying = { unit: u.id }), redraw()) }, 'Another tile'),
    );
  }
  const k = planKey(ctx.map, events, t.action, units);
  const mine = PLANS.get(k);
  if (!mine) {
    const p = solving(k, b, acted, t.action, ctx.risk, redraw);
    return h('div', { class: 'small muted' }, `Solving to the rout around ${actionText(b, t.action)}… ${p.expanded} lines explored${p.bestRout ? ` · best so far: turn ${p.bestRout}` : ''}`);
  }
  const c = compare(mine, plan, nm);
  return h(
    'div',
    { ...guide('position-try'), class: 'small pos-compare' },
    h('b', {}, `Your move: ${actionText(b, t.action)}`),
    c.good.length ? h('div', { class: 'pos' }, h('b', {}, 'Better: '), c.good.join('; ')) : null,
    c.bad.length ? h('div', { class: 'neg' }, h('b', {}, 'Worse: '), c.bad.join('; ')) : null,
    c.same.length ? h('div', { class: 'muted' }, h('b', {}, 'Same: '), c.same.join('; ')) : null,
    h(
      'div',
      { class: 'row' },
      // The button names the move it pins, so a comparison of two tiles can't apply the wrong one (#274).
      h('button', { class: 'primary mini', onclick: () => ((ui.mine = t.action), (ui.trying = undefined), redraw()) }, `Use my version: ${actionText(b, t.action)}`),
      back,
      h('button', { class: 'ghost mini', onclick: () => ((ui.trying = { unit: u.id }), redraw()) }, 'Try another tile'),
    ),
  );
}

