import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'public/data/municipality-zones/girona-reference.geojson');
const endpoint = 'https://nominatim.openstreetmap.org/search';
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));

async function search(query, limit = 1) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: 'geojson', polygon_geojson: '1', limit: String(limit), q: `${query}, Girona` }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'Radar de pisos Catalunya/0.1 (local data refresh)', Accept: 'application/geo+json' } });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status} al buscar ${query}.`);
  return response.json();
}

const [migdiaResult, devesaResult] = [await search('Parc del Migdia'), await pause(1100).then(() => search('la Devesa'))];
await pause(1100);
const pericotResult = await search('Pericot', 10);
const pickPolygon = (result, name) => result.features.find(feature => feature.geometry?.type === 'Polygon' && feature.properties?.name?.toLowerCase() === name.toLowerCase());
const migdia = pickPolygon(migdiaResult, 'Parc del Migdia');
const devesa = pickPolygon(devesaResult, 'la Devesa');
const pericotLines = pericotResult.features
  .filter(feature => feature.geometry?.type === 'LineString' && feature.properties?.name === 'Avinguda de Lluís Pericot')
  .map(feature => feature.geometry.coordinates);
if (!migdia || !devesa || !pericotLines.length) throw new Error('No se pudieron localizar las referencias de Migdia, Devesa y Pericot en OpenStreetMap.');

const collection = {
  type: 'FeatureCollection',
  municipality: 'Girona',
  source: {
    organization: 'OpenStreetMap contributors',
    title: 'Áreas de referencia de Girona',
    official: false,
    accessedAt: '2026-08-04',
  },
  features: [
    {
      type: 'Feature', id: '170792--reference--migdia',
      properties: { name: 'Migdia', officialName: 'Parc del Migdia', municipality: 'Girona', kind: 'zone', quality: 'community', reference: 'area' },
      geometry: migdia.geometry,
    },
    {
      type: 'Feature', id: '170792--reference--devesa',
      properties: { name: 'Devesa', officialName: 'la Devesa', municipality: 'Girona', kind: 'zone', quality: 'community', reference: 'area' },
      geometry: devesa.geometry,
    },
    {
      type: 'Feature', id: '170792--reference--pericot',
      properties: { name: 'Pericot', officialName: 'Avinguda de Lluís Pericot', municipality: 'Girona', kind: 'zone', quality: 'community', reference: 'axis' },
      geometry: { type: 'MultiLineString', coordinates: pericotLines },
    },
  ],
};

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(collection)}\n`, 'utf8');
console.log(`Escritas ${collection.features.length} referencias de Girona en ${target}`);
