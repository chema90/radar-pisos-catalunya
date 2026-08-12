# Búsqueda profunda de barrios · V34

Fecha: 10/08/2026

## Resultado nuevo de esta ronda

### Sant Joan Despí · evidencia municipal fuerte, vector pendiente
El Ayuntamiento define cinco barrios: Centre, Les Planes, Pla del Vent - Torreblanca, Residencial Sant Joan y Les Begudes. Además describe los límites mediante calles, ferrocarril, B-23 y términos municipales. Es una delimitación oficial suficientemente clara para registrar los nombres como `barrio conocido`, pero todavía no se ha localizado un endpoint WFS/ArcGIS/GeoJSON municipal para importar sus polígonos sin reconstruirlos a mano.
Fuente: https://sjdespi.cat/sant-joan-despi/els-barris

### Santa Perpètua de Mogoda · 8 barrios + SITMUN, vector pendiente
El Ayuntamiento declara que ocho barrios componen la estructura municipal. La documentación municipal actual permite identificar Centre Vila, Can Folguera, Can Taió, La Creueta, La Florida, Mas Costa, La Mogoda y Can Filuà. La guía de calles remite a la red SITMUN de Diputació. Se incorporan nombres, no polígonos inventados.
Fuentes:
- https://www.staperpetua.cat/el-municipi/
- https://www.staperpetua.cat/el-municipi/guia-de-carrers--planol

### Sant Andreu de la Barca · mapa de barrios y relación calle -> barrio
La página de Regidories de Barri contiene un mapa de división de barrios y una relación extensa de calles asignadas a cada barrio. Además enlaza al visor SITMUN municipal. Es un candidato prioritario para extracción del polígono original o para localizar la capa territorial usada por el mapa.
Fuente: https://sabarca.cat/regidories-de-barri

### Rubí · geometría demostrada detrás del visor
El Ayuntamiento mantiene el mapa `L'alcaldessa als barris`, donde una dirección o un clic sobre el mapa devuelve el distrito correspondiente. También publica 23 barrios/ámbitos vecinales por nombre. La geometría existe funcionalmente en el visor `gis.rubi.cat/ab/`; sigue pendiente identificar un endpoint vectorial reutilizable.
Fuentes:
- https://gis.rubi.cat/ab/
- https://www.rubi.cat/ca/temes/convivencia/barris/barris

### Santa Coloma de Gramenet · planos oficiales de barrios y distritos
La sección municipal de Cartografía permite consultar/imprimir divisiones territoriales de barrios, distritos y secciones censales. La existencia de los límites está confirmada, pero aún no se ha localizado el recurso vectorial original que genera esos planos.
Fuente: https://www.gramenet.cat/es/ayuntamiento/areas-municipales/planeamiento-urbanistico-informacion-urbanistica/cartografia/

### Cornellà de Llobregat · organización territorial oficial
El Ayuntamiento publica siete distritos territoriales asociados a Centre/Riera, Almeda, Pedró, Gavarra, Sant Ildefons y Fontsanta-Fatjó, y muestra un plano de barrios. Sigue pendiente localizar una capa vectorial municipal pública.
Fuente: https://www.cornella.cat/ca/viure-a-cornella/la-ciutat/dades-basiques

### SITMUN · hallazgo transversal
La IDE Local de Diputació expone geoservicios WMS estandarizados por municipio y confirma que Sant Andreu de la Barca, Santa Perpètua y muchos otros ayuntamientos operan dentro de la red SITMUN. Los servicios públicos catalogados incluyen topografía, calles/portales, planeamiento, POI y otros productos. No se ha encontrado todavía un WMS/WFS genérico de `barris`, por lo que el siguiente trabajo debe centrarse en la configuración específica de cada visor municipal y no en asumir que todas las capas SITMUN son barrios.
Fuente: https://sitmun.diba.cat/idelocals/

## Prioridad siguiente
1. Sant Andreu de la Barca: inspeccionar el mapa embebido y su configuración SITMUN.
2. Rubí: localizar llamadas internas de `gis.rubi.cat/ab/`.
3. Santa Coloma: localizar el recurso que genera los planos de barrios/distritos.
4. Sant Joan Despí: buscar GIS original; si no existe públicamente, mantener límites textuales sin dibujarlos.
5. Santa Perpètua: inspeccionar configuración SITMUN por municipio.
6. Mollet, Vic, Manresa, Esplugues, Montcada, Cornellà y Sant Boi: continuar extracción desde sus visores/geoportales.
