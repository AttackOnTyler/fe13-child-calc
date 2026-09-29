/**
 * The safety checker for the position plan's hard line (#264; decisions #257, #262): **no death without a crit**.
 *
 * - **Gang-up worst case**, targeting-free and **tile-aware** (#282): after the wake checks, the awake enemies that can
 *   strike a unit's tile attack it one at a time, in the worst order, each from a free tile it can reach and strike
 *   from. A foe that survives holds its tile; one our counter fells frees it for the next (both branches are tried where
 *   the counter can fell it). Every non-crit hit lands, doubles counted, with the cautious skills (random ones as rolled
 *   when known, else all) and its damage procs assumed to fire (Luna, Aether, Ignis, Vengeance, Astra; Lethality always
 *   kills). A unit whose total reaches its HP breaks the line. Foes pass through each other, our units block, and a
 *   foe that doesn't attack (asleep, or out of reach) holds its tile.
 * - **Lethal counters** on our own attacks: a planned attack whose foe's full non-crit counter kills the attacker (our
 *   strikes may all miss) breaks the line too.
 * - HP carries between phases: the board's HP is the unit's HP now.
 * - **Death chance**: the same gang-up with every roll played at its true odds (hit is two random numbers, #281; crits,
 *   the unit's counters, Dual Guard), the foes' order and tiles still the worst for the unit: the most likely death over
 *   the orders the game could pick. A planned attack adds its own counter's death chance. `priceDeaths` turns it into
 *   the game-over chance and the expected worth lost (#282).
 */
import { exchange, exchangeEndings } from '../sim/exchange';
import type { Foe, Matchup } from '../solver';
import { keyTile, tileKey, type Tile } from './captured';
import { enemyById, forecast, leads, liveEnemies, movement, playFight, reaches, strikeOrder, threatTiles, weaponOf, withPieces, type Board, type EnemyPiece, type PlayerPiece, type Weapon } from './board';
import { wake } from './enemy-phase';
import { manhattan } from './captured';

/** One enemy's share of a unit's gang-up worst case. */
export type Threat = { readonly enemy: string; readonly name: string; readonly damage: number; readonly strikes: number };

export type UnitSafety = {
  readonly unit: string;
  readonly hp: number;
  /** Everything the threatening enemies deal with every non-crit hit landing. */
  readonly total: number;
  readonly threats: readonly Threat[];
  /** The worst case kills it (no crit needed). */
  readonly dies: boolean;
  /** Its chance to die to the same enemies with every roll played (crits included), and to its own planned attacks' counters. */
  readonly deathChance: number;
};

/**
 * The tile-aware gang-up on one lead (see the module comment): the worst non-crit total over the orders and tiles the
 * foes could take, and the death chance with every roll at its true odds, the order and tiles still the worst.
 */
export function gangUp(b: Board, lead: PlayerPiece, foes: readonly EnemyPiece[]): { total: number; deathChance: number } {
  if (!foes.length) return { total: 0, deathChance: 0 };
  // Each foe's strike tiles: where it can stand and reach the lead (its own tile when it can't move). Foes pass through
  // each other, so each is moved on a board without the rest; a foe that won't attack holds its tile (#282 review).
  const attacking = new Set(foes.map((e) => e.id));
  const held = new Set(liveEnemies(b).filter((e) => !attacking.has(e.id)).map((e) => tileKey(e.at)));
  const index = new Map<number, number>();
  const tiles = foes.map((e) => {
    const w = weaponOf(e);
    const from = e.stationary ? [tileKey(e.at)] : [...movement(withPieces(b, b.players, [e]), e).keys()];
    return from
      .filter((k) => !held.has(k) && reaches(w, manhattan(keyTile(k), lead.at)))
      .map((k) => {
        if (!index.has(k)) index.set(k, index.size);
        return { tile: keyTile(k), bit: index.get(k)! };
      });
  });
  const fights = new Map<string, ReturnType<typeof forecast>>();
  const fight = (i: number, t: Tile) => {
    const key = `${i}:${t[0]},${t[1]}`;
    let m = fights.get(key);
    if (!m) fights.set(key, (m = forecast(b, lead, foes[i]!, lead.at, t)));
    return m;
  };
  // A foe's round on the lead doesn't depend on the tile it strikes from (its own tile gives it nothing in Awakening);
  // the tile matters for our counter (its Def/Avo there) and whether we reach it.
  const worst = foes.map((e) => worstRoundOn(b, e, lead).damage);
  // Worst non-crit total: whose turn, from which free tile, and whether our full counter fells it (a branch when it can).
  const totalMemo = new Map<string, number>();
  const worstTotal = (mask: number, occ: bigint): number => {
    const key = `${mask}:${occ}`;
    const got = totalMemo.get(key);
    if (got !== undefined) return got;
    let best = 0;
    foes.forEach((e, i) => {
      if (mask & (1 << i)) return;
      for (const { tile, bit } of tiles[i]!) {
        if (occ & (1n << BigInt(bit))) continue;
        const m = fight(i, tile);
        const counters = reaches(lead.fighter.weapon?.item, manhattan(tile, lead.at));
        const felled = counters && playFight(m, strikeOrder(m, 'enemy', true, true), Infinity, e.hp, 'all', 'none').enemyHp <= 0;
        const next = mask | (1 << i);
        let after = worstTotal(next, occ | (1n << BigInt(bit)));
        if (felled) after = Math.max(after, worstTotal(next, occ));
        best = Math.max(best, worst[i]! + after);
      }
    });
    totalMemo.set(key, best);
    return best;
  };
  // Death chance: the same choices, each fight's endings at their true odds (expectimax).
  const oddsMemo = new Map<string, number>();
  const deathOdds = (mask: number, occ: bigint, hp: number): number => {
    const key = `${mask}:${occ}:${hp}`;
    const got = oddsMemo.get(key);
    if (got !== undefined) return got;
    let best = 0;
    foes.forEach((e, i) => {
      if (mask & (1 << i)) return;
      for (const { tile, bit } of tiles[i]!) {
        if (occ & (1n << BigInt(bit))) continue;
        let v = 0;
        for (const end of exchangeEndings(fight(i, tile), lead.fighter.weapon?.item, hp, e.hp, 'enemy')) {
          if (end.lead <= 0) v += end.p;
          else v += end.p * deathOdds(mask | (1 << i), end.foe > 0 ? occ | (1n << BigInt(bit)) : occ, end.lead);
        }
        best = Math.max(best, v);
      }
    });
    oddsMemo.set(key, best);
    return best;
  };
  return { total: worstTotal(0, 0n), deathChance: deathOdds(0, 0n, lead.hp) };
}

/** A planned attack whose full non-crit counter kills the attacker. */
export type LethalCounter = { readonly unit: string; readonly enemy: string; readonly counter: number; readonly hp: number };

export type Safety = {
  readonly units: readonly UnitSafety[];
  readonly lethalCounters: readonly LethalCounter[];
  /** No death without a crit: no unit dies in the worst case and no planned attack's counter can kill. */
  readonly safe: boolean;
  /** The enemies awake for the phase (after the wake checks). */
  readonly awake: readonly string[];
};

/** A foe's damage per strike with its damage procs firing, and how many strikes a proc adds (Astra: 5 at half). */
function withProcs(m: Matchup, foe: Foe, foeHp: number, lead: PlayerPiece): { hit: number; strikes: number; kills: boolean } {
  const s = new Set(foe.skills);
  const fw = foe.weapon;
  const magic = !!fw && (fw.kind === 'tome' || fw.magic === true);
  const def = magic ? lead.fighter.stats.res : lead.fighter.stats.def;
  let hit = m.worstHit;
  if (s.has('Luna') || s.has('Aether')) hit = Math.max(hit, m.worstHit + Math.floor(def / 2));
  if (s.has('Ignis')) hit += Math.floor((magic ? foe.stats.str : foe.stats.mag) / 2);
  if (s.has('Vengeance')) hit += Math.floor((foe.stats.hp - foeHp) / 2);
  const strikes = m.foeStrikes + (s.has('Astra') ? 2 : 0);
  return { hit, strikes, kills: s.has('Lethality') };
}

/** The full, non-crit round an enemy deals a lead on its tile (procs firing), for the gang-up worst case. */
export function worstRoundOn(b: Board, e: EnemyPiece, lead: PlayerPiece): Threat {
  const m = forecast(b, lead, e);
  const p = withProcs(m, e.foe, e.hp, lead);
  return { enemy: e.id, name: e.name, damage: p.kills ? Infinity : p.hit * p.strikes, strikes: p.strikes };
}

/**
 * Whether an attack's counter can kill its attacker (every foe strike landing, none of ours): the counter's total and
 * the verdict. None when the foe can't answer from that distance (Thunder from 2 on a melee foe).
 */
export function counterOn(b: Board, unit: PlayerPiece, e: EnemyPiece, from: Tile, weapon?: Weapon): { counter: number; lethal: boolean; countered: boolean } {
  const d = manhattan(from, e.at);
  const countered = reaches(weaponOf(e), d);
  if (!countered) return { counter: 0, lethal: false, countered };
  const m = forecast(b, unit, e, from, e.at, weapon);
  const order = strikeOrder(m, 'player', true, true);
  const after = playFight(m, order, unit.hp, e.hp, 'none', 'all');
  return { counter: unit.hp - after.playerHp, lethal: after.playerHp <= 0, countered };
}

/** A planned player attack, for the lethal-counter check. */
export type PlannedAttack = { readonly unit: string; readonly enemy: string; readonly from: Tile; readonly weapon?: Weapon; readonly hp?: number };

/**
 * The hard line on a board of end-of-player-phase positions (see the module comment). `attacks`: the phase's planned
 * attacks, each read at the attacker's HP when it attacks (default: its HP on the board).
 */
export function safety(board: Board, attacks: readonly PlannedAttack[] = []): Safety {
  const b = wake(board).board;
  const awake = liveEnemies(b).filter((e) => e.awake);
  const reach = new Map(awake.map((e) => [e.id, threatTiles(b, e)]));
  const units = leads(b).map((lead): UnitSafety => {
    const k = tileKey(lead.at);
    const foes = awake.filter((e) => reach.get(e.id)!.has(k));
    const threats = foes.map((e) => worstRoundOn(b, e, lead));
    const g = gangUp(b, lead, foes);
    return { unit: lead.id, hp: lead.hp, total: g.total, threats, dies: g.total >= lead.hp, deathChance: g.deathChance };
  });
  // A planned attack's counter, at true odds: the attacker may die on its own phase.
  const attackDeath = new Map<string, number>();
  for (const a of attacks) {
    const u = board.players.find((x) => x.id === a.unit);
    const e = enemyById(board, a.enemy);
    if (!u || !e || !reaches(weaponOf(e), manhattan(a.from, e.at))) continue;
    const m = forecast(board, { ...u, hp: a.hp ?? u.hp }, e, a.from, e.at, a.weapon);
    const die = 1 - exchange(m, (a.weapon ?? u.fighter.weapon)?.item, a.hp ?? u.hp, e.hp, 'player').survive;
    if (die > 0) attackDeath.set(a.unit, 1 - (1 - (attackDeath.get(a.unit) ?? 0)) * (1 - die));
  }
  const priced = units.map((u) => (attackDeath.has(u.unit) ? { ...u, deathChance: 1 - (1 - u.deathChance) * (1 - attackDeath.get(u.unit)!) } : u));
  const lethalCounters = attacks.flatMap((a): LethalCounter[] => {
    const unit = board.players.find((p) => p.id === a.unit);
    const e = enemyById(board, a.enemy);
    if (!unit || !e) return [];
    const c = counterOn(board, { ...unit, hp: a.hp ?? unit.hp }, e, a.from, a.weapon);
    return c.lethal ? [{ unit: a.unit, enemy: a.enemy, counter: c.counter, hp: a.hp ?? unit.hp }] : [];
  });
  return {
    units: priced,
    lethalCounters,
    safe: priced.every((u) => !u.dies) && !lethalCounters.length,
    awake: awake.map((e) => e.id),
  };
}

/** Units whose death ends the run (the game over): Chrom and Robin (spec #175's forced units). */
export const GAME_OVER_UNITS: readonly string[] = ['chrom', 'robin'];

/** A phase's deaths priced (#282): the game-over chance, and the expected worth lost (death chance × unit worth). */
export type DeathPrice = { readonly gameOver: number; readonly worthLost: number };

/**
 * Prices a phase's death chances: Chrom's or Robin's death is game over (the chance any of them dies); every other
 * unit's costs its worth in flawless points, times its chance to die. A unit with no worth given costs nothing.
 */
export function priceDeaths(s: Safety, worth: Readonly<Record<string, number>>): DeathPrice {
  let alive = 1;
  let worthLost = 0;
  for (const u of s.units) {
    if (GAME_OVER_UNITS.includes(u.unit)) alive *= 1 - u.deathChance;
    else worthLost += u.deathChance * (worth[u.unit] ?? 0);
  }
  return { gameOver: 1 - alive, worthLost };
}
