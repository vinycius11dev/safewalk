import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

/**
 * O MapLibre 6 carrega o processamento do mapa num worker de módulo separado. O Vite não o
 * descobre sozinho, então o endereço do arquivo instalado é entregue ao MapLibre uma única vez.
 */
let configured = false;
export function configureMapLibre(): typeof maplibregl {
  if (!configured) {
    maplibregl.setWorkerUrl(workerUrl);
    configured = true;
  }
  return maplibregl;
}
