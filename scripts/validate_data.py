from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    catalog = json.loads((ROOT / "public/data/municipalities.json").read_text(encoding="utf-8"))
    municipalities = catalog["municipalities"]
    ids = [item["id"] for item in municipalities]
    assert len(ids) == len(set(ids)), "duplicate municipal ids"
    assert all(item["name"].strip() and item["county"].strip() for item in municipalities), "missing municipal data"
    assert len(municipalities) >= 900, "incomplete official catalog"
    preferences = json.loads((ROOT / "public/data/interest-zones.json").read_text(encoding="utf-8"))["zones"]
    assert preferences and all(item["name"].strip() for item in preferences), "empty preference term"
    known = json.loads((ROOT / "public/data/known-zones.json").read_text(encoding="utf-8"))["zones"]
    municipality_names = {item["name"].casefold() for item in municipalities}
    known_keys = [(item["municipality"].casefold(), item["name"].casefold()) for item in known]
    assert len(known_keys) == len(set(known_keys)), "duplicate known zones"
    assert all(item["municipality"].casefold() in municipality_names for item in known), "unknown municipality in known zones"
    assert any(item["name"] == "Les Roquetes" for item in known), "Les Roquetes missing from known zones"
    assert sum(item["municipality"] == "Barcelona" for item in known) == 73, "Barcelona neighbourhood index must contain 73 records"
    assert any(item["municipality"] == "Barcelona" and item["name"] == "el Fort Pienc" for item in known), "el Fort Pienc missing from search index"
    assert sum(item["municipality"] == "Sant Sadurní d'Anoia" for item in known) == 7, "Sant Sadurní must contain seven traditional neighbourhoods"
    barcelona_geojson = json.loads((ROOT / "public/data/municipality-zones/barcelona.geojson").read_text(encoding="utf-8"))
    assert len(barcelona_geojson["features"]) == 73, "Barcelona official layer must contain 73 polygons"
    assert any(item["properties"]["name"] == "el Fort Pienc" for item in barcelona_geojson["features"]), "Fort Pienc polygon missing"
    print(f"Valid: {len(municipalities)} municipalities, {len(preferences)} preference records and {len(known)} known zones")


if __name__ == "__main__":
    main()
