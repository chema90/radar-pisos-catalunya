import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { parseGeospatialFiles } from './geo-import';
import { isLikelyAddressQuery } from './geocoding';
import { discoverGeoLayers, parseWfsCapabilities } from './source-discovery';
import { recordsWithWktToGeoJson } from './wkt-import';
vi.mock('./storage', () => ({
  getCustomZones: vi.fn(),
  saveCustomZones: vi.fn(),
  deleteCustomZones: vi.fn(),
}));
import { normalizeImportedCollection, zoneKey } from './zone-data';

beforeAll(() => {
  globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;
});

describe('importación GIS', () => {
  it('importa KML con barrios y polígonos', async () => {
    const xml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><ExtendedData><Data name="NOMBARRI"><value>Centre</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>2.0,41.0 2.1,41.0 2.1,41.1 2.0,41.0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    const file = new File([xml], 'barris.kml', { type: 'application/vnd.google-earth.kml+xml' });
    const result = await parseGeospatialFiles([file]);
    expect(result.format).toBe('KML');
    expect(result.collection.features).toHaveLength(1);
  });

  it('importa WFS/GML y reproyecta EPSG:23031 a WGS84', async () => {
    const xml = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:x="urn:test"><wfs:member><x:barris gml:id="barris.1"><x:geom><gml:Polygon srsName="http://www.opengis.net/gml/srs/epsg.xml#23031"><gml:exterior><gml:LinearRing><gml:posList>436000 4591000 436100 4591000 436100 4591100 436000 4591000</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></x:geom><x:nom_min>Centre</x:nom_min></x:barris></wfs:member></wfs:FeatureCollection>`;
    const file = new File([xml], 'barris.xml', { type: 'application/xml' });
    const result = await parseGeospatialFiles([file]);
    expect(result.format).toBe('GML/XML');
    expect(result.collection.features).toHaveLength(1);
    const geometry = result.collection.features[0].geometry as GeoJSON.Polygon;
    expect(geometry.coordinates[0][0][0]).toBeGreaterThan(2);
    expect(geometry.coordinates[0][0][0]).toBeLessThan(3);
    expect(geometry.coordinates[0][0][1]).toBeGreaterThan(41);
    expect(geometry.coordinates[0][0][1]).toBeLessThan(42);
  });

  it('convierte registros CKAN/OData con WKT WGS84 a GeoJSON', () => {
    const result = recordsWithWktToGeoJson([{ NomElement: 'Centre', Geometria_WGS84_LonLat: 'POLYGON ((2.09 41.36 0, 2.10 41.36 0, 2.10 41.37 0, 2.09 41.36 0))' }], 'Geometria_WGS84_LonLat');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry?.type).toBe('Polygon');
    expect(result.features[0].properties?.NomElement).toBe('Centre');
  });

  it('mantiene compatible la importación GeoJSON', async () => {
    const file = new File([JSON.stringify({ type: 'FeatureCollection', features: [] })], 'zonas.geojson', { type: 'application/geo+json' });
    const result = await parseGeospatialFiles([file]);
    expect(result.format).toBe('GeoJSON');
    expect(result.collection.type).toBe('FeatureCollection');
  });

  it('usa campos de barrio oficiales antes de inventar nombres genericos', () => {
    const collection = normalizeImportedCollection({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { OBJECTID: 2, NOM_BARRI: 'Pericot' },
        geometry: { type: 'Polygon', coordinates: [[[-1, 1], [1, 1], [1, -1], [-1, 1]]] },
      }],
    }, { id: '170792', name: 'Girona', nameSpanish: 'Gerona', county: 'Girones', countyCode: '20', province: 'Girona', capital: null, areaM2: null, coverage: 'partial', geometry: null });
    expect(collection.features[0].properties.name).toBe('Pericot');
  });

  it('reconoce los sectores y los mantiene separados de los barrios', () => {
    const collection = normalizeImportedCollection({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { BARRIS: 'Centre', SECTORS: 'Barri Vell' },
        geometry: { type: 'Polygon', coordinates: [[[-1, 1], [1, 1], [1, -1], [-1, 1]]] },
      }, {
        type: 'Feature',
        properties: { NOM_BARRI: 'Barri Vell' },
        geometry: { type: 'Polygon', coordinates: [[[-2, 2], [2, 2], [2, -2], [-2, 2]]] },
      }],
    }, { id: '170792', name: 'Girona', nameSpanish: 'Gerona', county: 'Girones', countyCode: '20', province: 'Girona', capital: null, areaM2: null, coverage: 'partial', geometry: null });
    expect(collection.features).toHaveLength(2);
    expect(collection.features.map(feature => feature.properties.kind)).toEqual(['sector', 'barri']);
    expect(collection.features[0].properties).toMatchObject({ name: 'Barri Vell', parentName: 'Centre' });
  });

  it('normaliza claves para evitar duplicados por articulos y acentos', () => {
    expect(zoneKey("L'Eixample")).toBe(zoneKey('Eixample'));
    expect(zoneKey('Santa Eugenia')).toBe(zoneKey('Santa Eugènia'));
  });
});

describe('búsqueda por dirección', () => {
  it('prioriza una calle con portal frente a coincidencias locales homónimas', () => {
    expect(isLikelyAddressQuery('Berguedà, 3')).toBe(true);
    expect(isLikelyAddressQuery('Granollers')).toBe(false);
  });
});

describe('descubrimiento de fuentes', () => {
  it('extrae y prioriza capas de barrios de WFS 2.0', () => {
    const xml = `<?xml version="1.0"?><WFS_Capabilities version="2.0.0"><FeatureTypeList>
      <FeatureType><Name>cat:carreteras</Name><Title>Carreteras</Title></FeatureType>
      <FeatureType><Name>cat:barris</Name><Title>Barris municipals</Title></FeatureType>
    </FeatureTypeList></WFS_Capabilities>`;
    const layers = parseWfsCapabilities(xml, 'https://example.test/geoserver/wfs');
    expect(layers).toHaveLength(1);
    expect(layers[0].title).toBe('Barris municipals');
    expect(layers[0].importUrl).toContain('typeNames=cat%3Abarris');
  });

  it('rechaza URLs que no son HTTP o HTTPS', async () => {
    await expect(discoverGeoLayers('file:///capas')).rejects.toThrow('HTTP o HTTPS');
  });
});

import { findMunicipalityByName, preferenceMunicipalityTarget } from './municipality-matching';

describe('navegación municipal', () => {
  const municipalities = [
    { id: '081017', name: "l'Hospitalet de Llobregat", nameSpanish: "L'Hospitalet de Llobregat", county: 'Barcelonès', countyCode: '13', province: 'Barcelona', capital: null, areaM2: null, coverage: 'pending' as const, geometry: null },
    { id: '170669', name: 'Figueres', nameSpanish: 'Figueras', county: 'Alt Empordà', countyCode: '02', province: 'Girona', capital: null, areaM2: null, coverage: 'pending' as const, geometry: null },
  ];

  it('tolera artículos y acentos al resolver municipios', () => {
    expect(findMunicipalityByName(municipalities, 'Hospitalet de Llobregat')?.id).toBe('081017');
    expect(findMunicipalityByName(municipalities, 'Figueras')?.id).toBe('170669');
  });

  it('usa el nombre real del municipio en filas agrupadas de ZONAS_INTERES', () => {
    const preference = { id: 'girona-y-costa-brava--figueres', municipality: 'Girona y Costa Brava', name: 'Figueres', kind: 'municipality' as const, mode: 'buy-rent' as const, status: 'list-only' as const };
    expect(preferenceMunicipalityTarget(preference)).toBe('Figueres');
  });
});
