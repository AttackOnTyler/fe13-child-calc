import { latestEntry, type Overrides, type Run } from '../engine';

/**
 * Checked rules (#205; spec #175, Pages, storage and migration): global, not the run's. Each rule's answer (a hand
 * answer, or a checked rule an in-play check settled, #209) with its evidence (run and map), and the model mismatches.
 * They outlive the run: Clear all never touches them. The model reads their values as assumption overrides
 * (`overridesOf`). The first read migrates `assumption-overrides:v1` (each override a hand answer, without evidence:
 * none was kept then), which stays untouched; a missing, blocked or corrupt store just means none.
 */
export type RuleEvidence = {
  /** The run it came from, in words (its Run facts). */
  readonly run?: string;
  /** The map it was seen on, or the latest recorded map when answered by hand. */
  readonly map?: string;
};

export type RuleAnswer = {
  /** The reading the model uses: the assumption's value. */
  readonly value: unknown;
  /** Answered by hand, or settled by an in-play check (#209). */
  readonly how: 'hand' | 'check';
  readonly evidence?: RuleEvidence;
  /** When (epoch ms). */
  readonly at?: number;
};

/** A rule play contradicted twice, matching neither reading (#209). */
export type ModelMismatch = { readonly rule: string; readonly evidence: readonly RuleEvidence[]; readonly at?: number };

export type CheckedRules = {
  /** By assumption id. */
  readonly answers: Readonly<Record<string, RuleAnswer>>;
  readonly mismatches: readonly ModelMismatch[];
};

export const EMPTY_CHECKED_RULES: CheckedRules = { answers: {}, mismatches: [] };

const KEY = 'fe13-child-calc:checked-rules:v1';
const OLD_KEY = 'fe13-child-calc:assumption-overrides:v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function parseEvidence(v: unknown): RuleEvidence | undefined {
  if (!isObject(v)) return undefined;
  const e = { ...(isText(v.run) ? { run: v.run } : {}), ...(isText(v.map) ? { map: v.map } : {}) };
  return Object.keys(e).length ? e : undefined;
}

/** Checked rules as saved: an answer needs a value and how it was given; anything else unreadable is dropped. */
export function parseCheckedRules(raw: unknown): CheckedRules {
  if (!isObject(raw)) return EMPTY_CHECKED_RULES;
  const answers: Record<string, RuleAnswer> = {};
  for (const [id, a] of Object.entries(isObject(raw.answers) ? raw.answers : {})) {
    if (!isObject(a) || !('value' in a) || a.value === undefined || (a.how !== 'hand' && a.how !== 'check')) continue;
    const evidence = parseEvidence(a.evidence);
    answers[id] = { value: a.value, how: a.how, ...(evidence ? { evidence } : {}), ...(isTime(a.at) ? { at: a.at } : {}) };
  }
  const mismatches = (Array.isArray(raw.mismatches) ? raw.mismatches : []).flatMap((m): ModelMismatch[] => {
    if (!isObject(m) || !isText(m.rule)) return [];
    const evidence = (Array.isArray(m.evidence) ? m.evidence : []).map(parseEvidence).filter((e): e is RuleEvidence => e !== undefined);
    return [{ rule: m.rule, evidence, ...(isTime(m.at) ? { at: m.at } : {}) }];
  });
  return { answers, mismatches };
}

const DIFFICULTY_NAMES = { normal: 'Normal', hard: 'Hard', lunatic: 'Lunatic', 'lunatic-plus': 'Lunatic+' } as const;
const MODE_NAMES = { classic: 'Classic', casual: 'Casual' } as const;
const ROUTE_NAMES = { 'main-story': 'Main story', 'full-route': 'Full route' } as const;

/** The evidence of an answer given now: the run by its Run facts ("Lunatic+ Classic, Full route"), its latest map. */
export function ruleEvidence(run: Run): RuleEvidence | undefined {
  const { difficulty, mode, route } = run.roster.run;
  const words = [difficulty && DIFFICULTY_NAMES[difficulty], mode && MODE_NAMES[mode]].filter(Boolean).join(' ');
  const name = [words, route && ROUTE_NAMES[route]].filter(Boolean).join(', ');
  const map = latestEntry(run)?.map;
  const e = { ...(name ? { run: name } : {}), ...(map && map !== 'other' ? { map } : {}) };
  return Object.keys(e).length ? e : undefined;
}

/** The values the model reads: each answer's, as an assumption override. */
export const overridesOf = (rules: CheckedRules): Overrides => Object.fromEntries(Object.entries(rules.answers).map(([id, a]) => [id, a.value]));

/**
 * The rules after the overrides change (the Validation panel's edits): an answer whose value is unchanged keeps its
 * evidence; a new or changed one is a hand answer with this `evidence`; one no longer overridden goes. Mismatches stay.
 */
export function withOverrides(rules: CheckedRules, next: Overrides, evidence: RuleEvidence | undefined, now: number): CheckedRules {
  const answers: Record<string, RuleAnswer> = {};
  for (const [id, value] of Object.entries(next)) {
    if (value === undefined) continue;
    const had = rules.answers[id];
    answers[id] = had && JSON.stringify(had.value) === JSON.stringify(value) ? had : { value, how: 'hand', ...(evidence ? { evidence } : {}), at: now };
  }
  return { ...rules, answers };
}

export function loadCheckedRules(): CheckedRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return parseCheckedRules(JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old === null) return EMPTY_CHECKED_RULES;
    const overrides: unknown = JSON.parse(old);
    if (!isObject(overrides)) return EMPTY_CHECKED_RULES;
    const rules = withOverrides(EMPTY_CHECKED_RULES, overrides, undefined, 0);
    // Migrated answers weren't timed.
    const migrated: CheckedRules = { ...rules, answers: Object.fromEntries(Object.entries(rules.answers).map(([id, a]) => [id, { value: a.value, how: a.how }])) };
    saveCheckedRules(migrated);
    return migrated;
  } catch {
    return EMPTY_CHECKED_RULES;
  }
}

export function saveCheckedRules(rules: CheckedRules): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {
    // Storage unavailable: the answers still apply for this session.
  }
}
