import {
  contactResponseSchema,
  invitationLinkSchema,
  type ContactInput,
  contactUpdateSchema,
} from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
export const contactsService = {
  list: (token: string, signal?: AbortSignal) =>
    apiRequest('/contacts', z.array(contactResponseSchema), { token, signal }),
  create: (token: string, input: ContactInput) =>
    apiRequest('/contacts', contactResponseSchema, { token, method: 'POST', body: input }),
  remove: (token: string, id: string, pin: string) =>
    apiRequest(`/contacts/${id}`, z.undefined(), { token, method: 'DELETE', body: { pin } }),
  update: (token: string, id: string, body: z.infer<typeof contactUpdateSchema>) =>
    apiRequest(`/contacts/${id}`, contactResponseSchema, { token, method: 'PUT', body }),
  invitation: (token: string, id: string) =>
    apiRequest(`/contacts/${id}/invitation`, invitationLinkSchema, { token, method: 'POST' }),
  invitationEmail: (token: string, id: string) =>
    apiRequest(
      `/contacts/${id}/invitation/email`,
      z.object({ status: z.enum(['accepted_by_relay', 'failed', 'not_configured']) }),
      { token, method: 'POST' },
    ),
};
