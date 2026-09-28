/**
 * In-play checks (#209; spec #175, In-play checks and stated assumptions). The open game rules no source settles
 * (the checklist on #150 with the tome-miss check, and every assumption in the registry that play can settle), each
 * a stated assumption on its **best reading** until play checks it:
 *
 * - each rule carries **stakes**: the flawless points that turn on it, from one re-run of the plan under its other
 *   reading (`ruleStakes` on the facade; a rule the model doesn't read has none). Stakes order the checks;
 * - a **free check** is listed when the roadmap already sets up the rule's situation on a map (`setsUp`, per rule, from
 *   the map's lineup, the plan's seals, items and children, and the army's kit); a **setup check** is offered as a
 *   costed edit when the stakes pass about 1 point and no map left sets it up (`SETUP_STAKES`); low stakes are only
 *   ever free;
 * - a rule that needs EXP gain (`exp`) reads a map's lineup less its map-only setups, which gain none (the
 *   Premonition's Lv 20 Chrom and Robin, #243): no check or setup edit leans on them;
 * - Record results takes the **raw observation** (a number, yes or no, or "didn't happen") and `settleCheck` works out
 *   the reading: the best makes a **checked rule**; the other switches the model at once (the answer is the
 *   assumption's value, which the model reads); neither keeps the rule open, marked unexpected, and a second observation
 *   agreeing with the unexpected value makes a **model mismatch** (a stated blind spot; forecasts keep the best reading);
 * - any rule can be answered by hand ("from outside this run", `answerRule`) or reopened (`reopenRule`).
 *
 * Checked rules are global (`checked-rules:v1`, the UI's store): they outlive the run and Clear all. Everything here is
 * pure; the facade adds what simulates.
 */
import { STAT_BOOSTERS, TONICS, itemByName } from '../game-data/items';
import { CLASS_SKILLS, RALLY_SKILLS } from '../game-data/skills';
import { classIdByName } from './supply';
import { ASSUMPTION_REGISTRY, type AssumptionId } from './assumptions';
import type { Milestone } from './milestones';
import { unitName, type RosterUnit } from './roster';
import { mapOnlyUnits, type Run, type Snapshot } from './run';
import type { Plan, PlanLineup } from './solve/plan';
import { MAPS } from '../game-data/chapters';
import { routeMapOrder } from './map-order';

// ---- checked rules (the store's shape) -----------------------------------------------------------------------------

export type RuleEvidence = {
  /** The run it came from, in words (its Run facts). */
  readonly run?: string;
  /** The map it was seen on, or the latest recorded map when answered by hand. */
  readonly map?: string;
};

export type RuleAnswer = {
  /** The reading the model uses: the assumption's value (for a rule the model doesn't read, the reading's own value). */
  readonly value: unknown;
  /** Answered by hand, or settled by an in-play check. */
  readonly how: 'hand' | 'check';
  readonly evidence?: RuleEvidence;
  /** When (epoch ms). */
  readonly at?: number;
};

/** A rule play contradicted twice with the same value, matching neither reading. */
export type ModelMismatch = { readonly rule: string; readonly evidence: readonly RuleEvidence[]; readonly at?: number; readonly value?: number | boolean };

/** An observation that matched neither reading, once: the rule stays open, marked unexpected. */
export type UnexpectedObservation = { readonly rule: string; readonly value: number | boolean; readonly evidence?: RuleEvidence; readonly at?: number };

export type CheckedRules = {
  /** By rule id (an assumption's id for a rule the model reads). */
  readonly answers: Readonly<Record<string, RuleAnswer>>;
  readonly mismatches: readonly ModelMismatch[];
  readonly unexpected?: readonly UnexpectedObservation[];
};

export const EMPTY_CHECKED_RULES: CheckedRules = { answers: {}, mismatches: [] };

// ---- the open rules -------------------------------------------------------------------------------------------------

/** A raw observation: a number (EXP, uses), yes or no, or the situation didn't happen. */
export type Observation = number | boolean | 'didnt-happen';

export type RuleReading = { readonly label: string; readonly value: unknown };

/**
 * What a check asks. `number`: the values each reading predicts (`'more'`: anything above 0); `yes-no`: the answer
 * the best reading predicts (the other predicts the opposite).
 */
export type CheckAsk =
  | { readonly kind: 'number'; readonly question: string; readonly best: readonly number[]; readonly other: readonly number[] | 'more' }
  | { readonly kind: 'yes-no'; readonly question: string; readonly best: boolean };

/** What a rule's situation reads on one map. */
export type SetupContext = {
  readonly run: Run;
  readonly plan: Plan;
  /** The map's key on the map order, and its map id. */
  readonly key: string;
  readonly map: string;
  /** The map's lineup; undefined when not worked out. */
  readonly lineup: PlanLineup | undefined;
  /** The lineup of the map before it on the roadmap (the same pair again), when known. */
  readonly before: PlanLineup | undefined;
  /** The army as the latest entry leaves it (after shopping). */
  readonly snapshot: Snapshot;
  readonly milestones: readonly Milestone[];
  /** A unit's name. */
  readonly name: (u: RosterUnit | 'maiden') => string;
};

export type OpenRule = {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  /** The assumption the model reads it through; absent: the model doesn't read it (its stakes are none). */
  readonly assumption?: AssumptionId;
  readonly best: RuleReading;
  readonly other: RuleReading;
  readonly ask: CheckAsk;
  /**
   * Whether it touches EXP: a learned correction beyond range on a unit it touches names it. A rule with one needs EXP
   * gain, so it never reads a map-only setup (`earning`).
   */
  readonly exp?: (unit: RosterUnit, run: Run, plan: Plan | undefined) => boolean;
  /** The check on a map whose roadmap sets up the situation, in words; undefined where it doesn't. */
  readonly setsUp?: (c: SetupContext) => string | undefined;
  /** The one edit that sets it up on a map left (a setup check), where one does. */
  readonly setup?: (plan: Plan, lineups: readonly PlanLineup[], run: Run) => { readonly label: string; readonly plan: Plan } | undefined;
};

const fromRegistry = (id: AssumptionId): Pick<OpenRule, 'label' | 'why' | 'assumption' | 'best' | 'other'> => {
  const d = ASSUMPTION_REGISTRY[id];
  const fmt = d.format as (v: unknown) => string;
  return { label: d.label, why: d.why, assumption: id, best: { label: fmt(d.default), value: d.default }, other: { label: d.alternatives[0]!.label, value: d.alternatives[0]!.value } };
};

const pairsOf = (l: PlanLineup | undefined) => (l ? l.pairs.filter((p): p is { lead: RosterUnit; back: RosterUnit } => !!p.back) : []);
const fielded = (l: PlanLineup | undefined): RosterUnit[] => (l ? [...l.pairs.flatMap((p) => [p.lead, ...(p.back ? [p.back] : [])]), ...l.solo] : []);
const isRallyName = (s: string) => /^Rally /.test(s);
/**
 * Whether a unit can Rally on the map (#251): it holds a Rally skill, or its class teaches one at its level or below.
 * The plan's build doesn't count: a skill it learns later can't be used here.
 */
const canRally = (c: Pick<SetupContext, 'snapshot'>, u: RosterUnit): boolean => {
  const unit = c.snapshot.units[u];
  if (!unit) return false;
  if (unit.skills.some(isRallyName)) return true;
  const cls = classIdByName(unit.class);
  const rallies: readonly string[] = RALLY_SKILLS;
  return !!cls && CLASS_SKILLS[cls].some((x) => rallies.includes(x.skill) && x.level <= unit.level);
};
const classChanged = (run: Run, u: RosterUnit) => run.entries.some((e) => (e.classChanges ?? []).some((c) => c.unit === u));
const backs = (plan: Plan | undefined, u: RosterUnit) =>
  !!plan && (plan.wishlist.units.some((w) => w.unit === u && w.position === 'back') || plan.roadmap.lineups.some((l) => l.pairs.some((p) => p.back === u)));

/** A couple the plan marries (still to marry): each once. */
const couples = (plan: Plan, snapshot: Snapshot) =>
  plan.wishlist.marriages.filter(([a, b]) => !(snapshot.spouses[a]?.bond === 'married' && snapshot.spouses[a]?.partner === b));

/** The lineup with `back` behind `lead` (both fielded): their old partners left alone. */
function paired(l: PlanLineup, lead: RosterUnit, back: RosterUnit): PlanLineup {
  const loose: RosterUnit[] = [];
  const pairs: { lead: RosterUnit; back?: RosterUnit }[] = [];
  for (const p of l.pairs) {
    const members = [p.lead, ...(p.back ? [p.back] : [])];
    if (!members.includes(lead) && !members.includes(back)) pairs.push(p);
    else loose.push(...members.filter((u) => u !== lead && u !== back));
  }
  return { key: l.key, pairs: [...pairs, { lead, back }], solo: [...l.solo.filter((u) => u !== lead && u !== back), ...loose] };
}

const withLineup = (plan: Plan, l: PlanLineup): Plan => ({ ...plan, roadmap: { ...plan.roadmap, lineups: [...plan.roadmap.lineups.filter((x) => x.key !== l.key), l] } });

/**
 * A lineup less the units that gain no EXP on its map (its map-only setups, #243): a pair loses them, and a partner
 * left alone leads. Unchanged on a map with none.
 */
function earning(l: PlanLineup, map: string): PlanLineup {
  const none = new Set(mapOnlyUnits(map));
  if (!none.size) return l;
  const pairs = l.pairs.flatMap((p) => {
    const [lead, back] = [p.lead, p.back].filter((u): u is RosterUnit => !!u && !none.has(u));
    return lead ? [back ? { lead, back } : { lead }] : [];
  });
  return { key: l.key, pairs, solo: l.solo.filter((u) => !none.has(u)) };
}

/** The context a rule reads: a rule that needs EXP gain sees the lineup less the units that gain none there. */
const contextFor = (rule: OpenRule, c: SetupContext): SetupContext => (rule.exp && c.lineup ? { ...c, lineup: earning(c.lineup, c.map) } : c);

/** Whether the roadmap sets up a rule's situation on a map (a free check there). */
export const setsUpOn = (rule: OpenRule, c: SetupContext): boolean => !!rule.setsUp?.(contextFor(rule, c));

/**
 * The open rules, in no order (stakes order them): #150's checklist, the tome-miss check, and the registry's other
 * assumptions play can settle.
 */
export const OPEN_RULES: readonly OpenRule[] = [
  {
    id: 'rally-exp',
    label: 'Rally’s EXP',
    why: 'No source gives Rally any EXP: FEW lists combat, staves and Dance for Awakening and nothing for Rally (research G1). The runs give it none.',
    best: { label: 'None', value: 'none' },
    other: { label: 'Some EXP', value: 'some' },
    ask: { kind: 'number', question: 'EXP from one Rally (0 if no EXP bar appears)', best: [0], other: 'more' },
    exp: (u, run) => (run.entries[run.entries.length - 1]?.snapshot.units[u]?.skills ?? []).some(isRallyName),
    setsUp: (c) => {
      const u = fielded(c.lineup).find((x) => canRally(c, x));
      return u && `${c.name(u)} can Rally: Rally once and note the EXP it gives (0 if no EXP bar appears).`;
    },
  },
  {
    id: 'back-without-dual-strike',
    label: 'The back’s EXP with no Dual Strike',
    why: 'A back earns EXP only from its own Dual Strikes that deal damage: three low-trust sources agree, and SF’s formula doesn’t state it (research G3). The runs give a back nothing without one.',
    best: { label: 'Nothing', value: 'nothing' },
    other: { label: 'Some EXP anyway', value: 'some' },
    ask: { kind: 'yes-no', question: 'Did the back gain any EXP?', best: false },
    exp: (u, _run, plan) => backs(plan, u),
    setsUp: (c) => {
      const p = pairsOf(c.lineup)[0];
      return p && `${c.name(p.lead)} + ${c.name(p.back)}: in a combat where ${c.name(p.back)} doesn’t Dual Strike (or strikes for 0), note whether ${c.name(p.back)} gains any EXP.`;
    },
  },
  {
    id: 'back-kill-lead-exp',
    label: 'The lead’s EXP when the back lands the kill',
    why: 'SF gives the back its damage EXP when its Dual Strike kills, and is silent on the lead; one 2012 comment says the lead still gets its EXP (research G2). The runs give the lead the kill.',
    best: { label: 'The lead still gains EXP', value: 'lead-gains' },
    other: { label: 'The lead gains nothing', value: 'lead-nothing' },
    ask: { kind: 'yes-no', question: 'Did the lead still gain EXP?', best: true },
    exp: (u, _run, plan) => !!plan && plan.roadmap.lineups.some((l) => l.pairs.some((p) => p.lead === u && p.back)),
    setsUp: (c) => {
      const p = pairsOf(c.lineup)[0];
      return p && `${c.name(p.lead)} + ${c.name(p.back)}: if ${c.name(p.back)}’s Dual Strike lands a kill, note whether ${c.name(p.lead)} still gains EXP.`;
    },
  },
  {
    id: 'veteran-as-back',
    ...fromRegistry('veteran-as-back'),
    ask: { kind: 'number', question: 'Robin’s EXP from that Dual Strike', best: [5], other: [7] },
    exp: (u) => u === 'robin',
    setsUp: (c) => {
      const p = pairsOf(c.lineup).find((x) => x.back === 'robin');
      return p && `Robin backs ${c.name(p.lead)}: after a Dual Strike of Robin’s that deals damage but doesn’t kill, on a foe of Robin’s level and tier, note Robin’s EXP (5: Veteran counts only leading; 7: it counts paired).`;
    },
    setup: (plan, lineups, run) => {
      for (const l of lineups) {
        const all = fielded(l);
        if (!all.includes('robin') || pairsOf(l).some((p) => p.back === 'robin')) continue;
        const lead = l.pairs.find((p) => p.lead === 'robin')?.back ?? l.pairs.find((p) => !p.back && p.lead !== 'robin')?.lead ?? l.solo.find((u) => u !== 'robin');
        if (lead) return { label: `Robin backs ${nameIn(run)(lead)} on ${keyLabel(run, l.key)}`, plan: withLineup(plan, paired(l, lead, 'robin')) };
      }
      return undefined;
    },
  },
  {
    id: 'seal-exp-bar',
    ...fromRegistry('seal-exp-bar'),
    ask: { kind: 'yes-no', question: 'Was the EXP bar kept through the seal?', best: false },
    exp: (u, run) => classChanged(run, u),
    setsUp: (c) => {
      const s = c.plan.roadmap.seals.find((x) => x.key === c.key);
      return s && `${c.name(s.unit)} changes class before this map (${s.seal === 'master' ? 'Master' : 'Second'} Seal): note the EXP bar just before and just after the seal.`;
    },
  },
  {
    id: 'class-change-internal-level',
    ...fromRegistry('class-change-internal-level'),
    ask: { kind: 'number', question: 'EXP from that first kill', best: [14], other: [30] },
    exp: (u, run) => classChanged(run, u),
    setsUp: (c) => {
      const s = c.plan.roadmap.seals.find((x) => x.key === c.key && x.seal === 'master' && (c.snapshot.units[x.unit]?.level ?? 0) <= 10 && !c.snapshot.units[x.unit]?.promoted);
      return (
        s &&
        `${c.name(s.unit)} is promoted for this map: use the Master Seal at Lv 10, then have the fresh Lv 1 kill a Lv 11 base-class foe with no class bonus, unpaired, on its first engagement, and note the EXP (14: the research’s formula; 30: +1 per class change).`
      );
    },
  },
  {
    id: 'deadlord-boss-bonus',
    ...fromRegistry('deadlord-boss-bonus'),
    ask: { kind: 'yes-no', question: 'Did the kill EXP include the boss +20 on top of the Deadlord’s +20?', best: false },
    exp: (_u, run) => run.entries.some((e) => e.map === 'chapter-22' || e.map === 'infinite-regalia'),
    setsUp: (c) => (c.map === 'chapter-22' || c.map === 'infinite-regalia' ? 'Deadlords are on this map: note the kill EXP for one, with the killer’s level.' : undefined),
  },
  {
    id: 'support-past-threshold',
    ...fromRegistry('support-past-threshold'),
    ask: { kind: 'yes-no', question: 'Did the next rank’s conversation become available before the first was viewed?', best: false },
    setsUp: (c) => {
      const p = pairsOf(c.lineup).find((x) => couples(c.plan, c.snapshot).some(([a, b]) => (a === x.lead && b === x.back) || (a === x.back && b === x.lead)));
      return (
        p &&
        `${c.name(p.lead)} + ${c.name(p.back)} fight paired: if they reach a new rank mid-map, keep them fighting together for the rest of it, and note whether the next rank’s conversation becomes available before the first is viewed.`
      );
    },
    setup: (plan, lineups, run) => {
      const snap = run.entries[run.entries.length - 1]?.snapshot;
      for (const l of lineups) {
        const on = new Set(fielded(l));
        for (const [a, b] of snap ? couples(plan, snap) : plan.wishlist.marriages) {
          if (!on.has(a) || !on.has(b)) continue;
          if (l.pairs.some((p) => (p.lead === a && p.back === b) || (p.lead === b && p.back === a))) return undefined;
          return { label: `${nameIn(run)(a)} and ${nameIn(run)(b)} paired on ${keyLabel(run, l.key)}`, plan: withLineup(plan, paired(l, a, b)) };
        }
      }
      return undefined;
    },
  },
  {
    id: 'pair-up-back-level',
    label: 'The back’s level in the pair-up bonus',
    why: 'The pair-up bonus is taken from the back’s class and the pair’s support rank; whether the back’s level in its class adds to it isn’t stated (#145). The combat math reads class and rank only.',
    best: { label: 'No: class and support rank only', value: 'no' },
    other: { label: 'Yes: the back’s level adds', value: 'yes' },
    ask: { kind: 'yes-no', question: 'Did the lead’s shown bonus change with the back’s level?', best: false },
    setsUp: (c) => {
      const p = pairsOf(c.lineup).find((x) => pairsOf(c.before).some((y) => y.lead === x.lead && y.back === x.back));
      return (
        p &&
        `${c.name(p.lead)} + ${c.name(p.back)} pair again: with ${c.name(p.back)} a level or more higher in the same class and the same support rank, compare ${c.name(p.lead)}’s shown pair-up bonus with last map’s.`
      );
    },
  },
  {
    id: 'attack-stance-supports',
    label: 'Supports from Attack Stance',
    why: 'Standing next to each other earns no support points (research/support-growth), but no source settles Dual Strikes from adjacent tiles; the runs grow supports only from combats paired.',
    best: { label: 'Nothing grows', value: 'no' },
    other: { label: 'Their support grows', value: 'yes' },
    ask: { kind: 'yes-no', question: 'Did their support grow (a new conversation) from Attack Stance alone?', best: false },
  },
  {
    id: 'parent-skill-swap',
    label: 'A parent’s skills after paralogue entry',
    why: 'The inheritance is taken on entering the child’s paralogue (the JP 2ch wiki), so the passed skill doesn’t cost the parent a slot on the map; changing the parent’s skills in its preparations is taken not to change it (#144).',
    best: { label: 'No: taken at entry', value: 'at-entry' },
    other: { label: 'Yes: the skills at the map’s end count', value: 'later' },
    ask: { kind: 'yes-no', question: 'Did changing the parent’s skills after entry change what the child inherits?', best: false },
    setsUp: (c) => {
      const r = c.milestones.find((m) => m.kind === 'recruit' && m.at.key === c.key);
      const w = r && r.kind === 'recruit' ? c.plan.wishlist.children.find((x) => x.child === r.child && x.passes.some((s) => s !== null)) : undefined;
      if (!w) return undefined;
      const k = w.passes.findIndex((s) => s !== null);
      const parent = w.parents[k]!;
      return `On entering this paralogue, change ${c.name(parent)}’s skills in the preparations, and note whether ${c.name(w.child)} inherits something else.`;
    },
  },
  {
    id: 'booster-to-child',
    ...fromRegistry('booster-to-child'),
    ask: { kind: 'yes-no', question: 'Did the child’s join stat count the parent’s booster?', best: true },
    setsUp: (c) => {
      const r = c.milestones.find((m) => m.kind === 'recruit' && m.at.key === c.key);
      if (!r || r.kind !== 'recruit') return undefined;
      const order = c.plan.roadmap.order;
      const here = order.indexOf(c.key);
      const drunk = c.plan.roadmap.items.find((i) => r.parents.includes(i.unit) && i.item in STAT_BOOSTERS && order.indexOf(i.key) <= here);
      return drunk && `${c.name(drunk.unit)} drank ${drunk.item} before this paralogue: compare ${c.name(r.child)}’s join stat with the prediction with and without it.`;
    },
  },
  {
    id: 'booster-at-cap',
    ...fromRegistry('booster-at-cap'),
    ask: { kind: 'yes-no', question: 'Was the booster used up?', best: true },
  },
  {
    id: 'tonic-stacking',
    ...fromRegistry('tonic-stacking'),
    ask: { kind: 'yes-no', question: 'Did the second tonic add again?', best: false },
  },
  {
    id: 'item-in-preparations',
    ...fromRegistry('item-in-preparations'),
    ask: { kind: 'yes-no', question: 'Could the unit still act on turn 1?', best: true },
    setsUp: (c) => {
      const i = c.plan.roadmap.items.find((x) => x.key === c.key && (x.item in STAT_BOOSTERS || x.item in TONICS));
      return i && `${c.name(i.unit)} uses ${i.item} from the preparations item menu: note whether ${c.name(i.unit)} can still act on turn 1.`;
    },
  },
  {
    id: 'over-cap-reclass',
    label: 'Stats over the cap on a reclass',
    why: 'Reclassing a unit whose stat sits above the new class’s cap: secondary sources say the excess is held until a class with a higher cap (#166). The runs keep stats within each class’s caps.',
    best: { label: 'Held for a higher cap', value: 'held' },
    other: { label: 'Cut for good', value: 'cut' },
    ask: { kind: 'yes-no', question: 'Did the excess come back in a class with a higher cap?', best: true },
  },
  {
    id: 'boss-drop-npc',
    label: 'A boss’s drop when an NPC kills it',
    why: 'A boss’s drop is taken to need a player unit to land the kill (#166); the runs play no NPC kills.',
    best: { label: 'Lost: a player unit must land the kill', value: 'lost' },
    other: { label: 'Kept', value: 'kept' },
    ask: { kind: 'yes-no', question: 'Was the drop lost?', best: true },
  },
  {
    id: 'tome-miss-use',
    ...fromRegistry('tome-miss-use'),
    ask: { kind: 'number', question: 'Uses the tome lost on the miss', best: [1], other: [0] },
    setsUp: (c) => {
      for (const u of fielded(c.lineup)) {
        const tome = c.snapshot.units[u]?.inventory.find((h) => itemByName(h.item)?.kind === 'tome');
        if (tome) return `${c.name(u)} carries ${tome.item}: note its uses before and after a combat where it misses.`;
      }
      return undefined;
    },
  },
  {
    id: 'chrom-wedding-lost-candidate',
    ...fromRegistry('chrom-wedding-lost-candidate'),
    ask: { kind: 'yes-no', question: 'Did the game still marry Chrom to the lost candidate?', best: true },
  },
];

const BY_ID = new Map(OPEN_RULES.map((r) => [r.id, r]));
export const openRule = (id: string): OpenRule | undefined => BY_ID.get(id);

// ---- readings and settlement ----------------------------------------------------------------------------------------

/** Which reading an observation supports: the best, the other, neither; undefined when the situation didn't happen. */
export function readingOf(rule: OpenRule, observed: Observation): 'best' | 'other' | 'neither' | undefined {
  if (observed === 'didnt-happen') return undefined;
  const a = rule.ask;
  if (a.kind === 'yes-no') return typeof observed === 'boolean' ? (observed === a.best ? 'best' : 'other') : 'neither';
  if (typeof observed !== 'number') return 'neither';
  if (a.best.includes(observed)) return 'best';
  if (a.other === 'more' ? observed > 0 : a.other.includes(observed)) return 'other';
  return 'neither';
}

/** Where a rule stands: open, settled by a check or by hand (on the best or the other reading), or a model mismatch. */
export type RuleState = 'open' | 'checked' | 'answered' | 'mismatch';

export type RuleStatus = {
  readonly rule: OpenRule;
  readonly state: RuleState;
  /** The reading the model uses now. */
  readonly reading: 'best' | 'other';
  readonly answer?: RuleAnswer;
  /** Observations that matched neither reading (the rule is marked unexpected). */
  readonly unexpected: readonly UnexpectedObservation[];
  readonly mismatch?: ModelMismatch;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Every open rule's status under the checked rules. */
export function ruleStatuses(rules: CheckedRules): RuleStatus[] {
  return OPEN_RULES.map((rule) => {
    const answer = rules.answers[rule.id];
    const unexpected = (rules.unexpected ?? []).filter((u) => u.rule === rule.id);
    const mismatch = rules.mismatches.find((m) => m.rule === rule.id);
    const reading = answer && same(answer.value, rule.other.value) ? 'other' : 'best';
    const state: RuleState = answer ? (answer.how === 'check' ? 'checked' : 'answered') : mismatch ? 'mismatch' : 'open';
    return { rule, state, reading, ...(answer ? { answer } : {}), unexpected, ...(mismatch ? { mismatch } : {}) };
  });
}

/** What a settled observation did. */
export type CheckOutcome = 'checked' | 'switched' | 'unexpected' | 'mismatch' | 'none';

const without = <T extends { readonly rule: string }>(xs: readonly T[] | undefined, id: string) => (xs ?? []).filter((x) => x.rule !== id);
const withEvidence = (e: RuleEvidence | undefined) => (e ? { evidence: e } : {});

/**
 * The checked rules after an observation (see the module comment): the best reading makes a checked rule, the other
 * switches the model (its answer is the other reading's value), neither keeps it open and unexpected, and the same
 * unexpected value twice makes a model mismatch. "Didn't happen" changes nothing.
 */
export function settleCheck(rules: CheckedRules, id: string, observed: Observation, evidence: RuleEvidence | undefined, now: number): { readonly rules: CheckedRules; readonly outcome: CheckOutcome } {
  const rule = openRule(id);
  const r = rule && readingOf(rule, observed);
  if (!rule || !r || observed === 'didnt-happen') return { rules, outcome: 'none' };
  if (r !== 'neither') {
    const answer: RuleAnswer = { value: (r === 'best' ? rule.best : rule.other).value, how: 'check', ...withEvidence(evidence), at: now };
    const unexpected = without(rules.unexpected, id);
    return {
      rules: { answers: { ...rules.answers, [id]: answer }, mismatches: without(rules.mismatches, id), ...(unexpected.length ? { unexpected } : {}) },
      outcome: r === 'best' ? 'checked' : 'switched',
    };
  }
  const before = (rules.unexpected ?? []).find((u) => u.rule === id && u.value === observed);
  if (before) {
    const unexpected = without(rules.unexpected, id);
    const mismatch: ModelMismatch = { rule: id, evidence: [before.evidence, evidence].filter((e): e is RuleEvidence => !!e), at: now, value: observed };
    return { rules: { answers: rules.answers, mismatches: [...without(rules.mismatches, id), mismatch], ...(unexpected.length ? { unexpected } : {}) }, outcome: 'mismatch' };
  }
  const seen: UnexpectedObservation = { rule: id, value: observed, ...withEvidence(evidence), at: now };
  return { rules: { ...rules, unexpected: [...(rules.unexpected ?? []), seen] }, outcome: 'unexpected' };
}

/** The checked rules with a rule answered by hand ("from outside this run") on a reading. */
export function answerRule(rules: CheckedRules, id: string, reading: 'best' | 'other', evidence: RuleEvidence | undefined, now: number): CheckedRules {
  const rule = openRule(id);
  if (!rule) return rules;
  const unexpected = without(rules.unexpected, id);
  return {
    answers: { ...rules.answers, [id]: { value: rule[reading].value, how: 'hand', ...withEvidence(evidence), at: now } },
    mismatches: without(rules.mismatches, id),
    ...(unexpected.length ? { unexpected } : {}),
  };
}

/** The checked rules with a rule reopened: its answer, unexpected observations and mismatch gone (the best reading again). */
export function reopenRule(rules: CheckedRules, id: string): CheckedRules {
  const { [id]: _, ...answers } = rules.answers;
  const unexpected = without(rules.unexpected, id);
  return { answers, mismatches: without(rules.mismatches, id), ...(unexpected.length ? { unexpected } : {}) };
}

/** Whether the model reads a rule differently under two sets of checked rules (a re-solve is proposed when it does). */
export function modelChanged(before: CheckedRules, after: CheckedRules, id: string): boolean {
  const rule = openRule(id);
  if (!rule?.assumption) return false;
  const value = (r: CheckedRules) => (r.answers[id] ? r.answers[id]!.value : rule.best.value);
  return !same(value(before), value(after));
}

// ---- checks on a map -----------------------------------------------------------------------------------------------

/**
 * A rule's stakes (#209): the flawless points that turn on it, from the plan's runs under its other reading against the
 * same runs under the reading used now (paired, ±95%). `modelled: false`: the model doesn't read the rule (none).
 */
export type RuleStake = { readonly rule: string; readonly gain: number; readonly margin: number; readonly runs: number; readonly modelled: boolean };

/** The stakes above which a check not set up by any map left is offered as a setup check: about 1 point. */
export const SETUP_STAKES = 0.01;

/** A check this map offers (a free check): the rule, what to do and note, what to answer. */
export type MapCheck = {
  readonly rule: string;
  readonly label: string;
  readonly text: string;
  readonly ask: CheckAsk;
  readonly stake?: RuleStake;
};

/** A setup check: a rule worth checking that no map left sets up, with the edit that would (none where no single edit does). */
export type SetupCheck = {
  readonly rule: string;
  readonly label: string;
  readonly stake: RuleStake;
  readonly edit?: { readonly label: string; readonly plan: Plan };
};

const byStakes = (stakes: ReadonlyMap<string, RuleStake>) => (a: { readonly rule: string }, b: { readonly rule: string }) =>
  Math.abs(stakes.get(b.rule)?.gain ?? 0) - Math.abs(stakes.get(a.rule)?.gain ?? 0);

/** The rules still open to a check: open, not a model mismatch. */
const checkable = (rules: CheckedRules) => ruleStatuses(rules).filter((s) => s.state === 'open');

/** The free checks a map offers: each open rule whose situation the roadmap sets up there, by stakes. */
export function freeChecks(c: SetupContext, rules: CheckedRules, stakes: readonly RuleStake[] = []): MapCheck[] {
  const s = new Map(stakes.map((x) => [x.rule, x]));
  return checkable(rules)
    .flatMap(({ rule }): MapCheck[] => {
      const text = rule.setsUp?.(contextFor(rule, c));
      return text ? [{ rule: rule.id, label: rule.label, text, ask: rule.ask, ...(s.has(rule.id) ? { stake: s.get(rule.id)! } : {}) }] : [];
    })
    .sort(byStakes(s));
}

/**
 * The setup checks: each open rule the model reads whose stakes pass `SETUP_STAKES` and that no map left sets up
 * (`setUpAnywhere`), with the edit that sets it up where one does. Low stakes, or stakes not yet known, never make one.
 */
export function setupChecks(plan: Plan, lineups: readonly PlanLineup[], run: Run, rules: CheckedRules, stakes: readonly RuleStake[], setUpAnywhere: (rule: OpenRule) => boolean): SetupCheck[] {
  const s = new Map(stakes.map((x) => [x.rule, x]));
  return checkable(rules)
    .flatMap(({ rule }): SetupCheck[] => {
      const stake = s.get(rule.id);
      if (!stake?.modelled || Math.abs(stake.gain) < SETUP_STAKES || setUpAnywhere(rule)) return [];
      const edit = rule.setup?.(plan, rule.exp ? lineups.map((l) => earning(l, mapOfKey(run, l.key))) : lineups, run);
      return [{ rule: rule.id, label: rule.label, stake, ...(edit ? { edit } : {}) }];
    })
    .sort(byStakes(s));
}

/** A learned correction beyond about ×1.3 or ×0.77 on a unit an open EXP rule touches: the rule's check is named. */
export const CORRECTION_FLAG = { high: 1.3, low: 0.77 } as const;

/** The open EXP rules that touch a unit (for a learned correction out of range). */
export function rulesTouching(unit: RosterUnit, run: Run, plan: Plan | undefined, rules: CheckedRules): OpenRule[] {
  return checkable(rules).flatMap(({ rule }) => (rule.exp?.(unit, run, plan) ? [rule] : []));
}

const stepOf = (run: Run, key: string) => routeMapOrder(run.roster.run.route ?? 'main-story').find((s) => s.key === key);

/** A map key's map id on the run's route. */
const mapOfKey = (run: Run, key: string) => stepOf(run, key)?.map ?? key;

/** A map key's label on the run's route: "Chapter 25", "Apotheosis (secret route)". */
export function keyLabel(run: Run, key: string): string {
  const step = stepOf(run, key);
  const label = MAPS.find((m) => m.id === mapOfKey(run, key))?.label ?? key;
  return step?.secret ? `${label} (secret route)` : label;
}

export const nameIn = (run: Run) => (u: RosterUnit | 'maiden') => (u === 'maiden' ? 'the Maiden' : unitName(u, run.roster.run.gender));
