import { Router } from 'express';
import { z } from 'zod';
import { savedPlaceInputSchema } from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import * as service from './places.service.js';

export const placesRouter = Router();
placesRouter.use(authenticate);
placesRouter.get('/', async (req, res) => {
  res.json(await service.listPlaces(currentUserId(req)));
});
placesRouter.post('/', async (req, res) => {
  res
    .status(201)
    .json(await service.createPlace(currentUserId(req), savedPlaceInputSchema.parse(req.body)));
});
placesRouter.put('/:id', async (req, res) => {
  res.json(
    await service.updatePlace(
      currentUserId(req),
      z.uuid().parse(req.params.id),
      savedPlaceInputSchema.parse(req.body),
    ),
  );
});
placesRouter.delete('/:id', async (req, res) => {
  await service.deletePlace(currentUserId(req), z.uuid().parse(req.params.id));
  res.status(204).end();
});
