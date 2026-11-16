import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  sessionResponseSchema,
  profileResponseSchema,
  profileSettingsSchema,
  contactResponseSchema,
  personalDataExportSchema,
  startedTripResponseSchema,
} from '@safewalk/contracts';
import { pool } from '../src/database/pool.js';
import type { RowDataPacket } from 'mysql2';
import { pruneExpiredHistory } from '../src/modules/auth/privacy.repository.js';

const origin = process.env.SAFEWALK_TEST_API_URL ?? 'http://127.0.0.1:4010';
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(origin).hostname))
  throw new Error('Teste permitido apenas no servidor local.');
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? ''))
  throw new Error('Banco de teste permitido apenas no servidor local.');
async function request(
  path: string,
  { token, method = 'GET', body }: { token?: string; method?: string; body?: unknown } = {},
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
    data: response.status === 204 ? undefined : ((await response.json()) as unknown),
  };
}
test(
  'Conta, contatos e privacidade: persistência, credenciais, isolamento e retenção',
  { timeout: 30000 },
  async (t) => {
    assert.equal(z.object({ demo: z.boolean() }).parse((await request('/health')).data).demo, true);
    const suffix = randomUUID();
    const password = `Synthet1c-${suffix}`;
    const email = `profile.${suffix}@safewalk.test`;
    const created = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Conta sintética de perfil', email: ` ${email.toUpperCase()} `, password },
    });
    assert.equal(created.status, 201);
    const session = sessionResponseSchema.parse(created.data);
    const token = session.token;
    let currentPin = '1234';
    let activeTripId: string | undefined;
    let deleted = false;
    try {
      assert.equal(
        (await request('/api/auth/pin', { token, method: 'PUT', body: { pin: currentPin } }))
          .status,
        204,
      );
      await t.test('editar perfil exige PIN e normaliza e-mail', async () => {
        const input = {
          name: 'Perfil corrigido',
          email: `updated.${suffix}@safewalk.test`,
          phone: '+5511900000099',
        };
        assert.equal(
          (
            await request('/api/auth/profile', {
              token,
              method: 'PUT',
              body: { ...input, currentPin: '0000' },
            })
          ).status,
          403,
        );
        const updated = await request('/api/auth/profile', {
          token,
          method: 'PUT',
          body: { ...input, currentPin },
        });
        assert.equal(updated.status, 200);
        assert.equal(profileResponseSchema.parse(updated.data).phone, input.phone);
        assert.equal(
          (
            await request('/api/auth/login', {
              method: 'POST',
              body: { email: input.email, password },
            })
          ).status,
          200,
        );
      });
      await t.test('prazo, perfil e privacidade persistem no servidor', async () => {
        const settings = profileSettingsSchema.parse(
          (await request('/api/auth/settings', { token })).data,
        );
        const desired = {
          ...settings,
          responseSeconds: 15,
          walkingProfile: 'pcd',
          automaticDetection: false,
          arrivalCheckin: false,
          retentionDays: 7,
          contributeReports: false,
        };
        const withoutPin = await request('/api/auth/settings', {
          token,
          method: 'PUT',
          body: desired,
        });
        assert.equal(withoutPin.status, 403, 'reduzir proteções exige PIN');
        assert.equal(withoutPin.data.error.code, 'PIN_REQUIRED_FOR_SETTINGS');
        assert.equal(
          (
            await request('/api/auth/settings', {
              token,
              method: 'PUT',
              body: { ...desired, currentPin: '1234' },
            })
          ).status,
          200,
        );
        assert.deepEqual(
          profileSettingsSchema.parse((await request('/api/auth/settings', { token })).data),
          desired,
        );
        assert.equal(
          (
            await request('/api/auth/settings', {
              token,
              method: 'PUT',
              body: { ...desired, responseSeconds: 1 },
            })
          ).status,
          400,
        );
      });
      await t.test('contato exige PIN e guarda o padrão de acompanhamento', async () => {
        const createdContact = await request('/api/contacts', {
          token,
          method: 'POST',
          body: { name: 'Contato sintético', phone: '+5511900000088', relationship: 'Teste' },
        });
        assert.equal(createdContact.status, 201);
        const contact = contactResponseSchema.parse(createdContact.data);
        const update = { ...contact, name: 'Nome corrigido', defaultAccompany: false };
        assert.equal(
          (
            await request(`/api/contacts/${contact.id}`, {
              token,
              method: 'PUT',
              body: { ...update, currentPin: '0000' },
            })
          ).status,
          403,
        );
        const result = await request(`/api/contacts/${contact.id}`, {
          token,
          method: 'PUT',
          body: { ...update, currentPin },
        });
        assert.equal(result.status, 200);
        assert.equal(contactResponseSchema.parse(result.data).defaultAccompany, false);
        assert.ok(!JSON.stringify(result.data).includes('currentPin'));
        assert.equal(
          (
            await request(`/api/contacts/${contact.id}`, {
              token,
              method: 'DELETE',
              body: { pin: '0000' },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(`/api/contacts/${contact.id}`, {
              token,
              method: 'DELETE',
              body: { pin: currentPin },
            })
          ).status,
          204,
        );
      });
      await t.test('troca de PIN exige o PIN anterior', async () => {
        assert.equal(
          (
            await request('/api/auth/pin/change', {
              token,
              method: 'PUT',
              body: { currentPin: '0000', newPin: '4321' },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request('/api/auth/pin/change', {
              token,
              method: 'PUT',
              body: { currentPin, newPin: '4321' },
            })
          ).status,
          204,
        );
        currentPin = '4321';
      });
      await t.test('retenção apaga apenas histórico terminal vencido do autor', async () => {
        const oldTrip = randomUUID();
        const newTrip = randomUUID();
        const oldReport = randomUUID();
        await pool.execute(
          "INSERT INTO trips (id,user_id,route_kind,destination,status,active_user_id,started_at,expected_arrival_at) VALUES (?,?,'safer','Registro sintético antigo','arrived',NULL,DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 20 DAY),DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 20 DAY)),(?,?,'safer','Registro sintético recente','arrived',NULL,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
          [oldTrip, session.user.id, newTrip, session.user.id],
        );
        await pool.execute(
          "INSERT INTO reports (id,user_id,type,description,address,latitude,longitude,status,created_at,expires_at) VALUES (?,?,'other','Relato sintético antigo','Endereço de teste',-23,-46,'resolved',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 20 DAY),DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 19 DAY))",
          [oldReport, session.user.id],
        );
        await pruneExpiredHistory(session.user.id);
        const [oldRows] = await pool.execute('SELECT id FROM trips WHERE id = ? AND user_id = ?', [
          oldTrip,
          session.user.id,
        ]);
        const [newRows] = await pool.execute('SELECT id FROM trips WHERE id = ? AND user_id = ?', [
          newTrip,
          session.user.id,
        ]);
        const [reports] = await pool.execute(
          'SELECT id FROM reports WHERE id = ? AND user_id = ?',
          [oldReport, session.user.id],
        );
        assert.deepEqual(oldRows, []);
        assert.ok(Array.isArray(newRows) && newRows.length === 1);
        assert.deepEqual(reports, []);
      });
      await t.test('exportação é do titular e não contém credenciais', async () => {
        const result = await request('/api/auth/export', { token });
        assert.equal(result.status, 200);
        const data = personalDataExportSchema.parse(result.data);
        assert.equal(data.profile.id, session.user.id);
        const serialized = JSON.stringify(data);
        for (const secret of ['password_hash', 'pin_hash', 'JWT_SECRET', 'token_hash', password])
          assert.ok(!serialized.includes(secret));
      });
      await t.test('exclusão com PIN errado preserva o trajeto ativo', async () => {
        const trip = startedTripResponseSchema.parse(
          (
            await request('/api/trips', {
              token,
              method: 'POST',
              body: { routeKind: 'safer', destination: 'Destino sintético', contactIds: [] },
            })
          ).data,
        );
        activeTripId = trip.trip.id;
        assert.equal(
          (await request('/api/auth/account', { token, method: 'DELETE', body: { pin: '0000' } }))
            .status,
          403,
        );
        const [active] = await pool.execute<RowDataPacket[]>(
          'SELECT status FROM trips WHERE id = ? AND user_id = ?',
          [activeTripId, session.user.id],
        );
        assert.equal(active[0]?.status, 'active');
      });
      await t.test(
        'exclusão desativa a sessão e encerra o acompanhamento imediatamente',
        async () => {
          assert.equal(
            (
              await request('/api/auth/account', {
                token,
                method: 'DELETE',
                body: { pin: currentPin },
              })
            ).status,
            204,
          );
          deleted = true;
          assert.equal((await request('/api/auth/me', { token })).status, 401);
          assert.equal((await request('/api/contacts', { token })).status, 401);
          const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT id, deletion_requested_at, purge_after FROM users WHERE id = ?',
            [session.user.id],
          );
          assert.equal(rows.length, 1);
          assert.ok(rows[0]?.deletion_requested_at);
          assert.ok(
            new Date(rows[0]?.purge_after as string).getTime() - Date.now() > 14 * 86400000,
          );
          const [trips] = await pool.execute<RowDataPacket[]>(
            'SELECT status, active_user_id FROM trips WHERE id = ? AND user_id = ?',
            [activeTripId, session.user.id],
          );
          assert.equal(trips[0]?.status, 'cancelled');
          assert.equal(trips[0]?.active_user_id, null);
        },
      );
      await t.test('processador apaga os dados somente após o prazo agendado', async () => {
        await pruneExpiredHistory(session.user.id);
        const [before] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [
          session.user.id,
        ]);
        assert.equal(before.length, 1);
        // Only this synthetic owner is backdated; no real account is eligible through the test.
        await pool.execute(
          'UPDATE users SET purge_after = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE id = ? AND deletion_requested_at IS NOT NULL',
          [session.user.id],
        );
        await pruneExpiredHistory(session.user.id);
        const [after] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [
          session.user.id,
        ]);
        assert.deepEqual(after, []);
      });
    } finally {
      if (activeTripId && !deleted)
        await request(`/api/trips/${activeTripId}/finish`, {
          token,
          method: 'POST',
          body: { pin: currentPin, outcome: 'cancelled' },
        });
      if (!deleted)
        await request('/api/auth/account', { token, method: 'DELETE', body: { pin: currentPin } });
      await pool.execute(
        'UPDATE users SET purge_after = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE id = ? AND deletion_requested_at IS NOT NULL',
        [session.user.id],
      );
      await pruneExpiredHistory(session.user.id);
      await pool.end();
    }
  },
);
