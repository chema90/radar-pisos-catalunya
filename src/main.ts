import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getNote, getNotes, getSeenProperties, saveNote, saveSeenProperty, type ZoneInterest, type ZoneNote } from './storage';
import { appendCustomFeature, createUserFeature, fetchGeoJsonUrl, fetchOnlineZones, loadZones, normalizeImportedCollection, saveImportedCollection, zoneKey } from './zone-data';
import type { MapLayer, Municipality, Preference, SeenProperty, ZoneCollection, ZoneFeature, ZoneKind, ZoneLayer, ZoneQuality } from './types';
import { findZoneAtPoint, geocodeAddress, geocodeSearchAddress, isLikelyAddressQuery } from './geocoding';
import { loadIcgcZones } from './icgc-zone-data';
import { loadLayerVisibility, saveLayerVisibility, type LayerVisibility } from './layer-visibility';
import { findMunicipalityByName, normalizeMunicipalityName, normalizeText, preferenceMunicipalityTarget } from './municipality-matching';
import { mountAdvancedGisTools, startOfficialSourceMonitoring } from './advanced-gis-ui';
import { autoLoadOfficialMunicipalZones, officialSources, sourceAlreadyCovered } from './official-zone-sources';
import { repairTarragonaZoneLabels } from './tarragona-zone-labels';
import { ambAemSource, fetchAmbZonesNow, isAmbMunicipality, loadAmbZones } from './amb-zone-source';
import { valldoreixKnownZones, withSubmunicipalTerritories } from './submunicipal-territories';
import { mountMunicipalityContext } from './municipality-context';
import './styles.css';

type Catalog = { municipalities: Municipality[]; source: string; accessedAt: string };
type KnownZone = { municipality: string; name: string; kind: string; official: boolean; source?: string; sourceUrl?: string; district?: string };
type ZoneRow = { id: string; name: string; kind: ZoneKind; quality: ZoneQuality; feature?: ZoneFeature; preference?: Preference; known?: KnownZone };
type SearchAddress = { label: string; municipalityId: string; municipalityName: string; latitude: number; longitude: number };
const app = document.querySelector<HTMLDivElement>('#app')!;
const colors = ['#2e7d8a','#4c6fb3','#d78b2d','#7656a8','#d55f58','#4d8b62','#a96589','#63869e','#9b7749'];
let catalog: Catalog;
let preferences: Preference[];
let knownZones: KnownZone[] = [];
let active: Municipality;
let activeNote: ZoneNote = {};
let allNotes: Record<string, ZoneNote> = {};
let localZones: ZoneCollection | undefined;
let icgcZones: ZoneCollection | undefined;
let ambZones: ZoneCollection | undefined;
let zones: ZoneCollection | undefined;
let layerVisibility: LayerVisibility = { municipalityBoundary: true, barri: true, sector: false, municipalOther: true, references: false, icgcPopulation: true, icgcIndustrial: true };
let properties: SeenProperty[] = [];
let map: L.Map | undefined;
let searchAddressMarker: L.CircleMarker | undefined;
let activeSearchAddress: SearchAddress | undefined;
let municipalityLayer: L.GeoJSON | undefined;
let layers = new Map<string, L.GeoJSON>();
let selected = new Set<string>();
let comparison = new Set<string>();
let focused: string | undefined;
let sidebar: 'zones' | 'properties' = 'zones';
let drawName = '';
let drawKind: ZoneKind = 'barri';
let drawPoints: number[][] = [];
let drawLayer: L.Polygon | undefined;
let sourceLoadError: string | undefined;
let sourceLoading = false;
let municipalityContextVisible = false;
let zoneDetailHistoryActive = false;
const norm = normalizeText;
const municipalityNorm = normalizeMunicipalityName;
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]!));
const qLabel = (quality: ZoneQuality) => ({official:'Oficial',community:'OpenStreetMap',imported:'Importado','user-drawn':'Dibujado','list-only':'Sin límite'})[quality];
const zoneKindLabel = (kind: ZoneKind) => ({barri:'Barrio',sector:'Sector',zone:'Zona',district:'Distrito',interest:'Zona de interés',industrial:'Sector industrial'})[kind];
const statusLabel = (status: SeenProperty['status']) => ({liked:'Me gusta',disliked:'No me gusta',pending:'Pendiente'})[status];
const statusIcon = (status: SeenProperty['status']) => ({liked:'♥',disliked:'×',pending:'•'})[status];

type ExternalMapProvider = 'maps' | 'earth';
function featureCenter(feature?: ZoneFeature): {lat:number; lng:number} | undefined {
  const geometry = feature?.geometry as { coordinates?: unknown } | undefined;
  if (!geometry?.coordinates) return undefined;
  let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
  const visit=(value:unknown)=>{
    if(!Array.isArray(value))return;
    if(value.length>=2 && typeof value[0]==='number' && typeof value[1]==='number'){
      const lng=value[0],lat=value[1];
      if(Number.isFinite(lng)&&Number.isFinite(lat)){minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat)}
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  if(!Number.isFinite(minLng)||!Number.isFinite(minLat)||!Number.isFinite(maxLng)||!Number.isFinite(maxLat))return undefined;
  return {lat:(minLat+maxLat)/2,lng:(minLng+maxLng)/2};
}
function externalZoneUrl(row:ZoneRow,provider:ExternalMapProvider){
  const center=featureCenter(row.feature);
  const query=center?`${center.lat.toFixed(6)},${center.lng.toFixed(6)}`:`${row.name}, ${active.name}, Catalunya`;
  return provider==='maps'
    ?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    :`https://earth.google.com/web/search/${encodeURIComponent(query)}`;
}
function externalZoneButtons(row:ZoneRow){
  return `<span class="external-zone-links"><button type="button" class="external-zone-icon maps" data-external-url="${esc(externalZoneUrl(row,'maps'))}" title="Abrir ${esc(row.name)} en Google Maps" aria-label="Abrir ${esc(row.name)} en Google Maps">M</button><button type="button" class="external-zone-icon earth" data-external-url="${esc(externalZoneUrl(row,'earth'))}" title="Abrir ${esc(row.name)} en Google Earth" aria-label="Abrir ${esc(row.name)} en Google Earth">E</button></span>`;
}
function externalPointUrl(lat:number,lng:number,provider:ExternalMapProvider){
  const query=`${lat.toFixed(7)},${lng.toFixed(7)}`;
  return provider==='maps'
    ?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    :`https://earth.google.com/web/search/${encodeURIComponent(query)}`;
}
function searchAddressCard(address:SearchAddress){
  const maps=externalPointUrl(address.latitude,address.longitude,'maps');
  const earth=externalPointUrl(address.latitude,address.longitude,'earth');
  return `<div class="address-actions-head"><div><p class="eyebrow">Dirección localizada</p><strong>${esc(address.label)}</strong><span>${esc(address.municipalityName)}</span></div><button type="button" class="icon-button" id="close-address-actions" aria-label="Cerrar accesos de la dirección">×</button></div><div class="address-marker-actions"><a href="${esc(maps)}" target="_blank" rel="noopener noreferrer" title="Abrir este punto en Google Maps">Google Maps ↗</a><a href="${esc(earth)}" target="_blank" rel="noopener noreferrer" title="Abrir este punto en Google Earth">Google Earth ↗</a></div>`;
}
function showSearchAddressCard(address=activeSearchAddress){
  document.querySelector('.address-actions-card')?.remove();
  const region=document.querySelector<HTMLElement>('.map-region');
  if(!region||!address||address.municipalityId!==active.id)return;
  const card=document.createElement('article');
  card.className='address-actions-card';
  card.setAttribute('aria-label','Accesos externos para la dirección localizada');
  card.innerHTML=searchAddressCard(address);
  region.append(card);
  card.querySelector('#close-address-actions')?.addEventListener('click',()=>card.remove());
}
function mountSearchAddress(address:SearchAddress){
  if(!map||address.municipalityId!==active.id)return;
  searchAddressMarker?.remove();
  searchAddressMarker=L.circleMarker([address.latitude,address.longitude],{radius:9,color:'#13274d',weight:3,fillColor:'#f4614c',fillOpacity:.95}).addTo(map);
  searchAddressMarker.bindTooltip(`<b>${esc(address.label)}</b><br>${esc(address.municipalityName)}<br><small>Toca para ver Maps / Earth</small>`,{direction:'top'});
  searchAddressMarker.on('click',event=>{L.DomEvent.stopPropagation(event);showSearchAddressCard(address)});
  showSearchAddressCard(address);
}

async function init() {
  [catalog, {zones: preferences}, {zones: knownZones}, properties, allNotes] = await Promise.all([
    fetch(import.meta.env.BASE_URL+'data/municipalities.json').then(r=>r.json()),
    fetch(import.meta.env.BASE_URL+'data/interest-zones.json').then(r=>r.json()),
    fetch(import.meta.env.BASE_URL+'data/known-zones.json').then(r=>r.json()),
    getSeenProperties(),
    getNotes(),
  ]);
  catalog = { ...catalog, municipalities: withSubmunicipalTerritories(catalog.municipalities) };
  knownZones = [...knownZones, ...valldoreixKnownZones()];
  startOfficialSourceMonitoring(officialSources);
  await selectMunicipality(catalog.municipalities.find(item=>norm(item.name)==='girona') ?? catalog.municipalities[0]);
}
function featureLayer(feature: ZoneFeature): ZoneLayer {
  if (feature.properties.layer) return feature.properties.layer;
  if (feature.properties.reference) return 'references';
  if (feature.properties.kind === 'barri') return 'barri';
  if (feature.properties.kind === 'sector') return 'sector';
  if (feature.properties.kind === 'industrial') return 'icgcIndustrial';
  return 'municipalOther';
}

function sourceCounts() {
  const counts: Record<ZoneLayer, number> = { barri: 0, sector: 0, municipalOther: 0, references: 0, icgcPopulation: 0, icgcIndustrial: 0 };
  localZones?.features.forEach(feature => { counts[featureLayer(feature)] += 1; });
  if (!hasCompleteMunicipalCoverage()) ambZones?.features.forEach(feature => { counts[featureLayer(feature)] += 1; });
  icgcZones?.features.forEach(feature => { counts[featureLayer(feature)] += 1; });
  return counts;
}

function hasCompleteMunicipalCoverage(): boolean {
  const localMunicipal = (localZones?.features ?? []).filter(feature => !feature.properties.reference && feature.properties.sourceCategory !== 'amb-aem');
  if (!localMunicipal.length) return false;
  const configured = officialSources[active.id];
  if (configured?.minimumExpectedFeatures) return sourceAlreadyCovered(localZones, configured);
  return localMunicipal.some(feature => feature.properties.quality === 'official');
}

function municipalCoverageLabel(): string {
  const counts = sourceCounts();
  if (active.entityType === 'emd') {
    if (hasCompleteMunicipalCoverage()) return 'EMD oficial';
    if ((localZones?.features.length ?? 0) > 0) return 'EMD parcial';
    return 'Pendiente';
  }
  const municipalCount = counts.barri + counts.sector + counts.municipalOther;
  if (hasCompleteMunicipalCoverage()) return 'Municipal + ICGC';
  if (ambZones?.features.length) return 'AMB (AEM) + ICGC';
  if (hasDibaSettlementReferences()) return 'DIBA + ICGC';
  if (!municipalCount) return 'ICGC';
  return 'Municipal parcial + ICGC';
}

function hasDibaSettlementReferences(): boolean {
  return (localZones?.features ?? []).some(feature => feature.properties.layer === 'references' && String(feature.properties.sourceCategory ?? '').startsWith('Nucli/urbanització DIBA'));
}

function defaultVisibility(): LayerVisibility {
  const counts = sourceCounts();
  const hasMunicipal = hasCompleteMunicipalCoverage();
  const hasAmbFallback = !hasMunicipal && Boolean(ambZones?.features.length);
  const useDibaReferences = !hasMunicipal && !hasAmbFallback && hasDibaSettlementReferences();
  return {
    municipalityBoundary: true,
    barri: counts.barri > 0,
    sector: counts.barri === 0 && counts.sector > 0,
    municipalOther: counts.municipalOther > 0,
    references: useDibaReferences,
    icgcPopulation: !hasMunicipal && !hasAmbFallback && !useDibaReferences && counts.icgcPopulation > 0,
    icgcIndustrial: counts.icgcIndustrial > 0,
  };
}

function rebuildVisibleZones() {
  const features = [
    ...(localZones?.features ?? []),
    ...(!hasCompleteMunicipalCoverage() ? (ambZones?.features ?? []) : []),
    ...(icgcZones?.features ?? []),
  ].filter(feature => layerVisibility[featureLayer(feature)]);
  zones = {
    type: 'FeatureCollection',
    municipality: active.name,
    source: {
      organization: 'Fuentes combinadas',
      title: 'Capas territoriales activas',
      official: features.some(feature => feature.properties.quality === 'official'),
      accessedAt: new Date().toISOString().slice(0, 10),
    },
    features,
  };
}

async function reloadZoneSources(resetVisibility = false) {
  const isEmd = active.entityType === 'emd';
  const [loadedLocalZones, loadedAmbZones, loadedIcgcZones] = await Promise.all([
    loadZones(active),
    isEmd ? Promise.resolve(undefined) : loadAmbZones(active),
    isEmd ? Promise.resolve(undefined) : loadIcgcZones(active),
  ]);
  localZones = active.id === '431482' ? repairTarragonaZoneLabels(loadedLocalZones) : loadedLocalZones;
  ambZones = loadedAmbZones;
  icgcZones = loadedIcgcZones;
  if (resetVisibility) layerVisibility = loadLayerVisibility(active.id, defaultVisibility());
  rebuildVisibleZones();
}

async function selectMunicipality(municipality: Municipality, zoneName?: string) {
  if (active?.id && active.id !== municipality.id) activeSearchAddress = undefined;
  active = municipality;
  activeNote = await getNote(active.id);
  sourceLoadError = undefined;
  sourceLoading = false;
  await reloadZoneSources(true);
  properties = await getSeenProperties();
  selected = new Set(zones?.features.map(feature => feature.id) ?? []);
  focused = undefined;
  sidebar = 'zones';
  // El municipio aparece inmediatamente con las capas locales/ICGC disponibles.
  render();

  const source = officialSources[active.id];
  if (source?.vector && source.autoLoad !== false && !sourceAlreadyCovered(localZones, source)) {
    sourceLoading = true;
    render();
    try {
      await autoLoadOfficialMunicipalZones(active, source);
      await reloadZoneSources(false);
      const freshDefaults = defaultVisibility();
      for (const layer of ['barri', 'sector', 'municipalOther'] as ZoneLayer[]) {
        if (freshDefaults[layer]) layerVisibility[layer] = true;
      }
      if (hasCompleteMunicipalCoverage()) {
        layerVisibility.icgcPopulation = false;
      }
      saveLayerVisibility(active.id, layerVisibility);
      rebuildVisibleZones();
      selected = new Set(zones?.features.map(feature => feature.id) ?? []);
    } catch (error) {
      sourceLoadError = error instanceof Error ? error.message : 'La fuente oficial no está disponible ahora.';
    } finally {
      sourceLoading = false;
      render();
    }
  }

  if (zoneName) {
    const feature = bestFeatureMatch(zoneName);
    if (feature) {
      const layer = featureLayer(feature);
      if (!layerVisibility[layer]) {
        layerVisibility = { ...layerVisibility, [layer]: true };
        saveLayerVisibility(active.id, layerVisibility);
        rebuildVisibleZones();
        selected = new Set(zones?.features.map(item => item.id) ?? []);
        render();
      }
      focusZone(feature.id);
    }
  }
}
function interests() {
  const target=municipalityNorm(active.name);
  return preferences.filter(item=>item.kind==='interest' && item.municipality && municipalityNorm(item.municipality)===target);
}
function knownHere(){return knownZones.filter(item=>municipalityNorm(item.municipality)===municipalityNorm(active.name))}
function officialSource(){return officialSources[active.id]??(active.county==='Maresme'?{title:'Consell Comarcal del Maresme · Mapa Urbanístic de Catalunya',url:'https://seu-e.cat/es/web/ccmaresme/dades-obertes/-/dadesobertes/dataset/8b583ab7-d8db-4003-9aa7-0a1fa29971ee',vector:false}:undefined)}
function knownKind(value:string):ZoneKind{const clean=norm(value);if(clean.includes('barri')||clean.includes('barrio'))return'barri';if(clean.includes('sector'))return'sector';if(clean.includes('distr'))return'district';return'zone'}
function allTerritorialFeatures(): ZoneFeature[] {
  return [...(localZones?.features ?? []), ...(icgcZones?.features ?? [])];
}

function zoneNameMatchScore(searchName: string, candidateName: string): number {
  const search = zoneKey(searchName);
  const candidate = zoneKey(candidateName);
  if (!search || !candidate) return 0;
  if (search === candidate) return 100;
  const searchTokens = search.split('-').filter(Boolean);
  const candidateTokens = candidate.split('-').filter(Boolean);
  // Coincidencia conservadora para variantes como "Escola Industrial" frente a
  // "Plaça Catalunya-Escola Industrial". No se aplica a nombres genéricos de una palabra.
  if (searchTokens.length >= 2 && candidateTokens.length >= searchTokens.length) {
    const allPresent = searchTokens.every(token => candidateTokens.includes(token));
    if (allPresent) return 60 + Math.min(searchTokens.length, 8);
  }
  return 0;
}

function bestFeatureMatch(name: string, features = allTerritorialFeatures(), allowIndustrial = false): ZoneFeature | undefined {
  const scored = features
    .filter(feature => allowIndustrial || featureLayer(feature) !== 'icgcIndustrial')
    .map(feature => ({
      feature,
      score: Math.max(
        zoneNameMatchScore(name, feature.properties.name),
        ...(feature.properties.aliases ?? []).map(alias => zoneNameMatchScore(name, alias)),
      ),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(featureLayer(a.feature).startsWith('icgc')) - Number(featureLayer(b.feature).startsWith('icgc')));
  if (!scored.length) return undefined;
  if (scored.length > 1 && scored[0].score === scored[1].score && scored[0].score < 100) return undefined;
  return scored[0].feature;
}

function bestRowMatch(name: string, rows: ZoneRow[]): ZoneRow | undefined {
  const feature = bestFeatureMatch(name, rows.flatMap(row => row.feature ? [row.feature] : []));
  return feature ? rows.find(row => row.id === feature.id) : undefined;
}

function zoneRows(): ZoneRow[] {
  const rows: ZoneRow[] = (zones?.features ?? []).map(feature => ({
    id: feature.id,
    name: feature.properties.name,
    kind: feature.properties.kind,
    quality: feature.properties.quality,
    feature,
  }));
  knownHere().forEach(known => {
    const current = bestRowMatch(known.name, rows);
    if (current) current.known = known;
  });
  interests().forEach(preference => {
    const current = bestRowMatch(preference.name, rows);
    if (current) current.preference = preference;
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

function unresolvedRows(): ZoneRow[] {
  const all = allTerritorialFeatures();
  const unresolved = new Map<string, ZoneRow>();
  knownHere().forEach(known => {
    if (bestFeatureMatch(known.name, all)) return;
    const kind = knownKind(known.kind);
    const key = zoneKey(known.name);
    unresolved.set(key, {
      id: `known--${active.id}--${zoneKey(known.name)}`,
      name: known.name,
      kind,
      quality: 'list-only',
      known,
    });
  });
  interests().forEach(preference => {
    if (bestFeatureMatch(preference.name, all)) return;
    const key = zoneKey(preference.name);
    const existing = unresolved.get(key);
    if (existing) existing.preference = preference;
    else unresolved.set(key, { id: preference.id, name: preference.name, kind: 'interest', quality: 'list-only', preference });
  });
  return [...unresolved.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

function preferenceMatchesZone(preferenceName:string,rowName:string){
  const row=zoneKey(rowName), preference=zoneKey(preferenceName);
  if(preference===row)return true;
  if(preference.endsWith(`-${row}`)){
    const activeTokens=zoneKey(active.name).split('-').filter(token=>token.length>2);
    return activeTokens.some(token=>preference.startsWith(`${token}-`));
  }
  return false;
}
function isTop(row: ZoneRow) {
  return preferences.some(item=>item.kind==='top' && preferenceMatchesZone(item.name,row.name));
}
function isExcluded(row:ZoneRow){
  return preferences.some(item=>item.kind==='excluded'&&preferenceMatchesZone(item.name.replace(/\s*\([^)]*\)\s*$/,''),row.name));
}
function zoneInterest(row:ZoneRow):ZoneInterest{
  const note=allNotes[row.id];
  if(note?.interest)return note.interest;
  if(note?.top||isTop(row))return'top';
  if(note?.discarded||isExcluded(row))return'discarded';
  if(row.preference?.kind==='interest')return'interesting';
  return'normal';
}
function interestLabel(value:ZoneInterest){return({normal:'Normal',top:'TOP',interesting:'Interesante',discarded:'Descartada'})[value]}
function layerLabel(layer:MapLayer){
  const referenceLabel=hasDibaSettlementReferences()?'Núcleos / urbanizaciones (DIBA)':'Referencias';
  const localBarrios=(localZones?.features??[]).some(feature=>feature.properties.kind==='barri'&&feature.properties.sourceCategory!=='amb-aem');
  const ambVisible=!hasCompleteMunicipalCoverage()&&Boolean(ambZones?.features.length);
  const barriLabel=ambVisible?(localBarrios?'Barrios + ámbitos AMB':'Ámbitos estadísticos AMB'):'Barrios';
  return({municipalityBoundary:active.entityType==='emd'?'Límite EMD':'Límite municipal',barri:barriLabel,sector:'Sectores municipales',municipalOther:'Otras zonas municipales/importadas',references:referenceLabel,icgcPopulation:'Áreas de poblamiento ICGC',icgcIndustrial:'Industria ICGC'})[layer];
}
function featureLayerDescription(feature:ZoneFeature){if(feature.properties.sourceCategory==='amb-aem')return 'Ámbito estadístico AMB · oficial';const layer=featureLayer(feature);const quality=feature.properties.quality==='official'?'oficial':qLabel(feature.properties.quality).toLowerCase();return `${layerLabel(layer)} · ${quality}`}
function layerBaseColor(feature:ZoneFeature,index:number){const layer=featureLayer(feature);if(layer==='icgcIndustrial')return'#8a5d3b';if(layer==='icgcPopulation')return'#c78a38';if(layer==='references')return'#7d6b9f';return colors[index%colors.length]}
function zoneColor(feature:ZoneFeature,index:number){const row=zoneRows().find(item=>item.id===feature.id);const interest=row?zoneInterest(row):'normal';if(interest==='top')return'#2f8a58';if(interest==='interesting')return'#2f78c4';if(interest==='discarded')return'#c44d4d';return layerBaseColor(feature,index)}
function municipalityProperties(){return properties.filter(item=>item.municipalityId===active.id)}
function coverage(){
  const counts=sourceCounts();
  const completeMunicipal=hasCompleteMunicipalCoverage();
  const hasAmbFallback=!completeMunicipal&&Boolean(ambZones?.features.length);
  const localCount=(localZones?.features??[]).filter(feature=>!feature.properties.reference&&feature.properties.sourceCategory!=='amb-aem').length;
  if(active.entityType==='emd'){
    if(completeMunicipal)return 'Barrios oficiales de la EMD disponibles';
    if(localCount)return 'División de la EMD parcial';
    return knownHere().length?'Barrios oficiales conocidos · polígonos pendientes':'EMD pendiente de desglose';
  }
  if(sourceLoading)return 'Cargando división municipal oficial…';
  if(completeMunicipal)return 'División municipal oficial + cobertura ICGC';
  if(hasAmbFallback&&localCount)return 'División local parcial + respaldo AMB';
  if(hasAmbFallback)return 'Ámbitos estadísticos AMB disponibles';
  if((counts.barri||counts.sector))return 'División local parcial + cobertura ICGC';
  if(counts.municipalOther)return 'Desglose local + cobertura ICGC';
  if(counts.references&&hasDibaSettlementReferences())return 'Núcleos / urbanizaciones DIBA disponibles';
  if(sourceLoadError)return 'ICGC disponible · fuente municipal temporalmente no disponible';
  if(counts.icgcPopulation)return 'Áreas de poblamiento ICGC disponibles';
  return interests().length || knownHere().length ? 'Zonas conocidas · límites pendientes' : 'Solo límite municipal';
}
function layerControls(){
  const counts=sourceCounts();
  const order:ZoneLayer[]=['barri','sector','municipalOther','references','icgcPopulation','icgcIndustrial'];
  const boundary=active.geometry?`<label class="layer-toggle"><input type="checkbox" data-layer-toggle="municipalityBoundary" ${layerVisibility.municipalityBoundary?'checked':''}/><span class="layer-dot municipalityBoundary"></span><span>${layerLabel('municipalityBoundary')} <small>1</small></span></label>`:'';
  const zoneLayers=order.filter(layer=>counts[layer]>0).map(layer=>`<label class="layer-toggle"><input type="checkbox" data-layer-toggle="${layer}" ${layerVisibility[layer]?'checked':''}/><span class="layer-dot ${layer}"></span><span>${layerLabel(layer)} <small>${counts[layer]}</small></span></label>`).join('');
  return `<div class="layer-controls"><div class="layer-title"><strong>Capas del mapa</strong><small>Todo lo que ves se controla aquí</small></div>${boundary}${zoneLayers}<div class="interest-guide"><strong>Valoración</strong><span><i class="interest-dot top"></i>TOP</span><span><i class="interest-dot interesting"></i>Interesante</span><span><i class="interest-dot discarded"></i>Descartada</span><span><i class="interest-dot normal"></i>Normal</span></div></div>`;
}
function render(){
  const rows=zoneRows(), seen=municipalityProperties();
  app.innerHTML=`
  <header class="topbar"><a class="brand" href="#"><span class="pin">⌖</span> Radar de pisos</a><nav><button class="plain" id="favorites">♡ Barrios</button><button class="plain" id="compare-liked">⇄ Comparar <span class="nav-count">${properties.filter(item=>item.status==='liked').length}</span></button><button class="plain" id="seen">⌂ Vistos <span class="nav-count">${properties.length}</span></button></nav></header>
  <main><section class="search-area"><label class="search"><span>⌕</span><input id="query" autocomplete="off" placeholder="Busca municipio, barrio o dirección"/><button id="search-button">Buscar</button></label><div class="search-results" id="search-results" hidden></div></section>
  <section class="workspace"><aside class="sidebar">
    <div class="municipality-heading"><div><h1>${esc(active.name)}</h1><p>${active.entityType==='emd'?`EMD de ${esc(active.parentMunicipalityName??'Sant Cugat del Vallès')} · `:''}${esc(active.county)} · ${esc(active.province)}</p></div><div class="municipality-heading-actions"><button id="toggle-top-municipality" class="icon-button municipality-top-toggle ${activeNote.top ? 'active ' : ''}top-toggle" title="Marca ${active.entityType==='emd'?'esta EMD':'el municipio completo'} como prioritario. No modifica la valoración de sus barrios o zonas.">${activeNote.top ? `⭐ ${active.entityType==='emd'?'EMD':'Municipio'} TOP` : `☆ ${active.entityType==='emd'?'EMD':'Municipio'} TOP`}</button><button id="toggle-municipality-context" class="icon-button municipality-context-toggle ${municipalityContextVisible?'active':''}" aria-pressed="${municipalityContextVisible}" title="Muestra los límites y nombres de los municipios del entorno. Es una capa orientativa y no afecta a los barrios.">◫ Municipios vecinos</button></div></div>
    <div class="coverage-row"><p class="coverage"><i></i>${coverage()}</p><button class="secondary compact" id="create-breakdown">Crear desglose</button></div>
    <div class="facts"><span><small>TIPO</small>${active.entityType==='emd'?'EMD':'Municipio'}</span><span><small>FUENTE</small>${municipalCoverageLabel()}</span><span><small>ÁREA</small>${active.areaM2?active.areaM2.toFixed(1)+' km²':'—'}</span></div>
    ${layerControls()}
    <div class="sidebar-tabs"><button class="${sidebar==='zones'?'active':''}" id="zones-tab">${rows.some(row=>!['barri','interest'].includes(row.kind))?'Zonas':'Barrios'} <span>${rows.length}</span></button><button class="${sidebar==='properties'?'active':''}" id="properties-tab">Pisos vistos <span>${seen.length}</span></button></div>
    ${sidebar==='zones'?zoneList(rows):propertyList(seen)}
    <p class="source-note">${active.entityType==='emd'?(localZones?.features.length?'Fuente EMD: '+esc(localZones.source.title):'Fuente oficial de nombres: EMD de Valldoreix · polígonos todavía pendientes'):hasCompleteMunicipalCoverage()&&localZones?.source?.official?'Capa municipal prioritaria: '+esc(localZones.source.title):ambZones?.features.length?'Respaldo activo: '+esc(ambAemSource.title)+(localZones?.features.length?' · existe además una capa local parcial/no validada':''):localZones?.features.length?'Capa local no validada como completa: '+esc(localZones.source.title):'Base general: ICGC Àrees de poblament'}<br>${active.entityType==='emd'?'Valldoreix se mantiene separado de Sant Cugat en el Radar.': 'AMB nunca sustituye una capa municipal validada. ICGC sigue siendo complementaria y la industria nunca se elimina.'}${sourceLoadError?'<br><span class="source-error">'+esc(sourceLoadError)+'</span>':''}</p>
  </aside><section class="map-region"><div id="map"></div><div class="map-tools"><button id="locate">◎ Localizarme</button><button id="add-property-map">＋ Añadir piso o promoción</button></div>
  <div class="legend"><strong>Capas</strong><span><i class="legend-swatch selected"></i><b id="selected-count">${selected.size}</b> seleccionados</span>${active.geometry?`<span><i class="legend-line official"></i>${active.entityType==='emd'?'Límite EMD':'Límite municipal'}</span>`:''}</div>
  <article class="detail" id="detail">${defaultDetailHtml()}</article></section></section></main>`;
  mountMap(); bindEvents();
}
function pendingZoneList(){
  const pending=unresolvedRows();
  if(!pending.length)return'';
  return `<details class="pending-zones"><summary>${pending.length} nombres pendientes de polígono <small>No son una capa del mapa</small></summary><p>Son zonas guardadas en tus listas que todavía no tienen una geometría enlazada. No cuentan como visibles y no permanecen en el mapa al apagar las capas.</p><div>${pending.map(row=>`<div class="pending-row"><span>—</span><div><strong>${esc(row.name)}</strong><small>${row.preference?'Zona de interés':'Referencia conocida'} · sin polígono asociado</small></div>${externalZoneButtons(row)}</div>`).join('')}</div></details>`;
}
function zoneList(rows: ZoneRow[]){
  const pending=pendingZoneList();
  if(!rows.length) return `<div class="empty-state"><strong>Sin capas territoriales visibles</strong><p>Has desactivado todas las capas de zonas. Activa una capa arriba para volver a ver sus polígonos.</p></div>${pending}`;
  return `<div class="list-toolbar"><span><b>${selected.size}</b> visibles</span><button id="toggle-all">${selected.size?'Ocultar todos':'Mostrar todos'}</button></div><div class="zone-list">${rows.map((row,index)=>{const interest=zoneInterest(row);const color=row.feature?zoneColor(row.feature,index):'#a8a8a8';const layer=row.feature?featureLayer(row.feature):undefined;return `<div class="zone-row ${selected.has(row.id)?'selected':''} ${focused===row.id?'focused':''}"><label class="zone-check"><input type="checkbox" data-zone-toggle="${esc(row.id)}" ${selected.has(row.id)?'checked':''}/><span style="--zone-color:${color}"></span></label><button class="zone-open" data-zone-open="${esc(row.id)}" title="Seleccionar sin cambiar el zoom"><strong>${esc(row.name)} ${interest!=='normal'?`<em class="interest-badge ${interest}">${interestLabel(interest)}</em>`:''}</strong><small><em class="layer-chip ${layer??''}">${row.feature?esc(featureLayerDescription(row.feature)):'Sin capa'}</em>${row.feature?.properties.sourceCategory?' · '+esc(row.feature.properties.sourceCategory):''}${row.feature?.properties.parentName?' · Barrio: '+esc(row.feature.properties.parentName):row.feature?.properties.district?' · '+esc(row.feature.properties.district):''}</small></button>${externalZoneButtons(row)}<button type="button" class="geometry-icon" data-zone-zoom="${esc(row.id)}" title="Centrar y ampliar esta zona" aria-label="Centrar y ampliar ${esc(row.name)}">◇</button></div>`}).join('')}</div>${pending}`;
}
function propertyList(items: SeenProperty[]){
  const compareCount=items.filter(item=>comparison.has(item.id)).length;
  return `<div class="property-toolbar"><span>${items.length?items.length+' guardados':'Aún no hay pisos guardados'}</span><span class="toolbar-actions"><button class="secondary compact" id="compare-selected" ${compareCount<2?'disabled':''}>Comparar ${compareCount?`(${compareCount})`:''}</button><button class="primary compact" id="add-property-sidebar">＋ Añadir</button></span></div>${items.length?`<div class="property-list">${items.map(item=>`<div class="property-row ${comparison.has(item.id)?'comparing':''}"><label class="compare-check" title="Añadir a comparación"><input type="checkbox" data-compare-property="${item.id}" ${comparison.has(item.id)?'checked':''}/><span></span></label><button class="property-open" data-property-id="${item.id}"><span class="property-status ${item.status}">${statusIcon(item.status)}</span><span><strong>${esc(item.name)}</strong><small>${item.kind==='development'?'Promoción':'Piso'}${item.zoneName?' · '+esc(item.zoneName):''}${item.price?' · '+item.price.toLocaleString('es-ES')+' €':''}</small></span><em>${statusLabel(item.status)}</em></button></div>`).join('')}</div>`:'<div class="empty-state slim"><p>Guarda anuncios, direcciones o promociones y marca si te gustaron.</p></div>'}`;
}
function defaultDetailHtml(){return `<div class="detail-placeholder"><div><p class="eyebrow">Mapa interactivo</p><h2>Selecciona una zona</h2><p>Activa varios barrios o sectores para compararlos o registra un piso que hayas visto.</p></div><button class="primary" id="add-property-empty">Añadir piso o promoción</button></div>`}
function mountMap(){
  map?.remove(); searchAddressMarker=undefined; layers=new Map();
  map=L.map('map',{zoomControl:true,attributionControl:false,preferCanvas:true});
  map.on('click',()=>{if(document.querySelector('#close-zone-detail'))closeZoneDetail()});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true}).addTo(map);
  if(active.geometry){municipalityLayer=L.geoJSON(active.geometry,{style:{color:'#152b52',weight:2.2,fillColor:'#f4614c',fillOpacity:.035,dashArray:'7 4'}});if(layerVisibility.municipalityBoundary)municipalityLayer.addTo(map);map.fitBounds(municipalityLayer.getBounds(),{padding:[36,36]})}
  const permanentLabels=!focused && (zones?.features.filter(feature=>featureLayer(feature)!=='icgcIndustrial').length??0)<=120;
  zones?.features.forEach((feature,index)=>{
    const layer=L.geoJSON(feature,{style:()=>zoneStyle(feature,index)}).addTo(map!);
    const permanent=(permanentLabels&&featureLayer(feature)!=='icgcIndustrial'&&selected.has(feature.id))||focused===feature.id;
    layer.bindTooltip(`${feature.properties.name}`,{sticky:!permanent,permanent,direction:'center',className:permanent?'zone-label':'zone-tooltip'}).on('click',event=>{L.DomEvent.stopPropagation(event);focusZone(feature.id)});
    layers.set(feature.id,layer);
  });
  if(!active.geometry){
    const visibleLayers=[...layers.values()];
    if(visibleLayers.length){
      const group=L.featureGroup(visibleLayers);
      if(group.getBounds().isValid())map.fitBounds(group.getBounds(),{padding:[36,36]});
    }else{
      const parent=active.parentMunicipalityId?catalog.municipalities.find(item=>item.id===active.parentMunicipalityId):undefined;
      if(parent?.geometry){const context=L.geoJSON(parent.geometry);map.fitBounds(context.getBounds(),{padding:[70,70]});}
      else map.setView([41.7,1.7],8);
    }
  }
  mountMunicipalityContext(map,catalog.municipalities,active,municipalityContextVisible);
  municipalityProperties().filter(item=>item.latitude!==undefined&&item.longitude!==undefined).forEach(item=>{
    const color=item.status==='liked'?'#2f8a58':item.status==='disliked'?'#c44d4d':'#d78b2d';
    L.circleMarker([item.latitude!,item.longitude!],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(map!).bindTooltip(item.name).on('click',()=>showProperty(item));
  });
  if(activeSearchAddress)mountSearchAddress(activeSearchAddress);
}
function zoneStyle(feature:ZoneFeature,index:number):L.PathOptions{
  const chosen=selected.has(feature.id), activeZone=focused===feature.id, reference=feature.properties.reference;
  const fill=zoneColor(feature,index), industrial=featureLayer(feature)==='icgcIndustrial';
  if(!chosen&&!activeZone)return{color:fill,weight:0,fillColor:fill,fillOpacity:0,opacity:0};
  return {color:activeZone?'#13274d':industrial?'#6f482f':fill,weight:activeZone?4:industrial?1.8:2.2,fillColor:fill,fillOpacity:reference==='axis'?0:activeZone?.48:industrial?.2:.28,opacity:1,dashArray:reference?'6 4':industrial?'4 3':undefined};
}
function refreshStyles(){
  const showOverviewLabels=!focused && (zones?.features.filter(feature=>featureLayer(feature)!=='icgcIndustrial').length??0)<=120;
  zones?.features.forEach((feature,index)=>{const layer=layers.get(feature.id);layer?.setStyle(zoneStyle(feature,index));if(!layer||featureLayer(feature)==='icgcIndustrial')return;const shouldLabel=focused?focused===feature.id:showOverviewLabels&&selected.has(feature.id);if(shouldLabel)layer.openTooltip();else layer.closeTooltip()});
  document.querySelectorAll<HTMLInputElement>('[data-zone-toggle]').forEach(input=>{input.checked=selected.has(input.dataset.zoneToggle!);input.closest('.zone-row')?.classList.toggle('selected',input.checked)});
  document.querySelectorAll('.zone-row').forEach(row=>row.classList.remove('focused'));
  if(focused) document.querySelector(`[data-zone-open="${CSS.escape(focused)}"]`)?.closest('.zone-row')?.classList.add('focused');
  const count=document.querySelector('#selected-count');if(count)count.textContent=String(selected.size);
}
function bindEvents(){
  const query=document.querySelector<HTMLInputElement>('#query')!;
  query.addEventListener('input',()=>renderSearch(query.value));
  query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void chooseFirst(query.value)}});
  document.querySelector('#search-button')!.addEventListener('click',()=>{void chooseFirst(query.value)});
  document.querySelector('#favorites')!.addEventListener('click',openSaved);document.querySelector('#compare-liked')!.addEventListener('click',()=>openComparison());document.querySelector('#seen')!.addEventListener('click',()=>{sidebar='properties';render()});
  document.querySelector('#zones-tab')!.addEventListener('click',()=>{sidebar='zones';render()});document.querySelector('#properties-tab')!.addEventListener('click',()=>{sidebar='properties';render()});
  document.querySelector('#create-breakdown')!.addEventListener('click',openBreakdown);document.querySelector('[data-breakdown]')?.addEventListener('click',openBreakdown);
  document.querySelectorAll<HTMLInputElement>('[data-layer-toggle]').forEach(input=>input.addEventListener('change',()=>{const layer=input.dataset.layerToggle as MapLayer;layerVisibility={...layerVisibility,[layer]:input.checked};saveLayerVisibility(active.id,layerVisibility);if(layer!=='municipalityBoundary'){rebuildVisibleZones();selected=new Set(zones?.features.map(feature=>feature.id)??[]);focused=undefined;}render()}));
  document.querySelector('#toggle-all')?.addEventListener('click',()=>{selected=selected.size?new Set():new Set(zoneRows().filter(row=>row.feature).map(row=>row.id));render()});
  document.querySelectorAll<HTMLInputElement>('[data-zone-toggle]').forEach(input=>input.addEventListener('change',()=>{const id=input.dataset.zoneToggle!;input.checked?selected.add(id):selected.delete(id);refreshStyles()}));
  document.querySelectorAll<HTMLButtonElement>('[data-zone-open]').forEach(button=>button.addEventListener('click',()=>focusZone(button.dataset.zoneOpen!)));
  document.querySelectorAll<HTMLButtonElement>('[data-zone-zoom]').forEach(button=>button.addEventListener('click',()=>zoomZone(button.dataset.zoneZoom!)));
  document.querySelectorAll<HTMLButtonElement>('[data-external-url]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();window.open(button.dataset.externalUrl!,'_blank','noopener,noreferrer')}));
  document.querySelectorAll<HTMLButtonElement>('[data-property-id]').forEach(button=>button.addEventListener('click',()=>{const item=properties.find(property=>property.id===button.dataset.propertyId);if(item)showProperty(item)}));
  document.querySelectorAll<HTMLInputElement>('[data-compare-property]').forEach(input=>input.addEventListener('change',()=>{input.checked?comparison.add(input.dataset.compareProperty!):comparison.delete(input.dataset.compareProperty!);render()}));
  document.querySelector('#compare-selected')?.addEventListener('click',()=>openComparison([...comparison]));
  ['add-property-map','add-property-empty','add-property-sidebar'].forEach(id=>document.querySelector(`#${id}`)?.addEventListener('click',()=>openPropertyForm()));
  document.querySelector('#locate')!.addEventListener('click',locate);
  document.querySelector('#toggle-top-municipality')?.addEventListener('click',async()=>{activeNote.top=!activeNote.top;await saveNote(active.id,activeNote);allNotes[active.id]=activeNote;render()});
  document.querySelector('#toggle-municipality-context')?.addEventListener('click',()=>{municipalityContextVisible=!municipalityContextVisible;render()});
}
function searchResults(value:string){
  const needle=norm(value.trim());if(!needle)return [];
  const municipalities=catalog.municipalities.filter(item=>norm(`${item.name} ${item.nameSpanish}`).includes(needle)).sort((a,b)=>{
    const aExact=norm(a.name)===needle||norm(a.nameSpanish)===needle;
    const bExact=norm(b.name)===needle||norm(b.nameSpanish)===needle;
    return Number(bExact)-Number(aExact)||Number(Boolean(allNotes[b.id]?.top))-Number(Boolean(allNotes[a.id]?.top))||a.name.localeCompare(b.name,'ca');
  }).slice(0,6).map(municipality=>({type:'municipality' as const,municipality}));
  const knownHits=knownZones.filter(item=>norm(`${item.name} ${item.municipality}`).includes(needle)).slice(0,7).map(known=>({type:'known' as const,known}));
  const zoneHits=preferences.filter(item=>norm(`${item.name} ${item.municipality??''}`).includes(needle)).slice(0,7).map(zone=>({type:'zone' as const,zone}));return [...municipalities,...knownHits,...zoneHits];
}
function renderSearch(value:string){
  const panel=document.querySelector<HTMLDivElement>('#search-results')!, results=searchResults(value);panel.hidden=!value.trim();
  panel.innerHTML=results.length?results.map(result=>result.type==='municipality'
    ?`<button data-municipality="${result.municipality.id}"><b>${esc(result.municipality.name)} ${allNotes[result.municipality.id]?.top?'<span class="top-badge">TOP</span>':''}</b><span>${result.municipality.entityType==='emd'?'EMD':'Municipio'} · ${esc(result.municipality.county)}</span></button>`
    :result.type==='known'
      ?`<button data-known="${esc(result.known.name)}" data-known-municipality="${esc(result.known.municipality)}"><b>${esc(result.known.name)}</b><span>${esc(result.known.municipality)}${result.known.district?' · '+esc(result.known.district):''} · ${esc(result.known.kind)}</span></button>`
      :`<button data-preference="${result.zone.id}"><b>${esc(result.zone.name)}</b><span>${result.zone.kind==='municipality'?'Municipio objetivo':esc(result.zone.municipality??'Zona personal')+' · zona'}</span></button>`).join(''):'<p>Sin coincidencias locales. Pulsa <b>Buscar</b> para localizar una dirección.</p>';
  panel.querySelectorAll<HTMLButtonElement>('[data-municipality]').forEach(button=>button.addEventListener('click',async()=>{const municipality=catalog.municipalities.find(item=>item.id===button.dataset.municipality);if(municipality)await selectMunicipality(municipality)}));
  panel.querySelectorAll<HTMLButtonElement>('[data-known]').forEach(button=>button.addEventListener('click',async()=>{const municipality=findMunicipality(button.dataset.knownMunicipality??null);if(municipality)await selectMunicipality(municipality,button.dataset.known)}));
  panel.querySelectorAll<HTMLButtonElement>('[data-preference]').forEach(button=>button.addEventListener('click',async()=>{const preference=preferences.find(item=>item.id===button.dataset.preference);const municipality=preference?findMunicipality(preferenceMunicipalityTarget(preference)):undefined;if(municipality&&preference)await selectMunicipality(municipality,preference.kind==='municipality'?undefined:preference.name)}));
}
function findMunicipality(name:string|null){return findMunicipalityByName(catalog.municipalities,name)}
async function chooseFirst(value:string){
  const trimmed=value.trim();if(!trimmed)return;
  // "Berguedà, 3" is an address, not the similarly named local result.
  const first=isLikelyAddressQuery(trimmed)?undefined:searchResults(trimmed)[0];
  if(first){
    if(first.type==='municipality')return selectMunicipality(first.municipality);
    if(first.type==='known'){const municipality=findMunicipality(first.known.municipality);if(municipality)return selectMunicipality(municipality,first.known.name);return}
    const municipality=findMunicipality(preferenceMunicipalityTarget(first.zone));if(municipality)await selectMunicipality(municipality,first.zone.kind==='municipality'?undefined:first.zone.name);return;
  }
  const panel=document.querySelector<HTMLDivElement>('#search-results');
  if(panel){panel.hidden=false;panel.innerHTML='<p>Buscando dirección…</p>'}
  try{
    const result=await geocodeSearchAddress(trimmed,active,catalog.municipalities);
    if(!result){if(panel)panel.innerHTML='<p>No se ha localizado esa dirección dentro de Catalunya.</p>';return}
    if(result.municipality.id!==active.id)await selectMunicipality(result.municipality);
    if(!map)return;
    activeSearchAddress={label:trimmed,municipalityId:result.municipality.id,municipalityName:result.municipality.name,latitude:result.latitude,longitude:result.longitude};
    mountSearchAddress(activeSearchAddress);
    map.setView([result.latitude,result.longitude],16,{animate:true});
    const freshPanel=document.querySelector<HTMLDivElement>('#search-results');if(freshPanel)freshPanel.hidden=true;
  }catch(error){
    const currentPanel=document.querySelector<HTMLDivElement>('#search-results');if(currentPanel){currentPanel.hidden=false;currentPanel.innerHTML=`<p>${esc(error instanceof Error?error.message:'No se pudo buscar la dirección.')}</p>`}
  }
}
function focusZone(id:string){
  const row=zoneRows().find(item=>item.id===id);if(!row)return;
  selected.add(id);focused=id;refreshStyles();
  const layer=layers.get(id);
  if(layer&&map){
    const center=layer.getBounds().getCenter();
    map.panTo(center,{animate:true});
  }
  void showZone(row);
}
function zoomZone(id:string){
  const row=zoneRows().find(item=>item.id===id);if(!row)return;
  selected.add(id);focused=id;refreshStyles();
  const layer=layers.get(id);
  if(layer&&map)map.fitBounds(layer.getBounds(),{padding:[70,70],maxZoom:15});
  void showZone(row);
}
async function showZone(row:ZoneRow){
  const note=await getNote(row.id), detail=document.querySelector<HTMLDivElement>('#detail')!, currentInterest=zoneInterest(row);
  detail.innerHTML=`<div class="detail-head"><div><p class="eyebrow">${qLabel(row.quality)} · ${zoneKindLabel(row.kind)} · ${interestLabel(currentInterest)}</p><h2>${esc(row.name)}</h2><p>${esc(active.name)} · ${row.feature?'visible en el mapa':'sin polígono disponible'}${row.feature?.properties.sourceCategory?' · '+esc(row.feature.properties.sourceCategory):''}</p></div><div class="detail-head-actions"><button class="icon-button" id="favorite-zone" aria-label="${note.favorite?'Quitar de':'Añadir a'} favoritos">${note.favorite?'♥':'♡'}</button><button class="icon-button" id="close-zone-detail" aria-label="Cerrar selector de zona">×</button></div></div><div class="detail-actions">${row.feature?'':`<button class="primary" id="create-zone-boundary">Crear o importar límite</button>`}<button class="primary" id="add-property-zone">＋ Añadir piso o promoción</button><label>Interés<select id="zone-interest"><option value="normal" ${currentInterest==='normal'?'selected':''}>Normal</option><option value="top" ${currentInterest==='top'?'selected':''}>TOP</option><option value="interesting" ${currentInterest==='interesting'?'selected':''}>Interesante</option><option value="discarded" ${currentInterest==='discarded'?'selected':''}>Descartada</option></select></label><label>Nota 1–5<select id="rating"><option value="">Sin valorar</option>${[1,2,3,4,5].map(value=>`<option value="${value}" ${note.rating===value?'selected':''}>${value} / 5</option>`).join('')}</select></label><label class="grow">Notas<input id="zone-note" value="${esc(note.text??'')}" placeholder="Ruido, transporte, aparcamiento…"/></label><button class="secondary" id="save-zone-note">Guardar</button></div>`;
  openZoneDetailHistory();
  document.querySelector('#create-zone-boundary')?.addEventListener('click',openBreakdown);
  document.querySelector('#favorite-zone')!.addEventListener('click',async()=>{const next={...note,favorite:!note.favorite};await saveNote(row.id,next);allNotes[row.id]=next;void showZone(row)});
  document.querySelector('#close-zone-detail')!.addEventListener('click',()=>closeZoneDetail());
  document.querySelector('#save-zone-note')!.addEventListener('click',async()=>{const interest=(document.querySelector('#zone-interest') as HTMLSelectElement).value as ZoneInterest;const rating=Number((document.querySelector('#rating') as HTMLSelectElement).value)||undefined;const text=(document.querySelector('#zone-note') as HTMLInputElement).value.trim();const next={...note,interest,rating,text};await saveNote(row.id,next);allNotes[row.id]=next;render();const fresh=zoneRows().find(item=>item.id===row.id);if(fresh)void showZone(fresh)});
  document.querySelector('#add-property-zone')!.addEventListener('click',()=>openPropertyForm(row));
}
function openPropertyForm(zone?:ZoneRow){
  const rows=zoneRows(), detail=document.querySelector<HTMLDivElement>('#detail')!;
  detail.innerHTML=`<div class="detail-head"><div><p class="eyebrow">Registro personal</p><h2>Añadir piso o promoción</h2><p>La dirección se geocodifica automáticamente y se asigna a la zona que contiene el punto.</p></div><button class="icon-button" id="close-detail">×</button></div><form class="property-form" id="property-form">
  <label>Tipo<select name="kind"><option value="flat">Piso</option><option value="development">Promoción</option></select></label><label class="wide">Dirección o promoción<input name="name" required placeholder="Carrer de Mallorca 401, Barcelona"/></label><label>Precio<input name="price" type="number" min="0" step="1000" placeholder="€"/></label><label>Superficie<input name="areaM2" type="number" min="1" step="1" placeholder="m²"/></label><label>Estado del inmueble<select name="condition"><option value="">Sin indicar</option><option>Obra nueva</option><option>Reformado</option><option>Buen estado</option><option>A reformar</option></select></label><label>Valoración<select name="status"><option value="pending">Pendiente</option><option value="liked">Me gusta</option><option value="disliked">No me gusta</option></select></label><label>Zona (opcional)<select name="zone"><option value="">Detección automática</option>${rows.map(row=>`<option value="${esc(row.id)}" ${zone?.id===row.id?'selected':''}>${zoneKindLabel(row.kind)} · ${esc(row.name)}</option>`).join('')}</select></label><label class="wide">Enlace<input name="url" type="url" placeholder="https://…"/></label><label class="wide notes-field">Notas<textarea name="notes" placeholder="Qué te gustó, visita, contacto…"></textarea></label><div class="form-buttons"><button type="button" class="secondary" id="cancel-property">Cancelar</button><button class="primary" type="submit">Localizar y guardar</button></div></form>`;
  document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);document.querySelector('#cancel-property')!.addEventListener('click',defaultDetail);
  document.querySelector<HTMLFormElement>('#property-form')!.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget as HTMLFormElement, submit=form.querySelector<HTMLButtonElement>('button[type="submit"]')!, data=new FormData(form);
    const name=String(data.get('name')).trim(), zoneId=String(data.get('zone')??'');
    let selectedZone=rows.find(row=>row.id===zoneId), latitude:number|undefined, longitude:number|undefined, locationSource:string|undefined, locationLabel:string|undefined;
    submit.disabled=true;submit.textContent='Localizando…';
    try {
      const geocoded=await geocodeAddress(name,active);
      if(geocoded){
        latitude=geocoded.latitude;longitude=geocoded.longitude;locationSource=geocoded.source;locationLabel=geocoded.displayName;
        const detected=findZoneAtPoint(zones,longitude,latitude);
        if(detected) selectedZone=rows.find(row=>row.id===detected.id)??selectedZone;
      }
    } catch(error) {
      locationSource=error instanceof Error?error.message:'No se pudo geocodificar';
    }
    if(latitude===undefined||longitude===undefined){
      const fallback=selectedZone?.feature?layers.get(selectedZone.id)?.getBounds().getCenter():map?.getCenter();
      latitude=fallback?.lat;longitude=fallback?.lng;
      locationSource=locationSource??(selectedZone?'Centro aproximado del barrio':'Centro actual del mapa');
    }
    const property:SeenProperty={id:crypto.randomUUID(),municipalityId:active.id,municipality:active.name,zoneId:selectedZone?.id,zoneName:selectedZone?.name,kind:String(data.get('kind')) as SeenProperty['kind'],name,url:String(data.get('url')??'').trim()||undefined,price:Number(data.get('price'))||undefined,areaM2:Number(data.get('areaM2'))||undefined,condition:String(data.get('condition')??'').trim()||undefined,status:String(data.get('status')) as SeenProperty['status'],notes:String(data.get('notes')??'').trim()||undefined,latitude,longitude,locationSource,locationLabel,createdAt:new Date().toISOString()};
    await saveSeenProperty(property);properties=await getSeenProperties();if(property.status==='liked')comparison.add(property.id);sidebar='properties';render();showProperty(property);
  });
}
function showProperty(item:SeenProperty){
  const detail=document.querySelector<HTMLDivElement>('#detail');if(!detail)return;
  const unitPrice=item.price&&item.areaM2?Math.round(item.price/item.areaM2):undefined;
  detail.innerHTML=`<div class="detail-head"><div><p class="eyebrow">${item.kind==='development'?'Promoción':'Piso'} visto</p><h2>${esc(item.name)}</h2><p>${esc(item.municipality)}${item.zoneName?' · '+esc(item.zoneName):''}</p></div><button class="icon-button" id="close-detail">×</button></div><div class="property-facts"><span><small>PRECIO</small>${item.price?item.price.toLocaleString('es-ES')+' €':'—'}</span><span><small>SUPERFICIE</small>${item.areaM2?item.areaM2.toLocaleString('es-ES')+' m²':'—'}</span><span><small>€/M²</small>${unitPrice?unitPrice.toLocaleString('es-ES')+' €':'—'}</span><span><small>ESTADO</small>${esc(item.condition??'—')}</span></div><div class="property-detail"><div class="status-switch">${(['liked','pending','disliked'] as const).map(status=>`<button data-property-status="${status}" class="${item.status===status?'active ':''}${status}">${statusIcon(status)} ${statusLabel(status)}</button>`).join('')}</div>${item.notes?`<p>${esc(item.notes)}</p>`:'<p class="muted-copy">Sin notas.</p>'}${item.url?`<a class="external-link" href="${esc(item.url)}" target="_blank" rel="noreferrer">Abrir anuncio ↗</a>`:''}</div><p class="geocode-note">${item.locationSource?.includes('Nominatim')?'✓ Dirección geocodificada automáticamente':esc(item.locationSource??'Ubicación no disponible')}${item.locationLabel?' · '+esc(item.locationLabel):''}</p>`;
  document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);
  document.querySelectorAll<HTMLButtonElement>('[data-property-status]').forEach(button=>button.addEventListener('click',async()=>{const updated={...item,status:button.dataset.propertyStatus as SeenProperty['status']};updated.status==='liked'?comparison.add(updated.id):comparison.delete(updated.id);await saveSeenProperty(updated);properties=await getSeenProperties();render();showProperty(updated)}));
}
function openZoneDetailHistory(){
  if(zoneDetailHistoryActive)return;
  history.pushState({...history.state,radarZoneDetail:true},'');
  zoneDetailHistoryActive=true;
}
function closeZoneDetail(updateHistory=true){
  if(!document.querySelector('#close-zone-detail'))return;
  focused=undefined;
  refreshStyles();
  defaultDetail();
  if(updateHistory&&zoneDetailHistoryActive){zoneDetailHistoryActive=false;history.back()}
}
window.addEventListener('popstate',()=>{
  if(!zoneDetailHistoryActive)return;
  zoneDetailHistoryActive=false;
  closeZoneDetail(false);
});
function defaultDetail(){const detail=document.querySelector<HTMLDivElement>('#detail');if(detail){detail.classList.remove('comparison');detail.innerHTML=defaultDetailHtml()}document.querySelector('#add-property-empty')?.addEventListener('click',()=>openPropertyForm())}
function openBreakdown(){
  const detail=document.querySelector<HTMLDivElement>('#detail')!, suggestions=interests().map(item=>item.name), source=officialSource();
  detail.innerHTML=`<div class="detail-head"><div><p class="eyebrow">Cobertura bajo demanda</p><h2>Crear desglose de ${esc(active.name)}</h2><p>Importa polígonos desde Internet o archivo, búscalos en OpenStreetMap o dibújalos.</p></div><button class="icon-button" id="close-detail">×</button></div><div class="breakdown-form"><div class="breakdown-fields"><label>Nombre del barrio o sector<input id="draw-zone-name" list="zone-suggestions" placeholder="Ej. Centre o Sector Nord"/><datalist id="zone-suggestions">${suggestions.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></label><label>Tipo de zona<select id="draw-zone-kind"><option value="barri">Barrio</option><option value="sector">Sector</option><option value="zone">Zona</option><option value="district">Distrito</option></select></label></div><div class="breakdown-actions-row"><button class="primary" id="online-zones">Buscar límites online</button><span class="divider-text">o</span><button class="secondary" id="start-drawing">Dibujar</button><button class="secondary" id="import-geojson">Importar archivo</button></div><input id="geojson-file" type="file" accept=".json,.geojson,application/geo+json" hidden/></div>${source?.vector && source.autoLoad !== false?`<div class="official-source-card"><div><strong>1ª fuente · Ayuntamiento</strong><span>${esc(source.title)}</span></div><button class="primary" id="import-official-source">Cargar polígonos oficiales</button></div>`:'' }${isAmbMunicipality(active)?`<div class="official-source-card fallback-source-card"><div><strong>2ª fuente · AMB</strong><span>${esc(ambAemSource.title)}${hasCompleteMunicipalCoverage()?' · respaldo disponible, no necesario':' · respaldo activo si falta cobertura municipal'}</span></div><button class="secondary" id="import-amb-source" ${hasCompleteMunicipalCoverage()?'disabled title="La fuente municipal ya ha pasado la validación"':''}>${hasCompleteMunicipalCoverage()?'Municipal validada':'Cargar respaldo AMB'}</button></div>`:'' }<div class="url-import"><label>URL de GeoJSON, API CKAN/OData, WFS o capa ArcGIS<input id="geojson-url" type="url" placeholder="https://…/resource/… o …/FeatureServer/0"/></label><button class="secondary" id="import-geojson-url">Importar desde Internet</button></div><p class="detail-foot">${source?`Fuente territorial verificada: <a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>. ${source.vector?(source.autoLoad===false?'Existe una fuente vectorial oficial, pero está marcada como cobertura incompleta y no se autoimporta.':'Existe una fuente vectorial oficial que la aplicación puede intentar cargar automáticamente.'):'La fuente oficial no publica una capa vectorial integrable directamente; usa su visor/PDF o una URL WFS si la facilita.'}${source.note?' '+esc(source.note):''}`:'No consta una capa municipal oficial de barrios. La búsqueda online usa OpenStreetMap y se identifica como comunitaria.'}<br>La importación detecta automáticamente campos de barrio, sector, zona o distrito. Las URLs CKAN/OData con geometría WKT, GeoJSON y ArcGIS se detectan automáticamente; el servidor debe permitir CORS.</p>`;
  document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);
  document.querySelector('#import-official-source')?.addEventListener('click',async()=>{const configured=officialSources[active.id];if(!configured)return;const button=document.querySelector<HTMLButtonElement>('#import-official-source')!;button.disabled=true;button.textContent='Cargando capa oficial…';try{await autoLoadOfficialMunicipalZones(active,configured);await reloadZoneSources(false);const defaults=defaultVisibility();for(const layer of ['barri','sector','municipalOther'] as ZoneLayer[]){if(defaults[layer])layerVisibility[layer]=true}if(hasCompleteMunicipalCoverage())layerVisibility.icgcPopulation=false;saveLayerVisibility(active.id,layerVisibility);rebuildVisibleZones();selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()}catch(error){detail.querySelector('.detail-foot')!.textContent=error instanceof Error?error.message:'No se pudo cargar la capa oficial.';button.disabled=false;button.textContent='Reintentar capa oficial'}});
  document.querySelector('#import-amb-source')?.addEventListener('click',async()=>{if(hasCompleteMunicipalCoverage())return;const button=document.querySelector<HTMLButtonElement>('#import-amb-source')!;button.disabled=true;button.textContent='Cargando AMB…';try{ambZones=await fetchAmbZonesNow(active);const defaults=defaultVisibility();for(const layer of ['barri','sector','municipalOther'] as ZoneLayer[]){if(defaults[layer])layerVisibility[layer]=true}rebuildVisibleZones();selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()}catch(error){detail.querySelector('.detail-foot')!.textContent=error instanceof Error?error.message:'No se pudo cargar la capa AMB.';button.disabled=false;button.textContent='Reintentar AMB'}});
  document.querySelector('#online-zones')!.addEventListener('click',async()=>{const button=document.querySelector<HTMLButtonElement>('#online-zones')!;button.disabled=true;button.textContent='Buscando…';try{await fetchOnlineZones(active);await reloadZoneSources(false);selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()}catch(error){detail.querySelector('.detail-foot')!.textContent=error instanceof Error?error.message:'No se pudieron obtener límites online.';button.disabled=false;button.textContent='Buscar límites online'}});
  document.querySelector('#start-drawing')!.addEventListener('click',()=>{const input=document.querySelector<HTMLInputElement>('#draw-zone-name')!,type=document.querySelector<HTMLSelectElement>('#draw-zone-kind')!,name=input.value.trim();if(!name){input.focus();return}startDrawing(name,type.value as ZoneKind)});
  const file=document.querySelector<HTMLInputElement>('#geojson-file')!;document.querySelector('#import-geojson')!.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{const selectedFile=file.files?.[0];if(!selectedFile)return;try{const collection=normalizeImportedCollection(JSON.parse(await selectedFile.text()) as GeoJSON.GeoJSON,active);await saveImportedCollection(active,collection);await reloadZoneSources(false);selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()}catch(error){detail.querySelector('.detail-foot')!.textContent=error instanceof Error?error.message:'No se pudo importar el archivo.'}});
  document.querySelector('#import-geojson-url')!.addEventListener('click',async()=>{const input=document.querySelector<HTMLInputElement>('#geojson-url')!,button=document.querySelector<HTMLButtonElement>('#import-geojson-url')!,url=input.value.trim();if(!url){input.focus();return}button.disabled=true;button.textContent='Importando…';try{await fetchGeoJsonUrl(url,active);await reloadZoneSources(false);selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()}catch(error){detail.querySelector('.detail-foot')!.textContent=error instanceof Error?error.message:'No se pudo importar la URL.';button.disabled=false;button.textContent='Importar desde Internet'}});
  mountAdvancedGisTools(detail,active,source,async()=>{await reloadZoneSources(false);selected=new Set(zones?.features.map(feature=>feature.id)??[]);render()});
}
function startDrawing(name:string,kind:ZoneKind='barri'){drawName=name;drawKind=kind;drawPoints=[];drawLayer?.remove();drawLayer=undefined;map?.getContainer().classList.add('drawing');map?.on('click',drawClick);drawingPanel()}
function drawClick(event:L.LeafletMouseEvent){drawPoints.push([event.latlng.lng,event.latlng.lat]);redraw();drawingPanel()}
function redraw(){drawLayer?.remove();drawLayer=undefined;if(drawPoints.length)drawLayer=L.polygon(drawPoints.map(point=>[point[1],point[0]] as L.LatLngTuple),{color:'#f4614c',weight:3,fillOpacity:.22}).addTo(map!)}
function drawingPanel(){
  const detail=document.querySelector<HTMLDivElement>('#detail')!;
  detail.innerHTML=`<div class="drawing-panel"><div><p class="eyebrow">Dibujando ${zoneKindLabel(drawKind)} · ${esc(drawName)}</p><h2>${drawPoints.length<3?'Marca al menos 3 puntos':'El polígono está listo'}</h2><p>Haz clic siguiendo el contorno. Llevas ${drawPoints.length} ${drawPoints.length===1?'punto':'puntos'}.</p></div><div class="drawing-actions"><button class="secondary" id="undo-point" ${drawPoints.length?'':'disabled'}>Deshacer</button><button class="secondary" id="cancel-drawing">Cancelar</button><button class="primary" id="finish-drawing" ${drawPoints.length>=3?'':'disabled'}>Cerrar y guardar</button></div></div>`;
  document.querySelector('#undo-point')!.addEventListener('click',()=>{drawPoints.pop();redraw();drawingPanel()});document.querySelector('#cancel-drawing')!.addEventListener('click',()=>{cancelDrawing();defaultDetail()});document.querySelector('#finish-drawing')!.addEventListener('click',finishDrawing);
}
async function finishDrawing(){if(drawPoints.length<3)return;const feature=createUserFeature(active,drawName,drawPoints,drawKind);await appendCustomFeature(active,feature);cancelDrawing();await reloadZoneSources(false);selected.add(feature.id);focused=feature.id;render();const row=zoneRows().find(item=>item.id===feature.id);if(row)void showZone(row)}
function cancelDrawing(){map?.off('click',drawClick);map?.getContainer().classList.remove('drawing');drawLayer?.remove();drawLayer=undefined;drawName='';drawKind='barri';drawPoints=[]}
function openComparison(ids?:string[]){
  const activeLiked=municipalityProperties().filter(item=>item.status==='liked');
  const candidates=ids?.length?ids.map(id=>properties.find(item=>item.id===id)).filter((item):item is SeenProperty=>Boolean(item)):(activeLiked.length>=2?activeLiked:properties.filter(item=>item.status==='liked'));
  const items=candidates.slice(0,4),detail=document.querySelector<HTMLDivElement>('#detail')!;detail.classList.add('comparison');
  if(items.length<2){
    detail.innerHTML=`<div class="detail-head"><div><h2>Comparar favoritos</h2><p>Marca al menos dos pisos como “Me gusta” o selecciónalos en Pisos vistos.</p></div><button class="icon-button" id="close-detail">×</button></div>`;
    document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);return;
  }
  comparison=new Set(items.map(item=>item.id));
  const value=(item:SeenProperty,key:'price'|'area'|'unit'|'zone'|'condition'|'status'|'url')=>{
    if(key==='price')return item.price?item.price.toLocaleString('es-ES')+' €':'—';
    if(key==='area')return item.areaM2?item.areaM2.toLocaleString('es-ES')+' m²':'—';
    if(key==='unit')return item.price&&item.areaM2?Math.round(item.price/item.areaM2).toLocaleString('es-ES')+' €/m²':'—';
    if(key==='zone')return esc(item.zoneName??'Sin asignar');
    if(key==='condition')return esc(item.condition??'—');
    if(key==='status')return statusIcon(item.status)+' '+statusLabel(item.status);
    return item.url?`<a href="${esc(item.url)}" target="_blank" rel="noreferrer">Abrir anuncio ↗</a>`:'—';
  };
  const rows:[string,'price'|'area'|'unit'|'zone'|'condition'|'status'|'url'][]=[['Precio','price'],['m²','area'],['€/m²','unit'],['Barrio','zone'],['Estado','condition'],['Valoración','status'],['Enlace','url']];
  detail.innerHTML=`<div class="comparison-head"><div><h2>Comparar favoritos (${items.length})</h2><p>Hasta cuatro viviendas en paralelo.</p></div><div><button class="primary" id="comparison-map">Ver en mapa</button><button class="secondary" id="close-detail">Cerrar</button></div></div><div class="comparison-scroll"><table class="comparison-table"><thead><tr><th></th>${items.map(item=>`<th>${esc(item.name)}<small>${esc(item.municipality)}</small></th>`).join('')}</tr></thead><tbody>${rows.map(([label,key])=>`<tr><th>${label}</th>${items.map(item=>`<td>${value(item,key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);
  document.querySelector('#comparison-map')!.addEventListener('click',async()=>{const target=catalog.municipalities.find(municipality=>municipality.id===items[0].municipalityId);if(target&&target.id!==active.id)await selectMunicipality(target);const points=items.filter(item=>item.municipalityId===active.id&&item.latitude!==undefined&&item.longitude!==undefined).map(item=>L.latLng(item.latitude!,item.longitude!));if(points.length&&map)map.fitBounds(L.latLngBounds(points),{padding:[80,80],maxZoom:16});openComparison(items.map(item=>item.id))});
}

function locate(){if(!navigator.geolocation||!map)return;navigator.geolocation.getCurrentPosition(position=>{const point=L.latLng(position.coords.latitude,position.coords.longitude);L.circle(point,{radius:position.coords.accuracy,color:'#2f78c4',fillOpacity:.1}).addTo(map!);L.marker(point).addTo(map!).bindPopup(`Ubicación aproximada · precisión ${Math.round(position.coords.accuracy)} m`).openPopup();map!.setView(point,14)},()=>alert('No se pudo obtener la ubicación.'))}
async function openSaved(){const notes=await getNotes(),rows=zoneRows().filter(row=>notes[row.id]?.favorite),detail=document.querySelector<HTMLDivElement>('#detail')!;detail.innerHTML=`<div class="detail-head"><div><p class="eyebrow">En este dispositivo</p><h2>Barrios guardados</h2><p>${rows.length?rows.length+' favoritos':'Todavía no has guardado barrios.'}</p></div><button class="icon-button" id="close-detail">×</button></div>${rows.length?`<div class="saved-list">${rows.map(row=>savedRow(row,notes[row.id])).join('')}</div>`:''}`;document.querySelector('#close-detail')!.addEventListener('click',defaultDetail);detail.querySelectorAll<HTMLButtonElement>('[data-saved-zone]').forEach(button=>button.addEventListener('click',()=>focusZone(button.dataset.savedZone!)))}
function savedRow(row:ZoneRow,note:ZoneNote){const summary=[note.rating?note.rating+' / 5':'',note.text?esc(note.text):'Sin observaciones'].filter(Boolean).join(' · ');return `<button class="saved-row" data-saved-zone="${row.id}"><span><strong>${esc(row.name)}</strong><small>${esc(active.name)}</small></span><em>${summary}</em></button>`}
if(import.meta.env.PROD && 'serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}));
init().catch(error=>{app.innerHTML=`<p class="load-error">No se pudieron cargar los datos. ${error instanceof Error?esc(error.message):''}</p>`});
