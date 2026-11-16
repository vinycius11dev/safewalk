import type { SavedPlaceInput } from '@safewalk/contracts';
import { requireServiceArea } from '../../domain/service-area.js';
import * as repository from './places.repository.js';
import type { SavedPlace } from './places.repository.js';

export const listPlaces = (userId: string): Promise<SavedPlace[]> => repository.listPlaces(userId);
export function createPlace(userId: string, input: SavedPlaceInput): Promise<SavedPlace> {
  requireServiceArea(input.location.latitude, input.location.longitude);
  return repository.createPlace(userId, input);
}
export function updatePlace(
  userId: string,
  id: string,
  input: SavedPlaceInput,
): Promise<SavedPlace> {
  requireServiceArea(input.location.latitude, input.location.longitude);
  return repository.updatePlace(userId, id, input);
}
export const deletePlace = (userId: string, id: string): Promise<void> =>
  repository.deletePlace(userId, id);
