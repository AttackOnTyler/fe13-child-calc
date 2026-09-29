# P02 · Prologue, attempt 3 (A/B replay)

Ticket: "Play the Prologue replay (attempt 3) and fill the scorecard" (#275), map #253. Protocol: "What is the A/B replay protocol and scorecard?" (#259). Earlier attempts: [attempt 1](p02-prologue.md), [attempt 2](p02-prologue-attempt2.md). Scorecard: [p02-prologue-scorecard.md](p02-prologue-scorecard.md).

**Result: failed on tempo, with no death and no deviation.** Every forecast, heal and enemy attack matched the game. Every foe's stop was the page's tile or one of the tiles it listed. But the page couldn't carry the player to a rout:
- EP6 left Frederick at 1 HP, exactly the worst case the page had accepted.
- From T7 the plan retreated three turns in a row, with no kill, while three foes followed.
- By T9 its outline showed no rout at all: it stalls on Garrick through T23.
- Play stopped at the start of T9. The ≤ 7-turn destination was already out of reach. And a page that only retreats isn't carrying the player: an app failure under the protocol, so fix, then attempt 4.

## Before playing

- **Fixes in:** #270 (Separate), #271 (the outer ring), #274 (confirm-or-correct gaps) on main. #272 (Heal's amount) had landed in f9b8e9a and was closed. #273 (enemy movement drift) was diagnosed and fixed in this session (PR #277, main `94db6a6`); see below.
- **Run app:** `play-app` moved to main `94db6a6`, served at `127.0.0.1:5247`. That origin's localStorage was empty in this session's Browser pane. I restored it from attempt 1's archived export ([`attempt1/app-localstorage.json`](p02-prologue/attempt1/app-localstorage.json)), rolled back to just after the Premonition:
  - the "Re-solve after Lissa died" edit undone (the plan it replaced restored);
  - the Prologue entry removed;
  - `settledLosses`, `dismissedChanges`, `corrections` and `calibration` (all from the Prologue) cleared.
  - The log ended at the Premonition, as the ticket asks.
- **Game:** `states-keep/prologue-t1-attempt1.cst`. The plan came only from the Prepare page. Attempt 2's log was already read (for #273), so this session was not luke-warm about attempt 2. It was luke-warm about the new page's choices, which differ from attempt 2's from T3 on.

## #273: what the drift was

Two experiments from the turn-1 state, each read from a **bookmark** (the `Temporary` save holds every unit's tile and HP, so no cursor counting):
- **E0:** end turn 1 with no moves.
- **E2:** only Frederick moves, to (7,13).

Every foe stopped on a tile the simulator already counted as equally near. The reach, the costs and the bounds were right. The only wrong part was which of the equal tiles it picked. No deterministic rule fitted all six walkers: target unit, path order, straight line and nearest unit were each tried. Folklore (research #254) says the game rolls. So the simulator now:
- lists each foe's equal tiles;
- predicts the one nearest our units;
- lets the page correct it with one tap.

In this attempt that rule predicted 7 of 9 walkers' tiles exactly, and the other 2 were one tap each. The bookmark reads are in the session's scratch notes, not archived here.

## Play, turn by turn

- **T1, as planned:**
  - Frederick → (4,14), Pair Up with Robin.
  - Switch, then Frederick → (8,12): Attack the Myrmidon. 28 at 100%, counter 0 at 75%, as forecast; it fell.
  - Chrom → (1,13), Pair Up with Lissa.
  - Lissa → (3,14), Wait.
- **EP1** (bookmark read):
  - The Barbarian attacked Frederick and died on the counter (a crit). Tapped "killed Barbarian".
  - The Myrmidon attacked and died, as predicted. Frederick: 22.
  - The Mage stopped on (10,11), a listed alternative (1 tap). The west Barbarian stopped on (2,12), as predicted.
- **T2, as planned:**
  - Frederick → (2,13) chipped the Barbarian: 25 at 88%, counter 6 at 74%. It was left at 5; Frederick 16.
  - Switch, Chrom → (3,12) killed it: 11 at 94%, as forecast.
- **EP2:** as predicted (the Mage walked to (6,12)).
- **T3:** Frederick → (6,11) killed the Mage: 28 at 100%, counter 13 at 85%, which missed. The re-solve then swapped the heal for Chrom → (6,10), Wait.
- **EP3–EP5:** no foe acted, as predicted.
- **T4:** Frederick → (7,9), Wait. Switch, Lissa → (7,10), Heal: **16 → 26, the game's +10**.
- **T5:** Lissa heals, 26 → 28. Frederick waits.
- **T6:** Frederick → (9,4) killed the bridge Myrmidon (28 at 100%, counter 0), which woke the north band. Lissa → (10,8), Wait. The page's worst case: Frederick 27 of 28, crit risk 7.2%.
- **EP6: exactly as predicted**, tile for tile (bookmark read):
  - the second Myrmidon died on the counter;
  - the Mage (9,2) hit for 15;
  - the Barbarians at (9,3) and (8,4) hit for 6 each;
  - Frederick ended at **1 HP**, and both Barbarians at 5.
- **T7:** Frederick → (8,9), Wait. Lissa → (8,10), Heal: 1 → 11.
- **EP7:** no attacks. The Mage (9,7) and one Barbarian (9,8) stopped as predicted. The other Barbarian took (9,6), a listed alternative (1 tap).
- **T8:** the page retreated: Lissa → (4,10), Frederick → (3,9), both Wait.
- **EP8:** no attacks. All three foes stopped exactly as predicted.
- **T9 (not played):** the page retreated again: Lissa → (2,13), Frederick → (1,12). Frederick stays at 11 HP, with no heal. Its outline:
  - "✗ The hard line breaks on T12, T13";
  - "No rout within the outline";
  - after kills on T12, T17 and T18, Frederick waits by Garrick through T23.
  - Play stopped. The T9 state is kept at `states-keep/prologue-t9-attempt3.cst`.

The page inputs, in order: [`attempt3/page-inputs.txt`](p02-prologue/attempt3/page-inputs.txt) (26 events, about 3 per turn).

## Findings

| # | Kind | Claim → what happened |
|---|---|---|
| P02c-T1 | tempo (solver) | From T7 the plan only retreats: 3 turns, no kill, foes following. At 11 HP Frederick can't face the trio: Mage 15 + Barbarian 6 kills him even after a +10 heal (21 ≥ 21). So no attack is safe, and every safe line walks away. The 3-turn search never finds "retreat **and** heal until two heals put him out of one-round range". T9's plan leaves Lissa 2 tiles from him, not healing. |
| P02c-T2 | tempo (outline) | The outline stalls on Garrick with no attack for 5+ turns, so "Rout on turn N" becomes "No rout within the outline" from T6. Attempt 2 saw the same slide (T9 → T14). |
| P02c-T3 | plan (wake timing) | T6 woke the north band with Frederick alone at the bridge. The gang-up took him to exactly 1, a worst case the hard line accepted and then couldn't recover from. A wake that keeps the healer, and a second fighter, in range to re-engage is the likely lever. |
| P02c-U1 | data (minor) | An enemy phase tapped with a different stop keeps the old `alternatives` list (it still holds the new tile, and it drops the predicted one). Nothing reads it after the tap. |

What held up:
- **Every player-phase forecast** matched the game screen exactly: 6 combats.
- **Both heals:** +10 as the page said (#272).
- **Every enemy attack** and its HP: EP1 (with the crit-counter tap) and EP6, a four-foe gang-up to exactly 1 HP.
- **No death, no deviation.** Taps: about 3 per turn, and the two alternative stops were one tap each.
