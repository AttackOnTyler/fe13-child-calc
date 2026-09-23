// PROTOTYPE — throwaway. Real marriage graph (research/marriage-and-classes), real Robin asset/flaw
// tables + Robin/Morgan growths (research/stat-inheritance); everything else MOCK numbers
// (seeded random growths/modifiers, approximate class maxes). Scoring follows the decision on
// "Decide scoring and effective-cap semantics" closely enough to judge layout, not values.

export const STATS = ['HP', 'Str', 'Mag', 'Skl', 'Spd', 'Lck', 'Def', 'Res'] as const;
export type Stats = number[]; // length 8, STATS order

function rng(seed: string) {
  let h = 1779033703;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const ri = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const mockGrowths = (name: string, hpLo = 60) => {
  const r = rng('g' + name);
  return STATS.map((s) => (s === 'HP' ? ri(r, hpLo, 110) : ri(r, 10, 65)));
};
const mockMods = (name: string) => {
  const r = rng('m' + name);
  return STATS.map((s) => (s === 'HP' ? 0 : ri(r, -3, 3)));
};

// ---- classes (approx. maxes, mock class growths / pair-up bonuses) ----
type ClassDef = { max: Stats; growth: Stats; pairUp: Stats; dlc?: boolean; gender?: 'M' | 'F' };
const C = (max: Stats, extra: Partial<ClassDef> = {}): ClassDef => {
  const key = max.join();
  const r = rng('c' + key);
  return {
    max,
    growth: STATS.map(() => ri(r, 0, 20)),
    pairUp: STATS.map((s, i) => (s === 'HP' ? 0 : i === 1 + ri(r, 0, 6) || i === 1 + ri(r, 0, 6) ? ri(r, 1, 3) : 0)),
    ...extra,
  };
};
export const CLASSES: Record<string, ClassDef> = {
  'Great Lord': C([80, 43, 30, 40, 41, 45, 42, 40]),
  Grandmaster: C([80, 40, 40, 40, 40, 45, 40, 40]),
  Paladin: C([80, 42, 30, 40, 40, 45, 42, 40]),
  'Great Knight': C([80, 48, 20, 34, 37, 40, 48, 30]),
  General: C([80, 50, 30, 41, 35, 40, 50, 35]),
  Swordmaster: C([80, 44, 34, 48, 50, 45, 38, 40]),
  Assassin: C([80, 48, 30, 50, 48, 40, 38, 35]),
  Hero: C([80, 46, 30, 50, 44, 45, 44, 36]),
  'Bow Knight': C([80, 43, 30, 48, 45, 45, 35, 30]),
  Warrior: C([80, 48, 30, 42, 44, 40, 40, 35], { gender: 'M' }),
  Berserker: C([80, 50, 30, 45, 44, 40, 40, 30], { gender: 'M' }),
  Sniper: C([80, 41, 30, 50, 41, 45, 41, 40]),
  Trickster: C([80, 35, 38, 45, 43, 50, 35, 45]),
  'Falcon Knight': C([80, 38, 35, 45, 46, 45, 35, 45], { gender: 'F' }),
  'Dark Flier': C([80, 36, 42, 41, 42, 45, 36, 48], { gender: 'F' }),
  'Wyvern Lord': C([80, 50, 30, 41, 38, 40, 49, 30]),
  'Griffon Rider': C([80, 45, 30, 50, 45, 45, 40, 30]),
  Sage: C([80, 30, 46, 43, 42, 45, 30, 44]),
  Sorcerer: C([80, 30, 48, 41, 40, 45, 41, 44]),
  'Dark Knight': C([80, 45, 46, 38, 40, 45, 41, 38]),
  'War Monk': C([80, 42, 42, 40, 41, 45, 38, 43]),
  Valkyrie: C([80, 30, 42, 38, 43, 45, 30, 45], { gender: 'F' }),
  Manakete: C([80, 40, 35, 35, 35, 45, 40, 40]),
  Taguel: C([80, 42, 30, 40, 43, 45, 38, 38]),
  'Dread Fighter': C([80, 42, 38, 45, 43, 45, 41, 50], { dlc: true, gender: 'M' }),
  Bride: C([80, 39, 38, 42, 42, 45, 40, 40], { dlc: true, gender: 'F' }),
};
export const CLASS_NAMES = Object.keys(CLASSES);

const PROMO: Record<string, string[]> = {
  Lord: ['Great Lord'], Tactician: ['Grandmaster'], Cavalier: ['Paladin', 'Great Knight'],
  Knight: ['General', 'Great Knight'], Myrmidon: ['Swordmaster', 'Assassin'], Mercenary: ['Hero', 'Bow Knight'],
  Fighter: ['Warrior', 'Hero'], Barbarian: ['Berserker', 'Warrior'], Archer: ['Sniper', 'Bow Knight'],
  Thief: ['Assassin', 'Trickster'], 'Pegasus Knight': ['Falcon Knight', 'Dark Flier'],
  'Wyvern Rider': ['Wyvern Lord', 'Griffon Rider'], Mage: ['Sage', 'Dark Knight'], 'Dark Mage': ['Sorcerer', 'Dark Knight'],
  Priest: ['War Monk', 'Sage'], Troubadour: ['Valkyrie', 'War Monk'], Taguel: ['Taguel'], Manakete: ['Manakete'],
  Villager: [], Dancer: [], Conqueror: [],
};
const REGULAR = ['Tactician', 'Cavalier', 'Knight', 'Myrmidon', 'Mercenary', 'Fighter', 'Barbarian', 'Archer', 'Thief', 'Pegasus Knight', 'Wyvern Rider', 'Mage', 'Dark Mage', 'Priest', 'Troubadour'];
const MALE_ONLY = new Set(['Fighter', 'Barbarian']);
const FEMALE_ONLY = new Set(['Pegasus Knight', 'Troubadour']);
const NEVER_PASS = new Set(['Lord', 'Dancer', 'Conqueror', 'Taguel', 'Manakete']);
function adapt(set: string[], g: 'M' | 'F') {
  return set.flatMap((c) => {
    if (NEVER_PASS.has(c)) return [];
    if (g === 'F' && MALE_ONLY.has(c)) return ['Pegasus Knight'];
    if (g === 'M' && FEMALE_ONLY.has(c)) return [c === 'Troubadour' ? 'Priest' : 'Fighter'];
    return [c];
  });
}

// ---- units ----
type Unit = { name: string; g: 'M' | 'F'; classes: string[]; growths: Stats; mods: Stats; assumption?: string };
const U = (name: string, g: 'M' | 'F', classes: string[], assumption?: string): Unit => ({
  name, g, classes, growths: mockGrowths(name), mods: mockMods(name), assumption,
});
export const UNITS: Record<string, Unit> = Object.fromEntries(
  [
    U('Chrom', 'M', ['Lord', 'Cavalier', 'Archer']), U('Frederick', 'M', ['Cavalier', 'Knight', 'Wyvern Rider']),
    U('Virion', 'M', ['Archer', 'Wyvern Rider', 'Mage']), U('Vaike', 'M', ['Fighter', 'Thief', 'Barbarian']),
    U('Stahl', 'M', ['Cavalier', 'Archer', 'Myrmidon']), U('Kellam', 'M', ['Knight', 'Thief', 'Priest']),
    U("Lon'qu", 'M', ['Myrmidon', 'Thief', 'Wyvern Rider']), U('Ricken', 'M', ['Mage', 'Cavalier', 'Archer']),
    U('Gaius', 'M', ['Thief', 'Fighter', 'Myrmidon']), U('Gregor', 'M', ['Mercenary', 'Barbarian', 'Myrmidon']),
    U('Libra', 'M', ['Priest', 'Mage', 'Dark Mage']), U('Henry', 'M', ['Dark Mage', 'Thief', 'Barbarian']),
    U('Donnel', 'M', ['Villager', 'Fighter', 'Mercenary']), U('Basilio', 'M', ['Fighter', 'Barbarian', 'Knight']),
    U('Gangrel', 'M', ['Dark Mage', 'Thief', 'Barbarian']), U('Walhart', 'M', ['Conqueror', 'Wyvern Rider', 'Knight'], 'Walhart/Conqueror growth'),
    U("Yen'fay", 'M', ['Myrmidon', 'Mercenary', 'Thief']), U('Priam', 'M', ['Mercenary', 'Myrmidon', 'Fighter']),
    U('Lissa', 'F', ['Priest', 'Pegasus Knight', 'Troubadour']), U('Sully', 'F', ['Cavalier', 'Myrmidon', 'Wyvern Rider']),
    U('Miriel', 'F', ['Mage', 'Troubadour', 'Dark Mage']), U('Sumia', 'F', ['Pegasus Knight', 'Knight', 'Priest']),
    U('Maribelle', 'F', ['Troubadour', 'Pegasus Knight', 'Mage']), U('Panne', 'F', ['Taguel', 'Thief', 'Wyvern Rider']),
    U('Cordelia', 'F', ['Pegasus Knight', 'Mercenary', 'Dark Mage']), U('Nowi', 'F', ['Manakete', 'Mage', 'Wyvern Rider']),
    U('Tharja', 'F', ['Dark Mage', 'Knight', 'Archer']), U('Olivia', 'F', ['Dancer', 'Myrmidon', 'Pegasus Knight']),
    U('Cherche', 'F', ['Wyvern Rider', 'Troubadour', 'Priest']), U("Say'ri", 'F', ['Myrmidon', 'Pegasus Knight', 'Wyvern Rider']),
    U('Flavia', 'F', ['Mercenary', 'Knight', 'Thief']), U('Anna', 'F', ['Thief', 'Archer', 'Mage']),
    U('Tiki', 'F', ['Manakete', 'Wyvern Rider', 'Mage']), U('Emmeryn', 'F', ['Priest', 'Pegasus Knight', 'Troubadour']),
    U('Aversa', 'F', ['Dark Mage', 'Pegasus Knight', 'Knight']), { ...U('Maiden', 'F', [], 'Maiden growths'), growths: STATS.map(() => 0) },
  ].map((u) => [u.name, u]),
);

type Child = { name: string; g: 'M' | 'F'; fixed: string; defaults: string[]; personal: Stats };
const K = (name: string, g: 'M' | 'F', fixed: string, defaults: string[]): Child => ({ name, g, fixed, defaults, personal: mockGrowths(name, 20) });
export const CHILDREN: Child[] = [
  K('Lucina', 'F', 'Chrom', ['Lord', 'Cavalier', 'Archer']), K('Owain', 'M', 'Lissa', ['Myrmidon', 'Priest', 'Fighter']),
  K('Inigo', 'M', 'Olivia', ['Mercenary', 'Myrmidon', 'Fighter']), K('Brady', 'M', 'Maribelle', ['Priest', 'Cavalier', 'Mage']),
  K('Kjelle', 'F', 'Sully', ['Knight', 'Cavalier', 'Myrmidon', 'Wyvern Rider']), K('Cynthia', 'F', 'Sumia', ['Pegasus Knight', 'Knight', 'Priest']),
  K('Severa', 'F', 'Cordelia', ['Mercenary', 'Pegasus Knight', 'Dark Mage']), K('Gerome', 'M', 'Cherche', ['Wyvern Rider', 'Fighter', 'Priest']),
  { ...K('Morgan (F)', 'F', 'Robin (M)', []), personal: [35, 35, 40, 40, 40, 50, 25, 25] }, // real (SF-GR)
  { ...K('Morgan (M)', 'M', 'Robin (F)', []), personal: [35, 35, 40, 40, 40, 50, 25, 25] },
  K('Yarne', 'M', 'Panne', ['Taguel', 'Thief', 'Barbarian']), K('Laurent', 'M', 'Miriel', ['Mage', 'Barbarian', 'Dark Mage']),
  K('Noire', 'F', 'Tharja', ['Archer', 'Dark Mage', 'Knight']), K('Nah', 'F', 'Nowi', ['Manakete', 'Mage', 'Wyvern Rider']),
];
export const CHILD_NAMES = CHILDREN.map((c) => c.name);

// ---- marriage graph (real) ----
const GEN_M = ['Frederick', 'Virion', 'Vaike', 'Stahl', 'Kellam', "Lon'qu", 'Ricken', 'Gaius', 'Gregor', 'Libra', 'Henry', 'Donnel'];
const husbands = (mother: string): string[] => {
  if (mother === 'Sumia') return ['Chrom', 'Frederick', 'Gaius', 'Henry'];
  if (['Sully', 'Maribelle', 'Olivia'].includes(mother)) return ['Chrom', ...GEN_M];
  return GEN_M;
};
const ROBIN_M_WIVES = ['Lissa', 'Sully', 'Miriel', 'Sumia', 'Maribelle', 'Panne', 'Cordelia', 'Nowi', 'Tharja', 'Olivia', 'Cherche', "Say'ri", 'Flavia', 'Anna', 'Tiki', 'Emmeryn', 'Aversa'];
const ROBIN_F_HUSBANDS = ['Chrom', ...GEN_M, 'Basilio', 'Gangrel', 'Walhart', "Yen'fay", 'Priam'];
const CHILD_DAUGHTERS = ['Lucina', 'Kjelle', 'Cynthia', 'Severa', 'Noire', 'Nah'];
const CHILD_SONS = ['Owain', 'Inigo', 'Brady', 'Gerome', 'Yarne', 'Laurent'];

// ---- Robin asset / flaw (REAL: research/stat-inheritance §(d), SF-GR / SF-MOD) ----
export const AF_STATS = ['HP', 'Str', 'Mag', 'Skl', 'Spd', 'Lck', 'Def', 'Res'];
//                                  HP  Str Mag Skl Spd Lck Def Res
const ROBIN_BASE_GROWTH: Stats =    [40, 40, 35, 35, 35, 55, 30, 20];
const ASSET_GROWTH: Stats[] = [[30, 0, 0, 0, 0, 0, 5, 5], [0, 15, 0, 5, 0, 0, 5, 0], [0, 0, 15, 0, 5, 0, 0, 5], [0, 5, 0, 15, 0, 0, 5, 0],
  [0, 0, 0, 5, 15, 5, 0, 0], [0, 5, 5, 0, 0, 15, 0, 0], [0, 0, 0, 0, 0, 5, 15, 5], [0, 0, 5, 0, 5, 0, 0, 15]];
const FLAW_GROWTH: Stats[] = [[20, 0, 0, 0, 0, 0, 5, 5], [0, 10, 0, 5, 0, 0, 5, 0], [0, 0, 10, 0, 5, 0, 0, 5], [0, 5, 0, 10, 0, 0, 5, 0],
  [0, 0, 0, 5, 10, 5, 0, 0], [0, 5, 5, 0, 0, 10, 0, 0], [0, 0, 0, 0, 0, 5, 10, 5], [0, 0, 5, 0, 5, 0, 0, 10]];
const ASSET_MOD: Stats[] = [[0, 1, 1, 0, 0, 2, 2, 2], [0, 4, 0, 2, 0, 0, 2, 0], [0, 0, 4, 0, 2, 0, 0, 2], [0, 2, 0, 4, 0, 0, 2, 0],
  [0, 0, 0, 2, 4, 2, 0, 0], [0, 2, 2, 0, 0, 4, 0, 0], [0, 0, 0, 0, 0, 2, 4, 2], [0, 0, 2, 0, 2, 0, 0, 4]];
const FLAW_MOD: Stats[] = [[0, 1, 1, 0, 0, 1, 1, 1], [0, 3, 0, 1, 0, 0, 1, 0], [0, 0, 3, 0, 1, 0, 0, 1], [0, 1, 0, 3, 0, 0, 1, 0],
  [0, 0, 0, 1, 3, 1, 0, 0], [0, 1, 1, 0, 0, 3, 0, 0], [0, 0, 0, 0, 0, 1, 3, 1], [0, 0, 1, 0, 1, 0, 0, 3]];
const robinProfile = (g: 'M' | 'F', asset: string, flaw: string): Unit => {
  const a = AF_STATS.indexOf(asset), f = AF_STATS.indexOf(flaw);
  const growths = STATS.map((_, i) => ROBIN_BASE_GROWTH[i] + ASSET_GROWTH[a][i] - FLAW_GROWTH[f][i]);
  const mods = STATS.map((_, i) => ASSET_MOD[a][i] - FLAW_MOD[f][i]);
  return { name: `Robin (${g})`, g, classes: REGULAR, growths, mods };
};

// ---- rows ----
export type Row = {
  key: string;
  child: string;
  childG: 'M' | 'F';
  parentLabel: string; // variable parent, "Lucina ← Sumia" when second-gen
  robin: string | null; // "+Spd −Lck" for the Robin involved (fixed Robin for Morgan)
  robinAsset: string | null;
  robinFlaw: string | null;
  groupKey: string; // pairing without Robin's asset/flaw (for collapsing)
  secondGen: boolean;
  growths: Stats;
  mods: Stats;
  classSet: string[]; // final-tier classes reachable
  assumptions: string[];
  // derived per scoring state:
  cls: string | null;
  caps: Stats | null;
  value: Stats | null;
  score: number | null;
  raw: number | null; // unrounded score, for the heatmap
  tag: 'S' | 'M' | '';
  spd: { total: number; bp: number | null; margin: number } | null;
  build: string;
};

const floor3 = (a: number, b: number, c: number) => Math.floor((a + b + c) / 3);
function finalClasses(bases: string[], g: 'M' | 'F') {
  const out = new Set<string>();
  for (const b of bases) for (const p of PROMO[b] ?? []) if (!CLASSES[p].gender || CLASSES[p].gender === g) out.add(p);
  return [...out];
}
const BUILDS = ['Galeforce lead 5/5', 'Galeforce lead 4/5', 'Sol tank 5/5', 'Battery 4/5', 'Lancekiller 3/5', 'Nostank 4/5', 'Crit lead 3/5', '—'];

function makeRow(child: Child, fixed: Unit, variable: Unit, parentLabel: string, robinU: Unit | null, af: [string, string] | null, secondGen: boolean, groupKey: string, extraClasses: string[] = []): Row {
  const growths = STATS.map((_, i) => floor3(fixed.growths[i], variable.growths[i], child.personal[i]));
  const mods = STATS.map((_, i) => (i === 0 ? 0 : fixed.mods[i] + variable.mods[i] + (secondGen ? 0 : 1)));
  const bases = child.name.startsWith('Morgan') ? [...REGULAR, ...extraClasses] : [...child.defaults, ...adapt(variable.classes, child.g)];
  const key = `${child.name}|${parentLabel}|${af ? af.join('/') : ''}`;
  const r = rng(key);
  return {
    key, child: child.name, childG: child.g, parentLabel,
    robin: af ? `+${af[0]} −${af[1]}` : null, robinAsset: af?.[0] ?? null, robinFlaw: af?.[1] ?? null,
    groupKey, secondGen, growths, mods,
    classSet: finalClasses(bases, child.g),
    assumptions: [fixed.assumption, variable.assumption].filter(Boolean) as string[],
    cls: null, caps: null, value: null, score: null, raw: null, tag: '', spd: null,
    build: BUILDS[Math.floor(r() * BUILDS.length)],
  };
  void robinU;
}

export function enumerate(): Row[] {
  const rows: Row[] = [];
  const AFS: [string, string][] = [];
  for (const a of AF_STATS) for (const f of AF_STATS) if (a !== f) AFS.push([a, f]);
  const childProfile = (name: string, variable: Unit): Unit => {
    const c = CHILDREN.find((x) => x.name === name)!;
    const fixed = UNITS[c.fixed];
    return {
      name, g: c.g, classes: [...c.defaults, ...adapt(variable.classes, c.g)],
      growths: STATS.map((_, i) => floor3(fixed.growths[i], variable.growths[i], c.personal[i])),
      mods: STATS.map((_, i) => (i === 0 ? 0 : fixed.mods[i] + variable.mods[i] + 1)),
    };
  };
  for (const child of CHILDREN) {
    if (child.name.startsWith('Morgan')) {
      const rg = child.name === 'Morgan (F)' ? 'M' : 'F';
      const firstGen = rg === 'M' ? ROBIN_M_WIVES : ROBIN_F_HUSBANDS;
      const kids = rg === 'M' ? CHILD_DAUGHTERS : CHILD_SONS;
      const partners: { label: string; u: Unit; second: boolean; special: string[] }[] = firstGen.map((n) => ({ label: n, u: UNITS[n], second: false, special: UNITS[n].classes.filter((c) => c === 'Taguel' || c === 'Manakete') }));
      for (const k of kids) {
        const kc = CHILDREN.find((x) => x.name === k)!;
        const fixedParent = kc.fixed;
        const vps = k === 'Lucina' ? ['Sully', 'Sumia', 'Maribelle', 'Olivia', 'Maiden'] : husbands(fixedParent);
        for (const vp of vps) partners.push({ label: `${k} ← ${vp}`, u: { ...childProfile(k, UNITS[vp]), assumption: UNITS[vp].assumption }, second: true, special: kc.defaults.filter((c) => c === 'Taguel' || c === 'Manakete') });
      }
      for (const p of partners)
        for (const af of AFS)
          rows.push(makeRow(child, robinProfile(rg, af[0], af[1]), p.u, p.label, null, af, p.second, `${child.name}|${p.label}`, p.special));
    } else {
      const fixed = UNITS[child.fixed];
      const vps = child.name === 'Lucina' ? ['Sully', 'Sumia', 'Maribelle', 'Olivia', 'Maiden'] : husbands(child.fixed);
      for (const vp of vps) rows.push(makeRow(child, fixed, UNITS[vp], vp, null, null, false, `${child.name}|${vp}`));
      const rg = child.name === 'Lucina' ? 'F' : 'M';
      for (const af of AFS) rows.push(makeRow(child, fixed, robinProfile(rg, af[0], af[1]), `Robin (${rg})`, null, af, false, `${child.name}|Robin`));
    }
  }
  return rows;
}

// ---- presets (from the scoring decision) ----
export type Preset = { name: string; role: 'Lead' | 'Support' | null; w: number[]; mixed: boolean };
export const PRESETS: Preset[] = [
  { name: 'Physical lead', role: 'Lead', w: [1, 2, 0, 3, 3, 0, 1, 0], mixed: false },
  { name: 'Magical lead', role: 'Lead', w: [1, 0, 2, 3, 3, 0, 1, 0], mixed: false },
  { name: 'Mixed lead', role: 'Lead', w: [1, 2, 2, 3, 3, 0, 1, 0], mixed: true },
  { name: 'Physical hard support', role: 'Lead', w: [0, 3, 0, 1, 0, 0, 0, 0], mixed: false },
  { name: 'Magical hard support', role: 'Lead', w: [0, 0, 3, 1, 0, 0, 0, 0], mixed: false },
  { name: 'Battery', role: 'Support', w: [0, 2, 2, 2, 3, 0, 1, 1], mixed: true },
  { name: 'V/V lead', role: 'Lead', w: [3, 0, 2, 3, 1, 0, 0, 0], mixed: false },
  { name: 'Crisis / crit', role: 'Lead', w: [1, 2, 2, 3, 1, 0, 0, 0], mixed: true },
  { name: 'Tank (main story)', role: 'Lead', w: [2, 1, 0, 2, 0, 0, 3, 3], mixed: false },
  { name: 'Nostank', role: 'Lead', w: [1, 0, 3, 0, 0, 2, 1, 2], mixed: false },
  { name: 'Armsthrift bruiser', role: 'Lead', w: [0, 2, 0, 2, 1, 3, 0, 0], mixed: false },
  { name: 'Lancekiller', role: 'Lead', w: [0, 0, 0, 0, 3, 3, 0, 0], mixed: false },
  { name: 'Staffbot', role: 'Lead', w: [0, 0, 3, 0, 0, 0, 0, 0], mixed: false },
  { name: 'Rallybot / Dancer', role: null, w: [0, 0, 0, 0, 0, 0, 0, 0], mixed: false },
];

// ---- scoring state ----
export type Basis = 'Caps+LB' | 'Caps' | 'Growths';
export type State = {
  preset: number;
  weights: number[];
  mixed: boolean;
  role: 'Lead' | 'Support';
  rank: 'C/B' | 'A/S';
  basis: Basis;
  cls: string; // 'Auto' or class name
  rally: number;
  tonic: boolean;
  pairSpd: number;
  breakpoints: number[];
  // filters
  children: string[]; // empty = all
  parentQuery: string;
  secondGen: boolean;
  dlc: boolean;
  robinMode: 'all' | 'best' | 'pick';
  asset: string;
  flaw: string;
  sort: { col: string; dir: 1 | -1 };
  cols: { growths: boolean; mods: boolean; caps: boolean; speed: boolean; build: boolean };
  // variant-local UI state
  selectedChild: string;
  expanded: Record<string, boolean>;
  pickedAF: Record<string, string>; // groupKey -> 'Asset/Flaw' chosen in the heatmap (D)
  panelOpen: boolean;
  limit: number;
};

export const initialState = (): State => ({
  preset: 0, weights: [...PRESETS[0].w], mixed: false, role: 'Lead', rank: 'A/S', basis: 'Caps+LB', cls: 'Auto',
  rally: 8, tonic: true, pairSpd: 8, breakpoints: [55, 60, 66, 69, 75],
  children: [], parentQuery: '', secondGen: true, dlc: false, robinMode: 'best', asset: 'Spd', flaw: 'Lck',
  sort: { col: 'score', dir: -1 }, cols: { growths: false, mods: true, caps: true, speed: true, build: true },
  selectedChild: 'Lucina', expanded: {}, pickedAF: {}, panelOpen: false, limit: 200,
});

export const presetModified = (s: State) => {
  const p = PRESETS[s.preset];
  return p.w.some((w, i) => w !== s.weights[i]) || p.mixed !== s.mixed;
};

function statValues(row: Row, cls: string, s: State): { caps: Stats; value: Stats } {
  const c = CLASSES[cls];
  const lb = s.basis !== 'Caps';
  const caps = STATS.map((_, i) => c.max[i] + row.mods[i] + (lb && i > 0 ? 10 : 0));
  if (s.role === 'Support') {
    const rankB = s.rank === 'A/S' ? 2 : 1;
    const value = STATS.map((_, i) => {
      if (i === 0) return 0;
      const tier = caps[i] >= 30 ? 3 : caps[i] >= 20 ? 2 : caps[i] >= 10 ? 1 : 0;
      return tier + c.pairUp[i] + (c.pairUp[i] > 0 ? rankB : 0);
    });
    return { caps, value };
  }
  if (s.basis === 'Growths') return { caps, value: STATS.map((_, i) => row.growths[i] + c.growth[i]) };
  return { caps, value: caps };
}

const candidates = (row: Row, s: State) =>
  s.cls === 'Auto' ? row.classSet.concat(s.dlc ? [row.childG === 'M' ? 'Dread Fighter' : 'Bride'] : []) : row.classSet.includes(s.cls) || CLASSES[s.cls].dlc && s.dlc ? [s.cls] : [];

export function score(rows: Row[], s: State) {
  // min-max per stat over all pairings × candidate classes (filters never change a score)
  const lo = STATS.map(() => Infinity), hi = STATS.map(() => -Infinity);
  const cache = new Map<Row, { cls: string; caps: Stats; value: Stats }[]>();
  for (const r of rows) {
    const list = candidates(r, s).map((cls) => ({ cls, ...statValues(r, cls, s) }));
    cache.set(r, list);
    for (const x of list) x.value.forEach((v, i) => ((lo[i] = Math.min(lo[i], v)), (hi[i] = Math.max(hi[i], v))));
  }
  const norm = (v: number, i: number) => (hi[i] === lo[i] ? 0 : (v - lo[i]) / (hi[i] - lo[i]));
  const w = s.weights;
  const noPreset = PRESETS[s.preset].role === null;
  const sumW = s.mixed ? w.reduce((a, b, i) => (i === 2 ? a : a + (i === 1 ? Math.max(w[1], w[2]) : b)), 0) : w.reduce((a, b) => a + b, 0);
  for (const r of rows) {
    let best: { cls: string; caps: Stats; value: Stats; score: number; raw: number; tag: 'S' | 'M' | '' } | null = null;
    for (const x of cache.get(r)!) {
      let tot = 0;
      let tag: 'S' | 'M' | '' = '';
      for (let i = 0; i < 8; i++) {
        if (s.mixed && (i === 1 || i === 2)) continue;
        tot += w[i] * norm(x.value[i], i);
      }
      if (s.mixed) {
        const ns = norm(x.value[1], 1), nm = norm(x.value[2], 2);
        tag = ns >= nm ? 'S' : 'M';
        tot += Math.max(w[1], w[2]) * Math.max(ns, nm);
      }
      const raw = sumW ? (tot / sumW) * 100 : 0;
      if (!best || raw > best.raw) best = { ...x, score: Math.round(raw), raw, tag };
    }
    if (!best) {
      Object.assign(r, { cls: null, caps: null, value: null, score: null, raw: null, tag: '', spd: null });
      continue;
    }
    r.cls = best.cls; r.caps = best.caps; r.value = best.value;
    r.score = noPreset ? null : best.score; r.raw = noPreset ? null : best.raw; r.tag = best.tag;
    if (s.role === 'Support') r.spd = { total: best.value[4], bp: null, margin: 0 };
    else {
      const capSpd = CLASSES[best.cls].max[4] + r.mods[4] + (s.basis === 'Caps' ? 0 : 10);
      const total = capSpd + s.rally + (s.tonic ? 2 : 0) + s.pairSpd;
      const cleared = s.breakpoints.filter((b) => total >= b);
      const bp = cleared.length ? cleared[cleared.length - 1] : null;
      r.spd = { total, bp, margin: bp == null ? total - s.breakpoints[0] : total - bp };
    }
  }
}

export function filtered(rows: Row[], s: State): Row[] {
  const q = s.parentQuery.trim().toLowerCase();
  let out = rows.filter(
    (r) =>
      (s.children.length === 0 || s.children.includes(r.child)) &&
      (s.secondGen || !r.secondGen) &&
      (!q || r.parentLabel.toLowerCase().includes(q)) &&
      (s.robinMode !== 'pick' || !r.robin || (r.robinAsset === s.asset && r.robinFlaw === s.flaw)),
  );
  if (s.robinMode === 'best') {
    const best = new Map<string, Row>();
    for (const r of out) {
      if (!r.robin) { best.set(r.key, r); continue; }
      const b = best.get(r.groupKey);
      if (!b || (r.score ?? -1) > (b.score ?? -1)) best.set(r.groupKey, r);
    }
    out = [...best.values()];
  }
  return sortRows(out, s);
}

export function sortRows(rows: Row[], s: State) {
  const { col, dir } = s.sort;
  const get = (r: Row): number | string | null => {
    if (col === 'score') return r.score;
    if (col === 'child') return r.child;
    if (col === 'parent') return r.parentLabel;
    if (col === 'class') return r.cls;
    if (col === 'spd') return r.spd?.total ?? null;
    const [grp, idx] = col.split(':');
    const i = Number(idx);
    if (grp === 'g') return r.growths[i];
    if (grp === 'm') return r.mods[i];
    if (grp === 'c') return r.caps?.[i] ?? null;
    return null;
  };
  return rows.sort((a, b) => {
    const x = get(a), y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1; // unreachable / blank always last
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}
