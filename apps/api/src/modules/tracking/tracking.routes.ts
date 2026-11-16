import { Router } from 'express';
import { z } from 'zod';
import { acknowledgeTracking, getTracking } from './tracking.repository.js';

export const trackingRouter = Router();
trackingRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
trackingRouter.get('/:token', async (req, res) => {
  res.json(await getTracking(z.string().parse(req.params.token)));
});
trackingRouter.post('/:token/acknowledge', async (req, res) => {
  await acknowledgeTracking(z.string().parse(req.params.token));
  res.json({ acknowledged: true });
});
