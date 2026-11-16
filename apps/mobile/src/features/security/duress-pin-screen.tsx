import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { PinPad } from '@/features/auth/pin-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { authService } from '@/features/auth/auth.service';
import { ApiError } from '@/lib/api-client';

export function DuressPinScreen() {
  const { session, saveSession } = useAuth();
  const ui = useUiStyles();
  const [step, setStep] = useState<'current' | 'create' | 'confirm'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshUser = async () => {
    if (!session) throw new Error('Entre novamente.');
    const user = await authService.me(session.token);
    await saveSession({ ...session, user });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Entre novamente.');
      await authService.setDuressPin(session.token, currentPin, pin);
      await refreshUser();
    },
    onSuccess: () => router.replace('/seguranca'),
  });
  const remove = useMutation({
    mutationFn: async (pinToRemove: string) => {
      if (!session) throw new Error('Entre novamente.');
      await authService.removeDuressPin(session.token, pinToRemove);
      await refreshUser();
    },
    onSuccess: () => router.replace('/seguranca'),
  });
  const busy = save.isPending || remove.isPending;
  function advance() {
    setError(null);
    if (step === 'current') {
      setCurrentPin(pin);
      setPin('');
      setStep('create');
      return;
    }
    if (step === 'create') {
      setFirstPin(pin);
      setPin('');
      setStep('confirm');
      return;
    }
    if (pin !== firstPin) {
      setError('Os PINs não coincidem. Tente novamente.');
      setPin('');
      setFirstPin(null);
      setStep('create');
      return;
    }
    save.mutate();
  }
  const sameAsPrimary =
    step === 'confirm' && save.error instanceof ApiError && save.error.code === 'DURESS_PIN_SAME';
  return (
    <Protected>
      <Screen title="PIN de coação">
        <View style={ui.stack}>
          <Icon name="shield" size={36} />
          <AppText variant="title">
            {session?.user.hasDuressPin ? 'Alterar seu PIN de coação' : 'Crie um PIN de coação'}
          </AppText>
          <AppText tone="muted">
            Um segundo PIN para situações em que alguém obriga você a encerrar o trajeto ou cancelar
            o alerta. Na tela, ele parece funcionar normalmente; seus contatos com link passam a ver
            um alerta silencioso. Nenhuma mensagem é enviada automaticamente.
          </AppText>
          <Card>
            <AppText variant="small" tone="muted">
              {step === 'current'
                ? 'Primeiro, confirme seu PIN principal.'
                : step === 'create'
                  ? 'Agora escolha um PIN de coação de 4 dígitos, diferente do PIN principal.'
                  : 'Repita o PIN de coação para confirmar.'}
            </AppText>
          </Card>
          <PinPad value={pin} onChange={setPin} />
          <ErrorNotice
            error={
              sameAsPrimary
                ? new Error('O PIN de coação precisa ser diferente do PIN principal.')
                : (save.error ?? remove.error ?? (error ? new Error(error) : null))
            }
          />
          <Button
            label={
              step === 'current' ? 'Continuar' : step === 'create' ? 'Continuar' : 'Salvar PIN'
            }
            disabled={pin.length !== 4 || busy}
            loading={busy}
            onPress={advance}
          />
          {session?.user.hasDuressPin && step === 'current' && (
            <Button
              label="Remover PIN de coação"
              variant="danger"
              disabled={pin.length !== 4 || busy}
              onPress={() => remove.mutate(pin)}
            />
          )}
        </View>
      </Screen>
    </Protected>
  );
}
