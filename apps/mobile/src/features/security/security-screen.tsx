import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorNotice,
  Icon,
  useUiStyles,
} from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { SettingsPinPrompt } from './settings-pin-prompt';
import { useProtectedSettingsSave } from './use-protected-settings-save';
import { useContacts } from '@/features/contacts/use-contacts';
import { useTrips } from '@/features/trips/use-trips';
import { createSecurityStyles } from './security.styles';

export function SecurityScreen() {
  const { colors, mode, setMode } = useTheme();
  const s = useMemo(() => createSecurityStyles(colors), [colors]);
  const ui = useUiStyles();
  const { session, saveSession } = useAuth();
  const isDemoAccount = session?.user.demo === true;
  const settings = useProfileSettings();
  const save = useProtectedSettingsSave();
  const contacts = useContacts();
  const trips = useTrips();
  const items: {
    label: string;
    path: Href;
    icon: 'users' | 'clock' | 'file-text' | 'lock' | 'map-pin' | 'shield';
  }[] = [
    { label: 'Contatos de segurança', path: '/contatos', icon: 'users' },
    { label: 'Locais salvos', path: '/locais-salvos', icon: 'map-pin' },
    { label: 'Tempo para responder', path: '/tempo-resposta', icon: 'clock' },
    {
      label: session?.user.hasPin ? 'Alterar PIN de cancelamento' : 'Criar PIN de cancelamento',
      path: session?.user.hasPin ? '/alterar-pin' : '/pin',
      icon: 'lock',
    },
    {
      label: session?.user.hasDuressPin ? 'Alterar PIN de coação' : 'PIN de coação',
      path: '/pin-coacao',
      icon: 'shield',
    },
    { label: 'Meus relatos', path: '/meus-relatos', icon: 'file-text' },
    { label: 'Histórico de rotas', path: '/historico', icon: 'clock' },
    { label: 'Meus dados e privacidade', path: '/privacidade', icon: 'lock' },
    { label: 'Mapa e localização', path: '/servicos-mapa', icon: 'map-pin' },
    { label: 'Fontes dos dados urbanos', path: '/fontes-dados', icon: 'file-text' },
  ];
  return (
    <Protected>
      <Screen title="Segurança" back={false} tabs>
        <View style={s.profileHeader}>
          <View style={s.avatar}>
            <AppText style={s.avatarText}>{session?.user.name.charAt(0)}</AppText>
          </View>
          <View style={s.profileName}>
            <AppText variant="heading">{session?.user.name}</AppText>
            <AppText variant="small" tone="muted">
              {contacts.data
                ? countLabel(contacts.data.length, 'contato', 'contatos')
                : '— contatos'}{' '}
              ·{' '}
              {trips.data
                ? countLabel(trips.data.length, 'rota registrada', 'rotas registradas')
                : '— rotas registradas'}
            </AppText>
            {session?.user.demo && <Badge label="Conta de demonstração" />}
          </View>
          <Button label="Editar" variant="ghost" onPress={() => router.push('/editar-perfil')} />
        </View>
        <ErrorNotice error={settings.error ?? save.error ?? contacts.error ?? trips.error} />
        {save.pinRequested && (
          <SettingsPinPrompt
            error={save.pinError}
            loading={save.isPending}
            onConfirm={save.confirmPin}
            onCancel={save.cancelPin}
          />
        )}
        {settings.isPending && <ActivityIndicator color={colors.primary} />}
        {settings.isError && (
          <Button
            label="Recarregar preferências"
            variant="secondary"
            onPress={() => {
              void settings.refetch();
            }}
          />
        )}
        {settings.data && (
          <>
            <AppText style={s.sectionLabel}>PERFIL DE CAMINHADA</AppText>
            <View style={s.profileGrid}>
              {(
                [
                  {
                    value: 'standard',
                    name: 'Padrão',
                    description: 'Segurança pública em destaque',
                    icon: 'user',
                  },
                  {
                    value: 'pcd',
                    name: 'Idoso ou PCD',
                    description: 'Sem escadas, ritmo calmo e menos ladeiras',
                    icon: 'heart',
                  },
                  {
                    value: 'child',
                    name: 'Criança',
                    description: 'Com adulto, prefere calçadas',
                    icon: 'sun',
                  },
                  {
                    value: 'night',
                    name: 'À noite',
                    description: isDemoAccount
                      ? 'Ruas iluminadas · câmeras (simulação)'
                      : 'Prefere vias com iluminação mapeada',
                    icon: 'moon',
                  },
                ] as const
              ).map((profile) => (
                <Pressable
                  key={profile.value}
                  accessibilityRole="radio"
                  accessibilityLabel={profile.name}
                  accessibilityState={{ checked: settings.data.walkingProfile === profile.value }}
                  aria-checked={settings.data.walkingProfile === profile.value}
                  disabled={save.isPending}
                  style={[
                    s.profileOption,
                    settings.data.walkingProfile === profile.value && s.optionSelected,
                  ]}
                  onPress={() => {
                    if (settings.data)
                      save.submit({ ...settings.data, walkingProfile: profile.value });
                  }}
                >
                  <Icon name={profile.icon} color={colors.primaryText} />
                  <AppText variant="subtitle">{profile.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {profile.description}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {settings.data.walkingProfile === 'child' && (
              <Card>
                <AppText variant="subtitle">Criança só com um adulto</AppText>
                <AppText variant="small" tone="muted">
                  Este perfil é para acompanhar um passeio com um adulto responsável, não para a
                  criança andar sozinha. Antes de cada trajeto, o app pede que o adulto confirme que
                  está junto.
                </AppText>
              </Card>
            )}
            <AppText variant="small" tone="muted">
              Seu perfil fica salvo e muda o cálculo das rotas a pé: idoso ou PCD usa ritmo calmo,
              evita escadas e ladeiras quando há alternativa; criança prefere calçadas e caminhos de
              pedestre; à noite prefere vias marcadas como iluminadas no OpenStreetMap. Nada disso
              certifica acessibilidade ou segurança: verifique as condições do local.
            </AppText>
            {isDemoAccount && (
              <AppText variant="small" tone="muted">
                Na conta de demonstração, um alerta também registra um pedido simulado de imagens às
                câmeras Smart Sampa próximas.
              </AppText>
            )}
            <AppText style={s.sectionLabel}>SOS E DETECÇÃO</AppText>
            <Card>
              {isDemoAccount && (
                <View style={s.toggleRow}>
                  <View style={s.toggleBody}>
                    <AppText variant="subtitle">Detecção automática</AppText>
                    <AppText variant="small" tone="muted">
                      Parada e desvio nos cenários de demonstração
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel="Detecção automática"
                    value={settings.data.automaticDetection}
                    disabled={save.isPending}
                    onValueChange={(value) => {
                      if (settings.data)
                        save.submit({ ...settings.data, automaticDetection: value });
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
              )}
              <View style={s.toggleRow}>
                <View style={s.toggleBody}>
                  <AppText variant="subtitle">Check-in de chegada</AppText>
                  <AppText variant="small" tone="muted">
                    Pergunta se você está bem quando passa do horário previsto
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel="Check-in de chegada"
                  value={settings.data.arrivalCheckin}
                  disabled={save.isPending}
                  onValueChange={(value) => {
                    if (settings.data) save.submit({ ...settings.data, arrivalCheckin: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <View style={ui.between}>
                <AppText variant="small" tone="muted">
                  Tempo para responder
                </AppText>
                <Badge label={`${settings.data.responseSeconds} s`} />
              </View>
              <View style={s.toggleBody}>
                <AppText variant="subtitle">Alerta por perda de sinal</AppText>
                <View style={s.choiceRow}>
                  {(
                    [
                      { value: 0, label: 'Desligado' },
                      { value: 5, label: '5 min' },
                      { value: 10, label: '10 min' },
                      { value: 15, label: '15 min' },
                    ] as const
                  ).map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`Alerta por perda de sinal: ${option.label}`}
                      accessibilityState={{
                        checked: settings.data.signalLossMinutes === option.value,
                      }}
                      aria-checked={settings.data.signalLossMinutes === option.value}
                      disabled={save.isPending}
                      style={[
                        s.choice,
                        settings.data.signalLossMinutes === option.value && s.optionSelected,
                      ]}
                      onPress={() => {
                        if (settings.data)
                          save.submit({ ...settings.data, signalLossMinutes: option.value });
                      }}
                    >
                      <AppText variant="small">{option.label}</AppText>
                    </Pressable>
                  ))}
                </View>
                <AppText variant="small" tone="muted">
                  Se o servidor não receber sua localização durante um trajeto, pedimos um check-in.
                  No navegador, bloquear a tela interrompe a localização e pode disparar esse
                  pedido.
                </AppText>
              </View>
            </Card>
          </>
        )}
        {session?.user.demo && (
          <AppText variant="small" tone="muted">
            PIN inicial da demonstração: 1234. Se você o alterou, utilize o novo PIN.
          </AppText>
        )}
        <View>
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              style={s.menuItem}
              onPress={() => router.push(item.path)}
            >
              <Icon name={item.icon} color={colors.primaryText} />
              <AppText style={s.menuText}>{item.label}</AppText>
              <Icon name="chevron-right" size={18} />
            </Pressable>
          ))}
        </View>
        <Card>
          <View style={s.toggleRow}>
            <View style={s.toggleBody}>
              <AppText variant="subtitle">Tema escuro</AppText>
              <AppText variant="small" tone="muted">
                Conforto para caminhar à noite
              </AppText>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              accessibilityLabel="Tema escuro"
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>
        {session?.user.demo && (
          <Button
            label="Conheça o SafeWalk"
            variant="secondary"
            icon="map"
            onPress={() => router.push('/roteiro-demo')}
          />
        )}
        {session?.user.demo && (
          <Button
            label="Ver painel da Prefeitura · demo"
            variant="secondary"
            icon="grid"
            onPress={() => router.push('/prefeitura')}
          />
        )}
        <Button
          label="Sair da conta"
          variant="ghost"
          onPress={() => {
            void saveSession(null).then(() => router.replace('/boas-vindas'));
          }}
        />
      </Screen>
    </Protected>
  );
}
