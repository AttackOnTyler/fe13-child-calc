# Data disagreements: resolution (FE13 / Fire Emblem Awakening)

Resolves #13 (part of #1). Follows up on the disagreements D1–D8 in [`data-sources.md`](./data-sources.md) §7. Researched 2026-09-22.

## Summary

| Item | Resolved value | Confidence | Status |
|---|---|---|---|
| D1a Walhart personal Skl/Spd growth | **30 / 30** | High | Resolved |
| D1b Conqueror class Skl/Spd growth | **15 / 15** (default), 20 / 20 is the alternative | Low | **UNVERIFIED**: store as an editable assumption |
| D1c Walhart and Conqueror Skl/Spd *caps* | Conqueror 40/40; Walhart modifiers Skl 0, Spd −1 | High | No real disagreement. D1 is about growths, not caps |
| D2 Flavia Skl cap modifier | **+2** | Medium-high | Resolved |
| D6 Thief Skl class cap | **30** | Medium | Resolved |
| D7 Dread Fighter base Skl | **7** | Medium | Resolved |
| D7 Conqueror base Mag | **3** | Medium-high | Resolved |
| D7 Taguel (M) base stats | **18/2/0/4/5/0/3/2** (same as Taguel F; one row for both genders) | High | Resolved |
| D7 Lord (M) base Spd | **7** | Medium (weak source independence) | Resolved by majority |
| D7 Great Lord (F) base Def/Res/Mov | **8 / 4 / 6** | High | Resolved |
| D7 Mercenary base HP (extra item) | **18** | High | Resolved |
| Maiden cap modifiers | **all 0** (Lucina+Maiden = Chrom + 1 = +2/+1/+2/+2/+2/0/0) | High | Resolved |
| Maiden classes / skills passed on | **none** (Lucina keeps only Chrom's sets and her own skills) | High | Resolved |
| Maiden personal growths → Lucina's growths | unknown | – | **UNVERIFIED**. No published datamine anywhere |

## Sources consulted

Everything English-language turned out to descend from Serenes Forest (SF) or from the Fire Emblem Wiki (FEW). The only **independent lineage** I found is the Japanese community data, which SF itself credits as a source ("FEA 2ch strategy wiki").

| Tag | Source | Independent of SF/FEW? | Notes |
|---|---|---|---|
| **JP-2ch** | ファイアーエムブレム覚醒 2chまとめ&攻略wiki (atwiki): caps page https://w.atwiki.jp/fireemblem3ds/pages/79.html , class page https://w.atwiki.jp/fireemblem3ds/pages/107.html | **Yes**. It is SF's upstream, compiled in 2012 from JP play | Has class caps with a per-row **total** column, per-character cap modifiers (also with totals), class base stats *relative to Tactician/Grandmaster*, and player-verified caps in the comments. It has **no growth rates** |
| JP-PK | 天馬騎士団 FE13 wiki, class list: https://www.pegasusknight.com/wiki/fe13/クラス/一覧 | Mostly (JP) | Caps and pair-up only. Some cells are sloppy (e.g. Archer Mag cap 21, Villager Def 30) |
| JP-PTN | ptnwiki FE覚醒, Thief page: http://ptnwiki.com/fek/heishu-touzoku.shtml | JP (probably copies JP-2ch) | Growth cells are empty |
| SF-JS | SF calculators: https://serenesforest.net/app/java/chargrowth13-2.js (growths), https://serenesforest.net/app/java/fe13maxstats.js (caps) | No | The data behind SF's interactive pages. It can disagree with SF's own HTML tables |
| Fandom | https://fireemblem.fandom.com/wiki/ (Walhart, Flavia, Conqueror, Dread Fighter, Taguel, Lord, Lucina; `?action=raw`) | No | Several internal errors (e.g. Lord caps 28/20/26/27/31) |
| Oifey | OifeyBot DB: https://github.com/izumi-niche/OifeyBot/tree/main/database/fe13 (`job.json`, `char.json`) | Unclear | Stores personal bases as *offsets* from the class base plus raw pair-up values, which looks game-shaped. But every value matches SF's HTML tables, so I treat it as SF-derived |
| Misc | Tanas Manor https://tanasmanor.net/games/fe13/classes/stats.php ; fe-cli https://github.com/chocolatemelt/fe-cli/blob/master/dat/fea_baseclass_data_results.txt | No | Both match SF exactly |
| GG | Gamer Guides class pages, e.g. https://www.gamerguides.com/fire-emblem-awakening/guide/class-list/special-classes/conqueror | Possibly (letter grades) | Growths given only as letter grades (A–E) |
| GFAQ | GameFAQs *Guide and Walkthrough* (faqs/64260), https://gamefaqs.gamespot.com/3ds/643003-fire-emblem-awakening/faqs/64260 | JP-era guide | Personal growths as letter grades only |

**Could not reach:**

- SF forum threads (Cloudflare challenge; I did not attempt to bypass it)
- namu.wiki (blocked)
- the Internet Archive (offline during research)

**Not found:** any published raw `GameData.bin` dump of the FE13 class or person tables. Paragon and the Nightmare modules describe the file layout but ship no data. The one thing that would settle D1b is to dump `GameData.bin` from a legally owned copy with Paragon (https://github.com/thane98/paragon, `Data/FE13/UI/Modules/Job.yml`).

---

## D1: Walhart / Conqueror Skl & Spd

First, the ticket's wording ("personal modifier / class caps") doesn't match what is actually disputed. **Caps agree everywhere:**

- Conqueror caps are 80/45/25/40/40/45/45/35 in JP-2ch p.79, JP-PK, SF-JS, FEW and Fandom.
- Walhart's cap modifiers are +4/−2/0/−1/−1/+4/−2 in JP-2ch p.79 (row total 2), SF-JS, Fandom and Oifey.

The dispute is about **growth rates** only.

### D1a: Walhart personal growth, Skl/Spd = **30/30** (resolved)

| Source | Walhart personal (HP/Str/Mag/Skl/Spd/Lck/Def/Res) |
|---|---|
| SF base-growth table | 75/60/10/**30/30**/45/45/25 |
| SF-JS `chargrowth13-2.js` | 75/60/10/**30/30**/45/45/25 |
| FEW Module:CharGrowths/FE13 | 75/60/10/**30/30**/45/45/25 |
| Oifey `char.json` | 75/60/10/**30/30**/45/45/25 |
| FEW Walhart page (oldid 765770) | 75/60/10/**25/25**/45/45/25 |

The FEW page is the only dissent. Its history shows where the 25 came from:

- The 2013 revision (oldid 39144) listed Walhart-as-Knight totals implying Skl/Spd 30.
- The April 2018 revisions (oldid 170593/170611) changed them to totals that imply 25.
- The current page pairs personal 25 with class 20, which gives a Conqueror total of **45**. That is the same total as SF's 30 + 15.

So the editor most likely back-derived "25" from a total of 45 and a class value of 20. The disagreement is really about D1b. JP-GFAQ gives Walhart's Skl/Spd as grade **D**. On that guide's scale, Res 25–30 is also D, so the grade doesn't separate 25 from 30.

### D1b: Conqueror class growth, Skl/Spd = 15 or 20: **UNVERIFIED** (default 15)

| Says **15/15** | Says **20/20** |
|---|---|
| SF class growth-rate table https://serenesforest.net/awakening/classes/growth-rates/ | SF-JS `classes['Conqueror']` = 50/20/5/**20/20**/0/10/10 |
| SF full-growth page (static HTML) shows Walhart-as-Conqueror **45/45** | FEW Module:ClassStats/FE13 and FEW Conqueror page (`ClassGrowths` 20/20) |
| FEW *List of classes in Fire Emblem Awakening* | Fandom Conqueror page (Walhart's total 50/50) |
| FEW Walhart page total 25 + 20 = **45** | |
| Oifey `job.json` | |

Letter grades don't settle it either. Gamer Guides grades Conqueror Skl/Spd as **C**, but it also grades Great Knight's 15% Skl/Spd as C, so C covers both 15 and 20.

- **Weak signal for 15.** Every *displayed total* for Walhart-as-Conqueror is 45: SF full page, FEW Walhart page, and SF table 30 + 15. The 20 appears only in lookup tables. SF-JS also has a copy-paste artifact near this row: the `Lodestar` entry is labelled `'Class': 'Conqueror'` and carries Lord's growths. That suggests the JS class rows were hand-edited.
- **Recommendation.** Use Conqueror Skl/Spd = **15** as the default. Mark it `assumption: true` in the data, with 20 as the documented alternative.
- **Impact is small.** It only affects Walhart while he is in Conqueror, since Conqueror can't be inherited. It does not affect Morgan.

---

## D2: Flavia Skl cap modifier = **+2** (resolved)

| Source | Flavia modifiers (Str/Mag/Skl/Spd/Lck/Def/Res) |
|---|---|
| **JP-2ch p.79** (independent) | +1/−1/**+2**/+1/0/−1/0, row total **2** (with +1 the total would be 1) |
| SF modifier table | +1/−1/**+2**/+1/0/−1/0 |
| SF-JS `fe13maxstats.js` line 33 | `'Flavia': new Array(0, 1, -1, 2, 1, 0, -1, 0)` → **+2** |
| Oifey `char.json` | **+2** |
| FEW Flavia page, Fandom Flavia page | **+1** |

This **reverses** the tie-break in `data-sources.md`. There, SF's complete-caps page showing Flavia Hero Skl 47 (= 46 + 1) was taken as SF contradicting itself. That 47 is only the page's static fallback HTML. The calculator script that page actually loads (`fe13maxstats.js`) has +2, which gives Hero Skl 48. So SF, SF-JS and the independent JP table agree on +2, and only the FEW/Fandom pair says +1.

---

## D6: Thief Skl class cap = **30** (resolved, medium)

| Says **30** | Says **29** |
|---|---|
| SF max-stats table and SF-JS (`'Thief' … 60,22,20,30,28,30,21,20`) | FEW class list |
| FEW Thief class page | JP-2ch p.79 and p.107 *cell* |
| Tanas Manor, Oifey, fe-cli | JP-PK, JP-PTN (likely copied from JP-2ch) |
| **JP-2ch p.79 row total = 171** | |

The deciding evidence is JP-2ch's own **total column**. The Thief row reads 22/20/29/28/30/21/20 but totals **171**. With 29 in the Skl cell the sum is 170; with 30 it is 171. Every other row checked in that table sums exactly (Tactician 180, Lord 179, Conqueror 275). So the "29" is a cell typo that other JP wikis copied. An in-game check would make this definitive: Gaius as a Thief should cap Skl at 32 (Thief 30 + Gaius +2).

---

## D7: Class base stats

JP-2ch p.107 lists class base stats **relative to Tactician** (unpromoted) and **Grandmaster** (promoted). SF/FEW agree on the Tactician and Grandmaster rows (16/4/3/5/5/0/5/3 and 20/7/6/7/7/0/7/5, Mov 6), so the relative rows can be turned into absolute values. This is an independent check.

| Item | SF | FEW (list / module / page) | Independent evidence | Resolved |
|---|---|---|---|---|
| Dread Fighter Skl | 7 | list 8; DF page 7 | Fandom 7, Oifey 7 (not independent; JP-2ch has no DLC base rows) | **7** |
| Conqueror Mag | 3 | list 2; module 3; Conqueror page 3 | Fandom 3, Oifey 3 | **3** |
| Taguel (M) | one row 18/2/0/4/5/0/3/2 | list (M) 18/3/0/4/4/4/1 | **JP-2ch:** one タグエル row, Tactician +2/−2/−3/−1/0/0/−2/−1 → 18/2/0/4/5/0/3/2 | **18/2/0/4/5/0/3/2 for both genders** (growths still differ M/F) |
| Lord (M) Spd | 7 | module 6; list 7 | JP-2ch only has Lucina's Lord row. Fandom, Tanas and Oifey say 7 (all SF-shaped) | **7** (majority; no independent source) |
| Great Lord (F) Def/Res/Mov | 8/4/6 | module 6/1/5 | **JP-2ch:** マスターロード(ルキナ) = Grandmaster +1/−5/+2/+4/0/+1/−1, Mov 6 → Str 8, Mag 1, Skl 9, Spd 11, Def 8, Res 4, Mov 6 | **8/4/6** |
| Mercenary HP (extra) | 18 | module 16 | **JP-2ch:** 傭兵 HP +2 → 18 | **18** |

Side note on D5 (Lord (M) caps, already resolved in favour of FEW):

- JP-PK's single Lord row is **60/27/20/25/26/30/26/25**, i.e. FEW's Lord (M) values. JP-2ch's single row is the Lord (F) values. This supports modelling Lord M and Lord F separately.
- JP-2ch comments confirm **Great Lord (M)** caps in-game: a player reports Chrom maxing at Str 44 / Skl 41 / Spd 42 / Lck 46, which equals 43/40/41/45 + Chrom's +1s (p.79, 2012-05-04).

---

## The Maiden (Chrom's default wife)

The Maiden is 村娘 in Japanese; JP-2ch calls her "MOB村娘".

**Cap modifiers: all 0 (resolved).**

- JP-2ch p.79 lists "MOB村娘" with − in every column and a total of 0.
- Players confirmed it via Lucina. A p.79 comment dated 2013-02-07 reports a Maiden-mother Lucina at **2 1 2 2 2 0 0**, which is Chrom's +1/0/+1/+1/+1/−1/−1 plus 1. The comment thread explicitly corrects an earlier guess of −1 per stat.
- FEW Lucina/Stats has the same Maiden row (+2/+1/+2/+2/+2/0/0), and SF-JS has `'Maiden': empty` (zero).

**Classes and skills: none (resolved).**

- SF-JS gives Lucina+Maiden only `classes['Lord/Great Lord']`, plus Chrom's sets through the usual rule.
- FEW Maiden and Lucina/Stats: Lucina inherits no class or skill from the Maiden (https://fireemblemwiki.org/wiki/Maiden).

**Personal growths: UNVERIFIED.**

- SF-JS has `'Maiden': unknown`. FEW Lucina/Stats shows "??" for every growth and says "All of Lucina's growth rates with the Maiden as her mother are unknown at this time."
- JP-2ch publishes no growths at all.
- FEW's Maiden article says she "passes down no … growth rates". That is gameplay commentary and gives no numbers.
- I found no datamine. The Maiden does exist as a character record in game data, since she has a cap-modifier row, so a `GameData.bin` dump would settle it.

**Resulting Lucina growths: UNVERIFIED.** Lucina's growth is `floor((Chrom + Maiden + Lucina)/3) + class`, and Maiden is unknown. Options for #1:

1. **Recommended:** mark the Maiden pairing as having unknown growths in the UI and exclude it from growth-based ranking. Still show her caps (Chrom + 1) and her class/skill set (Chrom's only).
2. Use an editable placeholder of Maiden growths = 0 in every stat, giving `floor((Chrom + Lucina)/3) + class`. Label it clearly as an assumption, since there is no evidence she is 0.

---

## Items still UNVERIFIED

| Item | Competing values | What would settle it |
|---|---|---|
| Conqueror class Skl/Spd growth | **15** (SF table, FEW list, displayed totals of 45) vs **20** (SF-JS, FEW module and class page, Fandom) | `GameData.bin` Job table dump (Paragon), or statistical level-up testing on Walhart as Conqueror |
| Maiden personal growths (and so Lucina+Maiden growths) | unknown in every source | `GameData.bin` Person table dump |

Lower-confidence resolutions worth a quick in-game check if convenient:

- Thief Skl cap 30: Gaius as Thief should cap at 32.
- Lord (M) base Spd 7: Chrom's Lord→Great Lord promotion should give Spd +2 (it would be +3 if the base were 6).
- Flavia +2 Skl: Flavia as Hero should cap Skl at 48.
