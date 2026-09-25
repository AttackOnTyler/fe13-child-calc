// PROTOTYPE — throwaway (#81). Page models for a first-gen unit, Robin (preview) and a child front door, read from
// the real game data and engine. Build coverage is a naive slot count, not the engine's matcher; opinion is a
// hand-written stub of Ellery (S10) from research/ellery on research/ellery-roles, corrected by research/ellery-claims.
import { BUILD_TEMPLATES } from '../../curated/builds';
import { createEngine } from '../../engine';
import type { ChildResult, ParentRef } from '../../engine/types';
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import { CLASSES, DLC_RECLASS_TARGETS, PROMOTES_TO, allowsGender, regularClasses, type ClassId } from '../../game-data/classes';
import { CLASS_SKILLS, DLC_SKILL_BOOKS, SKILLS, type SkillId } from '../../game-data/skills';
import type { Gender, Stat } from '../../game-data/stats';
import { ROBIN_SUPPORTS, S_SUPPORTS } from '../../game-data/supports';
import { FIRST_GEN_UNITS, type UnitId } from '../../game-data/units';
import { DEFAULT_PREFS, scoreSettingsOf } from '../../ui/scoring-prefs';

export const engine = createEngine();
export const scoring = engine.score(scoreSettingsOf(DEFAULT_PREFS, engine));
export const presetName = engine.presets().find((p) => p.id === DEFAULT_PREFS.preset)?.name ?? DEFAULT_PREFS.preset;
const ALL = engine.pairings();

export type Ctx = 'main-story' | 'apotheosis';
export const CTX_NAME: Record<Ctx, string> = { 'main-story': 'Main story', apotheosis: 'Apotheosis' };

// ---------- classes and skills ----------

export type ClassRow = { id: ClassId; name: string; tier: string; from?: string; skills: { id: SkillId; name: string; level: number; inheritable: boolean }[] };

export const skillName = (id: SkillId) => SKILLS[id].name;

export function reachable(set: readonly ClassId[], gender: Gender): ClassRow[] {
  const rows: ClassRow[] = [];
  const seen = new Set<ClassId>();
  const add = (id: ClassId, from?: string) => {
    if (seen.has(id) || !allowsGender(id, gender)) return;
    seen.add(id);
    const skills = ((CLASS_SKILLS as Record<string, readonly { skill: SkillId; level: number }[]>)[id] ?? []).map((s) => ({
      id: s.skill,
      name: skillName(s.skill),
      level: s.level,
      inheritable: SKILLS[s.skill].inheritable,
    }));
    rows.push({ id, name: engine.className(id, gender), tier: CLASSES[id].tier, ...(from ? { from } : {}), skills });
  };
  for (const c of set) {
    add(c);
    for (const p of (PROMOTES_TO as Record<string, readonly ClassId[]>)[c] ?? []) add(p, engine.className(c, gender));
  }
  for (const d of DLC_RECLASS_TARGETS) add(d, 'DLC seal');
  return rows;
}

export function skillSet(rows: readonly ClassRow[], dlc: boolean): Set<SkillId> {
  const s = new Set<SkillId>();
  for (const r of rows) if (dlc || !CLASSES[r.id].dlc) r.skills.forEach((k) => s.add(k.id));
  if (dlc) DLC_SKILL_BOOKS.forEach((b) => s.add(b));
  return s;
}

// ---------- build coverage (naive: a slot is filled if any of its skills is reachable) ----------

export type Coverage = { id: string; name: string; tier: number; slots: { names: string; ok: boolean }[] };

export function coverage(skills: Set<SkillId>, ctx: Ctx): Coverage[] {
  return BUILD_TEMPLATES.filter((t) => t.contexts.includes(ctx))
    .map((t) => {
      const slots = t.slots.map((g) => ({ names: g.map(skillName).join(' / '), ok: g.some((k) => skills.has(k)) }));
      return { id: t.id, name: t.name, tier: slots.filter((s) => s.ok).length, slots };
    })
    .filter((c) => c.tier >= 3)
    .sort((a, b) => b.tier - a.tier);
}

// ---------- parents, partners, children ----------

type Who = { kind: 'unit'; id: UnitId } | { kind: 'robin'; gender: Gender; asset?: Stat; flaw?: Stat } | { kind: 'child'; id: ChildId };

const refIs = (r: ParentRef | undefined, w: Who): boolean => {
  if (!r) return false;
  if (w.kind === 'unit') return r.kind === 'unit' && r.id === w.id;
  if (w.kind === 'child') return r.kind === 'child' && r.id === w.id;
  return r.kind === 'robin' && r.gender === w.gender && (!w.asset || (r.asset === w.asset && r.flaw === w.flaw));
};
const isFixed = (res: ChildResult, w: Who): boolean => {
  const f = CHILD_UNITS[res.pairing.child].fixedParent;
  if (w.kind === 'unit') return f === w.id;
  if (w.kind === 'robin') return refIs(res.pairing.fixedRobin, w);
  return false;
};
const isVariable = (res: ChildResult, w: Who) => refIs(res.pairing.variableParent, w);

export const scoreOf = (res: ChildResult) => scoring.get(res.key).score;

export type ChildLine = { child: string; score: number | undefined; note?: string };
export type PartnerRow = { name: string; key: string; children: ChildLine[]; total: number; verdict?: Verdict; planned?: boolean; blocked?: string };

/** The children two parents produce: best pairing per child (over Robin's asset/flaw or a child partner's own parent). */
function childrenOf(a: Who, b: Who): ChildLine[] {
  const hits = ALL.filter((r) => (isFixed(r, a) && isVariable(r, b)) || (isFixed(r, b) && isVariable(r, a)));
  const byChild = new Map<string, ChildResult[]>();
  for (const h of hits) byChild.set(h.pairing.child, [...(byChild.get(h.pairing.child) ?? []), h]);
  return [...byChild].map(([child, rs]) => {
    const best = rs.reduce((x, y) => ((scoreOf(y) ?? -1) > (scoreOf(x) ?? -1) ? y : x));
    const note = rs.length > 1 ? `best of ${rs.length}: ${engine.parentName(best.pairing.variableParent)}${engine.robinLabel(best.pairing) ? ` ${engine.robinLabel(best.pairing)}` : ''}` : undefined;
    return { child: CHILD_UNITS[child as ChildId].name, score: scoreOf(best), ...(note ? { note } : {}) };
  });
}

// ---------- opinion (S10 stub) ----------

export type Verdict = { kind: 'recommended' | 'warned'; why: string };
export type Opinion = {
  ctx: Ctx;
  role: string;
  tier: string;
  classes: string[];
  loadout: SkillId[][];
  partners: { name: string; kind: 'recommended' | 'warned'; why: string }[];
  note: string;
  cite: string;
};
export const SOURCE = { id: 'S10', name: 'Ellery', kind: 'video creator', provenance: 'Gemini Notebook summaries of the videos, checked against game data (research/ellery-claims).' };

// ---------- subjects ----------

export type UnitPage = {
  kind: 'unit';
  key: string;
  name: string;
  gender: Gender;
  blurb: string;
  classSet: string[];
  modifiers: string;
  classes: ClassRow[];
  skills: Set<SkillId>;
  passes: { son: string[] | null; daughter: string[] | null };
  inheritable: string[];
  partners: PartnerRow[];
  opinion: Opinion[];
  preview?: { asset: Stat; flaw: Stat };
};

export type FrontDoor = {
  kind: 'child';
  key: string;
  name: string;
  gender: Gender;
  fixedParent: string;
  startClass: string;
  classSet: string[];
  growths: string;
  top: { label: string; score: number | undefined; mark?: Verdict }[];
  marked: { label: string; score: number | undefined; mark: Verdict }[];
  total: number;
  robinLine: string;
  opinion: Opinion[];
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const STAT_LABEL: Record<string, string> = { hp: 'HP', str: 'Str', mag: 'Mag', skl: 'Skl', spd: 'Spd', lck: 'Lck', def: 'Def', res: 'Res' };
const fmtStats = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${STAT_LABEL[k]} ${signed(v)}`).join(' · ');

const verdictFor = (ops: Opinion[], name: string): Verdict | undefined => {
  for (const o of ops) {
    const p = o.partners.find((x) => name.startsWith(x.name));
    if (p) return { kind: p.kind, why: `${p.why} (${CTX_NAME[o.ctx]})` };
  }
  return undefined;
};

// Lon'qu. Ellery's loadout used Skill +2 (an Archer skill Lon'qu can't reach; research/ellery-claims), so it's dropped.
const LONQU_OPINION: Opinion[] = [
  {
    ctx: 'main-story',
    role: 'Evasion dodge tank · player-phase Assassin',
    tier: 'A',
    classes: ['Assassin', 'Swordmaster', 'Trickster', 'Wyvern Lord'],
    loadout: [['avoid-plus-10'], ['vantage'], ['lethality'], ['pass'], ['quick-burn', 'swordbreaker']],
    partners: [
      { name: 'Miriel', kind: 'recommended', why: 'Spd/Mag pair-up both ways; Laurent gets Vantage and Dark Mage' },
      { name: 'Sully', kind: 'recommended', why: 'early Spd/Def synergy' },
      { name: 'Cordelia', kind: 'recommended', why: 'fast flier pair' },
    ],
    note: 'Low-investment dodge tank with C swords on join (Killing Edge, Levin Sword); an Assassin with bows gets past Counter and Aegis+.',
    cite: "Lon'qu is BETTER than you think…",
  },
  {
    ctx: 'apotheosis',
    role: 'Vantage father',
    tier: 'S (as a father)',
    classes: ['Swordmaster', 'Assassin'],
    loadout: [['vantage'], ['avoid-plus-10'], ['lethality'], ['swordfaire'], ['pass']],
    partners: [{ name: 'Miriel', kind: 'recommended', why: 'max-Spd Vantage + Vengeance + Wrath Laurent' }],
    note: 'Passes Vantage and a +3 Spd modifier to Laurent, Severa, Inigo or Owain without them grinding Myrmidon.',
    cite: 'FE Awakening’s 2nd Generation EXPLAINED in 1 Hour',
  },
];

const ROBIN_OPINION: Opinion[] = [
  {
    ctx: 'main-story',
    role: 'Carry: enemy-phase Nosferatu sweeper, player-phase nuke',
    tier: 'S ("best unit in FE history")',
    classes: ['Sorcerer', 'Sage', 'Dark Flier (F)', 'Grandmaster'],
    loadout: [['veteran'], ['tomefaire'], ['hex'], ['anathema'], ['galeforce', 'focus']],
    partners: [
      { name: 'Tharja', kind: 'recommended', why: 'M: top pick; Hex/Anathema, Dark Mage Morgan, Noire gets Galeforce + Dark Mage' },
      { name: 'Chrom', kind: 'recommended', why: 'F: god-tier Lucina and Morgan, though Sumia loses Chrom' },
      { name: 'Nowi', kind: 'recommended', why: 'M: dragon Morgan; Nah gets Galeforce + Dark Mage' },
    ],
    note: '+Mag / −Str is "objectively" best: Str is a dump stat for a magic Robin. +Spd is overrated; +Def is a beginner crutch.',
    cite: 'Why is Robin SO OVERPOWERED?',
  },
  {
    ctx: 'apotheosis',
    role: 'Rally bot / back',
    tier: 'S',
    classes: ['Grandmaster', 'Sorcerer'],
    loadout: [['rally-spectrum'], ['rally-strength'], ['rally-skill'], ['rally-defence'], ['solidarity']],
    partners: [],
    note: 'Children have higher caps, so Robin holds the rallies.',
    cite: "It's Time To Optimize Lunatic+ [Step 1: Team Building]",
  },
];

const NAH_OPINION: Opinion[] = [
  {
    ctx: 'main-story',
    role: '1–2 range Dragonstone tank → Sage / Wyvern',
    tier: 'skip without grinding',
    classes: ['Manakete', 'Sage', 'Wyvern Lord'],
    loadout: [['galeforce'], ['aptitude'], ['speed-plus-2'], ['tomefaire'], ['strength-plus-2']],
    partners: [
      { name: 'Robin (M)', kind: 'recommended', why: 'Galeforce + Dark Mage' },
      { name: 'Gaius', kind: 'recommended', why: 'Galedad: Fighter → Pegasus Knight, so Galeforce' },
      { name: 'Donnel', kind: 'recommended', why: 'Galedad (Villager → Pegasus Knight) and Aptitude' },
      { name: 'Frederick', kind: 'warned', why: '−Spd, no Faires on a unit already short on Spd' },
    ],
    note: 'Slow Manakete with no Galeforce or staves on join; a late paralogue (wait 10 turns for the Mire sorcerers to run dry).',
    cite: 'FE Awakening’s 2nd Generation EXPLAINED; Let’s Recruit Nah FOR REAL THIS TIME',
  },
  {
    ctx: 'apotheosis',
    role: 'Pair-up back (the back row hides her Spd) · first to bench',
    tier: 'B',
    classes: ['Wyvern Lord', 'Sage', 'Trickster'],
    loadout: [['strength-plus-2'], ['axefaire'], ['dual-guard-plus'], ['galeforce'], ['limit-breaker']],
    partners: [{ name: 'Robin (M)', kind: 'recommended', why: 'Galeforce + Dark Mage' }],
    note: 'Gerome and Yarne do her back-row job better, so she and Kjelle are the first children benched.',
    cite: "It's Time To Optimize Lunatic+ [Step 1: Team Building]",
  },
];

function unitPage(id: UnitId): UnitPage {
  const u = FIRST_GEN_UNITS[id];
  const classes = reachable(u.classes, u.gender);
  const skills = skillSet(classes, true);
  const partners: PartnerRow[] = [];
  const women = (Object.keys(S_SUPPORTS) as UnitId[]).filter((w) => S_SUPPORTS[w]!.includes(id));
  for (const w of women) partners.push(row(FIRST_GEN_UNITS[w].name, { kind: 'unit', id }, { kind: 'unit', id: w }, LONQU_OPINION));
  if ((ROBIN_SUPPORTS.F as readonly string[]).includes(id)) partners.push(row('Robin (F)', { kind: 'unit', id }, { kind: 'robin', gender: 'F' }, LONQU_OPINION));
  // Prototype stand-ins for the plan markers.
  const miriel = partners.find((p) => p.name === 'Miriel');
  if (miriel) miriel.planned = true;
  const sully = partners.find((p) => p.name === 'Sully');
  if (sully) sully.blocked = 'married to Frederick';
  return {
    kind: 'unit',
    key: id,
    name: u.name,
    gender: u.gender,
    blurb: 'First-gen · Myrmidon · joins Ch 4',
    classSet: u.classes.map((c) => engine.className(c, u.gender)),
    modifiers: fmtStats(u.modifiers),
    classes,
    skills,
    passes: {
      son: u.passesClasses.son?.map((c) => engine.className(c, 'M')) ?? null,
      daughter: u.passesClasses.daughter?.map((c) => engine.className(c, 'F')) ?? null,
    },
    inheritable: [...new Set(classes.flatMap((c) => c.skills.filter((s) => s.inheritable).map((s) => s.name)))],
    partners: partners.sort((a, b) => b.total - a.total),
    opinion: LONQU_OPINION,
  };
}

function row(name: string, self: Who, other: Who, ops: Opinion[]): PartnerRow {
  const children = childrenOf(self, other);
  const verdict = verdictFor(ops, name);
  return { name, key: name, children, total: children.reduce((s, c) => s + (c.score ?? 0), 0), ...(verdict ? { verdict } : {}) };
}

export function robinPage(gender: Gender, asset: Stat, flaw: Stat): UnitPage {
  const classes = reachable(regularClasses(gender), gender);
  const self: Who = { kind: 'robin', gender, asset, flaw };
  const partners = (ROBIN_SUPPORTS[gender] as readonly string[]).map((p) => {
    const other: Who = p in CHILD_UNITS ? { kind: 'child', id: p as ChildId } : { kind: 'unit', id: p as UnitId };
    const name = p in CHILD_UNITS ? CHILD_UNITS[p as ChildId].name : FIRST_GEN_UNITS[p as UnitId].name;
    return row(name, self, other, ROBIN_OPINION);
  });
  return {
    kind: 'unit',
    key: 'robin',
    name: `Robin (${gender})`,
    gender,
    blurb: `Avatar · Tactician · PREVIEW +${STAT_LABEL[asset]} −${STAT_LABEL[flaw]} (not written to Run facts)`,
    classSet: regularClasses(gender).map((c) => engine.className(c, gender)),
    modifiers: 'depends on asset/flaw',
    classes,
    skills: skillSet(classes, true),
    passes: { son: ['every regular class for the son'], daughter: ['every regular class for the daughter'] },
    inheritable: [...new Set(classes.flatMap((c) => c.skills.filter((s) => s.inheritable).map((s) => s.name)))],
    partners: partners.sort((a, b) => b.total - a.total),
    opinion: ROBIN_OPINION,
    preview: { asset, flaw },
  };
}

function frontDoor(id: ChildId): FrontDoor {
  const c = CHILD_UNITS[id];
  const groups = engine.groups(id).map((g) => {
    const best = scoring.groupBest(g).best;
    return { label: g.label, score: scoreOf(best) };
  });
  groups.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const mark = (l: string) => verdictFor(NAH_OPINION, l);
  const top = groups.slice(0, 5).map((g) => ({ ...g, ...(mark(g.label) ? { mark: mark(g.label)! } : {}) }));
  const marked = groups.slice(5).filter((g) => mark(g.label)).map((g) => ({ ...g, mark: mark(g.label)! }));
  return {
    kind: 'child',
    key: id,
    name: c.name,
    gender: c.gender,
    fixedParent: FIRST_GEN_UNITS[c.fixedParent as UnitId].name,
    startClass: engine.className(c.defaultClassSet[0], c.gender),
    classSet: c.defaultClassSet.map((k) => engine.className(k, c.gender)),
    growths: fmtStats(c.growths),
    top,
    marked,
    total: groups.length,
    robinLine: `${c.name} can marry Robin (M): Morgan (F) would get ${c.name}'s pairing as her other parent.`,
    opinion: NAH_OPINION,
  };
}

export const SUBJECTS = { lonqu: () => unitPage('lonqu'), nah: () => frontDoor('nah') } as const;
