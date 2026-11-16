import type { CameraImageRequest } from '@safewalk/contracts';

/** Radius around the reference point where a real request would ask for camera footage. */
export const CAMERA_RADIUS_METERS = 150;
/** Footage window: a little before the alert (how the person got there) and after it. */
export const CAMERA_WINDOW_BEFORE_MINUTES = 10;
export const CAMERA_WINDOW_AFTER_MINUTES = 15;

/**
 * Smart Sampa image request registered when an alert reaches the contacts. It is only a
 * simulation: it records what a real request would contain (place basis and time window),
 * never coordinates, and never claims that a camera was triggered or an image received.
 */
export function cameraImageRequest(
  requestedAt: Date,
  trip: { startedAt: Date; hasLastPosition: boolean; hasRoute: boolean },
): CameraImageRequest {
  return {
    requestedAt: requestedAt.toISOString(),
    windowStart: new Date(
      Math.max(
        trip.startedAt.getTime(),
        requestedAt.getTime() - CAMERA_WINDOW_BEFORE_MINUTES * 60_000,
      ),
    ).toISOString(),
    windowEnd: new Date(requestedAt.getTime() + CAMERA_WINDOW_AFTER_MINUTES * 60_000).toISOString(),
    radiusMeters: CAMERA_RADIUS_METERS,
    basis: trip.hasLastPosition ? 'last_position' : trip.hasRoute ? 'route' : 'none',
    simulated: true,
  };
}
