/**
 * Pins (#200; spec #175, The joint solve): the player's hard constraints on the solve, where they live on the run, which
 * of them still hold, and how a lineup keeps them.
 *
 * - **Where they live:** `Run.pins` holds marriage, span, keep-in/out and item pins (#193's `itemPins` read into it);
 *   side goals stay in `Run.sideGoals` (#191) and read as pins; the Plan page's pinned marriages (a pinned bond in the
 *   latest entry) read as marriage pins: `run:v2` (#205) migrated the saved ones into `Run.pins`, and today's Plan page
 *   still writes bonds until #212 retires it. A rule-out is a marriage pin with `forbid` (#205). `runPins` lists them all.
 * - **Recorded facts are never pins** (`livePins`): a marriage pin on a unit the log marries, a span all played, a
 *   side goal on a recorded map, any pin on a unit dead or missed is dropped, and so has no cost.
 * - **Lineups keep them** (`lineupRules`, `pinnedLineup`): each map's span pins, keep-out on every map (a span pin
 *   fielding the unit there wins; a forced unit stays), keep-in at the endpoint. The runs play every lineup (named by the
 *   plan or greedy) through `pinnedLineup`, so no plan can break one in play; `brokenPins` counts what a plan lists
 *   against them, so the search never offers such a plan.
 */
import type { RosterUnit } from '../roster';
import type { Run, Snapshot } from '../run';
import { SIDE_GOAL_IDS, sideGoalById, type SideGoalId } from '../side-goals';
import type { LineupPlan } from '../sim/run-sim';
import { parseItemPins } from '../item-plan';
import { marriagePins, type MarriagePin, type Plan, type PlanPin, type Position, type SpanPin, type SpanPosition } from './plan';

/** A pin's identity: two pins with the same key are the same choice (the later replaces the earlier). */
export function pinKey(p: PlanPin): string {
  switch (p.kind) {
    case 'marriage':
      return `marriage:${[...p.couple].sort().join('+')}`;
    case 'span':
      return `span:${p.unit}:${p.from}:${p.to ?? ''}`;
    case 'keep':
      return `keep:${p.unit}`;
    case 'side-goal':
      return `side-goal:${p.goal}`;
    case 'booster':
    case 'carrier':
      return `${p.kind}:${p.item}`;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const POSITIONS: readonly SpanPosition[] = ['lead', 'back', 'solo', 'out'];

/** Stored pins (`Run.pins`), with #193's `itemPins` folded in: anything unreadable is dropped, each pin once. */
export function parsePins(v: unknown, itemPins?: unknown): PlanPin[] {
  const out = new Map<string, PlanPin>();
  const add = (p: PlanPin) => out.set(pinKey(p), p);
  for (const x of Array.isArray(v) ? v : []) {
    if (!isObject(x)) continue;
    if (x.kind === 'marriage' && Array.isArray(x.couple) && x.couple.length === 2 && x.couple.every(isText) && x.couple[0] !== x.couple[1])
      add({ kind: 'marriage', couple: [x.couple[0] as RosterUnit, x.couple[1] as RosterUnit], ...(x.forbid === true ? { forbid: true as const } : {}) });
    else if (x.kind === 'span' && isText(x.unit) && POSITIONS.includes(x.position as SpanPosition) && isText(x.from))
      add({
        kind: 'span',
        unit: x.unit as RosterUnit,
        position: x.position as SpanPosition,
        ...(isText(x.partner) && x.partner !== x.unit && (x.position === 'lead' || x.position === 'back') ? { partner: x.partner as RosterUnit } : {}),
        from: x.from,
        ...(isText(x.to) ? { to: x.to } : {}),
      });
    else if (x.kind === 'keep' && isText(x.unit) && (x.keep === 'in' || x.keep === 'out')) add({ kind: 'keep', unit: x.unit as RosterUnit, keep: x.keep });
    else if (x.kind === 'side-goal' && SIDE_GOAL_IDS.includes(x.goal as SideGoalId) && (x.decision === 'chase' || x.decision === 'skip'))
      add({ kind: 'side-goal', goal: x.goal as SideGoalId, decision: x.decision });
    else if (x.kind === 'booster' || x.kind === 'carrier') parseItemPins([x]).forEach(add);
  }
  parseItemPins(itemPins).forEach(add);
  return [...out.values()];
}

const latest = (run: Run): Snapshot | undefined => run.entries[run.entries.length - 1]?.snapshot;

/**
 * Every pin the run holds, each once: `Run.pins`, its side goals (`Run.sideGoals`), and the Plan page's pinned marriages
 * (a pinned bond in the latest entry). Facts included: see `livePins`.
 */
export function runPins(run: Run): PlanPin[] {
  const snap = latest(run);
  const bonds: MarriagePin[] = snap ? marriagePins({ ...run.roster, states: snap.states, spouses: snap.spouses }) : [];
  const goals: PlanPin[] = Object.entries(run.sideGoals ?? {}).map(([goal, decision]) => ({ kind: 'side-goal', goal: goal as SideGoalId, decision: decision! }));
  return uniquePins([...bonds, ...(run.pins ?? []), ...goals]);
}

/** Each pin once (by `pinKey`, the later kept, in first-seen order). */
export function uniquePins(pins: readonly PlanPin[]): PlanPin[] {
  const out = new Map<string, PlanPin>();
  for (const p of pins) out.set(pinKey(p), p);
  return [...out.values()];
}

/**
 * The span's keys on an order (the map order still to play, in play order): from `from` (or the first map, when `from`
 * is already played) to `to` (or the endpoint); none when `to` is played or `from` comes after it.
 */
export function spanKeys(pin: Pick<SpanPin, 'from' | 'to'>, keys: readonly string[]): readonly string[] {
  const to = pin.to === undefined ? keys.length - 1 : keys.indexOf(pin.to);
  if (to < 0) return [];
  const from = Math.max(0, keys.indexOf(pin.from));
  return from <= to ? keys.slice(from, to + 1) : [];
}

/**
 * The pins that still hold over the maps still to play (`keys`, in play order): recorded facts are never pins, so a pin
 * on what already happened, or on a unit dead or missed, is dropped (see the module comment). Each pin once.
 */
export function livePins(run: Run, pins: readonly PlanPin[], keys: readonly string[]): PlanPin[] {
  const snap = latest(run);
  const lost = (u: RosterUnit) => ['dead', 'missed'].includes(snap?.states[u] ?? run.roster.states[u] ?? 'available');
  const married = (u: RosterUnit) => snap?.spouses[u]?.bond === 'married';
  const played = new Set(run.entries.map((e) => e.map));
  const marriedUnits = new Set<RosterUnit>();
  return uniquePins(pins).filter((p) => {
    switch (p.kind) {
      case 'marriage': {
        // A rule-out holds while neither is married; of two marriage pins on one unit, the first holds.
        if (p.forbid) return !p.couple.some((u) => married(u));
        if (p.couple.some((u) => lost(u) || married(u) || marriedUnits.has(u))) return false;
        p.couple.forEach((u) => marriedUnits.add(u));
        return true;
      }
      case 'span':
        return !lost(p.unit) && spanKeys(p, keys).length > 0;
      case 'keep':
        return !lost(p.unit);
      case 'side-goal':
        return !played.has(sideGoalById(p.goal).map);
      default:
        return true;
    }
  });
}

/** A pin kept on the run: side goals in `Run.sideGoals`, the rest in `Run.pins` (replacing the same choice). */
export function withPin(run: Run, pin: PlanPin): Run {
  if (pin.kind === 'side-goal') return { ...run, sideGoals: { ...run.sideGoals, [pin.goal]: pin.decision } };
  const k = pinKey(pin);
  // A unit keeps one keep pin, and one span pin per map range.
  return { ...run, pins: [...(run.pins ?? []).filter((p) => pinKey(p) !== k), pin] };
}

/**
 * The run with pins lifted (all of them by default): gone from `Run.pins` and `Run.sideGoals`, and a pinned bond in the
 * latest entry unpinned. What the pin cost's second search solves.
 */
export function withoutPins(run: Run, lift?: readonly PlanPin[]): Run {
  const keys = lift ? new Set(lift.map(pinKey)) : undefined;
  const lifted = (p: PlanPin) => !keys || keys.has(pinKey(p));
  const pins = (run.pins ?? []).filter((p) => !lifted(p));
  const goals = Object.fromEntries(Object.entries(run.sideGoals ?? {}).filter(([goal, decision]) => !lifted({ kind: 'side-goal', goal: goal as SideGoalId, decision: decision! })));
  const { pins: _p, sideGoals: _g, ...base } = run;
  let entries = run.entries;
  const last = entries[entries.length - 1];
  if (last) {
    const spouses = { ...last.snapshot.spouses };
    let changed = false;
    for (const [u, s] of Object.entries(spouses) as [RosterUnit, (typeof spouses)[RosterUnit]][])
      if (s?.bond === 'pinned' && lifted({ kind: 'marriage', couple: [u, s.partner] })) {
        delete spouses[u];
        changed = true;
      }
    if (changed) entries = [...entries.slice(0, -1), { ...last, snapshot: { ...last.snapshot, spouses } }];
  }
  return { ...base, entries, ...(pins.length ? { pins } : {}), ...(Object.keys(goals).length ? { sideGoals: goals } : {}) };
}

/** One lineup constraint on one map: a unit's position (or pair), out of the lineup, or in it anywhere (keep-in). */
export type LineupRule = { readonly unit: RosterUnit; readonly position: SpanPosition | 'in'; readonly partner?: RosterUnit };

/**
 * Each map's lineup rules (by `keys`, the order the runs play): the span pins covering it, keep-out on every map but
 * where a span pin places the unit, keep-in at the endpoint (the last key) unless a span pin places it there. Undefined
 * for a map with none; the whole list undefined when no map has any.
 */
export function lineupRules(pins: readonly PlanPin[], keys: readonly string[]): (readonly LineupRule[] | undefined)[] | undefined {
  const at = keys.map((): LineupRule[] => []);
  const spanned = keys.map(() => new Set<RosterUnit>());
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const p of pins) {
    if (p.kind !== 'span') continue;
    for (const k of spanKeys(p, keys)) {
      const i = index.get(k)!;
      at[i]!.push({ unit: p.unit, position: p.position, ...(p.partner ? { partner: p.partner } : {}) });
      spanned[i]!.add(p.unit);
    }
  }
  for (const p of pins) {
    if (p.kind !== 'keep') continue;
    if (p.keep === 'out') keys.forEach((_, i) => spanned[i]!.has(p.unit) || at[i]!.unshift({ unit: p.unit, position: 'out' }));
    else if (keys.length && !spanned[keys.length - 1]!.has(p.unit)) at[keys.length - 1]!.push({ unit: p.unit, position: 'in' });
  }
  return at.some((r) => r.length) ? at.map((r) => (r.length ? r : undefined)) : undefined;
}

type MutablePair = { lead: RosterUnit; back?: RosterUnit };
/** Rules in the order a lineup applies them: out, pairs, Leads, Backs, Solo, then keep-in. */
const ORDER: Readonly<Record<LineupRule['position'], number>> = { out: 0, lead: 2, back: 3, solo: 4, in: 5 };
const rank = (r: LineupRule) => (r.partner ? 1 : ORDER[r.position]);

/**
 * A lineup with a map's rules kept (see the module comment): a unit out is dropped (its Back leads alone), a pinned pair
 * is made, a pinned Lead leads (swapping with its Lead, or taking the lead of a pair of its own), a pinned Back backs (a
 * unit alone, or a Lead with no Back, takes it), a Solo unit fights alone, a kept-in unit is fielded; then, over the
 * deploy count, units no rule names drop from the end (units alone first). A unit not in the army there (`here`) is
 * left to the lineup; a partner not there leaves a Lead alone. A forced unit is never dropped.
 */
export function pinnedLineup(
  lineup: LineupPlan,
  rules: readonly LineupRule[] | undefined,
  options: { readonly max: number; readonly forced: readonly RosterUnit[]; readonly here: (u: RosterUnit) => boolean },
): LineupPlan {
  if (!rules?.length) return lineup;
  const { forced, here } = options;
  let pairs: MutablePair[] = lineup.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) }));
  let solo = [...lineup.solo];
  const kept = new Set<RosterUnit>();
  const remove = (u: RosterUnit) => {
    solo = solo.filter((x) => x !== u);
    pairs = pairs.flatMap((p): MutablePair[] => (p.lead === u ? (p.back ? [{ lead: p.back }] : []) : p.back === u ? [{ lead: p.lead }] : [p]));
  };
  const fielded = () => [...pairs.flatMap((p) => (p.back ? [p.lead, p.back] : [p.lead])), ...solo];
  for (const r of [...rules].sort((a, b) => rank(a) - rank(b))) {
    const u = r.unit;
    if (!here(u)) continue;
    const partner = r.partner && here(r.partner) && !kept.has(r.partner) ? r.partner : undefined;
    if (r.position === 'out') {
      if (!forced.includes(u) && !kept.has(u)) remove(u);
      continue;
    }
    if (kept.has(u)) continue;
    kept.add(u);
    if (r.position === 'in') {
      if (!fielded().includes(u)) solo.push(u);
      continue;
    }
    if (r.position === 'solo') {
      remove(u);
      solo.push(u);
      continue;
    }
    if (partner) {
      remove(u);
      remove(partner);
      kept.add(partner);
      pairs.unshift(r.position === 'lead' ? { lead: u, back: partner } : { lead: partner, back: u });
      continue;
    }
    if (r.position === 'lead') {
      if (pairs.some((p) => p.lead === u)) continue;
      const mine = pairs.find((p) => p.back === u);
      if (mine && !kept.has(mine.lead)) [mine.lead, mine.back] = [u, mine.lead];
      else {
        remove(u);
        pairs.push({ lead: u });
      }
      continue;
    }
    // A Back.
    if (pairs.some((p) => p.back === u)) continue;
    const mine = pairs.find((p) => p.lead === u);
    if (mine?.back && !kept.has(mine.back)) {
      [mine.lead, mine.back] = [mine.back, u];
      continue;
    }
    remove(u);
    const open = pairs.find((p) => !p.back);
    const alone = solo.find((x) => !kept.has(x));
    if (open) open.back = u;
    else if (alone) {
      solo = solo.filter((x) => x !== alone);
      pairs.push({ lead: alone, back: u });
    } else solo.push(u);
  }
  // Over the deploy count: drop units no rule names, from the end, units alone first.
  const room = Math.max(options.max, forced.filter(here).length);
  const named = (u: RosterUnit) => kept.has(u) || forced.includes(u);
  const count = () => fielded().filter(here).length;
  while (count() > room) {
    const x = [...solo].reverse().find((u) => !named(u) && here(u)) ?? [...pairs].reverse().flatMap((p) => (p.back ? [p.back, p.lead] : [p.lead])).find((u) => !named(u) && here(u));
    if (!x) break;
    remove(x);
  }
  return { pairs: pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo };
}

/** A unit's place in a lineup: its position and partner; undefined when it isn't fielded. */
function placeIn(l: LineupPlan, u: RosterUnit): { readonly position: Position; readonly partner?: RosterUnit } | undefined {
  for (const p of l.pairs) {
    if (p.lead === u) return { position: 'lead', ...(p.back ? { partner: p.back } : {}) };
    if (p.back === u) return { position: 'back', partner: p.lead };
  }
  return l.solo.includes(u) ? { position: 'solo' } : undefined;
}

/**
 * The rules a lineup breaks: it lists a unit out that a rule keeps out (a forced unit apart), a unit kept in missing, or
 * a unit in another position or pair than its rule's. A unit a rule places that the lineup leaves out isn't a break for
 * a lineup the plan names (the runs field it where the army has it); given `here` (the army on the map), it is for one
 * the army has there (and a kept-in unit the army lacks isn't).
 */
export function rulesBroken(l: LineupPlan, rules: readonly LineupRule[] | undefined, forced: readonly RosterUnit[] = [], here?: (u: RosterUnit) => boolean): number {
  let n = 0;
  for (const r of rules ?? []) {
    const at = placeIn(l, r.unit);
    if (r.position === 'out') n += at && !forced.includes(r.unit) ? 1 : 0;
    else if (!at) n += r.position === 'in' ? (!here || here(r.unit) ? 1 : 0) : here?.(r.unit) ? 1 : 0;
    else if (r.position !== 'in') {
      const position = r.position === 'solo' && at.position === 'lead' && !at.partner ? 'solo' : at.position;
      const partnerOff = r.partner !== undefined && at.partner !== r.partner && (at.partner !== undefined || placeIn(l, r.partner) !== undefined || !!here?.(r.partner));
      n += position !== r.position || partnerOff ? 1 : 0;
    }
  }
  return n;
}

/**
 * How many pins a plan breaks, as it lists them: a marriage pin its marriages lack, a rule-out they make; span and keep rules its named
 * lineups break (`rulesBroken`, on its roadmap's order), the endpoint read from the wishlist when the roadmap names
 * none. Side goals and item pins the plan can't break (the runs read the former, item edits skip the latter).
 * `forcedAt` gives each map's forced units.
 */
export function brokenPins(plan: Plan, pins: readonly PlanPin[], forcedAt: (key: string) => readonly RosterUnit[] = () => []): number {
  const couples = new Set(plan.wishlist.marriages.map((c) => [...c].sort().join('+')));
  // A marriage pin its marriages lack, or a rule-out they make.
  let n = pins.filter((p) => p.kind === 'marriage' && couples.has([...p.couple].sort().join('+')) === !!p.forbid).length;
  const keys = plan.roadmap.order;
  const rules = lineupRules(pins, keys);
  if (!rules) return n;
  const named = new Map<string, LineupPlan>(plan.roadmap.lineups.map((l) => [l.key, l]));
  const end = keys[keys.length - 1];
  if (end !== undefined && !named.has(end)) named.set(end, wishlistLineup(plan));
  keys.forEach((k, i) => {
    const l = named.get(k);
    if (l) n += rulesBroken(l, rules[i], forcedAt(k));
  });
  return n;
}

/** The wishlist's endpoint lineup as a lineup. */
function wishlistLineup(plan: Plan): LineupPlan {
  const { units } = plan.wishlist;
  return {
    pairs: units.filter((w) => w.position === 'lead').map((w) => ({ lead: w.unit, ...(w.partner ? { back: w.partner } : {}) })),
    solo: units.filter((w) => w.position === 'solo').map((w) => w.unit),
  };
}
