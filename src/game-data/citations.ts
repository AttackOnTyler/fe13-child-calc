/**
 * Structured citations, used only by the two sets the validation panel shows: the assumptions registry and the
 * resolved-disagreements list. Other game data cites its sources in header comments.
 */
export type Citation = { readonly label: string; readonly url: string };

/** A game-data value that no source settles: it names the assumption that supplies it. */
export type Assumed<K extends string> = { readonly assumption: K };

export const SF_GROWTHS: Citation = { label: 'SF base growths', url: 'https://serenesforest.net/awakening/characters/growth-rates/base/' };
export const SF_GROWTH_JS: Citation = { label: 'SF calculator chargrowth13-2.js', url: 'https://serenesforest.net/app/java/chargrowth13-2.js' };
export const SF_MODIFIERS: Citation = { label: 'SF cap modifiers', url: 'https://serenesforest.net/awakening/characters/maximum-stats/modifiers/' };
export const SF_MAX_JS: Citation = { label: 'SF calculator fe13maxstats.js', url: 'https://serenesforest.net/app/java/fe13maxstats.js' };
export const SF_CLASS_GROWTHS: Citation = { label: 'SF class growth rates', url: 'https://serenesforest.net/awakening/classes/growth-rates/' };
export const SF_CLASS_CAPS: Citation = { label: 'SF class max stats', url: 'https://serenesforest.net/awakening/classes/maximum-stats/' };
export const SF_CLASS_BASES: Citation = { label: 'SF class base stats', url: 'https://serenesforest.net/awakening/classes/base-stats/' };
export const SF_CALCULATIONS: Citation = { label: 'SF calculations (doubling)', url: 'https://serenesforest.net/awakening/miscellaneous/calculations/' };
export const SF_CHILDREN: Citation = { label: 'SF children', url: 'https://serenesforest.net/awakening/characters/children/' };
export const SF_BASES: Citation = { label: 'SF base stats (main story)', url: 'https://serenesforest.net/awakening/characters/base-stats/main-story/' };
export const SFF_CHILD_BASES: Citation = {
  label: 'SF forums 33434, calculating children’s base stats',
  url: 'https://forums.serenesforest.net/topic/33434-calculating-childrens-base-stats/',
};
export const SF_RECRUITMENT: Citation = { label: 'SF recruitment (main story)', url: 'https://serenesforest.net/awakening/characters/recruitment/main-story/' };

export const FEW_GROWTH_MODULE: Citation = {
  label: 'FEW Module:CharGrowths/FE13',
  url: 'https://fireemblemwiki.org/w/index.php?title=Module:CharGrowths/FE13&oldid=620231',
};
export const FEW_CLASS_MODULE: Citation = { label: 'FEW Module:ClassStats/FE13', url: 'https://fireemblemwiki.org/wiki/Module:ClassStats/FE13' };
export const FEW_CLASS_LIST: Citation = {
  label: 'FEW list of classes in Awakening',
  url: 'https://fireemblemwiki.org/wiki/List_of_classes_in_Fire_Emblem_Awakening',
};
export const FEW_INHERITANCE: Citation = { label: 'FEW Inheritance', url: 'https://fireemblemwiki.org/wiki/Inheritance' };
export const FEW_CONQUEROR: Citation = { label: 'FEW Conqueror', url: 'https://fireemblemwiki.org/wiki/Conqueror' };
export const FEW_WALHART: Citation = { label: 'FEW Walhart', url: 'https://fireemblemwiki.org/w/index.php?title=Walhart&oldid=765770' };
export const FEW_FLAVIA: Citation = { label: 'FEW Flavia', url: 'https://fireemblemwiki.org/wiki/Flavia' };
export const FEW_OLIVIA: Citation = { label: 'FEW Olivia', url: 'https://fireemblemwiki.org/wiki/Olivia' };
export const FEW_AVERSA: Citation = { label: 'FEW Aversa', url: 'https://fireemblemwiki.org/wiki/Aversa' };
export const FEW_PARALOGUE_22: Citation = { label: 'FEW Paralogue 22 (NPC Aversa)', url: 'https://fireemblemwiki.org/wiki/Paralogue_22_(Awakening)' };
export const FANDOM_OLIVIA: Citation = { label: 'Fandom Olivia', url: 'https://fireemblem.fandom.com/wiki/Olivia' };
export const FANDOM_AVERSA: Citation = { label: 'Fandom Aversa', url: 'https://fireemblem.fandom.com/wiki/Aversa' };
export const FEW_LUCINA_STATS: Citation = { label: 'FEW Lucina/Stats', url: 'https://fireemblemwiki.org/wiki/Lucina/Stats?oldid=746071' };
export const FEW_CHARSTATS: Citation = { label: 'FEW Template:CharStats FE13', url: 'https://fireemblemwiki.org/wiki/Template:CharStats_FE13' };
export const FEW_KJELLE_STATS: Citation = { label: 'FEW Kjelle/Stats', url: 'https://fireemblemwiki.org/wiki/Kjelle/Stats' };
export const FEW_LORD: Citation = { label: 'FEW Lord', url: 'https://fireemblemwiki.org/wiki/Lord' };
export const FEW_THIEF: Citation = { label: 'FEW Thief', url: 'https://fireemblemwiki.org/wiki/Thief' };

export const JP_CAPS: Citation = { label: 'JP 2ch wiki caps (p.79)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/79.html' };
export const JP_CLASSES: Citation = { label: 'JP 2ch wiki classes (p.107)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/107.html' };
export const JP_PK: Citation = { label: '天馬騎士団 FE13 class list', url: 'https://www.pegasusknight.com/wiki/fe13/クラス/一覧' };

export const SOLY_APOTHEOSIS: Citation = {
  label: 'soly, Apotheosis build guide §2.5, §6.8',
  url: 'https://docs.google.com/document/d/13b2KxYlWGqnMPbXMqjGj850dKa88sAytTCCJw7gpaS4/',
};

const RESEARCH = 'https://github.com/AttackOnTyler/fe13-child-calc/blob';
export const RESEARCH_STAT_INHERITANCE: Citation = {
  label: 'Research: stat inheritance (#2)',
  url: `${RESEARCH}/research/stat-inheritance/docs/research/stat-inheritance.md`,
};
export const RESEARCH_CLASSES: Citation = {
  label: 'Research: marriage and classes (#3)',
  url: `${RESEARCH}/research/marriage-and-classes/docs/research/marriage-and-classes.md`,
};
export const RESEARCH_DISAGREEMENTS: Citation = {
  label: 'Research: data disagreements (#13)',
  url: `${RESEARCH}/research/data-disagreements/docs/research/data-disagreements.md`,
};
export const RESEARCH_FIXTURES_SPEED: Citation = {
  label: 'Research: fixtures and Speed (#7)',
  url: `${RESEARCH}/research/fixtures-and-speed/docs/research/fixtures-and-speed.md`,
};
export const RESEARCH_SKILL_INHERITANCE: Citation = {
  label: 'Research: skill inheritance (#4)',
  url: `${RESEARCH}/research/skill-inheritance/docs/research/skill-inheritance.md`,
};
export const RESEARCH_DEATH_AFTER_MARRIAGE: Citation = {
  label: 'Research: death after marriage (#17)',
  url: `${RESEARCH}/research/death-after-marriage/docs/research/death-after-marriage.md`,
};
export const RESEARCH_CHILD_RECRUITMENT: Citation = {
  label: 'Research: child recruitment (#140)',
  url: `${RESEARCH}/research/child-recruitment/research/child-recruitment.md`,
};
export const RESEARCH_SUPPORT_GROWTH: Citation = {
  label: 'Research: how fast supports grow (#139)',
  url: `${RESEARCH}/research/support-growth/research/support-growth.md`,
};
export const SF_SUPPORT_BASICS: Citation = { label: 'SF Support Basics', url: 'https://serenesforest.net/awakening/characters/supports/support-basics/' };
/**
 * The JP 2ch wiki's recruiting page: Chrom's Chapter 11 wedding by the highest support; its tie order ("probably") and
 * its line that Olivia needs a C are refuted by SF's tests (SFF-39984).
 */
export const JP_SUPPORTS: Citation = { label: 'JP 2ch wiki supports (p.27)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/27.html' };
/** SF forum tests of Chrom's Chapter 11 wedding (May 2013): unviewed Cs don't count, 1 point is enough alone, Olivia's jump at 2. */
export const SFF_CHROM_WEDDING_TESTS: Citation = {
  label: 'SF Forums: Chrom Chapter 11/12 marriage priority (topic 39984)',
  url: 'https://forums.serenesforest.net/topic/39984-chrom-chapter-1112-marriage-priority-discussion-thread/',
};
/** VincentASM's write-up SF Support Basics condenses: points compared after rounding, Olivia first from half her C. */
export const SFF_CHROM_WEDDING_RULE: Citation = {
  label: 'SF Forums: Chrom’s marriage priority + notes on supports (topic 40418)',
  url: 'https://forums.serenesforest.net/topic/40418-chroms-marriage-priority-notes-on-supports/',
};
/** FEW Chrom: his wife is the highest-ranked candidate "not dead" or married to someone else (uncited on the dead). */
export const FEW_CHROM: Citation = { label: 'FEW Chrom (oldid 772811)', url: 'https://fireemblemwiki.org/w/index.php?oldid=772811' };
/** FEW Maiden: Chrom marries her with no support points with any candidate, or all dead or married. */
export const FEW_MAIDEN: Citation = { label: 'FEW Maiden (oldid 660417)', url: 'https://fireemblemwiki.org/w/index.php?oldid=660417' };
/** FEW Olivia: marrying her to Chrom means keeping him from the others and maximising Chapter 11 with her. */
export const FEW_OLIVIA_WEDDING: Citation = { label: 'FEW Olivia (oldid 736476)', url: 'https://fireemblemwiki.org/w/index.php?oldid=736476' };
/** FEW Inheritance at the revision read for Chrom's wedding: the highest support at the end of Chapter 11, else the Maiden. */
export const FEW_INHERITANCE_WEDDING: Citation = { label: 'FEW Inheritance (oldid 752340)', url: 'https://fireemblemwiki.org/w/index.php?oldid=752340' };
export const RESEARCH_GOLD: Citation = {
  label: 'Research: the gold economy (#158)',
  url: `${RESEARCH}/research/gold-economy/research/gold-economy.md`,
};
/** FEW Durability: a use goes each time a weapon attacks; tomes and staves spend one on a miss in the series (no Awakening test). */
export const FEW_DURABILITY: Citation = { label: 'FEW Durability (oldid 772928)', url: 'https://fireemblemwiki.org/w/index.php?title=Durability&oldid=772928' };
export const FEW_RENOWN: Citation ={ label: 'FEW Renown (oldid 762420)', url: 'https://fireemblemwiki.org/w/index.php?title=Renown&oldid=762420' };
export const SF_RENOWN: Citation = { label: 'SF Renown', url: 'https://serenesforest.net/awakening/miscellaneous/renown/' };
export const RESEARCH_EXP: Citation = {
  label: 'Research: EXP rules (#138)',
  url: `${RESEARCH}/research/exp-rules/research/exp-rules.md`,
};
export const SPEC_MAP_SIMULATION: Citation = {
  label: 'Spec: Endpoint-first planning, The map simulation (#175, #159)',
  url: 'https://github.com/AttackOnTyler/fe13-child-calc/issues/175',
};
export const SF_STAVES: Citation = { label: 'SF staves', url: 'https://serenesforest.net/awakening/inventory/staves/' };
export const RESEARCH_INTERNAL_LEVEL: Citation = {
  label: 'What the chapter log records for the internal level (#149)',
  url: 'https://github.com/AttackOnTyler/fe13-child-calc/issues/149',
};
export const JP_CHILDREN: Citation = { label: 'JP 2ch wiki child units (p.112)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/112.html' };
/** The mirror wiki's child units page: a passed skill the child already has wastes the slot. */
export const JP_CHILDREN_MIRROR: Citation = { label: 'JP 2ch wiki child units (p.89)', url: 'https://w.atwiki.jp/kakuseife/pages/89.html' };
/** The 天馬騎士団 wiki's children page, with player tests in its comments (bottom skill; Stahl × Sully's Kjelle). */
export const JP_PK_CHILDREN: Citation = {
  label: '天馬騎士団 FE13 children',
  url: 'https://www.pegasusknight.com/wiki/fe13/ユニット/絆・結婚システム/子供',
};
export const SF_GAIDEN: Citation = { label: 'SF Gaiden Chapters', url: 'https://serenesforest.net/awakening/miscellaneous/gaiden-chapters/' };
export const FEW_CHILD_PARALOGUES: Citation = {
  label: 'FEW Of Sacred Blood and Paralogues 5–16 (oldids 742107; 742102 … 742094)',
  url: 'https://fireemblemwiki.org/w/index.php?oldid=742107',
};
export const FEW_PARALOGUE_7: Citation = { label: 'FEW Noble Lineage (P7, oldid 769016)', url: 'https://fireemblemwiki.org/w/index.php?oldid=769016' };
export const JP_PARALOGUES: Citation = { label: 'JP 2ch wiki paralogues (p.144, 84, 145, 147, 138) and FAQ (p.19)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/84.html' };
export const FEW_LUCINA: Citation = { label: 'FEW Lucina (inheritance note)', url: 'https://fireemblemwiki.org/wiki/Lucina' };
/** How the solve allocates stat boosters, tonics and held weapons (#166): the item plan's grilling and its facts. */
export const ITEM_PLAN_GRILLING: Citation = {
  label: 'How does the solve allocate stat boosters, tonics and held weapons? (#166)',
  url: 'https://github.com/AttackOnTyler/fe13-child-calc/issues/166',
};
export const SF_ITEMS: Citation = { label: 'SF items', url: 'https://serenesforest.net/awakening/inventory/items/' };
