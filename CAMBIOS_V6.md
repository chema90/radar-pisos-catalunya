# Cambios v6

- Corrige la asociación entre nombres de preferencias y barrios oficiales cuando solo difieren por artículo o acento. Ejemplos: `Camp d'en Grassot i Gracia Nova` → `el Camp d'en Grassot i Gràcia Nova`; `Antiga Esquerra de l'Eixample` → `l'Antiga Esquerra de l'Eixample`; `Font d'en Fargues` → `la Font d'en Fargues`; `Nova Esquerra...` → `la Nova Esquerra...`.
- La corrección se aplica de forma general mediante `zoneKey`, no con parches específicos para esos barrios.
- El clic sobre una zona ya no cambia el zoom. La selecciona, abre su ficha y centra el mapa conservando el nivel de zoom actual.
- El rombo `◇` de la derecha es ahora un botón real: centra y hace zoom a la geometría de esa zona.
- El botón municipal se renombra a `Municipio TOP` para dejar claro que marca el municipio completo y no sus barrios. Los municipios TOP se priorizan en los resultados de búsqueda.
- Se mantienen intactas las geometrías oficiales y todas las capas ICGC, incluida industria.
