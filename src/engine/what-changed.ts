/**
 * What changed (#206; spec #175, The inbox, Run view and Wishlist tab; Record results, losses and What changed): after
 * each recorded map, what the map did to the plan. The card reads:
 *
 * - the **flawless chance before and after**: the headline as it stood when the map was recorded (kept on the entry,
 *   `RunEntry.forecast`, since the run moves on once it's recorded) against the headline worked out since;
 * - **EXP against the forecast**: each unit the forecast fielded on the map, the EXP it earned (from the entries before
 *   and after; unknown across a class change, whose level resets) and its level against the forecast's spread;
 * - **readings that moved**: each unit whose reading (on track, at risk, behind) differs from the one before the map;
 * - the improvements the re-solve after the map found (the page lists the search's proposals).
 *
 * It's dismissed with "got it" (`Run.dismissedChanges`, by entry id). What it cost (#210) adds its rows later.
 */
import type { FlawlessChance } from './flawless';
import { remainingMapOrder } from './map-order';
import type { ReadingKind, Readings } from './readings';
import type { RosterUnit } from './roster';
import type { EntryForecast, Run } from './run';

/**
 * The forecast to keep on the entry a map's record makes (see the module comment), from the headline as it stands on
 * `run` before the map: its chance, the first map it plays (the one it expected next) with each unit's EXP there, and
 * `readings`' readings. Undefined when there's nothing left to simulate.
 */
export function forecastBefore(run: Run, chance: FlawlessChance, readings?: Readings): EntryForecast | undefined {
  const first = chance.maps[0];
  if (!first) return undefined;
  const map = remainingMapOrder(run).steps.find((s) => s.key === first.key)?.map ?? first.key;
  const exp = chance.exp.find((m) => m.key === first.key)?.units.map((u) => ({ unit: u.unit, exp: u.exp, level: { ...u.level } })) ?? [];
  return {
    chance: chance.chance,
    margin: chance.margin,
    key: first.key,
    map,
    exp,
    readings: readings?.readings.map((r) => ({ unit: r.unit, reading: r.reading, ...(r.pending ? { pending: true as const } : {}) })) ?? [],
  };
}

/** The run with a forecast kept on entry `id` (#206). */
export function withEntryForecast(run: Run, id: string, forecast: EntryForecast): Run {
  return { ...run, entries: run.entries.map((e) => (e.id === id ? { ...e, forecast } : e)) };
}

/** The run with entry `id`'s What changed card dismissed ("got it"). */
export function withDismissedChange(run: Run, id: string): Run {
  const ids = run.dismissedChanges ?? [];
  return ids.includes(id) ? run : { ...run, dismissedChanges: [...ids, id] };
}

/** One unit's EXP on the map against the forecast. */
export type ExpAgainstForecast = {
  readonly unit: RosterUnit;
  /** EXP earned on the map, from the entries before and after; undefined across a class change or with no entry before. */
  readonly earned: number | undefined;
  /** The forecast's mean EXP on the map. */
  readonly forecast: number;
  /** Its level at the map's end, EXP as the fraction (Lv 5, 40 EXP → 5.4), and the forecast's spread. */
  readonly level: number;
  readonly spread: { readonly low: number; readonly median: number; readonly high: number };
  /** Below the forecast's 10th percentile, inside its 10th–90th, or above its 90th. */
  readonly against: 'below' | 'inside' | 'above';
};

export type WhatChanged = {
  /** The entry the card is for (the latest), and its map. */
  readonly entry: string;
  readonly map: string;
  /** The headline before the map (undefined: not worked out when it was recorded) and after (undefined: working it out). */
  readonly before: { readonly chance: number; readonly margin: number } | undefined;
  readonly after: { readonly chance: number; readonly margin: number } | undefined;
  /** The forecast's units on the map, in its order; empty when the map recorded isn't the one it expected. */
  readonly exp: readonly ExpAgainstForecast[];
  /** Units whose reading moved (`after` pending: "at risk?"). */
  readonly readings: readonly { readonly unit: RosterUnit; readonly before: ReadingKind; readonly after: ReadingKind; readonly pending: boolean }[];
  /** Dismissed with "got it". */
  readonly dismissed: boolean;
};

/**
 * The latest entry's What changed (see the module comment), against the headline and readings worked out since
 * (`now`). Undefined with no entry.
 */
export function whatChanged(run: Run, now: { readonly chance?: { readonly chance: number; readonly margin: number }; readonly readings?: Readings } = {}): WhatChanged | undefined {
  const i = run.entries.length - 1;
  const e = run.entries[i];
  if (!e) return undefined;
  const f = e.forecast;
  const prev = run.entries[i - 1]?.snapshot.units;
  const exp = (f && f.map === e.map ? f.exp : []).flatMap((x): ExpAgainstForecast[] => {
    const u = e.snapshot.units[x.unit];
    if (!u) return [];
    const was = prev?.[x.unit];
    const earned = was && was.class === u.class && u.level >= was.level ? (u.level - was.level) * 100 + u.exp - was.exp : undefined;
    const level = u.level + u.exp / 100;
    const against = level < x.level.low ? 'below' : level > x.level.high ? 'above' : 'inside';
    return [{ unit: x.unit, earned, forecast: x.exp, level, spread: x.level, against }];
  });
  const before = new Map((f?.readings ?? []).map((r) => [r.unit, r.reading]));
  const readings = (now.readings?.readings ?? []).flatMap((r) => {
    const b = before.get(r.unit);
    return b && b !== r.reading ? [{ unit: r.unit, before: b, after: r.reading, pending: r.pending }] : [];
  });
  return {
    entry: e.id,
    map: e.map,
    before: f ? { chance: f.chance, margin: f.margin } : undefined,
    after: now.chance ? { chance: now.chance.chance, margin: now.chance.margin } : undefined,
    exp,
    readings,
    dismissed: (run.dismissedChanges ?? []).includes(e.id),
  };
}
