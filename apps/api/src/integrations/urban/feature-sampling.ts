import type { UrbanFeature } from '@safewalk/contracts';

/** Dense cadastral layers must not suppress reports or weather-related records at the response cap. */
export function sampleUrbanFeatures(
  features: Iterable<UrbanFeature>,
  limit: number,
): UrbanFeature[] {
  const groups = new Map<string, UrbanFeature[]>();
  for (const feature of features) {
    const key = feature.properties.type;
    const group = groups.get(key) ?? [];
    group.push(feature);
    groups.set(key, group);
  }
  const result: UrbanFeature[] = [];
  for (let offset = 0; result.length < limit; offset++) {
    let found = false;
    for (const group of groups.values()) {
      const feature = group[offset];
      if (feature) {
        result.push(feature);
        found = true;
      }
      if (result.length === limit) break;
    }
    if (!found) break;
  }
  return result;
}
