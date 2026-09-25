/**
 * The chapter guide (#123): how to run each map, in a named source's words, keyed by map and the difficulty the source
 * played. Opinion, not game data: an entry holds a tactic, an optional turn window, the units or pairs it assumes and
 * a citation, and never restates chapter data (enemy stats, counts, drops): the map's chapter data sits beside it.
 *
 * Seeded from S10 (Ellery's Lunatic+ streams, through the notebook summaries) as checked in research/ellery-chapters
 * (#91): the 54 strategies found usable, and 20 of the 26 that needed a fix, corrected there; the 6 that hang on
 * terrain no source publishes are held back (Ch 12's bottom-left turtle, Ch 13's northwest fort, Ch 14's central choke,
 * Ch 16's branches, Ch 24's forest choke, Ch 25's bottom corner), and the 3 unusable ones are dropped (Ch 4's Lon'qu +
 * Miriel pair, Ch 21's advance before the stair spawns, Ch 22's Mire plan).
 */
import type { SourceId } from './sources';

export type GuideEntry = {
  /** The research row it comes from (research/ellery-chapters), e.g. `5.S1`. */
  readonly id: string;
  readonly map: string;
  readonly source: SourceId;
  /** The difficulty the source played it on. */
  readonly difficulty: 'normal' | 'hard' | 'lunatic' | 'lunatic-plus';
  readonly tactic: string;
  readonly turns?: string;
  /** The units it assumes (roster ids), in pairs where it pairs them: `['chrom', 'robin']`. */
  readonly units: readonly string[];
  readonly citation: { readonly title: string; readonly timestamp?: string };
};

const STREAM: Readonly<Record<string, string>> = {
  prologue: 'Frederick CANNOT Be Stopped!',
  'chapter-1': 'Frederick CANNOT Be Stopped!',
  'chapter-2': 'Frederick CANNOT Be Stopped!',
  'chapter-3': 'Is Kellam actually BASED?',
  'chapter-4': 'Is Kellam actually BASED?',
  'chapter-5': 'NEW Strategy for Chapter 5 & 6',
  'chapter-6': 'The most HECTIC Early Map',
  'chapter-7': 'Cordelia is HERE',
  'chapter-8': 'Nowi We Can Do This',
  'chapter-9': 'Tharja, Not Tharja',
  'chapter-10': 'Ambush Spawns and Thieves',
  'chapter-11': 'How to Defeat Gangrel',
  'chapter-12': 'The most BRUTAL Chapter',
  'chapter-13': 'Henry is HERE',
  'chapter-14': 'Is Lucina GOOD',
  'chapter-15': 'Training Lucina',
  'chapter-16': 'Trained Sumia is CLUTCH',
  'chapter-17': 'How to BLOCK AMBUSH SPAWNS',
  'chapter-18': 'How to DEFEAT Yen’Fay and GET the Treasure',
  'chapter-19': 'How to Defeat Walhart',
  'chapter-20': 'The EVEN HARDER Walhart Battle',
  'chapter-21': 'The Mire Tome GAUNTLET',
  'chapter-23': 'Defeating Validar',
  'chapter-25': 'Nowi and Lon’qu vs ENDGAME',
  endgame: 'My Yandere Girlfriend vs the Final Boss in Lunatic+',
  'paralogue-1': 'Paralogue 1 (Donnel) stream',
  'paralogue-2': 'Paralogues 2 and 3 (Anna, Sumia) stream',
  'paralogue-9': 'Paralogue 9 (Cynthia) stream',
  'paralogue-10': 'Paralogue 10 (Severa) stream',
  'paralogue-12': 'Lunatic+ playthrough (notebook summary, no dedicated stream)',
  'paralogue-16': 'Paralogue 16 (Nah) stream',
  'paralogue-20': 'Paralogue 20 (Emmeryn) stream',
};

type Row = [id: string, map: string, tactic: string, units: string[], turns?: string];

const ROWS: readonly Row[] = [
  ['P.S1', 'prologue', 'Stand Robin and Chrom in the canal and chip the melee enemies from it with Thunder at 1–2 range, so they can’t counter; Lissa heals from the bank.', ['robin', 'chrom', 'lissa']],
  ['P.S2', 'prologue', 'Keep Robin leading with Chrom behind for Veteran’s extra EXP.', ['robin', 'chrom']],
  ['1.S1', 'chapter-1', 'Put Frederick, paired with Chrom, on the north fort to tank; Robin chips what reaches him.', ['frederick', 'chrom', 'robin']],
  ['1.S2', 'chapter-1', 'Keep Sully and Virion out of the Hammer Fighter’s reach when they arrive; it moves at once.', ['sully', 'virion'], 'turn 2'],
  ['2.S1', 'chapter-2', 'Clear the first wave from the starting pocket, fall back to the southwest corner, then anchor Frederick on the northwest fort for the second wave.', ['frederick']],
  ['2.S2', 'chapter-2', 'Hand Vaike an axe straight away: he arrives with none.', ['vaike'], 'turn 1'],
  ['2.S3', 'chapter-2', 'Pair Frederick with Sully.', ['frederick', 'sully']],
  ['3.S1', 'chapter-3', 'Once Chrom has talked Kellam into joining, pair them.', ['chrom', 'kellam']],
  ['3.S2', 'chapter-3', 'Clear the two southern groups, southwest first, then open only one door and hold its hallway; don’t spend both keys.', []],
  ['3.S3', 'chapter-3', 'Use magic on the armoured units: Robin doubles the Knights, and Miriel does with a Speed pair-up.', ['robin', 'miriel']],
  ['4.S2', 'chapter-4', 'Hold a defensive line and clear each wave with 2-range as it comes; back off if it gets crowded.', [], 'turns 1–4'],
  ['4.S3', 'chapter-4', 'Take Marth on with tomes or javelins, and finish him fast: below half HP he heals himself if he can’t kill.', []],
  ['4.S4', 'chapter-4', 'Bring Robin to level 10 here, ready to reclass with the Renown Second Seal.', ['robin']],
  ['5.S1', 'chapter-5', 'Have Lissa rescue Ricken and Maribelle across the southeast cliff straight away (Rescue from Paralogue 1’s chest).', ['lissa', 'ricken', 'maribelle'], 'turn 1'],
  ['5.S2', 'chapter-5', 'Camp the bottom-left forts and make sure someone stands on the southwestern fort before its spawns.', [], 'turns 3 and 5'],
  ['5.S3', 'chapter-5', 'A mage with Wind forged to +5 Mt one-rounds the Wyvern Riders.', []],
  ['5.S4', 'chapter-5', 'Pair Robin with Maribelle (once rescued) or Chrom, and Frederick with Sully.', ['robin', 'maribelle', 'frederick', 'sully']],
  ['6.S1', 'chapter-6', 'Lock two lanes, Robin and Chrom left and Frederick right, and let the middle come to you. Stop the Thieves reaching Emmeryn’s door: if they open it she’s almost certainly lost.', ['robin', 'chrom', 'frederick']],
  ['6.S2', 'chapter-6', 'Recruit Gaius with Chrom early, then have him loot the chest.', ['chrom', 'gaius']],
  ['7.S1', 'chapter-7', 'Let Frederick kill the Hammer Barbarian when it moves on turn 2 rather than walking into its range on turn 1.', ['frederick'], 'turn 2'],
  ['7.S2', 'chapter-7', 'Fight from 2 range against anything that may have Counter, and set up in a forest.', []],
  ['7.S3', 'chapter-7', 'Intercept both Thieves early, then plan the boss around the Wyvern Riders that move with the western reinforcements.', [], 'turns 1–5'],
  ['7.S4', 'chapter-7', 'Pair Cordelia with Lon’qu or Stahl once she arrives, away from the west edge where reinforcements come.', ['cordelia', 'lonqu', 'stahl'], 'from turn 3'],
  ['8.S1', 'chapter-8', 'The linked groups only move once a unit is in range of two of their members: pull them one group at a time with a 2-range unit.', []],
  ['8.S2', 'chapter-8', 'Visit the villages at your own pace; send Robin, weapons unequipped, to the Master Seal village and promote at once.', ['robin']],
  ['8.S3', 'chapter-8', 'Give Lon’qu the Levin Sword (a Renown reward).', ['lonqu']],
  ['9.S1', 'chapter-9', 'Lure Tharja with Libra or a Pegasus Knight, and unequip the blocker so she survives to be recruited.', ['libra', 'tharja']],
  ['9.S2', 'chapter-9', 'Clear the Wyverns north of the start to open a way back south, and fall back before they arrive.', [], 'before turn 5'],
  ['9.S3', 'chapter-9', 'Clear with 2-range; Chrom talks to both recruits, Libra by turn 3 (Rescue may be needed).', ['chrom', 'libra', 'tharja'], 'by turn 3'],
  ['10.S1', 'chapter-10', 'Rush the Thieves with fliers before they escape.', [], 'turn 1'],
  ['10.S2', 'chapter-10', 'Stand on the reinforcement forts before they spawn.', [], 'before turn 5'],
  ['10.S3', 'chapter-10', 'Promote Cordelia (Panne, a Taguel, can’t promote).', ['cordelia']],
  ['10.S4', 'chapter-10', 'Use Libra’s Rescue to pull units out.', ['libra']],
  ['11.S1', 'chapter-11', 'Push one flank, outside the other group’s range: go southwest to the mountains, where enemies come one at a time. Gangrel and his escort wait until provoked.', []],
  ['11.S2', 'chapter-11', 'Seize the spawn forts you safely can; one sits inside Gangrel’s squad’s range, so leave it.', []],
  ['11.S3', 'chapter-11', 'Bait Gangrel with 1–2 range (a Levin Sword), with enough Spd not to be doubled; Tharja’s Hex and Anathema help.', ['tharja']],
  ['11.S4', 'chapter-11', 'Promote Lon’qu at level 10 (Nowi, a Manakete, can’t promote).', ['lonqu']],
  ['12.S1', 'chapter-12', 'Take the Beast Killers (Robin can kill the Knight carrying one on turn 1) and use them on the cavalry.', ['robin'], 'turn 1'],
  ['12.S3', 'chapter-12', 'Bring 15 Rescue charges across three staff users (Rescue has 5 uses; buyable after this map).', []],
  ['12.S4', 'chapter-12', 'Make Frederick a Wyvern Lord, and keep pegasus and griffon riders away from the Beast Killers (wyverns are safe from them).', ['frederick']],
  ['12.S5', 'chapter-12', 'Use Olivia to hit and run.', ['olivia']],
  ['13.S2', 'chapter-13', 'Clear the south by the end of turn 3, plug the forts, and hold the southeast and southwest cliff paths with 2-range, Rescue and dancing (Pass gets past plugs on Lunatic+).', [], 'turns 1–3'],
  ['14.S1', 'chapter-14', 'Rush Ignatius before the last wave.', [], 'turns 3–4'],
  ['14.S3', 'chapter-14', 'Master Seal Lucina into a Great Lord at once.', ['lucina']],
  ['15.S1', 'chapter-15', 'Train Lucina here: her Rapier is effective against the armour and horse units.', ['lucina']],
  ['15.S2', 'chapter-15', 'Keep Say’ri safe, but don’t rush her: recruiting her wakes the northeast Cavaliers and Generals.', ['sayri']],
  ['16.S1', 'chapter-16', 'Fly Sumia along the branches to catch the Thieves before they escape north.', ['sumia'], 'turns 1–2'],
  ['16.S3', 'chapter-16', 'Or rush Cervantes with Galeforce, leaving the start area before the wave there.', [], 'before turn 4'],
  ['17.S1', 'chapter-17', 'Block the stair tiles before the spawns begin: four eastern, two western and two central.', [], 'before turn 8'],
  ['17.S2', 'chapter-17', 'Attack over the walls with Longbows or tomes.', []],
  ['17.S3', 'chapter-17', 'Use Galeforce to strike and get back out.', []],
  ['18.S1', 'chapter-18', 'Kill Yen’fay on turn 1 or 2 with a flier carrying a bow or sword attacker, backed by rallies.', [], 'turns 1–2'],
  ['18.S2', 'chapter-18', 'Or clear the map for the chest rooms, but plan the chests first: they have deadlines.', [], 'turns 7–11'],
  ['18.S3', 'chapter-18', 'Lances are fine against Yen’fay (the triangle favours them); keep them away from the Griffon Riders instead.', []],
  ['19.S1', 'chapter-19', 'Blitz Walhart and kill him on player phase of turn 4; he waits until provoked, but the turn-4 wave spawns before that enemy phase.', [], 'turns 1–4'],
  ['19.S2', 'chapter-19', 'Use Beast Killers to clear a lane, not on Walhart: Conquest cancels them.', []],
  ['20.S1', 'chapter-20', 'Push the right corridor to catch the Thief heading for the east room.', [], 'turns 1–3'],
  ['20.S2', 'chapter-20', 'Set your position for turn 4, when a large wave comes from the south of all three corridors and Excellus starts moving; then break the centre.', [], 'turn 4'],
  ['20.S3', 'chapter-20', 'Bait Walhart, then kill him on player phase with brave weapons or dual-strike crits (plain Pavise and Aegis don’t stop dual strikes).', []],
  ['21.S1', 'chapter-21', 'Count the Mire ranges, then jump the walls (fliers, or dancing and Rescue, which can drop units past them) to kill the Sorcerers.', []],
  ['21.S2', 'chapter-21', 'Let high-Res or Nosferatu tanks burn the Mire charges.', []],
  ['23.S1', 'chapter-23', 'Defeat Validar’s first form first: the start room’s barrier only falls then. Then push north.', []],
  ['23.S2', 'chapter-23', 'Once Basilio joins, let him hold chokes (Sol tank, Rally Strength).', ['basilio']],
  ['23.S3', 'chapter-23', 'Back-row damage gets past plain Pavise and Aegis, but on Lunatic+ Pavise+ and Aegis+ can trigger on a dual strike, and Dragonskin halves it: don’t count on it alone.', []],
  ['25.S2', 'chapter-25', 'Advance on Aversa: the map ends when she falls, whatever the waves are doing.', []],
  ['E.S1', 'endgame', 'Blitz Grima in 1–2 turns: rallies, dancing, and Rescue to drop killer pairs next to him with brave weapons or the Parallel Falchion. Check the drop tiles on the map.', [], 'turns 1–2'],
  ['E.S2', 'endgame', 'On Lunatic+ don’t lean on the back-row dual strike: Grima’s Pavise+ can trigger on it and Dragonskin halves it. Plain-Pavise reasoning only holds up to Lunatic.', []],
  ['P1.S', 'paralogue-1', 'Recruit Donnel, feed him Archers (they can’t counter him), then bench him.', ['donnel']],
  ['P2.S', 'paralogue-2', 'Let a Dark Flier Sumia ferry Chrom to clear both sides.', ['sumia', 'chrom']],
  ['P9.S', 'paralogue-9', 'Fly over the wall and talk to Cynthia before the southwestern groups start moving.', [], 'turns 1–2'],
  ['P10.S', 'paralogue-10', 'Get Severa to Holland: she only joins by talking to him, and turns enemy if he dies. Reinforcements come early and after the talk.', [], 'turns 2–4'],
  ['P12.S', 'paralogue-12', 'Not a quiet levelling map: Rescue Morgan on turn 1, bring fliers for the water, and intercept the two chest Thieves.', [], 'turn 1'],
  ['P16.S', 'paralogue-16', 'Reach or Rescue Nah first instead of waiting out the Mire Sorcerers: her chamber’s wall collapses on turn 3 and leaves her exposed.', [], 'before turn 3'],
  ['P20.S', 'paralogue-20', 'Rescue Emmeryn to your base on turn 1 (the village gives another Rescue).', [], 'turn 1'],
];

export const CHAPTER_GUIDE: readonly GuideEntry[] = ROWS.map(([id, map, tactic, units, turns]) => ({
  id,
  map,
  source: 'S10',
  difficulty: 'lunatic-plus',
  tactic,
  ...(turns ? { turns } : {}),
  units,
  citation: { title: STREAM[map] ?? 'Lunatic+ playthrough (notebook summary)' },
}));
