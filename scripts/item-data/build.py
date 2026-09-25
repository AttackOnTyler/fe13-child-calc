"""Weapon and item data (#115): Serenes Forest's inventory tables, cross-checked against Fire Emblem Wiki's lists.

  uv run python build.py <cache dir>

Reads <cache>/<swords|lances|axes|bows|tomes|staves|stones-miscellaneous|items>.html (SF, /awakening/inventory/<page>/)
and few-weapons.wiki, few-items.wiki (FEW list pages, revids below); prints every disagreement and writes
src/game-data/items.ts.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
cache = sys.argv[1]
FEW_WEAPONS_REVID, FEW_ITEMS_REVID = 747869, 748095
KINDS = {'swords': 'sword', 'lances': 'lance', 'axes': 'axe', 'bows': 'bow', 'tomes': 'tome', 'staves': 'staff', 'stones-miscellaneous': 'stone', 'items': 'item'}
DASH = {'', '—', '–', '-', '�'}


def cells(r):
    return [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<br\s*/?>', ' / ', re.sub(r'<(?!br)[^>]+>', ' ', x)))).strip() for x in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)]


def val(v):
    return None if v in DASH else v


def norm(name):
    """One spelling for both sites: straight apostrophes, American spelling."""
    # FEW writes a bullion as "Bullion<br><small>(Bullion (M))</small>": keep the inner name.
    small = re.search(r'<small>\((.*)\)</small>', name)
    if small:
        name = small.group(1)
    return name.replace('’', "'").replace('Armour', 'Armor').replace('armour', 'armor').replace('Defence', 'Defense').replace('Lnce', 'Lance').strip()


def num(v):
    v = val(v)
    if v is None:
        return None
    # SF marks some worths and uses with a footnote: "100 * 2".
    v = re.sub(r'\s*\*.*$', '', v.replace(',', ''))
    if v.upper() == 'N/A':
        return None
    return int(v) if re.fullmatch(r'-?\d+', v) else v


def sf_items():
    out = []
    for page, kind in KINDS.items():
        s = open(os.path.join(cache, f'{page}.html'), encoding='utf-8', errors='replace').read()
        head = None
        for r in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
            c = cells(r)
            if 'Name' in c:
                head = c
                continue
            if not head or len(c) != len(head):
                continue
            row = dict(zip(head, c))
            it = {'name': norm(row['Name']), 'kind': kind}
            if kind == 'stone' and row['Name'] in ('Beaststone', 'Beaststone+'):
                it['kind'] = 'beaststone'
            for k, key in (('Rank', 'rank'), ('Mt', 'mt'), ('Hit', 'hit'), ('Crit', 'crit'), ('Rng', 'range'), ('Uses', 'uses'), ('Worth', 'worth'), ('Exp', 'exp')):
                if k in row:
                    v = num(row[k]) if key not in ('rank', 'range') else val(row[k])
                    if v is not None:
                        it[key] = v
            eff = val(row.get('Effect'))
            if eff:
                it['effective'] = eff
            desc = val(row.get('Description'))
            if desc:
                it['description'] = desc
            out.append(it)
    return out


def few_rows(path):
    t = open(path, encoding='utf-8').read()
    rows = []
    for block in t.split('\n|-')[1:]:
        cols = [re.sub(r'^\s*\|\s*', '', l) for l in block.strip().split('\n') if l.strip().startswith('|') and not l.strip().startswith('|}')]
        cols = [re.sub(r'^data-sort-value="[^"]*"\s*\|\s*', '', c) for c in cols]
        if len(cols) < 3:
            continue
        name = norm(re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', cols[0]))
        rows.append((name, cols))
    return rows


def clean(s):
    s = re.sub(r'\{\{nwh\}\}', '', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'<br\s*/?>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


items = sf_items()
by_name = {i['name']: i for i in items}
report = []
few_weapons = {n: c for n, c in few_rows(os.path.join(cache, 'few-weapons.wiki'))}
for name, c in few_weapons.items():
    # Weapon, Icon, Type, Level, Might, Hit, Crit, Range, Uses, Worth, Notes (staves leave Might/Hit/Crit empty or dashed)
    i = by_name.get(name)
    if not i:
        report.append(f'{name}: on FEW, not SF')
        continue
    staff = i['kind'] == 'staff'
    few = {'rank': clean(c[3]), 'mt': num(clean(c[4])), 'hit': num(clean(c[5])), 'crit': num(clean(c[6])), 'range': clean(c[7]).replace('�', '~').replace('–', '~'), 'uses': num(clean(c[8])), 'worth': num(clean(c[9]))}
    notes = clean(c[10]) if len(c) > 10 else ''
    if notes:
        i['notes'] = notes
    diffs = []
    for k, v in few.items():
        sfv = i.get(k)
        if k == 'range' and isinstance(sfv, str):
            sfv = sfv.replace('�', '~').replace('–', '~')
        if v in (None, '', '—', '–') and sfv is None:
            continue
        # FEW puts a staff's heal amount under Might; SF has no Mt/Hit/Crit for staves.
        if staff and k in ('mt', 'hit', 'crit'):
            continue
        if k == 'range' and str(v).replace(' ', '').lower().replace('magic', 'mag') == str(sfv).replace(' ', '').lower():
            continue
        # SF leaves a legendary weapon's uses and worth blank; FEW writes ∞ and 0.
        if (k, sfv, v) in (('uses', None, '∞'), ('worth', None, 0)):
            continue
        if str(v) != str(sfv):
            diffs.append(f'{k} SF {sfv} / FEW {v}')
    if diffs:
        report.append(f'{name}: ' + '; '.join(diffs))
few_items = {n: c for n, c in few_rows(os.path.join(cache, 'few-items.wiki'))}
for name, c in few_items.items():
    i = by_name.get(name)
    if not i:
        report.append(f'{name}: on FEW items, not SF')
        continue
    uses, worth = num(clean(c[2])), num(clean(c[3]))
    diffs = [f'{k} SF {i.get(k)} / FEW {v}' for k, v in (('uses', uses), ('worth', worth)) if v is not None and str(v) != str(i.get(k))]
    if diffs:
        report.append(f'{name}: ' + '; '.join(diffs))
for i in items:
    if i['kind'] not in ('item',) and i['name'] not in few_weapons:
        report.append(f"{i['name']}: on SF, not FEW's weapon list")

print(len(items), 'items;', len(report), 'report lines')
print('\n'.join(report))
json.dump(items, open(os.path.join(cache, 'items.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


# ---- emit src/game-data/items.ts ----
EFFECTIVE = ['fell dragon', 'dragon', 'flying', 'armored', 'beast', 'monster']


def effective_of(notes):
    m = re.search(r'Deals bonus damage to ([^.]*?) units', notes or '')
    if not m:
        return []
    text, out = m.group(1), []
    for e in EFFECTIVE:
        if e in text:
            out.append(e)
            text = text.replace(e, '')
    return out


for i in items:
    notes = i.get('notes') or i.get('description') or ''
    eff = effective_of(notes)
    if eff:
        i['effective'] = eff
    else:
        i.pop('effective', None)
    if re.search(r'Strikes twice', notes):
        i['brave'] = True
    if re.search(r'magic damage', notes):
        i['magic'] = True
    only = re.match(r'([^.]*?) only\.', notes)
    if only:
        i['only'] = only.group(1)
    # SF: any weapon with a non-zero Worth can be forged, except Mire; FEW notes the ones that can't.
    weapon = i['kind'] in ('sword', 'lance', 'axe', 'bow', 'tome')
    i['forgeable'] = weapon and isinstance(i.get('worth'), int) and i['worth'] > 0 and i['name'] != 'Mire' and 'Cannot be forged' not in notes and 'cannot be forged' not in notes


def ts(v):
    return json.dumps(v, ensure_ascii=False)


keys = ['name', 'kind', 'rank', 'mt', 'hit', 'crit', 'range', 'uses', 'worth', 'exp', 'effective', 'brave', 'magic', 'only', 'forgeable', 'notes', 'description']
lines = []
for i in items:
    o = {k: i[k] for k in keys if k in i and i[k] not in (None, '')}
    if 'notes' in o and 'description' in o:
        o.pop('description')
    lines.append('  ' + ts(o) + ',')
head = f'''/**
 * Weapons, staves, tomes, stones and items (#115): Serenes Forest's inventory tables (/awakening/inventory/), with
 * effects, effectiveness and restrictions from Fire Emblem Wiki's lists (List of weapons in Fire Emblem Awakening,
 * revid {FEW_WEAPONS_REVID}; List of items, revid {FEW_ITEMS_REVID}), which cross-check every stat: see ITEM_DISAGREEMENTS.
 * Awakening weapons have no weight. Generated by scripts/item-data/build.py: don't hand-edit.
 */
import type {{ GameItem }} from '../items';

export const ITEM_LIST: readonly GameItem[] = [
'''
open(os.path.join(ROOT, 'src', 'game-data', 'items', 'list.ts'), 'w', encoding='utf-8', newline='\n').write(head + '\n'.join(lines) + '\n];\n')
print('wrote', len(lines))
