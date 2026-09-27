/**
 * A map from the chapter data, and a lineup from a deployment, for the map simulation (#181).
 *
 * The map: its victory (a boss map when it reads "Defeat X", with X the target), its starting foes on the difficulty
 * (Apotheosis: Wave 1 only), and its reinforcement waves (#178) on their turns, joining at the start of the turn on
 * Normal and at the start of enemy phase, free to act, on Hard and up (FEW Reinforcement). Apotheosis's waves join
 * one after another as the field clears, on the normal or the secret route. Waves set off by a talk or a first defeat
 * aren't played; their labels are kept. Lunatic+ reads Lunatic's tables, and each foe group without recorded skills
 * draws its two extra skills from the map's pool.
 */
import { MAPS, lunaticPlusPoolFor, type ChapterData, type ChapterDifficulty } from '../../game-data/chapters';
import type { Difficulty, RosterUnit } from '../roster';
import { foeKey, foesOf, type Fighter, type Foe } from '../solver';
import { mapWaves, type Wave } from '../waves';
import type { Deployment } from '../deploy';
import type { SimFoeGroup, SimGroup, SimMap, SimUnit, SimWave } from './map-play';

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

export function simMap(map: ChapterData, difficulty: Difficulty, options: SimMapOptions = {}): SimMap {
  const table = tableOf(difficulty);
  const lplus = difficulty === 'lunatic-plus';
  const pool = lplus ? lunaticPlusPoolFor(map) : [];
  const seen = options.seen ?? {};
  const key = keyer();
  const group = (foe: Foe, where?: string): SimFoeGroup => {
    const recorded = seen[foeKey(foe)];
    const withSeen = recorded ? { ...foe, skills: [...new Set([...foe.skills, ...recorded])] } : foe;
    return { key: key(`${foe.name}${where ? ` (${where})` : ''}`), foe: withSeen, ...(lplus && !recorded ? { pool } : {}) };
  };
  // Apotheosis lists every wave in its tables; the field starts with Wave 1.
  const first = (w: string | undefined) => !w || w === 'Wave 1';
  const start: ChapterData =
    map.id === 'apotheosis'
      ? {
          ...map,
          enemies: { [table]: (map.enemies[table] ?? []).filter((e) => first(e.wave)) },
          bosses: Object.fromEntries(Object.entries(map.bosses).map(([d, rows]) => [d, (rows ?? []).filter((b) => first(b.wave))])),
        }
      : map;
  const victoryText = map.conditions[table]?.victory ?? 'Rout the enemy';
  const boss = /^Defeat\s+(?:the\s+(?:boss\s+)?)?(.+)$/i.exec(victoryText.trim());
  const foes = foesOf(start, table, lplus).map((f) => group(f));
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
  return { id: options.route === 'secret' ? `${map.id}-secret` : map.id, victory: boss ? 'boss' : 'rout', foes, waves, skipped };
}

/** A map by id. */
export function simMapById(id: string, difficulty: Difficulty, options?: SimMapOptions): SimMap {
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`No chapter data for ${id}`);
  return simMap(map, difficulty, options);
}

/**
 * A deployment as the simulation's lineup: each pair (lead + back), then each unit alone, with the fighter and weapons
 * of its candidate. Units with no fighter (no recorded stats) are left out.
 */
export function simLineup(d: Deployment, fighters: ReadonlyMap<RosterUnit, { readonly fighter: Fighter; readonly weapons: readonly NonNullable<Fighter['weapon']>[] }>): SimGroup[] {
  const unit = (u: RosterUnit): SimUnit | undefined => {
    const c = fighters.get(u);
    return c ? { id: u, fighter: c.fighter, weapons: c.weapons } : undefined;
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
