import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Coordinates, RealRoute, UrbanLayerType } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { FIAP_LOCATION } from './maps.service';
export type JourneyDraft = {
  profile: RealRoute['profile'];
  /** The traveler said this trip includes a person in a wheelchair (walking only). */
  wheelchair: boolean;
  /** Chosen again for each trip: contacts see the wheelchair only when this is true. */
  shareWheelchair: boolean;
  originConfirmed: boolean;
  origin: Coordinates;
  originLabel: string;
  destination: Coordinates | null;
  destinationLabel: string;
  selectedRoute: RealRoute | null;
};
const initialJourney = (): JourneyDraft => ({
  profile: 'pedestrian',
  wheelchair: false,
  shareWheelchair: false,
  originConfirmed: false,
  origin: FIAP_LOCATION,
  originLabel: 'FIAP Paulista · origem escolhida',
  destination: null,
  destinationLabel: '',
  selectedRoute: null,
});
export function useMapJourney() {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['map-journey', session?.user.id];
  const { data } = useQuery({
    queryKey,
    queryFn: async () => initialJourney(),
    initialData: initialJourney,
    enabled: false,
    gcTime: Infinity,
  });
  return {
    journey: data,
    update: (patch: Partial<JourneyDraft>) =>
      client.setQueryData<JourneyDraft>(queryKey, (previous) => ({
        ...(previous ?? initialJourney()),
        ...(patch.origin ? { originConfirmed: true } : {}),
        ...patch,
      })),
  };
}
/** Delegacias e hospitais por perto, semáforos, solicitações e o resumo de alagamentos do CGE. */
const DEFAULT_MAP_LAYERS: UrbanLayerType[] = ['police', 'health', 'crossings', 'sp156', 'floods'];
export function useMapLayers() {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['map-layer-selection', session?.user.id];
  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<UrbanLayerType[]> => DEFAULT_MAP_LAYERS,
    initialData: (): UrbanLayerType[] => DEFAULT_MAP_LAYERS,
    enabled: false,
    gcTime: Infinity,
  });
  return {
    layers: data,
    toggle: (type: UrbanLayerType) =>
      client.setQueryData<UrbanLayerType[]>(queryKey, (previous) =>
        (previous ?? []).includes(type)
          ? (previous ?? []).filter((item) => item !== type)
          : [...(previous ?? []), type],
      ),
    /** Turns a group of layers on or off together (e.g. every flood layer). */
    setGroup: (types: readonly UrbanLayerType[], on: boolean) =>
      client.setQueryData<UrbanLayerType[]>(queryKey, (previous) => {
        const others = (previous ?? []).filter((item) => !types.includes(item));
        return on ? [...others, ...types] : others;
      }),
  };
}
