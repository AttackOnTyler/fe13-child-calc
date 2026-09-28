# How Awakening's enemy AI decides when to move and whom to attack

Answers [#254](https://github.com/AttackOnTyler/fe13-child-calc/issues/254) (part of map #253).
Checked on 2026-09-28 against the user's own dump, *Fire Emblem Awakening (US), CTR-P-AFEE v0.0.0*.
This builds on [`docs/research/fe13-map-terrain.md`](https://github.com/AttackOnTyler/fe13-child-calc/blob/research/fe13-map-terrain/docs/research/fe13-map-terrain.md)
(branch `research/fe13-map-terrain`), which covers the LZ13 wrapper, the `.bin` container and the dispos layout.
No ROM bytes are committed here. Everything below is a derived fact (field offsets, command names, ids, counts).

**Confidence labels used below:**
- **ROM**: read directly from the game's data files.
- **ROM + tool**: the ROM, with the field's meaning taken from a community tool.
- **Observed**: seen in attempt 1 of the Prologue (`docs/play-log/p02-prologue.md` on `play/azahar-harness`).
- **Folklore**: player reports, some of them tested, but not traced to data or code.
- **Open**: not settled.

## TL;DR

1. **What makes a waiting enemy start moving is written per unit in the map data.** Each placement names an
   *action* condition, e.g. `AI_AC_Everytime` (moves from turn 1), `AI_AC_AttackRange` (moves once a player unit is in its reach),
   `AI_AC_TurnAttackRange(n)` (from turn *n*, or earlier if a player unit is in its reach), `AI_AC_BandRange` (group trigger) or
   `AI_AC_FlagTrue(flag)` (an event flag). Each placement also has a **band (group) number**. (ROM)
2. **Prologue, Lunatic:** Garrick and the five northern units (2 Myrmidons, the Elthunder Mage, 2 Barbarians) are the
   waiting groups. The five northern units are `AI_AC_AttackRange` in **band 1**. The five southern units are
   `AI_AC_Everytime`, so they move on enemy phase 1 whatever you do. This matches attempt 1 exactly. (ROM + Observed)
3. **Garrick** has the "can't move" flag, with `AI_AC_Everytime` / `AI_AT_Attack`. Every enemy phase he attacks any unit
   his weapon reaches **from his own tile** (8,1). His placement lists a Hand Axe, the game shows a Short Axe on
   Lunatic (P02-S1), and both have range 1–2. (ROM + Observed)
4. **Target choice is not in the data.** Every ordinary enemy uses the same two commands, `AI_AT_Attack` and `AI_MV_NearestEnemy`,
   and the scoring lives in code. The best evidence is tested folklore: the AI **takes a kill when it has one**,
   weighs **hit chance**, prefers attacks that **avoid a counter**, ignores proc skills, and **doesn't avoid attacks it dies to**
   when those are all it has. Attempt 1 agrees with all of these. (Folklore + Observed)
5. **Pair-ups:** the AI can only attack the lead, which is a game rule. Whether it scores Dual Guard or Dual Strike is **open**.

## 1. Where the AI settings live

### 1.1 Per unit: the dispos spawn record (`data/dispos/<CH>.bin.lz`, 0x74 bytes)

Field names come from Paragon's FE13 `Spawn` type
([thane98/paragon `Data/FE13/Types/Dispo.yml` @ d11d601](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/Types/Dispo.yml)).
Offsets are relative to the record. The tail bytes are this study's own decoding.

| Off | Type | Field | Notes |
|---|---|---|---|
| 0x11 | u8 | spawn flags 2 | 0x01 Lunatic, **0x08 boss**, **0x10 can't move** (Paragon's `UI/Modules/Spawn.yml` labels: "Boss (?)", "Can't move") |
| 0x44 | ptr | **action** (`AI_AC_*`) | when the unit becomes active |
| 0x48 | ptr | action param | e.g. `3` (a turn), `FLAG_敵突撃`, `V_Default,PID_サイリ` |
| 0x4C | ptr | **mission** (`AI_MI_*`) | a standing goal: village, chest, escape, talk |
| 0x50 | ptr | mission param | e.g. `pos(18,3)` |
| 0x54 | ptr | **attack** (`AI_AT_*`) | whom it may attack or heal |
| 0x58 | ptr | attack param | e.g. `PID_ノワール` |
| 0x5C | ptr | **move** (`AI_MV_*`) | where it walks when it can't act |
| 0x60 | ptr | move param | |
| 0x64 | u8 | AI flags (undecoded) | almost always 0x69; **bit 0x80 is set only on units with a band ≠ 0** (ROM-wide, no exceptions) |
| 0x68 | u8 | unknown | 0x32 (50) on 97% of units; also 75, 80 and 0. Possibly a heal/retreat HP% (Engage's dispos has `AI_HealRateA=75`, `AI_HealRateB=50`). **Open** |
| 0x69 | u8 | **band number** | 0 = none; 1..13 group units that wake together. See §2.3 |
| 0x6A.. | | zero in every record | |

The strings are the same four families that Fates and Engage use (`AI_ActionName`, `AI_MindName`, `AI_AttackName`,
`AI_MoveName`, and in Engage also `AI_BandNo`)
([RainThunder/fefates-tools `Dispos/README.md`](https://github.com/RainThunder/fefates-tools/blob/master/Dispos/README.md);
Engage: [laqieer/FE17-DOC `fe_assets_gamedata/dispos`](https://github.com/laqieer/FE17-DOC/tree/master/fe_assets_gamedata/dispos)).

### 1.2 The command definitions: `data/AIData.bin.lz` (primary)

The romfs has **`data/AIData.bin.lz`**, the table that defines every AI command. It uses the same LZ13 / `.bin` container,
with 69 labels, one per command. Each command is `{ptr name, u32 id}` followed by a list of **primitive ops**, 12 bytes each
(`u32 op` plus two parameter pointers), ending with `0x80000000`. Parameters are strings such as `-4` and `-5`, which read as
references to the dispos param's 1st and 2nd comma-separated values (inferred from how the commands use them).

The ids match the save-file AI ids that fire-editor-awakening decoded independently from suspend data
([Danius88/fire-editor-awakening `RawBlockEnd.java`](https://github.com/Danius88/fire-editor-awakening/blob/main/src/main/java/com/danius/fireeditor/savefile/units/mainblock/RawBlockEnd.java):
AttackRange 0x02, BandRange 0x04, Turn 0x0A, FlagTrue 0x0B, TurnAttackRange 0x0D, and so on), which cross-checks both sources.

**Action commands**, with the primitive list read from AIData:

| id | Command | Primitive ops (param refs) | Used in dispos |
|---|---|---|---|
| 0x00 | `AI_AC_Null` | none: never activates | 246 |
| 0x01 | `AI_AC_Everytime` | `Everytime` | 4619 |
| 0x02 | `AI_AC_AttackRange` | `AttackRange(-4, -5)` | 378 |
| 0x03 | `AI_AC_AttackRangeExcludePerson` | `AttackRangeExcludePerson(-4, -5)` | 2 |
| 0x04 | `AI_AC_BandRange` | `BandRange(-4)` | 101 |
| 0x05/06 | `…BandRangeExcludePerson`, `…BandRangeExcludeFriend` | | 0 |
| 0x07 | `AI_AC_HealRange` | `HealRange` | 0 |
| **0x08** | **`AI_AC_Attacked`** | **`Attacked`**, a primitive of a different kind (op type 2, not 1) | **0** |
| 0x09 | `AI_AC_Area` | `Area(-4, -5)` | 0 |
| 0x0A | `AI_AC_Turn` | `Turn(-4)` | 12 |
| 0x0B/0C | `AI_AC_FlagTrue` / `FlagFalse` | `FlagTrue(-4)` | 82 / 0 |
| 0x0D | `AI_AC_TurnAttackRange` | **`Turn(-4)` + `AttackRange(-5)`** | 366 |
| 0x0E | `AI_AC_TurnBandRange` | `Turn(-4)` + `BandRange(-5)` | 5 |
| 0x0F | `AI_AC_TurnAttackRangeHealRange` | `Turn` + `AttackRange` + `HealRange` | 3 |
| 0x10 | `AI_AC_FlagTrueAttackRange` | `FlagTrue(-4)` + `AttackRange(-5)` | 184 |
| 0x12/13 | `…FlagTrueBandRange`, `…FlagFalseBandRange` | | 0 |
| 0x14 | `AI_AC_FlagTrueAttackRangeExcludePerson` | `FlagTrue` + `AttackRangeExcludePerson` | 2 |

Compound commands are **lists of primitive triggers**. §2.2 shows they behave as OR (any one wakes the unit).

**Attack commands:** every `AI_AT_*` starts with the same op (0x29), then:
- `AI_AT_Attack` adds attack op 0x00 with flag byte `00`.
- `AI_AT_MustAttack` adds **the same op with flag byte `FF`**.
- `Heal` is op 0x14; `Person(-4)` and `Job(-4)` filter the target; `Idle` has no action op.

The data shows only that "must" is a flag on the ordinary attack. What it changes (for example, attacking even when the score
says not to) is in code and is **open**.

**Move commands:**
- `AI_MV_NearestEnemy` = op 0x52 (param `-2`), then op 0x51.
- `AI_MV_AttackRange` = op 0x52 (param `-4`), then 0x51.
- `AI_MV_Person` puts op 0x57 (that person) before 0x52.
- `AI_MV_Position` is op 0x59.

The name says the default move heads for the **nearest** foe. Fates has a separate `AI_MV_WeakEnemy`, but Awakening's AIData has no
"weak enemy" move.

**How the ROM uses them (all dispos, all teams except player):**
- **Attack:** `AI_AT_Attack` 5425, `Null` 244, `Person` 143, `MustAttack` 55, `X017Enemy` 56, `AttackToHeal` 47; the rest are rare.
- **Move:** `AI_MV_NearestEnemy` 5407, `Null` 293, `Person` 105, `NearestEnemyExcludePerson` 75.
- **Mission:** `AI_MI_Null` 5937 of about 6000. Villages, chests and escapes make up the rest.

### 1.3 Reading them

A scratch script prints this for any chapter. It's the extractor's `Bin` class plus these offsets:
`action = str(at+0x44) … moveParam = str(at+0x60)`, `band = u8(at+0x69)`. `AIData` is dumped as u32 words, with pointer slots
resolved. Extending `scripts/play/maps/extract.ts` (on `play/azahar-harness`) to emit `ai: {action, param, attack, move, band}` per
spawn would be a small change.

## 2. Triggers: when a waiting enemy starts moving

### 2.1 The rules

| Rule | Status | Source | What would confirm it in play |
|---|---|---|---|
| `Everytime` units act from enemy phase 1 | **ROM + Observed** | dispos; P02 EP1: the (4,10) Myrmidon, (1,8) Barbarian, the Elwind Mage and the south group all moved | already seen |
| `Null` units never act on their own (Premonition's Validar: `AC_Null`, `AT_Null`, `MV_Null`) | **ROM + Observed** | dispos; chapter data "Does not initiate combat" | already seen |
| `AttackRange` wakes a unit once a player unit is inside its **reach** (Mov + weapon range, over terrain), and it acts in that same enemy phase | **ROM** (name, ops) + **Observed** + Folklore | Prologue northern group: still at T5 with Frederick at (5,11), which is out of reach; both Myrmidons attacked on EP6 after he stood at (7,6). The SF thread: "Second wave doesn't move until you are in range of one of the second wave enemies" | stand one tile outside a band member's reach for a turn (it stays), then one tile inside (it attacks that EP) |
| `AttackRange`'s 1st param is a range setting: blank, `0` or `V_Default` | **ROM** (param values) | dispos | **Open.** `AttackRange(0)` may mean weapon range only, with no movement. Test it on Ch 2 (Normal boss) or the Ch 8 south pack |
| `TurnAttackRange(n)` = wakes on turn *n* **or** when in reach (OR, not AND) | **ROM + Folklore** | AIData lists `Turn` + `AttackRange`. SF's Ch 4 Lunatic report matches the data exactly: knights `TurnAttackRange(2)`, hand-axe Fighters `(3)`, Marth `(4)` (and on Normal/Hard he's `AttackRange` only, "Lunatic mode only"): "Map is aggroed per turn … Any enemy can be aggroed if you get in their range" | on Ch 4, see Marth move on EP4 untouched; approach a knight on T1 and see it move early |
| `FlagTrue(FLAG_敵突撃)` ("enemy charge") = wakes when the chapter script sets the flag, usually on a reinforcement turn | **ROM** + Folklore | 226 records use it. SF: "the whole map is aggroed when reinforcements arrive" (Ch 9–13) | see a waiting group all move on the reinforcement turn |
| Being attacked wakes a waiting unit | **Open** | `AI_AC_Attacked` exists as its own primitive but **no Awakening placement uses it**. SF says the Ch 8 south pack wakes "when attacked", but that's anecdotal. On the Prologue this can't come up: nobody out-ranges the waiting units | on a later map, chip a waiting unit from outside its reach (a bow or tome at range 2 against a Mov-0 range), then see if it moves |
| Move order within the enemy phase follows the dispos order, except that a unit which can kill goes first | **Folklore** | SF (BlueFire, XeKr, darkkfan). Attempt 1 EP1: the (4,10) Myrmidon, earlier in dispos, acted before the (1,8) Barbarian | log each EP's acting order against the dispos order |

### 2.2 Bands (groups)

**ROM:** byte 0x69 is a group number. Units sharing a band are the "tied together" waves of the community notes.
- In every chapter checked, the same units share a band on Hard and on Lunatic.
- Byte 0x64 bit 0x80 is set **only** when the band is nonzero.
- Some banded units lack the bit. Ch 2 Normal's (6,3) Barbarian and (13,3) Soldier are band 1 without it; the boss is band 1 with it.
  So the bit may mark a unit whose waking spreads to its band, with the bitless members only receiving. That is a **hypothesis**.

The evidence that a band wakes together:

- **Prologue, Hard:** all three northern units (2 Myrmidons and the Thunder Mage) are `AttackRange` in band 1 with bit 0x80. The
  chapter data (the Fire Emblem Wiki) says: "The northern two both begin moving if either of them or the nearby Mage is
  provoked", and the Mage "begins moving if a nearby Myrmidon is provoked". That behaviour is band chaining, not three
  separate range checks. (ROM + wiki)
- **Prologue, Normal:** the one northern Myrmidon is band 1, and the (7,9) Barbarian is `AttackRange` with no band. The wiki gives
  the Normal Barbarian no "unprovoked" note. (ROM matches the wiki)
- **Prologue, attempt 1 (Lunatic):** after EP6 the whole band was active. The Elthunder Mage had come down to (5,8) by T8, and the
  (6,2)/(10,2) Barbarians attacked on EP8 and EP9. The log doesn't say whether the Barbarians started on EP6, and the geometry puts
  (7,6) within their own reach too. **Not decisive.**

`AI_AC_BandRange` (101 uses: Ch 2, 3, 8, 9, 10, 16, 20, Paralogues 1, 15, 18, 20, 21) often sits on the Lunatic copy of a
group that is `AttackRange` + band on Hard. Two independent SF reports say such a group wakes only when **two** of its
members have you in reach:
- Ch 2 Lunatic: "Second wave won't move until you are in range of TWO enemy units of the second wave". The ROM has that wave as
  `BandRange`, band 1, 7 units.
- Ch 8's Fighter and Dark Mage: "aggroed when in range of both". The ROM has them as `BandRange`, band 2.

Engage's `AI_AC_BandRange` param is `"100, 2"`, which looks like a count of 2. **So `BandRange` = wake when ≥2 band members
have a player unit in reach** is plausible but **not confirmed** (Folklore + circumstantial). The Prologue doesn't use `BandRange`.

### 2.3 The Prologue, Lunatic, decoded

`P002`, the Enemy faction, Lunatic records (flags2 & 0x01). All of them use `AI_MI_Null`, `AI_AT_Attack` and `AI_MV_NearestEnemy`.

| Tile | Unit (weapon in dispos → Lunatic) | Action | Band | Other |
|---|---|---|---|---|
| (8,1) | **Garrick** (Hand Axe → Short Axe) | `Everytime` | 0 | flags2 0x19 = Lunatic + **boss** + **can't move** |
| (7,3) | Myrmidon (Bronze → Iron Sword) | `AttackRange` | **1** | bit 0x80 |
| (9,3) | Myrmidon | `AttackRange` | **1** | bit 0x80 |
| (8,2) | Mage (Thunder → Elthunder) | `AttackRange` | **1** | bit 0x80 |
| (6,2) | Barbarian (Bronze → Iron Axe) | `AttackRange` | **1** | bit 0x80, Lunatic only |
| (10,2) | Barbarian | `AttackRange` | **1** | bit 0x80, Lunatic only |
| (10,6) | Mage (Wind → Elwind) | `Everytime` | 0 | |
| (7,9) | Barbarian | `Everytime` | 0 | (Normal: `AttackRange`) |
| (4,10) | Myrmidon | `Everytime` | 0 | |
| (1,8) | Barbarian | `Everytime` | 0 | |
| (9,12) | Myrmidon | `Everytime` | 0 | Lunatic only |

For the planner:
- The five southern units, including the Elwind Mage, are all `Everytime` and act from EP1.
- The northern five are one band. They hold until a player unit is inside one member's Mov + weapon reach at the start of an enemy phase.
  Then (by the band evidence) all five act, and each attacks in that same phase if it can reach someone.
- Garrick never leaves (8,1).

Items in dispos are the Normal-tier weapons. Lunatic shows the upgraded tier (Bronze → Iron, Thunder → Elthunder,
Hand Axe → Short Axe; P02-S1). The app's chapter data already carries the Lunatic weapons.

## 3. Stationary bosses (Garrick)

- **ROM:** Garrick is `AI_AC_Everytime` / `AI_AT_Attack` / `AI_MV_NearestEnemy` with the **can't-move flag (flags2 0x10)**. He is active
  from turn 1 but pinned, so each enemy phase he attacks whoever his weapon reaches **from (8,1)**, and he never walks.
- The flag's meaning is Paragon's label. The ROM behaves the way that label says:
  - Premonition's Validar (0x19) stays put.
  - Ch 4 Marth (flags2 0x08 or 0x09, boss **without** 0x10) walks from turn 4. SF's report agrees.
  - Ch 5's boss (no 0x10) moves once woken.
- **Range 1–2:** the Short Axe (Lunatic's upgrade of the listed Hand Axe) reaches the tiles at Manhattan distance 1–2 from (8,1). With
  no movement component, his danger zone is just that diamond, clipped by the map (row 0 is obstacle).
- **Observed:**
  - T10: Frederick at (8,6) was left alone ("Garrick holds his ground").
  - EP11: after Frederick attacked from (8,2), Garrick attacked him at range 1 and died on the counter.
- **Still to see:** Garrick throwing at range 2. Leave a unit at (8,3) or (6,1)/(10,1)-type distance-2 tiles at the end of a
  player phase. The prediction is that he attacks. He picks the target by the same scoring as everyone else (§4).
- Across the ROM, bosses aren't always pinned. 0x10 is set per placement, and it isn't implied by the boss bit.

## 4. Target selection: whom an attacker picks

**No primary source.** The data only says `AI_AT_Attack` (may attack anyone) versus `Person`/`ExcludePerson`/`Job` filters, or
`MustAttack`. The scoring is in `code.bin`: AIData's primitive ops dispatch into code, and `code.bin` holds none of the command
names, only four stray strings. Reversing that is the only way to make these rules "confirmed".

The best available evidence is the Serenes Forest "Official AI Topic" (Jun–Aug 2013, 62 posts), much of it Lunatic, some of it
tested from bookmarks: [forums.serenesforest.net/topic/40909](https://forums.serenesforest.net/topic/40909-the-official-ai-topic/).

| Rule | Status | Evidence | What would confirm it in play |
|---|---|---|---|
| **Kill first.** If it can kill someone this phase, it does; allies even sequence attacks to set up a kill | **Folklore (strong)** + **Observed** | SF OP; XeKr ("very good at calculating if something can kill … team up in combination"); darkkfan (Ch 12 L+). **Attempt 1 EP3:** the Elwind Mage could reach Lissa (17 HP, doubled for 20: a kill) and Frederick; it took Lissa | on a bookmark, offer one killable and one tanky target in the same reach, repeat EP; count the choices |
| **Hit chance is weighed.** A 0% target is skipped for a hittable one even at lower damage | **Folklore (anecdote)** | SF OP (Lon'qu on a fort vs Panne) | put a high-Avo unit and a lower-Def unit in reach; see which is attacked |
| **Avoid a counter when it can:** 1–2 range units attack from 2 against melee, and Warriors use their bows | **Folklore (tested)** | Interceptor: about 25 bookmark runs on Ch 20 L+; XeKr's tests. Terrain-over-counter claims were contested in the same thread | Prologue: a Mage (range 1–2) against a melee-only unit should cast from range 2 |
| **Proc skills are ignored** (Luna, Aether) and so are -faire skills; weapon effects (brave, stat boosts) are counted | **Folklore** | SF OP / Airship Canon | not needed for the Prologue |
| Crit chance counts toward a kill | **Folklore (weak)** | SF OP: "Not 100% proven" | |
| **Doesn't avoid suicidal attacks** when its only reachable target will kill it | **Observed** | Attempt 1: EP1 (4,10) Myrmidon, EP6 both Myrmidons, EP8 and EP9 Barbarians each attacked Frederick and died on the counter. Scarlet (SF) also describes deliberate chip-suicides to set up a kill | already seen (only-target case). Untested: a unit with a safe alternative target |
| Player units preferred over NPC allies when nothing dies | **Folklore** | SF OP | not relevant to the Prologue |
| **Move target when it can't attack:** `AI_MV_NearestEnemy`, the nearest foe | **ROM** (name, ops) vs **Folklore** | SF says they move "towards … your most weakened unit" (as in FE12). XeKr reports random pathing between equal routes ("the first Mage in Prologue"). These can't both be exact | on a bookmark, end turn with everyone out of reach; move the damaged unit and see whether the approach follows it or the nearest unit |
| Ties are broken randomly (target tile, route) | **Folklore** | XeKr: reset and repeat on the same map | repeat one EP from a bookmark several times |

For the position solver, a safe model follows. It's conservative, and it assumes more than the confirmed data:
1. Each active enemy that can reach a unit attacks the one it can kill. If there are several, the one it kills most surely.
2. Otherwise it attacks the one it hits hardest after hit chance, preferring no counter.
3. It never declines an attack because it would die.
4. Units that can't reach anyone step toward the nearest player unit.

Treat the choice among non-lethal targets as uncertain. The "worst case over reachable targets" the app already shows
is the right bound.

## 5. Pair-ups

| Rule | Status | Source |
|---|---|---|
| Only the lead can be attacked; the back unit only adds stat bonuses and Dual Guard | **Game rule** | pair-up mechanics |
| The AI plans around the displayed lead and ignores what the back unit could do after a Switch | **Folklore** | TV Tropes, "Artificial Stupidity / Fire Emblem": enemies rush an unarmed Troubadour lead "completely oblivious" to her General partner |
| Does the AI's kill/damage estimate count Dual Guard (or the enemy's own Dual Strike)? | **Open** | XeKr: kill combos get abandoned when "stopped by … dual guard", which suggests it doesn't plan for it |

To settle the open one: on a bookmark, put a paired unit on the edge of a kill (lethal only without Dual Guard) next to a sturdier solo
unit. Repeat the enemy phase and see whether the pair still draws the attack.

## 6. What's still open (ranked by value to the position plan)

1. **What "being attacked" does to a waiting `AttackRange` unit.** No placement uses `AI_AC_Attacked`, so either it's built into
   `AttackRange` or chipping from outside reach is safe. It doesn't matter on the Prologue, but it matters for tempo on later maps.
   A hint: Engage's per-unit `AI_Flag` has a `NotActivateByAttacked` bit, which suggests the engine family wakes attacked units by default.
   Awakening's byte 0x64 may be the ancestor of that field, but its bits are not mapped.
2. **Band semantics:** whether one member waking wakes all (bit 0x80's role), and whether `BandRange` needs two members.
   Attempt 1 fits "one wakes all" but doesn't prove it.
3. **Target scoring:** its order and weights. Only reversing `code.bin` (the op handlers behind AIData's ops) would make §4 "confirmed".
4. **`AttackRange(0)`**, and bytes 0x64 and 0x68.
5. **Move target:** nearest versus most-weakened, and random tie-breaks.

## Sources

- **Primary:** the user's own dump.
  - `romfs/data/dispos/*.bin.lz`: all 102 files (story, paralogues, skirmish variants, debug), 4762 non-player records.
  - `romfs/data/AIData.bin.lz`: 69 command definitions.
  - `exefs/code.bin`: checked for the command names; not reversed.
- thane98, Paragon: `Data/FE13/Types/Dispo.yml`, `UI/Modules/Spawn.yml` @ `d11d601` (field layout and flag names).
- Danius88, fire-editor-awakening: `savefile/units/mainblock/RawBlockEnd.java` (save-side AI ids; they match AIData's ids).
- RainThunder, fefates-tools: `Dispos/README.md` (the same AI families in Fates).
- laqieer/FE17-DOC and Nifyr/A-Little-Secret-Ingredient `Structs/Dispos.cs` (Engage's named AI fields: `AI_BandNo`,
  `AI_HealRateA/B`, `AI_Flag` bits). Used only as hints, marked where used.
- Serenes Forest, "The Official AI Topic" (Awakening forum, topic 40909, 2013).
- TV Tropes, "Artificial Stupidity / Fire Emblem" (the pair-up note only).
- Fire Emblem Wiki chapter data, as generated into `src/game-data/chapters/early.ts` (Prologue notes).
- Attempt 1: `docs/play-log/p02-prologue.md` on `play/azahar-harness`.
