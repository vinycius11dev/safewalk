import { Router } from 'express';
import { incidentFeedbackSchema } from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { incidentFeedback } from './incidents.service.js';
export const incidentsRouter = Router();
incidentsRouter.use(authenticate);
incidentsRouter.get('/:id/feedback', async (req, res) => {
  res.json(await incidentFeedback(currentUserId(req), String(req.params.id)));
});
incidentsRouter.put('/:id/feedback', async (req, res) => {
  res.json(
    await incidentFeedback(
      currentUserId(req),
      String(req.params.id),
      incidentFeedbackSchema.parse(req.body).choice,
    ),
  );
});
