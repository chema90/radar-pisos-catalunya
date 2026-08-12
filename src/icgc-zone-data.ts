import type { Municipality, ZoneCollection, ZoneFeature } from './types';
import { slug } from './zone-data';

type IcgcFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, {
  area_id?: string;
  nom?: string;
  categoria?: string;
  municipi?: string;
  codi_municipi?: string;
}>;

type IcgcCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, IcgcFeature['properties']> & { name?: string };


const ICGC_ALIASES: Record<string, Record<string, string[]>> = {
  '430120': {
    'Altafulla': ['Altafulla centre', 'Centre'],
    'les Botigues de Mar': ['Barri Marítim', 'Altafulla platja', 'Baix a Mar', 'Botigues de Mar'],
  },
  '431310': {
    'el Roc de Sant Gaietà': ['Roc de Sant Gaietà'],
  },
  '080728': {
    'Can Montmany de Mas Peçoles': ['Can Montmany de Maspassoles'],
  },
};
function icgcAliases(municipalityId: string, name: string): string[] {
  return ICGC_ALIASES[municipalityId]?.[name] ?? [];
}

export async function loadIcgcZones(municipality: Municipality): Promise<ZoneCollection | undefined> {
  if (municipality.entityType === 'emd') return undefined;
  const filename = `${municipality.id}-${slug(municipality.name)}.geojson`;
  const url = `${import.meta.env.BASE_URL}data/icgc-arees-poblament/municipis/${filename}`;
  try {
    const response = await fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
    if (!response.ok) return undefined;
    const raw = await response.json() as IcgcCollection;
    const features: ZoneFeature[] = raw.features.flatMap((feature, index) => {
      if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return [];
      const properties = feature.properties ?? {};
      const name = String(properties.nom ?? '').trim();
      if (!name) return [];
      const category = String(properties.categoria ?? '').trim();
      const industrial = category.toLocaleLowerCase('ca').includes('industrial');
      const rawId = String(properties.area_id ?? `${municipality.id}-${index + 1}`);
      const aliases = icgcAliases(String(municipality.id), name);
      return [{
        type: 'Feature' as const,
        id: `icgc--${rawId}`,
        properties: {
          name,
          officialName: name,
          municipality: municipality.name,
          kind: industrial ? 'industrial' : 'zone',
          quality: 'official',
          layer: industrial ? 'icgcIndustrial' : 'icgcPopulation',
          sourceCategory: category,
          areaId: rawId,
          code: String(properties.codi_municipi ?? municipality.id),
          ...(aliases.length ? { aliases } : {}),
        },
        geometry: feature.geometry,
      }];
    });
    return {
      type: 'FeatureCollection',
      municipality: municipality.name,
      source: {
        organization: 'Institut Cartogràfic i Geològic de Catalunya (ICGC)',
        title: 'Àrees de poblament de Catalunya v3r1 (2026-02)',
        official: true,
        accessedAt: '2026-08-08',
      },
      features,
    };
  } catch {
    return undefined;
  }
}
