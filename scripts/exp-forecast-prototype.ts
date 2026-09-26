/**
 * PROTOTYPE — throwaway TUI over src/engine/exp-forecast.prototype.ts. Run: `npm run proto:exp`.
 * Lunatic, Prologue → Chapter 4, real foes and join stats. Type a command and press Enter.
 */
import { createInterface } from 'node:readline';
import { MAPS } from '../src/game-data/chapters';
import { ADJACENT, calibration, goalChance, suggest, type Suggestion, type Goal, deployCount, forecast, mapFoes, percentileOf, unitDefs, type MapPlan, type Plan, type Priority, type UnitId } from '../src/engine/exp-forecast.prototype';

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

const MAP_IDS = ['prologue', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5', 'chapter-6', 'chapter-7'];
const maps = MAP_IDS.map((id) => MAPS.find((m) => m.id === id)!);
const defs = unitDefs(maps);

const initialMaps: MapPlan[] = maps.map((m, i) => {
  const joined = defs.filter((d) => MAP_IDS.indexOf(d.joins) <= i).map((d) => d.id);
  const forced = new Set(['chrom', 'robin', ...m.forced.map((f) => f.toLowerCase())]);
  const fielded = [...joined.filter((u) => forced.has(u)), ...joined.filter((u) => !forced.has(u))].slice(0, deployCount(m));
  return { map: m.id, fielded, pairs: {} };
});

let plan: Plan = { policy: 'priority', veteranAsBack: false, priority: {}, maps: initialMaps, recorded: {} };
let at = 0;
let suggestions: { goal: number; list: Suggestion[] } | null = null;
let goals: Goal[] = [{ unit: 'robin', level: 10, map: 'chapter-5' }];
let runs = 300;
let message = '';

const unitName = (id: string) => defs.find((d) => d.id === id)?.name ?? id;
const findUnit = (text: string | undefined): UnitId | undefined => defs.find((d) => d.id.startsWith((text ?? '').toLowerCase()))?.id;
const lv = (x: number) => `${Math.floor(x)}.${String(Math.round((x % 1) * 100)).padStart(2, '0')}`;
const PRIO = ['low', 'norm', 'HIGH'];

function render() {
  const fc = forecast(plan, defs, runs);
  const mp = plan.maps[at]!;
  const m = maps[at]!;
  const f = fc[at]!;
  const foes = mapFoes(m);
  const out: string[] = [];
  out.push(`${B('EXP FORECAST — PROTOTYPE')}  ${D(`Lunatic · ${runs} runs · policy`)} ${B(plan.policy)} ${D('· Veteran')} ${B(plan.veteranAsBack ? 'lead or back (SF)' : 'lead only (FEW)')}`);
  out.push(`${B(`${m.label}: ${m.title}`)}  ${D(`[${at + 1}/${maps.length}] deploy ${deployCount(m)} · ${foes.length} foes (no reinforcements) · waves p10/p50/p90 ${f.waves.p10}/${f.waves.p50}/${f.waves.p90}`)}`);
  out.push('');
  out.push(B(`${pad('unit', 10)}${pad('position', 16)}${pad('prio', 5)}${pad('start Lv', 9)}${pad('kills', 6)}${pad('combats', 8)}${pad('heals', 6)}${pad('waits', 6)}${pad('crits', 6)}${pad('EXP p10/p50/p90', 17)}${pad('end Lv p10 – p50 – p90', 24)}recorded`));
  const backs = Object.fromEntries(Object.entries(mp.pairs).map(([l, b]) => [b, l]));
  for (const id of mp.fielded) {
    const u = f.units[id];
    if (!u) continue;
    const pos = mp.pairs[id] ? `Lead +${unitName(mp.pairs[id]!)}` : backs[id] ? `Back of ${unitName(backs[id]!)}` : 'Solo';
    const rec = plan.recorded[mp.map]?.[id];
    const recText = rec ? `Lv ${rec.level} ${rec.exp} → p${percentileOf(u.samples, rec.level + rec.exp / 100)}` : D('—');
    out.push(
      `${pad(unitName(id), 10)}${pad(pos, 16)}${pad(PRIO[plan.priority[id] ?? 1]!, 5)}${pad(lv(u.startLevel.p50), 9)}${pad(u.kills.toFixed(1), 6)}${pad(u.combats.toFixed(1), 8)}${pad(u.heals ? u.heals.toFixed(1) : '', 6)}${pad(u.waits ? u.waits.toFixed(1) : '', 6)}${pad(u.crits ? u.crits.toFixed(1) : '', 6)}` +
        `${pad(`${Math.round(u.exp.p10)}/${Math.round(u.exp.p50)}/${Math.round(u.exp.p90)}`, 17)}${pad(`${lv(u.endLevel.p10)} – ${lv(u.endLevel.p50)} – ${lv(u.endLevel.p90)}`, 24)}${recText}`,
    );
  }
  const aura = mp.fielded.filter((id) => f.units[id]?.skills.includes('Solidarity')).map(unitName);
  out.push(D(aura.length ? `Solidarity: ${aura.join(', ')} gives +10 Crit to an ally fighting beside them (${Math.round(ADJACENT * 100)}% of combats, the assumed spread; not to its own lead when backing)` : 'Solidarity: nobody fielded knows it (Robin learns it at Tactician Lv 10)'));
  const benched = defs.filter((d) => MAP_IDS.indexOf(d.joins) <= at && !mp.fielded.includes(d.id)).map((d) => d.name);
  if (benched.length) out.push(D(`not fielded: ${benched.join(', ')}`));
  out.push('');
  out.push(B('Who takes which foe groups') + D('  (mean kills per run)'));
  const groups = [...new Set(foes.map((x) => x.group))];
  for (const g of groups) {
    const n = foes.filter((x) => x.group === g).length;
    const takers = mp.fielded
      .map((id) => [id, f.units[id]?.killsByGroup[g] ?? 0] as const)
      .filter(([, k]) => k >= 0.05)
      .sort((a, b) => b[1] - a[1])
      .map(([id, k]) => `${unitName(id)} ${k.toFixed(1)}`);
    out.push(`  ${pad(`${n}× ${g}`, 26)}${takers.join(' · ') || D('nobody reliably')}`);
  }
  out.push('');
  out.push(B('Milestones') + D('  (level reached before the map starts, share of runs)'));
  if (!goals.length) out.push(D('  none — add one with `goal <unit> <level> <map>`'));
  goals.forEach((g, i) => {
    const r = goalChance(g, fc);
    const m = maps.find((x) => x.id === g.map)!;
    const bar = '█'.repeat(Math.round(r.chance * 20)).padEnd(20, '░');
    out.push(r.joined
      ? `  ${i + 1}. ${pad(`${unitName(g.unit)} Lv ${g.level} by ${m.label}`, 30)}${bar} ${B(`${Math.round(r.chance * 100)}%`.padStart(4))}  ${D(`median Lv ${lv(r.median)} at the deadline`)}${plan.maps.slice(0, MAP_IDS.indexOf(g.map)).some((mp) => mp.fielded.includes(g.unit)) ? '' : D(' · never fielded before then: `field` them earlier')}`
      : `  ${i + 1}. ${pad(`${unitName(g.unit)} Lv ${g.level} by ${m.label}`, 30)}${D('not joined by then')}`);
  });
  if (suggestions) {
    const g = goals[suggestions.goal]!;
    out.push('');
    out.push(B(`Smallest changes that lift ${unitName(g.unit)} Lv ${g.level} by ${maps.find((m) => m.id === g.map)!.label}`) + D('  (one edit each, 120 runs; `take <n>` to apply)'));
    if (!suggestions.list.length) out.push(D('  no single edit lifts it: it may need two edits, or the goal is out of reach'));
    suggestions.list.slice(0, 5).forEach((s, i) => {
      const others = s.others.map((d, j) => (Math.abs(d) >= 0.05 ? `#${j + 1} ${d > 0 ? '+' : ''}${Math.round(d * 100)}%` : '')).filter(Boolean).join(' ');
      out.push(`  ${B(String(i + 1))}. ${pad(s.label, 62)} → ${B(`${Math.round(s.chance * 100)}%`)}  ${D(`waves ${s.waves >= 0 ? '+' : ''}${s.waves}`)}${others ? `  ${D('others:')} ${others}` : ''}${s.breaks ? `  ${B(`breaks ${s.breaks} met goal${s.breaks > 1 ? 's' : ''}`)}` : ''}`);
    });
  }
  const cal = calibration(plan, fc);
  out.push('');
  out.push(`${B('Calibration')} ${cal.points ? `${cal.inside}/${cal.points} recorded results inside p10–p90 (≈80% if calibrated) · mean percentile ${cal.meanPercentile} (50 if unbiased)` : D('record a map end with `rec` to test the forecast against play')}`);
  out.push(D('Assumes: fair share of actions (one per acting unit per wave); pairs stay together all map; stats fixed within a map, expected growth between;'));
  out.push(D('one enemy-phase attack per acting unit; under priority a unit never takes a kill a higher unit could, it chips or waits; the lead gets damage EXP only when its back lands the kill; heals only follow a hit taken; reinforcements left out.'));
  if (message) out.push('', message);
  out.push('');
  out.push(`${B('n')}/${B('b')} ${D('next/prev map')}  ${B('pol')} ${D('toggle policy')}  ${B('vet')} ${D('Veteran reading')}  ${B('hi|norm|lo <unit>')} ${D('priority')}  ${B('field <unit>')} ${D('toggle')} ${D('(field/pair: from this map on)')}  ${B('pair <lead> <back>')}  ${B('unpair <lead>')}`);
  out.push(`${B('rec <unit> <level> <exp>')} ${D('record this map’s end')}  ${B('unrec <unit>')}  ${B('goal <unit> <lvl> <map>')} ${D('e.g. goal robin 10 5')}  ${B('ungoal <n>')}  ${B('suggest <n>')}  ${B('take <n>')}  ${B('runs <n>')}  ${B('q')} ${D('quit')}`);
  console.clear();
  console.log(out.join('\n'));
}

/** Edits are span pins "from here on": this map and every later one. */
function setMap(edit: (m: MapPlan) => MapPlan) {
  plan = { ...plan, maps: plan.maps.map((m, i) => (i >= at ? edit(m) : m)) };
}

function handle(line: string): boolean {
  const [cmd, ...args] = line.trim().split(/\s+/);
  message = '';
  const u = findUnit(args[0]);
  switch (cmd) {
    case 'q': return false;
    case 'n': at = Math.min(maps.length - 1, at + 1); break;
    case 'b': at = Math.max(0, at - 1); break;
    case 'goal': {
      const level = Number(args[1]);
      const mapArg = (args[2] ?? '').toLowerCase();
      const map = maps.find((m) => m.id === mapArg || m.id === `chapter-${mapArg.replace(/^ch(apter)?-?/, '')}` || (mapArg === 'prologue' && m.id === 'prologue'));
      if (!u || !Number.isFinite(level) || !map) { message = 'goal <unit> <level> <map: prologue|1..7>'; break; }
      goals = [...goals, { unit: u, level, map: map.id }];
      break;
    }
    case 'ungoal': goals = goals.filter((_, i) => i !== Number(args[0]) - 1); break;
    case 'suggest': {
      const i = Number(args[0] ?? 1) - 1;
      if (!goals[i]) { message = 'suggest <goal number>'; break; }
      suggestions = { goal: i, list: suggest(plan, defs, goals, i) };
      break;
    }
    case 'take': {
      const s = suggestions?.list[Number(args[0]) - 1];
      if (!s) { message = 'take <suggestion number>'; break; }
      plan = s.plan;
      message = `applied: ${s.label}`;
      suggestions = null;
      break;
    }
    case 'vet': plan = { ...plan, veteranAsBack: !plan.veteranAsBack }; break;
    case 'pol': plan = { ...plan, policy: plan.policy === 'even' ? 'priority' : 'even' }; break;
    case 'hi': case 'norm': case 'lo':
      if (!u) { message = 'which unit?'; break; }
      plan = { ...plan, priority: { ...plan.priority, [u]: ({ hi: 2, norm: 1, lo: 0 } as const)[cmd] as Priority } };
      break;
    case 'field':
      if (!u) { message = 'which unit?'; break; }
      { const on = !plan.maps[at]!.fielded.includes(u); setMap((m) => ({ ...m, fielded: on ? (m.fielded.includes(u) ? m.fielded : [...m.fielded, u]) : m.fielded.filter((x) => x !== u) })); }
      break;
    case 'pair': {
      const back = findUnit(args[1]);
      if (!u || !back) { message = 'pair <lead> <back>'; break; }
      setMap((m) => ({ ...m, pairs: Object.fromEntries([...Object.entries(m.pairs).filter(([l, b]) => l !== u && b !== back && l !== back && b !== u), [u, back]]) }));
      break;
    }
    case 'unpair': if (u) setMap((m) => ({ ...m, pairs: Object.fromEntries(Object.entries(m.pairs).filter(([l]) => l !== u)) })); break;
    case 'rec': {
      const level = Number(args[1]), exp = Number(args[2] ?? 0);
      if (!u || !Number.isFinite(level)) { message = 'rec <unit> <level> <exp>'; break; }
      const id = plan.maps[at]!.map;
      plan = { ...plan, recorded: { ...plan.recorded, [id]: { ...plan.recorded[id], [u]: { level, exp } } } };
      break;
    }
    case 'unrec': {
      const id = plan.maps[at]!.map;
      if (u) plan = { ...plan, recorded: { ...plan.recorded, [id]: Object.fromEntries(Object.entries(plan.recorded[id] ?? {}).filter(([k]) => k !== u)) } };
      break;
    }
    case 'runs': runs = Math.max(20, Number(args[0]) || 300); break;
    case '': break;
    default: message = `unknown: ${cmd}`;
  }
  return true;
}

render();
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', (line) => {
  if (!handle(line)) { rl.close(); return; }
  render();
  rl.prompt();
});
