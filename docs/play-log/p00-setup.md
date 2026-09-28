# P00 · Run setup (before the Premonition)

Ticket: "Plan the run in the app before the Prologue" (#229), map #224. Entry format: #227; protocol: #228.

- **App:** main at `878ef53`, served from the `play-app` worktree at **`http://127.0.0.1:5247`**. The run lives in that origin's localStorage, so every play session must use this origin. Import `p00-baseline-run.json` there if it's ever lost.
- **Run facts:** Lunatic · Classic · Main story · endpoint Endgame · deploying 16 · 45 maps.
- **Robin (locked):** Male, **+Str −Def**, marrying Sumia. This is the app's top-ranked Robin (see S3).
- **Baseline:** [`p00-baseline-run.json`](p00-baseline-run.json) is the app's own run state (`fe13-child-calc:run:v2`) right after the lock. Its `adopted` plan holds the wishlist (16 fielded, 0 reserves), 12 marriages, 13 children with their passes, the roadmap order, 30 Master Seals, about 90 item hand-offs, 12 side goals and 25 EXP-priority windows.
- **In game:** make a new file with Lunatic, Classic, Robin Male, asset **Str**, flaw **Def**, and save it to **slot 2**.

## Resume

The next session is **Play the Premonition** (#234). The app's Premonition prep says:
- Chrom leads, Robin (M) backs, both forced. "T1–2 side by side in Attack Stance 10% of the time, else apart."
- **A rout in about 2 turns.**
- Threat: Validar (Sorcerer, Grima's Truth), with a worst round of **18 / 41 HP on Chrom** and a **0%** chance to kill someone.
- Checks offered:
  - the back's EXP with no Dual Strike;
  - the lead's EXP when the back lands the kill;
  - Veteran on the back (5 vs 7 EXP).

## Entries

### P00-S1 · silent · cost: outcome
| | app | game |
|---|---|---|
| flawless chance, every one of 112 Robins | 0% ±0.0 | (untested) |

- **App says:** "No run gets through with nobody lost. Where the runs die: Chapter 19 (under 0.1%), Chapter 5 (16.6%) and Chapter 3 (51.2%)". After the lock it said Chapter 21 (0%), Chapter 19 (6.6%) and Chapter 3 (64.4%).
- **Touches:** Lunatic realism. These are known stated blind spots: no map positions, proc skills not played, one worst attacker per pair, class changes only between maps.
- **Gap:** with every option at 0%, the ranking the setup rests on (Robin, marriages, close calls) has **no signal**. There's no fallback measure, such as how far runs get, expected losses, or the chance of reaching each milestone. Every Robin decision here was made on 0.0 ±0.0 differences.
- **Then I:** followed the app's ordering anyway (S3).

### P00-S2 · friction · cost: time
- **App:** the Robin search screens all 112 options by "seed and ceiling", then **solves only 4** and asks you to "Carry on".
- **Gap:** after about 90 s it's unclear whether 4 of 112 is enough to act on, and nothing says what "Carry on" would buy when everything reads 0%.

### P00-S3 · wrong · cost: none (caught only by reading closely)
- **App:** the search labels **Male, +Str −Def, marrying Sumia** "the best", but the Lock button still offered the untouched default, **Female, +Str −Def** ("your Robin").
- **Gap:** a player who clicks "Lock Robin and start" locks a Robin the search didn't rank first. The button should follow the search's pick, or say that it doesn't.
- **Then I:** pressed Choose on the best Robin, then locked it.

### P00-S4 · friction · cost: none
- **App:** a fresh load lands on Roster with the play context on **All**. Setting Run facts → Route = Main story switched the play context itself.
- **Note:** this is fine, but a first-time player sees the whole explorer before any run question. Run facts are the real first step.

### P00-S5 · settled (to check in play) · cost: none
- **App:** Lucina's parents are **Chrom × Maiden**, and her passes are `aether` and **null**. The Maiden (the generic village spouse) passes nothing.
- **Why it's logged:** whether a Maiden-mothered Lucina can inherit anything at all is a game fact the app asserts. Settle it when Lucina joins.

### P00-S6 · friction · cost: none
- **App:** the Premonition's Prepare page shows the run-level **0% ±0.0** on the map's own card, next to "Kills someone 0%" for its only threat.
- **Gap:** on a map card, the headline reads as this map's chance. It should say it's the run's.

### P00-S7 · note · cost: none
- **The roadmap stores a lineup only for Endgame.** Per-map lineups (Premonition onward) are computed on the Prepare page from the adopted plan and the latest stats. So what the play sessions obey is **each map's Prepare page as shown at the time**, logged at the session's start, not this JSON.
