/**
 * The supply list, seals and promotions for the next map (#122). What the open armories sell (merchants only as a
 * chance), the purchases and forges that close the solver's gaps within the gold held, when seals can be bought, and
 * whether to promote now or later. Expected stats (from average growths) are used only for that last question, and are
 * labelled as expected.
 */
import { CLASS_BASES, type ClassBase } from '../game-data/class-bases';
import { CLASSES, type ClassData, type ClassId } from '../game-data/classes';
import { MAPS, SEAL_RULES } from '../game-data/chapters';
import { FORGE, forgeCost, itemByName, type ForgeLevels } from '../game-data/items';
import { STATS, type Gender, type Stat } from '../game-data/stats';
import { className, promotionsOf } from './classes';
import type { DeployCandidate } from './deploy';
import type { HeldItem } from './run';
import { bestWeapon, type Fighter, type Foe, type SupportLevel } from './solver';

export type StockItem = { readonly item: string; readonly cost: number | null; readonly where: string };

/** What can be bought before the next map: every armory the cleared maps have opened; merchants only by chance. */
export function openStock(cleared: ReadonlySet<string>): { armory: StockItem[]; merchant: StockItem[]; forge: boolean } {
  const armory = new Map<string, StockItem>();
  const merchant = new Map<string, StockItem>();
  const clearedLabels = new Set(MAPS.filter((m) => cleared.has(m.id)).map((m) => m.label.toLowerCase()));
  for (const m of MAPS) {
    if (!m.shop || !cleared.has(m.id)) continue;
    const opens = m.shop.opensAfter;
    const open = !opens || opens === 'this chapter' || clearedLabels.has(opens.toLowerCase());
    if (open) for (const a of m.shop.armory) if (!armory.has(a.item)) armory.set(a.item, { ...a, where: m.shop.location });
    for (const a of m.shop.merchant) if (!merchant.has(a.item)) merchant.set(a.item, { ...a, where: m.shop.location });
  }
  return { armory: [...armory.values()], merchant: [...merchant.values()], forge: armory.size > 0 };
}

export type SealAvailability = { readonly master: 'armory' | 'merchant' | 'none'; readonly second: 'armory' | 'merchant' | 'none'; readonly note: string };

/**
 * When seals can be bought, read from the chapter data (SEAL_RULES): Master Seals from the Port Ferox armory once
 * Chapter 12 is cleared, Second Seals from the Mila Tree armory once Chapter 16 is; until then only a random merchant
 * at a cleared location whose pool holds them (Prologue to Chapter 10, Paralogues 1–3) sells them.
 */
export function sealAvailability(cleared: ReadonlySet<string>): SealAvailability {
  const stock = openStock(cleared);
  const where = (seal: string) => (stock.armory.some((a) => a.item === seal) ? 'armory' : stock.merchant.some((a) => a.item === seal) ? 'merchant' : 'none') as SealAvailability['master'];
  const master = where('Master Seal');
  const second = where('Second Seal');
  const say = (w: SealAvailability['master'], loc: string, after: string) =>
    w === 'armory' ? `in the ${loc} armory` : w === 'merchant' ? 'only from a random merchant (not something to count on)' : `from the ${loc} armory after ${after}`;
  return {
    master,
    second,
    note: `Master Seals: ${say(master, SEAL_RULES.masterSeal.location, 'Chapter 12')}. Second Seals: ${say(second, SEAL_RULES.secondSeal.location, 'Chapter 16')}.`,
  };
}

/** Seals held in inventories and the convoy. */
export function sealsHeld(items: readonly HeldItem[]): { master: number; second: number } {
  const count = (n: string) => items.filter((i) => i.item === n).reduce((a, i) => a + (i.uses ?? 1), 0);
  return { master: count('Master Seal'), second: count('Second Seal') };
}

// ---- the supply list ----

export type Supply = {
  readonly unit: string;
  readonly action: 'buy' | 'forge';
  readonly item: string;
  readonly forge?: ForgeLevels;
  readonly cost: number;
  /** Foes it turns into one-round kills. */
  readonly closes: number;
  readonly where?: string;
};

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome']);

/** The weapon kinds a class can use (SF class base stats). */
export function classWeaponKinds(cls: string): Set<string> {
  const id = classIdByName(cls);
  const b = id ? classBase(id, 'M') ?? classBase(id, 'F') : undefined;
  return new Set((b?.weapons ?? []).map((w) => w.replace(/s$/, '').replace('tome', 'tome')));
}

function classBase(id: ClassId, g: Gender): ClassBase | undefined {
  const e = CLASS_BASES[id];
  return e?.any ?? e?.[g];
}

const CLASS_ID = new Map<string, ClassId>((Object.keys(CLASSES) as ClassId[]).flatMap((id) => (['M', 'F'] as Gender[]).map((g) => [className(id, g), id] as const)));
export const classIdByName = (name: string): ClassId | undefined => CLASS_ID.get(name);

/**
 * Purchases and forges that close the solver's gaps (#122): for each deployed lead, the buy (a weapon the open armories
 * sell, of a kind its class uses) or forge (more Mt on a weapon it holds) that turns most foes it can't one-round into
 * one-round kills, cheapest per foe first, added while the gold lasts. Never more than the gold, never off the shelf.
 */
export function supplyList(input: {
  readonly leads: readonly { readonly c: DeployCandidate; readonly back: Fighter | undefined; readonly support: SupportLevel | null }[];
  readonly foes: readonly Foe[];
  readonly pool: (f: Foe) => readonly string[];
  readonly stock: readonly StockItem[];
  readonly forge: boolean;
  readonly gold: number;
}): Supply[] {
  const kills = (c: DeployCandidate, weapons: readonly NonNullable<Fighter['weapon']>[], back: Fighter | undefined, support: SupportLevel | null) =>
    input.foes.reduce((n, foe) => {
      const b = weapons.length ? bestWeapon(c.fighter, weapons, back, support, foe, input.pool(foe)) : undefined;
      return n + (b && (b.result.oneRounds || b.result.oneRoundsWithDualStrikes) ? (foe.boss ? 1 : foe.count) : 0);
    }, 0);
  const options: Supply[] = [];
  for (const { c, back, support } of input.leads) {
    const base = kills(c, c.weapons, back, support);
    const kinds = classWeaponKinds(c.fighter.className);
    const best: Supply[] = [];
    for (const s of input.stock) {
      const it = itemByName(s.item);
      if (!it || !WEAPON_KINDS.has(it.kind) || !(kinds.has(it.kind) || c.weapons.some((w) => w.item.kind === it.kind)) || s.cost === null) continue;
      const gain = kills(c, [...c.weapons, { item: it }], back, support) - base;
      if (gain > 0) best.push({ unit: c.fighter.name, action: 'buy', item: it.name, cost: s.cost, closes: gain, where: s.where });
    }
    if (input.forge)
      for (const w of c.weapons) {
        if (!w.item.forgeable) continue;
        const from = { mt: w.forge?.mt ?? 0, hit: (w.forge?.hit ?? 0) / FORGE.step.hit, crit: (w.forge?.crit ?? 0) / FORGE.step.crit };
        for (let mt = from.mt + 1; mt <= FORGE.maxPerStat; mt++) {
          const to = { ...from, mt };
          if (to.mt + to.hit + to.crit > FORGE.maxTotal) break;
          const forged: NonNullable<Fighter['weapon']> = { item: w.item, forge: { mt, hit: to.hit * FORGE.step.hit, crit: to.crit * FORGE.step.crit } };
          const gain = kills(c, [...c.weapons.filter((x) => x !== w), forged], back, support) - base;
          if (gain > 0) {
            best.push({ unit: c.fighter.name, action: 'forge', item: w.item.name, forge: to, cost: forgeCost(w.item, to, from), closes: gain });
            break;
          }
        }
      }
    best.sort((a, b) => a.cost / a.closes - b.cost / b.closes);
    if (best[0]) options.push(best[0]);
  }
  options.sort((a, b) => a.cost / a.closes - b.cost / b.closes);
  const out: Supply[] = [];
  let left = input.gold;
  for (const o of options) if (o.cost <= left) (out.push(o), (left -= o.cost));
  return out;
}

// ---- seals and promotions ----

export type PromotionAdvice = {
  readonly unit: string;
  readonly to: string;
  readonly advice: 'now' | 'later' | 'not yet';
  readonly why: string;
  /** Expected stats if it waits to level 20 and then promotes: average growths, not its real stats. */
  readonly expected?: Readonly<Record<Stat, number>>;
};

/**
 * Promote now or later (#122), judged against the map: a base-class unit at level 10+ is told to promote now when the
 * promotion's stat gains turn foes into one-round kills or survived rounds, else to wait for level 20. The expected
 * stats at level 20 come from average growths (the unit's personal growths plus its class's) and are labelled.
 */
export function promotionAdvice(input: {
  readonly c: DeployCandidate;
  readonly level: number;
  readonly promoted: boolean;
  readonly gender: Gender;
  readonly personalGrowths: Readonly<Record<Stat, number>> | undefined;
  readonly foes: readonly Foe[];
  readonly pool: (f: Foe) => readonly string[];
  readonly seals: SealAvailability;
  readonly held: number;
}): PromotionAdvice | undefined {
  const { c } = input;
  const id = classIdByName(c.fighter.className);
  if (!id || input.promoted || (CLASSES[id] as ClassData).tier !== 'base') return undefined;
  const targets = promotionsOf(id);
  const from = classBase(id, input.gender);
  if (!targets.length || !from) return undefined;
  const gainsOf = (t: ClassId) => {
    const to = classBase(t, input.gender);
    return to ? (Object.fromEntries(STATS.map((s) => [s, Math.max(0, to.stats[s] - from.stats[s])])) as Record<Stat, number>) : undefined;
  };
  const score = (stats: Readonly<Record<Stat, number>>) =>
    input.foes.reduce((n, foe) => {
      const b = c.weapons.length ? bestWeapon({ ...c.fighter, stats }, c.weapons, undefined, null, foe, input.pool(foe)) : undefined;
      return n + (b ? (b.result.oneRounds ? 2 : 0) + (b.result.survives ? 1 : 0) : 0);
    }, 0);
  const now = score(c.fighter.stats);
  let best: { t: ClassId; gain: number } | undefined;
  for (const t of targets) {
    const g = gainsOf(t);
    if (!g) continue;
    const promoted = Object.fromEntries(STATS.map((s) => [s, c.fighter.stats[s] + g[s]])) as Record<Stat, number>;
    const gain = score(promoted) - now;
    if (!best || gain > best.gain) best = { t, gain };
  }
  if (!best) return undefined;
  const to = className(best.t, input.gender);
  const classGrowth = (CLASSES[id] as ClassData).growths;
  const cg = ('male' in classGrowth ? (input.gender === 'M' ? classGrowth.male : classGrowth.female) : classGrowth) as Record<Stat, number | { assumption: string }>;
  const growth = (s: Stat) => (input.personalGrowths?.[s] ?? 0) + (typeof cg[s] === 'number' ? (cg[s] as number) : 0);
  const levels = Math.max(0, 20 - input.level);
  const g = gainsOf(best.t)!;
  const expected = Object.fromEntries(STATS.map((s) => [s, Math.round(c.fighter.stats[s] + (growth(s) / 100) * levels + g[s])])) as Record<Stat, number>;
  const canSeal = input.held > 0 || input.seals.master !== 'none';
  if (input.level < 10) return { unit: c.fighter.name, to, advice: 'not yet', why: `Promotion needs level 10 (it’s ${input.level}).`, expected };
  if (best.gain > 0 && canSeal)
    return { unit: c.fighter.name, to, advice: 'now', why: `Promoting to ${to} now wins ${best.gain} more matchup points on this map${input.held ? '' : ` (buy a Master Seal: ${input.seals.master === 'merchant' ? 'only from a random merchant' : 'in the armory'})`}.`, expected };
  return {
    unit: c.fighter.name,
    to,
    advice: 'later',
    why: best.gain > 0 ? 'Promoting would help here, but no Master Seal is held or on sale yet.' : `Promoting now doesn’t change this map; waiting to level 20 gains ${levels} levels of growth first.`,
    expected,
  };
}

