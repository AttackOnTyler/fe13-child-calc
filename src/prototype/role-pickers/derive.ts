// PROTOTYPE — throwaway (#73). A small real derivation of best roles, as decided on Map: Derived roles:
// standing = place in the cast's spread of each child's best pairing that can still happen, per candidate preset;
// role preset = highest standing in a role (menu order on ties); best role = highest role; army fit = greedy,
// cheapest standing first, Staff/Rally only from children whose pairing reaches a staff class. No roster: "can
// still happen" is every pairing, minus Robin's when Robin is left out or doesn't match the Run facts.
import { createEngine } from '../../engine';
import type { ChildResult } from '../../engine/types';
import { CHILD_UNITS, type ChildId } from '../../game-data/children';
import { STAFF_CLASSES } from '../../game-data/classes';
import type { Gender, Stat } from '../../game-data/stats';
import { COMPOSITION_QUOTAS, type ChildDeploymentRole } from '../../curated/deployment';
import { PRESETS, type PresetId } from '../../curated/presets';
import { DEFAULT_PREFS, scoreSettingsOf } from '../../ui/scoring-prefs';

export const engine = createEngine();
export const CANDIDATES: Record<ChildDeploymentRole, PresetId[]> = {
  lead: ['physical-lead', 'magical-lead', 'mixed-lead', 'physical-hard-support', 'magical-hard-support'],
  battery: ['battery'],
  staff: ['rallybot'],
};
export const NICHE: PresetId[] = ['vv-lead', 'crisis-crit', 'tank', 'nostank', 'armsthrift-bruiser', 'lancekiller', 'staffbot'];
export const ROLE_NAME: Record<ChildDeploymentRole, string> = { lead: 'Lead', battery: 'Battery', staff: 'Staff/Rally' };
export const presetName = (p: PresetId) => PRESETS[p].name;
/** Deployment role of a preset; Staffbot scores as Lead but deploys as Staff/Rally (#71). */
export const deploysAs = (p: PresetId): ChildDeploymentRole => (p === 'staffbot' || p === 'rallybot' ? 'staff' : PRESETS[p].role === 'support' ? 'battery' : 'lead');

const scorings = new Map<PresetId, ReturnType<typeof engine.score>>();
export const scoringFor = (p: PresetId) => {
  let s = scorings.get(p);
  if (!s) scorings.set(p, (s = engine.score(scoreSettingsOf({ ...DEFAULT_PREFS, preset: p }, engine))));
  return s;
};

export type RobinFacts = { gender: Gender; asset: Stat; flaw: Stat } | null;
export type Override = { role?: ChildDeploymentRole; preset?: PresetId };
export type State = { robin: RobinFacts; leaveOut: boolean; overrides: Partial<Record<ChildId, Override>> };

const usesRobin = (r: ChildResult) => r.pairing.variableParent.kind === 'robin' || !!r.pairing.fixedRobin;
const robinOk = (r: ChildResult, robin: RobinFacts, leaveOut: boolean) => {
  if (!usesRobin(r)) return true;
  if (leaveOut || !robin) return false;
  const ref = r.pairing.fixedRobin ?? (r.pairing.variableParent.kind === 'robin' ? r.pairing.variableParent : undefined);
  return !!ref && ref.gender === robin.gender && ref.asset === robin.asset && ref.flaw === robin.flaw;
};

export type Derived = {
  child: ChildId;
  name: string;
  inCast: boolean;
  why?: string;
  standing: Partial<Record<PresetId, number>>;
  rolePreset: Record<ChildDeploymentRole, PresetId>;
  roleStanding: Record<ChildDeploymentRole, number>;
  bestRole: ChildDeploymentRole;
  qualifiesStaff: boolean;
  bestLeadPairing?: string;
  /** After army fit and overrides. */
  role: ChildDeploymentRole;
  planPreset: PresetId;
  source: 'derived' | 'army fit' | 'role override' | 'preset override';
  fitReason?: string;
  warning?: string;
};

export function derive(s: State): { rows: Derived[]; counts: Record<ChildDeploymentRole, number>; quotas: typeof COMPOSITION_QUOTAS['main-story']; overCap: boolean } {
  const ids = Object.keys(CHILD_UNITS) as ChildId[];
  const pool = (c: ChildId) => engine.pairings(c).filter((r) => robinOk(r, s.robin, s.leaveOut));
  const cast = ids.filter((c) => pool(c).length > 0);
  const best = new Map<string, number>();
  const bestKey = new Map<string, string>();
  const all: PresetId[] = [...CANDIDATES.lead, 'battery'];
  for (const p of all) {
    const sc = scoringFor(p);
    for (const c of cast) {
      let b = -Infinity;
      let k = '';
      for (const r of pool(c)) {
        const raw = sc.get(r.key).raw;
        if (raw !== undefined && raw > b) (b = raw), (k = r.key);
      }
      best.set(`${p}|${c}`, b);
      bestKey.set(`${p}|${c}`, k);
    }
  }
  const rows: Derived[] = ids.map((c) => {
    const inCast = cast.includes(c);
    const standing: Partial<Record<PresetId, number>> = {};
    for (const p of all) {
      const vals = cast.map((x) => best.get(`${p}|${x}`)!).filter(Number.isFinite);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const v = best.get(`${p}|${c}`);
      standing[p] = inCast && v !== undefined && Number.isFinite(v) && hi > lo ? (v - lo) / (hi - lo) : 0;
    }
    const leadPreset = CANDIDATES.lead.reduce((a, b) => (standing[b]! > standing[a]! ? b : a));
    const rolePreset = { lead: leadPreset, battery: 'battery' as PresetId, staff: 'rallybot' as PresetId };
    const roleStanding = { lead: standing[leadPreset]!, battery: standing.battery!, staff: 0 };
    const bestRole: ChildDeploymentRole = roleStanding.battery > roleStanding.lead ? 'battery' : 'lead';
    const k = bestKey.get(`${leadPreset}|${c}`);
    const res = k ? engine.result(k) : undefined;
    const qualifiesStaff = !!res && engine.reachableClasses(res).some((x) => (STAFF_CLASSES as readonly string[]).includes(x));
    const why = inCast ? undefined : c.startsWith('morgan') ? (s.leaveOut ? 'left out by the switch' : 'needs Robin set in Run facts') : 'no pairing can happen';
    return {
      child: c, name: CHILD_UNITS[c].name, inCast, ...(why ? { why } : {}), standing, rolePreset, roleStanding, bestRole, qualifiesStaff,
      ...(res ? { bestLeadPairing: `${engine.parentName(res.pairing.variableParent)}${engine.robinLabel(res.pairing) ? ` ${engine.robinLabel(res.pairing)}` : ''}` } : {}),
      role: bestRole, planPreset: rolePreset[bestRole], source: 'derived' as const,
    };
  });

  // Overrides first; they count but never move.
  const q = COMPOSITION_QUOTAS['main-story'];
  // First-gen deployed by default: Robin + Chrom lead, Olivia dancer.
  const counts: Record<ChildDeploymentRole, number> = { lead: s.robin && !s.leaveOut ? 2 : 1, battery: 0, staff: 0 };
  const free: Derived[] = [];
  for (const r of rows.filter((x) => x.inCast)) {
    const o = s.overrides[r.child];
    if (o?.preset) {
      r.role = deploysAs(o.preset);
      r.planPreset = o.preset;
      r.source = 'preset override';
    } else if (o?.role) {
      r.role = o.role;
      r.planPreset = r.rolePreset[o.role];
      r.source = 'role override';
    } else {
      free.push(r);
      continue;
    }
    if (r.role === 'staff' && !r.qualifiesStaff) r.warning = "doesn't reach a staff class or rally skill on this pairing";
    counts[r.role]++;
  }
  for (const r of free) counts[r.role]++;
  const cost = (r: Derived, to: ChildDeploymentRole) => r.roleStanding[r.role] - r.roleStanding[to];
  const move = (r: Derived, to: ChildDeploymentRole, why: string) => {
    counts[r.role]--;
    counts[to]++;
    r.role = to;
    r.planPreset = r.rolePreset[to];
    r.source = 'army fit';
    r.fitReason = why;
  };
  const cheapest = (from: (r: Derived) => boolean, to: ChildDeploymentRole) =>
    free.filter((r) => r.source === 'derived' && from(r) && (to !== 'staff' || r.qualifiesStaff)).sort((a, b) => cost(a, to) - cost(b, to) || a.roleStanding[a.role] - b.roleStanding[b.role])[0];
  for (let r; counts.staff < q.roles.staff.min && (r = cheapest(() => true, 'staff')); ) move(r, 'staff', `Staff/Rally below its minimum of ${q.roles.staff.min}`);
  for (let r; counts.battery < q.roles.battery.min && (r = cheapest((x) => x.role === 'lead', 'battery')); ) move(r, 'battery', `Battery below its minimum of ${q.roles.battery.min}`);
  for (let r; counts.lead > q.roles.lead.max && counts.battery < q.roles.battery.max && (r = cheapest((x) => x.role === 'lead', 'battery')); ) move(r, 'battery', `Lead over its maximum of ${q.roles.lead.max}`);
  for (let r; counts.lead > q.roles.lead.max && counts.staff < q.roles.staff.max && (r = cheapest((x) => x.role === 'lead', 'staff')); ) move(r, 'staff', `Lead over its maximum of ${q.roles.lead.max}`);
  const overCap = counts.lead > q.roles.lead.max;
  return { rows, counts, quotas: q, overCap };
}

export function topPairings(child: ChildId, preset: PresetId, s: State, n = 5) {
  const sc = scoringFor(preset);
  return engine
    .pairings(child)
    .filter((r) => robinOk(r, s.robin, s.leaveOut))
    .map((r) => ({ label: `${engine.parentName(r.pairing.variableParent)}${engine.robinLabel(r.pairing) ? ` ${engine.robinLabel(r.pairing)}` : ''}`, score: sc.get(r.key).score }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, n);
}
