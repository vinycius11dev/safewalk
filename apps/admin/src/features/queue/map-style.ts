import type { TransformStyleFunction } from 'maplibre-gl';

type Style = Parameters<TransformStyleFunction>[1];
type Layer = Style['layers'][number];

/*
 * O estilo escuro do OpenFreeMap é cinza neutro. Aqui ele ganha o azul-noite da marca: ruas um
 * tom acima do fundo, água mais funda e nomes em azul-névoa, para os pinos serem o que brilha.
 * (O MapLibre desenha em canvas e não lê variáveis de CSS; estas cores acompanham tokens.css.)
 */
const GROUND = '#0b1320';
const LABEL_HALO = 'rgb(11 19 32 / 85%)';

/** Pintura por camada; a chave casa com o início do nome da camada no estilo. */
const tints: readonly (readonly [prefix: string, paint: Record<string, unknown>])[] = [
  ['background', { 'background-color': GROUND }],
  ['waterway', { 'line-color': '#0a1c36' }],
  ['water_name', { 'text-color': '#4f6a94', 'text-halo-color': LABEL_HALO }],
  ['water', { 'fill-color': '#08182f' }],
  ['landcover_wood', { 'fill-color': '#0c1b24' }],
  ['landcover', { 'fill-color': GROUND }],
  ['landuse_residential', { 'fill-color': '#0d1626' }],
  ['landuse_park', { 'fill-color': '#0d1e27' }],
  ['building', { 'fill-color': '#121e32', 'fill-outline-color': '#1b2b45' }],
  ['aeroway', {}],
  ['road_area_pier', { 'fill-color': GROUND }],
  ['road_pier', { 'line-color': GROUND }],
  ['highway_path', { 'line-color': '#17243b' }],
  ['highway_minor', { 'line-color': '#1a2942' }],
  ['highway_major_casing', { 'line-color': '#0a111d' }],
  ['highway_major', { 'line-color': '#233552' }],
  ['highway_motorway_casing', { 'line-color': '#0a111d' }],
  ['highway_motorway', { 'line-color': '#2b4064' }],
  ['railway_transit_dashline', { 'line-color': GROUND }],
  ['railway_minor_dashline', { 'line-color': GROUND }],
  ['railway_dashline', { 'line-color': GROUND }],
  ['railway', { 'line-color': '#1b2a44' }],
  ['highway_name', { 'text-color': '#61748f', 'text-halo-color': LABEL_HALO }],
  ['boundary', { 'line-color': '#2a3b58' }],
  ['place', { 'text-color': '#93a5bf', 'text-halo-color': LABEL_HALO }],
];

/** Prédios em volume quando a câmera se aproxima e inclina sobre um relato. */
const BUILDINGS_3D = {
  id: 'safewalk-buildings-3d',
  type: 'fill-extrusion',
  source: 'openmaptiles',
  'source-layer': 'building',
  minzoom: 14.5,
  paint: {
    'fill-extrusion-color': '#1f3150',
    'fill-extrusion-height': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14.5,
      0,
      15.5,
      ['coalesce', ['get', 'render_height'], 6],
    ],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.8,
  },
} as Layer;

function tinted(layer: Layer): Layer {
  const match = tints.find(([prefix]) => layer.id.startsWith(prefix));
  if (!match) return layer;
  return { ...layer, paint: { ...layer.paint, ...match[1] } } as Layer;
}

/** Recolore o estilo antes de ele chegar ao mapa, sem piscar o cinza original. */
export const situationRoomStyle: TransformStyleFunction = (_previous, next) => {
  const layers = next.layers.map(tinted);
  if ('openmaptiles' in next.sources) {
    const firstLabel = layers.findIndex((layer) => layer.type === 'symbol');
    layers.splice(firstLabel === -1 ? layers.length : firstLabel, 0, BUILDINGS_3D);
  }
  return { ...next, layers };
};
