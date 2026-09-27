"""Build one group of chapter data end to end (#109-#114).

  uv run python build.py <cache dir> <group> <CONST> "<range text>" <ticket> <map id>...

Fetches each map's FEW page at its oldid (all-maps.json) into the cache, parses it, names the bosses and cross-checks
their stats against SF's boss data, and writes src/game-data/chapters/<group>.ts. The cross-check report is printed.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
UA = {'User-Agent': 'fe13-child-calc chapter-data build (personal project)'}

cache, group, const, rng, ticket, ids = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:]
os.makedirs(cache, exist_ok=True)
ALL = {m['id']: m for m in json.load(open(os.path.join(HERE, 'all-maps.json'), encoding='utf-8'))}

# Paralogue unlocks (SF gaiden chapters; research/chapter-data §2): after these chapters.
PARALOGUE_AFTER = {1: 3, 2: 5, 3: 7, 4: 9, **{p: 13 for p in range(5, 17)}, 17: 18, **{p: 25 for p in range(18, 24)}}
GRIND = {'the-golden-gaffe', 'exponential-growth', 'infinite-regalia'}
# Forced units the page's ChapChars leaves out (#132): Apotheosis's own strategy says "Chrom must be fielded as usual".
FORCED = {'apotheosis': ['Chrom']}

# Fixes the gold research found in the pages (#180; research/gold-economy §5-§6), applied by gents.py, which fails when one
# no longer matches the page. `prices`: FEW price typos, by the item's worth on every other source (C2-C5). `noDrop`:
# P18's Lunatic tab flags ten weapons as drops that no other source has, FEW's own P18 item list included (C13).
FIXES = {
    'prologue': {'prices': [{'list': 'armory', 'item': 'Bronze Lance', 'cost': 350}, {'list': 'armory', 'item': 'Bronze Axe', 'cost': 400}]},
    'chapter-8': {'prices': [{'list': 'merchant', 'item': 'Ward', 'cost': 2100}]},
    'chapter-18': {'prices': [{'list': 'merchant', 'item': 'Thoron', 'cost': 2200}]},
    'paralogue-18': {
        'prices': [{'list': 'armory', 'item': 'Dragonstone+', 'cost': 3780}, {'list': 'armory', 'item': 'Beaststone+', 'cost': 3220}],
        'noDrop': [{'difficulty': 'lunatic', 'enemy': 'Ruffian', 'items': ['Tomahawk', 'Hammer', 'Silver Sword', 'Silver Bow', 'Rexcalibur']}],
    },
}


def play(kind, note, **more):
    return {'kind': kind, 'note': note, **more}


# What play can lose, which the pages hold only as text (#180; research/gold-economy §1.4). Each entry marks the item
# rows whose `item` (when given) matches and whose `how` starts with `how` (when given). Kinds: `escape` (an enemy can
# leave the map with it: a carrier, or a Thief that loots the chest), `village` (Barbarians or Berserkers can burn the
# village, C10), `collapse` (the floor takes the chest on a set turn), `result` (paid by how the map went; `tier` is the
# kills or survivors needed), `choice` (one of two outcomes the player picks). `gold` is numeric gold (P13, C8).
THIEF = 'Carried by an escaping Thief: lost if it gets off the map.'
LOOTER = 'A Thief can loot this chest and escape with it; kill it before it leaves to get the item back.'
BURN = 'Barbarians and Berserkers can burn the village, and its reward is lost.'
MIRAGE = 'Mirage villages, visited in order; none appears if any village is burned.'
RECRUIT = 'The unit’s own weapon: dropped only if the unit is killed rather than recruited.'
P13 = 'Backing a side makes its leader allied (no Bullion) and closes two villages; backing neither pays 10,000G.'
PLAY = {
    'chapter-6': [{'how': 'Dropped by Gaius if killed', 'play': play('choice', RECRUIT)}],
    'chapter-9': [{'how': 'Dropped by Tharja if killed', 'play': play('choice', RECRUIT)}],
    'chapter-10': [{'how': 'Dropped by enemy Thief', 'play': play('escape', THIEF)}],
    'chapter-11': [{'item': 'Bullion (L)', 'how': 'Open western chest', 'play': play('escape', LOOTER)}],
    'chapter-16': [{'how': 'Dropped by enemy Thief', 'play': play('escape', THIEF)}],
    'chapter-17': [{'item': 'Seraph Robe', 'how': 'Open eastern chest', 'play': play('escape', LOOTER)}],
    'chapter-18': [
        {'item': 'Second Seal', 'play': play('collapse', 'The floor collapses under the chest on turn 11 enemy phase.', lostOn={'turn': 11, 'phase': 'enemy'})},
        {'item': 'Energy Drop', 'how': 'Open', 'play': play('collapse', 'The floor collapses under the chest on turn 10 enemy phase.', lostOn={'turn': 10, 'phase': 'enemy'})},
        {'item': 'Rescue', 'play': play('collapse', 'The floor collapses under the chest on turn 11 player phase.', lostOn={'turn': 11, 'phase': 'player'})},
        {'item': 'Bullion (M)', 'play': play('collapse', 'The floor collapses under the chest on turn 7 enemy phase.', lostOn={'turn': 7, 'phase': 'enemy'})},
    ],
    'chapter-20': [{'item': 'Spirit Dust', 'how': 'Open', 'play': play('escape', LOOTER)}],
    'paralogue-1': [{'item': 'Killer Lance', 'play': play('escape', LOOTER)}],
    'paralogue-2': [{'item': 'Physic', 'how': 'Visit', 'play': play('village', BURN)}],
    'paralogue-3': [
        {'item': 'Seraph Robe', 'play': play('result', 'At the end if at least one NPC Villager survives.', tier=1)},
        {'item': 'Log', 'play': play('result', 'At the end if at least two NPC Villagers survive.', tier=2)},
        {'item': 'Ladle', 'play': play('result', 'At the end if all three NPC Villagers survive.', tier=3)},
    ],
    'paralogue-4': [{'item': 'Arms Scroll', 'play': play('escape', LOOTER)}],
    'paralogue-5': [{'item': 'Missiletainn', 'play': play('choice', 'Speak to the southeastern Sage with Owain; anyone else gets the Speed Tonic.')},
                    {'item': 'Speed Tonic', 'play': play('choice', 'Speak to the southeastern Sage with anyone but Owain; Owain gets Missiletainn.')}],
    'paralogue-6': [{'item': it, 'how': 'At chapter', 'play': play('result', f'At the end if Inigo got at least {n} kill{"s" if n > 1 else ""}.', tier=n)}
                    for n, it in enumerate(['Elixir', 'Killing Edge', 'Speedwing', 'Bullion (M)', 'Hammerne'], 1)],
    'paralogue-7': [{'item': it, 'how': 'At chapter', 'play': play('result', f'At the end if at least {n} NPC Villager{"s survive" if n > 1 else " survives"}.', tier=n)}
                    for n, it in enumerate(['Mend', 'Blessed Lance', 'Bullion (M)', 'Seraph Robe', 'Fortify'], 1)],
    'paralogue-9': [{'item': 'Bullion (L)', 'how': 'Dropped by Ruger', 'play': play('escape', 'Ruger escapes with it if he gets off the map.')}],
    'paralogue-11': [{'item': it, 'how': 'At chapter', 'play': play('result', f'At the end if at least {n} NPC Villager{"s survive" if n > 1 else " survives"}.', tier=n)}
                     for n, it in enumerate(['Wyrmslayer', 'Arms Scroll', 'Recover', 'Bullion (M)', 'Seraph Robe'], 1)],
    'paralogue-12': [{'how': 'Open', 'play': play('escape', 'Two Thieves loot chests here and escape (which chests isn’t published); kill them before they leave.')}],
    'paralogue-13': [
        {'how': 'Dropped by', 'play': play('result', P13)},
        {'how': 'Visit', 'play': play('result', P13)},
        {'item': '500G', 'play': play('result', 'Paid when you back a side: 500G for each allied NPC that survives.'), 'gold': {'amount': 500, 'per': 'surviving allied NPC'}},
        {'item': '10,000G', 'play': play('result', 'Paid when you back neither side.'), 'gold': {'amount': 10000}},
    ],
    'paralogue-14': [{'how': 'Visit', 'play': play('village', MIRAGE)}, {'item': 'Goddess Staff', 'play': play('village', MIRAGE)}],
    'paralogue-18': [{'how': 'Dropped by Gangrel if killed', 'play': play('choice', RECRUIT)}],
    'roster-rescue': [{'how': 'Dropped by enemy Revenant', 'play': play('escape', 'Each Revenant that escapes takes its Bullion.')}],
}


def order(m):
    """List order: story maps by hundreds, each paralogue just after the chapter that unlocks it, then the xenologues."""
    i = m['id']
    if i == 'premonition':
        return 0
    if i == 'prologue':
        return 50
    if i == 'endgame':
        return 2700
    if i.startswith('chapter-'):
        return (int(i[8:]) + 1) * 100
    if i.startswith('paralogue-'):
        p = int(i[10:])
        after = PARALOGUE_AFTER[p]
        return (after + 1) * 100 + 1 + [q for q in sorted(PARALOGUE_AFTER) if PARALOGUE_AFTER[q] == after].index(p)
    xen = [k for k, v in ALL.items() if v['kind'] == 'xenologue']
    return 3000 + xen.index(i)


def unlocks(m):
    i = m['id']
    if i == 'premonition':
        return ['prologue']
    if i == 'prologue':
        return ['chapter-1']
    if i.startswith('chapter-'):
        n = int(i[8:])
        nxt = [f'chapter-{n + 1}'] if n < 25 else ['endgame']
        return nxt + [f'paralogue-{p}' for p, c in sorted(PARALOGUE_AFTER.items()) if c == n]
    return []


def fetch(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
        time.sleep(1)
    return path


maps, extra = [], {'__range': rng, '__ticket': ticket}
for i in ids:
    m = ALL[i]
    f = fetch(f"https://fireemblemwiki.org/w/index.php?oldid={m['oldid']}&action=raw", os.path.join(cache, f"{i}.wiki"))
    maps.append({'id': i, 'file': f, 'page': m['page'], 'oldid': m['oldid']})
    extra[i] = {'kind': m['kind'], 'order': order(m), 'label': m['label'], 'unlocks': unlocks(m), **({'grind': True} if i in GRIND else {}), **({'forced': FORCED[i]} if i in FORCED else {}), **({'fixes': FIXES[i]} if i in FIXES else {}), **({'play': PLAY[i]} if i in PLAY else {})}

parsed = os.path.join(cache, f'{group}.json')
subprocess.run([sys.executable, os.path.join(HERE, 'fewparse.py'), json.dumps(maps), parsed], check=True)
kinds = {m['kind'] for m in (ALL[i] for i in ids)}
section = {'story': 'chapters', 'paralogue': 'paralogues', 'xenologue': 'xenologues'}
for d in ['normal', 'hard', 'lunatic']:
    for k in kinds:
        fetch(f'https://serenesforest.net/awakening/characters/boss-data/{d}/{section[k]}/', os.path.join(cache, f'sf-boss-{d}-{section[k]}.html'))
subprocess.run([sys.executable, os.path.join(HERE, 'bosscheck.py'), parsed, cache, *[section[k] for k in kinds]], check=True)
subprocess.run([sys.executable, os.path.join(HERE, 'gents.py'), parsed, os.path.join(ROOT, 'src', 'game-data', 'chapters', f'{group}.ts'), const, json.dumps(extra)], check=True)
json.dump([{k: v for k, v in m.items() if k != 'file'} for m in maps], open(os.path.join(HERE, f'{group}-maps.json'), 'w', encoding='utf-8'), indent=1)
json.dump(extra, open(os.path.join(HERE, f'{group}-extra.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
