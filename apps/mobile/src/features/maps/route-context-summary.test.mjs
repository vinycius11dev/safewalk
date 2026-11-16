import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultRoutePreference,
  routeContextText,
  summarizeRouteContext,
  walkingProfileRouteLabel,
  routeCriteriaText,
  routeModeName,
} from './route-context-summary';

const feature = (type) => ({ id: `${type}-${Math.random()}`, properties: { type } });
const routeWith = (features) => ({
  context: {
    method: 'cached_features_within_50m',
    bufferMeters: 50,
    nearbyFeatures: features,
    sources: [],
    coverageWarnings: [],
    checkedAt: '2026-10-28T20:00:00.000Z',
    truncated: features.length >= 100,
  },
});

test('conta registros por tipo e agrupa inundações e saúde', () => {
  const summary = summarizeRouteContext(
    routeWith([
      feature('lighting'),
      feature('lighting'),
      feature('crossings'),
      feature('sidewalks'),
      feature('flood_history'),
      feature('flood_risk'),
      feature('floods'),
      feature('sp156'),
      feature('health'),
      feature('accessibility'),
      feature('weather'),
    ]),
  );
  assert.equal(summary.lighting, 2);
  assert.equal(summary.crossings, 1);
  assert.equal(summary.sidewalks, 1);
  assert.equal(summary.flood, 3);
  assert.equal(summary.sp156, 1);
  assert.equal(summary.healthAccessibility, 2);
  assert.equal(summary.empty, false);
  assert.equal(summary.capped, false);
});

test('marca vazio sem contexto e 100+ no limite de registros', () => {
  assert.equal(summarizeRouteContext(null).empty, true);
  assert.equal(summarizeRouteContext({ context: undefined }).empty, true);
  assert.equal(summarizeRouteContext(routeWith([])).empty, true);
  const capped = summarizeRouteContext(
    routeWith(Array.from({ length: 100 }, () => feature('lighting'))),
  );
  assert.equal(capped.capped, true);
  assert.match(
    routeContextText(routeWith(Array.from({ length: 100 }, () => feature('lighting')))),
    /100\+/,
  );
});

test('texto é honesto no vazio e resume os registros próximos', () => {
  assert.equal(
    routeContextText(null),
    'Sem dados em cache para este trecho. Isso não indica ausência de risco.',
  );
  const text = routeContextText(
    routeWith([
      ...Array.from({ length: 12 }, () => feature('lighting')),
      ...Array.from({ length: 4 }, () => feature('crossings')),
      feature('flood_history'),
    ]),
  );
  assert.equal(
    text,
    'Na faixa de 50 m (dados em cache, parciais): 12 luminárias cadastradas · 4 semáforos · 1 área de inundação',
  );
});

test('perfil de caminhada escolhe a preferência de rota padrão', () => {
  assert.equal(defaultRoutePreference('night'), 'prefer_lit');
  assert.equal(defaultRoutePreference('pcd'), 'step_free');
  assert.equal(defaultRoutePreference('standard'), 'standard');
  assert.equal(defaultRoutePreference('child'), 'standard');
  assert.equal(defaultRoutePreference(undefined), 'standard');
});
test('a etiqueta da rota diz o que o perfil mudou no cálculo', () => {
  assert.equal(walkingProfileRouteLabel('pcd'), 'ritmo calmo');
  assert.equal(walkingProfileRouteLabel('child'), 'calçadas');
  // Rotas antigas (sem perfil), padrão e noite não ganham etiqueta extra.
  assert.equal(walkingProfileRouteLabel(undefined), null);
  assert.equal(walkingProfileRouteLabel('standard'), null);
  assert.equal(walkingProfileRouteLabel('night'), null);
});
test('o modo da rota não chama trajeto de carro ou cadeira de rodas de pedestre', () => {
  assert.equal(routeModeName({ profile: 'auto' }), 'Rota de carro');
  assert.equal(
    routeModeName({ profile: 'pedestrian', wheelchair: true }),
    'Rota para cadeira de rodas',
  );
  assert.equal(routeModeName({ profile: 'pedestrian' }), 'Rota de pedestres');
});
test('o resumo das opções mostra o critério do modo escolhido', () => {
  assert.equal(routeCriteriaText('auto', 'standard', 'standard'), 'Sem trânsito ao vivo');
  assert.equal(
    routeCriteriaText('wheelchair', 'step_free', 'pcd'),
    'Evita escadas e ladeiras · ritmo calmo',
  );
  assert.equal(
    routeCriteriaText('pedestrian', 'prefer_lit', 'pcd'),
    'Preferir iluminadas · ritmo calmo',
  );
});
