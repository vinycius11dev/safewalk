import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { Coordinates, GeocodingPlace, SavedPlace, SavedPlaceKind } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useGeoLocation } from '@/features/location/location-provider';
import { FavoritePlacesSection } from '@/features/places/favorite-places-section';
import { favoriteBubbleStyles } from '@/features/places/favorite-places-section.styles';
import {
  FAVORITE_LIMIT,
  favoriteAt,
  favoriteInput,
  favoriteKindIcons,
  favoriteKindLabels,
  favoriteShortcuts,
  parseFavoriteKind,
} from '@/features/places/favorite-places';
import { useCreatePlace, useSavedPlaces, useUpdatePlace } from '@/features/places/use-places';
import { RecentDestinationsSection } from '@/features/places/recent-destinations-section';
import {
  useClearRecentDestinations,
  useForgetDestination,
  useRecentDestinations,
  useRememberDestination,
} from '@/features/places/use-recent-destinations';
import { useTheme } from '@/theme/theme-provider';
import { useClock } from '@/hooks/use-clock';
import { useAddressSearch, useMapConsent, useReverseAddress } from './use-map-data';
import { useMapJourney } from './use-map-journey';
import { createRealSearchStyles } from './real-search-screen.styles';
import { uniqueGeocodingPlaces } from './geocoding-results';
import { SearchRouteCard, type RouteEndpoint } from './search-route-card';
import { isSamePlace, SAME_PLACE_MESSAGE } from './same-place';
import { MapConsentPrompt } from './map-consent-prompt';

const SAME_AS_DESTINATION_MESSAGE =
  'Esse é o mesmo lugar do destino: você já estaria lá. Escolha outro ponto de saída ou outro destino.';

function savingTitle(kind: SavedPlaceKind, editing: SavedPlace | undefined) {
  if (kind === 'other') return editing ? `Alterar ${editing.label}` : 'Novo favorito';
  return `${editing ? 'Alterar' : 'Adicionar'} ${favoriteKindLabels[kind]}`;
}

export function RealSearchScreen() {
  const { modo, salvar, id } = useLocalSearchParams<{
    modo?: string;
    salvar?: string;
    id?: string;
  }>();
  const savingKind = parseFavoriteKind(salvar);
  const choosingOrigin = !savingKind && modo === 'origem';
  const saved = useSavedPlaces();
  const createFavorite = useCreatePlace();
  const updateFavorite = useUpdatePlace();
  const savedPlaces = useMemo(() => saved.data ?? [], [saved.data]);
  const shortcuts = useMemo(() => favoriteShortcuts(savedPlaces), [savedPlaces]);
  const editingFavorite = savingKind
    ? (savedPlaces.find((place) => place.id === id) ??
      (savingKind === 'other' ? undefined : (shortcuts[savingKind] ?? undefined)))
    : undefined;
  const favoritesFull = savedPlaces.length >= FAVORITE_LIMIT;
  const favoriteBusy = createFavorite.isPending || updateFavorite.isPending;
  const recents = useRecentDestinations();
  const rememberDestination = useRememberDestination();
  const forgetDestination = useForgetDestination();
  const clearRecents = useClearRecentDestinations();
  const [search, setSearch] = useState('');
  const [gpsRequest, setGpsRequest] = useState(0);
  const completedGpsRequest = useRef(0);
  const consent = useMapConsent();
  const results = useAddressSearch(search);
  const places = useMemo(() => uniqueGeocodingPlaces(results.data?.places ?? []), [results.data]);
  const { journey, update } = useMapJourney();
  const geo = useGeoLocation();
  const gps = useMutation({ mutationFn: () => geo.start() });
  const { colors } = useTheme();
  const s = useMemo(() => createRealSearchStyles(colors), [colors]);
  const now = useClock(5000);
  const position =
    consent.data?.enabled &&
    geo.enabled &&
    geo.position &&
    geo.position.accuracyMeters <= 150 &&
    now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const freshLocation =
    geo.enabled && geo.position && now - Date.parse(geo.position.recordedAt) < 60000
      ? geo.position
      : null;
  const storedOriginNeedsAddress =
    journey.originConfirmed && journey.originLabel === 'Sua localização · GPS do aparelho';
  const needsCurrentAddress = Boolean(
    gpsRequest > 0 &&
    freshLocation &&
    (choosingOrigin ||
      savingKind ||
      storedOriginNeedsAddress ||
      !journey.originConfirmed ||
      journey.origin.latitude !== freshLocation.latitude ||
      journey.origin.longitude !== freshLocation.longitude),
  );
  const reversePoint = needsCurrentAddress
    ? freshLocation
    : storedOriginNeedsAddress
      ? journey.origin
      : null;
  const reverseAddress = useReverseAddress(reversePoint);
  const resolvedAddress =
    reverseAddress.data?.places[0]?.address || reverseAddress.data?.places[0]?.name || null;
  const searching = search.trim().length > 0;
  // Onde você está: endereço aproximado do GPS (grade de ~50 m, para não consultar a cada passo).
  const hereAddressQuery = useReverseAddress(
    position
      ? {
          latitude: Math.round(position.latitude * 2000) / 2000,
          longitude: Math.round(position.longitude * 2000) / 2000,
        }
      : null,
  );
  const hereAddress =
    hereAddressQuery.data?.places[0]?.address || hereAddressQuery.data?.places[0]?.name || null;
  // Como no Waze: sem origem escolhida e com GPS preciso, você sai de onde está.
  const gpsOrigin = !journey.originConfirmed && position ? position : null;
  const effectiveOrigin = journey.originConfirmed ? journey.origin : gpsOrigin;
  const [notice, setNotice] = useState<string | null>(null);
  function changeSearch(text: string) {
    setSearch(text);
    setNotice(null);
  }
  /** Devolve true quando o ponto foi aceito como destino (para guardá-lo nos recentes). */
  function chooseLocation(location: Coordinates, label: string): boolean {
    if (choosingOrigin) {
      if (isSamePlace(journey.destination, location)) {
        setNotice(SAME_AS_DESTINATION_MESSAGE);
        return false;
      }
      setNotice(null);
      update({ origin: location, originLabel: label, selectedRoute: null });
      router.replace(journey.destination ? '/rotas' : '/buscar');
      return false;
    } else {
      if (isSamePlace(effectiveOrigin, location)) {
        setNotice(SAME_PLACE_MESSAGE);
        return false;
      }
      setNotice(null);
      update({
        ...(gpsOrigin
          ? {
              origin: { latitude: gpsOrigin.latitude, longitude: gpsOrigin.longitude },
              originLabel: hereAddress ?? 'Sua localização · GPS do aparelho',
            }
          : {}),
        destination: location,
        destinationLabel: label,
        selectedRoute: null,
      });
      if (journey.originConfirmed || gpsOrigin) router.push('/rotas');
      else router.push({ pathname: '/buscar', params: { modo: 'origem' } });
      return true;
    }
  }
  /** Escolhe o destino e o guarda no banco local do aparelho. */
  function chooseAndRemember(location: Coordinates, label: string) {
    if (chooseLocation(location, label)) rememberDestination.mutate({ label, location });
  }
  function leaveSaving() {
    if (router.canGoBack()) router.back();
    else router.replace('/buscar');
  }
  function saveFavorite(
    kind: SavedPlaceKind,
    name: string,
    address: string,
    location: Coordinates,
    afterSave?: () => void,
  ) {
    const existing = kind === savingKind ? editingFavorite : undefined;
    const input = favoriteInput(kind, name, address, location, existing?.label);
    const options = { onSuccess: afterSave };
    if (existing) updateFavorite.mutate({ id: existing.id, place: input }, options);
    else createFavorite.mutate(input, options);
  }
  function selectPlace(place: GeocodingPlace) {
    if (savingKind)
      saveFavorite(savingKind, place.name, place.address, place.location, leaveSaving);
    else chooseAndRemember(place.location, place.address || place.name);
  }
  function editFavorite(kind: SavedPlaceKind, place?: SavedPlace) {
    router.push({
      pathname: '/buscar',
      params: place ? { salvar: kind, id: place.id } : { salvar: kind },
    });
  }
  useEffect(() => {
    if (
      choosingOrigin ||
      savingKind ||
      completedGpsRequest.current === gpsRequest ||
      !position ||
      reverseAddress.isPending ||
      reverseAddress.isFetching
    )
      return;
    completedGpsRequest.current = gpsRequest;
    update({
      origin: { latitude: position.latitude, longitude: position.longitude },
      originLabel: resolvedAddress ?? 'Sua localização · GPS do aparelho',
      selectedRoute: null,
    });
  }, [
    gpsRequest,
    position,
    update,
    choosingOrigin,
    savingKind,
    reverseAddress.isPending,
    reverseAddress.isFetching,
    resolvedAddress,
  ]);
  function useDeviceOrigin() {
    setNotice(null);
    setGpsRequest((request) => request + 1);
    if (!position) gps.mutate();
  }
  function confirmCurrentOrigin() {
    if (!position || position.accuracyMeters > 150 || reverseAddress.isFetching) return;
    if (savingKind) {
      const point = { latitude: position.latitude, longitude: position.longitude };
      const name = reverseAddress.data?.places[0]?.name ?? 'Local marcado pelo GPS';
      saveFavorite(savingKind, name, resolvedAddress ?? '', point, leaveSaving);
      return;
    }
    if (isSamePlace(journey.destination, position)) {
      setNotice(SAME_PLACE_MESSAGE);
      return;
    }
    completedGpsRequest.current = gpsRequest;
    update({
      origin: { latitude: position.latitude, longitude: position.longitude },
      originLabel: resolvedAddress ?? 'Localização atual do GPS',
      selectedRoute: null,
    });
    router.replace(journey.destination ? '/rotas' : '/buscar');
  }
  const toOriginSearch = () => router.push({ pathname: '/buscar', params: { modo: 'origem' } });
  // A saída escolhida fica onde o GPS está agora: mostra "Você está aqui".
  const originIsHere =
    journey.originConfirmed && (storedOriginNeedsAddress || isSamePlace(journey.origin, position));
  const fromEndpoint: RouteEndpoint = journey.originConfirmed
    ? {
        label: storedOriginNeedsAddress && resolvedAddress ? resolvedAddress : journey.originLabel,
        hint: storedOriginNeedsAddress
          ? resolvedAddress
            ? undefined
            : reverseAddress.isFetching
              ? 'Buscando o nome da rua…'
              : 'Saída marcada pelo GPS. Confira a rua antes de sair.'
          : undefined,
        here: originIsHere,
        actionLabel: 'Toque para sair de outro lugar.',
        onPress: toOriginSearch,
      }
    : gpsOrigin
      ? {
          label: 'Sua localização',
          hint: hereAddress
            ? `Perto de ${hereAddress}`
            : hereAddressQuery.isFetching
              ? 'Buscando o nome da rua…'
              : `GPS com precisão de ${Math.round(gpsOrigin.accuracyMeters)} m`,
          here: true,
          actionLabel: 'Toque para sair de outro lugar.',
          onPress: toOriginSearch,
        }
      : {
          label: 'Escolha a saída',
          hint: 'Use sua localização (abaixo) ou digite um endereço.',
          empty: true,
          actionLabel: 'Toque para escolher a saída.',
          onPress: toOriginSearch,
        };
  const toEndpoint: RouteEndpoint = journey.destination
    ? {
        label: journey.destinationLabel || 'Destino escolhido',
        actionLabel: 'Toque para trocar o destino.',
        onPress: () => router.replace('/buscar'),
      }
    : {
        label: 'Escolha para onde vai',
        hint: 'Você escolhe o destino depois da saída.',
        empty: true,
        actionLabel: 'Toque para escolher o destino.',
        onPress: () => router.replace('/buscar'),
      };
  const gpsTitle = savingKind
    ? 'Usar minha localização atual'
    : !choosingOrigin && (gpsOrigin || originIsHere)
      ? 'Saindo da sua localização'
      : 'Sair da minha localização';
  const gpsHint =
    geo.enabled && !position
      ? geo.position && now - Date.parse(geo.position.recordedAt) < 60000
        ? `Precisão de ${Math.round(geo.position.accuracyMeters)} m. Aguardando sinal melhor ou digite o endereço.`
        : 'Aguardando uma posição recente com precisão de até 150 metros.'
      : position
        ? hereAddress
          ? `Você está perto de ${hereAddress} · precisão de ${Math.round(position.accuracyMeters)} m`
          : `GPS ativo · precisão de ${Math.round(position.accuracyMeters)} m`
        : 'O GPS do aparelho só é usado quando você toca aqui.';
  return (
    <Protected>
      <Screen
        title={
          savingKind
            ? savingTitle(savingKind, editingFavorite)
            : choosingOrigin
              ? 'De onde você vai sair?'
              : 'Para onde você vai?'
        }
      >
        {savingKind && (
          <View style={s.savingIntro}>
            <View style={favoriteBubbleStyles[savingKind]}>
              <Icon name={favoriteKindIcons[savingKind]} size={19} color={colors.white} />
            </View>
            <View style={s.savingBody}>
              <AppText tone="muted">
                {savingKind === 'other'
                  ? 'Busque o lugar que você quer salvar ou use sua localização atual.'
                  : `Busque o endereço de ${favoriteKindLabels[savingKind]} ou use sua localização atual.`}
              </AppText>
              {editingFavorite && (
                <AppText variant="small" tone="muted" numberOfLines={2}>
                  Endereço atual: {editingFavorite.address}
                </AppText>
              )}
            </View>
          </View>
        )}
        {consent.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={consent.error} />
        {!consent.data?.enabled ? (
          <Card>
            <MapConsentPrompt
              title="Ative o mapa para buscar endereços"
              actionLabel="Ativar o mapa e buscar"
            />
          </Card>
        ) : (
          <>
            <SearchRouteCard
              active={savingKind ? 'single' : choosingOrigin ? 'from' : 'to'}
              from={fromEndpoint}
              to={toEndpoint}
              notice={notice}
              inputLabel={
                savingKind
                  ? 'Endereço do favorito'
                  : choosingOrigin
                    ? 'Endereço de origem'
                    : 'Destino'
              }
              placeholder={choosingOrigin ? 'Endereço ou lugar de saída' : 'Endereço ou lugar'}
              value={search}
              onChangeText={changeSearch}
              autoFocus={!choosingOrigin}
              gps={{
                title: gpsTitle,
                hint: gpsHint,
                loading: gps.isPending,
                onPress: useDeviceOrigin,
              }}
            />
            {(choosingOrigin || savingKind) && freshLocation && gpsRequest > 0 && (
              <Card>
                <View style={s.currentLocationHeader}>
                  <Icon name="navigation" color={colors.primaryText} />
                  <AppText variant="subtitle">Você está aqui</AppText>
                </View>
                <AppText variant="label">
                  {reverseAddress.isFetching
                    ? 'Localizando o endereço…'
                    : (resolvedAddress ?? 'Endereço não encontrado perto deste ponto')}
                </AppText>
                <AppText variant="small" tone="muted">
                  GPS com precisão de aproximadamente {Math.round(freshLocation.accuracyMeters)} m.
                  {freshLocation.accuracyMeters > 150
                    ? ' O sinal está impreciso; aguarde uma posição melhor.'
                    : ' O endereço é uma referência aproximada do GPS.'}
                </AppText>
                <Button
                  label={
                    savingKind
                      ? savingKind === 'other'
                        ? 'Salvar este local nos favoritos'
                        : `Salvar este local como ${favoriteKindLabels[savingKind]}`
                      : 'Usar este local como origem'
                  }
                  icon={savingKind ? 'star' : 'navigation'}
                  loading={favoriteBusy}
                  disabled={freshLocation.accuracyMeters > 150 || reverseAddress.isFetching}
                  onPress={confirmCurrentOrigin}
                />
              </Card>
            )}
            <ErrorNotice error={gps.error ?? geo.error} />
            <ErrorNotice error={createFavorite.error ?? updateFavorite.error} />
            {savingKind === 'other' && !editingFavorite && favoritesFull && (
              <AppText tone="danger">
                Você já tem {FAVORITE_LIMIT} locais salvos. Exclua um em Gerenciar para adicionar
                outro.
              </AppText>
            )}
            {!savingKind && !searching && (
              <FavoritePlacesSection
                places={saved.data}
                loading={saved.isPending}
                error={saved.error}
                verb={choosingOrigin ? 'Sair de' : 'Ir para'}
                onSelect={(place: SavedPlace) =>
                  chooseLocation(place.location, `${place.label} · ${place.address}`)
                }
                onEdit={editFavorite}
                onManage={() => router.push('/locais-salvos')}
              />
            )}
            {!savingKind && !searching && (
              <>
                <RecentDestinationsSection
                  places={recents.data ?? []}
                  verb={choosingOrigin ? 'Sair de' : 'Ir para'}
                  onSelect={(place) => chooseAndRemember(place.location, place.label)}
                  onRemove={(place) => forgetDestination.mutate(place.key)}
                  onClear={() => clearRecents.mutate()}
                />
                <ErrorNotice
                  error={
                    recents.error ??
                    rememberDestination.error ??
                    forgetDestination.error ??
                    clearRecents.error
                  }
                />
              </>
            )}
            {(savingKind || searching) && (
              <View style={s.searchSection}>
                <Text style={s.sectionTitle} accessibilityRole="header">
                  Resultados
                </Text>
                {results.isFetching && <ActivityIndicator color={colors.primary} />}
                <ErrorNotice error={results.error} />
                {results.isError && (
                  <Button
                    label="Tentar busca novamente"
                    variant="secondary"
                    onPress={() => {
                      void results.refetch();
                    }}
                  />
                )}
                {search.trim().length < 3 && (
                  <AppText tone="muted">
                    Digite pelo menos três letras: rua e número, bairro ou nome do lugar.
                  </AppText>
                )}
                {search.trim().length >= 3 && places.length > 0 && (
                  <View style={s.resultList}>
                    {places.map((place, index) => {
                      const savedHere = favoriteAt(savedPlaces, place.location);
                      const starring =
                        createFavorite.isPending &&
                        createFavorite.variables?.location === place.location;
                      return (
                        <View key={place.id}>
                          {index > 0 && <View style={s.resultDivider} />}
                          <View style={s.resultRow}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={
                                savingKind
                                  ? `Salvar ${place.name}, ${place.address}`
                                  : `Selecionar ${place.name}, ${place.address}`
                              }
                              disabled={favoriteBusy}
                              style={({ pressed }) => [s.resultMain, pressed && s.resultPressed]}
                              onPress={() => selectPlace(place)}
                            >
                              <View
                                style={
                                  savedHere ? favoriteBubbleStyles[savedHere.kind] : s.resultIcon
                                }
                              >
                                <Icon
                                  name={savedHere ? favoriteKindIcons[savedHere.kind] : 'map-pin'}
                                  size={18}
                                  color={savedHere ? colors.white : colors.primaryText}
                                />
                              </View>
                              <View style={s.resultBody}>
                                <Text style={s.resultName} numberOfLines={1}>
                                  {place.name}
                                </Text>
                                <Text style={s.resultAddress} numberOfLines={2}>
                                  {['municipality', 'city', 'town'].includes(place.category ?? '')
                                    ? 'Município · '
                                    : ''}
                                  {place.address}
                                </Text>
                                {savedHere && (
                                  <Text style={s.resultSaved}>Salvo como {savedHere.label}</Text>
                                )}
                              </View>
                            </Pressable>
                            {savingKind ? (
                              <View style={s.favoriteToggle}>
                                <Icon name="chevron-right" size={18} color={colors.muted} />
                              </View>
                            ) : (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={
                                  savedHere
                                    ? `${place.name} já está nos favoritos como ${savedHere.label}`
                                    : favoritesFull
                                      ? `Limite de ${FAVORITE_LIMIT} favoritos atingido`
                                      : `Salvar ${place.name} nos favoritos`
                                }
                                accessibilityState={{
                                  selected: Boolean(savedHere),
                                  disabled: Boolean(savedHere) || favoritesFull || favoriteBusy,
                                  busy: starring,
                                }}
                                disabled={Boolean(savedHere) || favoritesFull || favoriteBusy}
                                style={({ pressed }) => [
                                  s.favoriteToggle,
                                  pressed && s.resultPressed,
                                ]}
                                onPress={() =>
                                  saveFavorite('other', place.name, place.address, place.location)
                                }
                              >
                                {starring ? (
                                  <ActivityIndicator color={colors.primary} />
                                ) : (
                                  <Icon
                                    name="star"
                                    color={savedHere ? colors.warning : colors.muted}
                                  />
                                )}
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {search.trim().length >= 3 && results.data?.status === 'empty' && (
                  <AppText tone="muted">
                    Nenhum resultado encontrado. Digite a rua, número e cidade. Para um município,
                    use o nome completo, por exemplo: Embu das Artes.
                  </AppText>
                )}
                {places.length > 0 && results.data ? (
                  <AppText variant="small" tone="muted">
                    {results.data.notice}
                  </AppText>
                ) : null}
              </View>
            )}
            {!choosingOrigin && !savingKind && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Escolher destino no mapa"
                style={({ pressed }) => [s.mapRow, pressed && s.resultPressed]}
                onPress={() => router.push('/destino')}
              >
                <View style={favoriteBubbleStyles.map}>
                  <Icon name="map" size={18} color={colors.white} />
                </View>
                <View style={s.resultBody}>
                  <Text style={s.resultName}>Escolher no mapa</Text>
                  <Text style={s.resultAddress}>Toque no ponto exato do destino</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            )}
            <AppText variant="small" tone="muted" style={s.footnote}>
              Busca em endereços reais da região de São Paulo.
            </AppText>
          </>
        )}
      </Screen>
    </Protected>
  );
}
