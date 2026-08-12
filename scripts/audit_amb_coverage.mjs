import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'public/data/municipalities.json'), 'utf8'));
const AMB_IDS = new Set([
  '080155','089045','082520','080193','080207','080543','080569','082665','080689','080728','080734','081580',
  '081691','080771','080898','081017','089058','081234','081252','081265','081574','081803','081944','081960',
  '082009','082042','082055','082114','082172','082212','082634','082444','082457','082824','082896','083015',
]);
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function inspect(file) {
  try {
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    const features = Array.isArray(payload.features) ? payload.features : [];
    return {
      count: features.length,
      official: Boolean(payload.source?.official),
      title: payload.source?.title ?? '',
      officialFeatures: features.filter(f => f?.properties?.quality === 'official' && f?.properties?.sourceCategory !== 'amb-aem').length,
      ambFeatures: features.filter(f => f?.properties?.sourceCategory === 'amb-aem').length,
    };
  } catch {
    return { count: 0, official: false, title: '', officialFeatures: 0, ambFeatures: 0 };
  }
}

const rows = [];
for (const municipality of catalog.municipalities.filter(m => AMB_IDS.has(m.id))) {
  const file = `${slug(municipality.name)}.geojson`;
  const municipal = await inspect(path.join(root, 'public/data/municipality-zones', file));
  const liveAmb = await inspect(path.join(root, 'public/data/amb-aem', file));
  const candidateAmb = await inspect(path.join(root, 'public/data/amb-aem-candidates', file));
  let decision = 'AMB_RECOMENDADO';
  if (municipality.id === '082055') decision = 'ESPERAR_BARRIOS_MUNICIPALES';
  else if (municipal.officialFeatures > 0 && municipal.official) decision = 'MUNICIPAL_PRIORITARIA';
  else if (candidateAmb.count > 0) decision = 'REVISAR_CANDIDATO_AMB';
  else if (liveAmb.count > 0) decision = 'AMB_ACTIVO';
  rows.push({
    id: municipality.id,
    municipality: municipality.name,
    municipalFeatures: municipal.count,
    municipalOfficialFeatures: municipal.officialFeatures,
    municipalSource: municipal.title || null,
    ambActiveFeatures: liveAmb.count,
    ambCandidateFeatures: candidateAmb.count,
    decision,
  });
}
rows.sort((a, b) => a.municipality.localeCompare(b.municipality, 'ca'));
const report = { generatedAt: new Date().toISOString(), municipalityCount: rows.length, rows };
await fs.mkdir(path.join(root, 'data/reports'), { recursive: true });
const jsonPath = path.join(root, 'data/reports/amb-coverage-audit.json');
await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
const explanations = {
  MUNICIPAL_PRIORITARIA: 'USAR MUNICIPAL: ya existe una división municipal oficial válida.',
  REVISAR_CANDIDATO_AMB: 'REVISAR AMB: hay una propuesta AMB descargada, todavía no activa.',
  AMB_ACTIVO: 'AMB ACTIVO: ya existe una copia AMB activa.',
  AMB_RECOMENDADO: 'AMB POSIBLE: no hay una capa municipal oficial validada; AMB puede servir como respaldo.',
  ESPERAR_BARRIOS_MUNICIPALES: 'NO USAR AMB: Sant Cugat tiene una capa municipal específica de barrios; hay que importar esa capa correctamente.',
};
const txtLines = [
  'INFORME AMB - RADAR DE PISOS',
  '============================',
  '',
  'Este informe NO activa ni sustituye datos. Solo indica qué fuente conviene revisar.',
  '',
  ...rows.flatMap(row => [
    `${row.municipality}`,
    `  Barrios/zonas municipales guardados: ${row.municipalFeatures}${row.municipalOfficialFeatures ? ' (oficiales)' : ''}`,
    `  Zonas AMB candidatas: ${row.ambCandidateFeatures}`,
    `  Decisión: ${explanations[row.decision] ?? row.decision}`,
    '',
  ]),
];
const txtPath = path.join(root, 'data/reports/LEER_INFORME_AMB.txt');
await fs.writeFile(txtPath, `${txtLines.join('\n')}\n`);
console.log('Municipio\tMunicipal\tAMB activo\tAMB candidato\tDecisión');
for (const row of rows) console.log(`${row.municipality}\t${row.municipalFeatures}${row.municipalOfficialFeatures ? ' oficial' : ''}\t${row.ambActiveFeatures}\t${row.ambCandidateFeatures}\t${row.decision}`);
console.log(`\nInforme técnico: ${path.relative(root, jsonPath)}`);
console.log(`Informe para leer: ${path.relative(root, txtPath)}`);
