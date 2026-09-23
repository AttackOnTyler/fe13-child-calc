// PROTOTYPE — Variant A "Spreadsheet": one flat table of every pairing, all column groups,
// sticky two-row header + sticky key columns; every control in a dense toolbar above it.
import { STATS, type Row, type State } from './data';
import * as W from './controls';

export const name = 'Spreadsheet';

const th = (s: State, col: string, label: string, cls = '') => {
  const on = s.sort.col === col;
  return `<th class="sortable ${cls} ${on ? 'sorted' : ''}" data-ctl="sort" data-v="${col}">${label}${on ? (s.sort.dir < 0 ? '▾' : '▴') : ''}</th>`;
};

export function render(root: HTMLElement, s: State, rows: Row[], total: number) {
  const g = s.cols;
  const shown = rows.slice(0, s.limit);
  const groupHead = `<tr class="grp">
    <th colspan="3" class="stick k0">Pairing</th><th colspan="${g.speed ? 3 : 2}">Result</th>
    ${g.caps ? `<th colspan="8" class="gcap">${s.role === 'Support' ? 'Pair-up bonus' : s.basis === 'Growths' ? 'Growth in class' : 'Effective caps'} (${s.basis})</th>` : ''}
    ${g.mods ? '<th colspan="7" class="gmod">Modifiers</th>' : ''}
    ${g.growths ? '<th colspan="8" class="ggro">Inherited growths</th>' : ''}
    ${g.build ? '<th>Build</th>' : ''}<th>#Cls</th></tr>`;
  const colHead = `<tr>
    ${th(s, 'child', 'Child', 'stick k0')}${th(s, 'parent', 'Variable parent', 'stick k1')}<th class="stick k2">Robin</th>
    ${th(s, 'class', s.cls === 'Auto' ? 'Class (Auto)' : 'Class')}${th(s, 'score', 'Score')}${g.speed ? th(s, 'spd', s.role === 'Support' ? 'Spd pair-up' : 'Spd · bp') : ''}
    ${g.caps ? STATS.map((st, i) => th(s, 'c:' + i, st, 'num gcap' + (s.weights[i] ? ' weighted' : ''))).join('') : ''}
    ${g.mods ? STATS.slice(1).map((st, i) => th(s, 'm:' + (i + 1), st, 'num gmod')).join('') : ''}
    ${g.growths ? STATS.map((st, i) => th(s, 'g:' + i, st, 'num ggro')).join('') : ''}
    ${g.build ? '<th>Best build</th>' : ''}<th>#</th></tr>`;
  const body = shown
    .map((r) => {
      const dead = r.cls == null;
      return `<tr class="${dead ? 'dead' : ''}">
      <td class="stick k0">${r.child}</td><td class="stick k1">${r.parentLabel} ${W.flags(r)}</td><td class="stick k2">${W.robinTag(r)}</td>
      <td>${r.cls ?? '<span class="muted">unreachable</span>'}</td><td class="num score">${W.scoreCell(r)}</td>
      ${g.speed ? `<td class="num spd ${W.spdClass(r)}">${W.spdCell(r, s)}</td>` : ''}
      ${g.caps ? STATS.map((_, i) => `<td class="num gcap">${r.value ? r.value[i] : ''}</td>`).join('') : ''}
      ${g.mods ? r.mods.slice(1).map((m) => `<td class="num gmod ${m > 0 ? 'pos' : m < 0 ? 'neg' : ''}">${W.signed(m)}</td>`).join('') : ''}
      ${g.growths ? r.growths.map((v) => `<td class="num ggro">${v}</td>`).join('') : ''}
      ${g.build ? `<td class="build">${r.build}</td>` : ''}<td class="num muted">${r.classSet.length}</td></tr>`;
    })
    .join('');

  root.innerHTML = `<div class="va">
  <header class="va-bar">
    <strong class="brand">FE13 children</strong>
    <label>Preset ${W.presetSelect(s)}</label>
    <label>Class ${W.classSelect(s)}</label>
    <span>Basis ${W.basisSeg(s)}</span>
    <span>Role ${W.roleSeg(s)}</span>
    ${s.role === 'Support' ? `<span>Rank ${W.rankSeg(s)}</span>` : ''}
    <button class="ghost" data-ctl="panel">${s.panelOpen ? 'Hide' : 'Weights & Speed'} ⚙</button>
  </header>
  ${s.panelOpen ? `<section class="va-drawer">${W.weightSliders(s, true)}${W.speedInputs(s)}</section>` : ''}
  <section class="va-filters">
    ${W.childChips(s)}
    <span class="row">${W.filterBits(s)} ${W.robinBits(s)}
      <span class="coltog">Cols:
        ${(['caps', 'mods', 'growths', 'speed', 'build'] as const).map((c) => `<label><input type="checkbox" data-ctl="col" data-v="${c}" ${s.cols[c] ? 'checked' : ''}>${c}</label>`).join('')}
      </span></span>
  </section>
  <div class="count">${total.toLocaleString()} pairings match · showing ${shown.length.toLocaleString()}${rows.length > shown.length ? ` <button class="ghost" data-ctl="more">show 500 more</button>` : ''}</div>
  <div class="va-scroll"><table class="grid">
    <thead>${groupHead}${colHead}</thead><tbody>${body}</tbody></table></div>
  </div>`;
}
