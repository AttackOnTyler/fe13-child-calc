/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { GUIDE_TARGETS } from './guide';
import { DEEPER } from './guide-deeper';
import { JUST_EXPLORE, PLAN_A_RUN } from './guide-welcome';

/** The UI source, read as text: no DOM needed. The guide's own files only point at anchors, never carry them. */
const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts', '!./guide.ts', '!./guide-*.ts'], { query: '?raw', import: 'default', eager: true });

/** Comments dropped, so an anchor only counts where it's code. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Each target a `guide('x')` call registers in the UI source, with the files it's in. */
const anchored = new Map<string, string[]>();
for (const [file, src] of Object.entries(sources))
  for (const m of code(src).matchAll(/\bguide\('([^']+)'\)/g)) anchored.set(m[1]!, [...(anchored.get(m[1]!) ?? []), file]);

describe('guide anchors', () => {
  it('reads the UI source', () => {
    expect(Object.keys(sources)).toContain('./main.ts');
    expect(Object.keys(sources)).not.toContain('./guide-ui.ts');
  });

  it.each(GUIDE_TARGETS)('anchors %s on a control', (target) => {
    expect([...anchored.keys()]).toContain(target);
  });
});

describe('every guide entry points at an existing control (#213)', () => {
  const entries = [
    ...DEEPER.map((e) => [`Going deeper: ${e.question}`, e.jump.target] as const),
    ...PLAN_A_RUN.steps.map((s) => [`Plan a run: ${s.title}`, s.target] as const),
    [`Just explore`, JUST_EXPLORE.target] as const,
  ];

  it.each(entries)('%s → %s', (_entry, target) => {
    expect(anchored.get(target), `no guide('${target}') call in src/ui`).toBeDefined();
  });

  it('where the jump lands: the Run view’s own controls on the Run view, the Wishlist tab’s on it', () => {
    const where = (target: string) => anchored.get(target) ?? [];
    expect(where('inbox')).toEqual(['./inbox.ts']);
    expect(where('robin-card')).toEqual(['./run-page.ts']);
    expect(where('flawless-headline')).toEqual(['./run-page.ts']);
    expect(where('wishlist-army')).toEqual(['./wishlist-page.ts']);
    expect(where('run-facts')).toEqual(['./roster-page.ts']);
  });
});
