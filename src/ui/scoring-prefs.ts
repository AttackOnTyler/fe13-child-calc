import { STATS, type ClassMode, type Engine, type Preset, type PresetId, type ScoreBasis, type Weights } from '../engine';

/** A user's edit to a preset: it belongs to the preset (shown as `Name*`) until reset. */
export type PresetEdit = { readonly weights: Weights; readonly mixed: boolean };

export type ColumnGroup = 'caps' | 'mods' | 'growths';

/** Scoring settings and preset edits; saved in localStorage. Filters are view state and aren't saved. */
export type ScoringPrefs = {
  readonly preset: PresetId;
  readonly edits: Readonly<Partial<Record<PresetId, PresetEdit>>>;
  readonly basis: ScoreBasis;
  readonly classMode: ClassMode;
  /** DLC classes are Auto candidates. */
  readonly dlc: boolean;
  readonly cols: Readonly<Record<ColumnGroup, boolean>>;
};

export const DEFAULT_PREFS: ScoringPrefs = {
  preset: 'physical-lead',
  edits: {},
  basis: 'caps-lb',
  classMode: 'auto',
  dlc: false,
  cols: { caps: true, mods: true, growths: false },
};

export const BASES: readonly ScoreBasis[] = ['caps-lb', 'caps', 'growths'];

const KEY = 'fe13-child-calc:scoring:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const WEIGHT_KEYS = [...STATS, 'spdBeyond'] as const;

function readEdit(v: unknown): PresetEdit | undefined {
  if (!isObject(v) || !isObject(v.weights) || typeof v.mixed !== 'boolean') return undefined;
  const w = v.weights;
  if (!WEIGHT_KEYS.every((k) => typeof w[k] === 'number' && Number.isFinite(w[k]))) return undefined;
  return { weights: w as Weights, mixed: v.mixed };
}

/** Reads saved prefs, dropping anything missing, stale or corrupt in favour of the default. */
export function loadPrefs(engine: Engine): ScoringPrefs {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return DEFAULT_PREFS;
  }
  if (!isObject(raw)) return DEFAULT_PREFS;
  const presets = new Map(engine.presets().map((p) => [p.id as string, p]));
  const classIds = new Set<string>(engine.classes().map((c) => c.id));
  const edits: Partial<Record<PresetId, PresetEdit>> = {};
  if (isObject(raw.edits)) {
    for (const [id, v] of Object.entries(raw.edits)) {
      const edit = readEdit(v);
      if (edit && presets.get(id)?.weights) edits[id as PresetId] = edit;
    }
  }
  const cols = isObject(raw.cols) ? raw.cols : {};
  const col = (k: ColumnGroup) => (typeof cols[k] === 'boolean' ? (cols[k] as boolean) : DEFAULT_PREFS.cols[k]);
  return {
    preset: typeof raw.preset === 'string' && presets.has(raw.preset) ? (raw.preset as PresetId) : DEFAULT_PREFS.preset,
    edits,
    basis: BASES.includes(raw.basis as ScoreBasis) ? (raw.basis as ScoreBasis) : DEFAULT_PREFS.basis,
    classMode:
      raw.classMode === 'auto' || (typeof raw.classMode === 'string' && classIds.has(raw.classMode))
        ? (raw.classMode as ClassMode)
        : DEFAULT_PREFS.classMode,
    dlc: typeof raw.dlc === 'boolean' ? raw.dlc : DEFAULT_PREFS.dlc,
    cols: { caps: col('caps'), mods: col('mods'), growths: col('growths') },
  };
}

export function savePrefs(prefs: ScoringPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the settings still apply for this session.
  }
}

/** The preset's weights and Mixed flag with the user's edit applied. */
export function effectivePreset(preset: Preset, prefs: ScoringPrefs): { weights: Weights | null; mixed: boolean } {
  const edit = prefs.edits[preset.id];
  return edit ?? { weights: preset.weights, mixed: preset.mixed };
}

/** Whether an edit differs from the curated preset. */
export function isModified(preset: Preset, edit: PresetEdit | undefined): boolean {
  if (!edit || !preset.weights) return false;
  const w = preset.weights;
  return edit.mixed !== preset.mixed || WEIGHT_KEYS.some((k) => edit.weights[k] !== w[k]);
}
