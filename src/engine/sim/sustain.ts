/**
 * Sustain, Dance and Rally for the map simulation (#182; spec #175, The map simulation): what a staff, a potion, a
 * Dance or a Rally does, read from the item and skill data, and whether a staff reaches a pair.
 *
 * - Staves heal what the item data says (`(8 + magic/2)`, Recover in full; Healtouch +5). Heal, Mend and Recover are
 *   adjacent; Physic, Fortify and Rescue reach Mag ÷ 2 tiles, from the unit's expected Mag. The staff user moves first
 *   (its class's Mov), so its reach is Mov + range.
 * - Whether a staff reaches a pair is a chance against the **assumed army spread**: the distances from a staff user to
 *   the pairs on the map, each pair equally likely at any of them. The chance is the share of distances within reach.
 *   It's one input, so the map editor's real distance to each pair can replace it.
 * - A potion (Vulnerary, Concoction, Elixir) heals its holder with the holder's own action.
 * - Rally: its stat bonus (the skill data's `Str +4`, `All stats +2`, …) reaches every pair it's planned for.
 */
import { CLASS_BASES } from '../../game-data/class-bases';
import type { GameItem } from '../../game-data/items';
import { SKILLS } from '../../game-data/skills';
import type { Stat } from '../../game-data/stats';
import { classIdByName } from '../supply';
import type { Fighter } from '../solver';

/** Distances (tiles) from a staff user to each pair on the map; each pair equally likely at any of them. */
export type ArmySpread = readonly number[];

/** An item the unit can spend a use of: a staff or a potion, with the uses it has left. */
export type SimItem = { readonly item: GameItem; readonly uses: number };

/** The Mov assumed when the class isn't in the class data. */
const DEFAULT_MOV = 5;

/** A class's Mov from SF's class base stats. */
export function movOf(className: string): number {
  const id = classIdByName(className.trim());
  const b = id ? CLASS_BASES[id] : undefined;
  return (b?.any ?? b?.M ?? b?.F)?.mov ?? DEFAULT_MOV;
}

/** What a staff does: heal one ally, heal every ally in reach (Fortify), or move one ally to safety (Rescue). */
export type StaffEffect = { readonly kind: 'heal' | 'fortify' | 'rescue'; readonly reach: number; readonly amount: number };

const isStaff = (i: GameItem) => i.kind === 'staff';

/**
 * A staff's effect in this unit's hands: its reach (Mov plus its range, Mag ÷ 2 for `1~Mag/2` staves) and what it
 * heals (the data's `(base + magic/2)`, or all HP; Healtouch +5). Undefined for a staff that neither heals nor rescues.
 */
export function staffEffect(fighter: Fighter, item: GameItem): StaffEffect | undefined {
  if (!isStaff(item)) return undefined;
  const mag = fighter.stats.mag;
  const [, hi] = (item.range ?? '1').split('~');
  const range = hi === undefined ? parseInt(item.range ?? '1', 10) || 1 : /Mag\/2/i.test(hi) ? Math.max(1, Math.floor(mag / 2)) : parseInt(hi, 10) || 1;
  const reach = movOf(fighter.className) + range;
  const text = `${item.notes ?? ''} ${item.description ?? ''}`;
  if (/teleports/i.test(text)) return { kind: 'rescue', reach, amount: 0 };
  const touch = fighter.skills.includes('Healtouch') ? 5 : 0;
  const fixed = /\((\d+)\s*\+\s*magic\/2\)/i.exec(text);
  const amount = /fully restores/i.test(text) ? Infinity : fixed ? Number(fixed[1]) + Math.floor(mag / 2) + touch : undefined;
  if (amount === undefined) return undefined;
  return { kind: /all allies/i.test(text) ? 'fortify' : 'heal', reach, amount };
}

/** A potion's heal on its holder (`Restores 10 HP`, `Restores all HP`); undefined for any other item. */
export function potionHeal(item: GameItem): number | undefined {
  if (item.kind !== 'item') return undefined;
  const text = item.description ?? '';
  if (/restores all hp/i.test(text)) return Infinity;
  const m = /restores (\d+) hp/i.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** The chance a staff with this reach reaches a pair: the share of the spread's distances within it. */
export function reachChance(reach: number, spread: ArmySpread): number {
  if (!spread.length) return 1;
  return spread.filter((d) => d <= reach).length / spread.length;
}

/** Whether the unit dances (the Dancer class's Dance: another action for a unit that has acted). */
export const dances = (fighter: Fighter): boolean => fighter.className.trim() === 'Dancer';

export type RallyBonus = Readonly<Partial<Record<Stat, number>>>;

const STAT_WORDS: Readonly<Record<string, Stat>> = { Str: 'str', Mag: 'mag', Skl: 'skl', Spd: 'spd', Lck: 'lck', Def: 'def', Res: 'res' };
const COMBAT_STATS: readonly Stat[] = ['str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'];

/** Rally skills by name, with the stat bonus their description gives (Rally Movement's Mov is left out). */
const RALLIES: ReadonlyMap<string, RallyBonus> = new Map(
  Object.values(SKILLS as Record<string, { name: string; description: string; rally: boolean }>)
    .filter((s) => s.rally)
    .map((s) => {
      const bonus: Partial<Record<Stat, number>> = {};
      const all = /All stats \+(\d+)/.exec(s.description);
      if (all) for (const st of COMBAT_STATS) bonus[st] = Number(all[1]);
      for (const m of s.description.matchAll(/\b(Str|Mag|Skl|Spd|Lck|Def|Res) \+(\d+)/g)) bonus[STAT_WORDS[m[1]!]!] = Number(m[2]);
      return [s.name, bonus] as const;
    })
    .filter(([, b]) => Object.keys(b).length > 0),
);

/** The unit's Rally bonus: every Rally skill it has equipped, each stat at its best (the same stat doesn't stack). */
export function rallyOf(fighter: Fighter): RallyBonus | undefined {
  let out: Partial<Record<Stat, number>> | undefined;
  for (const s of fighter.skills) {
    const b = RALLIES.get(s);
    if (!b) continue;
    out ??= {};
    for (const [st, v] of Object.entries(b) as [Stat, number][]) out[st] = Math.max(out[st] ?? 0, v);
  }
  return out;
}

/** Two bonuses together, each stat at its best. */
export function mergeRally(a: RallyBonus, b: RallyBonus): RallyBonus {
  const out: Partial<Record<Stat, number>> = { ...a };
  for (const [st, v] of Object.entries(b) as [Stat, number][]) out[st] = Math.max(out[st] ?? 0, v);
  return out;
}

export const rallyKey = (b: RallyBonus): string =>
  COMBAT_STATS.map((s) => b[s] ?? 0).join(',');

/** A fighter with the bonus added. */
export function rallied(f: Fighter, b: RallyBonus): Fighter {
  const stats = { ...f.stats };
  for (const [st, v] of Object.entries(b) as [Stat, number][]) stats[st] += v;
  return { ...f, stats };
}
