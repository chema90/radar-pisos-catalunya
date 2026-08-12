import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const baseUrl = 'https://sabarca.cat/assets_sabarca/js/leaflet1.9.3/';
const sourcePage = 'https://sabarca.cat/regidories-de-barri';
const layers = [
  ['mapa-casc-antic.js', 'casc_antic', 'Nucli Antic'],
  ['mapa-barri-la-colonia.js', 'la_colonia', 'La Colònia'],
  ['mapa-barri-la-plana.js', 'la_plana', 'La Plana'],
  ['mapa-barri-el-palau.js', 'el_palau', 'El Palau'],
  ['mapa-barri-la-solana.js', 'la_solana', 'La Solana'],
  ['mapa-barri-la-unio.js', 'la_unio', "Pla de l'Estació"],
  ['mapa-centre.js', 'centre', 'El Centre'],
  ['mapa-barri-can-prats.js', 'can_prats', 'Can Prats'],
];

function extractObject(script, variable) {
  const match = new RegExp(`\\bvar\\s+${variable}\\s*=`).exec(script);
  if (!match) throw new Error(`No se ha localizado la capa ${variable}.`);
  const start = script.indexOf('{', match.index);
  if (start < 0) throw new Error(`La capa ${variable} no contiene GeoJSON.`);
  let depth = 0, quote = '', escaped = false;
  for (let index = start; index < script.length; index += 1) {
    const character = script[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(script.slice(start, index + 1));
    }
  }
  throw new Error(`El GeoJSON de ${variable} está incompleto.`);
}

function polygonFeature(collection, name) {
  const feature = collection.features?.find(item => item?.geometry?.type === 'Polygon' || item?.geometry?.type === 'MultiPolygon');
  if (!feature) throw new Error(`${name}: la fuente municipal no contiene un polígono.`);
  const slug = name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { type: 'Feature', id: `081960--barri--${slug}`, properties: { name, officialName: name, municipality: 'Sant Andreu de la Barca', kind: 'barri', quality: 'official', sourceCategory: 'Divisió municipal de barris' }, geometry: feature.geometry };
}

const features = [];
for (const [file, variable, name] of layers) {
  const response = await fetch(baseUrl + file);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} al descargar la fuente municipal.`);
  features.push(polygonFeature(extractObject(await response.text(), variable), name));
}
if (features.length !== 8 || new Set(features.map(feature => feature.properties.name)).size !== 8) throw new Error('La división municipal de Sant Andreu debe contener exactamente ocho barrios distintos. No se escribe nada.');

const output = resolve(root, 'public/data/municipality-zones/sant-andreu-de-la-barca.geojson');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ type: 'FeatureCollection', municipality: 'Sant Andreu de la Barca', source: { organization: 'Ajuntament de Sant Andreu de la Barca', title: 'Mapa de divisió dels actuals barris', url: sourcePage, official: true, accessedAt: new Date().toISOString().slice(0, 10) }, features }));
console.log(`Sant Andreu de la Barca: ${features.length} barrios municipales oficiales escritos.`);
