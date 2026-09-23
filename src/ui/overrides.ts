import type { Overrides } from '../engine';

/** Assumption overrides persist in localStorage; a missing, blocked or corrupt store just means no overrides. */
const KEY = 'fe13-child-calc:assumption-overrides:v1';

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Overrides) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: Overrides): void {
  try {
    if (Object.keys(overrides).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // Storage unavailable: the override still applies for this session.
  }
}
