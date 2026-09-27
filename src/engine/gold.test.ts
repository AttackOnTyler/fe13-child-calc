import { describe, expect, it } from 'vitest';
import { createEngine, itemByName, ITEMS, RENOWN, resolveAssumptions, SEAL_RULES, sellPrice, sellRate, STARTING_GOLD, type ChapterDifficulty } from './index';

const engine = createEngine();
const maps = engine.maps();
const map = (id: string) => maps.find((m) => m.id === id)!;
const cost = (id: string, list: 'armory' | 'merchant', item: string) => map(id).shop![list].find((r) => r.item === item)?.cost;
const bullion = (ids: readonly string[]) => ids.flatMap((id) => engine.mapGold(id)).filter((r) => r.kind === 'bullion').reduce((a, r) => a + r.gold, 0);
const story = maps.filter((m) => m.kind === 'story');
const paralogues = maps.filter((m) => m.kind === 'paralogue');
const item = (name: string) => itemByName(name)!;

describe('the gold research’s chapter-data fixes (#180)', () => {
  it('fixes the four FEW price typos (C2–C5), so every armory and merchant price is the item’s worth', () => {
    expect([cost('prologue', 'armory', 'Bronze Lance'), cost('prologue', 'armory', 'Bronze Axe')]).toEqual([350, 400]);
    expect(cost('chapter-8', 'merchant', 'Ward')).toBe(2100);
    expect(cost('chapter-18', 'merchant', 'Thoron')).toBe(2200);
    expect([cost('paralogue-18', 'armory', 'Dragonstone+'), cost('paralogue-18', 'armory', 'Beaststone+')]).toEqual([3780, 3220]);
    for (const m of maps)
      for (const r of [...(m.shop?.armory ?? []), ...(m.shop?.merchant ?? [])]) {
        const worth = itemByName(r.item)?.worth;
        if (worth && r.cost !== null) expect(r.cost, `${m.id} ${r.item}`).toBe(worth);
      }
  });

  it('doesn’t count Paralogue 18’s disputed Lunatic drops (C13): only Zanth’s Bullion and Gangrel’s Levin Sword drop', () => {
    const drops = (d: ChapterDifficulty) => map('paralogue-18').enemies[d]!.flatMap((g) => g.items.filter((i) => i.drop).map((i) => `${g.name}: ${i.name}`));
    expect(drops('lunatic')).toEqual(['Zanth: Bullion (L)', 'Gangrel: Levin Sword']);
    expect(engine.chapterDisagreements().find((d) => d.map === 'paralogue-18' && /Lunatic drops/.test(d.item))?.status).toBe('resolved');
  });

  it('lists Paralogues 3, 8 and 10’s items, the two Bullion (M) chests among them', () => {
    expect(map('paralogue-3').items.map((i) => i.item)).toEqual(['Elixir', 'Blessed Bow', 'Seraph Robe', 'Log', 'Ladle']);
    expect(map('paralogue-8').items.map((i) => i.item)).toEqual(['Dracoshield', 'Door Key', 'Short Spear', 'Bullion (M)']);
    expect(map('paralogue-10').items.map((i) => i.item)).toEqual(['Talisman', 'Master Key', 'Bullion (M)', 'Levin Sword']);
    expect(engine.mapGold('paralogue-8')).toEqual([expect.objectContaining({ item: 'Bullion (M)', kind: 'bullion', gold: 5000, how: 'Open eastern chest' })]);
    expect(engine.mapGold('paralogue-10').map((r) => r.gold)).toEqual([5000]);
  });

  it('gives Paralogue 13’s gold as numbers: 10,000G for backing neither side, else 500G per surviving allied NPC (C8)', () => {
    const gold = engine.mapGold('paralogue-13').filter((r) => r.kind === 'gold');
    expect(gold.map((r) => [r.gold, r.per])).toEqual([
      [500, 'surviving allied NPC'],
      [10000, undefined],
    ]);
    expect(gold.every((r) => r.play?.kind === 'result')).toBe(true);
  });

  it('flags every item play can lose: escaping carriers and looting Thieves, burnable villages, Chapter 18’s floor, results and either-or picks', () => {
    const flagged = (id: string, kind: string) => map(id).items.filter((i) => i.play?.kind === kind).map((i) => i.item);
    expect(flagged('chapter-10', 'escape')).toEqual(['Bullion (M)', 'Wyrmslayer', 'Master Seal', 'Seraph Robe']);
    expect(flagged('chapter-16', 'escape')).toEqual(['Bullion (M)', 'Speedwing', 'Master Seal']);
    expect(flagged('chapter-11', 'escape')).toEqual(['Bullion (L)']);
    expect(flagged('paralogue-9', 'escape')).toEqual(['Bullion (L)']);
    expect(flagged('paralogue-12', 'escape')).toContain('Bullion (M)');
    for (const [id, it] of [['paralogue-1', 'Killer Lance'], ['paralogue-4', 'Arms Scroll'], ['chapter-17', 'Seraph Robe'], ['chapter-20', 'Spirit Dust']] as const)
      expect(flagged(id, 'escape'), id).toEqual([it]);
    expect(flagged('paralogue-2', 'village')).toEqual(['Physic']);
    expect(flagged('paralogue-14', 'village')).toEqual(['Strength Tonic', 'Speedwing', 'Bullion (L)', 'Goddess Staff']);
    const floor = map('chapter-18').items.filter((i) => i.play?.kind === 'collapse');
    expect(floor.map((i) => [i.item, i.play!.lostOn])).toEqual([
      ['Second Seal', { turn: 11, phase: 'enemy' }],
      ['Energy Drop', { turn: 10, phase: 'enemy' }],
      ['Rescue', { turn: 11, phase: 'player' }],
      ['Bullion (M)', { turn: 7, phase: 'enemy' }],
    ]);
    expect(map('paralogue-6').items.filter((i) => i.play?.kind === 'result').map((i) => [i.item, i.play!.tier])).toEqual([
      ['Elixir', 1],
      ['Killing Edge', 2],
      ['Speedwing', 3],
      ['Bullion (M)', 4],
      ['Hammerne', 5],
    ]);
    expect(flagged('paralogue-7', 'result')).toHaveLength(5);
    expect(flagged('paralogue-11', 'result')).toHaveLength(5);
    expect(flagged('paralogue-11', 'result')).not.toContain('Morristan');
    expect(flagged('paralogue-3', 'result')).toEqual(['Seraph Robe', 'Log', 'Ladle']);
    expect(flagged('paralogue-13', 'result')).toHaveLength(8);
    expect(flagged('chapter-6', 'choice')).toEqual(['Iron Sword']);
    expect(flagged('paralogue-5', 'choice')).toEqual(['Missiletainn', 'Speed Tonic']);
    // Fixed items stay unflagged: Orton's Bullion, Morristan's.
    expect(map('chapter-5').items.every((i) => !i.play)).toBe(true);
    expect(engine.mapGold('paralogue-11')[0]).toMatchObject({ how: 'Dropped by Morristan', play: undefined });
  });

  it('says Awakening has no preparations shop on any difficulty (C1)', () => {
    expect(SEAL_RULES.prepShop).toBe(false);
    expect('prepShopOnHardUp' in SEAL_RULES).toBe(false);
  });
});

describe('where a run’s gold comes from (#180)', () => {
  it('starts at 5,000G and sells Bullion at half its worth: (S) 1,000G, (M) 5,000G, (L) 10,000G', () => {
    expect(STARTING_GOLD).toBe(5000);
    expect(['Bullion (S)', 'Bullion (M)', 'Bullion (L)'].map((n) => sellPrice(item(n)))).toEqual([1000, 5000, 10000]);
  });

  it('comes to 100,000G of Bullion on the story maps and 110,000G on the paralogues, 25,000G and 50,000G of it at risk', () => {
    expect(bullion(story.map((m) => m.id))).toBe(100000);
    expect(bullion(paralogues.map((m) => m.id))).toBe(110000);
    const atRisk = (ms: typeof maps) => ms.flatMap((m) => engine.mapGold(m.id)).filter((r) => r.kind === 'bullion' && r.play).reduce((a, r) => a + r.gold, 0);
    expect(atRisk(story)).toBe(25000);
    // The research's summary says 45,000G, but its own P6, P7, P9, P11, P12, P13 and P14 rows add up to 50,000G.
    expect(atRisk(paralogues)).toBe(50000);
  });

  it('reaches 40,000G by the end of Chapter 12, selling every Bullion at once', () => {
    const upTo12 = story.filter((m) => m.order <= map('chapter-12').order).map((m) => m.id);
    expect(STARTING_GOLD + bullion(upTo12)).toBe(40000);
  });

  it('counts a Roster Rescue carrier’s seven Bullion (S) as 7,000G, each Revenant able to escape with its own', () => {
    expect(engine.mapGold('roster-rescue')).toEqual([expect.objectContaining({ kind: 'bullion', gold: 7000, play: expect.objectContaining({ kind: 'escape' }) })]);
  });
});

describe('selling (#180)', () => {
  it('pays half the worth, scaled by the uses left, rounded down', () => {
    const v = item('Vulnerary');
    expect([3, 2, 1].map((u) => sellPrice(v, u))).toEqual([150, 100, 50]);
    expect(sellPrice(item('Master Seal'))).toBe(1250);
    expect(sellPrice(item('Naga’s Tear'))).toBe(2500);
    expect(sellPrice(item('Missiletainn'))).toBe(525);
    expect(sellRate(item('Silver Lance'))).toEqual({ kind: 'half' });
  });

  it('pays a quarter for the event-tile and Barracks pool, the seven items the notes miss included', () => {
    const quarter = [
      'Sweet Tincture', 'Gaius’s Confect', 'Kris’s Confect', 'Tiki’s Tear', 'Seed of Trust', 'Reeking Box', 'Rift Door',
      'Tree Branch', 'Glass Sword', 'Soothing Sword', 'Superior Edge', 'Leif’s Blade', 'Roy’s Blade', 'Eliwood’s Blade', 'Eirika’s Blade', 'Seliph’s Blade', 'Alm’s Blade',
      'Log', 'Glass Lance', 'Miniature Lance', 'Shockstick', 'Superior Lance', 'Finn’s Lance', 'Ephraim’s Lance', 'Sigurd’s Lance',
      'Ladle', 'Glass Axe', 'Imposing Axe', 'Volant Axe', 'Superior Axe', 'Orsin’s Hatchet', 'Titania’s Axe', 'Hector’s Axe',
      'Slack Bow', 'Glass Bow', 'Towering Bow', 'Underdog Bow', 'Superior Bow', 'Wolt’s Bow', 'Innes’ Bow',
      'Dying Blaze', 'Micaiah’s Pyre', 'Superior Jolt', 'Katarina’s Bolt', 'Wilderwind', 'Celica’s Gale', 'Aversa’s Night',
      'Kneader', 'Balmwood Staff', 'Catharsis',
    ];
    expect(quarter).toHaveLength(50);
    for (const n of quarter) expect(itemByName(n) && sellRate(itemByName(n)!), n).toEqual({ kind: 'quarter' });
    expect(ITEMS.filter((i) => sellRate(i).kind === 'quarter')).toHaveLength(50);
    expect(sellPrice(item('Sweet Tincture'))).toBe(37);
    expect(sellPrice(item('Superior Edge'))).toBe(487);
  });

  it('pays nothing for legendary weapons and DLC rewards, and 99,999G for the Supreme Emblem', () => {
    for (const n of ['Sol', 'Amatsu', 'Goetia', 'Falchion', 'Paragon', 'Limit Breaker', 'Goddess Staff']) {
      expect(sellRate(item(n)), n).toEqual({ kind: 'none' });
      expect(sellPrice(item(n)), n).toBe(0);
    }
    expect(sellRate(item('Supreme Emblem'))).toEqual({ kind: 'fixed', gold: 99999 });
    expect(sellPrice(item('Supreme Emblem'))).toBe(99999);
  });
});

describe('renown (#180)', () => {
  it('gives 10 per story map, and paralogues and DLC maps nothing unless the assumption says otherwise', () => {
    expect(RENOWN.perStoryMap).toBe(10);
    expect(engine.renownGain('chapter-4')).toBe(10);
    expect(engine.renownGain('paralogue-1')).toBe(0);
    expect(engine.renownGain('roster-rescue')).toBe(0);
    expect(engine.assumptions().some((a) => a.id === 'paralogue-renown')).toBe(true);
    const generous = createEngine(resolveAssumptions({ 'paralogue-renown': 10 }));
    expect(generous.renownGain('paralogue-1')).toBe(10);
  });

  it('holds the rewards at their thresholds: the Second Seal at 100, the Bullion (L) at 1,000', () => {
    expect(RENOWN.rewards).toHaveLength(33);
    expect(RENOWN.rewards.find((r) => r.renown === 100)?.item).toBe('Second Seal');
    expect(RENOWN.rewards.find((r) => r.renown === 1000)?.item).toBe('Bullion (L)');
    for (const r of RENOWN.rewards) expect(itemByName(r.item), r.item).toBeDefined();
    const ascending = RENOWN.rewards.map((r) => r.renown);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  });

  it('lists the rewards crossed between two renown values', () => {
    expect(engine.renownRewards(90, 150).map((r) => r.item)).toEqual(['Second Seal', "Orsin's Hatchet"]);
    expect(engine.renownRewards(100, 149)).toEqual([]);
  });
});
