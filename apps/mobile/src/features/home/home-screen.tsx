import { useMemo, useRef, useState } from 'react';
import type { Coordinates, UrbanFeature } from '@safewalk/contracts';
import { rainAlert } from '@/features/maps/rain-alert';
import { RainAlertBanner } from '@/features/maps/rain-alert-banner';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import {
  CollapsibleSheet,
  type CollapsibleSheetHandle,
} from '@/components/layout/collapsible-sheet';
import { Screen, Protected } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { useAuth } from '@/features/auth/auth-provider';
import { useGeoLocation } from '@/features/location/location-provider';
import { useMapConsent, useReverseAddress, useUrbanLayers } from '@/features/maps/use-map-data';
import { useMapJourney, useMapLayers } from '@/features/maps/use-map-journey';
import { routeRain } from '@/features/maps/route-map-conditions';
import { useSavedPlaces } from '@/features/places/use-places';
import { PILOT_BOUNDS, PILOT_CENTER, type MapBounds } from '@/features/maps/maps.service';
import { isCityWideView, urbanRequestBounds } from '@/features/maps/urban-request-bounds';
import { MapFilterChips } from '@/features/maps/map-filter-chips';
import { effectiveMapLayers, FLOOD_LAYERS, floodLayersOn } from '@/features/maps/flood-layers';
import {
  COMMUNITY_RECORD_PREFIX,
  communityFloodRecords,
  reportedAgo,
  type CommunityReport,
} from '@/features/maps/community-flood-records';
import { useNearbyCommunityReports } from '@/features/reports/use-reports';
import { MapPointCard } from './map-point-card';
import { NearbyHelpCard } from './nearby-help-card';
import { nearestPlaces } from '@/features/maps/nearby-places';
import { isSamePlace, SAME_PLACE_MESSAGE } from '@/features/maps/same-place';
import {
  featureExplanation,
  featureSubtitle,
  layerLabels,
  readableDate,
  readableObservation,
} from '@/features/maps/map-data';
import { splitMapRecords } from '@/features/maps/map-records';
import { mergeAccumulatedFeatures } from '@/features/maps/accumulated-features';
import { MapIconLegend } from '@/features/maps/map-icon-legend';
import { createHomeStyles } from './home.styles';
import { useClock } from '@/hooks/use-clock';
import { MapConsentPrompt } from '@/features/maps/map-consent-prompt';

/** Altura do painel aberto do protótipo; minimizado fica só o título. */
const SHEET_MAX_HEIGHT = 344;

export function HomeScreen() {
  const { colors: c } = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  // Altura do aviso de chuva (0 sem aviso): os botões do mapa descem para não ficar sob ele.
  const [bannerHeight, setBannerHeight] = useState(0);
  const s = useMemo(() => createHomeStyles(c, compact, bannerHeight), [c, compact, bannerHeight]);
  const ui = useUiStyles();
  const { session } = useAuth();
  const consent = useMapConsent();
  const gps = useGeoLocation();
  const { journey, update } = useMapJourney();
  const { layers } = useMapLayers();
  const savedPlaces = useSavedPlaces();
  const quickPlaces = useMemo(
    () =>
      [...(savedPlaces.data ?? [])].sort((a, b) => {
        const rank = (kind: string) => (kind === 'home' ? 0 : kind === 'work' ? 1 : 2);
        return rank(a.kind) - rank(b.kind);
      }),
    [savedPlaces.data],
  );
  const [bbox, setBbox] = useState<MapBounds>(PILOT_BOUNDS);
  const [selection, setSelection] = useState<{ feature: UrbanFeature; bbox: MapBounds } | null>(
    null,
  );
  const sheet = useRef<CollapsibleSheetHandle>(null);
  const now = useClock(5000);
  // Last rain reading. Kept while a new area loads, so the flood layers it turned on do not
  // switch off (and back on) at every pan.
  const [rainSeen, setRainSeen] = useState(false);
  const activeLayers = useMemo(() => effectiveMapLayers(layers, rainSeen), [layers, rainSeen]);
  // The request never depends on the rain reading: flood layers are always fetched and only
  // filtered on screen. Otherwise rain → new request → cached "dry" answer → old request →
  // cached "raining" answer… loops during render ("Too many re-renders").
  const types = useMemo(
    () => [...new Set([...layers, ...FLOOD_LAYERS, 'weather' as const, 'floods' as const])],
    [layers],
  );
  const urban = useUrbanLayers(bbox, types);
  if (urban.data) {
    const rainingNow = routeRain(urban.data, now) === 'raining';
    if (rainingNow !== rainSeen) setRainSeen(rainingNow);
  }
  const features = useMemo(
    () =>
      (urban.data?.features ?? []).filter((item) => activeLayers.includes(item.properties.type)),
    [urban.data, activeLayers],
  );
  // O mapa guarda o que já foi carregado nesta sessão: ao afastar, os registros (e semáforos)
  // vistos continuam no mapa, mesmo quando a fonte só devolve uma amostra da área maior.
  const [seen, setSeen] = useState<{
    response: typeof urban.data;
    features: Map<string, UrbanFeature>;
  }>({ response: undefined, features: new Map() });
  if (urban.data && urban.data !== seen.response)
    setSeen({
      response: urban.data,
      features: mergeAccumulatedFeatures(seen.features, urban.data.features),
    });
  const mapFeatures = useMemo(
    () => [...seen.features.values()].filter((item) => activeLayers.includes(item.properties.type)),
    [seen.features, activeLayers],
  );
  const featureIndex = useMemo(
    () => new Map(mapFeatures.map((feature) => [feature.id, feature])),
    [mapFeatures],
  );
  const raining = rainSeen;
  const rainStatus = urban.data ? routeRain(urban.data, now) : raining ? 'raining' : 'unknown';
  // Fechado o aviso, ele só volta na próxima chuva.
  const [rainAlertClosed, setRainAlertClosed] = useState(false);
  if (rainStatus !== 'raining' && rainAlertClosed) setRainAlertClosed(false);
  const cityView = isCityWideView(bbox);
  // Alagamentos relatados por quem usa o app, em volta do centro do mapa (até 5 km).
  const showFloods = floodLayersOn(activeLayers);
  const communityReports = useNearbyCommunityReports(
    showFloods && !cityView
      ? { latitude: (bbox[1] + bbox[3]) / 2, longitude: (bbox[0] + bbox[2]) / 2 }
      : null,
    5000,
  );
  const [communitySelection, setCommunitySelection] = useState<CommunityReport | null>(null);
  const communityReport = (id: string) =>
    id.startsWith(COMMUNITY_RECORD_PREFIX)
      ? communityReports.data?.find(
          (report) => report.id === id.slice(COMMUNITY_RECORD_PREFIX.length),
        )
      : undefined;
  // Pontos viram ícones agrupáveis (estilo navegação); calçadas e áreas seguem como desenho.
  const mapRecords = useMemo(() => {
    const split = splitMapRecords(mapFeatures, raining);
    const community = showFloods
      ? communityFloodRecords(communityReports.data, raining).features
      : [];
    return {
      shapes: split.shapes,
      records: {
        type: 'FeatureCollection' as const,
        features: [...split.records.features, ...community],
      },
    };
  }, [mapFeatures, raining, showFloods, communityReports.data]);
  const position =
    gps.position &&
    gps.position.accuracyMeters <= 150 &&
    now - Date.parse(gps.position.recordedAt) < 60000
      ? gps.position
      : null;
  const rainWarning = useMemo(
    () => rainAlert(rainStatus, features, seen.features.values(), position, urban.data?.truncated),
    [rainStatus, features, seen.features, position, urban.data?.truncated],
  );
  const alertShown = Boolean(rainWarning) && !rainAlertClosed && Boolean(consent.data?.enabled);
  if (!alertShown && bannerHeight !== 0) setBannerHeight(0);
  const approximatePosition =
    gps.enabled && gps.position && now - Date.parse(gps.position.recordedAt) < 60000
      ? gps.position
      : null;
  /** "Ir para cá": the GPS (when precise) or the chosen origin; otherwise ask for the origin. */
  const [samePlace, setSamePlace] = useState(false);
  const goTo = (location: Coordinates, label: string) => {
    if (isSamePlace(position ?? (journey.originConfirmed ? journey.origin : null), location)) {
      setSamePlace(true);
      sheet.current?.reveal();
      return;
    }
    setSamePlace(false);
    update({
      ...(position ? { origin: position, originLabel: 'Sua localização autorizada' } : {}),
      destination: location,
      destinationLabel: label,
      selectedRoute: null,
    });
    if (position || journey.originConfirmed) router.push('/rotas');
    else router.push({ pathname: '/buscar', params: { modo: 'origem' } });
  };
  /** "Sair daqui": the point becomes the origin; then the destination is chosen. */
  const startFrom = (location: Coordinates, label: string) => {
    update({ origin: location, originLabel: label, selectedRoute: null });
    router.push(journey.destination ? '/rotas' : '/buscar');
  };
  const [pin, setPin] = useState<Coordinates | null>(null);
  const pinAddress = useReverseAddress(pin);
  const pinLabel = pinAddress.data?.places[0]?.address || pinAddress.data?.places[0]?.name || null;
  const selectionPoint =
    selection?.feature.geometry.type === 'Point'
      ? selection.feature.geometry.coordinates
      : selection?.feature.geometry.type === 'MultiPoint'
        ? selection.feature.geometry.coordinates[0]
        : undefined;
  // Delegacia e hospital mais próximos: de você (GPS preciso) ou do centro do mapa.
  const nearbyLatitude = position?.latitude ?? (bbox[1] + bbox[3]) / 2;
  const nearbyLongitude = position?.longitude ?? (bbox[0] + bbox[2]) / 2;
  const nearby = useMemo(
    () => nearestPlaces(mapFeatures, { latitude: nearbyLatitude, longitude: nearbyLongitude }),
    [mapFeatures, nearbyLatitude, nearbyLongitude],
  );
  const flood = urban.data?.floodSummary;
  const floodSource = urban.data?.sources.find((source) => source.id === 'cge-floods');
  const weatherSource = urban.data?.sources.find((source) => source.id === 'open-meteo');
  const activeFloods = flood
    ? flood.activePassableForVehicles + flood.activeImpassableForVehicles
    : null;
  return (
    <Protected>
      <Screen scroll={false} tabs>
        {consent.data?.enabled ? (
          <RealMap
            rainStatus={rainStatus}
            center={PILOT_CENTER}
            location={approximatePosition}
            followLocation={Boolean(approximatePosition)}
            urbanFeatures={mapRecords.shapes}
            recordPoints={mapRecords.records}
            onRecordGroupPress={(group) => group.expand()}
            onViewportChange={(viewport) => {
              const requested = urbanRequestBounds(viewport);
              if (requested) setBbox(requested);
            }}
            selectedPoint={pin}
            onMapLongPress={(point) => {
              setSelection(null);
              setCommunitySelection(null);
              setPin(point);
              sheet.current?.reveal();
            }}
            controlsTop={190 + bannerHeight}
            attributionTop={164 + bannerHeight}
            markerPreview={(id) => {
              const report = communityReport(id);
              if (report)
                return `Alagamento relatado pela comunidade ${reportedAgo(report.createdAt, now)}\nRelato de usuário, não verificado. Clique para ver mais.`;
              const feature = featureIndex.get(id);
              return feature
                ? `${feature.properties.title}\n${featureExplanation(feature)}\nClique para ver mais.`
                : undefined;
            }}
            onMapPress={() => {
              setSelection(null);
              setCommunitySelection(null);
              setPin(null);
            }}
            onMarkerPress={(id) => {
              const report = communityReport(id);
              const feature = featureIndex.get(id);
              if (!report && !feature) return;
              setPin(null);
              setCommunitySelection(report ?? null);
              setSelection(feature ? { feature, bbox } : null);
              sheet.current?.reveal();
            }}
          />
        ) : (
          <View style={s.mapPlaceholder}>
            <Icon name="map" size={48} color={c.primaryText} />
            <AppText variant="subtitle">São Paulo, a pé.</AppText>
          </View>
        )}
        <View style={s.top}>
          <View style={s.search}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buscar destino"
              style={s.searchLink}
              onPress={() => router.push('/buscar')}
            >
              <Icon name="search" color={c.primaryText} />
              <AppText style={s.searchText}>Para onde você vai?</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Seu perfil"
              onPress={() => router.push('/seguranca')}
              style={s.avatar}
            >
              <AppText style={s.avatarText}>{session?.user.name.charAt(0) ?? 'S'}</AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipsScroll}
            contentContainerStyle={s.chips}
          >
            {quickPlaces.map((place) => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityLabel={`Iniciar trajeto para ${place.label}`}
                style={s.chip}
                onPress={() =>
                  router.push({ pathname: '/inicio-rapido', params: { placeId: place.id } })
                }
              >
                <Icon
                  name={
                    place.kind === 'home' ? 'home' : place.kind === 'work' ? 'briefcase' : 'map-pin'
                  }
                  size={15}
                  color={c.primaryText}
                />
                <AppText style={s.chipText} numberOfLines={1}>
                  {place.label}
                </AppText>
              </Pressable>
            ))}
            {savedPlaces.data && quickPlaces.length === 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Definir endereço de Casa"
                style={s.chip}
                onPress={() => router.push({ pathname: '/buscar', params: { salvar: 'home' } })}
              >
                <Icon name="home" size={15} color={c.primaryText} />
                <AppText style={s.chipText}>Salvar Casa</AppText>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Acompanhamento por tempo"
              style={s.chip}
              onPress={() => router.push('/modo-timer')}
            >
              <Icon name="clock" size={15} color={c.primaryText} />
              <AppText style={s.chipText}>Timer</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Escolher destino no mapa"
              style={s.chip}
              onPress={() => router.push('/destino')}
            >
              <Icon name="map-pin" size={15} color={c.primaryText} />
            </Pressable>
          </ScrollView>
          {consent.data?.enabled ? (
            <MapFilterChips raining={raining} />
          ) : (
            <View style={s.demo}>
              <Badge label="Mapa real · ativação pendente" />
            </View>
          )}
          {rainWarning && alertShown && (
            <RainAlertBanner
              alert={rainWarning}
              onDismiss={() => setRainAlertClosed(true)}
              onLayout={(event) => setBannerHeight(Math.ceil(event.nativeEvent.layout.height) + 10)}
            />
          )}
        </View>
        <View style={s.mapActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Camadas do mapa"
            style={s.mapAction}
            onPress={() => router.push('/camadas-mapa')}
          >
            <Icon name="layers" color={c.primaryText} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={gps.enabled ? 'Desativar localização' : 'Usar minha localização'}
            style={s.mapAction}
            onPress={() => {
              if (!consent.data?.enabled) {
                router.push('/servicos-mapa');
                return;
              }
              if (gps.enabled) gps.stop();
              else void gps.start().catch(() => {});
            }}
          >
            <Icon name={gps.enabled ? 'navigation' : 'crosshair'} color={c.primaryText} />
          </Pressable>
        </View>
        <CollapsibleSheet
          ref={sheet}
          maxHeight={SHEET_MAX_HEIGHT}
          expandLabel="Mostrar área do mapa"
          header={
            <View style={[ui.between, s.sheetHeader]}>
              <AppText style={s.city}>
                {pin
                  ? 'Ponto no mapa'
                  : selection || communitySelection
                    ? 'Registro selecionado'
                    : 'Área do mapa'}
              </AppText>
              <Badge
                label={
                  selection
                    ? layerLabels[selection.feature.properties.type]
                    : communitySelection
                      ? 'Relato da comunidade'
                      : cityView
                        ? 'Visão da cidade'
                        : 'Cobertura parcial'
                }
                tone="neutral"
              />
            </View>
          }
        >
          <View style={s.sheetContent}>
            {consent.isPending ? (
              <View style={ui.row}>
                <ActivityIndicator color={c.primary} />
                <AppText variant="small" tone="muted">
                  Verificando sua autorização dos serviços do mapa…
                </AppText>
              </View>
            ) : !consent.data?.enabled ? (
              <>
                <ErrorNotice error={consent.error} />
                <MapConsentPrompt
                  title="Ative o mapa"
                  description="Para explorar endereços, rotas a pé e informações públicas da região, enviamos os pontos consultados aos serviços de mapa. Seu nome, telefone e e-mail não são enviados, e o GPS só liga quando você pedir."
                  actionLabel="Ativar mapa e rotas"
                />
              </>
            ) : (
              <>
                {samePlace && (
                  <View
                    style={s.samePlace}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                  >
                    <Icon name="map-pin" size={18} color={c.warning} />
                    <AppText style={ui.grow}>{SAME_PLACE_MESSAGE}</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar aviso"
                      onPress={() => setSamePlace(false)}
                      style={s.previewClose}
                    >
                      <Icon name="x" size={18} color={c.muted} />
                    </Pressable>
                  </View>
                )}
                {pin && (
                  <MapPointCard
                    address={pinLabel}
                    loading={pinAddress.isFetching}
                    onGo={() => goTo(pin, pinLabel ?? 'Ponto escolhido no mapa')}
                    onStartHere={() => startFrom(pin, pinLabel ?? 'Ponto escolhido no mapa')}
                    onClose={() => setPin(null)}
                  />
                )}
                {communitySelection && (
                  <View style={s.preview}>
                    <View style={ui.between}>
                      <AppText variant="subtitle" style={ui.grow}>
                        Alagamento relatado pela comunidade
                      </AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fechar relato selecionado"
                        onPress={() => setCommunitySelection(null)}
                        style={s.previewClose}
                      >
                        <Icon name="x" size={18} color={c.muted} />
                      </Pressable>
                    </View>
                    {communitySelection.description ? (
                      <AppText variant="small">{communitySelection.description}</AppText>
                    ) : null}
                    <AppText variant="small" tone="muted">
                      Relatado {reportedAgo(communitySelection.createdAt, now)} ·{' '}
                      {communitySelection.confirmationCount}{' '}
                      {communitySelection.confirmationCount === 1
                        ? 'pessoa confirmou'
                        : 'pessoas confirmaram'}
                      . Relato de quem usa o SafeWalk, não verificado pela Prefeitura.
                    </AppText>
                    <Button
                      label="Ir até aqui"
                      icon="navigation"
                      onPress={() =>
                        goTo(communitySelection.location, 'Alagamento relatado pela comunidade')
                      }
                    />
                  </View>
                )}
                {selection && (
                  <View style={s.preview}>
                    <View style={ui.between}>
                      <AppText variant="subtitle" style={ui.grow}>
                        {selection.feature.properties.title}
                      </AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fechar registro selecionado"
                        onPress={() => setSelection(null)}
                        style={s.previewClose}
                      >
                        <Icon name="x" size={18} color={c.muted} />
                      </Pressable>
                    </View>
                    <AppText variant="small">{featureExplanation(selection.feature)}</AppText>
                    <AppText variant="small" tone="muted">
                      {urban.data?.sources.find(
                        (source) => source.id === selection.feature.properties.sourceId,
                      )?.name ?? selection.feature.properties.sourceId}{' '}
                      ·{' '}
                      {readableObservation(
                        selection.feature.properties.observedAt,
                        selection.feature.properties.sourceId,
                      )}
                    </AppText>
                    {selectionPoint && (
                      <Button
                        label="Ir até aqui"
                        icon="navigation"
                        onPress={() =>
                          goTo(
                            { longitude: selectionPoint[0], latitude: selectionPoint[1] },
                            selection.feature.properties.title,
                          )
                        }
                      />
                    )}
                    <Button
                      label="Ver detalhes do registro"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: '/dado-urbano/[id]',
                          params: {
                            id: selection.feature.id,
                            type: selection.feature.properties.type,
                            // Small area around the record: a city-wide area would reload the
                            // whole city just to show one item.
                            bbox: (selectionPoint
                              ? [
                                  selectionPoint[0] - 0.004,
                                  selectionPoint[1] - 0.004,
                                  selectionPoint[0] + 0.004,
                                  selectionPoint[1] + 0.004,
                                ]
                              : selection.bbox
                            ).join(','),
                          },
                        })
                      }
                    />
                  </View>
                )}
                {!pin && !selection && !communitySelection && nearby.length > 0 && (
                  <NearbyHelpCard places={nearby} fromDevice={Boolean(position)} onGo={goTo} />
                )}
                <AppText variant="label">O que significam os ícones</AppText>
                <MapIconLegend />
                <AppText variant="small" tone="muted">
                  Toque em um ícone para ver o registro; números juntam registros próximos e
                  aproximam o mapa. Toque e segure (ou clique com o botão direito) em qualquer ponto
                  para ir até lá. Os ícones indicam categorias, não o nível de risco. Semáforos da
                  capital vêm da Prefeitura (CET) e os das cidades vizinhas do OpenStreetMap
                  (colaborativo), sem informação de funcionamento ao vivo.
                </AppText>
                {cityView && (
                  <AppText variant="small" tone="muted">
                    Visão da cidade: aparecem semáforos, solicitações e onde já alagou. Aproxime o
                    mapa para ver as áreas que podem alagar, os relatos da comunidade, calçadas e
                    iluminação.
                  </AppText>
                )}
                {showFloods && (
                  <AppText variant="small" tone="muted">
                    {raining
                      ? 'Está chovendo na região, segundo o modelo meteorológico: os alagamentos foram ligados e as áreas que podem alagar aparecem em destaque. '
                      : ''}
                    Pontos azuis: onde já alagou (Defesa Civil) e relatos da comunidade. Áreas
                    azuis: podem alagar segundo o modelo da Prefeitura
                    {activeLayers.includes('flood_susceptibility') ? ' e a carta do SGB' : ''}. Nada
                    disso confirma alagamento agora.
                  </AppText>
                )}
                <AppText style={s.summary}>
                  {position
                    ? `Localização autorizada · precisão de ${Math.round(position.accuracyMeters)} m.`
                    : approximatePosition
                      ? `Localização aproximada · precisão de ${Math.round(approximatePosition.accuracyMeters)} m. Confira a origem no mapa antes de calcular a rota.`
                      : gps.enabled
                        ? 'Aguardando a localização do aparelho.'
                        : 'Área do mapa. Sua localização não está ativada.'}{' '}
                  O SafeWalk mostra registros públicos; não avalia nem garante a segurança ou a
                  acessibilidade de um caminho.
                </AppText>
                <ErrorNotice error={gps.error ?? urban.error} />
                {urban.isPending && <ActivityIndicator color={c.primary} />}
                {urban.isError && (
                  <Button
                    label="Tentar carregar dados"
                    variant="secondary"
                    onPress={() => {
                      void urban.refetch();
                    }}
                  />
                )}
                {urban.data?.sources
                  .filter((source) => source.status !== 'available')
                  .map((source) => (
                    <AppText key={source.id} variant="small" tone="muted">
                      {source.name}:{' '}
                      {source.status === 'stale'
                        ? 'última cópia desatualizada'
                        : source.status === 'not_configured'
                          ? 'importação pendente'
                          : 'origem indisponível'}
                      . Consulte os detalhes da fonte.
                    </AppText>
                  ))}
                {flood && (
                  <AppText variant="small" tone="muted">
                    CGE{floodSource?.status !== 'available' ? ' · leitura desatualizada' : ''} ·{' '}
                    {countLabel(
                      activeFloods ?? 0,
                      'ponto ativo informado',
                      'pontos ativos informados',
                    )}{' '}
                    em São Paulo em {flood.date.split('-').reverse().join('/')}. Cobertura parcial;
                    não comprova passagem segura para pedestres. Leitura:{' '}
                    {readableDate(floodSource?.fetchedAt)}.
                  </AppText>
                )}
                {urban.data?.weather && (
                  <AppText variant="small" tone="muted">
                    Chuva estimada:{' '}
                    {urban.data.weather.precipitationMillimeters.toLocaleString('pt-BR')} mm /{' '}
                    {Math.round(urban.data.weather.intervalSeconds / 60)} min · modelo Open-Meteo
                    {weatherSource?.status !== 'available' ? ' · leitura desatualizada' : ''}. Não
                    detecta alagamentos. Referência: {readableDate(urban.data.weather.observedAt)}.
                  </AppText>
                )}
                <View style={s.sectionRow}>
                  <AppText variant="subtitle">Na área do mapa</AppText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/dados-urbanos', params: { bbox: bbox.join(',') } })
                    }
                  >
                    <AppText tone="primary" variant="label">
                      Ver dados
                    </AppText>
                  </Pressable>
                </View>
                {features.slice(0, 3).map((feature) => (
                  <Pressable
                    key={feature.id}
                    accessibilityRole="button"
                    style={s.incident}
                    onPress={() =>
                      router.push({
                        pathname: '/dado-urbano/[id]',
                        params: {
                          id: feature.id,
                          type: feature.properties.type,
                          bbox: bbox.join(','),
                        },
                      })
                    }
                  >
                    <View style={s.incidentIcon}>
                      <Icon
                        name={
                          feature.properties.category === 'flood'
                            ? 'cloud-rain'
                            : feature.properties.category === 'lighting'
                              ? 'sun'
                              : 'map-pin'
                        }
                        color={c.primaryText}
                        size={19}
                      />
                    </View>
                    <View style={s.incidentBody}>
                      <AppText numberOfLines={1} style={s.incidentTitle}>
                        {feature.properties.title}
                      </AppText>
                      <AppText numberOfLines={1} style={s.incidentMeta}>
                        {featureSubtitle(feature)}
                      </AppText>
                      <AppText numberOfLines={1} style={s.incidentMeta}>
                        {readableObservation(
                          feature.properties.observedAt,
                          feature.properties.sourceId,
                        )}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" color={c.muted} size={16} />
                  </Pressable>
                ))}
                {!urban.isPending && !urban.isError && features.length === 0 && (
                  <AppText variant="small" tone="muted">
                    Nenhum registro nas camadas selecionadas nesta consulta. Ausência de dados não
                    indica ausência de problemas.
                  </AppText>
                )}
                {urban.data?.truncated && (
                  <AppText variant="small" tone="muted">
                    Nesta área as fontes enviaram uma amostra parcial (até 1.000 solicitações por
                    consulta). Aproxime o mapa para carregar mais registros; os já vistos continuam
                    no mapa.
                  </AppText>
                )}
              </>
            )}
            <Pressable
              accessibilityRole="button"
              style={s.sourcesLink}
              onPress={() => router.push('/fontes-dados')}
            >
              <AppText variant="label" tone="primary">
                Fontes, datas e limitações
              </AppText>
            </Pressable>
          </View>
        </CollapsibleSheet>
      </Screen>
    </Protected>
  );
}
