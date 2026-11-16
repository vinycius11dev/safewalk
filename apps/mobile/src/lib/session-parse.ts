import { sessionResponseSchema, type Session } from '@safewalk/contracts';

/** Converte o texto armazenado em sessão; texto corrompido ou fora do contrato vira null. */
export function parseStoredSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const result = sessionResponseSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
