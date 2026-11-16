import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errors.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { contactsRouter } from './modules/contacts/contacts.routes.js';
import { tripsRouter } from './modules/trips/trips.routes.js';
import { trackingRouter } from './modules/tracking/tracking.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { demoRouteOptions } from './domain/route-options.js';
import { authenticate } from './middleware/auth.js';
import { invitationsRouter } from './modules/contacts/invitations.routes.js';
import { incidentsRouter } from './modules/incidents/incidents.routes.js';
import { mapSettingsRouter } from './modules/map-settings/map-settings.routes.js';
import { urbanRouter } from './modules/urban-data/urban.routes.js';
import { geocodingRouter, routingRouter } from './modules/routing/routing.routes.js';
import { placesRouter } from './modules/places/places.routes.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({ origin: env.WEB_ORIGINS.split(',').map((origin) => origin.trim()), credentials: false }),
);
// The city-wide map returns thousands of repetitive GeoJSON points; gzip shrinks them ~10x.
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Aguarde um momento e tente novamente.' } },
  }),
);
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'safewalk-api',
    demo: env.DEMO_MODE === 'true',
    alertWorker: env.ALERT_WORKER_ENABLED === 'true' ? 'enabled' : 'disabled',
  }),
);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/maps', mapSettingsRouter);
app.use('/api/urban', urbanRouter);
app.use('/api/geocoding', geocodingRouter);
app.use('/api/routing', routingRouter);
app.use('/api/places', placesRouter);
app.get('/api/routes', authenticate, (_req, res) => {
  res.json(env.DEMO_MODE === 'true' ? demoRouteOptions : []);
});
app.use((_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } }),
);
app.use(errorHandler);
