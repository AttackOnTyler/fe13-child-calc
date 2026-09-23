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
export const FEW_LUCINA_STATS: Citation = { label: 'FEW Lucina/Stats', url: 'https://fireemblemwiki.org/wiki/Lucina/Stats?oldid=746071' };
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
export const JP_CHILDREN: Citation = { label: 'JP 2ch wiki child units (p.112)', url: 'https://w.atwiki.jp/fireemblem3ds/pages/112.html' };
export const FEW_LUCINA: Citation = { label: 'FEW Lucina (inheritance note)', url: 'https://fireemblemwiki.org/wiki/Lucina' };
