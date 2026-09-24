// PROTOTYPE — throwaway. Wayfinder ticket "Prototype the guide's form and placement" (#41).
// Four structurally different forms for the in-app usage guide, switchable via `?variant=A|B|C|D`
// on the real app, with a floating switcher. Every load behaves as a first visit (no persistence).
//   A — Guide page: a Guide view is the landing page, two journey cards with numbered steps that jump into the app.
//   B — Guided tour: a welcome picker, then coach marks spotlighting the real controls across views.
//   C — Inline next-step: no separate guide; land on Roster, each view opens with a "What to do here" callout.
//   D — Checklist dock: land on Roster with a docked journey checklist that ticks itself from the real state.
import { h } from './dom';

export type GuideVariant = 'A' | 'B' | 'C' | 'D';
const VARIANTS: readonly GuideVariant[] = ['A', 'B', 'C', 'D'];
const NAMES: Record<GuideVariant, string> = { A: 'Guide page', B: 'Guided tour', C: 'Inline next-step', D: 'Checklist dock' };

export const guideVariant = (): GuideVariant => {
  const v = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  return VARIANTS.includes(v as GuideVariant) ? (v as GuideVariant) : 'A';
};

export type GuideView = 'guide' | 'roster' | 'plan' | 'table' | 'validation';
export type JourneyId = 'fresh' | 'loss';

/** What the prototype reads from, and does to, the real app. */
export type GuideCtx = {
  view: GuideView;
  go: (view: GuideView, child?: string) => void;
  rerender: () => void;
  facts: {
    robinLocked: boolean;
    deployEdited: boolean;
    benched: boolean;
    prioritiesSet: boolean;
    suggested: boolean;
    adopted: boolean;
    lost: boolean;
    married: boolean;
  };
};

type Step = {
  title: string;
  view: 'roster' | 'plan';
  /** A CSS selector, or button text prefixed with `text:`, for the spotlight. */
  target: string;
  body: string;
  done?: (f: GuideCtx['facts']) => boolean;
};

const JOURNEYS: Record<JourneyId, { title: string; ask: string; steps: Step[] }> = {
  fresh: {
    title: 'Plan a fresh run',
    ask: 'I’m starting a run: who should everyone marry?',
    steps: [
      { title: 'Pick your play context', view: 'roster', target: '.topbar .context', body: 'Main story, Lunatic, postgame… It sets the Spd target, whether DLC classes count, and the army quotas. Everything downstream depends on it.' },
      { title: 'Lock Robin — or leave open', view: 'roster', target: '.rsec.run', body: 'If you know your Robin (or Robin’s own marriage is the point), set gender, asset and flaw now. Otherwise leave it open: the plan will pick one, and you lock it at the end.', done: (f) => f.robinLocked },
      { title: 'Tick who you’ll deploy', view: 'roster', target: '.rsec[aria-label="Men"] .deploy', body: 'Tick the first-gen units you’ll field, with their role. These fill the Plan’s quota bar.', done: (f) => f.deployEdited },
      { title: 'Bench who you won’t field', view: 'roster', target: '.rsec[aria-label="Children"] .states', body: '⏸ Bench is soft: a benched child is still planned, just not counted as deployed. It’s the way under the deploy cap.', done: (f) => f.benched },
      { title: 'Set priorities', view: 'plan', target: '.plan-side .prio', body: '0 = don’t care, 3 = must be great. The plan maximises Σ priority × score.', done: (f) => f.prioritiesSet },
      { title: 'Check the quota bar, then Suggest roles', view: 'plan', target: 'text:Suggest roles', body: 'Out-of-range quotas warn, never block. Suggest roles fits children to the quotas; it only rewrites presets still on their default.', done: (f) => f.suggested },
      { title: 'Pin or rule out marriages', view: 'plan', target: 'table.grid.plan', body: '📌 locks a marriage, ✕ forbids it. Free re-plan shows what keeping your pins costs.' },
      { title: 'Adopt the plan', view: 'plan', target: '.adopt', body: 'Adopting saves the plan as your baseline and pins its marriages. Re-plans after a loss compare against it.', done: (f) => f.adopted },
      { title: 'Lock Robin, then make them in-game', view: 'roster', target: '.rsec.run', body: 'Copy the plan’s Robin into Run facts. From now on re-plans respect the Robin you actually have.', done: (f) => f.robinLocked && f.adopted },
    ],
  },
  loss: {
    title: 'Re-plan after a loss',
    ask: 'Something went wrong: a death, a missed recruit or a locked marriage.',
    steps: [
      { title: 'Mark what happened', view: 'roster', target: '.rsec[aria-label="Men"] .states', body: '☠ Dead or ⊘ Missed are hard: pins through them break. ⏸ Bench is soft and reversible — try it as a what-if.', done: (f) => f.lost },
      { title: 'Record real marriages', view: 'roster', target: '.rsec[aria-label="Men"] .spouse', body: 'Set every S-support that actually happened, even off-plan ones, as ✓ Married.', done: (f) => f.married },
      { title: 'See which children are hurt', view: 'roster', target: '.ledger', body: 'The children ledger shows each child’s plan score next to the best still possible.' },
      { title: 'Read the Plan diff', view: 'plan', target: '.banner', body: 'Red = children lost (hard). Amber = soft, reversible changes. The diff tells you why.' },
      { title: 'Adopt the new plan', view: 'plan', target: '.adopt', body: 'Your pins are kept by default. Always Adopt, so the next loss compares against today.', done: (f) => f.adopted },
    ],
  },
};

const DRILLDOWNS: readonly { q: string; a: string }[] = [
  { q: 'Why this spouse for this child?', a: 'Open the child in the left rail: every pairing, scored. “Plan: <preset> → score with this” matches the plan.' },
  { q: 'What does this pairing build?', a: 'Skills drawer on any row of a child’s table.' },
  { q: 'Which Robin does this child want?', a: 'Expand a Robin row: the asset × flaw heatmap.' },
  { q: 'Who’s strongest overall?', a: 'All children, top of the rail.' },
  { q: 'What does ⚠ mean?', a: 'An unverified assumption. Validation (top right) lists and lets you override them.' },
  { q: 'Tuning scoring', a: 'The Scoring sidebar on any child table: preset, basis, Spd target, weights.' },
];

// ---- prototype state (in memory) ----
let journey: JourneyId = 'fresh';
let tourStep: number | null = null;
let welcomeOpen = true;
let calloutOpen = true;
let dockOpen = true;

/** The view a first visit lands on. */
export const landingView = (): GuideView => (guideVariant() === 'A' ? 'guide' : 'roster');

// ---- A: Guide page ----

export function guideRailItem(ctx: GuideCtx): HTMLElement | null {
  if (guideVariant() !== 'A') return null;
  return h(
    'button',
    { class: `rail-item roster-item${ctx.view === 'guide' ? ' on' : ''}`, onclick: () => ctx.go('guide') },
    h('span', {}, '? Guide'),
  );
}

export function guidePage(ctx: GuideCtx): HTMLElement[] {
  const card = (id: JourneyId) => {
    const j = JOURNEYS[id];
    return h(
      'section',
      { class: 'gp-card' },
      h('h3', {}, j.title),
      h('p', { class: 'muted' }, j.ask),
      h(
        'ol',
        {},
        ...j.steps.map((s) =>
          h(
            'li',
            {},
            h('b', {}, s.title),
            s.done?.(ctx.facts) ? h('span', { class: 'pos' }, ' ✓') : null,
            h('div', { class: 'muted small' }, s.body),
            h('button', { class: 'ghost small', onclick: () => ctx.go(s.view) }, `Go to ${s.view === 'roster' ? 'Roster' : 'Plan'} →`),
          ),
        ),
      ),
    );
  };
  return [
    h('div', { class: 'main-head' }, h('h2', {}, 'How to use FE13 Child Calc')),
    h(
      'div',
      { class: 'scroll gp' },
      h(
        'p',
        { class: 'gp-lede' },
        'Plan every marriage in your Awakening run so each child comes out strong — then re-plan when something goes wrong. Start with your Roster.',
        ' ',
        h('button', { class: 'adopt', onclick: () => ctx.go('roster') }, 'Start: set up your Roster →'),
      ),
      h('div', { class: 'gp-cards' }, card('fresh'), card('loss')),
      h('h3', {}, 'Going deeper'),
      h('dl', { class: 'gp-dl' }, ...DRILLDOWNS.flatMap((d) => [h('dt', {}, d.q), h('dd', { class: 'muted' }, d.a)])),
    ),
  ];
}

// ---- B: Guided tour ----

function find(target: string): HTMLElement | null {
  if (target.startsWith('text:')) {
    const text = target.slice(5);
    return [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.includes(text)) ?? null;
  }
  return document.querySelector<HTMLElement>(target);
}

function tourLayer(ctx: GuideCtx): HTMLElement | null {
  if (welcomeOpen) {
    const pick = (id: JourneyId | null) => () => {
      welcomeOpen = false;
      if (id) {
        journey = id;
        tourStep = 0;
        ctx.go(JOURNEYS[id].steps[0]!.view);
      } else ctx.rerender();
    };
    return h(
      'div',
      { class: 'gt-scrim' },
      h(
        'div',
        { class: 'gt-welcome' },
        h('h2', {}, 'FE13 Child Calc'),
        h('p', {}, 'Plans every marriage in your Awakening run so each child comes out strong. What are you here to do?'),
        h('button', { class: 'gt-choice', onclick: pick('fresh') }, h('b', {}, JOURNEYS.fresh.title), h('div', { class: 'muted small' }, JOURNEYS.fresh.ask)),
        h('button', { class: 'gt-choice', onclick: pick('loss') }, h('b', {}, JOURNEYS.loss.title), h('div', { class: 'muted small' }, JOURNEYS.loss.ask)),
        h('button', { class: 'ghost small', onclick: pick(null) }, 'Just look around'),
      ),
    );
  }
  if (tourStep === null) return null;
  const steps = JOURNEYS[journey].steps;
  const step = steps[tourStep]!;
  const move = (i: number | null) => () => {
    tourStep = i;
    if (i !== null && steps[i]!.view !== ctx.view) ctx.go(steps[i]!.view);
    else ctx.rerender();
  };
  const pop = h(
    'div',
    { class: 'gt-pop' },
    h('div', { class: 'muted small' }, `${JOURNEYS[journey].title} · ${tourStep + 1}/${steps.length}`),
    h('b', {}, step.title),
    h('p', {}, step.body),
    h(
      'div',
      { class: 'gt-nav' },
      h('button', { class: 'ghost small', onclick: move(null) }, 'End tour'),
      h('button', { disabled: tourStep === 0, onclick: move(tourStep - 1) }, '← Back'),
      tourStep < steps.length - 1 ? h('button', { class: 'adopt', onclick: move(tourStep + 1) }, 'Next →') : h('button', { class: 'adopt', onclick: move(null) }, 'Done'),
    ),
  );
  // Place after layout: spotlight the real control and put the popover beside it.
  requestAnimationFrame(() => {
    document.querySelectorAll('.gt-spot').forEach((el) => el.classList.remove('gt-spot'));
    const el = find(step.target);
    if (!el) {
      Object.assign(pop.style, { top: '80px', left: '50%', transform: 'translateX(-50%)' });
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('gt-spot');
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      const top = r.bottom + 10 + 200 > innerHeight ? Math.max(8, r.top - 10 - pop.offsetHeight) : r.bottom + 10;
      Object.assign(pop.style, { top: `${top}px`, left: `${Math.min(Math.max(8, r.left), innerWidth - 340)}px` });
    }, 250);
  });
  return pop;
}

export function tourButton(ctx: GuideCtx): HTMLElement | null {
  if (guideVariant() !== 'B') return null;
  return h('button', { class: 'ghost', onclick: () => ((welcomeOpen = true), (tourStep = null), ctx.rerender()) }, '? Tour');
}

// ---- C: Inline next-step ----

export function journeyToggle(ctx: GuideCtx): HTMLElement | null {
  if (guideVariant() !== 'C' && guideVariant() !== 'D') return null;
  return h(
    'span',
    { class: 'seg', role: 'group', 'aria-label': 'Journey' },
    ...(['fresh', 'loss'] as const).map((id) =>
      h('button', { class: journey === id ? 'on' : '', onclick: () => ((journey = id), (calloutOpen = true), ctx.rerender()) }, id === 'fresh' ? 'Fresh run' : 'After a loss'),
    ),
  );
}

export function inlineCallout(ctx: GuideCtx): HTMLElement | null {
  if (guideVariant() !== 'C') return null;
  const j = JOURNEYS[journey];
  if (ctx.view === 'table' || ctx.view === 'validation') {
    return h(
      'div',
      { class: 'ic ic-side' },
      '↳ This is a drill-down. Planning happens in ',
      h('button', { class: 'ghost small', onclick: () => ctx.go('roster') }, 'Roster'),
      ' then ',
      h('button', { class: 'ghost small', onclick: () => ctx.go('plan') }, 'Plan'),
      '.',
    );
  }
  if (ctx.view !== 'roster' && ctx.view !== 'plan') return null;
  const here = j.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.view === ctx.view);
  const next = ctx.view === 'roster' ? 'plan' : 'roster';
  if (!calloutOpen) {
    return h('button', { class: 'ic-collapsed ghost small', onclick: () => ((calloutOpen = true), ctx.rerender()) }, `? What to do here (${j.title})`);
  }
  return h(
    'div',
    { class: 'ic' },
    h(
      'div',
      { class: 'ic-head' },
      h('b', {}, `${j.title} · ${ctx.view === 'roster' ? 'Roster' : 'Plan'}`),
      h('button', { class: 'ghost small', onclick: () => ((calloutOpen = false), ctx.rerender()) }, 'Hide'),
    ),
    ctx.view === 'roster' && journey === 'fresh'
      ? h('p', { class: 'muted small' }, 'New here? This app plans every marriage in your Awakening run. Set up your run here, then open the Plan.')
      : null,
    h(
      'ol',
      {},
      ...here.map(({ s, i }) =>
        h('li', { value: String(i + 1) }, h('b', {}, s.title), s.done?.(ctx.facts) ? h('span', { class: 'pos' }, ' ✓') : null, ' — ', h('span', { class: 'muted' }, s.body)),
      ),
    ),
    h('button', { class: 'adopt', onclick: () => ctx.go(next) }, `Next: ${next === 'plan' ? 'Plan' : 'back to Roster'} →`),
  );
}

// ---- D: Checklist dock ----

function dock(ctx: GuideCtx): HTMLElement {
  const j = JOURNEYS[journey];
  const doneCount = j.steps.filter((s) => s.done?.(ctx.facts)).length;
  const tracked = j.steps.filter((s) => s.done).length;
  if (!dockOpen) {
    return h('button', { class: 'gd gd-min', onclick: () => ((dockOpen = true), ctx.rerender()) }, `☰ ${j.title} · ${doneCount}/${tracked}`);
  }
  return h(
    'div',
    { class: 'gd' },
    h('div', { class: 'gd-head' }, h('b', {}, 'Your run'), journeyToggle(ctx), h('button', { class: 'ghost small', onclick: () => ((dockOpen = false), ctx.rerender()) }, '—')),
    h('div', { class: 'muted small' }, j.ask),
    h(
      'ol',
      { class: 'gd-list' },
      ...j.steps.map((s) => {
        const done = s.done?.(ctx.facts);
        return h(
          'li',
          { class: done ? 'done' : '' },
          h(
            'button',
            {
              class: 'gd-item',
              title: s.body,
              onclick: () => {
                ctx.go(s.view);
                requestAnimationFrame(() => {
                  const el = find(s.target);
                  if (!el) return;
                  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  el.classList.add('gt-spot');
                  setTimeout(() => el.classList.remove('gt-spot'), 1600);
                });
              },
            },
            h('span', { class: 'gd-box' }, done ? '✓' : s.done ? '○' : '·'),
            h('span', {}, s.title),
            h('span', { class: 'muted small' }, s.view === 'roster' ? 'Roster' : 'Plan'),
          ),
        );
      }),
    ),
    h('details', {}, h('summary', { class: 'muted small' }, 'Going deeper'), h('dl', { class: 'gp-dl' }, ...DRILLDOWNS.flatMap((d) => [h('dt', {}, d.q), h('dd', { class: 'muted' }, d.a)]))),
  );
}

// ---- overlays + switcher ----

export function guideOverlays(ctx: GuideCtx): HTMLElement[] {
  const v = guideVariant();
  const out: (HTMLElement | null)[] = [v === 'B' ? tourLayer(ctx) : null, v === 'D' ? dock(ctx) : null, switcher()];
  return out.filter((e): e is HTMLElement => e !== null);
}

function switcher(): HTMLElement {
  const v = guideVariant();
  const go = (d: number) => {
    const next = VARIANTS[(VARIANTS.indexOf(v) + d + VARIANTS.length) % VARIANTS.length]!;
    const url = new URL(location.href);
    url.searchParams.set('variant', next);
    location.replace(url); // full reload: every variant starts as a first visit
  };
  return h(
    'div',
    { class: 'proto-switcher' },
    h('button', { onclick: () => go(-1), 'aria-label': 'Previous variant' }, '←'),
    h('span', {}, `${v} — ${NAMES[v]}`),
    h('button', { onclick: () => go(1), 'aria-label': 'Next variant' }, '→'),
  );
}

if (location.hostname === "localhost") {
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    (document.querySelector<HTMLButtonElement>(`.proto-switcher button:${e.key === 'ArrowLeft' ? 'first' : 'last'}-child`))?.click();
  });
}
