# P02 · Prologue: The Verge of History (Lunatic Classic)

Ticket: "Play the Prologue" (#245), map #224. Previous map: [p01-premonition.md](p01-premonition.md). Protocol: #228.

**Result:** cleared in **11 turns**; the app said about 6. **Lissa died** on enemy phase 3, a permanent Classic loss. The Elwind Mage doubled her; that was my movement error (P02-N1), in a spot the plan's stance couldn't avoid (P02-T2). There was one harness reset (a frozen title screen after the bookmark) and one deviation (T2). Saved to **slot 2** (`Chapter1`) at the post-map prompt. Recorded in the app, and the loss re-solve was **accepted**: Virion and Brady into the wishlist, Kellam and Lissa out.

**Evidence:**
- screenshots in [`p02-prologue/shots/`](p02-prologue/shots/)
- turn-1 bookmark instances: [`instances-t1.json`](p02-prologue/instances-t1.json)
- post-map snapshot: [`snapshot-after.json`](p02-prologue/snapshot-after.json)
- grid: `src/game-data/maps/prologue.ts` (terrain `P002`), from #237

## What the app said, at the session's start

The app was main at `7c3a854`, with all six Premonition issues landed. It's served from `play-app` at `127.0.0.1:5247`. The re-solve after the Premonition found no improvement: *0% ±0.0 → 0% ±0.0*.

- **Lineup:** no preparation phase. Frederick leads with Chrom behind; Robin (M) and Lissa solo. All four forced.
- **EXP priority:** Frederick Normal (≈101 EXP), Chrom Normal (≈173), Robin Normal (≈0), Lissa High (≈85, heals).
- **Stance plan:** "T1 together, Frederick in front. T2–6 Separate: side by side in Attack Stance 10% of the time, else apart. T7+ past the play (it ends on turn 6): hold the last stance, and check each attack's counter below before you commit."
- **Headline:** "No-death chance on this map: **99.4%** (loses a unit about 1 run in 165) · about 6 turns · deploy 4 of 4 (forced)". The run's 0% ±0.0 is now labelled as the run's (#244 landed).
- **Counter warnings:** Chrom attacking a Myrmidon (counter 7), an Elthunder Mage (13) or an Elwind Mage (15); Robin attacking a Myrmidon ("9 damage ×2", kills at 18 HP or less).
- **Threats (11 enemies):**

| Enemy | Worst case | Kills someone | Who takes it |
|---|---|---|---|
| Ruffian ×4 · Myrmidon · Iron Sword · Avoid +10 | 22 / 17 HP on Lissa | 0.5% | Frederick ×4 |
| Ruffian ×4 · Barbarian · Iron Axe · Gamble | 30 / 17 HP on Lissa | under 0.1% | Frederick ×2 · Chrom ×2 |
| Garrick · Barbarian · Short Axe · Gamble | 36 / 17 HP on Lissa | under 0.1% | Chrom ×1 |
| Ruffian · Mage · Elthunder · Magic +2, Focus | 24 / 17 HP on Lissa | 0% | Frederick ×1 |
| Ruffian · Mage · Elwind · Magic +2, Focus | 20 / 17 HP on Lissa | 0% | Frederick ×1 |

- **Danger flags:** Garrick doubles Robin (M); Garrick doubles Lissa. Lissa's card: "worst case kills".
- **Matchup vs Garrick:** Frederick + Chrom, Silver Lance, 24×1, DS 35%, worst round 7 / 28. Robin (M), **Bronze Sword**, 8×1, doubled, 32 / 19. Lissa: "No weapon recorded in its inventory".
- **Checks offered:** Rally's EXP (Lissa); the back's EXP with no Dual Strike; the lead's EXP when the back lands the kill.
- **Chapter guide (Ellery):** chip from the canal with Thunder; Robin leads with Chrom behind for Veteran.

## Play, turn by turn

Movement is mine (#228). I used a breadth-first reach search over the captured grid (each foe's Mov and weapon range, with units blocking) to pick tiles no foe can reach.

- **T1:** bookmarked and captured (P02-S1). The title screen froze after the suspend, so I restarted Azahar (**harness reset**; the bookmark was already on disk). Chrom paired onto Frederick, Frederick in front, per the plan. Frederick (2,14) → (2,12). Lissa → (2,14), Robin → (3,14): the search's formation where no foe can reach Robin or Lissa.
- **EP1:** the (4,10) Myrmidon attacked Frederick and died on the counter (27, 99%). The (1,8) Barbarian hit Frederick for 6 and took 24 (→ 6 HP). The southern Myrmidon, a Barbarian and the Elwind Mage closed in; the northern group stayed.
- **T2 (deviation, P02-T2):** I stayed paired. Frederick moved to (3,12) and killed the Myrmidon: 27 vs 26 HP, 100%; Chrom 35% DS / 5% DG, matching the app. Robin cast Thunder at range 2 on the 6-HP Barbarian: 8 damage, 83% (Lissa's Attack Stance), **no counter**. It hit, for **30 EXP** (Veteran). Lissa moved to (2,12), out of every foe's reach, and healed Frederick (**17 EXP**).
- **EP2:** the (5,12) Barbarian hit Robin for 14 (19 → 5), as the search said only it could. Robin's Thunder countered for 8.
- **T3:** the pair killed that Barbarian (24 at 86%). Lissa healed Robin (5 → 15). Robin moved to (2,14), out of the Elwind Mage's reach. Lissa stayed at (2,12), inside it.
- **EP3:** the Elwind Mage attacked Lissa and **doubled** her (Spd 9 vs 4): 17 → 0. **Lissa died.** See P02-N1.
- **T4:** Frederick killed the Mage at (2,10) (27 at 100%). Robin waited next to him.
- **T5:** Frederick staged at (5,11), out of the northern group's reach, and Robin stayed back.
- **T6:** Frederick baited at (7,6), the bridge's foot, where the search said at most two melee foes plus the Elthunder Mage could reach him (worst case 23 of 28). A save state was taken first.
- **EP6:** both Myrmidons attacked and died on counters. Frederick ended at 7 HP.
- **T7:** Frederick took Chrom's Vulnerary by trade, retreated to (5,11) out of reach, and drank it (17 HP).
- **T8:** Frederick killed the Elthunder Mage (27, 100%) from (5,8).
- **EP8:** a Barbarian hit him to 5 HP and died on the counter. **Frederick reached Lv 2**: +HP, Str, Skl, Spd, Res.
- **T9:** the forecast on the last 6-HP Barbarian was 88% ×2 with a 6-damage counter, about a 6% death chance at 5 HP. Frederick drank a Vulnerary instead (15 HP).
- **EP9:** that Barbarian hit him for 6 and died on the counter.
- **T10:** Frederick moved to (8,6), out of Garrick's reach (Garrick holds his ground), and drank the last Vulnerary (19 HP).
- **T11:** Frederick attacked Garrick from (8,2): 23 at 84%, Garrick 9 at 64% with **5% crit**. A crit (27) kills Frederick at 19 HP, about 3%. No lower-risk line existed: Garrick's Short Axe hits Robin for 17 at range 2, and Chrom leading risks a game over. Garrick went to 11, and Frederick took 9 (→ 10).
- **EP11:** Garrick attacked, missed, and died on the counter. **Stage complete, 11 turns.**

## Entries

### P02-T2 · wrong / silent · cost: outcome (forced a deviation; a unit lost)
- **App:** "T2–6 Separate: side by side in Attack Stance 10% of the time, else apart". Who takes the Barbarians: "Frederick ×2 · Chrom ×2". The play "rests on … Held-back units stay out of reach (may read high)". No-death chance **99.4%**.
- **Game at T2:** four foes were within reach of the army: the 6-HP Barbarian (2,11), a Myrmidon (4,12), a Barbarian (5,12) and the Elwind Mage (8,9). The reach search over the grid found:
  - **no** tile for a separated Chrom (20 HP) out of reach of the Myrmidon and the Barbarian together, who deal 10 + 12;
  - **no** formation with Chrom, Robin and Lissa all out of reach, whether or not anyone attacks;
  - separating spends Frederick's action. The Myrmidon then lives, and it doubles Robin for 24 (19 HP) or Lissa for 22 (17 HP).
- **So:** the only line that removed both near threats was the pair killing the Myrmidon, then Robin's Thunder on the 6-HP Barbarian. **I deviated** and stayed together.
- **Downstream:** from T2, some unit was always inside a foe's reach, so "held back" wasn't available. Lissa died on EP3. My misread caused it (P02-N1), but only because some unit had to stand in reach.
- **Gap:** the stance plan and the no-death chance assume units can stand apart **and** out of reach. On this map, from T2, they can't, and the page doesn't say so. Now that the grids are captured (#237), per-turn feasibility of "held back" can be checked.

### P02-S4 · wrong · cost: time (it overstates danger and picks the wrong weapon)
- **App:** Robin's matchup against Garrick uses the **Bronze Sword** (8×1, doubled, worst round **32 / 19**). The counter warning says Robin attacking a Myrmidon takes "9 damage ×2".
- **Game:** Robin's equipped weapon is **Thunder** (range 1–2). From range 2, a melee-only foe **can't counter**: every Myrmidon and Barbarian here, and Garrick up close. On T2, Thunder on a Barbarian at range 2 showed no counter (`t2-forecast-robin-thunder-barbarian.jpg`). The chapter guide says the same.
- **Code:** `matchup` (`src/engine/solver.ts:283–289`) always charges the foe's counter (`worstRound = worstHit × foeHits`). Range is read only for the Counter skill (`:286`). So Thunder at range 2 gets the same worst round as a sword, and `bestWeapon` breaks the 8-vs-8 tie toward the sword.
- **Gap:** matchups and counter warnings ignore that a 1–2 range weapon avoids a melee foe's counter (and a bow a mage's, and so on). That changes the weapon pick, the worst round and the counter warnings for every tome, hand-axe and javelin user.

### P02-S5 · wrong · cost: none (read high)
- **App:** Frederick + Chrom vs Garrick, Silver Lance, **24×1**, at Frederick's Lv 1 Atk 27 (27 − Def 3).
- **Game:** at Lv 2 (Atk 28), the forecast on Garrick is **23** (`t11-forecast-frederick-garrick.jpg`). The same pattern shows on the plain Barbarians (Def 1): **24** at Lv 1 Atk 27, not 26 (`t3-forecast-frederick-barbarian.jpg`). Against swords it's the other way: the Myrmidon (Def 1) takes **27** at Atk 27 (`t2-forecast-frederick-myrm.jpg`). Against a Mage (Def 0), 27.
- **So:** lance against axe runs **2 under** Atk − Def in the game, and lance against sword 1 over. The app's 24 against Garrick is 2 high at equal stats.
- **Touches:** the weapon triangle's damage term in `matchup`. #239 added the rank bonus, and this looks like the triangle.

### P02-S3 · wrong · cost: none
- **App:** "Rally's EXP: Lissa can Rally: Rally once and note the EXP it gives."
- **Game:** Lissa is a Lv 1 Cleric whose only skill is Miracle (`t1-lissa-panel-miracle-only.jpg`). Her command menu on T1 was Items / Wait (seen, not saved). **There's no Rally**: Rally skills aren't a Cleric's.
- **Gap:** the check is offered for a unit that can't do it. It's the same family as #243's EXP-less units. Recorded as "Didn't happen".

### P02-E1 · wrong · cost: time — the first EXP forecast
The app's own comparison after Record results:

| Unit | forecast | game | app's reading |
|---|---|---|---|
| Frederick | 101 EXP (Lv 2.0) | **126** (Lv 2, 26 EXP) | above (p100) |
| Robin (M) | 0 | **40** | above (p100) |
| Lissa | 85 (Lv 1.9) | **34**, then died | below (p0) |
| Chrom | 173 | **0** | "not updated: record its level and EXP" |

- **Chrom 0 vs 173:** he spent the whole map as the back. The back gains **no EXP** without a Dual Strike, and no Dual Strike fired in about ten combats. This settles the check "the back's EXP with no Dual Strike: no" (`t2-chrom-exp0-as-back.jpg`). The forecast's 173 assumed he fights separately (P02-T2).
- **Robin 0 vs 40:** the plan gave Robin no fights. Thunder at range 2 was the safe way to finish the 6-HP Barbarian (P02-S4).
- **Gap (Record results):** Chrom was recorded at Lv 1, 0 EXP, which is his join value. The app reads that as "**not updated**" and can't compare. There's no way to say "gained nothing".

### P02-S1 · settled · confirms
- **The turn-1 instances match the chapter data's Lunatic groups:** 11 enemies at the ROM placements. Garrick is a Barbarian Lv 3 with HP 34, a Short Axe and Gamble. There are 4 Myrmidons (HP 26, Iron Sword), 4 Barbarians (HP 30, Iron Axe), an Elthunder Mage and an Elwind Mage (HP 23).
- **On the stat panel:** Barbarian Str 11, Skl 5, Spd 9, Lck 5, Def 1, Res 0; Myrmidon Str 9, Skl 11, Spd 12, Lck 10, Def 1, Res 2; both Mages Mag 10, Skl 8, Spd 9, Lck 8, Def 0, Res 4; Garrick Str 14, Skl 8, Spd 12, Lck 5, Def 3, Res 0. All match `chapter.prologue.enemies.lunatic`.
- **The recruit rows match the game's units:** Chrom, Robin, Lissa and Frederick, class, level and every stat, as Record results prefilled them. Frederick is a Great Knight with 28 HP, Str 13, Skl 12, Spd 10, Lck 6, Def 14, Res 3.
- **Evidence:** `instances-t1.json`, `t2-barbarian-6hp.jpg`, `t2-mage-elwind.jpg`, `t1-robin-stats.jpg`, `t9-barbarian-6hp.jpg`.

### P02-S2 · settled · refines (random skills)
- **Rolled:** Myrmidons 2 of 4 with Avoid +10; Barbarians 0 of 4 with Gamble; the Elthunder Mage Focus only; the Elwind Mage none. Garrick has Gamble (fixed).
- **App:** gives every Myrmidon Avoid +10, every Barbarian Gamble and each Mage both Magic +2 and Focus. That's the cautious side of "(0–1 skill(s) at random)" and reads high. The bookmark shows the real rolls. Not filed: recorded foe skills already exist, so this is a note.

### P02-S6 · settled · confirms
- **Dual Strike 35%, Dual Guard 5%** with Frederick leading and Chrom behind, as the app said.
- **Frederick's Lv 2:** +HP, Str, Skl, Spd, Res (`ep8-frederick-lv2.jpg`). Snapshot: Lv 2, 26 EXP, HP 29, Str 14, Mag 2, Skl 13, Spd 11, Lck 6, Def 14, Res 4.
- **Veteran:** Robin's kill of a Lv 1 Barbarian gave 30 EXP.
- **Heal:** Lissa's Heal gave 17 EXP and restored 10.

### P02-N1 · note · my error
- On T3 I checked the Elwind Mage's reach for Robin, not for Lissa, and judged its damage on her as one hit of 12. It **doubles** her (Spd 9 vs 4). The app's Lissa card said "worst case kills" and the threat row 20 / 17 on Lissa, so **the app flagged this; I misread it.** Logged as mine, not a gap. Its root is still P02-T2: someone had to stand in reach.
- **Menu slips:** two lost D-pad presses, and an Auto-battle prompt, which I cancelled. None needed a reset.

### P02-N2 · note (to settle)
- **Renown:** Record results says "Renown after this map: 20" (from a start of 0). The save reader reads **renown 0** after 2 chapters. One of them is wrong. Check on screen when the renown menu opens.
- **Chrom's join inventory** in the app is Falchion and Rapier 35. The game also gives him a **Vulnerary (3)**, which the chapter data's recruit row omits. Frederick used it this map.

## Batch

Filed at the end of this map, per #227, grouped by root cause:

- #248 Prologue's stance plan says separate from T2, but no tile keeps the army out of reach; its 99.4% no-death chance rests on it (P02-T2)
- #249 Matchups charge a melee foe's counter to a 1–2 range attack from range 2 (P02-S4)
- #250 Matchup damage runs 2 over the game for a lance against an axe (P02-S5)
- #251 Checks offered for things a unit can't do (Lissa's Rally), and Record results reads "gained nothing" as "not updated" (P02-S3, P02-E1)
- Not filed: P02-S2 (random skills read high; recorded foe skills exist), P02-N1 (my error), P02-N2 (renown and Chrom's Vulnerary, to settle on screen first).

## Resume

Next is **Chapter 1: Unwelcome Change**, from slot 2. Chrom, Robin and Frederick remain, with Lissa dead, and the app's re-solve is accepted. Per protocol #228, **play waits until this batch lands**; then the run's app (`127.0.0.1:5247`) gets main pulled and re-solves.
