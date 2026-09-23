// PROTOTYPE — Variant B "Roster board": a Roster view at the top of the rail is where the run is
// recorded — every unit with a state strip and a spouse picker (plan or married), and a children
// ledger with plan vs best remaining. The pairing table only READS state: blocked rows carry the
// reason, nothing is editable there. Backup planning = the ledger's "best remaining" column.
import { CHILDREN, UNITS, type Row } from '../pairing-table/data';
import type { Hooks } from './host';
import type { Ctx } from './main';
import * as R from './roster';
import * as U from './ui';

export const name = 'Roster board';
export const home = 'Roster';

function spouseOptions(c: Ctx, u: string): string[] {
  // who u could marry in this run, from the rows that exist
  const { ro, uni } = c;
  const out = new Set<string>();
  const robin = R.robinName(ro);
  for (const r of uni) {
    for (const [a, b] of R.reqs(r).marriages) {
      if (a === u) out.add(b);
      if (b === u) out.add(a);
    }
  }
  if (u === robin) for (const r of uni) if (r.child === R.morganName(ro)) out.add(r.parentLabel.split(' ← ')[0]);
  return [...out];
}

function unitRow(c: Ctx, u: string) {
  const { ro, sums, st } = c;
  const married = ro.married[u], planned = ro.planned[u];
  const sp = married ?? planned ?? '';
  const opts = spouseOptions(c, u);
  const taken = (o: string) => (ro.married[o] && ro.married[o] !== u ? `married ${ro.married[o]}` : ro.planned[o] && ro.planned[o] !== u ? `planned ${ro.planned[o]}` : '');
  // outcome: the child this unit fixes (mother / Chrom / Robin)
  const kids = [R.childOfMother(u), u === 'Chrom' ? 'Lucina' : null, u === R.robinName(ro) ? R.morganName(ro) : null].filter(Boolean) as string[];
  const out = kids
    .map((k) => {
      const x = sums.get(k);
      if (!x) return '';
      if (x.dead || x.lost) return `<span class="neg">→ ${k} ✕</span>`;
      if (x.intended && !x.broken) return `<span>→ ${k} <b>${x.intended.score}</b></span>`;
      if (x.broken) return `<span class="warn" title="${U.esc([...x.intendedSt!.hard, ...x.intendedSt!.soft].join(', '))}">→ ${k} ⚠ ${x.best ? `best left × ${x.best.parentLabel} ${x.best.score}` : 'nothing left'}</span>`;
      return `<span class="muted">→ ${k} best × ${x.best?.parentLabel ?? '—'} ${x.best?.score ?? ''}</span>`;
    })
    .join(' ');
  const noKids = !kids.length && u !== R.robinName(ro) && UNITS[u] && opts.length === 1 ? '<span class="muted small">Robin-only</span>' : '';
  void st;
  return `<tr class="${['dead', 'missed'].includes(R.uState(ro, u)) ? 'u-gone' : R.uState(ro, u) === 'benched' ? 'u-bench' : ''}">
    <td>${U.stateSeg(ro, u)}</td><td class="uname">${u}</td>
    <td><select data-ctl="spouse" data-u="${U.esc(u)}" data-mode="${married ? 'married' : 'planned'}"><option value="">—</option>${opts
      .map((o) => `<option value="${U.esc(o)}" ${o === sp ? 'selected' : ''}>${o}${taken(o) ? ` (${taken(o)})` : ''}${['dead', 'missed'].includes(R.uState(ro, o)) ? ' ☠' : ''}</option>`)
      .join('')}</select></td>
    <td>${sp ? `<span class="seg mini">${['planned', 'married'].map((m) => `<button data-ctl="spouseMode" data-u="${U.esc(u)}" data-v="${m}" class="${(m === 'married') === !!married ? 'on' : ''}">${m === 'married' ? '✓' : '★'}</button>`).join('')}</span>` : ''}</td>
    <td class="small">${out}${noKids}</td></tr>`;
}

function rosterView(c: Ctx) {
  const { ro, sums } = c;
  const { men, women, kids } = R.people(ro);
  const k = U.counts(ro);
  // per-child backups are greedy: flag a parent who is everyone's best remaining
  const want = new Map<string, string[]>();
  for (const kid of kids) {
    const x = sums.get(kid)!;
    const cur = x.intended && !x.broken;
    if (x.best && !cur) for (const [a, b] of R.reqs(x.best).marriages) for (const u of [a, b]) if (u !== R.fixedOf(kid)) want.set(u, [...(want.get(u) ?? []), kid]);
  }
  const contested = (r: Row, kid: string) => {
    const us = R.reqs(r).marriages.flat().filter((u) => u !== R.fixedOf(kid) && (want.get(u)?.length ?? 0) > 1);
    const who = us.map((u) => `${u} is also the best left for ${want.get(u)!.filter((x) => x !== kid).join(', ')}`);
    return us.length ? ` <span class="warn" title="${U.esc(who.join(' · '))}">⚔ ${us[0]} ×${want.get(us[0])!.length}</span>` : '';
  };
  const ledger = kids
    .map((kid) => {
      const x = sums.get(kid)!;
      const cur = x.intended && !x.broken ? x.intended : null;
      const d = x.broken && x.best ? (x.best.score ?? 0) - (x.intended!.score ?? 0) : null;
      const status = x.dead ? '<span class="neg">☠ dead</span>' : x.lost ? '<span class="neg">✕ can’t be born</span>'
        : x.broken ? `<span class="warn">⚠ ${[...x.intendedSt!.hard, ...x.intendedSt!.soft][0]}</span>`
        : cur ? (x.intendedSt!.kind === 'married' ? '<span class="pos">✓ parents married</span>' : '★ planned') : '<span class="muted">open</span>';
      return `<tr><td>${U.stateSeg(ro, kid)}</td><td class="uname"><a data-ctl="goto" data-v="${U.esc(kid)}">${kid}</a></td>
        <td class="muted">${R.fixedOf(kid)}</td>
        <td>${x.intended ? `${x.broken ? '<s>' : ''}× ${x.intended.parentLabel} ${x.intended.score}${x.broken ? '</s>' : ''}` : '—'}</td>
        <td>${x.best && (x.broken || !cur) ? `× ${x.best.parentLabel} ${x.best.robin ? `<span class="af">${x.best.robin}</span>` : ''} <b>${x.best.score}</b>${d != null ? ` <span class="${d < 0 ? 'neg' : 'pos'}">${d >= 0 ? '+' : ''}${d}</span>` : ''}
          <button class="mini" data-ctl="planRow" data-v="${U.esc(x.best.key)}" title="Plan it">★</button>${contested(x.best, kid)}` : ''}</td>
        <td>${status}</td></tr>`;
    })
    .join('');
  return `<div class="rv">
    <div class="rv-top">${U.runFacts(ro)} ${U.rosterButtons()}
      <span class="muted small">✓ ${k.married} married · ★ ${k.planned} planned</span> ${U.assumption(ro)}</div>
    <div class="legend muted small">${R.USTATES.map((x) => `${x.icon} ${x.label}`).join(' · ')} — spouse ★ = plan (soft), ✓ = S-support done (hard)</div>
    <h3>Children</h3>
    <table class="grid rv-ledger"><thead><tr><th>State</th><th>Child</th><th>Fixed parent</th><th>Plan / marriage</th><th>Best remaining (Δ vs plan)</th><th>Status</th></tr></thead><tbody>${ledger}</tbody></table>
    <div class="rv-cols">
      <div><h3>Women</h3><table class="grid rv-units"><tbody>${women.map((u) => unitRow(c, u)).join('')}</tbody></table></div>
      <div><h3>Men</h3><table class="grid rv-units"><tbody>${men.map((u) => unitRow(c, u)).join('')}</tbody></table></div>
    </div>
    <p class="muted small">Children marrying each other isn't tracked (it never changes a pairing) — except a child marrying Robin, set from Robin's spouse picker.</p>
  </div>`;
}

export function hooks(c: Ctx): Hooks {
  const { s, st } = c;
  const isRoster = s.selectedChild === 'Roster';
  void CHILDREN;
  return {
    railTop: ['Roster'],
    railMark: U.railMark(c),
    rowClass: U.rowClass(c),
    rowCell: (r: Row) => U.kindChip(st.get(r.key)),
    centre: isRoster ? rosterView(c) : null,
    centreHead: isRoster ? `<header class="vb-head"><h2>Roster</h2><span class="muted">record the run here — every table reads it</span><button class="ghost only-phone" data-ctl="panel">Scoring ⚙</button></header>` : null,
    panelTop: isRoster ? null : `<div class="rosterbox small"><label><input type="checkbox" data-ctl="hideBlocked" ${s.hideBlocked ? 'checked' : ''}> Hide blocked rows</label> <a data-ctl="selectChild" data-v="Roster">Edit roster →</a></div>`,
  };
}
