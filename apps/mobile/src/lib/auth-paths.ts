/** Telas de acesso: usam a moldura larga e clara, sem o quadro do aplicativo. */
const AUTH_PATHS = new Set(['/entrar', '/cadastro', '/esqueci-senha', '/redefinir-senha']);

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.has(pathname);
}
