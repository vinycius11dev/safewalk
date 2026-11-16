import type { MapBounds } from './maps.service';

/** Same limits as the API (`regionBoundsSchema`): São Paulo region, up to 1,2° per side. */
const REGION: MapBounds = [-47.3, -24.2, -45.9, -23.1];
/** 1,1° before snapping: the 0,05° grid can add up to 0,1° and the API accepts 1,2°. */
const MAX_SPAN_DEGREES = 1.1;
const LIVE_SPAN_DEGREES = 0.08;

const round = (value: number) => Number(value.toFixed(5));
function narrow(min: number, max: number): [number, number] {
  if (max - min <= MAX_SPAN_DEGREES) return [min, max];
  const center = (min + max) / 2;
  return [center - MAX_SPAN_DEGREES / 2, center + MAX_SPAN_DEGREES / 2];
}

/**
 * Map viewport → area requested from the API. Views wider than 0,08° (whole districts or the city)
 * snap to a 0,05° grid, so small pans reuse the cached response; the area is clipped to the region
 * and to 1,2° around the center. Returns null when the view is entirely outside the region.
 */
export function urbanRequestBounds([west, south, east, north]: MapBounds): MapBounds | null {
  // Only a view wider than the limit is narrowed around its center; others keep their edges.
  const [x0, x1] = narrow(west, east);
  const [y0, y1] = narrow(south, north);
  const clipped: MapBounds = [
    Math.max(REGION[0], x0),
    Math.max(REGION[1], y0),
    Math.min(REGION[2], x1),
    Math.min(REGION[3], y1),
  ];
  if (clipped[0] >= clipped[2] || clipped[1] >= clipped[3]) return null;
  if (clipped[2] - clipped[0] <= LIVE_SPAN_DEGREES && clipped[3] - clipped[1] <= LIVE_SPAN_DEGREES)
    return clipped;
  return [
    round(Math.max(REGION[0], Math.floor(clipped[0] / 0.05) * 0.05)),
    round(Math.max(REGION[1], Math.floor(clipped[1] / 0.05) * 0.05)),
    round(Math.min(REGION[2], Math.ceil(clipped[2] / 0.05) * 0.05)),
    round(Math.min(REGION[3], Math.ceil(clipped[3] / 0.05) * 0.05)),
  ];
}

/** True when the API answers only with imported layers (signals and SP156) for this area. */
export function isCityWideView([west, south, east, north]: MapBounds): boolean {
  return east - west > LIVE_SPAN_DEGREES || north - south > LIVE_SPAN_DEGREES;
}
