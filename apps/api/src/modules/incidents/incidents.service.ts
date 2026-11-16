import { demoIncidentCatalog } from '@safewalk/contracts';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errors.js';
import { getFeedback, saveFeedback } from './incidents.repository.js';
export async function incidentFeedback(
  userId: string,
  incidentId: string,
  choice?: 'confirm' | 'resolved',
) {
  if (env.DEMO_MODE !== 'true')
    throw new AppError(404, 'DEMO_DISABLED', 'Ocorrências de demonstração indisponíveis.');
  const incident = demoIncidentCatalog.find((item) => item.id === incidentId);
  if (!incident) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Ocorrência não encontrada.');
  if (choice) await saveFeedback(userId, incidentId, choice);
  const saved = await getFeedback(userId, incidentId);
  return {
    incidentId,
    choice: saved,
    confirmations: incident.confirmations + (saved === 'confirm' ? 1 : 0),
    simulated: true as const,
  };
}
