import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMERA_SIMULATION_NOTE, cameraRequestText, cameraSimulationSteps } from './camera-request';

const request = (basis) => ({
  requestedAt: '2026-11-08T01:40:00.000Z',
  windowStart: '2026-11-08T01:30:00.000Z',
  windowEnd: '2026-11-08T01:55:00.000Z',
  radiusMeters: 150,
  basis,
  simulated: true,
});

test('o pedido diz raio, referência e horário de São Paulo', () => {
  assert.equal(
    cameraRequestText(request('last_position')),
    'Imagens das câmeras num raio de 150 m da última posição registrada, das 22:30 às 22:55.',
  );
  assert.match(cameraRequestText(request('route')), /do trajeto planejado/);
});

test('as etapas simuladas avançam pelo tempo desde o pedido e se dizem simulação', () => {
  const requestedAt = Date.parse('2026-11-08T01:40:00.000Z');
  const done = (ms) =>
    cameraSimulationSteps(request('last_position'), requestedAt + ms).map((step) => step.done);
  assert.deepEqual(done(0), [true, false, false]);
  assert.deepEqual(done(20_000), [true, true, false]);
  assert.deepEqual(done(60_000), [true, true, true]);
  const [, received, answered] = cameraSimulationSteps(
    request('last_position'),
    requestedAt + 60_000,
  );
  assert.match(received.title, /simulação/);
  assert.match(answered.detail, /Nenhuma imagem foi recebida/);
});

test('sem local, a última etapa não diz que houve busca nas câmeras', () => {
  const answered = cameraSimulationSteps(
    request('none'),
    Date.parse('2026-11-08T02:00:00.000Z'),
  )[2];
  assert.equal(answered.title, 'Sem local para buscar câmeras');
});

test('sem posição nem trajeto, não finge que há câmeras localizadas', () => {
  assert.match(cameraRequestText(request('none')), /sem posição ou trajeto/);
  assert.match(CAMERA_SIMULATION_NOTE, /nenhuma câmera real foi acionada/);
});
