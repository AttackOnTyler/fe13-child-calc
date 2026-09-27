/**
 * The flawless chance of a recorded run (#186): the run simulation's input built from the chapter log and the map
 * order. The army is the latest entry's living units with recorded stats (each unit's internal level walked from the
 * log, #185); every map still to play, next first, is simulated with its chapter data (`simMap`), its deploy count and
 * forced units, and its recruits joining as Record results would add them (`recruitSnapshot`).
 *
 * Children (#187) are read on entering the map that recruits them (their paralogue; Chapter 13 for Lucina), from their
 * fixed parent and its spouse in the run. The recorded marriages are facts; the plan's (`marriages`: the adopted plan
 * by default) are made in a run only once the pair reaches S there (#188), and an unmarried Chrom marries at the end
 * of Chapter 11 by the game's rule. So a child is listed once per spouse its fixed parent can have: the recorded one,
 * else the plan's, Chrom (for a Chapter 11 candidate) and, for Lucina, each candidate and the Maiden. A child with
 * none, or whose parent the simulation doesn't play, doesn't join (`notSimulated`, why `child`).
 *
 * Gold and items (#190): the runs start from the latest entry's gold (5,000G before any map is logged), seals and
 * weapons' uses, after its recorded shopping (#192: gold at the map's end less buys and forges, plus sales); each map carries what the open armories sell in its preparations (`openStock` over the maps cleared
 * by then), its sure income (`sureIncome`) and its sure free seals.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { MAPS, type ChapterData, type ChapterDifficulty } from '../game-data/chapters';
import { STARTING_GOLD } from '../game-data/gold';
import { mapGold } from './gold';
import { ASSET_FLAW, ROBIN_GROWTHS, ROBIN_MODIFIERS } from '../game-data/robin';
import { MOD_STATS, STATS, type Gender, type Growths, type Modifiers } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { itemByName } from '../game-data/items';
import { CLASSES } from '../game-data/classes';
import type { DeploymentRole } from '../curated/deployment';
import { assumed, isAssumed, type Assumptions } from './assumptions';
import { deployCount, deployRoleOf, forcedOn } from './deploy';
import { COUNT_CAP, tierBonus } from './exp';
import { internalLevels } from './internal-level';
import { remainingMapOrder } from './map-order';
import { unitName, type Couple, type Difficulty, type RosterUnit } from './roster';
import { EMPTY_SNAPSHOT, latestEntry, morganStart, recruitSnapshot, unitNamed, type Run, type Snapshot, type UnitSnapshot } from './run';
import { fixedPass } from './child-skills';
import { entryAfterShopping } from './shopping';
import { CHROM_FALLBACK_PARTNER, CHROM_WEDDING_CANDIDATES, CHROM_WEDDING_MAP } from '../game-data/supports';
import type { Fighter } from './solver';
import type { SimItem } from './sim/sustain';
import { classIdByName, openStock, sealAvailability, sealsHeld } from './supply';
import { simMapById } from './sim/sim-map';
import type { SimMap, SimUnit } from './sim/map-play';
import { simulateCeiling, type Ceiling } from './sim/ceiling';
import { simulateRuns, type ArmyUnit, type ChildRecruit, type RunSim, type RunSimInput, type RunSimMap } from './sim/run-sim';

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/**
 * A recorded unit as a fighter: its first weapon (the one it would equip), its weapons to choose from, and the staves
 * and other items it can spend uses of on the map (#182; the simulation uses the ones that heal or Rescue).
 */
export function fighterOf(name: string, u: UnitSnapshot): { fighter: Fighter; weapons: NonNullable<Fighter['weapon']>[]; weaponUses: (number | null)[]; items: SimItem[] } | undefined {
  if (!u.stats) return undefined;
  const held = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    return item && WEAPON_KINDS.has(item.kind) ? [{ weapon: { item, ...(h.forge ? { forge: { mt: h.forge.mt, hit: h.forge.hit, crit: h.forge.crit } } : {}) }, uses: h.uses }] : [];
  });
  const weapons = held.map((h) => h.weapon);
  const items = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    const uses = h.uses ?? item?.uses ?? 0;
    return item && (item.kind === 'staff' || item.kind === 'item') && uses > 0 ? [{ item, uses }] : [];
  });
  return { fighter: { name, className: u.class, stats: u.stats, skills: u.skills, weapon: weapons[0] }, weapons, weaponUses: held.map((h) => h.uses), items };
}

/** Why a unit of the army isn't in the simulation. */
export type NotSimulated = { readonly unit: RosterUnit; readonly why: 'no-stats' | 'unknown-class' | 'child' };

export type FlawlessOptions = {
  /** Every chance is seeded: the same run, options and seed give the same chance. */
  readonly seed?: number;
  readonly runs?: number;
  /** Each unit's deployment role for the lineups (the preparation page's); by default the roster's tag, a child leads. */
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
  /**
   * The plan's marriages (#187): who marries whom where the log hasn't recorded it, for the children they bring. By
   * default the adopted plan's, then the roster's pins.
   */
  readonly marriages?: readonly Couple[];
};

export type FlawlessChance = RunSim & {
  /** Units of the army the simulation leaves out, and why. */
  readonly notSimulated: readonly NotSimulated[];
  /** Units first seen in a class they can't join in, with no count override: their Second Seal count before the log is read as 0. */
  readonly unknownHistory: readonly RosterUnit[];
  /** The map order's endpoint key; `maps` is empty once it's recorded. */
  readonly endpoint: string;
  /** The latest entry records no gold: the runs start with none (#190). */
  readonly goldUnrecorded: boolean;
};

/**
 * The default run count. Today's plays lose a unit early on most routes, so the Full route's headline takes 0.05–0.4 s;
 * a plan whose runs all reach the endpoint would take several seconds (about 0.3 s a run), which the anytime solve's
 * Web Worker (#199) takes off the page. The ± says how far 24 runs can be trusted.
 */
export const FLAWLESS_RUNS = 24;
export const FLAWLESS_SEED = 1;

const genderOf = (run: Run, u: RosterUnit): Gender => (u === 'robin' ? (run.roster.run.gender ?? 'M') : u in CHILD_UNITS ? CHILD_UNITS[u as ChildId].gender : FIRST_GEN_UNITS[u as UnitId].gender);

/** Robin's growths and modifiers with the run's asset and flaw. */
function robinSide(run: Run): { growths: Growths; modifiers: Modifiers } {
  const { asset, flaw } = run.roster.run;
  const a = asset ? ASSET_FLAW[asset] : undefined;
  const f = flaw ? ASSET_FLAW[flaw] : undefined;
  return {
    growths: Object.fromEntries(STATS.map((s) => [s, ROBIN_GROWTHS[s] + (a?.assetGrowth[s] ?? 0) + (f?.flawGrowth[s] ?? 0)])) as Growths,
    modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, ROBIN_MODIFIERS[s] + (a?.assetModifier[s] ?? 0) + (f?.flawModifier[s] ?? 0)])) as Modifiers,
  };
}

/** A first-gen unit's or Robin's personal growths and modifiers. */
function ownSide(run: Run, u: RosterUnit, assumptions: Assumptions): { growths: Growths; modifiers: Modifiers } | undefined {
  if (u === 'robin') return robinSide(run);
  if (u in CHILD_UNITS) return undefined;
  const d = FIRST_GEN_UNITS[u as UnitId];
  return { growths: isAssumed(d.growths) ? assumed(d.growths, assumptions) : d.growths, modifiers: d.modifiers };
}

/**
 * A unit's growths and modifiers: a child's from its recorded parents (growth floor((father + mother + own) / 3),
 * modifier father + mother + 1) when both are first-gen units or Robin, else its own growths and no modifiers.
 */
function sideOf(run: Run, snap: Snapshot, u: RosterUnit, assumptions: Assumptions, spouse?: RosterUnit): { growths: Growths; modifiers: Modifiers } {
  const own = ownSide(run, u, assumptions);
  if (own) return own;
  const child = CHILD_UNITS[u as ChildId];
  const fixed = child.fixedParent;
  const bond = snap.spouses[fixed];
  const partner = spouse ?? (bond?.bond === 'married' ? bond.partner : undefined);
  const a = ownSide(run, fixed, assumptions);
  const b = partner ? ownSide(run, partner, assumptions) : undefined;
  if (!a || !b) return { growths: child.growths, modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, 0])) as Modifiers };
  return {
    growths: Object.fromEntries(STATS.map((s) => [s, Math.floor((a.growths[s] + b.growths[s] + child.growths[s]) / 3)])) as Growths,
    modifiers: Object.fromEntries(MOD_STATS.map((s) => [s, a.modifiers[s] + b.modifiers[s] + 1])) as Modifiers,
  };
}

/**
 * The simulation's input for a run: the army, the maps still to play and the seals held. Units the simulation can't
 * play are listed in `notSimulated`; units whose seal history is unknown in `unknownHistory`.
 */
export function flawlessInput(
  run: Run,
  assumptions: Assumptions,
  roleOf?: (u: RosterUnit) => DeploymentRole,
  marriages?: readonly Couple[],
): { readonly input: RunSimInput; readonly notSimulated: readonly NotSimulated[]; readonly unknownHistory: readonly RosterUnit[]; readonly endpoint: string; readonly goldUnrecorded: boolean } {
  const difficulty: Difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const order = remainingMapOrder(run);
  // The runs start from the latest entry after its shopping (#192): its gold, items and seals as they left the armory.
  const last = latestEntry(run);
  const snap = last ? entryAfterShopping(last) : EMPTY_SNAPSHOT;
  const role = roleOf ?? ((u: RosterUnit) => deployRoleOf(u, run.roster, new Map()));
  const alive = (u: RosterUnit) => run.roster.states[u] !== 'dead' && snap.states[u] !== 'dead';
  const levels = internalLevels(run, assumptions['class-change-internal-level']);
  const notSimulated: NotSimulated[] = [];
  const unknownHistory: RosterUnit[] = [];
  const gender = run.roster.run.gender;

  const armyUnit = (u: RosterUnit, s: UnitSnapshot, count: number, bonus: number | undefined): ArmyUnit | undefined => {
    const f = fighterOf(unitName(u, gender), s);
    const classId = classIdByName(s.class.trim());
    if (!f) return (notSimulated.push({ unit: u, why: 'no-stats' }), undefined);
    if (!classId) return (notSimulated.push({ unit: u, why: 'unknown-class' }), undefined);
    const side = sideOf(run, snap, u, assumptions);
    return {
      id: u,
      name: f.fighter.name,
      gender: genderOf(run, u),
      classId,
      level: s.level,
      exp: s.exp,
      count,
      bonus: bonus ?? tierBonus(CLASSES[classId].tier),
      stats: s.stats!,
      growths: side.growths,
      modifiers: side.modifiers,
      skills: s.skills,
      weapons: f.weapons,
      weaponUses: f.weaponUses,
      ...(f.items.length ? { items: f.items } : {}),
      supports: s.supports,
      role: role(u),
    };
  };

  // Marriages: the recorded ones are facts; the plan's fill in the rest, where neither partner is recorded married.
  const recorded = new Map<RosterUnit, RosterUnit>();
  for (const spouses of [run.roster.spouses, snap.spouses])
    for (const [u, sp] of Object.entries(spouses) as [RosterUnit, { partner: RosterUnit; bond: string } | undefined][]) if (sp?.bond === 'married') recorded.set(u, sp.partner);
  const planned = marriages ?? run.roster.savedPlan?.marriages ?? (Object.entries(run.roster.spouses).flatMap(([u, sp]) => (sp?.bond === 'pinned' ? [[u, sp.partner]] : [])) as Couple[]);
  const spouseOf = new Map(recorded);
  for (const [a, b] of planned) {
    if (spouseOf.has(a) || spouseOf.has(b)) continue;
    spouseOf.set(a, b);
    spouseOf.set(b, a);
  }
  // Chrom's wedding is still to come in the simulation: every candidate not married elsewhere may be his wife.
  const weddingAhead = !recorded.has('chrom') && order.steps.some((st) => st.map === CHROM_WEDDING_MAP);
  const chromCandidates: RosterUnit[] = weddingAhead ? [...CHROM_WEDDING_CANDIDATES, ...(gender === 'F' ? (['robin'] as const) : [])].filter((c) => !recorded.has(c)) : [];
  /** The spouses a fixed parent can have in a run: the recorded one, else the plan's, and Chrom's wedding's. */
  const spousesFor = (fixed: RosterUnit): RosterUnit[] => {
    const known = recorded.get(fixed);
    if (known) return [known];
    const out = new Set<RosterUnit>();
    const planned = spouseOf.get(fixed);
    if (planned) out.add(planned);
    // Lucina's mother is the Maiden while Chrom is unmarried.
    if (fixed === 'chrom') for (const c of [...chromCandidates, CHROM_FALLBACK_PARTNER as RosterUnit]) out.add(c);
    if (chromCandidates.includes(fixed)) out.add('chrom');
    return [...out];
  };
  const chromsChild = (u: RosterUnit) => u === 'lucina' || (u in CHILD_UNITS && spouseOf.get(CHILD_UNITS[u as ChildId].fixedParent) === 'chrom');
  const simulated = new Set<RosterUnit>();

  /** A child read on entering its map, from its fixed parent and a spouse that parent can have (#187). */
  const childRecruit = (u: ChildId, s: UnitSnapshot, spouse: RosterUnit): ChildRecruit | undefined => {
    const child = CHILD_UNITS[u];
    const fixed: RosterUnit = child.fixedParent;
    if (!spouse || !simulated.has(fixed) || (spouse !== 'maiden' && !simulated.has(spouse))) return undefined;
    const startClass = fixed === 'robin' ? morganStart(u, spouse, assumptions) : undefined;
    if (startClass === null) return undefined;
    const f = fighterOf(child.name, { ...s, stats: s.stats ?? Object.fromEntries(STATS.map((x) => [x, 0])) as Record<(typeof STATS)[number], number> })!;
    const side = sideOf(run, snap, u, assumptions, spouse);
    return {
      id: u,
      name: unitName(u, gender),
      parents: [fixed, spouse],
      fixed: [fixedPass(fixed, child.gender, chromsChild(fixed)), spouse === 'maiden' ? undefined : fixedPass(spouse, child.gender, chromsChild(spouse))],
      ...(startClass ? { startClass } : {}),
      growths: side.growths,
      modifiers: side.modifiers,
      weapons: f.weapons,
      ...(f.items.length ? { items: f.items } : {}),
      role: role(u),
    };
  };

  const army: ArmyUnit[] = [];
  for (const [u, s] of Object.entries(snap.units) as [RosterUnit, UnitSnapshot][]) {
    if (!alive(u)) continue;
    const il = levels.get(u);
    const count = il?.count ?? 0;
    const bonus = il?.internal !== undefined ? il.internal - s.level - Math.min(count, COUNT_CAP[difficulty]) : undefined;
    const a = armyUnit(u, s, count, bonus);
    if (!a) continue;
    army.push(a);
    simulated.add(u);
    if (il?.unknownHistory) unknownHistory.push(u);
  }
  const recordedMaps = run.entries.map((e) => e.map);

  // Recruits join as Record results adds them: the first time a map names them, from the snapshot before it.
  const seenUnits = new Set<RosterUnit>(Object.keys(snap.units) as RosterUnit[]);
  const cleared = new Set(run.entries.map((e) => e.map));
  const maps: RunSimMap[] = order.steps.map((step) => {
    const data = MAPS.find((m) => m.id === step.map)!;
    const joining: ArmyUnit[] = [];
    const mapOnly: ArmyUnit[] = [];
    const later: ArmyUnit[] = [];
    const children: ChildRecruit[] = [];
    // The map's own recruits (#184) the run takes, each with the unit it joins as (none for a child: its stats come
    // from its parents in each run); the rest aren't recruited here.
    const onMap = new Map<string, { readonly played: boolean; readonly unit?: SimUnit }>();
    for (const r of data.recruits) {
      const u = r.unit === 'Morgan' ? gender && (gender === 'M' ? 'morgan-f' : 'morgan-m') : unitNamed(r.unit);
      if (!u || (u === 'robin' && !gender) || !alive(u)) continue;
      const onlyHere = r.stats !== undefined;
      if (!onlyHere && seenUnits.has(u)) continue;
      if (u in CHILD_UNITS) {
        const snapshot = recruitSnapshot(u, run, r, snap, assumptions);
        const options = spousesFor(CHILD_UNITS[u as ChildId].fixedParent).flatMap((sp) => childRecruit(u as ChildId, snapshot, sp) ?? []);
        onMap.set(u, { played: false });
        if (options.length) {
          children.push(...options);
          seenUnits.add(u);
          simulated.add(u);
        } else if (!notSimulated.some((l) => l.unit === u)) notSimulated.push({ unit: u, why: 'child' });
        continue;
      }
      const rs = recruitSnapshot(u, run, r, snap, assumptions);
      const a = armyUnit(u, rs, 0, undefined);
      const f = fighterOf(unitName(u, gender), rs);
      // Its join data (with its staves and potions); without recorded stats, the chapter data's.
      onMap.set(u, { played: true, ...(a && f ? { unit: { id: u, fighter: f.fighter, weapons: f.weapons, ...(f.items.length ? { items: f.items } : {}) } } : {}) });
      if (!a) continue;
      if (onlyHere) mapOnly.push(a);
      else {
        seenUnits.add(u);
        simulated.add(u);
        (/^Automatically from turn 1\b/.test(r.how ?? '') ? joining : later).push(a);
      }
    }
    const opening = [...joining, ...mapOnly];
    const endpoint = step.key === order.endpoint.key;
    const m: RunSimMap = {
      key: step.key,
      label: `${data.label}${step.secret ? ' (secret route)' : ''}`,
      map: recruitsOn(simMapById(step.map, difficulty, { seen: run.seen?.[step.map] ?? {}, ...(step.map === 'apotheosis' ? { route: step.secret ? 'secret' : 'normal' } : {}) }), onMap),
      deploy: endpoint ? order.endpoint.deploy : deployCount(data.conditions[table]?.deploy ?? '', opening.map((a) => a.name)),
      forced: [...forcedOn(step.map), ...opening.map((a) => a.id)],
      joining,
      mapOnly,
      later,
      ...(children.length ? { children } : {}),
      masterSeals: sealAvailability(cleared).master === 'armory',
      armory: openStock(cleared).armory,
      income: sureIncome(data),
      seals: sureSeals(data),
    };
    cleared.add(step.map);
    return m;
  });
  const held = sealsHeld([...snap.convoy, ...Object.values(snap.units).flatMap((u) => u?.inventory ?? [])]);
  // Gold: the latest entry's; a run with no map logged yet starts with the game's 5,000G; otherwise unrecorded reads 0.
  const fresh = run.entries.every((e) => e.map === 'other');
  const goldUnrecorded = snap.gold === null && !fresh;
  const gold = snap.gold ?? (fresh ? STARTING_GOLD : 0);
  return {
    input: { army, maps, difficulty, masterSealsHeld: held.master, secondSealsHeld: held.second, gold, cleared: recordedMaps, married: couplesOf(recorded), couples: couplesOf(spouseOf).filter(([a]) => !recorded.has(a)) },
    notSimulated,
    unknownHistory,
    endpoint: order.endpoint.key,
    goldUnrecorded,
  };
}

/**
 * A map's sure income (#190): its Bullion at its sale price and Paralogue 13's gold (`mapGold`), the rows no play can
 * lose (side goals come with #191). Only Bullion is sold; every other item is held.
 */
export const sureIncome = (map: ChapterData): number => mapGold(map).reduce((a, r) => a + (r.play ? 0 : r.gold), 0);

/** The seals a map hands out that no play can lose (#190). */
function sureSeals(map: ChapterData): { master: number; second: number } {
  const count = (seal: string) => map.items.filter((r) => r.item === seal && !r.play).length;
  return { master: count('Master Seal'), second: count('Second Seal') };
}

/**
 * A map's recruits as the run takes them (#184): only those it recruits there, each played as its join data (a child
 * joins unplayed); one the run doesn't recruit is left out, so a foe recruit stays a foe. A foe that leaves once
 * talked to stays.
 */
function recruitsOn(map: SimMap, onMap: ReadonlyMap<string, { readonly played: boolean; readonly unit?: SimUnit }>): SimMap {
  if (!map.recruits) return map;
  const recruits = map.recruits.flatMap((r) => {
    if (r.departs) return [r];
    const o = onMap.get(r.id);
    if (!o) return [];
    if (!o.played) {
      const { unit: _, ...rest } = r;
      return [rest];
    }
    // An NPC all map (Tiki, asleep) plays as the chapter has it; one the army will field, as it joins.
    const npcAllMap = r.npc && !r.talk && r.arrives === undefined;
    return [o.unit && !npcAllMap ? { ...r, unit: o.unit } : r];
  });
  const { recruits: _, ...rest } = map;
  return recruits.length ? { ...rest, recruits } : rest;
}

/** Each couple once, from a map of spouses both ways. */
const couplesOf = (spouses: ReadonlyMap<RosterUnit, RosterUnit>): [RosterUnit, RosterUnit][] =>
  [...spouses].filter(([a, b]) => spouses.get(b) !== a || a < b).map(([a, b]) => [a, b]);

/** The flawless chance of a run from the next map to the endpoint (see `simulateRuns`). */
export function flawlessChance(run: Run, assumptions: Assumptions, options: FlawlessOptions = {}): FlawlessChance {
  const { input, notSimulated, unknownHistory, endpoint, goldUnrecorded } = flawlessInput(run, assumptions, options.roleOf, options.marriages);
  const sim = simulateRuns(input, options.seed ?? FLAWLESS_SEED, options.runs ?? FLAWLESS_RUNS, assumptions);
  return { ...sim, notSimulated, unknownHistory, endpoint, goldUnrecorded };
}

/**
 * The ceiling of a run (#189, see `simulateCeiling`): the endpoint's flawless chance with every unit of today's plan at
 * its effective caps; undefined once the endpoint is recorded. Lunatic+ plays it on the flawless chance's seeds.
 */
export function flawlessCeiling(run: Run, assumptions: Assumptions, options: FlawlessOptions = {}): Ceiling | undefined {
  const { input } = flawlessInput(run, assumptions, options.roleOf, options.marriages);
  return simulateCeiling(input, options.seed ?? FLAWLESS_SEED, options.runs ?? FLAWLESS_RUNS, assumptions);
}

