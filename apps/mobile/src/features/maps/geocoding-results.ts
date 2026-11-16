import type { GeocodingPlace } from '@safewalk/contracts';

/** Protect the UI from repeated OSM objects, including older cached responses. */
export function uniqueGeocodingPlaces(places: readonly GeocodingPlace[]): GeocodingPlace[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}
