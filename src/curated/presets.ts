/**
 * Curated scoring presets: per-point stat weights, the Mixed flag and a scoring role. Opinions, not game data —
 * the seed is the preset table settled in #15 (revising #11), as written into the spec (#20).
 *
 * Weights are per stat point. Spd carries two weights: `spd` scores points up to the target breakpoint (plus the
 * speed margin) and `spdBeyond` scores points past it. Until the Spd curve lands, Spd is linear at `spd`.
 */
import type { Stat } from '../game-data/stats';

export type ScoringRole = 'lead' | 'support';

/** One weight per stat, with Spd split into to-target (`spd`) and beyond (`spdBeyond`). */
export type Weights = Readonly<Record<Stat | 'spdBeyond', number>>;

export type PresetData = {
  readonly name: string;
  /** Null for Rallybot / Dancer, which isn't ranked on stats. */
  readonly role: ScoringRole | null;
  /** Null for Rallybot / Dancer. */
  readonly weights: Weights | null;
  /** Score max(Str, Mag) under the attack weight, ignoring the off-stat. */
  readonly mixed: boolean;
};

/** HP / Str / Mag / Skl / Spd→T / Spd+ / Lck / Def / Res, the spec's column order. */
const w = (hp: number, str: number, mag: number, skl: number, spd: number, spdBeyond: number, lck: number, def: number, res: number): Weights => ({
  hp, str, mag, skl, spd, spdBeyond, lck, def, res,
});

/** In menu order. */
export const PRESETS = {
  'physical-lead': { name: 'Physical lead', role: 'lead', weights: w(1, 6, 0, 2, 16, 1, 0, 1, 1), mixed: false },
  'magical-lead': { name: 'Magical lead', role: 'lead', weights: w(1, 0, 6, 2, 16, 1, 0, 1, 1), mixed: false },
  'mixed-lead': { name: 'Mixed lead', role: 'lead', weights: w(1, 6, 6, 2, 16, 1, 0, 1, 1), mixed: true },
  'physical-hard-support': { name: 'Physical hard support', role: 'lead', weights: w(0, 6, 0, 2, 0, 0, 0, 0, 0), mixed: false },
  'magical-hard-support': { name: 'Magical hard support', role: 'lead', weights: w(0, 0, 6, 2, 0, 0, 0, 0, 0), mixed: false },
  // Spd beyond is "—" in the table: Support scores the Spd pair-up bonus linearly, with no beyond term.
  battery: { name: 'Battery', role: 'support', weights: w(0, 4, 4, 4, 12, 0, 0, 2, 2), mixed: true },
  'vv-lead': { name: 'V/V lead', role: 'lead', weights: w(6, 0, 4, 6, 4, 0, 0, 0, 0), mixed: false },
  'crisis-crit': { name: 'Crisis / crit', role: 'lead', weights: w(2, 6, 6, 6, 8, 1, 0, 0, 0), mixed: true },
  tank: { name: 'Tank (main story)', role: 'lead', weights: w(4, 2, 0, 4, 0, 0, 0, 6, 6), mixed: false },
  nostank: { name: 'Nostank', role: 'lead', weights: w(2, 0, 6, 0, 8, 3, 4, 2, 4), mixed: false },
  'armsthrift-bruiser': { name: 'Armsthrift bruiser', role: 'lead', weights: w(0, 4, 0, 4, 8, 1, 6, 0, 0), mixed: false },
  lancekiller: { name: 'Lancekiller', role: 'lead', weights: w(0, 0, 0, 0, 12, 4, 6, 0, 0), mixed: false },
  staffbot: { name: 'Staffbot', role: 'lead', weights: w(0, 0, 6, 0, 0, 0, 0, 0, 0), mixed: false },
  rallybot: { name: 'Rallybot / Dancer', role: null, weights: null, mixed: false },
} as const satisfies Record<string, PresetData>;

export type PresetId = keyof typeof PRESETS;

/**
 * The candidate presets per deployment role (#69): the presets a child's role preset is derived from, in menu order.
 * Every other preset is a niche preset — never derived, reached only by a preset override. Rallybot has no weights,
 * so Staff/Rally stands at 0 for every child and is never a best role (#71).
 */
export const CANDIDATE_PRESETS = {
  lead: ['physical-lead', 'magical-lead', 'mixed-lead', 'physical-hard-support', 'magical-hard-support'],
  battery: ['battery'],
  staff: ['rallybot'],
} as const satisfies Record<'lead' | 'battery' | 'staff', readonly PresetId[]>;
