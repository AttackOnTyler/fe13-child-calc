/**
 * Unit opinion (#105): what a named source says about one unit, per play context. Opinions, not game data; shown on
 * unit pages and front doors beside the app's own scores, never scored.
 *
 * Seeded from S10 (Ellery) through the notebook summaries (research/ellery-roles: q3 children, q5 and q6 Gen 1), using
 * only the cells the claims check let through (research/ellery-claims, #78). Cells it found wrong are left out and
 * named in the entry's note: Lon'qu's Skill +2, Ricken's Valkyrie, Cordelia's Tomefaire, Tiki's Tomebreaker,
 * Basilio's Bow Knight, Flavia's Paladin and Bowfaire, Owain's Chrom, Brady's Valkyrie, and every spouse who can't
 * S-support the unit (Chrom × Frederick, Kellam × Frederick or Sumia, Basilio × Flavia). Gen 1 rows don't split main
 * story from postgame, so they apply to every play context; the children's rows do.
 */
import type { ChildId } from '../game-data/children';
import type { ClassId } from '../game-data/classes';
import type { SkillId } from '../game-data/skills';
import type { Stat } from '../game-data/stats';
import type { UnitId } from '../game-data/units';
import type { SourceId } from './sources';

export type OpinionUnit = Exclude<UnitId, 'maiden'> | ChildId | 'robin';
/** The play context an opinion is for: `all` when the source doesn't split them. */
export type OpinionContext = 'main-story' | 'apotheosis' | 'all';

export type OpinionPartner = { readonly unit: OpinionUnit; readonly reason?: string };

export type UnitOpinion = {
  readonly unit: OpinionUnit;
  readonly source: SourceId;
  readonly context: OpinionContext;
  /** Role and tier in the source's words. */
  readonly role: string;
  readonly tier?: string;
  readonly classes: readonly ClassId[];
  /** Up to 5 skills in the build-template slot shape: a skill, or an ordered preference group. */
  readonly loadout: readonly (readonly SkillId[])[];
  readonly recommended: readonly OpinionPartner[];
  readonly warned: readonly OpinionPartner[];
  /** Robin's asset/flaw pick, on Robin's entry. */
  readonly robinPick?: { readonly asset: Stat; readonly flaw: Stat };
  readonly note?: string;
  readonly citation: { readonly title: string; readonly timestamp?: string };
};

const partners = (...list: (OpinionUnit | [OpinionUnit, string])[]): OpinionPartner[] =>
  list.map((p) => (typeof p === 'string' ? { unit: p } : { unit: p[0], reason: p[1] }));
const slots = (...list: (SkillId | SkillId[])[]): SkillId[][] => list.map((s) => (typeof s === 'string' ? [s] : s));

const CHARACTERS = 'Awakening Characters EXPLAINED in 45 Minutes';
const TEAM = 'How to Build a TEAM';
const SECOND_GEN = 'FE Awakening’s 2nd Generation EXPLAINED in 1 Hour';

type Gen1 = Omit<UnitOpinion, 'source' | 'context' | 'warned' | 'citation'> & { readonly cite: string; readonly warned?: readonly OpinionPartner[] };

const GEN1: readonly Gen1[] = [
  { unit: 'chrom', role: 'Pair-up back (Dual Strike+) and player-phase bow attacker', tier: 'S (support lord)', classes: ['great-lord', 'paladin', 'sniper', 'bow-knight'], loadout: slots('dual-strike-plus', 'aether', 'charm', 'bowfaire', 'rightful-king'), recommended: partners(['maribelle', 'controls Lucina and Brady without grinding'], 'sumia', 'robin'), note: 'Early and mid-game support back, then a skill battery for Gen 2.', cite: CHARACTERS },
  { unit: 'lissa', role: 'Staff and Rescue bot; Demoiselle / Dual Support+ aura back', tier: 'S', classes: ['valkyrie', 'sage', 'war-monk'], loadout: slots('dual-support-plus', 'demoiselle', 'rally-resistance', 'tomefaire', 'miracle'), recommended: partners('robin', 'henry', 'libra', 'ricken', 'frederick'), note: '“Free” staff EXP, then staff and aura duty. The notebook’s “passes Dark Mage to Owain” is left out: Lissa has no Dark Mage.', cite: 'Lissa is ACTUALLY the BEST' },
  { unit: 'frederick', role: 'Early juggernaut lead, then a back', tier: 'S early / B late', classes: ['great-knight', 'wyvern-lord', 'griffon-rider', 'paladin'], loadout: slots('dual-guard-plus', 'outdoor-fighter', 'quick-burn', ['swordbreaker', 'lancebreaker'], 'discipline'), recommended: partners('cordelia', 'sumia', 'sully', 'robin'), note: 'Carries Chapters 1–8, then falls off on Spd and moves to the back.', cite: 'Lunatic+ is Hard. Frederick is Harder.' },
  { unit: 'sully', role: 'Evasive physical sweeper and tank; Wyvern Lord against Paladins', tier: 'A', classes: ['wyvern-lord', 'paladin', 'assassin', 'great-knight'], loadout: slots('outdoor-fighter', 'discipline', 'swordbreaker', 'astra', 'luna'), recommended: partners('lonqu', 'kellam', 'frederick', 'stahl'), note: 'Wyvern Lord before Chapter 12 (Beast Killer, no beast weakness), then support and Kjelle’s mother.', cite: CHARACTERS },
  { unit: 'virion', role: 'Player-phase bow chip; skill battery', tier: 'C combat / A father', classes: ['sniper', 'bow-knight', 'wyvern-lord', 'sage'], loadout: slots('skill-plus-2', 'prescience', 'bowfaire', 'hit-rate-plus-20', ['strength-plus-2', 'magic-plus-2']), recommended: partners('olivia', 'cherche', 'cordelia', 'maribelle', 'lissa'), note: 'Bench at Lv 10 and reclass to pass Str +2 or Mag +2 to Inigo, Brady or Severa.', cite: CHARACTERS },
  { unit: 'stahl', role: 'Physical back; Longbow dual-striker', tier: 'B / S father', classes: ['great-knight', 'paladin', 'sniper', 'bow-knight'], loadout: slots('discipline', 'outdoor-fighter', 'luna', 'astra', 'bowfaire'), recommended: partners('cordelia', 'sully', 'panne', 'olivia'), note: 'A top father for physical dual-strikers (Inigo, Severa, Gerome, Yarne).', cite: CHARACTERS },
  { unit: 'vaike', role: 'Enemy-phase Sol tank; Berserker stat battery', tier: 'S', classes: ['hero', 'berserker', 'warrior'], loadout: slots('hp-plus-5', 'zeal', 'sol', 'axebreaker', 'axefaire'), recommended: partners('robin', 'miriel', 'lissa', 'sully', 'cherche'), note: 'A premier physical enemy-phase tank, and a top father for Gerome and Yarne (Str, Berserker, Axefaire).', cite: TEAM },
  { unit: 'miriel', role: 'Player-phase magic removal; Hex/Anathema back', tier: 'S player-phase mage / A tank', classes: ['sage', 'sorcerer', 'valkyrie', 'dark-knight'], loadout: slots('magic-plus-2', 'focus', 'hex', 'anathema', 'tomefaire'), recommended: partners('lonqu', 'robin', 'vaike', 'henry', 'ricken'), note: 'An underrated 2-range nuke that gets past Pavise+ and Counter; passes her magic set and Anathema to Laurent.', cite: 'Miriel is EXTREMELY Underrated' },
  { unit: 'sumia', role: 'Fast Galeforce player-phase lead; Falcon Knight staff', tier: 'S', classes: ['falcon-knight', 'dark-flier', 'great-knight', 'general'], loadout: slots('speed-plus-2', 'relief', 'rally-speed', 'lancefaire', 'galeforce'), recommended: partners(['chrom', 'the early Galeforce Lucina route'], 'frederick', 'henry', 'robin'), note: 'Reach Galeforce before Chapter 13 to pass it on.', cite: CHARACTERS },
  { unit: 'kellam', role: 'Early Def back, then a bulky War Monk staff bot', tier: 'A', classes: ['general', 'great-knight', 'war-monk', 'trickster'], loadout: slots('defence-plus-2', 'indoor-fighter', 'renewal', 'locktouch', 'dual-guard-plus'), recommended: partners('sully', 'lissa'), note: 'The notebook’s Frederick and Sumia are left out: neither can marry Kellam.', cite: CHARACTERS },
  { unit: 'donnel', role: 'Bench or counter-bait without grinding', tier: 'F without grinding', classes: ['hero', 'warrior', 'bow-knight'], loadout: slots('aptitude', 'hp-plus-5', 'armsthrift', 'sol', 'axebreaker'), recommended: partners('panne', 'sully', 'maribelle', 'nowi'), note: 'A niche Galeforce father (Kjelle, Noire, Nah) and the Aptitude line.', cite: 'The Most Overrated Unit in Fire Emblem History' },
  { unit: 'lonqu', role: 'Evasion tank; player-phase Assassin; Vantage father', tier: 'A / S father', classes: ['assassin', 'swordmaster', 'trickster', 'wyvern-lord'], loadout: slots('avoid-plus-10', 'vantage', 'lethality', 'pass', ['quick-burn', 'swordbreaker']), recommended: partners(['miriel', 'for Laurent'], 'sully', 'cordelia', 'lissa', 'cherche'), note: 'The notebook’s Skill +2 is left out: Lon’qu has no Archer. Its own alternative (Quick Burn or a breaker) fills the slot.', cite: 'Lon’qu is BETTER than you think' },
  { unit: 'ricken', role: 'Player-phase magic chip; magic battery and father', tier: 'C / S father', classes: ['dark-knight', 'sage'], loadout: slots('magic-plus-2', 'focus', 'tomefaire', 'slow-burn', 'lifetaker'), recommended: partners('maribelle', ['cordelia', 'a magic Severa'], ['lissa', 'Owain'], 'miriel'), note: 'Hard to train on low Spd. The notebook’s Valkyrie is left out: it is female-only.', cite: CHARACTERS },
  { unit: 'maribelle', role: 'Staff and Rescue; Valkyrie aura, then rally bot', tier: 'S utility', classes: ['valkyrie', 'sage', 'dark-flier'], loadout: slots('demoiselle', 'dual-support-plus', 'rally-speed', 'rally-resistance', ['tomefaire', 'rally-magic', 'rally-movement']), recommended: partners('chrom', 'ricken', 'henry', 'lonqu'), cite: 'Lissa is ACTUALLY the BEST' },
  { unit: 'panne', role: 'Early stat back, then a Wyvern Lord attacker', tier: 'B / A pair-up', classes: ['wyvern-lord', 'taguel', 'assassin', 'griffon-rider'], loadout: slots('strength-plus-2', 'tantivy', 'quick-burn', 'swordbreaker', 'pass'), recommended: partners(['gregor', 'Yarne'], 'stahl', 'lonqu', 'frederick'), note: 'Her E-rank axes hurt at Chapter 12.', cite: CHARACTERS },
  { unit: 'gaius', role: 'Locktouch and Spd attacker, then a Galeforce father', tier: 'B / S father', classes: ['assassin', 'trickster', 'hero'], loadout: slots('locktouch', 'movement-plus-1', 'vantage', 'sol', ['astra', 'lethality']), recommended: partners(['tharja', 'Noire'], ['nowi', 'Nah'], 'sully', 'cordelia'), cite: CHARACTERS },
  { unit: 'cordelia', role: 'Galeforce player-phase lead, Sol tank, or Falcon Knight staff', tier: 'S', classes: ['falcon-knight', 'hero', 'dark-flier', 'sorcerer'], loadout: slots('galeforce', 'sol', 'lancefaire', 'armsthrift'), recommended: partners(['stahl', 'Spd and Def'], 'frederick', 'robin', 'lonqu', 'libra'), note: 'The notebook’s Tomefaire is left out: neither of her tome classes teaches it.', cite: TEAM },
  { unit: 'gregor', role: 'Instant low-investment Sol tank; bow against Counter', tier: 'A', classes: ['hero', 'bow-knight', 'berserker', 'warrior', 'assassin'], loadout: slots('armsthrift', 'patience', 'sol', 'axebreaker', 'axefaire'), recommended: partners(['panne', 'Yarne'], ['cherche', 'Gerome'], 'miriel', 'cordelia'), cite: CHARACTERS },
  { unit: 'nowi', role: 'Dragonstone tank, then Wyvern Lord or Sage', tier: 'B / niche', classes: ['manakete', 'wyvern-lord', 'sage'], loadout: slots('odd-rhythm', 'wyrmsbane', 'strength-plus-2', 'magic-plus-2', 'tomefaire'), recommended: partners(['robin', 'Morgan and Nah'], 'henry', 'gaius', 'donnel', 'ricken'), cite: CHARACTERS },
  { unit: 'libra', role: 'Free 10-range Rescue; tanky utility', tier: 'S utility', classes: ['war-monk', 'sage', 'sorcerer', 'dark-knight'], loadout: slots('healtouch', 'rally-magic', 'tomefaire', 'renewal', 'miracle'), recommended: partners(['lissa', 'Owain'], 'maribelle', 'cordelia', 'olivia'), cite: 'Lissa is ACTUALLY the BEST' },
  { unit: 'tharja', role: 'Instant enemy-phase Nosferatu tank; Hex/Anathema', tier: 'S enemy phase', classes: ['sorcerer', 'dark-knight', 'bow-knight', 'sniper'], loadout: slots('hex', 'anathema', 'vengeance', 'tomebreaker', 'bowfaire'), recommended: partners(['robin', 'Morgan and Noire'], 'gaius', 'gregor', 'lonqu'), cite: TEAM },
  { unit: 'anna', role: 'Free staff and Rescue; Locktouch', tier: 'S utility filler', classes: ['trickster', 'sage', 'bow-knight'], loadout: slots('locktouch', 'movement-plus-1', 'lucky-seven', 'acrobat', 'tomefaire'), recommended: partners('robin'), cite: TEAM },
  { unit: 'olivia', role: 'Dancer; a Galeforce project only when grinding', tier: 'S', classes: ['dancer', 'dark-flier', 'swordmaster'], loadout: slots('luck-plus-4', 'special-dance', 'galeforce', 'astra', 'swordfaire'), recommended: partners('chrom', ['stahl', 'a physical Inigo'], 'virion', 'lonqu', 'robin'), cite: TEAM },
  { unit: 'cherche', role: 'Instant flying attacker; late staff filler', tier: 'A', classes: ['wyvern-lord', 'griffon-rider', 'war-monk', 'valkyrie'], loadout: slots('strength-plus-2', 'tantivy', 'quick-burn', 'swordbreaker', 'renewal'), recommended: partners('virion', ['vaike', 'a max-Str Gerome'], 'gregor', 'frederick', 'henry'), cite: CHARACTERS },
  { unit: 'henry', role: 'Ready-made Hex/Anathema back', tier: 'A / S father', classes: ['sorcerer', 'dark-knight', 'berserker', 'barbarian', 'trickster'], loadout: slots('hex', 'anathema', 'vengeance', 'tomebreaker', 'axefaire'), recommended: partners(['sumia', 'Cynthia'], ['lissa', 'Owain'], ['maribelle', 'Brady'], 'cordelia', 'cherche'), note: 'A Dark Knight back that needs no team EXP, and a top Dark Mage father.', cite: 'Henry is NOT Bad' },
  { unit: 'sayri', role: 'Late pre-promoted filler', tier: 'C', classes: ['swordmaster', 'assassin', 'dark-flier', 'falcon-knight'], loadout: slots('avoid-plus-10', 'vantage', 'astra', 'swordfaire', 'galeforce'), recommended: partners('robin'), cite: TEAM },
  { unit: 'tiki', role: 'Late Dragonstone wall; high-Res anti-mage', tier: 'B / A Robin spouse', classes: ['manakete', 'wyvern-lord', 'sage'], loadout: slots('odd-rhythm', 'wyrmsbane', 'lifetaker', 'magic-plus-2'), recommended: partners(['robin', 'a dragon Morgan']), note: 'The notebook’s Tomebreaker is left out: Tiki has no Dark Mage.', cite: TEAM },
  { unit: 'basilio', role: 'Free late Sol tank; bow; Rally Strength', tier: 'A', classes: ['warrior', 'berserker', 'great-knight'], loadout: slots('hp-plus-5', 'zeal', 'rally-strength', 'counter', 'axefaire'), recommended: partners('robin'), note: 'The notebook’s Bow Knight is left out: Basilio can’t reach it. Flavia is a pair-up partner, not a spouse.', cite: TEAM },
  { unit: 'flavia', role: 'Free late Sol tank', tier: 'A', classes: ['hero', 'bow-knight', 'great-knight'], loadout: slots('armsthrift', 'patience', 'sol', 'axebreaker'), recommended: partners('robin'), note: 'The notebook’s Paladin and Bowfaire are left out: Flavia has no Cavalier or Archer. Basilio is a pair-up partner, not a spouse.', cite: TEAM },
  { unit: 'robin', role: 'Enemy-phase sweeper and player-phase nuke, then rally bot or back', tier: 'S (“best unit in FE history”)', classes: ['sorcerer', 'sage', 'dark-flier', 'grandmaster', 'paladin'], loadout: slots('veteran', 'tomefaire', ['galeforce', 'focus'], 'hex', 'anathema'), recommended: partners(['tharja', 'Ellery’s pick for Robin (M)'], ['chrom', 'Ellery’s pick for Robin (F)'], 'cordelia', 'lucina', 'lissa', 'nowi'), robinPick: { asset: 'mag', flaw: 'str' }, note: '+Mag / −Str. Dark Flier and Galeforce are for a female Robin.', cite: 'Why is Robin SO OVERPOWERED?' },
];

type Child = {
  readonly unit: ChildId;
  readonly mainStory: string;
  readonly apotheosis: string;
  readonly classes: readonly ClassId[];
  readonly recommended: readonly OpinionPartner[];
  readonly note?: string;
};

const CHILDREN: readonly Child[] = [
  { unit: 'lucina', mainStory: 'Galeforce player-phase lead (overrated without grinding)', apotheosis: 'Galeforce player-phase lead / Aether sweeper', classes: ['great-lord', 'falcon-knight', 'sage', 'sniper'], recommended: partners('robin', 'sumia', 'maribelle', 'sully'), note: 'Falcon Knight and Sage need a Sumia, Maribelle or Robin (F) mother.' },
  { unit: 'owain', mainStory: 'Staff utility, then a Vantage Nosferatu tank or Sage nuke', apotheosis: 'Vantage/Vengeance/Wrath lead or Sage Galeforce lead', classes: ['sorcerer', 'sage'], recommended: partners(['henry', 'Sorcerer'], ['libra', 'Sorcerer'], 'ricken'), note: 'The notebook’s Chrom is left out: he can’t marry his sister.' },
  { unit: 'inigo', mainStory: 'Sol enemy-phase tank (Hero) or player-phase Bow Knight', apotheosis: 'Galeforce Aggressor lead or high-damage pair-up back', classes: ['dread-fighter', 'hero', 'bow-knight', 'sniper'], recommended: partners('chrom', 'stahl', 'virion', 'lonqu'), note: 'Sniper needs Chrom, Stahl or Virion.' },
  { unit: 'brady', mainStory: 'Staff user and rally bot', apotheosis: 'Galeforce magic lead or Dual Support+ utility back', classes: ['sage', 'sorcerer'], recommended: partners('chrom', 'libra', 'henry', 'virion', 'vaike'), note: 'The notebook’s Valkyrie is left out: it is female-only. Sorcerer needs Libra or Henry.' },
  { unit: 'kjelle', mainStory: 'Physical tank and sweeper', apotheosis: 'Galeforce attacker or tanky Swordmaster / Wyvern Lord', classes: ['great-knight', 'swordmaster', 'paladin', 'wyvern-lord'], recommended: partners('donnel', 'gaius', 'stahl') },
  { unit: 'cynthia', mainStory: 'S-tier Galeforce player-phase lead or Falcon Knight staff', apotheosis: 'Galeforce Sorcerer / Dark Flier lead', classes: ['falcon-knight', 'sorcerer', 'dark-flier'], recommended: partners(['henry', 'Sorcerer'], 'chrom', 'frederick', 'gaius') },
  { unit: 'severa', mainStory: 'Sol or Nosferatu enemy-phase tank', apotheosis: 'S-tier Galeforce lead', classes: ['hero', 'sorcerer', 'bow-knight', 'dark-flier'], recommended: partners('ricken', 'robin', 'virion') },
  { unit: 'gerome', mainStory: 'A-tier pair-up back', apotheosis: 'Top-tier pair-up back', classes: ['wyvern-lord', 'berserker'], recommended: partners('vaike', 'gregor', 'frederick', 'henry'), note: 'Locked out of Galeforce. Berserker needs Vaike, Gregor or Henry.' },
  { unit: 'morgan-m', mainStory: 'Premier rally bot, or a combat god on staff', apotheosis: 'S-tier lead, or an aura and crit back', classes: ['sage', 'sorcerer', 'trickster'], recommended: [] },
  { unit: 'morgan-f', mainStory: 'Premier rally bot, or a combat god on staff', apotheosis: 'S-tier lead, or an aura and crit back', classes: ['sage', 'falcon-knight', 'manakete', 'sorcerer', 'trickster'], recommended: [], note: 'Manakete only as the daughter of Nowi, Tiki or Nah.' },
  { unit: 'yarne', mainStory: 'Pair-up back', apotheosis: 'High-Spd physical pair-up back', classes: ['wyvern-lord', 'berserker', 'assassin'], recommended: partners(['frederick', 'Wyvern Lord'], 'stahl', 'gregor'), note: 'Locked out of Galeforce.' },
  { unit: 'laurent', mainStory: 'Sage staff utility or Vantage enemy-phase Nosferatu', apotheosis: 'S-tier Vantage/Vengeance/Wrath Sorcerer lead', classes: ['sorcerer', 'sage'], recommended: partners('lonqu', 'ricken', 'gregor', 'robin') },
  { unit: 'noire', mainStory: 'Safe player-phase Sniper / Bow Knight', apotheosis: 'Galeforce Sniper or Sorcerer lead', classes: ['sniper', 'bow-knight', 'sorcerer'], recommended: partners('robin', 'virion', 'gaius', 'ricken') },
  { unit: 'nah', mainStory: '1–2 range Dragonstone tank, then Sage or Wyvern Lord', apotheosis: 'Pair-up back (the back row hides her Spd)', classes: ['trickster', 'sage', 'wyvern-lord', 'manakete'], recommended: partners('robin', 'donnel', 'gaius', 'ricken'), note: 'Trickster needs Gaius or Robin (M).' },
];

export const UNIT_OPINIONS: readonly UnitOpinion[] = [
  ...GEN1.map(({ cite, warned, ...o }): UnitOpinion => ({ ...o, source: 'S10', context: 'all', warned: warned ?? [], citation: { title: cite } })),
  ...CHILDREN.flatMap(({ mainStory, apotheosis, ...c }): UnitOpinion[] =>
    (
      [
        ['main-story', mainStory],
        ['apotheosis', apotheosis],
      ] as const
    ).map(([context, role]) => ({ ...c, source: 'S10', context, role, loadout: [], warned: [], citation: { title: SECOND_GEN } })),
  ),
];
