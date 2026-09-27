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
 * - **The endpoint class and one build skill:** none yet. The simulation doesn't read a plan's classes or builds until
 *   the roadmap plays its milestones (#194), and an edit it can't see would always read "no measurable difference".
 * - **Passed skills:** a parent passes another skill it can pass (not its fixed pass, nor the other parent's).
 * - **Lineups and pairs,** on the maps the best plan loses the most on (its re-score's, riskiest first), as the map's
 *   lineup resolves (named, or the greedy one): a unit fielded on a neighbouring map comes in for one fielded here; two
 *   pairs swap Backs; a pair splits; two units alone pair up. The edited lineup is named on the roadmap from then on.
 * - **Paralogue places:** a child paralogue (a movable step) moves one map earlier or later, never past the endpoint.
 * - **Seals, item uses and side goals:** none yet: the roadmap's seals are read from #194, item uses from #193, side
 *   goals from #191; each adds its edits here.
 */
import { SKILLS, type SkillId } from '../../game-data/skills';
import { MAPS } from '../../game-data/chapters';
import { CHROM_FALLBACK_PARTNER } from '../../game-data/supports';
import { STATS, type Stat } from '../../game-data/stats';
import { flawlessInput } from '../flawless';
import { remainingMapOrder } from '../map-order';
import { rosterUnits, stateOf, unitName, type Couple, type RosterUnit } from '../roster';
import { latestEntry, type Run } from '../run';
import type { Plan, PlanLineup, PlanRobin, WishlistChild } from './plan';
import { UNAVAILABLE, genderOf, pairingsOf, planFor, robinRef, type SeedContext, type SeedOptions } from './seed';
import type { Edit, EditHints } from './step';

const STAT_NAMES: Readonly<Record<Stat, string>> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' };

/** Couples as a key: each couple's units sorted, the couples sorted. */
const couplesKey = (cs: readonly Couple[]) =>
  cs
    .map((c) => [...c].sort().join('+'))
    .sort()
    .join(',');

/** The plan with other marriages or another Robin: rebuilt, keeping what the edit didn't touch. */
function rebuilt(run: Run, ctx: SeedContext, options: SeedOptions, prev: Plan, robin: PlanRobin, marriages: readonly Couple[]): Plan {
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
  return { ...next, wishlist: { ...next.wishlist, children }, roadmap: { ...next.roadmap, order, lineups } };
}

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
  for (const pin of options.pins ?? []) if (!pin.couple.some((u) => fixed.has(u))) pin.couple.forEach((u) => fixed.add(u));
  const snap = latestEntry(run)?.snapshot;
  const fielded = new Set<RosterUnit>([...base.input.army.map((a) => a.id), ...base.input.maps.flatMap((m) => [...m.joining, ...m.later].map((a) => a.id)), 'robin']);
  const units = rosterUnits({ ...facts, gender });
  const partners = new Map<RosterUnit, readonly RosterUnit[]>(units.map((u) => [u.id, u.partners]));
  const open = (u: RosterUnit) => !fixed.has(u) && fielded.has(u) && !UNAVAILABLE.has(stateOf(run.roster, u)) && snap?.states[u] !== 'dead';
  const legal = (m: RosterUnit, w: RosterUnit) => (partners.get(m) ?? []).includes(w);
  const couples = plan.wishlist.marriages;
  const free = couples
    .filter((c) => !c.includes(CHROM_FALLBACK_PARTNER as RosterUnit) && c.every(open))
    .map(([a, b]): Couple => (genderOf(a, gender) === 'M' ? [a, b] : [b, a]));
  const married = new Set(couples.flat());
  const singles = units.filter((u) => u.kind !== 'child' && !married.has(u.id) && open(u.id)).map((u) => u.id);
  const men = singles.filter((u) => genderOf(u, gender) === 'M');
  const women = singles.filter((u) => genderOf(u, gender) === 'F');
  const marriageEdit = (drop: readonly Couple[], add: readonly Couple[], label: string): Edit => {
    const kept = couples.filter((c) => !drop.some((d) => couplesKey([d]) === couplesKey([c])));
    const next = [...kept, ...add];
    return { kind: 'marriage', key: `marriage:${couplesKey(next)}`, label, make: () => rebuilt(run, ctx, options, plan, plan.robin, next) };
  };
  const marries = (m: RosterUnit, w: RosterUnit) => `${name(m)} marries ${name(w)}`;
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) {
      const [m1, w1] = free[i]!;
      const [m2, w2] = free[j]!;
      if (legal(m1, w2) && legal(m2, w1)) yield marriageEdit([free[i]!, free[j]!], [[m1, w2], [m2, w1]], `${marries(m1, w2)} and ${marries(m2, w1)}`);
    }
  for (const [m, w] of free) {
    for (const u of women) if (legal(m, u)) yield marriageEdit([[m, w]], [[m, u]], `${marries(m, u)} instead of ${name(w)}`);
    for (const u of men) if (legal(u, w)) yield marriageEdit([[m, w]], [[u, w]], `${marries(u, w)} instead of ${name(m)}`);
  }
  for (const m of men) for (const w of women) if (legal(m, w)) yield marriageEdit([], [[m, w]], marries(m, w));

  // Robin: another asset or flaw, where the run facts leave it open.
  const robinEdit = (r: PlanRobin, label: string): Edit => ({ kind: 'robin', key: `robin:${r.asset}-${r.flaw}`, label, make: () => rebuilt(run, ctx, options, plan, r, couples) });
  if (!facts.asset) for (const asset of STATS) if (asset !== plan.robin.asset && asset !== plan.robin.flaw) yield robinEdit({ ...plan.robin, asset }, `Robin’s asset: ${STAT_NAMES[asset]}`);
  if (!facts.flaw) for (const flaw of STATS) if (flaw !== plan.robin.flaw && flaw !== plan.robin.asset) yield robinEdit({ ...plan.robin, flaw }, `Robin’s flaw: ${STAT_NAMES[flaw]}`);

  // The endpoint class and one build skill: none until #194 plays them.

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
        const edit = (what: string, label: string, next: PlanLineup): Edit => ({ kind, key: `${kind}:${key}:${what}`, label: `${on}, ${label}`, make: () => withLineup(plan, next) });
        const swap = (x: RosterUnit, y: RosterUnit): PlanLineup => ({
          key,
          pairs: l.pairs.map((p) => ({ lead: p.lead === x ? y : p.lead, ...(p.back ? { back: p.back === x ? y : p.back } : {}) })),
          solo: l.solo.map((u) => (u === x ? y : u)),
        });
        if (kind === 'lineup') {
          const bench = [...new Set([...(resolved[i - 1] ? fieldedIn(resolved[i - 1]!) : []), ...(resolved[i + 1] ? fieldedIn(resolved[i + 1]!) : [])])].filter((u) => !here.has(u));
          for (const x of here) for (const y of bench) yield edit(`${x}>${y}`, `field ${name(y)} instead of ${name(x)}`, swap(x, y));
          continue;
        }
        const ps = l.pairs;
        for (let a = 0; a < ps.length; a++)
          for (let b = a + 1; b < ps.length; b++) {
            const [p, q] = [ps[a]!, ps[b]!];
            if (!p.back || !q.back) continue;
            const pairs = ps.map((x, n) => (n === a ? { lead: p.lead, back: q.back } : n === b ? { lead: q.lead, back: p.back } : x));
            yield edit(`${p.lead}+${q.back},${q.lead}+${p.back}`, `pair ${name(p.lead)} with ${name(q.back)} and ${name(q.lead)} with ${name(p.back)}`, { key, pairs, solo: l.solo });
          }
        for (const [n, p] of ps.entries()) {
          if (!p.back) continue;
          yield edit(`split:${p.lead}`, `${name(p.lead)} and ${name(p.back)} fight apart`, { key, pairs: ps.map((x, m) => (m === n ? { lead: p.lead } : x)), solo: [...l.solo, p.back] });
          yield edit(`lead:${p.back}`, `${name(p.back)} leads ${name(p.lead)}`, { key, pairs: ps.map((x, m) => (m === n ? { lead: p.back!, back: p.lead } : x)), solo: l.solo });
        }
        for (let a = 0; a < l.solo.length; a++)
          for (let b = a + 1; b < l.solo.length; b++) {
            const [x, y] = [l.solo[a]!, l.solo[b]!];
            yield edit(`pair:${x}+${y}`, `${name(x)} and ${name(y)} pair up`, { key, pairs: [...ps, { lead: x, back: y }], solo: l.solo.filter((u) => u !== x && u !== y) });
          }
      }
  }

  // Paralogue places: a child paralogue one map earlier or later.
  const movable = new Set(order.steps.filter((s) => s.movable).map((s) => s.key));
  const keys = plan.roadmap.order;
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
      };
    }
  }

  // Seals (#194), item uses (#193) and side goals (#191): none yet.
}
