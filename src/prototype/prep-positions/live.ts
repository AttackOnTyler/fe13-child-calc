// PROTOTYPE — throwaway (#262). Does confirm-or-correct keep the script on track? Variant D's layout with the loop made
// real on the Prologue: a 1-turn solver (safety first) plans the player phase, you tap outcomes, the app predicts the enemy
// phase (wake groups, reach, "kills first" targeting), you tick or fix, the board updates and the next turn re-solves.
// Try a move: pick a unit, a tile, then a command from the game's menu (Attack, Heal, Pair Up, Trade, Items, Wait); the
// rest of the turn re-solves around it and the page lists what that gains and costs.
// Stub: damage (Atk − Def, doubling at Spd +5, no triangle/ranks/pair-up stats), 1 detailed turn instead of 3.
// @ts-nocheck
import { ALLIES, ENEMIES, H, ROWS, W, byId, reach, round, walkable, type Unit } from './model';

type P = [number, number];
const k = (p: P) => `${p[0]},${p[1]}`;
const dist = (a: P, b: P) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const GROUP1 = ['m3', 'm4', 'b3', 'b4', 't'];
const inRange = (u: Unit, from: P, to: P) => { const m = dist(from, to); return m >= u.range[0] && m <= u.range[1]; };

// ---- the simulated board ---------------------------------------------------------------------------------------------
/** Positions, HP, inventories (item → uses) and pairs (lead → back): everything a command can change. */
type Sim = { pos: Record<string, P>; hp: Record<string, number>; inv: Record<string, Record<string, number>>; back: Record<string, string> };
const clone = (s: Sim): Sim => ({ pos: { ...s.pos }, hp: { ...s.hp }, inv: Object.fromEntries(Object.entries(s.inv).map(([id, v]) => [id, { ...v }])), back: { ...s.back } });
const backsOf = (s: Sim) => new Set(Object.values(s.back));
/** Allies standing on the map (a paired back rides with its lead and can't be targeted). */
const leads = (s: Sim) => ALLIES.filter((a) => s.hp[a.id] > 0 && s.pos[a.id] && !backsOf(s).has(a.id));
const liveFoes = (s: Sim) => ENEMIES.filter((e) => s.hp[e.id] > 0 && s.pos[e.id]);

const S: Sim & { awake: Set<string>; turn: number } = {
  pos: Object.fromEntries([...ALLIES, ...ENEMIES].map((u) => [u.id, [u.x, u.y] as P])),
  hp: Object.fromEntries([...ALLIES, ...ENEMIES].map((u) => [u.id, u.hp])),
  inv: { fre: { 'Silver Lance': 30 }, chr: { Falchion: 99, Rapier: 35, Vulnerary: 3 }, rob: { Thunder: 45, 'Bronze Sword': 50 }, lis: { Heal: 30, Vulnerary: 3 } },
  back: {},
  awake: new Set(ENEMIES.filter((e) => e.wake === 'now' || e.wake === 'never moves').map((e) => e.id)),
  turn: 1,
};

// ---- combat (stub) ------------------------------------------------------------------------------------------------
function strike(a: Unit, d: Unit, s?: Sim): { dmg: number; hits: number } {
  if (a.side === 'enemy') return round(a, d, a.skills);
  if (a.id === 'lis') return { dmg: 0, hits: 0 };
  const dmg = Math.max(0, a.atk - (a.magic ? d.res : d.def));
  const aspd = a.spd + (s?.back[a.id] === 'chr' ? 3 : 0); // Chrom behind: +3 Spd (the game showed it)
  return { dmg, hits: aspd - d.spd >= 5 ? 2 : 1 };
}
type Outcome = 'hit' | 'missed' | 'crit' | 'DS';
/** One combat, into s.hp. `o` is the initiator's result; `c` whether the counter lands. */
function fight(s: Sim, aId: string, dId: string, o: Outcome = 'hit', c: 'hit' | 'missed' = 'hit'): string {
  const hp = s.hp, a = byId(aId), d = byId(dId), from = s.pos[aId], dAt = s.pos[dId];
  const sa = strike(a, d, s), sd = strike(d, a, s);
  const canCounter = d.id !== 'lis' && inRange(d, dAt, from);
  const notes: string[] = [];
  const hitA = () => {
    if (hp[dId] <= 0 || hp[aId] <= 0) return;
    let x = o === 'missed' ? 0 : sa.dmg * (o === 'crit' ? 3 : 1);
    if (o === 'DS' && s.back[aId]) x += strike(byId(s.back[aId]), d).dmg;
    hp[dId] = Math.max(0, hp[dId] - x); notes.push(`${a.name} ${x}`);
  };
  const hitD = () => { if (!canCounter || hp[dId] <= 0 || hp[aId] <= 0) return; const x = c === 'missed' ? 0 : sd.dmg; hp[aId] = Math.max(0, hp[aId] - x); notes.push(`${d.name} ${x}`); };
  hitA(); hitD(); if (sa.hits > 1) hitA(); if (sd.hits > 1) hitD();
  return `${a.name} → ${d.name}: ${notes.join(', ')}${hp[dId] <= 0 ? ` · ${d.name} dies` : ''}${hp[aId] <= 0 ? ` · ${a.name} dies` : ''}`;
}

// ---- commands ----------------------------------------------------------------------------------------------------------
type Cmd = 'Attack' | 'Heal' | 'Items' | 'Pair Up' | 'Wait';
/** A unit's turn: an optional trade first (it doesn't end the turn), then one command from the tile it moved to. */
type Act = { unit: string; to: P; cmd: Cmd; target?: string; item?: string; trade?: { with: string; item: string; dir: 'take' | 'give' } };
const VULN = 'Vulnerary';
/** Do one act on s (mutates). Returns a log line and how far a planned attack's full counter overshoots the attacker. */
function doAct(s: Sim, a: Act, o: Outcome = 'hit', c: 'hit' | 'missed' = 'hit'): { log: string; lethal: number } {
  const u = byId(a.unit); const notes: string[] = []; let lethal = 0;
  if (a.trade) {
    const [from, to] = a.trade.dir === 'take' ? [a.trade.with, a.unit] : [a.unit, a.trade.with];
    const uses = s.inv[from][a.trade.item]; delete s.inv[from][a.trade.item]; s.inv[to][a.trade.item] = uses;
    notes.push(`trades: ${a.trade.item} ${a.trade.dir === 'take' ? 'from' : 'to'} ${byId(a.trade.with).name}`);
  }
  s.pos[a.unit] = a.to; if (s.back[a.unit]) s.pos[s.back[a.unit]] = a.to;
  if (a.cmd === 'Attack') {
    const d = byId(a.target!);
    if (inRange(d, s.pos[d.id], a.to)) { const r = strike(d, u, s); if (r.dmg * r.hits >= s.hp[a.unit]) lethal = r.dmg * r.hits - s.hp[a.unit] + 1; }
    notes.push(fight(s, a.unit, a.target!, o, c));
  }
  if (a.cmd === 'Heal') { s.hp[a.target!] = Math.min(byId(a.target!).hp, s.hp[a.target!] + 10); s.inv[a.unit].Heal--; notes.push(`heals ${byId(a.target!).name} → ${s.hp[a.target!]}`); }
  if (a.cmd === 'Items') { s.hp[a.unit] = Math.min(u.hp, s.hp[a.unit] + 10); if (--s.inv[a.unit][VULN] <= 0) delete s.inv[a.unit][VULN]; notes.push(`uses a Vulnerary → ${s.hp[a.unit]}`); }
  if (a.cmd === 'Pair Up') { s.back[a.target!] = a.unit; s.pos[a.unit] = s.pos[a.target!]; notes.push(`pairs up behind ${byId(a.target!).name}`); }
  if (a.cmd === 'Wait' && !a.trade) notes.push('waits');
  return { log: `${u.name} → (${a.to}) ${notes.join('; ')}`, lethal };
}
/** Every tile a unit can end on this turn (allies are passable), plus the allies it could pair onto. */
function tilesFor(u: Unit, s: Sim): { free: Set<string>; pairOnto: Map<string, string> } {
  const foeTiles = new Set(liveFoes(s).map((e) => k(s.pos[e.id])));
  const occupant = new Map(leads(s).filter((a) => a.id !== u.id).map((a) => [k(s.pos[a.id]), a.id]));
  const free = new Set<string>(); const pairOnto = new Map<string, string>();
  for (const t of reach(u, s.pos[u.id], foeTiles).keys()) {
    const who = occupant.get(t);
    if (!who) free.add(t);
    else if (!s.back[who] && !s.back[u.id]) pairOnto.set(t, who);
  }
  return { free, pairOnto };
}
/** The game's command menu at a tile (after an optional trade), as acts. */
function menu(u: Unit, to: P, s: Sim, trade?: Act['trade']): Act[] {
  const t = k(to); const { pairOnto } = tilesFor(u, s);
  if (pairOnto.has(t)) return [{ unit: u.id, to, cmd: 'Pair Up', target: pairOnto.get(t) }];
  const inv = { ...s.inv[u.id] }; if (trade) { if (trade.dir === 'take') inv[trade.item] = s.inv[trade.with][trade.item]; else delete inv[trade.item]; }
  const out: Act[] = [];
  if (u.id !== 'lis') for (const e of liveFoes(s)) if (inRange(u, to, s.pos[e.id])) out.push({ unit: u.id, to, cmd: 'Attack', target: e.id, trade });
  if (inv.Heal) for (const a of leads(s)) if (a.id !== u.id && s.hp[a.id] < a.hp && dist(to, s.pos[a.id]) === 1) out.push({ unit: u.id, to, cmd: 'Heal', target: a.id, trade });
  if (inv[VULN] && s.hp[u.id] < u.hp) out.push({ unit: u.id, to, cmd: 'Items', item: VULN, trade });
  out.push({ unit: u.id, to, cmd: 'Wait', trade });
  return out;
}
/** Who a unit could trade with from a tile: adjacent allies on the map, and its own back. */
function tradePartners(u: Unit, to: P, s: Sim): string[] {
  const out = leads(s).filter((a) => a.id !== u.id && dist(to, s.pos[a.id]) === 1).flatMap((a) => [a.id, ...(s.back[a.id] ? [s.back[a.id]] : [])]);
  if (s.back[u.id]) out.unshift(s.back[u.id]);
  return out;
}

// ---- wake + danger --------------------------------------------------------------------------------------------------
function strikeSet(e: Unit, at: P, s: Sim, allyIds: string[]): Set<string> {
  const blocked = new Set(allyIds.map((id) => k(s.pos[id])));
  const out = new Set<string>();
  for (const t of reach(e, at, blocked).keys()) {
    const [x, y] = t.split(',').map(Number);
    for (let dx = -e.range[1]; dx <= e.range[1]; dx++) for (let dy = -e.range[1]; dy <= e.range[1]; dy++) {
      const m = Math.abs(dx) + Math.abs(dy); if (m >= e.range[0] && m <= e.range[1]) out.add(`${x + dx},${y + dy}`);
    }
  }
  return out;
}
/** Group 1 wakes when an ally stands where any member could strike it (#254: AttackRange). */
function wakes(s: Sim, awake: Set<string>): Set<string> {
  const ids = leads(s).map((a) => a.id);
  const w = new Set(awake);
  if (GROUP1.some((g) => !w.has(g) && s.hp[g] > 0)) {
    const hit = GROUP1.filter((g) => s.hp[g] > 0).some((g) => { const st = strikeSet(byId(g), s.pos[g], s, ids); return ids.some((id) => st.has(k(s.pos[id]))); });
    if (hit) GROUP1.forEach((g) => w.add(g));
  }
  return w;
}
type Check = { id: string; total: number; hp: number; by: string[] };
/** Gang-up worst case on each ally where it stands: every awake foe that can strike its tile, every non-crit hit landing. */
function safety(s: Sim): Check[] {
  const awake = wakes(s, S.awake);
  const ids = leads(s).map((a) => a.id);
  return ids.map((id) => {
    const u = byId(id); let total = 0; const by: string[] = [];
    for (const e of liveFoes(s)) {
      if (!awake.has(e.id)) continue;
      if (strikeSet(e, s.pos[e.id], s, ids.filter((x) => x !== id)).has(k(s.pos[id]))) { const r = round(e, u, e.skills); total += r.dmg * r.hits; by.push(`${e.name} ${r.dmg}${r.hits > 1 ? '×2' : ''}`); }
    }
    return { id, total, hp: s.hp[id], by };
  });
}

// ---- the 1-turn solver ----------------------------------------------------------------------------------------------
type Plan = { acts: Act[]; safe: boolean; checks: Check[]; wakes: boolean };
function options(u: Unit, s: Sim): Act[] {
  const { free, pairOnto } = tilesFor(u, s);
  const out: Act[] = [];
  for (const t of [...free, ...pairOnto.keys()]) {
    const to = t.split(',').map(Number) as P;
    // the solver skips trades and only drinks when it matters (keeps the search small)
    out.push(...menu(u, to, s).filter((a) => a.cmd !== 'Items' || s.hp[u.id] <= u.hp - 8));
  }
  return out;
}
/** `only`: judge just these units (while ranking one unit's options, the ones still to move would add noise). */
function value(s0: Sim, s: Sim, lethal: number, only?: Set<string>) {
  const checks = safety(s).filter((c) => !only || only.has(c.id));
  const over = checks.reduce((x, c) => x + Math.max(0, c.total - c.hp + 1), 0) + lethal;
  const margin = checks.reduce((x, c) => x + Math.min(c.hp - c.total, 15), 0);
  const kills = liveFoes(s0).filter((e) => s.hp[e.id] <= 0).length;
  const dmg = liveFoes(s0).reduce((x, e) => x + (s0.hp[e.id] - s.hp[e.id]), 0);
  const heal = ALLIES.reduce((x, a) => x + Math.max(0, s.hp[a.id] - s0.hp[a.id]), 0);
  const fre = s.pos.fre ?? [0, 0];
  const near = Math.min(...liveFoes(s).map((e) => dist(fre, s.pos[e.id])), 99);
  const drawn = checks.find((c) => c.id === 'fre')?.by.length ?? 0; // foes the wall draws
  const exposed = checks.filter((c) => c.id !== 'fre').reduce((x, c) => x + c.total * (c.id === 'chr' ? 3 : 1), 0); // non-walls taking hits; Chrom's loss ends the run
  const paired = backsOf(s).size; // a back can't be hit and earns support points (#257: pairing is part of the solve)
  return { checks, safe: over === 0, v: -over * 1e6 + kills * 1e4 + dmg * 50 + heal * 40 + drawn * 30 - near * 10 - exposed * 60 + margin * 25 + paired * 400 };
}
function run(acts: Act[], s0: Sim) { const s = clone(s0); let lethal = 0; for (const a of acts) lethal += doAct(s, a).lethal; return { s, lethal }; }
/** `pin`: the player's own act for one unit; the rest of the turn re-solves around it. */
function solve(pin?: Act): Plan {
  const s0: Sim = clone(S);
  // Chrom first (he can pair onto Frederick before Frederick moves), then Frederick, Robin, Lissa; a beam per level.
  const order = ['chr', 'fre', 'rob', 'lis'];
  const beam = [5, 8, 10, Infinity];
  let best: { acts: Act[]; v: number; checks: Check[]; safe: boolean } | null = null;
  const step = (id: string, s: Sim) => {
    if (!leads(s).some((a) => a.id === id)) return [null];
    if (pin && pin.unit === id) return [pin];
    return options(byId(id), s);
  };
  const rank = (id: string, s: Sim, n: number, acted: Act[]) => {
    const only = new Set([id, ...acted.map((a) => a.unit)]);
    return step(id, s).map((a) => { if (!a) return { a, v: 0 }; const r = run([a], s); return { a, v: value(s, r.s, r.lethal, only).v }; }).sort((x, y) => y.v - x.v).slice(0, n);
  };
  const go = (i: number, s: Sim, acts: Act[]) => {
    if (i === order.length) { const end = run(acts, s0); const val = value(s0, end.s, end.lethal); if (!best || val.v > best.v) best = { acts, ...val }; return; }
    const opts = beam[i] === Infinity ? step(order[i], s).map((a) => ({ a })) : rank(order[i], s, beam[i], acts);
    for (const o of opts) go(i + 1, o.a ? run([o.a], s).s : s, o.a ? [...acts, o.a] : acts);
  };
  go(0, s0, []);
  const end = run(best!.acts, s0).s;
  const woke = GROUP1.some((g) => !S.awake.has(g) && wakes(end, S.awake).has(g));
  return { acts: best!.acts, safe: best!.safe, checks: best!.checks, wakes: woke };
}

// ---- enemy-phase prediction (folklore targeting: kills first, then damage) --------------------------------------------
type EnemyAct = { id: string; to: P; target?: string; o: 'hit' | 'missed' | 'crit'; c: 'hit' | 'missed'; fixed: boolean; ok: boolean };
function predictFrom(s0: Sim, awake: Set<string>): EnemyAct[] {
  const s = clone(s0);
  const ids = leads(s).map((a) => a.id);
  const out: EnemyAct[] = [];
  for (const e of liveFoes(s)) {
    if (!awake.has(e.id)) continue;
    const occ = new Set([...ids.map((id) => k(s.pos[id])), ...liveFoes(s).filter((f) => f.id !== e.id).map((f) => k(s.pos[f.id]))]);
    let best: { to: P; target?: string; v: number } | null = null;
    for (const t of reach(e, s.pos[e.id], new Set(ids.map((id) => k(s.pos[id])))).keys()) {
      if (occ.has(t)) continue;
      const to = t.split(',').map(Number) as P;
      for (const id of ids) if (inRange(e, to, s.pos[id])) {
        const r = round(e, byId(id), e.skills); const kill = r.dmg * r.hits >= s.hp[id];
        const v = (kill ? 1e4 : 0) + r.dmg * r.hits * 10 - dist(to, s.pos[e.id]);
        if (!best || v > best.v) best = { to, target: id, v };
      }
      if (!best?.target) { const d = Math.min(...ids.map((id) => dist(to, s.pos[id]))); const v = -d * 10 - 1e5; if (!best || v > best.v) best = { to, v }; }
    }
    if (!best) best = { to: s.pos[e.id], v: 0 };
    s.pos[e.id] = best.to;
    out.push({ id: e.id, to: best.to, target: best.target, o: 'hit', c: 'hit', fixed: false, ok: false });
  }
  return out;
}
const predict = () => { S.awake = wakes(S, S.awake); return predictFrom(S, S.awake); };

// ---- what a plan leads to, and the comparison ---------------------------------------------------------------------------
type Outlook = { safe: boolean; lethal: number; kills: number; counterKills: number; dealt: number; wakes: boolean; drawn: number; exposed: number; checks: Check[]; hpAfter: Record<string, number>; deaths: string[]; foesLeft: number };
function outlook(p: Plan): Outlook {
  const { s: end, lethal } = run(p.acts, S);
  const ep = predictFrom(end, wakes(end, S.awake));
  const s = clone(end);
  for (const m of ep) { s.pos[m.id] = m.to; if (m.target && s.hp[m.target] > 0 && s.hp[m.id] > 0) fight(s, m.id, m.target); }
  const was = liveFoes(S);
  return {
    safe: p.safe, lethal, wakes: p.wakes, checks: safety(end),
    kills: was.filter((e) => end.hp[e.id] <= 0).length,
    counterKills: was.filter((e) => end.hp[e.id] > 0 && s.hp[e.id] <= 0).length,
    dealt: was.reduce((x, e) => x + (S.hp[e.id] - s.hp[e.id]), 0),
    drawn: ep.filter((m) => m.target === 'fre').length,
    exposed: ep.filter((m) => m.target && m.target !== 'fre').length,
    hpAfter: Object.fromEntries(ALLIES.filter((a) => S.hp[a.id] > 0).map((a) => [a.id, s.hp[a.id]])),
    deaths: ALLIES.filter((a) => S.hp[a.id] > 0 && s.hp[a.id] <= 0).map((a) => a.name),
    foesLeft: was.filter((e) => s.hp[e.id] > 0).length,
  };
}
function compare(mine: Outlook, theirs: Outlook): { good: string[]; bad: string[]; same: string[] } {
  const good: string[] = [], bad: string[] = [], same: string[] = [];
  const cmp = (label: string, a: number, b: number, higherIsBetter: boolean, unit = '') => {
    if (a === b) return same.push(`${label}: ${a}${unit}`);
    ((higherIsBetter ? a > b : a < b) ? good : bad).push(`${label}: ${a}${unit} (plan: ${b}${unit})`);
  };
  if (mine.safe !== theirs.safe) (mine.safe ? good : bad).push(mine.safe ? 'Keeps the hard line (no death without a crit)' : 'Breaks the hard line: someone can die without a crit');
  if (mine.lethal) bad.push('An attack whose counter can kill the attacker if it misses');
  if (mine.deaths.length || theirs.deaths.length) cmp('Predicted deaths', mine.deaths.length, theirs.deaths.length, false);
  cmp('Kills this phase', mine.kills, theirs.kills, true);
  cmp('Kills on counters (enemy phase)', mine.counterKills, theirs.counterKills, true);
  cmp('Foes left after the enemy phase', mine.foesLeft, theirs.foesLeft, false);
  cmp('Damage dealt', mine.dealt, theirs.dealt, true);
  cmp('Foes drawn onto Frederick', mine.drawn, theirs.drawn, true);
  cmp('Attacks on Robin or Lissa', mine.exposed, theirs.exposed, false);
  for (const id of Object.keys(mine.hpAfter)) cmp(`${byId(id).name}’s HP after the enemy phase`, mine.hpAfter[id], theirs.hpAfter[id], true);
  for (const c of mine.checks) { const o = theirs.checks.find((x) => x.id === c.id); if (o) cmp(`${byId(c.id).name}’s worst case`, c.total, o.total, false, ` of ${c.hp}`); }
  if (mine.wakes !== theirs.wakes) (mine.wakes ? bad : good).push(mine.wakes ? 'Wakes the northern group now (the plan doesn’t)' : 'Doesn’t wake the northern group (the plan does)');
  return { good, bad, same };
}

// ---- UI state ---------------------------------------------------------------------------------------------------------
let phase: 'player' | 'enemy' | 'won' | 'lost' = 'player';
let plan: Plan = null!;
let pred: EnemyAct[] = [];
const taps = { turn: 0, total: 0 };
const score = { asIs: 0, fixed: 0 };
const log: string[] = [];
let focus = 'lis';
let fixMode = false; let placing: string | null = null; // "I actually moved it": a real board fix
let trying: string | null = null; // the unit whose move the player is trying
let menuAt: { unit: string; to: P; trade?: Act['trade']; open?: 'Attack' | 'Heal' | 'Trade' } | null = null; // the command menu open at a tile
let whatIf: Act | null = null;
let basePlan: Plan | null = null; // the solver's own plan, kept while trying a move
const outcomes = new Map<number, { o: Outcome; c: 'hit' | 'missed' }>();
const tap = () => { taps.turn++; taps.total++; };
const resetTry = () => { trying = null; menuAt = null; whatIf = null; basePlan = null; };

function applyPlayer() {
  plan.acts.forEach((a, i) => { const oc = outcomes.get(i) ?? { o: 'hit', c: 'hit' }; log.push(`T${S.turn} ${doAct(S, a, oc.o, oc.c).log}`); });
  outcomes.clear(); resetTry(); bury();
  if (liveFoes(S).length === 0) { phase = 'won'; return; }
  pred = predict(); phase = 'enemy';
}
function applyEnemy() {
  for (const p of pred) {
    if (S.hp[p.id] <= 0) continue;
    S.pos[p.id] = p.to;
    if (p.target && S.hp[p.target] > 0) log.push(`EP${S.turn} ${fight(S, p.id, p.target, p.o, p.c)}`);
    if (p.fixed) score.fixed++; else score.asIs++;
  }
  bury();
  if (S.hp.rob <= 0 || S.hp.chr <= 0) { phase = 'lost'; return; }
  if (liveFoes(S).length === 0) { phase = 'won'; return; }
  S.turn++; taps.turn = 0; phase = 'player'; plan = solve();
}
/** The dead leave the board; a dead lead's back is left standing on its tile. */
function bury() {
  for (const a of ALLIES) if (S.hp[a.id] <= 0 && S.pos[a.id]) {
    log.push(`✝ ${a.name} died`); delete S.pos[a.id];
    if (S.back[a.id]) delete S.back[a.id];
    for (const [lead, b] of Object.entries(S.back)) if (b === a.id) delete S.back[lead];
  }
  for (const e of ENEMIES) if (S.hp[e.id] <= 0) delete S.pos[e.id];
}

// ---- render (variant D's layout) ------------------------------------------------------------------------------------
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const nm = (id: string) => byId(id).name + (byId(id).side === 'enemy' ? ` (${byId(id).weapon})` : '');
const letter: Record<string, string> = { fre: 'F', chr: 'C', rob: 'R', lis: 'L', g: 'G', w: 'W', t: 'T' };
const tok = (id: string) => letter[id] ?? byId(id).name[0];
function forecast(a: Act, s: Sim): string {
  if (a.cmd === 'Attack') { const u = byId(a.unit), d = byId(a.target!); const x = strike(u, d, s), y = strike(d, u, s); return `${x.dmg}${x.hits > 1 ? '×2' : ''} vs ${s.hp[d.id]} HP · ${inRange(d, s.pos[d.id], a.to) ? `counter ${y.dmg}${y.hits > 1 ? '×2' : ''}` : 'no counter'}`; }
  if (a.cmd === 'Heal') return `+10 (${s.hp[a.target!]} → ${Math.min(byId(a.target!).hp, s.hp[a.target!] + 10)})`;
  if (a.cmd === 'Items') return `Vulnerary: +10 (${s.hp[a.unit]} → ${Math.min(byId(a.unit).hp, s.hp[a.unit] + 10)})`;
  return '';
}
const actText = (a: Act) => `${a.trade ? `Trade (${a.trade.dir} ${a.trade.item} ${a.trade.dir === 'take' ? 'from' : 'to'} ${byId(a.trade.with).name}), then ` : ''}${a.cmd}${a.target ? ' ' + nm(a.target) : ''}`;
function board(): string {
  const f = byId(focus);
  const ids = leads(S).map((a) => a.id);
  const dz = new Map<string, number>();
  if (ids.includes(focus)) for (const e of liveFoes(S)) if (S.awake.has(e.id)) { const r = round(e, f, e.skills); for (const t of strikeSet(e, S.pos[e.id], S, ids.filter((x) => x !== focus))) dz.set(t, (dz.get(t) ?? 0) + r.dmg * r.hits); }
  const steps = new Map((phase === 'player' ? plan.acts : []).map((a, i) => [k(a.to), i + 1]));
  const pr = new Map((phase === 'enemy' ? pred : []).map((p) => [k(p.to), p.id]));
  const reachT = trying ? tilesFor(byId(trying), S) : null;
  let cells = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = `${x},${y}`; const d = dz.get(t);
    const us = [...leads(S), ...liveFoes(S)].filter((u) => k(S.pos[u.id]) === t);
    const cls = ['c', `ter-${ROWS[y][x] === '+' ? 'bridge' : ROWS[y][x]}`, walkable(x, y) ? '' : 'off', d ? (d >= f.hp ? 'dz-kill' : 'dz') : '', pr.has(t) ? 'pred' : '',
      fixMode && placing && walkable(x, y) ? 'placeable' : '', reachT?.free.has(t) || reachT?.pairOnto.has(t) ? 'reach' : '', menuAt && k(menuAt.to) === t ? 'tried' : whatIf && k(whatIf.to) === t ? 'tried' : ''].join(' ');
    cells += `<div class="${cls}" data-tile="${t}" title="(${t})${d ? ` · worst case on ${f.name}: ${d}` : ''}${reachT?.pairOnto.has(t) ? ` · Pair Up with ${byId(reachT.pairOnto.get(t)!).name}` : ''}">${us.map((u) => `<span class="u ${u.side}${u.id === trying ? ' sel' : u.id === focus ? ' focus' : ''}${S.awake.has(u.id) || u.side === 'ally' ? '' : ' asleep'}" data-unit="${u.id}" title="${esc(u.name)} ${S.hp[u.id]}/${u.hp}${S.back[u.id] ? ` · ${byId(S.back[u.id]).name} behind` : ''}">${tok(u.id)}<sub>${S.hp[u.id]}</sub>${S.back[u.id] ? `<b class="bk">${tok(S.back[u.id])}</b>` : ''}</span>`).join('')}${steps.has(t) ? `<i class="step">${steps.get(t)}</i>` : ''}</div>`;
  }
  return `<div class="board" style="grid-template-columns:repeat(${W},1fr)">${cells}</div>`;
}
function verdict(checks: Check[], label: string): string {
  const ok = checks.every((c) => c.total < c.hp);
  return `<div class="verdict ${ok ? 'ok' : 'bad'}"><b>${ok ? '✓ Safe' : '✗ No safe line'}</b> <small>${esc(label)}</small><div class="checks">${checks.map((c) => `<span class="${c.total >= c.hp ? 'kill' : c.total ? 'hit' : ''}" title="${esc(c.by.join(', '))}">${esc(byId(c.id).name)} ${c.by.length ? `${c.total}/${c.hp} from ${c.by.length}` : 'out of reach'}</span>`).join('')}</div></div>`;
}
/** The game's command menu for the tile the player picked. */
function menuPanel(): string {
  const m = menuAt!; const u = byId(m.unit);
  const acts = menu(u, m.to, S, m.trade);
  const by = (c: Cmd) => acts.filter((a) => a.cmd === c);
  const pick = (a: Act, label: string) => `<button class="opt" data-pick='${esc(JSON.stringify(a))}'>${esc(label)}${forecast(a, S) ? ` <small>${esc(forecast(a, S))}</small>` : ''}</button>`;
  const partners = tradePartners(u, m.to, S);
  const invAfter = (id: string) => {
    const inv = { ...(S.inv[id] ?? {}) }; const t = m.trade;
    if (t && id === m.unit) { if (t.dir === 'take') inv[t.item] = S.inv[t.with][t.item]; else delete inv[t.item]; }
    return inv;
  };
  const invLine = (id: string) => Object.entries(invAfter(id)).map(([it, n]) => `${it}${n < 99 ? ` (${n})` : ''}`).join(', ') || 'nothing';
  const rows: string[] = [];
  const pair = by('Pair Up')[0];
  if (pair) rows.push(pick(pair, `Pair Up with ${byId(pair.target!).name}`));
  else {
    if (by('Attack').length) rows.push(m.open === 'Attack' ? `<div class="sub"><b>Attack:</b> ${by('Attack').map((a) => pick(a, nm(a.target!))).join('')}</div>` : `<button data-open="Attack">Attack ▸</button>`);
    if (by('Heal').length) rows.push(m.open === 'Heal' ? `<div class="sub"><b>Heal:</b> ${by('Heal').map((a) => pick(a, byId(a.target!).name)).join('')}</div>` : `<button data-open="Heal">Staff ▸</button>`);
    if (!m.trade && partners.length) rows.push(m.open === 'Trade' ? `<div class="sub"><b>Trade</b> <small>(doesn’t end the turn; pick an item, then the command)</small>${partners.map((p) => `<div>${esc(byId(p).name)}${S.back[m.unit] === p ? ' (your back)' : ''}: ${Object.keys(S.inv[p] ?? {}).map((it) => `<button data-trade="${p}|${it}|take">take ${esc(it)}</button>`).join('')} ${Object.keys(S.inv[m.unit] ?? {}).map((it) => `<button data-trade="${p}|${it}|give">give ${esc(it)}</button>`).join('')}</div>`).join('')}</div>` : `<button data-open="Trade">Trade ▸</button>`);
    for (const a of by('Items')) rows.push(pick(a, 'Items: use a Vulnerary'));
    rows.push(pick(by('Wait')[0]!, 'Wait'));
  }
  return `<div class="card try"><b>${esc(u.name)} → (${m.to}): what does ${u.name === 'Lissa' ? 'she' : 'he'} do?</b> <small>the game’s menu at this tile</small>
    ${m.trade ? `<div class="chip">traded: ${esc(m.trade.dir)} ${esc(m.trade.item)} ${m.trade.dir === 'take' ? 'from' : 'to'} ${esc(byId(m.trade.with).name)} <button data-untrade>undo</button></div>` : ''}
    <div class="menu">${rows.join('')}</div>
    <small>Carrying: ${esc(invLine(m.unit))}</small> <button data-cancel-try>cancel</button></div>`;
}
function tryPanel(): string {
  if (menuAt) return menuPanel();
  if (trying) return `<div class="card try"><b>Try a move for ${esc(byId(trying).name)}:</b> click a blue tile (an ally’s tile means Pair Up), then pick a command. <button data-cancel-try>cancel</button></div>`;
  if (!whatIf || !basePlan) return `<p class="note">Want another option? <b>Click one of your units on the board</b>, then a tile, then a command.</p>`;
  const c = compare(outlook(plan), outlook(basePlan));
  const li = (xs: string[]) => xs.map((x) => `<li>${esc(x)}</li>`).join('');
  return `<div class="card try"><b>Your move: ${esc(byId(whatIf.unit).name)} → (${whatIf.to}) ${esc(actText(whatIf))}</b>, the rest re-solved around it. Against the solver’s plan, played through the predicted enemy phase:
    <div class="cmp"><div><h4 class="okc">Good</h4><ul>${li(c.good) || '<li class="dim">nothing better</li>'}</ul></div><div><h4 class="badc">Bad</h4><ul>${li(c.bad) || '<li class="dim">nothing worse</li>'}</ul></div></div>
    <details><summary><small>Same either way (${c.same.length})</small></summary><small>${c.same.map(esc).join(' · ')}</small></details>
    <div class="go"><button class="primary" data-keep>Use my version</button> <button data-revert>Back to the solver’s plan</button> <button data-try-again>Try another tile</button></div></div>`;
}
function playerPanel(): string {
  return `${tryPanel()}<section class="turn cur ${plan.safe ? '' : 'bad'}"><div class="th"><span class="tn">T${S.turn}</span> <b>Player phase: ${whatIf ? 'your version' : 'the solver’s plan'}</b> <span class="chip ${plan.safe ? 'ok' : 'bad'}">${plan.safe ? 'safe' : 'no safe line'}</span>${plan.wakes ? ' <span class="chip warn">wakes group 1</span>' : ''}</div>
    ${plan.acts.map((a, i) => {
      const oc = outcomes.get(i); const pre = run(plan.acts.slice(0, i), S).s; const fc = forecast(a, pre);
      return `<div class="act${oc ? (oc.o === 'hit' && oc.c === 'hit' ? ' done' : ' off') : ''}${whatIf && a.unit === whatIf.unit ? ' mine' : ''}"><div class="n">${i + 1}</div><div class="body"><div><b>${esc(byId(a.unit).name)}</b>${pre.back[a.unit] ? ` <small>(${esc(byId(pre.back[a.unit]).name)} behind)</small>` : ''} → (${a.to}) <span class="cmd">${esc(actText(a))}</span></div>${fc ? `<div class="fc">${esc(fc)}</div>` : ''}
        ${a.cmd === 'Attack' ? `<div class="taps">${(['hit', 'missed', 'crit', ...(pre.back[a.unit] ? ['DS'] : [])] as Outcome[]).map((o) => `<button data-o="${i}|${o}" class="${(oc?.o ?? 'hit') === o ? 'on' : ''}">${o === 'hit' ? 'as forecast' : o === 'DS' ? 'Dual Strike' : o}</button>`).join('')} <span class="sep">counter</span> ${(['hit', 'missed'] as const).map((c) => `<button data-c="${i}|${c}" class="${(oc?.c ?? 'hit') === c ? 'on' : ''}">${c}</button>`).join('')}</div>` : ''}</div></div>`;
    }).join('')}
    <div class="go"><button class="primary" data-apply-player>Done: apply the player phase</button> <small>untouched combats count as forecast</small></div></section>`;
}
function enemyPanel(): string {
  return `<section class="turn cur"><div class="th"><span class="tn">EP${S.turn}</span> <b>Enemy phase: predicted</b> <small>kills first, then damage · tick or fix</small></div>
    <p class="note">${pred.filter((p) => !p.target && k(p.to) !== k(S.pos[p.id])).map((p) => `${esc(byId(p.id).name)} → (${p.to})`).join(' · ') || 'Nobody else moves.'} <small>Moves only: shown on the board, no tick needed.</small></p>
    ${pred.some((p) => p.target) ? pred.map((p, i) => !p.target ? '' : `<div class="em${p.ok ? ' ok' : ''}${p.fixed ? ' fix' : ''}"><span class="u enemy">${tok(p.id)}</span> ${esc(nm(p.id))} → (${p.to}) attacks <b>${esc(byId(p.target).name)}</b>
      <span class="taps"><button data-ok="${i}" class="${p.ok ? 'on' : ''}">✓</button><button data-fix="${i}" class="${p.fixed ? 'on' : ''}">fix</button></span>
      ${p.fixed ? `<div class="fix">target <select data-ft="${i}"><option value="">none</option>${leads(S).map((a) => `<option value="${a.id}" ${p.target === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
        its hit ${(['hit', 'missed', 'crit'] as const).map((o) => `<button data-fo="${i}|${o}" class="${p.o === o ? 'on' : ''}">${o}</button>`).join('')}
        counter ${(['hit', 'missed'] as const).map((c) => `<button data-fc="${i}|${c}" class="${p.c === c ? 'on' : ''}">${c}</button>`).join('')}
        tile <input data-fp="${i}" size="5" value="${p.to}"/></div>` : ''}</div>`).join('') : '<p class="outline">No foe can attack anyone this phase.</p>'}
    <div class="go"><button class="primary" data-apply-enemy>Done: apply and re-plan T${S.turn + 1}</button> <small>unticked rows count as predicted</small></div></section>`;
}
const app = document.getElementById('app')!;
function render() {
  const checks = phase === 'player' ? plan.checks : safety(S);
  const main = phase === 'player' ? playerPanel() : phase === 'enemy' ? enemyPanel() : `<section class="turn cur"><h2>${phase === 'won' ? `Rout on turn ${S.turn}` : 'Game over'}</h2><p>${taps.total} taps in total; enemy predictions ${score.asIs} as predicted, ${score.fixed} fixed.</p></section>`;
  if (!leads(S).some((a) => a.id === focus)) focus = leads(S)[0]?.id ?? 'fre';
  app.innerHTML = `<header><b>FE13 Child Calc</b> <small>Run › Prepare: Prologue · live (PROTOTYPE #262)</small></header>
  <div class="head"><div class="promise"><span class="big">Turn ${S.turn} · ${phase === 'player' ? 'your phase' : phase === 'enemy' ? 'enemy phase' : phase}</span></div>
    <div>taps this turn <b>${taps.turn}</b> · total <b>${taps.total}</b> · enemy predictions: <b>${score.asIs}</b> as predicted, <b>${score.fixed}</b> fixed · foes left <b>${liveFoes(S).length}</b> ${GROUP1.every((g) => S.awake.has(g) || S.hp[g] <= 0) ? '' : '· north asleep'}</div></div>
  <div class="colsC"><div>${main}
    <details class="card" ${fixMode ? 'open' : ''}><summary>Off-script? Fix the board</summary><label><input type="checkbox" data-fixmode ${fixMode ? 'checked' : ''}/> <b>I actually moved a unit</b>: then click it on the board, then its real tile (this changes the board, unlike trying a move).</label>${placing ? ` <b>Placing ${esc(byId(placing).name)}:</b> click its real tile.` : ''}<br/><small>Or set HP:</small>
      <div class="taps">${[...leads(S), ...liveFoes(S)].map((u) => `<label>${esc(u.name)}${u.side === 'enemy' ? ` (${S.pos[u.id]})` : ''} <input data-hp="${u.id}" size="2" value="${S.hp[u.id]}"/></label>`).join('')}</div></details>
    <details class="card"><summary>Inventories</summary><small>${ALLIES.filter((a) => S.hp[a.id] > 0).map((a) => `<b>${a.name}</b>: ${esc(Object.entries(S.inv[a.id]).map(([it, n]) => `${it}${n < 99 ? ` (${n})` : ''}`).join(', ') || 'nothing')}`).join('<br/>')}</small></details>
    <details class="card"><summary>Log</summary><small>${log.map(esc).join('<br/>') || 'nothing yet'}</small></details>
  </div><div class="side">${verdict(checks, phase === 'player' ? 'where the plan leaves everyone' : 'where everyone stands now')}
    <div class="focus">Danger to <select data-focus>${leads(S).map((a) => `<option value="${a.id}" ${a.id === focus ? 'selected' : ''}>${a.name}</option>`).join('')}</select> <small>numbers under units are HP; faded foes are asleep</small></div>${board()}</div></div>`;
}
document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest('[data-o],[data-c],[data-ok],[data-fix],[data-fo],[data-fc],[data-apply-player],[data-apply-enemy],[data-unit],[data-tile],[data-keep],[data-revert],[data-try-again],[data-cancel-try],[data-pick],[data-open],[data-trade],[data-untrade]') as HTMLElement | null;
  if (!el) return; const d = el.dataset;
  if (d.keep !== undefined) { log.push(`T${S.turn}: used my version (${byId(whatIf!.unit).name} → (${whatIf!.to}) ${actText(whatIf!)})`); whatIf = null; basePlan = null; outcomes.clear(); }
  else if (d.revert !== undefined) { if (basePlan) plan = basePlan; resetTry(); outcomes.clear(); }
  else if (d.tryAgain !== undefined) { trying = whatIf!.unit; menuAt = null; }
  else if (d.cancelTry !== undefined) { trying = null; menuAt = null; }
  else if (d.open) { menuAt = { ...menuAt!, open: d.open as 'Attack' }; }
  else if (d.trade) { const [w, it, dir] = d.trade.split('|'); menuAt = { ...menuAt!, trade: { with: w, item: it, dir: dir as 'take' }, open: undefined }; tap(); }
  else if (d.untrade !== undefined) { menuAt = { ...menuAt!, trade: undefined }; }
  else if (d.pick) { const a = JSON.parse(d.pick) as Act; whatIf = a; basePlan ??= plan; plan = solve(a); menuAt = null; trying = null; outcomes.clear(); tap(); }
  // Trying a move (player phase, not fixing the board): click an ally, then a blue tile, then a command.
  else if (phase === 'player' && !fixMode && trying && (d.tile || d.unit) && !(d.unit === trying && !menuAt)) {
    const tile = d.tile ?? k(S.pos[d.unit!]);
    const r = tilesFor(byId(trying), S);
    const own = tile === k(S.pos[trying]);
    if (r.free.has(tile) || r.pairOnto.has(tile) || own) { menuAt = { unit: trying, to: tile.split(',').map(Number) as P }; tap(); }
  }
  else if (phase === 'player' && !fixMode && d.unit && byId(d.unit).side === 'ally') { trying = d.unit; focus = d.unit; menuAt = null; }
  else if (d.o) { const [i, o] = d.o.split('|'); const cur = outcomes.get(+i) ?? { o: 'hit', c: 'hit' }; outcomes.set(+i, { ...cur, o: o as Outcome }); tap(); }
  else if (d.c) { const [i, c] = d.c.split('|'); const cur = outcomes.get(+i) ?? { o: 'hit', c: 'hit' }; outcomes.set(+i, { ...cur, c: c as 'hit' | 'missed' }); tap(); }
  else if (d.ok) { pred[+d.ok].ok = true; pred[+d.ok].fixed = false; tap(); }
  else if (d.fix) { pred[+d.fix].fixed = true; pred[+d.fix].ok = false; tap(); }
  else if (d.fo) { const [i, o] = d.fo.split('|'); pred[+i].o = o as 'hit'; tap(); }
  else if (d.fc) { const [i, c] = d.fc.split('|'); pred[+i].c = c as 'hit'; tap(); }
  else if (d.applyPlayer !== undefined) applyPlayer();
  else if (d.applyEnemy !== undefined) applyEnemy();
  else if (fixMode && d.unit && !placing) { placing = d.unit; }
  else if (fixMode && d.tile && placing) { S.pos[placing] = d.tile.split(',').map(Number) as P; if (S.back[placing]) S.pos[S.back[placing]] = S.pos[placing]; log.push(`moved ${byId(placing).name} to (${d.tile}) by hand`); placing = null; tap(); if (phase === 'player') { resetTry(); plan = solve(); } else pred = predict(); }
  render();
});
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement | HTMLSelectElement; const d = el.dataset;
  if (d.focus !== undefined) focus = el.value;
  if (d.fixmode !== undefined) { fixMode = (el as HTMLInputElement).checked; placing = null; trying = null; menuAt = null; }
  if (d.ft) { pred[+d.ft].target = el.value || undefined; tap(); }
  if (d.fp) { pred[+d.fp].to = el.value.split(',').map(Number) as P; tap(); }
  if (d.hp) { S.hp[d.hp] = Math.max(0, Number(el.value) || 0); log.push(`set ${byId(d.hp).name} HP to ${S.hp[d.hp]} by hand`); tap(); if (phase === 'player') { resetTry(); plan = solve(); } }
  render();
});
(window as any).__dbg = { S, options, tilesFor, menu, byId, run, value, leads };
plan = solve();
render();
