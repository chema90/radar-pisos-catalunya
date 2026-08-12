# Cambios v31

- Vilanova i la Geltrú: el fallback WMS/KML devuelve las geometrías en coordenadas de píxel del mapa renderizado (2048×2048), no en lon/lat ni UTM.
- Se añade conversión píxel -> bbox municipal WGS84 antes de validar.
- La conversión solo se activa para la fuente municipal de Vilanova y solo se conserva si supera la validación territorial.
- Lloret de Mar se mantiene como `zone` / zona estadística municipal, nunca como `barri`.
- Sin cambios en frontend, preferencias, AMB, DIBA, Sant Cugat ni Valldoreix.
