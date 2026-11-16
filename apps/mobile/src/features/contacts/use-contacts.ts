import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContactInput } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { contactsService } from './contacts.service';
export function useContacts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['contacts', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => contactsService.list(session?.token ?? '', signal),
  });
}
export function useCreateContact() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ContactInput) => contactsService.create(session?.token ?? '', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
export function useDeleteContact() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) =>
      contactsService.remove(session?.token ?? '', id, pin),
    onSuccess: () => client.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
