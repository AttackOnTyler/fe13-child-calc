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
    extra[i] = {'kind': m['kind'], 'order': order(m), 'label': m['label'], 'unlocks': unlocks(m), **({'grind': True} if i in GRIND else {})}

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
