export const PIN_FREE_ATTEMPTS = 5;
export const PIN_MAX_LOCK_SECONDS = 15 * 60;
const PIN_FIRST_LOCK_SECONDS = 30;

/**
 * Bloqueio após a tentativa de número `failedAttempts` desde o último acerto.
 * As primeiras tentativas são livres; depois o bloqueio dobra até o limite.
 */
export function pinLockSeconds(failedAttempts: number): number {
  if (failedAttempts < PIN_FREE_ATTEMPTS) return 0;
  const doublings = Math.min(failedAttempts - PIN_FREE_ATTEMPTS, 10);
  return Math.min(PIN_MAX_LOCK_SECONDS, PIN_FIRST_LOCK_SECONDS * 2 ** doublings);
}

export function pinLockMessage(remainingSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(remainingSeconds));
  const wait = seconds < 60 ? `${seconds} segundos` : `${Math.ceil(seconds / 60)} minutos`;
  return `Muitas tentativas incorretas. Tente novamente em ${wait}.`;
}
