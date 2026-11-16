export function hasEmailTripAlertConsent(
  accepted: boolean,
  requested: boolean,
  email: string | null,
): boolean {
  return accepted && requested && Boolean(email);
}

export function canPreserveEmailTripAlertConsent(
  identityChanged: boolean,
  previouslyConsented: boolean,
  requested: boolean,
): boolean {
  return !identityChanged && previouslyConsented && requested;
}

export function maskContactEmail(value: string | null): string | null {
  if (!value) return null;
  const [local = '', domain = ''] = value.split('@');
  const [domainName = '', ...suffix] = domain.split('.');
  const maskedLocal = `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, local.length - 1)))}`;
  const maskedDomain = `${domainName.slice(0, 1)}•••${suffix.length ? `.${suffix.join('.')}` : ''}`;
  return `${maskedLocal}@${maskedDomain}`;
}
