// PROTOTYPE — throwaway (#173). What each number would say about itself: its trail (which maps, lineups and fights
// moved it), its math, where the trail stops, the blind spots that touch it, and the stated assumptions list.
// Every number is invented, like ../wishlist-editing/model.ts. The scene is "Before Chapter 2", Robin locked.
import { EDITS, baseWishlist } from '../wishlist-editing/model';

export const RUNS = 20000;
export const SIM_ERR = 0.5; // headline, 95%
export const PAIRED_ERR = 0.3; // an edit compared on the same runs

// ---- Maps left, with each map's no-death chance (computed exactly per map, #142) --------------------------------
export interface MapRisk { id: string; name: string; p: number; fights?: string[]; note?: string }
export const MAPS: MapRisk[] = [
  { id: 'ch2', name: 'Chapter 2: Shepherds', p: 0.996, fights: ['f-ch2-lissa', 'f-ch2-sumia'], note: 'this map' },
  { id: 'ch9', name: 'Chapter 9', p: 0.985 },
  { id: 'ch12', name: 'Chapter 12', p: 0.97 },
  { id: 'ch17', name: 'Chapter 17', p: 0.975 },
  { id: 'p15', name: 'Paralogue 15', p: 0.96 },
  { id: 'ch20', name: 'Chapter 20', p: 0.975 },
  { id: 'ch22', name: 'Chapter 22', p: 0.955, fights: ['f-ch22-severa', 'f-ch22-brady'] },
  { id: 'ch24', name: 'Chapter 24', p: 0.96 },
  { id: 'endgame', name: 'Endgame', p: 0.93 },
  { id: 'apo', name: 'Apotheosis (secret run)', p: 0.64, fights: ['f-apo-kjelle', 'f-apo-severa', 'f-apo-brady', 'f-apo-olivia'] },
];
export const OTHER = { count: 24, p: 0.995 ** 24, each: [0.991, 0.999] as [number, number] };
export const FLAWLESS = MAPS.reduce((s, m) => s * m.p, 1) * OTHER.p;
export const CEILING = 0.71;
const LN = Math.log(FLAWLESS);
/** Points lost to a map: the lost points split by each map's share of the risk (log share), so rows add up. */
export const ptsLost = (p: number) => ((1 - FLAWLESS) * 100 * Math.log(p)) / LN;

// ---- Fights: where the trail stops ------------------------------------------------------------------------------
export interface Fight {
  id: string; map: string; title: string; p: number; // chance this fight kills someone, on this map
  who: string; foe: string;
  lines: [string, string][]; // the combat math, as today's matchup shows it
  stats: string; // the stat spread used
  spots: string[];
}
export const FIGHTS: Record<string, Fight> = {
  'f-ch2-lissa': { id: 'f-ch2-lissa', map: 'ch2', title: 'Lissa, alone, enemy phase turn 2: Barbarian (Hand Axe)', p: 0.0028, who: 'Lissa (Cleric Lv 2)', foe: 'Barbarian Lv 3',
    lines: [['Barbarian hits', '72%'], ['Damage', '9 (Lissa HP 17: two hits)'], ['Doubles', 'no (Spd 5 vs 7)'], ['Crit', '1% → 27 dmg, kills'], ['Lissa in reach of two Barbarians', 'assumed no (one worst attacker)']],
    stats: 'Lissa HP 17–18 at Lv 2 (10th–90th percentile), Def 1–2', spots: ['enemyPhase', 'spread', 'simError'] },
  'f-ch2-sumia': { id: 'f-ch2-sumia', map: 'ch2', title: 'Sumia backs Chrom, enemy phase turn 3: Archer', p: 0.0012, who: 'Chrom + Sumia (Sumia in front? no, Chrom leads)', foe: 'Archer Lv 2',
    lines: [['Archer targets Chrom', 'Dual Guard 11%'], ['Hit / crit', '61% / 1%'], ['Chrom HP 20, dmg 6', 'no kill without a crit']],
    stats: 'Chrom Def 5–7', spots: ['enemyPhase', 'stance', 'simError'] },
  'f-ch22-severa': { id: 'f-ch22-severa', map: 'ch22', title: 'Gerome + Severa, enemy phase wave 2: Sniper and Wyvern', p: 0.019, who: 'Severa backs Gerome', foe: 'Sniper Lv 16 (promoted), Longbow',
    lines: [['Sniper targets Gerome (flier, effective)', 'Gerome hit 71%, 3× dmg'], ['Damage', '42 vs Gerome HP 51 (expected)'], ['Dual Guard (Severa)', '24%'], ['Kills if', 'Gerome HP ≤ 42 (18% of runs) or a crit (4%)']],
    stats: 'Gerome HP 46–55 at Ch 22 (10th–90th), stats treated as independent', spots: ['enemyPhase', 'independent', 'taxi', 'simError'] },
  'f-ch22-brady': { id: 'f-ch22-brady', map: 'ch22', title: 'Brady, alone, turn 4: two Dark Knights reach him', p: 0.012, who: 'Brady (War Monk)', foe: 'Dark Knight Lv 15',
    lines: [['Worst attacker', 'Dark Knight, Nosferatu, 64% hit'], ['Damage', '19 vs Brady HP 44'], ['Only the worst attacker counts', 'the second Dark Knight is not simulated']],
    stats: 'Brady Res 22–27', spots: ['enemyPhase', 'spread', 'simError'] },
  'f-apo-kjelle': { id: 'f-apo-kjelle', map: 'apo', title: 'Kjelle + Yarne, wave 3 (turn 6): Einherjar-tier Berserker', p: 0.121, who: 'Kjelle leads, Yarne backs', foe: 'Berserker (Apotheosis tier)',
    lines: [['Berserker hits Kjelle', '64%'], ['Damage / crit', '31 / 93 (Kjelle HP 60)'], ['Crit', '14% after Kjelle’s Lck'], ['Dual Guard (Yarne)', '17%'], ['Pavise', 'Kjelle Skl 40: 40% halves a hit']],
    stats: 'Kjelle Def 44–52 at caps minus 2 (10th–90th), Lck 22–28', spots: ['enemyPhase', 'independent', 'stance', 'simError'] },
  'f-apo-severa': { id: 'f-apo-severa', map: 'apo', title: 'Gerome + Severa, wave 4: Sniper', p: 0.083, who: 'Gerome leads, Severa backs', foe: 'Sniper (Apotheosis tier)',
    lines: [['Gerome hit', '58%, effective 3×'], ['Damage', '60 vs HP 62'], ['Survives if', 'full HP and no crit (Rally Def assumed)']],
    stats: 'Gerome HP 58–64', spots: ['enemyPhase', 'rally', 'simError'] },
  'f-apo-brady': { id: 'f-apo-brady', map: 'apo', title: 'Brady, alone, heals Say’ri at range 1 on turn 7', p: 0.071, who: 'Brady (War Monk)', foe: 'Sorcerer (Apotheosis tier)',
    lines: [['Brady is where he is because', 'the assumed army spread puts the healer 1 tile behind the front'], ['Sorcerer hits Brady', '71%, 38 dmg vs HP 58']],
    stats: 'Brady Res 30–35', spots: ['spread', 'enemyPhase', 'simError'] },
  'f-apo-olivia': { id: 'f-apo-olivia', map: 'apo', title: 'Olivia, alone, after dancing on turn 5', p: 0.052, who: 'Olivia (Dancer)', foe: 'Assassin (Apotheosis tier)',
    lines: [['Assassin hits Olivia', '81%'], ['Lethality', '9% (not a crit: an instant kill)'], ['Damage', '29 vs HP 48: two hits']],
    stats: 'Olivia Spd 36–41', spots: ['spread', 'enemyPhase', 'simError'] },
};

// ---- Blind spots: what the flawless chance knowingly leaves out --------------------------------------------------
export type Lean = 'optimistic' | 'pessimistic' | 'either';
export interface Spot {
  id: string; name: string; lean: Lean; gist: string; bites: string;
  /** Kinds of number it touches: flawless, ceiling, map, fight, edit, worth, milestone, nodeath. */
  touches: string[];
  /** A stress test: the number if the assumption is wrong in the bad direction. Optional. */
  stress?: { label: string; flawless: number };
}
export const SPOTS: Record<string, Spot> = {
  enemyPhase: { id: 'enemyPhase', name: 'One worst attacker per pair', lean: 'optimistic', gist: 'Enemy phase counts only the single worst attacker on each pair, since positions aren’t modelled.', bites: 'open maps with many foes in reach: Apotheosis, Endgame, Ch 22', touches: ['flawless', 'ceiling', 'map', 'fight', 'nodeath', 'edit', 'worth'], stress: { label: 'if two attackers reach each exposed pair', flawless: 0.318 } },
  spread: { id: 'spread', name: 'Assumed army spread', lean: 'either', gist: 'Who is adjacent, in staff range or in reach is taken from an assumed spread, not the map.', bites: 'healer and Dancer fights; every Rescue', touches: ['flawless', 'map', 'fight', 'nodeath', 'worth'] },
  independent: { id: 'independent', name: 'Stats treated as independent', lean: 'either', gist: 'Each stat’s spread is its own; a unit that rolled well in Def isn’t assumed to have rolled well in HP.', bites: 'fights decided by two stats at once (HP and Def)', touches: ['fight', 'map', 'milestone'] },
  actions: { id: 'actions', name: 'Equal share of actions', lean: 'either', gist: 'Each acting unit gets a fair share of actions, one per turn; who actually moves first isn’t modelled.', bites: 'EXP forecast, so milestone chances', touches: ['milestone', 'worth', 'flawless'] },
  rally: { id: 'rally', name: 'Rally reaches every pair', lean: 'optimistic', gist: 'A Rally is assumed to reach every pair it’s planned for.', bites: 'Apotheosis (Rally Def planned on turns 4 and 6)', touches: ['map', 'fight', 'flawless'], stress: { label: 'if Rally reaches half the pairs', flawless: 0.401 } },
  taxi: { id: 'taxi', name: 'No taxiing or ferrying', lean: 'pessimistic', gist: 'Pair-up moves (taxi, ferrying armour with a flyer) are not used, so the real army can do better.', bites: 'Ch 22 and the desert and swamp maps', touches: ['flawless', 'map', 'fight'] },
  stance: { id: 'stance', name: 'Attack Stance adjacency from the spread', lean: 'optimistic', gist: 'Whether Attack Stance is available comes from the assumed spread.', bites: 'support growth milestones and Dual Strikes', touches: ['milestone', 'fight', 'flawless'] },
  npc: { id: 'npc', name: 'No kills by NPC allies', lean: 'optimistic', gist: 'NPC allies are scenery: they never steal a kill, so the EXP forecast can run high.', bites: 'Ch 5, Ch 7 and Paralogue 3', touches: ['milestone'] },
  keys: { id: 'keys', name: 'Ch 3 door keys never both lost', lean: 'optimistic', gist: 'The model assumes you never lose both door keys on Ch 3.', bites: 'Ch 3 and the gold forecast', touches: ['map', 'flawless'] },
  simError: { id: 'simError', name: 'Simulation error', lean: 'either', gist: `The headline comes from ${RUNS.toLocaleString()} simulated runs (±${SIM_ERR} at 95%). Each map’s no-death chance is exact for the runs that reach it; edits are compared on the same runs (±${PAIRED_ERR}).`, bites: 'every chance', touches: ['flawless', 'edit', 'worth', 'milestone', 'ceiling'] },
};

// ---- The stated assumptions list (#171): rules, corrections, mismatches ------------------------------------------
export interface Rule { id: string; rule: string; reading: string; status: 'open' | 'checked' | 'mismatch'; stakes?: number; check?: string; touches: string[] }
export const RULES: Rule[] = [
  { id: 'r-class-change', rule: 'Internal level: +1 per class change', reading: 'read as +1 (the user’s recollection)', status: 'open', stakes: 1.4, check: 'setup check offered on Ch 4: one test kill with Frederick after a reclass (costs 0.1)', touches: ['milestone', 'flawless'] },
  { id: 'r-support-cap', rule: 'Supports: at most 3 points per pair per map', reading: 'read as 3', status: 'open', stakes: 0.6, check: 'free check on this map: Chrom and Sumia fight together', touches: ['milestone', 'flawless'] },
  { id: 'r-rally-exp', rule: 'Rally gives EXP', reading: 'read as 0', status: 'open', stakes: 0.2, check: 'free check whenever Lissa rallies', touches: ['milestone'] },
  { id: 'r-repeat-hit', rule: 'Lunatic cuts EXP for repeat hits on one foe', reading: 'yes, as the research said', status: 'checked', touches: ['milestone'] },
  { id: 'r-battery', rule: 'A back gets half its Dual Strike’s damage EXP', reading: 'yes', status: 'checked', touches: ['milestone'] },
  { id: 'r-support-per-combat', rule: 'Support points per combat together', reading: 'neither reading fits Ch 1 and Ch 2: support forecasts are widened', status: 'mismatch', stakes: 0.9, touches: ['milestone'] },
];
export const CORRECTIONS = [
  { unit: 'Robin', factor: 0.88, from: 'Prologue and Ch 1 (2 maps)', touches: ['milestone'] },
  { unit: 'the rest of the army', factor: 0.97, from: 'Ch 1 (1 map)', touches: ['milestone'] },
];

// ---- Explanations -----------------------------------------------------------------------------------------------
export interface Row { label: string; pts?: number; value?: string; to?: string; note?: string }
export interface Expl {
  kind: string; // which blind spots and rules touch it
  title: string;
  value: number; // a chance (0–1) or points
  unit: 'chance' | 'pts' | 'ms';
  lead: string; // one sentence: what the number is
  math: string[];
  rowsTitle?: string;
  rows?: Row[];
  stop?: string; // where the trail stops, if it stops here
  spots?: string[]; // overrides kind-based blind spots
}

const w = baseWishlist();
const pct = (p: number) => (p * 100).toFixed(1);

export function explain(id: string): Expl {
  if (id === 'flawless')
    return {
      kind: 'flawless', title: 'Flawless chance', value: FLAWLESS, unit: 'chance',
      lead: 'The chance this plan reaches and clears Apotheosis (secret run) with no unit dying, from Chapter 2 on.',
      math: [
        `The product of each remaining map’s no-death chance, averaged over ${RUNS.toLocaleString()} simulated runs (stats, EXP and gold differ per run).`,
        `${pct(1 - FLAWLESS)} points are lost on the way. Each map’s row is its share of the risk, so the rows add up to that.`,
        `Simulation error: ±${SIM_ERR} (95%).`,
      ],
      rowsTitle: 'Where the points go (by map)',
      rows: [
        ...MAPS.map((m) => ({ label: m.name, pts: -ptsLost(m.p), value: `${pct(m.p)}% no-death`, to: 'map:' + m.id, note: m.note })).sort((a, b) => a.pts - b.pts),
        { label: `${OTHER.count} other maps (each ${pct(OTHER.each[0])}–${pct(OTHER.each[1])}%)`, pts: -ptsLost(OTHER.p), value: 'grouped' },
      ],
    };
  if (id === 'ceiling')
    return {
      kind: 'ceiling', title: 'Ceiling', value: CEILING, unit: 'chance',
      lead: 'The flawless chance of the endpoint map alone, with every wishlist unit at its endpoint class’s caps, its full build and the endpoint kit.',
      math: ['Apotheosis (secret run) simulated with capped stats (no spread) and every planned skill.', 'It brackets the plan: grinding, which is out of scope, can reach towards it but not past it.'],
      rowsTitle: 'What caps don’t fix (Apotheosis at caps)',
      rows: [
        { label: 'Kjelle + Yarne vs Berserker, wave 3', pts: -12.4, to: 'fight:f-apo-kjelle' },
        { label: 'Gerome + Severa vs Sniper, wave 4', pts: -7.9, to: 'fight:f-apo-severa' },
        { label: 'Brady alone vs Sorcerer', pts: -5.1, to: 'fight:f-apo-brady' },
        { label: 'Olivia alone vs Assassin', pts: -3.6, to: 'fight:f-apo-olivia' },
      ],
    };
  if (id.startsWith('map:')) {
    const m = MAPS.find((x) => x.id === id.slice(4))!;
    const fights = (m.fights ?? []).map((f) => FIGHTS[f]!);
    const known = fights.reduce((s, f) => s + f.p, 0);
    return {
      kind: 'map', title: `${m.name}: no-death chance`, value: m.p, unit: 'chance',
      lead: `The chance nobody dies on ${m.name}, for the runs that reach it with this plan’s lineup.`,
      math: [
        'Computed exactly from the fights the simulation plays on this map, turn by turn, one enemy-phase attack per pair.',
        `It costs the flawless chance ${ptsLost(m.p).toFixed(1)} points.`,
      ],
      rowsTitle: 'Fights that can kill someone',
      rows: fights.length
        ? [...fights.map((f) => ({ label: f.title, value: `${(f.p * 100).toFixed(2)}% kills`, pts: -(f.p / (1 - m.p)) * ptsLost(m.p), to: 'fight:' + f.id })),
          ...(1 - m.p - known > 0.0005 ? [{ label: 'Other fights (each under 0.1%)', value: `${((1 - m.p - known) * 100).toFixed(2)}%` }] : [])]
        : [{ label: '(stubbed: this map’s fights aren’t invented in the prototype)' }],
    };
  }
  if (id.startsWith('fight:')) {
    const f = FIGHTS[id.slice(6)]!;
    return {
      kind: 'fight', title: f.title, value: f.p, unit: 'chance', spots: f.spots,
      lead: `${f.who} against ${f.foe}. The chance this fight kills someone in the runs that reach it.`,
      math: [`Stats used: ${f.stats}.`],
      rowsTitle: 'The combat math (as the map solver’s matchup shows it)',
      rows: f.lines.map(([label, value]) => ({ label, value })),
      stop: 'The trail stops here: below this are the game’s combat formulas and the hit and crit rolls. Open the matchup for the full formula.',
    };
  }
  if (id.startsWith('edit:')) {
    const e = EDITS.find((x) => x.id === id.slice(5))!;
    const close = Math.abs(e.delta) < SIM_ERR;
    const parts = (e.split ?? '').split(', ').map((s) => {
      const m = s.match(/^(.*?) ([+−])([\d.]+)(.*)$/);
      return m ? { who: m[1]!, pts: (m[2] === '−' ? -1 : 1) * +m[3]!, why: m[4]!.trim() } : { who: s, pts: 0, why: '' };
    });
    return {
      kind: 'edit', title: e.label, value: e.delta, unit: 'pts',
      lead: close
        ? `Against the proposal, this edit moves the flawless chance by ${e.delta.toFixed(1)}, inside the ±${PAIRED_ERR} the comparison can resolve, doubled for safety: no measurable difference.`
        : `What this edit costs the flawless chance, against the proposal.`,
      math: [
        `Both plans are played on the same ${RUNS.toLocaleString()} runs (same rolls, same stats), so the difference is sharper than either chance: ±${PAIRED_ERR}.`,
        'The rest of the wishlist is re-solved locally around the edit; the roadmap is kept.',
      ],
      rowsTitle: 'Where it gains and loses',
      rows: parts.flatMap((p) => [
        { label: `${p.who}${p.why ? ' ' + p.why : ''}`, pts: p.pts },
        ...(Math.abs(p.pts) >= 0.5 ? [{ label: `   on Apotheosis (secret run)`, pts: +(p.pts * 0.6).toFixed(1), to: 'map:apo' }, { label: `   on Chapter 22`, pts: +(p.pts * 0.25).toFixed(1), to: 'map:ch22' }] : []),
      ]),
    };
  }
  if (id.startsWith('worth:')) {
    const u = w.units[id.slice(6)]!;
    return {
      kind: 'worth', title: `${u.name}: worth`, value: u.worth, unit: 'pts',
      lead: `The flawless chance the plan loses without ${u.name}, over every lineup ${u.name} plays in.`,
      math: [`The wishlist is re-solved locally without ${u.name} (the first reserve who fits steps in), and both plans are compared on the same runs (±${PAIRED_ERR}).`,
        u.parents ? `As a child, ${u.name}’s worth counts only from recruitment; the parents’ worth carries it.` : 'First-gen: counts from the first map fielded.'],
      rowsTitle: 'By lineup span',
      rows: [
        { label: 'Ch 13–17 (joins; backs)', pts: +(u.worth * 0.12).toFixed(1) },
        { label: 'Ch 18–24 (leads)', pts: +(u.worth * 0.28).toFixed(1), to: 'map:ch22' },
        { label: 'Endgame', pts: +(u.worth * 0.15).toFixed(1), to: 'map:endgame' },
        { label: 'Apotheosis (secret run)', pts: +(u.worth * 0.45).toFixed(1), to: 'map:apo' },
      ],
    };
  }
  if (id === 'ms:robin')
    return {
      kind: 'milestone', title: 'Robin Lv 10 by Ch 5: milestone chance', value: 0.71, unit: 'chance',
      lead: 'The share of simulated runs where Robin reaches Lv 10 before Chapter 5, the deadline for the Chrom × Robin support window.',
      math: [
        'Robin is Lv 7 with 12 EXP: 288 EXP to go.',
        'The EXP forecast plays each map’s fights with the EXP priority (Robin high) and a fair share of actions.',
        'Robin’s learned correction (×0.88, from 2 maps) is applied to every forecast.',
      ],
      rowsTitle: 'EXP expected per map (10th–90th percentile)',
      rows: [
        { label: 'Chapter 2: Shepherds (Barbarians ×6, Archer ×2)', value: '+110 (80–150)', to: 'map:ch2' },
        { label: 'Chapter 3', value: '+95 (60–130)' },
        { label: 'Chapter 4', value: '+105 (70–140)' },
        { label: 'Total before Ch 5', value: '310 expected, 288 needed: 71% of runs get there' },
      ],
      stop: 'The trail stops at the forecast’s foe groups: which unit kills which foe on which turn isn’t modelled (out of scope).',
    };
  if (id === 'ms:robin-pinned')
    return { ...explain('ms:robin'), title: 'Robin Lv 10 by Ch 5, with the span pin', value: 0.88, lead: 'The same milestone if Robin leads with Frederick behind on Ch 2–4 (Frederick chips; Robin takes the kills).', rows: [
      { label: 'Chapter 2: Shepherds', value: '+150 (115–190)', to: 'map:ch2' }, { label: 'Chapter 3', value: '+125 (90–160)' }, { label: 'Chapter 4', value: '+130 (95–165)' }, { label: 'Total before Ch 5', value: '405 expected, 288 needed: 88% of runs get there' }] };
  if (id === 'pin:robin')
    return {
      kind: 'edit', title: 'Pin cost: Robin leads, Frederick backs (Ch 2–4)', value: -0.2, unit: 'pts',
      lead: 'What the span pin costs the flawless chance against the unpinned best.',
      math: [`Compared on the same runs: ±${PAIRED_ERR}. So this is no measurable difference; it’s shown because a pin always shows its cost.`],
      rowsTitle: 'Where it gains and loses',
      rows: [
        { label: 'Frederick fights less on Ch 2–4, so Ch 3 is slightly riskier', pts: -0.3, to: 'map:ch2' },
        { label: 'Robin reaches Lv 10 by Ch 5 more often (support window kept)', pts: +0.1 },
      ],
    };
  return { kind: 'flawless', title: id, value: 0, unit: 'pts', lead: '(stub)', math: [] };
}

/** Blind spots and rules that touch a number. */
export const spotsFor = (e: Expl) => (e.spots ?? Object.values(SPOTS).filter((s) => s.touches.includes(e.kind)).map((s) => s.id)).map((id) => SPOTS[id]!);
export const rulesFor = (e: Expl) => RULES.filter((r) => r.touches.includes(e.kind));
export const correctionsFor = (e: Expl) => CORRECTIONS.filter((c) => c.touches.includes(e.kind));
