import express, { Router, type ErrorRequestHandler } from 'express';
import {
  reportFeedbackSchema,
  reportSubmissionSchema,
  coordinatesSchema,
} from '@safewalk/contracts';
import { z } from 'zod';
import { authenticate, currentUserId } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errors.js';
import { readReportPhoto } from './report-photo-storage.js';
import {
  attachPhoto,
  communityPhoto,
  createReport,
  flagCommunityReport,
  getReport,
  listReports,
  nearbyCommunityReports,
  resolveReport,
  setCommunityFeedback,
} from './reports.repository.js';

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(5000).default(1200),
});
const photoBodyParser = express.text({
  type: 'application/vnd.safewalk.image+base64',
  limit: '4mb',
});

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get('/', async (req, res) => {
  res.json(await listReports(currentUserId(req)));
});
reportsRouter.post('/', async (req, res) => {
  res
    .status(201)
    .json(await createReport(currentUserId(req), reportSubmissionSchema.parse(req.body)));
});
reportsRouter.get('/nearby', async (req, res) => {
  const query = nearbyQuerySchema.parse(req.query);
  const center = coordinatesSchema.parse({ latitude: query.lat, longitude: query.lon });
  res.json(await nearbyCommunityReports(currentUserId(req), center, query.radius));
});
reportsRouter.put('/:id/photo', photoBodyParser, async (req, res) => {
  if (
    req.header('content-type')?.split(';', 1)[0]?.trim() !== 'application/vnd.safewalk.image+base64'
  )
    throw new AppError(415, 'UNSUPPORTED_PHOTO_TYPE', 'Envie a foto no formato JPEG ou PNG.');
  const mimeType = req.header('x-photo-mime-type') ?? '';
  const base64 = req.body;
  if (typeof base64 !== 'string' || base64.length === 0)
    throw new AppError(400, 'INVALID_REPORT_PHOTO', 'Selecione uma foto JPEG ou PNG.');
  if (base64.length > 4 * 1024 * 1024)
    throw new AppError(413, 'REPORT_PHOTO_TOO_LARGE', 'A foto pode ter até 3 MB.');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
    throw new AppError(400, 'INVALID_REPORT_PHOTO', 'O arquivo enviado não é uma imagem válida.');
  const data = Buffer.from(base64, 'base64');
  if (data.toString('base64') !== base64)
    throw new AppError(400, 'INVALID_REPORT_PHOTO', 'O arquivo enviado não é uma imagem válida.');
  res.json(await attachPhoto(currentUserId(req), String(req.params.id), data, mimeType));
});
reportsRouter.get('/:id/photo', async (req, res) => {
  const userId = currentUserId(req);
  const photo = await communityPhoto(userId, String(req.params.id));
  const data = await readReportPhoto(photo.storageKey);
  res
    .status(200)
    .set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    .json({ mimeType: photo.mimeType, data: data.toString('base64') });
});
reportsRouter.put('/:id/feedback', async (req, res) => {
  const { choice } = reportFeedbackSchema.parse(req.body);
  res.json(await setCommunityFeedback(currentUserId(req), String(req.params.id), choice));
});
reportsRouter.post('/:id/flag', async (req, res) => {
  res.json(await flagCommunityReport(currentUserId(req), String(req.params.id)));
});
reportsRouter.get('/:id', async (req, res) => {
  res.json(await getReport(currentUserId(req), String(req.params.id)));
});
reportsRouter.post('/:id/resolve', async (req, res) => {
  res.json(await resolveReport(currentUserId(req), String(req.params.id)));
});

const uploadErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: { code: 'REPORT_PHOTO_TOO_LARGE', message: 'A foto pode ter até 3 MB.' },
    });
    return;
  }
  next(error);
};
reportsRouter.use(uploadErrorHandler);
