# Modelo territorial

`Municipality` es la unidad universal: código ICGC, nombre oficial, comarca, provincia, capital, área y límite municipal. Puede existir sin cobertura interna.

`Zone` representa una división territorial o una preferencia. Sus clases no son intercambiables:

- distrito, barrio y sector: divisiones internas sujetas a la fuente municipal;
- núcleo y urbanización: entidades de población, no barrios por defecto;
- punto de referencia: lugar conocido que redirige al municipio, sin afirmar una división administrativa;
- alias: variante lingüística o de búsqueda de una entidad confirmada.

Cada geometría debe indicar fuente, fecha, oficialidad y calidad. La aplicación no convierte una etiqueta inmobiliaria ni una asociación vecinal en un barrio oficial. Las preferencias personales (`top`, favorita, descartada, visita y nota) viven separadas en IndexedDB.

## Estrategia multicapa

La interfaz puede superponer varias capas territoriales para un mismo municipio. `barri` y `sector` proceden prioritariamente de fuentes municipales verificadas. `icgcPopulation` e `icgcIndustrial` proceden de ICGC y son complementarias. `references` agrupa geometrías de referencia que no deben interpretarse como límites administrativos.

Las capas son visualmente activables/desactivables. Ocultar una capa no modifica el archivo fuente. La aplicación mantiene separadas geometría territorial, visibilidad y preferencias personales.
