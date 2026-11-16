import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Coordinates } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice } from '@/components/ui/primitives';
import { useGeoLocation } from '@/features/location/location-provider';
import { useTheme } from '@/theme/theme-provider';
import { useClock } from '@/hooks/use-clock';
import { useMapConsent, useReverseAddress } from './use-map-data';
import { useMapJourney } from './use-map-journey';
import { RealSearchScreen } from './real-search-screen';
import { createRealDestinationStyles } from './real-destination-screen.styles';
import { MapConsentPrompt } from './map-consent-prompt';

export function RealDestinationScreen() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  return modo === 'origem' ? <RealSearchScreen /> : <MapDestinationScreen />;
}

function MapDestinationScreen() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  const choosingOrigin = modo === 'origem';
  const { journey, update } = useMapJourney();
  const [point, setPoint] = useState<Coordinates | null>(
    choosingOrigin ? journey.origin : journey.destination,
  );
  const consent = useMapConsent();
  const address = useReverseAddress(point);
  const geo = useGeoLocation();
  const { colors } = useTheme();
  const s = useMemo(() => createRealDestinationStyles(colors), [colors]);
  const now = useClock(5000);
  const place = address.data?.places[0];
  const coordinateLabel = point
    ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
    : '';
  const label = place?.name ?? `Ponto escolhido · ${coordinateLabel}`;
  const position =
    consent.data?.enabled &&
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  function confirm() {
    if (!point || !consent.data?.enabled) return;
    if (choosingOrigin) {
      update({ origin: point, originLabel: `${label} · origem escolhida`, selectedRoute: null });
      router.replace(journey.destination ? '/rotas' : '/buscar');
    } else {
      update({ destination: point, destinationLabel: label, selectedRoute: null });
      router.replace('/rotas');
    }
  }
  return (
    <Protected>
      <Screen title={choosingOrigin ? 'Escolher origem' : 'Escolher destino'} scroll={false}>
        {consent.data?.enabled ? (
          <View style={s.map}>
            <RealMap
              center={point ?? journey.origin}
              selectedPoint={point}
              location={position}
              onMapPress={setPoint}
              controlsTop={100}
              attributionTop={72}
              accessibilityLabel={
                choosingOrigin
                  ? 'Mapa real: toque para definir a origem'
                  : 'Mapa real: toque para definir o destino'
              }
            />
            <View style={s.instruction}>
              <AppText variant="label">
                Toque no mapa para marcar {choosingOrigin ? 'a origem' : 'o destino'}.
              </AppText>
              <AppText variant="small" tone="muted">
                Arraste e amplie para escolher o ponto correto.
              </AppText>
            </View>
            <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
              <View style={s.handle} />
              <Badge label="Ponto escolhido manualmente" />
              {point ? (
                <>
                  <AppText variant="heading">
                    {address.isFetching ? 'Buscando endereço…' : label}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {place?.address ??
                      'Confirme o local pelas coordenadas e pela posição do marcador.'}
                  </AppText>
                  <AppText variant="small" tone="muted">
                    {coordinateLabel}
                  </AppText>
                </>
              ) : (
                <AppText variant="heading">Escolha um ponto no mapa para continuar.</AppText>
              )}
              {address.isFetching && <ActivityIndicator color={colors.primary} />}
              <ErrorNotice error={address.error} />
              {address.isError && (
                <Button
                  label="Consultar endereço novamente"
                  variant="secondary"
                  onPress={() => {
                    void address.refetch();
                  }}
                />
              )}
              {address.data?.status === 'empty' && (
                <AppText variant="small" tone="muted">
                  Não há endereço cadastrado perto deste ponto. Você pode confirmar a posição
                  escolhida.
                </AppText>
              )}
              <Button
                label={choosingOrigin ? 'Confirmar origem' : 'Confirmar destino'}
                disabled={!point || address.isFetching}
                onPress={confirm}
              />
              <Button
                label="Buscar por endereço"
                variant="ghost"
                onPress={() =>
                  router.replace({
                    pathname: '/buscar',
                    params: choosingOrigin ? { modo: 'origem' } : {},
                  })
                }
              />
            </ScrollView>
          </View>
        ) : (
          <View style={s.blocked}>
            {consent.isPending && <ActivityIndicator color={colors.primary} />}
            <ErrorNotice error={consent.error} />
            <MapConsentPrompt title="Ative o mapa para escolher o ponto" />
          </View>
        )}
      </Screen>
    </Protected>
  );
}
