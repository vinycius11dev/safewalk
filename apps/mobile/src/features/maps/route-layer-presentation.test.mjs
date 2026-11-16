import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticRouteCategories,
  buildRoutePresentation,
  featureRouteCategory,
  isRouteNight,
} from './route-layer-presentation';
const feature = (id, type, status) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [-46.65, -23.55] },
  properties: {
    title: id,
    type,
    category: 'other',
    sourceId: 'test',
    sourceFeatureId: id,
    observedAt: null,
    details: status === undefined ? {} : { status },
  },
});
const context = { accessible: false, night: false, raining: false };
const input = [
  feature('signal', 'crossings'),
  feature('open', 'sp156', 'Em andamento'),
  feature('closed', 'sp156', 'FINALIZADA'),
  feature('unknown', 'sp156', 'Sem classificação'),
  feature('walk', 'sidewalks'),
  feature('light', 'lighting'),
  feature('flood', 'flood_susceptibility'),
];
test('automático preserva todos os dados e mostra semáforos e solicitações abertas', () => {
  const data = { features: [...input, input[0]] };
  const serialized = JSON.stringify(data);
  const result = buildRoutePresentation(data, undefined, { mode: 'auto', categories: [] }, context);
  assert.deepEqual(
    result.visible.map((f) => f.id),
    ['signal', 'open'],
  );
  assert.equal(result.features.length, 7);
  assert.equal(result.counts.history, 1);
  assert.equal(result.counts.unknown, 1);
  assert.equal(result.counts.signals, 1);
  assert.equal(result.records.features.length, 2);
  assert.equal(JSON.stringify(data), serialized);
});
test('serviços do SP156 ganham ícone próprio e protocolo finalizado só fica mais claro', () => {
  const sp = (id, service, status) => ({
    ...feature(id, 'sp156', status),
    properties: { ...feature(id, 'sp156', status).properties, details: { service, status } },
  });
  const cases = [
    ['Tapa-buraco', 'potholes'],
    ['Tapa-buraco em faixa exclusiva ou corredor de ônibus', 'potholes'],
    ['Árvore – Solicitar avaliação em calçadas e praças para fins de poda ou remoção', 'trees'],
    ['Solicitar limpeza de bueiros, boca de lobo e poços de visita', 'drains'],
    ['Acessibilidade - solicitar avaliação de obstáculo na calçada', 'obstacles'],
    ['Denunciar Fiação solta na calçada', 'obstacles'],
    ['Calçada pública - solicitar manutenção', 'brokenSidewalk'],
    ['Calçada particular - denunciar calçada danificada ou inexistente', 'brokenSidewalk'],
    ['Manutenção de placas de trânsito', 'reports'],
  ];
  for (const [service, expected] of cases)
    assert.equal(featureRouteCategory(sp('x', service, 'Em andamento')), expected, service);
  const closed = buildRoutePresentation(
    { features: [sp('c', 'Tapa-buraco', 'Finalizada'), sp('o', 'Tapa-buraco', 'Em andamento')] },
    undefined,
    { mode: 'auto', categories: [] },
    context,
  );
  assert.deepEqual(
    closed.records.features.map((f) => [
      f.properties.category,
      f.properties.icon,
      f.properties.closed,
    ]),
    [
      ['potholes', 'potholes', true],
      ['potholes', 'potholes', false],
    ],
  );
});
test('perfil, noite e chuva acrescentam categorias sem habilitar histórico geral', () => {
  const categories = automaticRouteCategories({ accessible: true, night: true, raining: true });
  assert.ok(
    categories.includes('sidewalks') &&
      categories.includes('signals') &&
      categories.includes('lighting') &&
      categories.includes('floods'),
  );
  assert.ok(!categories.includes('history') && !categories.includes('unknown'));
  assert.equal(isRouteNight(Date.parse('2026-11-03T21:00:00Z')), true);
  assert.equal(isRouteNight(Date.parse('2026-11-03T20:59:00Z')), false);
  assert.equal(isRouteNight(Date.parse('2026-11-03T09:00:00Z')), false);
  assert.equal(isRouteNight(Date.parse('2026-11-03T12:00:00Z'), 'night'), true);
});
test('personalizado respeita escolha manual e todos recupera registros recolhidos', () => {
  const custom = buildRoutePresentation(
    { features: input },
    undefined,
    { mode: 'custom', categories: ['history'] },
    { accessible: true, night: true, raining: true },
  );
  assert.deepEqual(
    custom.visible.map((f) => f.id),
    ['closed'],
  );
  const all = buildRoutePresentation(
    { features: input },
    undefined,
    { mode: 'all', categories: [] },
    context,
  );
  assert.equal(all.visible.length, 7);
  assert.equal(all.records.features.length, 7);
  assert.equal(featureRouteCategory(feature('x', 'sp156', 'Cancelada')), 'history');
  assert.equal(
    featureRouteCategory(feature('x', 'sp156', 'Status novo não reconhecido')),
    'unknown',
  );
});
test('polígono e referência contam uma vez e contorno só aparece ao selecionar', () => {
  const area = {
    ...feature('area', 'flood_susceptibility'),
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-47, -24],
          [-46, -24],
          [-46, -23],
          [-47, -23],
          [-47, -24],
        ],
      ],
    },
  };
  const route = { points: [{ latitude: -23.5, longitude: -46.5 }] };
  const result = buildRoutePresentation(
    { features: [area, area] },
    route,
    { mode: 'all', categories: [] },
    context,
  );
  assert.equal(result.features.length, 1);
  assert.equal(result.records.features.length, 1);
  assert.equal(result.outline.features.length, 0);
  const selected = buildRoutePresentation(
    { features: [area] },
    route,
    { mode: 'all', categories: [] },
    context,
    'area',
  );
  assert.equal(selected.outline.features[0].geometry, area.geometry);
  const nearby = buildRoutePresentation(
    { features: [area] },
    { points: [{ latitude: -22.99, longitude: -46.01 }] },
    { mode: 'all', categories: [] },
    context,
  );
  assert.equal(nearby.records.features.length, 1);
  assert.deepEqual(nearby.records.features[0].geometry.coordinates, [-46, -23]);
  assert.equal(nearby.outline.features.length, 0);
});
