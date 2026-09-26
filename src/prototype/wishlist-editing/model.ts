// PROTOTYPE — throwaway (#143). A stub of the wishlist solve: every number is invented, shaped like the decided solve
// (#142): flawless chance in points, ceiling, edits with provisional-then-settled costs, noise band, pins with pin cost,
// an anytime search that offers proposals, Robin alternatives (4 solved, 36 seed-and-ceiling only), reserves with the
// likely loss each covers. Nothing here is real math.

export type Pos = 'Lead' | 'Back' | 'Solo';
export type Job = 'fights' | 'heals' | 'dances';

export interface Unit {
  id: string;
  name: string;
  cls: string;
  skills: string[];
  job: Job;
  /** Flawless points lost without this unit (#141). */
  worth: number;
  /** Children only: [fixed parent, other parent] and the skill each passes at paralogue entry. */
  parents?: [string, string];
  passes?: [string, string];
  forced?: boolean;
}

export interface Slot {
  lead: string;
  back?: string;
}

export interface Reserve {
  id: string;
  covers: string;
}

export type EditKind = 'robin' | 'marriage' | 'position' | 'inout' | 'build';

export interface Edit {
  id: string;
  kind: EditKind;
  /** Short name of the change, read as "what if…". */
  label: string;
  /** Units it touches, for search and for the sheet's cell menus. */
  units: string[];
  /** True cost in flawless points against the current best (negative = worse). */
  delta: number;
  /** Where the points go, e.g. "Gerome +0.3, Lucina −0.4, army −0.9". */
  split?: string;
  /** What it changes in the wishlist. */
  apply: (w: Wishlist) => void;
}

export interface RobinOption {
  id: string;
  label: string; // "F +Spd −Lck"
  spouse: string;
  gist: string;
  solved: boolean;
  chance?: number; // solved only
  seed: number;
  ceiling: number;
  /** Solved only: how its wishlist differs from the best one. */
  diff?: string[];
  /** Solved only: unit changes it makes. */
  apply?: (w: Wishlist) => void;
}

export interface Wishlist {
  units: Record<string, Unit>;
  slots: Slot[];
  reserves: Reserve[];
  marriages: { fixed: string; spouse: string }[];
}

const U = (
  id: string,
  name: string,
  cls: string,
  skills: string[],
  worth: number,
  job: Job = 'fights',
  extra: Partial<Unit> = {},
): Unit => ({ id, name, cls, skills, worth, job, ...extra });

export const ENDPOINT = { map: 'Apotheosis (secret run)', route: 'Full route', deploy: 20, context: 'Lunatic · Classic' };
export const BASE_CHANCE = 41.2;
export const CEILING = 71.0;
export const NOISE = 0.5;
export const ROADMAP = { maps: 38, milestones: 64 };

export function baseWishlist(): Wishlist {
  const units: Record<string, Unit> = {};
  const add = (u: Unit) => (units[u.id] = u);
  add(U('robin', 'Robin', 'Dark Flier', ['Galeforce', 'Veteran', 'Vantage', 'Tomefaire', 'Ignis'], 0, 'fights', { forced: true }));
  add(U('chrom', 'Chrom', 'Great Lord', ['Aether', 'Rightful King', 'Dual Guard+', 'Limit Breaker', 'Luna'], 0, 'fights', { forced: true }));
  add(U('lucina', 'Lucina', 'Great Lord', ['Aether', 'Galeforce', 'Limit Breaker', 'Swordfaire', 'Pavise'], 6.8, 'fights', { parents: ['Chrom', 'Robin'], passes: ['Aether', 'Galeforce'] }));
  add(U('morgan', 'Morgan', 'Grandmaster', ['Ignis', 'Galeforce', 'Tomefaire', 'Aether', 'Vantage'], 4.9, 'fights', { parents: ['Robin', 'Chrom'], passes: ['Ignis', 'Aether'] }));
  add(U('owain', 'Owain', 'Swordmaster', ['Astra', 'Vantage', 'Swordfaire', 'Galeforce', 'Vengeance'], 3.1, 'fights', { parents: ["Lissa", "Lon'qu"], passes: ['Miracle', 'Vantage'] }));
  add(U('cynthia', 'Cynthia', 'Dark Flier', ['Galeforce', 'Aether', 'Luna', 'Limit Breaker', 'Aegis'], 2.2, 'fights', { parents: ['Sumia', 'Frederick'], passes: ['Galeforce', 'Luna'] }));
  add(U('gerome', 'Gerome', 'Wyvern Lord', ['Luna', 'Galeforce', 'Axefaire', 'Limit Breaker', 'Aether'], 5.4, 'fights', { parents: ['Cherche', 'Gregor'], passes: ['Galeforce', 'Axefaire'] }));
  add(U('severa', 'Severa', 'Falcon Knight', ['Galeforce', 'Vantage', 'Aether', 'Luna', 'Dual Guard+'], 1.9, 'fights', { parents: ['Cordelia', 'Stahl'], passes: ['Galeforce', 'Luna'] }));
  add(U('inigo', 'Inigo', 'Hero', ['Sol', 'Luna', 'Vantage', 'Galeforce', 'Axebreaker'], 2.7, 'fights', { parents: ['Olivia', 'Gaius'], passes: ['Galeforce', 'Vantage'] }));
  add(U('noire', 'Noire', 'Sniper', ['Bowfaire', 'Vengeance', 'Luna', 'Galeforce', 'Limit Breaker'], 2.4, 'fights', { parents: ['Tharja', 'Henry'], passes: ['Vengeance', 'Vantage'] }));
  add(U('kjelle', 'Kjelle', 'General', ['Pavise', 'Aegis', 'Luna', 'Counter', 'Limit Breaker'], 3.3, 'fights', { parents: ['Sully', 'Vaike'], passes: ['Luna', 'Axefaire'] }));
  add(U('yarne', 'Yarne', 'Taguel', ['Beastbane', 'Even Rhythm', 'Aegis', 'Galeforce', 'Luna'], 0.8, 'fights', { parents: ['Panne', 'Donnel'], passes: ['Galeforce', 'Aptitude'] }));
  add(U('laurent', 'Laurent', 'Sage', ['Tomefaire', 'Vengeance', 'Luna', 'Galeforce', 'Magic +2'], 2.9, 'fights', { parents: ['Miriel', 'Libra'], passes: ['Tomefaire', 'Renewal'] }));
  add(U('nah', 'Nah', 'Manakete', ['Galeforce', 'Aether', 'Luna', 'Vengeance', 'Tomefaire'], 1.6, 'fights', { parents: ['Nowi', 'Virion'], passes: ['Galeforce', 'Bowfaire'] }));
  add(U('say-ri', "Say'ri", 'Swordmaster', ['Astra', 'Swordfaire', 'Vantage', 'Avoid +10', 'Luna'], 1.1));
  add(U('tiki', 'Tiki', 'Manakete', ['Iote’s Shield', 'Dragonskin', 'Luna', 'Aether', 'Counter'], 0.9));
  add(U('lon-qu', "Lon'qu", 'Swordmaster', ['Astra', 'Vantage', 'Swordfaire', 'Avoid +10', 'Luna'], 1.4));
  add(U('sully', 'Sully', 'Paladin', ['Aegis', 'Luna', 'Dual Strike+', 'Swordfaire', 'Galeforce'], 0.7));
  add(U('brady', 'Brady', 'War Monk', ['Renewal', 'Miracle', 'Magic +2', 'Counter', 'Vengeance'], 3.8, 'heals', { parents: ['Maribelle', 'Ricken'], passes: ['Renewal', 'Magic +2'] }));
  add(U('olivia', 'Olivia', 'Dancer', ['Special Dance', 'Galeforce', 'Vantage', 'Lucky Seven', 'Aether'], 4.6, 'dances'));
  // Reserves (fielded earlier in the run, not at the endpoint).
  add(U('frederick', 'Frederick', 'Paladin', ['Luna', 'Dual Guard+', 'Aegis', 'Pavise', 'Outdoor Fighter'], 0.4));
  add(U('tharja', 'Tharja', 'Dark Knight', ['Vengeance', 'Tomefaire', 'Lifetaker', 'Luna', 'Galeforce'], 0.3));
  add(U('lissa', 'Lissa', 'Sage', ['Renewal', 'Tomefaire', 'Miracle', 'Magic +2', 'Vantage'], 0.2, 'heals'));
  add(U('cordelia', 'Cordelia', 'Falcon Knight', ['Galeforce', 'Luna', 'Vantage', 'Dual Guard+', 'Aegis'], 0.2));
  return {
    units,
    slots: [
      { lead: 'robin', back: 'chrom' },
      { lead: 'lucina', back: 'owain' },
      { lead: 'morgan', back: 'cynthia' },
      { lead: 'gerome', back: 'severa' },
      { lead: 'inigo', back: 'noire' },
      { lead: 'kjelle', back: 'yarne' },
      { lead: 'laurent', back: 'nah' },
      { lead: 'say-ri', back: 'tiki' },
      { lead: 'lon-qu', back: 'sully' },
      { lead: 'brady' },
      { lead: 'olivia' },
    ],
    reserves: [
      { id: 'frederick', covers: 'losing a Lead before Ch 12 (most likely Lucina or Gerome)' },
      { id: 'tharja', covers: 'losing Noire or Laurent on the paralogues' },
      { id: 'lissa', covers: 'losing Brady (the army’s only staff past Ch 18)' },
      { id: 'cordelia', covers: 'losing Severa or Cynthia (flier backs)' },
    ],
    marriages: [
      { fixed: 'Chrom', spouse: 'Robin' },
      { fixed: 'Lissa', spouse: "Lon'qu" },
      { fixed: 'Sumia', spouse: 'Frederick' },
      { fixed: 'Cherche', spouse: 'Gregor' },
      { fixed: 'Cordelia', spouse: 'Stahl' },
      { fixed: 'Olivia', spouse: 'Gaius' },
      { fixed: 'Tharja', spouse: 'Henry' },
      { fixed: 'Sully', spouse: 'Vaike' },
      { fixed: 'Panne', spouse: 'Donnel' },
      { fixed: 'Miriel', spouse: 'Libra' },
      { fixed: 'Nowi', spouse: 'Virion' },
      { fixed: 'Maribelle', spouse: 'Ricken' },
    ],
  };
}

const setFather = (child: string, father: string, passes?: string) => (w: Wishlist) => {
  const u = w.units[child]!;
  u.parents = [u.parents![0], father];
  if (passes) u.passes = [u.passes![0], passes];
  const m = w.marriages.find((x) => x.fixed === u.parents![0]);
  if (m) m.spouse = father;
};
const swapPos = (lead: string, back: string) => (w: Wishlist) => {
  const s = w.slots.find((x) => x.lead === back && x.back === lead) ?? w.slots.find((x) => x.lead === lead);
  if (s) (s.lead = lead), (s.back = back);
};
const swapBacks = (a: string, b: string) => (w: Wishlist) => {
  const sa = w.slots.find((x) => x.back === a)!;
  const sb = w.slots.find((x) => x.back === b)!;
  sa.back = b;
  sb.back = a;
};
const bringIn = (inn: string, out: string, covers: string) => (w: Wishlist) => {
  for (const s of w.slots) {
    if (s.lead === out) s.lead = inn;
    if (s.back === out) s.back = inn;
  }
  w.reserves = w.reserves.filter((r) => r.id !== inn);
  w.reserves.push({ id: out, covers });
};
const setBuild = (u: string, i: number, skill: string) => (w: Wishlist) => {
  w.units[u]!.skills[i] = skill;
};

/** Every edit the stub knows. The real solve would generate these for any unit. */
export const EDITS: Edit[] = [
  // Marriages: the other parent of each child. Close calls sit inside the noise band.
  { id: 'm-lissa-gaius', kind: 'marriage', label: "Owain's father: Gaius instead of Lon'qu", units: ['owain', 'lon-qu'], delta: -0.9, split: 'Owain −0.6, army −0.3', apply: setFather('owain', 'Gaius', 'Galeforce') },
  { id: 'm-lissa-vaike', kind: 'marriage', label: "Owain's father: Vaike instead of Lon'qu", units: ['owain'], delta: -1.6, split: 'Owain −1.1, Kjelle −0.5', apply: setFather('owain', 'Vaike', 'Axefaire') },
  { id: 'm-sumia-henry', kind: 'marriage', label: "Cynthia's father: Henry instead of Frederick", units: ['cynthia'], delta: -0.3, split: 'Cynthia +0.2, Noire −0.5', apply: setFather('cynthia', 'Henry', 'Vengeance') },
  { id: 'm-sumia-gaius', kind: 'marriage', label: "Cynthia's father: Gaius instead of Frederick", units: ['cynthia'], delta: -1.1, split: 'Cynthia −0.3, Inigo −0.8', apply: setFather('cynthia', 'Gaius', 'Galeforce') },
  { id: 'm-cherche-virion', kind: 'marriage', label: "Gerome's father: Virion instead of Gregor", units: ['gerome'], delta: -0.2, split: 'Gerome −0.4, Nah +0.2', apply: setFather('gerome', 'Virion', 'Bowfaire') },
  { id: 'm-cherche-stahl', kind: 'marriage', label: "Gerome's father: Stahl instead of Gregor", units: ['gerome'], delta: -1.4, split: 'Gerome −0.7, Severa −0.7', apply: setFather('gerome', 'Stahl', 'Luna') },
  { id: 'm-cordelia-gaius', kind: 'marriage', label: "Severa's father: Gaius instead of Stahl", units: ['severa'], delta: -0.6, split: 'Severa +0.3, Inigo −0.9', apply: setFather('severa', 'Gaius', 'Galeforce') },
  { id: 'm-tharja-libra', kind: 'marriage', label: "Noire's father: Libra instead of Henry", units: ['noire'], delta: -0.8, split: 'Noire −0.1, Laurent −0.7', apply: setFather('noire', 'Libra', 'Renewal') },
  { id: 'm-sully-donnel', kind: 'marriage', label: "Kjelle's father: Donnel instead of Vaike", units: ['kjelle'], delta: -0.4, split: 'Kjelle +0.3, Yarne −0.7', apply: setFather('kjelle', 'Donnel', 'Aptitude') },
  { id: 'm-panne-vaike', kind: 'marriage', label: "Keep Vaike's Yarne: Yarne's father Vaike instead of Donnel", units: ['yarne'], delta: -2.4, split: 'Yarne +0.4, Kjelle −2.8 (Kjelle loses Vaike)', apply: setFather('yarne', 'Vaike', 'Axefaire') },
  { id: 'm-miriel-ricken', kind: 'marriage', label: "Laurent's father: Ricken instead of Libra", units: ['laurent'], delta: -0.7, split: 'Laurent +0.2, Brady −0.9', apply: setFather('laurent', 'Ricken', 'Magic +2') },
  { id: 'm-nowi-gregor', kind: 'marriage', label: "Nah's father: Gregor instead of Virion", units: ['nah'], delta: -0.5, split: 'Nah +0.1, Gerome −0.6', apply: setFather('nah', 'Gregor', 'Axefaire') },
  // Positions.
  { id: 'p-gerome-lucina', kind: 'position', label: 'Gerome leads, Lucina backs him', units: ['gerome', 'lucina'], delta: -1.0, split: 'Gerome +0.3, Lucina −0.4, army −0.9', apply: (w) => { swapPos('gerome', 'lucina')(w); w.slots.find((s) => s.lead === 'lucina')!.lead = 'severa'; w.slots.find((s) => s.back === 'severa')!.back = 'owain'; } },
  { id: 'p-owain-leads', kind: 'position', label: 'Owain leads, Lucina backs him', units: ['owain', 'lucina'], delta: -2.1, split: 'Owain +0.5, Lucina −2.6', apply: swapPos('owain', 'lucina') },
  { id: 'p-noire-leads', kind: 'position', label: 'Noire leads, Inigo backs her', units: ['noire', 'inigo'], delta: -0.3, split: 'Noire +0.4, Inigo −0.7', apply: swapPos('noire', 'inigo') },
  { id: 'p-olivia-pair', kind: 'position', label: 'Olivia backs Laurent instead of dancing solo', units: ['olivia', 'laurent'], delta: -3.9, split: 'army −3.9 (one fewer Dance a turn)', apply: (w) => { w.slots = w.slots.filter((s) => s.lead !== 'olivia'); w.slots.find((s) => s.lead === 'laurent')!.back = 'olivia'; w.slots.push({ lead: 'nah' }); } },
  // In / out.
  { id: 'io-frederick-in', kind: 'inout', label: 'Keep Frederick in, Sully to the reserves', units: ['frederick', 'sully'], delta: -0.2, split: 'Frederick +0.3, Sully −0.5', apply: bringIn('frederick', 'sully', 'losing a back on the late maps') },
  { id: 'io-tharja-in', kind: 'inout', label: "Keep Tharja in, Say'ri to the reserves", units: ['tharja', 'say-ri'], delta: -1.3, split: "Tharja +0.2, Say'ri −1.5", apply: bringIn('tharja', 'say-ri', 'losing a sword Lead') },
  { id: 'io-yarne-out', kind: 'inout', label: 'Leave Yarne out, Cordelia backs Kjelle', units: ['yarne', 'cordelia'], delta: -0.6, split: 'Yarne −0.8, Cordelia +0.2', apply: bringIn('cordelia', 'yarne', 'losing Kjelle’s back') },
  // Builds.
  { id: 'b-lucina-pavise', kind: 'build', label: 'Lucina: Dual Guard+ instead of Pavise', units: ['lucina'], delta: -0.1, split: 'Lucina −0.1', apply: setBuild('lucina', 4, 'Dual Guard+') },
  { id: 'b-morgan-vantage', kind: 'build', label: 'Morgan: Lifetaker instead of Vantage', units: ['morgan'], delta: -0.8, split: 'Morgan −0.8', apply: setBuild('morgan', 4, 'Lifetaker') },
];

/** Improvements the anytime search finds after the page opens: [ms after load, edit]. */
export const PROPOSALS: [number, Edit][] = [
  [4000, { id: 'pr-backs', kind: 'position', label: 'Swap backs: Cynthia behind Gerome, Severa behind Morgan', units: ['cynthia', 'severa', 'gerome', 'morgan'], delta: 0.7, split: 'Gerome +0.5, Morgan +0.2', apply: swapBacks('cynthia', 'severa') }],
  [9000, { id: 'pr-owain-build', kind: 'build', label: 'Owain: Luna instead of Vengeance', units: ['owain'], delta: 0.9, split: 'Owain +0.9 (Ch 22 onward)', apply: setBuild('owain', 4, 'Luna') }],
];

const ROBIN_SOLVED: RobinOption[] = [
  { id: 'f-spd-lck', label: 'F +Spd −Lck', spouse: 'Chrom', gist: 'Lucina +3.2, Morgan early (Ch 13)', solved: true, chance: 41.2, seed: 33.0, ceiling: 71.0, diff: [] },
  {
    id: 'm-str-res', label: 'M +Str −Res', spouse: 'Lucina', gist: 'strong Morgan (F), Chrom marries Sumia', solved: true, chance: 39.8, seed: 32.1, ceiling: 70.2,
    diff: ['Robin marries Lucina; Morgan is a daughter', 'Chrom marries Sumia: Cynthia’s father is Chrom', 'Frederick moves to the endpoint army, Sully to the reserves'],
    apply: (w) => {
      w.units.robin!.cls = 'Grandmaster';
      w.units.morgan = { ...w.units.morgan!, name: 'Morgan (F)', parents: ['Robin', 'Lucina'], passes: ['Ignis', 'Aether'], worth: 3.6 };
      w.units.cynthia!.parents = ['Sumia', 'Chrom'];
      w.units.lucina!.parents = ['Chrom', 'Sumia'];
      w.marriages[0] = { fixed: 'Chrom', spouse: 'Sumia' };
      w.marriages[2] = { fixed: 'Robin', spouse: 'Lucina' };
      bringIn('frederick', 'sully', 'losing a back on the late maps')(w);
    },
  },
  {
    id: 'm-spd-lck', label: 'M +Spd −Lck', spouse: 'Tharja', gist: 'Noire and Morgan both from Robin', solved: true, chance: 38.9, seed: 31.4, ceiling: 69.5,
    diff: ['Robin marries Tharja: Noire’s father is Robin', 'Chrom marries Olivia: Inigo’s father is Chrom', 'Henry moves to the reserves'],
    apply: (w) => {
      w.units.noire!.parents = ['Tharja', 'Robin'];
      w.units.inigo!.parents = ['Olivia', 'Chrom'];
      w.units.lucina!.parents = ['Chrom', 'Olivia'];
      w.units.morgan = { ...w.units.morgan!, name: 'Morgan (F)', parents: ['Robin', 'Tharja'], worth: 3.9 };
      w.marriages[0] = { fixed: 'Chrom', spouse: 'Olivia' };
      w.marriages[6] = { fixed: 'Tharja', spouse: 'Robin' };
    },
  },
  {
    id: 'f-str-def', label: 'F +Str −Def', spouse: 'Yarne', gist: 'strongest Morgan, but late (Ch 21)', solved: true, chance: 37.5, seed: 30.8, ceiling: 72.4,
    diff: ['Robin marries Yarne: Morgan arrives Ch 21, strongest at caps', 'Chrom marries Sumia', 'Lucina −1.8 (Chrom’s passed skill changes)'],
    apply: (w) => {
      w.units.morgan = { ...w.units.morgan!, parents: ['Robin', 'Yarne'], passes: ['Ignis', 'Beastbane'], worth: 5.6 };
      w.units.robin!.cls = 'Sorcerer';
      w.units.lucina!.parents = ['Chrom', 'Sumia'];
      w.units.cynthia!.parents = ['Sumia', 'Chrom'];
      w.marriages[0] = { fixed: 'Chrom', spouse: 'Sumia' };
    },
  },
];

const STATS = ['HP', 'Str', 'Mag', 'Skl', 'Spd', 'Lck', 'Def', 'Res'];
const SPOUSES_F = ['Chrom', 'Frederick', 'Gaius', "Lon'qu", 'Virion', 'Henry', 'Libra', 'Vaike'];
const SPOUSES_M = ['Lucina', 'Sumia', 'Cordelia', 'Tharja', 'Olivia', 'Cherche', 'Maribelle', 'Miriel'];
function robinRest(): RobinOption[] {
  const out: RobinOption[] = [];
  let k = 0;
  for (const g of ['F', 'M'] as const)
    for (const a of STATS)
      for (const f of STATS) {
        if (a === f || out.length >= 36) continue;
        const label = `${g} +${a} −${f}`;
        if (ROBIN_SOLVED.some((o) => o.label === label)) continue;
        k++;
        const seed = 31 - ((k * 7) % 11) * 0.9;
        out.push({
          id: label, label, solved: false, gist: 'screened only', seed: +seed.toFixed(1), ceiling: +(70.5 - ((k * 5) % 9) * 0.8).toFixed(1),
          spouse: (g === 'F' ? SPOUSES_F : SPOUSES_M)[k % 8]!,
        });
      }
  return out;
}
export const ROBIN_OPTIONS: RobinOption[] = [...ROBIN_SOLVED, ...robinRest()];

/** A stubbed full solve of a screened Robin: lands below the best. */
export const solveRobin = (o: RobinOption): number => +(o.seed + 5.5 - ((o.label.length * 3) % 5) * 0.4).toFixed(1);
