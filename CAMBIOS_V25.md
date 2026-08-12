# Cambios v25

- Sant Cugat: integrada la geometría municipal nativa de `divter:DIVTER_BARRIS` obtenida en EPSG:25831 y auditada sin errores topológicos.
- Se conservan las 68 zonas de la capa: 53 bajo Sant Cugat y 15 bajo la EMD de Valldoreix, separadas por `CONSELLDEBARRI`.
- Las zonas `Residencial` se muestran como barrios; `Forestal` y `Activitat econòmica` quedan como otras zonas municipales, sin presentarlas como barrios residenciales.
- La fuente local evita reintentar el WFS de Sant Cugat, que devuelve HTTP 401 en `GetFeature`.
- Nuevo botón `Municipios vecinos` junto a `Municipio TOP`. Activa una capa orientativa con límites municipales y nombres usando las geometrías ya presentes en `municipalities.json`.
- El municipio buscado queda resaltado; los demás son neutros. La capa no captura clics ni modifica la lógica de barrios, pisos o preferencias.
- No se ha cambiado la persistencia de notas, TOP, pisos vistos ni capas existentes.
- `01_ACTUALIZAR_DATOS.cmd` reconoce estas capas como válidas y no intenta sustituir automáticamente Sant Cugat desde el WFS protegido.
