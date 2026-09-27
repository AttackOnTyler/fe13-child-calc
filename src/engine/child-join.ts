/**
 * A child's join stats (#155), worked out from its parents as they are on entering its paralogue (for Lucina, the start
 * of Chapter 13), stat boosters included. Per stat, Luck having no class base:
 *
 *   floor(((parent A now − A's current class base) + (parent B now − B's current class base) + child's absolute base) / 3)
 *     + child's start-class base
 *
 * SF base stats (main story) states it; Remnant Sage took it from the guidebooks (SF forums topic 33434) and checked
 * it against an in-game Lucina, 8 of 8 stats, which settles floor over rounding to nearest. Morgan uses Robin and
 * Robin's spouse (an inference: research/child-recruitment §3.4). Open points are assumptions: rounding a negative
 * sum, clamping at the start class's caps and the Maiden's side.
 *
 * Pure: the caller supplies the parents' stats and classes, so a projection can pass simulated parents.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { CLASS_BASES } from '../game-data/class-bases';
import type { ClassId } from '../game-data/classes';
import { CHILD_JOIN_DATA } from '../game-data/join';
import { STATS, type Gender, type Modifiers, type Stat } from '../game-data/stats';
import type { AssumptionId, Assumptions } from './assumptions';
import { classMaxStats } from './classes';

/** One parent as it is on entering the paralogue: its stats and current class; or the Maiden, who has no stats. */
export type JoinParent = { readonly stats: Readonly<Record<Stat, number>>; readonly class: ClassId; readonly gender: Gender } | 'maiden';

export type ChildJoinInput = {
  readonly child: ChildId;
  readonly parents: readonly [JoinParent, JoinParent];
  /** Morgan's start class (its partner's starting class); every other child joins in its fixed class. */
  readonly startClass?: ClassId;
  /** The child's cap modifiers, read only when join stats are clamped at the caps; 0 when absent. */
  readonly modifiers?: Modifiers;
};

export type ChildJoinStats = {
  readonly class: ClassId;
  readonly level: number;
  readonly stats: Readonly<Record<Stat, number>>;
  /** The assumptions whose alternative would change these stats. */
  readonly assumptionsUsed: readonly AssumptionId[];
};

/** A class's base stats for a gender (Luck 0), or undefined for a class with no published bases (Soldier and the like). */
export function classBaseStats(id: ClassId, gender: Gender): Readonly<Record<Stat, number>> | undefined {
  const e = CLASS_BASES[id];
  return (e?.any ?? e?.[gender])?.stats;
}

export function childJoinStats(input: ChildJoinInput, assumptions: Assumptions): ChildJoinStats {
  const child = CHILD_UNITS[input.child];
  const join = CHILD_JOIN_DATA[input.child];
  const cls = child.fixedParent === 'robin' ? input.startClass : child.defaultClassSet[0];
  if (!cls) throw new Error(`${child.name}’s start class is needed`);
  const own = classBaseStats(cls, child.gender);
  if (!own) throw new Error(`No class bases for ${cls}`);
  const used = new Set<AssumptionId>();
  const side = (p: JoinParent, s: Stat): number => {
    if (p === 'maiden') {
      used.add('maiden-join-stats');
      return assumptions['maiden-join-stats'][s];
    }
    const base = classBaseStats(p.class, p.gender);
    if (!base) throw new Error(`No class bases for ${p.class}`);
    return p.stats[s] - base[s];
  };
  const caps = classMaxStats(cls, child.gender);
  const stats = {} as Record<Stat, number>;
  for (const s of STATS) {
    const sum = side(input.parents[0], s) + side(input.parents[1], s) + join.absoluteBases[s];
    const floor = Math.floor(sum / 3);
    const trunc = Math.trunc(sum / 3);
    if (floor !== trunc) used.add('child-join-rounding');
    const raw = (assumptions['child-join-rounding'] === 'toward-zero' ? trunc : floor) + own[s];
    const cap = caps[s] + (s === 'hp' ? 0 : (input.modifiers?.[s] ?? 0));
    if (raw > cap) used.add('child-join-cap');
    stats[s] = assumptions['child-join-cap'] === 'start-class-caps' ? Math.min(raw, cap) : raw;
  }
  return { class: cls, level: join.level, stats, assumptionsUsed: [...used] };
}
