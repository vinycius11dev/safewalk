import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { AppText, Badge, Button, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createSosButtonStyles } from './sos-button.styles';

export function SosButton({ onActivate, loading }: { onActivate: () => void; loading: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createSosButtonStyles(colors), [colors]);
  const [holding, setHolding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const longPressActivated = useRef(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS. Segure por três segundos ou ative para abrir a confirmação"
        accessibilityHint="No teclado ou leitor de tela, abre uma confirmação antes de ativar o alerta."
        disabled={loading}
        delayLongPress={3000}
        onPressIn={() => {
          longPressActivated.current = false;
          setHolding(true);
        }}
        onPressOut={() => setHolding(false)}
        onLongPress={() => {
          longPressActivated.current = true;
          onActivate();
        }}
        onPress={() => {
          if (!longPressActivated.current) setConfirm(true);
        }}
        style={({ pressed }) => [s.button, pressed && s.pressed]}
      >
        <Icon name="shield" size={23} color={colors.white} />
        <AppText style={s.title}>SOS</AppText>
        <AppText style={s.white}>
          {loading ? 'Ativando…' : holding ? 'Continue segurando…' : 'Segure 3 s'}
        </AppText>
      </Pressable>
      <Modal
        visible={confirm}
        transparent
        animationType="none"
        onRequestClose={() => setConfirm(false)}
      >
        <View style={s.overlay}>
          <View accessibilityViewIsModal style={s.dialog}>
            <Icon name="shield" size={38} color={colors.danger} />
            <AppText variant="title">Ativar o SOS?</AppText>
            <AppText>
              Seu estado de alerta ficará disponível para os contatos com acesso ao trajeto.
            </AppText>
            <Badge label="Demonstração · sem envio externo ou despacho" tone="warning" />
            <Button
              label="Ativar SOS"
              variant="danger"
              loading={loading}
              onPress={() => {
                setConfirm(false);
                onActivate();
              }}
            />
            <Button
              label="Voltar sem ativar"
              variant="secondary"
              onPress={() => setConfirm(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
