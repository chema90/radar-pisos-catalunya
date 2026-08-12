import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalogPath = path.join(root, 'public/data/municipalities.json');
const liveDir = path.join(root, 'public/data/amb-aem');
const candidateDir = path.join(root, 'public/data/amb-aem-candidates');
const reportDir = path.join(root, 'data/reports');
const rawDir = path.join(root, 'data/raw');
const rawPath = path.join(rawDir, 'amb-aem.geojson');
const layer = process.env.AMB_AEM_LAYER_URL ?? 'https://geoportal.amb.cat/geoserveis/rest/services/PEstrategica/mascara_ambits_estadistics_3857/MapServer/1';
const query = `${layer}/query?${new URLSearchParams({
  where: '1=1',
  outFields: 'cod_barri,nom,codi_ine,nommuni,pob_23,area_ha',
  returnGeometry: 'true',
  outSR: '4326',
  f: 'geojson',
})}`;

const AMB_MUNICIPALITY_IDS = new Set([
  '080155','089045','082520','080193','080207','080543','080569','082665','080689','080728','080734','081580',
  '081691','080771','080898','081017','089058','081234','081252','081265','081574','081803','081944','081960',
  '082009','082042','082055','082114','082172','082212','082634','082444','082457','082824','082896','083015',
]);

// Sant Cugat dispone de una capa municipal específica de barrios.
// Sus AEM se conservan solo dentro del bruto AMB para auditoría; no se generan
// como candidato ni se pueden promover, evitando confundir ámbitos estadísticos con barrios.
const APPLY_BLOCKED_IDS = new Set(['082055']);
const DOCUMENTED_AEM_COUNT = 268;

const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function fetchWithRetries(url, attempts = 3) {
  let last;
  for (let index = 1; index <= attempts; index += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/geo+json,application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      last = error;
      if (index < attempts) await new Promise(resolve => setTimeout(resolve, 1000 * index));
    }
  }
  throw last;
}

function validPolygon(feature) {
  return feature?.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type) && String(feature?.properties?.nom ?? '').trim();
}

function normalizedCollection(municipality, features) {
  return {
    type: 'FeatureCollection',
    municipality: municipality.name,
    source: {
      organization: 'Àrea Metropolitana de Barcelona',
      title: 'Àmbits Estadístics Metropolitans',
      official: true,
      accessedAt: today(),
    },
    features: features.map(feature => ({
      type: 'Feature',
      id: `${municipality.id}--amb-aem--${slug(String(feature.properties.nom))}`,
      properties: {
        name: String(feature.properties.nom).trim(),
        municipality: municipality.name,
        kind: 'zone',
        quality: 'official',
        sourceCategory: 'amb-aem',
        code: feature.properties.cod_barri == null ? undefined : String(feature.properties.cod_barri),
      },
      geometry: feature.geometry,
    })),
  };
}

async function readFeatureCount(file) {
  try {
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(payload.features) ? payload.features.length : 0;
  } catch {
    return 0;
  }
}

async function promoteCandidates(catalog) {
  let stagedValidCount = 0;
  try {
    const raw = JSON.parse(await fs.readFile(rawPath, 'utf8'));
    stagedValidCount = (raw.features ?? []).filter(validPolygon).length;
  } catch {
    throw new Error('No existe el bruto AMB usado para preparar los candidatos. Ejecuta primero npm run zones:amb.');
  }
  if (stagedValidCount !== DOCUMENTED_AEM_COUNT && !process.argv.includes('--allow-count-mismatch')) {
    throw new Error(`BLOQUEO DE SEGURIDAD: la documentación oficial AMB indica ${DOCUMENTED_AEM_COUNT} AEM, pero la capa descargada contiene ${stagedValidCount} polígonos válidos. Los candidatos NO se promoverán hasta revisar la discrepancia.`);
  }
  await fs.mkdir(liveDir, { recursive: true });
  const backupDir = path.join(root, 'data/backups/amb-aem', stamp());
  let promoted = 0;
  let backedUp = 0;
  const rows = [];
  for (const municipality of catalog.municipalities.filter(m => AMB_MUNICIPALITY_IDS.has(m.id))) {
    const name = `${slug(municipality.name)}.geojson`;
    const candidate = path.join(candidateDir, name);
    const live = path.join(liveDir, name);
    const candidateCount = await readFeatureCount(candidate);
    if (!candidateCount) {
      rows.push({ municipality: municipality.name, id: municipality.id, status: 'SIN_CANDIDATO', candidateCount: 0 });
      continue;
    }
    if (APPLY_BLOCKED_IDS.has(municipality.id)) {
      rows.push({ municipality: municipality.name, id: municipality.id, status: 'BLOQUEADO_FUENTE_MUNICIPAL_PREFERENTE', candidateCount });
      continue;
    }
    const oldCount = await readFeatureCount(live);
    if (oldCount) {
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(live, path.join(backupDir, name));
      backedUp += 1;
    }
    await fs.copyFile(candidate, live);
    promoted += 1;
    rows.push({ municipality: municipality.name, id: municipality.id, status: oldCount ? 'ACTUALIZADO' : 'NUEVO', oldCount, candidateCount });
  }
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `amb-aem-apply-${today()}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), promoted, backedUp, backupDir: backedUp ? backupDir : null, rows }, null, 2)}\n`);
  console.log(`AMB AEM: ${promoted} candidatos promovidos. ${backedUp} copias anteriores respaldadas.`);
  console.log(`Informe: ${path.relative(root, reportPath)}`);
}

async function stageCandidates(catalog) {
  const municipalitiesByIne = new Map(catalog.municipalities.map(m => [m.id.slice(0, 5), m]));
  const payload = await fetchWithRetries(query);
  if (payload.type !== 'FeatureCollection') throw new Error('AMB no devolvió un FeatureCollection.');
  const valid = payload.features.filter(validPolygon);
  if (valid.length < 200) throw new Error(`Cobertura AMB sospechosamente baja: ${valid.length} polígonos.`);
  const countMismatch = valid.length !== DOCUMENTED_AEM_COUNT;
  if (countMismatch) {
    console.warn(`  [AVISO AMB] La documentación oficial indica ${DOCUMENTED_AEM_COUNT} AEM, pero la capa viva ha devuelto ${valid.length}. Se preparan solo como candidatos y queda BLOQUEADA su promoción automática.`);
  }

  await fs.mkdir(candidateDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(rawPath, JSON.stringify(payload));

  const groups = new Map();
  for (const feature of valid) {
    const ine = String(feature.properties?.codi_ine ?? '').trim().padStart(5, '0');
    const municipality = municipalitiesByIne.get(ine);
    if (!municipality || !AMB_MUNICIPALITY_IDS.has(municipality.id)) continue;
    if (!groups.has(municipality.id)) groups.set(municipality.id, { municipality, features: [] });
    groups.get(municipality.id).features.push(feature);
  }
  if (groups.size !== 36) throw new Error(`AMB ha producido ${groups.size} municipios; se esperaban exactamente 36 municipios metropolitanos.`);

  const rows = [];
  for (const { municipality, features } of groups.values()) {
    if (APPLY_BLOCKED_IDS.has(municipality.id)) {
      rows.push({
        id: municipality.id,
        municipality: municipality.name,
        candidateCount: features.length,
        currentAmbCount: 0,
        candidateFile: null,
        status: 'BLOQUEADO_SIN_FICHERO_CANDIDATO',
        note: 'Sant Cugat usa su capa municipal de barrios. Los AEM permanecen únicamente en el bruto AMB para auditoría.',
      });
      continue;
    }
    const target = path.join(candidateDir, `${slug(municipality.name)}.geojson`);
    const live = path.join(liveDir, `${slug(municipality.name)}.geojson`);
    const collection = normalizedCollection(municipality, features);
    await fs.writeFile(target, `${JSON.stringify(collection)}
`);
    rows.push({
      id: municipality.id,
      municipality: municipality.name,
      candidateCount: features.length,
      currentAmbCount: await readFeatureCount(live),
      candidateFile: path.relative(root, target),
      status: 'CANDIDATO',
    });
  }

  rows.sort((a, b) => a.municipality.localeCompare(b.municipality, 'ca'));
  const reportPath = path.join(reportDir, `amb-aem-candidates-${today()}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: layer,
    validPolygons: valid.length,
    municipalityCount: groups.size,
    mode: 'CANDIDATE_ONLY',
    documentedAemCount: DOCUMENTED_AEM_COUNT,
    countMismatch,
    note: 'No se ha sustituido ninguna capa municipal ni ningún AMB activo. Sant Cugat no genera ni fichero candidato: sus AEM quedan solo en el bruto AMB para auditoría.',
    rows,
  }, null, 2)}\n`);

  console.log(`AMB AEM: ${valid.length} polígonos válidos, 36 municipios.`);
  console.log(`CANDIDATOS preparados para 35 municipios en ${path.relative(root, candidateDir)}. Sant Cugat queda excluido. No se ha sustituido ningún dato activo.`);
  console.log(`Informe: ${path.relative(root, reportPath)}`);
  console.log('Para promoverlos conscientemente: npm run zones:amb:apply');
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  if (process.argv.includes('--apply')) return promoteCandidates(catalog);
  return stageCandidates(catalog);
}

main().catch(error => { console.error(`ERROR AMB AEM: ${error.message}`); process.exitCode = 1; });
