# V18

- Solo quedan tres CMD de uso normal, numerados 01, 02 y 03.
- AMB se descarga solo como candidato; ningún CMD lo activa.
- Sant Cugat no utiliza AMB ni siquiera como descarga remota en la aplicación: se espera su capa municipal `Barris`.
- Valldoreix aparece como entidad propia de tipo EMD, vinculada a Sant Cugat pero separada en la lista y en sus barrios.
- Si la capa municipal de Sant Cugat incluye los 13 barrios de Valldoreix, se separan automáticamente hacia `valldoreix.geojson`.
- Si solo se reconoce una parte de Valldoreix, la importación se rechaza antes de escribir nada.
- Se aceptan variantes históricas de nombres del Ayuntamiento (`Can Casulleres`, `Montmany`) y se normalizan a la denominación actual de la EMD.
- La capa `Barris` de Sant Cugat puede ser válida aunque no incluya Valldoreix; se exigen al menos 40 polígonos y nombres de control.
- El importador prioriza una capa WFS cuyo título sea exactamente `Barris`, evitando seleccionar por error capas estadísticas que también contengan la palabra barris.
- Las escrituras municipales se hacen en dos fases, con temporales y copias de seguridad; ante un fallo se intenta restaurar el estado anterior.
- Los AEM se modelan como zonas estadísticas (`zone`), no como barrios (`barri`).
