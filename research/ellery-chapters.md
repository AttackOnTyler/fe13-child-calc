# Which of Ellery's chapter strategies hold up against the chapter data?

Resolves [#91](https://github.com/AttackOnTyler/fe13-child-calc/issues/91), part of [Map: Route planner](https://github.com/AttackOnTyler/fe13-child-calc/issues/87). Researched 2026-09-24 against `origin/main` at `139044b`.

**Input:** Ellery's walkthrough notes `research/ellery/q12-walkthrough-p-6.md`, `q13-walkthrough-7-12.md`, `q14-walkthrough-13-18.md` and `q15-walkthrough-19-end.md` on `origin/research/ellery-roles`. They are AI summaries of Lunatic+ streams. **Checked against:** the Fire Emblem Wiki (FEW) chapter pages chosen by `research/chapter-data.md` (`origin/research/chapter-data`), read as raw wikitext at the `oldid` listed in that file's appendix, and the Lunatic(+) tab of each page. SF cross-check results and disagreements (C1–C14) are taken from that file. A few FEW item and skill pages were read for mechanics (see [Sources](#sources)). The earlier verdicts in `research/ellery-claims.md` (`origin/research/ellery-claims`) §3 are reused, not re-derived.

## How to read the verdicts

- **Facts** (threats, enemy skills, reinforcement turns, bosses, recruits, items, villages, chests): **holds**, **wrong** (with the correct fact), or **unverifiable** (no source settles it).
- **Strategies** (chokes, fort blocking, boss rushes, turn plans, pairings): **usable** (refers to real map features, units that are there, and real turn counts, so it can become a sourced chapter-guide entry), **needs fix** (what to change is given), or **unusable**.
- Turn numbers are **Lunatic** unless stated, because the streams are Lunatic+. Lunatic+ uses Lunatic's enemy data and adds two random skills per enemy from Pass, Hawkeye, Luna+, Vantage+, Counter, Aegis+, Pavise+. Counter, Aegis+ and Pavise+ are not in the pool before Ch 3 (chapter-data §4). A skill that is only in that pool can be on any enemy, so an Ellery threat list of pool skills "holds" as a possibility, never as a fixed skill. Whether bosses also draw pool skills isn't published.
- On Hard and above, reinforcements appear at the start of enemy phase and can act that turn (FEW *Reinforcement*, chapter-data §5). "Block before turn N" therefore means "be standing on the tile at the end of player phase N".
- **Terrain is a known gap** (chapter-data §10). No source gives tiles. A strategy that names a ridge, forest or corner is only checked against what FEW prose says (event-tile descriptions, unit notes, strategy sections). Where nothing mentions the feature, the strategy is **needs fix: check the map** rather than wrong.

## Summary

| Scope | Facts holds | Facts wrong | Facts unverifiable | Strategies usable | Needs fix | Unusable |
|---|---|---|---|---|---|---|
| Prologue – Ch 6 (q12) | 18 | 7 | 1 | 17 | 2 | 1 |
| Ch 7 – Ch 12 (q13) | 15 | 8 | 0 | 14 | 9 | 0 |
| Ch 13 – Ch 18 (q14) | 18 | 6 | 0 | 10 | 6 | 0 |
| Ch 19 – Endgame (q15) | 13 | 6 | 2 | 9 | 6 | 2 |
| Paralogues (q14, q15) | 13 | 3 | 0 | 4 | 3 | 0 |
| **Total** | **77** | **30** | **3** | **54** | **26** | **3** |

The corrections that matter most for a chapter guide:

1. **Reinforcement turns are often off.** Ch 5 starts on **turn 3** (not 4). Ch 7 comes on **turn 5** (Hard/Lunatic; turn 6 Normal), not 4. Ch 10 starts on **turn 5** on Lunatic (not 6). Ch 11 runs **turns 3–8** (not 5–7). Ch 17's stair spawns are **turns 8–13** (not 5–12). Ch 21's Mire Sorcerers appear **every turn from 2 to 13**, two a turn, not only on turns 2–4. Every fort-blocking plan built on Ellery's turn numbers needs FEW's turn instead.
2. **Four "ambushes" or threats don't exist.** Ch 6 has **no reinforcements** (no stair ambush). Ch 8 has **no Thieves and no armoured units**. Ch 18 has **no Mire users** (its casters are Sages). Ch 22 has **no Mire and no reinforcements**: it is Aversa plus the 12 Deadlords. The "Mire gauntlet" is Ch 21 only.
3. **Several named units can't be used where the notes use them.** Kellam isn't in Ch 2 (he joins in Ch 3, after Chrom talks to him). Miriel joins in Ch 2, not Ch 3. Lon'qu joins at the **end** of Ch 4, so he can't pair in it. **Lucina joins at the end of Ch 13**, not in Ch 14. Owain is Paralogue 5, not Ch 20. Panne (Taguel) and Nowi (Manakete) can't be promoted.
4. **Boss and enemy kits.** Ch 1's boss is a Risen Chief with a Short Axe (the Hammer is on a normal Risen Fighter), and Ch 1 has no Barbarians. **Yen'fay has no Lancebreaker** (the Ch 18 Griffon Riders do), so "never use lances on Yen'fay" is backwards. **Grima's Expiration has range 1–5, not 1–2**, and he has no Aegis. The Ch 12 Beast Killers are on a Knight, a Paladin and two Cavaliers, not on the Bow Knights.
5. **The dual-strike rule is half right.** Plain Pavise and Aegis don't trigger against a Dual Strike, but **Pavise+ and Aegis+ can** ("must be triggered again for a Dual Strike"), and FEW gives Dragonskin no dual-strike exception. On Lunatic+ Grima has Pavise+, so the Endgame and Ch 23 plans that lean on back-row damage need that caveat.
6. **Strategies that survive intact** are mostly the ones FEW's own strategy sections also give: the Prologue canal, Ch 1 fort, Ch 5 T1 Rescue plus southwest fort and forged Wind, Ch 6 two lanes, Ch 9 Tharja lure, Ch 10 thief rush, Ch 12 Beast Killer grab plus 15 Rescue charges (Rescue has 5 uses), Ch 14 Ignatius rush, Ch 19 Walhart blitz, Ch 21 Rescue over the walls.

## Prologue – Ch 6 (q12)

### Prologue: The Verge of History (FEW oldid 741973)

Boss Garrick (Barbarian, Short Axe). Rout. Enemies: Myrmidons, Barbarians, two Mages (Elthunder, Elwind).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| P.1 | Threats: Barbarians, Myrmidons, mages | **holds** | Lunatic tab: 4 Myrmidons, 4 Barbarians, 2 Mages |
| P.2 | Luna+ / Vantage+ | **holds** | Pre-Ch 3 L+ pool is Pass, Hawkeye, Luna+, Vantage+ (FEW prints the 4-skill pool on this page) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| P.S1 | Water trick: Robin + Chrom in the water, Thunder at 1–2 range, Lissa heals from shore | **usable** | FEW's Lunatic strategy is the same plan, in the **canal** (not a pond): Robin and Chrom use the canal to chip melee enemies without counters |
| P.S2 | Robin lead, Chrom back for Veteran | **usable** | FEW: "Always keep Robin paired up in order to exploit their powerful Veteran skill" |

### Ch 1: Unwelcome Change (741770)

Boss Risen Chief (Fighter Lv 3, Short Axe, HP +5). Rout. Sully and Virion join on turn 2. Forts: north and south.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 1.1 | "Luna+ + Hawkeye Barbarians" | **wrong** | No Barbarians. Enemies are 4 Risen Fighters, 2 Mercenaries, 1 Archer. Luna+ and Hawkeye are in the pool. Hawkeye Barbarians are a Ch 2 threat (FEW Ch 2 strategy) |
| 1.2 | "Hammer boss" | **wrong** | The boss is a Risen Chief with a **Short Axe**. One ordinary Risen Fighter carries the Hammer |
| 1.3 | Sully + Virion arrive on turn 2 | **holds** | `NewUnit`: "Automatically from turn 2" |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 1.S1 | Frederick on the fort (Bronze Sword) tanks, Robin chips | **usable** | FEW: Frederick paired with Chrom on the **north fort**, either Silver Lance or Bronze Sword |
| 1.S2 | Keep the turn-2 arrivals out of Hammer range | **usable** | The Hammer Fighter "immediately begins moving" |

### Ch 2: Shepherds (742135)

Boss Risen Chief (Barbarian, Short Axe). Rout. Stahl and Vaike join on turn 1, Miriel on turn 2.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 2.1 | Enemy skills include Counter | **wrong** | Counter isn't in the L+ pool before Ch 3. The pool here is Pass, Hawkeye, Luna+, Vantage+ |
| 2.2 | Vaike joins | **holds** | Turn 1, Fighter Lv 3, **empty inventory** |
| 2.3 | Stahl joins (the notebook's own flag doubted it) | **holds** | Turn 1, Cavalier Lv 2 (also ellery-claims 3.2) |
| 2.4 | Deploy "Frederick + Sully/**Kellam**" | **wrong** | Kellam isn't recruited until Ch 3 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 2.S1 | Push left to the mountain ridge; Frederick anchors a forest/mountain choke | **needs fix** | FEW anchors on the **northwest fort** for the second wave, after clearing the first wave from the starting pocket and retreating to the southwest corner. A mountain formation exists (event-tile text) but its use as a ridge choke isn't sourced. Use FEW's fort and corner, or check the map |
| 2.S2 | Give Vaike an axe on turn 1 | **usable** | He arrives with no weapon |
| 2.S3 | Frederick + Sully pair | **usable** | Both available |

### Ch 3: Warrior Realm (741809)

Boss Raimi (Knight, Short Spear) on a gate. Objective: defeat Raimi; also lost if both door keys are lost before a door opens. Sumia joins on turn 1. Kellam is an NPC (talk with Chrom).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Knights and Archers in hallways | **holds** | 5 Knights, 5 Archers, plus Soldiers, Mercenaries, Fighters |
| 3.2 | Counter, Pavise+, Luna+ | **holds** | First map with the 7-skill pool. FEW strategy: "Lunatic+ introduces Counter, Pavise+, and Aegis+" |
| 3.3 | Kellam recruited by Chrom | **holds** | "NPC, talk to with Chrom" |
| 3.4 | Miriel recruited here | **wrong** | Miriel joins in **Ch 2** on turn 2 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 3.S1 | Chrom + Kellam pair | **needs fix** | Only after Chrom has talked to Kellam. He is not deployable at the start |
| 3.S2 | Left door and hallway choke; don't open both doors | **usable** | Two doors, keys dropped by an Archer and a Mercenary. FEW: clear the two southern groups (southwest first), then open one door. The door-key defeat condition makes "don't waste keys" real |
| 3.S3 | Magic against the armours | **usable** | FEW: Robin doubles the Knights; Miriel with a Speed pair-up |

### Ch 4: Two Falchions (693840)

Boss "Marth" (Lord Lv 8, Parallel Falchion, Dual Strike+). Rout. No reinforcements. Lon'qu joins at the end of the chapter.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 4.1 | "Marth" boss | **holds** | Marth begins moving on turn 4 |
| 4.2 | Arena waves | **holds** as staggered aggro, not spawns | Fighters/Mages move at once, Knights on turn 2, more Fighters on turn 3, Marth on turn 4 |
| 4.3 | Marth has Counter | **unverifiable** | His fixed kit is Dual Strike+. Whether bosses draw L+ skills isn't published |
| 4.4 | Lon'qu with Killing Edge | **holds** | Myrmidon Lv 4, Killing Edge, joins "Automatically at the end of the chapter" |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 4.S1 | Lon'qu + Miriel pair | **unusable** | Lon'qu isn't playable in Ch 4 |
| 4.S2 | Defensive line, 2-range clears as the waves arrive | **usable** | Waves come on turns 1–4 (above). FEW: back off if overwhelmed. "At the bottom" isn't checkable (terrain) |
| 4.S3 | Tomes or javelins against Marth | **usable** | FEW: Marth heals with Parallel Falchion below half HP if he can't kill |
| 4.S4 | Robin to Lv 10 for seal prep | **usable** | FEW: the Renown Second Seal (claimable from Ch 3 on L+) reclasses Robin around here |

### Ch 5: The Exalt and the King (741857)

Boss Orton (Wyvern Rider, Tomahawk). Rout. Ricken and Maribelle start isolated.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 5.1 | Cliffs and Wyvern Riders | **holds** | 6 Wyvern Riders + Orton, 4 more as reinforcements; event tile "on a fort … two cliff tiles to its sides" |
| 5.2 | Fort ambush spawns on turns 4–5 | **wrong** | Spawns start on **turn 3** (Barbarians, Myrmidon from the SW, W and north-centre forts), then turn 4 (2 Wyvern Riders, NW forts; Hard/Lunatic) and turn 5. SF has 3, 5, 6 (disagreement C11), so turn 3 is agreed |
| 5.3 | Counter, Pass, Luna+, Pavise+ | **holds** | Pool |
| 5.4 | Maribelle and Ricken | **holds** | Both "Automatically from turn 1" |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 5.S1 | Rescue Ricken and Maribelle on turn 1 | **usable** | FEW's plan exactly: Lissa rescues both across the southeast cliff. Rescue comes from Paralogue 1's treasure-room chest |
| 5.S2 | Camp the bottom-left forts; block the ambush forts | **usable** | FEW: "make absolute sure someone is plugging up the southwestern fortress" on turn 3 and at the end of turn 5 |
| 5.S3 | Forged Wind one-shots the Wyvern Riders | **usable** | FEW: 15 Mag, 17 Spd, A tomes and Wind forged to +5 Mt one-rounds them |
| 5.S4 | Robin + Maribelle/Chrom, Frederick + Sully | **usable** | Maribelle can pair once rescued |

### Ch 6: Foreseer (685293)

Boss Validar (Sorcerer, Arcfire, moves on turn 4). Rout; also lost if **Emmeryn** dies. Panne joins on turn 2. Gaius is an enemy Thief (talk with Chrom). A Secret Book chest is in Emmeryn's room.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 6.1 | Validar is the boss (the flag doubted it) | **holds** | Infobox; ellery-claims 3.1 |
| 6.2 | Three corridors, Thieves | **holds** | 4 Thieves plus Gaius, all moving at once. FEW strategy uses left and right lanes |
| 6.3 | Ambush on the stairs | **wrong** | FEW lists **no reinforcements**. Every enemy but Validar moves from turn 1 |
| 6.4 | Pass, Counter | **holds** | Pool |
| 6.5 | Gaius and Panne recruited | **holds** | Gaius "Enemy, talk to with Chrom"; Panne automatic on turn 2 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 6.S1 | Two-lane lock, let the middle come | **usable** | FEW: Robin and Chrom left, Frederick right, hold the enemies back. Add Emmeryn's defeat condition: if Thieves open her door she is "almost certainly dead" |
| 6.S2 | Recruit Gaius with Chrom early | **usable** | FEW adds: have Gaius loot the Secret Book chest |

## Ch 7 – Ch 12 (q13)

### Ch 7: Incursion (701948)

Boss Vasto (Wyvern Rider, Silver Axe, moves on turn 5). Rout. Cordelia joins on turn 3.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 7.1 | Wyverns and a Hammer Barbarian | **holds** | 8 Wyvern Riders + Vasto. One Barbarian has a Hammer and "begins moving unprovoked on turn 2" |
| 7.2 | Reinforcements from turn 4 | **wrong** | **Turn 5** on Hard/Lunatic (turn 6 Normal): 3 Wyvern Riders from the western border. SF agrees |
| 7.3 | Cordelia | **holds** | Turn 3 (or at chapter end if cleared before turn 3) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 7.S1 | Frederick kills the Hammer Barbarian on turn 1 | **needs fix** | That Barbarian doesn't move until turn 2, so a turn-1 kill means walking into range. Reword as "kill it when it moves on turn 2", or check the distance on the map |
| 7.S2 | 2-range against Counter; anchor in forests | **usable** | FEW: "set up shop in a forest"; watch for Counter/Aegis+ |
| 7.S3 | Turn 4+: intercept the Thief, then collapse on the boss | **needs fix** | Two Thieves: one moves on turn 1, one on turn 2 (drops Bullion M). Vasto and the three southeastern Wyvern Riders move on turn 5, when the western reinforcements arrive. Intercept the Thieves early and plan the boss for turn 5+ |
| 7.S4 | Cordelia + Lon'qu/Stahl | **usable** | From turn 3. FEW: move her away from the west edge (reinforcements) |

### Ch 8: The Grimleal (741956)

Boss Chalard (Dark Mage, forged Nosferatu). Rout. Gregor and Nowi join on turn 1. Villages: Rescue (north), **Master Seal** (west), Second Seal (south).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 8.1 | Myrmidons and Dark Mages | **holds** | 5 Myrmidons, 8 Dark Mages |
| 8.2 | Mages and armours | **wrong** | No Mages and no Knights. The rest are **Fighters and Cavaliers** |
| 8.3 | Thieves racing to villages | **wrong** | There are **no Thieves** on this map |
| 8.4 | Nowi and Gregor | **holds** | Both turn 1 |
| 8.5 | Villages to visit | **holds** | Three villages (above) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 8.S1 | "Bone pile": a 2-range unit triggers the linked Dark Mage AI | **needs fix** | The group AI is real: several groups "will not move until a unit is in range of at least two of" a Fighter, Myrmidons and Dark Mages. The bone pile as the trigger tile is terrain FEW doesn't describe. Keep the group-AI rule, drop the tile until checked |
| 8.S2 | Fliers race Thieves to the villages | **needs fix** | No race. Visit the villages at leisure; FEW sends Robin (weapons unequipped) to the Master Seal village and promotes her at once |
| 8.S3 | Lon'qu with a Levin Sword | **usable** | Levin Sword is a Renown reward claimable from Ch 3 on L+ (FEW Ch 3 strategy) |

### Ch 9: Emmeryn (742082)

Boss Campari (General, Spear, Pavise). Rout. Libra (NPC) and Tharja (enemy) are both recruited by Chrom. Aversa and Gangrel leave before turn 1.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 9.1 | Desert map | **wrong** | Plegia Castle Courtyard. The desert map is Ch 8 |
| 9.2 | Turn-5 Wyvern ambush | **holds** | Turn 5: 6 Wyvern Riders "from north of ally starting positions", plus a Soldier and a Mage from forts by Campari. Every enemy except Campari aggros then |
| 9.3 | Libra and Tharja via Chrom | **holds** | "NPC, talk to with Chrom"; "Enemy, talk to with Chrom" |
| 9.4 | Counter, Aegis, Pavise, Pass, Hawkeye, Luna+ | **holds** | Pool; Campari himself has Pavise |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 9.S1 | Unequip the blocker so Tharja survives | **usable** | FEW: lure Tharja with Libra or a Pegasus Knight; she lacks inflated L+ stats |
| 9.S2 | Fall back south before turn 5 | **usable** | Wyverns arrive north of the start. FEW: clear them to open a retreat path |
| 9.S3 | Clear with 2-range, Chrom talks to both recruits | **usable** | FEW: recruit Libra by turn 3; Rescue may be needed |

### Ch 10: Renewal (741819)

Objective: **defeat Mustafa** (Berserker on a fort). Four Ruffian Thieves escape to the northwest with Bullion (M), Wyrmslayer, Master Seal and Seraph Robe.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 10.1 | Escaping Thieves | **holds** | 4 Thieves, "prioritizes escaping via the northwest" |
| 10.2 | Turn-6 fort ambush | **wrong** on Lunatic | Lunatic starts on **turn 5** (Normal/Hard turn 6), from forts on the western bones, then turns 6 and 7 |
| 10.3 | Master Seal, "Wormslayer", Beaststone | **holds** | Master Seal and **Wyrmslayer** are Thief drops; Beaststone is Mustafa's drop |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 10.S1 | Turn-1 thief rush with fliers | **usable** | FEW: kill the Thieves before they escape; bring fliers |
| 10.S2 | Stand on the forts before turn 6 | **needs fix** | Before **turn 5** on Lunatic |
| 10.S3 | Promote Cordelia and Panne | **needs fix** | Panne is a Taguel and can't promote. Cordelia can |
| 10.S4 | Libra Rescue | **usable** | — |

### Ch 11: Mad King Gangrel (742013)

Boss Gangrel (Trickster, forged Levin Sword; drops Levin Sword and Dragonstone). Rout. Olivia joins on turn 1. A Thief heads for the western chest (Bullion L); the eastern chest has a Goddess Icon.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 11.1 | Gangrel with a Levin Sword | **holds** | Forged Levin Sword |
| 11.2 | Fort ambushes on turns 5–7 | **wrong** | **Turns 3–8** on Lunatic (FEW; SF agrees) |
| 11.3 | Olivia | **holds** | Turn 1 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 11.S1 | One-flank push outside the other group's range | **usable** | Gangrel and his escort don't move until someone enters their range. FEW: go southwest to the mountains, where enemies approach one at a time |
| 11.S2 | Seize the forts | **needs fix** | FEW: one spawn fort is inside the Gangrel squad's range and can't be blocked safely |
| 11.S3 | Bait Gangrel with 1–2 range | **usable** | Levin Sword is 1–2. FEW: 25 Spd to avoid his double; Tharja's Hex/Anathema |
| 11.S4 | Promote Nowi and Lon'qu at 10 | **needs fix** | Nowi is a Manakete and can't promote |

### Ch 12: The Seacomers (754984)

Boss Dalton (Paladin, Spear, Aegis, moves on turn 5). Rout. Cherche joins on turn 1. No reinforcements.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 12.1 | Paladins and Bow Knights | **holds** | 4 Paladins, 2 Bow Knights, plus 13 Knights and 23 Cavaliers |
| 12.2 | Great Knights | **wrong** | None. The armours are **Knights** |
| 12.3 | Bow Knights with Beast Killers | **wrong** | Beast Killers are on **one Knight (drops it), one Paladin, two Cavaliers**. Bow Knights carry Silver Bow + Silver Sword |
| 12.4 | Cherche | **holds** | Turn 1 |
| 12.5 | Counter, Pavise+, Aegis+, Luna+, Pass | **holds** | Pool; Dalton has Aegis |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 12.S1 | Take Beast Killers and use them on cavalry | **usable** | FEW: Robin kills the Beast Killer Knight on turn 1 |
| 12.S2 | Turtle in the bottom-left corner | **needs fix** | FEW's safe spots are the **northeast corner** (reached by turn 3) and the gap between dock and boat. The bottom-left isn't sourced; check the map |
| 12.S3 | 15 Rescue charges from 3 staff users | **usable** | Rescue has **5 uses** in Awakening (FEW *Rescue (staff)*). Freely buyable after Ch 12 |
| 12.S4 | Wyvern Lord Frederick, fliers kept away from Beast Killers | **usable** | Beast Killer is effective against horse, pegasus and griffon riders (FEW *Beast Killer*), not wyverns |
| 12.S5 | Olivia hit-and-run | **usable** | — |

## Ch 13 – Ch 18 (q14)

### Ch 13: Of Sacred Blood (742107)

Objective: **defeat the Risen Chief** (Warrior, Tomahawk, Counter). Henry joins on turn 1 (Dark Mage Lv 12). **Lucina joins at the end of this chapter.**

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 13.1 | Fort spawns | **holds** | Turns 3–7 from the southern and central forts; turn 7 also the NW and NE forts |
| 13.2 | Silver Axe unit with Counter | **holds** (it is a Warrior, not a Fighter) | Warrior Lv 2, forged Silver Axe, Counter; begins moving on turn 2 |
| 13.3 | Longbow Snipers | **holds** | 4 Longbow Archers (move turn 7), Longbow Snipers among reinforcements |
| 13.4 | Henry Lv 12 | **holds** | `NewUnit` |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 13.S1 | Turn 1: stand on the NW fort to block the Counter unit | **needs fix** | The NW fort only spawns on turn 7, and FEW doesn't place the Warrior. Check the map |
| 13.S2 | Fall back to the centre/south, 2-range, Rescue + dance | **usable** | FEW: clear the south by end of turn 3, plug the forts, hold the SE and SW cliff paths (Pass defeats plugs on L+). FEW adds a one-turn boss kill with a flier + Olivia, since the objective is the Risen Chief |

### Ch 14: Flames on the Blue (742076)

Objective: **defeat Ignatius** (General, forged Spear, drops **Master Seal**). Chests: Bullion (M), Recover, Second Seal.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 14.1 | Pegasus Knights | **holds** | 11 on the map, 9 more as reinforcements |
| 14.2 | Falcon Knights | **wrong** | None. Also present and unmentioned: Generals (Pavise) and Great Knights (Luna) |
| 14.3 | Flying ambushes from the edges | **holds** | Turn 3 far SW sea, turn 4 far E sea, turn 5 NW sea (Lunatic) |
| 14.4 | Lucina recruited here | **wrong** | End of **Ch 13** |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 14.S1 | Boss rush by turn 3–4 | **usable** | The objective is Ignatius. The last wave is turn 5 on Lunatic |
| 14.S2 | Hold the central ship choke with bows and flier-effective weapons | **needs fix** | No source describes a central choke. Check the map |
| 14.S3 | Master Seal Lucina → Great Lord at once | **usable** | She joins at Lv 10 after Ch 13; Ignatius drops a Master Seal here |

### Ch 15: Smoldering Resistance (742090)

Boss Farber (Dark Knight). Rout. Say'ri: talk with Chrom, or she joins at the end if she survives. Villages: Bullion (L), Physic, Arms Scroll, Second Seal.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 15.1 | Armours, Generals, Cavaliers, Dark Knights | **holds** | Plus 8 Mages |
| 15.2 | No reinforcements | **holds** | No reinforcement section |
| 15.3 | Say'ri | **holds** | As above |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 15.S1 | Lucina training map (effective damage) | **usable** | Lucina's Rapier is effective against the many armour and horse units |
| 15.S2 | Keep Say'ri safe; don't rush her | **usable** | Recruiting her wakes the NE Cavaliers and Generals ("or if Say'ri is rescued") |

### Ch 16: Naga's Voice (742218)

Objective: **defeat Cervantes** (General, Pavise). Three Thieves escape north (Bullion M, Speedwing, Master Seal).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 16.1 | Tree map | **holds** | The Mila Tree; spawns come "from the branches" |
| 16.2 | Escaping Thieves | **holds** | 3 Thieves |
| 16.3 | Pegasus / Dark Flier ambush around turn 5 | **wrong** | Turn 5 (Hard/Lunatic) brings **Falcon Knights**, no Dark Fliers. Unmentioned: **turn 4** Fighters, Heroes, Snipers, Warriors from the branches **by the ally start**, and turn 6 Bow Knights |
| 16.4 | Second Seals buyable after Ch 16 | **holds** | chapter-data §6 (Mila Tree armory) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 16.S1 | Sumia flies the branches on turns 1–2 to catch the Thieves | **usable** | The Thieves escape north; fliers can catch them |
| 16.S2 | A: fliers park on the branches | **needs fix** | The turn-4 wave spawns on the branches next to the start. Say which branches, and plan for turn 4 not 5 |
| 16.S3 | B: Galeforce boss rush before turn 5 | **usable** | The objective is Cervantes. Leave the start area before turn 4 |

### Ch 17: Inexorable Death (742188)

Objective: **defeat Pheros** (Valkyrie on a throne). Chests: Boots and Seraph Robe (NW room), Master Seal and Bullion (L) (NE room). A Thief goes for the Seraph Robe chest.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 17.1 | Castle, Longbow Snipers | **holds** | Fort Steiger; 3 Longbow Snipers |
| 17.2 | Stair ambushes on turns 5–12 | **wrong** | **Turns 8–13**, from the eastern, western and central stairs. Most starting enemies also stay put until turn 8 |
| 17.3 | Boots available | **holds** | Western chest in the NW room |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 17.S1 | Block the stair tiles before turns 5–6 | **needs fix** | Before **turn 8**. Spawn points: 4 eastern stairs, 2 western, 2 central |
| 17.S2 | Attack over walls with Longbows or tomes | **usable** | — |
| 17.S3 | Galeforce in and out | **usable** | — |

### Ch 18: Sibling Blades (741909)

Objective: **defeat Yen'fay** (Swordmaster: Hit Rate +10, Avoid +10, Swordfaire, Astra, Vantage). No reinforcements. The floor crumbles into **hazard tiles** (10 damage at the start of a phase). Four chests go out of reach: SE Bullion (M) turn 7 EP, SW Energy Drop turn 10 EP, NW Second Seal turn 11 EP, NE Rescue turn 11 PP.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 18.1 | Griffons, Paladins | **holds** | 15 Griffon Riders, 8 Paladins |
| 18.2 | Mire mages | **wrong** | No Mire. The casters are **Sages** (Rexcalibur, Bolganone, Thoron) |
| 18.3 | Yen'fay has Astra, Vantage, Swordfaire | **holds** | Lunatic boss block |
| 18.4 | Yen'fay has Lancebreaker | **wrong** | He doesn't. **The Griffon Riders have Lancebreaker** |
| 18.5 | Lava | **holds** as hazard tiles | Crumbling terrain, 10 damage |
| 18.6 | Chest rooms | **holds** | Four chests, with the deadlines above |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 18.S1 | A: turn 1–2 Yen'fay kill with a flier carrying a bow or sword attacker, plus rallies | **usable** | The objective is Yen'fay |
| 18.S2 | B: full clear for the chest rooms | **needs fix** | The chests have deadlines (turn 7 to turn 11). Plan them first, or the full clear loses them |
| 18.S3 | Never use lances on Yen'fay | **needs fix** | Backwards. Lances win the triangle against his sword and he has no Lancebreaker. Keep lances away from the **Griffon Riders** |

### Paralogues in this stretch (q14)

P5–16 unlock after Ch 13 once the parent is married (chapter-data §2), so every timing below is possible.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| P10.1 | Severa charges in (fact) | **holds** | FEW P10 (742184): she "will make no attempt to stay out of attack ranges"; she prioritizes talking with Holland |
| P10.S | Rescue her repeatedly | **needs fix** | She must reach and **talk to Holland** to join. If Holland dies she turns enemy. Reinforcements on turns 2–4 and after the talk |
| P9.1 | Cynthia is talked to by Chrom or Sumia (fact) | **holds** | FEW P9 (742121): "talk to with Chrom or Sumia" |
| P9.2 | Straight to Falcon Knight (fact) | **holds** | Pegasus Knight Lv 10 on join |
| P9.S | Fly over the wall and talk on turns 1–2 | **usable** | The southwestern groups start moving on turn 3. The wall is terrain; check the map |
| P15.1 | Noire is an easy recruit | **holds** | FEW P15 (741793): NPC, becomes playable automatically on turn 2 |
| P15.2 | She is bottom-left | **wrong** | Her event tile is at column 22, row 8 of a 25 × 30 map, so she starts in the **upper right**. Ezra is the one on the west side |
| P12.1 | Morgan is recruitable (Chrom or Robin) | **holds** | FEW P12 (741938) |
| P12.S | Low-risk levelling | **needs fix** | FEW's plan needs a turn-1 Rescue for Morgan, fliers for the water, and interception of two chest Thieves. The map has promoted Griffon Riders, Swordmasters and Sages, and reinforcements from turn 2 |
| P11.1 | Gerome is recruitable | **holds** | FEW P11 (769229): "talk to with Chrom or Cherche" |

## Ch 19 – Endgame (q15)

### Ch 19: The Conqueror (741914)

Objective: **defeat Walhart** (Conqueror; Rightful King, Prescience, Pavise, Aegis, **Conquest**; wields and drops the **Sol** sword). He moves only when provoked.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 19.1 | Cavalry charge | **holds** | Paladins, Great Knights, Bow Knights, Dark Knights, Wyvern Lords |
| 19.2 | Every fort spawns on turn 4 | **wrong** | Turn 4 is the **first** wave (7 units from the northern forts). Waves continue on turns 5, 6, 7 and 8 (Lunatic) from the southern forts too |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 19.S1 | 4-turn Walhart blitz, kill on player phase on turn 4 | **usable** | The objective is Walhart, and he waits until provoked. Add: the turn-4 wave spawns before enemy phase of turn 4 |
| 19.S2 | Beast Killers to clear a lane | **usable** against the cavalry | FEW: **Conquest negates Beast Killer, Beastbane and Armorslayer on Walhart**; don't waste them on him |

### Ch 20: The Sword or the Knee (742133)

Objective: **defeat Walhart** (Wolf Berg, on a throne). Also Cervantes (moves at once) and Excellus (moves on turn 4). One Thief goes for the east treasure room.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 20.1 | Walhart's Wolf Berg has 1–2 range | **holds** | FEW *Wolf Berg* (759931): Mt 18, range 1–2 |
| 20.2 | Thieves | **holds** (one Thief) | "Prioritizes opening the right eastern chest, then escaping via the east" |
| 20.3 | Recruit Owain | **wrong** | Owain is Paralogue 5. Nobody joins in Ch 20 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 20.S1 | Right-corridor push on turns 1–3 for the Thief | **usable** | He heads for the east room |
| 20.S2 | Turns 4–5: break the centre | **needs fix** | On Lunatic, **turn 4** brings a large wave from the southern borders of all three corridors (turn 6 Hard, turn 8 Normal), and Excellus starts moving. Plan the turn-4 position around it |
| 20.S3 | Bait Walhart, kill him on player phase with braves or dual-strike crits | **usable** | Plain Pavise and Aegis don't trigger against a Dual Strike (FEW *Pavise*, *Aegis*) |

### Ch 21: Five Gemstones (741929)

Objective: **defeat Algol** (Berserker, Bolt Axe).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 21.1 | 10-range Mire Sorcerers | **holds** | FEW *Mire* (759014): range 3–10, 10 uses, no follow-ups, no skills or Dual Strikes |
| 21.2 | Stair spawns on turns 2–4 | **wrong** | On Lunatic, **2 Mire Sorcerers appear every turn from turn 2 to turn 13** on the stairs beyond the west and east walls. Mixed waves from the northern and southern stairs follow on turns 5–9+ |
| 21.3 | Boss Algol | **holds** | Infobox (only the title "Ch 21: Algol" was wrong, ellery-claims 3.4) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 21.S1 | Count Mire ranges; fliers, or dance + Rescue, to jump the walls and kill the Sorcerers | **usable** | FEW *Rescue (staff)* (759875): Rescue's drop-off rule "can be used to send units through obstacles or walls … the sides of *Awakening* Chapter 21" |
| 21.S2 | Burn Mire charges on high-Res or Nosferatu tanks | **usable** | 10 uses per tome; Mire can't double |
| 21.S3 | Advance before the stair spawns | **unusable** | They begin on turn 2 and keep coming to turn 13 |

### Ch 22: An Ill Presage (703669)

Objective: **defeat Aversa** (Dark Flier). The other 12 enemies are the **Deadlords**, in three squads of four with group AI; each moves on turn 3 or when a squadmate is provoked. No reinforcements. No Mire.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 22.1 | Mire Sorcerers and stair spawns on turns 2–4 (q15 groups 21–22) | **wrong** | 13 enemies: Aversa and the Deadlords. No reinforcement section |
| 22.S | Count Mire ranges, advance before spawns | **unusable** here | FEW's strategy instead: go straight for Aversa (immobile, weak to bows and Wind); avoid provoking the squads |

### Ch 23: Invisible Ties (741846)

Rout. Validar (Sorcerer) is fought twice: his first defeat "destroys the barrier"; he then reappears south of the easternmost stairs with Rightful King, Anathema, Renewal, Vengeance, **Dragonskin**. **Basilio and Flavia join after the first defeat of Validar.** Robin is forced (deploy 2–15).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 23.1 | Validar has Dragonskin | **holds** | Lunatic boss block; FEW *Dragonskin*: Validar on Hard and up |
| 23.2 | Validar has Aegis+, Pavise+, Vantage+ | **unverifiable** | Only possible as L+ pool skills, and whether bosses draw them isn't published |
| 23.3 | Stair spawns | **holds** | Turns 4, 5, 6 (Hard/Lunatic) from the east, west and southern stairs |
| 23.4 | Basilio and Flavia are free units | **holds**, but only mid-map | After Validar's first defeat (ellery-claims 3.5) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 23.S1 | Push north out of the start room | **needs fix** | The barrier falls only when Validar's first form is defeated. Make that the first step |
| 23.S2 | Basilio holds chokes (Sol tank, Rally Strength) | **usable** | Once he joins; he is a Warrior (Rally Strength is the Warrior skill) |
| 23.S3 | Dual-strike damage isn't halved by Dragonskin, Pavise or Aegis | **needs fix** | FEW: plain Pavise and Aegis "will not activate against a Dual Strike", but **Pavise+ and Aegis+ "must be triggered again for a Dual Strike"**, i.e. they can. Dragonskin is "−50 % damage taken" with no dual-strike exception given. State only the plain Pavise/Aegis part |

### Ch 24: Awakening (742151)

Rout. Boss Risen Chief (Great Knight, Luna). Reinforcements on turns 2–5 (Lunatic; 3–6 Normal/Hard) from the forts.

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 24.1 | Cavalry and wyverns | **holds** | Great Knights, Paladins, Wyvern Lords, Bow Knights, Valkyries |
| 24.2 | A forest | **unverifiable** | No FEW text describes forest; terrain gap |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 24.S1 | Forest choke, 2-range against Counter | **needs fix** | Confirm the forest on the map, and plan around the fort spawns on turns 2–5 |

### Ch 25: To Slay a God (685912)

Objective: **defeat Aversa** (Dark Flier).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| 25.1 | Fliers, Berserkers, continuous waves | **holds** | Dark Fliers, Griffon Riders, Berserkers; waves on turns 3–8 (Lunatic) |
| 25.2 | Waves stop around turn 5–8 | **holds** on Lunatic | Last listed wave is turn 8 (turn 12 Hard, 16 Normal) |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| 25.S1 | Turtle in the bottom mountain corner until the waves stop | **needs fix** | Dark Fliers spawn **from the furthest southwestern and southeastern mountains** on turns 4 and 6, and Generals and Sorcerers spawn **at the ally starting positions** on turns 3–5. A bottom corner is where waves arrive |
| 25.S2 | Then advance | **usable** | The objective is Aversa, so the map ends when she falls, whatever the waves are doing |

### Endgame: Grima (741863)

Objective: defeat Grima (Expiration; Anathema, Ignis, Pavise, Dragonskin, Rightful God; **Pavise+ on Lunatic+**). Reinforcements are infinite, from turn 2, from sigils near Grima (an extra set per turn on Lunatic).

| # | Fact | Verdict | Evidence |
|---|---|---|---|
| E.1 | Dragonskin, Ignis, Pavise | **holds** | Boss blocks (Pavise+ on L+) |
| E.2 | Aegis | **wrong** | Not in any Grima block. His others are Anathema and Rightful God |
| E.3 | 1–2 range | **wrong** | FEW *Expiration* (758979): range **1–5**, Mt 20 |
| E.4 | Endless spawns | **holds** | "Reinforcements, unlimited in number" from turn 2 |

| # | Strategy | Verdict | Notes |
|---|---|---|---|
| E.S1 | 1–2 turn Grima blitz: rallies, dance, Rescue killer pairs next to Grima, braves / Parallel Falchion | **usable** | Rescue range is 1 to Mag/2. Check the drop tiles next to Grima on the map |
| E.S2 | The back-row dual strike is the damage | **needs fix** | On Lunatic+ Grima has **Pavise+**, which can trigger on a Dual Strike, and Dragonskin halves damage. Plain-Pavise reasoning only holds on Normal to Lunatic |

### Remaining paralogues (q15)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| P1.1 | Donnel, after Ch 3–4 | **holds** | FEW P1 (741974): unlocks after Ch 3. Keep him only if he gains a level in the map |
| P1.S | Recruit, then bench | **usable** | Opinion, but consistent with the data. FEW: feed him Archers, who can't counter him |
| P2.1 | Physic | **holds** | FEW P2 (742033): village |
| P3.1 | Blessed Bow | **holds** | FEW P3 (742001): village. Also Seraph Robe and Log if villagers survive |
| P2.2 | Master Seal as a reward | **wrong** | Neither map gives one. Master Seal is only in the random **merchant** pool there (chapter-data §6) |
| P2.3 | "Anna / Sumia's paralogues" | **wrong** | P2 is *The Secret Seller* (Anna appears as the village merchant; she is recruited in P4). P3 *A Strangled Peace* has no Sumia link. Neither recruits anyone |
| P2.4 | Playable after Ch 8 | **holds** | P2 unlocks after Ch 5, P3 after Ch 7 |
| P2.S | Dark Flier Sumia + Chrom clear both | **usable** | FEW P2: Sumia ferries Chrom |
| P16.1 | Collapsing walls | **holds** | FEW P16 (742094): walls open and close on triggers |
| P16.2 | Mire Sorcerers | **holds** | 6 of the Sorcerers carry Mire |
| P16.S | Wait 10 turns outside so the Mire Sorcerers burn their charges | **needs fix** | Nah is "immobile until recruited", and her chamber's NW wall collapses **on turn 3** or when a unit approaches. Waiting leaves her exposed. Rescue or reach her first |
| P20.1 | After Ch 25 | **holds** | SpotPass paralogue (chapter-data §2) |
| P20.S | Turn-1 Rescue of Emmeryn to the base | **usable** | She is an unarmed NPC Sage who joins "if she survived". The village gives another Rescue |

## What can become chapter-guide entries

Usable as written, each citing the FEW page: P.S1–S2, 1.S1–S2, 2.S2–S3, 3.S2–S3, 4.S2–S4, 5.S1–S4, 6.S1–S2, 7.S2, 7.S4, 8.S3, 9.S1–S3, 10.S1, 10.S4, 11.S1, 11.S3, 12.S1, 12.S3–S5, 13.S2, 14.S1, 14.S3, 15.S1–S2, 16.S1, 16.S3, 17.S2–S3, 18.S1, 19.S1–S2, 20.S1, 20.S3, 21.S1–S2, 23.S2, 25.S2, E.S1, P1.S, P2.S, P9.S, P20.S.

Usable after the fix in the table (26):

- **Data fixes that come straight from FEW and can be written now:** turn numbers or spawn points (7.S1, 7.S3, 10.S2, 16.S2, 17.S1, 18.S2, 20.S2, 25.S1); units or kits (3.S1, 10.S3, 11.S4, 18.S3, 23.S1); mechanics (11.S2, 23.S3, E.S2); paralogue conditions (P10.S, P12.S, P16.S); 8.S2 (no Thieves).
- **Terrain fixes that need the map image checked first**, because of the terrain gap: 2.S1, 8.S1, 12.S2, 13.S1, 14.S2, 24.S1.

Don't carry over: 4.S1 (Lon'qu), 21.S3, 22.S, and every "Ellery's reinforcement turn" figure.

A guide entry should record difficulty with every turn number. Ellery's numbers are sometimes the Normal/Hard turn (Ch 10's turn 6) and sometimes neither.

## Sources

FEW chapter pages, raw wikitext at the `oldid` in `research/chapter-data.md`'s appendix (Lunatic(+) tabs, `ChapItems`, `NewUnit`, `Reinforcements`, NPC data, `Strategy`):
Prologue 741973, Ch 1 741770, Ch 2 742135, Ch 3 741809, Ch 4 693840, Ch 5 741857, Ch 6 685293, Ch 7 701948, Ch 8 741956, Ch 9 742082, Ch 10 741819, Ch 11 742013, Ch 12 754984, Ch 13 742107, Ch 14 742076, Ch 15 742090, Ch 16 742218, Ch 17 742188, Ch 18 741909, Ch 19 741914, Ch 20 742133, Ch 21 741929, Ch 22 703669, Ch 23 741846, Ch 24 742151, Ch 25 685912, Endgame 741863, P1 741974, P2 742033, P3 742001, P9 742121, P10 742184, P11 769229, P12 741938, P15 741793, P16 742094, P20 742087. URL form: `https://fireemblemwiki.org/w/index.php?oldid=<id>`.

FEW item and skill pages (revision ids): *Mire* 759014, *Rescue (staff)* 759875, *Wolf Berg* 759931, *Expiration* 758979, *Dragonskin* 759566, *Beast Killer* 764643, *Pavise* 769698, *Aegis* 769701.

Repo research: `research/chapter-data.md` (`origin/research/chapter-data`) for the L+ pool, spawn rule, SF cross-checks (C11) and merchant pools; `research/ellery-claims.md` (`origin/research/ellery-claims`) §3 for Validar, Stahl, the chapter titles and Basilio/Flavia.

Not consulted: the streams themselves. The notes are AI summaries, so a **wrong** verdict here may be a summarising slip, not Ellery's.
