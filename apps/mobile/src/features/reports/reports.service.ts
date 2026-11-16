import {
  communityReportResponseSchema,
  reportResponseSchema,
  type Coordinates,
  type ReportInput,
} from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const reportChoiceSchema = z.object({
  reportId: z.string(),
  myChoice: z.enum(['present', 'resolved', 'not_found']),
  confirmationCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  notFoundCount: z.number().int().nonnegative(),
});
const flagResponseSchema = z.object({ hidden: z.boolean() });
const photoResponseSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png']),
  data: z.string(),
});
export type ReportPhotoAsset = {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  uri?: string;
};
export type CommunityReportChoice = z.infer<typeof reportChoiceSchema>;

export const reportsService = {
  list: (token: string, signal?: AbortSignal) =>
    apiRequest('/reports', z.array(reportResponseSchema), { token, signal }),
  create: (token: string, input: ReportInput) =>
    apiRequest('/reports', reportResponseSchema, { token, method: 'POST', body: input }),
  get: (token: string, id: string, signal?: AbortSignal) =>
    apiRequest(`/reports/${encodeURIComponent(id)}`, reportResponseSchema, { token, signal }),
  resolve: (token: string, id: string) =>
    apiRequest(`/reports/${encodeURIComponent(id)}/resolve`, reportResponseSchema, {
      token,
      method: 'POST',
    }),
  nearby: (token: string, location: Coordinates, radiusMeters = 1200, signal?: AbortSignal) => {
    const query = new URLSearchParams({
      lat: String(location.latitude),
      lon: String(location.longitude),
      radius: String(radiusMeters),
    });
    return apiRequest(
      `/reports/nearby?${query.toString()}`,
      z.array(communityReportResponseSchema),
      { token, signal },
    );
  },
  uploadPhoto: (token: string, id: string, asset: ReportPhotoAsset) =>
    apiRequest(`/reports/${encodeURIComponent(id)}/photo`, reportResponseSchema, {
      token,
      method: 'PUT',
      rawBody: asset.base64,
      headers: {
        'Content-Type': 'application/vnd.safewalk.image+base64',
        'X-Photo-Mime-Type': asset.mimeType,
      },
      timeoutMs: 30000,
    }),
  photo: async (token: string, id: string, signal?: AbortSignal) => {
    const photo = await apiRequest(
      `/reports/${encodeURIComponent(id)}/photo`,
      photoResponseSchema,
      {
        token,
        signal,
      },
    );
    return `data:${photo.mimeType};base64,${photo.data}`;
  },
  feedback: (token: string, id: string, choice: 'present' | 'resolved' | 'not_found') =>
    apiRequest(`/reports/${encodeURIComponent(id)}/feedback`, reportChoiceSchema, {
      token,
      method: 'PUT',
      body: { choice },
    }),
  flag: (token: string, id: string) =>
    apiRequest(`/reports/${encodeURIComponent(id)}/flag`, flagResponseSchema, {
      token,
      method: 'POST',
    }),
};
