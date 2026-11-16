import assert from 'node:assert/strict';
import test from 'node:test';
import { rainAlert, routeRainAlert } from './rain-alert';

const feature = (id, type, longitude, latitude, title = id) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties: {
    title,
    type,
    category: 'flood',
    sourceId: 'test',
    sourceFeatureId: id,
    observedAt: null,
    details: {},
  },
});
const history = feature('h1', 'flood_history', -46.65, -23.55, 'Alagamento · Av. Exemplo');
const farHistory = feature('h2', 'flood_history', -46.9, -23.8, 'Alagamento · Longe');
const area = feature('a1', 'flood_risk', -46.651, -23.551);
const other = feature('x', 'crossings', -46.65, -23.55);

test('só avisa quando o modelo indica chuva', () => {
  for (const status of ['dry', 'stale', 'unknown'])
    assert.equal(rainAlert(status, [history], [history], null), null, status);
  assert.ok(rainAlert('raining', [history], [history], null));
});

test('conta onde já alagou e áreas que podem alagar, ignorando outros registros', () => {
  const result = rainAlert('raining', [history, farHistory, area, other], [], null);
  assert.equal(result.historyCount, 2);
  assert.equal(result.areaCount, 1);
  assert.match(result.message, /2 pontos onde já alagou e 1 área que pode alagar/);
  assert.match(result.message, /Não confirma água na via agora/);
  assert.equal(result.nearest, null);
  assert.match(
    rainAlert('raining', [history], [], null, true).message,
    /^Pelo menos 1 ponto onde já alagou nesta/,
  );
  const many = Array.from({ length: 300 }, (_, i) => feature(`r${i}`, 'flood_risk', -46.6, -23.5));
  const capped = rainAlert('raining', many, [], null, true);
  assert.match(capped.message, /^Mais de 100 áreas que podem alagar/);
  assert.doesNotMatch(capped.message, /300/);
});

test('sem registros conhecidos o aviso não promete que a via esteja livre', () => {
  const result = rainAlert('raining', [other], [], null);
  assert.equal(result.historyCount + result.areaCount, 0);
  assert.match(result.message, /não garante/);
});

test('aponta o ponto mais próximo de quem está na área, até 5 km', () => {
  const here = { longitude: -46.6502, latitude: -23.5501 };
  const result = rainAlert('raining', [], [farHistory, history], here);
  assert.match(result.nearest, /Av\. Exemplo/);
  assert.match(result.nearest, /em linha reta/);
  assert.doesNotMatch(result.nearest, /Longe/);
  assert.equal(rainAlert('raining', [], [farHistory], here).nearest, null);
});

test('alerta da rota usa as contagens da avaliação e só fala de chuva quando chove', () => {
  const near = {
    activeIncidentCount: 0,
    impassableIncidentCount: 0,
    historicalAreaCount: 2,
    modeledAreaCount: 5,
  };
  assert.equal(routeRainAlert('dry', near), null);
  const result = routeRainAlert('raining', near);
  assert.match(
    result.message,
    /^2 pontos onde já alagou e 5 áreas que podem alagar perto do trajeto/,
  );
  assert.match(result.message, /Não confirma água na via agora/);
  const none = routeRainAlert('raining', { ...near, historicalAreaCount: 0, modeledAreaCount: 0 });
  assert.match(none.message, /não garante/);
  const blocked = routeRainAlert('raining', {
    ...near,
    activeIncidentCount: 1,
    impassableIncidentCount: 1,
  });
  assert.match(blocked.title, /alagamento informado/);
  assert.match(blocked.message, /^1 ocorrência atual/);
  assert.ok(routeRainAlert('raining', undefined));
});
