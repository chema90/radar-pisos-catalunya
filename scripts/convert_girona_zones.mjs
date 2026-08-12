import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import shp from 'shpjs';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'public/data/municipality-zones/girona.geojson');
const rawFiles = {
  barris: resolve(root, 'data/raw/girona-barris.zip'),
  sectors: resolve(root, 'data/raw/girona-sectors.zip'),
};

const slug = value => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

async function readCollection(path) {
  const parsed = await shp(await readFile(path));
  return Array.isArray(parsed)
    ? { type: 'FeatureCollection', features: parsed.flatMap(item => item.features) }
    : parsed;
}

const [barris, sectors] = await Promise.all([readCollection(rawFiles.barris), readCollection(rawFiles.sectors)]);
const municipality = 'Girona';
const features = [
  ...barris.features.flatMap(feature => {
    const properties = feature.properties ?? {};
    const name = String(properties.BARRIS ?? '').trim();
    if (!name || !feature.geometry) return [];
    return [{
      type: 'Feature',
      id: `170792--barri--${slug(name)}`,
      properties: {
        name,
        officialName: String(properties.NOM_COMPLE ?? name).trim(),
        municipality,
        kind: 'barri',
        quality: 'official',
        code: String(properties.OBJECTID ?? ''),
      },
      geometry: feature.geometry,
    }];
  }),
  ...sectors.features.flatMap(feature => {
    const properties = feature.properties ?? {};
    const name = String(properties.SECTORS ?? '').trim();
    const parentName = String(properties.BARRIS ?? '').trim();
    if (!name || !feature.geometry) return [];
    return [{
      type: 'Feature',
      id: `170792--sector--${slug(name)}`,
      properties: {
        name,
        officialName: String(properties.NOM_COMPLE ?? name).trim(),
        municipality,
        kind: 'sector',
        quality: 'official',
        ...(parentName ? { parentName } : {}),
        code: String(properties.OBJECTID ?? ''),
      },
      geometry: feature.geometry,
    }];
  }),
];

const collection = {
  type: 'FeatureCollection',
  municipality,
  source: {
    organization: 'Ajuntament de Girona · UMAT',
    title: 'Barris i sectors de Girona',
    official: true,
    accessedAt: '2026-08-04',
  },
  features,
};

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(collection)}\n`, 'utf8');
console.log(`Escritos ${barris.features.length} barrios y ${sectors.features.length} sectores en ${target}`);
