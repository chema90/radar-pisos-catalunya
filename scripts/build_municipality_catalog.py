"""Build the local municipality index from the official ICGC feature service."""
from __future__ import annotations

import hashlib
import json
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "municipalities.json"
RAW = ROOT / "data" / "raw" / "icgc-municipalities-50000.geojson"
URL = "https://geoserveis.icgc.cat/vector01/rest/services/divisions_administratives_wms/MapServer/13/query"


def main() -> None:
    params = {"where": "1=1", "outFields": "CODIMUNI,NOMMUNI,NOMMUNIIND,CAPMUNI,CODICOMAR,NOMCOMAR,CODIPROV,NOMPROV,AREAM5000", "returnGeometry": "true", "f": "geojson", "outSR": "4326"}
    request = urllib.request.Request(f"{URL}?{urllib.parse.urlencode(params)}", headers={"User-Agent": "radar-de-pisos/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    digest = hashlib.sha256(payload).hexdigest()
    collection = json.loads(payload)
    if len(collection.get("features", [])) < 900:
        raise RuntimeError("ICGC source did not return the expected municipal catalog")
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_bytes(payload)
    municipalities = []
    for feature in collection["features"]:
        p = feature["properties"]
        municipalities.append({
            "id": p["CODIMUNI"], "name": p["NOMMUNI"], "nameSpanish": p.get("NOMMUNIIND") or p["NOMMUNI"],
            "county": p["NOMCOMAR"], "countyCode": p["CODICOMAR"], "province": p["NOMPROV"],
            "capital": p.get("CAPMUNI"), "areaM2": p.get("AREAM5000"), "coverage": "pending",
            "geometry": feature["geometry"],
        })
    municipalities.sort(key=lambda item: item["name"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "icgc-divisions-administratives", "accessedAt": str(date.today()), "sha256": digest, "municipalities": municipalities}, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(municipalities)} municipalities; sha256={digest}")


if __name__ == "__main__":
    main()
