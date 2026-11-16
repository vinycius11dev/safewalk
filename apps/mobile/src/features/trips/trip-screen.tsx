import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Protected, LoadingScreen } from '@/components/layout/screen';
import { AppText, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { useTrip, useRequestAlert, useUpdatePosition } from './use-trips';
import { localTime } from '@/lib/time';
import { createTripStyles } from './trip.styles';
import { tripTarget } from './trip-navigation';
import { SosButton } from './sos-button';
import { RealTripScreen } from './real-trip-screen';
import { TimerTripScreen } from './timer-trip-screen';

export function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const alert = useRequestAlert(id);
  const position = useUpdatePosition(id);
  const { colors } = useTheme();
  const s = useMemo(() => createTripStyles(colors), [colors]);
  const ui = useUiStyles();
  const [localStep, setStep] = useState(0);
  const step = trip.data?.lastPosition
    ? Math.max(0, Math.min(4, Math.round((trip.data.lastPosition.latitude + 23.5644) / 0.0024)))
    : localStep;
  const baseMinutes = trip.data?.routeKind === 'faster' ? 14 : 17;
  const baseMeters = trip.data?.routeKind === 'faster' ? 1100 : 1300;
  useEffect(() => {
    const status = trip.data?.status;
    if (status && status !== 'active' && trip.data) router.replace(tripTarget(trip.data));
  }, [trip.data]);
  function progress() {
    const next = (step + 1) % 5;
    setStep(next);
    position.mutate({
      latitude: -23.5644 + next * 0.0024,
      longitude: -46.6522 + next * 0.00005,
      accuracyMeters: 8,
      recordedAt: new Date().toISOString(),
    });
  }
  function trigger(reason: 'manual' | 'stopped' | 'late') {
    alert.mutate(reason, {
      onSuccess: (updated) => router.replace(tripTarget(updated)),
    });
  }
  if (trip.isPending)
    return (
      <Protected>
        <LoadingScreen />
      </Protected>
    );
  if (!trip.data)
    return (
      <Protected>
        <Screen title="Trajeto">
          <ErrorNotice error={trip.error} />
          <Button label="Voltar ao mapa" onPress={() => router.replace('/inicio')} />
        </Screen>
      </Protected>
    );
  if (trip.data.mode === 'timer') {
    return (
      <Protected>
        <TimerTripScreen
          trip={trip.data}
          onAlert={() => trigger('manual')}
          alertPending={alert.isPending}
          error={alert.error ?? trip.error}
        />
      </Protected>
    );
  }
  if (trip.data.route?.simulated === false) {
    return (
      <Protected>
        <RealTripScreen
          trip={trip.data}
          route={trip.data.route}
          onAlert={() => trigger('manual')}
          alertPending={alert.isPending}
          error={alert.error ?? trip.error}
        />
      </Protected>
    );
  }
  return (
    <Protected>
      <Screen scroll={false}>
        <MapScene variant="trip" step={step} />
        <View style={s.instruction}>
          <View style={s.instructionMain}>
            <Icon name="corner-up-right" size={34} color={colors.white} />
            <View>
              <AppText style={s.instructionText}>120 m</AppText>
              <AppText style={s.instructionStreet}>Vire à direita na R. Frei Caneca</AppText>
            </View>
          </View>
          <View style={s.instructionNext}>
            <AppText variant="small" style={s.white}>
              Depois: siga em frente por 200 m · demonstração
            </AppText>
          </View>
        </View>
        <View style={s.monitored}>
          <Icon name="video" size={16} color={colors.primaryText} />
          <AppText variant="small">Trecho monitorado · Smart Sampa simulado</AppText>
        </View>
        <View style={s.panel}>
          <ErrorNotice error={alert.error ?? position.error ?? trip.error} />
          <View style={s.risk}>
            <Icon name="sun" color={colors.warning} />
            <View style={s.riskBody}>
              <AppText variant="label">Risco moderado em 300 m</AppText>
              <AppText variant="small" tone="muted">
                Iluminação fraca no próximo quarteirão
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Relatar ocorrência"
              onPress={() => router.push('/relatar')}
            >
              <Icon name="plus-circle" color={colors.primaryText} />
            </Pressable>
          </View>
          <SosButton loading={alert.isPending} onActivate={() => trigger('manual')} />
          <View style={s.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Encerrar trajeto"
              onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id } })}
            >
              <Icon name="x" />
            </Pressable>
            <View style={s.footerBody}>
              <AppText style={s.eta}>{Math.max(1, baseMinutes - step * 2)} min</AppText>
              <AppText variant="small" tone="muted">
                {Math.max(100, baseMeters - step * 250)} m · chegada{' '}
                {localTime(trip.data.expectedArrivalAt)}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartilhar trajeto"
              onPress={() => router.push({ pathname: '/compartilhar/[id]', params: { id } })}
            >
              <Icon name="users" color={colors.success} />
            </Pressable>
          </View>
          <View style={s.demoControls}>
            <AppText variant="small" tone="muted">
              Demonstração
            </AppText>
            <Pressable
              accessibilityRole="button"
              style={s.demoButton}
              disabled={position.isPending}
              onPress={progress}
            >
              <AppText variant="small" tone="primary">
                Avançar posição
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.demoButton}
              disabled={alert.isPending}
              onPress={() => trigger('late')}
            >
              <AppText variant="small" tone="danger">
                Simular atraso
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.demoButton}
              onPress={() => router.push({ pathname: '/notificacao/[id]', params: { id } })}
            >
              <AppText variant="small" tone="primary">
                Notificações
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.demoButton}
              disabled={alert.isPending}
              onPress={() => trigger('stopped')}
            >
              <AppText variant="small" tone="danger">
                Simular parada
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={s.demoButton}
              onPress={() => router.replace('/roteiro-demo?passo=alertas')}
            >
              <AppText variant="small" tone="primary">
                Voltar à apresentação
              </AppText>
            </Pressable>
          </View>
          <View style={ui.between}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/encerrar/[id]', params: { id } })}
            >
              <AppText variant="small" tone="primary">
                Cheguei ao destino
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/pontos-seguros', params: { id } })}
            >
              <AppText variant="small" tone="primary">
                Pontos seguros
              </AppText>
            </Pressable>
          </View>
        </View>
      </Screen>
    </Protected>
  );
}
