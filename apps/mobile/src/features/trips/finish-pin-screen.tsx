import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LoadingScreen, Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { PinPad } from '@/features/auth/pin-screen';
import { useTheme } from '@/theme/theme-provider';
import { useFinishTrip, useTrip } from './use-trips';
import { createTripStyles } from './trip.styles';
import { TripUnavailable } from './trip-unavailable';

export function FinishPinScreen() {
  const { id, resultado } = useLocalSearchParams<{ id: string; resultado?: string }>();
  const outcome = resultado === 'cancelled' ? 'cancelled' : 'arrived';
  const [pin, setPin] = useState('');
  const trip = useTrip(id);
  const finish = useFinishTrip(id);
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
  return (
    <Protected>
      <Screen title="Confirmar encerramento">
        <View style={s.pinHeader}>
          <View style={s.pinIcon}>
            <Icon name="lock" size={30} color={colors.primaryText} />
          </View>
          <AppText variant="title" style={s.centered}>
            Digite seu PIN
          </AppText>
          <AppText tone="muted" style={s.centered}>
            {outcome === 'arrived'
              ? 'Confirme que chegou em segurança.'
              : 'Confirme o encerramento antes do destino.'}{' '}
            O compartilhamento será encerrado para todos os contatos.
          </AppText>
          <Badge label="Somente você pode encerrar" />
        </View>
        <PinPad value={pin} onChange={setPin} />
        <ErrorNotice error={finish.error} />
        <Button
          label={outcome === 'arrived' ? 'Confirmar chegada' : 'Encerrar compartilhamento'}
          disabled={pin.length !== 4}
          loading={finish.isPending}
          onPress={() =>
            finish.mutate(
              { pin, outcome },
              {
                onSuccess: () => router.replace({ pathname: '/chegada/[id]', params: { id } }),
                onError: () => setPin(''),
              },
            )
          }
        />
        <Button
          label="Continuar trajeto"
          variant="ghost"
          onPress={() => router.replace({ pathname: '/trajeto/[id]', params: { id } })}
        />
      </Screen>
    </Protected>
  );
}
