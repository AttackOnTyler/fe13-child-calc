# What game data do first-gen and bonus unit pages still need?

Resolves #79 (part of #76, Map: Unit build pages). Researched 2026-09-24 against `origin/main` at `139044b`.

This is a findings file, not a data file. Every number quoted here comes from the source it is cited to. Where two sources were compared, the comparison was done by script over the whole table, not by spot check (see §7).

## Summary

| Gap | Verdict | Best source | Coverage | Disagreements |
|---|---|---|---|---|
| **Personal skills** | Only two exist: **Shadowgift** (Aversa) and **Conquest** (Walhart). Both are already in `skills.ts`. Veteran, Aptitude, Rightful King, Charm, Dual Strike+, Special Dance and Dual Support+ are **class skills**, already in `CLASS_SKILLS`. The real gap is **starting skills**: 4 units start with skills their class set can't teach (Walhart, Aversa, Emmeryn, Priam) | SF skills page + SF base stats (starting skills column) | All 35 first-gen units + Robin | None. SF and FEW agree on every starting-skill list |
| **Base stats, join level, join class** | Missing from `src/game-data`. Fully published | SF base stats (main story) | 35 first-gen units + Robin, Normal/Hard/Lunatic | 33 of 35 units agree SF = FEW on every stat, level and skill. **U1** Olivia Skl and **U2** Aversa Res (Normal) / Skl (Lunatic) disagree |
| **Join chapter and recruit condition** | Missing. Fully published | SF recruitment (main story) | All 35 + children | None found (FEW's `recruit=` field agrees for all 35) |
| **SpotPass paralogue units** (Gangrel, Walhart, Emmeryn, Yen'fay, Aversa, Priam) | Growths, modifiers, class sets, S-support to Robin: **complete**. Missing: join data (row above) and their support restriction as a *rule* | SF base stats / recruitment / supports | All six | U2 (Aversa). **U3**: a JP wiki gives different growths for five of the six (low trust, open) |
| **Einherjar / DLC heroes** | **Enough for pages.** SF publishes base stats, fixed asset/flaw, modifiers and starting skills for all 137 (17 DLC + 120 SpotPass). Growths and modifiers are **derivable from `robin.ts`** from the asset/flaw pair (Marth uses his own base growths). Class access is a rule. They can pair up but can't support, marry or pass anything | SF base stats (DLC, SpotPass) + SF cap modifiers + SF growth rates | 137 of 137 | Asset/flaw → modifiers: 0 mismatches over 137 (SF vs formula). Growths: 0 mismatches over 137 (FEW module vs formula). Bases: 129 of 137 match FEW; 7 disagree and 1 FEW page wasn't found (**U4**) |

The short answer for #76: **every gap is fillable from Serenes Forest**, with Fire Emblem Wiki as the independent cross-check. Nothing needs a new kind of source.

## 1. Personal and unique skills

### 1.1 Awakening has two personal skills, and the repo has both

SF's skills page lists every obtainable skill with the class and level that teaches it. Only two skills have no class. Both are marked as belonging to named characters (SF https://serenesforest.net/awakening/miscellaneous/skills/):

| Skill | Who has it (SF, verbatim list) | In repo |
|---|---|---|
| Shadowgift | Aversa, Morgan as Aversa's daughter, DLC Micaiah, DLC Katarina | `SKILLS.shadowgift`, `FIXED_INHERITANCE.aversa` |
| Conquest | Walhart, Morgan as Walhart's son, SpotPass Zephiel, DLC Ephraim | `SKILLS.conquest`, `FIXED_INHERITANCE.walhart` |

The other skills the ticket names are class skills, and `CLASS_SKILLS` already has them with SF's levels: Veteran (Tactician 1), Aptitude (Villager 1), Dual Strike+ / Charm (Lord 1 / 10), Rightful King (Great Lord 15), Special Dance (Dancer 15), Dual Support+ (Valkyrie 15).

**Can a unit equip them?** SF (skills page intro): learned skills are kept after a class change, and a unit picks up to 5 active skills outside battle. So a unit can equip a skill it started with even if its class set can't teach it. **Can it pass them?** Shadowgift and Conquest pass only to Morgan, always (already modelled as fixed inheritance). Special Dance and DLC skills never pass (already the `inheritable` flag).

### 1.2 The real gap: starting skills outside the class set

A unit page that shows "reachable skills" as *skills its reachable classes teach* would be wrong for four units. A script compared each first-gen unit's SF starting skills against every skill taught by its class set, their promotions and its gender's DLC class (§7). Only these fall outside:

| Unit | Join class | Starting skills not otherwise learnable | Why |
|---|---|---|---|
| Walhart | Conqueror | Conquest | Personal skill |
| Aversa | Dark Flier | Shadowgift | Personal skill |
| Emmeryn | Sage | Magic +2, Focus | Mage skills. Her set is Cleric / Pegasus Knight / Troubadour, so she reaches Sage through Priest, never Mage |
| Priam | Hero | Swordbreaker, Lancebreaker, Luna | Wyvern Lord, Griffon Rider and Great Knight skills. His set is Mercenary / Myrmidon / Fighter |

The other 31 units (and Robin, whose Veteran is a Tactician skill) start only with skills their set can teach. So **reachable skills = class-taught skills ∪ starting skills**, and the data needed is one `startingSkills` list per unit.

Einherjar have the same pattern on a larger scale. For example, King Marth and DLC Celica start with Rightful King, which only the Great Lord line teaches, and Lord is Chrom's alone (SF class sets).

## 2. Join data: base stats, level, class, chapter

None of this is in `src/game-data` yet.

### 2.1 Sources and coverage

| Data | Source | Coverage |
|---|---|---|
| Base stats, level, class, weapon ranks (with extra weapon EXP), starting equipment, starting skills | SF https://serenesforest.net/awakening/characters/base-stats/main-story/ | Robin, 35 first-gen units, children's absolute bases. Hard/Lunatic rows are given for the 17 units whose stats change with difficulty (Gregor, Nowi, Libra, Tharja, Anna, Cherche, Henry, Say'ri, Tiki, Basilio, Flavia and the six SpotPass units); the rest share one row |
| Join chapter, recruit condition | SF https://serenesforest.net/awakening/characters/recruitment/main-story/ | Every unit, including the six SpotPass paralogues (18–23) |
| Independent cross-check | FEW per-character pages, `{{CharStats FE13}}` blocks (one per difficulty tab, with `recruit=`) | All 35 (Anna is at `Anna (Awakening)`). No FEW Lua module holds bases; only growths (`Module:CharGrowths/FE13`) and class stats are modules |
| Robin's base stats and asset/flaw deltas | SF main-story page and FEW https://fireemblemwiki.org/wiki/Robin/Stats | Agree: Lv 1 Tactician 19/6/5/5/6/4/6/4, asset/flaw +5/−3 HP, +4/−2 Lck, +2/−1 other stats |

**How SF writes bonuses:** SF writes skill and weapon bonuses as `base+bonus` (e.g. Virion Skl `9+2` from Skill +2, Nowi Str `4+8` from the dragonstone). FEW keeps the bonus in a separate `{{h|+2|…}}` hint. The data should store the base and let the page add the skill. FEW also splits each stat as `{{Personal|personal|class base}}`, so the sum is the displayed base.

### 2.2 Cross-check result (SF vs FEW, 35 units × 3 difficulties)

- **33 units agree** on every stat for Normal, Hard and Lunatic, and on join level and starting skills. Anna was checked by hand against `Anna (Awakening)` and agrees on all three difficulties.
- **U1: Olivia Skl.** SF 8, FEW 9 (`{{Personal|4|5}}`). Fandom has 8. SF majority, but Fandom usually copies SF, so it doesn't count as independent.
- **U2: Aversa (playable).** Normal Res: SF 28, FEW 26. Lunatic Skl: SF 36, FEW 34. Fandom sides with SF on both (29/32/36 Skl, 28/30/33 Res). Supporting SF: FEW's *own* Paralogue 22 NPC row gives Normal Res 28, and the unit is recruited from that NPC.
- Join chapters agree for all 35 (SF recruitment vs FEW `recruit=`).

### 2.3 Join chapter summary (SF recruitment)

Prologue: Robin, Chrom, Lissa, Frederick. Ch 1: Sully, Virion. Ch 2: Stahl, Vaike, Miriel. Ch 3: Sumia, Kellam. Paralogue 1: Donnel (leaves unless he gains a level). Ch 4: Lon'qu. Ch 5: Ricken, Maribelle. Ch 6: Panne, Gaius. Ch 7: Cordelia. Ch 8: Gregor, Nowi. Ch 9: Libra, Tharja. Paralogue 4: Anna. Ch 11: Olivia. Ch 12: Cherche. Ch 13: Henry. Ch 15: Say'ri. Paralogue 17: Tiki. Ch 23: Basilio, Flavia. Paralogues 18–23 (after Ch 25, SpotPass data required): Gangrel, Walhart, Emmeryn, Yen'fay, Aversa, Priam.

Several units join already promoted or high-level (Frederick Great Knight 1, Libra War Monk 1, Anna Trickster 1, Say'ri Swordmaster 1, Basilio Warrior 10, Flavia Hero 10, Tiki Manakete 20, and all six SpotPass units). The page needs join tier/level to say what's reachable *now* versus after a Second Seal.

## 3. SpotPass paralogue units (Gangrel, Walhart, Emmeryn, Yen'fay, Aversa, Priam)

### 3.1 What's already complete

| Data | Status |
|---|---|
| Growths | Complete. Matches SF base growths and FEW module (#5; Walhart D1a resolved in #13) |
| Max-stat modifiers | Complete. Matches SF cap modifiers |
| Class sets | Complete. Matches SF class sets (e.g. Walhart Conqueror / Knight / Wyvern Rider, Priam Mercenary / Myrmidon / Fighter) |
| Passes classes | `PASSES_NO_CLASSES` is correct: they are only ever Morgan's other parent |
| Personal skills | Complete (Shadowgift, Conquest, fixed inheritance to Morgan) |
| Marriage | Complete in `ROBIN_SUPPORTS`: Emmeryn and Aversa marry Robin (M); Gangrel, Walhart, Yen'fay and Priam marry Robin (F) |

### 3.2 What's missing and the special cases

- **Join data** (§2): all six join at the end of the game, promoted, with high bases. For example, Walhart is a Lv 30 Conqueror with 71/39/15/33/32/30/35/19 on Normal and Wolf Berg; Priam is a Lv 20 Hero with Ragnell.
- **Supports:** SF's support list gives **no** supports to any of the six besides Robin. The page's "partners" view shows only Robin. `supports.ts` implies this but doesn't state it as a rule.
- **Recruit conditions** matter for a page: Gangrel (Chrom talks to him 3 times), Walhart (Chrom must fight him), Emmeryn and Aversa (must survive as NPCs), Yen'fay (Say'ri talks to him), Priam (end of chapter).
- **Priam is a SpotPass unit.** The Ellery Q7 summary says "Priam comes from a paralog, not SpotPass", but SF lists Paralogue 23 with the other five under "SpotPass-exclusive Characters" and says SpotPass data unlocks those paralogues. The AI summary's flag is wrong on this point.
- **Walhart's Conqueror** is a special class, in his set only. Per SF class sets, a special class needs Lv 30 (not 10) before a Second Seal also unlocks the promoted options of his set. He joins at Lv 30, so he already meets it, but the reachable-class logic must know about the rule.
- **U3 (open, low priority):** the 天馬騎士団 JP wiki unit page (https://www.pegasusknight.com/wiki/fe13/ユニット, 個人成長率 table) gives different personal growths for Gangrel (45/45/30/45/45/30/30/30), Walhart (Mag 15, Res 30), Emmeryn (45/15/60/45/45/75/30/30), Yen'fay (Mag 15, Spd 45, Res 15) and Aversa (45/30/45/30/45/60/30/30). It also gives Nowi Str 40. Every other row matches the repo. The repo's values have been confirmed by SF, SF's calculator JS, FEW's module and OifeyBot (#5, #13), and earlier research rated this wiki "sloppy" on caps. Don't change anything. Record it as a known dissent in case it ever matters. Only a `GameData.bin` dump would settle it (as #13 noted for D1b).
- **Not researched:** whether SpotPass content can still be downloaded after the 3DS online services ended. That's a player-facing availability note, not game data.

## 4. Einherjar / DLC heroes

### 4.1 What exists

| Data | Source | Coverage | Notes |
|---|---|---|---|
| Roster, join class, level, bases, weapon ranks, starting skills | SF base stats https://serenesforest.net/awakening/characters/base-stats/dlc/ and https://serenesforest.net/awakening/characters/base-stats/spotpass/ | 17 DLC (Series 1 *Other-world Talismans*: 13; Series 2 *Path of a Grandmaster*: Est, Catria, Palla, Katarina) + 120 SpotPass (12 sets of 10) | SpotPass rows are Normal mode, stats at recruitment. Neither source splits them by difficulty. DLC units join with no items; SpotPass equipment is lost on recruitment |
| How each is obtained | SF recruitment https://serenesforest.net/awakening/characters/recruitment/dlc/ and https://serenesforest.net/awakening/characters/recruitment/spotpass/ | All | DLC: end of the xenologue episode, some with conditions (Est: beat Algol within 10 turns; Catria: all five Annas survive; …). SpotPass: hire cost in gold per set, or beat their team |
| Fixed asset/flaw + cap modifiers | SF https://serenesforest.net/awakening/characters/maximum-stats/modifiers/ | All 137 | Asset and flaw given per unit |
| Growths | SF https://serenesforest.net/awakening/characters/growth-rates/base/ (rule), FEW `Module:CharGrowths/FE13` (values) | Rule: all. Values: all 137 in the FEW module (SpotPass Tiki is `"Tiki (Spotpass)"`) | SF: "equivalent growth rates as the Avatar, calculated using a fixed Asset and Flaw". The three Marths use their own base growths 45/40/20/45/45/80/35/25 in place of Robin's |
| Class access | SF class sets ("DLC/SpotPass Characters: Initial class + every regular class according to gender"); FEW https://fireemblemwiki.org/wiki/Einherjar | All | FEW adds: the three Marths can access Lodestar, and SpotPass (young) Tiki can access Manakete |
| Supports / marriage / inheritance | SF supports: "The legacy characters from SpotPass or DLC can **not** support" | All | So no S-support, no children, nothing passed |
| Pair-up | SF pair-up: bonus = stat bonus + class bonus + support-level bonus | All | They can pair up like any unit. With no support rank they get no support-level bonus. This is inferred from the two SF statements, not stated in one place |

### 4.2 Verification

- **Modifiers from asset/flaw:** SF's per-unit modifier rows were recomputed from `robin.ts` `ASSET_FLAW` using each unit's SF asset/flaw. **0 mismatches over 137 units.** So storing just `{asset, flaw}` per Einherjar is enough; the modifiers don't need their own table.
- **Growths from asset/flaw:** Robin's growths (Marth's for the three Marths) plus the `ASSET_FLAW` growth deltas, compared with the FEW module: **0 mismatches over 137 units.**
- **Base stats:** each SF row was matched against the FEW page's `CharStats FE13` block at the same level. **129 of 137 agree.** U4 lists the rest.

### 4.3 Is it enough for pages?

Yes. An Einherjar page needs: name, gender, source (DLC episode / SpotPass set), join class and level, bases, asset/flaw, starting skills and weapon ranks. SF publishes all of it except **gender**, which the class names imply and which isn't tabulated. Classes follow the Robin rule for their gender, plus Lodestar for the Marths and Manakete for young Tiki; skills follow from classes plus starting skills. Things they *don't* have (supports, marriage, inheritance) remove sections from the page rather than add data.

Two things for the spec to decide, not for research:
- **Same name, several units.** 14 heroes appear as both a DLC and a SpotPass unit with different joins (e.g. DLC Roy is a Lv 11 Mercenary, SpotPass Roy a Lv 20 Hero), and Marth has three variants. An Einherjar ID needs a version part.
- **Scale.** 137 units is about four times the first-gen roster. The data is uniform (one SF row each), so it's a bulk import, not curation.

The Ellery Q7 summary calls Einherjar "Robin clones with a fixed asset/flaw and locked skills". The fixed asset/flaw part is confirmed. Neither SF nor FEW describes any skill lock: they learn class skills like any unit.

## 5. Disagreements found (new)

| ID | Item | Values | Sources | Suggested resolution |
|---|---|---|---|---|
| U1 | Olivia base Skl | **8** / 9 | SF, Fandom / FEW | 8 (SF + Fandom; weak, as Fandom isn't independent). Low impact (Lv 1 base) |
| U2 | Aversa playable Res (Normal), Skl (Lunatic) | **28, 36** / 26, 34 | SF, Fandom, FEW's own P22 NPC row (Res) / FEW playable row | SF |
| U3 | Personal growths of Gangrel, Walhart, Emmeryn, Yen'fay, Aversa; Nowi Str | repo values / JP-PK values | SF, SF-JS, FEW module, OifeyBot / 天馬騎士団 | Keep the repo values. Record as a dissent |
| U4 | Einherjar bases (SF vs FEW) | Catria (SpotPass) Skl 13/12; Norne Spd 12+2/10; Fee Lv 4/2 (stats equal); Julius Res 33/35; Zephiel Spd 35/34; Narcian Str 39+2/29; Lloyd HP 61/62, Def 23/25; Ursula: FEW page not located | SF / FEW | Unresolved. Narcian's 29 looks like a FEW typo. Resolve in the implementation ticket that imports Einherjar, using the same majority/independence rule as #13 |

No disagreement was found on starting skills, join chapters, Robin's bases, Einherjar asset/flaw, modifiers or growths.

## 6. Sources

| Source | Trust | Used for |
|---|---|---|
| SF base stats: main story / DLC / SpotPass (credits MiruPage, FEA 2ch strategy wiki) | High; the de facto reference, compiled from the JP 2ch wiki | Bases, level, class, ranks, starting skills |
| SF recruitment: main story / DLC / SpotPass | High | Join chapter, conditions, SpotPass hire cost |
| SF cap modifiers, growth rates, class sets, supports, skills, pair-up | High | Asset/flaw, class access, support rule, personal skills |
| FEW per-character pages (`CharStats FE13`), `Module:CharGrowths/FE13`, `Einherjar`, `Robin/Stats` | High; independently edited | Cross-check of all of the above |
| Fandom FE wiki | Low; often copied from SF | Tie-break context for U1/U2 only |
| 天馬騎士団 FE13 wiki | Medium–low | U3 dissent only |
| JP 2ch wiki (atwiki) | High (SF's upstream), but behind a Cloudflare bot check | Not reachable for this research. The bot check wasn't bypassed |

## 7. Method

Scripts were run against the live pages on 2026-09-24. They are not committed; this is a throwaway branch.

1. Parsed SF's DLC/SpotPass modifier tables (137 rows with asset/flaw) and recomputed modifiers and growths from `ASSET_FLAW` (restated from `src/game-data/robin.ts`). Growths were compared with FEW `Module:CharGrowths/FE13?action=raw`.
2. Parsed SF's main-story base stats (with H/L rows) and fetched each unit's FEW page as raw wikitext. Picked the `CharStats FE13` block per difficulty by the Tab labels (`Normal/Hard`, `Lunatic`, …), summed `{{Personal|a|b}}`, and compared with SF's `base` and `base+bonus`, plus level and starting skills.
3. For each of the 137 legacy rows, looked for a FEW `CharStats FE13` block at the same level with the same stats (with aliases for pages such as `Marth/Awakening stats`, `Caeda/Awakening stats`, `Scáthach` for Ulster, `Deen (Gaiden)`).
4. With `vite-node` over `src/game-data`, built each first-gen unit's reachable classes (class set + `PROMOTES_TO` + gender's `DLC_RECLASS_TARGETS`) and the skills they teach, and listed SF starting skills outside that set (§1.2).

## 8. What this means for the spec (#76)

- **New game data per first-gen unit:** join class, join level, bases for Normal / Hard / Lunatic (store the base, not `+bonus`), starting skills, starting weapon ranks, join chapter or paralogue, recruit condition. All from SF, cross-checked against FEW, with U1 and U2 recorded as resolved disagreements.
- **Reachable skills** = skills taught by reachable classes ∪ starting skills (matters for Walhart, Aversa, Emmeryn, Priam).
- **SpotPass paralogue units** need no data corrections. Add join data and state "supports: Robin only" as a rule.
- **Einherjar pages are feasible** from one SF row each plus `{asset, flaw}`. Everything else derives from existing code. Decide the ID scheme (hero + version) and whether 137 pages are in scope.
