import shp from 'shpjs';
import { kml } from '@tmcw/togeojson';
import { parseGmlText } from './gml-import';

export type GeospatialImport = {
  collection: GeoJSON.FeatureCollection;
  format: string;
  layers: string[];
};

const extension = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const stem = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase();

function combine(collections: GeoJSON.FeatureCollection[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: collections.flatMap(item => item.features) };
}

function asCollections(value: GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]): GeoJSON.FeatureCollection[] {
  return Array.isArray(value) ? value : [value];
}

async function parseShapefile(files: File[]): Promise<GeospatialImport> {
  const zipped = files.find(file => extension(file.name) === 'zip');
  if (zipped) {
    const result = await shp(await zipped.arrayBuffer()) as GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];
    const collections = asCollections(result);
    return { collection: combine(collections), format: 'Shapefile ZIP', layers: collections.map((_, index) => `Capa ${index + 1}`) };
  }

  const shpFile = files.find(file => extension(file.name) === 'shp');
  if (!shpFile) throw new Error('Selecciona el .shp y, si existen, sus archivos .dbf, .prj y .cpg. También puedes usar un ZIP.');
  const base = stem(shpFile.name);
  const related = (ext: string) => files.find(file => stem(file.name) === base && extension(file.name) === ext);
  const dbf = related('dbf');
  const prj = related('prj');
  const cpg = related('cpg');
  const result = await shp({
    shp: await shpFile.arrayBuffer(),
    ...(dbf ? { dbf: await dbf.arrayBuffer() } : {}),
    ...(prj ? { prj: await prj.text() } : {}),
    ...(cpg ? { cpg: await cpg.text() } : {}),
  }) as GeoJSON.FeatureCollection;
  return { collection: result, format: 'Shapefile', layers: [base] };
}

async function parseGeoPackage(file: File): Promise<GeospatialImport> {
  const { BoundingBox, GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage');
  setSqljsWasmLocateFile(() => `${import.meta.env.BASE_URL}sql-wasm.wasm`);
  const geoPackage = await GeoPackageAPI.open(new Uint8Array(await file.arrayBuffer()));
  try {
    const layers = geoPackage.getFeatureTables();
    if (!layers.length) throw new Error('El GeoPackage no contiene tablas vectoriales.');
    const world = new BoundingBox(-180, 180, -90, 90);
    const collections = layers.map(table => ({
      type: 'FeatureCollection' as const,
      features: geoPackage.queryForGeoJSONFeaturesInTable(table, world) as GeoJSON.Feature[],
    }));
    return { collection: combine(collections), format: 'GeoPackage', layers };
  } finally {
    geoPackage.close();
  }
}

export async function parseGeospatialFiles(files: File[]): Promise<GeospatialImport> {
  if (!files.length) throw new Error('Selecciona al menos un archivo.');
  const primary = files[0];
  const ext = extension(primary.name);
  if (files.some(file => ['shp', 'dbf', 'prj', 'cpg', 'zip'].includes(extension(file.name)))) return parseShapefile(files);
  if (ext === 'gpkg') return parseGeoPackage(primary);
  if (ext === 'kml') {
    const xml = new DOMParser().parseFromString(await primary.text(), 'text/xml');
    // DOMParser in the browser provides querySelector, while the XML parser used
    // during automated checks only implements the standard XML DOM methods.
    // getElementsByTagName works in both environments.
    if (xml.getElementsByTagName('parsererror').length > 0) throw new Error('El KML no es válido.');
    return { collection: kml(xml) as unknown as GeoJSON.FeatureCollection, format: 'KML', layers: [stem(primary.name)] };
  }
  if (ext === 'xml' || ext === 'gml') {
    return { collection: parseGmlText(await primary.text()), format: 'GML/XML', layers: [stem(primary.name)] };
  }
  if (ext === 'json' || ext === 'geojson') {
    const collection = JSON.parse(await primary.text()) as GeoJSON.GeoJSON;
    if (collection.type !== 'FeatureCollection') throw new Error('El archivo debe contener una colección de entidades GeoJSON.');
    return { collection, format: 'GeoJSON', layers: [stem(primary.name)] };
  }
  throw new Error('Formato no compatible. Usa GeoJSON, KML, GML/XML, GeoPackage o Shapefile (.zip o sus archivos asociados).');
}
