"""Parse Fire Emblem Wiki chapter pages (raw wikitext) into chapter-data records (#109)."""
import json
import re
import sys

STATS = ['hp', 'str', 'mag', 'skill', 'spd', 'lck', 'def', 'res', 'mov']
STAT_KEY = {'hp': 'hp', 'str': 'str', 'mag': 'mag', 'skill': 'skl', 'spd': 'spd', 'lck': 'lck', 'def': 'def', 'res': 'res', 'mov': 'mov'}


def split_top(s, sep='|'):
    """Split on sep at brace/bracket depth 0."""
    out, cur, depth, i = [], [], 0, 0
    while i < len(s):
        two = s[i:i + 2]
        if two in ('{{', '[['):
            depth += 1; cur.append(two); i += 2; continue
        if two in ('}}', ']]'):
            depth -= 1; cur.append(two); i += 2; continue
        if s[i] == sep and depth == 0:
            out.append(''.join(cur)); cur = []; i += 1; continue
        cur.append(s[i]); i += 1
    out.append(''.join(cur))
    return out


def templates(text, name):
    """Every {{name ...}} in text, as (params dict, span)."""
    res = []
    pat = re.compile(r'\{\{\s*' + re.escape(name) + r'\s*(\||\n|\}\})')
    pos = 0
    while True:
        m = pat.search(text, pos)
        if not m:
            break
        start = m.start()
        depth, i = 0, start
        while i < len(text):
            if text.startswith('{{', i):
                depth += 1; i += 2; continue
            if text.startswith('}}', i):
                depth -= 1; i += 2
                if depth == 0:
                    break
                continue
            i += 1
        body = text[start + 2:i - 2]
        parts = split_top(body)[1:]
        params = {}
        n = 0
        for p in parts:
            if '=' in p and re.match(r'^\s*[\w# +-]+\s*=', p):
                k, v = p.split('=', 1)
                params[k.strip()] = v.strip()
            else:
                n += 1
                params[str(n)] = p.strip()
        res.append((params, (start, i)))
        pos = i
    return res


def clean(s):
    if s is None:
        return None
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    # {{h|shown|note}} -> shown (note)
    for _ in range(3):
        s = re.sub(r'\{\{h\|([^{}|]*)\|([^{}]*)\}\}', r'\1 (\2)', s)
    s = re.sub(r'\{\{Item\|13\|([^|}]*)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{hl\|([^|}]*)\|[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{FE13\}\}', 'Awakening', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = s.replace('&nbsp;', ' ').replace('&ndash;', '–')
    s = re.sub(r'<br\s*/?>', '; ', s)
    s = re.sub(r'<small>\s*\(?(.*?)\)?\s*</small>', r'(\1)', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r"'''?", '', s)
    return re.sub(r'\s+', ' ', s).strip()


DIFFS = ['normal', 'hard', 'lunatic']


def diffs_of(label):
    l = label.lower().strip()
    if 'all' in l or l == '':
        return DIFFS
    # A tab for Lunatic+ alone (Grima's) is its own entry; "Lunatic(+)" is Lunatic, which Lunatic+ shares.
    if l == 'lunatic+':
        return ['lunatic-plus']
    out = []
    for d in DIFFS:
        if d in l:
            out.append(d)
    return out


def tabs(text):
    """{{Tab ...}} blocks -> list of (label, content)."""
    res = []
    for params, _ in templates(text, 'Tab'):
        i = 1
        while f'tab{i}' in params:
            res.append((params[f'tab{i}'], params.get(f'content{i}', '')))
            i += 1
    return res


def all_tabs(text):
    """Every tab, nested tabs included (Apotheosis puts wave tabs inside route tabs)."""
    res = []
    for label, content in tabs(text):
        res.append((label, content))
        res += all_tabs(content)
    return res


def by_difficulty(text, name):
    """Templates named `name`, per difficulty: from a Tab, or one untabbed set for every difficulty."""
    out = {}
    t = tabs(text)
    if t:
        for label, content in t:
            found = templates(content, name)
            for d in diffs_of(label):
                if found:
                    out.setdefault(d, []).extend(p for p, _ in found)
    if not out:
        found = [p for p, _ in templates(text, name)]
        if found:
            for d in DIFFS:
                out[d] = found
    return out


def section(text, title, level=3):
    m = re.search(r'\n=' * 1 + r'{%d}\s*(?:\[\[)?%s(?:\]\])?s?\s*={%d}' % (level - 1, re.escape(title), level) if False else r'\n={%d}\s*(?:\[\[)?%s(?:\]\])?s?\s*={%d}\s*\n' % (level, re.escape(title), level), text)
    if not m:
        return ''
    rest = text[m.end():]
    n = re.search(r'\n={2,%d}[^=]' % level, rest)
    return rest[:n.start()] if n else rest


def items_of(inv):
    """ChapUnitCell inventory: items (first line, • separated) and skills (later lines), plus a random-skill note."""
    lines = re.split(r'<br\s*/?>', inv or '')
    items, skills, random_note = [], [], None
    for li, line in enumerate(lines):
        if '<small>' in line and 'skill' in line.lower():
            random_note = clean(line)
            continue
        entries = [e for e in re.split(r'•', line) if e.strip()]
        for e in entries:
            m = re.search(r'\{\{Item\|13\|([^|}]*)([^}]*)\}\}', e)
            if not m:
                continue
            name, rest = m.group(1).strip(), m.group(2)
            if li == 0:
                it = {'name': name}
                if 'type=drop' in rest:
                    it['drop'] = True
                if 'type=forged' in rest:
                    it['forged'] = True
                items.append(it)
            else:
                skills.append(name)
    return items, skills, random_note


def enemy_group(p):
    items, skills, rnd = items_of(p.get('inventory', ''))
    g = {
        'name': clean(p.get('name', '')),
        'class': clean(p.get('class', '')),
        'level': clean(p.get('lv', '')),
        'count': clean(p.get('#', '1')) or '1',
        'stats': {STAT_KEY[s]: clean(p.get(s, '')) for s in STATS},
        'items': items,
    }
    if 'skills' in p:
        _, sk, rnd2 = items_of('<br>' + p['skills'])
        skills = skills + sk
        rnd = rnd or rnd2
    if skills:
        g['skills'] = skills
    if rnd:
        g['randomSkills'] = rnd
    notes = clean(p.get('notes'))
    if notes:
        g['notes'] = notes
    return g


def bullets(block):
    """A bulleted section as lines, nesting kept as '→' prefixes."""
    out = []
    for line in block.split('\n'):
        m = re.match(r'^(\*+)\s*(.*)', line)
        if m:
            out.append(('  ' * (len(m.group(1)) - 1)) + clean(m.group(2)))
    return out


def parse(path, meta):
    text = open(path, encoding='utf-8').read()
    rec = dict(meta)
    info = templates(text, 'Chapter Infobox')
    if info:
        rec['title'] = clean(info[0][0].get('title')) or re.sub(r' \(.*\)$', '', meta['page'])
        rec['location'] = clean(info[0][0].get('location'))
        rec['bossName'] = clean(info[0][0].get('boss'))
    data = section(text, 'Chapter data', 2) or text
    cd = by_difficulty(data, 'ChapData') or by_difficulty(data, 'ChapDataDLC')
    rec['conditions'] = {d: {'victory': clean(v[0].get('victory')), 'defeat': clean(v[0].get('defeat')), 'deploy': clean(v[0].get('ally')), 'enemies': clean(v[0].get('enemy'))} for d, v in cd.items() if v}
    chars = templates(text, 'ChapChars')
    recruits, forced = [], []
    if chars:
        cp = chars[0][0]
        for p, _ in templates(text, 'NewUnit'):
            recruits.append({'unit': clean(p.get('name')), 'class': clean(p.get('class')), 'level': clean(p.get('lv')), 'how': clean(p.get('recruitment method')) or None})
        i = 1
        while f'forced{i}' in cp:
            forced.append(clean(cp.get(f'forced{i}article') or cp[f'forced{i}']))
            i += 1
    rec['recruits'] = recruits
    rec['forced'] = [re.sub(r'\s+[lmf]$', '', f).strip().title() if f.islower() else f.strip() for f in forced]
    items = []
    for p, _ in templates(text, 'ChapItems'):
        keys = sorted({k[4:] for k in p if k.startswith('item') and not k.endswith(('image', 'article'))}, key=lambda k: (k == 'last', int(k) if k.isdigit() else 0))
        for k in keys:
            items.append({'item': clean(p.get('item' + k)), 'how': clean(p.get('obtain' + k))})
    rec['items'] = items
    shop_sec = section(text, 'Shop data', 3)
    shop = None
    for p, _ in templates(shop_sec, 'ChapShop 3DS'):
        def lst(prefix):
            out, i = [], 1
            while f'{prefix}{i}' in p:
                cost = clean(p.get(f'{prefix}cost{i}', '')).replace(',', '')
                out.append({'item': clean(p[f'{prefix}{i}']), 'cost': int(cost) if cost.isdigit() else None})
                i += 1
            return out
        opens = re.search(r'After clearing (.*?), the shop', shop_sec)
        shop = {'location': clean(p.get('location')), 'opensAfter': clean(opens.group(1)) if opens else None, 'armory': lst('armory'), 'merchant': lst('merch')}
    rec['shop'] = shop
    ev = section(text, 'Event tile', 3)
    rec['eventTiles'] = len([l for l in ev.split('\n') if l.startswith('*')])
    enemy_sec = section(text, 'Enemy data', 3)
    en = by_difficulty(enemy_sec.split('Lunatic+ mode')[0], 'ChapUnitCellFE13')
    rec['enemies'] = {d: [enemy_group(p) for p in v] for d, v in en.items()}
    # Apotheosis has no difficulties: its enemy and boss tabs are waves (inside Normal route / Secret route tabs).
    if any(re.match(r'(secret )?wave', l.strip(), re.I) for l, _ in all_tabs(enemy_sec)):
        rec['enemies'] = {}
        for label, content in all_tabs(enemy_sec):
            if not re.match(r'(secret )?wave', label.strip(), re.I):
                continue
            groups = [{**enemy_group(p), 'wave': clean(label)} for p, _ in templates(content, 'ChapUnitCellFE13')]
            for d in DIFFS:
                rec['enemies'].setdefault(d, []).extend(groups)
    # Some maps split their enemies into factions (Paralogue 13's Stonewall Knights and Riders of Dawn).
    known = {'Chapter', 'Character', 'Item', 'Shop', 'NPC', 'Boss', 'Enemy', 'Event tile'}
    for faction in re.findall(r'\n===\s*([^=\n]+?) data\s*===', text):
        if faction.strip('[] ') in known:
            continue
        fsec = section(text, f'{faction} data', 3)
        for d, v in by_difficulty(fsec.split('Lunatic+ mode')[0], 'ChapUnitCellFE13').items():
            rec['enemies'].setdefault(d, []).extend({**enemy_group(p), 'faction': clean(faction)} for p in v)
            enemy_sec += fsec
    reinf = section(text, 'Reinforcements', 4) or section(text, 'Reinforcements', 3)
    rec['reinforcements'] = bullets(reinf)
    pool = re.search(r'Lunatic\+ mode([\s\S]*?)(?:\n=|\{\{div col end\}\}|\Z)', text)
    rec['lunaticPlusPool'] = [clean(x) for x in re.findall(r'\{\{Item\|13\|([^|}]*)', pool.group(1))] if pool else []
    boss_sec = section(text, 'Boss data', 3)
    bs = by_difficulty(boss_sec, 'BossStats FE13')
    waves = [(clean(l), c) for l, c in all_tabs(boss_sec) if re.match(r'(secret )?wave', l.strip(), re.I)]
    if waves:
        bs = {d: [{**p, '__wave': w} for w, c in waves for p, _ in templates(c, 'BossStats FE13')] for d in DIFFS}
    bosses = {}
    for d, v in bs.items():
        rows = []
        for p in v:
            # A boss lists one item per line: every line is inventory.
            items_, _, _ = items_of(re.sub(r'<br\s*/?>', ' • ', p.get('inventory', '') or ''))
            _, sk2, _ = items_of('<br>' + p.get('skills', ''))
            bstat = {'hp': p.get('HP', p.get('hp')), 'str': p.get('str'), 'mag': p.get('magic', p.get('mag')), 'skl': p.get('skill'), 'spd': p.get('spd'), 'lck': p.get('luck', p.get('lck')), 'def': p.get('def'), 'res': p.get('res'), 'mov': p.get('move', p.get('mov'))}
            rows.append({'class': clean(p.get('class')), 'level': clean(p.get('lv') or p.get('level')), 'stats': {k: clean(x or '') for k, x in bstat.items()}, 'items': items_, 'skills': sk2, **({'wave': p['__wave']} if p.get('__wave') else {})})
        bosses[d] = rows
    rec['bosses'] = bosses
    return rec


if __name__ == '__main__':
    maps = json.loads(sys.argv[1])
    out = [parse(m['file'], {k: v for k, v in m.items() if k != 'file'}) for m in maps]
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for r in out:
        print(r['id'], r.get('title'), {d: len(v) for d, v in r['enemies'].items()}, 'bosses', {d: len(v) for d, v in r['bosses'].items()}, 'items', len(r['items']), 'reinf', len(r['reinforcements']), 'L+', len(r['lunaticPlusPool']), 'recruits', [x['unit'] for x in r['recruits']], 'forced', r['forced'])
