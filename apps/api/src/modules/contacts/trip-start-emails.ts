import { z } from 'zod';
import { tripStartEmailNotificationSchema, type ShareLink } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { getTripStartEmailTargets, type TripStartEmailTarget } from './contacts.repository.js';
import {
  sendSafeWalkEmail,
  smtpConfigFromEnvironment,
  type SafeWalkEmail,
} from '../../integrations/email/smtp.js';

export type ContactEmailSubmissionStatus = z.infer<
  typeof tripStartEmailNotificationSchema.shape.status
>;
export type ContactEmailSubmission = z.infer<typeof tripStartEmailNotificationSchema>;
export type EmailSender = (message: SafeWalkEmail) => Promise<void>;

function safeTrackingUrl(value: string): boolean {
  try {
    const base = new URL(env.PUBLIC_WEB_URL);
    const candidate = new URL(value);
    return (
      base.protocol === 'https:' &&
      candidate.protocol === 'https:' &&
      candidate.origin === base.origin
    );
  } catch {
    return false;
  }
}

function trackingEmail(to: string, url: string): SafeWalkEmail {
  return {
    to,
    subject: 'Link de acompanhamento do SafeWalk',
    text: [
      'Uma pessoa de confiança iniciou um trajeto e compartilhou o acompanhamento com você.',
      '',
      'A posição poderá aparecer enquanto este link estiver válido:',
      url,
      '',
      'O link expira quando o trajeto termina ou, no máximo, em 2 horas. Qualquer pessoa com o link pode ver a posição. Não encaminhe esta mensagem.',
      '',
      'SafeWalk',
    ].join('\n'),
  };
}

export async function dispatchTripStartEmails(
  selectedContactIds: readonly string[],
  links: readonly ShareLink[],
  targets: readonly TripStartEmailTarget[],
  options: { configured: boolean; sendEmail: EmailSender },
): Promise<ContactEmailSubmission[]> {
  const uniqueIds = [...new Set(selectedContactIds)];
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const linkById = new Map(links.map((link) => [link.contactId, link]));

  return Promise.all(
    uniqueIds.map(async (contactId) => {
      const target = targetById.get(contactId);
      const link = linkById.get(contactId);
      if (!target || !target.accepted || !target.emailTripAlerts || !target.email)
        return { contactId, status: 'not_enabled' as const };
      if (!options.configured) return { contactId, status: 'not_configured' as const };
      if (!link || !safeTrackingUrl(link.url)) return { contactId, status: 'failed' as const };

      try {
        await options.sendEmail(trackingEmail(target.email, link.url));
        return { contactId, status: 'accepted_by_relay' as const };
      } catch {
        return { contactId, status: 'failed' as const };
      }
    }),
  );
}

export async function sendTripStartEmails(
  userId: string,
  selectedContactIds: readonly string[],
  links: readonly ShareLink[],
): Promise<ContactEmailSubmission[]> {
  const uniqueIds = [...new Set(selectedContactIds)];
  if (uniqueIds.length === 0) return [];

  try {
    const targets = await getTripStartEmailTargets(userId, uniqueIds);
    return await dispatchTripStartEmails(uniqueIds, links, targets, {
      configured: smtpConfigFromEnvironment() !== null,
      sendEmail: sendSafeWalkEmail,
    });
  } catch {
    return uniqueIds.map((contactId) => ({ contactId, status: 'failed' as const }));
  }
}

export async function sendContactInvitationEmail(
  email: string,
  invitationUrl: string,
): Promise<ContactEmailSubmissionStatus> {
  if (!smtpConfigFromEnvironment() || !safeTrackingUrl(invitationUrl)) return 'not_configured';
  try {
    await sendSafeWalkEmail({
      to: email,
      subject: 'Convite para a rede de apoio SafeWalk',
      text: [
        'Uma pessoa escolheu você como contato de segurança no SafeWalk.',
        '',
        'Abra este convite para conhecer os detalhes e decidir se aceita:',
        invitationUrl,
        '',
        'Se aceitar, a pessoa poderá compartilhar links temporários de acompanhamento quando iniciar trajetos. O link de acompanhamento só será enviado por e-mail se você autorizar essa opção no convite.',
        '',
        'O convite expira em 7 dias. Se você não esperava esta mensagem, pode ignorá-la.',
        '',
        'SafeWalk',
      ].join('\n'),
    });
    return 'accepted_by_relay';
  } catch {
    return 'failed';
  }
}
