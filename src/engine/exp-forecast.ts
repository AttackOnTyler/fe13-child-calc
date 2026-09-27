/**
 * The EXP forecast (#195; spec #175, The EXP forecast; design #146, prototype on `prototype/exp-forecast`): read from
 * the flawless chance's own simulation (`simulateRuns`), never a model of its own.
 *
 * - **EXP priority** (high, normal, low) per unit per map decides who lands kills in each map's play: a lower unit
 *   chips a foe into a higher unit's kill range, or waits, and the foes left alive cost turns the flawless chance
 *   already charges. It never buys a unit an extra action (`MapPlayInput.priority`). A plan sets it as spans
 *   (`Roadmap.priorities`); without them the forecast reads a default from the milestones (`defaultPriorities`).
 * - The forecast is each map's expected EXP per unit, its level range, and the kills it lands per foe group (never
 *   which foe falls on which turn), and each milestone's **milestone chance** with the median level there.
 * - The **suggested change** for a low milestone is one span pin from the unit's join map to the deadline (raise its
 *   priority, lower another's, pair it as Lead with a Back, or field it earlier), each played on the same runs (the
 *   same seed) and ranked: those reaching 80% without pushing another milestone below 80%, fewest extra turns first;
 *   then those that break one, flagged; then those that fall short, by chance. A pin is plain data (`SuggestedPin`) for
 *   the span pins (#200) to apply.
 *
 * Cost: every suggestion is a full run simulation over the same runs, so a suggestion list costs about as many
 * flawless chances as it has candidates (the anytime solve's worker, #199, is where the page asks for it).
 */
import type { Assumptions } from './assumptions';
import type { Deployment } from './deploy';
import { SEAL_LEVEL } from './sim/class-changes';
import { flawlessInput, FLAWLESS_RUNS, FLAWLESS_SEED, type FlawlessChance, type FlawlessOptions } from './flawless';
import { milestones, type Milestone } from './milestones';
import type { RosterUnit } from './roster';
import type { ExpPriority } from './sim/map-play';
import { planLineups, priorityByMap, simulateRuns, type LineupPlan, type MilestoneCheck, type RunSim, type RunSimInput } from './sim/run-sim';
import type { Plan, PlanPriority } from './solve/plan';

/** A milestone reads on track at this chance or more (spec: readings). */
export const ON_TRACK = 0.8;

/**
 * A suggested change as a span pin (#195, for #200 to apply): over the maps `from`–`to` (keys, both included), set the
 * unit's EXP priority (`value` high or low), pair it as Lead with `value` as its Back (kept together while safe), or
 * field it (benching `benched` where the lineup is full).
 */
export type SuggestedPin =
  | { readonly kind: 'priority'; readonly unit: RosterUnit; readonly value: 'high' | 'low'; readonly from: string; readonly to: string }
  | { readonly kind: 'pair'; readonly unit: RosterUnit; readonly value: RosterUnit; readonly from: string; readonly to: string }
  | { readonly kind: 'field'; readonly unit: RosterUnit; readonly from: string; readonly to: string; readonly benched: readonly RosterUnit[] };

/** One suggested change and what it does, on the same runs as today's plan. */
export type SuggestedChange = {
  readonly pin: SuggestedPin;
  /** The milestone's chance with it. */
  readonly chance: number;
  /** Whether that reaches 80%. */
  readonly reaches: boolean;
  /** The milestones on track today (80% or more) it pushes below 80%, by id: a change that breaks one is flagged. */
  readonly breaks: readonly string[];
  /**
   * Expected turns, less today's, over the maps through the last milestone on track today (the ones it could break):
   * each is another enemy phase the flawless chance survives.
   */
  readonly turns: number;
  /** The chance of nobody lost over those maps with it, less today's. */
  readonly flawless: number;
};

export type ExpForecastOptions = Pick<FlawlessOptions, 'seed' | 'runs'> & {
  /** The EXP priorities to play (in place of the plan's, or the default from its milestones). */
  readonly priorities?: readonly PlanPriority[];
};

/** The EXP forecast of a plan: its flawless chance's simulation (with `exp` and `milestones`), and the priorities played. */
export type ExpForecast = FlawlessChance & { readonly priorities: readonly PlanPriority[] };

/** A roadmap milestone (#194) as the runs check it. */
export function milestoneCheck(m: Milestone): MilestoneCheck {
  const point = { id: m.id, index: m.at.index, when: m.at.when, units: m.units };
  switch (m.kind) {
    case 'skill':
      return { ...point, test: { kind: 'skill', unit: m.unit, skill: m.skill } };
    case 'class':
      return { ...point, test: { kind: 'class', unit: m.unit, classId: m.classId } };
    case 'support':
      return { ...point, test: { kind: 'support', pair: m.pair } };
    case 'recruit':
      return { ...point, test: { kind: 'recruit', child: m.child } };
  }
}

/** The map index a unit is first fielded from: the army's 0, a recruit's map (or the next, joining later), a child's next. */
export function joinIndex(input: RunSimInput, unit: RosterUnit): number | undefined {
  if (input.army.some((a) => a.id === unit)) return 0;
  const i = input.maps.findIndex((m) => m.joining.some((a) => a.id === unit) || m.later.some((a) => a.id === unit) || (m.children ?? []).some((c) => c.id === unit));
  if (i < 0) return undefined;
  return input.maps[i]!.joining.some((a) => a.id === unit) ? i : i + 1;
}

/** The last map a milestone's EXP can come from: its map when it's due at the end, else the one before. */
const lastMapFor = (c: Pick<MilestoneCheck, 'index' | 'when'>) => (c.when === 'end' ? c.index : c.index - 1);

/**
 * The default EXP priorities (#195), ranked by how soon each unit needs its levels: a milestone needs levels when it's
 * a skill learned at a class level (for a build, or passed at a child's paralogue entry) or a class change from below
 * Lv 10, due before the endpoint. On each map, the units whose next such deadline is the soonest are high, from the map
 * they join; everyone else is normal. Build skills due only at the endpoint set none (they'd make everyone high, which
 * is everyone normal).
 */
export function defaultPriorities(ms: readonly Milestone[], input: RunSimInput): PlanPriority[] {
  const last = input.maps.length - 1;
  const levelOf = (u: RosterUnit) => input.army.find((a) => a.id === u);
  // Each unit's deadlines (the last map its EXP counts for) and the map it joins.
  const due = new Map<RosterUnit, { from: number; deadlines: number[] }>();
  for (const m of ms) {
    if (m.at.index >= last || (m.kind !== 'skill' && m.kind !== 'class')) continue;
    if (m.kind === 'skill' ? m.wasted || !m.learn : (levelOf(m.unit)?.level ?? 0) >= SEAL_LEVEL) continue;
    const from = joinIndex(input, m.unit);
    const to = lastMapFor(m.at);
    if (from === undefined || to < from) continue;
    const d = due.get(m.unit);
    if (d) d.deadlines.push(to);
    else due.set(m.unit, { from, deadlines: [to] });
  }
  const high = input.maps.map((_, i) => {
    const next = [...due].flatMap(([unit, d]) => {
      const soonest = d.from <= i ? Math.min(...d.deadlines.filter((x) => x >= i)) : Infinity;
      return Number.isFinite(soonest) ? [[unit, soonest] as const] : [];
    });
    const soonest = Math.min(...next.map(([, x]) => x));
    return new Set(next.filter(([, x]) => x === soonest).map(([u]) => u));
  });
  // Each unit's runs of consecutive maps high, as spans.
  const out: PlanPriority[] = [];
  for (const unit of due.keys()) {
    for (let i = 0; i <= last; i++) {
      if (!high[i]!.has(unit)) continue;
      let j = i;
      while (j < last && high[j + 1]!.has(unit)) j++;
      out.push({ unit, priority: 'high', from: input.maps[i]!.key, to: input.maps[j]!.key });
      i = j;
    }
  }
  return out;
}

/** A deployment as a plan's lineup. */
const lineupPlanOf = (d: Deployment): LineupPlan => ({ pairs: d.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo: [...d.solo] });

/** Who a lineup fields. */
const fieldedIn = (l: LineupPlan): RosterUnit[] => [...l.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...l.solo];

/** Who fielding one more unit benches on map `i`: a full lineup's last unit alone that isn't forced. */
function benchedOn(input: RunSimInput, l: LineupPlan, i: number): RosterUnit | undefined {
  if (fieldedIn(l).length < input.maps[i]!.deploy) return undefined;
  return [...l.solo].reverse().find((s) => !input.maps[i]!.forced.includes(s));
}

/** The input with a span pin applied over maps `from`–`to` (indices), the plan's lineups there as `lineups` resolves them. */
function withPin(input: RunSimInput, pin: SuggestedPin, from: number, to: number, lineups: readonly LineupPlan[]): RunSimInput {
  const span = (i: number) => i >= from && i <= to;
  if (pin.kind === 'priority') {
    const priority = input.maps.map((_, i) => (span(i) ? { ...input.priority?.[i], [pin.unit]: pin.value } : input.priority?.[i]));
    return { ...input, priority };
  }
  const edited = input.maps.map((_, i) => {
    const l = lineups[i]!;
    if (!span(i)) return input.lineups?.[i];
    if (pin.kind === 'pair') {
      if (!fieldedIn(l).includes(pin.value)) return l;
      const drop = new Set([pin.unit, pin.value]);
      // Their old partners stay, alone.
      const partners = l.pairs.flatMap((p) => (drop.has(p.lead) && p.back && !drop.has(p.back) ? [p.back] : !drop.has(p.lead) && p.back && drop.has(p.back) ? [p.lead] : []));
      const pairs = l.pairs.filter((p) => !drop.has(p.lead) && !(p.back && drop.has(p.back)));
      return { pairs: [{ lead: pin.unit, back: pin.value, kept: true }, ...pairs], solo: [...partners, ...l.solo.filter((u) => !drop.has(u))] };
    }
    if (fieldedIn(l).includes(pin.unit)) return l;
    const out = benchedOn(input, l, i);
    return { pairs: l.pairs, solo: [pin.unit, ...l.solo.filter((u) => u !== out)] };
  });
  return { ...input, lineups: edited };
}

/**
 * Whether a suggestion goes against a span pin (#200) on its span: raising a unit a pin keeps out or as a Back, fielding
 * a unit kept out, or pairing a unit as Lead where a pin puts it (or its Back) elsewhere or with another partner.
 */
function breaksPins(input: RunSimInput, pin: SuggestedPin, span: readonly number[]): boolean {
  return span.some((i) => {
    const rules = input.pins?.[i] ?? [];
    const rule = (u: RosterUnit) => rules.find((r) => r.unit === u && r.position !== 'in');
    const own = rule(pin.unit);
    if (pin.kind === 'priority') return pin.value === 'high' && (own?.position === 'out' || own?.position === 'back');
    if (pin.kind === 'field') return own?.position === 'out';
    const back = rule(pin.value);
    const leadOk = !own || (own.position === 'lead' && (!own.partner || own.partner === pin.value));
    const backOk = !back || (back.position === 'back' && (!back.partner || back.partner === pin.unit));
    return !leadOk || !backOk;
  });
}

/** Expected turns over the map order (maps no run reaches count none). */
const totalTurns = (r: RunSim) => r.maps.reduce((a, m) => a + (m.turns ?? 0), 0);

/**
 * The suggested changes for milestone `id` of `input.milestones` (see the module comment), best first. Only changes
 * that lift its chance are listed; none when it has no unit in the army by its deadline, or no map to act on.
 */
export function suggestChanges(input: RunSimInput, id: string, seed: number, runs: number, assumptions: Assumptions): SuggestedChange[] {
  const checks = input.milestones ?? [];
  const k = checks.findIndex((c) => c.id === id);
  if (k < 0) return [];
  const target = checks[k]!;
  const unit = target.units[0];
  const from = unit === undefined ? undefined : joinIndex(input, unit);
  const to = Math.min(lastMapFor(target), input.maps.length - 1);
  if (unit === undefined || from === undefined || to < from) return [];
  const full = simulateRuns(input, seed, runs, assumptions);
  const chanceOf = (r: RunSim, c: MilestoneCheck) => r.milestones.find((m) => m.id === c.id)?.chance ?? 0;
  const baseChance = chanceOf(full, target);
  // A change can only break a milestone on track today: the runs stop after the last of those (or the target's map),
  // so a change costs the maps that can move its reading and no more.
  const through = Math.max(target.index, ...checks.filter((c) => chanceOf(full, c) >= ON_TRACK).map((c) => c.index));
  const cut = (x: RunSimInput): RunSimInput =>
    through >= x.maps.length - 1
      ? x
      : {
          ...x,
          maps: x.maps.slice(0, through + 1),
          ...(x.lineups ? { lineups: x.lineups.slice(0, through + 1) } : {}),
          ...(x.priority ? { priority: x.priority.slice(0, through + 1) } : {}),
          milestones: checks.filter((c) => c.index <= through),
        };
  const base = through >= input.maps.length - 1 ? full : simulateRuns(cut(input), seed, runs, assumptions);
  // The lineups on the span as the plan plays them now: who is fielded, and what a pair or field pin edits.
  const lineups = planLineups(input, seed, assumptions).map((d, i) => input.lineups?.[i] ?? lineupPlanOf(d));
  const span = [...Array(to - from + 1).keys()].map((x) => x + from);
  const [fromKey, toKey] = [input.maps[from]!.key, input.maps[to]!.key];
  const others = [...new Set(span.flatMap((i) => fieldedIn(lineups[i]!)))].filter((u) => u !== unit);

  const pins: SuggestedPin[] = [];
  if (span.some((i) => input.priority?.[i]?.[unit] !== 'high')) pins.push({ kind: 'priority', unit, value: 'high', from: fromKey, to: toKey });
  // Lowering another only moves kills it lands on the span today.
  const killers = new Set(full.exp.filter((m) => span.some((i) => input.maps[i]!.key === m.key)).flatMap((m) => m.units.filter((u) => Object.keys(u.kills).length).map((u) => u.unit)));
  for (const o of others) if (killers.has(o) && span.some((i) => input.priority?.[i]?.[o] !== 'low')) pins.push({ kind: 'priority', unit: o, value: 'low', from: fromKey, to: toKey });
  for (const back of others) {
    if (span.every((i) => !fieldedIn(lineups[i]!).includes(back) || lineups[i]!.pairs.some((p) => p.lead === unit && p.back === back))) continue;
    pins.push({ kind: 'pair', unit, value: back, from: fromKey, to: toKey });
  }
  const missing = span.filter((i) => !fieldedIn(lineups[i]!).includes(unit));
  if (missing.length) {
    const benched = missing.flatMap((i) => benchedOn(input, lineups[i]!, i) ?? []);
    pins.push({ kind: 'field', unit, from: fromKey, to: toKey, benched: [...new Set(benched)] });
  }

  const out: SuggestedChange[] = [];
  for (const pin of pins.filter((p) => !breaksPins(input, p, span))) {
    const r = simulateRuns(cut(withPin(input, pin, from, to, lineups)), seed, runs, assumptions);
    const chance = chanceOf(r, target);
    if (chance <= baseChance) continue;
    const breaks = checks.filter((c) => c !== target && chanceOf(full, c) >= ON_TRACK && chanceOf(r, c) < ON_TRACK).map((c) => c.id);
    out.push({ pin, chance, reaches: chance >= ON_TRACK, breaks, turns: totalTurns(r) - totalTurns(base), flawless: r.chance - base.chance });
  }
  // Reaching without breaking (fewest extra turns), then breaking (flagged), then falling short.
  const tier = (s: SuggestedChange) => (s.breaks.length ? 1 : s.reaches ? 0 : 2);
  return out.sort((a, b) => tier(a) - tier(b) || (tier(a) === 0 ? a.turns - b.turns : 0) || Number(b.reaches) - Number(a.reaches) || a.breaks.length - b.breaks.length || b.chance - a.chance);
}

/** The simulation input for a plan's EXP forecast: its milestones checked, and its priorities (or the default). */
function forecastInput(run: Parameters<typeof flawlessInput>[0], plan: Plan, assumptions: Assumptions, options: ExpForecastOptions) {
  const base = flawlessInput(run, assumptions, undefined, plan);
  const ms = milestones(run, plan, assumptions);
  const priorities = options.priorities ?? plan.roadmap.priorities ?? defaultPriorities(ms, base.input);
  const input: RunSimInput = { ...base.input, priority: priorityByMap(base.input.maps, priorities, base.input.pins), milestones: ms.map(milestoneCheck) };
  return { ...base, input, priorities };
}

/** A plan's EXP forecast (see the module comment). */
export function expForecast(run: Parameters<typeof flawlessInput>[0], plan: Plan, assumptions: Assumptions, options: ExpForecastOptions = {}): ExpForecast {
  const { input, notSimulated, unknownHistory, endpoint, goldUnrecorded, renown, priorities } = forecastInput(run, plan, assumptions, options);
  const sim = simulateRuns(input, options.seed ?? FLAWLESS_SEED, options.runs ?? FLAWLESS_RUNS, assumptions);
  return { ...sim, notSimulated, unknownHistory, endpoint, goldUnrecorded, renown, priorities };
}

/** The suggested changes for one of a plan's milestones, by id (see `suggestChanges`). */
export function suggestedChanges(run: Parameters<typeof flawlessInput>[0], plan: Plan, id: string, assumptions: Assumptions, options: ExpForecastOptions = {}): SuggestedChange[] {
  const { input } = forecastInput(run, plan, assumptions, options);
  return suggestChanges(input, id, options.seed ?? FLAWLESS_SEED, options.runs ?? FLAWLESS_RUNS, assumptions);
}

export type { ExpPriority };
