import { Router } from 'express';
import { z } from 'zod';
import {
  contactSchema,
  contactUpdateSchema,
  pinSchema,
  tripStartEmailNotificationSchema,
} from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errors.js';
import {
  createContact,
  deleteContact,
  getContactInvitationEmailTarget,
  listContacts,
  updateContact,
} from './contacts.repository.js';
import { createInvitation } from './invitations.repository.js';
import { sendContactInvitationEmail } from './trip-start-emails.js';
import { smtpConfigFromEnvironment } from '../../integrations/email/smtp.js';
import { requirePin } from '../auth/auth.service.js';
import { findUserById } from '../auth/auth.repository.js';
import { rateLimit } from 'express-rate-limit';

export const contactsRouter = Router();
contactsRouter.use(authenticate);
const sensitiveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde para tentar novamente.' },
  },
});
contactsRouter.get('/', async (req, res) => {
  res.json(await listContacts(currentUserId(req)));
});
contactsRouter.post('/', async (req, res) => {
  res.status(201).json(await createContact(currentUserId(req), contactSchema.parse(req.body)));
});
contactsRouter.post('/:id/invitation', async (req, res) => {
  res.status(201).json(await createInvitation(currentUserId(req), z.uuid().parse(req.params.id)));
});
contactsRouter.post('/:id/invitation/email', sensitiveLimit, async (req, res) => {
  const userId = currentUserId(req);
  const contactId = z.uuid().parse(req.params.id);
  const target = await getContactInvitationEmailTarget(userId, contactId);
  if (!target) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contato não encontrado.');
  if (target.accepted && target.emailTripAlerts)
    throw new AppError(
      409,
      'CONTACT_EMAIL_ALREADY_AUTHORIZED',
      'Este contato já autorizou os avisos de trajeto por e-mail.',
    );
  if (!target.email)
    throw new AppError(409, 'CONTACT_EMAIL_REQUIRED', 'Cadastre um e-mail para enviar o convite.');
  if (!smtpConfigFromEnvironment())
    return res
      .status(200)
      .json(tripStartEmailNotificationSchema.parse({ contactId, status: 'not_configured' }));

  const invitation = await createInvitation(userId, contactId);
  const owner = await findUserById(userId);
  const status = await sendContactInvitationEmail(target.email, invitation.url, owner?.name);
  res.status(201).json(tripStartEmailNotificationSchema.parse({ contactId, status }));
});
contactsRouter.put('/:id', sensitiveLimit, async (req, res) => {
  const input = contactUpdateSchema.parse(req.body);
  await requirePin(currentUserId(req), input.currentPin);
  res.json(await updateContact(currentUserId(req), z.uuid().parse(req.params.id), input));
});
contactsRouter.delete('/:id', sensitiveLimit, async (req, res) => {
  await requirePin(currentUserId(req), pinSchema.parse(req.body).pin);
  await deleteContact(currentUserId(req), z.uuid().parse(req.params.id));
  res.status(204).end();
});
