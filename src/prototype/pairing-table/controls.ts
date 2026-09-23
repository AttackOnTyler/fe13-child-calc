// PROTOTYPE — throwaway. Small shared widgets (strings with data-ctl hooks) + cell formatters.
// Layout is NOT shared: each variant places these however it wants.
import { AF_STATS, CHILD_NAMES, CLASS_NAMES, PRESETS, STATS, presetModified, type Row, type State } from './data';

export const presetLabel = (s: State) => PRESETS[s.preset].name + (presetModified(s) ? '*' : '');

export const presetSelect = (s: State) =>
  `<select data-ctl="preset">${PRESETS.map((p, i) => `<option value="${i}" ${i === s.preset ? 'selected' : ''}>${p.name}${i === s.preset && presetModified(s) ? '*' : ''}</option>`).join('')}</select>`;

export const presetPills = (s: State) =>
  PRESETS.map((p, i) => `<button class="pill ${i === s.preset ? 'on' : ''}" data-ctl="preset" data-v="${i}">${p.name}${i === s.preset && presetModified(s) ? '*' : ''}</button>`).join('');

export const seg = (ctl: string, opts: string[], cur: string, disabled: string[] = []) =>
  `<span class="seg">${opts.map((o) => `<button data-ctl="${ctl}" data-v="${o}" class="${o === cur ? 'on' : ''}" ${disabled.includes(o) ? 'disabled title="Growths is disabled in Support role"' : ''}>${o}</button>`).join('')}</span>`;

export const classSelect = (s: State) =>
  `<select data-ctl="cls"><option ${s.cls === 'Auto' ? 'selected' : ''}>Auto</option>${CLASS_NAMES.map((c) => `<option ${c === s.cls ? 'selected' : ''}>${c}</option>`).join('')}</select>`;

export const basisSeg = (s: State) => seg('basis', ['Caps+LB', 'Caps', 'Growths'], s.basis, s.role === 'Support' ? ['Growths'] : []);
export const roleSeg = (s: State) => seg('role', ['Lead', 'Support'], s.role);
export const rankSeg = (s: State) => seg('rank', ['C/B', 'A/S'], s.rank);

export const weightSliders = (s: State, compact = false) =>
  `<div class="weights ${compact ? 'compact' : ''}">${STATS.map(
    (st, i) =>
      `<label class="w"><span>${st}</span><input type="range" min="0" max="3" step="1" value="${s.weights[i]}" data-ctl="w" data-i="${i}"><b>${s.weights[i]}</b></label>`,
  ).join('')}<label class="w mixed"><input type="checkbox" data-ctl="mixed" ${s.mixed ? 'checked' : ''}> Mixed (max Str/Mag)</label></div>`;

export const speedInputs = (s: State) => `<div class="speed-inputs">
  <label>Rally <select data-ctl="rally">${[0, 4, 8, 10].map((v) => `<option value="${v}" ${v === s.rally ? 'selected' : ''}>${v ? '+' + v : 'None'}</option>`).join('')}</select></label>
  <label><input type="checkbox" data-ctl="tonic" ${s.tonic ? 'checked' : ''}> Tonic +2</label>
  <label>Pair-up Spd <input type="number" min="0" max="10" value="${s.pairSpd}" data-ctl="pairSpd" style="width:3.2em"></label>
  <span class="muted" title="Helper: pick a support class + rank to fill Pair-up Spd">helper ▾</span>
  <span class="muted assume" title="Assumption: enemy Spd unverified — editable">bp ${s.breakpoints.join('/')} ✎</span>
</div>`;

export const childChips = (s: State) =>
  `<span class="chips">${CHILD_NAMES.map((c) => `<button class="chip ${s.children.includes(c) ? 'on' : ''}" data-ctl="child" data-v="${c}">${c}</button>`).join('')}</span>`;

export const filterBits = (s: State) => `
  <input type="search" placeholder="Variable parent…" value="${s.parentQuery}" data-ctl="parentQuery">
  <label><input type="checkbox" data-ctl="secondGen" ${s.secondGen ? 'checked' : ''}> 2nd-gen parents</label>
  <label><input type="checkbox" data-ctl="dlc" ${s.dlc ? 'checked' : ''}> DLC</label>`;

export const robinBits = (s: State) =>
  `<span class="robin-ctl">Robin ${seg('robinMode', ['all', 'best', 'pick'], s.robinMode)}${
    s.robinMode === 'pick'
      ? ` <select data-ctl="asset">${AF_STATS.map((a) => `<option ${a === s.asset ? 'selected' : ''}>${a}</option>`).join('')}</select>` +
        ` <select data-ctl="flaw">${AF_STATS.map((a) => `<option ${a === s.flaw ? 'selected' : ''}>${a}</option>`).join('')}</select>`
      : ''
  }</span>`;

// ---- cells ----
export const scoreCell = (r: Row) => (r.cls == null ? '' : r.score == null ? '—' : `${r.score}${r.tag ? `<sup class="tag">${r.tag}</sup>` : ''}`);
export const spdCell = (r: Row, s: State) => {
  if (!r.spd) return '';
  if (s.role === 'Support') return `+${r.spd.total}`;
  const { total, bp, margin } = r.spd;
  return bp == null ? `${total} · <span class="miss">— (${margin})</span>` : `${total} · ${bp} <span class="margin">(+${margin})</span>`;
};
export const spdClass = (r: Row) => (!r.spd || r.spd.bp == null ? 'bp-none' : `bp-${r.spd.bp}`);
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
export const flags = (r: Row) => (r.assumptions.length ? `<span class="warn" title="Rests on assumption: ${r.assumptions.join(', ')}">⚠</span>` : '');
export const robinTag = (r: Row) => (r.robin ? `<span class="af">${r.robin}</span>` : '');
