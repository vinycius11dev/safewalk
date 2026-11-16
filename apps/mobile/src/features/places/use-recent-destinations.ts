import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Coordinates } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { newRecentDestination } from './recent-destinations';
import {
  clearRecentDestinations,
  listRecentDestinations,
  removeRecentDestination,
  saveRecentDestination,
} from './recent-destinations-store';

const recentKey = (ownerId: string | undefined) => ['recent-destinations', ownerId] as const;

/** Destinos recentes guardados no banco local do aparelho; não dependem da internet. */
export function useRecentDestinations() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  return useQuery({
    queryKey: recentKey(ownerId),
    enabled: Boolean(ownerId),
    // Leitura local: sem novas tentativas nem espera pela rede.
    networkMode: 'always',
    retry: false,
    queryFn: () => listRecentDestinations(ownerId ?? ''),
  });
}

function useRecentMutation<TInput>(run: (ownerId: string, input: TInput) => Promise<void>) {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: TInput) => {
      if (ownerId) await run(ownerId, input);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: recentKey(ownerId) }),
  });
}

export function useRememberDestination() {
  return useRecentMutation((ownerId, input: { label: string; location: Coordinates }) =>
    saveRecentDestination(ownerId, newRecentDestination(input.label, input.location)),
  );
}
export function useForgetDestination() {
  return useRecentMutation((ownerId, key: string) => removeRecentDestination(ownerId, key));
}
export function useClearRecentDestinations() {
  return useRecentMutation((ownerId, _input: void) => clearRecentDestinations(ownerId));
}
