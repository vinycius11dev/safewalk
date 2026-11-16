import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Field, Icon, useUiStyles } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createRouteStyles } from './routes.styles';

const places = [
  { name: 'Casa', address: 'R. Frei Caneca · Consolação', icon: 'home' as const },
  {
    name: 'Shopping Frei Caneca',
    address: 'R. Frei Caneca, 569 · Consolação',
    icon: 'shopping-bag' as const,
  },
  { name: 'R. Frei Caneca, 1100', address: 'Bela Vista · São Paulo', icon: 'map-pin' as const },
  { name: 'FIAP Paulista', address: 'Av. Paulista, 1106 · Bela Vista', icon: 'book-open' as const },
  { name: 'Trabalho', address: 'Av. Paulista · Bela Vista', icon: 'briefcase' as const },
];
const recentPlaces = [
  { name: 'Metrô Consolação', address: 'Av. Paulista, 2163' },
  { name: 'Parque Trianon', address: 'R. Peixoto Gomide, 949' },
];
const searchable = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function SearchScreen() {
  const [search, setSearch] = useState('');
  const { colors } = useTheme();
  const s = useMemo(() => createRouteStyles(colors), [colors]);
  const ui = useUiStyles();
  const matches = places
    .filter((place) => searchable(`${place.name} ${place.address}`).includes(searchable(search)))
    .slice(0, search ? places.length : 3);
  return (
    <Protected>
      <Screen title="Para onde você vai?">
        <Field label="Origem" value="Sua localização · demonstração" editable={false} />
        <Field
          label="Destino"
          value={search}
          onChangeText={setSearch}
          placeholder="Busque um lugar ou endereço"
          autoFocus
        />
        <Badge label="Destinos de demonstração na Bela Vista" />
        <View style={s.quickPlaces}>
          {['Casa', 'FIAP', 'Trabalho'].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Buscar ${label}`}
              style={s.quickPlace}
              onPress={() => setSearch(label)}
            >
              <AppText variant="small" tone="primary">
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={s.searchSection}>
          <AppText variant="label" tone="muted">
            RESULTADOS
          </AppText>
          {matches.map((place) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ir para ${place.name}`}
              key={place.name}
              style={s.place}
              onPress={() => router.push({ pathname: '/rotas', params: { destino: place.name } })}
            >
              <View style={s.placeIcon}>
                <Icon name={place.icon} color={colors.primaryText} />
              </View>
              <View style={ui.grow}>
                <AppText variant="subtitle">{place.name}</AppText>
                <AppText tone="muted" variant="small">
                  {place.address}
                </AppText>
              </View>
              <Icon name="chevron-right" size={18} />
            </Pressable>
          ))}
          {matches.length === 0 && (
            <AppText tone="muted">
              Esse endereço ainda não faz parte da área de demonstração.
            </AppText>
          )}
        </View>
        <View style={s.searchSection}>
          <AppText variant="label" tone="muted">
            RECENTES · EXEMPLOS
          </AppText>
          {recentPlaces.map((place) => (
            <Pressable
              key={place.name}
              accessibilityRole="button"
              accessibilityLabel={`Ir para ${place.name}`}
              style={s.place}
              onPress={() => router.push({ pathname: '/rotas', params: { destino: place.name } })}
            >
              <View style={s.placeIcon}>
                <Icon name="clock" color={colors.muted} />
              </View>
              <View style={ui.grow}>
                <AppText variant="subtitle">{place.name}</AppText>
                <AppText variant="small" tone="muted">
                  {place.address}
                </AppText>
              </View>
              <Icon name="chevron-right" size={18} />
            </Pressable>
          ))}
        </View>
        <Button
          label="Escolher destino no mapa"
          variant="secondary"
          icon="map-pin"
          onPress={() => router.push('/destino')}
        />
      </Screen>
    </Protected>
  );
}
