/**
 * The unit page (#101; Map: Unit build pages #76): a first-gen unit seen on its own. Its join data, its class tree
 * (base → promotions, DLC targets, each class's skills with levels and inheritable marks, starting skills merged in),
 * build coverage through the matcher over its own reachable skills, what it passes as a parent, and pair-up bonuses.
 * Pure: the engine resolves the children it parents.
 */
import { CLASSES, DLC_RECLASS_TARGETS, allowsGender, type ClassData, type ClassId, type ClassTier } from '../game-data/classes';
import { JOIN_DATA, type JoinChapter, type JoinData } from '../game-data/join';
import { CLASS_SKILLS, type SkillId } from '../game-data/skills';
import type { ChildId } from '../game-data/children';
import type { Gender, ModStat, Modifiers } from '../game-data/stats';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { matchBuilds } from './builds';
import { className, promotionsOf, reachableClasses } from './classes';
import { firstGenSkills, ref, skillData, unitSkillReach, type SkillReach } from './skills';
import type { BuildMatch, PlayContext, SkillRef } from './types';

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
  readonly unit: PageUnitId;
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

export const chapterLabel = (c: JoinChapter): string =>
  c === 'prologue' ? 'Prologue' : c.startsWith('chapter-') ? `Chapter ${c.slice(8)}` : `Paralogue ${c.slice(10)}`;

const isDlc = (c: ClassId) => (CLASSES[c] as ClassData).dlc;

/** The reach a unit page matches builds against. */
export function unitReach(unit: PageUnitId, dlc: boolean): SkillReach {
  const u = FIRST_GEN_UNITS[unit];
  const j = JOIN_DATA[unit];
  return unitSkillReach(
    {
      name: u.name,
      gender: u.gender as Gender,
      reachable: reachableClasses(u.classes, u.gender as Gender),
      startLine: [j.joinClass, ...promotionsOf(j.joinClass)],
      startingSkills: j.startingSkills,
    },
    dlc,
  );
}

export function unitPage(unit: PageUnitId, context: PlayContext, dlc: boolean, children: readonly ParentedChild[]): UnitPage {
  const u = FIRST_GEN_UNITS[unit];
  const gender = u.gender as Gender;
  const j = JOIN_DATA[unit];
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
  const reach = unitReach(unit, dlc);
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
  const inheritable = firstGenSkills(unit, u.classes, gender);

  return {
    unit,
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
