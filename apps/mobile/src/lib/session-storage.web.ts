import type { Session } from '@safewalk/contracts';
import { parseStoredSession } from './session-parse';

const key = 'safewalk.session';
// Risco conhecido: o token fica em sessionStorage e é legível por XSS. A API usa Bearer;
// cookie HttpOnly exigiria mudar a API. Mitigação: escopo da aba, validação ao ler e CSP.
export async function readSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) return null;
    const session = parseStoredSession(value);
    if (!session) window.sessionStorage.removeItem(key);
    return session;
  } catch {
    return null;
  }
}
export async function writeSession(session: Session | null): Promise<void> {
  if (typeof window === 'undefined') return;
  if (session) window.sessionStorage.setItem(key, JSON.stringify(session));
  else window.sessionStorage.removeItem(key);
}
