import { Router } from 'express';
import { mapConsentInputSchema } from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { getMapConsent, setMapConsent } from './map-settings.repository.js';
export const mapSettingsRouter = Router();
mapSettingsRouter.use(authenticate);
mapSettingsRouter.get('/consent', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await getMapConsent(currentUserId(req)));
});
mapSettingsRouter.put('/consent', async (req, res) => {
  const input = mapConsentInputSchema.parse(req.body);
  res.json(await setMapConsent(currentUserId(req), input.enabled));
});
