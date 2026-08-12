"""Derive a typed preference file from config/ZONAS_INTERES.md.

The source Markdown remains the editable human configuration; this script makes
the web-facing JSON reproducible and never drops a term silently.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "config" / "ZONAS_INTERES.md"
TARGET = ROOT / "public" / "data" / "interest-zones.json"


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def parse_bold_rows(lines: list[str]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for line in lines:
        match = re.match(r"- \*\*(.+?):\*\* (.+)\.", line)
        if not match:
            continue
        municipality, terms = match.groups()
        for term in terms.split("; "):
            rows.append({"id": f"{slug(municipality)}--{slug(term)}", "municipality": municipality,
                         "name": term, "kind": "interest", "mode": "buy-rent", "status": "pending-review"})
    return rows


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    blocks = re.split(r"^## ", text, flags=re.MULTILINE)
    result: list[dict[str, object]] = []
    for block in blocks:
        heading, _, body = block.partition("\n")
        lines = body.splitlines()
        if heading.startswith("Municipios con barrios"):
            result.extend(parse_bold_rows(lines))
        elif heading.startswith("Municipios objetivo"):
            for row in parse_bold_rows(lines):
                # These rows enumerate municipalities, not barrios.
                row["kind"] = "municipality"
                row["mode"] = "buy-only" if row["municipality"] == "Solo compra" else "buy-rent"
                row["status"] = "list-only"
                result.append(row)
        elif heading.startswith("Zonas excluidas"):
            for line in lines:
                if line.startswith("- "):
                    for term in line[2:].rstrip(".").split("; "):
                        result.append({"id": f"excluded--{slug(term)}", "municipality": None, "name": term,
                                       "kind": "excluded", "mode": "buy-rent", "status": "pending-review"})
        elif heading.startswith("Zonas top"):
            for line in lines:
                if line.startswith("- "):
                    for term in line[2:].rstrip(".").split("; "):
                        result.append({"id": f"top--{slug(term)}", "municipality": None, "name": term,
                                       "kind": "top", "mode": "buy-rent", "status": "pending-review"})
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps({"generatedFrom": "config/ZONAS_INTERES.md", "zones": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(result)} preference records to {TARGET}")


if __name__ == "__main__":
    main()
