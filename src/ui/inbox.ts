/**
 * The inbox before the Lock (#204; spec #175, The inbox, Run view and Wishlist tab; variant D on
 * `prototype/wishlist-editing`): the fresh-run journey as one list of what needs the player, in order:
 *
 * 1. the headline flawless chance with its ± and the ceiling (the Run view's flawless section);
 * 2. Robin, the first decision (the Robin alternatives, #201: the best of each gender solved, the others with their
 *    seed's spouse and ceiling and a solve button, the no-Robin toggle), each solved Robin choosable;
 * 3. the search's improvements, as proposals to accept (the adopted plan becomes the proposal's) or dismiss;
 * 4. close calls: "no measurable difference; pick whichever you like";
 * 5. "Anything else you want different?": a search over every edit (`Engine.editChoices`), each with its cost going
 *    costing… → provisional → settled, made as pins or as a plan edit;
 * 6. your edits, with the pins' combined cost (one pin's on request) and an undo each;
 * 7. the wishlist in one collapsed line;
 * 8. Lock Robin and start, last: it locks only Robin, and the Run view carries on below.
 *
 * After the Lock (#206) the same inbox is titled "Before <map>: what needs you" (`afterLockReadout`): the headline,
 * units at risk (each with the one-click change that restores it), units behind (each with its re-solve proposal),
 * the re-solve's proposals (required once the adopted plan can no longer be met), this map's actions and checks (#209),
 * anything else and your edits; Next map below counts its open items as a nudge (`inboxNudge`), never a gate. What
 * changed (`whatChangedReadout`) sits above it after each recorded map until "got it".
 *
 * `inboxReadout` and `afterLockReadout` are what the page draws, from the solve's progress and the costs the worker has
 * read (tested); `inboxView` draws them and wires the worker's `edits` slot.
 */
import type { EditCost, Engine, Milestone, MilestoneMoves, MilestonePoint, MovedProposal, NewEdit, PinCost, Plan, PlanBreak, PlanPin, PlanProposal, PlanRobin, Reading, RosterUnit, Run, CloseCall } from '../engine';
import { EDIT_COST_BUDGET, FLAWLESS_SEED, STEP_BUDGET, adoptedOf, behindFixes, pinKey, proposalId, robinLock, rosterUnits, unitName, whatChanged, withDismissedChange, withDismissedProposal, withEdit, withRobinLock, withoutEdit } from '../engine';
import { STAT_LABELS } from '../game-data/stats';
import { chanceText, differenceText } from './chance';
import { h } from './dom';
import { startSolve, type UnitEditView } from './solve-client';
import { milestoneShort, pinText, type RunContext, type SolveProgress } from './run-page';

/** A Robin option as the page writes it: "Female, +Spd −Lck". */
export const robinName = (r: PlanRobin) => `${r.gender === 'M' ? 'Male' : 'Female'}, +${STAT_LABELS[r.asset]} −${STAT_LABELS[r.flaw]}`;

/** Before the Lock: no Robin Lock yet and no map recorded (Robin is made before the first map). */
export const beforeTheLock = (run: Run): boolean => !robinLock(run) && !run.entries.some((e) => e.map !== 'other');

/** Matches shown at once in "anything else": each is costed, so the search is narrowed rather than scrolled. */
export const SHOWN_MATCHES = 8;

/** What the inbox reads besides the run: the solve's progress, the edits listed and the costs read so far. */
export type InboxState = {
  readonly progress: SolveProgress | undefined;
  /** Every edit of the adopted plan (undefined: not listed yet). */
  readonly choices: readonly UnitEditView[] | undefined;
  /** Each edit's cost as last read, by its key. */
  readonly costs: ReadonlyMap<string, EditCost>;
  /** The "anything else" search. */
  readonly query: string;
  /** One edit's pins' own cost, read on request, by `editPinsKey`. */
  readonly pinCosts: ReadonlyMap<string, PinCost>;
};

export type InboxRow = { readonly key: string; readonly text: string };

export type InboxItem =
  | { readonly kind: 'headline' }
  | { readonly kind: 'robin' }
  | { readonly kind: 'proposals'; readonly title: string; readonly rows: readonly (InboxRow & { readonly proposal: PlanProposal })[] }
  | { readonly kind: 'close-calls'; readonly title: string; readonly rows: readonly (InboxRow & { readonly call: CloseCall })[] }
  | {
      readonly kind: 'anything-else';
      readonly title: string;
      readonly placeholder: string;
      /** The matches shown, each with its cost, how it's made (a pin or a plan edit) and whether it can be made yet. */
      readonly rows: readonly (InboxRow & { readonly label: string; readonly cost: string; readonly apply: 'pin' | 'edit'; readonly ready: boolean })[];
      readonly note: string;
    }
  | {
      readonly kind: 'your-edits';
      readonly title: string;
      /** Each edit, its cost (as made, or its pins' own once read) and whether its pins' own cost can be asked for. */
      readonly rows: readonly { readonly index: number; readonly text: string; readonly cost: string | undefined; readonly ask: boolean }[];
      readonly pinCost: string | undefined;
      readonly note: string;
    }
  | { readonly kind: 'wishlist'; readonly summary: string; readonly lines: readonly string[] }
  | { readonly kind: 'lock'; readonly text: string; readonly robin: PlanRobin | undefined };

export type Inbox = { readonly title: string; readonly items: readonly InboxItem[] };

/**
 * An edit's cost as the inbox writes it: "costing…" until the worker's first reading, then provisional ("≈ −1.2 ±3.0,
 * provisional") until settled: "−1.2 ±0.4", or "no measurable difference (−0.2 ±0.3)" for a close call.
 */
export function costText(c: EditCost | undefined): string {
  if (!c) return 'costing…';
  if (!c.settled) return `≈ ${differenceText(c.gain, c.margin)}, provisional`;
  return differenceText(c.gain, c.margin, c.verdict === 'close');
}

/** An edit's pins as one key: its own cost is read and kept by it. */
export const editPinsKey = (pins: readonly PlanPin[]) => pins.map(pinKey).join(',');

/**
 * The plan the player holds: the adopted plan (none when its Robin contradicts the run facts, `adoptedOf`), else the
 * one the solve started from (the seed), else its best.
 */
export const heldPlan = (run: Run, progress: SolveProgress | undefined): Plan | undefined => adoptedOf(run) ?? progress?.start ?? progress?.best;

/** The Robin "Lock Robin and start" locks: the run facts' when all set, else the held plan's. */
export function robinToLock(run: Run, progress: SolveProgress | undefined): PlanRobin | undefined {
  const f = run.roster.run;
  if (f.gender && f.asset && f.flaw) return { gender: f.gender, asset: f.asset, flaw: f.flaw };
  return heldPlan(run, progress)?.robin;
}

/** Every term of the search (split on spaces) in the edit's words, ignoring case. */
const matches = (query: string, label: string) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = label.toLowerCase();
  return terms.length > 0 && terms.every((t) => text.includes(t));
};

/** The edits "anything else" shows for a search, at most `SHOWN_MATCHES`. */
export const shownChoices = (choices: readonly UnitEditView[] | undefined, query: string): readonly UnitEditView[] =>
  (choices ?? []).filter((c) => matches(query, c.label)).slice(0, SHOWN_MATCHES);

/** The inbox before the Lock, item by item in the order it's drawn (see the module comment). */
export function inboxReadout(run: Run, state: InboxState): Inbox {
  const { progress } = state;
  const gender = run.roster.run.gender;
  const plan = heldPlan(run, progress);
  // Robin by name alone; the others as the plan's Robin's gender names them (Morgan).
  const name = (u: RosterUnit) => unitName(u, u === 'robin' ? null : (gender ?? plan?.robin.gender));
  const items: InboxItem[] = [{ kind: 'headline' }, { kind: 'robin' }];

  const dismissed = new Set(run.dismissedProposals ?? []);
  const proposals = (progress?.proposals ?? []).filter((p) => !dismissed.has(proposalId(p)));
  if (proposals.length)
    items.push({
      kind: 'proposals',
      title: 'The search found better',
      rows: proposals.map((p) => ({ key: proposalId(p), text: `${p.edits.join('; ')}: ${differenceText(p.gain, p.margin)}`, proposal: p })),
    });
  const calls = progress?.closeCalls ?? [];
  if (calls.length)
    items.push({
      kind: 'close-calls',
      title: 'Close calls: no measurable difference; pick whichever you like',
      rows: calls.map((c) => ({ key: c.key, text: `${c.label}: ${differenceText(c.gain, c.margin, true)}`, call: c })),
    });

  items.push(anythingElseItem(state), yourEditsItem(run, state));

  const units = plan?.wishlist.units ?? [];
  // One line per pair (the Lead's), or per unit alone.
  const lines = units.flatMap((w) => (w.position === 'back' && w.partner && units.some((x) => x.unit === w.partner) ? [] : [w.partner ? `${name(w.unit)} + ${name(w.partner)}` : `${name(w.unit)}, solo`]));
  const reserves = plan?.wishlist.reserves ?? [];
  if (reserves.length) lines.push(`Reserves: ${reserves.map((r) => `${name(r.unit)}${r.covers ? ` (covers ${name(r.covers)})` : ''}`).join('; ')}`);
  items.push({ kind: 'wishlist', summary: plan ? `The wishlist (${units.length} fielded, ${reserves.length} reserves)` : 'The wishlist: working it out…', lines });

  const robin = robinToLock(run, progress);
  items.push({
    kind: 'lock',
    robin,
    text: robin
      ? `Lock Robin (${robinName(robin)}) and start the run. This locks only Robin; the rest of the wishlist stays editable and re-solves after every map.`
      : 'Lock Robin and start: waiting for the plan’s Robin.',
  });
  return { title: 'Before the run: what needs you', items };
}

/** "Anything else you want different?" (#204): the search over every edit, the matches shown each with its cost. */
function anythingElseItem(state: InboxState): Extract<InboxItem, { kind: 'anything-else' }> {
  const q = state.query.trim();
  const all = state.choices ? state.choices.filter((c) => matches(q, c.label)) : [];
  const shown = all.slice(0, SHOWN_MATCHES);
  return {
    kind: 'anything-else',
    title: 'Anything else you want different?',
    placeholder: 'a unit, a marriage, a skill… (try: Frederick, Olivia, Luna)',
    rows: shown.map((c) => ({ key: c.key, label: c.label, text: c.label, cost: costText(state.costs.get(c.key)), apply: c.pins.length ? 'pin' : 'edit', ready: !!c.pins.length || state.costs.has(c.key) })),
    note: !state.choices
      ? 'Listing every edit: once the search has read the plan.'
      : !q
        ? `Search every edit (${state.choices.length}): a unit, a marriage, a skill, keep someone in or out, a side goal. Each is costed against your plan.`
        : !all.length
          ? 'No edits match.'
          : all.length > shown.length
            ? `${all.length - shown.length} more: narrow the search.`
            : '',
  };
}

/** Your edits (#204): each with its cost and undo, and the pins' cost together. */
function yourEditsItem(run: Run, state: InboxState): Extract<InboxItem, { kind: 'your-edits' }> {
  const edits = run.edits ?? [];
  const pc = state.progress?.pinCost;
  return {
    kind: 'your-edits',
    title: 'Your edits',
    rows: edits.map((e, index) => {
      const own = e.pins?.length ? state.pinCosts.get(editPinsKey(e.pins)) : undefined;
      const cost = own
        ? `costs ${differenceText(own.cost, own.margin, own.verdict === 'close' || own.verdict === 'unclear')}`
        : e.cost
          ? `${e.accepted ? 'gained' : 'cost when made'} ${e.cost.verdict === 'unclear' ? '≈ ' : ''}${differenceText(e.cost.gain, e.cost.margin, e.cost.verdict === 'close')}`
          : undefined;
      const how = e.accepted ? 'accepted' : e.pins?.length ? (e.pins.length === 1 ? 'pin' : `${e.pins.length} pins`) : 'plan edit';
      return { index, text: `${e.label} (${how})`, cost, ask: !!e.pins?.length && !own };
    }),
    pinCost: pc?.pins.length
      ? `Your ${pc.pins.length === 1 ? 'pin costs' : `${pc.pins.length} pins cost`} ${differenceText(pc.cost, pc.margin, pc.verdict === 'close' || pc.verdict === 'unclear')}: the best plan found with ${pc.pins.length === 1 ? 'it' : 'them'} lifted, less the best found with ${pc.pins.length === 1 ? 'it' : 'them'}`
      : undefined,
    note: edits.length ? 'Undo lifts an edit’s pins, or goes back to the plan before it.' : 'No edits yet. Everything is the tool’s proposal.',
  };
}

// ---- after the Lock (#206) ----

/** A row of the inbox after the Lock that the player acts on: an edit to make, or a proposal to accept or dismiss. */
export type FixRow = InboxRow & {
  /** A re-solve proposal to accept (its plan adopted) or dismiss. */
  readonly proposal?: PlanProposal;
  /** An edit to make in one click (a suggested change's span pin, or a plan edit), with its words. */
  readonly edit?: NewEdit;
  /** Marked required: the adopted roadmap can no longer be met. */
  readonly required?: boolean;
};

export type AfterLockItem =
  | { readonly kind: 'headline' }
  | { readonly kind: 'at-risk'; readonly title: string; readonly rows: readonly (InboxRow & { readonly fix: FixRow | undefined })[] }
  | { readonly kind: 'behind'; readonly title: string; readonly rows: readonly (InboxRow & { readonly fixes: readonly FixRow[]; readonly note: string })[] }
  | { readonly kind: 'resolve'; readonly title: string; readonly required: boolean; readonly reasons: readonly string[]; readonly rows: readonly FixRow[]; readonly note: string; readonly fresh: boolean }
  | { readonly kind: 'actions'; readonly title: string; readonly rows: readonly InboxRow[] }
  | { readonly kind: 'checks'; readonly title: string; readonly rows: readonly InboxRow[] }
  | Extract<InboxItem, { kind: 'anything-else' | 'your-edits' }>;

export type AfterLockInbox = {
  readonly title: string;
  readonly items: readonly AfterLockItem[];
  /** Items above still open (at risk, behind, proposals), and Next map's nudge for them: never a gate. */
  readonly open: number;
  readonly nudge: string | undefined;
};

/**
 * The checks the map offers (#209 fills it; spec: "this map's actions and checks"): each a situation that settles an
 * open rule. None yet.
 */
export function mapChecks(_engine: Engine, _run: Run, _key: string): readonly InboxRow[] {
  return [];
}

/** Each map key on the map order with its short label ("Chapter 5", "Apotheosis (secret route)"). */
function mapLabels(engine: Engine, run: Run): Map<string, string> {
  const maps = new Map(engine.maps().map((m) => [m.id, m.label]));
  return new Map(engine.mapOrder(run).steps.map((s) => [s.key, `${maps.get(s.map) ?? s.map}${s.secret ? ' (secret route)' : ''}`]));
}

/**
 * What the inbox reads of a plan on a run (its milestones, breaks, a proposal's moves), worked out once: it redraws on
 * every reply, and a run or plan is replaced, never edited.
 */
const MEMO = new WeakMap<Run, WeakMap<Plan, Map<string, unknown>>>();
function memo<T>(run: Run, plan: Plan, key: string, work: () => T): T {
  let byPlan = MEMO.get(run);
  if (!byPlan) MEMO.set(run, (byPlan = new WeakMap()));
  let m = byPlan.get(plan);
  if (!m) byPlan.set(plan, (m = new Map()));
  if (!m.has(key)) m.set(key, work());
  return m.get(key) as T;
}
const milestonesOf = (engine: Engine, run: Run, plan: Plan) => memo(run, plan, 'milestones', () => engine.milestones(run, plan));
const MOVES = new WeakMap<Run, WeakMap<Plan, WeakMap<Plan, MilestoneMoves>>>();
const movesOf = (engine: Engine, run: Run, from: Plan, to: Plan): MilestoneMoves => {
  let byFrom = MOVES.get(run);
  if (!byFrom) MOVES.set(run, (byFrom = new WeakMap()));
  let byTo = byFrom.get(from);
  if (!byTo) byFrom.set(from, (byTo = new WeakMap()));
  let m = byTo.get(to);
  if (!m) byTo.set(to, (m = engine.milestoneMoves(run, from, to)));
  return m;
};

/** A milestone in a few words for the moves list: "Lissa's Luna before Chapter 9". */
function milestoneWords(m: Milestone, name: (u: RosterUnit | 'maiden') => string, at = m.at): string {
  const when = at.when === 'end' ? `by the end of ${at.label}` : `before ${at.label}`;
  switch (m.kind) {
    case 'support':
      return `${name(m.pair[0])} and ${name(m.pair[1])} at ${m.rank} ${when}`;
    case 'skill':
      return `${name(m.unit)}’s ${m.name} ${when}`;
    case 'recruit':
      return `${name(m.child)} recruited on ${at.label}`;
    case 'class':
      return `${name(m.unit)} as ${m.className} ${when}`;
  }
}

/** What a proposal does to the adopted plan's milestones: "adds …; drops …; moves …". */
function movesText(moves: MilestoneMoves, name: (u: RosterUnit | 'maiden') => string): string {
  const list = (ms: readonly string[]) => (ms.length < 2 ? ms.join('') : `${ms.slice(0, -1).join(', ')} and ${ms[ms.length - 1]}`);
  return [
    moves.added.length ? `adds ${list(moves.added.map((m) => milestoneWords(m, name)))}` : '',
    moves.dropped.length ? `drops ${list(moves.dropped.map((m) => milestoneWords(m, name)))}` : '',
    moves.moved.length ? `moves ${list(moves.moved.map((x) => `${milestoneWords(x.milestone, name)} (was ${x.from.label})`))}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/**
 * This map's actions (spec: "a support's earliest start, a skill to equip, a seal to carry"): the adopted plan's
 * milestones whose step falls on the next map, each in the game's words.
 */
function mapActions(ms: readonly Milestone[], name: (u: RosterUnit | 'maiden') => string): InboxRow[] {
  const here = (p: MilestonePoint | undefined) => p?.index === 0;
  return ms.flatMap((m): InboxRow[] => {
    switch (m.kind) {
      case 'support': {
        const pair = `${name(m.pair[0])} and ${name(m.pair[1])}`;
        const goal = m.wedding ? `for Chrom’s wedding at the end of ${m.at.label}` : `for ${m.rank} ${m.at.when === 'end' ? 'by the end of' : 'before'} ${m.at.label}`;
        if (m.nonStarter) return [];
        if (here(m.window.latest)) return [{ key: `${m.id}:latest`, text: `Field ${pair} together from this map: it’s their last start ${goal}` }];
        if (here(m.window.earliest)) return [{ key: `${m.id}:earliest`, text: `${pair} can start fighting together here: their earliest start ${goal}${m.window.latest ? ` (latest ${m.window.latest.label})` : ''}` }];
        return [];
      }
      case 'skill':
        if (m.wasted || !here(m.at)) return [];
        return m.for.kind === 'pass'
          ? [{ key: m.id, text: `Equip ${m.name} on ${name(m.unit)} in the last active slot before entering: ${name(m.for.child)} inherits it` }]
          : [{ key: m.id, text: `${name(m.unit)} needs ${m.name} equipped for this map` }];
      case 'recruit':
        return here(m.at) ? [{ key: m.id, text: `Recruit ${name(m.child)} on this map` }] : [];
      case 'class': {
        const seal = m.seal === 'master' ? 'Master Seal' : 'Second Seal';
        const rows: InboxRow[] = [];
        if (m.source.how === 'found' && here(m.source.at)) rows.push({ key: `${m.id}:found`, text: `Carry away the ${seal} on this map (${m.source.note}): ${name(m.unit)} needs it for ${m.className}` });
        if (m.source.how === 'armory' && here(m.source.at)) rows.push({ key: `${m.id}:buy`, text: `Buy a ${seal} in this map’s preparations for ${name(m.unit)}’s change to ${m.className}` });
        if (here(m.at) && m.at.when === 'start') rows.push({ key: m.id, text: `Change ${name(m.unit)} to ${m.className} with a ${seal} before this map` });
        return rows;
      }
    }
  });
}

/** Why the adopted roadmap can no longer be met, in words. */
function breakText(b: PlanBreak, name: (u: RosterUnit | 'maiden') => string): string {
  switch (b.kind) {
    case 'lost':
      return `${name(b.unit)} ${b.state === 'dead' ? 'died' : 'was missed'}`;
    case 'married':
      return `${name(b.couple[0])} married ${name(b.couple[1])}, off the plan`;
    case 'non-starter':
      return `${name(b.pair[0])} and ${name(b.pair[1])} can’t reach their support in the maps left`;
  }
}

/**
 * The inbox after the Lock (#206; spec #175, The inbox, Run view and Wishlist tab), titled "Before <map>: what needs
 * you", item by item in the order it's drawn: the headline; the units at risk, each with its milestone, chance and the
 * one-click change that restores it; the units behind, each with its re-solve proposal (roadmap-only first, a wishlist
 * change only when it beats that); the re-solve's proposals (after the last recorded map), each with the milestones it
 * adds, drops or moves, marked required once the adopted roadmap can no longer be met; this map's actions; the checks
 * it offers (#209); anything else; your edits. Open items (at risk, behind, proposals) read as a nudge on Next map.
 */
export function afterLockReadout(engine: Engine, run: Run, state: InboxState): AfterLockInbox {
  const { progress } = state;
  const plan = heldPlan(run, progress);
  const gender = run.roster.run.gender ?? plan?.robin.gender;
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  const labels = mapLabels(engine, run);
  const next = engine.mapOrder(run).steps[0];
  const title = next ? `Before ${labels.get(next.key)}: what needs you` : 'The run: what needs you';
  const items: AfterLockItem[] = [{ kind: 'headline' }];
  const ms = plan ? milestonesOf(engine, run, plan) : [];
  const readings = progress?.readings?.readings ?? [];
  const dismissed = new Set(run.dismissedProposals ?? []);
  const proposals = (progress?.proposals ?? []).filter((p) => !dismissed.has(proposalId(p)));
  const moved: MovedProposal[] = plan ? proposals.map((p) => ({ proposal: p, moves: movesOf(engine, run, plan, p.plan) })) : [];
  const breaks = plan ? memo(run, plan, 'breaks', () => engine.planBreaks(run, plan)) : [];
  const required = breaks.length > 0;
  const proposalRow = (p: PlanProposal, how = ''): FixRow => ({
    key: proposalId(p),
    text: `${how}${p.edits.join('; ')}: ${differenceText(p.gain, p.margin)}`,
    proposal: p,
    ...(required ? { required: true } : {}),
  });
  const worstOf = (r: Reading) => {
    const m = r.worst && ms.find((x) => x.id === r.worst!.id);
    return !r.worst ? 'no milestones left' : `${m ? milestoneShort(m, r.unit, gender) : r.worst.id} ${r.worst.reached ? chanceText(r.worst.chance) : '(no run reaches it with nobody lost)'}`;
  };

  const atRisk = readings.filter((r) => r.reading === 'at-risk');
  if (atRisk.length)
    items.push({
      kind: 'at-risk',
      title: 'At risk: one change brings each back to 80%',
      rows: atRisk.map((r) => {
        const c = r.change;
        const words = c && pinText(c.pin, gender, labels);
        const made = c && plan ? memo(run, plan, `fix:${JSON.stringify(c.pin)}`, () => engine.suggestedEdit(run, plan, c.pin)) : undefined;
        const edit: NewEdit | undefined = made && words ? { label: capital(words), ...made } : undefined;
        return {
          key: `at-risk:${r.unit}`,
          text: `${name(r.unit)}: ${worstOf(r)}`,
          fix: c && edit ? { key: `fix:${r.unit}`, text: `${capital(words!)}: ${chanceText(c.chance)}${c.flawless ? `, flawless chance ${signed(c.flawless)}` : ''}`, edit } : r.pending ? { key: `fix:${r.unit}`, text: 'Reading the changes that could bring it back…' } : undefined,
        };
      }),
    });

  const behind = readings.filter((r) => r.reading === 'behind');
  if (behind.length && plan)
    items.push({
      kind: 'behind',
      title: 'Behind: a re-solve, the roadmap first',
      rows: behind.map((r) => {
        const f = behindFixes(r.unit, plan, moved);
        const fixes = [...(f.roadmap ? [proposalRow(f.roadmap, 'Roadmap: ')] : []), ...(f.wishlist ? [proposalRow(f.wishlist, 'Wishlist change: ')] : [])];
        const why = r.why === 'non-starter' ? 'a non-starter in the maps left' : r.why === 'deadline' ? 'its deadline map has started' : 'no single change brings it back to 80%';
        const note = fixes.length ? '' : !progress?.done ? 'Re-solving: its proposal comes when the search finds one.' : 'The re-solve found no plan that moves its milestones and does better.';
        return { key: `behind:${r.unit}`, text: `${name(r.unit)}: ${worstOf(r)} · ${why}`, fixes, note };
      }),
    });

  const after = [...run.entries].reverse().find((e) => e.map !== 'other');
  const afterLabel = after && engine.maps().find((m) => m.id === after.map)?.label;
  if (proposals.length || required)
    items.push({
      kind: 'resolve',
      title: `${afterLabel ? `The re-solve after ${afterLabel}` : 'The search'} found better${required ? ': required before the next map' : ''}`,
      required,
      reasons: breaks.map((b) => breakText(b, name)),
      rows: moved.map(({ proposal, moves }) => {
        const m = movesText(moves, name);
        return { ...proposalRow(proposal), text: `${proposalRow(proposal).text}${m ? ` · ${m}` : ''}` };
      }),
      note: required
        ? `Your plan can no longer be met (${breakText(breaks[0]!, name)}${breaks.length > 1 ? `, and ${breaks.length - 1} more` : ''}): accept a re-solve before you play on.${!proposals.length ? (progress?.done ? ' The search found none: take a fresh plan for the run as it stands.' : ' Re-solving…') : ''}`
        : 'Nothing changes until you accept one.',
      fresh: required && !proposals.length && !!progress?.done,
    });

  if (next && plan) {
    const actions = mapActions(ms, name);
    if (actions.length) items.push({ kind: 'actions', title: `On ${labels.get(next.key)}`, rows: actions });
    const checks = mapChecks(engine, run, next.key);
    if (checks.length) items.push({ kind: 'checks', title: `Checks ${labels.get(next.key)} offers`, rows: checks });
  }

  items.push(anythingElseItem(state), yourEditsItem(run, state));
  const open = atRisk.length + behind.length + proposals.length;
  return { title, items, open, nudge: open ? `${open} item${open === 1 ? '' : 's'} above still need${open === 1 ? 's' : ''} you (you can play anyway)` : undefined };
}

/** Points of chance with a sign: "+1.2", "−0.4". */
const signed = (p: number) => `${p < 0 ? '−' : '+'}${Math.abs(p * 100).toFixed(1)}`;

/** A chance with its ±: "42.0% ±5.0". */
const withMargin = (c: { readonly chance: number; readonly margin: number }) => `${chanceText(c.chance)} ±${(c.margin * 100).toFixed(1)}`;

const READING_WORDS = { 'on-track': 'on track', 'at-risk': 'at risk', behind: 'behind' } as const;

export type WhatChangedReadout = { readonly entry: string; readonly title: string; readonly chance: string; readonly exp: readonly string[]; readonly readings: readonly string[]; readonly improvements: string };

/**
 * What changed (#206), as the card above the inbox writes it after a recorded map: the flawless chance before (kept when
 * the map was recorded) and after (the re-solve's headline), each unit's EXP against the forecast, the readings that
 * moved, and the improvements the re-solve found. Undefined once dismissed ("got it"), or with no map recorded.
 */
export function whatChangedReadout(engine: Engine, run: Run, progress: SolveProgress | undefined): WhatChangedReadout | undefined {
  const w = whatChanged(run, { ...(progress ? { chance: progress.chance } : {}), ...(progress?.readings ? { readings: progress.readings } : {}) });
  if (!w || w.dismissed) return undefined;
  const e = run.entries.find((x) => x.id === w.entry)!;
  const label = e.map === 'other' ? (e.label ?? 'the map logged') : (engine.maps().find((m) => m.id === w.map)?.label ?? w.map);
  const gender = run.roster.run.gender;
  const name = (u: RosterUnit) => unitName(u, gender);
  const lv = (x: number) => x.toFixed(1);
  const now = w.after ? `${withMargin(w.after)} now` : 'working it out…';
  const chance = w.before
    ? `Flawless chance: ${withMargin(w.before)} before → ${now}${w.after ? ` (${signed(w.after.chance - w.before.chance)} points)` : ''}`
    : `Flawless chance: ${now} (not worked out before the map was recorded)`;
  // A unit with no EXP forecast or earned (a Back that never struck, a unit left idle) has nothing to compare.
  const exp = w.exp.filter((x) => x.forecast >= 0.5 || x.earned).map(
    (x) =>
      `${name(x.unit)}: ${x.earned === undefined ? 'EXP not comparable (a class change)' : `${x.earned} EXP`} against ${Math.round(x.forecast)} forecast; level ${lv(x.level)}, ${x.against === 'inside' ? 'inside' : x.against === 'below' ? 'below' : 'above'} the forecast’s ${lv(x.spread.low)}–${lv(x.spread.high)}`,
  );
  const readings = w.readings.map((r) => `${name(r.unit)}: ${READING_WORDS[r.before]}${r.wasPending ? '?' : ''} → ${READING_WORDS[r.after]}${r.pending ? '?' : ''}`);
  const dismissed = new Set(run.dismissedProposals ?? []);
  const found = (progress?.proposals ?? []).filter((p) => !dismissed.has(proposalId(p))).length;
  const improvements = !progress ? 'Re-solving from your plan…' : found ? `The re-solve found ${found} improvement${found === 1 ? '' : 's'}: in the inbox below.` : progress.done ? 'The re-solve found no improvement on your plan.' : 'Re-solving from your plan…';
  return { entry: w.entry, title: `What changed on ${label}`, chance, exp, readings, improvements };
}

// ---- the page ----

/**
 * The inbox's page state, for the run as the edits read it (its facts, log, pins, side goals and adopted plan): the
 * edits listed, their costs and edited plans, the pins' own costs, and the search (kept across runs).
 */
type PageState = {
  key: string;
  choices?: readonly UnitEditView[];
  costs: Map<string, EditCost>;
  edited: Map<string, Plan>;
  pinCosts: Map<string, PinCost>;
  /** The keys asked of the `edits` slot now. */
  asked: Set<string>;
  listing: boolean;
};
let page: PageState | undefined;
let query = '';
/** The solve's latest progress, by run: the headline's reply handler hands it over (`inboxProgress`). */
const progressOf = new WeakMap<Run, SolveProgress>();
/** The live parts of the inbox on the page now: redrawn in place as replies land. */
let live: { run: Run; ctx: RunContext; parts: { el: HTMLElement; draw: () => HTMLElement }[] } | undefined;

const stateKey = (run: Run) => JSON.stringify([run.roster.run, run.entries.map((e) => e.id), run.pins ?? [], run.sideGoals ?? {}, run.adopted ?? null]);

/** Bumped on every redraw: the inbox is read once per redraw, whichever parts draw it. */
let version = 0;

function redraw(): void {
  version++;
  if (!live) return;
  for (const p of live.parts) {
    if (!p.el.isConnected) continue;
    const next = p.draw();
    p.el.replaceWith(next);
    p.el = next;
  }
}

/** The headline's solve moved on: its proposals, close calls, pin cost and plan land in the inbox. */
export function inboxProgress(run: Run, progress: SolveProgress): void {
  progressOf.set(run, progress);
  if (live?.run === run) {
    listEdits(live.ctx, progress);
    redraw();
  }
}

const rolesOf = (ctx: RunContext) => (ctx.roleOf ? Object.fromEntries(rosterUnits(ctx.run.roster.run).map((u) => [u.id, ctx.roleOf!(u.id)])) : undefined);

/**
 * Lists every edit on the worker's `edits` slot once the solve has read the plan (its riskiest maps name the lineup and
 * pair edits), and costs the matches shown that aren't costed yet, provisional first.
 */
function listEdits(ctx: RunContext, progress: SolveProgress | undefined): void {
  const s = page;
  if (!s || !ctx.assumptions || !progress) return;
  const keys = shownChoices(s.choices, query).map((c) => c.key).filter((k) => !s.costs.get(k)?.settled);
  if (s.choices && (!keys.length || keys.every((k) => s.asked.has(k)))) return;
  if (!s.choices && s.listing) return;
  const riskiest = progress.chance.maps
    .filter((m) => m.noDeath !== undefined && m.noDeath < 1)
    .sort((a, b) => a.noDeath! - b.noDeath!)
    .slice(0, 3)
    .map((m) => m.key);
  const pins = ctx.pins?.();
  const roles = rolesOf(ctx);
  const plan = heldPlan(ctx.run, progress);
  s.listing = true;
  s.asked = new Set(keys);
  startSolve(
    {
      kind: 'all-edits',
      assumptions: ctx.assumptions,
      run: ctx.run,
      seed: FLAWLESS_SEED,
      ...(plan ? { plan } : {}),
      ...(pins ? { pins } : {}),
      ...(roles ? { roles } : {}),
      riskiest,
      keys,
      budgets: [EDIT_COST_BUDGET.provisional, EDIT_COST_BUDGET.settled],
    },
    (reply) => {
      if (page !== s) return;
      if (reply.kind === 'edits') {
        s.choices = reply.edits;
        s.listing = false;
      } else if (reply.kind === 'edit-cost') {
        s.costs.set(reply.key, reply.cost);
        if (reply.edited) s.edited.set(reply.key, reply.edited);
      } else return;
      if (reply.done) s.asked = new Set();
      redraw();
      // Listed with nothing asked yet: cost what the search shows now.
      if (reply.kind === 'edits' && !keys.length) listEdits(ctx, progressOf.get(ctx.run));
    },
    'edits',
  );
}

/** One edit's pins' own cost (#200, on request), on the `edits` slot. */
function askPinCost(ctx: RunContext, pins: readonly PlanPin[]): void {
  const s = page;
  if (!s || !ctx.assumptions) return;
  const all = ctx.pins?.();
  const roles = rolesOf(ctx);
  const plan = heldPlan(ctx.run, progressOf.get(ctx.run));
  s.asked = new Set();
  startSolve(
    { kind: 'one-pin-cost', assumptions: ctx.assumptions, run: ctx.run, seed: FLAWLESS_SEED, budget: STEP_BUDGET, lift: pins, ...(plan ? { plan } : {}), ...(all ? { pins: all } : {}), ...(roles ? { roles } : {}) },
    (reply) => {
      if (page !== s || reply.kind !== 'pin-cost') return;
      s.pinCosts.set(editPinsKey(pins), reply.cost);
      redraw();
    },
    'edits',
  );
}

type AnyItem = InboxItem | AfterLockItem;

/**
 * The inbox, drawn: `headline` (the flawless section) and `robin` (the Robin alternatives' card, before the Lock) are
 * the page's own live sections; the rest is drawn here from `inboxReadout` before the Lock, `afterLockReadout` after it
 * (What changed above it, #206), and redrawn as the worker replies.
 */
export function inboxView(ctx: RunContext, headline: HTMLElement, robin: HTMLElement | null): HTMLElement {
  const { run } = ctx;
  const key = stateKey(run);
  if (page?.key !== key) page = { key, costs: new Map(), edited: new Map(), pinCosts: new Map(), asked: new Set(), listing: false };
  const s = page;
  const after = !beforeTheLock(run);
  const state = (): InboxState => ({ progress: progressOf.get(run), choices: s.choices, costs: s.costs, query, pinCosts: s.pinCosts });
  const readAfter = () => afterLockReadout(ctx.engine, run, state());
  let cached: { readonly version: number; readonly inbox: { readonly title: string; readonly items: readonly AnyItem[] } } | undefined;
  const read = () => {
    if (cached?.version !== version) cached = { version, inbox: after ? readAfter() : inboxReadout(run, state()) };
    return cached.inbox;
  };
  const item = <K extends AnyItem['kind']>(kind: K) => read().items.find((i): i is Extract<AnyItem, { kind: K }> => i.kind === kind);
  const set = (next: Run) => ctx.setRun(next);
  const accept = (p: PlanProposal) => set(withEdit(run, { label: p.edits.join('; '), plan: p.plan, accepted: true, cost: { gain: p.gain, margin: p.margin, verdict: 'better' } }));
  /** A re-solve proposal's or one-click fix's row: Accept (or the fix's button) and Dismiss. */
  const fixRow = (r: FixRow, action = 'Accept'): HTMLElement =>
    h(
      'div',
      { class: `row small${r.required ? ' required' : ''}` },
      r.required ? h('span', { class: 'chip warn small' }, 'required') : null,
      h('span', {}, r.text),
      r.proposal ? h('button', { class: 'mini', title: 'Adopt this plan: the search carries on from it', onclick: () => accept(r.proposal!) }, action) : null,
      r.proposal ? h('button', { class: 'mini ghost', title: 'Hide it: the plan stays as it is', onclick: () => set(withDismissedProposal(run, r.key)) }, 'Dismiss') : null,
      r.proposal
        ? null
        : r.edit
          ? h('button', { class: 'mini', title: r.edit.pins?.length ? 'Pin it: a span pin every plan keeps (undo it in Your edits)' : 'Make it: your plan with this EXP priority (undo it in Your edits)', onclick: () => set(withEdit(run, r.edit!)) }, r.edit.pins?.length ? 'Pin it' : 'Make it')
          : null,
    );

  /** After the Lock: at risk, behind, the re-solve's proposals, this map's actions and checks. */
  const needs = (): HTMLElement => {
    const risk = item('at-risk');
    const behind = item('behind');
    const resolve = item('resolve');
    const actions = item('actions');
    const checks = item('checks');
    const list = (i: { readonly title: string; readonly rows: readonly InboxRow[] } | undefined, cls: string) =>
      i ? h('div', { class: `banner ${cls}` }, h('b', {}, i.title), h('ul', { class: 'small' }, ...i.rows.map((r) => h('li', {}, r.text)))) : null;
    return h(
      'div',
      { class: 'inbox-decisions' },
      resolve
        ? h(
            'div',
            { class: `banner proposals${resolve.required ? ' required' : ''}` },
            h('b', {}, resolve.title),
            resolve.reasons.length ? h('div', { class: 'small' }, `Can no longer be met: ${resolve.reasons.join('; ')}.`) : null,
            ...resolve.rows.map((r) => fixRow(r)),
            h('span', { class: 'muted small' }, resolve.note),
            resolve.fresh
              ? h('button', { class: 'mini', title: 'Adopt the seed plan for the run as recorded: undo it in Your edits', onclick: () => set(withEdit(run, { label: 'A fresh plan for the run as recorded', plan: ctx.engine.adoptedPlan(withoutAdopted(run), freshOptions(ctx)), accepted: true })) }, 'Take a fresh plan')
              : null,
          )
        : null,
      risk
        ? h(
            'div',
            { class: 'banner at-risk' },
            h('b', {}, risk.title),
            ...risk.rows.map((r) => h('div', { class: 'inbox-unit' }, h('div', { class: 'small' }, r.text), r.fix ? (r.fix.edit ? fixRow(r.fix) : h('div', { class: 'muted small' }, r.fix.text)) : null)),
          )
        : null,
      behind
        ? h(
            'div',
            { class: 'banner behind' },
            h('b', {}, behind.title),
            ...behind.rows.map((r) => h('div', { class: 'inbox-unit' }, h('div', { class: 'small' }, r.text), ...r.fixes.map((f) => fixRow(f)), r.note ? h('div', { class: 'muted small' }, r.note) : null)),
          )
        : null,
      list(actions, 'map-actions'),
      list(checks, 'map-checks'),
    );
  };

  /** What changed (#206): above the inbox after each recorded map, until "got it". */
  const changed = (): HTMLElement => {
    const w = whatChangedReadout(ctx.engine, run, progressOf.get(run));
    if (!w) return h('div', { class: 'what-changed-none' });
    const block = (title: string, rows: readonly string[]) => (rows.length ? h('div', {}, h('b', { class: 'small' }, title), h('ul', { class: 'small' }, ...rows.map((x) => h('li', {}, x)))) : null);
    return h(
      'div',
      { class: 'banner what-changed' },
      h('b', {}, w.title),
      h('div', { class: 'small' }, w.chance),
      block('EXP against the forecast', w.exp),
      block('Readings that moved', w.readings),
      h('div', { class: 'small' }, w.improvements),
      h('button', { class: 'mini', title: 'Dismiss this card', onclick: () => set(withDismissedChange(run, w.entry)) }, 'Got it'),
    );
  };

  const decisions = (): HTMLElement => {
    const p = item('proposals');
    const c = item('close-calls');
    return h(
      'div',
      { class: 'inbox-decisions' },
      p
        ? h(
            'div',
            { class: 'banner proposals' },
            h('b', {}, p.title),
            ...p.rows.map((r) =>
              h(
                'div',
                { class: 'row small' },
                h('span', {}, r.text),
                h('button', { class: 'mini', title: 'Adopt this plan: the search carries on from it', onclick: () => set(withEdit(run, { label: r.proposal.edits.join('; '), plan: r.proposal.plan, accepted: true, cost: { gain: r.proposal.gain, margin: r.proposal.margin, verdict: 'better' } })) }, 'Accept'),
                h('button', { class: 'mini ghost', title: 'Hide it: the plan stays as it is', onclick: () => set(withDismissedProposal(run, r.key)) }, 'Dismiss'),
              ),
            ),
          )
        : null,
      c
        ? h(
            'div',
            { class: 'banner close-calls' },
            h('b', {}, c.title),
            ...c.rows.map((r) =>
              h(
                'div',
                { class: 'row small' },
                h('span', {}, r.text),
                h('button', { class: 'mini', title: 'Take it: the chance can’t tell it from the plan', onclick: () => set(withEdit(run, { label: r.call.label, plan: r.call.plan, accepted: true, cost: { gain: r.call.gain, margin: r.call.margin, verdict: 'close' } })) }, 'Take it'),
              ),
            ),
          )
        : null,
    );
  };

  const results = (): HTMLElement => {
    const a = item('anything-else')!;
    const shown = shownChoices(s.choices, query);
    const make = (k: string) => {
      const c = shown.find((x) => x.key === k);
      if (!c) return;
      const cost = s.costs.get(k);
      const was = cost ? { cost: { gain: cost.gain, margin: cost.margin, verdict: cost.verdict } } : {};
      if (c.pins.length) set(withEdit(run, { label: c.label, pins: c.pins, ...was }));
      else {
        const plan = s.edited.get(k);
        if (plan) set(withEdit(run, { label: c.label, plan, ...was }));
      }
    };
    return h(
      'div',
      { class: 'anything-results' },
      ...a.rows.map((r) =>
        h(
          'div',
          { class: 'row small' },
          h('span', {}, r.label),
          h('span', { class: r.cost === 'costing…' || r.cost.endsWith('provisional') ? 'muted' : '' }, r.cost),
          h(
            'button',
            { class: 'mini', disabled: !r.ready, title: r.apply === 'pin' ? 'Pin it: a hard constraint every plan keeps' : 'Make it: your plan becomes this one', onclick: () => make(r.key) },
            r.apply === 'pin' ? 'Pin' : 'Make it',
          ),
        ),
      ),
      a.note ? h('span', { class: 'muted small' }, a.note) : null,
    );
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const anything = (): HTMLElement => {
    const a = item('anything-else')!;
    const res = { el: results(), draw: results };
    parts.push(res);
    return h(
      'div',
      { class: 'banner anything-else' },
      h('b', {}, a.title),
      h('input', {
        type: 'search',
        value: query,
        placeholder: a.placeholder,
        'aria-label': 'Search every edit',
        class: 'wide-in',
        oninput: (e) => {
          query = (e.target as HTMLInputElement).value;
          redraw();
          clearTimeout(timer);
          timer = setTimeout(() => listEdits(ctx, progressOf.get(run)), 300);
        },
      }),
      res.el,
    );
  };

  const yourEdits = (): HTMLElement => {
    const y = item('your-edits')!;
    return h(
      'div',
      { class: 'banner your-edits' },
      h('b', {}, y.title),
      ...y.rows.map((r) => {
        const e = run.edits![r.index]!;
        return h(
          'div',
          { class: 'row small' },
          h('span', {}, r.text),
          r.cost ? h('span', { class: 'muted' }, r.cost) : null,
          r.ask ? h('button', { class: 'mini ghost', title: 'Work out what this pin costs on its own', onclick: () => askPinCost(ctx, e.pins!) }, 'Cost?') : null,
          h('button', { class: 'mini', title: 'Undo this edit', onclick: () => set(withoutEdit(run, r.index)) }, 'Undo'),
        );
      }),
      y.pinCost ? h('div', { class: 'small' }, y.pinCost) : null,
      h('span', { class: 'muted small' }, y.note),
    );
  };

  const tail = (): HTMLElement => {
    if (after) return h('div', { class: 'inbox-tail' }, yourEdits());
    const w = item('wishlist')!;
    const l = item('lock')!;
    return h(
      'div',
      { class: 'inbox-tail' },
      yourEdits(),
      h('details', { class: 'banner wishlist-line' }, h('summary', {}, h('b', {}, w.summary)), ...w.lines.map((x) => h('div', { class: 'small' }, x))),
      h(
        'div',
        { class: 'banner lock-robin' },
        h('span', {}, l.text),
        h('button', { disabled: !l.robin, title: 'Write this Robin into the run facts: only Robin is locked, the rest stays editable', onclick: () => l.robin && set(withRobinLock(run, l.robin)) }, 'Lock Robin and start'),
      ),
    );
  };

  const parts: { el: HTMLElement; draw: () => HTMLElement }[] = [];
  const card = after ? { el: changed(), draw: changed } : undefined;
  if (card) parts.push(card);
  const top = after ? { el: needs(), draw: needs } : { el: decisions(), draw: decisions };
  parts.push(top);
  const search = anything();
  const end = { el: tail(), draw: tail };
  parts.push(end);
  const title = { el: h('h3', {}, read().title), draw: () => h('h3', {}, read().title) };
  parts.push(title);
  live = { run, ctx, parts };
  listEdits(ctx, progressOf.get(run));
  return h('section', { class: 'inbox' }, card?.el ?? null, title.el, headline, robin, top.el, search, end.el);
}

/**
 * Next map's nudge after the Lock (#206): "N items above still need you (you can play anyway)", redrawn with the
 * inbox; never a gate. Draw it after `inboxView` for the same run.
 */
export function inboxNudge(ctx: RunContext): HTMLElement {
  const draw = () => {
    const s = page;
    const r = s && afterLockReadout(ctx.engine, ctx.run, { progress: progressOf.get(ctx.run), choices: s.choices, costs: s.costs, query, pinCosts: s.pinCosts });
    return r?.nudge ? h('span', { class: 'small nudge' }, r.nudge) : h('span', { class: 'nudge-none' });
  };
  const part = { el: draw(), draw };
  if (live?.run === ctx.run) live.parts.push(part);
  return part.el;
}

/** The run without an adopted plan: the seed is its plan (a fresh plan for the run as recorded). */
function withoutAdopted(run: Run): Run {
  const { adopted: _, ...rest } = run;
  return rest;
}

/** What the seed reads besides the run: the player's pins and each unit's role (until #212). */
const freshOptions = (ctx: RunContext) => {
  const pins = ctx.pins?.();
  return { ...(pins ? { pins } : {}), ...(ctx.roleOf ? { roleOf: ctx.roleOf } : {}) };
};
