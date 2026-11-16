import type {
  CircleLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from 'maplibre-gl';
import { mapMarkerColors, type Colors } from '@/theme/tokens';
import { RECORD_CATEGORIES, recordLayerIds, type RecordSourceId } from './record-clusters';

/** Delegacias e hospitais, depois semáforos e solicitações abertas, ficam por cima. */
const priority: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  'police',
  4,
  'health',
  4,
  'signals',
  3,
  'reports',
  2,
  'potholes',
  2,
  'obstacles',
  2,
  'brokenSidewalk',
  2,
  'drains',
  1,
  'trees',
  1,
  'floods',
  1,
  0,
];

/** Protocolo já finalizado: continua visível, mas mais claro (finalizar não comprova reparo). */
const closedOpacity: ExpressionSpecification = ['case', ['==', ['get', 'closed'], true], 0.55, 1];

function colorOf(category: ExpressionSpecification | string): ExpressionSpecification {
  return [
    'match',
    category,
    'signals',
    mapMarkerColors.signals,
    'sidewalks',
    mapMarkerColors.sidewalks,
    'lighting',
    mapMarkerColors.lighting,
    'accessibility',
    mapMarkerColors.accessibility,
    'police',
    mapMarkerColors.police,
    'health',
    mapMarkerColors.health,
    'reports',
    mapMarkerColors.reports,
    'floods',
    mapMarkerColors.floods,
    'history',
    mapMarkerColors.history,
    'potholes',
    mapMarkerColors.potholes,
    'trees',
    mapMarkerColors.trees,
    'drains',
    mapMarkerColors.drains,
    'brokenSidewalk',
    mapMarkerColors.brokenSidewalk,
    'obstacles',
    mapMarkerColors.obstacles,
    mapMarkerColors.unknown,
  ];
}

/** Categoria com mais registros dentro do grupo (empate segue a ordem de prioridade). */
const dominantCategory: ExpressionSpecification = (() => {
  const max: ExpressionSpecification = [
    'max',
    ...RECORD_CATEGORIES.map((c) => ['get', c]),
  ] as unknown as ExpressionSpecification;
  const branches = RECORD_CATEGORIES.flatMap((category) => [
    ['==', ['get', category], max],
    category,
  ]);
  return ['case', ...branches, 'unknown'] as unknown as ExpressionSpecification;
})();
const iconOf = (category: ExpressionSpecification): ExpressionSpecification => [
  'match',
  category,
  'unknown',
  'history',
  category,
];

export function createRecordLayers(
  c: Colors,
  source: RecordSourceId,
): (CircleLayerSpecification | SymbolLayerSpecification)[] {
  const ids = recordLayerIds(source);
  const pointColor: ExpressionSpecification = [
    'case',
    ['all', ['==', ['get', 'category'], 'floods'], ['==', ['get', 'rainAttention'], true]],
    mapMarkerColors.floodsRaining,
    colorOf(['get', 'category']),
  ];
  return [
    {
      id: ids.clusters,
      type: 'circle',
      source,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': colorOf(dominantCategory),
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 19, 100, 22],
        'circle-stroke-color': mapMarkerColors.outline,
        'circle-stroke-width': 3,
      },
    },
    {
      id: ids.clusterIcons,
      type: 'symbol',
      source,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': iconOf(dominantCategory),
        'icon-size': 0.4,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    {
      // Selo com a quantidade, no canto do grupo, como nos aplicativos de navegação.
      id: ids.count,
      type: 'symbol',
      source,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-offset': [1.35, -1.25],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': c.text,
        'text-halo-color': c.surface,
        'text-halo-width': 2.5,
      },
    },
    {
      id: ids.points,
      type: 'circle',
      source,
      filter: ['!', ['has', 'point_count']],
      layout: { 'circle-sort-key': priority },
      paint: {
        'circle-color': pointColor,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 15, 18, 18],
        'circle-opacity': closedOpacity,
        'circle-stroke-opacity': closedOpacity,
        'circle-stroke-color': mapMarkerColors.outline,
        'circle-stroke-width': 2.5,
      },
    },
    {
      id: ids.icons,
      type: 'symbol',
      source,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 16, 0.38, 18, 0.46],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': priority,
      },
      paint: { 'icon-opacity': closedOpacity },
    },
  ];
}
