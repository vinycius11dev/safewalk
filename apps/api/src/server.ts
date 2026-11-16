import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { startAlertWorker } from './jobs/alert-worker.js';
import { startPrivacyWorker } from './jobs/privacy-worker.js';
import {
  startRoutingMaintenance,
  stopRoutingMaintenance,
} from './modules/routing/routing.service.js';

await pool.query('SELECT 1');
const stopWorker = env.ALERT_WORKER_ENABLED === 'true' ? startAlertWorker() : () => {};
const stopPrivacyWorker = startPrivacyWorker();
startRoutingMaintenance();
const server = app.listen(env.PORT, env.HOST, () =>
  console.info(`SafeWalk API: http://localhost:${env.PORT}`),
);
function shutdown(): void {
  stopWorker();
  stopPrivacyWorker();
  stopRoutingMaintenance();
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
