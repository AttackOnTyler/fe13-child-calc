/**
 * The position solver (#265; decisions #257, #262): a script for the map's next turns over the game's full command menu,
 * re-solved from any board (after each combat, around a pinned move).
 *
 * - **Commands:** move, then Attack (the weapon that kills, else the one with no counter, then the most damage), Staff
 *   (Heal), Items (a Vulnerary), Pair Up (onto an ally, who leads), Switch (after the lead moves
 *   the pair: the game allows no move after it, #291), Separate, or Wait. Before any of them, a
 *   **Trade** (free, #283): one item taken from or given to the back or an adjacent ally, weapons included, when the
 *   receiver can use it. After a command other than Attack, the weapon it ends holding (its enemy-phase counter).
 *   Every reachable tile is tried, water included for the classes that can stand on it.
 * - **Order** (decision #278, each tier breaking ties in the one above): the game-over chance (Chrom's or Robin's death)
 *   at or under a small cap > the expected worth lost (death chance × unit worth, the death price, #282) within the
 *   map's budget > the fewest turns to the rout > less worth lost > the plan's kills more likely to land > EXP priority.
 * - **Search** (#284): best-first over whole turns to the rout. A node is the board at a player phase's start; it is
 *   expanded into its best few player-phase ends (a beam over the units' actions in any order, an option ranked on the
 *   units that have acted), each priced and followed by its predicted enemy phase. Nodes are taken lowest optimistic
 *   rout turn first (`routBound`), the most progress first among equals, so the search dives to a rout and then keeps
 *   on until no open line could rout sooner: the rout is **proven** the fewest over the phase ends it tries. Lines over
 *   the game-over cap or the budget are dropped. No time cap; `onProgress` reports as it goes.
 * - **Outcomes** are predicted with the likeliest reading (a strike at 50% or more lands); the page re-solves from what
 *   really happened.
 * - When no line routs within the budget, the line that gets furthest is returned, not proven.
 */
import { itemByName, type GameItem } from '../../game-data/items';
import { pairUpBonus } from '../solver';
import { manhattan, moveCost, moveRow, sameTile, tileKey, type Tile } from './captured';
import {
  enemyById,
  forecast,
  leads,
  liveEnemies,
  movement,
  movOf,
  reachOf,
  occupant,
  playFight,
  playerById,
  reaches,
  strikeOrder,
  threatTiles,
  weaponOf,
  canUse,
  withEnemy,
  withPieces,
  withPlayer,
  type Board,
  type EnemyPiece,
  type Landing,
  type PlayerPiece,
  type Weapon,
} from './board';
import { exchange } from '../sim/exchange';
import { enemyPhase, type EnemyAction } from './enemy-phase';
import { GAME_OVER_UNITS, priceDeaths, safety, type DeathPrice, type PlannedAttack, type Safety } from './safety';

export type Command =
  | { readonly kind: 'attack'; readonly target: string; readonly weapon: string }
  | { readonly kind: 'heal'; readonly target: string; readonly staff: string }
  | { readonly kind: 'item'; readonly item: string }
  | { readonly kind: 'pair'; readonly with: string }
  | { readonly kind: 'separate'; readonly to: Tile }
  | { readonly kind: 'wait' };

/** A trade before acting (#283): one item taken from a partner (the back or an adjacent ally), or given to it. */
export type Trade = { readonly with: string; readonly item: string; readonly give?: true };

/** A fight's forecast as the script shows it, and its predicted result. */
export type ActionForecast = {
  readonly weapon: string;
  readonly damage: number;
  readonly hits: number;
  readonly hit: number;
  readonly crit: number;
  readonly dualStrike: number;
  readonly countered: boolean;
  readonly counterDamage: number;
  readonly counterStrikes: number;
  readonly counterHit: number;
  readonly counterCrit: number;
  /** Predicted (the likeliest reading): the attacker's and the target's HP after. */
  readonly unitHp: number;
  readonly targetHp: number;
};

export type PlannedAction = {
  /** The unit acting: a pair's lead (after the switch, when `switched`). */
  readonly unit: string;
  /** The lead moves the pair (on its reach), then Switch: the back takes the lead and acts from `to` (#291). */
  readonly switched?: boolean;
  readonly from: Tile;
  readonly to: Tile;
  readonly trade?: Trade;
  readonly command: Command;
  /** The weapon it ends holding, after a command other than Attack (#283): its enemy-phase counter. */
  readonly equip?: string;
  readonly forecast?: ActionForecast;
  /** Why this action, in words. */
  readonly why: string;
};

export type TurnPlan = {
  readonly turn: number;
  readonly actions: readonly PlannedAction[];
  /** The safety checker at the phase's end, and its deaths priced (#282). */
  readonly safety: Safety;
  readonly price: DeathPrice;
  /** The predicted enemy phase after it, and who it wakes. */
  readonly enemy: readonly EnemyAction[];
  readonly woke: readonly string[];
  /** The board at the player phase's start, and after the predicted enemy phase. */
  readonly before: Board;
  readonly after: Board;
};

export type PositionPlan = {
  /** Every turn of the line, from the board's to the rout (or as far as it gets). */
  readonly turns: readonly TurnPlan[];
  /** The turn the last enemy falls on predicted outcomes; undefined when no line gets there. */
  readonly routTurn: number | undefined;
  /** No open line could rout sooner (over the phase ends the search tries). */
  readonly proven: boolean;
  /** The line's game-over chance and expected worth lost, summed over its turns, and the budget it keeps to. */
  readonly gameOver: number;
  readonly worthLost: number;
  readonly budget: number;
  /** Within the game-over cap and the budget: the risk the plan takes is one it may take. */
  readonly withinRisk: boolean;
};

/** How the search stands: nodes expanded, the lowest open rout bound, the best rout found. */
export type SearchProgress = { readonly expanded: number; readonly bound: number; readonly bestRout?: number };

export type SolveOptions = {
  /** How many turns ahead the search may go (default 30): 1 solves just this turn, ranked by progress. */
  readonly turns?: number;
  /** The beam over a phase's actions (default 10), and the phase ends each node expands into (default 4). */
  readonly beam?: number;
  readonly phaseEnds?: number;
  /** Unit worth in flawless points by unit (default 1 each: a death costs one), and the map's budget of expected worth
   * lost (default 0.2). */
  readonly worth?: Readonly<Record<string, number>>;
  readonly budget?: number;
  /** A report after each node expanded. */
  readonly onProgress?: (p: SearchProgress) => void;
  /** Units that already acted this turn (a re-solve after a combat). */
  readonly acted?: readonly string[];
  /** A move the player is trying: played first, the rest of the turn solved around it. */
  readonly pinned?: PlannedAction;
  /** EXP priority by unit (0–3, default 1): kills by a higher one rank first among equals. */
  readonly expPriority?: Readonly<Record<string, number>>;
};

// ---- applying actions --------------------------------------------------------------------------------------------

/** How one attack went, as the player taps it (confirm or correct), or the likeliest reading. */
export type AttackOutcome = { readonly ours: 'forecast' | 'missed' | 'crit' | 'killed' | 'dual-strike'; readonly counter?: 'forecast' | 'hit' | 'missed' };

const weaponNamed = (u: PlayerPiece, name: string): Weapon | undefined => u.weapons.find((w) => w.item.name === name);
const usesOf = (u: PlayerPiece, item: string) => u.items.find((i) => i.item === item && (i.uses ?? 1) > 0);
const spend = (u: PlayerPiece, item: string): PlayerPiece => ({ ...u, items: u.items.map((i) => (i.item === item ? { ...i, uses: i.uses === null ? null : i.uses - 1 } : i)).filter((i) => i.uses !== 0) });

/** The fight of a planned attack: its forecast with the predicted (or tapped) result. */
export function attackForecast(b: Board, u: PlayerPiece, e: EnemyPiece, from: Tile, weapon: Weapon, outcome: AttackOutcome = { ours: 'forecast' }): ActionForecast {
  const m = forecast(b, u, e, from, e.at, weapon);
  const d = manhattan(from, e.at);
  const countered = reaches(weaponOf(e), d);
  const order = strikeOrder(m, 'player', true, countered);
  const counterLanding: Landing = outcome.counter === 'hit' ? 'all' : outcome.counter === 'missed' ? 'none' : 'likely';
  const ours: Landing = outcome.ours === 'missed' ? 'none' : 'likely';
  let r = playFight(m, order, u.hp, e.hp, ours, counterLanding);
  if (outcome.ours === 'killed') r = { ...r, enemyHp: 0 };
  else if (outcome.ours === 'crit') r = { ...r, enemyHp: Math.max(0, e.hp - m.damage * 3 - Math.max(0, m.hits - 1) * m.damage) };
  else if (outcome.ours === 'dual-strike') r = { ...r, enemyHp: Math.max(0, r.enemyHp - m.backDamage) };
  const counterStrikes = order.filter((s) => s === 'enemy').length;
  return {
    weapon: weapon.item.name,
    damage: m.damage,
    hits: m.hits,
    hit: m.hit,
    crit: m.crit,
    dualStrike: m.dualStrikeRate,
    countered,
    counterDamage: countered ? m.worstHit : 0,
    counterStrikes,
    counterHit: countered ? m.foeHit : 0,
    counterCrit: countered ? m.foeCrit : 0,
    unitHp: r.playerHp,
    targetHp: r.enemyHp,
  };
}

const HEAL_BASE: Readonly<Record<string, number>> = { Heal: 8, Mend: 15, Physic: 8, Recover: 99, Fortify: 8 };
/** What a staff restores (FEW: Heal 8 + Mag/2, Mend 15 + Mag/2). */
const healAmount = (staff: string, mag: number) => (HEAL_BASE[staff] ?? 8) + Math.floor(mag / 2);
const ITEM_HEAL: Readonly<Record<string, number>> = { Vulnerary: 10, Concoction: 20, Elixir: 99 };

/**
 * Plays one action on the board: the move, the trade, then the command (an attack's outcome as tapped, else the
 * likeliest reading). A unit killed falls; its back is left on its tile.
 */
export function applyAction(b: Board, a: PlannedAction, outcome?: AttackOutcome): Board {
  if (a.switched) b = switched(b, a.unit);
  let u = playerById(b, a.unit);
  if (!u) return b;
  u = { ...u, at: a.to };
  let next = withPlayer(b, u);
  if (u.back) next = withPlayer(next, { ...playerById(next, u.back)!, at: a.to });
  if (a.trade) {
    next = traded(next, a.unit, a.trade);
    u = playerById(next, a.unit)!;
  }
  const after = command(next, u, a, outcome);
  if (!a.equip || a.command.kind === 'attack') return after;
  const held = playerById(after, a.unit);
  const w = held && weaponNamed(held, a.equip);
  return held && w ? withPlayer(after, { ...held, fighter: { ...held.fighter, weapon: w } }) : after;
}

/**
 * A trade played (#283): the whole item moves (a Vulnerary with all its uses, a weapon). A giver left without the
 * weapon it held equips its next one; a receiver with none equips the one it got.
 */
export function traded(b: Board, unit: string, t: Trade): Board {
  const me = playerById(b, unit);
  const them = playerById(b, t.with);
  if (!me || !them) return b;
  const [from, to] = t.give ? [me, them] : [them, me];
  const w = from.weapons.find((x) => x.item.name === t.item);
  if (w) {
    const left = from.weapons.filter((x) => x !== w);
    const held = from.fighter.weapon?.item.name === t.item ? left[0] : from.fighter.weapon;
    const giver: PlayerPiece = { ...from, weapons: left, fighter: { ...from.fighter, weapon: held } };
    const taker: PlayerPiece = { ...to, weapons: [...to.weapons, w], fighter: { ...to.fighter, weapon: to.fighter.weapon ?? w } };
    return withPlayer(withPlayer(b, giver), taker);
  }
  const i = from.items.find((x) => x.item === t.item && (x.uses ?? 1) > 0);
  if (!i) return b;
  return withPlayer(withPlayer(b, { ...from, items: from.items.filter((x) => x !== i) }), { ...to, items: [...to.items, i] });
}

/** The command of an action, on the board after its move and trade. */
function command(next: Board, u: PlayerPiece, a: PlannedAction, outcome?: AttackOutcome): Board {
  const c = a.command;
  switch (c.kind) {
    case 'attack': {
      const e = enemyById(next, c.target);
      const w = weaponNamed(u, c.weapon);
      if (!e || !w) return next;
      const f = attackForecast(next, u, e, a.to, w, outcome);
      next = withEnemy(next, { ...e, hp: f.targetHp });
      next = withPlayer(next, { ...u, hp: f.unitHp, fighter: { ...u.fighter, weapon: w } });
      if (f.unitHp <= 0 && u.back) {
        const back = playerById(next, u.back)!;
        const { carriedBy: _, ...freed } = back;
        const { back: __, ...lead } = playerById(next, u.id)!;
        next = withPlayer(withPlayer(next, lead as PlayerPiece), freed as PlayerPiece);
      }
      return next;
    }
    case 'heal': {
      const t = playerById(next, c.target);
      if (!t) return next;
      next = withPlayer(next, { ...t, hp: Math.min(t.fighter.stats.hp, t.hp + healAmount(c.staff, u.fighter.stats.mag)) });
      return withPlayer(next, spend(playerById(next, u.id)!, c.staff));
    }
    case 'item': {
      const heal = ITEM_HEAL[c.item] ?? 10;
      return withPlayer(next, spend({ ...u, hp: Math.min(u.fighter.stats.hp, u.hp + heal) }, c.item));
    }
    case 'pair': {
      const lead = playerById(next, c.with);
      if (!lead || lead.back || u.back) return next;
      next = withPlayer(next, { ...lead, back: u.id });
      return withPlayer(next, { ...u, at: lead.at, carriedBy: lead.id });
    }
    case 'separate': {
      if (!u.back) return next;
      const back = playerById(next, u.back)!;
      const { back: _, ...lead } = u;
      const { carriedBy: __, ...freed } = back;
      next = withPlayer(next, lead as PlayerPiece);
      return withPlayer(next, { ...freed, at: c.to } as PlayerPiece);
    }
    case 'wait':
      return next;
  }
}

/** A pair switched: `back` (carried) takes the lead on the pair's tile, the old lead behind it. */
export function switched(b: Board, back: string): Board {
  const u = playerById(b, back);
  const lead = u?.carriedBy ? playerById(b, u.carriedBy) : undefined;
  if (!u || !lead) return b;
  const { back: _, ...oldLead } = lead;
  const { carriedBy: __, ...newLead } = u;
  return withPlayer(withPlayer(b, { ...oldLead, carriedBy: u.id } as PlayerPiece), { ...newLead, at: lead.at, back: lead.id } as PlayerPiece);
}

// ---- options ----------------------------------------------------------------------------------------------------

type State = {
  readonly board: Board;
  readonly acted: ReadonlySet<string>;
  readonly actions: readonly PlannedAction[];
  readonly attacks: readonly PlannedAttack[];
  /** Kills this phase, weighted by the killer's EXP priority. */
  readonly goal: number;
  /** Weapon worth spent on kills (the stronger weapon when a weaker would do reads worse). */
  readonly spent: number;
  /** The kills counted that may not happen: summed miss chances. */
  readonly miss: number;
};

const name = (b: Board, id: string) => playerById(b, id)?.name ?? enemyById(b, id)?.name ?? id;

/**
 * The tiles a unit can act from this phase. A pair moves on its lead's reach: the game allows no move after a Switch,
 * so a back acts where its lead can move, after a Switch there (#291).
 */
export function actingTiles(b: Board, unitId: string): Set<number> {
  const u = playerById(b, unitId);
  const lead = u?.carriedBy ? playerById(b, u.carriedBy) : u;
  return new Set(lead ? movement(b, lead).keys() : []);
}

/** Every option of a unit on a state: its reachable tiles (or those given), each with the commands the game offers there. */
function options(s: State, u: PlayerPiece, reach: Iterable<number> = movement(s.board, u).keys()): PlannedAction[] {
  const b = s.board;
  const tiles = [...reach];
  const enemies = liveEnemies(b);
  const allies = leads(b).filter((x) => x.id !== u.id);
  const out: PlannedAction[] = [];
  const back = u.back ? playerById(b, u.back) : undefined;
  // Trades on a tile (#283): none, or one item taken from or given to the back or an ally next to the tile, when the
  // receiver can use it.
  const usable = (p: PlayerPiece, name: string) => canUse(p.fighter.className, itemByName(name), p.name);
  const carried = (p: PlayerPiece) => [...p.weapons.map((w) => w.item.name), ...p.items.filter((i) => (i.uses ?? 1) > 0).map((i) => i.item)];
  const tradesAt = (to: Tile): (Trade | undefined)[] => {
    const partners = [...(back ? [back] : []), ...allies.filter((x) => manhattan(x.at, to) === 1)];
    const ts: (Trade | undefined)[] = [undefined];
    for (const p of partners) {
      for (const n of carried(p)) if (usable(u, n)) ts.push({ with: p.id, item: n });
      for (const n of carried(u)) if (usable(p, n)) ts.push({ with: p.id, item: n, give: true });
    }
    return ts;
  };
  /** Pair Ups already offered (one per ally and trade, whichever tile next to the ally it comes from). */
  const pairs = new Set<string>();
  for (const k of tiles) {
    const to: Tile = [k % 64, Math.floor(k / 64)];
    for (const trade of tradesAt(to)) {
      const tb = trade ? traded(b, u.id, trade) : b;
      const v = trade ? playerById(tb, u.id)! : u;
      const t = trade ? { trade } : {};
      // Attacks: per target, the kill weapon, else the no-counter one, else the most damage.
      for (const e of enemies) {
        const d = manhattan(to, e.at);
        const ws = v.weapons.filter((w) => reaches(w.item, d));
        if (!ws.length) continue;
        let best: { w: Weapon; key: number; f: ActionForecast } | undefined;
        for (const w of ws) {
          const f = attackForecast(tb, v, e, to, w);
          const key = (f.targetHp === 0 ? 1e6 : 0) + (f.countered ? 0 : 1e4) + f.damage * f.hits * 10 - (w.item.worth ?? 0) / 1000;
          if (!best || key > best.key) best = { w, key, f };
        }
        out.push({ unit: u.id, from: u.at, to, ...t, command: { kind: 'attack', target: e.id, weapon: best!.w.item.name }, forecast: best!.f, why: '' });
      }
      // Any other command, each with the weapon it ends holding: as it is, or another it carries.
      const holds = [undefined, ...v.weapons.filter((w) => w.item.name !== v.fighter.weapon?.item.name).map((w) => w.item.name)];
      const push = (command: Command) => {
        for (const equip of holds) out.push({ unit: u.id, from: u.at, to, ...t, command, ...(equip ? { equip } : {}), why: '' });
      };
      // Staff: heal a hurt lead in reach. A staff reaches only the unit in front, never a pair's back.
      const staff = v.items.find((i) => itemByName(i.item)?.kind === 'staff' && (i.uses ?? 1) > 0);
      if (staff)
        for (const x of allies) {
          if (manhattan(x.at, to) !== 1 || x.hp >= x.fighter.stats.hp) continue;
          push({ kind: 'heal', target: x.id, staff: staff.item });
        }
      if (v.hp < v.fighter.stats.hp && usesOf(v, 'Vulnerary')) push({ kind: 'item', item: 'Vulnerary' });
      // Separate: set the back down next to the tile (a trade first is offered too, #283 review).
      const carried = v.back ? playerById(tb, v.back) : undefined;
      if (carried)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const drop: Tile = [to[0] + dx, to[1] + dy];
          if (!occupant(b, drop) || sameTile(drop, u.at)) if (moveCost(b.map, drop, moveRow(carried.fighter.className)) !== null) push({ kind: 'separate', to: drop });
        }
      push({ kind: 'wait' });
      // Pair Up onto an ally next to the tile (the ally leads), after a trade with it or none.
      if (!u.back)
        for (const x of allies) {
          if (x.back || manhattan(x.at, to) !== 1 || (trade && trade.with !== x.id)) continue;
          if (!pairs.has(`${x.id}:${JSON.stringify(trade ?? null)}`)) {
            pairs.add(`${x.id}:${JSON.stringify(trade ?? null)}`);
            out.push({ unit: u.id, from: u.at, to: x.at, ...t, command: { kind: 'pair', with: x.id }, why: '' });
          }
        }
    }
  }
  return out;
}

/** A unit's options, and a pair's with the back switched to the lead at a tile the lead moves it to (#291). */
function allOptions(s: State, u: PlayerPiece): PlannedAction[] {
  const own = options(s, u);
  if (!u.back) return own;
  const b = switched(s.board, u.back);
  const other = options({ ...s, board: b }, playerById(b, u.back)!, actingTiles(s.board, u.id)).filter((a) => a.command.kind !== 'wait' || own.length < 4);
  return [...own, ...other.map((a) => ({ ...a, switched: true }))];
}

/**
 * How many awake-or-waking enemies threaten each tile (their reach with the player units lifted: cautious), keyed by
 * tile; worked out once per board's enemy set.
 */
/** An enemy's reach with the player units lifted, once per board's enemy set. */
const REACH = new WeakMap<readonly EnemyPiece[], Map<string, Set<number>>>();
function reachBare(b: Board, e: EnemyPiece): Set<number> {
  let m = REACH.get(b.enemies);
  if (!m) REACH.set(b.enemies, (m = new Map()));
  let r = m.get(e.id);
  if (!r) m.set(e.id, (r = threatTiles(withPieces(b, []), e)));
  return r;
}
const THREAT = new WeakMap<readonly EnemyPiece[], Map<number, number>>();
function enemyThreat(b: Board): Map<number, number> {
  let t = THREAT.get(b.enemies);
  if (t) return t;
  t = new Map();
  for (const e of liveEnemies(b)) for (const k of reachBare(b, e)) t.set(k, (t.get(k) ?? 0) + (e.awake || e.ai.start === 'Everytime' ? 1 : 0.2));
  THREAT.set(b.enemies, t);
  return t;
}

// ---- scoring ------------------------------------------------------------------------------------------------------

const BROKEN = 1e7;
/** A likely death's cost in a phase's beam, per point of the unit's worth (a game-over unit's is BROKEN). */
const DEATH = 5e3;
/** An expected death's cost when ranking a phase's ends, per point of worth: progress leads, risk breaks ties. */
const RISK = 400;

/** The worth and limits a search prices deaths by (#282), and what's left of them on a line. */
type Pricing = { readonly worth: Readonly<Record<string, number>>; readonly budgetLeft: number; readonly capLeft: number };
const deathCost = (p: Pricing, unit: string) => (GAME_OVER_UNITS.includes(unit) ? BROKEN : DEATH * (p.worth[unit] ?? 1));
const KILL = 400;
const HP_TAKEN = 12;
const CLOSING = 3;

/** An action applied to a state. */
function step(s: State, a: PlannedAction, prio: Readonly<Record<string, number>>): State {
  // The switch comes first: the rest reads the switched pair.
  const before = a.switched ? switched(s.board, a.unit) : s.board;
  const board = applyAction(before, { ...a, switched: false });
  const u = playerById(before, a.unit)!;
  let goal = s.goal;
  let spent = s.spent;
  let miss = s.miss;
  const attacks = [...s.attacks];
  if (a.command.kind === 'attack') {
    const e = enemyById(before, a.command.target)!;
    attacks.push({ unit: a.unit, enemy: e.id, from: a.to, weapon: weaponNamed(u, a.command.weapon), hp: u.hp });
    // A kill the likeliest reading counts: what it may miss by is a cost (the sure line, and the unsure roll first).
    if (!enemyById(board, e.id)!.hp) {
      const m = forecast(before, u, e, a.to, e.at, weaponNamed(u, a.command.weapon));
      const x = exchange(m, weaponNamed(u, a.command.weapon)?.item, u.hp, e.hp, 'player');
      miss += 1 - x.survive * x.kill;
      goal += prio[a.unit] ?? 1;
      spent += (itemByName(a.command.weapon)?.worth ?? 0) / 1e4;
    }
  }
  if (a.command.kind === 'heal') goal += 0.3 * (prio[a.unit] ?? 1);
  // A back gives its pair-up bonus and, armed, Dual Strike; it gives up its own actions (a healer can't heal from behind).
  if (a.command.kind === 'pair') {
    const bonus = Object.values(pairUpBonus(u.fighter, playerById(before, a.command.with)?.supports[u.id] ?? null)).reduce((n: number, v) => n + (v ?? 0), 0);
    const staff = u.items.some((i) => itemByName(i.item)?.kind === 'staff');
    goal += bonus / 10 + (u.weapons.length ? 0.5 : 0) - (staff ? 1.5 : 0);
  }
  const acted = new Set(s.acted);
  acted.add(a.unit);
  // Pairing onto an ally leaves the ally's action: it leads the pair, and still moves and acts.
  if (u.back) acted.add(u.back);
  return { board, acted, actions: [...s.actions, { ...a, why: a.why || whyOf(before, a) }], attacks, goal, spent, miss };
}

/** A partial phase's worth: likely deaths of the units that have acted, priced, then progress. Higher is better. */
function partialScore(s: State, start: Board, pricing: Pricing): number {
  const b = s.board;
  // Sleeping enemies woken by where the acted units stand.
  const acted = leads(b).filter((p) => s.acted.has(p.id));
  const reachOf = (e: EnemyPiece) => reachBare(b, e);
  const live = liveEnemies(b);
  const woken = new Set(live.filter((e) => e.awake || e.ai.start === 'Everytime').map((e) => e.id));
  for (const e of live) if (!woken.has(e.id) && e.ai.start !== 'Null' && acted.some((p) => reachOf(e).has(tileKey(p.at)))) for (const x of live) if (x.id === e.id || (e.group && x.group === e.group)) woken.add(x.id);
  let score = 0;
  for (const p of acted) {
    let total = 0;
    for (const e of live)
      if (woken.has(e.id) && reachOf(e).has(tileKey(p.at))) {
        const m = forecast(b, p, e);
        total += m.worstHit * m.foeStrikes;
      }
    if (total >= p.hp) score -= deathCost(pricing, p.id) + (total - p.hp) * 100;
    else score -= (total / p.hp) * 50;
  }
  for (const a of s.attacks) {
    const u = playerById(start, a.unit);
    const e = enemyById(start, a.enemy);
    if (!u || !e) continue;
    const f = forecast(start, { ...u, hp: a.hp ?? u.hp }, e, a.from, e.at, a.weapon);
    const d = manhattan(a.from, e.at);
    if (reaches(weaponOf(e), d) && playFight(f, strikeOrder(f, 'player', true, true), a.hp ?? u.hp, e.hp, 'none', 'all').playerHp <= 0) score -= deathCost(pricing, a.unit);
  }
  return score + progress(start, b, acted) + s.goal * 60 - s.spent - s.miss * KILL * 2;
}

/** Enemy HP taken and kills against the phase's start, and the acted units closing in. */
function progress(start: Board, b: Board, acted: readonly PlayerPiece[]): number {
  let score = 0;
  for (const e of start.enemies) {
    const now = enemyById(b, e.id)!;
    if (e.hp > 0 && now.hp <= 0) score += KILL;
    score += (e.hp - Math.max(0, now.hp)) * HP_TAKEN;
  }
  const live = liveEnemies(b);
  if (live.length) for (const p of acted) score -= CLOSING * Math.min(...live.map((e) => manhattan(e.at, p.at)));
  return score;
}

/**
 * A finished phase's worth: its deaths priced (over what's left of the cap or the budget, last), then progress, with
 * the expected worth lost only a light cost (the search's tiers settle risk; this only picks which ends to expand).
 */
function phaseScore(s: State, start: Board, pricing: Pricing): { score: number; line: number; safety: Safety; price: DeathPrice } {
  const sf = safety(s.board, s.attacks);
  const price = priceDeaths(sf, pricing.worth);
  const over = price.gameOver > pricing.capLeft || price.worthLost > pricing.budgetLeft ? BROKEN : 0;
  const line = -over - price.worthLost * RISK + s.goal * 60 - s.spent - s.miss * KILL * 2 - s.actions.filter((a) => a.switched).length;
  return { score: line + progress(start, s.board, leads(s.board)) + healInReach(s.board), line, safety: sf, price };
}

const ARMY = 600;
/**
 * A board's worth after an enemy phase, for comparing lines: the enemy HP and units left (fewest turns), the army's HP
 * kept, and how close the army stands to what's left.
 */
function boardValue(b: Board): number {
  const live = liveEnemies(b);
  let v = -live.reduce((n, e) => n + e.hp, 0) * HP_TAKEN - live.length * KILL;
  for (const p of b.players) v += (Math.max(0, p.hp) / p.fighter.stats.hp) * ARMY - (p.hp <= 0 ? BROKEN : 0);
  if (live.length) for (const p of leads(b)) v -= CLOSING * Math.min(...live.map((e) => manhattan(e.at, p.at)));
  return v + healInReach(b);
}

/**
 * The HP each healer can restore next turn, at half worth: its best heal on a hurt lead it can reach (Mov + 1). A
 * staff reaches only the unit in front, so a hurt unit set down beside a healer is worth more than one riding behind
 * (#271: the Prologue outline stalled with Frederick behind Lissa).
 */
function healInReach(b: Board): number {
  const hurt = leads(b).filter((p) => p.hp < p.fighter.stats.hp);
  if (!hurt.length) return 0;
  const tileOf = (p: PlayerPiece) => (p.carriedBy ? playerById(b, p.carriedBy)!.at : p.at);
  let v = 0;
  for (const h of b.players) {
    const staff = h.hp > 0 && h.items.find((i) => (HEAL_BASE[i.item] ?? 0) > 0 && (i.uses ?? 1) > 0);
    if (!staff) continue;
    const amount = healAmount(staff.item, h.fighter.stats.mag);
    const partner = (p: PlayerPiece) => p.id === h.id || p.id === h.carriedBy || p.id === h.back;
    let best = 0;
    for (const p of hurt) {
      if (partner(p) || manhattan(tileOf(h), tileOf(p)) > h.mov + 1) continue;
      best = Math.max(best, Math.min(amount, p.fighter.stats.hp - p.hp) / p.fighter.stats.hp);
    }
    v += (best * ARMY) / 2;
  }
  return v;
}

const signature = (b: Board) =>
  b.players.map((p) => `${p.id}@${p.at[0]},${p.at[1]}:${p.hp}${p.back ? `+${p.back}` : ''}`).join('|') + '/' + b.enemies.map((e) => e.hp).join(',');

// ---- the search -------------------------------------------------------------------------------------------------

type PhaseEnd = { readonly state: State; readonly score: number; readonly line: number; readonly safety: Safety; readonly price: DeathPrice };

/** One player phase: a beam over the units' actions, the ends ranked in full. */
function playerPhase(start: Board, acted: ReadonlySet<string>, prio: Readonly<Record<string, number>>, beam: number, pricing: Pricing, pinned?: PlannedAction): PhaseEnd[] {
  let states: State[] = [{ board: start, acted, actions: [], attacks: [], goal: 0, spent: 0, miss: 0 }];
  if (pinned) states = [step(states[0]!, pinned, prio)];
  const ends: State[] = [];
  for (let depth = 0; depth < 8 && states.length; depth++) {
    const next: { s: State; k: number }[] = [];
    const seen = new Set<string>();
    for (const s of states) {
      const ready = leads(s.board).filter((p) => !s.acted.has(p.id));
      if (!ready.length) {
        ends.push(s);
        continue;
      }
      for (const u of ready)
        for (const a of allOptions(s, u)) {
          const n = step(s, a, prio);
          const sig = signature(n.board) + [...n.acted].sort().join();
          if (seen.has(sig)) continue;
          seen.add(sig);
          next.push({ s: n, k: partialScore(n, start, pricing) });
        }
    }
    next.sort((x, y) => y.k - x.k);
    states = next.slice(0, beam).map((x) => x.s);
  }
  ends.push(...states);
  return ends.map((s) => ({ state: s, ...phaseScore(s, start, pricing) })).sort((x, y) => y.score - x.score);
}

const victory = (b: Board) => liveEnemies(b).length === 0;

/** The predicted enemy phase after a player phase, and the next turn's board. */
function endTurn(b: Board): { after: Board; enemy: EnemyAction[]; woke: string[] } {
  if (victory(b)) return { after: b, enemy: [], woke: [] };
  const ep = enemyPhase(b);
  return { after: { ...ep.board, turn: b.turn + 1 }, enemy: ep.actions, woke: ep.woke };
}

const DEFAULT_WORTH = 1;
const DEFAULT_BUDGET = 0.2;
/** The game-over cap (#278: "a tiny cap"): Chrom's or Robin's death, at most 1% per map. */
const GAME_OVER_CAP = 0.01;

/**
 * A lower bound on the turn the last enemy falls (#284): each foe needs one of our units within reach of it on a player
 * phase, or itself within reach of us on an enemy phase (a counter), and the gap closes by at most our Mov and its own
 * each turn (a foe that can't move closes none). Manhattan distance, terrain aside: optimistic, so admissible.
 */
export function routBound(b: Board): number {
  const live = liveEnemies(b);
  if (!live.length) return b.turn;
  const ours = leads(b);
  if (!ours.length) return Infinity;
  const range = (ws: readonly Weapon[]) => Math.max(0, ...ws.map((w) => reachOf(w.item)?.[1] ?? 0));
  const reachOfUnit = (p: PlayerPiece) => {
    const back = p.back ? playerById(b, p.back) : undefined;
    return movOf(b, p) + Math.max(range(p.weapons), back ? range(back.weapons) : 0);
  };
  const ourMov = Math.max(...ours.map((p) => movOf(b, p)));
  const ourReach = Math.max(...ours.map(reachOfUnit));
  let extra = 0;
  for (const e of live) {
    const d = Math.min(...ours.map((p) => manhattan(p.at, e.at)));
    const theirMov = e.stationary ? 0 : e.mov;
    const theirRange = reachOf(weaponOf(e))?.[1] ?? 0;
    const threshold = Math.max(ourReach, ourMov + theirMov + theirRange);
    const closing = Math.max(1, ourMov + theirMov);
    extra = Math.max(extra, Math.max(0, Math.ceil((d - threshold) / closing)));
  }
  return b.turn + extra;
}

/** A line being searched: the board at a player phase's start, its turns so far, and what they cost and won. */
type Node = {
  readonly board: Board;
  readonly turns: readonly TurnPlan[];
  readonly gameOver: number;
  readonly worthLost: number;
  readonly miss: number;
  readonly exp: number;
  /** The rout can't come before this turn (`routBound`), and how far the line has got (higher is better). */
  readonly bound: number;
  readonly value: number;
};

/** A binary heap of nodes, the one to expand next on top. */
class Frontier {
  private readonly items: Node[] = [];
  constructor(private readonly before: (a: Node, b: Node) => boolean) {}
  get size() {
    return this.items.length;
  }
  peek(): Node | undefined {
    return this.items[0];
  }
  push(n: Node) {
    const xs = this.items;
    xs.push(n);
    let i = xs.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(xs[i]!, xs[p]!)) break;
      [xs[i], xs[p]] = [xs[p]!, xs[i]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const xs = this.items;
    const top = xs[0];
    const last = xs.pop();
    if (xs.length && last) {
      xs[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < xs.length && this.before(xs[l]!, xs[m]!)) m = l;
        if (r < xs.length && this.before(xs[r]!, xs[m]!)) m = r;
        if (m === i) break;
        [xs[i], xs[m]] = [xs[m]!, xs[i]!];
        i = m;
      }
    }
    return top;
  }
}

/** A routed line's rank after its turn (#278): less worth lost, then kills more likely to land, then EXP priority. */
const betterRout = (a: Node, b: Node) => a.worthLost !== b.worthLost ? a.worthLost < b.worthLost : a.miss !== b.miss ? a.miss < b.miss : a.exp > b.exp;

/**
 * The position plan from a board (see the module comment): best-first to the fewest-turn rout within the game-over cap
 * and the budget, every turn detailed.
 */
export function solvePositions(board: Board, opts: SolveOptions = {}): PositionPlan {
  const beam = opts.beam ?? 10;
  const ends = opts.phaseEnds ?? 4;
  const horizon = opts.turns ?? 30;
  const prio = opts.expPriority ?? {};
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const cap = GAME_OVER_CAP;
  const worth = Object.fromEntries(board.players.map((p) => [p.id, opts.worth?.[p.id] ?? DEFAULT_WORTH]));
  const before = (a: Node, b: Node) => (a.bound !== b.bound ? a.bound < b.bound : a.value !== b.value ? a.value > b.value : a.turns.length > b.turns.length);
  const frontier = new Frontier(before);
  const root: Node = { board, turns: [], gameOver: 0, worthLost: 0, miss: 0, exp: 0, bound: routBound(board), value: boardValue(board) };
  frontier.push(root);
  const seen = new Set<string>();
  let best: Node | undefined;
  /** The furthest line that didn't rout (the fallback), and the least-risk one over the cap or budget (the last resort). */
  let furthest: Node | undefined;
  let leastRisk: Node | undefined;
  let expanded = 0;
  let proven = false;
  for (;;) {
    const n = frontier.pop();
    if (!n) {
      proven = true;
      break;
    }
    if (best && n.bound >= best.turns.at(-1)!.turn) {
      proven = true;
      break;
    }
    expanded++;
    const first = n.turns.length === 0;
    const pricing: Pricing = { worth, budgetLeft: budget - n.worthLost, capLeft: 1 - (1 - cap) / (1 - n.gameOver) };
    for (const end of playerPhase(n.board, first ? new Set(opts.acted ?? []) : new Set(), prio, beam, pricing, first ? opts.pinned : undefined).slice(0, ends)) {
      const gameOver = 1 - (1 - n.gameOver) * (1 - end.price.gameOver);
      const worthLost = n.worthLost + end.price.worthLost;
      const e = endTurn(end.state.board);
      const plan: TurnPlan = { turn: n.board.turn, actions: end.state.actions, safety: end.safety, price: end.price, enemy: e.enemy, woke: e.woke, before: n.board, after: e.after };
      const child: Node = {
        board: e.after,
        turns: [...n.turns, plan],
        gameOver,
        worthLost,
        miss: n.miss + end.state.miss,
        exp: n.exp + end.state.goal,
        bound: routBound(e.after),
        value: boardValue(e.after),
      };
      if (gameOver > cap || worthLost > budget) {
        // Over the cap or the budget: kept only as the least-risk line, should nothing else survive.
        if (!leastRisk || gameOver < leastRisk.gameOver || (gameOver === leastRisk.gameOver && worthLost < leastRisk.worthLost)) leastRisk = child;
        continue;
      }
      if (victory(end.state.board) || victory(e.after)) {
        // Routed on this turn (its player phase, or a counter on its enemy phase).
        const t = n.board.turn;
        const bt = best?.turns.at(-1)!.turn;
        if (!best || t < bt! || (t === bt && betterRout(child, best))) best = child;
        continue;
      }
      if (!furthest || child.value > furthest.value || (child.value === furthest.value && child.turns.length < furthest.turns.length)) furthest = child;
      if (child.turns.length >= horizon) continue;
      const key = `${e.after.turn}/${signature(e.after)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      frontier.push(child);
    }
    opts.onProgress?.({ expanded, bound: frontier.peek()?.bound ?? n.bound, ...(best ? { bestRout: best.turns.at(-1)!.turn } : {}) });
  }
  const line = best ?? furthest ?? leastRisk ?? root;
  const turns = line.turns;
  return {
    turns,
    routTurn: best ? best.turns.at(-1)!.turn : undefined,
    proven: proven && !!best,
    gameOver: line.gameOver,
    worthLost: line.worthLost,
    budget,
    withinRisk: line.gameOver <= cap && line.worthLost <= budget,
  };
}

// ---- words ------------------------------------------------------------------------------------------------------

/** Why an action, in a few words (the page adds the forecast). */
function whyOf(b: Board, a: PlannedAction): string {
  const c = a.command;
  switch (c.kind) {
    case 'attack': {
      const f = a.forecast;
      const kill = f && f.targetHp === 0;
      const counter = f && !f.countered ? `; ${name(b, c.target)} can’t counter from ${manhattan(a.to, enemyById(b, c.target)!.at)}` : '';
      return `${kill ? 'kills' : 'chips'} ${name(b, c.target)} with the ${c.weapon}${counter}`;
    }
    case 'heal': {
      const u = playerById(a.switched ? switched(b, a.unit) : b, a.unit);
      const t = playerById(b, c.target);
      if (!u || !t) return `heals ${name(b, c.target)}`;
      const hp = Math.min(t.fighter.stats.hp, t.hp + healAmount(c.staff, u.fighter.stats.mag));
      return `heals ${t.name}: +${hp - t.hp} (${t.hp} → ${hp})`;
    }
    case 'item':
      return `${a.trade && !a.trade.give && a.trade.item === 'Vulnerary' ? `takes ${name(b, a.trade.with)}’s Vulnerary and ` : ''}drinks a Vulnerary`;
    case 'pair':
      return `pairs up behind ${name(b, c.with)}: its pair-up bonus and Dual Strike, and it can’t be attacked`;
    case 'separate':
      return `separates, leaving ${name(b, playerById(b, a.unit)!.back ?? '')} at (${c.to[0]},${c.to[1]})`;
    case 'wait':
      return enemyThreat(b).has(tileKey(a.to)) ? 'waits in reach: its worst case is checked below' : 'waits out of every awake enemy’s reach';
  }
}

/** A planned action in words: "Frederick → (5,10): Attack Myrmidon (Silver Lance)". */
export function actionText(b: Board, a: PlannedAction): string {
  const c = a.command;
  const move = sameTile(a.from, a.to) ? 'stays' : `→ (${a.to[0]},${a.to[1]})`;
  const trade = a.trade ? (a.trade.give ? `Trade (gives ${name(b, a.trade.with)} the ${a.trade.item}), then ` : `Trade (${a.trade.item} from ${name(b, a.trade.with)}), then `) : '';
  const held = a.equip && c.kind !== 'attack' ? `, holding the ${a.equip}` : '';
  const cmd =
    c.kind === 'attack' ? `Attack ${name(b, c.target)} (${c.weapon})` : c.kind === 'heal' ? `Staff: ${c.staff} on ${name(b, c.target)}` : c.kind === 'item' ? `Items: ${c.item}` : c.kind === 'pair' ? `Pair Up with ${name(b, c.with)}` : c.kind === 'separate' ? `Separate to (${c.to[0]},${c.to[1]})` : 'Wait';
  if (!a.switched) return `${name(b, a.unit)} ${move}: ${trade}${cmd}${held}`;
  // In the game's order: the lead moves the pair, then Switch, then the back's command (#291).
  const lead = playerById(b, a.unit)?.carriedBy ?? b.players.find((p) => p.id !== a.unit && sameTile(p.at, a.from))?.id;
  return `${lead ? name(b, lead) : 'The pair'} ${move}, Switch (${name(b, a.unit)} leads): ${trade}${cmd}${held}`;
}

export type { GameItem };

/**
 * The game's command menu for a unit at a tile (#266's try a move): each attack with each weapon that reaches (its
 * forecast), Staff, Items (a trade first when it needs one), Pair Up (the ally's tile), Separate, and Wait. A pair's
 * back gets its menu after a Switch (#274), at a tile its lead can move the pair to (`actingTiles`, #291): every
 * action it offers plays switched.
 */
export function menuAt(b: Board, unitId: string, tile: Tile): PlannedAction[] {
  if (playerById(b, unitId)?.carriedBy) {
    const s = switched(b, unitId);
    return menuAt(s, unitId, tile).map((a) => ({ ...a, switched: true, why: whyOf(b, { ...a, switched: true }) }));
  }
  const u = playerById(b, unitId);
  if (!u) return [];
  const s: State = { board: b, acted: new Set(), actions: [], attacks: [], goal: 0, spent: 0, miss: 0 };
  // Its own attacks come below, every weapon; the options add the ones after a trade.
  const rest = options(s, u).filter((a) => sameTile(a.to, tile) && (a.command.kind !== 'attack' || !!a.trade));
  const attacks: PlannedAction[] = [];
  for (const e of liveEnemies(b))
    for (const w of u.weapons)
      if (reaches(w.item, manhattan(tile, e.at)))
        attacks.push({ unit: u.id, from: u.at, to: tile, command: { kind: 'attack', target: e.id, weapon: w.item.name }, forecast: attackForecast(b, u, e, tile, w), why: '' });
  return [...attacks, ...rest].map((a) => ({ ...a, why: whyOf(b, a) }));
}
