# Cambios v10 · Tarragona robusta y visores/API municipales

## Tarragona

- Se conserva el PDF municipal `Mapa de zones` de agosto de 2013 en `data/raw/tarragona-zones-empadronament-2013.pdf`.
- El PDF se usa para nombres y códigos, no se calcan sus límites rasterizados.
- Nueva fuente `tarragona-zones-umt` sobre `Unitats_Minimes_Territorials/FeatureServer/0`.
- Nuevo importador `arcgis-grouped`: valida `agrupacio` antes de formar las 11 zonas.
- Códigos esperados: `1,2,3,4,5,6,7,8,10,11,12`. El código 9 no aparece en el mapa municipal de 2013.
- Si la validación falla, se conservan las UMT como sectores y ICGC sigue como respaldo.
- `Eixample` se declara alias de `Eixample Tarragona` para enlazar la preferencia existente sin renombrar la denominación oficial.

## Esplugues

- Se registran los 10 barrios confirmados por el Ayuntamiento: Can Clota, Can Vidalet, Centre, Ciutat Diagonal, El Gall, Finestrelles, La Mallola, La Miranda, La Plana y Montesa.
- Nueva fuente `esplugues-barris`, tipo `portal`, apuntando al visor EnMapa.
- El detector de geoportales analiza también JavaScript de visores modernos, no solo el HTML inicial.
- Solo se guarda una capa si se identifica como barrios y contiene al menos 10 polígonos. Si no hay endpoint compatible, los nombres quedan como `pendientes de polígono` y se mantiene ICGC.

## APIs y seguridad

El flujo genérico de fuentes queda preparado para ArcGIS, ArcGIS agrupado, WFS, portales dinámicos, CKAN/OData+WKT, GeoJSON, Shapefile, KML y GML/XML. No se desactiva TLS. Los scripts de Windows que consultan Internet usan `node --use-system-ca`.
