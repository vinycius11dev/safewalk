import type { RequestHandler } from 'express';
import { currentUserId } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errors.js';
import { getMapConsent } from './map-settings.repository.js';
export const requireMapConsent: RequestHandler = async (req, _res, next) => {
  if (!(await getMapConsent(currentUserId(req))).enabled)
    throw new AppError(
      403,
      'MAP_CONSENT_REQUIRED',
      'Autorize os serviços externos do mapa antes de buscar endereços ou calcular rotas.',
    );
  next();
};
