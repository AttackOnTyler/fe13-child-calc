# P02 · Prologue, attempt 4 (A/B replay)

Ticket: "Play the Prologue replay (attempt 4) and fill the scorecard" (#279), map #253. Protocol: "What is the A/B replay protocol and scorecard?" (#259). Earlier attempts: [1](p02-prologue.md), [2](p02-prologue-attempt2.md), [3](p02-prologue-attempt3.md). Scorecard: [p02-prologue-scorecard.md](p02-prologue-scorecard.md).

**Result: stopped on T1, before any combat.** The page's second move can't be played:
- It says "Switch (Frederick leads), then Frederick → (4,9)".
- The game doesn't let a pair move after Switch.
- The planned tile is 7 tiles from the pair. Lissa, who leads there, moves 6 (5, +1 from Frederick behind her).
- The proven T8 rout starts with this move, so the proof is void, not just the move. This is an app-model failure under the protocol: fix, then attempt 5.

## Before playing

- **Run app:** `play-app` moved to main `e1b9a3b` (the tempo build #282–#285 and its review follow-ups), served at `127.0.0.1:5247`. The log ended at the Premonition. "Start over" cleared attempt 3's `positions.prologue` (26 inputs). Nothing else was recorded.
- **The page after the reset:** "✓ Proven: rout on turn 8". Game over 0%, expected worth lost 0.185 of a 0.2 budget (unit worth not costed yet, so the default). Turns 2 and 4 are marked "✗ a counter can kill" (6.7% each).
- **Game:** `states-keep/prologue-t1-attempt1.cst`.
  - Harness note: "Load" picks the newest slot by the timestamp **inside** the state file (a little-endian u64 at byte 32), not by file time.
  - A plain copy into slot 3 loaded attempt 3's T9 state instead.
  - So I stamped the copy's header with the current time, and it loaded turn 1 (4 vs 11).

## Play

- **T1 step 1, as planned:** Frederick → (1,13), Pair Up with Lissa. Lissa's tutorial dialogue fired when she was then selected (4 lines, one A each).
- **T1 step 2, can't be played:** "Switch (Frederick leads), then Frederick → (4,9): Attack Myrmidon".
  - Lissa selected, her own tile, **Switch**: Frederick leads, but the menu reopens in place (Items, Trade, Switch, Separate, Wait). There's no way to pick a tile.
  - **B** after the Switch undoes it, back to Lissa's move range. Tried twice. Y does nothing.
  - The rule: "A pair of units will be unable to use any remaining movement after using the 'Switch' command" ([Fire Emblem Wiki, Pair Up](https://fireemblemwiki.org/wiki/Pair_Up)).
- **What the game does allow (checked, then cancelled):** Lissa moves the pair to (3,10), next to the Myrmidon at (4,10), then Switch. The menu then opens with **Attack** first, Frederick leading. So a switched action is the **lead's** move, then Switch, then the back's command from there.
- Cancelled back to idle with only step 1 done. Nothing was committed after it, so no result stands beyond the Pair Up. Screens are in the session's scratch notes.

## Findings

| # | Kind | Claim → what happened |
|---|---|---|
| P02d-M1 | model (pairs) | The solver plays "Switch first, then the back moves with **its own** Mov" (`allOptions` in `src/engine/board/solve.ts`, from #274). The game lets a pair move only with the **lead's** reach. Switch can come after the move, and the new lead then acts from there. Every switched line whose tile is past the lead's reach is illegal. That includes T1 here and the proof of the T8 rout. |
| P02d-M2 | model (pairs, stance sim) | The stance simulator states the same rule ("Switch is free, once a turn, before the pair moves", `src/engine/sim/map-play.ts`). Check whether it also moves the switched back with its own Mov. |
| P02d-U1 | UI | Try-a-move's "Switch first (X leads)" (`src/ui/position-plan.ts`) shows the back's reach after a Switch. It should show the lead's reach, then offer the back's commands at the tile. |

Why attempts 2 and 3 didn't catch it: each switched move they played was also within the old lead's reach. For example, attempt 3's T1 moved Frederick (4,14) → (8,12), 6 tiles, which is exactly Robin's 5 + 1.
