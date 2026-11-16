import { durationLabel } from '@/lib/duration';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CollapsibleSheet } from '@/components/layout/collapsible-sheet';
import { Screen, LoadingScreen } from '@/components/layout/screen';
import { MapScene } from '@/components/map/map-scene';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-client';
import { freshness, localTime } from '@/lib/time';
import { useTheme } from '@/theme/theme-provider';
import { trackingService } from './tracking.service';
import { createTrackingStyles } from './tracking.styles';
import { useClock } from '@/hooks/use-clock';
import { CAMERA_REQUEST_TITLE, CAMERA_SIMULATION_NOTE } from '@/features/trips/camera-request';
import { CameraRequestSteps } from '@/features/trips/camera-request-steps';

const STALE_POSITION_MS = 2 * 60 * 1000;

export function TrackingScreen() {
  const now = useClock();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => createTrackingStyles(colors), [colors]);
  const ui = useUiStyles();
  const client = useQueryClient();
  const [phoneError, setPhoneError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ['tracking', token],
    queryFn: ({ signal }) => trackingService.get(token, signal),
    retry: false,
    refetchInterval: (q) =>
      q.state.error instanceof ApiError && q.state.error.status === 410 ? false : 5000,
  });
  const acknowledge = useMutation({
    mutationFn: () => trackingService.acknowledge(token),
    onSuccess: () => client.invalidateQueries({ queryKey: ['tracking', token] }),
  });
  const expired = query.error instanceof ApiError && query.error.status === 410;
  const arrived = query.error instanceof ApiError && query.error.code === 'TRIP_ARRIVED';
  if (query.isPending) return <LoadingScreen />;
  if (!query.data || expired)
    return (
      <Screen scroll={false}>
        <View style={s.empty}>
          <View style={[s.terminalIcon, arrived && s.arrivedIcon]}>
            <Icon
              name={arrived ? 'check' : 'lock'}
              size={44}
              color={arrived ? colors.success : colors.primaryText}
            />
          </View>
          <Badge
            label={
              arrived
                ? 'Chegada confirmada'
                : expired
                  ? 'Link expirado'
                  : 'Acompanhamento indisponível'
            }
            tone={arrived ? 'success' : 'neutral'}
          />
          <AppText variant="title" style={s.centered}>
            {arrived
              ? 'Seu contato chegou bem.'
              : expired
                ? 'Este link expirou.'
                : 'Não foi possível acompanhar.'}
          </AppText>
          <AppText tone="muted" style={s.centered}>
            {arrived
              ? 'A chegada foi confirmada pelo titular. O compartilhamento terminou e a localização não está mais disponível.'
              : expired
                ? 'O trajeto terminou, o acesso foi revogado ou o prazo acabou. A localização não está mais disponível. Uma nova caminhada precisa de um novo link.'
                : 'Confira sua conexão e tente carregar o trajeto novamente.'}
          </AppText>
          {!expired && (
            <>
              <ErrorNotice error={query.error} />
              <Button
                label="Tentar novamente"
                onPress={() => {
                  void query.refetch();
                }}
              />
            </>
          )}
        </View>
      </Screen>
    );
  const { trip, travelerName } = query.data;
  const duress = query.data.duress;
  const realRoute = query.data.route?.simulated === false ? query.data.route : null;
  const timerTrip = trip.mode === 'timer';
  const alert =
    Boolean(duress) || ['checkin_pending', 'alerted', 'escalated'].includes(trip.status);
  const checking = trip.status === 'checkin_pending';
  const phone = query.data.travelerPhone?.replace(/[^\d+]/g, '') ?? null;
  function openPhone(kind: 'tel' | 'sms') {
    if (!phone) return;
    void Linking.openURL(`${kind}:${phone}`).catch(() =>
      setPhoneError(new Error('Não foi possível abrir este recurso no seu aparelho.')),
    );
  }
  function callEmergency() {
    void Linking.openURL('tel:190').catch(() =>
      setPhoneError(new Error('Não foi possível abrir o telefone. Disque 190 pelo seu aparelho.')),
    );
  }
  const positionAgeMs = trip.lastPosition
    ? Math.max(0, now - new Date(trip.lastPosition.receivedAt).getTime())
    : null;
  const positionState: 'waiting' | 'stale' | 'fresh' =
    positionAgeMs === null ? 'waiting' : positionAgeMs > STALE_POSITION_MS ? 'stale' : 'fresh';
  const headline = duress
    ? 'Alerta silencioso'
    : `${travelerName} ${
        checking
          ? 'está confirmando se está bem'
          : alert
            ? 'pode precisar de ajuda'
            : timerTrip
              ? 'iniciou um acompanhamento por tempo'
              : positionState === 'fresh'
                ? 'está a caminho de ' + trip.destination
                : positionState === 'stale'
                  ? 'tem trajeto em andamento para ' + trip.destination
                  : 'iniciou um trajeto para ' + trip.destination
      }`;
  const step = trip.lastPosition
    ? Math.max(0, Math.min(4, Math.round((trip.lastPosition.latitude + 23.5644) / 0.0024)))
    : 0;
  return (
    <Screen scroll={false}>
      {realRoute ? (
        <RealMap
          center={realRoute.origin}
          route={realRoute.points}
          selectedPoint={trip.lastPosition}
          fitRoute
          attributionTop={75}
          controlsTop={105}
          accessibilityLabel="Mapa do trajeto compartilhado. O ponto mostra a última posição recebida; confira o horário da atualização."
        />
      ) : timerTrip ? (
        trip.lastPosition ? (
          <RealMap
            center={trip.lastPosition}
            selectedPoint={trip.lastPosition}
            attributionTop={75}
            controlsTop={105}
            accessibilityLabel="Mapa com a última posição recebida; confira o horário da atualização."
          />
        ) : (
          <View style={s.mapRequest}>
            <AppText variant="small" tone="muted">
              Acompanhamento por tempo, sem rota calculada. O mapa aparece quando a primeira posição
              for recebida.
            </AppText>
          </View>
        )
      ) : (
        <MapScene variant="trip" step={step} focusTop />
      )}
      <View style={s.top}>
        <View style={ui.row}>
          <Icon name="shield" color={colors.primaryText} />
          <AppText variant="subtitle">SafeWalk</AppText>
        </View>
        <Badge
          label={
            query.error
              ? 'Sem conexão'
              : duress
                ? 'Alerta silencioso'
                : checking
                  ? 'Confirmando segurança'
                  : alert
                    ? 'Alerta ativo'
                    : positionState === 'waiting'
                      ? 'Aguardando posição'
                      : positionState === 'stale'
                        ? 'Posição desatualizada'
                        : 'Acompanhando'
          }
          tone={
            query.error || checking
              ? 'warning'
              : alert || duress
                ? 'danger'
                : positionState === 'fresh'
                  ? 'success'
                  : positionState === 'stale'
                    ? 'warning'
                    : 'neutral'
          }
        />
      </View>
      <CollapsibleSheet
        summary={
          <View style={s.collapsedContent}>
            <AppText variant="subtitle" tone={duress ? 'danger' : undefined} numberOfLines={2}>
              {headline}
            </AppText>
            <AppText variant="small" tone="muted">
              Chegada prevista {localTime(trip.expectedArrivalAt)} ·{' '}
              {freshness(trip.lastPosition?.receivedAt, now)}
            </AppText>
            {alert && (
              <Button label="Ligar 190" icon="phone" variant="danger" onPress={callEmergency} />
            )}
          </View>
        }
      >
        <View style={s.panelContent}>
          <Badge
            label={
              realRoute
                ? 'Trajeto real · última posição recebida'
                : timerTrip
                  ? 'Acompanhamento por tempo'
                  : 'Trajeto de demonstração'
            }
          />
          <ErrorNotice error={query.error ?? phoneError} />
          {duress ? (
            <>
              <AppText variant="title">Alerta silencioso</AppText>
              <AppText tone="danger">
                {travelerName} usou o PIN de coação às {localTime(duress.usedAt)}. Isso pode indicar
                que está sendo forçado(a) a encerrar o acompanhamento. Uma ligação pode expor a
                pessoa; prefira mensagem e, se houver risco, ligue 190.
              </AppText>
            </>
          ) : (
            <AppText variant="title">{headline}</AppText>
          )}
          {!alert && positionState === 'waiting' && (
            <AppText variant="small" tone="muted">
              Ainda não recebemos a primeira posição de {travelerName}. Não dá para saber onde a
              pessoa está agora.
            </AppText>
          )}
          {!alert && positionState === 'stale' && (
            <AppText variant="small" tone="muted">
              A última posição recebida é antiga e pode não refletir onde {travelerName} está agora.
            </AppText>
          )}
          {trip.alertReason === 'signal_lost' && (
            <AppText variant="small" tone="muted">
              Não recebemos a localização de {travelerName} há alguns minutos. A última posição
              mostrada pode estar desatualizada.
            </AppText>
          )}
          {query.data.wheelchairShared && (
            <View style={s.wheelchairNotice}>
              <MaterialCommunityIcons
                name="wheelchair-accessibility"
                size={20}
                color={colors.primaryText}
              />
              <AppText variant="small" style={ui.grow}>
                {travelerName} avisou que este trajeto inclui uma pessoa em cadeira de rodas. Leve
                isso em conta se for ao encontro.
              </AppText>
            </View>
          )}
          {alert && trip.cameraRequest && (
            <View style={s.cameraCard}>
              <View style={ui.row}>
                <Icon name="video" color={colors.primaryText} />
                <AppText variant="subtitle" style={ui.grow}>
                  {CAMERA_REQUEST_TITLE}
                </AppText>
                <Badge label="Simulação" />
              </View>
              <CameraRequestSteps
                request={trip.cameraRequest}
                now={now}
                doneColor={colors.success}
                pendingColor={colors.muted}
              />
              <AppText variant="small" tone="muted">
                {CAMERA_SIMULATION_NOTE} Se houver risco, ligue 190.
              </AppText>
            </View>
          )}
          <View style={s.etaCard}>
            <View style={ui.grow}>
              <AppText style={s.eta}>{localTime(trip.expectedArrivalAt)}</AppText>
              <AppText variant="small" tone="muted">
                chegada prevista ·{' '}
                {realRoute
                  ? 'estimativa do roteiro de pedestres'
                  : timerTrip
                    ? 'acompanhamento por tempo · sem rota calculada'
                    : trip.routeKind === 'safer'
                      ? 'rota mais segura · demonstração'
                      : 'rota mais rápida · demonstração'}
              </AppText>
            </View>
            <Badge
              label={
                alert
                  ? 'Alerta'
                  : realRoute
                    ? 'Risco desconhecido'
                    : timerTrip
                      ? 'Risco desconhecido'
                      : `Risco ${query.data.route?.riskLabel ?? 'desconhecido'}`
              }
              tone={
                alert
                  ? 'danger'
                  : realRoute || timerTrip
                    ? 'neutral'
                    : trip.routeKind === 'safer'
                      ? 'success'
                      : 'warning'
              }
            />
          </View>
          <AppText tone="muted">
            Chegada prevista {localTime(trip.expectedArrivalAt)} ·{' '}
            {freshness(trip.lastPosition?.receivedAt, now)}
          </AppText>
          <View style={s.timeline}>
            <AppText variant="small">
              {localTime(trip.startedAt)} ·{' '}
              {realRoute
                ? 'Trajeto iniciado'
                : timerTrip
                  ? 'Acompanhamento por tempo iniciado'
                  : 'Saiu da FIAP Paulista · demonstração'}
            </AppText>
            <AppText variant="small" tone="muted">
              {realRoute
                ? `${(realRoute.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km · ${durationLabel(realRoute.durationMinutes)} estimados no cálculo. Segurança e acessibilidade não avaliadas.`
                : timerTrip
                  ? 'Sem rota calculada; a duração foi definida pelo titular. A posição mostrada pode estar desatualizada.'
                  : 'Câmeras e ocorrências ilustrativas'}
            </AppText>
            <AppText variant="small">
              {trip.lastPosition
                ? 'Última posição recebida no servidor'
                : 'Aguardando o primeiro envio de posição'}
            </AppText>
          </View>
          {trip.lastPosition && (
            <AppText variant="small" tone="muted">
              {trip.lastPosition.latitude.toFixed(5)}, {trip.lastPosition.longitude.toFixed(5)}
            </AppText>
          )}
          {realRoute && (
            <AppText variant="small" tone="muted">
              {realRoute.provenance.attribution} · roteiro calculado às{' '}
              {localTime(realRoute.provenance.computedAt)}. O ponto no mapa pode estar
              desatualizado; não confirma a posição atual do titular.
            </AppText>
          )}
          {alert && !checking && (
            <>
              <ErrorNotice error={acknowledge.error} />
              <Button
                label={
                  query.data.acknowledged ? 'Contato confirmado' : 'Estou acompanhando este alerta'
                }
                disabled={query.data.acknowledged}
                loading={acknowledge.isPending}
                onPress={() => acknowledge.mutate()}
              />
              <AppText variant="small" tone="muted">
                A confirmação avisa que você está acompanhando. O cancelamento do SOS exige o PIN do
                titular.
              </AppText>
            </>
          )}
          {query.data.acknowledged && (
            <View style={s.acknowledged}>
              <Icon name="check-circle" color={colors.success} />
              <AppText variant="small" style={ui.grow}>
                Seu reconhecimento foi registrado. O alerta continua até o titular confirmar com o
                PIN.
              </AppText>
            </View>
          )}
          {phone ? (
            <View style={ui.row}>
              <View style={ui.grow}>
                <Button
                  label={`Ligar para ${travelerName}`}
                  icon="phone"
                  variant="secondary"
                  onPress={() => openPhone('tel')}
                />
              </View>
              <View style={ui.grow}>
                <Button
                  label="Mensagem"
                  icon="message-circle"
                  variant="secondary"
                  onPress={() => openPhone('sms')}
                />
              </View>
            </View>
          ) : (
            <AppText variant="small" tone="muted">
              O titular não informou um telefone para contato direto.
            </AppText>
          )}
          {alert && (
            <Button label="Ligar 190" icon="phone" variant="danger" onPress={callEmergency} />
          )}
          <AppText variant="small" tone="muted">
            Este link só permite acompanhar este trajeto e expira quando ele termina. A última
            posição exibida pode estar desatualizada; nenhuma ajuda é acionada ou confirmada por
            este acompanhamento.
          </AppText>
        </View>
      </CollapsibleSheet>
    </Screen>
  );
}
