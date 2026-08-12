# Cambios v12

- Las fuentes GIS remotas se reintentan hasta 3 veces ante fallos temporales de red.
- `REFRESCAR_BARRIOS_OFICIALES.cmd` usa modo tolerante: una fuente municipal caída queda como **PENDIENTE**, no como error fatal.
- Sabadell ya no muestra un `ERROR: fetch failed` por una caída temporal del WFS; conserva cualquier capa local válida y usa ICGC si todavía no existe.
- Esplugues se presenta como PENDIENTE mientras no se confirme una API/capa GIS de barrios descargable.
- No se vuelve a usar `NODE_TLS_REJECT_UNAUTHORIZED=0`; continúa `--use-system-ca`.
- Tarragona conserva la reconstrucción de 11 zonas por UMT y códigos oficiales.
