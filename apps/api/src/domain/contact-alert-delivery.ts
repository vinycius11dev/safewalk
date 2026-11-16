/** Delivery attempts per contact and alert, including the first one. */
export const CONTACT_ALERT_MAX_ATTEMPTS = 3;
/** A claimed message whose worker died is retried after this lease. */
export const CONTACT_ALERT_LEASE_MS = 2 * 60_000;

export type ContactAlertAfterFailure =
  { status: 'pending'; retryInMs: number } | { status: 'failed' };

/** After a failed send: retry with a growing pause, then give up so the app shows the failure. */
export function contactAlertAfterFailure(attempts: number): ContactAlertAfterFailure {
  if (attempts >= CONTACT_ALERT_MAX_ATTEMPTS) return { status: 'failed' };
  return { status: 'pending', retryInMs: 30_000 * Math.max(1, attempts) };
}

export type ContactAlertTarget = {
  accepted: boolean;
  emailTripAlerts: boolean;
  email: string | null;
};

/** What to do with a due message before any network call. */
export function contactAlertDecision(
  target: ContactAlertTarget | null,
  configured: boolean,
  linkExpiresAt: Date | null,
): 'send' | 'not_enabled' | 'not_configured' {
  if (!target || !target.accepted || !target.emailTripAlerts || !target.email) return 'not_enabled';
  if (!configured) return 'not_configured';
  // The owner revoked this contact's access (or it expired): no new link is issued.
  if (!linkExpiresAt) return 'not_enabled';
  return 'send';
}
