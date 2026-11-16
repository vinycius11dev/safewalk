import type { MapRecordGroup } from '@/components/map/real-map.types';
import { RouteLayerPanel } from './route-layer-panel';
import { useRouteLayerPresentation } from './use-route-layer-presentation';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { RealRoute, RoutingPreference, RoutingRequest } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { useContacts } from '@/features/contacts/use-contacts';
import { useGeoLocation } from '@/features/location/location-provider';
import { useStartTrip, useTrips } from '@/features/trips/use-trips';
import { useAdultCompanion } from '@/features/trips/use-adult-companion';
import { AdultCompanionCheck } from '@/features/trips/adult-companion-check';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { useClock } from '@/hooks/use-clock';
import { ApiError } from '@/lib/api-client';
import { useMapConsent, useRealRoutes, useRouteUrbanContext } from './use-map-data';
import { useMapJourney } from './use-map-journey';
import {
  defaultRoutePreference,
  routePreferenceLabel,
  routePreferenceOptions,
  routeCriteriaText,
} from './route-context-summary';
import { RouteUrbanRecord } from './route-conditions';
import { liveRouteEvidence, routeRain } from './route-map-conditions';
import { routeRainAlert } from './rain-alert';
import { RainAlertBanner } from './rain-alert-banner';
import { featureExplanation } from './map-data';
import { RouteDetailsSheet } from './route-details-sheet';
import { RouteRecordsSummary } from './route-records-summary';
import { recordsCompareLabel, recordsLevelTone } from './route-records-presentation';
import { createRealCompareStyles } from './real-compare-routes-screen.styles';
import { TransportModeSwitch, type TransportMode } from './transport-mode-switch';
import { WheelchairShareCheck } from './wheelchair-share-check';
import { durationLabel, durationSpoken } from '@/lib/duration';
import { localTime } from '@/lib/time';
import { MapConsentPrompt } from './map-consent-prompt';

const compareFitPadding = { top: 170, right: 80, bottom: 420, left: 45 };

export function RealCompareRoutesScreen() {
  const { contatos, semContatos } = useLocalSearchParams<{
    contatos?: string;
    semContatos?: string;
  }>();
  const { journey, update } = useMapJourney();
  const consent = useMapConsent();
  const settings = useProfileSettings();
  const [detailsRouteId, setDetailsRouteId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<{ routeId: string; index: number } | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [recordGroup, setRecordGroup] = useState<MapRecordGroup | null>(null);
  const [preference, setPreference] = useState<RoutingPreference | null>(null);
  const driving = journey.profile === 'auto';
  const wheelchair = !driving && journey.wheelchair;
  const transportMode: TransportMode = driving ? 'auto' : wheelchair ? 'wheelchair' : 'pedestrian';
  const effectivePreference = driving
    ? 'standard'
    : wheelchair
      ? 'step_free'
      : (preference ?? defaultRoutePreference(settings.data?.walkingProfile));
  const input: RoutingRequest | null =
    journey.destination && journey.originConfirmed
      ? {
          origin: journey.origin,
          destination: journey.destination,
          destinationLabel: journey.destinationLabel,
          profile: journey.profile ?? 'pedestrian',
          preference: effectivePreference,
          ...(wheelchair && { wheelchair: true }),
        }
      : null;
  const routes = useRealRoutes(input);
  const options = routes.data?.options ?? [];
  const noRouteOptions =
    input !== null &&
    !routes.isPending &&
    !routes.isFetching &&
    !routes.isError &&
    options.length === 0;
  const hasFloodPriority = options.some(
    (route) =>
      route.context?.floodAssessment?.weatherCondition === 'raining' &&
      route.context.floodAssessment.preferredAlternative,
  );
  const orderedOptions = options
    .map((route, index) => ({ route, index }))
    .sort((a, b) => {
      const aAvoid = a.route.context?.floodAssessment?.recommendation === 'avoid';
      const bAvoid = b.route.context?.floodAssessment?.recommendation === 'avoid';
      if (aAvoid !== bAvoid) return aAvoid ? 1 : -1;
      if (hasFloodPriority) {
        const aPreferred = a.route.context?.floodAssessment?.preferredAlternative === true;
        const bPreferred = b.route.context?.floodAssessment?.preferredAlternative === true;
        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
      }
      const aFewest = a.route.recordsReading?.fewestRecords === true;
      const bFewest = b.route.recordsReading?.fewestRecords === true;
      if (aFewest !== bFewest) return aFewest ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ route }) => route);
  const selected =
    options.find((route) => route.id === journey.selectedRoute?.id) ?? orderedOptions[0];
  const routeConditions = useRouteUrbanContext(selected?.id ?? null);
  const urbanData = routeConditions.data?.data;
  const [urbanSelection, setUrbanSelection] = useState<string | null>(null);
  const detailsBase = options.find((route) => route.id === detailsRouteId);
  const detailsRoute = detailsBase
    ? liveRouteEvidence(detailsBase, detailsBase.id === selected?.id ? urbanData : undefined)
    : undefined;
  const alternative = options.find((route) => route.id !== selected?.id);
  const { session } = useAuth();
  const contacts = useContacts();
  const trips = useTrips();
  const start = useStartTrip();
  const adult = useAdultCompanion();
  const geo = useGeoLocation();
  const { colors } = useTheme();
  const s = useMemo(() => createRealCompareStyles(colors), [colors]);
  const ui = useUiStyles();
  const now = useClock(5000);
  const layers = useRouteLayerPresentation(selected, urbanData, now, urbanSelection);
  const rainStatus = routeRain(urbanData, now);
  const floodAssessment =
    routeConditions.data?.floodAssessment ?? selected?.context?.floodAssessment;
  const rainWarning = routeRainAlert(
    floodAssessment?.weatherCondition ?? rainStatus,
    floodAssessment,
  );
  // Fechado o aviso, ele só volta na próxima chuva.
  const [rainWarningClosed, setRainWarningClosed] = useState(false);
  if (!rainWarning && rainWarningClosed) setRainWarningClosed(false);
  const selectedUrbanFeature = urbanData?.features.find((feature) => feature.id === urbanSelection);
  const routeMarkers = useMemo(
    () => [
      {
        id: 'chosen-origin',
        title: journey.originLabel,
        location: journey.origin,
        category: 'crossing' as const,
      },
      ...(journey.destination
        ? [
            {
              id: 'chosen-destination',
              title: journey.destinationLabel,
              location: journey.destination,
            },
          ]
        : []),
    ],
    [journey.origin, journey.originLabel, journey.destination, journey.destinationLabel],
  );
  const accepted = contacts.data?.filter((contact) => contact.accepted) ?? [];
  const contactIds = (
    contatos === undefined
      ? accepted.filter((contact) => contact.defaultAccompany).map((contact) => contact.id)
      : contatos.split(',')
  ).filter((id) => accepted.some((contact) => contact.id === id));
  const activeTrip = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  const position =
    consent.data?.enabled &&
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const expired = Boolean(
    (selected && Date.parse(selected.provenance.expiresAt) <= now) ||
    (start.error instanceof ApiError && start.error.code === 'ROUTE_PROPOSAL_EXPIRED'),
  );
  function refreshRoutes() {
    start.reset();
    void routes.refetch();
  }
  function selectRoute(route: RealRoute) {
    setActiveStep(null);
    start.reset();
    update({ selectedRoute: route });
  }
  function changeTransportMode(mode: TransportMode) {
    start.reset();
    setActiveStep(null);
    update({
      profile: mode === 'auto' ? 'auto' : 'pedestrian',
      wheelchair: mode === 'wheelchair',
      shareWheelchair: false,
      selectedRoute: null,
    });
  }
  function begin() {
    if (activeTrip) {
      router.push({ pathname: '/trajeto/[id]', params: { id: activeTrip.id } });
      return;
    }
    if (!selected || !consent.data?.enabled || expired) return;
    selectRoute(selected);
    if (!session?.user.hasPin) {
      router.push('/pin');
      return;
    }
    if (contactIds.length === 0 && contatos === undefined && semContatos !== '1') {
      router.push({
        pathname: '/sem-contatos',
        params: { destino: journey.destinationLabel, routeKind: 'faster' },
      });
      return;
    }
    start.mutate(
      {
        routeId: selected.id,
        routeKind: 'faster',
        destination: journey.destinationLabel,
        contactIds,
        ...adult.startInput,
        ...(wheelchair && journey.shareWheelchair && { shareWheelchair: true }),
      },
      {
        onSuccess: ({ trip }) => {
          update({ shareWheelchair: false });
          router.replace({ pathname: '/trajeto/[id]', params: { id: trip.id } });
        },
      },
    );
  }
  if (!journey.originConfirmed)
    return (
      <Protected>
        <Screen title="Escolher origem">
          <AppText variant="heading">De onde você vai sair?</AppText>
          <AppText tone="muted">
            Use sua localização atual ou digite um endereço para calcular a rota.
          </AppText>
          <Button
            label="Escolher origem"
            onPress={() => router.replace({ pathname: '/buscar', params: { modo: 'origem' } })}
          />
        </Screen>
      </Protected>
    );
  if (!journey.destination)
    return (
      <Protected>
        <Screen title="Escolher sua rota">
          <AppText variant="heading">Para onde você vai?</AppText>
          <AppText tone="muted">
            Escolha o destino para calcular um caminho real a partir da origem selecionada.
          </AppText>
          <Button label="Buscar destino" icon="search" onPress={() => router.replace('/buscar')} />
          <Button
            label="Escolher no mapa"
            icon="map-pin"
            variant="secondary"
            onPress={() => router.replace('/destino')}
          />
        </Screen>
      </Protected>
    );
  return (
    <Protected>
      <Screen scroll={false}>
        {consent.data?.enabled ? (
          <View style={s.map}>
            <RealMap
              rainStatus={rainStatus}
              center={journey.origin}
              route={selected?.points}
              alternativeRoute={alternative?.points}
              location={position}
              fitRoute
              fitPadding={compareFitPadding}
              controlsTop={148}
              attributionTop={124}
              markers={routeMarkers}
              urbanFeatures={layers.outline}
              recordPoints={layers.records}
              onRecordGroupPress={setRecordGroup}
              onMapPress={() => setUrbanSelection(null)}
              onMarkerPress={(id) => setUrbanSelection(id)}
              markerPreview={(id) => {
                const marker = routeMarkers.find((item) => item.id === id);
                const feature = urbanData?.features.find((item) => item.id === id);
                return feature
                  ? `${feature.properties.title}\n${featureExplanation(feature)}\nToque para ver fonte e data.`
                  : marker?.title;
              }}
              accessibilityLabel="Mapa com o percurso do modo selecionado e alternativa disponível"
            />
          </View>
        ) : (
          <View style={s.blocked}>
            <Icon name="map" size={36} color={colors.primaryText} />
            <AppText variant="heading">Ative os serviços para calcular uma rota.</AppText>
          </View>
        )}
        <View style={s.originPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar à busca"
            style={s.compactButton}
            onPress={() => router.replace('/buscar')}
          >
            <Icon name="chevron-left" />
          </Pressable>
          <View style={s.originFields}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alterar origem"
              style={s.addressButton}
              onPress={() => router.push({ pathname: '/buscar', params: { modo: 'origem' } })}
            >
              <Icon name="circle" size={12} color={colors.primaryText} />
              <AppText numberOfLines={1} style={[s.addressText, s.addressGrow]}>
                {journey.originLabel}
              </AppText>
              <Icon name="edit-2" size={13} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alterar destino"
              style={s.addressButton}
              onPress={() => router.push('/buscar')}
            >
              <Icon name="map-pin" size={14} color={colors.danger} />
              <AppText numberOfLines={1} style={[s.addressText, s.addressGrow]}>
                {journey.destinationLabel}
              </AppText>
              <Icon name="edit-2" size={13} color={colors.muted} />
            </Pressable>
          </View>
        </View>
        <View style={s.panel}>
          <ScrollView style={s.routeScroll} contentContainerStyle={s.panelContent}>
            <View style={s.handle} />
            {rainWarning && !rainWarningClosed && (
              <RainAlertBanner alert={rainWarning} onDismiss={() => setRainWarningClosed(true)} />
            )}
            <ErrorNotice error={consent.error} />
            {consent.isPending ? (
              <View style={ui.row}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="small" tone="muted">
                  Verificando sua autorização dos serviços do mapa…
                </AppText>
              </View>
            ) : !consent.data?.enabled ? (
              <View style={s.consentNotice}>
                <MapConsentPrompt
                  title="Ative o mapa para ver as rotas"
                  actionLabel="Ativar o mapa e ver rotas"
                />
              </View>
            ) : (
              <>
                <TransportModeSwitch value={transportMode} onChange={changeTransportMode} />
                {selected ? (
                  <Pressable
                    style={s.metricSummary}
                    accessibilityRole="button"
                    accessibilityLabel={`${durationSpoken(selected.durationMinutes)}. Ver etapas e condições da rota selecionada`}
                    onPress={() => setDetailsRouteId(selected.id)}
                  >
                    <View style={ui.grow}>
                      <AppText style={s.time}>{durationLabel(selected.durationMinutes)}</AppText>
                      <AppText variant="small" tone="muted">
                        {(selected.distanceMeters / 1000).toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        km · chegada às {localTime(new Date(now + selected.durationSeconds * 1000))}
                      </AppText>
                    </View>
                    {routes.isFetching && <ActivityIndicator color={colors.primary} />}
                    <View style={s.detailsLink}>
                      <AppText variant="small" tone="primary">
                        Detalhes
                      </AppText>
                      <Icon name="chevron-right" size={16} color={colors.primaryText} />
                    </View>
                  </Pressable>
                ) : (
                  routes.isFetching && (
                    <View style={s.metricSummary}>
                      <ActivityIndicator color={colors.primary} />
                      <AppText variant="small" tone="muted" style={ui.grow}>
                        Calculando percurso…
                      </AppText>
                    </View>
                  )
                )}
                {selected && (
                  <RouteRecordsSummary
                    options={orderedOptions}
                    selected={selected}
                    onSelect={selectRoute}
                  />
                )}
                {wheelchair && (
                  <AppText variant="small" tone="muted">
                    Rampas e calçadas não são verificadas: confira o caminho antes de sair.
                  </AppText>
                )}
                {wheelchair && contactIds.length > 0 && !activeTrip && (
                  <WheelchairShareCheck
                    checked={journey.shareWheelchair}
                    onToggle={() => update({ shareWheelchair: !journey.shareWheelchair })}
                  />
                )}
                {selected && (
                  <Pressable
                    style={s.optionsRow}
                    accessibilityRole="button"
                    accessibilityLabel="Rotas e preferências"
                    onPress={() => setShowOptions(true)}
                  >
                    <Icon name="sliders" size={16} color={colors.muted} />
                    <AppText variant="small" tone="muted" numberOfLines={1} style={ui.grow}>
                      {routeCriteriaText(
                        transportMode,
                        effectivePreference,
                        selected.walkingProfile,
                      )}
                    </AppText>
                    <AppText variant="small" tone="primary">
                      {options.length > 1 ? `${options.length} opções` : 'Opções'}
                    </AppText>
                    <Icon name="chevron-right" size={16} color={colors.primaryText} />
                  </Pressable>
                )}
                <ErrorNotice error={routes.error} />
                {routes.isError && (
                  <Button
                    label="Tentar calcular novamente"
                    variant="secondary"
                    onPress={refreshRoutes}
                  />
                )}
                {noRouteOptions && (
                  <View style={s.consentNotice}>
                    <AppText variant="subtitle">Nenhuma rota encontrada.</AppText>
                    <AppText tone="muted">
                      O serviço de rotas não devolveu opções para este trajeto. Isso não significa
                      que o caminho seja seguro ou inseguro. Tente calcular de novo ou escolha outro
                      destino.
                    </AppText>
                    <Button
                      label="Tentar calcular novamente"
                      variant="secondary"
                      onPress={refreshRoutes}
                    />
                    <Button
                      label="Trocar destino"
                      variant="secondary"
                      onPress={() => router.push('/buscar')}
                    />
                  </View>
                )}
                {selected && (
                  <RouteLayerPanel
                    view={layers}
                    data={urbanData}
                    assessment={
                      routeConditions.data?.floodAssessment ?? selected.context?.floodAssessment
                    }
                    now={now}
                    refreshing={
                      routeConditions.isPending || Boolean(routeConditions.data?.refreshing)
                    }
                    error={
                      routeConditions.error ??
                      (routeConditions.data?.refreshError
                        ? new Error(routeConditions.data.refreshError)
                        : null)
                    }
                    onRefresh={() => {
                      void routeConditions.refetch();
                    }}
                    onSelect={setUrbanSelection}
                    group={recordGroup}
                    onCloseGroup={() => setRecordGroup(null)}
                  />
                )}
                {showOptions && (
                  <Modal
                    visible
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowOptions(false)}
                  >
                    <View style={s.optionsOverlay}>
                      <View style={s.optionsSheet}>
                        <View style={ui.between}>
                          <AppText variant="heading">Rotas e preferências</AppText>
                          <Button
                            label="Fechar"
                            variant="ghost"
                            onPress={() => setShowOptions(false)}
                          />
                        </View>
                        <ScrollView contentContainerStyle={s.status}>
                          {transportMode === 'pedestrian' && (
                            <View style={s.preferenceRow}>
                              {routePreferenceOptions.map((option) => (
                                <Pressable
                                  key={option.value}
                                  style={[
                                    s.preferenceChip,
                                    effectivePreference === option.value &&
                                      s.preferenceChipSelected,
                                  ]}
                                  accessibilityRole="radio"
                                  aria-checked={effectivePreference === option.value}
                                  accessibilityState={{
                                    checked: effectivePreference === option.value,
                                  }}
                                  onPress={() => {
                                    start.reset();
                                    setPreference(option.value);
                                    update({ selectedRoute: null });
                                  }}
                                >
                                  <AppText variant="small">{option.label}</AppText>
                                </Pressable>
                              ))}
                            </View>
                          )}
                          {driving && (
                            <AppText variant="small" tone="muted">
                              Estimativa sem trânsito ao vivo. Rodízio por placa e interdições
                              recentes não são verificados.
                            </AppText>
                          )}
                          {hasFloodPriority && (
                            <AppText variant="small" tone="muted">
                              Com chuva estimada, a primeira opção tem menos registros conhecidos de
                              inundação nesta consulta. A cobertura é parcial.
                            </AppText>
                          )}
                          {orderedOptions.map((route, index) => (
                            <Pressable
                              key={route.id}
                              accessibilityRole="radio"
                              aria-checked={selected?.id === route.id}
                              accessibilityState={{ checked: selected?.id === route.id }}
                              accessibilityLabel={`Selecionar opção ${index + 1}, ${durationSpoken(route.durationMinutes)}`}
                              style={[s.routeCard, selected?.id === route.id && s.selected]}
                              onPress={() => selectRoute(route)}
                            >
                              <View style={ui.between}>
                                <AppText variant="subtitle">
                                  {durationLabel(route.durationMinutes)} ·{' '}
                                  {(route.distanceMeters / 1000).toLocaleString('pt-BR', {
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  km
                                </AppText>
                                <AppText variant="small">Opção {index + 1}</AppText>
                              </View>
                              <AppText variant="small" tone="muted">
                                {routePreferenceLabel(route.preference)}
                              </AppText>
                              {route.recordsReading && (
                                <Badge
                                  label={recordsCompareLabel(route)}
                                  tone={recordsLevelTone(route.recordsReading)}
                                />
                              )}
                              {route.context?.floodAssessment?.preferredAlternative && (
                                <>
                                  <Badge label="Prioridade: menos registros conhecidos" />
                                  <AppText variant="small" tone="muted" numberOfLines={2}>
                                    {route.context.floodAssessment.summary}
                                  </AppText>
                                </>
                              )}
                              {route.context?.floodAssessment?.recommendation === 'avoid' && (
                                <Badge
                                  label={`Ocorrência intransitável para ${route.profile === 'auto' ? 'veículos' : 'pedestres'}`}
                                  tone="danger"
                                />
                              )}
                              {route.context?.floodAssessment?.recommendation === 'caution' && (
                                <AppText variant="small" tone="muted" numberOfLines={2}>
                                  {route.context.floodAssessment.summary}
                                </AppText>
                              )}
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </Modal>
                )}
                {expired && (
                  <View style={s.consentNotice}>
                    <AppText tone="muted">
                      Esta opção expirou. Atualize o percurso antes de iniciar.
                    </AppText>
                    <Button label="Atualizar rota" variant="secondary" onPress={refreshRoutes} />
                  </View>
                )}
              </>
            )}
          </ScrollView>
          {consent.data?.enabled && (
            <View style={s.footer}>
              <View style={s.contacts}>
                <View style={s.avatarGroup}>
                  {accepted
                    .filter((contact) => contactIds.includes(contact.id))
                    .slice(0, 2)
                    .map((contact, index) => (
                      <View key={contact.id} style={[s.avatar, index === 1 && s.avatarSecond]}>
                        <AppText style={s.avatarText}>{contact.name.charAt(0)}</AppText>
                      </View>
                    ))}
                </View>
                <AppText variant="label" style={ui.grow}>
                  {contactIds.length
                    ? countLabel(contactIds.length, 'contato acompanha', 'contatos acompanham')
                    : 'Sem contatos neste trajeto'}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Alterar contatos que acompanham"
                  style={s.compactButton}
                  onPress={() => {
                    if (selected) selectRoute(selected);
                    router.push({
                      pathname: '/quem-acompanha',
                      params: {
                        destino: journey.destinationLabel,
                        rota: 'faster',
                        contatos: contactIds.join(','),
                      },
                    });
                  }}
                >
                  <AppText tone="primary" variant="label">
                    Alterar
                  </AppText>
                </Pressable>
              </View>
              {!activeTrip && (
                <AdultCompanionCheck
                  required={adult.required}
                  confirmed={adult.confirmed}
                  onToggle={adult.toggle}
                />
              )}
              <ErrorNotice error={start.error ?? contacts.error ?? trips.error} />
              <Button
                label={
                  activeTrip
                    ? 'Retomar trajeto'
                    : !session?.user.hasPin
                      ? 'Configurar PIN e continuar'
                      : driving
                        ? 'Iniciar trajeto de carro'
                        : wheelchair
                          ? 'Iniciar trajeto'
                          : 'Iniciar caminhada'
                }
                loading={start.isPending}
                disabled={
                  !activeTrip &&
                  (!selected ||
                    adult.blocked ||
                    expired ||
                    routes.isFetching ||
                    routes.isError ||
                    contacts.isPending ||
                    trips.isPending ||
                    Boolean(contacts.error) ||
                    Boolean(trips.error))
                }
                onPress={begin}
              />
            </View>
          )}
        </View>
        {selectedUrbanFeature && (
          <RouteUrbanRecord
            feature={selectedUrbanFeature}
            data={urbanData}
            onClose={() => setUrbanSelection(null)}
          />
        )}
        {detailsRoute && (
          <RouteDetailsSheet
            key={detailsRoute.id}
            route={detailsRoute}
            activeIndex={activeStep?.routeId === detailsRoute.id ? activeStep.index : null}
            onStep={(index) => setActiveStep({ routeId: detailsRoute.id, index })}
            onClose={() => setDetailsRouteId(null)}
          />
        )}
      </Screen>
    </Protected>
  );
}
