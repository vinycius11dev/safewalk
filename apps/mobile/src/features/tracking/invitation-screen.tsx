import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, LoadingScreen } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { trackingService } from './tracking.service';
import { createTrackingStyles } from './tracking.styles';
import { ApiError } from '@/lib/api-client';

export function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => createTrackingStyles(colors), [colors]);
  const ui = useUiStyles();
  const [consent, setConsent] = useState(false);
  const [emailTripAlerts, setEmailTripAlerts] = useState(false);
  const client = useQueryClient();
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: ({ signal }) => trackingService.invitation(token, signal),
    retry: false,
  });
  const decision = useMutation({
    mutationFn: (accepted: boolean) =>
      trackingService.decide(token, accepted, consent, emailTripAlerts),
    onSuccess: () => client.invalidateQueries({ queryKey: ['invitation', token] }),
  });
  if (invitation.isPending) return <LoadingScreen />;
  return (
    <Screen title="SafeWalk" back={false}>
      <Icon name="users" size={42} color={colors.primaryText} />
      <ErrorNotice error={invitation.error ?? decision.error} />
      {!invitation.data && (
        <>
          <AppText variant="title">Convite indisponível</AppText>
          <AppText tone="muted">
            O convite pode ter expirado ou sido revogado. Peça um novo link para a pessoa que te
            convidou.
          </AppText>
          {!(invitation.error instanceof ApiError && invitation.error.status === 410) && (
            <Button
              label="Tentar novamente"
              variant="secondary"
              onPress={() => {
                void invitation.refetch();
              }}
            />
          )}
        </>
      )}
      {invitation.data &&
        (invitation.data.responded ? (
          <>
            <AppText variant="title">
              {invitation.data.accepted ? 'Você está na rede de apoio.' : 'Convite recusado.'}
            </AppText>
            <AppText tone="muted">
              Sua resposta foi registrada. Você pode fechar esta página.
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="title">
              {invitation.data.accepted
                ? `${invitation.data.inviterName} quer confirmar sua preferência de e-mail`
                : `${invitation.data.inviterName} quer você como contato de segurança`}
            </AppText>
            <Card>
              <AppText variant="subtitle">Você vai receber</AppText>
              <AppText tone="muted">
                Um link temporário com a posição durante os trajetos que essa pessoa escolher
                compartilhar. O link pode ser visto por quem o tiver e expira ao encerrar o trajeto,
                em até 2 horas.
              </AppText>
              <AppText variant="subtitle">Você não vê</AppText>
              <AppText tone="muted">
                A localização fora dos trajetos ou o histórico da pessoa.
              </AppText>
              <AppText variant="subtitle">E-mail cadastrado para este convite</AppText>
              <AppText tone="muted">
                {invitation.data.maskedEmail
                  ? invitation.data.maskedEmail
                  : 'Nenhum e-mail foi cadastrado. Você não receberá links por e-mail.'}
              </AppText>
            </Card>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              aria-checked={consent}
              onPress={() => setConsent(!consent)}
              style={s.check}
            >
              <Icon name={consent ? 'check-square' : 'square'} color={colors.primaryText} />
              <AppText style={ui.grow}>
                Aceito participar como contato de segurança e receber avisos dos trajetos que essa
                pessoa escolher compartilhar.
              </AppText>
            </Pressable>
            {invitation.data.maskedEmail && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: emailTripAlerts }}
                aria-checked={emailTripAlerts}
                onPress={() => setEmailTripAlerts(!emailTripAlerts)}
                style={s.check}
              >
                <Icon
                  name={emailTripAlerts ? 'check-square' : 'square'}
                  color={colors.primaryText}
                />
                <AppText style={ui.grow}>
                  Quero receber um e-mail quando esta pessoa iniciar um trajeto, com o link de
                  acompanhamento para {invitation.data.maskedEmail}. A entrega do e-mail pode não
                  ser confirmada.
                </AppText>
              </Pressable>
            )}
            <View style={ui.stack}>
              <Button
                label="Aceitar convite"
                disabled={!consent}
                loading={decision.isPending}
                onPress={() => decision.mutate(true)}
              />
              <Button
                label="Recusar"
                variant="ghost"
                loading={decision.isPending}
                onPress={() => decision.mutate(false)}
              />
            </View>
          </>
        ))}
    </Screen>
  );
}
