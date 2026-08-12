# Cambios V35

- Corregida la validación de archivos KML: funciona tanto en el navegador como en el entorno de comprobaciones automáticas.
- La búsqueda identifica una calle con número de portal como dirección antes de usar coincidencias por nombre. Así, `Berguedà, 3` no se confunde con una zona homónima.
- Conservado el criterio de búsqueda: primero se intenta dentro del municipio abierto y, si no aparece, en toda Catalunya. En El Vendrell, `Berguedà, 3` sitúa el punto rojo allí y conserva los enlaces Google Maps y Google Earth.
- Actualizadas las fuentes municipales sin sustituir capas consolidadas. Tarragona conserva sus 11 zonas municipales; los 20 polígonos sin nombre de la fuente de barrios siguen rechazados.
- DIBA queda únicamente como referencia de núcleos y urbanizaciones. AMB se conserva solo como candidato, sin activación automática.
- No se han modificado los GeoJSON protegidos de Sant Cugat ni Valldoreix.
