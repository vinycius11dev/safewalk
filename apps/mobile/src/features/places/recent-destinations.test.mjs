import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newRecentDestination,
  parseRecentDestinations,
  RECENT_DESTINATION_LIMIT,
  recentDestinationKey,
  withRecentDestination,
} from './recent-destinations';

const paulista = { latitude: -23.5614, longitude: -46.6559 };
const at = (minute) => new Date(Date.UTC(2026, 10, 16, 12, minute));

test('o mesmo ponto, a poucos metros, vira um único recente e sobe para o topo', () => {
  const first = newRecentDestination('Avenida Paulista, 1578', paulista, at(0));
  const other = newRecentDestination(
    'Rua Augusta, 900',
    { latitude: -23.55, longitude: -46.65 },
    at(1),
  );
  const again = newRecentDestination(
    'MASP',
    { latitude: paulista.latitude + 0.00002, longitude: paulista.longitude },
    at(2),
  );
  const list = withRecentDestination(
    withRecentDestination(withRecentDestination([], first), other),
    again,
  );
  assert.deepEqual(
    list.map((item) => item.label),
    ['MASP', 'Rua Augusta, 900'],
  );
  assert.equal(recentDestinationKey(paulista), list[0].key);
});

test('guarda só os mais recentes', () => {
  let list = [];
  for (let i = 0; i < RECENT_DESTINATION_LIMIT + 3; i++)
    list = withRecentDestination(
      list,
      newRecentDestination(`Destino ${i}`, { latitude: -23.5 - i / 100, longitude: -46.6 }, at(i)),
    );
  assert.equal(list.length, RECENT_DESTINATION_LIMIT);
  assert.equal(list[0].label, `Destino ${RECENT_DESTINATION_LIMIT + 2}`);
});

test('itens corrompidos no aparelho são descartados ao ler', () => {
  const valid = newRecentDestination('Avenida Paulista, 1578', paulista, at(0));
  const rows = [
    valid,
    { ...valid, key: 'x', location: { latitude: 200, longitude: 0 } },
    'lixo',
    null,
  ];
  assert.deepEqual(parseRecentDestinations(rows), [valid]);
});
