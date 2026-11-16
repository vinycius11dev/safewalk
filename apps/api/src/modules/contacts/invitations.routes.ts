import { Router } from 'express';
import { z } from 'zod';
import { invitationDecisionSchema } from '@safewalk/contracts';
import { getInvitation, decideInvitation } from './invitations.repository.js';
export const invitationsRouter = Router();
invitationsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
invitationsRouter.get('/:token', async (req, res) => {
  res.json(await getInvitation(z.string().parse(req.params.token)));
});
invitationsRouter.post('/:token', async (req, res) => {
  const input = invitationDecisionSchema.parse(req.body);
  await decideInvitation(z.string().parse(req.params.token), input.accepted, input.emailTripAlerts);
  res.json({ accepted: input.accepted });
});
