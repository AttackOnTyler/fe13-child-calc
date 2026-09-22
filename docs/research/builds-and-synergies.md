# Community consensus builds and skill synergies (FE Awakening)

Research for issue #6 (part of #1). It feeds the **loadout suggester**, which matches 5-skill builds against the skills a unit can reach.

Community "consensus" is opinion. Every claim below cites a source ID from the [Sources](#sources) table. Confidence tags:

- **[Wide]**: 3 or more independent sources agree.
- **[Multi]**: 2 independent sources agree.
- **[Single]**: 1 source only. Treat it as a candidate, not consensus.
- **[Mech]**: a game-mechanics fact from a reference site (S1, S2, S8), not an opinion.

Disagreements between sources are called out inline with **Disagreement:**.

---

## 0. TL;DR for the suggester

1. **Context changes the answer.** The two main sources that go deepest disagree because they target different content:
   - **Apotheosis** is a player-phase map where you want to kill before being hit. The recommended builds pile on offence: Galeforce + weaponfaire + procs, and supports stacking damage and hit (S3).
   - **Main-story Lunatic/L+** leans more defensive: Pavise/Aegis/Renewal tanks, Sol, Nosferatu tanks, Counter (S4, S5, S6).
   - S3 says outright that its Apotheosis setups are "probably not useful" for main-story Lunatic/L+. The suggester should take a **context** input (`main-story` vs `apotheosis`) or at least tag builds with one.
2. **Lead vs support is the first split, and Galeforce decides it.** Units with Galeforce lead. Units without it sit in the back as "hard supports" (S3, S4) **[Multi]**.
3. **Proc skills only work on the lead.** Aether, Astra, Luna, Sol, Ignis, Vengeance and Lethality do nothing while the unit is the support. What still helps in the back: weaponfaires, Str/Mag +2, Aggressor, Limit Breaker, the Dual ___+ skills and hit/aura skills (S3, S4; Aggressor per S8) **[Multi]**. This is the most important rule to encode.
4. **Only one proc fires per attack.** Priority is `Lethality > Aether > Astra > Sol > Luna > Ignis > Vengeance` (S2, S4) **[Mech]**. Stacking procs raises the chance that *something* fires. It also means higher-priority procs pre-empt lower ones, so Sol steals triggers from Luna, and anything steals from Vengeance.
5. **The "Big Three" DLC boosts break Apotheosis:** Limit Breaker, Aggressor (male only), and the full set of Rallies including Rally Heart. Together they add about +30 player-phase Atk (S3). Limit Breaker is the most universally recommended DLC skill across all sources (S3, S4, S5, S7) **[Wide]**.
6. **Galeforce is the single most valued skill** (S3, S4 S-rank, S5, S6, S7, S9) **[Wide]**.

---

## 1. Mechanics the suggester must respect

| Fact | Source |
|---|---|
| A unit holds at most 5 active skills and can swap them freely outside battle. | S1 [Mech] |
| Only one offensive proc per attack. Priority: Lethality > Aether > Astra > Sol > Luna > Ignis > Vengeance. | S2, S4 [Mech] |
| Activation rates: Aether and Astra Skl/2 %; Sol, Luna, Ignis Skl %; Lethality Skl/4 %; Vengeance Skl×2 %; Armsthrift Luck×2 %; Pavise and Aegis Skl %; Miracle Luck %. | S1 [Mech] |
| Rightful King adds +10 % to all skill activation rates, including Armsthrift. | S1, S3, S5 [Mech] |
| Pavise, Aegis and Counter **do not apply to Dual Strikes**. | S1 [Mech]; S5 repeats it for Counter |
| Dual Strike rate = (lead Skl + support Skl)/4 + support bonus (S rank = 60) + 10 if either unit has Dual Strike+. Reaching 100 % takes 160 combined Skl without DS+, or 120 with it. | S2 [Mech], S3 |
| With a Brave weapon, the order of hits when dual strikes fire is 1-2-2-1-2-2 (1 = lead, 2 = support). Flat Atk on the support is therefore worth about double the same Atk on the lead. | S3 [Single, but follows from S2] |
| Aggressor works when the user **or its pair-up partner** starts the fight, so it still helps a backline unit. | S8 [Mech] |
| Vengeance maximum bonus is about +42 (85 HP) or +44 (90 HP with HP+5). With Skl ≥ 50 it fires 100 % of the time. | S3, S8 [Mech] |
| Lifetaker only triggers on the user's own turn, so it cannot push HP back above 50 % and switch off Vantage during enemy phase. | S5 |
| Apotheosis enemies all have Dragonskin, which halves damage and cancels Counter and Lethality. Many also have Pavise+ or Aegis+. | S3 |
| Chrom always passes Aether to daughters and Rightful King to sons. Lucina always passes Aether to Morgan-F. | S3, S6 |
| Rally skills don't stack with themselves, but do stack with Rally Spectrum and Rally Heart. | S1 [Mech] |

---

## 2. Skill synergy list ("A wants B, because…")

Format: **A wants B**, because… [confidence; sources]. Anti-synergies come after.

### Core synergies

1. **Vantage wants Vengeance**, because Vantage only works below 50 % HP. That is exactly when Vengeance's (MaxHP − HP)/2 bonus is large, and Vengeance fires at Skl×2 % (about 100 %). The unit strikes first, hard, on enemy phase. [Wide; S3, S4, S5, S6, S7]
2. **Vantage + Vengeance want Wrath**, because Wrath adds +20 crit below half HP, the same state V/V lives in. A crit triples the Vengeance-boosted hit. [Wide; S3, S4, S5]
3. **Vantage/Vengeance wants Dual Strike+ (on either unit of the pair) and an S support**, because a reliable V/V kill usually needs the dual strikes to fire. 100 % Dual Strike is far easier with DS+, which is worth 40 Skl. So V/V "almost requires" Chrom plus his wife, or Lucina plus her husband. [Multi; S3, S5]
4. **Vantage/Vengeance wants Tomefaire, a brave tome and the Sage class**, because the unit has to counter at both 1 and 2 range with a Brave weapon, and Sage has the best Mag plus the best Skl for dual-strike rate. [Single; S3]
5. **Vengeance wants Lifetaker (not Sol)**, because Lifetaker heals only on the user's turn after a kill. It doesn't compete in the proc queue and doesn't undo the low-HP state during enemy phase. [Multi; S4, S5]
6. **Vengeance wants Nosferatu or Aversa's Night on a Sorcerer ("Nostank")**, because damage taken turns into more damage, which the drain tome turns back into HP. [Multi; S4, S5]
7. **Vengeance wants Longbow / 3-range / a Sniper**, because it removes the counterattack risk of fighting at low HP. [Single; S3]
8. **Galeforce wants a Brave weapon and a reliable kill** (proc, weaponfaire), because it only fires after the user **kills** on their own turn, once per turn. [Wide; S1, S3, S4, S5]
9. **Galeforce wants a Galeforce partner ("Galepair")**, because two Galeforce units in one pair can take three kills in a turn: lead kills, swap, other kills, one more action. [Multi; S3, S5]
10. **Galeforce wants Lifetaker**, because every Galeforce trigger is also a kill that heals 50 %. [Multi; S4, S5 (Donnel!Nah)]
11. **Galeforce wants a weaponfaire and a stable proc (Luna or Vengeance), then a second proc** ("procstack"). This is S3's standard lead template: Galeforce / faire / stable proc / procstack-or-filler / filler. [Multi; S3, S4]
12. **Luna wants Aether (or Astra, Ignis, Rightful King)**, because Aether and Astra fire at only Skl/2 %. Pairing them with a Skl % proc raises the total trigger rate (e.g. 50 Skl with Aether + Luna: 25 % Aether, 37.5 % Luna). Two procs is the sweet spot; three is poor use of slots. [Multi; S3, S4]
13. **Aether wants Rightful King**, because RK adds a flat +10 % to a low-rate proc. S4 lists "Aether + Rightful King" as a named lead pattern. S3 says RK is worth roughly one extra proc: Luna + RK ≈ Luna + Astra at Apotheosis Skl levels. [Multi; S3, S4, S6]
14. **Lethality wants Rightful King**, because its base rate (Skl/4) is tiny. S6: "with Rightful King, Lethality sits at a 22% maximum". **Disagreement:** S3 calls Lethality useless in Apotheosis (Dragonskin cancels it), and S4 ranks it C. [Single-positive; S6 (S5 lists it as a perk)]
15. **Armsthrift wants high Luck (Donnel dad, Luck boosts)**, because the rate is Luck×2 %. At 50 Luck, weapons never lose uses. [Wide; S1, S5, S6]
16. **Armsthrift wants Rightful King**, because RK lets you hit the 100 % Armsthrift point with less than 50 Luck. [Multi; S3, S5]
17. **Armsthrift wants Brave, forged, legendary and low-use weapons** (Brave weapons, Aversa's Night, Helswath, Ragnell, Glass, Leif's Blade money farming, Dragonstone+). [Wide; S4, S5, S6, S7]
18. **Aggressor wants a Brave weapon and the backline**, because +10 Atk applies to every hit on player phase (partner-initiated counts too, per S8). In the 1-2-2 hit pattern, that is about double value on a support. [Multi; S3, S4, S8]
19. **Limit Breaker wants everything.** It is +10 to every stat cap and goes on every unit in DLC-allowed runs. [Wide; S3, S4, S5, S7]
20. **Pavise wants Aegis (and Renewal)**, because together they halve all weapon types and Renewal heals 30 % a turn. This is the classic main-story tank. Both are Skl %, so they want high Skill. [Wide; S4, S5, S6, S7]
21. **Pavise/Aegis want Rightful King**, for the +10 % activation (S6 on Sumia!Lucina). [Single; S6]
22. **Counter wants high HP, low Def, and melee-range bait on enemy phase**, because it returns damage taken from adjacent attackers. S5 pairs it with a 2–3 range Sniper so enemies can't attack safely at any range. [Multi; S4, S5]
23. **A backline Berserker wants the lead to carry Anathema**, because Berserkers have poor Skl. A −10 Avoid aura on the lead fixes the support's hit without costing the support a slot. [Single; S3]
24. **A hard support wants Hit +20, Prescience, breakers, Even Rhythm or Anathema/Hex**, because the only things that matter in the back are damage and accuracy. S3's Berserkers carry 2–3 +Hit skills. [Single; S3]
25. **A crit build wants Wrath + Focus + Gamble + Anathema + Solidarity (from a partner) + Dual Support+**, adding crit up to a 155 crit target. [Multi; S3, S4]
26. **Lancebreaker wants Avoid +10, Patience, Indoor Fighter, Charm, Demoiselle and Dual Support+** to build a "Lancekiller" that pushes a Hawkeye-less lance user's hit rate to 0. [Single; S3]
27. **Speed-tier builds want Speed +2 / Defender / All Stats +2**, because Speed thresholds (60/66/69/75 in Apotheosis) are the most important stat targets. [Single; S3]
28. **Rally skills want each other on one unit**, because rallying uses the unit's turn, so any non-rally skills on a rally unit sit idle. Stack 5 rallies on one or two dedicated "rallybots". [Wide; S3, S4, S5]
29. **Sol wants Nosferatu (on a Nostank)**, because the two heals stack (50 % + 50 % of damage dealt). [Single; S4]
30. **Dual Guard+ wants a partner that takes hits** (tank or crisis-mode lead). S4's first choice of partner skill. **Disagreement:** S3 treats Dual Guard+ as filler ("who cares?"). [Single; S4]

### Anti-synergies / conflicts

- **Vengeance vs other procs**: Vengeance is last in the priority order. Any other proc that fires replaces the near-guaranteed Vengeance trigger, so S3 advises no extra procs with Vengeance. [Mech S2; opinion S3]
- **Sol vs Luna and other damage procs**: Sol is above Luna in priority, so a Sol proc uses up the attack's one proc. S4 says to choose either a trigger heal or a trigger damage skill ("one will get in the way of the other"). [Mech S2; S4]
- **Sol/Renewal vs Vantage/Vengeance**: healing on enemy phase lifts HP above the 50 % Vantage threshold. Use Lifetaker instead. [Multi; S4, S5]
- **Procs on a full-time support are wasted.** [Multi; S3, S4]
- **Galeforce on a full-time support is wasted** (a support never gets the kill). Deliverer also needs the unit to lead. [Single; S4]
- **Counter / Lethality in Apotheosis**: cancelled by Dragonskin. [Single; S3]
- **Pavise/Aegis/Counter vs dual strikes**: they don't apply to dual strikes. [Mech; S1]
- **Vengeance on melee**: risky, because the whole map can hit back and enemy Counter can kill a 1-HP unit. [Single; S3]

---

## 3. Role taxonomy and the stats each role wants

| Role | Definition | Key stats | Sources |
|---|---|---|---|
| **Physical lead (Galeforce)** | Galeforce unit fighting in front. Archetypal classes: Sniper, Assassin, Bow Knight, Hero, Warrior (M). | **Spd** (doubling; Apotheosis tiers 60 / 66 with 48 Def / 69 / 75), **Skl** (proc rates), Str after that. With procs, mediocre Str is fine. | S3 |
| **Magical lead (Galeforce)** | Same, but a caster. Sage, Dark Flier, Valkyrie. | Spd, Skl, Mag. | S3 |
| **Physical hard support** | No Galeforce; stays in the back to supply Brave dual strikes and pair-up stats. Berserker is best (highest Str, +Spd pair-up bonus), then Warrior (M) or General (F). Hero or Bow Knight if the lead needs Spd. | **Str** first; Skl only for hit (patch it with skills); Spd/Lck/Def/Res "don't matter at all". | S3 |
| **Magical hard support** | Sage (or Valkyrie/Dark Flier for +Spd) behind a caster lead. | **Mag** first. | S3 |
| **Mixed** | Physical lead with magic support, or the reverse. Fine but loses damage against lopsided Def/Res enemies. Heroes and Bow Knights pass Skl/Spd to anyone. Levin Sword / Bolt Axe hybrids help against Counter or Aegis+ targets. | Depends on partner. | S3 (6.4) |
| **Vantage/Vengeance lead** | Enemy-phase counter-killer at low HP. Usually a Sage with a DS+ partner. | **HP** (bigger missing-HP pool), **Skl ≥ 50** (Vengeance 100 %, dual strike rate), Mag. | S3, S4, S8 |
| **Crisis / crit** | V/V + Wrath + crit stack. | Skl (Skl/2 goes to crit), weapon crit. | S3, S4 |
| **Tank (main story)** | Pavise + Aegis + Renewal lead, bait. | Def, Res, HP, **Skl** (Pavise/Aegis Skl %). | S4, S5, S6 |
| **Nostank (main story)** | Sorcerer with Nosferatu or Aversa's Night, often Armsthrift. | Mag, Res/Def, **Lck** if using Armsthrift. | S4, S5 |
| **Armsthrift bruiser** | Keeps expensive or legendary weapons going. | **Lck** (≥ 50 = 100 %). | S1, S5 |
| **Lancekiller** | Avoid tank against lance users. | **Spd, Lck** (Avoid = 1.5 Spd + 0.5 Lck). | S3 |
| **Rallybot** | 5 rally skills, flying class. | Movement (flying). Stats don't matter. | S3, S4 |
| **Staffbot** | Heal and Rescue ferry. | Mag (Rescue range, heal amount), movement. | S3 |

**Disagreement:** S4 (2013) gives full-time supports partner skills (Dual Guard+, Dual Support+). S3 gives them pure damage and hit. S3 is later and Apotheosis-specific; S4 covers general play.

---

## 4. Draft build catalog

`Context` column: **A** = Apotheosis, **L** = main-story Lunatic/L+, **G** = general endgame. `DLC` = needs DLC skills.

| ID | Build name | 5 skills | Role | Key stats | Rationale | Context | Conf. / sources |
|---|---|---|---|---|---|---|---|
| B01 | Galeforce proc archer | Galeforce, Bowfaire, Luna, Aether (or Astra), Speed +2 / Defender / Anathema | Physical lead | Spd, Skl, Str | Galeforce + faire + stable proc + procstack + filler template. Bows get past Pavise+ and hit fliers. | A, G | Multi; S3, S4 |
| B02 | Galeforce proc caster | Galeforce, Tomefaire, Luna, Astra (Aether for Chrom's daughters), Magic +2 / Defender | Magical lead | Spd, Skl, Mag | Same template. Sage is the top Galeboy class. | A, G | Single; S3 ("you'll become as sick of it as I am") |
| B03 | Galeforce Vengeance Sniper | Galeforce, Bowfaire, Vengeance, Anathema, Speed +2 | Physical lead (ranged) | Spd, Skl, HP | Vengeance is the only reliable proc. Sniper range reduces counter risk. Anathema helps the Berserker support hit. | A | Single; S3 |
| B04 | DLC Galeboy | Galeforce, weaponfaire, Luna (or Vengeance), Aggressor, Limit Breaker | Lead / part-time support | Spd, Skl, Str/Mag | Aggressor keeps damage steady whether he leads or supports. | A (DLC) | Single; S3 |
| B05 | DLC Galegirl (Lucina) | Galeforce, Aether, Luna, Dual Strike+, Limit Breaker | Physical lead | Spd, Skl | S3's "all DLCs allowed" Sumia!Lucina Sniper. | A (DLC) | Single; S3 |
| B06 | Berserker hard support | Axefaire, Strength +2, Hit Rate +20, Prescience, Even Rhythm / breaker | Physical hard support | **Str** | Raw backline damage plus patching the Berserker's poor accuracy. | A | Single; S3 |
| B06d | Berserker hard support (DLC) | Axefaire, Aggressor, Limit Breaker, Hit Rate +20, Prescience | Physical hard support | Str | Same, with the Big Three. | A (DLC) | Single; S3 |
| B07 | Sage hard support | Tomefaire, Magic +2, Anathema, Dual Support+, Tomebreaker | Magical hard support | **Mag** | Damage plus accuracy. | A | Single; S3 |
| B08 | Classic partner support | Limit Breaker, weaponfaire or Aggressor, Dual Guard+, Dual Support+, breaker / aura | Hard support | Str/Mag, Def/Res (Dual Guard) | Protect the lead and boost them. | G, L | Single; S4. **Conflicts with S3** |
| B09 | Vantage/Vengeance Sage | Vantage, Vengeance, Tomefaire, Galeforce, Hit Rate +20 (partner: faire, Hit+20, Prescience, Skill +2, **Dual Strike+**) | Enemy-phase lead | HP, Skl ≥ 50, Mag | Famous solo-clear strategy. Needs 100 % dual strikes, so DS+ in the pair. | A, L | Wide (V/V core); S3, S4, S5, S7 |
| B10 | Crisis-mode crit | Vantage, Vengeance (or Astra), Wrath, Focus / Gamble / Anathema, Galeforce / Miracle / Limit Breaker | Enemy-phase lead | Skl, weapon crit | Low HP turns on Vantage, Wrath and Vengeance together. Killer weapons or Ruin. | L, A (niche) | Wide (core trio); S3, S4, S5 |
| B11 | Nostank Sorcerer | Vengeance, Armsthrift, Lifetaker, Galeforce, Limit Breaker (with forged Nosferatu / Aversa's Night / Waste / Mire) | Main-story enemy-phase lead | Mag, Lck, Res/Def | S5's Avatar build: "beat Grima on turn 1". S4 variant: Armsthrift, Vengeance or Luna, Renewal or Sol, Miracle / Galeforce / Shadowgift. | L (DLC for LB) | Multi; S4, S5 |
| B12 | Pavise/Aegis tank | Pavise, Aegis, Renewal (or Sol / Lifetaker), Luna / breaker, Limit Breaker | Main-story tank | Def, Res, HP, Skl | Halves all weapon damage and heals each turn. | L, G | Wide; S4, S5, S6, S7 |
| B13 | Armsthrift brave bruiser | Galeforce, Armsthrift, Sol, weaponfaire / breaker, Limit Breaker or Patience | Physical lead | Lck, Skl, Str | Unbreakable forged Brave or legendary weapons. S9's L+ endgame Morgan: Galeforce, Patience, Armsthrift, Sol, Axebreaker + forged Brave Bow. | L, G | Multi; S7, S9 (S4 ranks Sol S) |
| B14 | Counter Sniper | Galeforce, Counter, Vantage, Vengeance, Limit Breaker | Main-story enemy-phase archer | HP, Skl | Punishes melee with Counter and 2–3 range with Vantage/Vengeance. S5 backs Counter Sniper (Double Bow). | L | Multi (Counter Sniper idea); S5, S7 |
| B15 | Lancekiller | Lancebreaker, Avoid +10, Galeforce, Vengeance, Anathema (partner: Dual Support+; staffbot: Charm / Demoiselle) | Avoid tank against a lance boss | Spd, Lck | Zero out a Hawkeye-less lance boss's hit rate (Anna). | A (challenge runs) | Single; S3 |
| B16 | Rightful King procstack (son of Chrom) | Galeforce, Bowfaire, Luna, Astra, Rightful King | Physical lead | Skl, Spd | RK ≈ a free extra proc. | A, G | Multi; S3, S5, S6 |
| B17 | Triple-proc Sniper (Chrom/Lucina) | Bowfaire, Aether, Luna, Rightful King, Dual Strike+ | Physical lead (no Galeforce) | Skl | Chrom's preferred Apotheosis set. Lucina can reach all five. | A | Single; S3 |
| B18 | 100 % Dual Strike pair | Limit Breaker, Galeforce, Bowfaire, Vengeance, All Stats +2 (support Hero: LB, Axefaire, Aggressor, Patience, All Stats +2) | Lead + support | Combined Skl ≥ 160 | Guaranteed dual strikes without DS+. S3 is lukewarm on it. | A (DLC) | Single; S3 |
| B19 | Duo rallybot, male | Rally Strength, Rally Skill, Rally Luck, Rally Defence, Rally Resistance* | Rallybot | n/a (flier) | *Rally Resistance only on units with innate access (SpotPass Horace). Normally the male takes Str, and the rest goes to the female. | A, G | Multi; S3, S4 |
| B20 | Duo rallybot, female | Rally Magic, Rally Speed, Rally Movement, Rally Spectrum, Rally Heart | Rallybot | n/a | Female-only rallies go here. | A, G | Multi; S3, S4 |
| B21 | Solo rallybot | Rally Spectrum, Rally Heart, Rally Speed, Rally Skill, Rally Magic (Rally Strength only on DLC Palla/Katarina) | Rallybot | n/a | Covers the stats that matter with one unit. | A | Single; S3 (S5 mentions Katarina) |
| B22 | Staffbot | Tomefaire / Lancefaire, Acrobat or Healtouch, Movement +1, Magic +2, All Stats +2 / Hex / Charm / Anathema | Support | Mag, movement | Rescue and heals free up combat units' slots. | A | Single; S3 |
| B23 | Dancer (Olivia) | Special Dance, Galeforce, Swordfaire, Astra, Pass (or Special Dance only) | Support | n/a | Special Dance +2 Str/Mag/Def/Res. | A | Single; S3 |

**Disagreement (Rally tiers):** S4 calls Rally Skill and Rally Luck "bad". S3 makes Rally Skill a core pick for the solo rallybot, and uses Rally Luck for Lancekiller strategies.

**Disagreement (Sol / Lethality):** S4 (2013) ranks **Sol S-tier**, Vengeance B, Lethality C. S3 (2018/2023, Apotheosis) calls Sol and Lethality useless there and makes Vengeance the top stable proc. S7 and S9 still use Sol in main-story L+ endgames. Likely resolution: Sol is good for main-story sustain and bad for Apotheosis burst.

---

## 5. The 10 rally skills

Each gives +4 to one stat for 1 turn in a 3-tile radius, except where noted. They don't stack with themselves but do stack with Spectrum and Heart (S1 [Mech]).

| Rally | Class (level) | Effect | Gender limit | Sources |
|---|---|---|---|---|
| Rally Strength | Warrior (5) | Str +4 | Male (except DLC Palla / Katarina, who start with it) | S1, S3 |
| Rally Magic | Sage (5) | Mag +4 | none | S1 |
| Rally Skill | Bow Knight (5) | Skl +4 | none | S1 |
| Rally Speed | Falcon Knight (5) | Spd +4 | Female | S1, S3 |
| Rally Luck | War Monk / War Cleric (5) | Lck **+8** | none | S1 |
| Rally Defence | General (5) | Def +4 | none | S1 |
| Rally Resistance | Valkyrie (5) | Res +4 | Female (some SpotPass males start with it) | S1, S3 |
| Rally Movement | Dark Flier (5) | Mov +1 | Female | S1, S3 |
| Rally Spectrum | Grandmaster (15) | All stats +4 | Tactician line only: Robin, Morgan, Robin's other children, SpotPass/DLC units with full class access | S1, S3 |
| Rally Heart | Bride (1, DLC) | All stats +2, Mov +1 | Female (DLC) | S1, S3 |

Stacking everything gives +8 to each stat (+10 with Rally Heart) and +1 or +2 Mov (S3). Consensus: all rallies go on dedicated flying rallybots, and SpotPass units are ideal because they have all classes but no supports to waste (S3, S4) **[Multi]**. S4 ranks Spectrum and Heart A-tier and the others B/C.

---

## 6. Per-child consensus

"Core" is what multiple sources agree on. Anything marked [Single] is one guide's opinion. Parent choice sets which skills a child can reach. That's the calculator's job; the notes here only say which parent the sources name for a build.

### Lucina
- **Core:** Galeforce (from Sumia / Olivia / Maribelle via Pegasus) + inherited **Aether** + **Dual Strike+** [Wide; S3, S5, S6]. Luna as the stable proc [Multi; S3].
- S3 builds (Apotheosis): Sumia!Lucina **Sniper**: Galeforce, Aether, Luna, Bowfaire / Speed +2, DS+. Olivia!Lucina **Assassin**: Galeforce, Luna, Aether, Defender, DS+. Maribelle!Lucina Valkyrie / Sage caster.
- **Disagreement:** S5 and S6 favour **Great Lord** with Swordfaire + Lancefaire (Olivia) or Pavise / Aegis + Rightful King (Sumia). S3 prefers Sniper or Assassin for bows and speed.
- Also the natural DS+ partner for V/V setups (S3).

### Owain
- **Core:** inherit **Galeforce from Lissa** [Wide; S3, S5, S6].
- Caster Sage (Ricken / Libra / Henry dads): Galeforce, Tomefaire, Astra, Luna, Magic +2; Vengeance / Vantage variants for Libra / Henry [Multi; S3, S5 (Ricken Sage), S7 (Sage V/V)].
- Physical (Stahl): Assassin Galeforce, Bowfaire, Luna, Astra, Defender (S3).
- [Single] S6: Vantage + Wrath Swordmaster / Assassin with a Killing Edge. S5: strong Dread Fighter.

### Inigo
- **Core:** Galeforce from Olivia [Wide; S3, S5, S6]. Starts with Armsthrift (S5).
- Chrom!Inigo: Rightful King + Luna / Astra (B16), Assassin or Bow Knight [Wide; S3, S5, S6].
- Libra! or Henry!Inigo: Vantage + Vengeance (+ Wrath) Sage / Sorcerer [Multi; S3, S5].
- Stahl!Inigo Warrior: Galeforce, Bowfaire, Astra, Luna, Hit +20 (S3).
- [Single] S7: Limit Breaker, Armsthrift, Sol, Counter, Aegis.

### Brady
- **Core:** Galeforce from Maribelle; he can't get it otherwise [Multi; S3, S6].
- S3: "99% of the time" a **Sage** Galeboy: Galeforce, Tomefaire, Luna, Rightful King (Chrom!) or Astra, Magic +2 / Defender.
- **Disagreement:** S6 has Donnel!Brady as a War Monk with Armsthrift (never-breaking Helswath). S5 has Gaius / Lon'qu!Brady as a glass-cannon Dread Fighter. S7 has Sage with Galeforce, Tomefaire, Lifetaker, Renewal, LB.

### Kjelle
- **Core:** Galeforce through a Pegasus-passing dad (Gaius / Donnel) [Multi; S3, S5].
- Offensive (S3): "glorified mooksweeper". Galeforce, Lancefaire / Swordfaire, Luna, Astra, Defender (General / Paladin / Hero / Wyvern Lord).
- **Disagreement:** the main-story sources treat her as the **Pavise + Aegis (+ Renewal) tank** [Wide for that role; S5, S6, S7]. S7: Armsthrift, Sol, Pavise, Aegis, LB.

### Cynthia
- **Core:** native Galeforce. Chrom!Cynthia gets Aether [Multi; S3, S5].
- S3 caster default ("99% of the time"): Dark Flier: Galeforce, Tomefaire, Vengeance (or Luna), Anathema, Speed +2. Physical Chrom!Cynthia Sniper: Galeforce, Aether, Luna, Bowfaire / Speed +2, Defender.
- [Single] S7: LB, Iote's Shield, Lethality, Renewal, Galeforce.

### Severa
- **Core:** native Galeforce and Armsthrift (Mercenary) [Multi; S5, S6].
- S3 flagship: Virion!Severa **Sniper**: Galeforce, Bowfaire, Vengeance, Anathema / Hit +20, Speed +2. Stahl!Severa is "the best Robinless set". Lon'qu!Severa is the Lancekiller Hero (B15).
- S5: Stahl!Severa uses Galeforce, Sol, Luna, Armsthrift, Patience. Lon'qu!Severa is a dodge tank.
- S7: LB, Armsthrift, Galeforce, Vantage, Vengeance (or Astra / Sol / Lethality / Luna).
- **Disagreement:** Vengeance Sniper (S3) vs Sol / Armsthrift sustain (S5, S7).

### Gerome
- **Core:** no Galeforce access, so he's a support or tank [Multi; S3, S5].
- S3: **Berserker hard support**: Axefaire, Strength +2, Tomebreaker / Axebreaker / Swordbreaker (Henry! preferred for Berserker + Dark Mage hit). He is also the Lancekiller support of choice with Dual Support+.
- **Disagreement:** S5 and S6 frame him as a **Wyvern Lord tank** with Renewal (+ Luna / Aegis from Frederick). S7: LB, Pavise, Aegis, Iote's Shield, Sol.

### Morgan
- **Core:** always has Galeforce (Morgan-F learns it; Morgan-M inherits it from Robin-F), plus full class access. Widely called the best unit [Wide; S3, S5, S6].
- Builds follow the lead archetypes (B01–B03, B09). Lucina!Morgan-F inherits Aether (S3, S6). Chrom!Morgan-M gets Rightful King (S6). Aversa!Morgan gets Shadowgift (S3, S6).
- S3: Sumia!Lucina!Morgan is "a contender for the game's single best Apotheosis unit". S9 (L+): Galeforce, Patience, Armsthrift, Sol, Axebreaker.

### Yarne
- S3: nearly always a **Berserker hard support**: Axefaire, Strength +2, Hit Rate +20, Prescience, Even Rhythm. Virion / Stahl / Ricken dads for the Archer or Dark Mage hit skills. "It's so damn good there's no point showing ... anything other than Berserker".
- S6 agrees on Berserker skills (Wrath, Axefaire) but prefers **Warrior** as the final class. Donnel!Yarne gets Armsthrift for Beaststones.
- [Single] S7: LB, Armsthrift, Astra / Lethality / Sol, Counter / Vantage.

### Laurent
- S3: **Sage hard support** (Tomefaire, Magic +2, Anathema, Dual Support+, Tomebreaker) or "Nerdzerker" Berserker support. With a Myrmidon dad, a **V/V lead** (Vantage, Vengeance, Tomefaire, Anathema, Magic +2). The only child who reaches the 155-crit build (Gregor / Lon'qu / Gaius dads).
- S5: Gregor!Laurent gets Armsthrift for Sorcerer tanking plus the Vantage / Vengeance / Wrath combo [Multi with S3 on V/V].
- [Single] S7 lists six skills (LB, Astra / Vengeance, Vantage, Tomefaire, Counter, Lifetaker). That is over the 5 limit, so it has to be trimmed.

### Noire
- **Core:** Gaius is the best dad, for Galeforce + Astra + Assassin on top of her innate Bowfaire, Luna and Vengeance [Multi; S3, S5].
- S3: Gaius!Noire Assassin: Galeforce, Bowfaire, Vengeance, Speed +2, HP +5, "the other best Robinless set". Or Bow Knight with Luna + Astra.
- Main story: Counter Sniper (S5). S7: LB, Galeforce, Vantage, Vengeance, Counter (Nosferatu / Aversa's Night).

### Nah
- S3: "procless and slow", so Galeforce isn't worth it. She is a **hard support**: Valkyrie behind a Sage Galeboy, Hero or Wyvern Lord behind physical leads. Crit-bait Valkyrie with Tomefaire, Vengeance, Wrath, Focus, Dual Support+.
- **Disagreement:** S5 and S6 like **Donnel!Nah** (Galeforce + Armsthrift on Dragonstone+, with innate Lifetaker) and **Henry!Nah** as a Nosferatu Sorcerer tank. S7: LB, Armsthrift, Galeforce, Renewal / Sol, All Stats +2.

---

## 7. Implications for the loadout suggester (proposed, not consensus)

1. **Tag every skill** with where it works: `lead-only` (all procs, Galeforce, Vantage, Pavise, Aegis, Counter, Miracle, Deliverer), `either-slot` (faires, stat +N, Aggressor, Limit Breaker, Hit+20 / Prescience per S3, auras), and `pair` (DS+, Dual Guard+, Dual Support+). Do this before matching builds.
2. **Model builds as templates with slots**, not fixed 5-lists. For example, a lead template is `Galeforce` + `faire(matching weapon)` + `stable proc` + `procstack | filler` + `filler`. The S3 per-child sets are mostly this template with parent-specific fill.
3. **Encode the proc priority** and the "no extra procs with Vengeance" and "Sol vs Luna" conflicts as penalties.
4. **Take a context switch** (main-story vs Apotheosis, DLC allowed or not). The top build flips between them: tank / Sol in the main story, burst / Vengeance in Apotheosis.
5. **Stat checks per build**: Skl for proc rates and dual strikes, Lck for Armsthrift, HP for Vengeance, Spd tiers for Apotheosis.

---

## 8. Gaps and caveats

- **Serenes Forest forums** returned HTTP 403 to automated fetches, and **Reddit** was blocked. Forum and Reddit views are therefore under-represented. The main Reddit-linked source is S3, which was cross-posted to r/fireemblem (post `a4vscy`). A human skim of SF threads such as "Teams You Used For Apotheosis" (topic 56830) and "Optimizing Apotheosis Recommendations" (topic 54861) would help.
- S3 is one author, but it is the most detailed and most recent source (v2, after the eShop closed in 2023). Many S3-only claims are marked [Single] on purpose.
- S7 is one GameFAQs user who says they're "not really expert". It is included as a casual-player data point.
- S6 (2013) is marked "Under Construction" and has small inaccuracies (for example, Lethality rate phrasing).
- **Open mechanics question:** S1 says Pavise and Aegis don't apply to dual strikes. S3 implies enemy **Pavise+ / Aegis+** do reduce dual-strike damage in Apotheosis. These may be different skills; this needs checking before the suggester uses it.
- Main-story Lunatic/L+ consensus is thinner than Apotheosis consensus. Most deep optimisation writing targets Apotheosis.

---

## Sources

| ID | Source | Type / date |
|---|---|---|
| S1 | Serenes Forest, *Awakening: Skills* — https://serenesforest.net/awakening/miscellaneous/skills/ | Reference site (mechanics) |
| S2 | Serenes Forest, *Awakening: Calculations* (proc priority, dual strike formula) — https://serenesforest.net/awakening/miscellaneous/calculations/ | Reference site (mechanics) |
| S3 | soly, *FE:A Apotheosis Character Build Guide* v2 — https://docs.google.com/document/d/13b2KxYlWGqnMPbXMqjGj850dKa88sAytTCCJw7gpaS4/ (cross-posted https://www.reddit.com/r/fireemblem/comments/a4vscy/) | Community guide, ~2018, v2 ~2023 |
| S4 | guedesbrawl (Rafael Guedes), *Fire Emblem: Awakening Skill FAQ* v1.2 — https://gamefaqs.gamespot.com/3ds/643003-fire-emblem-awakening/faqs/66998 | GameFAQs guide, May 2013 |
| S5 | TV Tropes, *GameBreaker / Fire Emblem: Awakening* — https://tvtropes.org/pmwiki/pmwiki.php/GameBreaker/FireEmblemAwakening | Crowd-sourced |
| S6 | Thenewguy34, *Awakening Children Characters: How to Maximize Their Potential* (Fire Emblem Wiki, Fandom user blog) — https://fireemblem.fandom.com/wiki/User_blog:Thenewguy34/Awakening_Children_Characters:_How_to_Maximize_Their_Potential | Fandom user blog, Mar 2013 |
| S7 | GameFAQs Q&A, *What are the best skills for my units?* — https://gamefaqs.gamespot.com/3ds/643003-fire-emblem-awakening/answers/382881-what-are-the-best-skills-for-my-units | Single user answer |
| S8 | Fire Emblem Wiki (fireemblemwiki.org): *Aggressor*, *Vengeance*, *Rightful King*, *Galeforce* — https://fireemblemwiki.org/wiki/Aggressor etc. | Wiki (mechanics) |
| S9 | No Contest Creations, *Fire Emblem: Awakening — Resetless Lunatic+ Endgame* — https://no-contest-creations.com/fire-emblem-awakening-resetless-lunatic-endgame/ | Blog playthrough |
