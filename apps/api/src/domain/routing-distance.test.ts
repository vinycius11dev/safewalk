import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routingRequestSchema } from '@safewalk/contracts';
import { requireRoutingDistance } from './routing-distance.js';
import { requireServiceArea } from './service-area.js';

test('Embu e rotas regionais acima de 25 km não são bloqueados pela área ou distância', () => {
  const destination = { latitude: -23.649, longitude: -46.852 };
  assert.doesNotThrow(() => requireServiceArea(destination.latitude, destination.longitude));
  assert.doesNotThrow(() =>
    requireRoutingDistance(
      routingRequestSchema.parse({
        origin: { latitude: -23.55, longitude: -46.5 },
        destination,
      }),
    ),
  );
});

test('pontos iguais têm erro próprio e trajetos longos distinguem carro de caminhada', () => {
  const origin = { latitude: -23.55, longitude: -46.65 };
  assert.throws(
    () => requireRoutingDistance(routingRequestSchema.parse({ origin, destination: origin })),
    { code: 'ROUTE_POINTS_TOO_CLOSE' },
  );
  const destination = { latitude: -23.55, longitude: -45.45 };
  assert.throws(() => requireRoutingDistance(routingRequestSchema.parse({ origin, destination })), {
    code: 'ROUTE_DISTANCE_UNSUPPORTED',
  });
  assert.doesNotThrow(() =>
    requireRoutingDistance(routingRequestSchema.parse({ origin, destination, profile: 'auto' })),
  );
});
