import { PASSWORD_RESET_TTL_MINUTES } from '@safewalk/contracts';
import type { ResetAccountKind } from '../../domain/password-reset.js';
import type { SafeWalkEmail } from '../../integrations/email/smtp.js';

type Recipient = { name: string; email: string };

const PRODUCT: Record<ResetAccountKind, string> = {
  user: 'SafeWalk',
  admin: 'Painel da Prefeitura do SafeWalk',
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'tudo bem';
}

/** Layout simples em tabela (compatível com clientes de e-mail) nas cores do SafeWalk. */
function layout(input: {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  action?: { label: string; url: string };
  footer: string;
}): string {
  const paragraphs = input.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;color:#475467;font-size:15px;line-height:1.65;">${text}</p>`,
    )
    .join('');
  const action = input.action
    ? `<a href="${escapeHtml(input.action.url)}" style="display:block;margin:22px 0 6px;padding:15px 22px;border-radius:12px;background:#2f6fec;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(input.action.label)}</a>`
    : '';
  const fallback = input.action
    ? `<br />Se o botão não funcionar, copie este endereço: <a href="${escapeHtml(input.action.url)}" style="color:#2f6fec;word-break:break-all;">${escapeHtml(input.action.url)}</a>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#eef2f7;font-family:Inter,Arial,sans-serif;color:#101828;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
          <tr><td style="background:#0b1324;padding:24px 30px;border-bottom:3px solid #2f6fec;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.4px;">Safe<span style="color:#6ea0ff;">Walk</span></span>
          </td></tr>
          <tr><td style="padding:34px 30px 26px;">
            <p style="margin:0 0 8px;color:#2f6fec;font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
            <h1 style="margin:0 0 18px;color:#0f172a;font-size:24px;line-height:1.25;">${escapeHtml(input.title)}</h1>
            ${paragraphs}${action}
          </td></tr>
          <tr><td style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#98a2b3;font-size:12px;line-height:1.6;">
            ${escapeHtml(input.footer)}${fallback}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
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
