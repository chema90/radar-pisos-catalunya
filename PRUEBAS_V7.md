# Pruebas rápidas v7

## 1. Barcelona · nombres/alias
- Buscar `Camp d'en Grassot i Gracia Nova` → debe seleccionar `el Camp d'en Grassot i Gràcia Nova`.
- Buscar `Antiga Esquerra de l'Eixample` → debe seleccionar `l'Antiga Esquerra de l'Eixample`.
- Buscar `Sant Andreu de Palomar` → debe seleccionar el barrio oficial `Sant Andreu`.

## 2. Sabadell · fuente oficial WFS
Al seleccionar Sabadell, la aplicación muestra primero ICGC y, si la capa municipal no está empaquetada, intenta cargar el WFS oficial. Deben quedar disponibles como barrios municipales cuando el servicio responda:
- El Centre
- Covadonga
- La Creu Alta
- Gràcia

`Eix Macià` es una preferencia útil para vivienda, pero no se fuerza como barrio: si no existe un polígono inequívoco en las capas disponibles quedará en `nombres pendientes de polígono`.

## 3. Terrassa · fuente oficial ArcGIS
Deben quedar disponibles como barrios municipales:
- Centre
- Ca n'Aurell
- Vallparadís
- Antic Poble de Sant Pere

`Escola Industrial` debe poder enlazarse de forma conservadora con el nombre municipal compuesto `Plaça Catalunya-Escola Industrial` si esa es la geometría devuelta por la fuente.

## 4. Visibilidad real
- Pulsar `Ocultar todos` → los polígonos de las zonas deben desaparecer por completo, no quedar en gris tenue.
- Apagar `Barrios`, `Sectores`, `Otras zonas`, `Áreas ICGC` e `Industria ICGC` → no debe quedar ninguna zona territorial en la lista.
- `Límite municipal` es ahora un interruptor independiente. Si también se apaga, no debe quedar ningún contorno territorial (los marcadores de pisos guardados son independientes).

## 5. Identificación de capas
Cada fila visible debe indicar explícitamente una de estas procedencias:
- Barrios municipales
- Sectores municipales
- Otras zonas municipales/importadas
- Referencias
- Áreas de poblamiento ICGC
- Industria ICGC

Los nombres de tus listas que no tengan geometría no se mezclan con esas filas: aparecen únicamente en un bloque plegado `nombres pendientes de polígono`.
