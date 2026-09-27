"""Builds ids.json: the game's internal ids for units, classes, items and skills, mapped to names.

Source: the id tables in Dani88alv/fire-editor-awakening (src/main/resources/.../database/*.xml). Only facts are taken
(ids, names, unit stat additions, class gender); none of its code. Run: uv run python scripts/play/save/build-ids.py
"""
import json, pathlib, urllib.request, xml.etree.ElementTree as ET

BASE = 'https://raw.githubusercontent.com/Dani88alv/fire-editor-awakening/master/src/main/resources/com/danius/fireeditor/database/'
STATS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res']

def load(name):
    return ET.fromstring(urllib.request.urlopen(BASE + name + '.xml').read())

out = {'source': BASE, 'units': {}, 'classes': {}, 'items': {}, 'skills': {}}
for u in load('units'):
    add = u.find('additions')
    out['units'][u.get('id')] = {'name': u.get('name'), 'additions': [int(add.get(s) or 0) for s in STATS]}
for c in load('classes'):
    out['classes'][c.get('id')] = c.get('name')
for i in load('items'):
    out['items'][i.get('id')] = i.get('name')
for s in load('skills'):
    out['skills'][s.get('id')] = s.get('name')
path = pathlib.Path(__file__).with_name('ids.json')
path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
print({k: len(v) for k, v in out.items() if isinstance(v, dict)})
