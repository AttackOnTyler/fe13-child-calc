/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { GUIDE_TARGETS } from './guide';

/** The UI source, read as text: no DOM needed. */
const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts', '!./guide.ts'], { query: '?raw', import: 'default', eager: true });

/** Comments dropped, so an anchor only counts where it's code. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const anchored = new Set(Object.values(sources).flatMap((src) => [...code(src).matchAll(/\bguide\('([^']+)'\)/g)].map((m) => m[1])));

describe('guide anchors', () => {
  it('reads the UI source', () => {
    expect(Object.keys(sources)).toContain('./main.ts');
  });

  it.each(GUIDE_TARGETS)('anchors %s on a control', (target) => {
    expect(anchored).toContain(target);
  });
});
