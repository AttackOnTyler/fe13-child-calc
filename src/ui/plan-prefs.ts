import {
  DEPLOYMENT_ROLES,
  PLAN_PRIORITIES,
  type ChildId,
  type DeploymentRole,
  type Engine,
  type PlayContext,
  type PresetId,
  type QuotaRange,
  type Quotas,
} from '../engine';
import { CONTEXTS } from './scoring-prefs';

/**
 * Plan preferences: each child's priority (0–3), the user's plan presets, which hold in every play context, and the
 * user's composition quotas per play context (All uses Main story's). Preferences, not run state: Clear all leaves them alone.
 */
export type PlanPrefs = {
  readonly priorities: Readonly<Partial<Record<ChildId, number>>>;
  readonly overrides: Readonly<Partial<Record<ChildId, PresetId>>>;
  readonly quotas: Readonly<Partial<Record<PlayContext, Quotas>>>;
};

export const DEFAULT_PLAN_PREFS: PlanPrefs = { priorities: {}, overrides: {}, quotas: {} };

/** The most a quota or the cap can be. */
const QUOTA_LIMIT = 99;

const KEY = 'fe13-child-calc:plan:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const withPriority = (prefs: PlanPrefs, child: ChildId, priority: number): PlanPrefs => ({
  ...prefs,
  priorities: { ...prefs.priorities, [child]: priority },
});

/** Sets a child's plan preset, or with null resets it to the default. */
export function withPlanPreset(prefs: PlanPrefs, child: ChildId, preset: PresetId | null): PlanPrefs {
  const { [child]: _, ...rest } = prefs.overrides;
  return { ...prefs, overrides: preset ? { ...rest, [child]: preset } : rest };
}

/** Sets a play context's quotas, or with null resets them to the curated seed. */
export function withQuotas(prefs: PlanPrefs, context: PlayContext, quotas: Quotas | null): PlanPrefs {
  const { [context]: _, ...rest } = prefs.quotas;
  return { ...prefs, quotas: quotas ? { ...rest, [context]: quotas } : rest };
}

const clampCount = (n: number) => Math.min(QUOTA_LIMIT, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

/** Changes the cap, or one bound of a role's range; the other bound follows so that min ≤ max. */
export function editQuota(quotas: Quotas, field: DeploymentRole | 'cap', value: number, bound: keyof QuotaRange = 'max'): Quotas {
  const n = clampCount(value);
  if (field === 'cap') return { ...quotas, cap: n };
  const { min, max } = quotas.roles[field];
  const range = bound === 'min' ? { min: n, max: Math.max(max, n) } : { min: Math.min(min, n), max: n };
  return { ...quotas, roles: { ...quotas.roles, [field]: range } };
}

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= QUOTA_LIMIT;

function parseQuotas(raw: unknown): Quotas | undefined {
  if (!isObject(raw) || !isCount(raw.cap) || !isObject(raw.roles)) return undefined;
  const roles = {} as Record<DeploymentRole, QuotaRange>;
  for (const role of DEPLOYMENT_ROLES) {
    const r = raw.roles[role];
    if (!isObject(r) || !isCount(r.min) || !isCount(r.max) || r.min > r.max) return undefined;
    roles[role] = { min: r.min, max: r.max };
  }
  return { cap: raw.cap, roles };
}

/** Plan preferences as saved, dropping unknown children and presets, out-of-range priorities and broken quotas. */
export function parsePlanPrefs(raw: unknown, engine: Engine): PlanPrefs {
  if (!isObject(raw)) return DEFAULT_PLAN_PREFS;
  const children = new Set<string>(engine.children().map((c) => c.id));
  const presets = new Set<string>(engine.presets().map((p) => p.id));
  const priorities: Partial<Record<ChildId, number>> = {};
  for (const [id, v] of Object.entries(isObject(raw.priorities) ? raw.priorities : {})) {
    if (children.has(id) && PLAN_PRIORITIES.includes(v as number)) priorities[id as ChildId] = v as number;
  }
  const overrides: Partial<Record<ChildId, PresetId>> = {};
  for (const [id, v] of Object.entries(isObject(raw.overrides) ? raw.overrides : {})) {
    if (children.has(id) && presets.has(v as string)) overrides[id as ChildId] = v as PresetId;
  }
  const quotas: Partial<Record<PlayContext, Quotas>> = {};
  const savedQuotas = isObject(raw.quotas) ? raw.quotas : {};
  for (const context of CONTEXTS.filter((c) => c !== 'all')) {
    const q = parseQuotas(savedQuotas[context]);
    if (q) quotas[context] = q;
  }
  return { priorities, overrides, quotas };
}

export function loadPlanPrefs(engine: Engine): PlanPrefs {
  try {
    return parsePlanPrefs(JSON.parse(localStorage.getItem(KEY) ?? 'null'), engine);
  } catch {
    return DEFAULT_PLAN_PREFS;
  }
}

export function savePlanPrefs(prefs: PlanPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the preferences still apply for this session.
  }
}
