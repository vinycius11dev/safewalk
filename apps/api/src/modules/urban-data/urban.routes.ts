import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { urbanLayerTypeSchema } from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { requireMapConsent } from '../map-settings/map-consent.middleware.js';
import { regionBoundsSchema, pilotBounds } from '../../integrations/urban/urban-bounds.js';
import { getUrbanLayers, getUrbanSources } from './urban.service.js';

export const urbanRouter = Router();
urbanRouter.use(authenticate);
urbanRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (request) => currentUserId(request),
    message: {
      error: {
        code: 'URBAN_RATE_LIMIT',
        message: 'Aguarde um instante antes de atualizar os dados urbanos.',
      },
    },
  }),
);
const querySchema = z
  .object({
    bbox: z
      .string()
      .max(120)
      .transform((text) => text.split(',').map(Number))
      .pipe(regionBoundsSchema)
      .optional(),
    types: z
      .string()
      .max(200)
      .transform((text) => text.split(','))
      .pipe(z.array(urbanLayerTypeSchema).min(1).max(12))
      .optional(),
  })
  .strict();
urbanRouter.get('/layers', requireMapConsent, async (request, response) => {
  const query = querySchema.parse(request.query);
  response.setHeader('Cache-Control', 'no-store');
  response.vary('Authorization');
  response.json(await getUrbanLayers({ bbox: query.bbox ?? pilotBounds, types: query.types }));
});
urbanRouter.get('/sources', async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.vary('Authorization');
  response.json(await getUrbanSources());
});
