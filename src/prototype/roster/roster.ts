// PROTOTYPE — throwaway. Roster state model shared by all three variants (the question is how it is
// SET and PRESENTED, so the pruning rules are one proposal, not per-variant):
//   run facts   — Robin's gender + asset/flaw. They remove rows from the universe (the other Robin,
//                 the other 55 combos simply don't exist in this run).
//   unit state  — available / not yet recruited (info only) / benched (soft) / missed / dead (hard).
//   marriages   — married (hard, confirmed S-support) and planned (soft lock), one spouse per unit.
// A row is HARD-blocked when it can no longer happen, SOFT-blocked when it contradicts a plan or a
// bench. Persisted to localStorage under a PROTOTYPE key.
import { AF_STATS, CHILDREN, UNITS, type Row } from '../pairing-table/data';

export type UState = 'avail' | 'later' | 'benched' | 'missed' | 'dead';
export const USTATES: { k: UState; icon: string; label: string; hint: string }[] = [
  { k: 'avail', icon: '●', label: 'Available', hint: 'recruited and usable' },
  { k: 'later', icon: '◌', label: 'Not yet recruited', hint: 'joins later — informational, prunes nothing' },
  { k: 'benched', icon: '⏸', label: 'Benched', hint: "won't use (too far behind) — soft: amber, excluded from backups" },
  { k: 'missed', icon: '⊘', label: 'Missed', hint: 'can no longer be recruited — prunes (hard)' },
  { k: 'dead', icon: '☠', label: 'Dead', hint: 'prunes every pairing that still needs them (hard)' },
];
export const uIcon = (st: UState) => USTATES.find((x) => x.k === st)!.icon;

export type Roster = {
  robinG: 'M' | 'F';
  robinAF: string | null; // 'Spd/Lck' once the run has started
  units: Record<string, UState>;
  married: Record<string, string>; // symmetric
  planned: Record<string, string>; // symmetric
  bans: string[]; // pair keys ruled out by the user (solver)
  priority: Record<string, number>; // child -> 0..3 (solver)
  saved: { pairs: string[]; scores: Record<string, number> } | null; // baseline for "what changed"
  afterDeath: boolean; // ASSUMPTION: child still recruitable if a parent dies after marrying
  freeReplan: boolean; // solver ignores plans (only marriages + deaths bind)
};

const KEY = 'PROTOTYPE-roster-wipe-me';
export const emptyRoster = (): Roster => ({
  robinG: 'M', robinAF: null, units: {}, married: {}, planned: {}, bans: [], priority: {}, saved: null, afterDeath: true, freeReplan: false,
});
export function load(): Roster {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyRoster(), ...JSON.parse(raw) } : emptyRoster();
  } catch {
    return emptyRoster();
  }
}
export function save(ro: Roster) {
  try { localStorage.setItem(KEY, JSON.stringify(ro)); } catch { /* private mode */ }
}

export const pairKey = (a: string, b: string) => [a, b].sort().join(' × ');
export const robinName = (ro: Roster) => `Robin (${ro.robinG})`;
export const morganName = (ro: Roster) => (ro.robinG === 'M' ? 'Morgan (F)' : 'Morgan (M)');
export const uState = (ro: Roster, u: string): UState => ro.units[u] ?? 'avail';
const gone = (ro: Roster, u: string) => ['dead', 'missed', 'benched'].includes(uState(ro, u));

export function setSpouse(map: Record<string, string>, a: string, b: string | null) {
  const old = map[a];
  if (old) { delete map[old]; delete map[a]; }
  if (b) {
    const oldB = map[b];
    if (oldB) delete map[oldB];
    map[a] = b;
    map[b] = a;
  }
}

// ---- who exists ----
export function people(ro: Roster) {
  const first = Object.keys(UNITS).filter((n) => n !== 'Maiden');
  const robin = robinName(ro);
  const men = [...(ro.robinG === 'M' ? [robin] : []), ...first.filter((n) => UNITS[n].g === 'M')];
  const women = [...(ro.robinG === 'F' ? [robin] : []), ...first.filter((n) => UNITS[n].g === 'F')];
  const kids = CHILDREN.map((c) => c.name).filter((c) => !c.startsWith('Morgan') || c === morganName(ro));
  return { men, women, kids };
}
export const fixedOf = (child: string) =>
  child === 'Morgan (F)' ? 'Robin (M)' : child === 'Morgan (M)' ? 'Robin (F)' : CHILDREN.find((c) => c.name === child)!.fixed;
export const childOfMother = (f: string) => CHILDREN.find((c) => c.fixed === f && c.name !== 'Lucina')?.name ?? null;

// what a row needs to happen
export function reqs(r: Row) {
  const f = fixedOf(r.child);
  const [head, vp] = r.parentLabel.split(' ← ');
  const marriages: [string, string][] = [[f, head]];
  const units = [r.child, f, head];
  if (vp) { marriages.push([fixedOf(head), vp]); units.push(vp); }
  return { marriages, units: [...new Set(units.filter((u) => u !== 'Maiden'))] };
}

// run facts: the other Robin and the other asset/flaw combos don't exist
export function inUniverse(r: Row, ro: Roster) {
  const other = ro.robinG === 'M' ? 'Robin (F)' : 'Robin (M)';
  const otherMorgan = ro.robinG === 'M' ? 'Morgan (M)' : 'Morgan (F)';
  if (r.child === otherMorgan || r.parentLabel === other) return false;
  if (ro.robinAF && r.robin && `${r.robinAsset}/${r.robinFlaw}` !== ro.robinAF) return false;
  return true;
}

export type Kind = 'ok' | 'planned' | 'married' | 'soft' | 'hard';
export type St = { kind: Kind; hard: string[]; soft: string[]; info: string[]; intended: boolean };

export function status(r: Row, ro: Roster): St {
  const { marriages, units } = reqs(r);
  const hard: string[] = [], soft: string[] = [], info: string[] = [];
  let allMarried = true, allPlanned = true;
  for (const [a, b] of marriages) {
    const ma = ro.married[a], mb = ro.married[b];
    if (ma === b) continue;
    allMarried = false;
    if (ma) hard.push(`${a} married ${ma}`);
    if (mb && b !== 'Maiden') hard.push(`${b} married ${mb}`);
    if (ro.bans.includes(pairKey(a, b))) soft.push(`${a} × ${b} ruled out`);
    const pa = ro.planned[a], pb = ro.planned[b];
    if (pa === b) continue;
    allPlanned = false;
    // a plan through a dead / missed / benched unit is void: it frees its partner instead of binding them
    const live = (x: string, y: string) => !gone(ro, x) && !gone(ro, y);
    if (pa && !ma && live(a, pa)) soft.push(`${a} planned with ${pa}`);
    if (pb && !mb && b !== 'Maiden' && live(b, pb)) soft.push(`${b} planned with ${pb}`);
  }
  for (const u of units) {
    const st = uState(ro, u);
    const wed = marriages.some(([a, b]) => (a === u || b === u) && ro.married[a] === b);
    if (st === 'dead') {
      if (u !== r.child && wed && ro.afterDeath) info.push(`${u} died after marrying — child still comes ⚠`);
      else hard.push(`${u} is dead`);
    } else if (st === 'missed') hard.push(`${u} was missed`);
    else if (st === 'benched') soft.push(`${u} is benched`);
    else if (st === 'later') info.push(`${u} not yet recruited`);
  }
  const kind: Kind = hard.length ? 'hard' : soft.length ? 'soft' : allMarried ? 'married' : allPlanned ? 'planned' : 'ok';
  return { kind, hard, soft, info, intended: allPlanned || allMarried };
}

// ---- per child ----
export type ChildSum = {
  child: string;
  dead: boolean;
  intended: Row | null; // row the plan/marriages point at (best AF when Robin's is open)
  intendedSt: St | null;
  broken: boolean;
  best: Row | null; // best row compatible with every lock
  bestSoft: Row | null; // best row if you break a plan / unbench
  lost: boolean; // nothing can happen any more
};
const better = (a: Row | null, b: Row) => (!a || (b.score ?? -1) > (a.score ?? -1) ? b : a);
export function summarise(rows: Row[], ro: Roster, st: Map<string, St>): Map<string, ChildSum> {
  const out = new Map<string, ChildSum>();
  for (const c of people(ro).kids)
    out.set(c, { child: c, dead: uState(ro, c) === 'dead', intended: null, intendedSt: null, broken: false, best: null, bestSoft: null, lost: true });
  for (const r of rows) {
    const s = out.get(r.child);
    const x = st.get(r.key);
    if (!s || !x) continue;
    if (x.intended && (!s.intended || (x.kind !== 'hard' && (s.intendedSt!.kind === 'hard' || (r.score ?? -1) > (s.intended.score ?? -1))))) {
      s.intended = r;
      s.intendedSt = x;
    }
    if (x.kind !== 'hard') { s.lost = false; s.bestSoft = better(s.bestSoft, r); }
    if (x.kind === 'ok' || x.kind === 'planned' || x.kind === 'married') s.best = better(s.best, r);
  }
  for (const s of out.values()) s.broken = !!s.intendedSt && (s.intendedSt.kind === 'hard' || s.intendedSt.kind === 'soft');
  return out;
}

// ---- whole-roster solver (max-weight marriage matching) ----
function hungarian(cost: number[][]): number[] {
  const n = cost.length, m = cost[0].length, INF = 1e18;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0), p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF), used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++)
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

export type Kid = { child: string; key: string; score: number };
export type Pair = { m: string; f: string; kids: Kid[]; how: 'married' | 'planned' | 'proposed'; brokenPin?: string };
export type Plan = { af: string | null; pairs: Pair[]; total: number; kids: Record<string, Kid>; brokenPins: { pair: string; why: string }[]; unborn: string[]; ms: number };

export function solve(rows: Row[], ro: Roster): Plan {
  const t0 = performance.now();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const { men, women, kids } = people(ro);
  const robin = robinName(ro), morgan = morganName(ro);
  const gone = (u: string) => ['dead', 'missed', 'benched'].includes(uState(ro, u));
  const kidOk = (c: string) => kids.includes(c) && uState(ro, c) !== 'dead' && uState(ro, c) !== 'missed';
  const isMale = (u: string) => men.includes(u) || CHILDREN.find((c) => c.name === u)?.g === 'M';
  const prio = (c: string) => ro.priority[c] ?? 1;
  const afs = ro.robinAF ? [ro.robinAF] : AF_STATS.flatMap((a) => AF_STATS.filter((f) => f !== a).map((f) => `${a}/${f}`));

  const kidsOf = (m: string, f: string, af: string, robinKid: string | null): Kid[] => {
    const out: Kid[] = [];
    const add = (child: string, label: string, usesAF: boolean) => {
      if (!kidOk(child)) return;
      const key = `${child}|${label}|${usesAF ? af : ''}`;
      const r = byKey.get(key);
      if (r) out.push({ child, key, score: r.score ?? 0 });
    };
    const mom = f === robin ? null : childOfMother(f);
    if (mom) add(mom, m, m === robin);
    if (m === 'Chrom') add('Lucina', f, f === robin);
    if (m === robin) add(morgan, f, true);
    if (f === robin) add(morgan, m, true);
    if (robinKid && [m, f].includes(fixedOf(robinKid))) add(morgan, `${robinKid} ← ${m === fixedOf(robinKid) ? f : m}`, true);
    return out;
  };
  const valid = (m: string, f: string) => {
    const mom = childOfMother(f);
    return !!mom && byKey.has(`${mom}|${m}|`) && !ro.bans.includes(pairKey(m, f));
  };
  const w = (ks: Kid[]) => ks.reduce((a, k) => a + k.score * prio(k.child), 0);

  // fixed pairs: marriages, then plans (unless free re-plan); pins touching a gone unit break
  const fixed: { m: string; f: string; how: 'married' | 'planned' }[] = [];
  const taken = new Set<string>();
  const brokenPins: { pair: string; why: string }[] = [];
  const seen = new Set<string>();
  for (const [src, how] of [[ro.married, 'married'], [ro.freeReplan ? {} : ro.planned, 'planned']] as const)
    for (const [a, b] of Object.entries(src)) {
      if (taken.has(a) || taken.has(b) || seen.has(pairKey(a, b))) continue;
      seen.add(pairKey(a, b));
      const m = isMale(a) ? a : b, f = m === a ? b : a;
      if (!isMale(m) || isMale(f)) continue;
      if (how === 'planned') {
        const g = [m, f].find((u) => gone(u));
        if (g) { brokenPins.push({ pair: pairKey(m, f), why: `${g} ${USTATES.find((x) => x.k === uState(ro, g))!.label.toLowerCase()}` }); continue; }
      }
      fixed.push({ m, f, how });
      taken.add(m); taken.add(f);
    }
  // Robin: fixed, or try every partner (first-gen or child) and none
  const fixedRobin = fixed.find((p) => p.m === robin || p.f === robin);
  const partnerOf = (p: { m: string; f: string }) => (p.m === robin ? p.f : p.m);
  const robinOpts: (string | null)[] = fixedRobin
    ? [partnerOf(fixedRobin)]
    : gone(robin)
      ? [null]
      : [null, ...(ro.robinG === 'M' ? women : men).filter((u) => u !== robin && !taken.has(u) && !gone(u)),
         ...kids.filter((k) => k !== morgan && CHILDREN.find((c) => c.name === k)!.g !== ro.robinG && !taken.has(k) && !gone(k))];
  const poolM = men.filter((u) => u !== robin && !taken.has(u) && !gone(u));
  const poolF0 = women.filter((u) => u !== robin && !taken.has(u) && !gone(u) && childOfMother(u));

  let best: Plan | null = null;
  for (const af of afs)
    for (const rp of robinOpts) {
      const robinKid = rp && kids.includes(rp) ? rp : null;
      const poolF = poolF0.filter((u) => u !== rp);
      const pm = poolM.filter((u) => u !== rp);
      const pairs: Pair[] = fixed.map((p) => ({ ...p, kids: kidsOf(p.m, p.f, af, robinKid) }));
      if (rp && !fixedRobin) {
        const m = ro.robinG === 'M' ? robin : rp, f = ro.robinG === 'M' ? rp : robin;
        pairs.push({ m, f, how: 'proposed', kids: kidsOf(m, f, af, robinKid) });
      }
      if (pm.length) {
        const unmatched = (m: string) => (m === 'Chrom' ? w(kidsOf('Chrom', 'Maiden', af, null)) : 0);
        const cost = pm.map((m) => [...poolF.map((f) => (valid(m, f) ? -w(kidsOf(m, f, af, robinKid)) : 1e6)), ...pm.map(() => -unmatched(m))]);
        const asg = hungarian(cost);
        asg.forEach((j, i) => {
          const m = pm[i];
          if (j < poolF.length && cost[i][j] < 1e6) pairs.push({ m, f: poolF[j], how: 'proposed', kids: kidsOf(m, poolF[j], af, robinKid) });
          else if (m === 'Chrom') pairs.push({ m, f: 'Maiden', how: 'proposed', kids: kidsOf(m, 'Maiden', af, null) });
        });
      }
      const total = pairs.reduce((a, p) => a + w(p.kids), 0);
      if (!best || total > best.total) {
        const ks: Record<string, Kid> = {};
        for (const p of pairs) for (const k of p.kids) ks[k.child] = k;
        best = { af, pairs, total, kids: ks, brokenPins, unborn: kids.filter((k) => !ks[k]), ms: 0 };
      }
    }
  // show Morgan on Robin's own marriage even when Robin's spouse is a child (the score comes from the child's parents)
  const rPair = best!.pairs.find((p) => p.m === robin || p.f === robin);
  if (rPair) for (const p of best!.pairs) {
    const i = p.kids.findIndex((k) => k.child === morgan);
    if (i >= 0 && p !== rPair) rPair.kids.push(...p.kids.splice(i, 1));
  }
  best!.ms = Math.round(performance.now() - t0);
  best!.pairs.sort((a, b) => (a.how === b.how ? 0 : a.how === 'married' ? -1 : b.how === 'married' ? 1 : a.how === 'planned' ? -1 : 1));
  return best!;
}

export function snapshot(plan: Plan) {
  return { pairs: plan.pairs.map((p) => pairKey(p.m, p.f)), scores: Object.fromEntries(Object.values(plan.kids).map((k) => [k.child, k.score])) };
}

// ---- demo run: a mid-run ironman state to react to ----
export function demo(): Roster {
  const ro = emptyRoster();
  ro.robinG = 'M';
  ro.robinAF = 'Spd/Lck';
  setSpouse(ro.married, 'Chrom', 'Sumia');
  setSpouse(ro.married, 'Robin (M)', 'Lucina');
  setSpouse(ro.planned, 'Stahl', 'Olivia');
  setSpouse(ro.planned, 'Gaius', 'Cordelia');
  setSpouse(ro.planned, 'Donnel', 'Nowi');
  setSpouse(ro.planned, 'Vaike', 'Sully');
  setSpouse(ro.planned, "Lon'qu", 'Lissa');
  ro.units = { Olivia: 'dead', Gaius: 'benched', Tiki: 'later', Anna: 'later', Emmeryn: 'later', Aversa: 'later', Priam: 'later', Walhart: 'missed' };
  return ro;
}
