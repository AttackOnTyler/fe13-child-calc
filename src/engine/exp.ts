/**
 * Awakening's EXP formulas (research/exp-rules, #138; spec #175 "EXP, supports and internal level"): what one combat,
 * staff or Dance gives, from the unit's internal level and the foe. Pure and cheap: the map simulation calls
 * `combatExp` in its hot loop, so it takes plain numbers and a foe built once per map (`expFoeOf`), and allocates nothing.
 *
 * Sources: SF calculations (the primary statement), FEW Experience (cites SF), and recorded play on the JP 2ch wiki,
 * which matches every formula here (research/exp-rules §4.3). Division drops fractions (floor).
 */
import { CLASSES, type ClassId, type ClassTier } from '../game-data/classes';
import { className } from './classes';
import type { Difficulty } from './roster';

/** What the unit did in one combat: landed the kill, damaged the foe (which survived), or dealt no damage. */
export type CombatOutcome = 'kill' | 'damage' | 'miss';

/**
 * A foe as the EXP formulas see it, built once per foe. `advanced` counts it 20 levels higher; `classBonus` is its
 * class's (Thief line +20, Revenant +80…); `unitBonus` is set only for foes that carry one (Deadlords, Einherjar: +20).
 */
export type ExpFoe = {
  readonly level: number;
  readonly advanced: boolean;
  readonly boss: boolean;
  readonly classBonus: number;
  readonly unitBonus?: number;
};

/** The Second Seal count's cap, applied when EXP is computed: 20 Normal, 30 Hard, 50 Lunatic(+) (SF; FEW; JP 2ch). */
export const COUNT_CAP: Readonly<Record<Difficulty, number>> = { normal: 20, hard: 30, lunatic: 50, 'lunatic-plus': 50 };

/** The promotion bonus: 20 in an advanced class, 0 in a base or special class (special classes count as unpromoted). */
export const tierBonus = (tier: ClassTier): number => (tier === 'advanced' ? 20 : 0);

/**
 * The internal level every formula keys on: displayed level, +20 in an advanced class, plus the Second Seal count
 * capped by difficulty (research/exp-rules §1.1).
 */
export const internalLevel = (level: number, tier: ClassTier, count: number, difficulty: Difficulty): number =>
  level + tierBonus(tier) + Math.min(count, COUNT_CAP[difficulty]);

/** What one Second Seal adds to the count: half the levels the unit had, `floor((level + 20 if advanced − 1) / 2)`. */
export const secondSealCount = (levelAtUse: number, tier: ClassTier): number => Math.floor((levelAtUse + tierBonus(tier) - 1) / 2);

/** The largest EXP one combat gives (FEW Experience). */
export const COMBAT_EXP_MAX = 100;

/**
 * Damage EXP for a level difference (foe level +20 if advanced − internal level). On Lunatic(+), from the 4th
 * engagement with the same foe it falls by 1 per engagement, down to 0 (SF, FEW, as a reduction: §3).
 */
export function damageExp(ld: number, engagement = 1, lunatic = false): number {
  const base = ld >= -1 ? Math.floor((31 + ld) / 3) : Math.max(Math.floor((33 + ld) / 3), 1);
  return lunatic && engagement > 3 ? Math.max(base - (engagement - 3), 0) : base;
}

/** Kill EXP on top of the damage part, with the foe's bonus (boss +20 included). The boss bonus sits inside the floor of 7. */
export function killExp(ld: number, bonus: number): number {
  if (ld >= 0) return 20 + 3 * ld + bonus;
  if (ld === -1) return 20 + bonus;
  return Math.max(26 + 3 * ld + bonus, 7);
}

/** The foe's kill bonus: its class bonus, limited by its unit bonus where it has one (SF's `min`), plus 20 for a boss. */
export const foeBonus = (foe: ExpFoe): number =>
  (foe.unitBonus !== undefined ? Math.min(foe.unitBonus + foe.classBonus, foe.unitBonus) : foe.classBonus) + (foe.boss ? 20 : 0);

/**
 * The EXP one combat gives a unit at internal level `il` (research/exp-rules §1.2). Nothing without damage; damage
 * EXP for damage; damage + kill EXP for a kill, at most 100. A `back` (the pair's support unit) earns only from its
 * own Dual Strikes: half its damage EXP, or all of it if its strike kills, and never kill EXP (`outcome` is then what
 * its Dual Strikes did). `lunatic` turns on the repeat cut for the foe's `engagement`-th engagement. `multiplier` is
 * Veteran's ×1.5 (only when the holder leads, C4) or Paragon's ×2, floored, with the 100 cap after it (gap G5).
 */
export function combatExp(il: number, foe: ExpFoe, outcome: CombatOutcome, back = false, lunatic = false, engagement = 1, multiplier = 1): number {
  if (outcome === 'miss') return 0;
  const ld = foe.level + (foe.advanced ? 20 : 0) - il;
  const damage = damageExp(ld, engagement, lunatic);
  const exp = back ? (outcome === 'kill' ? damage : Math.floor(damage / 2)) : outcome === 'kill' ? damage + killExp(ld, foeBonus(foe)) : damage;
  return Math.min(multiplier === 1 ? exp : Math.floor(exp * multiplier), COMBAT_EXP_MAX);
}

/** Class bonuses to kill EXP (SF calculations; FEW Experience). Grima's +20 is FEW's alone (C2) and never matters. */
const CLASS_EXP_BONUS: Readonly<Record<string, number>> = {
  Thief: 20,
  Assassin: 20,
  Trickster: 20,
  Conqueror: 20,
  Revenant: 80,
  Entombed: 80,
  Troubadour: -10,
  Cleric: -10,
  Priest: -10,
};

/** Enemy-only classes and their tier: Entombed are "technically promoted" (FEW Entombed). */
const ENEMY_CLASS_TIERS: Readonly<Record<string, ClassTier>> = { Soldier: 'base', Revenant: 'base', Entombed: 'advanced' };

const TIER_BY_NAME = new Map<string, ClassTier>([
  ...(Object.keys(CLASSES) as ClassId[]).flatMap((id) => (['M', 'F'] as const).map((g) => [className(id, g), CLASSES[id].tier] as [string, ClassTier])),
  ...Object.entries(ENEMY_CLASS_TIERS),
]);

/** A class name's tier from the class data (enemy-only classes included), or undefined: never guessed. */
export const tierOfClass = (name: string): ClassTier | undefined => TIER_BY_NAME.get(name.trim());

/**
 * The Deadlords (Chapter 22 and Infinite Regalia), by name: each carries the +20 unit bonus (research/exp-rules §1.2,
 * SF calculations). Whether the boss +20 comes on top is open (G8; assumption `deadlord-boss-bonus`).
 */
export const DEADLORDS: ReadonlySet<string> = new Set(['Mus', 'Bovis', 'Tigris', 'Lepus', 'Draco', 'Anguilla', 'Equus', 'Ovis', 'Simia', 'Gallus', 'Canis', 'Porcus']);
export const DEADLORD_UNIT_BONUS = 20;

/**
 * A map foe for the EXP formulas (#185, #209): a Deadlord gets its +20 unit bonus, and the boss +20 only where the
 * chapter data marks it a boss and `deadlordBoss` is 'boss-too'; any other foe as the data has it.
 */
export function mapExpFoe(name: string, cls: string, level: number, boss: boolean, deadlordBoss: 'unit-only' | 'boss-too'): ExpFoe | undefined {
  if (!DEADLORDS.has(name.trim())) return expFoeOf(cls, level, boss);
  return expFoeOf(cls, level, boss && deadlordBoss === 'boss-too', DEADLORD_UNIT_BONUS);
}

/** A foe for the EXP formulas from its class name and level; undefined for a class the data doesn't know. */
export function expFoeOf(cls: string, level: number, boss = false, unitBonus?: number): ExpFoe | undefined {
  const tier = tierOfClass(cls);
  if (!tier) return undefined;
  return { level, advanced: tier === 'advanced', boss, classBonus: CLASS_EXP_BONUS[cls.trim()] ?? 0, ...(unitBonus !== undefined ? { unitBonus } : {}) };
}

/** Staff base EXP (SF staves; FEW staff pages; JP ptnwiki: all 12 agree). */
export const STAFF_EXP: Readonly<Record<string, number>> = {
  Heal: 17,
  Mend: 22,
  Physic: 30,
  Recover: 40,
  Fortify: 60,
  'Goddess Staff': 100,
  Rescue: 40,
  Ward: 30,
  Hammerne: 50,
  Kneader: 12,
  'Balmwood Staff': 22,
  Catharsis: 35,
};

/** The base-class staff bonus: +8 Normal, +3 Hard, 0 Lunatic(+). */
const UNPROMOTED_STAFF_BONUS: Readonly<Record<Difficulty, number>> = { normal: 8, hard: 3, lunatic: 0, 'lunatic-plus': 0 };

/** Measured, unexplained: −1 at internal level 8 and 11, +1 at 30 (SF; FEW; gap G9). */
const quirk = (il: number) => (il === 8 || il === 11 ? -1 : il === 30 ? 1 : 0);

const falling = (base: number, il: number, bonus: number) => Math.max(base - Math.floor(Math.max(il - 5, 0) / 3) + bonus + quirk(il), 1);

/** EXP for one staff use (research/exp-rules §1.3); a staff the table doesn't list gives 0. */
export const staffExp = (il: number, staff: string, tier: ClassTier, difficulty: Difficulty): number =>
  STAFF_EXP[staff] === undefined ? 0 : falling(STAFF_EXP[staff]!, il, tier === 'base' ? UNPROMOTED_STAFF_BONUS[difficulty] : 0);

/** EXP for one Dance: base 17, falling like a staff's. The Dancer is special, so never the base-class bonus. */
export const danceExp = (il: number): number => falling(17, il, 0);

/** Rally: no source gives it any EXP (gap G1), so it's read as 0. */
export const RALLY_EXP = 0;
