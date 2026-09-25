/**
 * Unit names as links (#107), in one style everywhere: a first-gen unit opens its page, Robin opens Robin's page
 * (previewing a given Robin while the Run facts leave it open), and a child opens its front door. The Maiden has no
 * page and stays text.
 */
import type { RobinRef, RosterUnit } from '../engine';
import { CHILD_UNITS } from '../game-data/children';
import { h } from './dom';

export type OpenUnit = (u: RosterUnit, robin?: RobinRef) => void;

export function unitLink(open: OpenUnit, u: RosterUnit, label: string, robin?: RobinRef): HTMLElement {
  if (u === 'maiden') return h('span', {}, label);
  const isChild = u in CHILD_UNITS;
  return h(
    'button',
    {
      class: 'unit-link',
      title: isChild ? `${label}’s front door` : u === 'robin' ? 'Robin’s page' : `${label}’s page`,
      onclick: (e) => {
        // A name inside a clickable row or chip opens the page, not the row.
        e.stopPropagation();
        open(u, robin);
      },
    },
    label,
  );
}
