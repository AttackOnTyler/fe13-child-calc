/**
 * The local search's single edits of a plan (#199; spec #175, The joint solve), in the spec's order each round
 * (`EDIT_KINDS`), each generated lazily (a key and a label; the edited plan is built only when the search tries it):
 *
 * - **Marriages:** two couples swap spouses; a married unit takes an unmarried partner instead; two unmarried units
 *   marry. Recorded marriages are facts and marriage pins hold, so neither is edited; only units still to be fielded
 *   marry. The wishlist is rebuilt for the new couples (`planFor`: children, passes, the endpoint's lineup), keeping the
 *   roadmap's other lineups, its order and the passes of children whose parents didn't change.
 * - **Robin:** another asset or flaw, where the run facts leave it open (Robin's gender stays: a gender flip is a
 *   different army, the Robin alternatives' job, #201). Rebuilt the same way.
 * - **The endpoint class:** a unit promotes to another class its Master Seal reaches (its planned class change, #194,
 *   and its wishlist class).
 * - **One build skill:** a unit's build swaps one skill for another its classes teach. The simulation doesn't equip
 *   builds (they're milestones, #194), so the step reads such an edit as a close call at no cost (`simKey`).
 * - **Passed skills:** a parent passes another skill it can pass (not its fixed pass, nor the other parent's); the
 *   simulation passes it only once the parent has learned it (#194).
 * - **Lineups and pairs,** on the maps the best plan loses the most on (its re-score's, riskiest first), as the map's
 *   lineup resolves (named, or the greedy one): a unit fielded on a neighbouring map comes in for one fielded here; two
 *   pairs swap Backs; a pair splits; two units alone pair up. The edited lineup is named on the roadmap from then on.
 * - **EXP priorities (#195):** one unit's priority over a span: a span the plan has is dropped (the unit plays normal
 *   there) or turned the other way; a wishlist unit or a parent with no span is raised to high from the map it joins
 *   to a quarter, half or three quarters of the way (never the endpoint: a span over the whole run is everyone's).
 * - **Paralogue places:** a child paralogue (a movable step) moves one map earlier or later, never past the endpoint.
 * - **Seals:** a planned class change is needed by an earlier map (a quarter, half or three quarters of the way), or
 *   by the endpoint.
 * - **Item uses (#193):** a booster or tonic goes to another wishlist unit on its map, or its unit takes it one step
 *   earlier or later (a quarter of the route, to the next or previous map with a preparation phase); a weapon's
 *   carrier from a map changes to another wishlist unit who wields its kind. An item pin is a hard constraint: a pinned
 *   item's uses aren't edited. Boots and the Arms Scroll aren't edited (no pin: no use).
 * - **Side goals:** none yet: their chase/skip edits come with #191's pins.
 *
 * **Pins (#200)** hold: recorded and pinned marriages aren't edited, pinned items aren't moved, and the step drops an
 * edit whose lineups break a span or keep pin (`brokenPins`). `keptPins` makes an adopted plan from before a pin keep it.
 *
 * **Non-starters first (#194):** while the best plan has a couple that can't reach S by its deadline, the edits that
 * could fix it come first: its child's paralogue moved later (`placedForSupports`), then the marriages touching it.
 */
import { SKILLS, type SkillId } from '../../game-data/skills';
import { MAPS } from '../../game-data/chapters';
import { CHROM_FALLBACK_PARTNER } from '../../game-data/supports';
import { STATS, type Stat } from '../../game-data/stats';
import { flawlessInput } from '../flawless';
import { hasPreparations, heldKind } from '../item-plan';
import { itemByName } from '../../game-data/items';
import { classWeaponKinds } from '../supply';
import { remainingMapOrder } from '../map-order';
import { rosterUnits, stateOf, unitName, type Couple, type RosterUnit } from '../roster';
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import { CLASS_SKILLS } from '../../game-data/skills';
import type { ClassId } from '../../game-data/classes';
import type { Gender } from '../../game-data/stats';
import { className, promotionsOf } from '../classes';
import { sealReaches } from '../sim/class-changes';
import { mapsToS } from '../milestones';
import { pairThresholds, pointsOfRank } from '../sim/support-growth';
import { latestEntry, type Run } from '../run';
import { isMarriagePin, isRuleOut, mapSpanPin, type Plan, type PlanItem, type PlanLineup, type PlanPin, type PlanPriority, type PlanRobin, type WishlistChild } from './plan';
import { UNAVAILABLE, genderOf, pairingsOf, placedForSupports, planFor, robinRef, type SeedContext, type SeedOptions } from './seed';
import type { Edit, EditHints } from './step';
import { brokenPins, lineupRules, rulesBroken } from './pins';

const STAT_NAMES: Readonly<Record<Stat, string>> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' };

/** Couples as a key: each couple's units sorted, the couples sorted. */
const couplesKey = (cs: readonly Couple[]) =>
  cs
    .map((c) => [...c].sort().join('+'))
    .sort()
    .join(',');

/** The plan with other marriages or another Robin: rebuilt, keeping what the edit didn't touch. */
export function rebuilt(run: Run, ctx: SeedContext, options: SeedOptions, prev: Plan, robin: PlanRobin, marriages: readonly Couple[]): Plan {
  const next = planFor(run, ctx, options, robin, marriages);
  const end = next.wishlist.endpoint;
  const order = [...prev.roadmap.order].sort().join() === [...next.roadmap.order].sort().join() ? prev.roadmap.order : next.roadmap.order;
  const at = new Map(order.map((k, i) => [k, i]));
  const lineups = [...prev.roadmap.lineups.filter((l) => l.key !== end), ...next.roadmap.lineups.filter((l) => l.key === end)].sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  const sameParents = (a: WishlistChild, b: WishlistChild) => a.child === b.child && a.parents[0] === b.parents[0] && a.parents[1] === b.parents[1];
  const children = next.wishlist.children.map((c) => {
    const p = prev.wishlist.children.find((x) => sameParents(x, c));
    return p ? { ...c, passes: p.passes } : c;
  });
  // The class changes the plan had for units still in it stay as they were (a seal edit's timing, a class edit).
  const seals = next.roadmap.seals.map((x) => prev.roadmap.seals.find((y) => y.unit === x.unit && y.seal === x.seal) ?? x);
  // The EXP priorities stay as they were (spans by map key): the priority edits move them.
  return { ...next, wishlist: { ...next.wishlist, children }, roadmap: { ...next.roadmap, order, lineups, seals, ...(prev.roadmap.priorities ? { priorities: prev.roadmap.priorities } : {}) } };
}

/**
 * A plan made to keep the pins (#200; `options.pins`, the live ones): the adopted plan from before a pin was set. A
 * pinned couple it doesn't marry marries (their other marriages dropped), rebuilt as a marriage edit is; a named lineup
 * that breaks a span or keep pin is dropped (the map plays the greedy lineup, which keeps them), and a wishlist that
 * breaks one is rebuilt (the endpoint's lineup keeps them). The plan itself when it keeps them all.
 */
export function keptPins(run: Run, ctx: SeedContext, options: SeedOptions, plan: Plan): Plan {
  const pins = options.pins ?? [];
  if (!brokenPins(plan, pins)) return plan;
  const missing = pins.flatMap((p) => (isMarriagePin(p) && !plan.wishlist.marriages.some((c) => c.includes(p.couple[0]) && c.includes(p.couple[1])) ? [p.couple] : []));
  const taken = new Set(missing.flat());
  // A ruled-out couple the plan marries (#205) is dropped.
  const out = pins.filter(isRuleOut);
  const ruledOut = (c: readonly [RosterUnit, RosterUnit]) => out.some((p) => c.includes(p.couple[0]) && c.includes(p.couple[1]));
  const marriages = [...plan.wishlist.marriages.filter((c) => !c.some((u) => taken.has(u)) && !ruledOut(c)), ...missing];
  let next = rebuilt(run, ctx, options, plan, plan.robin, marriages);
  const end = next.wishlist.endpoint;
  const rules = lineupRules(pins, next.roadmap.order);
  const at = new Map(next.roadmap.order.map((k, i) => [k, i]));
  const lineups = next.roadmap.lineups.filter((l) => l.key === end || !rulesBroken(l, rules?.[at.get(l.key) ?? -1]));
  next = { ...next, roadmap: { ...next.roadmap, lineups } };
  return next;
}

/** Zero or one edit. */
const opt = (e: Edit | undefined): Edit[] => (e ? [e] : []);

/** A plan with one map's lineup named on its roadmap. */
function withLineup(plan: Plan, lineup: PlanLineup): Plan {
  const at = new Map(plan.roadmap.order.map((k, i) => [k, i]));
  const lineups = [...plan.roadmap.lineups.filter((l) => l.key !== lineup.key), lineup].sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
  return { ...plan, roadmap: { ...plan.roadmap, lineups } };
}

const fieldedIn = (l: PlanLineup): RosterUnit[] => [...l.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...l.solo];

/**
 * The single edits of a plan, in `EDIT_KINDS` order (see the module comment). `lineupsOf` resolves every map's lineup
 * on the plan's roadmap (named or greedy), in roadmap order; it's called only once the lineup edits are reached.
 */
export function* planEdits(run: Run, ctx: SeedContext, options: SeedOptions, plan: Plan, hints: EditHints, lineupsOf: (plan: Plan) => readonly PlanLineup[]): Generator<Edit> {
  const facts = run.roster.run;
  const gender = facts.gender ?? plan.robin.gender;
  const name = (u: RosterUnit) => unitName(u, null);
  const order = remainingMapOrder(run);
  const movableKey = (k: string) => order.steps.some((x) => x.key === k && x.movable);
  const mapLabel = (key: string) => {
    const s = order.steps.find((x) => x.key === key);
    const m = s && MAPS.find((d) => d.id === s.map);
    return m ? `${m.label}${s!.secret ? ' (secret route)' : ''}` : key;
  };

  // Marriages: who's fixed (recorded, pinned), who can still marry, and whom.
  const base = flawlessInput(run, ctx.assumptions, options.roleOf, []);
  const recorded: Couple[] = (base.input.married ?? []).flatMap(([a, b]) => (b === 'maiden' ? [] : [[a, b] as const]));
  const fixed = new Set<RosterUnit>(recorded.flat());
  if ((base.input.married ?? []).some(([a, b]) => a === 'chrom' && b === 'maiden')) fixed.add('chrom');
  for (const pin of options.pins ?? []) if (isMarriagePin(pin) && !pin.couple.some((u) => fixed.has(u))) pin.couple.forEach((u) => fixed.add(u));
  const ruledOut = new Set((options.pins ?? []).flatMap((p) => (isRuleOut(p) ? [[...p.couple].sort().join('+')] : [])));
  const snap = latestEntry(run)?.snapshot;
  const fielded = new Set<RosterUnit>([...base.input.army.map((a) => a.id), ...base.input.maps.flatMap((m) => [...m.joining, ...m.later].map((a) => a.id)), 'robin']);
  const units = rosterUnits({ ...facts, gender });
  const partners = new Map<RosterUnit, readonly RosterUnit[]>(units.map((u) => [u.id, u.partners]));
  const open = (u: RosterUnit) => !fixed.has(u) && fielded.has(u) && !UNAVAILABLE.has(stateOf(run.roster, u)) && snap?.states[u] !== 'dead';
  const legal = (m: RosterUnit, w: RosterUnit) => (partners.get(m) ?? []).includes(w) && !ruledOut.has([m, w].sort().join('+'));
  const couples = plan.wishlist.marriages;
  const free = couples
    .filter((c) => !c.includes(CHROM_FALLBACK_PARTNER as RosterUnit) && c.every(open))
    .map(([a, b]): Couple => (genderOf(a, gender) === 'M' ? [a, b] : [b, a]));
  const married = new Set(couples.flat());
  const singles = units.filter((u) => u.kind !== 'child' && !married.has(u.id) && open(u.id)).map((u) => u.id);
  const men = singles.filter((u) => genderOf(u, gender) === 'M');
  const women = singles.filter((u) => genderOf(u, gender) === 'F');
  // A couple that can't reach S by the endpoint wherever the paralogues go (it's fielded too late for its curve): a
  // non-starter in any plan (#194), so no edit marries it.
  const maps = base.input.maps;
  const last = maps.length - 1;
  const from = new Map<RosterUnit, number>(base.input.army.map((a) => [a.id, 0]));
  maps.forEach((m, i) => {
    for (const a of m.joining) if (!from.has(a.id)) from.set(a.id, i);
    for (const a of m.later) if (!from.has(a.id)) from.set(a.id, i + 1);
  });
  const rankOf = (a: RosterUnit, b: RosterUnit) =>
    base.input.army.find((x) => x.id === a)?.supports.find((x) => x.partner === b)?.rank ?? base.input.army.find((x) => x.id === b)?.supports.find((x) => x.partner === a)?.rank;
  const hopeless = ([a, b]: Couple) => {
    const t = pairThresholds(a, b, gender);
    if (!t) return false;
    const r = rankOf(a, b);
    const need = mapsToS(t, r ? pointsOfRank(r, t) : 0, ctx.assumptions['support-past-threshold']);
    const earliest = Math.max(from.get(a) ?? Infinity, from.get(b) ?? Infinity);
    return need === undefined || earliest + need > last;
  };
  const marriageEdit = (drop: readonly Couple[], add: readonly Couple[], label: string): Edit | undefined => {
    if (add.some(hopeless)) return undefined;
    const kept = couples.filter((c) => !drop.some((d) => couplesKey([d]) === couplesKey([c])));
    const next = [...kept, ...add];
    const units = [...new Set([...drop, ...add].flat())];
    const pins = add.map((c): PlanPin => ({ kind: 'marriage', couple: c }));
    return { kind: 'marriage', key: `marriage:${couplesKey(next)}`, label, make: () => rebuilt(run, ctx, options, plan, plan.robin, next), units, pins };
  };
  const marries = (m: RosterUnit, w: RosterUnit) => `${name(m)} marries ${name(w)}`;
  /** The children recruited on a map (a child paralogue's). */
  const childrenAt = (k: string) => [...new Set((maps.find((m) => m.key === k)?.children ?? []).map((c) => c.id))];

  // A non-starter's fixes first: its child's paralogue later, then the marriages that touch it.
  const stuck = new Set(hints.stuck);
  if (stuck.size) {
    const placed = placedForSupports(run, ctx.assumptions, plan);
    if (placed.roadmap.order.join() !== plan.roadmap.order.join()) {
      const later = placed.roadmap.order.filter((k, i) => plan.roadmap.order.indexOf(k) < i && movableKey(k));
      yield {
        kind: 'place',
        key: `place:${placed.roadmap.order.join(',')}`,
        label: `Play ${later.map(mapLabel).join(', ') || 'the child paralogues'} later, so each couple reaches S first`,
        make: () => placed,
        units: later.flatMap(childrenAt),
      };
    }
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++) {
        const [m1, w1] = free[i]!;
        const [m2, w2] = free[j]!;
        if ((stuck.has(m1) || stuck.has(m2)) && legal(m1, w2) && legal(m2, w1)) yield* opt(marriageEdit([free[i]!, free[j]!], [[m1, w2], [m2, w1]], `${marries(m1, w2)} and ${marries(m2, w1)}`));
      }
    for (const [m, w] of free) {
      if (!stuck.has(m) && !stuck.has(w)) continue;
      for (const u of women) if (legal(m, u)) yield* opt(marriageEdit([[m, w]], [[m, u]], `${marries(m, u)} instead of ${name(w)}`));
      for (const u of men) if (legal(u, w)) yield* opt(marriageEdit([[m, w]], [[u, w]], `${marries(u, w)} instead of ${name(m)}`));
    }
  }

  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) {
      const [m1, w1] = free[i]!;
      const [m2, w2] = free[j]!;
      if (legal(m1, w2) && legal(m2, w1)) yield* opt(marriageEdit([free[i]!, free[j]!], [[m1, w2], [m2, w1]], `${marries(m1, w2)} and ${marries(m2, w1)}`));
    }
  for (const [m, w] of free) {
    for (const u of women) if (legal(m, u)) yield* opt(marriageEdit([[m, w]], [[m, u]], `${marries(m, u)} instead of ${name(w)}`));
    for (const u of men) if (legal(u, w)) yield* opt(marriageEdit([[m, w]], [[u, w]], `${marries(u, w)} instead of ${name(m)}`));
  }
  for (const m of men) for (const w of women) if (legal(m, w)) yield* opt(marriageEdit([], [[m, w]], marries(m, w)));

  // Robin: another asset or flaw, where the run facts leave it open.
  const robinEdit = (r: PlanRobin, label: string): Edit => ({ kind: 'robin', key: `robin:${r.asset}-${r.flaw}`, label, make: () => rebuilt(run, ctx, options, plan, r, couples), units: ['robin'] });
  if (!facts.asset) for (const asset of STATS) if (asset !== plan.robin.asset && asset !== plan.robin.flaw) yield robinEdit({ ...plan.robin, asset }, `Robin’s asset: ${STAT_NAMES[asset]}`);
  if (!facts.flaw) for (const flaw of STATS) if (flaw !== plan.robin.flaw && flaw !== plan.robin.asset) yield robinEdit({ ...plan.robin, flaw }, `Robin’s flaw: ${STAT_NAMES[flaw]}`);

  // Each unit's class entering the roadmap, and its gender: the army, its recruits, the plan's children.
  const entering = new Map<RosterUnit, { classId: ClassId; gender: Gender }>();
  for (const a of [...base.input.army, ...base.input.maps.flatMap((m) => [...m.joining, ...m.later])]) if (!entering.has(a.id)) entering.set(a.id, { classId: a.classId, gender: a.gender });
  for (const c of plan.wishlist.children)
    if (!entering.has(c.child)) entering.set(c.child, { classId: CHILD_UNITS[c.child as ChildId].defaultClassSet[0]!, gender: CHILD_UNITS[c.child as ChildId].gender });
  if (!entering.has('robin')) entering.set('robin', { classId: 'tactician', gender });
  const cls = (id: ClassId, g: Gender) => className(id, g);

  // The endpoint class: another promotion its Master Seal reaches.
  for (const seal of plan.roadmap.seals) {
    const from = entering.get(seal.unit);
    if (!from || seal.seal !== 'master') continue;
    for (const to of promotionsOf(from.classId)) {
      if (to === seal.classId || !sealReaches(from.classId, to, from.gender, 'master')) continue;
      yield {
        kind: 'class',
        key: `class:${seal.unit}:${to}`,
        label: `${name(seal.unit)} promotes to ${cls(to, from.gender)} instead of ${cls(seal.classId, from.gender)}`,
        make: () => ({
          ...plan,
          wishlist: { ...plan.wishlist, units: plan.wishlist.units.map((w) => (w.unit === seal.unit && w.classId === seal.classId ? { ...w, classId: to } : w)) },
          roadmap: { ...plan.roadmap, seals: plan.roadmap.seals.map((x) => (x === seal ? { ...x, classId: to } : x)) },
        }),
        units: [seal.unit],
      };
    }
  }

  // One build skill: another its classes teach.
  for (const w of plan.wishlist.units) {
    const from = entering.get(w.unit)?.classId;
    const taught = [...new Set([w.classId, ...(from ? [from] : [])].flatMap((c) => (CLASS_SKILLS[c] ?? []).map((x) => x.skill)))].filter((id) => !w.build.includes(id));
    for (const [slot, now] of w.build.entries())
      for (const id of taught)
        yield {
          kind: 'build',
          key: `build:${w.unit}:${slot}:${id}`,
          label: `${name(w.unit)}’s build: ${SKILLS[id]?.name ?? id} instead of ${SKILLS[now]?.name ?? now}`,
          make: () => ({ ...plan, wishlist: { ...plan.wishlist, units: plan.wishlist.units.map((x) => (x === w ? { ...x, build: x.build.map((b, i) => (i === slot ? id : b)) } : x)) } }),
          units: [w.unit],
        };
  }

  // Passed skills: each planned pass, swapped for another the parent can pass.
  const robin = robinRef(plan.robin);
  for (const c of plan.wishlist.children) {
    if (c.passes.every((p) => p === null)) continue;
    const pairing = pairingsOf([c.parents[0], c.parents[1] === 'maiden' ? (CHROM_FALLBACK_PARTNER as RosterUnit) : c.parents[1]], robin).find((p) => p.child === c.child);
    const result = pairing && ctx.result(pairing);
    if (!result) continue;
    for (const side of [0, 1] as const) {
      const now = c.passes[side];
      const cands = side === 0 ? result.skillCandidates.fromFixed : result.skillCandidates.fromVariable;
      if (now === null || cands.fixed || (side === 1 && c.parents[1] === 'maiden')) continue;
      for (const id of cands.skills as readonly SkillId[]) {
        if (id === now || id === c.passes[1 - side]) continue;
        const passes: [SkillId | null, SkillId | null] = side === 0 ? [id, c.passes[1]] : [c.passes[0], id];
        const parent = c.parents[side] as RosterUnit;
        yield {
          kind: 'pass',
          key: `pass:${c.child}:${side}:${id}`,
          label: `${name(parent)} passes ${SKILLS[id]?.name ?? id} to ${name(c.child)} instead of ${SKILLS[now]?.name ?? now}`,
          make: () => ({ ...plan, wishlist: { ...plan.wishlist, children: plan.wishlist.children.map((x) => (x === c ? { ...x, passes } : x)) } }),
          units: [parent, c.child],
        };
      }
    }
  }

  // Lineups and pairs, on the riskiest maps first.
  if (hints.riskiest.length) {
    const resolved = lineupsOf(plan);
    const byKey = new Map(resolved.map((l, i) => [l.key, i]));
    for (const kind of ['lineup', 'pair'] as const)
      for (const key of hints.riskiest) {
        const i = byKey.get(key);
        if (i === undefined) continue;
        const l = resolved[i]!;
        const here = new Set(fieldedIn(l));
        const on = `On ${mapLabel(key)}`;
        // Its pins: span pins over this map holding the units it moves where the edit puts them.
        const edit = (what: string, label: string, next: PlanLineup, units: readonly RosterUnit[], pins: readonly PlanPin[]): Edit => ({
          kind,
          key: `${kind}:${key}:${what}`,
          label: `${on}, ${label}`,
          make: () => withLineup(plan, next),
          units,
          pins,
        });
        const swap = (x: RosterUnit, y: RosterUnit): PlanLineup => ({
          key,
          pairs: l.pairs.map((p) => ({ lead: p.lead === x ? y : p.lead, ...(p.back ? { back: p.back === x ? y : p.back } : {}) })),
          solo: l.solo.map((u) => (u === x ? y : u)),
        });
        if (kind === 'lineup') {
          const bench = [...new Set([...(resolved[i - 1] ? fieldedIn(resolved[i - 1]!) : []), ...(resolved[i + 1] ? fieldedIn(resolved[i + 1]!) : [])])].filter((u) => !here.has(u));
          for (const x of here) for (const y of bench) yield edit(`${x}>${y}`, `field ${name(y)} instead of ${name(x)}`, swap(x, y), [x, y], [mapSpanPin(x, 'out', key)]);
          continue;
        }
        const ps = l.pairs;
        for (let a = 0; a < ps.length; a++)
          for (let b = a + 1; b < ps.length; b++) {
            const [p, q] = [ps[a]!, ps[b]!];
            if (!p.back || !q.back) continue;
            const pairs = ps.map((x, n) => (n === a ? { lead: p.lead, back: q.back } : n === b ? { lead: q.lead, back: p.back } : x));
            yield edit(`${p.lead}+${q.back},${q.lead}+${p.back}`, `pair ${name(p.lead)} with ${name(q.back)} and ${name(q.lead)} with ${name(p.back)}`, { key, pairs, solo: l.solo }, [p.lead, p.back, q.lead, q.back], [
              mapSpanPin(p.lead, 'lead', key, q.back),
              mapSpanPin(q.lead, 'lead', key, p.back),
            ]);
          }
        for (const [n, p] of ps.entries()) {
          if (!p.back) continue;
          yield edit(`split:${p.lead}`, `${name(p.lead)} and ${name(p.back)} fight apart`, { key, pairs: ps.map((x, m) => (m === n ? { lead: p.lead } : x)), solo: [...l.solo, p.back] }, [p.lead, p.back], [mapSpanPin(p.back, 'solo', key)]);
          yield edit(`lead:${p.back}`, `${name(p.back)} leads ${name(p.lead)}`, { key, pairs: ps.map((x, m) => (m === n ? { lead: p.back!, back: p.lead } : x)), solo: l.solo }, [p.lead, p.back], [mapSpanPin(p.back, 'lead', key, p.lead)]);
        }
        for (let a = 0; a < l.solo.length; a++)
          for (let b = a + 1; b < l.solo.length; b++) {
            const [x, y] = [l.solo[a]!, l.solo[b]!];
            yield edit(`pair:${x}+${y}`, `${name(x)} and ${name(y)} pair up`, { key, pairs: [...ps, { lead: x, back: y }], solo: l.solo.filter((u) => u !== x && u !== y) }, [x, y], [mapSpanPin(x, 'lead', key, y)]);
          }
      }
  }

  // EXP priorities (#195): a span dropped or turned; a unit with none raised from its join map.
  const keys = plan.roadmap.order;
  const spans = plan.roadmap.priorities ?? [];
  const withSpans = (next: readonly PlanPriority[]): Plan => ({ ...plan, roadmap: { ...plan.roadmap, priorities: next } });
  const spanText = (p: PlanPriority) => (p.from === p.to ? `on ${mapLabel(p.from)}` : `from ${mapLabel(p.from)} to ${mapLabel(p.to)}`);
  const priorityEdit = (what: string, label: string, next: readonly PlanPriority[], unit: RosterUnit): Edit => ({ kind: 'priority', key: `priority:${what}`, label, make: () => withSpans(next), units: [unit] });
  for (const p of spans) {
    const tag = `${p.unit}:${p.from}-${p.to}`;
    const rest = spans.filter((x) => x !== p);
    yield priorityEdit(`${tag}:normal`, `${name(p.unit)} at normal EXP priority ${spanText(p)}`, rest, p.unit);
    const other = p.priority === 'high' ? 'low' : 'high';
    yield priorityEdit(`${tag}:${other}`, `${name(p.unit)} at ${other} EXP priority ${spanText(p)}`, spans.map((x) => (x === p ? { ...x, priority: other } : x)), p.unit);
  }
  const quarters = [...new Set([Math.floor(keys.length / 4), Math.floor(keys.length / 2), Math.floor((3 * keys.length) / 4)])].filter((i) => i > 0 && i < keys.length - 1);
  const raisable = [...new Set([...plan.wishlist.units.map((w) => w.unit), ...plan.wishlist.children.flatMap((c) => c.parents.filter((u): u is RosterUnit => u !== 'maiden'))])];
  for (const u of raisable) {
    const at = from.get(u);
    if (at === undefined || spans.some((x) => x.unit === u)) continue;
    for (const to of quarters) {
      if (to < at) continue;
      const p: PlanPriority = { unit: u, priority: 'high', from: keys[at]!, to: keys[to]! };
      yield priorityEdit(`${u}:${p.from}-${p.to}:high`, `${name(u)} at high EXP priority ${spanText(p)}`, [...spans, p], u);
    }
  }

  // Paralogue places: a child paralogue one map earlier or later.
  const movable = new Set(order.steps.filter((s) => s.movable).map((s) => s.key));
  for (const [i, k] of keys.entries()) {
    if (!movable.has(k)) continue;
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= keys.length - 1) continue;
      const next = [...keys];
      next.splice(i, 1);
      next.splice(j, 0, k);
      yield {
        kind: 'place',
        key: `place:${next.join(',')}`,
        label: `Play ${mapLabel(k)} ${j < i ? 'before' : 'after'} ${mapLabel(keys[j]!)}`,
        make: () => ({ ...plan, roadmap: { ...plan.roadmap, order: next } }),
        units: childrenAt(k),
      };
    }
  }

  // Seals: a class change needed by an earlier map, or by the endpoint.
  const n = keys.length;
  const marks = [...new Set([Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])].filter((i) => i >= 0 && i < n).map((i) => keys[i]!);
  for (const seal of plan.roadmap.seals) {
    const g = entering.get(seal.unit)?.gender ?? gender;
    for (const key of marks) {
      if (key === seal.key) continue;
      yield {
        kind: 'seal',
        key: `seal:${seal.unit}:${seal.classId}:${key}`,
        label: `${name(seal.unit)} reaches ${cls(seal.classId, g)} by ${mapLabel(key)}`,
        make: () => ({ ...plan, roadmap: { ...plan.roadmap, seals: plan.roadmap.seals.map((x) => (x === seal ? { ...x, key } : x)) } }),
        units: [seal.unit],
      };
    }
  }

  // Item uses (#193): another unit, another map, another carrier; pinned items stay as the pins have them.
  const pinnedItems = new Set((options.pins ?? []).flatMap((p) => (p.kind === 'booster' || p.kind === 'carrier' ? [p.item] : [])));
  const wishlist = plan.wishlist.units.map((w) => w.unit);
  const classOf = (u: RosterUnit) => plan.wishlist.units.find((w) => w.unit === u)?.classId ?? entering.get(u)?.classId;
  const inArmyBy = (u: RosterUnit, at: number) => (from.get(u) ?? (plan.wishlist.children.some((c) => c.child === u) ? Infinity : 0)) <= at;
  const keyAt = new Map(keys.map((k, i) => [k, i]));
  const mapOf = (k: string) => order.steps.find((s) => s.key === k)?.map ?? '';
  const stride = Math.max(1, Math.floor(keys.length / 4));
  /** The map index a quarter of the route from `i` (clamped), then on to the next map that way with a preparation phase. */
  const shifted = (i: number, dir: number): number | undefined => {
    let j = Math.min(keys.length - 1, Math.max(0, i + dir * stride));
    while (j >= 0 && j < keys.length && !hasPreparations(mapOf(keys[j]!))) j += dir;
    return j >= 0 && j < keys.length && j !== i ? j : undefined;
  };
  /** The map index a source arrives after (-1: held now). */
  const arrivesAfter = (source: string) => (source.startsWith('held:') ? -1 : (keyAt.get(source.slice(0, source.indexOf(':'))) ?? -1));
  const withItems = (items: readonly PlanItem[]): Plan => ({ ...plan, roadmap: { ...plan.roadmap, items } });
  const itemEdit = (what: string, label: string, items: readonly PlanItem[], units: readonly RosterUnit[]): Edit => ({ kind: 'item', key: `item:${what}`, label, make: () => withItems(items), units });
  const replaced = (p: PlanItem, next: PlanItem) => plan.roadmap.items.map((x) => (x === p ? next : x));
  for (const p of plan.roadmap.items) {
    if (pinnedItems.has(p.item)) continue;
    const kind = heldKind(p.item);
    const at = keyAt.get(p.key);
    if (at === undefined) continue;
    const tag = `${p.source}@${p.key}>${p.unit}`;
    if (kind === 'booster' || kind === 'tonic') {
      for (const u of wishlist)
        if (u !== p.unit && inArmyBy(u, at)) yield itemEdit(`${tag}:unit:${u}`, `${name(u)} takes ${p.item} on ${mapLabel(p.key)} instead of ${name(p.unit)}`, replaced(p, { ...p, unit: u }), [p.unit, u]);
      // A booster held from the start or found earlier can move; a tonic stays on its map's armory (a held one can move).
      if (kind === 'tonic' && p.source === 'buy') continue;
      for (const dir of [-1, 1]) {
        const j = shifted(at, dir);
        if (j === undefined || !inArmyBy(p.unit, j) || j <= arrivesAfter(p.source)) continue;
        const k = keys[j]!;
        yield itemEdit(`${tag}:map:${k}`, `${name(p.unit)} takes ${p.item} on ${mapLabel(k)} instead of ${mapLabel(p.key)}`, replaced(p, { ...p, key: k }), [p.unit]);
      }
      continue;
    }
    if (kind !== 'weapon') continue;
    const item = itemByName(p.item);
    if (!item) continue;
    for (const u of wishlist) {
      const c = classOf(u);
      if (u === p.unit || !c || !inArmyBy(u, at) || !classWeaponKinds(className(c, entering.get(u)?.gender ?? gender)).has(item.kind)) continue;
      yield itemEdit(`${tag}:carrier:${u}`, `${name(u)} carries ${p.item} from ${mapLabel(p.key)} instead of ${name(p.unit)}`, replaced(p, { ...p, unit: u }), [p.unit, u]);
    }
  }

  // Side goals (#191): none yet.
}
