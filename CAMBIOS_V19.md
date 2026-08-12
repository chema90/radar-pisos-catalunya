# Cambios v19

- Corrige el empaquetado defectuoso de v18: ya no se distribuye `node_modules` dentro del ZIP.
- Los tres `.cmd` verifican archivos reales de las dependencias, no solo la existencia de la carpeta `node_modules`.
- Si faltan dependencias, se elimina exclusivamente `node_modules` y se reconstruye con `npm ci` desde `package-lock.json`.
- Se comprueba que Node.js sea compatible con Vite 7 (Node 20.19+ o Node 22.12+).
- No se modifican datos geográficos, preferencias del usuario ni reglas AMB/Sant Cugat/Valldoreix respecto de v18.
