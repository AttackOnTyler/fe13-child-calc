# Which Ellery notebook claims hold up against the game data?

For [#78](https://github.com/AttackOnTyler/fe13-child-calc/issues/78), on [Map: Unit build pages](https://github.com/AttackOnTyler/fe13-child-calc/issues/76).

**Input:** the notebook answers in `research/ellery/*.md` and `research/ellery-roles.md` on `origin/research/ellery-roles`. They are AI summaries of Ellery's videos. **Checked against:** `src/game-data/*.ts` at `origin/main` (139044b), the earlier research on `origin/research/{skill-inheritance,marriage-and-classes,builds-and-synergies,data-sources}` (all under `docs/research/`), and Serenes Forest (SF) and Fire Emblem Wiki (FEW) pages listed under [Sources](#sources).

**Verdicts:** **holds**, **wrong** (the correct fact is given), or **unverifiable** (opinion, or no primary source settles it). A skill or class counts as reachable if it is in the unit's class set or a promotion of one (`classes.ts:204-221` `PROMOTES_TO`), a DLC class (Dread Fighter for men, Bride for women; `classes.ts:233`), a DLC skill book (`skills.ts:208`), or a personal skill. The Gen 1 and child tables were checked with a script over `FIRST_GEN_UNITS`, `CHILD_UNITS`, `PROMOTES_TO` and `CLASS_SKILLS`.

## Summary

| Section | Holds | Wrong | Unverifiable |
|---|---|---|---|
| 1. Bonus units, DLC maps and DLC skills (q7) | 17 | 2 | 1 |
| 2. Mechanics (q8, q10) | 5 | 5 | 0 |
| 3. Walkthrough flags (q12, q14, q15) | 4 | 1 | 0 |
| 4. Gen 1 classes and 5-skill loadouts (q5, q6) | 24 | 6 | 0 |
| 5. Gen 1 spouse and inheritance cells (q5, q6) | 0 | 3 | 0 |
| 6. Children (q3) | 12 | 3 | 0 |
| **Total** | **62** | **20** | **1** |

The corrections that matter most:

1. **Proc order is wrong.** It is Lethality > Aether > Astra > Sol > Luna > Ignis > **Vengeance** (SF calculations). The notebook puts Lethality last and leaves out Vengeance. Its conclusion that Sol pre-empts Luna still holds.
2. **The Galedad rule is half wrong.** Only Gaius converts Fighter → Pegasus Knight. Donnel converts **Villager** → Pegasus Knight (his Fighter becomes Troubadour), and M!Robin converts nothing, because Pegasus Knight is already in Robin's own set. The list of Galeforce fathers for daughters (Gaius, Donnel, M!Robin) still holds.
3. **Six Gen 1 loadouts use a class or skill the unit can't reach:** Lon'qu (Skill +2), Ricken (Valkyrie), Cordelia (Tomefaire), Tiki (Tomebreaker), Basilio (Bow Knight), Flavia (Paladin, Bowfaire). Child builds: Brady can't be a Valkyrie. Owain can't have Chrom as a father.
4. **"Gerome and Yarne are locked out of Dark Mage" is wrong.** Henry or Libra passes Dark Mage to either. The Galeforce lockout holds.
5. **Some of the notebook's own flags were wrong.** Priam *does* come from SpotPass (Paralogue 23 is a SpotPass paralogue). Paragon *does* come from Lost Bloodlines (part 3). Validar *is* the Ch 6 boss. Stahl *does* join in Ch 2. "Of Sacred Blood" and "Flames on the Blue" *are* the Ch 13 and Ch 14 titles.
6. Inheritance locks **when the child's paralogue is entered**, not when it is generated (unlocked).

This resolves the open note in `src/curated/builds.ts:10-11` ("which xenologue gives which DLC skill is unchecked"). See §1.

## 1. Bonus units, DLC maps and DLC skills (q7)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1.1 | Champions of Yore gives **All Stats +2** | **holds** (part 3) | FEW DLC page: Champions of Yore 3 reward "All Stats +2" |
| 1.2 | Lost Bloodlines gives **Dread Fighter + Aggressor** | **holds** | FEW DLC page: Lost Bloodlines 2 gives the Dread Scroll. Aggressor is not a map reward: it is the Dread Fighter's level 15 class skill (`skills.ts:203`) |
| 1.3 | Lost Bloodlines gives **Paragon** (the flag doubted this) | **holds** (part 3) | FEW DLC page: Lost Bloodlines 3 reward "Paragon scroll". "Listed twice" matches parts 2 and 3 |
| 1.4 | Smash Brethren gives **Wedding Bouquet** and **Iote's Shield** | **holds** (parts 2 and 3) | FEW DLC page: SB2 "Wedding Bouquet", SB3 "Iote's Shield" |
| 1.5 | Rogues & Redeemers gives **Limit Breaker** | **holds** (part 3) | FEW DLC page: R&R 3 "Limit Breaker scroll" |
| 1.6 | Golden Gaffe / EXPonential Growth are gold and EXP farms | **holds** | FEW DLC page |
| 1.7 | Timing of each DLC map ("early to mid game", "postgame") | **unverifiable** | Ellery's difficulty judgement. The game doesn't gate these maps by chapter |
| 1.8 | Priam is a SpotPass unit (the flag said "paralog, not SpotPass") | **holds**, and so does the flag: both are true | FEW Paralogue: Paralogue 23 "The Radiant Hero" unlocks after Ch 25 **with SpotPass data**. SF recruitment: Priam, Paralogue 23, end of chapter |
| 1.9 | Priam's Ragnell: 15 Mt, 1–2 range, can't be forged | **holds** | FEW Ragnell: Mt 15, range 1–2, "Cannot be forged" |
| 1.10 | Aversa, Emmeryn, Walhart, Gangrel and Yen'fay join at the end of the game | **holds** | FEW Paralogue: Paralogues 18–22 all need Ch 25 cleared plus SpotPass data |
| 1.11 | Aversa has Shadowgift | **holds** | `skills.ts:129-130`. FEW Aversa |
| 1.12 | Aversa uses dark magic "in Dark Flier **or Sage**" | **wrong** | Aversa's set is Pegasus Knight, Wyvern Rider, Dark Mage (`units.ts:92`). Sage is not reachable. Dark Flier, Falcon Knight, Wyvern Lord, Griffon Rider, Sorcerer and Dark Knight are |
| 1.13 | Emmeryn is a high-Mag late staff bot | **holds** | Mag growth 55, Mag modifier +4, Priest/Pegasus Knight/Troubadour set (`units.ts:90`) |
| 1.14 | Walhart is a "**Great Knight** with Conquest" | **wrong** | He joins as a **Conqueror**, his personal special class (`units.ts:89`, `classes.ts:189-192`, FEW Walhart). Great Knight is reachable through Knight. Conquest holds (`skills.ts:131`) |
| 1.15 | Gangrel and Yen'fay are pre-promotes with few supports | **holds** | They can S-support only F!Robin (`supports.ts:57-59`) |
| 1.16 | Micaiah comes with Shadowgift and Rally Luck | **holds** (DLC version) | FEW Micaiah: DLC (Champions of Yore 3) Dark Mage with Anathema, Shadowgift, Rally Luck |
| 1.17 | Alm is a Dread Fighter with Aggressor | **holds** | SF DLC recruitment: Alm, Dread Fighter, Lost Bloodlines 2. Aggressor is the Dread Fighter class skill (`skills.ts:203`) |
| 1.18 | Einherjar / DLC heroes: no S-supports, no inheritance | **holds** | No Einherjar appears in `supports.ts` or the romantic support list (marriage-and-classes §1). DLC skills never pass (skill-inheritance §1, "Ineligible") |
| 1.19 | Skill effects: Rightful King +10 % proc rate; Aggressor +10 damage on player phase; Paragon is a training tool; Conquest removes armour and cavalry weaknesses; Shadowgift gives dark tomes outside Dark Mage classes | **holds** (all five) | `skills.ts:48, 134, 139, 131, 130`. Conquest negates "armour and beast" weaknesses. Cavalry weakness is the beast weakness |
| 1.20 | "SpotPass / late units are useless in the main story because they join at the end" | **holds** as a fact about timing | 1.10 |

## 2. Mechanics (q8, q10)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 2.1 | Proc order is Aether > Astra > Sol > Luna > Ignis > Lethality | **wrong**. It is **Lethality > Aether > Astra > Sol > Luna > Ignis > Vengeance**. The conclusion "Sol pre-empts Luna" holds | SF calculations quotes that order word for word. builds-and-synergies §1 rule 4 (`docs/research/builds-and-synergies.md:24,35`). `src/curated/synergies.ts:42-54` already encodes Vengeance as last |
| 2.2 | Vengeance formula (the flag). The notebook gives no formula, only "healing lowers Vengeance damage on the next attacks" | **holds**. The formula is +⌊(max HP − current HP)/2⌋ to attack, fired at Skl×2 % | FEW Vengeance. `skills.ts:109` ("adds half the user's missing HP", `Skl×2 %`). `src/curated/synergies.ts:57` (Renewal vs Vengeance) |
| 2.3 | Vantage + Vengeance + Wrath + Nosferatu is a "**100 % crit** EP loop" | **wrong** | Wrath is +20 crit below half HP (`skills.ts:77`), not a guaranteed crit. The near-100 % part is Vengeance's *activation* at Skl ≥ 50 (`docs/research/builds-and-synergies.md:42,56`) |
| 2.4 | Procs don't fire from the back (dual strikes). Faires do | **holds** | `docs/research/builds-and-synergies.md:23` (rule 3, SF / community sources) |
| 2.5 | Inheritance: the child gets each parent's **last equipped** skill | **holds** | skill-inheritance R2–R4 (`docs/research/skill-inheritance.md`, §1): the lowest *eligible* equipped skill; if it is ineligible, the next one up |
| 2.6 | Inherited skills are fixed "**when the paralog is generated/entered**" | **holds for "entered", wrong for "generated"** | SF children: "Skill inheritance occurs at the moment you enter the mission required to recruit the child". Unlocking the paralogue (the S-support) fixes nothing. skill-inheritance R5. For Lucina it is Ch 13 |
| 2.7 | Galedad: "Fighter → Pegasus Knight via Gaius, Donnel and M!Robin" | **wrong as stated**. Gaius: Fighter → Pegasus Knight. **Donnel: Villager → Pegasus Knight, Fighter → Troubadour.** M!Robin: no conversion, Pegasus Knight is in Robin's own set. All three do give a daughter Pegasus Knight, so the Galeforce fathers list holds | `units.ts:60-61, 66-67` (`passesClasses.daughter`). `classes.ts:224-230` (Robin passes every regular class of the child's gender). SF children substitution table: "Gaius: Pegasus Knight", "Donnel: Pegasus Knight, Troubadour". marriage-and-classes §3.3 (`docs/research/marriage-and-classes.md:165`) |
| 2.8 | Lv 30 trick: a special class at level 30 can Second Seal straight into an advanced class | **holds** | SF class sets: "If a character is Level 10 or over in a promoted class (or Level 30 in a Special class), the promoted classes … will also be available". Special classes are Villager, Dancer, Taguel, Manakete and others (`classes.ts:180-185`) |
| 2.9 | Lv 30 trick examples: "Olivia → Dark Flier; Panne, Nowi, Nah → Wyvern Lord **or Sage**" | **wrong for Panne → Sage** (Panne has no Mage: Taguel, Thief, Wyvern Rider, `units.ts:65`). Olivia → Dark Flier, Panne → Wyvern Lord, and Nowi or Nah → Wyvern Lord or Sage all hold (`units.ts:71,76`, `children.ts:47`) | as cited |
| 2.10 | Morgan gets every non-special class | **holds** | `children.ts:43-44`, `classes.ts:224-230`. Special classes come only from the other parent (marriage-and-classes §3) |

Counted in the summary as 5 holds (2.2, 2.4, 2.5, 2.8, 2.10) and 5 wrong (2.1, 2.3, 2.6, 2.7, 2.9). 2.6 counts as wrong because "generated" is the first of the two readings the notebook gives.

## 3. Walkthrough flags (q12, q14, q15)

The walkthrough files flag some facts as slips. Several of those flags are themselves wrong.

| # | Claim (flag) | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Validar is the Ch 6 boss (the flag calls it a slip) | **holds** | FEW *Foreseer*: Ch 6 boss "Validar, a Sorcerer". Gaius and Panne are recruited there, as q12 says |
| 3.2 | Stahl joins in Ch 2 (the flag calls it a slip) | **holds** | SF recruitment (main story): Stahl, Vaike, Miriel "Chapter 2" |
| 3.3 | Chapter titles "Sacred Blood", "Flames on the Blue" (the flag calls them wrong) | **holds** | FEW *Fire Emblem Awakening*: Ch 13 "Of Sacred Blood", Ch 14 "Flames on the Blue" |
| 3.4 | "Ch 24: Excellence", "Ch 21: Algol" | **wrong** | Ch 21 is "Five Gemstones", Ch 24 "Awakening" (FEW) |
| 3.5 | Ch 23: Validar is the boss, and Basilio and Flavia are free units there | **holds** | SF recruitment: both join "automatically after defeating Validar" in Ch 23. FEW Basilio: "after defeating Validar once", so they join mid-chapter and can be deployed |

The rest of the walkthroughs (rosters, items, turn counts) was not checked line by line. Treat them as flagged.

## 4. Gen 1 final classes and 5-skill loadouts (q5, q6)

Where a skill is "learned in", the table names the class that teaches it (`skills.ts:158-205`).

| Unit | Class set (`units.ts`) | Verdict | Unreachable class or skill, and the fix |
|---|---|---|---|
| Chrom | Lord, Cavalier, Archer | **holds** | — (Charm, Dual Strike+: Lord. Aether, Rightful King: Great Lord. Bowfaire: Sniper) |
| Lissa | Priest, Pegasus Knight, Troubadour | **holds** | — |
| Frederick | Cavalier, Knight, Wyvern Rider | **holds** | — (Lancebreaker: Griffon Rider) |
| Sully | Cavalier, Myrmidon, Wyvern Rider | **holds** | — (Assassin through Myrmidon) |
| Virion | Archer, Wyvern Rider, Mage | **holds** | — |
| Stahl | Cavalier, Archer, Myrmidon | **holds** | — (Astra: Swordmaster) |
| Vaike | Fighter, Thief, Barbarian | **holds** | — |
| Miriel | Mage, Troubadour, Dark Mage | **holds** | — |
| Sumia | Pegasus Knight, Knight, Priest | **holds** | — |
| Kellam | Knight, Thief, Priest | **holds** | — |
| Donnel | Villager, Fighter, Mercenary | **holds** | — |
| Lon'qu | Myrmidon, Thief, Wyvern Rider | **wrong** | **Skill +2** is an Archer skill (`skills.ts:167`). Lon'qu has no Archer. Use Avoid +10 / Vantage (Myrmidon), Quick Burn or a breaker |
| Robin | every regular class of Robin's gender plus Tactician (`classes.ts:227`) | **holds** | Dark Flier and Galeforce are correctly marked (F). The alternative Rally Strength is Warrior-only (male), so F!Robin can't take it |
| Ricken | Mage, Cavalier, Archer | **wrong** | **Valkyrie** is female-only and a Troubadour promotion (`classes.ts:178, 220`). Ricken's magic classes are Sage and Dark Knight |
| Maribelle | Troubadour, Pegasus Knight, Mage | **holds** | — |
| Panne | Taguel, Thief, Wyvern Rider | **holds** | — |
| Gaius | Thief, Fighter, Myrmidon | **holds** | — |
| Cordelia | Pegasus Knight, Mercenary, Dark Mage | **wrong** | **Tomefaire** is a Sage skill (`skills.ts:192`). Cordelia's tome classes are Sorcerer and Dark Knight, and neither teaches it. Sorcerer as a class holds |
| Gregor | Mercenary, Barbarian, Myrmidon | **holds** | — |
| Nowi | Manakete, Mage, Wyvern Rider | **holds** | — |
| Libra | Priest, Mage, Dark Mage | **holds** | — |
| Tharja | Dark Mage, Knight, Archer | **holds** | — |
| Anna | Thief, Archer, Mage | **holds** | — |
| Olivia | Dancer, Myrmidon, Pegasus Knight | **holds** | — (Special Dance and Luck +4: Dancer) |
| Cherche | Wyvern Rider, Troubadour, Priest | **holds** | — |
| Henry | Dark Mage, Barbarian, Thief | **holds** | — (Barbarian is listed as a "final" class, but it is a base class) |
| Say'ri | Myrmidon, Pegasus Knight, Wyvern Rider | **holds** | — |
| Tiki | Manakete, Wyvern Rider, Mage | **wrong** | **Tomebreaker** is a Sorcerer skill (`skills.ts:193`). Tiki has no Dark Mage |
| Basilio | Fighter, Barbarian, Knight | **wrong** | **Bow Knight** is a Mercenary or Archer promotion. Basilio's classes are Warrior, Hero, Berserker, General and Great Knight. The skills hold |
| Flavia | Mercenary, Thief, Knight | **wrong** | **Paladin** needs Cavalier, and **Bowfaire** needs Sniper (Archer). Flavia has neither. Her bow class is Bow Knight (Rally Skill, Bowbreaker) |

## 5. Gen 1 spouse and inheritance cells (q5, q6)

The q6 flag says "spouse" means a pair-up partner for Basilio and Flavia. Checked against `supports.ts:22-36, 49-61`:

| # | Cell | Verdict | Evidence |
|---|---|---|---|
| 5.1 | Chrom's partners include **Frederick**; Kellam's include **Frederick** and **Sumia** | **wrong** as spouses | Two men can't S-support. Sumia's list is Chrom, Frederick, Gaius, Henry, M!Robin only (`supports.ts:35`). They can only be pair-up partners |
| 5.2 | Basilio × Flavia | **wrong** as spouses (the flag was right) | Both can S-support **only Robin** (`supports.ts:53, 59`; marriage-and-classes §1). They can only be pair-up partners |
| 5.3 | Lissa "passes Dark Mage to Owain" | **wrong** | Lissa has no Dark Mage (`units.ts:50`). Owain's Dark Mage comes from a Henry or Libra father (`units.ts:72, 79`) |

Every other spouse named in q5 and q6 is a valid S-support.

## 6. Children (q3)

The "Parents" column is read as the recommended variable parent. "Build" classes are checked for the child's default set (`children.ts:34-48`) plus what those parents pass.

| Child | Verdict | Notes |
|---|---|---|
| Lucina | **holds** | Falcon Knight and Sage need a Sumia, Maribelle or F!Robin mother. Sully gives neither |
| Owain | **wrong** (parent) | **Chrom can't marry Lissa** (his sister; `supports.ts:23-24`). Sorcerer needs Henry or Libra, and Sage comes through Priest |
| Inigo | **holds** | Sniper needs Chrom, Stahl or Virion (Archer). Lon'qu doesn't give it. Dread Fighter is DLC |
| Brady | **wrong** (build) | **Valkyrie is female-only** (`classes.ts:178`). Sage holds. Sorcerer needs Libra or Henry |
| Kjelle | **holds** | All in her default set (Knight, Cavalier, Myrmidon, Wyvern Rider) |
| Cynthia | **holds** | Sorcerer needs Henry |
| Severa | **holds** | All in her default set |
| Gerome | **holds** | Berserker needs Barbarian: Vaike, Gregor or Henry. Frederick doesn't give it |
| Morgan | **holds** | Falcon Knight only for a daughter. Manakete only for a daughter of Nowi, Tiki or Nah |
| Yarne | **holds** | Wyvern Lord needs Frederick, of the three listed |
| Laurent | **holds** | All in his default set |
| Noire | **holds** | All in her default set |
| Nah | **holds** | Trickster needs Thief: Gaius or M!Robin. Donnel and Ricken don't give it |
| "Gerome and Yarne are locked out of Galeforce **and Dark Mage**" | **wrong** for Dark Mage | Henry or Libra can marry Cherche or Panne (`supports.ts:29, 33`) and passes Dark Mage (`units.ts:72, 79`). The Galeforce lockout **holds**: neither mother has Pegasus Knight, and no Gen 1 father can be a Dark Flier |
| "Laurent and Noire get Dark Mage innately (via Tharja)" | **holds**, but Laurent's comes from **Miriel** | `children.ts:45-46`, `units.ts:57` |

Counted in the summary as 12 holds (the 11 child rows marked holds, plus the Laurent/Noire claim) and 3 wrong (Owain, Brady, and the Dark Mage lockout).

## What can be curated as is

- **DLC map → skill** (§1): CoY 3 → All Stats +2; LB 2 → Dread Scroll (Aggressor, Resistance +10); LB 3 → Paragon; SB 2 → Wedding Bouquet (Rally Heart, Bond); SB 3 → Iote's Shield; R&R 3 → Limit Breaker. This can go straight into curated data.
- **Gen 1 loadouts:** 24 of 30 as written. The other six need the one-cell fixes in §4.
- **Child builds:** usable as a "suggested classes" list only together with the parent conditions in §6.
- **Not usable as is:** the proc order (use SF's), the Galedad wording, and the "100 % crit" line.

Not checked: tier letters, deployment counts, seal shop timing (Master Seal after Ch 12, Second Seal after Ch 16), pair-up numbers such as Kellam's "+6 Def / +4 Str at C", and walkthrough rosters beyond §3. These are opinions or need the video.

## Sources

- SF, *Calculations* (proc priority): https://serenesforest.net/awakening/miscellaneous/calculations/
- SF, *Children* (inheritance timing, gender substitution): https://serenesforest.net/awakening/characters/children/
- SF, *Class sets* (Lv 30 special class rule): https://serenesforest.net/awakening/characters/class-sets/
- SF, *Recruitment: main story*: https://serenesforest.net/awakening/characters/recruitment/main-story/
- SF, *Recruitment: DLC*: https://serenesforest.net/awakening/characters/recruitment/dlc/
- FEW, *Downloadable content in Fire Emblem Awakening*: https://fireemblemwiki.org/wiki/Downloadable_content_in_Fire_Emblem_Awakening
- FEW, *Paralogue* (SpotPass paralogues 18–23): https://fireemblemwiki.org/wiki/Paralogue
- FEW, *Priam*: https://fireemblemwiki.org/wiki/Priam. *Ragnell*: https://fireemblemwiki.org/wiki/Ragnell
- FEW, *Walhart*: https://fireemblemwiki.org/wiki/Walhart. *Aversa*: https://fireemblemwiki.org/wiki/Aversa. *Micaiah*: https://fireemblemwiki.org/wiki/Micaiah. *Basilio*: https://fireemblemwiki.org/wiki/Basilio
- FEW, *Vengeance*: https://fireemblemwiki.org/wiki/Vengeance
- FEW, *Fire Emblem Awakening* (chapter list): https://fireemblemwiki.org/wiki/Fire_Emblem_Awakening. *Foreseer* (Ch 6): https://fireemblemwiki.org/wiki/Foreseer
- Repo: `src/game-data/{units,children,classes,skills,supports}.ts` at 139044b. `docs/research/skill-inheritance.md`, `docs/research/marriage-and-classes.md`, `docs/research/builds-and-synergies.md` on their `origin/research/*` branches
