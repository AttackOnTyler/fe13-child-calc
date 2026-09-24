/**
 * The guide's UI: the welcome box, the checklist dock (open, or collapsed to its progress pill) with its Going deeper
 * questions, and the header's `? Guide`. It reads guide facts and guide prefs, and points at controls only through their
 * `data-guide` anchors.
 */
import { h } from './dom';
import type { GuideTarget } from './guide';
import { DEEPER, deeperEntry, deeperView, type DeeperEntry, type DeeperId, type DeeperJump } from './guide-deeper';
import type { GuideFacts } from './guide-facts';
import { JOURNEYS, VIEW_NAMES, journeyProgress, stepDone, type GuideJourney, type GuideView, type JourneyStep } from './guide-journeys';
import { closeWelcome, dismissLoss, pickJourney, reopenGuide, takeLoss, type DockState, type GuidePrefs, type Journey } from './guide-prefs';
import { LABELS } from './labels';

export type GuideContext = {
  readonly prefs: GuidePrefs;
  readonly facts: GuideFacts;
  /** The losses the loss prompt offers After a loss for; none hides it. */
  readonly loss: readonly string[];
  /** The welcome box is showing. */
  readonly welcome: boolean;
  /** Saves new guide prefs; the welcome box closes, as every change is a choice made past it. */
  readonly setPrefs: (next: GuidePrefs) => void;
  readonly showWelcome: () => void;
  /** Switches the app to a view and renders it. */
  readonly go: (view: GuideView) => void;
  /** Takes a Going deeper jump and renders it; for a child's table, returns the child's name. */
  readonly goDeeper: (jump: DeeperJump) => string | undefined;
  /**
   * Makes room to see a control the guide jumps to: on a phone the dock collapses to its pill, and the Scoring sheet
   * opens for a control inside it, or closes for one outside it.
   */
  readonly makeRoom: (target: GuideTarget) => void;
  /** Renders the guide again, after a change to its own view state. */
  readonly refresh: () => void;
};

/** The journey the dock shows: the last one picked, while its content exists. */
const journeyOf = (prefs: GuidePrefs): GuideJourney => (prefs.journey !== null && prefs.journey in JOURNEYS ? (prefs.journey as GuideJourney) : 'fresh');

/** The step whose takeaway the dock shows (view state): the last one clicked, else the first not yet done. */
let focused: { journey: GuideJourney; index: number } | undefined;

/** Going deeper is expanded inside a journey (view state; Explore always shows it). */
let deeperOpen = false;
/** Terms folds left open, by entry. */
const openTerms = new Set<DeeperId>();
/** The child the last Going deeper jump showed, named under its entry. */
let deeperShown: { id: DeeperId; text: string } | undefined;

const HIGHLIGHT_MS = 1800;

/** Scrolls to the control anchored `target` and highlights it for a moment. */
function highlight(target: GuideTarget): void {
  spot(document.querySelector<HTMLElement>(`[data-guide="${target}"]`), 'center');
}

/** Scrolls to an element and highlights it for a moment. */
function spot(el: HTMLElement | null, block: ScrollLogicalPosition): void {
  if (!el) return;
  el.scrollIntoView({ block, inline: 'nearest', behavior: 'smooth' });
  el.classList.remove('guide-spot');
  void el.offsetWidth; // restart the animation on a repeat click
  el.classList.add('guide-spot');
  setTimeout(() => el.classList.remove('guide-spot'), HIGHLIGHT_MS);
}

/** Switches to the step's view (rendered at once), then scrolls to and highlights its control. */
function jump(ctx: GuideContext, step: JourneyStep): void {
  ctx.go(step.view);
  ctx.makeRoom(step.target);
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

/** The welcome box's journeys; Just look around opens Explore. */
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

/** Picks a journey from the dock: Going deeper starts collapsed. */
const switchJourney = (ctx: GuideContext, next: GuidePrefs) => {
  deeperOpen = false;
  ctx.setPrefs(next);
};

/** The loss prompt's one line: it offers After a loss, and never switches by itself. */
function lossLine(ctx: GuideContext): HTMLElement | null {
  if (!ctx.loss.length) return null;
  return h(
    'div',
    { class: 'gd-loss small', role: 'status' },
    h('span', {}, 'Lost someone?'),
    h('button', { class: 'gd-link', onclick: () => switchJourney(ctx, takeLoss(ctx.prefs, ctx.loss)) }, `Switch to ${JOURNEYS.loss.title}`),
    h('button', { class: 'ghost small', 'aria-label': 'Dismiss', title: 'Dismiss', onclick: () => ctx.setPrefs(dismissLoss(ctx.prefs, ctx.loss)) }, '✕'),
  );
}

function pill(ctx: GuideContext, journey: GuideJourney): HTMLElement {
  const { done, tracked } = journeyProgress(JOURNEYS[journey].steps, ctx.facts);
  return h(
    'div',
    { class: 'gd gd-pillbox' },
    lossLine(ctx),
    h(
      'button',
      { class: 'gd-pill', title: 'Open the guide', onclick: () => setDock(ctx, 'open') },
      journey === 'explore' ? '☰ Guide' : `☰ ${JOURNEYS[journey].title} · ${done}/${tracked}`,
    ),
  );
}

const entryId = (id: DeeperId) => `gd-deeper-${id}`;

/** A step's “↳ <question>”: expands Going deeper and scrolls to the entry. */
function deeperLink(ctx: GuideContext, id: DeeperId): HTMLElement {
  return h(
    'button',
    {
      class: 'gd-link small',
      onclick: () => {
        deeperOpen = true;
        ctx.refresh();
        spot(document.getElementById(entryId(id)), 'nearest');
      },
    },
    `↳ ${deeperEntry(id).question}`,
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
    step.deeper ? h('div', { class: 'gd-links' }, ...step.deeper.map((id) => deeperLink(ctx, id))) : null,
  );
}

/** A Going deeper entry: its question, answer, jump and Terms fold. It never ticks. */
function deeperItem(ctx: GuideContext, entry: DeeperEntry): HTMLElement {
  const { answer, jump } = deeperView(entry, ctx.facts.robinLocked);
  const go = (to: DeeperJump) => () => {
    const child = ctx.goDeeper(to);
    deeperShown = child ? { id: entry.id, text: `Showing ${child}. Pick another in the left rail.` } : undefined;
    ctx.refresh();
    ctx.makeRoom(to.target);
    highlight(to.target);
  };
  const terms = h(
    'details',
    {
      class: 'gd-terms small',
      open: openTerms.has(entry.id),
      ontoggle: (e) => void ((e.target as HTMLDetailsElement).open ? openTerms.add(entry.id) : openTerms.delete(entry.id)),
    },
    h('summary', { class: 'muted' }, 'Terms'),
    h('dl', {}, ...entry.terms.flatMap((t) => [h('dt', {}, t.term), h('dd', {}, t.def)])),
  );
  return h(
    'li',
    { id: entryId(entry.id), class: 'gd-q' },
    h(
      'div',
      { class: 'gd-q-head' },
      h('b', { class: 'small' }, entry.question),
      jump ? h('button', { class: 'ghost small gd-jump', title: 'Go there', onclick: go(jump) }, 'Show me') : null,
    ),
    answer.length > 1 ? h('ol', { class: 'small gd-steps' }, ...answer.map((a) => h('li', {}, a))) : h('div', { class: 'small' }, answer[0]!),
    deeperShown?.id === entry.id ? h('div', { class: 'muted small' }, deeperShown.text) : null,
    entry.terms.length ? terms : null,
  );
}

/** The Going deeper questions: collapsed at the foot of a journey, always open in Explore. */
function deeperSection(ctx: GuideContext, explore: boolean): HTMLElement {
  const open = explore || deeperOpen;
  const head = explore
    ? h('h3', { class: 'gd-deeper-head' }, 'Going deeper')
    : h(
        'button',
        {
          class: 'gd-deeper-head',
          'aria-expanded': String(open),
          onclick: () => {
            deeperOpen = !open;
            ctx.refresh();
          },
        },
        `${open ? '▾' : '▸'} Going deeper`,
      );
  return h(
    'section',
    { class: 'gd-deeper', 'aria-label': 'Going deeper' },
    head,
    open ? h('ol', { class: 'gd-deeper-list' }, ...DEEPER.map((e) => deeperItem(ctx, e))) : null,
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
          h('button', { class: j === journey ? 'on' : '', 'aria-pressed': String(j === journey), onclick: () => switchJourney(ctx, pickJourney(ctx.prefs, j)) }, JOURNEYS[j].title),
        ),
      ),
      h('span', { class: 'muted small gd-count', title: 'Steps done, of those the guide can tick' }, tracked ? `${done}/${tracked}` : ''),
      h('button', { class: 'ghost small', 'aria-label': 'Collapse', title: 'Collapse to a pill', onclick: () => setDock(ctx, 'pill') }, '—'),
      h('button', { class: 'ghost small', 'aria-label': 'Close the guide', title: `Close the guide (${LABELS.guide} brings it back)`, onclick: () => setDock(ctx, 'closed') }, '✕'),
    ),
    lossLine(ctx),
    h('p', { class: 'muted small gd-ask' }, content.ask),
    content.steps.length ? h('ol', { class: 'gd-list' }, ...content.steps.map((s, i) => stepItem(ctx, journey, s, i, i === openIndex))) : null,
    deeperSection(ctx, journey === 'explore'),
  );
}

/** The welcome box, or the dock in its state; nothing when the guide is closed. */
export function guideLayer(ctx: GuideContext): HTMLElement[] {
  if (ctx.welcome) return [welcomeBox(ctx)];
  const journey = journeyOf(ctx.prefs);
  return ctx.prefs.dock === 'open' ? [dock(ctx, journey)] : ctx.prefs.dock === 'pill' ? [pill(ctx, journey)] : [];
}
