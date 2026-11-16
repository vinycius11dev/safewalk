import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { z } from 'zod';
import {
  sessionResponseSchema,
  routingRequestSchema,
  routingResponseSchema,
  startedTripResponseSchema,
  tripResponseSchema,
  trackingResponseSchema,
  contactResponseSchema,
} from '@safewalk/contracts';
import { env } from '../src/config/env.js';
import { pool } from '../src/database/pool.js';
import { routeForContact } from '../src/domain/route-request.js';
import { errorHandler } from '../src/middleware/errors.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { contactsRouter } from '../src/modules/contacts/contacts.routes.js';
import { invitationsRouter } from '../src/modules/contacts/invitations.routes.js';
import { mapSettingsRouter } from '../src/modules/map-settings/map-settings.routes.js';
import { geocodingRouter, routingRouter } from '../src/modules/routing/routing.routes.js';
import { tripsRouter } from '../src/modules/trips/trips.routes.js';
import { trackingRouter } from '../src/modules/tracking/tracking.routes.js';
import {
  storeGeography,
  storeProposal,
  ownedProposal,
} from '../src/modules/routing/routing.repository.js';
import { parseValhalla } from '../src/integrations/routing/valhalla.js';

if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST))
  throw new Error('Este teste usa somente o banco local.');

test(
  'HTTP e MariaDB: consentimento, rota própria, snapshot, ETA real e compartilhamento',
  { timeout: 30000 },
  async (t) => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/contacts', contactsRouter);
    app.use('/api/invitations', invitationsRouter);
    app.use('/api/maps', mapSettingsRouter);
    app.use('/api/geocoding', geocodingRouter);
    app.use('/api/routing', routingRouter);
    app.use('/api/trips', tripsRouter);
    app.use('/api/tracking', trackingRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor local indisponível');
    const origin = `http://127.0.0.1:${address.port}`;
    const accounts: { token: string; user: { id: string } }[] = [];
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
      return {
        status: response.status,
        data: response.status === 204 ? null : ((await response.json()) as unknown),
      };
    }
    try {
      for (let i = 0; i < 2; i++) {
        const registration = await request('/api/auth/register', undefined, {
          name: 'Conta sintética de rotas',
          email: `routing.${randomUUID()}@safewalk.test`,
          password: `Synthetic-${randomUUID()}`,
        });
        assert.equal(registration.status, 201);
        const session = sessionResponseSchema.parse(registration.data);
        assert.equal(session.user.demo, false);
        accounts.push(session);
        assert.equal(
          (await request('/api/auth/pin', session.token, { pin: '1234' }, 'PUT')).status,
          204,
        );
      }
      const owner = accounts[0]!;
      const stranger = accounts[1]!;
      const input = routingRequestSchema.parse({
        origin: { latitude: -23.5641, longitude: -46.6521 },
        destination: { latitude: -23.5535, longitude: -46.6527 },
        destinationLabel: 'Shopping Frei Caneca',
      });
      const providerPayload = JSON.parse(
        await readFile(
          new URL('./fixtures/routing/valhalla-paulista-frei-caneca.json', import.meta.url),
          'utf8',
        ),
      ) as unknown;
      // A recorded public-landmark response avoids external traffic and personal coordinates during tests.
      const key = createHash('sha256')
        .update(JSON.stringify([owner.user.id, 'pedestrian-route', input]))
        .digest('hex');
      await storeGeography(owner.user.id, key, 'valhalla', providerPayload, 300);
      await t.test('endpoints bloqueiam consulta antes do consentimento', async () => {
        assert.equal((await request('/api/routing/routes', owner.token, input)).status, 403);
        assert.equal((await request('/api/geocoding/search?q=Paulista', owner.token)).status, 403);
        assert.equal(
          (
            await request(
              '/api/maps/consent',
              owner.token,
              { enabled: true, version: 'public-maps-v1' },
              'PUT',
            )
          ).status,
          200,
        );
        assert.equal((await request('/api/routing/routes', undefined, input)).status, 401);
      });
      const response = await request('/api/routing/routes', owner.token, input);
      assert.equal(response.status, 200);
      const route = routingResponseSchema.parse(response.data).options[0]!;
      assert.equal(route.simulated, false);
      assert.equal(route.context?.truncated, true);
      await t.test('opção exige dono e validade e rejeita perfil de carro', async () => {
        const body = {
          routeKind: 'faster',
          routeId: route.id,
          contactIds: [],
          destination: 'Tentativa de alteração',
        };
        assert.equal((await request('/api/trips', stranger.token, body)).status, 409);
        const expired = parseValhalla(providerPayload, input, new Date(Date.now() - 3600000))[0]!;
        await storeProposal(owner.user.id, expired);
        await assert.rejects(ownedProposal(owner.user.id, expired.id), {
          code: 'ROUTE_PROPOSAL_EXPIRED',
        });
        assert.equal(
          (await request('/api/routing/routes', owner.token, { ...input, profile: 'driving' }))
            .status,
          400,
        );
      });
      const contactResult = await request('/api/contacts', owner.token, {
        name: 'Contato sintético',
        phone: '+5511900000011',
        relationship: 'Teste',
      });
      const contact = contactResponseSchema.parse(contactResult.data);
      const invitation = z
        .object({ url: z.url() })
        .parse((await request(`/api/contacts/${contact.id}/invitation`, owner.token, {})).data);
      const invitationToken = new URL(invitation.url).pathname.split('/').at(-1)!;
      assert.equal(
        (
          await request(`/api/invitations/${invitationToken}`, undefined, {
            accepted: true,
            consent: true,
          })
        ).status,
        200,
      );
      const start = await request('/api/trips', owner.token, {
        routeKind: 'safer',
        routeId: route.id,
        contactIds: [contact.id],
        destination: 'Não deve substituir o destino do servidor',
        route: { geometry: 'adulterada' },
      });
      assert.equal(start.status, 201);
      const started = startedTripResponseSchema.parse(start.data);
      await t.test('snapshot vem do servidor e prazo usa segundos reais', async () => {
        assert.deepEqual(started.trip.route, route);
        assert.equal(started.trip.routeKind, 'faster');
        assert.equal(started.trip.destination, input.destinationLabel);
        const duration =
          Date.parse(started.trip.expectedArrivalAt) - Date.parse(started.trip.startedAt);
        assert.ok(Math.abs(duration - route.durationSeconds * 1000) <= 1);
        const read = tripResponseSchema.parse(
          (await request(`/api/trips/${started.trip.id}`, owner.token)).data,
        );
        assert.deepEqual(read.route, route);
        assert.equal((await request(`/api/trips/${started.trip.id}`, stranger.token)).status, 404);
      });
      await t.test('link público recebe a mesma rota e encerramento revoga acesso', async () => {
        const trackingToken = new URL(started.links[0]!.url).pathname.split('/').at(-1)!;
        const tracking = trackingResponseSchema.parse(
          (await request(`/api/tracking/${trackingToken}`)).data,
        );
        // Mesma geometria e estimativas; só saem os detalhes pessoais do cálculo.
        assert.deepEqual(tracking.route, routeForContact(route));
        assert.equal(tracking.trip.contactIds.length, 0);
        assert.equal(tracking.trip.lastPosition, null);
        assert.equal(
          (
            await request(
              '/api/maps/consent',
              owner.token,
              { enabled: false, version: 'public-maps-v1' },
              'PUT',
            )
          ).status,
          200,
        );
        const position = {
          ...input.origin,
          accuracyMeters: 10,
          recordedAt: new Date().toISOString(),
        };
        assert.equal(
          (await request(`/api/trips/${started.trip.id}/positions`, owner.token, position)).status,
          403,
        );
        assert.equal(
          trackingResponseSchema.parse((await request(`/api/tracking/${trackingToken}`)).data).trip
            .lastPosition,
          null,
        );
        assert.equal(
          (
            await request(
              '/api/maps/consent',
              owner.token,
              { enabled: true, version: 'public-maps-v1' },
              'PUT',
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(`/api/trips/${started.trip.id}/positions`, owner.token, position)).status,
          204,
        );
        assert.equal(
          trackingResponseSchema.parse((await request(`/api/tracking/${trackingToken}`)).data).trip
            .lastPosition?.latitude,
          input.origin.latitude,
        );
        assert.equal(
          (
            await request(`/api/trips/${started.trip.id}/finish`, owner.token, {
              pin: '1234',
              outcome: 'arrived',
            })
          ).status,
          200,
        );
        assert.equal((await request(`/api/tracking/${trackingToken}`)).status, 410);
      });
      await t.test('cadeira de rodas só vai ao link quando o titular escolhe avisar', async () => {
        const trackedView = async (wheelchair: boolean, shareWheelchair: boolean) => {
          const proposal = parseValhalla(providerPayload, { ...input, wheelchair }, new Date())[0]!;
          await storeProposal(owner.user.id, proposal);
          const trip = startedTripResponseSchema.parse(
            (
              await request('/api/trips', owner.token, {
                routeKind: 'faster',
                routeId: proposal.id,
                contactIds: [contact.id],
                destination: 'Destino de teste',
                shareWheelchair,
              })
            ).data,
          );
          const token = new URL(trip.links[0]!.url).pathname.split('/').at(-1)!;
          const view = trackingResponseSchema.parse((await request(`/api/tracking/${token}`)).data);
          await request(`/api/trips/${trip.trip.id}/finish`, owner.token, {
            pin: '1234',
            outcome: 'arrived',
          });
          return view;
        };
        assert.equal((await trackedView(true, true)).wheelchairShared, true);
        const notShared = await trackedView(true, false);
        assert.equal(notShared.wheelchairShared, false);
        assert.doesNotMatch(JSON.stringify(notShared), /cadeira de rodas|"wheelchair":/);
        assert.equal((await trackedView(false, true)).wheelchairShared, false);
      });
    } finally {
      for (const account of accounts)
        await request('/api/auth/account', account.token, { pin: '1234' }, 'DELETE');
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await pool.end();
    }
  },
);
