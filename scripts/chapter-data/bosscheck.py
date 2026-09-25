"""Cross-check FEW boss rows (parsed) against SF boss data, per difficulty, and name the bosses from SF.

  uv run python bosscheck.py <parsed.json> <cache dir> <section>...   (sections: chapters, paralogues, xenologues)

Reads <cache>/sf-boss-<difficulty>-<section>.html. SF's first column is the chapter ("Pre.", "Pro.", "1"…, "End"), the
paralogue number, or the xenologue's name.
"""
import html
import json
import re
import sys

STORY = {'Pre.': 'premonition', 'Pro.': 'prologue', 'End': 'endgame', 'End.': 'endgame', 'Endgame': 'endgame'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', '')).strip('-')


def map_id(section, c0):
    c0 = c0.strip()
    if section == 'chapters':
        return STORY.get(c0, f'chapter-{c0}' if c0.isdigit() else slug(c0))
    if section == 'paralogues':
        n = re.sub(r'\D', '', c0)
        return f'paralogue-{n}' if n else slug(c0)
    return slug(re.sub(r'^Xenologue:\s*', '', c0))


def sf_rows(path, section):
    s = open(path, encoding='utf-8', errors='replace').read()
    out, last = [], None
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
        c = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip() for x in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)]
        if len(c) < 12 or c[0] in ('Ch', 'Chapter', 'Par', 'Paralogue', 'Name', 'Episode', 'DLC'):
            continue
        # A row that shares the map cell above (rowspan) has one cell fewer.
        if len(c) >= 16:
            last = c[0]
            name, cls, lv, stats = c[1], c[2], c[3], c[4:12]
        else:
            name, cls, lv, stats = c[0], c[1], c[2], c[3:11]
        if last is None:
            continue
        out.append({'map': map_id(section, last), 'name': name, 'class': cls, 'level': lv, 'stats': dict(zip(['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'], stats))})
    return out


def num(v):
    m = re.match(r'\s*(\d+)\s*(?:\+\s*(\d+))?', v or '')
    return int(m.group(1)) + int(m.group(2) or 0) if m else None


if __name__ == '__main__':
    path, cache, sections = sys.argv[1], sys.argv[2], sys.argv[3:]
    data = json.load(open(path, encoding='utf-8'))
    by_map = {r['id']: r for r in data}
    labels = {slug(r.get('title') or ''): r['id'] for r in data}
    report = []
    for section in sections:
        for d in ['normal', 'hard', 'lunatic']:
            for sf in sf_rows(f'{cache}/sf-boss-{d}-{section}.html', section):
                rec = by_map.get(sf['map']) or by_map.get(labels.get(sf['map'], ''))
                if not rec:
                    continue
                few = [b for b in rec['bosses'].get(d, []) if b['class'] == sf['class'] and b['level'] == sf['level'] and not b.get('name')]
                few = few or [b for b in rec['bosses'].get(d, []) if b['class'] == sf['class'] and b['level'] == sf['level']]
                # Several bosses can share a class and level (Apotheosis): take the closest.
                few.sort(key=lambda b: sum(num(sf['stats'][k]) != num(b['stats'][k]) for k in sf['stats']))
                if not few:
                    # Sub-bosses (Deadlords, a flashback Validar) are only in FEW's enemy tables: take the row there.
                    groups = [g for g in rec['enemies'].get(d, []) if sf['name'] in (g['name'] or '') and g['level'] == sf['level']]
                    groups = groups or [g for g in rec['enemies'].get(d, []) if g['class'] == sf['class'] and g['level'] == sf['level'] and g['count'] == '1']
                    if not groups:
                        report.append(f"{rec['id']} {d} {sf['name']}: no FEW boss or enemy row ({sf['class']} Lv {sf['level']})")
                        continue
                    g = groups[0]
                    few = [{'class': g['class'], 'level': g['level'], 'stats': g['stats'], 'items': g['items'], 'skills': g.get('skills', [])}]
                    rec['bosses'].setdefault(d, []).append(few[0])
                b = few[0]
                b['name'] = sf['name']
                if all(not v for v in sf['stats'].values()):
                    report.append(f"{rec['id']} {d} {sf['name']}: SF row blank")
                    continue
                diffs = [f"{k} SF {sf['stats'][k]} / FEW {b['stats'][k]}" for k in sf['stats'] if num(sf['stats'][k]) != num(b['stats'][k])]
                report.append(f"{rec['id']} {d} {sf['name']}: " + ('agree' if not diffs else 'DIFFER ' + '; '.join(diffs)))
    # A boss SF doesn't list takes the name the map's infobox gives.
    for rec in data:
        for rows in rec['bosses'].values():
            for b in rows:
                if not b.get('name') and rec.get('bossName'):
                    b['name'] = rec['bossName']
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    agree = sum(r.endswith('agree') for r in report)
    print(f'{agree} of {len(report)} SF boss rows agree')
    print('\n'.join(r for r in report if not r.endswith('agree')))
