import { openDB } from 'idb';
import type { SeenProperty, ZoneCollection } from './types';

export type ZoneInterest = 'normal' | 'top' | 'interesting' | 'discarded';

export type ZoneNote = {
  interest?: ZoneInterest;
  favorite?: boolean;
  top?: boolean;
  discarded?: boolean;
  visited?: boolean;
  rating?: number;
  text?: string;
  visitedAt?: string;
};

const dbPromise = openDB('radar-de-pisos', 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('zone-notes')) db.createObjectStore('zone-notes');
    if (!db.objectStoreNames.contains('seen-properties')) db.createObjectStore('seen-properties', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('custom-zone-collections')) db.createObjectStore('custom-zone-collections');
  },
});

export async function getNote(zoneId: string): Promise<ZoneNote> {
  return (await (await dbPromise).get('zone-notes', zoneId)) ?? {};
}

export async function saveNote(zoneId: string, note: ZoneNote): Promise<void> {
  await (await dbPromise).put('zone-notes', note, zoneId);
}

export async function getNotes(): Promise<Record<string, ZoneNote>> {
  const db = await dbPromise;
  const [keys, values] = await Promise.all([db.getAllKeys('zone-notes'), db.getAll('zone-notes')]);
  return Object.fromEntries(keys.map((key, index) => [String(key), values[index]]));
}
export async function getSeenProperties(): Promise<SeenProperty[]> {
  return (await (await dbPromise).getAll('seen-properties'))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function saveSeenProperty(property: SeenProperty): Promise<void> {
  await (await dbPromise).put('seen-properties', property);
}

export async function getCustomZones(municipalityId: string): Promise<ZoneCollection | undefined> {
  return (await (await dbPromise).get('custom-zone-collections', municipalityId)) ?? undefined;
}

export async function saveCustomZones(municipalityId: string, collection: ZoneCollection): Promise<void> {
  await (await dbPromise).put('custom-zone-collections', collection, municipalityId);
}

export async function deleteCustomZones(municipalityId: string): Promise<void> {
  await (await dbPromise).delete('custom-zone-collections', municipalityId);
}