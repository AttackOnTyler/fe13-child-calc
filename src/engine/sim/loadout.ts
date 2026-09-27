/**
 * A unit's loadout for one map (the realism pass): what it carries into the map out of everything it holds. A unit
 * carries five items (SF Inventory); the rest waits in the convoy. The runs' units pile up weapons (rebuys, re-arming on
 * the way, finds, handovers), and a unit fielding fourteen lances is neither the game nor cheap to simulate: every
 * weapon it carries is another matchup against every foe.
 *
 * The pick, before the map (the preparations' Convoy): its staves (two at most) and one potion, then weapons for the
 * rest, chosen greedily for this map's foes: first the one that deals the most expected damage over them (by count),
 * then each that adds most to the best any chosen weapon deals against each foe (a weapon effective against some of
 * them, a tome against high Def, the other side of the triangle). Expected damage is read from the stats alone (Str or
 * Mag plus Mt, tripled when effective, less Def or Res; brave strikes twice; times a hit chance from Hit, Skl and Lck
 * against the foe's Avoid), a cheap stand-in for the matchups the play then works out for the weapons chosen.
 */
import { forgedStats } from '../../game-data/items';
import { classTypes, type Fighter, type Foe } from '../solver';
import type { SimItem } from './sustain';
import { potionHeal } from './sustain';

type Weapon = NonNullable<Fighter['weapon']>;

/** The items a unit carries into a map (SF Inventory). */
export const INVENTORY = 5;
/** Staves carried at most, and potions. */
const STAVES = 2;
const POTIONS = 1;

const TRIANGLE: Readonly<Record<string, string>> = { sword: 'axe', axe: 'lance', lance: 'sword' };
const TYPES = new Map<string, readonly string[]>();
const typesOf = (cls: string): readonly string[] => TYPES.get(cls) ?? (TYPES.set(cls, classTypes(cls)), TYPES.get(cls)!);

/** A weapon's expected damage in one attack against a foe, from the stats alone. */
function expected(f: Fighter, w: Weapon, foe: Foe): number {
  const item = w.item;
  const s = forgedStats(item, w.forge ?? { mt: 0, hit: 0, crit: 0 });
  const magic = item.kind === 'tome' || item.magic === true;
  const eff = item.effective && item.effective.some((e) => typesOf(foe.className).includes(e)) ? 3 : 1;
  const dmg = Math.max(0, (magic ? f.stats.mag : f.stats.str) + s.mt * eff - (magic ? foe.stats.res : foe.stats.def));
  const tri = foe.weapon ? (TRIANGLE[item.kind] === foe.weapon.kind ? 5 : TRIANGLE[foe.weapon.kind] === item.kind ? -5 : 0) : 0;
  const hit = Math.max(0, Math.min(100, s.hit + (f.stats.skl * 3 + f.stats.lck) / 2 + tri - (foe.stats.spd * 3 + foe.stats.lck) / 2)) / 100;
  return dmg * (item.brave ? 2 : 1) * hit;
}

const same = (a: Weapon, b: Weapon) => a === b || (a.item === b.item && (a.forge?.mt ?? 0) === (b.forge?.mt ?? 0) && (a.forge?.hit ?? 0) === (b.forge?.hit ?? 0) && (a.forge?.crit ?? 0) === (b.forge?.crit ?? 0));

/**
 * What a unit carries into a map with these foes: its weapons and its staves and potions, five items at most (see the
 * module comment). With no foes, its first weapons in order.
 */
export function loadout(f: Fighter, weapons: readonly Weapon[], items: readonly SimItem[], foes: readonly Foe[]): { weapons: readonly Weapon[]; items: readonly SimItem[] } {
  const distinct: Weapon[] = [];
  for (const w of weapons) if (!distinct.some((d) => same(d, w))) distinct.push(w);
  const staves = items.filter((i) => i.item.kind === 'staff').slice(0, STAVES);
  const potions = items.filter((i) => i.item.kind !== 'staff' && potionHeal(i.item) !== undefined).slice(0, POTIONS);
  // A unit that fights keeps two slots for weapons at least.
  const kept = [...staves, ...potions].slice(0, distinct.length ? INVENTORY - Math.min(2, distinct.length) : INVENTORY);
  const room = INVENTORY - kept.length;
  const carried = kept.length === items.length ? items : kept;
  if (distinct.length <= room) return { weapons: distinct.length === weapons.length ? weapons : distinct, items: carried };
  if (!foes.length) return { weapons: distinct.slice(0, room), items: carried };
  const table = distinct.map((w) => foes.map((foe) => expected(f, w, foe)));
  const best = foes.map(() => 0);
  const chosen: number[] = [];
  while (chosen.length < room) {
    let pick = -1;
    let gain = 0;
    table.forEach((row, i) => {
      if (chosen.includes(i)) return;
      const g = row.reduce((n, d, k) => n + Math.max(0, d - best[k]!) * (foes[k]!.boss ? 1 : foes[k]!.count), 0);
      if (pick < 0 || g > gain) [pick, gain] = [i, g];
    });
    if (pick < 0 || (chosen.length > 0 && gain <= 0)) break;
    chosen.push(pick);
    table[pick]!.forEach((d, k) => (best[k] = Math.max(best[k]!, d)));
  }
  chosen.sort((a, b) => a - b);
  return { weapons: chosen.map((i) => distinct[i]!), items: carried };
}

/** The foes a map puts up (its starting groups and every wave's). */
export const foesOfMap = (map: { readonly foes: readonly { readonly foe: Foe }[]; readonly waves: readonly { readonly groups: readonly { readonly foe: Foe }[] }[] }): Foe[] => [
  ...map.foes.map((g) => g.foe),
  ...map.waves.flatMap((w) => w.groups.map((g) => g.foe)),
];
