/**
 * The Skill card: one skill seen from one pairing (#14). Its description, rate and ranks; every way the pairing gets it
 * or why not; whether it can ever be inherited; its synergy and conflict partners with their reachability; and the
 * pairing's builds that use it. Synergies and conflicts explain, they never score (#10).
 */
import { CONFLICTS, SYNERGIES, type SkillEdge } from '../curated/synergies';
import { FIXED_INHERITANCE, type SkillId } from '../game-data/skills';
import { FIRST_GEN_UNITS, type UnitId } from '../game-data/units';
import { RANK_LETTERS, ref, skillData, skillRank, type SkillReach } from './skills';
import type { BuildMatch, PlayContext, SkillCard, SkillCardEdge, SkillSource } from './types';

const CONTEXTS: readonly PlayContext[] = ['apotheosis', 'main-story', 'full-route', 'all'];

/** Whether any parent can ever pass the skill, and how. */
function inheritance(id: SkillId): SkillCard['inheritance'] {
  const data = skillData(id);
  if (data.inheritable) return { inheritable: true, note: 'Can be inherited: a parent passes it as their last equipped skill.' };
  if (data.dlc) return { inheritable: false, note: 'Never inherited: DLC skills don’t pass.' };
  const fixed = (Object.keys(FIXED_INHERITANCE) as UnitId[]).filter((u) => {
    const f = FIXED_INHERITANCE[u]!;
    return f.son === id || f.daughter === id;
  });
  if (fixed.length) {
    const names = fixed.map((u) => FIRST_GEN_UNITS[u].name).join(' / ');
    return { inheritable: false, note: `Only by fixed inheritance: ${names} always passes it to Morgan.` };
  }
  return { inheritable: false, note: 'Never inherited.' };
}

/** The parent whose one pick is the only way to get the skill, if that is the only way. */
function onlyParent(sources: readonly SkillSource[]): Extract<SkillSource, { kind: 'parent' }> | undefined {
  const [first] = sources;
  return first?.kind === 'parent' && !first.fixed && sources.length === 1 ? first : undefined;
}

export function skillCard(id: SkillId, reach: SkillReach, context: PlayContext, builds: readonly BuildMatch[]): SkillCard {
  const data = skillData(id);
  const sources = reach.sourcesOf(id);
  const mine = onlyParent(sources);

  const edges = (list: readonly SkillEdge[]): SkillCardEdge[] =>
    list.flatMap((e): SkillCardEdge[] => {
      const partner = e.a === id ? e.b : e.b === id ? e.a : undefined;
      if (!partner) return [];
      const theirs = reach.sourcesOf(partner);
      const other = onlyParent(theirs);
      return [
        {
          skill: ref(partner, context),
          reachable: theirs.length > 0,
          note: e.note,
          reason: theirs.length ? undefined : reach.whyNot(partner),
          oneParent: mine && other?.side === mine.side ? mine.parent : undefined,
        },
      ];
    });

  return {
    id,
    name: data.name,
    description: data.description,
    rate: data.rate,
    dlc: data.dlc,
    rally: data.rally,
    ranks: CONTEXTS.map((c) => {
      const rank = skillRank(id, c);
      return { context: c, rank, letter: RANK_LETTERS[rank]!, current: c === context };
    }),
    sources,
    reason: sources.length ? undefined : reach.whyNot(id),
    inheritance: inheritance(id),
    synergies: edges(SYNERGIES),
    conflicts: edges(CONFLICTS),
    builds: builds.flatMap((b) =>
      b.slots.flatMap((s, i) => (s.skill?.id === id ? [{ id: b.template.id, name: b.template.name, tier: b.tier, slot: i + 1 }] : [])),
    ),
  };
}
