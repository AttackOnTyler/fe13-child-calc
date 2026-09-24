/** The Roster spouse picker's options: each partner labelled with its state and any bond elsewhere, the missed and dead last. */
import { stateOf, unitName, type Roster, type RosterEntry, type RosterUnit, type UnitState } from '../engine';
import { STATE_UI } from './labels';

export type SpouseOption = { readonly value: RosterUnit; readonly label: string };

/** Sort group per state: the usable first, then the benched, then the missed and dead. Every option stays selectable. */
const GROUP: Readonly<Record<UnitState, number>> = { available: 0, 'not-recruited': 0, benched: 1, missed: 2, dead: 2 };

/** A state worth naming on an option; Available and Not yet recruited go unlabelled. */
const stateNote = (st: UnitState): string | null => (st === 'available' || st === 'not-recruited' ? null : STATE_UI[st].label.toLowerCase());

/** `u`'s possible spouses, grouped by state (each group in data order), labelled e.g. "Stahl (dead; married to Sully)". */
export function spouseOptions(roster: Roster, u: RosterEntry): SpouseOption[] {
  const gender = roster.run.gender;
  const option = (p: RosterUnit): SpouseOption => {
    const theirs = roster.spouses[p];
    const bond = theirs && theirs.partner !== u.id ? `${theirs.bond === 'married' ? 'married to' : 'pinned to'} ${unitName(theirs.partner, gender)}` : null;
    const notes = [stateNote(stateOf(roster, p)), bond].filter((n) => n !== null);
    return { value: p, label: notes.length ? `${unitName(p, gender)} (${notes.join('; ')})` : unitName(p, gender) };
  };
  // Array sort is stable, so each group keeps the partners' data order.
  return [...u.partners].sort((a, b) => GROUP[stateOf(roster, a)] - GROUP[stateOf(roster, b)]).map(option);
}
