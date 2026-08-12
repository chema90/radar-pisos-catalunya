import proj4 from 'proj4';

const EPSG_23031 = '+proj=utm +zone=31 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs';
const EPSG_25831 = '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs';
const EPSG_32631 = '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs';

proj4.defs('EPSG:23031', EPSG_23031);
proj4.defs('EPSG:25831', EPSG_25831);
proj4.defs('EPSG:32631', EPSG_32631);

type Coord = [number, number];

const geometryNames = new Set(['Point', 'LineString', 'Curve', 'Polygon', 'Surface', 'MultiSurface', 'MultiPolygon', 'MultiCurve', 'MultiLineString']);

function elementChildren(node: Element): Element[] {
  return Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1);
}

function descendantsByLocalName(node: Element, localName: string): Element[] {
  return Array.from(node.getElementsByTagName('*')).filter(item => item.localName === localName);
}

function firstDescendant(node: Element, names: Set<string>): Element | undefined {
  if (names.has(node.localName)) return node;
  return Array.from(node.getElementsByTagName('*')).find(item => names.has(item.localName));
}

function crsCode(value: string | null | undefined): string {
  if (!value) return 'EPSG:4326';
  const text = value.trim();
  const epsg = text.match(/EPSG(?::|::|\/|\.xml#)(\d+)/i) ?? text.match(/epsg\.xml#(\d+)/i);
  if (epsg) return `EPSG:${epsg[1]}`;
  if (/CRS84/i.test(text)) return 'EPSG:4326';
  return text;
}

function findSrsName(node: Element, fallback?: string): string {
  let cursor: Element | null = node;
  while (cursor) {
    const value = cursor.getAttribute('srsName');
    if (value) return crsCode(value);
    const parentNode: Node | null = cursor.parentNode;
    cursor = parentNode && parentNode.nodeType === 1 ? parentNode as Element : null;
  }
  return crsCode(fallback);
}

function transformCoordinate(coord: Coord, sourceCrs: string): Coord {
  const source = crsCode(sourceCrs);
  if (source === 'EPSG:4326') return coord;
  try {
    const result = proj4(source, 'EPSG:4326', coord);
    return [result[0], result[1]];
  } catch (error) {
    throw new Error(`No se puede reproyectar ${source} a EPSG:4326. Añade la definición CRS al importador.`);
  }
}

function parseNumberPairs(text: string, dimension = 2): Coord[] {
  const values = text.trim().split(/\s+/).map(Number).filter(Number.isFinite);
  const coords: Coord[] = [];
  for (let i = 0; i + 1 < values.length; i += dimension) coords.push([values[i], values[i + 1]]);
  return coords;
}

function parseCoordinatesElement(text: string): Coord[] {
  return text.trim().split(/\s+/).flatMap(token => {
    const parts = token.split(',').map(Number);
    return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? [[parts[0], parts[1]] as Coord] : [];
  });
}

function parseLineCoordinates(node: Element, sourceCrs: string): Coord[] {
  const posList = descendantsByLocalName(node, 'posList')[0];
  if (posList?.textContent) {
    const dimension = Number(posList.getAttribute('srsDimension') || node.getAttribute('srsDimension') || '2') || 2;
    return parseNumberPairs(posList.textContent, dimension).map(coord => transformCoordinate(coord, sourceCrs));
  }
  const coordinates = descendantsByLocalName(node, 'coordinates')[0];
  if (coordinates?.textContent) return parseCoordinatesElement(coordinates.textContent).map(coord => transformCoordinate(coord, sourceCrs));
  const positions = descendantsByLocalName(node, 'pos').flatMap(pos => pos.textContent ? parseNumberPairs(pos.textContent, 2) : []);
  return positions.map(coord => transformCoordinate(coord, sourceCrs));
}

function findRing(boundary: Element, sourceCrs: string): Coord[] {
  const ring = firstDescendant(boundary, new Set(['LinearRing', 'Ring'])) ?? boundary;
  return parseLineCoordinates(ring, sourceCrs);
}

function parsePolygon(node: Element, fallbackCrs?: string): GeoJSON.Polygon {
  const sourceCrs = findSrsName(node, fallbackCrs);
  const exterior = descendantsByLocalName(node, 'exterior')[0] ?? descendantsByLocalName(node, 'outerBoundaryIs')[0];
  const rings: Coord[][] = [];
  if (exterior) rings.push(findRing(exterior, sourceCrs));
  const interiors = [...descendantsByLocalName(node, 'interior'), ...descendantsByLocalName(node, 'innerBoundaryIs')];
  for (const interior of interiors) rings.push(findRing(interior, sourceCrs));
  if (!rings.length) {
    const direct = parseLineCoordinates(node, sourceCrs);
    if (direct.length) rings.push(direct);
  }
  return { type: 'Polygon', coordinates: rings };
}

function parseGeometry(node: Element, fallbackCrs?: string): GeoJSON.Geometry | null {
  const geometry = firstDescendant(node, geometryNames);
  if (!geometry) return null;
  const sourceCrs = findSrsName(geometry, fallbackCrs);
  switch (geometry.localName) {
    case 'Point': {
      const coords = parseLineCoordinates(geometry, sourceCrs)[0];
      return coords ? { type: 'Point', coordinates: coords } : null;
    }
    case 'LineString':
    case 'Curve': {
      const coords = parseLineCoordinates(geometry, sourceCrs);
      return coords.length ? { type: 'LineString', coordinates: coords } : null;
    }
    case 'Polygon':
    case 'Surface':
      return parsePolygon(geometry, sourceCrs);
    case 'MultiSurface':
    case 'MultiPolygon': {
      const polygons = descendantsByLocalName(geometry, 'Polygon').map(item => parsePolygon(item, sourceCrs).coordinates);
      return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
    }
    case 'MultiCurve':
    case 'MultiLineString': {
      const lines = [...descendantsByLocalName(geometry, 'LineString'), ...descendantsByLocalName(geometry, 'Curve')]
        .map(item => parseLineCoordinates(item, sourceCrs)).filter(item => item.length);
      return lines.length ? { type: 'MultiLineString', coordinates: lines } : null;
    }
    default:
      return null;
  }
}

function textProperties(featureNode: Element): Record<string, string> {
  const props: Record<string, string> = {};
  for (const child of elementChildren(featureNode)) {
    if (child.localName === 'boundedBy' || firstDescendant(child, geometryNames)) continue;
    const value = child.textContent?.trim();
    if (value) props[child.localName] = value;
  }
  return props;
}

function featureNodes(doc: Document): Element[] {
  const members = Array.from(doc.getElementsByTagName('*')).filter(node => node.localName === 'member' || node.localName === 'featureMember');
  const features = members.flatMap(member => elementChildren(member).slice(0, 1));
  if (features.length) return features;
  const collection = doc.documentElement;
  return elementChildren(collection).filter(child => child.localName !== 'boundedBy' && firstDescendant(child, geometryNames));
}

export function parseGmlDocument(doc: Document, fallbackCrs?: string): GeoJSON.FeatureCollection {
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El XML/GML no es válido.');
  const collectionCrs = findSrsName(doc.documentElement, fallbackCrs);
  const features: GeoJSON.Feature[] = [];
  for (const featureNode of featureNodes(doc)) {
    const geometry = parseGeometry(featureNode, collectionCrs);
    if (!geometry) continue;
    const id = featureNode.getAttribute('gml:id') || featureNode.getAttribute('fid') || featureNode.getAttribute('id') || undefined;
    features.push({ type: 'Feature', ...(id ? { id } : {}), properties: textProperties(featureNode), geometry });
  }
  if (!features.length) throw new Error('No se han encontrado geometrías GML compatibles en el XML.');
  return { type: 'FeatureCollection', features };
}

export function parseGmlText(text: string, fallbackCrs?: string): GeoJSON.FeatureCollection {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return parseGmlDocument(doc, fallbackCrs);
}
