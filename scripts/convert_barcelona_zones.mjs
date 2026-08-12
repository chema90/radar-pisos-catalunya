import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'data', 'raw', 'barcelona-barris.json');
const targetPath = path.join(root, 'public', 'data', 'municipality-zones', 'barcelona.geojson');
const rows = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function unwrap(value) {
  const text = value.trim();
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1).trim() : text;
}

function ring(value) {
  return unwrap(value).split(',').map(pair => pair.trim().split(/\s+/).map(Number));
}

function polygon(value) {
  return splitTopLevel(unwrap(value)).map(ring);
}

function parseWkt(value) {
  if (value.startsWith('POLYGON')) return { type: 'Polygon', coordinates: polygon(value.slice(7)) };
  if (value.startsWith('MULTIPOLYGON')) return { type: 'MultiPolygon', coordinates: splitTopLevel(unwrap(value.slice(12))).map(polygon) };
  throw new Error(`Unsupported WKT geometry: ${value.slice(0, 20)}`);
}

const features = rows.map(row => ({
  type: 'Feature',
  id: `080193--${String(row.codi_barri).padStart(2, '0')}`,
  properties: {
    name: row.nom_barri,
    officialName: row.nom_barri,
    municipality: 'Barcelona',
    kind: 'barri',
    quality: 'official',
    district: row.nom_districte,
    code: String(row.codi_barri).padStart(2, '0'),
  },
  geometry: parseWkt(row.geometria_wgs84),
}));

const collection = {
  type: 'FeatureCollection',
  municipality: 'Barcelona',
  source: {
    organization: 'Ajuntament de Barcelona - Open Data BCN',
    title: 'Unitats administratives de la ciutat de Barcelona: barris',
    official: true,
    accessedAt: '2026-08-02',
  },
  features,
};

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(collection)}\n`);
console.log(`Generated ${features.length} Barcelona neighbourhoods -> ${targetPath}`);