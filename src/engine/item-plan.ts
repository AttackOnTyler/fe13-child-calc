/**
 * The item plan (#193; spec #175, Gold, items and upkeep; the grilling in #166): every held item the plan can spend —
 * stat boosters, tonics, weapons, Boots and the Arms Scroll — owned now or arriving on a map still to play, and its
 * **planned use**: a unit and a map for a booster or tonic, a **carrier** from a map on for a weapon (the plan's
 * `PlanItem`s). The seed places them (`solve/items.ts`), the flawless chance plays them (`run-sim.ts`), and each use
 * reports its **arrival chance**: the share of runs that made it.
 *
 * - Only Bullion is sold (#190): every other item is held. One with no planned use shows what it would sell for.
 * - An item picked up on a map arrives after it: for sure, or with a side goal's part (a Thief caught, a village
 *   visited), only in the runs that secure it. An item only other play decides (a Thief looting one chest, a talk choice)
 *   isn't counted, as its gold isn't (#191).
 * - A weapon in a unit's inventory stays with it unless the plan hands it on; only weapons no armory sells (reward and
 *   dropped ones) are listed, with those in the convoy and those picked up ahead.
 * - Boots stay outside the model (no movement): "your call", with a pin to assign them. The Arms Scroll counts only where
 *   a rank unlocks a weapon on the route or in the kit; weapon ranks aren't recorded, so it never does yet.
 * - Items are used in a map's preparations; the early forced maps have none (`NO_PREPARATIONS`).
 */
import { MAPS, NO_PREPARATIONS, type MapItemRow } from '../game-data/chapters';
import { STAT_BOOSTERS, TONICS, itemByName, sellPrice, type GameItem } from '../game-data/items';
import type { Stat } from '../game-data/stats';
import type { RosterUnit } from './roster';
import type { HeldItem, Run, Snapshot } from './run';
import type { SideGoalChoice } from './side-goals';
import type { ItemFind, ItemSource, SimItemUse } from './sim/run-sim';
import type { ItemPin, PlanItem, PlanPin } from './solve/plan';
import { openStock } from './supply';

/** What the item plan does with a held item. */
export type HeldKind = 'booster' | 'tonic' | 'weapon' | 'boots' | 'scroll';

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/** A held item's kind in the plan; undefined for anything else (Bullion, seals, staves, potions, keys). */
export function heldKind(name: string): HeldKind | undefined {
  const item = itemByName(name);
  if (!item) return undefined;
  if (STAT_BOOSTERS[item.name]) return 'booster';
  if (TONICS[item.name]) return 'tonic';
  if (item.name === 'Boots') return 'boots';
  if (item.name === 'Arms Scroll') return 'scroll';
  return WEAPON_KINDS.has(item.kind) ? 'weapon' : undefined;
}

/** The stat a booster or tonic raises. */
export const statOfItem = (name: string): Stat | undefined => {
  const item = itemByName(name);
  return item ? (STAT_BOOSTERS[item.name] ?? TONICS[item.name]) : undefined;
};

/** A held item the plan can spend: owned now, or picked up on a map still to play. */
export type PlanSource = ItemSource & {
  readonly kind: HeldKind;
  /** The map key it arrives after; absent: held now. */
  readonly after?: string;
  /** The side goal it arrives with, when only chasing that goal secures it (`part` is the goal's part). */
  readonly goal?: string;
  readonly part?: string;
  /** How the map gives it (the chapter data's). */
  readonly how?: string;
  /** Other play decides it (a looting Thief, a talk choice): it isn't counted, and the note says why. */
  readonly uncounted?: string;
};

let SOLD: ReadonlySet<string> | undefined;
/** Items some armory sells, somewhere on the route. */
const soldAnywhere = (): ReadonlySet<string> => (SOLD ??= new Set(openStock(new Set(MAPS.map((m) => m.id))).armory.map((s) => s.item)));

/** One row's copies: `Vulnerary (×2)` is two. */
function rowCopies(r: MapItemRow): { name: string; count: number } {
  const m = /^(.*?) \(×(\d+)\)$/.exec(r.item);
  return m ? { name: m[1]!, count: Number(m[2]) } : { name: r.item, count: 1 };
}

const weaponOf = (item: GameItem, h?: HeldItem) => ({ item, ...(h?.forge ? { forge: { mt: h.forge.mt, hit: h.forge.hit, crit: h.forge.crit } } : {}) });

/**
 * The held items of a run (see the module comment): those in the snapshot (convoy and inventories), then each map's
 * pick-ups along `steps`, each copy once with a stable id (`held:<holder or convoy>:<item>#n`, `<key>:<item>#n`).
 */
export function itemSources(snap: Snapshot, steps: readonly { readonly key: string; readonly map: string }[], choices: readonly SideGoalChoice[]): PlanSource[] {
  const out: PlanSource[] = [];
  const counts = new Map<string, number>();
  const idOf = (prefix: string, name: string) => {
    const k = `${prefix}:${name}`;
    const n = counts.get(k) ?? 0;
    counts.set(k, n + 1);
    return `${k}#${n}`;
  };
  const held = (h: HeldItem, holder?: RosterUnit) => {
    const item = itemByName(h.item);
    const kind = item && heldKind(item.name);
    if (!item || !kind) return;
    if (kind === 'weapon') {
      // A unit's own weapon is listed only when no armory sells it (a reward or a drop).
      if (holder && soldAnywhere().has(item.name)) return;
      out.push({ id: idOf(`held:${holder ?? 'convoy'}`, item.name), item: item.name, kind, weapon: weaponOf(item, h), ...(h.uses !== null ? { uses: h.uses } : {}), ...(holder ? { holder } : {}) });
      return;
    }
    out.push({ id: idOf('held', item.name), item: item.name, kind });
  };
  for (const h of snap.convoy) held(h);
  for (const [u, s] of Object.entries(snap.units) as [RosterUnit, Snapshot['units'][RosterUnit]][]) for (const h of s?.inventory ?? []) held(h, u);
  for (const step of steps) {
    const data = MAPS.find((m) => m.id === step.map);
    if (!data) continue;
    const goals = choices.filter((c) => c.goal.map === step.map);
    for (const r of data.items) {
      const { name, count } = rowCopies(r);
      const item = itemByName(name);
      const kind = item && heldKind(item.name);
      if (!item || !kind) continue;
      const goal = goals.find((c) => c.goal.parts.some((p) => p.rows.includes(r)));
      const part = goal ? goal.goal.parts.findIndex((p) => p.rows.includes(r)) : -1;
      for (let i = 0; i < count; i++)
        out.push({
          id: idOf(step.key, item.name),
          item: item.name,
          kind,
          after: step.key,
          how: r.how,
          ...(kind === 'weapon' ? { weapon: weaponOf(item), ...(item.uses ? { uses: item.uses } : {}) } : {}),
          ...(goal ? { goal: goal.goal.id, part: `${goal.goal.id}#${part}` } : r.play ? { uncounted: r.play.note } : {}),
        });
    }
  }
  return out;
}

/** The simulation's held items at the start and each map's finds (#193): the counted sources only. */
export function simItems(sources: readonly PlanSource[], keys: readonly string[]): { held: ItemSource[]; finds: Map<string, ItemFind[]> } {
  const sim = (s: PlanSource): ItemFind => ({ id: s.id, item: s.item, ...(s.weapon ? { weapon: s.weapon } : {}), ...(s.uses !== undefined ? { uses: s.uses } : {}), ...(s.holder ? { holder: s.holder } : {}), ...(s.part ? { part: s.part } : {}) });
  const held = sources.filter((s) => !s.after).map(sim);
  const finds = new Map<string, ItemFind[]>(keys.map((k) => [k, []]));
  for (const s of sources) if (s.after && !s.uncounted) finds.get(s.after)?.push(sim(s));
  return { held, finds };
}

/** A plan's item uses on a map (#193), as the simulation makes them: Boots and the Arms Scroll move nothing. */
export function simUses(items: readonly PlanItem[], key: string): SimItemUse[] {
  const KIND = { booster: 'booster', tonic: 'tonic', weapon: 'carry' } as const;
  return items.flatMap((p) => {
    const kind = p.key === key ? heldKind(p.item) : undefined;
    return kind === 'booster' || kind === 'tonic' || kind === 'weapon' ? [{ kind: KIND[kind], item: p.item, unit: p.unit, source: p.source }] : [];
  });
}

/** Whether a map has a preparation phase: every map but the early forced ones. */
export const hasPreparations = (map: string): boolean => !NO_PREPARATIONS.has(map);

/** What a held item sells for at full uses (0: it can't be sold). */
export const itemSellPrice = (name: string): number => {
  const item = itemByName(name);
  return item ? sellPrice(item) : 0;
};

// ---- the item plan as the Run view and the preparation page read it ----

/** Why a held item has no planned use. */
export type ItemIdle = 'outside-model' | 'no-rank' | 'uncounted' | 'no-gain';

/** One row of the item plan (#193): a held item, its planned use (a weapon's carrier timeline), and its arrival chance. */
export type ItemPlanRow = {
  readonly source: string;
  readonly item: string;
  readonly kind: HeldKind;
  /** The map key it arrives after; absent: held now (by `holder`, else in the convoy or an inventory). */
  readonly after?: string;
  readonly holder?: RosterUnit;
  /** How its map gives it, and the side goal it arrives with. */
  readonly how?: string;
  readonly goal?: string;
  /** Its planned uses in map order: one for a booster or tonic, each handover for a weapon. Empty: none. */
  readonly uses: readonly PlanItem[];
  /** A pin set its use. */
  readonly pinned: boolean;
  /**
   * The share of the simulated runs that made its first use (the item held by then): its arrival chance. Undefined
   * without a flawless chance, or when no run gets there.
   */
  readonly arrival: number | undefined;
  /** Why it has none: Boots (outside the model), the Arms Scroll (no rank locks a weapon), other play, or no gain. */
  readonly idle?: ItemIdle;
  /** Its sell price at full uses, for an item with no use (0: it can't be sold). */
  readonly sell: number;
  /** The play that decides an uncounted item. */
  readonly note?: string;
};

/** Tonics the plan buys on a map (#193): how many, and their gold at the armory price. */
export type TonicBuys = { readonly key: string; readonly count: number; readonly gold: number };

export type ItemPlan = { readonly rows: readonly ItemPlanRow[]; readonly tonics: readonly TonicBuys[] };

/** The use forecasts a flawless chance reports (`RunSim.items`), as the item plan reads them. */
type UseShares = readonly { readonly key: string; readonly source: string; readonly share: number | undefined }[];

const pinOf = (pins: readonly PlanPin[], p: PlanItem) =>
  pins.some((x) => (x.kind === 'booster' && x.item === p.item && x.unit === p.unit && (!x.key || x.key === p.key)) || (x.kind === 'carrier' && x.item === p.item && x.unit === p.unit && x.key === p.key));

/** The item plan of a plan over its held items (see the module comment), with arrival chances when `shares` is given. */
export function itemPlanOf(sources: readonly PlanSource[], items: readonly PlanItem[], shares?: UseShares, pins: readonly PlanPin[] = []): ItemPlan {
  const rows = sources.map((s): ItemPlanRow => {
    const uses = items.filter((p) => p.source === s.id);
    const first = uses[0];
    const arrival = first && shares ? shares.find((x) => x.key === first.key && x.source === s.id)?.share : undefined;
    const idle: ItemIdle | undefined = uses.length ? undefined : s.kind === 'boots' ? 'outside-model' : s.kind === 'scroll' ? 'no-rank' : s.uncounted ? 'uncounted' : 'no-gain';
    return {
      source: s.id,
      item: s.item,
      kind: s.kind,
      ...(s.after ? { after: s.after } : {}),
      ...(s.holder ? { holder: s.holder } : {}),
      ...(s.how ? { how: s.how } : {}),
      ...(s.goal ? { goal: s.goal } : {}),
      uses,
      pinned: uses.some((p) => pinOf(pins, p)),
      arrival,
      ...(idle ? { idle } : {}),
      sell: itemSellPrice(s.item),
      ...(s.uncounted ? { note: s.uncounted } : {}),
    };
  });
  const tonics = new Map<string, { count: number; gold: number }>();
  for (const p of items) {
    if (p.source !== 'buy') continue;
    const t = tonics.get(p.key) ?? { count: 0, gold: 0 };
    tonics.set(p.key, { count: t.count + 1, gold: t.gold + (itemByName(p.item)?.worth ?? 0) });
  }
  return { rows, tonics: [...tonics].map(([key, t]) => ({ key, ...t })) };
}

/** One thing to do in a map's preparations (#193): drink a booster or tonic, or hand a weapon over. */
export type BeforeMapItem = {
  readonly kind: 'booster' | 'tonic' | 'handover' | 'boots';
  readonly item: string;
  readonly unit: RosterUnit;
  /** A tonic to buy first (none held). */
  readonly buy?: boolean;
  /** A handover's giver: the unit holding it, or the convoy. */
  readonly from?: RosterUnit | 'convoy';
};

/** A plan's "before this map" list for a map key (#193): boosters, tonics and handovers, in the plan's order. */
export function beforeMapItems(sources: readonly PlanSource[], items: readonly PlanItem[], key: string): BeforeMapItem[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return items.flatMap((p, i): BeforeMapItem[] => {
    if (p.key !== key) return [];
    const kind = heldKind(p.item);
    if (kind === 'booster' || kind === 'boots') return [{ kind, item: p.item, unit: p.unit }];
    if (kind === 'tonic') return [{ kind, item: p.item, unit: p.unit, ...(p.source === 'buy' ? { buy: true } : {}) }];
    if (kind !== 'weapon') return [];
    // Its giver: the carrier before this handover, else its holder, else the convoy.
    const before = items.slice(0, i).filter((x) => x.source === p.source).pop();
    const from = before?.unit ?? byId.get(p.source)?.holder ?? 'convoy';
    return from === p.unit ? [] : [{ kind: 'handover', item: p.item, unit: p.unit, from }];
  });
}

// ---- items used, and item pins, on the run ----

/** An item used in a map's preparations, as Record results logs it (#193). */
export type ItemUsed = { readonly item: string; readonly unit: RosterUnit };

/** Pins an item (a booster or carrier pin), replacing any pin on the same item of the same kind; `remove` unpins it. */
export function withItemPin(run: Run, pin: ItemPin, remove = false): Run {
  const rest = (run.itemPins ?? []).filter((p) => !(p.kind === pin.kind && p.item === pin.item));
  const next = remove ? rest : [...rest, pin];
  const { itemPins: _, ...base } = run;
  return next.length ? { ...base, itemPins: next } : base;
}

/** Records the items used on an entry's map (#193); undefined clears it (the pre-fill again). */
export function withItemsUsed(run: Run, entryId: string, used: readonly ItemUsed[] | undefined, now: number): Run {
  const i = run.entries.findIndex((e) => e.id === entryId);
  if (i < 0) return run;
  const entries = [...run.entries];
  const { itemsUsed: _, ...e } = entries[i]!;
  const past = i < entries.length - 1;
  entries[i] = { ...e, ...(used ? { itemsUsed: used } : {}), ...(past ? { editedAt: now } : {}) };
  return { ...run, entries };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Stored items used: each with an item and a unit. */
export function parseItemsUsed(v: unknown): ItemUsed[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.flatMap((x) => (isObject(x) && isText(x.item) && isText(x.unit) ? [{ item: x.item, unit: x.unit as RosterUnit }] : []));
}

/** Stored item pins: booster pins (a map optional) and carrier pins (a map required). */
export function parseItemPins(v: unknown): ItemPin[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): ItemPin[] => {
    if (!isObject(x) || !isText(x.item) || !isText(x.unit)) return [];
    const unit = x.unit as RosterUnit;
    if (x.kind === 'booster') return [{ kind: 'booster', item: x.item, unit, ...(isText(x.key) ? { key: x.key } : {}) }];
    if (x.kind === 'carrier' && isText(x.key)) return [{ kind: 'carrier', item: x.item, unit, key: x.key }];
    return [];
  });
}
