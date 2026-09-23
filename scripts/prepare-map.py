"""Prepare the five-region teaching map from OSM/Nominatim. Requires shapely.

The checked-in JSON is used at runtime; this script is only for refreshing geodata.
Run from the repository root. Public Nominatim requests are limited to <1/second.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Optional local tooling location; not required when Shapely is installed normally.
sys.path.insert(0, str(Path('.local/geotools').resolve()))
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union
from shapely import make_valid

catalog = [
    ('saryarka', 'Сарыарқа ауданы', 'Сарыарка', [51.195, 71.365]),
    ('baikonur', 'Байқоңыр ауданы', 'Байконур', [51.215, 71.475]),
    ('almaty', 'Алматы ауданы', 'Алматы', [51.157, 71.565]),
    ('nura', 'Нұра ауданы', 'Нура', [51.123, 71.335]),
    ('esil', 'Есіл ауданы', 'Есиль', [51.095, 71.47]),
    ('saraishyk', 'Сарайшық ауданы', 'Сарайшык', None),
]
cache = Path('.local/astana-districts-raw.json')
if cache.exists():
    raw = {item['id']: item['data'] for item in json.loads(cache.read_text(encoding='utf-8'))}
else:
    raw = {}
    for district_id, query_name, _, _ in catalog:
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
            'q': query_name + ', Астана', 'format': 'jsonv2', 'polygon_geojson': 1,
        })
        request = urllib.request.Request(url, headers={
            'User-Agent': 'QALA-Hackathon/1.0 (https://github.com/BAITC-Hacks/hack-46aa131a-chrollo)',
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            candidates = json.load(response)
        raw[district_id] = next(item for item in candidates
            if item.get('geojson', {}).get('type') in ('Polygon', 'MultiPolygon'))
        time.sleep(1.2)

features = []
for district_id, _, label, center in catalog[:5]:
    members = [raw[district_id]]
    if district_id == 'almaty':
        members.append(raw['saraishyk'])
    geometry = unary_union([make_valid(shape(item['geojson'])) for item in members])
    geometry = geometry.simplify(0.00004, preserve_topology=True)
    assert geometry.is_valid and not geometry.is_empty
    assert geometry.covers(Point(center[1], center[0])), f'Label outside {district_id}'
    assert 70.9 < geometry.bounds[0] < geometry.bounds[2] < 72
    assert 50.8 < geometry.bounds[1] < geometry.bounds[3] < 51.6
    features.append({
        'type': 'Feature',
        'properties': {'id': district_id, 'name': label, 'labelPosition': center,
            'osmRelations': [item['osm_id'] for item in members]},
        'geometry': mapping(geometry),
    })

collection = {
    'type': 'FeatureCollection',
    'metadata': {
        'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'source': 'OpenStreetMap contributors via Nominatim',
        'license': 'ODbL-1.0',
        'attributionUrl': 'https://www.openstreetmap.org/copyright',
        'modelMapping': 'Almaty includes Saraishyk to match the five districts in the hackathon dataset. This is a teaching model, not the current administrative division.',
        'simplificationDegrees': 0.00004,
    },
    'features': features,
}
target = Path('src/data/astana-districts.json')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(collection, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'{target}: {target.stat().st_size} bytes; five valid district geometries')
