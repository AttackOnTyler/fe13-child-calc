/**
 * One exchange between a pair's lead and one foe, worked out exactly (#181): every strike's hit, crit, Dual Strike and
 * Dual Guard roll is a branch, and the chance of each ending (the lead's HP, the foe's HP) is summed. The numbers are
 * the map solver's `matchup`; this only orders the strikes and does the arithmetic.
 *
 * Strike order (SF Calculations): the attacker's attack, the defender's counter if its weapon reaches, then the
 * follow-up of whichever side doubles. A brave weapon's attack is two strikes. Each of the lead's strikes can be followed
 * by the back's Dual Strike (its own hit, crit and damage); each of the foe's strikes on the lead can be nullified by
 * Dual Guard. A crit deals triple damage. The combat stops when either side falls.
 *
 * Not modelled here (the matchup's notes say so where they apply): Counter's returned damage, Vantage+, plain
 * Pavise/Aegis procs, other proc skills.
 */
import type { GameItem } from '../../game-data/items';
import type { Matchup } from '../solver';

/** Who starts the exchange: the lead on player phase, the foe on enemy phase. */
export type Initiator = 'player' | 'enemy';

/** The exchange's result, read the way the play goes on (see `MapPlay`). */
export type Exchange = {
  /** The chance the lead survives the exchange. */
  readonly survive: number;
  /** Given the lead survives: the chance the foe falls. */
  readonly kill: number;
  /** Given the lead survives: its HP after (expected, rounded). */
  readonly leadHp: number;
  /** Given the lead survives: the foe's HP after, 0 when it more likely falls than not (else its expected HP, rounded). */
  readonly foeHp: number;
  /** Whether the lead struck and whether the foe did (a side with no weapon in reach doesn't). */
  readonly leadStrikes: boolean;
  readonly foeStrikes: boolean;
};

/** A weapon's range as [min, max]; `1~Mag/2` reads as 1~2 (only staves have it). */
export function rangeOf(item: GameItem | undefined): readonly [number, number] | undefined {
  if (!item?.range) return undefined;
  if (RANGES.has(item)) return RANGES.get(item);
  const [lo, hi] = item.range.split('~');
  const min = parseInt(lo!, 10);
  const max = hi === undefined ? min : parseInt(hi, 10) || 2;
  const r = Number.isFinite(min) ? ([min, max] as const) : undefined;
  RANGES.set(item, r);
  return r;
}

/**
 * The true chance a displayed Hit lands (research #281): Awakening averages two random numbers (0–99) and hits when the
 * average is under the displayed Hit, so 70 lands 82.3% and 30 lands 18.3%. Only the hit roll works this way; crit,
 * Dual Strike, Dual Guard and skills roll once against the rate shown.
 */
export function trueHit(displayed: number): number {
  const h = Math.max(0, Math.min(100, displayed));
  return h <= 50 ? (h * (2 * h + 1)) / 10000 : 1 - ((100 - h) * (199 - 2 * h)) / 10000;
}

/** Each item's range, read once (every exchange asks). */
const RANGES = new WeakMap<GameItem, readonly [number, number] | undefined>();

/**
 * Whether the defender can counter: the attacker picks a distance its weapon reaches and, if it can, one the
 * defender's can't.
 */
export function counters(attacker: GameItem | undefined, defender: GameItem | undefined): boolean {
  const a = rangeOf(attacker);
  const d = rangeOf(defender);
  if (!a || !d) return false;
  for (let r = a[0]; r <= a[1]; r++) if (r < d[0] || r > d[1]) return false;
  return true;
}

type Side = 'lead' | 'foe';

/**
 * Where each state key sits among the next states being summed (its position + 1): a flat table instead of a map, as
 * every exchange of every play sums its states here. A position that doesn't hold the key is stale.
 */
let SLOT = new Int32Array(1 << 17);
function grow(k: number) {
  const next = new Int32Array(Math.max(k + 1, SLOT.length * 2));
  next.set(SLOT);
  SLOT = next;
}

/**
 * The exchange from the given HPs. `m` is the lead's matchup against the foe (the back's pair-up bonus, Dual Strike and
 * Dual Guard included); `leadWeapon`/`foeWeapon` decide who reaches whom.
 */
export function exchange(m: Matchup, leadWeapon: GameItem | undefined, leadHp: number, foeHp: number, initiator: Initiator): Exchange {
  const { keys, probs, leadCan, foeCan } = endings(m, leadWeapon, leadHp, foeHp, initiator);
  let survive = 0;
  let kill = 0;
  let lSum = 0;
  let fAlive = 0;
  let fSum = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    const p = probs[i]!;
    const l = Math.floor(k / K);
    const f = k % K;
    if (l <= 0) continue;
    survive += p;
    lSum += l * p;
    if (f <= 0) kill += p;
    else {
      fAlive += p;
      fSum += f * p;
    }
  }
  if (survive <= 0) return { survive: 0, kill: 0, leadHp, foeHp, leadStrikes: leadCan, foeStrikes: foeCan };
  const killGiven = kill / survive;
  return {
    survive: Math.min(1, survive),
    kill: killGiven,
    leadHp: Math.round(lSum / survive),
    foeHp: killGiven >= 0.5 || fAlive <= 0 ? 0 : Math.max(1, Math.round(fSum / fAlive)),
    leadStrikes: leadCan,
    foeStrikes: foeCan,
  };
}

/**
 * The lead's HP after the exchange, over the endings it lives through: each HP with its chance (summing to the
 * exchange's `survive`). A wall's enemy phase chains these (see map-play's `drawToWalls`).
 */
export function leadHpAfter(m: Matchup, leadWeapon: GameItem | undefined, leadHp: number, foeHp: number, initiator: Initiator): Map<number, number> {
  const { keys, probs } = endings(m, leadWeapon, leadHp, foeHp, initiator);
  const out = new Map<number, number>();
  for (let i = 0; i < keys.length; i++) {
    const l = Math.floor(keys[i]! / K);
    if (l > 0) out.set(l, (out.get(l) ?? 0) + probs[i]!);
  }
  return out;
}

/** Every ending of the exchange as (the lead's HP, the foe's HP, its chance), 0 for a side that fell. */
export function exchangeEndings(m: Matchup, leadWeapon: GameItem | undefined, leadHp: number, foeHp: number, initiator: Initiator): { lead: number; foe: number; p: number }[] {
  const { keys, probs } = endings(m, leadWeapon, leadHp, foeHp, initiator);
  return keys.map((k, i) => ({ lead: Math.floor(k / K), foe: k % K, p: probs[i]! }));
}

/** States: lead HP × K + foe HP. */
const K = 1024;

/** Every ending of the exchange (state keys, see `K`) with its chance. */
function endings(m: Matchup, leadWeapon: GameItem | undefined, leadHp: number, foeHp: number, initiator: Initiator): { keys: number[]; probs: number[]; leadCan: boolean; foeCan: boolean } {
  const foeWeapon = m.foe.weapon;
  const leadCan = initiator === 'player' ? !!leadWeapon && !!rangeOf(leadWeapon) : counters(foeWeapon, leadWeapon);
  const foeCan = initiator === 'enemy' ? !!foeWeapon && m.foeStrikes > 0 : counters(leadWeapon, foeWeapon);
  const leadPerAttack = m.doubles ? m.hits / 2 : m.hits;
  const foePerAttack = m.doubled ? m.foeStrikes / 2 : m.foeStrikes;
  const seq: Side[] = [];
  const attack = (s: Side) => {
    if (s === 'lead' ? leadCan : foeCan) for (let i = 0; i < (s === 'lead' ? leadPerAttack : foePerAttack); i++) seq.push(s);
  };
  const first: Side = initiator === 'player' ? 'lead' : 'foe';
  const second: Side = first === 'lead' ? 'foe' : 'lead';
  attack(first);
  attack(second);
  if (m.doubles) attack('lead');
  else if (m.doubled) attack('foe');

  // States: lead HP × K + foe HP → chance, in the order each state was first reached (a strike's outcomes are
  // summed into the next states in that order: the arithmetic is the same whatever holds them).
  // Stats are whole numbers in the game; a fractional one (hand-built input) is rounded down so the state key holds.
  const dmg = Math.floor(m.damage);
  const backDmg = Math.floor(m.backDamage);
  const foeDmg = Math.floor(m.worstHit);
  let keys = [Math.floor(leadHp) * K + Math.floor(foeHp)];
  let probs = [1];
  let nextKeys: number[] = [];
  let nextProbs: number[] = [];
  const add = (l: number, f: number, p: number) => {
    if (p <= 0) return;
    const k = Math.max(0, l) * K + Math.max(0, f);
    if (k >= SLOT.length) grow(k);
    const at = SLOT[k]!;
    if (at > 0 && at <= nextKeys.length && nextKeys[at - 1] === k) nextProbs[at - 1]! += p;
    else {
      nextKeys.push(k);
      nextProbs.push(p);
      SLOT[k] = nextKeys.length;
    }
  };
  const hit = trueHit(m.hit);
  const crit = m.crit / 100;
  const dual = m.backDamage > 0 && m.backHit > 0 ? m.dualStrikeRate / 100 : 0;
  const bHit = trueHit(m.backHit);
  const bCrit = m.backCrit / 100;
  const fHit = trueHit(m.foeHit);
  const fCrit = m.foeCrit / 100;
  const guard = m.dualGuardRate / 100;
  for (const s of seq) {
    nextKeys = [];
    nextProbs = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      const p = probs[i]!;
      const l = Math.floor(k / K);
      const f = k % K;
      if (l <= 0 || f <= 0) {
        add(l, f, p);
        continue;
      }
      if (s === 'lead') {
        // The lead's strike: miss, hit or crit; then, if the foe still stands, the back's Dual Strike.
        for (let o = 0; o < 3; o++) {
          const f1 = o === 0 ? f : o === 1 ? f - dmg : f - dmg * 3;
          const q = o === 0 ? 1 - hit : o === 1 ? hit * (1 - crit) : hit * crit;
          if (q <= 0) continue;
          if (f1 <= 0 || dual <= 0) {
            add(l, f1, p * q);
            continue;
          }
          add(l, f1, p * q * (1 - dual + dual * (1 - bHit)));
          add(l, f1 - backDmg, p * q * dual * bHit * (1 - bCrit));
          add(l, f1 - backDmg * 3, p * q * dual * bHit * bCrit);
        }
      } else {
        // The foe's strike on the lead: Dual Guard, else miss, hit or crit.
        const lands = 1 - guard;
        add(l, f, p * (guard + lands * (1 - fHit)));
        add(l - foeDmg, f, p * lands * fHit * (1 - fCrit));
        add(l - foeDmg * 3, f, p * lands * fHit * fCrit);
      }
    }
    // The slots only mark this strike's states: a stale one never matches (its position holds another key).
    keys = nextKeys;
    probs = nextProbs;
  }
  return { keys, probs, leadCan, foeCan };
}

