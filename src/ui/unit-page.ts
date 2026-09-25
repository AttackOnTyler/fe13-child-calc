/**
 * The Units view (#101): the list of units, and a unit's page. A header with its identity chips, the class tree, then
 * build coverage (open), "As a parent" and pair-up folding away below it. It follows the global play context.
 */
import type { BuildMatch, Engine, PageUnitId, SkillRef, SkillViewSettings, TreeClass, UnitPage } from '../engine';
import { MOD_STATS, STAT_LABELS } from '../game-data/stats';
import { h } from './dom';
import { guide } from './guide';

export type UnitsContext = {
  readonly engine: Engine;
  readonly settings: SkillViewSettings;
  /** The open unit, or undefined for the list. */
  readonly unit: PageUnitId | undefined;
  readonly open: (unit: PageUnitId) => void;
  /** Back to the view the unit page was opened from, with its scroll. */
  readonly back: () => void;
  readonly backLabel: string;
  /** A skill chip that opens its Skill card (the one the Skills drawer uses). */
  readonly skillChip: (skill: SkillRef, marks: (HTMLElement | string)[], title: string, cls?: string) => HTMLElement;
  /** A build coverage card (the one the Skills drawer uses). */
  readonly buildCard: (m: BuildMatch) => HTMLElement;
};

export function unitsView(ctx: UnitsContext): HTMLElement[] {
  return ctx.unit ? unitPageView(ctx, ctx.engine.unitPage(ctx.unit, ctx.settings)) : [unitList(ctx)];
}

/** Robin first (with Robin's page), first-gen units in roster order, SpotPass last under a divider. */
function unitList(ctx: UnitsContext): HTMLElement {
  const units = ctx.engine.pageUnits();
  const item = (u: (typeof units)[number]) => h('button', { class: 'unit-item', onclick: () => ctx.open(u.id) }, u.name);
  return h(
    'section',
    { class: 'units' },
    h('h2', {}, 'Units'),
    h('p', { class: 'muted small' }, 'A unit on its own: its classes and skills, the builds it can fill, and what it passes to its children.'),
    h('div', { class: 'unit-grid' }, ...units.filter((u) => !u.spotPass).map(item)),
    h('h3', { class: 'muted small' }, 'SpotPass (paralogues 18–23)'),
    h('div', { class: 'unit-grid' }, ...units.filter((u) => u.spotPass).map(item)),
  );
}

const chip = (text: string, title?: string, cls = '') => h('span', { class: `chip${cls ? ` ${cls}` : ''}`, title }, text);

function header(ctx: UnitsContext, p: UnitPage): HTMLElement {
  const j = p.join;
  const how = j.recruit ? ` · ${j.recruit}` : '';
  return h(
    'header',
    { class: 'unit-head' },
    h('div', {}, h('button', { class: 'ghost small', onclick: ctx.back }, `← ${ctx.backLabel}`)),
    h('h2', {}, p.name),
    h('div', { class: 'muted small' }, `Joins in ${j.chapterLabel}${how} · Lv ${j.level} ${j.joinClassName}`),
    h(
      'div',
      { class: 'chips' },
      chip(`${p.chips.classes} classes`, 'Classes it can reach in this play context'),
      chip(`${p.chips.skills} skills`, 'Skills its classes teach, plus its starting skills'),
      chip(p.chips.bestTier ? `best build ${p.chips.bestTier}/5` : 'no build 3/5', 'Its best build template coverage', 'plan'),
    ),
  );
}

function treeClass(ctx: UnitsContext, c: TreeClass): HTMLElement {
  return h(
    'div',
    { class: `cc${c.dlc ? ' dlc' : ''}${c.join ? ' join' : ''}`, title: c.join ? 'Joins in this class' : c.dlc ? 'DLC class' : undefined },
    h('b', {}, c.name, c.join ? ' ◉' : ''),
    ...c.skills.map((s) =>
      h(
        'div',
        { class: `sk${s.inheritable ? '' : ' noinh'}` },
        ctx.skillChip(s.skill, s.starting ? [' ★'] : [], `${s.skill.name}: Lv ${s.level}${s.starting ? ', a starting skill' : ''}${s.inheritable ? '' : ', never inherited'}`),
        h('small', { class: 'muted' }, ` ${s.level}`),
      ),
    ),
  );
}

function classTree(ctx: UnitsContext, p: UnitPage): HTMLElement {
  const { lines, dlc, startingOnly } = p.tree;
  return h(
    'section',
    { ...guide('unit-class-tree'), class: 'tree' },
    h('h3', {}, 'Classes and skills'),
    h('p', { class: 'muted small' }, '◉ joins in · ★ starting skill · dimmed: never inherited · DLC classes dimmed'),
    ...lines.map((l) =>
      h('div', { class: 'line' }, treeClass(ctx, l.base), l.promotions.length ? h('span', { class: 'arrow' }, '→') : null, h('div', { class: 'promos' }, ...l.promotions.map((c) => treeClass(ctx, c)))),
    ),
    dlc.length ? h('div', { class: 'line' }, h('span', { class: 'arrow' }, 'DLC seal →'), h('div', { class: 'promos' }, ...dlc.map((c) => treeClass(ctx, c)))) : null,
    startingOnly.length
      ? h('div', { class: 'small' }, 'Starting skills no class teaches: ', ...startingOnly.map((s) => ctx.skillChip(s, [' ★'], `${s.name}: a starting skill, kept whatever the class`)))
      : null,
  );
}

function asParent(ctx: UnitsContext, p: UnitPage): HTMLElement {
  const a = p.asParent;
  const passes = (label: string, x: typeof a.son) => h('div', {}, h('b', {}, `${label}: `), x ? x.classes.map((c) => c.name).join(', ') : 'never its child');
  const mods = MOD_STATS.map((s) => `${STAT_LABELS[s]} ${a.modifiers[s] > 0 ? '+' : ''}${a.modifiers[s]}`).join(' · ');
  return h(
    'div',
    { class: 'small' },
    passes('Passes to a son', a.son),
    passes('Passes to a daughter', a.daughter),
    ...a.conversions.map((c) => h('div', { class: 'muted' }, `A daughter gets ${c.to} in place of ${c.from}.`)),
    h('div', {}, h('b', {}, 'Cap modifiers: '), mods),
    a.skills.kind === 'fixed'
      ? h('div', {}, h('b', {}, 'Always passes: '), `${a.skills.son.name} to a son, ${a.skills.daughter.name} to a daughter`)
      : h('div', {}, h('b', {}, 'Can pass (its last equipped): '), ...a.skills.skills.flatMap((s, i) => [i ? ' ' : '', ctx.skillChip(s, [], s.name)])),
    h('div', {}, h('b', {}, 'Its children: '), a.children.length ? a.children.map((c) => `${c.name}${c.as === 'fixed' ? ' (always)' : ''}`).join(', ') : 'none'),
  );
}

function pairUp(p: UnitPage): HTMLElement {
  const stats = [...MOD_STATS, 'mov'] as const;
  const label = (s: (typeof stats)[number]) => (s === 'mov' ? 'Mov' : STAT_LABELS[s]);
  return h(
    'table',
    { class: 'grid small' },
    h('thead', {}, h('tr', {}, h('th', {}, 'As a back in'), ...stats.map((s) => h('th', {}, label(s))))),
    h('tbody', {}, ...p.pairUp.map((c) => h('tr', {}, h('td', {}, c.name), ...stats.map((s) => h('td', { class: 'num' }, c.bonus[s] ? `+${c.bonus[s]}` : ''))))),
  );
}

function unitPageView(ctx: UnitsContext, p: UnitPage): HTMLElement[] {
  return [
    h(
      'div',
      { class: 'scroll unit-page' },
      header(ctx, p),
      classTree(ctx, p),
      h('details', { open: true }, h('summary', {}, `Build coverage (${p.builds.length})`), ...(p.builds.length ? p.builds.map(ctx.buildCard) : [h('p', { class: 'muted small' }, 'No build template reaches 3/5.')])),
      h('details', {}, h('summary', {}, 'As a parent'), asParent(ctx, p)),
      h('details', {}, h('summary', {}, 'Pair-up as a back'), pairUp(p)),
    ),
  ];
}

