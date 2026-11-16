import assert from 'node:assert/strict';
import test from 'node:test';
import type { RoutingRequest } from '@safewalk/contracts';
import type { RealRoute } from '@safewalk/contracts';
import { resolveRouteRequest, routeForContact } from './route-request.js';

const walking: RoutingRequest = {
  origin: { latitude: -23.56, longitude: -46.65 },
  destination: { latitude: -23.57, longitude: -46.66 },
  profile: 'pedestrian',
  preference: 'prefer_lit',
};

test('sem cadeira de rodas, vale o critério escolhido e o perfil da conta', () => {
  const { request, walkingProfile } = resolveRouteRequest(walking, 'child');
  assert.equal(request.preference, 'prefer_lit');
  assert.equal(walkingProfile, 'child');
});

test('com cadeira de rodas, evita escadas e usa ritmo calmo em qualquer conta', () => {
  const { request, walkingProfile } = resolveRouteRequest(
    { ...walking, wheelchair: true },
    'standard',
  );
  assert.equal(request.preference, 'step_free');
  assert.equal(request.wheelchair, true);
  assert.equal(walkingProfile, 'pcd');
});

test('o link do contato não recebe cadeira de rodas nem perfil da conta', () => {
  const shared = routeForContact({
    profile: 'pedestrian',
    wheelchair: true,
    walkingProfile: 'pcd',
    distanceMeters: 1000,
    description: 'Informado para este trajeto: pessoa em cadeira de rodas.',
  } as RealRoute);
  assert.equal('wheelchair' in shared, false);
  assert.equal('walkingProfile' in shared, false);
  assert.equal(shared.distanceMeters, 1000);
  assert.doesNotMatch(shared.description, /cadeira de rodas/);
});

test('de carro, cadeira de rodas e critérios a pé não mudam o cálculo', () => {
  const { request, walkingProfile } = resolveRouteRequest(
    { ...walking, profile: 'auto', wheelchair: true },
    'pcd',
  );
  assert.equal(request.preference, 'standard');
  assert.equal(request.wheelchair, undefined);
  assert.equal(walkingProfile, 'standard');
});
