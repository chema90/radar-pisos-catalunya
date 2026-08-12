import type { Municipality, ZoneCollection, ZoneKind } from './types';
import { fetchGeoJsonUrl } from './zone-data';
import { discoverGeoLayers } from './source-discovery';
import { normalizeText } from './municipality-matching';

export type OfficialSource = {
  title: string;
  url: string;
  vector: boolean;
  directUrl?: string;
  devUrl?: string;
  note?: string;
  expectedKinds?: ZoneKind[];
  discover?: 'wfs-neighbourhoods' | 'portal-neighbourhoods';
  minimumExpectedFeatures?: number;
  autoLoad?: boolean;
  geometryField?: string;
};

export const officialSources: Record<string, OfficialSource> = {
  '080193': { title: 'Open Data BCN · 73 barris', url: 'https://opendata-ajuntament.barcelona.cat/data/ca/dataset/20170706-districtes-barris', vector: true, expectedKinds: ['barri'], minimumExpectedFeatures: 73 },
  '170792': { title: 'Ajuntament de Girona · barris', url: 'https://www.girona.cat/opendata/', vector: true, expectedKinds: ['barri'], minimumExpectedFeatures: 9 },
  '081878': {
    title: 'Ajuntament de Sabadell · divisions territorials',
    url: 'https://geoserver.ajsabadell.cat/geoserver/sbdwfs/ows?service=WFS',
    devUrl: '/official/sabadell/geoserver/sbdwfs/ows?service=WFS',
    vector: true,
    expectedKinds: ['barri'],
    discover: 'wfs-neighbourhoods',
    minimumExpectedFeatures: 40,
    note: 'WFS oficial de l’Ajuntament de Sabadell. Se prioriza la capa de barris sobre sectores y distritos.',
  },
  '082798': {
    title: 'Ajuntament de Terrassa · barris',
    url: 'https://emap.terrassa.cat/arcgis/rest/services/Utilitaris/ajt_divadm/MapServer/1',
    directUrl: 'https://emap.terrassa.cat/arcgis/rest/services/Utilitaris/ajt_divadm/MapServer/1',
    devUrl: '/official/terrassa/arcgis/rest/services/Utilitaris/ajt_divadm/MapServer/1',
    vector: true,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 30,
    note: 'Capa oficial pt_barri del servei ArcGIS municipal.',
  },
  '251207': {
    title: 'Ajuntament de Lleida · Barris',
    url: 'https://services-eu1.arcgis.com/b3xvlitgAlvZlUNZ/ArcGIS/rest/services/Barris_Lleida/FeatureServer',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 12,
    note: 'Feature Layer municipal Barris_Lleida publicada en la plataforma ArcGIS de la Paeria.',
  },
  '081213': {
    title: 'Ajuntament de Mataró · límit de barris',
    url: 'https://serveisweb.mataro.cat/visorSIG/images/RecursosVisor/SSIT/minisite/descarrega_productes/BARRIS_etrs89.zip',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 11,
    note: 'SHP oficial ETRS89. Se actualiza desde 01_ACTUALIZAR_DATOS.cmd.',
  },
  '083015': {
    title: 'Ajuntament de Viladecans · Població per Barris',
    url: 'https://geoportal.viladecans.cat/server/rest/services/Poblaci%C3%B3_per_Barris/FeatureServer',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 5,
    note: 'FeatureServer municipal amb geometria poligonal i camps barri/nom_barri. El 01_ACTUALITZAR_DATOS valida la capa abans d’activar-la.',
  },
  '082055': {
    title: 'Ajuntament de Sant Cugat · Barris',
    url: 'https://geo.santcugat.cat/geoserver/ows',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri', 'zone'],
    minimumExpectedFeatures: 53,
    discover: 'wfs-neighbourhoods',
    note: 'GeoServer oficial. La geometría nativa auditada se conserva como 53 zonas de Sant Cugat (43 residenciales + 10 forestales/actividad económica) y 15 zonas separadas en la EMD Valldoreix.',
  },
  '083054': { title: 'Ajuntament de Vilafranca · 8 barris oficials', url: 'https://contractaciopublica.cat/portal-api/descarrega-document/302015698/624084B4F450FB873CF2523E979EF631', vector: false, note: 'Se conservan los 8 nombres municipales. No se confunden con los núcleos/urbanizaciones ICGC o DIBA mientras no exista una capa vectorial de barrios validada.' },
  '082401': { title: 'Ajuntament de Sant Sadurní · 7 barris tradicionals', url: 'https://santsadurni.cat/festadelsbarris', vector: false, note: 'Los siete barrios son una división tradicional/histórica confirmada por el Ayuntamiento. Sin polígono vectorial municipal público validado no se dibujan límites inventados.' },
  '082310': { title: 'Ajuntament de Sant Pere de Ribes · municipi', url: 'https://www.santperederibes.cat/municipi', vector: false },
  '083073': {
    title: 'Ajuntament de Vilanova i la Geltrú · Barris',
    url: 'https://www.vilanova.cat/mapes-oberts',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 18,
    note: 'El WMS municipal publica la capa BARRIS y el Ayuntamiento describe 18 ámbitos vecinales. El actualizador intenta obtener vector WFS/KML y solo lo guarda si supera la validación.',
  },
  '431310': {
    title: 'Roda de Berà · nuclis i urbanitzacions',
    url: 'https://web.rodadebera.cat/turisme/punts-interes/roc-sant-gaieta',
    vector: false,
    note: 'Roc de Sant Gaietà está confirmado como urbanización/ámbito local; su polígono se toma de la capa oficial ICGC de áreas de poblamiento, no se etiqueta como barrio administrativo.',
  },
  '430120': {
    title: "Ajuntament d'Altafulla · tres nuclis de població",
    url: 'https://altafulla.cat/el-municipi/la-vila',
    vector: false,
    note: 'El Ayuntamiento distingue Altafulla centre, Altafulla platja/barri marítim y Brises del Mar. Se enlazan con polígonos ICGC cuando existe coincidencia territorial.',
  },
  '080728': {
    title: 'Ajuntament de Corbera · nuclis i urbanitzacions',
    url: 'https://www.corberadellobregat.cat/municipi/equipaments/zones-infantils-del-municipi.html',
    vector: false,
    note: 'El Ayuntamiento diferencia nucli urbà de la zona baixa, nucli urbà de la zona alta y urbanizaciones. Los nombres largos del ICGC se muestran como núcleos/urbanizaciones, no como barrios.',
  },
  '171609': {
    title: 'Arxiu Municipal de Sant Feliu de Guíxols · proposta de barris',
    url: 'https://www.arxiumunicipal.guixols.cat/tallers-d-historia/els-barris-de-sant-feliu.html',
    vector: false,
    note: 'Propuesta municipal/didáctica de barrios (2009), contrastada con entidades vecinales. Los nueve nombres coinciden con el plano publicado, pero el Archivo no ofrece un fichero vectorial ni coordenadas: se muestran expresamente como propuesta, no como división oficial ni como geometría inventada.',
  },
  '171523': {
    title: 'Ajuntament de Roses · Sistema d’Informació Geogràfica',
    url: 'https://www.roses.cat/la-vila/urbanisme/gis',
    vector: false,
    note: 'Auditoría 12/08/2026: el GIS municipal publica topografía, PGOU, ámbitos urbanísticos y redes de servicios. Su WMS POUM no es una división de barrios; no se activa como tal mientras el Ayuntamiento no publique límites específicos.',
  },
  '080060': {
    title: 'Ajuntament d’Arenys de Mar · visor urbanístic',
    url: 'https://arenysdemar.cat/visor_urbanistic/',
    vector: false,
    note: 'Auditoría 12/08/2026: el visor municipal ofrece límite municipal, secciones censales, catastro, POUM y redes. No publica una capa de barrios; las secciones censales no se presentan como barrios.',
  },
  '080076': {
    title: 'Ajuntament d’Arenys de Munt · información territorial',
    url: 'https://www.arenysdemunt.cat/arees/urbanisme/planificacio-urbanistica',
    vector: false,
    note: 'El Ayuntamiento documenta núcleos y urbanizaciones en su información territorial. No se ha localizado una capa municipal de límites de barrio; estos ámbitos no se convierten automáticamente en barrios.',
  },
  '081727': {
    title: 'Ajuntament de Premià de Mar · portal cartogràfic SITMUN',
    url: 'https://sitmun.diba.cat/idelocals/?mun_ine=08172',
    vector: false,
    note: 'Auditoría 12/08/2026: el municipio dispone de portal cartográfico SITMUN. El ámbito Santa Maria–Santa Anna–Tió corresponde al Plan de Barrios, no a una división completa municipal; sigue pendiente una capa específica de barrios validable.',
  },
  '082824': {
    title: 'Ajuntament de Tiana · información municipal',
    url: 'https://tiana.cat/',
    vector: false,
    note: 'Mas Ram y la Virreina constan como barrios y el Nucli antic como núcleo. No se ha localizado una capa municipal vectorial de sus límites; DIBA/SITMUN solo se usa como referencia, nunca como sustituto de barrios municipales.',
  },
  '082819': {
    title: 'Ajuntament de Teià · información territorial',
    url: 'https://www.teia.cat/',
    vector: false,
    note: 'Auditoría 12/08/2026: no se ha localizado una división municipal de barrios con límites públicos. Cualquier núcleo o urbanización se mantendrá con su clasificación real y no se renombrará como barrio.',
  },
  '080961': {
    title: 'Ajuntament de Granollers · LIMIT BARRIS',
    url: 'https://www.arcgis.com/home/item.html?id=fb50ca53af1644259286dd00cf8b6a1b',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 16,
    note: 'ArcGIS municipal: la capa Divisió de barris / LIMIT BARRIS se busca y valida antes de activarse.',
  },
  '081249': {
    title: 'Ajuntament de Mollet · Plànol de barris',
    url: 'https://www.molletvalles.cat/ca/la-ciutat/planol-de-barris',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 13,
    note: 'Los 13 nombres actuales se conservan; el actualizador solo añade geometría si el portal expone una capa vectorial de barris validable.',
  },
  '082981': {
    title: 'Ajuntament de Vic · Pla Director de Barris',
    url: 'https://www.vic.cat/serveis/ciutadania/ciutadania/suport-municipal-als-barris',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 14,
    note: 'Vic confirma 14 barrios delimitados. Se sondea el Portal d’Informació Urbanística y solo se guarda vector si coincide con esa división.',
  },
  '081136': {
    title: 'Ajuntament de Manresa · Mapa dels barris',
    url: 'https://www.manresa.cat/sigmap/guia/',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    note: 'El Ayuntamiento publica un mapa específico de barris; se sondea el visor para localizar un servicio vectorial, sin digitalizar el mapa.',
  },
  '171143': {
    title: 'Ajuntament d’Olot · Geoportal municipal',
    url: 'https://sig.olot.cat/enmapa25/visor/geoportal',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    note: 'Geoportal oficial. Solo se activa una capa si el servicio expone explícitamente barris y supera la validación territorial.',
  },
  '431634': {
    title: 'Ajuntament del Vendrell · Visor GIS',
    url: 'https://www.elvendrell.net/visor-gis?cc=1&ot=15&t=101',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    note: 'Visor GIS municipal con capas conmutables. Se busca estrictamente una capa de barris; núcleos y urbanizaciones no se convierten en barrios.',
  },
  '170950': {
    title: 'Ajuntament de Lloret · Zonificacions administratives',
    url: 'https://opendata.lloret.cat',
    vector: true,
    autoLoad: false,
    expectedKinds: ['zone'],
    minimumExpectedFeatures: 10,
    note: 'Open Data oficial en GeoJSON. Se muestra como zonificación administrativa y no se renombra automáticamente como barrios.',
  },
  '170237': {
    title: 'Ajuntament de Blanes · àmbits veïnals documentats',
    url: 'https://www.blanes.cat/docweb/participa.local.av',
    vector: false,
    note: 'El Ayuntamiento documenta barrios y asociaciones vecinales, pero no se ha localizado una capa vectorial pública de límites; se conservan los nombres sin inventar polígonos.',
  },
  '170669': {
    title: 'Ajuntament de Figueres · Barris',
    url: 'https://www.figueres.cat/temes/barris',
    vector: false,
    note: 'El Ayuntamiento mantiene el ámbito de Barris y asociaciones vecinales, pero no se ha localizado un servicio vectorial público de límites de barrio validable.',
  },
  '081022': {
    title: 'Ajuntament d’Igualada · cartografia municipal',
    url: 'https://www.igualada.cat/',
    vector: false,
    note: 'Se ha localizado cartografía de distritos, no una capa oficial de polígonos de barrios. No se presentan distritos como barrios.',
  },
  '081846': {
    title: 'Ajuntament de Rubí · Alcaldessa als barris',
    url: 'https://gis.rubi.cat/alcaldessa_als_barris/',
    vector: true,
    autoLoad: false,
    expectedKinds: ['zone'],
    minimumExpectedFeatures: 9,
    note: 'La fuente municipal publica nueve polígonos de ámbitos de barrio con sus 23 nombres agrupados. Se muestran como ámbitos municipales, no como 23 barrios individuales: no se inventan límites internos.',
  },
  '081960': {
    title: 'Ajuntament de Sant Andreu de la Barca · Mapa de divisió de barris',
    url: 'https://sabarca.cat/regidories-de-barri',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 8,
    note: 'El mapa municipal publica ocho GeoJSON, uno por cada barrio. Se actualizan desde 01_ACTUALIZAR_DATOS.cmd y se conservan como división municipal oficial.',
  },
  '081252': {
    title: 'Ajuntament de Montcada i Reixac · Geoportal + barris',
    url: 'https://www.montcada.cat/el-municipi/informacio-geografica',
    vector: false,
    note: 'El Ayuntamiento confirma 12 barrios/núcleos actuales y mantiene un Geoportal con servicios geográficos normalizados. Sigue pendiente localizar una capa pública específica de sus límites de barrio.',
  },
  '082457': {
    title: 'Ajuntament de Santa Coloma de Gramenet · Cartografia de barris',
    url: 'https://www.gramenet.cat/ajuntament/arees-municipals/planejament-urbanistic-informacio-urbanistica/cartografia/',
    vector: false,
    note: 'La cartografía municipal vigente publica el plano de los 17 barrios. En la auditoría de 12/08/2026 solo entrega PDF, no una capa vectorial descargable; se conservan los nombres municipales sin dibujar aproximaciones.',
  },
  '080734': {
    title: 'Ajuntament de Cornellà · organització territorial de barris',
    url: 'https://www.cornella.cat/ca/viure-a-cornella/la-ciutat/dades-basiques',
    vector: false,
    note: 'El Ayuntamiento publica el plano y la organización territorial oficial de 7 barrios. La auditoría de 12/08/2026 no ha localizado una capa vectorial municipal; la imagen/plano no se digitaliza por aproximación.',
  },
  '082009': {
    title: 'Ajuntament de Sant Boi · cartografia i dades obertes',
    url: 'https://cartoweb.santboi.cat/server/rest/services',
    vector: false,
    note: 'El portal ArcGIS municipal público expone ABS y capas temáticas, no una Feature Layer inequívoca de límites de barrio. Los seis candidatos AMB se mantienen bloqueados: ABS/secciones no se usan como barrios.',
  },
  '082172': {
    title: 'Ajuntament de Sant Joan Despí · Els barris',
    url: 'https://sjdespi.cat/sant-joan-despi/els-barris',
    vector: false,
    note: 'El Ayuntamiento confirma Centre, Les Begudes, Les Planes, Pla del Vent - Torreblanca y Residencial Sant Joan. La auditoría de 12/08/2026 no ha localizado una capa vectorial municipal; los candidatos AMB no coinciden de forma uno-a-uno y permanecen inactivos.',
  },
  '431482': {
    title: 'Ajuntament de Tarragona · Barris + zones municipals',
    url: 'https://geoportal.tarragona.cat/server/rest/services/Hosted/Barris/FeatureServer/0',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 10,
    note: 'El Geoportal municipal publica una Feature Layer poligonal específica Barris. El actualizador la combina con las 11 zonas amplias derivadas de las UMT cuando ambas fuentes están disponibles; una caída temporal de UMT no debe borrar las zonas ya validadas.',
  },
  '080771': {
    title: "Ajuntament d'Esplugues · plànol vectorial municipal",
    url: 'https://mun.nexusgeographics.com/esplugues42/visor/geoportal?centre=423760.0,4581325.0&capes=pgclassificacio;pgqualifict;pgqualific;pgvolum;pgexpedients;limitadm;vial;topo&',
    vector: true,
    autoLoad: false,
    expectedKinds: ['barri'],
    discover: 'portal-neighbourhoods',
    minimumExpectedFeatures: 10,
    note: 'El Ayuntamiento confirma 10 barrios. El geoportal Nexus se analiza buscando servicios WFS/WMS/ArcGIS; no se inventa geometría si no expone una capa descargable validable.',
  },
  '081017': {
    title: 'Ajuntament de l\'Hospitalet · Divisions territorials · Barris',
    url: 'https://seu-e.cat/ca/web/hospitaletdellobregat/dades-obertes/-/dadesobertes/dataset/hospitaletdellobregat-divisions-territorials/resource/bd2277b0-dce7-4a92-a923-bbe6620175ea',
    directUrl: 'https://dadesobertes.seu-e.cat/api/aoc/action/odata/bd2277b0-dce7-4a92-a923-bbe6620175ea?$format=json',
    devUrl: '/official/hospitalet/api/aoc/action/odata/bd2277b0-dce7-4a92-a923-bbe6620175ea?$format=json',
    vector: true,
    expectedKinds: ['barri'],
    minimumExpectedFeatures: 13,
    geometryField: 'Geometria_WGS84_LonLat',
    note: 'API CKAN/OData oficial. La geometría WGS84 llega como WKT y se convierte automáticamente a GeoJSON.',
  },
};

export function runtimeSourceUrl(source: OfficialSource): string {
  if (import.meta.env.DEV && source.devUrl) return new URL(source.devUrl, window.location.origin).toString();
  return source.directUrl ?? source.url;
}

export function sourceAlreadyCovered(collection: ZoneCollection | undefined, source: OfficialSource): boolean {
  if (!collection?.features.length) return false;
  const expected = source.expectedKinds ?? [];
  if (!expected.length) return collection.features.length > 0;
  const matching = collection.features.filter(feature => expected.includes(feature.properties.kind) && feature.properties.quality === 'official');
  return matching.length >= (source.minimumExpectedFeatures ?? 1);
}

function scoreNeighbourhoodLayer(title: string, detail = ''): number {
  const value = normalizeText(`${title} ${detail}`);
  let score = 0;
  if (/\bbarris?\b|\bbarrios?\b|\bneighbou?rhoods?\b/.test(value)) score += 100;
  if (/\bbarri\b|\bbarrio\b/.test(value)) score += 80;
  if (/\bdivision/.test(value)) score += 10;
  if (/\bsector/.test(value)) score -= 45;
  if (/\bdistrict/.test(value)) score -= 55;
  if (/\bseccio|\bsection/.test(value)) score -= 60;
  if (/\bcarrer|\badre|\baddress|\bpostal/.test(value)) score -= 80;
  return score;
}

export async function autoLoadOfficialMunicipalZones(municipality: Municipality, source: OfficialSource): Promise<void> {
  const endpoint = runtimeSourceUrl(source);
  if (source.discover) {
    const candidates = await discoverGeoLayers(endpoint);
    const best = [...candidates]
      .map(layer => ({ layer, score: scoreNeighbourhoodLayer(layer.title, layer.detail) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 60) throw new Error('El WFS oficial está disponible, pero no se ha podido identificar con seguridad la capa de barrios.');
    await fetchGeoJsonUrl(best.layer.importUrl, municipality, {
      title: `${source.title} · ${best.layer.title}`,
      organization: `Ajuntament de ${municipality.name}`,
      official: true,
    });
    return;
  }
  if (source.directUrl || source.devUrl) {
    await fetchGeoJsonUrl(endpoint, municipality, {
      title: source.title,
      organization: `Ajuntament de ${municipality.name}`,
      official: true,
      geometryField: source.geometryField,
    });
  }
}
