import L from 'leaflet';
import type { Municipality } from './types';

type BoundsLite = { west:number; south:number; east:number; north:number };

function geometryBounds(geometry: GeoJSON.Geometry | null): BoundsLite | undefined {
  if (!geometry || !('coordinates' in geometry)) return undefined;
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  const visit=(value:unknown):void=>{
    if(!Array.isArray(value))return;
    if(value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'){
      west=Math.min(west,value[0]);east=Math.max(east,value[0]);south=Math.min(south,value[1]);north=Math.max(north,value[1]);return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  return Number.isFinite(west)?{west,south,east,north}:undefined;
}

function intersects(bounds:BoundsLite,view:L.LatLngBounds){
  return !(bounds.east<view.getWest()||bounds.west>view.getEast()||bounds.north<view.getSouth()||bounds.south>view.getNorth());
}

export function mountMunicipalityContext(map:L.Map,municipalities:Municipality[],active:Municipality,enabled:boolean):void{
  if(!enabled)return;
  const polygonPane=map.createPane('municipality-context-polygons');polygonPane.style.zIndex='330';polygonPane.style.pointerEvents='none';
  const labelPane=map.createPane('municipality-context-labels');labelPane.style.zIndex='445';labelPane.style.pointerEvents='none';
  let group:L.LayerGroup|undefined;
  const primaryId=active.entityType==='emd'?(active.parentMunicipalityId??''):active.id;

  const draw=()=>{
    group?.remove();
    const next=L.layerGroup();
    const view=map.getBounds().pad(.16),zoom=map.getZoom();
    const maxItems=zoom>=11?80:zoom>=9?45:24;
    const visible=municipalities
      .filter(item=>item.entityType!=='emd'&&item.geometry)
      .map(item=>({item,bounds:geometryBounds(item.geometry)}))
      .filter((entry):entry is {item:Municipality;bounds:BoundsLite}=>Boolean(entry.bounds&&intersects(entry.bounds,view)))
      .sort((a,b)=>Number(b.item.id===primaryId)-Number(a.item.id===primaryId)||a.item.name.localeCompare(b.item.name,'ca'))
      .slice(0,maxItems);

    visible.forEach(({item})=>{
      const current=item.id===primaryId;
      const layer=L.geoJSON(item.geometry!,{
        pane:'municipality-context-polygons',interactive:false,
        // The surrounding municipalities are an orientation layer. Give them a
        // legible outline while keeping the selected municipality unmistakable.
        style:{color:current?'#e65340':'#53657b',weight:current?2.8:2.05,opacity:current?1:.9,fillColor:current?'#f4614c':'#8290a3',fillOpacity:current ? .045 : .02,dashArray:current?undefined:'7 4'},
      });
      next.addLayer(layer);
      // At the normal municipality zoom labels remain visible. At distant zooms
      // only the selected municipality is labelled to avoid a wall of text.
      if(current||zoom>=9){
        next.addLayer(L.tooltip({permanent:true,direction:'center',interactive:false,pane:'municipality-context-labels',className:`municipality-context-label${current?' current':''}`,opacity:1})
          .setLatLng(layer.getBounds().getCenter()).setContent(item.name));
      }
    });
    group=next.addTo(map);
  };
  map.whenReady(draw);
  map.on('moveend zoomend',draw);
}
