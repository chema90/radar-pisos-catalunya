# Radar de pisos Catalunya · v37

## Rubí

- Se incorporan **9 polígonos municipales oficiales** procedentes de la capa GIS `divisions.barris_alcaldessa_als_barris_2023`.
- Son ámbitos de atención municipal que agrupan los 23 barrios/ámbitos publicados por el Ayuntamiento. Por ello se presentan como **Ámbitos municipales de barrios**, no como 23 barrios con límites individuales.
- Se reproyectan de ETRS89 / UTM 31N a WGS84 y se validan los nueve grupos antes de escribir la capa.
- `01_ACTUALIZAR_DATOS.cmd` vuelve a comprobar y actualizar la fuente oficial de Rubí, exigiendo exactamente 9 ámbitos.

## Auditoría repetida

Se han revisado de nuevo Mollet del Vallès, Manresa, Vic, Montcada i Reixac y Santa Perpètua de Mogoda. A fecha de esta versión sus fuentes municipales/SITMUN permiten confirmar nombres, planos o visores, pero no han expuesto una capa vectorial de límites de barrio que se pueda validar sin aproximaciones. Sus nombres se mantienen pendientes de polígono.

## Garantías

- No se ha modificado Sant Cugat ni Valldoreix.
- No se activan capas AMB, secciones censales, núcleos ni urbanizaciones como sustituto de barrios municipales.
