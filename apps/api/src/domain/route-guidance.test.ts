import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolConnection } from 'mysql2/promise';
import {
  RouteGuidanceTracker,
  matchRoutePosition,
} from '../../../mobile/src/features/trips/route-guidance.js';
import { mapConsentVersion, type PositionInput, type RealRoute } from '@safewalk/contracts';
import {
  calculateAndCommitReroute,
  chooseRerouteOption,
  createRerouteRequest,
  rerouteAttemptCooldownMs,
  rerouteBlockReason,
  rerouteSuccessCooldownMs,
} from './reroute-policy.js';
import { commitRerouteInTransaction } from '../modules/trips/trips-write.repository.js';

const route = {
  points: [
    { latitude: -23.55, longitude: -46.64 },
    { latitude: -23.55, longitude: -46.63 },
    { latitude: -23.54, longitude: -46.63 },
  ],
  profile: 'pedestrian',
} as RealRoute;

function gps(
  latitude: number,
  longitude: number,
  seconds: number,
  accuracyMeters = 8,
): PositionInput {
  return {
    latitude,
    longitude,
    accuracyMeters,
    recordedAt: new Date(1_800_000_000_000 + seconds * 1000).toISOString(),
  };
}

function realRoute(id: string, profile: 'pedestrian' | 'auto' = 'pedestrian'): RealRoute {
  const computedAt = '2026-11-04T12:00:00.000Z';
  return {
    id,
    kind: 'faster',
    profile,
    provider: 'valhalla',
    origin: { latitude: -23.55, longitude: -46.64 },
    destination: { latitude: -23.54, longitude: -46.63 },
    destinationLabel: 'Destino preservado',
    durationSeconds: 600,
    durationMinutes: 10,
    distanceMeters: 1000,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-46.64, -23.55],
        [-46.63, -23.54],
      ],
    },
    points: [
      { latitude: -23.55, longitude: -46.64 },
      { latitude: -23.54, longitude: -46.63 },
    ],
    instructions: [
      {
        text: 'Continue',
        distanceMeters: 1000,
        durationSeconds: 600,
        beginPointIndex: 0,
        endPointIndex: 1,
      },
    ],
    preference: 'standard',
    riskLabel: 'desconhecido',
    description: 'Rota real de teste.',
    simulated: false,
    assessment: { safety: 'not_assessed', accessibility: 'not_assessed' },
    provenance: {
      source: 'OpenStreetMap',
      sourceUrl: 'https://www.openstreetmap.org/',
      attribution: '© OpenStreetMap contributors',
      computedAt,
      expiresAt: '2026-11-04T12:15:00.000Z',
      communityService: false,
    },
  };
}

test('projects a GPS fix onto the line between route vertices', () => {
  const midpoint = { latitude: -23.55, longitude: -46.635 };
  const match = matchRoutePosition(route.points, midpoint);
  assert.ok(match);
  assert.equal(match.segmentIndex, 0);
  assert.ok(match.distanceMeters < 0.5);
  assert.ok(match.alongRouteMeters > 500);
});

test('does not report deviation from one noisy but accurate fix', () => {
  const tracker = new RouteGuidanceTracker(route);
  tracker.update(gps(-23.552, -46.64, 0), 1_800_000_000_000);
  tracker.update(gps(-23.552, -46.64, 8), 1_800_000_008_000);
  assert.equal(tracker.getSnapshot().offRoute, false);
});

test('requires three spaced reliable fixes spanning twelve seconds before recalculation', () => {
  const tracker = new RouteGuidanceTracker(route);
  tracker.update(gps(-23.552, -46.64, 0), 1_800_000_000_000);
  assert.equal(tracker.getSnapshot().offRoute, false);
  tracker.update(gps(-23.552, -46.64, 6), 1_800_000_006_000);
  assert.equal(tracker.getSnapshot().offRoute, false);
  tracker.update(gps(-23.552, -46.64, 13), 1_800_000_013_000);
  assert.equal(tracker.getSnapshot().offRoute, true);
});

test('uses profile-specific outer thresholds before declaring a deviation', () => {
  const pedestrian = new RouteGuidanceTracker(route);
  const auto = new RouteGuidanceTracker({ ...route, profile: 'auto' });
  for (const seconds of [0, 6, 13]) {
    const position = gps(-23.5507, -46.638, seconds);
    const now = 1_800_000_000_000 + seconds * 1000;
    pedestrian.update(position, now);
    auto.update(position, now);
  }
  assert.equal(pedestrian.getSnapshot().offRoute, true);
  assert.equal(auto.getSnapshot().offRoute, false);
});

test('ignores inaccurate and stale GPS fixes for deviation confirmation', () => {
  const tracker = new RouteGuidanceTracker(route);
  tracker.update(gps(-23.552, -46.64, 0, 50), 1_800_000_000_000);
  tracker.update(gps(-23.552, -46.64, 8, 8), 1_800_000_008_000);
  tracker.update(gps(-23.552, -46.64, 16, 8), 1_800_000_100_000);
  assert.equal(tracker.getSnapshot().offRoute, false);
});

test('requires GPS accuracy up to 45 m and a fix no older than twenty seconds', () => {
  const tracker = new RouteGuidanceTracker(route);
  tracker.update(gps(-23.55, -46.64, 0), 1_800_000_000_000);
  assert.equal(tracker.getSnapshot().reliableFix, true);
  tracker.update(gps(-23.55, -46.64, 8, 46), 1_800_000_008_000);
  assert.equal(tracker.getSnapshot().reliableFix, false);
  tracker.update(gps(-23.55, -46.64, 16), 1_800_000_040_000);
  assert.equal(tracker.getSnapshot().reliableFix, false);
});

test('keeps progress monotonic and clears deviation only after two inner-threshold fixes', () => {
  const tracker = new RouteGuidanceTracker(route);
  tracker.update(gps(-23.55, -46.638, 0), 1_800_000_000_000);
  const laterProgress = tracker.getSnapshot().progressMeters;
  tracker.update(gps(-23.55, -46.64, 8), 1_800_000_008_000);
  assert.ok(tracker.getSnapshot().progressMeters >= laterProgress);
  tracker.update(gps(-23.552, -46.64, 16), 1_800_000_016_000);
  tracker.update(gps(-23.552, -46.64, 22), 1_800_000_022_000);
  tracker.update(gps(-23.552, -46.64, 29), 1_800_000_029_000);
  assert.equal(tracker.getSnapshot().offRoute, true);
  tracker.update(gps(-23.55, -46.64, 37), 1_800_000_037_000);
  assert.equal(tracker.getSnapshot().offRoute, true);
  tracker.update(gps(-23.55, -46.64, 44), 1_800_000_044_000);
  assert.equal(tracker.getSnapshot().offRoute, false);
});

test('enforces persistent in-flight, failed-attempt, and successful-reroute cooldowns', () => {
  const now = 1_800_000_000_000;
  assert.equal(
    rerouteBlockReason(
      { lockUntil: new Date(now + 20_000), attemptedAt: null, reroutedAt: null },
      now,
    ),
    'in_progress',
  );
  assert.equal(
    rerouteBlockReason(
      { lockUntil: null, attemptedAt: new Date(now - 5_000), reroutedAt: null },
      now,
    ),
    'attempt_cooldown',
  );
  assert.equal(
    rerouteBlockReason(
      { lockUntil: null, attemptedAt: null, reroutedAt: new Date(now - 5_000) },
      now,
    ),
    'success_cooldown',
  );
  assert.equal(
    rerouteBlockReason(
      {
        lockUntil: null,
        attemptedAt: new Date(now - rerouteAttemptCooldownMs),
        reroutedAt: new Date(now - rerouteSuccessCooldownMs),
      },
      now,
    ),
    null,
  );
});

test('recalculation uses the saved destination, profile, and walking preference', () => {
  const savedRoute = realRoute('00000000-0000-4000-8000-000000000021');
  savedRoute.preference = 'step_free';
  assert.equal(
    createRerouteRequest({ ...savedRoute, wheelchair: true }, gps(-23.56, -46.65, 1)).wheelchair,
    true,
  );
  const request = createRerouteRequest(savedRoute, gps(-23.56, -46.65, 1));
  assert.deepEqual(request, {
    origin: { latitude: -23.56, longitude: -46.65 },
    destination: savedRoute.destination,
    destinationLabel: savedRoute.destinationLabel,
    profile: 'pedestrian',
    preference: 'step_free',
  });
});

test('chooses a provider-marked lower-flood-exposure option when available', () => {
  const defaultRoute = realRoute('00000000-0000-4000-8000-000000000031');
  const preferredRoute = {
    ...realRoute('00000000-0000-4000-8000-000000000032'),
    context: { floodAssessment: { preferredAlternative: true } },
  } as unknown as RealRoute;
  assert.equal(chooseRerouteOption([defaultRoute, preferredRoute])?.id, preferredRoute.id);
});

test('commits the new route snapshot and ETA while keeping contacts and share links intact', async () => {
  const oldRoute = realRoute('00000000-0000-4000-8000-000000000001');
  const newRoute = realRoute('00000000-0000-4000-8000-000000000002');
  const contactIds = ['00000000-0000-4000-8000-000000000003'];
  const shareTokens = ['existing-share-token-hash'];
  const events: { type: string; payload: unknown }[] = [];
  const row = {
    id: '00000000-0000-4000-8000-000000000004',
    user_id: '00000000-0000-4000-8000-000000000005',
    mode: 'route',
    route_kind: 'safer',
    destination: 'Destino preservado',
    status: 'active',
    started_at: new Date('2026-11-04T11:00:00.000Z'),
    expected_arrival_at: new Date('2026-11-04T12:00:00.000Z'),
    alert_deadline: null,
    escalation_deadline: null,
    alert_reason: null,
    feedback: null,
    last_position: null,
    last_position_received_at: null,
    route_snapshot: JSON.stringify(oldRoute),
    reroute_attempted_at: new Date(),
    reroute_lock_until: new Date(Date.now() + 90_000),
    reroute_lock_token: 'reroute-lock-token',
    rerouted_at: null,
    duress_at: null,
    duress_disguised: false,
  };
  const queries: string[] = [];
  const db = {
    execute: async (sql: string, values: unknown[] = []) => {
      queries.push(sql);
      if (sql.startsWith('SELECT * FROM trips')) return [[{ ...row }], []];
      if (sql.startsWith('SELECT UTC_TIMESTAMP')) return [[{ now: new Date() }], []];
      if (sql.startsWith('SELECT contact_id FROM trip_contacts'))
        return [contactIds.map((contact_id) => ({ contact_id })), []];
      if (sql.startsWith('SELECT enabled, consent_version FROM map_consents'))
        return [[{ enabled: true, consent_version: mapConsentVersion }], []];
      if (sql.startsWith('UPDATE trips SET route_snapshot')) {
        row.route_snapshot = String(values[0]);
        row.expected_arrival_at = values[1] as Date;
        row.rerouted_at = values[2] as Date;
        row.reroute_lock_until = null;
        row.reroute_lock_token = null;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('INSERT INTO trip_events')) {
        events.push({ type: String(values[1]), payload: JSON.parse(String(values[2])) });
        return [{ affectedRows: 1 }, []];
      }
      // No alert in this trip: no camera request or contact e-mail to read back.
      if (sql.startsWith('SELECT payload FROM trip_events')) return [[], []];
      if (sql.includes('FROM contact_alert_messages')) return [[], []];
      throw new Error(`Unexpected query in reroute test: ${sql}`);
    },
  } as unknown as PoolConnection;

  const trip = await commitRerouteInTransaction(
    db,
    row.user_id,
    row.id,
    'reroute-lock-token',
    oldRoute.id,
    newRoute,
  );

  assert.equal(trip.route?.id, newRoute.id);
  assert.deepEqual(trip.contactIds, contactIds);
  assert.deepEqual(shareTokens, ['existing-share-token-hash']);
  assert.ok(Date.parse(trip.expectedArrivalAt) > Date.now() + 590_000);
  assert.equal(events[0]?.type, 'trip_rerouted');
  assert.ok(!queries.some((sql) => /trip_contacts|share_tokens/.test(sql) && /^UPDATE/.test(sql)));
});

test('rejects an incompatible route before writing, leaving the active snapshot unchanged', async () => {
  const oldRoute = realRoute('00000000-0000-4000-8000-000000000011');
  const incompatible = realRoute('00000000-0000-4000-8000-000000000012', 'auto');
  const row = {
    id: '00000000-0000-4000-8000-000000000014',
    user_id: '00000000-0000-4000-8000-000000000015',
    mode: 'route',
    route_kind: 'safer',
    destination: 'Destino preservado',
    status: 'active',
    started_at: new Date('2026-11-04T11:00:00.000Z'),
    expected_arrival_at: new Date('2026-11-04T12:00:00.000Z'),
    alert_deadline: null,
    escalation_deadline: null,
    alert_reason: null,
    feedback: null,
    last_position: null,
    last_position_received_at: null,
    route_snapshot: JSON.stringify(oldRoute),
    reroute_attempted_at: null,
    reroute_lock_until: new Date(Date.now() + 90_000),
    reroute_lock_token: 'reroute-lock-token-2',
    rerouted_at: null,
    duress_at: null,
    duress_disguised: false,
  };
  let updateCount = 0;
  const db = {
    execute: async (sql: string) => {
      if (sql.startsWith('SELECT * FROM trips')) return [[{ ...row }], []];
      if (sql.startsWith('SELECT UTC_TIMESTAMP')) return [[{ now: new Date() }], []];
      if (sql.startsWith('UPDATE trips')) updateCount++;
      throw new Error(`Unexpected query in failing reroute test: ${sql}`);
    },
  } as unknown as PoolConnection;

  await assert.rejects(
    commitRerouteInTransaction(
      db,
      row.user_id,
      row.id,
      'reroute-lock-token-2',
      oldRoute.id,
      incompatible,
    ),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'INVALID_REROUTE',
  );
  assert.equal(JSON.parse(String(row.route_snapshot)).id, oldRoute.id);
  assert.equal(updateCount, 0);
});

test('keeps the current route when the routing provider fails and releases the reservation', async () => {
  const current = realRoute('00000000-0000-4000-8000-000000000041');
  const reservation = {
    lockToken: 'reroute-lock-token-3',
    route: current,
    position: gps(-23.552, -46.64, 10),
  };
  let persistedRouteId = current.id;
  let committed = false;
  let released = false;

  await assert.rejects(
    calculateAndCommitReroute(reservation, current.id, {
      calculate: async () => {
        throw new Error('routing provider unavailable');
      },
      commit: async (_lockToken, _expectedRouteId, route) => {
        persistedRouteId = route.id;
        committed = true;
        return route.id;
      },
      release: async () => {
        released = true;
      },
      onNoRoute: () => new Error('no route'),
    }),
    /routing provider unavailable/,
  );

  assert.equal(persistedRouteId, current.id);
  assert.equal(committed, false);
  assert.equal(released, true);
});
