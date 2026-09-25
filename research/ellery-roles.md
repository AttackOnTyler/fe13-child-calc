# Ellery on child roles and army composition

For [What do Ellery's guides say about child roles and army composition?](https://github.com/AttackOnTyler/fe13-child-calc/issues/74), on [Map: Derived roles](https://github.com/AttackOnTyler/fe13-child-calc/issues/67).

**Source:** the user's Gemini Notebook of Ellery's livestreams and unit guides (15 sources), queried on 2026-09-24. Everything below paraphrases the notebook's answers, which cite these videos: *How to Build a TEAM for Lunatic+ in Fire Emblem Awakening*, *It's Time To Optimize Lunatic+ [Step 1: Team Building]*, *FE Awakening's 2nd Generation EXPLAINED in 1 Hour!*, *DLC Showcase in Fire Emblem Awakening Lunatic+*, *Henry is NOT Bad!?*, *Lon'qu is BETTER than you think…*, *Lissa is ACTUALLY the BEST Character*, *Miriel is EXTREMELY Underrated*, *Why is Robin SO OVERPOWERED?* and *Characters EXPLAINED*. **Caveat:** these are AI summaries of the videos, not transcripts. Deployment counts especially should be checked against the video before they change a curated number.

## 1. How a back is chosen

- The army is built around **4 leads + 4 backs**, one back behind each lead.
- There are two filters, applied in order:
  1. **Who can lead.** A lead needs **Galeforce and/or Dark Mage/Sorcerer access** (Nosferatu or Vantage/Vengeance tanking), plus high Spd and offensive procs.
  2. **Who backs.** Children who fail the lead filter (**Gerome, Yarne**: no Galeforce, no Dark Mage) or have a poor Spd cap (**Nah**) go to the back row. Spd doesn't matter there, while their Str/Def/Mag bonuses, Faires, Dual Guard+ and dual-strike crits do.
- **Pairing a back to its lead is tailored.** A slow lead gets a high-Spd back (Assassin, Trickster). A magic lead gets a Sorcerer or Sage back with Tomefaire, Hex and Anathema. A fragile Galeforce lead gets a Berserker or Wyvern Lord back with Dual Guard+.
- Back-row skills he values: Hex/Anathema, Dual Guard+, Dual Support+/Demoiselle, Solidarity, and Faires (Faires apply on dual strikes, Luna/Astra don't). Longbow Sniper backs deal dual-strike damage without taking Counter.
- Gen 1 examples: Frederick falls off as a lead and becomes a back, and Henry is a ready-made Hex/Anathema back.

## 2. Army composition

| | Main story (Ch. 12 template) | Apotheosis / postgame |
|---|---|---|
| Total deployed | 12, rising to 14–15 on late or DLC maps | 12–14 (up to 15) |
| Leads | 4 (2 enemy-phase tanks + 2 Galeforce player-phase) | 4, all Gen 2 |
| Backs | 4 | 4, all Gen 2 |
| Staff / Rescue | 3 (15 Rescue charges is his rule) | 1–3, using spare slots, which can be Gen 2 staff (Sage Brady, Falcon Knight Cynthia) |
| Rally | none dedicated. Rallies come with classes already in use, or go to Gen 2 (Brady, Morgan) | **2 dedicated rally bots, both Gen 1:** Robin and Maribelle |
| Dancer | 1 (Olivia) | 1 (Olivia) |

- **Roles invert between contexts.** In the main story Gen 1 does the fighting and Gen 2 is optional or support. In Apotheosis Gen 2 fills all 8 lead and back slots, and Gen 1 fills rally.
- **Left out in Apotheosis:** 13 children compete for 8 slots. He names **Kjelle and Nah** as the first to bench: Kjelle needs a contested Galeforce father, Nah is a weak lead, and Gerome or Yarne do her back-row job better.

## 3. Per child

| Child | Main story | Apotheosis |
|---|---|---|
| Lucina | Galeforce lead (overrated when not grinding) | Galeforce / Aether lead |
| Owain | Staff → Vantage Nosferatu tank or Sage | Vantage/Vengeance/Wrath or Sage Galeforce lead |
| Inigo | Sol tank or Bow Knight | Galeforce lead **or** high-damage back |
| Brady | **Staff + rally bot** | Galeforce magic lead **or** Dual Support+ back |
| Kjelle | Physical tank | Galeforce attacker or tanky lead; **first to bench** |
| Cynthia | Galeforce lead or Falcon Knight staff | Galeforce Sorcerer / Dark Flier lead |
| Severa | Sol or Nosferatu tank | Galeforce lead |
| Gerome | **Back** | **Back** |
| Morgan | Rally bot or combat lead | Lead or aura/crit back |
| Yarne | **Back** | **Back** (high-Spd physical) |
| Laurent | Sage staff or Vantage Nosferatu | Vantage/Vengeance/Wrath Sorcerer lead |
| Noire | Sniper / Bow Knight | Galeforce Sniper or Sorcerer lead |
| Nah | Dragonstone tank | **Back**; also a bench candidate |

## What this means for the map

- **"Lowest Lead standing moves to Battery" agrees with him on who backs:** the children who fail as leads. It disagrees on *why*. He picks backs for back-row value (pair-up bonuses and skills), and the Battery preset currently can't tell children apart (zero spread; ruled out of scope on the map). So the proxy works now, and army fit should start using Battery standing when the Battery scoring fix lands.
- **Pairing a back to a specific lead** is a planner concern (who stands behind whom) that the app doesn't model. It's beyond per-child roles.
- **Quotas:** his armies are smaller than the seeded Apotheosis cap of 20. His shape is 4/4/staff 1–3/rally 2/dancer 1. The seed has Staff/Rally as one role. He separates staff (Rescue) from rally, and in Apotheosis the rally bots are Gen 1, so they fall outside army fit.
- **Play context matters:** roles change between main story and Apotheosis, and Gen 2 children play support or staff roles in the main story. This feeds the play-context fog on the map.
