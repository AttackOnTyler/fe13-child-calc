/**
 * The guide's UI (#213): the welcome box a new visitor sees (Plan a run or Just explore), Plan a run's two steps, and
 * the Going deeper panel the header's `? Guide` opens, grouped into Your run and Exploring. It reads guide facts and
 * guide prefs, and points at controls only through their `data-guide` anchors. Which panel shows is view state: only
 * the welcome's `seen` is stored.
 */
import { h } from './dom';
import type { GuideTarget } from './guide';
import { DEEPER_GROUPS, deeperEntry, deeperView, type DeeperEntry, type DeeperId, type DeeperJump } from './guide-deeper';
import type { GuideFacts } from './guide-facts';
import { closeWelcome, type GuidePrefs } from './guide-prefs';
import { JUST_EXPLORE, PLAN_A_RUN, VIEW_NAMES, startProgress, stepDone, type GuideView, type StartStep } from './guide-welcome';
import { LABELS } from './labels';

export type GuideContext = {
  readonly prefs: GuidePrefs;
  readonly facts: GuideFacts;
  /** The welcome box is showing. */
  readonly welcome: boolean;
  /** Saves new guide prefs; the welcome box closes, as every change is a choice made past it. */
  readonly setPrefs: (next: GuidePrefs) => void;
  /** Switches the app to a view and renders it. */
  readonly go: (view: GuideView) => void;
  /** Takes a Going deeper jump and renders it; for a child's table, returns the child's name. */
  readonly goDeeper: (jump: DeeperJump) => string | undefined;
  /**
   * Makes room to see a control the guide jumps to: on a phone the guide's panel (a bottom sheet there) closes, and the
   * Scoring sheet opens for a control inside it, or closes for one outside it.
   */
  readonly makeRoom: (target: GuideTarget) => void;
  /** Renders the guide again, after a change to its own view state. */
  readonly refresh: () => void;
};

/** The guide's panel (view state): none, Plan a run's steps, or Going deeper. */
let shown: 'none' | 'plan' | 'deeper' = 'none';
/** Plan a run's step whose takeaway shows (view state): the last one clicked, else the first not yet done. */
let focused: number | undefined;
/** Terms folds left open, by entry. */
const openTerms = new Set<DeeperId>();
/** The child the last Going deeper jump showed, named under its entry. */
let deeperShown: { id: DeeperId; text: string } | undefined;

/** Closes the guide's panel: on a phone, where it's a bottom sheet, when the Scoring sheet opens. */
export const hideGuide = (): void => void (shown = 'none');

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
function jump(ctx: GuideContext, step: { readonly view: GuideView; readonly target: GuideTarget }): void {
  ctx.go(step.view);
  ctx.makeRoom(step.target);
  highlight(step.target);
}

/** The header's `? Guide`: opens Going deeper, or closes it. */
export function guideButton(ctx: () => GuideContext): HTMLElement {
  return h(
    'button',
    {
      class: 'ghost guide-open',
      title: 'Going deeper: questions about your run and exploring',
      onclick: () => {
        shown = shown === 'deeper' ? 'none' : 'deeper';
        ctx().refresh();
      },
    },
    LABELS.guide,
  );
}

function welcomeBox(ctx: GuideContext): HTMLElement {
  const close = () => ctx.setPrefs(closeWelcome(ctx.prefs));
  const plan = () => {
    shown = 'plan';
    focused = undefined;
    close();
    jump(ctx, PLAN_A_RUN.steps[0]!);
  };
  const explore = () => {
    shown = 'none';
    close();
    jump(ctx, JUST_EXPLORE);
  };
  const choice = (title: string, ask: string, onclick: () => void) => h('button', { class: 'gw-choice', onclick }, h('b', {}, title), h('span', { class: 'muted small' }, ask));
  const box = h(
    'div',
    { class: 'gw', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gw-title' },
    h('div', { class: 'gw-head' }, h('h2', { id: 'gw-title' }, 'FE13 Child Calc'), h('button', { class: 'ghost', 'aria-label': 'Close', title: 'Close', onclick: close }, '✕')),
    h('p', {}, 'Plans your Awakening run towards a flawless endpoint: who marries whom, who fields, and what to do before each map. What are you here to do?'),
    choice(PLAN_A_RUN.title, PLAN_A_RUN.ask, plan),
    choice(JUST_EXPLORE.title, JUST_EXPLORE.ask, explore),
    h('p', { class: 'muted small' }, `${LABELS.guide} in the header answers questions any time.`),
  );
  const scrim = h('div', { class: 'gw-scrim', onkeydown: (e) => (e as KeyboardEvent).key === 'Escape' && close() }, box);
  setTimeout(() => box.querySelector<HTMLElement>('.gw-choice')?.focus()); // once it's in the page
  return scrim;
}

const entryId = (id: DeeperId) => `gd-deeper-${id}`;

/** A step's “↳ <question>”: opens Going deeper and scrolls to the entry. */
function deeperLink(ctx: GuideContext, id: DeeperId): HTMLElement {
  return h(
    'button',
    {
      class: 'gd-link small',
      onclick: () => {
        shown = 'deeper';
        ctx.refresh();
        spot(document.getElementById(entryId(id)), 'nearest');
      },
    },
    `↳ ${deeperEntry(id).question}`,
  );
}

function stepItem(ctx: GuideContext, step: StartStep, index: number, open: boolean): HTMLElement {
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
          focused = index;
          jump(ctx, step);
        },
      },
      h('span', { class: 'gd-box', title: done ? 'Done' : 'Not done yet' }, done ? '✓' : '○'),
      h('span', { class: 'gd-title' }, `${index + 1}. ${step.title}`),
      h('span', { class: 'gd-where muted small' }, VIEW_NAMES[step.view]),
    ),
    open ? h('div', { class: 'gd-take small' }, h('div', { class: 'gd-path muted' }, step.where), step.takeaway) : null,
    step.deeper ? h('div', { class: 'gd-links' }, ...step.deeper.map((id) => deeperLink(ctx, id))) : null,
  );
}

/** The panel's head: its title, a count, and ✕. */
function panelHead(ctx: GuideContext, title: string, count = ''): HTMLElement {
  return h(
    'div',
    { class: 'gd-head' },
    h('b', {}, title),
    h('span', { class: 'muted small gd-count', title: count ? 'Steps done' : '' }, count),
    h(
      'button',
      {
        class: 'ghost small',
        'aria-label': 'Close the guide',
        title: `Close the guide (${LABELS.guide} opens Going deeper)`,
        onclick: () => {
          shown = 'none';
          ctx.refresh();
        },
      },
      '✕',
    ),
  );
}

/** Plan a run: Run facts, then the inbox's Robin card. */
function planPanel(ctx: GuideContext): HTMLElement {
  const { steps } = PLAN_A_RUN;
  const firstOpen = steps.findIndex((s) => !stepDone(s, ctx.facts));
  const openIndex = focused ?? firstOpen;
  const { done, of } = startProgress(steps, ctx.facts);
  return h(
    'aside',
    { class: 'gd', 'aria-label': 'Guide' },
    panelHead(ctx, PLAN_A_RUN.title, `${done}/${of}`),
    h('p', { class: 'muted small gd-ask' }, PLAN_A_RUN.ask),
    h('ol', { class: 'gd-list' }, ...steps.map((s, i) => stepItem(ctx, s, i, i === openIndex))),
    h('p', { class: 'muted small gd-ask' }, 'Then the inbox lists what needs you before each map. ', deeperLink(ctx, 'inbox-after')),
  );
}

/** A Going deeper entry: its question, answer, jump and Terms fold. It never ticks. */
function deeperItem(ctx: GuideContext, entry: DeeperEntry): HTMLElement {
  const { answer, jump: to } = deeperView(entry, ctx.facts.robinLocked);
  const go = (j: DeeperJump) => () => {
    const child = ctx.goDeeper(j);
    deeperShown = child ? { id: entry.id, text: `Showing ${child}. Pick another in the left rail.` } : undefined;
    ctx.refresh();
    ctx.makeRoom(j.target);
    highlight(j.target);
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
      to ? h('button', { class: 'ghost small gd-jump', title: 'Go there', onclick: go(to) }, 'Show me') : null,
    ),
    answer.length > 1 ? h('ol', { class: 'small gd-steps' }, ...answer.map((a) => h('li', {}, a))) : h('div', { class: 'small' }, answer[0]!),
    deeperShown?.id === entry.id ? h('div', { class: 'muted small' }, deeperShown.text) : null,
    entry.terms.length ? terms : null,
  );
}

/** Going deeper: every question, grouped into Your run and Exploring, with Plan a run's steps a click away. */
function deeperPanel(ctx: GuideContext): HTMLElement {
  return h(
    'aside',
    { class: 'gd', 'aria-label': 'Guide' },
    panelHead(ctx, 'Going deeper'),
    h(
      'button',
      {
        class: 'gd-link small',
        onclick: () => {
          shown = 'plan';
          focused = undefined;
          ctx.refresh();
        },
      },
      `▸ ${PLAN_A_RUN.title}: ${LABELS.runFacts}, then the inbox’s Robin card`,
    ),
    ...DEEPER_GROUPS.map((g) =>
      h(
        'section',
        { class: 'gd-deeper', 'aria-label': g.title },
        h('h3', { class: 'gd-deeper-head' }, g.title),
        h('ol', { class: 'gd-deeper-list' }, ...g.ids.map((id) => deeperItem(ctx, deeperEntry(id)))),
      ),
    ),
  );
}

/** The welcome box, or the guide's open panel; nothing when it's closed. */
export function guideLayer(ctx: GuideContext): HTMLElement[] {
  if (ctx.welcome) return [welcomeBox(ctx)];
  return shown === 'plan' ? [planPanel(ctx)] : shown === 'deeper' ? [deeperPanel(ctx)] : [];
}
