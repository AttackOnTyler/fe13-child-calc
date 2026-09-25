/**
 * The preparation page (#119): the next map's matchup table. Each lead from the latest entry, paired with its back (its
 * highest support by default), with its best weapon from its inventory, against one foe at a time on the run's
 * difficulty. Lunatic+ assumes the pool's worst case.
 */
import type { ChapterDifficulty, Engine, Fighter, Foe, Matchup, RosterUnit, Run, SupportLevel, UnitSnapshot } from '../engine';
import { bestWeapon, foesOf, itemByName, latestEntry, unitName } from '../engine';
import { h } from './dom';
import { guide } from './guide';

export type PrepContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly map: string;
  readonly close: () => void;
  /** The back chosen for each lead (view state); absent: its highest support. */
  readonly backs: Readonly<Partial<Record<RosterUnit, RosterUnit | 'none'>>>;
  readonly setBack: (lead: RosterUnit, back: RosterUnit | 'none') => void;
  readonly foe: number;
  readonly setFoe: (i: number) => void;
};

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);
const RANK_ORDER: Readonly<Record<SupportLevel, number>> = { C: 1, B: 2, A: 3, S: 4 };

/** A recorded unit as a fighter: its first weapon (the one it would equip) and its weapons to choose from. */
export function fighterOf(name: string, u: UnitSnapshot): { fighter: Fighter; weapons: NonNullable<Fighter['weapon']>[] } | undefined {
  if (!u.stats) return undefined;
  const weapons = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    return item && WEAPON_KINDS.has(item.kind) ? [{ item, ...(h.forge ? { forge: { mt: h.forge.mt, hit: h.forge.hit, crit: h.forge.crit } } : {}) }] : [];
  });
  return { fighter: { name, className: u.class, stats: u.stats, skills: u.skills, weapon: weapons[0] }, weapons };
}

/** The lead's default back: its highest recorded support. */
export const defaultBack = (u: UnitSnapshot): RosterUnit | undefined => [...u.supports].sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank])[0]?.partner;

export function prepPage(ctx: PrepContext): HTMLElement[] {
  const { engine, run } = ctx;
  const m = engine.maps().find((x) => x.id === ctx.map)!;
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const lplus = difficulty === 'lunatic-plus';
  const pool = lplus ? engine.lunaticPlusPool(m) : [];
  const foes = foesOf(m, table, lplus);
  const foe = foes[Math.min(ctx.foe, foes.length - 1)];
  const snap = latestEntry(run)?.snapshot;
  const gender = run.roster.run.gender;
  const units = (Object.entries(snap?.units ?? {}) as [RosterUnit, UnitSnapshot][]).filter(([u]) => run.roster.states[u] !== 'dead' && snap?.states[u] !== 'dead');
  const rows = units.flatMap(([unit, u]) => {
    const f = fighterOf(unitName(unit, gender), u);
    if (!f || !foe) return [];
    const chosen = ctx.backs[unit];
    const backId = chosen === 'none' ? undefined : (chosen ?? defaultBack(u));
    const backSnap = backId ? snap?.units[backId] : undefined;
    const back = backId && backSnap ? fighterOf(unitName(backId, gender), backSnap)?.fighter : undefined;
    const support = backId ? (u.supports.find((s) => s.partner === backId)?.rank ?? null) : null;
    const best = f.weapons.length ? bestWeapon(f.fighter, f.weapons, back, support, foe, pool) : undefined;
    return [{ unit, u, backId, best }];
  });
  const cell = (ok: boolean, text: string, title?: string) => h('td', { class: ok ? 'pos' : 'neg', title }, text);
  const row = (r: (typeof rows)[number]) => {
    const res: Matchup | undefined = r.best?.result;
    const backSelect = h(
      'select',
      { 'aria-label': `${r.unit}’s back`, onchange: (e) => ctx.setBack(r.unit, (e.target as HTMLSelectElement).value as RosterUnit | 'none') },
      h('option', { value: 'none', selected: !r.backId }, '— no back'),
      ...units.filter(([x]) => x !== r.unit).map(([x]) => h('option', { value: x, selected: x === r.backId }, unitName(x, gender))),
    );
    if (!res) return h('tr', {}, h('td', {}, unitName(r.unit, gender)), h('td', {}, backSelect), h('td', { colspan: '8', class: 'muted' }, 'No weapon recorded in its inventory'));
    return h(
      'tr',
      {},
      h('td', {}, unitName(r.unit, gender)),
      h('td', {}, backSelect),
      h('td', {}, r.best!.weapon?.item.name ?? '—'),
      h('td', { class: 'num' }, `${res.damage}×${res.hits}`),
      cell(res.oneRounds, res.oneRounds ? '✓' : res.oneRoundsWithDualStrikes ? '✓ w/ DS' : '✗', res.oneRoundsWithDualStrikes && !res.oneRounds ? `Only if dual strikes land (${res.dualStrikeRate}%)` : undefined),
      h('td', { class: 'num' }, `${res.dualStrikeRate || '—'}${res.dualStrikeRate ? '%' : ''}`),
      h('td', {}, `${res.doubles ? '2× ' : ''}${res.doubled ? 'doubled' : ''}` || '—'),
      cell(res.survives, `${res.worstRound} / ${r.u.stats!.hp}`, `Worst hit ${res.worstHit}; the most it takes in a round`),
      h('td', { class: 'num' }, `${res.hit} / ${res.crit}`),
      h('td', { class: 'num' }, `${res.foeHit} / ${res.foeCrit}`),
      h('td', { class: 'muted small' }, res.notes.join('; ')),
    );
  };
  return [
    h(
      'div',
      { ...guide('prep-page'), class: 'scroll unit-page prep-page' },
      h(
        'header',
        { class: 'unit-head' },
        h('div', {}, h('button', { class: 'ghost small', onclick: ctx.close }, '← Run')),
        h('h2', {}, `Prepare: ${m.label}${m.kind === 'story' ? `: ${m.title}` : ''}`),
        h('div', { class: 'muted small' }, `${difficulty === 'lunatic-plus' ? 'Lunatic+' : table} · stats from your latest entry · no movement planning`),
      ),
      lplus ? h('div', { class: 'banner' }, `Lunatic+: each enemy may have 2 of ${pool.join(', ')}. The table assumes the worst of them.`) : null,
      h('h3', {}, 'Matchups'),
      h(
        'div',
        { ...guide('matchup-foe'), class: 'chips' },
        ...foes.map((f: Foe, i) =>
          h('button', { class: `mini${f === foe ? ' on' : ''}`, onclick: () => ctx.setFoe(i) }, `${f.boss ? '★ ' : ''}${f.name}${f.count > 1 ? ` ×${f.count}` : ''} (${f.className})`),
        ),
      ),
      foe ? h('div', { class: 'muted small' }, `${foe.name}: HP ${foe.stats.hp} · Str ${foe.stats.str} · Mag ${foe.stats.mag} · Skl ${foe.stats.skl} · Spd ${foe.stats.spd} · Def ${foe.stats.def} · Res ${foe.stats.res}${foe.weapon ? ` · ${foe.weapon.name}` : ''}${foe.skills.length ? ` · ${foe.skills.join(', ')}` : ''}`) : null,
      rows.length
        ? h(
            'div',
            { class: 'scroll-x' },
            h(
              'table',
              { ...guide('matchup-table'), class: 'grid small' },
              h('thead', {}, h('tr', {}, ...['Lead', 'Back', 'Weapon', 'Dmg', 'One round', 'Dual strike', 'Doubling', 'Worst round / HP', 'Hit / Crit', 'Foe hit / crit', 'Why'].map((t) => h('th', {}, t)))),
              h('tbody', {}, ...rows.map(row)),
            ),
          )
        : h('p', { class: 'muted' }, 'Record your units’ stats and inventories in the chapter log to see matchups.'),
    ),
  ];
}
