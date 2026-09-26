// PROTOTYPE — throwaway (#143, variant D). A scripted run for the handoff: what the inbox holds before each map, and
// what changes when a map is recorded. Invented, like model.ts.
import type { Edit, Wishlist } from './model';

export type Reading = 'on track' | 'at risk' | 'behind';

export interface InboxItem {
  kind: 'at-risk' | 'behind' | 'proposal' | 'milestone' | 'check';
  unit?: string;
  text: string;
  /** Milestone chance now → after the fix. */
  chance?: [number, number];
  /** The one-click fix: a span pin or a re-solve proposal. */
  fix?: Edit;
}

export interface Stop {
  map: string;
  /** Flawless chance before this map, from the re-solve after the last recorded map. */
  chance: number;
  inbox: InboxItem[];
  /** Readings that aren't on track (everyone else is). */
  readings: Record<string, [Reading, string]>;
  /** Shown on Record results when this map is recorded, as "what changed". */
  changed: string[];
}

const pin = (id: string, label: string, delta: number, units: string[]): Edit => ({ id, kind: 'position', label, delta, units, apply: () => {} });

export const STOPS: Stop[] = [
  {
    map: 'Prologue: The Verge of History', chance: 41.2, readings: {}, changed: [],
    inbox: [{ kind: 'milestone', text: 'Forced lineup (Robin, Chrom). No preparation phase in the game; the strategy page still opens.' }],
  },
  {
    map: 'Chapter 1: Unwelcome Change', chance: 41.6, readings: {},
    changed: ['Cleared with no deaths. Flawless chance 41.2 → 41.6 (one map fewer to survive).', 'Robin gained 212 EXP (forecast 180–240): inside the forecast.'],
    inbox: [{ kind: 'check', text: 'In-play check offered here: does Rally give EXP? Watch Lissa’s EXP bar if she rallies (optional).' }],
  },
  {
    map: 'Chapter 2: Shepherds', chance: 41.9,
    readings: { robin: ['at risk', 'Robin Lv 10 by Ch 5: 71%'] },
    changed: ['Cleared with no deaths. Flawless chance 41.6 → 41.9.', 'Robin gained 96 EXP (forecast 150–230): below the forecast. Robin → at risk.'],
    inbox: [
      { kind: 'at-risk', unit: 'robin', text: 'Robin Lv 10 by Ch 5', chance: [71, 88], fix: pin('sp-robin-lead', 'Span pin Ch 2–4: Robin leads, Frederick backs', -0.2, ['robin', 'frederick']) },
      { kind: 'milestone', text: 'Before Ch 2: Chrom and Sumia start their support (earliest start). Field them adjacent.' },
    ],
  },
  {
    map: 'Chapter 3: Warrior Realm', chance: 42.3, readings: {},
    changed: ['Cleared with no deaths. Flawless chance 41.9 → 42.3.', 'Robin → on track (Lv 7, 88% for Lv 10 by Ch 5).', 'Re-solve found an improvement (see the inbox).'],
    inbox: [
      { kind: 'proposal', text: 'Re-solve after Ch 2: Sully backs Vaike on Ch 3–6 so Kjelle’s parents reach S by Ch 11', fix: pin('pr-sully-vaike', 'Sully backs Vaike, Ch 3–6', 0.6, ['sully', 'vaike']) },
      { kind: 'milestone', text: 'Ch 3 door keys: the model assumes you never lose both.' },
    ],
  },
  {
    map: 'Paralogue 1: The Wandering Merchant', chance: 42.8, readings: {}, changed: ['Cleared with no deaths. Flawless chance 42.3 → 42.8.'],
    inbox: [{ kind: 'milestone', text: 'Side goal chased: Anna’s Bullion (the solve counts it; unpin to skip it).' }],
  },
];

/** What a loss on the given stop does, scripted for Lissa. */
export const LOSS = {
  unit: 'Lissa',
  changed: ['Lissa died. Owain can no longer be born → behind.', 'Flawless chance drops: the plan without Owain, before any repair.'],
  chanceHit: -3.9,
  readings: { owain: ['behind', 'Owain: his mother died (recruitment milestone lost)'] } as Record<string, [Reading, string]>,
  inbox: [
    {
      kind: 'behind', unit: 'owain', text: 'Owain can’t be recruited: Lissa died',
      fix: { id: 'loss-reserve', kind: 'inout', label: 'Re-solve: Frederick (reserve 1) takes Owain’s place behind Lucina; Lissa’s staff role moves to Maribelle', delta: 2.1, units: ['frederick', 'owain'], apply: (w: Wishlist) => {
        for (const s of w.slots) if (s.back === 'owain') s.back = 'frederick';
        w.reserves = w.reserves.filter((r) => r.id !== 'frederick' && r.id !== 'lissa');
      } },
    } as InboxItem,
  ],
};
