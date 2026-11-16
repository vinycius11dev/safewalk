import { createHash, randomBytes } from 'node:crypto';

export type ResetAccountKind = 'user' | 'admin';

/** Pedidos de link por conta numa hora; acima disso a resposta é a mesma, mas nada é enviado. */
export const PASSWORD_RESET_REQUESTS_PER_HOUR = 3;
export const PASSWORD_RESET_PATH = '/redefinir-senha';

/** O banco guarda só o SHA-256: quem lê a tabela não consegue usar o link. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** 32 bytes aleatórios em base64url (43 caracteres), o formato que `passwordResetTokenSchema` aceita. */
export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashResetToken(token) };
}

export function resetLink(baseUrl: string, token: string): string {
  const url = new URL(PASSWORD_RESET_PATH, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Trocar a senha encerra as sessões abertas antes: o token de sessão emitido (`iat`, em segundos)
 * antes de `validAfter` deixa de valer. Sessões abertas depois, inclusive no mesmo segundo, seguem.
 */
export function sessionStartedBeforeReset(
  issuedAtSeconds: number | undefined,
  validAfter: Date | null,
): boolean {
  if (!validAfter) return false;
  if (issuedAtSeconds === undefined) return true;
  return issuedAtSeconds * 1000 < validAfter.getTime();
}
