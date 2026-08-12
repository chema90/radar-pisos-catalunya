# v43 - Dirección GPS, alta inmediata y códigos postales

- Los paneles de añadir vivienda y crear desglose se muestran por encima del control de zoom de Leaflet.
- La geolocalización consulta la dirección postal aproximada del punto GPS mediante Nominatim.
- El bocadillo indica calle, portal y código postal cuando están disponibles, junto con la precisión real del GPS.
- `Añadir piso aquí` abre el formulario completo con dirección, coordenadas y zona ya preparadas; todos los datos siguen siendo editables.
- Si se corrige la dirección, la aplicación vuelve a geocodificarla; si no puede, conserva como respaldo las coordenadas GPS originales.
- Los códigos postales de cinco cifras se resuelven al municipio y nunca se interpretan como una dirección puntual.
