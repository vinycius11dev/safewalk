import assert from 'node:assert/strict';
import test from 'node:test';
import { isCityWideView, urbanRequestBounds } from './urban-request-bounds';

test('vista de bairro segue como está', () => {
  const bbox = [-46.66, -23.57, -46.63, -23.54];
  assert.deepEqual(urbanRequestBounds(bbox), bbox);
  assert.equal(isCityWideView(bbox), false);
});

test('vista da cidade encaixa na grade de 0,05° e cabe no limite da API', () => {
  const result = urbanRequestBounds([-46.83, -23.79, -46.41, -23.41]);
  assert.deepEqual(result, [-46.85, -23.8, -46.4, -23.4]);
  assert.equal(isCityWideView(result), true);
  // Um pequeno arraste reaproveita a mesma área (mesma consulta em cache).
  assert.deepEqual(urbanRequestBounds([-46.832, -23.791, -46.412, -23.412]), result);
});

test('vista muito afastada é cortada em 1,2° em volta do centro e na região', () => {
  const [west, south, east, north] = urbanRequestBounds([-48, -24.6, -45.2, -22.6]);
  assert.ok(east - west <= 1.2 + 1e-9 && north - south <= 1.2 + 1e-9);
  assert.ok(west >= -47.3 && east <= -45.9 && south >= -24.2 && north <= -23.1);
});

test('fora da região de São Paulo não pede nada', () => {
  assert.equal(urbanRequestBounds([-43.3, -22.95, -43.1, -22.85]), null);
});
