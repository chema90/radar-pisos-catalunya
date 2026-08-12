# CAMBIOS V26 · BARRIOS Y NÚCLEOS PRIORITARIOS

Base: v25 local validada por el usuario en Windows (`02_COMPROBAR_RADAR.cmd` = TODO CORRECTO).

## Criterio territorial
- **Barrio municipal**: solo se activa como polígono local cuando una fuente municipal vectorial supera validación.
- **Núcleo/urbanización**: ICGC o DIBA, visible como referencia territorial, nunca renombrado automáticamente a barrio.
- **Barrio conocido, polígono pendiente**: nombre oficial documentado, sin límite inventado.

## Cambios
- Valldoreix: corregido el falso PENDIENTE del comprobador (`Can Casulleres` y `Montmany`, nombres nativos de la capa auditada). Geometría intacta.
- Vilanova i la Geltrú: incorporados 18 nombres municipales; nueva fuente `BARRIS` del WMS municipal. El actualizador intenta WFS y WMS/KML conservando el parámetro `map=cartografia`; si no obtiene vector, no escribe nada.
- Esplugues de Llobregat: actualizada la URL al geoportal Nexus actual; descubrimiento ampliado a WMS además de WFS/ArcGIS. Se exigen 10 barrios y geometría dentro del municipio.
- Sant Sadurní d'Anoia: se mantienen 7 barrios tradicionales oficiales como nombres; no se les asignan polígonos ICGC que representan otros núcleos.
- Vilafranca del Penedès: se mantienen 8 barrios oficiales; no se confunden con núcleos/urbanizaciones.
- DIBA: corregida lectura del SHP actual (`Urbanitzac`, `Urb_id`) y ampliada a Vilanova, Corbera y Esplugues además de Maresme, Vilafranca y Sant Sadurní. Siempre como referencia, nunca como barrios.
- Roda de Berà: `el Roc de Sant Gaietà` enlaza con su polígono ICGC y se clasifica como urbanización/núcleo.
- Altafulla: se incorporan los tres ámbitos municipales (centre, barri marítim, Brises del Mar) enlazando con ICGC mediante alias cuando procede.
- Corbera de Llobregat: se añaden `Corbera Baixa` y `Corbera Alta` (nucli històric) como núcleos oficiales conocidos. Los nombres largos del ICGC se conservan porque corresponden a urbanizaciones/topónimos reales; se añade alias `Can Montmany de Maspassoles`.
- Sant Feliu de Guíxols: se mantiene la propuesta de 9 barrios de los Tallers d’Història como referencia no oficial; no se fabrican polígonos.

## Seguridad
Ninguna geometría de Sant Cugat/Valldoreix se regenera ni se modifica en v26.
Las nuevas fuentes remotas son `allowUnavailable`: un fallo del servidor deja la capa existente intacta.
