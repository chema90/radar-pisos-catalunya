# Cambios v14 · Sabadell resistente a certificado defectuoso

- El WFS oficial de Sabadell sigue siendo la fuente prioritaria. IDEC confirma que el servicio oficial de descarga WFS del Ayuntamiento contiene las divisiones administrativas.
- Se mantiene primero la conexión TLS normal con certificados del sistema (`--use-system-ca`).
- Si, y solo si, `geoserver.ajsabadell.cat` falla por un error de cadena de certificado conocido (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` y equivalentes), el importador puede realizar una petición de respaldo sin validar el certificado para ESE HOST EXACTO.
- No se usa `NODE_TLS_REJECT_UNAUTHORIZED=0` y no se desactiva TLS para el resto de Internet.
- La descarga de respaldo se rechaza si no cumple todos estos controles antes de escribir `sabadell.geojson`:
  - exactamente 40 barrios;
  - geometrías Polygon/MultiPolygon;
  - aparecen barrios ancla: Centre, Covadonga, Creu Alta, Gràcia y Can Rull;
  - al menos el 99 % de los vértices cae dentro del bbox oficial del término municipal con un margen pequeño.
- Una vez validada, la capa queda guardada localmente. Los refrescos posteriores no necesitan acceder al WFS mientras la copia siga siendo válida.
- El recuperador de versiones anteriores también exige ahora 40 barrios y los cinco nombres ancla para aceptar una copia de Sabadell.
