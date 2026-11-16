import * as SecureStore from 'expo-secure-store';
import type { Session } from '@safewalk/contracts';
import { parseStoredSession } from './session-parse';

const key = 'safewalk.session';

/** Sessão ausente ou corrompida vira null; item inválido é apagado para não falhar a cada leitura. */
export async function readSession(): Promise<Session | null> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  const session = parseStoredSession(value);
  if (!session) await SecureStore.deleteItemAsync(key).catch(() => undefined);
  return session;
}
export async function writeSession(session: Session | null): Promise<void> {
  if (session) await SecureStore.setItemAsync(key, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(key);
}
