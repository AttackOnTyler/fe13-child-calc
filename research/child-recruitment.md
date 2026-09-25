# When can a child be recruited, and what does it bring from its parents then?

Resolves #140 (part of #136, Map: Endpoint-first planning). Researched 2026-09-25 against `origin/main` at `6b22510`.

This is a findings file, not a data file. It covers all thirteen children (Lucina, Owain, Inigo, Brady, Kjelle, Cynthia, Severa, Gerome, both Morgans, Yarne, Laurent, Noire, Nah). Sources are tagged in brackets and listed in §8. FEW pages are cited by the `oldid` that was read. For the paralogue pages and Chapter 13 that is the same revision the app's chapter data was generated from.

## Summary

| Question | Answer | Confidence |
|---|---|---|
| **When does a child's paralogue open?** | When Chapter 13 is cleared **and** the child's fixed parent is married (their S-support has been viewed). Either can come first. If the marriage comes later, the paralogue appears at the next world-map update [FEW-P5…P16, SF-gaiden, JP-112, JP-PK]. | High |
| **Can the player reach it at once?** | Seven can be played straight away (P8, P10, P12, P13, P14, P15, P16). Five also need their map location reachable: P5, P6, P7, P9 and P11 need Chapter 14, 15, 16 or 18 cleared, or another child paralogue unlocked (§1) [FEW, SF-gaiden, JP-P5…P12]. | High (C6 is one wording difference) |
| **How long does it stay open?** | Until it is played. There is no deadline, and the child never joins unless the player enters it, so recruitment can be put off indefinitely [FEW-para, FEW-13, JP-112]. | High |
| **Lucina** | Story-recruited, automatically, at the end of Chapter 13 [SF-rec, FEW-Luc]. Her mother is fixed at the end of Chapter 11: Chrom's S-support partner, or else the candidate with his highest support, or else the Maiden [FEW-inh, JP-112]. | High |
| **When is the inheritance read?** | **When the player enters the child's paralogue**, not at the S-support, not when the paralogue appears, and not when the child is talked to. Backing out to the world map and re-entering reads it again. For Lucina it is **the start of Chapter 13** (C1) [SF-children, FEW-inh, JP-112, JP-PK, FEW-LucS]. | High (Lucina: medium-high) |
| **Which skill does each parent pass?** | Its **lowest (bottom-slot) eligible equipped skill**. "Most recently equipped" describes the same skill, because a newly equipped skill goes to the bottom of the list. Every source that describes the list says "bottom", and a player test confirms it. **`inherit-last-skill` = `bottom-slot` is right** (C2) [JP-112, JP-PK, FEW-Luc, FEW-LucS, SF-children]. | High |
| **Exceptions** | Chrom always passes Aether to a daughter and Rightful King to a son, learned or not. So does a Chrom child who parents Morgan. Walhart passes Conquest and Aversa passes Shadowgift, always. The Maiden passes nothing. Special Dance and DLC skills are skipped, and the next eligible skill up passes. If both parents would pass the same skill, **one parent's second-lowest skill passes instead**, which contradicts the app's default (C3). A passed skill the child already has is wasted (§3). | High, except C3 (single source) |
| **Stat bonus** | `child stat = floor(((mother now − mother's class base) + (father now − father's class base) + child's absolute base) / 3) + child's class base`. Each point a parent has grown adds a third of a point. This was verified on an in-game Lucina: all 8 stats match, and they rule out rounding to nearest (§4) [SF-bases, SFF-33434]. | High for the formula. Rounding when the sum inside is negative, and clamping at caps, are open (G1, G2) |
| **Join level and class** | **Level 10** in a fixed class: Lucina Lord, Owain Myrmidon, Inigo Mercenary, Brady Priest, Kjelle Knight, Cynthia Pegasus Knight, Severa Mercenary, Gerome Wyvern Rider, Yarne Taguel, Laurent Mage, Noire Archer, Nah Manakete. Morgan starts in the other parent's starting class, or as a Tactician if that parent is Chrom, Lucina, Olivia or Walhart. **Nothing scales the level**, whether chapter, difficulty or the parents' levels. Only the stats scale, through the parents [SF-bases, FEW child pages, JP-112]. | High |

**What this means for the roadmap (#136):**

1. **"Hold the skill" really means "have learned it by entry".** Skills can be swapped freely outside battle [FEW-skills]. A parent only needs the skill *in its pool* when the paralogue is entered. It can be moved to the bottom slot right before entering and taken off right after. So the milestone is "parent has learned skill X by the time the child's paralogue is entered". That usually means being in, or having been in, the class that teaches it at the right level. It does not mean keeping it equipped in battle.
2. **Each child is its own snapshot.** A parent with two children (Chrom's wife: Lucina, then the sibling; Robin's wife: Morgan, then her own child) is read twice, at two different entries, and can pass a different skill each time.
3. **Only Chrom's wife has a hard deadline**: her skill must be at the bottom when Chapter 13 starts, and Chrom's marriage is decided at the end of Chapter 11 [JP-FAQ, JP-112, FEW-inh]. Every other child waits for the player.
4. **Entering later makes a stronger child but gives it less time to earn EXP.** Paralogue enemies don't scale (FEW lists fixed levels per difficulty), and the child's level stays at 10. The parents' growth since joining flows in at a third of a point per stat point.
5. **The unlock is a chain for some children.** Second-gen Morgan needs: the partner's parent married → the partner's paralogue played → the partner and Robin reach S → P12. Gerome, Cynthia, Owain and Brady may also wait on story chapters, or on other couples, for map access.

## 1. Per child: unlock, window, join point, join level and class

Every paralogue below also needs **Chapter 13 cleared** [FEW-13: "Clearing this chapter is the first requirement toward unlocking twelve different paralogue chapters… there is no set deadline"]. Once open, each **stays open until played** [FEW-para: "once unlocked, they remain open for the rest of the game until the player completes them"]. "Reach" is the extra map-access condition.

| Child | Map | Opens when (with Ch 13 cleared) | Also needs, to reach it | Joins how, in the map | Join class, level | Sources |
|---|---|---|---|---|---|---|
| **Lucina** | Ch 13 *Of Sacred Blood* (story) | Always. Chrom is married by the end of Ch 11 (§3.3) | — | Automatically at the end of Ch 13 | Lord 10 | SF-rec; FEW-Luc (oldid 773085); JP-42 |
| **Owain** | P5 *Scion of Legend* | Lissa married | Ch 14 cleared, **or** P9 and P10 both unlocked | NPC; talk with Chrom or Lissa | Myrmidon 10 | FEW-P5 (742102); SF-gaiden; JP-P5 |
| **Inigo** | P6 *A Man for Flowers* | Olivia married | Ch 14 cleared, **or** P12 unlocked | NPC; talk with Chrom or Olivia | Mercenary 10 | FEW-P6 (742030); SF-gaiden; JP-FAQ |
| **Brady** | P7 *Noble Lineage* | Maribelle married | Ch 15 cleared, **or** P6 unlocked and reachable (Ch 14 cleared or P12 unlocked) (C6) | NPC; talk with Chrom or Maribelle | Priest 10 | FEW-P7 (769016); JP-P7; SF-gaiden |
| **Kjelle** | P8 *A Duel Disgraced* | Sully married | — (next to Ch 4) | NPC; talk with Chrom or Sully | Knight 10 | FEW-P8 (742211); SF-gaiden |
| **Cynthia** | P9 *Wings of Justice* | Sumia married | Ch 18 cleared (the road runs through P17), **or** Ch 14 cleared and P5 unlocked, **or** P10 unlocked | **Enemy**; talk with Chrom or Sumia | Pegasus Knight 10 | FEW-P9 (742121); SF-gaiden; JP-P9 (incl. a player report of the Ch 18 → P17 route) |
| **Severa** | P10 *Ambivalence* | Cordelia married | — (next to Ch 10 and 13) | NPC; she must reach and talk to the enemy villager Holland (FEW's story text has her set off after Chrom or Cordelia speaks to her). If Holland dies first, she turns enemy and can't be recruited | Mercenary 10 | FEW-P10 (742184); SF-rec |
| **Gerome** | P11 *Twin Wyverns* | Cherche married | Ch 16 cleared, **or** Ch 14 cleared and P5 unlocked, **or** P5, P9 and P10 unlocked | NPC; talk with Chrom or Cherche | Wyvern Rider 10 | FEW-P11 (769229); SF-gaiden; JP-P11 |
| **Morgan (F / M)** | P12 *Disowned by Time* | Robin married (to anyone, a child included) | — (next to Ch 12) | NPC; talk with Chrom or Robin | The other parent's starting class; Tactician if that is Lord, Dancer or Conqueror (Chrom, Lucina, Olivia, Walhart). Level 10 | FEW-P12 (741938); FEW-Mor; SF-children; JP-112 |
| **Yarne** | P13 *Rival Bands* | Panne married | — (next to Ch 10) | Enemy or NPC depending on the side the player backs; talk with Chrom or Panne | Taguel 10 | FEW-P13 (741913); SF-rec |
| **Laurent** | P14 *Shadow in the Sands* | Miriel married | — (next to Ch 6 and P1) | Visit the south-western mirage village with Chrom or Miriel | Mage 10 | FEW-P14 (741822); SF-rec |
| **Noire** | P15 *A Shot from the Dark* | Tharja married | — (next to P4) | Automatically from turn 2 | Archer 10 | FEW-P15 (741793); SF-rec |
| **Nah** | P16 *Daughter to Dragons* | Nowi married | — (next to P3) | NPC; talk with Chrom or Nowi | Manakete 10 | FEW-P16 (742094); SF-rec |

Notes:

- **"Married" means the S-support conversation has been viewed** [JP-112: 「支援会話Sを発生(閲覧)させると結婚する」, marriage happens when the S support is viewed]. Several marriages made at one support opportunity all appear at the next world-map update [JP-89]. From Chapter 14 on, a new paralogue appears right after its marriage [JP-PK].
- **Map access.** SF phrases it as "requires access to Chapter N", meaning Chapter N's location is open, which is the same as FEW's "clear Chapter N−1". The two agree for P5, P6, P9 and P11. P7 is the one real difference (C6). Paralogue locations link to each other, so once all twelve child paralogues are unlocked, every one is reachable straight after Chapter 13 [JP-112, JP-PK].
- **Recruit methods** agree between SF recruitment and FEW `NewUnit` for all thirteen. The app's chapter data carries FEW's text (§5).
- **Chapter 13 by itself unlocks nothing unless a fixed parent is married.** FEW notes that at least one paralogue is guaranteed when Chapter 13 is cleared, as long as Chrom didn't marry the Maiden, because his wife's child is then due [FEW-13].

## 2. When the inheritance is read

| # | Claim | Source |
|---|---|---|
| T1 | Skill inheritance "occurs at the moment you enter the mission required to recruit the child, so you've got plenty of time to play around with the parents' Skills". | SF-children |
| T2 | "Inherited attributes are determined when the player begins the paralogue in which the child is recruited." | FEW-inh (oldid 752340) |
| T3 | 「能力値・継承スキルの判定は外伝突入時に起きる」: stats and the inherited skills are decided **on entering the paralogue**. Entering doesn't lock them: 「編成画面で一旦マップに戻ってスキルを並べ替えれば、再突入時にはその変更がちゃんと反映されている」 (go back from the preparations screen to the world map, rearrange skills, and the change shows on re-entry). The same holds for stats: 「一度出てドーピングして入り直せば変わっていた」 (backing out, using stat boosters and re-entering changed them). | JP-112; same text on JP-89 |
| T4 | 「子供の初期能力値・引き継ぎスキルは子供が仲間になる外伝攻略時に決まる模様(外伝出現時には確定しない)」: decided when the paralogue is played, **not when it appears**. A player comment on the same page: a parent at promoted level 1 gave a weak child, and levelling the parents to about 15 first raised the child's bases, so the S-support timing doesn't matter. | JP-PK |
| T5 | **Lucina**: the mother's skill must be the last eligible skill in her set "at the beginning of Chapter 13" (written for each mother). JP: 「母親から継承させたいスキル…は13章開始前にスキル着脱で一番下にセットすること」 (put it at the bottom **before Chapter 13 starts**). JP FAQ: Chrom's wife is the only parent with a deadline: 「13章までに」 (by Chapter 13). | FEW-LucS (oldid 746071); JP-112; JP-FAQ |
| T6 | A parent lost in Classic mode is read as it was just before the loss (「ロスト前の能力及びスキルが参照」). | JP-112 (as already used by `research/death-after-marriage`, #17) |

So the snapshot is taken at **entry**. The parent doesn't need to be deployed on that map, and nothing that happens inside the paralogue (level-ups, skill swaps) counts. Whether a skill change made inside the preparations screen counts, without backing out to the world map, isn't stated (G6). Plan on setting everything before selecting the map.

## 3. Which skill each parent passes

### 3.1 The rule, and settling `inherit-last-skill`

| Source | Wording | Reading |
|---|---|---|
| SF-children | "The children inherit the last active Skill from each of their parents." | "last" = last in the list |
| FEW-inh | "Children will inherit the most recently activated skills known by each parent" | recency |
| FEW-Luc, FEW-Mor (and Nah, Yarne infoboxes) | "The lowest eligible skill in the [parent]'s equipped skill list." | bottom slot |
| FEW-LucS | "if it is the last eligible skill in [mother]'s set at the beginning of Chapter 13" | bottom slot |
| JP-112 | 「継承されるのは、基本的にスキル着脱において一番下に付けたスキル」 (basically, the skill set **lowest** in the equip screen) | bottom slot |
| JP-89 | 「通常は両親のスキル欄の最後のスキル」 (normally the last skill in each parent's skill column) | bottom slot |
| JP-PK | 「引き継ぎスキルはそれぞれの親の一番下のスキル」 (each parent's bottom skill). A player comment reports resetting, reordering Tharja's and her husband's skills, and getting the bottom one: 「リセットしてサーリャと旦那のスキルを並び替えたら確かに一番下のスキルを引き継ぎました」 | bottom slot, **tested** |

**Verdict: the bottom-slot reading is right.** Every source that describes the equipped list says "bottom" or "last", and one player test confirms it. FEW-inh's "most recently activated" is the only wording that could mean anything else. It describes the same skill in practice, because players reorder skills by taking them off and putting them back on (JP's 「並べ替え」): the skill put back on last ends up at the bottom. No source describes a way to insert a skill mid-list. The app's default `bottom-slot` stands, and the `most-recent` alternative has no source of its own (C2). Recommend citing JP-112 and JP-PK on the assumption, or retiring it.

### 3.2 Eligibility and edge cases

| Case | Rule | Source | App (`src/engine/assumptions.ts`) |
|---|---|---|---|
| Special Dance at the bottom | Skipped; it is "excluded from the candidates" (「候補から除外される」), so the next eligible skill up passes | JP-PK; FEW-Luc ("lowest eligible") | `inherit-ineligible-bottom` = `next-eligible`: **agrees** |
| DLC skills (Dread Fighter and Bride skills, All Stats +2, Paragon, Iote's Shield, Limit Breaker) | Never passed; excluded from the candidates the same way | JP-112 (names all eight, plus Special Dance); JP-PK; SF-children; FEW-inh | agrees |
| The passed skill is one the child already starts with | **The slot is wasted** (「継承スキルと子の固有スキルが被ると、継承枠が無駄になる」) | JP-89. JP-PK says "unknown" | `inherit-duplicate-skill` = `wasted`: **agrees**, now with a source |
| Both parents would pass the same skill | **One parent's second-lowest skill passes instead**; which parent is unknown (「親同士の引き継ぎスキルが重複した場合、片方の親の下から二番目のスキルが選択される(父、母の優先度不明)」). A player report on the same page: Stahl × Sully, skills not reordered, gave a Kjelle with *both* Discipline and Outdoor Fighter | JP-PK | `inherit-same-skill` = `one-copy`: **disagrees** (C3) |
| A parent with no eligible skill equipped | Passes nothing; the other parent does not pass two (「もう片方の親から2つスキルを受け継ぐなどはない」) | JP-PK; FEW-Luc | agrees |

### 3.3 Fixed passes and Chrom's children

| Case | Rule | Source | App |
|---|---|---|---|
| Chrom → any daughter (Lucina; Kjelle or Cynthia by Sully or Sumia) | Always **Aether**, learned or not | SF-children; FEW-inh; JP-112; JP-FAQ | `FIXED_INHERITANCE.chrom`: agrees |
| Chrom → a son (Inigo or Brady by Olivia or Maribelle; Morgan (M) by Robin (F)) | Always **Rightful King**, learned or not. A JP-PK player saw Morgan get Rightful King from a Chrom who hadn't learned it | same; JP-PK comment | agrees |
| A Chrom child as Morgan's parent: Lucina or a Chrom daughter → Morgan (F); a Chrom son → Morgan (M) | Always **Aether** / **Rightful King**. A JP-PK player got Aether on Morgan through Cynthia | FEW-inh; JP-112; JP-PK comment | `CHROM_CHILD_PASSES`: agrees |
| Walhart / Aversa → Morgan | Always **Conquest** / **Shadowgift** | FEW-inh; JP-112; JP-PK | agrees |
| The Maiden → Lucina | **Nothing** | FEW-Luc; FEW-LucS | agrees |
| Chrom's mother-side partner for Lucina | Chrom's S-support partner. If there is none at the end of Chapter 11, he marries the candidate (Sumia, Maribelle, Sully, Olivia, Robin (F)) with the highest support level. If all of those are at 0, he marries the Maiden. A candidate lost in Classic can still be picked. Olivia must reach at least support C with Chrom to count | FEW-inh ("automatically marries whoever he has the highest support level with at the end of Chapter 11… if he has not gained enough support points… the Maiden"); JP-112; JP-89 (tie order probably Sumia > Maribelle > Sully > Olivia > Robin (F)); JP-27 (Olivia C) | `CHROM_FALLBACK_PARTNER` comment says the Maiden whenever there is no S-support: **disagrees** (C7) |

Because Chrom's pass is fixed, Chrom himself needs no skill set-up for any child. Only his current **stats** matter to them.

### 3.4 Morgan's second-generation rules

| Item | Rule | Source |
|---|---|---|
| Unlock | P12 opens once **Robin is married** (and Ch 13 is cleared). With a child partner, the chain is: the partner's paralogue is played, then the partner reaches S with Robin, then P12 appears | FEW-P12; SF-gaiden; JP-112 |
| Start class | The partner's **starting** class. FEW: the "original base class" of the father or mother, and Tactician if Robin married Chrom, Lucina, Olivia or Walhart. JP-112's table lists Nah → Manakete and Yarne → Taguel (no promotion branch), and Lucina → Tactician: **second-gen partners give their own start class**. A JP-PK player: 「ルキナと結婚しても子供は戦術師でした」 (with Lucina, Morgan was a Tactician). JP-27: a promoted partner gives its lower class | FEW-inh; FEW-Mor; SF-children; JP-112; JP-27; JP-PK | 
| Skills | Robin's bottom eligible skill, plus the partner's. The partner can pass a skill it only has through its own inheritance ("directly or indirectly"). Chrom children and Walhart/Aversa pass their fixed skills (§3.3). Robin can pass gender-locked skills Morgan could not otherwise learn | FEW-Mor; `research/skill-inheritance` §2 |
| Cap modifiers | No +1 when the partner is a child | `research/stat-inheritance` (b) |
| Base stats | The same formula (§4), with the partner child's *current* stats and class base. Not stated separately for this case | Inference from §4 |

The app's `morgan-second-gen-start-class` default (`partner-start-class`) **agrees**, and JP-112's table is a source it can cite.

## 4. Stats and level at recruitment

### 4.1 The formula

```
child stat = floor( ((mother's current − mother's current class base)
                   + (father's current − father's current class base)
                   + child's absolute base) / 3 )
             + child's start class base                         (HP, Str, Mag, Skl, Spd, Lck, Def, Res; Luck has no class base)
```

- **SF-bases** states it: "The children's actual base stats = [(mother's current stats – mother's class base stats) + (father's current stats – father's class base stats) + child's absolute base stats] / 3 + child's class base stats". FEW's per-child `/Stats` pages restate it [FEW-LucS, FEW-OwS].
- **Origin.** Remnant Sage took it from the two Japanese guidebooks (SF forums, topic 33434, 2012-06-20). SF's first version left out the child's absolute base. Remnant Sage corrected it the next day ("If you don't subtract the child's absolute base stats, their calculated starting stats would be too high"), and VincentASM fixed the page. SF's base-stats page credits Remnant Sage.
- **Rounding: floor.** Remnant Sage: "drop any fractions". The worked example below settles it for the normal (positive) case.
- **Class base** is the parent's **current** class: in the example, Chrom is subtracted as a Great Lord and Sumia as a Dark Flier.
- **Current stats** include stat boosters. JP-112: backing out, using boosters and re-entering changed the child. A JP-106 comment: +6 to one parent stat gave +2 to the child, which is exactly one third. They are read at paralogue entry (§2), or at death for a parent lost in Classic (T6).

**Worked example: an in-game Lucina** [SFF-33434, Remnant Sage, 2012-06-20]. Chrom (Great Lord) and Sumia (Dark Flier) stats right after Chapter 13, and the Lucina who joined. Class bases are from SF class base stats (the app's `CLASS_BASES` agrees).

| | HP | Str | Mag | Skl | Spd | Lck | Def | Res |
|---|---|---|---|---|---|---|---|---|
| Chrom current | 52 | 27 | 7 | 27 | 31 | 27 | 23 | 14 |
| − Great Lord (M) base | 23 | 10 | 0 | 7 | 9 | 0 | 10 | 3 |
| Sumia current | 46 | 24 | 16 | 37 | 37 | 30 | 10 | 25 |
| − Dark Flier base | 19 | 5 | 6 | 8 | 10 | 0 | 5 | 9 |
| Lucina absolute base | 12 | 5 | 1 | 8 | 4 | 13 | 3 | 3 |
| Sum / 3 | 22.67 | 13.67 | 6 | 19 | 17.67 | 23.33 | 7 | 10 |
| floor + Lord (F) base (16/5/1/6/8/0/6/1) | **38** | **18** | **7** | **25** | **25** | **23** | **13** | **11** |
| **Observed Lucina** | 38 | 18 | 7 | 25 | 25 | 23 | 13 | 11 |

All 8 stats match. Rounding to nearest would give HP 39, Str 19 and Spd 26, so it is floor.

### 4.2 What follows from it

- **A third of a point per point.** Each stat point a parent gains after joining adds ⅓ to the child. Two parents who each gained 3 in a stat add 2.
- **Reclassing is neutral until a parent hits a cap.** In Awakening, "the unit's stat changes are equal to the difference between the base stats of their former class and their new class" [FEW-reclass, oldid 766323], so `current − class base` doesn't change. For a parent **at** a cap, the class it is in at entry matters: the gap between cap and class base varies by class. FEW's `/Stats` maximum ranges are worked out that way ("the maximum possible caps of each parent", with hover notes such as "23 if Chrom reached Dread Fighter cap") [FEW-LucS]. This is derived from the formula, not tested.
- **The child's bases are probably clamped at its start-class caps.** FEW's ranges assume it ("rounded down to Lucina's maximum unpromoted stats"). Othin asked on the thread what happens past the cap ("wrap-around"), and nobody answered (G2).
- **No difficulty term.** No source gives one. SF lists Hard/Lunatic rows for fixed-stat recruits (Gregor, Basilio, Flavia, the SpotPass units) but none for children (G8).
- **The Maiden** has no published stats. FEW-LucS's Lucina + Maiden minimum treats her contribution as 0.

### 4.3 Join level and class

- **Level 10, always** [SF-bases (all thirteen rows, Lv 10); FEW `NewUnit` / `CharStats` `lv=10` for all thirteen; JP-112: 「子供は加入時点でLv10」]. No source mentions any scaling by chapter, difficulty, or the parents' levels. Awakening's paralogue enemies are also fixed per difficulty [FEW chapter pages; FEW-13 strategy: "Cynthia (level 3 promoted enemies), Brady (level 5 enemies)…"].
- **Class**: fixed (table in §1). Morgan's follows the partner (§3.4).
- **Starting skills**: the start class's level-1 and level-10 skills, or only the level-1 skill for Taguel, Manakete and Villager, plus the two inherited skills: "計3～4個" (3–4 in all) [JP-89; SF-bases: Owain "Avoid +10, Vantage", Yarne "Even Rhythm", Nah "Odd Rhythm"]. Lucina has Dual Strike+, Charm, Aether and her mother's skill [SF-bases].

### 4.4 Child absolute bases (needed for the formula)

HP / Str / Mag / Skl / Spd / Lck / Def / Res. Compared by script: SF base stats, FEW `CharStats FE13` `{{Personal|…}}`, and the guidebook table posted by Remnant Sage. **104 values, 0 differences.**

| Child | Absolute base | Start class |
|---|---|---|
| Lucina | 12 / 5 / 1 / 8 / 4 / 13 / 3 / 3 | Lord |
| Owain | 10 / 4 / 4 / 5 / 6 / 9 / 6 / 5 | Myrmidon |
| Inigo | 11 / 5 / 2 / 4 / 9 / 12 / 4 / 4 | Mercenary |
| Brady | 9 / 6 / 5 / 4 / 2 / 10 / 7 / 4 | Priest |
| Kjelle | 10 / 6 / 2 / 6 / 5 / 11 / 3 / 3 | Knight |
| Cynthia | 7 / 5 / 2 / 4 / 10 / 17 / 6 / 6 | Pegasus Knight |
| Severa | 8 / 6 / 1 / 7 / 6 / 6 / 6 / 5 | Mercenary |
| Gerome | 13 / 8 / 0 / 4 / 8 / 5 / 5 / 1 | Wyvern Rider |
| Morgan (both) | 9 / 6 / 8 / 7 / 6 / 7 / 3 / 7 | Varies |
| Yarne | 16 / 9 / 1 / 4 / 4 / 13 / 6 / 1 | Taguel |
| Laurent | 10 / 3 / 7 / 7 / 4 / 11 / 4 / 5 | Mage |
| Noire | 8 / 5 / 3 / 4 / 7 / 10 / 4 / 6 | Archer |
| Nah | 5 / 3 / 3 / 5 / 6 / 8 / 3 / 3 | Manakete |

## 5. What the app says, against the sources

| Item | App (file) | Sources | Verdict |
|---|---|---|---|
| Paralogue unlocks | `chapter-13` `unlocks` lists P5–P16 unconditionally (`src/game-data/chapters/ch13-19.ts`). Every paralogue record has `unlocks: []` (`paralogues.ts`). `PARALOGUE_NOTES` in `src/engine/run.ts` adds a note only: "Opens once the child's parent is married (after Chapter 13)", with P7 "…Maribelle has an S support" and P12 "…Robin is married" | Marriage **gates** the paralogue. P5, P6, P7, P9 and P11 also need map access (§1) | **Partly agrees.** The marriage condition is right but only a note, so `nextMaps` offers a paralogue whose parent isn't married. Map access is missing (C9) |
| Child recruits in chapter data | `recruits` on P5–P16 and Ch 13 (FEW's `NewUnit`): class, level 10, method | SF-rec, FEW | **Agrees** (all thirteen) |
| `inherit-last-skill` | Default `bottom-slot`; alternative `most-recent` | Bottom slot (§3.1) | **Agrees.** The alternative has no source (C2) |
| When the skill is read | `skills.ts`: "…when the child's paralogue starts"; `InheritableSkills` doc: "the lowest equipped one when the paralogue starts" | Paralogue **entry**, re-read on re-entry. For Lucina, the start of Chapter 13 | **Agrees**, but the note should say so for Lucina, whose "paralogue" is Chapter 13 |
| `inherit-ineligible-bottom` | `next-eligible` | JP-PK "excluded from the candidates"; FEW "lowest eligible" | **Agrees** |
| `inherit-duplicate-skill` | `wasted` | JP-89 "the slot is wasted"; JP-PK "unknown" | **Agrees**. Can cite JP-89 |
| `inherit-same-skill` | `one-copy` | JP-PK: one parent's second-lowest passes | **Disagrees** (C3) |
| Fixed passes | `FIXED_INHERITANCE` (Chrom, Aversa, Walhart), `CHROM_CHILD_PASSES` | §3.3 | **Agrees** |
| `morgan-second-gen-start-class` | `partner-start-class` | JP-112 table (Nah, Yarne, Lucina); FEW | **Agrees**. Can cite JP-112 |
| `child-after-parent-death` | `true`; skill frozen at death | JP-112 (re-read) | **Agrees** |
| Start classes | `CHILD_UNITS[*].defaultClassSet[0]` (`src/game-data/children.ts`) | §1 | **Agrees** for the twelve fixed ones |
| Child join stats | Not modelled. `JOIN_DATA` covers first-gen units and Robin only. `CLASS_BASES` exists | The formula in §4.1 plus the table in §4.4 | **Gap in the app.** All the inputs are now sourced |
| Chrom's fallback wife | `CHROM_FALLBACK_PARTNER` comment (`src/game-data/supports.ts`) and `units.ts`: the Maiden "if he has no S-support by the end of Chapter 11" | The highest-support candidate first; the Maiden only if none (§3.3) | **Disagrees** (C7) |
| Second Seals | `SEAL_RULES.secondSeal`: the Mila Tree armory after Chapter 16 only (`src/game-data/chapters.ts`) | The app's own chapter data puts Second Seals in the P6, P10 and P16 armories too (`paralogues.ts`, from FEW; SF shops agreed 49/49 in `research/chapter-data`). JP-FAQ: 「チェンジプルフは16章ないし外伝6,10,16クリアで購入できる」 (buyable after Ch 16, **or** after P6, P10 or P16) | **Disagrees** (C8). This matters for roadmap seal milestones: marrying Olivia, Cordelia or Nowi early opens Second Seals before Chapter 16 |
| Earlier research | `research/skill-inheritance` R5: "For Lucina, it happens at the end of Chapter 13" | Start of Chapter 13 (§2) | **Disagrees** (C1) |

## 6. Disagreements

IDs are this file's own. They don't continue `research/chapter-data`'s C1–C14, which the app already uses in `CHAPTER_DISAGREEMENTS`, so renumber or prefix them if they're ever imported.

| ID | Item | One side | Other side | Resolution |
|---|---|---|---|---|
| C1 | When Lucina's inheritance is read | FEW-inh: "For Lucina, this occurs at the **end** of Chapter 13" (and the repo's `research/skill-inheritance` R5) | FEW-LucS: "at the **beginning** of Chapter 13" (for each mother); JP-112: set it 「13章開始前」 (before Chapter 13 starts); JP-FAQ 「13章までに」 (by Ch 13); SF-children's general rule (on entering the recruiting mission, which is Chapter 13 for Lucina) | **Start of Chapter 13**, by majority and by the general rule. A safe plan holds the skill from the start of Chapter 13 to its end. The stats timing for Lucina isn't stated separately (G4) |
| C2 | Which equipped skill passes | FEW-inh: "most recently activated" | FEW infobox notes and FEW-LucS: lowest or last eligible in the equipped list; JP-112, JP-89, JP-PK: bottom (JP-PK with a player test); SF: "last active" | **Bottom slot.** The two readings pick the same skill, because re-equipping puts a skill at the bottom (§3.1) |
| C3 | Both parents would pass the same skill | App `inherit-same-skill` default `one-copy` (no source) | JP-PK: one parent's second-lowest skill passes, parent priority unknown, with a Kjelle player report | **JP-PK.** Flip the default to `next-skill` and keep "which parent" open (G5). Single source, medium confidence |
| C4 | Child base-stat formula as written | SF-bases (verified in §4.1) | FEW-inh calculations table: "(Father's personal stats + Mother's personal stats + Child's personal stats) / 3", which leaves out "+ child's class base", and its prose says "how much the child's parents have grown from their base stats". JP-106 page text: 「同じ性別側(息子なら父親、娘なら母親)の能力に強く影響される」 (strongly influenced by the same-gender parent), contradicted by a comment on the same page (+6 to a parent → +2) | **SF.** FEW's table is a loose restatement (its `/Stats` pages use the SF formula). JP-106's claim fits neither the formula nor the observation |
| C5 | FEW's computed Lucina + Sully minimum Skl | FEW-LucS: 11 | The SF formula with floor: 10 (Chrom 8−5=3, Sully 8−5=3, Lucina 8 → ⌊14/3⌋ + 6 = 10). FEW's own Maiden and Robin minimums use floor | FEW arithmetic slip. Don't use FEW's `/Stats` ranges as test data (as `research/stat-inheritance` already found for their growths) |
| C6 | P7 (Brady) map access | SF-gaiden: "Requires access to Chapter 16", or "Paralogue 6 and/or 12" | FEW-P7: clear Ch 15, or clear Ch 14 and unlock P6, or unlock P12 and P6. JP-P7: reachable from P6 and from Ch 16's location | **FEW.** P12 alone doesn't reach P7; the road runs through P6 |
| C7 | Chrom's marriage when there is no S-support by the end of Chapter 11 | App: the Maiden | FEW-inh, JP-112, JP-89: the candidate with his highest support; the Maiden only if none has any | **Sources.** Correct the comment. Any model of Chrom's marriage milestone should use "highest support at the end of Ch 11" |
| C8 | Where Second Seals are sold | App `SEAL_RULES`: Mila Tree after Chapter 16 | App chapter data (FEW) and JP-FAQ: also the P6, P10 and P16 armories | **Sources.** Add the three paralogue armories |
| C9 | What gates a child paralogue in the Run view | App: Chapter 13 cleared (marriage only as a note) | FEW, SF, JP: Chapter 13 cleared **and** the fixed parent married **and** (for P5, P6, P7, P9, P11) map access | **Sources.** The roadmap needs all three as conditions |

## 7. Gaps

- **G1 Rounding when the sum inside is negative.** The guidebook form, as Remnant Sage relays it, is `child base + ((father's personal − child base) + (mother's personal − child base)) / 3`, "drop any fractions". It is equal to SF's form with floor, except when the parents' combined personal stat is less than twice the child's absolute base. Then truncation toward zero gives 1 more than floor. That can only happen for very early recruits with a high absolute base (Cynthia Lck 17, Yarne HP 16, Lucina Lck 13). No observation settles it. Default to floor (SF's form) and treat ±1 in those stats as noise.
- **G2 Clamping at the child's caps.** FEW assumes it; it is untested.
- **G3 Which "current" stats.** Stat boosters count (T3). Whether temporary bonuses (Tonics, Rallies, pair-up, displayed skill bonuses like Str +2) count isn't stated. Assume stored stats only.
- **G4 When Lucina's stats are read.** The one observed Lucina used her parents' stats "right after Ch. 13". That fits either the start or the end of Chapter 13 only if neither parent levelled during it, which isn't stated.
- **G5 Same-skill tie: which parent yields.** Unknown (JP-PK).
- **G6 Changes made in the preparations screen after entering.** JP-112 only says that backing out to the world map and re-entering works.
- **G7 After the Endgame.** No source read says whether unplayed paralogues stay open once the game is cleared. This doesn't matter for an endpoint at or before the Endgame.
- **G8 Difficulty.** No source gives a difficulty term for child bases, and none reports testing one on Hard or Lunatic.
- **G9 Morgan's start class with a partner who starts promoted** (Frederick, Say'ri, Anna, Flavia and others): FEW says "original base class" and JP-27 says "the lower class", but neither lists each case. Out of scope here.

## 8. Sources

| Tag | Source | Trust | Used for |
|---|---|---|---|
| SF-gaiden | Serenes Forest, Gaiden Chapters: https://serenesforest.net/awakening/miscellaneous/gaiden-chapters/ (credits h_yusaku, Othin; footnote hover text read from the HTML) | High | Unlock conditions and map access |
| SF-children | SF, Children: https://serenesforest.net/awakening/characters/children/ (credits h_yusaku, FEA 2ch strategy wiki) | High | Last active skill; read on entering the mission; Chrom's exceptions; Morgan's class |
| SF-bases | SF, Base stats (main story), "Children Characters": https://serenesforest.net/awakening/characters/base-stats/main-story/ (credits MiruPage, FEA 2ch strategy wiki, Othin, Remnant Sage) | High | Formula; absolute bases; Lv 10; starting skills |
| SF-rec | SF, Recruitment (main story): https://serenesforest.net/awakening/characters/recruitment/main-story/ | High | Recruit methods |
| SF-classbase | SF, Class base stats: https://serenesforest.net/awakening/classes/base-stats/ | High | The §4.1 example |
| SFF-33434 | SF Forums, "Calculating children's base stats", Remnant Sage (2012-06-20/21), from the Japanese guidebooks, with an in-game Lucina: https://forums.serenesforest.net/topic/33434-calculating-childrens-base-stats/ (read in a browser; scripts get a Cloudflare 403) | High (guidebook plus observation) | Formula origin, floor, worked example |
| FEW-inh | FEW, Inheritance, oldid 752340: https://fireemblemwiki.org/w/index.php?oldid=752340 | High | Rules; C1, C2, C4 |
| FEW-para | FEW, Paralogue, oldid 737240 | High | Window |
| FEW-13 | FEW, Of Sacred Blood, oldid 742107 | High | Chapter 13 unlocks; strategy notes |
| FEW-P5…P16 | FEW paralogue pages, oldids 742102, 742030, 769016, 742211, 742121, 742184, 769229, 741938, 741913, 741822, 741793, 742094 (the same revisions as the app's chapter data) | High | Unlock, reach, recruit |
| FEW-Luc, FEW-LucS, FEW-OwS, FEW-Mor | FEW Lucina (773085), Lucina/Stats (746071), Owain/Stats (746068), Morgan (765114) | High (the `/Stats` ranges are editor-computed: C5) | Bottom-skill notes, Ch 13 timing, formula restated, Morgan class |
| FEW child pages | Owain 735972, Inigo 765628, Brady 765034, Kjelle 765040, Cynthia 735954, Severa 765664, Gerome 765800, Yarne 765020, Laurent 765826, Noire 735814, Nah 765030 | High | Absolute bases, level, class |
| FEW-skills | FEW, Skills, oldid 771707 ("freely swap around, apply or remove skills in the menu when outside of battle") | High | Equipping is free |
| FEW-reclass | FEW, Reclass, oldid 766323 | High | Stats move by the class-base difference on a reclass |
| JP-112 | FE覚醒 2chまとめ&攻略wiki, 子供ユニット: https://w.atwiki.jp/fireemblem3ds/pages/112.html | High (SF's upstream) | Entry timing, bottom skill, exclusions, Lucina, Chrom's marriage, Morgan class table |
| JP-89 | Mirror wiki, 子供ユニット: https://w.atwiki.jp/kakuseife/pages/89.html | High | Duplicate skill is wasted; 3–4 starting skills |
| JP-FAQ, JP-27, JP-42, JP-106 | Same wiki: よくある質問 (p.19), 仲間にする方法 (p.27), 13章 (p.42), キャラ初期値 (p.106, comments) | High / comments low | Deadline for Chrom's wife; Second Seals; Olivia C; booster observation |
| JP-P5, JP-P7, JP-P9, JP-P11, JP-P12 | Same wiki, paralogue pages 144, 84, 145, 147, 138 | High | Map access (C6) |
| JP-PK | 天馬騎士団 FE覚醒 wiki, ユニット/絆・結婚システム/子供: https://www.pegasusknight.com/wiki/fe13/ユニット/絆・結婚システム/子供 | Medium-high (JP community, with player tests in comments) | Bottom skill (tested), same-skill rule (C3), exclusions, not read when the paralogue appears |
| Repo | `research/skill-inheritance` (#4), `research/stat-inheritance` (#2), `research/death-after-marriage` (#17), `research/chapter-data` (#90) | — | Earlier rules this builds on |

Not used: GameFAQs and Neoseeker guides (403 to scripts, and secondary), and TheGamer (secondary).

## 9. Method

Researched 2026-09-25. FEW wikitext was fetched through the MediaWiki API, recording each `revid`. SF pages were fetched as HTML. The JP atwiki and Pegasus Knight wiki pages were fetched over HTTP with a browser user agent. The SF forum thread was read in a browser. A script compared the thirteen children's absolute bases across SF, FEW and the guidebook table (104 values, 0 differences). The formula was checked by hand against the forum's in-game Lucina (8/8 stats) and against FEW's computed minimums (Maiden, Robin (HP Flaw) and Sully: 2 of 3 consistent, see C5). The scripts are throwaway and aren't committed.
