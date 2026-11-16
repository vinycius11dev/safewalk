import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraImageRequest } from './camera-request.js';

const at = (time: string) => new Date(`2026-11-07T${time}:00.000Z`);

test('pedido às câmeras cobre 10 min antes e 15 min depois do alerta', () => {
  const request = cameraImageRequest(at('22:40'), {
    startedAt: at('22:00'),
    hasLastPosition: true,
    hasRoute: true,
  });
  assert.equal(request.windowStart, at('22:30').toISOString());
  assert.equal(request.windowEnd, at('22:55').toISOString());
  assert.equal(request.basis, 'last_position');
  assert.equal(request.simulated, true);
});

test('a janela não começa antes do trajeto e a referência cai para a rota ou nada', () => {
  const justStarted = cameraImageRequest(at('22:03'), {
    startedAt: at('22:00'),
    hasLastPosition: false,
    hasRoute: true,
  });
  assert.equal(justStarted.windowStart, at('22:00').toISOString());
  assert.equal(justStarted.basis, 'route');
  const timerWithoutGps = cameraImageRequest(at('22:30'), {
    startedAt: at('22:00'),
    hasLastPosition: false,
    hasRoute: false,
  });
  assert.equal(timerWithoutGps.basis, 'none');
});
