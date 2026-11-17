import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { Trip } from '@safewalk/contracts';
import { CollapsibleSheet } from '@/components/layout/collapsible-sheet';
import { Screen } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useGeoLocation } from '@/features/location/location-provider';
import { startBackgroundTrip, stopBackgroundTrip } from '@/features/location/background-location';
import { useMapConsent, useSetMapConsent } from '@/features/maps/use-map-data';
import { localTime } from '@/lib/time';
import { useTheme } from '@/theme/theme-provider';
import { useClock } from '@/hooks/use-clock';
import { usePausePositionSharing, useTripStartEmailNotifications } from './use-trips';
import { createRealTripStyles } from './real-trip-screen.styles';
import { TripStartEmailNotice } from './trip-start-email-notice';
import { SosButton } from './sos-button';

export function TimerTripScreen({
  trip,
  demonstration,
  onAlert,
  alertPending,
  error,
}: {
  trip: Trip;
  demonstration: boolean;
  onAlert: () => void;
  alertPending: boolean;
  error: unknown;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createRealTripStyles(colors), [colors]);
  const geo = useGeoLocation();
  const emailNotifications = useTripStartEmailNotifications(trip.id);
  const gps = useMutation({ mutationFn: () => geo.start() });
  const pause = usePausePositionSharing(trip.id);
  const background = useMutation({ mutationFn: () => startBackgroundTrip(trip.id) });
  const disableBackground = useMutation({
    mutationFn: stopBackgroundTrip,
    onSuccess: () => background.reset(),
  });
  const consent = useMapConsent();
  const setConsent = useSetMapConsent();
  const now = useClock(5000);
  const position =
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const remainingSeconds = Math.max(
    0,
    Math.round((Date.parse(trip.expectedArrivalAt) - now) / 1000),
  );
  const remainingText =
    remainingSeconds >= 60
      ? `${Math.floor(remainingSeconds / 60)} min ${remainingSeconds % 60 ? `${remainingSeconds % 60} s` : ''}`.trim()
      : `${remainingSeconds} s`;
  const markers = position
    ? [
        {
          id: 'timer-position',
          location: position,
          title: 'Sua posição atual',
          category: 'other' as const,
        },
      ]
    : [];
  return (
    <Screen scroll={false}>
      {consent.data?.enabled ? (
        position ? (
          <RealMap
            center={position}
            markers={markers}
            location={position}
            followLocation
            controlsTop={160}
            attributionTop={130}
          />
        ) : (
          <RealMap
            center={trip.lastPosition ?? { latitude: -23.559, longitude: -46.651 }}
            markers={[]}
            location={null}
            controlsTop={160}
            attributionTop={130}
          />
        )
      ) : (
        <View style={styles.mapPlaceholder}>
          <AppText tone="muted">
            O mapa externo está desativado. Ao ativar, OpenFreeMap receberá requisições da região
            exibida.
          </AppText>
          <Button
            label="Ativar mapa real"
            loading={setConsent.isPending}
            onPress={() => setConsent.mutate(true)}
          />
        </View>
      )}
      <View style={styles.instruction}>
        <View style={styles.row}>
          <Icon name="clock" color={colors.white} />
          <View style={styles.grow}>
            <AppText variant="small" style={styles.white}>
              Acompanhamento por tempo · sem rota calculada
            </AppText>
            <AppText style={styles.instructionTitle} numberOfLines={2}>
              {trip.destination}
            </AppText>
          </View>
        </View>
        <AppText variant="small" style={styles.white}>
          Termina às {localTime(trip.expectedArrivalAt)}. O app pedirá um check-in no final.
        </AppText>
      </View>
      <CollapsibleSheet
        expandLabel="Mais opções"
        collapseLabel="Minimizar"
        footer={
          <View style={styles.criticalAction}>
            <ErrorNotice error={error} />
            <SosButton
              demonstration={demonstration}
              contactCount={trip.contactIds.length}
              loading={alertPending}
              onActivate={onAlert}
            />
          </View>
        }
        header={
          <View style={styles.panelContent}>
            <View style={styles.between}>
              <Badge label="Acompanhamento por tempo" />
              <Button
                label="Compartilhar"
                variant="ghost"
                icon="users"
                onPress={() =>
                  router.push({ pathname: '/compartilhar/[id]', params: { id: trip.id } })
                }
              />
            </View>
            <View style={styles.between}>
              <View style={styles.grow}>
                <AppText style={styles.estimate}>{remainingText}</AppText>
                <AppText variant="small" tone="muted">
                  restantes até o check-in · previsto para {localTime(trip.expectedArrivalAt)}
                </AppText>
              </View>
              <Button
                label="Encerrar"
                variant="secondary"
                icon="x-circle"
                onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id: trip.id } })}
              />
            </View>
          </View>
        }
      >
        <View style={styles.panelDetails}>
          <TripStartEmailNotice notifications={emailNotifications} />
          <View style={styles.notice}>
            <AppText variant="label">Sem rota calculada</AppText>
            <AppText variant="small" tone="muted">
              Este acompanhamento mede apenas o tempo combinado. Não há verificação de trajeto,
              desvio ou condições do caminho.
            </AppText>
          </View>
          <ErrorNotice
            error={
              geo.error ??
              geo.transmissionError ??
              gps.error ??
              pause.error ??
              background.error ??
              disableBackground.error ??
              consent.error ??
              setConsent.error
            }
          />
          <AppText variant="small" tone="muted">
            {geo.enabled
              ? position
                ? `GPS autorizado · precisão de ${Math.round(position.accuracyMeters)} m. O envio está habilitado; falhas de transmissão aparecem acima.`
                : 'Aguardando uma posição recente com precisão de até 150 metros.'
              : 'Sua localização está desativada. Sem ela, o servidor não recebe posições deste trajeto.'}
          </AppText>
          <Button
            label={geo.enabled ? 'Parar de enviar minha localização' : 'Usar minha localização'}
            icon={geo.enabled ? 'pause-circle' : 'crosshair'}
            variant="secondary"
            disabled={!consent.data?.enabled}
            loading={gps.isPending || pause.isPending}
            onPress={() => {
              if (geo.enabled) {
                geo.stop();
                background.reset();
                pause.mutate();
              } else gps.mutate();
            }}
          />
          {Platform.OS !== 'web' && consent.data?.enabled && geo.enabled && (
            <Button
              label={
                background.isSuccess
                  ? 'Desativar acompanhamento em segundo plano'
                  : 'Ativar acompanhamento com tela bloqueada'
              }
              variant="secondary"
              loading={background.isPending || disableBackground.isPending}
              onPress={() =>
                background.isSuccess ? disableBackground.mutate() : background.mutate()
              }
            />
          )}
          <Button
            label="Cheguei ao destino"
            variant="secondary"
            onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id: trip.id } })}
          />
        </View>
      </CollapsibleSheet>
    </Screen>
  );
}
