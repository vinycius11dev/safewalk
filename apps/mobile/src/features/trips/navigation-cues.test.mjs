import assert from 'node:assert/strict';
import test from 'node:test';
import { cumulativeDistances } from './route-guidance';
import {
  formatDistance,
  maneuverIcon,
  nextNavigationCue,
  projectRecords,
  recordsAhead,
  signalsAlongRoute,
  upcomingSignal,
} from './navigation-cues';

test('durante o trajeto o mapa mostra só o que está à frente', () => {
  const record = (id, latitude) => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-46.65, latitude] },
    properties: {},
  });
  const records = {
    type: 'FeatureCollection',
    // ~0 m, ~111 m, ~333 m desde a origem.
    features: [record('inicio', -23.56), record('meio', -23.559), record('fim', -23.557)],
  };
  const projection = projectRecords(points, cumulative, records);
  const ids = (collection) => collection.features.map((feature) => feature.id);
  // Sem GPS confiável não esconde nada.
  assert.deepEqual(ids(recordsAhead(records, projection, null)), ['inicio', 'meio', 'fim']);
  // A 200 m: o do início ficou para trás; o do meio (passou há ~90 m) também.
  assert.deepEqual(ids(recordsAhead(records, projection, 200)), ['fim']);
  // Logo depois de passar (até 30 m), o registro continua visível.
  assert.deepEqual(ids(recordsAhead(records, projection, 130)), ['meio', 'fim']);
  // O registro selecionado não some.
  assert.deepEqual(ids(recordsAhead(records, projection, 200, 'inicio')), ['inicio', 'fim']);
});

// Rota reta para o norte: cada 0,001° de latitude ≈ 111 m.
const points = [0, 1, 2, 3, 4].map((step) => ({
  latitude: -23.56 + step * 0.001,
  longitude: -46.65,
}));
const cumulative = cumulativeDistances(points);
const route = {
  points,
  instructions: [
    { text: 'Caminhe para o norte.', maneuver: 'depart', beginPointIndex: 0, endPointIndex: 2 },
    { text: 'Vire à direita.', maneuver: 'right', beginPointIndex: 2, endPointIndex: 4 },
    { text: 'Chegou ao destino.', maneuver: 'arrive', beginPointIndex: 4, endPointIndex: 4 },
  ],
};
const signal = (id, latitude, longitude = -46.65) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties: {
    title: id,
    type: 'crossings',
    category: 'crossing',
    sourceId: 'test',
    sourceFeatureId: id,
    observedAt: null,
    details: {},
  },
});

test('sem GPS mostra o início do roteiro sem inventar distância', () => {
  const cue = nextNavigationCue(route, cumulative, null, null);
  assert.equal(cue.instruction.maneuver, 'depart');
  assert.equal(cue.distanceMeters, null);
});

test('com GPS mostra a próxima manobra e a distância até ela', () => {
  const cue = nextNavigationCue(route, cumulative, 0, 100);
  assert.equal(cue.instruction.text, 'Vire à direita.');
  assert.ok(Math.abs(cue.distanceMeters - (cumulative[2] - 100)) < 0.001);
  const last = nextNavigationCue(route, cumulative, 2, cumulative[4] - 30);
  assert.equal(last.instruction.maneuver, 'arrive');
  assert.ok(Math.abs(last.distanceMeters - 30) < 0.001);
});

test('aviso de semáforo considera só os cadastrados junto à rota e à frente', () => {
  const signals = signalsAlongRoute(points, cumulative, [
    signal('longe-da-rota', -23.5585, -46.653),
    signal('adiante', -23.5585),
    signal('atras', -23.5595),
    {
      ...signal('outro-tipo', -23.5588),
      properties: { ...signal('x', 0).properties, type: 'sp156' },
    },
  ]);
  assert.deepEqual(
    signals.map((item) => item.id),
    ['atras', 'adiante'],
  );
  const ahead = upcomingSignal(signals, 100);
  assert.equal(ahead.id, 'adiante');
  assert.ok(ahead.distanceMeters > 50 && ahead.distanceMeters < 120);
  assert.equal(upcomingSignal(signals, null), null, 'sem GPS não há aviso');
  assert.equal(upcomingSignal(signals, 0)?.id, 'atras');
  assert.equal(upcomingSignal(signals, 300), null, 'nada além do último');
});

test('distâncias e setas legíveis', () => {
  assert.equal(formatDistance(123), '120 m');
  assert.equal(formatDistance(1234), '1,2 km');
  assert.equal(formatDistance(8), 'agora');
  assert.equal(maneuverIcon('left'), 'corner-up-left');
  assert.equal(maneuverIcon(undefined), 'navigation');
});
