import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice } from '@/components/ui/primitives';
import { useReports, useResolveReport } from './use-reports';
import { useTheme } from '@/theme/theme-provider';
import { useClock } from '@/hooks/use-clock';
import { createReportStyles } from './reports.styles';
export function MyReportsScreen() {
  const reports = useReports();
  const resolve = useResolveReport();
  const [filter, setFilter] = useState<'active' | 'ended'>('active');
  const { colors } = useTheme();
  const s = useMemo(() => createReportStyles(colors), [colors]);
  const now = useClock(60000);
  const filtered = reports.data?.filter(
    (report) =>
      (report.status === 'active' && Date.parse(report.expiresAt) > now) === (filter === 'active'),
  );
  return (
    <Protected>
      <Screen title="Meus relatos">
        <View accessibilityRole="tablist" style={s.filters}>
          {[
            { value: 'active' as const, label: 'Em andamento' },
            { value: 'ended' as const, label: 'Encerrados' },
          ].map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === item.value }}
              style={[s.filter, filter === item.value && s.filterActive]}
              onPress={() => setFilter(item.value)}
            >
              <AppText variant="label" tone={filter === item.value ? 'primary' : 'muted'}>
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        {reports.isPending && <ActivityIndicator />}
        <ErrorNotice error={reports.error ?? resolve.error} />
        {reports.isError && (
          <Button
            label="Tentar novamente"
            onPress={() => {
              void reports.refetch();
            }}
          />
        )}
        {filtered?.map((report) => (
          <Card key={report.id}>
            <Badge
              label={
                report.status === 'resolved'
                  ? 'Resolvido pelo autor'
                  : Date.parse(report.expiresAt) <= now
                    ? 'Validade encerrada'
                    : 'Registrado'
              }
            />
            <Badge
              label={
                report.shareWithCommunity
                  ? 'Comunidade · sem verificação oficial'
                  : 'Visível só para você'
              }
              tone={report.shareWithCommunity ? 'warning' : 'neutral'}
            />
            {report.shareWithGovernment && (
              <Badge
                label={`Painel da Prefeitura (demonstração): ${governmentStatusLabels[report.governmentStatus ?? 'received']}`}
                tone={report.governmentStatus === 'resolved' ? 'success' : 'neutral'}
              />
            )}
            <AppText variant="subtitle">{reportLabels[report.type]}</AppText>
            <AppText tone="muted">{report.address}</AppText>
            <AppText>{report.description}</AppText>
            {report.hasPhoto && <Badge label="Foto anexada" />}
            {report.shareWithCommunity && (
              <AppText variant="small" tone="muted">
                {report.confirmationCount} confirmações · {report.resolvedCount} avisaram que passou
                · {report.notFoundCount} não encontraram
              </AppText>
            )}
            <AppText variant="small" tone="muted">
              {new Date(report.createdAt).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}
            </AppText>
            {report.status === 'active' && Date.parse(report.expiresAt) > now && (
              <Button
                label="Marcar como resolvido"
                variant="secondary"
                loading={resolve.isPending && resolve.variables === report.id}
                onPress={() => resolve.mutate(report.id)}
              />
            )}
          </Card>
        ))}
        {!reports.isPending && !reports.isError && filtered?.length === 0 && (
          <Card>
            <AppText variant="heading">
              {filter === 'active' ? 'Nenhum relato em andamento' : 'Nenhum relato encerrado'}
            </AppText>
            <AppText tone="muted">Os registros enviados por você aparecem aqui.</AppText>
          </Card>
        )}
        <AppText variant="small" tone="muted">
          Mostrando até 50 relatos recentes da sua conta. O SafeWalk não encaminha esses relatos ao
          SP156.
        </AppText>
        <Button label="Relatar o que vi" onPress={() => router.push('/relatar')} />
      </Screen>
    </Protected>
  );
}
