/**
 * The preparation page (#119): the next map's matchup table. Each lead from the latest entry, or joining on the map
 * from its start (#131), paired with its back (its highest support by default), with its best weapon from its
 * inventory, against one foe at a time on the run's difficulty. Lunatic+ assumes the pool's worst case.
 */
import type { ChapterDifficulty, Couple, Difficulty, Engine, FlawlessOptions, Foe, Matchup, PrepUnits, RosterUnit, Run, ShoppingLine, SimGroup, Snapshot } from '../engine';
import { EMPTY_SNAPSHOT, KIT_FORGE_MT, REINFORCEMENT_RULE, bestWeapon, dangerFlags, deployCount, fighterOf, foeKey, foesOf, forcedOn, latestEntry, prepUnits, promotionAdvice, sealAvailability, sealsHeld, simLineup, suggestDeployment, suggestLoadout, unitName, withSeenSkills, type DeployCandidate, type DeploymentRole } from '../engine';
import { chanceText } from './chance';
import { goldRange, goldText } from './run-page';
import { CHILD_UNITS } from '../game-data/children';
import { ROBIN_GROWTHS } from '../game-data/robin';
import { STATS, STAT_LABELS, type Stat } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { h } from './dom';
import { guide } from './guide';
import { howToRun } from './maps-page';

export type PrepContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly map: string;
  readonly close: () => void;
  readonly setRun: (run: Run) => void;
  /** The back chosen for each lead (view state); absent: its highest support. */
  readonly backs: Readonly<Partial<Record<RosterUnit, RosterUnit | 'none'>>>;
  readonly setBack: (lead: RosterUnit, back: RosterUnit | 'none') => void;
  /** Makes a pair's back its lead, with the old lead as its back (#133). */
  readonly swap: (lead: RosterUnit, back: RosterUnit) => void;
  readonly foe: number;
  readonly setFoe: (i: number) => void;
  /** Each unit's deployment role: army fit's for children, the roster's tag otherwise (#121). */
  readonly roleOf: (u: RosterUnit) => DeploymentRole;
  /** The plan's marriages, as the Run view passes them to the flawless chance: the shopping list runs the same simulation (#190). */
  readonly marriages?: () => readonly Couple[];
  /** Units the player took out of the deployment (view state). */
  readonly excluded: ReadonlySet<RosterUnit>;
  readonly setExcluded: (u: RosterUnit, out: boolean) => void;
};

/** A recorded unit as a fighter (the engine's: the flawless chance builds its army the same way). */
export { fighterOf };

/** The seed the preparation page plays the map with: the same page always shows the same chance. */
const PREP_SEED = 1;
/** Lunatic+ runs to average the drawn skills over, when a foe's weren't recorded. */
const LPLUS_RUNS = 16;

const LEAN = { high: 'may read high', low: 'may read low', either: 'either way' } as const;

/**
 * The next map's no-death chance (#181): the map played turn by turn with this deployment and the latest recorded
 * stats, in the spec's wording, with how the play ended and the blind spots it rests on.
 */
export function noDeathReadout(engine: Engine, map: string, difficulty: Difficulty, lineup: readonly SimGroup[], seen: Readonly<Record<string, readonly string[]>> = {}): { readonly text: string; readonly detail: string } {
  if (!lineup.length) return { text: 'No-death chance: record your units’ stats in the chapter log to see it.', detail: '' };
  const input = { map: engine.simMap(map, difficulty, { seen }), lineup };
  const drawn = input.map.foes.some((f) => f.pool?.length) || input.map.waves.some((w) => w.groups.some((g) => g.pool?.length));
  const runs = drawn ? LPLUS_RUNS : 1;
  const chance = engine.mapNoDeath(input, PREP_SEED, runs);
  const play = engine.playMap(input, PREP_SEED);
  const turns = `${play.turns} turn${play.turns === 1 ? '' : 's'}`;
  const end = play.ended === 'rout' ? `a rout in ${turns}` : play.ended === 'boss' ? `the boss falls on turn ${play.turns}` : `the army can’t finish the map (${turns} played)`;
  const spots = engine.blindSpots().filter((b) => (play.blindSpots as readonly string[]).includes(b.id));
  return {
    text: `No-death chance: ${chanceText(chance)}`,
    detail:
      `Played turn by turn with this deployment and your latest stats: ${end}.` +
      (runs > 1 ? ` Lunatic+ skills not yet recorded are drawn from the pool, over ${runs} runs.` : '') +
      (input.map.skipped.length ? ` Waves not played (set off by an event): ${input.map.skipped.join('; ')}.` : '') +
      ` Rests on: ${spots.map((b) => `${b.label.toLowerCase()} (${LEAN[b.lean]})`).join(', ')}.`,
  };
}

/** Threats (#120):the map's enemy groups and boss on this difficulty, what sets them moving, and reinforcements. */
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
function dangers(units: PrepUnits['units'], foes: readonly Foe[], pool: readonly string[], seen: Readonly<Record<string, readonly string[]>>, gender: Run['roster']['run']['gender']): HTMLElement {
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

/**
 * Deployment and pairs (#121): the solver's pick; a back picked or a unit dropped recomputes it. Units on the map from
 * its start are marked, and recruits who come later are listed with when (#131). A forced unit can't be dropped.
 */
function deploymentSection(
  ctx: PrepContext,
  d: ReturnType<typeof suggestDeployment>,
  byUnit: ReadonlyMap<RosterUnit, DeployCandidate>,
  prep: PrepUnits,
  gender: Run['roster']['run']['gender'],
): HTMLElement {
  const name = (u: RosterUnit) => unitName(u, gender);
  const { units } = prep;
  const unitCell = (u: RosterUnit) =>
    h(
      'td',
      {},
      name(u),
      prep.joining.includes(u) ? h('span', { class: 'chip small', title: 'Joins your army on this map, from its start' }, 'joins') : null,
      prep.mapOnly.includes(u) ? h('span', { class: 'chip small', title: 'Fielded with a setup used only on this map: it never joins your army' }, 'this map only') : null,
    );
  const drop = (u: RosterUnit) =>
    d.forced.includes(u) ? h('td', { class: 'muted small', title: 'The map fields it: it can’t be dropped' }, 'forced') : h('td', {}, h('button', { class: 'mini', title: 'Leave out of this map', onclick: () => ctx.setExcluded(u, true) }, '✕'));
  const benched = units.map(([u]) => u).filter((u) => !d.deployed.includes(u));
  // A unit alone picks a back the same way a lead does, and leads with it (#133).
  const backSelect = (lead: RosterUnit, back: RosterUnit | undefined) =>
    h(
      'select',
      { 'aria-label': `${name(lead)}’s back`, onchange: (e) => ctx.setBack(lead, (e.target as HTMLSelectElement).value as RosterUnit | 'none') },
      h('option', { value: 'none', selected: !back }, back ? '— no back' : '— alone'),
      ...units.filter(([x]) => x !== lead).map(([x]) => h('option', { value: x, selected: x === back }, name(x))),
    );
  return h(
    'details',
    { ...guide('prep-deployment'), open: true },
    h('summary', {}, `Deployment and pairs (${d.deployed.length} of ${d.max})`),
    h(
      'p',
      { class: 'muted small' },
      'Forced units first, then each lead with the back that covers the map best, then Staff/Rally and dancers, then whoever is left while there’s room. ' +
        'Pick a back (a unit alone leads with the one you pick), swap a pair with ⇅, or drop a unit that isn’t forced: everything recomputes.',
    ),
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
            unitCell(p.lead),
            h('td', { class: 'muted' }, byUnit.get(p.lead)?.role ?? ''),
            h(
              'td',
              {},
              backSelect(p.lead, p.back),
              p.back ? h('button', { class: 'mini', title: `Make ${name(p.back)} the lead`, onclick: () => ctx.swap(p.lead, p.back!) }, '⇅') : null,
            ),
            h('td', {}, p.support ?? '—'),
            h('td', { class: 'num' }, String(p.coverage)),
            drop(p.lead),
          ),
        ),
        ...d.solo.map((u) =>
          h(
            'tr',
            {},
            unitCell(u),
            h('td', { class: 'muted' }, byUnit.get(u)?.role ?? ''),
            h('td', {}, backSelect(u, undefined)),
            h('td', { colspan: '2' }),
            drop(u),
          ),
        ),
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
    prep.later.length
      ? h('div', { class: 'small muted' }, 'Joining later, not in the opening lineup: ', prep.later.map((l) => `${name(l.unit)} (${l.how ?? 'when is unknown'})`).join('; '))
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

const WHY: Readonly<Record<ShoppingLine['kind'], string>> = { rebuy: 'runs dry before the next armory', seal: 'for a promotion', kit: 'endpoint kit' };

/**
 * The shopping list for the next armory stop (#190): what the simulated runs buy there, in priority order (rebuys,
 * seals, the endpoint kit), each with the chance a run makes it, and the gold on arrival as a range.
 */
export function shoppingReadout(engine: Engine, run: Run, options?: FlawlessOptions): { readonly title: string; readonly note: string; readonly rows: readonly (readonly string[])[] } {
  const r = engine.flawlessChance(run, options);
  const stop = r.shopping[0];
  if (!stop) return { title: 'Shopping list', note: r.maps.length ? 'No simulated run reaches an open armory with nobody lost.' : 'The endpoint is recorded: nothing left to buy for.', rows: [] };
  const note =
    `Gold on arrival: ${goldRange(stop.gold)}${r.goldUnrecorded ? ' (your latest entry records no gold, read as none)' : ''}. ` +
    'What the simulated runs buy here, in priority order: rebuys for items that would run dry before the next armory, a seal when a promotion needs one and none is held, then at the endpoint the endpoint kit, dropping what wins fewest matchups per gold when gold runs short. Only Bullion is sold; merchants are random, so their stock isn’t counted.';
  const rows = stop.lines.map((l) => [
    l.name,
    `${l.action === 'forge' ? `Forge ${l.item} to +${KIT_FORGE_MT} Mt` : `Buy ${l.item}`} (${WHY[l.kind]})`,
    goldText(l.cost),
    chanceText(l.share, { miss: 'skipped', make: 'made' }),
  ]);
  return { title: `Shopping list: ${stop.label}`, note, rows };
}

type Shopping = ReturnType<typeof shoppingReadout>;

/** Shopping lists already worked out, by run (a run is replaced, never edited). */
const SHOPPING = new WeakMap<Run, Shopping>();

/** The shopping list section (#190): it runs the simulation, so the page renders first and the list fills in after. */
function shopping(ctx: PrepContext): HTMLElement {
  const draw = (s: Shopping | undefined) =>
    h(
      'details',
      { ...guide('prep-supply'), open: true },
      h('summary', {}, s?.title ?? 'Shopping list: working it out…'),
      s ? h('p', { class: 'muted small' }, s.note) : null,
      s?.rows.length
        ? h(
            'table',
            { class: 'grid small' },
            h('thead', {}, h('tr', {}, ...['For', 'Do', 'Cost', 'Chance it’s made'].map((t) => h('th', {}, t)))),
            h('tbody', {}, ...s.rows.map((row) => h('tr', {}, ...row.map((c, i) => h('td', i === 2 ? { class: 'num' } : {}, c))))),
          )
        : s
          ? h('p', { class: 'muted small' }, 'Nothing to buy here.')
          : null,
    );
  const done = SHOPPING.get(ctx.run);
  if (done) return draw(done);
  const el = draw(undefined);
  const run = ctx.run;
  setTimeout(() => {
    if (!el.isConnected) return;
    const s = SHOPPING.get(run) ?? shoppingReadout(ctx.engine, run, { roleOf: ctx.roleOf, ...(ctx.marriages ? { marriages: ctx.marriages() } : {}) });
    SHOPPING.set(run, s);
    if (el.isConnected) el.replaceWith(draw(s));
  }, 0);
  return el;
}

/** Seals and promotions (#122): when seals can be bought, how many are held, and promote now or later. */
function seals(
  ctx: PrepContext,
  d: ReturnType<typeof suggestDeployment>,
  byUnit: ReadonlyMap<RosterUnit, DeployCandidate>,
  snap: Snapshot | undefined,
  foes: readonly Foe[],
  pool: (f: Foe) => readonly string[],
  gender: Run['roster']['run']['gender'],
  mapOnly: readonly RosterUnit[],
): HTMLElement {
  const cleared = new Set(ctx.run.entries.map((e) => e.map));
  const avail = sealAvailability(cleared);
  const held = sealsHeld([...(snap?.convoy ?? []), ...Object.values(snap?.units ?? {}).flatMap((u) => u?.inventory ?? [])]);
  const growthsOf = (u: RosterUnit): Readonly<Record<Stat, number>> | undefined =>
    u === 'robin' ? ROBIN_GROWTHS : u in CHILD_UNITS ? CHILD_UNITS[u as keyof typeof CHILD_UNITS].growths : (FIRST_GEN_UNITS[u as UnitId]?.growths as Record<Stat, number> | undefined);
  const genderOf = (u: RosterUnit) => (u === 'robin' ? (gender ?? 'M') : u in CHILD_UNITS ? CHILD_UNITS[u as keyof typeof CHILD_UNITS].gender : FIRST_GEN_UNITS[u as UnitId].gender);
  // A setup used only on this map (Premonition's) is never promoted.
  const advice = d.deployed.flatMap((u) => {
    if (mapOnly.includes(u)) return [];
    const c = byUnit.get(u);
    const s = snap?.units[u];
    if (!c || !s) return [];
    const growths = growthsOf(u);
    const a = promotionAdvice({ c, level: s.level, promoted: s.promoted, gender: genderOf(u) as 'M' | 'F', personalGrowths: growths && 'hp' in growths ? growths : undefined, foes, pool, seals: avail, held: held.master });
    return a ? [a] : [];
  });
  return h(
    'details',
    { ...guide('prep-seals') },
    h('summary', {}, 'Seals and promotions'),
    h('p', { class: 'small' }, `${avail.note} Held: ${held.master} Master, ${held.second} Second.`),
    advice.length
      ? h(
          'table',
          { class: 'grid small' },
          h('thead', {}, h('tr', {}, ...['Unit', 'Promote to', 'When', 'Why', 'Expected at 20, then promoted'].map((t) => h('th', {}, t)))),
          h(
            'tbody',
            {},
            ...advice.map((a) =>
              h(
                'tr',
                {},
                h('td', {}, a.unit),
                h('td', {}, a.to),
                h('td', { class: a.advice === 'now' ? 'pos' : '' }, a.advice === 'now' ? 'Now' : a.advice === 'later' ? 'Later' : 'Not yet'),
                h('td', {}, a.why),
                h('td', { class: 'muted', title: 'Expected: average growths, not the unit’s real stats' }, a.expected ? `expected: ${STATS.map((s) => `${STAT_LABELS[s]} ${a.expected![s]}`).join(' · ')}` : '—'),
              ),
            ),
          ),
        )
      : h('p', { class: 'muted small' }, 'No deployed unit is in a base class.'),
    h('p', { class: 'muted small' }, 'Expected stats use average growths (the unit’s personal growths plus its class’s): a guide to “now or later”, not its real stats.'),
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
  const gender = run.roster.run.gender;
  // The army, plus the recruits on this map from its start (#131): every section reads this snapshot.
  const prep = prepUnits(run, m.id);
  const { units } = prep;
  const latest = latestEntry(run)?.snapshot ?? EMPTY_SNAPSHOT;
  const snap: Snapshot = { ...latest, units: { ...latest.units, ...Object.fromEntries(units) } };
  // Units on the map from its start are always fielded; the slots a map adds for them count (#131).
  const opening = [...prep.joining, ...prep.mapOnly];
  // Deployment (#121): the solver's pick within the deploy count, the player's backs and drops kept.
  const candidates: DeployCandidate[] = units.flatMap(([unit, u]) => {
    const f = fighterOf(unitName(unit, gender), u);
    return f ? [{ unit, role: ctx.roleOf(unit), fighter: f.fighter, weapons: f.weapons, items: f.items, supports: u.supports }] : [];
  });
  const byUnit = new Map(candidates.map((c) => [c.unit, c]));
  const pinned = (Object.entries(ctx.backs) as [RosterUnit, RosterUnit | 'none'][]).map(([lead, back]) => ({ lead, back: back === 'none' ? undefined : back }));
  const deployment = suggestDeployment({
    candidates,
    forced: [...forcedOn(m.id), ...opening],
    max: deployCount(m.conditions[table]?.deploy ?? '', opening.map((u) => unitName(u))) || candidates.length,
    foes,
    pool: poolFor,
    pinned,
    excluded: ctx.excluded,
  });
  // The next map's no-death chance (#181): this deployment, played turn by turn.
  const noDeath = noDeathReadout(engine, m.id, difficulty, simLineup(deployment, byUnit), seen);
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
        h('div', { class: 'muted small' }, `${difficulty === 'lunatic-plus' ? 'Lunatic+' : table} · ${[`stats from your latest entry`, prep.joining.length ? 'join data for units joining here' : '', prep.mapOnly.length ? 'the map’s own setup for units fielded only here' : ''].filter(Boolean).join(', ')} · no movement planning`),
      ),
      h('div', { class: 'no-death' }, h('b', {}, noDeath.text), noDeath.detail ? h('p', { class: 'muted small' }, noDeath.detail) : null),
      threats(m, foes, table),
      dangers(units, foes, pool, seen, gender),
      lplus ? checklist(ctx, foes, pool, seen) : null,
      deploymentSection(ctx, deployment, byUnit, prep, gender),
      loadouts(deployment, byUnit, snap, foes, poolFor, gender),
      shopping(ctx),
      seals(ctx, deployment, byUnit, snap, foes, poolFor, gender, prep.mapOnly),
      howToRun(ctx.engine, m.id),
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
