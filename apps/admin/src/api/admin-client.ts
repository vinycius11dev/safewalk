import { z } from 'zod';
import {
  adminReportDetailSchema,
  adminReportListSchema,
  adminSessionSchema,
  adminSummarySchema,
  adminUserSchema,
  apiErrorSchema,
  passwordResetRequestResponseSchema,
  type AdminReportListQuery,
  type GovernmentStatus,
} from '@safewalk/contracts';

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4010').replace(/\/$/, '');
const TOKEN_KEY = 'safewalk-admin-token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** A sessão vale só nesta aba: fechar a aba encerra o acesso ao painel. */
export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem armazenamento da aba, a sessão só dura até recarregar a página.
  }
}

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/admin${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
    );
  }
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    const error = parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'UNKNOWN', 'O servidor não conseguiu responder.');
    if (response.status === 401 && token && error.code !== 'INVALID_CREDENTIALS') {
      writeToken(null);
      onSessionExpired?.();
    }
    throw error;
  }
  return response;
}

async function json<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError(502, 'BAD_RESPONSE', 'O servidor enviou uma resposta inesperada.');
  return parsed.data;
}

function searchOf(query: Partial<AdminReportListQuery>): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.type) params.set('type', query.type);
  if (query.q) params.set('q', query.q);
  if (query.days) params.set('days', String(query.days));
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const adminApi = {
  async login(email: string, password: string) {
    const session = await json('/auth/login', adminSessionSchema, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    writeToken(session.token);
    return session.user;
  },
  logout: () => writeToken(null),
  forgotPassword: (email: string) =>
    json('/auth/password/forgot', passwordResetRequestResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  async resetPassword(token: string, password: string): Promise<void> {
    await send('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  me: () => json('/auth/me', adminUserSchema),
  summary: () => json('/summary', adminSummarySchema),
  reports: (query: Partial<AdminReportListQuery>) =>
    json(`/reports${searchOf(query)}`, adminReportListSchema),
  report: (id: string) => json(`/reports/${encodeURIComponent(id)}`, adminReportDetailSchema),
  async photo(id: string): Promise<Blob> {
    return (await send(`/reports/${encodeURIComponent(id)}/photo`)).blob();
  },
  changeStatus: (id: string, status: GovernmentStatus, note: string) =>
    json(`/reports/${encodeURIComponent(id)}/status`, adminReportDetailSchema, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
};
