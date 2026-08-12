# Cambios v20

## Barrios municipales prioritarios

- **Lleida**: importación oficial desde el servicio `Barris_Lleida` publicado en la cuenta ArcGIS de la Paeria. Se exige geometría poligonal, al menos 12 entidades y nombres-ancla reconocibles. La lista conocida incluye los 12 barrios que publica actualmente la página municipal, pero la capa GIS puede contener más y no se limita artificialmente a 12.
- **Mataró**: importación desde el SHP ETRS89 oficial del Ayuntamiento. Se validan 11 barrios y varios nombres-ancla antes de escribir.
- **Sant Cugat del Vallès**: se mantiene AMB bloqueado. El importador consulta el GeoServer/WFS municipal y busca una capa de barrios, validando nombres-ancla y cobertura antes de escribir. Los 49 nombres conocidos proceden de la propuesta municipal de delimitación de 2024; la capa GIS actual puede contener 49 o más y no se bloquea artificialmente en un número exacto. Valldoreix sigue separado como EMD y sus nombres nunca se aceptan dentro del fichero de Sant Cugat.

## Maresme

- Se añade `scripts/import_diba_settlements.mjs` como **fuente territorial de referencia**, no como fuente de barrios.
- Apunta a los 30 municipios del Maresme y separa por geometría municipal los polígonos publicados por la Diputació de Barcelona como núcleos/urbanizaciones.
- Los resultados se guardan únicamente como `*-reference.geojson` y nunca reemplazan una capa municipal de barrios.
- Si el municipio obtiene una división municipal oficial suficiente antes de este paso, la referencia DIBA se omite.

## Vilafranca y Sant Sadurní

- Se mantienen los 8 nombres municipales de Vilafranca y los 7 barrios tradicionales de Sant Sadurní sin inventar límites internos.
- La fuente DIBA puede añadir polígonos de núcleo/urbanización para mejorar el mapa general, pero esos polígonos no se etiquetan como barrios.

## Interfaz

- `Crear desglose` ya no se comprime verticalmente en la barra lateral: conserva una sola línea y salta debajo del texto de cobertura si no cabe.
- La etiqueta de capa distingue `Barrios`, `Ámbitos estadísticos AMB` y `Núcleos / urbanizaciones (DIBA)` según la fuente realmente visible.
- La ficha de fuente muestra `DIBA + ICGC` cuando la referencia DIBA es la mejor división disponible.

## Seguridad

- No se activa AMB automáticamente.
- DIBA escribe solo ficheros de referencia y hace copia de seguridad de una referencia anterior antes de actualizarla.
- Las fuentes municipales prioritarias conservan una capa válida previa si el servidor remoto falla.
- No se modifica ninguna preferencia del usuario.
