/**
 * The Maps list (#109): every map with chapter data, in the Run view's place in the rail, and a map's cited chapter
 * data on one difficulty: conditions, recruits and forced units, bosses, enemy groups with their triggers,
 * reinforcements, items, shop and the Lunatic+ rule.
 */
import type { BossRow, ChapterData, ChapterDifficulty, Difficulty, EnemyGroup, Engine } from '../engine';
import { LUNATIC_PLUS, REINFORCEMENT_RULE, unitName, type RosterUnit } from '../engine';
import { h } from './dom';
import { guide } from './guide';

export type MapsContext = {
  readonly engine: Engine;
  /** The open map, or undefined for the list. */
  readonly map: string | undefined;
  readonly open: (id: string | undefined) => void;
  /** The difficulty shown: the run's, else the one picked here (view state). */
  readonly difficulty: Difficulty;
  readonly setDifficulty: (d: Difficulty) => void;
};

const KIND_LABEL = { story: 'Story', paralogue: 'Paralogues', xenologue: 'Xenologues (DLC)' } as const;

const DIFF_LABEL: Readonly<Record<Difficulty, string>> = { normal: 'Normal', hard: 'Hard', lunatic: 'Lunatic', 'lunatic-plus': 'Lunatic+' };
const tableDifficulty = (d: Difficulty): ChapterDifficulty => (d === 'lunatic-plus' ? 'lunatic' : d);

const DIFF_NAME: Readonly<Record<string, string>> = { normal: 'Normal', hard: 'Hard', lunatic: 'Lunatic', 'lunatic-plus': 'Lunatic+' };

/**
 * How to run it (#123): each named source's chapter-guide entries for the map, side by side and never merged, each
 * with the difficulty it was played on, its turn window, the units it assumes, and its citation.
 */
export function howToRun(engine: Engine, map: string): HTMLElement | null {
  const guideBySource = engine.chapterGuide(map);
  if (!guideBySource.length) return null;
  return h(
    'section',
    { ...guide('how-to-run'), class: 'how-to-run' },
    h('h3', {}, 'How to run it'),
    ...guideBySource.map((g) =>
      h(
        'div',
        { class: 'opinion' },
        h('h4', {}, `${g.source.name} says…`),
        h(
          'ul',
          { class: 'small' },
          ...g.entries.map((e) =>
            h(
              'li',
              {},
              e.turns ? h('b', {}, `${e.turns}: `) : null,
              e.tactic,
              h('span', { class: 'muted' }, ` (${DIFF_NAME[e.difficulty]}${e.units.length ? ` · assumes ${e.units.map((u) => unitName(u as RosterUnit)).join(', ')}` : ''})`),
            ),
          ),
        ),
        h('div', { class: 'small muted' }, `“${[...new Set(g.entries.map((e) => e.citation.title))].join('”, “')}” · `, h('a', { href: g.source.link, target: '_blank', rel: 'noopener' }, `${g.source.id} ${g.source.name}`)),
      ),
    ),
    h('p', { class: 'muted small' }, 'Opinion, checked against the chapter data before it went in; the facts are in the chapter data.'),
  );
}

export function mapsView(ctx: MapsContext): HTMLElement[] {
  const map = ctx.map && ctx.engine.maps().find((m) => m.id === ctx.map);
  return map ? mapPage(ctx, map) : [mapList(ctx)];
}

function mapList(ctx: MapsContext): HTMLElement {
  return h(
    'section',
    { ...guide('maps-list'), class: 'units maps' },
    h('h2', {}, 'Maps'),
    h('p', { class: 'muted small' }, 'Each map’s chapter data, cited to Fire Emblem Wiki and cross-checked against Serenes Forest.'),
    ...(['story', 'paralogue', 'xenologue'] as const).flatMap((kind) => [
      h('h3', { class: 'muted small' }, KIND_LABEL[kind]),
      h(
        'div',
        { class: 'unit-grid' },
        ...ctx.engine
          .maps()
          .filter((m) => m.kind === kind)
          .map((m) =>
            h(
              'button',
              { class: 'unit-item', onclick: () => ctx.open(m.id) },
              h('b', {}, m.label),
              h('div', { class: 'small muted' }, m.kind === 'xenologue' ? (m.grind ? 'grind map' : 'DLC') : m.title),
            ),
          ),
      ),
    ]),
  );
}

const statLine = (s: EnemyGroup['stats']) => `HP ${s.hp} · Str ${s.str} · Mag ${s.mag} · Skl ${s.skl} · Spd ${s.spd} · Lck ${s.lck} · Def ${s.def} · Res ${s.res}${s.mov ? ` · Mov ${s.mov}` : ''}`;
const itemsLine = (items: EnemyGroup['items']) => items.map((i) => `${i.name}${i.drop ? ' (drops)' : ''}${i.forged ? ' (forged)' : ''}`).join(', ');

function bossBlock(b: BossRow): HTMLElement {
  return h(
    'div',
    { class: 'opinion' },
    h('b', {}, `${b.name ?? 'Boss'} · ${b.class} Lv ${b.level}`),
    h('div', { class: 'small' }, statLine(b.stats)),
    h('div', { class: 'small' }, itemsLine(b.items), b.skills.length ? ` · Skills: ${b.skills.join(', ')}` : ''),
  );
}

function enemyTable(groups: readonly EnemyGroup[]): HTMLElement {
  return h(
    'table',
    { class: 'grid small' },
    h('thead', {}, h('tr', {}, ...['#', 'Enemy', 'Class', 'Lv', 'Stats', 'Items and skills', 'Moves'].map((t) => h('th', {}, t)))),
    h(
      'tbody',
      {},
      ...groups.map((g) =>
        h(
          'tr',
          {},
          h('td', { class: 'num' }, g.count),
          h('td', {}, g.name, g.faction || g.wave ? h('div', { class: 'muted' }, g.faction ?? g.wave ?? '') : null),
          h('td', {}, g.class),
          h('td', { class: 'num' }, g.level),
          h('td', {}, statLine(g.stats)),
          h('td', {}, itemsLine(g.items), g.skills?.length ? ` · ${g.skills.join(', ')}` : '', g.randomSkills ? h('div', { class: 'muted' }, g.randomSkills) : null),
          h('td', { class: 'muted' }, g.notes ?? ''),
        ),
      ),
    ),
  );
}

function mapPage(ctx: MapsContext, m: ChapterData): HTMLElement[] {
  const d = tableDifficulty(ctx.difficulty);
  const cond = m.conditions[d];
  const lplus = ctx.difficulty === 'lunatic-plus';
  const pool = ctx.engine.lunaticPlusPool(m);
  const disagreements = ctx.engine.chapterDisagreements().filter((x) => x.map === m.id);
  return [
    h(
      'div',
      { ...guide('map-data'), class: 'scroll unit-page map-page' },
      h(
        'header',
        { class: 'unit-head' },
        h('div', {}, h('button', { class: 'ghost small', onclick: () => ctx.open(undefined) }, '← Maps')),
        h('h2', {}, m.title === m.label ? m.title : `${m.label}: ${m.title}`),
        m.location ? h('div', { class: 'muted small' }, m.location) : null,
        h(
          'div',
          { class: 'chips' },
          ...(['normal', 'hard', 'lunatic', 'lunatic-plus'] as const).map((x) =>
            h('button', { class: `mini${x === ctx.difficulty ? ' on' : ''}`, 'aria-pressed': String(x === ctx.difficulty), onclick: () => ctx.setDifficulty(x) }, DIFF_LABEL[x]),
          ),
        ),
      ),
      cond
        ? h(
            'div',
            { class: 'small' },
            h('div', {}, h('b', {}, 'Win: '), cond.victory, ' · ', h('b', {}, 'Lose: '), cond.defeat),
            h('div', {}, h('b', {}, 'Deploy: '), cond.deploy, ' · ', h('b', {}, 'Enemies: '), cond.enemies),
            m.forced.length ? h('div', {}, h('b', {}, 'Forced: '), m.forced.join(', ')) : null,
            m.recruits.length ? h('div', {}, h('b', {}, 'Recruits: '), m.recruits.map((r) => `${r.unit} (${r.class} Lv ${r.level}${r.how ? `: ${r.how}` : ''})`).join('; ')) : null,
          )
        : null,
      h('h3', {}, 'Boss'),
      ...((lplus && m.bosses['lunatic-plus']) || m.bosses[d] || []).map(bossBlock),
      h('h3', {}, 'Enemies'),
      lplus
        ? h(
            'div',
            { class: 'banner' },
            `Lunatic+: Lunatic’s enemies, each with ${LUNATIC_PLUS.extraSkills} more skills at random from ${pool.join(', ')}. When they’re rolled, and whether bosses get them, isn’t published: treat them as possibilities.`,
          )
        : null,
      enemyTable(m.enemies[d] ?? []),
      m.reinforcements.length
        ? h(
            'div',
            {},
            h('h3', {}, 'Reinforcements'),
            h('p', { class: 'muted small' }, d === 'normal' ? REINFORCEMENT_RULE.normal : REINFORCEMENT_RULE['hard+']),
            h('ul', { class: 'small' }, ...m.reinforcements.map((r) => h('li', { style: `margin-left:${(r.length - r.trimStart().length) * 6}px` }, r.trim()))),
          )
        : null,
      howToRun(ctx.engine, m.id),
      m.items.length ? h('div', {}, h('h3', {}, 'Items'), h('ul', { class: 'small' }, ...m.items.map((i) => h('li', {}, `${i.item}: ${i.how}`)))) : null,
      m.shop
        ? h(
            'div',
            { class: 'small' },
            h('h3', {}, `Shop: ${m.shop.location}`),
            m.shop.opensAfter ? h('div', { class: 'muted' }, `The armory opens after ${m.shop.opensAfter}.`) : null,
            h('div', {}, h('b', {}, 'Armory: '), m.shop.armory.map((i) => `${i.item} ${i.cost ?? ''}`).join(', ')),
            h('div', {}, h('b', {}, 'Merchant (three at random): '), m.shop.merchant.map((i) => `${i.item} ${i.cost ?? ''}`).join(', ')),
          )
        : null,
      disagreements.length
        ? h('div', { class: 'small' }, h('h3', {}, 'Sources disagree'), ...disagreements.map((x) => h('div', {}, `${x.id} ${x.item}: using ${x.used}; ${x.other} (${x.status}). ${x.why}`)))
        : null,
      h(
        'p',
        { class: 'muted small' },
        'Source: ',
        h('a', { href: `https://fireemblemwiki.org/w/index.php?oldid=${m.source.oldid}`, target: '_blank', rel: 'noopener' }, `Fire Emblem Wiki, ${m.source.page}`),
        ` · ${m.eventTiles} event tiles`,
      ),
    ),
  ];
}

