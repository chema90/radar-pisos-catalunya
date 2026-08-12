# Cambios V32

## Buscador por dirección restaurado
- El buscador superior mantiene las coincidencias instantáneas locales de municipio/barrio/zona.
- Si al pulsar **Buscar** o **Enter** no hay coincidencia local, se activa geocodificación de dirección.
- Primero se busca dentro del municipio actualmente abierto.
- Si no se encuentra, se busca en Catalunya y el municipio se resuelve contra los polígonos del catálogo local (947 municipios + EMD incorporadas).
- Al encontrar una dirección, el Radar cambia al municipio correspondiente cuando hace falta, centra el mapa y marca el punto temporalmente.
- No hay excepciones específicas por calle o municipio.

## Nueva fuente municipal: Viladecans
- FeatureServer oficial `Població per Barris`.
- Capa poligonal con `barri` y `nom_barri`.
- Se incorpora al flujo seguro de `01_ACTUALIZAR_DATOS.cmd`; solo se escribe si supera las validaciones.

## Investigación cartográfica
- Nuevo informe `data/reports/BUSQUEDA_PROFUNDA_BARRIOS_V32.md` con fuentes y prioridades para municipios aún pendientes.
- Se distinguen fuentes vectoriales listas, mapas municipales que requieren extracción, cartografía sin límite GIS demostrado y casos donde no debe inventarse una división oficial.

## Protección
- No se modifican las geometrías auditadas de Sant Cugat ni Valldoreix.
- No se activa AMB automáticamente.
- DIBA sigue siendo referencia de núcleos/urbanizaciones, nunca sustituto automático de barrios municipales.
