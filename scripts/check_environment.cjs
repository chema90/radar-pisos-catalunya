const fs = require('fs');
const path = require('path');

function nodeSupported() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  // El proyecto usa --use-system-ca para respetar el almacén de certificados de Windows.
  // Node lo soporta en Windows desde 22.15.0. Evitamos aceptar versiones que luego
  // fallarían a mitad de una actualización de geodatos.
  if (major === 22) return minor >= 15;
  if (major === 23) return minor >= 8;
  return major >= 24;
}

if (!nodeSupported()) {
  console.error(`NODE_NO_COMPATIBLE: tienes Node.js ${process.versions.node}. Este proyecto necesita Node 22.15+ (recomendado: Node 22 LTS actualizado) para usar de forma segura los certificados de Windows.`);
  process.exit(10);
}

const required = [
  'node_modules/typescript/bin/tsc',
  'node_modules/vite/bin/vite.js',
  'node_modules/vitest/dist/index.d.ts',
  'node_modules/@tmcw/togeojson/dist/index.d.ts',
  'node_modules/@tmcw/togeojson/dist/togeojson.es.mjs',
  'node_modules/@ngageoint/geopackage/dist/index.d.ts',
  'node_modules/@ngageoint/geopackage/dist/index.js',
  'node_modules/@xmldom/xmldom/lib/index.js',
  'node_modules/leaflet/dist/leaflet.js'
];

const missing = required.filter(file => !fs.existsSync(path.join(process.cwd(), file)));
if (missing.length) {
  console.error('DEPENDENCIAS_INCOMPLETAS: faltan archivos necesarios.');
  for (const file of missing) console.error(` - ${file}`);
  process.exit(2);
}

console.log(`Entorno Node correcto (${process.versions.node}) y dependencias completas.`);
