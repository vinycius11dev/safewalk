import type { Trip } from '@safewalk/contracts';

export function tripTarget(trip: Trip) {
  const pathname =
    trip.status === 'arrived' || trip.status === 'cancelled'
      ? '/chegada/[id]'
      : trip.status === 'checkin_pending'
        ? trip.alertReason === 'late'
          ? '/checkin/[id]'
          : '/alerta/[id]'
        : trip.status === 'alerted' || trip.status === 'escalated'
          ? '/sos/[id]'
          : '/trajeto/[id]';
  return { pathname, params: { id: trip.id } } as const;
}
