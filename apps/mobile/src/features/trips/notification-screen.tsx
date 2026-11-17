import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LoadingScreen, Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useClock } from '@/hooks/use-clock';
import { localTime } from '@/lib/time';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { createTripStyles } from './trip.styles';
import { useRequestAlert, useTrip } from './use-trips';
import { tripTarget } from './trip-navigation';
import { TripUnavailable } from './trip-unavailable';
import { SosButton } from './sos-button';

export function NotificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const alert = useRequestAlert(id);
  const now = useClock();
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
        <Redirect href={tripTarget(trip.data)} />
      </Protected>
    );
  const currentTrip = trip.data;
  return (
    <Protected>
      <Screen title="Prévia de notificação">
        <View style={s.lockClock}>
          <Icon name="lock" size={22} color={colors.muted} />
          <AppText tone="muted">
            {new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'America/Sao_Paulo',
            }).format(now)}
          </AppText>
          <AppText style={s.lockTime}>{localTime(new Date(now).toISOString())}</AppText>
        </View>
        <Badge label="Prévia dentro do aplicativo · sem push real" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver risco moderado no trajeto"
          onPress={() => router.replace(tripTarget(currentTrip))}
          style={s.notificationCard}
        >
          <Icon name="alert-triangle" color={colors.warning} />
          <View style={s.alertRowBody}>
            <AppText variant="label">Risco moderado em 300 m</AppText>
            <AppText variant="small" tone="muted">
              Iluminação fraca no próximo quarteirão. Toque para abrir o trajeto ilustrativo.
            </AppText>
          </View>
          <AppText variant="small" tone="muted">
            agora
          </AppText>
        </Pressable>
        <Card>
          <AppText variant="label">Trecho monitorado · demonstração</AppText>
          <AppText variant="small" tone="muted">
            As câmeras apresentadas no mapa são ilustrativas. Nenhuma passagem ou mensagem externa
            foi confirmada.
          </AppText>
        </Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir trajeto ativo"
          style={s.notificationCard}
          onPress={() => router.replace(tripTarget(currentTrip))}
        >
          <Icon name="shield" color={colors.primaryText} />
          <View style={s.alertRowBody}>
            <AppText variant="label">SafeWalk · acompanhando</AppText>
            <AppText>{trip.data.destination}</AppText>
            <AppText variant="small" tone="muted">
              Chegada prevista {localTime(trip.data.expectedArrivalAt)} ·{' '}
              {countLabel(trip.data.contactIds.length, 'contato', 'contatos')} com acesso
            </AppText>
          </View>
          <Icon name="chevron-right" />
        </Pressable>
        <ErrorNotice error={alert.error} />
        <SosButton
          demonstration
          contactCount={trip.data.contactIds.length}
          loading={alert.isPending}
          onActivate={() =>
            alert.mutate('manual', {
              onSuccess: () => router.replace({ pathname: '/sos/[id]', params: { id } }),
            })
          }
        />
      </Screen>
    </Protected>
  );
}
