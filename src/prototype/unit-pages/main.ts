/// <reference types="vite/client" />
// PROTOTYPE — throwaway (#81). "Three layouts of a unit build page, switchable via ?variant=A|B|C, each showing
// a first-gen unit (Lon'qu), Robin in preview state, and a child front door (Nah) via ?unit=."
//   A — Report: one long scroll, every section stacked, a sticky contents rail.
//   B — Tabs: a dense header that answers "who is this" at a glance; each section behind a tab.
//   C — Board: the class tree is the page; opinion and partners ride in a side rail; the rest folds away.
import { CTX_NAME, SOURCE, presetName, robinPage, SUBJECTS, skillName, type Coverage, type Ctx, type FrontDoor, type Opinion, type UnitPage, coverage } from './data';
import { CLASSES } from '../../game-data/classes';
import type { Gender, Stat } from '../../game-data/stats';

const app = document.getElementById('app')!;
const bar = document.getElementById('switcher')!;
const q = new URLSearchParams(location.search);
const VARIANTS = { A: 'Report', B: 'Tabs', C: 'Board' } as const;
type V = keyof typeof VARIANTS;
let variant = (q.get('variant') ?? 'A') as V;
if (!(variant in VARIANTS)) variant = 'A';
let unit = q.get('unit') ?? 'lonqu';
let ctx: Ctx | 'all' = 'all';
let tab = 'classes';
const robin = { gender: 'M' as Gender, asset: 'mag' as Stat, flaw: 'str' as Stat };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const ctxs = (): Ctx[] => (ctx === 'all' ? ['main-story', 'apotheosis'] : [ctx]);
const sc = (n: number | undefined) => (n === undefined ? '—' : String(n));
const pill = (t: string, cls = '') => `<span class="pill ${cls}">${esc(t)}</span>`;

// ---------- shared section renderers ----------

function subjectPicker() {
  const opt = (k: string, l: string) => `<button data-unit="${k}" class="${unit === k ? 'on' : ''}">${l}</button>`;
  const c = (k: Ctx | 'all', l: string) => `<button data-ctx="${k}" class="${ctx === k ? 'on' : ''}">${l}</button>`;
  return `<div class="picker">Subject: ${opt('lonqu', "Lon'qu")}${opt('robin', 'Robin (preview)')}${opt('nah', 'Nah (front door)')}
    <span class="sep"></span>Play context: ${c('all', 'All')}${c('main-story', 'Main story')}${c('apotheosis', 'Apotheosis')}</div>`;
}

function robinPreview() {
  const stats: Stat[] = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'];
  const sel = (k: 'asset' | 'flaw') =>
    `<select data-robin="${k}">${stats.map((s) => `<option ${robin[k] === s ? 'selected' : ''} value="${s}">${s.toUpperCase()}</option>`).join('')}</select>`;
  return `<div class="preview">PREVIEW — Robin isn't set in Run facts; this doesn't save.
    <button data-rg="M" class="${robin.gender === 'M' ? 'on' : ''}">M</button><button data-rg="F" class="${robin.gender === 'F' ? 'on' : ''}">F</button>
    Asset ${sel('asset')} Flaw ${sel('flaw')} ${robin.asset === 'mag' && robin.flaw === 'str' ? pill('Ellery: +Mag −Str', 'rec') : pill('Ellery picks +Mag −Str', 'muted')}</div>`;
}

function classesTable(p: UnitPage) {
  return `<table class="t"><thead><tr><th>Class</th><th>Tier</th><th>Skills (level)</th></tr></thead><tbody>${p.classes
    .map(
      (c) => `<tr class="${CLASSES[c.id].dlc ? 'dlc' : ''}"><td>${esc(c.name)}${c.from ? `<small> ← ${esc(c.from)}</small>` : ''}</td><td>${c.tier}</td>
      <td>${c.skills.map((s) => `<span class="sk ${s.inheritable ? '' : 'noinh'}" title="${s.inheritable ? 'can be inherited' : 'never inherited'}">${esc(s.name)} <small>${s.level}</small></span>`).join(' ')}</td></tr>`,
    )
    .join('')}</tbody></table><p class="note">Starting skills (research/unit-page-data) would add skills the class set can't teach — none for Lon'qu.</p>`;
}

function buildsBlock(p: UnitPage, compact = false) {
  return ctxs()
    .map((c) => {
      const list: Coverage[] = coverage(p.skills, c);
      return `<h4>${CTX_NAME[c]}</h4>${list.length ? '' : '<p class="note">No template at 3/5 or better.</p>'}${list
        .slice(0, compact ? 4 : 8)
        .map(
          (b) => `<div class="build"><b>${b.tier}/5</b> ${esc(b.name)} <small>${b.id}</small>
          ${compact ? '' : `<div class="slots">${b.slots.map((s) => `<span class="slot ${s.ok ? 'ok' : 'miss'}">${esc(s.names)}</span>`).join('')}</div>`}</div>`,
        )
        .join('')}`;
    })
    .join('');
}

function parentBlock(p: UnitPage) {
  const l = (xs: string[] | null) => (xs ? xs.join(', ') : '<i>never this gender\'s variable parent</i>');
  return `<dl class="kv"><dt>Passes to a son</dt><dd>${l(p.passes.son)}</dd><dt>Passes to a daughter</dt><dd>${l(p.passes.daughter)}</dd>
    <dt>Max-stat modifiers</dt><dd>${esc(p.modifiers)}</dd><dt>Skills a child can inherit</dt><dd>${p.inheritable.map((s) => `<span class="sk">${esc(s)}</span>`).join(' ')}</dd></dl>`;
}

function pairUpTable(p: UnitPage) {
  const keys = ['str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'mov'] as const;
  return `<table class="t small"><thead><tr><th>As a back in…</th>${keys.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${p.classes
    .map((c) => `<tr><td>${esc(c.name)}</td>${keys.map((k) => `<td>${(CLASSES[c.id].pairUp as Record<string, number>)[k] ?? ''}</td>`).join('')}</tr>`)
    .join('')}</tbody></table><p class="note">Class part only; the stat tier and support rank add to it.</p>`;
}

function opinionBlock(ops: Opinion[], compact = false) {
  const shown = ops.filter((o) => ctxs().includes(o.ctx));
  return `<div class="voice"><div class="voice-h">${SOURCE.id} · ${SOURCE.name} says… <small title="${esc(SOURCE.provenance)}">provenance ⓘ</small></div>${shown
    .map(
      (o) => `<div class="op"><div><b>${CTX_NAME[o.ctx]}</b> — ${esc(o.role)} ${pill(`tier ${o.tier}`)}</div>
      ${compact ? '' : `<div>Classes: ${esc(o.classes.join(', '))}</div>`}
      <div>Loadout: ${o.loadout.map((g) => `<span class="slot ok">${esc(g.map(skillName).join(' / '))}</span>`).join('')}</div>
      ${compact ? '' : `<div>${o.partners.map((x) => pill(`${x.kind === 'warned' ? '⚠ ' : '♥ '}${x.name}`, x.kind === 'warned' ? 'warn' : 'rec')).join(' ')}</div><div class="note">${esc(o.note)}</div>`}
      <div class="cite">▶ ${esc(o.cite)}</div></div>`,
    )
    .join('')}</div>`;
}

function partnersBlock(p: UnitPage, compact = false) {
  return `<table class="t"><thead><tr><th>Partner</th><th>Children (${esc(presetName)} score)</th>${compact ? '' : '<th>Ellery</th><th>Plan</th>'}<th></th></tr></thead><tbody>${p.partners
    .slice(0, compact ? 6 : 99)
    .map(
      (r) => `<tr class="${r.blocked ? 'blocked' : ''}"><td>${esc(r.name)}${compact && r.verdict ? ` ${r.verdict.kind === 'warned' ? '⚠' : '♥'}` : ''}</td>
      <td>${r.children.map((c) => `<a href="#" title="${esc(c.note ?? '')}">${esc(c.child)} <b>${sc(c.score)}</b></a>`).join(', ') || '<i>none</i>'}</td>
      ${compact ? '' : `<td>${r.verdict ? pill(`${r.verdict.kind === 'warned' ? '⚠' : '♥'} ${r.verdict.why}`, r.verdict.kind === 'warned' ? 'warn' : 'rec') : ''}</td>
      <td>${r.planned ? pill('in plan', 'plan') : ''}${r.blocked ? pill(r.blocked, 'muted') : ''}</td>`}
      <td><a href="#" class="go">Plan →</a></td></tr>`,
    )
    .join('')}</tbody></table><p class="note">Sorted by Σ children's score (priority 1 each). Read-only; "Plan →" opens the Plan with the marriage to pin. ${compact ? `Showing 6 of ${p.partners.length}.` : ''}</p>`;
}

function frontDoorBlocks(f: FrontDoor) {
  return {
    facts: `<dl class="kv"><dt>Fixed parent</dt><dd>${esc(f.fixedParent)}</dd><dt>Start class</dt><dd>${esc(f.startClass)}</dd>
      <dt>Default class set</dt><dd>${esc(f.classSet.join(', '))}</dd><dt>Personal growths</dt><dd>${esc(f.growths)}</dd></dl>`,
    top: `<ol class="top">${f.top
      .map((t) => `<li><a href="#">${esc(t.label)}</a> <b>${sc(t.score)}</b> ${t.mark ? pill(`${t.mark.kind === 'warned' ? '⚠' : '♥'} ${t.mark.why}`, t.mark.kind === 'warned' ? 'warn' : 'rec') : ''}</li>`)
      .join('')}</ol>${f.marked.length ? `<div class="note">Also marked by Ellery, outside the top 5:</div><ul class="top">${f.marked.map((t) => `<li><a href="#">${esc(t.label)}</a> <b>${sc(t.score)}</b> ${pill(`${t.mark.kind === 'warned' ? '⚠' : '♥'} ${t.mark.why}`, t.mark.kind === 'warned' ? 'warn' : 'rec')}</li>`).join('')}</ul>` : ''}
      <a href="#" class="go">Open the full pairing table (${f.total} parents) →</a><p class="note">Top 5 by ${esc(presetName)}, the pairing table's ranking.</p>`,
    robin: `<p class="robin-line">💍 ${esc(f.robinLine)} <a href="?variant=${variant}&unit=robin">Robin's page →</a></p>`,
  };
}

// ---------- variant A: report ----------

function variantA(p: UnitPage | FrontDoor) {
  const secs: [string, string][] =
    p.kind === 'child'
      ? (() => {
          const b = frontDoorBlocks(p);
          return [['Fixed across pairings', b.facts], ['Best pairings', b.top], ['Ellery says', opinionBlock(p.opinion)], ['Marrying Robin', b.robin]];
        })()
      : [
          ['Classes & skills', classesTable(p)],
          ['Build coverage', buildsBlock(p)],
          ['As a parent', parentBlock(p)],
          ['Partners', partnersBlock(p)],
          ['Ellery says', opinionBlock(p.opinion)],
          ['Pair-up as a back', pairUpTable(p)],
        ];
  return `<div class="a"><nav class="toc">${secs.map(([t], i) => `<a href="#s${i}">${t}</a>`).join('')}</nav>
    <main><h1>${esc(p.name)}</h1><div class="sub">${p.kind === 'child' ? 'Child · front door' : esc(p.blurb)}</div>
    ${secs.map(([t, h], i) => `<section id="s${i}"><h2>${t}</h2>${h}</section>`).join('')}</main></div>`;
}

// ---------- variant B: tabs ----------

function variantB(p: UnitPage | FrontDoor) {
  const tabs: [string, string, string][] =
    p.kind === 'child'
      ? (() => {
          const b = frontDoorBlocks(p);
          return [['pairings', 'Best pairings', b.top + b.robin], ['facts', 'Fixed facts', b.facts], ['opinion', 'Ellery', opinionBlock(p.opinion)]];
        })()
      : [
          ['classes', 'Classes & skills', classesTable(p)],
          ['builds', 'Builds', buildsBlock(p)],
          ['parent', 'As a parent', parentBlock(p)],
          ['partners', `Partners (${p.partners.length})`, partnersBlock(p)],
          ['pairup', 'Pair-up', pairUpTable(p)],
        ];
  if (!tabs.some(([k]) => k === tab)) tab = tabs[0]![0];
  const o = p.opinion.filter((x) => ctxs().includes(x.ctx));
  const head =
    p.kind === 'child'
      ? `${pill(`Fixed: ${p.fixedParent}`)} ${pill(`Starts ${p.startClass}`)} ${pill(`Best: ${p.top[0]?.label} ${sc(p.top[0]?.score)}`, 'plan')}`
      : `${pill(`${p.classes.length} classes`)} ${pill(`${p.skills.size} skills`)} ${pill(`best build ${coverage(p.skills, o[0]?.ctx ?? 'main-story')[0]?.tier ?? 0}/5`, 'plan')}`;
  return `<div class="b"><header><div><h1>${esc(p.name)}</h1><div class="sub">${p.kind === 'child' ? 'Child · front door' : esc(p.blurb)}</div><div>${head}</div></div>
    <aside>${opinionBlock(p.opinion, true)}</aside></header>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="tabbody">${tabs.find(([k]) => k === tab)![2]}</div></div>`;
}

// ---------- variant C: board ----------

function variantC(p: UnitPage | FrontDoor) {
  if (p.kind === 'child') {
    const b = frontDoorBlocks(p);
    return `<div class="c"><main><h1>${esc(p.name)} <small>front door</small></h1>
      <div class="tiles">${p.top.map((t, i) => `<a href="#" class="tile ${i === 0 ? 'first' : ''}"><div class="big">${sc(t.score)}</div><div>${esc(t.label)}</div>${t.mark ? `<div>${t.mark.kind === 'warned' ? '⚠' : '♥'} Ellery</div>` : ''}</a>`).join('')}</div>
      ${b.robin}<details open><summary>Fixed across pairings</summary>${b.facts}</details>
      ${p.marked.length ? `<details><summary>Marked by Ellery outside the top 5</summary>${b.top}</details>` : ''}</main>
      <aside>${opinionBlock(p.opinion)}</aside></div>`;
  }
  const base = p.classes.filter((c) => !c.from);
  const kids = (name: string) => p.classes.filter((c) => c.from === name);
  const card = (c: (typeof p.classes)[number]) =>
    `<div class="cc ${CLASSES[c.id].dlc ? 'dlc' : ''}"><b>${esc(c.name)}</b>${c.skills.map((s) => `<div class="sk ${s.inheritable ? '' : 'noinh'}">${esc(s.name)} <small>${s.level}</small></div>`).join('')}</div>`;
  const tree = base.map((b) => `<div class="line">${card(b)}<span class="arrow">→</span><div class="promos">${kids(b.name).map(card).join('')}</div></div>`).join('');
  const dlc = p.classes.filter((c) => c.from === 'DLC seal');
  return `<div class="c"><main><h1>${esc(p.name)}</h1><div class="sub">${esc(p.blurb)}</div>
    <div class="tree">${tree}${dlc.length ? `<div class="line"><span class="arrow">DLC seal →</span><div class="promos">${dlc.map(card).join('')}</div></div>` : ''}</div>
    <details open><summary>Build coverage</summary>${buildsBlock(p, true)}</details>
    <details><summary>As a parent</summary>${parentBlock(p)}</details>
    <details><summary>Pair-up as a back</summary>${pairUpTable(p)}</details></main>
    <aside>${opinionBlock(p.opinion, true)}<h3>Partners</h3>${partnersBlock(p, true)}</aside></div>`;
}

// ---------- wiring ----------

function render() {
  const page = unit === 'robin' ? robinPage(robin.gender, robin.asset, robin.flaw) : SUBJECTS[unit as keyof typeof SUBJECTS]();
  const body = variant === 'A' ? variantA(page) : variant === 'B' ? variantB(page) : variantC(page);
  app.innerHTML = `${subjectPicker()}${unit === 'robin' ? robinPreview() : ''}${body}`;
  const keys = Object.keys(VARIANTS) as V[];
  const i = keys.indexOf(variant);
  bar.innerHTML = `<button data-v="${keys[(i + keys.length - 1) % keys.length]}">←</button><span>${variant} — ${VARIANTS[variant]}</span><button data-v="${keys[(i + 1) % keys.length]}">→</button>`;
  const url = new URL(location.href);
  url.searchParams.set('variant', variant);
  url.searchParams.set('unit', unit);
  history.replaceState(null, '', url);
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button') as HTMLElement | null;
  if (!t) return;
  if (t.dataset.v) variant = t.dataset.v as V;
  if (t.dataset.unit) unit = t.dataset.unit;
  if (t.dataset.ctx) ctx = t.dataset.ctx as Ctx | 'all';
  if (t.dataset.tab) tab = t.dataset.tab;
  if (t.dataset.rg) robin.gender = t.dataset.rg as Gender;
  render();
});
document.addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.dataset.robin) {
    robin[t.dataset.robin as 'asset' | 'flaw'] = t.value as Stat;
    if (robin.asset === robin.flaw) robin.flaw = robin.asset === 'str' ? 'mag' : 'str';
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
  const keys = Object.keys(VARIANTS) as V[];
  const i = keys.indexOf(variant);
  if (e.key === 'ArrowLeft') variant = keys[(i + keys.length - 1) % keys.length]!;
  else if (e.key === 'ArrowRight') variant = keys[(i + 1) % keys.length]!;
  else return;
  render();
});
render();
