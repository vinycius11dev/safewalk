import { z } from 'zod';
import { realRouteSchema, walkingProfileSchema, type RealRoute } from './routing.js';
export { demoIncidentCatalog } from './demo-incidents.js';
export * from './routing.js';
export * from './urban.js';
export * from './map-settings.js';

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'Informe um e-mail válido.' }));
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.').max(128),
});
export const passwordSchema = z
  .string()
  .min(8, 'Use uma senha com pelo menos 8 caracteres.')
  .max(128, 'Use uma senha com até 128 caracteres.');
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: emailSchema,
  password: passwordSchema,
});

/** Recuperação de senha por e-mail (app e painel). O token tem 32 bytes em base64url. */
export const PASSWORD_RESET_TTL_MINUTES = 30;
export const passwordResetTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Este link de redefinição é inválido. Peça um novo.');
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: passwordResetTokenSchema,
  password: passwordSchema,
});
export const passwordResetRequestResponseSchema = z.object({
  message: z.string(),
  /** Só em desenvolvimento, sem SMTP: o link que seria enviado, para testar o fluxo localmente. */
  previewUrl: z.url().optional(),
});
export type PasswordResetRequestResponse = z.infer<typeof passwordResetRequestResponseSchema>;
export const pinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\+?[\d\s()-]{10,20}$/),
  email: emailSchema.optional(),
  emailTripAlerts: z.boolean().default(false),
  relationship: z.string().trim().max(50).default('Contato de segurança'),
});
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: emailSchema,
  phone: z.union([
    z.literal(''),
    z.string().regex(/^\+?[\d\s()-]{10,20}$/, 'Informe um celular com DDD.'),
  ]),
  currentPin: pinSchema.shape.pin.optional(),
  password: z.string().min(1).max(128).optional(),
});
export const changePinSchema = z.object({
  currentPin: pinSchema.shape.pin,
  newPin: pinSchema.shape.pin,
});
export const deleteAccountSchema = z
  .object({
    pin: pinSchema.shape.pin.optional(),
    password: z.string().min(1).max(128).optional(),
  })
  .refine((value) => Boolean(value.pin || value.password), 'Informe seu PIN ou sua senha.');
export const contactUpdateSchema = contactSchema.extend({
  currentPin: pinSchema.shape.pin,
  defaultAccompany: z.boolean().default(true),
});
export const profileSettingsSchema = z.object({
  responseSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  walkingProfile: walkingProfileSchema,
  automaticDetection: z.boolean(),
  arrivalCheckin: z.boolean(),
  retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  contributeReports: z.boolean(),
  signalLossMinutes: z
    .union([z.literal(0), z.literal(5), z.literal(10), z.literal(15)])
    .default(10),
});
/** PIN atual: obrigatório no servidor quando a mudança reduz a proteção. */
export const profileSettingsInputSchema = profileSettingsSchema.extend({
  currentPin: pinSchema.shape.pin.optional(),
});
export type ProfileSettingsInput = z.infer<typeof profileSettingsInputSchema>;
export const profileSettingsResponseSchema = profileSettingsSchema;
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export const tripFeedbackSchema = z.object({ feeling: z.enum(['safe', 'neutral', 'unsafe']) });
export const reportTypeSchema = z.enum([
  'robbery',
  'aggression',
  'harassment',
  'flood',
  'pothole',
  'traffic_light',
  'lighting',
  'sidewalk',
  'construction',
  'obstruction',
  'other',
]);
/**
 * Relatos de conservação da cidade, que podem ser enviados ao painel da Prefeitura. Crimes
 * (roubo, agressão, assédio, outro crime) ficam de fora: são assunto de polícia, não de zeladoria.
 */
export const governmentReportTypes = [
  'pothole',
  'traffic_light',
  'flood',
  'lighting',
  'sidewalk',
  'construction',
  'obstruction',
] as const satisfies readonly z.infer<typeof reportTypeSchema>[];
export function canSendToGovernment(type: z.infer<typeof reportTypeSchema>): boolean {
  return (governmentReportTypes as readonly string[]).includes(type);
}
export const reportSchema = z.object({
  type: reportTypeSchema,
  description: z.string().trim().max(1000).default(''),
  address: z.string().trim().min(3).max(200),
  location: coordinatesSchema,
});
export const reportSubmissionSchema = reportSchema.extend({
  shareWithCommunity: z.boolean().default(false),
  /** A pessoa escolhe, relato a relato, mandar o local e a foto ao painel da Prefeitura. */
  shareWithGovernment: z.boolean().default(false),
});
/** Andamento do relato no painel: só o operador do painel muda, nunca a pessoa que relatou. */
export const governmentStatusSchema = z.enum([
  'received',
  'analyzing',
  'dispatched',
  'resolved',
  'dismissed',
]);
export const governmentStatusLabels: Record<z.infer<typeof governmentStatusSchema>, string> = {
  received: 'Recebido',
  analyzing: 'Em análise',
  dispatched: 'Equipe acionada',
  resolved: 'Resolvido',
  dismissed: 'Arquivado',
};
/** Estados em que o relato ainda espera uma solução. */
export const openGovernmentStatuses = ['received', 'analyzing', 'dispatched'] as const;
export const reportFeedbackSchema = z.object({
  choice: z.enum(['present', 'resolved', 'not_found']),
});
export const routeKindSchema = z.enum(['safer', 'faster']);
export const tripStatusSchema = z.enum([
  'active',
  'checkin_pending',
  'alerted',
  'escalated',
  'arrived',
  'cancelled',
]);
export const startTripSchema = z
  .object({
    routeKind: routeKindSchema,
    contactIds: z.array(z.string().uuid()).max(10),
    destination: z.string().trim().min(2).max(200),
    routeId: z.uuid().optional(),
    timerMinutes: z.number().int().min(5).max(120).optional(),
    /** Declaração de que um adulto responsável acompanha; exigida no perfil criança. */
    adultAccompanying: z.boolean().optional(),
    /** Escolha do titular de avisar os contatos; só vale em rota calculada para cadeira de rodas. */
    shareWheelchair: z.boolean().optional(),
  })
  .refine((value) => !(value.routeId && value.timerMinutes !== undefined), {
    message: 'Escolha uma rota calculada ou um tempo de acompanhamento, não os dois.',
  });
export const positionSchema = z.object({
  ...coordinatesSchema.shape,
  accuracyMeters: z.number().nonnegative().max(10000),
  recordedAt: z.iso.datetime(),
});
export const tripEndSchema = pinSchema.extend({ outcome: z.enum(['arrived', 'cancelled']) });
export const alertSchema = z.object({ reason: z.enum(['manual', 'stopped', 'deviation', 'late']) });
export const tripAlertReasonSchema = z.enum([
  'manual',
  'stopped',
  'deviation',
  'late',
  'signal_lost',
  'duress',
]);
export const duressPinSchema = z.object({
  currentPin: pinSchema.shape.pin,
  duressPin: pinSchema.shape.pin,
});
export const removeDuressPinSchema = z.object({ currentPin: pinSchema.shape.pin });
export const savedPlaceKindSchema = z.enum(['home', 'work', 'other']);
export const savedPlaceInputSchema = z.object({
  kind: savedPlaceKindSchema,
  label: z.string().trim().min(2).max(60),
  address: z.string().trim().min(3).max(300),
  location: coordinatesSchema,
});
export const savedPlaceResponseSchema = savedPlaceInputSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type RouteKind = z.infer<typeof routeKindSchema>;
export type TripStatus = z.infer<typeof tripStatusSchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ReportInput = z.infer<typeof reportSubmissionSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type TripAlertReason = z.infer<typeof tripAlertReasonSchema>;
export type TripMode = 'route' | 'timer' | 'demo';
export type SavedPlaceKind = z.infer<typeof savedPlaceKindSchema>;
export type SavedPlaceInput = z.infer<typeof savedPlaceInputSchema>;
export type SavedPlace = z.infer<typeof savedPlaceResponseSchema>;
export type User = {
  id: string;
  name: string;
  email: string;
  hasPin: boolean;
  hasDuressPin: boolean;
  demo: boolean;
};
export type Session = { token: string; user: User };
export type Contact = ContactInput & { id: string; accepted: boolean; defaultAccompany: boolean };
export type DemoRouteOption = {
  kind: RouteKind;
  durationMinutes: number;
  distanceMeters: number;
  riskLabel: 'baixo' | 'alto';
  description: string;
  points: Coordinates[];
  simulated: true;
};
export type RouteOption = DemoRouteOption | RealRoute;
export type Trip = {
  id: string;
  status: TripStatus;
  mode: TripMode;
  routeKind: RouteKind;
  destination: string;
  startedAt: string;
  expectedArrivalAt: string;
  lastPosition: (PositionInput & { receivedAt: string }) | null;
  alertDeadline: string | null;
  escalationDeadline: string | null;
  alertReason: TripAlertReason | null;
  feedback: 'safe' | 'neutral' | 'unsafe' | null;
  contactIds: string[];
  route?: RealRoute | null;
  cameraRequest?: CameraImageRequest | null;
  alertMessages?: ContactAlertMessage[];
};
export type ShareLink = { url: string; expiresAt: string; contactId: string };
export type TrackingView = {
  travelerName: string;
  travelerPhone: string | null;
  trip: Trip;
  route: RouteOption | null;
  acknowledged: boolean;
  duress: { usedAt: string } | null;
  wheelchairShared: boolean;
  simulatedIntegrations: true;
};
export type Report = ReportInput & {
  id: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'resolved';
};
export type ApiErrorBody = { error: { code: string; message: string } };
export const reportLabels: Record<ReportType, string> = {
  robbery: 'Roubo de celular',
  aggression: 'Agressão',
  harassment: 'Assédio',
  flood: 'Alagamento',
  pothole: 'Buraco na via',
  traffic_light: 'Semáforo com defeito',
  lighting: 'Rua sem luz',
  sidewalk: 'Calçada quebrada',
  construction: 'Obra na calçada',
  obstruction: 'Passagem bloqueada',
  other: 'Outro crime',
};

export const userResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  hasPin: z.boolean(),
  hasDuressPin: z.boolean().default(false),
  demo: z.boolean(),
});
export const sessionResponseSchema = z.object({ token: z.string(), user: userResponseSchema });
export const profileResponseSchema = userResponseSchema.extend({ phone: z.string() });
export const contactResponseSchema = contactSchema.extend({
  id: z.uuid(),
  accepted: z.boolean(),
  defaultAccompany: z.boolean().default(true),
});
export const demoRouteResponseSchema = z.object({
  kind: routeKindSchema,
  durationMinutes: z.number(),
  distanceMeters: z.number(),
  riskLabel: z.enum(['baixo', 'alto']),
  description: z.string(),
  points: z.array(coordinatesSchema),
  simulated: z.literal(true),
});
export const routeResponseSchema = z.union([demoRouteResponseSchema, realRouteSchema]);
/**
 * Pedido de imagens às câmeras Smart Sampa registrado quando o alerta chega aos contatos.
 * Sempre simulado: nenhuma câmera real é acionada e nenhuma imagem é recebida.
 */
export const cameraImageRequestSchema = z.object({
  requestedAt: z.iso.datetime(),
  windowStart: z.iso.datetime(),
  windowEnd: z.iso.datetime(),
  radiusMeters: z.number().int().positive(),
  basis: z.enum(['last_position', 'route', 'none']),
  simulated: z.literal(true),
});
export type CameraImageRequest = z.infer<typeof cameraImageRequestSchema>;
/**
 * Automatic alert e-mail to one contact, for the latest alert of the trip.
 * accepted_by_relay: the SMTP server accepted it; it does not prove the contact read it.
 */
export const contactAlertMessageStatusSchema = z.enum([
  'pending',
  'accepted_by_relay',
  'failed',
  'not_configured',
  'not_enabled',
  'cancelled',
]);
export const contactAlertMessageSchema = z.object({
  contactId: z.uuid(),
  channel: z.literal('email'),
  status: contactAlertMessageStatusSchema,
  attempts: z.number().int().nonnegative(),
  acceptedAt: z.iso.datetime().nullable(),
});
export type ContactAlertMessageStatus = z.infer<typeof contactAlertMessageStatusSchema>;
export type ContactAlertMessage = z.infer<typeof contactAlertMessageSchema>;
export const tripResponseSchema = z.object({
  id: z.uuid(),
  status: tripStatusSchema,
  mode: z.enum(['route', 'timer', 'demo']).default('route'),
  routeKind: routeKindSchema,
  destination: z.string(),
  startedAt: z.iso.datetime(),
  expectedArrivalAt: z.iso.datetime(),
  lastPosition: positionSchema.extend({ receivedAt: z.iso.datetime() }).nullable(),
  alertDeadline: z.iso.datetime().nullable(),
  escalationDeadline: z.iso.datetime().nullable(),
  alertReason: tripAlertReasonSchema.nullable().default(null),
  feedback: tripFeedbackSchema.shape.feeling.nullable().default(null),
  contactIds: z.array(z.uuid()),
  route: realRouteSchema.nullable().default(null),
  cameraRequest: cameraImageRequestSchema.nullable().default(null),
  alertMessages: z.array(contactAlertMessageSchema).default([]),
});
export const shareLinkResponseSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
  contactId: z.uuid(),
});
export const revokeShareLinkResponseSchema = z.object({
  contactId: z.uuid(),
  revokedLinks: z.number().int().min(0),
});
export const tripStartEmailStatusSchema = z.enum([
  'accepted_by_relay',
  'failed',
  'not_configured',
  'not_enabled',
]);
export const tripStartEmailNotificationSchema = z.object({
  contactId: z.uuid(),
  status: tripStartEmailStatusSchema,
});
export const startedTripResponseSchema = z.object({
  trip: tripResponseSchema,
  links: z.array(shareLinkResponseSchema),
  emailNotifications: z.array(tripStartEmailNotificationSchema).default([]),
});
export type TripStartEmailNotification = z.infer<typeof tripStartEmailNotificationSchema>;
export type StartedTripResponse = z.infer<typeof startedTripResponseSchema>;
export const trackingResponseSchema = z.object({
  travelerName: z.string(),
  travelerPhone: z.string().nullable().default(null),
  trip: tripResponseSchema,
  route: routeResponseSchema.nullable(),
  acknowledged: z.boolean(),
  duress: z.object({ usedAt: z.iso.datetime() }).nullable().default(null),
  wheelchairShared: z.boolean().default(false),
  simulatedIntegrations: z.literal(true),
});
export const reportResponseSchema = reportSchema.extend({
  shareWithCommunity: z.boolean().default(false),
  shareWithGovernment: z.boolean().default(false),
  governmentStatus: governmentStatusSchema.nullable().default(null),
  governmentUpdatedAt: z.iso.datetime().nullable().default(null),
  hasPhoto: z.boolean().default(false),
  confirmationCount: z.number().int().nonnegative().default(0),
  resolvedCount: z.number().int().nonnegative().default(0),
  notFoundCount: z.number().int().nonnegative().default(0),
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: z.enum(['active', 'resolved']),
});
export const communityReportResponseSchema = z.object({
  id: z.uuid(),
  type: reportTypeSchema,
  description: z.string().max(1000),
  location: coordinatesSchema,
  distanceMeters: z.number().nonnegative(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  hasPhoto: z.boolean(),
  confirmationCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  notFoundCount: z.number().int().nonnegative(),
  myChoice: z.enum(['present', 'resolved', 'not_found']).nullable(),
});
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export const invitationResponseSchema = z.object({
  inviterName: z.string(),
  contactName: z.string(),
  maskedEmail: z.string().nullable(),
  accepted: z.boolean(),
  responded: z.boolean(),
  expiresAt: z.iso.datetime(),
});
export const invitationLinkSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export const invitationDecisionSchema = z
  .object({
    accepted: z.boolean(),
    consent: z.boolean(),
    emailTripAlerts: z.boolean().default(false),
  })
  .refine((value) => !value.accepted || value.consent, 'Confirme seu consentimento para aceitar.')
  .refine(
    (value) => !value.emailTripAlerts || value.accepted,
    'Aceite o convite antes de autorizar avisos por e-mail.',
  );
export const personalDataExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  profile: profileResponseSchema,
  settings: profileSettingsSchema,
  data: z.object({
    contacts: z.array(z.record(z.string(), z.unknown())),
    trips: z.array(z.record(z.string(), z.unknown())),
    positions: z.array(z.record(z.string(), z.unknown())),
    events: z.array(z.record(z.string(), z.unknown())),
    reports: z.array(z.record(z.string(), z.unknown())),
    incidentFeedback: z.array(z.record(z.string(), z.unknown())).default([]),
    mapConsent: z.array(z.record(z.string(), z.unknown())).default([]),
    savedPlaces: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});
export const incidentFeedbackSchema = z.object({ choice: z.enum(['confirm', 'resolved']) });
export const incidentFeedbackResponseSchema = z.object({
  incidentId: z.string(),
  choice: incidentFeedbackSchema.shape.choice.nullable(),
  confirmations: z.number().int().nonnegative(),
  simulated: z.literal(true),
});

/** Contratos do painel da Prefeitura (demonstração): conta de operador, fila e andamento. */
export const adminRoleSchema = z.enum(['viewer', 'operator']);
export const adminRoleLabels: Record<z.infer<typeof adminRoleSchema>, string> = {
  viewer: 'Consulta',
  operator: 'Operador',
};
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.').max(128),
});
/** Operadores do painel usam senhas mais longas que as do app (mesma regra do admin:create). */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const adminPasswordSchema = z
  .string()
  .min(ADMIN_PASSWORD_MIN_LENGTH, 'Use uma senha com pelo menos 12 caracteres.')
  .max(128, 'Use uma senha com até 128 caracteres.');
export const adminResetPasswordSchema = z.object({
  token: passwordResetTokenSchema,
  password: adminPasswordSchema,
});
export const adminUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: adminRoleSchema,
});
export const adminSessionSchema = z.object({ token: z.string(), user: adminUserSchema });

/** Prioridade sugerida por regra fixa (tipo, relatos próximos, confirmações e idade). */
export const reportPrioritySchema = z.enum(['high', 'medium', 'normal']);
export const reportPriorityLabels: Record<z.infer<typeof reportPrioritySchema>, string> = {
  high: 'Alta',
  medium: 'Média',
  normal: 'Normal',
};

export const adminReportListQuerySchema = z.object({
  /** `open` reúne recebido, em análise e equipe acionada. */
  status: z.union([governmentStatusSchema, z.literal('open'), z.literal('all')]).default('open'),
  type: reportTypeSchema.optional(),
  q: z.string().trim().max(80).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});
export const adminStatusUpdateSchema = z.object({
  status: governmentStatusSchema,
  note: z.string().trim().max(500).default(''),
});

export const adminReportItemSchema = z.object({
  id: z.uuid(),
  type: reportTypeSchema,
  description: z.string(),
  address: z.string(),
  location: coordinatesSchema,
  createdAt: z.iso.datetime(),
  status: governmentStatusSchema,
  statusUpdatedAt: z.iso.datetime(),
  hasPhoto: z.boolean(),
  /** Outros usuários que confirmaram que o problema continua lá. */
  confirmationCount: z.number().int().nonnegative(),
  /** Relatos em aberto do mesmo tipo a até ~100 m, contando este. */
  nearbyCount: z.number().int().positive(),
  priority: reportPrioritySchema,
  /** A pessoa que relatou avisou que o problema passou; só o operador encerra o caso. */
  authorResolved: z.boolean(),
});
export const adminReportEventSchema = z.object({
  id: z.number().int(),
  fromStatus: governmentStatusSchema.nullable(),
  toStatus: governmentStatusSchema,
  note: z.string(),
  adminName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const adminReportDetailSchema = adminReportItemSchema.extend({
  events: z.array(adminReportEventSchema),
});
export const adminReportListSchema = z.object({
  items: z.array(adminReportItemSchema),
  /** Total que atende ao filtro, mesmo quando a lista foi cortada. */
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const adminHotspotSchema = z.object({
  type: reportTypeSchema,
  location: coordinatesSchema,
  count: z.number().int().positive(),
  address: z.string(),
  oldestAt: z.iso.datetime(),
});
export const adminSummarySchema = z.object({
  generatedAt: z.iso.datetime(),
  counts: z.object({
    open: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
    analyzing: z.number().int().nonnegative(),
    dispatched: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    dismissed: z.number().int().nonnegative(),
    receivedLast24h: z.number().int().nonnegative(),
    resolvedLast7d: z.number().int().nonnegative(),
    highPriorityOpen: z.number().int().nonnegative(),
  }),
  /** Tempo médio entre o relato e o encerramento como resolvido; nulo sem casos resolvidos. */
  averageResolutionHours: z.number().nonnegative().nullable(),
  openByType: z.array(z.object({ type: reportTypeSchema, count: z.number().int().positive() })),
  daily: z.array(
    z.object({
      date: z.string(),
      received: z.number().int().nonnegative(),
      resolved: z.number().int().nonnegative(),
    }),
  ),
  hotspots: z.array(adminHotspotSchema),
});

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminSession = z.infer<typeof adminSessionSchema>;
export type ReportPriority = z.infer<typeof reportPrioritySchema>;
export type GovernmentStatus = z.infer<typeof governmentStatusSchema>;
export type AdminReportItem = z.infer<typeof adminReportItemSchema>;
export type AdminReportEvent = z.infer<typeof adminReportEventSchema>;
export type AdminReportDetail = z.infer<typeof adminReportDetailSchema>;
export type AdminReportList = z.infer<typeof adminReportListSchema>;
export type AdminReportListQuery = z.infer<typeof adminReportListQuerySchema>;
export type AdminHotspot = z.infer<typeof adminHotspotSchema>;
export type AdminSummary = z.infer<typeof adminSummarySchema>;
