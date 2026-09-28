"""Check imported map contents against the cached v83 WZ layout, offline."""
import json, pathlib, hashlib, xml.etree.ElementTree as ET
from PIL import Image
from import_maple import val, node, summary, XML
P = pathlib.Path(__file__).resolve().parents[1]
A = P / 'Assets/StreamingAssets/Maple'
catalog = json.loads((A / 'catalog.json').read_text(encoding='utf8'))
errors, external = [], set()
known = {m['id'] for m in catalog['maps']}
frames = [f for p in catalog['player'] for f in p['frames']]
frames += [u['frame'] for u in catalog['ui']]
frames += [f for n in catalog['npcs'] for f in n['frames']]
for entry in catalog['maps']:
    mid = entry['id']
    m = json.loads((A / f'maps/{mid}.json').read_text(encoding='utf8'))
    url = XML + f'Map.wz/Map/Map{mid//100000000}/{mid:09}.img.xml'
    original = ET.fromstring((P / 'Tools/cache' / (hashlib.sha256(url.encode()).hexdigest()+'.xml')).read_bytes())
    life = node(original, 'life')
    npcs = [{'id':int(val(n,'id')), 'x':val(n,'x'), 'y':val(n,'cy',val(n,'y')), 'flip':bool(val(n,'f')), 'hidden':bool(val(n,'hide'))} for n in ([] if life is None else life) if val(n,'type','')=='n']
    if npcs != m['npcs']: errors.append(f'{mid}: NPC placement mismatch')
    if summary(mid, original) != m['portals']: errors.append(f'{mid}: portal mismatch')
    count = sum(len(node(original,f'{i}/{k}')) if node(original,f'{i}/{k}') is not None else 0 for i in range(8) for k in ['tile','obj'])
    if count != len(m['draws']): errors.append(f'{mid}: missing map layers')
    for draw in m['draws'] + m['backgrounds']: frames.extend(draw['frames'])
    if m.get('minimap') and not (A / f"images/{m['minimap']}.png").exists(): errors.append(f'{mid}: missing minimap')
    external.update(p['target'] for p in m['portals'] if p['target'] not in known and p['target'] != 999999999)
for key in {f['key'] for f in frames}:
    try:
        with Image.open(A / f'images/{key}.png') as image: image.verify()
    except Exception as e: errors.append(f'{key}: {e}')
report = {'maps':len(known), 'npcs':len(catalog['npcs']), 'verifiedImages':len({f['key'] for f in frames}), 'externalPortalTargets':sorted(external), 'errors':errors}
(P / 'Tools/asset-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2),encoding='utf8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
