import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveMapLayers, floodLayersOn } from './flood-layers';

test('chuva liga onde já alagou e as áreas que podem alagar', () => {
  const layers = effectiveMapLayers(['crossings'], true);
  assert.deepEqual(layers, ['crossings', 'flood_history', 'flood_risk']);
  assert.equal(floodLayersOn(layers), true);
});

test('sem chuva, vale a escolha da pessoa', () => {
  assert.deepEqual(effectiveMapLayers(['crossings', 'sp156'], false), ['crossings', 'sp156']);
  assert.equal(floodLayersOn(['crossings']), false);
});

test('a chuva nunca liga sozinha a camada do SGB (exige escolha em Camadas do mapa)', () => {
  assert.equal(effectiveMapLayers([], true).includes('flood_susceptibility'), false);
  assert.equal(floodLayersOn(['flood_susceptibility']), true);
});
