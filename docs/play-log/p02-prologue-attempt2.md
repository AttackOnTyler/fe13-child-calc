# P02 · Prologue, attempt 2 (A/B replay)

Ticket: "Play the Prologue replay (attempt 2) and fill the scorecard" (#267), map #253. Protocol: "What is the A/B replay protocol and scorecard?" (#259). Attempt 1: [p02-prologue.md](p02-prologue.md). Scorecard: [p02-prologue-scorecard.md](p02-prologue-scorecard.md).

**Result: failed. Lissa died on enemy phase 9**, and no rout came by turn 9. The page's rout estimate slid from T9 to T11 to T14. The death traces to two claims the game contradicted:
- **Bounds (P02b-F1/F5):** the app treats the Prologue's unwalkable outer ring (row 0, row 15, column 0, column 16) as ground. So it had Lissa at (0,13), "out of reach", when she really stood at (1,13), inside a Barbarian's reach. The user spotted this after the attempt.
- **Separate (P02b-F4):** the page planned for the dropped unit (Chrom) to act, which the game doesn't allow. Play stopped at that death, since it had already failed the destination. Per the protocol this is an app-model failure, so the next step is **fix, then attempt 3**.

## Before playing

- **Archived attempt 1:** the slot-2 save (`Chapter1.sav`) and a full localStorage export of the run app (`app-localstorage.json`), both in [`p02-prologue/attempt1/`](p02-prologue/attempt1/).
- **Rolled the run back to just after the Premonition:**
  - undid "Re-solve after Lissa died on Prologue" (the app's Undo);
  - removed the Prologue entry (the log's ✕);
  - cleared `settledLosses` (`dead:lissa`) and the entry id left behind in `dismissedChanges`, which removing an entry doesn't clean up (filed as #269).
  - The checked rule "the back gains no EXP without a Dual Strike" was kept: it's a fact about the game, not the run.
- **App:** `play-app` moved to main `ac9f6ff` (position plan #266, safety checker, solver, enemy-phase simulator, AI data). Served at `127.0.0.1:5247`.
- **Game:** loaded `states-keep/prologue-t1-attempt1.cst` (copied into slot 5, the newest). It ran as a fresh, luke-warm session: the plan came only from the Prepare page's position plan, and attempt 1's log was read only after play ended.

## What the page said at the start

- **Verdict:** "✓ No death without a crit · Crit risk over the next 3 turns: 0.7% · Rout on turn 9 (the play: about 7 turns)". The headline no-death chance for the map was 60.7%.
- **Two warnings:** the old stance plan's "holds Lissa and Robin back on T2/T3" couldn't be kept by any formation. The position plan says it doesn't rely on that.
- **T1:**
  - Frederick → (4,14), Pair Up with Robin;
  - Switch, Frederick → (8,12), Attack Myrmidon (28×1 at 100%, counter 0 at 75%);
  - Chrom → (1,13), Pair Up with Lissa;
  - Lissa → (4,15), Wait.

## Play, turn by turn

- **T1:** every forecast matched the game to the point (28 / 100% / 0%; counter 0 / 75%). Frederick (Robin behind) killed the Myrmidon.
  - **Lissa's tile (4,15) doesn't exist in the game:** row 15 is outside the playable map, and the cursor stops at row 14 (P02b-F1).
  - I used try-a-move to compare (3,14) with (1,14). (3,14) matched the plan on everything except the rout; (1,14) left Lissa's worst case at 1 HP. I played (3,14). **Deviation 1**, forced.
  - My slip: "Use my version" took the last tile I'd tried, (1,14), not the one I meant. I corrected it before the enemy phase.
- **EP1:** Frederick's counter **critted** a Barbarian (2%) and killed it. The Myrmidon also died on its counter, as predicted.
  - The moving-only foes ended a tile off the prediction: the Barbarian at (1,13), not (2,12); the Mage at (9,10), not (8,9).
  - I corrected four things: the attack fix (no "crit / killed" option there), HP 0 on the dead Barbarian, Frederick's HP 22, and the two positions (P02b-F3, P02b-U1).
- **T2:**
  - Frederick → (1,12), chipped the Barbarian (25 at 88%, counter 6 at 74%): 5 left, Frederick 16. As forecast.
  - Switch, Chrom → (2,13), killed it (11 at 94%). As forecast.
- **EP2:** as predicted (the Mage walked to (4,10)).
- **T3:**
  - Frederick → (5,10) killed the Mage (28 at 100%, counter 13 at 85%, missed).
  - Switch (Lissa leads), Lissa → (5,11), Heal on Frederick. **The game healed 10 (16 → 26); the page assumed a full heal to 28** (P02b-F2). Corrected by hand.
- **EP3:** as predicted, with no attacks.
- **T4:**
  - Frederick → (7,9), Wait.
  - Lissa → (7,10), Wait. The page re-solved after the HP fix and dropped the heal.
- **EP4:** as predicted.
- **T5:**
  - Lissa heals Frederick (26 → 28).
  - Frederick waits.
- **EP5:** as predicted.
- **T6:** Frederick → (7,4) killed the bridge Myrmidon (28 at 100%, counter 0 at 75%). This woke the north group. Lissa → (6,8), Wait.
- **EP6:** **exactly as predicted.**
  - The second Myrmidon died on the counter.
  - The Mage, then two Barbarians, hit Frederick: 28 → 13 → 7 → 1.
  - Both Barbarians were left at 5.
- **T7:**
  - Frederick → (5,8), traded Lissa's Vulnerary and drank it (1 → 11).
  - Lissa → (5,9), Heal (→ 21).
- **EP7:** no attacks, as predicted. I didn't verify the positions tile by tile.
- **T8:** the page kept Frederick out of reach rather than finishing a 5-HP Barbarian.
  - Try-a-move showed the kill would rout a turn sooner but leave Chrom's worst case at 75% of his HP.
  - Frederick → (1,9) was planned. I misstepped to **(1,10)** (my input slip) and corrected it on the page.
  - Lissa → (1,9), Heal (→ 28).
- **EP8:** no attacks, but **all three foes ended one tile off the prediction** (P02b-F3):
  - Mage (2,7), not (1,6);
  - Barbarians (2,8) and (3,9), not (1,7) and (2,8).
  - The in-game forecast exposed this: the planned tile offered no Attack. I corrected all three.
- **T9:**
  - Frederick → (2,6) killed the Mage (28 at 100%, counter 15 at 65%, missed).
  - The page re-solved from "Switch, Chrom → (2,9) attacks the Barbarian" (before the Mage fell) to "Lissa → (0,13): Separate to (0,14)", with a rout on T14. Try-a-move couldn't test the Chrom attack, because it offers no Switch (P02b-U2).
  - I played the Separate. **The game then ended the player phase:** the dropped unit counts as having acted.
  - The page, re-solving after "✓ done", planned "Chrom → (0,13): Pair Up with Lissa" and showed Lissa safe (P02b-F4).
- **EP9:** a Barbarian (5 HP) reached Lissa, alone at (0,13), and doubled her: 16 ×2 at 85% (Chrom adjacent as support). **Lissa died.** See [`ep9-lissa-dies.png`](p02-prologue/attempt2/shots/ep9-lissa-dies.png).
  - Column 0 isn't walkable, so the leftmost tile I could put her on was really (1,13). From (1,13) a Mov-5 Barbarian at (2,8) reaches her. The page's "out of reach" came from the bounds bug (P02b-F5), and it would have failed even without the Separate misstep.

Play stopped here, with 3 foes left (2 Barbarians at 5 HP, and Garrick). The attempt had already failed the destination, and a rerun from the turn-1 state is the next attempt.

## Findings

| # | Kind | Claim → what the game did |
|---|---|---|
| P02b-F1 | silence / numbers (grid) | The whole outer ring (row 0, row 15, column 0, column 16) is unwalkable in the game, but the captured grid treats it as terrain. T1 sent Lissa to (4,15), which doesn't exist. |
| P02b-F2 | numbers | Heal on Frederick at 16/28: page → 28 (full), game → 26 (+10). The page's re-solve healed to full; the game gave +10. |
| P02b-F3 | prediction (unconfirmed) | Moving-only foes read one tile off the prediction (EP1, EP8). But I read those tiles by counting cursor steps, some of them from the edge, so they may be my misreads caused by F1. Re-check after the bounds fix. |
| P02b-F4 | verdict (rules) | After Separate, the dropped unit has acted. `replay` (`src/engine/board/log.ts:31`) reads `.back` from the board *after* the action, so it never marks the dropped unit as acted, and the re-solve moved it. Lissa, left alone, died without a crit. |
| P02b-F5 | verdict (reach, from F1) | The page had Lissa at (0,13), "out of reach"; she was really at (1,13), which a Mov-5 Barbarian reaches. The death's second cause, independent of F4. |
| P02b-U1 | UI | "Fix an attack" offers only hit/missed per side: no crit, no "it died", so a crit kill needs a manual HP set. |
| P02b-U2 | UI | Try-a-move can't Switch a pair, so a plan's own "Switch, then …" line can't be compared. |
| P02b-U3 | UI | "Use my version" takes the last tried tile, which is easy to confuse after comparing two. |
| P02b-U4 | run log | Removing a log entry leaves `settledLosses` / `dismissedChanges` behind (#269). The ✕'s native `confirm()` didn't work for the user in the Browser pane. |

Filed: F4 → #270 · F2 → #272 · F1 + F5 → #271 (widened to the whole ring) · F3 → #273 (re-check after #271) · U1–U3 → #274 · U4 → #269.

What held up:
- Every player-phase attack forecast matched the game screen exactly: damage, hit, crit and counter, across 7 combats.
- EP2–EP7's attacks and HP outcomes were exact, including EP6's four-foe gang-up to 1 HP.
- The hard line never broke on a combat roll.
