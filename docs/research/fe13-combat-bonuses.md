# How Awakening's pair-up, Dual Support and weapon triangle combine in a forecast

Research for #255 (map #253). Question: what the game adds to a combat forecast for pair-up, adjacent allies, the
weapon triangle and weapon rank, and how Dual Strike, Dual Guard and crit are computed. The rules are checked
against every Prologue forecast in the play log. `src/engine/solver.ts` (`matchup`) is compared with them at the end.

## Sources

- **[SF-Calc]** Serenes Forest, *Awakening: Calculations*, <https://serenesforest.net/awakening/miscellaneous/calculations/>
  (credits: FEA 2ch strategy wiki, FEA strategy wiki). This page gives the weapon triangle, weapon rank bonus, combat
  stats, forecast, Dual Strike and Dual Guard formulas. It says "Any fractions are omitted".
- **[SF-Pair]** Serenes Forest, *Awakening: Pair Up*, <https://serenesforest.net/awakening/miscellaneous/pair-up/>.
- **[SF-Dual]** Serenes Forest, *Awakening: Dual System*, <https://serenesforest.net/awakening/miscellaneous/dual-system/>
  (credits: FEA 2ch strategy wiki, MiruPage).
- **[SF-Skills]** Serenes Forest, *Awakening: Skills*, <https://serenesforest.net/awakening/miscellaneous/skills/>.
- **[Game]** The game's own forecasts on the Lunatic Prologue, captured on branch `play/azahar-harness` in
  `docs/play-log/p02-prologue.md`, `docs/play-log/p02-prologue/shots/` and `instances-t1.json`. All 30-odd numbers
  below are reproduced exactly by the formulas, so the forecasts confirm the SF rules and don't just illustrate them.

I found no datamined source (such as fire-editor-awakening) that states these formulas separately. The game's
forecasts are the check.

## 1. The rules

### 1.1 Combat stats (the unit's panel) [SF-Calc]

| Stat | Formula |
|---|---|
| Attack | Str (or Mag) + weapon Mt (×3 if effective) + **weapon rank bonus** |
| Hit | weapon Hit + ⌊(Skl × 3 + Lck) / 2⌋ + **weapon rank bonus** |
| Crit | weapon Crit + ⌊Skl / 2⌋ |
| Avoid | ⌊(Spd × 3 + Lck) / 2⌋ |

Each term is floored ("fractions are omitted"). The stats here already include pair-up bonuses (see 1.4).

**Weapon rank bonus** [SF-Calc]. This applies at rank C or above, with a matching weapon equipped:

| Kind | C | B | A |
|---|---|---|---|
| Sword | Atk +1 | Atk +2 | Atk +3 |
| Lance, Bow, Tome | Atk +1 | Atk +1, Hit +5 | Atk +2, Hit +5 |
| Axe | Hit +5 | Hit +10 | Atk +1, Hit +10 |

SF: "the Weapon Rank bonus is cancelled when facing an enemy who has a weapon triangle advantage." The forecasts
show the cancellation removes both the Atk and the Hit part (see 2.3). SF lists no S column.

### 1.2 Weapon triangle [SF-Calc]

Sword > Axe > Lance > Sword. The size is set by **the advantaged side's weapon rank**, and applies both ways (a bonus for
the advantaged side, the same penalty for the other):

| Advantaged side's rank | Advantage | Disadvantage |
|---|---|---|
| E or D | Hit +5 | Hit −5 |
| C | Hit +10 | Hit −10 |
| B | Hit +10, Atk +1 | Hit −10, Atk −1 |
| A | Hit +15, Atk +1 | Hit −15, Atk −1 |

So the disadvantaged side loses **triangle Atk (up to 1) plus its whole rank bonus**. A lance at rank B against an
A-rank axe is 2 under its panel Attack, and 20 under its panel Hit (15 from the triangle and 5 from the cancelled rank
bonus).

### 1.3 The forecast [SF-Calc]

- Damage = Attack + triangle − (foe Def or Res + terrain)
- Hit = Hit + triangle + Dual Support hit − (foe Avoid + terrain + foe's Dual Support avoid)
- Crit = Crit + Dual Support crit − (foe Lck + foe's Dual Support crit avoid)

Skills that change combat stats are applied in the forecast [SF-Calc], for example:
- **Gamble**: Hit −5, Crit +10 [SF-Skills]. It only applies to the Gamble unit's own attacks.
- **Outdoor Fighter**: Hit and Avoid +10 when fighting outdoors [SF-Skills]. Frederick has it, and the Prologue counts
  as outdoors (see 2).

Crit avoid is simply **Lck** (including the Lck from pair-up) plus the Dual Support crit-avoid. There is no Lck/2 or
other term.

### 1.4 Pair-up: stats from the back [SF-Pair]

Pair-up bonus = the back's stat bonus + the back's class bonus + a support-level bonus. There is no HP bonus.
- **Stat bonus**: +1 for each of the back's raw stats that is 10–19, +2 for 20–29, and +3 for 30 or more.
- **Class bonus**: a fixed table. For example, Lord gives Spd +3 and Lck +3, and Great Knight gives Str +3, Def +3 and Mov +1.
- **Support level**: +1 to every non-zero class modifier at C or B, and +2 at A or S (Mov excluded).

Only the paired back gives stat bonuses. An adjacent ally gives none.

### 1.5 Dual Support: hit, avoid, crit and crit avoid [SF-Dual]

When the lead fights with a paired back **or** any adjacent ally, it gets bonuses by **total support rank**. Each partner
counts: none = 1, C = 2, B = 3, A = 4, S = 5. **Ranks add up across the paired back and every adjacent ally**, +4 if the
lead or its Support unit has Dual Support+, with a cap of 12.

| Total rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hit + | 10 | 10 | 10 | 10 | 15 | 15 | 15 | 15 | 20 | 20 | 20 | 20 |
| Avoid + | 0 | 10 | 10 | 10 | 10 | 15 | 15 | 15 | 15 | 20 | 20 | 20 |
| Crit + | 0 | 0 | 0 | 10 | 10 | 10 | 10 | 15 | 15 | 15 | 15 | 20 |
| Crit avoid + | 0 | 0 | 10 | 10 | 10 | 10 | 15 | 15 | 15 | 15 | 20 | 20 |

So:
- **They stack.** A paired back plus an adjacent ally, both with no support, is rank 2: Hit +10 and **Avoid +10**. The
  back alone gives no avoid.
- **A partner with no support rank still gives Hit +10**, but no avoid, crit or crit avoid until rank 2 (avoid) or
  rank 3 (crit avoid).
- To cut a foe's crit through Dual Support, you need total rank 3 or more (+10 crit avoid): for example a C-support back
  plus one adjacent ally, or a B-support partner.

### 1.6 Dual Strike and Dual Guard: one partner only [SF-Dual], [SF-Calc]

Only one partner, the **Support unit**, can Dual Strike or Dual Guard. That is the paired back if there is one.
Otherwise it is "the adjacent ally whom they share the highest support level with" [SF-Dual].

- **Dual Strike rate** = ⌊(lead Skl + Support Skl) / 4⌋ + 20 / 30 / 40 / 50 / 60 (none / C / B / A / S) + 10 if either
  has Dual Strike+. It is rolled on each of the lead's attacks, brave hits included, up to 4 per fight. A Support unit
  with no weapon (a staff-only Cleric) can't strike, and the forecast shows 0%.
- **Dual Guard rate** = ⌊(lead Def + Support Def) / 4⌋ (Res against magic) + 0 / 2 / 5 / 7 / 10 + 10 if either has
  Dual Guard+. It is rolled each time an enemy attack lands, and blocks all of that attack's damage.

### 1.7 Enemy phase, and "Guard Stance"

Awakening has **no stances**. Attack Stance and Guard Stance are Fates mechanics. In Awakening the same rules hold on
both phases: the defending lead gets Dual Support from its back and every adjacent ally, its Support unit may Dual Guard
each attack that lands, and SF's Dual Strike rule ("each time the Lead unit attacks") has no phase condition.

**Open point:** Chrom, as the back at 35%, did not Dual Strike once in about ten Prologue combats (P02-E1). Only about 5
of those were player-phase attacks. If enemy-phase counters could Dual Strike, ten misses would be a ~1.3% event; on
player phase alone, five misses is ~12%. That is weak evidence that counters don't Dual Strike, but SF doesn't say
so. **Verify with a save state:** counter on enemy phase with a high-DS pair and reload a few times.

## 2. The Prologue forecasts, number by number

Setup: Frederick (Great Knight Lv 1: Str 13, Skl 12, Spd 10, Lck 6, Def 14, Res 3; Lv 2: Str 14, Skl 13, Spd 11,
Res 4) leads, with Chrom behind (Lord Lv 1: Str 7, Skl 8, Spd 8, Lck 5, Def 7, Res 1; Dual Strike+). There's no
support rank. Frederick carries a Silver Lance (Mt 13, Hit 75, Crit 0).

- **Pair-up from Chrom**: every Chrom stat is under 10, so the stat bonus is 0. The Lord class bonus is **Spd +3, Lck +3**,
  so Frederick fights with Spd 13 (14 at Lv 2) and Lck 9.
- **Frederick's lance rank is B**: panel Attack is 13 + 13 + 1 = **27** (Lv 2: 28), and he gets the triangle's +1 Atk
  against swords (needs B or higher).
- **Frederick's panel numbers**: Hit = 75 + 5 (rank B) + ⌊(36 + 9)/2⌋ = 22 → 102 (Lv 2: ⌊(39 + 9)/2⌋ = 24 → 104).
  Avoid = ⌊(39 + 9)/2⌋ = 24 (Lv 2: ⌊(42 + 9)/2⌋ = 25). Crit = ⌊12/2⌋ = 6 (Lv 2: 6).
- **The situational terms**: Outdoor Fighter gives +10 Hit and +10 Avoid. Chrom alone (rank 1) gives +10 Hit.
- **Every Prologue enemy shows weapon rank A** on its panel (the rank icon beside the weapon kind), even Lv 1 base-class
  Ruffians.

### Frederick's attacks

| Forecast | Game | Formula |
|---|---|---|
| vs Myrmidon (Iron Sword, Def 1, Avo 23), Lv 1 | **27** dmg / **100%** / **0%** | 27 + 1 (tri B) − 1 = 27. Hit 102 + 10 (tri B) + 10 (Chrom) + 10 (OF) − 23 = 109 → 100. Crit 6 − 10 → 0 |
| vs Elwind Mage (Def 0, Avo 17), Lv 1 | **27** / **100%** / **0%** | 27 − 0 (no triangle). Hit 102 + 10 + 10 − 17 = 105 → 100. Crit 6 − 8 → 0 |
| vs Elthunder Mage (Def 0), Lv 1 | **27** / **100%** / **0%** | as above |
| vs Barbarian (Iron Axe at A, Def 1, Avo 16), Lv 1 | **24** / **86%** / **1%** | 27 − 1 (rank cancelled) − 1 (tri A) − 1 = 24. Hit 102 − 5 (rank cancelled) − 15 (tri A) + 10 + 10 − 16 = 86. Crit 6 − 5 = 1 |
| vs Barbarian, Lv 2 (T9) | **25** / **88%** / **1%** | 28 − 2 − 1 = 25. Hit 104 − 5 − 15 + 20 − 16 = 88. Crit 6 − 5 = 1 |
| vs Garrick (Short Axe at A, Def 3, Avo 20), Lv 2 | **23** / **84%** / **1%** | 28 − 2 − 3 = 23. Hit 104 − 20 + 20 − 20 = 84. Crit 6 − 5 = 1 |

The −2 against axes and the +1 against swords that #250 reported are **the triangle's ±1 Atk (at B/A rank) plus the
loss of Frederick's +1 lance-rank Attack when the axe has the advantage**.

### The enemies' attacks on Frederick

Enemy panel stats include their rank-A bonus:
- Myrmidon: Atk 9 + 5 + 3 = **17**, Hit 95 + ⌊(33 + 10)/2⌋ = **116**.
- Barbarian: Atk 11 + 7 + 1 = **19**, Hit 75 + 10 + 10 = **95**, Crit ⌊5/2⌋ = **2**.
- Garrick: Atk 14 + 7 + 1 = **22**, Hit 65 + 14 + 10 = **89**, Crit **4**.
- Elwind Mage: Atk 10 + 4 + 2 = **16**, Hit 95 + 16 + 5 = **116**.
- Elthunder Mage: Atk 10 + 6 + 2 = **18**, Hit 75 + 16 + 5 = **96**, Crit 5 + 4 = **9**.

Every one matches the game's panels.

Frederick's avoid in combat: 24 + 10 (Outdoor Fighter) = **34** at Lv 1, **35** at Lv 2. His crit avoid is **9** (Lck
6 + Chrom's +3).

| Forecast | Game | Formula |
|---|---|---|
| Myrmidon → Frederick | **0** / **72%** / **0%** | 17 − 3 (rank cancelled) − 1 (tri, Frederick's B) − 14 → 0. Hit 116 − 10 − 34 = 72. Crit 5 − 9 → 0 |
| Elwind Mage → Frederick | **13** / **82%** / **0%** | 16 − Res 3 = 13. Hit 116 − 34 = 82. Crit 4 − 9 → 0 |
| Elthunder Mage → Frederick | **15** / **62%** / **0%** | 18 − 3 = 15. Hit 96 − 34 = 62. Crit 9 − 9 = 0 (**Chrom's +3 Lck is what takes it to 0**; alone it would be 3%) |
| Barbarian → Frederick, Lv 2 (T9) | **6** / **75%** / **0%** | 19 + 1 (tri A) − 14 = 6. Hit 95 + 15 − 35 = 75. Crit 2 − 9 → 0 |
| Barbarian → Frederick, Lv 1 (T3) | **6** / **66%** / **0%** | 6 as above. Hit 95 + 15 − 34 = 76 by the formula, but the game shows **66**: 10 more avoid. That is what an **adjacent ally on top of Chrom** gives (total rank 2 → Avoid +10). The log doesn't record the tiles, but the Barbarian at (5,12) had just hit Robin, and the plain tiles there give no terrain avoid. This is consistent with 1.5, not proven |
| **Garrick → Frederick, Lv 2** | **9** / **64%** / **5%** | 22 + 1 (tri A) − 14 = 9. Hit 89 + 15 (tri A) − 5 (**Gamble**) − 35 = 64. **Crit 4 + 10 (Gamble) − 9 = 5** |

**Garrick's 5% crit is Gamble.** Without Gamble it would be 0 (4 − 9). The only ways to cut it are more crit avoid:
- more Lck on Frederick (a back with Lck 10+ or a Lck class bonus);
- Dual Support crit avoid, which needs **total support rank 3 or more**: for example Chrom (rank 1) plus two adjacent
  allies, or any partner at B. That gives +10 crit avoid, and 5 → 0.

Chrom alone at no support can't do it, and one adjacent ally (rank 2) adds only avoid.

### Dual Strike, Dual Guard, and an adjacent partner

| Forecast | Game | Formula |
|---|---|---|
| Frederick + Chrom DS, Lv 1 / Lv 2 | **35%** | ⌊(12 + 8)/4⌋ = 5 (Lv 2: ⌊21/4⌋ = 5) + 20 (no support) + 10 (Chrom's Dual Strike+) = 35 |
| DG vs physical | **5%** | ⌊(14 + 7)/4⌋ = 5 + 0 |
| DG vs a Mage | **1%** | ⌊(3 + 1)/4⌋ = 1 (Lv 2: ⌊(4 + 1)/4⌋ = 1) |
| Robin (Thunder) with Lissa **adjacent**, vs Barbarian (Res 0, Avo 16, Lck 5) | **8** / **83%** / **2%**, DS **0%**, DG **2%** | Robin panel: Atk 5 + 3 = 8, Hit 80 + ⌊(15 + 4)/2⌋ = 89, Crit 5 + 2 = 7. Hit 89 + 10 (Lissa, rank 1) − 16 = 83. Crit 7 − 5 = 2. **DS 0: Lissa has only a staff.** DG ⌊(5 + 3)/4⌋ = 2 |

The Robin row confirms that an **adjacent ally with no support gives Hit +10** and can Dual Guard.

## 3. Where `src/engine/solver.ts` differs (main at `7c3a854`)

Most important first:

1. **Triangle damage is missing** (`matchup`: `5 * tri` in `hit` and `foeHit`, and nothing in `attack` or `worstHit`).
   The game adds ±1 Atk when the advantaged side's rank is B or A. This applies to the lead, the foe and the dual
   strike (`backDamage`, `backHit`).
2. **Triangle hit is always ±5** (`5 * tri`). The game uses ±5 / ±10 / ±10 / ±15 by the advantaged side's rank
   (E–D / C / B / A). The header comment ("±5 Hit at the advantaged side's E/D rank, taken at its smallest, a cautious
   reading") is the smallest case, and it isn't cautious for the side at a disadvantage.
3. **Rank bonus isn't cancelled on the disadvantaged side** (`rankBonus` is always added). The game drops the loser's
   whole rank bonus, Atk and Hit. Items 1–3 together are #250: the app's 24 vs Garrick should be 22 at Lv 1 (23 at Lv 2).
4. **Foe weapon ranks are too low** (`rankBonus(..., foe=true)`: A only for advanced classes, else the weapon's own
   rank). Every Lunatic Prologue foe, Lv 1 base-class Ruffians included, has rank **A**. So the app reads the Myrmidon's
   Atk as 14 (game 17), the Barbarian's as 18 (19), Garrick's as 21 (22) and the Mages' as 2 lower. Their Hit is also
   5–10 low. Worst-hit and survival are optimistic: the app's "worst round 7 / 28" vs Garrick is 9 in the game (+1 rank,
   +1 triangle). Where foe ranks come from (class, difficulty or ROM) needs a follow-up, and `instances-t1.json` doesn't
   carry them yet.
5. **Gamble isn't applied** (no `Gamble` in `solver.ts`). The foe's Hit should be −5 and its Crit +10. **The app
   shows Garrick's crit on Frederick as 0%; the game shows 5%.** `foeCrit` = 4 − 9 → 0, missing the +10.
6. **Outdoor Fighter isn't applied** (only `Hit Rate +20`, `Avoid +10`, faires and breakers are read). It adds Hit and
   Avoid +10 outdoors. This needs an outdoor/indoor flag per map (the Prologue is outdoors). For now the app
   under-counts both Frederick's hit and his avoid by 10.
7. **Dual Support counts one partner only** (`dualSupport(SUPPORT_RANK[support])`). The game sums the paired back and
   every adjacent ally, caps at 12, and adds +4 for Dual Support+ (not read). Note that `dualSupport` itself, `SUPPORT_RANK`
   and the table match SF exactly.
8. **Foes never get Dual Support.** Adjacent or paired enemies aren't modelled. This is fine for the Prologue: no foe
   forecast showed a support term. SF's pages describe the player side only, so whether enemy adjacency works the
   same way is **unverified**.
9. **Rounding**: the app floors only the final sum (`clamp` → `Math.floor`). The game floors each term
   (⌊(Skl×3+Lck)/2⌋, ⌊(Spd×3+Lck)/2⌋, ⌊Skl/2⌋). Where a hit term is whole and the avoid term has a .5, the app is 1
   low: for example 22 − 20.5 = 1.5 → 1 in the app, but 22 − 20 = 2 in the game.

**Already right:**
- `STRIKE_BY_SUPPORT` (20/30/40/50/60), `GUARD_BY_SUPPORT` (0/2/5/7/10), and the +10 for Dual Strike+ and Dual Guard+
  match [SF-Calc] and [SF-Dual]. They reproduce the game's 35% / 5% / 1%.
- The pair-up stat, class and support bonuses (`pairUpBonus`, Lord Spd/Lck +3).
- Crit avoid = Lck + Dual Support crit avoid.
- The rank-bonus table (`RANK_BONUS`).
- A unit's own rank read as the rank its weapon needs happens to be right for Frederick (Silver Lance, B).

The Dual Guard rate uses raw Def (`lead.stats`, not `st()`), and SF says "combined Def". The Prologue can't tell the two
apart, because Chrom adds no Def.

## 4. Open points

- Can counters Dual Strike on enemy phase (1.7)? Test it with a save state.
- Where foes' weapon ranks come from. On the Lunatic Prologue every foe shows A; check Normal and later maps. The ROM
  person/class data is the likely source (see `research/fe13-map-terrain`, `research/awakening-state-capture`).
- The S-rank rank bonus and triangle, which SF doesn't list (the app reads S as A).
- Whether enemies get Dual Support from adjacent enemies.
- Which tiles count as outdoors, for Outdoor Fighter and Indoor Fighter.
