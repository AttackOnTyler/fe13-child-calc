// PROTOTYPE — throwaway (#262). Does confirm-or-correct keep the script on track? Variant D's layout with the loop made
// real on the Prologue: a 1-turn solver (safety first) plans the player phase, you tap outcomes, the app predicts the enemy
// phase (wake groups, reach, "kills first" targeting), you tick or fix, the board updates and the next turn re-solves.
// Stub: damage (Atk − Def, doubling at Spd +5, no triangle/ranks), 1 detailed turn instead of 3, Chrom stays the back.
// @ts-nocheck
import { ALLIES, ENEMIES, H, ROWS, W, byId, reach, round, walkable, type Unit } from './model';

type P = [number, number];
type State = { pos: Record<string, P>; hp: Record<string, number>; awake: Set<string>; turn: number };
const k = (p: P) => `${p[0]},${p[1]}`;
const dist = (a: P, b: P) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const GROUP1 = ['m3', 'm4', 'b3', 'b4', 't'];

// ---- state -------------------------------------------------------------------------------------------------------
let S: State = {
  pos: Object.fromEntries([...ALLIES, ...ENEMIES].map((u) => [u.id, [u.x, u.y] as P])),
  hp: Object.fromEntries([...ALLIES, ...ENEMIES].map((u) => [u.id, u.hp])),
  awake: new Set(ENEMIES.filter((e) => e.wake === 'now' || e.wake === 'never moves').map((e) => e.id)),
  turn: 1,
};
const alive = (id: string) => S.hp[id] > 0 && S.pos[id];
const allies = () => ALLIES.filter((a) => alive(a.id) && a.id !== 'chr'); // Chrom rides as Frederick's back
const foes = () => ENEMIES.filter((e) => alive(e.id));
let phase: 'player' | 'enemy' | 'won' | 'lost' = 'player';
let plan: Plan = null!;
let pred: EnemyAct[] = [];
const taps = { turn: 0, total: 0 };
const score = { asIs: 0, fixed: 0 };
const log: string[] = [];
let focus = 'lis';
let placing: string | null = null; // "I actually moved it" (a real board fix)
let fixMode = false;
let trying: string | null = null; // the unit whose move the player is trying
let whatIf: { unit: string; to: P } | null = null;
let basePlan: Plan | null = null; // the solver's own plan, kept while trying a move

// ---- combat (stub) ------------------------------------------------------------------------------------------------
const inRange = (u: Unit, from: P, to: P) => { const m = dist(from, to); return m >= u.range[0] && m <= u.range[1]; };
function strike(a: Unit, d: Unit): { dmg: number; hits: number } {
  if (a.side === 'enemy') return round(a, d, a.skills);
  if (a.id === 'lis') return { dmg: 0, hits: 0 };
  const dmg = Math.max(0, a.atk - (a.magic ? d.res : d.def));
  const aspd = a.spd + (a.id === 'fre' ? 3 : 0);
  return { dmg, hits: aspd - d.spd >= 5 ? 2 : 1 };
}
type Outcome = 'hit' | 'missed' | 'crit' | 'DS';
/** Resolve one combat into hp (mutates). `o` is the initiator's result; `c` whether the counter lands. */
function fight(hp: Record<string, number>, aId: string, dId: string, from: P, dAt: P, o: Outcome = 'hit', c: 'hit' | 'missed' = 'hit'): string {
  const a = byId(aId), d = byId(dId);
  const sa = strike(a, d), sd = strike(d, a);
  const canCounter = d.id !== 'lis' && inRange(d, dAt, from);
  const notes: string[] = [];
  const hitA = () => {
    if (hp[dId] <= 0 || hp[aId] <= 0) return;
    let x = o === 'missed' ? 0 : sa.dmg * (o === 'crit' ? 3 : 1);
    if (o === 'DS' && aId === 'fre') x += Math.max(0, 12 - d.def);
    hp[dId] = Math.max(0, hp[dId] - x); notes.push(`${a.name} ${x}`);
  };
  const hitD = () => {
    if (!canCounter || hp[dId] <= 0 || hp[aId] <= 0) return;
    const x = c === 'missed' ? 0 : sd.dmg; hp[aId] = Math.max(0, hp[aId] - x); notes.push(`${d.name} ${x}`);
  };
  hitA(); hitD(); if (sa.hits > 1) hitA(); if (sd.hits > 1) hitD();
  return `${a.name} → ${d.name}: ${notes.join(', ')}${hp[dId] <= 0 ? ` · ${d.name} dies` : ''}${hp[aId] <= 0 ? ` · ${a.name} dies` : ''}`;
}

// ---- wake + danger --------------------------------------------------------------------------------------------------
function strikeSet(e: Unit, at: P, pos: Record<string, P>, allyIds: string[]): Set<string> {
  const blocked = new Set(allyIds.map((id) => k(pos[id])));
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
function wakes(pos: Record<string, P>, hp: Record<string, number>, awake: Set<string>): Set<string> {
  const ids = allies().map((a) => a.id).filter((id) => hp[id] > 0);
  const w = new Set(awake);
  if (GROUP1.some((g) => !w.has(g))) {
    const hit = GROUP1.filter((g) => hp[g] > 0).some((g) => { const s = strikeSet(byId(g), pos[g], pos, ids); return ids.some((id) => s.has(k(pos[id]))); });
    if (hit) GROUP1.forEach((g) => w.add(g));
  }
  return w;
}
/** Gang-up worst case on each ally where it stands: every awake foe that can strike its tile, every non-crit hit landing. */
function safety(pos: Record<string, P>, hp: Record<string, number>): { id: string; total: number; hp: number; by: string[] }[] {
  const awake = wakes(pos, hp, S.awake);
  const ids = allies().map((a) => a.id).filter((id) => hp[id] > 0);
  return ids.map((id) => {
    const u = byId(id); let total = 0; const by: string[] = [];
    for (const e of foes()) {
      if (hp[e.id] <= 0 || !awake.has(e.id)) continue;
      if (strikeSet(e, pos[e.id], pos, ids.filter((x) => x !== id)).has(k(pos[id]))) { const r = round(e, u, e.skills); total += r.dmg * r.hits; by.push(`${e.name} ${r.dmg}${r.hits > 1 ? '×2' : ''}`); }
    }
    return { id, total, hp: hp[id], by };
  });
}

// ---- the 1-turn solver ----------------------------------------------------------------------------------------------
type Act = { unit: string; to: P; cmd: 'Attack' | 'Heal' | 'Wait'; target?: string };
type Plan = { acts: Act[]; safe: boolean; checks: ReturnType<typeof safety>; kills: number; wakes: boolean };
function options(u: Unit, pos: Record<string, P>, hp: Record<string, number>): Act[] {
  const foeTiles = new Set(foes().filter((e) => hp[e.id] > 0).map((e) => k(pos[e.id])));
  const occupied = new Set(allies().filter((a) => a.id !== u.id && hp[a.id] > 0).map((a) => k(pos[a.id])));
  const out: Act[] = [];
  for (const t of reach(u, pos[u.id], foeTiles).keys()) {
    if (occupied.has(t)) continue;
    const to = t.split(',').map(Number) as P;
    out.push({ unit: u.id, to, cmd: 'Wait' });
    if (u.id === 'lis') { for (const a of allies()) if (a.id !== 'lis' && hp[a.id] > 0 && hp[a.id] < byId(a.id).hp && dist(to, pos[a.id]) === 1) out.push({ unit: u.id, to, cmd: 'Heal', target: a.id }); }
    else for (const e of foes()) if (hp[e.id] > 0 && S.awake.has(e.id) || (hp[e.id] > 0 && inRange(u, to, pos[e.id]))) { if (inRange(u, to, pos[e.id])) out.push({ unit: u.id, to, cmd: 'Attack', target: e.id }); }
  }
  return out;
}
function apply(acts: Act[], pos0: Record<string, P>, hp0: Record<string, number>) {
  const pos = { ...pos0 }, hp = { ...hp0 };
  let lethal = 0; // our attacks whose full non-crit counter kills the attacker (the attack may miss)
  for (const a of acts) {
    pos[a.unit] = a.to; if (a.unit === 'fre') pos.chr = a.to;
    if (a.cmd === 'Attack' && inRange(byId(a.target!), pos[a.target!], a.to)) { const c = strike(byId(a.target!), byId(a.unit)); if (c.dmg * c.hits >= hp[a.unit]) lethal += c.dmg * c.hits - hp[a.unit] + 1; }
    if (a.cmd === 'Attack') fight(hp, a.unit, a.target!, a.to, pos[a.target!]);
    if (a.cmd === 'Heal') hp[a.target!] = Math.min(byId(a.target!).hp, hp[a.target!] + 10);
  }
  return { pos, hp, lethal };
}
function value(acts: Act[], pos: Record<string, P>, hp: Record<string, number>, lethal = 0) {
  const checks = safety(pos, hp);
  const over = checks.reduce((s, c) => s + Math.max(0, c.total - c.hp + 1), 0) + lethal;
  const margin = checks.reduce((s, c) => s + Math.min(c.hp - c.total, 15), 0); // healthy margins beat bare survival
  const kills = foes().filter((e) => S.hp[e.id] > 0 && hp[e.id] <= 0).length;
  const dmg = foes().reduce((s, e) => s + (S.hp[e.id] - hp[e.id]), 0);
  const heal = allies().reduce((s, a) => s + Math.max(0, hp[a.id] - S.hp[a.id]), 0);
  const fre = pos.fre ?? [0, 0];
  const near = Math.min(...foes().filter((e) => hp[e.id] > 0).map((e) => dist(fre, pos[e.id])), 99);
  const drawn = checks.find((c) => c.id === 'fre')?.by.length ?? 0; // foes Frederick draws (a wall wants them)
  const exposed = checks.filter((c) => c.id !== 'fre').reduce((s, c) => s + c.total, 0); // non-walls taking hits
  return { checks, safe: over === 0, v: -over * 1e6 + kills * 1e4 + dmg * 50 + heal * 40 + drawn * 30 - near * 10 - exposed * 60 + margin * 25 };
}
/** `pin`: a move the player wants to try; that unit only gets actions from that tile, the rest re-solve around it. */
function solve(pin?: { unit: string; to: P }): Plan {
  const pos0 = S.pos, hp0 = S.hp;
  const fre = byId('fre'), rob = byId('rob'), lis = byId('lis');
  const order = (u: Unit, pos = pos0, hp = hp0) => {
    if (!(alive(u.id) && hp[u.id] > 0)) return [null];
    const o = options(u, pos, hp);
    return pin && pin.unit === u.id ? o.filter((a) => k(a.to) === k(pin.to)) : o;
  };
  // Frederick's options ranked alone, then the top few searched jointly with Robin and Lissa.
  const fOpts = order(fre).map((a) => { if (!a) return { a, v: 0 }; const r = apply([a], pos0, hp0); return { a, v: value([a], r.pos, r.hp, r.lethal).v }; }).sort((x, y) => y.v - x.v).slice(0, 10);
  let best: { acts: Act[]; v: number; checks: ReturnType<typeof safety>; safe: boolean } | null = null;
  for (const f of fOpts) {
    const base = f.a ? apply([f.a], pos0, hp0) : { pos: pos0, hp: hp0 };
    const rOpts = order(rob, base.pos, base.hp).map((a) => { if (!a) return { a, v: 0 }; const r = apply([a], base.pos, base.hp); return { a, v: value([a], r.pos, r.hp, r.lethal).v }; }).sort((x, y) => y.v - x.v).slice(0, 14);
    for (const r of rOpts) {
      const b2 = r.a ? apply([r.a], base.pos, base.hp) : base;
      for (const l of order(lis, b2.pos, b2.hp)) {
        const acts = [f.a, r.a, l].filter(Boolean) as Act[];
        const end = l ? apply([l], b2.pos, b2.hp) : b2;
        const val = value(acts, end.pos, end.hp, apply(acts, pos0, hp0).lethal);
        if (!best || val.v > best.v) best = { acts, ...val };
      }
    }
  }
  const end = apply(best!.acts, pos0, hp0);
  const woke = GROUP1.some((g) => !S.awake.has(g)) && GROUP1.some((g) => wakes(end.pos, end.hp, S.awake).has(g) && !S.awake.has(g));
  return { acts: best!.acts, safe: best!.safe, checks: best!.checks, kills: foes().filter((e) => end.hp[e.id] <= 0).length, wakes: woke };
}

// ---- enemy-phase prediction (folklore targeting: kills first, then damage) --------------------------------------------
type EnemyAct = { id: string; to: P; target?: string; o: 'hit' | 'missed' | 'crit'; c: 'hit' | 'missed'; fixed: boolean; ok: boolean };
function predict(): EnemyAct[] {
  S.awake = wakes(S.pos, S.hp, S.awake);
  return predictFrom(S.pos, S.hp, S.awake);
}
function predictFrom(pos0: Record<string, P>, hp: Record<string, number>, awake: Set<string>): EnemyAct[] {
  const pos = { ...pos0 };
  const out: EnemyAct[] = [];
  const ids = ALLIES.filter((a) => a.id !== 'chr' && hp[a.id] > 0 && pos[a.id]).map((a) => a.id);
  for (const e of ENEMIES.filter((x) => hp[x.id] > 0 && pos[x.id])) {
    if (!awake.has(e.id)) continue;
    const occ = new Set([...ids.map((id) => k(pos[id])), ...ENEMIES.filter((f) => f.id !== e.id && hp[f.id] > 0 && pos[f.id]).map((f) => k(pos[f.id]))]);
    let best: { to: P; target?: string; v: number } | null = null;
    for (const t of reach(e, pos[e.id], new Set(ids.map((id) => k(pos[id])))).keys()) {
      if (occ.has(t)) continue;
      const to = t.split(',').map(Number) as P;
      for (const id of ids) if (inRange(e, to, pos[id])) {
        const r = round(e, byId(id), e.skills); const kill = r.dmg * r.hits >= hp[id];
        const v = (kill ? 1e4 : 0) + r.dmg * r.hits * 10 - dist(to, pos[e.id]);
        if (!best || v > best.v) best = { to, target: id, v };
      }
      if (!best?.target) { const d = Math.min(...ids.map((id) => dist(to, pos[id]))); const v = -d * 10 - 1e5; if (!best || v > best.v) best = { to, v }; }
    }
    if (!best) best = { to: pos[e.id], v: 0 };
    pos[e.id] = best.to;
    out.push({ id: e.id, to: best.to, target: best.target, o: 'hit', c: 'hit', fixed: false, ok: false });
  }
  return out;
}

/** A plan played out: the player phase as forecast, then the predicted enemy phase (every hit landing), on a copy. */
type Outlook = {
  safe: boolean; lethal: number; kills: number; counterKills: number; dealt: number; wakes: boolean; drawn: number; exposed: number;
  checks: ReturnType<typeof safety>; hpAfter: Record<string, number>; deaths: string[]; foesLeft: number; ep: EnemyAct[];
};
function outlook(p: Plan): Outlook {
  const end = apply(p.acts, S.pos, S.hp);
  const awake = wakes(end.pos, end.hp, S.awake);
  const ep = predictFrom(end.pos, end.hp, awake);
  const hp = { ...end.hp }, pos = { ...end.pos };
  for (const m of ep) { pos[m.id] = m.to; if (m.target && hp[m.target] > 0 && hp[m.id] > 0) fight(hp, m.id, m.target, m.to, pos[m.target]); }
  const liveFoes = ENEMIES.filter((e) => S.hp[e.id] > 0);
  const checks = safety(end.pos, end.hp);
  return {
    safe: p.safe, lethal: end.lethal, wakes: p.wakes, checks, ep,
    kills: liveFoes.filter((e) => end.hp[e.id] <= 0).length,
    counterKills: liveFoes.filter((e) => end.hp[e.id] > 0 && hp[e.id] <= 0).length,
    dealt: liveFoes.reduce((s, e) => s + (S.hp[e.id] - hp[e.id]), 0),
    drawn: ep.filter((m) => m.target === 'fre').length,
    exposed: ep.filter((m) => m.target && m.target !== 'fre').length,
    hpAfter: Object.fromEntries(ALLIES.filter((a) => a.id !== 'chr' && S.hp[a.id] > 0).map((a) => [a.id, hp[a.id]])),
    deaths: ALLIES.filter((a) => a.id !== 'chr' && S.hp[a.id] > 0 && hp[a.id] <= 0).map((a) => a.name),
    foesLeft: liveFoes.filter((e) => hp[e.id] > 0).length,
  };
}
/** Good and bad, the tried move against the solver's plan. */
function compare(mine: Outlook, theirs: Outlook): { good: string[]; bad: string[]; same: string[] } {
  const good: string[] = [], bad: string[] = [], same: string[] = [];
  const cmp = (label: string, a: number, b: number, higherIsBetter: boolean, unit = '') => {
    if (a === b) return same.push(`${label}: ${a}${unit}`);
    const better = higherIsBetter ? a > b : a < b;
    (better ? good : bad).push(`${label}: ${a}${unit} (plan: ${b}${unit})`);
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

// ---- actions --------------------------------------------------------------------------------------------------------
const outcomes = new Map<number, { o: Outcome; c: 'hit' | 'missed' }>();
function applyPlayer() {
  plan.acts.forEach((a, i) => {
    S.pos[a.unit] = a.to; if (a.unit === 'fre') S.pos.chr = a.to;
    const oc = outcomes.get(i) ?? { o: 'hit', c: 'hit' };
    if (a.cmd === 'Attack' && S.hp[a.target!] > 0) log.push(`T${S.turn} ${fight(S.hp, a.unit, a.target!, a.to, S.pos[a.target!], oc.o, oc.c)}`);
    if (a.cmd === 'Heal') { S.hp[a.target!] = Math.min(byId(a.target!).hp, S.hp[a.target!] + 10); log.push(`T${S.turn} Lissa heals ${byId(a.target!).name} → ${S.hp[a.target!]}`); }
  });
  outcomes.clear(); whatIf = null; basePlan = null; trying = null;
  if (foes().length === 0) { phase = 'won'; return; }
  pred = predict(); phase = 'enemy';
}
function applyEnemy() {
  for (const p of pred) {
    if (S.hp[p.id] <= 0) continue;
    S.pos[p.id] = p.to;
    if (p.target && S.hp[p.target] > 0) log.push(`EP${S.turn} ${fight(S.hp, p.id, p.target, p.to, S.pos[p.target], p.o, p.c)}`);
    if (p.fixed) score.fixed++; else score.asIs++;
  }
  if (S.hp.rob <= 0 || S.hp.fre <= 0 && S.hp.chr <= 0) phase = 'lost';
  for (const a of ALLIES) if (S.hp[a.id] <= 0 && S.pos[a.id]) { log.push(`✝ ${a.name} died`); delete S.pos[a.id]; if (a.id === 'fre') delete S.pos.chr; }
  for (const e of ENEMIES) if (S.hp[e.id] <= 0) delete S.pos[e.id];
  if (phase === 'lost') return;
  if (foes().length === 0) { phase = 'won'; return; }
  S.turn++; taps.turn = 0; phase = 'player'; plan = solve();
}
const tap = () => { taps.turn++; taps.total++; };

// ---- render (variant D's layout) ------------------------------------------------------------------------------------
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const nm = (id: string) => byId(id).name + (byId(id).side === 'enemy' ? ` (${byId(id).weapon})` : '');
const letter: Record<string, string> = { fre: 'F', chr: 'C', rob: 'R', lis: 'L', g: 'G', w: 'W', t: 'T' };
function board(): string {
  const f = byId(focus);
  const ids = allies().map((a) => a.id);
  const dz = new Map<string, number>();
  if (alive(focus)) for (const e of foes()) if (S.awake.has(e.id)) { const r = round(e, f, e.skills); for (const t of strikeSet(e, S.pos[e.id], S.pos, ids.filter((x) => x !== focus))) dz.set(t, (dz.get(t) ?? 0) + r.dmg * r.hits); }
  const steps = new Map((phase === 'player' ? plan.acts : []).map((a, i) => [k(a.to), i + 1]));
  const pr = new Map((phase === 'enemy' ? pred : []).map((p) => [k(p.to), p.id]));
  const canReach = new Set(trying ? options(byId(trying), S.pos, S.hp).map((a) => k(a.to)) : []);
  let cells = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = `${x},${y}`; const d = dz.get(t);
    if (canReach.has(t)) { /* marked below */ }
    const us = [...ALLIES, ...ENEMIES].filter((u) => alive(u.id) && k(S.pos[u.id]) === t && !(u.id === 'chr'));
    const cls = ['c', `ter-${ROWS[y][x] === '+' ? 'bridge' : ROWS[y][x]}`, walkable(x, y) ? '' : 'off', d ? (d >= f.hp ? 'dz-kill' : 'dz') : '', pr.has(t) ? 'pred' : '', placing && walkable(x, y) ? 'placeable' : '', canReach.has(t) ? 'reach' : '', whatIf && k(whatIf.to) === t ? 'tried' : ''].join(' ');
    cells += `<div class="${cls}" data-tile="${t}" title="(${t})${d ? ` · worst case on ${f.name}: ${d}` : ''}">${us.map((u) => `<span class="u ${u.side}${u.id === focus ? ' focus' : ''}${S.awake.has(u.id) || u.side === 'ally' ? '' : ' asleep'}" data-unit="${u.id}" title="${esc(u.name)} ${S.hp[u.id]}/${u.hp}">${letter[u.id] ?? u.name[0]}<sub>${S.hp[u.id]}</sub></span>`).join('')}${steps.has(t) ? `<i class="step">${steps.get(t)}</i>` : ''}</div>`;
  }
  return `<div class="board" style="grid-template-columns:repeat(${W},1fr)">${cells}</div>`;
}
function verdict(checks: ReturnType<typeof safety>, label: string): string {
  const ok = checks.every((c) => c.total < c.hp);
  return `<div class="verdict ${ok ? 'ok' : 'bad'}"><b>${ok ? '✓ Safe' : '✗ No safe line'}</b> <small>${esc(label)}</small><div class="checks">${checks.map((c) => `<span class="${c.total >= c.hp ? 'kill' : c.total ? 'hit' : ''}" title="${esc(c.by.join(', '))}">${esc(byId(c.id).name)} ${c.by.length ? `${c.total}/${c.hp} from ${c.by.length}` : 'out of reach'}</span>`).join('')}</div></div>`;
}
function tryPanel(): string {
  if (trying) return `<div class="card try"><b>Try a move for ${esc(byId(trying).name)}:</b> click any blue tile. The rest of the turn re-solves around it and you’ll see what it gains and costs. <button data-cancel-try>cancel</button></div>`;
  if (!whatIf || !basePlan) return `<p class="note">Want to see another option? <b>Click one of your units on the board</b>, then a tile.</p>`;
  const pinned = plan.acts.find((a) => a.unit === whatIf!.unit);
  if (!pinned) return `<div class="card try bad">${esc(byId(whatIf.unit).name)} can’t act from (${whatIf.to}). <button data-revert>Back to the solver’s plan</button></div>`;
  const c = compare(outlook(plan), outlook(basePlan));
  const li = (xs: string[]) => xs.map((x) => `<li>${esc(x)}</li>`).join('');
  return `<div class="card try"><b>Your move: ${esc(byId(whatIf.unit).name)} → (${whatIf.to}) ${pinned.cmd}${pinned.target ? ' ' + esc(byId(pinned.target).name) : ''}</b>, the rest re-solved around it. Against the solver’s plan, played through the predicted enemy phase:
    <div class="cmp"><div><h4 class="okc">Good</h4><ul>${li(c.good) || '<li class="dim">nothing better</li>'}</ul></div><div><h4 class="badc">Bad</h4><ul>${li(c.bad) || '<li class="dim">nothing worse</li>'}</ul></div></div>
    <details><summary><small>Same either way (${c.same.length})</small></summary><small>${c.same.map(esc).join(' · ')}</small></details>
    <div class="go"><button class="primary" data-keep>Use my version</button> <button data-revert>Back to the solver’s plan</button> <button data-try-again>Try another tile</button></div></div>`;
}
function playerPanel(): string {
  return `${tryPanel()}<section class="turn cur ${plan.safe ? '' : 'bad'}"><div class="th"><span class="tn">T${S.turn}</span> <b>Player phase: ${whatIf ? 'your version' : 'the solver’s plan'}</b> <span class="chip ${plan.safe ? 'ok' : 'bad'}">${plan.safe ? 'safe' : 'no safe line'}</span>${plan.wakes ? ' <span class="chip warn">wakes group 1</span>' : ''}</div>
    ${plan.acts.map((a, i) => {
      const oc = outcomes.get(i);
      const fc = a.cmd === 'Attack' ? (() => { const s = strike(byId(a.unit), byId(a.target!)); const c = strike(byId(a.target!), byId(a.unit)); const cc = inRange(byId(a.target!), S.pos[a.target!], a.to); return `${s.dmg}${s.hits > 1 ? '×2' : ''} vs ${S.hp[a.target!]} HP${cc ? ` · counter ${c.dmg}${c.hits > 1 ? '×2' : ''}` : ' · no counter'}`; })() : a.cmd === 'Heal' ? `+10 (${S.hp[a.target!]} → ${Math.min(byId(a.target!).hp, S.hp[a.target!] + 10)})` : '';
      return `<div class="act${oc ? (oc.o === 'hit' && oc.c === 'hit' ? ' done' : ' off') : ''}"><div class="n">${i + 1}</div><div class="body"><div><b>${esc(byId(a.unit).name)}</b> → (${a.to}) <span class="cmd">${a.cmd}</span>${a.target ? ` ${esc(nm(a.target))}` : ''}${a.unit === 'fre' ? ' <span class="chip">Chrom behind</span>' : ''}</div>${fc ? `<div class="fc">${esc(fc)}</div>` : ''}
        ${a.cmd === 'Attack' ? `<div class="taps">${(['hit', 'missed', 'crit', ...(a.unit === 'fre' ? ['DS'] : [])] as Outcome[]).map((o) => `<button data-o="${i}|${o}" class="${(oc?.o ?? 'hit') === o ? 'on' : ''}">${o === 'hit' ? 'as forecast' : o === 'DS' ? 'Dual Strike' : o}</button>`).join('')} <span class="sep">counter</span> ${(['hit', 'missed'] as const).map((c) => `<button data-c="${i}|${c}" class="${(oc?.c ?? 'hit') === c ? 'on' : ''}">${c}</button>`).join('')}</div>` : ''}</div></div>`;
    }).join('')}
    <div class="go"><button class="primary" data-apply-player>Done: apply the player phase</button> <small>untouched combats count as forecast</small></div></section>`;
}
function enemyPanel(): string {
  return `<section class="turn cur"><div class="th"><span class="tn">EP${S.turn}</span> <b>Enemy phase: predicted</b> <small>kills first, then damage · tick or fix</small></div>
    <p class="note">${pred.filter((p) => !p.target && k(p.to) !== k(S.pos[p.id])).map((p) => `${esc(byId(p.id).name)} → (${p.to})`).join(' · ') || 'Nobody else moves.'} <small>Moves only: shown on the board, no tick needed (move one by hand if it went elsewhere).</small></p>
    ${pred.some((p) => p.target) ? pred.map((p, i) => !p.target ? '' : `<div class="em${p.ok ? ' ok' : ''}${p.fixed ? ' fix' : ''}"><span class="u enemy">${letter[p.id] ?? byId(p.id).name[0]}</span> ${esc(nm(p.id))} → (${p.to}) ${p.target ? `attacks <b>${esc(byId(p.target).name)}</b>` : 'moves, no attack'}
      <span class="taps"><button data-ok="${i}" class="${p.ok ? 'on' : ''}">✓</button><button data-fix="${i}" class="${p.fixed ? 'on' : ''}">fix</button></span>
      ${p.fixed ? `<div class="fix">target <select data-ft="${i}"><option value="">none</option>${allies().map((a) => `<option value="${a.id}" ${p.target === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
        its hit ${(['hit', 'missed', 'crit'] as const).map((o) => `<button data-fo="${i}|${o}" class="${p.o === o ? 'on' : ''}">${o}</button>`).join('')}
        counter ${(['hit', 'missed'] as const).map((c) => `<button data-fc="${i}|${c}" class="${p.c === c ? 'on' : ''}">${c}</button>`).join('')}
        tile <input data-fp="${i}" size="5" value="${p.to}"/></div>` : ''}</div>`).join('') : '<p class="outline">No foe can attack anyone this phase.</p>'}
    <div class="go"><button class="primary" data-apply-enemy>Done: apply and re-plan T${S.turn + 1}</button> <small>unticked rows count as predicted</small></div></section>`;
}
const app = document.getElementById('app')!;
function render() {
  const checks = phase === 'player' ? plan.checks : safety(S.pos, S.hp);
  const main = phase === 'player' ? playerPanel() : phase === 'enemy' ? enemyPanel() : `<section class="turn cur"><h2>${phase === 'won' ? `Rout on turn ${S.turn}` : 'Game over'}</h2><p>${taps.total} taps in total; enemy predictions ${score.asIs} as predicted, ${score.fixed} fixed.</p></section>`;
  app.innerHTML = `<header><b>FE13 Child Calc</b> <small>Run › Prepare: Prologue · live (PROTOTYPE #262)</small></header>
  <div class="head"><div class="promise"><span class="big">Turn ${S.turn} · ${phase === 'player' ? 'your phase' : phase === 'enemy' ? 'enemy phase' : phase}</span></div>
    <div>taps this turn <b>${taps.turn}</b> · total <b>${taps.total}</b> · enemy predictions: <b>${score.asIs}</b> as predicted, <b>${score.fixed}</b> fixed · foes left <b>${foes().length}</b> ${[...GROUP1].every((g) => S.awake.has(g) || S.hp[g] <= 0) ? '' : '· north asleep'}</div></div>
  <div class="colsC"><div>${main}
    <details class="card" ${fixMode ? 'open' : ''}><summary>Off-script? Fix the board</summary><label><input type="checkbox" data-fixmode ${fixMode ? 'checked' : ''}/> <b>I actually moved a unit</b>: then click it on the board, then its real tile (this changes the board, unlike trying a move).</label><br/><small>Or set HP:</small>
      <div class="taps">${[...allies(), ...foes()].map((u) => `<label>${esc(u.name)}${u.side === 'enemy' ? ` (${S.pos[u.id]})` : ''} <input data-hp="${u.id}" size="2" value="${S.hp[u.id]}"/></label>`).join('')}</div>${placing ? `<p><b>Placing ${esc(byId(placing).name)}:</b> click its real tile.</p>` : ''}</details>
    <details class="card"><summary>Log</summary><small>${log.map(esc).join('<br/>') || 'nothing yet'}</small></details>
  </div><div class="side">${verdict(checks, phase === 'player' ? 'where the plan leaves everyone' : 'where everyone stands now')}
    <div class="focus">Danger to <select data-focus>${allies().map((a) => `<option value="${a.id}" ${a.id === focus ? 'selected' : ''}>${a.name}</option>`).join('')}</select> <small>numbers under units are HP; faded foes are asleep</small></div>${board()}</div></div>`;
}
function resolve() { plan = solve(); }
document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest('[data-o],[data-c],[data-ok],[data-fix],[data-fo],[data-fc],[data-apply-player],[data-apply-enemy],[data-unit],[data-tile],[data-keep],[data-revert],[data-try-again],[data-cancel-try]') as HTMLElement | null;
  if (!el) return; const d = el.dataset;
  const sameUnit = trying && d.unit === trying;
  if (d.keep !== undefined) { log.push(`T${S.turn}: used my version (${byId(whatIf!.unit).name} → (${whatIf!.to}))`); whatIf = null; basePlan = null; outcomes.clear(); }
  else if (d.revert !== undefined) { if (basePlan) plan = basePlan; whatIf = null; basePlan = null; trying = null; outcomes.clear(); }
  else if (d.tryAgain !== undefined) { trying = whatIf!.unit; }
  else if (d.cancelTry !== undefined) { trying = null; }
  // Trying a move (player phase, not fixing the board): click an ally, then a blue tile.
  else if (phase === 'player' && !fixMode && d.unit && byId(d.unit).side === 'ally' && !sameUnit) { trying = d.unit; }
  else if (phase === 'player' && !fixMode && trying && (d.tile || d.unit)) {
    const tile = d.tile ?? k(S.pos[d.unit!]);
    whatIf = { unit: trying, to: tile.split(',').map(Number) as P };
    basePlan ??= plan; plan = solve(whatIf); trying = null; outcomes.clear(); tap();
  }
  else if (d.o) { const [i, o] = d.o.split('|'); const cur = outcomes.get(+i) ?? { o: 'hit', c: 'hit' }; outcomes.set(+i, { ...cur, o: o as Outcome }); tap(); }
  else if (d.c) { const [i, c] = d.c.split('|'); const cur = outcomes.get(+i) ?? { o: 'hit', c: 'hit' }; outcomes.set(+i, { ...cur, c: c as 'hit' | 'missed' }); tap(); }
  else if (d.ok) { pred[+d.ok].ok = true; pred[+d.ok].fixed = false; tap(); }
  else if (d.fix) { pred[+d.fix].fixed = true; pred[+d.fix].ok = false; tap(); }
  else if (d.fo) { const [i, o] = d.fo.split('|'); pred[+i].o = o as 'hit'; tap(); }
  else if (d.fc) { const [i, c] = d.fc.split('|'); pred[+i].c = c as 'hit'; tap(); }
  else if (d.applyPlayer !== undefined) applyPlayer();
  else if (d.applyEnemy !== undefined) applyEnemy();
  else if (fixMode && d.unit && !placing) { placing = d.unit; ev.stopPropagation(); }
  else if (fixMode && d.tile && placing) { S.pos[placing] = d.tile.split(',').map(Number) as P; if (placing === 'fre') S.pos.chr = S.pos.fre; log.push(`moved ${byId(placing).name} to (${d.tile}) by hand`); placing = null; tap(); if (phase === 'player') resolve(); else pred = predict(); }
  render();
});
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement | HTMLSelectElement; const d = el.dataset;
  if (d.focus !== undefined) focus = el.value;
  if (d.fixmode !== undefined) { fixMode = (el as HTMLInputElement).checked; placing = null; trying = null; }
  if (d.ft) { pred[+d.ft].target = el.value || undefined; tap(); }
  if (d.fp) { pred[+d.fp].to = el.value.split(',').map(Number) as P; tap(); }
  if (d.hp) { S.hp[d.hp] = Math.max(0, Number(el.value) || 0); log.push(`set ${byId(d.hp).name} HP to ${S.hp[d.hp]} by hand`); tap(); if (phase === 'player') resolve(); }
  render();
});
plan = solve();
render();
