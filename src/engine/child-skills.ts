/**
 * The skills a child joins with (#187; spec #175, Recruitment and inheritance; research/child-recruitment §3, §4.3):
 * its start class's skills up to its join level (Lv 10: the Lv 1 and Lv 10 skills, only the Lv 1 one for a special
 * class), then one skill from each parent, read on entering the child's paralogue (Lucina: the start of Chapter 13).
 *
 * Each parent passes its bottom-slot eligible equipped skill (JP 2ch wiki p.112, 天馬騎士団 with a player test,
 * FEW's "lowest eligible skill"). The exceptions:
 * - Chrom passes Aether to a daughter and Rightful King to a son, Walhart Conquest and Aversa Shadowgift, whatever is
 *   equipped; so does a Chrom child as Morgan's parent (Chrom's skill for its own gender). The Maiden passes nothing.
 * - Special Dance and DLC skills are skipped (`inherit-ineligible-bottom`: the next eligible skill up passes, or nothing).
 * - A skill the child starts with is wasted (`inherit-duplicate-skill`), or the next skill up passes.
 * - Both parents passing the same skill (`inherit-same-skill`, default `next-skill`): one parent's next skill up
 *   passes instead. Which parent yields isn't known (research G5); here the fixed parent keeps its skill and the other
 *   parent passes its next one (the fixed parent's next, when the other has none left).
 *
 * `inherit-last-skill`'s alternative (most recently equipped) picks the same skill: a skill put back on goes to the
 * bottom (research §3.1), so the equipped list's order is read either way.
 *
 * Pure over the parents' equipped skills, so a simulated run can pass its parents as they are at entry.
 */
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { CLASS_SKILLS, CHROM_CHILD_PASSES, FIXED_INHERITANCE, SKILLS, type SkillId } from '../game-data/skills';
import type { ClassId } from '../game-data/classes';
import type { Gender } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { Assumptions } from './assumptions';
import type { RosterUnit } from './roster';

/** A parent at paralogue entry: its equipped skills (top to bottom), and the skill it always passes, if any. */
export type SkillParent = { readonly skills: readonly string[]; readonly fixed?: SkillId } | 'maiden';

export type ChildSkillsInput = {
  readonly child: ChildId;
  /** The fixed parent first, then its spouse. */
  readonly parents: readonly [SkillParent, SkillParent];
  /** The child's start class (Morgan's follows its other parent); every other child's is its fixed class. */
  readonly startClass?: ClassId;
  /** The level it joins at: 10 for every child. */
  readonly level?: number;
};

export type ChildSkills = {
  /** Every skill it joins with, by name: the start class's, then each parent's. */
  readonly skills: readonly string[];
  /** What each parent passes (fixed parent first), by name; null when it passes nothing new. */
  readonly passed: readonly [string | null, string | null];
};

const BY_NAME = new Map(Object.entries(SKILLS).map(([id, s]) => [s.name, id as SkillId]));
const nameOf = (id: SkillId) => SKILLS[id].name;

/**
 * The skill a parent always passes: Chrom's, Walhart's or Aversa's by the child's gender, or Chrom's for a Chrom
 * child parenting Morgan. Undefined for everyone else.
 */
export function fixedPass(parent: RosterUnit, childGender: Gender, chromsChild = false): SkillId | undefined {
  const side = childGender === 'M' ? 'son' : 'daughter';
  if (parent !== 'robin' && !(parent in CHILD_UNITS)) {
    const f = FIXED_INHERITANCE[parent as UnitId];
    if (f) return f[side];
  }
  // A Chrom child passes Chrom's skill for its own gender (Lucina and a daughter Aether, a son Rightful King).
  if (chromsChild && parent in CHILD_UNITS) return CHROM_CHILD_PASSES[CHILD_UNITS[parent as ChildId].gender === 'M' ? 'son' : 'daughter'];
  return undefined;
}

/** The start class's skills learned by the join level. */
export function startSkills(cls: ClassId, level = 10): SkillId[] {
  return CLASS_SKILLS[cls].filter((s) => s.level <= level).map((s) => s.skill);
}

export function childSkills(input: ChildSkillsInput, assumptions: Assumptions): ChildSkills {
  const child = CHILD_UNITS[input.child];
  const cls = input.startClass ?? child.defaultClassSet[0];
  if (!cls) throw new Error(`${child.name}’s start class is needed`);
  const own = startSkills(cls, input.level ?? 10);
  const ownSet = new Set<SkillId>(own);

  /** A parent's candidates, bottom first: the skills it could pass, in the order it would pass them. */
  const candidates = (p: SkillParent): SkillId[] => {
    if (p === 'maiden') return [];
    if (p.fixed) return [p.fixed];
    const ids = [...p.skills].reverse().map((n) => BY_NAME.get(n));
    const eligible = (id: SkillId | undefined): id is SkillId => !!id && SKILLS[id].inheritable;
    // An ineligible skill at the bottom passes nothing under the alternative reading.
    if (assumptions['inherit-ineligible-bottom'] === 'nothing' && ids.length && !eligible(ids[0])) return [];
    const out = ids.filter(eligible);
    // A skill the child starts with: wasted (the pick stays, and passes nothing new), or skipped for the next one up.
    return assumptions['inherit-duplicate-skill'] === 'next-skill' ? out.filter((id) => !ownSet.has(id)) : out;
  };
  const [fa, fb] = input.parents;
  const ca = candidates(fa);
  const cb = candidates(fb);
  let a: SkillId | undefined = ca[0];
  let b: SkillId | undefined = cb[0];
  if (a && a === b) {
    if (assumptions['inherit-same-skill'] === 'next-skill') {
      // The other parent yields (a fixed pass never does); failing that, the fixed parent's next skill.
      const bFixed = fb !== 'maiden' && !!fb.fixed;
      if (!bFixed && cb[1]) b = cb[1];
      else if (!(fa !== 'maiden' && fa.fixed) && ca[1]) a = ca[1];
      else b = undefined;
    } else b = undefined;
  }
  const passed = [a, b].map((id) => (id && !ownSet.has(id) ? id : undefined));
  const skills = [...own.map(nameOf)];
  for (const id of passed) if (id && !skills.includes(nameOf(id))) skills.push(nameOf(id));
  return { skills, passed: [passed[0] ? nameOf(passed[0]) : null, passed[1] ? nameOf(passed[1]) : null] };
}
