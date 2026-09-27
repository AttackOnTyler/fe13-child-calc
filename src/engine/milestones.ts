/**
 * The roadmap's milestones (#194; spec #175, Milestones, the map order and readings; design #144): what the adopted
 * plan needs true before an event on its map order. Derived from the plan's roadmap and wishlist, never written by the
 * player; the milestone chances (#195) and readings (#197) attach to each by its `id`.
 *
 * Four kinds:
 * - **support**: a couple the plan marries reaches S, as a window counted in maps: the earliest start (the first map
 *   both can be fielded), the latest start (the deadline less the maps the pair's curve needs from its recorded rank,
 *   one rank a map at 3 points), and the deadline (its first recruited child's paralogue entry; Chrom's wife's is the
 *   end of Chapter 11 and can't move; a couple with no child to recruit, the endpoint). Earliest after latest is a
 *   **non-starter**.
 * - **skill**: a skill learned, for a build (by the endpoint, the only map whose build the roadmap names) or passed at
 *   a child's paralogue entry from the parent's last active slot. A pass the child already has (its start class's), or
 *   the same skill from both parents, is **wasted**. A skill already learned, and a fixed pass, need no milestone.
 * - **recruit**: each child the plan recruits: its paralogue (Lucina's Chapter 13), before the first lineup that needs it.
 * - **class**: a class change the roadmap plans (`roadmap.seals`), naming its seal and where that seal comes from (a
 *   seal held, one found on a map, else an armory selling it): early seals are scarce, so the class changes take them
 *   in deadline order. A seal play can lose (an escaping Thief, a collapsing floor) is flagged as a **risk**, as is a
 *   change with no seal in hand by its deadline.
 *
 * Ordered by where their event falls on the map order (a map's start before its end), preconditions first within one
 * event: support → (the paralogue opens) → class → skill in the last slot → (entry) → recruit.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { MAPS } from '../game-data/chapters';
import { CLASS_SKILLS, SKILLS, type SkillId } from '../game-data/skills';
import type { ClassId } from '../game-data/classes';
import { CHROM_WEDDING_MAP } from '../game-data/supports';
import type { Assumptions } from './assumptions';
import { startSkills } from './child-skills';
import { className } from './classes';
import { flawlessInput } from './flawless';
import type { RosterUnit } from './roster';
import type { Run, SupportLevel } from './run';
import { pairThresholds, pointsOfRank } from './sim/support-growth';
import type { ArmyUnit, ChildRecruit, RunSimInput } from './sim/run-sim';
import { SUPPORT_POINTS_PER_MAP } from './support-curves';
import type { Plan } from './solve/plan';

/** Where on the map order a milestone's event falls: a map's start (its preparations, a paralogue's entry) or its end. */
export type MilestonePoint = {
  /** The map's key on the roadmap's order, and its label. */
  readonly key: string;
  readonly label: string;
  /** Its place on the order: 0 is the next map. */
  readonly index: number;
  readonly when: 'start' | 'end';
};

/** A support milestone's window, counted in maps. */
export type SupportWindow = {
  /** The first map both can be fielded; undefined when one never is before the deadline. */
  readonly earliest: MilestonePoint | undefined;
  /** The last map the pair can start fighting together and still make the deadline; undefined when none is left. */
  readonly latest: MilestonePoint | undefined;
  readonly deadline: MilestonePoint;
  /** The maps together the pair's curve needs from its recorded rank. */
  readonly maps: number;
};

/** Where a class change's seal comes from. */
export type SealSource =
  | { readonly how: 'held' }
  /** Found on a map (a chest, village or drop): in hand from its end. */
  | { readonly how: 'found'; readonly at: MilestonePoint; readonly note: string }
  /** Bought: the first map whose preparations sell it. */
  | { readonly how: 'armory'; readonly at: MilestonePoint }
  | { readonly how: 'none' };

type Common = {
  /** Stable for the same plan and record: `support:a+b`, `skill:unit:skill:build`, `skill:unit:skill:pass:child`, `recruit:child`, `class:unit:class`. */
  readonly id: string;
  /** The event it must be met before. */
  readonly at: MilestonePoint;
  /** Who it counts against: both partners, the unit that learns or changes class, the child. */
  readonly units: readonly RosterUnit[];
};

export type SupportMilestone = Common & {
  readonly kind: 'support';
  readonly pair: readonly [RosterUnit, RosterUnit];
  readonly rank: SupportLevel;
  readonly window: SupportWindow;
  readonly nonStarter: boolean;
  /** Chrom's wife: the end of Chapter 11, whatever the roadmap does. */
  readonly fixed: boolean;
  /** The children the marriage is for, the plan's recruits. */
  readonly children: readonly ChildId[];
};

export type SkillMilestone = Common & {
  readonly kind: 'skill';
  readonly unit: RosterUnit;
  readonly skill: SkillId;
  readonly name: string;
  /** A class and level that teach it (the unit's own classes first); undefined for a DLC skill book. */
  readonly learn: { readonly classId: ClassId; readonly className: string; readonly level: number } | undefined;
  /** For its build, or passed to a child from the last active slot at the child's paralogue entry. */
  readonly for: { readonly kind: 'build' } | { readonly kind: 'pass'; readonly child: ChildId };
  /** A pass that gives the child nothing: it already has the skill, or the other parent passes it too. */
  readonly wasted?: 'child-has' | 'both-parents';
};

export type RecruitMilestone = Common & {
  readonly kind: 'recruit';
  readonly child: ChildId;
  readonly parents: readonly [RosterUnit, RosterUnit | 'maiden'];
  /** The first map whose lineup needs the child; undefined when none does. */
  readonly needed: MilestonePoint | undefined;
};

export type ClassMilestone = Common & {
  readonly kind: 'class';
  readonly unit: RosterUnit;
  readonly classId: ClassId;
  readonly className: string;
  readonly seal: 'master' | 'second';
  readonly source: SealSource;
  /** Why the seal isn't sure: a play that can lose it, or no seal in hand by the deadline. */
  readonly risk?: string;
};

export type Milestone = SupportMilestone | SkillMilestone | RecruitMilestone | ClassMilestone;

/** Within one event, preconditions first. */
const PHASE: Readonly<Record<Milestone['kind'], number>> = { support: 0, class: 1, skill: 2, recruit: 3 };
const RANKS: readonly SupportLevel[] = ['C', 'B', 'A', 'S'];
const SEAL_ITEM = { master: 'Master Seal', second: 'Second Seal' } as const;
const SKILL_BY_NAME = new Map(Object.entries(SKILLS).map(([id, s]) => [s.name, id as SkillId]));
const pairId = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** Maps together from `points` to S, one rank a map at most under the clamp; undefined when the pair has no S. */
function mapsToS(t: NonNullable<ReturnType<typeof pairThresholds>>, points: number, rule: Assumptions['support-past-threshold']): number | undefined {
  let maps = 0;
  for (const r of RANKS) {
    const need = t[r];
    if (need === undefined) return undefined;
    while (points < need) {
      points = rule === 'clamp' ? Math.min(need, points + SUPPORT_POINTS_PER_MAP) : points + SUPPORT_POINTS_PER_MAP;
      maps++;
    }
  }
  return maps;
}

/** Skills a unit has learned as it enters the roadmap: its equipped ones and its class's up to its level. */
function learnedOf(a: ArmyUnit): Set<SkillId> {
  const out = new Set(a.skills.flatMap((n) => SKILL_BY_NAME.get(n) ?? []));
  for (const s of CLASS_SKILLS[a.classId]) if (s.level <= a.level) out.add(s.skill);
  return out;
}

/** The milestones of a plan for a run (see the module comment), in order. */
export function milestones(run: Run, plan: Plan, assumptions: Assumptions): Milestone[] {
  const { input } = flawlessInput(run, assumptions, undefined, undefined, plan);
  const maps = input.maps;
  const last = maps.length - 1;
  if (last < 0) return [];
  const point = (index: number, when: MilestonePoint['when'] = 'start'): MilestonePoint => ({ key: maps[index]!.key, label: maps[index]!.label, index, when });
  const indexOf = new Map(maps.map((m, i) => [m.key, i]));
  const endpoint = point(last);
  const robin = [...input.army, ...maps.flatMap((m) => [...m.joining, ...m.later])].find((a) => a.id === 'robin')?.gender ?? plan.robin.gender;
  const gender = (u: RosterUnit) => (u === 'robin' ? robin : u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].gender : undefined);

  // Where each unit enters the roadmap: the army from the start, a recruit on its map (or after it), a child after its paralogue.
  const army = new Map(input.army.map((a) => [a.id, a]));
  const from = new Map<RosterUnit, number>(input.army.map((a) => [a.id, 0]));
  const units = new Map<RosterUnit, ArmyUnit>(army);
  const recruits = new Map<ChildId, { index: number; options: ChildRecruit[] }>();
  maps.forEach((m, i) => {
    for (const a of m.joining) if (!from.has(a.id)) (from.set(a.id, i), units.set(a.id, a));
    for (const a of m.later) if (!from.has(a.id)) (from.set(a.id, i + 1), units.set(a.id, a));
    for (const c of m.children ?? []) {
      if (!from.has(c.id)) from.set(c.id, i + 1);
      const r = recruits.get(c.id);
      if (!r) recruits.set(c.id, { index: i, options: [c] });
      else if (r.index === i) r.options.push(c);
    }
  });

  const out: Milestone[] = [];

  // Recruitments and passes: each child the plan recruits, at its paralogue entry.
  const recruited = new Map<ChildId, number>();
  const lineupIndex = (u: RosterUnit) => {
    const hit = plan.roadmap.lineups
      .map((l) => ({ l, i: indexOf.get(l.key) }))
      .filter((x): x is { l: (typeof plan.roadmap.lineups)[number]; i: number } => x.i !== undefined && (x.l.solo.includes(u) || x.l.pairs.some((p) => p.lead === u || p.back === u)))
      .sort((a, b) => a.i - b.i)[0];
    return hit?.i ?? (plan.wishlist.units.some((w) => w.unit === u) ? last : undefined);
  };
  for (const c of plan.wishlist.children) {
    if (army.has(c.child)) continue;
    const r = recruits.get(c.child);
    if (!r) continue;
    const option = r.options.find((o) => o.parents[0] === c.parents[0] && o.parents[1] === c.parents[1]) ?? r.options[0]!;
    recruited.set(c.child, r.index);
    const at = point(r.index);
    const needed = lineupIndex(c.child);
    out.push({ kind: 'recruit', id: `recruit:${c.child}`, at, units: [c.child], child: c.child, parents: c.parents, needed: needed === undefined ? undefined : point(needed) });
    const own = new Set(startSkills(option.startClass ?? CHILD_UNITS[c.child].defaultClassSet[0]!));
    const effective = [option.fixed?.[0] ?? c.passes[0], option.fixed?.[1] ?? c.passes[1]] as const;
    c.parents.forEach((parent, k) => {
      const skill = c.passes[k];
      if (parent === 'maiden' || !skill || option.fixed?.[k]) return;
      const wasted = own.has(skill) ? 'child-has' : k === 1 && effective[0] === skill ? 'both-parents' : undefined;
      out.push({ ...skillMilestone(parent, skill, { kind: 'pass', child: c.child }, at), ...(wasted ? { wasted } : {}) });
    });
  }

  // Supports: each couple the plan still has to marry.
  for (const [a, b] of input.couples ?? []) {
    const t = pairThresholds(a, b, robin);
    if (!t) continue;
    const rank = [units.get(a), units.get(b)].flatMap((u) => u?.supports.filter((s) => s.partner === (u.id === a ? b : a)).map((s) => s.rank) ?? []).sort((x, y) => RANKS.indexOf(y) - RANKS.indexOf(x))[0];
    const need = mapsToS(t, rank ? pointsOfRank(rank, t) : 0, assumptions['support-past-threshold']);
    if (need === undefined) continue;
    const children = plan.wishlist.children.filter((c) => recruited.has(c.child) && c.parents.includes(a) && c.parents.includes(b)).map((c) => c.child);
    const wedding = maps.findIndex((m) => m.map.id === CHROM_WEDDING_MAP);
    const fixed = (a === 'chrom' || b === 'chrom') && wedding >= 0;
    const deadline = fixed ? point(wedding, 'end') : children.length ? point(Math.min(...children.map((c) => recruited.get(c)!))) : endpoint;
    const fa = from.get(a);
    const fb = from.get(b);
    const earliest = fa === undefined || fb === undefined ? undefined : Math.max(fa, fb);
    const latest = deadline.index + (deadline.when === 'end' ? 1 : 0) - need;
    const nonStarter = earliest === undefined || earliest > latest || earliest > last;
    out.push({
      kind: 'support',
      id: `support:${pairId(a, b)}`,
      at: deadline,
      units: [a, b],
      pair: [a, b],
      rank: 'S',
      window: { earliest: earliest !== undefined && earliest <= last ? point(earliest) : undefined, latest: latest >= 0 && latest <= last ? point(latest) : undefined, deadline, maps: need },
      nonStarter,
      fixed,
      children,
    });
  }

  // Build skills: each wishlist unit's, by the endpoint, unless already learned (a child's start skills and passes count).
  for (const w of plan.wishlist.units) {
    const a = units.get(w.unit);
    const child = plan.wishlist.children.find((c) => c.child === w.unit);
    const option = recruits.get(w.unit as ChildId)?.options.find((o) => child && o.parents[0] === child.parents[0] && o.parents[1] === child.parents[1]) ?? recruits.get(w.unit as ChildId)?.options[0];
    const learned = a
      ? learnedOf(a)
      : new Set<SkillId>([
          ...(option ? startSkills(option.startClass ?? CHILD_UNITS[w.unit as ChildId].defaultClassSet[0]!) : []),
          ...[0, 1].flatMap((k) => option?.fixed?.[k] ?? child?.passes[k] ?? []),
        ]);
    for (const skill of w.build) if (!learned.has(skill)) out.push(skillMilestone(w.unit, skill, { kind: 'build' }, endpoint));
  }

  // Class changes, taking the seals in deadline order.
  out.push(...classMilestones(input, plan, point, indexOf, units));

  return out
    .map((m, i) => ({ m, i }))
    .sort((x, y) => x.m.at.index - y.m.at.index || Number(x.m.at.when === 'end') - Number(y.m.at.when === 'end') || PHASE[x.m.kind] - PHASE[y.m.kind] || x.i - y.i)
    .map((x) => x.m);

  function skillMilestone(unit: RosterUnit, skill: SkillId, why: SkillMilestone['for'], at: MilestonePoint): SkillMilestone {
    const own = [plan.wishlist.units.find((w) => w.unit === unit)?.classId, units.get(unit)?.classId, ...plan.roadmap.seals.filter((s) => s.unit === unit).map((s) => s.classId)];
    const teaching = (Object.entries(CLASS_SKILLS) as [ClassId, readonly { skill: SkillId; level: number }[]][]).flatMap(([classId, ss]) => ss.filter((s) => s.skill === skill).map((s) => ({ classId, level: s.level })));
    const best = teaching.find((x) => own.includes(x.classId)) ?? teaching[0];
    const g = gender(unit) ?? units.get(unit)?.gender;
    return {
      kind: 'skill',
      id: `skill:${unit}:${skill}:${why.kind === 'pass' ? `pass:${why.child}` : 'build'}`,
      at,
      units: [unit],
      unit,
      skill,
      name: SKILLS[skill].name,
      learn: best ? { ...best, className: className(best.classId, g) } : undefined,
      for: why,
    };
  }
}

/** Class-reached milestones (see the module comment): each planned change with its seal's source. */
function classMilestones(
  input: RunSimInput,
  plan: Plan,
  point: (index: number, when?: MilestonePoint['when']) => MilestonePoint,
  indexOf: ReadonlyMap<string, number>,
  units: ReadonlyMap<RosterUnit, ArmyUnit>,
): ClassMilestone[] {
  const maps = input.maps;
  const last = maps.length - 1;
  type Finite = { how: 'held' | 'found'; avail: number; at?: MilestonePoint; note: string; risk?: string; used: boolean };
  const finite: Record<'master' | 'second', Finite[]> = { master: [], second: [] };
  for (let n = 0; n < (input.masterSealsHeld ?? 0); n++) finite.master.push({ how: 'held', avail: 0, note: '', used: false });
  for (let n = 0; n < (input.secondSealsHeld ?? 0); n++) finite.second.push({ how: 'held', avail: 0, note: '', used: false });
  maps.forEach((m, i) => {
    for (const row of MAPS.find((d) => d.id === m.map.id)?.items ?? [])
      for (const seal of ['master', 'second'] as const)
        if (row.item === SEAL_ITEM[seal]) finite[seal].push({ how: 'found', avail: i + 1, at: point(i, 'end'), note: row.how, ...(row.play ? { risk: row.play.note } : {}), used: false });
  });
  const armory = (seal: 'master' | 'second') =>
    maps.findIndex((m) => (m.armory?.length ? m.armory.some((a) => a.item === SEAL_ITEM[seal] && a.cost !== null) : seal === 'master' && m.masterSeals));

  const changes = plan.roadmap.seals
    .map((s, order) => ({ s, order, by: indexOf.get(s.key) ?? last }))
    .filter(({ s }) => units.get(s.unit)?.classId !== s.classId)
    .sort((a, b) => a.by - b.by || a.order - b.order);
  return changes.map(({ s, by }) => {
    const free = finite[s.seal].find((f) => !f.used && f.avail <= by);
    const shop = armory(s.seal);
    let source: SealSource;
    let risk: string | undefined;
    if (free) {
      free.used = true;
      source = free.how === 'held' ? { how: 'held' } : { how: 'found', at: free.at!, note: free.note };
      risk = free.risk;
    } else if (shop >= 0 && shop <= by) source = { how: 'armory', at: point(shop) };
    else {
      source = { how: 'none' };
      risk = `No ${SEAL_ITEM[s.seal]} is in hand by ${maps[by]!.label}.`;
    }
    const gender = units.get(s.unit)?.gender ?? (s.unit in CHILD_UNITS ? CHILD_UNITS[s.unit as ChildId].gender : s.unit === 'robin' ? plan.robin.gender : undefined);
    return {
      kind: 'class' as const,
      id: `class:${s.unit}:${s.classId}`,
      at: point(by),
      units: [s.unit],
      unit: s.unit,
      classId: s.classId,
      className: className(s.classId, gender),
      seal: s.seal,
      source,
      ...(risk ? { risk } : {}),
    };
  });
}
