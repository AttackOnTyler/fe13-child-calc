/**
 * The loadout suggester: curated build templates matched against one pairing's reachable skills (#10).
 *
 * A slot is filled from a class the child can reach, a DLC skill book, or a parent's pick, and each parent passes one
 * skill only. The best filling maximises filled slots → quality (sum of ranks in the play context) → first
 * preferences → fewest reclass classes → fewest class levels, so a parent's pick goes to the costliest skill to learn.
 */
import { BUILD_TEMPLATES, type BuildTemplate } from '../curated/builds';
import { PRESETS } from '../curated/presets';
import { CONFLICTS, SYNERGIES, type SkillEdge } from '../curated/synergies';
import type { ClassId } from '../game-data/classes';
import type { SkillId } from '../game-data/skills';
import { ref, skillData, type SkillReach } from './skills';
import type { BuildMatch, BuildSlotMatch, BuildTemplateSummary, PlayContext, SkillSource } from './types';

type ClassSource = Extract<SkillSource, { kind: 'class' }>;

/** One way to fill a slot: every reachable class that teaches it, a parent's pick, or a skill book. */
type Option = {
  readonly skill: SkillId;
  readonly preference: number;
  readonly rank: number;
  readonly via: { readonly kind: 'class'; readonly classes: readonly ClassSource[] } | Exclude<SkillSource, ClassSource>;
};

export const templateSummary = (t: BuildTemplate): BuildTemplateSummary => ({
  id: t.id,
  name: t.name,
  preset: t.role,
  presetName: PRESETS[t.role].name,
  contexts: t.contexts,
  source: t.source,
  confidence: t.confidence,
});

/** The templates for a play context (All: every one), in catalog order. */
export const templatesFor = (context: PlayContext): readonly BuildTemplate[] =>
  context === 'all' ? BUILD_TEMPLATES : BUILD_TEMPLATES.filter((t) => t.contexts.includes(context));

/** Class sources: the start line first, then fewer levels, then data order. */
const byEffort = (a: ClassSource, b: ClassSource) => Number(a.reclass) - Number(b.reclass) || a.level - b.level;

function optionsFor(skill: SkillId, preference: number, reach: SkillReach, context: PlayContext): Option[] {
  const rank = ref(skill, context).rank;
  const sources = reach.sourcesOf(skill);
  const classes = sources.filter((s): s is ClassSource => s.kind === 'class').sort(byEffort);
  const free = sources.some((s) => s.kind === 'book') || classes.some((c) => !c.reclass);
  const options: Option[] = [];
  if (classes.length) options.push({ skill, preference, rank, via: { kind: 'class', classes } });
  for (const s of sources) {
    if (s.kind === 'book') options.push({ skill, preference, rank, via: s });
    // A parent's pick only helps when learning it costs a reclass; a fixed skill comes whatever the build.
    else if (s.kind === 'parent' && (s.fixed || !free)) options.push({ skill, preference, rank, via: s });
  }
  return options;
}

/**
 * The classes a filling learns in: each class skill in its lowest-effort class, sharing a reclass where it can. Skills
 * only one class teaches claim their class first, so a skill with a choice joins a class that is needed anyway.
 */
function classesOf(picks: readonly (Option | undefined)[]): (ClassSource | undefined)[] {
  const needed = new Set<ClassId>();
  for (const p of picks) {
    if (p?.via.kind === 'class' && p.via.classes.length === 1 && p.via.classes[0]!.reclass) needed.add(p.via.classes[0]!.class);
  }
  return picks.map((p) => {
    if (p?.via.kind !== 'class') return undefined;
    const c = p.via.classes.find((c) => !c.reclass || needed.has(c.class)) ?? p.via.classes[0]!;
    if (c.reclass) needed.add(c.class);
    return c;
  });
}

/** [filled, quality, −preference misses, −reclass classes, −class levels]; higher is better. */
function keyOf(picks: readonly (Option | undefined)[]): number[] {
  const filled = picks.filter((p) => p !== undefined);
  const classes = classesOf(picks).filter((c) => c !== undefined);
  return [
    filled.length,
    filled.reduce((a, p) => a + p.rank, 0),
    -filled.reduce((a, p) => a + p.preference, 0),
    -new Set(classes.filter((c) => c.reclass).map((c) => c.class)).size,
    -classes.reduce((a, c) => a + c.level, 0),
  ];
}

const better = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
};

const parentSide = (o: Option | undefined) => (o?.via.kind === 'parent' ? o.via.side : undefined);

export function matchTemplate(t: BuildTemplate, reach: SkillReach, context: PlayContext): BuildMatch {
  const options = t.slots.map((slot) => slot.flatMap((skill, i) => optionsFor(skill, i, reach, context)));
  // Best rank still available from each slot on, for pruning.
  const maxRank = options.map((opts) => Math.max(0, ...opts.map((o) => o.rank)));
  let best: { picks: (Option | undefined)[]; key: number[] } | undefined;
  const picks: (Option | undefined)[] = [];

  const search = (i: number, used: ReadonlySet<SkillId>, sides: ReadonlySet<string>, filled: number, quality: number) => {
    if (best) {
      const rest = options.length - i;
      const hope = [filled + rest, quality + maxRank.slice(i).reduce((a, r) => a + r, 0)];
      if (better(best.key.slice(0, 2), hope)) return;
    }
    if (i === options.length) {
      const key = keyOf(picks);
      if (!best || better(key, best.key)) best = { picks: [...picks], key };
      return;
    }
    for (const o of options[i]!) {
      const side = parentSide(o);
      if (used.has(o.skill) || (side && sides.has(side))) continue;
      picks[i] = o;
      search(i + 1, new Set([...used, o.skill]), side ? new Set([...sides, side]) : sides, filled + 1, quality + o.rank);
    }
    picks[i] = undefined;
    search(i + 1, used, sides, filled, quality);
  };
  search(0, new Set(), new Set(), 0, 0);

  const chosen = best!.picks;
  const classes = classesOf(chosen);
  const slots = t.slots.map((slot, i): BuildSlotMatch => {
    const o = chosen[i];
    const opts = slot.map((id) => ref(id, context));
    if (!o) return { options: opts, skill: undefined, preference: undefined, source: undefined, reason: emptyReason(slot, chosen, reach) };
    const source = o.via.kind === 'class' ? classes[i]! : o.via;
    return { options: opts, skill: opts[o.preference]!, preference: o.preference, source, reason: undefined };
  });

  const filled = new Set(chosen.flatMap((o) => (o ? [o.skill] : [])));
  const reclass = [...new Map(classes.filter((c) => c?.reclass).map((c) => [c!.class, c!.className])).values()];
  return {
    template: templateSummary(t),
    tier: filled.size,
    quality: best!.key[1]!,
    preferenceMisses: -best!.key[2]!,
    reclassCost: reclass.length,
    reclassClasses: reclass,
    slots,
    synergies: SYNERGIES.filter((e) => filled.has(e.a) && filled.has(e.b)).map(
      (e) => `${skillData(e.a).name} + ${skillData(e.b).name}: ${e.note}`,
    ),
  };
}

/** Why none of a slot's skills fits: unreachable, already in another slot, or only from a parent who passes another. */
function emptyReason(slot: readonly SkillId[], chosen: readonly (Option | undefined)[], reach: SkillReach): string {
  const why = (id: SkillId): string => {
    const sources = reach.sourcesOf(id);
    if (!sources.length) return reach.whyNot(id);
    const at = chosen.findIndex((o) => o?.skill === id);
    if (at >= 0) return `already in slot ${at + 1}`;
    const parents = sources.filter((s) => s.kind === 'parent');
    const taken = parents.flatMap((p) => {
      const pick = chosen.find((o) => parentSide(o) === p.side);
      return pick ? [`${p.parent} passes ${skillData(pick.skill).name} instead`] : [];
    });
    return `only ${parents.map((p) => p.parent).join(' or ')} can pass it, and ${taken.join(' and ')}`;
  };
  return slot.length === 1 ? why(slot[0]!) : slot.map((id) => `${skillData(id).name}: ${why(id)}`).join('; ');
}

/** Tier → quality → first preferences → reclass cost, then catalog order. */
export const compareBuilds = (a: BuildMatch, b: BuildMatch): number =>
  b.tier - a.tier || b.quality - a.quality || a.preferenceMisses - b.preferenceMisses || a.reclassCost - b.reclassCost;

/** One number that sorts builds as `compareBuilds` does (higher is better); no build sorts below every build. */
export const buildSortKey = (m: BuildMatch | undefined): number =>
  m ? ((m.tier * 100 + m.quality) * 100 + (99 - m.preferenceMisses)) * 10 + (9 - m.reclassCost) : -1;

/** The lowest tier a build is shown at. */
const SHOWN_TIER = 3;

/** Every template for the context, ranked; those below 3/5 are left out. */
export function matchBuilds(reach: SkillReach, context: PlayContext): BuildMatch[] {
  return templatesFor(context)
    .map((t) => matchTemplate(t, reach, context))
    .filter((m) => m.tier >= SHOWN_TIER)
    .sort(compareBuilds);
}

/** One template's match, if it is shown (3/5 or better). */
export const shownMatch = (t: BuildTemplate, reach: SkillReach, context: PlayContext): BuildMatch | undefined => {
  const m = matchTemplate(t, reach, context);
  return m.tier >= SHOWN_TIER ? m : undefined;
};

/**
 * The template lint: conflict edges whose two skills sit in different slots of a template (alternatives in one slot
 * never meet). The test suite fails on any (#10).
 */
export function templateConflicts(t: BuildTemplate): SkillEdge[] {
  const slotsWith = (id: SkillId) => t.slots.flatMap((s, i) => (s.includes(id) ? [i] : []));
  return CONFLICTS.filter((e) => slotsWith(e.a).some((i) => slotsWith(e.b).some((j) => i !== j)));
}
