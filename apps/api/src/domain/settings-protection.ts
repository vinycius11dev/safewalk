import type { ProfileSettings } from '@safewalk/contracts';

type ProtectionSettings = Pick<
  ProfileSettings,
  | 'responseSeconds'
  | 'automaticDetection'
  | 'arrivalCheckin'
  | 'retentionDays'
  | 'signalLossMinutes'
>;

/** Perda de sinal: 0 = desligado; quanto maior o prazo, mais tarde o aviso. */
function signalLossWeakened(before: number, after: number): boolean {
  if (before === after) return false;
  if (after === 0) return true;
  if (before === 0) return false;
  return after > before;
}

/**
 * Indica se a mudança reduz a proteção da conta e, por isso, exige o PIN atual.
 * Só o que aumenta proteção (ou é neutro, como perfil e relatos) dispensa o PIN.
 */
export function settingsChangeNeedsPin(
  before: ProtectionSettings,
  after: ProtectionSettings,
): boolean {
  return (
    (before.automaticDetection && !after.automaticDetection) ||
    (before.arrivalCheckin && !after.arrivalCheckin) ||
    after.responseSeconds > before.responseSeconds ||
    after.retentionDays < before.retentionDays ||
    signalLossWeakened(before.signalLossMinutes, after.signalLossMinutes)
  );
}
