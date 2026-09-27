/**
 * The preparation page (#207; spec #175, The preparation page; variant D on `prototype/prep-roadmap`): the next map as
 * the adopted plan plays it.
 *
 * - The main area is a **pair card** per pair and solo unit in the plan's lineup for the map: positions and partner,
 *   each unit's job, EXP priority and expected EXP, the milestone its EXP feeds (with its chance), any at-risk pin, the
 *   **stance plan** (the play's stances turn by turn), the threats to it (each group's chance of killing someone on it)
 *   with a "worst case kills" flag, and a count of its to-dos, linked to the checklist. Units not fielded are listed
 *   below with their reason, arrivals by turn among them.
 * - The side column: the map's no-death chance beside the plan's flawless chance, expected turns and the deploy count;
 *   one **Before this map** checklist in the game's menu order (pick units and pair up, inventory and trade, use items,
 *   skills, armory and forge), then **On the map**, each action with why; Threats (the cautious worst case beside each
 *   group's chance of killing someone and who takes it); the shopping list; seals and promotions; loadouts with the
 *   item plan's carriers applied; checks and assumptions; matchups and the chapter guide, collapsed.
 * - Picking a back, going alone or dropping a unit is a span pin over this map only (`mapSpanPin`).
 * - A forced map with no preparation phase (`NO_PREPARATIONS`) shows a banner and hides the menu-only sections.
 *
 * `prepReadout` is what the page draws (tested); the plan's simulation behind it (`expForecast`) runs after the page's
 * first paint.
 */
import type {
  ChapterDifficulty,
  Deployment,
  Difficulty,
  Engine,
  ExpForecast,
  FlawlessOptions,
  Foe,
  MapPlay,
  Matchup,
  Milestone,
  Plan,
  PlanPin,
  Readings,
  RosterUnit,
  Run,
  RunSim,
  ShoppingLine,
  SimFoeGroup,
  SimGroup,
  SimMap,
  SimStance,
  Snapshot,
  SpanPin,
  SpanPosition,
  SuggestedPin,
} from '../engine';
import {
  EMPTY_SNAPSHOT,
  KIT_FORGE_MT,
  NO_PREPARATIONS,
  REINFORCEMENT_RULE,
  bestWeapon,
  dangerFlags,
  deployCount,
  fighterOf,
  foeKey,
  foesOf,
  forcedOn,
  itemByName,
  latestEntry,
  mapSpanPin,
  matchup,
  prepUnits,
  promotionAdvice,
  sealAvailability,
  sealsHeld,
  simLineup,
  suggestDeployment,
  suggestLoadout,
  unitName,
  withEdit,
  withPin,
  withSeenSkills,
  withoutPins,
  type DeployCandidate,
} from '../engine';
import { chanceText } from './chance';
import { lossText, mapChecks } from './inbox';
import { adoptedOf, openLosses } from '../engine';
import { goldRange, goldText, milestoneShort, pinText, solveState } from './run-page';
import { CHILD_UNITS } from '../game-data/children';
import { ROBIN_GROWTHS } from '../game-data/robin';
import { STATS, STAT_LABELS, type Stat } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { h } from './dom';
import { guide } from './guide';
import { howToRun } from './maps-page';

export type PrepContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly map: string;
  readonly close: () => void;
  readonly setRun: (run: Run) => void;
  readonly foe: number;
  readonly setFoe: (i: number) => void;
  /** The adopted plan (#204; the seed until one is adopted), as the Run view's flawless chance reads it. */
  readonly plan?: () => Plan;
};

/** A recorded unit as a fighter (the engine's: the flawless chance builds its army the same way). */
export { fighterOf };

/** The seed the preparation page plays the map with: the same page always shows the same play. */
const PREP_SEED = 1;
/** Lunatic+ runs to average the drawn skills over, when a foe's weren't recorded. */
const LPLUS_RUNS = 16;

const LEAN = { high: 'may read high', low: 'may read low', either: 'either way' } as const;

/**
 * A map's no-death chance (#181): the map played turn by turn with this lineup and the latest recorded stats, in the
 * spec's wording, with how the play ended and the blind spots it rests on.
 */
export function noDeathReadout(engine: Engine, map: string, difficulty: Difficulty, lineup: readonly SimGroup[], seen: Readonly<Record<string, readonly string[]>> = {}): { readonly text: string; readonly detail: string } {
  if (!lineup.length) return { text: 'No-death chance: record your units’ stats in the chapter log to see it.', detail: '' };
  const input = { map: engine.simMap(map, difficulty, { seen }), lineup };
  const drawn = input.map.foes.some((f) => f.pool?.length) || input.map.waves.some((w) => w.groups.some((g) => g.pool?.length));
  const runs = drawn ? LPLUS_RUNS : 1;
  const chance = engine.mapNoDeath(input, PREP_SEED, runs);
  const play = engine.playMap(input, PREP_SEED);
  return { text: `No-death chance: ${chanceText(chance)}`, detail: playDetail(engine, input.map, play, runs) };
}

/** How a play ended and what it rests on, in words. */
function playDetail(engine: Engine, map: SimMap, play: MapPlay, runs = 1): string {
  const turns = `${play.turns} turn${play.turns === 1 ? '' : 's'}`;
  const end = play.ended === 'rout' ? `a rout in ${turns}` : play.ended === 'boss' ? `the boss falls on turn ${play.turns}` : `the army can’t finish the map (${turns} played)`;
  const spots = engine.blindSpots().filter((b) => (play.blindSpots as readonly string[]).includes(b.id));
  return (
    `Played turn by turn with this lineup and your latest stats: ${end}.` +
    (runs > 1 ? ` Lunatic+ skills not yet recorded are drawn from the pool, over ${runs} runs.` : '') +
    (map.skipped.length ? ` Waves not played (set off by an event): ${map.skipped.join('; ')}.` : '') +
    ` Rests on: ${spots.map((b) => `${b.label.toLowerCase()} (${LEAN[b.lean]})`).join(', ')}.`
  );
}

// ---- the readout -------------------------------------------------------------------------------------------------

/** Where an action happens: the game's preparation menu, in its order, or on the map. */
export type PrepStep = 'units' | 'trade' | 'items' | 'skills' | 'armory' | 'map';
export const PREP_STEPS: readonly PrepStep[] = ['units', 'trade', 'items', 'skills', 'armory'];
export const STEP_LABEL: Readonly<Record<PrepStep, string>> = {
  units: 'Pick units and pair up',
  trade: 'Inventory and trade',
  items: 'Use items',
  skills: 'Skills',
  armory: 'Armory and forge',
  map: 'On the map',
};

/** One checklist action: what to do, why (the milestone, item plan or shopping-list line it serves), and who it's for. */
export type PrepAction = {
  readonly id: string;
  readonly step: PrepStep;
  readonly text: string;
  readonly why: string;
  /** Flawless points it's worth, where the plan reads one. */
  readonly worth?: number;
  readonly units: readonly RosterUnit[];
};

export type CardMember = {
  readonly unit: RosterUnit;
  readonly name: string;
  readonly position: 'Lead' | 'Back' | 'Solo';
  /** What it does in the play: fights, backs, heals, dances, rallies, talks, waits. */
  readonly job: string;
  readonly priority: 'High' | 'Normal' | 'Low';
  /** "≈120 EXP · Lv 5 40 EXP – Lv 6", or "—" when no run plays the map. */
  readonly exp: string;
  /** The milestone its EXP feeds, with its chance ("Luna before Chapter 9 · 72.0%"). */
  readonly milestone?: string;
  /** Its at-risk reading (#197) and the one-click change restoring it. */
  readonly atRisk?: { readonly text: string; readonly fix?: { readonly text: string; readonly pin: SuggestedPin; readonly worth?: number } };
  /** The map fields it: it can't be dropped. */
  readonly forced: boolean;
  /** Joins on this map from its start, or fielded with a setup used only here (#131). */
  readonly joins?: 'joins' | 'this map only';
};

export type PairCard = {
  readonly id: string;
  readonly title: string;
  readonly members: readonly CardMember[];
  /** The pair's support milestone, with its window. */
  readonly support?: string;
  /** Its stances turn by turn: "T1–3" "together, Chrom in front". Empty for a unit alone. */
  readonly stances: readonly { readonly turns: string; readonly text: string }[];
  /** The foe groups that threaten it, most dangerous first: each one's chance of killing someone on it. */
  readonly threats: readonly { readonly name: string; readonly chance: string }[];
  /** The worst round of a foe that kills a unit on it: "Barbarian: worst round 21 / 19 HP on Robin". */
  readonly worstKills?: string;
  /** Its to-dos in the checklist, by action id. */
  readonly todo: readonly string[];
  /** A span pin over this map only sets its pair. */
  readonly pinned: boolean;
};

export type ThreatRow = {
  readonly key: string;
  readonly name: string;
  readonly className: string;
  readonly detail: string;
  /** The cautious worst case: the worst round against the unit it hurts most. */
  readonly worst: string;
  readonly worstKills: boolean;
  /** Its chance of killing someone on the map (the play's). */
  readonly chance: string;
  /** Who takes these foes under the EXP priority (kills a run). */
  readonly who: string;
};

export type NotFielded = { readonly unit: RosterUnit; readonly name: string; readonly reason: string; readonly dropped: boolean };

export type PrepReadout = {
  readonly title: string;
  readonly key: string;
  /** No preparation phase: only the on-the-map plan applies. */
  readonly noPrep: boolean;
  readonly banner?: string;
  readonly head: { readonly noDeath: string; readonly flawless: string; readonly turns: string; readonly deploy: string; readonly detail: string };
  readonly cards: readonly PairCard[];
  readonly notFielded: readonly NotFielded[];
  /** The menu steps with actions, in the game's order; empty on a map with no preparations. */
  readonly before: readonly { readonly step: PrepStep; readonly label: string; readonly actions: readonly PrepAction[] }[];
  readonly onMap: readonly PrepAction[];
  readonly threats: readonly ThreatRow[];
  readonly flags: readonly string[];
  readonly shopping: { readonly title: string; readonly note: string; readonly rows: readonly (readonly string[])[] } | undefined;
  readonly checks: readonly string[];
  readonly assumptions: readonly string[];
  /** The lineup the page plays: matchups and loadouts read it. */
  readonly lineup: Deployment;
};

export type PrepInput = {
  readonly plan: Plan;
  /** The plan's EXP forecast (`expForecast`): lineup, no-death chance, turns, EXP, milestones, shopping. */
  readonly forecast: ExpForecast;
  /** The plan's readings (#197), when the worker has read them: at-risk pins. */
  readonly readings?: Readings;
};

const PRIORITY_TEXT = { high: 'High', normal: 'Normal', low: 'Low' } as const;

/** A level with its EXP as the fraction (5.4 → "Lv 5, 40 EXP"), as the game shows it. */
const levelText = (x: number) => `Lv ${Math.floor(x + 1e-9)}${Math.round((x % 1) * 100) ? ` ${Math.round((x % 1) * 100)} EXP` : ''}`;

/** A small chance of a death, as the threats read it: "0.4%", "under 0.1%", "0%". */
const riskText = (p: number) => (p <= 0 ? '0%' : p < 0.001 ? 'under 0.1%' : `${(p * 100).toFixed(1)}%`);

const WHY: Readonly<Record<ShoppingLine['kind'], string>> = { rebuy: 'runs dry before the next armory', seal: 'for a promotion', tonic: 'the item plan’s tonic for this map', arms: 'arms the lineup for this map', kit: 'endpoint kit' };

const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The shopping list for the next armory stop (#190) of a simulation: the stop, its gold on arrival and its lines. */
function shoppingOf(r: RunSim & { readonly goldUnrecorded?: boolean }): { readonly title: string; readonly note: string; readonly rows: readonly (readonly string[])[] } {
  const stop = r.shopping[0];
  if (!stop) return { title: 'Shopping list', note: r.maps.length ? 'No simulated run reaches an open armory with nobody lost.' : 'The endpoint is recorded: nothing left to buy for.', rows: [] };
  const note =
    `Gold on arrival: ${goldRange(stop.gold)}${r.goldUnrecorded ? ' (your latest entry records no gold, read as none)' : ''}. ` +
    'What the simulated runs buy here, in priority order: rebuys for items that would run dry before the next armory, a seal when a promotion needs one and none is held, the item plan’s tonics for this map, the weapons (off the shelf, within each unit’s rank) and Vulneraries that arm this map’s lineup better, keeping the gold the plan’s seals still need, then at the endpoint the endpoint kit, dropping what wins fewest matchups per gold when gold runs short. Only Bullion is sold; merchants are random, so their stock isn’t counted.';
  const rows = stop.lines.map((l) => [l.name, `${l.action === 'forge' ? `Forge ${l.item} to +${KIT_FORGE_MT} Mt` : `Buy ${l.item}`} (${WHY[l.kind]})`, goldText(l.cost), chanceText(l.share, { miss: 'skipped', make: 'made' })]);
  return { title: `Shopping list: ${stop.label}`, note, rows };
}

/**
 * The shopping list for the next armory stop (#190): what the simulated runs buy there, in priority order (rebuys,
 * seals, tonics, the endpoint kit), each with the chance a run makes it, and the gold on arrival as a range.
 */
export function shoppingReadout(engine: Engine, run: Run, options?: FlawlessOptions): { readonly title: string; readonly note: string; readonly rows: readonly (readonly string[])[] } {
  return shoppingOf(engine.flawlessChance(run, options));
}

/** Turns as the stance plan writes them: "T1–3", "T4", "T6+". */
const turnsText = (from: number, to: number, last: number) => (from === to ? `T${from}` : to === last && to - from > 1 ? `T${from}+` : `T${from}–${to}`);

/** Stance segments shown on a card; a longer plan says how many more. */
const STANCE_SEGMENTS = 6;

/** A pair's stance plan from the play's log: consecutive turns with one stance make one segment. */
function stancePlan(play: MapPlay, lead: RosterUnit, name: (u: RosterUnit) => string): { turns: string; text: string }[] {
  const words = (s: SimStance) =>
    s.stance === 'together' ? `together, ${name(s.front as RosterUnit)} in front` : s.stance === 'adjacent' ? s.adjacency !== undefined && s.adjacency < 1 ? `side by side in Attack Stance ${Math.round(s.adjacency * 100)}% of the time, else apart` : 'side by side in Attack Stance' : 'apart';
  const CHANGE = { separate: 'Separate: ', 'pair-up': 'Pair Up: ', switch: 'Switch: ' } as const;
  const segs: { from: number; to: number; text: string }[] = [];
  for (const t of play.log) {
    const s = t.stances.find((x) => x.pair === lead);
    if (!s) continue;
    const text = words(s);
    const last = segs[segs.length - 1];
    if (last && last.text.endsWith(text) && last.to === t.turn - 1 && !(s.change && t.turn > 1)) last.to = t.turn;
    else segs.push({ from: t.turn, to: t.turn, text: `${s.change && t.turn > 1 ? CHANGE[s.change] : ''}${text}` });
  }
  const out = segs.map((s) => ({ turns: turnsText(s.from, s.to, play.turns), text: s.text }));
  return out.length > STANCE_SEGMENTS ? [...out.slice(0, STANCE_SEGMENTS - 1), { turns: '…', text: `${out.length - STANCE_SEGMENTS + 1} more changes` }] : out;
}

/** Each foe group's chance of killing someone in the play: 1 less the product of the survival chances of its fights. */
function groupRisk(play: MapPlay, fronts?: ReadonlySet<string>): Map<string, number> {
  const alive = new Map<string, number>();
  for (const t of play.log) for (const f of t.fights) if (!fronts || fronts.has(f.lead)) alive.set(f.foe, (alive.get(f.foe) ?? 1) * f.survive);
  return new Map([...alive].map(([k, a]) => [k, 1 - a]));
}

/** What a unit does in the play, in a word or two. */
function jobOf(play: MapPlay, unit: RosterUnit, position: CardMember['position'], name: (u: RosterUnit) => string): string {
  const t = play.units[unit];
  const jobs: string[] = [];
  if (t) {
    if (t.combats) jobs.push('fights');
    if (Object.keys(t.used).some((i) => itemByName(i)?.kind === 'staff')) jobs.push('heals');
    if (t.dances) jobs.push('dances');
    if (t.rallies) jobs.push('rallies');
  }
  const talks = play.log.flatMap((x) => x.acts.filter((a) => a.kind === 'talk' && a.unit === unit && a.target).map((a) => `talks to ${name(a.target as RosterUnit)} (turn ${x.turn})`));
  jobs.push(...new Set(talks));
  if (!jobs.length) jobs.push(position === 'Back' ? 'backs' : 'waits');
  else if (position === 'Back' && !jobs.includes('fights')) jobs.unshift('backs');
  return jobs.join(', ');
}

/** The worst round a foe deals a unit (its best weapon; unarmed, its bare stats), as the cautious reading takes it. */
function worstRound(fighter: SimGroup['lead'], back: SimGroup['back'], support: SimGroup['support'], foe: Foe, pool: readonly string[]): Matchup {
  return (fighter.weapons.length ? bestWeapon(fighter.fighter, fighter.weapons, back?.fighter, support, foe, pool)?.result : undefined) ?? matchup(fighter.fighter, back?.fighter, support, foe, pool);
}

/**
 * The preparation page's readout (see the module comment): the adopted plan's lineup for the map with its play, the
 * checklist, threats and the rest, from the plan's forecast (`input.forecast`) and one play of the map at the page's
 * seed with the recorded stats (the stance plan and each threat's chance).
 */
export function prepReadout(engine: Engine, run: Run, map: string, input: PrepInput): PrepReadout {
  const { plan, forecast, readings } = input;
  const m = engine.maps().find((x) => x.id === map)!;
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const lplus = difficulty === 'lunatic-plus';
  const gender = run.roster.run.gender ?? plan.robin.gender;
  const name = (u: RosterUnit | 'maiden') => unitName(u, gender);
  const steps = engine.mapOrder(run).steps;
  const index = Math.max(0, steps.findIndex((s) => s.map === map));
  const step = steps[index];
  const key = step?.key ?? map;
  const labels = new Map(steps.map((s) => [s.key, `${engine.maps().find((x) => x.id === s.map)?.label ?? s.map}${s.secret ? ' (secret route)' : ''}`]));
  const noPrep = NO_PREPARATIONS.has(map);
  const seen = run.seen?.[map] ?? {};

  // The army and the units on the map from its start (#131), as fighters.
  const prep = prepUnits(run, map);
  const opening = [...prep.joining, ...prep.mapOnly];
  const byUnit = new Map<RosterUnit, DeployCandidate>(
    prep.units.flatMap(([unit, u]) => {
      const f = fighterOf(unitName(unit, gender), u);
      return f ? [[unit, { unit, fighter: f.fighter, weapons: f.weapons, items: f.items, supports: u.supports } as DeployCandidate]] : [];
    }),
  );
  const forced = [...new Set([...forcedOn(map), ...opening])];
  const max = deployCount(m.conditions[table]?.deploy ?? '', opening.map((u) => unitName(u))) || byUnit.size;
  const at = forecast.maps.find((x) => x.key === key);
  // The plan's lineup (the pins kept), else the greedy one for a map no run plays.
  const pool = lplus ? engine.lunaticPlusPool(m) : [];
  const foes = foesOf(m, table, lplus).map((f) => (seen[foeKey(f)] ? { ...f, skills: [...new Set([...f.skills, ...seen[foeKey(f)]!])] } : f));
  const poolFor = (f: Foe) => (seen[foeKey(f)] ? [] : pool);
  const lineup: Deployment =
    at?.lineup ??
    suggestDeployment({ candidates: [...byUnit.values()], forced, max, foes, pool: poolFor, pinned: [] });

  // One play of the map at the page's seed: stances, jobs and each group's chance of killing someone.
  const sim = engine.simMap(map, difficulty, { seen, route: step?.secret ? 'secret' : 'normal' });
  const groups = simLineup(lineup, byUnit);
  const mapExp = forecast.exp.find((x) => x.key === key);
  const priority = Object.fromEntries((mapExp?.units ?? []).map((u) => [u.unit, u.priority]));
  const fielded = new Set(groups.flatMap((g) => [g.lead.id, ...(g.back ? [g.back.id] : [])]));
  const married = (a: RosterUnit, b: RosterUnit) => byUnit.get(a)?.supports.some((s) => s.partner === b && s.rank === 'S');
  const bonds = plan.wishlist.marriages.filter(([a, b]) => fielded.has(a) && fielded.has(b) && !married(a, b));
  const play = engine.playMap({ map: sim, lineup: groups, priority, ...(bonds.length ? { bonds } : {}) }, PREP_SEED);

  // Milestones: the ones due here are actions; each unit's next EXP milestone feeds its card.
  const ms = engine.milestones(run, plan);
  const chanceOf = new Map(forecast.milestones.map((x) => [x.id, x]));
  const here = (p: { readonly index: number } | undefined) => p?.index === index;
  const msText = (x: Milestone, unit: RosterUnit) => {
    const c = chanceOf.get(x.id)?.chance;
    return `${milestoneShort(x, unit, gender)}${c === undefined ? '' : ` · ${chanceText(c)}`}`;
  };

  // ---- the checklist -----------------------------------------------------------------------------------------------
  const actions: PrepAction[] = [];
  const add = (a: PrepAction) => actions.push(a);
  const supportOf = (a: RosterUnit, b: RosterUnit) => ms.find((x): x is Extract<Milestone, { kind: 'support' }> => x.kind === 'support' && !x.nonStarter && ((x.pair[0] === a && x.pair[1] === b) || (x.pair[0] === b && x.pair[1] === a)) && x.at.index >= index);
  const supportWhy = (a: RosterUnit, b: RosterUnit) => {
    const s = supportOf(a, b);
    if (!s) return undefined;
    const goal = s.wedding ? `Chrom’s wedding at the end of ${s.at.label}` : `${s.rank} ${s.at.when === 'end' ? 'by the end of' : 'before'} ${s.at.label}`;
    const c = chanceOf.get(s.id)?.chance;
    const window = here(s.window.latest) ? ': their last start' : here(s.window.earliest) ? ': their earliest start' : '';
    return `support ${goal}${window}${c === undefined ? '' : ` (${chanceText(c)})`}`;
  };
  const lineupWhy = `the plan’s lineup (${lineup.deployed.length} of ${max})`;
  if (!noPrep) {
    for (const p of lineup.pairs)
      if (p.back) add({ id: `pair:${p.lead}`, step: 'units', text: `Pair up ${name(p.lead)} and ${name(p.back)}: ${name(p.lead)} leads`, why: supportWhy(p.lead, p.back) ?? lineupWhy, units: [p.lead, p.back] });
      else add({ id: `field:${p.lead}`, step: 'units', text: `Field ${name(p.lead)}${forced.includes(p.lead) ? ' (forced)' : ''}`, why: lineupWhy, units: [p.lead] });
    for (const u of lineup.solo) add({ id: `field:${u}`, step: 'units', text: `Field ${name(u)} alone${forced.includes(u) ? ' (forced)' : ''}`, why: lineupWhy, units: [u] });
    const before = engine.beforeThisMap(run, plan, map);
    before.forEach((b, i) => {
      const who = b.from === 'convoy' || !b.from ? 'the convoy' : name(b.from);
      if (b.kind === 'handover') add({ id: `item:${i}`, step: 'trade', text: `Hand over ${b.item}: ${who} → ${name(b.unit)}`, why: `item plan: ${name(b.unit)} carries it from this map`, units: [b.unit] });
      else
        add({
          id: `item:${i}`,
          step: 'items',
          text: `${b.kind === 'boots' ? 'Use' : 'Drink'} ${b.item}: ${name(b.unit)}${b.kind === 'tonic' ? (b.buy ? ' (buy it first: 150G)' : ' (held)') : ''}`,
          why: b.kind === 'booster' ? 'item plan: +2 for good' : b.kind === 'tonic' ? 'item plan: +2 for this map' : 'item plan (your call: outside the model)',
          units: [b.unit],
        });
    });
  }
  const stop = forecast.shopping[0];
  const shopHere = !noPrep && stop?.key === key;
  if (shopHere)
    stop.lines.forEach((l, i) =>
      add({
        id: `shop:${i}`,
        step: 'armory',
        text: `${l.action === 'forge' ? `Forge ${l.item} to +${KIT_FORGE_MT} Mt` : `Buy ${l.item}`} for ${l.name} (${goldText(l.cost)})`,
        why: `shopping list: ${WHY[l.kind]}; ${chanceText(l.share, { miss: 'skipped', make: 'made' })} of runs`,
        units: [l.unit],
      }),
    );
  // Milestones for the units in the army now: a class change the unit has already made asks nothing.
  const inArmy = new Map(prep.units);
  for (const x of ms) {
    if ((x.kind === 'skill' || x.kind === 'class') && !inArmy.has(x.unit)) continue;
    if (x.kind === 'class' && inArmy.get(x.unit)?.class === x.className) continue;
    switch (x.kind) {
      case 'skill':
        if (!noPrep && !x.wasted && here(x.at))
          add({
            id: x.id,
            step: 'skills',
            text: x.for.kind === 'pass' ? `Equip ${x.name} on ${name(x.unit)} in the last active slot` : `Equip ${x.name} on ${name(x.unit)}`,
            why: x.for.kind === 'pass' ? `${name(x.for.child)} inherits it` : `its build for ${x.at.label}`,
            units: [x.unit],
          });
        break;
      case 'class': {
        const seal = x.seal === 'master' ? 'Master Seal' : 'Second Seal';
        const why = `the roadmap: ${name(x.unit)} as ${x.className} ${x.at.when === 'end' ? 'by the end of' : 'before'} ${x.at.label}`;
        if (!noPrep && x.source.how === 'armory' && here(x.source.at) && !(shopHere && stop!.lines.some((l) => l.kind === 'seal' && l.unit === x.unit)))
          add({ id: `${x.id}:buy`, step: 'armory', text: `Buy a ${seal} for ${name(x.unit)}`, why, units: [x.unit] });
        if (!noPrep && here(x.at) && x.at.when === 'start') add({ id: x.id, step: 'items', text: `Change ${name(x.unit)} to ${x.className} with a ${seal}`, why, units: [x.unit] });
        if (x.source.how === 'found' && here(x.source.at)) add({ id: `${x.id}:found`, step: 'map', text: `Carry away the ${seal} (${x.source.note})`, why, units: [x.unit] });
        break;
      }
      case 'recruit':
        if (here(x.at)) add({ id: x.id, step: 'map', text: `Recruit ${name(x.child)}`, why: `the roadmap: ${name(x.child)} joins on this map`, units: [] });
        break;
      case 'support':
        break;
    }
  }
  // Talks the play makes that no milestone names, and the side goals chased here.
  const talked = new Set<string>();
  for (const t of play.log)
    for (const a of t.acts)
      if (a.kind === 'talk' && a.target && !talked.has(a.target) && !actions.some((x) => x.id === `recruit:${a.target}`)) {
        talked.add(a.target);
        add({ id: `talk:${a.target}`, step: 'map', text: `Turn ${t.turn}: ${name(a.unit as RosterUnit)} talks to ${name(a.target as RosterUnit)}`, why: `recruits ${name(a.target as RosterUnit)}`, units: [a.unit as RosterUnit] });
      }
  for (const g of forecast.sideGoals.filter((x) => x.key === key && x.chase))
    add({ id: `goal:${g.id}`, step: 'map', text: `Chase ${g.label}`, why: `side goal${g.secured === undefined ? '' : `: secured in ${chanceText(g.secured, { miss: 'missed', make: 'secured' })} of runs`}`, units: [] });
  if (lplus) add({ id: 'lplus', step: 'map', text: 'Inspect each enemy’s skills and note them in the Lunatic+ checklist', why: 'the matchups and threats then use what you saw, not the worst case', units: [] });

  // ---- threats -----------------------------------------------------------------------------------------------------
  const simGroups = [...new Map([...sim.foes, ...sim.waves.flatMap((w) => w.groups)].map((g) => [g.key, g] as const)).values()];
  const worstOf = (g: SimFoeGroup) => {
    let worst: { unit: RosterUnit; res: Matchup; hp: number } | undefined;
    const consider = (unit: RosterUnit, res: Matchup, hp: number) => {
      if (!worst || res.worstRound / hp > worst.res.worstRound / worst.hp) worst = { unit, res, hp };
    };
    const fp = g.pool ?? [];
    for (const x of groups) {
      consider(x.lead.id as RosterUnit, worstRound(x.lead, x.back, x.support, g.foe, fp), x.lead.fighter.stats.hp);
      if (x.back) consider(x.back.id as RosterUnit, worstRound(x.back, undefined, null, g.foe, fp), x.back.fighter.stats.hp);
    }
    return worst;
  };
  const worstBy = new Map(simGroups.map((g) => [g.key, worstOf(g)]));
  /** A foe group as a card names it: "Feroxi (Archer)", the boss by name. */
  const groupName = (g: SimFoeGroup) => (g.foe.name === g.foe.className || g.target ? g.foe.name : `${g.foe.name} (${g.foe.className})`);
  const risk = groupRisk(play);
  const kills = new Map<string, { unit: RosterUnit; k: number }[]>();
  for (const u of mapExp?.units ?? []) for (const [g, k] of Object.entries(u.kills)) if (k >= 0.05) kills.set(g, [...(kills.get(g) ?? []), { unit: u.unit, k }]);
  const playGroups = new Map(play.groups.map((g) => [g.key, g]));
  const threats: ThreatRow[] = simGroups.map((g) => {
    const w = worstBy.get(g.key);
    const count = playGroups.get(g.key)?.count ?? 1;
    const who = (kills.get(g.key) ?? []).sort((a, b) => b.k - a.k).map((x) => `${name(x.unit)} ×${x.k.toFixed(1)}`);
    return {
      key: g.key,
      name: `${g.target ? '★ ' : ''}${g.foe.name}${count > 1 ? ` ×${count}` : ''}`,
      className: g.foe.className,
      detail: [g.foe.weapon?.name, g.foe.skills.join(', '), g.pool?.length ? `+2 of ${g.pool.join(', ')}` : ''].filter(Boolean).join(' · '),
      worst: w ? `Worst round ${w.res.worstRound} / ${w.hp} HP on ${name(w.unit)}` : '—',
      worstKills: !!w && !w.res.survives,
      chance: riskText(risk.get(g.key) ?? 0),
      who: who.join(' · ') || '—',
    };
  });
  threats.sort((a, b) => (risk.get(b.key) ?? 0) - (risk.get(a.key) ?? 0) || Number(b.worstKills) - Number(a.worstKills));
  const army = groups.flatMap((g) => [g.lead.fighter, ...(g.back ? [g.back.fighter] : [])]);
  const flags = dangerFlags(army, foes, pool, (f) => seen[foeKey(f)])
    .filter((f) => f.kind !== 'kills')
    .map((f) => `${{ effective: '⚔', counter: '↩', doubles: '»', kills: '☠' }[f.kind]} ${f.text}`);

  // ---- the cards ---------------------------------------------------------------------------------------------------
  const expOf = new Map((mapExp?.units ?? []).map((u) => [u.unit, u]));
  const readingOf = new Map((readings?.readings ?? []).filter((r) => r.reading === 'at-risk').map((r) => [r.unit, r]));
  const heldHere = new Set((run.pins ?? []).flatMap((p) => (p.kind === 'span' && p.from === key && p.to === key ? [p.unit] : [])));
  const member = (unit: RosterUnit, position: CardMember['position']): CardMember => {
    const e = expOf.get(unit);
    const next = ms.find((x) => (x.kind === 'skill' || x.kind === 'class') && x.unit === unit && x.at.index >= index && !(x.kind === 'skill' && x.wasted));
    const r = readingOf.get(unit);
    const worst = r?.worst && ms.find((x) => x.id === r.worst!.id);
    return {
      unit,
      name: name(unit),
      position,
      job: jobOf(play, unit, position, name),
      priority: PRIORITY_TEXT[e?.priority ?? 'normal'],
      exp: e ? `≈${Math.round(e.exp)} EXP · ${e.level.low === e.level.high ? levelText(e.level.median) : `${levelText(e.level.low)} – ${levelText(e.level.high)}`}` : '—',
      ...(next ? { milestone: msText(next, unit) } : {}),
      ...(r
        ? {
            atRisk: {
              text: `at risk: ${worst ? milestoneShort(worst, unit, gender) : (r.worst?.id ?? '')}${r.worst?.reached ? ` ${chanceText(r.worst.chance)}` : ''}`,
              ...(r.change ? { fix: { text: `${pinText(r.change.pin, gender, labels)}: ${chanceText(r.change.chance)}`, pin: r.change.pin, ...(r.change.flawless ? { worth: r.change.flawless } : {}) } } : {}),
            },
          }
        : {}),
      forced: forced.includes(unit),
      ...(prep.joining.includes(unit) ? { joins: 'joins' as const } : prep.mapOnly.includes(unit) ? { joins: 'this map only' as const } : {}),
    };
  };
  const card = (id: string, units: readonly RosterUnit[], lead?: RosterUnit, back?: RosterUnit): PairCard => {
    const set = new Set<string>(units);
    const mine = groupRisk(play, set);
    // Groups of one name and class read as one threat: the chance either kills someone.
    const byName = new Map<string, number>();
    for (const [k, p] of mine) {
      const g = simGroups.find((x) => x.key === k);
      const n = g ? groupName(g) : k;
      byName.set(n, 1 - (1 - (byName.get(n) ?? 0)) * (1 - p));
    }
    const threatsHere = [...byName].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const deadly = [
      ...new Set(
        simGroups.flatMap((g) => {
          const w = worstBy.get(g.key);
          return w && !w.res.survives && set.has(w.unit) ? [`${groupName(g)}: ${w.res.worstRound} / ${w.hp} HP on ${name(w.unit)}`] : [];
        }),
      ),
    ];
    return {
      id,
      title: back ? `${name(lead!)} + ${name(back)}` : name(units[0]!),
      members: back ? [member(lead!, 'Lead'), member(back, 'Back')] : [member(units[0]!, 'Solo')],
      ...(back && supportWhy(lead!, back) ? { support: capital(supportWhy(lead!, back)!) } : {}),
      stances: lead && back ? stancePlan(play, lead, name) : [],
      threats: threatsHere.map(([n, p]) => ({ name: n, chance: riskText(p) })),
      ...(deadly.length ? { worstKills: `Worst case kills: ${deadly.join('; ')}` } : {}),
      todo: actions.filter((a) => a.units.some((u) => set.has(u))).map((a) => a.id),
      pinned: units.some((u) => heldHere.has(u)),
    };
  };
  const cards = [
    ...lineup.pairs.map((p) => (p.back ? card(`card:${p.lead}`, [p.lead, p.back], p.lead, p.back) : card(`card:${p.lead}`, [p.lead]))),
    ...lineup.solo.map((u) => card(`card:${u}`, [u])),
  ];

  // ---- not fielded -------------------------------------------------------------------------------------------------
  const wish = new Set(plan.wishlist.units.map((w) => w.unit));
  const reserves = new Set(plan.wishlist.reserves.map((r) => r.unit));
  const outHere = new Set((run.pins ?? []).flatMap((p) => (p.kind === 'span' && p.position === 'out' && p.from === key && p.to === key ? [p.unit] : [])));
  const outPinned = new Set(engine.pins(run).flatMap((p: PlanPin) => (p.kind === 'keep' && p.keep === 'out' ? [p.unit] : p.kind === 'span' && p.position === 'out' && !(p.from === key && p.to === key) ? [p.unit] : [])));
  const inLineup = new Set(lineup.deployed);
  const arrivals = new Map((sim.recruits ?? []).flatMap((r) => (r.arrives !== undefined ? [[r.id, r.arrives] as const] : [])));
  const notFielded: NotFielded[] = [
    ...prep.units
      .map(([u]) => u)
      .filter((u) => !inLineup.has(u))
      .map((u) => ({
        unit: u,
        name: name(u),
        dropped: outHere.has(u),
        reason: outHere.has(u)
          ? 'dropped here (a pin over this map only)'
          : outPinned.has(u)
            ? 'kept out by a pin'
            : !byUnit.has(u)
              ? 'no stats recorded'
              : reserves.has(u)
                ? 'a reserve'
                : !wish.has(u)
                  ? 'not in the wishlist'
                  : `no room: the map deploys ${max}`,
      })),
    ...prep.later.map((l) => ({ unit: l.unit, name: name(l.unit), dropped: false, reason: arrivals.has(l.unit) ? `arrives on turn ${arrivals.get(l.unit)}` : `arrives later: ${l.how ?? 'when is unknown'}` })),
  ];

  // ---- the head ----------------------------------------------------------------------------------------------------
  const noDeath = at?.noDeath ?? play.noDeath;
  const turns = at?.turns ?? play.turns;
  const todo = actions.filter((a) => a.step !== 'map').length;
  const head = {
    noDeath: `No-death chance on this map: ${chanceText(noDeath)}`,
    flawless: `The plan’s flawless chance: ${chanceText(forecast.chance)} ±${(forecast.margin * 100).toFixed(1)}`,
    turns: `about ${Math.round(turns)} turn${Math.round(turns) === 1 ? '' : 's'}`,
    deploy: `deploy ${lineup.deployed.length} of ${max}${noPrep ? ' (forced)' : ''}`,
    detail: `${playDetail(engine, sim, play)}${noPrep ? '' : ` ${todo ? `${todo} thing${todo === 1 ? '' : 's'} to do before you start.` : 'Nothing to do in the preparations.'}`}`,
  };
  const before = noPrep
    ? []
    : PREP_STEPS.map((s) => ({ step: s, label: STEP_LABEL[s], actions: actions.filter((a) => a.step === s) })).filter((s) => s.actions.length);
  const blind = engine.blindSpots().filter((b) => (play.blindSpots as readonly string[]).includes(b.id) || (forecast.blindSpots as readonly string[]).includes(b.id));
  return {
    title: `Prepare: ${m.label}${m.kind === 'story' ? `: ${m.title}` : ''}`,
    key,
    noPrep,
    ...(noPrep
      ? { banner: `No preparation phase: the game fields ${listOf(lineup.deployed.map((u) => name(u)))} and starts the map at once. Nothing here is done in menus; it’s a plan for the map itself.` }
      : {}),
    head,
    cards,
    notFielded,
    before,
    onMap: actions.filter((a) => a.step === 'map'),
    threats,
    flags,
    shopping: noPrep ? undefined : shoppingOf(forecast),
    checks: mapChecks(engine, run, key, plan, lineup).map((c) => c.text),
    assumptions: blind.map((b) => `${b.label} (${LEAN[b.lean]})`),
    lineup,
  };
}

const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

// ---- the page ----------------------------------------------------------------------------------------------------

/** Lunatic+ (#120): each enemy to inspect once the map starts, and the random skills seen, which the matchups then use. */
function lplusChecklist(ctx: PrepContext, foes: readonly Foe[], pool: readonly string[], seen: Readonly<Record<string, readonly string[]>>): HTMLElement {
  return h(
    'details',
    { ...guide('lplus-checklist'), class: 'prep-box' },
    h('summary', {}, h('b', {}, 'Lunatic+ checklist')),
    h('p', { class: 'muted small' }, `Each enemy has 2 extra skills from ${pool.join(', ')}. Inspect them when the map starts and note what you see: the matchups use it in place of the worst case.`),
    h(
      'table',
      { class: 'grid small' },
      h(
        'tbody',
        {},
        ...foes.map((f) => {
          const key = foeKey(f);
          return h(
            'tr',
            {},
            h('td', {}, seen[key] ? '✓' : '☐'),
            h('td', {}, `${f.name}${f.count > 1 ? ` ×${f.count}` : ''} (${f.className})`),
            h(
              'td',
              {},
              h('input', {
                value: (seen[key] ?? []).join(', '),
                placeholder: 'e.g. Luna+, Pass',
                'aria-label': `${f.name}: Lunatic+ skills seen`,
                onchange: (e) => ctx.setRun(withSeenSkills(ctx.run, ctx.map, key, (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean))),
              }),
            ),
          );
        }),
      ),
    ),
  );
}

/**
 * Loadouts (#121) with the item plan's carriers applied (#193): each fielded unit's weapons for this map from its
 * inventory (and what it's handed before the map) and the convoy, then its other items.
 */
function loadouts(ctx: PrepContext, plan: Plan, d: Deployment, byUnit: ReadonlyMap<RosterUnit, DeployCandidate>, snap: Snapshot, foes: readonly Foe[], pool: (f: Foe) => readonly string[]): HTMLElement {
  const gender = ctx.run.roster.run.gender ?? plan.robin.gender;
  const inv = new Map(Object.entries(snap.units).map(([u, s]) => [u as RosterUnit, [...(s?.inventory ?? [])]]));
  const convoy = [...snap.convoy];
  const handed = new Set<string>();
  for (const b of ctx.engine.beforeThisMap(ctx.run, plan, ctx.map)) {
    if (b.kind !== 'handover') continue;
    const from = b.from && b.from !== 'convoy' ? inv.get(b.from) : convoy;
    const i = from?.findIndex((x) => x.item === b.item) ?? -1;
    const copy = i >= 0 ? from!.splice(i, 1)[0]! : { item: b.item, uses: itemByName(b.item)?.uses ?? 1 };
    inv.set(b.unit, [...(inv.get(b.unit) ?? []), copy]);
    handed.add(`${b.unit}|${b.item}`);
  }
  const backOf = new Map(d.pairs.map((p) => [p.lead, p.back]));
  const rows = d.deployed.flatMap((u) => {
    const c = byUnit.get(u);
    if (!c) return [];
    const back = backOf.get(u);
    const l = suggestLoadout(c, back ? byUnit.get(back) : undefined, inv.get(u) ?? [], convoy, foes, pool);
    return [h('tr', {}, h('td', {}, unitName(u, gender)), h('td', {}, l.items.map((i) => `${i.item}${handed.has(`${u}|${i.item}`) ? ' (handed over)' : i.from === 'convoy' ? ' (convoy)' : ''}${i.foes ? ` ·${i.foes}` : ''}`).join(', ') || '—'))];
  });
  return h(
    'details',
    { ...guide('prep-loadouts'), class: 'prep-box' },
    h('summary', {}, h('b', {}, 'Loadouts')),
    h('p', { class: 'muted small' }, 'With the item plan’s handovers made: the weapons that win its matchups (·how many foes each is best against), convoy weapons of a kind it already uses, then its other items.'),
    h('table', { class: 'grid small' }, h('tbody', {}, ...rows)),
  );
}

/** Seals and promotions (#122): when seals can be bought, how many are held, and promote now or later, beside the plan's class changes. */
function seals(ctx: PrepContext, d: Deployment, byUnit: ReadonlyMap<RosterUnit, DeployCandidate>, snap: Snapshot, foes: readonly Foe[], pool: (f: Foe) => readonly string[], mapOnly: readonly RosterUnit[], planned: readonly PrepAction[]): HTMLElement {
  const gender = ctx.run.roster.run.gender;
  const cleared = new Set(ctx.run.entries.map((e) => e.map));
  const avail = sealAvailability(cleared);
  const held = sealsHeld([...snap.convoy, ...Object.values(snap.units).flatMap((u) => u?.inventory ?? [])]);
  const growthsOf = (u: RosterUnit): Readonly<Record<Stat, number>> | undefined =>
    u === 'robin' ? ROBIN_GROWTHS : u in CHILD_UNITS ? CHILD_UNITS[u as keyof typeof CHILD_UNITS].growths : (FIRST_GEN_UNITS[u as UnitId]?.growths as Record<Stat, number> | undefined);
  const genderOf = (u: RosterUnit) => (u === 'robin' ? (gender ?? 'M') : u in CHILD_UNITS ? CHILD_UNITS[u as keyof typeof CHILD_UNITS].gender : FIRST_GEN_UNITS[u as UnitId].gender);
  // A setup used only on this map (Premonition's) is never promoted.
  const advice = d.deployed.flatMap((u) => {
    if (mapOnly.includes(u)) return [];
    const c = byUnit.get(u);
    const s = snap.units[u];
    if (!c || !s) return [];
    const growths = growthsOf(u);
    const a = promotionAdvice({ c, level: s.level, promoted: s.promoted, gender: genderOf(u) as 'M' | 'F', personalGrowths: growths && 'hp' in growths ? growths : undefined, foes, pool, seals: avail, held: held.master });
    return a ? [a] : [];
  });
  return h(
    'details',
    { ...guide('prep-seals'), class: 'prep-box' },
    h('summary', {}, h('b', {}, 'Seals and promotions')),
    h('p', { class: 'small' }, `${avail.note} Held: ${held.master} Master, ${held.second} Second.`),
    planned.length ? h('p', { class: 'small' }, `The plan’s class changes here (in the checklist): ${planned.map((a) => a.text).join('; ')}.`) : h('p', { class: 'muted small' }, 'The plan changes no class before this map.'),
    advice.length
      ? h(
          'table',
          { class: 'grid small' },
          h('thead', {}, h('tr', {}, ...['Unit', 'Promote to', 'When', 'Why', 'Expected at 20, then promoted'].map((t) => h('th', {}, t)))),
          h(
            'tbody',
            {},
            ...advice.map((a) =>
              h(
                'tr',
                {},
                h('td', {}, a.unit),
                h('td', {}, a.to),
                h('td', { class: a.advice === 'now' ? 'pos' : '' }, a.advice === 'now' ? 'Now' : a.advice === 'later' ? 'Later' : 'Not yet'),
                h('td', {}, a.why),
                h('td', { class: 'muted', title: 'Expected: average growths, not the unit’s real stats' }, a.expected ? `expected: ${STATS.map((s) => `${STAT_LABELS[s]} ${a.expected![s]}`).join(' · ')}` : '—'),
              ),
            ),
          ),
        )
      : null,
    h('p', { class: 'muted small' }, 'Expected stats use average growths (the unit’s personal growths plus its class’s): a guide to “now or later”, not its real stats.'),
  );
}

/**
 * The loss banner (#208): while a loss is open (a death, a missed recruit or a marriage off the plan whose loss item
 * isn’t accepted yet), the plan this page reads predates it. Undefined with none open.
 */
export function lossBannerText(engine: Engine, run: Run): string | undefined {
  const losses = openLosses(run, adoptedOf(run));
  if (!losses.length) return undefined;
  const name = (u: RosterUnit | 'maiden') => unitName(u, run.roster.run.gender);
  const what = losses.map((l) => lossText(engine, l, name));
  return `Your plan predates the loss (${what.join('; ')}): accept its re-solve in the Run view’s inbox to plan for the army that’s left.`;
}

function lossBanner(ctx: PrepContext): HTMLElement | null {
  const text = lossBannerText(ctx.engine, ctx.run);
  return text ? h('div', { class: 'banner loss required' }, h('b', {}, 'The plan predates the loss'), h('div', { class: 'small' }, text)) : null;
}


/** The one-map span pins that set a unit's place here: pairing it, alone, or out. */
function setHere(ctx: PrepContext, key: string, unit: RosterUnit, position: SpanPosition | undefined, partner?: RosterUnit): void {
  const mine = (u: RosterUnit) => (ctx.run.pins ?? []).filter((p): p is SpanPin => p.kind === 'span' && p.unit === u && p.from === key && p.to === key);
  let run = withoutPins(ctx.run, [...mine(unit), ...(partner ? mine(partner) : [])]);
  if (position) run = withPin(run, mapSpanPin(unit, position, key, partner));
  ctx.setRun(run);
}

const CHECKED = new Set<string>();

/** The page's plan and forecast, by run: the forecast runs the simulation, so the page draws first and fills in after. */
const FORECASTS = new WeakMap<Run, { plan: Plan; forecast: ExpForecast }>();

/** One pair card (see `PairCard`), with its pins and to-dos wired. */
function pairCard(ctx: PrepContext, r: PrepReadout, c: PairCard, choices: readonly RosterUnit[]): HTMLElement {
  const gender = ctx.run.roster.run.gender;
  const name = (u: RosterUnit) => unitName(u, gender);
  const lead = c.members[0]!;
  const back = c.members[1];
  const jump = () => {
    for (const id of c.todo) document.getElementById(`act-${id}`)?.classList.add('hl');
    document.getElementById(`act-${c.todo[0]}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const controls = r.noPrep
    ? null
    : h(
        'div',
        { class: 'pc-pins small' },
        h(
          'select',
          {
            'aria-label': `${lead.name}’s back`,
            title: 'Pick a back: a span pin over this map only',
            onchange: (e) => {
              const v = (e.target as HTMLSelectElement).value;
              setHere(ctx, r.key, lead.unit, v === 'none' ? 'solo' : 'lead', v === 'none' ? undefined : (v as RosterUnit));
            },
          },
          h('option', { value: 'none', selected: !back }, back ? '— go alone' : '— alone'),
          ...choices.filter((u) => u !== lead.unit).map((u) => h('option', { value: u, selected: u === back?.unit }, `Back: ${name(u)}`)),
        ),
        back ? h('button', { class: 'mini', title: `Make ${back.name} the lead: a span pin over this map only`, onclick: () => setHere(ctx, r.key, back.unit, 'lead', lead.unit) }, '⇅') : null,
        c.pinned ? h('button', { class: 'mini', title: 'Lift this map’s pins on this card: the plan picks again', onclick: () => ctx.setRun(withoutPins(ctx.run, (ctx.run.pins ?? []).filter((p) => p.kind === 'span' && p.from === r.key && p.to === r.key && c.members.some((m) => m.unit === p.unit)))) }, 'unpin') : null,
      );
  const memberRow = (x: CardMember) =>
    h(
      'div',
      { class: 'mem' },
      h('span', { class: 'pos-tag' }, x.position),
      ' ',
      h('b', {}, x.name),
      x.joins ? h('span', { class: 'chip small', title: x.joins === 'joins' ? 'Joins your army on this map, from its start' : 'Fielded with a setup used only on this map: it never joins your army' }, x.joins) : null,
      ' ',
      h('span', { class: 'muted small' }, `${x.job} · priority ${x.priority} · ${x.exp}`),
      !r.noPrep && !x.forced ? h('button', { class: 'mini', title: 'Leave out of this map: a span pin over this map only', onclick: () => setHere(ctx, r.key, x.unit, 'out') }, '✕') : x.forced ? h('span', { class: 'muted small', title: 'The map fields it: it can’t be dropped' }, ' forced') : null,
      x.milestone ? h('div', { class: 'muted small' }, `↳ ${x.milestone}`) : null,
      x.atRisk
        ? h(
            'div',
            { class: 'small risk' },
            h('span', { class: 'chip warn' }, 'at risk'),
            ` ${x.atRisk.text.replace(/^at risk: /, '')}`,
            x.atRisk.fix
              ? h(
                  'button',
                  {
                    class: 'mini',
                    title: `${capital(x.atRisk.fix.text)}${x.atRisk.fix.worth ? `, flawless chance ${x.atRisk.fix.worth < 0 ? '−' : '+'}${Math.abs(x.atRisk.fix.worth * 100).toFixed(1)}` : ''}`,
                    onclick: () => {
                      const plan = FORECASTS.get(ctx.run)?.plan;
                      if (!plan) return;
                      ctx.setRun(withEdit(ctx.run, { label: capital(pinText(x.atRisk!.fix!.pin, gender)), ...ctx.engine.suggestedEdit(ctx.run, plan, x.atRisk!.fix!.pin) }));
                    },
                  },
                  'Pin it',
                )
              : null,
          )
        : null,
    );
  return h(
    'div',
    { class: 'pair-card', id: c.id },
    h('div', { class: 'pc-head' }, h('b', {}, c.title), c.support ? h('div', { class: 'muted small' }, c.support) : null),
    ...c.members.map(memberRow),
    c.stances.length ? h('div', { class: 'stances' }, ...c.stances.map((s) => h('span', {}, h('small', {}, s.turns), ` ${s.text}`))) : null,
    c.threats.length || c.worstKills
      ? h(
          'div',
          { class: 'danger small' },
          ...c.threats.map((t) => h('span', {}, `${t.name} ${t.chance}`)),
          c.worstKills ? h('span', { class: 'chip bad', title: c.worstKills }, 'worst case kills') : null,
        )
      : null,
    h('div', { class: 'pc-foot' }, c.todo.length ? h('button', { class: 'linkish small', title: 'Show them in the checklist', onclick: jump }, `${c.todo.length} to-do${c.todo.length === 1 ? '' : 's'} →`) : h('span', { class: 'muted small' }, 'nothing to do'), controls),
  );
}

/** A checklist action with its tick (view state) and why. */
function actionRow(a: PrepAction): HTMLElement {
  const box = h('input', { type: 'checkbox', checked: CHECKED.has(a.id) });
  const row = h('label', { class: `act${CHECKED.has(a.id) ? ' done' : ''}`, id: `act-${a.id}` }, box, h('span', {}, a.text, h('br', {}), h('small', { class: 'muted' }, a.why)), a.worth ? h('span', { class: 'pos small' }, `+${(a.worth * 100).toFixed(1)}`) : null);
  box.addEventListener('change', () => {
    if ((box as HTMLInputElement).checked) CHECKED.add(a.id);
    else CHECKED.delete(a.id);
    row.classList.toggle('done', (box as HTMLInputElement).checked);
  });
  return row;
}

/** The page's body once the forecast is in: the cards beside the column. */
function body(ctx: PrepContext, plan: Plan, forecast: ExpForecast): HTMLElement {
  const { engine, run } = ctx;
  const readings = solveState(run)?.readings;
  const r = prepReadout(engine, run, ctx.map, { plan, forecast, ...(readings ? { readings } : {}) });
  const m = engine.maps().find((x) => x.id === ctx.map)!;
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const lplus = difficulty === 'lunatic-plus';
  const pool = lplus ? engine.lunaticPlusPool(m) : [];
  const seen = run.seen?.[m.id] ?? {};
  const foes = foesOf(m, table, lplus).map((f) => (seen[foeKey(f)] ? { ...f, skills: [...new Set([...f.skills, ...seen[foeKey(f)]!])] } : f));
  const poolFor = (f: Foe) => (seen[foeKey(f)] ? [] : pool);
  const foe = foes[Math.min(ctx.foe, foes.length - 1)];
  const gender = run.roster.run.gender ?? plan.robin.gender;
  const prep = prepUnits(run, m.id);
  const latest = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const snap: Snapshot = { ...latest, units: { ...latest.units, ...Object.fromEntries(prep.units) } };
  const byUnit = new Map<RosterUnit, DeployCandidate>(
    prep.units.flatMap(([unit, u]) => {
      const f = fighterOf(unitName(unit, gender), u);
      return f ? [[unit, { unit, fighter: f.fighter, weapons: f.weapons, items: f.items, supports: u.supports } as DeployCandidate]] : [];
    }),
  );
  const d = r.lineup;
  const choices = [...byUnit.keys()];
  const all = [...r.before.flatMap((s) => s.actions), ...r.onMap];

  // Matchups (#119): each lead with its back against the chosen foe.
  const lineupRows = [...d.pairs.map((p) => ({ unit: p.lead, backId: p.back })), ...d.solo.map((unit) => ({ unit, backId: undefined as RosterUnit | undefined }))].flatMap(({ unit, backId }) => {
    const c = byUnit.get(unit);
    const u = snap.units[unit];
    if (!c || !u || !foe) return [];
    const back = backId ? byUnit.get(backId)?.fighter : undefined;
    const support = backId ? (u.supports.find((s) => s.partner === backId)?.rank ?? null) : null;
    const best = c.weapons.length ? bestWeapon(c.fighter, c.weapons, back, support, foe, poolFor(foe)) : undefined;
    return [{ unit, u, backId, best }];
  });
  const cell = (ok: boolean, text: string, title?: string) => h('td', { class: ok ? 'pos' : 'neg', title }, text);
  const matchRow = (x: (typeof lineupRows)[number]) => {
    const res = x.best?.result;
    const backName = x.backId ? unitName(x.backId, gender) : '—';
    if (!res) return h('tr', {}, h('td', {}, unitName(x.unit, gender)), h('td', {}, backName), h('td', { colspan: '9', class: 'muted' }, 'No weapon recorded in its inventory'));
    return h(
      'tr',
      {},
      h('td', {}, unitName(x.unit, gender)),
      h('td', {}, backName),
      h('td', {}, x.best!.weapon?.item.name ?? '—'),
      h('td', { class: 'num' }, `${res.damage}×${res.hits}`),
      cell(res.oneRounds, res.oneRounds ? '✓' : res.oneRoundsWithDualStrikes ? '✓ w/ DS' : '✗', res.oneRoundsWithDualStrikes && !res.oneRounds ? `Only if dual strikes land (${res.dualStrikeRate}%)` : undefined),
      h('td', { class: 'num' }, `${res.dualStrikeRate || '—'}${res.dualStrikeRate ? '%' : ''}`),
      h('td', {}, `${res.doubles ? '2× ' : ''}${res.doubled ? 'doubled' : ''}` || '—'),
      cell(res.survives, `${res.worstRound} / ${x.u.stats!.hp}`, `Worst hit ${res.worstHit}; the most it takes in a round`),
      h('td', { class: 'num' }, `${res.hit} / ${res.crit}`),
      h('td', { class: 'num' }, `${res.foeHit} / ${res.foeCrit}`),
      h('td', { class: 'muted small' }, res.notes.join('; ')),
    );
  };

  const main = h(
    'main',
    { class: 'prep-main' },
    r.banner ? h('div', { class: 'banner warn-b' }, h('b', {}, 'No preparation phase. '), r.banner.replace(/^No preparation phase: /, '')) : null,
    h('div', { class: 'pair-cards' }, ...r.cards.map((c) => pairCard(ctx, r, c, choices))),
    r.notFielded.length
      ? h(
          'div',
          { class: 'small not-fielded' },
          h('b', {}, 'Not fielded: '),
          ...r.notFielded.flatMap((x, i) => [
            i ? '; ' : '',
            x.dropped ? h('button', { class: 'linkish', title: 'Lift the pin: the plan may field it again', onclick: () => setHere(ctx, r.key, x.unit, undefined) }, `${x.name} (${x.reason})`) : `${x.name} (${x.reason})`,
          ]),
        )
      : null,
  );
  const aside = h(
    'aside',
    { class: 'prep-side' },
    h(
      'div',
      { class: 'prep-box no-death' },
      h('b', {}, r.head.noDeath),
      h('div', { class: 'small' }, `${r.head.flawless} · ${r.head.turns} · ${r.head.deploy}`),
      h('p', { class: 'muted small' }, r.head.detail),
    ),
    h(
      'details',
      { class: 'prep-box checklist', open: true },
      h('summary', {}, h('b', {}, r.noPrep ? 'On the map' : 'Before this map'), ` (${all.length})`),
      ...r.before.flatMap((s) => [h('h4', {}, s.label), ...s.actions.map(actionRow)]),
      r.onMap.length ? h('h4', {}, r.noPrep ? '' : 'On the map') : null,
      ...r.onMap.map(actionRow),
      all.length ? null : h('p', { class: 'muted small' }, r.noPrep ? 'Nothing beyond the cards: fight as they say.' : 'Nothing to do before this map.'),
    ),
    h(
      'details',
      { ...guide('prep-threats'), class: 'prep-box', open: true },
      h('summary', {}, h('b', {}, 'Threats'), ` (${foes.reduce((n, f) => n + f.count, 0)} enemies)`),
      h('p', { class: 'muted small' }, 'The cautious worst case (its worst round against the unit it hurts most) beside the play’s chance that the group kills someone, and who takes it under the EXP priority (kills a run).'),
      h(
        'table',
        { class: 'grid small' },
        h('thead', {}, h('tr', {}, ...['Enemy', 'Worst case', 'Kills someone', 'Who takes it'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...r.threats.map((t) => h('tr', {}, h('td', {}, t.name, h('div', { class: 'muted' }, [t.className, t.detail].filter(Boolean).join(' · '))), h('td', { class: t.worstKills ? 'neg' : '' }, t.worst), h('td', { class: 'num' }, t.chance), h('td', {}, t.who)))),
      ),
      h('div', { ...guide('danger-flags'), class: 'small' }, h('b', {}, 'Danger flags '), r.flags.length ? h('ul', {}, ...r.flags.map((f) => h('li', {}, f))) : h('span', { class: 'muted' }, 'nothing else stands out'), h('div', { class: 'muted' }, 'A round that can kill is in the worst case column, and flags its pair card: worst case kills.')),
      m.reinforcements.length
        ? h(
            'div',
            { class: 'small' },
            h('b', {}, 'Reinforcements '),
            h('span', { class: 'muted' }, table === 'normal' ? REINFORCEMENT_RULE.normal : REINFORCEMENT_RULE['hard+']),
            h('ul', {}, ...m.reinforcements.map((x) => h('li', { style: `margin-left:${(x.length - x.trimStart().length) * 6}px` }, x.trim()))),
          )
        : null,
    ),
    lplus ? lplusChecklist(ctx, foes, pool, seen) : null,
    r.shopping
      ? h(
          'details',
          { ...guide('prep-supply'), class: 'prep-box' },
          h('summary', {}, h('b', {}, r.shopping.title)),
          h('p', { class: 'muted small' }, r.shopping.note),
          r.before.some((s) => s.step === 'armory')
            ? h('p', { class: 'small' }, 'This map’s buys are in the checklist, under Armory and forge.')
            : r.shopping.rows.length
              ? h(
                  'table',
                  { class: 'grid small' },
                  h('thead', {}, h('tr', {}, ...['For', 'Do', 'Cost', 'Chance it’s made'].map((t) => h('th', {}, t)))),
                  h('tbody', {}, ...r.shopping.rows.map((row) => h('tr', {}, ...row.map((c, i) => h('td', i === 2 ? { class: 'num' } : {}, c))))),
                )
              : h('p', { class: 'muted small' }, 'Nothing to buy here.'),
        )
      : null,
    r.noPrep ? null : seals(ctx, d, byUnit, snap, foes, poolFor, prep.mapOnly, all.filter((a) => a.id.startsWith('class:') && !a.id.includes(':buy') && !a.id.includes(':found'))),
    r.noPrep ? null : loadouts(ctx, plan, d, byUnit, snap, foes, poolFor),
    h(
      'details',
      { class: 'prep-box' },
      h('summary', {}, h('b', {}, 'Checks and assumptions')),
      r.checks.length ? h('div', {}, h('ul', { class: 'small' }, ...r.checks.map((c) => h('li', {}, c))), h('p', { class: 'muted small' }, 'Free checks: the plan already sets them up. Record results asks what you saw.')) : h('p',{ class: 'muted small' }, 'This map offers no check: nothing on it sets up an open rule’s situation.'),
      h('p', { class: 'muted small' }, 'The play rests on:'),
      h('ul', { class: 'muted small' }, ...r.assumptions.map((a) => h('li', {}, a))),
    ),
    h(
      'details',
      { class: 'prep-box' },
      h('summary', {}, h('b', {}, 'Matchups')),
      h(
        'div',
        { ...guide('matchup-foe'), class: 'chips' },
        ...foes.map((f: Foe, i) => h('button', { class: `mini${f === foe ? ' on' : ''}`, onclick: () => ctx.setFoe(i) }, `${f.boss ? '★ ' : ''}${f.name}${f.count > 1 ? ` ×${f.count}` : ''} (${f.className})`)),
      ),
      foe ? h('div', { class: 'muted small' }, `${foe.name}: HP ${foe.stats.hp} · Str ${foe.stats.str} · Mag ${foe.stats.mag} · Skl ${foe.stats.skl} · Spd ${foe.stats.spd} · Def ${foe.stats.def} · Res ${foe.stats.res}${foe.weapon ? ` · ${foe.weapon.name}` : ''}${foe.skills.length ? ` · ${foe.skills.join(', ')}` : ''}`) : null,
      lineupRows.length
        ? h(
            'div',
            { class: 'scroll-x' },
            h(
              'table',
              { ...guide('matchup-table'), class: 'grid small' },
              h('thead', {}, h('tr', {}, ...['Lead', 'Back', 'Weapon', 'Dmg', 'One round', 'Dual strike', 'Doubling', 'Worst round / HP', 'Hit / Crit', 'Foe hit / crit', 'Why'].map((t) => h('th', {}, t)))),
              h('tbody', {}, ...lineupRows.map(matchRow)),
            ),
          )
        : h('p', { class: 'muted' }, 'Record your units’ stats and inventories in the chapter log to see matchups.'),
    ),
    (() => {
      const g = howToRun(engine, m.id);
      return g ? h('details', { class: 'prep-box' }, h('summary', {}, h('b', {}, 'Chapter guide')), g) : null;
    })(),
  );
  return h('div', { class: 'prep-cols' }, main, aside);
}

export function prepPage(ctx: PrepContext): HTMLElement[] {
  const { engine, run } = ctx;
  const m = engine.maps().find((x) => x.id === ctx.map)!;
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const done = FORECASTS.get(run);
  const slot = done ? body(ctx, done.plan, done.forecast) : h('p', { class: 'muted' }, 'Playing the plan’s lineup for this map…');
  if (!done)
    setTimeout(() => {
      if (!slot.isConnected) return;
      let f = FORECASTS.get(run);
      if (!f) {
        const plan = ctx.plan ? ctx.plan() : engine.seedPlan(run);
        FORECASTS.set(run, (f = { plan, forecast: engine.expForecast(run, plan) }));
      }
      if (slot.isConnected) slot.replaceWith(body(ctx, f.plan, f.forecast));
    }, 0);
  return [
    h(
      'div',
      { ...guide('prep-page'), class: 'scroll unit-page prep-page' },
      h(
        'header',
        { class: 'unit-head' },
        h('div', {}, h('button', { class: 'ghost small', onclick: ctx.close }, '← Run')),
        h('h2', {}, `Prepare: ${m.label}${m.kind === 'story' ? `: ${m.title}` : ''}`),
        h('div', { class: 'muted small' }, `${difficulty === 'lunatic-plus' ? 'Lunatic+' : difficulty} · the adopted plan’s lineup, played with your latest stats · no movement planning`),
      ),
      lossBanner(ctx),
      slot,
    ),
  ];
}
