import type { Request, RequestHandler } from 'express';
import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { findUserById } from '../modules/auth/auth.repository.js';
import { sessionStartedBeforeReset } from '../domain/password-reset.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string };
  }
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.');
  let userId: string;
  let issuedAt: number | undefined;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
      algorithms: ['HS256'],
      issuer: 'safewalk-api',
      audience: 'safewalk-client',
    });
    if (!payload.sub) throw new Error('Missing subject');
    userId = payload.sub;
    issuedAt = payload.iat;
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  }
  const user = await findUserById(userId);
  // Depois de redefinir a senha, sessões abertas antes (outro aparelho) deixam de valer.
  if (!user || sessionStartedBeforeReset(issuedAt, user.sessions_valid_after)) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  }
  request.auth = { userId };
  next();
};
export function currentUserId(request: Request): string {
  if (!request.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Entre na sua conta.');
  return request.auth.userId;
}
