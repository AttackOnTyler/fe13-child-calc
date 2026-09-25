# How fast do supports grow?

Resolves #139 (part of #136, Map: Endpoint-first planning). Researched 2026-09-25 against `origin/main` at `6b22510`.

This is a findings file, not a data file. It covers how support points build up in *Awakening*, what each pair needs for C, B, A and S, the limits per map, what carries over, and the order in which ranks open. The goal is rules precise enough to model how many maps a marriage takes. Serenes Forest (SF) is the only site that publishes point values. Fire Emblem Wiki (FEW) copies SF's rules and cites it, so it isn't an independent check. The independent checks are game-data tooling (Paragon's FE13 schema and the Fire Editor save editor), the Japanese 2ch strategy wiki that SF credits, and one player's controlled tests. §9 lists every source with the revision or snapshot that was read.

## Summary

The short answer: **supports grow per map, not per turn or per kill.** A pair gains at most **3 points per map** from fighting together, and **4 combats together is enough to max a map**. A **typical romantic pair needs 18 points for S**: 4, 8, 13 and 18 total for C, B, A and S. That makes **8 maps together for S**, or 7 maps for the 28 "fast" and "medium" pairs. Turns spent paired or adjacent earn nothing by themselves.

| Question | Answer | Confidence |
|---|---|---|
| **What earns points** | Each combat: **6/9** with the partner as the Support Unit (paired, or the best adjacent ally), **2/9** with another adjacent ally. Also 2/9 per staff or dance use on the partner, and 2/9 per Dual Strike or Dual Guard. Outside the per-map cap: **+1** per Seed of Trust used while paired, per paired event tile, and per Barracks talk | SF rules. FEW copies them. One tester's results agree (§1) |
| **Ending a turn adjacent or paired** | **Nothing.** No source lists it, and a 2012 player report found no support after about 50 turns deployed together without fighting side by side | High |
| **Per-map limits** | Map totals are rounded to the nearest point, then capped at **3 per pair**. For each unit, only its top three pairs of the map gain anything: **3 / 2 / 1**, the rest 0 | SF rules. One player's tests agree (§3) |
| **Thresholds** | Four curves, set per pair in the game data: **Slow** 4/8/13/18 (194 of 222 romantic pairs, including every Robin romance), **Medium** 3/7/11/16 (11), **Fast** 2/6/10/14 (17), **Non-romantic** 3/8/15, A max (94 pairs) | SF, Paragon and Fire Editor agree pair by pair (§2) |
| **Differs by pair?** | Yes, by the four types. Each first-gen woman has exactly one fast husband. All but Sumia also have one medium husband (Sully has two). Each child has at most one fast partner, and no child pair is medium. Robin's romances are all slow | Same |
| **Carry-over** | Points persist between maps as whole numbers. Every battle counts: story, paralogue, skirmish and DLC. In Casual Mode, a unit that falls loses the map's points for all its pairs | SF + tests + 2ch wiki (§3) |
| **Rank order** | A rank rises only when its conversation is **viewed outside battle** (world map). S is one per unit, to an opposite-gender, non-family partner. Chrom is married off at the end of Ch 11 | SF, FEW, JP wikis (§4) |
| **Points past an unviewed threshold** | **Probably lost:** the points stop at the threshold until the conversation is seen. So a pair gains **at most one rank per map**, even with Seeds | Inferred from four sources, none of which states it outright (§4.2) |

For the roadmap (#136): model a marriage as **N maps in which both parents deploy together and are each other's top pair**. N is 8 for a slow pair and 7 for a fast or medium one, when they fight together at least 4 times on the first map of each rank. The second map of each rank needs only 1–3 combats (§5). Skirmishes and paralogues count as maps. They are how a late-recruited couple catches up.

## 1. How points accrue

### 1.1 Point sources

SF Support Basics lists these for compatible pairs. FEW Support (oldid 757358, `===''Awakening''===`) repeats the table and cites SF for it.

| Action | Points to the pair | Per-map cap? | Notes |
|---|---|---|---|
| Fight an enemy with the partner as the **Support Unit** | **+6/9** | Yes | The Support Unit is the partner in Pair Up. When unpaired, it is the adjacent ally with the highest support level (SF Dual System) |
| Fight an enemy while adjacent to an ally that isn't the Support Unit | +2/9 per such ally | Yes | Each adjacent partner's pair gets it |
| Use a staff on, or dance for, the partner | +2/9 | Yes | A healer or Olivia builds support without fighting |
| A Dual Strike or Dual Guard activates | +2/9 | Yes | Random. Rates rise with support rank (SF Dual System) |
| Stop on an event tile while paired (random outcome) | +1 | **No** | FEW Event tile: "works exactly the same as" the Barracks talk (see C1) |
| A two-person Barracks talk between the pair (random, real time) | +1 | No (outside battle) | A new event comes every 2 hours of real time, up to 5 queued (SF Barracks; FEW Barracks). See C1 |
| Use a **Seed of Trust** while paired | +1 | **No** | No armory sells it. It comes from Summer Scramble and Hot-Spring Scramble drops (3 each), the 210 Renown reward, Double Duel, and random event tile and Barracks finds (SF Item Locations; FEW Seed of Trust, oldid 760274). See C7 |

Details that matter for a model:

- **Enemy phase counts.** A tester on GameFAQs (Cerby_3BR, "Support points weirdness") found that enemy-phase fights on a paired unit gave the same 6/9 as attacking. Three such fights took Tiki and Lucina's C from "2 points needed" to ready: 18/9 rounds to 2.
- **No passive gain.** SF's table has no entry for ending a turn adjacent or paired. A 2012 comment on the 天馬騎士団 (Pegasus Knight) wiki's bond-system page reports no support after about 50 turns deployed together without fighting side by side. FE WoD's summary also counts only fighting, healing, dancing, Dual activations, seeds, and tile and Barracks talks.
- **The 2ch wiki FAQ** (SF's credited upstream, §9) adds that Seeds, tile talks and Barracks talks are the only ways around steady fighting.

### 1.2 From a map's fights to points

Per pair per map: `raw = (6·F + 2·(A + H + D)) / 9`. F is combats with the partner as Support Unit, A is combats with the partner adjacent but not the Support Unit, H is staff or dance uses between them, and D is Dual Strike or Guard activations.

At the end of the map (SF Support Basics):
1. **Round** raw to the nearest integer. A total in ninths can never land on x.5, so no tie rule is needed.
2. **Cap each pair at 3.**
3. **Rank each unit's pairs** by points gained this map. Its top pair keeps up to 3, its second up to 2, its third up to 1, and the rest get 0. Ties go to the partner higher in the in-game support list. Seeds and event tiles are outside steps 2–3. SF: "you can gain up to 4 points with one Seed of Trust used".
4. **Casual Mode:** if either unit fell, the pair loses everything it gained this map.

What F alone gives (no Dual activations, no other adjacent allies):

| Combats together | 1 | 2 | 3 | 4+ |
|---|---|---|---|---|
| Raw | 0.67 | 1.33 | 2.00 | 2.67+ |
| Points | **1** | **1** | **2** | **3** (cap) |

Two combats plus one Dual activation is 14/9, which rounds to 2. Three combats plus three activations is 24/9, which rounds to 3.

## 2. Thresholds per rank and per pair

### 2.1 The four curves

SF Support Growth gives the **total** points needed for each rank:

| Type (Paragon's name) | C | B | A | S | Gaps (C, B, A, S) | Pairs (undirected) |
|---|---|---|---|---|---|---|
| **Fast** | 2 | 6 | 10 | 14 | 2, 4, 4, 4 | 17 |
| **Medium** | 3 | 7 | 11 | 16 | 3, 4, 4, 5 | 11 |
| **Slow** | 4 | 8 | 13 | 18 | 4, 4, 5, 5 | 194 |
| **Non-romantic** | 3 | 8 | 15 | — | 3, 5, 7 | 94 |

- **The type is game data.** Paragon's FE13 schema gives each character a list of `support_character_NNN` / `support_type_NNN` fields (`Data/FE13/Types/Person.yml`). The type enum's four values are named **Non-romantic, Slow, Medium, Fast** (`Data/FE13/UI/Enums/SupportType.yml`). The thresholds themselves aren't in that schema. They are presumably in code, and SF and Fire Editor are where they're published.
- **Cross-check (§8).** Fire Editor's `units.xml` lists each unit's partners with a type 0–3. The editor credits Paragon for its internal resources. Its `UnitDb.supportValues()` gives the stored value for each rank state (§4.2). All 632 directed entries (316 pairs) have the same curve as SF's table. SF, Fire Editor and FEW's romantic list agree on the same **222 romantic pairs**. SF adds one impossible row (C3).
- **No difficulty scaling** in SF, FEW or Fire Editor. Only the Fandom wiki claims it, uncited (C2).

### 2.2 Which pairs are fast or medium

All other romantic pairs are **slow**, including every pair with Robin, Lon'qu, Donnel, Say'ri, Basilio, Flavia, Anna, Tiki, Morgan and the SpotPass units (SF Support Growth, parsed in §8).

| First-gen woman | Fast (2/6/10/14) | Medium (3/7/11/16) |
|---|---|---|
| Lissa | Vaike | Frederick |
| Sully | Kellam | Chrom, Stahl |
| Miriel | Stahl | Kellam |
| Sumia | Chrom | — |
| Maribelle | Frederick | Chrom |
| Panne | Ricken | Libra |
| Cordelia | Libra | Gaius |
| Nowi | Gregor | Vaike |
| Tharja | Gaius | Henry |
| Olivia | Henry | Gregor |
| Cherche | Virion | Ricken |

That is 11 fast and 11 medium first-gen pairs. Six child pairs are fast: Lucina–Laurent, Owain–Kjelle, Inigo–Cynthia, Brady–Severa, Gerome–Nah and Yarne–Noire. No child pair is medium.

**Parent–child and sibling supports** are not in SF's growth tables. Two Japanese wikis (ptnwiki 支援レベル; the Fandom page says the same) state that recruiting a child **opens the C conversation with its parents immediately**. Fire Editor has a separate "Parent/Sibling" type whose C threshold is 0, which agrees. Its B and A values are single-source (gap G4). None of this affects marriage timing.

## 3. Limits and carry-over

- **Per map:** 3 per pair, and 3/2/1 per unit across its partners, from fighting, healing, dancing and Dual activations (SF). A unit can therefore push at most one partnership at full speed each map. Deploying a parent paired with someone else for their combat role can take the 3 slot away from the marriage. Only the partner the unit accrued the most with gets it.
- **Per turn:** no cap in any source.
- **Integers only:** points are rounded at the end of the map (SF). The save stores one byte per pair (Fire Editor `RawSupport.java`), so fractions don't carry.
- **Every battle counts:**
  - Cerby_3BR's tests were all run in **skirmishes**.
  - The 2ch wiki FAQ's support-grinding advice uses **DLC maps**. One run of the DLC map 王対王決定戦 with 50 paired kills didn't raise the rank, but two runs of マミーの楽園 did. The FAQ concludes that points per stage clear are capped.
  - SF's Barracks page lists Barracks talks as a between-maps source.
  - Skirmishes, paralogues and DLC all raise supports just as story maps do.
- **Casual Mode:** a fallen unit's pairs lose the map's points (SF, FEW).
- **Can't support:** SpotPass/DLC legacy characters and guest Avatars (SF FAQ, SF Support List). The SpotPass paralogue recruits (Gangrel, Walhart, Emmeryn, Yen'fay, Aversa, Priam) support only with Robin (SF Support List; already in `ROBIN_SUPPORTS`).

The 3/2/1 rule has one open case: how the slots resolve when three pairs interlock (A–B, A–C, B–C all near 3). Its tester flagged this, and it is untested (gap G2).

## 4. Rank ordering rules

### 4.1 What the sources state

- **Viewing raises the rank.** Once enough points are earned, "a support conversation between the two characters can be viewed outside of battle, which increases the support relationship by one level" (SF Support Basics). ptnwiki names the place: the world map menu's support option. Ranks go none → C → B → A → S, one at a time.
- **S rules.**
  - Any number of A supports, but only one S, with an opposite-gender character who isn't a sibling or child (SF Support Basics).
  - Once married, every other partner caps at A (ptnwiki).
  - Chrom can't marry Lissa. Sumia's list is restricted, and Lucina's and Morgan's siblings lose S with them (FEW List of supports, oldid 747916). The first-gen and Robin parts are already in `supports.ts`.
- **Unviewed S conversations stack.** The 2ch wiki FAQ says S "flags" can stand ready with several partners as long as none is viewed. Only the one viewed marries.
- **Chrom's forced marriage** (SF Support Basics; FEW Inheritance, oldid 752340):
  - At the end of Chapter 11 an unmarried Chrom marries the candidate (not Lissa) he shares the highest rank with (A > B > C > none), and gets an S (SF Support Growth note).
  - Special case: Olivia if he has at least 2 points with her and no C with anyone else.
  - Fallback: the Maiden if he has under 1 point with every candidate, or all of them are married.
  - Ties go to the fewest points still needed for the next rank, then the order Sumia > Sully > Maribelle > Robin > Olivia.
  - So Chrom's wife only needs **the highest rank by end of Ch 11**, not S.
- **Child paralogues:** children become recruitable once Lucina joins (Ch 13). No chapter sets a deadline for the parents' marriage (FEW Inheritance). The app already has these opening rules (`run.ts`).

### 4.2 Do points keep building past a threshold that hasn't been viewed? Probably not

No source says it in one sentence, but four independent pieces point the same way:

1. **The game's own item text.** The Seed of Trust's Japanese description (FEW Seed of Trust) says it can't be used when it would have no effect (使っても効果が無い時は使えない); in English, "when possible". A +1 can only have "no effect" if points are frozen: at a threshold whose conversation hasn't been viewed, or at max.
2. **The save format.** Fire Editor stores one byte per pair. It reads a pending rank as *exactly* the threshold and a viewed rank as the threshold **+1** (e.g. fast: C-pending 2, C 3, B-pending 7, B 8, A-pending 12, A 13, S-pending 17, S 18). A single byte can only encode "pending" that way if points can't pass the threshold before the view.
3. **Player reports.** Pegasus Knight wiki comments (2012-05-15): the cap on bond points from one map's battles is reaching the state where the next level can be raised. The same thread reports that S takes at least 4 maps, and that Seeds are needed to do it. Cerby_3BR notes that the 3/2/1 split can waste points past what a pair "actually needs to reach the next level".
4. **SF's own example.** "Up to 4 points with one Seed" is consistent with this, though it doesn't settle it.

**Modelling rule, labelled as inferred:** a pair's points stop at the next rank's threshold until its conversation is viewed, and conversations are viewed only outside battle. So **at most one rank per pair per map**, excess points are lost, and S takes **at least 4 maps** however many Seeds are used. §5 gives both this "clamp" model and a "bank" model where excess carries. The planner should use the clamp. It is the more pessimistic model, and it is what the evidence supports.

## 5. Worked example

**A typical (slow) romantic pair, e.g. Lon'qu × Cordelia (4/8/13/18),** clamp model. The pair deploys together, is each unit's top pair every map, and they view each conversation on the world map right after it opens. No Seeds, tiles or Casual losses.

| Map together | Combats together needed | Gained | Total | Rank |
|---|---|---|---|---|
| 1 | 4 | 3 | 3 | — |
| 2 | 1 | 1 (clamped at 4) | 4 | **C** (view) |
| 3 | 4 | 3 | 7 | C |
| 4 | 1 | 1 | 8 | **B** (view) |
| 5 | 4 | 3 | 11 | B |
| 6 | 3 (or 2 + a Dual activation) | 2 | 13 | **A** (view) |
| 7 | 4 | 3 | 16 | A |
| 8 | 3 (or 2 + a Dual activation) | 2 | 18 | **S**: married |

**8 maps and at least 24 combats together.** Four combats can be as little as two turns, with a player-phase attack and an enemy-phase fight each turn. So "turns paired" isn't the limit: maps are.

**Maps to each rank, by curve and by how many combats the pair gets together per map** (every map alike; computed in §8):

| Curve | 1–2 combats (1 pt/map) | 3 combats (2 pts/map), clamp | 4+ combats (3 pts/map), clamp | 4+ combats, bank |
|---|---|---|---|---|
| Fast (2/6/10/14) | C 2, B 6, A 10, **S 14** | C 1, B 3, A 5, **S 7** | C 1, B 3, A 5, **S 7** | C 1, B 2, A 4, **S 5** |
| Medium (3/7/11/16) | **S 16** | **S 9** | C 1, B 3, A 5, **S 7** | **S 6** |
| Slow (4/8/13/18) | **S 18** | **S 10** | C 2, B 4, A 6, **S 8** | **S 6** |
| Non-romantic (3/8/15) | **A 15** | **A 9** | C 1, B 3, **A 6** | **A 5** |

With Seeds of Trust (outside the 3 cap, still clamped), S takes at least 4 maps, one rank each. For a slow pair that means 3 fights plus 1, 1, 2 and 2 Seeds over the four maps: 6 Seeds, which are scarce.

**When the child can come:** the marriage finishes N maps after the first map on which both parents are recruited, fight together and are each other's top pair. The child's paralogue opens once that marriage exists and Ch 13 is cleared (§4.1).
- Stahl and Miriel (fast) both join on Ch 2, so they can be married by Ch 8 on story maps alone.
- Henry joins on Ch 13, so Olivia × Henry (fast) needs about 7 more maps. That is Ch 19 on story maps only, or sooner with paralogues and skirmishes in between.
- Chrom's pair has its own deadline: the highest rank by the end of Ch 11 (§4.1).

## 6. What the app already has

| Where | What | Gap for support growth |
|---|---|---|
| `src/game-data/supports.ts` | `S_SUPPORTS` (first-gen marriage graph), `ROBIN_SUPPORTS` (Robin's 23 / 24 partners), `CHROM_FALLBACK_PARTNER` (the Maiden). Sources: FEW romantic list + SF support list | **No support type or thresholds per pair.** No non-romantic (A-max) partners, no parent–child or sibling supports, no child × child romance list |
| `src/engine/run.ts` | `UnitSnapshot.supports`: partner + rank (C/B/A/S) per unit per logged map (`SUPPORT_LEVELS`); paralogue opening notes (P5–16 after Ch 13 once the parent is married; P7 Maribelle; P12 Robin) | Records **ranks, not points**, and doesn't record whether a conversation is pending. Also no record of which pairs fought together on a map |
| `src/engine/solver.ts`, `pair-up.ts`, `deploy.ts` | What a rank *does*: Dual Support bonuses by total support rank, Dual Strike rate by rank, pair-up class bonus +1 (C/B) / +2 (A/S); deploy candidates carry their supports | No growth |
| `src/game-data/chapters.ts` + `run.ts` | Map list, `unlocks`, grind maps, `other` entries for skirmishes | Skirmishes and DLC maps are logged as `other`, and they do grow supports |
| — | Chrom's end-of-Ch 11 forced marriage | Only the Maiden fallback is modelled, not the priority rules (§4.1) |

What a roadmap model needs that isn't there:
1. The support type of each pair: 316 pairs, four values. Easiest from SF Support Growth, checked against Fire Editor's `units.xml`.
2. The growth rules in §1.2, §3 and §4.2.
3. A "maps together as top pair" counter per planned marriage, fed by the run log. The stat screen shows ranks, so a logged rank can re-anchor the estimate at each entry. The app can't see points.
4. Chrom's Ch 11 rule.

## 7. Disagreements found

IDs follow the repo's research style. They are numbered for this file only.

| ID | Item | Source A | Source B | Suggested resolution |
|---|---|---|---|---|
| C1 | Points from a Barracks talk or a paired event tile | SF Support Basics: **+1** each. FEW Support (citing SF): +1. Fandom: "+9" in ninths, i.e. +1 | FEW Barracks: "boosted by a random amount". FEW Event tile: "works exactly the same as" the Barracks event | Use +1. FEW's own mechanics page cites SF for +1. Low impact: both are random and can't be planned |
| C2 | Do thresholds depend on difficulty? | Fandom Support: "Point amounts differ between each character, Support Level and difficulty level" (uncited) | SF Support Growth, FEW and Fire Editor: per pair only, with no difficulty term | Per pair only. Fandom is uncited, and the save editor's byte encoding has no difficulty input |
| C3 | Morgan (M) × Morgan (F) | SF Support Growth lists a slow romance | SF's own Support List ("*1 Except Morgan (M) x Morgan (F)"), FEW romantic list and Fire Editor all omit it | Not a pair. Only one Morgan exists per file. SF's growth row is a slip |
| C4 | Chrom × Olivia S threshold | SF Support Growth: 18 | SF Support Basics (forced-marriage table): "–" | 18 is the pair's curve. The "–" reflects that S isn't reachable in time before the Ch 11 forced marriage (Olivia joins in Ch 11). No modelling impact |
| C5 | What caps a map's gain | SF: 3 per pair, 3/2/1 per unit | Pegasus Knight comment (2012-05-15): the cap is reaching the state where the next level can be raised | **Both apply** (the lower wins). The 2ch FAQ's 50-kill DLC run failed to raise a rank, a cap below the threshold, which fits SF's 3. The threshold clamp is §4.2 |
| C6 | Who is the Support Unit when unpaired | SF Dual System: the adjacent ally with the highest **support level** | Pegasus Knight wiki: the adjacent ally with the highest **bond (絆)**, i.e. points | Unresolved, low impact. They differ only between allies of equal rank (gap G3) |
| C7 | Where Seeds of Trust come from | 2ch wiki FAQ: only picked up from sparkle tiles | SF Item Locations and FEW Seed of Trust: Summer and Hot-Spring Scramble drops (3 each), the 210 Renown reward, Double Duel, event tiles, Barracks | SF/FEW: two independent item tables agree. The FAQ line likely predates the DLC. Either way, Seeds are too scarce to plan a marriage on |

Not counted as disagreements:
- FEW writes "Pair Up or Dual Support" where SF writes "e.g. while paired up".
- Fire Editor writes `0x10` for the slow and non-romantic "B-Rank" byte where its own pattern gives 10. It's a typo in the editor's hex, and the thresholds (the pending values) all match SF.
- FE WoD's line that fighting points need the enemy damaged is contradicted only weakly by the tester's reactive fights (G1).

## 8. Method

- **SF Support Growth → JSON.** The 47 `<h4>` sections and their tables were parsed by script into 535 directed (unit, partner, curve) rows. Result: four distinct curves.
  - Symmetry: every A→B row has a B→A row with the same curve, except Morgan (M)→Morgan (F) (C3).
  - Undirected: 317 pairs, including SF's "Any male / Any female" Robin rows expanded through the partners' tables.
- **Fire Editor `units.xml` vs SF.** Types 0–3 were mapped to the curves by `UnitDb.supportValues()`: pending values minus conversations already viewed. For example, slow B-pending 9 − 1 = 8.
  - Result: 632 directed entries, 538 non-Robin and 94 Robin. **0 mismatches.** The 94 Robin entries match SF's gender rule: platonic with the same gender, slow with the other.
  - The file is symmetric, 316 pairs: 194 slow, 94 non-romantic, 17 fast, 11 medium.
- **FEW romantic list vs Fire Editor.** FEW's `SL3DSG1Cell` rows were parsed into 222 pairs. They equal Fire Editor's 222 romantic (type 1–3) pairs exactly.
- **Maps to rank.** Simulated for gains of 1, 2 and 3 points per map under both models (clamp: points stop at the next threshold; bank: excess carries). Rounding table: `round(6F/9)` capped at 3.
- **Upstream checks.**
  - SF credits "h_yusaku, FEA 2ch strategy wiki, MiruPage". The 2ch wiki (w.atwiki.jp/fireemblem3ds) now sits behind a Cloudflare challenge and was not bypassed. Its pages were read from Wayback Machine snapshots (§9).
  - No 2ch page found publishes the point values. Its FAQ gives only the per-stage cap and the S-flag stacking.
  - h_yusaku's original posts weren't found.
- **Not verifiable here:** in-game testing.

## 9. Sources

| Source | Trust | Used for |
|---|---|---|
| SF Support Basics https://serenesforest.net/awakening/characters/supports/support-basics/ (read 2026-09-25) | High. SF's credits on this page family: h_yusaku, FEA 2ch strategy wiki, MiruPage | Point sources, rounding, 3-per-map cap, 3/2/1 rule, Casual loss, Chrom's forced marriage |
| SF Support Growth https://serenesforest.net/awakening/characters/supports/support-growth/ | High | Thresholds for every pair |
| SF Support List https://serenesforest.net/awakening/characters/supports/ | High | Who can support whom; legacy characters and guest Avatars can't |
| SF Dual System https://serenesforest.net/awakening/miscellaneous/dual-system/ | High | Who the Support Unit is; Dual Strike/Guard rates by rank |
| SF Barracks https://serenesforest.net/awakening/miscellaneous/barracks/, SF FAQ https://serenesforest.net/awakening/general/faq/ | High | Barracks timing (2 h, max 5); who can't support |
| SF Item Locations: Items https://serenesforest.net/awakening/miscellaneous/item-locations/items/ | High | Seed of Trust sources (C7) |
| FEW Support, oldid 757358 | High, but its Awakening points table cites SF, so it isn't independent | Same rules, reworded |
| FEW List of supports in Fire Emblem Awakening, oldid 747916 | High | 222 romantic pairs |
| FEW Seed of Trust, oldid 760274; Barracks, oldid 737229; Event tile, oldid 737258; Inheritance, oldid 752340 | High | Seed text and sources, Barracks and tile support (C1), child timing, Chrom rule |
| Paragon (thane98/paragon) `Data/FE13/Types/Person.yml`, `Data/FE13/UI/Enums/SupportType.yml` (last change `2250cec2b9`, repo HEAD `d11d601889`) | High: a schema of the game's own data files | Support type per partner is game data, with four named values |
| Fire Editor Awakening (Dani88alv/fire-editor-awakening @ `de3b9298c9`): `data/UnitDb.java` `supportValues()`, `database/units.xml`, `savefile/units/mainblock/RawSupport.java` | Medium-high: a save editor built on Paragon's resources, independent of SF | Per-pair types (cross-check), byte encoding of pending and viewed ranks (§4.2) |
| FEA 2ch strategy wiki (ファイアーエムブレム覚醒 2chまとめ&攻略wiki), Wayback: FAQ `pages/19.html` @ 20250708222408; 支援効果 `pages/96.html` @ 20251018175213; 支援会話可能キャラ表 `pages/117.html` @ 20250517103610 | Medium: SF's credited upstream, community-edited | Per-stage cap (DLC test), stacked S flags, Seeds as the only shortcut |
| 天馬騎士団 (Pegasus Knight) FE13 wiki, ユニット/絆・結婚システム (last modified 2013-07-15), comments 2012-05-02 and 2012-05-15 | Low-medium (user comments) | No passive gain; per-map cap reaches the next level (C5); S in at least 4 maps with Seeds |
| ptnwiki 支援レベル http://ptnwiki.com/fek/shien-level.shtml | Low-medium | Conversations viewed from the world map menu; parent–child C on recruit; married → others cap at A |
| GameFAQs "Support points weirdness" (board 643003, topic 73511376), Cerby_3BR | Low-medium: one tester, but controlled (Seeds used to measure points) | Enemy phase counts; rounding; 4 combats = 3; 3/2/1 per unit; wasted excess |
| Fandom Support, Wayback @ 20260522091933 | Low (uncited) | Same values in ninths (6, 2, 2, 2, 9, 9, 9; cap 27). Difficulty claim (C2); parent–child C on recruit |
| FE WoD Supports System https://www.fireemblemwod.com/fe13/ENG_apoyos.htm | Low | Qualitative list of sources |
| Not reachable: StrategyWiki (Cloudflare challenge), GameFAQs thread 63225485 (read, no data), live w.atwiki.jp (Cloudflare) | — | — |

## 10. Gaps

- **G1. Does a fight need damage dealt?** FE WoD implies it does. The tester's enemy-phase fights counted, but he didn't record whether damage was dealt. Low impact: a pair that fights 4+ times will almost always deal damage.
- **G2. The 3/2/1 split when pairs interlock** (A–B, A–C and B–C all near the cap). Untested. It matters only when one unit is building three supports at once.
- **G3. Ties for the unpaired Support Unit** (C6).
- **G4. Parent–child and sibling curves** past C. Fire Editor's type-4 values (B-pending 5, A-pending 15, i.e. B at 4 and A at 13 points) have no second source. No marriage impact.
- **G5. The clamp (§4.2) is inferred, not stated.** An in-game check would settle it: fight a slow pair 4+ times on a map when they're 1 point short of a rank, then use a Seed next map and see whether it's accepted. The difference is 8 vs 6 maps for a slow pair.
- **G6. Tie-break order.** SF says ties go to "characters higher up in the in-game support list". Fire Editor's `units.xml` lists each unit's partners in slot order, which is probably that list, but this wasn't verified.
