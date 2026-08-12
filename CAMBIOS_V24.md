# Cambios v24

- Lleida se mantiene tal como quedó resuelto en v23: la capa municipal `Barris_Lleida` produjo 81 zonas válidas tras unir fragmentos del mismo nombre.
- Mataró: corrección **fuente-específica** de los dos nombres que el SHP municipal entrega con caracteres de sustitución (`LA LL�NTIA`, `PERAM�S`). No se aplica ninguna corrección heurística a otras fuentes.
- Mataró: se normalizan los 11 nombres de la capa municipal a su grafía legible sin alterar geometrías.
- DIBA: se prioriza el recurso JSON oficial del Portal de Dades Obertes (`/node/790/download`) y se conserva la URL directa histórica como segundo intento.
- DIBA: una fuente solo se acepta si contiene geometrías **y** atributos identificadores (`Codi`/`Mapid`). Un SHP sin DBF utilizable ya no se procesa como si fuese una fuente válida.
- DIBA: si la fuente es válida pero no aporta polígonos a los municipios objetivo, se informa y no se trata como error del Radar.
- Sant Cugat: no se modifica todavía el catálogo de 49 nombres de la propuesta 2024. La web municipal actual de 2026 usa una relación distinta; se requiere revisión/decisión antes de borrar o sustituir nombres.
- AMB sigue sin activarse automáticamente.
