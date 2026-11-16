import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LoadingScreen, Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { localTime } from '@/lib/time';
import { useTrip } from './use-trips';
import { createTripStyles } from './trip.styles';
import { TripUnavailable } from './trip-unavailable';

export function FinishTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const { colors } = useTheme();
  const s = useMemo(() => createTripStyles(colors), [colors]);
  if (trip.isPending)
    return (
      <Protected>
        <LoadingScreen />
      </Protected>
    );
  if (!trip.data)
    return (
      <Protected>
        <TripUnavailable
          error={trip.error}
          retry={() => {
            void trip.refetch();
          }}
        />
      </Protected>
    );
  if (['arrived', 'cancelled'].includes(trip.data.status))
    return (
      <Protected>
        <Redirect href={{ pathname: '/chegada/[id]', params: { id } }} />
      </Protected>
    );
  function confirm(outcome: 'arrived' | 'cancelled') {
    router.push({ pathname: '/encerrar-pin/[id]', params: { id, resultado: outcome } });
  }
  return (
    <Protected>
      <Screen title="Encerrar trajeto">
        <View style={s.pinHeader}>
          <View style={s.arrivalIcon}>
            <Icon name="map-pin" size={38} color={colors.success} />
          </View>
          <AppText variant="title" style={s.centered}>
            Chegou em segurança?
          </AppText>
          <AppText tone="muted" style={s.centered}>
            Confirme sua chegada ou encerre o trajeto antes do destino.
          </AppText>
        </View>
        <Card>
          <Badge label="Trajeto em andamento" tone="success" />
          <AppText variant="heading">{trip.data.destination}</AppText>
          <AppText tone="muted">
            Saída às {localTime(trip.data.startedAt)} ·{' '}
            {trip.data.route
              ? 'Rota real a pé'
              : trip.data.routeKind === 'safer'
                ? 'Rota mais segura · demonstração'
                : 'Rota mais rápida · demonstração'}
          </AppText>
          <AppText variant="small" tone="muted">
            Ao encerrar, os links perdem acesso à sua localização. Seu PIN será solicitado na
            próxima tela.
          </AppText>
        </Card>
        <Button label="Sim, cheguei bem" icon="check" onPress={() => confirm('arrived')} />
        <Button
          label="Encerrar antes do destino"
          variant="secondary"
          onPress={() => confirm('cancelled')}
        />
        <Button
          label="Continuar caminhando"
          variant="ghost"
          onPress={() => router.replace({ pathname: '/trajeto/[id]', params: { id } })}
        />
      </Screen>
    </Protected>
  );
}
