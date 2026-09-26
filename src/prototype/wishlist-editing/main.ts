/// <reference types="vite/client" />
// PROTOTYPE — throwaway (#143). "Three ways to go from 'set the endpoint' to a locked wishlist by editing a proposal by
// exception, switchable via ?variant=A|B|C, on a stubbed solve (model.ts: invented numbers)."
//   A — Decision steps: one decision per screen (Endpoint → Robin → Marriages → Army → Reserves → Lock).
//   B — Wishlist sheet: the whole endpoint army on one page; click any unit to see its edits and their costs.
//   C — Proposal inbox: open decisions, the search's proposals and close calls as a feed; "change something" box.
import {
  BASE_CHANCE, CEILING, EDITS, ENDPOINT, NOISE, PROPOSALS, ROADMAP, ROBIN_OPTIONS, baseWishlist, solveRobin,
  type Edit, type RobinOption, type Wishlist,
} from './model';
import { LOSS, STOPS, type InboxItem, type Reading } from './run';

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const VARIANTS = { A: 'Decision steps', B: 'Wishlist sheet', C: 'Proposal inbox', D: 'Inbox → Run handoff' } as const;
type V = keyof typeof VARIANTS;
let variant = (new URLSearchParams(location.search).get('variant') ?? 'A') as V;
if (!(variant in VARIANTS)) variant = 'A';

// ---- State (in memory only) -----------------------------------------------------------------------------------------
interface Applied { edit: Edit; pinned: boolean; t0: number }
const S = {
  robin: 'f-spd-lck',
  robinDecided: false,
  locked: false,
  noRobin: false,
  applied: [] as Applied[],
  proposals: [] as Edit[],
  searchDone: false,
  solving: new Map<string, number>(),
  solvedExtra: new Map<string, number>(),
  /** When each list of edits was opened: their costs are computed from then (≈1 s provisional, then settled). */
  opened: new Map<string, number>(),
  showPinCost: new Set<string>(),
  moreRobins: false,
  // A
  step: 0,
  // B
  cell: undefined as string | undefined,
  // C
  query: '',
  // D: the run after the Lock
  tab: 'run' as 'run' | 'wishlist' | 'prep',
  stop: 0,
  recording: false,
  lost: false,
  changed: undefined as { map: string; lines: string[] } | undefined,
  log: [] as string[],
};
const T0 = Date.now();

const later = (ms: number) => setTimeout(render, ms + 20);
const stamp = (key: string) => {
  if (!S.opened.has(key)) {
    S.opened.set(key, Date.now());
    later(1000);
    later(3000);
  }
  return S.opened.get(key)!;
};

// ---- Stub solve -----------------------------------------------------------------------------------------------------
const robinOpt = (id = S.robin) => ROBIN_OPTIONS.find((o) => o.id === id)!;
const robinChance = (o: RobinOption) => o.chance ?? S.solvedExtra.get(o.id);
const BEST = BASE_CHANCE;

function wishlist(): Wishlist {
  const w = baseWishlist();
  robinOpt().apply?.(w);
  for (const a of S.applied) a.edit.apply(w);
  return w;
}
const chance = () => (robinChance(robinOpt()) ?? robinOpt().seed) + S.applied.reduce((s, a) => s + a.edit.delta, 0);
const pinCost = () => S.applied.filter((a) => a.pinned).reduce((s, a) => s + a.edit.delta, 0);

type Phase = 'costing' | 'provisional' | 'settled';
const phase = (t0: number): Phase => (Date.now() - t0 < 1000 ? 'costing' : Date.now() - t0 < 3000 ? 'provisional' : 'settled');
const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d).toFixed(1);
/** An edit's cost as the anytime solve would show it at time t0 + now. */
function cost(d: number, t0: number, split?: string): string {
  const p = phase(t0);
  if (p === 'costing') return `<span class="cost pending">costing…</span>`;
  if (p === 'provisional') {
    const j = d + ((Math.round(t0 / 7) % 5) - 2) * 0.15;
    return `<span class="cost prov" title="Provisional: the search is still comparing on more runs">≈ ${sign(j)} ±0.6</span>`;
  }
  if (Math.abs(d) < NOISE) return `<span class="cost noise" title="${sign(d)} is inside the simulation's noise (±${NOISE})">no measurable difference</span>`;
  return `<span class="cost ${d < 0 ? 'neg' : 'pos'}" title="${split ?? ''}">${sign(d)}</span>${split ? ` <small>${split}</small>` : ''}`;
}

const isApplied = (e: Edit) => S.applied.some((a) => a.edit.id === e.id);
function apply(e: Edit, pinned: boolean) {
  S.applied.push({ edit: e, pinned, t0: Date.now() });
  later(1000);
  later(3000);
}
const undo = (id: string) => (S.applied = S.applied.filter((a) => a.edit.id !== id));
const editsFor = (unit: string) => EDITS.filter((e) => e.units[0] === unit || e.units.includes(unit));
const edit = (id: string) =>
  [...EDITS, ...PROPOSALS.map((p) => p[1]), ...[...STOPS.flatMap((x) => x.inbox), ...LOSS.inbox].flatMap((i) => (i.fix ? [i.fix] : []))].find((e) => e.id === id)!;

// The anytime search: proposals trickle in after load.
for (const [ms, e] of PROPOSALS) setTimeout(() => (S.proposals.push(e), render()), ms);
setTimeout(() => ((S.searchDone = true), render()), 12000);

// ---- Shared bits ----------------------------------------------------------------------------------------------------
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const name = (w: Wishlist, id: string) => w.units[id]?.name ?? id;
const openProposals = () => S.proposals.filter((p) => !isApplied(p) && !S.opened.has('dismiss:' + p.id));

function search(): string {
  const n = openProposals().length;
  const busy = !S.searchDone || S.solving.size > 0 || S.applied.some((a) => phase(a.t0) !== 'settled');
  return busy
    ? `<span class="search on">● searching${n ? ` · ${n} improvement${n > 1 ? 's' : ''} found` : ''}</span>`
    : `<span class="search">search idle${n ? ` · ${n} improvement${n > 1 ? 's' : ''} found` : ' · best found'}</span>`;
}

function headline(big = false): string {
  const c = chanceNow();
  const pc = pinCost();
  return `<div class="head ${big ? 'big' : ''}">
    <div><b class="chance">${c.toFixed(1)}%</b> flawless chance <small>— reaches ${ENDPOINT.map} with no unit dying</small></div>
    <div class="bracket" title="Best roadmap found → ceiling (the endpoint at caps)"><i style="width:${(c / 100) * 100}%"></i><em style="left:${CEILING}%"></em></div>
    <div class="sub"><small>best roadmap found ${c.toFixed(1)} · ceiling ${CEILING.toFixed(1)} · ${ROADMAP.maps} maps, ${ROADMAP.milestones} milestones</small> ${search()}
    ${pc ? `<span class="pincost" title="What your pins cost against the unpinned best">your pins cost ${sign(pc)}</span>` : ''}</div>
  </div>`;
}

function unitCard(w: Wishlist, id: string, pos: string, clickable = false): string {
  const u = w.units[id]!;
  const touched = S.applied.some((a) => a.edit.units.includes(id));
  return `<div class="unit ${clickable ? 'click' : ''} ${S.cell === id ? 'sel' : ''} ${touched ? 'touched' : ''}" ${clickable ? `data-cell="${id}"` : ''}>
    <div><span class="pos">${pos}</span> <b>${esc(u.name)}</b> <small>${u.cls}${u.job !== 'fights' ? ` · ${u.job}` : ''}</small>
    <span class="worth" title="Unit worth: flawless points lost without this unit">${u.forced ? 'forced' : `worth ${u.worth.toFixed(1)}`}</span>
    ${variant === 'D' && S.locked ? readingChip(id) : ''}</div>
    <div class="skills">${u.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
    ${u.parents ? `<div class="par"><small>${esc(u.parents[0])} × ${esc(u.parents[1])} · passes ${u.passes!.map(esc).join(' / ')}</small></div>` : ''}
  </div>`;
}

function editRow(e: Edit, key: string): string {
  const on = isApplied(e);
  const a = S.applied.find((x) => x.edit.id === e.id);
  return `<div class="edit ${on ? 'on' : ''}">
    <span>${esc(e.label)}</span>
    ${on ? cost(e.delta, a!.t0, e.split) : cost(e.delta, stamp(key), e.split)}
    ${on ? `<button data-undo="${e.id}">undo</button>` : `<button data-pin="${e.id}">${S.locked ? 'propose' : 'pin'}</button>`}
  </div>`;
}

function robinCard(o: RobinOption, big: boolean): string {
  const c = robinChance(o);
  const on = S.robin === o.id;
  const t0 = S.solving.get(o.id);
  const body = c !== undefined
    ? `<b>${c.toFixed(1)}%</b> ${o.id === 'f-spd-lck' ? '<span class="chip ok">best</span>' : `<span class="cost neg">${sign(c - BEST)}</span>`}`
    : t0 ? `<span class="cost pending">solving… ${Math.round((Date.now() - t0) / 1000)} s</span>` : `<small>seed ${o.seed} · ceiling ${o.ceiling} · not solved</small> <button data-solve="${o.id}">solve</button>`;
  return `<div class="robin ${on ? 'on' : ''} ${big ? 'big' : ''}" ${c !== undefined && !S.locked ? `data-robin="${o.id}"` : ''}>
    <div><b>${o.label}</b> × ${o.spouse}</div><div>${body}</div>
    ${big ? `<div><small>${o.gist}</small></div>${o.diff?.length ? `<ul>${o.diff.map((d) => `<li>${d}</li>`).join('')}</ul>` : o.diff ? '<small>the proposal</small>' : ''}` : ''}
  </div>`;
}

function moreRobins(): string {
  const rest = ROBIN_OPTIONS.filter((o) => !o.diff);
  return `<details ${S.moreRobins ? 'open' : ''} data-more-robins><summary>${rest.length} more Robins, screened only (seed and ceiling)</summary>
    <table class="t"><tr><th>Robin</th><th>spouse</th><th>seed</th><th>ceiling</th><th></th></tr>
    ${rest.map((o) => {
      const c = robinChance(o);
      const t0 = S.solving.get(o.id);
      return `<tr class="${S.robin === o.id ? 'on' : ''}"><td>${o.label}</td><td>${o.spouse}</td><td>${o.seed}</td><td>${o.ceiling}</td><td>${
        c !== undefined ? `<b>${c.toFixed(1)}%</b> <span class="cost neg">${sign(c - BEST)}</span> ${S.locked ? '' : `<button data-robin="${o.id}">choose</button>`}`
        : t0 ? `<span class="cost pending">solving… ${Math.round((Date.now() - t0) / 1000)} s</span>` : `<button data-solve="${o.id}">solve</button>`}</td></tr>`;
    }).join('')}</table></details>`;
}

const noRobinToggle = () =>
  `<label class="sw"><input type="checkbox" data-norobin ${S.noRobin ? 'checked' : ''}/> No-Robin view <small>(Robin’s factors left out)</small></label>
   ${S.noRobin ? `<div class="note">Without Robin’s factors: <b>36.0%</b>, with Morgan out; the rest of the wishlist barely moves (Lucina −1.1). Robin is worth up to <b>+5.2</b> here.</div>` : ''}`;

function lockBox(): string {
  if (S.locked) return `<div class="banner ok">Robin locked: ${robinOpt().label} × ${robinOpt().spouse}. The wishlist keeps re-solving from here, with changes as proposals. <button data-unlock>unlock (prototype only)</button></div>`;
  return `<div class="lockbox"><div>Lock <b>Robin ${robinOpt().label}</b> and start the run. This locks only Robin; the rest of the wishlist stays editable and re-solves after every map.</div>
    <button class="primary" data-lock>Lock Robin and start</button></div>`;
}

function proposalRow(e: Edit): string {
  return `<div class="proposal"><span class="chip ok">search</span> ${esc(e.label)} ${cost(e.delta, T0 - 5000, e.split)}
    <button data-accept="${e.id}">accept</button><button data-dismiss="${e.id}">dismiss</button></div>`;
}

function pinsList(): string {
  const mine = S.applied;
  if (!mine.length) return `<p class="note">No edits yet. Everything is the tool’s proposal.</p>`;
  return mine.map((a) => `<div class="edit on"><span>${a.pinned ? '📌' : '✓'} ${esc(a.edit.label)}</span>
    ${a.pinned && !S.showPinCost.has(a.edit.id) && phase(a.t0) === 'settled' ? `<button data-pincost="${a.edit.id}">cost?</button>` : cost(a.edit.delta, a.t0, a.edit.split)}
    <button data-undo="${a.edit.id}">undo</button></div>`).join('');
}

const replaces = (rows: [string, string][]) =>
  `<details class="replaces"><summary>What this replaces in today’s fresh-run journey</summary><table class="t">${rows.map(([a, b]) => `<tr><td>${a}</td><td>→ ${b}</td></tr>`).join('')}</table></details>`;

// ---- A: decision steps ----------------------------------------------------------------------------------------------
const STEPS = ['Endpoint', 'Robin', 'Marriages', 'Army', 'Reserves', 'Lock'];

function marriageEdits(child: string) {
  return EDITS.filter((e) => e.kind === 'marriage' && e.units[0] === child);
}

function variantA(): string {
  const w = wishlist();
  const step = STEPS[S.step]!;
  let body = '';
  if (step === 'Endpoint')
    body = `<h2>Where does this run end?</h2>
      <div class="card"><b>${ENDPOINT.map}</b> <small>from the ${ENDPOINT.route}</small><br/>Deploys ${ENDPOINT.deploy}. Play context: ${ENDPOINT.context}.
      <div class="note">Change the route or the endpoint map on Run facts; the wishlist re-solves.</div></div>
      <p>The tool has proposed a whole wishlist for it. The next steps show only the decisions where you might want something else.</p>`;
  if (step === 'Robin')
    body = `<h2>Robin</h2><p class="note">Robin decides the most. Each option is a whole wishlist, solved in full, with its cost against the best.</p>
      <div class="robins">${ROBIN_OPTIONS.filter((o) => o.diff).map((o) => robinCard(o, true)).join('')}</div>${moreRobins()}${noRobinToggle()}
      <p class="note">You can move on with Robin open: it stays open until you lock it on the last step.</p>`;
  if (step === 'Marriages') {
    const children = w.marriages.map((m) => Object.values(w.units).find((u) => u.parents?.[0] === m.fixed)).filter(Boolean);
    const close = children.filter((u) => marriageEdits(u!.id).some((e) => Math.abs(e.delta) < NOISE));
    const clear = children.filter((u) => !close.includes(u) && marriageEdits(u!.id).length);
    body = `<h2>Marriages</h2>
      <h3>Your call <small>— an alternative is inside the noise</small></h3>
      ${close.map((u) => `<div class="card"><b>${u!.name}</b>: ${u!.parents![0]} × <b>${u!.parents![1]}</b> <small>(proposal)</small>${marriageEdits(u!.id).map((e) => editRow(e, 'A:' + e.id)).join('')}</div>`).join('')}
      <details><summary>${clear.length} marriages where the proposal is clearly best</summary>
      ${clear.map((u) => `<div class="card"><b>${u!.name}</b>: ${u!.parents![0]} × <b>${u!.parents![1]}</b>${marriageEdits(u!.id).map((e) => editRow(e, 'A:' + e.id)).join('')}</div>`).join('')}</details>`;
  }
  if (step === 'Army')
    body = `<h2>The endpoint army</h2><p class="note">Pairs, positions and builds, as proposed. Open a pair to see its edits.</p>
      ${openProposals().map(proposalRow).join('')}
      ${w.slots.map((s, i) => `<details class="pair" ${S.opened.has('pairA:' + i) ? 'open' : ''} data-pairA="${i}"><summary>${name(w, s.lead)}${s.back ? ` <small>leads</small> · ${name(w, s.back)} <small>backs</small>` : ` <small>solo</small>`}</summary>
        <div class="row2">${unitCard(w, s.lead, s.back ? 'Lead' : 'Solo')}${s.back ? unitCard(w, s.back, 'Back') : ''}</div>
        ${[...new Set([...editsFor(s.lead), ...(s.back ? editsFor(s.back) : [])])].filter((e) => e.kind !== 'marriage').map((e) => editRow(e, 'A:' + e.id)).join('') || '<small>No edits worth listing.</small>'}
      </details>`).join('')}`;
  if (step === 'Reserves')
    body = `<h2>Reserves</h2><p class="note">In order: who steps in, and the likely loss each mainly covers.</p>
      ${w.reserves.map((r, i) => `<div class="card">${i + 1}. <b>${name(w, r.id)}</b> <small>covers ${r.covers}</small>${EDITS.filter((e) => e.kind === 'inout' && e.units[0] === r.id).map((e) => editRow(e, 'A:' + e.id)).join('')}</div>`).join('')}`;
  if (step === 'Lock')
    body = `<h2>Lock</h2>${headline(true)}<h3>Your edits</h3>${pinsList()}${lockBox()}`;
  return `<div class="a">
    <nav>${STEPS.map((s, i) => `<button class="${i === S.step ? 'on' : ''}" data-step="${i}">${i + 1}. ${s}${s === 'Robin' && !S.robinDecided ? ' <small>open</small>' : ''}</button>`).join('')}</nav>
    <main>${step !== 'Lock' ? headline() : ''}${body}
    <div class="nav">${S.step ? `<button data-step="${S.step - 1}">back</button>` : ''}
    ${S.step < STEPS.length - 1 ? `<button class="primary" data-step="${S.step + 1}">${step === 'Endpoint' ? 'Start' : 'Keep the rest as proposed →'}</button>` : ''}</div>
    ${replaces([['Tick who you’ll deploy / Bench', 'Army step (keep in) and Reserves step (keep out)'], ['Priorities', 'gone: a preference is an edit with a cost'], ['Role matrix, army fit', 'Army step: positions per pair'], ['Adopt', '“Keep the rest as proposed”; the wishlist is always the adopted best'], ['Lock (Robin)', 'Lock step, last'], ['Set Robin first / Robin last', 'Robin is step 2, and may stay open']])}
    </main></div>`;
}

// ---- B: wishlist sheet ----------------------------------------------------------------------------------------------
function variantB(): string {
  const w = wishlist();
  const cellEdits = S.cell ? editsFor(S.cell) : [];
  return `<div class="b">
    <header>${headline()}${S.locked ? '' : `<div class="robins strip">${ROBIN_OPTIONS.filter((o) => o.diff).map((o) => robinCard(o, false)).join('')}<button data-moreb>${S.moreRobins ? 'hide' : '+36 more'}</button></div>
      ${S.moreRobins ? moreRobins() : ''}${robinOpt().diff?.length ? `<div class="note">This Robin changes: ${robinOpt().diff!.join('; ')}</div>` : ''}`}</header>
    <div class="cols"><main>
      <table class="sheet"><tr><th>Lead / Solo</th><th>Back</th></tr>
      ${w.slots.map((s) => `<tr><td>${unitCard(w, s.lead, s.back ? 'Lead' : 'Solo', true)}</td><td>${s.back ? unitCard(w, s.back, 'Back', true) : ''}</td></tr>
        ${S.cell && (S.cell === s.lead || S.cell === s.back) ? `<tr><td colspan="2" class="menu"><b>${name(w, S.cell)}</b> — what if…
          ${cellEdits.map((e) => editRow(e, 'B:' + S.cell + e.id)).join('') || '<small>no edits worth listing</small>'}
          <div class="edit"><span>Keep ${name(w, S.cell)} out</span>${cost(-w.units[S.cell]!.worth, stamp('B:out' + S.cell))}<button disabled>pin</button></div></td></tr>` : ''}`).join('')}
      </table>
      <h3>Reserves</h3>${w.reserves.map((r, i) => `<div class="res" data-cell="${r.id}">${i + 1}. <b>${name(w, r.id)}</b> <small>covers ${r.covers}</small></div>
        ${S.cell === r.id ? `<div class="menu">${editsFor(r.id).map((e) => editRow(e, 'B:' + r.id + e.id)).join('')}</div>` : ''}`).join('')}
    </main>
    <aside>
      <h3>Improvements from the search</h3>${openProposals().map(proposalRow).join('') || '<p class="note">None yet.</p>'}
      <h3>Your edits</h3>${pinsList()}
      ${noRobinToggle()}
      ${lockBox()}
      ${replaces([['Tick who you’ll deploy / Bench', 'the sheet is who deploys; “keep out” in any unit’s menu'], ['Priorities', 'gone'], ['Role matrix, army fit', 'the Lead / Back columns'], ['Adopt', 'none: the sheet is always the adopted best; proposals are accepted one by one'], ['Lock', 'Lock button, any time']])}
    </aside></div></div>`;
}

// ---- C: proposal inbox ----------------------------------------------------------------------------------------------
function variantC(): string {
  const w = wishlist();
  const q = S.query.trim().toLowerCase();
  const matches = q
    ? [...EDITS.filter((e) => e.label.toLowerCase().includes(q) || e.units.some((u) => name(w, u).toLowerCase().includes(q)))]
    : [];
  const closeCalls = EDITS.filter((e) => e.kind === 'marriage' && Math.abs(e.delta) < NOISE && !isApplied(e));
  const fielded = w.slots.flatMap((s) => [s.lead, s.back].filter(Boolean) as string[]);
  return `<div class="c">
    ${headline(true)}
    <p>The tool proposes a wishlist of ${ENDPOINT.deploy} units for <b>${ENDPOINT.map}</b>. Below is only what needs you.</p>
    ${S.locked ? '' : `<section class="card"><h3>${S.robinDecided ? '✓' : '1 decision open:'} Robin</h3>
      <div class="robins">${ROBIN_OPTIONS.filter((o) => o.diff).map((o) => robinCard(o, true)).join('')}</div>${moreRobins()}${noRobinToggle()}</section>`}
    ${openProposals().length ? `<section class="card"><h3>The search found better</h3>${openProposals().map(proposalRow).join('')}</section>` : ''}
    ${closeCalls.length ? `<section class="card"><h3>Close calls <small>— pick whichever you like, the chance won’t tell them apart</small></h3>${closeCalls.map((e) => editRow(e, 'C:' + e.id)).join('')}</section>` : ''}
    <section class="card"><h3>Anything else you want different?</h3>
      <input data-q placeholder="a unit, a marriage, a skill… (try: Yarne, Gerome, Olivia, Frederick)" value="${esc(S.query)}"/>
      ${matches.map((e) => editRow(e, 'C:' + e.id)).join('')}
      ${q && !matches.length ? '<p class="note">No edits match.</p>' : ''}</section>
    <section class="card"><h3>Your edits</h3>${pinsList()}</section>
    <details class="card"><summary>The wishlist (${fielded.length} fielded, ${w.reserves.length} reserves)</summary>
      ${w.slots.map((s) => `<div class="line">${s.back ? `<b>${name(w, s.lead)}</b> + ${name(w, s.back)}` : `<b>${name(w, s.lead)}</b> <small>solo, ${w.units[s.lead]!.job}</small>`}</div>`).join('')}
      <div class="line"><small>Reserves: ${w.reserves.map((r) => `${name(w, r.id)} (covers ${r.covers})`).join('; ')}</small></div></details>
    ${lockBox()}
    ${replaces([['Tick who you’ll deploy / Bench', '“Anything else”: keep X in / out'], ['Priorities', 'gone'], ['Role matrix, army fit', '“Anything else”: positions'], ['Adopt', 'accept the search’s proposals'], ['Lock', 'the last card']])}
  </div>`;
}

// ---- D: inbox → run handoff -----------------------------------------------------------------------------------------
// Before the Lock: C's inbox is the whole setup. The Lock lands on a stubbed Run view whose top is the same inbox
// ("Before <map>"), above Next map (Prepare / Record results). B's sheet becomes the Wishlist tab, with readings.
function chanceNow(): number {
  if (variant !== 'D' || !S.locked) return chance();
  return STOPS[S.stop]!.chance - BASE_CHANCE + chance() + (S.lost ? LOSS.chanceHit : 0);
}
const stop = () => STOPS[S.stop]!;
const resolved = (i: InboxItem) => !!i.fix && (isApplied(i.fix) || S.opened.has('dismiss:' + i.fix.id));
function readings(): Record<string, [Reading, string]> {
  const r: Record<string, [Reading, string]> = { ...stop().readings, ...(S.lost ? LOSS.readings : {}) };
  for (const i of inbox()) if (i.unit && resolved(i)) delete r[i.unit];
  return r;
}
const inbox = (): InboxItem[] => [...(S.lost ? LOSS.inbox : []), ...stop().inbox];
function readingChip(id: string): string {
  const w = wishlist();
  if (w.reserves.some((r) => r.id === id)) return '';
  const r = readings()[id];
  const [cls, label] = !r ? ['ok', 'on track'] : r[0] === 'at risk' ? ['warn', 'at risk'] : ['bad', 'behind'];
  return `<span class="chip ${cls}" title="${r ? esc(r[1]) : 'Every open milestone ≥ 80%'}">${label}</span>`;
}

function inboxItem(i: InboxItem): string {
  const done = resolved(i);
  if (i.kind === 'milestone' || i.kind === 'check')
    return `<div class="ib"><span class="chip ${i.kind === 'check' ? 'ov' : 'dim'}">${i.kind === 'check' ? 'in-play check' : 'this map'}</span> ${esc(i.text)}</div>`;
  const tag = i.kind === 'at-risk' ? '<span class="chip warn">at risk</span>' : i.kind === 'behind' ? '<span class="chip bad">behind</span>' : '<span class="chip ok">re-solve</span>';
  const f = i.fix!;
  return `<div class="ib ${done ? 'done' : ''}">${tag} <b>${esc(i.text)}</b>${i.chance ? ` <small>milestone chance ${i.chance[0]}% → ${i.chance[1]}% with:</small>` : ''}
    <div class="edit"><span>${esc(f.label)}</span>${cost(f.delta, T0 - 5000, f.split)}
    ${done ? (isApplied(f) ? `<span class="chip ok">done</span> <button data-undo="${f.id}">undo</button>` : '<small>dismissed</small>')
      : `<button class="primary" data-${i.kind === 'at-risk' ? 'pin' : 'accept'}="${f.id}">${i.kind === 'at-risk' ? 'pin it' : 'accept'}</button>${i.kind === 'proposal' ? `<button data-dismiss="${f.id}">dismiss</button>` : ''}`}</div></div>`;
}

function runTab(): string {
  const s = stop();
  const items = inbox();
  const open = items.filter((i) => i.fix && !resolved(i));
  const next = S.stop + 1 < STOPS.length;
  const record = S.recording
    ? `<div class="card rec"><h3>Record results: ${s.map}</h3><p class="note">(Today’s Record results steps — deployed, recruits, deaths, marriages, gold, class changes, items — collapsed to one choice for the prototype.)</p>
        ${next ? `<button class="primary" data-record="clean">Cleared, no deaths</button> ${S.stop >= 2 && !S.lost ? `<button data-record="loss">Cleared, but ${LOSS.unit} died</button>` : ''}` : '<p>End of the scripted run.</p>'}
        <button data-record="cancel">cancel</button></div>`
    : `<div class="card nextmap"><b>Next map</b> <span class="map">${s.map}</span>
        <button data-tab="prep">Prepare</button><button class="primary" data-record="start">Record results</button>
        ${open.length ? `<small class="warnline">${open.length} item${open.length > 1 ? 's' : ''} above still need${open.length > 1 ? '' : 's'} you (you can play anyway)</small>` : ''}</div>`;
  return `${headline()}
    ${S.changed ? `<div class="card changed"><h3>What changed on ${S.changed.map}</h3><ul>${S.changed.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><button data-seen>got it</button></div>` : ''}
    <div class="card"><h3>Before ${s.map}: what needs you</h3>
      ${items.length ? items.map(inboxItem).join('') : ''}
      ${!open.length ? '<p class="note">Nothing to decide. Play it.</p>' : ''}</div>
    ${record}
    <details class="card"><summary>Chapter log (${S.log.length} recorded)</summary>${S.log.map((l) => `<div class="line">${esc(l)}</div>`).join('') || '<small>Nothing recorded yet.</small>'}</details>`;
}

function prepTab(): string {
  const s = stop();
  const pins = S.applied.filter((a) => a.pinned && a.edit.id.startsWith('sp-'));
  return `${headline()}<div class="card"><h2>Prepare: ${s.map}</h2>
    <p class="note">Today’s preparation page (matchups, deployment and pairs, loadouts, supply list, seals and promotions, chapter guide) stays. What the roadmap adds, stubbed:</p>
    <ul>
      <li><b>Lineup from the roadmap:</b> Robin leads${pins.length ? ', Frederick backs (your span pin)' : ', Chrom backs'}. Positions come from the solve, not a role setting.</li>
      <li><b>EXP priority:</b> Robin high, Frederick low (chips or waits). Expected: Robin +180–240 EXP.</li>
      <li><b>Milestone actions before this map:</b> ${s.inbox.filter((i) => i.kind === 'milestone').map((i) => esc(i.text)).join(' ') || 'none'}</li>
      <li><b>Items before this map:</b> nothing planned.</li>
    </ul><button data-tab="run">← back to Run</button></div>`;
}

function variantD(): string {
  if (!S.locked)
    return `<div class="dbar"><span class="on">1. Before the run</span><span>2. Lock Robin</span><span>3. Run</span></div>${variantC()}`;
  const tabs = `<div class="dbar tabs"><button class="${S.tab !== 'wishlist' ? 'on' : ''}" data-tab="run">Run</button><button class="${S.tab === 'wishlist' ? 'on' : ''}" data-tab="wishlist">Wishlist ${
    Object.keys(readings()).length ? `<span class="chip warn">${Object.keys(readings()).length}</span>` : ''}</button></div>`;
  if (S.tab === 'wishlist') return tabs + variantB();
  return `${tabs}<div class="c">${S.tab === 'prep' ? prepTab() : runTab()}</div>`;
}

// ---- Render + events ------------------------------------------------------------------------------------------------
function render() {
  const active = document.activeElement as HTMLInputElement | null;
  const caret = active?.dataset && 'q' in active.dataset ? active.selectionStart : null;
  app.innerHTML = variant === 'A' ? variantA() : variant === 'B' ? variantB() : variant === 'C' ? variantC() : variantD();
  bar.innerHTML = `<button data-v="${prev()}">‹</button><span>${variant} — ${VARIANTS[variant]}</span><button data-v="${next()}">›</button>`;
  if (caret !== null) {
    const i = app.querySelector<HTMLInputElement>('[data-q]');
    i?.focus();
    i?.setSelectionRange(caret, caret);
  }
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  history.replaceState(null, '', url);
}
const keys = Object.keys(VARIANTS) as V[];
const prev = () => keys[(keys.indexOf(variant) + keys.length - 1) % keys.length]!;
const next = () => keys[(keys.indexOf(variant) + 1) % keys.length]!;

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-v],[data-step],[data-robin],[data-solve],[data-pin],[data-undo],[data-accept],[data-dismiss],[data-lock],[data-unlock],[data-cell],[data-pincost],[data-moreb],[data-tab],[data-record],[data-seen],summary') as HTMLElement | null;
  if (!t || t.tagName === 'INPUT') return;
  const d = t.dataset;
  if (t.tagName === 'SUMMARY') {
    const p = t.parentElement!;
    if ('moreRobins' in p.dataset) S.moreRobins = !(p as HTMLDetailsElement).open;
    if (p.dataset.paira) {
      const k = 'pairA:' + p.dataset.paira;
      if ((p as HTMLDetailsElement).open) S.opened.delete(k);
      else S.opened.set(k, Date.now());
    }
    return; // let <details> toggle natively; state is read on next render
  }
  if (d.v) variant = d.v as V;
  if (d.step) S.step = +d.step;
  if (d.robin) (S.robin = d.robin), (S.robinDecided = true);
  if (d.solve) {
    const id = d.solve;
    S.solving.set(id, Date.now());
    const tick = setInterval(render, 1000);
    setTimeout(() => (clearInterval(tick), S.solving.delete(id), S.solvedExtra.set(id, solveRobin(robinOpt(id))), render()), 4000);
  }
  if (d.pin) apply(edit(d.pin), true);
  if (d.undo) undo(d.undo);
  if (d.accept) apply(edit(d.accept), false);
  if (d.dismiss) S.opened.set('dismiss:' + d.dismiss, 0);
  if ('lock' in d) (S.locked = true), (S.robinDecided = true);
  if ('unlock' in d) S.locked = false;
  if (d.cell) S.cell = S.cell === d.cell ? undefined : d.cell;
  if (d.pincost) S.showPinCost.add(d.pincost);
  if ('moreb' in d) S.moreRobins = !S.moreRobins;
  if ('lock' in d) S.tab = 'run';
  if (d.tab) S.tab = d.tab as typeof S.tab;
  if ('seen' in d) S.changed = undefined;
  if (d.record === 'start') S.recording = true;
  if (d.record === 'cancel') S.recording = false;
  if (d.record === 'clean' || d.record === 'loss') {
    const played = stop().map;
    S.log.push(`${played}: cleared${d.record === 'loss' ? `, ${LOSS.unit} died` : ', no deaths'}`);
    S.stop++;
    if (d.record === 'loss') S.lost = true;
    S.changed = { map: played, lines: d.record === 'loss' ? [...LOSS.changed, ...stop().changed.slice(1)] : stop().changed };
    S.recording = false;
  }
  render();
});
document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if ('norobin' in t.dataset) (S.noRobin = t.checked), render();
});
document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if ('q' in t.dataset) (S.query = t.value), render();
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') variant = prev();
  else if (e.key === 'ArrowRight') variant = next();
  else return;
  render();
});
render();
