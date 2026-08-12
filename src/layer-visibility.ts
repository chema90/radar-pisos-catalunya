import type { MapLayer } from './types';

export type LayerVisibility = Record<MapLayer, boolean>;

const key = (municipalityId: string) => `radar-pisos-layer-visibility-v3:${municipalityId}`;

export function loadLayerVisibility(municipalityId: string, defaults: LayerVisibility): LayerVisibility {
  try {
    const saved = JSON.parse(localStorage.getItem(key(municipalityId)) ?? '{}') as Partial<LayerVisibility>;
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export function saveLayerVisibility(municipalityId: string, visibility: LayerVisibility): void {
  localStorage.setItem(key(municipalityId), JSON.stringify(visibility));
}
