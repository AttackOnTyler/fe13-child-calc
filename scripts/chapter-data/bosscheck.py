"""Cross-check FEW boss rows (parsed) against SF boss data, per difficulty; adds boss names from SF."""
import html
import json
import re
import sys

ID = {'Pre.': 'premonition', 'Pro.': 'prologue'}


def sf_rows(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    out = []
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
        c = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip() for x in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)]
        if len(c) < 13 or c[0] == 'Ch':
            continue
        mid = ID.get(c[0], f'chapter-{c[0]}' if c[0].isdigit() else c[0].lower())
        out.append({'map': mid, 'name': c[1], 'class': c[2], 'level': c[3], 'stats': dict(zip(['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'], c[4:12]))})
    return out


def num(v):
    m = re.match(r'\s*(\d+)(?:\+(\d+))?', v or '')
    return int(m.group(1)) + int(m.group(2) or 0) if m else None


data = json.load(open(sys.argv[1], encoding='utf-8'))
by_map = {r['id']: r for r in data}
report = []
for d in ['normal', 'hard', 'lunatic']:
    for sf in sf_rows(f'sf-boss-{d}.html'):
        rec = by_map.get(sf['map'])
        if not rec:
            continue
        few = [b for b in rec['bosses'].get(d, []) if b['class'] == sf['class'] and b['level'] == sf['level']]
        if not few:
            report.append(f"{sf['map']} {d} {sf['name']}: no FEW boss row")
            continue
        b = few[0]
        b['name'] = sf['name']
        diffs = [f"{k} SF {sf['stats'][k]} / FEW {b['stats'][k]}" for k in sf['stats'] if num(sf['stats'][k]) != num(b['stats'][k])]
        report.append(f"{sf['map']} {d} {sf['name']}: " + ('agree' if not diffs else '; '.join(diffs)))
json.dump(data, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n'.join(report))
