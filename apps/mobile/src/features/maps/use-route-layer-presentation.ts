import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealRoute, UrbanLayersResponse } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { routeRain } from './route-map-conditions';
import {
  buildRoutePresentation,
  isRouteNight,
  type RouteCategory,
  type RouteLayerSelection,
} from './route-layer-presentation';
const initial = (): RouteLayerSelection => ({ mode: 'auto', categories: [] });
export function useRouteLayerPresentation(
  route: RealRoute | undefined,
  data: UrbanLayersResponse | undefined,
  now: number,
  selectedId?: string | null,
) {
  const { session } = useAuth();
  const client = useQueryClient();
  const profile = useProfileSettings();
  const queryKey = ['route-layer-view', session?.user.id];
  const { data: selection } = useQuery({
    queryKey,
    queryFn: async () => initial(),
    initialData: initial,
    enabled: false,
    gcTime: Infinity,
  });
  const accessible = route?.preference === 'step_free' || profile.data?.walkingProfile === 'pcd';
  const night = isRouteNight(now, profile.data?.walkingProfile);
  const raining = routeRain(data, now) === 'raining';
  const presentation = useMemo(
    () =>
      buildRoutePresentation(data, route, selection, { accessible, night, raining }, selectedId),
    [data, route, selection, accessible, night, raining, selectedId],
  );
  return {
    ...presentation,
    selection,
    accessible,
    night,
    raining,
    setMode: (mode: RouteLayerSelection['mode']) =>
      client.setQueryData<RouteLayerSelection>(queryKey, {
        mode,
        categories: presentation.enabled,
      }),
    toggle: (category: RouteCategory) =>
      client.setQueryData<RouteLayerSelection>(queryKey, {
        mode: 'custom',
        categories: presentation.enabled.includes(category)
          ? presentation.enabled.filter((c) => c !== category)
          : [...presentation.enabled, category],
      }),
  };
}
