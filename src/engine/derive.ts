/**
 * Derived roles (#95; Map: Derived roles #67): each child's standing against the cast under every candidate preset,
 * its role preset in each deployment role, and its best role. Pure.
 *
 * Standing under a preset is the child's place in the cast's spread: (its best pairing's raw score − the lowest
 * child's best) ÷ (the highest child's best − the lowest), measured on each child's best pairing that can still
 * happen (#70). It is 0 for everyone when the spread is zero, including a cast of one. The role preset is the
 * candidate with the highest standing in that role, and the best role is the role whose role preset stands highest;
 * both break exact ties by menu order.
 */
import type { ChildId } from '../game-data/children';
import type { ChildDeploymentRole } from '../curated/deployment';
import { CANDIDATE_PRESETS, type PresetId } from '../curated/presets';

export const CHILD_DEPLOYMENT_ROLES: readonly ChildDeploymentRole[] = ['lead', 'battery', 'staff'];

/** One side of a Robin gain: a child's best pairing and its score. */
export type RobinGainSide = { readonly key: string; readonly parent: string; readonly score: number };

/** Robin gain (#98): a child's best under its Lead role preset with Robin in the gene pool, minus its best without. */
export type RobinGain = {
  readonly child: ChildId;
  readonly preset: PresetId;
  readonly with: RobinGainSide;
  /** Undefined when every pairing left has Robin as a parent. */
  readonly without: RobinGainSide | undefined;
  readonly gain: number;
};

/** Why a child isn't in the cast. */
export type OutOfCast = 'dead' | 'unborn' | 'needs-robin' | 'no-robin';

export type DerivedRole = {
  readonly child: ChildId;
  /** Standing (0–1) under each candidate preset. */
  readonly standing: Readonly<Partial<Record<PresetId, number>>>;
  /** The pairing key each standing was measured on. */
  readonly bestPairing: Readonly<Partial<Record<PresetId, string>>>;
  /** The highest-standing candidate in each deployment role. */
  readonly rolePreset: Readonly<Record<ChildDeploymentRole, PresetId>>;
  /** Each role preset's standing. */
  readonly roleStanding: Readonly<Record<ChildDeploymentRole, number>>;
  readonly bestRole: ChildDeploymentRole;
};

export type Derivation = {
  readonly roles: readonly DerivedRole[];
  /** Children outside the cast, and why. */
  readonly leftOut: ReadonlyMap<ChildId, OutOfCast>;
};

export type DeriveInput = {
  /** Every child, in roster order. */
  readonly children: readonly ChildId[];
  /** Why a child is out of the cast, or undefined when it is in. */
  readonly leftOut: (child: ChildId) => OutOfCast | undefined;
  /** The pairing keys that can still happen for a child in the cast. */
  readonly pool: (child: ChildId) => readonly string[];
  /** A pairing's raw score under a preset; undefined without a score (and for weightless presets). */
  readonly raw: (preset: PresetId, key: string) => number | undefined;
};

const CANDIDATES: readonly PresetId[] = CHILD_DEPLOYMENT_ROLES.flatMap((r) => CANDIDATE_PRESETS[r]);

export function deriveRoles(input: DeriveInput): Derivation {
  const leftOut = new Map<ChildId, OutOfCast>();
  const cast: ChildId[] = [];
  for (const c of input.children) {
    const why = input.leftOut(c) ?? (input.pool(c).length ? undefined : 'unborn');
    if (why) leftOut.set(c, why);
    else cast.push(c);
  }

  const best = new Map<string, { raw: number; key: string }>();
  for (const p of CANDIDATES)
    for (const c of cast) {
      let found: { raw: number; key: string } | undefined;
      for (const key of input.pool(c)) {
        const raw = input.raw(p, key);
        if (raw !== undefined && (!found || raw > found.raw)) found = { raw, key };
      }
      if (found) best.set(`${p}|${c}`, found);
    }

  const spread = new Map<PresetId, { lo: number; hi: number }>();
  for (const p of CANDIDATES) {
    const vals = cast.map((c) => best.get(`${p}|${c}`)?.raw).filter((v): v is number => v !== undefined);
    if (vals.length) spread.set(p, { lo: Math.min(...vals), hi: Math.max(...vals) });
  }

  const roles = cast.map((child): DerivedRole => {
    const standing: Partial<Record<PresetId, number>> = {};
    const bestPairing: Partial<Record<PresetId, string>> = {};
    for (const p of CANDIDATES) {
      const b = best.get(`${p}|${child}`);
      const s = spread.get(p);
      standing[p] = b && s && s.hi > s.lo ? (b.raw - s.lo) / (s.hi - s.lo) : 0;
      if (b) bestPairing[p] = b.key;
    }
    const pick = (ids: readonly PresetId[]) => ids.reduce((a, b) => (standing[b]! > standing[a]! ? b : a));
    const rolePreset = {
      lead: pick(CANDIDATE_PRESETS.lead),
      battery: pick(CANDIDATE_PRESETS.battery),
      staff: pick(CANDIDATE_PRESETS.staff),
    };
    const roleStanding = { lead: standing[rolePreset.lead]!, battery: standing[rolePreset.battery]!, staff: standing[rolePreset.staff]! };
    const bestRole = CHILD_DEPLOYMENT_ROLES.reduce((a, b) => (roleStanding[b] > roleStanding[a] ? b : a));
    return { child, standing, bestPairing, rolePreset, roleStanding, bestRole };
  });
  return { roles, leftOut };
}
