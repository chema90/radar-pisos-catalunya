declare module 'shpjs' {
  type ShapefileParts = { shp: ArrayBuffer; dbf?: ArrayBuffer; prj?: string; cpg?: string };
  export default function shp(input: ArrayBuffer | ShapefileParts): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
}
