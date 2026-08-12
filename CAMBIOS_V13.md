# Cambios v13

- Añadidos dos accesos externos mínimos por zona: `M` abre Google Maps y `E` abre Google Earth.
- Con geometría disponible, los enlaces usan el centro aproximado del polígono. Sin geometría, buscan por nombre + municipio + Catalunya.
- Los accesos externos no modifican selección ni zoom del Radar.
- Sabadell exige ahora 40 barrios para considerar completa la capa WFS oficial. Los 40 nombres oficiales se incluyen además en `known-zones.json`, así que si el servidor está caído siguen apareciendo como nombres pendientes y pueden abrirse en Maps/Earth.
- Al arrancar y al refrescar, el proyecto intenta recuperar una capa municipal válida de Sabadell de versiones anteriores guardadas junto a la carpeta actual. Una caída temporal del WFS no elimina la copia local.
- Tiana: añadidos `la Virreina`, `Mas Ram` y `Nucli antic` como nombres municipales conocidos. `la Virreina` y `Mas Ram` enlazan con las áreas de poblamiento ICGC existentes; no se inventa una división administrativa municipal completa.
- El Masnou: añadidos como nombres municipales conocidos `Bellresguard`, `Ocata`, `Masnou Alt`, `La Colomina` y `Masnou Centre`. Permanecen como nombres pendientes de polígono mientras no exista una capa vectorial oficial de límites confirmada.
- Se mantienen intactas las 947 geometrías municipales de catálogo y las 8.271 áreas ICGC, incluidas 2.062 industriales.
