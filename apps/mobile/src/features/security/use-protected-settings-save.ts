import { useState } from 'react';
import type { ProfileSettings } from '@safewalk/contracts';
import { ApiError } from '@/lib/api-client';
import { useSaveProfileSettings } from '@/features/auth/use-profile-settings';

const PIN_REQUIRED = 'PIN_REQUIRED_FOR_SETTINGS';
type Pending = { input: ProfileSettings; onSuccess?: () => void };

/** Salva configurações e, se a API exigir o PIN (mudança que reduz proteção), pede e reenvia. */
export function useProtectedSettingsSave() {
  const save = useSaveProfileSettings();
  const [pending, setPending] = useState<Pending | null>(null);
  const needsPin = save.error instanceof ApiError && save.error.code === PIN_REQUIRED;
  const submit = (input: ProfileSettings, onSuccess?: () => void) => {
    save.mutate(input, {
      onSuccess,
      onError: (error) => {
        if (error instanceof ApiError && error.code === PIN_REQUIRED)
          setPending({ input, onSuccess });
      },
    });
  };
  const confirmPin = (pin: string) => {
    if (!pending) return;
    save.mutate(
      { ...pending.input, currentPin: pin },
      {
        onSuccess: () => {
          setPending(null);
          pending.onSuccess?.();
        },
      },
    );
  };
  const cancelPin = () => {
    setPending(null);
    save.reset();
  };
  return {
    submit,
    confirmPin,
    cancelPin,
    isPending: save.isPending,
    /** Erro a exibir fora do pedido de PIN (o pedido de PIN em si não é erro para o usuário). */
    error: needsPin ? null : pending ? null : save.error,
    pinError: pending && !needsPin ? save.error : null,
    pinRequested: pending !== null,
  };
}
