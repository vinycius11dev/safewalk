import type { Coordinates, SavedPlaceKind } from '@safewalk/contracts';

/** Mesmo teto aplicado pela API em `places.repository.ts`. */
export const FAVORITE_LIMIT = 6;

export const favoriteKindLabels: Record<SavedPlaceKind, string> = {
  home: 'Casa',
  work: 'Trabalho',
  other: 'Outro',
};

export const favoriteKindIcons: Record<SavedPlaceKind, 'home' | 'briefcase' | 'star'> = {
  home: 'home',
  work: 'briefcase',
  other: 'star',
};

type FavoriteLike = { kind: SavedPlaceKind; location: Coordinates };

/** Separa Casa e Trabalho (atalhos fixos, como no Waze) dos demais favoritos. */
export function favoriteShortcuts<T extends FavoriteLike>(places: readonly T[]) {
  return {
    home: places.find((place) => place.kind === 'home') ?? null,
    work: places.find((place) => place.kind === 'work') ?? null,
    others: places.filter((place) => place.kind === 'other'),
  };
}

/** Distância aproximada em metros entre dois pontos próximos (projeção equiretangular). */
function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * toRad * Math.cos(((a.latitude + b.latitude) / 2) * toRad);
  const y = (b.latitude - a.latitude) * toRad;
  return Math.hypot(x, y) * 6371000;
}

/** Favorito salvo no mesmo ponto de um resultado de busca, se houver. */
export function favoriteAt<T extends FavoriteLike>(
  places: readonly T[],
  location: Coordinates,
  toleranceMeters = 25,
): T | undefined {
  return places.find((place) => distanceMeters(place.location, location) <= toleranceMeters);
}

export function parseFavoriteKind(value: unknown): SavedPlaceKind | null {
  return value === 'home' || value === 'work' || value === 'other' ? value : null;
}

/** Nome e endereço dentro dos limites aceitos pelo contrato de locais salvos. */
export function favoriteInput(
  kind: SavedPlaceKind,
  name: string,
  address: string,
  location: Coordinates,
  keepLabel?: string,
) {
  const fallbackName = name.trim().length >= 2 ? name.trim() : 'Favorito';
  const label = kind === 'other' ? (keepLabel ?? fallbackName) : favoriteKindLabels[kind];
  const fullAddress = address.trim() || name.trim();
  return {
    kind,
    label: label.slice(0, 60),
    address: fullAddress.length >= 3 ? fullAddress.slice(0, 300) : 'Endereço não identificado',
    location,
  };
}
