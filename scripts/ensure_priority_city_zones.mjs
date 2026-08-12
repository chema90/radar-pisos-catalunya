import { copyFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const checks = [
  { ids: ['sabadell-barris'], file: 'public/data/municipality-zones/sabadell.geojson', min: 40, exact: 40, kind: 'barri', label: 'Sabadell', anchorNames: ['Centre','Covadonga','Creu Alta','Gràcia','Can Rull'] },
  { ids: ['terrassa-barris'], file: 'public/data/municipality-zones/terrassa.geojson', min: 30, kind: 'barri', label: 'Terrassa' },
  { ids: ['hospitalet-barris'], file: 'public/data/municipality-zones/l-hospitalet-de-llobregat.geojson', min: 13, kind: 'barri', label: "L'Hospitalet" },
  { ids: ['tarragona-barris','tarragona-zones-umt'], file: 'public/data/municipality-zones/tarragona.geojson', min: 10, kind: 'barri', label: 'Tarragona', anchorNames: ['Part Alta','Campclar','Bonavista','Sant Salvador','Sant Pere i Sant Pau'] },
  { ids: ['esplugues-barris'], file: 'public/data/municipality-zones/esplugues-de-llobregat.geojson', min: 10, kind: 'barri', label: 'Esplugues' },
  { ids: ['vilanova-barris'], file: 'public/data/municipality-zones/vilanova-i-la-geltru.geojson', min: 18, exact: 18, kind: 'barri', label: 'Vilanova i la Geltrú', expectedNames: ['Barri de Mar','Can Marquès','Casernes','Centrevila','Fondo Somella',"L'Aragai","L'Armanyà",'La Collada - Els Sis Camins','La Geltrú','Masia Nova','Molí de Vent','Nucli Antic','Plaça de La Sardana','Prat de Vilanova','Ribes Roges','Sant Joan','Santa Maria','Tacó'] },
  { ids: ['lleida-barris'], file: 'public/data/municipality-zones/lleida.geojson', min: 12, kind: 'barri', label: 'Lleida', anchorNames: ['Centre Històric','Cappont','La Bordeta','Magraners','Pardinyes','Balàfia','Secà de Sant Pere','La Mariola'] },
  { ids: ['mataro-barris'], file: 'public/data/municipality-zones/mataro.geojson', min: 11, kind: 'barri', label: 'Mataró', anchorNames: ['Centre','Eixample','Rocafonda','Cerdanyola','Cirera','La Llàntia','Peramàs',"Pla d'en Boet"] },
  { ids: ['reus-barris'], file: 'public/data/municipality-zones/reus.geojson', min: 5, kind: 'barri', label: 'Reus' },
  { ids: ['granollers-barris'], file: 'public/data/municipality-zones/granollers.geojson', min: 16, exact: 16, kind: 'barri', label: 'Granollers', expectedNames: ['Can Mònic','Lledoner',"L'Hostal",'Granollers Nord','Can Gili','Congost','Ponent','Granollers Centre','Joan Prim Centre','Font Verda','Instituts','Sota el Camí Ral','Tres Torres','Sant Miquel','Can Bassa','Palou'] },
  { ids: ['mollet-barris'], file: 'public/data/municipality-zones/mollet-del-valles.geojson', min: 13, kind: 'barri', label: 'Mollet del Vallès', anchorNames: ['Gallecs','Plana Lledó','Riera Seca','Can Borrell','Santa Rosa'] },
  { ids: ['vic-barris'], file: 'public/data/municipality-zones/vic.geojson', min: 14, kind: 'barri', label: 'Vic', anchorNames: ['Remei','Estadi','Sant Anna','La Calla','Caputxins','Sucre','Nord','La Guixa'] },
  { ids: ['manresa-barris'], file: 'public/data/municipality-zones/manresa.geojson', min: 8, kind: 'barri', label: 'Manresa' },
  { ids: ['olot-barris'], file: 'public/data/municipality-zones/olot.geojson', min: 3, kind: 'barri', label: 'Olot' },
  { ids: ['vendrell-barris'], file: 'public/data/municipality-zones/el-vendrell.geojson', min: 3, kind: 'barri', label: 'el Vendrell' },
  { ids: ['lloret-zones'], file: 'public/data/municipality-zones/lloret-de-mar.geojson', min: 3, kind: 'zone', label: 'Lloret de Mar', allowRecovery: false },
  { ids: ['viladecans-barris'], file: 'public/data/municipality-zones/viladecans.geojson', min: 5, kind: 'barri', label: 'Viladecans' },
  { importer: 'scripts/import_rubi_ambits.mjs', forceRefresh: true, file: 'public/data/municipality-zones/rubi.geojson', min: 9, exact: 9, kind: 'zone', label: 'Rubí', expectedNames: ['Àmbito 5 · Ca n\'Oriol + Can Rosés','Àmbito 6 · El Mercat + Plana Can Bertran + Sector Z','Àmbito 2 · Castellnou - Can Mir + Can Solà + Can Barceló - Vallespark + Sant Muç','Àmbito 1 · Can Fatjó + Sant Jordi Park + Can Serrafosà - La Perla + Can Ximelis + Els Avets','Àmbito 4 · Centre + Plana del Castell','Àmbito 5 · El Pinar + Zona Nord - La Serreta','Àmbito 3 · 25 de Setembre','Àmbito 6 · Progrés - Rubí 2000','Àmbito 3 · Les Torres + Ca n\'Alzamora + Can Vallhonrat'] },
  { ids: ['sant-cugat-barris'], file: 'public/data/municipality-zones/sant-cugat-del-valles.geojson', min: 43, minTotal: 53, kind: 'barri', label: 'Sant Cugat', attemptImport: false, anchorNames: ['Centre','Volpelleres','Mira-sol','Coll Favà','Parc Central','Can Barata','Les Planes','Sant Francesc','Monestir','Can Cabassa'], forbiddenNames: ['Aqualonga',"Ca n’Enric La Miranda",'Can Cadena','Colònia Montserrat','La Barceloneta','La Guinardera - Can Casulleras','Can Casulleras','Can Casulleres','Les Bobines','Mas Fuster','Mas Roig','Monmany','Montmany','Regadiu','Rossinyol','Sant Jaume'] },
  { importer: 'scripts/import_sant_andreu_barris.mjs', forceRefresh: true, file: 'public/data/municipality-zones/sant-andreu-de-la-barca.geojson', min: 8, exact: 8, kind: 'barri', label: 'Sant Andreu de la Barca', expectedNames: ['Can Prats','El Centre','El Palau','La Colònia','La Plana','La Solana','Nucli Antic',"Pla de l'Estació"] },
  { ids: [], file: 'public/data/municipality-zones/valldoreix.geojson', min: 13, exact: 13, kind: 'barri', label: 'Valldoreix EMD', attemptImport: false, anchorNames: ['Aqualonga',"Ca n’Enric La Miranda",'Can Cadena','Colònia Montserrat','La Barceloneta','Can Casulleres','Les Bobines','Mas Fuster','Mas Roig','Montmany','Regadiu','Rossinyol','Sant Jaume'] },
];

function normalizedName(value) {
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

function nameMatches(actual, expected) {
  const a=normalizedName(actual), e=normalizedName(expected);
  if(!a||!e)return false;
  if(a===e)return true;
  return (e.length>=4&&a.includes(e))||(a.length>=4&&e.includes(a));
}

async function statsAt(path, kind, expectedNames, anchorNames, forbiddenNames) {
  if (!existsSync(path)) return { total: 0, matching: 0, namedCoverage: 0, anchorCoverage: 0, forbiddenCoverage: 0 };
  try {
    const payload = JSON.parse(await readFile(path, 'utf8'));
    const features = Array.isArray(payload.features) ? payload.features : [];
    const matchingFeatures = features.filter(feature => feature?.properties?.kind === kind);
    const actualNames = matchingFeatures.map(feature => feature?.properties?.name).filter(Boolean);
    const expected = [...new Set(expectedNames ?? [])];
    const anchors = [...new Set(anchorNames ?? [])];
    const namedCoverage = expected.length ? expected.filter(name => actualNames.some(actual => nameMatches(actual,name))).length : matchingFeatures.length;
    const anchorCoverage = anchors.length ? anchors.filter(name => actualNames.some(actual => nameMatches(actual,name))).length : 0;
    const forbidden = [...new Set(forbiddenNames ?? [])];
    const forbiddenCoverage = forbidden.length ? forbidden.filter(name => actualNames.some(actual => nameMatches(actual,name))).length : 0;
    return { total: features.length, matching: matchingFeatures.length, namedCoverage, anchorCoverage, forbiddenCoverage };
  } catch {
    return { total: 0, matching: 0, namedCoverage: 0, anchorCoverage: 0, forbiddenCoverage: 0 };
  }
}
async function stats(file, kind, expectedNames, anchorNames, forbiddenNames) {
  return statsAt(resolve(root, file), kind, expectedNames, anchorNames, forbiddenNames);
}
function coverageIsValid(check, result) {
  if (result.matching < check.min) return false;
  if (check.minTotal !== undefined && result.total < check.minTotal) return false;
  if (check.exact !== undefined && result.matching !== check.exact) return false;
  if ((check.expectedNames?.length ?? 0) && result.namedCoverage < check.expectedNames.length) return false;
  if ((check.anchorNames?.length ?? 0) && result.anchorCoverage < check.anchorNames.length) return false;
  if ((check.forbiddenNames?.length ?? 0) && result.forbiddenCoverage > 0) return false;
  return true;
}
async function recoverFromPreviousVersions(check) {
  if (check.allowRecovery === false) return false;
  const current = await stats(check.file, check.kind, check.expectedNames, check.anchorNames, check.forbiddenNames);
  if (coverageIsValid(check, current)) return false;
  const parent = dirname(root);
  let entries=[];
  try { entries=await readdir(parent,{withFileTypes:true}); } catch { return false; }
  const candidates=[];
  for(const entry of entries){
    if(!entry.isDirectory())continue;
    if(entry.name===basename(root))continue;
    if(!/^radar_pisos_catalunya_integrado_v\d+/i.test(entry.name))continue;
    const candidatePath=resolve(parent,entry.name,check.file);
    const candidate=await statsAt(candidatePath,check.kind,check.expectedNames,check.anchorNames,check.forbiddenNames);
    if(coverageIsValid(check,candidate)){
      candidates.push({name:entry.name,path:candidatePath,count:candidate.matching});
    }
  }
  candidates.sort((a,b)=>b.count-a.count||b.name.localeCompare(a.name,'es'));
  const best=candidates[0];
  if(!best)return false;
  await copyFile(best.path,resolve(root,check.file));
  console.log(`${check.label}: recuperada capa local válida de ${best.name} (${best.count} ${check.kind}).`);
  return true;
}

const recoverOnly=process.argv.includes('--recover-only');
for(const check of checks) await recoverFromPreviousVersions(check);
if(recoverOnly){ console.log('Recuperación local de capas terminada.'); process.exit(0); }

let attempted = 0;
for (const check of checks) {
  const before = await stats(check.file, check.kind, check.expectedNames, check.anchorNames, check.forbiddenNames);
  if (coverageIsValid(check, before) && !check.forceRefresh) {
    console.log(`${check.label}: ${before.matching} ${check.kind} · OK`);
    continue;
  }

  if (check.attemptImport === false) {
    if (check.label === 'Sant Cugat') {
      console.warn('Sant Cugat: PENDIENTE · falta o no valida la capa nativa auditada local. Por seguridad no se sustituye automáticamente desde el WFS protegido.');
    } else if (check.label === 'Valldoreix EMD') {
      console.warn('Valldoreix: PENDIENTE · falta o no valida la capa local auditada de la EMD. No se mezcla con Sant Cugat.');
    }
    continue;
  }

  attempted += 1;
  console.log(check.forceRefresh
    ? `${check.label}: comprobando actualización de la fuente oficial (${before.matching}/${check.min}).`
    : `${check.label}: cobertura ${check.kind} incompleta (${before.matching}/${check.min}). Intentando actualizar fuente oficial…`);
  const importer = check.importer ?? 'scripts/import_zones.mjs';
  const args = [...process.execArgv, resolve(root, importer), ...(check.importer ? [] : ['--soft-fail', ...check.ids])];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  const after = await stats(check.file, check.kind, check.expectedNames, check.anchorNames, check.forbiddenNames);

  if (result.status === 0 && coverageIsValid(check, after)) {
    console.log(`${check.label}: actualizada (${after.matching} ${check.kind}).`);
    continue;
  }

  if (check.label === 'Tarragona' && after.total > 0) {
    console.warn(`Tarragona: no se pudo validar todavía la capa municipal de barrios. Se conservan ${after.total} polígonos municipales existentes y las 11 zonas amplias siguen protegidas si estaban disponibles.`);
  } else if (check.label === 'Esplugues') {
    console.warn('Esplugues: PENDIENTE · el geoportal municipal no ha expuesto todavía una capa vectorial de los 10 barrios que supere la validación. Se mantienen los 10 nombres oficiales + ICGC, sin inventar polígonos.');
  } else if (check.label === 'Vilanova i la Geltrú') {
    console.warn('Vilanova: PENDIENTE · se ha habilitado TLS controlado solo para gis.vilanova.cat, pero la capa BARRIS solo se guardará si el servidor entrega geometría vectorial WFS/GML/KML validable. Se conservan los 18 nombres oficiales + ICGC.');
  } else if (check.label === 'Lloret de Mar') {
    console.warn('Lloret de Mar: PENDIENTE · no se ha encontrado una zonificación territorial adecuada. Las secciones/distritos censales, electorales o sanitarios se descartan expresamente y no se presentan como barrios o zonas vecinales. ICGC queda como referencia de núcleos/urbanizaciones.');
  } else if (['Granollers','Mollet del Vallès','Vic','Manresa','Olot','el Vendrell','Viladecans'].includes(check.label)) {
    console.warn(`${check.label}: PENDIENTE · el portal/servicio oficial no ha entregado todavía una capa vectorial de barrios que supere la validación. Se conservan los nombres/referencias conocidas y no se inventan límites.`);
  } else if (check.label === 'Sant Cugat') {
    console.warn('Sant Cugat: PENDIENTE · se espera la capa municipal de Barris. AMB está bloqueado aquí para no mezclar ámbitos estadísticos ni barrios de Valldoreix.');
  } else if (check.label === 'Valldoreix EMD') {
    console.warn('Valldoreix: PENDIENTE · no se han obtenido todavía los 13 barrios oficiales como polígonos. Se conservan sus nombres oficiales y no se mezclan con Sant Cugat.');
  } else {
    console.warn(`${check.label}: PENDIENTE · la fuente municipal no pudo validarse ahora (red, formato o geometría). No se ha sustituido nada; ICGC queda como respaldo.`);
  }
}
if (!attempted) console.log('Fuentes municipales prioritarias ya preparadas.');
