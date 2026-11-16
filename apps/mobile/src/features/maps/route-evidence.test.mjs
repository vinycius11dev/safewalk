import assert from 'node:assert/strict';
import test from 'node:test';
import { routeEvidence } from './route-evidence';

const route = (features = [], overrides = {}) => ({
  profile: 'pedestrian',
  preference: 'standard',
  context: { nearbyFeatures: features, sources: [], checkedAt: '2026-11-03T12:00:00Z' },
  ...overrides,
});
const feature = (type, details = {}) => ({ properties: { type, details } });
test('sem dados não conclui que a rota seja segura ou acessível', () => {
  const result = routeEvidence(route());
  assert.equal(result.attention, false);
  assert.match(result.summary, /Faltam dados/);
  assert.match(result.safety[0], /Sem dados suficientes/);
  assert.match(result.accessibility[0], /Sem dados suficientes/);
});
test('histórico, chamados e iluminação não viram evidência de condição atual', () => {
  const result = routeEvidence(
    route([feature('flood_history'), feature('sp156'), feature('lighting')]),
  );
  assert.equal(result.attention, true);
  assert.match(result.safety.join(' '), /não comprovam alagamento ativo/);
  assert.match(result.safety.join(' '), /não confirma que o problema continue/);
  assert.match(result.safety.join(' '), /Não confirma luz acesa/);
});
test('dimensões cadastrais são apresentadas sem certificar acesso contínuo', () => {
  const result = routeEvidence(
    route(
      [
        feature('sidewalks', { minimumWidthMeters: 0.8, maximumInclinePercent: 12 }),
        feature('sidewalks', { minimumWidthMeters: 1.2, maximumInclinePercent: 3 }),
      ],
      { preference: 'step_free' },
    ),
  );
  assert.match(result.accessibility.join(' '), /0,8 m/);
  assert.match(result.accessibility.join(' '), /12%/);
  assert.match(result.accessibility.join(' '), /não comprova piso regular/);
  assert.match(result.accessibility.join(' '), /solicitado evitar escadas/);
});
test('o perfil idoso ou PCD explica o ritmo usado no tempo estimado', () => {
  const result = routeEvidence(route([], { walkingProfile: 'pcd' }));
  assert.match(result.accessibility.join(' '), /ritmo calmo \(3,6 km\/h\)/);
  assert.match(result.accessibility[0], /Sem dados suficientes/);
  assert.doesNotMatch(routeEvidence(route()).accessibility.join(' '), /ritmo calmo/);
});
test('carro e dados vencidos mantêm limitações específicas', () => {
  const result = routeEvidence(
    route([], { profile: 'auto', context: { nearbyFeatures: [], sources: [{ status: 'stale' }] } }),
  );
  assert.equal(result.stale, true);
  assert.match(result.accessibility[0], /estacionamento/);
});
