# Radar de pisos Catalunya · v29

Base: v28 local probada por el usuario.

## Correcciones

### Vilanova i la Geltrú
- Se mantienen el TLS controlado exclusivo para `gis.vilanova.cat` y la unión espacial de 18 polígonos con 18 etiquetas oficiales.
- Se añade normalización automática y conservadora de coordenadas antes de validar el término municipal.
- Solo se acepta una transformación si deja al menos el 99 % de los vértices dentro del bbox municipal ampliado.
- Transformaciones candidatas: sin cambio, ejes X/Y invertidos, ETRS89/UTM 31N (EPSG:25831), ED50/UTM 31N (EPSG:23031), WGS84/UTM 31N (EPSG:32631) y Web Mercator (EPSG:3857).
- Si ninguna encaja, no se escribe la capa.
- Sigue exigiéndose exactamente 18 barrios y los 18 nombres oficiales.

### Lloret de Mar
- Se bloquean expresamente recursos de secciones/distritos censales, electorales, sanitarios, policiales y ABS.
- El importador ya no acepta un GeoJSON solo por pertenecer al dataset `Zonificacions administratives`.
- Para ser candidato debe corresponder explícitamente a zonas estadísticas o zonificación territorial de incidencias.
- Si no existe un recurso territorial adecuado, Lloret queda `PENDIENTE` y se conserva ICGC como referencia de núcleos/urbanizaciones.
- Se desactiva la recuperación automática de una capa Lloret desde versiones anteriores para evitar copiar la capa incorrecta de 17 secciones censales generada por v28.

### Vic / WMS
- Si un supuesto endpoint WMS devuelve HTML en vez de XML OGC, se rechaza de forma limpia antes de pasarlo al parser XML.

## Sin cambios
- Sant Cugat: geometría intacta.
- Valldoreix: geometría intacta.
- Granollers: se mantiene la validación estricta de 16 barrios.
- DIBA y AMB: sin cambios.
- Frontend, mapa, preferencias, TOP y pisos vistos: sin cambios.
