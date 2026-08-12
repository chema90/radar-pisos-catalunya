# Cambios v9

- Eliminado `NODE_TLS_REJECT_UNAUTHORIZED=0`. Las conexiones Node usan `--use-system-ca` en los comandos de actualización.
- Tarragona deja de autoimportarse como si fuera cobertura completa. Conserva sus polígonos municipales válidos, muestra cobertura parcial y mantiene ICGC como capa principal.
- Los avisos de atributos vacíos se agrupan en un resumen en lugar de imprimir uno por polígono.
- Añadido adaptador genérico `ckan-wkt` para APIs CKAN/OData y CSV con geometría WKT.
- Las URLs de recursos `seu-e.cat` se reconocen desde la propia aplicación y se transforman a la API OData correspondiente.
- Añadido parser WKT para POLYGON/MULTIPOLYGON y parser CSV delimitado.
- Integrados 13 barrios oficiales de l'Hospitalet de Llobregat desde la fuente municipal de Divisions territorials.
- El importador CKAN usa API -> CSV descargable -> copia local como cadena de respaldo.
- Añadido proxy Vite para la API de l'Hospitalet durante el uso local.
