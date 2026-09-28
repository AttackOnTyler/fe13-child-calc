/** The Prepare page's position plan (#266) and its held-back note (#248), on the Lunatic Prologue. */
import { describe, expect, it } from 'vitest';
import { enemyPhase, forecast, leads, liveEnemies, playerById, replay, solvePositions, type Board, type PositionEvent } from '../engine';
import { prologueBoard } from '../engine/board/prologue-fixture';
import { compare, fightAs, forecastText, headline, heldBackNotes, turnLine } from './position-plan';

const name = (id: string) => id[0]!.toUpperCase() + id.slice(1);

describe('the position plan’s loop (#266)', () => {
  it('plays the Prologue end to end, from turn 1 to the rout, with 2 taps per turn played as forecast', () => {
    const start = prologueBoard();
    const events: PositionEvent[] = [];
    let taps = 0;
    let turns = 0;
    let rout = 0;
    for (; turns < 12; turns++) {
      const { board, acted } = replay(start, events);
      // The last foe fell on the enemy phase before.
      if (!liveEnemies(board).length) {
        rout = board.turn - 1;
        break;
      }
      // As the page asks: 3 detailed turns (the outline isn't needed to play).
      const plan = solvePositions(board, { acted, outlineCap: 0 });
      expect(plan.turns[0]!.safety.safe).toBe(true);
      // Tap 1: ✓ Played as planned. Tap 2: ✓ As predicted.
      events.push(...plan.turns[0]!.actions.map((action) => ({ kind: 'act' as const, action })));
      taps++;
      const after = replay(start, events).board;
      if (!liveEnemies(after).length) {
        rout = after.turn;
        break;
      }
      events.push({ kind: 'enemy', actions: enemyPhase(after).actions });
      taps++;
    }
    const end = replay(start, events).board;
    expect(liveEnemies(end)).toHaveLength(0);
    expect(end.players.every((p) => p.hp > 0)).toBe(true);
    expect(rout).toBeGreaterThan(0);
    expect(rout).toBeLessThanOrEqual(7);
    expect(taps).toBeLessThanOrEqual(2 * rout);
  });

  it('replays a correction: a unit put on its real tile, and an HP set by hand', () => {
    const start = prologueBoard();
    const { board } = replay(start, [
      { kind: 'place', unit: 'robin', to: [5, 14] },
      { kind: 'hp', unit: 'robin', hp: 7 },
    ]);
    expect(leads(board).find((p) => p.id === 'robin')).toMatchObject({ at: [5, 14], hp: 7 });
  });
});

describe('the headline and the held-back note (#248)', () => {
  // Attempt 1's T2: the pair at (2,12), Lissa (2,14), Robin (3,14), after its EP1.
  const t1 = prologueBoard({ frederick: [2, 12], lissa: [2, 14], robin: [3, 14] }, { frederick: 'chrom' });
  const t2: Board = { ...enemyPhase(t1).board, turn: 2 };
  const plan = solvePositions(t2, { turns: 1, outlineCap: 0 });

  it('says when the stance plan’s held-back units can’t all stay out of reach, and on which turn', () => {
    // The play's stance plan on the Prologue: T2 Separate, Frederick fighting and the rest apart, held back.
    const notes = heldBackNotes(plan, [{ turn: 2, units: ['chrom', 'robin', 'lissa'] }]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ turn: 2 });
    const head = headline(plan, notes, name, 'about 6 turns');
    expect(head.lines.at(-1)).toMatch(/^The stance plan holds .+ back on T2, but no formation keeps them all out of reach there .+ The play’s no-death chance assumes it anyway; this plan doesn’t\.$/);
    // Held back on turn 1 is fine: no note.
    expect(heldBackNotes(solvePositions(prologueBoard(), { turns: 1, outlineCap: 0 }), [{ turn: 1, units: ['robin', 'lissa'] }])).toEqual([]);
  });

  it('reads the hard line, the crit risk and the rout turn', () => {
    const full = solvePositions(prologueBoard());
    const head = headline(full, [], name, 'about 6 turns');
    expect(head).toMatchObject({ ok: true, verdict: 'No death without a crit' });
    expect(head.lines[0]).toMatch(/^Crit risk over the next 3 turns: /);
    expect(head.lines[1]).toBe(`Rout on turn ${full.routTurn} (the play: about 6 turns)`);
    expect(turnLine(full.turns[0]!, name)).toMatch(/^T1 · ✓ safe/);
    const attack = full.turns[0]!.actions.find((a) => a.forecast)!;
    expect(forecastText(attack)).toMatch(/^\d+×\d at \d+%, crit \d+%/);
  });

  it('compares a tried move with the plan: better, worse, same', () => {
    const b = prologueBoard();
    const base = solvePositions(b, { turns: 1, outlineCap: 0 });
    // Robin walks up alone into the south's reach: worse on the hard line.
    const pinned = { unit: 'robin', from: [4, 14] as const, to: [5, 12] as const, command: { kind: 'wait' as const }, why: '' };
    const mine = solvePositions(b, { turns: 1, outlineCap: 0, pinned });
    const c = compare(mine, base, name);
    expect(c.good.length + c.bad.length + c.same.length).toBeGreaterThan(5);
    expect(c.same.some((x) => x.startsWith('Wakes'))).toBe(true);
    const self = compare(base, base, name);
    expect(self.good).toEqual([]);
    expect(self.bad).toEqual([]);
  });

  it('leaves a pair riding together out of the check: a held-back back with its lead held back too', () => {
    const notes = heldBackNotes(solvePositions(t2, { turns: 1, outlineCap: 0 }), [{ turn: 2, units: ['frederick', 'chrom'] }]);
    for (const n of notes) expect(n.units).not.toContain('chrom');
  });
});

describe('fixing an enemy attack (#274)', () => {
  // EP1 of attempt 2: a Barbarian attacks Frederick (Robin behind) on (8,12); Frederick's counter crits and kills it.
  const b = prologueBoard({ frederick: [8, 12] }, { frederick: 'robin' });
  const barb = liveEnemies(b).find((e) => e.foe.className === 'Barbarian' && !e.boss)!;
  const from = [8, 11] as const;
  const m = forecast(b, playerById(b, 'frederick')!, barb, [8, 12], from);

  it('hit and missed play every strike of that side, or none', () => {
    const r = fightAs(b, barb.id, 'frederick', from, 'missed', 'hit');
    expect(r.targetHp).toBe(28);
    expect(r.enemyHp).toBe(Math.max(0, barb.hp - m.damage * (m.doubles ? 2 : 1)));
  });

  it('a crit counter triples its first strike; “killed it” sets the foe to 0 whatever the numbers', () => {
    const crit = fightAs(b, barb.id, 'frederick', from, 'missed', 'crit');
    expect(crit.enemyHp).toBe(Math.max(0, barb.hp - m.damage * 3 - (m.doubles ? m.damage : 0)));
    expect(fightAs(b, barb.id, 'frederick', from, 'hit', 'killed').enemyHp).toBe(0);
  });

  it('its crit triples its first strike; “killed” puts the unit at 0', () => {
    const r = fightAs(b, barb.id, 'frederick', from, 'crit', 'missed');
    expect(r.targetHp).toBe(Math.max(0, 28 - m.worstHit * 3 - (m.doubled ? m.worstHit : 0)));
    expect(fightAs(b, barb.id, 'frederick', from, 'killed', 'missed').targetHp).toBe(0);
  });
});
