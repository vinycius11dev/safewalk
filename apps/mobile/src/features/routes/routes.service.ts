import { routeResponseSchema } from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
export const getRouteOptions = (token: string, signal?: AbortSignal) =>
  apiRequest('/routes', z.array(routeResponseSchema), { token, signal });
