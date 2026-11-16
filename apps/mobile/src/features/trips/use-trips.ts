import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PositionInput,
  RouteKind,
  Trip,
  TripStartEmailNotification,
} from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { tripsService } from './trips.service';
export function useTrips() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['trips', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => tripsService.list(session?.token ?? '', signal),
  });
}
export function useTrip(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['trip', id],
    enabled: Boolean(session && id),
    queryFn: ({ signal }) => tripsService.get(session?.token ?? '', id, signal),
    refetchInterval: 5000,
  });
}
export function useStartTrip() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      routeKind: RouteKind;
      contactIds: string[];
      destination: string;
      routeId?: string;
      timerMinutes?: number;
      adultAccompanying?: boolean;
    }) => tripsService.start(session?.token ?? '', input),
    onSuccess: async ({ trip, emailNotifications }) => {
      client.setQueryData(['trip', trip.id], trip);
      client.setQueryData(['trip-start-email-notifications', trip.id], emailNotifications);
      await client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
export function useTripStartEmailNotifications(id: string): TripStartEmailNotification[] {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['trip-start-email-notifications', id],
    queryFn: async () =>
      client.getQueryData<TripStartEmailNotification[]>(['trip-start-email-notifications', id]) ??
      [],
    enabled: false,
    initialData: () =>
      client.getQueryData<TripStartEmailNotification[]>(['trip-start-email-notifications', id]) ??
      [],
  });
  return query.data;
}
export function useUpdatePosition(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PositionInput) => tripsService.position(session?.token ?? '', id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['trip', id] }),
  });
}
export function useRerouteTrip(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (expectedRouteId: string) =>
      tripsService.reroute(session?.token ?? '', id, expectedRouteId),
    onSuccess: async (trip) => {
      client.setQueryData(['trip', id], trip);
      await client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
export function usePausePositionSharing(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => tripsService.pauseSharing(session?.token ?? '', id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['trip', id] }),
  });
}
export function useRevokeShareLink(id: string) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: (contactId: string) =>
      tripsService.revokeShare(session?.token ?? '', id, contactId),
  });
}
export function useRequestAlert(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: 'manual' | 'stopped' | 'late' | 'deviation') =>
      tripsService.alert(session?.token ?? '', id, reason),
    onSuccess: (trip) => client.setQueryData(['trip', id], trip),
  });
}
export function useCancelAlert(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) => tripsService.cancelAlert(session?.token ?? '', id, pin),
    onSuccess: (trip) => client.setQueryData(['trip', id], trip),
  });
}
export function useFinishTrip(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { pin: string; outcome: 'arrived' | 'cancelled' }) =>
      tripsService.finish(session?.token ?? '', id, input.pin, input.outcome),
    onSuccess: async (trip) => {
      client.setQueryData(['trip', id], trip);
      await client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
export function useTripFeedback(id: string) {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (feeling: NonNullable<Trip['feedback']>) =>
      tripsService.feedback(session?.token ?? '', id, feeling),
    onSuccess: async (trip) => {
      client.setQueryData(['trip', id], trip);
      await client.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
