# Where does a run's gold come from, and what does keeping an army supplied cost?

Resolves #158 (part of #136, Map: Endpoint-first planning). Researched 2026-09-25 against `origin/main` at `a2b595a`.

This is a findings file, not a data file. It covers where an *Awakening* run's gold comes from, map by map, what an armory pays for what you sell, how weapon and staff uses are spent, what the common consumables and the seals cost, and where the app's chapter and item data fall short. The **endpoint kit** is paid from projected gold left after upkeep, seals and promotions (#137), so a gold forecast needs these facts.

Serenes Forest (SF) and Fire Emblem Wiki (FEW) are the primary sources. The cross-checks are the Japanese wikis (ptnwiki, the 2ch FE覚醒 atwiki via archive.org, the 天馬騎士団 / pegasusknight wiki, toragame, the fedic FE dictionary), FE WoD, Tanas Manor, the LP Archive's screenshot playthrough and GameFAQs threads. §9 lists every source, with FEW revision ids. Every FEW chapter page behind the app's data is still at the revision the app cites.

## Summary

The short answer: **Awakening pays almost no gold directly. A run's money is its Bullion, sold at an armory.** The game starts you with **5,000G**. Clearing a map pays nothing. The only direct gold on the route is Paralogue 13's reward. Everything else is items, and an armory pays **half an item's worth, scaled by the uses left**. A full route's Bullion comes to **100,000G from the story maps and 110,000G from the paralogues**. About a third of it (70,000G) can be lost to escaping Thieves, collapsing floors, destroyed villages or failed side goals. Upkeep is paid **per hit**: a physical miss is free, and a use is gone for good once spent (only Hammerne repairs, and no armory sells it). Master and Second Seals cost **2,500G** each, and the route hands out **13 Master and 10 Second Seals free**.

| Question | Answer | Confidence |
|---|---|---|
| **Starting gold** | 5,000G on every difficulty | High: FEW Gold, LP screenshots (§1.1) |
| **Gold for clearing a map** | None | High: FEW Gold, LP, JP guides (§1.1) |
| **Direct gold on the route** | Only Paralogue 13: 10,000G if you back neither side, else 500G per surviving allied NPC | High for the 10,000G, medium for the 500G rule (C8) |
| **Main income** | Bullion: (S) sells for 1,000G, (M) 5,000G, (L) 10,000G. Story maps 100,000G, paralogues 110,000G (§1.3) | High |
| **Fixed or play-dependent?** | Fixed per map and the same on every difficulty (one exception: Ch 3's Heal is Lunatic only). Play decides whether you **collect** it. There is **no Steal command**. Drops are certain on a kill. Thieves loot chests and escape, some item carriers flee, Barbarians burn villages, Ch 18's chests fall away on set turns, and P6, P7, P11 and P13 pay by result (§1.4) | High |
| **Renown** | +10 per story map cleared, unaffected by difficulty. Rewards are items at fixed thresholds: a Second Seal at 100, a Bullion (L) at 1,000. Map clears alone reach about 500 by the end of a first file (§1.5) | High for the rules, medium for paralogues and xenologues |
| **Event tiles and the Barracks** | Random items only (EXP, weapon EXP or support otherwise), no gold, no published odds. Every pooled item sells for a quarter of its worth, 25–585G (§1.6) | High for the rules, none for the odds |
| **Sell price** | `worth ÷ 2 × uses left ÷ max uses`. The 50 items of the event-tile and Barracks pool (bonus weapons and staves, the confections, Seed of Trust, Reeking Box, Rift Door) pay a quarter. Legendary weapons and DLC items have no worth and pay nothing. Forged weapons can be sold, but no source gives their price (§2) | High, except forges (G1) and rounding (G2) |
| **How uses are spent** | One use per **hit**, on either phase. A physical miss costs nothing; a tome miss probably costs one. A brave weapon hits twice per attack. **The back unit's weapon pays for each Dual Strike.** Dual Guard costs nothing. Astra's 5 hits cost 1 use. At 0 uses the item is gone, forged or not (§3.1) | High for weapons and staves; medium for tomes (C7) |
| **Consumable costs** | Buy price = worth. Per use: Vulnerary 100G, Elixir 300G, Physic 180G, Rescue 256G, Silver weapons 47–58G, Brave weapons 70–80G (§3.2) | High |
| **Seals** | 2,500G each. Master Seals: Port Ferox armory after Ch 12, plus the P8, P12 and P13 armories. Second Seals: Mila Tree after Ch 16, plus the P6, P10 and P16 armories, which can open right after Ch 13. Before that, only free seals or a random merchant (§4) | High |

For the roadmap (#136): **forecast gold as starting gold + Bullion sold + P13's gold − purchases**, map by map, with the play-dependent rows flagged and the renown rewards added at their thresholds. The biggest lever the player controls is catching Thieves and beating Ch 18's collapsing floor: 25,000G of story Bullion rides on it. The run entries record gold and items but not the transactions between maps, so the forecast can't yet tell upkeep from kit spending (§8).

## 1. Income on the route

### 1.1 What pays

- **Starting gold: 5,000G.** FEW Gold (rev 763531) lists 5,000 as the initial gold. The LP Archive's Hard playthrough shows 5000 G on the world map after the Prologue and still 5000 G when the shops open after Chapter 3. No source gives a difficulty difference.
- **No gold for clearing a map.** FEW Gold's *Awakening* section lists only the starting gold and The Golden Gaffe's drops. It says most of the game's gold comes from selling Bullion. The LP's gold doesn't move from the Prologue to Chapter 3. Japanese guides say selling is the only way to earn money.
- **Paralogue 13 is the only map that pays gold directly** (§1.4).
- **Bullion.** Bullion (S), (M) and (L) have worths of 2,000, 10,000 and 20,000 and sell for 1,000G, 5,000G and 10,000G (SF items; FEW Bullion, rev 765948; the 2ch wiki). They are the route's real money.
- **Anything else with a worth** can be sold at half its worth (§2): dropped weapons, stat boosters, seals, keys. A planner normally keeps seals and stat boosters, so they are a reserve rather than income.
- **Skills:** Despoil (Barbarian, Lv 1; also granted by Leif's Blade) gives a Bullion (S) on a player-phase kill at Luck% (in-game text: "Get a Bullion (S) if the unit's target falls. Trigger % = (Lck stat)"; FEW Despoil, rev 700887, citing an SF forum test that saw no enemy-phase procs). Armsthrift saves gold rather than making it (§3.1). No other skill touches gold (SF skill list).
- **Outside the route (out of scope):** random merchants, Risen skirmishes (at least one Bullion (S) carrier each; two Risen groups on one node pay 3,000G plus an item, per the 2ch wiki), The Golden Gaffe (1,000–7,000G drops), SpotPass and StreetPass teams, and Double Duel.

### 1.2 How to read the map table

Values are what the item sells for (§2). "Other items" are named, not summed: a forecast should count them only if the plan sells them. Play-dependent Bullion is marked, and §1.4 explains each case. The app's chapter data holds every row below except those marked **(missing)**. Unlock points are the app's.

### 1.3 Map by map

**Story maps**

| Map | Bullion (sells for) | Seals | Other items (drops unless noted) |
|---|---|---|---|
| Premonition, Prologue, Ch 1 | — | — | — |
| Ch 2 | — | — | Iron Sword, Iron Lance |
| Ch 3 | — | — | 2 Door Keys, Hammer; Heal (Lunatic only). The shops, the convoy and the renown menu open after this map |
| Ch 4 | — | — | Thunder, Vulnerary |
| Ch 5 | (M) 5,000, Orton | — | Hand Axe (reinforcement) |
| Ch 6 | — | — | Secret Book (chest); Heal (Validar); Iron Lance; Wind; Iron Sword only if Gaius is killed |
| Ch 7 | (M) 5,000, enemy Thief | — | Steel Axe (Vasto), Concoction, Steel Sword, Steel Bow |
| Ch 8 | — | Master, Second (villages) | Rescue (village), Energy Drop (Chalard), Killing Edge, Steel Lance |
| Ch 9 | — | — | Dracoshield (Campari), Javelin, Killer Bow, Hand Axe; Elthunder only if Tharja is killed |
| Ch 10 | (M) 5,000, **escaping Thief** | Master (**escaping Thief**) | Wyrmslayer and Seraph Robe (escaping Thieves), Beaststone (Mustafa) |
| Ch 11 | (L) 10,000, west chest (**Thief-targeted**) | Master (Hero) | Goddess Icon (chest), Levin Sword and Dragonstone (Gangrel), Spirit Dust, Armorslayer, Speedwing |
| Ch 12 | (L) 10,000, Dalton | Master, Second | Elixir, Silver Lance, Silver Sword, Beast Killer |
| Ch 13 | — | — | Secret Book (Risen Chief), Longbow, Silver Bow, Silver Axe |
| Ch 14 | (M) 5,000, chest | Master (Ignatius), Second (chest) | Recover (chest), Talisman, Short Spear, Short Axe, Chest Key |
| Ch 15 | (L) 10,000, village | Master (Farber), Second (village) | Physic, Arms Scroll (villages), Steel Lance, Arcthunder, Hammer, Steel Sword |
| Ch 16 | (M) 5,000, Cervantes; (M) 5,000, **escaping Thief** | Master ×2 (one on an **escaping Thief**) | Speedwing (escaping Thief), Beast Killer, Silver Sword, Killer Axe, Short Spear, Mend, Steel Sword, Steel Bow, Concoction |
| Ch 17 | (L) 10,000, chest | Master (chest) | Boots (chest), Seraph Robe (chest, **Thief-targeted**), Fortify (Pheros), Mend, Concoction, Killer Bow, Chest Key |
| Ch 18 | (M) 5,000, SE chest, **gone at turn 7 enemy phase** | Second (chest, gone turn 11 EP) | Energy Drop (chest, gone turn 10 EP), Rescue (chest, gone turn 11 PP), Noble Rapier (Yen'fay), Silver Axe, Silver Lance, Arcfire, Killer Lance, Armorslayer, Concoction |
| Ch 19 | — | — | Silver Bow, Silver Lance, Silver Axe, Silver Sword, Elixir, Arcwind |
| Ch 20 | (L) 10,000, Walhart | Second (chest) | Dragonstone+, Beaststone+, Spirit Dust (chest, **Thief-targeted**); Dracoshield (Cervantes), Bolganone (Excellus), Elixir, Longbow, Physic |
| Ch 21 | (L) 10,000, chest | — | Secret Book, Noble Rapier, Fortify (chests); Bolt Axe (Algol), Mire, 2 Master Keys, Ruin, Concoction |
| Ch 22 | — | — | Goddess Icon (Aversa), Recover (Lepus) |
| Ch 23 | — | — | Talisman (Validar), Silver weapons ×4, Arcfire, Wyrmslayer |
| Ch 24 | (M) 5,000, Risen Chief | — | Spear, Tomahawk, Thoron, Elixir |
| Ch 25 | — | — | Levin Sword, Physic |
| **Story total** | **100,000G**, of which 25,000G is at risk (Ch 10, 11, 16, 18) | 9 Master, 6 Second | |

Legendary weapons that bosses drop (Amatsu, Sol, the Ch 22 Deadlords' weapons, Goetia) have no worth and sell for nothing (§2).

**Paralogues**

| Map (opens after) | Bullion (sells for) | Seals | Other items |
|---|---|---|---|
| P1 (Ch 3) | — | — | Killer Lance (chest, **Thief-targeted**), Rescue (chest), keys |
| P2 (Ch 5) | — | — | Goddess Icon (Victor); Physic (village, **Barbarians go for it**) |
| P3 (Ch 7) | — | — | **(missing)** Elixir (Risen Chief), Blessed Bow (village), Seraph Robe / Log / Ladle for villagers saved (C9) |
| P4 (Ch 9) | (L) 10,000, SW chest | — | Killing Edge, Mend (chests), Arms Scroll (chest, **Thief-targeted**), Talisman (Vincent) |
| P5 (Ch 13) | — | Second (Gecko) | Elixir, Spirit Dust, Missiletainn *or* Speed Tonic (talks) |
| P6 (Ch 13) | (M) 5,000 if **Inigo kills 4** | Master (Jamil) | Cumulative Inigo rewards: Elixir (1), Killing Edge (2), Speedwing (3), Bullion (M) (4), Hammerne (5) |
| P7 (Ch 13) | (M) 5,000 if **3 villagers live** | Master (Xalbador) | Villager rewards: Mend (1), Blessed Lance (2), Bullion (M) (3), Seraph Robe (4), Fortify (5) |
| P8 (Ch 13) | **(missing)** (M) 5,000, east chest | — | Dracoshield (Cassius), Door Key; **(missing)** Short Spear (west chest) |
| P9 (Ch 13) | (L) 10,000, Ruger (**escapes**) | Second (Great Knight) | Arms Scroll, Elixir, Physic |
| P10 (Ch 13) | **(missing)** (M) 5,000, west chest | — | Talisman (Nelson), Master Key; **(missing)** Levin Sword (east chest) |
| P11 (Ch 13) | (M) 5,000, Morristan; (M) 5,000 if **4 villagers live** | — | Villager rewards: Wyrmslayer, Arms Scroll, Recover, Bullion (M), Seraph Robe |
| P12 (Ch 13) | (M) 5,000, chest (**two chest-looting Thieves**) | Second (chest) | Fortify (chest), Goddess Icon (Risen Chief), Naga's Tear (end of map) |
| P13 (Ch 13) | (M) 5,000 each from Gyral and Dalen: **both only if you back neither side** | — | **Gold:** 10,000G if you back neither side, else 500G per surviving allied NPC. Backing a side closes two of the four villages (Beast Killer, Dracoshield, Energy Drop, Hammer) |
| P14 (Ch 13) | (L) 10,000, third mirage village (**villages can be burned**) | Master (Nombry) | Strength Tonic, Speedwing (mirage villages, in order); Goddess Staff (hidden, no worth) |
| P15 (Ch 13) | (M) 5,000, enemy Falcon Knight | Master (Bow Knight) | Energy Drop (Ezra) |
| P16 (Ch 13) | (M) 5,000, chest | Second (chest) | Recover (chest), Spirit Dust (Risen Chief), keys |
| P17 (Ch 18) | — | — | Hammerne (Risen Chief) |
| P18 (Ch 25) | (L) 10,000, Zanth | — | Seraph Robe (village); Levin Sword only if Gangrel is killed |
| P19 (Ch 25) | — | — | Energy Drop, Dracoshield (Walhart) |
| P20 (Ch 25) | (M) 5,000, enemy Dark Flier | — | Talisman (Ardri), Rescue (village), Fortify (end of map) |
| P21 (Ch 25) | — | — | Speedwing (Risen Chief) |
| P22 (Ch 25) | (L) 10,000, end of map | — | Spirit Dust (end of map) |
| P23 (Ch 25) | — | — | Secret Book, Goddess Icon (Priam) |
| **Paralogue total** | **110,000G** (85,000G in P1–P17), plus P13's gold. 45,000G of it is at risk (P6, P7, P9, P11, P12, P13, P14) | 4 Master, 4 Second | |

Child paralogues P5–P16 open after Ch 13 only once the fixed parent is married, and P5, P6, P7, P9 and P11 also need map access (#140).

**Non-grind DLC xenologues** pay almost nothing in gold:
- **Roster Rescue:** 7 Bullion (S), 7,000G. Each Revenant that escapes takes its Bullion.
- **The Scrambles:** Harvest Scramble's boss drops a Master Seal. The Summer and Hot-Spring Scrambles drop 3 Seeds of Trust each (quarter sale, 250G). Their 15–20 event tiles pay random items (§1.6).
- **The random villages and chests** (Champions of Yore, Lost Bloodlines, Roster Rescue, The Future Past 1) draw from "almost any item" except Bullion, Naga's Tear, Boots, the Supreme Emblem, DLC items, legendary weapons and the Goddess Staff (FEW DLC page, rev 752364). So they pay no Bullion.
- **Reward items** (All Stats +2, Paragon, Iote's Shield, Limit Breaker, Dread Scroll, Wedding Bouquet) have no worth.
- **The Supreme Emblem** from Apotheosis's secret route sells for 99,999G.
- **DLC rewards repeat on every clear** (SF FAQ), so any DLC gold beyond the first clear is grind.

**Running total along the story (Bullion only, sold at once, no paralogues):** 5,000 start → 10,000 after Ch 5 → 15,000 after Ch 7 → 20,000 after Ch 10 → 30,000 after Ch 11 → **40,000 after Ch 12** → 45,000 after Ch 14 → 55,000 after Ch 15 → 65,000 after Ch 16 → 75,000 after Ch 17 → 80,000 after Ch 18 → 90,000 after Ch 20 → 100,000 after Ch 21 → 105,000 after Ch 24. P4 (after Ch 9) adds 10,000 early; the Ch 13 paralogue block adds up to 75,000 more.

### 1.4 Fixed, or does it depend on play?

**The list is fixed per map. What a run collects depends on play.**

- **No player Steal.** Awakening's Thief skills are Locktouch and Movement +1; Steal isn't in the game (FEW Thief, rev 770225; FEW Steal, rev 759253).
- **Drops are certain on a kill.** No source gives a drop rate for story enemies. The item goes to the unit that made the kill (FEW Inventory, rev 756372). If that unit's inventory is full, you choose what goes to the convoy, which has no limit and opens after Ch 3 (FEW Supply convoy, rev 765132). A kill by an NPC can lose the item: SF Hints says so for skirmishes, and no story source addresses it (G10).
- **Recruit-or-kill drops don't stack.** The Ch 6 Iron Sword (Gaius), Ch 9 Elthunder (Tharja) and P18 Levin Sword (Gangrel) are the unit's own weapon: you get it by killing the unit, or with the unit when it's recruited.
- **Drops are the same on every difficulty.** The one confirmed exception is Ch 3's Heal, which is Lunatic only (FEW, ptnwiki). FEW's P18 Lunatic tab also flags ten weapons as drops, but that looks like a data-entry slip (C13).
- **Escaping carriers.** If these get off the map, their items go with them (FEW enemy notes; ptnwiki):
  - Ch 10: 4 Thieves carry a Bullion (M), a Wyrmslayer, a Master Seal and a Seraph Robe.
  - Ch 16: 3 Thieves carry a Bullion (M), a Speedwing and a Master Seal.
  - P9: Ruger carries a Bullion (L). ptnwiki: if he escapes, it can't be obtained.
  - Roster Rescue: the Revenants carry the Bullion (S).
- **Chest-looting Thieves.** FEW's enemy notes say these Thieves open a chest and then escape: P1 (Killer Lance), P4 (Arms Scroll, gone on turn 6 per FEW's strategy), Ch 11 (**Bullion (L)**), P12 (two Thieves, chest not named), Ch 17 (Seraph Robe) and Ch 20 (Spirit Dust). Killing the Thief before it leaves gets the item back (FEW Chest, rev 768500; ptnwiki Ch 11, 17, 20).
- **Villages.** Enemy Barbarians destroy villages, and the reward is then "completely lost" unless the map is restarted (FEW Village, rev 756356). FE WoD adds Berserkers (C10). On the route this matters for P2's Physic and P14's mirage villages: ptnwiki says the mirage village never appears if any village is destroyed. Villages don't close by turn. Backing a side in P13 closes two villages. Visiting needs a unit to reach the village.
- **Chests need a key or a Thief** (Locktouch). **Ch 18's four chests are lost** when the floor collapses on set turns: SE Bullion (M) turn 7 enemy phase, SW Energy Drop turn 10 EP, NW Second Seal turn 11 EP, NE Rescue turn 11 player phase. FEW (Sibling Blades, rev 741909; Chest/Nintendo 3DS games, rev 687122) is the only source with turn numbers.
- **Results-based rewards.** These are confirmed across FEW, SF, ptnwiki and FE WoD:
  - P6 pays per Inigo kill. The rewards are cumulative, and a sixth kill adds nothing (LP Archive).
  - P7 and P11 pay per villager saved.
  - P3 pays per villager saved (C9).
  - P13's payout depends on which side you back (C8).
  - P5's third talk gives Missiletainn if Owain speaks, else a Speed Tonic.
  - P14 needs the three mirage villages visited in order.
- **Boss-kill maps.** On maps won by defeating the boss (Ch 3, 10, 13, 14, 16–22, 25, P1, P7, P10, P12, P14, P16, P18, P20), a regular enemy's drop is only collected if that enemy is killed before the boss.

### 1.5 Renown

Sources: SF Renown; FEW Renown (rev 762420); 2ch wiki 名声; pegasusknight wiki; toragame.
- **+10 per story map cleared, whatever the difficulty.** A skirmish gives +10, a SpotPass or StreetPass team +50, and Double Duel a varying amount; all of those are out of scope.
- **Unconfirmed:** whether paralogues and Premonition, the Prologue and Endgame give it. GameFAQs and a 2013 pegasusknight comment say DLC maps give none (G6).
- **Claiming rewards:** they're claimed from the world map's Wireless → Renown menu, which opens after Ch 3. Each is claimed once per save file, and claiming doesn't spend renown.
- **Carry-over:** a new file starts with the highest renown of any cleared file (SF, FEW, 2ch). A second playthrough can claim every reward it qualifies for right after Ch 3.

The rewards (SF, FEW, pegasusknight and GameFAQs agree on the thresholds). "Sells for" follows §2:

| Renown | Reward | Sells for |
|---|---|---|
| 50 | Glass Sword | 150 (¼) |
| **100** | **Second Seal** | 1,250 |
| 150 | Orsin's Hatchet | 240 (¼) |
| 210 | Seed of Trust | 250 (¼) |
| 270 | Levin Sword | 800 |
| 330 | Energy Drop | 1,250 |
| 400 | Beast Killer | 825 |
| 470 | Spirit Dust | 1,250 |
| 550 | Celica's Gale | 430 (¼) |
| 630 | Secret Book | 1,250 |
| 720 | Longbow | 1,075 |
| 810 | Ephraim's Lance | 305 (¼) |
| 900 | Goddess Icon | 1,250 |
| **1,000** | **Bullion (L)** | **10,000** |
| 1,200 | Speedwing | 1,250 |
| 1,500 | Leif's Blade | 205 (¼) |
| 1,800 | Bolt Axe | 960 |
| 2,200 | Seraph Robe | 1,250 |
| 2,600 | Innes' Bow | 427 (¼) |
| 3,000 | Mercurius | — (no worth) |
| 3,500 | Dracoshield | 1,250 |
| 4,000 | Noble Rapier | 1,050 |
| 4,500 | Tiki's Tear | 250 (¼) |
| 5,000 | Parthia | — |
| 5,750 | Sigurd's Lance | 480 (¼) |
| 6,500 | Talisman | 1,250 |
| 7,250 | Hector's Axe | 502 (¼) |
| 8,000 | Alm's Blade | 407 (¼) |
| 9,000 | Micaiah's Pyre | 532 (¼) |
| 10,000 | Gradivus | — |
| 30,000 | Naga's Tear | 2,500 |
| 50,000 | Boots | 1,250 |
| 99,999 | Supreme Emblem | 99,999 |

What this means for a forecast (my arithmetic):
- A first file that plays only the route gets 10 renown per map: about 50 maps, so **≤ 500**. That reaches rewards up to Spirit Dust. The Second Seal comes after about 10 maps.
- **The Bullion (L) at 1,000 is out of reach without skirmishes, bonus teams or a carried-over file.**
- The app's own chapter guide assumes more. It tells Robin to take "the Renown Second Seal" at Ch 4 and Lon'qu the renown Levin Sword at Ch 8 (`src/curated/chapter-guide.ts` 4.S4, 8.S3). Neither is reachable from map clears alone by then.
- So renown income depends on the player's out-of-scope play and on earlier files. The forecast should take **renown now** as an input, not derive it.

### 1.6 Event tiles and the Barracks

- **Event tiles** (SF Hidden Treasure; FEW Event tile, rev 737258; pegasusknight):
  - **How many:** 2 per story map and paralogue, none on Endgame, 2 on most series-1 DLC maps (none on Rogues & Redeemers), and 18/15/20 on the Harvest/Summer/Hot-Spring Scrambles (C16).
  - **What one gives:** EXP, weapon EXP, a random item, or support points when stood on by a paired unit. Never gold. Once per battle.
  - **The item pool:** 50 items (C17), all bonus weapons, staves and confections. Every one sells for **a quarter of its worth**, 25–585G.
  - **Odds:** none published. pegasusknight says the result doesn't depend on the map or chapter. One low-trust blog says it's fixed when you deploy.
- **The Barracks** (SF Barracks; FEW Barracks, rev 737229): it opens after Ch 4. A new event comes every 2 hours of **real time**, up to 5 queued. The only event with gold value is the "lost item", drawn from the same 50-item pool. A birthday event also gives an item. It can't be tied to maps.
- For a forecast, both are **noise to be recorded, not predicted**. My estimate, assuming equal odds (unsupported), is about 290G per item result.

## 2. Selling

- **Formula:** an armory pays `worth ÷ 2 × uses left ÷ max uses` (FEW Worth, rev 756230: `(Worth / max uses × uses left) / 2` for *Awakening* and earlier). At full uses this is always a whole number, since every worth is a multiple of 10. Examples:
  - A full Vulnerary sells for 150, one with two uses for 100, one with one use for 50.
  - A Master Seal sells for 1,250.
  - Naga's Tear sells for 2,500 and Missiletainn for 525 (2ch wiki in-game prices).
- **Quarter-price items (¼ instead of ½):**
  - Items: Sweet Tincture, Gaius's Confect, Kris's Confect, Tiki's Tear, Seed of Trust, Reeking Box, Rift Door.
  - Swords: Tree Branch, Glass Sword, Soothing Sword, Superior Edge, Leif's Blade, Roy's, Eliwood's, Eirika's, Seliph's and Alm's Blades.
  - Lances: Log, Glass Lance, Miniature Lance, Shockstick, Superior Lance, Finn's, Ephraim's and Sigurd's Lances.
  - Axes: Ladle, Glass Axe, Imposing Axe, Volant Axe, Superior Axe, Orsin's Hatchet, Titania's Axe, Hector's Axe.
  - Bows: Slack Bow, Glass Bow, Towering Bow, Underdog Bow, Superior Bow, Wolt's Bow, Innes' Bow.
  - Tomes: Dying Blaze, Micaiah's Pyre, Superior Jolt, Katarina's Bolt, Wilderwind, Celica's Gale, Aversa's Night.
  - Staves: Kneader, Balmwood Staff, Catharsis.

  Sources: SF's inventory footnotes, FEW per-item notes and the 2ch wiki's prices. Quarter prices round down: Sweet Tincture 150 → 37, Superior Edge 1,950 → 487.
- **Worth-0 items pay nothing:**
  - Every legendary and personal weapon: Sol, Amatsu, Mercurius, Tyrfing, Balmung, Mystletainn, Sol Katti, Ragnell, Luna, Gradivus, Gáe Bolg, Gungnir, Vengeance, Wolf Berg, Hauteclere, Helswath, Armads, Astra, Parthia, Yewfelle, Nidhogg, Double Bow, Valflame, Mjölnir, Excalibur, Forseti, Book of Naga, Goetia.
  - The Goddess Staff, the three Falchions and all DLC reward items.

  No source says whether the armory refuses them or pays 0G (G9).
- **Bullion and the Supreme Emblem:** Bullion sells for exactly half its worth (1,000 / 5,000 / 10,000). The Supreme Emblem has no worth but sells for **99,999G** (SF, FEW, 2ch). It comes both from 99,999 renown and from Apotheosis's secret route (C15). The gold cap is 999,999G (2ch; medium confidence).
- **Forged weapons can be sold.** The forge-limit message tells you to sell or use them up; there's a limit of 51 kinds of forged weapon. **No source gives their sell price** or says whether any forge cost comes back. FEW's Worth formula for *Awakening* has no forge term (G1).
- **Buying:** the buy price is the worth (FEW Worth; LP shop screenshots). The exceptions:
  - The Reeking Box costs 4,800G on Hard and up (500 on Normal).
  - Merchants' three random extras are sometimes "slightly" discounted (FEW Merchant (shop), rev 737398). The LP shows an Iron Sword at 447G instead of 520.
  - The DLC Silver Card halves buy prices. It comes from a grind map, so it's out of scope.
- **Forging** happens at any world-map armory. It costs a multiple of the worth at full uses: ×0.5 / 1.5 / 3 / 5 / 7.5 for 1–5 levels of a stat, up to 8 levels in all (SF Forging). This matches the app's `FORGE`.
- **Where you shop.** Awakening has **no preparations-screen shop on any difficulty**. You buy, sell and forge at world-map armories between maps. Any cleared location's armory is open, unless Risen or a bonus team is on the node (C1).

## 3. Upkeep

### 3.1 How uses are spent

| Case | Uses spent | Confidence and source |
|---|---|---|
| **Each hit** (first attack, follow-up, counter, either phase) | 1 | High. FEW Durability (rev 772928): a use goes each time a weapon attacks. FEW Armsthrift: rolled per strike. The 2ch wiki's fort-grinding tip (make enemies use their weapons up on enemy phase) shows counters spend uses |
| **A physical miss** | **0**. A hit that deals 0 damage still costs 1 | High. GameFAQs (astrophys); Fandom Dual System |
| **A tome miss** | **Probably 1** (the series rule for tomes and staves) | Medium-low. FEW Durability, Fandom and fedic give the series rule and don't name *Awakening* as an exception. No *Awakening* test (C7, G3) |
| **Brave weapon** (and Waste, Celica's Gale) | 1 per hit: up to 2 per attack, 4 per combat if doubling | High (inferred from the per-hit rule and SF Calculations' attack counts) |
| **Dual Strike** | **1 per hit from the back unit's weapon**. A brave-armed back unit hits twice. Up to 4 Dual Strikes per combat | Medium-high. GameFAQs; Fandom; the 2ch wiki; SF Dual System |
| **Dual Guard** | 0 | Low-medium (inferred: it isn't an attack) |
| **Astra (5 hits), Aether (2 hits)** | 1 in total | High. FEW Astra, rev 773143: "Consumes only 1 point of durability"; 2ch; fedic |
| Sol, Luna, Ignis, Vengeance, Lethality | 1 (they change a single hit) | Medium (no counter-evidence) |
| **Armsthrift** (Mercenary Lv 1) | Each hit has a (Lck × 2)% chance to spend nothing, so it's certain at Luck 50. Works for the back unit's Dual Strikes too. **Doesn't cover staves** | High. SF skills; FEW Armsthrift; 2ch; GameFAQs |
| **Staves** | 1 per cast. No staff can fail | High |
| **Vulnerary, Concoction, Elixir, Pure Water** | 1 per drink, 3 uses each. Tonics have 1 use and don't stack | High |
| Dragonstones and Beaststones | 1 per attack, like weapons | Medium (2ch wiki) |
| Using Gradivus, Hauteclere, Wolt's Bow or Parthia as an item | Not found | G4 |

- **At 0 uses the item is gone.** That includes forged weapons: FEW Durability lists the games that keep a broken remnant, and *Awakening* isn't one of them.
- **Unbreakable:** Falchion, Exalted Falchion, Parallel Falchion, Grima's Truth and the monster weapons (SF shows "–" uses; FEW Durability).
- **The only repair is Hammerne** (1 use, worth 2,000; restores a weapon or staff to full uses). **No armory sells it.** It comes from a random merchant's rare slot, P17's Risen Chief, or Inigo's fifth kill in P6. A forged weapon is effectively consumed by use.
- **The convoy merges partial copies automatically.** For example, 30/35 + 25/35 becomes 35/35 and 20/35 (FEW Durability and Supply convoy; the 2ch wiki). FEW says forged weapons don't merge; a GameFAQs poster disagrees (low impact).

### 3.2 What supplies cost

Buy price = worth (SF inventory; the app's item data matches SF on every row checked). "Per use" is the price ÷ uses. The places are the app's armories; "(m)" means a random merchant's pool only.

| Item | Price | Uses | Per use | First story armory | Paralogue armories |
|---|---|---|---|---|---|
| Vulnerary | 300 | 3 | 100 | Ch 1 | P3 |
| Concoction | 600 | 3 | 200 | Ch 8 | P3, P6, P12, P13, P16 |
| Elixir | 900 | 3 | 300 | **Ch 23** | P6, P8, P10, P12, P22 |
| Pure Water | 600 | 3 | 200 | Ch 16 | — |
| Heal | 600 | 30 | 20 | Ch 1 | P3, P6, P7 |
| Mend | 1,000 | 20 | 50 | Ch 6 | P3, P7, P12 |
| Physic | 1,800 | 10 | 180 | **Ch 18** | P7, P8, P22 |
| Recover | 1,950 | 15 | 130 | Ch 18 | P10, P22 |
| Fortify | 2,500 | 5 | 500 | — (m: P17, Ch 19, Ch 23) | — |
| Rescue | 1,280 | 5 | 256 | Ch 12 | P6, P7, P22 |
| Ward | 2,100 | 5 | 420 | Ch 16 | P7, P12, P22 |
| Hammerne | 2,000 | 1 | — | — (merchant rare slot only) | — |
| Iron Sword / Lance / Axe / Bow | 520 / 560 / 600 / 560 | 40 | 13–15 | Ch 4–5 | P1 |
| Steel Sword / Lance / Axe / Bow | 840 / 910 / 980 / 910 | 35 | 24–28 | Ch 9 | P4 |
| **Silver Sword / Lance / Axe / Bow** | 1,410 / 1,560 / 1,740 / 1,560 | 30 | **47–58** | Lance and Bow Ch 14; Sword and Axe Ch 15 | P5 (Sword), P9 (Lance), P11 (Axe), P15 (Bow) |
| Brave Sword / Lance / Axe / Bow | 2,100 / 2,220 / 2,400 / 2,220 | 30 | 70–80 | Ch 25 | P18–P21 (m from P5) |
| Javelin / Hand Axe | 700 / 750 | 25 | 28 / 30 | Ch 7 | P2 |
| Killing Edge / Killer Lance / Killer Axe / Killer Bow | 1,470 / 1,680 / 1,860 / 1,680 | 30 | 49–62 | Ch 19–20 | P5, P9, P11, P15 |
| Elfire / Elthunder / Elwind | 980 / 1,050 / 910 | 35 | 26–30 | Ch 13 | P14 |
| Arcfire / Arcthunder / Arcwind | 1,440 / 1,620 / 1,320 | 30 | 44–54 | Ch 17 / Ch 21 | P17 |
| Bolganone / Thoron / Rexcalibur | 2,000 / 2,200 / 1,900 | 25 | 76–88 | Ch 24 | P19–P21 |
| Nosferatu / Ruin / Waste | 980 / 1,380 / 2,160 | 20 / 20 / 30 | 49 / 69 / 72 | Ch 13 / Ch 19 / Ch 24 | P14, P17, P20 |
| Dragonstone / Beaststone | 2,300 / 2,000 | 50 | 46 / 40 | Ch 12 | P16 / P13 |
| Dragonstone+ / Beaststone+ | 3,780 / 3,220 | 35 | 108 / 92 | Ch 23 | P18 (C5) |
| Master Seal / Second Seal | 2,500 | 1 | 2,500 | Ch 12 / Ch 16 | §4 |

Worked example (my arithmetic): a Lead with a Silver Lance who lands 12 hits on a map spends 12 × 52 = 624G of lance. With a Silver-armed back unit that Dual Strikes 4 times, add about 200G. A healer who casts Physic 5 times spends 900G. Early on, the story maps' armories sell no Elixir until Ch 23 and no Physic until Ch 18. The Ch 13 paralogue armories close most of that gap.

## 4. Seals and promotions

| Seal | Price | Sells for | Armories (opens after) | Free on the route | Before an armory |
|---|---|---|---|---|---|
| **Master Seal** | 2,500 | 1,250 | **Port Ferox, Ch 12** (no marriage needed); Dueling Grounds P8, Ruins of Time P12, Law's End P13 (each can open right after Ch 13) | Ch 8 village; Ch 10 escaping Thief; Ch 11 Hero; Ch 12 Paladin; Ch 14 Ignatius; Ch 15 Farber; Ch 16 Thief (escaping) and Sniper; Ch 17 chest; P6 Jamil; P7 Xalbador; P14 Nombry; P15 Bow Knight. That's **13** (9 story, 4 paralogue), plus the Harvest Scramble boss | Random merchants whose pool has it: every location from the Prologue to Ch 10, and P1–P3 |
| **Second Seal** | 2,500 | 1,250 | **The Mila Tree, Ch 16** (no marriage needed); Mercenary Fortress P10 and Manor of Lost Souls P16 (right after Ch 13); Great Gate P6 (after Ch 14, or once P12 is unlocked) | Ch 8 village; Ch 12 Bow Knight; Ch 14 chest; Ch 15 village; Ch 18 chest (before turn 11); Ch 20 chest; P5 Gecko; P9 Great Knight; P12 chest; P16 chest. That's **10** (6 story, 4 paralogue), plus **100 renown** | Same merchant pools |

- **Sources:** SF Shops, Merchants and Item Locations; FEW Master Seal (rev 759311) and Second Seal (rev 759458); the FEW chapter pages; ptnwiki; Tanas Manor. The app's seal list matches them item for item. The only addition is the renown Second Seal. SF's item locations leave out the Ch 14 chest; the app is right to keep it (C14).
- **Merchants:** they first appear after Ch 3, at random, and sell the host armory's stock plus three random extras from the location's pool. A merchant at an early location can offer a seal late in the game. Neither the spawn rate nor the pick odds are documented, so **a plan can't count on a merchant** (C19).
- **Promotion and reclass.** A Master Seal promotes a unit at level 10+. A Second Seal reclasses a unit at level 10+, or a promoted unit. Neither has any other cost. Each promotion or reclass the plan buys costs 2,500G, less the free seals on hand.

## 5. What the app's data holds, against the sources

Checked: `src/game-data/chapters.ts`, `src/game-data/chapters/*.ts`, `src/game-data/items.ts`, `src/game-data/items/list.ts`, `src/engine/supply.ts` (`SEAL_RULES`, `openStock`, `sealAvailability`, `supplyList`) and `src/engine/run.ts` (`Snapshot`, `HeldItem`).

**What's right**
- **Items:** the 598 armory and merchant prices across 49 shops match the item worths, apart from the 6 below. The worths and uses of the 60-odd weapons, staves, consumables and seals checked match SF. The forge rules match SF Forging.
- **Maps:** the free-seal lists match SF, FEW and ptnwiki. The Prologue, Ch 1 and Ch 2 armories opening "after Chapter 3" is right. The conditional rewards (P6, P7, P11, P13, P14, Ch 18) are listed with their conditions as text. Every other map's Bullion row is confirmed (SF, FEW Bullion, ptnwiki).
- **Skills and the engine:** Armsthrift (Lck × 2%) and Despoil (Lck%) are in `skills.ts`. `openStock` counts armories only, and `sealAvailability` reads the real stock, so it already finds the paralogue seal armories.

**What's missing or wrong**
1. **Paralogues 3, 8 and 10 have no items.** Their FEW pages use a different template (`ChapItemsCell FE13`), which the generator skipped. They should list:
   - P3: Elixir, Blessed Bow, and the Seraph Robe / Log / Ladle villager rewards.
   - P8: Dracoshield, Door Key, Short Spear chest, **Bullion (M)** chest.
   - P10: Talisman, Master Key, **Bullion (M)** chest, Levin Sword chest.

   That's **10,000G of Bullion missing**. (The enemies' drops on these maps are in the enemy tables; the chests and villages aren't anywhere.)
2. **Four FEW price typos were copied into the shops** (C2–C5): Prologue Bronze Lance/Axe swapped, Ch 8 merchant Ward 2,150, Ch 18 merchant Thoron 2,220, P18 Dragonstone+/Beaststone+ swapped. The P18 swap matters to the endpoint kit.
3. **`SEAL_RULES` describes a shop rule the game doesn't have.** `prepShopOnHardUp: false` and the comment "The preparations shop is disabled on Hard and up" come from FEW's FE6 section. *Awakening* has no preparations shop at all (C1). The text also names only Port Ferox and the Mila Tree. That was already noted as #140's C8: `sealAvailability`'s note says "from the Mila Tree armory after Chapter 16" even when P6, P10 or P16 has opened a Second Seal armory earlier.
4. **No structured sell rate.** `GameItem.worth` is the buy price. The quarter rule is only in `notes` text, and it's missing for 7 items (Sweet Tincture, Gaius's and Kris's Confect, Tiki's Tear, Seed of Trust, Reeking Box, Rift Door). The Supreme Emblem has no worth but sells for 99,999.
5. **Gold isn't numeric.** P13's "500G" and "10,000G" are item names in `items`. The 500G scales with surviving NPCs.
6. **No play-dependence flags.** The following are all stored like fixed items:
   - escaping carriers (Ch 10, Ch 16, P9, Roster Rescue);
   - chest-looting Thieves (P1, P4, Ch 11, P12, Ch 17, Ch 20);
   - burnable villages (P2, P14);
   - Ch 18's turn-limited chests;
   - either-or rewards (recruit-or-kill drops, P5's talk, P13's sides).

   Only the `how` text carries them.
7. **Rows that aren't new items:** P15's "Steel Bow added to Noire's inventory" repeats her recruit inventory, and Ch 24's Exalted Falchion replaces the Falchion.
8. **P18's Lunatic tab flags 10 weapons as drops** that no other source has (C13).
9. **Not in the data at all:** renown and its reward table, the event-tile and Barracks item pool, the merchants' "rare item" pool (which is where Hammerne is sold), starting gold, and the Reeking Box's Hard+ price as a number (it's only in the description text). `eventTiles` counts are right (FEW).
10. **Rapier worth** (I1) stays open. The Japanese sources side with FEW's 1,470 (C6).

## 6. Disagreements

"App" means the repo's data. Where a disagreement is FEW against FEW, the page named first is the one the app uses.

| ID | What | Side A | Side B | Pick, and why |
|---|---|---|---|---|
| C1 | Preparations shop | App `SEAL_RULES` and research/chapter-data §6: disabled on Hard and up (citing FEW Difficulty) | FEW Difficulty rev 737046: that sentence is in the **FE6** section. FEW Preparations rev 737954 lists no *Awakening* preparations shop. GamerGuides and the LP go to the world map to shop | **No preparations shop in *Awakening* on any difficulty.** Behaviour is the same (shop between maps), but the rule and comment are wrong |
| C2 | Prologue Southtown armory | FEW The Verge of History rev 741973 (app): Bronze Lance 400, Bronze Axe 350 | SF worths, FEW Bronze Lance/Bronze Axe pages, ptnwiki, FE WoD, Tanas Manor: Lance 350, Axe 400 | **350 / 400**: a swap on one FEW page against six sources |
| C3 | Ch 8 merchant Ward | FEW The Grimleal rev 741956 (app): 2,150 | 2,100 on FEW Ward, FEW's other five Ward listings, ptnwiki, FE WoD | **2,100** |
| C4 | Ch 18 merchant Thoron | FEW Sibling Blades rev 741909 (app): 2,220 | 2,200 on FEW Thoron, FEW's other listings, ptnwiki, FE WoD. 2,220 is the Brave Lance/Bow price on the same page | **2,200** |
| C5 | P18 armory Dragonstone+ / Beaststone+ | FEW The Dead King's Lament rev 741895 (app): 3,220 / 3,780 | SF, FEW item pages, FEW's Ch 17/18/23 listings, ptnwiki, FE WoD, Tanas Manor: 3,780 / 3,220 | **Dragonstone+ 3,780, Beaststone+ 3,220** |
| C6 | Rapier worth (the app's I1) | SF, Fandom, and FEW's own merchant tables (Ch 6, 11, 14): 1,600 (app) | FEW Rapier rev 770819, 2ch wiki (sells for 735), pegasusknight, toragame: 1,470 | **Open, leaning 1,470.** The Japanese sources are SF's upstream and agree with each other. FEW's merchant tables side with SF. Low impact |
| C7 | Does a tome miss spend a use? | GameFAQs: "a missed attack subtracts no durability", with no tome caveat | FEW Durability, Fandom Usage, fedic: tomes and staves lose a use on a miss, and none lists *Awakening* as an exception | **Physical miss free, tome miss costs 1**, pending an in-game test (G3) |
| C8 | P13's 500G | FEW Rival Bands, Fandom, ptnwiki, SF script (gated "if allied and at least one ally survived"): per surviving allied NPC | FE WoD, Gamer Guides, a GameFAQs post: per enemy killed | **Per surviving allied NPC**: the most detailed sources and the script agree |
| C9 | P3 villager rewards | FEW: Seraph Robe at 1 survivor, Log at 2, Ladle at 3 | SF, FE WoD: Log at 1. ptnwiki: each villager is tied to one item | **FEW's 1/2/3 tiers.** Low stakes (the Log and Ladle are worth 25G each) |
| C10 | Who burns villages | FEW Village rev 756356: Barbarians only | FE WoD: Barbarians and Berserkers | **Treat both as a risk**: P14 has both |
| C11 | Ch 17 chest | FEW Chest/Nintendo 3DS games: Fortify | FEW Inexorable Death, SF, ptnwiki: Master Seal (Fortify is Pheros's drop) | **Master Seal** (app right) |
| C12 | End-of-map Bullion (L) | FEW Bullion rev 765948: end of Ch 22 | FEW The Wellspring of Truth, SF, FE WoD: end of P22 | **P22** (app right) |
| C13 | P18 Lunatic drops (Tomahawk, Hammer, 4 Silver Swords, 4 Silver Bows, Rexcalibur) | FEW P18 Lunatic tab (app) | SF item locations, FE WoD, FEW's own P18 item list: none | **Don't count them.** They're likely an entry slip: the neighbouring rows use `forged`, not `drop` |
| C14 | Ch 14 Second Seal and Recover chests | FEW Flames on the Blue (app), ptnwiki, FE WoD: present | SF item locations, FEW Second Seal page: absent | **Present** (app right). SF also misses other chests FEW and ptnwiki agree on |
| C15 | Supreme Emblem source | SF items: max renown | FEW Apotheosis: the secret route | **Both** (FEW Supreme Emblem rev 759403; 2ch). The app's item note and chapter row are each half right |
| C16 | Event tiles per map | SF: "at least 2" | FEW Event tile rev 737258: exactly 2; none on Endgame and Rogues & Redeemers; 15–20 on the Scrambles | **FEW** (more specific, and its tile lists match) |
| C17 | Event-tile and Barracks item pool | SF: 50 items | FEW: 49 (no Underdog Bow); pegasusknight: 49 (no Shockstick) | **SF's 50**, the union of the other two |
| C18 | Forge cost on a used weapon | SF Forging: always worth at full uses | A GameFAQs answer: cheaper when used | **SF** (the app's `forgeCost` already does this) |
| C19 | When merchants appear | ptnwiki: after a map clear | Tanas Manor, FE WoD, LP: in real time | Unresolved. Out of scope (merchants aren't counted) |
| C20 | When the shops open | FEW chapter pages, LP (screenshots): after Ch 3 | A GameFAQs guide: after Ch 4 | **After Ch 3** (app right) |

Minor, out of scope: StreetPass renown (30 on pegasusknight, 50 everywhere else); whether the Silver Card must be held (FEW: anyone, even from the convoy; a GameFAQs guide: the selected unit); whether identical forged weapons merge in the convoy; where a Barracks item goes (SF: the unit; FEW and ptnwiki: the convoy).

## 7. Gaps

| ID | Gap | Why it matters |
|---|---|---|
| G1 | **Sell price of a forged weapon**, and whether any forge cost comes back | Whether the endpoint kit's forges hold any value. Assume the unforged price until checked |
| G2 | **Rounding for partly used items** at ½ and ¼ (only full-use ¼ prices are known to round down) | ±1G per sale |
| G3 | **Do tomes and magic weapons** (Levin Sword, Bolt Axe, Shockstick) **spend a use on a miss?** (C7) | Mages' upkeep scales with 1 − hit% or not |
| G4 | Whether using Gradivus, Hauteclere, Wolt's Bow or Parthia as a heal spends a use | Minor |
| G5 | Dual Guard's cost and enemy-phase counters' cost are **inferred**, not stated | Low: both follow the per-hit rule |
| G6 | **Renown from paralogues** (+10 each?), from Premonition, the Prologue and Endgame, and from DLC maps (probably none) | Decides when the renown Second Seal arrives on a first file |
| G7 | **Odds for event tiles and Barracks items**; whether Luck or the unit matters | These can only be recorded, not forecast |
| G8 | Weights of the DLC random village and chest pool | No gold either way (no Bullion in the pool) |
| G9 | Whether an armory refuses worth-0 items or pays 0G | None for gold |
| G10 | Whether a story drop is lost when an NPC makes the kill (P13's allied bosses); which P12 chests the Thieves target; an independent source for Ch 18's turn numbers | Whether P13's Bullion needs the player's kill |
| G11 | Whether Despoil procs on a Dual Strike kill | Despoil income per kill |
| G12 | Merchant spawn rate, pick odds and the sale discount | Out of scope |
| G13 | Whether Apotheosis's Supreme Emblem repeats on replay | Out of scope (replays are grind) |
| G14 | A full inventory on Ch 2, before the convoy exists | Minor |

## 8. For the gold forecast

**Model.** Gold after a map = gold before + the sale value of the Bullion collected (+ P13's gold) + anything the plan decides to sell − purchases (upkeep, seals, kit) − forges.
- **Each map's income comes from the chapter data** (§1.3), with each play-dependent row as a probability or a player choice.
- **Upkeep comes from the per-hit rule:** expected hits landed × worth ÷ max uses. Tomes may be priced per attack (G3). Dual Strikes count on the back unit's weapon. Scale by (1 − min(1, 2 × Lck ÷ 100)) for Armsthrift.
- **Despoil adds** Lck% × player-phase kills × 1,000G.
- **The EXP forecast's kill shares** (#146) and the map solver's hit rates supply the counts.
- **Seals** are 2,500G each once the free ones on hand are used. **Renown rewards** land when renown crosses a threshold.

**What the run entries don't record today.** A run entry's snapshot records gold, the convoy and inventories with uses left and forges. That shows what the army holds after each map, but a forecast also needs:
1. **Transactions between maps.** A forecast needs what was bought, sold and forged, and for how much. Gold only moves through transactions (apart from starting gold and P13), so the gold difference between two entries mixes upkeep, seals, promotions and kit. It can't calibrate any one of them.
2. **Which optional income was taken**: villages visited, chests opened, escaping carriers caught, P6/P7/P11 tiers, the P13 side. New items in the snapshot hint at it but aren't tied to a source, and they're mixed with purchases and random finds.
3. **Uses spent per unit per map.** Differences in uses left are blurred by purchases, the convoy's automatic merging of partial copies, and Hammerne. Without this, upkeep per map can't be recalibrated from play.
4. **Renown**: the current value, the renown a new file started with (carried from earlier files), and which rewards were claimed. None is in the snapshot or the Run facts, and map clears alone don't explain the renown the app's own chapter guide assumes (§1.5).
5. **Random finds** (event tiles, the Barracks, merchants), so they can be told apart from map income.
6. **A sell policy**: which items the plan keeps (seals, stat boosters, kit weapons) and which it sells. Bullion is always sold.
7. **When the gold was read**: before or after shopping.

The chapter data also needs the §5 fixes before it can feed a forecast: the P3/P8/P10 items, numeric gold, play-dependence flags, a structured sell rate, the four price fixes, the renown table and the corrected seal rule.

## 9. Sources

All pages read on 2026-09-25. SF pages have no revision ids.

| Source | Pages | Used for |
|---|---|---|
| **Serenes Forest** (serenesforest.net/awakening/) | Inventory (swords, lances, axes, bows, tomes, staves, stones, items); Miscellaneous: shops, merchants, item-locations, forging, renown, hidden-treasure, barracks, calculations, dual-system, bonus-teams, downloadable-content (NA), hints-and-secrets; skills; FAQ; SF wiki P13 script | Worths, uses, quarter-sell items, shops and pools, seal locations, forging, renown, tiles, Barracks, Dual Strike limits |
| **Fire Emblem Wiki** (fireemblemwiki.org), revision ids | Gold 763531; Worth 756230; Bullion 765948; Renown 762420; Event tile 737258; Barracks 737229; Supply convoy 765132; Durability 772928; Armsthrift 685308; Despoil 700887; Difficulty 737046; Preparations 737954; Supreme Emblem 759403; Silver Card 763490; Reeking Box 759980; Rift Door 759928; Forge 748423; Merchant (shop) 737398; Village 756356; Village/Nintendo 3DS games 752345; Chest 768500; Chest/Nintendo 3DS games 687122; Inventory 756372; Thief 770225; Steal 759253; Astra 773143; Pair Up 756409; Brave weapon 705914; Hammerne 768540; Rapier 770819; Master Seal 759311; Second Seal 759458; Hidden treasure/Nintendo 3DS games 658587; Downloadable content in *Fire Emblem Awakening* 752364; chapter pages at the app's oldids (unchanged), including A Strangled Peace 742001, A Duel Disgraced 742211, Ambivalence 742184, Rival Bands 741913, Sibling Blades 741909, The Dead King's Lament 741895, The Verge of History 741973, The Grimleal 741956, The Wellspring of Truth 700134 | Every rule, cross-checked |
| **Japanese wikis** | ptnwiki (shop-bukiya, shop-gyoushounin, item2-p, item2-kinkai, chart-11, chartex-3/8/9/10/13 pages); 2ch FE覚醒 atwiki via archive.org (武器, 道具, 小ネタ, FAQ, 名声, 外伝13, DLC); pegasusknight wiki (名声, 光マス); toragame (名声); fedic (durability and Astra entries) | In-game sell prices, renown, tiles, map rewards, use rules |
| **Other cross-checks** | FE WoD (fireemblemwod.com, fe13 shop and chapter guides); Tanas Manor (shops, items); LP Archive, *Fire Emblem Awakening* (Updates 03, 69, 77, 94: screenshots of gold, shops and merchants); GameFAQs boards and guides for *Fire Emblem Awakening* (643003); Fandom (Dual System, Usage, Forge); GamerGuides | Starting gold, shop prices, miss rules, Dual Strike upkeep, P13 |

Some sites refused automated reads (GameFAQs and Fandom behind Cloudflare, the 2ch atwiki, kamikouryaku). Where that happened, the claim rests on the other sources in its row.
