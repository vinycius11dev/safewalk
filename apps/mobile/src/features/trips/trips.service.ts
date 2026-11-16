import {
  startedTripResponseSchema,
  tripResponseSchema,
  shareLinkResponseSchema,
  revokeShareLinkResponseSchema,
  type RouteKind,
  type PositionInput,
  type Trip,
} from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
export const tripsService = {
  list: (token: string, signal?: AbortSignal) =>
    apiRequest('/trips', z.array(tripResponseSchema), { token, signal }),
  shares: (token: string, id: string) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/shares`, z.array(shareLinkResponseSchema), {
      token,
      method: 'POST',
    }),
  revokeShare: (token: string, id: string, contactId: string) =>
    apiRequest(
      `/trips/${encodeURIComponent(id)}/shares/${encodeURIComponent(contactId)}`,
      revokeShareLinkResponseSchema,
      { token, method: 'DELETE' },
    ),
  get: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest(`/trips/${encodeURIComponent(id)}`, tripResponseSchema, { token, signal }),
  start: (
    token: string,
    input: {
      routeId?: string;
      routeKind: RouteKind;
      contactIds: string[];
      destination: string;
      timerMinutes?: number;
      adultAccompanying?: boolean;
    },
  ) => apiRequest('/trips', startedTripResponseSchema, { token, method: 'POST', body: input }),
  position: (token: string, id: string, input: PositionInput) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/positions`, z.undefined(), {
      token,
      method: 'POST',
      body: input,
    }),
  reroute: (token: string, id: string, expectedRouteId: string) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/reroute`, tripResponseSchema, {
      token,
      method: 'POST',
      body: { expectedRouteId },
    }),
  pauseSharing: (token: string, id: string) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/positions/pause`, z.undefined(), {
      token,
      method: 'POST',
    }),
  alert: (token: string, id: string, reason: 'manual' | 'stopped' | 'late' | 'deviation') =>
    apiRequest(`/trips/${encodeURIComponent(id)}/alerts`, tripResponseSchema, {
      token,
      method: 'POST',
      body: { reason },
    }),
  cancelAlert: (token: string, id: string, pin: string) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/cancel-alert`, tripResponseSchema, {
      token,
      method: 'POST',
      body: { pin },
    }),
  finish: (token: string, id: string, pin: string, outcome: 'arrived' | 'cancelled') =>
    apiRequest(`/trips/${encodeURIComponent(id)}/finish`, tripResponseSchema, {
      token,
      method: 'POST',
      body: { pin, outcome },
    }),
  feedback: (token: string, id: string, feeling: NonNullable<Trip['feedback']>) =>
    apiRequest(`/trips/${encodeURIComponent(id)}/feedback`, tripResponseSchema, {
      token,
      method: 'POST',
      body: { feeling },
    }),
};
