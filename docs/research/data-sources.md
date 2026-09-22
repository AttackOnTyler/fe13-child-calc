# Data sources: units, classes, DLC, skills (FE13 / Fire Emblem Awakening)

Resolves #5 (part of #1). Researched 2026-09-22.

**Sources used:** Serenes Forest (SF), `https://serenesforest.net/awakening/...`, and the Fire Emblem Wiki (FEW), `https://fireemblemwiki.org/`. These are the only two sources the ticket names. Neither one is first-party: both are community transcriptions of game data. SF credits "FEA 2ch strategy wiki", h_yusaku, Othin and others on most pages. FEW's *Inheritance* article cites SF for the Awakening formulas, so on those rules the two sources are **not independent**.

**Method:** I fetched every page listed below: raw HTML from SF, and raw wikitext from FEW via `index.php?title=…&action=raw`. Scripts parsed the tables and diffed them value by value. Most comparisons cover whole datasets rather than spot-checks (counts are given per section). Every disagreement found is listed in [§7](#7-every-disagreement-found).

FEW revisions read (pin these with `?oldid=` in citations):

| Page | oldid | Last edit |
|---|---|---|
| List of classes in Fire Emblem Awakening | 747970 | 2026-07-13 |
| List of skills in Fire Emblem Awakening | 752359 | 2026-07-21 |
| Downloadable content in Fire Emblem Awakening | 752364 | 2026-07-21 |
| Inheritance | 752340 | 2026-07-21 |
| Module:CharGrowths/FE13 | 620231 | 2024-09-04 |
| Module:ClassStats/FE13 | 634237 | 2024-10-31 |
| Walhart | 765770 | 2026-08-31 |
| Flavia | 765959 | 2026-09-01 |
| Thief | 770225 | 2026-09-16 |
| Lucina/Stats | 746071 | 2026-07-13 |
| Kjelle/Stats/Page 2, Page 3 | 740022, 740024 | 2026-06-23 |

Licensing: FEW content is under the GNU FDL 1.3 (page footer). SF pages carry "Content … copyright 2005-2020 to Aveyn Knight/VincentASM". Numbers are facts, but we should cite and not copy prose. This matters most for skill effect text: paraphrase it.

---

## 1. First-generation units: personal growths, max-stat modifiers, class pools

### Serenes Forest

| Data | URL | Shape | Rows |
|---|---|---|---|
| Personal ("base") growths | https://serenesforest.net/awakening/characters/growth-rates/base/ | `Name, HP, Str, Mag, Skl, Spd, Lck, Def, Res` (integers, %) | 36 (Avatar + 35), header row repeated after row 20 |
| Avatar asset/flaw growth mods | same page, "Avatar" section | 8×8 matrix of assets × stats. Cells look like `+30/-20` or `+/-5`, meaning asset value / flaw value | 8 |
| Full growths (personal + class) | https://serenesforest.net/awakening/characters/growth-rates/full/ | Interactive calculator. Static HTML shows the default class only; the data is in https://serenesforest.net/app/java/chargrowth13-2.js (`char_growths` arrays, `classes` object, `class_sets`) | 36 + 14 |
| Max-stat modifiers | https://serenesforest.net/awakening/characters/maximum-stats/modifiers/ | `Character, Str, Mag, Skl, Spd, Lck, Def, Res` (no HP; **blank cell = 0**) | 35 (no Avatar) |
| Avatar asset/flaw cap mods | same page | 8 rows × 7 stats, cells `4 / -3` = asset / flaw | 8 |
| Complete caps (class + mod) | https://serenesforest.net/awakening/characters/maximum-stats/complete/ | Calculator. Static HTML shows each unit's default class | 36 |
| Class sets (Second Seal pool) | https://serenesforest.net/awakening/characters/class-sets/ | `Character, Options×3` (base classes only; promotions implied) | 36 (Avatar = "every regular class") |

### Fire Emblem Wiki

- **Per-character pages** (for example https://fireemblemwiki.org/wiki/Frederick), section `=={{FE13}}==`:
  - A `{{CharStats FE13}}` template. Growths are `HP1={{Personal|60|50|%}}`, where the first argument is the personal growth and the second is the current class's growth. Luck (`luck1=40`) is plain because class Luck growth is 0.
  - Cap modifiers are `strm=+2 … resm=±0` and use the **Unicode minus `−`** and `±0`.
  - Some pages hold several CharStats blocks in a `{{Tab}}` (Normal/Hard/Lunatic, e.g. Walhart, Flavia). Growth and modifier values repeat across tabs.
  - Class pools are in `{{Reclass3DS|baseb=…|set1b=…|set2b=…}}`.
  - Anna is on https://fireemblemwiki.org/wiki/Anna_(Awakening), not on `Anna`.
- **Machine-readable data:** https://fireemblemwiki.org/wiki/Module:CharGrowths/FE13, a Lua table `["Name"] = { hp=…, str=…, mag=…, skl=…, spd=…, lck=…, def=…, res=… }`.
  - 172 entries: all 49 Awakening cast members (Robin, 35 first-gen, 13 children with Morgan as one entry) plus 123 SpotPass/DLC legacy units.
  - Values are personal growths. This is the easiest source to transcribe from.
- **Avatar:** https://fireemblemwiki.org/wiki/Robin/Stats has asset and flaw growth tables and asset and flaw cap-modifier tables, each 8 rows, with `+15%`/`−10%` style cells.

### Agreement

- **Personal growths:** SF table vs FEW Lua module, all 8 stats for 49 units = **392 values, 0 disagreements**. SF table vs SF calculator JS: 48 units, 0 disagreements.
- **Personal growths, per-page:** SF vs FEW per-character CharStats for 35 units = 280 values. The only disagreement is **Walhart Skl/Spd** (see D1).
- **Modifiers:** SF vs FEW CharStats for 35 units = 245 values. The only disagreement is **Flavia Skl** (D2).
- **Avatar asset/flaw tables:** SF vs FEW Robin/Stats, all four matrices checked by hand. 0 disagreements.
- **Class pools:** SF class-sets vs FEW Reclass3DS for 35 first-gen units and 12 children (default sets) = 47 units. 0 disagreements.

### Quirks

- The growth landing page https://serenesforest.net/awakening/characters/growth-rates/ has **no table**. Use `/base/` or `/full/`.
- `https://serenesforest.net/awakening/characters/maximum-stats/base/` silently **redirects to a Shadow Dragon page** (canonical `…/shadow-dragon/characters/growth-rates/base/`). Don't cite it.
- SF spells "Yen'fay" as `Yenfay` in the base-growth table (it is "Yen'fay" elsewhere). The JS strips all non-alphanumerics from keys (`Sayri`, `Lonqu`).
- SF uses British "Defence"; FEW uses "Defense".
- SF's Avatar cap-modifier table has no HP column. An HP asset gives Str/Mag +1 and Lck/Def/Res +2, and an HP flaw gives −1 to each of those.
- The **"Maiden"** (Chrom's default wife) is a valid Lucina parent in both sources. Her growths are **unknown in both**: SF JS has `'Maiden': unknown`, and FEW Lucina/Stats has `{{hover|??|Unknown}}`. Her cap mods are effectively all 0: Lucina+Maiden = Chrom + 1 in both sources.

---

## 2. Child units: personal (absolute) growths, modifiers, inheritance rules

### Serenes Forest

| Data | URL | Shape | Rows |
|---|---|---|---|
| Absolute growths | https://serenesforest.net/awakening/characters/growth-rates/base/ ("Children characters") | `Name, HP…Res` | 13 (one `Morgan` row for both genders) |
| Parent → child map, inheritance rules, gender class substitutions | https://serenesforest.net/awakening/characters/children/ | 2×7 parent/child grid. Rules in prose. Substitution table `Character, Modified class options (for daughters), Character, Modified class options (for sons)` | 14 children; 11 substitution rows |
| Per-child tables | `https://serenesforest.net/awakening/characters/children/{lucina,owain,inigo,brady,kjelle,cynthia,severa,gerome,morgan-m,morgan-f,yarne,laurent,noire,nah}/` | One table for the fixed parent and one for the variable parent. Columns are `Parent, Possible classes and Skills (×3), Unique inheritable Skills, Max stat mod.`, with the mod as text `Str +4 / Mag -2 / …`. Heavy `colspan`/`rowspan`; repeats are marked only by grey highlighting | ~13 variable-parent rows per child |
| Default child class sets | https://serenesforest.net/awakening/characters/class-sets/ ("Children Characters") | `Character, Options×4` | 13 |

Rules as stated by SF (children page and modifiers page):

- **Growths:** child growth = (father + mother + child absolute) / 3.
- **Caps:** child modifiers = father + mother + 1. Morgan gets no +1 when the Avatar's spouse is a child unit.
- **Class pools:** children inherit the parents' regular classes, gender permitting. Lord cannot be inherited except by Lucina from Chrom. Villager passes to sons. Taguel and Manakete pass to Morgan.
- **DLC:** DLC classes and skills cannot be inherited.

### Fire Emblem Wiki

- **Child pages** (e.g. https://fireemblemwiki.org/wiki/Severa) hold CharStats FE13 values labelled "before inheritance".
  - Growths are the absolute growths.
  - Caps are the **fixed parent's modifiers +1** (e.g. Severa shows Cordelia + 1). They are not a separate personal modifier.
- **Per-pair pages** (`https://fireemblemwiki.org/wiki/<Child>/Stats` and `/Stats/Page 1..3`, e.g. https://fireemblemwiki.org/wiki/Severa/Stats/Page_3) have one section per variable parent.
  - Each section is a CharStats block with the **computed** full growths in the child's default class and the computed cap modifiers.
  - Lucina and Cynthia keep everything on `/Stats` (no sub-pages).
  - This is a good oracle for our unit tests.
- **Rules:** https://fireemblemwiki.org/wiki/Inheritance (section "Awakening"), with a formula table and a gender-substitution table. The rules cite SF.
- **Wiki implementation:** https://fireemblemwiki.org/wiki/Module:ReclassGrowths (`childFE13`) implements `math.floor((child + parent + otherParent)/3) + classGrowth`, which makes the **floor rounding** explicit.

### Agreement

- **Absolute growths:** SF vs FEW module and vs FEW child pages = 104 values ×2, 0 disagreements.
- **Formula check:** each FEW per-pair growth was recomputed from SF personal growths, SF class growths and `floor((a+b+c)/3) + class`. Result: **952 values, 0 disagreements**. This confirms the formula and the floor rounding.
- **Per-pair cap modifiers:** SF per-child pages vs FEW per-pair pages vs the formula applied to SF's modifier table = **924 values, 3 disagreements** (D3, D4).
- **Substitution table:** SF and FEW agree. FEW lists Cherche → son as "Troubadour, Cleric → Fighter, Priest", while SF lists only "Troubadour → Fighter". Cleric→Priest is the same class under its male name, so this is not a real disagreement.

### Quirks

- Panne's son gets **Wyvern Rider → Barbarian**, even though Wyvern Rider isn't gender-locked. Both sources note this.
- Olivia's children never inherit Dancer (FEW adds: not even daughters). Chrom's children always get Aether (daughters) or Rightful King (sons), whether or not Chrom has learned them.
- Morgan's starting class and fixed parent depend on the Avatar, whose asset/flaw is variable. Tactician is the default if the Avatar marries Chrom, Lucina, Olivia or Walhart (FEW Inheritance).
- SF's Severa page, Libra row, lists Dark Knight's skill as "Life Absorb". Every other page says **Lifetaker**. This is an SF typo.

---

## 3. Classes: max stats, class growths, tier, gender lock, skills

### Serenes Forest

| Data | URL | Shape | Rows |
|---|---|---|---|
| Class growths | https://serenesforest.net/awakening/classes/growth-rates/ | `Name, HP, Str, Mag, Skl, Spd, Def, Res`. **No Lck column**; the page note says "Luck growth is 0% for all classes". Rows merge promotion pairs with identical growths (`Lord, Great Lord`, `Mercenary, Hero`, `Wyvern Rider/Lord`, `War Monk/Cleric`, `Priest, Cleric`). Taguel is split M/F | 40 |
| Class max stats | https://serenesforest.net/awakening/classes/maximum-stats/ | `Class, HP…Res` in three tables: Non-promoted 16, Promoted 23, Special 13. Great Lord is split M/F; **Lord is not** | 52 |
| Class base stats | https://serenesforest.net/awakening/classes/base-stats/ | `Class, HP, Str, Mag, Skl, Spd, Def, Res, Mov, Weapon ranks` (no Lck; "Luck is 0") | 55 |
| Tier / promotion tree | https://serenesforest.net/awakening/classes/introduction/ | Visual tree (base → promoted), with a "(DLC only)" / "(SpotPass only)" / "(Enemy only)" annotation per class | – |
| Class skills | https://serenesforest.net/awakening/miscellaneous/skills/ | Skill table with `Class` and `Level` columns (§5) | – |
| Gender locks | https://serenesforest.net/awakening/characters/class-sets/ (prose) | "Fighter (male only), Barbarian (male only), Pegasus Knight (female only), Troubadour (female only)". Special classes are listed separately | – |
| Class-change rules | https://serenesforest.net/awakening/classes/class-changing/ | Prose plus a JS stat-change calculator | – |

### Fire Emblem Wiki

- **https://fireemblemwiki.org/wiki/List_of_classes_in_Fire_Emblem_Awakening:** one sortable wikitable of **82 rows × 59 columns**, with every gendered variant as its own row (`Lord (M)`, `Lord (F)`, `Cavalier (M)`, …).
  - Columns: Class, Icon, Unit type, **Tier** (Base/Advanced/Special), **Changes from**, **Changes to**, 9 base stats (incl. Lck and Mov), terrain group, 8 player growths (incl. Lck, always 0%), 8 enemy growths, 8 max stats, 8 pair-up bonuses, 6 weapon columns, **Skill 1, Skill 2**, weak/strong enemy skills, notes.
  - Header notes: Skill 1 is learned at Lv 1 by base/special classes and Lv 5 by advanced classes. Skill 2 is learned at Lv 10 by base classes and Lv 15 by advanced/special classes.
  - **Gender lock is implicit.** A class is locked if it appears without an (M)/(F) pair. Male-only: Barbarian, Fighter, Berserker, Warrior, Priest, War Monk, Dread Fighter, plus Hero (M) via Fighter. Female-only: Pegasus Knight, Falcon Knight, Dark Flier, Troubadour, Valkyrie, Cleric, War Cleric, Dancer, Bride.
- **https://fireemblemwiki.org/wiki/Module:ClassStats/FE13:** a Lua table of 56 entries with base stats, growths (`hpGrowth…resGrowth`, incl. `lckGrowth=0`) and weapon flags. It has **no max stats and no tier**.
- **Per-class pages** (e.g. https://fireemblemwiki.org/wiki/Thief) use `{{BaseStats}}` and `{{MaxStats}}` with `|gameN={{title|Awakening}}`.

### Agreement

- **Class growths:** SF vs FEW list = 77 (SF row, FEW row) pairs, 0 disagreements. SF vs FEW Lua module = 308 values; the only disagreement is **Conqueror Skl/Spd** (D1).
- **Class max stats:** SF vs FEW list = 81 pairs; the only disagreements are **Lord (M)** (D5) and **Thief Skl** (D6).
- **Class base stats:** SF vs FEW list vs FEW module, three-way over 448 values. Disagreements are listed in D7. Base stats matter only for child starting stats and reclass stat changes; the optimizer mainly needs caps and growths.
- **Class skills and levels:** SF vs FEW agree on all 95 skills (§5).
- SF's JS calculator and SF's class-growth HTML table agree on all 39 JS classes except Conqueror (D1).

### Quirks

- "Priest"/"Cleric" and "War Monk"/"War Cleric" are male/female names for the same stats. SF merges them; FEW lists them separately. Male Sage comes from Priest or Mage; War Cleric comes from Cleric or Troubadour.
- Taguel: SF gives one base row, marked `Taguel *`, plus a `(shifted)` row. The footnote says the unshifted row is the real base. SF has one max row. FEW splits Taguel (M)/(F).
- FEW's Pegasus Knight "Changes to" says `Falcon Knight, Dark Falcon`. "Dark Falcon" is the *Fates* name; in Awakening it is **Dark Flier**. This is a FEW typo.
- Soldier, Revenant, Entombed, Merchant, Mirage and Grima are enemy/NPC-only. Exclude them.

---

## 4. DLC and SpotPass classes

The ticket asks whether each class exists, how it is obtained, and whether it is gender-locked.

| Class | Exists? | How obtained | Gender | Available to our units? | Skills (Lv) | Sources |
|---|---|---|---|---|---|---|
| **Dread Fighter** | Yes, DLC | **Dread Scroll**, the reward from *Lost Bloodlines 2* (NA). Works like a Second Seal: Lv 10+ unpromoted, any level if promoted | **Male only** | Yes, any male unit. Not inheritable | Resistance +10 (1), Aggressor (15) | SF items https://serenesforest.net/awakening/inventory/items/ ; SF NA DLC https://serenesforest.net/awakening/miscellaneous/downloadable-content/north-america/ ; FEW DLC page "Classes" section |
| **Bride** | Yes, DLC | **Wedding Bouquet**, the reward from *Smash Brethren 2* (NA). Same rules as Dread Scroll | **Female only** | Yes, any female unit. Not inheritable | Rally Heart (1), Bond (15) | same |
| **Lodestar** | Yes, DLC/SpotPass | Personal class of the bonus Marth units only: DLC Prince Marth (*Champions of Yore 1*), SpotPass Marths | Male (Marth only) | **No.** Not in any first-gen or child class set; the Avatar can't reclass to it (SF class-changing page) | None listed by either source (FEW class list: Skill 1/2 blank; SF skill table has no Lodestar rows) | SF intro "Lodestar (SpotPass, DLC only)"; FEW https://fireemblemwiki.org/wiki/Lodestar |
| **Conqueror** | Yes, SpotPass | Walhart's personal class. SF labels it "(SpotPass only)" and FEW calls it "the personal class of Emperor Walhart" | Male (Walhart only) | **Only Walhart.** It is in his class set. It can't be inherited (FEW Inheritance: "Conqueror and Dancer can never be inherited"), and a Walhart+Avatar Morgan gets the *Conquest* skill, not the class | None as class skills; Walhart's personal skill is Conquest | SF class-sets, SF intro; FEW https://fireemblemwiki.org/wiki/Conqueror |
| **Dark Flier** | Yes, **not DLC** | Standard promotion of Pegasus Knight via Master Seal | **Female only** | Yes | Rally Movement (5), Galeforce (15) | SF class intro; FEW class list |

Other DLC items that change the optimizer's math:

- **Limit Breaker**: +10 to all stat caps. Reward from *Rogues and Redeemers 3*.
- **All Stats +2**: *Champions of Yore 3*.
- **Paragon**: ×2 EXP. *Lost Bloodlines 3*.
- **Iote's Shield**: removes the flying weakness. *Smash Brethren 3*.

All four are skill books usable on any unit, and none can be inherited. Sources: SF NA DLC page and SF items page; FEW DLC page "Skills" and "Items".

Quirks:

- SF's DLC landing page https://serenesforest.net/awakening/miscellaneous/downloadable-content/ has **no content**. It links to `/japan/`, `/north-america/` and `/europe/` sub-pages with different episode names, dates and prices.
- *Apotheosis* awards Katarina **or** a Supreme Emblem, not a skill.

---

## 5. Skills, including DLC skills

| | Serenes Forest | Fire Emblem Wiki |
|---|---|---|
| URL | https://serenesforest.net/awakening/miscellaneous/skills/ | https://fireemblemwiki.org/wiki/List_of_skills_in_Fire_Emblem_Awakening |
| Shape | One table: `Icon, Skill, Effect, Activation, Class, Level`, with footnote markers `*1..*4` inline. `*4` = DLC only. DLC skills are in the same table | Three tables: base game (`Skill, Effect, Learned at` as text like "Lord, level 1"), DLC, and enemy-only. **No activation-rate column.** Rates are on individual skill pages (`|gameN={{title\|Awakening}}` … `|activeN=`), e.g. https://fireemblemwiki.org/wiki/Lethality |
| Rows | 95 obtainable (incl. Shadowgift, Conquest, the 8 DLC skills and the "Outrealm Skill" placeholder) + 8 enemy-only | 87 base + 8 DLC = 95 + 8 enemy-only |

**Agreement:** skill names, class and learn level were compared for all 95 obtainable skills. The only differences were spelling ("Defence"/"Defense") and formatting ("Priest, Cleric" vs "Priest/Cleric"): 0 real disagreements.

I also compared effect text for about 10 skills. They were paraphrased differently but meant the same thing: Charm, Luna, Solidarity, Underdog, Aggressor, Rally Heart, Limit Breaker, Paragon, Galeforce, Special Dance.

Activation rates were spot-checked: Aether Skl/2 and Lethality Skl/4 match between SF's table and FEW's skill pages.

**DLC skills:**

- Class skills: Resistance +10 and Aggressor (Dread Fighter); Rally Heart and Bond (Bride).
- Skill books: All Stats +2, Paragon, Iote's Shield, Limit Breaker.

Both sources say none of them can be inherited.

**Personal / inheritance-only skills:**

- Shadowgift: Aversa, and Morgan as Aversa's child.
- Conquest: Walhart, and Morgan as Walhart's child.
- Aether and Rightful King are forced onto Chrom's children.

---

## 6. Transcription volume estimate

| Module | Records | Fields per record | Atomic values |
|---|---|---|---|
| First-gen units | 35 + Avatar | 8 growths + 7 cap mods + 3 base classes (+ gender) | ~650 |
| Avatar asset/flaw | 8 assets | growth +/−, cap +/−, only non-zero cells | ~100 |
| Children | 13 (+ Morgan M/F split) | 8 absolute growths, fixed parent, gender, default class set | ~170 |
| Gender class substitutions | ~11 parent rules | from→to lists | ~30 |
| Classes (player-usable) | ~48 distinct (≈75 with M/F variants) | tier, promotesTo[], gender, 8 growths, 8 caps, 2 skills (+ level), weapons | ~1,400 |
| DLC/special class flags | 5 | obtain method, gender, inheritable | ~25 |
| Skills | 95 | name, effect (paraphrased), class, level, activation, dlc, inheritable | ~650 |
| **Total** | | | **≈3,000 values** |

That is roughly **1,200–1,600 lines of typed TS**, excluding tests.

Much of this does not need to be typed by hand. Growths could be generated from **FEW Module:CharGrowths/FE13** and **Module:ClassStats/FE13** (Lua), or from **SF chargrowth13-2.js**, with a one-off script. Caps, modifiers and skills would still be hand-transcribed.

The FEW per-pair child pages give about 120 ready-made (child, parent) oracle cases for tests: 952 growth values and 924 cap-mod values.

Out of scope unless #1 wants them: the 70+ SpotPass/DLC legacy units (their asset/flaw data is on the SF modifiers page, and 123 of them are in the FEW module), plus class base stats, pair-up bonuses and enemy growths.

---

## 7. Every disagreement found

"Tie-break" means the reading that agrees with the most other tables. It is still not a first-party source. D1 needs a game-data dump or in-game verification to settle.

| # | Dataset | Item | Serenes Forest | Fire Emblem Wiki | Tie-break |
|---|---|---|---|---|---|
| **D1** | Walhart personal growths / Conqueror class growths | Skl, Spd | SF base-growth table: Walhart **30/30**. SF class table: Conqueror **15/15**. SF full-growth page: Walhart-as-Conqueror **45/45**. But SF's own calculator JS has Conqueror **20/20** | FEW Walhart page: personal **25/25** + class 20 (total 45). FEW Module:CharGrowths: Walhart **30/30**. FEW Module:ClassStats: Conqueror **20/20**. FEW class list: Conqueror **15/15** | Unresolved. Total Walhart-as-Conqueror = 45 is the majority reading, and personal 30 + class 15 has the most support. **Needs a third source.** |
| **D2** | Flavia cap modifier | Skl | Modifier table **+2** | CharStats **+1** | **+1**. SF's own complete-caps page shows Flavia Hero Skl 47 = 46 + 1, so SF's modifier table disagrees with SF itself |
| **D3** | Lucina (mother Maribelle) cap mod | Lck | Per-child page **+3** | Lucina/Stats **+5** | **+5** = Chrom 1 + Maribelle 3 + 1, per SF's own formula and modifier table (SF per-child page error) |
| **D4** | Kjelle (father Kellam / Lon'qu) cap mod | Res | Kellam **+1**, Lon'qu **−1** | Kellam **−1**, Lon'qu **+1** (values swapped) | **SF**: Sully 0 + Kellam 0 + 1 = +1 and Sully 0 + Lon'qu −2 + 1 = −1 (FEW per-pair page error) |
| **D5** | Lord (M) class caps | Str/Skl/Spd/Def | One "Lord" row: 25/26/28/25. SF's complete page applies it to Chrom too | Lord (M) **27/25/26/26**; Lord (F) 25/26/28/25. The Lord class page agrees | **FEW**: SF's single row is Lucina's Lord (F). Model Lord M/F separately |
| **D6** | Thief class cap | Skl | **30** | List **29**; FEW Thief class page **30** | **30** (FEW list typo) |
| **D7** | Class base stats (low priority) | various | Lord M Spd 7, Great Lord F Def/Res/Mov 8/4/6, Mercenary HP 18, Dread Fighter Skl 7, Conqueror Mag 3, Taguel single row 18/2/0/4/5/3/2 | List: Dread Fighter Skl **8**, Conqueror Mag **2**, Taguel (M) **18/3/0/4/4/4/1**. Module: Lord M Spd **6**, Great Lord F **6/1/5**, Mercenary HP **16**. The Conqueror and Dread Fighter class pages agree with SF | Majority = SF in every case except Taguel (M), which is unresolved (FEW list only) |
| D8 | Minor text | – | Severa page "Life Absorb" (should be Lifetaker); "Yenfay" spelling | Pegasus Knight → "Dark Falcon" (should be Dark Flier) | Typos, no data impact |

Checked with no disagreements:

- personal growths (392 values)
- child absolute growths (104)
- the per-pair child growth formula (952)
- class growths other than Conqueror (300+)
- class caps other than Lord (M) and Thief
- class pools (47 units)
- Avatar asset/flaw tables (4 matrices)
- skill list, classes and levels (95)
- DLC class gender locks and obtain methods

## 8. Recommendations for transcription (#1)

1. Treat **SF as primary** for units, modifiers and class tables. Treat **FEW as the cross-check** and as the source of pinned revision IDs.
2. Write down the resolution of each D-item in code comments, with both URLs.
3. Model classes gender-split, as FEW does, since Lord M and Lord F differ. Store class Luck growth as 0 explicitly.
4. Settle **D1 (Walhart/Conqueror)** before anything relies on Walhart's Skl/Spd, e.g. Morgan as Walhart's son.
5. Use the FEW `/Stats` per-pair pages as golden test fixtures for the inheritance math (floor rounding confirmed).
