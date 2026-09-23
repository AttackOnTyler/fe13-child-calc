// PROTOTYPE — Variant B "By child": master-detail. Left rail = children (best score each);
// centre = that child's variable parents, one row per parent, Robin's 56 asset/flaw combos
// collapsed into a group row that expands to an asset × flaw score heatmap; right = scoring panel.
import { AF_STATS, CHILDREN, CHILD_NAMES, STATS, type Row, type State } from './data';
import * as W from './controls';

export const name = 'By child (master-detail)';

const heat = (v: number | null) => (v == null ? 'transparent' : `hsl(${Math.round(v * 1.2)} 55% 32%)`);

export function render(root: HTMLElement, s: State, _rows: Row[], _total: number, all: Row[]) {
  const q = s.parentQuery.trim().toLowerCase();
  const pass = (r: Row) => (s.secondGen || !r.secondGen) && (!q || r.parentLabel.toLowerCase().includes(q));
  // rail: best score per child
  const bestBy = new Map<string, number>();
  for (const r of all) if (pass(r) && r.score != null) bestBy.set(r.child, Math.max(bestBy.get(r.child) ?? -1, r.score));
  const rail = CHILD_NAMES.map(
    (c) => `<button class="rail-item ${c === s.selectedChild ? 'on' : ''}" data-ctl="selectChild" data-v="${c}">
      <span>${c}</span><b>${bestBy.get(c) ?? '—'}</b></button>`,
  ).join('');

  // groups for selected child
  const groups = new Map<string, Row[]>();
  for (const r of all) if (r.child === s.selectedChild && pass(r)) (groups.get(r.groupKey) ?? groups.set(r.groupKey, []).get(r.groupKey)!).push(r);
  const gl = [...groups.values()].map((rs) => {
    const best = rs.reduce((a, b) => ((b.score ?? -1) > (a.score ?? -1) ? b : a));
    const scores = rs.map((r) => r.score).filter((x): x is number => x != null);
    return { rs, best, lo: Math.min(...scores), hi: Math.max(...scores) };
  });
  const dir = s.sort.dir;
  gl.sort((a, b) => ((a.best.score ?? -1) - (b.best.score ?? -1)) * dir);
  const isMorgan = s.selectedChild.startsWith('Morgan');

  const rowsHtml = gl
    .map(({ rs, best, lo, hi }) => {
      const multi = rs.length > 1;
      const open = !!s.expanded[best.groupKey];
      const dead = best.cls == null;
      const main = `<tr class="${dead ? 'dead' : ''} ${multi ? 'grouprow' : ''}" ${multi ? `data-ctl="expand" data-v="${best.groupKey}"` : ''}>
        <td>${multi ? (open ? '▾' : '▸') : ''} ${best.parentLabel} ${W.flags(best)}</td>
        <td>${multi ? `<span class="af">${best.robin}</span> <span class="muted">best of ${rs.length}</span>` : ''}</td>
        <td>${best.cls ?? '<span class="muted">unreachable</span>'}</td>
        <td class="num score">${W.scoreCell(best)}${multi && hi !== lo ? `<div class="range">${lo}–${hi}</div>` : ''}</td>
        <td class="num spd ${W.spdClass(best)}">${W.spdCell(best, s)}</td>
        <td class="statline">${best.value ? STATS.map((st, i) => `<span class="${s.weights[i] ? 'weighted' : 'muted'}">${st} <b>${best.value![i]}</b></span>`).join('') : ''}</td>
        <td class="statline mods">${best.mods.slice(1).map((m, i) => `<span class="${m > 0 ? 'pos' : m < 0 ? 'neg' : 'muted'}">${STATS[i + 1]}${W.signed(m)}</span>`).join('')}</td>
        <td class="build">${best.build}</td></tr>`;
      if (!multi || !open) return main;
      const byAF = new Map(rs.map((r) => [`${r.robinAsset}/${r.robinFlaw}`, r]));
      const grid = `<table class="heat"><tr><th>asset ↓ flaw →</th>${AF_STATS.map((f) => `<th>−${f}</th>`).join('')}</tr>${AF_STATS.map(
        (a) =>
          `<tr><th>+${a}</th>${AF_STATS.map((f) => {
            const r = byAF.get(`${a}/${f}`);
            return a === f ? '<td class="diag"></td>' : `<td style="background:${heat(r?.score ?? null)}" title="${r?.cls} · Spd ${r?.spd?.total}">${r?.score ?? ''}</td>`;
          }).join('')}</tr>`,
      ).join('')}</table>`;
      return main + `<tr class="expand"><td colspan="8"><div class="heatwrap">${grid}<p class="muted">Every combo is its own pairing (table dimension). Hover a cell for class + Spd. ${isMorgan ? 'This is the fixed Robin\'s asset/flaw.' : ''}</p></div></td></tr>`;
    })
    .join('');

  const panel = `<aside class="vb-panel ${s.panelOpen ? 'open' : ''}">
    <div class="vb-panel-head"><strong>Scoring</strong><button class="ghost only-phone" data-ctl="panel">✕</button></div>
    <label class="blk">Preset ${W.presetSelect(s)}</label>
    <div class="blk">Role ${W.roleSeg(s)} ${s.role === 'Support' ? W.rankSeg(s) : ''}</div>
    <div class="blk">Basis ${W.basisSeg(s)}</div>
    <label class="blk">Class ${W.classSelect(s)}</label>
    <h4>Weights</h4>${W.weightSliders(s)}
    <h4>Speed</h4>${W.speedInputs(s)}
    <h4>Filters</h4><div class="blk col">${W.filterBits(s)}</div>
  </aside>`;

  root.innerHTML = `<div class="vb">
    <nav class="vb-rail"><div class="muted small">Children · best ${W.presetLabel(s)}</div>${rail}</nav>
    <main class="vb-main">
      <header class="vb-head">
        <h2>${s.selectedChild}</h2>
        <span class="muted">fixed parent: ${CHILDREN.find((c) => c.name === s.selectedChild)!.fixed} · ${gl.length} variable parents · ${gl.reduce((a, g) => a + g.rs.length, 0).toLocaleString()} pairings</span>
        <button class="ghost only-phone" data-ctl="panel">Scoring ⚙</button>
      </header>
      <div class="vb-scroll"><table class="grid vb-table">
        <thead><tr><th>Variable parent</th><th>Robin</th><th>${s.cls === 'Auto' ? 'Class (Auto)' : 'Class'}</th>
        <th class="sortable ${s.sort.col === 'score' ? 'sorted' : ''}" data-ctl="sort" data-v="score">Score${s.sort.dir < 0 ? '▾' : '▴'}</th>
        <th>${s.role === 'Support' ? 'Spd pair-up' : 'Spd · bp'}</th><th>${s.role === 'Support' ? 'Pair-up bonus' : s.basis === 'Growths' ? 'Growth in class' : 'Caps'}</th><th>Modifiers</th><th>Best build</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
    </main>
    ${panel}
  </div>`;
}
