import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { reportLabels } from '@safewalk/contracts';
import { AppText, Badge, Button, Card, Icon, useUiStyles } from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { useReports } from '@/features/reports/use-reports';
import { useTrips } from '@/features/trips/use-trips';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { MunicipalityShell } from './municipality-shell';
import {
  MunicipalityFilter,
  MunicipalityLoading,
  MunicipalityMetric,
} from './municipality-components';
import {
  criticalPoints,
  maintenanceQueue,
  municipalCategories,
  type MunicipalCategory,
} from './municipality.model';
import { createMunicipalityStyles } from './municipality.styles';

const periods = [
  { key: 'week', label: 'Últimos 7 dias' },
  { key: 'month', label: 'Últimos 30 dias' },
  { key: 'today', label: 'Hoje' },
] as const;
export function MunicipalityScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const ui = useUiStyles();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<'week' | 'month' | 'today'>('week');
  const { type } = useLocalSearchParams<{ type?: string }>();
  const category = municipalCategories.find((item) => item.key === type)?.key ?? 'all';
  const setCategory = (value: MunicipalCategory) => router.setParams({ type: value });
  const [queue, setQueue] = useState<'maintenance' | 'security'>('maintenance');
  const reports = useReports();
  const trips = useTrips();
  const settings = useProfileSettings();
  const factor = period === 'month' ? 4 : period === 'today' ? 0.15 : 1;
  const points = criticalPoints.filter(
    (point) => category === 'all' || point.category === category,
  );
  const count = (value: number) => Math.round(value * factor).toLocaleString('pt-BR');
  return (
    <MunicipalityShell
      section="dashboard"
      title="Visão geral · Bela Vista e Consolação"
      subtitle="Relatos de pedestres e alertas do SafeWalk · dados de exemplo"
    >
      <View style={s.filters}>
        <MunicipalityFilter label="Período" value={period} options={periods} onChange={setPeriod} />
        <MunicipalityFilter
          label="Tipo"
          value={category}
          options={municipalCategories}
          onChange={setCategory}
        />
        <Button
          label="Exportar relatório"
          icon="download"
          variant="secondary"
          onPress={() => router.push('/prefeitura-relatorio')}
        />
      </View>
      <View style={s.metrics}>
        <MunicipalityMetric
          label="Relatos recebidos"
          value={count(1248)}
          detail="+12% vs. período anterior · exemplo"
        />
        <MunicipalityMetric
          label="SOS confirmados"
          value={count(37)}
          detail={`${count(9)} com acionamento simulado da GCM`}
        />
        <MunicipalityMetric
          label="Solicitações SP156 abertas"
          value={count(214)}
          detail={`${count(58)} novas · dados fictícios`}
        />
        <MunicipalityMetric
          label="Tempo médio de resolução"
          value="6,2 dias"
          detail="−1,1 dia · indicador ilustrativo"
        />
      </View>
      <View style={[s.columns, width > 900 && s.columnsWide]}>
        <View style={[s.mainColumn, width > 900 && s.mainColumnWide]}>
          <Card>
            <View style={ui.between}>
              <AppText variant="heading">Pontos críticos</AppText>
              <Badge label="Mapa ilustrativo" />
            </View>
            <View style={s.filters}>
              <Badge label="Segurança" tone="danger" />
              <Badge label="Zeladoria" />
              <Badge label="Clima" tone="warning" />
              <Badge label="Câmera Smart Sampa" />
            </View>
            <View style={s.map}>
              <MapScene />
              <View style={s.mapLabel}>
                <Badge label={`${points.length} pontos · dados de exemplo`} />
              </View>
            </View>
            <View style={s.filters}>
              {points.map((point) => (
                <Pressable
                  key={point.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${point.street}`}
                  onPress={() =>
                    router.push({ pathname: '/prefeitura-ponto', params: { id: point.id } })
                  }
                  style={s.chip}
                >
                  <AppText variant="small" tone="primary">
                    {count(point.reports)} · {point.street}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>
        <View style={[s.column, width > 900 && s.columnWide]}>
          <Card>
            <MunicipalityFilter
              label="Fila"
              value={queue}
              options={[
                { key: 'maintenance', label: 'Zeladoria · SP156' },
                { key: 'security', label: 'Segurança · GCM' },
              ]}
              onChange={setQueue}
            />
            <AppText variant="heading">
              {queue === 'maintenance' ? 'Fila de solicitações' : 'Alertas de segurança'}
            </AppText>
            <AppText variant="small" tone="muted">
              Dados fictícios · por nº de relatos
            </AppText>
            {queue === 'maintenance' ? (
              maintenanceQueue
                .filter((item) => category !== 'weather' || item.title === 'Alagamento')
                .map((item) => (
                  <Pressable
                    key={item.protocol}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/prefeitura-ponto', params: { id: item.pointId } })
                    }
                    style={s.row}
                  >
                    <View style={ui.between}>
                      <AppText variant="label">{item.title}</AppText>
                      <Badge
                        label={item.status}
                        tone={item.status === 'Resolvido' ? 'success' : 'neutral'}
                      />
                    </View>
                    <AppText variant="small" tone="muted">
                      {item.address} · {item.protocol}
                    </AppText>
                    <AppText variant="small" tone="primary">
                      {count(item.reports)} relatos
                    </AppText>
                  </Pressable>
                ))
            ) : (
              <>
                <AppText tone="muted">
                  Consulte o fluxo de atendimento e as câmeras de exemplo na Central GCM.
                </AppText>
                <Button
                  label="Abrir Central GCM"
                  icon="radio"
                  onPress={() => router.push('/prefeitura-central')}
                />
              </>
            )}
          </Card>
        </View>
      </View>
      <Card>
        <AppText variant="heading">Pontos críticos priorizados</AppText>
        <AppText variant="small" tone="muted">
          Ordenação ilustrativa pelo score de risco · deslize a tabela para ver todas as colunas
        </AppText>
        <ScrollView horizontal>
          <View style={s.table}>
            <View style={[s.tableRow, s.tableHeader]}>
              <AppText variant="label" style={s.tableNumber}>
                #
              </AppText>
              <AppText variant="label" style={s.tableLocation}>
                Local
              </AppText>
              <AppText variant="label" style={s.tableCell}>
                Risco predominante
              </AppText>
              <AppText variant="label" style={s.tableSmall}>
                Relatos
              </AppText>
              <AppText variant="label" style={s.tableSmall}>
                Horário
              </AppText>
              <AppText variant="label" style={s.tableSmall}>
                Câmeras
              </AppText>
              <AppText variant="label" style={s.tableAction}>
                Ação sugerida / status
              </AppText>
            </View>
            {points.map((point) => (
              <Pressable
                key={point.id}
                accessibilityRole="button"
                accessibilityLabel={`Ver ponto crítico ${point.street}`}
                style={s.tableRow}
                onPress={() =>
                  router.push({ pathname: '/prefeitura-ponto', params: { id: point.id } })
                }
              >
                <AppText style={s.tableNumber}>{criticalPoints.indexOf(point) + 1}</AppText>
                <AppText tone="primary" style={s.tableLocation}>
                  {point.street}
                </AppText>
                <AppText style={s.tableCell}>{point.label}</AppText>
                <AppText style={s.tableSmall}>{count(point.reports)}</AppText>
                <AppText variant="small" style={s.tableSmall}>
                  {point.time}
                </AppText>
                <AppText style={s.tableSmall}>{point.cameras}</AppText>
                <View style={s.tableAction}>
                  <AppText variant="small">{point.suggestion}</AppText>
                  <Badge label={point.status} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Card>
      <Card>
        <View style={ui.between}>
          <AppText variant="heading">Registros da sua conta</AppText>
          <Icon name="lock" size={18} color={colors.muted} />
        </View>
        <AppText variant="small" tone="muted">
          Dados privados separados dos indicadores ilustrativos acima.
        </AppText>
        <MunicipalityLoading
          loading={settings.isPending}
          error={settings.error}
          onRetry={() => {
            void settings.refetch();
          }}
        >
          {settings.data?.contributeReports ? (
            <MunicipalityLoading
              loading={reports.isPending || trips.isPending}
              error={reports.error ?? trips.error}
              onRetry={() => {
                void reports.refetch();
                void trips.refetch();
              }}
            >
              <AppText>
                {trips.data?.length ?? 0} trajetos · {reports.data?.length ?? 0} relatos
              </AppText>
              {reports.data?.length ? (
                reports.data.slice(0, 3).map((report) => (
                  <View key={report.id} style={s.row}>
                    <AppText variant="label">{reportLabels[report.type]}</AppText>
                    <AppText variant="small" tone="muted">
                      {report.address}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText tone="muted">
                  Nenhum relato nesta conta. Envie um pelo aplicativo para vê-lo aqui.
                </AppText>
              )}
            </MunicipalityLoading>
          ) : (
            <AppText tone="muted">
              Contribuição desativada nas preferências de privacidade. Nenhum registro da sua conta
              é incluído nesta apresentação.
            </AppText>
          )}
        </MunicipalityLoading>
      </Card>
    </MunicipalityShell>
  );
}
