# Ellery's Lunatic Prologue: turns, trades, wake timing

Ticket: "What does Ellery's Lunatic Prologue play look like: turns, trades, wake timing?" (#280), map #253. Source: the user's NotebookLM notebook "Awakening Character Identity and Unit Optimization Strategy" (101 sources, mostly Ellery's streams). It was asked two questions on 2026-09-28. The answers are the notebook's synthesis with quotes; the video titles are as it cites them. **The notebook can be wrong.** Each claim below is marked **checked** (against our ROM data or attempt 3) or **unverified**.

## Findings

1. **The water trick.** The Tactician (Robin) and the Lord (Chrom) can stand on the Prologue's water; Barbarians and Myrmidons can't. Robin, paired with Chrom, sits on water and chips or kills the melee foes that gather on the shore, with Thunder at range 1–2. **Only the Mage threatens him there.**
   - **Checked:** the ROM's movement table (`src/game-data/maps/terrain.ts`, `g` = Water) gives Tactician and Lord cost 5, and Barbarian, Myrmidon, Mage, Great Knight and Cleric no entry.
   - Our solver already models this. It never used it, because Robin rode as Frederick's back all map.
2. **The Mage first.** "The Mage is the only unit capable of dealing heavy 2-range magic damage to Frederick"; he kills it on player phase or baits it onto a counter before the melee foes arrive.
   - Without the Mage, the gang-up is small: "we're taking 11 damage total and we have 22 HP… there is literally no enemies that are a danger to Frederick anymore" ("Frederick CANNOT Be Stopped!").
   - **Checked in spirit:** in attempt 3's EP6 the Mage was 15 of the 27. Without it, Frederick takes 12, not 27.
3. **Frederick heals himself.** On T1 Chrom trades his Vulnerary to Frederick before pairing up, "which means Lissa won't be able to heal me, which is fine because I will use the [vulnerary]". So Lissa never steps into reach.
   - Attempt 3's engine check agrees: a heal from Lissa standing beside Frederick left her with a worst case of 46 against 17 HP.
4. **Lissa and Robin out of every foe's reach, Frederick (with Chrom) as the only one in reach:** "So both Lissa and Robin are out of range of all enemies" (Iron Man). The fast clears wake the north on **T2**, with Frederick pushed to the edge of their reach. **Unverified:** "T2" is the notebook's summary.
5. **Separating is routine.** He Separates and "drops" units to gain a tile or to put Robin on water: "have Frederick drop Chrom onto the water", "separate here so that I have Frederick available next turn".
6. **Weapon choice.** He equips a Bronze weapon on Frederick to save Silver Lance uses and to avoid killing too much on enemy phase before a heal. This is a tempo and EXP control, not safety.
7. **Enemy targeting:** "He should go for Robin cuz he deals more damage to Robin… He just wants to deal as much damage as possible". **Checked:** this matches our folklore rule (the most expected damage).
8. **Turn counts:**
   - fast clears with Frederick sweeping: **5–10 turns**;
   - the full-EXP double water trick: about 59 ("59 turns that's actually not bad at all for a double water trick").
   - Attempt 1 took 11.
9. **Garrick:** killed around T5–T8 in fast clears, and sometimes fed to Robin.
   - **Wrong as stated:** "pulls Garrick away … onto a forest". Garrick can't move (ROM flag 0x10, research #254), and the map has no forest.

## For the tempo decision

The human line differs from the solver's in four concrete ways:
- **Robin on water**, as a second, safe damage dealer;
- **kill the Mage before taking a gang-up**, so the gang-up drops from about 27 to about 12;
- **Frederick carries a Vulnerary** from T1, so recovery never puts Lissa in reach;
- **Separate and drop** to free units.

All four are in the solver's command menu already. The gap is what it searches and how it scores.
