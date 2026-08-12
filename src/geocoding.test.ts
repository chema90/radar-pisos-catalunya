import { afterEach, describe, expect, it, vi } from 'vitest';
import { findMunicipalityAtPoint, formatReverseAddress, geocodePostalCode, isPostalCodeQuery, reverseGeocodeLocation } from './geocoding';
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

describe('búsqueda y formato postal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reconoce únicamente códigos postales completos de cinco cifras', () => {
    expect(isPostalCodeQuery('08395')).toBe(true);
    expect(isPostalCodeQuery('8395')).toBe(false);
    expect(isPostalCodeQuery('08395 Sant Pol')).toBe(false);
  });

  it('compone calle, portal, código postal y población', () => {
    expect(formatReverseAddress({
      road: 'Carrer de la Riera',
      house_number: '12',
      postcode: '08395',
      town: 'Sant Pol de Mar',
    }, 'Dirección sin estructurar')).toBe('Carrer de la Riera 12 · 08395 Sant Pol de Mar');
  });

  it('resuelve un código postal al municipio que contiene su centro', async () => {
    const santPol = municipality('1', 'Sant Pol de Mar', 2.5, 41.5, 2.7, 41.7);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '41.60', lon: '2.60', display_name: '08395, Sant Pol de Mar' }],
    }));

    const matches = await geocodePostalCode('08395', [santPol]);

    expect(matches.map(match => match.municipality.id)).toEqual(['1']);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('postalcode=08395');
  });

  it('obtiene la dirección postal aproximada de las coordenadas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lat: '41.60',
        lon: '2.60',
        display_name: '12, Carrer de la Riera, Sant Pol de Mar, 08395',
        address: { road: 'Carrer de la Riera', house_number: '12', postcode: '08395', town: 'Sant Pol de Mar' },
      }),
    }));

    const result = await reverseGeocodeLocation(41.60, 2.60);

    expect(result?.addressLabel).toBe('Carrer de la Riera 12 · 08395 Sant Pol de Mar');
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/reverse?');
  });
});
