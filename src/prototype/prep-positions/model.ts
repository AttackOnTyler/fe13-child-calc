// PROTOTYPE — throwaway (#258). The Prologue (Lunatic) for three position-plan pages.
// @ts-nocheck — prototype, strict index checks skipped on purpose
// Real: the grid (ROM capture, #237), turn-1 units and their stats (attempt 1's bookmark and stat panels), wake groups (#254),
// reach and danger (a plain BFS here). Stub: the script itself (hand-written, not solved), damage (Atk − Def, doubling at
// Spd +5, no triangle or rank), probabilities and crit risk.

export const ROWS = [
  '111111ttttt111111', '11111111111111111', '11111111111111111', 'ggggggg+++ggggggg', 'ggggggg+++ggggggg', 'ggggggg+++ggggggg',
  '11111111111gg1111', '11111111111gg1111', '111BB11BB11++1111', '11111111111++1111', '11111111111gg1111', '111BB11BB11ggg++g',
  '11111111111ggg++g', '11111111111gg1111', '11111111111gg1111', '11111111111gg1111',
];
export const W = 17;
export const H = 16;
export const TERRAIN: Record<string, string> = { '1': 'Plain', g: 'Water', t: 'Edifice', B: 'Stall', '+': 'Bridge' };
export const walkable = (x: number, y: number) => x >= 1 && x <= 15 && y >= 1 && y <= 14 && (ROWS[y]![x] === '1' || ROWS[y][x] === '+');

export type Side = 'ally' | 'enemy';
export type Unit = {
  id: string; name: string; cls: string; side: Side; x: number; y: number;
  hp: number; atk: number; magic: boolean; spd: number; def: number; res: number; lck: number;
  mov: number; range: [number, number]; weapon: string;
  skills: string[]; possible?: string[]; wake?: 'now' | 'group 1' | 'never moves';
};

export const ALLIES: Unit[] = [
  { id: 'fre', name: 'Frederick', cls: 'Great Knight', side: 'ally', x: 2, y: 14, hp: 28, atk: 27, magic: false, spd: 10, def: 14, res: 3, lck: 6, mov: 7, range: [1, 1], weapon: 'Silver Lance', skills: ['Discipline', 'Outdoor Fighter'] },
  { id: 'chr', name: 'Chrom', cls: 'Lord', side: 'ally', x: 3, y: 13, hp: 20, atk: 12, magic: false, spd: 8, def: 7, res: 1, lck: 5, mov: 5, range: [1, 1], weapon: 'Falchion', skills: ['Dual Strike+'] },
  { id: 'rob', name: 'Robin', cls: 'Tactician', side: 'ally', x: 4, y: 14, hp: 19, atk: 8, magic: true, spd: 6, def: 5, res: 4, lck: 4, mov: 5, range: [1, 2], weapon: 'Thunder', skills: ['Veteran'] },
  { id: 'lis', name: 'Lissa', cls: 'Cleric', side: 'ally', x: 1, y: 13, hp: 17, atk: 0, magic: true, spd: 4, def: 3, res: 4, lck: 8, mov: 5, range: [1, 1], weapon: 'Heal', skills: ['Miracle'] },
];
const myr = (id: string, x: number, y: number, wake: Unit['wake'], rolled: string[]): Unit => ({ id, name: 'Myrmidon', cls: 'Myrmidon', side: 'enemy', x, y, hp: 26, atk: 16, magic: false, spd: 12, def: 1, res: 2, lck: 10, mov: 5, range: [1, 1], weapon: 'Iron Sword', skills: rolled, possible: ['Avoid +10'], wake });
const bar = (id: string, x: number, y: number, wake: Unit['wake']): Unit => ({ id, name: 'Barbarian', cls: 'Barbarian', side: 'enemy', x, y, hp: 30, atk: 19, magic: false, spd: 9, def: 1, res: 0, lck: 5, mov: 5, range: [1, 1], weapon: 'Iron Axe', skills: [], possible: ['Gamble'], wake });
export const ENEMIES: Unit[] = [
  myr('m1', 4, 10, 'now', ['Avoid +10']), myr('m2', 9, 12, 'now', []), bar('b1', 1, 8, 'now'), bar('b2', 7, 9, 'now'),
  { id: 'w', name: 'Mage', cls: 'Mage', side: 'enemy', x: 10, y: 6, hp: 23, atk: 16, magic: true, spd: 9, def: 0, res: 4, lck: 8, mov: 5, range: [1, 2], weapon: 'Elwind', skills: [], possible: ['Magic +2', 'Focus'], wake: 'now' },
  myr('m3', 7, 3, 'group 1', ['Avoid +10']), myr('m4', 9, 3, 'group 1', []), bar('b3', 6, 2, 'group 1'), bar('b4', 10, 2, 'group 1'),
  { id: 't', name: 'Mage', cls: 'Mage', side: 'enemy', x: 8, y: 2, hp: 23, atk: 18, magic: true, spd: 9, def: 0, res: 4, lck: 8, mov: 5, range: [1, 2], weapon: 'Elthunder', skills: ['Focus'], possible: ['Magic +2', 'Focus'], wake: 'group 1' },
  { id: 'g', name: 'Garrick', cls: 'Barbarian (boss)', side: 'enemy', x: 8, y: 1, hp: 34, atk: 22, magic: false, spd: 12, def: 3, res: 0, lck: 5, mov: 0, range: [1, 2], weapon: 'Short Axe', skills: ['Gamble'], wake: 'never moves' },
];

// ---- reach and danger (real BFS; damage is a stub) ----------------------------------------------------------------
export type Pos = Record<string, [number, number]>;
const key = (x: number, y: number) => `${x},${y}`;
export function reach(u: Unit, at: [number, number], blocked: Set<string>): Map<string, number> {
  const d = new Map([[key(...at), 0]]);
  const q: [number, number][] = [at];
  while (q.length) {
    const [x, y] = q.shift()!; const k = d.get(key(x, y))!;
    if (k >= u.mov) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (!walkable(nx, ny) || d.has(nk) || blocked.has(nk)) continue;
      d.set(nk, k + 1); q.push([nx, ny]);
    }
  }
  return d;
}
/** Every tile a foe can strike this enemy phase (move, then its weapon's range), with allies blocking its path. */
export function strikeTiles(e: Unit, at: [number, number], allyTiles: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const k of reach(e, at, allyTiles).keys()) {
    if (allyTiles.has(k) && k !== key(...at)) continue;
    const [x, y] = k.split(',').map(Number);
    for (let dx = -e.range[1]; dx <= e.range[1]; dx++) for (let dy = -e.range[1]; dy <= e.range[1]; dy++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m >= e.range[0] && m <= e.range[1]) out.add(key(x + dx, y + dy));
    }
  }
  return out;
}
/** A foe's worst non-crit round on a unit (stub math). */
export function round(e: Unit, a: Unit, cautiousSkills: string[]): { dmg: number; hits: number } {
  const plus = e.magic && cautiousSkills.includes('Magic +2') ? 2 : 0;
  const dmg = Math.max(0, e.atk + plus - (e.magic ? a.res : a.def));
  return { dmg, hits: e.spd - a.spd >= 5 ? 2 : 1 };
}
export type Danger = { tile: string; foes: { id: string; dmg: number; hits: number }[]; total: number };
/** The gang-up worst case on one ally at every tile: each awake foe that can strike the tile, every non-crit hit landing. */
export function dangerFor(ally: Unit, enemyPos: Pos, allyPos: Pos, awake: Set<string>, skillsOf: (e: Unit) => string[]): Map<string, Danger> {
  const allyTiles = new Set(Object.entries(allyPos).filter(([id]) => id !== ally.id).map(([, p]) => key(...p)));
  const out = new Map<string, Danger>();
  for (const e of ENEMIES) {
    if (!awake.has(e.id) || !enemyPos[e.id]) continue;
    const r = round(e, ally, skillsOf(e));
    for (const t of strikeTiles(e, enemyPos[e.id], allyTiles)) {
      const d = out.get(t) ?? { tile: t, foes: [], total: 0 };
      d.foes.push({ id: e.id, ...r }); d.total += r.dmg * r.hits; out.set(t, d);
    }
  }
  return out;
}

// ---- the stub script ---------------------------------------------------------------------------------------------
export type Action = {
  id: string; unit: string; to?: [number, number]; cmd: string; target?: string; forecast?: string; why: string;
  pair?: string; equip?: string; branch?: string; exp?: string;
};
export type EnemyMove = { id: string; to: [number, number]; does: string };
export type Turn = {
  n: number; detailed: boolean; title: string; actions: Action[]; enemy: EnemyMove[];
  safe: boolean; safety: string; crit: number; wakes?: string; dead?: string[]; outline?: string;
  /** Where everyone ends the player phase (for the board). */
  allies: Pos; foes: Pos; awake: string[];
};

const SOUTH = ['m1', 'm2', 'b1', 'b2', 'w'];
const NORTH = ['m3', 'm4', 'b3', 'b4', 't'];
const start = (ids: string[]) => Object.fromEntries(ENEMIES.filter((e) => ids.includes(e.id)).map((e) => [e.id, [e.x, e.y]])) as Pos;

export const SCRIPT: Turn[] = [
  {
    n: 1, detailed: true, title: 'Frederick charges: kill the Myrmidon, draw the south onto him', safe: true, crit: 1.2,
    safety: 'Found by a search over the grid (search-t1.ts): 36 safe forward openings; this one draws the most foes onto Frederick while Robin and Lissa stay out of every reach.',
    allies: { fre: [5, 10], chr: [5, 10], rob: [2, 14], lis: [3, 13] }, foes: { m2: [9, 12], b1: [1, 8], b2: [7, 9], w: [10, 6], ...start(NORTH), g: [8, 1] }, awake: ['m2', 'b1', 'b2', 'w', 'g'], dead: ['m1'],
    actions: [
      { id: '1a', unit: 'chr', to: [2, 14], cmd: 'Pair Up', target: 'fre', pair: 'Frederick leads, Chrom behind', why: 'Chrom rides along out of reach; +3 Spd, +3 Lck to Frederick. Chrom × Frederick support points.' },
      { id: '1b', unit: 'fre', to: [5, 10], cmd: 'Attack', target: 'm1', forecast: '27 vs 26 HP · 100% · counter 2 at 73% · DS 35%', why: 'A turn-1 kill, and (5,10) is the tile the southern Myrmidon and both Barbarians can reach — nobody else can be.', exp: 'Frederick +11' },
      { id: '1c', unit: 'lis', to: [3, 13], cmd: 'Wait', why: 'Out of every foe’s reach; 4 moves from Frederick for a heal on T3.' },
      { id: '1d', unit: 'rob', to: [2, 14], cmd: 'Wait', equip: 'Thunder', why: 'Out of reach; from here (4,12) is 4 moves: Thunder range 2 onto the western Barbarian next turn.' },
    ],
    enemy: [
      { id: 'm2', to: [5, 11], does: 'attacks Frederick: 2 dmg · counter 27 kills it' },
      { id: 'b1', to: [4, 10], does: 'attacks Frederick: 5 dmg · counter 24 (→ 6 HP)' },
      { id: 'b2', to: [6, 10], does: 'attacks Frederick: 5 dmg · counter 24 (→ 6 HP)' },
      { id: 'w', to: [8, 9], does: 'moves up, no target in reach' },
    ],
  },
  {
    n: 2, detailed: true, title: 'Frederick kills the Mage; Robin finishes a Barbarian from range 2', safe: true, crit: 1.0,
    safety: 'The one 6-HP Barbarian left can reach Robin (14 < 19) and Frederick, not Lissa in the corner.',
    allies: { fre: [8, 10], chr: [8, 10], rob: [4, 12], lis: [1, 14] }, foes: { b2: [6, 10], ...start(NORTH), g: [8, 1] }, awake: ['b2', 'g'], dead: ['m1', 'm2', 'b1', 'w'],
    actions: [
      { id: '2a', unit: 'fre', to: [8, 10], cmd: 'Attack', target: 'w', forecast: '27 vs 23 HP · 100% · counter 13 at 55%', why: 'The Mage is the south’s only foe that can kill Lissa at range 2; it dies before it gets the chance.', exp: 'Frederick +11' },
      { id: '2b', unit: 'rob', to: [4, 12], cmd: 'Attack', target: 'b1', forecast: 'Thunder 8 vs 6 HP · 83% · no counter (range 2)', why: 'Range 2: no counter.', exp: 'Robin +30 (Veteran)', branch: 'If Thunder misses: Robin still ends at (4,12); both 6-HP Barbarians can reach him (14 + 14 = 28 ≥ 19). Re-plan: Lissa stays cornered, and Frederick’s attack goes to the (6,10) Barbarian instead of the Mage.' },
      { id: '2c', unit: 'lis', to: [1, 14], cmd: 'Wait', why: 'The corner: out of the last Barbarian’s reach.' },
    ],
    enemy: [{ id: 'b2', to: [5, 12], does: 'attacks Robin: 14 dmg (→ 5) · Thunder counter 8 kills it at 83%' }],
  },
  {
    n: 3, detailed: true, title: 'South clear: heal up and stage out of the north’s reach', safe: true, crit: 0.0,
    safety: 'Only the sleeping north and Garrick remain; nobody ends where group 1 would wake.',
    allies: { fre: [6, 9], chr: [6, 9], rob: [5, 10], lis: [5, 9] }, foes: { ...start(NORTH), g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2'],
    actions: [
      { id: '3a', unit: 'lis', to: [5, 9], cmd: 'Heal', target: 'fre', forecast: '+10 HP (16 → 26)', why: 'Frederick needs 26+ to take the north’s gang-up on T4.', exp: 'Lissa +17' },
      { id: '3b', unit: 'fre', to: [6, 9], cmd: 'Wait', why: 'Stages 3 tiles from the bridge’s foot without waking group 1.' },
      { id: '3c', unit: 'rob', to: [5, 10], cmd: 'Wait', why: 'Next to Lissa and Frederick: summed support ranks for next turn’s fights.' },
    ],
    enemy: [],
  },
  {
    n: 4, detailed: false, title: 'Pull the northern group onto the wall', safe: true, crit: 2.1, wakes: 'group 1 (2 Myrmidons, 2 Barbarians, Elthunder Mage)', allies: { fre: [7, 6], chr: [7, 6], rob: [5, 10], lis: [4, 10] }, foes: { ...start(NORTH), g: [8, 1] }, awake: [...NORTH, 'g'], dead: ['m1', 'm2', 'b1', 'w', 'b2'],
    safety: 'Outline.', outline: 'Frederick to (7,6), the bridge’s foot: wakes group 1 on purpose (#254). The bridge lets only a few reach him; the Myrmidons die on counters.', actions: [], enemy: [],
  },
  {
    n: 5, detailed: false, title: 'Finish the north', safe: true, crit: 1.2, allies: { fre: [8, 4], chr: [8, 4], rob: [7, 6], lis: [6, 6] }, foes: { g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2', 'm3', 'm4', 'b3', 'b4', 't'],
    safety: 'Outline.', outline: 'Frederick kills the Elthunder Mage; Robin chips a Barbarian from 2. Handoff: Chrom’s Vulnerary to Robin for Chapter 1.', actions: [], enemy: [],
  },
  {
    n: 6, detailed: false, title: 'Garrick', safe: true, crit: 5.0, allies: { fre: [8, 2], chr: [8, 2], rob: [7, 5], lis: [9, 5] }, foes: { g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2', 'm3', 'm4', 'b3', 'b4', 't'],
    safety: 'Outline. Nobody can stand next to Frederick for crit-avoid: Garrick’s Short Axe kills Robin or Lissa at range 1–2, so his 5% Gamble crit is accepted.', outline: 'Frederick attacks from (8,2); Garrick’s counter and his enemy-phase attack are the map’s biggest crit risk. Rout on turn 6.', actions: [], enemy: [],
  },
];

export const HEADLINE = { crit: 9.8, rout: 6, stretch: 6, baseline: '11 turns, Lissa lost, one deviation' };
export const HANDOFF = 'For Chapter 1 (no Preparations): Vulnerary → Robin on T5; Chrom keeps the Rapier; Frederick’s Silver Lance at 20+ uses.';
export const byId = (id: string) => [...ALLIES, ...ENEMIES].find((u) => u.id === id)!;
