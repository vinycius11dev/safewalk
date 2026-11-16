import { useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useTrips, useRequestAlert } from '@/features/trips/use-trips';
import { createLocationStateStyles } from './location-state.styles';

type Kind = 'gps' | 'permission' | 'contacts';
const content = {
  gps: {
    icon: 'map-pin' as const,
    title: 'Perdemos sua localização',
    description:
      'O acompanhamento mostra a última posição recebida e o horário dela. Quando o GPS não envia uma posição nova, o mapa não avança sozinho.',
    steps: [
      'Vá para um lugar mais aberto, longe de túneis.',
      'Confira se a localização e os dados móveis estão ligados.',
      'Se houver um trajeto ativo, o SOS usa a última posição salva. O envio externo continua simulado.',
    ],
  },
  permission: {
    icon: 'navigation' as const,
    title: 'Localização desativada',
    description:
      'Você pode revisar a permissão de localização. No navegador, o acompanhamento depende da página ativa; a tela bloqueada exige o aplicativo nativo e validação no aparelho.',
    steps: [
      'Abra os Ajustes do celular.',
      'Toque em SafeWalk › Localização.',
      'Revise a localização precisa. A opção Sempre depende da versão e da configuração do aparelho.',
    ],
  },
  contacts: {
    icon: 'users' as const,
    title: 'Ninguém vai acompanhar esta rota',
    description:
      'Sem contatos escolhidos e com convite aceito, ninguém recebe um link para ver sua caminhada. A demonstração não aciona uma central real.',
    steps: [
      'Adicione até 5 pessoas de confiança.',
      'Compartilhe o convite com quem ainda não tem o aplicativo.',
      'Cada contato precisa aceitar antes de acompanhar uma rota.',
    ],
  },
};

export function LocationStateScreen({ kind }: { kind: Kind }) {
  const { colors } = useTheme();
  const s = useMemo(() => createLocationStateStyles(colors), [colors]);
  const params = useLocalSearchParams<{ destino?: string; routeKind?: string }>();
  const trips = useTrips();
  const active = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  const alert = useRequestAlert(active?.id ?? '');
  const [error, setError] = useState<Error | null>(null);
  const item = content[kind];
  return (
    <Protected>
      <Screen title={kind === 'contacts' ? 'Contatos de segurança' : 'Localização'}>
        <View style={s.content}>
          <View style={s.icon}>
            <Icon
              name={item.icon}
              size={38}
              color={kind === 'gps' ? colors.warning : colors.primaryText}
            />
          </View>
          <AppText style={s.title}>{item.title}</AppText>
          <AppText style={s.description}>{item.description}</AppText>
          {kind === 'gps' && active?.lastPosition && (
            <Card>
              <AppText variant="label">Última posição recebida</AppText>
              <AppText tone="muted">
                {new Date(active.lastPosition.recordedAt).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </AppText>
              <Badge
                label={
                  active.route
                    ? 'Última posição GPS recebida'
                    : 'Posição ilustrativa da demonstração'
                }
              />
            </Card>
          )}
          {item.steps.map((step, index) => (
            <View key={step} style={s.step}>
              <View style={s.number}>
                <AppText tone="primary" variant="label">
                  {index + 1}
                </AppText>
              </View>
              <AppText style={s.body}>{step}</AppText>
            </View>
          ))}
          <ErrorNotice error={error ?? alert.error ?? trips.error} />
          {kind === 'contacts' ? (
            <>
              <Button
                label="Adicionar contato"
                icon="user-plus"
                onPress={() => router.push('/adicionar-contato')}
              />
              <Button
                label="Seguir sem contatos"
                variant="ghost"
                onPress={() =>
                  router.replace({
                    pathname: '/quem-acompanha',
                    params: {
                      destino: params.destino ?? 'Casa',
                      routeKind: params.routeKind ?? 'safer',
                      rota: params.routeKind ?? 'safer',
                      contatos: '',
                      semContatos: '1',
                    },
                  })
                }
              />
            </>
          ) : kind === 'permission' ? (
            <>
              <Button
                label={Platform.OS === 'web' ? 'Revisar permissões no navegador' : 'Abrir ajustes'}
                onPress={() => {
                  if (Platform.OS === 'web') router.push('/permissoes');
                  else
                    void Linking.openSettings().catch(() =>
                      setError(
                        new Error(
                          'Não foi possível abrir os ajustes. Abra-os manualmente no celular.',
                        ),
                      ),
                    );
                }}
              />
              <Button label="Agora não" variant="ghost" onPress={() => router.replace('/inicio')} />
            </>
          ) : (
            <>
              <Button label="Tentar de novo" onPress={() => router.push('/permissoes')} />
              {active ? (
                <Button
                  label="Pedir ajuda (SOS de demonstração)"
                  variant="danger"
                  loading={alert.isPending}
                  onPress={() =>
                    alert.mutate('manual', {
                      onSuccess: (trip) =>
                        router.replace({ pathname: '/sos/[id]', params: { id: trip.id } }),
                    })
                  }
                />
              ) : (
                <Button
                  label="Voltar ao mapa"
                  variant="ghost"
                  onPress={() => router.replace('/inicio')}
                />
              )}
              <Button
                label="Ver orientações de permissão"
                variant="ghost"
                onPress={() => router.push('/permissao-negada')}
              />
            </>
          )}
        </View>
      </Screen>
    </Protected>
  );
}
export function NoGpsScreen() {
  return <LocationStateScreen kind="gps" />;
}
export function PermissionDeniedScreen() {
  return <LocationStateScreen kind="permission" />;
}
export function NoContactsScreen() {
  return <LocationStateScreen kind="contacts" />;
}
