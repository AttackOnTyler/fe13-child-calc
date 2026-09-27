/**
 * When a child paralogue (P5–P16) can be played (#152; research/child-recruitment §1, C6, C9). Kept apart from the
 * generated chapter files, which list all twelve in Chapter 13's `unlocks` with no condition.
 *
 * - **Opens** when Chapter 13 is cleared **and** the child's fixed parent is married (the S support viewed), in either
 *   order; Morgan's P12 needs Robin married to anyone, a child included. Once open it stays open until played.
 *   FEW Of Sacred Blood (oldid 742107); FEW paralogue pages at the chapter data's revisions (P5 742102, P6 742030,
 *   P7 769016, P8 742211, P9 742121, P10 742184, P11 769229, P12 741938, P13 741913, P14 741822, P15 741793,
 *   P16 742094); SF Gaiden Chapters; JP 2ch wiki 子供ユニット (p.112); 天馬騎士団 wiki 子供.
 * - **Reach**: five also need their map location reachable. SF's "requires access to Chapter N" is FEW's "clear
 *   Chapter N−1". FEW paralogue pages; SF Gaiden Chapters; JP 2ch wiki paralogue pages (P5 p.144, P7 p.84, P9 p.145,
 *   P11 p.147, P12 p.138) and FAQ (p.19, P6).
 * - **C6 (P7)**: SF says "Paralogue 6 and/or 12"; FEW needs P6 (reached by Chapter 14 cleared or P12 open). FEW wins,
 *   with the JP P7 page (reachable from P6 and Chapter 16's location): P12 alone doesn't reach P7. Recorded in
 *   RESOLVED_DISAGREEMENTS.
 */
import { SF_GAIDEN, FEW_CHILD_PARALOGUES, JP_CHILDREN, JP_PARALOGUES, JP_PK, type Citation } from './citations';
import type { UnitId } from './units';

/**
 * One way to reach a paralogue's location: every map listed, a story chapter cleared or a child paralogue open.
 * An empty list is always met.
 */
export type ReachRoute = readonly string[];

export type ChildParalogue = {
  /** The parent whose marriage opens it; for P12, Robin (married to anyone). */
  readonly parent: UnitId | 'robin';
  /** Any one route reaches it. */
  readonly reach: readonly ReachRoute[];
  readonly sources: readonly Citation[];
};

/** The chapter every child paralogue waits for. */
export const CHILD_PARALOGUES_AFTER = 'chapter-13';

const OPEN_SOURCES = [FEW_CHILD_PARALOGUES, SF_GAIDEN, JP_CHILDREN, JP_PK];
const AT_ONCE: readonly ReachRoute[] = [[]];

export const CHILD_PARALOGUES: Readonly<Record<string, ChildParalogue>> = {
  'paralogue-5': { parent: 'lissa', reach: [['chapter-14'], ['paralogue-9', 'paralogue-10']], sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  'paralogue-6': { parent: 'olivia', reach: [['chapter-14'], ['paralogue-12']], sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  // C6: FEW over SF's "Paralogue 6 and/or 12"; the road from P12 runs through P6.
  'paralogue-7': { parent: 'maribelle', reach: [['chapter-15'], ['paralogue-6', 'chapter-14'], ['paralogue-6', 'paralogue-12']], sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  'paralogue-8': { parent: 'sully', reach: AT_ONCE, sources: OPEN_SOURCES },
  'paralogue-9': { parent: 'sumia', reach: [['chapter-18'], ['chapter-14', 'paralogue-5'], ['paralogue-10']], sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  'paralogue-10': { parent: 'cordelia', reach: AT_ONCE, sources: OPEN_SOURCES },
  'paralogue-11': { parent: 'cherche', reach: [['chapter-16'], ['chapter-14', 'paralogue-5'], ['paralogue-5', 'paralogue-9', 'paralogue-10']], sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  'paralogue-12': { parent: 'robin', reach: AT_ONCE, sources: [...OPEN_SOURCES, JP_PARALOGUES] },
  'paralogue-13': { parent: 'panne', reach: AT_ONCE, sources: OPEN_SOURCES },
  'paralogue-14': { parent: 'miriel', reach: AT_ONCE, sources: OPEN_SOURCES },
  'paralogue-15': { parent: 'tharja', reach: AT_ONCE, sources: OPEN_SOURCES },
  'paralogue-16': { parent: 'nowi', reach: AT_ONCE, sources: OPEN_SOURCES },
};
