/**
 * The preparation page (#119): the next map's matchup table. Each lead from the latest entry, paired with its back (its
 * highest support by default), with its best weapon from its inventory, against one foe at a time on the run's
 * difficulty. Lunatic+ assumes the pool's worst case.
 */
import type { ChapterDifficulty, Engine, Fighter, Foe, Matchup, RosterUnit, Run, Snapshot, UnitSnapshot } from '../engine';
import { REINFORCEMENT_RULE, bestWeapon, dangerFlags, deployMax, foeKey, foesOf, itemByName, latestEntry, suggestDeployment, suggestLoadout, unitName, withSeenSkills, type DeployCandidate, type DeploymentRole } from '../engine';
import { h } from './dom';
import { guide } from './guide';

export type PrepContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly map: string;
  readonly close: () => void;
  readonly setRun: (run: Run) => void;
  /** The back chosen for each lead (view state); absent: its highest support. */
  readonly backs: Readonly<Partial<Record<RosterUnit, RosterUnit | 'none'>>>;
  readonly setBack: (lead: RosterUnit, back: RosterUnit | 'none') => void;
  readonly foe: number;
  readonly setFoe: (i: number) => void;
  /** Each unit's deployment role: army fit's for children, the roster's tag otherwise (#121). */
  readonly roleOf: (u: RosterUnit) => DeploymentRole;
  /** Units the player took out of the deployment (view state). */
  readonly excluded: ReadonlySet<RosterUnit>;
  readonly setExcluded: (u: RosterUnit, out: boolean) => void;
};

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/** A recorded unit as a fighter: its first weapon (the one it would equip) and its weapons to choose from. */
export function fighterOf(name: string, u: UnitSnapshot): { fighter: Fighter; weapons: NonNullable<Fighter['weapon']>[] } | undefined {
  if (!u.stats) return undefined;
  const weapons = u.inventory.flatMap((h) => {
    const item = itemByName(h.item);
    return item && WEAPON_KINDS.has(item.kind) ? [{ item, ...(h.forge ? { forge: { mt: h.forge.mt, hit: h.forge.hit, crit: h.forge.crit } } : {}) }] : [];
  });
  return { fighter: { name, className: u.class, stats: u.stats, skills: u.skills, weapon: weapons[0] }, weapons };
}

/** Threats (#120): the map's enemy groups and boss on this difficulty, what sets them moving, and reinforcements. */
function threats(m: ReturnType<Engine['maps']>[number], foes: readonly Foe[], table: ChapterDifficulty): HTMLElement {
  const groups = m.enemies[table] ?? [];
  return h(
    'details',
    { ...guide('prep-threats'), open: true },
    h('summary', {}, `Threats (${foes.reduce((n, f) => n + f.count, 0)} enemies)`),
    h(
      'table',
      { class: 'grid small' },
      h('thead', {}, h('tr', {}, ...['#', 'Enemy', 'Class', 'Weapon', 'Skills', 'Moves'].map((t) => h('th', {}, t)))),
      h(
        'tbody',
        {},
        ...foes.map((f) => {
          const g = groups.find((x) => (x.name || x.class) === f.name && x.class === f.className);
          return h(
            'tr',
            {},
            h('td', { class: 'num' }, `${f.boss ? '★' : f.count}`),
            h('td', {}, f.name),
            h('td', {}, f.className),
            h('td', {}, f.weapon?.name ?? '—'),
            h('td', {}, f.skills.join(', ') || '—', g?.randomSkills ? h('div', { class: 'muted' }, g.randomSkills) : null),
            h('td', { class: 'muted' }, g?.notes ?? ''),
          );
        }),
      ),
    ),
    m.reinforcements.length
      ? h(
          'div',
          { class: 'small' },
          h('b', {}, 'Reinforcements '),
          h('span', { class: 'muted' }, table === 'normal' ? REINFORCEMENT_RULE.normal : REINFORCEMENT_RULE['hard+']),
          h('ul', {}, ...m.reinforcements.map((r) => h('li', { style: `margin-left:${(r.length - r.trimStart().length) * 6}px` }, r.trim()))),
        )
      : null,
  );
}

/** Danger flags (#120): effective weapons, Counter, a boss that doubles, a round that kills. */
function dangers(units: readonly [RosterUnit, UnitSnapshot][], foes: readonly Foe[], pool: readonly string[], seen: Readonly<Record<string, readonly string[]>>, gender: Run['roster']['run']['gender']): HTMLElement {
  const army = units.flatMap(([u, s]) => {
    const f = fighterOf(unitName(u, gender), s);
    return f ? [f.fighter] : [];
  });
  const flags = dangerFlags(army, foes, pool, (f) => seen[foeKey(f)]);
  const ICON = { effective: '⚔', counter: '↩', doubles: '»', kills: '☠' } as const;
  return h(
    'details',
    { ...guide('danger-flags'), open: true },
    h('summary', {}, `Danger flags (${flags.length})`),
    flags.length ? h('ul', { class: 'small' }, ...flags.map((f) => h('li', { class: f.kind === 'kills' ? 'neg' : '' }, `${ICON[f.kind]} ${f.text}`))) : h('p', { class: 'muted small' }, army.length ? 'Nothing stands out.' : 'Record your units in the chapter log to see flags.'),
  );
}

/** Lunatic+ (#120): each enemy to inspect once the map starts, and the random skills seen, which the matchups then use. */
function checklist(ctx: PrepContext, foes: readonly Foe[], pool: readonly string[], seen: Readonly<Record<string, readonly string[]>>): HTMLElement {
  return h(
    'details',
    { ...guide('lplus-checklist'), open: true },
    h('summary', {}, 'Lunatic+ checklist'),
    h('p', { class: 'muted small' }, `Each enemy has 2 extra skills from ${pool.join(', ')}. Inspect them when the map starts and note what you see: the matchups use it in place of the worst case.`),
    h(
      'table',
      { class: 'grid small' },
      h(
        'tbody',
        {},
        ...foes.map((f) => {
          const key = foeKey(f);
          const done = !!seen[key];
          return h(
            'tr',
            {},
            h('td', {}, done ? '✓' : '☐'),
            h('td', {}, `${f.name}${f.count > 1 ? ` ×${f.count}` : ''} (${f.className})`),
            h(
              'td',
              {},
              h('input', {
                value: (seen[key] ?? []).join(', '),
                placeholder: 'e.g. Luna+, Pass',
                'aria-label': `${f.name}: Lunatic+ skills seen`,
                onchange: (e) =>
                  ctx.setRun(
                    withSeenSkills(
                      ctx.run,
                      ctx.map,
                      key,
                      (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean),
                    ),
                  ),
              }),
            ),
          );
        }),
      ),
    ),
  );
}

/** Deployment and pairs (#121): the solver's pick; a back picked or a unit dropped recomputes it. */
function deploymentSection(
  ctx: PrepContext,
  d: ReturnType<typeof suggestDeployment>,
  byUnit: ReadonlyMap<RosterUnit, DeployCandidate>,
  units: readonly [RosterUnit, UnitSnapshot][],
  gender: Run['roster']['run']['gender'],
): HTMLElement {
  const name = (u: RosterUnit) => unitName(u, gender);
  const benched = units.map(([u]) => u).filter((u) => !d.deployed.includes(u));
  return h(
    'details',
    { ...guide('prep-deployment'), open: true },
    h('summary', {}, `Deployment and pairs (${d.deployed.length} of ${d.max})`),
    h('p', { class: 'muted small' }, 'Forced units first, then each lead with the back that covers the map best, then Staff/Rally and dancers. Pick a back or drop a unit: everything recomputes.'),
    h(
      'table',
      { class: 'grid small' },
      h('thead', {}, h('tr', {}, ...['Lead', 'Role', 'Back', 'Support', 'Coverage', ''].map((t) => h('th', {}, t)))),
      h(
        'tbody',
        {},
        ...d.pairs.map((p) =>
          h(
            'tr',
            {},
            h('td', {}, name(p.lead)),
            h('td', { class: 'muted' }, byUnit.get(p.lead)?.role ?? ''),
            h(
              'td',
              {},
              h(
                'select',
                { 'aria-label': `${name(p.lead)}’s back`, onchange: (e) => ctx.setBack(p.lead, (e.target as HTMLSelectElement).value as RosterUnit | 'none') },
                h('option', { value: 'none', selected: !p.back }, '— no back'),
                ...units.filter(([x]) => x !== p.lead).map(([x]) => h('option', { value: x, selected: x === p.back }, name(x))),
              ),
            ),
            h('td', {}, p.support ?? '—'),
            h('td', { class: 'num' }, String(p.coverage)),
            h('td', {}, h('button', { class: 'mini', title: 'Leave out of this map', onclick: () => ctx.setExcluded(p.lead, true) }, '✕')),
          ),
        ),
        ...d.solo.map((u) => h('tr', {}, h('td', {}, name(u)), h('td', { class: 'muted' }, byUnit.get(u)?.role ?? ''), h('td', { colspan: '3', class: 'muted' }, 'alone'), h('td', {}, h('button', { class: 'mini', onclick: () => ctx.setExcluded(u, true) }, '✕')))),
      ),
    ),
    benched.length
      ? h(
          'div',
          { class: 'small' },
          'Not deployed: ',
          ...benched.flatMap((u, i) => [
            i ? ', ' : '',
            ctx.excluded.has(u) ? h('button', { class: 'linkish', title: 'Let the solver deploy it again', onclick: () => ctx.setExcluded(u, false) }, `${name(u)} (dropped)`) : name(u),
          ]),
        )
      : null,
  );
}

/** Loadouts (#121): each deployed unit's weapons for this map from its inventory and the convoy, then its other items. */
function loadouts(
  d: ReturnType<typeof suggestDeployment>,
  byUnit: ReadonlyMap<RosterUnit, DeployCandidate>,
  snap: Snapshot | undefined,
  foes: readonly Foe[],
  pool: (f: Foe) => readonly string[],
  gender: Run['roster']['run']['gender'],
): HTMLElement {
  const backOf = new Map(d.pairs.map((p) => [p.lead, p.back]));
  const rows = d.deployed.flatMap((u) => {
    const c = byUnit.get(u);
    const s = snap?.units[u];
    if (!c || !s) return [];
    const back = backOf.get(u);
    const l = suggestLoadout(c, back ? byUnit.get(back) : undefined, s.inventory, snap?.convoy ?? [], foes, pool);
    return [h('tr', {}, h('td', {}, unitName(u, gender)), h('td', {}, l.items.map((i) => `${i.item}${i.from === 'convoy' ? ' (convoy)' : ''}${i.foes ? ` ·${i.foes}` : ''}`).join(', ') || '—'))];
  });
  return h(
    'details',
    { ...guide('prep-loadouts') },
    h('summary', {}, 'Loadouts'),
    h('p', { class: 'muted small' }, 'The weapons that win its matchups (·how many foes each is best against), convoy weapons of a kind it already uses, then its other items.'),
    h('table', { class: 'grid small' }, h('tbody', {}, ...rows)),
  );
}

export function prepPage(ctx: PrepContext): HTMLElement[] {
  const { engine, run } = ctx;
  const m = engine.maps().find((x) => x.id === ctx.map)!;
  const difficulty = run.roster.run.difficulty ?? 'normal';
  const table: ChapterDifficulty = difficulty === 'lunatic-plus' ? 'lunatic' : difficulty;
  const lplus = difficulty === 'lunatic-plus';
  const pool = lplus ? engine.lunaticPlusPool(m) : [];
  // Skills recorded on a Lunatic+ foe replace the pool's worst case for it (#120).
  const seen = run.seen?.[m.id] ?? {};
  const foes = foesOf(m, table, lplus).map((f) => (seen[foeKey(f)] ? { ...f, skills: [...new Set([...f.skills, ...seen[foeKey(f)]!])] } : f));
  const poolFor = (f: Foe) => (seen[foeKey(f)] ? [] : pool);
  const foe = foes[Math.min(ctx.foe, foes.length - 1)];
  const snap = latestEntry(run)?.snapshot;
  const gender = run.roster.run.gender;
  const units = (Object.entries(snap?.units ?? {}) as [RosterUnit, UnitSnapshot][]).filter(([u]) => run.roster.states[u] !== 'dead' && snap?.states[u] !== 'dead');
  // Deployment (#121): the solver's pick within the deploy count, the player's backs and drops kept.
  const candidates: DeployCandidate[] = units.flatMap(([unit, u]) => {
    const f = fighterOf(unitName(unit, gender), u);
    return f ? [{ unit, role: ctx.roleOf(unit), fighter: f.fighter, weapons: f.weapons, supports: u.supports }] : [];
  });
  const byUnit = new Map(candidates.map((c) => [c.unit, c]));
  const nameToUnit = new Map(units.map(([x]) => [unitName(x, gender), x]));
  const forced = m.forced.flatMap((n) => {
    const u = nameToUnit.get(n) ?? nameToUnit.get(`${n} (${gender ?? ''})`);
    return u ? [u] : [];
  });
  const pinned = (Object.entries(ctx.backs) as [RosterUnit, RosterUnit | 'none'][]).map(([lead, back]) => ({ lead, back: back === 'none' ? undefined : back }));
  const deployment = suggestDeployment({
    candidates,
    forced,
    max: deployMax(m.conditions[table]?.deploy ?? '') || candidates.length,
    foes,
    pool: poolFor,
    pinned,
    excluded: ctx.excluded,
  });
  const lineup = [...deployment.pairs.map((p) => ({ unit: p.lead, backId: p.back })), ...deployment.solo.map((unit) => ({ unit, backId: undefined as RosterUnit | undefined }))];
  const rows = lineup.flatMap(({ unit, backId }) => {
    const c = byUnit.get(unit);
    const u = snap?.units[unit];
    if (!c || !u || !foe) return [];
    const back = backId ? byUnit.get(backId)?.fighter : undefined;
    const support = backId ? (u.supports.find((s) => s.partner === backId)?.rank ?? null) : null;
    const best = c.weapons.length ? bestWeapon(c.fighter, c.weapons, back, support, foe, poolFor(foe)) : undefined;
    return [{ unit, u, backId, best }];
  });
  const cell = (ok: boolean, text: string, title?: string) => h('td', { class: ok ? 'pos' : 'neg', title }, text);
  const row = (r: (typeof rows)[number]) => {
    const res: Matchup | undefined = r.best?.result;
    const backSelect = r.backId ? unitName(r.backId, gender) : '—';
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
      threats(m, foes, table),
      dangers(units, foes, pool, seen, gender),
      lplus ? checklist(ctx, foes, pool, seen) : null,
      deploymentSection(ctx, deployment, byUnit, units, gender),
      loadouts(deployment, byUnit, snap, foes, poolFor, gender),
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
