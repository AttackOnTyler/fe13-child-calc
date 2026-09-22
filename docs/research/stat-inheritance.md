# Stat inheritance in Fire Emblem Awakening (FE13)

Research for issue #2 (part of #1). Researched 2026-09-22.

Scope: child growth rates, child max-stat modifiers, effective max stats (incl. Limit Breaker), and Robin's
Asset/Flaw and how it passes to Robin's children. Base-stat inheritance is out of scope.

## Sources

| Key | Source | What it is |
|-----|--------|-----------|
| SF-GR | https://serenesforest.net/awakening/characters/growth-rates/base/ | Serenes Forest: personal growths, Asset/Flaw growth table, child growth formula + Nah example |
| SF-GRJS | https://serenesforest.net/app/java/chargrowth13-2.js | Source of SF's "Full growths" calculator (https://serenesforest.net/awakening/characters/growth-rates/full/) — shows exact rounding and the Robin / Morgan branches |
| SF-MOD | https://serenesforest.net/awakening/characters/maximum-stats/modifiers/ | Serenes Forest: max-stat modifiers, Asset/Flaw modifier table, child +1 rule + Severa example (credit: FEA 2ch strategy wiki) |
| SF-MAXJS | https://serenesforest.net/app/java/fe13maxstats.js | Source of SF's "Complete max stats" calculator (https://serenesforest.net/awakening/characters/maximum-stats/complete/) — shows Limit Breaker array and the Morgan branch |
| SF-CGR | https://serenesforest.net/awakening/classes/growth-rates/ | Class growth rates |
| SF-CMAX | https://serenesforest.net/awakening/classes/maximum-stats/ | Class maximum stats |
| FEW-INH | https://fireemblemwiki.org/wiki/Inheritance (Awakening > Calculations) | FE Wiki formulas (cites SF) |
| FEW-ROB | https://fireemblemwiki.org/wiki/Robin/Stats | FE Wiki: Asset/Flaw base, growth and cap tables; says effects carry to Robin's children |
| FEW-LB | https://fireemblemwiki.org/wiki/Limit_Breaker | FE Wiki: Limit Breaker effect |
| FEW-LUC | https://fireemblemwiki.org/wiki/Lucina/Stats | FE Wiki: Lucina's computed growths/modifiers per mother (used as a cross-check) |

No raw ROM/game-data dump was found; the SF calculator scripts are the most "code-level" source available, and
they reproduce the numbers on the SF and FE Wiki tables exactly (checks below).

Stat order used throughout: HP / Str / Mag / Skl / Spd / Lck / Def / Res.

---

## (a) Child growth rates — VERIFIED

**Formula** (SF-GR, FEW-INH):

```
childPersonalGrowth[s] = floor( (father[s] + mother[s] + childAbsolute[s]) / 3 )
childTotalGrowth[s]    = childPersonalGrowth[s] + classGrowth[s]      (+ skills such as Aptitude, not inheritance)
```

- All three inputs are **personal (base) growths**, not class-inclusive growths (SF-GR: "These growth rates are added
  to the class growth rates to obtain the characters' full growth rates").
- **Rounding: truncate (floor).** SF-GR text does not say so, but its worked example only works with floor, and the
  SF calculator uses `parseInt((child + parentA + parentB) / 3)` (SF-GRJS, "Part 4"). Values are always positive, so
  truncation = floor.
- Truncation happens on the personal growth, **before** adding the class growth (SF-GRJS).

**Worked example 1 (SF-GR, verbatim table): Nah, father Donnel, mother Nowi**

| | HP | Str | Mag | Skl | Spd | Lck | Def | Res |
|---|---|---|---|---|---|---|---|---|
| Donnel | 50 | 45 | 15 | 40 | 45 | 80 | 35 | 15 |
| Nowi | 70 | 45 | 35 | 30 | 30 | 65 | 50 | 35 |
| Nah (absolute) | 70 | 35 | 35 | 45 | 35 | 70 | 45 | 40 |
| raw sum / 3 | 63.33 | 41.67 | 28.33 | 38.33 | 36.67 | 71.67 | 43.33 | 30 |
| **Nah (SF-published)** | **63** | **41** | **28** | **38** | **36** | **71** | **43** | **30** |

Str 41.67 -> 41, Spd 36.67 -> 36, Lck 71.67 -> 71: rounding-to-nearest would give 42/37/72, so the rule is floor.

**Worked example 2 (FEW-LUC cross-check): Lucina, father Chrom, mother Sully, class Lord**

Lucina abs (45,35,20,45,45,80,25,25) + Chrom (45,40,10,40,40,70,35,20) + Sully (40,35,20,40,40,60,35,20)
-> floor(/3) = (43,36,16,41,41,70,31,21); + Lord class growths (40,20,0,20,20,0,10,5 — SF-CGR, Lck has no class
growth) = **(83,56,16,61,61,70,41,26)**, exactly what FEW-LUC lists. (Mag 16.67 -> 16 again confirms floor.)

---

## (b) Child max-stat modifiers — VERIFIED (cap/floor UNVERIFIED)

**Formula** (SF-MOD, FEW-INH):

```
childModifier[s] = father[s] + mother[s] + bonus          for s in Str..Res (HP has no modifier)
bonus = 0  if the child is Morgan AND Morgan's non-Robin parent is a child unit
bonus = 1  otherwise
```

- Children have **no personal modifiers of their own** — only the parent sum + bonus (SF-MAXJS: every child's own
  entry is the zero array; SF-MOD Severa example below).
- SF-MOD wording: "The modifiers for children characters are equal to (their father's modifiers + their mother's
  modifiers +1). If your Avatar pairs with a children character, Morgan does not receive the +1".
  FEW-INH: "Child bonus is 0 for a Morgan that is the child of another child unit, 1 otherwise."
- **Scope of the "skip +1" rule:** it is only ever reachable by Morgan. Robin is the only first-generation unit who
  can marry a child unit, and child units marrying each other produce no children. So "a parent is themselves a
  child unit" <=> "Morgan whose other parent is Lucina/Owain/Inigo/…/Nah".
- Equivalent form used by SF-MAXJS for that case: `Robin[s] + grandparentA[s] + grandparentB[s] + 1` — i.e. the
  child-parent's modifiers already contain their own +1, and Morgan gets none on top.
- **Cap/floor on the resulting modifier: UNVERIFIED — no source mentions one.** SF-MOD and FEW-INH state the plain sum;
  SF-MAXJS applies no clamp. Hypotheses: (1) no clamp (the sources' implicit position; recommended default);
  (2) some clamp exists in the game code but no sum ever reaches it — would need a datamine to confirm.
  Observed range with real data: e.g. Severa w/ Henry Skl +5; theoretical Morgan extremes are larger (Robin up to
  +4 with a child-parent up to ~+6), still no documented clamp.

**Worked example 1 (SF-MOD, verbatim): Severa, father Henry, mother Cordelia**

| | Str | Mag | Skl | Spd | Lck | Def | Res |
|---|---|---|---|---|---|---|---|
| Cordelia | 1 | -1 | 2 | 2 | -1 | 0 | -1 |
| Henry | 1 | 1 | 2 | 0 | -2 | 1 | -1 |
| **Severa (= sum + 1)** | **3** | **1** | **5** | **3** | **-2** | **2** | **-1** |

**Worked example 2 (FEW-LUC cross-check): Lucina, Chrom + Sully**
Chrom (1,0,1,1,1,-1,-1) + Sully (-1,-1,2,2,0,-1,0) + 1 = **(+1, 0, +4, +4, +2, -1, 0)** — matches FEW-LUC exactly.

---

## (c) Effective max stat — VERIFIED

```
effectiveMax[HP]  = classMax[HP]                                   (HP has no modifier; LB does not affect HP)
effectiveMax[s]   = classMax[s] + modifier[s] (+ 10 if Limit Breaker equipped)     for s in Str..Res
```

- SF-MOD: "These values are added to the class maximum stats to obtain a character's actual maximum stats."
- Limit Breaker (FEW-LB): "Increases the maximum strength, magic, skill, speed, luck, defense, and resistance of its
  user each by 10 when equipped." SF-MAXJS: `limitbreak = new Array(0, 10, 10, 10, 10, 10, 10, 10)` (HP = 0), applied
  identically to children. Unequipping keeps the extra points stored but displays/uses the normal cap (FEW-LB).
  Limit Breaker is DLC-only (Rogues & Redeemers 3) and is not inheritable (DLC skills can't be inherited — FEW-INH).
- Note: gender-specific classes (e.g. Great Lord M/F) have different class maxes (SF-CMAX); use the child's gender.

**Worked example (SF complete max-stats page vs SF-CMAX): Chrom as Lord**
Lord class max (60,25,20,26,28,30,25,25) + Chrom modifiers (—,+1,0,+1,+1,+1,-1,-1) = **(60,26,20,27,29,31,24,24)**,
which is exactly the Chrom/Lord row on https://serenesforest.net/awakening/characters/maximum-stats/complete/.
With Limit Breaker: (60,36,30,37,39,41,34,34).

---

## (d) Robin's Asset/Flaw — VERIFIED (one propagation detail calculator-sourced)

Options: HP, Str, Mag, Skl, Spd, Lck, Def, Res (8). **HP is eligible** as either Asset or Flaw. Asset and Flaw must
differ (SF calculators: "You can't choose the same stat twice") -> **8 x 7 = 56 combos**.
Robin's personal growths without Asset/Flaw: (40,40,35,35,35,55,30,20) (SF-GR). Robin's personal modifiers without
Asset/Flaw: all 0 (FEW-ROB: "the Avatar's default stat cap modifiers are zero all around").
Robin's total delta = Asset row (positive values) + Flaw row (negative values).

### Growth-rate deltas (SF-GR, SF-GRJS arrays, FEW-ROB agree)

| Choice | Asset (+) | Flaw (−) |
|---|---|---|
| HP | HP +30, Def +5, Res +5 | HP −20, Def −5, Res −5 |
| Str | Str +15, Skl +5, Def +5 | Str −10, Skl −5, Def −5 |
| Mag | Mag +15, Spd +5, Res +5 | Mag −10, Spd −5, Res −5 |
| Skl | Skl +15, Str +5, Def +5 | Skl −10, Str −5, Def −5 |
| Spd | Spd +15, Skl +5, Lck +5 | Spd −10, Skl −5, Lck −5 |
| Lck | Lck +15, Str +5, Mag +5 | Lck −10, Str −5, Mag −5 |
| Def | Def +15, Lck +5, Res +5 | Def −10, Lck −5, Res −5 |
| Res | Res +15, Mag +5, Spd +5 | Res −10, Mag −5, Spd −5 |

### Max-modifier deltas (SF-MOD, SF-MAXJS arrays, FEW-ROB agree)

| Choice | Asset (+) | Flaw (−) |
|---|---|---|
| HP | Str +1, Mag +1, Lck +2, Def +2, Res +2 | Str −1, Mag −1, Lck −1, Def −1, Res −1 |
| Str | Str +4, Skl +2, Def +2 | Str −3, Skl −1, Def −1 |
| Mag | Mag +4, Spd +2, Res +2 | Mag −3, Spd −1, Res −1 |
| Skl | Skl +4, Str +2, Def +2 | Skl −3, Str −1, Def −1 |
| Spd | Spd +4, Skl +2, Lck +2 | Spd −3, Skl −1, Lck −1 |
| Lck | Lck +4, Str +2, Mag +2 | Lck −3, Str −1, Mag −1 |
| Def | Def +4, Lck +2, Res +2 | Def −3, Lck −1, Res −1 |
| Res | Res +4, Mag +2, Spd +2 | Res −3, Mag −1, Spd −1 |

(HP never has a max modifier, so an HP Asset/Flaw only moves the other stats' caps.)

**Worked example (SF-GR and SF-MOD, verbatim): Asset Spd, Flaw Lck**
- Growth delta: (0, −5, −5, +5, +15, −5, 0, 0) -> Robin personal growths (40,35,30,40,50,50,30,20).
- Modifier delta / Robin's modifiers: (Str −1, Mag −1, Skl +2, Spd +4, Lck −1, Def 0, Res 0).

### Propagation into Robin's children

Robin's children: Morgan (always, if Robin marries), plus Lucina when female Robin marries Chrom. FEW-ROB: "The growth rate and stat cap modifier workings of the Avatar's
asset and flaw also impact any of the Avatar's potential children in the same fashion."

Rule: **treat Robin as a normal parent whose values already include the Asset/Flaw delta**, then apply (a)/(b):

```
RobinGrowth[s] = 40/40/35/35/35/55/30/20[s] + assetGrowth[s] − flawGrowth[s]
RobinMod[s]    = assetMod[s] − flawMod[s]

non-Morgan child of Robin (e.g. Lucina):  growth = floor((Chrom + RobinGrowth + LucinaAbs) / 3); mod = Chrom + RobinMod + 1
Morgan, other parent is Gen-1:            growth = floor((RobinGrowth + spouse + MorganAbs) / 3); mod = RobinMod + spouse + 1
Morgan, other parent is a child unit X:   growth = floor((RobinGrowth + X.personalGrowth + MorganAbs) / 3)
                                          mod    = RobinMod + X.mod            (no +1; X.mod already has its own +1)
```

Morgan's absolute growths (M and F identical): (35,35,40,40,40,50,25,25) (SF-GR). Morgan's own modifiers: 0.

- The growth branches are exactly SF-GRJS "Parts 1–3"; the modifier branches are SF-MAXJS. For the child-parent case
  SF-GRJS first computes X's personal growth as `parseInt((X's two parents + X abs) / 3)`, i.e. **truncated**, and
  then truncates again for Morgan.
  - **UNVERIFIED (calculator-sourced, not game-data):** that the game uses X's already-truncated integer growth
    (double truncation) rather than an untruncated intermediate. Competing hypotheses: (1) double truncation — SF's
    calculator; plausible because growths are stored as integers; (2) single truncation over the exact fraction
    `(Robin + (gpA+gpB+Xabs)/3 + Morgan)/3` — differs by at most 1 point in some stats. Recommend (1).
- Note: an SF comment in SF-GRJS for "Part 3" says "Corrected asset and flaw" — the version there splits
  `(sum)/3 + delta/3` before one `parseInt`, which is mathematically identical to `floor((sum + delta)/3)`.

**Cross-check (FEW-LUC, Robin-as-mother section):** Lucina's modifier ranges there are Str (−1)~(+6), Mag (−2)~(+5),
Def (−3)~(+4) — exactly Chrom + RobinMod(min −3 / max +4) + 1 (e.g. Str: 1 + [−3..+4] + 1). (FEW-LUC's growth ranges
for the Robin case were *not* reproducible from these rules and look unreliable; don't use them as test data.)

**Derived example (computed with the rules above, not published by a source): male Robin (Asset Spd / Flaw Lck)
+ Lucina (Chrom + Sully) -> Morgan (F)**
- Growths: RobinGrowth (40,35,30,40,50,50,30,20) + Lucina personal (43,36,16,41,41,70,31,21) + Morgan abs
  (35,35,40,40,40,50,25,25) -> floor(/3) = **(39,35,28,40,43,56,28,22)**.
- Modifiers: RobinMod (−1,−1,+2,+4,−1,0,0) + Lucina (+1,0,+4,+4,+2,−1,0) + 0 = **(0,−1,+6,+8,+1,−1,0)**.

---

## Summary of verification status

| Item | Status |
|---|---|
| Growth = floor((father + mother + child abs) / 3), personal growths, then + class | VERIFIED (SF-GR example, SF-GRJS, FEW-LUC) |
| Modifier = father + mother + 1; children have no personal modifier | VERIFIED (SF-MOD example, FEW-INH, FEW-LUC) |
| +1 skipped only for Morgan whose other parent is a child unit | VERIFIED (SF-MOD, FEW-INH, SF-MAXJS) |
| Cap/floor on child modifiers | **UNVERIFIED** — none documented; assume none |
| Effective max = class max + modifier; HP unmodified | VERIFIED (SF-MOD, complete-page check) |
| Limit Breaker = +10 to Str..Res, 0 to HP | VERIFIED (FEW-LB, SF-MAXJS) |
| Asset/Flaw tables, HP eligible, 56 combos | VERIFIED (SF-GR, SF-MOD, FEW-ROB, SF calculators) |
| Robin's delta flows into children as part of Robin's own values | VERIFIED (FEW-ROB statement, SF calculators) |
| Double truncation for Morgan with a child-unit parent | **UNVERIFIED** (only SF calculator code) |
