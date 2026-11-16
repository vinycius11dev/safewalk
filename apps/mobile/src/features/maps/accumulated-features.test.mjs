import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAccumulatedFeatures } from './accumulated-features';

const feature = (id, title = id) => ({ id, properties: { title } });

test('mantém registros já vistos e atualiza a versão de um id repetido', () => {
  const first = mergeAccumulatedFeatures(new Map(), [feature('a'), feature('b')]);
  const second = mergeAccumulatedFeatures(first, [feature('b', 'b novo'), feature('c')]);
  assert.deepEqual([...second.keys()], ['a', 'b', 'c']);
  assert.equal(second.get('b').properties.title, 'b novo');
  assert.equal(first.get('b').properties.title, 'b', 'não altera o mapa anterior');
});

test('acima do teto descarta os vistos há mais tempo', () => {
  const merged = mergeAccumulatedFeatures(
    mergeAccumulatedFeatures(new Map(), [feature('a'), feature('b'), feature('c')], 3),
    [feature('a'), feature('d')],
    3,
  );
  assert.deepEqual([...merged.keys()], ['c', 'a', 'd']);
});
