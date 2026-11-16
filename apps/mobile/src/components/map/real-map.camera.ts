import type { Map as LibreMap } from 'maplibre-gl';
import type { Coordinates } from '@safewalk/contracts';
import type { MapMode, RealMapProps } from './real-map.types';
import { routeBounds } from './real-map.model';

type RouteCamera = Pick<LibreMap, 'stop' | 'resize' | 'fitBounds'>;

/** Call after layout settles: a previous camera animation or a stale canvas size must not win. */
export function fitVisibleRoute(
  map: RouteCamera,
  route: readonly Coordinates[] | undefined,
  padding: RealMapProps['fitPadding'],
  mode: MapMode,
): boolean {
  const bounds = routeBounds(route);
  if (!bounds) return false;
  map.stop();
  map.resize();
  map.fitBounds(bounds, {
    padding: padding ?? { top: 150, bottom: 280, left: 45, right: 45 },
    // GL 6 otherwise adds these insets to the camera's existing padding on repeated fits.
    absolutePadding: padding !== undefined,
    maxZoom: 17,
    pitch: mode === '3d' ? 52 : 0,
    duration: 500,
  });
  return true;
}
