import assert from 'node:assert/strict';
import test from 'node:test';
import { featureExplanation, limitMapFeatures, readableObservation } from './map-data';

test('SP156 preview reports source fields without presenting a historical case as current', () => {
  const feature = {
    properties: {
      type: 'sp156',
      details: { service: 'Conserto de calçada', subject: 'Piso danificado', status: 'Finalizada' },
    },
  };
  const text = featureExplanation(feature);
  assert.match(text, /Conserto de calçada/);
  assert.match(text, /Piso danificado/);
  assert.match(text, /Situação do protocolo: Finalizada/);
  assert.match(text, /Condição atual não verificada/);
});

test('historical floods and flood models do not claim a current flood', () => {
  for (const type of ['flood_history', 'flood_risk', 'flood_susceptibility']) {
    assert.match(featureExplanation({ properties: { type, details: {} } }), /não confirma/i);
  }
});

test('InfoSiga preview distinguishes notification from confirmed crash and preserves civil date', () => {
  const preview = (recordType) =>
    featureExplanation({ properties: { type: 'pedestrian_crashes', details: { recordType } } });
  assert.match(preview('NOTIFICACAO'), /não confirma o sinistro/i);
  assert.match(preview('SINISTRO FATAL'), /não identifica quem foi vítima fatal/i);
  assert.match(preview('SINISTRO NAO FATAL'), /não fatal/i);
  assert.match(preview('NOTIFICACAO'), /precisão desconhecida/i);
  assert.equal(readableObservation('2024-03-12T00:00:00.000Z', 'infosiga'), '12/03/2024');
});

test('map limit gives the SGB layer space even when SP156 is dense', () => {
  const features = [
    ...Array.from({ length: 1000 }, (_, id) => ({ id: `sp:${id}`, properties: { type: 'sp156' } })),
    ...Array.from({ length: 4 }, (_, id) => ({
      id: `sgb:${id}`,
      properties: { type: 'flood_susceptibility' },
    })),
    ...Array.from({ length: 4 }, (_, id) => ({
      id: `infosiga:${id}`,
      properties: { type: 'pedestrian_crashes' },
    })),
  ];
  const selected = limitMapFeatures(features, 500);
  assert.equal(selected.length, 500);
  assert.equal(
    selected.filter((feature) => feature.properties.type === 'flood_susceptibility').length,
    4,
  );
  assert.equal(
    selected.filter((feature) => feature.properties.type === 'pedestrian_crashes').length,
    4,
  );
  assert.equal(selected.filter((feature) => feature.properties.type === 'sp156').length, 492);
  assert.equal(new Set(selected.map((feature) => feature.id)).size, 500);
});
