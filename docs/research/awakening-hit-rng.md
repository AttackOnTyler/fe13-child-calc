# Does Awakening roll hit with one random number or two?

Research for [#281](https://github.com/AttackOnTyler/fe13-child-calc/issues/281). Researched 2026-09-28.

## Answer

Two. Fire Emblem Awakening (FE13) is the last game in the "true hit" (2RN) line that began with The Binding Blade
(FE6): the game draws two random numbers from 0–99, averages them, and the attack hits if the average is below the
displayed Hit. So a displayed hit is **not** the true chance. High hits land more often than shown and low hits less
often: 70 is really 82.3%, 90 is 98.1%, 30 is 18.3%. Only 50 stays about the same (50.5%). The hybrid "1RN under 50,
weighted above" system belongs to Fates (FE14), not Awakening. Only the hit roll is 2RN. Crit, Dual Strike's trigger,
Dual Guard and skill procs (Luna, Sol, …) are single rolls against their shown rate in every 2RN game, and no source
says Awakening differs. So the app should run displayed Hit through the true-hit table wherever it turns Hit into a
chance (the lead's, the back's Dual Strike hit, and the foe's), and leave every other rate as it is.

## The true-hit formula

Hit if `(a + b) / 2 < H`, with `a`, `b` uniform on 0..99, which is the same as `a + b < 2H` over the 10,000 pairs. For an
integer displayed Hit `H`:

- `H ≤ 50`: true = `H · (2H + 1) / 10000`
- `H > 50`: true = `1 − (100 − H) · (199 − 2H) / 10000`

This was checked by brute force over all 10,000 pairs for H = 0..100. It matches Serenes Forest's table (e.g. 1 → 0.03%).

| Shown | 1 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 75 | 80 | 85 | 90 | 95 | 99 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| True % | 0.03 | 2.1 | 8.2 | 18.3 | 32.4 | 50.5 | 68.4 | 82.3 | 87.75 | 92.2 | 95.65 | 98.1 | 99.55 | 99.99 | 100 |

## Evidence

1. **Fire Emblem Wiki, "True hit"**: <https://fireemblemwiki.org/wiki/True_hit>. It says outright that true hit (2RN)
   started in The Binding Blade and is "featured in every game following up to and including *Awakening*". It
   describes Fates' system separately as a new hybrid of 1RN and 2RN: displayed Hit below 50 is 1RN, and 50 or above is
   one RN checked against a weighted function. The page doesn't cover crit, skill or pair-up rolls, and it doesn't say
   how Awakening was verified.
2. **Serenes Forest, "True Hit"**: <https://serenesforest.net/general/true-hit/>. This gives the mechanism (two RNs
   averaged, compared to Hit) and the full shown-to-true table. Its game list says FE6–12, and FE13 isn't named. The
   page looks like it was written before Awakening's release and never updated. It doesn't contradict Awakening being
   2RN, but it doesn't confirm it either.
3. **"How Fates Handles Hit Rates" (Silas, The Humble Grandmasters, 2016-04-26)**:
   <https://fire-emblem-strategy.tumblr.com/post/143452625727/how-fates-handles-hit-rates>. About 23,000 recorded Fates
   hit rolls, analysed statistically. It concludes "True Hit as we know it is, to 99.999999% confidence, dead", which
   means Fates broke from the FE6–13 averaged-two-RN model. It's an empirical study of Fates, not a disassembly. It
   treats FE13 as part of the old 2RN line, and nobody at the time pushed back on that.
4. **"Regarding Fate's Hit Rates" (tumblr, 2016)**:
   <https://maligknights.tumblr.com/post/147913423144/regarding-fates-hit-rates/amp>. Secondary. It says 2RN was the
   system from FE6 through Awakening, and gives the Fates formula (below 50: 1RN; 50 and above: `(3·RN1 + RN2)/4`).
5. **"Regarding True Hit" (The Humble Grandmasters, 2014)**:
   <https://fire-emblem-strategy.tumblr.com/post/80096189431/regarding-true-hit>. A strategy post from the Awakening era.
   It applies SF's true-hit table to "recent" games and notes that the crit chance per attack is **true hit × crit**. So
   only the hit roll is transformed, and crit is a separate plain roll after a hit.
6. **Fire Emblem Wiki, "Random number generator"**: <https://fireemblemwiki.org/wiki/Random_number_generator>. In the
   2RN games it documents the RN order as two RNs for hit, then **one** RN for crit if the attack hit, then one more for a
   crit-triggered skill (Silencer). This is the pattern behind "crit and skills are 1RN". The page has no Awakening
   section.
7. **Fire Emblem Wiki, "Offensive skill"**: <https://fireemblemwiki.org/wiki/Offensive_skill>. From Awakening onward an
   offensive skill can activate and still miss, which means the activation roll is separate from the hit roll. It gives
   the priority order but not the RN count.
8. **Serenes Forest, Awakening "Calculations"**: <https://serenesforest.net/awakening/miscellaneous/calculations/>. The
   Dual Strike rate is combined Skill / 4 + support + skill bonuses, and the Dual Guard rate is combined Def (or Res) / 4
   + bonuses. Skill priority is Lethality > Aether > Astra > Sol > Luna > Ignis > Vengeance. It says nothing about RN
   counts for any of them.

### What each chance is

| Chance | Roll | Evidence |
|---|---|---|
| Hit (lead, back's Dual Strike hit, foe) | **2RN averaged** | FEWiki True hit; SF table; the Fates studies treat FE13 as 2RN |
| Crit | 1RN, only after a hit lands | FEWiki RNG (2RN-era order); HGM 2014 (true hit × crit) |
| Dual Strike trigger (does the back attack) | 1RN against the formula rate (inferred) | No source gives the count. The rate is never shown in battle, so nothing suggests a transform |
| Dual Guard | 1RN against the formula rate (inferred) | Same as Dual Strike |
| Skill procs (Luna, Sol, Aether, …) | 1RN against the activation rate, one at a time in priority order (inferred) | FEWiki Offensive skill; SF Calculations for the order |

### Where sources disagree, or say nothing

- No source I found claims Awakening is 1RN or hybrid. People who think it's 1RN are usually thinking of Fates (1RN
  below 50), or Shadows of Valentia and later games, which aren't 2RN either.
- Serenes Forest's true-hit page lists FE6–12 only. It leaves FE13 out, but I read that as the page's age, not a
  counter-claim. FEWiki names Awakening explicitly.
- I found **no public disassembly or decompilation of Awakening's hit routine**. The 2RN claim rests on long-standing
  community consensus. It also rests on the 2016 Fates testers treating FE13 as the last 2RN game when they showed Fates
  was different. (Later technical write-ups, which FEWiki cites to Reddit user u/dee-ee, pinned down Fates' hybrid. That's a separate
  game, and I didn't read those posts.) The Awakening threads on
  the SF forums and GameFAQs (<https://forums.serenesforest.net/index.php?showtopic=36489>,
  <https://gamefaqs.gamespot.com/boards/643003-fire-emblem-awakening/65944391>) returned 403 to the fetcher and weren't
  read.
- Nothing states the RN count for crit, Dual Strike, Dual Guard or skills in Awakening specifically. "1RN" comes from
  the rule in every other 2RN game and from the absence of any contrary report. I found no empirical Awakening test
  either way.

## Confidence

- **Hit is 2RN:** high. It's consistent across FEWiki, the strategy community of the time and the Fates-era studies,
  and nothing contradicts it. It isn't at "confirmed from code" level.
- **Crit, Dual Strike, Dual Guard and skills are 1RN against the rate:** medium. This follows from convention and
  inference, not from an Awakening-specific source.

The app's own harness (`play/azahar-harness`, Ironman-honest runs) could raise the hit claim to "confirmed". Log the
displayed Hit and whether each strike landed over a few hundred strikes. Displayed 70–90 hits should land clearly more
often than shown (about 82–98%), and displayed 20–30 hits clearly less often (about 8–18%).

## What the app should change

Add one helper, e.g. `trueHit(displayed: number): number` (a probability from 0 to 1, using the formula above; it lives
wherever the engine keeps shared combat maths). Apply it **only** to hit rates, and always to the displayed integer Hit
after clamping to 0..100.

`src/engine/sim/exchange.ts` (`branches`, lines 169–176):

- `const hit = m.hit / 100;` becomes `trueHit(m.hit)`. This is the lead's hit.
- `const bHit = m.backHit / 100;` becomes `trueHit(m.backHit)`. This is the back's Dual Strike hit, an ordinary attack
  roll.
- `const fHit = m.foeHit / 100;` becomes `trueHit(m.foeHit)`. This is the foe's hit on the lead.
- **Unchanged:** `crit = m.crit / 100`, `bCrit = m.backCrit / 100`, `fCrit = m.foeCrit / 100`, `dual =
  m.dualStrikeRate / 100`, `guard = m.dualGuardRate / 100`. These are 1RN. The branch structure is also still right:
  crit is conditioned on a hit, and Dual Guard is rolled before the foe's hit.
- Everything that calls `exchange` picks this up automatically: `enemy-phase.ts:174` (`killChance`), `solve.ts:390–392`
  (the `miss` cost), and `safety.ts` (`deathChance`).

`src/engine/board/*.ts`:

- `enemy-phase.ts:176`: `expected: (m.worstHit * strikes * m.foeHit) / 100` becomes `m.worstHit * strikes *
  trueHit(m.foeHit)`. This expected damage ranks the enemy AI's targets, so the change can alter which target the AI is
  predicted to pick when rates differ.
- `board.ts:186` (`lands`, 'likely' = `hit >= 50`): **no change needed.** True hit is above 50% exactly when displayed
  Hit ≥ 50 (49 → 48.51%, 50 → 50.5%), so the "likeliest reading" threshold is still correct.
- `solve.ts:159–166` (`hit`, `crit`, `dualStrike`, `counterHit`, `counterCrit` on the attack summary): **keep
  displayed.** They're what the player sees in the game's forecast. If the UI shows a chance next to them, it should
  label the true figure separately.
- `safety.ts:68`: `p.hit * p.strikes` is damage per strike, not a rate. No change.

Outside the two named places, the same `/ 100` on a hit rate also appears in `src/engine/sim/loadout.ts:39` (a
loadout's hit) and `src/engine/sim/map-play.ts:1136` (`dualStrikeRate/100 * backHit/100`). There the `backHit` factor
becomes `trueHit(m.backHit)` and `dualStrikeRate` stays as it is. They should get the same treatment so the numbers
agree. Tests that pin exact exchange probabilities (e.g. `exchange` and `safety` tests) will need their expected values
recomputed.
