import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import proj4 from 'proj4';

const root = resolve(import.meta.dirname, '..');
const jsonSourceUrls = process.env.DIBA_SETTLEMENTS_JSON_URL
  ? [process.env.DIBA_SETTLEMENTS_JSON_URL]
  : [
      // Recurso JSON publicado actualmente en el portal de datos abiertos DIBA.
      'https://dadesobertes.diba.cat/node/790/download',
      // URL histórica/directa: se conserva solo como segundo intento.
      'https://incendis.diba.cat/fitxers/DadesObertes/json/UrbanitzacionsNuclis.json',
    ];
const shpSourceUrl = process.env.DIBA_SETTLEMENTS_URL || 'https://incendis.diba.cat/fitxers/DadesObertes/shp/UrbanitzacionsNuclis_shp.zip';
const targetDir = resolve(root, 'public/data/municipality-zones');
const backupDir = resolve(root, 'data/backups/diba-settlements');
const catalog = JSON.parse(await readFile(resolve(root, 'public/data/municipalities.json'), 'utf8'));
const extraTargetIds = new Set(['083054','082401','083073','080728','080771']); // Vilafranca, Sant Sadurní, Vilanova, Corbera, Esplugues
const targets = (catalog.municipalities ?? []).filter(m => m.county === 'Maresme' || extraTargetIds.has(String(m.id)));

const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function visitCoords(geometry, fn) {
  if (!geometry?.coordinates) return;
  const walk = node => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') fn(node[0], node[1]);
    else for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
}

const EPSG25831 = '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs +type=crs';

function firstCoordinate(geometry) {
  let found;
  visitCoords(geometry, (x, y) => { if (!found) found = [x, y]; });
  return found;
}

function transformCoordinates(node, transform) {
  if (!Array.isArray(node)) return node;
  if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
    const [x, y] = transform(node[0], node[1]);
    return [x, y, ...node.slice(2)];
  }
  return node.map(child => transformCoordinates(child, transform));
}

function transformGeometry(geometry, transform) {
  if (!geometry?.coordinates) return geometry;
  return { ...geometry, coordinates: transformCoordinates(geometry.coordinates, transform) };
}

function normalizeSourceCrs(features) {
  const sample = features.map(feature => firstCoordinate(feature?.geometry)).find(Boolean);
  if (!sample) return features;
  const [x, y] = sample;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    if (x >= -1 && x <= 4.5 && y >= 40 && y <= 43.5) {
      console.log(`DIBA: coordenadas WGS84 detectadas (${x.toFixed(5)}, ${y.toFixed(5)}). No hace falta reproyección.`);
      return features;
    }
    if (x >= 40 && x <= 43.5 && y >= -1 && y <= 4.5) {
      console.log(`DIBA: coordenadas geográficas con ejes invertidos detectadas (${x.toFixed(5)}, ${y.toFixed(5)}). Corrigiendo a longitud/latitud.`);
      return features.map(feature => ({ ...feature, geometry: transformGeometry(feature.geometry, (px, py) => [py, px]) }));
    }
    throw new Error(`Coordenadas geográficas DIBA fuera del ámbito esperado de Catalunya (${x}, ${y}). No se escribe nada.`);
  }
  // La cartografía territorial de Barcelona se distribuye habitualmente en
  // ETRS89 / UTM zona 31N. Si shpjs no ha aplicado el .prj, la convertimos aquí.
  if (x > 150000 && x < 800000 && y > 4300000 && y < 4900000) {
    console.log(`DIBA: ETRS89 / UTM 31N detectado (${Math.round(x)}, ${Math.round(y)}). Reproyectando a WGS84 antes de asignar municipios.`);
    const transformed = features.map(feature => ({
      ...feature,
      geometry: transformGeometry(feature.geometry, (px, py) => proj4(EPSG25831, 'EPSG:4326', [px, py])),
    }));
    const check = firstCoordinate(transformed[0]?.geometry);
    if (!check || check[0] < -1 || check[0] > 4.5 || check[1] < 40 || check[1] > 43.5) {
      throw new Error(`La reproyección DIBA produjo coordenadas fuera de Catalunya (${check?.join(', ') || 'sin coordenadas'}). No se escribe nada.`);
    }
    return transformed;
  }
  throw new Error(`Sistema de coordenadas DIBA no reconocido (muestra ${x}, ${y}). No se escribe nada para evitar asignaciones erróneas.`);
}
function bbox(geometry) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  visitCoords(geometry,(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)});
  return Number.isFinite(minX)?[minX,minY,maxX,maxY]:undefined;
}
function pointInRing([x,y], ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    const hit=((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/((yj-yi)||1e-15)+xi;
    if(hit) inside=!inside;
  }
  return inside;
}
function pointInGeometry(point, geometry) {
  if (geometry?.type === 'Polygon') {
    const [outer,...holes]=geometry.coordinates;
    return pointInRing(point,outer) && !holes.some(r=>pointInRing(point,r));
  }
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.some(poly=>pointInGeometry(point,{type:'Polygon',coordinates:poly}));
  return false;
}
function samplePoints(geometry, max=80) {
  const pts=[]; visitCoords(geometry,(x,y)=>pts.push([x,y]));
  if (pts.length<=max) return pts;
  const step=pts.length/max; return Array.from({length:max},(_,i)=>pts[Math.floor(i*step)]);
}

function ringCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return undefined;
  let area2=0, cx=0, cy=0;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const [x0,y0]=ring[j], [x1,y1]=ring[i];
    const cross=x0*y1-x1*y0;
    area2+=cross; cx+=(x0+x1)*cross; cy+=(y0+y1)*cross;
  }
  if (Math.abs(area2) < 1e-15) return undefined;
  return [cx/(3*area2), cy/(3*area2)];
}
function representativePoints(geometry) {
  const pts=[];
  const addPolygon = poly => {
    const outer=poly?.[0];
    const centroid=ringCentroid(outer);
    if (centroid) pts.push(centroid);
    if (outer?.length) {
      const stride=Math.max(1,Math.floor(outer.length/24));
      for(let i=0;i<outer.length;i+=stride){
        const p=outer[i], q=outer[(i+stride)%outer.length];
        pts.push(p);
        if(q)pts.push([(p[0]+q[0])/2,(p[1]+q[1])/2]);
      }
    }
  };
  if(geometry?.type==='Polygon') addPolygon(geometry.coordinates);
  else if(geometry?.type==='MultiPolygon') for(const poly of geometry.coordinates) addPolygon(poly);
  const b=bbox(geometry); if(b)pts.push([(b[0]+b[2])/2,(b[1]+b[3])/2]);
  return pts.filter(Boolean);
}
function field(props, names) {
  const entries=Object.entries(props??{}); const map=new Map(entries.map(([k,v])=>[norm(k),v]));
  for(const name of names){ const v=map.get(norm(name)); if(v!==undefined && String(v).trim()) return v; }
}

console.log('Diputació de Barcelona · núcleos/urbanizaciones (fuente de referencia, NO barrios).');
console.log(`Municipios objetivo: ${targets.length} (${targets.filter(m=>m.county==='Maresme').length} del Maresme + Vilafranca + Sant Sadurní + Vilanova + Corbera + Esplugues).`);
function sourceHasUsableAttributes(features) {
  const sample=(features??[]).slice(0,Math.min(120,features.length));
  if(!sample.length)return false;
  const usable=sample.filter(feature=>{
    const props=feature?.properties??{};
    return field(props,['Codi','CODI','Nom','NOM','name','nombre','Urbanitzac','Urbanitzacio','Urbanització'])!==undefined
      || field(props,['Mapid','MAPID','mapid','Urb_id','URB_ID'])!==undefined;
  }).length;
  return usable >= Math.max(3, Math.ceil(sample.length*0.25));
}
function propertyDiagnostics(features) {
  const keys=[...new Set((features??[]).slice(0,20).flatMap(f=>Object.keys(f?.properties??{})))];
  const examples=(features??[]).slice(0,3).map(f=>JSON.stringify(f?.properties??{})).join(' | ');
  return `campos=${keys.join(', ')||'ninguno'} · ejemplos=${examples.slice(0,700)}`;
}
async function downloadFeatures() {
  const failures=[];
  for(const jsonSourceUrl of jsonSourceUrls){
    try {
      const response=await fetch(jsonSourceUrl,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/geo+json,application/json,*/*'}});
      if(response.ok){
        const payload=await response.json();
        const features=(payload?.type==='FeatureCollection'?payload.features:Array.isArray(payload)?payload:payload?.features)??[];
        const polygons=features.filter(f=>['Polygon','MultiPolygon'].includes(f?.geometry?.type));
        if(polygons.length>=20 && sourceHasUsableAttributes(polygons)){
          console.log(`Fuente DIBA JSON: ${polygons.length} polígonos recibidos con atributos.`);
          return polygons;
        }
        failures.push(`JSON ${jsonSourceUrl} no utilizable (${polygons.length} polígonos; ${propertyDiagnostics(polygons)})`);
      } else failures.push(`JSON ${jsonSourceUrl} HTTP ${response.status}`);
    } catch(error) { failures.push(`JSON ${jsonSourceUrl} ${error?.cause?.code||error.message}`); }
  }
  try {
    const { default: shp } = await import('shpjs');
    const response=await fetch(shpSourceUrl,{signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed=await shp(await response.arrayBuffer());
    const polygons=(Array.isArray(parsed)?parsed.flatMap(c=>c.features??[]):parsed.features??[]).filter(f=>['Polygon','MultiPolygon'].includes(f?.geometry?.type));
    if(polygons.length>=20 && sourceHasUsableAttributes(polygons)){
      console.log(`Fuente DIBA SHP: ${polygons.length} polígonos recibidos con atributos.`);
      return polygons;
    }
    failures.push(`SHP no utilizable (${polygons.length} polígonos; ${propertyDiagnostics(polygons)})`);
  } catch(error) { failures.push(`SHP ${error?.cause?.code||error.message}`); }
  throw new Error(`No se pudo obtener una capa DIBA con geometría Y atributos (${failures.join(' · ')}). No se ha modificado nada.`);
}
const downloadedFeatures=await downloadFeatures();
const rawFeatures=normalizeSourceCrs(downloadedFeatures);

const targetMeta=targets.map(m=>({m,bbox:bbox(m.geometry)})).filter(x=>x.bbox && x.m.geometry);
const assigned=new Map(targets.map(m=>[String(m.id),[]]));
let unassigned=0;
for(const feature of rawFeatures){
  const fb=bbox(feature.geometry); if(!fb) continue;
  const candidates=targetMeta.filter(({bbox:b})=>!(fb[2]<b[0]||fb[0]>b[2]||fb[3]<b[1]||fb[1]>b[3]));
  if(!candidates.length) continue;
  const points=representativePoints(feature.geometry);
  let best, bestScore=0;
  for(const c of candidates){
    const inside=points.reduce((n,p)=>n+(pointInGeometry(p,c.m.geometry)?1:0),0);
    // Un solo punto representativo dentro del término ya es una señal fuerte:
    // los términos municipales no se solapan y las urbanizaciones pueden tocar
    // o cruzar ligeramente el límite administrativo. El algoritmo anterior
    // exigía 35% de los vértices y descartaba zonas correctas en bordes.
    const score=inside;
    if(score>bestScore){best=c.m;bestScore=score;}
  }
  if(!best || bestScore<1){
    unassigned++;
    if(unassigned<=20){
      const props=feature.properties??{};
      const debugName=field(props,['Codi','CODI','Nom','NOM','name','nombre','Urbanitzac','Urbanitzacio','Urbanització'])??'(sin nombre)';
      console.warn(`  [DIBA sin asignar] ${debugName} · bbox ${fb.map(v=>Number(v).toFixed(5)).join(',')} · candidatos: ${candidates.map(c=>c.m.name).join(' | ')||'ninguno'}`);
    }
    continue;
  }
  const props=feature.properties??{};
  const name=field(props,['Codi','CODI','Nom','NOM','name','nombre','Urbanitzac','Urbanitzacio','Urbanització']);
  if(!name) continue;
  const type=field(props,['Tipus','TIPUS','Tipo','TYPE']);
  const mapid=field(props,['Mapid','MAPID','mapid','Urb_id','URB_ID','Id','ID']);
  assigned.get(String(best.id)).push({
    type:'Feature',
    id:`${best.id}--zone--diba-${mapid?slug(mapid):slug(name)}`,
    properties:{name:String(name).trim(),officialName:String(name).trim(),municipality:best.name,kind:'zone',quality:'official',sourceCategory:`Nucli/urbanització DIBA${type?` · ${String(type).trim()}`:''}`,...(mapid?{code:String(mapid).trim()}:{})},
    geometry:feature.geometry,
  });
}

await mkdir(targetDir,{recursive:true}); await mkdir(backupDir,{recursive:true});
let written=0, skipped=0;
for(const m of targets){
  const activePath=resolve(targetDir,`${slug(m.name)}.geojson`);
  // Si el municipio ya tiene una capa municipal poligonal sustancial, la fuente regional no añade ruido.
  if(existsSync(activePath)){
    try{
      const active=JSON.parse(await readFile(activePath,'utf8'));
      const municipal=(active.features??[]).filter(f=>f?.properties?.quality==='official' && ['barri','sector'].includes(f?.properties?.kind));
      if(municipal.length>=5){ skipped++; continue; }
    }catch{}
  }
  const rawAssigned=assigned.get(String(m.id))??[];
  const byId=new Map(); for(const feature of rawAssigned) byId.set(feature.id,feature);
  const features=[...byId.values()];
  if(!features.length) continue;
  const out={type:'FeatureCollection',municipality:m.name,source:{organization:'Diputació de Barcelona',title:'Límits d’urbanitzacions i nuclis de població · referencia territorial',official:true,accessedAt:new Date().toISOString().slice(0,10)},features};
  const target=resolve(targetDir,`${slug(m.name)}-reference.geojson`);
  if(existsSync(target)){
    const backup=resolve(backupDir,`${new Date().toISOString().replace(/[:.]/g,'-')}--${basename(target)}`);
    await copyFile(target,backup);
  }
  await writeFile(target,JSON.stringify(out,null,2)+'\n','utf8'); written++;
  console.log(`  ${m.name}: ${features.length} núcleos/urbanizaciones de referencia.`);
}
const assignedCount=[...assigned.values()].reduce((n,list)=>n+list.length,0);
console.log(`Resultado: ${written} referencias escritas; ${skipped} municipios omitidos por tener ya división municipal oficial; ${assignedCount} polígonos DIBA asignados; ${unassigned} geometrías dudosas no asignadas.`);
if (rawFeatures.length >= 100 && written === 0 && skipped < targets.length) {
  console.warn(`DIBA: la fuente es válida (${rawFeatures.length} polígonos con atributos), pero ninguno ha quedado dentro de los municipios objetivo. No se escribe nada y NO se considera una división de barrios.`);
}
console.log('Esta fuente NO se etiqueta como barrio y nunca sustituye municipality-zones/*.geojson.');
