# Prompt para continuar este proyecto con Codex

Trabaja sobre este repositorio existente de Radar de pisos Catalunya. No reconstruyas la aplicación desde cero.

La versión v5 ya integra dos familias de fuentes territoriales:

1. `public/data/municipality-zones/*.geojson`: divisiones municipales/importadas de mayor precisión. Barcelona y Girona son correctas y no deben degradarse ni sustituirse.
2. `public/data/icgc-arees-poblament/municipis/*.geojson`: cobertura general ICGC para los 947 municipios, con áreas de poblamiento y sectores industriales.

Reglas obligatorias:

- Conserva `scripts/import_zones.mjs`, `convert_barcelona_zones.mjs`, `convert_girona_zones.mjs`, las importaciones ArcGIS/Shapefile/GeoJSON y las herramientas GIS avanzadas.
- Una capa municipal verificada tiene prioridad visual sobre ICGC, pero ICGC debe seguir siendo activable.
- Nunca elimines sectores industriales; son contexto inmobiliario útil.
- Las capas deben poder activarse/desactivarse independientemente.
- Las preferencias TOP/interesante/normal/descartada y las notas se guardan en IndexedDB, nunca dentro de GeoJSON oficiales.
- Los pisos guardados deben seguir asociados a municipio/zona y continuar funcionando.
- Mantén la carga parcial: solo cargar el GeoJSON ICGC del municipio activo.
- No llames “barrios oficiales” a áreas ICGC; son áreas de poblamiento/zonas ICGC.
- Los archivos `*-reference.geojson` son referencias y no sustituyen divisiones oficiales.

Correcciones ya realizadas en v5:

- `loadZones()` ya no contiene una lista rígida Barcelona/Girona: intenta cargar automáticamente `municipality-zones/<slug-municipio>.geojson`.
- Por ello Tarragona y futuros municipios con archivo correctamente nombrado son detectados automáticamente.
- Los registros `kind=municipality` de `interest-zones.json` se abren usando `preference.name`, no el encabezado/grupo almacenado en `preference.municipality`.
- La comparación de municipios tolera artículos y acentos.
- ICGC contiene 947 municipios / 8271 polígonos y se carga por municipio.

Antes de modificar el modelo territorial, lee `DATA_MODEL.md`, `DATA_SOURCES.md` e `INTEGRACION_ICGC_V5.md`.
