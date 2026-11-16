import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LoadingScreen, Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { PinPad } from '@/features/auth/pin-screen';
import { useTheme } from '@/theme/theme-provider';
import { useCancelAlert, useTrip } from './use-trips';
import { createTripStyles } from './trip.styles';
import { tripTarget } from './trip-navigation';
import { TripUnavailable } from './trip-unavailable';

export function CancelAlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pin, setPin] = useState('');
  const trip = useTrip(id);
  const cancel = useCancelAlert(id);
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
  if (['active', 'arrived', 'cancelled'].includes(trip.data.status))
    return (
      <Protected>
        <Redirect href={tripTarget(trip.data)} />
      </Protected>
    );
  const currentTrip = trip.data;
  return (
    <Protected>
      <Screen title="Cancelar o SOS">
        <View style={s.pinHeader}>
          <View style={s.pinIcon}>
            <Icon name="shield" size={34} color={colors.primaryText} />
          </View>
          <AppText variant="title" style={s.centered}>
            Você está em segurança?
          </AppText>
          <AppText tone="muted" style={s.centered}>
            Digite seu PIN para cancelar o alerta. O link dos contatos mostrará que você voltou ao
            trajeto.
          </AppText>
          <Badge label="A confirmação do contato não cancela o SOS" />
        </View>
        <PinPad value={pin} onChange={setPin} />
        <ErrorNotice error={cancel.error} />
        <Button
          label="Confirmar que estou seguro"
          disabled={pin.length !== 4}
          loading={cancel.isPending}
          onPress={() =>
            cancel.mutate(pin, {
              onSuccess: () => router.replace({ pathname: '/trajeto/[id]', params: { id } }),
              onError: () => setPin(''),
            })
          }
        />
        <Button
          label="Voltar ao alerta"
          variant="ghost"
          onPress={() => router.replace(tripTarget(currentTrip))}
        />
      </Screen>
    </Protected>
  );
}
