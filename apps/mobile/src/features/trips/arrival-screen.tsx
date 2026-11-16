import { durationLabel } from '@/lib/duration';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Screen, Protected, LoadingScreen } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useTrip, useTripFeedback } from './use-trips';
import { createTripStyles } from './trip.styles';
export function ArrivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const feedback = useTripFeedback(id);
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
        <Screen title="Trajeto">
          <ErrorNotice error={trip.error ?? feedback.error} />
          <Button label="Voltar ao início" onPress={() => router.replace('/inicio')} />
        </Screen>
      </Protected>
    );
  if (!['arrived', 'cancelled'].includes(trip.data.status))
    return (
      <Protected>
        <Redirect href={{ pathname: '/trajeto/[id]', params: { id } }} />
      </Protected>
    );
  const savedFeedback = trip.data.feedback;
  return (
    <Protected>
      <Screen>
        <View style={s.arrival}>
          <View style={s.arrivalIcon}>
            <Icon name="check" size={42} color={colors.success} />
          </View>
          <AppText variant="title" style={s.centered}>
            {trip.data?.status === 'arrived' ? 'Você chegou bem.' : 'Trajeto encerrado.'}
          </AppText>
          <ErrorNotice error={trip.error ?? feedback.error} />
          <AppText tone="muted" style={s.centered}>
            O compartilhamento terminou. Os links de acompanhamento foram revogados no servidor.
          </AppText>
          <Card>
            <AppText variant="subtitle">{trip.data?.destination ?? 'Seu destino'}</AppText>
            <AppText variant="small" tone="muted">
              Obrigado por caminhar com o SafeWalk.
            </AppText>
          </Card>
          <View style={s.metrics}>
            <View style={s.metric}>
              <AppText variant="heading">
                {trip.data.mode === 'timer'
                  ? durationLabel(
                      Math.max(
                        1,
                        Math.round(
                          (Date.parse(trip.data.expectedArrivalAt) -
                            Date.parse(trip.data.startedAt)) /
                            60000,
                        ),
                      ),
                    )
                  : trip.data.route
                    ? durationLabel(trip.data.route.durationMinutes)
                    : trip.data.routeKind === 'safer'
                      ? '17 min'
                      : '14 min'}
              </AppText>
              <AppText variant="small" tone="muted">
                {trip.data.mode === 'timer' ? 'acompanhamento por tempo' : 'duração prevista'}
              </AppText>
            </View>
            <View style={s.metric}>
              <AppText variant="heading">
                {trip.data.mode === 'timer'
                  ? 'Sem rota'
                  : trip.data.route
                    ? `${(trip.data.route.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
                    : trip.data.routeKind === 'safer'
                      ? '1,3 km'
                      : '1,1 km'}
              </AppText>
              <AppText variant="small" tone="muted">
                {trip.data.mode === 'timer'
                  ? 'trajeto não calculado'
                  : trip.data.route
                    ? 'roteiro planejado'
                    : 'rota ilustrativa'}
              </AppText>
            </View>
          </View>
          <AppText variant="subtitle">Como você se sentiu no trajeto?</AppText>
          <View style={s.feedback}>
            {(
              [
                { value: 'safe', label: 'Seguro', icon: 'smile' },
                { value: 'neutral', label: 'Ok', icon: 'meh' },
                { value: 'unsafe', label: 'Inseguro', icon: 'frown' },
              ] as const
            ).map((feeling) => (
              <Pressable
                key={feeling.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: savedFeedback === feeling.value }}
                aria-checked={savedFeedback === feeling.value}
                disabled={feedback.isPending}
                onPress={() => feedback.mutate(feeling.value)}
                style={[s.feeling, savedFeedback === feeling.value && s.feelingSelected]}
              >
                <Icon name={feeling.icon} color={colors.primaryText} />
                <AppText variant="small">{feeling.label}</AppText>
              </Pressable>
            ))}
          </View>
          {trip.data.feedback && (
            <AppText variant="small" tone="success">
              Avaliação salva. Obrigado por contar como foi.
            </AppText>
          )}
          <Button
            label="Relatar algo no caminho"
            variant="secondary"
            onPress={() => router.replace('/relatar')}
          />
          <Button
            label="Concluir"
            loading={feedback.isPending}
            onPress={() => router.replace('/inicio')}
          />
        </View>
      </Screen>
    </Protected>
  );
}
