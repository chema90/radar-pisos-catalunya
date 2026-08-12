export type DiscoveredLayer = {
  id: string;
  title: string;
  kind: 'WFS' | 'ArcGIS';
  importUrl: string;
  sourceUrl: string;
  detail?: string;
};

export type SourceCheck = {
  url: string;
  status: 'available' | 'limited' | 'unavailable';
  checkedAt: string;
  detail: string;
};

type MonitorSource = { url: string; directUrl?: string };
const CHECK_KEY = 'radar-pisos-source-checks-v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const layerTerms = /barri|barrio|neighbou?r|district|districte|zona|ve[iï]nal|unitat|secci[oó]/i;

function loadChecks(): Record<string, SourceCheck> {
  try { return JSON.parse(localStorage.getItem(CHECK_KEY) ?? '{}') as Record<string, SourceCheck>; } catch { return {}; }
}

function saveCheck(check: SourceCheck) {
  localStorage.setItem(CHECK_KEY, JSON.stringify({ ...loadChecks(), [check.url]: check }));
}

export function getSourceCheck(url: string): SourceCheck | undefined { return loadChecks()[url]; }

export async function checkSource(url: string): Promise<SourceCheck> {
  let check: SourceCheck;
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json,text/xml,text/html,*/*' } });
    check = { url, status: response.ok ? 'available' : 'unavailable', checkedAt: new Date().toISOString(), detail: response.ok ? `Disponible · HTTP ${response.status}` : `HTTP ${response.status}` };
  } catch {
    check = { url, status: 'limited', checkedAt: new Date().toISOString(), detail: 'No comprobable desde el navegador (CORS o red)' };
  }
  saveCheck(check);
  return check;
}

export async function monitorOfficialSources(sources: MonitorSource[], force = false): Promise<void> {
  const unique = [...new Set(sources.map(source => source.directUrl ?? source.url))];
  await Promise.allSettled(unique.map(url => {
    const previous = getSourceCheck(url);
    return !force && previous && Date.now() - Date.parse(previous.checkedAt) < WEEK ? Promise.resolve(previous) : checkSource(url);
  }));
}

function childText(node: Element, localName: string): string {
  return [...node.childNodes].find(child => 'localName' in child && child.localName === localName)?.textContent?.trim() ?? '';
}

export function parseWfsCapabilities(xmlText: string, serviceUrl: string): DiscoveredLayer[] {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  if ([...xml.getElementsByTagName('*')].some(node => ['parsererror', 'Exception'].includes(node.localName))) throw new Error('El servicio no devolvió unas capacidades WFS válidas.');
  const root = xml.documentElement;
  const version = root.getAttribute('version') ?? '2.0.0';
  const all: DiscoveredLayer[] = [];
  [...xml.getElementsByTagName('*')].filter(node => node.localName === 'FeatureType').forEach((node, index) => {
    const name = childText(node, 'Name');
    const title = childText(node, 'Title') || name;
    if (!name) return;
    const url = new URL(serviceUrl);
    url.search = '';
    url.searchParams.set('service', 'WFS');
    url.searchParams.set('version', version);
    url.searchParams.set('request', 'GetFeature');
    url.searchParams.set(version.startsWith('2') ? 'typeNames' : 'typeName', name);
    url.searchParams.set('outputFormat', 'application/json');
    url.searchParams.set('srsName', 'EPSG:4326');
    all.push({ id: `wfs-${index}-${name}`, title, kind: 'WFS', importUrl: url.toString(), sourceUrl: serviceUrl, detail: name });
  });
  const candidates = all.filter(item => layerTerms.test(`${item.title} ${item.detail}`));
  return (candidates.length ? candidates : all).slice(0, 40);
}

function arcgisImportUrl(serviceUrl: string, layerId: number | string): string {
  return `${serviceUrl.replace(/\/$/, '')}/${layerId}`;
}

async function discoverArcGis(serviceUrl: string): Promise<DiscoveredLayer[]> {
  const clean = serviceUrl.replace(/\/$/, '').replace(/\/\d+$/, '');
  const response = await fetch(`${clean}?f=json`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`ArcGIS respondió con ${response.status}.`);
  const payload = await response.json() as { layers?: Array<{ id: number; name: string; geometryType?: string }>; name?: string };
  const layers = (payload.layers ?? []).map(layer => ({
    id: `arcgis-${layer.id}`,
    title: layer.name,
    kind: 'ArcGIS' as const,
    importUrl: arcgisImportUrl(clean, layer.id),
    sourceUrl: clean,
    detail: layer.geometryType,
  }));
  const candidates = layers.filter(layer => layerTerms.test(layer.title));
  return (candidates.length ? candidates : layers).slice(0, 40);
}


async function discoverArcGisDirectory(directoryUrl: string): Promise<DiscoveredLayer[]> {
  const clean = directoryUrl.replace(/\/$/, '');
  const response = await fetch(`${clean}?f=json`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`El directorio ArcGIS respondió con ${response.status}.`);
  const payload = await response.json() as { services?: Array<{ name: string; type: string }>; folders?: string[] };
  const direct = (payload.services ?? []).filter(service => /FeatureServer|MapServer/i.test(service.type));
  const folderResults = await Promise.allSettled((payload.folders ?? []).slice(0, 12).map(folder => fetch(`${clean}/${encodeURIComponent(folder)}?f=json`).then(async result => {
    if (!result.ok) return [] as Array<{ name: string; type: string }>;
    const folderPayload = await result.json() as { services?: Array<{ name: string; type: string }> };
    return folderPayload.services ?? [];
  })));
  const nested = folderResults.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const services = [...direct, ...nested.filter(service => /FeatureServer|MapServer/i.test(service.type))];
  const prioritized = [...services.filter(service => layerTerms.test(service.name)), ...services.filter(service => !layerTerms.test(service.name))].slice(0, 30);
  const base = clean.match(/^(.*\/rest\/services)/i)?.[1] ?? clean;
  const results = await Promise.allSettled(prioritized.map(service => discoverArcGis(`${base}/${service.name}/${service.type}`)));
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []).slice(0, 50);
}
function capabilityUrl(rawUrl: string): string {

  const url = new URL(rawUrl);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('request', 'GetCapabilities');
  return url.toString();
}

function serviceUrlsInText(text: string, baseUrl: string): string[] {
  const normalized = text
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u003[aA]/g, ':')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
  const found = new Set<string>();
  const patterns = [/https?:[^"'<>\s]+\/(?:FeatureServer|MapServer)(?:\/\d+)?/gi, /https?:[^"'<>\s]*(?:service=WFS|\/WFSServer)[^"'<>\s]*/gi];
  patterns.forEach(pattern => normalized.match(pattern)?.forEach(value => found.add(value)));
  const relative = /["']([^"']*(?:FeatureServer|MapServer|WFSServer|service=WFS)[^"']*)["']/gi;
  for (const match of normalized.matchAll(relative)) {
    try { found.add(new URL(match[1], baseUrl).toString()); } catch { /* enlace no válido */ }
  }
  return [...found];
}

async function urlsFromPortal(rawUrl: string): Promise<string[]> {
  const response = await fetch(rawUrl, { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`El geoportal respondió con ${response.status}.`);
  const html = await response.text();
  const found = new Set(serviceUrlsInText(html, rawUrl));

  // Muchos visores modernos (EnMapa, SPAs municipales) cargan las URL GIS desde JS,
  // por lo que no basta con inspeccionar el HTML inicial.
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map(match => {
      try { return new URL(match[1], rawUrl).toString(); } catch { return undefined; }
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);
  const results = await Promise.allSettled(scripts.map(async scriptUrl => {
    const script = await fetch(scriptUrl, { headers: { Accept: 'text/javascript,application/javascript,text/plain,*/*' } });
    if (!script.ok) return [] as string[];
    const text = await script.text();
    return serviceUrlsInText(text.slice(0, 8_000_000), rawUrl);
  }));
  results.forEach(result => {
    if (result.status === 'fulfilled') result.value.forEach(value => found.add(value));
  });
  return [...found].slice(0, 40);
}

export async function discoverGeoLayers(rawUrl: string): Promise<DiscoveredLayer[]> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('Introduce una URL completa del geoportal, WFS o servicio ArcGIS.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL debe usar HTTP o HTTPS.');
  try {
    if (/\/(FeatureServer|MapServer)(?:\/\d+)?\/?$/i.test(url.pathname)) return discoverArcGis(url.toString());
    if (/\/rest\/services(?:\/[^/]+)?\/?$/i.test(url.pathname)) return discoverArcGisDirectory(url.toString());
    if (/service=WFS|\/WFSServer/i.test(url.toString())) {
      const endpoint = capabilityUrl(url.toString());
      const response = await fetch(endpoint, { headers: { Accept: 'text/xml,application/xml' } });
      if (!response.ok) throw new Error(`WFS respondió con ${response.status}.`);
      return parseWfsCapabilities(await response.text(), url.toString());
    }
    const discovered = await urlsFromPortal(url.toString());
    if (!discovered.length) throw new Error('No se han encontrado servicios WFS o ArcGIS en el HTML ni en los scripts del visor. Si el portal usa una API propietaria, necesitaremos su endpoint de descarga o el archivo GIS.');
    const results = await Promise.allSettled(discovered.map(candidate => discoverGeoLayers(candidate)));
    return results.flatMap(result => result.status === 'fulfilled' ? result.value : []).slice(0, 50);
  } catch (error) {
    if (error instanceof TypeError) throw new Error('El geoportal no permite ser analizado desde el navegador (CORS). Abre sus herramientas de descarga y pega aquí la URL WFS o ArcGIS directa.');
    throw error;
  }
}
