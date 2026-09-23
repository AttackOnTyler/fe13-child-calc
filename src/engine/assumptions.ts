/**
 * The assumptions registry: every game value or rule the sources couldn't verify, with a default, known
 * alternatives, sources and the reason it is an assumption. The resolved `Assumptions` (defaults plus the
 * user's overrides) is passed into the calculation so it stays pure.
 *
 * Data that holds an assumed value references an assumption id (`Assumed`) and is read through `assumed()`.
 * Later tickets add their own entries (death after marriage).
 */
import {
  FEW_CONQUEROR,
  FEW_INHERITANCE,
  FEW_LUCINA,
  FEW_LUCINA_STATS,
  RESEARCH_CLASSES,
  RESEARCH_DISAGREEMENTS,
  RESEARCH_STAT_INHERITANCE,
  SF_CLASS_GROWTHS,
  SF_GROWTH_JS,
  SF_MAX_JS,
  SF_MODIFIERS,
  SF_CALCULATIONS,
  SOLY_APOTHEOSIS,
  RESEARCH_FIXTURES_SPEED,
  RESEARCH_SKILL_INHERITANCE,
  SF_CHILDREN,
  type Assumed,
  type Citation,
} from '../game-data/citations';
import { STATS, type Growths } from '../game-data/stats';

/** The value type of each assumption. */
type AssumptionValues = {
  /** Conqueror's class growth, the same for Skl and Spd. */
  'conqueror-skl-spd-growth': number;
  'maiden-growths': Growths;
  /** Largest |child modifier| per stat, or null for no cap. */
  'modifier-cap': number | null;
  'morgan-second-gen-start-class': 'partner-start-class' | 'tactician';
  /** Ascending Speed breakpoints. */
  'spd-breakpoints': readonly number[];
  'main-story-target-breakpoint': number;
  /** A parent's pick is a skill the child already has: the slot is wasted, or the next skill up passes. */
  'inherit-duplicate-skill': 'wasted' | 'next-skill';
  /** Both parents' picks are the same skill: the child gets one copy, or the second parent's next skill passes. */
  'inherit-same-skill': 'one-copy' | 'next-skill';
  /** An ineligible skill (DLC, Special Dance) at the bottom: the next eligible one up passes, or nothing does. */
  'inherit-ineligible-bottom': 'next-eligible' | 'nothing';
  /** Which equipped skill is "last": the bottom slot, or the one equipped most recently. */
  'inherit-last-skill': 'bottom-slot' | 'most-recent';
};

export type AssumptionId = keyof AssumptionValues;
export type Assumptions = { readonly [K in AssumptionId]: AssumptionValues[K] };
export type Overrides = Readonly<Partial<Record<string, unknown>>>;

export const isAssumed = (x: object): x is Assumed<AssumptionId> => 'assumption' in x;

/** Reads an assumed data value from the resolved assumptions. */
export function assumed<K extends AssumptionId>(ref: Assumed<K>, assumptions: Assumptions): AssumptionValues[K] {
  return assumptions[ref.assumption];
}

/** How the override control edits the value, beyond picking a listed option. */
export type AssumptionInput = 'choice' | 'growths' | 'cap' | 'list';

export type AssumptionDef<K extends AssumptionId = AssumptionId> = {
  readonly id: K;
  readonly label: string;
  readonly why: string;
  readonly sources: readonly Citation[];
  readonly default: AssumptionValues[K];
  readonly alternatives: readonly { readonly label: string; readonly value: AssumptionValues[K] }[];
  readonly input: AssumptionInput;
  readonly format: (v: AssumptionValues[K]) => string;
  /** Validates a stored override; undefined if it isn't a valid value. */
  readonly parse: (raw: unknown) => AssumptionValues[K] | undefined;
  /** What the assumption feeds, for one that no pairing's result rests on (it feeds settings instead). */
  readonly affects?: string;
};

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isPercent = (x: unknown): x is number => isInt(x) && x >= 0 && x <= 100;

function parseGrowths(raw: unknown): Growths | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  return STATS.every((s) => isPercent(r[s])) ? (Object.fromEntries(STATS.map((s) => [s, r[s]])) as Growths) : undefined;
}

/** Ascending positive integers, at least one. */
function parseBreakpoints(raw: unknown): readonly number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.every((x, i) => isInt(x) && x > 0 && x < 100 && (i === 0 || x > raw[i - 1])) ? [...(raw as number[])] : undefined;
}

const ZERO_GROWTHS: Growths = { hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0 };

const entry = <K extends AssumptionId>(d: AssumptionDef<K>) => d;

/** The registry, in validation-panel order. */
export const ASSUMPTION_REGISTRY: { readonly [K in AssumptionId]: AssumptionDef<K> } = {
  'conqueror-skl-spd-growth': entry({
    id: 'conqueror-skl-spd-growth',
    label: 'Conqueror Skl/Spd growth',
    why:
      'SF’s table, FEW’s class list and every displayed Walhart-as-Conqueror total (45) say 15; SF’s calculator script and FEW’s module say 20. ' +
      'Only a GameData.bin dump would settle it. Conqueror is never inherited, so no child pairing depends on it.',
    sources: [SF_CLASS_GROWTHS, SF_GROWTH_JS, FEW_CONQUEROR, RESEARCH_DISAGREEMENTS],
    default: 15,
    alternatives: [{ label: '20 (SF calculator, FEW module)', value: 20 }],
    input: 'choice',
    format: String,
    parse: (raw) => (raw === 15 || raw === 20 ? raw : undefined),
  }),
  'maiden-growths': entry({
    id: 'maiden-growths',
    label: 'Maiden’s growths',
    why:
      'The Maiden (Chrom’s default wife) has no published growths anywhere (SF calculator: unknown; FEW: ??). ' +
      'A placeholder keeps Lucina + Maiden computable; her modifiers (all 0) are sourced.',
    sources: [FEW_LUCINA_STATS, SF_GROWTH_JS, RESEARCH_DISAGREEMENTS],
    default: ZERO_GROWTHS,
    alternatives: [],
    input: 'growths',
    format: (g) => (STATS.every((s) => g[s] === 0) ? '0 in every stat (placeholder)' : STATS.map((s) => g[s]).join('/')),
    parse: parseGrowths,
  }),
  'modifier-cap': entry({
    id: 'modifier-cap',
    label: 'Child modifier cap',
    why:
      'Sources state the child modifier as the plain sum (father + mother + 1) and SF’s calculator applies no clamp, ' +
      'but none says whether the game clamps it. Setting a cap flags every pairing it changes.',
    sources: [SF_MODIFIERS, SF_MAX_JS, FEW_INHERITANCE, RESEARCH_STAT_INHERITANCE],
    default: null,
    alternatives: [],
    input: 'cap',
    format: (v) => (v === null ? 'No cap' : `±${v}`),
    parse: (raw) => (raw === null || (isInt(raw) && raw >= 0 && raw <= 20) ? raw : undefined),
  }),
  'morgan-second-gen-start-class': entry({
    id: 'morgan-second-gen-start-class',
    label: 'Morgan’s start class with a second-gen partner',
    why:
      'Morgan starts in the other parent’s default base class, or as a Tactician if that is Lord, Dancer or Conqueror. ' +
      'For a child partner, sources imply that is the child’s own starting class (e.g. Owain → Myrmidon), ' +
      'but none walks through each case; “some other default” is the only stated alternative.',
    sources: [FEW_INHERITANCE, RESEARCH_CLASSES],
    default: 'partner-start-class',
    alternatives: [{ label: 'Tactician (unsourced stand-in for “some other default”)', value: 'tactician' }],
    input: 'choice',
    format: (v) => (v === 'tactician' ? 'Tactician' : 'The partner’s own start class'),
    parse: (raw) => (raw === 'partner-start-class' || raw === 'tactician' ? raw : undefined),
  }),
  'spd-breakpoints': entry({
    id: 'spd-breakpoints',
    label: 'Speed breakpoints',
    why:
      'Each is an Apotheosis enemy’s Spd + 5 (you double at a 5-point lead): 60 doubles most enemies and isn’t doubled by Thronie (64), ' +
      '66 isn’t doubled by Anna (70), 69 doubles Thronie, 75 doubles Anna, 55 is the breakpoint below for runs without Rally or DLC. ' +
      'The enemy Spd values come from soly’s guide and weren’t checked against a datamined enemy table.',
    sources: [SOLY_APOTHEOSIS, SF_CALCULATIONS, RESEARCH_FIXTURES_SPEED],
    default: [55, 60, 66, 69, 75],
    alternatives: [],
    input: 'list',
    format: (v) => v.join('/'),
    parse: parseBreakpoints,
    affects: 'every Speed cell and the target breakpoint choices',
  }),
  'main-story-target-breakpoint': entry({
    id: 'main-story-target-breakpoint',
    label: 'Main story target breakpoint',
    why:
      'The 60/66/69 breakpoints are for Apotheosis; nothing sources a Speed target for main-story Lunatic/Lunatic+. ' +
      '60 (“doubles most enemies”) is an unsourced stand-in; it is only the Main story context’s default, and the target can be set by hand.',
    sources: [SOLY_APOTHEOSIS, RESEARCH_FIXTURES_SPEED],
    default: 60,
    alternatives: [
      { label: '55 (the breakpoint below)', value: 55 },
      { label: '66 (the Apotheosis default)', value: 66 },
    ],
    input: 'choice',
    format: String,
    parse: (raw) => (isInt(raw) && raw > 0 && raw < 100 ? raw : undefined),
    affects: 'the default target breakpoint in the Main story context',
  }),
  'inherit-duplicate-skill': entry({
    id: 'inherit-duplicate-skill',
    label: 'Inheriting a skill the child already has',
    why:
      'When a parent’s lowest equipped skill is one the child starts with (Nowi passing Odd Rhythm to Nah), no source says ' +
      'whether that inheritance is wasted or the game moves up to the parent’s next equipped skill. FEW’s “lowest eligible skill” fits either.',
    sources: [SF_CHILDREN, FEW_INHERITANCE, FEW_LUCINA, RESEARCH_SKILL_INHERITANCE],
    default: 'wasted',
    alternatives: [{ label: 'The next skill up passes instead', value: 'next-skill' }],
    input: 'choice',
    format: (v) => (v === 'wasted' ? 'Wasted (nothing new passes)' : 'The next skill up passes'),
    parse: (raw) => (raw === 'wasted' || raw === 'next-skill' ? raw : undefined),
    affects: 'the inheritance notes in the Skills drawer',
  }),
  'inherit-same-skill': entry({
    id: 'inherit-same-skill',
    label: 'Both parents passing the same skill',
    why: 'No source says whether the child gets one copy and loses the second inheritance, or the second parent’s next skill passes.',
    sources: [SF_CHILDREN, FEW_INHERITANCE, RESEARCH_SKILL_INHERITANCE],
    default: 'one-copy',
    alternatives: [{ label: 'The second parent’s next skill passes', value: 'next-skill' }],
    input: 'choice',
    format: (v) => (v === 'one-copy' ? 'One copy (the second is lost)' : 'The second parent’s next skill passes'),
    parse: (raw) => (raw === 'one-copy' || raw === 'next-skill' ? raw : undefined),
    affects: 'the inheritance notes in the Skills drawer',
  }),
  'inherit-ineligible-bottom': entry({
    id: 'inherit-ineligible-bottom',
    label: 'An ineligible skill at the bottom of the equipped list',
    why:
      'FEW’s character notes say the lowest eligible equipped skill passes, so a DLC skill or Special Dance at the bottom is skipped; ' +
      'no test is cited, and SF says only “last active skill”, which could mean nothing passes.',
    sources: [FEW_LUCINA, SF_CHILDREN, RESEARCH_SKILL_INHERITANCE],
    default: 'next-eligible',
    alternatives: [{ label: 'Nothing passes from that parent', value: 'nothing' }],
    input: 'choice',
    format: (v) => (v === 'next-eligible' ? 'Skipped (the next eligible skill up passes)' : 'Nothing passes'),
    parse: (raw) => (raw === 'next-eligible' || raw === 'nothing' ? raw : undefined),
    affects: 'the inheritance notes in the Skills drawer',
  }),
  'inherit-last-skill': entry({
    id: 'inherit-last-skill',
    label: 'Which equipped skill is “last”',
    why:
      'FEW’s Inheritance page says the most recently activated skill passes; its character notes say the lowest skill in the equipped list. ' +
      'They are taken to be the same (a newly equipped skill goes to the bottom), but no source confirms it.',
    sources: [FEW_INHERITANCE, FEW_LUCINA, SF_CHILDREN, RESEARCH_SKILL_INHERITANCE],
    default: 'bottom-slot',
    alternatives: [{ label: 'The most recently equipped skill', value: 'most-recent' }],
    input: 'choice',
    format: (v) => (v === 'bottom-slot' ? 'The bottom equipped slot' : 'The most recently equipped skill'),
    parse: (raw) => (raw === 'bottom-slot' || raw === 'most-recent' ? raw : undefined),
    affects: 'the inheritance notes in the Skills drawer',
  }),
};

export const ASSUMPTION_IDS = Object.keys(ASSUMPTION_REGISTRY) as AssumptionId[];

export const DEFAULT_ASSUMPTIONS = Object.fromEntries(
  ASSUMPTION_IDS.map((id) => [id, ASSUMPTION_REGISTRY[id].default]),
) as unknown as Assumptions;

/** Defaults plus every valid override; invalid or unknown overrides (e.g. stale localStorage) are ignored. */
export function resolveAssumptions(overrides: Overrides): Assumptions {
  const out: Record<string, unknown> = { ...DEFAULT_ASSUMPTIONS };
  for (const id of ASSUMPTION_IDS) {
    if (!(id in overrides)) continue;
    const v = ASSUMPTION_REGISTRY[id].parse(overrides[id]);
    if (v !== undefined) out[id] = v;
  }
  return out as Assumptions;
}

/** Whether a resolved value equals the default (values are plain JSON). */
export const isDefaultValue = (id: AssumptionId, value: unknown) =>
  JSON.stringify(value) === JSON.stringify(ASSUMPTION_REGISTRY[id].default);
