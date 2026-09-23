// PROTOTYPE — Variant C "Side sheet": the table stays put; clicking a row selects it and the right
// panel flips to a Skills tab (Scoring is the other tab). Narrow, source-first: rally dots, then
// "what each parent can give", then class skills bucketed by rank, then builds as an accordion.
import type { Row } from '../pairing-table/data';
import { RANK_LETTER, rank, srcShort, srcText, type Analysis } from './skills';
import type { Hooks } from './host';
import type { SkState } from './main';

export const name = 'Side sheet (Scoring | Skills tabs)';

function body(a: Analysis, s: SkState) {
  const parent = (label: string, p: Analysis['fixedPool']) => {
    const ks = [...p.skills].sort((x, y) => rank(y, s.ctx) - rank(x, s.ctx));
    const only = new Set(a.pool.filter((e) => e.onlyVia === label).map((e) => e.skill));
    return `<div class="vc-par"><div><b>${label}</b> <span class="muted small">${p.forced ? 'fixed' : 'passes 1'}</span></div>
      <div class="chips">${ks.filter((k) => rank(k, s.ctx) >= 3 || only.has(k)).map((k) => `<span class="sk rk${rank(k, s.ctx)} ${only.has(k) ? 'only' : ''}" title="${only.has(k) ? 'only via ' + label : 'also learnable by class'}">${k}</span>`).join('') || '<span class="muted">nothing useful</span>'}</div>
      <div class="muted small">${p.note}${only.size ? ` · outlined = only via ${label}` : ''}</div></div>`;
  };
  const classSkills = a.pool.filter((e) => e.via[0].kind !== 'parent');
  const buckets = [5, 4, 3, 2, 1]
    .map((r) => [r, classSkills.filter((e) => e.rank === r)] as const)
    .filter(([, es]) => es.length)
    .map(([r, es]) => `<div class="vc-bucket"><b class="rk rk${r}">${RANK_LETTER[r]}</b><div>${es.map((e) => `<div>${e.skill} <span class="muted small">${srcShort(e.via[0])}${e.via[0].kind === 'class' && !e.via[0].start ? ' ⟳' : ''}</span></div>`).join('')}</div></div>`)
    .join('');
  const builds = a.builds
    .map((b) => {
      const open = s.openBuild === b.t.id;
      return `<div class="vc-acc ${open ? 'open' : ''}"><div class="vc-acchead" data-ctl="openBuild" data-v="${b.t.id}"><b class="tier t${b.tier}">${b.tier}/5</b> ${b.t.name} <span class="muted small">${b.cost ? '⟳' + b.cost : ''}</span> <span class="muted">${open ? '▾' : '▸'}</span></div>
        ${open ? `<div class="vc-accbody">${b.slots.map((sl) => (sl.skill ? `<div>✓ <b>${sl.skill}</b><div class="muted small">${srcText(sl.src)}</div></div>` : `<div class="neg">✕ ${sl.options.join(' / ')}<div class="small">${sl.reason}</div></div>`)).join('')}
          ${b.notes.map((n) => `<div class="muted small">★ ${n}</div>`).join('')}<button data-ctl="usePreset" data-v="${b.t.role}">Use preset: ${b.t.role}</button></div>` : ''}</div>`;
    })
    .join('');
  return `<div class="vc-sk">
    <div class="vc-title"><b>${a.child} × ${a.variable}</b><div class="muted small">starts ${a.start} · context ${s.ctx}</div></div>
    <h4>Rallies ${a.rallies.filter((r) => r.src).length}/10</h4>
    <div class="vc-dots">${a.rallies.map((r) => `<span class="${r.src ? 'ok' : 'no'}" title="${r.skill}: ${r.src ? srcText(r.src) : r.reason}">${r.skill.replace('Rally ', '').slice(0, 3)}</span>`).join('')}</div>
    <h4>Builds</h4>${builds || '<div class="muted">none ≥ 3/5</div>'}
    <h4>From parents (one each)</h4>${parent(a.fixed, a.fixedPool)}${parent(a.variable, a.variablePool)}
    <h4>Class skills by rank</h4>${buckets}
  </div>`;
}

export function hooks(s: SkState, a: Analysis | null): Hooks {
  const tabs = `<span class="seg"><button data-ctl="panelTab" data-v="scoring" class="${s.panelTab === 'scoring' ? 'on' : ''}">Scoring</button><button data-ctl="panelTab" data-v="skills" class="${s.panelTab === 'skills' ? 'on' : ''}" ${a ? '' : 'disabled title="Select a row first"'}>Skills</button></span>`;
  return {
    selectedKey: s.sel,
    rowCell: (r: Row) => `<button class="ghost small radio" data-ctl="sel" data-v="${r.key}">${s.sel === r.key ? '●' : '○'}</button>`,
    panelHead: tabs,
    panel: a && s.panelTab === 'skills' ? body(a, s) : null,
  };
}
