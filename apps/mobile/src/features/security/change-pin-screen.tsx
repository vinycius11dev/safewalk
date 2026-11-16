import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { PinPad } from '@/features/auth/pin-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { authService } from '@/features/auth/auth.service';

export function ChangePinScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState<'current' | 'new' | 'confirm' | 'done'>('current');
  const [value, setValue] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const change = useMutation({
    mutationFn: () => authService.changePin(session?.token ?? '', { currentPin, newPin }),
    onSuccess: () => {
      setCurrentPin('');
      setNewPin('');
      setValue('');
      setStep('done');
    },
    onError: () => {
      setStep('current');
      setValue('');
      setCurrentPin('');
    },
  });
  function next() {
    setError(null);
    if (step === 'current') {
      setCurrentPin(value);
      setValue('');
      setStep('new');
    } else if (step === 'new') {
      setNewPin(value);
      setValue('');
      setStep('confirm');
    } else if (value !== newPin) {
      setError(new Error('Os novos PINs não coincidem. Confirme novamente.'));
      setValue('');
    } else change.mutate();
  }
  return (
    <Protected>
      <Screen title="Alterar PIN">
        <Icon name={step === 'done' ? 'check-circle' : 'lock'} size={38} />
        <AppText variant="title">
          {step === 'done'
            ? 'PIN alterado com segurança.'
            : step === 'current'
              ? 'Confirme seu PIN atual'
              : step === 'new'
                ? 'Digite o novo PIN'
                : 'Confirme seu novo PIN'}
        </AppText>
        {step === 'done' ? (
          <>
            <AppText tone="muted">
              A partir de agora, use o novo PIN para encerrar trajetos e cancelar alertas.
            </AppText>
            <Button label="Voltar à segurança" onPress={() => router.replace('/seguranca')} />
          </>
        ) : (
          <>
            <AppText tone="muted">
              {step === 'current'
                ? 'Protegemos a alteração confirmando o PIN que você já usa.'
                : 'Escolha 4 dígitos novos. Evite datas de aniversário.'}
            </AppText>
            <PinPad value={value} onChange={setValue} />
            <ErrorNotice error={error ?? change.error} />
            <Button
              label={step === 'confirm' ? 'Salvar novo PIN' : 'Continuar'}
              disabled={value.length !== 4}
              loading={change.isPending}
              onPress={next}
            />
            <Button
              label="Recomeçar"
              variant="ghost"
              onPress={() => {
                setValue('');
                setCurrentPin('');
                setNewPin('');
                setStep('current');
                setError(null);
                change.reset();
              }}
            />
          </>
        )}
      </Screen>
    </Protected>
  );
}
