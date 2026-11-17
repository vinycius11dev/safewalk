import type { Trip } from '@safewalk/contracts';
import { localTime } from '@/lib/time';

/** Question shown while the app waits for the owner to confirm that everything is fine. */
export function checkinText(
  trip: Pick<Trip, 'alertReason' | 'mode' | 'destination' | 'expectedArrivalAt'>,
  nowMs: number,
  demonstration: boolean,
): string {
  if (trip.alertReason === 'signal_lost')
    return 'Não recebemos sua localização há alguns minutos. Confirme que está em segurança.';
  if (trip.alertReason === 'late') {
    if (trip.mode === 'timer')
      return 'O tempo do acompanhamento terminou. Confirme que está em segurança.';
    // Only the demonstration control asks for the check-in before the expected arrival.
    if (demonstration && Date.parse(trip.expectedArrivalAt) > nowMs)
      return `Um atraso de chegada em ${trip.destination} foi simulado. A previsão atual é ${localTime(trip.expectedArrivalAt)}.`;
    return `Você ainda não confirmou a chegada em ${trip.destination}. A previsão era ${localTime(trip.expectedArrivalAt)}.`;
  }
  // Stop and deviation check-ins are started only by the demonstration controls.
  if (!demonstration) return 'Confirme que está em segurança.';
  return trip.alertReason === 'deviation'
    ? 'Um desvio do trajeto foi simulado. Confirme que está em segurança.'
    : 'Uma parada inesperada foi simulada no seu trajeto. Confirme que está em segurança.';
}

/** What an active alert really does on a real trip: who can see it and since when. */
export function alertStatusText(trip: Pick<Trip, 'contactIds' | 'alertStartedAt'>): string {
  if (trip.contactIds.length === 0)
    return 'Este trajeto não tem contatos acompanhando, então ninguém foi avisado. Se precisar de ajuda, ligue 190.';
  const since = trip.alertStartedAt ? `Ativo desde as ${localTime(trip.alertStartedAt)}. ` : '';
  const who = trip.contactIds.length === 1 ? 'Seu contato vê' : 'Seus contatos veem';
  return `${since}${who} o alerta e a sua última posição no link de acompanhamento.`;
}

export type ConfirmationNotice = {
  icon: 'check-circle' | 'alert-triangle' | 'clock';
  title: string;
  text: string;
};

/**
 * Whether a contact confirmed on the tracking link that they are following the alert. Nothing
 * is said when the server did not report it (older server, coercion) or the trip has no contacts.
 */
export function confirmationNotice(
  trip: Pick<Trip, 'status' | 'contactIds' | 'acknowledgedContactIds'>,
): ConfirmationNotice | null {
  const confirmed = trip.acknowledgedContactIds;
  if (!confirmed || trip.contactIds.length === 0) return null;
  if (confirmed.length > 0)
    return {
      icon: 'check-circle',
      title:
        confirmed.length === 1
          ? '1 contato confirmou que está acompanhando'
          : `${confirmed.length} contatos confirmaram que estão acompanhando`,
      text: 'A confirmação é feita pela própria pessoa no link de acompanhamento.',
    };
  if (trip.status === 'escalated')
    return {
      icon: 'alert-triangle',
      title: 'Nenhum contato confirmou ainda',
      text: 'Ninguém confirmou no link que está acompanhando o alerta. Se precisar de ajuda agora, ligue 190.',
    };
  return {
    icon: 'clock',
    title: 'Aguardando a confirmação de um contato',
    text: 'Quando alguém confirmar no link que está acompanhando, o aviso aparece aqui.',
  };
}
