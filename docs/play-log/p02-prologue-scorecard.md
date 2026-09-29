# P02 · Prologue scorecard (A/B replays)

Protocol: "What is the A/B replay protocol and scorecard?" (#259). One column per attempt. The destination: **0 deaths, rout ≤ 7 turns (stretch 6), 0 deviations.** Not scored: luck at stated odds.

| | Attempt 1 ([log](p02-prologue.md)) | Attempt 2 ([log](p02-prologue-attempt2.md)) | Attempt 3 ([log](p02-prologue-attempt3.md)) |
|---|---|---|---|
| App | main `7c3a854`: stance plan, no board | main `ac9f6ff`: position plan (#266) | main `94db6a6`: + ring, Separate, Heal, equal-tile stops (#270–#274) |
| **Outcome** | | | |
| Deaths | 1: Lissa, EP3 (Elwind Mage doubled her) | 1: Lissa, EP9 (Barbarian doubled her, alone after a Separate) | **0** (through T8) |
| Rout turn | 11 | none by T9 (play stopped at the death; the page's estimate had slid to T14) | none: stopped at T9 with 4 left; the page's outline showed no rout at all |
| Deviations | 1 (T2: stayed paired against the stance plan) | 1 (T1: the planned tile (4,15) isn't on the playable map) | **0** |
| **Did the page carry the player** | | | |
| Improvisations | many: all movement was mine, from my own reach search | 2: T1 Lissa's tile (chosen with try-a-move); T9 reading Separate's result | 0 in play; stopped because the page only retreated (T7–T9) |
| App-model failures | numbers (#249, #250); verdict (#248: no safe tile for the stance); silence (no positions at all) | **grid: the outer ring treated as walkable (F1), so Lissa was called safe at a tile she couldn't stand on (F5)**; **verdict: Separate's dropped unit acts (F4)**; these two together caused the death. Numbers: Heal (F2); prediction: foes one tile off (F3, possibly my misreads from F1) | **tempo: the plan retreats with no path back to a kill (P02c-T1/T2)**; wake timing left Frederick at exactly 1 (P02c-T3) |
| Grey-zone misses | Lissa left in the Elwind Mage's reach (P02-N1) | none on the death; two input slips of mine (the "Use my version" tile, T8's (1,10)), both corrected before they mattered | none |
| Taps per turn | n/a | ≈4 (37 inputs over 9 turns, corrections included) | ≈3 (26 inputs over 8 turns, 2 of them stop corrections) |
| Enemy predictions right as they stood | n/a | attacks and HP: 8 of 9 phases; positions: 6 of 9 as read (EP1 and EP8 a tile off, to re-check after the bounds fix; EP9's reach was wrong because of the bounds) | attacks and HP: 8 of 8 phases (EP1's crit counter tapped); stops: 7 of 9 walkers exact, 2 listed alternatives (1 tap each) |
| **Health afterwards** | | | |
| End HP / EXP vs forecast | Frederick Lv 2 (26 EXP), Robin 40, Chrom 0, Lissa dead | not reached (stopped at EP9). At T9: Frederick Lv 1, 89 EXP, 28/28 | at T9: Frederick 11/28, 78 EXP; Lissa 17/17, 51 EXP; Chrom 20/20 |
| Weapon uses | Silver Lance 16 left | Silver Lance 20 left at T9 | Silver Lance 21 left at T9 |
| Items used | both Vulneraries | 1 Vulnerary (Lissa's, by trade); Heal ×4 | none; Heal ×4 |

## Reading it

- **What improved:**
  - Combat numbers are exact now; every forecast matched.
  - Enemy attacks and HP were predicted exactly for 8 of 9 phases, including a four-foe gang-up.
  - The page chose safe lines on its own: it held Frederick back rather than trading Chrom's HP for a turn.
- **What failed:** three places where the board model differs from the game:
  - the unwalkable outer ring treated as ground;
  - Heal's amount;
  - drifted movement (possibly an artifact of the first).
  - Two faults together turned a "safe" verdict into a death: the bounds put Lissa a tile further from the Barbarians than she was, and the page moved the dropped unit after a Separate.
- **Turns:** the solver's rout slid well past 7. This attempt can't say whether ≤ 7 is reachable, because the plan kept choosing waiting over trading.

- **Attempt 3:**
  - The board model held everywhere it was checked: forecasts, heals, every enemy attack, and every stop within the listed ties.
  - The failure moved from the model to the plan. It woke the north band with Frederick alone. The gang-up took him to exactly 1, the worst case it had accepted. From then on, every line the hard line allows walks away.
  - So "Is ≤ 7 turns reachable under the hard line?" is now a sharp question about the solver's tempo, not about the board.
