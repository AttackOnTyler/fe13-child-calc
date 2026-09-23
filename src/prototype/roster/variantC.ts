// PROTOTYPE — Variant C "Plan solver": the unit of planning is the whole marriage plan, not one
// child. A solver picks the marriages that maximise Σ priority × score over all children (one spouse
// each; married + pinned pairs fixed; Robin's partner and — while open — asset/flaw searched). When a
// unit dies or is benched, pins through it break and the plan re-solves around them; a diff shows what
// changed vs the saved plan. Unit states are set from a compact roster strip.
import type { Row } from '../pairing-table/data';
import type { Hooks } from './host';
import type { Ctx } from './main';
import * as R from './roster';
import * as U from './ui';

export const name = 'Plan solver';
export const home = 'Plan';

const kidChip = (k: R.Kid, saved: Record<string, number> | undefined) => {
  const was = saved?.[k.child];
  const d = was == null ? null : k.score - was;
  return `<span class="kid"><a data-ctl="goto" data-v="${U.esc(k.child)}">${k.child}</a> <b>${k.score}</b>${d ? ` <span class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</span>`;
};

function planView(c: Ctx) {
  const { ro } = c;
  const p = c.plan();
  const saved = ro.saved;
  const { men, women, kids } = R.people(ro);
  const strip = (us: string[]) =>
    us.map((u) => `<button class="uchip s-${R.uState(ro, u)}" data-ctl="ucycle" data-u="${U.esc(u)}" title="${R.USTATES.find((x) => x.k === R.uState(ro, u))!.label} — click to cycle">${R.uIcon(R.uState(ro, u))} ${u}</button>`).join('');

  // diff vs saved plan
  let diff = '';
  if (saved) {
    // spouse changes, told per unit ("Stahl: Olivia → Tharja")
    const spouseIn = (pairs: string[], u: string) => pairs.map((x) => x.split(' × ')).find((x) => x.includes(u))?.find((x) => x !== u) ?? null;
    const nowPairs = p.pairs.map((x) => R.pairKey(x.m, x.f));
    const moves = men.flatMap((u) => {
      const a = spouseIn(saved.pairs, u), b = spouseIn(nowPairs, u);
      return a === b ? [] : [{ u, a, b }];
    });
    const gone = moves.filter((x) => x.a && !x.b), added = moves.filter((x) => x.b);
    const lost = Object.keys(saved.scores).filter((k) => !p.kids[k]);
    const moved = Object.values(p.kids).filter((k) => saved.scores[k.child] != null && saved.scores[k.child] !== k.score);
    const was = Object.values(saved.scores).reduce((a, b) => a + b, 0);
    const is = Object.values(p.kids).reduce((a, k) => a + k.score, 0);
    diff = gone.length || added.length || lost.length || moved.length
      ? `<div class="banner warn"><b>Changed vs saved plan</b> (Σ score ${was} → ${is}, ${is - was >= 0 ? '+' : ''}${is - was})
        ${lost.length ? `<div class="neg">✕ Lost: ${lost.map((k) => `${k} (${saved.scores[k]})`).join(', ')}</div>` : ''}
        ${added.length ? `<div>⇄ ${added.map((x) => `<b>${x.u}</b>: ${x.a ?? '—'} → ${x.b}`).join(' · ')}</div>` : ''}${gone.length ? `<div class="muted">unmarried: ${gone.map((x) => `${x.u} (was ${x.a})`).join(' · ')}</div>` : ''}
        ${moved.length ? `<div>${moved.map((k) => `${k.child} ${saved.scores[k.child]}→${k.score}`).join(' · ')}</div>` : ''}
        <button data-ctl="adopt">Adopt the new plan</button></div>`
      : '<div class="banner ok">✓ Matches the saved plan.</div>';
  }
  const rows = p.pairs
    .map((x) => `<tr class="how-${x.how}"><td>${x.how === 'married' ? '✓' : x.how === 'planned' ? '📌' : ''}</td>
      <td class="uname">${x.m}</td><td class="muted">×</td><td class="uname">${x.f}</td>
      <td>${x.kids.map((k) => kidChip(k, saved?.scores)).join(' ') || '<span class="muted">no child in this run</span>'}</td>
      <td class="nowrap">${x.how === 'married' || x.f === 'Maiden' ? '' : `<button class="mini ${x.how === 'planned' ? 'on' : ''}" data-ctl="pin" data-a="${U.esc(x.m)}" data-b="${U.esc(x.f)}" title="Pin — the solver must keep it">📌</button><button class="mini" data-ctl="ban" data-a="${U.esc(x.m)}" data-b="${U.esc(x.f)}" title="Rule this marriage out">✕</button>`}</td></tr>`)
    .join('');
  return `<div class="pv">
    <div class="rv-top">${U.runFacts(ro)} ${U.rosterButtons()} ${U.assumption(ro)}</div>
    <div class="rv-top"><b>Σ ${Math.round(p.total)}</b> <span class="muted small">priority-weighted · solved in ${p.ms} ms${ro.robinAF ? '' : ` · asset/flaw open → solver picked <span class="af">+${p.af?.replace('/', ' −')}</span>`}</span>
      <label class="small"><input type="checkbox" data-ctl="freeReplan" ${ro.freeReplan ? 'checked' : ''}> Free re-plan (ignore pins)</label>
      <button data-ctl="adopt" title="Pin every proposed marriage and save this as the baseline">Adopt as plan</button></div>
    ${p.brokenPins.length ? `<div class="banner hard"><div>📌✕ Broken pins: ${p.brokenPins.map((b) => `<b>${b.pair}</b> (${b.why})`).join(' · ')} — re-planned around them.</div></div>` : ''}
    ${diff}
    <table class="grid pv-pairs"><thead><tr><th></th><th>Husband</th><th></th><th>Wife</th><th>Children (Δ vs saved)</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    ${p.unborn.length ? `<div class="muted small">Not born in this plan: ${p.unborn.join(', ')}</div>` : ''}
    ${ro.bans.length ? `<div class="muted small">Ruled out: ${ro.bans.map((b) => { const [a, bb] = b.split(' × '); return `${b} <button class="mini" data-ctl="ban" data-a="${U.esc(a)}" data-b="${U.esc(bb)}">↺</button>`; }).join(' ')}</div>` : ''}
    <h3>Roster <span class="muted small">(click to cycle ${R.USTATES.map((x) => x.icon + ' ' + x.label.toLowerCase()).join(' → ')})</span></h3>
    <div class="ustrip">${strip(women)}</div><div class="ustrip">${strip(men)}</div><div class="ustrip">${strip(kids)}</div>
  </div>`;
}

export function hooks(c: Ctx): Hooks {
  const { s, ro, st } = c;
  const isPlan = s.selectedChild === 'Plan';
  const p = c.plan();
  const inPlan = new Set(Object.values(p.kids).map((k) => k.key));
  return {
    railTop: ['Plan'],
    railMark: (child) => {
      const k = p.kids[child];
      if (R.uState(ro, child) === 'dead') return { mark: '☠', score: '—', title: 'dead' };
      if (!k) return { mark: '✕', score: '—', title: 'not born in this plan' };
      const was = ro.saved?.scores[child];
      const d = was == null ? 0 : k.score - was;
      return { mark: '', score: `${k.score}${d ? `<small class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${d}</small>` : ''}`, title: k.key };
    },
    rowClass: (r: Row) => U.rowClass(c)(r) + (inPlan.has(r.key) ? ' inplan' : ''),
    rowCell: (r: Row) => `${inPlan.has(r.key) ? '<span class="kind k-plan">◆ in plan</span> ' : ''}${U.kindChip(st.get(r.key))}`,
    centre: isPlan ? planView(c) : null,
    centreHead: isPlan ? `<header class="vb-head"><h2>Marriage plan</h2><span class="muted">best whole-roster plan for <b>${s.preset >= 0 ? 'the current preset' : ''}</b></span><button class="ghost only-phone" data-ctl="panel">Scoring ⚙</button></header>` : null,
    panelTop: `<div class="rosterbox"><strong>Child priority</strong> <span class="muted small">0 = don't care · 3 = must be great</span>
      <div class="prios">${R.people(ro).kids.map((k) => `<label class="w"><span>${k}</span><input type="range" min="0" max="3" value="${ro.priority[k] ?? 1}" data-ctl="prio" data-c="${U.esc(k)}"><b>${ro.priority[k] ?? 1}</b></label>`).join('')}</div>
      <label class="small"><input type="checkbox" data-ctl="hideBlocked" ${s.hideBlocked ? 'checked' : ''}> Hide blocked rows</label></div>`,
  };
}
