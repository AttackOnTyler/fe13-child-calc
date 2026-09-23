import { PLAN_PRIORITIES, type ChildId, type Engine } from '../engine';

/** Plan preferences: each child's priority (0–3). Preferences, not run state: Clear all leaves them alone. */
export type PlanPrefs = { readonly priorities: Readonly<Partial<Record<ChildId, number>>> };

export const DEFAULT_PLAN_PREFS: PlanPrefs = { priorities: {} };

const KEY = 'fe13-child-calc:plan:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads saved plan preferences, dropping unknown children and out-of-range priorities. */
export function loadPlanPrefs(engine: Engine): PlanPrefs {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return DEFAULT_PLAN_PREFS;
  }
  if (!isObject(raw) || !isObject(raw.priorities)) return DEFAULT_PLAN_PREFS;
  const children = new Set<string>(engine.children().map((c) => c.id));
  const priorities: Partial<Record<ChildId, number>> = {};
  for (const [id, v] of Object.entries(raw.priorities)) {
    if (children.has(id) && PLAN_PRIORITIES.includes(v as number)) priorities[id as ChildId] = v as number;
  }
  return { priorities };
}

export function savePlanPrefs(prefs: PlanPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the preferences still apply for this session.
  }
}
