# Cambios v11 — Tarragona con nombres

- Corrige las UMT de Tarragona que podían aparecer rotuladas con números.
- Normaliza códigos ArcGIS `01`, `1.0` y `1,0` antes de compararlos con la tabla oficial.
- Los códigos adicionales de UMT ya no fuerzan el fallback a polígonos individuales; se ignoran al construir las 11 zonas oficiales y se deja aviso en consola.
- Si falta alguno de los 11 códigos oficiales, se mantiene el comportamiento seguro: no se inventan agrupaciones.
- `REFRESCAR_BARRIOS_OFICIALES.cmd` ya no considera Tarragona correcta solo por tener 11 objetos: comprueba que estén los 11 nombres esperados.
- La interfaz incorpora una reparación de compatibilidad para `tarragona.geojson` antiguos en los que una zona oficial tuviera nombre numérico y código válido.

Después de sustituir la versión, ejecutar una vez `REFRESCAR_BARRIOS_OFICIALES.cmd` y después `ARRANCAR_RADAR.cmd`.
