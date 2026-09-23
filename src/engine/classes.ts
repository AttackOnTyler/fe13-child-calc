/**
 * Class inheritance and class maths: a child's class set, the classes it can reach, effective caps and class
 * growths. Pure functions over game data and parent profiles.
 */
import {
  CLASSES,
  DLC_RECLASS_TARGETS,
  PROMOTES_TO,
  allowsGender,
  type ClassData,
  type ClassId,
  type GenderSplit,
} from '../game-data/classes';
import type { ChildUnitData } from '../game-data/children';
import { STATS, type Gender, type Growths, type Modifiers, type Stat } from '../game-data/stats';
import { assumed, type AssumptionId, type Assumptions } from './assumptions';
import type { ParentProfile } from './inheritance';

const union = (...sets: (readonly ClassId[])[]): ClassId[] => [...new Set(sets.flat())];

/**
 * The special classes Morgan can take from its other parent: Villager (Donnel, or Donnel's son), Taguel (Panne,
 * Yarne) and Manakete (Nowi, Tiki, Nah). No other class the parent has adds anything (SF per-child pages for
 * Morgan; FEW Morgan; research/marriage-and-classes §3.5).
 */
const MORGAN_FROM_PARTNER: readonly ClassId[] = ['villager', 'taguel', 'manakete'];

/** Morgan starts as a Tactician when the other parent's base class is one of these (SF children; FEW Inheritance). */
const MORGAN_STARTS_AS_TACTICIAN_FROM: readonly ClassId[] = ['lord', 'dancer', 'conqueror'];

const isMorgan = (child: ChildUnitData) => child.fixedParent === 'robin';

/**
 * A child's class set (base classes): its default set plus what the variable parent passes to a child of its
 * gender (research/marriage-and-classes §3.2). Morgan's default set is every regular class for its gender, plus
 * the partner's Villager, Taguel or Manakete.
 */
export function childClassSet(child: ChildUnitData, variable: ParentProfile): readonly ClassId[] {
  if (isMorgan(child)) return union(child.defaultClassSet, variable.classes.filter((c) => MORGAN_FROM_PARTNER.includes(c)));
  const side = child.gender === 'M' ? 'son' : 'daughter';
  const passed = variable.passesClasses[side];
  if (!passed) throw new Error(`No sourced class list for this parent passing to a ${side}`);
  return union(child.defaultClassSet, passed);
}

export type StartClass = { readonly startClass: ClassId; readonly assumptionsUsed: readonly AssumptionId[] };

/**
 * The class a child joins in. Morgan starts in the other parent's default base class, or as a Tactician if that
 * is Lord, Dancer or Conqueror. With a child partner, "default base class" is taken to be the child's own
 * starting class; that is an assumption, flagged only where the alternative (Tactician) gives a different class.
 */
export function startClass(child: ChildUnitData, variable: ParentProfile, assumptions: Assumptions): StartClass {
  const own = child.defaultClassSet[0];
  if (!own) throw new Error(`${child.name} has no default class`);
  if (!isMorgan(child)) return { startClass: own, assumptionsUsed: [] };
  if (!variable.baseClass) throw new Error('Morgan’s other parent has no class set');
  const fromPartner = MORGAN_STARTS_AS_TACTICIAN_FROM.includes(variable.baseClass) ? 'tactician' : variable.baseClass;
  if (!variable.secondGen || fromPartner === 'tactician') return { startClass: fromPartner, assumptionsUsed: [] };
  const choice = assumptions['morgan-second-gen-start-class'] === 'tactician' ? 'tactician' : fromPartner;
  return { startClass: choice, assumptionsUsed: ['morgan-second-gen-start-class'] };
}

/**
 * Every class a child with this class set can be in: each base class, its promotions, and the DLC reclass targets
 * (Dread Fighter, Bride), less anything locked to the other gender. In class data order.
 */
export function reachableClasses(classSet: readonly ClassId[], gender: Gender): readonly ClassId[] {
  const promotions = (c: ClassId): readonly ClassId[] => (PROMOTES_TO as Partial<Record<ClassId, readonly ClassId[]>>)[c] ?? [];
  const reach = new Set<ClassId>([...classSet.flatMap((c) => [c, ...promotions(c)]), ...DLC_RECLASS_TARGETS]);
  return (Object.keys(CLASSES) as ClassId[]).filter((c) => reach.has(c) && allowsGender(c, gender));
}

const classData = (id: ClassId): ClassData => CLASSES[id];

const isSplit = <T>(v: T | GenderSplit<T>): v is GenderSplit<T> => typeof v === 'object' && v !== null && 'male' in v;
const byGender = <T>(v: T | GenderSplit<T>, gender: Gender): T => (isSplit(v) ? (gender === 'M' ? v.male : v.female) : v);

export const className = (id: ClassId, gender?: Gender): string => {
  const name = classData(id).name;
  if (typeof name === 'string') return name;
  return gender ? byGender(name, gender) : `${name.male}/${name.female}`;
};

/** A class's max stats for a unit of this gender (Lord and Great Lord differ by gender). */
export const classMaxStats = (id: ClassId, gender: Gender): Readonly<Record<Stat, number>> => byGender(classData(id).maxStats, gender);

/** A class's growths for a unit of this gender, with assumed values (Conqueror Skl/Spd) read from the assumptions. */
export function classGrowths(id: ClassId, gender: Gender, assumptions: Assumptions): Growths {
  const block = byGender(classData(id).growths, gender);
  const out = {} as Record<Stat, number>;
  for (const s of STATS) {
    const v = block[s];
    out[s] = typeof v === 'number' ? v : assumed(v, assumptions);
  }
  return out;
}

/** Class max + child modifier, plus 10 (never on HP) with Limit Breaker. HP has no modifier. */
export function effectiveCaps(id: ClassId, gender: Gender, modifiers: Modifiers, limitBreaker: boolean): Readonly<Record<Stat, number>> {
  const max = classMaxStats(id, gender);
  const out = {} as Record<Stat, number>;
  for (const s of STATS) out[s] = s === 'hp' ? max.hp : max[s] + modifiers[s] + (limitBreaker ? 10 : 0);
  return out;
}
