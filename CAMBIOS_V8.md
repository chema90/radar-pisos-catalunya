# Cambios v8 · KML y GML/XML

## Objetivo

Ampliar el sistema existente sin crear conversores especiales por municipio. El mismo `scripts/import_zones.mjs` puede procesar ahora:

- ArcGIS REST
- WFS (solicitando GeoJSON cuando el servidor lo permite)
- Shapefile / ZIP
- GeoJSON
- KML
- GML/XML (incluidas respuestas WFS guardadas como XML)

## Badalona

`data/raw/bdn_barris_sgm.xml` es una `wfs:FeatureCollection` GML con 34 elementos. El importador lee `nom_min`, `barris_id`, las geometrías `gml:MultiSurface` y el CRS EPSG:23031, que transforma a EPSG:4326 para Leaflet.

Resultado: `public/data/municipality-zones/badalona.geojson` con 34 barrios.

## Sant Feliu de Llobregat

`data/raw/sant-feliu-barris-2014.kml` contiene 10 `Placemark` poligonales y el campo `NOMBARRI`. Se convierte directamente con `@tmcw/togeojson`.

Resultado: `public/data/municipality-zones/sant-feliu-de-llobregat.geojson` con 10 barrios. Al no haberse verificado externamente la procedencia del KML, se conserva como calidad `imported`, no `official`.

## Importación manual desde la interfaz

El selector "Importar GIS" acepta también `.xml` y `.gml`. Si el GML declara un CRS compatible, la aplicación lo reproyecta a WGS84 antes de guardarlo en IndexedDB.

## Configuración

Ejemplo GML:

```json
{
  "id": "badalona-barris",
  "municipality": "Badalona",
  "municipalityId": "080155",
  "type": "gml",
  "file": "data/raw/bdn_barris_sgm.xml",
  "nameField": "nom_min",
  "codeField": "barris_id",
  "kind": "barri",
  "official": true,
  "sourceCrs": "EPSG:23031"
}
```

Ejemplo KML:

```json
{
  "id": "sant-feliu-barris",
  "municipality": "Sant Feliu de Llobregat",
  "municipalityId": "082114",
  "type": "kml",
  "file": "data/raw/sant-feliu-barris-2014.kml",
  "nameField": "NOMBARRI",
  "kind": "barri",
  "official": false
}
```

Las fuentes `kml` y `gml/xml` también pueden usar `url` en vez de `file`.
