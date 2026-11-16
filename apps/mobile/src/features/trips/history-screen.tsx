import { durationLabel } from '@/lib/duration';
import { routeModeName } from '@/features/maps/route-context-summary';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { shortDate, localTime } from '@/lib/time';
import { useTrips } from './use-trips';
import { useTheme } from '@/theme/theme-provider';
import { createTripStyles } from './trip.styles';
import { tripTarget } from './trip-navigation';
export function HistoryScreen() {
  const trips = useTrips();
  const [filter, setFilter] = useState<'all' | 'arrived' | 'cancelled' | 'active'>('all');
  const { colors } = useTheme();
  const s = useMemo(() => createTripStyles(colors), [colors]);
  const visible =
    trips.data?.filter(
      (trip) =>
        filter === 'all' ||
        (filter === 'active'
          ? !['arrived', 'cancelled'].includes(trip.status)
          : trip.status === filter),
    ) ?? [];
  const distance =
    trips.data?.reduce(
      (sum, trip) => sum + (trip.mode === 'route' ? (trip.route?.distanceMeters ?? 0) / 1000 : 0),
      0,
    ) ?? 0;
  return (
    <Protected>
      <Screen title="Histórico de rotas">
        <View style={s.metrics}>
          <View style={s.metric}>
            <AppText variant="heading">{trips.data?.length ?? '—'}</AppText>
            <AppText variant="small" tone="muted">
              trajetos registrados
            </AppText>
          </View>
          <View style={s.metric}>
            <AppText variant="heading">
              {distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km
            </AppText>
            <AppText variant="small" tone="muted">
              roteiros reais planejados
            </AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          Últimos 30 trajetos desta conta. A distância soma os roteiros reais planejados;
          demonstrações não entram nessa estimativa.
        </AppText>
        <View style={s.historyFilters}>
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'arrived', label: 'Chegou bem' },
              { key: 'cancelled', label: 'Encerrados' },
              { key: 'active', label: 'Em andamento' },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.key }}
              onPress={() => setFilter(option.key)}
              style={[s.historyFilter, filter === option.key && s.feelingSelected]}
            >
              <AppText variant="small">{option.label}</AppText>
            </Pressable>
          ))}
        </View>
        {trips.isPending && <ActivityIndicator />}
        <ErrorNotice error={trips.error} />
        {trips.error && (
          <Button
            label="Tentar novamente"
            variant="secondary"
            onPress={() => {
              void trips.refetch();
            }}
          />
        )}
        {visible.map((trip) => (
          <Card key={trip.id}>
            <Badge
              label={
                trip.status === 'arrived'
                  ? 'Chegou bem'
                  : trip.status === 'cancelled'
                    ? 'Encerrado'
                    : 'Em andamento'
              }
              tone={trip.status === 'arrived' ? 'success' : 'neutral'}
            />
            <AppText variant="heading" numberOfLines={2}>
              {trip.destination}
            </AppText>
            <AppText tone="muted">
              {shortDate(trip.startedAt)} · {localTime(trip.startedAt)}
            </AppText>
            <AppText variant="small" tone="muted">
              {trip.mode === 'timer'
                ? `Acompanhamento por tempo · ${durationLabel(Math.max(1, Math.round((Date.parse(trip.expectedArrivalAt) - Date.parse(trip.startedAt)) / 60000)))}`
                : trip.route
                  ? `${routeModeName(trip.route)} · ${durationLabel(trip.route.durationMinutes)} previstos · ${(trip.route.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
                  : trip.routeKind === 'safer'
                    ? 'Demonstração · rota mais segura · 17 min previstos'
                    : 'Demonstração · rota mais rápida · 14 min previstos'}
            </AppText>
            <Button
              label="Ver trajeto"
              variant="secondary"
              onPress={() => router.push(tripTarget(trip))}
            />
          </Card>
        ))}
        {!trips.isPending && !trips.error && visible.length === 0 && (
          <Card>
            <Icon name="map" size={32} />
            <AppText variant="heading">
              {trips.data?.length
                ? 'Nenhum trajeto neste filtro.'
                : 'Seu primeiro caminho começa aqui.'}
            </AppText>
            <AppText tone="muted">Escolha um destino para planejar seu trajeto.</AppText>
            <Button label="Buscar destino" onPress={() => router.push('/buscar')} />
          </Card>
        )}
        <Button
          label="Ver privacidade e seus dados"
          variant="ghost"
          icon="lock"
          onPress={() => router.push('/privacidade')}
        />
      </Screen>
    </Protected>
  );
}
