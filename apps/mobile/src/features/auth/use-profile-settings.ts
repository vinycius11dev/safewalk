import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileSettingsInput } from '@safewalk/contracts';
import { useAuth } from './auth-provider';
import { authService } from './auth.service';

export function useProfileSettings() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['settings', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => authService.settings(session?.token ?? '', signal),
  });
}
export function useSaveProfileSettings() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileSettingsInput) =>
      authService.saveSettings(session?.token ?? '', input),
    onSuccess: async (data) => {
      client.setQueryData(['settings', session?.user.id], data);
      await client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
