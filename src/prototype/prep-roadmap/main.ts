// PROTOTYPE — throwaway (#169). Three Prepare pages for the next map once the roadmap exists, switchable via
// ?variant=A|B|C and ?stop=0|1|2 (Prologue: forced, no prep phase · Ch 5: at-risk pin, support start, booster ·
// Ch 13: Lucina's paralogue entry, mid-map seal, tonics). State lives in memory.
import { STEP_LABEL, STOPS, pct, units, type Action, type Member, type Pair, type Stop, type Step } from './model';

const VARIANTS = { A: 'Today’s page + sections', B: 'The game’s prep menu, in order', C: 'Pair cards + map column', D: 'Merge: C’s cards, A’s sections' } as const;
type V = keyof typeof VARIANTS;
const q = new URLSearchParams(location.search);
let variant = (q.get('variant') ?? 'A') as V;
if (!(variant in VARIANTS)) variant = 'A';
let stopIx = Math.min(Math.max(Number(q.get('stop') ?? 1) || 0, 0), STOPS.length - 1);
const ticked = new Set<string>();
const pinned = new Set<string>();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const gain = (g: number) => (g ? `<span class="cost pos">+${g.toFixed(1)}</span>` : '<span class="cost noise">±0</span>');
const expTxt = (x: Member) => `${x.exp[0]}–${x.exp[1]} EXP`;
const tick = (a: Action) => `<label class="act${ticked.has(a.id) ? ' done' : ''}"><input type="checkbox" data-tick="${a.id}" ${ticked.has(a.id) ? 'checked' : ''}/> <span>${esc(a.text)}<br/><small>${esc(a.why)}</small></span>${gain(a.gain)}</label>`;
const pinBtn = (x: Member) =>
  x.atRisk ? `<div class="risk"><span class="chip warn">at risk</span> ${esc(x.atRisk)} <button data-pin="${esc(x.unit)}" ${pinned.has(x.unit) ? 'disabled' : ''}>${pinned.has(x.unit) ? 'pinned ✓' : 'Pin'}</button></div>` : '';
const head = (s: Stop, big = false) => `<div class="head${big ? ' big' : ''}">
  <div class="sub"><span class="chance">${pct(s.mapChance)}</span><span>no-death chance on this map</span><small>· plan’s flawless chance before it ${pct(s.planChance)} · ${esc(s.turns)} · deploy ${esc(s.deploy)}</small></div>
  <div class="bracket"><i style="width:${s.mapChance}%"></i></div>
  <small>Loses a unit about 1 run in ${Math.round(100 / (100 - s.mapChance))}. ${s.noPrep ? '' : `${s.actions.filter((a) => a.step !== 'map' && a.gain).length} things to do before you start.`}</small></div>`;
const forced = (s: Stop) => (s.noPrep ? `<div class="banner warn"><b>No preparation phase.</b> ${esc(s.forcedNote ?? '')}</div>` : '');

// ---- A: today's page, with new sections --------------------------------------------------------------------------
function lineupTable(s: Stop): string {
  const row = (p: Pair | undefined, x: Member, back?: Member) => `<tr><td>${esc(x.unit)}${pinBtn(x)}</td><td>${back ? esc(back.unit) : p ? '—' : '<small>solo</small>'}</td>
    <td>${p ? p.stances.map((st) => `<div><small>${st.turns}</small> ${esc(st.stance)}</div>`).join('') : '<small>apart</small>'}</td>
    <td>${[x, back].filter(Boolean).map((y) => `${esc(y!.unit)}: ${esc(y!.job)}`).join('<br/>')}</td>
    <td class="num">${[x, back].filter(Boolean).map((y) => `#${y!.priority}`).join('<br/>')}</td>
    <td class="num">${[x, back].filter(Boolean).map((y) => expTxt(y!)).join('<br/>')}</td></tr>`;
  return `<table class="t"><tr><th>Lead</th><th>Back</th><th>Stance plan</th><th>Job</th><th>EXP priority</th><th>Expected EXP</th></tr>
    ${s.pairs.map((p) => row(p, p.lead, p.back)).join('')}${s.solos.map((x) => row(undefined, x)).join('')}</table>
    ${s.notFielded.length ? `<p class="note">Not fielded: ${s.notFielded.map(esc).join(', ')}</p>` : ''}`;
}
function variantA(s: Stop): string {
  const pre = s.actions.filter((a) => a.step !== 'map');
  const onMap = s.actions.filter((a) => a.step === 'map');
  return `<div class="c wide"><button class="ghost">← Run</button><h2>Prepare: ${esc(s.map)}</h2>${head(s)}${forced(s)}
    <details class="card" open><summary><b>Before this map</b> <span class="new">new</span> (${pre.length})</summary>
      ${pre.length ? pre.map(tick).join('') : '<p class="note">Nothing: the game gives no preparation phase.</p>'}
      ${onMap.length ? `<h3>On the map</h3>${onMap.map(tick).join('')}` : ''}</details>
    <details class="card" open><summary><b>Lineup and stances</b> <span class="new">replaces Deployment and pairs</span></summary>${lineupTable(s)}</details>
    <details class="card" open><summary><b>Threats</b> <span class="new">+ chance, + who takes them</span></summary>
      <table class="t"><tr><th>#</th><th>Enemy</th><th>Worst case (today)</th><th>Kills someone</th><th>Who takes them</th></tr>
      ${s.threats.map((t) => `<tr><td class="num">${t.count}</td><td>${esc(t.name)} <small>${esc(t.cls)}</small></td><td class="${t.worstKills ? 'neg' : ''}">${esc(t.worst)}</td><td class="num">${pct(t.death)}</td><td>${esc(t.who)}</td></tr>`).join('')}</table></details>
    ${s.noPrep ? '' : `<details class="card"><summary><b>Supply list</b> <span class="new">becomes the shopping list</span> (${s.gold[0]}G of ${s.gold[1]}G)</summary>${s.actions.filter((a) => a.step === 'armory').map(tick).join('')}</details>
    <details class="card"><summary><b>Seals and promotions</b> <span class="new">from the roadmap’s class milestones</span></summary>${s.actions.filter((a) => a.kind === 'seal').map(tick).join('') || '<p class="note">No class change planned on this map.</p>'}</details>
    <details class="card"><summary><b>Loadouts</b></summary><p class="note">Today’s table, with the item plan’s carriers applied (stub).</p></details>`}
    <details class="card"><summary><b>Checks and assumptions</b> <span class="new">new</span></summary><ul>${[...s.checks, ...s.assumptions].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
    <details class="card"><summary><b>Matchups</b></summary><p class="note">Today’s matchup table, unchanged (worst round vs HP), stub.</p></details>
    <details class="card"><summary><b>Chapter guide</b></summary><p class="note">Today’s how-to-run text, stub.</p></details></div>`;
}

// ---- B: the game's preparation menu, in order ---------------------------------------------------------------------
function variantB(s: Stop): string {
  const steps: Step[] = ['units', 'trade', 'items', 'skills', 'armory'];
  const menu = steps.map((st, i) => {
    const acts = s.actions.filter((a) => a.step === st);
    const body = s.noPrep ? '<small>Not available: the game skips preparations.</small>'
      : st === 'units' ? `${s.pairs.map((p) => `<div class="pairline"><b>${esc(p.lead.unit)}</b> + ${p.back ? esc(p.back.unit) : '—'} ${p.partnerNote ? `<small>(${esc(p.partnerNote)})</small>` : ''}${pinBtn(p.lead)}${p.back ? pinBtn(p.back) : ''}</div>`).join('')}
          ${s.solos.length ? `<div class="pairline">Solo: ${s.solos.map((x) => esc(x.unit)).join(', ')}</div>` : ''}${acts.map(tick).join('')}`
      : acts.length ? acts.map(tick).join('') : '<small>Nothing this map.</small>';
    return `<li class="step${s.noPrep ? ' off' : ''}"><div class="stepname">${i + 1}. ${STEP_LABEL[st]}</div>${body}</li>`;
  }).join('');
  const all = units(s).sort((a, b) => a.priority - b.priority);
  const onMap = `<div class="card"><h3>On the map</h3>
    <p class="note">Who takes kills, in EXP priority order. Lower units chip or wait.</p>
    <ol class="prio">${all.map((x) => `<li><b>${esc(x.unit)}</b> <small>${esc(x.job)}</small> <span class="expbar"><i style="left:${x.exp[0] / 4}px;width:${(x.exp[1] - x.exp[0]) / 4}px"></i></span> <small>${expTxt(x)}</small>${x.milestone ? `<div class="note">↳ ${esc(x.milestone)}</div>` : ''}${s.noPrep ? pinBtn(x) : ''}</li>`).join('')}</ol>
    <h3>Stances</h3>${s.pairs.length ? s.pairs.map((p) => `<div class="pairline"><b>${esc(p.lead.unit)} + ${p.back ? esc(p.back.unit) : ''}</b>: ${p.stances.map((st) => `<small>${st.turns}</small> ${esc(st.stance)}`).join(' → ')}</div>`).join('') : '<p class="note">Nobody starts paired.</p>'}
    ${s.actions.filter((a) => a.step === 'map').map(tick).join('')}
    ${s.checks.length ? `<h3>Watch for</h3><ul>${s.checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>`;
  return `<div class="c"><button class="ghost">← Run</button><h2>Prepare: ${esc(s.map)}</h2>${head(s, true)}${forced(s)}
    ${s.noPrep ? onMap : ''}
    <div class="card"><h3>Preparations ${s.noPrep ? '' : '<small>in the order the game’s menu shows them</small>'}</h3><ol class="menu">${menu}</ol>
      <div class="step start"><div class="stepname">6. Start the map</div></div></div>
    ${s.noPrep ? '' : onMap}
    <details class="card"><summary>Threats <small>(chance each group kills someone)</small></summary>
      ${s.threats.map((t) => `<div class="pairline"><span class="cost ${t.death >= 1 ? 'neg' : ''}">${pct(t.death)}</span> ${esc(t.name)} ×${t.count} <small>${esc(t.cls)} · ${esc(t.who)}</small> <details class="inline"><summary><small>worst case</small></summary><small>${esc(t.worst)}</small></details></div>`).join('')}</details>
    <details class="card"><summary>Matchups, loadouts, chapter guide</summary><p class="note">Today’s reference sections, stub.</p></details></div>`;
}

// ---- C: a card per pair, with a map column ---------------------------------------------------------------------------
function pairCard(s: Stop, p: Pair | undefined, x: Member[], title: string): string {
  const names = new Set(x.map((y) => y.unit));
  const acts = s.actions.filter((a) => [...names].some((n) => a.text.startsWith(n) || a.text.includes(`${n} (`) || a.text.includes(`Pair ${n}`) || a.text.includes(`to ${n}`)));
  const threats = s.threats.filter((t) => [...names].some((n) => t.who.includes(n) || t.worst.includes(`on ${n}`)));
  return `<div class="card paircard"><div class="pchead"><b>${esc(title)}</b>${p?.partnerNote ? ` <small>${esc(p.partnerNote)}</small>` : ''}</div>
    ${x.map((y) => `<div class="mem"><span class="pos">${p ? (y === p.lead ? 'Lead' : 'Back') : 'Solo'}</span> <b>${esc(y.unit)}</b> <small>${esc(y.job)} · priority #${y.priority}</small>
      <span class="expbar"><i style="left:${y.exp[0] / 4}px;width:${(y.exp[1] - y.exp[0]) / 4}px"></i></span><small>${expTxt(y)}</small>
      ${y.milestone ? `<div class="note">↳ ${esc(y.milestone)}</div>` : ''}${pinBtn(y)}</div>`).join('')}
    ${p ? `<div class="stances">${p.stances.map((st) => `<span><small>${st.turns}</small> ${esc(st.stance)}</span>`).join('')}</div>` : ''}
    ${acts.length ? `<div class="todo">${acts.map(tick).join('')}</div>` : ''}
    ${threats.length ? `<div class="danger">${threats.map((t) => `<div><span class="cost ${t.death >= 1 ? 'neg' : ''}">${pct(t.death)}</span> ${esc(t.name)}${t.worstKills && t.worst.includes(`on ${[...names].find((n) => t.worst.includes(`on ${n}`)) ?? '∅'}`) ? ` <span class="chip bad" title="${esc(t.worst)}">worst case kills</span>` : ''}</div>`).join('')}</div>` : ''}</div>`;
}
function variantC(s: Stop): string {
  const cards = [...s.pairs.map((p) => pairCard(s, p, p.back ? [p.lead, p.back] : [p.lead], `${p.lead.unit} + ${p.back?.unit ?? ''}`)), ...s.solos.map((x) => pairCard(s, undefined, [x], x.unit))];
  const armyWide = s.actions.filter((a) => a.step === 'armory' || (a.step === 'map' && !s.pairs.length));
  return `<div class="cc"><main><button class="ghost">← Run</button><h2>Prepare: ${esc(s.map)}</h2>${forced(s)}
      <div class="cards">${cards.join('')}</div>
      ${s.notFielded.length ? `<p class="note">Not fielded: ${s.notFielded.map(esc).join(', ')}</p>` : ''}</main>
    <aside>${head(s)}
      <h3>Threats</h3>${s.threats.map((t) => `<div class="thr"><span class="bar"><i style="width:${Math.min(t.death * 30, 100)}%"></i></span><span class="cost ${t.death >= 1 ? 'neg' : ''}">${pct(t.death)}</span> ${esc(t.name)} ×${t.count}<br/><small>${esc(t.who)}</small></div>`).join('')}
      ${armyWide.length ? `<h3>${s.noPrep ? 'Whole army' : `Armory <small>${s.gold[0]}G of ${s.gold[1]}G</small>`}</h3>${armyWide.map(tick).join('')}` : ''}
      <h3>Watch for</h3><ul class="note">${[...s.checks, ...s.assumptions].map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <details><summary><small>Matchups, loadouts, chapter guide</small></summary><p class="note">Today’s reference sections, stub.</p></details></aside></div>`;
}

// ---- D: the user's merge — C's pair cards, A's sections in the column ------------------------------------------------
function variantD(s: Stop): string {
  const cards = [...s.pairs.map((p) => pairCard(s, p, p.back ? [p.lead, p.back] : [p.lead], `${p.lead.unit} + ${p.back?.unit ?? ''}`)), ...s.solos.map((x) => pairCard(s, undefined, [x], x.unit))];
  const pre = s.actions.filter((a) => a.step !== 'map');
  const onMap = s.actions.filter((a) => a.step === 'map');
  const done = s.actions.filter((a) => ticked.has(a.id)).length;
  return `<div class="cc dd"><main><button class="ghost">← Run</button><h2>Prepare: ${esc(s.map)}</h2>${forced(s)}
      <div class="cards">${cards.join('')}</div>
      ${s.notFielded.length ? `<p class="note">Not fielded: ${s.notFielded.map(esc).join(', ')}</p>` : ''}</main>
    <aside>${head(s)}
      <details class="card" open><summary><b>${s.noPrep ? 'On the map' : 'Before this map'}</b> (${done} of ${s.actions.length} done)</summary>
        ${s.noPrep ? '' : ([...new Set(pre.map((a) => a.step))] as Step[]).map((st) => `<h3>${STEP_LABEL[st]}</h3>${pre.filter((a) => a.step === st).map(tick).join('')}`).join('')}
        ${onMap.length ? `${s.noPrep ? '' : '<h3>On the map</h3>'}${onMap.map(tick).join('')}` : ''}</details>
      <details class="card" open><summary><b>Threats</b></summary>
        <table class="t tight"><tr><th>Enemy</th><th>Worst case</th><th>Kills someone</th></tr>
        ${s.threats.map((t) => `<tr><td>${esc(t.name)} ×${t.count}<br/><small>${esc(t.who)}</small></td><td class="${t.worstKills ? 'neg' : ''}"><small>${esc(t.worst)}</small></td><td class="num">${pct(t.death)}</td></tr>`).join('')}</table></details>
      ${s.noPrep ? '' : `<details class="card"><summary><b>Shopping list</b> (${s.gold[0]}G of ${s.gold[1]}G)</summary>${s.actions.filter((a) => a.step === 'armory').map(tick).join('')}</details>
      <details class="card"><summary><b>Seals and promotions</b></summary>${s.actions.filter((a) => a.kind === 'seal').map(tick).join('') || '<p class="note">No class change planned on this map.</p>'}</details>
      <details class="card"><summary><b>Loadouts</b></summary><p class="note">Today’s table, with the item plan’s carriers applied (stub).</p></details>`}
      <details class="card"><summary><b>Checks and assumptions</b></summary><ul class="note">${[...s.checks, ...s.assumptions].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
      <details class="card"><summary><b>Matchups</b></summary><p class="note">Today’s matchup table (stub).</p></details>
      <details class="card"><summary><b>Chapter guide</b></summary><p class="note">Today’s how-to-run text (stub).</p></details></aside></div>`;
}

// ---- wiring ---------------------------------------------------------------------------------------------------------
const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
function render() {
  const s = STOPS[stopIx]!;
  app.innerHTML = variant === 'A' ? variantA(s) : variant === 'B' ? variantB(s) : variant === 'C' ? variantC(s) : variantD(s);
  bar.innerHTML = `<button data-v="-1">←</button><span>${variant} — ${VARIANTS[variant]}</span><button data-v="1">→</button>
    <span class="sep">|</span>${STOPS.map((x, i) => `<button class="${i === stopIx ? 'on' : ''}" data-stop="${i}">${x.short}</button>`).join('')}`;
  const u = new URL(location.href);
  u.searchParams.set('variant', variant);
  u.searchParams.set('stop', String(stopIx));
  history.replaceState(null, '', u);
}
const cycle = (d: number) => {
  const keys = Object.keys(VARIANTS) as V[];
  variant = keys[(keys.indexOf(variant) + d + keys.length) % keys.length]!;
  render();
};
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.v) cycle(Number(t.dataset.v));
  else if (t.dataset.stop) { stopIx = Number(t.dataset.stop); render(); }
  else if (t.dataset.pin) { pinned.add(t.dataset.pin); render(); }
});
document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.tick) { t.checked ? ticked.add(t.dataset.tick) : ticked.delete(t.dataset.tick); render(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});
render();
