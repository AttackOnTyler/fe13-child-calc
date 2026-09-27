import { describe, expect, it } from 'vitest';
import { EMPTY_ROSTER, addEntry, createEngine, editEntry, latestEntry, runFromRoster, withRun, type Milestone, type Plan, type Run, type SupportLevel, type UnitSnapshot } from './index';

/**
 * The roadmap's milestones (#194), through the facade: derived from a plan (the seed's, or one edited by hand) and the
 * chapter log, in the order their events fall on the map order.
 */
const engine = createEngine();
const facts = withRun(EMPTY_ROSTER, { route: 'main-story', difficulty: 'normal', gender: 'M', asset: 'mag', flaw: 'hp' });
const fresh = runFromRoster(facts);
const order = engine.mapOrder(fresh).steps.map((s) => s.map);
const pins = [{ kind: 'marriage', couple: ['chrom', 'sumia'] }, { kind: 'marriage', couple: ['stahl', 'sully'] }] as const;
const plan = engine.seedPlan(fresh, { pins });
const all = engine.milestones(fresh, plan);
const byId = (ms: readonly Milestone[], id: string) => ms.find((m) => m.id === id);

const unit = (cls: string, level: number, supports: { partner: 'sully' | 'stahl'; rank: SupportLevel }[] = []): UnitSnapshot => ({
  class: cls,
  level,
  promoted: false,
  reclassed: false,
  exp: 0,
  stats: { hp: 30, str: 15, mag: 1, skl: 15, spd: 15, lck: 10, def: 12, res: 4 },
  skills: [],
  inventory: [{ item: 'Iron Lance', uses: 45 }],
  supports,
});
/** Played through `last` (the log's entries otherwise empty), with these units in the latest entry. */
const playedThrough = (last: string, units: Partial<Record<string, UnitSnapshot>>): Run => {
  const run = order.slice(0, order.indexOf(last) + 1).reduce((r, m, i) => addEntry(r, m, i + 1), fresh);
  return editEntry(run, latestEntry(run)!.id, (s) => ({ ...s, units: { ...s.units, ...units } }), 1);
};

describe('support milestones (#194)', () => {
  it('makes Chrom’s wife win the game’s Chapter 11 rule, fixed at its end: a C with him viewed before Chapter 11', () => {
    const m = byId(all, 'support:chrom+sumia');
    // The wedding makes it an S: no S needed before it.
    expect(m).toMatchObject({ kind: 'support', rank: 'S', fixed: true, nonStarter: false, units: ['chrom', 'sumia'], at: { key: 'chapter-11', when: 'end' } });
    if (m?.kind !== 'support') throw new Error('no support milestone');
    expect(m.wedding).toEqual({ needs: 'viewed-c', rivals: ['sully', 'maribelle', 'olivia'] });
    const { earliest, latest, deadline, maps } = m.window;
    // Viewed on the world map before Chapter 11: reached by the end of the map before it.
    expect(deadline).toMatchObject({ key: 'chapter-11', when: 'start' });
    expect(maps).toBe(engine.supportCurve('chrom', 'sumia')!.mapsTo.C);
    expect(latest!.index).toBe(deadline.index - maps);
    expect(earliest!.index).toBeLessThanOrEqual(latest!.index);
  });

  it('lets Olivia win Chrom’s wedding on Chapter 11 itself: 2 points there, with no other candidate’s C viewed', () => {
    const olivia = engine.seedPlan(fresh, { pins: [{ kind: 'marriage', couple: ['chrom', 'olivia'] }] });
    const m = byId(engine.milestones(fresh, olivia), 'support:chrom+olivia');
    expect(m).toMatchObject({ kind: 'support', rank: 'S', fixed: true, nonStarter: false, at: { key: 'chapter-11', when: 'end' } });
    if (m?.kind !== 'support') throw new Error('no support milestone');
    expect(m.wedding).toEqual({ needs: 'olivia-points', rivals: ['sumia', 'sully', 'maribelle'] });
    expect(m.window).toMatchObject({ earliest: { key: 'chapter-11' }, latest: { key: 'chapter-11' }, deadline: { key: 'chapter-11', when: 'end' }, maps: 1 });
    // A C with Sumia already viewed shuts her out.
    const chrom = { ...unit('Lord', 10), supports: [{ partner: 'sumia' as const, rank: 'C' as const }] };
    const run = playedThrough('chapter-5', { chrom: chrom as UnitSnapshot });
    const late = byId(engine.milestones(run, engine.seedPlan(run, { pins: [{ kind: 'marriage', couple: ['chrom', 'olivia'] }] })), 'support:chrom+olivia');
    expect(late).toMatchObject({ nonStarter: true, wedding: { shutOutBy: ['sumia'] } });
  });

  it('puts a couple’s deadline at its child’s paralogue entry, and detects a non-starter', () => {
    expect(byId(all, 'support:stahl+sully')).toMatchObject({ fixed: false, nonStarter: false, at: { key: 'paralogue-8', when: 'start' }, children: ['kjelle'] });
    // Played through Chapter 12 with no support between them: Paralogue 8 comes too soon for the pair's curve.
    const late = playedThrough('chapter-12', { sully: unit('Cavalier', 15), stahl: unit('Cavalier', 15) });
    // On the route's template order (the seed moves Paralogue 8 later to fix it, #199).
    const seeded = engine.seedPlan(late, { pins: [pins[1]] });
    const template = { ...seeded, roadmap: { ...seeded.roadmap, order: engine.mapOrder(late).steps.map((s) => s.key) } };
    const m = byId(engine.milestones(late, template), 'support:stahl+sully');
    expect(m).toMatchObject({ nonStarter: true, at: { key: 'paralogue-8' } });
    expect(byId(engine.milestones(late, seeded), 'support:stahl+sully')).toMatchObject({ nonStarter: false, at: { key: 'paralogue-8' } });
    if (m?.kind !== 'support') throw new Error('no support milestone');
    expect(m.window.earliest?.key).toBe('chapter-13');
    expect(m.window.latest).toBeUndefined();
    // Already at A, the pair needs only the maps from A to S: it can still make it.
    const atA = playedThrough('chapter-12', { sully: unit('Cavalier', 15, [{ partner: 'stahl', rank: 'A' }]), stahl: unit('Cavalier', 15, [{ partner: 'sully', rank: 'A' }]) });
    const a = byId(engine.milestones(atA, engine.seedPlan(atA, { pins: [pins[1]] })), 'support:stahl+sully');
    expect(a).toMatchObject({ nonStarter: false });
    if (a?.kind !== 'support') throw new Error('no support milestone');
    expect(a.window.maps).toBeLessThan(m.window.maps);
  });
});

describe('skill and recruitment milestones (#194)', () => {
  it('names each parent’s pass at the child’s paralogue entry, and recruits the child there before the lineup that needs it', () => {
    const kjelle = plan.wishlist.children.find((c) => c.child === 'kjelle')!;
    expect(byId(all, 'recruit:kjelle')).toMatchObject({ kind: 'recruit', child: 'kjelle', parents: ['sully', 'stahl'], at: { key: 'paralogue-8' } });
    expect(byId(all, `skill:sully:${kjelle.passes[0]}:pass:kjelle`)).toMatchObject({ kind: 'skill', unit: 'sully', for: { kind: 'pass', child: 'kjelle' }, at: { key: 'paralogue-8' } });
    if (plan.wishlist.units.some((u) => u.unit === 'kjelle')) expect(byId(all, 'recruit:kjelle')).toMatchObject({ needed: { key: plan.wishlist.endpoint } });
    // Chrom's Aether is a fixed pass: nothing to plan. Sumia's pass is.
    expect(all.some((m) => m.id.startsWith('skill:chrom:') && m.id.endsWith(':pass:lucina'))).toBe(false);
    expect(all.some((m) => m.id.startsWith('skill:sumia:') && m.id.endsWith(':pass:lucina'))).toBe(true);
  });

  it('flags a wasted pass: a skill the child already has, or the same skill from both parents', () => {
    const withPasses = (passes: Plan['wishlist']['children'][number]['passes']): Plan => ({
      ...plan,
      wishlist: { ...plan.wishlist, children: plan.wishlist.children.map((c) => (c.child === 'kjelle' ? { ...c, passes } : c)) },
    });
    // Kjelle starts as a Knight with Defence +2.
    const has = engine.milestones(fresh, withPasses(['defence-plus-2', 'luna']));
    expect(byId(has, 'skill:sully:defence-plus-2:pass:kjelle')).toMatchObject({ wasted: 'child-has' });
    expect(byId(has, 'skill:stahl:luna:pass:kjelle')).not.toHaveProperty('wasted');
    const both = engine.milestones(fresh, withPasses(['luna', 'luna']));
    expect(byId(both, 'skill:sully:luna:pass:kjelle')).not.toHaveProperty('wasted');
    expect(byId(both, 'skill:stahl:luna:pass:kjelle')).toMatchObject({ wasted: 'both-parents' });
  });

  it('asks for each build skill not yet learned by the endpoint, with a class that teaches it', () => {
    const builds = all.filter((m) => m.kind === 'skill' && m.for.kind === 'build');
    expect(builds.length).toBeGreaterThan(0);
    for (const m of builds) {
      if (m.kind !== 'skill') continue;
      expect(m.at.key).toBe(plan.wishlist.endpoint);
      expect(plan.wishlist.units.find((u) => u.unit === m.unit)!.build).toContain(m.skill);
    }
    // Lucina joins with her Lord skills and Chrom's Aether: none of those is a milestone.
    for (const s of ['dual-strike-plus', 'charm', 'aether']) expect(byId(all, `skill:lucina:${s}:build`)).toBeUndefined();
    expect(byId(all, 'skill:frederick:luna:build')).toMatchObject({ learn: { classId: 'great-knight', level: 5, className: 'Great Knight' } });
  });
});

describe('class-reached milestones (#194)', () => {
  // Played through Chapter 9: Paralogue 4, then Chapters 10, 11 and 12 before the armory sells Master Seals.
  const run = playedThrough('chapter-9', { vaike: unit('Fighter', 15), sully: unit('Cavalier', 15), stahl: unit('Cavalier', 15) });
  const seeded = engine.seedPlan(run);
  const planned: Plan = {
    ...seeded,
    roadmap: {
      ...seeded.roadmap,
      seals: [
        { unit: 'vaike', classId: 'warrior', seal: 'master', key: 'chapter-11' },
        { unit: 'sully', classId: 'paladin', seal: 'master', key: 'chapter-12' },
        { unit: 'stahl', classId: 'paladin', seal: 'master', key: 'chapter-11' },
      ],
    },
  };
  const ms = engine.milestones(run, planned);

  it('names its seal and where it comes from, flagging a seal play can lose', () => {
    // The first seal in hand is Chapter 10's, carried by an escaping Thief.
    expect(byId(ms, 'class:vaike:warrior')).toMatchObject({ kind: 'class', className: 'Warrior', seal: 'master', at: { key: 'chapter-11' }, source: { how: 'found', at: { key: 'chapter-10', when: 'end' } } });
    expect(byId(ms, 'class:vaike:warrior')!).toHaveProperty('risk', expect.stringContaining('escaping Thief'));
    // Chapter 11's Hero drops the next, in time for Chapter 12: sure.
    expect(byId(ms, 'class:sully:paladin')).toMatchObject({ source: { how: 'found', at: { key: 'chapter-11' } } });
    expect(byId(ms, 'class:sully:paladin')).not.toHaveProperty('risk');
    // Two changes by Chapter 11 but one seal: the other has none in hand.
    expect(byId(ms, 'class:stahl:paladin')).toMatchObject({ source: { how: 'none' }, risk: 'No Master Seal is in hand by Chapter 11.' });
  });

  it('takes the seals found in deadline order, then an armory once one sells them', () => {
    const byCh13 = (...more: Plan['roadmap']['seals']): Plan => ({
      ...planned,
      roadmap: { ...planned.roadmap, seals: [{ unit: 'stahl', classId: 'paladin', seal: 'master', key: 'chapter-13' }, ...planned.roadmap.seals.filter((s) => s.unit !== 'stahl'), ...more] },
    });
    // Stahl's deadline is now the latest: the seals found in Chapters 10 and 11 go first, and Chapter 12's Paladin drops his.
    expect(byId(engine.milestones(run, byCh13()), 'class:stahl:paladin')).toMatchObject({ at: { key: 'chapter-13' }, source: { how: 'found', at: { key: 'chapter-12' } } });
    // One more by Chapter 13, and no seal found is left: Port Ferox sells them in Chapter 13's preparations.
    const more = engine.milestones(run, byCh13({ unit: 'ricken', classId: 'sage', seal: 'master', key: 'chapter-13' }));
    expect(byId(more, 'class:ricken:sage')).toMatchObject({ source: { how: 'armory', at: { key: 'chapter-13', when: 'start' } } });
    expect(byId(more, 'class:ricken:sage')).not.toHaveProperty('risk');
  });
});

describe('the milestones’ order (#194)', () => {
  it('orders by where each event falls, preconditions first within one event', () => {
    const at = (ms: readonly Milestone[]) => ms.map((m) => m.at.index * 2 + (m.at.when === 'end' ? 1 : 0));
    expect(at(all)).toEqual([...at(all)].sort((a, b) => a - b));
    // At Paralogue 8's entry: the support, then each parent's skill in the last slot, then the recruit.
    expect(all.filter((m) => m.at.key === 'paralogue-8').map((m) => m.kind)).toEqual(['support', 'skill', 'skill', 'recruit']);
    // Chrom's wedding at the end of Chapter 11 comes before Lucina's entry at the start of Chapter 13.
    const ids = all.map((m) => m.id);
    expect(ids.indexOf('support:chrom+sumia')).toBeLessThan(ids.indexOf('recruit:lucina'));
    // At the endpoint: class changes before the build skills they teach.
    const end = all.filter((m) => m.at.key === plan.wishlist.endpoint).map((m) => m.kind);
    expect(end.lastIndexOf('class')).toBeLessThan(end.indexOf('skill'));
  });

  it('gives each milestone a stable id, the same for the same plan and record', () => {
    const ids = all.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(engine.milestones(fresh, plan)).toEqual(all);
    expect(JSON.parse(JSON.stringify(all))).toEqual(all);
  });
});
