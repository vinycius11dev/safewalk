import { incidentFeedbackResponseSchema } from '@safewalk/contracts';
import { apiRequest } from '@/lib/api-client';
export const incidentsService = {
  feedback: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest(`/incidents/${id}/feedback`, incidentFeedbackResponseSchema, { token, signal }),
  respond: (token: string, id: string, choice: 'confirm' | 'resolved') =>
    apiRequest(`/incidents/${id}/feedback`, incidentFeedbackResponseSchema, {
      token,
      method: 'PUT',
      body: { choice },
    }),
};
