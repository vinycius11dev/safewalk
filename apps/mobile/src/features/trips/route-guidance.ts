import type { PositionInput, RealRoute } from '@safewalk/contracts';

export type RouteMatch = {
  segmentIndex: number;
  pointIndex: number;
  distanceMeters: number;
  alongRouteMeters: number;
};

export type RouteGuidanceSnapshot = {
  match: RouteMatch | null;
  progressMeters: number;
  totalRouteMeters: number;
  offRoute: boolean;
  reliableFix: boolean;
};

const MAX_ACCURACY_METERS = 45;
const MAX_FIX_AGE_MS = 20_000;
const MAX_FUTURE_SKEW_MS = 15_000;
const MIN_FIX_SPACING_MS = 4_000;
const MAX_FIX_GAP_MS = 20_000;
const REQUIRED_DEVIATION_FIXES = 3;
const REQUIRED_DEVIATION_SPAN_MS = 12_000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function cumulativeDistances(points: RealRoute['points']): number[] {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const latitude = ((start.latitude + end.latitude) / 2) * (Math.PI / 180);
    const north = (end.latitude - start.latitude) * 111_000;
    const east = (end.longitude - start.longitude) * 111_000 * Math.cos(latitude);
    cumulative.push(cumulative[index - 1]! + Math.hypot(north, east));
  }
  return cumulative;
}

export function matchRoutePosition(
  points: RealRoute['points'],
  position: Pick<PositionInput, 'latitude' | 'longitude'>,
  cumulative = cumulativeDistances(points),
): RouteMatch | null {
  if (points.length < 2) return null;
  let best: RouteMatch | null = null;
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const latitudeRadians = (position.latitude * Math.PI) / 180;
    const startEast = (start.longitude - position.longitude) * 111_000 * Math.cos(latitudeRadians);
    const startNorth = (start.latitude - position.latitude) * 111_000;
    const endEast = (end.longitude - position.longitude) * 111_000 * Math.cos(latitudeRadians);
    const endNorth = (end.latitude - position.latitude) * 111_000;
    const deltaEast = endEast - startEast;
    const deltaNorth = endNorth - startNorth;
    const lengthSquared = deltaEast * deltaEast + deltaNorth * deltaNorth;
    const fraction =
      lengthSquared === 0
        ? 0
        : clamp(-(startEast * deltaEast + startNorth * deltaNorth) / lengthSquared, 0, 1);
    const east = startEast + fraction * deltaEast;
    const north = startNorth + fraction * deltaNorth;
    const segmentLength = cumulative[index + 1]! - cumulative[index]!;
    const candidate: RouteMatch = {
      segmentIndex: index,
      pointIndex: fraction < 0.5 ? index : index + 1,
      distanceMeters: Math.hypot(east, north),
      alongRouteMeters: cumulative[index]! + fraction * segmentLength,
    };
    if (
      !best ||
      candidate.distanceMeters < best.distanceMeters - 0.5 ||
      (Math.abs(candidate.distanceMeters - best.distanceMeters) <= 0.5 &&
        candidate.alongRouteMeters < best.alongRouteMeters)
    )
      best = candidate;
  }
  return best;
}

/** A small external store keeps the hysteresis state independent from render timing. */
export class RouteGuidanceTracker {
  private readonly points: RealRoute['points'];
  private readonly cumulative: number[];
  private readonly outerThreshold: number;
  private readonly innerThreshold: number;
  private snapshot: RouteGuidanceSnapshot;
  private listeners = new Set<() => void>();
  private lastRecordedAt = 0;
  private lastDeviationAt = 0;
  private deviationStartedAt = 0;
  private deviationFixes = 0;
  private onRouteFixes = 0;
  private lastOnRouteAt = 0;

  constructor(route: Pick<RealRoute, 'points' | 'profile'>) {
    this.points = route.points;
    this.cumulative = cumulativeDistances(route.points);
    this.outerThreshold = route.profile === 'auto' ? 95 : 65;
    this.innerThreshold = route.profile === 'auto' ? 55 : 38;
    this.snapshot = {
      match: null,
      progressMeters: 0,
      totalRouteMeters: this.cumulative.at(-1) ?? 0,
      offRoute: false,
      reliableFix: false,
    };
  }

  getSnapshot = (): RouteGuidanceSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(next: RouteGuidanceSnapshot): void {
    const current = this.snapshot;
    if (
      current.match === next.match &&
      current.progressMeters === next.progressMeters &&
      current.offRoute === next.offRoute &&
      current.reliableFix === next.reliableFix
    )
      return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  update(position: PositionInput | null, now = Date.now()): void {
    if (!position) {
      this.deviationFixes = 0;
      this.onRouteFixes = 0;
      this.publish({ ...this.snapshot, reliableFix: false });
      return;
    }
    const recordedAt = Date.parse(position.recordedAt);
    const age = now - recordedAt;
    if (
      !Number.isFinite(recordedAt) ||
      position.accuracyMeters > MAX_ACCURACY_METERS ||
      age > MAX_FIX_AGE_MS ||
      age < -MAX_FUTURE_SKEW_MS
    ) {
      this.deviationFixes = 0;
      this.onRouteFixes = 0;
      this.publish({ ...this.snapshot, reliableFix: false });
      return;
    }
    if (recordedAt <= this.lastRecordedAt) return;
    this.lastRecordedAt = recordedAt;
    const match = matchRoutePosition(this.points, position, this.cumulative);
    if (!match) {
      this.publish({ ...this.snapshot, reliableFix: false });
      return;
    }

    let offRoute = this.snapshot.offRoute;
    if (offRoute) {
      if (match.distanceMeters <= this.innerThreshold) {
        if (recordedAt - this.lastOnRouteAt >= MIN_FIX_SPACING_MS) {
          this.onRouteFixes =
            this.lastOnRouteAt && recordedAt - this.lastOnRouteAt <= MAX_FIX_GAP_MS
              ? this.onRouteFixes + 1
              : 1;
          this.lastOnRouteAt = recordedAt;
        }
        if (this.onRouteFixes >= 2) {
          offRoute = false;
          this.onRouteFixes = 0;
          this.deviationFixes = 0;
        }
      } else {
        this.onRouteFixes = 0;
        this.lastOnRouteAt = 0;
      }
    } else if (match.distanceMeters > this.outerThreshold) {
      if (
        !this.lastDeviationAt ||
        recordedAt - this.lastDeviationAt > MAX_FIX_GAP_MS ||
        recordedAt - this.lastDeviationAt < MIN_FIX_SPACING_MS
      ) {
        this.deviationStartedAt = recordedAt;
        this.deviationFixes = 1;
      } else {
        this.deviationFixes += 1;
      }
      this.lastDeviationAt = recordedAt;
      if (
        this.deviationFixes >= REQUIRED_DEVIATION_FIXES &&
        recordedAt - this.deviationStartedAt >= REQUIRED_DEVIATION_SPAN_MS
      ) {
        offRoute = true;
        this.onRouteFixes = 0;
        this.lastOnRouteAt = 0;
      }
    } else {
      this.deviationFixes = 0;
      this.deviationStartedAt = 0;
      this.lastDeviationAt = 0;
    }

    const progressMeters =
      match.distanceMeters <= this.outerThreshold
        ? Math.max(this.snapshot.progressMeters, match.alongRouteMeters)
        : this.snapshot.progressMeters;
    this.publish({
      match,
      progressMeters,
      totalRouteMeters: this.snapshot.totalRouteMeters,
      offRoute,
      reliableFix: true,
    });
  }
}
