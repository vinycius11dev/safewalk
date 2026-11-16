import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  loginSchema,
  registerSchema,
  pinSchema,
  profileUpdateSchema,
  changePinSchema,
  deleteAccountSchema,
  profileSettingsInputSchema,
  duressPinSchema,
  removeDuressPinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@safewalk/contracts';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errors.js';
import { findUserById, toUser } from './auth.repository.js';
import * as service from './auth.service.js';
import { getSettings } from './settings.repository.js';
import { requestPasswordReset, resetPassword } from '../password-reset/password-reset.service.js';

export const authRouter = Router();
const passwordResetLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT',
      message: 'Muitos pedidos. Aguarde alguns minutos e tente de novo.',
    },
  },
});
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde para tentar novamente.' },
  },
});
authRouter.post('/login', loginLimit, async (req, res) => {
  const data = loginSchema.parse(req.body);
  res.json(await service.login(data.email, data.password));
});
authRouter.post('/register', loginLimit, async (req, res) => {
  const data = registerSchema.parse(req.body);
  res.status(201).json(await service.register(data.name, data.email, data.password));
});
authRouter.post('/password/forgot', passwordResetLimit, async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  res.status(202).json(await requestPasswordReset('user', email));
});
authRouter.post('/password/reset', passwordResetLimit, async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await resetPassword('user', input.token, input.password);
  res.status(204).end();
});
authRouter.post('/demo', loginLimit, async (_req, res) => {
  res.status(201).json(await service.demoSession());
});
authRouter.get('/me', authenticate, async (req, res) => {
  const row = await findUserById(currentUserId(req));
  if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sua sessão não está mais disponível.');
  res.json(toUser(row));
});
authRouter.put('/pin', authenticate, loginLimit, async (req, res) => {
  await service.configurePin(currentUserId(req), pinSchema.parse(req.body).pin);
  res.status(204).end();
});

authRouter.get('/profile', authenticate, async (req, res) => {
  const row = await findUserById(currentUserId(req));
  if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Sua sessão não está mais disponível.');
  res.json({ ...toUser(row), phone: row.phone });
});
authRouter.put('/profile', authenticate, loginLimit, async (req, res) => {
  res.json(await service.updateProfile(currentUserId(req), profileUpdateSchema.parse(req.body)));
});
authRouter.put('/pin/change', authenticate, loginLimit, async (req, res) => {
  const input = changePinSchema.parse(req.body);
  await service.changePin(currentUserId(req), input.currentPin, input.newPin);
  res.status(204).end();
});
authRouter.put('/duress-pin', authenticate, loginLimit, async (req, res) => {
  const input = duressPinSchema.parse(req.body);
  await service.setDuressPin(currentUserId(req), input.currentPin, input.duressPin);
  res.status(204).end();
});
authRouter.delete('/duress-pin', authenticate, loginLimit, async (req, res) => {
  const input = removeDuressPinSchema.parse(req.body);
  await service.removeDuressPin(currentUserId(req), input.currentPin);
  res.status(204).end();
});
authRouter.delete('/account', authenticate, loginLimit, async (req, res) => {
  await service.deleteAccount(currentUserId(req), deleteAccountSchema.parse(req.body));
  res.status(204).end();
});
authRouter.get('/settings', authenticate, async (req, res) => {
  res.json(await getSettings(currentUserId(req)));
});
authRouter.put('/settings', authenticate, async (req, res) => {
  res.json(
    await service.saveSettings(currentUserId(req), profileSettingsInputSchema.parse(req.body)),
  );
});
authRouter.get('/export', authenticate, loginLimit, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await service.exportAccount(currentUserId(req)));
});
