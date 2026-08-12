import type { Municipality } from './types';

export const VALLDOREIX_EMD_ID = 'emd-valldoreix';
export const VALLDOREIX_PARENT_ID = '082055';

export const VALLDOREIX_BARRIS = [
  'Aqualonga',
  "Ca n’Enric La Miranda",
  'Can Cadena',
  'Colònia Montserrat',
  'La Barceloneta',
  'La Guinardera - Can Casulleras',
  'Les Bobines',
  'Mas Fuster',
  'Mas Roig',
  'Monmany',
  'Regadiu',
  'Rossinyol',
  'Sant Jaume',
] as const;

export function withSubmunicipalTerritories(municipalities: Municipality[]): Municipality[] {
  if (municipalities.some(item => item.id === VALLDOREIX_EMD_ID)) return municipalities;
  const parent = municipalities.find(item => item.id === VALLDOREIX_PARENT_ID);
  if (!parent) return municipalities;
  const valldoreix: Municipality = {
    id: VALLDOREIX_EMD_ID,
    name: 'Valldoreix',
    nameSpanish: 'Valldoreix',
    county: parent.county,
    countyCode: parent.countyCode,
    province: parent.province,
    capital: null,
    areaM2: null,
    coverage: 'pending',
    geometry: null,
    entityType: 'emd',
    parentMunicipalityId: parent.id,
    parentMunicipalityName: parent.name,
  };
  return [...municipalities, valldoreix].sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

export function valldoreixKnownZones() {
  return VALLDOREIX_BARRIS.map(name => ({
    municipality: 'Valldoreix',
    name,
    kind: 'barri',
    official: true,
    source: 'EMD de Valldoreix · Barris de Valldoreix',
    sourceUrl: 'https://www.valldoreix.cat/barris-de-valldoreix/',
  }));
}
