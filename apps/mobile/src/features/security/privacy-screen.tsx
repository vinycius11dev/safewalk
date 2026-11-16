import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { ProfileSettings } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { authService } from '@/features/auth/auth.service';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { SettingsPinPrompt } from './settings-pin-prompt';
import { useProtectedSettingsSave } from './use-protected-settings-save';
import { useTheme } from '@/theme/theme-provider';
import { createSecurityStyles } from './security.styles';
import { exportPersonalData } from './export-personal-data';

function PrivacyForm({ settings }: { settings: ProfileSettings }) {
  const { colors } = useTheme();
  const s = useMemo(() => createSecurityStyles(colors), [colors]);
  const { session } = useAuth();
  const [retentionDays, setRetentionDays] = useState(settings.retentionDays);
  const [contributeReports, setContributeReports] = useState(settings.contributeReports);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const save = useProtectedSettingsSave();
  const data = useMutation({
    mutationFn: async () => exportPersonalData(await authService.exportData(session?.token ?? '')),
    onSuccess: setNotice,
  });
  const reducing = retentionDays < settings.retentionDays;
  return (
    <Screen title="Privacidade e dados">
      <Icon name="shield" size={36} />
      <AppText variant="title">Seu trajeto é seu.</AppText>
      <AppText style={s.sectionLabel}>O QUE O SAFEWALK GUARDA</AppText>
      <Card>
        <AppText tone="muted">
          Localização: o GPS só é iniciado por você. Durante um trajeto real ativo, posições
          autorizadas com precisão de até 150 m são registradas. Você pode parar o GPS a qualquer
          momento.
        </AppText>
        <AppText tone="muted">
          Relatos: vinculados à sua conta para evitar abuso, sem expor sua identidade no painel.
        </AppText>
        <AppText tone="muted">Nunca coletamos imagens, áudio ou biometria.</AppText>
      </Card>
      <Button
        label="Serviços externos do mapa e GPS"
        variant="secondary"
        onPress={() => router.push('/servicos-mapa')}
      />
      <Button
        label="Fontes e atualização dos dados"
        variant="ghost"
        onPress={() => router.push('/fontes-dados')}
      />
      <Card>
        <AppText variant="subtitle">Compartilhamento por escolha</AppText>
        <AppText variant="small" tone="muted">
          Só os contatos escolhidos recebem o link. Ele deixa de disponibilizar localização ao
          encerrar o trajeto ou ao expirar, em até duas horas.
        </AppText>
      </Card>
      <Card>
        <AppText variant="subtitle">Câmeras Smart Sampa (simulação)</AppText>
        <AppText variant="small" tone="muted">
          Quando um alerta chega aos contatos, o trajeto registra um pedido simulado de imagens às
          câmeras próximas: raio de 150 m e horário. Nenhuma câmera é acionada e nenhuma imagem ou
          biometria é recebida. Uma integração real exigiria acordo com a Prefeitura e seu
          consentimento específico.
        </AppText>
      </Card>
      <AppText style={s.sectionLabel}>APAGAR HISTÓRICO DE ROTAS APÓS</AppText>
      <View style={s.choiceRow}>
        {([7, 30, 90] as const).map((days) => (
          <Pressable
            key={days}
            accessibilityRole="radio"
            accessibilityLabel={`${days} dias`}
            accessibilityState={{ checked: retentionDays === days }}
            aria-checked={retentionDays === days}
            style={[s.choice, retentionDays === days && s.optionSelected]}
            onPress={() => {
              setRetentionDays(days);
              setConfirmed(false);
            }}
          >
            <AppText variant="subtitle">{days} dias</AppText>
          </Pressable>
        ))}
      </View>
      <AppText variant="small" tone="muted">
        A limpeza remove apenas rotas encerradas e relatos já expirados além do prazo. Trajetos
        ativos são preservados.
      </AppText>
      {reducing && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmed }}
          aria-checked={confirmed}
          onPress={() => setConfirmed(!confirmed)}
        >
          <AppText tone="danger">
            {confirmed ? '☑' : '☐'} Entendo que reduzir o prazo apaga permanentemente o histórico
            antigo.
          </AppText>
        </Pressable>
      )}
      <Card>
        <View style={s.toggleRow}>
          <View style={s.toggleBody}>
            <AppText variant="subtitle">Contribuir com relatos comunitários</AppText>
            <AppText variant="small" tone="muted">
              Permite compartilhar relatos que você escolher, sem seu nome e com o ponto aproximado,
              para que pessoas próximas confirmem se o problema continua. Também inclui os dados no
              painel de demonstração; nada é enviado à Prefeitura.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Contribuir com relatos comunitários"
            value={contributeReports}
            onValueChange={setContributeReports}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>
      <ErrorNotice error={save.error ?? data.error} />
      {save.pinRequested && (
        <SettingsPinPrompt
          error={save.pinError}
          loading={save.isPending}
          onConfirm={save.confirmPin}
          onCancel={save.cancelPin}
        />
      )}
      {Boolean(notice) && (
        <AppText accessibilityRole="status" tone="success">
          {notice}
        </AppText>
      )}
      <Button
        label="Salvar preferências"
        disabled={reducing && !confirmed}
        loading={save.isPending}
        onPress={() =>
          save.submit({ ...settings, retentionDays, contributeReports }, () => {
            setNotice('Preferências salvas. O prazo de retenção já está aplicado.');
            setConfirmed(false);
          })
        }
      />
      <Button
        label="Baixar meus dados"
        variant="secondary"
        icon="download"
        loading={data.isPending}
        onPress={() => data.mutate()}
      />
      <AppText variant="small" tone="muted">
        A exportação inclui perfil, preferências, contatos, posições, trajetos, alertas e relatos da
        sua conta. Não inclui senhas, PIN ou tokens.
      </AppText>
      <Button
        label="Excluir minha conta"
        variant="ghost"
        onPress={() => router.push('/excluir-conta')}
      />
    </Screen>
  );
}
export function PrivacyScreen() {
  const settings = useProfileSettings();
  return (
    <Protected>
      {settings.data ? (
        <PrivacyForm settings={settings.data} />
      ) : (
        <Screen title="Privacidade e dados">
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
