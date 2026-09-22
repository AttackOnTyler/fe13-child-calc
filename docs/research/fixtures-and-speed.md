# Research: self-test fixtures and Speed breakpoint inputs

Resolves #7 (part of #1). Researched 2026-09-22.

Scope:
1. Sourced examples of child growth rates and max-stat modifiers for named parent pairings, for use as on-load self-test fixtures.
2. What the 60 / 66 / 69 Speed breakpoints mean.
3. Temporary Speed sources: Pair Up by support rank and class, Rally Speed / Rally Spectrum stacking, Speed Tonic, and anything else common.

## Sources

| Key | Source | Why it's trusted |
|---|---|---|
| SF-child | Serenes Forest child pages, e.g. https://serenesforest.net/awakening/characters/children/lucina/ | Long-standing reference site. Credits the FEA 2ch strategy wiki (datamined). Lists the modifier for each pairing explicitly. |
| SF-inherit | https://serenesforest.net/awakening/characters/children/ | Written rule for how modifiers are inherited |
| SF-growthJS | https://serenesforest.net/app/java/chargrowth13-2.js (the code behind https://serenesforest.net/awakening/characters/growth-rates/full/) | Serenes Forest's own calculator: personal/class growth tables and the child formula |
| SF-maxJS | https://serenesforest.net/app/java/fe13maxstats.js (the code behind https://serenesforest.net/awakening/characters/maximum-stats/complete/) | Serenes Forest's own calculator: each parent's modifiers, asset/flaw modifiers, class caps, child formula |
| FEW | Fire Emblem Wiki stats subpages: https://fireemblemwiki.org/wiki/Lucina/Stats, https://fireemblemwiki.org/wiki/Inigo/Stats/Page_1, .../Inigo/Stats/Page_2, https://fireemblemwiki.org/wiki/Owain/Stats/Page_1, https://fireemblemwiki.org/wiki/Severa/Stats/Page_1 | Explicit growths and modifiers for each named pairing. This is a separate data path from Serenes Forest. |
| SF-pair | https://serenesforest.net/awakening/miscellaneous/pair-up/ | Pair Up formula and class bonus table |
| SF-temp | https://serenesforest.net/awakening/miscellaneous/temporary-boosts/ | Values and stacking rules for temporary boosts |
| SF-skills | https://serenesforest.net/awakening/miscellaneous/skills/ | Skill effects |
| SF-items | https://serenesforest.net/awakening/inventory/items/ | Tonic values |
| SF-calc | https://serenesforest.net/awakening/miscellaneous/calculations/ | Doubling rule |
| SF-dual | https://serenesforest.net/awakening/miscellaneous/dual-system/ | Dual Support bonuses |
| soly | "FE:A Apotheosis Character Build Guide" by soly (v2, changelog to April 2026): https://docs.google.com/document/d/13b2KxYlWGqnMPbXMqjGj850dKa88sAytTCCJw7gpaS4/ (reddit host: https://www.reddit.com/r/fireemblem/comments/a4vscy/) | The community guide that defines the 60/66/69 breakpoints. It includes a full table of enemy Speed thresholds. This is secondary (a player guide), but it is the source these numbers come from. |
| FEW-apo | https://fireemblemwiki.org/wiki/Apotheosis | Whether difficulty changes Apotheosis |

Notation: stat order is **HP / Str / Mag / Skl / Spd / Lck / Def / Res**. Max-stat modifiers have no HP entry. "X!Y" means child Y whose variable parent is X.

---

## 1. Fixtures

### 1a. Formulas the fixtures exercise

These are taken directly from the Serenes Forest calculator source (SF-growthJS `calculateChild`, SF-maxJS `calculateChild`). The fixtures below check them against independently published values.

- **Growth (non-Morgan):** `floor((child_personal + fatherPersonal + motherPersonal) / 3) + class_growth`. If one parent is the Avatar, add `(assetGrowthMod - flawGrowthMod)` inside the sum before dividing by 3 (SF-growthJS "Part 3/4").
- **Growth (Morgan, Gen-1 other parent):** `floor((morgan_personal + avatar_personal + (asset - flaw) + otherParent_personal) / 3) + class` (SF-growthJS "Part 2").
- **Growth (Morgan, Gen-2 other parent):** `floor((morgan_personal + avatar_personal + (asset - flaw) + floor((gen2DefaultParent + gen2VariableParent + gen2Personal) / 3)) / 3) + class` (SF-growthJS "Part 1").
- **Max-stat modifiers (non-Morgan):** `father_mod + mother_mod + 1` for each stat (SF-inherit: "the sum of their parent's maximum stat modifiers, +1"; SF-maxJS line with `+ 1`).
- **Max-stat modifiers (Morgan, Gen-2 other parent):** `(asset - flaw) + gen2DefaultParent_mod + gen2VariableParent_mod + 1`. In other words, Morgan does not get a second +1 (SF-inherit: "If your Avatar pairs with a children character, Morgan does not receive the +1").
- Avatar asset/flaw **modifier** tables (SF-maxJS `assets`/`flaws`): Asset Spd = (Skl +2, Spd +4, Lck +2). Asset Mag = (Mag +4, Spd +2, Res +2). Flaw Def = (Lck -1, Def -3, Res -1).
- Avatar asset/flaw **growth** tables (SF-growthJS `mods`/`mods1`): Asset Spd = (Skl +5, Spd +15, Lck +5). Flaw Def = (Lck -5, Def -10, Res -5).

Parent modifiers used below (SF-maxJS `char_maxes`, order Str/Mag/Skl/Spd/Lck/Def/Res):
Chrom 1/0/1/1/1/-1/-1 · Sumia -2/0/2/3/0/-2/1 · Maribelle -3/2/1/0/3/-3/2 · Olivia 0/0/1/1/0/-1/-1 · Lon'qu 0/0/3/3/0/-2/-2 · Lissa -2/2/-1/0/2/-1/1 · Frederick 2/-2/2/-2/0/2/0 · Vaike 3/-2/1/1/-1/0/-2 · Cordelia 1/-1/2/2/-1/0/-1 · Virion 0/0/2/2/-1/-2/0 · Sully -1/-1/2/2/0/-1/0 · Gaius 1/-1/2/2/-2/-1/0 · Miriel -2/3/1/1/0/-2/0.

### 1b. Fixture table: growths and modifiers, both published explicitly

Growth rates are the child's **total** growth in their default starting class. Each value below is copied from FEW. I also recomputed each one by hand with the SF-growthJS formula and tables, and they all matched exactly. Modifiers were checked against both FEW and SF-child where both list them.

| # | Child (mother × father) | Class | Growths HP/Str/Mag/Skl/Spd/Lck/Def/Res | Max mods Str/Mag/Skl/Spd/Lck/Def/Res | Source (URL) |
|---|---|---|---|---|---|
| F1 | Lucina (Sumia × Chrom) | Lord | 81/55/16/63/63/70/38/30 | +0/+1/+4/+5/+2/-2/+1 | Growths and mods: https://fireemblemwiki.org/wiki/Lucina/Stats (Sumia section). Mods also: https://serenesforest.net/awakening/characters/children/lucina/ and soly §3.11. |
| F2 | Lucina (Maribelle × Chrom) | Lord | 80/51/23/61/58/76/33/33 | -1/+3/+3/+2/**+5**/-3/+2 | https://fireemblemwiki.org/wiki/Lucina/Stats (Maribelle section); soly §3.12 gives the same mods. **See the SF discrepancy note below.** |
| F3 | Inigo (Olivia × Lon'qu) | Mercenary | 88/55/20/68/66/60/35/25 | +1/+1/+5/+5/+1/-2/-2 | https://fireemblemwiki.org/wiki/Inigo/Stats/Page_2 (Lon'qu section) |
| F4 | Owain (Lissa × Vaike) | Myrmidon | 86/58/25/65/60/53/33/28 | +2/+1/+1/+2/+2/+0/+0 | Growths: https://fireemblemwiki.org/wiki/Owain/Stats/Page_1 (Vaike section). Mods also: https://serenesforest.net/awakening/characters/children/owain/ |
| F5 | Owain (Lissa × Frederick) | Myrmidon | 86/55/25/63/60/51/33/33 | +1/+1/+2/-1/+3/+2/+2 | https://fireemblemwiki.org/wiki/Owain/Stats/Page_1 (Frederick section); SF Owain page gives the same mods. |
| F6 | Severa (Cordelia × Virion) | Mercenary | 88/61/18/65/58/40/45/31 | +2/+0/+5/+5/-1/-1/+0 | https://fireemblemwiki.org/wiki/Severa/Stats/Page_1 (Virion section) |

FEW lists stats in two columns (HP, Spd, Str, Lck, Mag, Def, Skl, Res). I reordered them into the canonical order above.

Worked check for F1, to test the implementation. The inputs come from SF-growthJS personal growths: Lucina 45/35/20/45/45/80/25/25, Chrom 45/40/10/40/40/70/35/20, Sumia 35/30/20/45/45/60/25/30, Lord 40/20/0/20/20/0/10/5.
Spd: floor((45+40+45)/3) + 20 = 43 + 20 = **63**. Def: floor((25+35+25)/3) + 10 = 28 + 10 = **38**.

### 1c. Fixture table: Avatar, Morgan and second-generation-parent cases (modifiers only)

The only explicit per-pairing values I found for these are modifiers, in soly's guide. I recomputed every row from the SF-maxJS tables and formula, and each one matches exactly.

| # | Case | Avatar asset/flaw | Max mods Str/Mag/Skl/Spd/Lck/Def/Res | Source |
|---|---|---|---|---|
| M1 | Avatar!Lucina (Chrom × Robin-F) | +Spd / -Def | +2/+1/+4/+6/+3/-3/-1 | soly §3.1a |
| M2 | Avatar!Kjelle (Sully × Robin-M) | +Spd / -Def | +0/+0/+5/+7/+2/-3/+0 | soly §3.3a |
| M3 | **Sumia!Lucina!Morgan** (Robin-M × Lucina; Lucina = Chrom × Sumia). Gen-2 parent, Morgan case. | +Spd / -Def | +0/+1/+6/+9/+3/-5/+0 | soly §3.13 |
| M4 | **Gaius!Kjelle!Morgan** (Robin-M × Kjelle; Kjelle = Sully × Gaius). Gen-2 parent. | +Spd / -Def | +1/-1/+7/+9/+0/-4/+0 | soly §3.13 |
| M5 | **Lon'qu!Laurent!Morgan** (Robin-F × Laurent; Laurent = Miriel × Lon'qu). Gen-2 parent. | +Mag / -Def | -1/+8/+5/+7/+0/-6/+0 | soly §3.13 |

Worked check for M3: (asset Spd − flaw Def) = 0/0/+2/+4/+1/-3/-1. Chrom + Sumia = -1/0/+3/+4/+1/-3/0. Sum + 1 = **0/+1/+6/+9/+3/-5/0** ✓. This confirms that Morgan gets exactly one +1 in total.

**UNVERIFIED: growth rates for Avatar-parented children and for Morgan.** FEW gives these only as ranges across all asset/flaw choices (for example, Avatar!Lucina Spd growth "50-75%"). I found no published worked value for a specific asset/flaw. For a growth fixture, the only thing available is a value derived from the SF calculator code. For example, Sumia!Lucina!Morgan (+Spd/-Def, Tactician), derived with the Part 1 formula, gives HP 78 / Str 51 / Mag 45 / Skl 56 / Spd 59 / Lck 58 / Def 34 / Res 31. That checks our code against SF's code. It does not check it against the game. Also UNVERIFIED: whether the SF asset/flaw growth tables and the nested-floor Gen-2 formula match the game exactly. A GameFAQs thread titled "Major discovery/datamining on Robin Asset/Flaw growth changes" (https://gamefaqs.gamespot.com/boards/643003-fire-emblem-awakening/71781781) exists, but I did not review it.

### 1d. Discrepancy found (important for fixtures)

- **The SF Lucina page is wrong for Maribelle!Lucina Luck.** https://serenesforest.net/awakening/characters/children/lucina/ lists "Lck +3". Chrom (+1) + Maribelle (+3) + 1 = **+5**. FEW Lucina/Stats and soly §3.12 both say +5, and SF's own calculator (SF-maxJS) produces +5. Use +5. This also shows why fixtures should not rely on the SF child page alone.

---

## 2. What 60 / 66 / 69 Speed mean

These breakpoints come from the **Apotheosis** DLC map (including its secret-path waves). They are not about main-story Lunatic+. The definitions below are from soly §2.5, with the full threshold table in §6.8.

The doubling rule behind them: you attack twice when `(your Spd − enemy Spd) >= 5` (SF-calc, "Multiple Attacks"). So each breakpoint equals an enemy's Speed + 5.

| Your Spd | Meaning (soly) | Enemy Spd implied |
|---|---|---|
| **60** | "doubles most enemies in Apotheosis and avoids being doubled by Thronie" (the wave-4 Berserker boss). Without 60 you fail to double every enemy in wave 5. This is soly's target for all units in no-other-DLC runs. | Thronie 64 (64 − 60 < 5, so he can't double you). Doubles 55-Spd enemies. |
| **66** | Avoids being doubled by Anna (the final boss). soly says you also need **48 Def** to survive her Spear Aether ("66/48"). It also doubles everything except Anna, the Nightmare Sniper, Thronie and the wave-4 Forseti Sage boss. | Anna 70 |
| **69** | Doubles every enemy up to Thronie. The only ones it misses are Anna and the Nightmare Sniper. | Thronie 64 |

Other rows in soly §6.8 that could fill a breakpoint column: 75 (doubles Anna and the Nightmare Sniper, both 70), 67 (Forseti Sage boss, 62), 65 (Invincisorc, 60), 64 (faux-Elincia / Thronie minions, 59), 62 (Mire Flier boss, 57), 55 (the next tier down for runs with no Rally/DLC).

Difficulty: FEW-apo says the only difference between difficulties in Apotheosis is how far one secret-path Warrior boss's Silver Bow is forged. Fire Emblem WoD (https://www.fireemblemwod.com/fe13/guia/ENG_dlc-apotheosis.htm) says lower difficulties have fewer enemies and later reinforcements. Neither source says enemy Speed changes with difficulty, so the breakpoints apply on every difficulty. **UNVERIFIED:** I did not independently check the enemy Speed values (Anna 70, Thronie 64, etc.) against a datamined enemy table. They come from soly's table.

Build assumptions in soly for these targets: a "no-other-DLC" run adds +8 from base-game Rallies and +2 from a stat tonic on top of the displayed cap. A full run adds +10 Limit Breaker, +10 Rallies (with Rally Heart) and +2 tonic, then Pair Up on top (soly §3.0).

---

## 3. Temporary Speed sources

### 3a. Pair Up (lead unit's Speed bonus)

`Pair Up bonus = support unit's stat bonus + support unit's class bonus + support-level bonus` (SF-pair)

- **Stat bonus** comes from the support unit's **raw** Speed (tonics and skills don't count): +1 at 10-19, +2 at 20-29, +3 at 30 or more (SF-pair).
- **Support-level bonus** applies only to the class bonus, and to every stat in it except Move. None: +0. C or B: **+1**. A or S: **+2** (SF-pair). The +2 only applies if the class bonus for that stat is non-zero; in SF's worked example, the Grandmaster's Luck class bonus of 0 gets no support-level bonus.
- **Class Speed bonus** (SF-pair table, Spd column; classes with no Spd bonus are omitted):

| Spd | Classes |
|---|---|
| 5 | Swordmaster |
| 4 | Great Lord, Myrmidon, Falcon Knight, Assassin |
| 3 | Lord, Mercenary, Hero, Berserker, Bow Knight, Trickster, Pegasus Knight, Dark Flier, Dancer, Taguel, Lodestar |
| 2 | Tactician, Grandmaster, Paladin, Barbarian, Thief, Valkyrie, Bride, Conqueror |
| 1 | Cavalier, Troubadour, Dread Fighter |
| 0 | Great Knight, Knight, General, Fighter, Warrior, Archer, Sniper, Wyvern Rider, Wyvern Lord, Griffon Rider, Mage, Sage, Dark Mage, Sorcerer, Dark Knight, Priest/Cleric, War Monk/Cleric, Villager, Manakete |

- **Maximum Pair Up Speed = +10** (SF-temp "Pair Up ≤10"). That is Swordmaster 5 + A/S support 2 + raw Spd ≥30 3.
- SF worked example (SF-pair): Chrom leading with an A-support Grandmaster Avatar whose raw Spd is 22 gets Spd +2 (stat) + 2 (class) + 2 (support) = **+6**.

### 3b. Rally Speed, Rally Spectrum, and stacking

- Rally Speed: **Spd +4** to allies within 3 tiles for one turn (SF-skills). It comes from the Falcon Knight class and is female-only (soly §2.21).
- Rally Spectrum: **all stats +4**, which includes Spd +4 (SF-skills). It comes from Grandmaster (soly).
- **They stack.** SF-temp: "Rally Strength stacks with Rally Spectrum, but doesn't stack with another Rally Strength". The same rule applies to Speed, so Rally Speed + Rally Spectrum = **+8 Spd**. The same Rally used twice doesn't stack. Also, one unit using the Rally command triggers all of its equipped Rally skills at once (SF-skills notes).
- Rally Heart (DLC, from the Bride class): all stats +2 and Mov +1 (SF-skills, SF-temp). It stacks with the two above, for **+10 total** (soly §2.5).

### 3c. Speed Tonic and other sources

| Source | Spd | Notes / source |
|---|---|---|
| Speed Tonic | **+2** | "Speed +2 until the chapter/skirmish's end" (SF-items). Also in SF-temp, Tonics row. |
| Speed +2 (skill) | +2 | From Pegasus Knight (SF-skills; SF-child lists it under Pegasus Knight). |
| All Stats +2 (DLC skill) | +2 | SF-skills |
| Defender (skill) | +1 | "All stats +1 when paired up" (SF-skills). It comes from Paladin. soly says it applies to the lead. |
| Limit Breaker (DLC skill) | +10 cap | Raises max stats by 10 (SF-skills). It raises the cap, so it's not a temporary boost. |
| Barracks boost | up to +4 | "Only 2 stats at a time" (SF-temp) |
| Legendary / semi-legendary weapons | +5 / +2 | Only one stat per item; one equipped item per character (SF-temp) |
| Beaststone+ / Dragonstone+ | +8 / +4 | Taguel / Manakete only (SF-temp) |
| Dual Support | **none** | Dual Support gives Hit/Avoid/Crit/Crit-avoid only, never Speed (SF-dual) |

Stacking rule (SF-temp): in Awakening, every temporary boost can exceed the unit's cap and stacks with different boost types, but not with another copy of itself.

### 3d. End-to-end Speed check (fixture for the breakpoint column)

soly §3.11, Sumia!Lucina as a Sniper: "Lucina reaches 63 speed (45 base + 8 Rally + 2 Tonic + 8 Pair-Up)". The 45 checks out: Sniper Spd cap 40 (SF-maxJS classes) + Spd modifier +5 (F1) = 45. The Pair Up 8 is the maximum for a Spd-3 class at A/S support with 30+ raw Spd (3 + 2 + 3). This makes a good self-test case: cap 45 → 63 with Rallies + Tonic + Pair Up, which clears 60 but not 66.

---

## UNVERIFIED items

1. Growth rates for any Avatar-parented child or Morgan at a specific asset/flaw. No published worked value was found; FEW gives ranges only. The value in §1c is derived from the SF calculator code.
2. Whether the SF asset/flaw growth tables and the nested-floor Gen-2 Morgan growth formula exactly match the game. The GameFAQs datamining thread was not reviewed.
3. Apotheosis enemy Speed values (Anna 70, Thronie 64, Forseti Sage 62, etc.). Only soly's table was used; they were not checked against a datamined enemy list.
4. Whether difficulty changes anything relevant in Apotheosis. FEW-apo ("only difference" is one weapon's forge) and Fire Emblem WoD (fewer enemies on lower difficulties) disagree on enemy count. Neither says enemy stats change.
