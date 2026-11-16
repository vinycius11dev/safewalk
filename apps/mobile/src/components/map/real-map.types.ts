import type { Coordinates, UrbanLayerType } from '@safewalk/contracts';
import type { FeatureCollection, Point } from 'geojson';

export type MapMode = '2d' | '3d';
export type MapBounds = [west: number, south: number, east: number, north: number];
export type MapRainStatus = 'raining' | 'dry' | 'stale' | 'unknown';
export type MapMarkerCategory =
  'flood' | 'sidewalk' | 'lighting' | 'crossing' | 'camera' | 'safe-place' | 'other';

export interface MapMarker {
  id: string;
  location: Coordinates;
  title: string;
  rainAttention?: boolean;
  routeEmphasis?: boolean;
  areaReference?: boolean;
  recordType?: UrbanLayerType;
  category?: MapMarkerCategory;
  description?: string;
  source?: string;
  observedAt?: string | null;
}

export interface RealMapProps {
  /** Freshness-aware status from the route weather model. Only `raining` animates the map. */
  rainStatus?: MapRainStatus;
  /** Independent clustered source; contains exactly one point per urban record. */
  recordPoints?: FeatureCollection<Point>;
  onRecordGroupPress?: (group: MapRecordGroup) => void;
  /** Geographic camera center; this does not claim the user is here. */
  center?: Coordinates;
  /** Only supply an actual, permissioned device position. The map never requests GPS. */
  location?: Coordinates | null;
  route?: readonly Coordinates[];
  alternativeRoute?: readonly Coordinates[];
  markers?: readonly MapMarker[];
  /** Full geometries are preserved, including sidewalk and flood polygons. */
  urbanFeatures?: FeatureCollection;
  selectedPoint?: Coordinates | null;
  onMapPress?: (coordinates: Coordinates) => void;
  onMarkerPress?: (id: string) => void;
  /** Text for a desktop hover preview. Use source data, never HTML. */
  markerPreview?: (id: string) => string | undefined;
  /** Fired after movement settles, debounced 700 ms, at zoom >= 9.5 (city view). */
  onViewportChange?: (bounds: MapBounds) => void;
  /** Long press (touch) or right click (mouse) on the map, e.g. to choose a destination there. */
  onMapLongPress?: (coordinates: Coordinates) => void;
  showControls?: boolean;
  initialMode?: MapMode;
  zoom?: number;
  followLocation?: boolean;
  followZoom?: number;
  followBearing?: number | null;
  onFollowLost?: () => void;
  fitRoute?: boolean;
  /** Insets in screen points for fitting a route around the screen's visible panels. */
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  /** Place controls below a screen's search header when necessary. */
  controlsTop?: number;
  /** Keep provider credits above any map sheet, without covering the search bar. */
  attributionTop?: number;
  accessibilityLabel?: string;
}
export type MapRecordGroup = { ids: string[]; expand: () => void };
