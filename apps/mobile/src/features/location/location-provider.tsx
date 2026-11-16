import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { PositionInput } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { useMapConsent } from '@/features/maps/use-map-data';
import { useTrips } from '@/features/trips/use-trips';
import { tripsService } from '@/features/trips/trips.service';
import { stopBackgroundTrip } from './background-location';
import { ApiError } from '@/lib/api-client';
type GeoLocationValue = {
  position: PositionInput | null;
  courseDegrees: number | null;
  enabled: boolean;
  error: Error | null;
  transmissionError: Error | null;
  start: () => Promise<void>;
  stop: () => void;
};
const GeoLocationContext = createContext<GeoLocationValue | null>(null);
function SessionLocationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const consent = useMapConsent();
  const trips = useTrips();
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<PositionInput | null>(null);
  const [courseDegrees, setCourseDegrees] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transmissionError, setTransmissionError] = useState<Error | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const lastSent = useRef({ tripId: '', timestamp: 0 });
  const stop = useCallback(() => {
    generation.current++;
    subscription.current?.remove();
    subscription.current = null;
    const reset = () => {
      setEnabled(false);
      setPosition(null);
      setCourseDegrees(null);
      setTransmissionError(null);
    };
    void stopBackgroundTrip().then(reset, reset);
  }, []);
  const start = useCallback(async () => {
    if (!consent.data?.enabled)
      throw new Error(
        'Revise e autorize os serviços externos do mapa antes de usar a localização.',
      );
    const requestId = ++generation.current;
    setError(null);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          throw new Error('Para usar a localização no navegador do celular, abra o app por HTTPS.');
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          throw new Error('Localização indisponível. No celular, abra o aplicativo por HTTPS.');
        }
        subscription.current?.remove();
        const watchId = navigator.geolocation.watchPosition(
          (value) => {
            if (requestId !== generation.current) return;
            setError(null);
            setPosition({
              latitude: value.coords.latitude,
              longitude: value.coords.longitude,
              accuracyMeters: value.coords.accuracy,
              recordedAt: new Date(value.timestamp).toISOString(),
            });
            setCourseDegrees(
              value.coords.accuracy <= 35 &&
                value.coords.speed !== null &&
                value.coords.speed > 0.7 &&
                value.coords.heading !== null
                ? value.coords.heading
                : null,
            );
          },
          (failure) => {
            if (requestId !== generation.current) return;
            setError(
              new Error(
                failure.code === 1
                  ? 'Localização não autorizada. Confira as permissões do navegador e do aparelho.'
                  : 'Não foi possível obter a localização. Confira a localização do aparelho e tente novamente.',
              ),
            );
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
        subscription.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
        setEnabled(true);
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted')
        throw new Error('Localização não autorizada. Você pode escolher a origem no mapa.');
      if (requestId !== generation.current) return;
      subscription.current?.remove();
      const next = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 8000 },
        (value) => {
          if (requestId !== generation.current) return;
          setPosition({
            latitude: value.coords.latitude,
            longitude: value.coords.longitude,
            accuracyMeters: value.coords.accuracy ?? 10000,
            recordedAt: new Date(value.timestamp).toISOString(),
          });
          setCourseDegrees(
            (value.coords.accuracy ?? 10000) <= 35 &&
              (value.coords.speed ?? 0) > 0.7 &&
              value.coords.heading !== null
              ? value.coords.heading
              : null,
          );
        },
        (message) => {
          if (requestId === generation.current) setError(new Error(message));
        },
      );
      if (requestId !== generation.current) {
        next.remove();
        return;
      }
      subscription.current = next;
      setEnabled(true);
    } catch (failure) {
      const problem =
        failure instanceof Error ? failure : new Error('Não foi possível iniciar a localização.');
      if (requestId === generation.current) setError(problem);
      throw problem;
    }
  }, [consent.data?.enabled]);
  useEffect(() => {
    if (consent.data && !consent.data.enabled) stop();
  }, [consent.data, stop]);
  useEffect(
    () => () => {
      generation.current++;
      subscription.current?.remove();
      void stopBackgroundTrip().catch(() => {});
    },
    [],
  );
  const active = trips.data?.find(
    (trip) => trip.mode !== 'demo' && !['arrived', 'cancelled'].includes(trip.status),
  );
  const activeId = active?.id;
  const previousTrip = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousTrip.current && !activeId) stop();
    previousTrip.current = activeId;
  }, [activeId, stop]);
  useEffect(() => {
    if (!position || !enabled || !activeId || !session || position.accuracyMeters > 150) return;
    const timestamp = Date.parse(position.recordedAt);
    if (lastSent.current.tripId === activeId && timestamp - lastSent.current.timestamp < 7000)
      return;
    lastSent.current = { tripId: activeId, timestamp };
    let alive = true;
    void tripsService
      .position(session.token, activeId, position)
      .then(() => {
        if (alive) setTransmissionError(null);
      })
      .catch((failure) => {
        if (failure instanceof ApiError && [401, 403, 404, 409, 410].includes(failure.status)) {
          stop();
          void queryClient.invalidateQueries({ queryKey: ['map-consent'] });
          void queryClient.invalidateQueries({ queryKey: ['trips'] });
        }
        if (alive)
          setTransmissionError(
            failure instanceof Error ? failure : new Error('Não foi possível enviar a posição.'),
          );
      });
    return () => {
      alive = false;
    };
  }, [position, enabled, activeId, session, queryClient, stop]);
  return (
    <GeoLocationContext
      value={{ position, courseDegrees, enabled, error, transmissionError, start, stop }}
    >
      {children}
    </GeoLocationContext>
  );
}
export function LocationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return (
    <SessionLocationProvider key={session?.user.id ?? 'guest'}>{children}</SessionLocationProvider>
  );
}
export function useGeoLocation(): GeoLocationValue {
  const context = useContext(GeoLocationContext);
  if (!context) throw new Error('LocationProvider ausente.');
  return context;
}
