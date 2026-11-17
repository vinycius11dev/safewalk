import type { PasswordResetRequestResponse } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import {
  PASSWORD_RESET_REQUESTS_PER_HOUR,
  hashResetToken,
  newResetToken,
  resetLink,
  type ResetAccountKind,
} from '../../domain/password-reset.js';
import { hashSecret } from '../../domain/security.js';
import {
  sendSafeWalkEmail,
  emailLinkAllowed,
  smtpConfigFromEnvironment,
  type SafeWalkEmail,
} from '../../integrations/email/smtp.js';
import { AppError } from '../../middleware/errors.js';
import { findAdminByEmail, findAdminById } from '../admin/admin-accounts.repository.js';
import { findUserByEmail, findUserById } from '../auth/auth.repository.js';
import { passwordChangedEmail, passwordResetEmail } from './password-reset-emails.js';
import * as tokens from './password-reset.repository.js';

/** Mesma resposta para e-mail cadastrado ou não, para o formulário não revelar quem tem conta. */
export const RESET_REQUEST_MESSAGE =
  'Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam.';

type Account = { id: string; name: string; email: string };

async function accountByEmail(kind: ResetAccountKind, email: string): Promise<Account | undefined> {
  if (kind === 'admin') return findAdminByEmail(email);
  const row = await findUserByEmail(email);
  // Contas de demonstração não têm caixa de e-mail real.
  return row && !row.is_demo ? row : undefined;
}

const accountById = (kind: ResetAccountKind, id: string): Promise<Account | undefined> =>
  kind === 'admin' ? findAdminById(id) : findUserById(id);

const siteFor = (kind: ResetAccountKind): string =>
  kind === 'admin' ? env.ADMIN_PANEL_URL : env.PUBLIC_WEB_URL;

/** Envia sem segurar a resposta: o tempo da requisição não denuncia se a conta existe. */
function deliverInBackground(message: SafeWalkEmail, onFailure?: () => Promise<void>): void {
  void sendSafeWalkEmail(message).catch(async () => {
    console.error('Falha ao enviar e-mail de recuperação de senha.');
    await onFailure?.().catch(() => undefined);
  });
}

export async function requestPasswordReset(
  kind: ResetAccountKind,
  email: string,
): Promise<PasswordResetRequestResponse> {
  const generic = { message: RESET_REQUEST_MESSAGE };
  const account = await accountByEmail(kind, email);
  if (!account) return generic;
  if ((await tokens.countRecentResetRequests(kind, account.id)) >= PASSWORD_RESET_REQUESTS_PER_HOUR)
    return generic;

  const canEmail = smtpConfigFromEnvironment() !== null && emailLinkAllowed(siteFor(kind));
  // Sem SMTP fora de produção, o link volta na resposta para o fluxo poder ser testado localmente.
  const preview = !canEmail && env.NODE_ENV !== 'production';
  if (!canEmail && !preview) {
    console.error(
      'Recuperação de senha pedida, mas o SMTP ou o endereço HTTPS não está configurado.',
    );
    return generic;
  }

  const { token, hash } = newResetToken();
  await tokens.storeResetToken(kind, account.id, hash);
  const link = resetLink(siteFor(kind), token);
  if (preview) return { ...generic, previewUrl: link };
  deliverInBackground(passwordResetEmail(kind, account, link), () =>
    tokens.discardResetToken(hash),
  );
  return generic;
}

export async function resetPassword(
  kind: ResetAccountKind,
  token: string,
  password: string,
): Promise<void> {
  const tokenHash = hashResetToken(token);
  const invalid = new AppError(
    400,
    'RESET_LINK_INVALID',
    'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
  );
  // Confere antes de calcular o hash da senha (caro), e de novo dentro da transação.
  if (!(await tokens.isResetTokenUsable(kind, tokenHash))) throw invalid;
  const accountId = await tokens.consumeResetToken(kind, tokenHash, await hashSecret(password));
  if (!accountId) throw invalid;
  const account = await accountById(kind, accountId);
  if (account && smtpConfigFromEnvironment() !== null)
    deliverInBackground(passwordChangedEmail(kind, account));
}
