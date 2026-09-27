/**
 * Chrom's forced marriage at the end of Chapter 11 (#154): the rule on its own, from support ranks, and the question
 * Record results asks about it. The rule and its sources are on `CHROM_FALLBACK_PARTNER` (game-data/supports.ts).
 */
import { CHROM_FALLBACK_PARTNER, CHROM_WEDDING_CANDIDATES, CHROM_WEDDING_MAP } from '../game-data/supports';
import type { RosterUnit } from './roster';
import { SUPPORT_LEVELS, type Run, type SupportLevel } from './run';

/** Who the game marries Chrom to: decided, or one of the contenders (the Maiden among them when no rank decides). */
export type ChromWife =
  | { readonly decided: true; readonly wife: RosterUnit }
  | { readonly decided: false; readonly contenders: readonly RosterUnit[] };

/**
 * Who an unmarried Chrom marries at the end of Chapter 11, from his support ranks with the candidates. Candidates
 * married to someone else don't count; with none left, it's the Maiden. Otherwise the one candidate at his highest rank
 * (C or above) decides it. A tie at the top, or no rank at all, is left to support points (and the unsettled tie order
 * and Olivia threshold), which ranks can't tell: undecided, between the tied candidates, or every candidate and the Maiden.
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

/** Record results' question for Chapter 11: who the game married Chrom to, what to offer, and what to pre-select. */
export type ChromWeddingAsk = {
  /** The candidates not married to someone else (lost ones included), then the Maiden. */
  readonly options: readonly RosterUnit[];
  /** Set only when Chrom's logged ranks decide it. */
  readonly preselect: RosterUnit | null;
};

/**
 * What Record results asks about Chrom's marriage for an entry: null unless the entry is Chapter 11 and Chrom has no
 * recorded marriage in it. Ranks come from the entry's snapshot, logged on either unit; Robin (F) is a candidate.
 */
export function chromWedding(run: Run, entryId: string): ChromWeddingAsk | null {
  const e = run.entries.find((x) => x.id === entryId);
  if (!e || e.map !== CHROM_WEDDING_MAP) return null;
  const { units, spouses } = e.snapshot;
  if (spouses.chrom?.bond === 'married') return null;
  const candidates: RosterUnit[] = [...CHROM_WEDDING_CANDIDATES, ...(run.roster.run.gender === 'F' ? (['robin'] as const) : [])];
  const marriedElsewhere = new Set(candidates.filter((c) => spouses[c]?.bond === 'married' && spouses[c]!.partner !== 'chrom'));
  const ranks: Partial<Record<RosterUnit, SupportLevel>> = {};
  const note = (c: RosterUnit, rank: SupportLevel) => {
    if (SUPPORT_LEVELS.indexOf(rank) > (ranks[c] ? SUPPORT_LEVELS.indexOf(ranks[c]!) : -1)) ranks[c] = rank;
  };
  for (const s of units.chrom?.supports ?? []) if (candidates.includes(s.partner)) note(s.partner, s.rank);
  for (const c of candidates) for (const s of units[c]?.supports ?? []) if (s.partner === 'chrom') note(c, s.rank);
  const wife = chromChapter11Wife(candidates, marriedElsewhere, ranks);
  return {
    options: [...candidates.filter((c) => !marriedElsewhere.has(c)), CHROM_FALLBACK_PARTNER],
    preselect: wife.decided ? wife.wife : null,
  };
}
