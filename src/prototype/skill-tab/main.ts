/// <reference types="vite/client" />
// PROTOTYPE — throwaway. "Three variants of the skill tab + loadout suggester for one selected
// pairing, switchable via ?variant=D|A|B|C (D merges the three), mounted in the chosen pairing-table layout (variant D)."
// State is in memory only.
import { PRESETS, enumerate, filtered, initialState, score, type Row, type State } from '../pairing-table/data';
import * as Host from './host';
import { analyse, presetIndexFor, type Analysis, type Ctx } from './skills';
import * as A from './variantA';
import * as B from './variantB';
import * as C from './variantC';
import * as D from './variantD';

export type SkState = State & {
  ctx: Ctx;
  sel: string | null; // selected pairing (row key)
  openBuild: string | null;
  poolSort: 'rank' | 'skill' | 'source' | 'cost';
  showUnranked: boolean;
  panelTab: 'scoring' | 'skills';
  skill: string | null; // skill inspected in the sidebar
};

type Variant = { name: string; hooks: (s: SkState, a: Analysis | null, row: Row | null) => Host.Hooks };
const VARIANTS: Record<string, Variant> = { D, A, B, C };
const KEYS = Object.keys(VARIANTS);

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const s: SkState = { ...initialState(), ctx: 'All', sel: null, openBuild: null, poolSort: 'rank', showUnranked: false, panelTab: 'scoring', skill: null };
const all = enumerate();
const byKey = new Map(all.map((r) => [r.key, r]));
let variant = new URLSearchParams(location.search).get('variant') ?? 'D';
if (!VARIANTS[variant]) variant = 'D';
if (variant === 'C') s.panelTab = 'skills';

// open on a representative pairing so every variant has something to show
s.sel = 'Lucina|Sumia|';

function rescore() {
  score(all, s);
}

function render() {
  const focused = document.activeElement as HTMLElement | null;
  const fk = focused?.dataset.ctl ? `[data-ctl="${focused.dataset.ctl}"]${focused.dataset.i ? `[data-i="${focused.dataset.i}"]` : ''}` : null;
  const sc = app.querySelector('.vb-scroll')?.scrollTop ?? 0;
  const rows = filtered([...all], s);
  const row = s.sel ? byKey.get(s.sel) ?? null : null;
  const t = performance.now();
  const a = row ? analyse(row, s.ctx, s.dlc) : null;
  if (a) console.log(`analysed ${row!.key} in ${Math.round(performance.now() - t)}ms: ${a.builds.length} builds, ${a.pool.length} skills`);
  Host.render(app, s, rows, rows.length, all, VARIANTS[variant].hooks(s, a, row));
  const el = app.querySelector<HTMLElement>('.vb-scroll');
  if (el) el.scrollTop = sc;
  if (el) app.style.setProperty('--centre-w', `${el.clientWidth}px`); // drawer spans the centre column
  if (s.skill) app.querySelectorAll(`[data-ctl="skill"][data-v="${CSS.escape(s.skill)}"]`).forEach((x) => x.classList.add('sel-skill'));
  if (fk) app.querySelector<HTMLInputElement>(fk)?.focus();
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
  s.panelTab = variant === 'C' && s.sel ? 'skills' : 'scoring';
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

const SCORING = new Set(['preset', 'w', 'mixed', 'role', 'rank', 'basis', 'cls', 'rally', 'tonic', 'pairSpd', 'dlc', 'usePreset']);

function setPreset(i: number) {
  s.preset = i;
  const p = PRESETS[i];
  s.weights = [...p.w];
  s.mixed = p.mixed;
  if (p.role) s.role = p.role;
  if (s.role === 'Support' && s.basis === 'Growths') s.basis = 'Caps+LB';
}

function apply(el: HTMLElement) {
  const ctl = el.dataset.ctl!;
  const input = el as HTMLInputElement;
  const v = el.dataset.v ?? input.value;
  switch (ctl) {
    case 'preset': setPreset(Number(v)); break;
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
    case 'selectChild': s.selectedChild = v; s.panelOpen = false; s.sel = null; s.skill = null; s.panelTab = 'scoring'; break;
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
    // ---- skill tab ----
    case 'ctx': s.ctx = v as Ctx; break;
    case 'sel':
      s.sel = s.sel === v && variant !== 'C' ? null : v;
      s.openBuild = null;
      if (variant === 'C') { s.panelTab = 'skills'; s.panelOpen = true; }
      break;
    case 'skill':
      s.skill = !v || s.skill === v ? null : v;
      if (s.skill) s.panelOpen = true; // phone: bottom sheet
      break;
    case 'openBuild': s.openBuild = s.openBuild === v ? null : v; break;
    case 'poolSort': s.poolSort = v as SkState['poolSort']; break;
    case 'showUnranked': s.showUnranked = input.checked; break;
    case 'panelTab': s.panelTab = v as SkState['panelTab']; break;
    case 'usePreset':
      setPreset(presetIndexFor(v));
      if (variant === 'B') s.sel = null;
      if (variant === 'C') s.panelTab = 'scoring';
      break;
  }
  if (SCORING.has(ctl)) rescore();
  render();
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ctl]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (el.dataset.ctl === 'expand' && (e.target as HTMLElement).closest('.detail, .heatwrap, .skcell, .skexpand')) return;
  apply(el);
});
app.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el.dataset.ctl && el.dataset.ctl !== 'parentQuery') apply(el);
});
app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.ctl === 'parentQuery') apply(el);
  if (el.dataset.ctl === 'w') el.nextElementSibling!.textContent = el.value;
});

addEventListener('resize', () => render());

rescore();
render();
