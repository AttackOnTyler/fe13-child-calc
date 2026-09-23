// PROTOTYPE — throwaway. Skill reachability + build-template matching for ONE pairing, enough to
// judge the skill tab layout. REAL: class skill table + inheritance rules (research/skill-inheritance),
// rally table + build catalog seeds (research/builds-and-synergies). MOCK: skill ranks, second-gen
// parents' pools (approximated), template list is a seed not the curated set.
import { CHILDREN, CLASSES, PROMO, PRESETS, REGULAR, UNITS, adapt, type Row } from '../pairing-table/data';

export type Ctx = 'All' | 'Apotheosis' | 'Main story' | 'Full route';
export const CTXS: Ctx[] = ['All', 'Apotheosis', 'Main story', 'Full route'];

// ---- class skills (REAL) ----
export const CLASS_SKILLS: Record<string, [string, number][]> = {
  Lord: [['Dual Strike+', 1], ['Charm', 10]], Tactician: [['Veteran', 1], ['Solidarity', 10]],
  Cavalier: [['Discipline', 1], ['Outdoor Fighter', 10]], Knight: [['Defence +2', 1], ['Indoor Fighter', 10]],
  Myrmidon: [['Avoid +10', 1], ['Vantage', 10]], Mercenary: [['Armsthrift', 1], ['Patience', 10]],
  Fighter: [['HP +5', 1], ['Zeal', 10]], Barbarian: [['Despoil', 1], ['Gamble', 10]],
  Archer: [['Skill +2', 1], ['Prescience', 10]], Thief: [['Locktouch', 1], ['Movement +1', 10]],
  'Pegasus Knight': [['Speed +2', 1], ['Relief', 10]], 'Wyvern Rider': [['Strength +2', 1], ['Tantivy', 10]],
  Mage: [['Magic +2', 1], ['Focus', 10]], 'Dark Mage': [['Hex', 1], ['Anathema', 10]],
  Priest: [['Miracle', 1], ['Healtouch', 10]], Troubadour: [['Resistance +2', 1], ['Demoiselle', 10]],
  'Great Lord': [['Aether', 5], ['Rightful King', 15]], Grandmaster: [['Ignis', 5], ['Rally Spectrum', 15]],
  Paladin: [['Defender', 5], ['Aegis', 15]], 'Great Knight': [['Luna', 5], ['Dual Guard+', 15]],
  General: [['Rally Defence', 5], ['Pavise', 15]], Swordmaster: [['Astra', 5], ['Swordfaire', 15]],
  Hero: [['Sol', 5], ['Axebreaker', 15]], Warrior: [['Rally Strength', 5], ['Counter', 15]],
  Berserker: [['Wrath', 5], ['Axefaire', 15]], Sniper: [['Hit Rate +20', 5], ['Bowfaire', 15]],
  'Bow Knight': [['Rally Skill', 5], ['Bowbreaker', 15]], Assassin: [['Lethality', 5], ['Pass', 15]],
  Trickster: [['Lucky Seven', 5], ['Acrobat', 15]], 'Falcon Knight': [['Rally Speed', 5], ['Lancefaire', 15]],
  'Dark Flier': [['Rally Movement', 5], ['Galeforce', 15]], 'Wyvern Lord': [['Quick Burn', 5], ['Swordbreaker', 15]],
  'Griffon Rider': [['Deliverer', 5], ['Lancebreaker', 15]], Sage: [['Rally Magic', 5], ['Tomefaire', 15]],
  Sorcerer: [['Vengeance', 5], ['Tomebreaker', 15]], 'Dark Knight': [['Slow Burn', 5], ['Lifetaker', 15]],
  'War Monk': [['Rally Luck', 5], ['Renewal', 15]], Valkyrie: [['Rally Resistance', 5], ['Dual Support+', 15]],
  Villager: [['Aptitude', 1], ['Underdog', 15]], Dancer: [['Luck +4', 1], ['Special Dance', 15]],
  Taguel: [['Even Rhythm', 1], ['Beastbane', 15]], Manakete: [['Odd Rhythm', 1], ['Wyrmsbane', 15]],
  Conqueror: [], 'Dread Fighter': [['Resistance +10', 1], ['Aggressor', 15]], Bride: [['Rally Heart', 1], ['Bond', 15]],
};
const DLC_CLASS_SKILLS = new Set(['Resistance +10', 'Aggressor', 'Rally Heart', 'Bond']);
export const DLC_BOOKS = ['Limit Breaker', 'All Stats +2', 'Paragon', "Iote's Shield"];
const NEVER_INHERIT = new Set([...DLC_CLASS_SKILLS, ...DLC_BOOKS, 'Special Dance']);
const SKILL_CLASS = new Map<string, { cls: string; lv: number }>();
for (const [cls, ks] of Object.entries(CLASS_SKILLS)) for (const [k, lv] of ks) if (!SKILL_CLASS.has(k)) SKILL_CLASS.set(k, { cls, lv });
const GENDER_CLASS: Record<string, 'M' | 'F'> = { Fighter: 'M', Barbarian: 'M', Warrior: 'M', Berserker: 'M', 'Dread Fighter': 'M', 'Pegasus Knight': 'F', Troubadour: 'F', 'Falcon Knight': 'F', 'Dark Flier': 'F', Valkyrie: 'F', Bride: 'F' };

export const RALLIES = ['Rally Strength', 'Rally Magic', 'Rally Skill', 'Rally Speed', 'Rally Luck', 'Rally Defence', 'Rally Resistance', 'Rally Movement', 'Rally Spectrum', 'Rally Heart'];

// ---- skill ranks (MOCK curated: 1–5 = D..S, 0 unranked; sparse context overrides) ----
type RankDef = { d: number; A?: number; M?: number; F?: number };
const R: Record<string, RankDef> = {
  Galeforce: { d: 5 }, Aether: { d: 5 }, Luna: { d: 4, A: 5 }, Astra: { d: 4 }, Vengeance: { d: 4, A: 5 }, Sol: { d: 3, A: 1, M: 5, F: 4 },
  Ignis: { d: 3 }, Lethality: { d: 2, A: 1 }, 'Rightful King': { d: 4 }, 'Limit Breaker': { d: 5 }, Aggressor: { d: 5, M: 3 },
  'All Stats +2': { d: 3 }, Bowfaire: { d: 4 }, Swordfaire: { d: 4 }, Tomefaire: { d: 4 }, Axefaire: { d: 4 }, Lancefaire: { d: 4 },
  'Dual Strike+': { d: 4 }, 'Dual Guard+': { d: 2 }, 'Dual Support+': { d: 3 }, Vantage: { d: 4 }, Wrath: { d: 3 },
  Pavise: { d: 4, A: 2, M: 5 }, Aegis: { d: 4, A: 2, M: 5 }, Renewal: { d: 3, M: 4 }, Lifetaker: { d: 3 }, Armsthrift: { d: 3, M: 4 },
  Counter: { d: 3, A: 1 }, 'Speed +2': { d: 3, A: 4 }, 'Strength +2': { d: 3 }, 'Magic +2': { d: 3 }, 'Skill +2': { d: 2 },
  Defender: { d: 3 }, Anathema: { d: 3 }, 'Hit Rate +20': { d: 3 }, Prescience: { d: 3 }, 'Even Rhythm': { d: 2 }, Hex: { d: 2 },
  Miracle: { d: 2 }, Patience: { d: 2 }, Focus: { d: 2 }, Gamble: { d: 2 }, Axebreaker: { d: 2 }, Swordbreaker: { d: 2 },
  Lancebreaker: { d: 2 }, Bowbreaker: { d: 2 }, Tomebreaker: { d: 2 }, 'Rally Spectrum': { d: 4 }, 'Rally Heart': { d: 4 },
  'Rally Speed': { d: 3 }, 'Rally Strength': { d: 3 }, 'Rally Magic': { d: 3 }, 'Rally Skill': { d: 2 }, 'Rally Defence': { d: 2 },
  'Rally Resistance': { d: 2 }, 'Rally Luck': { d: 1 }, 'Rally Movement': { d: 3 }, Acrobat: { d: 2 }, 'Movement +1': { d: 2 },
  Deliverer: { d: 2 }, Charm: { d: 2 }, Solidarity: { d: 2 }, Demoiselle: { d: 1 }, Tantivy: { d: 1 }, Relief: { d: 1 },
};
export function rank(skill: string, ctx: Ctx) {
  const r = R[skill];
  if (!r) return 0;
  return (ctx === 'Apotheosis' ? r.A : ctx === 'Main story' ? r.M : ctx === 'Full route' ? r.F : undefined) ?? r.d;
}
export const RANK_LETTER = ['–', 'D', 'C', 'B', 'A', 'S'];

// ---- build templates (seeded from research B01–B23; contexts A=Apotheosis M=Main story F=Full route) ----
export type Template = { id: string; name: string; role: string; ctx: ('A' | 'M' | 'F')[]; slots: string[][]; source: string; conf: string };
const FAIRE = ['Bowfaire', 'Swordfaire', 'Axefaire', 'Lancefaire', 'Tomefaire'];
export const TEMPLATES: Template[] = [
  { id: 'B01', name: 'Galeforce proc archer', role: 'Physical lead', ctx: ['A', 'M', 'F'], slots: [['Galeforce'], ['Bowfaire'], ['Luna', 'Vengeance'], ['Aether', 'Astra'], ['Speed +2', 'Defender', 'Anathema']], source: 'S3, S4', conf: 'Multi' },
  { id: 'B02', name: 'Galeforce proc caster', role: 'Magical lead', ctx: ['A', 'M', 'F'], slots: [['Galeforce'], ['Tomefaire'], ['Luna', 'Vengeance'], ['Astra', 'Aether'], ['Magic +2', 'Defender']], source: 'S3', conf: 'Single' },
  { id: 'B03', name: 'Galeforce Vengeance sniper', role: 'Physical lead', ctx: ['A'], slots: [['Galeforce'], ['Bowfaire'], ['Vengeance'], ['Anathema'], ['Speed +2']], source: 'S3', conf: 'Single' },
  { id: 'B04', name: 'DLC Galeboy', role: 'Physical lead', ctx: ['A', 'F'], slots: [['Galeforce'], FAIRE, ['Luna', 'Vengeance'], ['Aggressor'], ['Limit Breaker']], source: 'S3', conf: 'Single' },
  { id: 'B05', name: 'DLC Galegirl', role: 'Physical lead', ctx: ['A', 'F'], slots: [['Galeforce'], ['Aether'], ['Luna'], ['Dual Strike+'], ['Limit Breaker']], source: 'S3', conf: 'Single' },
  { id: 'B06', name: 'Berserker hard support', role: 'Physical hard support', ctx: ['A'], slots: [['Axefaire'], ['Strength +2'], ['Hit Rate +20'], ['Prescience'], ['Even Rhythm', 'Axebreaker', 'Lancebreaker']], source: 'S3', conf: 'Single' },
  { id: 'B07', name: 'Sage hard support', role: 'Magical hard support', ctx: ['A'], slots: [['Tomefaire'], ['Magic +2'], ['Anathema'], ['Dual Support+'], ['Tomebreaker']], source: 'S3', conf: 'Single' },
  { id: 'B09', name: 'Vantage/Vengeance Sage', role: 'V/V lead', ctx: ['A', 'M'], slots: [['Vantage'], ['Vengeance'], ['Tomefaire'], ['Galeforce'], ['Hit Rate +20']], source: 'S3, S4, S5, S7', conf: 'Wide' },
  { id: 'B10', name: 'Crisis-mode crit', role: 'Crisis / crit', ctx: ['M', 'A'], slots: [['Vantage'], ['Vengeance', 'Astra'], ['Wrath'], ['Focus', 'Gamble', 'Anathema'], ['Galeforce', 'Miracle', 'Limit Breaker']], source: 'S3, S4, S5', conf: 'Wide' },
  { id: 'B11', name: 'Nostank Sorcerer', role: 'Nostank', ctx: ['M', 'F'], slots: [['Vengeance'], ['Armsthrift'], ['Lifetaker'], ['Galeforce'], ['Limit Breaker', 'Renewal']], source: 'S4, S5', conf: 'Multi' },
  { id: 'B12', name: 'Pavise/Aegis tank', role: 'Tank (main story)', ctx: ['M', 'F'], slots: [['Pavise'], ['Aegis'], ['Renewal', 'Sol', 'Lifetaker'], ['Luna', 'Swordbreaker', 'Lancebreaker'], ['Limit Breaker', 'Rightful King']], source: 'S4, S5, S6, S7', conf: 'Wide' },
  { id: 'B13', name: 'Armsthrift brave bruiser', role: 'Armsthrift bruiser', ctx: ['M', 'F'], slots: [['Galeforce'], ['Armsthrift'], ['Sol'], ['Bowfaire', 'Axefaire', 'Swordfaire', 'Axebreaker'], ['Limit Breaker', 'Patience']], source: 'S7, S9', conf: 'Multi' },
  { id: 'B16', name: 'Rightful King procstack', role: 'Physical lead', ctx: ['A', 'M'], slots: [['Galeforce'], ['Bowfaire'], ['Luna'], ['Astra'], ['Rightful King']], source: 'S3, S5, S6', conf: 'Multi' },
  { id: 'B17', name: 'Triple-proc sniper', role: 'Physical lead', ctx: ['A'], slots: [['Bowfaire'], ['Aether'], ['Luna'], ['Rightful King'], ['Dual Strike+']], source: 'S3', conf: 'Single' },
  { id: 'B19', name: 'Duo rallybot (male side)', role: 'Rallybot / Dancer', ctx: ['A', 'M', 'F'], slots: [['Rally Strength'], ['Rally Skill'], ['Rally Luck'], ['Rally Defence'], ['Rally Resistance', 'Rally Spectrum']], source: 'S3, S4', conf: 'Multi' },
  { id: 'B20', name: 'Duo rallybot (female side)', role: 'Rallybot / Dancer', ctx: ['A', 'M', 'F'], slots: [['Rally Magic'], ['Rally Speed'], ['Rally Movement'], ['Rally Spectrum'], ['Rally Heart']], source: 'S3, S4', conf: 'Multi' },
  { id: 'FR1', name: 'Full-route Galeforce lead', role: 'Physical lead', ctx: ['F'], slots: [['Galeforce'], FAIRE, ['Luna', 'Vengeance'], ['Limit Breaker'], ['All Stats +2', 'Speed +2']], source: 'user play (placeholder)', conf: 'Single' },
];
export const presetIndexFor = (role: string) => Math.max(0, PRESETS.findIndex((p) => p.name === role));

// ---- synergy notes (REAL edges, subset) ----
const SYN: [string, string, string][] = [
  ['Galeforce', 'Luna', 'Galeforce needs the kill; a stable proc makes it reliable.'],
  ['Galeforce', 'Vengeance', 'Vengeance fires ~100% at Skl≥50, so Galeforce kills are reliable.'],
  ['Luna', 'Aether', 'Two procs is the sweet spot: Aether Skl/2% + Luna Skl%.'],
  ['Luna', 'Astra', 'Two procs is the sweet spot: Astra Skl/2% + Luna Skl%.'],
  ['Aether', 'Rightful King', 'Rightful King adds +10% to low-rate Aether.'],
  ['Luna', 'Rightful King', 'Rightful King ≈ one extra proc at Apotheosis Skl.'],
  ['Vantage', 'Vengeance', 'Vantage works below 50% HP — exactly when Vengeance hits hardest.'],
  ['Vengeance', 'Wrath', 'Wrath +20 crit in the same low-HP state; a crit triples Vengeance.'],
  ['Vengeance', 'Lifetaker', 'Lifetaker heals only on your turn, so it doesn’t undo Vantage range.'],
  ['Pavise', 'Aegis', 'Together they halve every weapon type.'],
  ['Galeforce', 'Lifetaker', 'Every Galeforce trigger is also a kill that heals 50%.'],
  ['Armsthrift', 'Galeforce', 'Unbreakable forged Brave weapon on a double-action unit.'],
  ['Aggressor', 'Limit Breaker', 'Two of the "Big Three" DLC boosts.'],
];

// ---- per-pairing analysis ----
export type Source =
  | { kind: 'class'; cls: string; lv: number; start: boolean; dlc: boolean }
  | { kind: 'parent'; which: 'fixed' | 'variable'; parent: string; forced: boolean }
  | { kind: 'book' };
export type SkillEntry = { skill: string; rank: number; via: Source[]; onlyVia: string | null };
export type SlotResult = { options: string[]; skill: string | null; pref: number; src: Source | null; reason: string };
export type BuildMatch = { t: Template; tier: number; quality: number; prefMiss: number; cost: number; classes: string[]; slots: SlotResult[]; notes: string[] };
export type Rally = { skill: string; src: Source | null; reason: string };
export type Analysis = {
  row: Row; child: string; childG: 'M' | 'F'; fixed: string; variable: string; start: string; startLine: string[];
  classes: string[]; baseClasses: string[]; pool: SkillEntry[]; byClass: { cls: string; tier: 'base' | 'promoted' | 'special' | 'dlc'; start: boolean; skills: string[] }[];
  fixedPool: { skills: string[]; forced: string | null; note: string }; variablePool: { skills: string[]; forced: string | null; note: string };
  builds: BuildMatch[]; rallies: Rally[]; dlcOn: boolean;
};

const promos = (base: string, g: 'M' | 'F') => (PROMO[base] ?? []).filter((p) => !CLASSES[p]?.gender || CLASSES[p].gender === g);
const unitPool = (classes: string[], g: 'M' | 'F') => {
  const cs = new Set<string>();
  for (const b of classes) { cs.add(b); for (const p of promos(b, g)) cs.add(p); }
  if (classes.includes('Lord')) cs.add('Great Lord');
  return [...cs].flatMap((c) => (CLASS_SKILLS[c] ?? []).map(([k]) => k)).filter((k) => !NEVER_INHERIT.has(k));
};
const CHROM_DAUGHTER_FIXED = ['Lucina', 'Kjelle', 'Cynthia'];

function parentPool(label: string, childName: string, childG: 'M' | 'F', which: 'fixed' | 'variable') {
  // returns what this parent could pass (any eligible skill they can learn), with forced cases
  if (label === 'Maiden') return { skills: [], forced: null, note: 'The Maiden passes nothing.' };
  if (label === 'Chrom') {
    const k = childG === 'F' ? 'Aether' : 'Rightful King';
    return { skills: [k], forced: k, note: `Chrom always passes ${k} to a ${childG === 'F' ? 'daughter' : 'son'}.` };
  }
  if (label.includes('←')) {
    const [kid, vp] = label.split(' ← ');
    const kc = CHILDREN.find((c) => c.name === kid)!;
    if (childName.startsWith('Morgan') && (kid === 'Lucina' || (CHROM_DAUGHTER_FIXED.includes(kid) && vp === 'Chrom')))
      return { skills: ['Aether'], forced: 'Aether', note: `${kid} always passes Aether to Morgan.` };
    if (childName.startsWith('Morgan') && (kid === 'Inigo' || kid === 'Brady') && vp === 'Chrom')
      return { skills: ['Rightful King'], forced: 'Rightful King', note: `${kid} (Chrom's son) always passes Rightful King.` };
    // approximation: child's own class skills + anything either of its parents could have passed it
    const own = unitPool([...kc.defaults, ...adapt(UNITS[vp]?.classes ?? [], kc.g)], kc.g);
    const up = [...(UNITS[kc.fixed] ? unitPool(UNITS[kc.fixed].classes, UNITS[kc.fixed].g) : []), ...(UNITS[vp] ? unitPool(UNITS[vp].classes, UNITS[vp].g) : [])];
    return { skills: [...new Set([...own, ...up])], forced: null, note: `${kid}'s own skills plus what ${kid} could inherit (approx.)` };
  }
  if (label.startsWith('Robin')) {
    const g = label.includes('(M)') ? 'M' : 'F';
    return { skills: unitPool(REGULAR, g), forced: null, note: 'Robin can learn every regular class.' };
  }
  const u = UNITS[label];
  if (!u) return { skills: [], forced: null, note: '' };
  if (childName.startsWith('Morgan') && label === 'Aversa') return { skills: ['Shadowgift'], forced: 'Shadowgift', note: 'Aversa always passes Shadowgift to Morgan.' };
  if (childName.startsWith('Morgan') && label === 'Walhart') return { skills: ['Conquest'], forced: 'Conquest', note: 'Walhart always passes Conquest to Morgan.' };
  void which;
  return { skills: unitPool(u.classes, u.g), forced: null, note: `Must be ${label}'s lowest equipped skill when the paralogue starts.` };
}

export function analyse(row: Row, ctx: Ctx, dlcSetting: boolean): Analysis {
  const c = CHILDREN.find((x) => x.name === row.child)!;
  const isMorgan = c.name.startsWith('Morgan');
  const fixed = c.fixed;
  const variable = row.parentLabel;
  const dlcOn = dlcSetting || ctx === 'Full route';
  const varUnitClasses = variable.includes('←') ? [] : variable.startsWith('Robin') ? REGULAR : UNITS[variable]?.classes ?? [];
  const special = isMorgan ? (variable.includes('←') ? CHILDREN.find((k) => k.name === variable.split(' ← ')[0])!.defaults : UNITS[variable]?.classes ?? []).filter((x) => x === 'Taguel' || x === 'Manakete') : [];
  const baseClasses = [...new Set(isMorgan ? [...REGULAR, ...special] : [...c.defaults, ...adapt(varUnitClasses, c.g)])];
  const start = isMorgan ? 'Tactician' : c.defaults[0];
  const startLine = [start, ...promos(start, c.g), ...(start === 'Lord' ? ['Great Lord'] : [])];
  const promoted = [...new Set(baseClasses.flatMap((b) => promos(b, c.g)))];
  if (baseClasses.includes('Lord') && !promoted.includes('Great Lord')) promoted.unshift('Great Lord');
  const dlcClass = c.g === 'M' ? 'Dread Fighter' : 'Bride';
  const classes = [...baseClasses, ...promoted, ...(dlcOn ? [dlcClass] : [])];

  const via = new Map<string, Source[]>();
  const add = (k: string, s: Source) => (via.get(k) ?? via.set(k, []).get(k)!).push(s);
  const byClass = classes.map((cls) => {
    const tier = cls === dlcClass ? 'dlc' : ['Villager', 'Taguel', 'Manakete', 'Lord', 'Dancer'].includes(cls) ? 'special' : baseClasses.includes(cls) ? 'base' : 'promoted';
    const skills = (CLASS_SKILLS[cls] ?? []).map(([k]) => k).filter((k) => k !== 'Special Dance');
    for (const [k, lv] of CLASS_SKILLS[cls] ?? []) add(k, { kind: 'class', cls, lv, start: startLine.includes(cls), dlc: cls === dlcClass });
    return { cls, tier: tier as 'base' | 'promoted' | 'special' | 'dlc', start: startLine.includes(cls), skills };
  });
  if (dlcOn) for (const k of DLC_BOOKS) add(k, { kind: 'book' });
  const fixedPool = parentPool(fixed, c.name, c.g, 'fixed');
  const variablePool = parentPool(variable, c.name, c.g, 'variable');
  for (const k of fixedPool.skills) add(k, { kind: 'parent', which: 'fixed', parent: fixed, forced: !!fixedPool.forced });
  for (const k of variablePool.skills) add(k, { kind: 'parent', which: 'variable', parent: variable, forced: !!variablePool.forced });

  const pool: SkillEntry[] = [...via.entries()]
    .map(([skill, v]) => {
      const cls = v.filter((s) => s.kind !== 'parent');
      const ps = v.filter((s): s is Extract<Source, { kind: 'parent' }> => s.kind === 'parent');
      return { skill, rank: rank(skill, ctx), via: v.sort(srcOrder), onlyVia: cls.length === 0 && ps.length === 1 ? ps[0].parent : null };
    })
    .sort((a, b) => b.rank - a.rank || a.skill.localeCompare(b.skill));

  const cx = ctx === 'Apotheosis' ? 'A' : ctx === 'Main story' ? 'M' : ctx === 'Full route' ? 'F' : null;
  const templates = TEMPLATES.filter((t) => !cx || t.ctx.includes(cx));
  const builds = templates.map((t) => match(t, via, ctx, { c, fixed, variable, fixedPool, variablePool, dlcOn, classes }))
    .filter((b) => b.tier >= 3)
    .sort((a, b) => b.tier - a.tier || b.quality - a.quality || a.prefMiss - b.prefMiss || a.cost - b.cost);

  const rallies: Rally[] = RALLIES.map((k) => {
    const v = via.get(k) ?? [];
    const src = v[0] ?? null;
    return { skill: k, src, reason: src ? '' : whyNot(k, { c, fixed, variable, fixedPool, variablePool, dlcOn, classes }, null) };
  });
  return { row, child: c.name, childG: c.g, fixed, variable, start, startLine, classes, baseClasses, pool, byClass, fixedPool, variablePool, builds, rallies, dlcOn };
}

// fixed inheritance (free) < class in starting line < other class < inherited < DLC book
function srcOrder(a: Source, b: Source) {
  const w = (s: Source) => (s.kind === 'parent' && s.forced ? -1 : s.kind === 'class' ? (s.start ? 0 : s.dlc ? 2 : 1) : s.kind === 'parent' ? 3 : 4);
  return w(a) - w(b);
}

type Ctxt = { c: (typeof CHILDREN)[number]; fixed: string; variable: string; fixedPool: ReturnType<typeof parentPool>; variablePool: ReturnType<typeof parentPool>; dlcOn: boolean; classes: string[] };

function whyNot(k: string, x: Ctxt, used: { fixed?: string; variable?: string } | null): string {
  if ((DLC_BOOKS.includes(k) || DLC_CLASS_SKILLS.has(k)) && !x.dlcOn) return 'DLC — turn on DLC or pick Full route';
  if (DLC_CLASS_SKILLS.has(k)) return `${SKILL_CLASS.get(k)!.cls} is ${GENDER_CLASS[SKILL_CLASS.get(k)!.cls] === 'M' ? 'male' : 'female'}-only; DLC skills never inherit`;
  const fx = x.fixedPool.skills.includes(k), vr = x.variablePool.skills.includes(k);
  if (used && (fx || vr)) {
    const who = fx && used.fixed ? `${x.fixed}'s one skill is already ${used.fixed}` : vr && used.variable ? `${x.variable}'s one skill is already ${used.variable}` : '';
    if (who) return `${fx ? x.fixed : x.variable} could pass it, but ${who}`;
  }
  const home = SKILL_CLASS.get(k);
  if (k === 'Rightful King' || k === 'Aether') return `${home?.cls} is Chrom/Lucina only; comes from Chrom's line`;
  if (k === 'Shadowgift' || k === 'Conquest') return 'personal skill (Morgan only via Aversa / Walhart)';
  if (!home) return 'not learnable';
  const g = GENDER_CLASS[home.cls];
  if (g && g !== x.c.g) return `${home.cls} is ${g === 'M' ? 'male' : 'female'}-only, and neither parent can pass it`;
  if (home.cls === 'Rally Spectrum' || k === 'Rally Spectrum') return 'Grandmaster is Robin/Morgan only';
  return `${home.cls} isn't in ${x.c.name}'s class pool, and neither parent can pass it`;
}

function match(t: Template, via: Map<string, Source[]>, ctx: Ctx, x: Ctxt): BuildMatch {
  type Opt = { skill: string; pref: number; src: Source };
  const opts = t.slots.map((prefs) => prefs.flatMap((skill, pref) => (via.get(skill) ?? []).map((src) => ({ skill, pref, src }))));
  let best: { picks: (Opt | null)[]; key: number[] } | null = null;
  const picks: (Opt | null)[] = [];
  const keyOf = (ps: (Opt | null)[]) => {
    const filled = ps.filter(Boolean) as Opt[];
    const cls = new Set(filled.flatMap((o) => (o.src.kind === 'class' && !o.src.start ? [o.src.cls] : [])));
    return [filled.length, filled.reduce((a, o) => a + rank(o.skill, ctx), 0), -filled.reduce((a, o) => a + o.pref, 0), -cls.size];
  };
  const better = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  const dfs = (i: number, usedF: boolean, usedV: boolean, usedK: Set<string>) => {
    if (i === opts.length) {
      const key = keyOf(picks);
      if (!best || better(key, best.key)) best = { picks: [...picks], key };
      return;
    }
    for (const o of opts[i]) {
      if (usedK.has(o.skill)) continue;
      const pf = o.src.kind === 'parent' && o.src.which === 'fixed', pv = o.src.kind === 'parent' && o.src.which === 'variable';
      if ((pf && usedF) || (pv && usedV)) continue;
      picks[i] = o; usedK.add(o.skill);
      dfs(i + 1, usedF || pf, usedV || pv, usedK);
      usedK.delete(o.skill);
    }
    picks[i] = null;
    dfs(i + 1, usedF, usedV, usedK);
  };
  dfs(0, false, false, new Set());
  const bp = best!.picks;
  const used: { fixed?: string; variable?: string } = {};
  for (const o of bp) if (o?.src.kind === 'parent') used[o.src.which] = o.skill;
  // forced inheritance occupies the parent's slot even if the build doesn't use it
  if (x.fixedPool.forced && !used.fixed) used.fixed = x.fixedPool.forced;
  if (x.variablePool.forced && !used.variable) used.variable = x.variablePool.forced;
  const slots: SlotResult[] = t.slots.map((prefs, i) => {
    const o = bp[i];
    return o ? { options: prefs, skill: o.skill, pref: o.pref, src: o.src, reason: '' } : { options: prefs, skill: null, pref: -1, src: null, reason: whyNot(prefs[0], x, used) };
  });
  const got = slots.flatMap((s) => (s.skill ? [s.skill] : []));
  const notes = SYN.filter(([a, b]) => got.includes(a) && got.includes(b)).map(([a, b, n]) => `${a} + ${b}: ${n}`);
  const classes = [...new Set(slots.flatMap((s) => (s.src?.kind === 'class' && !s.src.start ? [s.src.cls] : [])))];
  return { t, tier: got.length, quality: best!.key[1], prefMiss: -best!.key[2], cost: classes.length, classes, slots, notes };
}

// ---- display helpers shared by variants (strings only, no layout) ----
export const srcText = (s: Source | null, a?: Analysis) => {
  if (!s) return '';
  if (s.kind === 'book') return 'DLC skill book';
  if (s.kind === 'class') return `${s.cls} Lv ${s.lv}${s.start ? ' (starting line)' : ''}`;
  if (s.forced) return `fixed from ${s.parent}`;
  return `inherit from ${s.parent} (must be ${s.parent}'s last equipped)` + (a ? '' : '');
};
export const srcShort = (s: Source | null) =>
  !s ? '' : s.kind === 'book' ? 'DLC book' : s.kind === 'class' ? `${s.cls} ${s.lv}` : s.forced ? `fixed · ${s.parent}` : `from ${s.parent}`;
export const rankChip = (skill: string, ctx: Ctx) => {
  const r = rank(skill, ctx);
  return `<span class="rk rk${r}" title="rank ${RANK_LETTER[r]} in ${ctx}">${RANK_LETTER[r]}</span>`;
};

// ---- skill detail (descriptions PARAPHRASED from SF/FEW skill lists, not game text; rates from research §1) ----
const INFO: Record<string, [string, string?]> = {
  Galeforce: ['After the unit starts a fight and defeats the enemy, it can move again (once per turn).'],
  Aether: ["Hits twice: the first strike heals half the damage dealt (Sol), the second ignores half the foe's Def/Res (Luna).", 'Skl/2 %'],
  Luna: ["The attack ignores half of the enemy's Def/Res.", 'Skl %'],
  Astra: ['Strikes five times in a row at half damage.', 'Skl/2 %'],
  Sol: ['Heals the unit for half the damage dealt.', 'Skl %'],
  Ignis: ['Adds half of Mag to damage for physical attacks, or half of Str for magical ones.', 'Skl %'],
  Vengeance: ["Adds half the unit's missing HP to damage.", 'Skl × 2 %'],
  Lethality: ['Defeats the enemy in one hit.', 'Skl/4 %'],
  'Rightful King': ["+10 % to the activation rate of the unit's other skills."],
  Vantage: ['Below half HP, the unit attacks first even when the enemy starts the fight.'],
  Wrath: ['+20 crit while below half HP.'],
  Lifetaker: ["Heals 50 % of max HP after defeating an enemy on the unit's own turn."],
  Pavise: ['Halves damage from swords, lances, axes and beaststones.', 'Skl %'],
  Aegis: ['Halves damage from bows, tomes and dragonstones.', 'Skl %'],
  Renewal: ['Recovers 30 % of max HP at the start of each turn.'],
  Armsthrift: ["The weapon doesn't lose a use on this attack.", 'Luck × 2 %'],
  Counter: ['Returns damage taken from an adjacent attacker.'],
  Miracle: ['Survives a would-be lethal hit with 1 HP if HP was above 1.', 'Luck %'],
  Bowfaire: ['+5 Str when using a bow.'], Swordfaire: ['+5 Str when using a sword.'], Axefaire: ['+5 Str when using an axe.'],
  Lancefaire: ['+5 Str when using a lance.'], Tomefaire: ['+5 Mag when using a tome.'],
  'Dual Strike+': ['+10 % Dual Strike rate while this unit is paired.'], 'Dual Guard+': ['+10 % Dual Guard rate while this unit is paired.'],
  'Dual Support+': ['Raises the support bonuses this unit gives and receives.'],
  'Limit Breaker': ['+10 to every max stat except HP. DLC.'], Aggressor: ['+10 Atk when the unit or its partner starts the fight. DLC.'],
  'All Stats +2': ['+2 to every stat. DLC.'], 'Speed +2': ['+2 Spd.'], 'Strength +2': ['+2 Str.'], 'Magic +2': ['+2 Mag.'], 'Skill +2': ['+2 Skl.'],
  Defender: ['+1 to all stats while this unit leads a pair.'], Anathema: ['−10 Avoid and Dodge to enemies within 3 tiles.'],
  'Hit Rate +20': ['+20 Hit.'], Prescience: ['+15 Hit and Avoid when the unit starts the fight.'], 'Even Rhythm': ['+10 Hit and Avoid on even turns.'],
  Hex: ['−15 Avoid to adjacent enemies.'], Patience: ['+10 Hit and Avoid on the enemy phase.'], Focus: ['+10 crit when no ally is within 3 tiles.'],
  Gamble: ['+10 crit, −5 Hit.'], Axebreaker: ['+50 Hit and Avoid against axe users.'], Swordbreaker: ['+50 Hit and Avoid against sword users.'],
  Lancebreaker: ['+50 Hit and Avoid against lance users.'], Bowbreaker: ['+50 Hit and Avoid against bow users.'], Tomebreaker: ['+50 Hit and Avoid against tome users.'],
  'Rally Strength': ['Rally: +4 Str to allies within 3 tiles for one turn.'], 'Rally Magic': ['Rally: +4 Mag.'], 'Rally Skill': ['Rally: +4 Skl.'],
  'Rally Speed': ['Rally: +4 Spd.'], 'Rally Luck': ['Rally: +8 Luck.'], 'Rally Defence': ['Rally: +4 Def.'], 'Rally Resistance': ['Rally: +4 Res.'],
  'Rally Movement': ['Rally: +1 Move.'], 'Rally Spectrum': ['Rally: +4 to every stat except Move.'], 'Rally Heart': ['Rally: +2 to every stat and +1 Move. DLC.'],
  Charm: ['+5 Hit and Avoid to allies within 3 tiles.'], Solidarity: ['+10 crit and crit-avoid to adjacent allies.'],
  Acrobat: ['Every passable tile costs only 1 Move.'], 'Movement +1': ['+1 Move.'], Deliverer: ['+2 Move while paired as the lead.'],
  Veteran: ['1.5× EXP while paired as the lead.'], Discipline: ['Weapon rank rises twice as fast.'], 'Avoid +10': ['+10 Avoid.'],
  'HP +5': ['+5 max HP.'], Zeal: ['+5 crit.'], Despoil: ['Chance to take a Bullion (S) on defeating an enemy.', 'Luck %'],
  'Luck +4': ['+4 Luck.'], 'Resistance +2': ['+2 Res.'], 'Defence +2': ['+2 Def.'], Demoiselle: ['−2 damage taken by male allies within 3 tiles.'],
  Relief: ['Recovers 20 % HP at turn start if no unit is within 3 tiles.'], Tantivy: ['+10 Hit and Avoid when no ally is within 3 tiles.'],
  Healtouch: ['Healing staves restore 5 more HP.'], Locktouch: ['Opens doors and chests without keys.'], 'Outdoor Fighter': ['+10 Hit and Avoid outdoors.'],
  'Indoor Fighter': ['+10 Hit and Avoid indoors.'], 'Lucky Seven': ['+20 Hit and Avoid for the first 7 turns.'], Pass: ['Can move through enemy units.'],
  'Quick Burn': ['+15 Hit and Avoid on turn 1, fading by 1 each turn.'], 'Slow Burn': ['Hit and Avoid rise by 1 each turn, up to +15.'],
  Beastbane: ['Effective damage against beast and cavalry units.'], Wyrmsbane: ['Effective damage against dragons.'], 'Odd Rhythm': ['+10 Hit and Avoid on odd turns.'],
  Aptitude: ['+20 % to every growth rate.'], Underdog: ['+15 Hit and Avoid against a higher-level enemy.'], 'Resistance +10': ['+10 Res. DLC.'],
  Bond: ['Heals adjacent allies 10 HP at turn start. DLC.'], Shadowgift: ['Lets the unit use dark tomes in any magic class.'], Conquest: ['Negates bonus damage against armoured and horseback units.'],
};
const ANTI: [string, string, string][] = [
  ['Vengeance', 'Luna', 'Only one proc fires per attack and Vengeance is last in line, so other procs steal its near-certain trigger.'],
  ['Vengeance', 'Astra', 'Only one proc per attack; Astra pre-empts Vengeance.'],
  ['Sol', 'Luna', "Sol is above Luna in priority, so a Sol trigger uses up the attack's one proc."],
  ['Sol', 'Vantage', 'Healing on enemy phase pushes HP back above the Vantage threshold.'],
  ['Renewal', 'Vantage', 'Healing each turn pushes HP back above the Vantage threshold.'],
];

export type SkillDetail = {
  skill: string; desc: string; rate: string | null; ranks: { ctx: Ctx; r: number }[]; via: Source[]; reachable: boolean;
  syn: { other: string; note: string; ok: boolean }[]; anti: { other: string; note: string; ok: boolean }[];
  builds: { name: string; tier: number; slot: number; got: boolean }[]; inheritable: boolean;
};
export function skillDetail(k: string, a: Analysis): SkillDetail {
  const reach = new Set(a.pool.map((e) => e.skill));
  const pair = (list: [string, string, string][]) =>
    list.filter(([x, y]) => x === k || y === k).map(([x, y, note]) => {
      const other = x === k ? y : x;
      return { other, note, ok: reach.has(other) };
    });
  const [desc, rate] = INFO[k] ?? ['(no description yet)'];
  return {
    skill: k, desc, rate: rate ?? null, ranks: CTXS.map((c) => ({ ctx: c, r: rank(k, c) })),
    via: a.pool.find((e) => e.skill === k)?.via ?? [], reachable: reach.has(k),
    syn: pair(SYN), anti: pair(ANTI),
    builds: a.builds.flatMap((b) => {
      const i = b.slots.findIndex((s) => s.skill === k || s.options.includes(k));
      return i < 0 ? [] : [{ name: b.t.name, tier: b.tier, slot: i + 1, got: b.slots[i].skill === k }];
    }),
    inheritable: !NEVER_INHERIT.has(k),
  };
}
export const skillLink = (k: string, text = k) => `<span class="skl" data-ctl="skill" data-v="${k}">${text}</span>`;
