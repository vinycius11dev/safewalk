import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  startTripSchema,
  positionSchema,
  alertSchema,
  tripEndSchema,
  pinSchema,
  tripFeedbackSchema,
} from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { ownedTrip, serializeTrip, listTrips } from './trips.repository.js';
import * as service from './trips.service.js';
import { createTrackingLinks, revokeContactLinks } from './trips-write.repository.js';
import { requireMapConsent } from '../map-settings/map-consent.middleware.js';

export const tripsRouter = Router();
tripsRouter.use(authenticate);
const pinLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  keyGenerator: (req) => currentUserId(req),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'PIN_RATE_LIMIT', message: 'Muitas tentativas de PIN. Aguarde 15 minutos.' },
  },
});
const rerouteLimit = rateLimit({
  windowMs: 60000,
  limit: 6,
  keyGenerator: (req) => currentUserId(req),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'REROUTE_RATE_LIMIT',
      message: 'Aguarde um pouco antes de buscar outro caminho.',
    },
  },
});
tripsRouter.get('/', async (req, res) => {
  res.json(await listTrips(currentUserId(req)));
});
tripsRouter.post('/', async (req, res) => {
  res
    .status(201)
    .json(await service.startTrip(currentUserId(req), startTripSchema.parse(req.body)));
});
tripsRouter.get('/:id', async (req, res) => {
  res.json(await serializeTrip(await ownedTrip(currentUserId(req), z.uuid().parse(req.params.id))));
});
tripsRouter.post('/:id/positions', async (req, res) => {
  await service.savePosition(
    currentUserId(req),
    z.uuid().parse(req.params.id),
    positionSchema.parse(req.body),
  );
  res.status(204).end();
});
tripsRouter.post('/:id/reroute', requireMapConsent, rerouteLimit, async (req, res) => {
  const body = z.object({ expectedRouteId: z.uuid() }).parse(req.body);
  res.json(
    await service.rerouteTrip(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      body.expectedRouteId,
    ),
  );
});
tripsRouter.post('/:id/positions/pause', async (req, res) => {
  await service.pausePositionSharing(currentUserId(req), z.uuid().parse(req.params.id));
  res.status(204).end();
});
tripsRouter.post('/:id/shares', async (req, res) => {
  res
    .status(201)
    .json(await createTrackingLinks(currentUserId(req), z.uuid().parse(req.params.id)));
});
tripsRouter.delete('/:id/shares/:contactId', async (req, res) => {
  res.json(
    await revokeContactLinks(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      z.uuid().parse(req.params.contactId),
    ),
  );
});
tripsRouter.post('/:id/alerts', async (req, res) => {
  res.json(
    await service.requestAlert(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      alertSchema.parse(req.body).reason,
    ),
  );
});
tripsRouter.post('/:id/feedback', async (req, res) => {
  res.json(
    await service.saveTripFeedback(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      tripFeedbackSchema.parse(req.body).feeling,
    ),
  );
});
tripsRouter.post('/:id/finish', pinLimit, async (req, res) => {
  const input = tripEndSchema.parse(req.body);
  res.json(
    await service.finishTrip(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      input.pin,
      input.outcome,
    ),
  );
});
tripsRouter.post('/:id/cancel-alert', pinLimit, async (req, res) => {
  res.json(
    await service.cancelAlert(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      pinSchema.parse(req.body).pin,
    ),
  );
});
