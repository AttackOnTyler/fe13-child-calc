"""Emit a chapter-data TS module from parsed FEW records (#109)."""
import json
import sys

src, out, const, extra = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
data = json.load(open(src, encoding='utf-8'))
def apply_fixes(r, fixes, plays):
    """The extra file's fixes and play-dependence flags (#180), each failing loudly when it no longer matches the page."""
    for f in fixes.get('prices', []):
        rows = [x for x in r['shop'][f['list']] if x['item'] == f['item']]
        assert rows, f"{r['id']}: no {f['list']} {f['item']}"
        for x in rows:
            x['cost'] = f['cost']
    for f in fixes.get('noDrop', []):
        hit = 0
        for g in r['enemies'][f['difficulty']]:
            if g['name'] != f['enemy']:
                continue
            for it in g['items']:
                if it['name'] in f['items'] and it.pop('drop', False):
                    hit += 1
        assert hit, f"{r['id']}: no {f['enemy']} drops to clear"
    for p in plays:
        rows = [x for x in r['items'] if ('item' not in p or x['item'] == p['item']) and ('how' not in p or x['how'].startswith(p['how']))]
        assert rows, f"{r['id']}: no item row for {p}"
        for x in rows:
            x['play'] = p['play']
            if 'gold' in p:
                x['gold'] = p['gold']


recs = []
for r in data:
    e = extra[r['id']]
    apply_fixes(r, e.get('fixes', {}), e.get('play', []))
    rec = {
        'id': r['id'],
        'kind': e['kind'],
        'order': e['order'],
        'label': e['label'],
        'title': r['title'],
        **({'location': r['location']} if r.get('location') else {}),
        'conditions': r['conditions'],
        'recruits': r['recruits'],
        'forced': e.get('forced', r['forced']),
        'items': r['items'],
        'shop': r['shop'],
        'eventTiles': r['eventTiles'],
        'enemies': r['enemies'],
        'reinforcements': r['reinforcements'],
        'lunaticPlusPool': r['lunaticPlusPool'],
        'bosses': r['bosses'],
        'unlocks': e.get('unlocks', []),
        **({'grind': True} if e.get('grind') else {}),
        'source': {'page': r['page'], 'oldid': r['oldid']},
    }
    recs.append(rec)
def one(v):
    return json.dumps(v, ensure_ascii=False)


def emit(rec):
    lines = ['  {']
    for k, v in rec.items():
        if isinstance(v, dict) and v and all(isinstance(x, list) for x in v.values()):
            lines.append(f'    {k}: {{')
            for d, rows in v.items():
                key = d if d.isidentifier() else one(d)
                lines.append(f'      {key}: [')
                lines += [f'        {one(r)},' for r in rows]
                lines.append('      ],')
            lines.append('    },')
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            lines.append(f'    {k}: [')
            lines += [f'      {one(r)},' for r in v]
            lines.append('    ],')
        else:
            lines.append(f'    {k}: {one(v)},')
    lines.append('  },')
    return NL.join(lines)


NL = chr(10)
body = '[' + NL + NL.join(emit(r) for r in recs) + NL + ']'

head = f"""/**
 * Chapter data for {extra['__range']} (#{extra['__ticket']}): generated from Fire Emblem Wiki chapter pages at the oldids in
 * each record's `source`, parsed from the templates (ChapData, ChapChars, ChapItems, ChapShop 3DS, ChapUnitCellFE13,
 * BossStats FE13), with boss names and a stat cross-check from SF boss data (all rows agree). Don't hand-edit: regenerate.
 */
import type {{ ChapterData }} from '../chapters';

export const {const}: readonly ChapterData[] = {body};
"""
open(out, 'w', encoding='utf-8', newline='\n').write(head)
print(len(recs), 'maps')
