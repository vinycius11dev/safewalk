import { ZodError } from 'zod';

export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? 'Confira os dados informados.';
  return error instanceof Error ? error.message : 'Não foi possível carregar. Tente novamente.';
}
