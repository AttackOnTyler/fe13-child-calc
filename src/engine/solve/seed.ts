/**
 * The solve's seed (#198; spec #175, The joint solve): the first plan, which the local search (#199) improves.
 *
 * - **Marriages and Robin** are matched by the Hungarian algorithm on each pairing's **endpoint coverage**: the share
 *   of the endpoint's foes (by count, waves included) its child beats in a matchup alone as Lead (`matchupWon`: in full
 *   when it one-rounds the foe and survives its round, in part for either) at effective caps in its full class (its
 *   start class promoted, as the ceiling has it), with its best play-context build and the strongest weapons the open
 *   armories sell by the endpoint forged to +5 Mt, weighted by the share of the maps still to play the child is in the
 *   army for (from after the map that recruits it). A couple's
 *   value is its children's (Morgan's included on Robin's). Robin's gender, asset and flaw, where the run facts leave
 *   them open, are chosen with it: Robin's own coverage, plus on Robin's marriage its children's (for the few asset/flaw
 *   options with the best own coverage, `ROBIN_SHORTLIST`, which keeps an open Robin's seed fast). Recorded marriages are
 *   facts and marriage pins are kept; only first-gen units (and the Maiden, as Chrom's fallback wife) are matched, and
 *   only units still to be fielded (in the army, or recruited on a map still to play).
 * - **The wishlist** is the endpoint's lineup of the army the plan makes at its full build (`ceilingArmy`), each unit in
 *   its full class with its best build from the play context's templates; each parent passes the skill its child's
 *   build wants most (the slot the build fills from that parent, else the template's first skill it can pass that the
 *   build lacks, else its best-ranked).
 * - **The roadmap** is greedy: every map but the endpoint plays the greedy lineup (forced units first, then pairs by
 *   coverage, each couple the plan marries paired until it marries), so the seed decides only the endpoint's, the
 *   wishlist's. The map order is the route's template. Its class changes (#194, `plannedSeals`) take every unit to its
 *   wishlist class (a unit off the wishlist to its best promotion) by the endpoint.
 *
 * Deterministic: the same run and pins give the same seed. Cheap: no map is played (a Full route seed takes about
 * 0.15 s, 0.2 s with Robin open, plus about 0.25 s for the builds the first time); the flawless chance is its
 * evaluation.
 */
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import { MAPS } from '../../game-data/chapters';
import type { ClassId } from '../../game-data/classes';
import { ITEMS, itemByName, type GameItem } from '../../game-data/items';
import { ASSET_FLAW, ROBIN_MODIFIERS } from '../../game-data/robin';
import type { SkillId } from '../../game-data/skills';
import { MOD_STATS, STATS, type Gender, type Modifiers, type Stat } from '../../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../../game-data/units';
import { CHROM_FALLBACK_PARTNER } from '../../game-data/supports';
import type { DeploymentRole } from '../../curated/deployment';
import type { Assumptions } from '../assumptions';
import { className } from '../classes';
import { flawlessInput, withPlanRobin } from '../flawless';
import { rosterUnits, stateOf, type RosterUnit } from '../roster';
import { latestEntry, type Run } from '../run';
import { matchup, type Fighter, type Foe, type Matchup } from '../solver';
import { classWeaponKinds, openStock } from '../supply';
import { ceilingArmy, effectiveCaps, fullClass } from '../sim/ceiling';
import type { RunSimInput } from '../sim/run-sim';
import { forgedWeapon, freshWeapon, kitForgeCost } from '../sim/upkeep';
import { plannedSeals } from '../sim/class-changes';
import type { BuildMatch, ChildResult, Pairing, ParentRef, RobinRef } from '../types';
import type { PageSubject } from '../unit-page';
import { hungarian } from './hungarian';
import type { Plan, PlanLineup, PlanPin, PlanRobin, WishlistChild, WishlistUnit } from './plan';

/** What the seed needs from the engine: pairings as it resolves them, and builds from the play context's templates. */
export type SeedContext = {
  readonly assumptions: Assumptions;
  /** A pairing's child; undefined when the pairing doesn't exist. */
  readonly result: (p: Pairing) => ChildResult | undefined;
  /** The best build for a pairing's child, from the run's play-context templates. */
  readonly childBuild: (r: ChildResult) => BuildMatch | undefined;
  /** The best build for a first-gen unit or Robin. */
  readonly unitBuild: (s: PageSubject) => BuildMatch | undefined;
  /** A skill's rank in the play context (higher is better). */
  readonly rank: (id: SkillId) => number;
};

export type SeedOptions = {
  /** Hard constraints: a pinned couple marries. */
  readonly pins?: readonly PlanPin[];
  /** Each unit's deployment role for the greedy lineups; by default the roster's tag, a child leads (until #212). */
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
};

/** A pairing's endpoint coverage: the seed's value for it. */
export type EndpointCoverage = {
  /** The endpoint's foes the child beats at caps (`matchupWon`, by count), and all its foes. */
  readonly beaten: number;
  readonly foes: number;
  /** beaten ÷ foes. */
  readonly share: number;
  /** The share of the maps still to play that the child is in the army for. */
  readonly presence: number;
  /** share × presence. */
  readonly value: number;
};

type Couple = readonly [RosterUnit, RosterUnit];

const isChild = (u: RosterUnit): u is ChildId => u in CHILD_UNITS;
const MORGAN: Readonly<Record<Gender, ChildId>> = { M: 'morgan-f', F: 'morgan-m' };
/** Children by fixed parent (Morgan's, Robin, apart). */
const BY_FIXED = new Map<RosterUnit, ChildId[]>();
for (const c of Object.keys(CHILD_UNITS) as ChildId[]) {
  const f = CHILD_UNITS[c].fixedParent;
  if (f !== 'robin') BY_FIXED.set(f, [...(BY_FIXED.get(f) ?? []), c]);
}
/** A tiny value per marriage, so a marriage worth nothing is still made (children still get born). */
const EPS = 1e-6;
const BIG = 1e12;
const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);
/** Weapons tried per kind for a class: the strongest few sold. */
const PER_KIND = 2;
export const UNAVAILABLE = new Set(['dead', 'missed', 'benched']);
/** Robin's asset/flaw options tried on Robin's marriage, when the run facts leave them open: the best few by Robin's own coverage. */
const ROBIN_SHORTLIST = 3;

export const genderOf = (u: RosterUnit, robin: Gender): Gender => (u === 'robin' ? robin : isChild(u) ? CHILD_UNITS[u].gender : FIRST_GEN_UNITS[u as UnitId].gender);
const refOf = (u: RosterUnit, robin: RobinRef): ParentRef => (u === 'robin' ? robin : { kind: 'unit', id: u as UnitId });
export const robinRef = (r: PlanRobin): RobinRef => ({ kind: 'robin', ...r });

/** The pairings a couple makes: each first-gen parent's children with the other as variable parent, Morgan on Robin's. */
export function pairingsOf([a, b]: Couple, robin: RobinRef): Pairing[] {
  const out: Pairing[] = [];
  for (const [p, q] of [[a, b], [b, a]] as const) {
    if (isChild(p) || isChild(q)) continue;
    if (p === 'robin') out.push({ child: MORGAN[robin.gender], fixedRobin: robin, variableParent: refOf(q, robin) });
    else for (const child of BY_FIXED.get(p) ?? []) out.push({ child, variableParent: refOf(q, robin) });
  }
  return out;
}

function robinModifiers(asset: Stat, flaw: Stat): Modifiers {
  const a = ASSET_FLAW[asset];
  const f = ASSET_FLAW[flaw];
  return Object.fromEntries(MOD_STATS.map((s) => [s, ROBIN_MODIFIERS[s] + (a.assetModifier[s] ?? 0) + (f.flawModifier[s] ?? 0)])) as Modifiers;
}

/**
 * How far a unit beats a foe in a matchup, 0 to 1: half for surviving the foe's round, half for the share of the foe's
 * HP one round of its own takes (all of it when it one-rounds the foe). A foe it one-rounds and survives is beaten in
 * full. At the Full route's endpoint no unit alone one-rounds most foes even at caps, so a yes-or-no would rank every
 * pairing the same.
 */
export function matchupWon(m: Matchup, foe: Foe): number {
  const dealt = m.oneRounds ? 1 : Math.min(1, (m.damage * m.hits) / Math.max(1, foe.stats.hp));
  return (m.survives ? 0.5 : 0) + dealt / 2;
}

/** The chapter data's name for a child (one `Morgan` for both genders). */
const recruitName = (c: ChildId) => CHILD_UNITS[c].name.replace(/ \([MF]\)$/, '');

/**
 * Endpoint coverage over a run's maps still to play (see the module comment): the endpoint's foes, the weapons the open
 * armories sell by then, and each child's presence. Caches within one seed.
 */
function coverageModel(input: RunSimInput, cleared: readonly string[]) {
  const maps = input.maps;
  const end = maps[maps.length - 1];
  const foes: { foe: Foe; pool: readonly string[]; weight: number }[] = end
    ? [...end.map.foes, ...end.map.waves.flatMap((w) => w.groups)].map((g) => ({ foe: g.foe, pool: g.pool ?? [], weight: g.foe.boss ? 1 : Math.max(1, g.foe.count) }))
    : [];
  const total = foes.reduce((a, f) => a + f.weight, 0);
  const stock = end?.armory?.length ? end.armory : openStock(new Set([...cleared, ...maps.slice(0, -1).map((m) => m.map.id)])).armory;
  const sold = stock.flatMap((s) => {
    const item = itemByName(s.item);
    return item && s.cost !== null && WEAPON_KINDS.has(item.kind) ? [item] : [];
  });
  const power = (i: GameItem) => (i.mt ?? 0) * (i.brave ? 2 : 1);
  const weaponsCache = new Map<string, NonNullable<Fighter['weapon']>[]>();
  /** The strongest weapons of each kind the class wields: sold ones forged to +5 Mt, else any the game prices. */
  const weaponsFor = (cls: ClassId, gender: Gender) => {
    const k = `${cls}|${gender}`;
    let found = weaponsCache.get(k);
    if (found) return found;
    found = [];
    for (const kind of classWeaponKinds(className(cls, gender))) {
      const own = sold.filter((i) => i.kind === kind);
      const pick = (own.length ? own : ITEMS.filter((i) => i.kind === kind && (i.worth ?? 0) > 0)).slice().sort((a, b) => power(b) - power(a) || a.name.localeCompare(b.name)).slice(0, PER_KIND);
      for (const item of pick) {
        const w = freshWeapon(item);
        found.push(kitForgeCost(w) !== undefined ? forgedWeapon(w) : w);
      }
    }
    weaponsCache.set(k, found);
    return found;
  };
  const beatenCache = new Map<string, number>();
  /** Foes (by count) a unit at its caps beats alone as Lead. */
  const beaten = (cls: ClassId, gender: Gender, modifiers: Modifiers, skills: readonly string[], name: string): number => {
    const k = `${cls}|${gender}|${MOD_STATS.map((s) => modifiers[s]).join(',')}|${skills.join(',')}`;
    const hit = beatenCache.get(k);
    if (hit !== undefined) return hit;
    const weapons = weaponsFor(cls, gender);
    const fighter: Fighter = { name, className: className(cls, gender), stats: effectiveCaps(cls, gender, modifiers, skills), skills, weapon: weapons[0] };
    let n = 0;
    for (const f of foes) {
      let won = 0;
      for (const weapon of weapons) {
        won = Math.max(won, matchupWon(matchup({ ...fighter, weapon }, undefined, null, f.foe, f.pool), f.foe));
        if (won >= 1) break;
      }
      n += won * f.weight;
    }
    beatenCache.set(k, n);
    return n;
  };
  const presenceCache = new Map<ChildId, number>();
  /** The share of the maps still to play a child is in the army for: from after the map that recruits it. */
  const presence = (c: ChildId): number => {
    let p = presenceCache.get(c);
    if (p !== undefined) return p;
    const name = recruitName(c);
    const at = maps.findIndex((m) => MAPS.find((d) => d.id === m.map.id)?.recruits.some((r) => r.unit === name));
    p = at < 0 || !maps.length ? 0 : (maps.length - 1 - at) / maps.length;
    presenceCache.set(c, p);
    return p;
  };
  return { foes: total, beaten, presence };
}

type Model = ReturnType<typeof coverageModel>;

const skillNames = (b: BuildMatch | undefined) => (b ? b.slots.flatMap((s) => (s.skill ? [s.skill.name] : [])) : []);
const skillIds = (b: BuildMatch | undefined): SkillId[] => (b ? b.slots.flatMap((s) => (s.skill ? [s.skill.id] : [])) : []);

/** A pairing's endpoint coverage (see the module comment); undefined when the pairing doesn't exist. */
function pairingCoverage(ctx: SeedContext, model: Model, p: Pairing): EndpointCoverage | undefined {
  const r = ctx.result(p);
  if (!r) return undefined;
  const gender = CHILD_UNITS[p.child].gender;
  const build = ctx.childBuild(r);
  const beaten = model.beaten(fullClass(r.startClass, gender), gender, r.modifiers, skillNames(build), CHILD_UNITS[p.child].name);
  return shareOf(beaten, model.foes, model.presence(p.child));
}

const shareOf = (beaten: number, foes: number, presence: number): EndpointCoverage => {
  const share = foes ? beaten / foes : 0;
  return { beaten, foes, share, presence, value: share * presence };
};

/** The endpoint coverage of one pairing in a run (the facade's, for the Why panel and tests). */
export function endpointCoverage(run: Run, ctx: SeedContext, child: ChildId, parents: Couple, robin: PlanRobin): EndpointCoverage | undefined {
  const { input } = flawlessInput(run, ctx.assumptions, undefined, []);
  const model = coverageModel(input, input.cleared ?? []);
  const r = robinRef(robin);
  const p = pairingsOf(parents, r).find((x) => x.child === child);
  return p ? pairingCoverage(ctx, model, p) : undefined;
}

/** The seed for a run (see the module comment). */
export function seedPlan(run: Run, ctx: SeedContext, options: SeedOptions = {}): Plan {
  const facts = run.roster.run;
  const base = flawlessInput(run, ctx.assumptions, options.roleOf, []);
  const model = coverageModel(base.input, base.input.cleared ?? []);
  const snap = latestEntry(run)?.snapshot;
  const recorded: Couple[] = (base.input.married ?? []).filter((c): c is Couple => c[1] !== 'maiden');
  const recordedChrom = (base.input.married ?? []).find(([a, b]) => a === 'chrom' && b === 'maiden');
  const married = new Set<RosterUnit>([...recorded.flat(), ...(recordedChrom ? ['chrom' as const] : [])]);
  const pinned: Couple[] = [];
  for (const pin of options.pins ?? []) {
    const [a, b] = pin.couple;
    if (married.has(a) || married.has(b) || pinned.some((c) => c.includes(a) || c.includes(b))) continue;
    pinned.push([a, b]);
  }
  const fixed = [...recorded, ...pinned];
  const taken = new Set<RosterUnit>(fixed.flat());
  if (recordedChrom) taken.add('chrom');
  // Units still to be fielded: in the army, or recruited on a map still to play; Robin always.
  const fielded = new Set<RosterUnit>([...base.input.army.map((a) => a.id), ...base.input.maps.flatMap((m) => [...m.joining, ...m.later].map((a) => a.id)), 'robin']);
  const alive = (u: RosterUnit) => !UNAVAILABLE.has(stateOf(run.roster, u)) && snap?.states[u] !== 'dead';

  const value = new Map<string, number>();
  /** A couple's value under a Robin: its children's coverage × presence. */
  const coupleValue = (c: Couple, robin: RobinRef) => {
    const k = `${c[0]}+${c[1]}|${c[0] === 'robin' || c[1] === 'robin' ? `${robin.gender}${robin.asset}${robin.flaw}` : ''}`;
    let v = value.get(k);
    if (v === undefined) value.set(k, (v = pairingsOf(c, robin).reduce((a, p) => a + (pairingCoverage(ctx, model, p)?.value ?? 0), 0)));
    return v;
  };

  const robinClass: ClassId = base.input.army.find((a) => a.id === 'robin')?.classId ?? 'tactician';
  const assets = facts.asset ? [facts.asset] : STATS;
  let best: { total: number; robin: PlanRobin; couples: Couple[] } | undefined;
  for (const g of facts.gender ? [facts.gender] : (['M', 'F'] as const)) {
    const combos: PlanRobin[] = assets.flatMap((asset) => (facts.flaw ? [facts.flaw] : STATS).flatMap((flaw) => (flaw === asset ? [] : [{ gender: g, asset, flaw }])));
    if (!combos.length) continue;
    const build = ctx.unitBuild(robinRef(combos[0]!));
    // Robin is in the army the whole way.
    const owns = new Map(combos.map((r) => [r, shareOf(model.beaten(fullClass(robinClass, g), g, robinModifiers(r.asset, r.flaw), skillNames(build), 'Robin'), model.foes, 1).value]));
    // Robin's marriage tries only the asset/flaw options with the best own coverage (ties in the options' order).
    const shortlist = [...combos].sort((a, b) => owns.get(b)! - owns.get(a)!).slice(0, ROBIN_SHORTLIST);
    const withSpouse = new Map<RosterUnit | undefined, { value: number; robin: PlanRobin }>();
    /** Robin's best asset/flaw with a spouse (or none): its own coverage plus the couple's children's. */
    const robinWith = (spouse: RosterUnit | undefined) => {
      let top = withSpouse.get(spouse);
      if (top) return top;
      top = { value: -Infinity, robin: shortlist[0]! };
      for (const r of spouse ? shortlist : combos) {
        const v = owns.get(r)! + (spouse ? coupleValue(['robin', spouse], robinRef(r)) : 0);
        if (v > top.value + EPS / 2) top = { value: v, robin: r };
      }
      withSpouse.set(spouse, top);
      return top;
    };
    const alone = robinWith(undefined);
    const units = rosterUnits({ ...facts, gender: g });
    const partners = new Map<RosterUnit, readonly RosterUnit[]>(units.map((u) => [u.id, u.partners]));
    partners.set(CHROM_FALLBACK_PARTNER, ['chrom']);
    const open = (u: RosterUnit) => !taken.has(u) && alive(u) && (u === CHROM_FALLBACK_PARTNER || fielded.has(u));
    const pool = [...units.filter((u) => u.kind !== 'child').map((u) => u.id), CHROM_FALLBACK_PARTNER as RosterUnit].filter(open);
    const legal = (h: RosterUnit, w: RosterUnit) => (partners.get(h) ?? []).includes(w);
    const robinFixed = fixed.find((c) => c.includes('robin'))?.find((u) => u !== 'robin');
    const edge = (h: RosterUnit, w: RosterUnit) => (h === 'robin' || w === 'robin' ? robinWith(h === 'robin' ? w : h).value - alone.value : coupleValue([h, w], robinRef(combos[0]!)));
    const men = pool.filter((u) => genderOf(u, g) === 'M');
    const women = pool.filter((u) => genderOf(u, g) === 'F');
    // Unmatched men take a dummy column at 0; each marriage gets EPS so one worth 0 still beats none.
    const cost = men.map((h) => [...women.map((w) => (legal(h, w) ? -(edge(h, w) + EPS) : BIG)), ...men.map(() => 0)]);
    const couples: Couple[] = [];
    let total = 0;
    if (men.length)
      hungarian(cost).forEach((j, i) => {
        if (j >= women.length || cost[i]![j]! >= BIG) return;
        couples.push([men[i]!, women[j]!]);
        total += edge(men[i]!, women[j]!);
      });
    const spouse = robinFixed ?? couples.find((c) => c.includes('robin'))?.find((u) => u !== 'robin');
    const robin = robinWith(spouse);
    // A matched Robin's edge already counts its gain over Robin alone.
    total += robinFixed ? robin.value : alone.value;
    for (const c of fixed) if (!c.includes('robin')) total += coupleValue(c, robinRef(robin.robin));
    if (!best || total > best.total + EPS / 2) best = { total, robin: robin.robin, couples };
  }
  const robin = best?.robin ?? { gender: facts.gender ?? 'M', asset: facts.asset ?? 'str', flaw: facts.flaw ?? (facts.asset === 'hp' ? 'str' : 'hp') };
  const marriages: Couple[] = [...recorded, ...(recordedChrom ? [['chrom', CHROM_FALLBACK_PARTNER] as const] : []), ...pinned, ...(best?.couples ?? [])];
  return planFor(run, ctx, options, robin, marriages);
}

/** The wishlist and roadmap for a set of marriages and a Robin: the endpoint's lineup, builds and passes. */
export function planFor(run: Run, ctx: SeedContext, options: SeedOptions, robin: PlanRobin, marriages: readonly Couple[]): Plan {
  const shell: Plan = {
    robin,
    wishlist: { endpoint: '', units: [], marriages, children: [], reserves: [] },
    roadmap: { order: [], lineups: [], seals: [], items: [] },
  };
  const planned = withPlanRobin(run, shell);
  const { input, endpoint } = flawlessInput(planned, ctx.assumptions, options.roleOf, marriages as Couple[] as [RosterUnit, RosterUnit][]);
  const r = robinRef(robin);
  const inArmy = new Set(input.army.map((a) => a.id));

  // Children: every child the plan's couples make (Chrom's with the Maiden while he has none), with each parent's pass.
  const spouse = new Map<RosterUnit, RosterUnit>();
  for (const [a, b] of marriages) spouse.set(a, b).set(b, a);
  const pairings = marriages.flatMap((c) => pairingsOf(c, r));
  if (!spouse.has('chrom')) pairings.push(...(BY_FIXED.get('chrom') ?? []).map((child): Pairing => ({ child, variableParent: { kind: 'unit', id: CHROM_FALLBACK_PARTNER } })));
  const children: WishlistChild[] = [];
  const builds = new Map<RosterUnit, BuildMatch | undefined>();
  for (const p of pairings) {
    const result = ctx.result(p);
    if (!result || children.some((c) => c.child === p.child)) continue;
    const fixedParent: RosterUnit = CHILD_UNITS[p.child].fixedParent;
    const other: RosterUnit = p.variableParent.kind === 'robin' ? 'robin' : p.variableParent.id;
    const build = ctx.childBuild(result);
    builds.set(p.child, build);
    const passes = inArmy.has(p.child) ? ([null, null] as const) : passesFor(ctx, result, build);
    children.push({ child: p.child, parents: [fixedParent, other === CHROM_FALLBACK_PARTNER ? 'maiden' : other], passes: other === CHROM_FALLBACK_PARTNER ? [passes[0], null] : passes });
  }

  // The endpoint's lineup at caps, each unit's full class and best build.
  const army = ceilingArmy(input, ctx.assumptions);
  const classOf = new Map(army?.fielded.map((c) => [c.unit, c.shown.classId]) ?? []);
  const buildOf = (u: RosterUnit): SkillId[] => {
    if (builds.has(u)) return skillIds(builds.get(u));
    if (u === 'robin') return skillIds(ctx.unitBuild(r));
    return isChild(u) || u === CHROM_FALLBACK_PARTNER ? [] : skillIds(ctx.unitBuild(u as Exclude<UnitId, 'maiden'>));
  };
  const units: WishlistUnit[] = [];
  const add = (unit: RosterUnit, position: WishlistUnit['position'], partner?: RosterUnit) =>
    units.push({ unit, position, ...(partner ? { partner } : {}), classId: classOf.get(unit)!, build: buildOf(unit) });
  for (const p of army?.lineup.pairs ?? []) {
    add(p.lead, 'lead', p.back);
    if (p.back) add(p.back, 'back', p.lead);
  }
  for (const u of army?.lineup.solo ?? []) add(u, 'solo');
  const lineups: PlanLineup[] = army
    ? [{ key: endpoint, pairs: army.lineup.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo: [...army.lineup.solo] }]
    : [];
  return {
    robin,
    wishlist: { endpoint, units, marriages: marriages.map(([a, b]) => [a, b] as const), children, reserves: [] },
    roadmap: { order: input.maps.map((m) => m.key), lineups, seals: plannedSeals(input, (u) => classOf.get(u), endpoint), items: [] },
  };
}

/**
 * The skill each parent passes (fixed parent first): its fixed pass; else the one the build takes from it; else the
 * template's first skill it can pass that the build lacks; else its best-ranked candidate the build lacks. Null when it
 * can pass nothing.
 */
function passesFor(ctx: SeedContext, r: ChildResult, build: BuildMatch | undefined): readonly [SkillId | null, SkillId | null] {
  const filled = new Set(skillIds(build));
  const wanted = build ? build.slots.flatMap((s) => s.options.map((o) => o.id)) : [];
  const pick = (side: 'fixed' | 'variable', not: SkillId | null): SkillId | null => {
    const c = side === 'fixed' ? r.skillCandidates.fromFixed : r.skillCandidates.fromVariable;
    if (c.fixed) return c.skills[0] ?? null;
    const fromBuild = build?.slots.find((s) => s.source?.kind === 'parent' && s.source.side === side && s.skill)?.skill?.id;
    if (fromBuild && fromBuild !== not) return fromBuild;
    const free = c.skills.filter((id) => id !== not && !filled.has(id));
    return wanted.find((id) => free.includes(id)) ?? [...free].sort((a, b) => ctx.rank(b) - ctx.rank(a))[0] ?? null;
  };
  const a = pick('fixed', null);
  return [a, pick('variable', a)];
}
