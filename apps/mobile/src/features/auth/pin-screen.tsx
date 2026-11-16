import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useAuth } from './auth-provider';
import { authService } from './auth.service';
import { createAuthStyles } from './auth.styles';

export function PinPad({ value, onChange }: { value: string; onChange: (pin: string) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createAuthStyles(colors), [colors]);
  return (
    <View>
      <View accessibilityLabel={`${value.length} de 4 dígitos`} style={s.pinDots}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[s.pinDot, value.length > index && s.pinDotFilled]} />
        ))}
      </View>
      <View style={s.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map((key, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={key === 'delete' ? 'Apagar dígito' : `Dígito ${key}`}
            disabled={!key}
            style={s.key}
            onPress={() =>
              onChange(
                key === 'delete' ? value.slice(0, -1) : value.length < 4 ? value + key : value,
              )
            }
          >
            {key === 'delete' ? (
              <Icon name="delete" />
            ) : (
              <AppText style={s.keyNumber}>{key}</AppText>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function PinScreen() {
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session, saveSession } = useAuth();
  const ui = useUiStyles();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Entre novamente.');
      await authService.setPin(session.token, pin);
      const user = await authService.me(session.token);
      await saveSession({ ...session, user });
    },
    onSuccess: () => router.replace('/primeiro-contato'),
  });
  function confirm() {
    setError(null);
    if (!firstPin) {
      setFirstPin(pin);
      setPin('');
      return;
    }
    if (pin !== firstPin) {
      setError('Os PINs não coincidem. Tente novamente.');
      setPin('');
      return;
    }
    setError(null);
    mutation.mutate();
  }
  return (
    <Protected>
      <Screen title="Seu PIN de segurança">
        <View style={ui.stack}>
          <Icon name="lock" size={36} />
          <AppText variant="title">
            {firstPin ? 'Confirme seu PIN' : 'Crie um PIN de 4 dígitos'}
          </AppText>
          <AppText tone="muted">
            Você vai usá-lo para cancelar um alerta ou encerrar seu trajeto. Guarde esse número só
            para você.
          </AppText>
          <PinPad
            value={pin}
            onChange={(next) => {
              setError(null);
              setPin(next);
            }}
          />
          <ErrorNotice error={error ? new Error(error) : mutation.error} />
          <Button
            label={firstPin ? 'Salvar PIN' : 'Continuar'}
            disabled={pin.length !== 4}
            loading={mutation.isPending}
            onPress={confirm}
          />
        </View>
      </Screen>
    </Protected>
  );
}
