# What are Awakening's EXP rules?

Resolves #138 (part of #136, Map: Endpoint-first planning). Researched 2026-09-25 against `origin/main` at `6b22510`.

This is a findings file, not a data file. It covers the EXP a unit earns from combat, staves and Dance, the hidden internal level behind every formula, how Master and Second Seals move it, caps, difficulty, and pair-up. It feeds the EXP forecast ([#146](https://github.com/AttackOnTyler/fe13-child-calc/issues/146)). Fire Emblem Wiki (FEW) pages are cited by the `oldid` read. Serenes Forest (SF) and the Japanese wikis were read on 2026-09-25.

## Summary

- **Every formula keys on one number, the level difference:** `LD = foe's level (+20 if the foe is in an advanced class) − the unit's internal level`. **Internal level** is hidden: `displayed level (+20 if the unit is in an advanced class) + cumulative level`. Special classes (Villager, Dancer, Taguel, Manakete, Lodestar, Dread Fighter, Bride, Conqueror) count as unpromoted for both sides.
- **What earns EXP** (equal level, first engagement):
  - A combat where the unit deals **no damage**: 0.
  - **Damage without a kill**: 10.
  - **A kill**: 30. That's the damage part plus 20.
  - **A boss kill**: 50 (+20).
  - Some classes carry a **class bonus**: Thief, Assassin, Trickster and Conqueror +20; Revenant and Entombed +80; Troubadour, Cleric and Priest −10.
  - **Staves** give a fixed base per staff: Heal 17, Mend 22, Physic 30, Recover 40, Fortify 60.
  - **Dance** gives 17. Both staves and Dance fall slowly with internal level.
  - **Rally:** no source gives it any EXP (gap).
- **Level difference is steep upward and flat downward.**
  - Each level the foe is above the unit adds about 3 to a kill.
  - From 3 levels above the foe, a kill falls about 3 per level, down to 15 at 7 levels above.
  - After that it falls 1 per 3 levels, to a floor of 8 (1 damage + 7 kill) at 28 levels above.
  - At 13+ levels above, even the boss bonus disappears.
- **Master Seal** (base class, level 10–20) resets the displayed level to 1 in an advanced class. Internal level becomes 21 + cumulative, **the same whether the unit promoted at 10 or at 20**. **Second Seal** also resets the displayed level to 1. It adds `floor((displayed level + 20 if advanced − 1) / 2)` to the cumulative level, which never goes down. The cumulative level counts up to **20 on Normal, 30 on Hard, 50 on Lunatic/Lunatic+**.
- **Difficulty** changes only three things:
  - **Lunatic(+) repeat penalty:** from the 4th engagement with the same foe, damage EXP falls by 1 per engagement, down to 0.
  - **Staff unpromoted bonus:** +8 Normal, +3 Hard, 0 Lunatic.
  - **The cumulative cap** above.
  - Lunatic and Lunatic+ are identical for EXP. The kill and damage formulas are the same on every difficulty (C6).
- **Caps:** 100 EXP per level. Level cap 20 in base and advanced classes, 30 in special classes. One combat gives at most 100 (FEW).
- **Pair Up:** a paired **Battery earns EXP only from its own Dual Strikes that deal damage**. It gets half its damage EXP, or all of it if its strike kills, and never kill EXP. It computes that from its own internal level. **Veteran** ×1.5 applies when the holder leads a pair (C4). **Paragon** (DLC) ×2.
- **Cross-check.** SF and FEW agree on every formula and all 12 staff values, but FEW cites SF for the formulas, so they aren't independent there. The independent check is recorded play on the Japanese 2ch wiki (SF's own upstream): a 32-row Lunatic kill table, 5 Hard same-level values and 3 reclass experiments. **All of them match SF's formulas exactly** (§4.3). There are 6 disagreements (C1–C6):
  - C1 matters to whoever implements this: FEW's formula, read literally, drops the Thief-line bonus. It's resolved in SF's favour.
  - Of the rest, only C4 (Veteran) touches a Lunatic story-map forecast.
- **Gaps:**
  - Rally EXP.
  - Whether the Lead still gets kill EXP when its Battery's Dual Strike lands the kill.
  - Whether the EXP bar survives a seal.
  - Rounding of the ×0.5, ×1.5 and ×2 factors.
  - How Lunatic counts engagements.
  - No datamine exists. Every source is measured play (§6).

## 1. Formulas

Division drops fractions ("Any fractions are omitted", SF calculations). All the values here are non-negative, so that's `floor`.

### 1.1 Terms

| Term | Definition | Source |
|---|---|---|
| **Internal level (IL)** | `displayed level + promotion bonus + min(cumulative level, cap)` | SF calculations; FEW Experience §Internal levels (oldid 772527, cites SF); Pegasus Knight クラスチェンジ; JP-2ch CCまとめ |
| **Promotion bonus** | 20 in an advanced class, 0 in a base or special class | SF; FEW; JP-2ch ("Lv1-40 through base and advanced") |
| **Cumulative level** | 0 at first. Each Second Seal adds `floor((displayed level + promotion bonus − 1) / 2)`, taken at the moment of use | SF; FEW; Pegasus Knight; JP-2ch |
| **Cumulative cap** | 20 Normal, 30 Hard, 50 Lunatic/Lunatic+. Applied when EXP is calculated: a 2022 JP-2ch comment reports the stored value runs to 200 | SF; FEW; JP-2ch 難易度・モード, CCまとめ |
| **Level difference (LD)** | `foe level + foe promotion bonus − unit IL` | SF; FEW |
| **T** | Engagements with this foe so far, this one included | SF ("number of times the same enemy has been attacked"); FEW ("number of times the player attacked the enemy") |

### 1.2 Combat

```
damageExp(LD, T) =
    base = LD >= -1 ? floor((31 + LD) / 3)
                    : max(floor((33 + LD) / 3), 1)
    max(base - repeat(T), 0)
    // repeat(T) = max(T - 3, 0) on Lunatic / Lunatic+, 0 otherwise

killExp(LD, bonus) =
    LD >= 0   ? 20 + 3*LD + bonus
    LD == -1  ? 20 + bonus
    otherwise   max(26 + 3*LD + bonus, 7)

bonus = (unitBonus defined ? min(unitBonus + classBonus, unitBonus) : classBonus)
        + (foe is a boss ? 20 : 0)
```

| The unit, in one combat… | EXP |
|---|---|
| deals no damage (all misses, or 0-damage hits) | **0** (SF; FEW "Shadow Dragon through Engage: 0") |
| damages the foe, which survives | `damageExp` |
| kills the foe | `min(damageExp + killExp, 100)`. FEW gives the maximum of 100. SF gives no maximum |
| **Battery**, its Dual Strike dealt damage and didn't kill | `floor(damageExp × 0.5)` with the Battery's own LD (SF "Experience for Support unit", kill factor 0.5) |
| **Battery**, its Dual Strike landed the kill | `damageExp` (kill factor 1). No kill EXP |
| **Battery**, no Dual Strike, or its strike missed or did 0 damage | 0 (Pegasus Knight 計算式 comment, 2012; Fire Emblem WoD; see G3) |

The formulas carry no phase term. A counter-kill on enemy phase earns what a player-phase kill does.

**Bonus values** (SF calculations; FEW Experience):

| Bonus | Value |
|---|---|
| Boss | +20 |
| Class: Thief, Assassin, Trickster, Conqueror | +20 (FEW also lists Grima: C2) |
| Class: Revenant, Entombed | +80 |
| Class: Troubadour, Cleric, Priest | −10 |
| Unit: Deadlords (Ch 22, Infinite Regalia), Einherjar | +20. With the `min`, an Einherjar Thief still gets +20 in all, and an Einherjar Cleric +10 |
| Unit: Harvest Scramble foes other than the boss | 0, which cancels their positive class bonus (SF only: C3) |

**Reference values** (no class or unit bonus, first engagement). They double as test vectors:

| LD | Damage | Kill | Boss kill | Battery (damaging Dual Strike, no kill) |
|---|---|---|---|---|
| +10 | 13 | 63 | 83 | 6 |
| +8 | 13 | 57 | 77 | 6 |
| +6 | 12 | 50 | 70 | 6 |
| +5 | 12 | 47 | 67 | 6 |
| +4 | 11 | 43 | 63 | 5 |
| +3 | 11 | 40 | 60 | 5 |
| +2 | 11 | 37 | 57 | 5 |
| +1 | 10 | 33 | 53 | 5 |
| 0 | 10 | 30 | 50 | 5 |
| −1 | 10 | 30 | 50 | 5 |
| −2 | 10 | 30 | 50 | 5 |
| −3 | 10 | 27 | 47 | 5 |
| −4 | 9 | 23 | 43 | 4 |
| −5 | 9 | 20 | 40 | 4 |
| −6 | 9 | 17 | 37 | 4 |
| −7 | 8 | 15 | 33 | 4 |
| −8 | 8 | 15 | 30 | 4 |
| −10 | 7 | 14 | 23 | 3 |
| −12 | 7 | 14 | 17 | 3 |
| −13 | 6 | 13 | 13 | 3 |
| −16 | 5 | 12 | 12 | 2 |
| −20 | 4 | 11 | 11 | 2 |
| −22 | 3 | 10 | 10 | 1 |
| −25 | 2 | 9 | 9 | 1 |
| −28 and below | 1 | 8 | 8 | 0 |

The boss bonus sits inside the `max(…, 7)`. A unit 13 or more levels above a boss gets no more for it than for a regular foe.

### 1.3 Staves and Dance

```
staffExp = max(staff.base - floor(max(IL - 5, 0) / 3) + unpromotedBonus + quirk(IL), 1)
    unpromotedBonus = unit in a base class ? (Normal 8, Hard 3, Lunatic(+) 0) : 0   // special classes get 0
    quirk(IL)       = IL is 8 or 11 ? -1 : IL is 30 ? +1 : 0
danceExp = the same with base 17. The Dancer is a special class, so it never gets the unpromoted bonus
```

Sources: SF calculations; FEW Experience (cites SF). FEW adds the minimum of 1. The quirk makes the penalty non-monotonic (IL 8 → 2, IL 9 → 1). Both sites print it as measured, and no datamine explains it (G9).

**Staff bases:** SF staves, the FEW staff pages and JP ptnwiki **agree on all 12**:

| Staff | Heal | Mend | Physic | Recover | Fortify | Goddess Staff | Rescue | Ward | Hammerne | Kneader | Balmwood Staff | Catharsis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Base EXP | 17 | 22 | 30 | 40 | 60 | 100 | 40 | 30 | 50 | 12 | 22 | 35 |

SF's staves page and half the FEW infoboxes call the base "for a Level 1 unpromoted unit". That's true on Lunatic only: on Normal and Hard the unpromoted bonus adds 8 or 3 (SF's own calculations page).

### 1.4 Levels, caps and multipliers

- **100 EXP per level** (FEW Experience, "Experience needed for next level", which covers every game from Shadow Dragon to Echoes, Awakening included). With the per-combat maximum of 100, one action gives at most one level.
- **Level cap:**
  - 20 in base and advanced classes.
  - **30 in special classes**: FEW Level (oldid 771202), Villager (688750), Manakete (767124). JP-2ch CCまとめ lists Villager, Dancer, Taguel, Manakete, Conqueror, Lodestar, Dread Fighter and Bride.
  - At the cap, EXP gain stops (FEW Level).
- **Multipliers:**
  - **Paragon** ×2 (DLC, *Lost Bloodlines 3*): FEW Paragon (759871); SF skills; JP エリート.
  - **Veteran** ×1.5 while paired (Tactician skill, learned at Lv 1): FEW Veteran (Awakening) (747818) and Pegasus Knight スキル say only when the holder leads the pair. SF says "when paired up" (C4).
  - JP-2ch recorded a Veteran Robin gaining 12 where the formula gives 8 (§4.3).

## 2. Promotion and reclassing

**Is there a hidden internal level?** Yes, and it's the only level the formulas use. The game never shows it (SF calculations; FEW; Pegasus Knight; JP-2ch).

| Seal | When usable | What it does to the formula's level |
|---|---|---|
| **Master Seal** | Base class, Lv 10+ (FEW Master Seal, oldid 759311; SF class changing) | Displayed level 1 in an advanced class. IL becomes `21 + cumulative`. Cumulative is unchanged. **Promoting at Lv 10 and at Lv 20 lead to the same IL** (JP-2ch: "regardless of level at use, advanced Lv 1 = base Lv 21") |
| **Second Seal** | Base Lv 10–19: another base class. Base Lv 20 and advanced Lv 1–9: any base class (Lv 20 also the same class). Advanced Lv 10–19: any class but the current one. Advanced Lv 20 or special Lv 30: any class (FEW Second Seal, oldid 759458; SF class changing agrees). Special Lv 10–29: base classes | Displayed level 1. Cumulative += `floor((displayed + promotion bonus − 1) / 2)`. IL = `1 (+20 if the new class is advanced) + cumulative` |

**IL straight after common paths** (formula; the JP-2ch CCまとめ worked examples give the same numbers):

| Path | Cumulative added | IL at the new Lv 1 |
|---|---|---|
| Base Lv 10 → Master Seal (or at Lv 20) | 0 | 21 |
| Base Lv 10 → Second Seal → base | 4 | 5 |
| Base Lv 20 → Second Seal → base | 9 | 10 |
| Advanced Lv 1 → Second Seal → base (e.g. Frederick, straight away) | 10 | 11 |
| Advanced Lv 20 → Second Seal → base | 19 | 20 |
| Advanced Lv 20 → Second Seal → advanced | 19 | 40 |
| Special Lv 30 → Second Seal → advanced | 14 | 35 |
| Base Lv 10 → Second Seal → base Lv 10 → Master Seal | 4 | 25 |

**What this means in play:**
- Every Second Seal adds roughly half the levels the unit had, forever.
- On Lunatic the cumulative level can reach 50. An advanced Lv 20 unit then sits at IL 90, and every kill gives the floor of 8, even against Lv 20 advanced foes.
- The Normal cap of 20 keeps a reclassed advanced unit at IL ≤ 41 at Lv 1 (≤ 60 at Lv 20). On Lunatic the same unit can reach 71 at Lv 1 (90 at Lv 20).
- A Master Seal adds nothing to the cumulative level. Its only EXP cost is the jump to IL 21, which is paid in full at Lv 10.

## 3. Special cases

- **Lunatic repeat penalty.**
  - It affects the damage part only. It therefore lowers damage EXP, a kill's total and a Battery's share alike.
  - From the 4th engagement with the same foe it's −1, −2, …, down to 0. SF's own gloss says "one less experience".
  - Pegasus Knight recorded it: attacking the Lunatic Ch 8 boss again and again with Donnel, the EXP fell by 1 each time until damage gave none (paraphrased from the Japanese).
  - **Sign caution:** SF and FEW both write "− Lunatic penalty", with the penalty defined as `min(3 − T, 0)`, which is ≤ 0. Read literally that would *add* EXP. Implement it as a reduction. This isn't counted as a disagreement.
- **Pair Up and Dual.**
  - The Battery earns only through its own damaging Dual Strikes.
  - The Dual Strike rate is `floor((Lead Skl + Battery Skl) / 4) + 20/30/40/50/60` (none/C/B/A/S), +10 with Dual Strike+ (FEW Pair Up, oldid 756409; SF calculations; JP-2ch 各種計算式).
  - A Dual Strike can follow each of the Lead's attacks (FEW Pair Up).
  - Dual Guard deals no damage, so it earns nothing.
  - An adjacent ally who joins the battle as the support (Dual without Pair Up) is the "support unit" in SF's wording. The same formula presumably applies (G3).
- **Bosses to low-level units:**
  - A Lv 1 unit killing a Lv 10 boss: LD +9 gives 13 + (20 + 27 + 20) = 80.
  - Against a Lv 16 boss: 15 + 85 = 100.
  - FEW Level: a boss above the unit "will usually be enough to gain a full 100".
- **Promoted foes count 20 levels higher.** Entombed are "technically promoted" (FEW Entombed, oldid 770543), so they get +20 as well as their +80 class bonus.
- **SpotPass and StreetPass skirmishes on Lunatic(+):** every attack gives exactly 1 EXP, kills included. This doesn't touch story chapters or DLC episodes (FEW Experience; JP-2ch 難易度・モード, FAQ).
- **DLC (Outrealm) maps:** difficulty doesn't change DLC foes (JP-2ch 難易度・モード). Einherjar there carry the +20 unit bonus.
- **Mode (Classic/Casual):** no source lists any EXP difference.

## 4. Worked examples

### 4.1 Chapter 1, Lunatic: checkable in the current run

**Foes** (FEW *Unwelcome Change*, oldid 741770, Lunatic(+) tab):
- Risen Chief (**boss**): Fighter Lv 3.
- Risen Fighters Lv 1.
- Risen Mercenaries Lv 1.
- A Risen Archer Lv 1.

**Units:** Chrom (Lord Lv 1, IL 1), Robin (Tactician Lv 1, IL 1), Frederick (Great Knight Lv 1, IL 21), Lissa (Cleric Lv 1, IL 1).

| # | Event | Arithmetic | EXP |
|---|---|---|---|
| 1 | Robin kills a Risen Fighter | LD 0: 10 + 20 | **30** |
| 2 | Robin, leading a pair, kills a Risen Fighter (Veteran) | 30 × 1.5 | **45** |
| 3 | Chrom kills the Risen Chief | LD +2: 11 + (20 + 6 + 20 boss) | **57** |
| 4 | Chrom hits the Risen Chief, which survives | LD +2 | **11** |
| 5 | Frederick kills a Risen Fighter | LD 1 − 21 = −20: 4 + max(26 − 60, 7) | **11** |
| 6 | Frederick kills the Risen Chief | LD −18: 5 + max(26 − 54 + 20, 7). The boss bonus is lost | **12** |
| 7 | Lissa uses Heal | 17 − 0 + 0 (Lunatic) | **17** (Hard 20, Normal 25) |
| 8 | Chrom leads with Robin as Battery. Chrom kills a Risen Fighter. Robin's Dual Strike hit first | Robin: floor(10 × 0.5). Veteran doesn't apply as Battery under C4; SF's wording would make it 7 | Robin **5**, Chrom **30** |
| 9 | As #8, but Robin's Dual Strike lands the kill | Robin: 10 × 1 | Robin **10**; Chrom unclear (G2) |
| 10 | Chrom's 4th engagement with the Risen Chief, no kill | 11 − 1 | **10** |
| 11 | Chrom kills the Risen Chief on his 5th engagement | (11 − 2) + 46 | **55** |

### 4.2 Generic cases

| Event | Arithmetic | EXP |
|---|---|---|
| Base Lv 15 kills an advanced Lv 5 Hero | LD 25 − 15 = +10: 13 + 50 | 63 |
| Advanced Lv 5 (IL 25) kills a base Lv 20 foe | LD −5: 9 + 11 | 20 |
| Equal-level Thief / Revenant / Cleric | 10 + 20 + (20 / 80 / −10) | 50 / 100 (cap, from 110) / 20 |
| Equal-level Einherjar Cleric | 10 + 20 + min(20 − 10, 20) | 40 |
| Advanced Lv 20 with cumulative 50 on Lunatic (IL 90) kills a Lv 20 advanced foe | LD −50: 1 + 7 | 8 |
| Cleric Lv 8 / Lv 9 / Lv 10 uses Heal, Lunatic | 17 − 1 − 1 / 17 − 1 / 17 − 1 | 15 / 16 / 16 |
| Sage Lv 1 (IL 21) uses Physic, Lunatic | 30 − floor(16/3) | 25 |
| Dance at IL 1 / 20 / 30 | 17 / 17 − 5 / 17 − 8 + 1 | 17 / 12 / 10 |
| SF's example: Donnel reclasses Villager Lv 15 → Mercenary, Master Seals to Hero, then reclasses Hero Lv 15 → Bow Knight | cumulative 7, then 7 + floor(34/2) = 24 | IL 8, then 28, then 41 on Normal (cap 20) / 45 on Hard and up |

### 4.3 Recorded play (JP-2ch 内部レベル検証): all match SF's formulas

- **Lunatic kill EXP by (unit level − foe level)**, same tier, cumulative 0, first engagement:
  - 0–2: 30
  - 3: 27
  - 4: 23
  - 5: 20
  - 6: 17
  - 7–9: 15
  - 10–12: 14
  - 13–15: 13
  - 16–18: 12
  - 19–21: 11
  - 22–24: 10
  - 25–27: 9
  - 28–31: 8
  - **32 of 32 points match** `min(damageExp + killExp, 100)`.
- **Hard, same-level kill** (post 731):
  - 30 initially.
  - 23 after reclassing at Lv 10.
  - 15 after reclassing at Lv 20.
  - 14 after reclassing at advanced Lv 1.
  - 15 after two reclasses at Lv 10.
  - The formula gives the same five numbers.
- **Gregor vs a Lv 13 Cavalier, Lunatic:**
  - As a Mercenary Lv 10: **40**.
  - After a Second Seal to Myrmidon Lv 1 (IL 5): **57**.
  - After Hero Lv 1 → Second Seal → Myrmidon Lv 1 (IL 11): **37**.
  - The formula gives 40 / 57 / 37. Case (c) is what showed that the +20 promotion bonus enters the cumulative level.
- **Frederick, Lunatic:**
  - Reclassed at advanced Lv 14, then again at advanced Lv 1, into Cavalier Lv 1: cumulative 16 + 10, so IL 27.
  - Against a Myrmidon Lv 20 (LD −7) he got **15**. The formula gives 15.
  - This also shows that IL isn't capped at 20 in a base class, and that the Lunatic cumulative cap is at least 26.
- **Robin, Lunatic:**
  - Cumulative 9 (reclassed at Tactician Lv 20), now Sorcerer Lv 18: IL 47.
  - Against an Archer Lv 16 (LD −31): **8**, or **12** with Veteran.
  - The formula gives 8, ×1.5 = 12. This also shows that IL isn't capped at 40 in an advanced class.

## 5. Disagreements

IDs follow the repo's style. They're numbered within this file, as in `research/chapter-data.md`.

| ID | Item | SF (or first source) | FEW (or second source) | Suggested resolution |
|---|---|---|---|---|
| C1 | A foe's positive class bonus in the kill formula | SF: the class bonus applies on its own when no unit bonus applies, so an equal-level Thief gives **50** | FEW Experience (772527): the bonus is written `min{Unit bonus, Unit bonus + Class bonus}` with Unit bonus 0 for ordinary foes. Read literally, that zeroes every positive class bonus (Thief **30**), though FEW's own note lists +20 and +80 | **SF.** FEW's notes, JP ptnwiki (Thief line +20, Revenant +80) and the JP-2ch FAQ (grind on the Revenant DLC for its EXP) all assume the bonus applies. A slip in FEW's transcription |
| C2 | Grima's class bonus | SF: not listed (0). JP ptnwiki doesn't list it either | FEW: +20 | Unresolved. **No impact:** Grima is the final boss, and the game ends on the kill |
| C3 | Harvest Scramble foes other than the boss | SF: unit bonus 0, which cancels positive class bonuses (the Entombed there give no +80) | FEW: no such rule (Entombed +80 everywhere) | Unresolved. DLC only. SF's rule is too specific to be a guess. Check in play if Harvest Scramble is ever planned |
| C4 | Who Veteran applies to | SF skills: "Experience gain x 1.5 when paired up" (the holder as Lead or Battery) | FEW Veteran (Awakening) (747818): active "if user is lead unit in Pair Up". Pegasus Knight スキル agrees: while carrying a rear unit | **Lead only** (FEW + JP), medium confidence. Check: Robin as Battery lands a Dual Strike, and the EXP is 5 (Lead only) or 7 (SF) |
| C5 | JP ptnwiki's simplified formulas | ptnwiki 計算式: damage `(31 + LD) / 3` at every LD. Kill `20 + 3 × (unit level − foe level)` (sign flipped). Staff `base − (level − 3) / 3`, Dance `17 − (level − 3) / 3` | SF / FEW formulas (§1) | **SF/FEW.** JP-2ch's recorded Lunatic table matches SF at all 32 points. It contradicts ptnwiki's damage branch (unit 3 levels above: 27, not 26; 5 above: 20, not 19). The kill sign is plainly a typo |
| C6 | A Normal-mode kill bonus | JP-2ch 内部レベル検証, post 731: on Normal (and Outrealm maps) kills give 20 more than on Hard, **50** at equal level | SF, FEW: no difficulty term in battle EXP (**30**) | **SF/FEW**, medium confidence. A later comment on the same page says that table was mis-measured and that difficulty makes no difference. Its "Normal" row equals the formula +20 at every point, which is exactly the Einherjar unit bonus of Outrealm foes. JP-2ch's own difficulty page lists no EXP difference besides the cumulative cap. Only matters for Normal runs |

**Not counted as disagreements:**
- The shared sign slip in the Lunatic penalty (§3).
- The staff "base value" wording (§1.3).
- FEW's single-source extras: the per-combat maximum of 100 and the staff minimum of 1. SF is silent on both, and neither contradicts it.

## 6. Gaps

| # | Gap | Best reading now | How to settle it |
|---|---|---|---|
| G1 | **Rally EXP.** No source gives Rally any EXP. FEW Experience lists combat, staves and Dance for Awakening, and nothing for Rally. FEW Rally (759031) and the Rally skill pages are silent. GameFAQs and SF forum threads were unreachable (403, Cloudflare) | 0 | Rally once in play and see whether an EXP bar appears |
| G2 | Kill credit when the **Battery's Dual Strike lands the kill**. SF gives the Battery its damage EXP at factor 1, and is silent on the Lead | The Lead still gets EXP, per one 2012 user comment on Pegasus Knight 計算式 (paraphrased: the lead gets its EXP even if it missed). The amount isn't stated | Record one such kill |
| G3 | **Battery EXP needs a damaging Dual Strike.** SF's formula doesn't state the condition | Stated by a Pegasus Knight comment (a miss or 0 damage gives no EXP), Fire Emblem WoD ("gains experience" by the Dual Strike) and a Yahoo! Chiebukuro answer. That's three low-trust sources in agreement. The same rule presumably covers an adjacent (unpaired) support | Watch a Battery's EXP on a combat with no Dual Strike |
| G4 | Whether the **EXP bar is kept or reset** by a Master or Second Seal. SF class changing: the displayed level resets to 1 and IL "adjusted accordingly", with no word on EXP | Unknown. The impact is at most 99 EXP per seal | Check the EXP bar before and after a seal |
| G5 | **Rounding and stacking** of ×0.5 (Battery), ×1.5 (Veteran) and ×2 (Paragon). Whether the 100 cap applies before or after them | floor, and cap after | Only matters with Paragon; not needed for a Lunatic story forecast |
| G6 | **What the Lunatic repeat penalty counts**: every engagement with the foe by anyone, or only this unit's? Enemy-phase engagements? DLC maps? Pegasus Knight guessed "elapsed turns (or another reason)" | Every engagement with that foe | Rarely matters. Most foes die within 3 engagements. Bosses are the exception |
| G7 | Whether **Dread Scroll or Wedding Bouquet** class changes add cumulative level like a Second Seal | Unknown (a JP-2ch comment asks, with no answer) | DLC only |
| G8 | Whether **Deadlords** (Ch 22) get the boss +20 on top of their +20 unit bonus | Unit bonus only, unless the chapter data marks them as bosses | Chapter data and one kill |
| G9 | **No datamine.** SF credits the JP wikis and a user, Tables, for the EXP calculations. The staff quirk at IL 8, 11 and 30 suggests the real formula isn't exactly what is written | Use the formulas as written. They reproduce every recorded value found | – |

## 7. Method

1. **Fetch.** FEW: MediaWiki API (`prop=revisions`, raw wikitext), with each `revid` recorded. SF: the HTML of the calculations, staves, skills, class-changing and hints pages. JP: the HTML of the JP-2ch atwiki pages, Pegasus Knight's 計算式, クラスチェンジ and スキル, and ptnwiki's 計算式. Low-trust extras: Fire Emblem WoD's Dual page and one Yahoo! Chiebukuro answer.
2. **Compare.** SF against FEW row by row for the formulas, the bonus lists, the Second Seal table, and the 12 staff bases (FEW infobox `expN` fields for FE13). FEW's formula rows cite SF (`ref name=SF13`), so agreement there isn't independent. FEW's "no damage = 0" row, the level caps and the Veteran scope are FEW's own.
3. **Test against recorded play.** The formulas were implemented in a throwaway script (not committed). It was run against the JP-2ch Lunatic table (32 rows), the Hard same-level list (5), the Gregor, Frederick and Robin experiments, the JP-2ch reclass worked examples, and SF's Donnel example. Every value matched. Post 731's "Normal" row matches only with +20 added (C6).

## 8. Sources

| Source | Trust | Used for |
|---|---|---|
| SF [Calculations](https://serenesforest.net/awakening/miscellaneous/calculations/) (credits: FEA 2ch strategy wiki, FEA strategy wiki, Remnant Sage, Tables for EXP) | High; compiled from the JP wikis | Every formula. The primary statement |
| SF [Staves](https://serenesforest.net/awakening/inventory/staves/), [Skills](https://serenesforest.net/awakening/miscellaneous/skills/), [Class changing](https://serenesforest.net/awakening/classes/class-changing/), [Hints and secrets](https://serenesforest.net/awakening/miscellaneous/hints-and-secrets/) | High | Staff bases, Veteran and Paragon, seal rules, Lunatic+ = Lunatic |
| FEW [Experience](https://fireemblemwiki.org/w/index.php?oldid=772527) (772527) | High, but cites SF for the Awakening formulas | Cross-check of the formulas; no damage = 0; maximum 100; staff minimum 1; SpotPass 1 EXP |
| FEW [Level](https://fireemblemwiki.org/w/index.php?oldid=771202) (771202), [Pair Up](https://fireemblemwiki.org/w/index.php?oldid=756409) (756409), [Second Seal](https://fireemblemwiki.org/w/index.php?oldid=759458) (759458), [Master Seal](https://fireemblemwiki.org/w/index.php?oldid=759311) (759311), [Reclass](https://fireemblemwiki.org/w/index.php?oldid=766323) (766323), [Veteran (Awakening)](https://fireemblemwiki.org/w/index.php?oldid=747818) (747818), [Paragon](https://fireemblemwiki.org/w/index.php?oldid=759871) (759871), [Dance](https://fireemblemwiki.org/w/index.php?oldid=759421) (759421), [Rally](https://fireemblemwiki.org/w/index.php?oldid=759031) (759031), Rally Strength (716762), [Villager](https://fireemblemwiki.org/w/index.php?oldid=688750) (688750), [Manakete](https://fireemblemwiki.org/w/index.php?oldid=767124) (767124), [Entombed](https://fireemblemwiki.org/w/index.php?oldid=770543) (770543), [Boss](https://fireemblemwiki.org/w/index.php?oldid=745882) (745882), [Unwelcome Change](https://fireemblemwiki.org/w/index.php?oldid=741770) (741770) | High | Caps, seal tables, Dual Strike rate, Veteran scope, the Ch 1 examples |
| FEW staff pages: Heal 763543, Mend 763497, Physic 772867, Recover 772865, Fortify 763516, Goddess Staff 759202, Rescue (staff) 759875, Ward 763563, Hammerne 768540, Kneader 759765, Balmwood Staff 759511, Catharsis 759652 | High | Staff bases (12/12 agree with SF) |
| JP-2ch (ファイアーエムブレム覚醒 2chまとめ&攻略wiki): [内部レベル検証](https://w.atwiki.jp/fireemblem3ds/pages/136.html), [CCまとめ](https://w.atwiki.jp/fireemblem3ds/pages/23.html), [難易度・モード](https://w.atwiki.jp/fireemblem3ds/pages/82.html), [よくある質問](https://w.atwiki.jp/fireemblem3ds/pages/19.html), [各種計算式](https://w.atwiki.jp/fireemblem3ds/pages/208.html) | High; SF's upstream and the only independent lineage (as in `docs/research/data-disagreements.md`) | Recorded play for §4.3, caps by difficulty, special classes, C6 |
| Pegasus Knight (天馬騎士団) FE13 wiki: [計算式](https://www.pegasusknight.com/wiki/fe13/?%E8%A8%88%E7%AE%97%E5%BC%8F), [クラスチェンジ](https://www.pegasusknight.com/wiki/fe13/?%E3%82%AF%E3%83%A9%E3%82%B9%E3%83%81%E3%82%A7%E3%83%B3%E3%82%B8), [スキル](https://www.pegasusknight.com/wiki/fe13/?%E3%82%B9%E3%82%AD%E3%83%AB) | Medium-high (pages); low (user comments) | Cumulative level rule, the Lunatic penalty anecdote, Veteran scope, Battery EXP comments (G2, G3) |
| ptnwiki [計算式](http://ptnwiki.com/fek/calculation.shtml) | Medium-low (simplified, has a sign typo) | Staff bases, class bonuses, C5 |
| Fire Emblem WoD [Dual and Pair Up](https://www.fireemblemwod.com/fe13/ENG_sistema-dual-y-doble.htm); Yahoo! Chiebukuro [q13155526083](https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q13155526083) | Low | Corroboration for G3 only |
| SF forums, GameFAQs boards | – | Not reachable (Cloudflare challenge / 403). They were the likeliest place to settle G1 |

## 9. What this means for the forecast (#146)

- **A unit's IL needs its seal history.** A run entry records class, level, promoted/reclassed status and EXP (`CONTEXT.md`, *Entry*). "Reclassed: yes" can't give the cumulative level. The run needs the displayed level and tier at each Second Seal use, or the cumulative level itself, recorded when a seal is logged. Promotion needs nothing extra: IL is 21 + cumulative at advanced Lv 1, whatever the promotion level.
- **What each foe needs:** level, class tier (+20 if advanced; 0 if base or special), class bonus, boss flag and unit bonus. All of them come from the chapter data (FEW enemy groups and `BossStats`) plus a class→tier/bonus table.
- **Simulate, don't multiply.** Every 100 EXP raises the level and the IL by 1, which lowers the next kill's EXP. Stop at the level cap. A kill split between units gives the killer the kill EXP and each chipper its damage EXP. Count engagements per foe on Lunatic.
- **Battery share** ≈ P(at least one damaging Dual Strike in the combat) × `floor(damageExp / 2)`. The Dual Strike rate and hit chance already exist in the map-solver matchups. It's small (at most 6 even at LD +10), so Batteries level mainly by leading.
- **Staff/Rally and Dancer:**
  - A healer earns per use. The forecast needs an assumed number of heals per map, with staff EXP from §1.3.
  - A Dancer earns 17 minus the IL penalty per dance.
  - A Rallybot earns nothing from Rally until G1 is settled.
- **Where EXP is worth most** (for the EXP priority): the curve is steep above the unit and flat below. Low-level units should take bosses and higher-level foes, since a boss kill is often a full level. Promoted or heavily reclassed units get 8–15 a kill from most foes. On Lunatic, every Second Seal permanently cuts a unit's future EXP (§2).
