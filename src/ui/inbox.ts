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
 * `inboxReadout` is what the page draws, from the solve's progress and the costs the worker has read (tested);
 * `inboxView` draws it and wires the worker's `edits` slot. After the Lock the Run view is today's (the inbox titled
 * "Before <map>" is #206: `afterLockInbox` is its hook).
 */
import type { EditCost, PinCost, Plan, PlanPin, PlanProposal, PlanRobin, RosterUnit, Run, CloseCall } from '../engine';
import { EDIT_COST_BUDGET, FLAWLESS_SEED, STEP_BUDGET, pinKey, proposalId, robinLock, rosterUnits, unitName, withDismissedProposal, withEdit, withRobinLock, withoutEdit } from '../engine';
import { STAT_LABELS } from '../game-data/stats';
import { differenceText } from './chance';
import { h } from './dom';
import { startSolve, type UnitEditView } from './solve-client';
import type { RunContext, SolveProgress } from './run-page';

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

/** The plan the player holds: the adopted plan, else the one the solve started from (the seed), else its best. */
export const heldPlan = (run: Run, progress: SolveProgress | undefined): Plan | undefined => run.adopted ?? progress?.start ?? progress?.best;

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

  const q = state.query.trim();
  const all = state.choices ? state.choices.filter((c) => matches(q, c.label)) : [];
  const shown = all.slice(0, SHOWN_MATCHES);
  items.push({
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
  });

  const edits = run.edits ?? [];
  const pc = progress?.pinCost;
  items.push({
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
  });

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

/** After the Lock (#206): the inbox titled "Before <map>: what needs you". Today's Run view carries on until then. */
export function afterLockInbox(_ctx: RunContext): HTMLElement | null {
  return null;
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

function redraw(): void {
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

/**
 * The inbox before the Lock, drawn: `headline` (the flawless section) and `robin` (the Robin alternatives' card) are
 * the page's own live sections; the rest is drawn here from `inboxReadout` and redrawn as the worker replies.
 */
export function inboxView(ctx: RunContext, headline: HTMLElement, robin: HTMLElement | null): HTMLElement {
  const { run } = ctx;
  const key = stateKey(run);
  if (page?.key !== key) page = { key, costs: new Map(), edited: new Map(), pinCosts: new Map(), asked: new Set(), listing: false };
  const s = page;
  const read = () => inboxReadout(run, { progress: progressOf.get(run), choices: s.choices, costs: s.costs, query, pinCosts: s.pinCosts });
  const item = <K extends InboxItem['kind']>(kind: K) => read().items.find((i): i is Extract<InboxItem, { kind: K }> => i.kind === kind);
  const set = (next: Run) => ctx.setRun(next);

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

  const tail = (): HTMLElement => {
    const y = item('your-edits')!;
    const w = item('wishlist')!;
    const l = item('lock')!;
    return h(
      'div',
      { class: 'inbox-tail' },
      h(
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
      ),
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
  const top = { el: decisions(), draw: decisions };
  parts.push(top);
  const search = anything();
  const end = { el: tail(), draw: tail };
  parts.push(end);
  live = { run, ctx, parts };
  listEdits(ctx, progressOf.get(run));
  return h('section', { class: 'inbox' }, h('h3', {}, read().title), headline, robin, top.el, search, end.el);
}
