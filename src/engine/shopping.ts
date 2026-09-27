/**
 * The shopping step of Record results (#192): what the player bought, sold and forged between a map and the next, each
 * with its gold. An entry's gold is its gold at the map's end; its gold after shopping is derived from its shop lines,
 * and so is the snapshot the next entry copies and the flawless chance starts from (gold, items and seals).
 *
 * Between two entries the log also shows what the map used and found: uses spent come from the uses left before (the
 * entry before, after its shopping) and after (this entry); an item gained with no buy or map item behind it (a chest,
 * a village, a drop or a side goal in the chapter data) is a random find.
 */
import { MAPS } from '../game-data/chapters';
import { FORGE, forgeCost, itemByName, sellPrice, type ForgeLevels } from '../game-data/items';
import type { RosterUnit } from './roster';
import type { HeldItem, Run, RunEntry, Snapshot } from './run';

export type ShopKind = 'buy' | 'sell' | 'forge';

/** One purchase, sale or forge between maps. */
export type ShopLine = {
  readonly kind: ShopKind;
  readonly item: string;
  /** Who holds it: a unit, or the convoy when absent. */
  readonly unit?: RosterUnit;
  /** How many were bought or sold (1 when absent); a forge is one weapon. */
  readonly count?: number;
  /** The gold it cost (a buy, a forge) or paid (a sale), for the whole line. */
  readonly gold: number;
  /** A forge: the weapon's forge after it (name and bonuses). */
  readonly forge?: NonNullable<HeldItem['forge']>;
};

/** Gold after shopping: the entry's gold at the map's end, less buys and forges, plus sales; null while gold is unrecorded. */
export function goldAfterShopping(e: Pick<RunEntry, 'snapshot' | 'shopping'>): number | null {
  if (e.snapshot.gold === null) return null;
  return (e.shopping ?? []).reduce((g, l) => g + (l.kind === 'sell' ? l.gold : -l.gold), e.snapshot.gold);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const nameOf = (item: string) => itemByName(item)?.name ?? item.trim();

/**
 * The snapshot after shopping: bought items join their holder at full uses, sold ones leave it (the first held of that
 * name), a forge replaces the first held weapon's forge, and gold is `goldAfterShopping`. A line naming an item its
 * holder doesn't have changes only gold.
 */
export function afterShopping(s: Snapshot, shopping: readonly ShopLine[] | undefined): Snapshot {
  if (!shopping?.length) return s;
  const units = { ...s.units };
  let convoy = [...s.convoy];
  const listOf = (u?: RosterUnit): HeldItem[] => (u && units[u] ? [...units[u]!.inventory] : convoy);
  const put = (u: RosterUnit | undefined, list: HeldItem[]) => {
    if (u && units[u]) units[u] = { ...units[u]!, inventory: list };
    else convoy = list;
  };
  for (const l of shopping) {
    const list = listOf(l.unit);
    const n = Math.max(1, l.count ?? 1);
    if (l.kind === 'buy') {
      const it = itemByName(l.item);
      for (let k = 0; k < n; k++) list.push({ item: nameOf(l.item), uses: it?.uses ?? null });
    } else if (l.kind === 'sell') {
      for (let k = 0; k < n; k++) {
        const i = list.findIndex((h) => same(h.item, l.item));
        if (i >= 0) list.splice(i, 1);
      }
    } else if (l.forge) {
      const i = list.findIndex((h) => same(h.item, l.item));
      if (i >= 0) list[i] = { ...list[i]!, forge: l.forge };
    }
    put(l.unit, list);
  }
  return { ...s, units, convoy, gold: goldAfterShopping({ snapshot: s, shopping }) };
}

/** An entry's snapshot after its shopping: what the next entry copies. */
export const entryAfterShopping = (e: Pick<RunEntry, 'snapshot' | 'shopping'>): Snapshot => afterShopping(e.snapshot, e.shopping);

const levelsOf = (f: HeldItem['forge']): ForgeLevels => ({ mt: (f?.mt ?? 0) / FORGE.step.mt, hit: (f?.hit ?? 0) / FORGE.step.hit, crit: (f?.crit ?? 0) / FORGE.step.crit });

/**
 * A line's gold as the game prices it, for the step to pre-fill: a buy at the item's worth, a sale at `sellPrice` with
 * the uses held (`uses`, full when absent), a forge at `forgeCost` from the forge it had (`from`). 0 for an unknown item.
 */
export function shopPrice(line: Pick<ShopLine, 'kind' | 'item' | 'count' | 'forge'>, held?: Pick<HeldItem, 'uses' | 'forge'>): number {
  const it = itemByName(line.item);
  if (!it) return 0;
  const n = Math.max(1, line.count ?? 1);
  if (line.kind === 'buy') return (it.worth ?? 0) * n;
  if (line.kind === 'sell') return sellPrice(it, held?.uses ?? it.uses) * n;
  return line.forge ? Math.round(forgeCost(it, levelsOf(line.forge), levelsOf(held?.forge))) : 0;
}

const SEALS = new Set(['Master Seal', 'Second Seal']);

/** What an entry's shopping spent, split so upkeep, seals and the kit read apart. */
export type ShoppingSpend = {
  /** Buys of an item already held somewhere at the map's end: replacing worn ones. */
  readonly upkeep: number;
  /** Master and Second Seals. */
  readonly seals: number;
  /** New items and forges. */
  readonly kit: number;
  readonly sold: number;
};

/** An item's uses spent on the map, across the army and the convoy. */
export type ItemUse = { readonly item: string; readonly uses: number };

/** An item gained on the map: from the chapter data's items (a chest, a village, a drop, a side goal), or a random find. */
export type ItemFound = { readonly item: string; readonly count: number; readonly from: 'map' | 'random' };

/** An entry's shopping and what its map used and found (#192). */
export type EntryShopping = {
  /** The entry's gold: gold at the map's end. */
  readonly goldAtEnd: number | null;
  readonly goldAfter: number | null;
  readonly lines: readonly ShopLine[];
  readonly spend: ShoppingSpend;
  /** Uses spent on this map, against the entry before after its shopping (none for the first entry). */
  readonly used: readonly ItemUse[];
  readonly found: readonly ItemFound[];
};

/** Every held item of a snapshot's units in `only` (all when absent) and its convoy. */
function heldIn(s: Snapshot, only?: ReadonlySet<RosterUnit>): HeldItem[] {
  return [...(Object.entries(s.units) as [RosterUnit, Snapshot['units'][RosterUnit]][]).flatMap(([u, x]) => (x && (!only || only.has(u)) ? x.inventory : [])), ...s.convoy];
}

/** Counts and uses left per item name. */
function tally(items: readonly HeldItem[]): Map<string, { count: number; uses: number }> {
  const out = new Map<string, { count: number; uses: number }>();
  for (const h of items) {
    const k = nameOf(h.item);
    const t = out.get(k) ?? { count: 0, uses: 0 };
    out.set(k, { count: t.count + 1, uses: t.uses + (h.uses ?? 0) });
  }
  return out;
}

const COUNTED = /^(.*?) \(×(\d+)\)$/;

/** A map's items by name, as the chapter data lists them (`Bullion (M) (×7)` is seven). */
function mapItems(map: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of MAPS.find((m) => m.id === map)?.items ?? []) {
    const m = COUNTED.exec(r.item);
    const k = nameOf(m ? m[1]! : r.item);
    out.set(k, (out.get(k) ?? 0) + (m ? Number(m[2]) : 1));
  }
  return out;
}

/**
 * An entry's shopping and what its map used and found. Units that joined on the map are left out of the comparison
 * (their items are their own), and so is a unit gone from the entry. An item gained is counted at full uses, so a
 * dropped weapon that came worn reads as uses spent.
 */
export function entryShopping(run: Run, entryId: string): EntryShopping | undefined {
  const i = run.entries.findIndex((e) => e.id === entryId);
  const e = run.entries[i];
  if (!e) return undefined;
  const lines = e.shopping ?? [];
  const heldAtEnd = new Set(heldIn(e.snapshot).map((h) => nameOf(h.item)));
  const spend = { upkeep: 0, seals: 0, kit: 0, sold: 0 };
  for (const l of lines) {
    if (l.kind === 'sell') spend.sold += l.gold;
    else if (l.kind === 'forge') spend.kit += l.gold;
    else if (SEALS.has(nameOf(l.item))) spend.seals += l.gold;
    else if (heldAtEnd.has(nameOf(l.item))) spend.upkeep += l.gold;
    else spend.kit += l.gold;
  }
  const prev = run.entries[i - 1];
  const used: ItemUse[] = [];
  const found: ItemFound[] = [];
  if (prev) {
    const before = entryAfterShopping(prev);
    const both = new Set((Object.keys(e.snapshot.units) as RosterUnit[]).filter((u) => before.units[u]));
    const was = tally(heldIn(before, both));
    const now = tally(heldIn(e.snapshot, both));
    const fromMap = mapItems(e.map);
    for (const k of new Set([...was.keys(), ...now.keys()])) {
      const a = was.get(k) ?? { count: 0, uses: 0 };
      const b = now.get(k) ?? { count: 0, uses: 0 };
      const gained = Math.max(0, b.count - a.count);
      const onMap = Math.min(gained, fromMap.get(k) ?? 0);
      if (onMap) found.push({ item: k, count: onMap, from: 'map' });
      if (gained > onMap) found.push({ item: k, count: gained - onMap, from: 'random' });
      const full = itemByName(k)?.uses;
      if (full === undefined) continue;
      const spent = a.uses + gained * full - b.uses;
      if (spent > 0) used.push({ item: k, uses: spent });
    }
  }
  return { goldAtEnd: e.snapshot.gold, goldAfter: goldAfterShopping(e), lines, spend, used, found };
}

const editLines = (run: Run, entry: string, edit: (ls: readonly ShopLine[]) => readonly ShopLine[], now: number): Run => {
  const i = run.entries.findIndex((e) => e.id === entry);
  if (i < 0) return run;
  const entries = [...run.entries];
  const { shopping, ...rest } = entries[i]!;
  const next = edit(shopping ?? []);
  // A past entry's shopping changes what later entries copied: they're flagged, as a snapshot edit flags them.
  const past = i < entries.length - 1;
  entries[i] = { ...rest, ...(next.length ? { shopping: next } : {}), ...(past ? { editedAt: now } : {}) };
  return { ...run, entries };
};

/** Records a buy, sale or forge on an entry. */
export const withShopLine = (run: Run, entry: string, line: ShopLine, now: number): Run => editLines(run, entry, (ls) => [...ls, line], now);

/** Removes an entry's `index`-th shop line. */
export const removeShopLine = (run: Run, entry: string, index: number, now: number): Run => editLines(run, entry, (ls) => ls.filter((_, k) => k !== index), now);

// ---- storage ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A stored entry's shop lines; anything unreadable is dropped (a run saved before #192 has none). */
export function parseShopLines(v: unknown): ShopLine[] {
  return (Array.isArray(v) ? v : []).flatMap((l): ShopLine[] => {
    if (!isObject(l) || (l.kind !== 'buy' && l.kind !== 'sell' && l.kind !== 'forge') || typeof l.item !== 'string' || !finite(l.gold)) return [];
    const f = isObject(l.forge) ? l.forge : null;
    if (l.kind === 'forge' && !f) return [];
    return [
      {
        kind: l.kind,
        item: l.item,
        ...(typeof l.unit === 'string' && l.unit ? { unit: l.unit as RosterUnit } : {}),
        ...(finite(l.count) && l.count > 1 ? { count: Math.floor(l.count) } : {}),
        gold: Math.max(0, l.gold),
        ...(f ? { forge: { name: typeof f.name === 'string' ? f.name : '', mt: finite(f.mt) ? f.mt : 0, hit: finite(f.hit) ? f.hit : 0, crit: finite(f.crit) ? f.crit : 0 } } : {}),
      },
    ];
  });
}
