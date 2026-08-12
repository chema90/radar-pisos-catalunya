# Búsqueda profunda de cartografía de barrios · V33

Fecha de revisión: 10/08/2026

Objetivo: localizar divisiones territoriales municipales que todavía no están consolidadas en el Radar. Se priorizan fuentes municipales, servicios GIS/ArcGIS/WFS/WMS/GeoJSON y, en segundo nivel, mapas municipales PDF/visores que demuestran que la delimitación existe aunque todavía haya que extraerla.

## Novedades de la ronda V33

### Tarragona — NUEVA FUENTE VECTORIAL DIRECTA
- El Geoportal del Ajuntament de Tarragona publica `Hosted/Barris/FeatureServer/0`.
- La capa se llama literalmente `Barris`, es `esriGeometryPolygon`, usa `nom` como campo visible y admite JSON/GeoJSON.
- URL: https://geoportal.tarragona.cat/server/rest/services/Hosted/Barris/FeatureServer/0
- Estado V33: añadida al actualizador como `barri`. Se importa junto con las 11 zonas amplias derivadas de UMT; las zonas previas quedan protegidas si UMT falla temporalmente.
- Validación prevista: mínimo 10 barrios, geometría dentro del término y barrios de control Part Alta, Campclar, Bonavista, Sant Salvador y Sant Pere i Sant Pau.

### Rubí — 23 ámbitos actuales confirmados; vector aún oculto
- `Alcaldessa als barris` enumera 23 ámbitos y permite buscar por dirección o pulsar el mapa, lo que confirma una relación espacial operativa.
- Ámbitos: 25 de Setembre, Ca N’Oriol, Ca n'Alzamora, Can Barceló - Vallespark, Can Fatjó, Can Rosés, Can Serrafosà - La Perla, Can Solà, Can Vallhonrat, Can Ximelis, Castellnou - Can Mir, Centre, El Mercat, El Pinar, Els Avets, Les Torres, Plana Can Bertran, Plana del Castell, Progrés - Rubí 2000, Sant Jordi Park, Sant Muç, Sector Z y Zona Nord - La Serreta.
- El catálogo GIS municipal permite descargar diversas capas en GeoJSON, pero el directorio público de descargas no ofrece todavía una capa denominada barrios/ámbitos de `Alcaldessa als barris`.
- URLs: https://gis.rubi.cat/ab/ · https://gis.rubi.cat/cataleg/ · https://gis.rubi.cat/downloads/
- Estado V33: nombres añadidos como referencias oficiales; sin polígonos inventados.

### Sant Andreu de la Barca — 8 barrios y calle→barrio confirmados
- La web municipal publica un `Mapa de divisió de barris` y, además, una relación explícita de calles con barrio.
- Barrios actuales: La Solana, Nucli Antic, Can Prats, Pla de l'Estació, El Palau, La Plana, La Colònia y El Centre.
- Esto permite auditar cualquier futuro vector contra una fuente mucho más fuerte que una simple lista de nombres.
- URL: https://sabarca.cat/regidories-de-barri
- Estado V33: 8 nombres añadidos; el endpoint vectorial del mapa sigue pendiente.

### Montcada i Reixac — 12 barrios/núcleos actuales + Geoportal/SITMUN
- El Ayuntamiento enumera actualmente: Can Cuiàs, Can Pomada, Can Sant Joan (Bifurcació), Carrerada (Montcada Nova), Font Pudenta, La Ribera (Valentine), Mas Duran, Mas Rampinyo, Montcada Centre, Pla d'en Coll, Terra Nostra (Santa Maria de Montcada) y Vallençana-Reixac.
- Mantiene un Geoportal con servicios normalizados y forma parte de la red SITMUN.
- URLs: https://www.montcada.cat/el-municipi/informacio-geografica · https://www.montcada.cat/el-municipi/informacio-del-municipi/presentacio-de-la-ciutat
- Estado V33: 12 nombres añadidos; vector específico de barrios todavía pendiente.

### Santa Coloma de Gramenet — límites cartografiados, vector original pendiente
- La sección municipal de Cartografia, actualizada el 03/02/2026, permite descargar planos de barrios y distritos y afirma expresamente que se pueden consultar/imprimir las divisiones territoriales.
- URL: https://www.gramenet.cat/ajuntament/arees-municipals/planejament-urbanistic-informacio-urbanistica/cartografia/
- Estado: el Radar ya conserva 17 nombres; falta localizar el servicio que generó el plano.

### Sant Boi de Llobregat — infraestructura ArcGIS pública, pero sin `Barris` localizado
- El ArcGIS Enterprise municipal es público y expone numerosos FeatureServer de Open Data (`OD`).
- Se han localizado capas de planeamiento, direcciones, parcelario y división censal; ninguna de ellas debe sustituir barrios.
- No se ha encontrado todavía una Feature Layer pública inequívoca `Barris`.
- URL raíz: https://cartoweb.santboi.cat/server/rest/services
- Estado: mantener los 6 barrios conocidos; seguir rastreando el mapa municipal de población.

### SITMUN — vía sistemática para varios pendientes de Barcelona
- La Diputació de Barcelona confirma que Montcada i Reixac, Barberà del Vallès, Castelldefels, el Prat de Llobregat y Manresa, entre otros, forman parte de la Xarxa Local SITMUN.
- SITMUN puede publicar capas municipales oficiales y permite, según el recurso, visualización y descarga total/parcial.
- Esto convierte a SITMUN en una vía de extracción prioritaria para varios municipios que hoy aparecen como `PENDIENTE`.
- Portal: https://sitmun.diba.cat/idelocals/


## A. Fuente vectorial municipal lista para integrar

### Viladecans — INTEGRADA Y VALIDADA
- Fuente: Ajuntament de Viladecans · ArcGIS REST.
- Servicio: `Població_per_Barris (FeatureServer)`.
- Capa: `viladecansgis.datagis.pob05_poblacio_barris` (id 4).
- Geometría: Polygon.
- Campos: `barri`, `nom_barri`.
- Consulta: JSON / GeoJSON.
- CRS nativo: EPSG:25831; ArcGIS permite solicitar salida 4326.
- URL: https://geoportal.viladecans.cat/server/rest/services/Poblaci%C3%B3_per_Barris/FeatureServer
- Estado V33: integrada; la ejecución real de V32 confirmó 13 barrios municipales válidos.

## B. La delimitación/mapa municipal existe; falta extraer el vector

### Rubí — PRIORIDAD MUY ALTA · ver actualización V33 arriba
- El Ayuntamiento publica la aplicación GIS `Alcaldessa als barris`.
- Permite escribir una dirección y devuelve la zona/distrito correspondiente; por tanto hay geometrías territoriales detrás de la aplicación.
- La aplicación enumera barrios/zonas como Can Fatjó, Sant Jordi Parc, Can Serrafossà-La Perla, Can Ximelis, Els Avets, Castellnou-Can Mir, Sant Muç, Centre, Ca n'Oriol, etc.
- URLs:
  - https://gis.rubi.cat/ab/
  - https://gis.rubi.cat/cataleg/
- Próximo paso: inspeccionar llamadas internas de la aplicación y localizar su servicio de polígonos.

### Santa Coloma de Gramenet — PRIORIDAD MUY ALTA
- El Ayuntamiento publica expresamente `Plànol Barris ciutat` en A3 y A1, además de distritos y secciones censales.
- La delimitación municipal de barrios está cartografiada; falta localizar un servicio vectorial o extraerla desde la fuente original del plano.
- URL: https://www.gramenet.cat/ajuntament/arees-municipals/planejament-urbanistic-informacio-urbanistica/cartografia/

### Sant Andreu de la Barca — PRIORIDAD ALTA · ver actualización V33 arriba
- La web municipal contiene un `Mapa de divisió de barris` interactivo dentro de Regidories de Barri.
- Es una división actual y usada por el Ayuntamiento.
- URL: https://sabarca.cat/regidories-de-barri
- Próximo paso: seguir el enlace del mapa a pantalla completa y localizar la capa subyacente.

### Mollet del Vallès — PRIORIDAD MUY ALTA
- El Ayuntamiento publica `Plànol interactiu de Mollet per barris` y mantiene Regidories de Barris.
- La geometría visual existe, pero el scraper actual no ha localizado aún WFS/WMS/ArcGIS.
- URLs:
  - https://www.molletvalles.cat/ca/la-ciutat/planol-de-barris
  - https://www.molletvalles.cat/ca/l-ajuntament/organitzacio-municipal/regidories-de-barris

### Vic — PRIORIDAD MUY ALTA
- El Ayuntamiento confirma 14 barrios delimitados y recogidos en el Pla Director de Barris.
- El portal GIS municipal existe, pero actualmente devuelve HTML/recursos protegidos cuando se sondea como WMS.
- URL: https://www.vic.cat/serveis/ciutadania/ciutadania/suport-municipal-als-barris
- Estado: nombres oficiales completos; vector pendiente de endpoint.

### Manresa — PRIORIDAD MUY ALTA
- La web municipal enlaza explícitamente `Mapa dels barris de Manresa`.
- El mapa existe; el visor no expone todavía una URL WFS/WMS/ArcGIS detectable automáticamente.
- URL: https://www.manresa.cat/web/article/4759-barris

### Cornellà de Llobregat — PRIORIDAD ALTA
- El Ayuntamiento publica `PLANOL_CORNELLA_BARRIS.jpg` y define oficialmente la organización territorial en Centre/Riera, Almeda, Pedró, Gavarra, Sant Ildefons y Fontsanta-Fatjó.
- URL: https://www.cornella.cat/ca/viure-a-cornella/la-ciutat/dades-basiques
- Próximo paso: buscar la capa original que generó el plano; no usar la imagen raster como geometría si se puede evitar.

### Sant Joan Despí — PRIORIDAD ALTA
- El Ayuntamiento define cinco ámbitos y describe sus límites por calles y grandes infraestructuras: Centre, les Planes, Pla del Vent-Torreblanca, Residencial Sant Joan y les Begudes.
- URL: https://sjdespi.cat/sant-joan-despi/els-barris
- La delimitación es suficientemente explícita para auditar un futuro vector, pero V32 no dibuja límites manualmente.

### Sant Boi de Llobregat — PRIORIDAD ALTA
- El Ayuntamiento publica un `Mapa de població` por barrios y utiliza barrios como Marianao, Centre, Molí Nou/Ciutat Cooperativa, etc.
- Dispone además de mapas municipales interactivos.
- URLs:
  - https://santboi.cat/mapa-de-poblacio
  - https://www.santboi.cat/ajuntament/Urbanisme
- Próximo paso: localizar el recurso geográfico utilizado por el mapa de población.

### Montcada i Reixac — PRIORIDAD ALTA · ver actualización V33 arriba
- El Ayuntamiento dispone de Geoportal municipal con servicios geográficos normalizados.
- El proyecto municipal de Memòria Visual publica además un mapa `Barri a barri` con Can Cuiàs, Montcada Nova, Mas Duran, Terra Nostra, Can Pomada, Font Pudenta, Mas Rampinyo, Vallensana/Reixac, Can Sant Joan, La Ribera, Montcada Centre, Pla d'en Coll, etc.
- URLs:
  - https://www.montcada.cat/el-municipi/informacio-geografica/
  - https://memoriavisual.montcada.cat/barri-a-barri/
- Próximo paso: buscar si esos límites están disponibles como capa del Geoportal.

### Santa Perpètua de Mogoda — PRIORIDAD ALTA
- El Ayuntamiento afirma que 8 barrios componen la estructura del municipio.
- Dispone de Geoportal/SITMUN y mapas municipales descargables.
- URLs:
  - https://www.staperpetua.cat/el-municipi/
  - https://www.staperpetua.cat/el-municipi/informacio-del-municipi/informacio-geografica
- Próximo paso: inspeccionar SITMUN buscando una capa de barrios.

### Esplugues de Llobregat — PRIORIDAD ALTA
- El Ayuntamiento confirma 10 barrios: Can Clota, Can Vidalet, Centre, Ciutat Diagonal, El Gall, Finestrelles, La Mallola, La Miranda, La Plana y Montesa.
- Existe Geoportal Nexus, pero el actualizador aún no encuentra un servicio vectorial de barrios.
- URL: https://www.esplugues.cat/ciutat/coneix-esplugues/

### Olot — PRIORIDAD MEDIA-ALTA
- El Ayuntamiento mantiene un GIS corporativo y un Geoportal capaz de conectarse a WebMapServices y de imprimir en calidad vectorial.
- La cartografía municipal está mantenida por el Área d'Informació del Territori.
- URLs:
  - https://www.olot.cat/ca/olot/planol-d-olot/geoportal.htm
  - https://www.olot.cat/olot/planol-d-olot/informacio-cartografica-municipal
- No se ha localizado aún una capa explícita `barris`.

### El Vendrell — PRIORIDAD ALTA
- El Ayuntamiento mantiene `Visió Gis / Plànol interactiu`.
- No se ha localizado aún una capa vectorial de barrios expuesta públicamente.
- URL: https://www.elvendrell.net/
- Importante: la búsqueda por dirección del Radar se corrige en V32 independientemente de esta carencia de polígonos de barrio.

### Figueres — PRIORIDAD ALTA
- El Ayuntamiento tiene área oficial de Barris, un `Plànol regidories de barri` y portal de plànols/planejament.
- URLs:
  - https://www.figueres.cat/temes/barris
  - https://www.figueres.cat/actualitat/noticies/figueres-potencia-la-regidoria-de-barris-amb-l2019objectiu-de-donar-mes-veu-i-treballar-conjuntament-amb-les-associacions-de-veins/planol-regidories-3-1.pdf/view
  - https://www.figueres.cat/figueres/planols
- Todavía no se ha localizado un servicio vectorial de límites de barrio.

### Blanes — PRIORIDAD ALTA
- Existe Geoportal Urbanístic municipal y cartografía municipal.
- El Ayuntamiento documenta expresamente ámbitos de barrio como S'Auguer y Sa Massaneda, pero no se ha localizado una capa completa de todos los barrios.
- URLs:
  - https://mapes.blanes.cat/blanesgp/
  - https://www.blanes.cat/pladebarris

### Palafrugell — PRIORIDAD MEDIA-ALTA
- El Ayuntamiento publica una sección actual de barrios: Camp d'en Prats, Carrer Ample, La Punxa, La Sauleda, Mas Mascort, Piverd y Vila-seca i Bruguerol.
- Dispone de Plataforma GIS / Geoportal Urbanístic.
- URLs:
  - https://www.palafrugell.cat/la-ciutat/barris/barris-palafrugell
  - https://mapes.palafrugell.cat/portada/
- Próximo paso: inspeccionar el geoportal buscando una capa coincidente.

### Valls — PRIORIDAD MEDIA
- El Ayuntamiento mantiene una plataforma pública de Geoportals SIG y una guía ciudadana con búsqueda de direcciones.
- URL: https://www.valls.cat/la-ciutat/mapa-de-la-ciutat
- No se ha localizado todavía una capa específica de barrios.

### Cambrils — PRIORIDAD MEDIA
- Geoportal municipal oficial con información cartográfica y urbanística.
- URL: https://www.cambrils.cat/ca/serveis/urbanisme
- No se ha localizado todavía una capa específica de barrios.

### Amposta — PRIORIDAD MEDIA
- El Ayuntamiento dispone de cartografía municipal y una sección específica `Els nuclis de població i els barris`.
- El Pla de Barris 2025-2029 actúa en La Vila, el Grau y Pla d'Empúries, pero eso no equivale necesariamente a una división completa de todo el municipio.
- URLs:
  - https://www.amposta.cat/ca/n4/la-ciutat/coneix-amposta/geografia-i-patrimoni/cartografia-municipal
  - https://www.amposta.cat/ca/n4/la-ciutat/coneix-amposta/geografia-i-patrimoni/nuclis-poblacio-i-barris

### Tortosa — PRIORIDAD MEDIA
- El Ayuntamiento utiliza oficialmente 9 barrios del núcleo de Tortosa: Santa Clara, Sant Llàtzer, Temple/Grup del Temple, Centre/Nucli Antic, Simpàtica, Remolins, Ferreries, Rastre y Sant Josep de la Muntanya.
- También publica planos de la ciudad y de EMD/pedanías.
- URLs:
  - https://www2.tortosa.cat/organitzacio-govern-municipal/index.php
  - https://www2.tortosa.cat/ciutat/planols.php
- No se ha localizado aún vector de esos nueve barrios.

## C. Existe cartografía/organización de barrios, pero no se ha demostrado un límite GIS completo

### Vilafranca del Penedès
- El Radar ya conserva los 8 nombres municipales conocidos.
- DIBA aporta núcleos/urbanizaciones de referencia, no barrios.
- En esta búsqueda no se ha localizado una capa vectorial municipal pública de los ocho límites.

### Igualada
- El Ayuntamiento trabaja con barrios y ejes de barrio, pero no se ha localizado una capa pública de límites de barrio.
- No confundir cartografía de distritos/planeamiento con barrios.

### Salt
- Existen asociaciones y ámbitos vecinales, pero no se ha localizado en esta ronda una división municipal completa de polígonos de barrio publicitada como GIS.

### El Prat de Llobregat
- El Ayuntamiento tiene cartografía urbana; el `Plànol de la ciutat` estaba temporalmente fuera de servicio durante la revisión.
- No se ha localizado una capa oficial de límites de barrio.
- URL: https://www.elprat.cat/planol-de-la-ciutat

### Castelldefels
- Dispone de cartografía/visores municipales, pero no se ha localizado una capa verificable de división completa por barrios.

## D. No tratar como división oficial estable todavía

### Cerdanyola del Vallès — NO INVENTAR
- En marzo de 2026 el Pleno aprobó una moción específicamente para realizar la delimitación oficial de los barrios, crear consejos de barrio y un plan integral.
- Esto indica que una división oficial consolidada sigue en proceso de definición.
- Existe un plano 2026 de urbanizaciones/núcleos en terrenos forestales, pero NO es un mapa de barrios.
- URLs:
  - https://www.cerdanyola.cat/actualitat/resum-del-ple-ordinari-del-26-de-marc-de-2026
  - https://www.cerdanyola.cat/seu-electronica/documents-en-tramit-dinformacio-publica/planol-delimitacio-urbanitzacions

### Sant Feliu de Guíxols — PROPUESTA/HISTÓRICO, NO GIS ADMINISTRATIVO VERIFICADO
- La fuente municipal localizada corresponde a una propuesta de configuración de barrios de los Tallers d'Història.
- No se etiqueta como delimitación administrativa GIS vigente hasta encontrar una fuente más fuerte.
- URL: https://www.arxiumunicipal.guixols.cat/tallers-d-historia/els-barris-de-sant-feliu.html

## Prioridad recomendada de próximas extracciones

1. Viladecans — integrado y validado (13 barrios).
2. Tarragona — nueva Feature Layer oficial `Barris`; integrada en V33 y pendiente de validación en Windows.
2. Rubí — visor de dirección a zona: geometría casi segura detrás de la app.
3. Santa Coloma de Gramenet — plano municipal explícito de barrios.
4. Mollet — plano interactivo de barrios.
5. Vic — 14 barrios oficialmente delimitados.
6. Manresa — mapa municipal explícito de barrios.
7. Sant Andreu de la Barca — mapa interactivo de división de barrios.
8. Cornellà — plano municipal de organización territorial.
9. Sant Boi — mapa de población por barrios.
10. Montcada i Reixac — Geoportal + mapa municipal de barrios.
11. Sant Joan Despí — cinco ámbitos con límites descritos oficialmente.
12. Santa Perpètua — 8 barrios + SITMUN/Geoportal.
13. Esplugues — 10 barrios + Nexus.
14. Figueres / Blanes / Palafrugell / Olot / El Vendrell.

## Regla de seguridad del Radar

- `barri`: solo división municipal que podamos defender como barrio y con geometría validada.
- `zone`: zonificación municipal útil pero de otra naturaleza (p. ej. Lloret Zones Estadístiques).
- `reference`: núcleo/urbanización ICGC o DIBA.
- Si solo hay mapa/PDF/nombres, se conserva la referencia pero no se fabrica un polígono.

## Anexo: otros municipios grandes/medios revisados en esta ronda

### Sant Adrià de Besòs — PRIORIDAD ALTA
- El Ayuntamiento mantiene una división territorial explícita de 6 barrios: Sant Adrià Nord, Sant Joan Baptista, La Verneda, La Catalana, El Besòs y La Mina, y publica un plano municipal 2024.
- URLs:
  - https://www.sant-adria.cat/sant-adria-per-temes/regidories-de-barri/trajana/dades-sobre-el-barri-de-via-trajana
  - https://www.sant-adria.cat/sant-adria-per-temes/territori/documents/planol-2024/view
- Falta localizar la geometría vectorial original del plano/división.

### Castelldefels — PRIORIDAD ALTA
- El Ayuntamiento publica mapas de ciudad, SmartRegion e información geográfica municipal.
- URLs:
  - https://www.castelldefels.org/es/ciudad/mapas-de-la-ciudad
  - https://www.castelldefels.org/es/servicios/urbanismo/planeamiento-y-gestion-urbanistica/planteamiento-vigente/informacion-geografica
- No se ha encontrado en esta ronda una capa pública inequívoca de límites de barrios.

### Gavà — PRIORIDAD ALTA
- El Ayuntamiento trabaja institucionalmente con el concepto de barrios y calidad de barrios, pero la búsqueda no ha localizado una capa pública de división completa por barrios.
- No se promocionan los 5 candidatos AMB como barrios municipales sin validación.

### Ripollet — PRIORIDAD MEDIA-ALTA
- Hay regidories/associacions veïnals y cartografía municipal, pero los mapas localizados corresponden a polígonos industriales, zonas escolares o ámbitos concretos del Pla de Barris, no a una división completa de barrios.
- URL: https://www.ripollet.cat/ciutat/el-municipi
- Estado: seguir buscando; no reutilizar zonas escolares/industriales como barrios.

### Barberà del Vallès — PRIORIDAD MEDIA-ALTA
- AMB devuelve 7 ámbitos candidatos, pero en esta ronda no se ha localizado una capa municipal pública inequívoca de barrios.
- Mantener AMB como candidato hasta encontrar fuente municipal o una definición territorial homologable.

### Badia del Vallès — PRIORIDAD BAJA PARA SUBDIVISIÓN
- Municipio muy compacto; AMB devuelve un único ámbito candidato.
- No se ha localizado necesidad/fuente de una división municipal de barrios equivalente a las grandes ciudades.

### Sant Feliu de Llobregat — YA CUBIERTO EN EL RADAR
- No confundir con Sant Feliu de Guíxols.
- El Radar ya dispone de capa municipal local; por eso no forma parte de los pendientes de extracción.

## Resumen operativo V33

- **Vector municipal activo/ya conseguido:** Barcelona, Girona, Sabadell, Terrassa, Badalona, L'Hospitalet, Sant Feliu de Llobregat, Tarragona (nuevo intento V33), Vilanova i la Geltrú, Lleida, Mataró, Reus, Granollers, Viladecans, Sant Cugat y Valldoreix; Lloret se mantiene como zonas estadísticas, no barrios.
- **Mapa/delimitación municipal demostrada, vector pendiente:** Rubí, Santa Coloma de Gramenet, Sant Andreu de la Barca, Mollet del Vallès, Vic, Manresa, Cornellà, Sant Joan Despí, Sant Boi, Montcada i Reixac, Santa Perpètua, Esplugues, Figueres, Blanes, Palafrugell, Olot y El Vendrell.
- **Cartografía o estructura vecinal, pero límite completo aún no demostrado:** Vilafranca del Penedès, Igualada, Salt, El Prat, Castelldefels, Gavà, Ripollet y Barberà.
- **No fabricar:** Cerdanyola (delimitación oficial en proceso) y Sant Feliu de Guíxols (propuesta histórica localizada, no GIS administrativo vigente).
