import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { ProfileSettings } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { SettingsPinPrompt } from './settings-pin-prompt';
import { useProtectedSettingsSave } from './use-protected-settings-save';
import { createSecurityStyles } from './security.styles';

function ResponseForm({ settings }: { settings: ProfileSettings }) {
  const [seconds, setSeconds] = useState(settings.responseSeconds);
  const { colors } = useTheme();
  const s = useMemo(() => createSecurityStyles(colors), [colors]);
  const save = useProtectedSettingsSave();
  return (
    <Screen title="Tempo para responder">
      <AppText tone="muted">
        Quando o app perceber algo estranho, ele pergunta “Está tudo bem?”. Se você não responder
        nesse tempo, o estado do alerta passa aos contatos.
      </AppText>
      {(
        [
          { value: 15, label: 'Mais rápido. Bom para quem anda sozinho à noite.' },
          { value: 30, label: 'Recomendado. Dá tempo de pegar o celular.' },
          { value: 60, label: 'Menos falsos alarmes. Bom para idosos.' },
        ] as const
      ).map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: seconds === item.value }}
          aria-checked={seconds === item.value}
          onPress={() => setSeconds(item.value)}
          style={[s.option, seconds === item.value && s.optionSelected]}
        >
          <View style={s.toggleRow}>
            <AppText variant="subtitle">{item.value} segundos</AppText>
            <Icon
              name={seconds === item.value ? 'check-circle' : 'circle'}
              color={seconds === item.value ? colors.primaryText : colors.muted}
            />
          </View>
          <AppText tone="muted" variant="small">
            {item.label}
          </AppText>
        </Pressable>
      ))}
      <Card>
        <Icon name="alert-circle" />
        <AppText variant="small" tone="muted">
          Num SOS manual, o alerta é imediato, sem esperar. Notificações externas continuam
          simuladas nesta versão.
        </AppText>
        <Badge label="Aplica-se aos próximos alertas" />
      </Card>
      <ErrorNotice error={save.error} />
      {save.pinRequested && (
        <SettingsPinPrompt
          error={save.pinError}
          loading={save.isPending}
          onConfirm={save.confirmPin}
          onCancel={save.cancelPin}
        />
      )}
      <Button
        label="Salvar"
        loading={save.isPending}
        onPress={() => save.submit({ ...settings, responseSeconds: seconds }, () => router.back())}
      />
    </Screen>
  );
}
export function ResponseTimeScreen() {
  const settings = useProfileSettings();
  return (
    <Protected>
      {settings.data ? (
        <ResponseForm settings={settings.data} />
      ) : (
        <Screen title="Tempo para responder">
          {settings.isPending ? (
            <ActivityIndicator />
          ) : (
            <>
              <ErrorNotice error={settings.error} />
              <Button
                label="Tentar novamente"
                onPress={() => {
                  void settings.refetch();
                }}
              />
            </>
          )}
        </Screen>
      )}
    </Protected>
  );
}
