// PROTOTYPE — Variant D "A + B + C": A's inline drawer under the row. Left: builds grouped by tier,
// each one A's compact chip line that expands into B's build card (the best build starts open).
// Right: C's source-first skills layout (rally dots, what each parent gives, class skills by rank).
import type { Row } from '../pairing-table/data';
import type { Analysis } from './skills';
import type { Hooks } from './host';
import type { SkState } from './main';
import { chip } from './variantA';
import { card } from './variantB';
import { body } from './variantC';

export const name = 'A drawer + B cards + C skills';

function builds(a: Analysis, s: SkState) {
  if (!a.builds.length) return '<div class="muted">No template reaches 3/5 in this context.</div>';
  const isOpen = (id: string, i: number) => (s.openBuild === null ? i === 0 : s.openBuild === id);
  let i = 0;
  return [5, 4, 3]
    .map((t) => {
      const bs = a.builds.filter((b) => b.tier === t);
      if (!bs.length) return '';
      return `<h4 class="tierhead">${t}/5 coverage · ${bs.length}</h4>${bs
        .map((b) => {
          const open = isOpen(b.t.id, i++);
          return open
            ? `<div class="vd-open"><div class="vd-close muted small" data-ctl="openBuild" data-v="-">▾ collapse</div>${card(b, s)}</div>`
            : `<div class="va-bline" data-ctl="openBuild" data-v="${b.t.id}"><b class="tier t${b.tier}">${b.tier}/5</b><span class="bname">${b.t.name}</span>
                <span class="chips">${b.slots.map((_, j) => chip(b, j, s)).join('')}</span><span class="muted small">${b.cost ? `⟳${b.cost}` : ''}</span></div>`;
        })
        .join('')}`;
    })
    .join('');
}

export function hooks(s: SkState, a: Analysis | null): Hooks {
  return {
    selectedKey: s.sel,
    rowCell: (r: Row) => `<button class="ghost small" data-ctl="sel" data-v="${r.key}">${s.sel === r.key ? 'Skills ▾' : 'Skills ▸'}</button>`,
    afterRow: (r: Row) =>
      a && r.key === s.sel
        ? `<div class="va-drawer-sk vd-drawer">
          <div class="va-dhead"><b>${a.child} × ${a.variable}</b><span class="muted">starts ${a.start} · ${a.classes.length} classes · context <b>${s.ctx}</b>${a.dlcOn ? ' · DLC on' : ''}</span>
            <span class="muted small">⟳ reclass · ↑ inherited · ◇ DLC book · colour = rank</span><button class="ghost" data-ctl="sel" data-v="${r.key}">✕</button></div>
          <div class="vd-cols"><section><h4>Builds (${a.builds.length})</h4>${builds(a, s)}</section><section class="vd-skills">${body(a, s, { builds: false, title: false })}</section></div>
        </div>`
        : null,
  };
}
