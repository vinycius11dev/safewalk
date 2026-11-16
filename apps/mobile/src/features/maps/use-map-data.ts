import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Coordinates, RoutingRequest, UrbanLayerType } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError } from '@/lib/api-client';
import { mapsService, type MapBounds } from './maps.service';
export function useDebounced<T>(value: T, delayMs = 450): T {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setResult(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return result;
}
export function useMapConsent() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['map-consent', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => mapsService.consent(session?.token ?? '', signal),
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
export function useSetMapConsent() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => mapsService.setConsent(session?.token ?? '', enabled),
    onSuccess: (result) => {
      client.setQueryData(['map-consent', session?.user.id], result);
      return client.invalidateQueries({ queryKey: ['map-consent'] });
    },
  });
}
export function useUrbanLayers(bbox: MapBounds, types: UrbanLayerType[], enabled = true) {
  const { session } = useAuth();
  const consent = useMapConsent();
  const rounded: MapBounds = [
    Math.floor(bbox[0] * 1000) / 1000,
    Math.floor(bbox[1] * 1000) / 1000,
    Math.ceil(bbox[2] * 1000) / 1000,
    Math.ceil(bbox[3] * 1000) / 1000,
  ];
  return useQuery({
    queryKey: ['urban-layers', session?.user.id, ...rounded, [...types].sort().join(',')],
    enabled: Boolean(session && consent.data?.enabled && enabled && types.length),
    queryFn: ({ signal }) => mapsService.layers(session?.token ?? '', rounded, types, signal),
    staleTime: 120000,
    retry: false,
  });
}
export function useUrbanSources() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['urban-sources', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => mapsService.sources(session?.token ?? '', signal),
    staleTime: 60000,
    retry: false,
  });
}
export function useAddressSearch(text: string) {
  const { session } = useAuth();
  const consent = useMapConsent();
  const query = useDebounced(text.trim());
  return useQuery({
    queryKey: ['address-search', session?.user.id, query],
    enabled: Boolean(session && consent.data?.enabled && query.length >= 3),
    queryFn: ({ signal }) => mapsService.search(session?.token ?? '', query, signal),
    staleTime: 300000,
    retry: false,
  });
}
export function useReverseAddress(point: Coordinates | null) {
  const { session } = useAuth();
  const consent = useMapConsent();
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  return useQuery({
    queryKey: ['reverse-address', session?.user.id, latitude, longitude],
    enabled: Boolean(session && consent.data?.enabled && point),
    queryFn: ({ signal }) =>
      mapsService.reverse(
        session?.token ?? '',
        { latitude: latitude ?? 0, longitude: longitude ?? 0 },
        signal,
      ),
    staleTime: 300000,
    retry: false,
  });
}
export function useRealRoutes(input: RoutingRequest | null) {
  const { session } = useAuth();
  const consent = useMapConsent();
  return useQuery({
    queryKey: ['real-routes', session?.user.id, input],
    enabled: Boolean(session && consent.data?.enabled && input),
    queryFn: ({ signal }) => {
      if (!input) throw new Error('Escolha origem e destino.');
      return mapsService.routes(session?.token ?? '', input, signal);
    },
    staleTime: 300000,
    retry: false,
  });
}
export function useRouteUrbanContext(routeId: string | null, tripId?: string) {
  const { session } = useAuth();
  const consent = useMapConsent();
  return useQuery({
    queryKey: ['route-urban-context', session?.user.id, routeId, tripId],
    enabled: Boolean(session && consent.data?.enabled && routeId),
    queryFn: ({ signal }) =>
      mapsService.routeContext(session?.token ?? '', routeId!, tripId, signal),
    staleTime: 15000,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError &&
      ['ROUTE_PROPOSAL_EXPIRED', 'UNAUTHENTICATED', 'TRIP_NOT_FOUND'].includes(
        query.state.error.code,
      )
        ? false
        : query.state.data?.refreshing
          ? 10000
          : 120000,
    retry: false,
  });
}
