import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { mapMarkerColors, type Colors } from '@/theme/tokens';
import { OVERLAY_SOURCE } from './real-map.model';

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const BUILDING_LAYER = 'safewalk-buildings-3d';
export const INTERACTIVE_LAYERS = [
  'safewalk-urban-points',
  'safewalk-urban-line',
  'safewalk-urban-fill',
  'safewalk-markers',
];

/** A local MapLibre style: only geometry, glyphs and tiles come from the provider. */
export function createBaseMapStyle(colors: Colors, mode3d: boolean): StyleSpecification {
  return {
    version: 8,
    name: 'SafeWalk',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colors.background } },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': colors.outer },
      },
      {
        id: 'parks',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['park', 'cemetery', 'recreation_ground']]],
        paint: { 'fill-color': colors.mapPark, 'fill-opacity': 0.85 },
      },
      {
        id: 'woodland',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': colors.mapPark, 'fill-opacity': 0.7 },
      },
      {
        id: 'building-footprints',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': colors.raised, 'fill-opacity': 0.45 },
      },
      {
        id: 'streets',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['!=', ['get', 'class'], 'rail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': colors.mapRoad,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 16, 0.7, 19, 1],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2, 17, 12, 20, 35],
        },
      },
      {
        id: 'avenues',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'in',
          ['get', 'class'],
          ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': colors.mapAvenue,
          'line-opacity': 0.75,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 5, 17, 19, 20, 45],
        },
      },
      {
        id: 'footpaths',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 15,
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
        paint: {
          'line-color': colors.muted,
          'line-opacity': 0.35,
          'line-width': 1,
          'line-dasharray': [2, 3],
        },
      },
      {
        id: BUILDING_LAYER,
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 15,
        filter: ['all', ['!=', ['get', 'hide_3d'], true], ['has', 'render_height']],
        layout: { visibility: mode3d ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': colors.mapAvenue,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.72,
        },
      },
      {
        id: 'street-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 16,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name'], ''],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 12],
          'text-max-angle': 30,
          'symbol-spacing': 300,
        },
        paint: {
          'text-color': colors.muted,
          'text-halo-color': colors.background,
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'neighborhood-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        maxzoom: 15,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'suburb', 'neighbourhood']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name'], ''],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: {
          'text-opacity': 0.65,
          'text-color': colors.muted,
          'text-halo-color': colors.background,
          'text-halo-width': 2,
        },
      },
    ],
  };
}

type OverlayLayer = CircleLayerSpecification | FillLayerSpecification | LineLayerSpecification;

export function createOverlayLayers(colors: Colors): OverlayLayer[] {
  const categoryColor: ExpressionSpecification = [
    'case',
    ['==', ['get', 'rainAttention'], true],
    colors.warning,
    ['==', ['get', 'routeEmphasis'], true],
    colors.warning,
    [
      'in',
      ['coalesce', ['get', 'type'], ['get', 'recordType'], ''],
      ['literal', ['flood_history', 'flood_risk', 'flood_susceptibility']],
    ],
    // Areas that can flood: the same blue as the flood markers, so they read as one layer.
    mapMarkerColors.floods,
    [
      'match',
      ['get', 'category'],
      'flood',
      colors.primaryText,
      'sidewalk',
      colors.warning,
      'lighting',
      colors.warning,
      'crossing',
      colors.primaryText,
      'camera',
      colors.muted,
      'safe-place',
      colors.primary,
      colors.danger,
    ],
  ];
  // Flood areas are visible on their own and stronger while the weather model shows rain.
  const polygonOpacity: ExpressionSpecification = [
    'case',
    ['==', ['get', 'rainAttention'], true],
    0.34,
    [
      'match',
      ['get', 'type'],
      'flood_history',
      0.22,
      'flood_risk',
      0.2,
      'flood_susceptibility',
      0.16,
      'floods',
      0.3,
      0.2,
    ],
  ];
  return [
    {
      id: 'safewalk-urban-fill',
      type: 'fill',
      source: OVERLAY_SOURCE,
      filter: ['all', ['==', ['get', 'role'], 'urban'], ['==', ['geometry-type'], 'Polygon']],
      paint: { 'fill-color': categoryColor, 'fill-opacity': polygonOpacity },
    },
    {
      id: 'safewalk-urban-line',
      type: 'line',
      source: OVERLAY_SOURCE,
      filter: [
        'all',
        ['==', ['get', 'role'], 'urban'],
        ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
      ],
      paint: { 'line-color': categoryColor, 'line-width': 2, 'line-opacity': 0.75 },
    },
    {
      id: 'safewalk-alternative',
      type: 'line',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'alternative'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.muted,
        'line-width': 4,
        'line-opacity': 0.7,
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'safewalk-route-casing',
      type: 'line',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'route'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.surface, 'line-width': 9 },
    },
    {
      id: 'safewalk-route',
      type: 'line',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'route'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.primary, 'line-width': 5 },
    },
    {
      id: 'safewalk-markers',
      type: 'circle',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'marker'],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'areaReference'], true], 5, 8],
        'circle-color': categoryColor,
        'circle-stroke-color': colors.surface,
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'safewalk-urban-points',
      type: 'circle',
      source: OVERLAY_SOURCE,
      filter: ['all', ['==', ['get', 'role'], 'urban'], ['==', ['geometry-type'], 'Point']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 7],
        'circle-color': categoryColor,
        'circle-opacity': 0.85,
        'circle-stroke-color': colors.surface,
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'safewalk-location-halo',
      type: 'circle',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'location'],
      paint: { 'circle-radius': 20, 'circle-color': colors.primary, 'circle-opacity': 0.2 },
    },
    {
      id: 'safewalk-location',
      type: 'circle',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'location'],
      paint: {
        'circle-radius': 7,
        'circle-color': colors.primary,
        'circle-stroke-color': colors.white,
        'circle-stroke-width': 3,
      },
    },
    {
      id: 'safewalk-selected',
      type: 'circle',
      source: OVERLAY_SOURCE,
      filter: ['==', ['get', 'role'], 'selected'],
      paint: {
        'circle-radius': 10,
        'circle-color': colors.primary,
        'circle-stroke-color': colors.white,
        'circle-stroke-width': 4,
      },
    },
  ];
}
