import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  urbanLayersResponseSchema,
  urbanSourcesResponseSchema,
  sessionResponseSchema,
  mapConsentVersion,
} from '@safewalk/contracts';
import { app } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import {
  saveCachedSnapshot,
  recordProviderFailure,
  findCachedSnapshot,
  getImportedSp156,
} from '../src/modules/urban-data/urban.repository.js';
import { getUrbanLayers, getCachedUrbanContext } from '../src/modules/urban-data/urban.service.js';
import { urbanDefinitions, emptySource } from '../src/integrations/urban/urban-catalog.js';
import type { UrbanBounds } from '../src/integrations/urban/urban-bounds.js';

if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? ''))
  throw new Error('Teste permitido apenas no banco local.');
after(async () => {
  await pool.end();
});

test('Cache MariaDB é idempotente e preserva última leitura válida quando provedor falha', async () => {
  const key = `test:${randomUUID()}`;
  const source = urbanDefinitions.find((definition) => definition.id === 'geosampa-lighting');
  assert.ok(source);
  const bbox: UrbanBounds = [-46.805, -23.805, -46.8, -23.8];
  const now = new Date();
  const payload = {
    features: [],
    source: {
      ...emptySource(source),
      status: 'available',
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    },
    truncated: false,
    weather: null,
    floodSummary: null,
  };
  try {
    await saveCachedSnapshot({ key, sourceId: source.id, bbox, payload, ttlSeconds: 60 });
    await saveCachedSnapshot({ key, sourceId: source.id, bbox, payload, ttlSeconds: 60 });
    assert.deepEqual((await findCachedSnapshot(key))?.payload, payload);
    await recordProviderFailure(key, source.id, bbox);
    const stale = await findCachedSnapshot(key);
    assert.equal(stale?.failed, true);
    assert.deepEqual(stale?.payload, payload);
    const context = urbanLayersResponseSchema.parse(await getCachedUrbanContext(bbox));
    assert.equal(context.sources.find((item) => item.id === source.id)?.status, 'stale');
    assert.equal(context.truncated, true);
  } finally {
    await pool.execute('DELETE FROM urban_provider_cache WHERE cache_key = ?', [key]);
  }
});

test('Falha sem histórico não se apresenta como área sem ocorrências e recebe cache negativo', async () => {
  const bbox: UrbanBounds = [-46.81, -23.81, -46.805, -23.805];
  const key = `geosampa-lighting:${bbox.join(',')}`;
  assert.equal(await findCachedSnapshot(key), null, 'Use área sintética livre no cache local.');
  try {
    await recordProviderFailure(key, 'geosampa-lighting', bbox);
    const response = urbanLayersResponseSchema.parse(
      await getUrbanLayers({ bbox, types: ['lighting'] }),
    );
    assert.equal(response.sources[0]?.status, 'unavailable');
    assert.equal(response.features.length, 0);
    assert.ok(response.coverageWarnings.some((warning) => warning.includes('indisponível')));
  } finally {
    await pool.execute('DELETE FROM urban_provider_cache WHERE cache_key = ?', [key]);
  }
});

test('contexto de rota rejeita InfoSiga mesmo se houver snapshot em cache', async () => {
  const definition = urbanDefinitions.find((source) => source.id === 'infosiga');
  assert.ok(definition);
  const key = `test:infosiga:${randomUUID()}`;
  const bbox: UrbanBounds = [-46.81, -23.81, -46.805, -23.805];
  const now = new Date();
  const feature = {
    type: 'Feature',
    id: 'infosiga:synthetic',
    geometry: { type: 'Point', coordinates: [-46.808, -23.808] },
    properties: {
      title: 'Notificação histórica',
      type: 'pedestrian_crashes',
      category: 'other',
      sourceId: 'infosiga',
      sourceFeatureId: 'synthetic',
      observedAt: '2024-03-12T00:00:00.000Z',
      details: { coordinatePrecision: 'unknown' },
    },
  };
  const payload = {
    features: [feature],
    source: {
      ...emptySource(definition),
      status: 'available',
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    },
    truncated: false,
    weather: null,
    floodSummary: null,
  };
  try {
    await saveCachedSnapshot({ key, sourceId: 'infosiga', bbox, payload, ttlSeconds: 60 });
    const context = urbanLayersResponseSchema.parse(await getCachedUrbanContext(bbox));
    assert.equal(
      context.features.some((item) => item.id === feature.id),
      false,
    );
    assert.equal(
      context.sources.some((item) => item.id === 'infosiga'),
      false,
    );
  } finally {
    await pool.execute('DELETE FROM urban_provider_cache WHERE cache_key = ?', [key]);
  }
});

test('Leitura SP156 aceita JSON materializado pelo driver MariaDB e mantém geometria original', async (t) => {
  const result = await getImportedSp156([-46.665, -23.575, -46.635, -23.545]);
  if (!result) {
    t.skip('Importar CSV público SP156 primeiro para validar readback do lote real.');
    return;
  }
  assert.ok(result.features.length > 0);
  assert.ok(result.features.every((feature) => feature.geometry.type === 'Point'));
  assert.ok(
    result.features.every((feature) => feature.properties.details.originalCoordinate === true),
  );
  assert.ok(
    result.features.every((feature) => feature.properties.details.repaired === 'not_verified'),
  );
});

test('HTTP exige login, valida bbox e serve proveniência/GeoJSON SP156 sem consultar provedor externo', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const email = `urban.${randomUUID()}@safewalk.test`;
  let userId: string | undefined;
  try {
    assert.equal((await fetch(`${origin}/api/urban/sources`)).status, 401);
    const registration = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Teste sintético dados urbanos',
        email,
        password: `Synthet1c-${randomUUID()}`,
      }),
    });
    assert.equal(registration.status, 201);
    const session = sessionResponseSchema.parse(await registration.json());
    userId = session.user.id;
    const headers = { Authorization: `Bearer ${session.token}` };
    const sources = await fetch(`${origin}/api/urban/sources`, { headers });
    assert.equal(sources.status, 200);
    const provenance = urbanSourcesResponseSchema.parse(await sources.json());
    assert.equal(provenance.sources.length, urbanDefinitions.length);
    assert.ok(provenance.sources.some((source) => source.id === 'sgb-flood-susceptibility'));
    assert.ok(provenance.sources.some((source) => source.id === 'infosiga'));
    assert.ok(provenance.sources.every((source) => source.confidence === 'not_assessed'));
    assert.equal((await fetch(`${origin}/api/urban/layers?types=sp156`, { headers })).status, 403);
    const consent = await fetch(`${origin}/api/maps/consent`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, version: mapConsentVersion }),
    });
    assert.equal(consent.status, 200);
    const invalid = await fetch(`${origin}/api/urban/layers?bbox=1,2,3,4`, { headers });
    assert.equal(invalid.status, 400);
    const layers = await fetch(
      `${origin}/api/urban/layers?bbox=-46.665,-23.575,-46.635,-23.545&types=sp156`,
      { headers },
    );
    assert.equal(layers.status, 200);
    const collection = urbanLayersResponseSchema.parse(await layers.json());
    assert.equal(collection.sources[0]?.id, 'sp156');
    assert.ok(
      collection.features.every(
        (feature) =>
          feature.geometry.type === 'Point' &&
          feature.properties.details.repaired === 'not_verified',
      ),
    );
    const historic = await fetch(
      `${origin}/api/urban/layers?bbox=-46.665,-23.575,-46.635,-23.545&types=pedestrian_crashes`,
      { headers },
    );
    assert.equal(historic.status, 200);
    const historicData = urbanLayersResponseSchema.parse(await historic.json());
    assert.equal(historicData.sources[0]?.id, 'infosiga');
    assert.ok(
      ['available', 'stale', 'not_configured'].includes(historicData.sources[0]?.status ?? ''),
    );
    assert.ok(
      historicData.features.every(
        (feature) =>
          feature.properties.type === 'pedestrian_crashes' &&
          feature.properties.details.coordinatePrecision === 'unknown',
      ),
    );
  } finally {
    if (userId) await pool.execute('DELETE FROM users WHERE id = ? AND email = ?', [userId, email]);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
