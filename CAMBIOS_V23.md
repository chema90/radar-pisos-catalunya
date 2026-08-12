# Cambios v23

Base: v22.

Correcciones derivadas de la ejecución real del 01_ACTUALIZAR_DATOS.cmd del 9/08/2026:

- Lleida: la capa municipal `Barris_Lleida` puede contener varias piezas con el mismo nombre. Se unen de forma segura en un MultiPolygon en vez de generar IDs duplicados. No se limita artificialmente a 12 barrios: se conservan todas las zonas únicas que publique la capa oficial y superen la validación.
- Mataró: la validación de nombres admite etiquetas oficiales compuestas (por ejemplo `Via Europa - La Llàntia` y `Peramàs-Esmandies`) y deja de exigir exactamente 11 polígonos. Sigue exigiendo una capa municipal poligonal, dentro del término y con nombres de control reconocibles.
- DIBA: la asignación espacial usa centroides, puntos medios y vértices representativos en lugar de exigir que el 35% de los vértices queden dentro del municipio. Se añaden diagnósticos de las primeras geometrías que no puedan asignarse. La salida continúa siendo exclusivamente `*-reference.geojson`.
- Sant Cugat: si el WFS publica la capa pero bloquea `GetFeature` con 401/403, se intenta una alternativa pública WMS/KML del mismo GeoServer y de la misma capa. Si tampoco devuelve polígonos vectoriales, no se escribe nada. AMB continúa bloqueado para Sant Cugat.
- Mensajes de cobertura: un fallo de validación ya no se describe erróneamente como «el servidor no respondió».

No se activa AMB, no se cambian preferencias y no se incorporan geodatos de prueba.
