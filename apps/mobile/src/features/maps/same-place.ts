import type { Coordinates } from '@safewalk/contracts';
import { straightDistanceMeters } from './nearby-places';

/**
 * Origin and destination closer than this are "the same place": there is no walk to plan
 * (the routing API also refuses trips under 20 m). Covers GPS error and building entrances.
 */
export const SAME_PLACE_METERS = 60;

export function isSamePlace(a: Coordinates | null | undefined, b: Coordinates | null | undefined) {
  return Boolean(a && b && straightDistanceMeters(a, b) < SAME_PLACE_METERS);
}

export const SAME_PLACE_MESSAGE =
  'Você já está nesse lugar. Escolha outro destino ou altere de onde vai sair.';
