/**
 * Chrom's forced marriage at the end of Chapter 11 (#154; research/chrom-wedding): the rule on its own, from viewed
 * support ranks or from points, and the question Record results asks about it. The rule and its sources are on
 * `CHROM_FALLBACK_PARTNER` (game-data/supports.ts).
 */
import { CHROM_FALLBACK_PARTNER, CHROM_WEDDING_CANDIDATES, CHROM_WEDDING_MAP } from '../game-data/supports';
import type { Assumptions } from './assumptions';
import type { RosterUnit } from './roster';
import { SUPPORT_LEVELS, type Run, type SupportLevel } from './run';

/** Who the game marries Chrom to: decided, or one of the contenders (the Maiden among them when no rank decides). */
export type ChromWife =
  | { readonly decided: true; readonly wife: RosterUnit }
  | { readonly decided: false; readonly contenders: readonly RosterUnit[] };

/**
 * Who an unmarried Chrom marries at the end of Chapter 11, from his viewed support ranks with the candidates.
 * Candidates married to someone else don't count; with none left, it's the Maiden. Otherwise the one candidate at his
 * highest rank (C or above) decides it: a viewed C also shuts out Olivia's 2-point jump. A tie at the top, or no rank at
 * all, is left to support points, which ranks can't tell: undecided, between the tied candidates, or every candidate
 * and the Maiden (Olivia among them without a C: 2 points win it for her).
 */
export function chromChapter11Wife(
  candidates: readonly RosterUnit[],
  marriedElsewhere: ReadonlySet<RosterUnit>,
  ranks: Readonly<Partial<Record<RosterUnit, SupportLevel>>>,
): ChromWife {
  const free = candidates.filter((c) => !marriedElsewhere.has(c));
  if (!free.length) return { decided: true, wife: CHROM_FALLBACK_PARTNER };
  const level = (c: RosterUnit) => (ranks[c] ? SUPPORT_LEVELS.indexOf(ranks[c]!) : -1);
  const top = Math.max(...free.map(level));
  if (top < 0) return { decided: false, contenders: [...free, CHROM_FALLBACK_PARTNER] };
  const tied = free.filter((c) => level(c) === top);
  return tied.length === 1 ? { decided: true, wife: tied[0]! } : { decided: false, contenders: tied };
}

/** The order the game breaks a last tie in (SF Support Basics, tested in SFF-39984): Robin is Robin (F). */
export const CHROM_WEDDING_ORDER: readonly RosterUnit[] = ['sumia', 'sully', 'maribelle', 'robin', 'olivia'];

/** Olivia's points with Chrom that put her first, when no other candidate has a viewed C (SF Support Basics, SFF-40418). */
export const OLIVIA_WEDDING_POINTS = 2;

/**
 * Where Chrom stands with a candidate as Chapter 11 is cleared: his whole points with her (the map's own counted), the
 * highest rank whose conversation was viewed (null: none), and the points still to go to the rank after it (0 when that
 * rank is reached but its conversation isn't viewed yet).
 */
export type ChromStanding = { readonly points: number; readonly rank: SupportLevel | null; readonly toNext: number };

/**
 * Who an unmarried Chrom marries at the end of Chapter 11 when points are known (the simulation, #188), by the rule SF's
 * testers worked out (research/chrom-wedding): a candidate married to someone else is out, the rest need 1 point to
 * count, none counting is the Maiden. Olivia at 2 points or more wins when no other candidate has a viewed C, however
 * many points they have. Otherwise the highest viewed rank wins, then the fewest points to the next rank, then
 * `CHROM_WEDDING_ORDER`.
 */
export function chromWifeByPoints(
  candidates: readonly RosterUnit[],
  marriedElsewhere: ReadonlySet<RosterUnit>,
  standing: Readonly<Partial<Record<RosterUnit, ChromStanding>>>,
): RosterUnit {
  const free = candidates.filter((c) => !marriedElsewhere.has(c) && ((standing[c]?.points ?? 0) >= 1 || standing[c]?.rank));
  if (!free.length) return CHROM_FALLBACK_PARTNER;
  const level = (c: RosterUnit) => (standing[c]?.rank ? SUPPORT_LEVELS.indexOf(standing[c]!.rank!) : -1);
  if (free.includes('olivia') && standing.olivia!.points >= OLIVIA_WEDDING_POINTS && !free.some((c) => c !== 'olivia' && level(c) >= 0)) return 'olivia';
  const toNext = (c: RosterUnit) => standing[c]?.toNext ?? Infinity;
  return [...free].sort((a, b) => level(b) - level(a) || toNext(a) - toNext(b) || CHROM_WEDDING_ORDER.indexOf(a) - CHROM_WEDDING_ORDER.indexOf(b))[0]!;
}

/** Record results' question for Chapter 11: who the game married Chrom to, what to offer, and what to pre-select. */
export type ChromWeddingAsk = {
  /** The candidates not married to someone else (lost ones included unless the game skips them), then the Maiden. */
  readonly options: readonly RosterUnit[];
  /** Set only when Chrom's logged ranks decide it. */
  readonly preselect: RosterUnit | null;
};

/**
 * What Record results asks about Chrom's marriage for an entry: null unless the entry is Chapter 11 and Chrom has no
 * recorded marriage in it. Ranks come from the entry's snapshot, logged on either unit (a logged rank is a viewed
 * conversation, and none can be viewed during Chapter 11); Robin (F) is a candidate. A candidate lost before it stays
 * one unless the `chrom-wedding-lost-candidate` reading skips her.
 */
export function chromWedding(run: Run, entryId: string, lost: Assumptions['chrom-wedding-lost-candidate'] = 'still-picked'): ChromWeddingAsk | null {
  const e = run.entries.find((x) => x.id === entryId);
  if (!e || e.map !== CHROM_WEDDING_MAP) return null;
  const { units, spouses, states } = e.snapshot;
  if (spouses.chrom?.bond === 'married') return null;
  const candidates: RosterUnit[] = [...CHROM_WEDDING_CANDIDATES, ...(run.roster.run.gender === 'F' ? (['robin'] as const) : [])];
  const skipped = (c: RosterUnit) => lost === 'skipped' && (states[c] === 'dead' || run.roster.states[c] === 'dead');
  const out = new Set(candidates.filter((c) => (spouses[c]?.bond === 'married' && spouses[c]!.partner !== 'chrom') || skipped(c)));
  const ranks: Partial<Record<RosterUnit, SupportLevel>> = {};
  const note = (c: RosterUnit, rank: SupportLevel) => {
    if (SUPPORT_LEVELS.indexOf(rank) > (ranks[c] ? SUPPORT_LEVELS.indexOf(ranks[c]!) : -1)) ranks[c] = rank;
  };
  for (const s of units.chrom?.supports ?? []) if (candidates.includes(s.partner)) note(s.partner, s.rank);
  for (const c of candidates) for (const s of units[c]?.supports ?? []) if (s.partner === 'chrom') note(c, s.rank);
  const wife = chromChapter11Wife(candidates, out, ranks);
  return {
    options: [...candidates.filter((c) => !out.has(c)), CHROM_FALLBACK_PARTNER],
    preselect: wife.decided ? wife.wife : null,
  };
}
