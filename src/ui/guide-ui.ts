/**
 * The guide's UI: the welcome box, the checklist dock (open, or collapsed to its progress pill) and the header's
 * `? Guide`. It reads guide facts and guide prefs, and points at controls only through their `data-guide` anchors.
 */
import { h } from './dom';
import type { GuideTarget } from './guide';
import type { GuideFacts } from './guide-facts';
import { JOURNEYS, VIEW_NAMES, journeyProgress, stepDone, type GuideJourney, type GuideView, type JourneyStep } from './guide-journeys';
import { closeWelcome, pickJourney, reopenGuide, type DockState, type GuidePrefs, type Journey } from './guide-prefs';
import { LABELS } from './labels';

export type GuideContext = {
  readonly prefs: GuidePrefs;
  readonly facts: GuideFacts;
  /** The welcome box is showing. */
  readonly welcome: boolean;
  /** Saves new guide prefs; the welcome box closes, as every change is a choice made past it. */
  readonly setPrefs: (next: GuidePrefs) => void;
  readonly showWelcome: () => void;
  /** Switches the app to a view and renders it. */
  readonly go: (view: GuideView) => void;
};

/** The journey the dock shows: the last one picked, while its content exists. */
const journeyOf = (prefs: GuidePrefs): GuideJourney => (prefs.journey !== null && prefs.journey in JOURNEYS ? (prefs.journey as GuideJourney) : 'fresh');

/** The step whose takeaway the dock shows (view state): the last one clicked, else the first not yet done. */
let focused: { journey: GuideJourney; index: number } | undefined;

const HIGHLIGHT_MS = 1800;

/** Scrolls to the control anchored `target` and highlights it for a moment. */
function highlight(target: GuideTarget): void {
  const el = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  el.classList.remove('guide-spot');
  void el.offsetWidth; // restart the animation on a repeat click
  el.classList.add('guide-spot');
  setTimeout(() => el.classList.remove('guide-spot'), HIGHLIGHT_MS);
}

/** Switches to the step's view (rendered at once), then scrolls to and highlights its control. */
function jump(ctx: GuideContext, step: JourneyStep): void {
  ctx.go(step.view);
  highlight(step.target);
}

export function guideButton(ctx: () => GuideContext): HTMLElement {
  return h(
    'button',
    {
      class: 'ghost guide-open',
      title: 'Open the usage guide',
      onclick: () => {
        const c = ctx();
        const next = reopenGuide(c.prefs);
        if (next === 'welcome') c.showWelcome();
        else c.setPrefs(next);
      },
    },
    LABELS.guide,
  );
}

/** The welcome box's journeys; until Explore has content, Just look around shows Fresh run. */
const WELCOME_CHOICES: readonly { readonly journey: Journey; readonly title: string; readonly ask: string }[] = [
  { journey: 'fresh', title: 'Plan a fresh run', ask: 'I’m starting a run: who should everyone marry?' },
  { journey: 'loss', title: 'Re-plan after a loss', ask: 'A unit died, a recruit was missed, or a marriage went off-plan.' },
];

const setDock = (ctx: GuideContext, dock: DockState) => ctx.setPrefs({ ...ctx.prefs, dock });

function welcomeBox(ctx: GuideContext): HTMLElement {
  const pick = (journey: Journey) => () => {
    focused = undefined;
    ctx.setPrefs(pickJourney(ctx.prefs, journey));
    ctx.go('roster');
  };
  const close = () => ctx.setPrefs(closeWelcome(ctx.prefs));
  const box = h(
    'div',
    { class: 'gw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gw-title' },
    h('div', { class: 'gw-head' }, h('h2', { id: 'gw-title' }, 'FE13 Child Calc'), h('button', { class: 'ghost', 'aria-label': 'Close', title: 'Close', onclick: close }, '✕')),
    h('p', {}, 'Plans every marriage in your Awakening run so each child comes out strong, and re-plans when something goes wrong. What are you here to do?'),
    ...WELCOME_CHOICES.map((c) => h('button', { class: 'gw-choice', onclick: pick(c.journey) }, h('b', {}, c.title), h('span', { class: 'muted small' }, c.ask))),
    h('button', { class: 'ghost small gw-look', onclick: pick('explore') }, 'Just look around'),
  );
  const scrim = h('div', { class: 'gw-scrim', onkeydown: (e) => (e as KeyboardEvent).key === 'Escape' && close() }, box);
  setTimeout(() => box.querySelector<HTMLElement>('.gw-choice')?.focus()); // once it's in the page
  return scrim;
}

function pill(ctx: GuideContext, journey: GuideJourney): HTMLElement {
  const { done, tracked } = journeyProgress(JOURNEYS[journey].steps, ctx.facts);
  return h(
    'button',
    { class: 'gd gd-pill', title: 'Open the guide', onclick: () => setDock(ctx, 'open') },
    `☰ ${JOURNEYS[journey].title} · ${done}/${tracked}`,
  );
}

function stepItem(ctx: GuideContext, journey: GuideJourney, step: JourneyStep, index: number, open: boolean): HTMLElement {
  const done = stepDone(step, ctx.facts);
  return h(
    'li',
    { class: `${done ? 'done' : ''}${open ? ' open' : ''}` },
    h(
      'button',
      {
        class: 'gd-item',
        'aria-expanded': String(open),
        title: `Go to ${step.where}`,
        onclick: () => {
          focused = { journey, index };
          jump(ctx, step);
        },
      },
      h('span', { class: 'gd-box', title: done === undefined ? 'Nothing to tick: read and move on' : done ? 'Done' : 'Not done yet' }, done ? '✓' : done === false ? '○' : '·'),
      h('span', { class: 'gd-title' }, `${index + 1}. ${step.title}`),
      h('span', { class: 'gd-where muted small' }, VIEW_NAMES[step.view]),
    ),
    open ? h('div', { class: 'gd-take small' }, h('div', { class: 'gd-path muted' }, step.where), step.takeaway) : null,
    step.note ? h('div', { class: 'gd-note muted small' }, step.note) : null,
  );
}

function dock(ctx: GuideContext, journey: GuideJourney): HTMLElement {
  const content = JOURNEYS[journey];
  const firstOpen = content.steps.findIndex((s) => stepDone(s, ctx.facts) !== true);
  const openIndex = focused?.journey === journey ? focused.index : firstOpen;
  const { done, tracked } = journeyProgress(content.steps, ctx.facts);
  return h(
    'aside',
    { class: 'gd', 'aria-label': 'Guide' },
    h(
      'div',
      { class: 'gd-head' },
      h(
        'span',
        { class: 'seg', role: 'group', 'aria-label': 'Journey' },
        ...(Object.keys(JOURNEYS) as GuideJourney[]).map((j) =>
          h('button', { class: j === journey ? 'on' : '', 'aria-pressed': String(j === journey), onclick: () => ctx.setPrefs(pickJourney(ctx.prefs, j)) }, JOURNEYS[j].title),
        ),
      ),
      h('span', { class: 'muted small gd-count', title: 'Steps done, of those the guide can tick' }, `${done}/${tracked}`),
      h('button', { class: 'ghost small', 'aria-label': 'Collapse', title: 'Collapse to a pill', onclick: () => setDock(ctx, 'pill') }, '—'),
      h('button', { class: 'ghost small', 'aria-label': 'Close the guide', title: `Close the guide (${LABELS.guide} brings it back)`, onclick: () => setDock(ctx, 'closed') }, '✕'),
    ),
    h('p', { class: 'muted small gd-ask' }, content.ask),
    h('ol', { class: 'gd-list' }, ...content.steps.map((s, i) => stepItem(ctx, journey, s, i, i === openIndex))),
  );
}

/** The welcome box, or the dock in its state; nothing when the guide is closed. */
export function guideLayer(ctx: GuideContext): HTMLElement[] {
  if (ctx.welcome) return [welcomeBox(ctx)];
  const journey = journeyOf(ctx.prefs);
  return ctx.prefs.dock === 'open' ? [dock(ctx, journey)] : ctx.prefs.dock === 'pill' ? [pill(ctx, journey)] : [];
}
