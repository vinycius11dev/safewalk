import assert from 'node:assert/strict';
import test from 'node:test';
import { favoriteAt, favoriteInput, favoriteShortcuts, parseFavoriteKind } from './favorite-places';

const place = (id, kind, latitude, longitude) => ({ id, kind, location: { latitude, longitude } });

test('separa Casa e Trabalho dos demais favoritos', () => {
  const shortcuts = favoriteShortcuts([
    place('a', 'other', -23.56, -46.65),
    place('b', 'work', -23.55, -46.64),
    place('c', 'home', -23.57, -46.66),
  ]);
  assert.equal(shortcuts.home?.id, 'c');
  assert.equal(shortcuts.work?.id, 'b');
  assert.deepEqual(
    shortcuts.others.map((item) => item.id),
    ['a'],
  );
  assert.equal(favoriteShortcuts([]).home, null);
});

test('reconhece um resultado salvo no mesmo ponto, mas não a uma quadra de distância', () => {
  const saved = [place('a', 'other', -23.5614, -46.6559)];
  assert.equal(favoriteAt(saved, { latitude: -23.56141, longitude: -46.65592 })?.id, 'a');
  assert.equal(favoriteAt(saved, { latitude: -23.5625, longitude: -46.6559 }), undefined);
});

test('Casa e Trabalho usam o nome do tipo; outros mantêm o nome do lugar', () => {
  const point = { latitude: -23.56, longitude: -46.65 };
  assert.equal(favoriteInput('home', 'Rua A', 'Rua A, 10', point).label, 'Casa');
  assert.equal(favoriteInput('other', 'Academia', 'Rua B, 20', point).label, 'Academia');
  assert.equal(favoriteInput('other', 'Rua B', 'Rua B, 20', point, 'Mãe').label, 'Mãe');
  assert.equal(favoriteInput('other', 'X', '', point).address, 'Endereço não identificado');
  assert.equal(favoriteInput('other', 'x'.repeat(80), 'Rua', point).label.length, 60);
});

test('aceita somente tipos de favorito conhecidos', () => {
  assert.equal(parseFavoriteKind('home'), 'home');
  assert.equal(parseFavoriteKind('casa'), null);
  assert.equal(parseFavoriteKind(undefined), null);
});
