# CAMBIOS V28

## Objetivo
Cerrar los problemas detectados por la primera ejecución de v27 sin tocar las geometrías auditadas de Sant Cugat/Valldoreix ni la lógica del Radar.

## Vilanova i la Geltrú
- Se mantienen el TLS controlado exclusivamente para `gis.vilanova.cat`.
- El WMS municipal ya entrega 18 polígonos de la capa `BARRIS`, pero el KML los identifica como `BARRIS_P.0...17`.
- v28 usa la capa WMS auxiliar de texto/etiquetas de barrios para unir cada nombre a su polígono mediante contención espacial.
- Si la capa de etiquetas no aporta todos los nombres, se intenta `GetFeatureInfo` sobre un punto interior de cada polígono.
- Solo se guarda la capa si quedan exactamente 18 polígonos y aparecen los 18 nombres oficiales. No se asignan nombres por orden.

## Granollers
- Se exige exactamente la relación municipal actual de 16 barrios.
- Cualquier elemento extra de `LIMIT BARRIS` que no corresponda a esa lista se descarta antes de validar.
- El recuperador de versiones anteriores también exige 16/16 nombres, por lo que no puede reutilizar la capa de 17 elementos de v27.

## Vic
- El Portal d’Informació Urbanística se consulta por HTTPS.
- Se habilita fallback TLS controlado exclusivamente para `informaciourbanistica.vic.cat`.
- La geometría solo se guarda si supera después las validaciones habituales de barrios y territorio.

## Lloret de Mar
- El CKAN/Open Data oficial admite fallback TLS controlado exclusivamente para `opendata.lloret.cat`.
- El permiso se propaga también al recurso GeoJSON únicamente cuando el recurso está en ese mismo host.
- Sigue etiquetándose como zonificación administrativa, no como barrio salvo evidencia de la fuente.

## Manresa
- Se excluyen de la detección de servicios las URLs de namespace/esquema OGC (`opengis.net`, `schemas.opengis.net`).
- Evita confundir referencias XML como `http://www.opengis.net/wfs/2.0` con endpoints WFS reales.

## Seguridad
- No se han modificado `public/data/municipality-zones/sant-cugat-del-valles.geojson` ni `valldoreix.geojson`.
- No se han modificado DIBA, AMB, preferencias, pisos vistos, `main.ts` ni almacenamiento local.
- Las escrituras de capas municipales siguen siendo transaccionales y con copia de seguridad.
