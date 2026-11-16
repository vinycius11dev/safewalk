import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueGeocodingPlaces } from './geocoding-results';

test('remove IDs repetidos sem descartar locais distintos com o mesmo nome', () => {
  const places = [
    { id: 'photon:N:1', name: 'Centro', category: 'arts_centre' },
    { id: 'photon:N:1', name: 'Centro', category: 'museum' },
    { id: 'photon:N:2', name: 'Centro', category: 'museum' },
  ];
  assert.deepEqual(uniqueGeocodingPlaces(places), [places[0], places[2]]);
  assert.equal(places.length, 3);
});
