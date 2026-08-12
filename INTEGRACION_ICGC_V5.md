# Integración territorial v5

Esta versión conserva el sistema existente y añade el GeoPackage ICGC de `Àrees de poblament` como cobertura general para toda Catalunya.

## Regla de prioridad

1. Si existe una capa municipal/local en `public/data/municipality-zones/<municipio>.geojson`, se usa como división principal.
2. Las áreas ICGC siguen disponibles como capa complementaria.
3. Si no existe una capa municipal, las áreas ICGC se activan por defecto y actúan como desglose territorial de respaldo.
4. Los sectores industriales ICGC nunca se eliminan; se muestran en una capa independiente que puede ocultarse visualmente.
5. Las referencias (`*-reference.geojson`) son una capa separada y nunca sustituyen a una división oficial.

## Capas

- Barrios oficiales.
- Sectores oficiales.
- Otras zonas municipales/importadas.
- Referencias.
- Áreas de poblamiento ICGC.
- Sectores industriales ICGC.

Cada capa se puede activar/desactivar sin modificar ni borrar los datos.

## Valoraciones

Cada zona puede marcarse como:

- TOP: verde.
- Interesante: azul.
- Normal: color base de su capa.
- Descartada: rojo.
- Industria: marrón cuando no tiene una valoración personal distinta.

Las valoraciones y notas continúan almacenándose en IndexedDB; no se escriben dentro de los GeoJSON oficiales.

## Correcciones incluidas

- Se elimina la lista rígida que solo cargaba Barcelona y Girona. Ahora cualquier archivo `<municipio>.geojson` con el nombre normalizado se detecta automáticamente. Esto hace que `tarragona.geojson` se cargue sin añadir código específico.
- Los municipios de `ZONAS_INTERES.md` agrupados bajo encabezados como `Girona y Costa Brava` se abren usando el nombre real del municipio (`Roses`, `Pals`, etc.) y no el nombre del grupo.
- La comparación de nombres municipales tolera artículos (`l'Hospitalet` / `Hospitalet`) y acentos.
- Los topónimos/listas conocidas se enlazan con un polígono visible si una zona ICGC con el mismo nombre existe.
- Cuando se muestra un municipio completo, las zonas visibles muestran sus nombres en el mapa; al seleccionar una zona concreta, se reduce el ruido visual.

## Comprobación

- `npm run check:data`
- `npm run check:icgc`
- `npx tsc -b` o `npm run build`

La cobertura ICGC incluida contiene 947 municipios y 8.271 polígonos: 6.209 áreas de poblamiento y 2.062 sectores industriales.
