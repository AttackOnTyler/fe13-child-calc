import { describe, expect, it } from 'vitest';
import { BUILD_TEMPLATES } from '../curated/builds';
import { CONFLICTS, SYNERGIES } from '../curated/synergies';
import { SOURCES, SOURCE_IDS } from '../curated/sources';
import { createEngine } from './index';

const known = new Set<string>(Object.keys(SOURCES));

describe('the source registry', () => {
  it('holds S1–S9, each with a name, kind, link and provenance under its own ID', () => {
    expect([...SOURCE_IDS]).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
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
