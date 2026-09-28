/**
 * The safety checker for the position plan's hard line (#264; decisions #257, #262): **no death without a crit**.
 *
 * - **Gang-up worst case**, targeting-free: after the wake checks, every awake enemy that can strike a unit's tile attacks
 *   it, every non-crit hit landing, doubles counted, with the cautious skills (random ones as rolled when known, else
 *   all) and its damage procs assumed to fire (Luna, Aether, Ignis, Vengeance, Astra; Lethality always kills). The
 *   unit's counters and Dual Guard are left out. A unit whose total reaches its HP breaks the line.
 * - **Lethal counters** on our own attacks: a planned attack whose foe's full non-crit counter kills the attacker (our
 *   strikes may all miss) breaks the line too.
 * - HP carries between phases: the board's HP is the unit's HP now.
 * - **Crit risk**: each unit's chance to die with crits counted, the same gang-up fights played out in full (every roll,
 *   the unit's counters, Dual Guard and Dual Strike), summed over the units; the ranking after the hard line.
 */
import { leadHpAfter } from '../sim/exchange';
import type { Foe, Matchup } from '../solver';
import { tileKey, type Tile } from './captured';
import { enemyById, forecast, leads, liveEnemies, playFight, reaches, strikeOrder, threatTiles, weaponOf, type Board, type EnemyPiece, type PlayerPiece, type Weapon } from './board';
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
  /** Its chance to die to the same enemies with every roll played (crits included). */
  readonly deathChance: number;
};

/** A planned attack whose full non-crit counter kills the attacker. */
export type LethalCounter = { readonly unit: string; readonly enemy: string; readonly counter: number; readonly hp: number };

export type Safety = {
  readonly units: readonly UnitSafety[];
  readonly lethalCounters: readonly LethalCounter[];
  /** The hard line holds: no unit dies in the worst case and no planned attack's counter can kill. */
  readonly safe: boolean;
  /** The summed death chance with crits (see the module comment). */
  readonly critRisk: number;
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
    const total = threats.reduce((n, t) => n + t.damage, 0);
    // The same fights with every roll: the unit's HP after each, chained, the deadliest first.
    let dist = new Map([[lead.hp, 1]]);
    for (const e of [...foes].sort((x, y) => worstRoundOn(b, y, lead).damage - worstRoundOn(b, x, lead).damage)) {
      const m = forecast(b, lead, e);
      const next = new Map<number, number>();
      for (const [hp, p] of dist) for (const [h, q] of leadHpAfter(m, lead.fighter.weapon?.item, hp, e.hp, 'enemy')) next.set(h, (next.get(h) ?? 0) + p * q);
      dist = next;
    }
    const alive = [...dist.values()].reduce((a, c) => a + c, 0);
    return { unit: lead.id, hp: lead.hp, total, threats, dies: total >= lead.hp, deathChance: Math.max(0, 1 - alive) };
  });
  const lethalCounters = attacks.flatMap((a): LethalCounter[] => {
    const unit = board.players.find((p) => p.id === a.unit);
    const e = enemyById(board, a.enemy);
    if (!unit || !e) return [];
    const c = counterOn(board, { ...unit, hp: a.hp ?? unit.hp }, e, a.from, a.weapon);
    return c.lethal ? [{ unit: a.unit, enemy: a.enemy, counter: c.counter, hp: a.hp ?? unit.hp }] : [];
  });
  return {
    units,
    lethalCounters,
    safe: units.every((u) => !u.dies) && !lethalCounters.length,
    critRisk: units.filter((u) => !u.dies).reduce((n, u) => n + u.deathChance, 0),
    awake: awake.map((e) => e.id),
  };
}
