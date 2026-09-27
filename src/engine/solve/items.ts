/**
 * The seed's item plan (#193; spec #175, Gold, items and upkeep): each held item's planned use, placed greedily where
 * it lifts the flawless chance most, by a cheap proxy the local search (#199) refines on the flawless chance itself.
 *
 * The proxy is the seed's own: **matchups won** (`matchupWon`, graded) against the endpoint's foes (by count, waves
 * included), weighted by the share of the maps still to play that the use lasts for. So a booster goes where its +2
 * (+5 HP) wins the most there, as the unit stands now (its recorded stats, or a recruit's join stats) clamped at its
 * caps, as early as it can drink it (the first map with a preparation phase, from the item's arrival and the unit's
 * joining); each one placed raises that unit's stat for the next. Only the wishlist's units (the endpoint's lineup) are
 * candidates, and a child not yet recruited isn't one (its stats are read from its parents on entry: the open rule
 * `booster-to-child`). A booster that wins nothing anywhere goes to the wishlist unit with the most room under its cap.
 *
 * Tonics are seeded on the endpoint only (it has a preparation phase and a lineup the wishlist names): each lead or
 * unit alone there takes the tonic whose +2 (+5 HP) wins it the most at its caps (tonics pass the cap), a held one
 * first, else one the endpoint's armories sell (bought through the shopping list). The search places them on other maps.
 *
 * A weapon in the convoy or picked up ahead gets a carrier: the wishlist unit, able to wield its kind, whose matchups it
 * lifts most over its own weapons, from the first map it can be handed over; none if it lifts nobody's. A unit's own
 * weapon stays with it. Boots and the Arms Scroll get none (Boots stay outside the model; no rank is known to lock a
 * weapon).
 *
 * Pins override the seed: a booster pin gives the first copy of its item to its unit (on its map, else the first it
 * can drink it on), Boots included; a carrier pin hands the first copy of its weapon to its unit from its map on,
 * replacing the seed's carriers from there.
 */
import { TONICS, statItemGain, type GameItem } from '../../game-data/items';
import type { Stat } from '../../game-data/stats';
import type { Assumptions } from '../assumptions';
import { className } from '../classes';
import { hasPreparations, statOfItem, type PlanSource } from '../item-plan';
import type { RosterUnit } from '../roster';
import { matchup, type Fighter, type Foe } from '../solver';
import { classWeaponKinds } from '../supply';
import { effectiveCaps, type ceilingArmy } from '../sim/ceiling';
import type { ArmyUnit, RunSimInput } from '../sim/run-sim';
import type { PlanItem, PlanPin } from './plan';
import { matchupWon } from './seed';

type Weapon = NonNullable<Fighter['weapon']>;

/** A unit as the proxy reads it: its stats now, caps, weapons, and the map index it can first use an item on. */
type Candidate = { readonly id: RosterUnit; readonly base: ArmyUnit; readonly stats: Record<Stat, number>; readonly caps: Record<Stat, number>; readonly from: number };

const RANKS = new Set(['E', 'D', 'C', 'B', 'A', 'S']);

/**
 * The item plan the seed proposes for a run (see the module comment): `army` is the endpoint's army at its full build
 * and its lineup, the wishlist (`ceilingArmy`).
 */
export function seedItems(input: RunSimInput, sources: readonly PlanSource[], army: ReturnType<typeof ceilingArmy>, pins: readonly PlanPin[], assumptions: Assumptions): PlanItem[] {
  const maps = input.maps;
  const wishlist: readonly RosterUnit[] = army?.lineup.deployed ?? [];
  const n = maps.length;
  const end = maps[n - 1];
  if (!end) return [];
  const indexOf = new Map(maps.map((m, i) => [m.key, i]));
  const prep = (i: number) => i < n && !maps[i]!.noPreparations && hasPreparations(maps[i]!.map.id);
  /** The first map at or after `i` with a preparation phase; n when none. */
  const prepFrom = (i: number) => {
    let j = Math.max(0, i);
    while (j < n && !prep(j)) j++;
    return j;
  };
  const arrival = (s: PlanSource) => (s.after ? (indexOf.get(s.after) ?? n) + 1 : 0);

  // Candidates: the wishlist's units with stats (in the army now, or recruits), from the map they're in the army for.
  const known = new Map<RosterUnit, { a: ArmyUnit; from: number }>();
  for (const a of input.army) known.set(a.id, { a, from: 0 });
  maps.forEach((m, i) => {
    for (const a of m.joining) if (!known.has(a.id)) known.set(a.id, { a, from: i });
    for (const a of m.later) if (!known.has(a.id)) known.set(a.id, { a, from: i + 1 });
  });
  const candidates: Candidate[] = wishlist.flatMap((id) => {
    const k = known.get(id);
    return k ? [{ id, base: k.a, stats: { ...k.a.stats }, caps: effectiveCaps(k.a.classId, k.a.gender, k.a.modifiers, k.a.skills), from: k.from }] : [];
  });

  // The endpoint's foes, weighted by count (a boss once).
  const foes: { foe: Foe; pool: readonly string[]; weight: number }[] = [...end.map.foes, ...end.map.waves.flatMap((w) => w.groups)].map((g) => ({ foe: g.foe, pool: g.pool ?? [], weight: g.foe.boss ? 1 : Math.max(1, g.foe.count) }));
  const won = (name: string, cls: string, stats: Readonly<Record<Stat, number>>, skills: readonly string[], weapons: readonly Weapon[]): number => {
    let total = 0;
    for (const f of foes) {
      let best = 0;
      for (const weapon of weapons) {
        best = Math.max(best, matchupWon(matchup({ name, className: cls, stats, skills, weapon }, undefined, null, f.foe, f.pool), f.foe));
        if (best >= 1) break;
      }
      total += best * f.weight;
    }
    return total;
  };
  const clsOf = (c: Candidate) => className(c.base.classId, c.base.gender);
  /** The share of the maps still to play from map index `i` on. */
  const lasting = (i: number) => (i >= n ? 0 : (n - i) / n);

  const out: PlanItem[] = [];
  const keyAt = (i: number) => maps[Math.min(i, n - 1)]!.key;

  // Boosters, in arrival order: each where it wins the most, as early as its unit can drink it.
  const boosterGain = new Map<string, number>();
  const gainOf = (c: Candidate, stat: Stat): number => {
    const k = `${c.id}|${stat}|${c.stats[stat]}`;
    let g = boosterGain.get(k);
    if (g === undefined) {
      const up = { ...c.stats, [stat]: Math.min(c.caps[stat], c.stats[stat] + statItemGain(stat)) };
      g = up[stat] === c.stats[stat] ? 0 : won(c.base.name, clsOf(c), up, c.base.skills, c.base.weapons) - won(c.base.name, clsOf(c), c.stats, c.base.skills, c.base.weapons);
      boosterGain.set(k, g);
    }
    return g;
  };
  const pinnedSources = new Set<string>();
  const pinFor = (s: PlanSource) => pins.find((p): p is Extract<PlanPin, { kind: 'booster' | 'carrier' }> => (p.kind === 'booster' || p.kind === 'carrier') && p.item === s.item && !pinnedSources.has(s.id));
  const byArrival = [...sources].filter((s) => !s.uncounted).sort((a, b) => arrival(a) - arrival(b));

  for (const s of byArrival) {
    if (s.kind !== 'booster' && s.kind !== 'boots') continue;
    const pin = pinFor(s);
    if (pin?.kind === 'booster') {
      pinnedSources.add(s.id);
      const unitFrom = known.get(pin.unit)?.from ?? 0;
      const at = pin.key ?? keyAt(prepFrom(Math.max(arrival(s), unitFrom)));
      out.push({ item: s.item, unit: pin.unit, key: at, source: s.id });
      continue;
    }
    if (s.kind === 'boots') continue;
    const stat = statOfItem(s.item)!;
    let best: { c: Candidate; value: number; at: number } | undefined;
    for (const c of candidates) {
      const at = prepFrom(Math.max(arrival(s), c.from));
      if (at >= n) continue;
      const value = gainOf(c, stat) * lasting(at);
      if (value > (best?.value ?? 0) + 1e-9) best = { c, value, at };
    }
    if (!best) {
      // Nothing wins more: the unit with the most room under its cap, when there's any.
      for (const c of candidates) {
        const at = prepFrom(Math.max(arrival(s), c.from));
        const room = c.caps[stat] - c.stats[stat];
        if (at < n && room > 0 && room > (best?.value ?? 0)) best = { c, value: room, at };
      }
    }
    if (!best) continue;
    best.c.stats[stat] = Math.min(best.c.caps[stat], best.c.stats[stat] + statItemGain(stat));
    out.push({ item: s.item, unit: best.c.id, key: keyAt(best.at), source: s.id });
  }

  // Weapons: a carrier for each one in the convoy or picked up ahead, where it lifts a wishlist unit's matchups most.
  const weaponGain = new Map<string, number>();
  const ownWon = new Map<RosterUnit, number>();
  for (const s of byArrival) {
    if (s.kind !== 'weapon' || !s.weapon) continue;
    const pin = pinFor(s);
    const pinAt = pin?.kind === 'carrier' ? (indexOf.get(pin.key) ?? n) : n;
    if (pin?.kind === 'carrier') pinnedSources.add(s.id);
    const item: GameItem = s.weapon.item;
    let best: { c: Candidate; value: number; at: number } | undefined;
    if (!s.holder) {
      for (const c of candidates) {
        if (!RANKS.has(item.rank ?? '') || !classWeaponKinds(clsOf(c)).has(item.kind)) continue;
        const at = prepFrom(Math.max(arrival(s), c.from));
        if (at >= Math.min(n, pinAt)) continue;
        const k = `${c.id}|${item.name}`;
        let g = weaponGain.get(k);
        if (g === undefined) {
          let own = ownWon.get(c.id);
          if (own === undefined) ownWon.set(c.id, (own = won(c.base.name, clsOf(c), c.base.stats, c.base.skills, c.base.weapons)));
          weaponGain.set(k, (g = won(c.base.name, clsOf(c), c.base.stats, c.base.skills, [...c.base.weapons, s.weapon]) - own));
        }
        const value = g * lasting(at);
        if (value > (best?.value ?? 0) + 1e-9) best = { c, value, at };
      }
    }
    if (best) out.push({ item: s.item, unit: best.c.id, key: keyAt(best.at), source: s.id });
    if (pin?.kind === 'carrier') out.push({ item: s.item, unit: pin.unit, key: pin.key, source: s.id });
  }

  // Tonics on the endpoint, when it has a preparation phase: each fielded unit's best, at its caps.
  const last = n - 1;
  if (prep(last) && assumptions['item-in-preparations'] === 'free') {
    const sold = new Set((end.armory ?? []).map((a) => a.item));
    const heldTonics = byArrival.filter((s) => s.kind === 'tonic' && arrival(s) <= last);
    const fielded = army ? [...army.lineup.pairs.map((p) => p.lead), ...army.lineup.solo] : [];
    for (const id of fielded) {
      const c = army!.fielded.find((f) => f.unit === id);
      if (!c) continue;
      const cls = c.fighter.className;
      const base = won(c.fighter.name, cls, c.fighter.stats, c.fighter.skills, c.weapons);
      let best: { name: string; gain: number } | undefined;
      for (const [name, stat] of Object.entries(TONICS) as [string, Stat][]) {
        if (!sold.has(name) && !heldTonics.some((s) => s.item === name)) continue;
        const gain = won(c.fighter.name, cls, { ...c.fighter.stats, [stat]: c.fighter.stats[stat] + statItemGain(stat) }, c.fighter.skills, c.weapons) - base;
        if (gain > (best?.gain ?? 0) + 1e-9) best = { name, gain };
      }
      if (!best) continue;
      const k = heldTonics.findIndex((s) => s.item === best!.name);
      const source = k >= 0 ? heldTonics.splice(k, 1)[0]!.id : 'buy';
      out.push({ item: best.name, unit: id, key: end.key, source });
    }
  }
  // In map order, then as placed.
  return out.map((p, i) => ({ p, i })).sort((a, b) => (indexOf.get(a.p.key) ?? n) - (indexOf.get(b.p.key) ?? n) || a.i - b.i).map((x) => x.p);
}

