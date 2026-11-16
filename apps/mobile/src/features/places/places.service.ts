import { z } from 'zod';
import { savedPlaceResponseSchema, type SavedPlaceInput } from '@safewalk/contracts';
import { apiRequest } from '@/lib/api-client';

export const placesService = {
  list: (token: string, signal?: AbortSignal) =>
    apiRequest('/places', z.array(savedPlaceResponseSchema), { token, signal }),
  create: (token: string, input: SavedPlaceInput) =>
    apiRequest('/places', savedPlaceResponseSchema, { token, method: 'POST', body: input }),
  update: (token: string, id: string, input: SavedPlaceInput) =>
    apiRequest(`/places/${id}`, savedPlaceResponseSchema, {
      token,
      method: 'PUT',
      body: input,
    }),
  remove: (token: string, id: string) =>
    apiRequest(`/places/${id}`, z.undefined(), { token, method: 'DELETE' }),
};
