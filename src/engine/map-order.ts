/**
 * The map order (#179; spec #175, milestones #144): the ordered maps a roadmap plays to its endpoint, from the route's
 * template (src/curated/map-order.ts), and what's left of it after the latest recorded map. Child paralogues are places
 * the plan chooses; Infinite Regalia is optional. Later work (the flawless chance, child joins) walks `steps`.
 */
import { APOTHEOSIS_SECRET, FULL_ROUTE_ORDER, MAIN_STORY_ORDER, OPTIONAL_MAPS } from '../curated/map-order';
import { CHILD_UNITS } from '../game-data/children';
import { MAPS, type ChapterData, type ChapterDifficulty } from '../game-data/chapters';
import { deployMax } from './deploy';
import type { Route } from './roster';
import type { Run } from './run';

/** One place on the map order. */
export type MapOrderStep = {
  /** Unique on the order: the map id, or `apotheosis-secret`. */
  readonly key: string;
  /** The chapter-data map id. */
  readonly map: string;
  /** Apotheosis on its secret route, played after its normal route. */
  readonly secret?: true;
  /** A child paralogue: the plan chooses whether and where to play it; its place here only breaks ties. */
  readonly movable?: true;
  /** Played only when its rewards earn its risk (Infinite Regalia). */
  readonly optional?: true;
};

/** The map a run builds its army for, and how many it deploys there. */
export type Endpoint = MapOrderStep & { readonly deploy: number };

export type MapOrder = {
  /** The route the template came from; an unset route reads as the Main story, like the next-map offers. */
  readonly route: Route;
  /** The maps still to play, next first, through the endpoint; empty once the endpoint is recorded. */
  readonly steps: readonly MapOrderStep[];
  readonly endpoint: Endpoint;
};

const byId = new Map(MAPS.map((m) => [m.id, m]));

/** Children as chapter data names them: one `Morgan` for both genders. */
const CHILD_NAMES = new Set(Object.values(CHILD_UNITS).map((c) => c.name.replace(/ \([MF]\)$/, '')));

/** A paralogue that recruits a child (5–16). */
const isChildParalogue = (m: ChapterData) => m.kind === 'paralogue' && m.recruits.some((r) => CHILD_NAMES.has(r.unit));

function stepOf(key: string): MapOrderStep {
  const map = key === APOTHEOSIS_SECRET ? 'apotheosis' : key;
  const data = byId.get(map);
  if (!data) throw new Error(`No chapter data for ${map}`);
  return {
    key,
    map,
    ...(key === APOTHEOSIS_SECRET ? { secret: true as const } : {}),
    ...(isChildParalogue(data) ? { movable: true as const } : {}),
    ...(OPTIONAL_MAPS.includes(map) ? { optional: true as const } : {}),
  };
}

/** The route's whole template, Premonition to endpoint. */
export function routeMapOrder(route: Route): readonly MapOrderStep[] {
  return (route === 'full-route' ? FULL_ROUTE_ORDER : MAIN_STORY_ORDER).map(stepOf);
}

/** The endpoint's deploy count: the top of its range on the run's difficulty (Lunatic+ reads Lunatic's). */
function endpointOf(step: MapOrderStep, run: Run): Endpoint {
  const d = run.roster.run.difficulty;
  const conditions = byId.get(step.map)!.conditions;
  const text = conditions[(d === 'lunatic-plus' || !d ? 'lunatic' : d) as ChapterDifficulty]?.deploy ?? conditions.lunatic?.deploy ?? '';
  return { ...step, deploy: deployMax(text) };
}

/**
 * The map order still to play (#179): the template after the latest recorded story map (the story is played in order,
 * so it anchors the place; entries off the template, such as a skirmish, are passed over), without the paralogues and
 * xenologues already played, in or out of order. A fixed map skipped behind that point is dropped; a child paralogue
 * skipped behind it stays, first, since the plan may still place it. A recorded map fills the earliest unplayed place
 * with its id, so a second Apotheosis is its secret route.
 */
export function remainingMapOrder(run: Run): MapOrder {
  const route: Route = run.roster.run.route ?? 'main-story';
  const template = routeMapOrder(route);
  const played = new Set<number>();
  let last = -1;
  for (const e of run.entries) {
    const i = template.findIndex((s, k) => s.map === e.map && !played.has(k));
    if (i < 0) continue;
    played.add(i);
    if (byId.get(template[i]!.map)!.kind === 'story') last = Math.max(last, i);
  }
  const open = (s: MapOrderStep, k: number) => !played.has(k);
  const skipped = template.filter((s, k) => k < last && s.movable && open(s, k));
  const ahead = template.filter((s, k) => k > last && open(s, k));
  return { route, steps: [...skipped, ...ahead], endpoint: endpointOf(template[template.length - 1]!, run) };
}
