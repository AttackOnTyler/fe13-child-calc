/**
 * PROTOTYPE — throwaway (wayfinder: "How does the EXP forecast share kills among the lineup?", #146).
 *
 * The question: given a map's foes, the lineup's matchups (the map solver) and an EXP priority, how are kills and
 * combats shared among the deployed units, how is the uncertainty shown (level range at map end), and how is the
 * forecast checked against, and re-anchored on, what the player records?
 *
 * The model under test:
 * - **Fair share of actions.** Each wave every acting unit (a lead, a solo unit, a healer) gets one action. Priority
 *   never buys a unit extra actions; it only decides who lands the killing blow.
 * - **Sharing policy.** `even`: each actor takes the foe it is likeliest to kill. `priority`: lower-priority units act
 *   first and chip foes into a higher-priority unit's kill range; higher-priority units then take the kills.
 * - **Enemy phase.** Each acting fighter takes at most one attack from a live foe and counters (a counter kill is a
 *   free clear). The back never strikes on enemy phase.
 * - **EXP** by research/exp-rules.md §1 (Lunatic): damage and kill EXP on the level difference, the back's half
 *   damage EXP on its own Dual Strikes, Veteran ×1.5 for a lead, staves decaying with internal level.
 * - **Uncertainty** by Monte Carlo over hit, Dual Strike and enemy-phase rolls, carried map to map, stats rising by
 *   expected growth per level gained.
 * Pure: no I/O.
 */
import { MAPS, type ChapterData } from '../game-data/chapters';
import { CLASSES, type ClassId } from '../game-data/classes';
import { itemByName, type GameItem } from '../game-data/items';
import { JOIN_DATA, basesOn } from '../game-data/join';
import { ROBIN_GROWTHS } from '../game-data/robin';
import { CLASS_SKILLS, SKILLS, type SkillId } from '../game-data/skills';
import { STATS, type Stat } from '../game-data/stats';
import { FIRST_GEN_UNITS } from '../game-data/units';
import { className } from './classes';
import { foeOf, matchup, type Fighter, type Foe, type Matchup } from './solver';

// ---------- EXP formulas (research/exp-rules.md §1) ----------

export const damageExp = (ld: number, engagement: number): number => {
  const base = ld >= -1 ? Math.floor((31 + ld) / 3) : Math.max(Math.floor((33 + ld) / 3), 1);
  return Math.max(base - Math.max(engagement - 3, 0), 0);
};
export const killExp = (ld: number, bonus: number): number =>
  ld >= 0 ? 20 + 3 * ld + bonus : ld === -1 ? 20 + bonus : Math.max(26 + 3 * ld + bonus, 7);
export const staffExp = (base: number, il: number): number =>
  Math.max(base - Math.floor(Math.max(il - 5, 0) / 3) + (il === 8 || il === 11 ? -1 : il === 30 ? 1 : 0), 1);

const CLASS_BONUS: Readonly<Record<string, number>> = { Thief: 20, Assassin: 20, Trickster: 20, Conqueror: 20, Revenant: 80, Entombed: 80, Troubadour: -10, Cleric: -10, Priest: -10 };

const CLASS_BY_NAME = new Map<string, ClassId>(
  (Object.keys(CLASSES) as ClassId[]).flatMap((id) => (['M', 'F'] as const).map((g) => [className(id, g), id] as const)),
);
const advanced = (cls: string) => CLASSES[CLASS_BY_NAME.get(cls) ?? 'villager']?.tier === 'advanced';

// ---------- The data the prototype runs on ----------

export type UnitId = keyof typeof JOIN_DATA;

export type MapFoe = { readonly foe: Foe; readonly level: number; readonly group: string };

/** One foe per enemy on the map (counts expanded), boss first. Reinforcements are left out. */
export function mapFoes(map: ChapterData): MapFoe[] {
  const bosses = (map.bosses.lunatic ?? []).map((b) => ({ foe: foeOf(b, true), level: parseInt(b.level, 10) }));
  const bossKeys = new Set(bosses.map((b) => `${b.foe.className}|${b.foe.stats.hp}`));
  const out: MapFoe[] = bosses.map((b) => ({ ...b, group: `${b.foe.name} (boss)` }));
  for (const g of map.enemies.lunatic ?? []) {
    const foe = foeOf(g, false);
    if (bossKeys.has(`${foe.className}|${foe.stats.hp}`)) continue;
    const n = Math.max(1, foe.count - 0);
    for (let i = 0; i < n; i++) out.push({ foe: { ...foe, count: 1 }, level: parseInt(g.level, 10) || 1, group: `${foe.className} Lv${g.level}` });
  }
  return out;
}

/** Top deploy count, mid-map arrivals included (`4+2 (…)` → 6, `1–8+1 (…)+1 (…)` → 10). */
export function deployCount(map: ChapterData): number {
  const text = (map.conditions.lunatic ?? map.conditions.normal)?.deploy ?? '0';
  const [head, ...plus] = text.replace(/\([^)]*\)/g, '').split('+');
  const top = Math.max(...(head!.match(/\d+/g) ?? ['0']).map(Number));
  return top + plus.map((p) => parseInt(p, 10) || 0).reduce((a, b) => a + b, 0);
}

export type UnitDef = {
  readonly id: UnitId;
  readonly name: string;
  readonly joins: string;
  readonly classId: ClassId;
  readonly joinLevel: number;
  readonly bases: Readonly<Record<Stat, number>>;
  readonly growths: Readonly<Record<Stat, number>>;
  readonly weapons: readonly GameItem[];
  readonly staff: GameItem | undefined;
  readonly skills: readonly SkillId[];
};

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/** Units who join on the charted maps, with their join inventory from the chapter data. */
export function unitDefs(maps: readonly ChapterData[]): UnitDef[] {
  const out: UnitDef[] = [];
  for (const map of maps) {
    for (const r of map.recruits) {
      const id = r.unit.toLowerCase().replace(/[^a-z]/g, '') as UnitId;
      const j = JOIN_DATA[id];
      if (!j || j.chapter !== map.id || out.some((u) => u.id === id)) continue;
      // Joining at the chapter's end (Lon'qu): fielded from the next story map.
      const joins = /end of the chapter/i.test(r.how ?? '') ? (map.unlocks.find((u) => u.startsWith('chapter')) ?? map.id) : map.id;
      const personal = id === 'robin' ? ROBIN_GROWTHS : (FIRST_GEN_UNITS as unknown as Record<string, { growths: Record<Stat, number> }>)[id]!.growths;
      const g = CLASSES[j.joinClass].growths as unknown as Record<string, number> & { male?: Record<string, number> };
      const cls = (g.male ?? g) as Partial<Record<Stat, number>>;
      // Story handover: Miriel brings the Iron Axe Vaike forgot.
      const inventory = id === 'vaike' ? ['Iron Axe'] : id === 'miriel' ? ['Fire'] : (r.inventory ?? []);
      const items = inventory.map((n) => itemByName(n)).filter((i): i is GameItem => !!i);
      out.push({
        id,
        name: id === 'robin' ? 'Robin' : (FIRST_GEN_UNITS as unknown as Record<string, { name: string }>)[id]!.name,
        joins,
        classId: j.joinClass,
        joinLevel: j.level,
        bases: { ...basesOn(j, 'lunatic'), mov: 0 } as Record<Stat, number>,
        growths: Object.fromEntries(STATS.map((s) => [s, (personal[s as keyof typeof personal] ?? 0) + (cls[s] ?? 0)])) as Record<Stat, number>,
        weapons: items.filter((i) => WEAPON_KINDS.has(i.kind)),
        staff: items.find((i) => i.kind === 'staff'),
        skills: j.startingSkills,
      });
    }
  }
  return out;
}

// ---------- The plan the player steers ----------

export type Priority = 0 | 1 | 2; // low, normal, high
export type Policy = 'even' | 'priority';
/** The assumed army spread: how often an unpaired unit fights next to a given ally (for Solidarity). */
export const ADJACENT = 0.5;

export type MapPlan = {
  readonly map: string;
  readonly fielded: readonly UnitId[];
  /** lead → back */
  readonly pairs: Readonly<Partial<Record<UnitId, UnitId>>>;
};

export type Plan = {
  readonly policy: Policy;
  /** Research C4: Veteran ×1.5 only when Robin leads (FEW, JP), or whenever paired, as back too (SF). */
  readonly veteranAsBack: boolean;
  readonly priority: Readonly<Partial<Record<UnitId, Priority>>>;
  readonly maps: readonly MapPlan[];
  /** What the player recorded at a map's end: level and EXP. */
  readonly recorded: Readonly<Record<string, Readonly<Partial<Record<UnitId, { level: number; exp: number }>>>>>;
};

// ---------- One simulated run ----------

type Progress = { level: number; exp: number };
type UnitState = Progress & { def: UnitDef };

export type MapTally = { exp: number; kills: number; combats: number; heals: number; waits: number; crits: number; killsByGroup: Record<string, number> };
export type MapSample = {
  readonly start: Readonly<Partial<Record<UnitId, Progress>>>;
  readonly end: Readonly<Partial<Record<UnitId, Progress>>>;
  readonly tally: Readonly<Partial<Record<UnitId, MapTally>>>;
  readonly waves: number;
  readonly cleared: boolean;
};

const levelCap = (d: UnitDef) => (CLASSES[d.classId].tier === 'special' ? 30 : 20);
const il = (u: UnitState) => u.level + (CLASSES[u.def.classId].tier === 'advanced' ? 20 : 0);

/** Starting skills plus what the class has taught by the unit's level (Robin: Solidarity at Tactician Lv 10). */
const knownSkills = (u: UnitState): string[] => [
  ...new Set([...u.def.skills, ...(CLASS_SKILLS[u.def.classId as keyof typeof CLASS_SKILLS] ?? []).filter((c) => c.level <= u.level).map((c) => c.skill)]),
].map((id) => SKILLS[id as SkillId]?.name ?? id);

function fighterOf(u: UnitState): Fighter {
  const gained = u.level - u.def.joinLevel;
  const stats = Object.fromEntries(STATS.map((s) => [s, Math.floor(u.def.bases[s] + (u.def.growths[s] / 100) * gained)])) as Record<Stat, number>;
  return { name: u.def.name, className: className(u.def.classId, u.def.id === 'robin' ? 'M' : undefined), stats, skills: knownSkills(u), weapon: u.def.weapons[0] ? { item: u.def.weapons[0] } : undefined };
}

function best(lead: Fighter, weapons: readonly GameItem[], back: Fighter | undefined, foe: Foe): Matchup | undefined {
  let top: Matchup | undefined;
  for (const w of weapons) {
    const m = matchup({ ...lead, weapon: { item: w } }, back, back ? null : null, foe);
    const key = (r: Matchup) => r.damage * r.hits * r.hit;
    if (!top || key(m) > key(top)) top = m;
  }
  return top;
}

function gain(u: UnitState, amount: number) {
  u.exp += amount;
  while (u.exp >= 100) {
    if (u.level >= levelCap(u.def)) { u.exp = 0; break; }
    u.exp -= 100;
    u.level += 1;
  }
}

type Rng = () => number;

/** One map, one roll of the dice. */
function simulateMap(plan: Plan, mp: MapPlan, map: ChapterData, units: Map<UnitId, UnitState>, rng: Rng): MapSample {
  const start = Object.fromEntries([...units].map(([id, u]) => [id, { level: u.level, exp: u.exp }]));
  const foes = mapFoes(map).map((f) => ({ ...f, hp: f.foe.stats.hp, engaged: 0 }));
  const fielded = mp.fielded.filter((id) => units.has(id));
  const backs = new Set(Object.values(mp.pairs));
  const actors = fielded.filter((id) => !backs.has(id));
  const tally: Partial<Record<UnitId, MapTally>> = Object.fromEntries(fielded.map((id) => [id, { exp: 0, kills: 0, combats: 0, heals: 0, waits: 0, crits: 0, killsByGroup: {} }]));
  const prio = (id: UnitId) => plan.priority[id] ?? 1;
  let hurt = 0;
  let waves = 0;

  // Matchups are taken at the map's start: stats don't rise mid-map.
  const cache = new Map<string, Matchup | undefined>();
  const fighters = new Map(fielded.map((id) => [id, fighterOf(units.get(id)!)]));
  const mu = (id: UnitId, f: (typeof foes)[number]) => {
    const key = `${id}|${foes.indexOf(f)}`;
    if (!cache.has(key)) {
      const back = mp.pairs[id];
      cache.set(key, best(fighters.get(id)!, units.get(id)!.def.weapons, back ? fighters.get(back) : undefined, f.foe));
    }
    return cache.get(key);
  };
  // Solidarity: +10 Crit to an ally fighting next to its holder. A back's aura is assumed not to reach its own lead.
  const auras = actors.filter((id) => fighters.get(id)!.skills.includes('Solidarity'));
  const backMu = (back: UnitId, f: (typeof foes)[number]) => best(fighters.get(back)!, units.get(back)!.def.weapons, undefined, f.foe);
  const killChance = (id: UnitId, f: (typeof foes)[number]) => {
    const m = mu(id, f);
    if (!m || m.damage === 0) return 0;
    const need = Math.ceil(f.hp / m.damage);
    if (need > m.hits) return 0;
    // Chance at least `need` of `hits` land.
    const p = m.hit / 100;
    let c = 0;
    for (let k = need; k <= m.hits; k++) c += binom(m.hits, k) * p ** k * (1 - p) ** (m.hits - k);
    return c;
  };
  const roundDamage = (id: UnitId, f: (typeof foes)[number]) => { const m = mu(id, f); return m ? m.damage * m.hits * (m.hit / 100) : 0; };

  /** One combat: the lead strikes (with Dual Strikes on player phase), EXP handed out. */
  const combat = (id: UnitId, f: (typeof foes)[number], playerPhase: boolean) => {
    const m = mu(id, f);
    const lead = units.get(id)!;
    const backId = mp.pairs[id];
    const back = backId ? units.get(backId) : undefined;
    const bm = back && playerPhase ? backMu(backId!, f) : undefined;
    f.engaged += 1;
    tally[id]!.combats += 1;
    let leadDealt = false, backDealt = false, killer: 'lead' | 'back' | null = null;
    const aura = auras.some((a) => a !== id && rng() < ADJACENT) ? 10 : 0;
    for (let s = 0; s < (m?.hits ?? 0) && f.hp > 0; s++) {
      if (rng() * 100 < m!.hit && m!.damage > 0) {
        const crit = rng() * 100 < m!.crit + aura;
        if (crit) tally[id]!.crits += 1;
        f.hp -= m!.damage * (crit ? 3 : 1); leadDealt = true; if (f.hp <= 0) killer = 'lead';
      }
      if (f.hp > 0 && bm && rng() * 100 < m!.dualStrikeRate && rng() * 100 < bm.hit && bm.damage > 0) {
        f.hp -= bm.damage * (rng() * 100 < bm.crit ? 3 : 1); backDealt = true; if (f.hp <= 0) killer = 'back';
      }
    }
    const bonus = (CLASS_BONUS[f.foe.className] ?? 0) + (f.foe.boss ? 20 : 0);
    const foeLevel = f.level + (advanced(f.foe.className) ? 20 : 0);
    const give = (u: UnitState, uid: UnitId, amount: number) => { const a = Math.floor(amount); gain(u, a); tally[uid]!.exp += a; };
    if (leadDealt || killer === 'back') {
      const ld = foeLevel - il(lead);
      // Gap G2: when the back lands the kill, the lead is assumed to get damage EXP only.
      let e = killer === 'lead' ? Math.min(damageExp(ld, f.engaged) + killExp(ld, bonus), 100) : leadDealt ? damageExp(ld, f.engaged) : 0;
      if (back && lead.def.skills.includes('veteran')) e *= 1.5;
      give(lead, id, e);
    }
    if (back && backDealt) {
      const ld = foeLevel - il(back);
      const vet = plan.veteranAsBack && back.def.skills.includes('veteran') ? 1.5 : 1;
      give(back, backId!, (killer === 'back' ? damageExp(ld, f.engaged) : damageExp(ld, f.engaged) * 0.5) * vet);
    }
    if (killer) {
      const who = killer === 'lead' ? id : backId!;
      tally[who]!.kills += 1;
      tally[who]!.killsByGroup[f.group] = (tally[who]!.killsByGroup[f.group] ?? 0) + 1;
    }
    return m;
  };

  while (foes.some((f) => f.hp > 0) && waves < 40) {
    waves += 1;
    // Player phase: one action each.
    const fighting = actors.filter((id) => !units.get(id)!.def.staff || units.get(id)!.def.weapons.length);
    const healers = actors.filter((id) => units.get(id)!.def.staff && !units.get(id)!.def.weapons.length);
    const order = plan.policy === 'even' ? shuffle([...fighting], rng) : shuffle([...fighting], rng).sort((a, b) => prio(a) - prio(b));
    for (const id of order) {
      const live = foes.filter((f) => f.hp > 0);
      if (!live.length) break;
      let target = live[0]!;
      if (plan.policy === 'priority') {
        // Still to act, and ranked above me: whoever I could set up.
        const above = order.slice(order.indexOf(id) + 1).filter((o) => prio(o) > prio(id));
        const setUp = live
          .filter((f) => killChance(id, f) < 0.5 && above.some((o) => { const d = roundDamage(id, f); return d > 0 && killChance(o, { ...f, hp: Math.max(1, f.hp - d) }) >= 0.5; }))
          .sort((a, b) => roundDamage(id, b) - roundDamage(id, a))[0];
        // A priority unit won't take a foe a higher unit can kill; it chips or takes what nobody above it can.
        // Nothing to chip and nothing left that nobody above can take: wait, leaving the kill for a later wave.
        const leftOver = live.filter((f) => !above.some((o) => killChance(o, f) >= 0.5));
        if (!setUp && !leftOver.length) { tally[id]!.waits += 1; continue; }
        target = setUp ?? pickBest(id, leftOver);
      } else target = pickBest(id, live);
      combat(id, target, true);
    }
    for (const h of healers) {
      const u = units.get(h)!;
      if (hurt > 0 && u.def.staff) { const e = staffExp(u.def.staff.exp ?? 17, il(u)); gain(u, e); tally[h]!.exp += e; tally[h]!.heals += 1; hurt -= 1; }
    }
    // Enemy phase: live foes attack fighters, one each, the worst first; the lead counters.
    hurt = 0;
    const live = foes.filter((f) => f.hp > 0).sort((a, b) => b.foe.stats.str + b.foe.stats.mag - (a.foe.stats.str + a.foe.stats.mag));
    const targets = shuffle([...fighting], rng);
    for (let i = 0; i < Math.min(live.length, targets.length); i++) {
      const m = combat(targets[i]!, live[i]!, false);
      if (m && rng() * 100 < m.foeHit) hurt += 1;
    }
  }

  function pickBest(id: UnitId, pool: readonly (typeof foes)[number][]) {
    return [...pool].sort((a, b) => killChance(id, b) - killChance(id, a) || roundDamage(id, b) - roundDamage(id, a) || a.hp - b.hp)[0]!;
  }

  const end = Object.fromEntries([...units].map(([id, u]) => [id, { level: u.level, exp: u.exp }]));
  return { start, end, tally, waves, cleared: foes.every((f) => f.hp <= 0) };
}

// ---------- The forecast: many runs through the chain ----------

export type Band = { p10: number; p50: number; p90: number };
export type UnitForecast = {
  readonly startLevel: Band;
  readonly exp: Band;
  /** Level at map end as a decimal (Lv 5, 40 EXP → 5.4). */
  readonly endLevel: Band;
  readonly kills: number;
  readonly combats: number;
  readonly heals: number;
  readonly waits: number;
  readonly crits: number;
  /** Skills known at the map's start (median run). */
  readonly skills: readonly string[];
  readonly killsByGroup: Readonly<Record<string, number>>;
  /** Every sample's end level (decimal), for the percentile of a recorded result. */
  readonly samples: readonly number[];
};
export type MapForecast = {
  readonly map: string;
  readonly waves: Band;
  readonly units: Readonly<Partial<Record<UnitId, UnitForecast>>>;
  /** Every run's level (decimal) at the map's start, for every unit who has joined, fielded or not. */
  readonly startLevels: Readonly<Partial<Record<UnitId, readonly number[]>>>;
};

/** A milestone target: the unit at this level before the map starts (a deadline before an event, #144). */
export type Goal = { readonly unit: UnitId; readonly level: number; readonly map: string };
export type GoalResult = { readonly goal: Goal; readonly chance: number; readonly median: number; readonly joined: boolean };

export function goalChance(goal: Goal, fc: readonly MapForecast[]): GoalResult {
  const xs = fc.find((m) => m.map === goal.map)?.startLevels[goal.unit];
  if (!xs?.length) return { goal, chance: 0, median: 0, joined: false };
  return { goal, chance: xs.filter((x) => x >= goal.level).length / xs.length, median: band(xs).p50, joined: true };
}

export function forecast(plan: Plan, defs: readonly UnitDef[], runs = 300, seed = 1): MapForecast[] {
  const rng = mulberry32(seed);
  const perMap = plan.maps.map(() => [] as MapSample[]);
  for (let r = 0; r < runs; r++) {
    const units = new Map<UnitId, UnitState>();
    plan.maps.forEach((mp, i) => {
      const map = MAPS.find((m) => m.id === mp.map)!;
      for (const d of defs) if (d.joins === mp.map && !units.has(d.id)) units.set(d.id, { def: d, level: d.joinLevel, exp: 0 });
      // A map already recorded re-anchors every run on what really happened.
      const before = i > 0 ? plan.recorded[plan.maps[i - 1]!.map] : undefined;
      for (const [id, p] of Object.entries(before ?? {})) { const u = units.get(id as UnitId); if (u && p) { u.level = p.level; u.exp = p.exp; } }
      perMap[i]!.push(simulateMap(plan, mp, map, units, rng));
    });
  }
  return plan.maps.map((mp, i) => {
    const samples = perMap[i]!;
    const out: Partial<Record<UnitId, UnitForecast>> = {};
    for (const id of mp.fielded) {
      const ts = samples.map((s) => s.tally[id]).filter((t): t is MapTally => !!t);
      if (!ts.length) continue;
      const lv = (p: Progress | undefined) => (p ? p.level + p.exp / 100 : 0);
      const groups: Record<string, number> = {};
      for (const t of ts) for (const [g, n] of Object.entries(t.killsByGroup)) groups[g] = (groups[g] ?? 0) + n / ts.length;
      const endSamples = samples.map((s) => lv(s.end[id]));
      out[id] = {
        startLevel: band(samples.map((s) => lv(s.start[id]))),
        exp: band(ts.map((t) => t.exp)),
        endLevel: band(endSamples),
        kills: mean(ts.map((t) => t.kills)),
        combats: mean(ts.map((t) => t.combats)),
        heals: mean(ts.map((t) => t.heals)),
        waits: mean(ts.map((t) => t.waits)),
        crits: mean(ts.map((t) => t.crits)),
        skills: skillsAt(defs.find((d) => d.id === id)!, Math.floor(band(samples.map((s) => s.start[id]?.level ?? 0)).p50)),
        killsByGroup: groups,
        samples: endSamples,
      };
    }
    const startLevels: Partial<Record<UnitId, number[]>> = {};
    for (const s of samples) for (const [id, p] of Object.entries(s.start)) if (p) (startLevels[id as UnitId] ??= []).push(p.level + p.exp / 100);
    return { map: mp.map, waves: band(samples.map((s) => s.waves)), units: out, startLevels };
  });
}

/** Where a recorded result falls among the forecast's runs, 0–100. */
export const percentileOf = (samples: readonly number[], actual: number): number =>
  Math.round((100 * samples.filter((s) => s < actual).length + 50 * samples.filter((s) => s === actual).length) / Math.max(1, samples.length));

/** Calibration over every recorded (unit, map): how often the result fell inside p10–p90 (80% if calibrated). */
export function calibration(plan: Plan, fc: readonly MapForecast[]): { points: number; inside: number; meanPercentile: number } {
  const ps: number[] = [];
  let inside = 0;
  fc.forEach((m) => {
    for (const [id, p] of Object.entries(plan.recorded[m.map] ?? {})) {
      const u = m.units[id as UnitId];
      if (!u || !p) continue;
      const a = p.level + p.exp / 100;
      ps.push(percentileOf(u.samples, a));
      if (a >= u.endLevel.p10 && a <= u.endLevel.p90) inside++;
    }
  });
  return { points: ps.length, inside, meanPercentile: ps.length ? Math.round(mean(ps)) : NaN };
}

const skillsAt = (def: UnitDef, level: number) => knownSkills({ def, level, exp: 0 });

// ---------- small helpers ----------

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function band(xs: readonly number[]): Band {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}
function binom(n: number, k: number) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
function shuffle<T>(xs: T[], rng: Rng): T[] { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
function mulberry32(a: number): Rng { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- Suggesting the smallest change that lifts a milestone ----------

/** A milestone reads as met when this share of runs meets it. */
export const TARGET = 0.8;

export type Suggestion = {
  readonly label: string;
  readonly plan: Plan;
  readonly chance: number;
  /** The other goals' chance changes, same order as the goals (the target's own slot is 0). */
  readonly others: readonly number[];
  /** Extra waves over the charted maps (median sum): each is another enemy phase the flawless chance must survive. */
  readonly waves: number;
  /** Other goals met before this edit that it pushes below the target. */
  readonly breaks: number;
};

const FORCED = (map: ChapterData) => new Set(['chrom', 'robin', ...map.forced.map((f) => f.toLowerCase())]);
const totalWaves = (fc: readonly MapForecast[]) => fc.reduce((a, m) => a + m.waves.p50, 0);

/**
 * One-edit changes to the plan, each re-forecast, best lift first. An edit is a span pin from the unit's join map
 * up to the goal's deadline: raise the unit's priority, lower another's, pair it as lead with a back, or field it
 * in place of the last unforced unit. Smallest first: edits that reach the target (80%) without breaking another met
 * goal, by fewest extra waves; then those that break one; then the rest by chance.
 */
export function suggest(plan: Plan, defs: readonly UnitDef[], goals: readonly Goal[], index: number, runs = 120): Suggestion[] {
  const goal = goals[index]!;
  const def = defs.find((d) => d.id === goal.unit)!;
  const ids = plan.maps.map((m) => m.map);
  const from = Math.max(0, ids.indexOf(def.joins));
  const to = ids.indexOf(goal.map); // exclusive: the deadline is the map's start
  const span = (i: number) => i >= from && i < to;
  const score = (p: Plan) => {
    const fc = forecast(p, defs, runs, 7);
    return { chances: goals.map((g) => goalChance(g, fc).chance), waves: totalWaves(fc) };
  };
  const base = score(plan);
  const edits: { label: string; plan: Plan }[] = [];
  const label = (id: string) => MAPS.find((m) => m.id === id)!.label.replace('Chapter ', 'Ch ');
  const name = (id: UnitId) => defs.find((d) => d.id === id)?.name ?? id;

  if ((plan.priority[goal.unit] ?? 1) < 2) edits.push({ label: `Set ${def.name} to high priority`, plan: { ...plan, priority: { ...plan.priority, [goal.unit]: 2 } } });
  const fieldedSomewhere = new Set(plan.maps.filter((_, i) => span(i)).flatMap((m) => m.fielded));
  for (const other of fieldedSomewhere) {
    if (other === goal.unit || (plan.priority[other] ?? 1) === 0) continue;
    edits.push({ label: `Set ${name(other)} to low priority`, plan: { ...plan, priority: { ...plan.priority, [other]: 0 } } });
  }
  for (const back of fieldedSomewhere) {
    if (back === goal.unit || plan.maps.some((m, i) => span(i) && m.pairs[goal.unit] === back)) continue;
    edits.push({
      label: `Pair ${def.name} as lead with ${name(back)} behind, ${label(plan.maps[from]!.map)}–${label(plan.maps[to - 1]!.map)}`,
      plan: {
        ...plan,
        maps: plan.maps.map((m, i) => {
          if (!span(i) || !m.fielded.includes(back)) return m;
          const pairs = Object.fromEntries(Object.entries(m.pairs).filter(([l, b]) => l !== goal.unit && b !== goal.unit && l !== back && b !== back));
          return { ...m, fielded: m.fielded.includes(goal.unit) ? m.fielded : [...m.fielded, goal.unit], pairs: { ...pairs, [goal.unit]: back } };
        }),
      },
    });
  }
  if (plan.maps.some((m, i) => span(i) && !m.fielded.includes(goal.unit))) {
    const out: string[] = [];
    const next = {
      ...plan,
      maps: plan.maps.map((m, i) => {
        if (!span(i) || m.fielded.includes(goal.unit)) return m;
        const map = MAPS.find((x) => x.id === m.map)!;
        const benchable = [...m.fielded].reverse().find((u) => !FORCED(map).has(u) && !Object.entries(m.pairs).some(([l, b]) => l === u || b === u));
        const fielded = m.fielded.length >= deployCount(map) && benchable ? m.fielded.filter((u) => u !== benchable) : m.fielded;
        if (benchable && fielded !== m.fielded) out.push(name(benchable));
        return { ...m, fielded: [...fielded, goal.unit] };
      }),
    };
    edits.push({ label: `Field ${def.name} before ${label(goal.map)}${out.length ? `, benching ${[...new Set(out)].join(', ')}` : ''}`, plan: next });
  }

  return edits
    .map((e) => {
      const s = score(e.plan);
      const breaks = s.chances.filter((c, i) => i !== index && base.chances[i]! >= TARGET && c < TARGET).length;
      return { label: e.label, plan: e.plan, chance: s.chances[index]!, breaks, others: s.chances.map((c, i) => (i === index ? 0 : c - base.chances[i]!)), waves: s.waves - base.waves };
    })
    .filter((s) => s.chance > base.chances[index]!)
    .sort((a, b) => a.breaks - b.breaks || Number(b.chance >= TARGET) - Number(a.chance >= TARGET) || (a.chance >= TARGET ? a.waves - b.waves : 0) || b.chance - a.chance);
}
