/**
 * The guide's Going deeper questions as data: each has a one-line answer (or ordered lines), a jump to the view and
 * control that answers it, and a Terms fold for the drill-down-only words. Entries never tick. `? Guide` opens them,
 * grouped into Your run and Exploring (#213; spec #175, the guide): `DEEPER_GROUPS` puts every entry in one group.
 */
import type { ChildId } from '../engine';
import type { GuideTarget } from './guide';
import { BASIS_LABELS, EXPLORER_NOTE, LABELS, LEDGER_UI, OPINION_NOTE, STATE_UI } from './labels';
import { CONTEXT_LABELS } from './scoring-prefs';

export type DeeperId =
  | 'start'
  | 'robin-choice'
  | 'inbox-before'
  | 'wishlist'
  | 'why'
  | 'inbox-after'
  | 'loss'
  | 'strongest'
  | 'pairing-build'
  | 'robin'
  | 'preset'
  | 'scoring'
  | 'play-context'
  | 'assumption'
  | 'unit-class-tree'
  | 'unit-partners'
  | 'robin-preview'
  | 'front-door-pairings'
  | 'unit-opinion'
  | 'map-data'
  | 'chapter-log'
  | 'record-results'
  | 'matchups'
  | 'threats'
  | 'deployment'
  | 'supply'
  | 'how-to-run';

/**
 * Where an entry's jump goes: the All children leaderboard, a child's table (the one `guideChild` picks, with its Robin
 * row open for `robinRow`), the Validation panel, the Scoring sidebar on the current view, Lon'qu's unit page, Robin's
 * page, a child's front door, the Prologue's map page, the Run view (`log`: its inbox, Next map and chapter log), the
 * Wishlist tab, Roster, or nowhere (`here`: a header control, on every view). Then it highlights `target`.
 */
export type DeeperJump = {
  readonly to: 'leaderboard' | 'child' | 'validation' | 'scoring' | 'unit' | 'robin' | 'door' | 'map' | 'log' | 'wishlist' | 'roster' | 'here';
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

const { runFacts, allChildren, skills, assumption, validation, spdToTarget, spdBeyond, lock, roster, married, ledgerStatus, playContext } = LABELS;
const bases = Object.values(BASIS_LABELS).join(' / ');
const stateLabel = (s: keyof typeof STATE_UI) => `${STATE_UI[s].icon} ${STATE_UI[s].label}`;
const ledgerLabel = (s: keyof typeof LEDGER_UI) => `${LEDGER_UI[s].mark} ${LEDGER_UI[s].label}`;

const PAIRING: DeeperTerm = {
  term: 'pairing',
  def: 'One way a child can be born: its variable parent, plus Robin’s asset and flaw wherever Robin is involved. One pairing is one table row.',
};
const SCORE: DeeperTerm = {
  term: 'score',
  def: `0–100: how good a pairing’s child is, in its best class, under the Scoring sidebar’s preset. ${EXPLORER_NOTE}`,
};

export const DEEPER: readonly DeeperEntry[] = [
  {
    id: 'start',
    question: 'Where do I start a run?',
    answer: [
      `${roster} › ${runFacts}: your run’s difficulty (Normal to Lunatic+), mode (Classic: the fallen stay dead; Casual: they come back) and route: ` +
        `${CONTEXT_LABELS['main-story']}, or ${CONTEXT_LABELS['full-route']} (the non-grind DLC woven into the campaign, ending at Apotheosis).`,
      `Robin’s gender, asset and flaw are ${runFacts} too: once set, the other Robins and Morgans drop out. Set them if you know your Robin; otherwise leave them open, and the Run view’s Robin card compares Robins for you.`,
      `The route sets the explorer’s ${playContext} to match. Change the ${playContext} to explore another one: the wishlist always reads its build templates from the route.`,
      `The rest of ${roster} is your army’s hard facts: each unit’s state (${stateLabel('available')}, ${stateLabel('not-recruited')}, ${stateLabel('missed')}, ${stateLabel('dead')}) and each marriage that happened (${married}). Record results keeps them up to date as you play.`,
    ],
    jump: { to: 'roster', target: 'run-facts' },
    terms: [{ term: 'Run facts', def: 'What you’ve decided about the run: difficulty, mode, route, and Robin’s gender, asset and flaw.' }],
  },
  {
    id: 'robin-choice',
    question: 'Which Robin should my run use?',
    answer: [
      'The Run view’s inbox opens on the Robin card: Compare Robins works out, in the background, the best plan with each Robin, and shows each one’s flawless chance against your plan’s.',
      `Choose takes a Robin’s whole wishlist as your plan. ${lock} Robin and start writes that Robin into ${runFacts} and locks only Robin: the rest of the wishlist stays editable and re-solves after every map. Unlock reopens it.`,
      `Before you choose, ${lock} Robin and start takes the Robin the search ranks best, with its wishlist (the card marks it “the Lock takes this”); once you’ve chosen another, it keeps yours and names the search’s best beside it.`,
      'The no-Robin option solves the best plan with Robin no one’s parent (no Morgan): how much Robin’s marriage is worth.',
    ],
    jump: { to: 'log', target: 'robin-card' },
    terms: [{ term: 'Robin Lock', def: `Writing the chosen Robin into ${runFacts} before the Prologue. It locks Robin only.` }],
  },
  {
    id: 'inbox-before',
    question: 'What needs me before the run starts?',
    answer: [
      'The Run view’s inbox, “Before the run: what needs you”, is one list in order. First the flawless chance with its ± and the ceiling, then the Robin card.',
      'The search’s improvements, as proposals: Accept adopts the plan, Dismiss hides it. Close calls have no measurable difference: Take it if you like it better.',
      '“Anything else you want different?” searches every edit, keeping a unit in or out among them, each with its cost in flawless points: Pin it makes it a pin every plan keeps, Make it changes your plan.',
      'Your edits lists what you pinned and made, with the pins’ combined cost and an Undo each. Then the wishlist in one line, and Lock Robin and start last.',
    ],
    jump: { to: 'log', target: 'inbox' },
    terms: [
      { term: 'flawless chance', def: 'The chance your plan reaches and clears its endpoint with no unit dying, from the next map on. Every plan is ranked by it.' },
      { term: 'ceiling', def: 'The endpoint’s flawless chance with every wishlist unit at its effective caps: no plan for that army can beat it.' },
      { term: 'edit', def: 'One change to a plan: a marriage, Robin, a class, a build skill, a passed skill, a lineup, a pair, an EXP priority, a paralogue’s place or a seal.' },
      { term: 'pin', def: 'A hard constraint every plan keeps: a marriage, a span, keep-in or keep-out, a carrier, a side goal, the Robin Lock. Its cost is what it takes off the flawless chance.' },
    ],
  },
  {
    id: 'wishlist',
    question: 'What is my run working towards?',
    answer: [
      'The Wishlist tab (beside Run in the rail) is the endpoint army: Lead and Back rows, each unit with its class, 5-skill build, worth, parents and the skills they pass, and its reading (on track, at risk or behind). The title counts the units fielded, and how many of the units the plan counts on (fielded, and the parents and children off the endpoint lineup) aren’t on track; the rail’s count is that number.',
      'Click a unit to list every edit that touches it with its cost, keeping it in or out among them; making one is the same as in the inbox.',
      'Also in the plan lists units the plan needs off the endpoint lineup (a parent there for its child). Reserves are in order, each naming the loss it mainly covers.',
      `The children ledger lists each child with its fixed parent, the wishlist’s parents and the skills they pass, and its ${ledgerStatus}: ${ledgerLabel('wished')}, ${ledgerLabel('out')}, ${ledgerLabel('married')}, ${ledgerLabel('missed')} or ${ledgerLabel('dead')}.`,
    ],
    jump: { to: 'wishlist', target: 'wishlist-army' },
    terms: [
      { term: 'wishlist', def: 'The endpoint army your plan works towards: who fields, paired with whom, in which class and build, and the marriages that make its children.' },
      { term: 'worth', def: 'How many points of flawless chance the plan loses without the unit, its place in the wishlist refilled and the roadmap re-solved. A parent’s includes its children.' },
      { term: 'reserve', def: 'A wishlist unit beyond the endpoint’s deploy count, in the order they step in when a wishlist unit is lost or falls behind.' },
    ],
  },
  {
    id: 'why',
    question: 'Where does this number come from?',
    answer: [
      'Every number on the Run view and the Wishlist tab is a link (dotted underline): click it and the Why panel opens beside the page.',
      'It gives the value, one sentence on what it is, its math and the rows that moved it. A row drills further, with breadcrumbs back, until the trail stops and says why.',
      'It lists the blind spots touching the number, each with its lean: ▲ may read high, ▼ may read low, or ◆ either way. Its Stated assumptions tab lists everything the numbers rest on: every blind spot with where it bites, the open rules by stakes with their checks, model mismatches, the learned EXP corrections, then the checked rules.',
      'Where a blind spot can be stressed, the headline shows how low the chance could go once the search is done (“as low as 31.8% if two attackers reach each exposed pair”; “if Rally reaches no pair”): the same plan re-run under its bad case, explained like any number.',
    ],
    jump: { to: 'log', target: 'flawless-headline' },
    terms: [{ term: 'blind spot', def: 'Something the simulated runs don’t model, stated with where it bites and which way it leans.' }],
  },
  {
    id: 'loss',
    question: 'A unit died, a recruit was missed, or a marriage went off the plan: what now?',
    answer: [
      `Record it: Record results marks a death, a missed recruit and a marriage for you. Outside a map, ${roster}’s state strip marks ${stateLabel('dead')} or ${stateLabel('missed')}, and the spouse picker records a marriage that happened (${married}), an off-plan one too.`,
      `${stateLabel('dead')} and ${stateLabel('missed')} are gone for good, and pairings that need the unit are blocked. Mark ${stateLabel('missed')} only once recruiting is truly impossible; ${stateLabel('not-recruited')} rules out nothing.`,
      'The inbox then puts one loss item on top: what the loss broke, the flawless chance before it and after its re-solve (the reserve covering the unit steps in; marriages, passed skills and the roadmap re-solve around the gap), and what the re-solve changes. Nothing changes until you accept it or keep your plan.',
      `Died after their S-support? The app assumes their child can still be recruited; that rule is unverified (${assumption}), and you can override it in ${validation}. The Wishlist tab’s children ledger shows each child’s ${ledgerStatus}.`,
    ],
    jump: { to: 'roster', target: 'state-strip' },
    terms: [{ term: 'loss item', def: 'The inbox’s one entry after a recorded death, missed recruit or off-plan marriage: its re-solve, with the flawless chance before and after, never applied until accepted.' }],
  },
  {
    id: 'strongest',
    question: 'Who’s strongest overall?',
    answer: `${allChildren}: every child’s best score, ranked.`,
    jump: { to: 'leaderboard', target: 'leaderboard' },
    terms: [
      SCORE,
      PAIRING,
      { term: 'variable parent', def: 'The parent your marriage picks (the other, the fixed parent, it always has). A child’s table compares them row by row.' },
      { term: 'blocked pairing', def: 'A pairing your roster rules out (✕): a unit it needs is dead, missed or married to someone else.' },
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
    answer: `Expand the child’s Robin row with ▸: its asset × flaw heatmap scores every Robin under your preset (the name itself opens Robin’s page on that Robin). The run’s Robin is chosen by flawless chance, not by one child: the Run view’s Robin card compares Robins, and you ${lock} one there.`,
    jump: { to: 'child', target: 'robin-heatmap', robinRow: true },
    lockedAnswer: 'Robin is locked, so there’s nothing left to choose.',
    terms: [],
  },
  {
    id: 'preset',
    question: 'Which preset suits this child?',
    answer: 'Switch the Scoring sidebar’s preset to compare its table under each one. The wishlist picks each unit’s class and build by flawless chance, from the route’s build templates; a preset never changes it.',
    jump: { to: 'child', target: 'scoring-preset' },
    terms: [
      {
        term: 'preset vs wishlist',
        def: `The Scoring sidebar’s preset is how the explorer (the tables, unit pages and front doors) scores, for every child at once. ${EXPLORER_NOTE}`,
      },
    ],
  },
  {
    id: 'scoring',
    question: 'Can I change how children are scored?',
    answer:
      'Yes: the preset, the basis, the Spd target and edits to a preset’s weights re-score the explorer (the tables, unit pages and front doors). ' +
      'They never change the wishlist, which ranks by flawless chance.',
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
    id: 'play-context',
    question: `What does the ${playContext} change?`,
    answer:
      `What the explorer (the pairing tables, unit pages and front doors) builds for: ${CONTEXT_LABELS.apotheosis}, ${CONTEXT_LABELS['main-story']} (Lunatic/+), ` +
      `${CONTEXT_LABELS['full-route']} or ${CONTEXT_LABELS.all}. It sets the default target breakpoint and whether DLC classes are reachable. It starts from your run’s route; ` +
      'another one only changes what you explore, never your run: the wishlist reads its build templates from the route.',
    jump: { to: 'here', target: 'play-context' },
    terms: [],
  },
  {
    id: 'assumption',
    question: `What does ${assumption} mean?`,
    answer: `A game rule the sources couldn’t verify. ${validation} lists each one with its sources (some are single-source, some have none) and lets you override the values play can’t settle. The rules play can settle are open rules: the Why panel’s Stated assumptions tab (the headline’s Stated assumptions link, on the Run view or the Wishlist tab) lists them by stakes (the flawless points that turn on each), each with its check, after the blind spots and before the model mismatches, the learned EXP corrections and the checked rules. Each is checked in Record results when a map offers its check, or answered by hand there from outside this run, and reopened there. Answers are kept for every run and survive Clear all.`,
    jump: { to: 'log', target: 'stated-assumptions' },
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
      'Each child is scored in your Scoring sidebar preset; rows are sorted by the best child, so one great child beats two middling ones.',
      'Marks show a marriage that happened, a dead partner, and a blocked marriage with why.',
      'Each row names the pair’s support curve: most marriages are slow (S in 8 maps fighting together at best), and each woman has one fast husband (S in 7), most also a medium one.',
      'It never changes your plan: Wishlist entry → on the page opens the unit’s row on the Wishlist tab, where a marriage edit shows what the marriage costs your run.',
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
      'Partners show Morgan, plus the partner’s own child where Robin is a parent. With a child partner, Morgan uses that child’s best pairing left, and says which.',
    ],
    jump: { to: 'robin', target: 'robin-preview' },
    terms: [{ term: 'preview', def: 'A Robin tried on Robin’s page while the Run facts leave Robin open. It never writes to the Run facts.' }],
  },
  {
    id: 'front-door-pairings',
    question: 'What’s true of this child whoever its parents are?',
    answer: [
      'A child’s front door (Units › Children) shows what every pairing shares: its fixed parent, start class, default class set, personal growths, and what the fixed parent always passes (Chrom’s Aether to Lucina).',
      'Its best parents show as tiles, ranked as the pairing table ranks them under the Scoring sidebar’s preset (the front door names it); a tile opens that pairing, and a link opens the full table. The wishlist’s parents for it are on the Wishlist tab: Wishlist entry → goes there.',
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
      `${OPINION_NOTE} Where a source’s tier strongly disagrees with the unit’s worth to your plan (rated S or A but worth under 1 point, or C or F but worth 5 points or more), the worth shows beside it, once the Wishlist tab has worked it out. It never shows on the Wishlist tab or in the inbox.`,
    ],
    jump: { to: 'unit', target: 'unit-opinion' },
    terms: [
      { term: 'unit opinion', def: 'What a named source says about one unit in a play context. Shown beside the explorer’s scores; the wishlist never reads it.' },
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
      'Record results makes the map’s entry, a copy of the last, and walks you through what changed: deployed units, the map’s recruits (pre-filled; mark one you didn’t recruit as Missed), deaths and marriages, convoy and gold as the map ended, shopping, side goals and renown, items used, then the checks the map offered.',
      'The Shopping step records what you bought, sold and forged after the map, each with its gold (pre-filled at the game’s price: worth for a buy, by uses left for a sale, by forge steps for a forge; type your own to override). The entry’s gold stays gold at the map’s end; gold after shopping is worked out, split into upkeep (more of an item you already held), seals and kit. The next entry, the preparation page and the flawless chance’s runs all start from the army as it left the shop.',
      'The Side goals and renown step ticks each side goal on the map (escaping Thieves, burnable villages, Chapter 18’s falling chests, a paralogue’s result) you secured, pre-filled when every item it holds turned up against the entry before. Renown is asked once for the run: the renown the file started with, then the rewards already claimed; after that it’s +10 per story map (paralogues and DLC maps count 0, an assumption), and the flawless chance places each reward on the map that reaches it. The Run view’s Side goals list pins any goal ahead to always take or skip; otherwise the solve chases or skips each one by what it does to the flawless chance, starting from chasing those that cost at most one action a turn.',
      'The Items used step lists the boosters, tonics and handovers you used in the map’s preparations, pre-filled from the plan’s “before this map” list: untick what you didn’t use and add what you did. It’s asked, not read from stat jumps, since a +2 over what was expected could be a level-up.',
      'The Checks step lists only the checks the map offered: open game rules no source settles (Rally’s EXP, Veteran on the back, the EXP bar through a seal, the internal level after an early promotion, supports past an unviewed rank, a tome’s miss, the item rules, and the rest of the in-play checklist) whose situation your plan already set up there. Each asks for what you saw (a number, or yes or no) or “Didn’t happen”; the tool works out the reading. The best reading makes a checked rule; the other switches the model at once and re-solves the plan (its proposals arrive in the inbox); neither keeps the rule open, marked unexpected, and the same unexpected value twice makes a model mismatch, a blind spot the forecasts admit while keeping the best reading. Every change to a rule relearns the EXP corrections from the log. Checked rules are kept for every run and survive Clear all.',
      'Against the entry before, it shows the uses each item spent on the map and what the map gave: an item the map’s chests, villages, drops or side goals hold, or a random find when no buy or map item is behind it.',
      'When a unit’s level resets, it proposes a class change (Master or Second Seal, used at the level from the last entry). Correct the seal or level if you used it mid-map, then record it.',
      'On Chapter 11, if Chrom has no recorded marriage, it asks who the game married him to at the map’s end: a candidate not married to someone else (a lost one included), or the Maiden. It pre-selects one only when his logged support ranks decide it (a single candidate at his highest rank, C or above: a rank counts only once its conversation is viewed); otherwise the game decided by support points the app can’t see (Olivia wins from 2 points with him when nobody else has a C, so she needs no rank), so pick who he married. The answer is recorded as a marriage.',
      'A child who joins gets its stats from its parents as the entry before the map logs them: the fixed parent and its spouse (Morgan: Robin and Robin’s spouse; Lucina: Chrom’s recorded wife, the Maiden’s side counting as 0). If either parent’s stats are missing there, the recruits step names that parent and leaves the child’s stats blank.',
      'On Classic a unit that falls is dead for good: a loss, with its loss item in the inbox. On Casual it comes back after the map with its place in the plan and its children, so it’s no loss: record the fall anyway, and it’s logged to check the forecast’s no-death chances, and What it cost prices the rest of the map it missed. Chrom or Robin falling is a Game Over: you reload and play the map again, so there’s nothing to record and Record results offers no button for them. A fall, death or miss recorded by mistake has an Undo. Anything you skip keeps its copied value.',
      'Each map you finish recording (Done) teaches the forecast: every unit it fielded gets a learned EXP correction, the EXP it earned on the recorded maps against what was forecast, shrunk toward ×1 by one map’s worth so a lucky map can’t swing it, and kept within ×0.5–×2. It’s a stated assumption applied only to the maps after the last recorded one; the Why panel’s Stated assumptions tab lists each factor with its evidence and has a switch to compare the forecast without it. The Run view’s Forecast learning section links there; its calibration line counts the recorded results inside the forecast’s 10th–90th percentile (about 80% when the forecast is honest) and their mean percentile (about p50 when it’s unbiased), with the maps where someone fell or died against the no-death forecast.',
    ],
    jump: { to: 'log', target: 'next-map' },
    terms: [
      { term: 'next map', def: 'A map your route and the maps you’ve cleared have opened.' },
      { term: 'map played', def: 'The map an entry records: a chapter, paralogue, xenologue, or “other”.' },
    ],
  },
  {
    id: 'inbox-after',
    question: 'What needs me before the next map?',
    answer: [
      'Recording a map re-solves your plan for about 5 seconds; what it finds arrives as proposals in the inbox, never applied on its own. A What changed card sits above the inbox until you press “Got it”: the flawless chance before the map and after (after a death it stays forward-only: no further deaths from here, with the army that’s left), each unit’s EXP against the forecast (with its percentile in the forecast’s spread: p50 is the median), the readings that moved, the improvements found, and What it cost: each event on the map in flawless points, priced on the same runs as if it hadn’t happened (a death or miss and what it broke, a milestone missed with a link to its re-solve, a fall, a level ahead of or behind the forecast, and one row when you spent more gold than the plan, naming the endpoint kit pieces it costs), rows under 0.1 points rolled up.',
      'After the Lock the inbox above Next map lists what needs you before that map: units at risk, each with the one change that brings its milestone back (a span pin or an EXP priority, made in one click); units behind, each with a re-solve proposal (the roadmap first, a wishlist change only when it does better); the re-solve’s proposals, marked required once your plan can no longer be met (a unit it needs lost, a marriage off it, a support that can’t be reached); the map’s actions (a pair’s earliest or last start, a skill to equip, a seal to pick up or buy, a class change due); and the checks the map offers, by stakes (the flawless points that turn on the rule, from the plan re-run under its other reading), with checks worth setting up when a rule’s stakes pass about 1 point and no map left sets it up: the edit that does, at its cost. You answer a check in Record results’ Checks step once the map is played. A death, a missed recruit or a marriage off the plan puts one loss item on top: what it broke, the flawless chance before the loss and after its re-solve (the reserve covering the unit steps in; marriages, passed skills and the roadmap re-solve), and what the re-solve changes. Nothing changes until you accept it (or keep your plan); until then Prepare says your plan predates the loss. Next map counts the open items as a nudge: you can always play anyway. Your edits and “anything else” stay below.',
    ],
    jump: { to: 'log', target: 'inbox' },
    terms: [
      { term: 'milestone', def: 'Something the adopted roadmap needs true by a point on the map order: a pair’s support rank, a skill learned, a child recruited or a class reached.' },
      { term: 'reading', def: 'A unit against its worst open milestone: on track (80% or more), at risk (one change brings it back to 80%) or behind (no single change can; it gets a re-solve proposal).' },
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
      'Before this map, in the preparation page’s column, is one checklist in the game’s own menu order: pick units and pair up, inventory and trade, use items, skills, armory and forge; then On the map. Each action says why (the milestone, item plan or shopping-list line it serves) and, once the solve’s worker has costed it, what it’s worth in flawless points: the chance the plan loses without it (a pair fighting apart, a unit sitting out, an item use, a skill, a class change or a side goal dropped; shopping lines and talks have none). This map’s shopping-list lines are its armory step; a later stop’s list stays in the Shopping list section.',
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

/** Going deeper's groups, in the order `? Guide` shows them: every entry in exactly one (#213). */
export const DEEPER_GROUPS: readonly { readonly title: string; readonly ids: readonly DeeperId[] }[] = [
  {
    title: 'Your run',
    ids: ['start', 'robin-choice', 'inbox-before', 'wishlist', 'why', 'matchups', 'deployment', 'threats', 'supply', 'record-results', 'inbox-after', 'loss', 'chapter-log', 'map-data', 'how-to-run', 'assumption'],
  },
  {
    title: 'Exploring',
    ids: ['strongest', 'pairing-build', 'robin', 'preset', 'scoring', 'play-context', 'unit-class-tree', 'unit-partners', 'robin-preview', 'front-door-pairings', 'unit-opinion'],
  },
];

/** The entry with this id. */
export const deeperEntry = (id: DeeperId): DeeperEntry => DEEPER.find((e) => e.id === id)!;

/** What an entry shows: its answer as a list of lines, and its jump; none once Robin is locked where that leaves nothing to choose. */
export function deeperView(entry: DeeperEntry, robinLocked: boolean): { answer: readonly string[]; jump: DeeperJump | undefined } {
  if (robinLocked && entry.lockedAnswer) return { answer: [entry.lockedAnswer], jump: undefined };
  return { answer: typeof entry.answer === 'string' ? [entry.answer] : entry.answer, jump: entry.jump };
}

/** The child a table jump shows: the last child opened, else the first of `children` (the ones in this run, in rail order). */
export function guideChild(lastOpened: ChildId | undefined, children: readonly ChildId[]): ChildId {
  return lastOpened && children.includes(lastOpened) ? lastOpened : children[0]!;
}

