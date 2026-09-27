/// <reference types="vite/client" />
// PROTOTYPE — throwaway (#173). "Three ways for every number to explain its math, assumptions and blind spots, on the
// locked Run view and Wishlist tab from #143 (Before Chapter 2), switchable via ?variant=A|B|C; chance wording via
// ?wording=pct|odds|both." Every number is invented (proof.ts).
//   A — Receipt in place: click a number, its receipt opens right under it. Blind spots only inside the receipt.
//   B — Why panel: a side panel follows the number you click; markers flag numbers a blind spot leans on.
//   C — Proof tab: numbers link to a third tab, Proof, which holds the trail and the whole assumptions list.
import { EDITS, baseWishlist } from '../wishlist-editing/model';
import {
  CEILING, CORRECTIONS, FLAWLESS, MAPS, PAIRED_ERR, RULES, RUNS, SIM_ERR, SPOTS, correctionsFor, explain, rulesFor, spotsFor,
  type Expl, type Spot,
} from './proof';

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const VARIANTS = { A: 'Receipt in place', B: 'Why panel', C: 'Proof tab' } as const;
type V = keyof typeof VARIANTS;
type Wording = 'pct' | 'odds' | 'both';
const q = new URLSearchParams(location.search);
let variant = (q.get('variant') ?? 'A') as V;
if (!(variant in VARIANTS)) variant = 'A';
let wording = (q.get('wording') ?? 'both') as Wording;

const S = {
  tab: 'run' as 'run' | 'wishlist' | 'proof',
  /** The drill path: the number opened first, then each row followed. */
  path: [] as string[],
  /** A: which host row the receipt opened under. */
  host: '',
  cell: 'gerome',
  showAll: false,
  back: 'run' as 'run' | 'wishlist',
};
const w = baseWishlist();

// ---- Wording near the edges ----------------------------------------------------------------------------------
const round2 = (n: number) => { const e = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / e) * e; };
/** A chance as the player reads it. Past 99.9% the model's own blind spots outweigh the digits. */
function chance(p: number, mode: Wording = wording, kills = false): string {
  const pc = p > 0.999 ? 'over 99.9%' : p < 0.001 ? 'under 0.1%' : p >= 0.99 || p <= 0.01 ? `${(p * 100).toFixed(1)}%` : `${(p * 100).toFixed(1)}%`;
  let odds = '';
  if (kills) odds = p < 0.001 ? 'kills someone less than 1 run in 1,000' : `kills someone about 1 run in ${round2(1 / p).toLocaleString()}`;
  else if (p > 0.999) odds = 'loses a unit less than 1 run in 1,000';
  else if (p >= 0.9) odds = `loses a unit about 1 run in ${round2(1 / (1 - p)).toLocaleString()}`;
  else if (p < 0.001) odds = 'flawless less than 1 run in 1,000';
  else if (p <= 0.1) odds = `flawless about 1 run in ${round2(1 / p).toLocaleString()}`;
  else odds = `about ${Math.round(p * 10)} run${Math.round(p * 10) > 1 ? 's' : ''} in 10`;
  if (mode === 'pct') return pc;
  if (mode === 'odds') return odds;
  return `${pc} <small>(${odds})</small>`;
}
const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d).toFixed(1);
/** A points difference, with close calls worded as such. */
const pts = (d: number, err = PAIRED_ERR) =>
  Math.abs(d) < 2 * err ? `<span class="cost noise">no measurable difference <small>(${sign(d)} ±${err})</small></span>` : `<span class="cost ${d < 0 ? 'neg' : 'pos'}">${sign(d)}</span>`;
const valueOf = (e: Expl) => (e.unit === 'pts' ? pts(e.value) : chance(e.value, wording, e.kind === 'fight'));
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ---- Numbers ----------------------------------------------------------------------------------------------------
/** A number that explains itself. B adds a marker when an optimistic blind spot leans on it. */
function num(id: string, text: string, host = id): string {
  const e = explain(id);
  const lean = spotsFor(e).filter((s) => s.lean === 'optimistic' && s.stress);
  const mark = variant === 'B' && lean.length ? `<sup class="mark" title="Probably optimistic: ${lean.map((s) => s.name).join(', ')}">▲</sup>` : '';
  const on = S.path[0] === id && (variant !== 'A' || S.host === host);
  return `<button class="num ${on ? 'on' : ''}" data-num="${id}" data-host="${host}">${text}${mark}</button>`;
}
/** A: the receipt opens under the row that hosts the number. */
const slot = (host: string) => (variant === 'A' && S.path.length && S.host === host ? `<div class="receipt">${receipt()}</div>` : '');

// ---- The explanation --------------------------------------------------------------------------------------------
function crumbs(): string {
  return `<div class="crumbs">${S.path.map((id, i) => {
    const e = explain(id);
    const t = e.title.length > 34 ? e.title.slice(0, 32) + '…' : e.title;
    return i === S.path.length - 1 ? `<b>${esc(t)}</b>` : `<button class="link" data-crumb="${i}">${esc(t)}</button>`;
  }).join(' › ')}<button class="x" data-close>✕</button></div>`;
}

function rows(e: Expl, bars: boolean): string {
  if (!e.rows) return '';
  const max = Math.max(...e.rows.map((r) => Math.abs(r.pts ?? 0)), 0.1);
  return `<h4>${e.rowsTitle}</h4><table class="t rows">${e.rows.map((r) => `<tr class="${r.to ? 'drill' : ''}" ${r.to ? `data-drill="${r.to}"` : ''}>
      <td>${esc(r.label)}${r.note ? ` <span class="chip dim">${r.note}</span>` : ''}</td>
      <td class="v">${r.value ? esc(r.value) : ''}</td>
      <td class="v">${r.pts !== undefined ? `<span class="cost ${r.pts < 0 ? 'neg' : 'pos'}">${sign(r.pts)}</span>` : ''}</td>
      ${bars ? `<td class="barcell">${r.pts !== undefined ? `<i class="${r.pts < 0 ? 'neg' : 'pos'}" style="width:${(Math.abs(r.pts) / max) * 100}%"></i>` : ''}</td>` : ''}
      <td>${r.to ? '›' : ''}</td></tr>`).join('')}</table>`;
}

const leanChip = (s: Spot) =>
  `<span class="chip ${s.lean === 'optimistic' ? 'warn' : s.lean === 'pessimistic' ? 'ok' : 'dim'}" title="${s.lean === 'optimistic' ? 'the real chance is probably lower' : s.lean === 'pessimistic' ? 'the real chance is probably higher' : 'could go either way'}">${s.lean === 'optimistic' ? '▲ may read high' : s.lean === 'pessimistic' ? '▼ may read low' : '◆ either way'}</span>`;

function spotLine(s: Spot, e?: Expl): string {
  const stress = s.stress && e && (e.kind === 'flawless') ? ` <small class="stress">Stress test ${s.stress.label}: ${chance(FLAWLESS, 'pct')} → <b>${chance(s.stress.flawless, 'pct')}</b></small>` : '';
  return `<div class="spot">${leanChip(s)} <b>${esc(s.name)}</b> <small>${esc(s.gist)} Bites on ${esc(s.bites)}.</small>${stress}</div>`;
}

function blindSpots(e: Expl): string {
  const ss = spotsFor(e);
  const rs = rulesFor(e).filter((r) => r.status !== 'checked');
  const cs = correctionsFor(e);
  return `<h4>Not counted in this number</h4>${ss.map((s) => spotLine(s, e)).join('')}
    ${rs.length || cs.length ? `<h4>Stated assumptions it rests on</h4>${rs.map(ruleLine).join('')}${cs.map(corrLine).join('')}` : ''}
    <button class="link" data-all>All stated assumptions →</button>`;
}

function receipt(bars = false): string {
  const e = explain(S.path[S.path.length - 1]!);
  return `${crumbs()}
    <div class="big">${valueOf(e)}</div>
    <p>${esc(e.lead)}</p>
    <ul class="math">${e.math.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    ${rows(e, bars)}
    ${e.stop ? `<p class="stop">⏹ ${esc(e.stop)} ${e.kind === 'fight' ? '<button class="link">open the matchup</button>' : ''}</p>` : ''}
    ${blindSpots(e)}`;
}

// ---- The stated assumptions list --------------------------------------------------------------------------------
const ruleLine = (r: (typeof RULES)[number]) =>
  `<div class="rule"><span class="chip ${r.status === 'open' ? 'ov' : r.status === 'checked' ? 'ok' : 'bad'}">${r.status === 'mismatch' ? 'model mismatch' : r.status === 'checked' ? 'checked' : 'open'}</span>
   <b>${esc(r.rule)}</b> <small>${esc(r.reading)}</small>${r.stakes ? ` <small class="stakes">stakes ${r.stakes.toFixed(1)} pts</small>` : ''}${r.check ? `<div class="note">↳ ${esc(r.check)}</div>` : ''}
   ${r.status !== 'mismatch' ? '<button class="link">answer by hand</button>' : ''}</div>`;
const corrLine = (c: (typeof CORRECTIONS)[number]) =>
  `<div class="rule"><span class="chip dim">learned correction</span> <b>EXP ×${c.factor} for ${c.unit}</b> <small>from ${c.from}; relearned whenever a rule changes</small></div>`;

function assumptions(): string {
  const open = RULES.filter((r) => r.status === 'open').sort((a, b) => (b.stakes ?? 0) - (a.stakes ?? 0));
  return `<h3>Stated assumptions</h3>
    <p class="note">Everything the numbers rest on that isn’t read from your game. Each open rule has its <b>stakes</b>: the flawless points that turn on it.</p>
    <h4>Blind spots <small>(not modelled; can’t be checked in play)</small></h4>${Object.values(SPOTS).map((s) => spotLine(s, explain('flawless'))).join('')}
    <h4>Open rules <small>(by stakes)</small></h4>${open.map(ruleLine).join('')}
    <h4>Model mismatches</h4>${RULES.filter((r) => r.status === 'mismatch').map(ruleLine).join('')}
    <h4>Learned corrections</h4>${CORRECTIONS.map(corrLine).join('')}
    <details><summary>Checked rules (${RULES.filter((r) => r.status === 'checked').length})</summary>${RULES.filter((r) => r.status === 'checked').map(ruleLine).join('')}</details>`;
}

// ---- The scene: Run view and Wishlist tab, Before Chapter 2 -----------------------------------------------------
function headline(): string {
  return `<div class="head big">
    <div>${num('flawless', `<b class="chance">${chance(FLAWLESS, 'pct')}</b>`, 'head')} flawless chance <small>— reaches Apotheosis (secret run) with no unit dying</small>
      ${wording !== 'pct' ? `<div class="note">${chance(FLAWLESS, 'odds')}</div>` : ''}</div>
    <div class="bracket"><i style="width:${FLAWLESS * 100}%"></i><em style="left:${CEILING * 100}%"></em></div>
    <div class="sub"><small>ceiling ${num('ceiling', chance(CEILING, 'pct'), 'head')} · 34 maps to go · ±${SIM_ERR}</small>
    ${variant === 'A' ? `<button class="link small" data-all>stated assumptions (3 open, 1 mismatch)</button>` : ''}</div>
  </div>${slot('head')}`;
}

function runTab(): string {
  const ch2 = MAPS[0]!;
  return `${headline()}
    <div class="card changed"><h3>What changed on Chapter 1</h3><ul>
      <li>Cleared with no deaths. Flawless chance 41.7 → ${num('flawless', chance(FLAWLESS, 'pct'), 'chg')}.</li>
      <li>Robin gained 96 EXP (forecast 150–230): below the forecast. Robin’s learned correction is now ×0.88.</li></ul>${slot('chg')}</div>
    <div class="card"><h3>Before Chapter 2: what needs you</h3>
      <div class="ib"><span class="chip warn">at risk</span> <b>Robin Lv 10 by Ch 5</b> <small>milestone chance ${num('ms:robin', chance(0.71, 'pct'), 'ib1')} → ${num('ms:robin-pinned', chance(0.88, 'pct'), 'ib1')} with:</small>
        <div class="edit"><span>Span pin Ch 2–4: Robin leads, Frederick backs</span>${num('pin:robin', pts(-0.2), 'ib1')}<button class="primary">pin it</button></div>${slot('ib1')}</div>
      <div class="ib"><span class="chip ov">in-play check</span> Free check on this map: support points per map (Chrom and Sumia fight together). <small class="stakes">stakes 0.6</small></div>
      <div class="ib"><span class="chip dim">close call</span> Gerome’s father: Virion instead of Gregor ${num('edit:m-cherche-virion', pts(-0.2), 'ib3')} <button>pin</button>${slot('ib3')}</div>
    </div>
    <div class="card nextmap"><b>Next map</b> <span class="map">${ch2.name}</span>
      <span>no-death chance ${num('map:ch2', chance(ch2.p), 'next')}</span>
      <button>Prepare</button><button class="primary">Record results</button>${slot('next')}</div>
    ${variant === 'A' ? `<details class="card" ${S.showAll ? 'open' : ''} data-alldet><summary>Stated assumptions: 3 open rules, 1 model mismatch, 10 blind spots</summary>${assumptions()}</details>` : ''}`;
}

function wishlistTab(): string {
  const cellEdits = EDITS.filter((e) => e.units.includes(S.cell));
  return `${headline()}
    <table class="sheet"><tr><th>Lead / Solo</th><th>Back</th></tr>
    ${w.slots.map((s) => `<tr>${[s.lead, s.back].map((id) => id ? `<td><div class="unit click ${S.cell === id ? 'sel' : ''}" data-cell="${id}">
        <b>${w.units[id]!.name}</b> <small>${w.units[id]!.cls}</small>
        <span class="worth">${w.units[id]!.forced ? 'forced' : `worth ${num('worth:' + id, w.units[id]!.worth.toFixed(1), 'u:' + id)}`}</span></div></td>` : '<td></td>').join('')}</tr>
      ${[s.lead, s.back].some((id) => id && (S.host === 'u:' + id || S.host === 'e:' + id) && variant === 'A') ? `<tr><td colspan="2">${slot(S.host)}</td></tr>` : ''}
      ${S.cell && (S.cell === s.lead || S.cell === s.back) ? `<tr><td colspan="2" class="menu"><b>${w.units[S.cell]!.name}</b> — what if…
        ${cellEdits.map((e) => `<div class="edit"><span>${esc(e.label)}</span>${num('edit:' + e.id, pts(e.delta), 'e:' + S.cell)}<button>pin</button></div>`).join('') || '<small>no edits worth listing</small>'}</td></tr>` : ''}`).join('')}
    </table>
    ${variant === 'A' ? `<details class="card" ${S.showAll ? 'open' : ''} data-alldet><summary>Stated assumptions: 3 open rules, 1 model mismatch, 10 blind spots</summary>${assumptions()}</details>` : ''}`;
}

// ---- Variants ---------------------------------------------------------------------------------------------------
function tabs(proof: boolean): string {
  const t = (k: string, label: string) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${label}</button>`;
  return `<div class="dbar tabs">${t('run', 'Run')}${t('wishlist', 'Wishlist')}${proof ? t('proof', 'Proof') : ''}</div>`;
}

function variantA(): string {
  return `${tabs(false)}<div class="c">${S.tab === 'wishlist' ? wishlistTab() : runTab()}</div>`;
}

function variantB(): string {
  const panel = S.path.length
    ? `<div class="panel-body">${receipt(true)}</div>`
    : S.showAll ? `<div class="panel-body"><div class="crumbs"><b>Stated assumptions</b><button class="x" data-close>✕</button></div>${assumptions()}</div>`
    : `<div class="panel-body"><p class="note">Click any number to see why it is what it is. <sup class="mark">▲</sup> marks a number an optimistic blind spot leans on.</p>
      <button class="link" data-all>Stated assumptions: 3 open, 1 mismatch, 10 blind spots →</button></div>`;
  return `${tabs(false)}<div class="bcols"><div class="c">${S.tab === 'wishlist' ? wishlistTab() : runTab()}</div>
    <aside class="panel"><div class="ptabs"><button class="${!S.showAll || S.path.length ? 'on' : ''}" data-ptab="why">Why</button><button class="${S.showAll && !S.path.length ? 'on' : ''}" data-all>Assumptions</button></div>${panel}</aside></div>`;
}

function variantC(): string {
  if (S.tab !== 'proof') return `${tabs(true)}<div class="c">${S.tab === 'wishlist' ? wishlistTab() : runTab()}</div>`;
  if (!S.path.length) S.path = ['flawless'];
  return `${tabs(true)}<div class="proof">
    <div class="pmain"><button class="link" data-tab="${S.back}">← back to ${S.back === 'run' ? 'Run' : 'Wishlist'}</button>${receipt(true)}</div>
    <div class="pside">${assumptions()}</div></div>`;
}

// ---- Render + events --------------------------------------------------------------------------------------------
function render() {
  app.innerHTML = `<div class="wording">Chance wording: ${(['pct', 'odds', 'both'] as Wording[]).map((m) => `<button class="${wording === m ? 'on' : ''}" data-wording="${m}">${m === 'pct' ? 'percent' : m === 'odds' ? '1 run in N' : 'both'}</button>`).join('')}
     <small>edge cases: ${[0.9996, 0.996, 0.93, 0.64, 0.419, 0.06, 0.004].map((p) => chance(p)).join(' · ')}</small></div>` +
    (variant === 'A' ? variantA() : variant === 'B' ? variantB() : variantC());
  bar.innerHTML = `<button data-v="${prev()}">‹</button><span>${variant} — ${VARIANTS[variant]}</span><button data-v="${next()}">›</button>`;
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  url.searchParams.set('wording', wording);
  history.replaceState(null, '', url);
}
const keys = Object.keys(VARIANTS) as V[];
const prev = () => keys[(keys.indexOf(variant) + keys.length - 1) % keys.length]!;
const next = () => keys[(keys.indexOf(variant) + 1) % keys.length]!;

document.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest('[data-v],[data-num],[data-drill],[data-crumb],[data-close],[data-all],[data-tab],[data-cell],[data-wording],[data-ptab],summary') as HTMLElement | null;
  if (!t) return;
  const d = t.dataset;
  if (t.tagName === 'SUMMARY') {
    if ('alldet' in t.parentElement!.dataset) S.showAll = !(t.parentElement as HTMLDetailsElement).open;
    return;
  }
  ev.stopPropagation();
  if (d.v) (variant = d.v as V), (S.path = []), (S.tab = 'run');
  if (d.num) {
    const same = S.path[0] === d.num && S.host === d.host;
    S.path = same && variant !== 'C' ? [] : [d.num];
    S.host = d.host!;
    if (variant === 'C') (S.back = S.tab === 'wishlist' ? 'wishlist' : 'run'), (S.tab = 'proof');
  }
  if (d.drill) S.path.push(d.drill);
  if (d.crumb) S.path = S.path.slice(0, +d.crumb + 1);
  if ('close' in d) (S.path = []), (S.showAll = false);
  if ('all' in d) {
    S.showAll = true;
    if (variant === 'B') S.path = [];
    if (variant === 'C') (S.back = S.tab === 'wishlist' ? 'wishlist' : S.tab === 'proof' ? S.back : 'run'), (S.tab = 'proof'), (S.path = ['flawless']);
    if (variant === 'A') setTimeout(() => document.querySelector('[data-alldet]')?.scrollIntoView({ behavior: 'smooth' }), 30);
  }
  if (d.ptab === 'why') S.showAll = false;
  if (d.tab) (S.tab = d.tab as typeof S.tab), variant !== 'C' && (S.path = []);
  if (d.cell && !(ev.target as HTMLElement).closest('[data-num]')) S.cell = S.cell === d.cell ? '' : d.cell;
  if (d.wording) wording = d.wording as Wording;
  render();
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') variant = prev();
  else if (e.key === 'ArrowRight') variant = next();
  else if (e.key === 'Escape') S.path = [];
  else return;
  render();
});
render();
void RUNS;
