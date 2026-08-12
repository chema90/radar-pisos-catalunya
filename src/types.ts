export type Geometry = GeoJSON.Geometry;

export interface Municipality {
  entityType?: 'municipality' | 'emd';
  parentMunicipalityId?: string;
  parentMunicipalityName?: string;
  id: string;
  name: string;
  nameSpanish: string;
  county: string;
  countyCode: string;
  province: string;
  capital: string | null;
  areaM2: number | null;
  coverage: 'pending' | 'partial' | 'complete' | 'list-only' | 'nuclei-only';
  geometry: Geometry | null;
}

export interface Preference {
  id: string;
  municipality: string | null;
  name: string;
  kind: 'interest' | 'municipality' | 'excluded' | 'top';
  mode: 'buy-rent' | 'buy-only';
  status: 'pending-review' | 'list-only';
}
export type ZoneQuality = 'official' | 'community' | 'imported' | 'user-drawn' | 'list-only';
export type ZoneKind = 'barri' | 'sector' | 'zone' | 'district' | 'interest' | 'industrial';
export type ZoneLayer = 'barri' | 'sector' | 'municipalOther' | 'references' | 'icgcPopulation' | 'icgcIndustrial';
export type MapLayer = ZoneLayer | 'municipalityBoundary';

export interface ZoneProperties {
  name: string;
  officialName?: string;
  municipality: string;
  kind: ZoneKind;
  quality: ZoneQuality;
  district?: string;
  parentName?: string;
  reference?: 'area' | 'axis';
  code?: string;
  layer?: ZoneLayer;
  sourceCategory?: string;
  areaId?: string;
  aliases?: string[];
}


export interface ZoneFeature extends GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString | GeoJSON.MultiLineString, ZoneProperties> {
  id: string;
}

export interface ZoneCollection extends GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString | GeoJSON.MultiLineString, ZoneProperties> {
  municipality: string;
  source: {
    organization: string;
    title: string;
    official: boolean;
    accessedAt: string;
  };
  features: ZoneFeature[];
}

export type PropertyStatus = 'liked' | 'disliked' | 'pending';
export type PropertyKind = 'flat' | 'development';

export interface SeenProperty {
  id: string;
  municipalityId: string;
  municipality: string;
  zoneId?: string;
  zoneName?: string;
  kind: PropertyKind;
  name: string;
  url?: string;
  price?: number;
  areaM2?: number;
  condition?: string;
  status: PropertyStatus;
  notes?: string;
  latitude?: number;
  longitude?: number;
  locationSource?: string;
  locationLabel?: string;
  createdAt: string;
}
