# P02 · Prologue scorecard (A/B replays)

Protocol: "What is the A/B replay protocol and scorecard?" (#259). One column per attempt. The destination: **0 deaths, rout ≤ 7 turns (stretch 6), 0 deviations.** Not scored: luck at stated odds.

| | Attempt 1 ([log](p02-prologue.md)) | Attempt 2 ([log](p02-prologue-attempt2.md)) |
|---|---|---|
| App | main `7c3a854`: stance plan, no board | main `ac9f6ff`: position plan (#266) |
| **Outcome** | | |
| Deaths | 1: Lissa, EP3 (Elwind Mage doubled her) | 1: Lissa, EP9 (Barbarian doubled her, alone after a Separate) |
| Rout turn | 11 | none by T9 (play stopped at the death; the page's estimate had slid to T14) |
| Deviations | 1 (T2: stayed paired against the stance plan) | 1 (T1: the planned tile (4,15) isn't on the playable map) |
| **Did the page carry the player** | | |
| Improvisations | many: all movement was mine, from my own reach search | 2: T1 Lissa's tile (chosen with try-a-move); T9 reading Separate's result |
| App-model failures | numbers (#249, #250); verdict (#248: no safe tile for the stance); silence (no positions at all) | silence/grid (F1); numbers: Heal (F2); prediction: foes one tile off (F3); **verdict: Separate's dropped unit acts (F4, the death)**; reach (F5, unverified) |
| Grey-zone misses | Lissa left in the Elwind Mage's reach (P02-N1) | none on the death; two input slips of mine (the "Use my version" tile, T8's (1,10)), both corrected before they mattered |
| Taps per turn | n/a | ≈4 (37 inputs over 9 turns, corrections included) |
| Enemy predictions right as they stood | n/a | attacks and HP: 8 of 9 phases; positions: 6 of 9 (EP1 and EP8 a tile off; EP9 reached a tile called out of reach) |
| **Health afterwards** | | |
| End HP / EXP vs forecast | Frederick Lv 2 (26 EXP), Robin 40, Chrom 0, Lissa dead | not reached (stopped at EP9). At T9: Frederick Lv 1, 89 EXP, 28/28 |
| Weapon uses | Silver Lance 16 left | Silver Lance 20 left at T9 |
| Items used | both Vulneraries | 1 Vulnerary (Lissa's, by trade); Heal ×4 |

## Reading it

- **What improved:**
  - Combat numbers are exact now; every forecast matched.
  - Enemy attacks and HP were predicted exactly for 8 of 9 phases, including a four-foe gang-up.
  - The page chose safe lines on its own: it held Frederick back rather than trading Chrom's HP for a turn.
- **What failed:** three places where the board model differs from the game:
  - a tile that doesn't exist;
  - Heal's amount;
  - drifted movement.
  - One rules bug turned a "safe" verdict into a death: the dropped unit after a Separate.
- **Turns:** the solver's rout slid well past 7. This attempt can't say whether ≤ 7 is reachable, because the plan kept choosing waiting over trading.
