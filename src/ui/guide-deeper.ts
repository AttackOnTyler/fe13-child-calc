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
    answer: `Press ${skills} on any row: its drawer lists the build templates the pairing reaches, the skills it can inherit (with notes where inheritance rests on an assumption, such as both parents passing the same skill), and its class skills.`,
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
    answer: `A game rule the sources couldn’t verify. ${validation} lists each one with its sources (some are single-source, some have none) and lets you override it for your run.`,
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
      'Each row names the pair’s support curve: most marriages are slow (S in 8 maps fighting together at best), and each woman has one fast husband (S in 7), most also a medium one.',
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
      'Win and lose conditions, deploy count, forced units and recruits; the boss; every enemy group with its items, skills and what sets it moving; reinforcement waves by turn, each group with its weapon and where it appears (waves set off by an event show that event); items, each saying how play can lose it (an escaping Thief, a burned village, a result the map pays for), and the shop.',
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
      'Add entry copies the last entry, and fills in the map’s recruits from their join data. A child’s stats are worked out from its parents’ stats and classes in the entry before its map (as they were on entering it); if a parent’s stats aren’t logged there, they stay blank and you record them from the game.',
      'Open an entry to record each unit’s class, level, EXP, stats, skills, inventory with forges, and supports, plus gold at the map’s end, the convoy and the shopping after the map.',
      'Each row reads its tier from the class (a name the class data doesn’t know is flagged) and shows the unit’s internal level, worked out from the class changes in the log. Its count box stands in for Second Seals from before the log.',
      'Fixing a past entry never changes later ones: they’re flagged so you can check them. Export and Import save the run as a file.',
    ],
    jump: { to: 'log', target: 'chapter-log' },
    terms: [
      { term: 'chapter log', def: 'A run’s record, one entry per map played, each copied forward from the last.' },
      { term: 'snapshot', def: 'An entry’s record of the army: every unit, the convoy, gold, unit states and marriages.' },
      { term: 'internal level', def: 'The hidden level EXP is computed from: the level, +20 in an advanced class, plus a count from Second Seals, capped by difficulty.' },
    ],
  },
  {
    id: 'record-results',
    question: 'What do I do after clearing a map?',
    answer: [
      'Next map, near the top of Run (under the inbox, “what needs you”: before the run until Robin is locked, then “Before <map>”), offers what your route has opened: the story’s next chapter first, then paralogues (a child’s only once Chapter 13 is cleared, its parent is recorded married — a pin doesn’t count — and its map can be reached; the SpotPass ones with a note that the downloads may be gone), then on a Full route the DLC. Grind maps are never offered: log them as “other”. A map Next map doesn’t offer (a child paralogue played before its marriage was recorded) can still be logged with Add entry.',
      'After the Lock the inbox above Next map lists what needs you before that map: units at risk, each with the one change that brings its milestone back (a span pin or an EXP priority, made in one click); units behind, each with a re-solve proposal (the roadmap first, a wishlist change only when it does better); the re-solve’s proposals, marked required once your plan can no longer be met (a unit it needs lost, a marriage off it, a support that can’t be reached); and the map’s actions (a pair’s earliest or last start, a skill to equip, a seal to pick up or buy, a class change due). A death, a missed recruit or a marriage off the plan puts one loss item on top: what it broke, the flawless chance before the loss and after its re-solve (the reserve covering the unit steps in; marriages, passed skills and the roadmap re-solve), and what the re-solve changes. Nothing changes until you accept it (or keep your plan); until then Prepare says your plan predates the loss. Next map counts the open items as a nudge: you can always play anyway. Your edits and “anything else” stay below.',
      'Record results makes the map’s entry, a copy of the last, and walks you through what changed: deployed units, the map’s recruits (pre-filled; mark one you didn’t recruit as Missed), deaths and marriages, convoy and gold as the map ended, shopping, side goals and renown, then items used.',
      'The Shopping step records what you bought, sold and forged after the map, each with its gold (pre-filled at the game’s price: worth for a buy, by uses left for a sale, by forge steps for a forge; type your own to override). The entry’s gold stays gold at the map’s end; gold after shopping is worked out, split into upkeep (more of an item you already held), seals and kit. The next entry, the preparation page and the flawless chance’s runs all start from the army as it left the shop.',
      'The Side goals and renown step ticks each side goal on the map (escaping Thieves, burnable villages, Chapter 18’s falling chests, a paralogue’s result) you secured, pre-filled when every item it holds turned up against the entry before. Renown is asked once for the run: the renown the file started with, then the rewards already claimed; after that it’s +10 per story map (paralogues and DLC maps count 0, an assumption), and the flawless chance places each reward on the map that reaches it. The Run view’s Side goals list pins any goal ahead to always take or skip; otherwise the plan chases one that costs at most one action a turn.',
      'The Items used step lists the boosters, tonics and handovers you used in the map’s preparations, pre-filled from the plan’s “before this map” list: untick what you didn’t use and add what you did. It’s asked, not read from stat jumps, since a +2 over what was expected could be a level-up.',
      'Against the entry before, it shows the uses each item spent on the map and what the map gave: an item the map’s chests, villages, drops or side goals hold, or a random find when no buy or map item is behind it.',
      'When a unit’s level resets, it proposes a class change (Master or Second Seal, used at the level from the last entry). Correct the seal or level if you used it mid-map, then record it.',
      'On Chapter 11, if Chrom has no recorded marriage, it asks who the game married him to at the map’s end: a candidate not married to someone else (a lost one included), or the Maiden. It pre-selects one only when his logged support ranks decide it (a single candidate at his highest rank, C or above: a rank counts only once its conversation is viewed); otherwise the game decided by support points the app can’t see (Olivia wins from 2 points with him when nobody else has a C, so she needs no rank), so pick who he married. The answer is recorded as a marriage.',
      'A child who joins gets its stats from its parents as the entry before the map logs them: the fixed parent and its spouse (Morgan: Robin and Robin’s spouse; Lucina: Chrom’s recorded wife, the Maiden’s side counting as 0). If either parent’s stats are missing there, the recruits step names that parent and leaves the child’s stats blank.',
      'On Classic a unit that falls is dead for good: a loss, with its loss item in the inbox. On Casual it comes back after the map with its place in the plan and its children, so it’s no loss: record the fall anyway, and it’s logged to check the forecast’s no-death chances, and What it cost prices the rest of the map it missed. Chrom or Robin falling is a Game Over: you reload and play the map again, so there’s nothing to record and Record results offers no button for them. A fall, death or miss recorded by mistake has an Undo. Anything you skip keeps its copied value.',
      'Recording a map re-solves your plan for about 5 seconds; what it finds arrives as proposals in the inbox, never applied on its own. A What changed card sits above the inbox until you press “Got it”: the flawless chance before the map and after (after a death it stays forward-only: no further deaths from here, with the army that’s left), each unit’s EXP against the forecast, the readings that moved, the improvements found, and What it cost: each event on the map in flawless points, priced on the same runs as if it hadn’t happened (a death or miss and what it broke, a milestone missed with a link to its re-solve, a fall, a level ahead of or behind the forecast, and one row when you spent more gold than the plan, naming the endpoint kit pieces it costs), rows under 0.1 points rolled up.',
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
      'Prepare, beside the next map, opens its preparation page: the adopted plan’s lineup for the map, played turn by turn with your latest stats. Its head gives the map’s no-death chance beside the plan’s flawless chance, the expected turns and the deploy count.',
      'Units who join on the map from its start (the Prologue’s four, Chapter 3’s Sumia) are in the lineup too, marked “joins”, with their join data; Premonition’s Chrom and Robin use that map’s own setup, marked “this map only”. Units not fielded are listed under the cards with why: a pin, a reserve, not in the wishlist, no room, or arriving later (with the turn, or how).',
      'Matchups, collapsed in the column: pick a foe (the boss is starred) to see each lead against it with its back. Each row uses your latest entry’s stats, the unit’s best weapon from its inventory (forges count), and the back’s pair-up bonus and dual strikes: damage, whether one round kills (with dual strikes landing, too), doubling, the worst round it can take against its HP, and hit and crit both ways.',
      'Dual strikes get past plain Pavise and Aegis but not Pavise+ or Aegis+. On Lunatic+ the table assumes the worst of the map’s random-skill pool.',
      'Weapon ranks aren’t recorded, so no rank bonus is counted. There’s no movement planning: no source publishes terrain or enemy AI.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'matchup', def: 'A lead and back, with a weapon, against one foe: damage, one-round, doubling, worst round and survival, hit and crit.' },
      { term: 'preparation page', def: 'A map’s page for getting ready: a pair card for each pair and unit alone in the plan’s lineup, beside the map’s no-death chance, one Before this map checklist, threats, the shopping list, seals, loadouts, checks, matchups and the chapter guide.' },
    ],
  },
  {
    id: 'threats',
    question: 'What should I watch out for on this map?',
    answer: [
      'Threats, in the preparation page’s column, lists every enemy group the play meets (reinforcements included) with its weapon and skills: the cautious worst case (its worst round against the unit it hurts most) beside the play’s chance that the group kills someone, and who takes it under the EXP priority (kills a run). The two disagree on purpose: the worst case is what can happen, the chance what likely does. Reinforcements are listed with when they arrive.',
      'Each pair card lists the groups that threaten it, with their chance of killing someone on it, and is flagged “worst case kills” when a foe’s worst round can kill a unit on it.',
      'Danger flags pick out the rest: a weapon effective against a unit (⚔, like Beast Killers against cavalry), Counter against a melee unit (↩) and a boss that doubles a unit (»).',
      'On Lunatic+, a checklist lists each enemy to inspect when the map starts. Note the random skills you see: the matchups, threats and flags then use them instead of the worst case.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'danger flag', def: 'Something on the map that threatens one of your units: an effective weapon, Counter, a boss that doubles it, a round that can kill it (“worst case kills” on its pair card).' },
      { term: 'worst case', def: 'The most a foe’s round can deal a unit: every hit and crit landing. Cautious; the chance beside it is what the play expects.' },
    ],
  },
  {
    id: 'deployment',
    question: 'Who should I deploy, paired with whom?',
    answer: [
      'The preparation page is a pair card for each pair and unit alone in the adopted plan’s lineup for the map (the forced units, and anyone the map fields from its start, always in it). Each card shows the Lead and Back, what each does in the play (fights, backs, heals, dances, talks), its EXP priority and expected EXP with its level at the map’s end, the milestone that EXP feeds with its chance, and an at-risk reading with the one-click pin that restores it.',
      'The stance plan reads the play’s stances turn by turn: together with one unit in front, side by side in Attack Stance, or apart, and when to Separate, Pair Up or Switch. The EXP priority says who should take which foe groups, never which foe dies on which turn.',
      'Pick another back (or go alone), swap a pair with ⇅, or drop a unit that isn’t forced with ✕: each is a span pin over this map only, which the flawless chance and the solve keep, and the page plays the map again. Lift it with unpin on the card, or on a dropped unit under the cards.',
      'A card counts its to-dos and links them in the checklist; the actions themselves are written only there.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'pair card', def: 'One pair or unit alone in the plan’s lineup for a map: positions, jobs, EXP priority and expected EXP, the milestone it feeds, stances, threats and its to-do count.' },
      { term: 'stance plan', def: 'A pair’s stances turn by turn, as the play takes them: together (Dual Guard, one action), side by side in Attack Stance (two actions) or apart.' },
      { term: 'loadout', def: 'The weapons a unit takes into the map, from its inventory, the convoy and what the item plan hands it, and its other items.' },
    ],
  },
  {
    id: 'supply',
    question: 'What should I buy, forge or promote before this map?',
    answer: [
      'The shopping list is what the flawless chance’s simulated runs buy at the next armory stop, each with the chance a run makes it: first rebuys for weapons, staves and potions that would run dry before the next armory (a weapon spends a use per hit, a back’s per Dual Strike, a staff per cast; Armsthrift saves some; a weapon this armory doesn’t sell is replaced by the nearest one of its kind that it does; a unit whose every weapon has run dry is re-armed, and a staff or potion is kept to a third of its uses), then a Master or Second Seal at 2,500G when one of the plan’s class changes needs it and none is held, then the item plan’s tonics for this map (150G each, where this map’s open armories sell them and none is held), then on the way the weapons that arm this map’s lineup better (off the shelf, within the rank each unit’s level suggests) and a Vulnerary each, keeping the gold the plan’s seals still need, and at the endpoint the endpoint kit: the best weapon the open armories sell for each lead, forged to +5 Mt, and a Vulnerary each. A run short of gold drops the kit pieces that win fewest matchups per gold.',
      'Each run starts from the gold you recorded and gains Bullion no play can lose, the side goals it secures (Bullion, Paralogue 13’s gold, free seals) and renown’s rewards on the map that reaches them (the Second Seal at 100, Bullion (L) at 1,000), Bullion sold at the next armory; everything else is held, never sold. The Run view shows each map’s gold at its end as a range. Merchants are random, so their stock isn’t counted.',
      'Before this map, in the preparation page’s column, is one checklist in the game’s own menu order: pick units and pair up, inventory and trade, use items, skills, armory and forge; then On the map. Each action says why (the milestone, item plan or shopping-list line it serves) and, where the plan reads one, what it’s worth in flawless points. This map’s shopping-list lines are its armory step; a later stop’s list stays in the Shopping list section.',
      'The early forced maps (Premonition, the Prologue, Chapters 1 and 2) have no preparation phase: a banner says so, and the page keeps only the cards, threats and On the map.',
      'Seals and promotions names the plan’s class changes before this map (their seal is in the checklist), says where seals come from now (Master Seals in the Port Ferox armory after Chapter 12, Second Seals in the Mila Tree armory after Chapter 16, or the Great Gate, Mercenary Fortress or Manor of Lost Souls armory after Paralogue 6, 10 or 16, naming whichever is open; before that only random merchants), how many you hold, and for each base-class unit at level 10+ whether promoting now wins more of this map’s matchups.',
      'The level-20 stats it shows are expected, from average growths: a guide to “now or later”, not your unit’s real stats.',
      'The item plan’s part of the checklist: weapons to hand to their carrier under Inventory and trade, boosters to drink (+2, the Seraph Robe +5 HP, for good, never past the cap) and tonics to drink (+2 for this map only, past the cap; bought first when none is held) under Use items. Loadouts show each unit’s weapons with those handovers made. The Run view’s Item plan shows every held item’s planned use and pins one to your choice.',
    ],
    jump: { to: 'log', target: 'prepare' },
    terms: [
      { term: 'shopping list', def: 'The buys at an armory stop in priority order (rebuys, seals, tonics, arms for the map, the endpoint kit), each with the chance a simulated run makes it.' },
      { term: 'item plan', def: 'Each held item’s planned use: a unit and a map for a booster or tonic, a carrier from each map on for a weapon, with its arrival chance.' },
      { term: 'endpoint kit', def: 'The weapons, forges and Vulneraries the plan buys for the endpoint from the gold left, trimmed when short.' },
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

