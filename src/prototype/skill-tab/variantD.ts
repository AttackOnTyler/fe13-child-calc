// PROTOTYPE — Variant D "A + B + C": A's inline drawer under the row. Left: builds grouped by tier,
// each one A's compact chip line that expands into B's build card (the best build starts open).
// Right: C's source-first skills layout (rally dots, what each parent gives, class skills by rank).
// Clicking ANY skill pins a Skill card at the top of the scoring sidebar: description, ranks per
// context, how this pairing gets it, synergies / conflicts (✓ = partner reachable), builds using it.
import type { Row } from '../pairing-table/data';
import { RANK_LETTER, skillDetail, skillLink, srcText, type Analysis } from './skills';
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

function skillCard(a: Analysis, s: SkState) {
  const d = skillDetail(s.skill!, a);
  const rel = (xs: typeof d.syn, cls: string) =>
    xs.map((x) => `<li class="${cls}"><span class="${x.ok ? 'pos' : 'muted'}" title="${x.ok ? 'reachable for this pairing' : 'not reachable for this pairing'}">${x.ok ? '✓' : '✕'}</span> ${skillLink(x.other)} <div class="muted small">${x.note}</div></li>`).join('');
  return `<section class="vd-skillcard">
    <header><b>${d.skill}</b> <button class="ghost small" data-ctl="skill" data-v="">✕</button></header>
    <div class="vd-ranks">${d.ranks.map((r) => `<span class="${r.ctx === s.ctx ? 'cur' : ''}" title="${r.ctx}"><b class="rk rk${r.r}">${RANK_LETTER[r.r]}</b> ${r.ctx === 'Main story' ? 'Main' : r.ctx === 'Full route' ? 'Full' : r.ctx === 'Apotheosis' ? 'Apoth.' : 'All'}</span>`).join('')}</div>
    <p>${d.desc}${d.rate ? ` <span class="muted">Rate: ${d.rate}.</span>` : ''}</p>
    <h5>How ${a.child} gets it</h5>
    ${d.via.length ? `<ul>${d.via.map((v) => `<li>${srcText(v)}</li>`).join('')}</ul>` : `<p class="neg small">Not reachable for ${a.child} × ${a.variable}.</p>`}
    ${d.inheritable ? '' : '<p class="muted small">Never inherited (DLC / Special Dance).</p>'}
    ${d.syn.length ? `<h5>Synergies</h5><ul class="rel">${rel(d.syn, 'syn')}</ul>` : ''}
    ${d.anti.length ? `<h5>Conflicts</h5><ul class="rel">${rel(d.anti, 'anti')}</ul>` : ''}
    ${d.builds.length ? `<h5>In this pairing's builds</h5><ul>${d.builds.map((b) => `<li><b class="tier t${b.tier}">${b.tier}/5</b> ${b.name} <span class="muted small">slot ${b.slot}${b.got ? '' : ' · unfilled/fallback'}</span></li>`).join('')}</ul>` : ''}
  </section>`;
}

export function hooks(s: SkState, a: Analysis | null): Hooks {
  return {
    panelTop: a && s.skill ? skillCard(a, s) : null,
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
