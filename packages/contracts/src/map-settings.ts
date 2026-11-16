import { z } from 'zod';
export const mapConsentVersion = 'public-maps-v1' as const;
export const mapConsentInputSchema = z.object({
  enabled: z.boolean(),
  version: z.literal(mapConsentVersion),
});
export const mapConsentResponseSchema = z.object({
  enabled: z.boolean(),
  version: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type MapConsent = z.infer<typeof mapConsentResponseSchema>;
