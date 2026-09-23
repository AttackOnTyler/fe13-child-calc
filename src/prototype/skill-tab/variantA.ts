// PROTOTYPE — Variant A "Inline drawer": a Skills button on every row opens a drawer UNDER that row,
// like the Robin heatmap. Builds on the left as compact one-liners (5 slot chips) that expand into
// source lines; reachable skills on the right as a class × chip grid, with a rally strip on top.
import type { Row } from '../pairing-table/data';
import { RANK_LETTER, rank, srcShort, srcText, type Analysis, type BuildMatch } from './skills';
import type { Hooks } from './host';
import type { SkState } from './main';

export const name = 'Inline drawer under the row';

const chip = (b: BuildMatch, i: number, s: SkState) => {
  const sl = b.slots[i];
  if (!sl.skill) return `<span class="slot empty" title="${sl.options.join(' / ')} — ${sl.reason}">${sl.options[0]}</span>`;
  const k = sl.src!.kind === 'parent' ? '↑' : sl.src!.kind === 'book' ? '◇' : sl.src!.kind === 'class' && sl.src!.start ? '' : '⟳';
  return `<span class="slot rk${rank(sl.skill, s.ctx)}" title="${srcText(sl.src)}">${sl.skill}${k ? `<sup>${k}</sup>` : ''}${sl.pref > 0 ? '<sup class="muted">2nd</sup>' : ''}</span>`;
};

function builds(a: Analysis, s: SkState) {
  if (!a.builds.length) return '<div class="muted">No template reaches 3/5 in this context.</div>';
  return a.builds
    .map((b) => {
      const open = s.openBuild === b.t.id;
      return `<div class="va-build ${open ? 'open' : ''}">
        <div class="va-bline" data-ctl="openBuild" data-v="${b.t.id}">
          <b class="tier t${b.tier}">${b.tier}/5</b><span class="bname">${b.t.name}</span>
          <span class="chips">${b.slots.map((_, i) => chip(b, i, s)).join('')}</span>
          <span class="muted small">${b.cost ? `+${b.cost} cls` : 'no reclass'}</span>
        </div>
        ${open ? `<div class="va-bdetail">
          ${b.slots.map((sl) => `<div class="${sl.skill ? '' : 'neg'}">${sl.skill ? `<b>${sl.skill}</b> — ${srcText(sl.src)}` : `✕ <b>${sl.options.join(' / ')}</b> — ${sl.reason}`}</div>`).join('')}
          ${b.notes.map((n) => `<div class="muted small">★ ${n}</div>`).join('')}
          <div class="muted small">${b.t.role} · ${b.t.ctx.join('/')} · ${b.t.conf} (${b.t.source}) ${b.classes.length ? '· reclass: ' + b.classes.join(', ') : ''}</div>
          <button data-ctl="usePreset" data-v="${b.t.role}">Use this build's preset (${b.t.role})</button>
        </div>` : ''}
      </div>`;
    })
    .join('');
}

function grid(a: Analysis, s: SkState) {
  const rows = a.byClass
    .filter((c) => c.skills.length)
    .map((c) => `<tr><th class="${c.start ? 'startcls' : ''}">${c.cls}${c.tier === 'dlc' ? ' <span class="muted small">DLC</span>' : ''}</th><td>${c.start ? '<span class="muted small">start</span>' : '<span class="muted small">⟳1</span>'}</td>
      <td>${c.skills.map((k) => `<span class="sk rk${rank(k, s.ctx)}">${k} <i>${RANK_LETTER[rank(k, s.ctx)]}</i></span>`).join('')}</td></tr>`)
    .join('');
  const par = (label: string, p: Analysis['fixedPool']) => {
    const only = new Set(a.pool.filter((e) => e.onlyVia === label).map((e) => e.skill));
    const ks = [...p.skills].sort((x, y) => rank(y, s.ctx) - rank(x, s.ctx));
    return `<tr><th>↑ ${label}</th><td><span class="muted small">${p.forced ? 'fixed' : 'pick 1'}</span></td><td>${
      ks.length ? ks.map((k) => `<span class="sk rk${rank(k, s.ctx)} ${only.has(k) ? 'only' : ''}" title="${only.has(k) ? 'only via ' + label : 'also learnable by class'}">${k} <i>${RANK_LETTER[rank(k, s.ctx)]}</i></span>`).join('') : '<span class="muted">nothing</span>'
    }<div class="muted small">${p.note}</div></td></tr>`;
  };
  return `<table class="va-grid">${par(a.fixed, a.fixedPool)}${par(a.variable, a.variablePool)}${rows}</table>`;
}

const rallies = (a: Analysis) =>
  `<div class="rallies">${a.rallies.map((r) => `<span class="rally ${r.src ? 'ok' : 'no'}" title="${r.src ? srcText(r.src) : r.reason}">${r.skill.replace('Rally ', '')}<small>${r.src ? srcShort(r.src) : '—'}</small></span>`).join('')}</div>`;

export function hooks(s: SkState, a: Analysis | null): Hooks {
  return {
    selectedKey: s.sel,
    rowCell: (r: Row) => `<button class="ghost small" data-ctl="sel" data-v="${r.key}">${s.sel === r.key ? 'Skills ▾' : 'Skills ▸'}</button>`,
    afterRow: (r: Row) =>
      a && r.key === s.sel
        ? `<div class="va-drawer-sk">
          <div class="va-dhead"><b>${a.child} × ${a.variable}</b><span class="muted">starts ${a.start} · ${a.classes.length} classes · context <b>${s.ctx}</b>${a.dlcOn ? ' · DLC on' : ''}</span>
            <span class="muted small">⟳ = reclass · ↑ = inherited · ◇ = DLC book · colour = rank</span><button class="ghost" data-ctl="sel" data-v="${r.key}">✕</button></div>
          ${rallies(a)}
          <div class="va-cols"><section><h4>Builds (${a.builds.length})</h4>${builds(a, s)}</section><section><h4>Reachable skills</h4>${grid(a, s)}</section></div>
        </div>`
        : null,
  };
}
