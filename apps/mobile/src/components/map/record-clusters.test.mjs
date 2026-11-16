import assert from 'node:assert/strict';
import test from 'node:test';
import { readRecordCluster, recordGroup } from './record-clusters';
test('grupo grande carrega todas as páginas sem perder registros coincidentes', async () => {
  const features = Array.from({ length: 350 }, (_, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { safewalkId: `id-${i}` },
  }));
  const offsets = [];
  const result = await readRecordCluster(
    {
      getClusterLeaves: async (_id, limit, offset) => {
        offsets.push(offset);
        return features.slice(offset, offset + limit);
      },
      getClusterExpansionZoom: async () => 19,
    },
    7,
    350,
  );
  assert.deepEqual(offsets, [0, 100, 200, 300]);
  assert.equal(result.ids.length, 350);
  assert.equal(result.zoom, 19);
});
test('grupo atualizado não abre uma lista incompleta e camadas de ícone não duplicam o registro', async () => {
  await assert.rejects(
    () =>
      readRecordCluster(
        { getClusterLeaves: async () => [], getClusterExpansionZoom: async () => 19 },
        1,
        3,
      ),
    /atualizado/,
  );
  const expand = () => {};
  const group = recordGroup(['one', 'one', 'two'], expand);
  assert.deepEqual(group.ids, ['one', 'two']);
  assert.equal(group.expand, expand);
});
