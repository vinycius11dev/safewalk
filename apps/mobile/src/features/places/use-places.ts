import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedPlaceInput } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { placesService } from './places.service';

export function useSavedPlaces() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['saved-places', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => placesService.list(session?.token ?? '', signal),
  });
}
function usePlaceMutation<TInput>(mutationFn: (token: string, input: TInput) => Promise<unknown>) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => mutationFn(session?.token ?? '', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['saved-places'] }),
  });
}
export function useCreatePlace() {
  return usePlaceMutation((token, input: SavedPlaceInput) => placesService.create(token, input));
}
export function useUpdatePlace() {
  return usePlaceMutation((token, input: { id: string; place: SavedPlaceInput }) =>
    placesService.update(token, input.id, input.place),
  );
}
export function useDeletePlace() {
  return usePlaceMutation((token, id: string) => placesService.remove(token, id));
}
