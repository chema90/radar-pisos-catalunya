# Política de selección de fuentes territoriales

El Radar no decide que una fuente es "buena" por el nombre del proveedor ni por una puntuación opaca. La selección sigue una jerarquía y controles comprobables.

## Prioridad

1. Fuente municipal oficial de barrios/zonas, cuando pasa la validación configurada.
2. AMB · Àmbits Estadístics Metropolitans (AEM), solo en los 36 municipios metropolitanos y solo si la capa municipal falta o es insuficiente.
3. ICGC y otras capas de referencia.
4. Importaciones comunitarias o manuales, identificadas como tales.

## Seguridad

- AMB vive en una carpeta separada y nunca escribe en `public/data/municipality-zones/`.
- `npm run zones:amb` solo prepara candidatos en `public/data/amb-aem-candidates/`.
- Antes de aplicar se genera un informe en `data/reports/`.
- `npm run zones:amb:apply` es una acción separada y consciente. Si ya había un AMB activo, crea una copia en `data/backups/amb-aem/` antes de sustituirlo.
- Un fallo de red no borra datos locales.

## Cuándo se considera válida una fuente municipal

- Debe contener geometrías Polygon o MultiPolygon.
- Debe contener nombres reconocibles de barrios/zonas.
- Si se conoce un mínimo esperado de entidades, debe alcanzarlo.
- Para fuentes configuradas, los polígonos deben quedar dentro de la envolvente municipal con el margen previsto.
- Cuando existen nombres ancla o un número exacto esperado, también deben coincidir.
- Un fallo temporal de red no invalida una copia local previamente validada.

## Papel de AMB

AMB es una segunda fuente oficial/metropolitana. Sus AEM están acordados con los municipios, pero no se presentan como equivalentes jurídicos a "barrio" en todos los casos. Por eso AMB no pisa una capa municipal oficial completa. Cada entidad AMB queda marcada internamente con `sourceCategory: amb-aem` y en pantalla se identifica como "Ámbito estadístico AMB".
