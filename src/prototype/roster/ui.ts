// PROTOTYPE — small shared roster widgets (strings with data-ctl hooks). Layout is per variant.
import { AF_STATS, type Row } from '../pairing-table/data';
import * as R from './roster';
import type { Ctx } from './main';

export const esc = (x: string) => x.replace(/"/g, '&quot;');

export const runFacts = (ro: R.Roster) => {
  const afs = AF_STATS.flatMap((a) => AF_STATS.filter((f) => f !== a).map((f) => `${a}/${f}`));
  return `<span class="runfacts">Robin
    <span class="seg">${['M', 'F'].map((g) => `<button data-ctl="robinG" data-v="${g}" class="${ro.robinG === g ? 'on' : ''}">${g}</button>`).join('')}</span>
    <select data-ctl="robinAF" title="Once the run has started Robin's asset/flaw is fixed: the other 55 combos drop out"><option value="">asset/flaw open</option>${afs
      .map((x) => `<option value="${x}" ${ro.robinAF === x ? 'selected' : ''}>+${x.replace('/', ' −')}</option>`)
      .join('')}</select></span>`;
};

export const assumption = (ro: R.Roster) =>
  `<label class="assume small" title="UNVERIFIED — does a child's paralogue survive a parent dying after the S-support? Editable assumption."><input type="checkbox" data-ctl="afterDeath" ${ro.afterDeath ? 'checked' : ''}> Child still comes if a parent dies after marrying ⚠</label>`;

export const rosterButtons = () =>
  `<button class="ghost" data-ctl="demo" title="Load a mid-run ironman state: Chrom+Sumia and Robin+Lucina married, five plans, Olivia dead, Gaius benched">Demo run</button>
   <button class="ghost danger" data-ctl="clearAll">Clear all</button>`;

export const stateSeg = (ro: R.Roster, u: string) =>
  `<span class="seg useg">${R.USTATES.map(
    (x) => `<button data-ctl="u" data-u="${esc(u)}" data-v="${x.k}" class="${R.uState(ro, u) === x.k ? 'on s-' + x.k : ''}" title="${x.label} — ${x.hint}">${x.icon}</button>`,
  ).join('')}</span>`;

export const kindChip = (x: R.St | undefined) => {
  if (!x) return '';
  const why = [...x.hard, ...x.soft];
  const title = esc([...why, ...x.info].join('\n'));
  if (x.kind === 'married') return `<span class="kind k-married" title="${title}">✓ married</span>`;
  if (x.kind === 'planned') return `<span class="kind k-planned" title="${title}">★ planned</span>`;
  if (x.kind === 'hard') return `<span class="kind k-hard" title="${title}">✕ ${why[0]}${why.length > 1 ? ` +${why.length - 1}` : ''}</span>`;
  if (x.kind === 'soft') return `<span class="kind k-soft" title="${title}">! ${why[0]}${why.length > 1 ? ` +${why.length - 1}` : ''}</span>`;
  return x.info.length ? `<span class="kind k-info" title="${title}">◌</span>` : '';
};

export const rowClass = (c: Ctx) => (r: Row) => 'k-' + (c.st.get(r.key)?.kind ?? 'ok');

// rail: planned/married score, or best remaining with the loss vs the plan
export const railMark = (c: Ctx) => (child: string) => {
  const x = c.sums.get(child);
  if (!x) return null;
  if (x.dead) return { mark: '☠', score: '—', title: `${child} is dead` };
  if (x.lost) return { mark: '✕', score: '—', title: `${child} can no longer be born` };
  if (x.intended && !x.broken)
    return { mark: x.intendedSt!.kind === 'married' ? '✓' : '★', score: String(x.intended.score ?? '—'), title: `${x.intendedSt!.kind}: × ${x.intended.parentLabel}` };
  if (x.broken) {
    const d = (x.best?.score ?? 0) - (x.intended!.score ?? 0);
    return {
      mark: '⚠',
      score: `${x.best?.score ?? '—'}<small class="${d < 0 ? 'neg' : 'pos'}">${d >= 0 ? '+' : ''}${d}</small>`,
      title: `Plan broken (× ${x.intended!.parentLabel}: ${[...x.intendedSt!.hard, ...x.intendedSt!.soft].join(', ')}). Best remaining: × ${x.best?.parentLabel ?? 'none'}`,
    };
  }
  return { mark: '', score: String(x.best?.score ?? '—'), title: `open — best remaining × ${x.best?.parentLabel ?? 'none'}` };
};

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function counts(ro: R.Roster) {
  const by: Record<string, string[]> = {};
  for (const [u, st] of Object.entries(ro.units)) (by[st] ??= []).push(u);
  const married = Object.keys(ro.married).length / 2, planned = Object.keys(ro.planned).length / 2;
  return { by, married: Math.ceil(married), planned: Math.ceil(planned) };
}
