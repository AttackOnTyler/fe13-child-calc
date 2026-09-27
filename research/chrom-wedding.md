# Who does Chrom marry at the end of Chapter 11?

Extends `research/child-recruitment` §3.3 / C7 and `research/support-growth` §4.1 (and #154, #188). Researched 2026-09-27 against `main` at `bfe70ee`.

This is a findings file, not a data file. It pins down the exact rule the game uses to marry an unmarried Chrom when Chapter 11 is cleared, including the Olivia special case, and says what the planner should model. The sources are Serenes Forest (SF) Support Basics, **the two SF forum threads where SF's rule was worked out by controlled in-game tests (May 2013)**, Fire Emblem Wiki (FEW), the Japanese 2ch strategy wiki (JP), the 天馬騎士団 wiki (PK) and GameFAQs. No event-script dump or datamine of the Chapter 11 end event was found (G1), so the rule rests on the SF testers' results, which fit every other observation below.

## Summary

**Chrom does not need an S with anyone.** If he has no S partner when Chapter 11 is cleared, the game marries him to a candidate by comparing his supports with them, and the marriage is a real S. For Olivia, S is impossible anyway: she joins at the start of Chapter 11, S needs 18 points and one viewed conversation per rank, and conversations are only viewed on the world map. So an "S by the end of Ch 11" milestone for Chrom × Olivia is always a non-starter, and it's the wrong milestone for every candidate.

**The rule** (SF Support Basics, from VincentASM's and shadowofchaos's tests; points are whole points after the end-of-map rounding, "rank" means a **viewed** support conversation):

1. Chrom already has an S (viewed before Chapter 11 starts): that marriage stands, no forced wedding.
2. Candidates: Sumia, Sully, Maribelle, Olivia, and Robin if female. Any candidate married to someone else is out. A candidate needs **at least 1 point** with Chrom to count.
3. No candidate left: **the Maiden**.
4. **Olivia's special case:** if Olivia has **at least 2 points** with Chrom, and no other candidate has a **viewed C or higher**, Chrom marries **Olivia**, even if others have more points or are sitting on an unviewed C.
5. Otherwise the candidate with the **highest viewed rank** (A > B > C > none) wins.
6. Tied on rank: the **fewest points still needed for the next rank** wins. An unviewed ("pending") rank counts as 0 points to go.
7. Still tied: **Sumia > Sully > Maribelle > Robin (F) > Olivia**.

So raw points below C can win (1 point is enough when nobody else has any), an unviewed C is only a tie-breaker, and a viewed C beats any number of points below it. The winner's support with Chrom goes straight to S. Sumia, Sully, Maribelle and Robin get a proposal scene. Olivia's S conversation is inserted after Chapter 11 instead. The skipped conversations can be read later in the support log.

| Question | Answer | Confidence |
|---|---|---|
| Does Chrom need an S? | **No.** The Ch 11 rule marries him and grants the S | High (every source) |
| Ranks or points? | **Both.** Viewed rank first, then points to the next rank, then a fixed order | High (SF + controlled tests) |
| Can raw points below C win? | **Yes.** 1 point wins if nobody else has any; ties are settled by points to go | High (several tests) |
| Olivia's threshold | **1 point** to be a candidate at all (like everyone). **2 points** to jump to the top of the order, beating everyone without a viewed C | High for 2 (SF page + the discovery post, with a reproducible test); high for 1 (two testers) |
| Does an unviewed ("pending") C count as C? | **No.** It is rank "none" with 0 points to go. It still loses to Olivia at 2+ | High (two testers, one GameFAQs reply) |
| Tie order | Points to next rank, then Sumia > Sully > Maribelle > Robin (F) > Olivia | High (tested); the JP order is labelled "probably" |
| The Maiden | Every candidate at 0 points (after rounding) or married to someone else | High |
| Candidate dead (Classic) | **Probably still marries Chrom** (JP-112, PK). FEW says dead candidates are skipped, uncited | Medium (C4) |
| S granted? | Yes, support jumps to S (JP-112) | High |
| When checked | Right after Chapter 11 is cleared, with Chapter 11's own points counted (rounded). There is no world-map stop in between | High |

## 1. The thresholds that matter

Totals in whole points, from the SF Support Basics table for Chrom (VincentASM's forum table in ninths ÷ 9 gives the same values). These match the per-pair curves in `research/support-growth` §2.

| Candidate | Curve | C | B | A | S | Tie order |
|---|---|---|---|---|---|---|
| Sumia | Fast | 2 | 6 | 10 | 14 | 1st |
| Sully | Medium | 3 | 7 | 11 | 16 | 2nd |
| Maribelle | Medium | 3 | 7 | 11 | 16 | 3rd |
| Robin (F) | Slow | 4 | 8 | 13 | 18 | 4th |
| Olivia | Slow | 4 | 8 | 13 | (18, unreachable) | Last, but first at ≥ 2 points unless someone has a viewed C |

| Threshold | Value | What it does |
|---|---|---|
| Minimum to be a candidate | **1 point** after rounding (at least 5/9 raw) | Below it the candidate doesn't count. None counting → the Maiden |
| Olivia's jump | **2 points** after rounding (at least 14/9 raw; half her C) | She beats every candidate that has no viewed C |
| Rank comparison | Viewed C, B, A | A viewed rank beats any unviewed points |
| Tie-break | Points to the next threshold (a pending rank = 0) | Fewer wins |

**What Olivia can reach in Chapter 11.** Each combat with her as Chrom's Support Unit is 6/9, other adjacent actions (her dance, a staff, an adjacent fight, a Dual Guard) 2/9. The map total is rounded to the nearest point and capped at 3; each Seed of Trust used while paired adds +1 outside the cap (`research/support-growth` §1, §3). So:

- 1 paired combat = 6/9 → **1 point**: she marries Chrom only if every other candidate has 0.
- 2 paired combats = 12/9 → 1 point. **2 paired combats + 1 dance or adjacent fight = 14/9 → 2 points**. 3 paired combats = 18/9 → 2 points. 1 paired combat + 1 Seed → 2 points.
- 4+ paired combats → 3 points (the cap). A Seed on top → 4 = her C threshold, but that C is pending and can't be viewed before the check. Her C rank is impossible, and so is S.

The JP tip is dancing for Chrom for many turns. That works through the dance's 2/9 each, but the per-map cap stops it at 3 points, so extra turns are wasted (VincentASM, p. 4).

## 2. Evidence

### 2.1 Serenes Forest Support Basics

The "Chrom's Forced Marriage" section [SF-basics] states:

- The general rule: the candidate with "the highest support level with (A > B > C > none)".
- Special Case 1: Olivia with "at least 2 points with Olivia (after rounding" and no C with another candidate.
- Special Case 2: under 1 point with every candidate, or all married, gives the Maiden.
- Equal levels: "the least support points required for the next support level".
- Equal points: "Sumia > Sully > Maribelle > Avatar > Olivia".

The page carries the threshold table in §1 and shows "–" for Olivia's S.

### 2.2 Where SF's rule comes from: the 2013 forum tests

**[SFF-39984]** "Chrom Chapter 11/12 Marriage Priority Discussion Thread" (shadowofchaos, 9 May 2013, 5 pages). Players disarmed the Chapter 11 mages and counted exact combats, dances and Seeds before clearing, then checked who married Chrom. The results that settle the rule:

- **Unviewed C doesn't count as C.** Every candidate was brought to a pending C (Seeds greyed out, conversation not viewed). Then "All has capped: Olivia married"; everyone but Olivia capped, Sumia married; without Olivia and Sumia, Sully; then Maribelle; Robin last (shadowofchaos, p. 1). Sunwoo reproduced the same order on another file (p. 2).
- **1 point is enough when alone.** VincentASM, from 0 points everywhere: "Chrom defeating an enemy paired with Sully or Olivia" marries that one. One Olivia dance (2/9 → 0) gives the Maiden (p. 2). Each candidate needs a paired fight or 3 adjacent actions to marry (p. 3). shadowofchaos: "Attacked with Olivia. Olivia married." (p. 1)
- **Olivia's jump is 2 points.** VincentASM (14 May 2013, p. 4), with every other girl "ready to Talk": Olivia with 2 paired fights lost to Sumia, and 1 more adjacent fight made Olivia win. He added that any girl with a viewed C blocks Olivia. His scale was 3 per paired fight, so his "7" is 14/9, which rounds to 2.
- **Olivia is last otherwise.** Each girl with exactly 1 paired fight gives "Sumia > Sully > Maribelle > Female Avatar > Olivia" (p. 3).
- **Casual mode:** points a unit gained in the chapter are lost if it retreats (p. 4).

**[SFF-40418]** "Chrom's marriage priority + notes on supports" (VincentASM, 26 May 2013) is the write-up SF's page condenses:

- Points are in ninths, rounded to the nearest 9 at the end of the map; that is SF's "after rounding".
- Olivia "trumps all the other girls even if they have gained more points than her", until someone ranks up to C. That holds only once she has half her C requirement (18/36 ninths = 2 points); otherwise "she's the lowest on the list".
- The game compares "the difference from the cap". For example, Sumia at 18 ninths (her pending C) leads Robin by 18.
- A girl qualifies with "5 or more support points from base" (5/9 rounds up to 1 point).

VincentASM is Serenes Forest's owner (the site footer credits "Aveyn Knight/VincentASM"), so the page and the thread are one line of evidence. It is a strong one: controlled, reproducible, and consistent across many cases.

### 2.3 Other sources

| Tag | What it says | Fits the rule? |
|---|---|---|
| FEW-inh (Inheritance, oldid 752340) | Chrom "automatically marries whoever he has the highest support level with at the end of Chapter 11"; the Maiden if "not gained enough support points" or all are married | Yes (no Olivia detail) |
| FEW-Chrom (oldid 772811) | "highest-ranked female support who is not dead, married to someone else, or Lissa" | Partly: see C4 on "dead" |
| FEW-Maiden (oldid 660417) | The Maiden needs no support points with any wife, or all dead or married | Partly (C4) |
| FEW-Olivia (oldid 736476) | Marrying her to Chrom means keeping Chrom away from the others and maximising Ch 11 time with her. The Ch 12 flashback is their S script in JP | Yes |
| JP-112 (2ch wiki 子供ユニット, Wayback 20250802073252) | No S at the start of Ch 11 → at the end of Ch 11, the candidate with the highest support level; all at 0 → the Maiden; 「クラシックモードでロストしていても結婚対象に選ばれる」 (chosen even if lost in Classic); 「支援レベルがSまで一気に上昇する」 (support jumps to S). For Olivia: keep the others' level at 0 and build bond in Ch 11; a Seed is worth using here | Yes, but its Olivia advice is over-cautious (C2) |
| JP-27 (2ch wiki 仲間にする方法, Wayback 20250908034107) | Same rule; ties 「おそらく」 (probably) Sumia > Maribelle > Sully > Olivia > Robin; 「オリヴィエとクロムの支援ＬｖがＣに達していない場合、結婚候補にはならない」 (Olivia isn't a candidate below C) | No (C1, C2) |
| JP-19 (2ch wiki FAQ, Wayback 20250708222408) | Chrom marries the highest-support character 「12章突入時点で」 (on entering Ch 12); only Chrom must be decided 「11章までに」 (by Ch 11) | Yes. "Entering Ch 12" is the same moment: the wedding plays straight after the Ch 11 clear |
| PK (天馬騎士団, ユニット/絆・結婚システム/子供) | The mother is decided by 絆 (bond) at the end of Ch 11, else the Maiden; Olivia needs bond 「おそらく支援Cが発生する程度」 (probably about a C); in Classic, losing a candidate after the support has developed is too late. Comment 2012-05-17: Olivia works without marrying the others off, if her bond is above theirs | Yes on dead candidates; the "about C" guess is superseded (C2) |
| GameFAQs b73097527 (Vascela, 2016) | "it's OK for you to have the C-Rank support not viewed"; Olivia beats all at a tie, but a viewed C beats her | Yes |
| GameFAQs b66307977 (Lurkerkiller, 2013) | Highest rank, then points; without viewed Cs, pair Chrom with Olivia and use a Seed | Yes |
| GameFAQs qa345183 (TheRetroGoat) | "The marriage occurs immediately after Chapter 11"; another reply suggests skirmish-grinding before Ch 12 | The first is right; there is no world-map stop to grind in |
| GameFAQs qa405825 | A player with every other candidate married, 10 fights and Seeds, still got the Maiden | Unexplained (a Casual retreat, or points not with Chrom as Support Unit?). Contradicts every tested source; ignored (G4) |

## 3. Disagreements and resolutions

| ID | Item | Source A | Source B | Resolution |
|---|---|---|---|---|
| C1 | Tie order | SF-basics / SFF-39984/40418: points to next rank, then Sumia > Sully > Maribelle > Robin > Olivia (tested case by case) | JP-27: 「おそらく」 Sumia > Maribelle > Sully > Olivia > Robin (no test given); GameFAQs risen987 repeats it | **SF.** It's tested; JP labels its order a guess. VincentASM tested Sully against Maribelle directly (p. 5). The app's `chrom-wedding-tie-order` = `jp` alternative has no support and can go |
| C2 | Olivia's threshold | SF: ≥ 1 point to count, ≥ 2 points to jump the order (tests: 1 paired fight marries her when alone; 14/9 beats pending-C rivals) | JP-27: she needs a C. PK: probably about a C. JP-112: keep the others at 0 | **SF.** Olivia can't hold a viewed C before the check, so a literal "needs C" would make Chrom × Olivia impossible. JP-112 and PK themselves say it is possible. The JP lines are cautious rules of thumb. The app's `chrom-wedding-olivia` = `rank-c` alternative is refuted |
| C3 | Does an unviewed C count as "a C"? | SFF-39984 tests (all pending → Olivia; pending rivals still lose to Olivia at 14/9), GameFAQs Vascela | SF-basics' wording "obtained a C support level" is ambiguous | **Viewed only.** A pending rank is rank "none" with 0 points to go |
| C4 | A candidate dead in Classic | JP-112 main text: still chosen, 「謀殺しても無駄」 (killing her is useless); PK main text: losing her after support develops is too late | FEW-Chrom and FEW-Maiden: dead candidates are skipped (uncited); one PK comment and one GameFAQs answer say the same, untested | **JP, medium confidence.** Two JP wiki main texts state it as a warning. FEW gives no source. It agrees with how the game treats dead parents elsewhere (`research/death-after-marriage`: a lost parent still counts). Irrelevant to an Ironman run, where nobody dies |
| C5 | Support needed | The app's milestones: Chrom's wife needs S by the end of Ch 11 | Every source: the highest support, and the game grants S | **Sources.** See §5 |

Not disagreements:

- SF's "end of Chapter 11" vs JP-19's "entering Chapter 12": one moment.
- JP-112 says "no S at the **start** of Ch 11". An S can only be viewed on the world map, so that means before Ch 11 is entered.

## 4. Open gaps

- **G1 No script-level confirmation.** No decompiled Chapter 11 end event was found (searched: Exalt/Paragon, GitHub, GBAtemp). The rule rests on 2013 black-box tests. They are extensive and consistent, but details like "C vs viewed C" come from outcomes, not code.
- **G2 A viewed C held by a candidate who is now married to someone else.** Does it still block Olivia's jump? SF's wording ("his other marriage candidates") and the JP advice to marry the others off suggest married women are simply removed. Not tested explicitly. Plan as "removed".
- **G3 Ties across A/B/C with pending ranks,** e.g. viewed C plus a pending B against a viewed B. The rule gives rank first, so the viewed B wins, but the B-level cases weren't tested (VincentASM, p. 5: moving past pre-C cases was future work).
- **G4 The GameFAQs Maiden report** (qa405825) has no explanation. Possible causes: a Casual retreat wiping Chapter 11 points, or points that went to another pair (the 3/2/1 per-unit split).
- **G5 A dead candidate's points.** Whether a unit lost in Classic mid-Ch 11 keeps that map's points (Casual retreats lose them) isn't stated.

## 5. What the planner should model

1. **Replace the S milestone for Chrom's wife.** "Chrom × W reaches S by the end of Ch 11" is wrong for every W, and impossible for Olivia. The milestone is **"W wins Chrom's Chapter 11 rule"**, deadline: the end of Ch 11, with Ch 11's points counted. The window is:
   - **Sumia, Sully, Maribelle or Robin (F):** the robust target is a **viewed C (or higher) with Chrom before Ch 11 is entered**, which beats any Olivia and any rival without a viewed C. Rivals then need to stay at a lower viewed rank, or at the same rank with more points to go (or later in the order). Enough maps together: Sumia 1 map (2 points for C), Sully and Maribelle 1 map (3), Robin 2 maps (4, per-map cap 3); then one more world-map stop to view it before Ch 11. Without a viewed C, W still wins if she has ≥ 1 point and the best (points to go, order), and Olivia is below 2.
   - **Olivia:** no other free candidate has a **viewed** C (pending is fine) **and** Olivia has **≥ 2 points** at the end of Ch 11. That is 3 combats with her as Chrom's Support Unit, or 2 plus one dance or adjacent fight, or 1 plus a Seed. Or ≥ 1 point while every other free candidate has 0. Marrying the others off first also works.
   - **The Maiden:** every free candidate at 0 points after rounding (Chrom never fights with one as Support Unit, and at most 2 adjacent actions each per map), or all married elsewhere.
2. **The wife's S is automatic.** After the wedding, treat Chrom × W as S (married) from the end of Ch 11. Lucina's inheritance snapshot is still read at the start of Ch 13 (`research/child-recruitment` §2).
3. **Fix `chromWifeByPoints` (`src/engine/chrom-wedding.ts`) and the sim's `chromWedding` (`src/engine/sim/run-sim.ts`):**
   - Add Olivia's override: ≥ 2 points and no other free candidate with a **viewed** C+ → Olivia, before the rank comparison.
   - Olivia's minimum to count is **1** point, not 2 and not Infinity. She is last in the order below 2.
   - A threshold reached **during Chapter 11** is pending: rank "none" (or the previous viewed rank) with `toNext = 0`, not a rank with `toNext` measured to the next-next threshold. Today `rankOf(points, t, false)` counts any reached threshold as a rank.
   - Drop the `jp` tie order and the `rank-c` Olivia option, or keep them only as documented refuted alternatives (C1, C2). Update the `CHROM_FALLBACK_PARTNER` comment in `src/game-data/supports.ts`: its "Olivia … JP-27: she needs at least C" line is refuted.
4. **Record results (`chromWedding` ask)** already uses logged (viewed) ranks. It can pre-select Olivia when no free candidate has a logged C and the user says she fought with Chrom. Otherwise keep asking.
5. **Deaths:** keep a candidate lost in Classic eligible (C4). No Ironman plan should rely on it.

## 6. Sources

| Tag | Source | Trust |
|---|---|---|
| SF-basics | Serenes Forest, Support Basics, "Chrom's Forced Marriage": https://serenesforest.net/awakening/characters/supports/support-basics/ (read 2026-09-27) | High |
| SFF-39984 | SF Forums, "Chrom Chapter 11/12 Marriage Priority Discussion Thread", shadowofchaos et al., 9 May – 6 Aug 2013, pages 1–5: https://forums.serenesforest.net/topic/39984-chrom-chapter-1112-marriage-priority-discussion-thread/ | High (controlled in-game tests, JP and NA copies) |
| SFF-40418 | SF Forums, "Chrom's marriage priority + notes on supports", VincentASM, 26 May 2013: https://forums.serenesforest.net/topic/40418-chroms-marriage-priority-notes-on-supports/ | High (the write-up behind SF-basics) |
| FEW-inh | Fire Emblem Wiki, Inheritance, https://fireemblemwiki.org/w/index.php?oldid=752340 | High (no Olivia detail) |
| FEW-Chrom | FEW, Chrom, https://fireemblemwiki.org/w/index.php?oldid=772811 | Medium on this point (uncited "not dead") |
| FEW-Maiden | FEW, Maiden, https://fireemblemwiki.org/w/index.php?oldid=660417 | Medium |
| FEW-Olivia | FEW, Olivia, https://fireemblemwiki.org/w/index.php?oldid=736476 | High |
| JP-112 | FE覚醒 2chまとめ&攻略wiki, 子供ユニット: https://w.atwiki.jp/fireemblem3ds/pages/112.html (Wayback 20250802073252; live site behind Cloudflare) | High (SF's credited upstream) |
| JP-27 | Same wiki, 仲間にする方法: https://w.atwiki.jp/fireemblem3ds/pages/27.html (Wayback 20250908034107) | High in general; its tie order and Olivia note are hedged or refuted |
| JP-19 | Same wiki, よくある質問: https://w.atwiki.jp/fireemblem3ds/pages/19.html (Wayback 20250708222408) | High |
| PK | 天馬騎士団 FE13 wiki, ユニット/絆・結婚システム/子供: https://www.pegasusknight.com/wiki/fe13/ユニット/絆・結婚システム/子供 (main text and comments 2012–2013) | Medium-high (main text), low (comments) |
| GFAQ | GameFAQs FE Awakening board 73097527 (Vascela) and 66307977 (Lurkerkiller); Q&A 345183, 405825, 388514, 446876 | Low-medium (anecdotal; used only as corroboration) |
| Repo | `research/support-growth` (curves, per-map cap, rounding, Seeds), `research/child-recruitment` (§3.3, C7), `research/death-after-marriage` | — |
