import type { Request, RequestHandler } from 'express';
import { jwtVerify } from 'jose';
import type { AdminRole } from '@safewalk/contracts';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { findAdminById } from '../modules/admin/admin-accounts.repository.js';
import { ADMIN_AUDIENCE } from '../modules/admin/admin-auth.service.js';
import { sessionStartedBeforeReset } from '../domain/password-reset.js';

declare module 'express-serve-static-core' {
  interface Request {
    admin?: { id: string; role: AdminRole };
  }
}

/**
 * Sessão do painel: audiência própria, para que o token de um usuário do aplicativo nunca abra o
 * painel (e o contrário). O perfil vem do banco, não do token, então desativar a conta vale na hora.
 */
export const authenticateAdmin: RequestHandler = async (request, _response, next) => {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Entre no painel para continuar.');
  let adminId: string;
  let issuedAt: number | undefined;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
      algorithms: ['HS256'],
      issuer: 'safewalk-api',
      audience: ADMIN_AUDIENCE,
    });
    if (!payload.sub) throw new Error('Missing subject');
    adminId = payload.sub;
    issuedAt = payload.iat;
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  }
  const admin = await findAdminById(adminId);
  if (!admin || sessionStartedBeforeReset(issuedAt, admin.sessions_valid_after))
    throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  request.admin = { id: admin.id, role: admin.role };
  next();
};

export const requireOperator: RequestHandler = (request, _response, next) => {
  if (request.admin?.role !== 'operator')
    throw new AppError(403, 'FORBIDDEN', 'Seu perfil só permite consulta.');
  next();
};

export function currentAdmin(request: Request): { id: string; role: AdminRole } {
  if (!request.admin) throw new AppError(401, 'UNAUTHENTICATED', 'Entre no painel.');
  return request.admin;
}
