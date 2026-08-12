# Radar de pisos · Catalunya

Aplicación local-first para consultar cualquier municipio de Cataluña y priorizar zonas de búsqueda de vivienda. Las preferencias se importan desde `config/ZONAS_INTERES.md`; los límites municipales proceden del ICGC y la versión v5 añade `Àrees de poblament` como capa general de respaldo para los 947 municipios, conservando las divisiones municipales más precisas cuando existen.

## Ejecutar

```bash
npm install
npm run parse:interest
npm run refresh:catalog
npm run dev
```

Comprobaciones: `npm run build`, `npm run check:data`, `npm run check:icgc` y `npm test`.

## Arquitectura

- Vite + TypeScript, Leaflet e IndexedDB (`idb`), sin React.
- `config/` contiene configuración editable; `scripts/` genera índices reproducibles.
- `public/data/municipalities.json` es el catálogo oficial local de 947 municipios y sus límites.
- `public/data/municipality-zones/` conserva los barrios/sectores municipales e importaciones específicas (Barcelona, Girona, Tarragona y las que añadas después).
- `public/data/icgc-arees-poblament/municipis/` contiene un GeoJSON pequeño por municipio para carga parcial; incluye áreas pobladas e industria.
- La interfaz permite activar/desactivar capas sin borrar datos. Las capas municipales tienen prioridad y ICGC funciona como complemento o fallback.
- Las valoraciones personales se guardan únicamente en IndexedDB y no se mezclan con los datos territoriales.

## Datos, privacidad y límites

El catálogo municipal se genera desde el servicio oficial del ICGC y se registra en `data/sources.yml`. La aplicación no envía ni conserva el historial de ubicación; el GPS se procesa en el navegador. Un municipio sin barrios fiables se muestra como cobertura pendiente, sin inventar polígonos.

El service worker guarda la interfaz y los índices consultados. Las teselas de mapa requieren conexión salvo que el navegador las haya almacenado previamente.

## Publicación

`vite.config.ts` detecta automáticamente el nombre del repositorio durante GitHub Actions, para que las rutas de datos y mapas funcionen también en GitHub Pages.

## Cambios v39 · móvil y web pública

- En teléfono, el mapa aparece primero y el selector completo queda inmediatamente debajo.
- La barra de búsqueda queda accesible durante el desplazamiento, los botones conservan un tamaño táctil cómodo y se respetan las zonas seguras de pantalla.
- `.github/workflows/deploy-pages.yml` compila y publica la web en GitHub Pages al actualizar `main`.
- El manifiesto permite añadir el Radar a la pantalla de inicio desde un navegador móvil compatible.

## Cambios v40 · controles móviles

- El selector de zona se puede cerrar con una X, tocando fuera sobre el mapa o usando Atrás en Android; la elección no fuerza el cierre y puede rectificarse antes de salir.
- Las direcciones buscadas muestran una tarjeta táctil sobre el mapa con accesos directos a Google Maps y Google Earth mediante las coordenadas exactas del punto rojo.
- La tarjeta se puede cerrar y vuelve a mostrarse al tocar de nuevo el punto rojo.

## Cambios v41 · mapa móvil más despejado

- `Localizarme` se sustituye por un botón compacto con icono, texto de ayuda `Localización` y una posición que no se cruza con el zoom del mapa.
- Al localizar el teléfono, el Radar activa automáticamente el municipio en el que se encuentra el punto y centra allí el mapa.
- La ficha inferior queda dedicada a registrar viviendas y se reduce a una acción breve; la comparación continúa en el botón `Comparar`.
- Los datos de tipo, fuente y área se presentan como una fila compacta en teléfono.


## Cambios v6

- Las preferencias que solo difieren del nombre oficial por artículo o acento se vinculan al polígono oficial (por ejemplo, `Camp d\'en Grassot...` / `el Camp d\'en Grassot...`).
- Clicar una zona la selecciona y centra sin modificar el zoom.
- El botón `◇` de la derecha centra y amplía expresamente esa zona.
- `Municipio TOP` marca el municipio completo; no cambia la valoración de sus barrios. Los municipios TOP aparecen antes en las búsquedas.

Arranca siempre con `ARRANCAR_RADAR.cmd`; la carpeta `dist` puede reconstruirse con `npm run build`.

## Cambios v7 · auditoría profunda de capas

- Las listas personales sin geometría ya **no se mezclan con las capas visibles**. Se muestran, si hace falta, en un bloque plegado `nombres pendientes de polígono` y no cuentan como zonas visibles.
- Cada fila indica explícitamente su capa: barrio municipal, sector municipal, área ICGC, industria ICGC, referencia, etc.
- `Ocultar todos` oculta realmente los polígonos; ya no quedan siluetas fantasma con baja opacidad.
- El límite municipal es ahora una capa activable/desactivable independiente. Si apagas todas las capas, el mapa puede quedar sin ninguna geometría territorial.
- Se añadió carga automática de barrios oficiales para **Sabadell** (WFS municipal) y **Terrassa** (ArcGIS municipal). En desarrollo local Vite usa un proxy para evitar problemas CORS.
- Tarragona se considera cobertura municipal parcial si solo existen unos pocos polígonos nombrados; ICGC permanece como cobertura principal y la fuente incompleta no se autoimporta repetidamente.
- El importador genérico admite ahora `wfs` además de ArcGIS, Shapefile y GeoJSON.
- La coincidencia de nombres es conservadora pero más robusta: artículos, acentos y variantes compuestas como `Escola Industrial` ↔ `Plaça Catalunya-Escola Industrial`; también se reconoce `Sant Andreu de Palomar` como el barrio oficial `Sant Andreu` de Barcelona.
- `ZONE_COVERAGE_AUDIT.md` documenta qué nombres de interés tienen polígono, qué municipios tienen una fuente oficial configurada y qué nombres siguen pendientes.

Para actualizar Sabadell, Terrassa y l'Hospitalet y comprobar el estado de Tarragona, ejecuta `REFRESCAR_BARRIOS_OFICIALES.cmd`.

## Cambios v8 · importación KML y GML/XML

- El importador genérico de fuentes (`scripts/import_zones.mjs`) admite ahora **KML** y **GML/XML** además de ArcGIS REST, WFS, Shapefile y GeoJSON.
- Los GML/XML se convierten a GeoJSON y se reproyectan a WGS84. Se incluyen definiciones para CRS habituales en Catalunya: EPSG:23031, EPSG:25831 y EPSG:32631.
- El botón **Importar GIS** del navegador acepta `.xml`, `.gml`, `.kml`, `.geojson`, `.json`, `.gpkg`, Shapefile y ZIP.
- Badalona se incorpora desde `data/raw/bdn_barris_sgm.xml`: 34 barrios con geometría WFS/GML.
- Sant Feliu de Llobregat se incorpora desde `data/raw/sant-feliu-barris-2014.kml`: 10 polígonos de barrio. El archivo se conserva como fuente aportada y no se marca como oficial sin una referencia externa verificada.
- Las fuentes KML/GML pueden declararse por `file` o `url` en `config/gis-sources.json`.

Para regenerar ambas capas locales: `npm run zones:xml-kml` o `REIMPORTAR_XML_KML.cmd`.


## Cambios v9 · APIs de datos abiertos y Tarragona

- Eliminada la desactivación global de TLS. Los scripts de red usan los certificados del sistema mediante `--use-system-ca`.
- Tarragona deja de tratarse como una cobertura completa: se conservan sus polígonos municipales nombrados, pero ICGC sigue activo como base general. Los avisos por entidades sin nombre se agrupan.
- El importador genérico admite fuentes `ckan-wkt`: API CKAN/OData, CSV descargable y copia local como respaldo.
- Las URLs de recursos de `seu-e.cat` pueden pegarse en **Importar desde Internet**; se transforman automáticamente al endpoint OData del recurso.
- Integrados los 13 barrios oficiales de **l'Hospitalet de Llobregat** desde `Divisions territorials · Barris`, usando la geometría WKT WGS84 publicada por el Ayuntamiento.
- La aplicación mantiene la arquitectura por capas: una API oficial completa puede tomar prioridad; una fuente parcial nunca desactiva el respaldo ICGC.

## Cambios v10 · Tarragona y visores municipales

- Tarragona ya no depende de la capa `Barris` incompleta. `npm run zones:tarragona` combina el **Mapa de zones 2013** (nombres/códigos) con las **Unitats Mínimes Territorials** ArcGIS (geometría), validando los 11 códigos antes de agrupar.
- El PDF oficial de Tarragona se conserva en `data/raw`; no se digitaliza a ojo.
- Se añade `portal` como fuente reproducible: analiza HTML y JavaScript de visores municipales para descubrir WFS/ArcGIS.
- Esplugues tiene sus 10 nombres de barrio oficiales registrados y una fuente `portal` para intentar obtener automáticamente la geometría desde EnMapa. Si el visor no expone una capa compatible, no se generan límites ficticios.
- `REFRESCAR_BARRIOS_OFICIALES.cmd` incluye ahora Tarragona y Esplugues además de Sabadell, Terrassa y l'Hospitalet.

## Cambios v14 · Sabadell

El WFS oficial de Sabadell presenta en algunos equipos un error de cadena de certificado (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). La aplicación conserva la conexión TLS normal como primera opción. Solo para el host oficial `geoserver.ajsabadell.cat`, y únicamente tras ese error de certificado, el importador dispone de un fallback TLS acotado. Los datos no se guardan hasta comprobar que son exactamente 40 barrios poligonales, que contienen varios barrios ancla y que su geometría cae dentro del término municipal oficial. No se desactiva TLS globalmente.

Después de una descarga válida, `public/data/municipality-zones/sabadell.geojson` queda como copia local permanente y `REFRESCAR_BARRIOS_OFICIALES.cmd` ya no necesita consultar Sabadell mientras esa copia sea válida.
