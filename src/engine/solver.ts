/**
 * The map solver (#119; Map: Route planner #87): combat math for a lead + back pair, with the lead's weapon and forge,
 * against an enemy group or boss of the next map on the run's difficulty. It gives damage, whether either side doubles,
 * whether one round kills (with and without dual strikes), the worst hit the lead can take and whether it survives,
 * and hit and crit both ways. No movement planning: no source publishes terrain or enemy AI.
 *
 * Formulas (SF Calculations, Pair Up, Dual System):
 * - Attack = Str or Mag + Mt (tripled when effective) + rank bonus; damage = Attack − Def or Res.
 * - Hit = weapon Hit + (Skl × 3 + Lck) / 2; Avoid = (Spd × 3 + Lck) / 2; Crit = weapon Crit + Skl / 2; crit avoid = Lck.
 * - Doubling: Spd − the other's Spd ≥ 5. Brave weapons strike twice per attack.
 * - Pair-up: the back adds its stat bonus (+1/+2/+3 for each stat at 10/20/30 and up) and its class bonus, the class
 *   bonus raised by 1 (C, B) or 2 (A, S) support. Dual strike rate = (both Skl) / 4 + 20/30/40/50/60 by support (+10
 *   with Dual Strike+). Dual guard rate = (both Def, or Res against magic) / 4 + 0/2/5/7/10 by support (+10 with
 *   Dual Guard+). Dual support adds Hit, Avoid, Crit and crit avoid by support rank.
 * - Weapon rank bonus (SF Calculations; #239, the game's Premonition forecast): Attack and Hit by kind and rank — a
 *   sword +1/+2/+3 Atk at C/B/A; a lance, bow or tome +1 Atk at C, +1 Atk and +5 Hit at B, +2 Atk and +5 Hit at A; an
 *   axe +5/+10 Hit at C/B, +1 Atk and +10 Hit at A. Weapon ranks aren't recorded (`weapon-ranks`): a unit's is read as
 *   the rank its weapon needs, a foe's as A in an advanced class (the cautious reading) and its weapon's rank otherwise.
 * - Weapon triangle (sword > axe > lance > sword): ±5 Hit at the advantaged side's E/D rank, taken at its smallest, a
 *   cautious reading.
 * - Plain Pavise/Aegis halve the lead's hits but not dual strikes; Pavise+/Aegis+ (Lunatic+) halve both (research
 *   #91). Lunatic+ counts the worst of its pool (Luna+: hits ignore half Def/Res; Hawkeye: always hits; Counter: melee
 *   damage comes back; Pavise+/Aegis+; Vantage+) unless the player recorded the skills seen; the pool leaves out
 *   Counter, Aegis+ and Pavise+ before Chapter 3.
 */
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import type { BossRow, ChapterDifficulty, EnemyGroup, MapItem } from '../game-data/chapters';
import { itemByName, forgedStats, type Effectiveness, type GameItem } from '../game-data/items';
import { MOD_STATS, STATS, type Gender, type ModStat, type Stat } from '../game-data/stats';
import { className } from './classes';

export type SupportLevel = 'C' | 'B' | 'A' | 'S';

/** A unit as the solver sees it: its recorded stats, class, skills and the weapon it uses. */
export type Fighter = {
  readonly name: string;
  readonly className: string;
  readonly stats: Readonly<Record<Stat, number>>;
  readonly skills: readonly string[];
  readonly weapon: { readonly item: GameItem; readonly forge?: { readonly mt: number; readonly hit: number; readonly crit: number } } | undefined;
};

/** An enemy on the map: the group's stats taken at their worst for the player (the top of FEW's `min~max`). */
export type Foe = {
  readonly name: string;
  readonly className: string;
  readonly count: number;
  readonly stats: Readonly<Record<Stat, number>>;
  readonly weapon: GameItem | undefined;
  readonly skills: readonly string[];
  readonly boss: boolean;
  /** Its level (the chapter data's), which the EXP formulas key on; a hand-built foe may leave it out. */
  readonly level?: number;
};

export type Matchup = {
  readonly foe: Foe;
  /** The lead's damage per hit, and how many hits it lands in a round (brave, doubling). */
  readonly damage: number;
  readonly hits: number;
  readonly doubles: boolean;
  readonly doubled: boolean;
  readonly oneRounds: boolean;
  /** One round kills if every dual strike lands. */
  readonly oneRoundsWithDualStrikes: boolean;
  readonly dualStrikeRate: number;
  /** A dual strike: the back's damage, hit and crit against the foe (its own stats and weapon; 0 with no back or weapon). */
  readonly backDamage: number;
  readonly backHit: number;
  readonly backCrit: number;
  /** The chance the back nullifies one of the foe's strikes (SF Dual System); 0 with no back. */
  readonly dualGuardRate: number;
  /** How many times the foe strikes in a round (brave, doubling); 0 with no weapon. */
  readonly foeStrikes: number;
  /** The biggest single hit the lead can take (no crit), and the most it takes in a round. */
  readonly worstHit: number;
  readonly worstRound: number;
  readonly survives: boolean;
  readonly hit: number;
  readonly crit: number;
  readonly foeHit: number;
  readonly foeCrit: number;
  /** Why the numbers are what they are: Lunatic+ skills assumed, Pavise+ halving dual strikes, Counter, effectiveness. */
  readonly notes: readonly string[];
};

const PHYSICAL = new Set(['sword', 'lance', 'axe', 'bow', 'stone', 'beaststone']);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.floor(n)));

const CLASS_TYPES: Readonly<Record<Effectiveness, readonly string[]>> = {
  flying: ['Pegasus Knight', 'Falcon Knight', 'Dark Flier', 'Wyvern Rider', 'Wyvern Lord', 'Griffon Rider'],
  armored: ['Knight', 'General', 'Great Knight'],
  beast: ['Cavalier', 'Paladin', 'Great Knight', 'Troubadour', 'Valkyrie', 'Dark Knight', 'Bow Knight', 'Taguel'],
  dragon: ['Manakete', 'Wyvern Rider', 'Wyvern Lord'],
  'fell dragon': ['Grima'],
  monster: ['Entombed', 'Revenant'],
};

/** The unit types a class counts as, for effectiveness. */
export const classTypes = (cls: string): Effectiveness[] => (Object.keys(CLASS_TYPES) as Effectiveness[]).filter((t) => CLASS_TYPES[t].includes(cls));

/** `classTypes`, worked out once per class (the simulation asks it for every matchup). */
const TYPES = new Map<string, readonly Effectiveness[]>();
const typesOf = (cls: string): readonly Effectiveness[] => TYPES.get(cls) ?? (TYPES.set(cls, classTypes(cls)), TYPES.get(cls)!);
const effectiveOn = (w: GameItem | undefined, cls: string): boolean => {
  if (!w?.effective) return false;
  const types = typesOf(cls);
  return w.effective.some((e) => types.includes(e));
};

/** A foe's skills with the Lunatic+ ones assumed, as a set: worked out once per foe and assumed skills. */
const SKILL_SETS = new WeakMap<Foe, Map<string, ReadonlySet<string>>>();
function skillSet(foe: Foe, lunaticPlus: readonly string[]): ReadonlySet<string> {
  let byExtra = SKILL_SETS.get(foe);
  if (!byExtra) SKILL_SETS.set(foe, (byExtra = new Map()));
  const k = lunaticPlus.length ? lunaticPlus.join(',') : '';
  let set = byExtra.get(k);
  if (!set) byExtra.set(k, (set = new Set([...foe.skills, ...lunaticPlus])));
  return set;
}

const TRIANGLE: Readonly<Record<string, string>> = { sword: 'axe', axe: 'lance', lance: 'sword' };
const triangle = (a: GameItem | undefined, b: GameItem | undefined) =>
  !a || !b ? 0 : TRIANGLE[a.kind] === b.kind ? 1 : TRIANGLE[b.kind] === a.kind ? -1 : 0;

const CLASS_BY_NAME = new Map<string, ClassId>(
  (Object.keys(CLASSES) as ClassId[]).flatMap((id) => (['M', 'F'] as Gender[]).map((g) => [className(id, g), id] as const)),
);

/** The lead's stats paired up with the back (SF Pair Up). */
export function pairUpBonus(back: Fighter, support: SupportLevel | null): Partial<Record<ModStat, number>> {
  const cls = CLASS_BY_NAME.get(back.className);
  const classBonus = cls ? (CLASSES[cls] as ClassData).pairUp : {};
  const lift = support === 'A' || support === 'S' ? 2 : support === 'C' || support === 'B' ? 1 : 0;
  const out: Partial<Record<ModStat, number>> = {};
  for (const s of MOD_STATS) {
    const v = back.stats[s];
    const statBonus = v >= 30 ? 3 : v >= 20 ? 2 : v >= 10 ? 1 : 0;
    const c = (classBonus as Partial<Record<ModStat, number>>)[s] ?? 0;
    out[s] = statBonus + (c ? c + lift : 0);
  }
  return out;
}

const SUPPORT_RANK: Readonly<Record<SupportLevel | 'none', number>> = { none: 1, C: 2, B: 3, A: 4, S: 5 };
/** Dual support bonuses by total support rank (SF Dual System): [hit, avoid, crit, crit avoid]. */
function dualSupport(rank: number): [number, number, number, number] {
  const r = Math.min(12, rank);
  return [r >= 9 ? 20 : r >= 5 ? 15 : 10, r >= 10 ? 20 : r >= 6 ? 15 : r >= 2 ? 10 : 0, r >= 12 ? 20 : r >= 8 ? 15 : r >= 4 ? 10 : 0, r >= 11 ? 20 : r >= 7 ? 15 : r >= 3 ? 10 : 0];
}

/** Weapon rank bonuses by kind (SF Calculations): [Attack, Hit] at C, B and A; S reads as A. */
const RANK_BONUS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  sword: [[1, 0], [2, 0], [3, 0]],
  lance: [[1, 0], [1, 5], [2, 5]],
  bow: [[1, 0], [1, 5], [2, 5]],
  tome: [[1, 0], [1, 5], [2, 5]],
  axe: [[0, 5], [0, 10], [1, 10]],
};
const RANK_INDEX: Readonly<Record<string, number>> = { C: 0, B: 1, A: 2, S: 2 };
const NO_RANK_BONUS = [0, 0] as const;
/**
 * A weapon's rank bonus in a class's hands (`weapon-ranks`): at the rank the weapon needs, or A for a foe in an advanced
 * class (a foe's rank is the cautious reading, as its stats are).
 */
function rankBonus(w: GameItem | undefined, cls: string, foe: boolean): readonly [number, number] {
  const table = w && RANK_BONUS[w.kind];
  if (!table) return NO_RANK_BONUS;
  const id = foe ? CLASS_BY_NAME.get(cls) : undefined;
  const rank = id && CLASSES[id].tier === 'advanced' ? 'A' : w.rank;
  const i = rank === undefined ? undefined : RANK_INDEX[rank];
  return i === undefined ? NO_RANK_BONUS : table[i]!;
}

const NO_WEAPON = { mt: 0, hit: 0, crit: 0 } as const;
const WEAPON_STATS = new WeakMap<NonNullable<Fighter['weapon']>, { mt: number; hit: number; crit: number }>();
const weaponStats = (w: Fighter['weapon']) => {
  if (!w) return NO_WEAPON;
  let ws = WEAPON_STATS.get(w);
  if (!ws) WEAPON_STATS.set(w, (ws = forgedStats(w.item, w.forge ?? NO_WEAPON)));
  return ws;
};
const STRIKE_BY_SUPPORT: Readonly<Record<SupportLevel | 'none', number>> = { none: 20, C: 30, B: 40, A: 50, S: 60 };
const GUARD_BY_SUPPORT: Readonly<Record<SupportLevel | 'none', number>> = { none: 0, C: 2, B: 5, A: 7, S: 10 };

/** Pair-up bonuses, worked out once per back and support (the simulation's backs are shared objects). */
const BONUSES = new WeakMap<Fighter, Map<SupportLevel | null, Partial<Record<ModStat, number>>>>();
function bonusOf(back: Fighter, support: SupportLevel | null): Partial<Record<ModStat, number>> {
  let bySupport = BONUSES.get(back);
  if (!bySupport) BONUSES.set(back, (bySupport = new Map()));
  let b = bySupport.get(support);
  if (!b) bySupport.set(support, (b = pairUpBonus(back, support)));
  return b;
}
const NO_BONUS: Partial<Record<ModStat, number>> = {};

/** The faire and breaker skills by weapon kind (SF Skills): +5 Str or Mag with the kind; +50 Hit and Avoid against it. */
const FAIRE: Readonly<Record<string, string>> = { sword: 'Swordfaire', lance: 'Lancefaire', axe: 'Axefaire', bow: 'Bowfaire', tome: 'Tomefaire' };
const BREAKER: Readonly<Record<string, string>> = { sword: 'Swordbreaker', lance: 'Lancebreaker', axe: 'Axebreaker', bow: 'Bowbreaker', tome: 'Tomebreaker' };
const has = (skills: readonly string[] | ReadonlySet<string>, name: string | undefined) => !!name && (Array.isArray(skills) ? skills.includes(name) : (skills as ReadonlySet<string>).has(name));
/** A faire's +5 when the weapon is its kind. */
const faireOf = (skills: readonly string[] | ReadonlySet<string>, w: GameItem | undefined) => (w && has(skills, FAIRE[w.kind]) ? 5 : 0);
/** A breaker's +50 Hit and Avoid when the other side's weapon is its kind. */
const breakerOf = (skills: readonly string[] | ReadonlySet<string>, other: GameItem | undefined) => (other && has(skills, BREAKER[other.kind]) ? 50 : 0);
/** Hit Rate +20 and Avoid +10 (SF Skills). */
const hitSkill = (skills: readonly string[] | ReadonlySet<string>) => (has(skills, 'Hit Rate +20') ? 20 : 0);
const avoidSkill = (skills: readonly string[] | ReadonlySet<string>) => (has(skills, 'Avoid +10') ? 10 : 0);

/**
 * One lead + back pair against one foe. `lunaticPlus` lists the Lunatic+ skills to assume (the map's pool) when the
 * foe's were not recorded; recorded skills come in `foe.skills`. With `paired` false the back is an adjacent ally
 * (Attack Stance, #183): Dual Strike, Dual Guard and Dual Support as the Support unit, but no pair-up stats (SF Dual
 * System).
 */
export function matchup(lead: Fighter, back: Fighter | undefined, support: SupportLevel | null, foe: Foe, lunaticPlus: readonly string[] = [], paired = true): Matchup {
  const notes: string[] = [];
  const bonus = back && paired ? bonusOf(back, support) : NO_BONUS;
  const st = (s: Stat) => lead.stats[s] + (s === 'hp' ? 0 : (bonus[s as ModStat] ?? 0));
  const skills = skillSet(foe, lunaticPlus);
  if (lunaticPlus.length) notes.push(`Lunatic+: assumes ${lunaticPlus.join(', ')}`);
  const w = lead.weapon?.item;
  const magic = !!w && (w.kind === 'tome' || w.magic === true);
  const ws = weaponStats(lead.weapon);
  const effective = effectiveOn(w, foe.className);
  if (effective) notes.push(`${w!.name} is effective: Mt tripled`);
  const tri = triangle(w, foe.weapon);
  const [rankAtk, rankHit] = rankBonus(w, lead.className, false);
  const [foeRankAtk, foeRankHit] = rankBonus(foe.weapon, foe.className, true);
  // Faires, breakers and the hit and avoid skills, both sides (the realism pass): the rest of a unit's skills are procs
  // and stat bonuses the exchange doesn't play (`skills-in-combat`).
  const leadAvoid = breakerOf(lead.skills, foe.weapon) + avoidSkill(lead.skills);
  const foeAvoid = breakerOf(skills, w) + avoidSkill(skills);
  const attack = (magic ? st('mag') : st('str')) + faireOf(lead.skills, w) + ws.mt * (effective ? 3 : 1) + rankAtk;
  let damage = Math.max(0, attack - (magic ? foe.stats.res : foe.stats.def));
  // Aegis covers bows, tomes and dragonstones; Pavise the rest, beaststones included (SF Skills).
  const aegisSide = (x: GameItem | undefined, m: boolean) => m || x?.kind === 'bow' || x?.kind === 'stone';
  const shieldPlusHit = aegisSide(w, magic) ? skills.has('Aegis+') : skills.has('Pavise+');
  const shield = aegisSide(w, magic) ? skills.has('Aegis') : skills.has('Pavise');
  const dragonskin = skills.has('Dragonskin');
  if (shieldPlusHit || dragonskin) damage = Math.floor(damage / 2);
  const brave = w?.brave ? 2 : 1;
  const doubles = st('spd') - foe.stats.spd >= 5;
  const doubled = foe.stats.spd - st('spd') >= 5;
  const hits = brave * (doubles ? 2 : 1);
  // Dual strikes: plain Pavise/Aegis don't touch them, the + versions (and Dragonskin) halve them.
  let backDamage = 0;
  let dualStrikeRate = 0;
  let backHit = 0;
  let backCrit = 0;
  if (back) {
    const bw = back.weapon?.item;
    const bmagic = !!bw && (bw.kind === 'tome' || bw.magic === true);
    const bws = weaponStats(back.weapon);
    const beff = effectiveOn(bw, foe.className);
    const [bRankAtk, bRankHit] = rankBonus(bw, back.className, false);
    backDamage = Math.max(0, (bmagic ? back.stats.mag : back.stats.str) + faireOf(back.skills, bw) + bws.mt * (beff ? 3 : 1) + bRankAtk - (bmagic ? foe.stats.res : foe.stats.def));
    const bPlus = aegisSide(bw, bmagic) ? skills.has('Aegis+') : skills.has('Pavise+');
    if (bPlus || dragonskin) {
      backDamage = Math.floor(backDamage / 2);
      notes.push(`${bPlus ? (aegisSide(bw, bmagic) ? 'Aegis+' : 'Pavise+') : 'Dragonskin'} halves dual strikes too`);
    } else if (shield) notes.push(`${aegisSide(w, magic) ? 'Aegis' : 'Pavise'} may halve the lead’s hits; dual strikes get past it`);
    const skl = lead.stats.skl + back.stats.skl;
    dualStrikeRate = clamp(skl / 4 + STRIKE_BY_SUPPORT[support ?? 'none'] + (lead.skills.includes('Dual Strike+') || back.skills.includes('Dual Strike+') ? 10 : 0));
    // The dual strike itself uses the back's own stats and weapon; a back with no weapon can't strike.
    if (bw) {
      backHit = clamp(bws.hit + bRankHit + (back.stats.skl * 3 + back.stats.lck) / 2 + 5 * triangle(bw, foe.weapon) + breakerOf(back.skills, foe.weapon) + hitSkill(back.skills) - ((foe.stats.spd * 3 + foe.stats.lck) / 2 + breakerOf(skills, bw) + avoidSkill(skills)));
      backCrit = clamp(bws.crit + back.stats.skl / 2 - foe.stats.lck);
    } else backDamage = 0;
  }
  const total = damage * hits;
  const oneRounds = total >= foe.stats.hp;
  const oneRoundsWithDualStrikes = total + backDamage * hits >= foe.stats.hp;
  // The foe's side.
  const fw = foe.weapon;
  const fmagic = !!fw && (fw.kind === 'tome' || fw.magic === true);
  const fmt = fw?.mt ?? 0;
  const fhit = fw?.hit ?? 0;
  const fcrit = fw?.crit ?? 0;
  const feff = effectiveOn(fw, lead.className);
  if (feff) notes.push(`${foe.name}’s ${fw!.name} is effective against the lead`);
  const leadDef = fmagic ? st('res') : st('def');
  const luna = skills.has('Luna+');
  const worstHit = Math.max(0, (fmagic ? foe.stats.mag : foe.stats.str) + faireOf(skills, fw) + fmt * (feff ? 3 : 1) + foeRankAtk - (luna ? Math.floor(leadDef / 2) : leadDef));
  const foeHits = fw ? (fw.brave ? 2 : 1) * (doubled ? 2 : 1) : 0;
  // Counter returns the lead's damage when it hits in melee and doesn't kill.
  const melee = !w || (w.range ?? '1') === '1';
  const counter = skills.has('Counter') && melee && !oneRounds ? damage * Math.min(hits, Math.max(1, Math.ceil(foe.stats.hp / Math.max(1, damage)) - 1)) : 0;
  if (counter) notes.push(`Counter returns ${counter}`);
  const worstRound = worstHit * foeHits + counter;
  // Dual Guard (SF Dual System): both units' Def (Res against magic) / 4, + 0/2/5/7/10 by support, +10 with Dual Guard+.
  const guardStat = fmagic ? 'res' : 'def';
  const dualGuardRate = back
    ? clamp((lead.stats[guardStat] + back.stats[guardStat]) / 4 + GUARD_BY_SUPPORT[support ?? 'none'] + (lead.skills.includes('Dual Guard+') || back.skills.includes('Dual Guard+') ? 10 : 0))
    : 0;
  const survives = worstRound < lead.stats.hp;
  const [sHit, sAvo, sCrit, sCritAvo] = back ? dualSupport(SUPPORT_RANK[support ?? 'none']) : [0, 0, 0, 0];
  const hit = clamp(ws.hit + rankHit + (st('skl') * 3 + st('lck')) / 2 + sHit + 5 * tri + breakerOf(lead.skills, foe.weapon) + hitSkill(lead.skills) - ((foe.stats.spd * 3 + foe.stats.lck) / 2 + foeAvoid));
  const crit = clamp(ws.crit + st('skl') / 2 + sCrit - foe.stats.lck);
  const foeHit = skills.has('Hawkeye') ? 100 : clamp(fhit + foeRankHit + (foe.stats.skl * 3 + foe.stats.lck) / 2 - 5 * tri + breakerOf(skills, w) + hitSkill(skills) - ((st('spd') * 3 + st('lck')) / 2 + sAvo + leadAvoid));
  const foeCrit = clamp(fcrit + foe.stats.skl / 2 - (st('lck') + sCritAvo));
  if (skills.has('Hawkeye')) notes.push('Hawkeye: the foe always hits');
  if (luna) notes.push('Luna+: the foe’s hits ignore half your defence');
  if (skills.has('Vantage+')) notes.push('Vantage+: on its turn the foe strikes first');
  return { foe, damage, hits, doubles, doubled, oneRounds, oneRoundsWithDualStrikes, dualStrikeRate, backDamage, backHit, backCrit, dualGuardRate, foeStrikes: foeHits, worstHit, worstRound, survives, hit, crit, foeHit, foeCrit, notes };
}

/** The top of FEW's `min~max` (or the one number), bonuses included: the worst case for the player. */
export function statValue(text: string): number {
  // e.g. `16~18`, `37+5 (Granted by HP +5)`, `24`.
  const [first, ...rest] = (text ?? '').replace(/\([^)]*\)/g, '').split('+');
  const tops = first!.split('~').map((x) => parseInt(x, 10)).filter(Number.isFinite);
  if (!tops.length) return 0;
  return Math.max(...tops) + rest.map((x) => parseInt(x, 10)).filter(Number.isFinite).reduce((a, b) => a + b, 0);
}

const WEAPONS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/** A foe's weapon with its forge as the chapter data states it (#189): the forged Mt and Hit, or the bonus added. */
function forgedWeapon(i: MapItem): GameItem | undefined {
  const item = itemByName(i.name);
  if (!item || !WEAPONS.has(item.kind)) return undefined;
  if (i.forgedTo) return { ...item, mt: i.forgedTo.mt, hit: i.forgedTo.hit };
  if (i.forge && (i.forge.mt || i.forge.hit)) return { ...item, mt: (item.mt ?? 0) + i.forge.mt, hit: (item.hit ?? 0) + i.forge.hit };
  return item;
}

/** An enemy group or boss row as a foe: its first weapon (forged as the data states), its listed skills. */
export function foeOf(g: EnemyGroup | BossRow, boss: boolean): Foe {
  const stats = Object.fromEntries(STATS.map((s) => [s, statValue(g.stats[s])])) as Record<Stat, number>;
  const weapon = g.items.map(forgedWeapon).find((i): i is GameItem => !!i);
  return {
    name: ('name' in g && g.name) || g.class,
    className: g.class,
    count: 'count' in g ? parseInt(g.count, 10) || 1 : 1,
    stats,
    weapon,
    skills: g.skills ?? [],
    boss,
    level: statValue(g.level),
  };
}

/** The foes of a map on a difficulty: its boss rows first, then each enemy group. */
export function foesOf(map: { readonly enemies: Readonly<Partial<Record<ChapterDifficulty, readonly EnemyGroup[]>>>; readonly bosses: Readonly<Partial<Record<string, readonly BossRow[]>>> }, difficulty: ChapterDifficulty, lunaticPlus = false): Foe[] {
  const bosses = ((lunaticPlus && map.bosses['lunatic-plus']) || map.bosses[difficulty] || []).map((b) => foeOf(b, true));
  const groups = (map.enemies[difficulty] ?? []).map((g) => foeOf(g, false));
  // Each boss's own row in the enemy table, counted once: of its class and HP, named as the boss or its stats within two
  // of the boss data's (#189: late maps and Apotheosis have many foes of a boss's class at 80 HP; they stay).
  const own = new Set<number>();
  for (const b of bosses) {
    let best = -1;
    let bestScore = Infinity;
    groups.forEach((f, i) => {
      if (own.has(i) || f.className !== b.className || f.stats.hp !== b.stats.hp) return;
      const diff = STATS.filter((s) => f.stats[s] !== b.stats[s]).length;
      const named = b.name === f.name || b.name.startsWith(`${f.name} (`);
      if (!named && diff > 2) return;
      const score = (named ? 0 : 100) + diff;
      if (score < bestScore) [best, bestScore] = [i, score];
    });
    if (best >= 0) own.add(best);
  }
  return [...bosses, ...groups.filter((_, i) => !own.has(i))];
}

/** How `bestWeapon` ranks a matchup: one-rounding first, then surviving, then damage, then hit. */
export const bestKey = (r: Matchup): number => (r.oneRounds ? 1e6 : 0) + (r.survives ? 1e5 : 0) + r.damage * r.hits * 100 + r.hit;

/** The best of a unit's weapons against a foe: most damage, then hit. */
export function bestWeapon(fighter: Fighter, weapons: readonly NonNullable<Fighter['weapon']>[], back: Fighter | undefined, support: SupportLevel | null, foe: Foe, lunaticPlus: readonly string[], paired = true): { weapon: Fighter['weapon']; result: Matchup } | undefined {
  let best: { weapon: Fighter['weapon']; result: Matchup } | undefined;
  let bestK = 0;
  for (const weapon of weapons) {
    const result = matchup(weapon === fighter.weapon ? fighter : { ...fighter, weapon }, back, support, foe, lunaticPlus, paired);
    const k = bestKey(result);
    if (!best || k > bestK) [best, bestK] = [{ weapon, result }, k];
  }
  return best;
}

/** A foe's key on its map: name, class and HP, stable across renders (for recorded skills). */
export const foeKey = (f: Foe): string => `${f.name}|${f.className}|${f.stats.hp}`;

/** A threat to the army from one foe (#120). */
export type DangerFlag = { readonly foe: string; readonly unit: string; readonly kind: 'effective' | 'counter' | 'doubles' | 'kills'; readonly text: string };

/**
 * What in the map threatens the army (#120): a foe whose weapon is effective against a unit (Beast Killers against
 * cavalry, bows against fliers), Counter against a melee lead, a boss that doubles a unit, and a foe whose worst round
 * would kill a unit. `pool`: the Lunatic+ skills to assume for foes without recorded skills.
 */
export function dangerFlags(army: readonly Fighter[], foes: readonly Foe[], pool: readonly string[] = [], recorded: (f: Foe) => readonly string[] | undefined = () => undefined): DangerFlag[] {
  const out: DangerFlag[] = [];
  for (const foe of foes) {
    const seen = recorded(foe);
    const skills = new Set([...foe.skills, ...(seen ?? pool)]);
    for (const u of army) {
      const eff = foe.weapon?.effective?.filter((e) => classTypes(u.className).includes(e)) ?? [];
      if (eff.length) out.push({ foe: foe.name, unit: u.name, kind: 'effective', text: `${foe.name}’s ${foe.weapon!.name} is effective against ${u.name} (${eff.join(', ')})` });
      // Counter only answers an adjacent attack: a 1–2 range weapon can strike from 2 instead.
      const melee = !!u.weapon && (u.weapon.item.range ?? '1') === '1';
      if (skills.has('Counter') && melee) out.push({ foe: foe.name, unit: u.name, kind: 'counter', text: `${foe.name} ${seen ? 'has' : 'may have'} Counter: ${u.name}’s melee hits come back` });
      if (foe.boss && foe.stats.spd - u.stats.spd >= 5) out.push({ foe: foe.name, unit: u.name, kind: 'doubles', text: `${foe.name} doubles ${u.name}` });
      const m = matchup(u, undefined, null, foe, seen ? [] : pool.filter((s) => !foe.skills.includes(s)));
      if (!m.survives) out.push({ foe: foe.name, unit: u.name, kind: 'kills', text: `${foe.name} can kill ${u.name} in one round (${m.worstRound} vs ${u.stats.hp} HP)` });
    }
  }
  return out;
}
