import { describe, expect, it } from 'vitest';
import { findMunicipalityAtPoint } from './geocoding';
import type { Municipality } from './types';

const municipality = (id: string, name: string, west: number, south: number, east: number, north: number, entityType: Municipality['entityType'] = 'municipality'): Municipality => ({
  id,
  name,
  nameSpanish: name,
  county: 'Prova',
  countyCode: '00',
  province: 'Girona',
  capital: null,
  entityType,
  areaM2: (east - west) * (north - south),
  coverage: 'complete',
  geometry: {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  },
});

describe('findMunicipalityAtPoint', () => {
  it('detecta el municipio que contiene la localización', () => {
    const girona = municipality('1', 'Girona', 2.75, 41.93, 2.87, 42.02);
    const celra = municipality('2', 'Celrà', 2.87, 41.93, 2.98, 42.02);

    expect(findMunicipalityAtPoint([girona, celra], 2.82, 41.98)?.id).toBe('1');
  });

  it('prioriza una EMD específica frente al municipio contenedor', () => {
    const parent = municipality('1', 'Municipio', 1, 1, 5, 5);
    const emd = municipality('2', 'EMD', 2, 2, 3, 3, 'emd');

    expect(findMunicipalityAtPoint([parent, emd], 2.5, 2.5)?.id).toBe('2');
  });
});
