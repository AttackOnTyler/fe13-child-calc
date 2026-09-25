# What chapter data exists, and from which sources?

Resolves #90 (part of #87, Map: Route planner). Researched 2026-09-24 against `origin/main` at `139044b`.

This is a findings file, not a data file. It covers the 77 maps in scope: Premonition, Prologue, Chapters 1–25, Endgame, Paralogues 1–23 and the 25 DLC xenologues (Apotheosis included). Every comparison between Serenes Forest (SF) and Fire Emblem Wiki (FEW) below was done by script over the whole table, unless it says "spot-check" (see §8). FEW pages are cited by the `oldid` that was read. The appendix lists them all.

## Summary

The short answer: **FEW is the only source with a page for every map, and it covers every field in the ticket except tile-level terrain.** SF has no per-chapter pages for Awakening. It publishes only cross-cutting tables (bosses, shops, merchants, item locations, paralogue conditions, skills), plus Lunatic-only enemy tables on its wiki. Those tables are the independent cross-check, and they agree with FEW on almost everything.

| Field | Best source | Coverage | Format | Cross-check result |
|---|---|---|---|---|
| **Objective, defeat condition** | FEW `{{ChapData}}` `victory=` / `defeat=` | 77 / 77 maps | Template fields. Trivial to parse | Single source. FEW's objective boss names match SF boss data |
| **Deploy count** | FEW `{{ChapData}}` `ally=` | 77 / 77 | `1–13{{h\|+1\|Upon Say'ri being recruited}}`: a min–max range plus mid-map joins in hover notes. Needs a small parser | Single source (no SF equivalent). Apotheosis `ally=20` matches the user's 20 |
| **Forced units** | FEW `{{ChapChars}}` `forced1=` + `defeat=` | 77 / 77 | Template fields | Single source. Chrom on every story map. Chrom **and** Robin on Ch 23. None listed for Golden Gaffe, EXPonential Growth, Infinite Regalia, Apotheosis |
| **Recruits and how** | FEW `{{NewUnit}}` `recruitment method=`; SF recruitment tables | FEW 77 / 77; SF every unit | FEW template (prose value); SF table | **0 conflicts.** FEW adds fallbacks (Cordelia at chapter end if cleared before turn 3; Say'ri at chapter end if she survives) |
| **Paralogue unlocks** | SF gaiden-chapters table; FEW lead sentence | P1–23 | SF table (with map-access footnotes); FEW prose | Agree |
| **Bosses** (class, level, stats, weapons, skills, drops) | SF boss data (N/H/L × chapters / paralogues / xenologues); FEW `{{BossStats FE13}}` | SF: every boss, 3 difficulties. FEW: every map except P22 (boss only in its enemy table) | Both tabular. SF marks drops in red and forges with `+`. FEW uses `type=drop` / `type=forged` | **Stats:** 302 rows compared, **9 disagree** (C1–C5, C7–C9). **Skills:** 150 compared, 0 disagree (spelling only). **Weapons:** 1 disagrees (C6) |
| **Enemy composition by difficulty** | FEW enemy-data tabs `Normal / Hard / Lunatic(+)` | Every story map and paralogue on all 3 difficulties (P22 thin: 9 rows, no boss block). DLC: N/H/L tabs except Golden Gaffe, EXPonential Growth, Infinite Regalia and Apotheosis (one set, difficulty-independent) | `{{ChapUnitCellFE13}}` per unit group with `#=` count, stats (N/H as `min~max` ranges), inventory, random-skill pool, AI notes. Very parseable | Against SF wiki Lunatic tables: 1,284 starting enemies, **all matched but 12** (C5, C10) |
| **Lunatic+ random skills** | FEW Difficulty page + every chapter page; SF skills page | Rule is global. The pool is printed on every FEW story/paralogue page | Prose + bullet list | Agree. Details in §4 |
| **Reinforcements, ambush timing** | FEW `Reinforcements` sections + unit `notes=`; FEW Reinforcement / Difficulty pages for the spawn rule; SF wiki Lunatic tables | FEW: a `Reinforcements` section on 22 story/paralogue maps and 12 DLC maps, all difficulties inline. SF wiki: Lunatic only, 21 maps | FEW: bulleted prose (turn → count, class, weapon, spawn point, difficulty qualifiers). SF: a stat table per turn | 21 Lunatic turn lists compared: 15 agree, **2 disagree** (C11, C12), 4 missing from SF |
| **Villages, chests, drops** | FEW `{{ChapItems}}` (per map); SF item locations (per item) | FEW: every map with items (none recorded for P3, P8, P10). SF: main story + paralogues, not DLC | FEW: item + "obtain" prose. SF: item → source type → chapter list | 199 (item, map, source) triples agree. **2 conflicts** (C13, C14). Each side has gaps (§6) |
| **Shop and armory unlocks** | FEW `{{ChapShop 3DS}}`; SF shops + merchants | 49 story/paralogue locations | Both tabular, with prices on FEW | **Armory 49/49 agree. Merchant pools 49/49 agree** |
| **Terrain notes** | FEW map image + `col`/`row` + incidental notes; FEW `Terrain/Nintendo 3DS games` for terrain effects | Map images for all 77; no per-tile data anywhere | Images and prose | **Gap.** No source publishes tile-level terrain |
| *(Bonus)* **Chapter strategy** | FEW `==Strategy==` | 73 / 77 (missing: P21, Rogues & Redeemers 2, The Future Past 2) | Prose, often written for Lunatic(+) | Opinion, not data. Relevant to the chapter-guide layer |

For #87: **chapter data can be built from FEW, with SF as the cross-check for bosses, Lunatic enemies, shops and items.** Record 14 disagreements (§7). Treat deploy counts, objectives and Normal/Hard enemy tables as single-source. Terrain is the one real gap.

## 1. What each site actually has

### 1.1 Serenes Forest

SF's Awakening section (https://serenesforest.net/awakening/) has **no chapter or walkthrough pages**. Its chapter-relevant material is spread across:

| SF page | Contents | Coverage |
|---|---|---|
| Boss data https://serenesforest.net/awakening/characters/boss-data/ (`{normal,hard,lunatic}/{chapters,paralogues,xenologues}/`) | Ch, name, class, Lv, 8 stats, Mov, weapon ranks, equipment (drops in red, forges as `+`), skills | Every boss on every map, N/H/L. Credits: Divine Strategy (kamikouryaku.com), Othin, FEA strategy wiki. Gaps: Summer and Hot-Springs Scramble Hard rows are blank. Harvest Scramble's Hard row repeats Normal (C9) |
| SF wiki "Awakening Enemy Data" https://serenesforest.net/wiki/index.php/Awakening_Enemy_Data (maintained by Othin, source kamikouryaku.com) | Full enemy tables with `{{tt\|Random\|…}}` random-skill notes, `Starting` / `Reinforcements` sections with `Turn N` headers, NPCs | **Lunatic only** for story (Pro–End, all 28) and 13 paralogues (4, 5, 8, 10, 11, 12, 14, 15, 16, 17, 19, 20, 23). No Normal or Hard story pages exist: all NM/HM links are red. DLC: see appendix. P1–3, 6, 7, 9, 13, 18, 21, 22 have no page |
| Shops https://serenesforest.net/awakening/miscellaneous/shops/ | Armory stock per location, story + paralogues | 49 locations |
| Merchants https://serenesforest.net/awakening/miscellaneous/merchants/ | Extra-item pool per location + a global "rare item" list. Merchants "sell the same items as the shop they're hosting, plus three extra items randomly selected from a pre-determined list" | 49 locations |
| Item locations https://serenesforest.net/awakening/miscellaneous/item-locations/ (8 sub-pages) | Per item: Playable / Enemy loot / Village / Chest / Event / Armoury / Merchant / SpotPass team | Story + paralogues. Credits: FEA 2ch strategy wiki |
| Gaiden chapters https://serenesforest.net/awakening/miscellaneous/gaiden-chapters/ | Paralogue unlock condition + map-access footnotes | P1–23 |
| Recruitment https://serenesforest.net/awakening/characters/recruitment/main-story/ | Unit, class, chapter, recruit method | All units. Already cross-checked by `research/unit-page-data` §2.2 |
| DLC (NA) https://serenesforest.net/awakening/miscellaneous/downloadable-content/north-america/ | Episode list, reward, star difficulty, prose description | All 25 episodes |
| Skills https://serenesforest.net/awakening/miscellaneous/skills/ | "Enemy-only Skills" table with a Difficulty column | Global |
| Hidden treasure https://serenesforest.net/awakening/miscellaneous/hidden-treasure/ | Event-tile rules (random contents) | Global |

### 1.2 Fire Emblem Wiki

FEW has one page per map. Main story, paralogues and DLC are all in `Category:Chapters of Fire Emblem Awakening` and `Category:Downloadable content chapters of Fire Emblem Awakening`, plus `List of chapters in Fire Emblem Awakening` (oldid 747880) for objectives and bosses at a glance. The story and paralogue pages share one template skeleton:

`{{Chapter Infobox}}` → `==Chapter data==` `{{ChapData}}` (victory, defeat, ally, enemy, map image, col, row) → `{{ChapChars}}` (`NewUnit` blocks with `recruitment method`, `forcedN`, `returnN`) → `{{ChapItems}}` (item + obtain) → `{{ChapShop 3DS}}` (`armoryN` + cost, `merchN` + cost, location) → `Event tiles` (coordinates) → `Enemy data` `{{Tab}}` (Normal / Hard / Lunatic(+), `{{ChapUnitCellFE13}}` rows) → Lunatic+ skill pool → `Reinforcements` → `NPC data` → `Boss data` (`{{BossStats FE13}}` per difficulty) → `==Strategy==`.

DLC pages use `{{ChapDataDLC}}`, which adds price, star difficulty and music. Apotheosis uses wave tabs (Wave 1 … 5, the choice waves 2 and 4, Secret waves 1–5) in place of difficulty tabs.

**Parseability:** high. Every field in the ticket except terrain is in a named template parameter, or in a bulleted section with a fixed shape. The awkward bits are the `{{h|…|…}}` hover notes (deploy increments, enemy-count splits, stat bonuses such as `29{{h|+5|Granted by Yewfelle}}`). Stats on Normal/Hard are `min~max` ranges, because those enemies get random growths. Lunatic stats are fixed (FEW Difficulty page).

## 2. Objective, deploy count, forced units, recruits

- **Objective / defeat:** FEW `victory=` / `defeat=` on all 77 pages. They are "Rout the enemy", "Defeat X", or Ch 3's key rule ("…or both door keys are lost before either door is opened", per the list page). Ch 6 adds Emmeryn's death as a defeat condition. SF has no equivalent table. Every "Defeat X" boss matches SF boss data.
- **Deploy count:** FEW `ally=` only. The shapes are fixed counts (Premonition 2, Prologue 4, Ch 1 4, Ch 2 8), ranges (`1–13`), and in-map joins as hover increments (`1–13+1 [Upon Brady being recruited]`). Ch 23 is `2–15` because Robin is forced. P23 is `1–30`, Rogues & Redeemers 3 `1–20`, and **Apotheosis `20`**, which matches the user's confirmation. No second high-trust source publishes deploy counts. Treat them as single-source.
- **Forced units:** `forced1=chrom l` on every story, paralogue and most DLC maps. Ch 23 also forces Robin. FEW lists no forced unit for The Golden Gaffe, EXPonential Growth, Infinite Regalia or Apotheosis. Apotheosis still shows "Chrom or Robin dies" as its defeat condition, so check in game whether Chrom is required there before relying on it.
- **Recruits:** FEW `NewUnit` gives each recruit's class, level, HP, inventory and method ("NPC, talk to with Chrom", "Enemy, talk to with Chrom three times" (Gangrel), "Visit the southwestern of the two mirage villages … with either Chrom or Miriel" (Laurent), "must gain at least 1 level" (Donnel), etc.). It agrees with SF recruitment on every unit (spot-check of all rows by eye; join chapters were already compared by script in `research/unit-page-data` §2.2). DLC recruits (Einherjar) and their conditions are on both. Est needs Algol defeated, Catria needs all five Annas to survive, and Palla needs no Revenant to escape.
- **Paralogue unlocks:** SF gaiden-chapters and FEW agree. P1/2/3/4/17 unlock after Ch 3/5/7/9/18. P5–16 unlock after Ch 13 once the parent is married (P7: Maribelle's S support; P12: Robin married), and some have map-access conditions. P18–23 need SpotPass data and Ch 25 cleared.

## 3. Bosses

**Sources.** SF boss data is the most compact source: one row per boss per difficulty, with drops and forges marked. FEW has the same in `{{BossStats FE13}}` per difficulty tab. Sub-bosses (Ch 20 Cervantes and Excellus, Ch 22's twelve Deadlords, Ch 23's flashback Validar) and P22 Aversa are only in FEW's enemy tables, not in `BossStats`.

**Cross-check (§8.2).** 153 SF rows matched a FEW `BossStats` block (story + paralogues, N/H/L). 48 more matched FEW enemy-table rows, and 101 xenologue rows matched FEW DLC pages. That is 302 rows, and **9 disagree** on stats (C1–C5, C7–C9; C9 is two blank SF rows). Skills: 150 story/paralogue rows compared, **0 real differences** (only "Defence"/"Defense" spelling). Equipment: every apparent difference but one is notation (SF `Tomahawk+` = FEW `{{Item|13|Tomahawk|type=forged}}{{h|*|14 Mt, 70 Hit}}`). The one real difference is C6.

**Lunatic+ bosses.** Neither site gives separate Lunatic+ boss rows, except FEW's `Lunatic+` tab for Grima (Endgame, The Future Past 3). Whether bosses also draw the two Lunatic+ skills isn't stated by either source (see §4).

## 4. Enemy composition by difficulty, and Lunatic+ random skills

**Composition.** FEW is the only source for **Normal and Hard** enemy tables (SF's NM/HM wiki pages don't exist). Each `{{ChapUnitCellFE13}}` row is a group (`#=` count) with class, level, stats, inventory (drops `type=drop`), random-skill pool ("Can have 0–1 skill(s) at random"), and AI notes ("Begins moving unprovoked on turn 3", "…if Ruger begins escaping"). SF wiki covers **Lunatic** for all story maps and 13 paralogues. FEW's Lunatic tab is labelled `Lunatic(+)`: L+ is the same data plus the L+ skills.

**Cross-check (§8.3).** All 1,284 "starting" enemy rows in SF wiki's Lunatic tables were matched against FEW's Lunatic tab by (class, level, HP, Str, Def) with counts. All match except P4 Vincent (C5) and P16's eleven Warriors (C10). FEW's tab has more rows because it also tabulates some reinforcements.

**How random skills work** (FEW Difficulty, oldid 737046, `=={{FE13}}==`):
- *Normal:* promoted enemies can have one skill from their class tree's pool, "generally limited from having stronger skills".
- *Hard:* unpromoted enemies can have one skill from their class pool; promoted enemies one, later two. Breakers and offensive skills become possible, as do forged weapons (+4 Mt/+10 Hit, later +8/+20).
- *Lunatic:* promoted enemies can have "three or even more skills" from their class tree's pool. From about halfway through, all enemies have Hit Rate +10, later Hit Rate +20. Enemy stats are fixed, where lower modes vary by one point.
- *Lunatic+:* "largely identical to Lunatic", but enemies get **two additional skills** at random from **Pass, Hawkeye, Luna+, Vantage+, Counter, Aegis+, Pavise+**. "Prior to chapter 3, enemies cannot have Counter, Aegis+, or Pavise+." The chapter pages agree: Prologue, Ch 1 and Ch 2 print the 4-skill pool and every later story/paralogue page prints the 7-skill pool (§8.4).
- SF skills page, "Enemy-only Skills" (Difficulty column): Vantage+, Luna+, Hawkeye, Pavise+, Aegis+ are "Lunatic+". Hit Rate +10 and Rightful God (Grima only) are "Lunatic~". Dragonskin (Grima, and Validar on Hard and up) is "Normal~". The same skills appear in Apotheosis on all difficulties. Pass and Counter aren't in SF's list because they're ordinary class skills, so this is not a disagreement. SF hints and secrets: L+ is "essentially the same as regular Lunatic, but enemies may possess terrifying Skills, which are unique to Lunatic+".
- **Not published by either source:** when the two L+ skills are rolled (chapter load, reset, per save), whether the draw is uniform, and whether bosses also get them. A planner flagging L+ dangers should present the pool as possibilities per enemy, not as fixed skills.

## 5. Reinforcements and ambush timing

**Spawn rule** (FEW Reinforcement, oldid 699855, and Difficulty): on **Normal**, reinforcements appear "at the start of a turn, before player phase". On **Hard and up**, they appear "at the start of enemy phase; can act on the turn they appear". These are the ambush spawns. They "may also appear on earlier turns than on Normal Mode". No SF page states the rule.

**Per map.** FEW has a `Reinforcements` section on 22 story and paralogue maps (Endgame's are infinite) and 12 DLC maps, written as `*Turn N` → `**count, class, weapon, spawn point`, with `<small>(Hard/Lunatic only)</small>` qualifiers and difficulty-specific turns such as Ch 24's "Turns 2–5 (Lunatic)/3–6 (Normal/Hard)". Other maps describe spawns inside unit `notes=`. Aggro timing ("begins moving unprovoked on turn N", or on a trigger) is in unit notes on 65 of 77 pages. This matters for the planner as much as reinforcements do. SF wiki gives Lunatic reinforcements as full stat tables under `Turn N` headers.

**Cross-check (§8.5):** of 21 maps with Lunatic reinforcement turns on either side, 15 agree exactly. 2 disagree (C11, C12). SF wiki has no reinforcement section for P10, P11 and P12, which FEW has. Ch 25's turn-3 group is in SF's "Starting" section, so it isn't a real difference.

## 6. Villages, chests, drops, shops

- **Items per map:** FEW `{{ChapItems}}` gives item + obtain text ("Visit village …", "Open eastern chest", "Dropped by enemy Hero (reinforcement)", and conditional rewards such as P6's per-kill Inigo rewards and P13's gold outcomes). SF item locations is organised per item. Comparing (item, map, source type) triples: **199 agree**. There are 2 conflicts (C13, C14). **SF has, FEW lacks:** all item data for P3, P8 and P10 (FEW's `ChapItems` is empty there). **FEW has, SF lacks:** the village items of P7 (5) and P11 (5), P14's Goddess Staff, Ch 14's Recover and Second Seal chests, and a few drops (Ch 6 Iron Sword and Wind, Ch 9 Elthunder, P18 Levin Sword). Use FEW first, fill from SF, and flag single-source rows.
- **Drops** are also marked in both boss tables and in FEW enemy rows (`type=drop`), so a planner can attach drops to enemies, not only to the map.
- **Event tiles:** FEW lists 2 per map by column/row (15–20 on Summer and Hot-Springs Scramble). Contents are random (SF hidden treasure).
- **Armory:** SF shops and FEW `ChapShop` armory lists **agree at all 49 locations**. FEW adds prices. A location's shop opens after its chapter is cleared (FEW: "After clearing this chapter, the shop at this location will become available"). FEW Difficulty: the preparations shop is disabled on Hard and up, and the Reeking Box costs 4,800 there.
- **Merchants:** SF's merchant pool and FEW's `merchN` **agree at all 49 locations**. There's no merchant data for Ch 24, Ch 25 or P18–23. **Note for #87's economy question:** Master Seal and Second Seal are in the merchant pools from the Prologue through Ch 10 and in P1–3, besides the armory unlocks the map issue already notes (Master Seal at Port Ferox, Ch 12; Second Seal at the Mila Tree, Ch 16; both confirmed by SF shops). Merchants appear at random and sell three random picks from the pool, so a planner can't count on them.

## 7. Disagreements found

IDs continue the repo's style (C for chapter data). "Likely" resolutions use the monotonicity check (Normal ≤ Hard ≤ Lunatic for the same unit) where it applies.

| ID | Item | SF | FEW | Suggested resolution |
|---|---|---|---|---|
| C1 | Ch 22 Draco (Sniper), **Normal** stats | 50 HP / 23 Str / 2 Mag / 25 Spd / 25 Def / 14 Res | 49 / 25 / 1 / 24 (+5 Yewfelle) / 18 / 10 | Unresolved. Hard and Lunatic agree. Needs a third source (kamikouryaku.com, which SF credits) |
| C2 | P3 Risen Chief, **Hard** Def | 3 | 7 | FEW (SF's N/H/L = 6/3/8 isn't monotone) |
| C3 | P9 Ruger, **Hard** Lck | 27 | 17 | FEW (SF 14/27/21 isn't monotone) |
| C4 | P15 Ezra, **Hard** Def | 9 | 18 | FEW (SF 16/9/22 isn't monotone) |
| C5 | P4 Vincent, **Lunatic** HP | 57 (boss page and SF wiki) | 56 (boss block and enemy row) | Unresolved. Both SF pages are Othin's, so they aren't independent |
| C6 | Ch 9 Campari, **Hard** weapon | Short Axe | Short Spear | FEW (SF's own Normal and Lunatic rows have Short Spear) |
| C7 | The Future Past 2 Morgan (F), **Hard** Lck | 14 | 15 | Unresolved, low impact |
| C8 | Harvest Scramble boss, **Hard** | Same numbers as SF's Normal row | Str 8, Skl 41, Spd 6, Lck 56, Def 5, Res 2 | FEW (SF looks copied from Normal) |
| C9 | Summer and Hot-Springs Scramble bosses, **Hard** | Blank | Full rows | FEW (SF gap) |
| C10 | P16 Warriors ×11, **Lunatic** HP | 73 | 72 | Unresolved |
| C11 | Ch 5 **Lunatic** reinforcement turns | 3, 5, 6 | 3, 4 (Hard/Lunatic only: 2 Wyvern Riders), 5 | Unresolved. Check in game or kamikouryaku |
| C12 | Ch 24 **Lunatic** last spawn | "On turn 2 … turn 3 … turn 4 … and on turn 6, all 6" (under a "Turns 2-5" header) | Turns 2–5 on Lunatic, 3–6 on Normal/Hard | FEW (SF contradicts its own header) |
| C13 | Ch 11 Spirit Dust | Chest | Dropped by enemy Sage | Unresolved |
| C14 | Ch 18 Killer Lance | Chest | Enemy drop | Unresolved |

Not counted as disagreements: forge notation (`+`) versus FEW's `type=forged`, "Defence"/"Defense", SF writing stat bonuses as `30 +2` where FEW writes the total with a hover note, and item-coverage gaps (§6).

## 8. Method

Scripts ran against the live sites on 2026-09-24. They aren't committed; this is a throwaway branch.

1. **Fetch.** FEW: MediaWiki API (`prop=revisions`, raw wikitext) for all 77 category members (story and paralogues 52, DLC 25), recording each `revid`. Also `Difficulty`, `Reinforcement`, `List of chapters…`. SF: HTML of the boss-data (9 pages), shops, merchants, item-location (8), gaiden-chapters, recruitment, DLC, skills and hints pages. SF wiki: `action=raw` for all 212 links on `Awakening_Enemy_Data`, of which 90 exist.
2. **Bosses.** Parsed SF boss rows. For each, took the FEW page, split `{{Tab}}` into tab labels, took `BossStats FE13` blocks whose tab names the difficulty, matched on class + level and compared 8 stats. Unmatched rows (sub-bosses) were matched against `ChapUnitCellFE13` rows by name + level in the same difficulty tab. Xenologues were matched the same way. Skills and equipment were compared as sets of `{{Item|13|…}}` names.
3. **Lunatic enemies.** Parsed each SF wiki Lunatic page up to its `Reinforcements` / `NPC` heading into (class, Lv, HP, Str, Def) rows, and compared multisets against FEW Lunatic-tab rows expanded by `#=`. Rows that failed only because SF writes capped values differently were checked by hand, and only C5 and C10 were real.
4. **L+ pool.** Extracted the `{{Item|13|…}}` list after "Lunatic+ mode is" on every FEW page. 49 pages have it: 46 print the 7-skill pool, and the Prologue, Ch 1 and Ch 2 pages print the 4-skill pool. Premonition, P22 and the DLC pages have no L+ section.
5. **Reinforcements.** `Turn N` values from FEW `Reinforcements` sections against `<b>Turn N</b>` headers in SF wiki Lunatic pages.
6. **Shops and items.** SF shop and merchant rows (merchant rows span two `<tr>`) against FEW `armoryN` / `merchN`, by location's chapter. SF item-location rows (item → source type → `Ch N` / `Par N` lists, ranges expanded) against FEW `ChapItems` obtain text classified as village / chest / drop.

## 9. Sources

| Source | Trust | Used for |
|---|---|---|
| FEW chapter pages (77, oldids in the appendix), `Difficulty` (oldid 737046), `Reinforcement` (oldid 699855), `List of chapters in Fire Emblem Awakening` (oldid 747880) | High; independently edited, structured templates | Primary source for every field |
| SF boss data, shops, merchants, item locations, gaiden chapters, recruitment, skills, hints, DLC (NA) | High; compiled from the JP strategy wikis (kamikouryaku.com, FEA 2ch wiki) | Cross-checks; paralogue conditions; L+ enemy-only skills |
| SF wiki `Awakening Enemy Data` (Othin) | High for what exists; Lunatic-only for the story | Cross-check of Lunatic enemies and reinforcements |
| kamikouryaku.com, FEA 2ch wiki (atwiki) | High (SF's upstream) | Not consulted. They're the tie-breakers for C1, C5, C7, C10, C11, C13, C14 |
| `research/ellery/q12–q15` (branch `research/ellery-roles`) | Low (AI summary; `research/ellery-claims` found wrong titles and bosses) | Not used as evidence |
| User's Gemini Notebook (about 101 sources) | Unknown mix | Not consulted: it needs the user's sign-in, and FEW already covers every map. Worth opening only for the terrain gap or a tie-break |

## 10. What this means for the spec (#87)

- **Chapter data layer:** one record per map (77), sourced from FEW by `oldid`: objective, defeat condition, deploy range + mid-map joins, forced units, recruits (method as text), items (village / chest / drop / conditional), event-tile count, armory + merchant pool, and per-difficulty enemy groups (class, level, stats or ranges, inventory, drops, random-skill pool, AI trigger), with reinforcement waves (turn, count, class, weapon, spawn point, difficulty filter). Boss rows are cross-checked against SF. Record the disagreements above as resolved or open, as in #13.
- **Difficulty is a dimension, not a variant.** Normal / Hard / Lunatic enemy data differ in counts, stats, weapons and reinforcement turns. Lunatic+ = Lunatic + a **rule** (2 of the pool, 4-skill pool before Ch 3), not separate data. DLC maps other than 4 have N/H/L. Apotheosis is difficulty-independent, with wave choices and a secret route.
- **Single-source fields to flag in the UI:** deploy counts, objectives, Normal/Hard enemy tables and aggro notes (FEW only).
- **Real gap: terrain.** No source publishes per-tile terrain. Options: show FEW's map image and link it, transcribe maps by hand for the planner's danger zones, or leave terrain out of the first version. That's a spec decision.
- **Economy note:** seals are also available from random merchants early on (§6), which bears on the "Economy" open question in #87.

## Appendix: per-map coverage

"Deploy" is FEW's `ally=` with hover notes shown in parentheses. "Reinforcement turns" are those listed in a FEW `Reinforcements` section; "—" means no such section (no reinforcements, or they're described in unit notes). "SF wiki enemy data" is which difficulties have a page ("all" = one difficulty-independent page).

| Map | FEW page (oldid) | Objective | Deploy (FEW `ally`) | New units | FEW reinforcement turns | SF wiki enemy data |
|---|---|---|---|---|---|---|
| Premonition | [Invisible Ties (premonition)](https://fireemblemwiki.org/w/index.php?oldid=754697) | Rout the enemy | 2 | — | — | all |
| Prologue | [The Verge of History](https://fireemblemwiki.org/w/index.php?oldid=741973) | Rout the enemy | 4 | Chrom, Robin, Lissa, Frederick | — | L |
| Ch 1 | [Unwelcome Change](https://fireemblemwiki.org/w/index.php?oldid=741770) | Rout the enemy | 4+2 (Upon Sully and Virion arriving) | Sully, Virion | — | L |
| Ch 2 | [Shepherds (chapter)](https://fireemblemwiki.org/w/index.php?oldid=742135) | Rout the enemy | 8+1 (Upon Miriel arriving) | Stahl, Miriel | — | L |
| Ch 3 | [Warrior Realm](https://fireemblemwiki.org/w/index.php?oldid=741809) | Defeat Raimi | 1–8+1 (Upon Sumia arriving)+1 (Upon Kellam being recruited) | Sumia, Kellam | — | L |
| Ch 4 | [Two Falchions](https://fireemblemwiki.org/w/index.php?oldid=693840) | Rout the enemy | 1–6 | Lon'qu | — | L |
| Ch 5 | [The Exalt and the King](https://fireemblemwiki.org/w/index.php?oldid=741857) | Rout the enemy | 1–9+2 (Upon Ricken and Maribelle arriving) | Ricken, Maribelle | 3, 4, 5 | L |
| Ch 6 | [Foreseer](https://fireemblemwiki.org/w/index.php?oldid=685293) | Rout the enemy | 1–10+2 (Upon Panne arriving and Gaius being recruited) | Panne, Gaius | — | L |
| Ch 7 | [Incursion](https://fireemblemwiki.org/w/index.php?oldid=701948) | Rout the enemy | 1–11+1 (Upon Cordelia arriving) | Cordelia | 5 | L |
| Ch 8 | [The Grimleal](https://fireemblemwiki.org/w/index.php?oldid=741956) | Rout the enemy | 1–10+2 (Upon Gregor and Nowi arriving) | Gregor, Nowi | — | L |
| Ch 9 | [Emmeryn (chapter)](https://fireemblemwiki.org/w/index.php?oldid=742082) | Rout the enemy | 1–12+2 (Upon Libra and Tharja being recruited) | Libra, Tharja | 5 | L |
| Ch 10 | [Renewal (chapter)](https://fireemblemwiki.org/w/index.php?oldid=741819) | Defeat Mustafa | 1–13 | — | 5, 6, 7 | L |
| Ch 11 | [Mad King Gangrel](https://fireemblemwiki.org/w/index.php?oldid=742013) | Rout the enemy | 1–13+1 (Upon Olivia arriving) | Olivia | 3, 4, 5, 6, 7, 8 | L |
| Ch 12 | [The Seacomers](https://fireemblemwiki.org/w/index.php?oldid=754984) | Rout the enemy | 1–12+1 (Upon Cherche arriving) | Cherche | — | L |
| Ch 13 | [Of Sacred Blood](https://fireemblemwiki.org/w/index.php?oldid=742107) | Defeat the Risen Chief | 1–12+1 (Upon Henry arriving) | Henry, Lucina | 3, 4, 5, 6, 7 | L |
| Ch 14 | [Flames on the Blue](https://fireemblemwiki.org/w/index.php?oldid=742076) | Defeat Ignatius | 1–13 | — | 3, 4, 5 | L |
| Ch 15 | [Smoldering Resistance](https://fireemblemwiki.org/w/index.php?oldid=742090) | Rout the enemy | 1–13+1 (Upon Say'ri being recruited) | Say'ri | — | L |
| Ch 16 | [Naga's Voice](https://fireemblemwiki.org/w/index.php?oldid=742218) | Defeat Cervantes | 1–14 | — | 4, 5, 6 | L |
| Ch 17 | [Inexorable Death](https://fireemblemwiki.org/w/index.php?oldid=742188) | Defeat Pheros | 1–14 | — | 8, 9, 10, 11, 12, 13 | L |
| Ch 18 | [Sibling Blades](https://fireemblemwiki.org/w/index.php?oldid=741909) | Defeat Yen'fay | 1–13 | — | — | L |
| Ch 19 | [The Conqueror](https://fireemblemwiki.org/w/index.php?oldid=741914) | Defeat Walhart | 1–15 | — | 4, 5, 6, 7, 8 | L |
| Ch 20 | [The Sword or the Knee](https://fireemblemwiki.org/w/index.php?oldid=742133) | Defeat Walhart | 1–15 | — | 4 | L |
| Ch 21 | [Five Gemstones](https://fireemblemwiki.org/w/index.php?oldid=741929) | Defeat Algol | 1–14 | — | 5, 6, 7, 8, 9 | L |
| Ch 22 | [An Ill Presage](https://fireemblemwiki.org/w/index.php?oldid=703669) | Defeat Aversa | 1–13 | — | — | L |
| Ch 23 | [Invisible Ties](https://fireemblemwiki.org/w/index.php?oldid=741846) | Rout the enemy | 2–15+2 (Upon Basilio and Flavia arriving) | Basilio, Flavia | 4, 5, 6 | L |
| Ch 24 | [Awakening (chapter)](https://fireemblemwiki.org/w/index.php?oldid=742151) | Rout the enemy | 1–15 | — | 2–5 (L) / 3–6 (N/H) | L |
| Ch 25 | [To Slay a God](https://fireemblemwiki.org/w/index.php?oldid=685912) | Defeat Aversa | 1–15 | — | 3, 4, 5, 6, 7, 8 | L |
| Endgame | [Grima (chapter)](https://fireemblemwiki.org/w/index.php?oldid=741863) | Defeat Grima | 1–16 | — | infinite | L |
| P1 | [Sickle to Sword](https://fireemblemwiki.org/w/index.php?oldid=741974) | Defeat Roddick | 1–8+1 (Upon Donnel arriving) | Donnel | — | — |
| P2 | [The Secret Seller](https://fireemblemwiki.org/w/index.php?oldid=742033) | Rout the enemy | 1–10 | — | — | — |
| P3 | [A Strangled Peace](https://fireemblemwiki.org/w/index.php?oldid=742001) | Rout the enemy | 1–10 | — | — | — |
| P4 | [Anna the Merchant](https://fireemblemwiki.org/w/index.php?oldid=742193) | Rout the enemy | 1–12+1 (Upon Anna being recruited) | Anna | — | L |
| P5 | [Scion of Legend](https://fireemblemwiki.org/w/index.php?oldid=742102) | Rout the enemy | 1–13+1 (Upon Owain being recruited) | Owain | — | L |
| P6 | [A Man for Flowers](https://fireemblemwiki.org/w/index.php?oldid=742030) | Rout the enemy | 1–13+1 (Upon Inigo being recruited) | Inigo | — | — |
| P7 | [Noble Lineage](https://fireemblemwiki.org/w/index.php?oldid=769016) | Defeat Xalbador | 1–13+1 (Upon Brady being recruited) | Brady | — | — |
| P8 | [A Duel Disgraced](https://fireemblemwiki.org/w/index.php?oldid=742211) | Rout the enemy | 1–13+1 (Upon Kjelle being recruited) | Kjelle | 2, 3, 4, 5 | L |
| P9 | [Wings of Justice](https://fireemblemwiki.org/w/index.php?oldid=742121) | Rout the enemy | 1–13+1 (Upon Cynthia being recruited) | Cynthia | — | — |
| P10 | [Ambivalence](https://fireemblemwiki.org/w/index.php?oldid=742184) | Defeat Nelson | 1–13+1 (Upon Severa being recruited) | Severa | 2, 3, 4 | L |
| P11 | [Twin Wyverns](https://fireemblemwiki.org/w/index.php?oldid=769229) | Rout the enemy | 1–13+1 (Upon Gerome being recruited) | Gerome | 4, 5 | L |
| P12 | [Disowned by Time](https://fireemblemwiki.org/w/index.php?oldid=741938) | Defeat the Risen Chief | 1–13+1 (Upon Morgan being recruited) | Morgan | 2, 4, 5, 6 | L |
| P13 | [Rival Bands](https://fireemblemwiki.org/w/index.php?oldid=741913) | Rout the enemy | 1–13+1 (Upon Yarne being recruited) | Yarne | — | — |
| P14 | [Shadow in the Sands](https://fireemblemwiki.org/w/index.php?oldid=741822) | Defeat Nombry | 1–13+1 (Upon Laurent being recruited) | Laurent | — | L |
| P15 | [A Shot from the Dark](https://fireemblemwiki.org/w/index.php?oldid=741793) | Rout the enemy | 1–13+1 (Upon Noire being recruited) | Noire | — | L |
| P16 | [Daughter to Dragons](https://fireemblemwiki.org/w/index.php?oldid=742094) | Defeat the Risen Chief | 1–13+1 (Upon Nah being recruited) | Nah | — | L |
| P17 | [The Threat of Silence](https://fireemblemwiki.org/w/index.php?oldid=742205) | Rout the enemy | 1–13 | Tiki | 2, 3, 4, 5 | L |
| P18 | [The Dead King's Lament](https://fireemblemwiki.org/w/index.php?oldid=741895) | Defeat Zanth | 1–15+1 (Upon Gangrel being recruited) | Gangrel | — | — |
| P19 | [Irreconcilable Paths](https://fireemblemwiki.org/w/index.php?oldid=741858) | Rout the enemy | 1–15 | Walhart | 3, 4, 5 | L |
| P20 | [A Hard Miracle](https://fireemblemwiki.org/w/index.php?oldid=742087) | Defeat Ardri | 1–15 | Emmeryn | — | L |
| P21 | [Ghost of a Blade](https://fireemblemwiki.org/w/index.php?oldid=741791) | Rout the enemy | 1–15+1 (Upon Yen'fay being recruited) | Yen'fay | — | — |
| P22 | [The Wellspring of Truth](https://fireemblemwiki.org/w/index.php?oldid=700134) | Rout the enemy | 1–15 | Aversa | — | — |
| P23 | [The Radiant Hero (Awakening)](https://fireemblemwiki.org/w/index.php?oldid=747812) | Rout the enemy | 1–30 | Priam | — | L |
| Champions of Yore 1 | [Champions of Yore 1](https://fireemblemwiki.org/w/index.php?oldid=685221) | Rout the enemy | 1–7 | Pr. Marth | — | N/L |
| Champions of Yore 2 | [Champions of Yore 2](https://fireemblemwiki.org/w/index.php?oldid=685237) | Rout the enemy | 1–7 | Roy | — | L |
| Champions of Yore 3 | [Champions of Yore 3](https://fireemblemwiki.org/w/index.php?oldid=685408) | Rout the enemy | 1–12 | Micaiah | — | L |
| Lost Bloodlines 1 | [Lost Bloodlines 1](https://fireemblemwiki.org/w/index.php?oldid=685829) | Rout the enemy | 1–12 | Leif | — | L |
| Lost Bloodlines 2 | [Lost Bloodlines 2](https://fireemblemwiki.org/w/index.php?oldid=704475) | Rout the enemy | 1–12 | Alm | — | L |
| Lost Bloodlines 3 | [Lost Bloodlines 3](https://fireemblemwiki.org/w/index.php?oldid=704473) | Rout the enemy | 1–15 | Seliph | — | L |
| Smash Brethren 1 | [Smash Brethren 1](https://fireemblemwiki.org/w/index.php?oldid=685763) | Rout the enemy | 1–10 | Elincia | — | L |
| Smash Brethren 2 | [Smash Brethren 2](https://fireemblemwiki.org/w/index.php?oldid=704471) | Rout the enemy | 1–12 | Eirika | — | L |
| Smash Brethren 3 | [Smash Brethren 3](https://fireemblemwiki.org/w/index.php?oldid=704472) | Rout the enemy | 1–15 | Lyn | — | L |
| Rogues & Redeemers 1 | [Rogues & Redeemers 1](https://fireemblemwiki.org/w/index.php?oldid=734383) | Rout the enemy | 1–10 | Ephraim | — | H/L |
| Rogues & Redeemers 2 | [Rogues & Redeemers 2](https://fireemblemwiki.org/w/index.php?oldid=704474) | Rout the enemy | 1–10 | Celica | — | H/L |
| Rogues & Redeemers 3 | [Rogues & Redeemers 3](https://fireemblemwiki.org/w/index.php?oldid=734389) | Rout the enemy | 1–20 | Ike | — | H/L |
| The Golden Gaffe | [The Golden Gaffe](https://fireemblemwiki.org/w/index.php?oldid=685927) | Rout the enemy | 1–10 | — | — | all |
| EXPonential Growth | [EXPonential Growth](https://fireemblemwiki.org/w/index.php?oldid=704469) | Rout the enemy | 1–6 | — | — | all |
| Infinite Regalia | [Infinite Regalia](https://fireemblemwiki.org/w/index.php?oldid=685352) | Defeat the boss Mus | 1–12 | Eldigan | — | all |
| Harvest Scramble | [Harvest Scramble](https://fireemblemwiki.org/w/index.php?oldid=685268) | Rout the enemy | 1–12 | — | 5, 8 | N/L |
| Summer Scramble | [Summer Scramble](https://fireemblemwiki.org/w/index.php?oldid=698193) | Rout the enemy | 1–10 | — | 4, 6, 8 | — |
| Hot-Spring Scramble | [Hot-Spring Scramble](https://fireemblemwiki.org/w/index.php?oldid=741812) | Rout the enemy | 1–14 | — | 4, 6 | — |
| Death's Embrace | [Death's Embrace](https://fireemblemwiki.org/w/index.php?oldid=685249) | Rout the enemy | 1–12 | Est | 4, 5, 6, 7 | N/L |
| Five-Anna Firefight | [Five-Anna Firefight](https://fireemblemwiki.org/w/index.php?oldid=698187) | Rout the enemy | 1–12 | Catria | 4, 5, 6 | L |
| Roster Rescue | [Roster Rescue](https://fireemblemwiki.org/w/index.php?oldid=754285) | Rout the enemy | 1–14 | Palla | — | L |
| The Future Past 1 | [The Future Past 1](https://fireemblemwiki.org/w/index.php?oldid=763420) | Rout the enemy | 1–14 | — | 2, 3, 4, 5, 6 | — |
| The Future Past 2 | [The Future Past 2](https://fireemblemwiki.org/w/index.php?oldid=763419) | Rout the enemy | 1–12 | — | 4, 6, 7, 8 | — |
| The Future Past 3 | [The Future Past 3](https://fireemblemwiki.org/w/index.php?oldid=763418) | Defeat Grima | 1–14 | — | — | — |
| Apotheosis | [Apotheosis](https://fireemblemwiki.org/w/index.php?oldid=763417) | Rout the enemy | 20 | Katarina (normal route) | waves 7 / 10 / 15 / 20 / 25 (secret: 18 / 15 / 13 / 23 / 14) | all |
