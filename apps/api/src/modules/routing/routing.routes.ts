import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { geographicBoundsSchema, routingRequestSchema } from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import * as service from './routing.service.js';
import { getRouteUrbanContext } from './route-urban-context.service.js';
import { requireMapConsent } from '../map-settings/map-consent.middleware.js';

export const geocodingRouter = Router();
export const routingRouter = Router();
for (const router of [geocodingRouter, routingRouter]) {
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.vary('Authorization');
    next();
  });
}
const geographicLimit = rateLimit({
  windowMs: 60000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => currentUserId(request),
  message: {
    error: {
      code: 'GEOGRAPHIC_RATE_LIMIT',
      message: 'Aguarde um momento antes de fazer novas consultas de mapas.',
    },
  },
});
geocodingRouter.use(authenticate, requireMapConsent, geographicLimit);
routingRouter.use(authenticate, requireMapConsent, geographicLimit);
const searchSchema = z.object({
  q: z.string().trim().min(3, 'Digite ao menos três caracteres.').max(120),
  bbox: z
    .string()
    .max(120)
    .transform((value) => value.split(',').map(Number))
    .pipe(geographicBoundsSchema)
    .optional(),
});
const reverseSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
});
geocodingRouter.get('/search', async (request, response) => {
  const query = searchSchema.parse(request.query);
  response.json(await service.searchPlaces(currentUserId(request), query.q, query.bbox));
});
geocodingRouter.get('/reverse', async (request, response) => {
  const query = reverseSchema.parse(request.query);
  response.json(await service.reversePlace(currentUserId(request), query.lat, query.lon));
});
routingRouter.post('/routes', async (request, response) => {
  response.json(
    await service.calculateRoutes(currentUserId(request), routingRequestSchema.parse(request.body)),
  );
});
routingRouter.get('/routes/:id/context', async (request, response) => {
  const id = z.uuid().parse(request.params.id);
  const tripId = z.uuid().optional().parse(request.query.tripId);
  response.json(await getRouteUrbanContext(currentUserId(request), id, tripId));
});
