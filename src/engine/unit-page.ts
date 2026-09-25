/**
 * The unit page (#101; Map: Unit build pages #76): a first-gen unit seen on its own. Its join data, its class tree
 * (base → promotions, DLC targets, each class's skills with levels and inheritable marks, starting skills merged in),
 * build coverage through the matcher over its own reachable skills, what it passes as a parent, and pair-up bonuses.
 * Pure: the engine resolves the children it parents.
 */
import { CLASSES, DLC_RECLASS_TARGETS, allowsGender, regularClasses, type ClassData, type ClassId, type ClassTier } from '../game-data/classes';
import { JOIN_DATA, type BaseStats, type JoinChapter, type JoinData } from '../game-data/join';
import { ASSET_FLAW, ROBIN_MODIFIERS } from '../game-data/robin';
import { CLASS_SKILLS, type SkillId } from '../game-data/skills';
import type { ChildId } from '../game-data/children';
import type { PresetId } from '../curated/presets';
import { MOD_STATS, type Gender, type ModStat, type Modifiers, type Stat } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { matchBuilds } from './builds';
import { className, promotionsOf, reachableClasses } from './classes';
import { firstGenSkills, ref, skillData, unitSkillReach, type SkillReach } from './skills';
import type { BuildMatch, PlayContext, RobinRef, SkillRef } from './types';

/** A unit with a page: every first-gen unit but the Maiden, who never joins. */
export type PageUnitId = Exclude<UnitId, 'maiden'>;

export type TreeSkill = {
  readonly skill: SkillRef;
  readonly level: number;
  readonly inheritable: boolean;
  /** The unit joins with it. */
  readonly starting: boolean;
};

export type TreeClass = {
  readonly id: ClassId;
  readonly name: string;
  readonly tier: ClassTier;
  readonly dlc: boolean;
  /** The class it joins in. */
  readonly join: boolean;
  readonly skills: readonly TreeSkill[];
};

/** A base (or special) class and what a Master Seal promotes it to. */
export type ClassLine = { readonly base: TreeClass; readonly promotions: readonly TreeClass[] };

export type ClassTree = {
  readonly lines: readonly ClassLine[];
  /** DLC reclass targets (Dread Fighter, Bride), shown dimmed. */
  readonly dlc: readonly TreeClass[];
  /** Starting skills no class in the tree teaches (Walhart's Conquest, Priam's Luna). */
  readonly startingOnly: readonly SkillRef[];
};

/** Classes a parent passes to a child of one gender, or null when it never parents that gender's child. */
export type PassedClasses = { readonly classes: readonly { readonly id: ClassId; readonly name: string }[] } | null;

export type UnitAsParent = {
  readonly son: PassedClasses;
  readonly daughter: PassedClasses;
  /** A class the unit passes to a daughter in place of a male-only one (Galedad: Fighter → Pegasus Knight). */
  readonly conversions: readonly { readonly from: string; readonly to: string }[];
  readonly modifiers: Modifiers;
  /** Its fixed skill (Chrom, Aversa, Walhart), else every inheritable skill it can learn. */
  readonly skills:
    | { readonly kind: 'fixed'; readonly son: SkillRef; readonly daughter: SkillRef }
    | { readonly kind: 'pool'; readonly skills: readonly SkillRef[] };
  /** The children it can parent, as the fixed or the variable parent, with the pairing keys. */
  readonly children: readonly ParentedChild[];
};

export type ParentedChild = { readonly child: ChildId; readonly name: string; readonly as: 'fixed' | 'variable'; readonly keys: readonly string[] };

export type UnitPage = {
  readonly unit: PageUnitId | 'robin';
  /** Robin's page: the gender and asset/flaw it shows. */
  readonly robin: RobinRef | undefined;
  readonly name: string;
  readonly gender: Gender;
  readonly join: JoinData & { readonly chapterLabel: string; readonly joinClassName: string };
  readonly chips: { readonly classes: number; readonly skills: number; readonly bestTier: number | undefined };
  readonly tree: ClassTree;
  /** Build coverage in the play context, best first (3/5 and up). */
  readonly builds: readonly BuildMatch[];
  readonly asParent: UnitAsParent;
  /** Pair-up bonuses a partner gets from the unit in each reachable class. */
  readonly pairUp: readonly { readonly id: ClassId; readonly name: string; readonly bonus: Readonly<Partial<Record<ModStat | 'mov', number>>> }[];
};

/**
 * A child a marriage produces: its pairing (the run's Robin, else the best Robin) and its score in its plan preset, or
 * in its Lead role preset when the plan preset scores nothing (Battery, Rallybot).
 */
export type PartnerChild = {
  readonly child: ChildId;
  readonly name: string;
  readonly key: string;
  readonly score: number | undefined;
  readonly preset: PresetId;
};

/** Where a marriage stands: married, in the saved plan, the partner dead, or blocked (with the blocked-pairing reason). */
export type PartnerRow = {
  readonly partner: UnitId | ChildId | 'robin';
  readonly name: string;
  readonly children: readonly PartnerChild[];
  /** The best child's score: the row order. */
  readonly best: number | undefined;
  readonly married: boolean;
  readonly planned: boolean;
  readonly dead: boolean;
  /** Why the marriage can no longer happen, when it can't. */
  readonly blocked: string | undefined;
  /** Robin × a child (#103): the pairing the child brings to Morgan, from the saved plan or its best that can still happen. */
  readonly via?: { readonly label: string; readonly from: 'plan' | 'best' };
  /** A Robin row: the Robin its best child uses (the run's, else the best), so Robin's page can preview it. */
  readonly robin?: RobinRef;
};

export const chapterLabel = (c: JoinChapter): string =>
  c === 'prologue' ? 'Prologue' : c.startsWith('chapter-') ? `Chapter ${c.slice(8)}` : `Paralogue ${c.slice(10)}`;

const isDlc = (c: ClassId) => (CLASSES[c] as ClassData).dlc;

/** The reach a unit page matches builds against. */
/** Who a page is about: a first-gen unit, or Robin with a gender and asset/flaw. */
export type PageSubject = PageUnitId | RobinRef;

/** Robin's bases shift with the asset/flaw: +5/−3 HP, +4/−2 Lck, +2/−1 any other stat (SF; FEW Robin/Stats). */
export function robinBases(r: RobinRef): BaseStats {
  const up = (s: Stat) => (s === 'hp' ? 5 : s === 'lck' ? 4 : 2);
  const down = (s: Stat) => (s === 'hp' ? 3 : s === 'lck' ? 2 : 1);
  const b = { ...JOIN_DATA.robin.normal };
  b[r.asset] += up(r.asset);
  b[r.flaw] -= down(r.flaw);
  return b;
}

/** Everything a page reads about its subject. */
function subjectOf(s: PageSubject) {
  if (typeof s === 'string') {
    const u = FIRST_GEN_UNITS[s];
    return {
      id: s as PageUnitId | 'robin',
      name: u.name as string,
      gender: u.gender as Gender,
      classes: u.classes as readonly ClassId[],
      passesClasses: u.passesClasses as { readonly son: readonly ClassId[] | null; readonly daughter: readonly ClassId[] | null },
      modifiers: u.modifiers as Modifiers,
      join: JOIN_DATA[s] as JoinData,
    };
  }
  const modifiers = {} as Record<ModStat, number>;
  for (const m of MOD_STATS) modifiers[m] = ROBIN_MODIFIERS[m] + (ASSET_FLAW[s.asset].assetModifier[m] ?? 0) + (ASSET_FLAW[s.flaw].flawModifier[m] ?? 0);
  return {
    id: 'robin' as const,
    name: `Robin (${s.gender})`,
    gender: s.gender,
    // Robin has, and passes to a child of either gender, every regular class for that gender (SF class sets).
    classes: regularClasses(s.gender),
    passesClasses: { son: regularClasses('M'), daughter: regularClasses('F') },
    modifiers,
    join: { ...JOIN_DATA.robin, normal: robinBases(s), hard: undefined, lunatic: undefined },
  };
}

/** The reach a page matches builds against. */
export function unitReach(subject: PageSubject, dlc: boolean): SkillReach {
  const u = subjectOf(subject);
  return unitSkillReach(
    {
      name: u.name,
      gender: u.gender,
      reachable: reachableClasses(u.classes, u.gender),
      startLine: [u.join.joinClass, ...promotionsOf(u.join.joinClass)],
      startingSkills: u.join.startingSkills,
    },
    dlc,
  );
}

export function unitPage(subject: PageSubject, context: PlayContext, dlc: boolean, children: readonly ParentedChild[]): UnitPage {
  const u = subjectOf(subject);
  const gender = u.gender;
  const j = u.join;
  const starting = new Set<SkillId>(j.startingSkills);
  const treeClass = (id: ClassId): TreeClass => ({
    id,
    name: className(id, gender),
    tier: CLASSES[id].tier,
    dlc: isDlc(id),
    join: id === j.joinClass,
    skills: CLASS_SKILLS[id].map(({ skill, level }) => ({
      skill: ref(skill, context),
      level,
      inheritable: skillData(skill).inheritable,
      starting: starting.has(skill),
    })),
  });
  const lines = u.classes.map((c) => ({ base: treeClass(c), promotions: promotionsOf(c).filter((p) => allowsGender(p, gender)).map(treeClass) }));
  const dlcTargets = DLC_RECLASS_TARGETS.filter((c) => allowsGender(c, gender)).map(treeClass);
  const taught = new Set([...lines.flatMap((l) => [l.base, ...l.promotions]), ...dlcTargets].flatMap((c) => c.skills.map((s) => s.skill.id)));
  const reach = unitReach(subject, dlc);
  const builds = matchBuilds(reach, context);
  const reachable = reachableClasses(u.classes, gender).filter((c) => dlc || !isDlc(c));
  const skills = new Set<SkillId>([...reach.classSources.keys(), ...starting]);

  const passed = (list: readonly ClassId[] | null, g: Gender): PassedClasses =>
    list && { classes: list.map((id) => ({ id, name: className(id, g) })) };
  const conversions = u.passesClasses.son && u.passesClasses.daughter
    ? u.passesClasses.son.flatMap((c, i) => {
        const d = u.passesClasses.daughter![i];
        return d && d !== c ? [{ from: className(c, 'M'), to: className(d, 'F') }] : [];
      })
    : [];
  const inheritable = firstGenSkills(u.id, u.classes, gender);

  return {
    unit: u.id,
    robin: typeof subject === 'string' ? undefined : subject,
    name: u.name,
    gender,
    join: { ...j, chapterLabel: chapterLabel(j.chapter), joinClassName: className(j.joinClass, gender) },
    chips: { classes: reachable.length, skills: skills.size, bestTier: builds[0]?.tier },
    tree: { lines, dlc: dlcTargets, startingOnly: j.startingSkills.filter((s) => !taught.has(s)).map((s) => ref(s, context)) },
    builds,
    asParent: {
      son: passed(u.passesClasses.son, 'M'),
      daughter: passed(u.passesClasses.daughter, 'F'),
      conversions,
      modifiers: u.modifiers,
      skills:
        inheritable.kind === 'fixed'
          ? { kind: 'fixed', son: ref(inheritable.son, context), daughter: ref(inheritable.daughter, context) }
          : { kind: 'pool', skills: inheritable.skills.map((s) => ref(s, context)) },
      children,
    },
    pairUp: reachable.map((id) => ({ id, name: className(id, gender), bonus: CLASSES[id].pairUp })),
  };
}
