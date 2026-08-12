# Cambios v21

- Corregido el fallo de Windows `No se encuentra la etiqueta por lotes especificada: preparar_entorno`.
- Los tres `.cmd` ya no usan subrutinas internas `call :etiqueta` ni `goto :etiqueta`.
- Los tres `.cmd` se guardan explícitamente como ASCII con finales de línea Windows CRLF.
- Si `npm ci` falla, se elimina únicamente el `node_modules` incompleto. No se tocan datos ni preferencias.
- `package.json` y `package-lock.json` declaran el mismo rango de Node que usa el comprobador de entorno.
- No hay cambios de geodata respecto a v20.
