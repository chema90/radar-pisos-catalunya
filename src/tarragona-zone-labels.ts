import type { ZoneCollection, ZoneFeature } from './types';
import { slug } from './zone-data';

const labels: Record<string, string> = {
  '1': 'Part Alta',
  '2': 'Eixample Tarragona',
  '3': 'Barris Marítims',
  '4': 'Nou Eixample Nord',
  '5': 'Nou Eixample Sud',
  '6': 'Torreforta i barris adjacents',
  '7': 'Campclar',
  '8': 'Bonavista',
  '10': 'Sant Salvador',
  '11': 'Sant Pere i Sant Pau',
  '12': 'Urbanitzacions de Llevant',
};

function normalizedCode(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = String(value).trim().replace(',', '.');
  if (!raw) return undefined;
  if (/^[+-]?\d+(?:\.0+)?$/.test(raw)) return String(Number(raw));
  return undefined;
}

/**
 * Compatibilidad con tarragona.geojson generados por versiones anteriores.
 * Si una zona oficial ya tiene el código correcto pero quedó rotulada con un
 * número, recuperamos el nombre municipal sin alterar la geometría.
 */
export function repairTarragonaZoneLabels(collection: ZoneCollection | undefined): ZoneCollection | undefined {
  if (!collection || collection.municipality.toLocaleLowerCase('ca') !== 'tarragona') return collection;
  let changed = false;
  const features = collection.features.map((feature): ZoneFeature => {
    if (feature.properties.kind !== 'zone') return feature;
    const code = normalizedCode(feature.properties.code) ?? normalizedCode(feature.properties.name);
    const label = code ? labels[code] : undefined;
    if (!label || feature.properties.name === label) return feature;
    changed = true;
    return {
      ...feature,
      id: `431482--zone--${slug(label)}`,
      properties: {
        ...feature.properties,
        name: label,
        officialName: label,
        code,
        aliases: code === '2'
          ? [...new Set([...(feature.properties.aliases ?? []), 'Eixample'])]
          : feature.properties.aliases,
      },
    };
  });
  return changed ? { ...collection, features } : collection;
}
