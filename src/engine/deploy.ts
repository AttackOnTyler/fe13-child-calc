/**
 * Deployment, pairs and loadouts for the next map (#121). Starting from each unit's deployment role (army fit's for
 * children, the roster's tag for first-gen units and Robin), the solver fills the map's deploy count: forced units,
 * then lead + back pairs by how well they cover the map's foes, then Staff/Rally and dancer units, then whoever is left
 * while there is room (#133). Each deployed unit gets a loadout from its inventory and the convoy. Pure: the caller
 * resolves roles, fighters and foes.
 */
import type { DeploymentRole } from '../curated/deployment';
import { unitNamed, type HeldItem } from './run';
import { MAPS } from '../game-data/chapters';
import { bestWeapon, matchup, type Fighter, type Foe, type SupportLevel } from './solver';
import { deploymentOf, type DeployableUnit, type Roster, type RosterUnit } from './roster';
import type { RoleAssignment } from './army-fit';
import { CHILD_UNITS, type ChildId } from '../game-data/children';
import { itemByName, type GameItem } from '../game-data/items';

/** A unit the solver can deploy: its role, fighter, weapons and supports. */
export type DeployCandidate = {
  readonly unit: RosterUnit;
  readonly role: DeploymentRole;
  readonly fighter: Fighter;
  readonly weapons: readonly NonNullable<Fighter['weapon']>[];
  readonly supports: readonly { readonly partner: RosterUnit; readonly rank: SupportLevel }[];
};

export type Pair = { readonly lead: RosterUnit; readonly back: RosterUnit | undefined; readonly support: SupportLevel | null; readonly coverage: number };

export type Deployment = {
  readonly max: number;
  readonly deployed: readonly RosterUnit[];
  readonly pairs: readonly Pair[];
  /** Deployed but not in a pair (Staff/Rally, dancer, a forced unit left over). */
  readonly solo: readonly RosterUnit[];
  /** The forced units deployed: the player can't drop them. */
  readonly forced: readonly RosterUnit[];
};

/** The deploy count at the map's start: the top of FEW's range (`1–13+1 (Upon …)` → 13, `4+2 (…)` → 4). */
export function deployMax(text: string): number {
  const m = (text ?? '').match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
  return m ? Number(m[2] ?? m[1]) : 0;
}

/**
 * The deploy count with the map's opening recruits (#131): the start count, plus each `+N (Upon X arriving)` that names
 * a recruit on the map from turn 1 (Chapter 3's Sumia). Opening recruits it doesn't name fill the start count (the
 * Prologue's four, Chapter 2's Stahl and Vaike).
 */
export function deployCount(text: string, opening: readonly string[]): number {
  let n = deployMax(text);
  for (const m of (text ?? '').matchAll(/\+(\d+) \(Upon ([^)]*) arriving\)/g)) if (opening.some((name) => m[2]!.includes(name))) n += Number(m[1]);
  return n;
}

/** A map's forced units as roster units (#132): Chrom nearly everywhere, Robin on Chapter 23 alone. */
export const forcedOn = (map: string): RosterUnit[] => (MAPS.find((m) => m.id === map)?.forced ?? []).flatMap((n) => unitNamed(n) ?? []);

/**
 * How well a unit covers the foes, as lead with this back: for each foe, 2 when one round kills it, 1 more when the
 * unit survives its worst round, weighted by how many there are.
 */
export function coverage(c: DeployCandidate, back: DeployCandidate | undefined, support: SupportLevel | null, foes: readonly Foe[], pool: (f: Foe) => readonly string[]): number {
  let score = 0;
  for (const foe of foes) {
    const best = c.weapons.length ? bestWeapon(c.fighter, c.weapons, back?.fighter, support, foe, pool(foe)) : undefined;
    const m = best?.result ?? matchup(c.fighter, back?.fighter, support, foe, pool(foe));
    score += ((m.oneRounds || m.oneRoundsWithDualStrikes ? 2 : 0) + (m.survives ? 1 : 0)) * (foe.boss ? 3 : foe.count);
  }
  return score;
}

/**
 * The suggested deployment: forced units always; then pairs, each lead (lead role, best coverage first) with the
 * battery (or else any unit) that raises its coverage most; then Staff/Rally and dancers; then, while room remains,
 * the best-covering unit left leads whatever its role (#133); within the deploy count. `pinned` pairs (the player's
 * edits) are kept as given, but a back an earlier pin already took leaves the later lead alone. A forced unit can't be
 * `excluded`.
 */
export function suggestDeployment(input: {
  readonly candidates: readonly DeployCandidate[];
  readonly forced: readonly RosterUnit[];
  readonly max: number;
  readonly foes: readonly Foe[];
  readonly pool: (f: Foe) => readonly string[];
  readonly pinned?: readonly { readonly lead: RosterUnit; readonly back: RosterUnit | undefined }[];
  readonly excluded?: ReadonlySet<RosterUnit>;
}): Deployment {
  const { foes, pool } = input;
  const byId = new Map(input.candidates.filter((c) => !input.excluded?.has(c.unit) || input.forced.includes(c.unit)).map((c) => [c.unit, c]));
  const deployed: RosterUnit[] = [];
  const room = () => input.max - deployed.length;
  const take = (u: RosterUnit) => {
    if (!deployed.includes(u)) deployed.push(u);
  };
  for (const u of input.forced) if (byId.has(u)) take(u);
  const rankOf = (a: DeployCandidate, b: RosterUnit) => a.supports.find((s) => s.partner === b)?.rank ?? null;
  const pairs: Pair[] = [];
  const paired = new Set<RosterUnit>();
  const addPair = (lead: DeployCandidate, back: DeployCandidate | undefined) => {
    const support = back ? rankOf(lead, back.unit) : null;
    pairs.push({ lead: lead.unit, back: back?.unit, support, coverage: coverage(lead, back, support, foes, pool) });
    paired.add(lead.unit);
    if (back) paired.add(back.unit);
    take(lead.unit);
    if (back) take(back.unit);
  };
  /** The slots deploying a unit costs: none once it's deployed. */
  const slotCost = (c: DeployCandidate) => (deployed.includes(c.unit) ? 0 : 1);
  for (const p of input.pinned ?? []) {
    const lead = byId.get(p.lead);
    const back = p.back && !paired.has(p.back) ? byId.get(p.back) : undefined;
    if (lead && !paired.has(p.lead) && room() >= slotCost(lead) + (back ? slotCost(back) : 0)) addPair(lead, back);
  }
  const solo = (c: DeployCandidate) => coverage(c, undefined, null, foes, pool);
  /**
   * Deploys `lead` in a pair, with the battery (or else any unit but a dancer) that raises its coverage most among
   * those the room allows: one already deployed alone costs no slot.
   */
  const pairUp = (lead: DeployCandidate) => {
    const backs = [...byId.values()].filter((c) => c.unit !== lead.unit && !paired.has(c.unit) && c.role !== 'dancer');
    const pool2 = backs.some((c) => c.role === 'battery') ? backs.filter((c) => c.role === 'battery') : backs;
    let best: { back: DeployCandidate | undefined; score: number } = { back: undefined, score: solo(lead) };
    for (const back of pool2) {
      if (room() < slotCost(lead) + slotCost(back)) continue;
      const score = coverage(lead, back, rankOf(lead, back.unit), foes, pool);
      if (score > best.score || (!best.back && score === best.score)) best = { back, score };
    }
    addPair(lead, best.back);
  };
  const leads = [...byId.values()].filter((c) => c.role === 'lead' && !paired.has(c.unit)).sort((a, b) => solo(b) - solo(a));
  // Forced units lead first, so Chrom (every story map) is paired rather than left alone.
  leads.sort((a, b) => Number(input.forced.includes(b.unit)) - Number(input.forced.includes(a.unit)));
  for (const lead of leads) {
    if (room() < slotCost(lead)) break;
    // A lead another lead took as its back is already in a pair.
    if (!paired.has(lead.unit)) pairUp(lead);
  }
  const extras = [...byId.values()].filter((c) => !deployed.includes(c.unit) && (c.role === 'staff' || c.role === 'dancer'));
  for (const c of extras) if (room() > 0) take(c.unit);
  // Room left with too few leads (#133): the best-covering unit left leads, whatever its role, and takes a back if it can.
  const waiting = [...byId.values()].filter((c) => !deployed.includes(c.unit)).sort((a, b) => solo(b) - solo(a));
  for (const c of waiting) if (room() > 0 && !deployed.includes(c.unit)) pairUp(c);
  return {
    max: input.max,
    deployed: deployed.slice(0, Math.max(input.max, input.forced.length)),
    pairs,
    solo: deployed.filter((u) => !paired.has(u)),
    forced: input.forced.filter((u) => byId.has(u)),
  };
}

export type Loadout = { readonly unit: RosterUnit; readonly items: readonly { readonly item: string; readonly from: 'inventory' | 'convoy'; readonly foes: number }[] };

const WEAPON_KINDS = new Set(['sword', 'lance', 'axe', 'bow', 'tome', 'stone', 'beaststone']);

/**
 * A unit's loadout for the map (#121): the weapons that give its best matchups, from its inventory and from convoy
 * weapons of a kind it already carries (so it can wield them), most useful first, then its other items; at most 5.
 */
export function suggestLoadout(c: DeployCandidate, back: DeployCandidate | undefined, inventory: readonly HeldItem[], convoy: readonly HeldItem[], foes: readonly Foe[], pool: (f: Foe) => readonly string[]): Loadout {
  const kinds = new Set(c.weapons.map((w) => w.item.kind));
  const fromConvoy = convoy.flatMap((hi) => {
    const it = itemByName(hi.item);
    return it && WEAPON_KINDS.has(it.kind) && kinds.has(it.kind) ? [{ item: it, ...(hi.forge ? { forge: hi.forge } : {}) }] : [];
  });
  const all = [...c.weapons.map((w) => ({ w, from: 'inventory' as const })), ...fromConvoy.map((w) => ({ w, from: 'convoy' as const }))];
  const uses = new Map<string, { from: 'inventory' | 'convoy'; foes: number }>();
  const support = back ? (c.supports.find((s) => s.partner === back.unit)?.rank ?? null) : null;
  for (const foe of foes) {
    const best = all.length ? bestWeapon(c.fighter, all.map((x) => x.w), back?.fighter, support, foe, pool(foe)) : undefined;
    const name = best?.weapon?.item.name;
    if (!name) continue;
    const from = all.find((x) => x.w.item.name === name)!.from;
    const cur = uses.get(name) ?? { from, foes: 0 };
    uses.set(name, { from: cur.from === 'inventory' ? 'inventory' : from, foes: cur.foes + (foe.boss ? 1 : foe.count) });
  }
  const weapons = [...uses.entries()].sort((a, b) => b[1].foes - a[1].foes).map(([item, u]) => ({ item, ...u }));
  // Keep its non-weapon items (Vulneraries, staves) after the weapons.
  const others = inventory.filter((hi) => {
    const it: GameItem | undefined = itemByName(hi.item);
    return !(it && WEAPON_KINDS.has(it.kind));
  });
  const items = [...weapons, ...others.map((hi) => ({ item: hi.item, from: 'inventory' as const, foes: 0 }))].slice(0, 5);
  return { unit: c.unit, items };
}

/**
 * A unit's deployment role for the solver: army fit's for a child (its derived role, or where a quota moved it), the
 * roster's tag for a first-gen unit and Robin; a child out of the cast leads.
 */
export function deployRoleOf(unit: RosterUnit, roster: Roster, roles: ReadonlyMap<ChildId, RoleAssignment>): DeploymentRole {
  if (unit in CHILD_UNITS) return roles.get(unit as ChildId)?.role ?? 'lead';
  return deploymentOf(roster, unit as DeployableUnit).role;
}
