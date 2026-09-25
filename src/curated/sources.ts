/**
 * The source registry (#99): every named source curated data cites. Build templates, synergies and conflicts cite
 * these IDs instead of free text. IDs and details are the builds research's (research/builds-and-synergies §Sources,
 * #6); S1, S2 and S8 are the mechanics references it cites alongside the opinion sources.
 */

/** What kind of source it is. */
export type SourceKind = 'reference' | 'guide' | 'faq' | 'blog' | 'crowd-sourced' | 'video creator';

export type SourceEntry = {
  readonly id: SourceId;
  /** Short name the UI shows, e.g. `soly’s Apotheosis guide`. */
  readonly name: string;
  /** The full title and author. */
  readonly title: string;
  readonly kind: SourceKind;
  readonly link: string;
  /** How it reached the curated data, and how far to trust it. */
  readonly provenance: string;
};

export const SOURCE_IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

const RESEARCH = 'Read for the builds research (#6)';

export const SOURCES: Readonly<Record<SourceId, SourceEntry>> = {
  S1: {
    id: 'S1',
    name: 'Serenes Forest: Skills',
    title: 'Serenes Forest, Awakening: Skills',
    kind: 'reference',
    link: 'https://serenesforest.net/awakening/miscellaneous/skills/',
    provenance: `${RESEARCH}; reference site for mechanics.`,
  },
  S2: {
    id: 'S2',
    name: 'Serenes Forest: Calculations',
    title: 'Serenes Forest, Awakening: Calculations (proc priority, dual strike formula)',
    kind: 'reference',
    link: 'https://serenesforest.net/awakening/miscellaneous/calculations/',
    provenance: `${RESEARCH}; reference site for mechanics.`,
  },
  S3: {
    id: 'S3',
    name: 'soly’s Apotheosis guide',
    title: 'soly, FE:A Apotheosis Character Build Guide v2',
    kind: 'guide',
    link: 'https://docs.google.com/document/d/13b2KxYlWGqnMPbXMqjGj850dKa88sAytTCCJw7gpaS4/',
    provenance: `${RESEARCH}; community guide, about 2018, v2 about 2023.`,
  },
  S4: {
    id: 'S4',
    name: 'guedesbrawl’s Skill FAQ',
    title: 'guedesbrawl (Rafael Guedes), Fire Emblem: Awakening Skill FAQ v1.2',
    kind: 'faq',
    link: 'https://gamefaqs.gamespot.com/3ds/643003-fire-emblem-awakening/faqs/66998',
    provenance: `${RESEARCH}; GameFAQs guide, May 2013.`,
  },
  S5: {
    id: 'S5',
    name: 'TV Tropes',
    title: 'TV Tropes, GameBreaker / Fire Emblem: Awakening',
    kind: 'crowd-sourced',
    link: 'https://tvtropes.org/pmwiki/pmwiki.php/GameBreaker/FireEmblemAwakening',
    provenance: `${RESEARCH}; crowd-sourced.`,
  },
  S6: {
    id: 'S6',
    name: 'Thenewguy34’s children blog',
    title: 'Thenewguy34, Awakening Children Characters: How to Maximize Their Potential',
    kind: 'blog',
    link: 'https://fireemblem.fandom.com/wiki/User_blog:Thenewguy34/Awakening_Children_Characters:_How_to_Maximize_Their_Potential',
    provenance: `${RESEARCH}; Fandom user blog, March 2013.`,
  },
  S7: {
    id: 'S7',
    name: 'GameFAQs Q&A',
    title: 'GameFAQs Q&A, What are the best skills for my units?',
    kind: 'faq',
    link: 'https://gamefaqs.gamespot.com/3ds/643003-fire-emblem-awakening/answers/382881-what-are-the-best-skills-for-my-units',
    provenance: `${RESEARCH}; a single user’s answer.`,
  },
  S8: {
    id: 'S8',
    name: 'Fire Emblem Wiki',
    title: 'Fire Emblem Wiki: Aggressor, Vengeance, Rightful King, Galeforce',
    kind: 'reference',
    link: 'https://fireemblemwiki.org/wiki/Aggressor',
    provenance: `${RESEARCH}; wiki, for mechanics.`,
  },
  S9: {
    id: 'S9',
    name: 'No Contest Creations',
    title: 'No Contest Creations, Fire Emblem: Awakening — Resetless Lunatic+ Endgame',
    kind: 'blog',
    link: 'https://no-contest-creations.com/fire-emblem-awakening-resetless-lunatic-endgame/',
    provenance: `${RESEARCH}; blog playthrough.`,
  },
};

/** A citation as the UI shows it: the registry ID, its short name and its link. */
export type SourceRef = { readonly id: SourceId; readonly name: string; readonly link: string };

export const sourceRefs = (ids: readonly SourceId[]): SourceRef[] => ids.map((id) => ({ id, name: SOURCES[id].name, link: SOURCES[id].link }));
