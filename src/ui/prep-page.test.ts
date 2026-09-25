import { describe, expect, it } from 'vitest';
import { fighterOf } from './prep-page';

const unit = {
  class: 'Great Knight',
  level: 1,
  promoted: true,
  reclassed: false,
  exp: 0,
  stats: { hp: 28, str: 13, mag: 2, skl: 12, spd: 10, lck: 6, def: 14, res: 3 },
  skills: ['Discipline'],
  inventory: [
    { item: 'Vulnerary', uses: 3 },
    { item: 'Silver Lance', uses: 20 },
    { item: 'Steel Sword', uses: 30, forge: { name: 'Kiri', mt: 2, hit: 10, crit: 0 } },
  ],
  supports: [
    { partner: 'sully' as const, rank: 'C' as const },
    { partner: 'cordelia' as const, rank: 'A' as const },
  ],
};

describe('the preparation page’s fighters', () => {
  it('take a unit’s weapons from its inventory, with forges, skipping items', () => {
    const f = fighterOf('Frederick', unit)!;
    expect(f.weapons.map((w) => w.item.name)).toEqual(['Silver Lance', 'Steel Sword']);
    expect(f.weapons[1]!.forge).toEqual({ mt: 2, hit: 10, crit: 0 });
    expect(fighterOf('Nobody', { ...unit, stats: null })).toBeUndefined();
  });

});
