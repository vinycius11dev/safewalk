import { useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { ShareLink } from '@safewalk/contracts';
import { Screen, Protected, LoadingScreen } from '@/components/layout/screen';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { PinPad } from '@/features/auth/pin-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts } from '@/features/contacts/use-contacts';
import { useClock } from '@/hooks/use-clock';
import { localTime } from '@/lib/time';
import { useTrip, useCancelAlert, useRequestAlert } from './use-trips';
import { tripsService } from './trips.service';
import {
  buildEmergencyMessage,
  normalizePhoneForWhatsApp,
  smsUrl,
  whatsAppUrl,
} from './emergency-message';
import { createTripStyles } from './trip.styles';
import { tripTarget } from './trip-navigation';
import { TripUnavailable } from './trip-unavailable';
import { CAMERA_REQUEST_TITLE, CAMERA_SIMULATION_NOTE } from './camera-request';
import { CameraRequestSteps } from './camera-request-steps';
import { contactAlertStatus } from './contact-alert-status';

export function CheckinScreen() {
  return <AlertScreen />;
}
export function StoppedAlertScreen() {
  return <AlertScreen />;
}

export function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const cancel = useCancelAlert(id);
  const request = useRequestAlert(id);
  const contacts = useContacts();
  const { session } = useAuth();
  const [pin, setPin] = useState('');
  const [phoneError, setPhoneError] = useState<Error | null>(null);
  const [linkError, setLinkError] = useState<Error | null>(null);
  const shares = useMutation({ mutationFn: () => tripsService.shares(session?.token ?? '', id) });
  const now = useClock();
  const { colors } = useTheme();
  const s = useMemo(() => createTripStyles(colors), [colors]);
  if (trip.isPending)
    return (
      <Protected>
        <LoadingScreen />
      </Protected>
    );
  if (!trip.data)
    return (
      <Protected>
        <TripUnavailable
          error={trip.error}
          retry={() => {
            void trip.refetch();
          }}
        />
      </Protected>
    );
  if (['active', 'arrived', 'cancelled'].includes(trip.data.status))
    return (
      <Protected>
        <Redirect href={tripTarget(trip.data)} />
      </Protected>
    );
  const checking = trip.data.status === 'checkin_pending';
  const late = trip.data.alertReason === 'late';
  const signalLost = trip.data.alertReason === 'signal_lost';
  const tripContacts =
    contacts.data?.filter((contact) => trip.data.contactIds.includes(contact.id)) ?? [];
  const smsPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';
  async function openChannel(
    contactId: string,
    contactPhone: string,
    channel: 'whatsapp' | 'sms',
  ): Promise<void> {
    setLinkError(null);
    try {
      if (!trip.data) return;
      const links: ShareLink[] = shares.data ?? (await shares.mutateAsync());
      const link = links.find((item) => item.contactId === contactId);
      if (!link) throw new Error('Não foi possível criar o link de acompanhamento deste contato.');
      const message = buildEmergencyMessage({
        travelerFirstName: session?.user.name.split(' ')[0] ?? 'Seu contato',
        url: link.url,
        lastPosition: trip.data.lastPosition,
      });
      const url =
        channel === 'whatsapp'
          ? (() => {
              const digits = normalizePhoneForWhatsApp(contactPhone);
              if (!digits)
                throw new Error('Este contato não tem um número compatível com o WhatsApp.');
              return whatsAppUrl(digits, message);
            })()
          : smsUrl(contactPhone, message, smsPlatform);
      await Linking.openURL(url);
    } catch (failure) {
      setLinkError(
        failure instanceof Error
          ? failure
          : new Error(
              `Não foi possível abrir o ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} neste aparelho.`,
            ),
      );
    }
  }
  const seconds = Math.max(
    0,
    Math.ceil((new Date(trip.data.alertDeadline ?? now).getTime() - now) / 1000),
  );
  const escalation = Math.max(
    0,
    Math.ceil((new Date(trip.data.escalationDeadline ?? now).getTime() - now) / 1000),
  );
  return (
    <Protected>
      <Screen scroll={false}>
        <ScrollView contentContainerStyle={s.alertRoot}>
          <View style={s.alertTop}>
            <Badge
              label={
                checking
                  ? signalLost
                    ? 'SINAL PERDIDO'
                    : late
                      ? 'CHECK-IN DE CHEGADA'
                      : 'DETECÇÃO AUTOMÁTICA'
                  : 'SOS ATIVO'
              }
              tone="danger"
            />
            <AppText variant="small" style={s.alertMuted}>
              Demonstração
            </AppText>
          </View>
          <View style={s.alertIcon}>
            <Icon name={checking ? 'alert-triangle' : 'shield'} size={42} color={colors.white} />
          </View>
          <AppText style={s.alertTitle}>{checking ? 'Está tudo bem?' : 'Alerta ativo'}</AppText>
          <AppText style={[s.centered, s.alertMuted]}>
            {checking
              ? signalLost
                ? 'Não recebemos sua localização há alguns minutos. Confirme que está em segurança.'
                : late
                  ? trip.data.mode === 'timer'
                    ? 'O tempo do acompanhamento terminou. Confirme que está em segurança.'
                    : Date.parse(trip.data.expectedArrivalAt) > now
                      ? `Um atraso de chegada em ${trip.data.destination} foi simulado. A previsão atual é ${localTime(trip.data.expectedArrivalAt)}.`
                      : `Você ainda não confirmou a chegada em ${trip.data.destination}. A previsão era ${localTime(trip.data.expectedArrivalAt)}.`
                  : trip.data.alertReason === 'deviation'
                    ? 'Um desvio do trajeto foi simulado. Confirme que está em segurança.'
                    : 'Uma parada inesperada foi simulada no seu trajeto. Confirme que está em segurança.'
              : 'Seu estado de alerta está disponível para os contatos que possuem o link deste trajeto.'}
          </AppText>
          {checking ? (
            <>
              <AppText style={s.countdown}>{seconds}</AppText>
              <AppText style={[s.centered, s.alertMuted]}>
                {seconds
                  ? 'segundos para disponibilizar o alerta aos contatos'
                  : 'Atualizando o estado no servidor…'}
              </AppText>
              <View style={s.alertStages}>
                <AppText variant="small" style={s.white}>
                  Você
                </AppText>
                <Icon name="chevron-right" color={colors.white} />
                <AppText variant="small" style={s.white}>
                  Contatos
                </AppText>
                <Icon name="chevron-right" color={colors.white} />
                <AppText variant="small" style={s.alertMuted}>
                  GCM e câmeras · demo
                </AppText>
              </View>
              <View style={s.pinPanel}>
                <AppText variant="subtitle" style={s.centered}>
                  Digite o PIN para cancelar
                </AppText>
                <PinPad value={pin} onChange={setPin} />
                <ErrorNotice error={cancel.error} />
                <Button
                  label="Estou seguro · continuar trajeto"
                  disabled={pin.length !== 4}
                  loading={cancel.isPending}
                  onPress={() =>
                    cancel.mutate(pin, {
                      onSuccess: () =>
                        router.replace({ pathname: '/trajeto/[id]', params: { id } }),
                      onError: () => setPin(''),
                    })
                  }
                />
              </View>
              <ErrorNotice error={request.error} />
              <Button
                label="Preciso de ajuda · ativar SOS"
                variant="danger"
                loading={request.isPending}
                onPress={() =>
                  request.mutate('manual', {
                    onSuccess: () => router.replace({ pathname: '/sos/[id]', params: { id } }),
                  })
                }
              />
            </>
          ) : (
            <>
              <View style={s.alertCard}>
                {[
                  {
                    title: 'Alerta disponível no link',
                    text:
                      trip.data.contactIds.length === 1
                        ? '1 contato escolhido pode consultar o alerta e a última posição.'
                        : `${trip.data.contactIds.length} contatos escolhidos podem consultar o alerta e a última posição.`,
                    icon: 'users' as const,
                  },
                  {
                    title:
                      trip.data.status === 'escalated'
                        ? 'Central GCM · simulação registrada'
                        : 'Escalada aguardando reconhecimento',
                    text:
                      trip.data.status === 'escalated'
                        ? 'O sistema registrou a etapa simulada. Não houve despacho ou atendimento confirmado.'
                        : `Sem reconhecimento de contato, a etapa simulada é registrada após o prazo de ${escalation} s.`,
                    icon: 'shield' as const,
                  },
                ].map((item) => (
                  <View key={item.title} style={s.alertRow}>
                    <Icon name={item.icon} color={colors.white} />
                    <View style={s.alertRowBody}>
                      <AppText variant="label" style={s.white}>
                        {item.title}
                      </AppText>
                      <AppText variant="small" style={s.alertMuted}>
                        {item.text}
                      </AppText>
                    </View>
                  </View>
                ))}
                <View style={s.alertRow}>
                  <Icon name="video" color={colors.white} />
                  <View style={s.alertRowBody}>
                    <AppText variant="label" style={s.white}>
                      {CAMERA_REQUEST_TITLE}
                    </AppText>
                    <AppText variant="small" style={s.alertMuted}>
                      {trip.data.cameraRequest
                        ? 'Os contatos veem estas mesmas etapas no link de acompanhamento.'
                        : 'O pedido de imagens às câmeras próximas é registrado quando o alerta chega aos contatos.'}{' '}
                      {CAMERA_SIMULATION_NOTE}
                    </AppText>
                  </View>
                </View>
                {trip.data.cameraRequest && (
                  <CameraRequestSteps
                    request={trip.data.cameraRequest}
                    now={now}
                    doneColor={colors.white}
                    pendingColor={colors.white}
                    titleStyle={s.white}
                    detailStyle={s.alertMuted}
                  />
                )}
              </View>
              {tripContacts.length > 0 && (
                <View style={s.alertCard}>
                  <AppText variant="subtitle" style={s.white}>
                    Avisar contatos agora
                  </AppText>
                  {tripContacts.map((contact) => {
                    const email = contactAlertStatus(
                      trip.data.alertMessages?.find((message) => message.contactId === contact.id),
                    );
                    return (
                      <View key={contact.id} style={s.contactChannels}>
                        <View style={s.contactChannelsHeader}>
                          <Icon name="user" size={18} color={colors.white} />
                          <AppText variant="label" style={[s.white, s.alertRowBody]}>
                            {contact.name}
                          </AppText>
                        </View>
                        <View style={s.contactChannelsHeader} accessibilityLiveRegion="polite">
                          <Icon name={email.icon} size={14} color={colors.white} />
                          <AppText variant="small" style={[s.alertMuted, s.alertRowBody]}>
                            {email.text}
                          </AppText>
                        </View>
                        <View style={s.channelRow}>
                          <Button
                            label="WhatsApp"
                            variant="secondary"
                            icon="send"
                            disabled={shares.isPending}
                            containerStyle={s.channelButton}
                            onPress={() => {
                              void openChannel(contact.id, contact.phone, 'whatsapp');
                            }}
                          />
                          <Button
                            label="SMS"
                            variant="secondary"
                            icon="message-circle"
                            disabled={shares.isPending}
                            containerStyle={s.channelButton}
                            onPress={() => {
                              void openChannel(contact.id, contact.phone, 'sms');
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                  <AppText variant="small" style={s.alertMuted}>
                    O e-mail sai sozinho para quem autorizou no convite. WhatsApp e SMS abrem a
                    conversa com a mensagem pronta; o envio só acontece quando você tocar em enviar.
                  </AppText>
                </View>
              )}
              <ErrorNotice error={shares.error ?? linkError} />
              <Button
                label="Ver links dos contatos"
                variant="secondary"
                icon="users"
                onPress={() => router.push({ pathname: '/compartilhar/[id]', params: { id } })}
              />
              <Button
                label="Estou seguro · cancelar com PIN"
                variant="secondary"
                onPress={() => router.push({ pathname: '/cancelar-sos/[id]', params: { id } })}
              />
            </>
          )}
          <AppText variant="small" style={[s.centered, s.alertMuted]}>
            Só o e-mail aos contatos que autorizaram é automático. Câmeras e viaturas não são
            acionadas: o pedido às câmeras Smart Sampa é uma simulação.
          </AppText>
          <ErrorNotice error={phoneError ?? trip.error} />
          <Button
            label="Ligar 190"
            variant="secondary"
            icon="phone"
            onPress={() => {
              void Linking.openURL('tel:190').catch(() =>
                setPhoneError(
                  new Error('Não foi possível abrir o telefone. Disque 190 pelo seu aparelho.'),
                ),
              );
            }}
          />
        </ScrollView>
      </Screen>
    </Protected>
  );
}
