// PROTOTYPE — Variant B "Pairing page": picking a row replaces the centre with a full page for that
// pairing (breadcrumb back to the table). Build-first: tiered build CARDS with one source line per
// slot, then the skill pool as a sortable TABLE (skill · rank · best source · reclass · other sources).
import type { Row } from '../pairing-table/data';
import { RANK_LETTER, rank, rankChip, skillLink, srcShort, srcText, type Analysis, type BuildMatch } from './skills';
import type { Hooks } from './host';
import type { SkState } from './main';

export const name = 'Pairing page (build cards + skill table)';

export const card = (b: BuildMatch, s: SkState) => `<article class="vbk-card t${b.tier}">
  <header><b class="tier t${b.tier}">${b.tier}/5</b> <b>${b.t.name}</b>
    <span class="muted small">${b.t.role} · ${b.t.ctx.join('/')} · ${b.t.conf}</span>
    <span class="cost">${b.cost ? `reclass ${b.cost}: ${b.classes.join(', ')}` : 'no reclass'}</span></header>
  <ol>${b.slots
    .map((sl) =>
      sl.skill
        ? `<li>${rankChip(sl.skill, s.ctx)} <b>${skillLink(sl.skill)}</b>${sl.pref > 0 ? ` <span class="muted small">(fallback for ${sl.options[0]})</span>` : ''} <span class="muted">— ${srcText(sl.src)}</span></li>`
        : `<li class="miss-slot">✕ <b>${sl.options.map((o) => skillLink(o)).join(' / ')}</b> <span>— ${sl.reason}</span></li>`,
    )
    .join('')}</ol>
  ${b.notes.length ? `<div class="notes">${b.notes.map((n) => `<div>★ ${n}</div>`).join('')}</div>` : ''}
  <footer><button data-ctl="usePreset" data-v="${b.t.role}">Use this build's preset</button></footer>
</article>`;

function poolTable(a: Analysis, s: SkState) {
  const cost = (e: Analysis['pool'][number]) => (e.via[0].kind === 'class' && !e.via[0].start ? 1 : 0);
  const list = a.pool.filter((e) => s.showUnranked || e.rank > 0);
  const key = s.poolSort;
  list.sort((x, y) =>
    key === 'skill' ? x.skill.localeCompare(y.skill) : key === 'source' ? srcShort(x.via[0]).localeCompare(srcShort(y.via[0])) : key === 'cost' ? cost(x) - cost(y) || y.rank - x.rank : y.rank - x.rank || x.skill.localeCompare(y.skill),
  );
  const th = (k: string, l: string) => `<th class="sortable ${s.poolSort === k ? 'sorted' : ''}" data-ctl="poolSort" data-v="${k}">${l}</th>`;
  return `<table class="grid vbk-pool"><thead><tr>${th('skill', 'Skill')}${th('rank', 'Rank')}${th('source', 'Best source')}${th('cost', 'Reclass')}<th>Other sources</th></tr></thead><tbody>${list
    .map(
      (e) => `<tr class="${e.onlyVia ? 'onlyrow' : ''}"><td><b>${e.skill}</b>${e.onlyVia ? ` <span class="only-tag">only via ${e.onlyVia}</span>` : ''}${e.skill.startsWith('Rally') ? ' <span class="muted small">rally</span>' : ''}</td>
      <td>${rankChip(e.skill, s.ctx)}</td><td>${srcText(e.via[0])}</td><td class="num">${cost(e) ? '⟳1' : '—'}</td>
      <td class="muted small">${e.via.slice(1).map(srcShort).join(' · ')}</td></tr>`,
    )
    .join('')}</tbody></table>
    <label class="muted small"><input type="checkbox" data-ctl="showUnranked" ${s.showUnranked ? 'checked' : ''}> show unranked skills (${a.pool.filter((e) => !e.rank).length})</label>`;
}

export function hooks(s: SkState, a: Analysis | null, row: Row | null): Hooks {
  const base: Hooks = { selectedKey: s.sel, rowCell: (r: Row) => `<button class="ghost small" data-ctl="sel" data-v="${r.key}">Open ›</button>` };
  if (!a || !row) return base;
  const tiers = [5, 4, 3].map((t) => [t, a.builds.filter((b) => b.tier === t)] as const).filter(([, bs]) => bs.length);
  return {
    ...base,
    centreHead: `<header class="vb-head"><button class="ghost" data-ctl="sel" data-v="${row.key}">← ${a.child}</button>
      <h2>${a.child} × ${a.variable}${row.robin ? ` <span class="af">${row.robin}</span>` : ''}</h2>
      <span class="muted">${row.cls ?? '—'} · score ${row.score ?? '—'} · Spd ${row.spd?.total ?? '—'} · context <b>${s.ctx}</b></span>
      <button class="ghost only-phone" data-ctl="panel">Scoring ⚙</button></header>`,
    centre: `<div class="vbk">
      <section><h3>Rally coverage <span class="muted small">${a.rallies.filter((r) => r.src).length}/10</span></h3>
        <table class="vbk-rally"><tr>${a.rallies.map((r) => `<th>${r.skill.replace('Rally ', '')}</th>`).join('')}</tr>
        <tr>${a.rallies.map((r) => `<td class="${r.src ? 'ok' : 'no'}" title="${r.src ? srcText(r.src) : r.reason}">${r.src ? srcShort(r.src) : '✕'}</td>`).join('')}</tr></table></section>
      <section><h3>Suggested builds</h3>${
        tiers.length ? tiers.map(([t, bs]) => `<h4 class="tierhead">${t}/5 coverage · ${bs.length}</h4><div class="vbk-cards">${bs.map((b) => card(b, s)).join('')}</div>`).join('') : '<p class="muted">No template reaches 3/5 in this context.</p>'
      }</section>
      <section><h3>Skill pool <span class="muted small">${a.pool.length} reachable · starts ${a.start} · ranks ${RANK_LETTER.slice(1).join('<')}</span></h3>
        <p class="muted small">Inherit one from each parent: <b>${a.fixed}</b> ${a.fixedPool.forced ? `→ ${a.fixedPool.forced} (fixed)` : '(pick 1)'} · <b>${a.variable}</b> ${a.variablePool.forced ? `→ ${a.variablePool.forced} (fixed)` : '(pick 1)'}</p>
        ${poolTable(a, s)}</section>
    </div>`,
  };
}
void rank;
