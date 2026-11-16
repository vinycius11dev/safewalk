import {
  trackingResponseSchema,
  invitationResponseSchema,
  invitationDecisionSchema,
} from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
export const trackingService = {
  get: (token: string, signal?: AbortSignal) =>
    apiRequest(`/tracking/${token}`, trackingResponseSchema, { signal }),
  acknowledge: (token: string) =>
    apiRequest(`/tracking/${token}/acknowledge`, z.object({ acknowledged: z.boolean() }), {
      method: 'POST',
    }),
  invitation: (token: string, signal?: AbortSignal) =>
    apiRequest(`/invitations/${token}`, invitationResponseSchema, { signal }),
  decide: (token: string, accepted: boolean, consent: boolean, emailTripAlerts: boolean) =>
    apiRequest(`/invitations/${token}`, z.object({ accepted: z.boolean() }), {
      method: 'POST',
      body: invitationDecisionSchema.parse({
        accepted,
        consent,
        emailTripAlerts: accepted && emailTripAlerts,
      }),
    }),
};
