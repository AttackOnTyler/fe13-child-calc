/** The Prepare page's position plan (#266) and its held-back note (#248), on the Lunatic Prologue. */
import { describe, expect, it } from 'vitest';
import { enemyPhase, forecast, leads, liveEnemies, playerById, replay, solvePositions, type Board, type PositionEvent } from '../engine';
import { prologueBoard } from '../engine/board/prologue-fixture';
import { compare, fightAs, forecastText, headline, heldBackNotes, planAhead, riskBudget, turnLine } from './position-plan';

const name = (id: string) => id[0]!.toUpperCase() + id.slice(1);

describe('the position plan’s loop (#266)', () => {
  it('plays the Prologue as solved from turn 1, 2 taps per turn, and routs on the plan’s turn with nobody dead', () => {
    // Played as planned (every fight as forecast, every enemy phase as predicted) the page never re-solves (#278): the
    // one line from turn 1 is followed to the rout.
    const start = prologueBoard();
    const plan = solvePositions(start, { phaseEnds: 3 });
    expect(plan.routTurn).toBeDefined();
    const events: PositionEvent[] = [];
    let taps = 0;
    for (const t of plan.turns) {
      // Tap 1: ✓ Played as planned. Tap 2: ✓ As predicted.
      events.push(...t.actions.map((action) => ({ kind: 'act' as const, action })));
      taps++;
      const after = replay(start, events).board;
      if (!liveEnemies(after).length) break;
      events.push({ kind: 'enemy', actions: enemyPhase(after).actions });
      taps++;
    }
    const end = replay(start, events).board;
    expect(liveEnemies(end)).toHaveLength(0);
    expect(end.players.every((p) => p.hp > 0)).toBe(true);
    expect(end.turn).toBeLessThanOrEqual(plan.routTurn! + 1);
    expect(taps).toBeLessThanOrEqual(2 * plan.routTurn!);
  }, 120_000);

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
  const plan = solvePositions(t2, { turns: 1 });

  it('says when the stance plan’s held-back units can’t all stay out of reach, and on which turn', () => {
    // The play's stance plan on the Prologue: T2 Separate, Frederick fighting and the rest apart, held back.
    const notes = heldBackNotes(plan, [{ turn: 2, units: ['chrom', 'robin', 'lissa'] }]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ turn: 2 });
    const head = headline(plan, notes, name, 'about 6 turns');
    expect(head.lines.at(-1)).toMatch(/^The stance plan holds .+ back on T2, but no formation keeps them all out of reach there .+ The play’s no-death chance assumes it anyway; this plan doesn’t\.$/);
    // Held back on turn 1 is fine: no note.
    expect(heldBackNotes(solvePositions(prologueBoard(), { turns: 1 }), [{ turn: 1, units: ['robin', 'lissa'] }])).toEqual([]);
  });

  it('reads the hard line, the crit risk and the rout turn', () => {
    // Attempt 1's T2 board, solved to the rout.
    const full = solvePositions(t2, { phaseEnds: 3 });
    const head = headline(full, [], name, 'about 6 turns');
    expect(head).toMatchObject({ ok: true, verdict: `${full.proven ? 'Proven' : 'Best found so far'}: rout on turn ${full.routTurn}` });
    expect(head.lines[0]).toMatch(/^Risk: game over /);
    expect(head.lines[1]).toBe('The play estimated about 6 turns');
    // No rout within the budget: the line that gets furthest, said as such.
    const stalled = headline({ ...full, routTurn: undefined }, [], name, 'about 6 turns');
    expect(stalled).toMatchObject({ ok: false, verdict: 'No rout found within the risk budget: this line gets furthest' });
    expect(turnLine(full.turns[0]!, name)).toMatch(/^T2 · /);
    const attack = full.turns[0]!.actions.find((a) => a.forecast)!;
    expect(forecastText(attack)).toMatch(/^\d+×\d at \d+%, crit \d+%/);
  }, 120_000);

  it('compares a tried move with the plan: better, worse, same', () => {
    const b = prologueBoard();
    const base = solvePositions(b, { turns: 1 });
    // Robin walks up alone into the south's reach: worse on the hard line.
    const pinned = { unit: 'robin', from: [4, 14] as const, to: [5, 12] as const, command: { kind: 'wait' as const }, why: '' };
    const mine = solvePositions(b, { turns: 1, pinned });
    const c = compare(mine, base, name);
    expect(c.good.length + c.bad.length + c.same.length).toBeGreaterThan(5);
    expect(c.same.some((x) => x.startsWith('Wakes'))).toBe(true);
    const self = compare(base, base, name);
    expect(self.good).toEqual([]);
    expect(self.bad).toEqual([]);
  });

  it('leaves a pair riding together out of the check: a held-back back with its lead held back too', () => {
    const notes = heldBackNotes(solvePositions(t2, { turns: 1 }), [{ turn: 2, units: ['frederick', 'chrom'] }]);
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

  it('a unit killed by the first strike lands no counter', () => {
    expect(fightAs(b, barb.id, 'frederick', from, 'killed', 'hit')).toEqual({ targetHp: 0, enemyHp: barb.hp });
  });
});

describe('re-solve on deviation, the budget and the headline (#285)', () => {
  const start = prologueBoard();
  const plan = solvePositions(start, { phaseEnds: 3 });
  const t1 = plan.turns[0]!;

  it('follows the line while play goes as planned, and leaves it on the first deviation', () => {
    const played: PositionEvent[] = [{ kind: 'act', action: t1.actions[0]! }];
    const ahead = planAhead(plan, played)!;
    expect(ahead.turns[0]!.actions).toEqual(t1.actions.slice(1));
    expect(ahead.turns.length).toBe(plan.turns.length);
    // The whole turn, then its enemy phase as predicted: the next turn is up, nothing re-solved.
    const turn: PositionEvent[] = [...t1.actions.map((action) => ({ kind: 'act' as const, action })), { kind: 'enemy', actions: t1.enemy }];
    expect(planAhead(plan, turn)!.turns[0]!.turn).toBe(2);
    // A miss, a fixed enemy phase or a unit put elsewhere leaves the plan.
    expect(planAhead(plan, [{ kind: 'act', action: t1.actions[0]!, outcome: { ours: 'missed' } }])).toBeUndefined();
    expect(planAhead(plan, [...turn.slice(0, -1), { kind: 'enemy', actions: [] }])).toBeUndefined();
    expect(planAhead(plan, [{ kind: 'place', unit: 'robin', to: [5, 14] }])).toBeUndefined();
  }, 120_000);

  it('prices deaths from the run plan when it can, else says it uses the default', () => {
    const b = riskBudget({ frederick: 0.02, lissa: 0.01, chrom: undefined }, 0.6);
    expect(b.worth).toEqual({ frederick: 0.02, lissa: 0.01 });
    // 40% of a death somewhere on the map, at the lineup's mean worth.
    expect(b.budget).toBeCloseTo(0.4 * 0.015, 12);
    expect(b.note).toBe('the run plan’s expected loss on this map');
    // At a 0% run every worth reads about 0: deaths would cost nothing, so the default stands, and says so.
    const flat = riskBudget({ frederick: 0, lissa: 0 }, 0.6);
    expect(flat.worth).toEqual({});
    expect(flat.budget).toBeUndefined();
    expect(flat.note).toMatch(/^default/);
  });

  it('heads the page with the proof, the risk and the budget', () => {
    const head = headline(plan, [], name, 'about 7 turns', 'default');
    expect(head).toMatchObject({ ok: true, verdict: `Proven: rout on turn ${plan.routTurn}` });
    expect(head.lines[0]).toMatch(/^Risk: game over \d/);
    expect(head.lines[0]).toMatch(/expected worth lost .* of 0\.2 \(default\)$/);
    expect(head.lines[1]).toBe('The play estimated about 7 turns');
    expect(headline({ ...plan, proven: false }, [], name).verdict).toBe(`Best found so far: rout on turn ${plan.routTurn}`);
    expect(headline({ ...plan, hardLine: false }, [], name)).toMatchObject({ ok: false, verdict: 'Over the risk budget: this is the least-risk line' });
  });
});
