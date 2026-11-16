import type { TripStatus } from '@safewalk/contracts';

export const isTerminal = (status: TripStatus): boolean =>
  status === 'arrived' || status === 'cancelled';
export const isShareValid = (
  expiresAt: Date,
  revokedAt: Date | null,
  status: TripStatus,
  now: Date,
  duressAt: Date | null = null,
): boolean =>
  revokedAt === null &&
  expiresAt.getTime() > now.getTime() &&
  (!isTerminal(status) || duressAt !== null);

export function shareLinkState(
  expiresAt: Date,
  revokedAt: Date | null,
  revokedReason: string | null,
  status: TripStatus,
  now: Date,
  duressAt: Date | null = null,
): 'active' | 'arrived' | 'expired' {
  if (expiresAt.getTime() <= now.getTime()) return 'expired';
  if (status === 'arrived' && revokedAt !== null && revokedReason === 'trip_finished')
    return 'arrived';
  return isShareValid(expiresAt, revokedAt, status, now, duressAt) ? 'active' : 'expired';
}

export const SHARE_LINK_MIN_VALIDITY_MINUTES = 120;
export const SHARE_LINK_ARRIVAL_GRACE_MINUTES = 60;

/** O link vale pelo menos 2 h e sempre cobre a chegada prevista mais a janela do alerta tardio. */
export function shareLinkExpiry(issuedAt: Date, expectedArrivalAt: Date): Date {
  return new Date(
    Math.max(
      issuedAt.getTime() + SHARE_LINK_MIN_VALIDITY_MINUTES * 60_000,
      expectedArrivalAt.getTime() + SHARE_LINK_ARRIVAL_GRACE_MINUTES * 60_000,
    ),
  );
}

/** Só um alerta já enviado aos contatos (ou uma coação) pode ser confirmado por eles. */
export function canContactAcknowledge(status: TripStatus, duressAt: Date | null): boolean {
  return status === 'alerted' || status === 'escalated' || duressAt !== null;
}

export function nextAlertState(
  status: TripStatus,
  alertDeadline: Date | null,
  escalationDeadline: Date | null,
  acknowledged: boolean,
  now: Date,
): TripStatus {
  if (status === 'checkin_pending' && alertDeadline && now >= alertDeadline) return 'alerted';
  if (status === 'alerted' && escalationDeadline && now >= escalationDeadline && !acknowledged)
    return 'escalated';
  return status;
}

export function reportValidityHours(type: string): number {
  if (['robbery', 'aggression', 'harassment', 'other'].includes(type)) return 4;
  if (type === 'flood') return 12;
  return 24 * 30;
}
