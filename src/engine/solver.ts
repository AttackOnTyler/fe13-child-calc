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
 *   with Dual Strike+). Dual support adds Hit, Avoid, Crit and crit avoid by support rank.
 * - Weapon triangle (sword > axe > lance > sword): ±5 Hit at the advantaged side's E/D rank. Weapon ranks aren't
 *   recorded, so no rank bonus is counted and the triangle is taken at its smallest, a cautious reading.
 * - Plain Pavise/Aegis halve the lead's hits but not dual strikes; Pavise+/Aegis+ (Lunatic+) halve both (research
 *   #91). Lunatic+ counts the worst of its pool (Luna+: hits ignore half Def/Res; Hawkeye: always hits; Counter: melee
 *   damage comes back; Pavise+/Aegis+; Vantage+) unless the player recorded the skills seen; the pool leaves out
 *   Counter, Aegis+ and Pavise+ before Chapter 3.
 */
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import type { BossRow, ChapterDifficulty, EnemyGroup } from '../game-data/chapters';
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

const weaponStats = (w: Fighter['weapon']) => (w ? forgedStats(w.item, w.forge ?? { mt: 0, hit: 0, crit: 0 }) : { mt: 0, hit: 0, crit: 0 });

/**
 * One lead + back pair against one foe. `lunaticPlus` lists the Lunatic+ skills to assume (the map's pool) when the
 * foe's were not recorded; recorded skills come in `foe.skills`.
 */
export function matchup(lead: Fighter, back: Fighter | undefined, support: SupportLevel | null, foe: Foe, lunaticPlus: readonly string[] = []): Matchup {
  const notes: string[] = [];
  const bonus = back ? pairUpBonus(back, support) : {};
  const st = (s: Stat) => lead.stats[s] + (s === 'hp' ? 0 : (bonus[s as ModStat] ?? 0));
  const skills = new Set([...foe.skills, ...lunaticPlus]);
  if (lunaticPlus.length) notes.push(`Lunatic+: assumes ${lunaticPlus.join(', ')}`);
  const w = lead.weapon?.item;
  const magic = !!w && (w.kind === 'tome' || w.magic === true);
  const ws = weaponStats(lead.weapon);
  const effective = w?.effective?.some((e) => classTypes(foe.className).includes(e)) ?? false;
  if (effective) notes.push(`${w!.name} is effective: Mt tripled`);
  const tri = triangle(w, foe.weapon);
  const attack = (magic ? st('mag') : st('str')) + ws.mt * (effective ? 3 : 1);
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
  if (back) {
    const bw = back.weapon?.item;
    const bmagic = !!bw && (bw.kind === 'tome' || bw.magic === true);
    const bws = weaponStats(back.weapon);
    const beff = bw?.effective?.some((e) => classTypes(foe.className).includes(e)) ?? false;
    backDamage = Math.max(0, (bmagic ? back.stats.mag : back.stats.str) + bws.mt * (beff ? 3 : 1) - (bmagic ? foe.stats.res : foe.stats.def));
    const bPlus = aegisSide(bw, bmagic) ? skills.has('Aegis+') : skills.has('Pavise+');
    if (bPlus || dragonskin) {
      backDamage = Math.floor(backDamage / 2);
      notes.push(`${bPlus ? (aegisSide(bw, bmagic) ? 'Aegis+' : 'Pavise+') : 'Dragonskin'} halves dual strikes too`);
    } else if (shield) notes.push(`${aegisSide(w, magic) ? 'Aegis' : 'Pavise'} may halve the lead’s hits; dual strikes get past it`);
    const skl = lead.stats.skl + back.stats.skl;
    dualStrikeRate = clamp(skl / 4 + { none: 20, C: 30, B: 40, A: 50, S: 60 }[support ?? 'none'] + ([...lead.skills, ...back.skills].includes('Dual Strike+') ? 10 : 0));
  }
  const total = damage * hits;
  const oneRounds = total >= foe.stats.hp;
  const oneRoundsWithDualStrikes = total + backDamage * hits >= foe.stats.hp;
  // The foe's side.
  const fw = foe.weapon;
  const fmagic = !!fw && (fw.kind === 'tome' || fw.magic === true);
  const fws = fw ? { mt: fw.mt ?? 0, hit: fw.hit ?? 0, crit: fw.crit ?? 0 } : { mt: 0, hit: 0, crit: 0 };
  const leadTypes = classTypes(lead.className);
  const feff = fw?.effective?.some((e) => leadTypes.includes(e)) ?? false;
  if (feff) notes.push(`${foe.name}’s ${fw!.name} is effective against the lead`);
  const leadDef = fmagic ? st('res') : st('def');
  const luna = skills.has('Luna+');
  const worstHit = Math.max(0, (fmagic ? foe.stats.mag : foe.stats.str) + fws.mt * (feff ? 3 : 1) - (luna ? Math.floor(leadDef / 2) : leadDef));
  const foeHits = fw ? (fw.brave ? 2 : 1) * (doubled ? 2 : 1) : 0;
  // Counter returns the lead's damage when it hits in melee and doesn't kill.
  const melee = !w || (w.range ?? '1') === '1';
  const counter = skills.has('Counter') && melee && !oneRounds ? damage * Math.min(hits, Math.max(1, Math.ceil(foe.stats.hp / Math.max(1, damage)) - 1)) : 0;
  if (counter) notes.push(`Counter returns ${counter}`);
  const worstRound = worstHit * foeHits + counter;
  const survives = worstRound < lead.stats.hp;
  const [sHit, sAvo, sCrit, sCritAvo] = back ? dualSupport(SUPPORT_RANK[support ?? 'none']) : [0, 0, 0, 0];
  const hit = clamp(ws.hit + (st('skl') * 3 + st('lck')) / 2 + sHit + 5 * tri - (foe.stats.spd * 3 + foe.stats.lck) / 2);
  const crit = clamp(ws.crit + st('skl') / 2 + sCrit - foe.stats.lck);
  const foeHit = skills.has('Hawkeye') ? 100 : clamp(fws.hit + (foe.stats.skl * 3 + foe.stats.lck) / 2 - 5 * tri - ((st('spd') * 3 + st('lck')) / 2 + sAvo));
  const foeCrit = clamp(fws.crit + foe.stats.skl / 2 - (st('lck') + sCritAvo));
  if (skills.has('Hawkeye')) notes.push('Hawkeye: the foe always hits');
  if (luna) notes.push('Luna+: the foe’s hits ignore half your defence');
  if (skills.has('Vantage+')) notes.push('Vantage+: on its turn the foe strikes first');
  return { foe, damage, hits, doubles, doubled, oneRounds, oneRoundsWithDualStrikes, dualStrikeRate, worstHit, worstRound, survives, hit, crit, foeHit, foeCrit, notes };
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

/** An enemy group or boss row as a foe: its first weapon, its listed skills. */
export function foeOf(g: EnemyGroup | BossRow, boss: boolean): Foe {
  const stats = Object.fromEntries(STATS.map((s) => [s, statValue(g.stats[s])])) as Record<Stat, number>;
  const weapon = g.items.map((i) => itemByName(i.name)).find((i): i is GameItem => !!i && WEAPONS.has(i.kind));
  return {
    name: ('name' in g && g.name) || g.class,
    className: g.class,
    count: 'count' in g ? parseInt(g.count, 10) || 1 : 1,
    stats,
    weapon,
    skills: g.skills ?? [],
    boss,
  };
}

/** The foes of a map on a difficulty: its boss rows first, then each enemy group. */
export function foesOf(map: { readonly enemies: Readonly<Partial<Record<ChapterDifficulty, readonly EnemyGroup[]>>>; readonly bosses: Readonly<Partial<Record<string, readonly BossRow[]>>> }, difficulty: ChapterDifficulty, lunaticPlus = false): Foe[] {
  const bosses = ((lunaticPlus && map.bosses['lunatic-plus']) || map.bosses[difficulty] || []).map((b) => foeOf(b, true));
  const bossNames = new Set(bosses.map((b) => `${b.className}|${b.stats.hp}`));
  const groups = (map.enemies[difficulty] ?? []).map((g) => foeOf(g, false)).filter((f) => !bossNames.has(`${f.className}|${f.stats.hp}`));
  return [...bosses, ...groups];
}

/** The best of a unit's weapons against a foe: most damage, then hit. */
export function bestWeapon(fighter: Fighter, weapons: readonly NonNullable<Fighter['weapon']>[], back: Fighter | undefined, support: SupportLevel | null, foe: Foe, lunaticPlus: readonly string[]): { weapon: Fighter['weapon']; result: Matchup } | undefined {
  let best: { weapon: Fighter['weapon']; result: Matchup } | undefined;
  for (const weapon of weapons) {
    const result = matchup({ ...fighter, weapon }, back, support, foe, lunaticPlus);
    const key = (r: Matchup) => (r.oneRounds ? 1e6 : 0) + (r.survives ? 1e5 : 0) + r.damage * r.hits * 100 + r.hit;
    if (!best || key(result) > key(best.result)) best = { weapon, result };
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
