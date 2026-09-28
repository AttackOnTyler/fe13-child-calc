/**
 * The position solver (#265; decisions #257, #262): a script for the map's next turns over the game's full command menu,
 * re-solved from any board (after each combat, around a pinned move).
 *
 * - **Commands:** move, then Attack (the weapon that kills, else the one with no counter, then the most damage), Staff
 *   (Heal), Items (a Vulnerary), Trade (free before acting: a Vulnerary from the back or an adjacent ally), Pair Up
 *   (onto an ally, who leads), Switch, Separate, or Wait.
 * - **Order:** the hard line (the safety checker: no death without a crit, no lethal counter) > the least crit risk >
 *   fewest turns (enemy HP taken, kills, closing in) > the plan's goals (EXP priority) > weapon uses.
 * - **Search:** each player phase is a beam over the units' actions in any order; an option is ranked on the units that
 *   have acted only (the ones still to move would make every early choice look unsafe). The phase's ends are checked in
 *   full, the predicted enemy phase is played, and the next turn searched from there: 3 detailed turns, then a cheaper
 *   outline to the rout.
 * - **Outcomes** are predicted with the likeliest reading; the page re-solves from what really happened.
 * - When no line keeps the hard line, the least-risk line is returned, and the turns that break it are named.
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
  occupant,
  playFight,
  playerById,
  reaches,
  strikeOrder,
  threatTiles,
  weaponOf,
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
import { safety, type PlannedAttack, type Safety } from './safety';

export type Command =
  | { readonly kind: 'attack'; readonly target: string; readonly weapon: string }
  | { readonly kind: 'heal'; readonly target: string; readonly staff: string }
  | { readonly kind: 'item'; readonly item: string }
  | { readonly kind: 'pair'; readonly with: string }
  | { readonly kind: 'separate'; readonly to: Tile }
  | { readonly kind: 'wait' };

/** A trade before acting: an item taken from a partner (the back or an adjacent ally). */
export type Trade = { readonly with: string; readonly item: string };

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
  /** Switch first (free, before moving): the back takes the lead and acts. */
  readonly switched?: boolean;
  readonly from: Tile;
  readonly to: Tile;
  readonly trade?: Trade;
  readonly command: Command;
  readonly forecast?: ActionForecast;
  /** Why this action, in words. */
  readonly why: string;
};

export type TurnPlan = {
  readonly turn: number;
  readonly actions: readonly PlannedAction[];
  /** The hard line at the phase's end. */
  readonly safety: Safety;
  /** The predicted enemy phase after it, and who it wakes. */
  readonly enemy: readonly EnemyAction[];
  readonly woke: readonly string[];
  /** The board at the player phase's start, and after the predicted enemy phase. */
  readonly before: Board;
  readonly after: Board;
};

export type OutlineTurn = { readonly turn: number; readonly kills: number; readonly left: number; readonly woke: number; readonly safe: boolean; readonly actions: readonly string[] };

export type PositionPlan = {
  /** The detailed turns (3 unless the rout comes sooner). */
  readonly turns: readonly TurnPlan[];
  /** Past them, turn by turn, to the rout (or the cap). */
  readonly outline: readonly OutlineTurn[];
  /** The turn the last enemy falls on predicted outcomes; undefined when the outline doesn't get there. */
  readonly routTurn: number | undefined;
  /** Every detailed and outlined turn keeps the hard line. */
  readonly hardLine: boolean;
  readonly brokenTurns: readonly number[];
  /** The summed crit risk over the detailed turns. */
  readonly critRisk: number;
};

export type SolveOptions = {
  /** Detailed turns (default 3), and the outline's cap in turns (default 12 more). */
  readonly turns?: number;
  readonly outlineCap?: number;
  /** Beam widths: per action within a phase, and of whole turns carried to the next. */
  readonly beam?: number;
  readonly turnBeam?: number;
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
    const giver = playerById(next, a.trade.with);
    if (giver && usesOf(giver, a.trade.item)) {
      next = withPlayer(next, spend(giver, a.trade.item));
      const have = u.items.find((i) => i.item === a.trade!.item);
      u = { ...u, items: have ? u.items.map((i) => (i.item === a.trade!.item ? { ...i, uses: (i.uses ?? 0) + 1 } : i)) : [...u.items, { item: a.trade.item, uses: 1 }] };
      next = withPlayer(next, u);
    }
  }
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

/** Every option of a unit on a state: its reachable tiles, each with the commands the game offers there. */
function options(s: State, u: PlayerPiece, waitTiles: number): PlannedAction[] {
  const b = s.board;
  const tiles = [...movement(b, u).keys()];
  const enemies = liveEnemies(b);
  const allies = leads(b).filter((x) => x.id !== u.id);
  const out: PlannedAction[] = [];
  const hurt = u.hp < u.fighter.stats.hp;
  // A Vulnerary to take first, when the unit has none and is hurt: from its back, or an ally next to its tile.
  const tradeFrom = (to: Tile): Trade | undefined => {
    if (!hurt || usesOf(u, 'Vulnerary')) return undefined;
    const partners = [...(u.back ? [playerById(b, u.back)!] : []), ...allies.filter((x) => manhattan(x.at, to) === 1)];
    const p = partners.find((x) => usesOf(x, 'Vulnerary'));
    return p ? { with: p.id, item: 'Vulnerary' } : undefined;
  };
  const threat = enemyThreat(b);
  const scoreTile = (k: number) => {
    const t: Tile = [k % 64, Math.floor(k / 64)];
    const near = enemies.length ? Math.min(...enemies.map((e) => manhattan(e.at, t))) : 0;
    return (threat.has(k) ? -1000 * threat.get(k)! : 0) - near;
  };
  const waits = tiles.sort((x, y) => scoreTile(y) - scoreTile(x)).slice(0, waitTiles);
  for (const k of tiles) {
    const to: Tile = [k % 64, Math.floor(k / 64)];
    // Attacks: per target, the kill weapon, else the no-counter one, else the most damage.
    for (const e of enemies) {
      const d = manhattan(to, e.at);
      const ws = u.weapons.filter((w) => reaches(w.item, d));
      if (!ws.length) continue;
      let best: { w: Weapon; key: number; f: ActionForecast } | undefined;
      for (const w of ws) {
        const f = attackForecast(b, u, e, to, w);
        const key = (f.targetHp === 0 ? 1e6 : 0) + (f.countered ? 0 : 1e4) + f.damage * f.hits * 10 - (w.item.worth ?? 0) / 1000;
        if (!best || key > best.key) best = { w, key, f };
      }
      out.push({ unit: u.id, from: u.at, to, command: { kind: 'attack', target: e.id, weapon: best!.w.item.name }, forecast: best!.f, why: '' });
    }
    // Staff: heal a hurt lead (or its back) in reach.
    const staff = u.items.find((i) => itemByName(i.item)?.kind === 'staff' && (i.uses ?? 1) > 0);
    if (staff)
      for (const t of allies) {
        if (manhattan(t.at, to) !== 1) continue;
        const who = [t, ...(t.back ? [playerById(b, t.back)!] : [])].find((x) => x.hp < x.fighter.stats.hp);
        if (who) out.push({ unit: u.id, from: u.at, to, command: { kind: 'heal', target: who.id, staff: staff.item }, why: '' });
      }
    const trade = tradeFrom(to);
    if (hurt && (usesOf(u, 'Vulnerary') || trade)) out.push({ unit: u.id, from: u.at, to, ...(trade ? { trade } : {}), command: { kind: 'item', item: 'Vulnerary' }, why: '' });
    if (u.back) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const drop: Tile = [to[0] + dx, to[1] + dy];
        const back = playerById(b, u.back)!;
        if (!occupant(b, drop) || sameTile(drop, u.at)) if (moveCost(b.map, drop, moveRow(back.fighter.className)) !== null) out.push({ unit: u.id, from: u.at, to, command: { kind: 'separate', to: drop }, why: '' });
      }
    }
  }
  // Pair Up: onto an ally it can reach (the ally leads).
  if (!u.back)
    for (const t of allies) {
      if (t.back) continue;
      const adj = tiles.some((k) => manhattan([k % 64, Math.floor(k / 64)], t.at) === 1);
      if (adj) out.push({ unit: u.id, from: u.at, to: t.at, command: { kind: 'pair', with: t.id }, why: '' });
    }
  for (const k of waits) out.push({ unit: u.id, from: u.at, to: [k % 64, Math.floor(k / 64)], command: { kind: 'wait' }, why: '' });
  return out;
}

/** A unit's options, and a pair's with the back switched to the lead first. */
function allOptions(s: State, u: PlayerPiece, waitTiles: number): PlannedAction[] {
  const own = options(s, u, waitTiles);
  if (!u.back) return own;
  const b = switched(s.board, u.back);
  const other = options({ ...s, board: b }, playerById(b, u.back)!, waitTiles).filter((a) => a.command.kind !== 'wait' || own.length < 4);
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
const CRIT = 2e5;
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

/** A partial phase's worth: the hard line on the units that have acted, then progress. Higher is better. */
function partialScore(s: State, start: Board): number {
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
    if (total >= p.hp) score -= BROKEN + (total - p.hp) * 100;
    else score -= (total / p.hp) * 50;
  }
  for (const a of s.attacks) {
    const u = playerById(start, a.unit);
    const e = enemyById(start, a.enemy);
    if (!u || !e) continue;
    const f = forecast(start, { ...u, hp: a.hp ?? u.hp }, e, a.from, e.at, a.weapon);
    const d = manhattan(a.from, e.at);
    if (reaches(weaponOf(e), d) && playFight(f, strikeOrder(f, 'player', true, true), a.hp ?? u.hp, e.hp, 'none', 'all').playerHp <= 0) score -= BROKEN;
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

/** A finished phase's worth: the hard line in full, the crit risk, progress. */
function phaseScore(s: State, start: Board): { score: number; line: number; safety: Safety } {
  const sf = safety(s.board, s.attacks);
  const broken = sf.units.filter((u) => u.dies).length + sf.lethalCounters.length;
  // What a line carries from the phase: the hard line, crit risk, goals and misses (progress is read off the board after).
  const line = -broken * BROKEN - sf.critRisk * CRIT + s.goal * 60 - s.spent - s.miss * KILL * 2 - s.actions.filter((a) => a.switched).length;
  return { score: line + progress(start, s.board, leads(s.board)) + healInReach(s.board), line, safety: sf };
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
 * The HP each healer can restore next turn, at half worth: its best heal on a hurt lead it can reach (Mov + 1). A back
 * can't be healed, so a hurt unit left riding behind is worth less than one set down beside the healer (#271's stall).
 */
function healInReach(b: Board): number {
  const hurt = leads(b).filter((p) => p.hp < p.fighter.stats.hp);
  if (!hurt.length) return 0;
  let v = 0;
  for (const h of b.players) {
    const staff = h.hp > 0 && h.items.find((i) => (HEAL_BASE[i.item] ?? 0) > 0 && (i.uses ?? 1) > 0);
    if (!staff) continue;
    const at = h.carriedBy ? playerById(b, h.carriedBy)!.at : h.at;
    const amount = healAmount(staff.item, h.fighter.stats.mag);
    let best = 0;
    for (const p of hurt) if (p.id !== h.id && p.id !== h.carriedBy && manhattan(at, p.at) <= h.mov + 1) best = Math.max(best, Math.min(amount, p.fighter.stats.hp - p.hp) / p.fighter.stats.hp);
    v += (best * ARMY) / 2;
  }
  return v;
}

const signature = (b: Board) =>
  b.players.map((p) => `${p.id}@${p.at[0]},${p.at[1]}:${p.hp}${p.back ? `+${p.back}` : ''}`).join('|') + '/' + b.enemies.map((e) => e.hp).join(',');

// ---- the search -------------------------------------------------------------------------------------------------

type PhaseEnd = { readonly state: State; readonly score: number; readonly line: number; readonly safety: Safety };

/** One player phase: a beam over the units' actions, the ends ranked in full. */
function playerPhase(start: Board, acted: ReadonlySet<string>, prio: Readonly<Record<string, number>>, beam: number, waitTiles: number, pinned?: PlannedAction): PhaseEnd[] {
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
        for (const a of allOptions(s, u, waitTiles)) {
          const n = step(s, a, prio);
          const sig = signature(n.board) + [...n.acted].sort().join();
          if (seen.has(sig)) continue;
          seen.add(sig);
          next.push({ s: n, k: partialScore(n, start) });
        }
    }
    next.sort((x, y) => y.k - x.k);
    states = next.slice(0, beam).map((x) => x.s);
  }
  ends.push(...states);
  return ends.map((s) => ({ state: s, ...phaseScore(s, start) })).sort((x, y) => y.score - x.score);
}

type Line = { readonly turns: TurnPlan[]; readonly score: number; readonly board: Board };

const victory = (b: Board) => liveEnemies(b).length === 0;

/** The predicted enemy phase after a player phase, and the next turn's board. */
function endTurn(b: Board): { after: Board; enemy: EnemyAction[]; woke: string[] } {
  if (victory(b)) return { after: b, enemy: [], woke: [] };
  const ep = enemyPhase(b);
  return { after: { ...ep.board, turn: b.turn + 1 }, enemy: ep.actions, woke: ep.woke };
}

/**
 * The position plan from a board (see the module comment): the detailed turns, the outline to the rout, and the hard
 * line's verdict.
 */
export function solvePositions(board: Board, opts: SolveOptions = {}): PositionPlan {
  const turns = opts.turns ?? 3;
  const beam = opts.beam ?? 10;
  const turnBeam = opts.turnBeam ?? 3;
  const prio = opts.expPriority ?? {};
  let lines: Line[] = [{ turns: [], score: 0, board }];
  for (let t = 0; t < turns; t++) {
    const next: Line[] = [];
    for (const line of lines) {
      if (victory(line.board)) {
        next.push(line);
        continue;
      }
      const first = t === 0;
      const ends = playerPhase(line.board, first ? new Set(opts.acted ?? []) : new Set(), prio, beam, 10, first ? opts.pinned : undefined);
      for (const end of ends.slice(0, turnBeam)) {
        const e = endTurn(end.state.board);
        const plan: TurnPlan = { turn: line.board.turn, actions: end.state.actions, safety: end.safety, enemy: e.enemy, woke: e.woke, before: line.board, after: e.after };
        // Later turns count a little less: the plan re-solves before it gets there.
        next.push({ turns: [...line.turns, plan], score: line.score + end.line, board: e.after });
      }
    }
    next.sort((x, y) => y.score + boardValue(y.board) - (x.score + boardValue(x.board)));
    lines = next.slice(0, turnBeam);
  }
  const best = lines[0]!;
  // The outline: one cheap line to the rout.
  const outline: OutlineTurn[] = [];
  let b = best.board;
  const cap = opts.outlineCap ?? 12;
  while (!victory(b) && outline.length < cap) {
    // The phase's best few ends, each read after its predicted enemy phase.
    const { end, e } = playerPhase(b, new Set(), prio, beam, 10)
      .slice(0, 4)
      .map((x) => ({ end: x, e: endTurn(x.state.board) }))
      .reduce((a, c) => (c.end.line + boardValue(c.e.after) > a.end.line + boardValue(a.e.after) ? c : a));
    outline.push({ turn: b.turn, kills: liveEnemies(b).length - liveEnemies(end.state.board).length, left: liveEnemies(end.state.board).length, woke: e.woke.length, safe: end.safety.safe, actions: end.state.actions.map((a) => actionText(b, a)) });
    b = e.after;
  }
  const detailedRout = best.turns.find((t) => victory(t.after) || liveEnemies(t.after).length === 0);
  const routTurn = detailedRout ? detailedRout.turn : victory(b) ? outline.at(-1)?.turn : undefined;
  const brokenTurns = [...best.turns.filter((t) => !t.safety.safe).map((t) => t.turn), ...outline.filter((o) => !o.safe).map((o) => o.turn)];
  return {
    turns: best.turns,
    outline,
    routTurn,
    hardLine: brokenTurns.length === 0,
    brokenTurns,
    critRisk: best.turns.reduce((n, t) => n + t.safety.critRisk, 0),
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
    case 'heal':
      return `heals ${name(b, c.target)}`;
    case 'item':
      return `${a.trade ? `takes ${name(b, a.trade.with)}’s Vulnerary and ` : ''}drinks a Vulnerary`;
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
  const trade = a.trade ? `Trade (${a.trade.item} from ${name(b, a.trade.with)}), then ` : '';
  const cmd =
    c.kind === 'attack' ? `Attack ${name(b, c.target)} (${c.weapon})` : c.kind === 'heal' ? `Staff: ${c.staff} on ${name(b, c.target)}` : c.kind === 'item' ? `Items: ${c.item}` : c.kind === 'pair' ? `Pair Up with ${name(b, c.with)}` : c.kind === 'separate' ? `Separate to (${c.to[0]},${c.to[1]})` : 'Wait';
  return `${a.switched ? `Switch (${name(b, a.unit)} leads), then ` : ''}${name(b, a.unit)} ${move}: ${trade}${cmd}`;
}

export type { GameItem };

/**
 * The game's command menu for a unit at a tile (#266's try a move): each attack with each weapon that reaches (its
 * forecast), Staff, Items (a trade first when it needs one), Pair Up (the ally's tile), Separate, and Wait.
 */
export function menuAt(b: Board, unitId: string, tile: Tile): PlannedAction[] {
  const u = playerById(b, unitId);
  if (!u) return [];
  const s: State = { board: b, acted: new Set(), actions: [], attacks: [], goal: 0, spent: 0, miss: 0 };
  const rest = options(s, u, 999).filter((a) => sameTile(a.to, tile) && a.command.kind !== 'attack');
  const attacks: PlannedAction[] = [];
  for (const e of liveEnemies(b))
    for (const w of u.weapons)
      if (reaches(w.item, manhattan(tile, e.at)))
        attacks.push({ unit: u.id, from: u.at, to: tile, command: { kind: 'attack', target: e.id, weapon: w.item.name }, forecast: attackForecast(b, u, e, tile, w), why: '' });
  return [...attacks, ...rest].map((a) => ({ ...a, why: whyOf(b, a) }));
}
