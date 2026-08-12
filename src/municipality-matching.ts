import type { Municipality, Preference } from './types';

export const normalizeText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export const normalizeMunicipalityName = (value: string): string => normalizeText(value)
  .replace(/^(?:l|el|la|els|les)\s+/, '');

export function findMunicipalityByName(municipalities: Municipality[], name: string | null | undefined): Municipality | undefined {
  const target = normalizeMunicipalityName(name ?? '');
  if (!target) return undefined;
  return municipalities.find(item => normalizeMunicipalityName(item.name) === target || normalizeMunicipalityName(item.nameSpanish) === target);
}

export function preferenceMunicipalityTarget(preference: Preference): string | null {
  return preference.kind === 'municipality' ? preference.name : preference.municipality;
}
