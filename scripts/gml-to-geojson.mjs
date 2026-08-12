import proj4 from 'proj4';
import { DOMParser } from '@xmldom/xmldom';

proj4.defs('EPSG:23031', '+proj=utm +zone=31 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:32631', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs');

const geometryNames = new Set(['Point', 'LineString', 'Curve', 'Polygon', 'Surface', 'MultiSurface', 'MultiPolygon', 'MultiCurve', 'MultiLineString']);
const elementChildren = node => [...node.childNodes].filter(child => child.nodeType === 1);
const descendantsByLocalName = (node, localName) => [...node.getElementsByTagName('*')].filter(item => item.localName === localName);
const firstDescendant = (node, names) => names.has(node.localName) ? node : [...node.getElementsByTagName('*')].find(item => names.has(item.localName));

function crsCode(value) {
  if (!value) return 'EPSG:4326';
  const text = String(value).trim();
  const epsg = text.match(/EPSG(?::|::|\/|\.xml#)(\d+)/i) ?? text.match(/epsg\.xml#(\d+)/i);
  if (epsg) return `EPSG:${epsg[1]}`;
  if (/CRS84/i.test(text)) return 'EPSG:4326';
  return text;
}

function findSrsName(node, fallback) {
  let cursor = node;
  while (cursor) {
    const value = cursor.getAttribute?.('srsName');
    if (value) return crsCode(value);
    cursor = cursor.parentNode?.nodeType === 1 ? cursor.parentNode : null;
  }
  return crsCode(fallback);
}

function transformCoordinate(coord, sourceCrs) {
  const source = crsCode(sourceCrs);
  if (source === 'EPSG:4326') return coord;
  try { return proj4(source, 'EPSG:4326', coord); }
  catch { throw new Error(`No se puede reproyectar ${source} a EPSG:4326. Añade sourceCrs/proj4 a la configuración.`); }
}

function parseNumberPairs(text, dimension = 2) {
  const values = text.trim().split(/\s+/).map(Number).filter(Number.isFinite);
  const result = [];
  for (let i = 0; i + 1 < values.length; i += dimension) result.push([values[i], values[i + 1]]);
  return result;
}
const parseCoordinatesElement = text => text.trim().split(/\s+/).flatMap(token => {
  const parts = token.split(',').map(Number);
  return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? [[parts[0], parts[1]]] : [];
});

function parseLineCoordinates(node, sourceCrs) {
  const posList = descendantsByLocalName(node, 'posList')[0];
  if (posList?.textContent) {
    const dimension = Number(posList.getAttribute('srsDimension') || node.getAttribute('srsDimension') || '2') || 2;
    return parseNumberPairs(posList.textContent, dimension).map(coord => transformCoordinate(coord, sourceCrs));
  }
  const coordinates = descendantsByLocalName(node, 'coordinates')[0];
  if (coordinates?.textContent) return parseCoordinatesElement(coordinates.textContent).map(coord => transformCoordinate(coord, sourceCrs));
  return descendantsByLocalName(node, 'pos').flatMap(pos => pos.textContent ? parseNumberPairs(pos.textContent, 2) : []).map(coord => transformCoordinate(coord, sourceCrs));
}

function findRing(boundary, sourceCrs) {
  const ring = firstDescendant(boundary, new Set(['LinearRing', 'Ring'])) ?? boundary;
  return parseLineCoordinates(ring, sourceCrs);
}

function parsePolygon(node, fallbackCrs) {
  const sourceCrs = findSrsName(node, fallbackCrs);
  const exterior = descendantsByLocalName(node, 'exterior')[0] ?? descendantsByLocalName(node, 'outerBoundaryIs')[0];
  const rings = [];
  if (exterior) rings.push(findRing(exterior, sourceCrs));
  const interiors = [...descendantsByLocalName(node, 'interior'), ...descendantsByLocalName(node, 'innerBoundaryIs')];
  for (const interior of interiors) rings.push(findRing(interior, sourceCrs));
  if (!rings.length) {
    const direct = parseLineCoordinates(node, sourceCrs);
    if (direct.length) rings.push(direct);
  }
  return { type: 'Polygon', coordinates: rings };
}

function parseGeometry(node, fallbackCrs) {
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
    case 'Surface': return parsePolygon(geometry, sourceCrs);
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
    default: return null;
  }
}

function textProperties(featureNode) {
  const props = {};
  for (const child of elementChildren(featureNode)) {
    if (child.localName === 'boundedBy' || firstDescendant(child, geometryNames)) continue;
    const value = child.textContent?.trim();
    if (value) props[child.localName] = value;
  }
  return props;
}

function featureNodes(doc) {
  const members = [...doc.getElementsByTagName('*')].filter(node => node.localName === 'member' || node.localName === 'featureMember');
  const features = members.flatMap(member => elementChildren(member).slice(0, 1));
  if (features.length) return features;
  return elementChildren(doc.documentElement).filter(child => child.localName !== 'boundedBy' && firstDescendant(child, geometryNames));
}

export function parseGmlText(text, fallbackCrs) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const parserErrors = [...doc.getElementsByTagName('*')].filter(node => node.localName === 'parsererror');
  if (parserErrors.length) throw new Error('El XML/GML no es válido.');
  const collectionCrs = findSrsName(doc.documentElement, fallbackCrs);
  const features = [];
  for (const featureNode of featureNodes(doc)) {
    const geometry = parseGeometry(featureNode, collectionCrs);
    if (!geometry) continue;
    const id = featureNode.getAttribute('gml:id') || featureNode.getAttribute('fid') || featureNode.getAttribute('id') || undefined;
    features.push({ type: 'Feature', ...(id ? { id } : {}), properties: textProperties(featureNode), geometry });
  }
  if (!features.length) throw new Error('No se han encontrado geometrías GML compatibles en el XML.');
  return { type: 'FeatureCollection', features };
}
