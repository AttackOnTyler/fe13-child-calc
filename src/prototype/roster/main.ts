/// <reference types="vite/client" />
// PROTOTYPE — throwaway. "Three variants of roster state + backup planning, switchable via
// ?variant=A|B|C, mounted in the chosen pairing-table layout (variant D)."
//   A — Row states: state is set from the pairing table itself; per-child backup in the rail + banner.
//   B — Roster board: a Roster view (men / women / children) is where state is set; table reads it.
//   C — Plan solver: a whole-roster marriage plan (max-weight matching) re-solves around losses and
//       shows what changed vs the saved plan.
// Roster state persists to localStorage ('PROTOTYPE-roster-wipe-me'); scoring state is in memory.
import { PRESETS, enumerate, filtered, initialState, score, type Row, type State } from '../pairing-table/data';
import * as Host from './host';
import * as R from './roster';
import * as A from './variantA';
import * as B from './variantB';
import * as C from './variantC';

export type RState = State & { hideBlocked: boolean; menu: string | null };
export type Ctx = {
  s: RState;
  ro: R.Roster;
  uni: Row[]; // rows that exist in this run
  st: Map<string, R.St>;
  sums: Map<string, R.ChildSum>;
  plan: () => R.Plan;
};
type Variant = { name: string; home: string | null; hooks: (c: Ctx) => Host.Hooks };
const VARIANTS: Record<string, Variant> = { A, B, C };
const KEYS = Object.keys(VARIANTS);

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const s: RState = { ...initialState(), hideBlocked: false, menu: null };
let ro = R.load();
const all = enumerate();
let variant = new URLSearchParams(location.search).get('variant') ?? 'A';
if (!VARIANTS[variant]) variant = 'A';
s.selectedChild = VARIANTS[variant].home ?? 'Inigo';

const rescore = () => score(all, s);
let planCache: R.Plan | null = null;
const persist = () => { R.save(ro); planCache = null; };

function render() {
  const focused = document.activeElement as HTMLElement | null;
  const fk = focused?.dataset.ctl ? `[data-ctl="${focused.dataset.ctl}"]${focused.dataset.u ? `[data-u="${CSS.escape(focused.dataset.u)}"]` : ''}` : null;
  const sc = app.querySelector('.vb-scroll')?.scrollTop ?? 0;
  const uni = all.filter((r) => R.inUniverse(r, ro));
  const st = new Map(uni.map((r) => [r.key, R.status(r, ro)]));
  const sums = R.summarise(uni, ro, st);
  const ctx: Ctx = { s, ro, uni, st, sums, plan: () => (planCache ??= R.solve(uni, ro)) };
  const hooks = VARIANTS[variant].hooks(ctx);
  const hidden = (r: Row) => s.hideBlocked && st.get(r.key)?.kind === 'hard';
  hooks.universe = (r) => R.inUniverse(r, ro) && !hidden(r);
  hooks.demote = (r) => st.get(r.key)?.kind === 'hard';
  hooks.railChildren = R.people(ro).kids;
  // leaderboard: same universe, blocked sorted last (scores stay computed over all pairings)
  const board = filtered([...uni], s).filter((r) => !hidden(r));
  const ranked = [...board.filter((r) => st.get(r.key)?.kind !== 'hard'), ...board.filter((r) => st.get(r.key)?.kind === 'hard')];
  Host.render(app, s, ranked, ranked.length, uni, hooks);
  // decorate leaderboard cards (the host's board has no hooks)
  app.querySelectorAll<HTMLElement>('.card[data-v]').forEach((el) => {
    const x = st.get(el.dataset.v!);
    if (!x) return;
    el.classList.add('k-' + x.kind);
    const why = [...x.hard, ...x.soft][0];
    const tag = x.kind === 'married' ? '✓ married' : x.kind === 'planned' ? '★ planned' : why ? (x.kind === 'hard' ? '✕ ' : '! ') + why : '';
    if (tag) el.querySelector('.who')?.insertAdjacentHTML('beforeend', `<div class="kind-tag k-${x.kind}">${tag}</div>`);
  });
  const el = app.querySelector<HTMLElement>('.vb-scroll');
  if (el) el.scrollTop = sc;
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
  s.menu = null;
  if (['Roster', 'Plan'].includes(s.selectedChild) || VARIANTS[variant].home) s.selectedChild = VARIANTS[variant].home ?? 'Inigo';
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

function setPreset(i: number) {
  s.preset = i;
  const p = PRESETS[i];
  s.weights = [...p.w];
  s.mixed = p.mixed;
  if (p.role) s.role = p.role;
  if (s.role === 'Support' && s.basis === 'Growths') s.basis = 'Caps+LB';
}

// every marriage a row needs, planned (or married) together
function rowMarriages(key: string) {
  const r = all.find((x) => x.key === key)!;
  return R.reqs(r).marriages;
}

function apply(el: HTMLElement) {
  const ctl = el.dataset.ctl!;
  const input = el as HTMLInputElement;
  const v = el.dataset.v ?? input.value;
  const { a, b, u } = el.dataset;
  let roster = true;
  switch (ctl) {
    // ---- roster ----
    case 'u': ro.units[u!] = v as R.UState; if (v === 'avail') delete ro.units[u!]; break;
    case 'ucycle': {
      const ks = R.USTATES.map((x) => x.k);
      const next = ks[(ks.indexOf(R.uState(ro, u!)) + 1) % ks.length];
      if (next === 'avail') delete ro.units[u!]; else ro.units[u!] = next;
      break;
    }
    case 'robinG':
      if (ro.robinG !== v) {
        const old = R.robinName(ro);
        R.setSpouse(ro.married, old, null); R.setSpouse(ro.planned, old, null);
        ro.robinG = v as 'M' | 'F';
        if (s.selectedChild.startsWith('Morgan')) s.selectedChild = R.morganName(ro);
      }
      break;
    case 'robinAF': ro.robinAF = v || null; break;
    case 'planRow': {
      const ms = rowMarriages(v);
      const on = ms.every(([x, y]) => ro.planned[x] === y || ro.married[x] === y);
      for (const [x, y] of ms) if (ro.married[x] !== y) R.setSpouse(ro.planned, x, on ? null : y);
      break;
    }
    case 'marryRow': {
      const ms = rowMarriages(v);
      const on = ms.every(([x, y]) => ro.married[x] === y);
      for (const [x, y] of ms) {
        if (on) { if (ro.married[x] === y) R.setSpouse(ro.married, x, null); }
        else { R.setSpouse(ro.married, x, y); R.setSpouse(ro.planned, x, null); R.setSpouse(ro.planned, y, null); }
      }
      break;
    }
    case 'spouse': {
      const mode = el.dataset.mode === 'married' ? ro.married : ro.planned;
      const other = mode === ro.married ? ro.planned : ro.married;
      R.setSpouse(mode, u!, v || null);
      if (v) { R.setSpouse(other, u!, null); R.setSpouse(other, v, null); }
      break;
    }
    case 'spouseMode': {
      // flip a pairing between planned and married
      const from = v === 'married' ? ro.planned : ro.married, to = v === 'married' ? ro.married : ro.planned;
      const sp = from[u!];
      if (sp) { R.setSpouse(from, u!, null); R.setSpouse(to, u!, sp); }
      break;
    }
    case 'pin': {
      if (ro.planned[a!] === b) R.setSpouse(ro.planned, a!, null);
      else R.setSpouse(ro.planned, a!, b!);
      break;
    }
    case 'ban': {
      const k = R.pairKey(a!, b!);
      ro.bans = ro.bans.includes(k) ? ro.bans.filter((x) => x !== k) : [...ro.bans, k];
      if (ro.planned[a!] === b) R.setSpouse(ro.planned, a!, null);
      break;
    }
    case 'prio': ro.priority[el.dataset.c!] = Number(v); break;
    case 'adopt': {
      const p = R.solve(all.filter((r) => R.inUniverse(r, ro)), ro);
      for (const pr of p.pairs) if (pr.how !== 'married' && pr.f !== 'Maiden') R.setSpouse(ro.planned, pr.m, pr.f);
      ro.saved = R.snapshot(p);
      break;
    }
    case 'savePlan': ro.saved = R.snapshot(R.solve(all.filter((r) => R.inUniverse(r, ro)), ro)); break;
    case 'afterDeath': ro.afterDeath = input.checked; break;
    case 'freeReplan': ro.freeReplan = input.checked; break;
    case 'clearAll':
      if (!confirm('PROTOTYPE: clear all roster state (deaths, marriages, plans, Robin)?')) return;
      ro = R.emptyRoster();
      break;
    case 'demo': {
      // the demo's saved plan is the one made before Olivia died
      ro = R.demo();
      const alive = { ...ro, units: { ...ro.units } };
      delete alive.units.Olivia;
      ro.saved = R.snapshot(R.solve(all.filter((r) => R.inUniverse(r, alive)), alive));
      break;
    }
    default: roster = false;
  }
  if (roster) persist();
  else
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
      case 'selectChild': s.selectedChild = v; s.panelOpen = false; s.menu = null; break;
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
      case 'hideBlocked': s.hideBlocked = input.checked; break;
      case 'menu': s.menu = s.menu === v ? null : v; break;
      case 'goto': s.selectedChild = v; s.menu = null; break;
    }
  if (SCORING.has(ctl)) { rescore(); planCache = null; }
  render();
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ctl]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  if (el.dataset.ctl === 'expand' && (e.target as HTMLElement).closest('.detail, .heatwrap, .skcell, .skexpand')) return;
  e.stopPropagation();
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
