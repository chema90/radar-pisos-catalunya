# Cambios v22

Esta versión parte de la v21 después de revisar la salida real de `01_ACTUALIZAR_DATOS.cmd` en Windows.

## Correcciones

- Lleida y Mataró: el importador ya no depende de adivinar un nombre de campo fijo. Cuando la fuente tiene nombres oficiales de control, detecta de forma conservadora qué atributo contiene los nombres de barrio y lo valida contra esos nombres antes de escribir.
- Si una fuente vuelve a producir 0 elementos válidos, el error muestra ahora campos y ejemplos recibidos para poder diagnosticarlo sin cambiar datos a ciegas.
- DIBA: se usa primero el recurso JSON oficial directo. Si se usa SHP y llega en ETRS89 / UTM 31N, se reproyecta a WGS84 antes de asignarlo a municipios. También se detectan ejes geográficos invertidos.
- DIBA: recibir cientos de polígonos y asignar cero ya no se considera éxito; se marca como error del importador y no como ausencia de datos.
- Sant Cugat: se prueba primero el endpoint estándar GeoServer `/geoserver/ows` y después `/geoserver/wfs`, manteniendo la validación estricta de barrios y la separación de Valldoreix.
- Lleida: se desactiva la carga directa del navegador contra una capa `/0` no validada; la capa municipal se incorpora únicamente mediante el refresco seguro que descubre y valida el layer correcto.

## Seguridad

- No se activa AMB automáticamente.
- Sant Cugat sigue excluido de AMB.
- DIBA sigue siendo solo referencia de núcleos/urbanizaciones, nunca barrio ni sustituto de una capa municipal.
- No se han modificado preferencias personales.
- No se han sustituido capas municipales existentes durante la preparación de esta versión.

- AMB: la documentación oficial consultada sigue indicando 268 AEM, mientras la capa viva devolvió 269 en la prueba real de Windows. La preparación de candidatos sigue permitida, pero `zones:amb:apply` queda bloqueado por seguridad mientras exista esa discrepancia, salvo una autorización técnica explícita posterior.
