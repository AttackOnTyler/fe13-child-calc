// PROTOTYPE — host page = the chosen pairing-table layout (variant D, copied from ../skill-tab/host)
// with extra hooks for roster state: a universe filter (run facts), demoted (blocked) rows sorted
// last, per-row classes, rail marks, and extra rail entries (Roster / Plan views).
import { AF_STATS, CHILDREN, CHILD_NAMES, STATS, sortRows, type Row, type State } from '../pairing-table/data';
import * as W from '../pairing-table/controls';
import { board } from '../pairing-table/variantC';

export type Hooks = {
  rowCell?: (r: Row) => string; // extra <td> content after the parent cell
  selectedKey?: string | null; // highlighted row
  afterRow?: (r: Row, ncols: number) => string | null; // inline expansion under a row
  centre?: string | null; // replaces the child view
  centreHead?: string | null; // replaces the centre header
  panel?: string | null; // replaces the scoring panel body
  panelHead?: string; // extra bits in the panel head (tabs)
  panelTop?: string | null; // pinned above the panel body
  universe?: (r: Row) => boolean; // run facts (Robin gender / asset-flaw) remove rows entirely
  demote?: (r: Row) => boolean; // blocked rows sort last
  rowClass?: (r: Row) => string;
  railChildren?: string[];
  railTop?: string[]; // extra rail entries before 'All'
  railMark?: (c: string) => { mark: string; score: string; title?: string } | null;
  banner?: string | null; // above the child table
};
let H: Hooks = {};

// colour is relative to this group's own spread (combos often differ by only a few points)
const heat = (v: number | null, lo: number, hi: number) =>
  v == null ? 'transparent' : `hsl(${Math.round(((v - lo) / (hi - lo || 1)) * 120)} 55% 32%)`;
const COLS = ['caps', 'mods', 'growths', 'speed', 'build'] as const;

const th = (s: State, col: string, label: string, cls = '') => {
  const on = s.sort.col === col;
  return `<th class="sortable ${cls} ${on ? 'sorted' : ''}" data-ctl="sort" data-v="${col}">${label}${on ? (s.sort.dir < 0 ? '▾' : '▴') : ''}</th>`;
};

type Group = { rs: Row[]; best: Row; shown: Row; lo: number; hi: number };

function heatmap(g: Group, s: State, isMorgan: boolean) {
  const byAF = new Map(g.rs.map((r) => [`${r.robinAsset}/${r.robinFlaw}`, r]));
  const raws = g.rs.map((r) => r.raw).filter((x): x is number => x != null);
  const [lo, hi] = [Math.min(...raws), Math.max(...raws)];
  const bestAF = `${g.best.robinAsset}/${g.best.robinFlaw}`;
  const shownAF = `${g.shown.robinAsset}/${g.shown.robinFlaw}`;
  const grid = `<table class="heat"><tr><th>asset ↓ flaw →</th>${AF_STATS.map((f) => `<th>−${f}</th>`).join('')}</tr>${AF_STATS.map(
    (a) =>
      `<tr><th>+${a}</th>${AF_STATS.map((f) => {
        if (a === f) return '<td class="diag"></td>';
        const r = byAF.get(`${a}/${f}`);
        const k = `${a}/${f}`;
        return `<td class="cell ${k === bestAF ? 'best' : ''} ${k === shownAF ? 'shown' : ''}" style="background:${heat(r?.raw ?? null, lo, hi)}"
          data-ctl="pickAF" data-v="${g.best.groupKey}|${k}" title="+${a} −${f} · ${r?.cls} · Spd ${r?.spd?.total}">${r?.raw == null ? '' : r.raw.toFixed(1)}</td>`;
      }).join('')}</tr>`,
  ).join('')}</table>`;
  return `<div class="heatwrap">${grid}<div class="muted small heatnote">
    <div>Best for <b>${W.presetLabel(s)}</b> (${s.basis}, ${s.role}): <span class="af">${g.best.robin}</span> → ${g.best.raw?.toFixed(1)}</div>
    <div>Row shows: <span class="af">${g.shown.robin}</span>${g.shown !== g.best ? ' (picked — click it again to go back to best)' : ''}</div>
    <div>Colour: red = worst, green = best combo for this parent (${lo.toFixed(1)}–${hi.toFixed(1)}).</div>
    <div>Click a cell to show that combo in the row. Outline = best, ring = shown.</div>
    ${isMorgan ? "<div>This is the fixed Robin's asset/flaw.</div>" : ''}</div></div>`;
}

function childTable(s: State, all: Row[], pass: (r: Row) => boolean) {
  const g = s.cols;
  const isMorgan = s.selectedChild.startsWith('Morgan');
  const map = new Map<string, Row[]>();
  for (const r of all) if (r.child === s.selectedChild && pass(r)) (map.get(r.groupKey) ?? map.set(r.groupKey, []).get(r.groupKey)!).push(r);
  const groups = new Map<Row, Group>();
  for (const rs of map.values()) {
    const best = rs.reduce((a, b) => ((b.raw ?? -1) > (a.raw ?? -1) ? b : a));
    const pick = s.pickedAF[best.groupKey];
    const shown = (pick && rs.find((r) => `${r.robinAsset}/${r.robinFlaw}` === pick)) || best;
    const sc = rs.map((r) => r.score).filter((x): x is number => x != null);
    groups.set(shown, { rs, best, shown, lo: Math.min(...sc), hi: Math.max(...sc) });
  }
  const sorted = sortRows([...groups.keys()], s);
  const shownRows = H.demote ? [...sorted.filter((r) => !H.demote!(r)), ...sorted.filter((r) => H.demote!(r))] : sorted;

  const groupHead = `<tr class="grp"><th colspan="${H.rowCell ? 3 : 2}" class="stick k0">Pairing</th><th colspan="${g.speed ? 3 : 2}">Result</th>
    ${g.caps ? `<th colspan="8">${s.role === 'Support' ? 'Pair-up bonus' : s.basis === 'Growths' ? 'Growth in class' : 'Effective caps'} (${s.basis})</th>` : ''}
    ${g.mods ? '<th colspan="7" class="gmod">Modifiers</th>' : ''}${g.growths ? '<th colspan="8">Inherited growths</th>' : ''}
    ${g.build ? '<th>Build</th>' : ''}<th>#Cls</th></tr>`;
  const colHead = `<tr>${th(s, 'parent', 'Variable parent', 'stick k0')}${H.rowCell ? '<th>State</th>' : ''}<th>Robin</th>
    ${th(s, 'class', s.cls === 'Auto' ? 'Class (Auto)' : 'Class')}${th(s, 'score', 'Score')}${g.speed ? th(s, 'spd', s.role === 'Support' ? 'Spd pair-up' : 'Spd · bp') : ''}
    ${g.caps ? STATS.map((st, i) => th(s, 'c:' + i, st, 'num' + (s.weights[i] ? ' weighted' : ''))).join('') : ''}
    ${g.mods ? STATS.slice(1).map((st, i) => th(s, 'm:' + (i + 1), st, 'num gmod')).join('') : ''}
    ${g.growths ? STATS.map((st, i) => th(s, 'g:' + i, st, 'num')).join('') : ''}
    ${g.build ? '<th>Best build</th>' : ''}<th>#</th></tr>`;
  const ncols = (H.rowCell ? 1 : 0) + 5 - (g.speed ? 0 : 1) + (g.caps ? 8 : 0) + (g.mods ? 7 : 0) + (g.growths ? 8 : 0) + (g.build ? 1 : 0) + 1;

  const body = shownRows
    .map((r) => {
      const gr = groups.get(r)!;
      const multi = gr.rs.length > 1;
      const open = !!s.expanded[r.groupKey];
      const main = `<tr data-row="${r.key}" class="${r.cls == null ? 'dead' : ''} ${H.rowClass?.(r) ?? ''} ${multi ? 'grouprow' : ''} ${H.selectedKey === r.key ? 'selrow' : ''}" ${multi ? `data-ctl="expand" data-v="${r.groupKey}"` : ''}>
        <td class="stick k0">${multi ? (open ? '▾' : '▸') : ''} ${r.parentLabel} ${W.flags(r)}</td>${H.rowCell ? `<td class="skcell">${H.rowCell(r)}</td>` : ''}
        <td>${multi ? `<span class="af ${r !== gr.best ? 'picked' : ''}">${r.robin}</span> <span class="muted small">${r === gr.best ? `best of ${gr.rs.length}` : 'picked'}</span>` : ''}</td>
        <td>${r.cls ?? '<span class="muted">unreachable</span>'}</td>
        <td class="num score">${W.scoreCell(r)}${multi && gr.hi !== gr.lo ? `<div class="range">${gr.lo}–${gr.hi}</div>` : ''}</td>
        ${g.speed ? `<td class="num spd ${W.spdClass(r)}">${W.spdCell(r, s)}</td>` : ''}
        ${g.caps ? STATS.map((_, i) => `<td class="num">${r.value ? r.value[i] : ''}</td>`).join('') : ''}
        ${g.mods ? r.mods.slice(1).map((m) => `<td class="num gmod ${m > 0 ? 'pos' : m < 0 ? 'neg' : ''}">${W.signed(m)}</td>`).join('') : ''}
        ${g.growths ? r.growths.map((v) => `<td class="num ggro">${v}</td>`).join('') : ''}
        ${g.build ? `<td class="build muted">${r.build}</td>` : ''}<td class="num muted">${r.classSet.length}</td></tr>`;
      const heat = multi && open ? `<tr class="expand"><td colspan="${ncols}">${heatmap(gr, s, isMorgan)}</td></tr>` : '';
      const extra = H.afterRow?.(r, ncols);
      return main + heat + (extra ? `<tr class="expand skexpand"><td colspan="${ncols}">${extra}</td></tr>` : '');
    })
    .join('');
  const total = shownRows.reduce((a, r) => a + groups.get(r)!.rs.length, 0);
  return {
    sub: `fixed parent: ${CHILDREN.find((c) => c.name === s.selectedChild)!.fixed} · ${shownRows.length} variable parents · ${total.toLocaleString()} pairings`,
    html: `${H.banner ?? ''}<table class="grid vd-table"><thead>${groupHead}${colHead}</thead><tbody>${body}</tbody></table>`,
  };
}

export function render(root: HTMLElement, s: State, rows: Row[], total: number, all: Row[], hooks: Hooks = {}) {
  H = hooks;
  const q = s.parentQuery.trim().toLowerCase();
  const pass = (r: Row) => (!H.universe || H.universe(r)) && (s.secondGen || !r.secondGen) && (!q || r.parentLabel.toLowerCase().includes(q));
  const bestBy = new Map<string, number>();
  for (const r of all) if (pass(r) && r.score != null) bestBy.set(r.child, Math.max(bestBy.get(r.child) ?? -1, r.score));
  const bestAll = Math.max(-1, ...bestBy.values());
  const isAll = s.selectedChild === 'All';
  const rail = [...(H.railTop ?? []), 'All', ...(H.railChildren ?? CHILD_NAMES)]
    .map((c) => {
      const m = c === 'All' || H.railTop?.includes(c) ? null : H.railMark?.(c);
      const sc = c === 'All' ? (bestAll < 0 ? '—' : bestAll) : H.railTop?.includes(c) ? '' : m ? m.score : bestBy.get(c) ?? '—';
      return `<button class="rail-item ${c === s.selectedChild ? 'on' : ''} ${c === 'All' ? 'all' : ''} ${H.railTop?.includes(c) ? 'top' : ''}" data-ctl="selectChild" data-v="${c}" ${m?.title ? `title="${m.title}"` : ''}>
      <span>${m ? `<i class="rmark">${m.mark}</i> ` : ''}${c === 'All' ? 'All children' : c}</span><b>${sc}</b></button>`;
    })
    .join('');

  const colToggles = `<span class="coltog">Cols: ${COLS.map((c) => `<label><input type="checkbox" data-ctl="col" data-v="${c}" ${s.cols[c] ? 'checked' : ''}>${c}</label>`).join('')}</span>`;
  const view = H.centre != null
    ? { sub: '', html: '' }
    : isAll
    ? { sub: `${total.toLocaleString()} pairings · ranked by ${s.sort.col === 'spd' ? 'Speed' : W.presetLabel(s)}`, html: `<div class="vd-board">${board(rows, s)}</div>` }
    : childTable(s, all, pass);

  root.innerHTML = `<div class="vb vd">
    <nav class="vb-rail"><div class="muted small">Best ${W.presetLabel(s)}</div>${rail}</nav>
    <main class="vb-main">
      ${H.centreHead ?? `<header class="vb-head">
        <h2>${isAll ? 'All children' : s.selectedChild}</h2><span class="muted">${view.sub}</span>
        ${isAll ? W.robinBits(s) + ` <button class="ghost" data-ctl="sort" data-v="score">Score ${s.sort.col === 'score' && s.sort.dir > 0 ? '▴' : '▾'}</button><button class="ghost" data-ctl="sort" data-v="spd">Spd</button>` : colToggles}
        <button class="ghost only-phone" data-ctl="panel">Scoring ⚙</button>
      </header>`}
      <div class="vb-scroll">${H.centre ?? view.html}</div>
    </main>
    <aside class="vb-panel ${s.panelOpen ? 'open' : ''}">
      <div class="vb-panel-head">${H.panelHead ?? '<strong>Scoring</strong>'}<button class="ghost only-phone" data-ctl="panel">✕</button></div>
      ${H.panelTop ?? ''}
      ${H.panel ?? `<label class="blk">Preset ${W.presetSelect(s)}</label>
      <div class="blk">Context ${W.seg('ctx', ['All', 'Apotheosis', 'Main story', 'Full route'], (s as State & { ctx: string }).ctx)}</div>
      <div class="blk">Role ${W.roleSeg(s)} ${s.role === 'Support' ? W.rankSeg(s) : ''}</div>
      <div class="blk">Basis ${W.basisSeg(s)}</div>
      <label class="blk">Class ${W.classSelect(s)}</label>
      <h4>Weights</h4>${W.weightSliders(s)}
      <h4>Speed</h4>${W.speedInputs(s)}
      <h4>Filters</h4><div class="blk col">${W.filterBits(s)}</div>`}
    </aside>
  </div>`;
}
