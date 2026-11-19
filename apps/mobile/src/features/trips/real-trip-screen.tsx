import { durationLabel } from '@/lib/duration';
import type { MapRecordGroup } from '@/components/map/real-map.types';
import { RouteLayerPanel } from '@/features/maps/route-layer-panel';
import { useRouteLayerPresentation } from '@/features/maps/use-route-layer-presentation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { RealRoute, Trip } from '@safewalk/contracts';
import { CollapsibleSheet } from '@/components/layout/collapsible-sheet';
import { Screen } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useGeoLocation } from '@/features/location/location-provider';
import { startBackgroundTrip, stopBackgroundTrip } from '@/features/location/background-location';
import {
  useMapConsent,
  useReverseAddress,
  useSetMapConsent,
  useRouteUrbanContext,
} from '@/features/maps/use-map-data';
import { RouteUrbanRecord } from '@/features/maps/route-conditions';
import { liveRouteEvidence, routeRain } from '@/features/maps/route-map-conditions';
import { routeRainAlert } from '@/features/maps/rain-alert';
import { RainAlertBanner } from '@/features/maps/rain-alert-banner';
import { featureExplanation } from '@/features/maps/map-data';
import { RouteDetailsSheet } from '@/features/maps/route-details-sheet';
import {
  NearbyReportPrompt,
  NearbyReportPrompts,
  QuickObstacleReport,
} from '@/features/reports/community-report-components';
import { localTime } from '@/lib/time';
import { useTheme } from '@/theme/theme-provider';
import {
  usePausePositionSharing,
  useRerouteTrip,
  useTripStartEmailNotifications,
} from './use-trips';
import { createRealTripStyles, followButtonPosition } from './real-trip-screen.styles';
import { spacing } from '@/theme/tokens';
import { TripStartEmailNotice } from './trip-start-email-notice';
import { SosButton } from './sos-button';
import { useClock } from '@/hooks/use-clock';
import { cumulativeDistances, RouteGuidanceTracker } from './route-guidance';
import {
  formatDistance,
  maneuverIcon,
  nextNavigationCue,
  projectRecords,
  recordsAhead,
  signalsAlongRoute,
  upcomingSignal,
} from './navigation-cues';
import { recordIconImages } from '@/components/map/record-icons';

export function RealTripScreen({
  trip,
  route,
  demonstration,
  onAlert,
  alertPending,
  error,
}: {
  trip: Trip;
  route: RealRoute;
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
  const reroute = useRerouteTrip(trip.id);
  const reroutePending = reroute.isPending;
  const rerouteMutate = reroute.mutate;
  const automaticRerouteRouteId = useRef<string | null>(null);
  const background = useMutation({ mutationFn: () => startBackgroundTrip(trip.id) });
  const disableBackground = useMutation({
    mutationFn: stopBackgroundTrip,
    onSuccess: () => background.reset(),
  });
  const consent = useMapConsent();
  const setConsent = useSetMapConsent();
  const [showOptions, setShowOptions] = useState(false);
  const [recordGroup, setRecordGroup] = useState<MapRecordGroup | null>(null);
  const [quickReportVisible, setQuickReportVisible] = useState(false);
  const [quickReportRequested, setQuickReportRequested] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [activeStepSelection, setActiveStepSelection] = useState<{
    routeId: string;
    index: number;
  } | null>(null);
  const [cameraFollowing, setCameraFollowing] = useState(true);
  const [bannerBottom, setBannerBottom] = useState<number | null>(null);
  // Parte da tela coberta pelo painel inferior: a câmera mantém a posição acima dele.
  const [sheetCover, setSheetCover] = useState(0);
  const now = useClock(5000);
  const conditions = useRouteUrbanContext(route.id, trip.id);
  const urbanData = conditions.data?.data;
  const rainStatus = routeRain(urbanData, now);
  const floodAssessment = conditions.data?.floodAssessment ?? route.context?.floodAssessment;
  const rainWarning = routeRainAlert(
    floodAssessment?.weatherCondition ?? rainStatus,
    floodAssessment,
  );
  // Fechado o aviso, ele só volta na próxima chuva.
  const [rainWarningClosed, setRainWarningClosed] = useState(false);
  if (!rainWarning && rainWarningClosed) setRainWarningClosed(false);
  const [urbanSelection, setUrbanSelection] = useState<string | null>(null);
  const selectedUrban = urbanData?.features.find((feature) => feature.id === urbanSelection);
  const layers = useRouteLayerPresentation(route, urbanData, now, urbanSelection);
  const evidenceRoute = liveRouteEvidence(route, urbanData);
  const position =
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const quickReportOpen = quickReportVisible || (quickReportRequested && Boolean(position));
  const reverseAddress = useReverseAddress(quickReportOpen ? position : null);
  // Polling reparses the route object; the route ID keeps guidance state stable for that route.
  const routeGuidanceTracker = useMemo(
    () => new RouteGuidanceTracker(route),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.id],
  );
  const guidance = useSyncExternalStore(
    routeGuidanceTracker.subscribe,
    routeGuidanceTracker.getSnapshot,
    routeGuidanceTracker.getSnapshot,
  );
  useEffect(() => {
    routeGuidanceTracker.update(position, now);
  }, [routeGuidanceTracker, position, now]);
  useEffect(() => {
    if (!guidance.offRoute) {
      if (!reroutePending) automaticRerouteRouteId.current = null;
      return;
    }
    if (
      !guidance.reliableFix ||
      !position ||
      automaticRerouteRouteId.current === route.id ||
      reroutePending
    )
      return;
    automaticRerouteRouteId.current = route.id;
    rerouteMutate(route.id);
  }, [guidance.offRoute, guidance.reliableFix, position, route.id, reroutePending, rerouteMutate]);
  const routeMatch = guidance.match;
  const currentStep =
    routeMatch && routeMatch.distanceMeters <= (route.profile === 'auto' ? 95 : 65)
      ? route.instructions.reduce(
          (current, step, index) =>
            step.beginPointIndex <= routeMatch.pointIndex ? index : current,
          0,
        )
      : null;
  const activeStep = activeStepSelection?.routeId === route.id ? activeStepSelection.index : null;
  const progressRatio =
    guidance.totalRouteMeters > 0
      ? Math.min(1, guidance.progressMeters / guidance.totalRouteMeters)
      : 0;
  const remainingMeters = Math.max(0, route.distanceMeters * (1 - progressRatio));
  const remainingMinutes = Math.ceil(route.durationMinutes * (1 - progressRatio));
  // Distância percorrida só conta com GPS confiável sobre a rota; sem isso, nada de "em 80 m".
  const alongRouteMeters =
    currentStep !== null && routeMatch && guidance.reliableFix ? routeMatch.alongRouteMeters : null;
  const cumulative = useMemo(() => cumulativeDistances(route.points), [route.points]);
  const cue = nextNavigationCue(route, cumulative, currentStep, alongRouteMeters);
  const routeSignals = useMemo(
    () => signalsAlongRoute(route.points, cumulative, urbanData?.features ?? []),
    [route.points, cumulative, urbanData],
  );
  const signalAhead = upcomingSignal(routeSignals, alongRouteMeters);
  const recordProjection = useMemo(
    () => projectRecords(route.points, cumulative, layers.records),
    [route.points, cumulative, layers.records],
  );
  const recordsOnTheWay = useMemo(
    () => recordsAhead(layers.records, recordProjection, alongRouteMeters, urbanSelection),
    [layers.records, recordProjection, alongRouteMeters, urbanSelection],
  );
  // Créditos, chuva e controles do mapa ficam logo abaixo da faixa, que muda de altura.
  const mapOverlayTop = (bannerBottom ?? 122) + spacing.sm;
  const followPosition = useMemo(() => followButtonPosition(mapOverlayTop + 72), [mapOverlayTop]);
  // Só aparece quando há algo a corrigir; o funcionamento normal dispensa explicação.
  const guidanceNotice = guidance.offRoute
    ? reroute.isPending
      ? 'Desvio confirmado. Procurando um caminho atualizado para o mesmo destino.'
      : reroute.isError
        ? 'Desvio confirmado. A rota anterior continua ativa até conseguirmos recalcular.'
        : 'Desvio confirmado. Vamos atualizar o caminho mantendo seu destino e perfil.'
    : position && position.accuracyMeters > 45
      ? 'Sinal GPS impreciso; a distância pode demorar para atualizar.'
      : null;
  const cueText = cue?.instruction.text || 'Siga a rota indicada no mapa';
  const cueDistance = cue?.distanceMeters ?? null;
  const cueSpoken = [
    cueDistance === null
      ? cueText
      : cueDistance < 20
        ? `Agora: ${cueText}`
        : `Em ${formatDistance(cueDistance)}: ${cueText}`,
    signalAhead
      ? `Semáforo cadastrado à frente, em ${formatDistance(signalAhead.distanceMeters)}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  const routeMarkers = useMemo(
    () => [
      {
        id: 'route-origin',
        location: route.origin,
        title: 'Origem informada',
        category: 'crossing' as const,
      },
      { id: 'route-destination', location: route.destination, title: route.destinationLabel },
    ],
    [route],
  );
  return (
    <Screen scroll={false}>
      {consent.data?.enabled ? (
        <RealMap
          rainStatus={rainStatus}
          center={route.origin}
          route={route.points}
          markers={routeMarkers}
          urbanFeatures={layers.outline}
          recordPoints={recordsOnTheWay}
          onRecordGroupPress={setRecordGroup}
          onMarkerPress={(id) => setUrbanSelection(id)}
          onMapPress={() => setUrbanSelection(null)}
          markerPreview={(id) => {
            const feature = urbanData?.features.find((item) => item.id === id);
            return feature
              ? `${feature.properties.title}\n${featureExplanation(feature)}`
              : routeMarkers.find((marker) => marker.id === id)?.title;
          }}
          location={position}
          fitRoute={!position}
          followLocation={Boolean(position) && cameraFollowing}
          followZoom={route.profile === 'auto' ? 16 : 17}
          followBearing={geo.courseDegrees}
          followPadding={{ top: mapOverlayTop, right: 0, bottom: sheetCover, left: 0 }}
          onFollowLost={() => setCameraFollowing(false)}
          controlsTop={mapOverlayTop + 30}
          attributionTop={mapOverlayTop}
        />
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
      {selectedUrban && (
        <RouteUrbanRecord
          feature={selectedUrban}
          data={urbanData}
          onClose={() => setUrbanSelection(null)}
        />
      )}
      <View
        style={styles.instruction}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setBannerBottom(Math.round(y + height));
        }}
      >
        <View
          style={styles.row}
          accessible
          accessibilityLabel={cueSpoken}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.maneuverBadge}>
            <Icon name={maneuverIcon(cue?.instruction.maneuver)} size={34} color={colors.white} />
          </View>
          <View style={styles.grow}>
            {cueDistance !== null ? (
              <AppText style={styles.maneuverDistance}>{formatDistance(cueDistance)}</AppText>
            ) : (
              <AppText variant="small" style={styles.white}>
                {position
                  ? 'GPS ativo · aguardando confirmar sua posição na rota'
                  : 'Roteiro planejado · ative o GPS para acompanhar'}
              </AppText>
            )}
            <AppText style={styles.instructionTitle} numberOfLines={2}>
              {cueText}
            </AppText>
          </View>
        </View>
        {signalAhead && (
          <View style={styles.signalAlert} importantForAccessibility="no-hide-descendants">
            <View style={styles.signalBubble}>
              <Image source={recordIconImages.signals} style={styles.signalIcon} />
            </View>
            <AppText style={styles.signalText}>
              Semáforo cadastrado à frente · {formatDistance(signalAhead.distanceMeters)}
            </AppText>
          </View>
        )}
        {guidanceNotice && (
          <AppText variant="small" style={styles.white}>
            {guidanceNotice}
          </AppText>
        )}
        {rainWarning && !rainWarningClosed && (
          <RainAlertBanner alert={rainWarning} onDismiss={() => setRainWarningClosed(true)} />
        )}
      </View>
      {position && !cameraFollowing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar a acompanhar minha localização"
          style={[styles.followButton, followPosition]}
          onPress={() => setCameraFollowing(true)}
        >
          <Icon name="navigation" color={colors.white} />
          <AppText variant="label" style={styles.white}>
            Acompanhar
          </AppText>
        </Pressable>
      )}
      <CollapsibleSheet
        initiallyCollapsed
        onCoverChange={setSheetCover}
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
              <Badge
                label={route.profile === 'auto' ? 'Rota de carro real' : 'Rota de pedestres real'}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compartilhar trajeto"
                style={styles.action}
                onPress={() =>
                  router.push({ pathname: '/compartilhar/[id]', params: { id: trip.id } })
                }
              >
                <Icon name="users" color={colors.primaryText} />
              </Pressable>
            </View>
            <TripStartEmailNotice notifications={emailNotifications} />
            <View style={styles.between}>
              <View style={styles.grow}>
                <AppText style={styles.estimate}>
                  {durationLabel(position ? remainingMinutes : route.durationMinutes)} ·{' '}
                  {((position ? remainingMeters : route.distanceMeters) / 1000).toLocaleString(
                    'pt-BR',
                    {
                      maximumFractionDigits: 2,
                    },
                  )}{' '}
                  km
                </AppText>
                <AppText variant="small" tone="muted">
                  {position
                    ? `Estimativa restante · chegada ${localTime(new Date(now + remainingMinutes * 60_000))}`
                    : `Estimativa total · chegada ${localTime(trip.expectedArrivalAt)}`}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Encerrar trajeto com PIN"
                style={styles.action}
                onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id: trip.id } })}
              >
                <Icon name="x-circle" />
              </Pressable>
            </View>
            {position ? (
              <AppText variant="small" tone="muted">
                {cameraFollowing ? 'GPS acompanhando' : 'GPS ativo · mapa livre'} · precisão de{' '}
                {Math.round(position.accuracyMeters)} m
              </AppText>
            ) : (
              <Button
                label={
                  gps.isPending
                    ? 'Buscando localização…'
                    : geo.enabled
                      ? 'Buscando GPS preciso…'
                      : 'Ativar GPS e acompanhar'
                }
                icon="crosshair"
                loading={gps.isPending}
                disabled={!consent.data?.enabled}
                onPress={() => gps.mutate()}
              />
            )}
            {consent.data?.enabled && (
              <>
                <Button
                  label={
                    quickReportRequested && gps.isPending
                      ? 'Localizando você…'
                      : 'Avisar sobre bloqueio'
                  }
                  icon="alert-triangle"
                  variant="secondary"
                  loading={quickReportRequested && gps.isPending}
                  onPress={() => {
                    if (position) {
                      setQuickReportVisible(true);
                      return;
                    }
                    setQuickReportRequested(true);
                    gps.reset();
                    gps.mutate(undefined, { onError: () => setQuickReportRequested(false) });
                  }}
                />
                <ErrorNotice error={gps.error} />
                <NearbyReportPrompt location={position} />
                {reportSent && <Badge label="Relato registrado" tone="success" />}
              </>
            )}
            {guidance.offRoute && (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <AppText variant="label">
                  {reroute.isPending
                    ? 'Atualizando sua rota…'
                    : reroute.isError
                      ? 'Não foi possível recalcular agora.'
                      : 'Você saiu do caminho previsto.'}
                </AppText>
                <AppText variant="small" tone="muted">
                  {reroute.isError
                    ? 'Seu caminho anterior continua disponível. Confira o GPS e tente novamente.'
                    : 'Confirmamos o desvio em posições GPS recentes e estamos buscando outro caminho para o mesmo destino.'}
                </AppText>
                {reroute.isError && (
                  <Button
                    label="Tentar novo caminho"
                    icon="refresh-cw"
                    variant="secondary"
                    loading={reroute.isPending}
                    onPress={() => {
                      automaticRerouteRouteId.current = route.id;
                      reroute.reset();
                      reroute.mutate(route.id);
                    }}
                  />
                )}
              </View>
            )}
          </View>
        }
      >
        <View style={styles.panelDetails}>
          <RouteLayerPanel
            view={layers}
            data={urbanData}
            assessment={conditions.data?.floodAssessment ?? route.context?.floodAssessment}
            now={now}
            refreshing={conditions.isPending || Boolean(conditions.data?.refreshing)}
            error={
              conditions.error ??
              (conditions.data?.refreshError ? new Error(conditions.data.refreshError) : null)
            }
            onRefresh={() => {
              void conditions.refetch();
            }}
            onSelect={setUrbanSelection}
            group={recordGroup}
            onCloseGroup={() => setRecordGroup(null)}
          />
          <NearbyReportPrompts location={position} limit={3} />
          <ErrorNotice
            error={
              geo.error ??
              geo.transmissionError ??
              pause.error ??
              background.error ??
              disableBackground.error ??
              consent.error ??
              setConsent.error
            }
          />
          <Button
            label={showOptions ? 'Recolher opções do trajeto' : 'Localização e opções do trajeto'}
            icon="sliders"
            variant="ghost"
            onPress={() => setShowOptions((value) => !value)}
          />
          {showOptions && (
            <>
              <AppText variant="small" tone="muted">
                {geo.enabled
                  ? position
                    ? `GPS autorizado · precisão de ${Math.round(position.accuracyMeters)} m. O envio está habilitado; falhas de transmissão aparecem acima.`
                    : 'Aguardando uma posição recente com precisão de até 150 metros. O mapa mostra o roteiro planejado.'
                  : 'Sua localização está desativada. O mapa mostra apenas o roteiro planejado.'}
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
              {background.isSuccess && geo.enabled && (
                <AppText variant="small" tone="muted">
                  Acompanhamento em segundo plano solicitado ao sistema. Requer development build; o
                  sistema pode interrompê-lo por bateria ou encerramento do aplicativo.
                </AppText>
              )}
            </>
          )}
          <Button
            label={
              showInstructions
                ? 'Ocultar instruções'
                : `Ver ${route.instructions.length} etapas e condições`
            }
            variant="secondary"
            icon="list"
            onPress={() => setShowInstructions((value) => !value)}
          />
          {showInstructions && (
            <RouteDetailsSheet
              route={evidenceRoute}
              activeIndex={activeStep ?? currentStep}
              onStep={(index) => setActiveStepSelection({ routeId: route.id, index })}
              onClose={() => setShowInstructions(false)}
            />
          )}
          <Button
            label="Cheguei ao destino"
            variant="secondary"
            onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id: trip.id } })}
          />
        </View>
      </CollapsibleSheet>
      <QuickObstacleReport
        visible={quickReportOpen}
        location={position}
        locationAccuracyMeters={position?.accuracyMeters}
        address={reverseAddress.data?.places[0]?.address ?? 'Perto da localização GPS atual'}
        onClose={() => {
          setQuickReportVisible(false);
          setQuickReportRequested(false);
        }}
        onSubmitted={() => setReportSent(true)}
      />
    </Screen>
  );
}
