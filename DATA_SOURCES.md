# Fuentes iniciales

| Ámbito | Organismo | Fuente | Formato | Licencia | Estado |
| --- | --- | --- | --- | --- | --- |
| Todos los municipios | ICGC / Generalitat | Divisions administratives de Catalunya, municipios 1:50.000 | GeoJSON | CC BY 4.0 | Importado: catálogo y límites municipales |
| Divisiones internas | Ayuntamiento competente | Pendiente de adaptador municipal | Variable | Por registrar | No se sustituye por fuentes secundarias |

Consulta el detalle estructurado en `data/sources.yml`. El script de importación guarda el SHA-256 del recurso descargado junto al catálogo público.

## Cobertura territorial general añadida

| Ámbito | Organismo | Fuente | Formato de origen | Uso en la aplicación | Estado |
| --- | --- | --- | --- | --- | --- |
| Catalunya completa | ICGC | Àrees de poblament v3r1 (2026-02) | GeoPackage | Respaldo por municipio, núcleos/áreas pobladas y sectores industriales | Integrado: 947 archivos municipales de carga parcial |

La capa ICGC no sustituye una división municipal de barrios cuando ésta exista. Se utiliza como segunda capa o como respaldo para municipios sin desglose municipal incorporado. Los sectores industriales se conservan íntegramente como contexto inmobiliario.

## Fuentes municipales añadidas en la auditoría v7

| Municipio | Organismo | Fuente | Formato | Uso |
| --- | --- | --- | --- | --- |
| Sabadell | Ajuntament de Sabadell | Servei de descàrrega WFS de divisions territorials | WFS | Barrios municipales; selección automática de la capa `barris` |
| Terrassa | Ajuntament de Terrassa | `Utilitaris/ajt_divadm/MapServer/1` (`pt_barri`) | ArcGIS REST | Barrios municipales (`NOM_BARRI`) |
| Tarragona | Ajuntament de Tarragona | Hosted/Barris/FeatureServer/0 | ArcGIS REST | Completar la capa municipal cuando el archivo empaquetado sea incompleto |

Estas fuentes tienen prioridad sobre `Àrees de poblament` para la división interna. ICGC sigue disponible como capa complementaria y conserva los sectores industriales.

## Fuentes locales incorporadas en v8

| Municipio | Fuente | Formato | CRS origen | Resultado | Calidad declarada |
| --- | --- | --- | --- | --- | --- |
| Badalona | `data/raw/bdn_barris_sgm.xml` | WFS/GML 3.2 | EPSG:23031 | 34 barrios en `badalona.geojson` | oficial |
| Sant Feliu de Llobregat | `data/raw/sant-feliu-barris-2014.kml` | KML | WGS84 | 10 barrios en `sant-feliu-de-llobregat.geojson` | importado; fuente aportada |

El importador no presupone que un KML/XML sea oficial. La oficialidad y la calidad se declaran por fuente en `config/gis-sources.json`.

## APIs de datos abiertos añadidas en v9

La aplicación puede importar directamente respuestas de APIs CKAN/OData que entreguen registros con geometría WKT, además de GeoJSON, WFS y ArcGIS. En la plataforma `seu-e.cat`, una URL de recurso con UUID se transforma automáticamente a su endpoint OData cuando se pega en "Importar desde Internet".

| Municipio | Organismo | Fuente | Formato | Resultado |
| --- | --- | --- | --- | --- |
| l'Hospitalet de Llobregat | Ajuntament de l'Hospitalet | Divisions territorials · Barris | API CKAN/OData + CSV WKT | 13 barrios oficiales en `l-hospitalet-de-llobregat.geojson` |

El importador por scripts admite el tipo `ckan-wkt`: intenta primero la API, después el CSV descargable y finalmente el fichero local de respaldo. No se desactiva la validación TLS.

Tarragona se trata explícitamente como cobertura municipal parcial: su FeatureServer es poligonal, pero la mayoría de entidades recibidas actualmente no llevan nombre. Los dos polígonos nombrados se conservan, ICGC sigue activado como cobertura principal y el refresco no repite avisos por cada entidad sin nombre.

## v10 · Tarragona por UMT + mapa oficial y detección de visores dinámicos

### Tarragona

Se deja de usar `Hosted/Barris/FeatureServer/0` como fuente principal porque el servicio devuelve la mayoría de polígonos sin nombre. La referencia territorial pasa a combinar dos recursos municipales distintos, sin digitalizar el PDF a mano:

1. `data/raw/tarragona-zones-empadronament-2013.pdf`: mapa municipal de zonas (agosto de 2013). Se conserva como **referencia de nomenclatura y códigos**, no como geometría GIS. Contiene 11 códigos: 1–8 y 10–12.
2. `Hosted/Unitats_Minimes_Territorials/FeatureServer/0`: capa poligonal ArcGIS de UMT, con los campos `nom`, `id` y `agrupacio`. Se usa como **fuente geométrica**.

El tipo de fuente `arcgis-grouped` valida que los valores de `agrupacio` coincidan exactamente con los 11 códigos de la referencia. Solo entonces reúne las UMT de cada código en Polygon/MultiPolygon y genera las zonas municipales. Si los códigos cambian o faltan, no se reconstruyen límites: se conservan las UMT individuales como sectores municipales y ICGC permanece activado como respaldo.

### Esplugues de Llobregat

El registro IDEC `planol-esplugues` acredita un plano municipal vectorial y enlaza al visor EnMapa. El metadato no ofrece por sí solo un fichero de polígonos de barrios. El Ayuntamiento confirma 10 nombres de barrio, que se incorporan a `known-zones.json` como nomenclatura oficial.

Se añade el tipo de fuente `portal`: el importador analiza el HTML del visor y hasta 12 scripts JavaScript cargados buscando endpoints WFS o ArcGIS. La capa solo se acepta si parece una capa de barrios y produce al menos los 10 polígonos esperados. Si el visor utiliza una API propietaria o no expone geometría territorial descargable, la importación se omite y no se crea ningún polígono artificial.

## Sabadell · recuperación y fuente alternativa

La fuente principal de barrios sigue siendo el WFS oficial del Ajuntament de Sabadell (`geo.sbd_divt_barris`). La v13 no considera completa una descarga con menos de 40 barrios y puede recuperar una copia local válida generada en una versión anterior del Radar. Como referencia alternativa se ha localizado el mapa público `Mapa de Barris de Sabadell` en ICGC/Instamaps, atribuido al Ajuntament de Sabadell y publicado con opciones de descarga vectorial. No se sustituye automáticamente el WFS por una geometría no validada.

## Tiana

El Ayuntamiento describe la trama urbana como el núcleo antiguo y los barrios de la Virreina y Mas Ram. No se ha localizado una división administrativa municipal completa en polígonos. Por ello el Radar conserva esos nombres y enlaza la Virreina y Mas Ram con las áreas de poblamiento ICGC de igual nombre, manteniendo explícitamente el tipo de capa ICGC.

## El Masnou

Fuentes municipales recientes utilizan los nombres Bellresguard, Ocata, Masnou Alt, La Colomina y Masnou Centre. No se ha localizado una capa vectorial municipal de límites de barrios suficientemente inequívoca. Se registran como nombres conocidos y quedan pendientes de polígono; la aplicación no fabrica delimitaciones.
