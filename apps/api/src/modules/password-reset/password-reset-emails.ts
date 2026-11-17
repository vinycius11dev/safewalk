import { PASSWORD_RESET_TTL_MINUTES } from '@safewalk/contracts';
import type { ResetAccountKind } from '../../domain/password-reset.js';
import { brandedEmailLayout as layout, escapeHtml } from '../../integrations/email/layout.js';
import type { SafeWalkEmail } from '../../integrations/email/smtp.js';

type Recipient = { name: string; email: string };

const PRODUCT: Record<ResetAccountKind, string> = {
  user: 'SafeWalk',
  admin: 'Painel da Prefeitura do SafeWalk',
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'tudo bem';
}

export function passwordResetEmail(
  kind: ResetAccountKind,
  recipient: Recipient,
  link: string,
): SafeWalkEmail {
  const product = PRODUCT[kind];
  const greeting = `Olá, ${firstName(recipient.name)}!`;
  return {
    to: recipient.email,
    subject: `Redefinir sua senha - ${product}`,
    text: [
      greeting,
      '',
      `Recebemos um pedido para criar uma nova senha na sua conta do ${product}.`,
      `Abra este link para continuar (vale por ${PASSWORD_RESET_TTL_MINUTES} minutos e funciona uma única vez):`,
      link,
      '',
      'Se você não fez esse pedido, ignore este e-mail: sua senha atual continua valendo.',
      '',
      'SafeWalk',
    ].join('\n'),
    html: layout({
      eyebrow: 'Recuperação de senha',
      title: 'Vamos criar uma nova senha',
      paragraphs: [
        escapeHtml(greeting),
        `Recebemos um pedido para criar uma nova senha na sua conta do <strong style="color:#101828;">${escapeHtml(product)}</strong>.`,
        `O link vale por ${PASSWORD_RESET_TTL_MINUTES} minutos e funciona uma única vez.`,
      ],
      action: { label: 'Criar nova senha', url: link },
      footer: 'Se você não fez esse pedido, ignore este e-mail: sua senha atual continua valendo.',
    }),
  };
}

export function passwordChangedEmail(kind: ResetAccountKind, recipient: Recipient): SafeWalkEmail {
  const product = PRODUCT[kind];
  const greeting = `Olá, ${firstName(recipient.name)}!`;
  const warning =
    'Se não foi você, peça um novo link em "Esqueci minha senha" agora e troque a senha do seu e-mail.';
  return {
    to: recipient.email,
    subject: `Sua senha foi alterada - ${product}`,
    text: [
      greeting,
      '',
      `A senha da sua conta do ${product} acabou de ser alterada pelo link de recuperação.`,
      'Por segurança, as sessões abertas em outros aparelhos foram encerradas.',
      '',
      warning,
      '',
      'SafeWalk',
    ].join('\n'),
    html: layout({
      eyebrow: 'Segurança da conta',
      title: 'Sua senha foi alterada',
      paragraphs: [
        escapeHtml(greeting),
        `A senha da sua conta do <strong style="color:#101828;">${escapeHtml(product)}</strong> acabou de ser alterada pelo link de recuperação.`,
        'Por segurança, as sessões abertas em outros aparelhos foram encerradas.',
      ],
      footer: warning,
    }),
  };
}
