/** Canonical stat order used everywhere: HP / Str / Mag / Skl / Spd / Lck / Def / Res. */
export const STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'] as const;
export type Stat = (typeof STATS)[number];

/** Max-stat modifiers have no HP entry. */
export const MOD_STATS = ['str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'] as const;
export type ModStat = (typeof MOD_STATS)[number];

export type Growths = Readonly<Record<Stat, number>>;
export type Modifiers = Readonly<Record<ModStat, number>>;

export type Gender = 'M' | 'F';

export const STAT_LABELS: Readonly<Record<Stat, string>> = {
  hp: 'HP',
  str: 'Str',
  mag: 'Mag',
  skl: 'Skl',
  spd: 'Spd',
  lck: 'Lck',
  def: 'Def',
  res: 'Res',
};
