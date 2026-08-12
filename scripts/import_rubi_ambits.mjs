import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import proj4 from 'proj4';

const root = resolve(import.meta.dirname, '..');
const sourceUrl = 'https://gis.rubi.cat/geoservei/getGeoJSON.php?capa=divisions.barris_alcaldessa_als_barris_2023';
const sourcePage = 'https://gis.rubi.cat/alcaldessa_als_barris/';
const expectedGroups = [
  'Ca N’Oriol;Can Rosés',
  'El Mercat;Plana Can Bertran;Sector Z',
  'Castellnou - Can Mir;Can Solà;Can Barceló - Vallespark;Sant Muç',
  'Can Fatjó;Sant Jordi Park;Can Serrafosà - La Perla;Can Ximelis;Els Avets',
  'Centre;Plana del Castell',
  'El Pinar;Zona Nord - La Serreta',
  '25 de Setembre',
  'Progrés - Rubí 2000',
  "Les Torres;Ca n'Alzamora;Can Vallhonrat",
];

proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');

function transformCoordinates(value) {
  if (!Array.isArray(value)) throw new Error('Coordenadas inválidas en la fuente municipal de Rubí.');
  if (typeof value[0] === 'number') {
    if (Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90) return [value[0], value[1]];
    const [longitude, latitude] = proj4('EPSG:25831', 'EPSG:4326', value);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error('No se ha podido reproyectar una geometría de Rubí.');
    return [longitude, latitude];
  }
  return value.map(transformCoordinates);
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function displayName(properties) {
  const district = String(properties.codi_districte ?? '').trim();
  const names = String(properties.barris ?? '').split(';').map(item => item.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (!district || !names.length) throw new Error('Falta el distrito o la relación de barrios en una geometría de Rubí.');
  return { district, names, name: `Ámbito ${district} · ${names.join(' + ')}` };
}

const response = await fetch(sourceUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!response.ok) throw new Error(`Rubí: HTTP ${response.status} al descargar la fuente municipal.`);
const payload = await response.json();
if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw new Error('Rubí: la fuente no devuelve una colección GeoJSON válida.');

const features = payload.features.map(feature => {
  if (!['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)) throw new Error('Rubí: la fuente contiene una geometría no poligonal.');
  const { district, names, name } = displayName(feature.properties ?? {});
  return {
    type: 'Feature',
    id: `081846--ambit-barris--${slug(district)}-${slug(names.join('-'))}`,
    properties: {
      name,
      officialName: names.join(' · '),
      municipality: 'Rubí',
      kind: 'zone',
      quality: 'official',
      sourceCategory: 'Àmbit municipal de barris',
      district,
      groupedNeighbourhoods: names,
    },
    geometry: { type: feature.geometry.type, coordinates: transformCoordinates(feature.geometry.coordinates) },
  };
});

const actualGroups = features.map(feature => feature.properties.groupedNeighbourhoods.join(';'));
if (features.length !== expectedGroups.length || expectedGroups.some(group => !actualGroups.includes(group))) {
  throw new Error('Rubí: la división municipal debe contener exactamente los nueve ámbitos actuales. No se escribe nada.');
}

const output = resolve(root, 'public/data/municipality-zones/rubi.geojson');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  type: 'FeatureCollection',
  municipality: 'Rubí',
  source: {
    organization: 'Ajuntament de Rubí',
    title: 'Alcaldessa als barris · àmbits municipals',
    url: sourcePage,
    official: true,
    accessedAt: new Date().toISOString().slice(0, 10),
  },
  features,
}));
console.log(`Rubí: ${features.length} ámbitos municipales de barrios escritos.`);
