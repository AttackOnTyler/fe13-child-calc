/**
 * Skill inheritance and the Skills drawer's facts: what each parent can pass, which classes teach what, rally
 * coverage and rank buckets. Pure functions over game data, curated ranks and parent profiles
 * (research/skill-inheritance, #4).
 */
import {
  CHROM_CHILD_PASSES,
  CLASS_SKILLS,
  DLC_SKILL_BOOKS,
  FIXED_INHERITANCE,
  RALLY_SKILLS,
  SKILLS,
  type SkillData,
  type SkillId,
} from '../game-data/skills';
import { CLASSES, allowsGender, type ClassData, type ClassId } from '../game-data/classes';
import type { Gender } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import { SKILL_RANKS } from '../curated/skill-ranks';
import type { Assumptions } from './assumptions';
import { className, promotionsOf, reachableClasses } from './classes';
import type { ChildSkillCandidates, PlayContext, SkillCandidates, SkillRef, SkillSource, SkillView, ParentSkills, RankedSkill, RallyCoverage } from './types';

/**
 * What a parent can pass: any inheritable skill it can learn (it must be the lowest equipped one when the
 * paralogue starts), or one fixed skill that always passes, by the child's gender.
 */
export type InheritableSkills =
  | { readonly kind: 'pool'; readonly skills: readonly SkillId[] }
  | { readonly kind: 'fixed'; readonly son: SkillId; readonly daughter: SkillId };

const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
const SKILL_ORDER = new Map(SKILL_IDS.map((id, i) => [id, i]));
const byData = (a: SkillId, b: SkillId) => SKILL_ORDER.get(a)! - SKILL_ORDER.get(b)!;
const skillData = (id: SkillId): SkillData => SKILLS[id];

/** Skills in data order, once each. */
export const skillSet = (...lists: (readonly SkillId[])[]): SkillId[] => [...new Set(lists.flat())].sort(byData);

/** The inheritable skills a unit in these classes can learn (DLC skills and Special Dance never pass). */
const inheritablePool = (classes: readonly ClassId[]): SkillId[] =>
  skillSet(classes.flatMap((c) => CLASS_SKILLS[c].map((s) => s.skill))).filter((s) => skillData(s).inheritable);

const isDlcClass = (c: ClassId) => (CLASSES[c] as ClassData).dlc;

/** A first-gen unit or Robin: its fixed skill, else every inheritable skill its classes and promotions teach. */
export function firstGenSkills(unit: UnitId | 'robin', classes: readonly ClassId[], gender: Gender): InheritableSkills {
  const fixed = unit === 'robin' ? undefined : FIXED_INHERITANCE[unit];
  return fixed ? { kind: 'fixed', ...fixed } : { kind: 'pool', skills: inheritablePool(reachableClasses(classes, gender)) };
}

/**
 * A child acting as Morgan's parent: Chrom's skill for its gender if Chrom is its parent, else what it can learn plus
 * what it could inherit itself (FEW Morgan: "directly or indirectly").
 */
export function secondGenSkills(
  gender: Gender,
  chromsChild: boolean,
  classSet: readonly ClassId[],
  inherited: ChildSkillCandidates,
): InheritableSkills {
  if (chromsChild) {
    const skill = CHROM_CHILD_PASSES[gender === 'M' ? 'son' : 'daughter'];
    return { kind: 'fixed', son: skill, daughter: skill };
  }
  return {
    kind: 'pool',
    skills: skillSet(inheritablePool(reachableClasses(classSet, gender)), inherited.fromFixed.skills, inherited.fromVariable.skills),
  };
}

/** What a parent offers a child of this gender. */
export function candidatesFor(skills: InheritableSkills, childGender: Gender): SkillCandidates {
  if (skills.kind === 'pool') return { skills: skills.skills, fixed: false };
  return { skills: [childGender === 'M' ? skills.son : skills.daughter], fixed: true };
}

// ---- ranks ----

const RANK_KEY: Readonly<Record<PlayContext, 'apotheosis' | 'mainStory' | 'fullRoute' | undefined>> = {
  apotheosis: 'apotheosis',
  'main-story': 'mainStory',
  'full-route': 'fullRoute',
  all: undefined,
};

/** A skill's curated rank in a play context: 1–5 (D–S), 0 unranked. All uses the default. */
export function skillRank(id: SkillId, context: PlayContext): number {
  const r = SKILL_RANKS[id];
  if (!r) return 0;
  const k = RANK_KEY[context];
  return (k && r[k]) ?? r.default;
}

/** Rank letters by rank value; `–` is unranked. */
export const RANK_LETTERS = ['–', 'D', 'C', 'B', 'A', 'S'] as const;

// ---- the Skills drawer ----

/** Everything the view needs about one pairing, resolved by the engine. */
export type SkillViewInput = {
  readonly childName: string;
  readonly gender: Gender;
  readonly fixedParent: string;
  readonly variableParent: string;
  readonly candidates: ChildSkillCandidates;
  readonly startClass: ClassId;
  /** Every class the child can be in (DLC reclass targets included). */
  readonly reachable: readonly ClassId[];
  readonly classCount: number;
};

export type SkillViewSettings = {
  readonly context: PlayContext;
  /** DLC classes and skill books are reachable (the DLC toggle, or a context that reaches DLC). */
  readonly dlc: boolean;
};

const ref = (id: SkillId, context: PlayContext): SkillRef => ({ id, name: skillData(id).name, rank: skillRank(id, context) });

/** Fixed inheritance first, then the starting class line, other classes, a parent's pick, a DLC class. */
const sourceWeight = (s: SkillSource) => (s.kind === 'parent' ? (s.fixed ? 0 : 3) : s.dlc ? 4 : s.reclass ? 2 : 1);

export const describeSource = (s: SkillSource): string =>
  s.kind === 'class'
    ? `${s.className} Lv ${s.level}${s.reclass ? ' ⟳' : ''}`
    : s.fixed
      ? `fixed from ${s.parent}`
      : `inherit from ${s.parent} (must be ${s.parent}’s last equipped)`;

export function buildSkillView(input: SkillViewInput, settings: SkillViewSettings, assumptions: Assumptions): SkillView {
  const { context, dlc } = settings;
  const { gender, childName } = input;
  const startLine = new Set<ClassId>([input.startClass, ...promotionsOf(input.startClass)]);
  const classes = input.reachable.filter((c) => dlc || !isDlcClass(c));

  const classSources = new Map<SkillId, SkillSource[]>();
  for (const c of classes) {
    for (const { skill, level } of CLASS_SKILLS[c]) {
      const src: SkillSource = {
        kind: 'class',
        class: c,
        className: className(c, gender),
        level,
        reclass: !startLine.has(c),
        dlc: isDlcClass(c),
      };
      classSources.set(skill, [...(classSources.get(skill) ?? []), src]);
    }
  }
  const classLearned = new Set(classSources.keys());

  const sides = [
    { side: 'fixed', parent: input.fixedParent, offer: input.candidates.fromFixed },
    { side: 'variable', parent: input.variableParent, offer: input.candidates.fromVariable },
  ] as const;
  const sourcesOf = (id: SkillId): SkillSource[] =>
    [
      ...(classSources.get(id) ?? []),
      ...sides.flatMap(({ side, parent, offer }): SkillSource[] =>
        offer.skills.includes(id) ? [{ kind: 'parent', side, parent, fixed: offer.fixed }] : [],
      ),
    ].sort((x, y) => sourceWeight(x) - sourceWeight(y));

  const parents = sides.map(({ side, parent, offer }, i): ParentSkills => {
    const other = sides[1 - i]!.offer.skills;
    return {
      side,
      parent,
      fixed: offer.fixed,
      skills: offer.skills.map((id) => ({ ...ref(id, context), unique: !classLearned.has(id) && !other.includes(id) })),
      note: parentNote(parent, offer, assumptions),
    };
  });

  const caveats: string[] = [];
  // The start class's skills: the Lv 1 one always, the Lv 10 one if the join level allows (research R7).
  const startSkills = new Set(CLASS_SKILLS[input.startClass].map((s) => s.skill));
  const pools = sides.filter((s) => !s.offer.fixed);
  const dupes = skillSet(pools.flatMap((s) => s.offer.skills.filter((k) => startSkills.has(k))));
  if (dupes.length) {
    const names = dupes.map((k) => skillData(k).name).join(', ');
    caveats.push(
      assumptions['inherit-duplicate-skill'] === 'wasted'
        ? `${childName} may start with ${names}: a parent passing one passes nothing new.`
        : `${childName} may start with ${names}: a parent passing one passes its next skill up instead.`,
    );
  }
  const [fixedSide, variableSide] = sides;
  if (!fixedSide.offer.fixed && !variableSide.offer.fixed && fixedSide.offer.skills.some((k) => variableSide.offer.skills.includes(k))) {
    caveats.push(
      assumptions['inherit-same-skill'] === 'one-copy'
        ? 'If both parents pass the same skill, the child gets one copy and loses the other inheritance.'
        : 'If both parents pass the same skill, the second parent’s next skill up passes instead.',
    );
  }

  const rallies = RALLY_SKILLS.map((id): RallyCoverage => {
    const sources = sourcesOf(id);
    return { skill: ref(id, context), sources, reason: sources.length ? undefined : whyNot(id, input, dlc) };
  });

  const ranked = new Map<number, RankedSkill[]>();
  for (const id of [...classSources.keys()].sort(byData)) {
    const r = ref(id, context);
    ranked.set(r.rank, [...(ranked.get(r.rank) ?? []), { ...r, sources: sourcesOf(id) }]);
  }
  const ranks = [5, 4, 3, 2, 1, 0].flatMap((rank) => {
    const skills = ranked.get(rank);
    return skills ? [{ rank, letter: RANK_LETTERS[rank]!, skills }] : [];
  });
  const books = dlc ? DLC_SKILL_BOOKS.map((id) => ref(id, context)) : [];

  return {
    child: childName,
    fixedParent: input.fixedParent,
    variableParent: input.variableParent,
    startClass: className(input.startClass, gender),
    classCount: input.classCount,
    context,
    dlc,
    rallies,
    parents: [parents[0]!, parents[1]!],
    caveats,
    ranks,
    books,
  };
}

/** How a parent's skill passes, worded by the inheritance assumptions. */
function parentNote(parent: string, offer: SkillCandidates, assumptions: Assumptions): string {
  if (offer.fixed) return `${parent} always passes ${skillData(offer.skills[0]!).name}, whatever is equipped.`;
  if (!offer.skills.length) return `${parent} has no skill to pass.`;
  const which =
    assumptions['inherit-last-skill'] === 'bottom-slot' ? `${parent}’s lowest equipped skill` : `the skill ${parent} equipped most recently`;
  const skip =
    assumptions['inherit-ineligible-bottom'] === 'next-eligible'
      ? ' (a DLC skill or Special Dance there is skipped)'
      : ' (a DLC skill or Special Dance there passes nothing)';
  return `One of these: ${which}${skip} when the child’s paralogue starts.`;
}

const genderWord = (g: Gender) => (g === 'M' ? 'male' : 'female');

/** Why a pairing can't get a skill from any class or parent. */
function whyNot(id: SkillId, input: SkillViewInput, dlc: boolean): string {
  const teachers = (Object.keys(CLASS_SKILLS) as ClassId[]).filter((c) => CLASS_SKILLS[c].some((s) => s.skill === id));
  const names = teachers.map((c) => className(c, input.gender)).join(' / ');
  const data = skillData(id);
  if (teachers.length && teachers.every((c) => !allowsGender(c, input.gender))) {
    return data.dlc
      ? `${names} is ${genderWord(teachers.map((c) => (CLASSES[c] as ClassData).genderLock!)[0]!)}-only, and DLC skills never inherit`
      : `${names} is ${genderWord(input.gender === 'M' ? 'F' : 'M')}-only, and neither parent can pass it`;
  }
  if (data.dlc && !dlc) return 'DLC: turn on DLC, or pick Apotheosis or Full route';
  if (!teachers.length) return 'no class teaches it';
  return `${names} isn’t reachable for ${input.childName}, and neither parent can pass it`;
}
