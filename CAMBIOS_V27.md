# Cambios v27

- Vilanova: fallback TLS controlado limitado a `gis.vilanova.cat`; WFS/GML/KML sigue sometido a validación de 18 barrios y encaje territorial.
- Granollers: nueva búsqueda ArcGIS Online de la capa municipal `LIMIT BARRIS / Divisió de barris` y validación de 16 barrios.
- Lloret de Mar: sustituida la descarga SHP problemática por el conjunto Open Data `Zonificacions administratives` en GeoJSON; se etiqueta como `zone`, no como barrio.
- Mollet, Vic, Manresa, Olot y el Vendrell: nuevas sondas conservadoras sobre portales GIS oficiales. Solo escriben polígonos si la capa es explícitamente de barris y supera controles.
- Mollet: incorporados 13 nombres actuales documentados por el Ayuntamiento.
- Vic: incorporados 14 barrios delimitados del Pla Director de Barris.
- Granollers: incorporados 16 nombres de barrios actuales como referencia incluso si ArcGIS no responde.
- Blanes, Figueres, Igualada, Vilafranca y Sant Feliu de Guíxols: se mantienen sin polígonos de barrio cuando no hay vector público validable; no se digitalizan PDFs ni mapas raster.
- Sant Cugat y Valldoreix: sin cambios geométricos.
