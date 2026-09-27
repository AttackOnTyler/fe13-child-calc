/**
 * In-play checks on the pages (#209; spec #175, In-play checks and stated assumptions): the stakes the worker works out
 * for each open rule on the adopted plan (one re-run under its other reading, kept per run and plan) and the setup
 * checks they call for; the checks a map offers, in words, for the inbox and the preparation page; Record results'
 * Checks step, which takes each check's raw observation and settles it through the engine; and the open rules list
 * (stakes first) in words, which the Why panel's stated assumptions tab (#211, `stated-assumptions.ts`) draws, where
 * any rule is answered by hand or reopened.
 *
 * Checked rules are global (`checked-rules.ts`): a change goes to main.ts (`setRules`), which rebuilds the model,
 * relearns the learned corrections from the chapter log and re-solves when the model reads the rule differently.
 */
import {
  EDIT_COST_BUDGET,
  FLAWLESS_SEED,
  openRule,
  withCheckObserved,
  type Assumptions,
  type CheckAsk,
  type CheckOutcome,
  type CheckedRules,
  type Deployment,
  type EditCost,
  type Engine,
  type EntryCheck,
  type MapCheck,
  type Observation,
  type Plan,
  type PlanLineup,
  type RuleEvidence,
  type RuleStake,
  type RuleStatus,
  type Run,
  type RunEntry,
  type SetupCheck,
} from '../engine';
import { differenceText } from './chance';
import { h } from './dom';
import { startSolve } from './solve-client';

// ---- stakes and setup checks, from the worker ------------------------------------------------------------------------

export type ChecksProgress = {
  readonly stakes: readonly RuleStake[];
  /** The setup checks the stakes call for, once every stake is in. */
  readonly setup?: readonly SetupCheck[];
  /** Each setup check's edit cost as last read, by rule. */
  readonly costs: ReadonlyMap<string, EditCost>;
  readonly done: boolean;
};

const PLAN_KEYS = new WeakMap<Plan, string>();
const planKey = (p: Plan) => {
  let k = PLAN_KEYS.get(p);
  if (k === undefined) PLAN_KEYS.set(p, (k = JSON.stringify(p)));
  return k;
};
/** The rules' part of the key: stakes and setup checks change when an answer does (the model, and which rules are open). */
const rulesKey = (rules: CheckedRules) => JSON.stringify([rules.answers, rules.mismatches.map((m) => m.rule)]);

const PROGRESS = new WeakMap<Run, Map<string, ChecksProgress>>();
let latest: ChecksProgress | undefined;
const listeners = new Set<() => void>();

/** Calls `f` whenever the checks' stakes or setup checks move on; returns the unsubscribe. */
export function onChecksProgress(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Where the checks stand for a run, plan and rules; undefined until asked (`askChecks`). */
export function checksProgress(run: Run, plan: Plan, rules: CheckedRules): ChecksProgress | undefined {
  return PROGRESS.get(run)?.get(`${rulesKey(rules)}|${planKey(plan)}`);
}

function hold(run: Run, plan: Plan, rules: CheckedRules, progress: ChecksProgress): void {
  let byRun = PROGRESS.get(run);
  if (!byRun) PROGRESS.set(run, (byRun = new Map()));
  byRun.set(`${rulesKey(rules)}|${planKey(plan)}`, progress);
}

/** Keeps where the checks stand for a run, plan and rules (the worker's replies land here), and tells the listeners. */
export function setChecksProgress(run: Run, plan: Plan, rules: CheckedRules, progress: ChecksProgress): void {
  hold(run, plan, rules, progress);
  latest = progress;
  for (const f of listeners) f();
}

/** The stakes worked out last, whichever run and plan (the open rules list reads them). */
export const latestStakes = (): readonly RuleStake[] => latest?.stakes ?? [];

/**
 * Asks the worker (its `checks` slot) for the stakes of each open rule on `plan`, then the setup checks, once per run,
 * plan and rules. Where there's no Worker (tests) nothing is worked out: the checks list without stakes.
 */
export function askChecks(ctx: { readonly assumptions?: Assumptions; readonly run: Run }, plan: Plan, rules: CheckedRules): void {
  if (!ctx.assumptions || checksProgress(ctx.run, plan, rules)) return;
  let p: ChecksProgress = { stakes: [], costs: new Map(), done: false };
  hold(ctx.run, plan, rules, p);
  const set = (next: ChecksProgress) => setChecksProgress(ctx.run, plan, rules, (p = next));
  const started = startSolve(
    { kind: 'checks', assumptions: ctx.assumptions, run: ctx.run, seed: FLAWLESS_SEED, plan, rules, budgets: [EDIT_COST_BUDGET.provisional, EDIT_COST_BUDGET.settled] },
    (reply) => {
      if (reply.kind === 'stake') set({ ...p, stakes: [...p.stakes.filter((s) => s.rule !== reply.stake.rule), reply.stake] });
      else if (reply.kind === 'setup') set({ ...p, setup: reply.checks, done: reply.done });
      else if (reply.kind === 'setup-cost') set({ ...p, costs: new Map([...p.costs, [reply.rule, reply.cost]]), done: reply.done });
    },
    'checks',
  );
  if (!started) hold(ctx.run, plan, rules, { ...p, done: true });
}

// ---- words -----------------------------------------------------------------------------------------------------------

const points = (x: number) => (Math.abs(x) * 100).toFixed(1);

/** A rule's stakes in words: "stakes 2.1 ±0.8 points", none where the model doesn't read it, pending until worked out. */
export function stakeText(stake: RuleStake | undefined): string {
  if (!stake) return 'stakes being worked out';
  if (!stake.modelled) return 'no stakes: the model doesn’t read it';
  return `stakes ${points(stake.gain)} ±${points(stake.margin)} points`;
}

/** What a check asks for, in words: "EXP from one Rally (0 if no EXP bar appears)", "Did the back gain any EXP?". */
export const askText = (a: CheckAsk) => a.question;

/** A free check as the inbox and the preparation page list it: what to do and note, and its stakes. */
export const checkRow = (c: MapCheck): { readonly key: string; readonly text: string } => ({ key: `check:${c.rule}`, text: `${c.label}: ${c.text} (${stakeText(c.stake)})` });

/** The map's lineup as the checks read it, from a lineup the page has (a forecast's deployment). */
export const lineupOf = (key: string, d: Deployment): PlanLineup => ({ key, pairs: d.pairs.map((p) => ({ lead: p.lead, ...(p.back ? { back: p.back } : {}) })), solo: [...d.solo] });

/** The setup checks as the inbox lists them: the rule, its stakes, the edit that sets it up and what it costs. */
export function setupRows(progress: ChecksProgress | undefined): { readonly key: string; readonly text: string; readonly edit?: { readonly label: string; readonly plan: Plan; readonly cost?: EditCost } }[] {
  return (progress?.setup ?? []).map((c) => {
    const cost = progress!.costs.get(c.rule);
    const costWords = !c.edit ? '' : cost ? `; the edit costs ${differenceText(cost.gain, cost.margin, cost.verdict === 'close' || cost.verdict === 'unclear')} points${cost.settled ? '' : ', provisional'}` : '; costing the edit…';
    return {
      key: `setup:${c.rule}`,
      text: c.edit ? `${c.label} (${stakeText(c.stake)}): ${c.edit.label} sets it up${costWords}` : `${c.label} (${stakeText(c.stake)}): no single edit sets it up; answer it by hand if you know it`,
      ...(c.edit ? { edit: { label: `Set up a check: ${c.edit.label}`, plan: c.edit.plan, ...(cost ? { cost } : {}) } } : {}),
    };
  });
}

const STATE_WORDS = { open: 'open', checked: 'checked in play', answered: 'answered by hand', mismatch: 'model mismatch' } as const;

export type RuleRow = {
  readonly id: string;
  readonly label: string;
  /** "open · stakes 2.1 ±0.8 points" / "checked in play: Spends a use (the series rule)". */
  readonly status: string;
  readonly notes: readonly string[];
  readonly why: string;
  readonly best: string;
  readonly other: string;
  /** Answer by hand (open or a mismatch), reopen (answered or checked). */
  readonly can: 'answer' | 'reopen';
};

const evidenceText = (e: RuleEvidence | undefined, label: (map: string) => string) => (e ? [e.run, e.map && label(e.map)].filter(Boolean).join(', ') : '');
const observedText = (v: number | boolean) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

/**
 * The open rules list (spec: the stated assumptions' open rules by stakes, model mismatches, then checked rules): open
 * rules first, the highest stakes first, then mismatches, then rules answered or checked.
 */
export function rulesReadout(statuses: readonly RuleStatus[], stakes: readonly RuleStake[], label: (map: string) => string = (m) => m): { readonly open: readonly RuleRow[]; readonly mismatches: readonly RuleRow[]; readonly settled: readonly RuleRow[] } {
  const s = new Map(stakes.map((x) => [x.rule, x]));
  const row = (st: RuleStatus): RuleRow => {
    const r = st.rule;
    const reading = st.reading === 'best' ? r.best.label : r.other.label;
    const status =
      st.state === 'open'
        ? `open (${r.best.label} until checked) · ${stakeText(s.get(r.id))}${st.unexpected.length ? ' · unexpected' : ''}`
        : st.state === 'mismatch'
          ? `model mismatch: play agreed with neither reading twice; forecasts keep ${r.best.label}`
          : `${STATE_WORDS[st.state]}: ${reading}${st.reading === 'other' ? ' (the model switched)' : ''}`;
    const notes = [
      ...st.unexpected.map((u) => `Seen ${observedText(u.value)}, which neither reading predicts${u.evidence ? ` (${evidenceText(u.evidence, label)})` : ''}`),
      ...(st.mismatch ? [`Seen ${st.mismatch.value !== undefined ? observedText(st.mismatch.value) : 'the same'} twice${st.mismatch.evidence.length ? ` (${st.mismatch.evidence.map((e) => evidenceText(e, label)).join('; ')})` : ''}`] : []),
      ...(st.answer?.evidence ? [`${st.answer.how === 'check' ? 'Seen on' : 'Answered during'} ${evidenceText(st.answer.evidence, label)}`] : []),
    ];
    return { id: r.id, label: r.label, status, notes, why: r.why, best: r.best.label, other: r.other.label, can: st.state === 'open' || st.state === 'mismatch' ? 'answer' : 'reopen' };
  };
  const open = statuses.filter((x) => x.state === 'open').sort((a, b) => Math.abs(s.get(b.rule.id)?.gain ?? 0) - Math.abs(s.get(a.rule.id)?.gain ?? 0));
  return { open: open.map(row), mismatches: statuses.filter((x) => x.state === 'mismatch').map(row), settled: statuses.filter((x) => x.state === 'checked' || x.state === 'answered').map(row) };
}

/** What settling an observation did, in words. */
export function outcomeText(rule: string, outcome: CheckOutcome | undefined): string {
  const r = openRule(rule);
  if (!r || !outcome) return '';
  switch (outcome) {
    case 'checked':
      return `Checked: ${r.best.label}. Settled for every run from now on.`;
    case 'switched':
      return `Play says ${r.other.label}: the model reads it now, and the plan is re-solved (its proposals arrive in the inbox).`;
    case 'unexpected':
      return 'Neither reading predicts that: the rule stays open, marked unexpected.';
    case 'mismatch':
      return `The same unexpected value again: a model mismatch, listed as a blind spot. Forecasts keep ${r.best.label}.`;
    case 'none':
      return 'Didn’t happen: the rule stays open.';
  }
}

/** Record results' Checks step, read: each check this map offered, what it asks, and what its observation did. */
export function checksStepReadout(entry: RunEntry): { readonly rows: readonly { readonly rule: string; readonly label: string; readonly text: string; readonly ask: CheckAsk; readonly observed?: Observation; readonly outcome: string }[]; readonly note: string } {
  const rows = (entry.checks ?? []).flatMap((c: EntryCheck) => {
    const r = openRule(c.rule);
    return r ? [{ rule: c.rule, label: r.label, text: c.text, ask: r.ask, ...(c.observed !== undefined ? { observed: c.observed } : {}), outcome: outcomeText(c.rule, c.outcome) }] : [];
  });
  return {
    rows,
    note: rows.length
      ? 'Only the checks this map offered. Type what you saw (or yes or no); the tool works out which reading it supports. “Didn’t happen” leaves the rule open.'
      : 'This map offered no checks.',
  };
}

// ---- the page's parts -------------------------------------------------------------------------------------------------

/** What changing the checked rules takes: the engine, the run (evidence), and main.ts's `setRules`. */
export type RulesContext = {
  readonly engine: Engine;
  readonly run: Run;
  readonly rules: CheckedRules;
  readonly setRules: (rules: CheckedRules) => void;
  readonly evidence: RuleEvidence | undefined;
  readonly now: () => number;
};

/** Record results' Checks step (#209): each check this map offered takes its raw observation or "didn't happen". */
export function checksStep(ctx: RulesContext & { readonly setRun: (run: Run) => void }, entry: RunEntry): HTMLElement[] {
  const read = checksStepReadout(entry);
  const observe = (rule: string, observed: Observation) => {
    const { rules, outcome } = ctx.engine.settleCheck(ctx.rules, rule, observed, ctx.evidence, ctx.now());
    // The entry keeps what was seen first; the rules change after (they may rebuild the model and re-solve).
    ctx.setRun(withCheckObserved(ctx.run, entry.id, rule, observed, outcome));
    if (rules !== ctx.rules) ctx.setRules(rules);
  };
  return [
    h('p', { class: 'muted small' }, read.note),
    ...read.rows.map((r) => {
      let typed = '';
      const answered = r.observed !== undefined;
      return h(
        'div',
        { class: 'banner check', 'data-rule': r.rule },
        h('b', {}, r.label),
        h('div', { class: 'small' }, r.text),
        answered
          ? h('div', { class: 'small' }, `Seen: ${r.observed === 'didnt-happen' ? 'didn’t happen' : observedText(r.observed as number | boolean)}. ${r.outcome}`)
          : h(
              'div',
              { class: 'row small' },
              h('span', {}, askText(r.ask)),
              ...(r.ask.kind === 'number'
                ? [
                    h('input', { type: 'number', 'aria-label': r.ask.question, oninput: (e: Event) => (typed = (e.target as HTMLInputElement).value) }),
                    h('button', { class: 'mini', onclick: () => typed.trim() !== '' && Number.isFinite(Number(typed)) && observe(r.rule, Number(typed)) }, 'Record'),
                  ]
                : [h('button', { class: 'mini', onclick: () => observe(r.rule, true) }, 'Yes'), h('button', { class: 'mini', onclick: () => observe(r.rule, false) }, 'No')]),
              h('button', { class: 'mini ghost', onclick: () => observe(r.rule, 'didnt-happen') }, 'Didn’t happen'),
            ),
      );
    }),
  ];
}
