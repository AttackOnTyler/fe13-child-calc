# Marriage graph and child class-pool inheritance (FE Awakening)

Research for issue #3 (part of #1). Retrieved 2026-09-22.

## Sources

| Key | URL | Used for |
|---|---|---|
| SF-CHILD | https://serenesforest.net/awakening/characters/children/ | Fixed parent per child, class-inheritance rule, gender-replacement table, special cases, DLC rule, 2nd-gen marriage rule |
| SF-SETS | https://serenesforest.net/awakening/characters/class-sets/ | Every unit's class set; regular vs special class lists |
| SF-CHILD-X | https://serenesforest.net/awakening/characters/children/{lucina,owain,inigo,brady,kjelle,cynthia,severa,gerome,morgan-f,morgan-m,yarne,laurent,noire,nah}/ | Per-child class set for every possible variable parent (the tables at the end of this doc) |
| SF-SUP | https://serenesforest.net/awakening/characters/supports/ | Support/marriage list (cross-check) |
| FEW-SUP | https://fireemblemwiki.org/wiki/List_of_supports_in_Fire_Emblem_Awakening | Complete romantic (S-rank) support list |
| FEW-INH | https://fireemblemwiki.org/wiki/Inheritance | Inheritance rules (Awakening section), replacement table, Morgan base class |
| FEW-MOR | https://fireemblemwiki.org/wiki/Morgan | Morgan's base class and Manakete/Taguel access |
| FEW-LUC | https://fireemblemwiki.org/wiki/Lucina/Stats | Evidence that Tactician is inherited from Robin by non-Morgan children |
| FEW-RC | https://fireemblemwiki.org/wiki/Reclass | Children's default class sets |

The two sites agree on every point checked. Where they differ it is only in wording or in how much detail they give.

---

## 1. Who can marry whom (S-support)

Source: FEW-SUP ("Romantic supports" section), cross-checked against SF-SUP. Each character can have only one S-support per playthrough (FEW-SUP).

### Robin
- **Robin (M)** can marry: Lissa, Sully, Miriel, Sumia, Maribelle, Panne, Cordelia, Nowi, Tharja, Olivia, Cherche, Lucina, Say'ri, Flavia, Anna, Kjelle, Cynthia, Severa, Noire, Nah, Tiki, Emmeryn, Aversa. (23)
- **Robin (F)** can marry: Chrom, Frederick, Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gaius, Gregor, Libra, Henry, Basilio, Donnel, Owain, Inigo, Brady, Gerome, Yarne, Laurent, Gangrel, Walhart, Yen'fay, Priam. (24)
- Robin can never marry Morgan (Morgan is Robin's child). SF-SUP puts it as "Every character (marriage only possible if the opposite gender)".

### Chrom
- **Chrom** can marry: Robin (F), Sully, Sumia, Maribelle, Olivia. He cannot marry Lissa (his sister).
- If Chrom has no S-support by the end of Chapter 11, he automatically marries the partner he has the highest support with. If no one qualifies, he marries an unnamed village **Maiden** (FEW-INH). Lucina's SF page lists "Maiden" as a mother row that adds no classes (SF-CHILD-X/lucina).

### First generation, general case
Every male in {Frederick, Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gaius, Gregor, Libra, Henry, Donnel} can marry:
- Robin (F), and
- every female in {Lissa, Sully, Miriel, Maribelle, Panne, Cordelia, Nowi, Tharja, Olivia, Cherche}.

The exceptions:
- **Sumia** can marry only Robin (M), Chrom, Frederick, Gaius or Henry.
- **Chrom**'s female options are listed above.
- The women who can marry Chrom (Sully, Maribelle, Olivia) can marry Chrom *in addition to* the 12 males. Lissa, Miriel, Panne, Cordelia, Nowi, Tharja and Cherche cannot marry Chrom.

Full per-female lists from FEW-SUP:
- Lissa: Robin (M), Frederick, Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gaius, Gregor, Libra, Henry, Donnel
- Sully / Maribelle / Olivia: Robin (M), Chrom, Frederick, Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gaius, Gregor, Libra, Henry, Donnel
- Miriel / Panne / Cordelia / Nowi / Tharja / Cherche: Robin (M), Frederick, Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gaius, Gregor, Libra, Henry, Donnel
- Sumia: Robin (M), Chrom, Frederick, Gaius, Henry

Male lists as given, for cross-checking: Frederick, Gaius and Henry include Sumia. Virion, Vaike, Stahl, Kellam, Lon'qu, Ricken, Gregor, Libra and Donnel do not.

### Robin-only characters
These characters can S-support **only Robin**: Say'ri, Flavia, Anna, Tiki, Emmeryn, Aversa (with Robin M), and Basilio, Gangrel, Walhart, Yen'fay, Priam (with Robin F). FEW-SUP lists only Robin in their romantic row.

### Second generation
- **Sons** (Owain, Inigo, Brady, Gerome, Yarne, Laurent) can marry: Robin (F), Lucina, Kjelle, Cynthia, Severa, Morgan (F), Noire, Nah.
- **Daughters** (Lucina, Kjelle, Cynthia, Severa, Noire, Nah) can marry: Robin (M), Owain, Inigo, Brady, Gerome, Morgan (M), Yarne, Laurent.
- **Morgan (M)** can marry Lucina, Kjelle, Cynthia, Severa, Noire or Nah. **Morgan (F)** can marry Owain, Inigo, Brady, Gerome, Yarne or Laurent. Neither Morgan can marry Robin.
- The two Morgans can never both exist, since they need opposite-gender Robins. SF-SUP notes "Except Morgan (M) x Morgan (F)".
- Siblings cannot S-support each other (FEW-SUP intro text).

---

## 2. Which child comes from which pairing

Source: SF-CHILD table, FEW-INH.

| Fixed parent | Child |
|---|---|
| Chrom | Lucina (F) |
| Robin (M) | Morgan (F) |
| Robin (F) | Morgan (M) |
| Lissa | Owain (M) |
| Olivia | Inigo (M) |
| Maribelle | Brady (M) |
| Sully | Kjelle (F) |
| Sumia | Cynthia (F) |
| Cordelia | Severa (F) |
| Cherche | Gerome (M) |
| Panne | Yarne (M) |
| Miriel | Laurent (M) |
| Tharja | Noire (F) |
| Nowi | Nah (F) |

- Each child is tied to one **fixed parent**. The spouse is the **variable parent**, who shapes the child's classes, stats and skills. Most children are tied to their mother. Lucina and Morgan (F) are tied to their father (FEW-INH).
- **Lucina** is always Chrom's. If Chrom marries a mother with her own child, both children exist: Sumia gives Lucina + Cynthia, Sully gives Lucina + Kjelle, Maribelle gives Lucina + Brady, Olivia gives Lucina + Inigo. Robin (F) gives Lucina + Morgan (M). The Maiden gives Lucina only (SF-CHILD, FEW-INH).
- **Morgan** is always Robin's, and is the opposite gender to Robin (SF-CHILD). Robin (M) marrying a mother with her own child gives two children: Morgan (F) plus the mother's child.
- **No children of their own:** Anna, Say'ri, Tiki, Flavia, Emmeryn and Aversa. Married to Robin, they give Morgan only (SF-CHILD). The same holds for Basilio, Gangrel, Walhart, Yen'fay and Priam, whose only option is Robin (F) and who have no fixed child (derived from SF-CHILD's table plus FEW-SUP).
- All first-generation males other than Chrom and Robin (M) are purely variable parents with no fixed child.

### Can second-generation units be parents? Yes, but only through Robin, producing Morgan. (VERIFIED)
- SF-CHILD: "Children characters can marry each other, but won't produce offspring. However, they may marry your Avatar and produce Morgan."
- When Morgan's other parent is a child unit, Morgan does **not** get the usual +1 to maximum-stat modifiers (SF-CHILD, FEW-INH).
- In that case the second-generation parent passes *their own inherited* classes and skills on. SF-CHILD-X/morgan-m lists "Donnel or Donnel's son" giving Villager and "Owain or Brady" giving Troubadour-line skills. SF-CHILD-X/morgan-f lists "Vaike's daughter", "Lucina's sister" and similar rows.

---

## 3. Class-pool inheritance rule

### 3.1 Class sets
- The **regular classes** are Lord (Chrom only), Tactician, Cavalier, Knight, Myrmidon, Mercenary, Fighter (male only), Barbarian (male only), Archer, Thief, Pegasus Knight (female only), Wyvern Rider, Mage, Dark Mage, Priest (M) / Cleric (F), and Troubadour (female only) (SF-SETS).
- The **special classes** are Villager, Dancer, Taguel, Manakete, Lodestar, Conqueror, Dread Fighter and Bride (SF-SETS).
- A class set covers a base class. It also covers that class's promotions once the unit is at level 10 or higher in a promoted class (SF-SETS notes).
- **Robin** gets Tactician plus every regular class for Robin's gender (SF-SETS).
- Other first-generation units have three base classes each. SF-SETS lists them all; they are reproduced in Appendix A.

### 3.2 Rule for a child (non-Morgan)
SF-CHILD / SF-SETS: "children inherit all the regular class options from both their parents … except classes exclusive to the opposite gender. If a class option cannot be inherited due to gender issues, that option will be replaced with another option more appropriate for their gender."

In practice, as the SF-CHILD-X tables show:

```
childClasses = childDefaultSet                          // fixed per child, already gender-adjusted from the fixed parent (FEW-RC, SF-SETS)
             ∪ adapt(variableParent.classSet, child.gender)
adapt(set, g) = for each class c in set:
    if c ∈ {Lord, Conqueror, Dancer, Taguel, Manakete, DLC classes} → drop   (Taguel/Manakete: Morgan-only exception, see 3.4)
    if c == Villager: son → keep; daughter → replaced per table
    if c is gender-locked against g → replace with the per-parent substitute (table 3.3)
    if c == Priest and g == F → Cleric;  if c == Cleric and g == M → Priest
    else keep
    (duplicates collapse; no compensation for duplicates)
```

- The **child default sets** are fixed per child (SF-SETS, FEW-RC):
  - Lucina: Lord, Cavalier, Archer
  - Owain: Myrmidon, Priest, Barbarian
  - Inigo: Mercenary, Myrmidon, Barbarian
  - Brady: Priest, Cavalier, Mage
  - Kjelle: Knight, Cavalier, Myrmidon, Wyvern Rider. She has four classes; Knight is extra, since Sully has no Knight.
  - Cynthia: Pegasus Knight, Knight, Cleric
  - Severa: Mercenary, Pegasus Knight, Dark Mage
  - Gerome: Wyvern Rider, Fighter, Priest
  - Yarne: Taguel, Thief, Barbarian
  - Laurent: Mage, Barbarian, Dark Mage
  - Noire: Archer, Knight, Dark Mage
  - Nah: Manakete, Wyvern Rider, Mage
  - Morgan: every regular class for Morgan's gender
- **Duplicates:** when a substitute or an inherited class is already in the set, it is simply a duplicate. SF-CHILD-X shows it as "-" and "Repeated classes … are highlighted in grey". Nothing replaces it. For example, Inigo with father Gregor gains no classes at all.
- **Robin as the variable parent:** the child gets every regular class for the child's own gender, including Tactician. The child also keeps its default set, which matters for Lucina (Lord), Yarne (Taguel) and Nah (Manakete) (SF-CHILD-X rows "Avatar (M/F): All regular male/female classes"). Tactician is included: FEW-LUC gives Lucina a Tactician/Grandmaster reclass growth table, and she can only reach that class through a Robin (F) mother. SF-SETS also lists Tactician as a regular class and marks only Lord as "cannot be inherited".

### 3.3 Gender-substitution table (per parent, not per class)
Sources: SF-CHILD table, FEW-INH table, and every SF-CHILD-X page. All three agree.

**Mothers → sons.** Every son except Morgan (M) has a *fixed* mother. Morgan (M)'s mother is Robin (F), and he gets all regular male classes from her. So this table only explains how each son's fixed **default set** was built from his mother's set; a calculator can hard-code those default sets.

| Mother | Original | Son gets |
|---|---|---|
| Lissa | Pegasus Knight, Troubadour (+ Cleric) | Myrmidon, Barbarian (+ Priest) → Owain |
| Miriel | Troubadour | Barbarian → Laurent |
| Maribelle | Pegasus Knight, Troubadour | Cavalier, Priest → Brady |
| Olivia | Dancer, Pegasus Knight | Mercenary, Barbarian → Inigo |
| Panne | Wyvern Rider* | Barbarian → Yarne |
| Cherche | Troubadour, Cleric | Fighter, Priest → Gerome |

\* Wyvern Rider is not gender-locked. Yarne gets Barbarian in its place anyway, and SF-CHILD footnotes this: "Even though Wyvern Rider isn't gender-exclusive".

**Fathers → daughters**

| Father | Original | Daughter gets |
|---|---|---|
| Vaike | Fighter, Barbarian | Knight, Mercenary |
| Gaius | Fighter | Pegasus Knight |
| Donnel | Villager, Fighter | Pegasus Knight, Troubadour |
| Gregor | Barbarian | Troubadour |
| Henry | Barbarian | Troubadour |
| Kellam, Libra | Priest | Cleric (a straight swap; shown in the SF-CHILD-X rows, e.g. Kjelle/Kellam gets Thief, Cleric) |

- Fathers with no gender-locked classes pass their set unchanged: Frederick, Virion, Stahl, Lon'qu, Ricken.
- Chrom passes Cavalier and Archer. His Lord goes only to Lucina (FEW-INH: "Only Lucina can inherit Lord from Chrom").
- When the child is a son (Owain, Inigo, Brady, Gerome, Yarne, Laurent), male fathers' classes pass unchanged. That includes Fighter, Barbarian and Priest, and Villager from Donnel.
- **Daughter with a variable mother** is only Lucina's case. Lucina gets her mother's female classes unchanged (Pegasus Knight, Troubadour, Cleric and so on), minus Dancer: Olivia gives Lucina only Myrmidon and Pegasus Knight (SF-CHILD-X/lucina; FEW-INH footnote "Dancer will not be passed down to female children, either").

### 3.4 Exceptions
| Class | Inheritable? | Source |
|---|---|---|
| Lord | Only Chrom → Lucina (it is in her default set). Chrom's other children get Cavalier and Archer. | FEW-INH; SF-SETS "Lord (cannot be inherited)" |
| Great Lord | Promotion of Lord, so only Lucina has it. | SF-SETS promotion note |
| Tactician | Yes, from Robin to any child of Robin, gender-neutral. Morgan always has it. | SF-SETS regular list; FEW-LUC |
| Villager | Yes, to sons only (Donnel → son; also Donnel's son → Morgan (M)). Daughters get the substitute instead. | SF-CHILD; SF-CHILD-X/morgan-m |
| Dancer | Never, to sons or daughters. Special Dance (the skill) is also never inherited; Olivia's other Dancer skill, Luck +4, can be. | FEW-INH; SF-CHILD |
| Manakete | Only to Morgan (F), from Nowi, Tiki or Nah. Nah has it in her default set. | SF-CHILD; FEW-MOR |
| Taguel | Only to Morgan: (F) from Panne, (M) from Yarne. Yarne has it in his default set. | SF-CHILD; FEW-MOR |
| Conqueror | Never. Walhart × Robin (F) gives Morgan (M) starting as a Tactician, who always inherits the Conquest skill. | FEW-INH; SF-CHILD-X/morgan-m |
| DLC classes (Lodestar, Dread Fighter, Bride, and any other DLC-granted class) | Never. Skills from DLC, including those learned in DLC classes, are also never inherited. | SF-CHILD ("Classes and Skills obtained from DLC … can not be inherited"); FEW-INH |

### 3.5 Morgan
- **Class set:** every regular class for Morgan's gender, including Tactician (SF-SETS, FEW-MOR). Special classes come from the other parent:
  - Morgan (F) gets Taguel from Panne, or Manakete from Nowi, Tiki or Nah.
  - Morgan (M) gets Villager from Donnel or Donnel's son, or Taguel from Yarne.
  - No other parent adds a class (SF-CHILD-X/morgan-f, morgan-m).
- **Starting class:** the other parent's default base class. That is the father for Morgan (M) and the mother for Morgan (F).
  - If that class is Lord, Dancer or Conqueror, Morgan starts as a Tactician instead (SF-CHILD). FEW-INH and FEW-MOR state it as the partner being Chrom, Lucina, Olivia or Walhart.
  - A second-generation parent's "default base class" is their own starting class. For example, Owain gives Myrmidon. This is inferred from FEW-INH ("original base class of his father/her mother").

---

## 4. UNVERIFIED / open points

1. **Starting class when Morgan's other parent is a second-generation unit whose starting class is gender-locked or special.** For example, Nah gives Manakete for Morgan (F), which fits the Manakete rule, and Gerome gives Wyvern Rider. No source walks through each second-generation case.
   - *Hypothesis A* (favoured): it is the partner's own default class, as FEW-INH states in general terms.
   - *Hypothesis B:* some other default applies.
   - This does not affect the class *pool*, only the join class.
2. **How Robin's extra classes interact with the fixed parent's set.** Both sources say the child gets "all regular classes (by gender)" from Robin. Whether any of the fixed parent's *special* classes survive beyond Taguel (Yarne), Manakete (Nah) and Lord (Lucina) is moot: no other child has a special class in its default set.
3. The **Kjelle–Frederick** row on SF shows that Frederick adds nothing, because all three of his classes are already in Kjelle's four-class default set. This is consistent with the duplicate rule rather than a special case.

Nothing else in this document is unverified. Every rule above is stated directly by at least one source, and most by both.

---

## Appendix A: first-generation class sets (SF-SETS)

| Unit | Classes |
|---|---|
| Robin | Tactician + every regular class of Robin's gender |
| Chrom | Lord, Cavalier, Archer |
| Lissa | Cleric, Pegasus Knight, Troubadour |
| Frederick | Cavalier, Knight, Wyvern Rider |
| Sully | Cavalier, Myrmidon, Wyvern Rider |
| Virion | Archer, Wyvern Rider, Mage |
| Stahl | Cavalier, Archer, Myrmidon |
| Vaike | Fighter, Thief, Barbarian |
| Miriel | Mage, Troubadour, Dark Mage |
| Sumia | Pegasus Knight, Knight, Cleric |
| Kellam | Knight, Thief, Priest |
| Donnel | Villager, Fighter, Mercenary |
| Lon'qu | Myrmidon, Thief, Wyvern Rider |
| Ricken | Mage, Cavalier, Archer |
| Maribelle | Troubadour, Pegasus Knight, Mage |
| Panne | Taguel, Thief, Wyvern Rider |
| Gaius | Thief, Fighter, Myrmidon |
| Cordelia | Pegasus Knight, Mercenary, Dark Mage |
| Gregor | Mercenary, Barbarian, Myrmidon |
| Nowi | Manakete, Mage, Wyvern Rider |
| Libra | Priest, Mage, Dark Mage |
| Tharja | Dark Mage, Knight, Archer |
| Anna | Thief, Archer, Mage |
| Olivia | Dancer, Myrmidon, Pegasus Knight |
| Cherche | Wyvern Rider, Troubadour, Cleric |
| Henry | Dark Mage, Barbarian, Thief |
| Say'ri | Myrmidon, Pegasus Knight, Wyvern Rider |
| Tiki | Manakete, Wyvern Rider, Mage |
| Basilio | Fighter, Barbarian, Knight |
| Flavia | Mercenary, Thief, Knight |
| Gangrel | Thief, Barbarian, Dark Mage |
| Walhart | Conqueror, Knight, Wyvern Rider |
| Emmeryn | Cleric, Pegasus Knight, Troubadour |
| Yen'fay | Myrmidon, Wyvern Rider, Archer |
| Aversa | Pegasus Knight, Wyvern Rider, Dark Mage |
| Priam | Mercenary, Myrmidon, Fighter |

## Appendix B: every child's full base-class set per possible variable parent

Transcribed from SF-CHILD-X, one page per child. "Classes added" means the classes beyond the child's default set, with gender substitution applied and duplicates removed. Only base classes are shown; promotions follow from them. "All regular X classes" means Tactician plus every regular class of that gender.

### Morgan (F), father Robin (M)
- Base: all regular female classes, including Tactician.
- Mother adds Taguel (Panne) or Manakete (Nowi, Tiki, Nah). Every other mother adds nothing, including Lucina, Lucina's sister, Olivia, Aversa, and the other daughters.

### Morgan (M), mother Robin (F)
- Base: all regular male classes, including Tactician.
- Father adds Villager (Donnel, or Donnel's son) or Taguel (Yarne). Every other father adds nothing, including Chrom, Chrom's son and Walhart.

#### Brady

Fixed parent: **Maribelle** (mother). Base set: Priest, Cavalier, Mage. (Maribelle's Pegasus Knight, Troubadour class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) |
| Chrom | Archer | Priest, Cavalier, Mage, Archer |
| Frederick | Knight, Wyvern Rider | Priest, Cavalier, Mage, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider | Priest, Cavalier, Mage, Archer, Wyvern Rider |
| Stahl | Myrmidon, Archer | Priest, Cavalier, Mage, Myrmidon, Archer |
| Vaike | Fighter, Barbarian, Thief | Priest, Cavalier, Mage, Fighter, Barbarian, Thief |
| Kellam | Knight, Thief | Priest, Cavalier, Mage, Knight, Thief |
| Lon'qu | Myrmidon, Thief, Wyvern Rider | Priest, Cavalier, Mage, Myrmidon, Thief, Wyvern Rider |
| Ricken | Archer | Priest, Cavalier, Mage, Archer |
| Gaius | Myrmidon, Fighter, Thief | Priest, Cavalier, Mage, Myrmidon, Fighter, Thief |
| Donnel | Mercenary, Fighter, Villager | Priest, Cavalier, Mage, Mercenary, Fighter, Villager |
| Gregor | Myrmidon, Mercenary, Barbarian | Priest, Cavalier, Mage, Myrmidon, Mercenary, Barbarian |
| Libra | Dark Mage | Priest, Cavalier, Mage, Dark Mage |
| Henry | Barbarian, Thief, Dark Mage | Priest, Cavalier, Mage, Barbarian, Thief, Dark Mage |

#### Cynthia

Fixed parent: **Sumia** (mother). Base set: Pegasus Knight, Knight, Cleric.

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular female classes | All regular female classes (incl. Tactician) |
| Chrom | Cavalier, Archer | Pegasus Knight, Knight, Cleric, Cavalier, Archer |
| Frederick | Cavalier, Wyvern Rider | Pegasus Knight, Knight, Cleric, Cavalier, Wyvern Rider |
| Gaius | Myrmidon, Thief | Pegasus Knight, Knight, Cleric, Myrmidon, Thief |
| Henry | Thief, Troubadour, Dark Mage | Pegasus Knight, Knight, Cleric, Thief, Troubadour, Dark Mage |

#### Gerome

Fixed parent: **Cherche** (mother). Base set: Wyvern Rider, Fighter, Priest. (Cherche's Troubadour class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) |
| Frederick | Cavalier, Knight | Wyvern Rider, Fighter, Priest, Cavalier, Knight |
| Virion | Archer, Mage | Wyvern Rider, Fighter, Priest, Archer, Mage |
| Stahl | Cavalier, Myrmidon, Archer | Wyvern Rider, Fighter, Priest, Cavalier, Myrmidon, Archer |
| Vaike | Barbarian, Thief | Wyvern Rider, Fighter, Priest, Barbarian, Thief |
| Kellam | Knight, Thief | Wyvern Rider, Fighter, Priest, Knight, Thief |
| Lon'qu | Myrmidon, Thief | Wyvern Rider, Fighter, Priest, Myrmidon, Thief |
| Ricken | Cavalier, Archer, Mage | Wyvern Rider, Fighter, Priest, Cavalier, Archer, Mage |
| Gaius | Myrmidon, Thief | Wyvern Rider, Fighter, Priest, Myrmidon, Thief |
| Donnel | Mercenary, Villager | Wyvern Rider, Fighter, Priest, Mercenary, Villager |
| Gregor | Myrmidon, Mercenary, Barbarian | Wyvern Rider, Fighter, Priest, Myrmidon, Mercenary, Barbarian |
| Libra | Mage, Dark Mage | Wyvern Rider, Fighter, Priest, Mage, Dark Mage |
| Henry | Barbarian, Thief, Dark Mage | Wyvern Rider, Fighter, Priest, Barbarian, Thief, Dark Mage |

#### Inigo

Fixed parent: **Olivia** (mother). Base set: Mercenary, Myrmidon, Barbarian. (Olivia's Dancer, Pegasus Knight class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) |
| Chrom | Cavalier, Archer | Mercenary, Myrmidon, Barbarian, Cavalier, Archer |
| Frederick | Cavalier, Knight, Wyvern Rider | Mercenary, Myrmidon, Barbarian, Cavalier, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider, Mage | Mercenary, Myrmidon, Barbarian, Archer, Wyvern Rider, Mage |
| Stahl | Cavalier, Archer | Mercenary, Myrmidon, Barbarian, Cavalier, Archer |
| Vaike | Fighter, Thief | Mercenary, Myrmidon, Barbarian, Fighter, Thief |
| Kellam | Knight, Thief, Priest | Mercenary, Myrmidon, Barbarian, Knight, Thief, Priest |
| Lon'qu | Thief, Wyvern Rider | Mercenary, Myrmidon, Barbarian, Thief, Wyvern Rider |
| Ricken | Cavalier, Archer, Mage | Mercenary, Myrmidon, Barbarian, Cavalier, Archer, Mage |
| Gaius | Fighter, Thief | Mercenary, Myrmidon, Barbarian, Fighter, Thief |
| Donnel | Villager | Mercenary, Myrmidon, Barbarian, Villager |
| Gregor | (none new) | Mercenary, Myrmidon, Barbarian |
| Libra | Priest, Mage, Dark Mage | Mercenary, Myrmidon, Barbarian, Priest, Mage, Dark Mage |
| Henry | Thief, Dark Mage | Mercenary, Myrmidon, Barbarian, Thief, Dark Mage |

#### Kjelle

Fixed parent: **Sully** (mother). Base set: Knight, Cavalier, Myrmidon, Wyvern Rider.

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular female classes | All regular female classes (incl. Tactician) |
| Chrom | Archer | Knight, Cavalier, Myrmidon, Wyvern Rider, Archer |
| Frederick | (none new) | Knight, Cavalier, Myrmidon, Wyvern Rider |
| Virion | Archer, Mage | Knight, Cavalier, Myrmidon, Wyvern Rider, Archer, Mage |
| Stahl | Archer | Knight, Cavalier, Myrmidon, Wyvern Rider, Archer |
| Vaike | Mercenary, Thief | Knight, Cavalier, Myrmidon, Wyvern Rider, Mercenary, Thief |
| Kellam | Thief, Cleric | Knight, Cavalier, Myrmidon, Wyvern Rider, Thief, Cleric |
| Lon'qu | Thief | Knight, Cavalier, Myrmidon, Wyvern Rider, Thief |
| Ricken | Archer, Mage | Knight, Cavalier, Myrmidon, Wyvern Rider, Archer, Mage |
| Gaius | Thief, Pegasus Knight | Knight, Cavalier, Myrmidon, Wyvern Rider, Thief, Pegasus Knight |
| Donnel | Mercenary, Pegasus Knight, Troubadour | Knight, Cavalier, Myrmidon, Wyvern Rider, Mercenary, Pegasus Knight, Troubadour |
| Gregor | Mercenary, Troubadour | Knight, Cavalier, Myrmidon, Wyvern Rider, Mercenary, Troubadour |
| Libra | Cleric, Mage, Dark Mage | Knight, Cavalier, Myrmidon, Wyvern Rider, Cleric, Mage, Dark Mage |
| Henry | Thief, Troubadour, Dark Mage | Knight, Cavalier, Myrmidon, Wyvern Rider, Thief, Troubadour, Dark Mage |

#### Laurent

Fixed parent: **Miriel** (mother). Base set: Mage, Barbarian, Dark Mage. (Miriel's Troubadour class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) |
| Frederick | Cavalier, Knight, Wyvern Rider | Mage, Barbarian, Dark Mage, Cavalier, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider | Mage, Barbarian, Dark Mage, Archer, Wyvern Rider |
| Stahl | Cavalier, Myrmidon, Archer | Mage, Barbarian, Dark Mage, Cavalier, Myrmidon, Archer |
| Vaike | Fighter, Thief | Mage, Barbarian, Dark Mage, Fighter, Thief |
| Kellam | Knight, Thief, Priest | Mage, Barbarian, Dark Mage, Knight, Thief, Priest |
| Lon'qu | Myrmidon, Thief, Wyvern Rider | Mage, Barbarian, Dark Mage, Myrmidon, Thief, Wyvern Rider |
| Ricken | Cavalier, Archer | Mage, Barbarian, Dark Mage, Cavalier, Archer |
| Gaius | Myrmidon, Fighter, Thief | Mage, Barbarian, Dark Mage, Myrmidon, Fighter, Thief |
| Donnel | Mercenary, Fighter, Villager | Mage, Barbarian, Dark Mage, Mercenary, Fighter, Villager |
| Gregor | Myrmidon, Mercenary | Mage, Barbarian, Dark Mage, Myrmidon, Mercenary |
| Libra | Priest | Mage, Barbarian, Dark Mage, Priest |
| Henry | Thief | Mage, Barbarian, Dark Mage, Thief |

#### Lucina

Fixed parent: **Chrom** (father). Base set: Lord, Cavalier, Archer. (Always inherits Aether from Chrom.)

| Mother | Classes added | Full class set |
|---|---|---|
| Avatar (F) | All regular female classes | All regular female classes (incl. Tactician) + Lord |
| Sumia | Pegasus Knight, Knight, Cleric | Lord, Cavalier, Archer, Pegasus Knight, Knight, Cleric |
| Maribelle | Troubadour, Pegasus Knight, Mage | Lord, Cavalier, Archer, Troubadour, Pegasus Knight, Mage |
| Sully | Myrmidon, Wyvern Rider | Lord, Cavalier, Archer, Myrmidon, Wyvern Rider |
| Olivia | Myrmidon, Pegasus Knight | Lord, Cavalier, Archer, Myrmidon, Pegasus Knight |
| Maiden | (none new) | Lord, Cavalier, Archer |

#### Nah

Fixed parent: **Nowi** (mother). Base set: Manakete, Wyvern Rider, Mage.

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular female classes | All regular female classes (incl. Tactician) + Manakete |
| Frederick | Cavalier, Knight | Manakete, Wyvern Rider, Mage, Cavalier, Knight |
| Virion | Archer | Manakete, Wyvern Rider, Mage, Archer |
| Stahl | Cavalier, Myrmidon, Archer | Manakete, Wyvern Rider, Mage, Cavalier, Myrmidon, Archer |
| Vaike | Knight, Mercenary, Thief | Manakete, Wyvern Rider, Mage, Knight, Mercenary, Thief |
| Kellam | Knight, Thief, Cleric | Manakete, Wyvern Rider, Mage, Knight, Thief, Cleric |
| Lon'qu | Myrmidon, Thief | Manakete, Wyvern Rider, Mage, Myrmidon, Thief |
| Ricken | Cavalier, Archer | Manakete, Wyvern Rider, Mage, Cavalier, Archer |
| Gaius | Myrmidon, Thief, Pegasus Knight | Manakete, Wyvern Rider, Mage, Myrmidon, Thief, Pegasus Knight |
| Donnel | Mercenary, Pegasus Knight, Troubadour | Manakete, Wyvern Rider, Mage, Mercenary, Pegasus Knight, Troubadour |
| Gregor | Myrmidon, Mercenary, Troubadour | Manakete, Wyvern Rider, Mage, Myrmidon, Mercenary, Troubadour |
| Libra | Cleric, Dark Mage | Manakete, Wyvern Rider, Mage, Cleric, Dark Mage |
| Henry | Thief, Troubadour, Dark Mage | Manakete, Wyvern Rider, Mage, Thief, Troubadour, Dark Mage |

#### Noire

Fixed parent: **Tharja** (mother). Base set: Archer, Knight, Dark Mage.

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular female classes | All regular female classes (incl. Tactician) |
| Frederick | Cavalier, Wyvern Rider | Archer, Knight, Dark Mage, Cavalier, Wyvern Rider |
| Virion | Wyvern Rider, Mage | Archer, Knight, Dark Mage, Wyvern Rider, Mage |
| Stahl | Cavalier, Myrmidon | Archer, Knight, Dark Mage, Cavalier, Myrmidon |
| Vaike | Mercenary, Thief | Archer, Knight, Dark Mage, Mercenary, Thief |
| Kellam | Thief, Cleric | Archer, Knight, Dark Mage, Thief, Cleric |
| Lon'qu | Myrmidon, Thief, Wyvern Rider | Archer, Knight, Dark Mage, Myrmidon, Thief, Wyvern Rider |
| Ricken | Cavalier, Mage | Archer, Knight, Dark Mage, Cavalier, Mage |
| Gaius | Myrmidon, Thief, Pegasus Knight | Archer, Knight, Dark Mage, Myrmidon, Thief, Pegasus Knight |
| Donnel | Mercenary, Pegasus Knight, Troubadour | Archer, Knight, Dark Mage, Mercenary, Pegasus Knight, Troubadour |
| Gregor | Myrmidon, Mercenary, Troubadour | Archer, Knight, Dark Mage, Myrmidon, Mercenary, Troubadour |
| Libra | Cleric, Mage | Archer, Knight, Dark Mage, Cleric, Mage |
| Henry | Thief, Troubadour | Archer, Knight, Dark Mage, Thief, Troubadour |

#### Owain

Fixed parent: **Lissa** (mother). Base set: Myrmidon, Priest, Barbarian. (Lissa's Pegasus Knight, Troubadour class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) |
| Frederick | Cavalier, Knight, Wyvern Rider | Myrmidon, Priest, Barbarian, Cavalier, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider, Mage | Myrmidon, Priest, Barbarian, Archer, Wyvern Rider, Mage |
| Stahl | Cavalier, Archer | Myrmidon, Priest, Barbarian, Cavalier, Archer |
| Vaike | Fighter, Thief | Myrmidon, Priest, Barbarian, Fighter, Thief |
| Kellam | Knight, Thief | Myrmidon, Priest, Barbarian, Knight, Thief |
| Lon'qu | Thief, Wyvern Rider | Myrmidon, Priest, Barbarian, Thief, Wyvern Rider |
| Ricken | Cavalier, Archer, Mage | Myrmidon, Priest, Barbarian, Cavalier, Archer, Mage |
| Gaius | Fighter, Thief | Myrmidon, Priest, Barbarian, Fighter, Thief |
| Donnel | Mercenary, Fighter, Villager | Myrmidon, Priest, Barbarian, Mercenary, Fighter, Villager |
| Gregor | Mercenary | Myrmidon, Priest, Barbarian, Mercenary |
| Libra | Mage, Dark Mage | Myrmidon, Priest, Barbarian, Mage, Dark Mage |
| Henry | Thief, Dark Mage | Myrmidon, Priest, Barbarian, Thief, Dark Mage |

#### Severa

Fixed parent: **Cordelia** (mother). Base set: Mercenary, Pegasus Knight, Dark Mage.

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular female classes | All regular female classes (incl. Tactician) |
| Frederick | Cavalier, Knight, Wyvern Rider | Mercenary, Pegasus Knight, Dark Mage, Cavalier, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider, Mage | Mercenary, Pegasus Knight, Dark Mage, Archer, Wyvern Rider, Mage |
| Stahl | Cavalier, Myrmidon, Archer | Mercenary, Pegasus Knight, Dark Mage, Cavalier, Myrmidon, Archer |
| Vaike | Knight, Thief | Mercenary, Pegasus Knight, Dark Mage, Knight, Thief |
| Kellam | Knight, Thief, Cleric | Mercenary, Pegasus Knight, Dark Mage, Knight, Thief, Cleric |
| Lon'qu | Myrmidon, Thief, Wyvern Rider | Mercenary, Pegasus Knight, Dark Mage, Myrmidon, Thief, Wyvern Rider |
| Ricken | Cavalier, Archer, Mage | Mercenary, Pegasus Knight, Dark Mage, Cavalier, Archer, Mage |
| Gaius | Myrmidon, Thief | Mercenary, Pegasus Knight, Dark Mage, Myrmidon, Thief |
| Donnel | Troubadour | Mercenary, Pegasus Knight, Dark Mage, Troubadour |
| Gregor | Myrmidon, Troubadour | Mercenary, Pegasus Knight, Dark Mage, Myrmidon, Troubadour |
| Libra | Cleric, Mage | Mercenary, Pegasus Knight, Dark Mage, Cleric, Mage |
| Henry | Thief, Troubadour | Mercenary, Pegasus Knight, Dark Mage, Thief, Troubadour |

#### Yarne

Fixed parent: **Panne** (mother). Base set: Taguel, Thief, Barbarian. (Panne's Wyvern Rider class(es) are not passed down; their skills remain inheritable.)

| Father | Classes added | Full class set |
|---|---|---|
| Avatar (M) | All regular male classes | All regular male classes (incl. Tactician) + Taguel |
| Frederick | Cavalier, Knight, Wyvern Rider | Taguel, Thief, Barbarian, Cavalier, Knight, Wyvern Rider |
| Virion | Archer, Wyvern Rider, Mage | Taguel, Thief, Barbarian, Archer, Wyvern Rider, Mage |
| Stahl | Cavalier, Myrmidon, Archer | Taguel, Thief, Barbarian, Cavalier, Myrmidon, Archer |
| Vaike | Fighter | Taguel, Thief, Barbarian, Fighter |
| Kellam | Knight, Priest | Taguel, Thief, Barbarian, Knight, Priest |
| Lon'qu | Myrmidon, Wyvern Rider | Taguel, Thief, Barbarian, Myrmidon, Wyvern Rider |
| Ricken | Cavalier, Archer, Mage | Taguel, Thief, Barbarian, Cavalier, Archer, Mage |
| Gaius | Myrmidon, Fighter | Taguel, Thief, Barbarian, Myrmidon, Fighter |
| Donnel | Fighter, Mercenary, Villager | Taguel, Thief, Barbarian, Fighter, Mercenary, Villager |
| Gregor | Myrmidon, Mercenary | Taguel, Thief, Barbarian, Myrmidon, Mercenary |
| Libra | Priest, Mage, Dark Mage | Taguel, Thief, Barbarian, Priest, Mage, Dark Mage |
| Henry | Dark Mage | Taguel, Thief, Barbarian, Dark Mage |
