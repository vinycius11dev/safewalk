import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useReport } from './use-reports';
import { useTrips } from '@/features/trips/use-trips';
import { createReportStyles } from './reports.styles';

export function ReportSentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useReport(id);
  const trips = useTrips();
  const active = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  const { colors } = useTheme();
  const s = useMemo(() => createReportStyles(colors), [colors]);
  return (
    <Protected>
      <Screen title="Relato enviado">
        {report.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={report.error} />
        {report.isError && (
          <Button
            label="Tentar novamente"
            onPress={() => {
              void report.refetch();
            }}
          />
        )}
        {report.data && (
          <>
            <View style={s.success}>
              <View style={s.successIcon}>
                <Icon name="check" size={40} color={colors.success} />
              </View>
              <AppText variant="title" style={s.centered}>
                Relato registrado.
              </AppText>
              <AppText tone="muted" style={s.centered}>
                Obrigado por registrar o que encontrou no caminho.
              </AppText>
            </View>
            <Card>
              <AppText tone="muted" variant="small">
                Tipo
              </AppText>
              <AppText variant="subtitle">{reportLabels[report.data.type]}</AppText>
              <AppText tone="muted" variant="small">
                Local
              </AppText>
              <AppText>{report.data.address}</AppText>
              <AppText tone="muted" variant="small">
                Autoria
              </AppText>
              <Badge label="Anônimo para outros pedestres" tone="success" />
              <AppText tone="muted" variant="small">
                Visibilidade
              </AppText>
              <Badge
                label={
                  report.data.shareWithCommunity
                    ? 'Compartilhado · relato comunitário não verificado'
                    : 'Privado · só aparece para você'
                }
                tone={report.data.shareWithCommunity ? 'warning' : 'neutral'}
              />
              {report.data.hasPhoto && <Badge label="Foto anexada" />}
              {report.data.shareWithGovernment && (
                <>
                  <Badge
                    label={`Painel da Prefeitura (demonstração): ${governmentStatusLabels[report.data.governmentStatus ?? 'received']}`}
                  />
                  <AppText tone="muted" variant="small">
                    O local exato e a foto foram para o painel, sem seu nome nem seu contato. O
                    andamento só muda quando alguém do painel atualiza; isso não é um protocolo
                    oficial.
                  </AppText>
                </>
              )}
              {report.data.shareWithCommunity && (
                <AppText tone="muted" variant="small">
                  O ponto exibido às outras pessoas foi aproximado. Elas podem dizer se a condição
                  continua.
                </AppText>
              )}
              <AppText tone="muted" variant="small">
                Validade
              </AppText>
              <AppText>
                Até{' '}
                {new Date(report.data.expiresAt).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </AppText>
            </Card>
            <AppText variant="small" tone="muted">
              O relato está salvo em Meus relatos. O SafeWalk não encaminha relatos ao SP156 e não
              confirma oficialmente a situação da via.
            </AppText>
            <Button
              label={active ? 'Voltar ao trajeto' : 'Voltar ao mapa'}
              onPress={() =>
                active
                  ? router.replace({ pathname: '/trajeto/[id]', params: { id: active.id } })
                  : router.replace('/inicio')
              }
            />
            <Button
              label="Relatar outra coisa"
              variant="secondary"
              onPress={() => router.replace('/relatar')}
            />
            <Button
              label="Ver meus relatos"
              variant="ghost"
              onPress={() => router.replace('/meus-relatos')}
            />
          </>
        )}
      </Screen>
    </Protected>
  );
}
