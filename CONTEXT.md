# FE Awakening child unit optimizer

Compares every possible parentage of Fire Emblem Awakening's child units side by side, so a player can plan marriages for the best children.

## Language

### Units

**First-gen unit**:
A recruitable unit whose growths and max-stat modifiers are fixed game data, and who can marry to produce a child.
_Avoid_: Parent (a role, not a kind of unit), gen-1

**Child unit**:
A unit whose final growths, modifiers, classes and skills are derived from its two parents; its own data holds only personal growths, its fixed parent, and its possible variable parents.
_Avoid_: Kid, second-gen (except when speaking of a child acting as Morgan's parent)

**Parent profile**:
Everything one parent passes to a child — growths, max-stat modifiers, gender, class set and inheritable skills — resolved to concrete values. Built from a first-gen unit, from Robin with an asset/flaw applied, or from a child unit plus a chosen other parent.
_Avoid_: Parent stats, parent data

**Fixed parent**:
The parent a child unit always has (e.g. Chrom for Lucina, Robin for Morgan).

**Variable parent**:
The parent chosen by the player's marriage; the axis the pairing table compares.
_Avoid_: Other parent, spouse

**Pairing**:
One fully specified parentage of a child unit: the variable parent, plus Robin's asset/flaw wherever Robin is involved, plus a second-gen parent's own variable parent. One pairing is one table row.
_Avoid_: Combo, couple, marriage (a marriage is between two units; a pairing is about the child)

**Galedad**:
A father whose male-only classes turn into Pegasus Knight for a daughter (Donnel, Gaius, Robin (M)), giving her access to Dark Flier and Galeforce.

**Class set**:
The base classes a unit can Second Seal into. A child's is its default set plus the classes its variable parent passes to a child of its gender; Morgan's is every regular class for its gender plus the other parent's Villager, Taguel or Manakete.
_Avoid_: Class pool, class list

**Start class**:
The class a child joins in: the first class of its default set, or for Morgan the other parent's default base class (Tactician if that is Lord, Dancer or Conqueror).
_Avoid_: Default class (ambiguous with the default class set), base class

**Reachable class**:
Any class a child can be in: a class in its class set, a promotion of one, or the DLC reclass target for its gender (Dread Fighter, Bride).

### Data

**Game data**:
Cited facts about the game: units, classes, skills, and the inheritance rules that connect them.
_Avoid_: Static data, constants

**Curated data**:
Opinions layered over game data: skill ranks, builds, synergies and unit opinion, which may differ by context, each citing the source registry. Game data never depends on it.
_Avoid_: Tier list, meta

### Builds

**Play context**:
What the player is building for: Apotheosis, Main story (Lunatic/Lunatic+), Full route, or All. Filters which build templates apply; one global selection.
_Avoid_: Mode, difficulty

**Full route**:
A single playthrough that weaves the non-grind DLC xenologues into the main campaign and paralogues, with Apotheosis as the capstone. No grind maps; DLC skills are reachable. Its build templates are curated from the user's own play, not community sources.
_Avoid_: Hybrid run, DLC run

**Endpoint**:
The map a run is building its army for, with that map's deploy count; it defaults from the route (Full route → Apotheosis, Main story → Endgame). Unlike the play context, which picks the build templates, it is a single map with facts to plan against.
_Avoid_: Goal, end state, final chapter, endgame (Endgame is a map's name)

**Wishlist**:
The army a run aims to field at its endpoint: the endpoint's deploy count of units, arranged as they'll fight (each Lead with its Battery, healers, a Dancer), each with its endpoint class and 5-skill build, and each child with its parents and the skill each parent passes when the child is recruited. It ends with the reserves.
_Avoid_: Team, target army, roster (the Roster is the page of run facts and unit states)

**Reserve**:
A wishlist unit beyond the endpoint's deploy count, ordered by who steps in first when a wishlist unit is lost or falls behind.
_Avoid_: Bench (Benched is a unit state), backup

**Build template**:
A curated 5-slot skill loadout for one role, tagged with the play contexts it suits. Each slot is a fixed skill or an ordered preference group. Matched against a pairing's reachable skills to produce a coverage tier (5/5, 4/5, 3/5).
_Avoid_: Build (alone, when the template is meant), preset (a preset weights stats)

**Unit page**:
A first-gen unit seen on its own: its join data, class tree, build coverage over everything it can reach, what it passes as a parent, and pair-up bonuses. Opened from Units in the rail.
_Avoid_: Character page, profile

**Class tree**:
A unit's classes as base → promotion lines plus the DLC classes, each with the skills it teaches and their levels, starting skills marked.
_Avoid_: Class list

**Partners**:
A unit page's read-only list of everyone the unit can S-support, with the children each marriage produces (scored in their plan presets) and where the marriage stands: married, in the saved plan, dead or blocked. Sorted by the best child.
_Avoid_: Spouses, matches

**Preview** (Robin):
A Robin gender and asset/flaw tried on Robin's page while the Run facts leave Robin open. The page follows it; it is never written to the Run facts.
_Avoid_: Draft Robin, temporary Robin

**Front door**:
A child's overview page: what stays the same in every pairing (fixed parent, start class, default class set, personal growths, fixed passes), its best parents ranked as the pairing table ranks them, and whether it can marry Robin. It leads into the pairing table.
_Avoid_: Child page, child summary

**Unit opinion**:
What a named source says about one unit (first-gen, child or Robin) in a play context: role and tier in its words, classes, a 5-skill loadout, partners recommended and warned, a note and a citation. Curated from the source registry; shown beside the app's scores, never scored or merged across sources.
_Avoid_: Rating, review, expert score

**Join data**:
When and how a first-gen unit or Robin joins (chapter or paralogue, recruit condition), its join class and level, and its base stats per difficulty.
_Avoid_: Recruitment info, bases (alone)

**Starting skill**:
A skill a unit already has when it joins. A unit keeps every skill it learns, so a starting skill stays reachable even when its class set can't teach it (Walhart's Conquest, Priam's Luna).
_Avoid_: Personal skill (only Conquest and Shadowgift are personal)

**Rank decision**:
A curated skill-rank call that goes against a named source, kept with both values, the source and why (adopted, partly adopted or kept). Shown on the Skill card.
_Avoid_: Override, dispute

**Source registry**:
The list of named sources curated data cites, each with an ID (S1, S2…), a name, a kind (reference, guide, FAQ, blog, crowd-sourced, video creator), a link and its provenance. Build templates, synergies and conflicts cite it by ID; the app shows the name.
_Avoid_: References, bibliography

**Provenance**:
How a source reached the curated data and how far to trust it, e.g. read for the builds research, or AI summaries of videos checked against game data.
_Avoid_: Reliability, trust score

**Reclass cost**:
The number of distinct classes a unit must pass through, beyond its starting class line, to learn every class skill in a build.

### Scoring

**Effective cap**:
A child's maximum for a stat in a given class: the class's max stat plus the child's max-stat modifier, plus 10 (not HP) if Limit Breaker is assumed.
_Avoid_: Max stat (ambiguous between class max and the child's cap), cap (alone)

**Flawless chance**:
The chance a plan reaches and clears its endpoint with no unit dying, from the next map on; Chrom's or Robin's death is the same failure. Every map on the way counts, each played by the army the plan and the recruitment gates allow there. A wishlist's flawless chance is that of the best roadmap found for it.
_Avoid_: Score (alone), Σ, success rate, win rate

**Ceiling**:
The endpoint's flawless chance with every wishlist unit at its effective caps: the most a comp can do. Shown beside the flawless chance; no plan for that comp can beat it.
_Avoid_: Max score, potential

**Preset**:
A named set of per-stat weights used to score pairings, optionally flagged Mixed. Each build template role maps to one.
_Avoid_: Profile, build (a build is skills)

**Mixed**:
A preset flag meaning the unit attacks with whichever of Str or Mag is stronger; that one is scored, and the other is ignored as the off-stat.

**Score basis**:
What a score measures per stat: effective caps with Limit Breaker, effective caps without it, or total growth rates (the no-grind proxy).
_Avoid_: Mode

**Scoring role**:
Whether a unit is scored as the Lead (its own stats) or the Support (the pair-up bonus it gives a lead). Visitors see it as Lead / Battery, the deployment role a Support preset gives.
_Avoid_: Position, front/back

**Pair-up bonus**:
The stats a support unit adds to its lead: a tier from the support's raw stat, plus its class's pair-up bonus, plus a support-rank bonus where the class bonus is non-zero.
_Avoid_: Dual bonus (Dual Support gives hit/avoid, not stats)

**Target breakpoint**:
The Speed total a unit should reach to be "fast enough": one global value picked from the breakpoint list, defaulted by play context. Spd points up to it (plus the speed margin) score at the preset's steep to-target weight; points beyond score at its small beyond weight.
_Avoid_: Speed tier, threshold (alone)

**Speed margin**:
Extra Speed above the target breakpoint that still scores at the to-target weight, as a buffer against debuffs and faster enemies.
_Avoid_: Buffer, overhead

**Auto class**:
The class chosen per row as the one that scores highest under the current preset, role and basis, from the child's final-tier reachable classes.
_Avoid_: Best class (alone), default class (the child's starting class)

**Candidate preset**:
A preset a child's role is derived from: Physical, Magical and Mixed lead and Physical and Magical hard support for Lead, Battery for Battery, Rallybot for Staff/Rally.
_Avoid_: Core preset

**Niche preset**:
Any preset that isn't a candidate (V/V lead, Crisis/crit, Lancekiller, Armsthrift bruiser, Tank, Nostank, Staffbot). Never derived; a player reaches one only by choosing it.
_Avoid_: Special preset

**Standing**:
A child's place in the cast's spread under a preset: its best pairing that can still happen, scored, placed between the weakest and the strongest child's best (0–1). Everyone stands at 0 when the spread is zero.
_Avoid_: Rank (it keeps gap sizes), percentile

**Role preset**:
A child's highest-standing candidate preset within one deployment role, ties to menu order.

**Best role**:
The deployment role whose role preset gives a child its highest standing, ties to menu order. Always say Best role, never role alone.
_Avoid_: Role (alone), natural role

### Planning

**Forge**:
Raising a weapon's Mt, Hit or Crit at an armory: up to 5 intervals a stat (+1 Mt, +5 Hit, +3 Crit each), 8 in all, Crit capped at 50, each interval priced as a multiple of the weapon's worth. Any weapon with a worth can be forged except Mire.
_Avoid_: Upgrade, refine

**Effectiveness**:
A weapon's bonus damage against a unit type (flying, armored, beast, dragon, fell dragon, monster): bows against fliers, Beast Killer against beasts, Wyrmslayer against dragons.
_Avoid_: Weakness, super-effective

**Chapter log**:
A run's record of play: one **entry** per map played, in play order, each tagged with the map (or "other" for a skirmish or a grind map). The Roster's unit states and marriages come from the latest entry.
_Avoid_: Save file, history

**Snapshot**:
What an entry records about the army: each unit's class, level, promoted/reclassed status, EXP, stats (as the stat screen shows them, without pair-up), equipped skills, inventory with forges, and support ranks; plus the convoy, gold, unit states and marriages.
_Avoid_: State, save

**Convoy**:
The army's shared storage, recorded in each entry's snapshot with the gold on hand. Items there and in inventories hold their uses left and any forge (name and bonuses), checked against the item data.
_Avoid_: Storage, bag

**Next map**:
A map the run can play next: story maps and paralogues its cleared maps have unlocked, and on a Full route the DLC xenologues. Grind maps are never offered; they're logged as "other".
_Avoid_: Next chapter (paralogues and xenologues count)

**Record results**:
The guided flow after a map: it makes the map's entry (a copy of the last) and steps through deployed units, recruits, deaths and marriages, then convoy and gold. On Casual a fallen unit isn't recorded as dead.
_Avoid_: Save, end chapter

**Map solver**:
The engine's combat math for the next map: a lead and back, with a weapon and forge, against each enemy group and the boss on the run's difficulty. It doesn't plan movement.
_Avoid_: Simulator, AI

**Matchup**:
One lead and back against one foe: damage, whether one round kills (with and without dual strikes), doubling, the worst round the lead can take and whether it survives, hit and crit both ways.
_Avoid_: Forecast (the game's single-attack preview)

**Clear**:
A foe killed with the killer surviving: by the Lead in a player-phase exchange, or by the pair's counter in enemy phase.
_Avoid_: Kill (a kill can come with a death), one-round (a matchup verdict)

**Action**:
One unit's move in a turn; a pair acts through its Lead. A Dance grants another, and Galeforce grants one after a kill.
_Avoid_: Turn (a turn is every unit's phase), move

**Sustain**:
HP restored at the cost of an action: a heal (the healer's action), a potion (the unit's own) or Rescue.
_Avoid_: Healing (alone), recovery

**Preparation page**:
The page for getting ready for the next map, reached from Next map: its matchups first.
_Avoid_: Prep screen, battle prep

**Danger flag**:
Something on the next map that threatens a unit: a weapon effective against it, Counter against a melee unit, a boss that doubles it, or a round that can kill it. On Lunatic+ it counts the worst of the pool until the player records the skills seen.
_Avoid_: Warning (too broad)

**Loadout**:
The weapons a deployed unit takes into the next map, chosen from its inventory and the convoy by its matchups, then its other items; at most five.
_Avoid_: Equipment, kit (the endpoint kit is a plan's assumption)

**Supply list**:
Buys and forges that turn foes a deployed lead can't one-round into one-round kills, cheapest per foe first, within the gold recorded and from armories the run has opened. Random merchants aren't counted.
_Avoid_: Shopping list, shop advice

**Endpoint kit**:
The weapons, forges and potions a plan assumes each unit carries at the endpoint: what it already owns first, then the best the open armories sell, paid from the gold left after the run's upkeep, seals and promotions, and trimmed where that costs the fewest points of flawless chance.
_Avoid_: Loadout (the next map's), gear

**Expected stats**:
Stats projected from growths (personal plus class) along a unit's planned path, as a spread of likely values rather than a single line, and labelled as expected. They judge promoting now or later and are the projection behind the flawless chance; the next map's matchups use recorded stats.
_Avoid_: Projected stats, averages (alone)

**EXP priority**:
The units deployed on the next map, ranked by how much EXP each needs there to stay on track for the wishlist. Guidance on who should take which foes, never a turn-by-turn kill plan.
_Avoid_: Kill plan, feed list, XP budget

**EXP forecast**:
The expected EXP, and so the expected level range, each deployed unit ends a map with: the map's foes, the lineup's matchups and the EXP priority, with the kills shared among the units able to take them. Recalibrated from each recorded entry.
_Avoid_: EXP plan, projection (alone)

**Copy-forward**:
A new entry starts as a copy of the one before, with the map's recruits filled in from join data. Editing a past entry never changes later ones; they're flagged instead.
_Avoid_: Inherit, carry over

**Chapter guide**:
Named sources' tactics for a map (tactic, turn window, units assumed, citation), keyed by map and the difficulty the source played, kept side by side per source and apart from the chapter data's facts. Checked against the chapter data before entry.
_Avoid_: Walkthrough, strategy (alone)

**Chapter data**:
A map's cited facts on every difficulty: win and lose conditions, deploy count, forced units, recruits, bosses, enemy groups with their movement triggers, reinforcements, items and shops. From Fire Emblem Wiki at a fixed revision, cross-checked against Serenes Forest. Game data, not opinion.
_Avoid_: Walkthrough, map guide

**Lunatic+ rule**:
Lunatic+ is Lunatic plus two random skills per enemy from Pass, Hawkeye, Luna+, Vantage+, Counter, Aegis+ and Pavise+ (the last three not before Chapter 3). A rule, not separate enemy data.
_Avoid_: Lunatic+ enemy table

**Run facts**:
Facts fixed at the start of a playthrough: Robin's gender, asset and flaw, the **difficulty** (Normal, Hard, Lunatic, Lunatic+), the **mode** (Classic, Casual) and the **route** (Main story, or Full route with the non-grind xenologues and Apotheosis). Play context defaults from the route; changing the play context never changes them.
_Avoid_: Settings, run config

**Lock (Robin)**:
The Plan's pick-line action that writes the marriage plan's Robin into the Run facts it leaves open (facts already set stay) and pins Robin's marriage, if the plan marries Robin. Unlock by setting Robin's gender back to — in Run facts. "Lock" alone names only this.
_Avoid_: Lock for a pin (that is a pin), set Robin

**Unit state**:
Where a unit stands in the current run: Available, Not yet recruited (prunes nothing), Benched (soft), Missed or Dead (hard).
_Avoid_: Status (alone), availability

**Pin**:
A planned marriage the player has kept. Soft: the player can unpin it. It is **broken** for good when either unit is missed or dead, and **on hold** while either unit is benched (it returns when un-benched); either way it is a lost pin and frees the partner.
_Avoid_: Lock (reserved for Lock (Robin)), reservation, planned (every marriage in the marriage plan is planned; only a pinned one is kept)

**Rule-out**:
A marriage the player has forbidden. Soft: the marriage plan works around it until it is ruled back in.
_Avoid_: Ban, block (a blocked pairing is the roster's doing, not the player's)

**Marriage plan**:
One spouse per unit for the whole roster, chosen by the solver to maximise the sum of each child's priority × score (each child scored with its own preset), with marriages and pins fixed. Re-solved around losses and compared with the saved plan; among plans of equal value it keeps the saved plan's children.
_Avoid_: Backup (alone), optimal pairing

**Plan preset**:
The preset a child is scored with in the marriage plan — an output, not a curated default: the child's preset override if set, else the role preset of its role override, else the role preset of the role army fit gives it. A child out of the cast without an override (Morgan before Robin is set) uses the global preset. The pairing tables ignore it and use the global preset, except on a **visit**: a child opened from the marriage plan scores with its plan preset (its scoring role, Auto class) until the visitor leaves its table or sets the preset, scoring role or class.
_Avoid_: Child preset, default preset (ambiguous with the global one)

**Children ledger**:
The Roster page's one row per child: fixed parent, the marriage plan's pairing (or its parents' marriage), its best pairing that can still happen with Δ vs the plan, and where it stands — open, pinned, left out (it can still be born, but the marriage plan doesn't produce it: no score, priority 0, outscored in a husband shortage, or its parent benched), on hold (its parents' pin is on hold through a bench), parents married, plan broken (the saved plan's pairing, or without a saved plan its parents' pin, can no longer happen; a broken saved pairing is struck through before the plan's, with why it can't happen on the status), can't be born, or dead. Before Adopt, a child whose saved pairing is gone reads plan broken; after Adopt it reads left out. It edits the same priority and plan preset as the Plan sidebar.
_Avoid_: Child list, tracker

**Left out**:
A child that can still be born but the marriage plan doesn't produce, because it values the child at 0 (no score, priority 0), a higher-valued child won the husband it needed (outscored), or its fixed parent is benched. Amber and reversible through priority, preset or a pin, unlike can't be born (red, gone for good).
_Avoid_: Lost (ambiguous between left out and can't be born), dropped

**Deployment role**:
The job a deployed unit does in the army: Lead, Battery, Staff/Rally or Dancer. A child's comes from its plan preset, which army fit may have moved; a first-gen unit's is a tag the user sets, defaulted from a curated table. A preset's deployment role is usually its scoring role (Lead → Lead, Support → Battery, none → Staff/Rally), but Staffbot scores as Lead and deploys as Staff/Rally. No child can be a Dancer.
_Avoid_: Role (alone — ambiguous with scoring role and build template role), job, position

**Composition quotas**:
Per play context, a min–max range of deployed units for each deployment role plus a deploy cap, curated and editable. Counted over deployed first-gen units and every child the marriage plan produces, leaving out benched, missed and dead units; All uses Main story's. Out-of-range is a warning, never a block.
_Avoid_: Slots, army limits

**Role matrix**:
The Plan's table of every child's standing in each deployment role, with its best role, army fit's moves and the roles and presets the user pinned. Where role and preset overrides are set.
_Avoid_: Role grid, role picker

**Robin gain**:
How much more a child scores under its Lead role preset with Robin in the gene pool than without: the run's Robin once set, else the child's best Robin. A view of the children, never a Robin recommendation.
_Avoid_: Robin bonus, Robin value

**No-Robin view**:
The cast in a world without Robin: Robin is no one's parent, Morgan leaves the cast and Robin isn't deployed. Standing, roles and the plan rerun under it; pairing tables don't.
_Avoid_: Hide Robin

**Army fit**:
The last step of deriving roles, run on every re-plan: every child starts in its best role, and a composition quota moves a child only when it forces one — the child whose move costs the least standing. Staff/Rally is filled only from children whose planned pairing reaches a staff class or rally skill. Overrides and first-gen units count but never move; army fit never benches a child, and says which quota moved each child it moved.
_Avoid_: Suggest roles (replaced), auto-roles, role solver

**Role override**:
A deployment role the user pins for a child; the role preset inside it stays derived, so it stays correct when Robin or the settings change.
_Avoid_: Role lock

**Preset override**:
Any preset the user pins for a child, niche ones included; its deployment role comes with it. The only way to use a niche preset.
_Avoid_: Custom preset, user preset

**Blocked pairing**:
A pairing that contradicts the roster: hard when it can no longer happen (a unit is dead or missed, or married to someone else), soft when it only contradicts a pin or a bench.
_Avoid_: Invalid, disabled

### Verification

**Assumption**:
A game value or rule the sources couldn't verify. It has a default and known alternatives, and the user can override it.
_Avoid_: Guess, setting, config

**Assumption override**:
The user's replacement for an assumption's default. It recomputes every pairing, and it is saved in the browser until reset.
_Avoid_: Setting, preference (preferences are a wider set that includes overrides)

**Resolved disagreement**:
A value where the sources conflicted and the research picked a winner. It is listed with the winning and losing values and their sources. It is not an assumption, because it can't be overridden.
_Avoid_: Conflict, discrepancy
