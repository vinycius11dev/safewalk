import { durationLabel } from '@/lib/duration';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { RoutingRequest } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { useContacts } from '@/features/contacts/use-contacts';
import { useGeoLocation } from '@/features/location/location-provider';
import { useMapConsent, useRealRoutes } from '@/features/maps/use-map-data';
import { useMapJourney } from '@/features/maps/use-map-journey';
import { FIAP_LOCATION } from '@/features/maps/maps.service';
import {
  defaultRoutePreference,
  routeContextText,
  routePreferenceLabel,
} from '@/features/maps/route-context-summary';
import { useSavedPlaces } from '@/features/places/use-places';
import { useStartTrip, useTrips } from '@/features/trips/use-trips';
import { useAdultCompanion } from '@/features/trips/use-adult-companion';
import { AdultCompanionCheck } from '@/features/trips/adult-companion-check';
import { useClock } from '@/hooks/use-clock';
import { ApiError } from '@/lib/api-client';
import { createQuickStartStyles } from './quick-start-screen.styles';

export function QuickStartScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => createQuickStartStyles(colors), [colors]);
  const { session } = useAuth();
  const consent = useMapConsent();
  const geo = useGeoLocation();
  const places = useSavedPlaces();
  const contacts = useContacts();
  const trips = useTrips();
  const settings = useProfileSettings();
  const start = useStartTrip();
  const adult = useAdultCompanion();
  const { journey, update } = useMapJourney();
  const now = useClock(5000);
  const place = places.data?.find((item) => item.id === placeId) ?? null;
  const gpsRefresh = useRef(false);
  const qualifyingPosition =
    consent.data?.enabled &&
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const untouchedInitialOrigin =
    journey.originLabel === 'FIAP Paulista · origem escolhida' &&
    journey.origin.latitude === FIAP_LOCATION.latitude &&
    journey.origin.longitude === FIAP_LOCATION.longitude;
  const originIsGps = journey.originLabel.startsWith('Sua localização atual');
  const origin = untouchedInitialOrigin ? null : journey.origin;
  const originLabel = untouchedInitialOrigin ? '' : journey.originLabel;
  useEffect(() => {
    if (!qualifyingPosition) return;
    if (originIsGps && !gpsRefresh.current) return;
    gpsRefresh.current = false;
    update({
      origin: {
        latitude: qualifyingPosition.latitude,
        longitude: qualifyingPosition.longitude,
      },
      originLabel: `Sua localização atual · precisão ${Math.round(qualifyingPosition.accuracyMeters)} m`,
    });
  }, [qualifyingPosition, originIsGps, update]);
  function captureCurrentPosition() {
    gpsRefresh.current = true;
    void geo.start().catch(() => {});
    if (qualifyingPosition) {
      gpsRefresh.current = false;
      update({
        origin: {
          latitude: qualifyingPosition.latitude,
          longitude: qualifyingPosition.longitude,
        },
        originLabel: `Sua localização atual · precisão ${Math.round(qualifyingPosition.accuracyMeters)} m`,
      });
    }
  }
  const preference = defaultRoutePreference(settings.data?.walkingProfile);
  const input: RoutingRequest | null =
    origin && place
      ? {
          origin,
          destination: place.location,
          destinationLabel: place.label,
          profile: 'pedestrian',
          preference,
        }
      : null;
  const routes = useRealRoutes(input);
  const route = routes.data?.options[0] ?? null;
  const accepted = contacts.data?.filter((contact) => contact.accepted) ?? [];
  const [selected, setSelected] = useState<string[] | null>(null);
  const [soloConfirmed, setSoloConfirmed] = useState(false);
  const contactIds = selected ?? accepted.filter((c) => c.defaultAccompany).map((c) => c.id);
  const activeTrip = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  const expired = Boolean(
    (route && Date.parse(route.provenance.expiresAt) <= now) ||
    (start.error instanceof ApiError && start.error.code === 'ROUTE_PROPOSAL_EXPIRED'),
  );
  useEffect(() => {
    if (!origin || !place) return;
    const unchanged =
      journey.destination?.latitude === place.location.latitude &&
      journey.destination?.longitude === place.location.longitude &&
      journey.destinationLabel === place.label;
    if (unchanged) return;
    update({
      destination: place.location,
      destinationLabel: place.label,
      selectedRoute: null,
    });
  }, [origin, place, journey, update]);
  function toggleContact(id: string) {
    setSelected(
      (contactIds.includes(id)
        ? contactIds.filter((item) => item !== id)
        : [...contactIds, id]
      ).filter((item) => accepted.some((contact) => contact.id === item)),
    );
  }
  function begin() {
    if (activeTrip) {
      router.push({ pathname: '/trajeto/[id]', params: { id: activeTrip.id } });
      return;
    }
    if (!session?.user.hasPin) {
      router.push('/pin');
      return;
    }
    if (!route || !place || expired) return;
    update({ selectedRoute: route });
    start.mutate(
      {
        routeId: route.id,
        routeKind: 'faster',
        destination: place.label,
        contactIds,
        ...adult.startInput,
      },
      {
        onSuccess: ({ trip }) =>
          router.replace({ pathname: '/trajeto/[id]', params: { id: trip.id } }),
      },
    );
  }
  const ready =
    contacts.data !== undefined &&
    (contactIds.length > 0 || soloConfirmed || accepted.length === 0);
  if (!places.isPending && !place)
    return (
      <Protected>
        <Screen title="Início rápido">
          <ErrorNotice error={places.error ?? new Error('Local salvo não encontrado.')} />
          <Button
            label="Ver locais salvos"
            variant="secondary"
            onPress={() => router.replace('/locais-salvos')}
          />
        </Screen>
      </Protected>
    );
  return (
    <Protected>
      <Screen title="Início rápido">
        <AppText tone="muted">
          Calcule a primeira rota a pé até um local salvo e comece a caminhada em poucos toques.
        </AppText>
        {place && (
          <Card style={s.placeCard}>
            <View style={s.placeTitle}>
              <Icon
                name={
                  place.kind === 'home' ? 'home' : place.kind === 'work' ? 'briefcase' : 'map-pin'
                }
                color={colors.primaryText}
              />
              <AppText variant="subtitle">{place.label}</AppText>
            </View>
            <AppText variant="small" tone="muted" numberOfLines={2}>
              {place.address}
            </AppText>
          </Card>
        )}
        {!consent.data?.enabled ? (
          <>
            <ErrorNotice error={consent.error} />
            <AppText variant="small" tone="muted">
              O cálculo de rota usa os serviços externos do mapa.
            </AppText>
            <Button
              label="Revisar serviços do mapa"
              onPress={() => router.push('/servicos-mapa')}
            />
          </>
        ) : (
          <>
            <AppText style={s.sectionLabel}>ORIGEM</AppText>
            {origin ? (
              <AppText variant="small" tone="muted">
                {originLabel}
              </AppText>
            ) : (
              <View style={s.form}>
                <Button
                  label="Usar minha localização"
                  icon="crosshair"
                  onPress={captureCurrentPosition}
                />
                <Button
                  label="Digitar endereço de origem"
                  variant="secondary"
                  icon="map-pin"
                  onPress={() => router.push({ pathname: '/buscar', params: { modo: 'origem' } })}
                />
                <ErrorNotice error={geo.error} />
              </View>
            )}
            {origin && !originIsGps && (
              <Button
                label="Atualizar com minha localização atual"
                variant="ghost"
                icon="crosshair"
                onPress={captureCurrentPosition}
              />
            )}
            <AppText style={s.sectionLabel}>
              ROTA ·{' '}
              {preference === 'prefer_lit'
                ? 'PREFERIR ILUMINADAS'
                : preference === 'step_free'
                  ? 'SEM ESCADAS'
                  : 'PADRÃO'}
            </AppText>
            {routes.isFetching && (
              <View style={s.form}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="small" tone="muted">
                  Calculando o percurso na rede de ruas e caminhos…
                </AppText>
              </View>
            )}
            <ErrorNotice error={routes.error} />
            {routes.isError && (
              <Button
                label="Tentar calcular novamente"
                variant="secondary"
                onPress={() => {
                  void routes.refetch();
                }}
              />
            )}
            {route && (
              <View style={s.routeCard}>
                <AppText variant="heading">
                  {durationLabel(route.durationMinutes)} ·{' '}
                  {(route.distanceMeters / 1000).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  km
                </AppText>
                <AppText variant="small" tone="muted">
                  {routePreferenceLabel(route.preference)}
                </AppText>
                <AppText variant="small" tone="muted">
                  {routeContextText(route)}
                </AppText>
                <AppText variant="small" tone="muted">
                  O SafeWalk mostra registros públicos; não avalia nem garante a segurança ou a
                  acessibilidade de um caminho.
                </AppText>
                <Button
                  label="Ver rotas e escolher modo de transporte"
                  variant="ghost"
                  icon="map"
                  onPress={() => router.push('/rotas')}
                />
              </View>
            )}
            <AppText style={s.sectionLabel}>QUEM ACOMPANHA</AppText>
            {contacts.isPending && <ActivityIndicator color={colors.primary} />}
            <ErrorNotice error={contacts.error ?? trips.error ?? start.error} />
            {accepted.length > 0 ? (
              <View style={s.contactRow}>
                {accepted.map((contact) => (
                  <Pressable
                    key={contact.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: contactIds.includes(contact.id) }}
                    aria-checked={contactIds.includes(contact.id)}
                    style={[s.contactChip, contactIds.includes(contact.id) && s.optionSelected]}
                    onPress={() => toggleContact(contact.id)}
                  >
                    <Icon
                      name={contactIds.includes(contact.id) ? 'check-circle' : 'circle'}
                      size={16}
                      color={colors.primaryText}
                    />
                    <AppText variant="small">{contact.name}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <AppText variant="small" tone="muted">
                Nenhum contato aceito ainda. Ninguém será avisado se o check-in passar.
              </AppText>
            )}
            {accepted.length > 0 && contactIds.length === 0 && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: soloConfirmed }}
                aria-checked={soloConfirmed}
                style={s.contactChip}
                onPress={() => setSoloConfirmed((value) => !value)}
              >
                <Icon
                  name={soloConfirmed ? 'check-square' : 'square'}
                  size={16}
                  color={colors.primaryText}
                />
                <AppText variant="small">Seguir sem acompanhamento neste trajeto</AppText>
              </Pressable>
            )}
            {expired && (
              <AppText variant="small" tone="muted">
                Esta opção expirou. Atualize o percurso antes de iniciar.
              </AppText>
            )}
            {!activeTrip && (
              <AdultCompanionCheck
                required={adult.required}
                confirmed={adult.confirmed}
                onToggle={adult.toggle}
              />
            )}
            <Button
              label={
                activeTrip
                  ? 'Retomar trajeto'
                  : !session?.user.hasPin
                    ? 'Configurar PIN e continuar'
                    : 'Iniciar trajeto'
              }
              disabled={
                !activeTrip &&
                (!route ||
                  adult.blocked ||
                  expired ||
                  !ready ||
                  routes.isFetching ||
                  routes.isError ||
                  contacts.isPending ||
                  trips.isPending)
              }
              loading={start.isPending}
              onPress={begin}
            />
          </>
        )}
      </Screen>
    </Protected>
  );
}
