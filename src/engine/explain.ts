/**
 * Every number's explanation (#210; spec #175, The Why panel and Engine interfaces): its value, one sentence on what it
 * is, its math, the rows that moved it (each optionally pointing to a deeper explanation), where the trail stops, and
 * the blind spots touching it, each with its lean. The Why panel only renders this tree; the reference shape is the
 * prototype's on branch `prototype/number-drilldown` (variant B).
 *
 * - **Ids** name a number: `flawless`, `ceiling`, `map:<key>`, `fight:<key>:<turn>:<n>` (the n-th fight of a turn in a
 *   map's representative play; `fight:ceiling:…` in the ceiling's), `edit:<key>` (a comparison the page hands over:
 *   a proposal, a close call, an edit's or pins' cost, a Robin, a reserve, What changed), `worth:<unit>`,
 *   `milestone:<id>`, `exp:<key>:<unit>`, `gold:<key>`, `side-goal:<id>`, `item:<key>:<source>`.
 * - **Drill paths:** headline → map → fight; edit → maps; worth → lineup spans → maps; milestone chance → EXP per map
 *   → the forecast's foe groups (where the EXP trail stops). The ceiling's rows are its own fights.
 * - **The headline's lost points** are split between maps by share of the risk: each map's log no-death chance over the
 *   sum of them, so the rows add up to the points lost; maps under about 0.5 points are grouped. A map's points split
 *   again between the fights of a representative play by the same log share.
 * - **A representative play** is one play of the map by the plan's lineup there, on the flawless chance's first run's
 *   seed: the next map with the army as recorded; later maps with each unit's stats moved from its recorded stats
 *   toward its expected stats entering the endpoint by the share of its forecast EXP earned before the map (and its
 *   class from the plan's seals); the endpoint at the expected stats. Children join the play only at the endpoint
 *   (their join stats vary by run). Its fights say where the risk is; its chance isn't the map's.
 * - **Blind spots** are exactly those touching the number's kind (`blindSpotsTouching`). Numbers carry no markers; the
 *   simulation error shows in the math.
 */
import { BLIND_SPOTS, type Assumptions, type BlindSpot, type BlindSpotTouch } from './assumptions';
import { className } from './classes';
import type { Milestone, MilestonePoint } from './milestones';
import type { DeploymentRole } from '../curated/deployment';
import type { Readings } from './readings';
import { unitName, type RosterUnit } from './roster';
import type { Run } from './run';
import { bestWeapon, type Fighter } from './solver';
import { ceilingArmy, type Ceiling } from './sim/ceiling';
import { playMap, type MapPlay, type SimFight, type SimFoeGroup, type SimGroup, type SimMap, type SimUnit } from './sim/map-play';
import { runSeed } from './sim/random';
import type { ArmyUnit, RunSim, RunSimInput } from './sim/run-sim';
import { simLineup } from './sim/sim-map';
import type { Plan } from './solve/plan';
import type { UnitWorth } from './solve/worth';
import { STATS, STAT_LABELS, type Gender, type Stat } from '../game-data/stats';

export type ExplanationKind = 'flawless' | 'ceiling' | 'map' | 'fight' | 'edit' | 'worth' | 'milestone' | 'exp' | 'gold' | 'side-goal' | 'item';

/**
 * How the value reads: a chance (percent, "1 run in N" near the edges), a fight's kill chance ("kills someone about 1
 * run in N"), a difference in points with its ± ("+1.2 ±0.3", a close call "no measurable difference"), points lost
 * (worth), gold, EXP.
 */
export type ExplanationFormat = 'chance' | 'kill' | 'difference' | 'points' | 'gold' | 'exp';

export type ExplanationRow = {
  readonly label: string;
  /** Flawless chance it moves, in chance (0.012 is 1.2 points; a loss negative), where the rows split the number. */
  readonly points?: number;
  /** A chance it reads: a map's no-death chance, or with `kill` a fight's kill chance. */
  readonly chance?: number;
  readonly kill?: boolean;
  readonly value?: string;
  /** A deeper explanation's id. */
  readonly drillTo?: string;
};

export type Explanation = {
  readonly id: string;
  readonly kind: ExplanationKind;
  readonly title: string;
  /** A chance (0–1), a difference or points lost in chance (0.012 is 1.2 points), gold or EXP. */
  readonly value: number;
  readonly format: ExplanationFormat;
  /** Its simulation error (±, 95%), in the value's scale. */
  readonly margin?: number;
  /** A close call: no measurable difference. */
  readonly close?: boolean;
  /** One sentence: what this number is. */
  readonly lead: string;
  readonly math: readonly string[];
  readonly rowsTitle?: string;
  readonly rows?: readonly ExplanationRow[];
  /** Where the trail stops, when it stops here. */
  readonly stop?: string;
  /** A fight: the map (its id) and foe whose matchup the trail stops at. */
  readonly matchup?: { readonly map: string; readonly foe: string };
  /** Only those touching this number's kind, each with its lean. */
  readonly blindSpots: readonly BlindSpot[];
  /** The rows wait for another plan's runs (`ExplainContext.comparisons[…].other`, `.without`): what the page can work out. */
  readonly pending?: 'other' | 'without';
};

/**
 * A difference the page shows (#210, `edit:<key>`): what it compares, its gain and paired error (±, 95%), and, once the
 * page has worked them out (the solve's worker), the other plan's runs for its per-map rows.
 */
export type Comparison = {
  readonly kind: 'proposal' | 'close-call' | 'edit' | 'pin-cost' | 'robin' | 'reserve' | 'changed' | 'cost';
  readonly label: string;
  readonly gain: number;
  readonly margin: number;
  readonly runs?: number;
  readonly close?: boolean;
  readonly settled?: boolean;
  /** Its per-map rows can be worked out: the page holds the other plan. */
  readonly drill?: boolean;
  /** The other plan's runs, on the headline's seed. */
  readonly other?: RunSim;
  /** The runs of the plan it's compared against, on the same seed; absent: the headline's. */
  readonly base?: RunSim;
};

/** What the numbers were worked out from: the page hands over what it holds, the facade fills in the rest. */
export type ExplainContext = {
  readonly run?: Run;
  /** The plan the headline's chance is (the solve's best, or the adopted plan). */
  readonly plan?: Plan;
  readonly roleOf?: (u: RosterUnit) => DeploymentRole;
  /** The simulation input (hand-built, or the run's for the plan). */
  readonly input?: RunSimInput;
  /** The headline's runs. */
  readonly chance?: RunSim;
  readonly seed?: number;
  readonly ceiling?: Ceiling;
  readonly readings?: Readings;
  readonly milestones?: readonly Milestone[];
  readonly worth?: readonly UnitWorth[];
  /** A unit's worth's other side: the plan's runs without it (`worthChance`), by unit. */
  readonly without?: Readonly<Partial<Record<string, RunSim>>>;
  readonly comparisons?: Readonly<Record<string, Comparison>>;
};

/** The blind spots each kind of number rests on (see `BlindSpotTouch`). */
const TOUCHED: Readonly<Record<ExplanationKind, readonly BlindSpotTouch[]>> = {
  flawless: ['map', 'flawless'],
  edit: ['map', 'flawless'],
  worth: ['map', 'flawless'],
  gold: ['flawless'],
  'side-goal': ['flawless'],
  item: ['flawless'],
  ceiling: ['map'],
  map: ['map'],
  fight: ['fight'],
  milestone: ['milestone'],
  exp: ['milestone'],
};

/** The stated blind spots touching a kind of number: exactly those the Why panel lists beside it. */
export const blindSpotsTouching = (kind: ExplanationKind): readonly BlindSpot[] => BLIND_SPOTS.filter((b) => b.touches.some((t) => TOUCHED[kind].includes(t)));

/** Maps whose share of the headline's lost points is under this are grouped. */
export const QUIET_POINTS = 0.005;
/** Fights listed on a map, riskiest first; the rest are grouped. */
const FIGHT_ROWS = 8;
/** A fight whose kill chance is under this is grouped with the other quiet fights. */
const QUIET_FIGHT = 0.001;
const TINY = 1e-12;

/** Points of chance: 0.012 → "1.2". */
const pts = (p: number) => (Math.abs(p) * 100).toFixed(1);
/** A chance in a sentence, capped like the page's: "over 99.9%", "under 0.1%". */
const pct = (p: number) => (p >= 1 ? '100%' : p <= 0 ? '0%' : p > 0.999 ? 'over 99.9%' : p < 0.001 ? 'under 0.1%' : `${(p * 100).toFixed(1)}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const riskOf = (survive: number) => -Math.log(Math.max(survive, TINY));

/**
 * Lost chance split by share of the risk: each item's log no-death chance over the sum of them, so the parts add up to
 * `lost`. Items with no chance (no run reaches them) get none.
 */
export function riskSplit(lost: number, items: readonly { readonly key: string; readonly noDeath: number | undefined }[]): Map<string, number> {
  const logs = items.map((m) => [m.key, m.noDeath === undefined ? 0 : riskOf(m.noDeath)] as const);
  const sum = logs.reduce((a, [, l]) => a + l, 0);
  return new Map(logs.map(([k, l]) => [k, sum > 0 ? (lost * l) / sum : 0]));
}

/** What the explanations read, resolved by the facade. */
export type Resolved = {
  readonly assumptions: Assumptions;
  readonly input: RunSimInput | undefined;
  readonly chance: RunSim | undefined;
  readonly seed: number;
  readonly gender: Gender | null;
  readonly ceiling: () => Ceiling | undefined;
  readonly milestones: readonly Milestone[];
  readonly readings: Readings | undefined;
  readonly worth: readonly UnitWorth[];
  readonly without: Readonly<Partial<Record<string, RunSim>>>;
  readonly comparisons: Readonly<Record<string, Comparison>>;
};

/** A number's explanation, or undefined when there's nothing to explain it from (an unknown id, or its data isn't in). */
export function explain(id: string, c: Resolved): Explanation | undefined {
  const [head, ...rest] = id.split(':');
  const tail = rest.join(':');
  switch (head) {
    case 'flawless':
      return flawless(c);
    case 'ceiling':
      return ceilingExplanation(c);
    case 'map':
      return mapExplanation(c, tail);
    case 'fight':
      return fightExplanation(c, id);
    case 'edit':
      return editExplanation(c, tail);
    case 'worth':
      return worthExplanation(c, tail as RosterUnit);
    case 'milestone':
      return milestoneExplanation(c, tail);
    case 'exp':
      return expExplanation(c, id);
    case 'gold':
      return goldExplanation(c, tail);
    case 'side-goal':
      return sideGoalExplanation(c, tail);
    case 'item':
      return itemExplanation(c, id);
    default:
      return undefined;
  }
}

/** A unit's name: as the simulation's army names it (a hand-built input), else the roster's. */
function nameOf(c: Resolved, u: RosterUnit | 'maiden'): string {
  if (u === 'maiden') return unitName(u, c.gender);
  const a = c.input && [...c.input.army, ...c.input.maps.flatMap((m) => [...m.joining, ...m.later, ...(m.children ?? [])])].find((x) => x.id === u);
  return a?.name ?? unitName(u, c.gender);
}

const made = (e: Omit<Explanation, 'blindSpots'>): Explanation => ({ ...e, blindSpots: blindSpotsTouching(e.kind) });

// ---- the headline ----

function flawless(c: Resolved): Explanation | undefined {
  const r = c.chance;
  if (!r?.maps.length) return undefined;
  const lost = 1 - r.chance;
  const split = riskSplit(lost, r.maps);
  const reached = r.maps.filter((m) => m.noDeath !== undefined);
  const unreached = r.maps.filter((m) => m.noDeath === undefined);
  const quiet = reached.filter((m) => split.get(m.key)! < QUIET_POINTS);
  const grouped = quiet.length > 1 ? quiet : [];
  const loud = reached.filter((m) => !grouped.includes(m)).sort((a, b) => split.get(b.key)! - split.get(a.key)!);
  const rows: ExplanationRow[] = loud.map((m) => ({ label: m.label, points: -split.get(m.key)!, chance: m.noDeath!, drillTo: `map:${m.key}` }));
  if (grouped.length) {
    const low = Math.min(...grouped.map((m) => m.noDeath!));
    const high = Math.max(...grouped.map((m) => m.noDeath!));
    rows.push({ label: `${grouped.length} quieter maps, each under ${pts(QUIET_POINTS)} points`, points: -grouped.reduce((a, m) => a + split.get(m.key)!, 0), value: `each ${pct(low)}–${pct(high)} no-death` });
  }
  const first = r.maps[0]!.label;
  const last = r.maps[r.maps.length - 1]!.label;
  return made({
    id: 'flawless',
    kind: 'flawless',
    title: 'Flawless chance',
    value: r.chance,
    format: 'chance',
    margin: r.margin,
    lead: `The chance this plan clears ${last} with no unit dying, from ${first} on.`,
    math: [
      `The mean over ${plural(r.runs, 'simulated run')} of each run’s product of its maps’ no-death chances (stats, EXP and gold differ run to run).`,
      `${pts(lost)} points are lost on the way. Each map’s row is its share of the risk (its log no-death chance over the sum of all the maps’), so the rows add up to that.`,
      ...(unreached.length ? [`No run reaches ${listOf(unreached.map((m) => m.label))} with nobody lost: ${unreached.length === 1 ? 'it counts' : 'they count'} no risk here.`] : []),
      `Simulation error: ±${pts(r.margin)} (95%).`,
    ],
    rowsTitle: 'Where the points go, by map',
    rows,
  });
}

// ---- representative plays ----

type RepUnit = { readonly unit: SimUnit; readonly name: string; readonly low?: Readonly<Record<Stat, number>>; readonly high?: Readonly<Record<Stat, number>> };

/** One play of a map by a lineup, with who's in it and the foes' groups (see the module comment). */
type Rep = {
  readonly map: SimMap;
  readonly label: string;
  readonly play: MapPlay;
  readonly lineup: readonly SimGroup[];
  readonly units: ReadonlyMap<string, RepUnit>;
  readonly groups: ReadonlyMap<string, SimFoeGroup>;
  /** How its stats were read: as recorded, moved toward the endpoint's forecast, the forecast, or caps. */
  readonly how: 'recorded' | 'projected' | 'forecast' | 'caps';
  /** Units of the lineup left out of the play (no stats to read there). */
  readonly left: readonly string[];
};

const REPS = new WeakMap<RunSim, Map<number, Rep | undefined>>();
const CEILING_REPS = new WeakMap<RunSimInput, Map<number, Rep | undefined>>();

const groupsOf = (map: SimMap): Map<string, SimFoeGroup> => new Map([...map.foes, ...map.waves.flatMap((w) => w.groups)].map((g) => [g.key, g]));

const round = (x: number) => Math.round(x);
const statsMap = (f: (s: Stat) => number) => Object.fromEntries(STATS.map((s) => [s, f(s)])) as Record<Stat, number>;

/** Map `i`'s representative play (see the module comment); undefined when no run reached it or its lineup can't be fielded. */
function representative(c: Resolved, i: number): Rep | undefined {
  const r = c.chance;
  const input = c.input;
  if (!r || !input) return undefined;
  let byIndex = REPS.get(r);
  if (!byIndex) REPS.set(r, (byIndex = new Map()));
  if (byIndex.has(i)) return byIndex.get(i);
  const rep = buildRep(c, r, input, i);
  byIndex.set(i, rep);
  return rep;
}

function buildRep(c: Resolved, r: RunSim, input: RunSimInput, i: number): Rep | undefined {
  const step = input.maps[i];
  const result = r.maps.find((m) => m.key === step?.key);
  if (!step || !result?.lineup) return undefined;
  const last = input.maps.length - 1;
  const base = new Map<RosterUnit, ArmyUnit>();
  for (const a of [...input.army, ...input.maps.slice(0, i).flatMap((m) => [...m.joining, ...m.later]), ...step.joining, ...step.mapOnly]) if (!base.has(a.id)) base.set(a.id, a);
  const expOf = (u: RosterUnit, j: number) => r.exp.find((x) => x.key === input.maps[j]!.key)?.units.find((x) => x.unit === u)?.exp ?? 0;
  const keyIndex = new Map(input.maps.map((m, j) => [m.key, j]));
  const units = new Map<RosterUnit, RepUnit>();
  const how: Rep['how'] = i === 0 ? 'recorded' : i === last ? 'forecast' : 'projected';
  for (const a of base.values()) {
    const f = r.units.find((x) => x.id === a.id);
    const weapons = a.weapons;
    if (i === 0 || !f) {
      const fighter: Fighter = { name: a.name, className: className(a.classId, a.gender), stats: a.stats, skills: a.skills, weapon: weapons[0] };
      units.set(a.id, { unit: { id: a.id, fighter, weapons, ...(a.items?.length ? { items: a.items } : {}) }, name: a.name });
      continue;
    }
    let before = 0;
    let total = 0;
    for (let j = 0; j < last; j++) {
      const e = expOf(a.id, j);
      total += e;
      if (j < i) before += e;
    }
    const t = total > 0 ? before / total : i / last;
    const toward = (s: Stat, to: number) => round(a.stats[s] + t * (to - a.stats[s]));
    const seal = (input.seals ?? []).filter((s) => s.unit === a.id && (keyIndex.get(s.key) ?? Infinity) <= i).pop();
    const cls = i === last ? f.className : className(seal?.classId ?? a.classId, a.gender);
    const fighter: Fighter = { name: a.name, className: cls, stats: statsMap((s) => toward(s, f.stats[s].median)), skills: i === last ? f.skills : a.skills, weapon: weapons[0] };
    units.set(a.id, {
      unit: { id: a.id, fighter, weapons, ...(a.items?.length ? { items: a.items } : {}) },
      name: a.name,
      low: statsMap((s) => toward(s, f.stats[s].low)),
      high: statsMap((s) => toward(s, f.stats[s].high)),
    });
  }
  // Children: at the endpoint only, at their forecast (their join stats vary by run).
  if (i === last)
    for (const kid of input.maps.slice(0, i).flatMap((m) => m.children ?? [])) {
      const f = r.units.find((x) => x.id === kid.id);
      if (!f || units.has(kid.id)) continue;
      const fighter: Fighter = { name: kid.name, className: f.className, stats: statsMap((s) => f.stats[s].median), skills: f.skills, weapon: kid.weapons[0] };
      units.set(kid.id, { unit: { id: kid.id, fighter, weapons: kid.weapons, ...(kid.items?.length ? { items: kid.items } : {}) }, name: kid.name, low: statsMap((s) => f.stats[s].low), high: statsMap((s) => f.stats[s].high) });
    }
  const lineup = simLineup(result.lineup, new Map([...units].map(([id, u]) => [id, u.unit])));
  const left = result.lineup.deployed.filter((u) => !units.has(u)).map((u) => nameOf(c, u));
  if (!lineup.length) return undefined;
  const priority = input.priority?.[i];
  const play = playMap({ map: step.map, lineup, ...(priority ? { priority } : {}) }, runSeed(runSeed(c.seed, 0), i));
  return { map: step.map, label: step.label, play, lineup, units, groups: groupsOf(step.map), how, left };
}

/** The ceiling's play (its first, on the flawless chance's first run's seed), with the capped army. */
function ceilingRep(c: Resolved): Rep | undefined {
  const input = c.input;
  if (!input) return undefined;
  let bySeed = CEILING_REPS.get(input);
  if (!bySeed) CEILING_REPS.set(input, (bySeed = new Map()));
  if (bySeed.has(c.seed)) return bySeed.get(c.seed);
  const at = ceilingArmy(input, c.assumptions);
  let rep: Rep | undefined;
  if (at) {
    const units = new Map(at.fielded.map((u) => [u.unit, { unit: { id: u.unit, fighter: u.fighter, weapons: u.weapons, ...(u.items?.length ? { items: u.items } : {}) }, name: u.fighter.name } as RepUnit]));
    const lineup = simLineup(at.lineup, new Map([...units].map(([id, u]) => [id, u.unit])));
    const last = input.maps.length - 1;
    const play = playMap({ map: at.end.map, lineup }, runSeed(runSeed(c.seed, 0), last));
    rep = { map: at.end.map, label: at.end.label, play, lineup, units, groups: groupsOf(at.end.map), how: 'caps', left: [] };
  }
  bySeed.set(c.seed, rep);
  return rep;
}

const nameIn = (rep: Rep, id: string) => rep.units.get(id)?.name ?? id;

/**
 * A play's fights as rows: like fights (the same front, back, foe group and phase) together, riskiest first, each its
 * share of `lost` (log share), the quiet ones grouped. A row drills to its first fight.
 */
function fightRows(rep: Rep, lost: number, prefix: string): ExplanationRow[] {
  type Like = { turns: number[]; first: { turn: number; n: number }; f: SimFight; risk: number };
  const byKind = new Map<string, Like>();
  let total = 0;
  for (const t of rep.play.log)
    t.fights.forEach((f, n) => {
      const risk = riskOf(f.survive);
      total += risk;
      if (risk <= 0) return;
      const k = `${f.phase}|${f.lead}|${f.back ?? ''}|${f.foe}`;
      const like = byKind.get(k);
      if (!like) byKind.set(k, { turns: [t.turn], first: { turn: t.turn, n }, f, risk });
      else {
        if (like.turns[like.turns.length - 1] !== t.turn) like.turns.push(t.turn);
        like.risk += risk;
      }
    });
  const share = (x: { risk: number }) => (total > 0 ? (lost * x.risk) / total : 0);
  // Like fights' chance of killing someone together: one less the chance all of them are survived.
  const kill = (x: Like) => 1 - Math.exp(-x.risk);
  const risky = [...byKind.values()].filter((x) => kill(x) >= QUIET_FIGHT).sort((a, b) => b.risk - a.risk);
  const shown = risky.slice(0, FIGHT_ROWS);
  const rest = [...byKind.values()].filter((x) => !shown.includes(x));
  const turns = (xs: readonly number[]) =>
    xs.length === 1 ? `Turn ${xs[0]}` : xs[xs.length - 1]! - xs[0]! === xs.length - 1 ? `Turns ${xs[0]}–${xs[xs.length - 1]}` : `${xs.length} turns from ${xs[0]}`;
  const rows: ExplanationRow[] = shown.map((x) => ({
    label: `${turns(x.turns)}, ${x.f.phase === 'player' ? 'player' : 'enemy'} phase: ${nameIn(rep, x.f.lead)}${x.f.back ? ` + ${nameIn(rep, x.f.back)}` : ''} vs ${rep.groups.get(x.f.foe)?.foe.name ?? x.f.foe}`,
    chance: kill(x),
    kill: true,
    points: -share(x),
    drillTo: `${prefix}:${x.first.turn}:${x.first.n}`,
  }));
  if (rest.length) rows.push({ label: `${plural(rest.length, 'other kind')} of fight${risky.length > FIGHT_ROWS ? '' : ', each under 0.1% to kill'}`, points: -rest.reduce((a, x) => a + share(x), 0) });
  return rows;
}

const HOW: Readonly<Record<Rep['how'], string>> = {
  recorded: 'the army as your latest entry records it',
  projected: 'each unit’s stats moved from its recorded stats toward its expected stats entering the endpoint by the share of its forecast EXP earned before this map, its class from the plan’s seals',
  forecast: 'each unit at its expected stats entering it (the median over the runs)',
  caps: 'every unit at its effective caps',
};

function repMath(rep: Rep): string[] {
  return [
    `The fights below come from one representative play of the map by the plan’s lineup, on the first run’s seed, with ${HOW[rep.how]}. Their shares split this map’s points (log share), and say where its risk is; that play’s own chance, ${pct(rep.play.noDeath)}, isn’t the map’s.`,
    ...(rep.left.length ? [`Left out of that play (no stats to read there): ${listOf(rep.left)}.`] : []),
  ];
}

// ---- maps and fights ----

function mapExplanation(c: Resolved, key: string): Explanation | undefined {
  const r = c.chance;
  const i = r?.maps.findIndex((m) => m.key === key) ?? -1;
  const m = r?.maps[i];
  if (!r || !m || m.noDeath === undefined) return undefined;
  const lost = riskSplit(1 - r.chance, r.maps).get(key)!;
  const index = c.input?.maps.findIndex((x) => x.key === key) ?? -1;
  const rep = index >= 0 ? representative(c, index) : undefined;
  const rows = rep ? fightRows(rep, lost, `fight:${key}`) : undefined;
  return made({
    id: `map:${key}`,
    kind: 'map',
    title: `${m.label}: no-death chance`,
    value: m.noDeath,
    format: 'chance',
    lead: `The chance nobody dies on ${m.label}, for the runs that reach it with nobody lost.`,
    math: [
      'Worked out exactly from the fights each run plays on it, turn by turn (each exposed pair takes one enemy-phase attack), weighted by each run’s chance of getting there.',
      `${pct(m.reach)} of the chance reaches it; it costs the flawless chance ${pts(lost)} points, its share of the risk.`,
      ...(m.turns !== undefined ? [`Expected turns: ${m.turns.toFixed(1)}.`] : []),
      ...(rep ? repMath(rep) : []),
    ],
    ...(rows?.length ? { rowsTitle: 'Fights that can kill someone', rows } : {}),
    ...(!rows?.length
      ? { stop: rep ? 'No fight in its representative play puts anyone at risk: the trail stops here.' : 'The trail stops here: no lineup to replay (no run of the plan fields one on it with nobody lost).' }
      : {}),
  });
}

function fightExplanation(c: Resolved, id: string): Explanation | undefined {
  const parts = id.split(':');
  const n = Number(parts.pop());
  const turn = Number(parts.pop());
  const key = parts.slice(1).join(':');
  let rep: Rep | undefined;
  if (key === 'ceiling') rep = ceilingRep(c);
  else {
    const index = c.input?.maps.findIndex((m) => m.key === key) ?? -1;
    rep = index >= 0 ? representative(c, index) : undefined;
  }
  const f = rep?.play.log.find((t) => t.turn === turn)?.fights[n];
  if (!rep || !f) return undefined;
  const front = rep.units.get(f.lead) ?? recruitOf(rep, f.lead);
  const back = f.back ? (rep.units.get(f.back) ?? recruitOf(rep, f.back)) : undefined;
  const g = rep.groups.get(f.foe);
  if (!front || !g) return undefined;
  const foe = g.foe;
  const drawn = rep.play.skills[f.foe] ?? [];
  const pair = rep.lineup.find((x) => (x.lead.id === f.lead && x.back?.id === f.back) || (x.lead.id === f.back && x.back?.id === f.lead));
  const best = bestWeapon(front.unit.fighter, front.unit.weapons, back?.unit.fighter, pair?.support ?? null, foe, drawn, !!back);
  const m = best?.result;
  const who = front.name;
  const behind = back?.name;
  const rows: ExplanationRow[] = m
    ? [
        { label: `${foe.name} hits ${who}`, value: `${m.foeHit}%, crit ${m.foeCrit}%` },
        { label: `${foe.name}’s damage a hit (no crit)`, value: `${m.worstHit} against ${who}’s ${front.unit.fighter.stats.hp} HP, ${plural(m.foeStrikes, 'strike')} a round` },
        { label: `${who} hits with ${best!.weapon?.item.name ?? 'no weapon'}`, value: `${m.hit}%, crit ${m.crit}%, ${m.damage} × ${m.hits}` },
        ...(back ? [{ label: `Dual Guard (${behind})`, value: `${m.dualGuardRate}%` }, { label: `Dual Strike (${behind})`, value: `${m.dualStrikeRate}%, ${m.backDamage} damage` }] : []),
        ...m.notes.map((x) => ({ label: x })),
      ]
    : [{ label: `${who} has no weapon that fights ${foe.name}` }];
  const where = key === 'ceiling' ? `${rep.label} at caps` : rep.label;
  const spread = (u: RepUnit) =>
    STATS.map((s) => {
      const v = u.unit.fighter.stats[s];
      const lo = u.low?.[s];
      const hi = u.high?.[s];
      return `${STAT_LABELS[s]} ${lo !== undefined && hi !== undefined && lo !== hi ? `${lo}–${hi}` : v}`;
    }).join(', ');
  const spreadNote = rep.how === 'recorded' ? ' (as recorded)' : rep.how === 'caps' ? ' (at caps)' : ' (10th–90th percentile over the runs)';
  return made({
    id,
    kind: 'fight',
    title: `${who}${behind ? ` + ${behind}` : ''} vs ${foe.name}, turn ${turn}`,
    value: 1 - f.survive,
    format: 'kill',
    lead: `${who}${behind ? `, ${behind} behind,` : ''} ${f.phase === 'player' ? 'attacks' : 'is attacked by'} ${foe.name} (${foe.className}) on ${f.phase} phase of turn ${turn} of ${where}: the chance this fight kills ${who}.`,
    math: [
      `Stats used for ${who}: ${spread(front)}${spreadNote}.`,
      ...(back ? [`${behind}: ${spread(back)}${spreadNote}.`] : []),
      `${foe.name}: ${STATS.map((s) => `${STAT_LABELS[s]} ${foe.stats[s]}`).join(', ')} (the top of the chapter data’s range)${drawn.length ? `, Lunatic+ skills drawn: ${drawn.join(', ')}` : ''}.`,
      `The kill chance is exact over the exchange’s hits, crits, Dual Strikes and Dual Guards, from ${who}’s HP at that point in the play.`,
    ],
    rowsTitle: 'The combat math (the map solver’s matchup)',
    rows,
    stop: 'The trail stops here: below this are the game’s combat formulas and the hit and crit rolls. Open the matchup for the full formula.',
    matchup: { map: rep.map.id, foe: foe.name },
  });
}

/** A unit joining mid-map (a talk recruit, an arrival), as the play fields it. */
function recruitOf(rep: Rep, id: string): RepUnit | undefined {
  const u = rep.map.recruits?.find((x) => x.id === id)?.unit;
  return u && { unit: u, name: u.fighter.name };
}

// ---- the ceiling ----

function ceilingExplanation(c: Resolved): Explanation | undefined {
  const ceil = c.ceiling();
  if (ceil?.chance === undefined) return undefined;
  const rep = ceilingRep(c);
  const rows = rep ? fightRows(rep, 1 - ceil.chance, 'fight:ceiling') : undefined;
  return made({
    id: 'ceiling',
    kind: 'ceiling',
    title: 'Ceiling',
    value: ceil.chance,
    format: 'chance',
    lead: `The chance no unit dies on ${ceil.label} with every unit of the plan at its effective caps (a base class promoted), its recorded skills and weapons: the most any plan for this army could reach there.`,
    math: [
      `${ceil.label} played by the capped army’s suggested deployment, no spread${ceil.runs > 1 ? `, over ${ceil.runs} Lunatic+ skill draws` : ''}.`,
      'It brackets the plan from above: the flawless chance can grow towards it, never past it.',
      ...(rep && ceil.runs > 1 ? [`The fights below are the first draw’s; their shares split the ${pts(1 - ceil.chance)} points it loses (log share).`] : rep ? [`Its fights split the ${pts(1 - ceil.chance)} points it loses (log share).`] : []),
    ],
    ...(rows?.length ? { rowsTitle: 'What caps don’t fix', rows } : { stop: 'No fight at caps puts anyone at risk: the trail stops here.' }),
  });
}

// ---- comparisons: edits, proposals, close calls, costs ----

const COMPARED: Readonly<Record<Comparison['kind'], string>> = {
  proposal: 'What this proposal gains on your plan: its flawless chance less your plan’s, on the same runs.',
  'close-call': 'A close call: this plan against yours on the same runs. The chance can’t tell them apart; pick whichever you like.',
  edit: 'What this edit gains or costs against your plan: its flawless chance less your plan’s, on the same runs.',
  'pin-cost': 'What your pins cost: the best plan found with them lifted, less the best found with them, on the same runs.',
  robin: 'This Robin’s whole wishlist against the best Robin solved (or the locked one), on the same runs.',
  reserve: 'The flawless chance this reserve restores across the likely losses, each weighted by how often the plan’s runs lose that unit.',
  changed: 'How the flawless chance moved over the map just recorded: the headline worked out after it, less the one kept from before.',
  cost: 'What this event on the map just recorded did to the flawless chance: the run as recorded against the run with it undone, on the same runs.',
};

/** Per-map differences between two plans' runs: each map's points lost (its share of the risk), the other's less this one's. */
function mapDifferences(base: RunSim, other: RunSim): Map<string, number> {
  const a = riskSplit(1 - base.chance, base.maps);
  const b = riskSplit(1 - other.chance, other.maps);
  const out = new Map<string, number>();
  for (const k of new Set([...a.keys(), ...b.keys()])) out.set(k, (a.get(k) ?? 0) - (b.get(k) ?? 0));
  return out;
}

function editExplanation(c: Resolved, key: string): Explanation | undefined {
  const k = c.comparisons[key];
  if (!k) return undefined;
  const paired = k.kind !== 'changed';
  const rows: ExplanationRow[] = [];
  const base = k.base ?? c.chance;
  if (k.other && base) {
    const labels = new Map([...base.maps, ...k.other.maps].map((m) => [m.key, m.label]));
    const d = [...mapDifferences(base, k.other)].filter(([, x]) => Math.abs(x) >= 0.0005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const shown = d.slice(0, FIGHT_ROWS);
    const rest = d.slice(FIGHT_ROWS);
    // A map drills to the headline's own explanation of it: the page's plan, which may be the other side.
    for (const [m, x] of shown) rows.push({ label: labels.get(m) ?? m, points: x, ...(c.chance?.maps.some((y) => y.key === m && y.noDeath !== undefined) ? { drillTo: `map:${m}` } : {}) });
    if (rest.length) rows.push({ label: plural(rest.length, 'other map'), points: rest.reduce((a, [, x]) => a + x, 0) });
  }
  return made({
    id: `edit:${key}`,
    kind: 'edit',
    title: k.label,
    value: k.gain,
    format: 'difference',
    margin: k.margin,
    ...(k.close ? { close: true } : {}),
    lead: COMPARED[k.kind],
    math: [
      paired
        ? `Both plans are played on the same ${k.runs ? plural(k.runs, 'run') : 'runs'} (the same rolls), so the difference is sharper than either chance: ±${pts(k.margin)} (95%).`
        : `Two separate estimates, each with its own error: ±${pts(k.margin)} together (95%).`,
      ...(k.close ? ['A change is kept only when it gains more than twice that; this one stays inside it: no measurable difference.'] : []),
      ...(k.settled === false ? ['Provisional: read on fewer runs; it settles as the runs double.'] : []),
      ...(k.other
        ? [`By map: each map’s share of the risk in each plan’s own ${plural(k.other.runs, 'run')}, yours less the other’s, so a gain reads positive. They add up to the two chances’ difference on those runs, not to the paired cost.`]
        : k.drill
          ? ['By map: working out the other plan’s runs…']
          : []),
    ],
    ...(rows.length ? { rowsTitle: 'Where it gains and loses, by map', rows } : {}),
    ...(!k.other && k.drill ? { pending: 'other' as const } : {}),
  });
}

// ---- worth ----

type Position = 'Lead' | 'Back' | 'Solo';

function positionOn(lineup: RunSim['maps'][number]['lineup'], u: RosterUnit): Position | undefined {
  if (!lineup) return undefined;
  for (const p of lineup.pairs) {
    if (p.lead === u) return p.back ? 'Lead' : 'Solo';
    if (p.back === u) return 'Back';
  }
  return lineup.solo.includes(u) ? 'Solo' : undefined;
}

function worthExplanation(c: Resolved, unit: RosterUnit): Explanation | undefined {
  const w = c.worth.find((x) => x.unit === unit);
  const r = c.chance;
  if (!w || w.forced || w.worth === undefined || !r) return undefined;
  const name = nameOf(c, unit);
  const other = c.without[unit];
  const d = other ? mapDifferences(r, other) : undefined;
  const base = riskSplit(1 - r.chance, r.maps);
  // Its spans: consecutive maps in one position.
  const spans: { position: Position; keys: string[] }[] = [];
  for (const m of r.maps) {
    const p = positionOn(m.lineup, unit);
    const lastSpan = spans[spans.length - 1];
    if (p && lastSpan?.position === p && lastSpan.keys[lastSpan.keys.length - 1] === r.maps[r.maps.indexOf(m) - 1]?.key) lastSpan.keys.push(m.key);
    else if (p) spans.push({ position: p, keys: [m.key] });
  }
  const labels = new Map(r.maps.map((m) => [m.key, m.label]));
  const fielded = new Set(spans.flatMap((s) => s.keys));
  // Worth counts in the plan's favour: the maps lose more without it (the other's lost less this one's, negated).
  const gainOn = (k: string) => -(d?.get(k) ?? 0);
  const rows: ExplanationRow[] = spans.map((s) => {
    const riskiest = [...s.keys].sort((a, b) => (base.get(b) ?? 0) - (base.get(a) ?? 0))[0]!;
    const first = labels.get(s.keys[0]!)!;
    const lastLabel = labels.get(s.keys[s.keys.length - 1]!)!;
    return {
      label: `${s.position}: ${first}${s.keys.length > 1 ? `–${lastLabel}` : ''}`,
      value: plural(s.keys.length, 'map'),
      ...(d ? { points: s.keys.reduce((a, k) => a + gainOn(k), 0) } : {}),
      ...(r.maps.find((m) => m.key === riskiest)?.noDeath !== undefined ? { drillTo: `map:${riskiest}` } : {}),
    };
  });
  if (d) {
    const off = [...d.keys()].filter((k) => !fielded.has(k)).reduce((a, k) => a + gainOn(k), 0);
    if (Math.abs(off) >= 0.0005) rows.push({ label: 'Maps it isn’t fielded on', points: off });
  }
  const kids = w.children.map((u) => nameOf(c, u));
  return made({
    id: `worth:${unit}`,
    kind: 'worth',
    title: `${name}: worth`,
    value: w.worth,
    format: 'points',
    ...(w.margin !== undefined ? { margin: w.margin } : {}),
    lead: `The flawless chance the plan loses without ${name}, over every lineup ${name} plays in${kids.length ? `, ${listOf(kids)} included (a parent’s worth includes its children)` : ''}.`,
    math: [
      `${name} is removed from every lineup where it’s optional${kids.length ? `, with ${listOf(kids)}` : ''}, its slot refilled, its spouse re-matched and the roadmap re-solved where it was named; both plans are played on the same ${plural(w.runs, 'run')}${w.margin !== undefined ? ` (±${pts(w.margin)}, 95%)` : ''}.`,
      ...(w.utility !== undefined && w.utility > 0 ? [`Its utility, ${pts(w.utility)} points, is the part lost when it still fights but takes none of its staff, Dance, Rally or Rescue actions.`] : []),
      ...(w.settled ? [] : ['Provisional: its runs double until it settles.']),
      other
        ? `By span: each map’s share of the risk without ${name} less with it, on ${plural(other.runs, 'run')} of each plan (their own error: they needn’t add up to the paired worth).`
        : 'By span: working out the plan’s runs without it…',
    ],
    ...(rows.length ? { rowsTitle: 'By lineup span', rows } : { stop: `${name} isn’t fielded on any map the runs reach.` }),
    ...(!other ? { pending: 'without' as const } : {}),
  });
}

// ---- milestones and the EXP forecast ----

const pointWords = (p: MilestonePoint) => (p.when === 'end' ? `the end of ${p.label}` : `the start of ${p.label}`);

/** A milestone in words, as the Why panel titles it. */
export function milestoneWords(m: Milestone, name: (u: RosterUnit | 'maiden') => string): string {
  switch (m.kind) {
    case 'support':
      return m.wedding ? `Chrom marries ${name(m.pair[0] === 'chrom' ? m.pair[1] : m.pair[0])}` : `${name(m.pair[0])} and ${name(m.pair[1])} reach ${m.rank}`;
    case 'skill':
      return `${name(m.unit)} learns ${m.name}${m.for.kind === 'pass' ? ` to pass to ${name(m.for.child)}` : ''}`;
    case 'recruit':
      return `${name(m.child)} recruited on ${m.at.label}`;
    case 'class':
      return `${name(m.unit)} reaches ${m.className}`;
  }
}

/** A share of `n` runs' error (±, 95%). */
const shareMargin = (p: number, n: number) => (n > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / n) : 0);

function milestoneExplanation(c: Resolved, id: string): Explanation | undefined {
  const m = c.milestones.find((x) => x.id === id);
  const run = c.chance?.milestones.find((x) => x.id === id);
  const read = c.readings?.readings.flatMap((r) => r.milestones).find((x) => x.id === id);
  const chance = read ? read.chance : run?.chance;
  if (!m || (chance === undefined && !run && !read)) return undefined;
  const words = milestoneWords(m, (u) => nameOf(c, u));
  const runs = run?.runs ?? 0;
  const value = chance ?? 0;
  const math = [
    `The share of the runs reaching ${pointWords(m.at)} with nobody lost in which it holds${runs ? ` (${plural(runs, 'run')})` : ''}.`,
    ...(chance === undefined ? ['No run reaches it with nobody lost: it reads 0%.'] : []),
    ...(runs && chance !== undefined ? [`Simulation error: ±${pts(shareMargin(chance, runs))} (95%, a share of ${plural(runs, 'run')}).`] : []),
    ...(run?.level !== undefined ? [`Median level there: ${run.level.toFixed(1)}.`] : []),
  ];
  const r = c.chance;
  const rows: ExplanationRow[] = [];
  let stop: string | undefined;
  if ((m.kind === 'skill' || m.kind === 'class') && r) {
    const unit = m.unit;
    const upTo = m.at.index + (m.at.when === 'end' ? 1 : 0);
    const keys = new Set(c.input?.maps.slice(0, upTo).map((x) => x.key) ?? r.maps.slice(0, upTo).map((x) => x.key));
    for (const mx of r.exp) {
      if (!keys.has(mx.key)) continue;
      const u = mx.units.find((x) => x.unit === unit);
      if (!u) continue;
      rows.push({ label: mx.label, value: `+${Math.round(u.exp)} EXP · Lv ${u.level.median.toFixed(1)} (${u.level.low.toFixed(1)}–${u.level.high.toFixed(1)})`, drillTo: `exp:${mx.key}:${unit}` });
    }
    if (m.kind === 'skill' && m.learn) math.push(`${m.name} is learned as a ${m.learn.className} at Lv ${m.learn.level}.`);
    if (!rows.length) stop = `${nameOf(c, unit)} earns no EXP in the forecast before ${m.at.label}: the trail stops here.`;
  } else if (m.kind === 'support') {
    const s = r?.supports.find((x) => (x.a === m.pair[0] && x.b === m.pair[1]) || (x.a === m.pair[1] && x.b === m.pair[0]));
    if (s) rows.push({ label: 'Support points entering the endpoint', value: `${s.points.median} (${s.points.low}–${s.points.high}), ${s.rank ?? 'no rank'} in most runs` });
    math.push(`The window: start fighting together ${m.window.earliest ? `from ${m.window.earliest.label}` : ''}${m.window.latest ? ` by ${m.window.latest.label}` : ''}; ${plural(m.window.maps, 'map')} together needed.`);
    stop = 'The trail stops at support points from combats paired: the runs count them map by map (at most 3 a map), not kept per map.';
  } else if (m.kind === 'recruit') {
    const s = c.milestones.find((x) => x.kind === 'support' && x.pair.includes(m.parents[0] as RosterUnit) && x.pair.includes(m.parents[1] as RosterUnit));
    if (s) rows.push({ label: `Its parents: ${milestoneWords(s, (u) => nameOf(c, u))}`, drillTo: `milestone:${s.id}` });
    stop = s ? undefined : 'The trail stops here: its parents’ marriage is a fact of the run.';
  }
  return made({
    id: `milestone:${id}`,
    kind: 'milestone',
    title: `${words} by ${pointWords(m.at)}`,
    value,
    format: 'chance',
    lead: `The chance ${words} by ${pointWords(m.at)}, the roadmap’s milestone.`,
    math,
    ...(rows.length ? { rowsTitle: m.kind === 'support' || m.kind === 'recruit' ? 'What it rests on' : 'EXP expected per map (level at its end, 10th–90th percentile)', rows } : {}),
    ...(stop ? { stop } : {}),
  });
}

function expExplanation(c: Resolved, id: string): Explanation | undefined {
  const parts = id.split(':');
  const unit = parts.pop() as RosterUnit;
  const key = parts.slice(1).join(':');
  const mx = c.chance?.exp.find((x) => x.key === key);
  const u = mx?.units.find((x) => x.unit === unit);
  if (!mx || !u) return undefined;
  const groups = new Map(mx.groups.map((g) => [g.key, g]));
  const rows = Object.entries(u.kills)
    .sort((a, b) => b[1] - a[1])
    .map(([g, k]) => ({ label: `${groups.get(g)?.name ?? g}${groups.get(g) ? ` (${groups.get(g)!.className}) ×${groups.get(g)!.count}` : ''}`, value: `${k.toFixed(1)} kill${k === 1 ? '' : 's'} a run` }));
  return made({
    id,
    kind: 'exp',
    title: `${u.name} on ${mx.label}: EXP`,
    value: u.exp,
    format: 'exp',
    lead: `The EXP ${u.name} earns on ${mx.label} in the forecast, over the ${plural(mx.runs, 'run')} that play it with nobody lost before it.`,
    math: [
      `Level at the map’s end: ${u.level.median.toFixed(1)} (10th–90th percentile ${u.level.low.toFixed(1)}–${u.level.high.toFixed(1)}).`,
      `EXP priority there: ${u.priority}: ${u.priority === 'high' ? 'it takes the kills it can' : u.priority === 'low' ? 'it chips and waits for the others' : 'it takes kills as they come'}.`,
      'Combat EXP (kills and damage), a Back’s half damage EXP by its Dual Strike chance, staff and Dance EXP.',
    ],
    ...(rows.length ? { rowsTitle: 'Kills per foe group (a mean over the runs)', rows } : {}),
    stop: 'The trail stops at the forecast’s foe groups: which unit kills which foe on which turn isn’t modelled.',
  });
}

// ---- gold, side goals, items ----

function goldExplanation(c: Resolved, key: string): Explanation | undefined {
  const m = c.chance?.maps.find((x) => x.key === key);
  const g = m?.gold;
  if (!m || !g) return undefined;
  const stop = c.chance!.shopping.find((s) => s.key === key);
  const rows = (stop?.lines ?? []).map((l) => ({ label: `${l.action === 'forge' ? 'Forge' : 'Buy'} ${l.item} for ${l.name} (${l.kind})`, value: `${l.cost.toLocaleString('en-US')}G in ${pct(l.share)} of runs` }));
  return made({
    id: `gold:${key}`,
    kind: 'gold',
    title: `${m.label}: gold at its end`,
    value: g.median,
    format: 'gold',
    lead: `The gold the runs hold at the end of ${m.label}, its sure income added: the median, over the runs that play it with nobody lost before it.`,
    math: [
      `10th–90th percentile: ${g.low.toLocaleString('en-US')}–${g.high.toLocaleString('en-US')}G.`,
      'What the run held (your latest entry after its shopping), plus Bullion no play can lose, the side goals it secured and renown’s Bullion, less its rebuys, seals and endpoint kit.',
    ],
    ...(rows.length ? { rowsTitle: `Bought in ${m.label}’s preparations`, rows } : {}),
  });
}

function sideGoalExplanation(c: Resolved, id: string): Explanation | undefined {
  const g = c.chance?.sideGoals.find((x) => x.id === id);
  if (!g || g.secured === undefined) return undefined;
  return made({
    id: `side-goal:${id}`,
    kind: 'side-goal',
    title: g.label,
    value: g.secured,
    format: 'chance',
    lead: `The share of the runs playing its map with nobody lost before it that secure every part of it.`,
    math: [g.chase ? 'Chased: each part costs one action by the turn it would be lost; a map won with actions still owed misses it.' : 'Skipped: the plan doesn’t chase it.'],
  });
}

function itemExplanation(c: Resolved, id: string): Explanation | undefined {
  const parts = id.split(':');
  const source = parts.pop()!;
  const key = parts.slice(1).join(':');
  const u = c.chance?.items.find((x) => x.key === key && x.source === source);
  if (!u || u.share === undefined) return undefined;
  return made({
    id,
    kind: 'item',
    title: `${u.item} on ${u.label}`,
    value: u.share,
    format: 'chance',
    lead: `The share of the runs playing ${u.label} with nobody lost before it in which the ${u.item} is there to use: held, or a tonic bought.`,
    math: ['An item found on a map a play can lose, or bought with gold a run may not have, arrives only in some runs.'],
  });
}
