/**
 * The assumptions registry: every game value or rule the sources couldn't verify, with a default, known
 * alternatives, sources and the reason it is an assumption. The resolved `Assumptions` (defaults plus the
 * user's overrides) is passed into the calculation so it stays pure.
 *
 * Data that holds an assumed value references an assumption id (`Assumed`) and is read through `assumed()`.
 */
import type { StressCase } from './sim/map-play';
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
  RESEARCH_DEATH_AFTER_MARRIAGE,
  RESEARCH_GOLD,
  FEW_DURABILITY,
  FEW_RENOWN,
  SF_RENOWN,
  RESEARCH_EXP,
  RESEARCH_INTERNAL_LEVEL,
  JP_CHILDREN,
  JP_CHILDREN_MIRROR,
  JP_PK_CHILDREN,
  RESEARCH_CHILD_RECRUITMENT,
  SF_CHILDREN,
  SF_BASES,
  SF_CLASS_CAPS,
  SFF_CHILD_BASES,
  SPEC_MAP_SIMULATION,
  SF_STAVES,
  ITEM_PLAN_GRILLING,
  SF_ITEMS,
  SF_CLASS_BASES,
  RESEARCH_SUPPORT_GROWTH,
  SF_SUPPORT_BASICS,
  FEW_CHROM,
  FEW_MAIDEN,
  CHECK_IN_PLAY,
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
  /** Both parents' picks are the same skill: one parent's next skill up passes (which one is unknown), or the child gets one copy. */
  'inherit-same-skill': 'one-copy' | 'next-skill';
  /** An ineligible skill (DLC, Special Dance) at the bottom: the next eligible one up passes, or nothing does. */
  'inherit-ineligible-bottom': 'next-eligible' | 'nothing';
  /** Which equipped skill is "last": the bottom slot, or the one equipped most recently. */
  'inherit-last-skill': 'bottom-slot' | 'most-recent';
  /** A parent dying after the S-support still leaves the child recruitable. */
  'child-after-parent-death': boolean;
  /** A child's join stat when the sum inside its formula is negative: floor, or truncation toward zero (1 higher). */
  'child-join-rounding': 'floor' | 'toward-zero';
  /** A child's join stats past its start class's caps: left as the formula gives them, or clamped to the caps. */
  'child-join-cap': 'none' | 'start-class-caps';
  /** The Maiden's side of Lucina's join stats: her stats above her class base. */
  'maiden-join-stats': Growths;
  /** Renown for clearing a paralogue or DLC map (a story map gives 10). */
  'paralogue-renown': number;
  /**
   * How a class change moves the internal level: the research's formula (Master Seal +20 for the tier, Second Seal adds
   * half the levels), or the user's memory of +1 per class change (the level at use carries on).
   */
  'class-change-internal-level': 'research' | 'plus-one';
  /**
   * The assumed army spread: distances (tiles) from a staff user to the pairs on a map, each pair equally likely at any
   * of them. A staff reaches a pair with the share of them within its user's Mov + range.
   */
  'army-spread': readonly number[];
  /** Support points past a rank whose conversation isn't viewed yet: they stop at its threshold (one rank a map), or carry. */
  'support-past-threshold': 'clamp' | 'bank';
  /** A candidate lost in Classic before Chrom's wedding at the end of Chapter 11: the game can still pick her, or skips her. */
  'chrom-wedding-lost-candidate': 'still-picked' | 'skipped';
  /** A tome's miss: it spends a use (the series rule for tomes and staves), or it's free like a physical miss. */
  'tome-miss-use': 'costs-a-use' | 'free';
  /** A booster a parent drank before its child's paralogue entry: it feeds the child's join stats, or it doesn't. */
  'booster-to-child': 'feeds' | 'not';
  /** A booster used at the cap: it's spent for nothing (wasted), or the game won't use it (kept for someone else). */
  'booster-at-cap': 'wasted' | 'refused';
  /** The same tonic twice on one unit for one map: it doesn't stack (the second does nothing), or it stacks. */
  'tonic-stacking': 'no-stack' | 'stacks';
  /** Using an item in preparations: free, or it can't be done (a tonic would cost an action on the map, and is left out). */
  'item-in-preparations': 'free' | 'not-in-preparations';
  /** Veteran's ×1.5 (Robin's Tactician skill): only while its holder leads a pair (FEW, JP), or whenever it's paired (SF). */
  'veteran-as-back': 'lead-only' | 'paired';
  /** A Master or Second Seal and the EXP bar: reset to 0 with the level, or kept. */
  'seal-exp-bar': 'reset' | 'kept';
  /** A Deadlord's kill: its +20 unit bonus only, or the boss +20 on top where the chapter data marks it a boss. */
  'deadlord-boss-bonus': 'unit-only' | 'boss-too';
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

/** Distances in tiles, at least one, 1–99 each (repeats allowed: two pairs at one distance); kept ascending. */
function parseDistances(raw: unknown): readonly number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 60) return undefined;
  return raw.every((x) => isInt(x) && x > 0 && x < 100) ? [...(raw as number[])].sort((a, b) => a - b) : undefined;
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
      'When a parent’s lowest equipped skill is one the child starts with (Nowi passing Odd Rhythm to Nah), the JP 2ch mirror wiki ' +
      'says the inheritance slot is wasted. It is a single source with no test cited; 天馬騎士団 says it isn’t known, ' +
      'and FEW’s “lowest eligible skill” fits either.',
    sources: [JP_CHILDREN_MIRROR, JP_PK_CHILDREN, SF_CHILDREN, FEW_INHERITANCE, FEW_LUCINA, RESEARCH_SKILL_INHERITANCE, RESEARCH_CHILD_RECRUITMENT],
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
    why:
      '天馬騎士団’s children page says that when both parents’ picks are the same skill, one parent’s second-lowest skill passes instead, ' +
      'and which parent yields isn’t known. A player report there: Stahl × Sully, skills not reordered, gave a Kjelle with both ' +
      'Discipline and Outdoor Fighter. It is a single source; no source backs one copy.',
    sources: [JP_PK_CHILDREN, SF_CHILDREN, FEW_INHERITANCE, RESEARCH_SKILL_INHERITANCE, RESEARCH_CHILD_RECRUITMENT],
    default: 'next-skill',
    alternatives: [{ label: 'One copy, the other inheritance is lost (unsourced)', value: 'one-copy' }],
    input: 'choice',
    format: (v) => (v === 'one-copy' ? 'One copy (the other is lost)' : 'One parent’s next skill up passes instead (which parent isn’t known)'),
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
      'Every source that describes the equipped list says the bottom (last) skill passes: the JP 2ch wiki, FEW’s character notes and ' +
      '天馬騎士団, where a player test (reordering Tharja’s and her husband’s skills after a reset) confirms it. FEW’s Inheritance page ' +
      'says the most recently activated skill, which is the same skill in practice, since a re-equipped skill goes to the bottom.',
    sources: [JP_CHILDREN, JP_PK_CHILDREN, FEW_LUCINA, FEW_INHERITANCE, SF_CHILDREN, RESEARCH_SKILL_INHERITANCE, RESEARCH_CHILD_RECRUITMENT],
    default: 'bottom-slot',
    alternatives: [{ label: 'The most recently equipped skill (no source of its own)', value: 'most-recent' }],
    input: 'choice',
    format: (v) => (v === 'bottom-slot' ? 'The bottom equipped slot' : 'The most recently equipped skill'),
    parse: (raw) => (raw === 'bottom-slot' || raw === 'most-recent' ? raw : undefined),
    affects: 'the inheritance notes in the Skills drawer',
  }),
  'child-after-parent-death': entry({
    id: 'child-after-parent-death',
    label: 'A child after a parent dies post-marriage',
    why:
      'No source lists the parent surviving as a condition for the paralogue, and the JP 2ch wiki notes that a lost parent’s stats and skills ' +
      'from before the loss are used, which presupposes the child still joins. It is a single community observation, and nobody reports ' +
      'the case of a parent lost after marrying but before Chapter 13. The inherited skill is frozen at death.',
    sources: [JP_CHILDREN, RESEARCH_DEATH_AFTER_MARRIAGE],
    default: true,
    alternatives: [{ label: 'No: the child is lost with the parent', value: false }],
    input: 'choice',
    format: (v) => (v ? 'Yes: the child still comes' : 'No: the child is lost'),
    parse: (raw) => (typeof raw === 'boolean' ? raw : undefined),
    affects: 'blocked pairings on the Roster',
  }),
  'child-join-rounding': entry({
    id: 'child-join-rounding',
    label: 'A child’s join stats when the sum is negative',
    why:
      'A child’s join stat is ((each parent’s stat above its class base) + the child’s absolute base) / 3, rounded down, plus its class base. ' +
      'An in-game Lucina settles rounding down for a positive sum. The guidebook’s form (“drop any fractions”) gives 1 more when the sum is negative, ' +
      'which only an early recruit with a high absolute base can reach (Cynthia’s Lck, Yarne’s HP); nobody has tested it.',
    sources: [SF_BASES, SFF_CHILD_BASES, RESEARCH_CHILD_RECRUITMENT],
    default: 'floor',
    alternatives: [{ label: 'Toward zero (the guidebook’s “drop any fractions”, 1 higher)', value: 'toward-zero' }],
    input: 'choice',
    format: (v) => (v === 'floor' ? 'Round down' : 'Round toward zero'),
    parse: (raw) => (raw === 'floor' || raw === 'toward-zero' ? raw : undefined),
    affects: 'a child’s stats filled in by Record results',
  }),
  'child-join-cap': entry({
    id: 'child-join-cap',
    label: 'A child’s join stats past its caps',
    why:
      'FEW’s child stat ranges clamp a child’s join stats at its start class’s caps, but no source tests it, and a question on SF’s forum about ' +
      'what happens past the cap went unanswered. The formula alone doesn’t clamp.',
    sources: [FEW_LUCINA_STATS, SFF_CHILD_BASES, SF_CLASS_CAPS, RESEARCH_CHILD_RECRUITMENT],
    default: 'none',
    alternatives: [{ label: 'Clamped at the start class’s caps (FEW’s ranges)', value: 'start-class-caps' }],
    input: 'choice',
    format: (v) => (v === 'none' ? 'Not clamped' : 'Clamped at the start class’s caps'),
    parse: (raw) => (raw === 'none' || raw === 'start-class-caps' ? raw : undefined),
    affects: 'a child’s stats filled in by Record results',
  }),
  'maiden-join-stats': entry({
    id: 'maiden-join-stats',
    label: 'The Maiden’s side of Lucina’s join stats',
    why:
      'The Maiden (Chrom’s wife if he marries no one) has no published stats, so her side of Lucina’s join stats is unknown. ' +
      'FEW’s Lucina + Maiden minimum counts it as 0.',
    sources: [FEW_LUCINA_STATS, RESEARCH_CHILD_RECRUITMENT],
    default: ZERO_GROWTHS,
    alternatives: [],
    input: 'growths',
    format: (g) => (STATS.every((s) => g[s] === 0) ? '0 in every stat (placeholder)' : STATS.map((s) => g[s]).join('/')),
    parse: parseGrowths,
    affects: 'Lucina’s stats filled in by Record results when Chrom marries no one',
  }),
  'paralogue-renown': entry({
    id: 'paralogue-renown',
    label: 'Renown for a paralogue or DLC map',
    why:
      'Every source gives +10 renown per story map, whatever the difficulty, but none says whether a paralogue gives any; a GameFAQs thread ' +
      'and a 2013 pegasusknight comment say DLC maps give none. Counting none keeps the renown rewards from arriving earlier than they may.',
    sources: [SF_RENOWN, FEW_RENOWN, RESEARCH_GOLD],
    default: 0,
    alternatives: [{ label: '+10, like a story map', value: 10 }],
    input: 'choice',
    format: (v) => (v ? `+${v} each` : 'None'),
    parse: (raw) => (raw === 0 || raw === 10 ? raw : undefined),
    affects: 'when renown rewards arrive',
  }),
  'class-change-internal-level': entry({
    id: 'class-change-internal-level',
    label: 'How a class change moves the internal level',
    why:
      'SF and FEW (which cites SF) say a Master Seal only adds the +20 of an advanced class, so Lv 1 after it is internal 21 whether the unit ' +
      'promoted at Lv 10 or 20, and a Second Seal adds half the levels the unit had; recorded play on the JP 2ch wiki matches. The user ' +
      'remembers +1 per class change instead (internal 11 after a Lv 10 promotion). It is an open rule until one test kill settles it: a ' +
      'fresh Swordmaster promoted at Lv 10 kills a Lv 11 base-class foe, 14 EXP under the research and 30 under +1 per class change.',
    sources: [RESEARCH_EXP, RESEARCH_INTERNAL_LEVEL],
    default: 'research',
    alternatives: [{ label: '+1 per class change: the level at use carries on', value: 'plus-one' }],
    input: 'choice',
    format: (v) => (v === 'research' ? 'The research’s formula (Master Seal +20, Second Seal half the levels)' : '+1 per class change (the level at use carries on)'),
    parse: (raw) => (raw === 'research' || raw === 'plus-one' ? raw : undefined),
    affects: 'each unit’s internal level on the chapter log, and the EXP it earns',
  }),
  'army-spread': entry({
    id: 'army-spread',
    label: 'The assumed army spread',
    why:
      'The map simulation has no map positions, so whether a staff reaches a pair is a chance: each pair is taken as equally likely at any of ' +
      'these distances (tiles) from the staff user, and a staff reaches the ones within its user’s Mov plus its range (Heal, Mend and Recover ' +
      'adjacent; Physic, Fortify and Rescue Mag ÷ 2). No source gives how far an army spreads; the default is a loose formation, 1 to 10 tiles. ' +
      'It is one input, so a map’s real distance to each pair can replace it.',
    sources: [SPEC_MAP_SIMULATION, SF_STAVES, SF_CLASS_BASES],
    default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    alternatives: [
      { label: 'Tight formation: 1 to 6 tiles', value: [1, 2, 3, 4, 5, 6] },
      { label: 'Spread out: 1 to 15 tiles', value: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    input: 'list',
    format: (v) => v.join('/'),
    parse: parseDistances,
    affects: 'whether a staff reaches a pair in the map simulation (each map’s no-death chance)',
  }),
  'support-past-threshold': entry({
    id: 'support-past-threshold',
    label: 'Support points past an unviewed rank',
    why:
      'A rank rises only when its conversation is viewed between maps. No source says whether points earned past its threshold before then ' +
      'are kept, but four point to the clamp: the Seed of Trust can’t be used when it would have no effect, the save stores a pending rank ' +
      'as exactly its threshold, and players report a map’s gain stopping at the next rank. So a pair rises at most one rank a map, and a ' +
      'slow pair takes 8 maps together to S (fast or medium 7). The bank carries the excess over (a slow pair 6 maps).',
    sources: [RESEARCH_SUPPORT_GROWTH, SF_SUPPORT_BASICS],
    default: 'clamp',
    alternatives: [{ label: 'Bank: the excess carries past the threshold', value: 'bank' }],
    input: 'choice',
    format: (v) => (v === 'clamp' ? 'Stop at the threshold (one rank a map at most)' : 'Carry over (several ranks a map)'),
    parse: (raw) => (raw === 'clamp' || raw === 'bank' ? raw : undefined),
    affects: 'support growth in the simulated runs, and how many maps together each rank takes',
  }),
  'chrom-wedding-lost-candidate': entry({
    id: 'chrom-wedding-lost-candidate',
    label: 'A lost candidate at Chrom’s Chapter 11 wedding',
    why:
      'An unmarried Chrom marries a candidate by his supports with them at the end of Chapter 11. Two JP wiki main texts say a candidate ' +
      'lost in Classic can still be the one (JP-112: killing her is useless; 天馬騎士団: losing her after the support grew is too late), ' +
      'which fits how the game treats a lost parent elsewhere. FEW’s Chrom and Maiden pages skip dead candidates, uncited, and nobody ' +
      'has tested it (research/chrom-wedding C4). A flawless run loses nobody, so only a recorded loss reads it.',
    sources: [JP_CHILDREN, JP_PK_CHILDREN, FEW_CHROM, FEW_MAIDEN, RESEARCH_DEATH_AFTER_MARRIAGE],
    default: 'still-picked',
    alternatives: [{ label: 'Skipped, like a candidate married to someone else (FEW)', value: 'skipped' }],
    input: 'choice',
    format: (v) => (v === 'still-picked' ? 'Still picked by her supports (JP wikis)' : 'Skipped (FEW)'),
    parse: (raw) => (raw === 'still-picked' || raw === 'skipped' ? raw : undefined),
    affects: 'who Record results offers and pre-selects as Chrom’s wife, and who the simulated runs can marry him to',
  }),
  'tome-miss-use': entry({
    id: 'tome-miss-use',
    label: 'A tome’s miss spending a use',
    why:
      'A weapon spends a use on each hit; a physical miss is free (GameFAQs, the Fandom Dual System page). FEW Durability, Fandom and ' +
      'fedic give the series rule that tomes and staves spend one on a miss too and don’t name Awakening as an exception, but nobody has ' +
      'tested it in Awakening (research C7, G3). A use a miss spends brings a tome’s rebuy one map sooner.',
    sources: [FEW_DURABILITY, RESEARCH_GOLD],
    default: 'costs-a-use',
    alternatives: [{ label: 'Free, like a physical miss', value: 'free' }],
    input: 'choice',
    format: (v) => (v === 'costs-a-use' ? 'Spends a use (the series rule)' : 'Free, like a physical miss'),
    parse: (raw) => (raw === 'costs-a-use' || raw === 'free' ? raw : undefined),
    affects: 'weapon upkeep and rebuys in the simulated runs',
  }),
  'booster-to-child': entry({
    id: 'booster-to-child',
    label: 'A parent’s booster feeding its child’s join stats',
    why:
      'A child’s join stats are read from its parents on entering its paralogue. The JP 2ch wiki says backing out, using stat boosters and ' +
      're-entering changed them, so a booster a parent drinks before entry is taken to feed the child through the inheritance math. No ' +
      'English source tests it (the item plan’s grilling lists it as unverified). An open rule until a paralogue entered before and after a ' +
      'booster settles it.',
    sources: [JP_CHILDREN, RESEARCH_CHILD_RECRUITMENT, ITEM_PLAN_GRILLING],
    default: 'feeds',
    alternatives: [{ label: 'It doesn’t: the child reads the parent without its boosters', value: 'not' }],
    input: 'choice',
    format: (v) => (v === 'feeds' ? 'It feeds the child (read on entry)' : 'It doesn’t feed the child'),
    parse: (raw) => (raw === 'feeds' || raw === 'not' ? raw : undefined),
    affects: 'children’s join stats in the simulated runs, and where the item plan puts boosters',
  }),
  'booster-at-cap': entry({
    id: 'booster-at-cap',
    label: 'A booster used at the cap',
    why:
      'A booster never raises the cap (SF items). Whether the game lets one be used on a unit already at its cap in that stat, spending it ' +
      'for nothing, isn’t published; the item plan’s grilling reads it as wasted. An open rule until one is tried at the cap.',
    sources: [SF_ITEMS, ITEM_PLAN_GRILLING],
    default: 'wasted',
    alternatives: [{ label: 'Refused: the game won’t use it, so it stays held', value: 'refused' }],
    input: 'choice',
    format: (v) => (v === 'wasted' ? 'Spent for nothing (wasted)' : 'Refused (it stays held)'),
    parse: (raw) => (raw === 'wasted' || raw === 'refused' ? raw : undefined),
    affects: 'boosters planned on a unit at its cap in the simulated runs',
  }),
  'tonic-stacking': entry({
    id: 'tonic-stacking',
    label: 'The same tonic twice',
    why:
      'Different tonics stack and a tonic can pass the cap (the item plan’s grilling), but whether a second of the same tonic on one unit ' +
      'adds another +2 for the map isn’t published; the gold research reads tonics as not stacking. An open rule until one is tried.',
    sources: [RESEARCH_GOLD, ITEM_PLAN_GRILLING],
    default: 'no-stack',
    alternatives: [{ label: 'It stacks: each adds its +2 (+5 HP)', value: 'stacks' }],
    input: 'choice',
    format: (v) => (v === 'no-stack' ? 'Doesn’t stack (the second does nothing)' : 'Stacks'),
    parse: (raw) => (raw === 'no-stack' || raw === 'stacks' ? raw : undefined),
    affects: 'tonics in the simulated runs',
  }),
  'item-in-preparations': entry({
    id: 'item-in-preparations',
    label: 'Using an item in preparations',
    why:
      'The item plan drinks boosters and tonics, and hands weapons over, in a map’s preparations, at no action on the map. That items can ' +
      'be used from the preparations menu at no cost is the item plan’s reading, not a tested fact. If they can’t, a tonic costs its ' +
      'unit an action on the map, which the plan leaves out, so no tonic is used (a booster is drunk on an earlier map instead).',
    sources: [ITEM_PLAN_GRILLING],
    default: 'free',
    alternatives: [{ label: 'Not in preparations: tonics are left out', value: 'not-in-preparations' }],
    input: 'choice',
    format: (v) => (v === 'free' ? 'Free, in preparations' : 'Not in preparations (tonics left out)'),
    parse: (raw) => (raw === 'free' || raw === 'not-in-preparations' ? raw : undefined),
    affects: 'tonics in the simulated runs',
  }),
  'veteran-as-back': entry({
    id: 'veteran-as-back',
    label: 'Veteran on the back',
    why:
      'Veteran (Robin’s Tactician skill) gives ×1.5 EXP. FEW’s Veteran page and 天馬騎士団’s skill page apply it only while its holder ' +
      'leads a pair; SF’s skill list says “when paired up”, which would count Robin as the back too (research C4, medium confidence ' +
      'for lead only). An open rule until Robin backs a pair and lands a Dual Strike: 5 EXP (lead only) or 7 (paired) against a foe ' +
      'of Robin’s level.',
    sources: [RESEARCH_EXP, CHECK_IN_PLAY],
    default: 'lead-only',
    alternatives: [{ label: 'Whenever paired, the back included (SF)', value: 'paired' }],
    input: 'choice',
    format: (v) => (v === 'lead-only' ? 'Only while leading a pair (FEW, JP)' : 'Whenever paired, as the back too (SF)'),
    parse: (raw) => (raw === 'lead-only' || raw === 'paired' ? raw : undefined),
    affects: 'Robin’s EXP as the back in the simulated runs',
  }),
  'seal-exp-bar': entry({
    id: 'seal-exp-bar',
    label: 'The EXP bar through a seal',
    why:
      'A Master or Second Seal resets the displayed level to 1; SF says the internal level is adjusted and nothing about the EXP bar ' +
      '(research G4). The runs reset it with the level. It moves at most 99 EXP per seal. An open rule until a seal is used with ' +
      'the bar noted before and after.',
    sources: [RESEARCH_EXP, CHECK_IN_PLAY],
    default: 'reset',
    alternatives: [{ label: 'Kept: the bar carries into the new class', value: 'kept' }],
    input: 'choice',
    format: (v) => (v === 'reset' ? 'Reset to 0 with the level' : 'Kept through the seal'),
    parse: (raw) => (raw === 'reset' || raw === 'kept' ? raw : undefined),
    affects: 'EXP after a class change in the simulated runs',
  }),
  'deadlord-boss-bonus': entry({
    id: 'deadlord-boss-bonus',
    label: 'Deadlords and the boss bonus',
    why:
      'A Deadlord (Chapter 22, Infinite Regalia) carries a +20 unit bonus, which caps its class bonus (SF calculations). The chapter data ' +
      'marks Chapter 22’s as bosses, but whether the boss +20 comes on top of the unit bonus isn’t published (research G8). The runs give ' +
      'the unit bonus only. An open rule until one Deadlord kill is noted with the killer’s level.',
    sources: [RESEARCH_EXP, CHECK_IN_PLAY],
    default: 'unit-only',
    alternatives: [{ label: 'The boss +20 on top (where the data marks a boss)', value: 'boss-too' }],
    input: 'choice',
    format: (v) => (v === 'unit-only' ? 'The +20 unit bonus only' : 'The unit bonus and the boss +20'),
    parse: (raw) => (raw === 'unit-only' || raw === 'boss-too' ? raw : undefined),
    affects: 'EXP from Deadlord kills in the simulated runs',
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

/**
 * The stated blind spots (#181; spec #175, The Why panel): what the simulation leaves out or simplifies on purpose,
 * where no source can settle it and no setting changes it. Each carries its **lean**, the way it can push the numbers
 * it touches: may read high, may read low, or either way. Later tickets add theirs (stats treated as independent, no
 * taxiing or ferrying, simulation error) and retire placeholders they replace. The assumed army spread (#182) is an
 * assumption (`army-spread`): it has a setting. #184 adds the third party's: NPC kills, NPCs kept out of reach, talks
 * that reach their recruit, and Chapter 3's door keys.
 */
export type BlindSpotId =
  | 'one-worst-attacker'
  | 'held-back-out-of-reach'
  | 'equal-share-of-actions'
  | 'rally-reaches-every-pair'
  | 'attack-stance-adjacency'
  | 'likely-result'
  | 'bosses-hold'
  | 'npc-kills'
  | 'npc-screened'
  | 'talk-reaches'
  | 'door-keys'
  | 'skills-in-combat'
  | 'walls-draw-foes'
  | 'potions-traded'
  | 'lunatic-plus-draws'
  | 'foes-wait';

/** The run simulation's own blind spots (#186): how it walks the army from one map to the next. */
export type RunBlindSpotId =
  | 'class-change-at-cap'
  | 'exp-from-likely-play'
  | 'supports-from-pair-combats'
  | 'kit-as-recorded'
  | 'side-goal-actions'
  | 'kit-by-matchups-won'
  | 'arms-on-the-way'
  | 'loadout-for-the-map'
  | 'simulation-error';

/**
 * What a blind spot touches (#210, the Why panel shows only those touching a number): `map`, the map simulation's
 * chances (each map's no-death chance and everything built on it: the flawless chance, the ceiling, costs and worth);
 * `flawless`, the run simulation's walk from map to map (the flawless chance, costs, worth, gold); `fight`, one fight's
 * kill chance as the play has it; `milestone`, a milestone's chance and the EXP forecast it reads.
 */
export type BlindSpotTouch = 'map' | 'flawless' | 'fight' | 'milestone';

export type BlindSpot = {
  readonly id: BlindSpotId | RunBlindSpotId;
  readonly label: string;
  readonly why: string;
  readonly lean: 'high' | 'low' | 'either';
  readonly touches: readonly BlindSpotTouch[];
};

export const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    id: 'one-worst-attacker',
    label: 'One worst attacker per pair',
    why:
      'With no map positions, each exposed pair takes one enemy-phase attack, from the foe left that is worst for it, each foe attacking once; ' +
      'units alone with no weapon (healers, dancers) stay out of reach. Two or more attackers can reach one pair in play.',
    lean: 'high',
    touches: ['map', 'fight'],
  },
  {
    id: 'walls-draw-foes',
    label: 'Walls draw the foes they can take',
    why:
      'After every exposed pair’s one attack, a pair that can take more draws the foes still free, one at a time, the worst for it first, ' +
      'while its chance of living through the whole enemy phase stays within the 1% a careful player risks and its counter hurts each: a ' +
      'sturdy unit stood where the foes come, up to four (the tiles next to it). With no map positions, the play can’t know whether the ' +
      'map offers such ground, or whether the foes come at all: fewer attackers mean fewer counter kills and longer maps.',
    lean: 'high',
    touches: ['map', 'fight'],
  },
  {
    id: 'foes-wait',
    label: 'Foes that wait, wait until drawn out',
    why:
      'A foe the chapter data says holds its ground (FEW’s AI notes: until a turn, until provoked, only attacking units in its range, behind ' +
      'a door) attacks nobody until its turn comes or a unit attacks it; attacked, only that foe moves, and that enemy phase it attacks only ' +
      'its attacker. A careful player draws such foes out one at a time. In play a unit can stray into a waiting foe’s range, and FEW’s ' +
      'linked triggers (a group moving once a neighbour is provoked) set off more at once. Foes with no note move from the start.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'lunatic-plus-draws',
    label: 'Lunatic+ skills drawn at random, foe by foe',
    why:
      'Each Lunatic+ foe without recorded skills draws its two extra skills from the map’s pool, evenly and anew in every simulated run, ' +
      'bosses too. How the game rolls them (evenly? bosses?) isn’t published, and a player who reads them in preparations and restarts ' +
      'the map before moving can roll again; a recorded foe’s skills replace its draw.',
    lean: 'either',
    touches: ['map', 'fight'],
  },
  {
    id: 'potions-traded',
    label: 'Potions traded where they’re needed',
    why:
      'A front short of HP drinks a potion, its own or one traded over from any unit of the army on the field (a trade costs no action), ' +
      'with its own action. In play the holder must stand next to it to trade, before it moves.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'equal-share-of-actions',
    label: 'An equal share of actions per turn',
    why:
      'Each pair or unit alone gets one action a turn (a Dance gives one more), whoever it is: nothing says who can reach which foe, so a fast flier and an armoured ' +
      'unit act alike, and every foe is in reach of every action.',
    lean: 'either',
    touches: ['map', 'milestone'],
  },
  {
    id: 'rally-reaches-every-pair',
    label: 'Rally reaches every pair',
    why:
      'A unit with a Rally skill equipped rallies before anyone fights, with its own action, when the bonus on the others’ fights is worth ' +
      'more than what it would do instead (always, with nothing else to do), and the bonus is taken to reach every other pair for that ' +
      'turn’s fights. In play a Rally reaches only the units within 3 tiles.',
    lean: 'high',
    touches: ['map', 'fight'],
  },
  {
    id: 'likely-result',
    label: 'Each fight plays out at its likely result',
    why:
      'The play goes on from each exchange’s likely result given nobody died (the lead’s expected HP; the foe falls when that’s more likely ' +
      'than not), while the chance of dying in it is exact. A foe left standing by bad luck can attack again. A heal restores its expected ' +
      'HP (the heal times the chance the staff reaches), and a Rescue happens when it more likely reaches than not.',
    lean: 'either',
    touches: ['map', 'fight', 'milestone'],
  },
  {
    id: 'bosses-hold',
    label: 'Bosses hold their ground',
    why: 'A boss fights only when attacked, as most do on their throne or gate; one that moves out to attack isn’t counted on enemy phase.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'skills-in-combat',
    label: 'Proc and stat skills left out of the combat math',
    why:
      'The exchange plays Dual Strike+ and Dual Guard+, the faires (+5 with the kind), the breakers (+50 Hit and Avoid against it), Hit Rate ' +
      '+20 and Avoid +10, both sides, and the Lunatic+ foe skills (Luna+, Hawkeye, Pavise+, Aegis+, Counter, Vantage+); outside it, Limit ' +
      'Breaker, Veteran, Armsthrift, Healtouch, Rally and Dance. A unit’s proc skills (Luna, Sol, Aether, Astra, Lethality, Ignis, Vengeance, ' +
      'Pavise, Aegis, Counter), Vantage, Miracle, Galeforce’s extra action, Renewal and the stat +2 skills aren’t played for either side. ' +
      'The plan’s build skills are equipped once learned, so a build leaning on procs reads below what it does.',
    lean: 'low',
    touches: ['map', 'fight'],
  },
  {
    id: 'class-change-at-cap',
    label: 'Class changes only between maps, at the level cap or when needed',
    why:
      'Each class change the plan makes (a class-reached milestone) is used in the preparations after the unit reaches its level cap, or ' +
      'before the map that needs the class, whichever comes first, from level 10, with a seal the run holds or one an armory sells ' +
      'there. Class changes happen only between maps: a unit that reaches its cap mid-map fights on in its class until the map ends ' +
      '(its EXP past the cap is lost), where the game lets a seal be used on any turn, so milestones never name a mid-map seal. Seals ' +
      'found mid-map aren’t used before the map ends, and only sure seals are picked up. Changing class earlier or later moves its ' +
      'stats along the way.',
    lean: 'either',
    touches: ['flawless', 'milestone'],
  },
  {
    id: 'exp-from-likely-play',
    label: 'Each fight’s EXP from its likely play',
    why:
      'Each fight gives EXP as it plays at its likely result: kill EXP when the foe more likely falls than not, damage EXP when it lives ' +
      'through the front’s strikes (the Lunatic cut from its 4th engagement included). A paired back gets its half damage EXP weighted by ' +
      'the chance it lands a Dual Strike, never a kill; a partner beside the front in Attack Stance earns none, and Rally none. The EXP ' +
      'priority decides who lands kills, with every foe in reach of every unit: a unit set to wait can always chip instead.',
    lean: 'either',
    touches: ['flawless', 'milestone'],
  },
  {
    id: 'supports-from-pair-combats',
    label: 'Supports grow only from combats paired',
    why:
      'A pair’s support points come from the exchanges it fights paired up, and the plan pairs each couple it marries until they marry. ' +
      'Fighting beside the partner or an ally (Attack Stance), Dual Strikes and Guards, staves and Dances on the partner, Seeds of Trust, event tiles and Barracks talks ' +
      'add nothing, and a unit’s tied pairs go by combats, then name, not by its support list. A marriage is made when the pair reaches S; a ' +
      'child whose fixed parent isn’t married by its paralogue doesn’t join.',
    lean: 'low',
    touches: ['flawless', 'milestone'],
  },
  {
    id: 'kit-as-recorded',
    label: 'The army keeps the weapons it has now',
    why: 'Each unit fights with the weapons its latest entry records (a recruit with those it joins with): weapons never wear out, and nothing is bought or forged on the way.',
    lean: 'either',
    touches: ['flawless'],
  },
  {
    id: 'held-back-out-of-reach',
    label: 'Held-back units stay out of reach',
    why:
      'Exposure is the player’s choice (#183): a front that attacks, or waits as bait, is in the foes’ reach on enemy phase, and one that holds ' +
      'back is not, however fast the foes or small the map. A careful player only exposes a front that very likely lives through it (1% risk at ' +
      'most): it attacks, or waits in reach as bait when it would live through the enemy phase there and counter; when nothing is that safe it ' +
      'engages once a turn with the least risk. With reinforcements that never stop it goes for the boss from the start, and once the ' +
      'stream outpaces it, presses a boss it has no safe attack on with its least risky attacker (kept back and healed for it) when that ' +
      'risk stops falling, never at worse than even odds. A map it can’t win in 50 turns counts as lost. In play, foes that move every ' +
      'turn can reach a unit that hangs back, and waiting as the field fills costs more than the play counts.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'attack-stance-adjacency',
    label: 'Attack Stance adjacency from the spread',
    why:
      'A pair apart stands adjacent (Attack Stance: Dual Strike, Dual Guard and Dual Support from the partner, but no pair-up stats) at the ' +
      'rate the assumed army spread puts two units 1 tile apart, and alone the rest of the time. With no map positions, the play can’t know ' +
      'when a player keeps a split pair side by side; a careful player often does.',
    lean: 'low',
    touches: ['map', 'fight'],
  },
  {
    id: 'side-goal-actions',
    label: 'Side goals cost actions by a turn',
    why:
      'A side goal the plan chases (escaping Thieves, burnable villages, Chapter 18’s falling chests, paralogue results) costs one action ' +
      'for each Thief, village, chest or villager, spent by the turn it would be lost (a reading of each map; Chapter 18’s are the ' +
      'floor’s turns); the chaser isn’t put in the foes’ reach for it, and a Thief chased is also still fought as a foe. With no map ' +
      'positions, the play can’t know how far each one is. Loseable rows that aren’t side goals (one looted chest, Paralogue 3’s ' +
      'villagers, Roster Rescue’s Revenants) are never counted, and only Bullion is sold.',
    lean: 'either',
    touches: ['flawless'],
  },
  {
    id: 'kit-by-matchups-won',
    label: 'The endpoint kit is trimmed by matchups won per gold',
    why:
      'Each kit piece (a weapon the open armories sell, its forge to +5 Mt, a Vulnerary) is worth the endpoint matchups it wins: foes its ' +
      'lead one-rounds and rounds it survives, by count; a Vulnerary counts as one. A run short of gold drops the pieces that win fewest ' +
      'per gold, after its rebuys and seals. Scoring each piece by flawless points (the full solve, #199) may keep a different set.',
    lean: 'either',
    touches: ['flawless'],
  },
  {
    id: 'arms-on-the-way',
    label: 'Weapons bought on the way, within ranks read from level',
    why:
      'At each armory stop on the way a run buys the weapons that win its lineup more of that map’s matchups (off the shelf, never forged) and a ' +
      'Vulnerary each, keeping the gold its planned seals still need; a weapon running dry that the armory doesn’t sell is replaced by the ' +
      'nearest one of its kind that it does. The simulation keeps no weapon EXP, so a unit is taken to wield the best rank it holds in a kind, ' +
      'or what its level suggests when that’s higher (a base class D, C from Lv 10; an advanced or special class B, A from Lv 10). A player ' +
      'may train ranks faster, forge along the way, or hold gold back for the endpoint.',
    lean: 'either',
    touches: ['flawless'],
  },
  {
    id: 'loadout-for-the-map',
    label: 'Five items a map, picked by expected damage',
    why:
      'Each unit carries five items into a map (the game’s inventory): its staves (two at most) and one potion, then the weapons that add ' +
      'the most expected damage over that map’s foes, from Str or Mag, Mt, effectiveness, Def or Res, and a hit chance from Hit, Skl and Lck. ' +
      'The rest waits in the convoy. A player may carry a weapon for a reason the pick doesn’t weigh (range, a spare for one that runs dry ' +
      'mid-map, a Rescue staff over a Physic).',
    lean: 'either',
    touches: ['flawless'],
  },
  {
    id: 'npc-kills',
    label: 'NPC allies don’t attack',
    why:
      'In the ally phase an NPC with a weapon walks into the foes’ reach, as its AI does, and fights back on enemy phase, but its own ' +
      'attacks aren’t played: foes it would fell stay for the army.',
    lean: 'low',
    touches: ['map', 'milestone'],
  },
  {
    id: 'npc-screened',
    label: 'NPCs kept out of reach',
    why:
      'An NPC with no weapon whose death is a failure (Chapter 6’s Emmeryn, a recruit who joins if it survives) stands where the chapter ' +
      'puts it, and is assumed out of the foes’ reach while the army moves the map on: a turn it can’t, they reach it. The play has no map ' +
      'positions to know when foes slip past (Chapter 6’s Thieves opening her door).',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'talk-reaches',
    label: 'Talkers reach their recruits',
    why:
      'A talk recruit joins on the turn the solve sends a talker (the first turn by default): the talker spends its action that turn, and ' +
      'is assumed to reach the recruit. The walk there, and the foes in the way, aren’t played.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'door-keys',
    label: 'Door keys kept',
    why:
      'Chapter 3 is also lost when both Door Keys are lost before a door is opened. The play has no doors or keys: the keys are assumed kept.',
    lean: 'high',
    touches: ['map'],
  },
  {
    id: 'simulation-error',
    label: 'Simulation error',
    why:
      'The flawless chance is a mean over a few simulated runs (stats, EXP and gold differ run to run): the ± on the headline is its error ' +
      '(95%). Each map’s no-death chance is exact for the runs that reach it. Edits and worth are compared on the same runs, so their ± is ' +
      'the paired error, and a milestone’s chance is a share of the runs.',
    lean: 'either',
    touches: ['flawless', 'milestone'],
  },
];

/**
 * The blind spots that can be stressed (#211; spec #175, The Why panel): each one's bad case, which the plan is re-run
 * under (`RunSimInput.stress`) for the headline's stress-test range ("42.0%, as low as 31.8% if two attackers reach
 * each exposed pair"). The rest have no bad case the simulation can play without map positions.
 */
export type StressTest = {
  readonly id: StressCase;
  /** The stated blind spot it stresses. */
  readonly blindSpot: BlindSpotId;
  /** The bad case, in words after "if": "two attackers reach each exposed pair". */
  readonly bad: string;
  /** What the bad case plays, in a sentence. */
  readonly how: string;
};

export const STRESS_TESTS: readonly StressTest[] = [
  {
    id: 'two-attackers',
    blindSpot: 'one-worst-attacker',
    bad: 'two attackers reach each exposed pair',
    how: 'Each exposed pair takes two enemy-phase attacks instead of one, from the two foes left worst for it (each foe still attacks once), after every pair’s first.',
  },
  {
    id: 'no-rally',
    blindSpot: 'rally-reaches-every-pair',
    bad: 'Rally reaches no pair',
    how: 'No Rally reaches anyone: a Rally skill’s holder never rallies and acts otherwise (fights, heals or waits).',
  },
];
