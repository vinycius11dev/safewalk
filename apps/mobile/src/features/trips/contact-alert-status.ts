import type { ContactAlertMessage } from '@safewalk/contracts';
import { localTime } from '@/lib/time';

export type ContactAlertStatus = {
  text: string;
  icon: 'mail' | 'clock' | 'alert-triangle' | 'check' | 'slash';
};

/**
 * What the owner can say about the automatic e-mail to one contact. "Aceito pelo servidor"
 * is the strongest claim available: SMTP does not tell whether the contact read it.
 */
export function contactAlertStatus(message: ContactAlertMessage | undefined): ContactAlertStatus {
  if (!message) return { text: 'Sem e-mail automático neste alerta.', icon: 'slash' };
  switch (message.status) {
    case 'pending':
      return message.attempts > 0
        ? { text: 'O e-mail não saiu; tentando de novo.', icon: 'clock' }
        : { text: 'E-mail automático na fila de envio.', icon: 'clock' };
    case 'accepted_by_relay':
      return {
        text: `E-mail aceito pelo servidor${message.acceptedAt ? ` às ${localTime(message.acceptedAt)}` : ''}. Isso não confirma a leitura.`,
        icon: 'check',
      };
    case 'failed':
      return {
        text: 'O e-mail não foi enviado. Avise pelo WhatsApp ou SMS.',
        icon: 'alert-triangle',
      };
    case 'not_configured':
      return {
        text: 'Envio de e-mail não configurado neste servidor. Avise pelo WhatsApp ou SMS.',
        icon: 'alert-triangle',
      };
    case 'not_enabled':
      return {
        text: 'Este contato não autorizou alertas por e-mail ou não tem mais acesso ao link.',
        icon: 'slash',
      };
    case 'cancelled':
      return { text: 'E-mail cancelado: o alerta foi encerrado antes do envio.', icon: 'slash' };
  }
}
