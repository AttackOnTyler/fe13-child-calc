import { describe, expect, it } from 'vitest';
import { createEngine } from '../engine';
import { waveLines } from './maps-page';

const engine = createEngine();

describe('the Maps page’s reinforcements (#178)', () => {
  it('lists a map’s waves by turn on the difficulty shown', () => {
    expect(waveLines(engine.mapWaves('chapter-5', 'lunatic').waves)).toEqual([
      {
        when: 'Turn 3',
        groups: [
          '1 Barbarian with Steel Axe, from the southwestern fort',
          '1 Barbarian dropping Hand Axe, from the western fort (On Lunatic, this Barbarian is equipped with a Short Axe alongside the drop)',
          '1 Myrmidon, from the northern center fort',
        ],
      },
      { when: 'Turn 4', groups: ['2 Wyvern Riders, from the northwest forts'] },
      {
        when: 'Turn 5',
        groups: ['1 Dark Mage, from the southwestern fort', '1 Myrmidon, from the western fort', '1 Barbarian with Steel Axe, from the northern center fort', '2 Wyvern Riders, one from the upper northwest fort, and one from the northeast fort'],
      },
    ]);
  });

  it('says when turn ranges, unlimited and conditional waves come', () => {
    expect(waveLines(engine.mapWaves('chapter-24', 'lunatic').waves).map((w) => w.when)).toEqual(['Turns 2–5', 'Turns 3–5', 'Turns 4–5', 'Turn 5']);
    expect(waveLines(engine.mapWaves('hot-spring-scramble', 'normal').waves)[0]!.when).toBe('Turns 3, 5');
    expect(waveLines(engine.mapWaves('endgame', 'lunatic').waves)[0]!.when).toBe('Every turn from 2, 8 a turn, of these kinds');
    expect(waveLines(engine.mapWaves('paralogue-10', 'normal').waves)[2]!.when).toBe('On the turn after Severa speaks with Holland');
  });
});
