import Constants from 'expo-constants';
import { apiErrorSchema } from '@safewalk/contracts';
import type { ZodType } from 'zod';

const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:4010`;
let sessionExpiredListener: (() => void) | null = null;
export function observeSessionExpiration(listener: () => void): () => void {
  sessionExpiredListener = listener;
  return () => {
    if (sessionExpiredListener === listener) sessionExpiredListener = null;
  };
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export type ApiRequestOptions = {
  token?: string;
  method?: string;
  /** Objeto serializado como JSON, a menos que `rawBody` seja usado. */
  body?: unknown;
  /** Corpo bruto (texto, FormData, Blob) enviado sem serialização; exige `headers['Content-Type']` quando aplicável. */
  rawBody?: string | FormData | Blob;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  try {
    const response = await fetch(`${API_ORIGIN}/api${path}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: {
        // FormData define o próprio Content-Type (com boundary).
        ...(options.rawBody instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      ...(options.rawBody !== undefined
        ? { body: options.rawBody }
        : options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
    });
    const data: unknown = response.status === 204 ? undefined : await response.json();
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(data);
      const apiError = new ApiError(
        response.status,
        error.success ? error.data.error.code : 'REQUEST_FAILED',
        error.success ? error.data.error.message : 'Não foi possível concluir a operação.',
      );
      if (apiError.code === 'SESSION_EXPIRED') sessionExpiredListener?.();
      throw apiError;
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        502,
        'INVALID_RESPONSE',
        'O servidor retornou uma resposta incompatível. Tente novamente.',
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError || options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      timedOut
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao SafeWalk. Confira sua conexão.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
