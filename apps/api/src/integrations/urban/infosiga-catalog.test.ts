import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptySource, selectUrbanDefinitions, urbanDefinitions } from './urban-catalog.js';

test('InfoSiga is opt-in and has an honest status before an import', () => {
  assert.equal(
    selectUrbanDefinitions().some((source) => source.id === 'infosiga'),
    false,
  );
  assert.deepEqual(
    selectUrbanDefinitions(['pedestrian_crashes']).map((source) => source.id),
    ['infosiga'],
  );
  const definition = urbanDefinitions.find((source) => source.id === 'infosiga');
  assert.ok(definition);
  assert.equal(emptySource(definition).status, 'not_configured');
  assert.match(definition.message, /precisão das coordenadas não informada/i);
});
