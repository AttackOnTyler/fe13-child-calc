import {
  DEFAULT_SPEED,
  RALLY_OPTIONS,
  STATS,
  type ClassMode,
  type Engine,
  type PlayContext,
  type Preset,
  type PresetId,
  type ScoreBasis,
  type ScoringRole,
  type SpeedSettings,
  type SupportRank,
  type Weights,
} from '../engine';

/** A user's edit to a preset: it belongs to the preset (shown as `Name*`) until reset. */
export type PresetEdit = { readonly weights: Weights; readonly mixed: boolean };

export type ColumnGroup = 'caps' | 'mods' | 'growths' | 'speed';

/** Scoring settings and preset edits; saved in localStorage. Filters are view state and aren't saved. */
export type ScoringPrefs = {
  readonly preset: PresetId;
  readonly edits: Readonly<Partial<Record<PresetId, PresetEdit>>>;
  /** The user's basis; in the Support role Growths falls back to Caps+LB (see `basisOf`) but stays chosen. */
  readonly basis: ScoreBasis;
  /** A global override of the preset's scoring role, or 'preset' to follow it. Choosing a preset resets it. */
  readonly role: ScoringRole | 'preset';
  /** The support rank the pair-up bonus assumes (Support role). */
  readonly supportRank: SupportRank;
  readonly classMode: ClassMode;
  /** DLC classes are Auto candidates. */
  readonly dlc: boolean;
  readonly cols: Readonly<Record<ColumnGroup, boolean>>;
  readonly context: PlayContext;
  /** Rally Spd: one of RALLY_OPTIONS. */
  readonly rally: number;
  readonly tonic: boolean;
  /** Pair-up Spd, 0–10. */
  readonly pairUp: number;
  /** A user-set target breakpoint (null = none), or 'context' to follow the play context's default. */
  readonly target: number | null | 'context';
  /** The speed margin, 0–10. */
  readonly margin: number;
};

export const DEFAULT_PREFS: ScoringPrefs = {
  preset: 'physical-lead',
  edits: {},
  basis: 'caps-lb',
  role: 'preset',
  supportRank: 'A',
  classMode: 'auto',
  dlc: false,
  cols: { caps: true, mods: true, growths: false, speed: true },
  context: 'all',
  rally: DEFAULT_SPEED.rally,
  tonic: DEFAULT_SPEED.tonic,
  pairUp: DEFAULT_SPEED.pairUp,
  target: 'context',
  margin: DEFAULT_SPEED.margin,
};

export const CONTEXTS: readonly PlayContext[] = ['apotheosis', 'main-story', 'full-route', 'all'];
export const CONTEXT_LABELS: Readonly<Record<PlayContext, string>> = {
  apotheosis: 'Apotheosis',
  'main-story': 'Main story',
  'full-route': 'Full route',
  all: 'All',
};

/** The target breakpoint in force: the user's, or the play context's default. */
export function targetOf(prefs: ScoringPrefs, engine: Engine): number | null {
  return prefs.target === 'context' ? engine.defaultTargetBreakpoint(prefs.context).value : prefs.target;
}

/** The Speed inputs as the engine takes them, with the target breakpoint resolved. */
export function speedSettings(prefs: ScoringPrefs, engine: Engine): SpeedSettings {
  return { rally: prefs.rally, tonic: prefs.tonic, pairUp: prefs.pairUp, target: targetOf(prefs, engine), margin: prefs.margin };
}

/** DLC classes are Auto candidates when the toggle is on, or when the play context reaches DLC. */
export const dlcReachable = (prefs: ScoringPrefs, engine: Engine): boolean => prefs.dlc || engine.contextReachesDlc(prefs.context);

export const BASES: readonly ScoreBasis[] = ['caps-lb', 'caps', 'growths'];
export const ROLES: readonly ScoringRole[] = ['lead', 'support'];
/** C/B and A/S give the same bonus, so the rank input offers one of each pair. */
export const RANK_CHOICES: readonly SupportRank[] = ['none', 'C', 'A'];
export const RANKS: readonly SupportRank[] = ['none', 'C', 'B', 'A', 'S'];

/** The scoring role in force: the global override, else the preset's (Lead for Rallybot / Dancer, which isn't scored). */
export const roleOf = (prefs: ScoringPrefs, preset: Preset): ScoringRole =>
  prefs.role === 'preset' ? (preset.role ?? 'lead') : prefs.role;

/** The basis in force for a role: the user's, unless the role can't use it (Growths in Support). */
export const basisOf = (prefs: ScoringPrefs, role: ScoringRole, engine: Engine): ScoreBasis =>
  engine.scoreBases(role).includes(prefs.basis) ? prefs.basis : 'caps-lb';

/** Chooses a preset, going back to its scoring role. */
export const withPreset = (prefs: ScoringPrefs, preset: PresetId): ScoringPrefs => ({ ...prefs, preset, role: 'preset' });

const KEY = 'fe13-child-calc:scoring:v1';

const isIntIn = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

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
    role: raw.role === 'preset' || ROLES.includes(raw.role as ScoringRole) ? (raw.role as ScoringPrefs['role']) : DEFAULT_PREFS.role,
    supportRank: RANKS.includes(raw.supportRank as SupportRank) ? (raw.supportRank as SupportRank) : DEFAULT_PREFS.supportRank,
    classMode:
      raw.classMode === 'auto' || (typeof raw.classMode === 'string' && classIds.has(raw.classMode))
        ? (raw.classMode as ClassMode)
        : DEFAULT_PREFS.classMode,
    dlc: typeof raw.dlc === 'boolean' ? raw.dlc : DEFAULT_PREFS.dlc,
    cols: { caps: col('caps'), mods: col('mods'), growths: col('growths'), speed: col('speed') },
    context: CONTEXTS.includes(raw.context as PlayContext) ? (raw.context as PlayContext) : DEFAULT_PREFS.context,
    rally: RALLY_OPTIONS.includes(raw.rally as number) ? (raw.rally as number) : DEFAULT_PREFS.rally,
    tonic: typeof raw.tonic === 'boolean' ? raw.tonic : DEFAULT_PREFS.tonic,
    pairUp: isIntIn(raw.pairUp, 0, 10) ? raw.pairUp : DEFAULT_PREFS.pairUp,
    target: raw.target === null || raw.target === 'context' || isIntIn(raw.target, 1, 99) ? (raw.target as ScoringPrefs['target']) : DEFAULT_PREFS.target,
    margin: isIntIn(raw.margin, 0, 10) ? raw.margin : DEFAULT_PREFS.margin,
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
