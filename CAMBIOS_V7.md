# Cambios v7 · revisión profunda

1. **Sabadell**: se añadió la fuente WFS oficial del Ayuntamiento y carga automática de la capa de barrios. `Centre`, `Covadonga`, `Creu Alta` y `Gràcia` dejan de depender de una simple lista si el servicio oficial responde. `Eix Macià` solo se enlaza si existe una geometría inequívoca; no se inventa un barrio.
2. **Terrassa**: se añadió la capa oficial `pt_barri` del ArcGIS municipal. Incluye barrios como `Centre`, `Ca n'Aurell`, `Vallparadís` y `Antic Poble de Sant Pere`. La preferencia `Escola Industrial` se puede asociar de forma conservadora al nombre oficial compuesto `Plaça Catalunya-Escola Industrial`.
3. **Tarragona**: el archivo municipal empaquetado tenía solo 2 polígonos. Ahora esa cobertura se considera incompleta y la aplicación intenta completar la capa desde el FeatureServer oficial.
4. **Capas claras**: cada zona visible muestra de qué capa procede. Los nombres personales sin polígono quedan en un bloque aparte y plegado.
5. **Ocultar significa ocultar**: una zona desmarcada ya no deja un contorno fantasma. El límite municipal también tiene su propio interruptor.
6. **Auditoría reproducible**: `python scripts/audit_interest_geometry.py` genera `ZONE_COVERAGE_AUDIT.md`.
7. **Importación**: el importador genérico conserva ArcGIS, Shapefile y GeoJSON y añade WFS.
