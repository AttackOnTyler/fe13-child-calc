import { PLAN_PRIORITIES, type ChildId, type Engine, type PresetId } from '../engine';

/**
 * Plan preferences: each child's priority (0–3) and the user's plan presets, which hold in every play context.
 * Preferences, not run state: Clear all leaves them alone.
 */
export type PlanPrefs = {
  readonly priorities: Readonly<Partial<Record<ChildId, number>>>;
  readonly overrides: Readonly<Partial<Record<ChildId, PresetId>>>;
};

export const DEFAULT_PLAN_PREFS: PlanPrefs = { priorities: {}, overrides: {} };

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

/** Plan preferences as saved, dropping unknown children and presets and out-of-range priorities. */
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
  return { priorities, overrides };
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
