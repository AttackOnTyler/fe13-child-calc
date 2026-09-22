# Skill inheritance and class skill tables (Fire Emblem Awakening)

Research for issue #4 (part of #1). Researched 2026-09-22.

## Sources

The two sources below were read directly. Every rule is tagged with the one it comes from.

- **[SF-children]** Serenes Forest, *Children*: https://serenesforest.net/awakening/characters/children/
- **[SF-skills]** Serenes Forest, *Skills*: https://serenesforest.net/awakening/miscellaneous/skills/
- **[SF-lucina]**, **[SF-morgan-f]**, **[SF-morgan-m]**: Serenes Forest per-child inheritance pages, e.g. https://serenesforest.net/awakening/characters/children/lucina/, `.../morgan-f/`, `.../morgan-m/` (also `.../nah/`, `.../yarne/`)
- **[FEW-inh]** Fire Emblem Wiki, *Inheritance* (Awakening section): https://fireemblemwiki.org/wiki/Inheritance
- **[FEW-list]** Fire Emblem Wiki, *List of skills in Fire Emblem Awakening*: https://fireemblemwiki.org/wiki/List_of_skills_in_Fire_Emblem_Awakening
- **[FEW-dlc]** Fire Emblem Wiki, *Downloadable content in Fire Emblem Awakening* (Classes, Skills and chapter rewards): https://fireemblemwiki.org/wiki/Downloadable_content_in_Fire_Emblem_Awakening
- **[FEW-char]** Fire Emblem Wiki character infobox notes: https://fireemblemwiki.org/wiki/Lucina, https://fireemblemwiki.org/wiki/Morgan, https://fireemblemwiki.org/wiki/Nah, https://fireemblemwiki.org/wiki/Yarne
- **[FEW-class]** Fire Emblem Wiki class pages: https://fireemblemwiki.org/wiki/Dark_Flier, https://fireemblemwiki.org/wiki/Dread_Fighter, https://fireemblemwiki.org/wiki/Bride, https://fireemblemwiki.org/wiki/Lodestar, https://fireemblemwiki.org/wiki/Conqueror
- **[FEW-skills]** Fire Emblem Wiki, *Skills* (Awakening section): https://fireemblemwiki.org/wiki/Skills

## 1. General rule: which skill each parent passes on

| # | Rule | Source |
|---|------|--------|
| R1 | A unit can have at most **5 skills equipped** ("active"). The rest sit in a skill pool and can be swapped freely outside battle. | [SF-skills], [FEW-skills] |
| R2 | A child inherits **exactly one skill from each parent**: the parent's **last active (equipped) skill**. Serenes Forest calls it the "last active Skill"; FEW-inh calls it "the most recently activated skills". | [SF-children], [FEW-inh] |
| R3 | "Last" means the **lowest eligible skill in the parent's equipped list**. If that skill is ineligible, the next one up is used. If none of the equipped skills is eligible, **nothing** is inherited from that parent. The list doesn't have to be full: with 3 equipped skills, the 3rd one passes. | [FEW-char] (infobox notes on Lucina, Morgan, Nah and Yarne: "The lowest eligible skill in the [parent]'s equipped skill list. [Child] will not inherit a skill if [parent] does not have an eligible skill anywhere in [their] equipped skill pool.") |
| R4 | Skills in the parent's pool that aren't equipped are **never** considered. | Follows from R2 and R3 ("equipped skill list"); [SF-children] says "active". |
| R5 | Inheritance is **locked in when the player enters the child's recruitment paralogue**. For Lucina, it happens at the end of Chapter 13. Until then, the parents' skills can be rearranged freely. | [SF-children], [FEW-inh] |
| R6 | An inherited skill **does not have to be in the child's class pool**. Examples: Demoiselle or Galeforce on sons. Skills from gender-locked classes pass across genders, **except Special Dance**. | [SF-children], [FEW-inh] |
| R7 | Each child also starts with the level 1 skill (and the level 10 skill, if their join level allows it) of their own starting class. The inherited skills are added on top. | [FEW-char] (e.g. Nah: Odd Rhythm + father's + Nowi's; Morgan: level 1 and level 10 base-class skills + Robin's + other parent's) |

### Ineligible (never inherited)

| Skill(s) | Why | Source |
|---|---|---|
| **Special Dance** | Explicitly excluded, because Dancer can't be inherited. (**Luck +4**, the other Dancer skill, *can* be inherited.) | [SF-children], [FEW-inh], [SF-lucina] (Olivia's unique inheritable skill: "Dancer: Luck +4") |
| **All DLC skills**: Resistance +10 and Aggressor (Dread Fighter), Rally Heart and Bond (Bride), All Stats +2, Paragon, Iote's Shield, Limit Breaker | "Classes and Skills obtained from DLC (this includes Skills learned by DLC classes) can not be inherited." | [SF-children], [FEW-inh] ("Skills obtained from DLC can never be inherited") |
| **Enemy-only skills**: Dragonskin, Hit Rate +10, **Rightful God**, Vantage+, Luna+, Hawkeye, Pavise+, Aegis+ | Players can't obtain these, so they can never be passed on. | [SF-skills] (Enemy-only Skills), [FEW-list] |

The DLC classes themselves (Dread Fighter, Bride) also can't be inherited as class options [SF-children].

## 2. Fixed and special cases

| Case | Rule | Source |
|---|---|---|
| **Lucina** (Chrom's daughter) | Always gets **Aether** from Chrom, even if Chrom hasn't learned it. Chrom's equipped skills are irrelevant. She still inherits her **mother's** skill normally (R3). If her mother is the **Maiden**, she inherits nothing from her mother. Her starting kit is Dual Strike+, Charm, Aether and the mother's skill. | [SF-children], [FEW-inh], [SF-lucina] ("None (Always inherits Aether)"), [FEW-char] Lucina |
| **Chrom's other daughter** (Cynthia if the mother is Sumia, Kjelle if Sully) | Always gets **Aether** from Chrom, plus the mother's skill. | [SF-children] ("his daughter(s) will always learn Aether"), [FEW-inh] |
| **Chrom's son** (Inigo if the mother is Olivia, Brady if Maribelle) | Always gets **Rightful King** from Chrom, even if Chrom hasn't learned it, plus the mother's skill. | [SF-children], [FEW-inh] |
| **Morgan**, general | Inherits Robin's lowest eligible equipped skill plus the other parent's lowest eligible equipped skill (R3). Robin can pass gender-locked skills that Morgan can't learn otherwise: to male Morgan, the Pegasus Knight, Falcon Knight, Dark Flier, Troubadour and Valkyrie skills; to female Morgan, the Fighter, Warrior, Barbarian and Berserker skills. | [FEW-char] Morgan, [SF-morgan-f], [SF-morgan-m] |
| Morgan with **Lucina, or Lucina's sister** as mother | Morgan **always** inherits **Aether** from her. | [FEW-inh]; [SF-morgan-f] (Lucina: "Always inherits Aether") |
| Morgan with **Chrom, or Chrom's son** as father | Morgan **always** inherits **Rightful King**. | [FEW-inh]; [SF-morgan-m] (Chrom: "Always inherits Rightful King") |
| Morgan with **Aversa** or **Walhart** | Morgan **always** inherits **Shadowgift** (Aversa) or **Conquest** (Walhart). These are personal skills, and only Morgan can get them. | [FEW-inh], [SF-morgan-f], [SF-morgan-m], [SF-skills] |
| **Nah** | **No fixed inheritance.** She starts with Odd Rhythm (Manakete level 1) and inherits one skill from her father and one from Nowi under R3. | [FEW-char] Nah; nothing special listed at https://serenesforest.net/awakening/characters/children/nah/ |
| **Yarne** | **No fixed inheritance.** He starts with Even Rhythm (Taguel level 1) and inherits one skill from each parent under R3. (His one oddity is about classes, not skills: from Panne he gets the Barbarian tree instead of Wyvern Rider.) | [FEW-char] Yarne; [SF-children] footnote on Panne |
| Personal skills in general | The only player personal skills in Awakening are **Shadowgift** and **Conquest**, and they pass only as described above. No other personal skills exist. | [SF-skills], [FEW-list] ("Personal skill only") |
| Skills a parent inherited | A parent's own *inherited* skill can be passed on again. Example: a child whose mother carries Galeforce, or a Chrom-fathered spouse passing Aether or Rightful King to Morgan. | [FEW-char] Morgan table ("Aether: Lucina, Cynthia or Kjelle (if fathered by Chrom)"), Nah/Yarne notes ("directly or indirectly") |

### Skill-by-skill answers to the ticket

| Skill | Inheritable? | Notes / source |
|---|---|---|
| Limit Breaker | **No** | DLC skill item (reward from Rogues & Redeemers 3) [FEW-dlc]. DLC skills can't be inherited [SF-children], [FEW-inh]. |
| Aggressor | **No** | Dread Fighter (DLC) level 15 [SF-skills], [FEW-list]. DLC [SF-children]. |
| Paragon | **No** | DLC skill item (Lost Bloodlines 3) [FEW-dlc]. |
| All Stats +2 / Iote's Shield | **No** | DLC skill items (Champions of Yore 3 / Smash Brethren 3) [FEW-dlc]. |
| Resistance +10, Rally Heart, Bond | **No** | DLC class skills [SF-children]. |
| Rightful God | **No** | Enemy-only (Grima), Lunatic and up [SF-skills], [FEW-list]. |
| Rightful King | **Yes** | This is a base-game skill (Great Lord level 15), not DLC. It is forced onto Chrom's sons. |
| Hex | **Yes** | This is a base-game skill (Dark Mage level 1), not DLC. It follows the normal R3 rules. |
| Galeforce | **Yes** | Dark Flier is a **base-game** promotion of Pegasus Knight, not a DLC class [FEW-class Dark Flier], [SF-skills] (no DLC mark). It can pass to sons [FEW-inh]. |
| Special Dance | **No** | See section 1. |
| Luck +4 | **Yes** | See section 1. |

## 3. Class skill table (who teaches what, at which level)

Units learn skills at level 1 and 10 in base classes, and at level 5 and 15 in promoted classes [FEW-skills]. Special classes teach theirs at level 1 and 15. The data below comes from [SF-skills] and [FEW-list], which agree on every row. The *Gender* column is only filled in where a source says so: [FEW-char] Morgan's gender-locked table, and [FEW-class]/[FEW-dlc] for the DLC classes.

### Base (unpromoted) classes

| Class | Lv 1 | Lv 10 | Gender |
|---|---|---|---|
| Lord | Dual Strike+ | Charm | (Chrom/Lucina only) |
| Tactician | Veteran | Solidarity | |
| Cavalier | Discipline | Outdoor Fighter | |
| Knight | Defence +2 | Indoor Fighter | |
| Myrmidon | Avoid +10 | Vantage | |
| Mercenary | Armsthrift | Patience | |
| Fighter | HP +5 | Zeal | Male |
| Barbarian | Despoil | Gamble | Male |
| Archer | Skill +2 | Prescience | |
| Thief | Locktouch | Movement +1 | |
| Pegasus Knight | Speed +2 | Relief | Female |
| Wyvern Rider | Strength +2 | Tantivy | |
| Mage | Magic +2 | Focus | |
| Dark Mage | Hex | Anathema | |
| Priest / Cleric | Miracle | Healtouch | Priest male / Cleric female |
| Troubadour | Resistance +2 | Demoiselle | Female |

### Promoted classes

| Class | Lv 5 | Lv 15 | Gender |
|---|---|---|---|
| Great Lord | Aether | Rightful King | (Chrom/Lucina only) |
| Grandmaster | Ignis | Rally Spectrum | |
| Paladin | Defender | Aegis | |
| Great Knight | Luna | Dual Guard+ | |
| General | Rally Defence | Pavise | |
| Swordmaster | Astra | Swordfaire | |
| Hero | Sol | Axebreaker | |
| Warrior | Rally Strength | Counter | Male |
| Berserker | Wrath | Axefaire | Male |
| Sniper | Hit Rate +20 | Bowfaire | |
| Bow Knight | Rally Skill | Bowbreaker | |
| Assassin | Lethality | Pass | |
| Trickster | Lucky Seven | Acrobat | |
| Falcon Knight | Rally Speed | Lancefaire | Female |
| Dark Flier | Rally Movement | Galeforce | Female (base game, not DLC) |
| Wyvern Lord | Quick Burn | Swordbreaker | |
| Griffon Rider | Deliverer | Lancebreaker | |
| Sage | Rally Magic | Tomefaire | |
| Sorcerer | Vengeance | Tomebreaker | |
| Dark Knight | Slow Burn | Lifetaker | |
| War Monk / War Cleric | Rally Luck | Renewal | War Monk male / War Cleric female |
| Valkyrie | Rally Resistance | Dual Support+ | Female |

### Special classes

| Class | Lv 1 | Lv 15 | Notes |
|---|---|---|---|
| Villager | Aptitude | Underdog | Donnel's line. Can be inherited by sons [SF-children]. |
| Dancer | Luck +4 | Special Dance | Olivia. The class is never inherited. Special Dance is never inherited. |
| Taguel | Even Rhythm | Beastbane | Panne/Yarne. Also Morgan [SF-children]. |
| Manakete | Odd Rhythm | Wyrmsbane | Nowi/Nah/Tiki. Also Morgan [SF-children]. |
| Conqueror | none | none | Walhart's personal class. No Awakening class skills are listed in [FEW-list], [SF-skills] or [FEW-class]. Walhart's Conquest is a personal skill. |
| Lodestar | none | none | Bonus/DLC Marth's personal class. No Awakening class skills are listed in [FEW-list], [SF-skills] or [FEW-class] (the Lodestar page lists skills for *Fates* only). |
| **Dread Fighter** (DLC) | Resistance +10 | Aggressor | Male only. Reached with the Dread Scroll (reward from Lost Bloodlines 2) [FEW-dlc], [FEW-class]. Can't be inherited. |
| **Bride** (DLC) | Rally Heart | Bond | Female only. Reached with the Wedding Bouquet (reward from Smash Brethren 2) [FEW-dlc], [FEW-class]. Can't be inherited. |

According to [FEW-dlc], Dread Fighter and Bride are the only reclassable DLC classes.

### Skills not learned from any class

| Skill | How it's obtained | Inheritable |
|---|---|---|
| Shadowgift | Personal skill (Aversa) | Only by Morgan [FEW-inh] |
| Conquest | Personal skill (Walhart) | Only by Morgan [FEW-inh] |
| All Stats +2, Paragon, Iote's Shield, Limit Breaker | DLC skill books [FEW-dlc] | No |

## UNVERIFIED

Neither source gives an explicit, cited rule for these cases:

1. **The chosen skill is one the child already has.** Examples: Nowi's last skill is Odd Rhythm, which Nah already has at start; a mother passes Charm to Lucina.
   - H1: that inheritance slot is simply wasted, and the child gets nothing new from that parent.
   - H2: "eligible" excludes duplicates, so the game moves up to the parent's next equipped skill.

   FEW-char's wording ("lowest *eligible* skill") fits either reading. Neither source defines "eligible" beyond DLC and Special Dance.
2. **Both parents' chosen skills are the same.** H1: the child gets one copy and loses the second slot. H2: the second parent's choice moves up to its next skill.
3. **Ineligible bottom skill.** Does a DLC skill (or Special Dance) in the bottom equipped slot really make the game fall back to the next skill up, as FEW-char implies? The other possibility is that nothing is inherited from that parent. FEW-char says "lowest eligible", but no test is cited; Serenes Forest says only "last active Skill".
4. **Equipped-list order.** No primary source states that a newly equipped skill is appended to the bottom of the list. That matters because "last" might mean "most recently equipped" (FEW-inh's "most recently activated") or "bottom-most slot" (FEW-char). The two readings are assumed to be the same thing, but that isn't confirmed.
5. **Conqueror and Lodestar class skills.** "None" is inferred from both skill tables leaving them out, not from an explicit statement.
