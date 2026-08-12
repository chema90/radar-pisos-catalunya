# Fuentes territoriales añadidas/revisadas en v15

## Con geometría automatizable

- **Lleida** — Ajuntament de Lleida / Paeria, ArcGIS `Ciutat · Barris`. Se importan polígonos y los campos `Codi` y `Nom`.
- **Mataró** — Ajuntament de Mataró, descarga cartográfica `Límit dels barris de Mataró` en SHP ETRS89.
- **Reus** — Ajuntament de Reus, GeoAPI REST. El elemento `barri` devuelve `num`, `nom` y `geom` poligonal/multipoligonal.
- **Lloret de Mar** — Ajuntament de Lloret de Mar, descarga `Barris-urbanitzacions` (`zones.zip`). Se etiqueta como `zone`, no como `barri`, porque la fuente mezcla ambos tipos.
- **Sant Cugat del Vallès** — Ajuntament de Sant Cugat, GeoServer municipal público. El importador consulta WFS y solo acepta una capa cuyo nombre/título corresponda a `Barris`, con geometría poligonal y cobertura suficiente.

## Nomenclatura documentada, sin polígono inventado

- **Santa Coloma de Gramenet** — 17 barrios de la división territorial municipal. El Ayuntamiento publica planos de barrios, pero en esta revisión no se ha confirmado una descarga vectorial directa de esa capa.
- **Cornellà de Llobregat** — Centre, Riera, Almeda, Pedró, Gavarra, Sant Ildefons y Fontsanta-Fatjó. El ROM define distritos y el Ayuntamiento usa estos barrios, pero no se ha confirmado una capa vectorial descargable de límites.
- **Sant Boi de Llobregat** — Centre, Marianao, Vinyets-Molí Vell, Camps Blancs, Casablanca y Molí Nou-Ciutat Cooperativa. Hay ArcGIS/Open Data municipal, pero en la revisión actual no apareció una capa pública específica de barrios.
- **Blanes** — ámbitos vecinales documentados por el Ayuntamiento. Se marcan como no oficiales administrativamente porque el directorio es de asociaciones/ámbitos vecinales, no una capa de barrios oficial.
- **Sant Feliu de Guíxols** — mapa histórico/didáctico municipal de barrios; se conserva como referencia no administrativa.
- **Sant Sadurní d'Anoia** — 7 barrios tradicionales ligados a la Festa dels Barris; ya estaban cargados.

## Sant Cugat: respaldo de nombres actualizado

Si el WFS no responde, el Radar ya no usa la antigua división operativa metropolitana de 2016 como si fuera actual. Usa la nomenclatura que actualmente aparece en los Consells de Barris del Ayuntamiento y los barrios publicados por la EMD de Valldoreix. La geometría solo se incorpora cuando procede de una capa vectorial validada.

## Capa metropolitana 2016

El Institut Metròpoli/AMB publica el estudio `Mapa de barris metropolitans i de les àrees estadístiques de referència` y ofrece sus capas en Shapefile (`16013-Capes.rar`). Es útil como referencia secundaria para municipios metropolitanos, pero es de 2016 y no sustituye una división municipal actual.
