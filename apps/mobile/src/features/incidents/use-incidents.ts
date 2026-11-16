import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { incidentsService } from './incidents.service';
export function useIncidentFeedback(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['incident-feedback', session?.user.id, id];
  const query = useQuery({
    queryKey,
    enabled: Boolean(session && id),
    queryFn: ({ signal }) => incidentsService.feedback(session?.token ?? '', id, signal),
  });
  const mutation = useMutation({
    mutationFn: (choice: 'confirm' | 'resolved') =>
      incidentsService.respond(session?.token ?? '', id, choice),
    onSuccess: (data) => client.setQueryData(queryKey, data),
  });
  return { query, mutation };
}
