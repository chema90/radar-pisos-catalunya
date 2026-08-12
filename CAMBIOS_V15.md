# Cambios v15

- Lleida: fuente ArcGIS municipal de barrios configurada.
- Mataró: descarga SHP municipal de límites de barrios configurada.
- Reus: adaptador para la GeoAPI oficial de barrios y sus polígonos.
- Lloret de Mar: capa municipal de barris/urbanitzacions desde ZIP SHP. Se conserva como `zone` porque mezcla barrios y urbanizaciones.
- Sant Cugat: conexión directa al GeoServer/WFS municipal para descubrir la capa `Barris`; se sustituyen las referencias metropolitanas de 2016 por nomenclatura municipal/EMD actual como respaldo.
- Santa Coloma de Gramenet, Cornellà, Sant Boi, Blanes y Sant Feliu de Guíxols: nombres documentados añadidos sin inventar geometría.
- Sant Sadurní d'Anoia: se conservan sus 7 barrios tradicionales ya existentes.
- El importador SHP admite ahora ZIP remotos además de archivos locales.
- Nuevo adaptador `reus-geoapi`.
- Nuevo `REFRESCAR_NUEVOS_MUNICIPIOS.cmd`.
- Encontrada también la capa metropolitana de referencia 2016 del Institut Metròpoli/AMB en Shapefile/RAR; no se toma como división municipal actual y queda documentada como posible respaldo futuro.

## Fuente metropolitana AMB
- Se añade `AMB · Àmbits Estadístics Metropolitans` como segunda fuente poligonal para los 36 municipios metropolitanos.
- La prioridad queda fijada: fuente municipal oficial completa > AMB AEM > ICGC/referencias.
- AMB nunca pisa una fuente municipal que haya superado la validación de cobertura.
- Nuevo importador masivo `npm run zones:amb`, que descarga una vez la capa AMB y la separa por código INE.
- En `Crear desglose` se muestra AMB como segunda fuente cuando el municipio pertenece al AMB.

## v16 · validación de prioridad
- Corregida la evaluación de cobertura para evitar recursión entre el recuento de capas y la validación municipal.
- Si AMB está disponible como respaldo, ICGC de población queda oculto por defecto para respetar la prioridad Municipal > AMB > ICGC.
- Añadida `AMB_SOURCE_POLICY.md` con reglas objetivas de selección y validación.
