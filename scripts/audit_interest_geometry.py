"""Audit configured housing-interest names against available geometry sources.

This does not guess boundaries. It classifies each configured interest term as:
- municipal: matched to a bundled municipal polygon/sector;
- icgc: matched to an ICGC population/industrial polygon;
- official-source-configured: municipality has an official vector adapter configured but
  its generated file is not bundled yet;
- pending: no polygon is currently linked.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ZONE_COVERAGE_AUDIT.md"


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = value.replace("'", " ").replace("’", " ")
    value = re.sub(r"[^a-z0-9]+", " ", value).strip()
    return re.sub(r"\s+", " ", value)


ALIASES = {'sant andreu de palomar': 'sant andreu'}

def zone_key(value: str) -> str:
    value = norm(value)
    value = re.sub(r"^(?:el|la|l|els|les)\s+", "", value)
    return ALIASES.get(value, value)


def municipality_key(value: str) -> str:
    value = norm(value)
    value = re.sub(r"^(?:el|la|l|els|les)\s+", "", value)
    value = re.sub(r"\s+(?:el|la|l|els|les)$", "", value)
    return value


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", norm(value)).strip("-")


def score(search: str, candidate: str) -> int:
    a, b = zone_key(search), zone_key(candidate)
    if a == b:
        return 100
    aa, bb = a.split(), b.split()
    if len(aa) >= 2 and len(bb) >= len(aa) and all(token in bb for token in aa):
        return 60 + min(len(aa), 8)
    return 0


def best_match(name: str, features: list[dict]) -> dict | None:
    def feature_score(feature: dict) -> int:
        props = feature.get("properties", {})
        names = [str(props.get("name", "")), *[str(x) for x in props.get("aliases", [])]]
        return max((score(name, candidate) for candidate in names), default=0)
    ranked = sorted(((feature_score(f), f) for f in features), reverse=True, key=lambda x: x[0])
    ranked = [item for item in ranked if item[0] > 0]
    if not ranked:
        return None
    if len(ranked) > 1 and ranked[0][0] == ranked[1][0] and ranked[0][0] < 100:
        return None
    return ranked[0][1]


def load_features(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("features", [])
    except Exception:
        return []


def main() -> None:
    prefs = json.loads((ROOT / "public/data/interest-zones.json").read_text(encoding="utf-8"))["zones"]
    municipalities = json.loads((ROOT / "public/data/municipalities.json").read_text(encoding="utf-8"))["municipalities"]
    sources = json.loads((ROOT / "config/gis-sources.json").read_text(encoding="utf-8"))
    source_by_municipality = {municipality_key(item["municipality"]): item for item in sources if item.get("type") in {"arcgis", "arcgis-grouped", "wfs", "geojson", "shapefile", "gml", "xml", "kml", "ckan-wkt", "csv-wkt", "portal"}}
    muni_by_name = {}
    for municipality in municipalities:
        muni_by_name[municipality_key(municipality["name"])] = municipality
        muni_by_name[municipality_key(municipality.get("nameSpanish") or municipality["name"])] = municipality

    rows = []
    counts = {"municipal": 0, "icgc": 0, "official-source-configured": 0, "pending": 0}
    for pref in [item for item in prefs if item.get("kind") == "interest" and item.get("municipality")]:
        municipality = muni_by_name.get(municipality_key(pref["municipality"]))
        if not municipality:
            rows.append((pref["municipality"], pref["name"], "pending", "Municipio no resuelto"))
            counts["pending"] += 1
            continue
        municipal_file = ROOT / "public/data/municipality-zones" / f"{slug(municipality['name'])}.geojson"
        municipal_features = load_features(municipal_file)
        reference_file = ROOT / "public/data/municipality-zones" / f"{slug(municipality['name'])}-reference.geojson"
        municipal_features += load_features(reference_file)
        match = best_match(pref["name"], municipal_features)
        if match:
            rows.append((municipality["name"], pref["name"], "municipal", match["properties"].get("name", "")))
            counts["municipal"] += 1
            continue
        icgc_file = ROOT / "public/data/icgc-arees-poblament/municipis" / f"{municipality['id']}-{slug(municipality['name'])}.geojson"
        icgc_raw = load_features(icgc_file)
        icgc_features = [{"properties": {"name": f.get("properties", {}).get("nom", "")}} for f in icgc_raw if 'industrial' not in str(f.get('properties', {}).get('categoria', '')).lower()]
        match = best_match(pref["name"], icgc_features)
        if match:
            rows.append((municipality["name"], pref["name"], "icgc", match["properties"].get("name", "")))
            counts["icgc"] += 1
            continue
        configured = source_by_municipality.get(municipality_key(municipality["name"]))
        if configured:
            # For grouped sources we already know the exact future names/aliases. Do not
            # claim that every personal locality name will obtain a polygon from that source.
            configured_names = []
            if configured.get("type") == "arcgis-grouped":
                configured_names.extend(configured.get("groupLabels", {}).values())
                for aliases in configured.get("groupAliases", {}).values():
                    configured_names.extend(aliases)
            if not configured_names or any(score(pref["name"], candidate) > 0 for candidate in configured_names):
                rows.append((municipality["name"], pref["name"], "official-source-configured", configured["id"]))
                counts["official-source-configured"] += 1
                continue
            rows.append((municipality["name"], pref["name"], "pending", "No coincide con una zona del mapa municipal configurado"))
            counts["pending"] += 1
        else:
            rows.append((municipality["name"], pref["name"], "pending", "Sin polígono enlazado"))
            counts["pending"] += 1

    lines = [
        "# Auditoría de cobertura de zonas de interés",
        "",
        "Esta auditoría no inventa límites. Comprueba los nombres configurados contra geometrías disponibles y adaptadores oficiales configurados.",
        "",
        f"- Municipal: **{counts['municipal']}**",
        f"- ICGC: **{counts['icgc']}**",
        f"- Fuente oficial configurada, pendiente de generar/cargar: **{counts['official-source-configured']}**",
        f"- Pendiente sin polígono: **{counts['pending']}**",
        "",
        "| Municipio | Zona configurada | Estado | Coincidencia / fuente |",
        "| --- | --- | --- | --- |",
    ]
    for municipality, name, status, detail in rows:
        lines.append(f"| {municipality} | {name} | {status} | {detail} |")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Audit written: {OUT.name} · {len(rows)} interest names")
    print(counts)


if __name__ == "__main__":
    main()
