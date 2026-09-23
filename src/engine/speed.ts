/**
 * Speed: the Speed total (Spd effective cap + Rally + Tonic + Pair-up), the highest breakpoint it clears, the
 * Lead Spd curve around the target breakpoint (#15; research/fixtures-and-speed, #7).
 */
import type { AssumptionId, Assumptions } from './assumptions';
import type { PlayContext, SpeedReading, SpeedSettings } from './types';

/** The target breakpoint for Apotheosis, Full route and All (#15). */
export const DEFAULT_TARGET_BREAKPOINT = 66;

export const DEFAULT_SPEED: SpeedSettings = { rally: 8, tonic: true, pairUp: 8, target: DEFAULT_TARGET_BREAKPOINT, margin: 2 };

/** Rally Speed +4, Rally Spectrum +4 (they stack to +8), DLC Rally Heart +2 more (SF temporary boosts). */
export const RALLY_OPTIONS: readonly number[] = [0, 4, 8, 10];
export const TONIC_SPD = 2;

/** Rally + Tonic + Pair-up. */
export const speedBuffs = (s: SpeedSettings): number => s.rally + (s.tonic ? TONIC_SPD : 0) + s.pairUp;

/** A Speed total against the breakpoint list (ascending): the highest one cleared and by how much. */
export function readSpeed(total: number, breakpoints: readonly number[]): SpeedReading {
  let cleared: number | undefined;
  for (const bp of breakpoints) if (total >= bp) cleared = bp;
  return { total, cleared, over: cleared === undefined ? undefined : total - cleared };
}

/**
 * The Spd term of a Lead score: `wT × min(S, T+m) + wB × max(0, S − (T+m))`. A null target makes it linear at wT.
 * On Growths the beyond term is replaced by `wB × Spd growth` (pass it as `beyond`).
 */
export function spdCurve(total: number, wT: number, wB: number, s: SpeedSettings, beyond?: number): number {
  const knee = s.target === null ? Infinity : s.target + s.margin;
  const toTarget = wT * Math.min(total, knee);
  return toTarget + wB * (beyond ?? Math.max(0, total - knee));
}

/** The context's default target breakpoint, and the assumption it rests on (Main story's 60 is unsourced). */
export function defaultTargetBreakpoint(
  context: PlayContext,
  assumptions: Assumptions,
): { readonly value: number; readonly assumption: AssumptionId | undefined } {
  return context === 'main-story'
    ? { value: assumptions['main-story-target-breakpoint'], assumption: 'main-story-target-breakpoint' }
    : { value: DEFAULT_TARGET_BREAKPOINT, assumption: undefined };
}

/** Whether DLC classes are reachable in a play context: Apotheosis and the Full route include the DLC (#20 story 26). */
export function contextReachesDlc(context: PlayContext): boolean {
  return context === 'apotheosis' || context === 'full-route';
}
