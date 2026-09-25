/// <reference types="vite/client" />
// PROTOTYPE — throwaway (#73). "Three places for derived roles and their overrides, switchable via ?variant=A|B|C,
// on a real derivation (standing, role presets, army fit)."
//   A — Sidebar row: the Plan sidebar's per-child row carries the derived role and two small pickers (role, preset).
//   B — Role matrix: a children × roles grid of standings; click a cell to pin a role, a row menu to pin a preset.
//   C — Table-first: the pairing table's preset picker becomes a lens that defaults to the child's plan preset;
//       overriding happens from the table header.
import type { ChildId } from '../../game-data/children';
import type { ChildDeploymentRole } from '../../curated/deployment';
import type { PresetId } from '../../curated/presets';
import { CANDIDATES, NICHE, ROLE_NAME, derive, deploysAs, presetName, topPairings, type Derived, type State } from './derive';

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const VARIANTS = { A: 'Sidebar row', B: 'Role matrix', C: 'Table-first' } as const;
type V = keyof typeof VARIANTS;
let variant = (new URLSearchParams(location.search).get('variant') ?? 'A') as V;
if (!(variant in VARIANTS)) variant = 'A';
const s: State = { robin: null, leaveOut: false, overrides: {} };
let tableChild: ChildId = 'nah';
let lens: PresetId | 'plan' = 'plan';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (n: number) => `${Math.round(n * 100)}`;
const ROLES: ChildDeploymentRole[] = ['lead', 'battery', 'staff'];

function sourceChip(r: Derived) {
  const cls = r.source === 'derived' ? 'd' : r.source === 'army fit' ? 'af' : 'ov';
  const title = r.source === 'army fit' ? r.fitReason : r.source === 'derived' ? 'Best role from its standing against the cast' : 'Set by you; army fit never moves it';
  return `<span class="chip ${cls}" title="${esc(title ?? '')}">${r.source === 'army fit' ? `moved by army fit` : r.source}</span>`;
}
const warn = (r: Derived) => (r.warning ? `<span class="chip warn" title="${esc(r.warning)}">⚠ doesn't qualify</span>` : '');

function robinBanner() {
  if (s.robin) return `<div class="banner ok">Robin: ${s.robin.gender} +${s.robin.asset.toUpperCase()} −${s.robin.flaw.toUpperCase()} (Run facts) <button data-act="unset-robin">unset</button></div>`;
  return `<div class="banner">Set Robin first: Morgan's role is derived from your Robin, so Morgan is left out of the ranking until Robin is set. <button data-act="set-robin">Set Robin (M +Mag −Str)</button></div>`;
}
const leaveOutSwitch = () =>
  `<label class="sw"><input type="checkbox" data-act="leave-out" ${s.leaveOut ? 'checked' : ''}/> Leave Robin and Morgan out <small>(see where the rest of the cast stands)</small></label>`;

function compStrip(d: ReturnType<typeof derive>) {
  return `<div class="comp">${ROLES.map((r) => {
    const q = d.quotas.roles[r];
    const n = d.counts[r];
    return `<span class="${n < q.min || n > q.max ? 'bad' : ''}">${ROLE_NAME[r]} ${n} <small>(${q.min}–${q.max})</small></span>`;
  }).join('')}${d.overCap ? '<span class="bad">⚠ over the cap: every role is full</span>' : ''} <small>incl. Robin/Chrom as Lead; Main story quotas</small></div>`;
}

function rolePicker(r: Derived) {
  const o = s.overrides[r.child];
  return `<select data-role="${r.child}" title="Role override: pins the deployment role; the preset inside it stays derived">
    <option value="" ${!o?.role ? 'selected' : ''}>role: derived (${ROLE_NAME[r.bestRole]})</option>
    ${ROLES.map((x) => `<option value="${x}" ${o?.role === x ? 'selected' : ''}>${ROLE_NAME[x]}${x === 'staff' && !r.qualifiesStaff ? ' ⚠' : ''}</option>`).join('')}</select>`;
}
function presetPicker(r: Derived) {
  const o = s.overrides[r.child];
  const opt = (p: PresetId) => `<option value="${p}" ${o?.preset === p ? 'selected' : ''}>${presetName(p)}</option>`;
  return `<select data-preset="${r.child}" title="Preset override: pins any preset, niche included; its role comes with it">
    <option value="" ${!o?.preset ? 'selected' : ''}>preset: derived (${presetName(r.rolePreset[o?.role ?? r.role])})</option>
    <optgroup label="Lead">${CANDIDATES.lead.map(opt).join('')}</optgroup><optgroup label="Battery">${opt('battery')}</optgroup>
    <optgroup label="Staff/Rally">${opt('rallybot')}${opt('staffbot')}</optgroup>
    <optgroup label="Niche (override only)">${NICHE.filter((p) => p !== 'staffbot').map(opt).join('')}</optgroup></select>`;
}
const reset = (r: Derived) => `<button class="mini" data-reset="${r.child}" ${s.overrides[r.child] ? '' : 'disabled'} title="Back to derived">↺</button>`;

// ---------- A: sidebar row ----------
function variantA() {
  const d = derive(s);
  return `<div class="a"><aside class="side"><h3>Plan</h3>${compStrip(d)}${leaveOutSwitch()}
    ${d.rows
      .map((r) =>
        r.inCast
          ? `<div class="row"><div class="nm">${esc(r.name)} <b>${ROLE_NAME[r.role]}</b> · ${esc(presetName(r.planPreset))} ${sourceChip(r)} ${warn(r)}</div>
             <div class="ctl"><span class="seg"><button>0</button><button class="on">1</button><button>2</button><button>3</button></span>${rolePicker(r)}${presetPicker(r)}${reset(r)}</div></div>`
          : `<div class="row out"><div class="nm">${esc(r.name)} — <i>${esc(r.why ?? '')}</i></div></div>`,
      )
      .join('')}</aside>
    <main><h2>Pairing table (Nah)</h2><p>Preset: <select><option>Nah's plan preset — ${esc(presetName(d.rows.find((x) => x.child === 'nah')!.planPreset))}</option><option>Explore: Physical lead</option><option>Explore: Magical lead</option><option>…</option></select>
    <small>The table's picker defaults to the child's plan preset; any other preset is an explore lens and changes nothing.</small></p>
    <p class="note">Everything else on the table stays as it is today. The sidebar is where roles are set.</p></main></div>`;
}

// ---------- B: role matrix ----------
function variantB() {
  const d = derive(s);
  const cell = (r: Derived, role: ChildDeploymentRole) => {
    const on = r.role === role;
    const best = r.bestRole === role;
    const pinned = s.overrides[r.child]?.role === role;
    const disq = role === 'staff' && !r.qualifiesStaff;
    const st = r.roleStanding[role];
    return `<td class="cell ${on ? 'on' : ''} ${best ? 'best' : ''} ${pinned ? 'pinned' : ''} ${disq ? 'disq' : ''}" data-cell="${r.child}|${role}" title="${disq ? "⚠ doesn't reach a staff class or rally skill on its planned pairing" : 'Click to pin this role'}">
      <div class="bar"><i style="width:${pct(st)}%"></i></div><div>${role === 'lead' ? esc(presetName(r.rolePreset.lead)) : role === 'battery' ? 'Battery' : 'Rallybot'} <small>${pct(st)}</small></div>
      ${best ? '<small class="tag">best</small>' : ''}${on && r.source === 'army fit' ? `<small class="tag af" title="${esc(r.fitReason ?? '')}">← army fit</small>` : ''}${pinned ? '<small class="tag ov">pinned</small>' : ''}</td>`;
  };
  // Robin gain: the child's best score under its Lead role preset with Robin in the gene pool, minus without.
  // With Robin set, only that Robin; unset, any Robin (so it answers "who gains most from Robin at all").
  const gain = (r: Derived) => {
    if (r.child.startsWith('morgan')) return '<small>—</small>';
    const p = r.rolePreset.lead;
    const without = topPairings(r.child, p, { ...s, leaveOut: true }, 1)[0];
    const withR = topPairings(r.child, p, { ...s, leaveOut: false, robin: s.robin }, 1)[0];
    const anyR = s.robin ? withR : topPairings(r.child, p, { ...s, leaveOut: false, robin: null }, 1, true)[0];
    const w = anyR ?? withR;
    const d = (w?.score ?? 0) - (without?.score ?? 0);
    return `<b class="${d > 0 ? 'up' : ''}">${d > 0 ? '+' : ''}${d}</b> <small>${esc(without?.label ?? '')} ${without?.score ?? '—'} → ${esc(w?.label ?? '')} ${w?.score ?? '—'}</small>`;
  };
  return `<div class="b"><div class="top">${compStrip(d)}${leaveOutSwitch()}</div>
    <table class="m"><thead><tr><th>Child</th><th>Lead (standing, best lead preset)</th><th>Battery</th><th>Staff/Rally</th><th>Plan preset</th><th>Preset override</th><th title="Best score under the Lead role preset with Robin in the gene pool, minus without">Robin gain</th></tr></thead><tbody>
    ${d.rows
      .map((r) =>
        r.inCast
          ? `<tr><td>${esc(r.name)}<div><small>best pairing: ${esc(r.bestLeadPairing ?? '')}</small></div></td>${ROLES.map((x) => cell(r, x)).join('')}
             <td><b>${esc(presetName(r.planPreset))}</b><div>${sourceChip(r)} ${warn(r)}</div></td><td>${presetPicker(r)}${reset(r)}</td><td>${gain(r)}</td></tr>`
          : `<tr class="out"><td>${esc(r.name)}</td><td colspan="6"><i>${esc(r.why ?? '')}</i> ${r.why?.startsWith('needs') ? '<button data-act="set-robin">Set Robin</button>' : ''}</td></tr>`,
      )
      .join('')}</tbody></table>
    <p class="note">Bars are standing (0–100) against the cast. Battery's spread is zero today, so every child derives Lead and army fit fills Battery from the lowest Lead standings.</p></div>`;
}

// ---------- C: table-first ----------
function variantC() {
  const d = derive(s);
  const r = d.rows.find((x) => x.child === tableChild)!;
  const lensPreset: PresetId = lens === 'plan' ? r.planPreset : lens;
  const exploring = lens !== 'plan' && lens !== r.planPreset;
  const rows = r.inCast && lensPreset !== 'rallybot' ? topPairings(tableChild, lensPreset, s, 8) : [];
  return `<div class="c"><nav class="rail"><div class="robin">${s.robin ? `Robin ${s.robin.gender} +${s.robin.asset.toUpperCase()} −${s.robin.flaw.toUpperCase()}` : 'Robin: <b>not set</b> <button data-act="set-robin">Set</button>'}</div>${leaveOutSwitch()}
    ${d.rows.map((x) => `<button class="ri ${x.child === tableChild ? 'on' : ''} ${x.inCast ? '' : 'out'}" data-child="${x.child}">${esc(x.name)} <small>${x.inCast ? ROLE_NAME[x.role] : '—'}</small>${x.source.includes('override') ? ' •' : ''}</button>`).join('')}</nav>
    <main><h2>${esc(r.name)}</h2>
    ${
      r.inCast
        ? `<div class="hdr">Plays <b>${ROLE_NAME[r.role]}</b> as <b>${esc(presetName(r.planPreset))}</b> ${sourceChip(r)} ${warn(r)}
      ${r.fitReason ? `<small>(${esc(r.fitReason)})</small>` : ''}<div class="ctl">Change: ${rolePicker(r)} ${presetPicker(r)} ${reset(r)}</div></div>
      <div class="lens">Table preset: <select data-lens><option value="plan" ${lens === 'plan' ? 'selected' : ''}>${esc(r.name)}'s plan preset (${esc(presetName(r.planPreset))})</option>
        ${[...CANDIDATES.lead, 'battery' as PresetId, ...NICHE].map((p) => `<option value="${p}" ${lens === p ? 'selected' : ''}>explore: ${presetName(p)}</option>`).join('')}</select></div>
      ${exploring ? `<div class="banner">Exploring <b>${esc(presetName(lensPreset))}</b>: this isn't ${esc(r.name)}'s plan preset. <button data-use="${lensPreset}">Use it as a preset override</button> <button data-lensback>Back to plan preset</button></div>` : ''}
      <table class="t"><thead><tr><th>Parent</th><th>${esc(presetName(lensPreset))}</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.score ?? '—'}</td></tr>`).join('')}</tbody></table>`
        : `<div class="banner">${esc(r.why ?? '')}</div>`
    }
    <div class="note">${compStrip(d)}</div></main></div>`;
}

function render() {
  app.innerHTML = `${variant === 'C' ? '' : robinBanner()}${variant === 'A' ? variantA() : variant === 'B' ? variantB() : variantC()}`;
  const keys = Object.keys(VARIANTS) as V[];
  const i = keys.indexOf(variant);
  bar.innerHTML = `<button data-v="${keys[(i + 2) % 3]}">←</button><span>${variant} — ${VARIANTS[variant]}</span><button data-v="${keys[(i + 1) % 3]}">→</button>`;
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  history.replaceState(null, '', url);
}

const setOverride = (c: ChildId, o: { role?: ChildDeploymentRole; preset?: PresetId } | undefined) => {
  if (!o || (!o.role && !o.preset)) delete s.overrides[c];
  else s.overrides[c] = o;
};

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-v],[data-act],[data-reset],[data-cell],[data-child],[data-use],[data-lensback]') as HTMLElement | null;
  if (!t || t.tagName === 'INPUT') return;
  const dd = t.dataset;
  if (dd.v) variant = dd.v as V;
  if (dd.act === 'set-robin') s.robin = { gender: 'M', asset: 'mag', flaw: 'str' };
  if (dd.act === 'unset-robin') s.robin = null;
  if (dd.reset) delete s.overrides[dd.reset as ChildId];
  if (dd.cell) {
    const [c, role] = dd.cell.split('|') as [ChildId, ChildDeploymentRole];
    setOverride(c, s.overrides[c]?.role === role ? undefined : { role });
  }
  if (dd.child) (tableChild = dd.child as ChildId), (lens = 'plan');
  if (dd.use) setOverride(tableChild, { preset: dd.use as PresetId }), (lens = 'plan');
  if (t.hasAttribute('data-lensback')) lens = 'plan';
  render();
});
document.addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement | HTMLInputElement;
  const dd = t.dataset;
  if (dd.act === 'leave-out') s.leaveOut = (t as HTMLInputElement).checked;
  if (dd.role) setOverride(dd.role as ChildId, t.value ? { role: t.value as ChildDeploymentRole } : undefined);
  if (dd.preset) setOverride(dd.preset as ChildId, t.value ? { preset: t.value as PresetId } : s.overrides[dd.preset as ChildId]?.role ? { role: s.overrides[dd.preset as ChildId]!.role! } : undefined);
  if ('lens' in dd) lens = t.value as PresetId | 'plan';
  render();
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  const keys = Object.keys(VARIANTS) as V[];
  const i = keys.indexOf(variant);
  if (e.key === 'ArrowLeft') variant = keys[(i + 2) % 3]!;
  else if (e.key === 'ArrowRight') variant = keys[(i + 1) % 3]!;
  else return;
  render();
});
void deploysAs;
render();
