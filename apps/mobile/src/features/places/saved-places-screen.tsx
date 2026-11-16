import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { SavedPlaceKind } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useMapConsent, useAddressSearch } from '@/features/maps/use-map-data';
import { useMapJourney } from '@/features/maps/use-map-journey';
import { useCreatePlace, useDeletePlace, useSavedPlaces } from './use-places';
import { createPlacesStyles } from './places.styles';
import {
  favoriteKindIcons as kindIcons,
  favoriteKindLabels as kindLabels,
} from './favorite-places';

export function SavedPlacesScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createPlacesStyles(colors), [colors]);
  const places = useSavedPlaces();
  const create = useCreatePlace();
  const remove = useDeletePlace();
  const consent = useMapConsent();
  const { journey } = useMapJourney();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SavedPlaceKind>('home');
  const [label, setLabel] = useState('');
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const results = useAddressSearch(search);
  const missingKind = places.data?.some((place) => place.kind === kind) && kind !== 'other';
  function chooseAddress(name: string, fullAddress: string, point: typeof location) {
    setAddress(fullAddress || name);
    setLocation(point);
    setSearch('');
    if (!label) setLabel(name.slice(0, 60));
  }
  function useCurrentDestination() {
    if (!journey.destination) return;
    setLocation(journey.destination);
    setAddress(journey.destinationLabel || 'Destino atual');
    if (!label) setLabel(journey.destinationLabel.slice(0, 60));
  }
  function submit() {
    if (!location || label.trim().length < 2 || address.trim().length < 3) return;
    create.mutate(
      {
        kind,
        label: label.trim(),
        address: address.trim(),
        location,
      },
      {
        onSuccess: () => {
          setAdding(false);
          setLabel('');
          setAddress('');
          setLocation(null);
          setKind('home');
        },
      },
    );
  }
  return (
    <Protected>
      <Screen title="Locais salvos">
        <AppText tone="muted">
          Salve destinos frequentes para iniciar uma caminhada em poucos toques. Os endereços ficam
          na sua conta e aparecem na tela inicial.
        </AppText>
        <ErrorNotice error={places.error ?? create.error ?? remove.error} />
        {places.isPending && <ActivityIndicator color={colors.primary} />}
        {places.data?.map((place) => (
          <View key={place.id} style={s.placeRow}>
            <View style={s.placeIcon}>
              <Icon name={kindIcons[place.kind]} color={colors.primaryText} />
            </View>
            <View style={s.placeBody}>
              <AppText variant="subtitle">{place.label}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={2}>
                {place.address}
              </AppText>
            </View>
            <Badge label={kindLabels[place.kind]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Alterar endereço de ${place.label}`}
              style={s.rowAction}
              onPress={() =>
                router.push({ pathname: '/buscar', params: { salvar: place.kind, id: place.id } })
              }
            >
              <Icon name="edit-2" color={colors.primaryText} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Excluir ${place.label}`}
              disabled={remove.isPending}
              style={s.rowAction}
              onPress={() => remove.mutate(place.id)}
            >
              <Icon name="trash-2" color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {places.data && places.data.length === 0 && (
          <AppText variant="small" tone="muted">
            Nenhum local salvo ainda. Cadastre Casa, Trabalho ou outro destino frequente.
          </AppText>
        )}
        {!adding ? (
          <Button
            label="Adicionar local"
            icon="plus"
            disabled={Boolean(places.data && places.data.length >= 6)}
            onPress={() => setAdding(true)}
          />
        ) : (
          <Card>
            <View style={s.form}>
              <AppText variant="subtitle">Novo local</AppText>
              <View style={s.choiceRow}>
                {(Object.keys(kindLabels) as SavedPlaceKind[]).map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: kind === option }}
                    aria-checked={kind === option}
                    style={[s.choice, kind === option && s.optionSelected]}
                    onPress={() => setKind(option)}
                  >
                    <Icon name={kindIcons[option]} color={colors.primaryText} />
                    <AppText variant="small">{kindLabels[option]}</AppText>
                  </Pressable>
                ))}
              </View>
              {missingKind && (
                <AppText variant="small" tone="danger">
                  Você já tem um local do tipo {kindLabels[kind]}. Exclua o existente para cadastrar
                  outro.
                </AppText>
              )}
              <Field
                label="Nome do local"
                value={label}
                onChangeText={setLabel}
                placeholder="Ex.: Casa, Academia"
                maxLength={60}
              />
              {location ? (
                <>
                  <AppText variant="small">Endereço escolhido</AppText>
                  <AppText variant="small" tone="muted">
                    {address}
                  </AppText>
                  <Button
                    label="Escolher outro endereço"
                    variant="ghost"
                    onPress={() => setLocation(null)}
                  />
                </>
              ) : consent.data?.enabled ? (
                <>
                  <Field
                    label="Buscar endereço"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Rua, número ou ponto de referência"
                  />
                  {results.isFetching && <ActivityIndicator color={colors.primary} />}
                  <ErrorNotice error={results.error} />
                  {results.data?.places.map((place) => (
                    <Pressable
                      key={place.id}
                      accessibilityRole="button"
                      style={s.resultRow}
                      onPress={() => chooseAddress(place.name, place.address, place.location)}
                    >
                      <AppText variant="label">{place.name}</AppText>
                      <AppText variant="small" tone="muted" numberOfLines={2}>
                        {place.address}
                      </AppText>
                    </Pressable>
                  ))}
                  {results.data && results.data.status === 'empty' && (
                    <AppText variant="small" tone="muted">
                      Nenhum endereço encontrado para essa busca.
                    </AppText>
                  )}
                  {journey.destination && (
                    <Button
                      label="Salvar destino atual"
                      variant="secondary"
                      icon="map-pin"
                      onPress={useCurrentDestination}
                    />
                  )}
                </>
              ) : (
                <>
                  <AppText variant="small" tone="muted">
                    A busca de endereços usa os serviços externos do mapa.
                  </AppText>
                  <Button
                    label="Revisar serviços do mapa"
                    variant="secondary"
                    onPress={() => router.push('/servicos-mapa')}
                  />
                  {journey.destination && (
                    <Button
                      label="Salvar destino atual"
                      variant="secondary"
                      icon="map-pin"
                      onPress={useCurrentDestination}
                    />
                  )}
                </>
              )}
              <Button
                label="Salvar local"
                disabled={
                  !location ||
                  label.trim().length < 2 ||
                  address.trim().length < 3 ||
                  Boolean(missingKind)
                }
                loading={create.isPending}
                onPress={submit}
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
            </View>
          </Card>
        )}
      </Screen>
    </Protected>
  );
}
