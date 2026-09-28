# P01 · Premonition: Invisible Ties (Lunatic Classic)

Ticket: "Play the Premonition" (#234), map #224. Setup and baseline: [p00-setup.md](p00-setup.md).

**Result:** cleared in **3 turns** with no deaths and no harness resets. The app predicted about 2. Saved to **slot 2** (`Chapter1`) at the post-map prompt and recorded in the app, which reported *0% → 0%* and no improvement from the re-solve.

**Evidence:**
- screenshots in [`p01-premonition/shots/`](p01-premonition/shots/)
- turn-1 bookmark instances: [`instances-t1.json`](p01-premonition/instances-t1.json)
- post-map snapshot: [`snapshot-after.json`](p01-premonition/snapshot-after.json)
- grid: `src/game-data/maps/premonition.ts` (terrain `023`), from #237

## What the app said, at the session's start

This is the Prepare page, which is what the session obeys.

- **Lineup:** Chrom leads, Robin (M) backs, both forced.
- **Stance plan:** "T1–2 side by side in Attack Stance 10% of the time, else apart."
- **Headline:** "0% ±0.0 · about 2 turns · a rout in 2 turns."
- **Threat:** Validar, with a worst round of 18 / 41 on Chrom and a 0% chance to kill someone.
- **Matchup, Chrom + Robin vs Validar:**

| Weapon | Dmg | One round | Dual strike | Doubling | Worst round / HP | Hit / Crit | Foe hit / crit |
|---|---|---|---|---|---|---|---|
| Silver Sword | 18×2 | ✓ w/ DS | 28% | 2× | 18 / 41 | 100 / 0 | 72 / 0 |

## Play, turn by turn

- **T1:** Chrom moved (2,5) → (7,5) and waited. Robin moved (3,4) → (6,4), not adjacent, and waited. Validar didn't act.
- **T2:** Chrom moved to (12,5) and attacked with the Silver Sword. The forecast showed Atk 18, hit 94%, **no ×2**; Validar Atk 21, hit 82%. Chrom hit once (Validar 39 → 21), and **Validar's counter hit Chrom for 21 (41 → 20)**. Robin moved to (11,4) and waited.
- **T3:** Chrom at 20 HP attacking first would be 18 damage against Validar's 21 HP, then an 82% counter for 21, which is a **game over 82% of the time**. **I deviated** (protocol #228: the game showed a risk the app didn't flag). Robin went to (11,5) and cast Thoron: 17 damage at 85% hit, with Chrom adjacent (28% Dual Strike, 7% Dual Guard). It hit (Validar 21 → 4). The counter did 18 to Robin (38 → 20). Chrom then attacked at 18 damage and 100% hit, and killed Validar. Stage complete.

## Entries

### P01-T2a · wrong · cost: outcome (a near game over)
| | app | game |
|---|---|---|
| Chrom doubles Validar | 2× (18×2) | **no**: Spd 15 vs 13; one hit |
| Validar's round on Chrom | 18 / 41 | **21** / 41 |
| Chrom's hit | 100 | **94** (apart) / 100 (Robin adjacent) |
| Validar's hit on Chrom | 72 | **82** |
| one round kills | ✓ w/ DS | no: 18 < 39, and no Dual Strike while apart |
| turns to rout | about 2 | **3** |
| chance someone dies | 0% | naive play (Chrom attacks on T3) → 82% game over |

- **Why trace:** the Prepare page's matchup row and threat row.
- **Touches:** the matchup and combat math (doubling, damage against Res), and the stance plan's consistency with the matchup.
- **Evidence:** `t2-forecast-chrom-silver.jpg`, `t2-validar-after-18.jpg`, `t3-chrom-20hp-after-counter.jpg`.
- **Suspect (a hunch, not a claim):** the matchup assumes the pair *together*, with Robin's pair-up and support bonuses (hit +6, foe hit −10, Res), while the stance plan says *apart*. Doubling 2× fits neither case: paired, Chrom's Spd 17 against 13 still falls short of the +5 needed.
- **Then I:** deviated on T3 (Robin first, Chrom finishing).

### P01-T3 · silent · cost: outcome
- **App:** the stance plan stops at T2 ("T1–2 …"). For T3 it had nothing: no turn order, no warning that Chrom attacking first can die.
- **Gap:** when the rout runs past the plan's horizon, the page goes silent. It also has no per-action danger check ("attacking now leaves the lead at X HP against a counter of Y").

### P01-S1 · settled · confirms
- **Robin (M, +Str −Def) on the Premonition:** HP 38, Str 18, Mag 14, Skl 15, Spd 13, Lck 16, Def 14, Res 17. This matches the chapter data's recruit row and its asset/flaw notes (Str "18 if asset", Def "14 if flaw", others neutral).
- **Touches:** `chapter.premonition.recruit.robin.*`, and the per-stat asset/flaw base rule from #237: asset Str +2 (the "other" rule) and flaw Def −1. **This is the first on-screen check of a Str asset.**
- **Evidence:** `t1-robin-stats.jpg`.

### P01-S2 · settled · confirms
- **Chrom on the Premonition:** HP 41, Str 20, Mag 3, Skl 17, Spd 15, Lck 18, Def 20, Res 14. Falchion and Silver Sword (30 uses). Matches `chapter.premonition.recruit.chrom`.
- **Evidence:** `t1-chrom-stats.jpg`.

### P01-S3 · settled · confirms
- **Validar (Lunatic):** Sorcerer Lv 5, HP 39, Str 5, Mag 21, Skl 15, Spd 13, Lck 12, Def 15, Res 12, Grima's Truth. Game Atk 35, so Grima's Truth has Mt 14. Didn't move or initiate on T1–T3, matching "Does not initiate combat". The bookmark position (13,5) matches the ROM placement.
- **Matches:** the chapter data's Lunatic group 0, and the app's matchup header.
- **Evidence:** `t1-validar-stats.jpg`, `instances-t1.json`.

### P01-S4 · settled · confirms
- **Dual Strike 28%, Dual Guard 7%** with Chrom (Lv 20 Lord) adjacent to Robin, and the reverse. The app said 28%.
- **Evidence:** `t3-forecast-robin-thoron.jpg`, `t3-forecast-chrom-finish.jpg`.

### P01-S5 · wrong · cost: time
- **App:** "Checks Premonition offers" lists three EXP checks: the back's EXP with no Dual Strike, the lead's EXP when the back kills, and Veteran on the back.
- **Game:** Premonition units are map-only Lv 20 units with **EXP "–"** and gain no EXP, so none of the checks can happen here. I recorded all three as "Didn't happen".
- **Gap:** the check offer ignores map-only or EXP-less units.

### P01-N1 · note
- **The save prompt comes after the Premonition,** and the Prologue starts from it. The snapshot after the map is unchanged from before, apart from chapters cleared (Robin Lv 1, 19 HP), as expected: nothing carries over.
- **Record results worked cleanly** for a map with no deployables. The eight steps ran with no friction.

## Batch

Filed at the end of this map, per #227: the gaps from P00 and P01, grouped by root cause. Settled rows wait for "Observed-play evidence" (#235) to register as observed play.

- #239 Matchup shows Chrom doubling Validar and an 18-damage worst round; the game shows one hit and 21 (P01-T2a)
- #240 Prepare page goes silent past its stance plan, with no lethal-counter warning (P01-T3)
- #241 "Lock Robin and start" locks the untouched default Robin (P00-S3)
- #242 With every Lunatic plan at 0% ±0.0, setup decisions have no signal (P00-S1, S2)
- #243 In-play checks are offered for units that can't gain EXP (P01-S5)
- #244 A map's Prepare card headlines the run's flawless chance (P00-S6)
- Not filed: P00-S4 (first-load order; fine as is), P00-S5 (to settle when Lucina joins), P00-S7 (a note).

## Resume

Next is **Prologue: The Verge of History**, from slot 2. Per protocol #228, **play waits until this batch's issues land**; then the run's app (`127.0.0.1:5247`) gets main pulled and re-solves.
