import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_ROSTER,
  EMPTY_RUN,
  addEntry,
  dismissMigrationNote,
  exportRun,
  importRun,
  latestEntry,
  rosterOf,
  runFromRoster,
  withPin,
  withRuleOut,
  withRun,
  withSpouse,
  withState,
  type Run,
} from '../engine';
import { clearRoster, hasSavedRoster, loadRun, saveRun } from './roster-store';

/**
 * `run:v2` in storage (#205): the one run, migrated once from `run:v1` and `plan:v1` with its migration note, `run:v1`
 * kept untouched as a backup, Clear all, and the run file's export and import.
 */
const RUN_V1 = 'fe13-child-calc:run:v1';
const RUN_V2 = 'fe13-child-calc:run:v2';
const PLAN_V1 = 'fe13-child-calc:plan:v1';
const ROSTER_V1 = 'fe13-child-calc:roster:v1';

const facts = withRun(EMPTY_ROSTER, { gender: 'M', asset: 'mag', flaw: 'hp', difficulty: 'normal', mode: 'classic', route: 'main-story' });
// A `run:v1` roster: a pinned marriage, one broken by a death, a rule-out, a Benched unit, and (fields `run:v2` no
// longer has, #212: added to the file below) Deploy flags, the adopted plan and a deployment role.
const roster = [
  (r: typeof facts) => withSpouse(r, 'chrom', 'sumia', 'pinned'),
  (r: typeof facts) => withSpouse(r, 'gaius', 'maribelle', 'pinned'),
  (r: typeof facts) => withState(r, 'maribelle', 'dead'),
  (r: typeof facts) => withSpouse(r, 'vaike', 'cordelia', 'married'),
  (r: typeof facts) => withRuleOut(r, 'lonqu', 'olivia', true),
  (r: typeof facts) => withState(r, 'stahl', 'benched'),
].reduce((r, f) => f(r), facts);
const v1Run: Run = addEntry(addEntry(runFromRoster(roster), 'prologue', 1), 'chapter-1', 2);
/** As `run:v1` held it. */
const exported = JSON.parse(exportRun(v1Run));
const v1 = {
  ...exported,
  version: 1,
  roster: {
    ...exported.roster,
    deploy: { frederick: false, kellam: true },
    savedPlan: { robin: null, marriages: [['chrom', 'sumia']] },
    deployRoles: { miriel: 'staff' },
  },
};
const plan = {
  priorities: { lucina: 3, owain: 2, inigo: 0, kjelle: 1, nah: 2 },
  overrides: { kjelle: 'lancekiller' },
  roleOverrides: { owain: 'battery' },
  quotas: { 'main-story': { cap: 12, roles: {} } },
  acts: { prioritiesSetAt: 5 },
};

describe('run:v2 in storage (#205)', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty for a new visitor, and saves nothing by reading', () => {
    expect(loadRun()).toEqual(EMPTY_RUN);
    expect(hasSavedRoster()).toBe(false);
    expect(store.size).toBe(0);
  });

  describe('migrated once from run:v1 and plan:v1', () => {
    beforeEach(() => {
      store.set(RUN_V1, JSON.stringify(v1));
      store.set(PLAN_V1, JSON.stringify(plan));
    });

    it('turns pinned marriages and rule-outs into marriage pins, an unticked Deploy or a Bench into keep-outs', () => {
      const run = loadRun();
      expect(run.version).toBe(2);
      expect(run.pins).toEqual([
        { kind: 'marriage', couple: ['chrom', 'sumia'] },
        { kind: 'marriage', couple: ['lonqu', 'olivia'], forbid: true },
        { kind: 'keep', unit: 'frederick', keep: 'out' },
        { kind: 'keep', unit: 'stahl', keep: 'out' },
      ]);
      // The roster keeps only its facts: no pinned bonds, no Benched, no rule-outs, adopted plan, Deploy flags or roles.
      const now = rosterOf(run);
      expect(now.run).toEqual(facts.run);
      expect(now.spouses).toEqual({ vaike: { partner: 'cordelia', bond: 'married' }, cordelia: { partner: 'vaike', bond: 'married' } });
      expect(now.states).toEqual({ maribelle: 'dead' });
      expect(now.ruleOuts).toEqual([]);
      for (const gone of ['savedPlan', 'deploy', 'deployRoles']) expect(now).not.toHaveProperty(gone);
      // The chapter log comes across as it was.
      expect(run.entries.map((e) => [e.id, e.map, e.createdAt])).toEqual(v1Run.entries.map((e) => [e.id, e.map, e.createdAt]));
      expect(latestEntry(run)!.snapshot.units).toEqual(latestEntry(v1Run)!.snapshot.units);
    });

    it('writes a migration note: what was kept, what was dropped, and keep-ins for the former priorities', () => {
      expect(loadRun().migration).toEqual({
        kept: ['Marriage pin: Chrom and Sumia', "Rule-out: Lon'qu and Olivia", 'Keep-out: Frederick (Deploy unticked)', 'Keep-out: Stahl (Benched)'],
        dropped: [
          'Marriage pin: Gaius and Maribelle (broken: Maribelle is dead)',
          'Deploy ticked: Kellam',
          'The adopted marriage plan',
          'Deployment roles: Miriel',
          'Priorities: Lucina 3, Owain 2, Inigo 0, Kjelle 1, Nah 2',
          'Preset overrides: Kjelle',
          'Role overrides: Owain',
          'Composition quotas: Main story',
        ],
        keepIn: ['lucina', 'owain', 'nah'],
      });
    });

    it('happens once: run:v2 is saved, run:v1 and plan:v1 stay untouched, and a dismissed note stays dismissed', () => {
      const before = [store.get(RUN_V1), store.get(PLAN_V1)];
      const run = loadRun();
      expect(JSON.parse(store.get(RUN_V2)!)).toEqual(JSON.parse(JSON.stringify(run)));
      expect([store.get(RUN_V1), store.get(PLAN_V1)]).toEqual(before);
      // An edit on v2 isn't undone by migrating again.
      saveRun(dismissMigrationNote(withPin(run, { kind: 'keep', unit: 'lucina', keep: 'in' })));
      const again = loadRun();
      expect(again.migration).toBeUndefined();
      expect(again.pins).toContainEqual({ kind: 'keep', unit: 'lucina', keep: 'in' });
      expect([store.get(RUN_V1), store.get(PLAN_V1)]).toEqual(before);
    });

    it('keeps pins already on the run:v1 (#200), which win over the same choice migrated', () => {
      store.set(RUN_V1, JSON.stringify({ ...v1, pins: [{ kind: 'keep', unit: 'frederick', keep: 'in' }, { kind: 'span', unit: 'chrom', position: 'lead', from: 'chapter-2' }] }));
      const pins = loadRun().pins!;
      expect(pins).toContainEqual({ kind: 'keep', unit: 'frederick', keep: 'in' });
      expect(pins).not.toContainEqual({ kind: 'keep', unit: 'frederick', keep: 'out' });
      expect(pins).toContainEqual({ kind: 'span', unit: 'chrom', position: 'lead', from: 'chapter-2' });
    });
  });

  it('writes no note when there was nothing to keep or drop', () => {
    const plain = addEntry(runFromRoster(facts), 'prologue', 1);
    store.set(RUN_V1, JSON.stringify({ ...JSON.parse(exportRun(plain)), version: 1 }));
    const run = loadRun();
    expect(run.migration).toBeUndefined();
    expect(run).toEqual(plain);
  });

  it('migrates a roster from before the chapter log too', () => {
    store.set(ROSTER_V1, JSON.stringify(withSpouse(facts, 'chrom', 'sumia', 'pinned')));
    expect(hasSavedRoster()).toBe(true);
    const run = loadRun();
    expect(run.pins).toEqual([{ kind: 'marriage', couple: ['chrom', 'sumia'] }]);
    expect(run.migration!.kept).toEqual(['Marriage pin: Chrom and Sumia']);
    expect(rosterOf(run).run).toEqual(facts.run);
  });

  it('Clear all wipes run:v2, and never brings run:v1 back', () => {
    store.set(RUN_V1, JSON.stringify(v1));
    const run = loadRun();
    expect(run.entries).toHaveLength(3);
    clearRoster();
    expect(loadRun()).toEqual(EMPTY_RUN);
    expect(store.get(RUN_V1)).toEqual(JSON.stringify(v1));
  });

  it('exports and imports run:v2 as it is; a file from before is migrated', () => {
    store.set(RUN_V1, JSON.stringify(v1));
    const run: Run = {
      ...loadRun(),
      dismissedProposals: ['p1'],
      dismissedChanges: ['e2'],
      corrections: { units: { chrom: 1.2, frederick: 0.8 }, off: true },
      calibration: [{ entry: 'e2', unit: 'chrom', percentile: 0.4 }],
    };
    expect(importRun(exportRun(run))).toEqual(run);
    saveRun(run);
    expect(loadRun()).toEqual(run);
    // A file exported before run:v2 is migrated as it's read (no plan:v1 in a file).
    const old = importRun(JSON.stringify(v1));
    expect(old.pins).toEqual(run.pins);
    expect(old.migration!.dropped).not.toContain('Role overrides: Owain');
  });

  it('reads junk in the v2 fields as absent, and corrections clamped', () => {
    const run = importRun(
      JSON.stringify({
        ...JSON.parse(exportRun(EMPTY_RUN)),
        dismissedProposals: ['p1', 3, 'p1'],
        corrections: { units: { chrom: 9, vaike: 'x' } },
        calibration: [{ entry: 'e1', unit: 'chrom', percentile: 2 }, 'x'],
        migration: { kept: 'x' },
      }),
    );
    expect(run).toEqual({ ...EMPTY_RUN, dismissedProposals: ['p1'], corrections: { units: { chrom: 2 } } });
  });

  it('gives an empty run when storage is corrupt or blocked', () => {
    store.set(RUN_V2, '{not json');
    expect(loadRun()).toEqual(EMPTY_RUN);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadRun()).toEqual(EMPTY_RUN);
    expect(() => saveRun(EMPTY_RUN)).not.toThrow();
    expect(() => clearRoster()).not.toThrow();
    expect(hasSavedRoster()).toBe(false);
  });
});
