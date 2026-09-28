/**
 * Side goals (#191; spec #175, Gold, items and upkeep): the loseable income the plan chases or skips. Each is a map's
 * play-dependent item rows (the chapter data's `play` flags, #180) that one choice secures: escaping Thieves (Chapters
 * 10, 11 and 16, Paralogues 9 and 12), burned villages (Paralogues 2 and 14), Chapter 18's falling chests, and
 * Paralogues 6, 7, 11 and 13's results. Other flagged rows (a Thief looting one chest on Paralogue 1, 4, Chapter 17 or
 * 20; Paralogue 3's villagers; Roster Rescue's Revenants; a recruit-or-kill choice) aren't side goals: never counted.
 *
 * Chasing costs actions in the map play (`SimChase`): an action for each Thief killed, village visited, chest opened or
 * villager guarded, by the turn it would be lost (the turn's a reading of the map: a Thief reaches the edge, raiders
 * reach a village; Chapter 18's are the floor's turns). A goal is secured in a run when its actions were all spent by
 * then; each part of it (Chapter 18's chests) pays on its own. The simulated runs count the share that secure it.
 *
 * The plan's decision per goal: a pin (`SideGoalPlan`, always take or skip) where set, else the default rule: chase
 * when it costs at most one action a turn until its deadline (`chaseByDefault`). The full solve (#199) weighs each by
 * flawless points instead.
 */
import { MAPS, type ChapterData, type MapItemRow } from '../game-data/chapters';
import { itemByName, sellPrice } from '../game-data/items';
import type { Run } from './run';
import { entryShopping } from './shopping';

export const SIDE_GOAL_IDS = [
  'chapter-10-thieves',
  'chapter-11-thief',
  'paralogue-2-village',
  'paralogue-6-result',
  'paralogue-7-result',
  'paralogue-9-ruger',
  'paralogue-11-result',
  'paralogue-12-thieves',
  'paralogue-13-result',
  'paralogue-14-villages',
  'chapter-16-thieves',
  'chapter-18-chests',
] as const;
export type SideGoalId = (typeof SIDE_GOAL_IDS)[number];

export type SideGoalDecision = 'chase' | 'skip';

/**
 * The plan's side goal pins (#191): always take (`chase`) or always skip. A goal with none follows the default rule. A
 * plain record so the Plan (#198) and its pins (#200) can hold it as it is.
 */
export type SideGoalPlan = Readonly<Partial<Record<SideGoalId, SideGoalDecision>>>;

/** One part of a side goal: its rows, secured by `actions` actions by the end of turn `by`'s player phase. */
export type SideGoalPart = {
  readonly rows: readonly MapItemRow[];
  readonly actions: number;
  readonly by: number;
  /** What the part pays in gold: its Bullion at sale price and any gold paid outright. */
  readonly gold: number;
  readonly seals: { readonly master: number; readonly second: number };
};

export type SideGoal = {
  readonly id: SideGoalId;
  readonly map: string;
  /** e.g. `Chapter 10: Thieves`. */
  readonly label: string;
  /** What chasing it means on the map. */
  readonly what: string;
  readonly parts: readonly SideGoalPart[];
  /** Its gold, seals and every item (Bullion and gold included), over all its parts. */
  readonly gold: number;
  readonly seals: { readonly master: number; readonly second: number };
  readonly items: readonly string[];
};

type Spec = {
  readonly id: SideGoalId;
  readonly name: string;
  readonly what: string;
  /** The cost as one part; Chapter 18's parts are its chests, each by the floor's turn. */
  readonly actions?: number;
  readonly by?: number;
  /** Rows it doesn't secure (Paralogue 13's 500G per allied NPC, paid only for backing a side). */
  readonly skip?: (r: MapItemRow) => boolean;
};

/**
 * The goals and their costs (#191): the actions are the map's count (Thieves, villages, chests, villagers); the turns
 * are a reading of each map, stated as the `side-goal-actions` blind spot.
 */
const SPECS: readonly Spec[] = [
  { id: 'chapter-10-thieves', name: 'Thieves', what: 'Kill the four Ruffian Thieves before they escape', actions: 4, by: 5 },
  { id: 'chapter-11-thief', name: 'Thief', what: 'Kill the Ruffian Thief before it escapes with the western chest', actions: 1, by: 4 },
  { id: 'paralogue-2-village', name: 'Village', what: 'Visit the village before the Barbarians burn it', actions: 1, by: 3 },
  { id: 'paralogue-6-result', name: 'Inigo’s kills', what: 'Leave Inigo five kills (each tier pays: 1 to 5 kills)', actions: 5, by: 8 },
  { id: 'paralogue-7-result', name: 'Villagers', what: 'Keep all five NPC Villagers alive (each tier pays: 1 to 5 survive)', actions: 5, by: 3 },
  { id: 'paralogue-9-ruger', name: 'Ruger', what: 'Defeat Ruger before he escapes with his Bullion', actions: 1, by: 5 },
  { id: 'paralogue-11-result', name: 'Villagers', what: 'Keep all five NPC Villagers alive (each tier pays: 1 to 5 survive)', actions: 5, by: 3 },
  { id: 'paralogue-12-thieves', name: 'Thieves', what: 'Kill the two Ruffian Thieves before they escape with the chests', actions: 2, by: 4 },
  {
    id: 'paralogue-13-result',
    name: 'Back neither side',
    what: 'Back neither side: defeat both leaders for their Bullion, visit the four villages, and take 10,000G at the end',
    actions: 4,
    by: 8,
    skip: (r) => !!r.gold?.per,
  },
  { id: 'paralogue-14-villages', name: 'Mirage villages', what: 'Visit the three mirage villages in order, then search for the hidden treasure', actions: 4, by: 8 },
  { id: 'chapter-16-thieves', name: 'Thieves', what: 'Kill the three Ruffian Thieves before they escape', actions: 3, by: 5 },
  { id: 'chapter-18-chests', name: 'Falling chests', what: 'Open each chest before the floor collapses under it (turns 7 to 11)' },
];

const mapOf = (id: SideGoalId): ChapterData => MAPS.find((m) => id.startsWith(`${m.id}-`) && /^-[a-z]+$/.test(id.slice(m.id.length)))!;

const BULLION = /^(Bullion \([SML]\))(?: \(×(\d+)\))?$/;

/** What a row pays in gold: a Bullion at its sale price, or gold paid outright. */
function rowGold(r: MapItemRow): number {
  if (r.gold) return r.gold.amount;
  const m = BULLION.exec(r.item);
  return m ? sellPrice(itemByName(m[1]!)!) * (m[2] ? Number(m[2]) : 1) : 0;
}

function partOf(rows: readonly MapItemRow[], actions: number, by: number): SideGoalPart {
  const count = (seal: string) => rows.filter((r) => r.item === seal).length;
  return { rows, actions, by, gold: rows.reduce((a, r) => a + rowGold(r), 0), seals: { master: count('Master Seal'), second: count('Second Seal') } };
}

let GOALS: readonly SideGoal[] | undefined;

/** Every side goal, in map order, with its rows from the chapter data. */
export function sideGoals(): readonly SideGoal[] {
  if (GOALS) return GOALS;
  GOALS = SPECS.map((s) => {
    const map = mapOf(s.id);
    const rows = map.items.filter((r) => r.play && r.play.kind !== 'choice' && !s.skip?.(r));
    // A chest the floor takes on enemy phase is still there that turn's player phase.
    const parts =
      s.actions !== undefined
        ? [partOf(rows, s.actions, s.by!)]
        : rows.map((r) => partOf([r], 1, r.play!.lostOn!.phase === 'enemy' ? r.play!.lostOn!.turn : r.play!.lostOn!.turn - 1));
    return {
      id: s.id,
      map: map.id,
      label: `${map.label}: ${s.name}`,
      what: s.what,
      parts,
      gold: parts.reduce((a, p) => a + p.gold, 0),
      seals: { master: parts.reduce((a, p) => a + p.seals.master, 0), second: parts.reduce((a, p) => a + p.seals.second, 0) },
      items: rows.map((r) => r.item),
    };
  }).sort((a, b) => MAPS.findIndex((m) => m.id === a.map) - MAPS.findIndex((m) => m.id === b.map));
  return GOALS;
}

export const sideGoalById = (id: SideGoalId): SideGoal => sideGoals().find((g) => g.id === id)!;

/** The default rule: chase a side goal when it costs at most one action a turn until its deadline (each part). */
export const chaseByDefault = (g: SideGoal): boolean => g.parts.every((p) => p.actions <= p.by);

/**
 * A side goal's decision in the plan: its pin, else the plan's decision (#175 story 48, `planned`), else the default
 * rule.
 */
export type SideGoalChoice = { readonly goal: SideGoal; readonly decision: SideGoalDecision; readonly pinned: boolean; readonly planned: boolean };

/** Each side goal's decision: the player's pins (`Run.sideGoals`) first, then the plan's (`Roadmap.sideGoals`), then the default rule. */
export function sideGoalChoices(pins: SideGoalPlan | undefined, plan?: SideGoalPlan): SideGoalChoice[] {
  return sideGoals().map((goal) => {
    const pin = pins?.[goal.id];
    const planned = pin === undefined ? plan?.[goal.id] : undefined;
    return { goal, decision: pin ?? planned ?? (chaseByDefault(goal) ? 'chase' : 'skip'), pinned: pin !== undefined, planned: planned !== undefined };
  });
}

/** Pins a side goal to always take or skip; undefined unpins it (the default rule again). */
export function withSideGoalPin(run: Run, id: SideGoalId, decision: SideGoalDecision | undefined): Run {
  const { [id]: _, ...rest } = run.sideGoals ?? {};
  const next: SideGoalPlan = decision ? { ...rest, [id]: decision } : rest;
  const { sideGoals: __, ...base } = run;
  return Object.keys(next).length ? { ...base, sideGoals: next } : base;
}

/** A side goal on a recorded map: secured as recorded, else as the convoy suggests (every one of its items found there). */
export type SideGoalRecord = {
  readonly goal: SideGoal;
  readonly secured: boolean;
  /** Whether Record results set it; otherwise it's pre-filled from the items the map gave. */
  readonly recorded: boolean;
  /** Its items found on the map (the shopping step's finds). */
  readonly found: readonly string[];
};

/** The side goals on an entry's map, secured as recorded or pre-filled from what the map gave (#191). */
export function sideGoalsSecured(run: Run, entryId: string): SideGoalRecord[] {
  const e = run.entries.find((x) => x.id === entryId);
  if (!e) return [];
  const goals = sideGoals().filter((g) => g.map === e.map);
  if (!goals.length) return [];
  const found = new Map<string, number>();
  for (const f of entryShopping(run, entryId)?.found ?? []) if (f.from === 'map') found.set(f.item, f.count);
  return goals.map((goal) => {
    // Items a goal holds by name (`Bullion (M)`, never `Bullion (S) (×7)` here) against those found, each counted once.
    const left = new Map(found);
    const got = goal.parts.flatMap((p) => p.rows).filter((r) => !r.gold).flatMap((r) => {
      const n = left.get(r.item) ?? 0;
      if (!n) return [];
      left.set(r.item, n - 1);
      return [r.item];
    });
    const items = goal.parts.flatMap((p) => p.rows).filter((r) => !r.gold);
    const recorded = e.sideGoals?.[goal.id];
    return { goal, secured: recorded ?? (items.length > 0 && got.length === items.length), recorded: recorded !== undefined, found: got };
  });
}

/** Records whether a side goal was secured on an entry's map; undefined clears it (the pre-fill again). */
export function withSideGoalSecured(run: Run, entryId: string, id: SideGoalId, secured: boolean | undefined, now: number): Run {
  const i = run.entries.findIndex((e) => e.id === entryId);
  if (i < 0) return run;
  const entries = [...run.entries];
  const { sideGoals: was, ...e } = entries[i]!;
  const { [id]: _, ...rest } = was ?? {};
  const next = secured === undefined ? rest : { ...rest, [id]: secured };
  const past = i < entries.length - 1;
  entries[i] = { ...e, ...(Object.keys(next).length ? { sideGoals: next } : {}), ...(past ? { editedAt: now } : {}) };
  return { ...run, entries };
}

// ---- storage ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (k: string): k is SideGoalId => (SIDE_GOAL_IDS as readonly string[]).includes(k);

/** A stored side goal plan: known goals pinned to chase or skip; anything else dropped. */
export function parseSideGoalPlan(v: unknown): SideGoalPlan {
  if (!isObject(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, d]) => isId(k) && (d === 'chase' || d === 'skip')));
}

/** A stored entry's side goals secured: known goals with a yes or no. */
export function parseSideGoalsSecured(v: unknown): Partial<Record<SideGoalId, boolean>> {
  if (!isObject(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, s]) => isId(k) && typeof s === 'boolean'));
}
