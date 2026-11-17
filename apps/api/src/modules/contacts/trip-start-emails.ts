import { z } from 'zod';
import { tripStartEmailNotificationSchema, type ShareLink } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { brandedEmailLayout, escapeHtml } from '../../integrations/email/layout.js';
import { getTripStartEmailTargets, type TripStartEmailTarget } from './contacts.repository.js';
import {
  sendSafeWalkEmail,
  emailLinkAllowed,
  smtpConfigFromEnvironment,
  type SafeWalkEmail,
} from '../../integrations/email/smtp.js';

export type ContactEmailSubmissionStatus = z.infer<
  typeof tripStartEmailNotificationSchema.shape.status
>;
export type ContactEmailSubmission = z.infer<typeof tripStartEmailNotificationSchema>;
export type EmailSender = (message: SafeWalkEmail) => Promise<void>;
/** O trajeto começa mesmo se o servidor de e-mail demorar: o envio segue em segundo plano. */
export const TRIP_START_EMAIL_WAIT_MS = 4000;

function safeTrackingUrl(value: string): boolean {
  try {
    const base = new URL(env.PUBLIC_WEB_URL);
    const candidate = new URL(value);
    return (
      emailLinkAllowed(base.href) &&
      emailLinkAllowed(candidate.href) &&
      candidate.origin === base.origin
    );
  } catch {
    return false;
  }
}

function who(travelerName?: string): string {
  return travelerName?.trim().split(/\s+/)[0] || 'Uma pessoa de confiança';
}

export function trackingEmail(to: string, url: string, travelerName?: string): SafeWalkEmail {
  const name = who(travelerName);
  const expiry =
    'O link expira quando o trajeto termina ou, no máximo, em 2 horas. Qualquer pessoa com o link pode ver a posição: não encaminhe esta mensagem.';
  return {
    to,
    subject: `${name} começou um trajeto no SafeWalk`,
    text: [
      `${name} começou um trajeto e escolheu você para acompanhar.`,
      '',
      'Abra o link para ver o roteiro, a previsão de chegada e a última posição recebida:',
      url,
      '',
      'Se o SOS for acionado, a mesma página mostra o alerta.',
      expiry,
      '',
      'SafeWalk',
    ].join('\n'),
    html: brandedEmailLayout({
      eyebrow: 'Acompanhamento de trajeto',
      title: `${name} começou um trajeto`,
      paragraphs: [
        `<strong style="color:#101828;">${escapeHtml(name)}</strong> escolheu você para acompanhar este trajeto.`,
        'Pelo link você vê o roteiro, a previsão de chegada e a última posição recebida. Se o SOS for acionado, a mesma página mostra o alerta.',
      ],
      action: { label: 'Acompanhar trajeto', url },
      footer: expiry,
    }),
  };
}

export async function dispatchTripStartEmails(
  selectedContactIds: readonly string[],
  links: readonly ShareLink[],
  targets: readonly TripStartEmailTarget[],
  options: {
    configured: boolean;
    sendEmail: EmailSender;
    travelerName?: string;
    /**
     * Quanto o início do trajeto espera pelo servidor de e-mail. Passado esse tempo o contato
     * aparece como "sending" e o envio continua; o resultado final chega por onLateResult.
     */
    waitMs?: number;
    onLateResult?: (result: ContactEmailSubmission) => void;
  },
): Promise<ContactEmailSubmission[]> {
  const uniqueIds = [...new Set(selectedContactIds)];
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const linkById = new Map(links.map((link) => [link.contactId, link]));

  return Promise.all(
    uniqueIds.map(async (contactId): Promise<ContactEmailSubmission> => {
      const target = targetById.get(contactId);
      const link = linkById.get(contactId);
      if (!target || !target.accepted || !target.emailTripAlerts || !target.email)
        return { contactId, status: 'not_enabled' };
      if (!options.configured) return { contactId, status: 'not_configured' };
      if (!link || !safeTrackingUrl(link.url)) return { contactId, status: 'failed' };

      const delivery: Promise<ContactEmailSubmission> = options
        .sendEmail(trackingEmail(target.email, link.url, options.travelerName))
        .then(
          () => ({ contactId, status: 'accepted_by_relay' as const }),
          () => ({ contactId, status: 'failed' as const }),
        );
      if (options.waitMs === undefined) return delivery;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waited = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), options.waitMs);
      });
      const settled = await Promise.race([delivery, waited]);
      clearTimeout(timer);
      if (settled) return settled;
      void delivery.then((result) => options.onLateResult?.(result));
      return { contactId, status: 'sending' };
    }),
  );
}

export async function sendTripStartEmails(
  userId: string,
  selectedContactIds: readonly string[],
  links: readonly ShareLink[],
  travelerName?: string,
  onLateResult?: (result: ContactEmailSubmission) => void,
): Promise<ContactEmailSubmission[]> {
  const uniqueIds = [...new Set(selectedContactIds)];
  if (uniqueIds.length === 0) return [];

  try {
    const targets = await getTripStartEmailTargets(userId, uniqueIds);
    return await dispatchTripStartEmails(uniqueIds, links, targets, {
      configured: smtpConfigFromEnvironment() !== null,
      sendEmail: sendSafeWalkEmail,
      travelerName,
      waitMs: TRIP_START_EMAIL_WAIT_MS,
      onLateResult,
    });
  } catch {
    return uniqueIds.map((contactId) => ({ contactId, status: 'failed' as const }));
  }
}

export function invitationEmail(to: string, url: string, travelerName?: string): SafeWalkEmail {
  const name = who(travelerName);
  const footer = 'O convite expira em 7 dias. Se você não esperava esta mensagem, pode ignorá-la.';
  return {
    to,
    subject: `${name} quer você na rede de apoio do SafeWalk`,
    text: [
      `${name} escolheu você como contato de segurança no SafeWalk.`,
      '',
      'Abra o convite para ver os detalhes e decidir se aceita:',
      url,
      '',
      'Se aceitar, você poderá acompanhar os trajetos que essa pessoa compartilhar. O link de cada trajeto só chega por e-mail se você autorizar essa opção no convite.',
      '',
      footer,
      '',
      'SafeWalk',
    ].join('\n'),
    html: brandedEmailLayout({
      eyebrow: 'Rede de apoio',
      title: `${name} quer você na rede de apoio`,
      paragraphs: [
        `<strong style="color:#101828;">${escapeHtml(name)}</strong> escolheu você como contato de segurança no SafeWalk.`,
        'Se aceitar, você poderá acompanhar os trajetos que essa pessoa compartilhar. O link de cada trajeto só chega por e-mail se você autorizar essa opção no convite.',
      ],
      action: { label: 'Ver convite', url },
      footer,
    }),
  };
}

export async function sendContactInvitationEmail(
  email: string,
  invitationUrl: string,
  travelerName?: string,
): Promise<ContactEmailSubmissionStatus> {
  if (!smtpConfigFromEnvironment() || !safeTrackingUrl(invitationUrl)) return 'not_configured';
  try {
    await sendSafeWalkEmail(invitationEmail(email, invitationUrl, travelerName));
    return 'accepted_by_relay';
  } catch {
    return 'failed';
  }
}
