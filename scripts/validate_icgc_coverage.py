from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'public/data/municipalities.json'
ICGC_DIR = ROOT / 'public/data/icgc-arees-poblament/municipis'
INTEREST = ROOT / 'public/data/interest-zones.json'


def slug(value: str) -> str:
    text = unicodedata.normalize('NFD', value)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def municipality_norm(value: str) -> str:
    text = unicodedata.normalize('NFD', value)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn').lower()
    text = re.sub(r"[’']", ' ', text)
    text = re.sub(r'[^a-z0-9]+', ' ', text).strip()
    text = re.sub(r'^(?:l|el|la|els|les)\s+', '', text)
    return re.sub(r'\s+', ' ', text)


def main() -> None:
    municipalities = json.loads(CATALOG.read_text(encoding='utf-8'))['municipalities']
    missing = []
    total_features = 0
    industrial = 0
    population = 0
    for municipality in municipalities:
        filename = f"{municipality['id']}-{slug(municipality['name'])}.geojson"
        path = ICGC_DIR / filename
        if not path.exists():
            missing.append(filename)
            continue
        doc = json.loads(path.read_text(encoding='utf-8'))
        total_features += len(doc.get('features', []))
        for feature in doc.get('features', []):
            category = str((feature.get('properties') or {}).get('categoria') or '').lower()
            if 'industrial' in category:
                industrial += 1
            else:
                population += 1
    assert not missing, f'Faltan {len(missing)} archivos ICGC; primeros: {missing[:10]}'
    assert total_features >= 8200, f'Cobertura ICGC incompleta: {total_features}'
    assert industrial > 2000, f'Sectores industriales incompletos: {industrial}'

    by_name = {municipality_norm(item['name']): item for item in municipalities}
    by_spanish = {municipality_norm(item['nameSpanish']): item for item in municipalities}
    prefs = json.loads(INTEREST.read_text(encoding='utf-8'))['zones']
    unresolved = []
    for item in prefs:
        if item['kind'] == 'municipality':
            target = item['name']
        elif item['kind'] == 'interest' and item.get('municipality'):
            target = item['municipality']
        else:
            continue
        key = municipality_norm(target)
        if key not in by_name and key not in by_spanish:
            unresolved.append(target)
    # Interest labels may intentionally use non-official shorthand. Municipality target rows must all resolve.
    unresolved_municipality_rows = []
    for item in prefs:
        if item['kind'] != 'municipality':
            continue
        key = municipality_norm(item['name'])
        if key not in by_name and key not in by_spanish:
            unresolved_municipality_rows.append(item['name'])
    assert not unresolved_municipality_rows, f'Municipios objetivo no resolubles: {unresolved_municipality_rows}'

    print(f'ICGC OK: {len(municipalities)} municipios, {total_features} polígonos ({population} poblamiento + {industrial} industriales).')
    if unresolved:
        print('Aviso: nombres abreviados de zonas/intereses que no son nombre municipal exacto:', ', '.join(sorted(set(unresolved))[:20]))


if __name__ == '__main__':
    main()
