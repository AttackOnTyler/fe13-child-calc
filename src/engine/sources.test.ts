import { describe, expect, it } from 'vitest';
import { BUILD_TEMPLATES } from '../curated/builds';
import { CONFLICTS, SYNERGIES } from '../curated/synergies';
import { SOURCES, SOURCE_IDS } from '../curated/sources';
import { RANK_DECISIONS, SKILL_RANKS } from '../curated/skill-ranks';
import { createEngine } from './index';

const known = new Set<string>(Object.keys(SOURCES));

describe('the source registry', () => {
  it('holds S1–S10, each with a name, kind, link and provenance under its own ID', () => {
    expect([...SOURCE_IDS]).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
    for (const id of SOURCE_IDS) {
      const s = SOURCES[id];
      expect(s.id).toBe(id);
      expect(s.name && s.kind && s.provenance).toBeTruthy();
      expect(s.link).toMatch(/^https:\/\//);
    }
  });

  it('resolves every citation in the build templates, synergies and conflicts', () => {
    const cited = [...BUILD_TEMPLATES, ...SYNERGIES, ...CONFLICTS].map((x) => x.sources);
    for (const ids of cited) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(known.has(id)).toBe(true);
    }
  });

  it('reaches the UI as names, not IDs', () => {
    const t = createEngine().buildTemplates('all').find((x) => x.id === BUILD_TEMPLATES[0]!.id)!;
    expect(t.sources.map((s) => s.name)).toEqual(BUILD_TEMPLATES[0]!.sources.map((id) => SOURCES[id].name));
  });
});

describe('the S10 curation pass', () => {
  it('adds S10 templates and edges, and raises confidence where S10 agrees', () => {
    const t = (id: string) => BUILD_TEMPLATES.find((x) => x.id === id)!;
    expect(t('E01').sources).toEqual(['S10']);
    expect(t('B07')).toMatchObject({ sources: ['S3', 'S10'], confidence: 'Multi' });
    expect(SYNERGIES.find((e) => e.a === 'hex' && e.b === 'anathema')!.sources).toEqual(['S10']);
    expect(CONFLICTS.find((e) => e.a === 'astra' && e.b === 'counter')!.sources).toEqual(['S10']);
  });

  it('records each rank call against a source, and keeps the rank it records', () => {
    for (const d of RANK_DECISIONS) {
      expect(known.has(d.source)).toBe(true);
      const rank = SKILL_RANKS[d.skill];
      expect(rank?.[d.context] ?? rank?.default ?? 0, d.skill).toBe(d.ours);
    }
    const astra = createEngine().skillCard(createEngine().pairings('lucina')[0]!, 'astra', { context: 'main-story', dlc: false });
    expect(astra.sourceCalls[0]).toMatchObject({ context: 'Main story', ours: 'B', source: 'Ellery', call: 'partly adopted' });
  });
});
