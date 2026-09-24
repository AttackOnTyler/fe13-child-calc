/**
 * Throwaway (Map: Derived roles, ticket "What's the best role for each child today?").
 * For every preset, ranks each child against the cast by its best pairing's raw score, in the default play context
 * (All) and score basis (Caps+LB), and prints a child × preset table of rank and scaled score.
 *
 * Two pools: Robin in (one fixed sample Robin; Morgan of the other gender and every other Robin dropped) and Robin out
 * (no pairing with Robin anywhere in it, and no Morgan). Scaled scores are min-max over the pool's pairings, as the
 * app scales over every pairing it scores.
 *
 * Run from the repo root: npx vite-node research/best-roles.ts
 */
import { createEngine, DEFAULT_SPEED, type ChildId, type ChildResult, type ParentRef, type PresetId, type ScoreSettings } from '../src/engine/index';
import { PLAN_PRESETS } from '../src/curated/plan-presets';

const engine = createEngine();
const CONTEXT = 'all' as const;
const SAMPLE_ROBIN = { gender: 'M' as const, asset: 'spd' as const, flaw: 'hp' as const };
const robinLabel = `Robin (${SAMPLE_ROBIN.gender}) +${SAMPLE_ROBIN.asset} −${SAMPLE_ROBIN.flaw}`;

const presets = engine.presets();
const children = engine.children();
const nameOf = new Map(children.map((c) => [c.id, c.name] as const));

const robinsIn = (ref: ParentRef | undefined): ParentRef[] =>
  !ref ? [] : ref.kind === 'robin' ? [ref] : ref.kind === 'child' ? robinsIn(ref.variableParent) : [];
const robinsOf = (r: ChildResult) => [...robinsIn(r.pairing.variableParent), ...robinsIn(r.pairing.fixedRobin)];
const isSample = (ref: ParentRef) =>
  ref.kind === 'robin' && ref.gender === SAMPLE_ROBIN.gender && ref.asset === SAMPLE_ROBIN.asset && ref.flaw === SAMPLE_ROBIN.flaw;
const isMorgan = (c: ChildId) => c.startsWith('morgan');

const pools = {
  'Robin in': (r: ChildResult) => robinsOf(r).every(isSample) && (!isMorgan(r.pairing.child) || r.pairing.fixedRobin !== undefined),
  'Robin out': (r: ChildResult) => robinsOf(r).length === 0 && !isMorgan(r.pairing.child),
};

const settingsOf = (id: PresetId): ScoreSettings => {
  const p = presets.find((x) => x.id === id)!;
  return {
    weights: p.weights,
    mixed: p.mixed,
    basis: 'caps-lb',
    classMode: 'auto',
    dlc: engine.contextReachesDlc(CONTEXT),
    role: p.role ?? 'lead',
    supportRank: 'A',
    speed: { ...DEFAULT_SPEED, target: engine.defaultTargetBreakpoint(CONTEXT).value },
  };
};

type Cell = { rank: number; scaled: number; raw: number; cls: string; parent: string; tiedWith: number };

const planPresetOf = (c: ChildId): string => {
  const e = PLAN_PRESETS[c];
  if (!e) return '(global)';
  return e.default + (e.mainStory ? ` / MS ${e.mainStory}` : '') + (e.apotheosis ? ` / Apo ${e.apotheosis}` : '');
};

const short: Record<string, string> = {
  'physical-lead': 'PhysL',
  'magical-lead': 'MagL',
  'mixed-lead': 'MixL',
  'physical-hard-support': 'PhysHS',
  'magical-hard-support': 'MagHS',
  battery: 'Batt',
  'vv-lead': 'V/V',
  'crisis-crit': 'Crit',
  tank: 'Tank',
  nostank: 'Nos',
  'armsthrift-bruiser': 'Armst',
  lancekiller: 'LanceK',
  staffbot: 'Staff',
  rallybot: 'Rally',
};

const parentName = (r: ChildResult): string => {
  const p = r.pairing.variableParent;
  const base = engine.parentName(p);
  return base;
};

const out: string[] = [];
const log = (s = '') => out.push(s);

log(`# Best role per child today — rank against the cast, by preset`);
log();
log(`Context: ${CONTEXT} · basis: Caps+LB · class: Auto · DLC: ${settingsOf('physical-lead').dlc} · target Spd: ${settingsOf('physical-lead').speed.target} · support rank A.`);
log(`Sample Robin for "Robin in": ${robinLabel}. Rank 1 = best in the pool; "=n" marks a tie with n others on raw score.`);
log(`✓ after a top preset = it matches the curated default plan preset. "Rank 1 in" lists every preset where the child ranks first (ties included).`);
log(`Scaled = min-max over every pairing in the pool, 0–100, for the child's best pairing. ★ = the child's top-ranked preset (best rank; ties on rank → higher scaled).`);

for (const [poolName, inPool] of Object.entries(pools)) {
  const pool = engine.pairings().filter(inPool);
  const poolChildren = children.map((c) => c.id).filter((c) => pool.some((r) => r.pairing.child === c));
  const table = new Map<ChildId, Map<PresetId, Cell | undefined>>();
  for (const c of poolChildren) table.set(c, new Map());
  const notes: string[] = [];

  for (const p of presets) {
    if (!p.weights) {
      for (const c of poolChildren) table.get(c)!.set(p.id, undefined);
      continue;
    }
    const scoring = engine.score(settingsOf(p.id));
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of pool) {
      const raw = scoring.get(r.key).raw;
      if (raw === undefined) continue;
      lo = Math.min(lo, raw);
      hi = Math.max(hi, raw);
    }
    const bests = poolChildren.map((c) => {
      let best: ChildResult | undefined;
      let bestRaw = -Infinity;
      for (const r of pool) {
        if (r.pairing.child !== c) continue;
        const raw = scoring.get(r.key).raw;
        if (raw !== undefined && raw > bestRaw) {
          best = r;
          bestRaw = raw;
        }
      }
      return { c, best: best!, raw: bestRaw };
    });
    const sorted = [...bests].sort((a, b) => b.raw - a.raw);
    for (const b of bests) {
      const rank = 1 + sorted.filter((x) => x.raw > b.raw + 1e-9).length;
      const tiedWith = sorted.filter((x) => Math.abs(x.raw - b.raw) <= 1e-9).length - 1;
      const s = scoring.get(b.best.key);
      table.get(b.c)!.set(p.id, {
        rank,
        raw: b.raw,
        scaled: hi > lo ? ((b.raw - lo) / (hi - lo)) * 100 : 100,
        cls: s.class ? engine.className(s.class) : '—',
        parent: parentName(b.best),
        tiedWith,
      });
    }
    const distinct = new Set(sorted.map((x) => x.raw.toFixed(6))).size;
    const topSpread = sorted[0]!.raw - sorted[sorted.length - 1]!.raw;
    const scaledTop = hi > lo ? ((sorted[0]!.raw - lo) / (hi - lo)) * 100 : 100;
    const scaledBottom = hi > lo ? ((sorted[sorted.length - 1]!.raw - lo) / (hi - lo)) * 100 : 100;
    notes.push(
      `- ${p.name}: ${distinct} distinct best-pairing values across ${sorted.length} children; best-pairing scaled range ${scaledBottom.toFixed(1)}–${scaledTop.toFixed(1)} (raw spread ${topSpread.toFixed(1)}).`,
    );
  }

  log();
  log(`## ${poolName} (${poolChildren.length} children, ${pool.length} pairings)`);
  log();
  const heads = presets.map((p) => short[p.id] ?? p.id);
  log(`| Child | ${heads.join(' | ')} | Top preset | Top w/o Batt | Rank 1 in | Curated plan preset |`);
  log(`|---|${heads.map(() => '---:').join('|')}|---|---|---|---|`);
  const tops = new Map<ChildId, PresetId>();
  for (const c of poolChildren) {
    const row = table.get(c)!;
    const topOf = (skip: PresetId[]): PresetId => {
      let top: PresetId | undefined;
      for (const p of presets) {
        const cell = row.get(p.id);
        if (!cell || skip.includes(p.id)) continue;
        const t = top && row.get(top)!;
        if (!t || cell.rank < t.rank || (cell.rank === t.rank && cell.scaled > t.scaled)) top = p.id;
      }
      return top!;
    };
    const top = topOf([]);
    const topNoBatt = topOf(['battery']);
    const rank1 = presets.filter((p) => row.get(p.id)?.rank === 1).map((p) => short[p.id]);
    tops.set(c, top);
    const cells = presets.map((p) => {
      const cell = row.get(p.id);
      if (!cell) return 'n/a';
      const tie = cell.tiedWith > 0 ? `=${cell.tiedWith}` : '';
      const txt = `${cell.rank}${tie} · ${cell.scaled.toFixed(0)}`;
      return p.id === top ? `**★${txt}**` : txt;
    });
    const plan = planPresetOf(c);
    const agree = PLAN_PRESETS[c]?.default === top ? ' ✓' : '';
    const agreeNB = PLAN_PRESETS[c]?.default === topNoBatt ? ' ✓' : '';
    log(`| ${nameOf.get(c)} | ${cells.join(' | ')} | ${short[top]} | ${short[topNoBatt]}${agreeNB} | ${rank1.join(', ') || '—'} | ${plan}${agree} |`);
  }

  log();
  log(`### ${poolName}: each child's best pairing under its top preset and its curated preset`);
  log();
  log(`| Child | Top preset: rank, class, variable parent | Curated default: rank, class, variable parent |`);
  log(`|---|---|---|`);
  for (const c of poolChildren) {
    const row = table.get(c)!;
    const top = tops.get(c)!;
    const t = row.get(top)!;
    const cur = PLAN_PRESETS[c]?.default;
    const cc = cur && row.get(cur);
    log(
      `| ${nameOf.get(c)} | ${short[top]}: #${t.rank}, ${t.cls}, ${t.parent} | ${cur ? (cc ? `${short[cur]}: #${cc.rank}, ${cc.cls}, ${cc.parent}` : `${short[cur]}: n/a`) : '—'} |`,
    );
  }

  log();
  log(`### ${poolName}: spread per preset`);
  log();
  for (const n of notes) log(n);
}

console.log(out.join('\n'));
