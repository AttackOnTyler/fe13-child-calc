/**
 * Plan totals as the Plan page shows them: rounded to integers. Every Σ delta on the page is taken between the rounded
 * totals, so it always equals the difference of the numbers shown beside it. The totals themselves stay raw.
 */
export const shownTotal = (total: number): number => Math.round(total);

/** The Σ delta shown from one raw total to another: round each, then subtract. */
export const shownDelta = (before: number, after: number): number => shownTotal(after) - shownTotal(before);
