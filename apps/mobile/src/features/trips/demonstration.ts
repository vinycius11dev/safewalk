import type { Trip, User } from '@safewalk/contracts';

/**
 * Smart Sampa, GCM and the other simulated integrations exist only in the guided demonstration:
 * the demo account or a demo-mode trip. A real account on a real trip never sees them. The API
 * applies the same rule when it records the simulated events.
 */
export function isDemonstrationTrip(
  trip: Pick<Trip, 'mode'> | null | undefined,
  user: Pick<User, 'demo'> | null | undefined,
): boolean {
  return trip?.mode === 'demo' || user?.demo === true;
}
