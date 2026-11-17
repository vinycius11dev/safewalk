import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import {
  sessionResponseSchema,
  startedTripResponseSchema,
  tripResponseSchema,
  trackingResponseSchema,
  savedPlaceResponseSchema,
  personalDataExportSchema,
} from '@safewalk/contracts';
import { env } from '../src/config/env.js';
import { pool } from '../src/database/pool.js';
import { errorHandler } from '../src/middleware/errors.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { contactsRouter } from '../src/modules/contacts/contacts.routes.js';
import { mapSettingsRouter } from '../src/modules/map-settings/map-settings.routes.js';
import { placesRouter } from '../src/modules/places/places.routes.js';
import { tripsRouter } from '../src/modules/trips/trips.routes.js';
import { trackingRouter } from '../src/modules/tracking/tracking.routes.js';
import type { RowDataPacket } from 'mysql2';
import { advanceDueAlerts } from '../src/jobs/alerts.repository.js';
import { CAMERA_REQUEST_EVENT } from '../src/modules/trips/trips.repository.js';
import { processContactAlerts } from '../src/modules/contact-alerts/contact-alerts.service.js';
import type { SafeWalkEmail } from '../src/integrations/email/smtp.js';

if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST))
  throw new Error('Este teste usa somente o banco local.');
if (env.DEMO_MODE !== 'true') throw new Error('Este teste precisa da API em modo demonstração.');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/maps', mapSettingsRouter);
app.use('/api/places', placesRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/tracking', trackingRouter);
app.use(errorHandler);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Servidor local indisponível');
const origin = `http://127.0.0.1:${address.port}`;

async function request(
  path: string,
  token?: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function demoAccount() {
  const response = await request('/api/auth/demo', undefined, {}, 'POST');
  assert.equal(response.status, 201);
  const session = sessionResponseSchema.parse(response.data);
  const contacts = (await request('/api/contacts', session.token)).data as {
    id: string;
    accepted: boolean;
  }[];
  const contactId = contacts.find((contact) => contact.accepted)?.id;
  assert.ok(contactId, 'A conta demo precisa de um contato aceito.');
  return { token: session.token, contactId };
}
async function startDemoTrip(token: string, contactId: string) {
  const response = await request('/api/trips', token, {
    routeKind: 'safer',
    destination: 'Destino sintético de segurança',
    contactIds: [contactId],
  });
  assert.equal(response.status, 201);
  const started = startedTripResponseSchema.parse(response.data);
  const trackingToken = new URL(started.links[0]!.url).pathname.split('/').at(-1)!;
  return { tripId: started.trip.id, trackingToken };
}
const positionBody = () => ({
  latitude: -23.564,
  longitude: -46.652,
  accuracyMeters: 12,
  recordedAt: new Date().toISOString(),
});

test('PIN de coação disfarça o cancelamento e a tela do titular segue normal', async () => {
  const { token, contactId } = await demoAccount();
  assert.equal(
    (await request('/api/auth/duress-pin', token, { currentPin: '1234', duressPin: '1234' }, 'PUT'))
      .status,
    409,
  );
  assert.equal(
    (await request('/api/auth/duress-pin', token, { currentPin: '1234', duressPin: '9999' }, 'PUT'))
      .status,
    204,
  );
  const { tripId, trackingToken } = await startDemoTrip(token, contactId);
  const sos = await request(`/api/trips/${tripId}/alerts`, token, { reason: 'manual' });
  assert.equal(sos.data.status, 'alerted');
  // O SOS registra o pedido simulado de imagens às câmeras próximas.
  const camera = tripResponseSchema.parse(sos.data).cameraRequest;
  assert.ok(camera);
  assert.equal(camera.simulated, true);
  assert.equal(camera.radiusMeters, 150);
  assert.ok(Date.parse(camera.windowStart) < Date.parse(camera.windowEnd));
  const disguised = await request(`/api/trips/${tripId}/cancel-alert`, token, { pin: '9999' });
  assert.equal(disguised.status, 200);
  assert.equal(disguised.data.status, 'active');
  assert.equal(disguised.data.alertReason, null);
  assert.equal(disguised.data.alertDeadline, null);
  // Sob coação, a tela do titular não revela o pedido às câmeras; o contato vê.
  assert.equal(disguised.data.cameraRequest, null);
  const tracking = trackingResponseSchema.parse(
    (await request(`/api/tracking/${trackingToken}`)).data,
  );
  assert.equal(tracking.trip.status, 'escalated');
  assert.equal(tracking.trip.alertReason, 'duress');
  assert.equal(tracking.trip.cameraRequest?.simulated, true);
  assert.ok(tracking.duress?.usedAt);
  assert.equal(
    (await request(`/api/trips/${tripId}/positions`, token, positionBody())).status,
    204,
  );
  const sosAgain = await request(`/api/trips/${tripId}/alerts`, token, { reason: 'manual' });
  assert.equal(sosAgain.data.status, 'escalated');
  const finished = await request(`/api/trips/${tripId}/finish`, token, {
    pin: '1234',
    outcome: 'arrived',
  });
  assert.equal(finished.data.status, 'arrived');
  const closed = await request(`/api/tracking/${trackingToken}`);
  assert.equal(closed.status, 410);
  assert.equal(closed.data.error.code, 'TRIP_ARRIVED');
});

test('encerramento com PIN de coação mantém o link vivo com o alerta silencioso', async () => {
  const { token, contactId } = await demoAccount();
  assert.equal(
    (await request('/api/auth/duress-pin', token, { currentPin: '1234', duressPin: '9999' }, 'PUT'))
      .status,
    204,
  );
  const { tripId, trackingToken } = await startDemoTrip(token, contactId);
  const finished = await request(`/api/trips/${tripId}/finish`, token, {
    pin: '9999',
    outcome: 'arrived',
  });
  assert.equal(finished.status, 200);
  assert.equal(finished.data.status, 'arrived');
  assert.equal(finished.data.alertReason, null);
  const tracking = trackingResponseSchema.parse(
    (await request(`/api/tracking/${trackingToken}`)).data,
  );
  assert.equal(tracking.trip.status, 'arrived');
  assert.ok(tracking.duress?.usedAt);
  const next = await request('/api/trips', token, {
    routeKind: 'safer',
    destination: 'Novo trajeto após coação',
    contactIds: [contactId],
  });
  assert.equal(next.status, 201);
});

test('PIN incorreto não encerra nem cancela o trajeto', async () => {
  const { token, contactId } = await demoAccount();
  const { tripId } = await startDemoTrip(token, contactId);
  const wrong = await request(`/api/trips/${tripId}/finish`, token, {
    pin: '0000',
    outcome: 'arrived',
  });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.data.error.code, 'INVALID_PIN');
  const trip = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.equal(trip.status, 'active');
});

/** The contact accepted the invitation and authorized alert e-mails (done by the contact). */
async function authorizeAlertEmail(contactId: string) {
  await pool.execute(
    'UPDATE contacts SET email = ?, email_trip_alerts = TRUE, email_trip_alerts_consented_at = UTC_TIMESTAMP(3) WHERE id = ?',
    [`alerta-${randomUUID()}@example.com`, contactId],
  );
}
const ALERTS_HELD_UNTIL = new Date('2099-01-01T00:00:00.000Z');
/**
 * A local API may be running its worker against this same database. A worker only takes messages
 * already due, so scheduling them far ahead leaves them to the test, and resetting the row undoes
 * anything a worker did right after the alert started.
 */
async function holdAlertsForTest(tripId: string) {
  await pool.execute(
    "UPDATE contact_alert_messages SET status = 'pending', attempts = 0, lease_until = NULL, accepted_at = NULL, next_attempt_at = ? WHERE trip_id = ?",
    [ALERTS_HELD_UNTIL, tripId],
  );
}
const processHeldAlerts = (
  tripId: string,
  options: { configured: boolean; sendEmail: (message: SafeWalkEmail) => Promise<void> },
) => processContactAlerts({ ...options, tripId, dueBy: ALERTS_HELD_UNTIL });

test('SOS envia e-mail ao contato autorizado com um link que abre o alerta', async () => {
  const { token, contactId } = await demoAccount();
  await authorizeAlertEmail(contactId);
  const { tripId } = await startDemoTrip(token, contactId);
  const sos = tripResponseSchema.parse(
    (await request(`/api/trips/${tripId}/alerts`, token, { reason: 'manual' })).data,
  );
  assert.deepEqual(
    sos.alertMessages.map((message) => [message.contactId, message.status]),
    [[contactId, 'pending']],
  );
  await holdAlertsForTest(tripId);
  const sent: SafeWalkEmail[] = [];
  const processed = await processHeldAlerts(tripId, {
    configured: true,
    sendEmail: async (message) => {
      sent.push(message);
    },
  });
  assert.equal(processed, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0]!.text, /pediu ajuda pelo botão SOS/);
  const url = /\S+\/acompanhar\/\S+/.exec(sent[0]!.text)?.[0];
  assert.ok(url);
  const tracking = trackingResponseSchema.parse(
    (await request(`/api/tracking/${url.split('/').at(-1)}`)).data,
  );
  assert.equal(tracking.trip.status, 'alerted');
  const after = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.equal(after.alertMessages[0]?.status, 'accepted_by_relay');
  assert.ok(after.alertMessages[0]?.acceptedAt);
  // The same alert is never e-mailed twice.
  assert.equal(
    await processHeldAlerts(tripId, {
      configured: true,
      sendEmail: () => Promise.reject(new Error('não deveria enviar de novo')),
    }),
    0,
  );
  await request(`/api/trips/${tripId}/finish`, token, { pin: '1234', outcome: 'arrived' });
});

test('sem SMTP nada sai do servidor e o PIN principal descarta o aviso pendente', async () => {
  const { token, contactId } = await demoAccount();
  await authorizeAlertEmail(contactId);
  const first = await startDemoTrip(token, contactId);
  await request(`/api/trips/${first.tripId}/alerts`, token, { reason: 'manual' });
  await holdAlertsForTest(first.tripId);
  await processHeldAlerts(first.tripId, {
    configured: false,
    sendEmail: () => Promise.reject(new Error('sem SMTP não envia')),
  });
  let trip = tripResponseSchema.parse((await request(`/api/trips/${first.tripId}`, token)).data);
  assert.equal(trip.alertMessages[0]?.status, 'not_configured');
  await request(`/api/trips/${first.tripId}/finish`, token, { pin: '1234', outcome: 'arrived' });

  const second = await startDemoTrip(token, contactId);
  await request(`/api/trips/${second.tripId}/alerts`, token, { reason: 'manual' });
  await holdAlertsForTest(second.tripId);
  await request(`/api/trips/${second.tripId}/cancel-alert`, token, { pin: '1234' });
  trip = tripResponseSchema.parse((await request(`/api/trips/${second.tripId}`, token)).data);
  assert.equal(trip.alertMessages[0]?.status, 'cancelled');
  await request(`/api/trips/${second.tripId}/finish`, token, { pin: '1234', outcome: 'arrived' });
});

test('PIN de coação avisa os contatos sem mostrar o envio na tela do titular', async () => {
  const { token, contactId } = await demoAccount();
  await authorizeAlertEmail(contactId);
  await request('/api/auth/duress-pin', token, { currentPin: '1234', duressPin: '9999' }, 'PUT');
  const { tripId } = await startDemoTrip(token, contactId);
  const finished = tripResponseSchema.parse(
    (await request(`/api/trips/${tripId}/finish`, token, { pin: '9999', outcome: 'arrived' })).data,
  );
  assert.deepEqual(finished.alertMessages, []);
  await holdAlertsForTest(tripId);
  const sent: SafeWalkEmail[] = [];
  await processHeldAlerts(tripId, {
    configured: true,
    sendEmail: async (message) => {
      sent.push(message);
    },
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0]!.text, /não mencione este aviso/);
  const seen = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.deepEqual(seen.alertMessages, []);
});

test('perda de sinal pede check-in, cancelamento rearma e pausa desarma', async () => {
  const { token, contactId } = await demoAccount();
  const settings = (await request('/api/auth/settings', token)).data as Record<string, unknown>;
  assert.equal(
    (await request('/api/auth/settings', token, { ...settings, signalLossMinutes: 5 }, 'PUT'))
      .status,
    200,
  );
  const { tripId } = await startDemoTrip(token, contactId);
  assert.equal(
    (await request(`/api/trips/${tripId}/positions`, token, positionBody())).status,
    204,
  );
  await pool.execute(
    'UPDATE trips SET last_position_received_at = UTC_TIMESTAMP(3) - INTERVAL 6 MINUTE WHERE id = ?',
    [tripId],
  );
  await advanceDueAlerts();
  let trip = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.equal(trip.status, 'checkin_pending');
  assert.equal(trip.alertReason, 'signal_lost');
  const cancelled = await request(`/api/trips/${tripId}/cancel-alert`, token, { pin: '1234' });
  assert.equal(cancelled.data.status, 'active');
  await advanceDueAlerts();
  trip = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.equal(trip.status, 'active');
  assert.equal(
    (await request(`/api/trips/${tripId}/positions`, token, positionBody())).status,
    204,
  );
  assert.equal(
    (await request(`/api/trips/${tripId}/positions/pause`, token, {}, 'POST')).status,
    204,
  );
  await pool.execute(
    'UPDATE trips SET last_position_received_at = UTC_TIMESTAMP(3) - INTERVAL 6 MINUTE WHERE id = ? AND last_position_received_at IS NOT NULL',
    [tripId],
  );
  await advanceDueAlerts();
  trip = tripResponseSchema.parse((await request(`/api/trips/${tripId}`, token)).data);
  assert.equal(trip.status, 'active');
});

test('perfil criança só inicia trajeto com a confirmação de um adulto responsável', async () => {
  const { token, contactId } = await demoAccount();
  const settings = (await request('/api/auth/settings', token)).data as Record<string, unknown>;
  assert.equal(
    (
      await request(
        '/api/auth/settings',
        token,
        { ...settings, walkingProfile: 'child', currentPin: '1234' },
        'PUT',
      )
    ).status,
    200,
  );
  const trip = { routeKind: 'faster', destination: 'Passeio', contactIds: [contactId] };
  for (const body of [trip, { ...trip, adultAccompanying: false }]) {
    const refused = await request('/api/trips', token, { ...body, timerMinutes: 10 });
    assert.equal(refused.status, 409);
    assert.equal(
      (refused.data as { error: { code: string } }).error.code,
      'ADULT_COMPANION_REQUIRED',
    );
  }
  const created = await request('/api/trips', token, {
    ...trip,
    timerMinutes: 10,
    adultAccompanying: true,
  });
  assert.equal(created.status, 201);
});
test('modo tempo não tem rota, valida duração e dispara check-in ao final', async () => {
  const { token, contactId } = await demoAccount();
  assert.equal(
    (
      await request('/api/trips', token, {
        routeKind: 'faster',
        destination: 'Timer inválido',
        contactIds: [],
        routeId: randomUUID(),
        timerMinutes: 10,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/trips', token, {
        routeKind: 'faster',
        destination: 'Timer curto',
        contactIds: [],
        timerMinutes: 3,
      })
    ).status,
    400,
  );
  const created = await request('/api/trips', token, {
    routeKind: 'faster',
    destination: 'Acompanhamento por tempo',
    contactIds: [contactId],
    timerMinutes: 10,
  });
  assert.equal(created.status, 201);
  const started = startedTripResponseSchema.parse(created.data);
  const { trip } = started;
  assert.equal(trip.mode, 'timer');
  assert.equal(trip.route, null);
  const duration = Date.parse(trip.expectedArrivalAt) - Date.parse(trip.startedAt);
  assert.ok(Math.abs(duration - 10 * 60000) <= 5000, 'A duração deve ser de 10 minutos.');
  const trackingToken = new URL(started.links[0]!.url).pathname.split('/').at(-1)!;
  const tracking = trackingResponseSchema.parse(
    (await request(`/api/tracking/${trackingToken}`)).data,
  );
  assert.equal(tracking.route, null);
  const settings = (await request('/api/auth/settings', token)).data as Record<string, unknown>;
  assert.equal(
    (
      await request(
        '/api/auth/settings',
        token,
        { ...settings, arrivalCheckin: false, signalLossMinutes: 0, currentPin: '1234' },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/maps/consent', token, { enabled: true, version: 'public-maps-v1' }, 'PUT'))
      .status,
    200,
  );
  assert.equal(
    (await request(`/api/trips/${trip.id}/positions`, token, positionBody())).status,
    204,
  );
  await pool.execute(
    'UPDATE trips SET expected_arrival_at = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?',
    [trip.id],
  );
  await advanceDueAlerts();
  const updated = tripResponseSchema.parse((await request(`/api/trips/${trip.id}`, token)).data);
  assert.equal(updated.status, 'checkin_pending');
  assert.equal(updated.alertReason, 'late');
  assert.equal(updated.cameraRequest, null);
  // Sem resposta ao check-in, o alerta vai aos contatos e o pedido às câmeras é registrado.
  await pool.execute(
    'UPDATE trips SET alert_deadline = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE id = ?',
    [trip.id],
  );
  await advanceDueAlerts();
  const alerted = tripResponseSchema.parse((await request(`/api/trips/${trip.id}`, token)).data);
  assert.equal(alerted.status, 'alerted');
  assert.equal(alerted.cameraRequest?.basis, 'last_position');
  // The automatic alert also queues one message per contact (sent only if authorized).
  assert.equal(alerted.alertMessages.length, alerted.contactIds.length);
});

const tripEventTypes = async (tripId: string): Promise<string[]> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT type FROM trip_events WHERE trip_id = ?',
    [tripId],
  );
  return rows.map((row) => String(row.type));
};
/** Moves the escalation deadline to the past and lets the worker step run. */
async function passEscalationDeadline(tripId: string) {
  await pool.execute(
    'UPDATE trips SET escalation_deadline = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE id = ?',
    [tripId],
  );
  await advanceDueAlerts();
}

test('conta real em trajeto real não registra câmeras Smart Sampa nem etapa da GCM', async () => {
  const suffix = randomUUID();
  const registered = await request('/api/auth/register', undefined, {
    name: 'Conta sintética sem simulação',
    email: `sem-simulacao.${suffix}@safewalk.test`,
    password: `Synthet1c-${suffix}`,
  });
  assert.equal(registered.status, 201);
  const { token, user } = sessionResponseSchema.parse(registered.data);
  assert.equal(user.demo, false);
  assert.equal((await request('/api/auth/pin', token, { pin: '1234' }, 'PUT')).status, 204);
  const contact = await request('/api/contacts', token, {
    name: 'Contato sintético',
    phone: '+5511900000042',
  });
  assert.equal(contact.status, 201);
  const contactId = (contact.data as { id: string }).id;
  // The contact accepted the invitation (done by the contact on the invitation page).
  await pool.execute('UPDATE contacts SET accepted = TRUE WHERE id = ?', [contactId]);
  const created = await request('/api/trips', token, {
    routeKind: 'faster',
    destination: 'Acompanhamento real por tempo',
    contactIds: [contactId],
    timerMinutes: 10,
  });
  assert.equal(created.status, 201);
  const started = startedTripResponseSchema.parse(created.data);
  assert.equal(started.trip.mode, 'timer');
  const trackingToken = new URL(started.links[0]!.url).pathname.split('/').at(-1)!;
  const sos = tripResponseSchema.parse(
    (await request(`/api/trips/${started.trip.id}/alerts`, token, { reason: 'manual' })).data,
  );
  assert.equal(sos.status, 'alerted');
  assert.equal(sos.cameraRequest, null);
  // The real alert still reaches the contact: one message queued per chosen contact.
  assert.equal(sos.alertMessages.length, 1);
  assert.ok(sos.alertStartedAt);
  assert.deepEqual(sos.acknowledgedContactIds, []);
  const tracking = trackingResponseSchema.parse(
    (await request(`/api/tracking/${trackingToken}`)).data,
  );
  assert.equal(tracking.trip.status, 'alerted');
  assert.equal(tracking.trip.cameraRequest, null);
  await passEscalationDeadline(started.trip.id);
  const escalated = tripResponseSchema.parse(
    (await request(`/api/trips/${started.trip.id}`, token)).data,
  );
  assert.equal(escalated.status, 'escalated');
  assert.equal(escalated.cameraRequest, null);
  const events = await tripEventTypes(started.trip.id);
  assert.ok(events.includes('alert_unanswered_by_contacts'));
  assert.ok(!events.includes('gcm_escalation_simulated'));
  assert.ok(!events.includes(CAMERA_REQUEST_EVENT));
  // The owner only reads "a contact confirmed" after the contact really confirms on the link.
  assert.deepEqual(escalated.acknowledgedContactIds, []);
  assert.equal(
    (await request(`/api/tracking/${trackingToken}/acknowledge`, undefined, {})).status,
    200,
  );
  const confirmed = tripResponseSchema.parse(
    (await request(`/api/trips/${started.trip.id}`, token)).data,
  );
  assert.deepEqual(confirmed.acknowledgedContactIds, [contactId]);
  await request(`/api/trips/${started.trip.id}/finish`, token, { pin: '1234', outcome: 'arrived' });
});

test('a demonstração mantém as etapas simuladas de câmeras e GCM', async () => {
  const { token, contactId } = await demoAccount();
  const { tripId } = await startDemoTrip(token, contactId);
  const sos = tripResponseSchema.parse(
    (await request(`/api/trips/${tripId}/alerts`, token, { reason: 'manual' })).data,
  );
  assert.equal(sos.cameraRequest?.simulated, true);
  await passEscalationDeadline(tripId);
  const events = await tripEventTypes(tripId);
  assert.ok(events.includes('gcm_escalation_simulated'));
  assert.ok(events.includes(CAMERA_REQUEST_EVENT));
  assert.ok(!events.includes('alert_unanswered_by_contacts'));
  await request(`/api/trips/${tripId}/finish`, token, { pin: '1234', outcome: 'arrived' });
});

test('locais salvos: tipo único, área de serviço, dono e exportação', async () => {
  const { token } = await demoAccount();
  const inside = { latitude: -23.556, longitude: -46.652 };
  const created = await request('/api/places', token, {
    kind: 'home',
    label: 'Casa',
    address: 'Rua Augusta, 1000',
    location: inside,
  });
  assert.equal(created.status, 201);
  const place = savedPlaceResponseSchema.parse(created.data);
  const duplicate = await request('/api/places', token, {
    kind: 'home',
    label: 'Outra casa',
    address: 'Rua Augusta, 2000',
    location: inside,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.error.code, 'PLACE_KIND_EXISTS');
  const outside = await request('/api/places', token, {
    kind: 'work',
    label: 'Fora de SP',
    address: 'Rio de Janeiro',
    location: { latitude: -22.9068, longitude: -43.1729 },
  });
  assert.equal(outside.status, 400);
  assert.equal(outside.data.error.code, 'OUTSIDE_SERVICE_AREA');
  const other = await demoAccount();
  assert.equal(
    (await request(`/api/places/${place.id}`, other.token, undefined, 'DELETE')).status,
    404,
  );
  const exported = personalDataExportSchema.parse((await request('/api/auth/export', token)).data);
  const savedPlaces = exported.data.savedPlaces as { id: string; kind: string }[];
  assert.ok(savedPlaces.some((item) => item.id === place.id && item.kind === 'home'));
});

test.after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
});
