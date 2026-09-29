# P02 · Prologue, attempt 5 (A/B replay)

Ticket: "Play the Prologue replay (attempt 5) and fill the scorecard" (#292), map #253. Protocol: "What is the A/B replay protocol and scorecard?" (#259). Earlier attempts: [1](p02-prologue.md), [2](p02-prologue-attempt2.md), [3](p02-prologue-attempt3.md), [4](p02-prologue-attempt4.md). Scorecard: [p02-prologue-scorecard.md](p02-prologue-scorecard.md).

**Result: the destination is met.** Rout on **turn 7** (EP7), with **0 deaths, 0 deviations and 0 improvisations**.
- Turn 7 is the page's own proven fewest-turn rout. It proved T8 before play, and T7 after EP1's board was corrected.
- It is inside the community's 5–10.
- Every move the page gave was legal and was played as written. That includes five "move on the lead's reach, then Switch" lines, the pair model from #291.
- The run's slot 2 now holds this clear: the run's real Prologue.

The board model held. The misses are small and listed under Findings: one walker's stop, a 5-point counter hit, stats after a mid-map level-up, and two page-input slips.

## Before playing

- **Run app:** `play-app` moved to main `bb8a688` (#291 and its review follow-ups), served at `127.0.0.1:5247`.
  - The log ended at the Premonition. `positions.prologue` was already empty, so there was nothing to "Start over".
  - The page after load: "✓ Proven: rout on turn 8", game over 0%, expected worth lost 0.117 of a 0.2 budget (unit worth not costed yet, so the default).
  - T1 now starts "Frederick → (4,14) Pair Up with Robin; Robin → (9,13), Switch (Frederick leads): Attack Myrmidon". That's a legal lead's-reach move.
- **Game:** `states-keep/prologue-t1-attempt1.cst` copied into slot 04, its in-file timestamp (u64 LE at byte 32) stamped to now. It loaded turn 1 (4 vs 11). All ten slots were backed up to the session's scratchpad first.
- **Harness permission:** this session ran in auto mode. The classifier blocked both the slot write and `az.ps1 launch` until the user added both to `autoMode.allow`.

## Play, turn by turn

Enemy phases were read from a **bookmark** each time (`save/cli.ts` on `Temporary`); the reads are in [`p02-prologue/attempt5/bookmarks/`](p02-prologue/attempt5/bookmarks). The page's inputs are in [`page-inputs.txt`](p02-prologue/attempt5/page-inputs.txt).

- **T1, as planned:**
  - Frederick → (4,14), Pair Up with Robin.
  - The pair → (9,13), Switch, Frederick attacks the Myrmidon: 28 at 100%, counter 0 at 75%, Dual Strike 24%, as forecast; it fell.
  - Chrom → (1,13), Pair Up with Lissa. The pair → (3,14), Wait.
  - Robin's and Lissa's tutorial dialogues fired on selection (one A per line).
- **EP1:**
  - The Barbarian attacked Frederick from (9,12), as predicted: hit for 6 (28 → 22). Frederick's counter plus Robin's Dual Strike killed it (the page had it at 5). One tap: "killed Barbarian".
  - Mage (10,11) and west Barbarian (2,12): as predicted.
  - **The Myrmidon stopped at (7,12).** The page predicted (4,13), with ties (2,13), (5,14), (3,12), so (7,12) wasn't listed. One "a unit is elsewhere" correction.
  - The re-solve after these corrections proved **rout on turn 7**.
- **T2, as planned:**
  - Frederick → (3,12) chips the Barbarian: 25 at 88%, counter 6 at 74%, hit (Frederick 16, it 5).
  - Lissa's pair → (1,12), Switch, Chrom kills it: 11 at 94%.
  - The game showed the counter's hit as **65%**; the page said 60% (P02e-N1).
- **EP2, as predicted:** the Myrmidon attacked Frederick from (4,12) and died on the counter; the Mage walked to (6,12).
  - My slip: I didn't watch this phase. All units had acted, so it started at once, and I took T3's first screenshot for T2 still waiting. The bookmark confirmed every tile and HP.
- **T3:**
  - Frederick → (6,11) kills the Mage: 28 at 100%.
  - The re-solve then swapped the planned heal for "Chrom → (6,12): Wait". The Chrom–Robin dialogue fired on selection.
- **EP3:** no attacks, as predicted.
- **T4:**
  - Frederick → (6,8), Wait. This wakes the north band.
  - Chrom's pair → (5,8), Switch, Lissa heals Frederick 16 → 26 (the game's +10).
- **EP4, exactly as predicted:**
  - The wake of 5.
  - The Myrmidon attacked from (6,7) for 0 and died on the counter.
  - Stops: Myrmidon (7,6), Mage (8,7), Barbarians (7,5) and (8,5). All tiles as predicted.
- **T5:** Frederick → (7,7) kills the Mage: 28 at 100%, counter 15 at 65%, as forecast. Lissa's pair → (8,10), Wait.
- **EP5:** the gang-up the page had costed (worst case Frederick 12 of 26, crit 0.2%).
  - The Myrmidon attacked from (7,6), hit for 0, died on the counter.
  - Barbarian (7,6) hit for 6 (26 → 20), countered to 5.
  - Barbarian (8,7) **missed**, countered to 5.
  - The page predicted both Barbarians hitting (Frederick 14), so one "Fix an attack".
- **T6:**
  - Lissa's pair → (9,7), Switch, Chrom kills the (8,7) Barbarian: 11 at 94%, counter again shown 65%.
  - Frederick → (8,6) kills the (7,6) Barbarian: 25 at 88%. **Frederick reached Lv 2** (+HP, Mag, Skl, Def).
- **EP6:** no attacks (only Garrick, who never moves).
- **T7:**
  - Chrom's pair → (8,5), Switch, Lissa heals Frederick **20 → 29**. The page said 20 → 28: it doesn't know about the level-up (P02e-M1).
  - Frederick → (8,2) attacks Garrick. The game showed 23 at 85%, crit 2%, Dual Strike 25%, with Garrick's counter 8 at 68%, crit 8%. The page said 84%, 24% and 9 (P02e-M1 again).
  - Garrick was left at 11; the counter hit (29 → 21).
- **EP7:** Garrick attacked Frederick, hit for 8 (21 → 13), and died on the counter. That is exactly the page's line: chip on T7, and Garrick dies attacking.
  - "Victory: Rout the enemy, Turn 7", 4 units.
  - My slip: I tapped T7's attack as "killed", reading the EP7 kill as the player-phase one. The page has no undo short of "Start over", so its record has Garrick falling a phase early (P02e-U2). The Silver Lance's two uses in T7 (19 → 17) and Frederick's 16 lost showed what really happened.
- **Save:** slot 2, "Chapter 1: Unwelcome Change".
  - Attempt 1's slot-2 save was already archived and byte-identical ([`attempt1/Chapter1.sav`](p02-prologue/attempt1/Chapter1.sav)).
  - Slots 1 and 3 are unchanged, byte for byte.
  - The new save is [`attempt5/Chapter1.sav`](p02-prologue/attempt5/Chapter1.sav); its snapshot is [`snapshot-after.json`](p02-prologue/attempt5/snapshot-after.json).

End state: Frederick Lv 2 (15 EXP), Chrom 60 EXP, Lissa 34, Robin 0. Silver Lance 17 uses left, Heal 28; no Vulnerary used.

## Findings

| # | Kind | Claim → what happened |
|---|---|---|
| P02e-P1 | prediction (stops) | EP1: the lunatic Myrmidon from (4,10) stopped at **(7,12)**. The page predicted (4,13) with ties (2,13), (5,14), (3,12), so the real tile wasn't among the listed equals. It's the only walker off the list in 10. Why is open: another target, or a tie the reach search doesn't see. It cost one correction; nothing depended on it. |
| P02e-N1 | numbers | Chrom (leading, Lissa behind) attacking a Barbarian: the counter's hit is **65%** in game and 60% on the page, both times (T2, T6). The 5 points are on Chrom's avoid or the Barbarian's hit; unexplained. Harmless here (the Barbarian died first), but it would misprice a surviving counter. |
| P02e-M1 | model (level-ups) | The page keeps a unit's map-start stats after a mid-map level-up. Frederick's Lv 2 (+1 HP, Mag, Skl, Def) made the heal 20 → 29 (page 28) and moved Garrick's forecast (85/25/8 in game, 84/24/9 on the page). Harmless here; it matters whenever a level-up changes a breakpoint. |
| P02e-U1 | UI (Fix an attack) | EP5's fix: Barbarian 1 **hit** (26 → 20), then Barbarian 2 **missed**. The stored result for the miss says Frederick 26, the phase-start HP, not 20, and the board then showed 26/28. It needed "Set HP: 20". A fixed miss should carry the HP left by the earlier fixes. (The fix form's toggles also lagged fast clicks. That's a harness-speed artifact, but worth knowing.) |
| P02e-U2 | UI (undo) | There is no way to undo a mis-tapped outcome except "Start over". My wrong "killed" on T7 stands in the record. |

Not failures: EP1's Dual Strike kill and EP5's missed Barbarian are luck at stated odds, and the page re-solved around both.

## What this attempt shows

- **The pair fix works in play.** Five switched lines were played exactly as written, each a move on the lead's reach followed by Switch (T1, T2, T4, T6 and T7's heal). None needed a correction.
- **The tempo build delivers.** It woke the north band on T4 with Frederick at 26, and its costed EP5 gang-up left him at 20, far from attempt 3's 1 HP. Then it went straight for the kills.
- **The model held everywhere it mattered:**
  - all 7 enemy phases' attacks;
  - 9 of 10 walkers' stops;
  - every forecast within a point, except the counter-hit gap.
- **Taps:** 24 inputs over 7 turns, about 3.4 a turn. They include 3 corrections (EP1 ×2, EP5) and one HP set.
