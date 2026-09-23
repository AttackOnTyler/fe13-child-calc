/// <reference types="vite/client" />
// PROTOTYPE — throwaway. "Three variants of the pairing table + scoring panel, switchable via
// ?variant=D|A|B|C (D merges the three), on a throwaway page." State is in memory only.
import { PRESETS, enumerate, filtered, initialState, score, type Row, type State } from './data';
import * as A from './variantA';
import * as B from './variantB';
import * as C from './variantC';
import * as D from './variantD';

type Variant = { name: string; render: (root: HTMLElement, s: State, rows: Row[], total: number, all: Row[]) => void };
const VARIANTS: Record<string, Variant> = { D, A, B, C };
const KEYS = Object.keys(VARIANTS);

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const s = initialState();
const all = enumerate();
let variant = new URLSearchParams(location.search).get('variant') ?? 'D';
if (!VARIANTS[variant]) variant = 'D';

function rescore() {
  const t = performance.now();
  score(all, s);
  console.log(`scored ${all.length} pairings in ${Math.round(performance.now() - t)}ms`);
}

function render() {
  const focused = document.activeElement as HTMLElement | null;
  const fk = focused?.dataset.ctl ? `[data-ctl="${focused.dataset.ctl}"]${focused.dataset.i ? `[data-i="${focused.dataset.i}"]` : ''}` : null;
  const sc = app.querySelector('.va-scroll, .vb-scroll')?.scrollTop ?? 0;
  const rows = filtered([...all], s);
  VARIANTS[variant].render(app, s, rows, rows.length, all);
  const el = app.querySelector<HTMLElement>('.va-scroll, .vb-scroll');
  if (el) el.scrollTop = sc;
  if (fk) {
    const f = app.querySelector<HTMLInputElement>(fk);
    f?.focus();
    if (f && f.type === 'search') f.setSelectionRange(f.value.length, f.value.length);
  }
  bar.innerHTML = import.meta.env.PROD
    ? ''
    : `<button data-sw="-1">←</button><span>${variant} — ${VARIANTS[variant].name}</span><button data-sw="1">→</button>`;
}

function cycle(d: number) {
  variant = KEYS[(KEYS.indexOf(variant) + d + KEYS.length) % KEYS.length];
  const u = new URL(location.href);
  u.searchParams.set('variant', variant);
  history.replaceState(null, '', u);
  s.panelOpen = false;
  s.limit = 200;
  render();
}
bar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sw]');
  if (b) cycle(Number(b.dataset.sw));
});
addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

const SCORING = new Set(['preset', 'w', 'mixed', 'role', 'rank', 'basis', 'cls', 'rally', 'tonic', 'pairSpd', 'dlc']);

function apply(el: HTMLElement) {
  const ctl = el.dataset.ctl!;
  const input = el as HTMLInputElement;
  const v = el.dataset.v ?? input.value;
  switch (ctl) {
    case 'preset': {
      s.preset = Number(v);
      const p = PRESETS[s.preset];
      s.weights = [...p.w];
      s.mixed = p.mixed;
      if (p.role) s.role = p.role;
      if (s.role === 'Support' && s.basis === 'Growths') s.basis = 'Caps+LB';
      break;
    }
    case 'w': s.weights[Number(el.dataset.i)] = Number(v); break;
    case 'mixed': s.mixed = input.checked; break;
    case 'role': s.role = v as State['role']; if (s.role === 'Support' && s.basis === 'Growths') s.basis = 'Caps+LB'; break;
    case 'rank': s.rank = v as State['rank']; break;
    case 'basis': s.basis = v as State['basis']; break;
    case 'cls': s.cls = v; break;
    case 'rally': s.rally = Number(v); break;
    case 'tonic': s.tonic = input.checked; break;
    case 'pairSpd': s.pairSpd = Number(v); break;
    case 'dlc': s.dlc = input.checked; break;
    case 'secondGen': s.secondGen = input.checked; break;
    case 'parentQuery': s.parentQuery = v; break;
    case 'robinMode': s.robinMode = v as State['robinMode']; break;
    case 'asset': s.asset = v; break;
    case 'flaw': s.flaw = v; break;
    case 'child': s.children = s.children.includes(v) ? s.children.filter((c) => c !== v) : [...s.children, v]; break;
    case 'selectChild': s.selectedChild = v; s.panelOpen = false; break;
    case 'col': s.cols[v as keyof State['cols']] = input.checked; break;
    case 'sort': s.sort = s.sort.col === v ? { col: v, dir: (s.sort.dir * -1) as 1 | -1 } : { col: v, dir: -1 }; break;
    case 'pickAF': {
      const cut = v.lastIndexOf('|');
      const [gk, af] = [v.slice(0, cut), v.slice(cut + 1)];
      if (s.pickedAF[gk] === af) delete s.pickedAF[gk];
      else s.pickedAF[gk] = af;
      break;
    }
    case 'expand': s.expanded[v] = !s.expanded[v]; break;
    case 'panel': s.panelOpen = !s.panelOpen; break;
    case 'more': s.limit += 500; break;
  }
  if (SCORING.has(ctl)) rescore();
  render();
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ctl]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (el.dataset.ctl === 'expand' && (e.target as HTMLElement).closest('.detail, .heatwrap')) return;
  apply(el);
});
app.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el.dataset.ctl && el.dataset.ctl !== 'parentQuery') apply(el);
});
app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.ctl === 'parentQuery') apply(el);
  if (el.dataset.ctl === 'w') el.nextElementSibling!.textContent = el.value; // live label while dragging
});

rescore();
render();
