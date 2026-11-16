import type { UrbanFeature } from '@safewalk/contracts';
import type { FeatureCollection, Point } from 'geojson';
import { featureIsClosed, featureRouteCategory, routeCategories } from './route-layer-presentation';

/**
 * Separa os registros urbanos para o mapa geral:
 * - pontos viram bolhas com ícone da categoria (agrupadas pelo mapa quando próximas);
 * - linhas e áreas continuam desenhadas como geometria, sem inventar um ponto representativo.
 */
export function splitMapRecords(features: readonly UrbanFeature[], raining: boolean) {
  const records: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
  const shapes: FeatureCollection = { type: 'FeatureCollection', features: [] };
  for (const feature of features) {
    const geometry = feature.geometry;
    const position =
      geometry.type === 'Point'
        ? geometry.coordinates
        : geometry.type === 'MultiPoint'
          ? geometry.coordinates[0]
          : undefined;
    const category = featureRouteCategory(feature);
    if (!position) {
      // Flood areas are drawn stronger (amber) while the weather model shows rain.
      shapes.features.push(
        raining && category === 'floods'
          ? { ...feature, properties: { ...feature.properties, rainAttention: true } }
          : feature,
      );
      continue;
    }
    records.features.push({
      type: 'Feature',
      id: feature.id,
      geometry: { type: 'Point', coordinates: [position[0], position[1]] },
      properties: {
        safewalkId: feature.id,
        category,
        icon: routeCategories.find((item) => item.id === category)?.icon ?? 'history',
        title: feature.properties.title,
        rainAttention: raining && category === 'floods',
        closed: featureIsClosed(feature),
      },
    });
  }
  return { records, shapes };
}
