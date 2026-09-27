/**
 * Upkeep and the endpoint kit for the simulated runs (#190; spec #175, Gold, items and upkeep; research/gold-economy §3).
 *
 * Upkeep: a weapon spends one use on each hit, either phase (a brave weapon's two strikes are two), on the weapon that
 * hit; a physical miss is free and a tome's miss is the `tome-miss-use` assumption. A back's weapon pays for each of its
 * Dual Strikes (player phase only: on enemy phase a back guards, which is free). Armsthrift saves each use at Luck × 2%,
 * a back's Dual Strikes too, never a staff. A staff or potion spends one use each time it's used (the play's tally).
 * The play log names each fight but not its strikes, so they're read from the fight's matchup (the one the play fought
 * with): the lead strikes, each landing at the hit chance, until the hits that fell a fresh foe have landed (every
 * strike of its round when the foe lived). With a seeded stream the hits are drawn; without (the plan's projection)
 * the expected uses are counted.
 *
 * The endpoint kit: for each lead of the plan's endpoint lineup, the weapon the open armories sell that wins it most
 * endpoint matchups over what it owns (owned items first: one no better isn't bought), and that weapon forged to +5 Mt
 * (or, when nothing sold beats its own, its best owned weapon forged); and a Vulnerary for each deployed unit without a
 * potion. A piece's value is the matchups it wins (foes one-rounded and rounds survived, by count); a Vulnerary's is one.
 * A run short of gold buys the pieces with the most value per gold first (`kit-by-matchups-won`).
 */
import { FORGE, forgeCost, itemByName, type GameItem } from '../../game-data/items';
import type { Assumptions } from '../assumptions';
import { bestWeapon, type Fighter, type Foe, type SupportLevel } from '../solver';
import { classWeaponKinds, type StockItem } from '../supply';
import type { MapPlay, SimGroup, SimMap, SimUnit } from './map-play';
import type { Rng } from './random';
import type { SimItem } from './sustain';

export type Weapon = NonNullable<Fighter['weapon']>;

/** Uses spent on one map: by unit id, then by item name (weapons, staves and potions). */
export type MapUpkeep = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** What one fight's matchup says about the uses it spends: the weapon and strikes on each side. */
type Wear = {
  readonly weapon: Weapon | undefined;
  /** The lead's strikes in a round, and the hits that fell a fresh foe. */
  readonly strikes: number;
  readonly killHits: number;
  readonly hit: number;
  readonly tome: boolean;
  /** The chance each lead strike brings a Dual Strike, and the back's hit chance. */
  readonly dualStrike: number;
  readonly backHit: number;
};

const isTome = (w: Weapon | undefined) => !!w && w.item.kind === 'tome';

/** A group's wear against a foe, by the drawn Lunatic+ skills (the play's matchup), cached on the interned group. */
const WEARS = new WeakMap<SimGroup, WeakMap<Foe, Map<string, Wear>>>();
function wearOf(g: SimGroup, base: Foe, drawn: readonly string[]): Wear {
  let byFoe = WEARS.get(g);
  if (!byFoe) WEARS.set(g, (byFoe = new WeakMap()));
  let bySkills = byFoe.get(base);
  if (!bySkills) byFoe.set(base, (bySkills = new Map()));
  const k = drawn.join(',');
  let w = bySkills.get(k);
  if (!w) {
    const foe = drawn.length ? { ...base, skills: [...base.skills, ...drawn] } : base;
    const best = g.lead.weapons.length ? bestWeapon(g.lead.fighter, g.lead.weapons, g.back?.fighter, g.support, foe, []) : undefined;
    const m = best?.result;
    const weapon = best?.weapon;
    const strikes = m && weapon ? m.hits : 0;
    w = {
      weapon,
      strikes,
      killHits: m && m.damage > 0 ? Math.min(strikes, Math.ceil(foe.stats.hp / m.damage)) : strikes,
      hit: m ? m.hit / 100 : 0,
      tome: isTome(weapon),
      dualStrike: m && g.back?.fighter.weapon ? m.dualStrikeRate / 100 : 0,
      backHit: m ? m.backHit / 100 : 0,
    };
    bySkills.set(k, w);
  }
  return w;
}

/** Armsthrift's chance to save a use: Luck × 2%. */
const thrift = (u: SimUnit) => (u.fighter.skills.includes('Armsthrift') ? Math.min(1, (u.fighter.stats.lck * 2) / 100) : 0);

/** Fronts outside the lineup's groups, one object per (interned) lead, back and support, so their wear stays cached. */
const AD_HOC = new WeakMap<SimUnit, Map<string, SimGroup>>();
function adHocGroup(lead: SimUnit, back: SimUnit | undefined, support: SupportLevel | null): SimGroup {
  let m = AD_HOC.get(lead);
  if (!m) AD_HOC.set(lead, (m = new Map()));
  const k = back ? `${back.id}|${support ?? ''}` : '';
  let g = m.get(k);
  if (!g || (back && g.back !== back)) m.set(k, (g = { lead, ...(back ? { back } : {}), support }));
  return g;
}

/** The expected strikes a side makes of `strikes`, stopping once `need` have landed at `hit` each. */
function expectedStrikes(strikes: number, need: number, hit: number): number {
  // dist[k]: the chance k strikes have landed so far.
  let dist = [1];
  let total = 0;
  for (let i = 0; i < strikes; i++) {
    const going = dist.slice(0, need).reduce((a, p) => a + p, 0);
    total += going;
    const next = new Array<number>(dist.length + 1).fill(0);
    dist.forEach((p, k) => {
      if (k >= need) next[k]! += p;
      else {
        next[k + 1]! += p * hit;
        next[k]! += p * (1 - hit);
      }
    });
    dist = next;
  }
  return total;
}

/** Each map's foe groups by key. */
const FOES = new WeakMap<SimMap, Map<string, Foe>>();
function foesOf(map: SimMap): Map<string, Foe> {
  let m = FOES.get(map);
  if (!m) FOES.set(map, (m = new Map([...map.foes, ...map.waves.flatMap((w) => w.groups)].map((g) => [g.key, g.foe]))));
  return m;
}

/**
 * The uses one play spent (see the module comment): drawn from `rng`, or expected without it. Units are the lineup's;
 * a fight whose lead and back aren't a lineup group (a stance apart) wears as that unit alone or that pair.
 */
export function mapUpkeep(map: SimMap, play: MapPlay, lineup: readonly SimGroup[], rng: Rng | null, tomeMiss: Assumptions['tome-miss-use']): MapUpkeep {
  const out = new Map<string, Map<string, number>>();
  const add = (unit: string, item: string, n: number) => {
    if (n <= 0) return;
    let m = out.get(unit);
    if (!m) out.set(unit, (m = new Map()));
    m.set(item, (m.get(item) ?? 0) + n);
  };
  const units = new Map<string, SimUnit>();
  const groups = new Map<string, SimGroup>();
  const supports = new Map<string, SupportLevel | null>();
  for (const g of lineup) {
    for (const u of [g.lead, g.back]) if (u) units.set(u.id, u);
    groups.set(`${g.lead.id}|${g.back?.id ?? ''}`, g);
    if (g.back) supports.set(`${g.back.id}|${g.lead.id}`, g.support);
  }
  // A front the lineup doesn't list as a group (#183's stances: a unit apart, or the pair switched with its back in
  // front): that unit alone, or that pair at the lineup pair's support.
  const groupOf = (lead: string, back: string | undefined): SimGroup | undefined => {
    const k = `${lead}|${back ?? ''}`;
    const listed = groups.get(k);
    if (listed) return listed;
    const l = units.get(lead);
    const b = back ? units.get(back) : undefined;
    if (!l) return undefined;
    const g = adHocGroup(l, b, b ? (supports.get(k) ?? null) : null);
    groups.set(k, g);
    return g;
  };
  const foes = foesOf(map);
  const freeMiss = tomeMiss === 'free';
  /** A strike's uses: one when it lands (or misses with a tome, per the rule), less Armsthrift's save. */
  const cost = (hit: number, tome: boolean, save: number) => (tome && !freeMiss ? 1 : hit) * (1 - save);
  const draw = (hit: number, tome: boolean, save: number): { lands: boolean; used: number } => {
    const lands = rng!.next() < hit;
    return { lands, used: (lands || (tome && !freeMiss)) && !(save > 0 && rng!.next() < save) ? 1 : 0 };
  };
  for (const turn of play.log)
    for (const f of turn.fights) {
      const g = groupOf(f.lead, f.back);
      const foe = foes.get(f.foe);
      if (!g || !foe) continue;
      const w = wearOf(g, foe, play.skills[f.foe] ?? []);
      if (!w.weapon) continue;
      // The lead strikes until the hits that fell the foe have landed (all its strikes when it lived).
      const need = f.kill ? w.killHits : w.strikes;
      const back = g.back;
      const bw = f.phase === 'player' && w.dualStrike > 0 ? back?.fighter.weapon : undefined;
      const save = thrift(g.lead);
      const backSave = back ? thrift(back) : 0;
      let lead = 0;
      let duals = 0;
      if (rng) {
        for (let i = 0, landed = 0; i < w.strikes && landed < need; i++) {
          const s = draw(w.hit, w.tome, save);
          lead += s.used;
          if (s.lands) landed++;
          // Each lead strike may bring a Dual Strike (player phase), on the back's weapon.
          if (bw && rng.next() < w.dualStrike) duals += draw(w.backHit, isTome(bw), backSave).used;
        }
      } else {
        const strikes = expectedStrikes(w.strikes, need, w.hit);
        lead = strikes * cost(w.hit, w.tome, save);
        if (bw) duals = strikes * w.dualStrike * cost(w.backHit, isTome(bw), backSave);
      }
      add(g.lead.id, w.weapon.item.name, lead);
      if (bw && back) add(back.id, bw.item.name, duals);
    }
  for (const [id, t] of Object.entries(play.units)) for (const [item, n] of Object.entries(t.used)) add(id, item, n);
  return out;
}

// ---- the endpoint kit ----

/** One piece of the endpoint kit. */
export type KitPiece = {
  readonly unit: string;
  readonly action: 'buy' | 'forge';
  readonly item: GameItem;
  readonly cost: number;
  /** The endpoint matchups it wins (a Vulnerary's is 1). */
  readonly value: number;
  /** A forge of a weapon the kit buys: that piece's index, bought first. */
  readonly after?: number;
};

/** A Vulnerary's value in matchups: one survived round. */
export const VULNERARY_VALUE = 1;
/** The kit forges its weapons to +5 Mt. */
export const KIT_FORGE_MT = 5;

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/** The same weapon forged to +5 Mt (its Hit and Crit forges kept): one object per weapon, so the runs share it. */
const FORGED = new WeakMap<Weapon, Weapon>();
export function forgedWeapon(w: Weapon): Weapon {
  let f = FORGED.get(w);
  if (!f) FORGED.set(w, (f = { item: w.item, forge: { mt: KIT_FORGE_MT, hit: w.forge?.hit ?? 0, crit: w.forge?.crit ?? 0 } }));
  return f;
}

/** A new weapon off the shelf: one object per item. */
const FRESH = new Map<GameItem, Weapon>();
export const freshWeapon = (item: GameItem): Weapon => FRESH.get(item) ?? (FRESH.set(item, { item }), FRESH.get(item)!);

const forgeLevels = (w: Weapon) => ({ mt: w.forge?.mt ?? 0, hit: (w.forge?.hit ?? 0) / FORGE.step.hit, crit: (w.forge?.crit ?? 0) / FORGE.step.crit });

/** The cost of forging a weapon to +5 Mt; undefined when it can't be (not forgeable, already there, or over the total). */
export function kitForgeCost(w: Weapon): number | undefined {
  const from = forgeLevels(w);
  const to = { ...from, mt: KIT_FORGE_MT };
  if (!w.item.forgeable || from.mt >= KIT_FORGE_MT || to.mt + to.hit + to.crit > FORGE.maxTotal) return undefined;
  return forgeCost(w.item, to, from);
}

/**
 * The endpoint kit for a lineup (see the module comment): `leads` are its pairs' leads and units alone, `deployed` every
 * unit fielded; `foes` the endpoint's foe groups; `stock` what the open armories sell there.
 */
export function endpointKit(input: {
  readonly leads: readonly { readonly unit: string; readonly fighter: Fighter; readonly weapons: readonly Weapon[]; readonly back: Fighter | undefined; readonly support: SupportLevel | null }[];
  readonly deployed: readonly { readonly unit: string; readonly items: readonly SimItem[] }[];
  readonly foes: readonly Foe[];
  readonly stock: readonly StockItem[];
}): KitPiece[] {
  const pieces: KitPiece[] = [];
  const score = (l: (typeof input.leads)[number], weapons: readonly Weapon[]) =>
    input.foes.reduce((n, foe) => {
      const b = weapons.length ? bestWeapon(l.fighter, weapons, l.back, l.support, foe, []) : undefined;
      return n + (b ? ((b.result.oneRounds || b.result.oneRoundsWithDualStrikes ? 1 : 0) + (b.result.survives ? 1 : 0)) * (foe.boss ? 1 : foe.count) : 0);
    }, 0);
  const sold = input.stock.flatMap((s) => {
    const item = itemByName(s.item);
    return item && s.cost !== null && WEAPON_KINDS.has(item.kind) ? [{ item, cost: s.cost }] : [];
  });
  for (const l of input.leads) {
    const base = score(l, l.weapons);
    const kinds = classWeaponKinds(l.fighter.className);
    // The weapon sold that wins most once forged (then unforged), the cheaper on a tie.
    let buy: { weapon: Weapon; cost: number; gain: number; forge: number | undefined; forged: number } | undefined;
    for (const s of sold) {
      if (!kinds.has(s.item.kind) && !l.weapons.some((w) => w.item.kind === s.item.kind)) continue;
      const weapon = freshWeapon(s.item);
      const gain = score(l, [...l.weapons, weapon]) - base;
      const forge = kitForgeCost(weapon);
      const forged = forge === undefined ? gain : score(l, [...l.weapons, forgedWeapon(weapon)]) - base;
      const better = !buy || forged > buy.forged || (forged === buy.forged && (gain > buy.gain || (gain === buy.gain && s.cost < buy.cost)));
      if (forged > 0 && better) buy = { weapon, cost: s.cost, gain, forge, forged };
    }
    if (buy) {
      pieces.push({ unit: l.unit, action: 'buy', item: buy.weapon.item, cost: buy.cost, value: buy.gain });
      if (buy.forge !== undefined && buy.forged > buy.gain) pieces.push({ unit: l.unit, action: 'forge', item: buy.weapon.item, cost: buy.forge, value: buy.forged - buy.gain, after: pieces.length - 1 });
      continue;
    }
    // Nothing sold beats what it owns: forge the owned weapon that wins most.
    let forge: { item: GameItem; cost: number; gain: number } | undefined;
    for (const w of l.weapons) {
      const cost = kitForgeCost(w);
      if (cost === undefined) continue;
      const gain = score(l, l.weapons.map((x) => (x === w ? forgedWeapon(w) : x))) - base;
      if (gain > 0 && (!forge || gain > forge.gain)) forge = { item: w.item, cost, gain };
    }
    if (forge) pieces.push({ unit: l.unit, action: 'forge', item: forge.item, cost: forge.cost, value: forge.gain });
  }
  const vulnerary = input.stock.find((s) => s.item === 'Vulnerary' && s.cost !== null);
  const potion = itemByName('Vulnerary');
  if (vulnerary && potion)
    for (const d of input.deployed)
      if (!d.items.some((i) => i.item.kind === 'item' && /Vulnerary|Concoction|Elixir/.test(i.item.name))) pieces.push({ unit: d.unit, action: 'buy', item: potion, cost: vulnerary.cost!, value: VULNERARY_VALUE });
  return pieces;
}

/**
 * The pieces a run buys with `gold` (`kit-by-matchups-won`): again and again, the affordable piece with the most value
 * per gold, a forge together with its weapon while that isn't bought (their value and cost summed); a piece worth
 * nothing on its own is bought only that way. Returns the indexes bought, in buying order.
 */
export function buyDown(pieces: readonly KitPiece[], gold: number): number[] {
  const bought = new Set<number>();
  const out: number[] = [];
  let left = gold;
  for (;;) {
    let best: { take: number[]; ratio: number } | undefined;
    pieces.forEach((p, i) => {
      if (bought.has(i)) return;
      const take = p.after !== undefined && !bought.has(p.after) ? [p.after, i] : [i];
      const value = take.reduce((a, j) => a + pieces[j]!.value, 0);
      const cost = take.reduce((a, j) => a + pieces[j]!.cost, 0);
      const ratio = value / Math.max(1, cost);
      if (value > 0 && cost <= left && (!best || ratio > best.ratio)) best = { take, ratio };
    });
    if (!best) return out;
    for (const j of best.take) {
      bought.add(j);
      out.push(j);
      left -= pieces[j]!.cost;
    }
  }
}
