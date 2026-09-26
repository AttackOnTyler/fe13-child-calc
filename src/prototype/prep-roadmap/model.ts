// PROTOTYPE — throwaway (#169). What the preparation page adds once the roadmap exists. Every number is invented:
// a stub of the roadmap's next-map slice (lineup, stances, EXP priority, milestone actions, item plan, shopping list).

/** Where in the game the action happens: the preparation menu's own steps, or on the map. */
export type Step = 'units' | 'trade' | 'items' | 'skills' | 'armory' | 'map';
export const STEP_LABEL: Record<Step, string> = {
  units: 'Pick units / pair up',
  trade: 'Inventory and trade',
  items: 'Use items',
  skills: 'Skills',
  armory: 'Armory and forge',
  map: 'On the map',
};

export interface Action {
  id: string;
  step: Step;
  text: string;
  /** Why, in the plan's terms: the milestone or item plan it serves. */
  why: string;
  /** Flawless points the plan loses if it's skipped. */
  gain: number;
  kind: 'lineup' | 'milestone' | 'booster' | 'tonic' | 'weapon' | 'shop' | 'seal' | 'check';
}

export interface Stance { turns: string; stance: string }
export interface Member {
  unit: string;
  job: string;
  /** EXP priority rank on this map (1 = takes kills first). */
  priority: number;
  /** Expected EXP on this map: 10th–90th percentile. */
  exp: [number, number];
  /** The milestone this map's EXP feeds, with its chance after this map. */
  milestone?: string;
  /** At-risk reading carried from the inbox, with the one-click span pin. */
  atRisk?: string;
}
export interface Pair { lead: Member; back?: Member; partnerNote?: string; stances: Stance[] }

export interface Threat {
  name: string;
  count: number;
  cls: string;
  /** Today's cautious reading: the worst round vs the unit that faces it. */
  worst: string;
  worstKills: boolean;
  /** Chance this group kills someone on this map (the simulation's share of the map's death chance). */
  death: number;
  /** Who takes these foes under the EXP priority. */
  who: string;
}

export interface Stop {
  map: string;
  short: string;
  deploy: string;
  /** The game gives no preparation phase: the lineup is fixed and nothing can be done in menus. */
  noPrep: boolean;
  forcedNote?: string;
  /** No-death chance of this map alone. */
  mapChance: number;
  /** Plan's flawless chance before this map. */
  planChance: number;
  turns: string;
  pairs: Pair[];
  solos: Member[];
  notFielded: string[];
  actions: Action[];
  threats: Threat[];
  gold: [spent: number, held: number];
  checks: string[];
  assumptions: string[];
}

const m = (unit: string, job: string, priority: number, exp: [number, number], extra: Partial<Member> = {}): Member => ({ unit, job, priority, exp, ...extra });

export const STOPS: Stop[] = [
  {
    map: 'Prologue: The Verge of History', short: 'Prologue', deploy: '4 (forced)', noPrep: true,
    forcedNote: 'The game fixes the lineup (Chrom, Robin, Frederick, Lissa) and starts the map with no preparation phase. Nothing below can be done in menus; it’s a plan for the map itself.',
    mapChance: 99.1, planChance: 41.2, turns: '5–7 turns',
    pairs: [],
    solos: [
      m('Robin', 'fights', 1, [230, 310], { milestone: 'Robin Lv 10 by Ch 5 · 83% after this map' }),
      m('Chrom', 'fights', 2, [120, 190]),
      m('Frederick', 'fights, chips', 4, [20, 60]),
      m('Lissa', 'heals', 3, [30, 45]),
    ],
    notFielded: [],
    actions: [
      { id: 'p-stance', step: 'map', kind: 'lineup', text: 'Turn 1: everyone apart. Robin and Chrom adjacent (Attack Stance) on the first Barbarian.', why: 'Stance plan: apart doubles actions; the spread gives Attack Stance 60% of the time.', gain: 0.3 },
      { id: 'p-pair', step: 'map', kind: 'lineup', text: 'Turn 2 enemy phase: Pair Up Lissa behind Frederick, Frederick in front.', why: 'The Myrmidon reaches Lissa on turn 2; Guard and Frederick’s Def cover her.', gain: 0.6 },
      { id: 'p-chip', step: 'map', kind: 'lineup', text: 'Frederick chips, Robin and Chrom take kills; Garrick to Robin.', why: 'EXP priority: Robin Lv 10 by Ch 5.', gain: 0.4 },
    ],
    threats: [
      { name: 'Garrick', count: 1, cls: 'Barbarian (boss)', worst: 'Worst round 18 / 19 HP on Robin', worstKills: false, death: 0.2, who: 'Robin (boss kill)' },
      { name: 'Barbarian', count: 5, cls: 'Barbarian', worst: 'Worst round 21 / 19 HP on Robin (2 crits)', worstKills: true, death: 0.5, who: 'Robin, Chrom · Frederick chips' },
      { name: 'Myrmidon', count: 3, cls: 'Myrmidon', worst: 'Worst round 17 / 17 HP on Lissa', worstKills: true, death: 0.2, who: 'Chrom · Frederick chips' },
      { name: 'Fighter', count: 2, cls: 'Fighter', worst: 'Worst round 12 / 19 HP on Robin', worstKills: false, death: 0.0, who: 'Robin' },
    ],
    gold: [0, 5000],
    checks: ['Does Rally give EXP? Not offered here (no Rally unit).'],
    assumptions: ['Stats and foes as chances; one worst attacker per pair each enemy phase.', 'Army spread assumed: Attack Stance available 60% of attacks.'],
  },
  {
    map: 'Chapter 5: The Exalt and the King', short: 'Ch 5', deploy: '9 (+2 on arrival)', noPrep: false,
    mapChance: 96.8, planChance: 42.3, turns: '9–12 turns (reinforcements turns 4 and 6)',
    pairs: [
      { lead: m('Robin', 'fights', 1, [210, 290], { milestone: 'Robin Lv 10 by Ch 5 · reached this map in 64% of runs', atRisk: 'Robin Lv 10 by Ch 5: 64% → 86% with span pin Ch 5: Robin leads, Frederick backs' }), back: m('Frederick', 'backs', 7, [5, 15]),
        stances: [{ turns: 'T1–2', stance: 'apart, adjacent (Attack Stance)' }, { turns: 'T3–5', stance: 'together, Robin in front' }, { turns: 'T6+', stance: 'apart' }] },
      { lead: m('Chrom', 'fights', 3, [110, 170]), back: m('Sumia', 'backs, then fights', 2, [120, 180], { milestone: 'Chrom & Sumia support: B by Ch 7 · 78%' }), partnerNote: 'support C→B window: Ch 4–7',
        stances: [{ turns: 'T1–3', stance: 'together, Chrom in front' }, { turns: 'T4', stance: 'Switch: Sumia in front for the flier reinforcements' }, { turns: 'T5+', stance: 'together, Sumia in front' }] },
      { lead: m('Sully', 'fights', 4, [90, 150]), back: m('Vaike', 'fights', 5, [80, 140], { milestone: 'Sully & Vaike start support (earliest start: this map)' }),
        stances: [{ turns: 'T1+', stance: 'together, Sully in front (4 combats together for 3 support points)' }] },
      { lead: m('Stahl', 'fights', 6, [60, 110]), back: m('Miriel', 'backs', 8, [5, 20]), stances: [{ turns: 'T1+', stance: 'together, Stahl in front' }] },
    ],
    solos: [m('Lissa', 'heals', 9, [60, 80])],
    notFielded: ['Virion (reserve 2)', 'Kellam (not in the wishlist)', 'Ricken and Maribelle (arrive turn 3: then Maribelle heals, Ricken sits)'],
    actions: [
      { id: 'c5-pin', step: 'units', kind: 'lineup', text: 'Pair Robin (lead) with Frederick (back).', why: 'At risk: Robin Lv 10 by Ch 5, 64% → 86%. Span pin, this map only.', gain: 1.1 },
      { id: 'c5-sv', step: 'units', kind: 'milestone', text: 'Pair Sully with Vaike.', why: 'Milestone: Sully & Vaike support, earliest start (Kjelle’s parents, S by Ch 11).', gain: 0.8 },
      { id: 'c5-drop', step: 'items', kind: 'booster', text: 'Robin drinks the Energy Drop (+2 Str).', why: 'Item plan: Energy Drop → Robin at Ch 5 · +0.5 flawless points.', gain: 0.5 },
      { id: 'c5-hand', step: 'trade', kind: 'weapon', text: 'Give the Levin Sword to Chrom.', why: 'Carrier timeline: Levin Sword Robin Ch 3–4, Chrom Ch 5–11 (fliers).', gain: 0.4 },
      { id: 'c5-buy', step: 'armory', kind: 'shop', text: 'Buy 2 Javelins, 1 Vulnerary (1,480G).', why: 'Shopping list: rebuys from simulated hits.', gain: 0.3 },
      { id: 'c5-tonic', step: 'armory', kind: 'tonic', text: 'No tonics on this map.', why: 'None earns its gold here; they gather on tight maps.', gain: 0 },
      { id: 'c5-rally', step: 'map', kind: 'check', text: 'In-play check: if Lissa rallies, watch her EXP bar.', why: 'Assumption: Rally gives 0 EXP. Record results settles it.', gain: 0 },
    ],
    threats: [
      { name: 'Wyvern Rider', count: 3, cls: 'Wyvern Rider (reinforcements T4)', worst: 'Worst round 26 / 24 HP on Sumia', worstKills: true, death: 1.4, who: 'Chrom (Levin Sword) · Robin (Thunder)' },
      { name: 'Knight', count: 4, cls: 'Knight', worst: 'Worst round 9 / 24 HP on Robin', worstKills: false, death: 0.1, who: 'Robin (magic) · Miriel chips' },
      { name: 'Myrmidon', count: 5, cls: 'Myrmidon', worst: 'Worst round 22 / 20 HP on Lissa (crit)', worstKills: true, death: 0.9, who: 'Sully, Vaike · Stahl' },
      { name: 'Archer', count: 4, cls: 'Archer', worst: 'Worst round 19 / 21 HP on Sumia', worstKills: false, death: 0.6, who: 'Stahl, Vaike' },
      { name: 'Gangrel’s escort', count: 6, cls: 'Mercenary / Fighter', worst: 'Worst round 15 / 24 HP on Robin', worstKills: false, death: 0.2, who: 'Robin, Chrom' },
    ],
    gold: [1480, 6200],
    checks: ['Does Rally give EXP? (Lissa, if she rallies)'],
    assumptions: ['Maribelle and Ricken join turn 3; Maribelle heals from turn 4.', 'Reinforcements on turns 4 and 6, as listed.'],
  },
  {
    map: 'Chapter 13: Of Sacred Blood', short: 'Ch 13', deploy: '12 (+1 Henry)', noPrep: false,
    mapChance: 93.5, planChance: 44.0, turns: '10–13 turns (boss killed turn 9–11)',
    pairs: [
      { lead: m('Robin', 'fights', 3, [120, 180]), back: m('Chrom', 'backs, then fights', 2, [90, 150], { milestone: 'Passed skill at paralogue entry: Chrom → Lucina (Aether)' }),
        stances: [{ turns: 'T1–4', stance: 'together, Robin in front' }, { turns: 'T5', stance: 'Switch: Chrom in front for the Risen Chief' }, { turns: 'T6+', stance: 'together, Robin in front' }] },
      { lead: m('Lucina', 'fights (joins at the start)', 1, [260, 340], { milestone: 'Lucina Lv 20 by Ch 16 · 72%', atRisk: 'Lucina Lv 20 by Ch 16: 72% → 84% with span pin Ch 13–14: Lucina takes the boss' }), back: m('Frederick', 'backs', 9, [5, 15]),
        stances: [{ turns: 'T1+', stance: 'together, Lucina in front' }] },
      { lead: m('Sully', 'fights', 5, [70, 120]), back: m('Vaike', 'backs', 8, [10, 25], { milestone: 'Sully & Vaike S: already reached' }), stances: [{ turns: 'T1+', stance: 'together, Sully in front' }] },
      { lead: m('Sumia', 'fights (promotes T4)', 4, [80, 130], { milestone: 'Class reached: Falcon Knight mid-map (Master Seal, turn 4)' }), back: m('Stahl', 'backs', 7, [10, 25]), stances: [{ turns: 'T1–3', stance: 'together, Sumia in front' }, { turns: 'T4+', stance: 'apart' }] },
      { lead: m('Gaius', 'fights', 6, [70, 110]), back: m('Maribelle', 'heals from the back', 10, [40, 60]), stances: [{ turns: 'T1+', stance: 'apart, adjacent' }] },
    ],
    solos: [m('Lissa', 'heals', 11, [50, 70]), m('Olivia', 'dances', 12, [60, 80])],
    notFielded: ['Virion (reserve 1)', 'Henry (arrives turn 3; fielded from Ch 14)'],
    actions: [
      { id: 'c13-aether', step: 'skills', kind: 'milestone', text: 'Chrom: put Aether in the bottom skill slot before starting the map.', why: 'Milestone: passed skill at paralogue entry. Lucina inherits Chrom’s bottom-equipped skill as she joins.', gain: 2.7 },
      { id: 'c13-seal', step: 'trade', kind: 'seal', text: 'Give Sumia a Master Seal; promote her on turn 4 after she reaches Lv 12.', why: 'Milestone: class reached, Falcon Knight on Ch 13 (mid-map).', gain: 1.2 },
      { id: 'c13-seals', step: 'armory', kind: 'shop', text: 'Buy 2 Master Seals (5,000G).', why: 'Shopping list: seals when none is held (Stahl Ch 14, Vaike Ch 15).', gain: 0.9 },
      { id: 'c13-robe', step: 'items', kind: 'booster', text: 'Frederick drinks the Seraph Robe (+5 HP).', why: 'Item plan: Seraph Robe → Frederick at Ch 13 (arrived: P2 side goal secured).', gain: 0.4 },
      { id: 'c13-tonic', step: 'items', kind: 'tonic', text: '6 tonics: Robin Spd, Sumia Spd, Sully Def, Stahl Def, Gaius Spd, Lucina Def (900G).', why: 'Tonic plan: this map is tight (93.5%); +0.8 points for 900G.', gain: 0.8 },
      { id: 'c13-buy', step: 'armory', kind: 'shop', text: 'Buy 3 Hand Axes, 2 Vulneraries, 1 Heal staff (2,340G).', why: 'Shopping list: rebuys from simulated hits.', gain: 0.4 },
      { id: 'c13-boss', step: 'map', kind: 'lineup', text: 'Lucina takes the Risen Chief (turn 9–11). Chrom chips first if her kill chance is under 70%.', why: 'At risk: Lucina Lv 20 by Ch 16.', gain: 0.7 },
    ],
    threats: [
      { name: 'Risen Chief', count: 1, cls: 'Barbarian (boss)', worst: 'Worst round 38 / 37 HP on Robin (Chrom in front: 31 / 41)', worstKills: true, death: 1.8, who: 'Lucina (boss kill) · Chrom chips' },
      { name: 'Risen Wyvern', count: 5, cls: 'Wyvern Rider', worst: 'Worst round 29 / 33 HP on Sumia', worstKills: false, death: 1.9, who: 'Robin (Thoron) · Lucina' },
      { name: 'Risen Sorcerer', count: 3, cls: 'Sorcerer', worst: 'Worst round 30 / 28 HP on Sully (Nosferatu crit)', worstKills: true, death: 1.2, who: 'Gaius · Lucina' },
      { name: 'Risen reinforcements', count: 22, cls: 'mixed, turns 3–8', worst: 'Worst round 24 / 26 HP on Maribelle', worstKills: false, death: 1.6, who: 'shared; lower-priority units wait' },
    ],
    gold: [8240, 21300],
    checks: ['Does Lucina get Chrom’s bottom-slot skill or his last-learned skill? (Record results asks.)', 'Does a Master Seal mid-map cost the unit’s action?'],
    assumptions: ['Lucina joins at the start with join stats from her parents’ current stats.', 'Henry arrives turn 3 and isn’t fielded.'],
  },
];

export const pct = (n: number) => `${n.toFixed(1)}%`;
export const units = (s: Stop): Member[] => [...s.pairs.flatMap((p) => (p.back ? [p.lead, p.back] : [p.lead])), ...s.solos];
