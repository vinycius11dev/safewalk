import { useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { AppText, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { PinPad } from '@/features/auth/pin-screen';
import { useTheme } from '@/theme/theme-provider';
import { createSettingsPinPromptStyles } from './settings-pin-prompt.styles';

export function SettingsPinPrompt({
  error,
  loading,
  onConfirm,
  onCancel,
}: {
  error: unknown;
  loading: boolean;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const { colors } = useTheme();
  const s = useMemo(() => createSettingsPinPromptStyles(colors), [colors]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.dialog} accessibilityViewIsModal>
          <Card>
            <View style={s.header}>
              <Icon name="lock" size={28} />
              <AppText variant="subtitle">Digite seu PIN</AppText>
              <AppText variant="small" tone="muted">
                Esta mudança reduz a proteção da sua conta. Confirme que é você.
              </AppText>
            </View>
            <PinPad value={pin} onChange={setPin} />
            <ErrorNotice error={error} />
            <View style={s.actions}>
              <Button
                label="Confirmar mudança"
                disabled={pin.length !== 4}
                loading={loading}
                onPress={() => {
                  onConfirm(pin);
                  setPin('');
                }}
              />
              <Button label="Cancelar" variant="ghost" onPress={onCancel} />
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}
