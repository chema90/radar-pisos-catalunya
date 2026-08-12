import type { Municipality, ZoneCollection, ZoneFeature } from './types';

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
  source: 'OpenStreetMap Nominatim';
};

export type AddressSearchResult = GeocodeResult & { municipality: Municipality };

type NominatimResult = { lat: string; lon: string; display_name: string };

/**
 * A street plus portal number must be resolved as an address before looking
 * for similarly named municipalities, neighborhoods or saved zones.
 */
export function isLikelyAddressQuery(value: string): boolean {
  return /(?:,|\s)\s*\d{1,5}[a-z]?(?:\s*(?:-|\/)\s*\d{1,5}[a-z]?)?\s*$/i.test(value.trim());
}

export async function geocodeAddress(address: string, municipality: Municipality): Promise<GeocodeResult | undefined> {
  const bounds = municipalityBounds(municipality);
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: `${address}, ${municipality.name}, Catalunya, Espanya`,
    limit: '1',
    addressdetails: '1',
    countrycodes: 'es',
  });
  if (bounds) {
    params.set('viewbox', `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`);
    params.set('bounded', '1');
  }
  const [result] = await fetchNominatim(params);
  if (!result) return undefined;
  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: result.display_name,
    source: 'OpenStreetMap Nominatim',
  };
}


export async function geocodeSearchAddress(address: string, activeMunicipality: Municipality, municipalities: Municipality[]): Promise<AddressSearchResult | undefined> {
  const scoped = await geocodeAddress(address, activeMunicipality);
  if (scoped && municipalityContainsPoint(activeMunicipality, scoped.longitude, scoped.latitude)) {
    return { ...scoped, municipality: activeMunicipality };
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: `${address}, Catalunya, Espanya`,
    limit: '8',
    addressdetails: '1',
    countrycodes: 'es',
  });
  const results = await fetchNominatim(params);
  for (const result of results) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const municipality = findMunicipalityAtPoint(municipalities, longitude, latitude);
    if (!municipality) continue;
    return {
      latitude,
      longitude,
      displayName: result.display_name,
      source: 'OpenStreetMap Nominatim',
      municipality,
    };
  }
  return undefined;
}

export function findMunicipalityAtPoint(municipalities: Municipality[], longitude: number, latitude: number): Municipality | undefined {
  return municipalities
    .filter(municipality => municipalityContainsPoint(municipality, longitude, latitude))
    .sort((left, right) => {
      const leftEmd = left.entityType === 'emd' ? 1 : 0;
      const rightEmd = right.entityType === 'emd' ? 1 : 0;
      if (leftEmd !== rightEmd) return rightEmd - leftEmd;
      return (left.areaM2 ?? Number.POSITIVE_INFINITY) - (right.areaM2 ?? Number.POSITIVE_INFINITY);
    })[0];
}

export function municipalityContainsPoint(municipality: Municipality, longitude: number, latitude: number): boolean {
  const geometry = municipality.geometry;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return polygonContains(geometry.coordinates, longitude, latitude);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(polygon => polygonContains(polygon, longitude, latitude));
  return false;
}

async function fetchNominatim(params: URLSearchParams): Promise<NominatimResult[]> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json', 'Accept-Language': 'ca,es;q=0.9' },
  });
  if (!response.ok) throw new Error(`El geocodificador no respondio (${response.status}).`);
  return response.json() as Promise<NominatimResult[]>;
}

export function findZoneAtPoint(collection: ZoneCollection | undefined, longitude: number, latitude: number): ZoneFeature | undefined {
  return collection?.features.find(feature => {
    if (feature.geometry.type === 'Polygon') return polygonContains(feature.geometry.coordinates, longitude, latitude);
    if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.some(polygon => polygonContains(polygon, longitude, latitude));
    return false;
  });
}

function polygonContains(rings: number[][][], longitude: number, latitude: number): boolean {
  if (!rings.length || !ringContains(rings[0], longitude, latitude)) return false;
  return !rings.slice(1).some(ring => ringContains(ring, longitude, latitude));
}

function ringContains(ring: number[][], longitude: number, latitude: number): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const crosses = (y1 > latitude) !== (y2 > latitude)
      && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1;
    if (crosses) inside = !inside;
  }
  return inside;
}

function municipalityBounds(municipality: Municipality): { west: number; east: number; south: number; north: number } | undefined {
  if (!municipality.geometry || !('coordinates' in municipality.geometry)) return undefined;
  const points: number[][] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') points.push(value as number[]);
    else value.forEach(collect);
  };
  collect(municipality.geometry.coordinates);
  if (!points.length) return undefined;
  return {
    west: Math.min(...points.map(point => point[0])),
    east: Math.max(...points.map(point => point[0])),
    south: Math.min(...points.map(point => point[1])),
    north: Math.max(...points.map(point => point[1])),
  };
}
