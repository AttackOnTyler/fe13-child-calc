// PROTOTYPE — Variant C "Leaderboard": score-first ranked list, phone-first. Preset pills are the
// primary affordance; weights/speed live in a Tune sheet. Each row is a compact card with a
// per-stat bar strip; tap to expand the full growths / modifiers / caps matrix.
import { CLASSES, STATS, type Row, type State } from './data';
import * as W from './controls';

export const name = 'Leaderboard';

const bars = (r: Row, s: State) => {
  if (!r.value || !r.cls) return '';
  const max = s.role === 'Support' ? 8 : s.basis === 'Growths' ? 130 : 85;
  return `<div class="bars">${STATS.map((st, i) => {
    const v = r.value![i];
    const pct = Math.max(4, Math.min(100, (v / max) * 100));
    const off = s.mixed && ((i === 1 && r.tag === 'M') || (i === 2 && r.tag === 'S'));
    return `<div class="bar ${s.weights[i] && !off ? 'weighted' : ''}" title="${st} ${v}"><i style="height:${pct}%"></i><span>${st}</span></div>`;
  }).join('')}</div>`;
};

const matrix = (r: Row, s: State) => `<table class="matrix">
  <tr><th></th>${STATS.map((st) => `<th>${st}</th>`).join('')}</tr>
  <tr><th>Growth</th>${r.growths.map((v) => `<td>${v}</td>`).join('')}</tr>
  <tr><th>Mod</th>${r.mods.map((v, i) => `<td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${i ? W.signed(v) : ''}</td>`).join('')}</tr>
  <tr><th>Class max</th>${r.cls ? CLASSES[r.cls].max.map((v) => `<td class="muted">${v}</td>`).join('') : ''}</tr>
  <tr><th>${s.role === 'Support' ? 'Pair-up' : s.basis === 'Growths' ? 'Growth+cls' : 'Eff. cap'}</th>${r.value ? r.value.map((v) => `<td><b>${v}</b></td>`).join('') : ''}</tr>
</table>
<div class="muted small">Reachable final classes: ${r.classSet.join(', ')} · Best build: ${r.build}${r.assumptions.length ? ` · ⚠ ${r.assumptions.join(', ')}` : ''}</div>`;

// Also reused by Variant D's "All children" view.
export function board(rows: Row[], s: State) {
  const shown = rows.slice(0, s.limit);
  const list = shown
    .map((r, idx) => {
      const open = !!s.expanded[r.key];
      return `<li class="card ${r.cls == null ? 'dead' : ''} ${open ? 'open' : ''}" data-ctl="expand" data-v="${r.key}">
        <div class="rank">${r.cls == null ? '' : idx + 1}</div>
        <div class="big">${W.scoreCell(r)}</div>
        <div class="who"><div><b>${r.child}</b> <span class="muted">×</span> ${r.parentLabel} ${W.robinTag(r)} ${W.flags(r)}</div>
          <div class="muted small">${r.cls ?? 'cannot reach ' + s.cls}${s.cls === 'Auto' && r.cls ? ' (auto)' : ''}</div></div>
        <div class="spdchip ${W.spdClass(r)}">${s.role === 'Support' ? 'Spd ' : ''}${W.spdCell(r, s)}</div>
        ${bars(r, s)}
        ${open ? `<div class="detail">${matrix(r, s)}</div>` : ''}
      </li>`;
    })
    .join('');
  return `<ol class="board">${list}</ol>
    ${rows.length > shown.length ? `<div class="count"><button class="ghost" data-ctl="more">Show more (${(rows.length - shown.length).toLocaleString()} left)</button></div>` : ''}`;
}

export function render(root: HTMLElement, s: State, rows: Row[], total: number) {
  root.innerHTML = `<div class="vc">
    <header class="vc-top">
      <div class="pills">${W.presetPills(s)}</div>
      <div class="vc-row">
        ${W.roleSeg(s)} ${W.basisSeg(s)} ${W.classSelect(s)}
        <button class="ghost" data-ctl="panel">Tune ⚙</button>
        <button class="ghost" data-ctl="sort" data-v="score">Score ${s.sort.dir < 0 ? '▾' : '▴'}</button>
        <button class="ghost" data-ctl="sort" data-v="spd">Spd</button>
      </div>
      <div class="vc-row filters">${W.childChips(s)}</div>
      <div class="vc-row">${W.filterBits(s)} ${W.robinBits(s)}</div>
    </header>
    ${s.panelOpen ? `<div class="sheet"><div class="sheet-inner"><div class="vb-panel-head"><strong>Tune ${W.presetLabel(s)}</strong><button class="ghost" data-ctl="panel">Done</button></div>
      ${s.role === 'Support' ? `<div>Support rank ${W.rankSeg(s)}</div>` : ''}${W.weightSliders(s)}<h4>Speed</h4>${W.speedInputs(s)}</div></div>` : ''}
    <div class="count">${total.toLocaleString()} pairings · ranked by ${s.sort.col === 'spd' ? 'Speed' : W.presetLabel(s)}</div>
    ${board(rows, s)}
  </div>`;
}
