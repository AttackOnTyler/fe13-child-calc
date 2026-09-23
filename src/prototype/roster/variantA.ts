// PROTOTYPE — Variant A "Row states": state lives where the decision is made. Every pairing row gets
// ★ plan / ✓ married buttons and a ⋯ menu to mark the units in it dead / benched / missed. Blocked
// rows stay in the table (hard = dimmed + sorted last, soft = amber) with the reason. Backup planning
// is per child: the rail shows the plan's score or ⚠ best-remaining with the loss, and a banner over
// the table says what broke and offers the best remaining pairing.
import type { Row } from '../pairing-table/data';
import type { Hooks } from './host';
import type { Ctx } from './main';
import * as R from './roster';
import * as U from './ui';

export const name = 'Row states';
const delta = (d: number) => `<span class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</span>`;
export const home = null;

export function hooks(c: Ctx): Hooks {
  const { s, ro, st, sums } = c;
  const k = U.counts(ro);
  const chips = (label: string, st: R.UState) =>
    k.by[st]?.length ? `<span class="sumchip s-${st}">${R.uIcon(st)} ${label}: ${k.by[st].join(', ')}</span>` : '';

  const sum = sums.get(s.selectedChild);
  let banner = '';
  if (sum) {
    if (sum.dead) banner = `<div class="banner hard">☠ ${sum.child} is dead — every pairing is gone. Set them back to available from any row's ⋯ menu.</div>`;
    else if (sum.lost) banner = `<div class="banner hard">✕ ${sum.child} can no longer be born — every pairing is hard-blocked (see the reasons in the State column).</div>`;
    else if (sum.broken) {
      const why = [...sum.intendedSt!.hard, ...sum.intendedSt!.soft].join(', ');
      const b = sum.best;
      banner = `<div class="banner warn">⚠ Plan broken: <b>${sum.child} × ${sum.intended!.parentLabel}</b> (${sum.intended!.score}) — ${why}.
        ${b ? `Best remaining: <b>× ${b.parentLabel}</b> ${b.robin ? `<span class="af">${b.robin}</span>` : ''} → ${b.score} (${delta((b.score ?? 0) - (sum.intended!.score ?? 0))})
        <button data-ctl="planRow" data-v="${U.esc(b.key)}">★ Plan it</button>` : 'Nothing left that fits the other plans.'}
        ${sum.bestSoft && sum.bestSoft !== b ? `<span class="muted small">If you break another plan: × ${sum.bestSoft.parentLabel} → ${sum.bestSoft.score} (${[...st.get(sum.bestSoft.key)!.soft].join(', ')})</span>` : ''}</div>`;
    } else if (sum.intended) {
      const x = sum.intendedSt!;
      banner = `<div class="banner ok">${x.kind === 'married' ? '✓ Parents married — this pairing is fixed.' : `★ Planned: × ${sum.intended.parentLabel} → ${sum.intended.score}.`}
        ${x.kind === 'planned' && sum.best && sum.best !== sum.intended && (sum.best.score ?? 0) > (sum.intended.score ?? 0) ? ` Better still open: × ${sum.best.parentLabel} → ${sum.best.score}.` : ''}</div>`;
    }
  }

  return {
    rowCell: (r: Row) => {
      const x = st.get(r.key);
      const plannedOn = x?.intended && x.kind !== 'married';
      return `<span class="rowacts">
        <button class="${plannedOn ? 'on' : ''}" data-ctl="planRow" data-v="${U.esc(r.key)}" title="Plan this pairing (locks every marriage it needs)">★</button><button class="${x?.kind === 'married' ? 'on' : ''}" data-ctl="marryRow" data-v="${U.esc(r.key)}" title="Mark the S-support as done">✓</button><button class="${s.menu === r.key ? 'on' : ''}" data-ctl="menu" data-v="${U.esc(r.key)}" title="Mark the units in this pairing">⋯</button>
        </span> ${U.kindChip(x)}`;
    },
    rowClass: U.rowClass(c),
    afterRow: (r: Row) => {
      if (s.menu !== r.key) return null;
      const x = st.get(r.key)!;
      const { units, marriages } = R.reqs(r);
      return `<div class="rowmenu">
        <div class="muted small">Needs ${marriages.map(([a, b]) => `<b>${a} × ${b}</b>`).join(' and ')}</div>
        ${units.map((u) => `<div class="urow"><span class="uname">${u}</span>${U.stateSeg(ro, u)}${ro.married[u] ? ` <span class="muted small">married ${ro.married[u]}</span>` : ro.planned[u] ? ` <span class="muted small">planned ${ro.planned[u]}</span>` : ''}</div>`).join('')}
        ${[...x.hard.map((w) => `<div class="neg small">✕ ${w}</div>`), ...x.soft.map((w) => `<div class="warn small">! ${w}</div>`), ...x.info.map((w) => `<div class="muted small">◌ ${w}</div>`)].join('')}
      </div>`;
    },
    railMark: U.railMark(c),
    banner,
    panelTop: `<div class="rosterbox">
      <div class="rb-head"><strong>Run</strong> ${U.rosterButtons()}</div>
      <div>${U.runFacts(ro)}</div>
      <div class="sums">${k.married ? `<span class="sumchip">✓ ${U.plural(k.married, 'marriage')}</span>` : ''}${k.planned ? `<span class="sumchip">★ ${U.plural(k.planned, 'plan')}</span>` : ''}
        ${chips('dead', 'dead')}${chips('missed', 'missed')}${chips('benched', 'benched')}${chips('later', 'later')}</div>
      <label class="small"><input type="checkbox" data-ctl="hideBlocked" ${s.hideBlocked ? 'checked' : ''}> Hide blocked rows</label>
      ${U.assumption(ro)}
    </div>`,
  };
}
