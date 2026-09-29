/**
 * A board on a captured map (#263): the player's units and the enemies on their tiles, with HP, pairs and the enemies'
 * AI, and what the position plan reads off it — where a unit can move (terrain costs by class, the other side
 * blocking, its own side passable), which tiles an enemy threatens, and the forecast of a fight between two pieces on
 * their tiles (the map solver's `matchup`, with terrain, Outdoor Fighter and Dual Support from adjacent allies).
 */
import { CLASSES, type ClassData } from '../../game-data/classes';
import type { ChapterDifficulty } from '../../game-data/chapters';
import { MAPS } from '../../game-data/chapters';
import { itemByName, type GameItem } from '../../game-data/items';
import { CLASS_BASES } from '../../game-data/class-bases';
import { classIdByName } from '../supply';
import { rangeOf } from '../sim/exchange';
import { foesOf, matchup, statValue, type Fighter, type Foe, type Matchup, type SupportLevel } from '../solver';
import { NEIGHBOURS, capturedMap, isOutdoors, keyTile, manhattan, moveCost, moveRow, onMap, sameTile, tileBonus, tileKey, type CapturedMap, type PlacementAi, type Tile } from './captured';

export type Weapon = NonNullable<Fighter['weapon']>;

/** A player unit on the board. A paired back rides with its lead: it has no tile of its own and can't be attacked. */
export type PlayerPiece = {
  readonly id: string;
  readonly name: string;
  /** Its stats (max HP in `stats.hp`), skills and equipped weapon. */
  readonly fighter: Fighter;
  /** The weapons it carries, in inventory order (the first is equipped on enemy phase). */
  readonly weapons: readonly Weapon[];
  /** Its other items by name, with uses (a Vulnerary, a staff). */
  readonly items: readonly { readonly item: string; readonly uses: number | null }[];
  readonly hp: number;
  readonly at: Tile;
  /** The back it carries, or the lead that carries it. */
  readonly back?: string;
  readonly carriedBy?: string;
  /** Its support rank with each unit it has one with. */
  readonly supports: Readonly<Record<string, SupportLevel>>;
  /** Its class's Mov (Mov skills included). */
  readonly mov: number;
};

export type EnemyPiece = {
  readonly id: string;
  readonly name: string;
  readonly foe: Foe;
  readonly hp: number;
  readonly at: Tile;
  readonly mov: number;
  readonly ai: PlacementAi;
  readonly group: number;
  readonly stationary: boolean;
  readonly boss: boolean;
  /** Woken (research #254 §2): it acts every enemy phase from now on. */
  readonly awake: boolean;
  /** Its place in the dispos, which orders the enemy phase. */
  readonly order: number;
};

export type Board = {
  readonly map: CapturedMap;
  readonly turn: number;
  readonly outdoors: boolean;
  readonly players: readonly PlayerPiece[];
  readonly enemies: readonly EnemyPiece[];
};

export type Piece = PlayerPiece | EnemyPiece;
export const isEnemy = (p: Piece): p is EnemyPiece => 'foe' in p;

/** The player units standing on tiles (backs ride with their leads), alive. */
export const leads = (b: Board): PlayerPiece[] => b.players.filter((p) => !p.carriedBy && p.hp > 0);
export const liveEnemies = (b: Board): EnemyPiece[] => b.enemies.filter((e) => e.hp > 0);
export const playerById = (b: Board, id: string): PlayerPiece | undefined => b.players.find((p) => p.id === id);
export const enemyById = (b: Board, id: string): EnemyPiece | undefined => b.enemies.find((e) => e.id === id);

/** Who stands on a tile, if anyone. */
export function occupant(b: Board, t: Tile): Piece | undefined {
  return leads(b).find((p) => sameTile(p.at, t)) ?? liveEnemies(b).find((e) => sameTile(e.at, t));
}

/** A piece's class name and weapon, whichever side. */
const classOf = (p: Piece) => (isEnemy(p) ? p.foe.className : p.fighter.className);
export const weaponOf = (p: Piece): GameItem | undefined => (isEnemy(p) ? p.foe.weapon : p.fighter.weapon?.item);

/** A player lead's Mov with its back's pair-up Mov bonus (a Great Knight behind gives +1). */
export function movOf(b: Board, p: Piece): number {
  if (isEnemy(p)) return p.stationary ? 0 : p.mov;
  const back = p.back ? playerById(b, p.back) : undefined;
  const id = back ? classIdByName(back.fighter.className) : undefined;
  return p.mov + (id ? ((CLASSES[id] as ClassData).pairUp.mov ?? 0) : 0);
}

/**
 * Where a piece can end its move, with the Mov spent: its own side is passable, the other side blocks, and it can't
 * stop on an occupied tile (its own start aside). `blocked` adds tiles it may not enter (a planned move's).
 */
export function movement(b: Board, p: Piece, blocked: ReadonlySet<number> = NO_TILES): Map<number, number> {
  const row = moveRow(classOf(p));
  const budget = movOf(b, p);
  const enemy = isEnemy(p);
  const foes = new Set((enemy ? leads(b) : liveEnemies(b)).map((x) => tileKey(x.at)));
  const friends = new Set((enemy ? liveEnemies(b) : leads(b)).filter((x) => x.id !== p.id).map((x) => tileKey(x.at)));
  const spent = new Map<number, number>([[tileKey(p.at), 0]]);
  const queue: [number, number][] = [[tileKey(p.at), 0]];
  while (queue.length) {
    queue.sort((a, c) => a[1] - c[1]);
    const [k, d] = queue.shift()!;
    if (d > (spent.get(k) ?? Infinity)) continue;
    const t = keyTile(k);
    for (const [dx, dy] of NEIGHBOURS) {
      const n: Tile = [t[0] + dx, t[1] + dy];
      const nk = tileKey(n);
      if (foes.has(nk) || blocked.has(nk)) continue;
      const c = moveCost(b.map, n, row);
      if (c === null || d + c > budget || d + c >= (spent.get(nk) ?? Infinity)) continue;
      spent.set(nk, d + c);
      queue.push([nk, d + c]);
    }
  }
  for (const k of friends) spent.delete(k);
  return spent;
}
const NO_TILES: ReadonlySet<number> = new Set();

/** A weapon's reach as [min, max], or undefined for none (a staff-only unit can't attack). */
export const reachOf = (w: GameItem | undefined): readonly [number, number] | undefined => (w && w.kind !== 'staff' ? rangeOf(w) : undefined);

/** Whether a weapon reaches a distance. */
export const reaches = (w: GameItem | undefined, d: number): boolean => {
  const r = reachOf(w);
  return !!r && d >= r[0] && d <= r[1];
};

/** Every tile a piece can strike this phase: from each tile it can reach (only its own when it can't move). */
export function threatTiles(b: Board, p: Piece): Set<number> {
  const r = reachOf(weaponOf(p));
  const out = new Set<number>();
  if (!r) return out;
  const from = isEnemy(p) && p.stationary ? [tileKey(p.at)] : [...movement(b, p).keys()];
  for (const k of from) {
    const [x, y] = keyTile(k);
    for (let dx = -r[1]; dx <= r[1]; dx++)
      for (let dy = -r[1]; dy <= r[1]; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= r[0] && d <= r[1] && onMap(b.map, [x + dx, y + dy])) out.add(tileKey([x + dx, y + dy]));
      }
  }
  return out;
}

/**
 * A player lead against an enemy, the lead on `leadAt` and the enemy on `foeAt`: the map solver's matchup with its
 * back's pair-up and Dual Strike/Guard, Dual Support from every adjacent lead, each tile's Def/Avo and Outdoor Fighter.
 */
export function forecast(b: Board, lead: PlayerPiece, foe: EnemyPiece, leadAt: Tile = lead.at, foeAt: Tile = foe.at, weapon?: Weapon): Matchup {
  const back = lead.back ? playerById(b, lead.back) : undefined;
  const support = back ? (lead.supports[back.id] ?? null) : null;
  const adjacent = leads(b)
    .filter((x) => x.id !== lead.id && manhattan(x.at, leadAt) === 1)
    .map((x) => lead.supports[x.id] ?? null);
  const fighter = weapon && weapon !== lead.fighter.weapon ? { ...lead.fighter, weapon } : lead.fighter;
  return matchup(fighter, back?.fighter, support, foe.foe, [], true, { outdoors: b.outdoors, adjacent, leadTile: tileBonus(b.map, leadAt), foeTile: tileBonus(b.map, foeAt) });
}

/** One strike in a fight, in order: whose, and (for a lead) whether it's a Dual Strike's chance too. */
export type Side = 'player' | 'enemy';

/**
 * The strikes of a fight in order (SF Calculations): the attacker's attack (two strikes with a brave weapon), the
 * defender's counter if its weapon reaches, then the follow-up of whichever side doubles.
 */
export function strikeOrder(m: Matchup, attacker: Side, playerReaches: boolean, enemyReaches: boolean): Side[] {
  const pPer = m.doubles ? m.hits / 2 : m.hits;
  const ePer = m.doubled ? m.foeStrikes / 2 : m.foeStrikes;
  const out: Side[] = [];
  const attack = (s: Side) => {
    if (s === 'player' ? playerReaches : enemyReaches) for (let i = 0; i < (s === 'player' ? pPer : ePer); i++) out.push(s);
  };
  attack(attacker);
  attack(attacker === 'player' ? 'enemy' : 'player');
  if (m.doubles) attack('player');
  else if (m.doubled) attack('enemy');
  return out;
}

/** Which strikes land: the likeliest reading (a strike at 50% or more lands), every one, or none. */
export type Landing = 'likely' | 'all' | 'none';
const lands = (how: Landing, hit: number) => how === 'all' || (how === 'likely' && hit >= 50);

/**
 * A fight played out with no crits: each side's HP after. `player` and `enemy` say which of each side's strikes land.
 */
export function playFight(m: Matchup, order: readonly Side[], playerHp: number, enemyHp: number, player: Landing, enemy: Landing): { playerHp: number; enemyHp: number } {
  let p = playerHp;
  let e = enemyHp;
  for (const s of order) {
    if (p <= 0 || e <= 0) break;
    if (s === 'player') {
      if (lands(player, m.hit)) e -= m.damage;
    } else if (lands(enemy, m.foeHit)) p -= m.worstHit;
  }
  return { playerHp: Math.max(0, p), enemyHp: Math.max(0, e) };
}

/** A board with pieces replaced. */
export function withPieces(b: Board, players: readonly PlayerPiece[] = b.players, enemies: readonly EnemyPiece[] = b.enemies): Board {
  return { ...b, players, enemies };
}
export const withPlayer = (b: Board, p: PlayerPiece): Board => withPieces(b, b.players.map((x) => (x.id === p.id ? p : x)));
export const withEnemy = (b: Board, e: EnemyPiece): Board => withPieces(b, b.players, b.enemies.map((x) => (x.id === e.id ? e : x)));

/** A piece's weapons as the board holds them, from item names (uses aside). */
export const weaponsOf = (names: readonly string[]): Weapon[] =>
  names.flatMap((n) => {
    const item = itemByName(n);
    return item && item.kind !== 'staff' && item.kind !== 'item' && reachOf(item) ? [{ item }] : [];
  });

/**
 * Whether a unit can use an item (#283's trades): any consumable, or a weapon or staff of a kind its class wields (the
 * class bases' weapon kinds; weapon ranks aren't recorded, so any rank passes) that isn't locked to other units or
 * classes (the item's "only": "Chrom and Marth", "Lord, Great Lord, and Lodestar"; an enemy-only item never).
 */
export function canUse(className: string, item: GameItem | undefined, unitName = ''): boolean {
  if (!item) return false;
  if (item.kind === 'item') return true;
  const cls = className.replace(/ \([MF]\)$/, '');
  if (item.only) {
    const who = item.only.split(/;|,| and /).map((x) => x.trim()).filter(Boolean);
    if (who.some((x) => /enemy/i.test(x)) || !who.some((x) => x === cls || x === unitName)) return false;
  }
  const id = classIdByName(cls);
  const base = id ? CLASS_BASES[id] : undefined;
  const kinds = (base?.any ?? base?.M ?? base?.F)?.weapons as readonly string[] | undefined;
  return !!kinds?.includes(item.kind);
}

/** A class's base Mov (the class bases), 5 when unknown. */
export function classMov(className: string): number {
  const id = classIdByName(className.replace(/ \([MF]\)$/, ''));
  const base = id ? CLASS_BASES[id] : undefined;
  return (base?.any ?? base?.M ?? base?.F)?.mov ?? 5;
}

/** The difficulty's enemy table (Lunatic+ reads Lunatic's). */
const tableOf = (d: ChapterDifficulty | 'lunatic-plus'): ChapterDifficulty => (d === 'lunatic-plus' ? 'lunatic' : d);

/**
 * The turn-1 board of a captured map on a difficulty: its enemy placements for that difficulty (reinforcements and
 * event units aside), each matched to its chapter-data foe (class, then boss, then weapon family: Thunder → Elthunder),
 * and the player pieces given. `skills` overrides a placement's skills by its tile (the ones the game rolled); without it
 * a foe has every skill its group may roll, the cautious reading. Undefined when the map isn't captured.
 */
export function boardFromMap(
  mapId: string,
  difficulty: ChapterDifficulty | 'lunatic-plus',
  players: readonly PlayerPiece[],
  skills: Readonly<Record<string, readonly string[]>> = {},
): Board | undefined {
  const map = capturedMap(mapId);
  const chapter = MAPS.find((m) => m.id === mapId);
  if (!map || !chapter) return undefined;
  const table = tableOf(difficulty);
  const foes = foesOf(chapter, table, difficulty === 'lunatic-plus');
  const groups = chapter.enemies[table] ?? [];
  const bosses = chapter.bosses[table] ?? [];
  const movOfFoe = (f: Foe) => {
    const g = [...bosses, ...groups].find((x) => x.class === f.className && statValue(x.stats.hp) === f.stats.hp);
    const m = g ? parseInt(g.stats.mov, 10) : NaN;
    return Number.isFinite(m) ? m : classMov(f.className);
  };
  const enemies = map.spawns
    .filter((s) => s.faction === 'Enemy' && s.team === 'enemy' && s.difficulties.includes(table))
    .flatMap((s, order): EnemyPiece[] => {
      const cls = s.class?.replace(/ \([MF]\)$/, '');
      const same = foes.filter((f) => f.className === cls);
      const pool = same.filter((f) => f.boss === !!s.boss).length ? same.filter((f) => f.boss === !!s.boss) : same;
      const family = s.items?.[0]?.split(' ').at(-1)?.toLowerCase();
      const kind = s.items?.[0] ? itemByName(s.items[0])?.kind : undefined;
      const f = pool.find((x) => family && x.weapon?.name.toLowerCase().includes(family)) ?? pool.find((x) => kind && x.weapon?.kind === kind) ?? pool[0];
      if (!f) return [];
      const k = `${s.at[0]},${s.at[1]}`;
      const foe = skills[k] ? { ...f, skills: skills[k]! } : f;
      return [
        {
          id: `e${order}`,
          name: f.boss ? f.name : `${f.className}`,
          foe,
          hp: f.stats.hp,
          at: s.at,
          mov: movOfFoe(f),
          ai: s.ai ?? {},
          group: s.group ?? 0,
          stationary: !!s.stationary,
          boss: !!s.boss,
          // Active from enemy phase 1 whatever the player does: awake from the start, so "woke" reads real wakes only.
          awake: (s.ai?.start ?? 'Everytime') === 'Everytime',
          order,
        },
      ];
    });
  return { map, turn: 1, outdoors: isOutdoors(map), players, enemies };
}
