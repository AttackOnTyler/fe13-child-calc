/**
 * A map from the chapter data, and a lineup from a deployment, for the map simulation (#181).
 *
 * The map: its victory (a boss map when it reads "Defeat X", with X the target), its starting foes on the difficulty
 * (Apotheosis: Wave 1 only), and its reinforcement waves (#178) on their turns, joining at the start of the turn on
 * Normal and at the start of enemy phase, free to act, on Hard and up (FEW Reinforcement). Apotheosis's waves join
 * one after another as the field clears, on the normal or the secret route. Waves set off by a talk or a first defeat
 * aren't played; their labels are kept. Lunatic+ reads Lunatic's tables, and each foe group without recorded skills
 * draws its two extra skills from the map's pool.
 *
 * The field at the start leaves out the reinforcements FEW lists in the same table (#184) and any foe it notes as gone
 * before turn 1 (Chapter 9's Gangrel and Aversa); a foe that leaves on a later turn is marked with it. The third party
 * and the recruits (#184, `thirdParty`): an NPC the army must keep alive (Chapter 6's Emmeryn), mid-map arrivals, talk
 * recruits (Chapter 9's Libra and Tharja), NPCs who join if they survive, and a foe a talk sends away.
 */
import { MAPS, lunaticPlusPoolFor, type ChapterData, type ChapterDifficulty, type EnemyGroup } from '../../game-data/chapters';
import { STATS } from '../../game-data/stats';
import type { Difficulty, RosterUnit } from '../roster';
import { foeKey, foeOf, foesOf, type Fighter, type Foe } from '../solver';
import { mapWaves, type Wave } from '../waves';
import type { Deployment } from '../deploy';
import { unitNamed } from '../run';
import type { BlindSpotId } from '../assumptions';
import type { SimAlly, SimFoeGroup, SimGroup, SimMap, SimRecruit, SimUnit, SimWave } from './map-play';
import type { SimItem } from './sustain';

export type SimMapOptions = {
  /** Lunatic+ skills recorded on a foe (by `foeKey`): they replace its draw. */
  readonly seen?: Readonly<Record<string, readonly string[]>>;
  /** Apotheosis: the normal route's waves, or the secret route's. */
  readonly route?: 'normal' | 'secret';
};

const tableOf = (d: Difficulty): ChapterDifficulty => (d === 'lunatic-plus' ? 'lunatic' : d);

/** Unique keys: a foe's key, with `#2`, `#3` on repeats (two groups of one class and HP). */
function keyer() {
  const used = new Map<string, number>();
  return (base: string) => {
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base} #${n}`;
  };
}

/** A foe FEW notes as gone before the army's first move (Chapter 9's Gangrel and Aversa). */
const leavesAtStart = (g: EnemyGroup) => /Leaves the map before the start of turn 1/i.test(g.notes ?? '');
/** The turn a foe leaves the map on its own (Death's Embrace's Algol: turn 10). */
const leavesOn = (g: EnemyGroup): number | undefined => {
  const m = /Leaves the map on turn (\d+)/i.exec(g.notes ?? '');
  return m ? parseInt(m[1]!, 10) : undefined;
};
/**
 * When a foe begins moving on its own, from the chapter data's AI notes (FEW): from the start ("Immediately begins
 * moving unprovoked", no note, or anything else), on a turn ("Begins moving unprovoked on turn 5", "Will not act until
 * turn 8", "… or until turn 6"), or only once a unit comes to it (Infinity: "Only moves to attack units in range",
 * "Will not move until …", "Begins moving if … is provoked", a door to open, one standing on a gate). A note for several
 * foes of the group ("• The southern two immediately …; • The northern one …") reads as its earliest.
 */
export function movesOf(notes: string | undefined): number {
  if (!notes) return 1;
  let earliest = Infinity;
  for (const part of notes.split(/;\s*/)) {
    const turn = /(?:unprovoked on|until|by) turn (\d+)/i.exec(part);
    if (/immediately begins? moving/i.test(part)) earliest = Math.min(earliest, 1);
    else if (turn) earliest = Math.min(earliest, parseInt(turn[1]!, 10));
    else if (!/will not move|will not act|begins? moving if|only moves? to attack|do(?:es)? not move|stands on a (?:gate|throne)|starts on a (?:gate|throne)/i.test(part)) earliest = Math.min(earliest, 1);
  }
  return earliest;
}

const sameName = (a: string | undefined, b: string | undefined) => !!a && !!b && a.replace(/[’']/g, "'") === b.replace(/[’']/g, "'");

export function simMap(map: ChapterData, difficulty: Difficulty, options: SimMapOptions = {}): SimMap {
  const table = tableOf(difficulty);
  const lplus = difficulty === 'lunatic-plus';
  const pool = lplus ? lunaticPlusPoolFor(map) : [];
  const seen = options.seen ?? {};
  const key = keyer();
  const group = (foe: Foe, where?: string, more: Partial<SimFoeGroup> = {}): SimFoeGroup => {
    const recorded = seen[foeKey(foe)];
    const withSeen = recorded ? { ...foe, skills: [...new Set([...foe.skills, ...recorded])] } : foe;
    return { key: key(`${foe.name}${where ? ` (${where})` : ''}`), foe: withSeen, ...(lplus && !recorded ? { pool } : {}), ...more };
  };
  // The field at the start: not the reinforcements FEW lists in the same table (#184), nor a foe gone before the first
  // turn; a boss whose row is one of those goes with it. Apotheosis lists every wave in its tables; it starts with Wave 1.
  const first = (w: string | undefined) => !w || w === 'Wave 1';
  const rows = map.enemies[table] ?? [];
  const gone = rows.filter((e) => e.reinforcement || leavesAtStart(e) || (map.id === 'apotheosis' && !first(e.wave)));
  const start: ChapterData = {
    ...map,
    enemies: { [table]: rows.filter((e) => !gone.includes(e)) },
    bosses: Object.fromEntries(
      Object.entries(map.bosses).map(([d, bs]) => [d, (bs ?? []).filter((b) => (map.id === 'apotheosis' ? first(b.wave) : !gone.some((e) => sameName(e.name, b.name))))]),
    ),
  };
  const victoryText = map.conditions[table]?.victory ?? 'Rout the enemy';
  const boss = /^Defeat\s+(?:the\s+(?:boss\s+)?)?(.+)$/i.exec(victoryText.trim());
  const leaving = new Map(rows.flatMap((e) => (leavesOn(e) !== undefined ? [[e.name, leavesOn(e)!] as const] : [])));
  // Each enemy group's row (the non-boss foes come in the table's order, the bosses' own rows left out): its AI notes.
  const kept = start.enemies[table] ?? [];
  let r = 0;
  const rowOf = (f: Foe): EnemyGroup | undefined => {
    if (f.boss) return undefined;
    while (r < kept.length) {
      const row = kept[r++]!;
      const g = foeOf(row, false);
      if (g.name === f.name && g.className === f.className && g.stats.hp === f.stats.hp) return row;
    }
    return undefined;
  };
  const foes = foesOf(start, table, lplus).map((f) => {
    const moves = movesOf(rowOf(f)?.notes);
    return group(f, undefined, { ...(leaving.has(f.name) ? { leaves: leaving.get(f.name)! } : {}), ...(moves !== 1 ? { moves } : {}) });
  });
  if (boss) {
    const name = boss[1]!.trim().toLowerCase();
    const target = foes.find((g) => g.foe.boss && g.foe.name.toLowerCase() === name) ?? foes.find((g) => g.foe.boss && name.includes(g.foe.className.toLowerCase())) ?? foes.find((g) => g.foe.boss);
    if (target) foes[foes.indexOf(target)] = { ...target, target: true };
  }
  const joins: SimWave['joins'] = table === 'normal' ? 'turn-start' : 'enemy-phase';
  const all = mapWaves(map, table).waves;
  const skipped: string[] = [];
  const waves: SimWave[] = [];
  // A wave's groups are keyed by when they come: `Wyvern Rider (turn 4)`, `Grimleal (reinforcements)`, `Sage (Wave 3)`.
  const when = (w: Wave) => (w.turns.length ? `turn ${w.turns.length > 1 ? `${w.turns[0]}–${w.turns.at(-1)}` : w.turns[0]}` : w.everyTurnFrom !== undefined ? 'reinforcements' : w.label);
  const groupsOf = (w: Wave) => w.groups.flatMap((g) => (g.foe && !g.inEnemyTable ? [group({ ...g.foe, ...(g.boss ? { boss: true } : {}) }, when(w))] : []));
  if (map.id === 'apotheosis') {
    // One version of each normal wave (the first listed: the other is the player's choice), or the secret ones.
    const secret = options.route === 'secret';
    const picked = new Set<number>();
    for (const w of all) {
      if (/^Secret/i.test(w.label) !== secret) continue;
      const n = parseInt(/\d+/.exec(w.label)?.[0] ?? '0', 10);
      if (picked.has(n)) continue;
      picked.add(n);
      waves.push({ label: w.label, turns: [], onClear: true, joins, groups: groupsOf(w) });
    }
  } else {
    for (const w of all) {
      if (w.turns.length) waves.push({ label: w.label, turns: w.turns, joins, groups: groupsOf(w) });
      else if (w.everyTurnFrom !== undefined) waves.push({ label: w.label, turns: [], everyTurnFrom: w.everyTurnFrom, perTurn: w.perTurn ?? w.groups.length, joins, groups: groupsOf(w) });
      else skipped.push(w.label);
    }
  }
  const { allies, recruits } = thirdParty(map, table, foes);
  const blindSpots: BlindSpotId[] = /door key/i.test(map.conditions[table]?.defeat ?? '') ? ['door-keys'] : [];
  return {
    id: options.route === 'secret' ? `${map.id}-secret` : map.id,
    victory: boss ? 'boss' : 'rout',
    foes,
    waves,
    skipped,
    ...(allies.length ? { allies } : {}),
    ...(recruits.length ? { recruits } : {}),
    ...(blindSpots.length ? { blindSpots } : {}),
  };
}

/** A roster id from the chapter data's name (lower case where the roster has none: a talker the roster doesn't know). */
const idOf = (name: string): string => unitNamed(name.trim()) ?? name.trim().toLowerCase();

/** A unit from its chapter-data row (an NPC's, or a foe recruit's) as it joins; undefined when FEW prints no stats (a child's vary). */
function unitOf(id: string, row: EnemyGroup | undefined): SimUnit | undefined {
  if (!row || STATS.some((s) => !/\d/.test(row.stats[s]))) return undefined;
  const foe = foeOf(row, false);
  const fighter: Fighter = { name: row.name, className: row.class, stats: foe.stats, skills: foe.skills, weapon: foe.weapon ? { item: foe.weapon } : undefined };
  return { id, fighter, weapons: fighter.weapon ? [fighter.weapon] : [] };
}

/**
 * The third party and the recruits (#184), from the chapter data: an NPC whose death is a Game Over (Chapter 6's
 * Emmeryn) is an ally the army keeps alive; each recruit who comes during the map is a mid-map arrival (`Automatically
 * from turn N`), a talk recruit (`talk to with Chrom or Lissa`, a village visit likewise, `three times` for Gangrel),
 * NPC or enemy until it joins, or an NPC who joins at the end if it survives. Recruits from turn 1 or after the map
 * aren't played here: the run fields the first and adds the rest after the map.
 */
function thirdParty(map: ChapterData, table: ChapterDifficulty, foes: readonly SimFoeGroup[]): { allies: SimAlly[]; recruits: SimRecruit[] } {
  const npcs = map.npcs?.[table] ?? [];
  // The defeat condition names them (`Chrom, Robin, or the NPC Lucina dies`), or their own note does.
  const defeat = map.conditions[table]?.defeat ?? '';
  const allies: SimAlly[] = npcs.flatMap((r) => {
    const named = new RegExp(`\\bNPC ${r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(defeat);
    const unit = !r.reinforcement && (named || /Death results in a Game Over/i.test(r.notes ?? '')) ? unitOf(idOf(r.name), r) : undefined;
    return unit ? [{ unit }] : [];
  });
  const recruits: SimRecruit[] = [];
  // A foe that leaves once a unit talks to it (The Future Past's masked boss, when Robin speaks with it): the talk
  // takes it off the field, joining nobody.
  for (const row of map.enemies[table] ?? []) {
    const m = /Leaves the map if (\S+) (?:has a conversation with|talks to) (?:him|her)/i.exec(row.notes ?? '');
    // Its group: by name, or the boss its row was merged into (the masked boss's row reads `???`).
    const g = m && foes.find((f) => f.foe.className === row.class && f.foe.stats.hp === foeOf(row, false).stats.hp && (sameName(f.foe.name, row.name) || f.foe.boss));
    if (m && g) recruits.push({ id: g.key, talk: { by: [idOf(m[1]!)], times: 1 }, foe: g.key, departs: true });
  }
  for (const r of map.recruits) {
    const how = r.how ?? '';
    const id = idOf(r.unit);
    const npcRow = npcs.find((n) => sameName(n.name, r.unit));
    const arrives = /^(?:NPC, automatically becomes playable|Automatically) (?:on|from) turn (\d+)/i.exec(how);
    const talk = /(?:talk to|^Visit\b.*?) with (?:either )?(.+?)(?:\s+(two|three) times)?(?:[,;]|$)/i.exec(how);
    const self = /^NPC, have (?:her|him) talk to/i.test(how);
    if (arrives && parseInt(arrives[1]!, 10) > 1) {
      const npc = /^NPC\b/i.test(how);
      const unit = unitOf(id, npcRow);
      recruits.push({ id, ...(unit ? { unit } : {}), arrives: parseInt(arrives[1]!, 10), ...(npc ? { npc } : {}) });
    } else if (talk || self) {
      const by = self ? [id] : talk![1]!.split(/\s+or\s+/).map(idOf);
      const times = talk?.[2] === 'three' ? 3 : talk?.[2] === 'two' ? 2 : 1;
      const enemy = /^Enemy,/i.test(how);
      const foe = enemy ? foes.find((g) => sameName(g.foe.name, r.unit)) : undefined;
      const row = enemy ? (map.enemies[table] ?? []).find((e) => sameName(e.name, r.unit)) : npcRow;
      const unit = unitOf(id, row);
      recruits.push({ id, ...(unit ? { unit } : {}), talk: { by, times }, ...(foe ? { foe: foe.key } : { npc: true }) });
    } else if (/^Automatically at the end of the chapter if (?:she|he) survived/i.test(how) && npcRow) {
      const unit = unitOf(id, npcRow);
      if (unit) recruits.push({ id, unit, npc: true });
    }
  }
  return { allies, recruits };
}

/** Maps by id, difficulty and options, kept: a map is read-only once built, and building one parses every foe. */
const byId = new Map<string, SimMap>();
const BY_ID = 512;

/** A map by id (the same object again for the same id, difficulty and options). */
export function simMapById(id: string, difficulty: Difficulty, options?: SimMapOptions): SimMap {
  const k = `${id}|${difficulty}|${options?.route ?? ''}|${JSON.stringify(options?.seen ?? {})}`;
  const hit = byId.get(k);
  if (hit) return hit;
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`No chapter data for ${id}`);
  const built = simMap(map, difficulty, options);
  if (byId.size >= BY_ID) byId.delete(byId.keys().next().value!);
  byId.set(k, built);
  return built;
}

/**
 * A deployment as the simulation's lineup: each pair (lead + back), then each unit alone, with the fighter and weapons
 * of its candidate. Units with no fighter (no recorded stats) are left out.
 */
export function simLineup(
  d: Deployment,
  fighters: ReadonlyMap<RosterUnit, { readonly fighter: Fighter; readonly weapons: readonly NonNullable<Fighter['weapon']>[]; readonly items?: readonly SimItem[] }>,
): SimGroup[] {
  const unit = (u: RosterUnit): SimUnit | undefined => {
    const c = fighters.get(u);
    return c ? { id: u, fighter: c.fighter, weapons: c.weapons, ...(c.items?.length ? { items: c.items } : {}) } : undefined;
  };
  const out: SimGroup[] = [];
  for (const p of d.pairs) {
    const lead = unit(p.lead);
    const back = p.back ? unit(p.back) : undefined;
    if (lead) out.push({ lead, ...(back ? { back } : {}), support: back ? p.support : null });
    else if (back) out.push({ lead: back, support: null });
  }
  for (const u of d.solo) {
    const s = unit(u);
    if (s) out.push({ lead: s, support: null });
  }
  return out;
}
