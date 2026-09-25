/**
 * The guide's Going deeper questions as data: each has a one-line answer (or, for Why this spouse?, three steps), a
 * jump to the view and control that answers it, and a Terms fold for the drill-down-only words. Entries never tick.
 */
import { DEFAULT_PRIORITY, type ChildId } from '../engine';
import type { GuideTarget } from './guide';
import { BASIS_LABELS, LABELS, ROLE_UI } from './labels';

export type DeeperId = 'strongest' | 'why-spouse' | 'pairing-build' | 'robin' | 'preset' | 'scoring' | 'assumption' | 'unit-class-tree' | 'unit-partners' | 'robin-preview' | 'front-door-pairings' | 'unit-opinion' | 'map-data' | 'chapter-log' | 'record-results' | 'matchups' | 'threats' | 'deployment' | 'supply' | 'how-to-run';

/**
 * Where an entry's jump goes: the All children leaderboard, a child's table (the one `guideChild` picks, with its Robin
 * row open for `robinRow`), the Validation panel, the Scoring sidebar on the current view, or Lon'qu's unit page. Then it highlights `target`.
 */
export type DeeperJump = {
  readonly to: 'leaderboard' | 'child' | 'validation' | 'scoring' | 'unit' | 'robin' | 'door' | 'map' | 'log';
  readonly target: GuideTarget;
  readonly robinRow?: true;
};

export type DeeperTerm = { readonly term: string; readonly def: string };

export type DeeperEntry = {
  readonly id: DeeperId;
  readonly question: string;
  /** One line, or the ordered steps when the answer is a sequence. */
  readonly answer: string | readonly string[];
  readonly jump: DeeperJump;
  /** The answer once Robin is locked, with no jump: nothing is left to choose. */
  readonly lockedAnswer?: string;
  readonly terms: readonly DeeperTerm[];
};

const { runFacts, inPlan, scoreWithThis, allChildren, skills, assumption, validation, plan, spdToTarget, spdBeyond, lock } = LABELS;
const bases = Object.values(BASIS_LABELS).join(' / ');

const PAIRING: DeeperTerm = {
  term: 'pairing',
  def: 'One way a child can be born: its variable parent, plus Robin’s asset and flaw wherever Robin is involved. One pairing is one table row.',
};
const SCORE: DeeperTerm = {
  term: 'score',
  def: `0–100: how good a pairing’s child is, in its best class. The tables score with the Scoring sidebar’s preset; the ${LABELS.plan} scores each child with its plan preset.`,
};

export const DEEPER: readonly DeeperEntry[] = [
  {
    id: 'strongest',
    question: 'Who’s strongest overall?',
    answer: `${allChildren}: every child’s best score, ranked.`,
    jump: { to: 'leaderboard', target: 'leaderboard' },
    terms: [SCORE, PAIRING],
  },
  {
    id: 'why-spouse',
    question: 'Why this spouse for this child?',
    answer: [
      'Open the child from the left rail.',
      `Click “${plan}: ‹preset› ${scoreWithThis}”, so the table scores with the preset the ${plan} uses.`,
      `Find the ${inPlan} row: that’s the plan’s pairing. The rows above it score higher alone, but the plan weighs every child at once.`,
    ],
    jump: { to: 'child', target: 'score-with-plan-preset' },
    terms: [
      PAIRING,
      { term: 'variable parent', def: 'The parent your marriage picks (the other, the fixed parent, it always has). The table compares them row by row.' },
      {
        term: 'blocked pairing',
        def: 'A pairing your roster contradicts: hard (✕) when it can no longer happen (a unit is dead, missed or married to someone else), soft (!) when it only goes against a pin or a bench.',
      },
      { term: inPlan, def: `The row is in the saved marriage plan (${LABELS.adoptPlan}).` },
    ],
  },
  {
    id: 'pairing-build',
    question: 'What does this pairing build?',
    answer: `Press ${skills} on any row: its drawer lists the build templates the pairing reaches, the skills it can inherit, and its class skills.`,
    jump: { to: 'child', target: 'skills-drawer' },
    terms: [
      { term: 'build template', def: 'A curated 5-skill loadout for one job, tagged with the play contexts it suits.' },
      { term: 'coverage (5/5)', def: 'How many of a build template’s five skills the pairing can reach: 5/5, 4/5 or 3/5. Below 3/5 isn’t shown.' },
    ],
  },
  {
    id: 'robin',
    question: 'Which Robin does this child want?',
    answer: `Expand the child’s Robin row with ▸: its asset × flaw heatmap scores every Robin (the name itself opens Robin’s page on that Robin). To get that Robin, raise the child’s priority and ${lock} Robin from the ${plan}’s pick line.`,
    jump: { to: 'child', target: 'robin-heatmap', robinRow: true },
    lockedAnswer: 'Robin is locked, so there’s nothing left to choose.',
    terms: [],
  },
  {
    id: 'preset',
    question: 'Which preset suits this child?',
    answer: `Its plan preset is derived: the preset where it stands highest against the cast, in its best role. Switch the Scoring sidebar’s preset to compare its table under others, and pin a role or preset on the ${plan}’s Roles matrix if you want a different build.`,
    jump: { to: 'child', target: 'scoring-preset' },
    terms: [
      {
        term: 'sidebar preset vs plan preset',
        def:
          `The Scoring sidebar’s preset is how the tables score, for every child at once. A plan preset is how the ${plan} judges ` +
          `one child, and it sets the child’s ${ROLE_UI.lead.short}/${ROLE_UI.battery.short}/${ROLE_UI.staff.short} letter. A child’s table opens on its plan preset; picking a sidebar preset explores others and never changes the plan.`,
      },
    ],
  },
  {
    id: 'scoring',
    question: 'Can I change how children are scored?',
    answer:
      `Yes: the basis, the Spd target and edits to a preset’s weights change the ${plan} (editing a preset’s weights re-scores every ` +
      'child on that preset). Picking a sidebar preset only changes the tables.',
    jump: { to: 'scoring', target: 'scoring-basis' },
    terms: [
      {
        term: `score basis (${bases})`,
        def: `What a score measures: effective caps with Limit Breaker (${BASIS_LABELS['caps-lb']}), without it (${BASIS_LABELS.caps}), or growth rates, the no-grind stand-in (${BASIS_LABELS.growths}).`,
      },
      { term: 'effective cap', def: 'A child’s max for a stat in a class: the class max plus the child’s modifier, plus 10 (not HP) with Limit Breaker.' },
      {
        term: `target breakpoint and speed margin (${spdToTarget}, ${spdBeyond})`,
        def: `The Spd total a unit should reach to be fast enough (the sidebar’s Target), plus a margin against debuffs and faster enemies. Spd up to both scores at the ${spdToTarget} weight, beyond them at the small ${spdBeyond} weight.`,
      },
      { term: 'Mixed', def: 'A preset that scores whichever of Str or Mag is higher and ignores the other.' },
      { term: 'weights', def: 'How much each stat point counts in a preset’s score. ↺ Reset goes back to the curated weights.' },
    ],
  },
  {
    id: 'assumption',
    question: `What does ${assumption} mean?`,
    answer: `A game rule the app couldn’t verify. ${validation} lists each one and lets you override it for your run.`,
    jump: { to: 'validation', target: 'validation' },
    terms: [],
  },
  {
    id: 'unit-class-tree',
    question: 'What can this unit become?',
    answer: [
      'Units in the rail opens a page for each first-gen unit.',
      'Its class tree lists each class in its set and what a Master Seal promotes it to, with the skills each teaches and at which level; DLC classes are dimmed.',
      '★ marks a starting skill: kept for good, even when no class it can reach teaches it (Walhart’s Conquest).',
      'Build coverage matches the build templates against everything it can reach, in the play context.',
    ],
    jump: { to: 'unit', target: 'unit-class-tree' },
    terms: [
      { term: 'unit page', def: 'A first-gen unit seen on its own: its join data, class tree, build coverage, what it passes as a parent, and pair-up.' },
      { term: 'class tree', def: 'A unit’s classes as base → promotion lines plus DLC classes, each with its skills and levels.' },
      { term: 'starting skill', def: 'A skill a unit joins with. It keeps it whatever its class.' },
    ],
  },
  {
    id: 'unit-partners',
    question: 'Who should this unit marry?',
    answer: [
      'Partners on a unit page lists everyone it can S-support, Robin included, with the children each marriage produces.',
      'Each child is scored in its plan preset; rows are sorted by the best child, so one great child beats two middling ones.',
      `Marks show a marriage that happened, the saved plan’s pick (◆), a dead partner, and a blocked marriage with why.`,
      `It never changes your plan: Plan → opens the ${plan}, where pinning the marriage shows what it costs the rest.`,
    ],
    jump: { to: 'unit', target: 'unit-partners' },
    terms: [{ term: 'Partners', def: 'A unit page’s list of possible spouses and the children each marriage produces, read-only.' }],
  },
  {
    id: 'robin-preview',
    question: 'What does Robin’s page show before Robin is set?',
    answer: [
      `Robin’s page follows the ${runFacts}: your Robin’s gender and asset/flaw.`,
      'Until they’re set, a Preview bar lets you try any Robin. The page, its builds and its Partners follow the preview, and nothing is saved.',
      'Partners show Morgan, plus the partner’s own child where Robin is a parent. With a child partner, Morgan uses that child’s saved-plan pairing, else its best pairing left, and says which.',
    ],
    jump: { to: 'robin', target: 'robin-preview' },
    terms: [{ term: 'preview', def: 'A Robin tried on Robin’s page while the Run facts leave Robin open. It never writes to the Run facts.' }],
  },
  {
    id: 'front-door-pairings',
    question: 'What’s true of this child whoever its parents are?',
    answer: [
      'A child’s front door (Units › Children) shows what every pairing shares: its fixed parent, start class, default class set, personal growths, and what the fixed parent always passes (Chrom’s Aether to Lucina).',
      'Its best parents show as tiles, ranked as the pairing table ranks them under the Scoring sidebar’s preset; a tile opens that pairing, and a link opens the full table.',
      'The Robin line says whether the child can marry Robin and, with Robin set, the best Morgan that gives. Morgan’s own front door waits on Robin.',
    ],
    jump: { to: 'door', target: 'front-door-pairings' },
    terms: [{ term: 'front door', def: 'A child’s overview page: what stays the same across pairings, its best parents, and the Robin line.' }],
  },
  {
    id: 'unit-opinion',
    question: 'What do the experts say about this unit?',
    answer: [
      'A unit page and a front door show each named source’s opinion in its own block (“Ellery says…”), never merged: role, tier, classes, a 5-skill loadout, partners, a note and the video it comes from.',
      'The loadout is matched against what the unit can reach, like a build template (“4/5”), so you can see whether you can follow it.',
      '♥ and ⚠ mark the partners and parents a source recommends or warns against, on Partners and on the front door, even outside the top 5.',
      'Ellery’s opinions come from AI summaries of his videos, checked against the game data first; wrong cells were left out and named in the note.',
    ],
    jump: { to: 'unit', target: 'unit-opinion' },
    terms: [
      { term: 'unit opinion', def: 'What a named source says about one unit in a play context. Shown beside the app’s scores, never scored.' },
      { term: 'provenance', def: 'How a source reached the app and how far to trust it. Hover the source link.' },
    ],
  },
  {
    id: 'map-data',
    question: 'What am I facing on this map?',
    answer: [
      'Run › Maps lists every map; each shows its chapter data on your difficulty (or one you pick to look ahead).',
      'Win and lose conditions, deploy count, forced units and recruits; the boss; every enemy group with its items, skills and what sets it moving; reinforcements; items, and the shop.',
      'On Normal, reinforcements arrive before your phase. On Hard and up they arrive at the start of enemy phase and can act at once.',
      'Lunatic+ is Lunatic with two extra random skills per enemy, from Pass, Hawkeye, Luna+, Vantage+, Counter, Aegis+ and Pavise+ (no Counter, Aegis+ or Pavise+ before Chapter 3).',
    ],
    jump: { to: 'map', target: 'map-data' },
    terms: [{ term: 'chapter data', def: 'A map’s cited facts on every difficulty, from Fire Emblem Wiki, cross-checked against Serenes Forest.' }],
  },
  {
    id: 'chapter-log',
    question: 'How do I record my run?',
    answer: [
      'Run in the rail holds your chapter log: one entry per map you play, newest first, tagged with the map.',
      'Add entry copies the last entry, and fills in the map’s recruits from their join data (a child’s stats you record from the game).',
      'Open an entry to record each unit’s class, level, EXP, stats, skills, inventory with forges, and supports, plus gold and the convoy.',
      'Fixing a past entry never changes later ones: they’re flagged so you can check them. Export and Import save the run as a file.',
    ],
    jump: { to: 'log', target: 'chapter-log' },
    terms: [
      { term: 'chapter log', def: 'A run’s record, one entry per map played, each copied forward from the last.' },
      { term: 'snapshot', def: 'An entry’s record of the army: every unit, the convoy, gold, unit states and marriages.' },
    ],
  },
  {
    id: 'record-results',
    question: 'What do I do after clearing a map?',
    answer: [
      'Next map, at the top of Run, offers what your route has opened: the story’s next chapter first, then paralogues (with any condition, and a note that SpotPass downloads may be gone), then on a Full route the DLC. Grind maps are never offered: log them as “other”.',
      'Record results makes the map’s entry, a copy of the last, and walks you through what changed: deployed units, the map’s recruits (pre-filled), deaths and marriages, then convoy and gold.',
      'On Classic a unit that falls is dead for good; on Casual it comes back, so nothing is recorded. Anything you skip keeps its copied value.',
    ],
    jump: { to: 'log', target: 'next-map' },
    terms: [
      { term: 'next map', def: 'A map your route and the maps you’ve cleared have opened.' },
      { term: 'map played', def: 'The map an entry records: a chapter, paralogue, xenologue, or “other”.' },
    ],
  },
  {
    id: 'matchups',
    question: 'Can my units handle the next map?',
    answer: [
      'Prepare, beside the next map, opens its preparation page. Pick a foe (the boss is starred) to see each of your units against it, paired with its back.',
      'Each row uses your latest entry’s stats, the unit’s best weapon from its inventory (forges count), and the back’s pair-up bonus and dual strikes: damage, whether one round kills (with dual strikes landing, too), doubling, the worst round it can take against its HP, and hit and crit both ways.',
      'Units who join on the map from its start (the Prologue’s four, Chapter 3’s Sumia) are there too, marked “joins”, with their join data; Premonition’s Chrom and Robin use that map’s own setup, marked “this map only”. The map always fields them, in the slots it adds for them. Recruits who come later are listed with when, not placed in the opening lineup.',
      'Dual strikes get past plain Pavise and Aegis but not Pavise+ or Aegis+. On Lunatic+ the table assumes the worst of the map’s random-skill pool.',
      'Weapon ranks aren’t recorded, so no rank bonus is counted. There’s no movement planning: no source publishes terrain or enemy AI.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'matchup', def: 'A lead and back, with a weapon, against one foe: damage, one-round, doubling, worst round and survival, hit and crit.' },
      { term: 'preparation page', def: 'A map’s page for getting ready: threats, deployment and pairs, loadouts, supplies and matchups, for your army and the units joining on it.' },
    ],
  },
  {
    id: 'threats',
    question: 'What should I watch out for on this map?',
    answer: [
      'The preparation page opens with the map’s threats: every enemy group and the boss on your difficulty, their weapons and skills, what sets them moving, and when reinforcements arrive.',
      'Danger flags pick out what threatens your army: a weapon effective against a unit (⚔, like Beast Killers against cavalry), Counter against a melee unit (↩), a boss that doubles a unit (»), and a foe whose round can kill a unit (☠).',
      'On Lunatic+, a checklist lists each enemy to inspect when the map starts. Note the random skills you see: the matchups and flags then use them instead of the worst case.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [{ term: 'danger flag', def: 'Something on the map that threatens one of your units: an effective weapon, Counter, a boss that doubles it, a round that can kill it.' }],
  },
  {
    id: 'deployment',
    question: 'Who should I deploy, paired with whom?',
    answer: [
      'Deployment and pairs, on the preparation page, fills the map’s deploy count: its forced units first (Chrom, Robin on Chapter 23, and anyone the map fields from its start), then each lead (by role: army fit’s for children, the roster’s tag for the rest) with the back that covers the map’s foes best, then Staff/Rally and dancers. If room is left, whoever covers best of the rest leads, whatever its role, and takes a back.',
      'Coverage counts, for each foe, whether one round kills it and whether the lead survives its worst round, weighted by how many there are and more for the boss.',
      'Pick another back, give a unit alone a back to make it a lead, swap a pair with ⇅, or drop a unit that isn’t forced, and everything recomputes: pairs, matchups and loadouts. Loadouts list the weapons that win each unit’s matchups, from its inventory and convoy weapons of a kind it already uses.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'loadout', def: 'The weapons a unit takes into the map, from its inventory and the convoy, and its other items.' },
      { term: 'coverage', def: 'How well a lead and back handle a map’s foes: one-round kills and survived rounds, weighted by count.' },
    ],
  },
  {
    id: 'supply',
    question: 'What should I buy, forge or promote before this map?',
    answer: [
      'The supply list suggests a buy or a forge for each deployed lead that turns foes it can’t one-round into one-round kills, cheapest per foe first, within the gold you recorded and only from armories you’ve opened. Merchants are random, so they aren’t counted.',
      'Seals and promotions says where seals come from now (Master Seals in the Port Ferox armory after Chapter 12, Second Seals at the Mila Tree after Chapter 16; before that only random merchants), how many you hold, and for each base-class unit at level 10+ whether promoting now wins more of this map’s matchups.',
      'The level-20 stats it shows are expected, from average growths: a guide to “now or later”, not your unit’s real stats.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'supply list', def: 'Buys and forges that close the map’s gaps, priced against your gold and limited to open armories.' },
      { term: 'expected stats', def: 'Stats projected from average growths; used only for “promote now or later”.' },
    ],
  },
  {
    id: 'how-to-run',
    question: 'How do experienced players run this map?',
    answer: [
      'How to run it, on a map’s page and its preparation page, gives each named source’s tactics for the map, side by side and never merged: Ellery’s from his Lunatic+ streams, for now.',
      'Each tactic says the difficulty it was played on, its turn window, and the units it assumes, and cites the stream.',
      'They were checked against the chapter data first: wrong turn numbers and threats were corrected, tactics that hang on terrain no source publishes were held back, and ones that can’t work were dropped. The facts themselves stay in the chapter data.',
    ],
    jump: { to: 'map', target: 'how-to-run' },
    terms: [{ term: 'chapter guide', def: 'Named sources’ tactics for each map, kept apart from the chapter data’s facts.' }],
  },
];

/** The entry with this id. */
export const deeperEntry = (id: DeeperId): DeeperEntry => DEEPER.find((e) => e.id === id)!;

/** What an entry shows: its answer as a list of lines, and its jump; none once Robin is locked where that leaves nothing to choose. */
export function deeperView(entry: DeeperEntry, robinLocked: boolean): { answer: readonly string[]; jump: DeeperJump | undefined } {
  if (robinLocked && entry.lockedAnswer) return { answer: [entry.lockedAnswer], jump: undefined };
  return { answer: typeof entry.answer === 'string' ? [entry.answer] : entry.answer, jump: entry.jump };
}

/**
 * The child a table jump shows: the last child opened, else the top-priority child (the first of `children` on a tie).
 * `children` are the ones in this run, in rail order.
 */
export function guideChild(lastOpened: ChildId | undefined, priorities: Readonly<Partial<Record<ChildId, number>>>, children: readonly ChildId[]): ChildId {
  if (lastOpened && children.includes(lastOpened)) return lastOpened;
  const priority = (c: ChildId) => priorities[c] ?? DEFAULT_PRIORITY;
  return children.reduce((best, c) => (priority(c) > priority(best) ? c : best), children[0]!);
}

