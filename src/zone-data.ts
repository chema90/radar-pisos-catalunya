import { deleteCustomZones, getCustomZones, saveCustomZones } from './storage';
import type { Municipality, ZoneCollection, ZoneFeature, ZoneKind, ZoneProperties } from './types';
import { parseDelimitedText, recordsWithWktToGeoJson } from './wkt-import';

export const slug = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const nameFields = [
  'name', 'NAME', 'nom', 'NOM', 'nombre', 'NOMBRE',
  'nom_barri', 'NOM_BARRI', 'nom_barris', 'NOM_BARRIS',
  'barri', 'BARRI', 'barris', 'BARRIS', 'barrio', 'BARRIO',
  'nom_sector', 'NOM_SECTOR', 'nom_sectors', 'NOM_SECTORS', 'sector', 'SECTOR', 'sectors', 'SECTORS',
  'nom_zona', 'NOM_ZONA', 'zona', 'ZONA',
  'district', 'DISTRICT', 'districte', 'DISTRICTE',
  'descripcio', 'DESCRIPCIO', 'descripcion', 'DESCRIPCION',
  'denominacio', 'DENOMINACIO', 'label', 'LABEL',
];

const weakNameFields = /^(id|fid|gid|objectid|shape|area|perimet|length|codi|codigo|code|cod)$/i;
const usefulNameField = /name|nom|nombre|barri|barrio|barris|zona|sector|district|districte|descrip|denomin|label/i;

const canonicalZoneAliases: Record<string, string> = {
  'sant-andreu-de-palomar': 'sant-andreu',
};

export function zoneKey(name: string): string {
  const key = slug(name).replace(/^(el|la|l|els|les)-/, '');
  return canonicalZoneAliases[key] ?? key;
}

export function isGeneratedZoneName(name: string): boolean {
  return /^zona\s+\d+$/i.test(name.trim());
}

function cleanName(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const name = String(value).trim().replace(/\s+/g, ' ');
  if (!name || /^\d+$/.test(name) || isGeneratedZoneName(name)) return undefined;
  return name;
}

function importedName(properties: Record<string, unknown>): string | undefined {
  const kind = importedKind(properties);
  const named = kind === 'sector' ? namedValue(properties, /sector/i)
    : kind === 'zone' ? namedValue(properties, /zona/i)
      : kind === 'district' ? namedValue(properties, /district|districte/i)
        : namedValue(properties, /barri|barrio/i);
  if (named) return named;
  for (const field of nameFields) {
    const name = cleanName(properties[field]);
    if (name) return name;
  }
  const candidates = Object.entries(properties)
    .filter(([field]) => usefulNameField.test(field) && !weakNameFields.test(field))
    .map(([, value]) => cleanName(value))
    .filter((value): value is string => Boolean(value));
  if (candidates.length) return candidates.sort((first, second) => first.length - second.length)[0];
  return Object.entries(properties)
    .filter(([field]) => !weakNameFields.test(field))
    .map(([, value]) => cleanName(value))
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => first.length - second.length)[0];
}

function namedValue(properties: Record<string, unknown>, fieldPattern: RegExp): string | undefined {
  for (const [field, value] of Object.entries(properties)) {
    if (!fieldPattern.test(field)) continue;
    const name = cleanName(value);
    if (name) return name;
  }
  return undefined;
}

export async function loadZones(municipality: Municipality): Promise<ZoneCollection | undefined> {
  const custom = await getCustomZones(municipality.id);
  const bundled = slug(municipality.name);
  const suffix = import.meta.env.DEV ? `?refresh=${Date.now()}` : '';
  let official: ZoneCollection | undefined;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/municipality-zones/${bundled}.geojson${suffix}`, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
    if (response.ok) official = await response.json() as ZoneCollection;
  } catch {
    official = undefined;
  }
  const references = await loadReferenceZones(bundled);
  const base = official && references ? mergeCollections(official, references) : official ?? references;
  if (!base) return custom;
  return custom ? mergeCollections(base, custom) : base;
}

async function loadReferenceZones(bundled: string): Promise<ZoneCollection | undefined> {
  const suffix = import.meta.env.DEV ? `?refresh=${Date.now()}` : '';
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/municipality-zones/${bundled}-reference.geojson${suffix}`, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
    if (!response.ok) return undefined;
    const collection = await response.json() as ZoneCollection;
    collection.features = collection.features.map(feature => ({
      ...feature,
      properties: { ...feature.properties, layer: 'references' },
    }));
    return collection;
  } catch {
    return undefined;
  }
}

export function createUserFeature(municipality: Municipality, name: string, coordinates: number[][], kind: ZoneKind = 'barri'): ZoneFeature {
  return {
    type: 'Feature',
    id: `${municipality.id}--${kind}--${slug(name)}`,
    properties: { name, municipality: municipality.name, kind, quality: 'user-drawn' },
    geometry: { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] },
  };
}

export function normalizeImportedCollection(raw: GeoJSON.GeoJSON, municipality: Municipality): ZoneCollection {
  if (raw.type !== 'FeatureCollection') throw new Error('El archivo debe ser un FeatureCollection GeoJSON.');
  const byName = new Map<string, ZoneFeature>();
  raw.features.forEach(feature => {
    if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return;
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const name = importedName(properties);
    if (!name) return;
    const kind = importedKind(properties);
    const parentName = kind === 'sector' ? namedValue(properties, /barri|barrio/i) : undefined;
    const normalizedProperties: ZoneProperties = {
      name,
      municipality: municipality.name,
      kind,
      quality: 'imported',
      ...(parentName && parentName !== name ? { parentName } : {}),
    };
    byName.set(featureKey(kind, name), {
      type: 'Feature' as const,
      id: `${municipality.id}--${kind}--${slug(name)}`,
      properties: normalizedProperties,
      geometry: feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
    });
  });
  const features = [...byName.values()];
  if (!features.length) throw new Error('El archivo no contiene polígonos con nombre reconocible. Revisa si el ZIP tiene un campo de barrio, sector o zona, o prueba otra capa del geoportal.');
  return {
    type: 'FeatureCollection',
    municipality: municipality.name,
    source: { organization: 'Importación local', title: 'GeoJSON aportado por el usuario', official: false, accessedAt: new Date().toISOString().slice(0, 10) },
    features,
  };
}

export async function appendCustomFeature(municipality: Municipality, feature: ZoneFeature): Promise<ZoneCollection> {
  const current = await getCustomZones(municipality.id);
  const base: ZoneCollection = current ?? {
    type: 'FeatureCollection',
    municipality: municipality.name,
    source: { organization: 'Usuario', title: 'Desglose dibujado localmente', official: false, accessedAt: new Date().toISOString().slice(0, 10) },
    features: [],
  };
  const features = [...base.features.filter(item => item.id !== feature.id), feature];
  const next = { ...base, features };
  await saveCustomZones(municipality.id, next);
  return next;
}

export async function saveImportedCollection(municipality: Municipality, collection: ZoneCollection): Promise<void> {
  const current = await getCustomZones(municipality.id);
  await saveCustomZones(municipality.id, current ? mergeCollections(collection, current) : collection);
}

export async function countGeneratedImportedZones(municipality: Municipality): Promise<number> {
  const current = await getCustomZones(municipality.id);
  return current?.features.filter(feature => feature.properties.quality === 'imported' && isGeneratedZoneName(feature.properties.name)).length ?? 0;
}

export async function removeGeneratedImportedZones(municipality: Municipality): Promise<number> {
  const current = await getCustomZones(municipality.id);
  if (!current) return 0;
  const features = current.features.filter(feature => !(feature.properties.quality === 'imported' && isGeneratedZoneName(feature.properties.name)));
  const removed = current.features.length - features.length;
  if (removed) await saveCustomZones(municipality.id, { ...current, features });
  return removed;
}

export async function countLocalZones(municipality: Municipality): Promise<number> {
  const current = await getCustomZones(municipality.id);
  return current?.features.length ?? 0;
}

export async function resetLocalZones(municipality: Municipality): Promise<number> {
  const removed = await countLocalZones(municipality);
  if (removed) await deleteCustomZones(municipality.id);
  return removed;
}

function normalizeOpenDataUrl(url: URL): URL {
  const resourceMatch = url.pathname.match(/\/resource\/([0-9a-f-]{36})(?:\/|$)/i);
  if (resourceMatch && /(?:^|\.)seu-e\.cat$/i.test(url.hostname) && !url.pathname.includes('/api/')) {
    const api = new URL(`https://dadesobertes.seu-e.cat/api/aoc/action/odata/${resourceMatch[1]}`);
    api.searchParams.set('$format', 'json');
    return api;
  }
  return url;
}

type OpenDataPayload = Record<string, unknown> & {
  value?: Record<string, unknown>[];
  records?: Record<string, unknown>[];
  result?: { records?: Record<string, unknown>[] };
};

function openDataRecords(payload: OpenDataPayload): Record<string, unknown>[] | undefined {
  if (Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload.result?.records)) return payload.result.records;
  if (Array.isArray(payload.records)) return payload.records;
  return undefined;
}

export async function fetchGeoJsonUrl(rawUrl: string, municipality: Municipality, metadata?: { title: string; organization?: string; official?: boolean; geometryField?: string }): Promise<ZoneCollection> {
  let url: URL;
  try {
    url = normalizeOpenDataUrl(new URL(rawUrl));
  } catch {
    throw new Error('La URL no es valida.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL debe usar HTTP o HTTPS.');
  if (/\/(?:FeatureServer|MapServer)\/\d+\/?$/i.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/query`;
    url.search = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    }).toString();
  }
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/geo+json, application/json, text/csv;q=0.9, text/plain;q=0.7' } });
  } catch {
    throw new Error('El servidor no permite la descarga directa desde el navegador (CORS). Descarga el archivo y usa Importar archivo.');
  }
  if (!response.ok) throw new Error(`La fuente cartográfica respondió con ${response.status}. Abre el enlace oficial para comprobar si el servicio está temporalmente caído.`);

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const body = await response.text();
  let raw: GeoJSON.GeoJSON;
  if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
    raw = recordsWithWktToGeoJson(parseDelimitedText(body), metadata?.geometryField);
  } else {
    try {
      const payload = JSON.parse(body) as GeoJSON.GeoJSON | ArcGisPayload | OpenDataPayload;
      if (isArcGisPayload(payload)) raw = arcGisToGeoJson(payload);
      else {
        const records = openDataRecords(payload as OpenDataPayload);
        raw = records ? recordsWithWktToGeoJson(records, metadata?.geometryField) : payload as GeoJSON.GeoJSON;
      }
    } catch {
      raw = recordsWithWktToGeoJson(parseDelimitedText(body), metadata?.geometryField);
    }
  }
  if (raw.type === 'FeatureCollection' && raw.features.length === 0) throw new Error('La API respondió, pero no contiene polígonos WKT/GeoJSON reconocibles.');
  const collection = normalizeImportedCollection(raw, municipality);
  if (metadata?.official) {
    collection.features = collection.features.map(feature => ({
      ...feature,
      properties: { ...feature.properties, quality: 'official' },
    }));
  }
  collection.source = {
    organization: metadata?.organization ?? url.hostname,
    title: metadata?.title ?? `Datos importados desde ${url.hostname}`,
    official: metadata?.official ?? false,
    accessedAt: new Date().toISOString().slice(0, 10),
  };
  await saveImportedCollection(municipality, collection);
  return collection;
}

type ArcGisPayload = {
  spatialReference?: { wkid?: number; latestWkid?: number };
  features: Array<{ attributes?: Record<string, unknown>; geometry?: { rings?: number[][][]; spatialReference?: { wkid?: number; latestWkid?: number } } }>;
};

function isArcGisPayload(value: GeoJSON.GeoJSON | ArcGisPayload | OpenDataPayload): value is ArcGisPayload {
  return !('type' in value) && Array.isArray((value as ArcGisPayload).features);
}

function arcGisToGeoJson(payload: ArcGisPayload): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = payload.features.flatMap(item => {
    const rings = item.geometry?.rings;
    if (!rings?.length) return [];
    const wkid = item.geometry?.spatialReference?.latestWkid ?? item.geometry?.spatialReference?.wkid ?? payload.spatialReference?.latestWkid ?? payload.spatialReference?.wkid;
    const coordinates = rings.map(ring => ring.map(point => projectArcGisPoint(point, wkid)));
    return [{
      type: 'Feature' as const,
      properties: item.attributes ?? {},
      geometry: { type: 'Polygon' as const, coordinates },
    }];
  });
  return { type: 'FeatureCollection', features };
}

function projectArcGisPoint(point: number[], wkid?: number): number[] {
  if (![3857, 102100, 102113].includes(wkid ?? 0) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90) return point;
  const longitude = point[0] * 180 / 20037508.34;
  const latitude = Math.atan(Math.exp(point[1] * Math.PI / 20037508.34)) * 360 / Math.PI - 90;
  return [longitude, latitude];
}

export async function fetchOnlineZones(municipality: Municipality): Promise<ZoneCollection> {
  const bbox = municipalityBbox(municipality);
  const query = `[out:json][timeout:25];(way["boundary"="administrative"]["admin_level"~"9|10|11"](${bbox});relation["boundary"="administrative"]["admin_level"~"9|10|11"](${bbox});way["place"~"suburb|quarter|neighbourhood"](${bbox});relation["place"~"suburb|quarter|neighbourhood"](${bbox}););out tags geom;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let payload: { elements?: OverpassElement[] } | undefined;
  let lastStatus = 'sin respuesta';
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
      });
      lastStatus = String(response.status);
      if (!response.ok) continue;
      payload = await response.json() as { elements?: OverpassElement[] };
      break;
    } catch {
      lastStatus = 'error de red';
    }
  }
  if (!payload) throw new Error(`OpenStreetMap no respondió (${lastStatus}) en ninguno de sus servidores. Puedes reintentar o importar una fuente oficial.`);
  const features = (payload.elements ?? []).flatMap(element => overpassFeature(element, municipality));
  const unique = new Map(features.map(feature => [feature.id, feature]));
  if (!unique.size) throw new Error('OpenStreetMap no tiene polígonos de barrios para este municipio. Puedes dibujarlos o importar GeoJSON.');
  const collection: ZoneCollection = {
    type: 'FeatureCollection', municipality: municipality.name,
    source: { organization: 'OpenStreetMap contributors', title: 'Barrios obtenidos mediante Overpass API', official: false, accessedAt: new Date().toISOString().slice(0, 10) },
    features: [...unique.values()],
  };
  const current = await getCustomZones(municipality.id);
  const saved = current ? mergeCollections(current, collection) : collection;
  await saveCustomZones(municipality.id, saved);
  return saved;
}

function municipalityBbox(municipality: Municipality): string {
  if (!municipality.geometry || !('coordinates' in municipality.geometry)) throw new Error('El municipio no tiene geometría para acotar la búsqueda.');
  const points: number[][] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') points.push(value as number[]);
    else value.forEach(collect);
  };
  collect(municipality.geometry.coordinates);
  if (!points.length) throw new Error('No se pudo calcular el perímetro municipal.');
  const west = Math.min(...points.map(point => point[0]));
  const east = Math.max(...points.map(point => point[0]));
  const south = Math.min(...points.map(point => point[1]));
  const north = Math.max(...points.map(point => point[1]));
  return `${south},${west},${north},${east}`;
}
type OverpassPoint = { lat: number; lon: number };
type OverpassElement = {
  id: number;
  type: 'way' | 'relation' | 'node';
  tags?: Record<string, string>;
  geometry?: OverpassPoint[];
  members?: Array<{ role?: string; geometry?: OverpassPoint[] }>;
};

function overpassFeature(element: OverpassElement, municipality: Municipality): ZoneFeature[] {
  const name = element.tags?.name?.trim();
  if (!name) return [];
  const rings = element.type === 'way' && element.geometry ? closedRings([element.geometry])
    : closedRings((element.members ?? []).filter(member => member.role === 'outer' && member.geometry).map(member => member.geometry!));
  if (!rings.length) return [];
  return [{
    type: 'Feature', id: `${municipality.id}--${slug(name)}`,
    properties: { name, municipality: municipality.name, kind: 'barri', quality: 'community' },
    geometry: { type: 'Polygon', coordinates: rings },
  }];
}

function closedRings(segments: OverpassPoint[][]): number[][][] {
  const pending = segments.filter(segment => segment.length > 2).map(segment => [...segment]);
  const rings: number[][][] = [];
  const same = (first: OverpassPoint, second: OverpassPoint) => first.lat === second.lat && first.lon === second.lon;
  while (pending.length) {
    const ring = pending.shift()!;
    let joined = true;
    while (joined && !same(ring[0], ring[ring.length - 1])) {
      joined = false;
      const index = pending.findIndex(segment => same(ring[ring.length - 1], segment[0]) || same(ring[ring.length - 1], segment[segment.length - 1]));
      if (index >= 0) {
        const next = pending.splice(index, 1)[0];
        if (!same(ring[ring.length - 1], next[0])) next.reverse();
        ring.push(...next.slice(1));
        joined = true;
      }
    }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) rings.push(ring.map(point => [point.lon, point.lat]));
  }
  return rings;
}
function importedKind(properties: Record<string, unknown>): ZoneKind {
  const hasNamedField = (pattern: RegExp) => Object.entries(properties).some(([field, value]) => pattern.test(field) && Boolean(cleanName(value)));
  if (hasNamedField(/sector/i)) return 'sector';
  if (hasNamedField(/barri|barrio/i)) return 'barri';
  if (hasNamedField(/zona/i)) return 'zone';
  if (hasNamedField(/district|districte/i)) return 'district';
  return 'barri';
}

function featureKey(kind: ZoneKind, name: string): string {
  return `${kind}--${zoneKey(name)}`;
}

function mergeCollections(first: ZoneCollection, second: ZoneCollection): ZoneCollection {
  const merged = new Map(second.features.map(feature => [featureKey(feature.properties.kind, feature.properties.name), feature]));
  first.features.forEach(feature => merged.set(featureKey(feature.properties.kind, feature.properties.name), feature));
  return { ...first, features: [...merged.values()] };
}
