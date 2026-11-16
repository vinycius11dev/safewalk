import { router } from 'expo-router';
import type { Trip } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts } from '@/features/contacts/use-contacts';
import { useStartTrip, useTrips } from '@/features/trips/use-trips';

export const isWalkActive = (trip: Trip): boolean =>
  !['arrived', 'cancelled'].includes(trip.status);

const openWalk = (id: string) => router.push({ pathname: '/trajeto/[id]', params: { id } });

/** Reaproveita a caminhada em andamento ou inicia uma fictícia na conta de demonstração. */
export function useDemoWalk() {
  const { session } = useAuth();
  const trips = useTrips();
  const contacts = useContacts();
  const startTrip = useStartTrip();
  const activeId = trips.data?.find(isWalkActive)?.id;
  const loadError = trips.error ?? contacts.error;
  return {
    activeId,
    canStart: Boolean(session?.user.demo),
    loading: trips.isLoading || contacts.isLoading || startTrip.isPending,
    loadFailed: Boolean(loadError),
    error: loadError ?? startTrip.error,
    retry: () => {
      void trips.refetch();
      void contacts.refetch();
    },
    open: () => {
      if (activeId) {
        openWalk(activeId);
        return;
      }
      startTrip.mutate(
        {
          routeKind: 'safer',
          destination: 'R. Frei Caneca (demonstração)',
          contactIds: (contacts.data ?? [])
            .filter((contact) => contact.accepted)
            .map((contact) => contact.id),
        },
        { onSuccess: ({ trip }) => openWalk(trip.id) },
      );
    },
  };
}
