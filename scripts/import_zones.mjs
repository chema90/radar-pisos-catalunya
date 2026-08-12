import { readFile, writeFile, mkdir, copyFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import https from 'node:https';
import { basename, dirname, resolve } from 'node:path';
import shp from 'shpjs';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import proj4 from 'proj4';
import { parseGmlText } from './gml-to-geojson.mjs';
import { parseDelimitedText, recordsWithWktToGeoJson } from './wkt-utils.mjs';
import { partitionSantCugatValldoreix } from './valldoreix-routing.mjs';

const root = resolve(import.meta.dirname, '..');
const configPath = resolve(root, 'config/gis-sources.json');
const targetDir = resolve(root, 'public/data/municipality-zones');
const backupRoot = resolve(root, 'data/backups/municipality-zones');

proj4.defs('EPSG:23031', '+proj=utm +zone=31 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');
proj4.defs('EPSG:32631', '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs');


const sleep = (ms) => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

const TLS_CERTIFICATE_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);

function errorCode(error) {
  return error?.cause?.code || error?.code || error?.message || 'fallo de red';
}

function responseFromBuffer(status, statusMessage, headers, body) {
  return {
    status,
    statusText: statusMessage || '',
    ok: status >= 200 && status < 300,
    headers,
    text: async () => body.toString('utf8'),
    json: async () => JSON.parse(body.toString('utf8')),
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

async function fetchWithHostScopedTlsFallback(url, options, allowedHost, label) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== allowedHost) {
    throw new Error(`Fallback TLS rechazado: ${target.hostname} no coincide con el host autorizado ${allowedHost}.`);
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const req = https.request(target, {
      method: options.method || 'GET',
      headers: options.headers,
      rejectUnauthorized: false,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          const redirected = new URL(location, target);
          if (redirected.hostname !== allowedHost) {
            rejectPromise(new Error(`${label}: redirección TLS fuera del host oficial autorizado (${redirected.hostname}).`));
            return;
          }
          fetchWithHostScopedTlsFallback(redirected, options, allowedHost, label).then(resolvePromise, rejectPromise);
          return;
        }
        resolvePromise(responseFromBuffer(status, res.statusMessage, res.headers, Buffer.concat(chunks)));
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error(`${label}: timeout de 20 s en fallback TLS controlado.`)));
    req.on('error', rejectPromise);
    req.end();
  });
}

async function fetchWithRetry(url, options = {}, label = 'fuente remota') {
  const attempts = 3;
  const { insecureTlsFallbackHost, ...fetchOptions } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const signal = fetchOptions.signal ?? AbortSignal.timeout(20000);
      const response = await fetch(url, { ...fetchOptions, signal });
      // Los 4xx normalmente son deterministas: no ganamos nada reintentándolos.
      if (response.status >= 400 && response.status < 500) return response;
      if (!response.ok && attempt < attempts) {
        console.warn(`  [REINTENTO ${attempt}/${attempts}] ${label}: HTTP ${response.status}`);
        await sleep(900 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`  [REINTENTO ${attempt}/${attempts}] ${label}: ${errorCode(error)}`);
        await sleep(900 * attempt);
        continue;
      }
    }
  }

  const reason = errorCode(lastError);
  const target = new URL(url);
  if (insecureTlsFallbackHost && target.hostname === insecureTlsFallbackHost && TLS_CERTIFICATE_ERRORS.has(reason)) {
    console.warn(`  [TLS CONTROLADO] ${label}: el servidor oficial tiene una cadena de certificado defectuosa (${reason}).`);
    console.warn(`  [TLS CONTROLADO] Se permite una única descarga sin validar certificado SOLO para ${insecureTlsFallbackHost}; los datos se validarán antes de guardarse.`);
    return fetchWithHostScopedTlsFallback(url, fetchOptions, insecureTlsFallbackHost, label);
  }

  throw new Error(`${label} no respondió tras ${attempts} intentos (${reason})`);
}


function backupStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
}

async function backupExistingFile(targetFile) {
  if (!existsSync(targetFile)) return undefined;
  const dir = resolve(backupRoot, backupStamp());
  await mkdir(dir, { recursive: true });
  const backupFile = resolve(dir, basename(targetFile));
  await copyFile(targetFile, backupFile);
  console.log(`  Copia de seguridad: ${backupFile.replace(root + '/', '')}`);
  return backupFile;
}

function routeSantCugatAndValldoreix(municipalitiesData) {
  const santCugat = municipalitiesData['Sant Cugat del Vallès'];
  if (!santCugat?.features?.length) return;
  const partition = partitionSantCugatValldoreix(santCugat.features);
  if (partition.hasAny && !partition.complete) {
    throw new Error(`Sant Cugat: se detectaron solo ${partition.found.length}/13 barrios oficiales de Valldoreix (${partition.found.join(', ')}). Faltan: ${partition.missing.join(', ')}. No se escribirá nada para evitar mezclar Valldoreix con Sant Cugat.`);
  }
  if (!partition.hasAny) {
    console.log('  Sant Cugat: la capa no contiene barrios identificables de Valldoreix; no se aplica separación.');
    return;
  }
  if (partition.santCugat.length < 49) {
    throw new Error(`Sant Cugat: tras separar Valldoreix solo quedarían ${partition.santCugat.length} barrios; cobertura sospechosamente baja. No se escribirá.`);
  }
  santCugat.features = partition.santCugat;
  municipalitiesData.Valldoreix = {
    municipalityId: 'emd-valldoreix',
    sourceTitle: `${santCugat.sourceTitle ?? 'GeoServer municipal · Barris'} · barrios de la EMD de Valldoreix`,
    sourceOrganization: 'Ajuntament de Sant Cugat del Vallès / EMD de Valldoreix',
    official: true,
    features: partition.valldoreix.map(feature => ({
      ...feature,
      id: `emd-valldoreix--barri--${slug(feature.properties.name)}`,
      properties: {
        ...feature.properties,
        municipality: 'Valldoreix',
        kind: 'barri',
        quality: 'official',
        sourceCategory: 'emd-valldoreix',
      },
    })),
  };
  console.log(`  Sant Cugat: ${partition.santCugat.length} barrios quedan en Sant Cugat.`);
  console.log(`  Valldoreix: ${partition.valldoreix.length} barrios oficiales separados en su EMD.`);
}

// Helper to normalize strings for IDs and filenames
const slug = (value) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// Helper to find a field by name (case-insensitive, trying common fallbacks)
function findFieldValue(properties, exactField, fallbacks = []) {
  if (exactField && properties[exactField] !== undefined) return properties[exactField];
  
  const lowerProps = Object.keys(properties).reduce((acc, key) => {
    acc[key.toLowerCase()] = properties[key];
    return acc;
  }, {});

  if (exactField && lowerProps[exactField.toLowerCase()] !== undefined) {
    return lowerProps[exactField.toLowerCase()];
  }

  for (const fallback of fallbacks) {
    if (lowerProps[fallback.toLowerCase()] !== undefined) {
      return lowerProps[fallback.toLowerCase()];
    }
  }
  
  return undefined;
}

const COMMON_NAME_FIELDS = ['name', 'nom', 'nombre', 'nom_barri', 'nombarri', 'nom_bar', 'barri_nom', 'barri', 'barrio', 'barris', 'sectors', 'nom_comple', 'denominacio', 'descripcio', 'descrip', 'descripcio_barris', 'nomzona', 'nom_zona', 'desc_barri', 'barri_desc'];

function sourceExpectedNames(source) {
  return [...new Set([...(source.expectedAnchorNames ?? []), ...(source.requiredNames ?? [])].map(normalizeValidationName).filter(Boolean))];
}

function samplePropertyKeys(collection, limit = 80) {
  const keys = new Set();
  for (const feature of (collection?.features ?? []).slice(0, limit)) {
    for (const key of Object.keys(feature?.properties ?? {})) keys.add(key);
  }
  return [...keys];
}

function inferNameField(collection, source) {
  if (source.nameField) return source.nameField;
  const expected = sourceExpectedNames(source);
  if (!expected.length) return undefined;
  const keys = samplePropertyKeys(collection);
  if (!keys.length) return undefined;
  const technical = /^(objectid|fid|id|globalid|shape|shape_length|shape_area|area|length|perimeter|geometry|geom|codi|code|num|numero)$/i;
  let best;
  for (const key of keys) {
    if (technical.test(key)) continue;
    const values = [];
    for (const feature of collection.features ?? []) {
      const value = feature?.properties?.[key];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (!text || /^[-+]?\d+(?:[.,]\d+)?$/.test(text)) continue;
      values.push(text);
    }
    if (!values.length) continue;
    const normalizedValues = [...new Set(values.map(normalizeValidationName).filter(Boolean))];
    const exactMatches = expected.filter(name => normalizedValues.includes(name)).length;
    const fuzzyMatches = expected.filter(name => normalizedValues.some(value => value.includes(name) || name.includes(value))).length;
    const keyNorm = normalizeValidationName(key);
    const semanticBonus = /(nom|name|barri|barrio|denomin|descrip|zona)/.test(keyNorm) ? 120 : 0;
    const uniqueness = normalizedValues.length / Math.max(1, values.length);
    const score = exactMatches * 1000 + fuzzyMatches * 250 + semanticBonus + Math.min(100, normalizedValues.length) + uniqueness * 20;
    if (!best || score > best.score) best = { key, score, exactMatches, fuzzyMatches, values: [...new Set(values)].slice(0, 8) };
  }
  if (!best) return undefined;
  const minimumMatches = Math.min(2, expected.length);
  if (Math.max(best.exactMatches, best.fuzzyMatches) < minimumMatches) return undefined;
  console.log(`  Campo de nombre detectado automáticamente: ${best.key} · ejemplos: ${best.values.slice(0,4).join(' | ')}`);
  return best.key;
}

function displayName(value, mode) {
  const clean = String(value).trim().replace(/\s+/g, ' ');
  if (mode !== 'title') return clean;
  return clean.toLocaleLowerCase('ca').replace(/(^|[\s-])([\p{L}])/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('ca')}`);
}

async function fetchArcGis(url, source = {}) {
  const queryUrl = new URL(`${url.replace(/\/$/, '')}/query`);
  const baseParams = {
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
  };
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};

  // Prefer GeoJSON: ArcGIS then preserves Polygon/MultiPolygon topology for us.
  queryUrl.search = new URLSearchParams({ ...baseParams, f: 'geojson' }).toString();
  let response = await fetchWithRetry(queryUrl, { headers: { Accept: 'application/geo+json,application/json' }, ...tlsOption }, 'ArcGIS GeoJSON');
  if (response.ok) {
    try {
      const geojson = await response.json();
      if (geojson?.type === 'FeatureCollection' && Array.isArray(geojson.features)) return geojson;
    } catch { /* fall back to the classic ArcGIS JSON response */ }
  }

  queryUrl.search = new URLSearchParams({ ...baseParams, f: 'json' }).toString();
  response = await fetchWithRetry(queryUrl, { headers: { Accept: 'application/json' }, ...tlsOption }, 'ArcGIS JSON');
  if (!response.ok) throw new Error(`HTTP Error ${response.status} fetching ${queryUrl}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'ArcGIS returned an error');
  const features = (payload.features ?? []).flatMap(item => {
    const rings = item.geometry?.rings;
    if (!rings?.length) return [];
    return [{
      type: 'Feature',
      properties: item.attributes ?? {},
      geometry: { type: 'Polygon', coordinates: rings },
    }];
  });
  return { type: 'FeatureCollection', features };
}

function childText(node, localName) {
  for (const child of [...node.childNodes]) {
    if (child.localName === localName) return child.textContent?.trim() ?? '';
  }
  return '';
}

function parseXmlOrThrow(text, label) {
  const value = String(text ?? '').trim();
  if (!value.startsWith('<') || /^<!doctype\s+html|^<html\b/i.test(value)) {
    throw new Error(`${label} devolvió HTML/texto en lugar de XML OGC.`);
  }
  return new DOMParser().parseFromString(value, 'text/xml');
}


const OGC_REQUEST_PARAMS = [
  'service','version','request','layers','styles','srs','crs','bbox','width','height','format','transparent',
  'query_layers','info_format','feature_count','i','j','x','y','typenames','typename','outputformat','srsname',
];
function cleanOgcUrl(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of OGC_REQUEST_PARAMS) {
    url.searchParams.delete(key);
    url.searchParams.delete(key.toUpperCase());
    url.searchParams.delete(key.toLowerCase());
  }
  return url;
}

async function fetchWmsLayer(source, endpointUrl) {
  const endpoint = cleanOgcUrl(endpointUrl);
  endpoint.searchParams.set('service', 'WMS');
  endpoint.searchParams.set('request', 'GetCapabilities');
  endpoint.searchParams.set('version', '1.3.0');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const response = await fetchWithRetry(endpoint, { headers: { Accept: 'text/xml,application/xml,*/*' }, ...tlsOption }, `WMS GetCapabilities ${source.municipality}`);
  if (!response.ok) throw new Error(`WMS GetCapabilities returned ${response.status}`);
  const doc = parseXmlOrThrow(await response.text(), `WMS GetCapabilities ${source.municipality}`);
  const pattern = new RegExp(source.layerPattern || 'barris?|barrios?|neighbou?rhoods?', 'i');
  const avoid = /district|districte|sector|seccio|section|carrer|street|postal|text|etiquet/i;
  const candidates = [...doc.getElementsByTagName('*')]
    .filter(node => node.localName === 'Layer')
    .map(node => {
      const name = childText(node, 'Name');
      const title = childText(node, 'Title') || name;
      const text = `${title} ${name}`;
      let score = pattern.test(text) ? 100 : 0;
      if (/barris?|barrios?|neighbou?rhoods?/i.test(text)) score += 60;
      if (source.preferredLayerTitle && title.localeCompare(source.preferredLayerTitle, 'ca', { sensitivity:'base' }) === 0) score += 1000;
      if (source.preferredLayerName && name.localeCompare(source.preferredLayerName, 'ca', { sensitivity:'base' }) === 0) score += 1000;
      if (avoid.test(text) && !source.preferredLayerName) score -= 70;
      return { name, title, score };
    })
    .filter(item => item.name)
    .sort((a,b) => b.score-a.score);
  const best=candidates[0];
  if(!best || best.score<50) throw new Error('No se identificó una capa WMS de barrios segura.');
  console.log(`  WMS layer selected: ${best.title} (${best.name})`);
  return best;
}

async function fetchWms(source) {
  let wfsError;
  if (source.wfsProbe) {
    try { return await fetchWfsEndpoint(source, source.url); }
    catch (error) {
      wfsError = error;
      console.warn(`  [WFS no disponible] ${source.municipality}: ${error.message}. Probando WMS/KML vectorial…`);
    }
  }
  const layer = await fetchWmsLayer(source, source.url);
  try { return await fetchWmsKmlFallback(source, source.url, layer); }
  catch (error) {
    throw new Error(`${wfsError ? `WFS: ${wfsError.message}; ` : ''}WMS/KML: ${error.message}`);
  }
}


function stripMarkup(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectStringValues(value, out = [], depth = 0) {
  if (depth > 5 || value === null || value === undefined) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = stripMarkup(value);
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectStringValues(child, out, depth + 1);
    return out;
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) collectStringValues(child, out, depth + 1);
  }
  return out;
}

function expectedNameFromFeature(feature, expectedNames) {
  const values = collectStringValues(feature?.properties ?? {});
  let best;
  let bestScore = 0;
  for (const expected of expectedNames ?? []) {
    const e = normalizeValidationName(expected);
    if (!e) continue;
    for (const raw of values) {
      const v = normalizeValidationName(raw);
      if (!v) continue;
      let score = 0;
      if (v === e) score = 1000;
      else if (v.includes(e) && e.length >= 4) score = 700 + e.length;
      else if (e.includes(v) && v.length >= 5) score = 400 + v.length;
      if (score > bestScore) { bestScore = score; best = expected; }
    }
  }
  return bestScore >= 400 ? best : undefined;
}

function featurePoint(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return undefined;
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'MultiPoint') return geometry.coordinates?.[0];
  return undefined;
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoordinates(point, coordinates) {
  if (!coordinates?.length || !pointInRing(point, coordinates[0])) return false;
  for (const hole of coordinates.slice(1)) if (pointInRing(point, hole)) return false;
  return true;
}

function pointInGeometry(point, geometry) {
  if (geometry?.type === 'Polygon') return pointInPolygonCoordinates(point, geometry.coordinates);
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.some(polygon => pointInPolygonCoordinates(point, polygon));
  return false;
}

async function fetchWmsLayerMatching(source, endpointUrl, patternText, description) {
  const endpoint = cleanOgcUrl(endpointUrl);
  endpoint.searchParams.set('service', 'WMS');
  endpoint.searchParams.set('request', 'GetCapabilities');
  endpoint.searchParams.set('version', '1.3.0');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const response = await fetchWithRetry(endpoint, { headers: { Accept: 'text/xml,application/xml,*/*' }, ...tlsOption }, `WMS GetCapabilities ${source.municipality} (${description})`);
  if (!response.ok) throw new Error(`WMS GetCapabilities returned ${response.status}`);
  const doc = parseXmlOrThrow(await response.text(), `WMS GetCapabilities ${source.municipality} (${description})`);
  const pattern = new RegExp(patternText, 'i');
  const candidates = [...doc.getElementsByTagName('*')]
    .filter(node => node.localName === 'Layer')
    .map(node => ({ name: childText(node, 'Name'), title: childText(node, 'Title') || childText(node, 'Name') }))
    .filter(item => item.name && pattern.test(`${item.title} ${item.name}`));
  if (!candidates.length) throw new Error(`No se encontró la capa WMS auxiliar ${description}.`);
  candidates.sort((a,b) => {
    const score = item => (/text|etiquet|label|nom/i.test(`${item.title} ${item.name}`) ? 100 : 0) + (/barris?/i.test(`${item.title} ${item.name}`) ? 50 : 0);
    return score(b)-score(a);
  });
  console.log(`  WMS auxiliary layer selected: ${candidates[0].title} (${candidates[0].name})`);
  return candidates[0];
}

async function requestWmsKmlCollection(source, endpointUrl, layer, bounds, labelSuffix = '') {
  const [minX, minY, maxX, maxY] = bounds;
  const url = cleanOgcUrl(endpointUrl);
  url.searchParams.set('service', 'WMS');
  url.searchParams.set('version', '1.1.1');
  url.searchParams.set('request', 'GetMap');
  url.searchParams.set('layers', layer.name);
  url.searchParams.set('styles', '');
  url.searchParams.set('srs', 'EPSG:4326');
  url.searchParams.set('bbox', [minX, minY, maxX, maxY].join(','));
  url.searchParams.set('width', '2048');
  url.searchParams.set('height', '2048');
  url.searchParams.set('format', 'application/vnd.google-earth.kml+xml');
  url.searchParams.set('transparent', 'true');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const response = await fetchWithRetry(url, { headers: { Accept: 'application/vnd.google-earth.kml+xml,application/xml,text/xml,*/*' }, ...tlsOption }, `WMS/KML ${source.municipality}${labelSuffix}`);
  if (!response.ok) throw new Error(`WMS/KML returned ${response.status}`);
  const text = await response.text();
  if (/ServiceException|ExceptionReport/i.test(text)) throw new Error('WMS/KML devolvió una excepción del servidor.');
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return kml(doc) ?? { type:'FeatureCollection', features:[] };
}

function geometryRepresentativePoint(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates
      : [];
  const ranked = polygons.map(coordinates => {
    const ring = coordinates?.[0] ?? [];
    if (!ring.length) return undefined;
    const xs = ring.map(point => point[0]);
    const ys = ring.map(point => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { coordinates, minX, maxX, minY, maxY, area: (maxX-minX)*(maxY-minY) };
  }).filter(Boolean).sort((a,b)=>b.area-a.area);
  for (const polygon of ranked) {
    const center = [(polygon.minX+polygon.maxX)/2, (polygon.minY+polygon.maxY)/2];
    if (pointInPolygonCoordinates(center, polygon.coordinates)) return center;
    const ring = polygon.coordinates[0];
    const average = [ring.reduce((sum,p)=>sum+p[0],0)/ring.length, ring.reduce((sum,p)=>sum+p[1],0)/ring.length];
    if (pointInPolygonCoordinates(average, polygon.coordinates)) return average;
    // Búsqueda determinista de un punto interior en una rejilla fina del bbox.
    for (let iy=1; iy<10; iy += 1) for (let ix=1; ix<10; ix += 1) {
      const point = [polygon.minX + (polygon.maxX-polygon.minX)*ix/10, polygon.minY + (polygon.maxY-polygon.minY)*iy/10];
      if (pointInPolygonCoordinates(point, polygon.coordinates)) return point;
    }
  }
  return undefined;
}

async function wmsFeatureInfoName(source, endpointUrl, layer, bounds, point, expectedNames) {
  const [minX, minY, maxX, maxY] = bounds;
  const width = 2048, height = 2048;
  const x = Math.max(0, Math.min(width-1, Math.round((point[0]-minX)/(maxX-minX)*width)));
  const y = Math.max(0, Math.min(height-1, Math.round((maxY-point[1])/(maxY-minY)*height)));
  const formats = ['application/json', 'text/plain', 'text/html'];
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  for (const infoFormat of formats) {
    const url = cleanOgcUrl(endpointUrl);
    url.searchParams.set('service','WMS');
    url.searchParams.set('version','1.1.1');
    url.searchParams.set('request','GetFeatureInfo');
    url.searchParams.set('layers',layer.name);
    url.searchParams.set('query_layers',layer.name);
    url.searchParams.set('styles','');
    url.searchParams.set('srs','EPSG:4326');
    url.searchParams.set('bbox',[minX,minY,maxX,maxY].join(','));
    url.searchParams.set('width',String(width));
    url.searchParams.set('height',String(height));
    url.searchParams.set('format','image/png');
    url.searchParams.set('info_format',infoFormat);
    url.searchParams.set('x',String(x));
    url.searchParams.set('y',String(y));
    try {
      const response = await fetchWithRetry(url, { headers:{ Accept:`${infoFormat},*/*` }, ...tlsOption }, `WMS GetFeatureInfo ${source.municipality}`);
      if (!response.ok) continue;
      const text = await response.text();
      if (/ServiceException|ExceptionReport/i.test(text)) continue;
      const name = expectedNameFromFeature({ properties:{ response:text } }, expectedNames);
      if (name) return name;
    } catch { /* probar siguiente formato */ }
  }
  return undefined;
}

async function joinWmsPolygonNamesFromLabels(source, endpointUrl, polygonLayer, polygons, bounds) {
  if (!source.expectedNames?.length) return polygons;
  const assigned = new Map();
  const usedNames = new Set();

  if (source.wmsLabelLayerPattern) {
    try {
      const labelLayer = await fetchWmsLayerMatching(source, endpointUrl, source.wmsLabelLayerPattern, 'de nombres de barrios');
      const labels = await requestWmsKmlCollection(source, endpointUrl, labelLayer, bounds, ' etiquetas');
      for (const feature of labels.features ?? []) {
        const point = featurePoint(feature);
        const name = expectedNameFromFeature(feature, source.expectedNames);
        if (!point || !name || usedNames.has(name)) continue;
        const matches = polygons.map((polygon, index) => pointInGeometry(point, polygon.geometry) ? index : -1).filter(index => index >= 0);
        if (matches.length !== 1 || assigned.has(matches[0])) continue;
        assigned.set(matches[0], name);
        usedNames.add(name);
      }
      console.log(`  WMS/KML etiquetas: ${assigned.size}/${polygons.length} nombres asignados espacialmente.`);
    } catch (error) {
      console.warn(`  [ETIQUETAS WMS] ${source.municipality}: ${error.message}. Probando GetFeatureInfo sobre los polígonos…`);
    }
  }

  // Fallback oficial: el mismo WMS puede exponer atributos mediante GetFeatureInfo
  // aunque el KML use identificadores técnicos como BARRIS_P.0.
  for (let index=0; index<polygons.length; index += 1) {
    if (assigned.has(index)) continue;
    const point = geometryRepresentativePoint(polygons[index].geometry);
    if (!point) continue;
    const remaining = source.expectedNames.filter(name => !usedNames.has(name));
    const name = await wmsFeatureInfoName(source, endpointUrl, polygonLayer, bounds, point, remaining);
    if (!name || usedNames.has(name)) continue;
    assigned.set(index, name);
    usedNames.add(name);
  }

  if (assigned.size !== polygons.length || usedNames.size !== source.expectedNames.length) {
    const missing = source.expectedNames.filter(name => !usedNames.has(name));
    throw new Error(`No se pudieron asignar de forma inequívoca los nombres oficiales a los ${polygons.length} polígonos. Asignados ${assigned.size}; faltan: ${missing.join(', ')}.`);
  }
  console.log(`  WMS: ${assigned.size} polígonos emparejados con los ${usedNames.size} nombres oficiales.`);
  return polygons.map((feature, index) => ({
    ...feature,
    properties: { ...(feature.properties ?? {}), name: assigned.get(index), officialName: assigned.get(index) },
  }));
}

async function fetchWmsKmlFallback(source, endpointUrl, layer) {
  const catalog = await municipalityCatalog();
  const municipality = (catalog.municipalities || []).find(item => String(item.id) === String(source.municipalityId));
  const bounds = geometryBounds(municipality?.geometry);
  if (!bounds) throw new Error('No se pudo obtener el límite municipal para la alternativa WMS/KML.');
  const collection = await requestWmsKmlCollection(source, endpointUrl, layer, bounds);
  let polygons = (collection?.features ?? []).filter(feature => ['Polygon','MultiPolygon'].includes(feature?.geometry?.type));
  if (!polygons.length) throw new Error('WMS/KML no devolvió polígonos vectoriales utilizables.');
  console.log(`  WMS/KML público usado como alternativa al WFS protegido: ${layer.title} (${layer.name}) · ${polygons.length} polígonos`);
  polygons = await joinWmsPolygonNamesFromLabels(source, endpointUrl, layer, polygons, bounds);
  return { type:'FeatureCollection', features:polygons };
}

async function fetchWfsEndpoint(source, endpointUrl) {
  const endpoint = cleanOgcUrl(endpointUrl);
  endpoint.searchParams.set('service', 'WFS');
  endpoint.searchParams.set('request', 'GetCapabilities');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const capabilitiesResponse = await fetchWithRetry(endpoint, { headers: { Accept: 'text/xml,application/xml' }, ...tlsOption }, `WFS GetCapabilities ${source.municipality}`);
  if (!capabilitiesResponse.ok) throw new Error(`WFS GetCapabilities returned ${capabilitiesResponse.status}`);
  const xmlText = await capabilitiesResponse.text();
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const root = doc.documentElement;
  const advertisedVersion = root.getAttribute('version') || '2.0.0';
  const pattern = new RegExp(source.layerPattern || 'barri|barrio', 'i');
  const avoid = /district|districte|sector|seccio|section|carrer|address|postal/i;
  const candidates = [...doc.getElementsByTagName('*')]
    .filter(node => node.localName === 'FeatureType')
    .map(node => {
      const name = childText(node, 'Name');
      const title = childText(node, 'Title') || name;
      const text = `${title} ${name}`;
      let score = pattern.test(text) ? 100 : 0;
      if (/barris?|barrios?/i.test(text)) score += 50;
      if (source.preferredLayerTitle && title.localeCompare(source.preferredLayerTitle, 'ca', { sensitivity: 'base' }) === 0) score += 1000;
      if (source.preferredLayerName && name.localeCompare(source.preferredLayerName, 'ca', { sensitivity: 'base' }) === 0) score += 1000;
      if (avoid.test(text)) score -= 60;
      return { name, title, score };
    })
    .filter(item => item.name)
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 50) throw new Error('Could not identify the WFS neighbourhood layer safely');

  const versions = [...new Set([advertisedVersion, '2.0.0', '1.1.0', '1.0.0'])];
  // Muchos GeoServer devuelven GeoJSON; MapServer suele ser más conservador y
  // puede publicar únicamente GML. Probamos ambos sin rebajar la validación posterior.
  const formats = [
    { value: 'application/json', parser: 'json' },
    { value: 'json', parser: 'json' },
    { value: undefined, parser: 'gml' },
  ];
  let lastError;
  for (const version of versions) {
    for (const format of formats) {
      const featureUrl = cleanOgcUrl(endpointUrl);
      featureUrl.searchParams.set('service', 'WFS');
      featureUrl.searchParams.set('version', version);
      featureUrl.searchParams.set('request', 'GetFeature');
      featureUrl.searchParams.set(version.startsWith('2') ? 'typeNames' : 'typeName', best.name);
      if (format.value) featureUrl.searchParams.set('outputFormat', format.value);
      featureUrl.searchParams.set('srsName', 'EPSG:4326');
      const accept = format.parser === 'json'
        ? 'application/geo+json,application/json,*/*'
        : 'application/gml+xml,text/xml,application/xml,*/*';
      const formatLabel = format.value ?? 'GML por defecto';
      const featureResponse = await fetchWithRetry(featureUrl, { headers: { Accept: accept }, ...tlsOption }, `WFS GetFeature ${source.municipality}`);
      if (!featureResponse.ok) {
        lastError = new Error(`WFS GetFeature ${version}/${formatLabel} returned ${featureResponse.status}`);
        if ([401,403].includes(featureResponse.status)) {
          if (source.wmsKmlFallback) {
            try { return await fetchWmsKmlFallback(source, endpointUrl, best); }
            catch (fallbackError) {
              lastError = new Error(`${lastError.message}; alternativa WMS/KML falló: ${fallbackError.message}`);
              throw lastError;
            }
          }
          break;
        }
        continue;
      }
      try {
        const collection = format.parser === 'json'
          ? await featureResponse.json()
          : parseGmlText(await featureResponse.text());
        if (collection?.features?.length) {
          console.log(`  WFS layer selected: ${best.title} (${best.name}) · ${endpointUrl} · WFS ${version} · ${formatLabel}`);
          return collection;
        }
        lastError = new Error(`WFS layer ${best.title} returned no features (${formatLabel})`);
      } catch (error) {
        lastError = new Error(`WFS ${version}/${formatLabel} no devolvió ${format.parser === 'json' ? 'JSON' : 'GML'} válido (${error.message}).`);
      }
    }
  }
  throw lastError ?? new Error(`WFS layer ${best.title} no pudo descargarse.`);
}

async function fetchWfs(source) {
  const endpoints = [...new Set([source.url, ...(source.fallbackUrls ?? [])].filter(Boolean))];
  let lastError;
  for (const endpoint of endpoints) {
    try {
      return await fetchWfsEndpoint(source, endpoint);
    } catch (error) {
      lastError = error;
      console.warn(`  [REINTENTO WFS] ${source.municipality}: ${endpoint} -> ${error.message}`);
    }
  }
  throw lastError ?? new Error('No se pudo consultar ningún endpoint WFS configurado.');
}

async function readShapefile(source) {
  let buffer;
  if (source.url) {
    const response = await fetchWithRetry(source.url, {
      headers: { Accept: 'application/zip,application/octet-stream,*/*' },
    }, `${source.municipality} SHP/ZIP`);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${source.url}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    if (!source.file) throw new Error(`Source [${source.id}] needs file or url.`);
    const absolutePath = resolve(root, source.file);
    buffer = await readFile(absolutePath);
  }
  const parsed = await shp(buffer);
  return Array.isArray(parsed)
    ? { type: 'FeatureCollection', features: parsed.flatMap(item => item.features) }
    : parsed;
}

async function readReusGeoApi(source) {
  const endpoint = source.url || 'https://geoportal.reus.cat/apps/giscube-admin/plugins/mapiareus_search/search/';
  const queryTokens = source.queryTokens || ['', 'a', 'e', 'i', 'o', 'u'];
  const deduped = new Map();
  let successfulRequests = 0;

  for (const token of queryTokens) {
    const url = new URL(endpoint);
    url.searchParams.set('q', token);
    url.searchParams.set('e', source.element || 'barri');
    url.searchParams.set('epsg', '4326');
    const response = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, `${source.municipality} GeoAPI (${token || 'consulta general'})`);
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) continue;
      throw new Error(`GeoAPI HTTP ${response.status}`);
    }
    const payload = await response.json();
    const container = payload?.resultat ?? payload?.resultats ?? payload?.results ?? payload;
    let records = Array.isArray(container?.[source.element || 'barri']) ? container[source.element || 'barri']
      : Array.isArray(container) ? container
        : [];
    // Algunos despliegues pueden envolver el resultado con una clave adicional.
    if (!records.length && container && typeof container === 'object') {
      records = Object.values(container).find(value => Array.isArray(value) && value.some(item => item?.geom || item?.geometry)) ?? [];
    }
    successfulRequests += 1;
    for (const record of records) {
      const geometry = record?.geom ?? record?.geometry;
      if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type)) continue;
      const name = record?.nom ?? record?.name ?? record?.nombre;
      if (!name) continue;
      const key = String(record?.id ?? record?.codi ?? record?.num ?? name).trim();
      deduped.set(key, { type: 'Feature', properties: { ...record, geom: undefined, geometry: undefined }, geometry });
    }
    // Si la consulta vacía ya devuelve una colección sustancial, no hacemos más peticiones.
    if (!token && deduped.size >= Number(source.minimumExpectedFeatures ?? 5)) break;
  }

  if (!successfulRequests) throw new Error('La GeoAPI de Reus no respondió a ninguna consulta.');
  const features = [...deduped.values()];
  if (!features.length) throw new Error('La GeoAPI de Reus no devolvió polígonos de barrios.');
  console.log(`  Reus GeoAPI: ${features.length} barrios poligonales únicos.`);
  return { type: 'FeatureCollection', features };
}


async function readCkanGeoJson(source) {
  const apiBase = String(source.ckanApiBase || new URL('/api/3/action', source.url).toString()).replace(/\/$/, '');
  const searchUrl = new URL(`${apiBase}/package_search`);
  searchUrl.searchParams.set('q', source.ckanQuery || source.sourceTitle || source.municipality);
  searchUrl.searchParams.set('rows', '50');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const response = await fetchWithRetry(searchUrl, { headers: { Accept: 'application/json' }, ...tlsOption }, `${source.municipality} CKAN package_search`);
  if (!response.ok) throw new Error(`CKAN package_search HTTP ${response.status}`);
  const payload = await response.json();
  const datasets = payload?.result?.results ?? [];
  if (!datasets.length) throw new Error(`CKAN no encontró el conjunto ${source.ckanQuery || source.sourceTitle}.`);
  const queryNorm = normalizeValidationName(source.ckanQuery || source.sourceTitle || '');
  const ranked = datasets.map(dataset => {
    const title = `${dataset.title || ''} ${dataset.name || ''}`;
    const norm = normalizeValidationName(title);
    let score = norm === queryNorm ? 1000 : norm.includes(queryNorm) || queryNorm.includes(norm) ? 500 : 0;
    if (/zonificacions? administratives?/i.test(title)) score += 250;
    return { dataset, score };
  }).sort((a,b)=>b.score-a.score);
  const formatPattern = new RegExp(source.resourceFormatPattern || 'geojson', 'i');
  let lastError;
  for (const { dataset } of ranked.slice(0, 8)) {
    const resourceExcludePattern = source.resourceExcludePattern ? new RegExp(source.resourceExcludePattern, 'i') : null;
    const resourcePreferPattern = source.resourcePreferPattern ? new RegExp(source.resourcePreferPattern, 'i') : null;
    const resources = (dataset.resources ?? [])
      .map(resource => {
        const text = `${resource.format || ''} ${resource.name || ''} ${resource.description || ''} ${resource.mimetype || ''} ${resource.url || ''}`;
        if (resourceExcludePattern?.test(text)) {
          console.log(`  CKAN recurso descartado por categoría incompatible: ${resource.name || resource.url}`);
          return { resource, score: -1 };
        }
        const preferred = resourcePreferPattern?.test(text) ?? false;
        if (source.resourceRequirePreferPattern && resourcePreferPattern && !preferred) {
          console.log(`  CKAN recurso descartado por no corresponder a la zonificación territorial buscada: ${resource.name || resource.url}`);
          return { resource, score: -1 };
        }
        let score = formatPattern.test(text) ? 100 : 0;
        if (/geojson|geo\+json|\.geojson(?:\?|$)/i.test(text)) score += 100;
        if (preferred) score += 500;
        return { resource, score };
      })
      .filter(item => item.resource?.url && item.score > 0)
      .sort((a,b)=>b.score-a.score);
    for (const { resource } of resources) {
      try {
        const resourceTls = source.insecureTlsFallbackHost && new URL(resource.url).hostname === source.insecureTlsFallbackHost
          ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost }
          : {};
        const resourceResponse = await fetchWithRetry(resource.url, { headers: { Accept: 'application/geo+json,application/json,*/*' }, ...resourceTls }, `${source.municipality} CKAN GeoJSON`);
        if (!resourceResponse.ok) { lastError = new Error(`GeoJSON HTTP ${resourceResponse.status}`); continue; }
        const collection = await resourceResponse.json();
        if (collection?.type === 'FeatureCollection' && collection.features?.length) {
          console.log(`  CKAN GeoJSON selected: ${dataset.title || dataset.name} · ${resource.name || resource.format || 'GeoJSON'} · ${collection.features.length} elementos`);
          return collection;
        }
        lastError = new Error('El recurso CKAN no devolvió un FeatureCollection con elementos.');
      } catch (error) { lastError = error; }
    }
  }
  throw lastError ?? new Error('CKAN no expone un recurso GeoJSON utilizable para el conjunto solicitado.');
}

async function readArcGisOnlineSearch(source) {
  const endpoint = new URL(source.arcgisSearchUrl || 'https://www.arcgis.com/sharing/rest/search');
  endpoint.searchParams.set('f', 'json');
  endpoint.searchParams.set('num', '100');
  endpoint.searchParams.set('q', source.arcgisQuery || `${source.municipality} barris`);
  const response = await fetchWithRetry(endpoint, { headers: { Accept: 'application/json' } }, `${source.municipality} ArcGIS Online search`);
  if (!response.ok) throw new Error(`ArcGIS Online search HTTP ${response.status}`);
  const payload = await response.json();
  const results = payload?.results ?? [];
  if (!results.length) throw new Error('ArcGIS Online no devolvió elementos candidatos.');
  const pattern = new RegExp(source.layerPattern || 'barris?|barrios?', 'i');
  const ranked = results.map(item => {
    const text = `${item.title || ''} ${item.name || ''} ${item.type || ''} ${item.owner || ''}`;
    let score = pattern.test(text) ? 200 : 0;
    if (/feature service|map service/i.test(item.type || '')) score += 100;
    if (source.arcgisOwner && String(item.owner || '').toLocaleLowerCase() === String(source.arcgisOwner).toLocaleLowerCase()) score += 500;
    if (/limit barris/i.test(item.title || '')) score += 500;
    return { item, score };
  }).sort((a,b)=>b.score-a.score);
  let lastError;
  for (const { item, score } of ranked.slice(0, 15)) {
    if (score < 100) continue;
    try {
      let serviceUrl = item.url;
      if (!serviceUrl && item.id) {
        const metaUrl = new URL(`https://www.arcgis.com/sharing/rest/content/items/${item.id}`);
        metaUrl.searchParams.set('f','json');
        const metaResponse = await fetchWithRetry(metaUrl, { headers: { Accept: 'application/json' } }, `${source.municipality} ArcGIS item metadata`);
        if (metaResponse.ok) serviceUrl = (await metaResponse.json())?.url;
      }
      if (!serviceUrl || !/(FeatureServer|MapServer)/i.test(serviceUrl)) continue;
      const collection = await fetchBestArcGisLayer(serviceUrl, source);
      if (collection?.features?.length) {
        console.log(`  ArcGIS Online selected: ${item.title || item.id} · ${serviceUrl}`);
        return collection;
      }
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error('ArcGIS Online encontró candidatos, pero ninguno expuso una capa poligonal de barrios validable.');
}

async function readGeoJson(filePath) {
  const absolutePath = resolve(root, filePath);
  const data = await readFile(absolutePath, 'utf8');
  return JSON.parse(data);
}

async function readTextSource(source) {
  if (source.url) {
    const response = await fetchWithRetry(source.url, { headers: { Accept: 'application/xml,text/xml,application/vnd.google-earth.kml+xml,text/plain' } }, `${source.municipality} texto GIS`);
    if (!response.ok) throw new Error(`HTTP Error ${response.status} fetching ${source.url}`);
    return response.text();
  }
  if (!source.file) throw new Error(`Source [${source.id}] needs file or url.`);
  return readFile(resolve(root, source.file), 'utf8');
}

async function readKml(source) {
  const data = await readTextSource(source);
  const doc = new DOMParser().parseFromString(data, 'text/xml');
  return kml(doc);
}

async function readGml(source) {
  const data = await readTextSource(source);
  return parseGmlText(data, source.sourceCrs);
}


async function readCkanWkt(source) {
  const attempts = [];
  if (source.apiUrl) attempts.push({ kind: 'api', value: source.apiUrl });
  if (source.downloadUrl) attempts.push({ kind: 'csv', value: source.downloadUrl });
  if (source.file) attempts.push({ kind: 'file', value: source.file });
  let lastError;
  for (const attempt of attempts) {
    try {
      let records;
      if (attempt.kind === 'api') {
        const response = await fetchWithRetry(attempt.value, { headers: { Accept: 'application/json' } }, `${source.municipality} API`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        records = Array.isArray(payload?.value) ? payload.value
          : Array.isArray(payload?.result?.records) ? payload.result.records
            : Array.isArray(payload?.records) ? payload.records : undefined;
        if (!records) throw new Error('La API no devolvió una lista de registros reconocible.');
      } else {
        let bytes;
        if (attempt.kind === 'csv') {
          const response = await fetchWithRetry(attempt.value, { headers: { Accept: 'text/csv,text/plain' } }, `${source.municipality} CSV`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          bytes = new Uint8Array(await response.arrayBuffer());
        } else {
          bytes = new Uint8Array(await readFile(resolve(root, attempt.value)));
        }
        const encoding = source.encoding || 'windows-1252';
        const text = new TextDecoder(encoding).decode(bytes);
        records = parseDelimitedText(text, source.delimiter || ';');
      }
      const collection = recordsWithWktToGeoJson(records, source.geometryField);
      if (!collection.features.length) throw new Error('No se encontraron geometrías WKT poligonales.');
      if (attempt.kind !== 'api') console.log(`  CKAN fallback: ${attempt.kind === 'file' ? 'archivo local' : 'CSV descargable'}`);
      return collection;
    } catch (error) {
      lastError = error;
      if (attempt.kind !== 'file') console.warn(`  [WARN] CKAN ${attempt.kind} no disponible (${error.message}). Probando alternativa…`);
    }
  }
  throw lastError ?? new Error('No se pudo leer la fuente CKAN/WKT.');
}


function groupCode(value) {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  // ArcGIS puede serializar códigos numéricos como 01, 1.0 o incluso "1,0".
  // Los normalizamos para compararlos con la referencia oficial sin convertir
  // etiquetas arbitrarias en códigos por accidente.
  const numeric = raw.replace(',', '.');
  if (/^[+-]?\d+(?:\.0+)?$/.test(numeric)) return String(Number(numeric));
  return raw;
}

function polygonsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function groupArcGisCollection(collection, source) {
  const expected = (source.expectedGroupCodes ?? []).map(String);
  const groups = new Map();
  for (const feature of collection.features ?? []) {
    const code = groupCode(findFieldValue(feature.properties ?? {}, source.groupField));
    if (!code || !feature.geometry) continue;
    const list = groups.get(code) ?? [];
    list.push(feature);
    groups.set(code, list);
  }
  const found = [...groups.keys()].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const missing = expected.filter(code => !groups.has(code));
  const extra = found.filter(code => expected.length && !expected.includes(code));
  console.log(`  Agrupaciones ${source.groupField}: ${found.join(', ') || 'ninguna'}`);

  // Para reconstruir las zonas oficiales basta con que estén presentes TODOS los
  // códigos esperados. Códigos adicionales pueden corresponder a UMT rurales o sin
  // asignación en el mapa de zonas y no deben provocar que volvamos a mostrar UMT
  // individuales con nombres numéricos. Se ignoran, pero quedan avisados.
  if (extra.length) {
    console.warn(`  [WARN] ${source.municipality}: agrupaciones adicionales no incluidas en el mapa de referencia (${extra.join(', ')}). Se ignoran al construir las zonas oficiales.`);
  }
  if (expected.length && missing.length) {
    const detail = `faltan ${missing.join(', ')}`;
    if (source.fallbackToRawKind) {
      console.warn(`  [WARN] No se agrupan límites por seguridad (${detail}). Se conservarán las UMT individuales como ${source.fallbackToRawKind}.`);
      return {
        collection,
        effectiveSource: {
          ...source,
          type: 'arcgis',
          kind: source.fallbackToRawKind,
          nameField: source.fallbackNameField || 'nom',
          codeField: source.fallbackCodeField || 'id',
          minimumExpectedFeatures: undefined,
          groupAliases: undefined,
        },
        grouped: false,
      };
    }
    throw new Error(`Faltan códigos de agrupación de la referencia oficial (${detail}).`);
  }

  const features = expected.map(code => {
    const members = groups.get(code) ?? [];
    const polygons = members.flatMap(feature => polygonsFromGeometry(feature.geometry));
    const label = source.groupLabels?.[code];
    if (!label || !polygons.length) return undefined;
    const aliases = source.groupAliases?.[code] ?? [];
    return {
      type: 'Feature',
      properties: {
        __groupName: label,
        __groupCode: code,
        __aliases: aliases,
        __memberCount: members.length,
      },
      geometry: polygons.length === 1
        ? { type: 'Polygon', coordinates: polygons[0] }
        : { type: 'MultiPolygon', coordinates: polygons },
    };
  }).filter(Boolean);

  if (features.length !== expected.length) throw new Error(`La agrupación produjo ${features.length}/${expected.length} zonas; no se escribirá una geometría incompleta.`);
  console.log(`  ${features.length} zonas municipales reconstruidas a partir de UMT y códigos oficiales.`);
  return { collection: { type: 'FeatureCollection', features }, effectiveSource: source, grouped: true };
}

function normalizeEscapedUrls(text) {
  return String(text)
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u003[aA]/g, ':')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

function serviceUrlsInText(text, baseUrl) {
  const normalized = normalizeEscapedUrls(text);
  const found = new Set();
  const patterns = [
    /https?:[^"'<>\s]+\/(?:FeatureServer|MapServer)(?:\/\d+)?/gi,
    /https?:[^"'<>\s]*(?:service=WFS|\/WFSServer|\/wfs(?:[/?]|$)|\/ows(?:[/?]|$))[^"'<>\s]*/gi,
    /https?:[^"'<>\s]*(?:service=WMS|\/WMSServer|\/wms(?:[/?]|$)|\/ows(?:[/?]|$))[^"'<>\s]*/gi,
  ];
  for (const pattern of patterns) for (const value of normalized.match(pattern) ?? []) found.add(value);
  const relative = /["']([^"']*(?:FeatureServer|MapServer|WFSServer|WMSServer|service=WFS|service=WMS|\/wfs(?:[/?]|$)|\/wms(?:[/?]|$)|\/ows(?:[/?]|$))[^"']*)["']/gi;
  for (const match of normalized.matchAll(relative)) {
    try { found.add(new URL(match[1], baseUrl).toString()); } catch { /* ignore */ }
  }
  // Los documentos XML y algunos visores incluyen namespaces/esquemas OGC
  // (opengis.net, schemas.opengis.net) que contienen la palabra /wfs pero NO
  // son endpoints de datos. Nunca deben probarse como servidores.
  return [...found].filter(value => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host !== 'www.opengis.net' && host !== 'opengis.net' && host !== 'schemas.opengis.net';
    } catch { return false; }
  });
}

async function portalServiceUrls(rawUrl, source = {}) {
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const response = await fetchWithRetry(rawUrl, { headers: { Accept: 'text/html,application/xhtml+xml,*/*' }, ...tlsOption }, 'portal GIS');
  if (!response.ok) throw new Error(`Portal returned HTTP ${response.status}`);
  const html = await response.text();
  const found = new Set(serviceUrlsInText(html, rawUrl));
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map(match => {
      try { return new URL(match[1], rawUrl).toString(); } catch { return undefined; }
    })
    .filter(Boolean)
    .slice(0, 12);
  const scriptResults = await Promise.allSettled(scripts.map(async url => {
    const scriptResponse = await fetchWithRetry(url, { headers: { Accept: 'text/javascript,application/javascript,text/plain,*/*' }, ...tlsOption }, 'script del portal GIS');
    if (!scriptResponse.ok) return [];
    const text = await scriptResponse.text();
    return serviceUrlsInText(text.slice(0, 8_000_000), rawUrl);
  }));
  for (const result of scriptResults) if (result.status === 'fulfilled') for (const url of result.value) found.add(url);
  return [...found].slice(0, 40);
}

function scoreLayerName(name, patternText) {
  const text = String(name ?? '');
  const pattern = new RegExp(patternText || 'barris?|barrios?|neighbou?rhoods?', 'i');
  let score = pattern.test(text) ? 100 : 0;
  if (/barris?|barrios?|neighbou?rhoods?/i.test(text)) score += 60;
  if (/sector|seccio|section|carrer|street|postal/i.test(text)) score -= 50;
  return score;
}

async function fetchBestArcGisLayer(serviceUrl, source) {
  const layerMatch = serviceUrl.match(/\/(FeatureServer|MapServer)\/(\d+)\/?$/i);
  if (layerMatch) return fetchArcGis(serviceUrl, source);
  const clean = serviceUrl.replace(/\/$/, '');
  const tlsOption = source.insecureTlsFallbackHost ? { insecureTlsFallbackHost: source.insecureTlsFallbackHost } : {};
  const metaResponse = await fetchWithRetry(`${clean}?f=json`, { headers: { Accept: 'application/json' }, ...tlsOption }, 'metadatos ArcGIS');
  if (!metaResponse.ok) throw new Error(`ArcGIS metadata HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  const layers = (meta.layers ?? [])
    .map(layer => ({ ...layer, score: scoreLayerName(layer.name, source.layerPattern) }))
    .sort((a, b) => b.score - a.score);
  if (!layers.length || layers[0].score < 50) throw new Error('No se identificó una capa de barrios segura en el servicio ArcGIS.');
  console.log(`  Portal ArcGIS layer selected: ${layers[0].name} (${layers[0].id})`);
  return fetchArcGis(`${clean}/${layers[0].id}`, source);
}

async function readPortal(source) {
  const candidates = await portalServiceUrls(source.url, source);
  if (!candidates.length) throw new Error('El visor no expone enlaces WFS/WMS/ArcGIS visibles en HTML ni en sus scripts cargados.');
  console.log(`  Portal: ${candidates.length} servicio(s) GIS candidato(s) detectado(s).`);
  let lastError;
  for (const candidate of candidates) {
    if (/\/(FeatureServer|MapServer)(?:\/\d+)?\/?(?:\?|$)/i.test(candidate)) {
      try {
        const collection = await fetchBestArcGisLayer(candidate.split('?')[0], source);
        if (collection?.features?.length) return collection;
      } catch (error) { lastError = error; }
    }
    if (/service=WFS|\/WFSServer|\/wfs(?:[/?]|$)|\/ows(?:[/?]|$)/i.test(candidate)) {
      try {
        const collection = await fetchWfs({ ...source, url: candidate });
        if (collection?.features?.length) return collection;
      } catch (error) { lastError = error; }
    }
    if (/service=WMS|\/WMSServer|\/wms(?:[/?]|$)|\/ows(?:[/?]|$)/i.test(candidate)) {
      try {
        const collection = await fetchWms({ ...source, url: candidate, wfsProbe: false });
        if (collection?.features?.length) return collection;
      } catch (error) { lastError = error; }
    }
  }
  throw lastError ?? new Error('Se detectaron servicios GIS, pero ninguno devolvió una capa de barrios utilizable.');
}

function normalizeValidationName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ca')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(el|la|els|les|l)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validationNameMatches(actual, expected) {
  const a = normalizeValidationName(actual);
  const e = normalizeValidationName(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  // Las fuentes municipales pueden publicar un barrio dentro de una etiqueta
  // compuesta (p. ej. "Via Europa - La Llàntia" o "Peramàs-Esmandies").
  // Solo aceptamos coincidencia parcial con tokens de al menos 4 caracteres.
  return (e.length >= 4 && a.includes(e)) || (a.length >= 4 && e.includes(a));
}

function mergePolygonFeaturesWithSameId(features, source) {
  if (!source.mergeDuplicateNames) return features;
  const groups = new Map();
  for (const feature of features) {
    const group = groups.get(feature.id) ?? [];
    group.push(feature);
    groups.set(feature.id, group);
  }
  const merged = [];
  let mergedParts = 0;
  for (const group of groups.values()) {
    if (group.length === 1) { merged.push(group[0]); continue; }
    const polygonParts = [];
    for (const feature of group) {
      if (feature.geometry?.type === 'Polygon') polygonParts.push(feature.geometry.coordinates);
      else if (feature.geometry?.type === 'MultiPolygon') polygonParts.push(...feature.geometry.coordinates);
      else throw new Error(`${source.municipality}: no se puede fusionar un duplicado ${feature.id} porque no es Polygon/MultiPolygon.`);
    }
    const first = group[0];
    const codes = [...new Set(group.map(item => item?.properties?.code).filter(Boolean).map(String))];
    merged.push({
      ...first,
      properties: {
        ...first.properties,
        ...(codes.length > 1 ? { sourceCodes: codes } : {}),
        sourceParts: group.length,
      },
      geometry: polygonParts.length === 1
        ? { type: 'Polygon', coordinates: polygonParts[0] }
        : { type: 'MultiPolygon', coordinates: polygonParts },
    });
    mergedParts += group.length - 1;
  }
  if (mergedParts) console.log(`  ${source.municipality}: ${mergedParts} fragmentos repetidos se han unido por nombre en polígonos multipartes (${features.length} piezas -> ${merged.length} zonas).`);
  return merged;
}

function visitCoordinates(geometry, visitor) {
  if (!geometry?.coordinates) return;
  const walk = value => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      visitor(value[0], value[1]);
      return;
    }
    for (const child of value) walk(child);
  };
  walk(geometry.coordinates);
}

let municipalityCatalogPromise;
async function municipalityCatalog() {
  municipalityCatalogPromise ??= readFile(resolve(root, 'public/data/municipalities.json'), 'utf8').then(JSON.parse);
  return municipalityCatalogPromise;
}

function geometryBounds(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  visitCoordinates(geometry, (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

function transformGeometryCoordinates(geometry, transformPoint) {
  if (!geometry?.coordinates) return geometry;
  const walk = value => {
    if (!Array.isArray(value)) return value;
    if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      const transformed = transformPoint(Number(value[0]), Number(value[1]));
      if (!Array.isArray(transformed) || !Number.isFinite(transformed[0]) || !Number.isFinite(transformed[1])) {
        throw new Error('La transformación de coordenadas produjo valores no válidos.');
      }
      return [transformed[0], transformed[1], ...value.slice(2)];
    }
    return value.map(walk);
  };
  return { ...geometry, coordinates: walk(geometry.coordinates) };
}

function transformFeatureCollection(collection, transformPoint) {
  return {
    ...collection,
    features: (collection.features ?? []).map(feature => ({
      ...feature,
      geometry: feature.geometry ? transformGeometryCoordinates(feature.geometry, transformPoint) : feature.geometry,
    })),
  };
}

function collectionOutsideRatio(collection, municipalBounds, margin) {
  const [minX, minY, maxX, maxY] = municipalBounds;
  let total = 0;
  let outside = 0;
  for (const feature of collection.features ?? []) {
    visitCoordinates(feature.geometry, (x, y) => {
      total += 1;
      if (x < minX - margin || x > maxX + margin || y < minY - margin || y > maxY + margin) outside += 1;
    });
  }
  return { total, outside, ratio: total ? outside / total : 1 };
}

async function normalizeCollectionCoordinatesToMunicipality(source, collection) {
  if (!source.autoNormalizeCoordinatesToMunicipality) return collection;
  const catalog = await municipalityCatalog();
  const municipality = (catalog.municipalities || []).find(item => String(item.id) === String(source.municipalityId));
  const municipalBounds = geometryBounds(municipality?.geometry);
  if (!municipalBounds) return collection;
  const margin = Number(source.validationBboxMargin ?? 0.01);

  const candidates = [
    ...(source.wmsKmlPixelCoordinates ? [{
      name: `píxeles WMS ${Number(source.wmsKmlPixelWidth ?? 2048)}×${Number(source.wmsKmlPixelHeight ?? 2048)} -> bbox municipal`,
      transform: (x, y) => {
        const width = Number(source.wmsKmlPixelWidth ?? 2048);
        const height = Number(source.wmsKmlPixelHeight ?? 2048);
        const [minX, minY, maxX, maxY] = municipalBounds;
        return [
          minX + (x / width) * (maxX - minX),
          maxY - (y / height) * (maxY - minY),
        ];
      },
    }] : []),
    { name: 'sin transformación', transform: (x, y) => [x, y] },
    { name: 'ejes X/Y invertidos', transform: (x, y) => [y, x] },
    { name: 'ETRS89 / UTM 31N (EPSG:25831)', transform: (x, y) => proj4('EPSG:25831', 'EPSG:4326', [x, y]) },
    { name: 'ETRS89 / UTM 31N con ejes invertidos', transform: (x, y) => proj4('EPSG:25831', 'EPSG:4326', [y, x]) },
    { name: 'ED50 / UTM 31N (EPSG:23031)', transform: (x, y) => proj4('EPSG:23031', 'EPSG:4326', [x, y]) },
    { name: 'ED50 / UTM 31N con ejes invertidos', transform: (x, y) => proj4('EPSG:23031', 'EPSG:4326', [y, x]) },
    { name: 'WGS84 / UTM 31N (EPSG:32631)', transform: (x, y) => proj4('EPSG:32631', 'EPSG:4326', [x, y]) },
    { name: 'WGS84 / UTM 31N con ejes invertidos', transform: (x, y) => proj4('EPSG:32631', 'EPSG:4326', [y, x]) },
    { name: 'Web Mercator (EPSG:3857)', transform: (x, y) => proj4('EPSG:3857', 'EPSG:4326', [x, y]) },
    { name: 'Web Mercator con ejes invertidos', transform: (x, y) => proj4('EPSG:3857', 'EPSG:4326', [y, x]) },
  ];

  const evaluated = [];
  for (const candidate of candidates) {
    try {
      const transformed = candidate.name === 'sin transformación' ? collection : transformFeatureCollection(collection, candidate.transform);
      const score = collectionOutsideRatio(transformed, municipalBounds, margin);
      evaluated.push({ ...candidate, transformed, ...score });
    } catch {
      // Candidato incompatible con los valores recibidos: se ignora.
    }
  }
  if (!evaluated.length) return collection;
  evaluated.sort((a,b) => a.ratio - b.ratio || candidates.findIndex(item => item.name === a.name) - candidates.findIndex(item => item.name === b.name));
  const best = evaluated[0];
  const identity = evaluated.find(item => item.name === 'sin transformación');
  if (best.ratio <= 0.01 && best.name !== 'sin transformación' && (!identity || best.ratio + 0.05 < identity.ratio)) {
    const rawBounds = geometryBounds(collection.features?.find(feature => feature.geometry)?.geometry);
    console.log(`  Coordenadas normalizadas automáticamente: ${best.name} · ${best.outside}/${best.total} vértices fuera tras transformar${rawBounds ? ` · muestra bbox crudo ${rawBounds.map(value => Number(value).toFixed(3)).join(',')}` : ''}.`);
    return best.transformed;
  }
  if (best.ratio > 0.01) {
    const rawBounds = geometryBounds(collection.features?.find(feature => feature.geometry)?.geometry);
    const ranking = evaluated.slice(0, 4).map(item => `${item.name}: ${(item.ratio*100).toFixed(1)}% fuera`).join(' · ');
    console.warn(`  [COORDENADAS] ${source.municipality}: ninguna transformación segura encaja todavía${rawBounds ? ` · bbox crudo ${rawBounds.map(value => Number(value).toFixed(3)).join(',')}` : ''} · mejores candidatos: ${ranking}.`);
  }
  return collection;
}

async function validateProcessedFeatures(source, features) {
  if (source.expectedFeatureCount !== undefined && features.length !== source.expectedFeatureCount) {
    throw new Error(`${source.municipality}: se esperaban exactamente ${source.expectedFeatureCount} ${source.kind || 'zonas'} y llegaron ${features.length}.`);
  }

  if (source.expectedAnchorNames?.length) {
    const actualNames = features.map(feature => feature?.properties?.name).filter(Boolean);
    const missing = source.expectedAnchorNames.filter(expected => !actualNames.some(actual => validationNameMatches(actual, expected)));
    if (missing.length) {
      const available = [...new Set(actualNames.map(String))].sort((a,b)=>a.localeCompare(b,'ca')).slice(0,60);
      throw new Error(`${source.municipality}: la capa no supera la validación de nombres. Faltan: ${missing.join(', ')}. Nombres recibidos: ${available.join(' | ')}.`);
    }
  }

  if (source.requirePolygonGeometry) {
    const invalid = features.filter(feature => !['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
    if (invalid.length) throw new Error(`${source.municipality}: ${invalid.length} elementos no son Polygon/MultiPolygon.`);
  }

  if (source.validateWithinMunicipalityBbox) {
    const catalog = await municipalityCatalog();
    const municipality = (catalog.municipalities || []).find(item => String(item.id) === String(source.municipalityId));
    const municipalBounds = geometryBounds(municipality?.geometry);
    if (!municipalBounds) throw new Error(`${source.municipality}: no se pudo obtener el límite municipal para validar la descarga.`);
    const [minX, minY, maxX, maxY] = municipalBounds;
    const margin = Number(source.validationBboxMargin ?? 0.01);
    let total = 0;
    let outside = 0;
    for (const feature of features) {
      visitCoordinates(feature.geometry, (x, y) => {
        total += 1;
        if (x < minX - margin || x > maxX + margin || y < minY - margin || y > maxY + margin) outside += 1;
      });
    }
    if (!total || outside / total > 0.01) {
      throw new Error(`${source.municipality}: la geometría descargada queda fuera del término municipal (${outside}/${total} vértices fuera del margen).`);
    }
  }
}

async function processSource(source) {
  let rawCollection;
  let effectiveSource = source;
  console.log(`Processing source [${source.id}] - ${source.municipality}...`);
  
  try {
    if (source.type === 'arcgis') {
      rawCollection = await fetchArcGis(source.url, source);
    } else if (source.type === 'arcgis-service') {
      const endpoints = [source.url, ...(source.fallbackUrls ?? [])];
      let lastArcGisError;
      for (const endpoint of endpoints) {
        try {
          rawCollection = await fetchBestArcGisLayer(endpoint, source);
          if (rawCollection?.features?.length) break;
        } catch (error) {
          lastArcGisError = error;
          console.warn(`  [REINTENTO FUENTE] ${source.municipality}: ${endpoint} -> ${error.message}`);
        }
      }
      if (!rawCollection?.features?.length) throw lastArcGisError ?? new Error('Ningún servicio ArcGIS candidato devolvió datos.');
    } else if (source.type === 'arcgis-grouped') {
      const raw = await fetchArcGis(source.url, source);
      const grouped = groupArcGisCollection(raw, source);
      rawCollection = grouped.collection;
      effectiveSource = grouped.effectiveSource;
    } else if (source.type === 'wfs') {
      rawCollection = await fetchWfs(source);
    } else if (source.type === 'wms') {
      rawCollection = await fetchWms(source);
    } else if (source.type === 'shapefile') {
      rawCollection = await readShapefile(source);
    } else if (source.type === 'kml') {
      rawCollection = await readKml(source);
    } else if (source.type === 'gml' || source.type === 'xml') {
      rawCollection = await readGml(source);
    } else if (source.type === 'ckan-wkt' || source.type === 'csv-wkt') {
      rawCollection = await readCkanWkt(source);
    } else if (source.type === 'ckan-geojson') {
      rawCollection = await readCkanGeoJson(source);
    } else if (source.type === 'arcgis-online-search') {
      rawCollection = await readArcGisOnlineSearch(source);
    } else if (source.type === 'reus-geoapi') {
      rawCollection = await readReusGeoApi(source);
    } else if (source.type === 'portal') {
      rawCollection = await readPortal(source);
    } else if (source.type === 'geojson') {
      if (source.url) {
        const response = await fetchWithRetry(source.url, { headers: { Accept: 'application/geo+json,application/json' } }, `${source.municipality} GeoJSON`);
        rawCollection = await response.json();
      } else {
        rawCollection = await readGeoJson(source.file);
      }
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
  } catch (err) {
    throw new Error(`Failed to load source [${source.id}]: ${err.message}`);
  }

  if (!rawCollection || !rawCollection.features || rawCollection.features.length === 0) {
    throw new Error(`Source [${source.id}] returned an empty FeatureCollection.`);
  }

  rawCollection = await normalizeCollectionCoordinatesToMunicipality(effectiveSource, rawCollection);

  const detectedNameField = inferNameField(rawCollection, effectiveSource);
  const resolvedNameField = effectiveSource.nameField ?? detectedNameField;
  const features = [];
  let missingName = 0;
  let missingGeometry = 0;
  
  for (const feature of rawCollection.features) {
    const props = feature.properties || {};
    
    const name = findFieldValue(props, resolvedNameField, COMMON_NAME_FIELDS);
    
    if (!name || String(name).trim() === '') {
      missingName += 1;
      continue;
    }

    if (!feature.geometry) {
      missingGeometry += 1;
      continue;
    }

    const originalName = String(name).trim().replace(/\s+/g, ' ');
    // Algunas fuentes SHP antiguas no incluyen .cpg y shpjs puede reemplazar
    // caracteres acentuados por U+FFFD. Cuando el Ayuntamiento publica una
    // lista cerrada y conocida, permitimos un mapa explícito fuente->nombre
    // canónico. No hacemos correcciones heurísticas globales.
    const canonicalName = effectiveSource.canonicalNameMap?.[originalName] ?? originalName;
    const cleanName = displayName(canonicalName, effectiveSource.nameCase);
    const officialName = findFieldValue(props, effectiveSource.officialNameField) ?? originalName;
    const parentName = findFieldValue(props, effectiveSource.parentNameField);
    const district = findFieldValue(props, effectiveSource.districtField);
    const code = findFieldValue(props, effectiveSource.codeField) ?? findFieldValue(props, 'objectid');

    const kind = effectiveSource.kind || 'zone';
    
    const id = `${source.municipalityId}--${kind}--${slug(cleanName)}`;

    const normalizedFeature = {
      type: 'Feature',
      id,
      properties: {
        name: cleanName,
        officialName: String(officialName).trim(),
        municipality: source.municipality,
        kind,
        quality: effectiveSource.quality || (effectiveSource.official === false ? 'community' : 'official'),
        ...(effectiveSource.sourceCategory ? { sourceCategory: String(effectiveSource.sourceCategory) } : {}),
        ...(parentName ? { parentName: String(parentName).trim() } : {}),
        ...(district ? { district: String(district).trim() } : {}),
        ...(code ? { code: String(code).trim() } : {}),
        ...((findFieldValue(props, '__aliases') ?? []).length ? { aliases: findFieldValue(props, '__aliases') } : {})
      },
      geometry: feature.geometry
    };

    features.push(normalizedFeature);
  }

  if (effectiveSource.mergeDuplicateNames) {
    const merged = mergePolygonFeaturesWithSameId(features, effectiveSource);
    features.length = 0;
    features.push(...merged);
  }

  if (effectiveSource.filterToExpectedNames && effectiveSource.expectedNames?.length) {
    const before = features.length;
    const allowed = features.filter(feature => effectiveSource.expectedNames.some(expected => validationNameMatches(feature?.properties?.name, expected)));
    features.length = 0;
    features.push(...allowed);
    if (before !== features.length) {
      console.log(`  ${source.municipality}: ${before - features.length} elemento(s) fuera de la lista municipal de barrios se han descartado antes de validar.`);
    }
  }

  if (features.length === 0) {
    const keys = samplePropertyKeys(rawCollection).join(', ');
    const examples = (rawCollection.features ?? []).slice(0, 3).map(feature => JSON.stringify(feature?.properties ?? {})).join(' | ');
    throw new Error(`Source [${source.id}] resulted in 0 valid features after processing. missingName=${missingName}, missingGeometry=${missingGeometry}. Campos recibidos: ${keys || 'ninguno'}. Ejemplos: ${examples.slice(0, 1200)}`);
  }
  if (missingName || missingGeometry) {
    const details = [`${rawCollection.features.length} polígonos recibidos`, `${features.length} válidos`];
    if (missingName) details.push(`${missingName} sin nombre`);
    if (missingGeometry) details.push(`${missingGeometry} sin geometría`);
    console.warn(`  [WARN] ${source.municipality}: ${details.join(' · ')}`);
  }
  if (effectiveSource.minimumExpectedFeatures && features.length < effectiveSource.minimumExpectedFeatures) {
    const message = `${source.municipality}: cobertura oficial incompleta (${features.length}/${effectiveSource.minimumExpectedFeatures} mínimo esperado).`;
    if (effectiveSource.requireMinimumExpectedFeatures) throw new Error(message);
    console.warn(`  [WARN] ${message}`);
  }
  if (Array.isArray(effectiveSource.requiredNames) && effectiveSource.requiredNames.length) {
    const available = new Set(features.map(feature => slug(feature.properties.name)));
    const missingRequired = effectiveSource.requiredNames.filter(name => !available.has(slug(name)));
    if (missingRequired.length) {
      throw new Error(`${source.municipality}: la capa candidata no contiene barrios de control esperados (${missingRequired.join(', ')}). No se escribirá.`);
    }
  }

  await validateProcessedFeatures(effectiveSource, features);

  return {
    sourceConfig: source,
    features
  };
}

async function main() {
  const configData = await readFile(configPath, 'utf8');
  const allSources = JSON.parse(configData);
  const args = process.argv.slice(2);
  const softFail = args.includes('--soft-fail');
  const requested = new Set(args.filter(arg => !arg.startsWith('--')));
  const sources = requested.size ? allSources.filter(source => requested.has(source.id)) : allSources;
  if (!sources.length) throw new Error(`No configured sources match: ${[...requested].join(', ')}`);
  
  // Group results by municipality
  const municipalitiesData = {};

  for (const source of sources) {
    let result;
    try {
      result = await processSource(source);
    } catch (error) {
      if (source.allowUnavailable || softFail) {
        console.warn(`  [WARN] ${source.municipality}: ${error.message} Fuente opcional omitida; no se escriben límites inventados.`);
        continue;
      }
      throw error;
    }
    
    if (!municipalitiesData[source.municipality]) {
      municipalitiesData[source.municipality] = {
        municipalityId: source.municipalityId,
        sourceTitle: source.sourceTitle,
        sourceOrganization: source.sourceOrganization,
        official: source.official !== false,
        preserveExistingKinds: [],
        features: []
      };
    }
    const preserveKinds = Array.isArray(source.preserveExistingKinds) ? source.preserveExistingKinds : [];
    municipalitiesData[source.municipality].preserveExistingKinds = [...new Set([
      ...(municipalitiesData[source.municipality].preserveExistingKinds ?? []),
      ...preserveKinds,
    ])];
    municipalitiesData[source.municipality].features.push(...result.features);
  }

  // Algunas ciudades publican dos niveles territoriales oficiales en servicios distintos.
  // Cuando una fuente nueva declara preserveExistingKinds, se conservan únicamente esos
  // tipos de la capa local anterior y solo si no han sido reconstruidos ya en esta ejecución.
  // Esto permite, por ejemplo, añadir los barrios reales de Tarragona sin perder sus 11
  // zonas municipales amplias si el servicio UMT sufre una caída temporal.
  for (const [municipality, data] of Object.entries(municipalitiesData)) {
    const preserveKinds = data.preserveExistingKinds ?? [];
    if (!preserveKinds.length) continue;
    const targetFile = resolve(targetDir, `${slug(municipality)}.geojson`);
    if (!existsSync(targetFile)) continue;
    try {
      const previous = JSON.parse(await readFile(targetFile, 'utf8'));
      const existingIds = new Set(data.features.map(feature => feature.id));
      const preserved = (previous.features ?? []).filter(feature =>
        preserveKinds.includes(feature?.properties?.kind) &&
        feature?.properties?.quality === 'official' &&
        !existingIds.has(feature?.id)
      );
      if (preserved.length) {
        data.features.push(...preserved);
        console.log(`  ${municipality}: se conservan ${preserved.length} polígonos oficiales previos (${preserveKinds.join(', ')}) como respaldo de nivel territorial.`);
      }
    } catch (error) {
      console.warn(`  [WARN] ${municipality}: no se pudo conservar la capa territorial previa (${error.message}).`);
    }
  }

  routeSantCugatAndValldoreix(municipalitiesData);
  await mkdir(targetDir, { recursive: true });

  // Escritura en dos fases: primero se valida y prepara TODO en temporales.
  // Solo después se hacen copias de seguridad y se sustituyen los activos.
  const plans = [];
  const transactionId = `${Date.now()}-${process.pid}`;
  for (const [municipality, data] of Object.entries(municipalitiesData)) {
    const idSet = new Set();
    for (const f of data.features) {
      if (idSet.has(f.id)) throw new Error(`Duplicate ID detected in ${municipality}: ${f.id}`);
      idSet.add(f.id);
    }

    const collection = {
      type: 'FeatureCollection',
      municipality,
      source: {
        organization: data.sourceOrganization,
        title: data.sourceTitle,
        official: data.official !== false,
        accessedAt: new Date().toISOString().split('T')[0]
      },
      features: data.features
    };

    const targetFile = resolve(targetDir, `${slug(municipality)}.geojson`);
    const pendingFile = `${targetFile}.pending-${transactionId}`;
    await writeFile(pendingFile, `${JSON.stringify(collection)}\n`, 'utf8');
    plans.push({ municipality, data, targetFile, pendingFile, backupFile: undefined, existed: existsSync(targetFile) });
  }

  try {
    // No se toca ningún activo hasta que TODOS los temporales han sido creados.
    for (const plan of plans) plan.backupFile = await backupExistingFile(plan.targetFile);
    for (const plan of plans) await copyFile(plan.pendingFile, plan.targetFile);
  } catch (error) {
    console.error('  ERROR durante la escritura. Restaurando el estado anterior…');
    for (const plan of plans) {
      try {
        if (plan.backupFile) await copyFile(plan.backupFile, plan.targetFile);
        else if (!plan.existed && existsSync(plan.targetFile)) await unlink(plan.targetFile);
      } catch (restoreError) {
        console.error(`  No se pudo restaurar ${plan.municipality}: ${restoreError.message}`);
      }
    }
    throw error;
  } finally {
    for (const plan of plans) {
      try { if (existsSync(plan.pendingFile)) await unlink(plan.pendingFile); } catch { /* limpieza best effort */ }
    }
  }

  for (const { municipality, data } of plans) {
    const byKind = {};
    for (const f of data.features) byKind[f.properties.kind] = (byKind[f.properties.kind] || 0) + 1;
    const summary = Object.entries(byKind).map(([kind, count]) => `${count} ${kind}s`).join(' + ');
    console.log(`${municipality}: ${summary} OK`);
  }
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
