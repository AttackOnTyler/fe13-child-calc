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
    n: 1, detailed: true, title: 'Wall with Frederick; keep Robin and Lissa out of reach', safe: true, crit: 0.8,
    safety: 'Frederick walls; everyone else ends out of reach.',
    allies: { fre: [2, 12], chr: [2, 12], rob: [3, 14], lis: [2, 14] }, foes: { ...start([...SOUTH, ...NORTH]), g: [8, 1] }, awake: [...SOUTH, 'g'],
    actions: [
      { id: '1a', unit: 'chr', to: [2, 14], cmd: 'Pair Up', target: 'fre', pair: 'Frederick leads, Chrom behind', why: 'Chrom out of reach as the back; +3 Spd, +3 Lck to Frederick (Lord pair-up). Starts Chrom × Frederick support points.' },
      { id: '1b', unit: 'fre', to: [2, 12], cmd: 'Wait', why: 'Draws the southern Myrmidon and Barbarian onto the wall: both die or break on counters.' },
      { id: '1c', unit: 'lis', to: [2, 14], cmd: 'Wait', why: 'Out of every foe’s reach (checked against all 5 awake).' },
      { id: '1d', unit: 'rob', to: [3, 14], cmd: 'Wait', equip: 'Thunder', why: 'Out of reach; adjacent to Lissa (+10 hit next turn). Ends holding Thunder: counters at 1–2.' },
    ],
    enemy: [
      { id: 'm1', to: [2, 11], does: 'attacks Frederick: 0 dmg · Frederick’s counter 27 kills it' },
      { id: 'b1', to: [1, 12], does: 'attacks Frederick: 5 dmg · counter 24 (→ 6 HP)' },
      { id: 'm2', to: [4, 12], does: 'moves up, no target in reach' },
      { id: 'b2', to: [5, 12], does: 'moves up, no target in reach' },
      { id: 'w', to: [8, 9], does: 'moves up, no target in reach' },
    ],
  },
  {
    n: 2, detailed: true, title: 'Kill both near threats; Robin finishes from range 2', safe: true, crit: 1.4,
    safety: 'Both near threats die before enemy phase; the Barbarian can reach Robin only.',
    allies: { fre: [3, 12], chr: [3, 12], rob: [2, 13], lis: [2, 12] }, foes: { b2: [5, 12], w: [8, 9], ...start(NORTH), g: [8, 1] }, awake: ['b2', 'w', 'g'], dead: ['m1', 'm2', 'b1'],
    actions: [
      { id: '2a', unit: 'fre', to: [3, 12], cmd: 'Attack', target: 'm2', forecast: '27 vs 26 HP · 100% · counter 6 at 73% · DS 35%', why: 'The only unit that kills the Myrmidon; alive, it doubles Robin (24 ≥ 19).', exp: 'Frederick +11' },
      { id: '2b', unit: 'rob', to: [2, 13], cmd: 'Attack', target: 'b1', forecast: 'Thunder 8 vs 6 HP · 83% · no counter (range 2)', why: 'Range 2: the Barbarian can’t counter. Lissa adjacent: +10 hit.', exp: 'Robin +30 (Veteran)', branch: 'If Thunder misses: Lissa stays at (2,14), Robin waits; the Barbarian can reach only Robin (12 < 19). Still safe.' },
      { id: '2c', unit: 'lis', to: [2, 12], cmd: 'Heal', target: 'fre', forecast: '+10 HP', why: 'Out of reach of the Elwind Mage at (8,9) and the Barbarian (blocked).', exp: 'Lissa +17' },
    ],
    enemy: [
      { id: 'b2', to: [3, 13], does: 'attacks Robin: 14 dmg (→ 5) · Thunder counter 8' },
      { id: 'w', to: [4, 10], does: 'moves up, no target in reach' },
    ],
  },
  {
    n: 3, detailed: true, title: 'No safe line: two foes can each kill Lissa without a crit', safe: false, crit: 1.1,
    safety: 'Breaks the hard line. The Elwind Mage doubles Lissa (12 × 2 = 24 ≥ 17) and the Barbarian doubles her too (16 × 2 = 32); the pair can kill only one. Least-risk line below: the Barbarian needs both hits (85% × 85% ≈ 72%) — so the fix is upstream: a 3-turn search would reject T2’s Lissa-heals-from-(2,12) before we get here (stub).',
    allies: { fre: [4, 11], chr: [4, 11], rob: [1, 13], lis: [1, 14] }, foes: { b2: [3, 13], ...start(NORTH), g: [8, 1] }, awake: ['b2', 'g'], dead: ['m1', 'm2', 'b1', 'w'],
    actions: [
      { id: '3d', unit: 'chr', cmd: 'Trade', target: 'fre', why: 'Free before Frederick acts: Chrom’s Vulnerary to Frederick for T4–T5.' },
      { id: '3a', unit: 'fre', to: [4, 11], cmd: 'Attack', target: 'w', forecast: '27 vs 23 HP · 100% · counter 13 at 55%', why: 'Of the two killers, the Mage reaches more tiles; the Barbarian can be walled off.', exp: 'Frederick +11' },
      { id: '3c', unit: 'rob', to: [1, 13], cmd: 'Wait', equip: 'Thunder', why: 'Blocks one of the two tiles next to Lissa’s corner; takes at most 14 of 15 after the heal.' },
      { id: '3b', unit: 'lis', to: [1, 14], cmd: 'Heal', target: 'rob', forecast: '+10 HP (5 → 15)', why: 'The corner: only (2,14) is open next to her, so only the Barbarian can reach her.', exp: 'Lissa +17' },
    ],
    enemy: [{ id: 'b2', to: [2, 14], does: 'attacks Lissa (predicted: the kill) · 16 × 2 at 85%' }],
  },
  {
    n: 4, detailed: false, title: 'Clean up the south; stage for the pull', safe: true, crit: 0.4, allies: { fre: [5, 11], chr: [5, 11], rob: [2, 13], lis: [1, 14] }, foes: { ...start(NORTH), g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2'],
    safety: 'Outline: safe if the Barbarian dies.', outline: 'The pair kills the Barbarian (24 vs 14). Lissa heals Robin. Frederick stages at (5,11), out of the north’s reach.', actions: [], enemy: [],
  },
  {
    n: 5, detailed: false, title: 'Pull the northern group onto the wall', safe: true, crit: 1.6, wakes: 'group 1 (2 Myrmidons, 2 Barbarians, Elthunder Mage)', allies: { fre: [7, 6], chr: [7, 6], rob: [5, 11], lis: [4, 11] }, foes: { ...start(NORTH), g: [8, 1] }, awake: [...NORTH, 'g'], dead: ['m1', 'm2', 'b1', 'w', 'b2'],
    safety: 'Outline: worst case on Frederick 23 of 28 (Myrmidon, Myrmidon, Elthunder Mage).', outline: 'Frederick to (7,6), the bridge’s foot: wakes group 1 (a planned wake, #254). The Myrmidons die on counters.', actions: [], enemy: [],
  },
  {
    n: 6, detailed: false, title: 'Finish the north', safe: true, crit: 0.9, allies: { fre: [8, 4], chr: [8, 4], rob: [7, 6], lis: [6, 6] }, foes: { g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2', 'm3', 'm4', 'b3', 'b4', 't'],
    safety: 'Outline.', outline: 'Frederick kills the Elthunder Mage; Robin chips a Barbarian from 2. Handoff: Chrom’s Rapier stays; Vulnerary to Robin for Chapter 1.', actions: [], enemy: [],
  },
  {
    n: 7, detailed: false, title: 'Garrick, with crit-avoid from adjacency', safe: true, crit: 0.0, allies: { fre: [8, 2], chr: [8, 2], rob: [7, 2], lis: [9, 2] }, foes: { g: [8, 1] }, awake: ['g'], dead: ['m1', 'm2', 'b1', 'w', 'b2', 'm3', 'm4', 'b3', 'b4', 't'],
    safety: 'Outline.', outline: 'Frederick attacks from (8,2) with Robin and Lissa adjacent: summed support rank raises crit-avoid past Garrick’s Gamble crit (5% → 0%). Rout on turn 7.', actions: [], enemy: [],
  },
];

export const HEADLINE = { crit: 5.8, rout: 7, stretch: 6, baseline: '11 turns, Lissa lost, one deviation' };
export const HANDOFF = 'For Chapter 1 (no Preparations): Vulnerary → Robin; Chrom keeps the Rapier; Frederick’s Silver Lance at 20+ uses.';
export const byId = (id: string) => [...ALLIES, ...ENEMIES].find((u) => u.id === id)!;
