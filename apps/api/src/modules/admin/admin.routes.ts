import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  adminLoginSchema,
  adminReportListQuerySchema,
  adminResetPasswordSchema,
  adminStatusUpdateSchema,
  forgotPasswordSchema,
} from '@safewalk/contracts';
import { requestPasswordReset, resetPassword } from '../password-reset/password-reset.service.js';
import { authenticateAdmin, currentAdmin, requireOperator } from '../../middleware/admin-auth.js';
import { readReportPhoto } from '../reports/report-photo-storage.js';
import { findAdminById, toAdminUser } from './admin-accounts.repository.js';
import { adminLogin } from './admin-auth.service.js';
import {
  adminPhoto,
  adminSummary,
  changeReportStatus,
  getAdminReport,
  listAdminReports,
} from './admin-reports.repository.js';
import { AppError } from '../../middleware/errors.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde e tente de novo.' },
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60_000,
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

export const adminRouter = Router();

adminRouter.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = adminLoginSchema.parse(req.body);
  res.json(await adminLogin(email, password));
});
adminRouter.post('/auth/password/forgot', passwordResetLimiter, async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  res.status(202).json(await requestPasswordReset('admin', email));
});
adminRouter.post('/auth/password/reset', passwordResetLimiter, async (req, res) => {
  const input = adminResetPasswordSchema.parse(req.body);
  await resetPassword('admin', input.token, input.password);
  res.status(204).end();
});

adminRouter.use(authenticateAdmin);

adminRouter.get('/auth/me', async (req, res) => {
  const admin = await findAdminById(currentAdmin(req).id);
  if (!admin) throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
  res.json(toAdminUser(admin));
});
adminRouter.get('/summary', async (_req, res) => {
  res.json(await adminSummary());
});
adminRouter.get('/reports', async (req, res) => {
  res.json(await listAdminReports(adminReportListQuerySchema.parse(req.query)));
});
adminRouter.get('/reports/:id', async (req, res) => {
  res.json(await getAdminReport(String(req.params.id)));
});
adminRouter.get('/reports/:id/photo', async (req, res) => {
  const photo = await adminPhoto(String(req.params.id));
  const data = await readReportPhoto(photo.storageKey);
  res
    .status(200)
    .set({
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .send(data);
});
adminRouter.patch('/reports/:id/status', requireOperator, async (req, res) => {
  const { status, note } = adminStatusUpdateSchema.parse(req.body);
  res.json(await changeReportStatus(currentAdmin(req).id, String(req.params.id), status, note));
});
