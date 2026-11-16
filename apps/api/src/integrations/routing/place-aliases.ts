import type { GeocodingPlace } from '@safewalk/contracts';

// FIAP identifies its Paulista campus as Av. Paulista, 1106:
// https://www.fiap.com.br/institucional/ . Coordinates still come from Photon/OSM.
export function searchAlias(
  query: string,
): { providerQuery: string; kind: 'fiap-paulista' } | null {
  const normalized = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return normalized === 'fiap paulista'
    ? { providerQuery: 'Avenida Paulista 1106', kind: 'fiap-paulista' }
    : null;
}

export function resolveSearchAlias(
  places: GeocodingPlace[],
  kind: 'fiap-paulista',
): GeocodingPlace[] {
  if (kind !== 'fiap-paulista') return [];
  const match = places.find((place) => /avenida paulista\s*,\s*1106\b/i.test(place.address));
  if (!match) return [];
  return [
    {
      ...match,
      name: 'FIAP Paulista',
      address: 'Av. Paulista, 1106 · Cerqueira César · São Paulo · Ponto aproximado',
      attribution: `${match.attribution} · Endereço institucional: FIAP (fiap.com.br/institucional/)`,
    },
  ];
}
