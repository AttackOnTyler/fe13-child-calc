// PROTOTYPE — throwaway (#258). Three Prepare pages for the position plan (#257), switchable via ?variant=A|B|C
// @ts-nocheck — prototype, strict index checks skipped on purpose
// (A: board + turn stepper · B: the script as a checklist · C: unit lanes × turns). State lives in memory.
import { ALLIES, ENEMIES, H, HANDOFF, HEADLINE, ROWS, SCRIPT, W, byId, dangerFor, walkable, type Pos, type Turn, type Unit } from './model';

const VARIANTS = { A: 'Board + turn stepper', B: 'Script checklist', C: 'Unit lanes × turns', D: 'Merge: A’s stepper + B’s checklist, C’s board column' } as const;
type V = keyof typeof VARIANTS;
const q = new URLSearchParams(location.search);
let variant = (q.get('variant') ?? 'D') as V;
if (!(variant in VARIANTS)) variant = 'D';

// ---- state -------------------------------------------------------------------------------------------------------
let turnIx = 0;
let focus = 'lis'; // whose danger the board shades
let pick = 0; // the unit-cycle cursor (skill taps, lanes)
const outcome = new Map<string, string>(); // action id → as forecast / missed / crit / killed / DS
const confirmed = new Map<string, 'ok' | 'fix'>(); // `${turn}:${enemy}` → ✓ or fixed
/** Random-skill taps: cautious by default (damage and crit skills assumed present until tapped off). */
const skillOn = new Map<string, Set<string>>(ENEMIES.map((e) => [e.id, new Set([...e.skills, ...(e.possible ?? []).filter((s) => s !== 'Avoid +10' && s !== 'Focus')])]));
let seenT1 = false;
const skillsOf = (e: Unit) => [...(skillOn.get(e.id) ?? [])];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const nm = (id: string) => byId(id).name + (byId(id).side === 'enemy' ? ` (${byId(id).weapon})` : '');
const at = (p?: [number, number]) => (p ? `(${p[0]},${p[1]})` : '');
const letter: Record<string, string> = { fre: 'F', chr: 'C', rob: 'R', lis: 'L', g: 'G', w: 'W', t: 'T' };
const tok = (u: Unit) => letter[u.id] ?? u.name[0];

// ---- the shared board ----------------------------------------------------------------------------------------------
function board(t: Turn, opts: { small?: boolean; focusId?: string; hl?: string } = {}): string {
  const f = byId(opts.focusId ?? focus);
  const allies = t.allies as Pos;
  const prev = SCRIPT[t.n - 2]?.allies ?? Object.fromEntries(ALLIES.map((a) => [a.id, [a.x, a.y]]));
  const danger = f.side === 'ally' ? dangerFor(f, t.foes, allies, new Set(t.awake), skillsOf) : new Map();
  const occ = new Map<string, Unit[]>();
  for (const [id, p] of Object.entries(allies)) occ.set(`${p[0]},${p[1]}`, [...(occ.get(`${p[0]},${p[1]}`) ?? []), byId(id)]);
  for (const [id, p] of Object.entries(t.foes)) occ.set(`${p[0]},${p[1]}`, [...(occ.get(`${p[0]},${p[1]}`) ?? []), byId(id)]);
  const dest = new Map(t.actions.filter((a) => a.to).map((a, i) => [`${a.to![0]},${a.to![1]}`, i + 1]));
  const ghost = new Set(t.actions.filter((a) => a.to).map((a) => { const p = prev[a.unit]; return p ? `${p[0]},${p[1]}` : ''; }));
  const pred = new Map(t.enemy.map((m) => [`${m.to[0]},${m.to[1]}`, m.id]));
  const near = (x: number, y: number) => Object.values(allies).some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - y) <= 2);
  let cells = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = `${x},${y}`;
    const d = danger.get(k);
    const kills = d && d.total >= f.hp;
    const us = occ.get(k) ?? [];
    const cls = ['c', `ter-${ROWS[y]![x] === '+' ? 'bridge' : ROWS[y]![x]}`, walkable(x, y) ? '' : 'off', d ? (kills ? 'dz-kill' : 'dz') : '', ghost.has(k) ? 'ghost' : '', pred.has(k) ? 'pred' : '', opts.hl === k ? 'hl' : ''].join(' ');
    const title = `${at([x, y])} ${d ? `· ${d.foes.length} foe${d.foes.length > 1 ? 's' : ''} can strike ${f.name} here: ${d.foes.map((z: { id: string; dmg: number; hits: number }) => `${nm(z.id)} ${z.dmg}${z.hits > 1 ? '×2' : ''}`).join(', ')} = ${d.total} of ${f.hp}` : ''}`;
    cells += `<div class="${cls}" title="${esc(title)}">${us.map((u) => `<span class="u ${u.side}${u.id === 'chr' && allies.chr && allies.fre && allies.chr[0] === allies.fre[0] && allies.chr[1] === allies.fre[1] ? ' back' : ''}${u.id === f.id ? ' focus' : ''}">${tok(u)}</span>`).join('')}${dest.has(k) ? `<i class="step">${dest.get(k)}</i>` : ''}${d && !opts.small && near(x, y) ? `<b class="dmg">${d.total}</b>` : ''}</div>`;
  }
  return `<div class="board${opts.small ? ' small' : ''}" style="grid-template-columns:repeat(${W},1fr)">${cells}</div>`;
}
const focusPicker = () => `<div class="focus">Danger to <select data-focus>${ALLIES.filter((a) => a.id !== 'chr').map((a) => `<option value="${a.id}" ${a.id === focus ? 'selected' : ''}>${a.name}</option>`).join('')}<option value="chr" ${focus === 'chr' ? 'selected' : ''}>Chrom (if exposed)</option></select>
  <span class="legend"><i class="dz"></i> can be hit <i class="dz-kill"></i> killable without a crit <i class="pred"></i> predicted enemy move <i class="stepk">1</i> planned move</span></div>`;

// ---- shared pieces -------------------------------------------------------------------------------------------------
const unsafe = () => SCRIPT.filter((t) => checked(t).some((x) => x.total >= x.hp));
const headline = () => `<div class="head"><div class="promise"><span class="big">No death without a crit</span> <span class="chip ${unsafe().length ? 'bad' : 'ok'}">${unsafe().length ? `broken on ${unsafe().map((t) => 'T' + t.n).join(', ')} (computed)` : 'every turn (computed)'}</span></div>
  <div>crit risk <b>${HEADLINE.crit}%</b> over the map · rout on <b>turn ${HEADLINE.rout}</b> <small>(target ≤ 7, stretch ${HEADLINE.stretch}; attempt 1: ${HEADLINE.baseline})</small></div></div>`;
/** The safety check, computed from the board: each unit's gang-up worst case where the plan leaves it. */
function checked(t: Turn): { id: string; total: number; hp: number; foes: number }[] {
  return ALLIES.filter((a) => t.allies[a.id] && !(a.id === 'chr' && t.allies.fre && t.allies.chr[0] === t.allies.fre[0] && t.allies.chr[1] === t.allies.fre[1])).map((a) => {
    const p = t.allies[a.id];
    const d = dangerFor(a, t.foes, t.allies, new Set(t.awake), skillsOf).get(`${p[0]},${p[1]}`);
    return { id: a.id, total: d?.total ?? 0, hp: a.hp, foes: d?.foes.length ?? 0 };
  });
}
const safety = (t: Turn) => {
  const c = checked(t);
  const ok = c.every((x) => x.total < x.hp);
  return `<div class="verdict ${ok ? 'ok' : 'bad'}"><b>${ok ? '✓ Safe' : '✗ No safe line'}</b> <small>(computed from the board)</small> · crit risk ${t.crit}%${t.wakes ? ` · <b>wakes ${esc(t.wakes)}</b>` : ''}
    <div class="checks">${c.map((x) => `<span class="${x.total >= x.hp ? 'kill' : x.total ? 'hit' : ''}">${esc(byId(x.id).name)} ${x.foes ? `${x.total}/${x.hp} from ${x.foes} foe${x.foes > 1 ? 's' : ''}` : 'out of reach'}</span>`).join('')}</div>
    <small>${esc(t.safety)}</small></div>`;
};
const OUT = ['as forecast', 'missed', 'crit', 'killed', 'Dual Strike'];
function actionRow(t: Turn, a: Turn['actions'][number], i: number, compact = false): string {
  const o = outcome.get(a.id);
  return `<div class="act${o && o !== 'as forecast' ? ' off' : o ? ' done' : ''}"><div class="n">${i + 1}</div><div class="body">
    <div><b>${esc(byId(a.unit).name)}</b> ${a.to ? `→ ${at(a.to)} ` : ''}<span class="cmd">${esc(a.cmd)}</span>${a.target ? ` ${esc(nm(a.target))}` : ''}${a.equip ? ` <span class="chip">ends holding ${esc(a.equip)}</span>` : ''}${a.pair ? ` <span class="chip">${esc(a.pair)}</span>` : ''}</div>
    ${a.forecast ? `<div class="fc">${esc(a.forecast)}</div>` : ''}
    ${compact ? '' : `<small>${esc(a.why)}${a.exp ? ` · <span class="exp">${esc(a.exp)}</span>` : ''}</small>`}
    ${a.branch && o === 'missed' ? `<div class="branch">↳ ${esc(a.branch)}</div>` : ''}
    ${t.detailed && (a.cmd === 'Attack' || a.cmd === 'Heal') ? `<div class="taps">${OUT.filter((x) => a.cmd === 'Attack' || x === 'as forecast').map((x) => `<button data-out="${a.id}|${x}" class="${o === x ? 'on' : ''}">${x}</button>`).join('')}</div>` : ''}
  </div></div>`;
}
function enemyReplay(t: Turn): string {
  if (!t.enemy.length) return '';
  const rows = t.enemy.map((m) => {
    const c = confirmed.get(`${t.n}:${m.id}`);
    return `<div class="em${c ? ` ${c}` : ''}"><span class="u enemy">${tok(byId(m.id))}</span> <span>${esc(nm(m.id))} → ${at(m.to)}, ${esc(m.does)}</span>
      <span class="taps"><button data-conf="${t.n}:${m.id}|ok" class="${c === 'ok' ? 'on' : ''}">✓</button><button data-conf="${t.n}:${m.id}|fix" class="${c === 'fix' ? 'on' : ''}">fix</button></span>
      ${c === 'fix' ? `<div class="fix">Target <select><option>as predicted</option>${ALLIES.map((a) => `<option>${a.name}</option>`).join('')}</select> tile <input size="6" placeholder="x,y"/> <small>(re-plans from here)</small></div>` : ''}</div>`;
  }).join('');
  const done = t.enemy.every((m) => confirmed.has(`${t.n}:${m.id}`));
  return `<h3>Enemy phase ${t.n}: predicted <small>(tick or fix; ${done ? '<b class="okc">all confirmed: re-planning T' + (t.n + 1) + '–' + (t.n + 3) + '</b>' : 'folklore targeting: kills first'})</small></h3>${rows}`;
}
function skillTaps(): string {
  const list = ENEMIES.filter((e) => (e.possible ?? []).length || e.skills.length);
  const e = list[((pick % list.length) + list.length) % list.length]!;
  return `<details class="card" ${seenT1 ? '' : 'open'}><summary><b>Turn 1: what did they roll?</b> <small>optional · cautious until tapped</small></summary>
    <div class="cycle"><button data-pick="-1">◀</button> <span class="u enemy">${tok(e)}</span> <b>${esc(e.name)}</b> ${at([e.x, e.y])} <small>${esc(e.weapon)} · ${e.wake === 'now' ? 'moves now' : e.wake === 'group 1' ? 'wakes with group 1' : 'never moves'}</small> <button data-pick="1">▶</button> <small>${list.indexOf(e) + 1} / ${list.length}</small></div>
    <div class="taps">${[...new Set([...(e.possible ?? []), ...e.skills])].map((s) => `<button data-skill="${e.id}|${s}" class="${skillOn.get(e.id)!.has(s) ? 'on' : ''}">${esc(s)}</button>`).join('')}</div>
    <small>On = counted. Damage and crit skills start on (safety assumes them); Avoid +10 and Focus start off (prediction only). The game’s L button cycles units too.</small>
    <div><button data-seen>Done: re-plan with these</button></div></details>`;
}
const stepper = () => `<div class="stepper">${SCRIPT.map((t, i) => `<button data-turn="${i}" class="${i === turnIx ? 'on' : ''} ${checked(t).some((x) => x.total >= x.hp) ? 'bad' : ''} ${t.detailed ? '' : 'outline'}">T${t.n}${t.detailed ? '' : '·'}</button>`).join('')} <small>solid: detailed (3 turns) · dotted: outline · re-plans on each confirmation</small></div>`;

// ---- A: board + turn stepper ----------------------------------------------------------------------------------------
function variantA(): string {
  const t = SCRIPT[turnIx]!;
  return `${headline()}${stepper()}<div class="colsA"><div>${focusPicker()}${board(t)}</div><div>
    <h2>T${t.n}: ${esc(t.title)}</h2>${safety(t)}
    ${t.detailed ? t.actions.map((a, i) => actionRow(t, a, i)).join('') : `<p class="outline">${esc(t.outline ?? '')}</p>`}
    ${enemyReplay(t)}${turnIx === 0 ? skillTaps() : ''}${t.n >= 6 ? `<div class="card"><b>Next-map handoff</b><br/><small>${esc(HANDOFF)}</small></div>` : ''}</div></div>`;
}

// ---- B: the script as a checklist -------------------------------------------------------------------------------
function variantB(): string {
  return `${headline()}${skillTaps()}<div class="script">${SCRIPT.map((t, i) => `<section class="turn ${t.safe ? '' : 'bad'} ${i === turnIx ? 'cur' : ''}" data-turn="${i}">
    <div class="th"><span class="tn">T${t.n}</span> <b>${esc(t.title)}</b> <span class="chip ${t.safe ? 'ok' : 'bad'}">${t.safe ? 'safe' : 'no safe line'}</span> <small>crit ${t.crit}%</small>${t.wakes ? ' <span class="chip warn">wakes group 1</span>' : ''}</div>
    ${t.detailed ? `<div class="colsB"><div>${t.actions.map((a, j) => actionRow(t, a, j, false)).join('')}${t.safe ? '' : `<div class="verdict bad"><small>${esc(t.safety)}</small></div>`}${enemyReplay(t)}</div><div>${board(t, { small: true })}</div></div>`
      : `<p class="outline">${esc(t.outline ?? '')}${t.n === 6 ? `<br/><b>Handoff:</b> ${esc(HANDOFF)}` : ''}</p>`}</section>`).join('')}</div>`;
}

// ---- C: unit lanes × turns ----------------------------------------------------------------------------------------
function cellFor(t: Turn, id: string): string {
  const a = t.actions.find((x) => x.unit === id);
  const p = (t.allies as Pos)[id];
  const d = dangerFor(byId(id), t.foes, t.allies, new Set(t.awake), skillsOf).get(p ? `${p[0]},${p[1]}` : '');
  const paired = id === 'chr' && p && t.allies.fre && p[0] === t.allies.fre[0] && p[1] === t.allies.fre[1];
  const bad = d && d.total >= byId(id).hp && !paired;
  const txt = !t.detailed ? `<small>${at(p)}</small>` : a ? `${a.to ? at(a.to) + ' ' : ''}<b>${esc(a.cmd)}</b>${a.target ? ` ${esc(byId(a.target).name)}` : ''}` : `<small>${paired ? 'back of Frederick' : 'stays ' + at(p)}</small>`;
  return `<td class="${bad ? 'kill' : d && !paired ? 'hit' : ''} ${t.detailed ? '' : 'outline'}" data-cell="${SCRIPT.indexOf(t)}|${id}" title="${d ? `worst case ${d.total} of ${byId(id).hp}` : 'out of reach'}">${txt}${d && !paired ? `<div class="wc">${d.total}/${byId(id).hp}</div>` : ''}</td>`;
}
function variantC(): string {
  const t = SCRIPT[turnIx]!;
  const foeRow = (label: string, ids: string[]) => `<tr class="foes"><th>${label}</th>${SCRIPT.map((s) => `<td class="${s.detailed ? '' : 'outline'}">${ids.filter((id) => s.awake.includes(id) && !(s.dead ?? []).includes(id)).length}/${ids.length} awake${s.wakes && label.startsWith('North') ? ' <b>← pulled</b>' : ''}</td>`).join('')}</tr>`;
  return `${headline()}<div class="colsC"><div><table class="lanes"><tr><th></th>${SCRIPT.map((s, i) => `<th class="${i === turnIx ? 'on' : ''} ${s.safe ? '' : 'bad'}" data-turn="${i}">T${s.n}${s.safe ? '' : ' ✗'}<br/><small>crit ${s.crit}%</small></th>`).join('')}</tr>
    ${ALLIES.map((a) => `<tr><th>${esc(a.name)}</th>${SCRIPT.map((s) => cellFor(s, a.id)).join('')}</tr>`).join('')}
    ${foeRow('South (moves now)', ['m1', 'm2', 'b1', 'b2', 'w'])}${foeRow('North (group 1)', ['m3', 'm4', 'b3', 'b4', 't'])}
    <tr class="foes"><th>Garrick</th>${SCRIPT.map((s) => `<td class="${s.detailed ? '' : 'outline'}">${s.n === 7 ? '<b>attack</b>' : 'holds (8,1)'}</td>`).join('')}</tr></table>
    <p class="note">Red: that unit is killable without a crit where the plan leaves it. A number: its gang-up worst case this enemy phase. Click a cell for the board.</p>
    <div class="card"><b>Handoff for Chapter 1</b> <small>${esc(HANDOFF)}</small></div>${skillTaps()}</div>
    <div class="side"><h3>T${t.n}: ${esc(t.title)}</h3>${safety(t)}${focusPicker()}${board(t, { small: true })}
    ${t.detailed ? t.actions.map((a, i) => actionRow(t, a, i, true)).join('') : `<p class="outline">${esc(t.outline ?? '')}</p>`}${enemyReplay(t)}</div></div>`;
}

// ---- D: the merge — A's stepper + B's checklist on the left, C's board column on the right ------------------------
function variantD(): string {
  const t = SCRIPT[turnIx]!;
  const bad = (s: Turn) => checked(s).some((x) => x.total >= x.hp);
  const card = (s: Turn, i: number) => {
    const cur = i === turnIx;
    const head = `<div class="th" data-turn="${i}"><span class="tn">T${s.n}</span> <b>${esc(s.title)}</b> <span class="chip ${bad(s) ? 'bad' : 'ok'}">${bad(s) ? 'no safe line' : 'safe'}</span> <small>crit ${s.crit}%</small>${s.wakes ? ' <span class="chip warn">wakes group 1</span>' : ''}${s.detailed ? '' : ' <small>· outline</small>'}</div>`;
    if (!cur) return `<section class="turn mini ${bad(s) ? 'bad' : ''}">${head}</section>`;
    return `<section class="turn cur ${bad(s) ? 'bad' : ''}">${head}
      ${s.detailed ? s.actions.map((a, j) => actionRow(s, a, j)).join('') : `<p class="outline">${esc(s.outline ?? '')}</p>`}
      ${enemyReplay(s)}${s.n >= 6 ? `<div class="card"><b>Next-map handoff</b><br/><small>${esc(HANDOFF)}</small></div>` : ''}</section>`;
  };
  return `${headline()}<div class="colsC"><div>${stepper()}${turnIx === 0 ? skillTaps() : ''}<div class="script">${SCRIPT.map(card).join('')}</div></div>
    <div class="side"><h3>T${t.n}: ${esc(t.title)}</h3>${safety(t)}${focusPicker()}${board(t)}</div></div>`;
}

// ---- render + switcher ----------------------------------------------------------------------------------------------
const app = document.getElementById('app')!;
function render() {
  app.innerHTML = `<header><b>FE13 Child Calc</b> <small>Run › Prepare: Prologue: The Verge of History · lunatic · no preparation phase</small></header>` + { A: variantA, B: variantB, C: variantC, D: variantD }[variant]();
  const keys = Object.keys(VARIANTS) as V[];
  document.getElementById('switcher')!.innerHTML = `<button data-v="-1">←</button> <span>${variant} — ${VARIANTS[variant]}</span> <button data-v="1">→</button>`;
  (document.getElementById('switcher') as HTMLElement).dataset.keys = keys.join('');
}
function cycle(d: number) {
  const keys = Object.keys(VARIANTS) as V[];
  variant = keys[(keys.indexOf(variant) + d + keys.length) % keys.length]!;
  const u = new URL(location.href); u.searchParams.set('variant', variant); history.replaceState(null, '', u);
  render();
}
document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest('[data-v],[data-turn],[data-out],[data-conf],[data-pick],[data-skill],[data-seen],[data-cell]') as HTMLElement | null;
  if (!el) return;
  const ds = el.dataset;
  if (ds.v) return cycle(Number(ds.v));
  if (ds.out) { const [id, o] = ds.out.split('|'); outcome.set(id, outcome.get(id) === o ? '' : o); }
  else if (ds.conf) { const [k, v] = ds.conf.split('|'); confirmed.set(k, v as 'ok' | 'fix'); }
  else if (ds.pick) pick += Number(ds.pick);
  else if (ds.skill) { const [id, s] = ds.skill.split('|'); const set = skillOn.get(id)!; set.has(s) ? set.delete(s) : set.add(s); }
  else if (ds.seen !== undefined) seenT1 = true;
  else if (ds.cell) { const [i, id] = ds.cell.split('|'); turnIx = Number(i); if (id !== 'chr') focus = id; }
  else if (ds.turn) turnIx = Number(ds.turn);
  render();
});
document.addEventListener('change', (ev) => { const el = ev.target as HTMLSelectElement; if (el.dataset.focus !== undefined) { focus = el.value; render(); } });
document.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('input,textarea,select,[contenteditable]')) return;
  if (ev.key === 'ArrowLeft') cycle(-1);
  if (ev.key === 'ArrowRight') cycle(1);
});
render();
