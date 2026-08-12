# Cambios v17

- AMB pasa a flujo seguro candidato -> informe -> aplicación manual.
- Ningún refresco AMB escribe en `municipality-zones`.
- Se añade backup automático al promover una versión AMB sobre otra existente.
- Se añade `npm run audit:amb` para revisar los 36 municipios.
- Los AEM se etiquetan como ámbitos estadísticos AMB, no como barrios municipales.
- Se corrige el texto de cobertura cuando AMB es el respaldo activo.
- `REFRESCAR_BARRIOS_OFICIALES.cmd` ya no lanza AMB de forma implícita después de terminar.
- Se crea `REFRESCAR_AMB.cmd` independiente y no destructivo.
