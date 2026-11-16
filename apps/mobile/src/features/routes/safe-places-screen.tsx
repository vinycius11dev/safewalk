import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, Icon } from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { useTrips } from '@/features/trips/use-trips';
import { tripTarget } from '@/features/trips/trip-navigation';
import { createSafePlacesStyles } from './safe-places.styles';

const places = [
  {
    name: 'Farmácia 24 h',
    address: 'R. Augusta, 1150',
    detail: 'Câmera Smart Sampa ilustrativa',
    distance: '80 m',
    hours: '24 horas',
  },
  {
    name: 'Padaria',
    address: 'R. Frei Caneca, 380',
    detail: 'Estabelecimento com movimento',
    distance: '210 m',
    hours: 'Até 23h · exemplo',
  },
  {
    name: 'Posto de combustível',
    address: 'R. Caio Prado',
    detail: 'Área de atendimento ao público',
    distance: '260 m',
    hours: '24 horas',
  },
  {
    name: 'Estação Consolação',
    address: 'Av. Paulista',
    detail: 'Equipe de segurança do Metrô',
    distance: '400 m',
    hours: 'Consultar horário real',
  },
];

export function SafePlacesScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const trips = useTrips();
  const activeTrip = trips.data?.find(
    (trip) => trip.id === id || !['arrived', 'cancelled'].includes(trip.status),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const { colors } = useTheme();
  const s = useMemo(() => createSafePlacesStyles(colors), [colors]);
  const positions = [s.pinOne, s.pinTwo, s.pinThree, s.pinFour];
  const selectedPlace = selected === null ? null : places[selected];
  return (
    <Protected>
      <Screen title="Pontos seguros por perto">
        <View style={s.map}>
          <MapScene variant="trip" adaptive={false} />
          {places.map((place, index) => (
            <Pressable
              key={place.name}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${place.name} no mapa ilustrativo`}
              style={[s.marker, positions[index], index === selected && s.selectedMarker]}
              onPress={() => setSelected(index)}
            >
              <AppText style={s.markerText}>{index + 1}</AppText>
            </Pressable>
          ))}
        </View>
        <AppText tone="muted">
          Lugares para entrar se você se sentir em risco. Toque para destacar um ponto no mapa.
        </AppText>
        <Badge label="Locais, horários e distâncias ilustrativos" />
        {places.map((place, index) => (
          <Pressable
            key={place.name}
            accessibilityRole="button"
            accessibilityState={{ selected: index === selected }}
            onPress={() => setSelected(index)}
            style={[s.row, selected === index && s.selectedRow]}
          >
            <View style={s.number}>
              <AppText tone="success" variant="label">
                {index + 1}
              </AppText>
            </View>
            <View style={s.body}>
              <AppText variant="subtitle">{place.name}</AppText>
              <AppText style={s.meta}>{place.address}</AppText>
              <AppText style={s.meta}>{place.detail}</AppText>
            </View>
            <AppText tone="primary" variant="label">
              {place.distance}
            </AppText>
          </Pressable>
        ))}
        {selectedPlace && (
          <Card>
            <Icon name="map-pin" color={colors.success} />
            <AppText variant="heading">{selectedPlace.name}</AppText>
            <AppText>{selectedPlace.address}</AppText>
            <Badge label={selectedPlace.hours} tone="success" />
            <AppText variant="small" tone="muted">
              Este local ainda não foi verificado como parceiro. A disponibilidade e o caminho
              precisam ser conferidos em um serviço de mapas real.
            </AppText>
          </Card>
        )}
        <Button
          label={activeTrip ? 'Voltar ao trajeto' : 'Voltar ao mapa'}
          onPress={() =>
            activeTrip ? router.replace(tripTarget(activeTrip)) : router.replace('/inicio')
          }
        />
      </Screen>
    </Protected>
  );
}
