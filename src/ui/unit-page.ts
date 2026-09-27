/**
 * The Units view (#101): the list of units, and a unit's page. A header with its identity chips, the class tree, then
 * build coverage (open), "As a parent" and pair-up folding away below it. It follows the explorer's play context.
 *
 * The explorer (#212; spec #175, user stories 99–101): unit pages and front doors rank by the explorer's presets
 * (`scoring:v1`), never by the plan, and say so; each links to the unit's Wishlist entry; unit opinion is labelled as
 * not read by the wishlist, and shown beside the unit's worth where the two strongly disagree.
 */
import type { BuildMatch, ChildId, ExplorerSettings, FrontDoor, OpinionBlock, OpinionMark, PairCurve, PresetId, Engine, PageSubject, PageUnitId, PartnerRow, RobinRef, Roster, RosterUnit, SkillRef, SkillViewSettings, TreeClass, UnitPage } from '../engine';
import { MOD_STATS, STATS, STAT_LABELS, type Gender, type Stat } from '../game-data/stats';
import { h } from './dom';
import { guide } from './guide';
import { EXPLORER_NOTE, OPINION_NOTE } from './labels';

export type UnitsContext = {
  readonly engine: Engine;
  readonly settings: SkillViewSettings;
  /** The open page's subject (Robin: the run facts' Robin, filled in by the preview), or undefined for the list. */
  readonly unit: PageSubject | undefined;
  /** The open child's front door (#104), when a child is open. */
  readonly door: FrontDoor | undefined;
  /** Opens a page or a child's front door; a Robin row passes the Robin to preview when the run facts leave it open. */
  readonly open: (unit: PageUnitId | 'robin' | ChildId, preview?: RobinRef) => void;
  /** The children with a front door in this run, in rail order. */
  readonly children: readonly { readonly id: ChildId; readonly name: string }[];
  /** Opens a child's full pairing table. */
  readonly openTable: (child: ChildId) => void;
  /** Robin's preview (#103): what the run facts leave open, chosen here and never written to them. */
  readonly preview: { readonly open: { readonly gender: boolean; readonly asset: boolean; readonly flaw: boolean }; readonly set: (ref: RobinRef) => void } | undefined;
  /** Back to the view the unit page was opened from, with its scroll. */
  readonly back: () => void;
  readonly backLabel: string;
  /** A skill chip that opens its Skill card (the one the Skills drawer uses). */
  readonly skillChip: (skill: SkillRef, marks: (HTMLElement | string)[], title: string, cls?: string) => HTMLElement;
  /** A build coverage card (the one the Skills drawer uses). */
  readonly buildCard: (m: BuildMatch) => HTMLElement;
  /** Partners read the roster and score each child in the explorer's preset. */
  readonly roster: Roster;
  readonly explorerSettings: ExplorerSettings;
  /** Opens a child's table on this pairing. */
  readonly openPairing: (child: ChildId, key: string) => void;
  /** Opens the unit's entry on the Wishlist tab (#212). */
  readonly openWishlist: (unit: RosterUnit) => void;
  readonly presetLabel: (id: PresetId) => string;
  /** A note when the explorer's play context isn't the run's route (#212): the wishlist reads the route's templates. */
  readonly contextNote?: string;
  /** A unit's worth to the adopted plan in flawless points, once the Wishlist tab has worked it out (#202). */
  readonly worth?: (unit: RosterUnit) => { readonly points: number; readonly text: string } | undefined;
  /** Every partner row shown, not only the top ones (view state). */
  readonly allPartners: boolean;
  readonly setAllPartners: (all: boolean) => void;
};

/** Partner rows shown before “All partners”. */
const TOP_PARTNERS = 5;

export function unitsView(ctx: UnitsContext): HTMLElement[] {
  if (ctx.door) return frontDoorView(ctx, ctx.door);
  return ctx.unit ? unitPageView(ctx, ctx.engine.unitPage(ctx.unit, ctx.settings)) : [unitList(ctx)];
}

/** Robin first, first-gen units in roster order, SpotPass last under a divider. */
function unitList(ctx: UnitsContext): HTMLElement {
  const units = ctx.engine.pageUnits();
  const item = (u: { readonly id: PageUnitId | 'robin'; readonly name: string }) => h('button', { class: 'unit-item', onclick: () => ctx.open(u.id) }, u.name);
  return h(
    'section',
    { class: 'units' },
    h('h2', {}, 'Units'),
    h('p', { class: 'muted small' }, 'A unit on its own: its classes and skills, the builds it can fill, and what it passes to its children.'),
    h('div', { class: 'unit-grid' }, item({ id: 'robin', name: 'Robin' }), ...units.filter((u) => !u.spotPass).map(item)),
    h('h3', { class: 'muted small' }, 'SpotPass (paralogues 18–23)'),
    h('div', { class: 'unit-grid' }, ...units.filter((u) => u.spotPass).map(item)),
    h('h3', { class: 'muted small' }, 'Children'),
    h('div', { class: 'unit-grid' }, ...ctx.children.map((c) => item(c as never))),
  );
}

/**
 * A child's front door (#104): what stays the same in every pairing, its top 5 parents as tiles into their pairing,
 * a link to the full table, and the Robin line. Morgan waits on Robin.
 */
function frontDoorView(ctx: UnitsContext, d: FrontDoor): HTMLElement[] {
  const tile = (t: FrontDoor['top'][number], i: number) =>
    h(
      'button',
      { class: `tile${i === 0 ? ' first' : ''}`, title: `Open ${d.name}’s table on this pairing`, onclick: () => ctx.openPairing(d.child, t.key) },
      h('div', { class: 'big num' }, String(t.score ?? '—')),
      h('div', {}, t.label),
      markChip(t.mark),
    );
  const robinLine = (): HTMLElement => {
    const r = d.robin;
    const robinLink = h('button', { class: 'linkish', onclick: () => ctx.open('robin') }, 'Robin’s page →');
    if (r.kind === 'robins-child') return h('p', { class: 'small' }, `${d.name} is Robin’s own child. `, robinLink);
    if (r.kind === 'no') return h('p', { class: 'small muted' }, `${d.name} can’t marry this run’s Robin.`);
    return h(
      'p',
      { class: 'small' },
      `💍 ${d.name} can marry Robin. `,
      r.morgan
        ? h('span', {}, 'Their Morgan at best: ', h('button', { class: 'linkish', onclick: () => ctx.openPairing(r.morgan!.key.split('|')[0] as ChildId, r.morgan!.key) }, `${r.morgan.label} ${r.morgan.score ?? '—'}`), '. ')
        : r.robinSet
          ? null
          : h('span', { class: 'muted' }, 'Set Robin to see their Morgan. '),
      robinLink,
    );
  };
  const facts = h(
    'div',
    { class: 'small' },
    h('div', {}, h('b', {}, 'Fixed parent: '), d.fixedParent),
    h('div', {}, h('b', {}, 'Start class: '), d.startClass ?? 'varies by pairing'),
    h('div', {}, h('b', {}, 'Default class set: '), d.defaultClasses.join(', ')),
    h('div', {}, h('b', {}, 'Personal growths: '), STATS.map((s) => `${STAT_LABELS[s]} ${d.growths[s]}`).join(' · ')),
    d.fixedPasses.skill || d.fixedPasses.classes.length
      ? h(
          'div',
          {},
          h('b', {}, `Every pairing gets from ${d.fixedParent}: `),
          ...(d.fixedPasses.skill ? [ctx.skillChip(d.fixedPasses.skill, [], `${d.fixedPasses.skill.name}: always passed`), ' '] : []),
          d.fixedPasses.classes.length ? `classes ${d.fixedPasses.classes.join(', ')}` : '',
        )
      : null,
  );
  return [
    h(
      'div',
      { class: 'scroll unit-page front-door' },
      h(
        'header',
        { class: 'unit-head' },
        h('div', {}, h('button', { class: 'ghost small', onclick: ctx.back }, `← ${ctx.backLabel}`)),
        h('h2', {}, d.name),
        h('div', { class: 'muted small' }, 'Child · front door · ', wishlistLink(ctx, d.child)),
        explorerNote(ctx),
        h('div', { class: 'chips' }, chip(`Fixed: ${d.fixedParent}`), chip(d.startClass ? `Starts ${d.startClass}` : 'Start class varies'), d.top[0] ? chip(`Best: ${d.top[0].label} ${d.top[0].score ?? '—'}`, undefined, 'plan') : null),
      ),
      d.waitsOnRobin
        ? h('div', { class: 'banner' }, `${d.name} waits on Robin: set Robin in the Run facts to see ${d.name}’s pairings. `, h('button', { class: 'linkish', onclick: () => ctx.open('robin') }, 'Robin’s page →'))
        : h(
            'section',
            { ...guide('front-door-pairings') },
            h('h3', {}, 'Best parents'),
            h('p', { class: 'muted small' }, `By your preset (${ctx.presetLabel(ctx.explorerSettings.preset)}), ranked as the pairing table ranks them.`),
            h('div', { class: 'tiles' }, ...d.top.map(tile)),
            d.marked.length ? h('div', { class: 'small' }, h('b', {}, 'Also marked by a source: '), h('div', { class: 'tiles' }, ...d.marked.map((t) => tile(t, -1)))) : null,
            h('button', { class: 'ghost small', onclick: () => ctx.openTable(d.child) }, `All ${d.parentCount} parents in the pairing table →`),
          ),
      robinLine(),
      opinions(ctx, ctx.engine.unitOpinions(d.child, ctx.settings), d.child),
      h('details', { open: true }, h('summary', {}, 'The same in every pairing'), facts),
    ),
  ];
}

const chip = (text: string, title?: string, cls = '') => h('span', { class: `chip${cls ? ` ${cls}` : ''}`, title }, text);

const CONTEXT_NAMES = { 'main-story': 'Main story', apotheosis: 'Apotheosis', all: 'Every context' } as const;

/** A source's mark on a partner or parent: ♥ recommended, ⚠ warned, with the reason. */
const markChip = (m: OpinionMark | undefined) =>
  m ? h('span', { class: `chip small op ${m.kind}`, title: `${m.source} ${m.kind === 'recommended' ? 'recommends' : 'warns against'} this${m.reason ? `: ${m.reason}` : ''}` }, `${m.kind === 'recommended' ? '♥' : '⚠'} ${m.source}`) : null;

/** The explorer's header (#212): what the page ranks by, and the play context against the run's route. */
const explorerNote = (ctx: UnitsContext): HTMLElement =>
  h('p', { class: 'muted small explorer-note' }, EXPLORER_NOTE, ctx.contextNote ? ` ${ctx.contextNote}` : '');

/** The unit's Wishlist entry (#212): the Wishlist tab with its edits open. */
const wishlistLink = (ctx: UnitsContext, unit: RosterUnit): HTMLElement =>
  h('button', { class: 'linkish', title: 'Its row on the Wishlist tab, with every edit that touches it and its cost', onclick: () => ctx.openWishlist(unit) }, 'Wishlist entry →');

/** How a source's tier reads (its leading letter): S or A high, C or F low, B neither. */
export function tierLean(tier: string | undefined): 'high' | 'low' | undefined {
  const letter = tier?.trim()[0];
  return letter === 'S' || letter === 'A' ? 'high' : letter === 'C' || letter === 'F' ? 'low' : undefined;
}

/** Worth (flawless points) under which a highly rated unit strongly disagrees with the plan, and from which a low one does. */
export const WORTH_DISAGREES = { low: 1, high: 5 } as const;

/**
 * Whether a source's tier and the unit's worth to the plan strongly disagree (#212; spec #175, user story 101): rated S
 * or A but worth under 1 point, or rated C or F but worth 5 points or more.
 */
export function opinionDisagrees(tier: string | undefined, points: number): boolean {
  const lean = tierLean(tier);
  return (lean === 'high' && points < WORTH_DISAGREES.low) || (lean === 'low' && points >= WORTH_DISAGREES.high);
}

/**
 * Each source's opinion, side by side and never merged (#105): “Ellery says…” with role, tier, classes, the loadout
 * matched against the unit (“4/5”), partners, note, citation and provenance. Labelled as not read by the wishlist
 * (#212); where a tier strongly disagrees with the unit's worth to the plan, the worth shows beside it.
 */
function opinions(ctx: UnitsContext, blocks: readonly OpinionBlock[], unit: RosterUnit): HTMLElement | null {
  if (!blocks.length) return null;
  const names = (list: OpinionBlock['recommended']) => list.map((p) => (p.reason ? `${p.name} (${p.reason})` : p.name)).join(', ');
  const worth = ctx.worth?.(unit);
  return h(
    'section',
    { ...guide('unit-opinion'), class: 'opinions' },
    h('p', { class: 'muted small' }, OPINION_NOTE),
    ...blocks.map((o) =>
      h(
        'div',
        { class: 'opinion' },
        h('h4', {}, `${o.source.name} says…`, h('span', { class: 'muted small' }, ` ${CONTEXT_NAMES[o.context]}`)),
        h('div', { class: 'small' }, h('b', {}, o.role), o.tier ? h('span', { class: 'chip small' }, o.tier) : null),
        worth && opinionDisagrees(o.tier, worth.points)
          ? h('div', { class: 'small warn', title: 'The wishlist ranks by flawless chance: a unit’s worth is the chance the plan loses without it' }, `Worth to your plan: ${worth.text}. ${o.source.name} rates it ${o.tier}.`)
          : null,
        o.classes.length ? h('div', { class: 'small' }, 'Classes: ', o.classes.join(', ')) : null,
        o.robinPick ? h('div', { class: 'small' }, 'Robin: ', h('b', {}, o.robinPick)) : null,
        o.loadout
          ? h(
              'div',
              { class: 'small' },
              `Loadout ${o.loadout.filled}/${o.loadout.slots.length}: `,
              ...o.loadout.slots.flatMap((sl, i) => [
                i ? ' ' : '',
                sl.skill ? ctx.skillChip(sl.skill, [], sl.skill.name) : h('span', { class: 'chip small neg', title: sl.reason ?? '' }, `✕ ${sl.options.map((x) => x.name).join(' / ')}`),
              ]),
            )
          : null,
        o.recommended.length ? h('div', { class: 'small' }, '♥ ', names(o.recommended)) : null,
        o.warned.length ? h('div', { class: 'small' }, '⚠ ', names(o.warned)) : null,
        o.note ? h('div', { class: 'small muted' }, o.note) : null,
        h(
          'div',
          { class: 'small muted' },
          `“${o.citation}” · `,
          h('a', { href: o.source.link, target: '_blank', rel: 'noopener', title: o.source.provenance }, `${o.source.id} ${o.source.name}`),
        ),
      ),
    ),
  );
}

function header(ctx: UnitsContext, p: UnitPage): HTMLElement {
  const j = p.join;
  const how = j.recruit ? ` · ${j.recruit}` : '';
  return h(
    'header',
    { class: 'unit-head' },
    h('div', {}, h('button', { class: 'ghost small', onclick: ctx.back }, `← ${ctx.backLabel}`)),
    h('h2', {}, p.name),
    h('div', { class: 'muted small' }, `Joins in ${j.chapterLabel}${how} · Lv ${j.level} ${j.joinClassName} · `, wishlistLink(ctx, p.robin ? 'robin' : (p.unit as RosterUnit))),
    explorerNote(ctx),
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

const PARTNER_MARKS = (r: PartnerRow): string[] => [
  ...(r.married ? ['married'] : []),
  ...(r.dead ? ['dead'] : []),
  ...(r.blocked && !r.married ? ['blocked'] : []),
];

/** A partner's support curve (#177): its name, maps to S, and the points each rank needs on hover. */
const curveChip = (c: PairCurve) => {
  const t = c.thresholds;
  const points = `C ${t.C} · B ${t.B} · A ${t.A}${t.S === undefined ? '' : ` · S ${t.S}`} points`;
  return h(
    'span',
    { class: `chip small curve-${c.curve}`, title: `Support curve: ${points}. S in ${c.mapsToS} maps fighting together at best (3 points a map, one rank a map).` },
    `${c.curve} · S in ${c.mapsToS}`,
  );
};

/** Partners (#102): each possible spouse, the children the marriage produces, where it stands; read-only. */
function partners(ctx: UnitsContext, p: UnitPage): HTMLElement {
  const rows = ctx.engine.partners(p.robin ?? (p.unit as PageUnitId), ctx.roster, ctx.explorerSettings);
  const shown = ctx.allPartners ? rows : rows.slice(0, TOP_PARTNERS);
  const partnerName = (r: PartnerRow) =>
    r.partner === 'robin'
      ? h('button', { class: 'linkish', title: 'Robin’s page, on this Robin', onclick: () => ctx.open('robin', r.robin) }, r.name)
      : ctx.engine.pageUnits().some((u) => u.id === r.partner)
        ? h('button', { class: 'linkish', title: `${r.name}’s page`, onclick: () => ctx.open(r.partner as PageUnitId) }, r.name)
        : h('b', {}, r.name);
  return h(
    'section',
    { ...guide('unit-partners'), class: 'partners' },
    h('h3', {}, `Partners (${rows.length})`),
    h('p', { class: 'muted small' }, `Sorted by the best child, each scored in your preset (${ctx.presetLabel(ctx.explorerSettings.preset)}). What a marriage costs your run is a marriage edit on the Wishlist tab.`),
    ...shown.map((r) =>
      h(
        'div',
        { class: `partner${r.blocked && !r.married ? ' blocked' : ''}`, title: r.blocked && !r.married ? `Blocked: ${r.blocked}` : undefined },
        h('div', {}, partnerName(r), markChip(r.opinion), curveChip(r.curve), ...PARTNER_MARKS(r).map((m) => h('span', { class: 'chip small' }, m))),
        h(
          'div',
          { class: 'small' },
          ...r.children.flatMap((c, i) => [
            i ? ' · ' : '',
            h('button', { class: 'linkish', title: `Open ${c.name}’s table on this pairing`, onclick: () => ctx.openPairing(c.child, c.key) }, c.name),
            h('span', { class: 'num', title: `Scored in ${ctx.presetLabel(c.preset)}` }, ` ${c.score ?? '—'}`),
          ]),
        ),
        r.via ? h('div', { class: 'muted small' }, `Morgan on ${r.via.label} (its best pairing left)`) : null,
        r.blocked && !r.married ? h('div', { class: 'muted small' }, r.blocked) : null,
      ),
    ),
    rows.length > TOP_PARTNERS
      ? h('button', { class: 'ghost small', onclick: () => ctx.setAllPartners(!ctx.allPartners) }, ctx.allPartners ? 'Top partners only' : `All partners (${rows.length})`)
      : null,
  );
}

function unitPageView(ctx: UnitsContext, p: UnitPage): HTMLElement[] {
  return [
    h(
      'div',
      { class: 'scroll unit-page' },
      header(ctx, p),
      p.robin ? robinPreview(ctx, p.robin) : null,
      h(
        'div',
        { class: 'unit-cols' },
        h('div', { class: 'unit-main' }, ...mainColumn(ctx, p)),
        h('aside', { class: 'unit-side' }, opinions(ctx, ctx.engine.unitOpinions(p.robin ?? (p.unit as PageUnitId), ctx.settings), p.robin ? 'robin' : (p.unit as RosterUnit)), partners(ctx, p)),
      ),
    ),
  ];
}

/**
 * Robin's preview bar (#103): the gender and asset/flaw the run facts leave open, chosen for this page only. The run
 * facts' own values show read-only.
 */
function robinPreview(ctx: UnitsContext, r: RobinRef): HTMLElement {
  const pv = ctx.preview;
  if (!pv) return h('div', { class: 'muted small' }, `Your Robin, from the Run facts: +${STAT_LABELS[r.asset]} −${STAT_LABELS[r.flaw]}.`);
  const select = (label: string, value: string, options: readonly (readonly [string, string])[], on: (v: string) => void, enabled: boolean) =>
    h(
      'label',
      { class: 'small' },
      `${label} `,
      h(
        'select',
        { disabled: !enabled, onchange: (e) => on((e.target as HTMLSelectElement).value) },
        ...options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)),
      ),
    );
  const stats = STATS.map((s) => [s, STAT_LABELS[s]] as const);
  return h(
    'div',
    { ...guide('robin-preview'), class: 'banner preview-bar' },
    h('b', {}, 'Preview'),
    h('span', { class: 'muted small' }, 'Robin isn’t set in the Run facts: try a Robin here. Nothing is saved.'),
    h(
      'div',
      { class: 'row' },
      select('Gender', r.gender, [['M', 'Male'], ['F', 'Female']], (g) => pv.set({ ...r, gender: g as Gender }), pv.open.gender),
      select('Asset', r.asset, stats, (a) => pv.set({ ...r, asset: a as Stat, flaw: r.flaw === a ? (a === 'hp' ? 'str' : 'hp') : r.flaw }), pv.open.asset),
      select('Flaw', r.flaw, stats.filter(([s]) => s !== r.asset), (f) => pv.set({ ...r, flaw: f as Stat }), pv.open.flaw),
    ),
  );
}

/** The class tree, then build coverage (open), As a parent and Pair-up folding away below it. */
function mainColumn(ctx: UnitsContext, p: UnitPage): (HTMLElement | null)[] {
  return [
    classTree(ctx, p),
    h('details', { open: true }, h('summary', {}, `Build coverage (${p.builds.length})`), ...(p.builds.length ? p.builds.map(ctx.buildCard) : [h('p', { class: 'muted small' }, 'No build template reaches 3/5.')])),
    h('details', {}, h('summary', {}, 'As a parent'), asParent(ctx, p)),
    h('details', {}, h('summary', {}, 'Pair-up as a back'), pairUp(p)),
  ];
}

