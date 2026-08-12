import type { Municipality, ZoneCollection } from './types';
import { normalizeImportedCollection, slug } from './zone-data';

const AMB_LAYER_URL = 'https://geoportal.amb.cat/geoserveis/rest/services/PEstrategica/mascara_ambits_estadistics_3857/MapServer/1';
const AMB_MUNICIPALITY_IDS = new Set([
  '080155','089045','082520','080193','080207','080543','080569','082665','080689','080728','080734','081580',
  '081691','080771','080898','081017','089058','081234','081252','081265','081574','081803','081944','081960',
  '082009','082042','082055','082114','082172','082212','082634','082444','082457','082824','082896','083015',
]);
const AMB_RUNTIME_BLOCKED_IDS = new Set(['082055']);

export const ambAemSource = {
  title: 'AMB · Àmbits Estadístics Metropolitans',
  organization: 'Àrea Metropolitana de Barcelona',
  url: AMB_LAYER_URL,
  note: 'Fuente poligonal metropolitana validada con los ayuntamientos. En muchos municipios coincide con barrios; en otros representa ámbitos estadísticos, por lo que actúa como respaldo y no sustituye una capa municipal oficial completa.',
};

export function isAmbMunicipality(municipality: Municipality): boolean {
  return AMB_MUNICIPALITY_IDS.has(municipality.id);
}

function ambQueryUrl(municipality: Municipality): string {
  const url = new URL(`${AMB_LAYER_URL}/query`);
  url.search = new URLSearchParams({
    where: `codi_ine='${municipality.id.slice(0, 5)}'`,
    outFields: 'cod_barri,nom,codi_ine,nommuni,pob_23,area_ha',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  }).toString();
  return url.toString();
}

function markAmbCollection(collection: ZoneCollection, municipality: Municipality): ZoneCollection {
  return {
    ...collection,
    source: {
      organization: ambAemSource.organization,
      title: ambAemSource.title,
      official: true,
      accessedAt: new Date().toISOString().slice(0, 10),
    },
    features: collection.features.map(feature => ({
      ...feature,
      id: `${municipality.id}--amb-aem--${slug(feature.properties.name)}`,
      properties: {
        ...feature.properties,
        kind: 'zone',
        quality: 'official',
        sourceCategory: 'amb-aem',
      },
    })),
  };
}

async function loadBundledAmbZones(municipality: Municipality): Promise<ZoneCollection | undefined> {
  const suffix = import.meta.env.DEV ? `?refresh=${Date.now()}` : '';
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/amb-aem/${slug(municipality.name)}.geojson${suffix}`, {
      cache: import.meta.env.DEV ? 'no-store' : 'default',
    });
    if (!response.ok) return undefined;
    return await response.json() as ZoneCollection;
  } catch {
    return undefined;
  }
}

export async function loadAmbZones(municipality: Municipality, allowRemote = true): Promise<ZoneCollection | undefined> {
  if (!isAmbMunicipality(municipality) || AMB_RUNTIME_BLOCKED_IDS.has(municipality.id)) return undefined;
  const bundled = await loadBundledAmbZones(municipality);
  if (bundled?.features.length) return bundled;
  if (!allowRemote) return undefined;
  try {
    const response = await fetch(ambQueryUrl(municipality), { headers: { Accept: 'application/geo+json,application/json' } });
    if (!response.ok) return undefined;
    const raw = await response.json() as GeoJSON.GeoJSON;
    const collection = markAmbCollection(normalizeImportedCollection(raw, municipality), municipality);
    return collection.features.length ? collection : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchAmbZonesNow(municipality: Municipality): Promise<ZoneCollection> {
  if (!isAmbMunicipality(municipality)) throw new Error('Este municipio no pertenece al ámbito metropolitano de Barcelona.');
  if (AMB_RUNTIME_BLOCKED_IDS.has(municipality.id)) throw new Error('Sant Cugat tiene una capa municipal específica de barrios. AMB está bloqueado aquí para evitar mostrar ámbitos estadísticos como si fueran barrios.');
  const response = await fetch(ambQueryUrl(municipality), { headers: { Accept: 'application/geo+json,application/json' } });
  if (!response.ok) throw new Error(`AMB respondió con HTTP ${response.status}.`);
  const raw = await response.json() as GeoJSON.GeoJSON;
  const collection = markAmbCollection(normalizeImportedCollection(raw, municipality), municipality);
  if (!collection.features.length) throw new Error('AMB respondió, pero no devolvió ámbitos estadísticos para este municipio.');
  return collection;
}
