import type { Municipality } from './types';
import { countGeneratedImportedZones, countLocalZones, fetchGeoJsonUrl, normalizeImportedCollection, removeGeneratedImportedZones, resetLocalZones, saveImportedCollection } from './zone-data';
import { parseGeospatialFiles } from './geo-import';
import { checkSource, discoverGeoLayers, getSourceCheck, monitorOfficialSources } from './source-discovery';

type OfficialSource = { title: string; url: string; vector: boolean; directUrl?: string; note?: string };
type Refresh = () => void | Promise<void>;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);

export function startOfficialSourceMonitoring(sources: Record<string, OfficialSource>) {
  void monitorOfficialSources(Object.values(sources));
}

export function mountAdvancedGisTools(detail: HTMLDivElement, municipality: Municipality, source: OfficialSource | undefined, refresh: Refresh) {
  const foot = detail.querySelector('.detail-foot');
  if (!foot) return;
  const check = source ? getSourceCheck(source.directUrl ?? source.url) : undefined;
  const section = document.createElement('section');
  section.className = 'advanced-gis';
  section.innerHTML = `
    <div class="advanced-file-row">
      <div><strong>Archivos GIS profesionales</strong><span>Shapefile, KML, GML/XML y GeoPackage; también conserva la importación GeoJSON actual.</span></div>
      <button class="secondary" id="import-advanced-gis">Importar GIS</button>
      <input id="advanced-gis-file" type="file" multiple accept=".kml,.gml,.xml,.geojson,.json,.gpkg,.zip,.shp,.dbf,.prj,.cpg" hidden>
    </div>
    <div class="import-cleanup" id="import-cleanup" hidden>
      <span id="import-cleanup-text"></span>
      <button class="secondary compact" id="clean-generated-zones">Limpiar</button>
    </div>
    <div class="import-reset" id="import-reset" hidden>
      <span id="import-reset-text"></span>
      <button class="secondary compact danger" id="reset-local-zones">Borrar desglose local</button>
    </div>
    ${source ? `<div class="source-monitor"><span class="source-status ${check?.status ?? 'unknown'}"></span><div><strong>Control de la fuente oficial</strong><small>${escapeHtml(check?.detail ?? 'Pendiente de primera comprobación semanal')}</small></div><button class="secondary compact" id="check-source-now">Comprobar ahora</button></div>` : ''}
    <div class="source-assistant">
      <div class="assistant-copy"><strong>Asistente de geoportales</strong><span>Descubre capas de barrios desde un visor, WFS o servicio ArcGIS.</span></div>
      <div class="assistant-form"><input id="geoportal-url" type="url" value="${escapeHtml(source?.url ?? '')}" placeholder="https://geoportal…"><button class="secondary" id="discover-layers">Descubrir capas</button></div>
      <div class="discovery-results" id="discovery-results" aria-live="polite"></div>
    </div>`;
  foot.before(section);

  const cleanup = section.querySelector<HTMLDivElement>('#import-cleanup')!;
  const cleanupText = section.querySelector<HTMLSpanElement>('#import-cleanup-text')!;
  const cleanupButton = section.querySelector<HTMLButtonElement>('#clean-generated-zones')!;
  const reset = section.querySelector<HTMLDivElement>('#import-reset')!;
  const resetText = section.querySelector<HTMLSpanElement>('#import-reset-text')!;
  const resetButton = section.querySelector<HTMLButtonElement>('#reset-local-zones')!;
  const updateLocalTools = async () => {
    const [generated, local] = await Promise.all([countGeneratedImportedZones(municipality), countLocalZones(municipality)]);
    cleanup.hidden = generated === 0;
    cleanupText.textContent = generated === 1
      ? 'Hay 1 zona generica importada sin nombre real.'
      : `Hay ${generated} zonas genericas importadas sin nombre real.`;
    reset.hidden = local === 0;
    resetText.textContent = local === 1
      ? 'Hay 1 zona local guardada para este municipio.'
      : `Hay ${local} zonas locales guardadas para este municipio.`;
  };
  void updateLocalTools();
  cleanupButton.addEventListener('click', async () => {
    cleanupButton.disabled = true;
    cleanupButton.textContent = 'Limpiando...';
    const removed = await removeGeneratedImportedZones(municipality);
    foot.textContent = removed ? `Se eliminaron ${removed} zonas genericas importadas.` : 'No habia zonas genericas que limpiar.';
    await refresh();
  });
  resetButton.addEventListener('click', async () => {
    const confirmed = window.confirm(`Esto borrara el desglose local de ${municipality.name}: importaciones GIS y zonas dibujadas. No borra pisos vistos, notas ni favoritos. ¿Continuar?`);
    if (!confirmed) return;
    resetButton.disabled = true;
    resetButton.textContent = 'Borrando...';
    const removed = await resetLocalZones(municipality);
    foot.textContent = removed ? `Se borraron ${removed} zonas locales. Ahora puedes importar el ZIP de nuevo.` : 'No habia desglose local que borrar.';
    await refresh();
  });

  const picker = section.querySelector<HTMLInputElement>('#advanced-gis-file')!;
  const importButton = section.querySelector<HTMLButtonElement>('#import-advanced-gis')!;
  importButton.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const files = [...(picker.files ?? [])];
    if (!files.length) return;
    importButton.disabled = true;
    importButton.textContent = 'Leyendo archivo…';
    try {
      const imported = await parseGeospatialFiles(files);
      const collection = normalizeImportedCollection(imported.collection, municipality);
      collection.source.title = `${imported.format} importado${imported.layers.length > 1 ? ` · ${imported.layers.length} capas` : ''}`;
      await saveImportedCollection(municipality, collection);
      await refresh();
    } catch (error) {
      foot.textContent = error instanceof Error ? error.message : 'No se pudo importar el archivo GIS.';
      importButton.disabled = false;
      importButton.textContent = 'Importar GIS';
    }
  });

  section.querySelector('#check-source-now')?.addEventListener('click', async () => {
    if (!source) return;
    const button = section.querySelector<HTMLButtonElement>('#check-source-now')!;
    button.disabled = true;
    button.textContent = 'Comprobando…';
    const result = await checkSource(source.directUrl ?? source.url);
    const status = section.querySelector<HTMLElement>('.source-status')!;
    status.className = `source-status ${result.status}`;
    section.querySelector<HTMLElement>('.source-monitor small')!.textContent = result.detail;
    button.disabled = false;
    button.textContent = 'Comprobar ahora';
  });

  const discoverButton = section.querySelector<HTMLButtonElement>('#discover-layers')!;
  const portalInput = section.querySelector<HTMLInputElement>('#geoportal-url')!;
  const results = section.querySelector<HTMLDivElement>('#discovery-results')!;
  discoverButton.addEventListener('click', async () => {
    const url = portalInput.value.trim();
    if (!url) { portalInput.focus(); return; }
    discoverButton.disabled = true;
    discoverButton.textContent = 'Analizando…';
    results.innerHTML = '<p>Buscando servicios y capas vectoriales…</p>';
    try {
      const found = await discoverGeoLayers(url);
      results.innerHTML = found.length ? found.map((layer, index) => `<div class="discovery-row"><span><strong>${escapeHtml(layer.title)}</strong><small>${layer.kind}${layer.detail ? ` · ${escapeHtml(layer.detail)}` : ''}</small></span><button class="secondary compact" data-import-layer="${index}">Importar</button></div>`).join('') : '<p>No se encontraron capas compatibles.</p>';
      results.querySelectorAll<HTMLButtonElement>('[data-import-layer]').forEach(button => button.addEventListener('click', async () => {
        const layer = found[Number(button.dataset.importLayer)];
        button.disabled = true;
        button.textContent = 'Importando…';
        try {
          await fetchGeoJsonUrl(layer.importUrl, municipality, { title: layer.title, organization: new URL(layer.sourceUrl).hostname });
          await refresh();
        } catch (error) {
          const message = document.createElement('p');
          message.className = 'source-error';
          message.textContent = error instanceof Error ? error.message : 'No se pudo importar la capa.';
          results.append(message);
          button.disabled = false;
          button.textContent = 'Reintentar';
        }
      }));
    } catch (error) {
      results.innerHTML = `<p class="source-error">${escapeHtml(error instanceof Error ? error.message : 'No se pudo analizar el geoportal.')}</p>`;
    } finally {
      discoverButton.disabled = false;
      discoverButton.textContent = 'Descubrir capas';
    }
  });
}
