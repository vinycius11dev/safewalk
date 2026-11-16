import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  useUiStyles,
} from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { MunicipalityShell } from './municipality-shell';
import {
  MunicipalityChart,
  MunicipalityLoading,
  MunicipalityMetric,
} from './municipality-components';
import { criticalPoints } from './municipality.model';
import { useMunicipalityPoint } from './use-municipality-point';
import { createMunicipalityStyles } from './municipality.styles';

export function MunicipalityPointScreen() {
  const { id = 'augusta' } = useLocalSearchParams<{ id?: string }>();
  const point = criticalPoints.find((item) => item.id === id);
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const ui = useUiStyles();
  const { width } = useWindowDimensions();
  const { query, update } = useMunicipalityPoint(id);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  if (!point)
    return (
      <MunicipalityShell
        section="critical"
        title="Ponto não encontrado"
        subtitle="Este ponto não faz parte da demonstração."
      >
        <Button label="Voltar à visão geral" onPress={() => router.replace('/prefeitura')} />
      </MunicipalityShell>
    );
  const rank = criticalPoints.indexOf(point) + 1;
  const chart = [4, 5, 6, 7, 12, 9, 5].map((value, index) => ({
    label: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][index] ?? '',
    value: Math.max(1, Math.round((value * point.reports) / 48)),
  }));
  const save = (change: { gcm?: boolean; sp156?: boolean }) => {
    if (!query.data) return;
    update.mutate(
      { ...query.data, ...change, note: draftNote ?? query.data.note },
      {
        onSuccess: () =>
          setFeedback('Registro salvo localmente. Nenhum órgão público foi acionado.'),
      },
    );
  };
  return (
    <MunicipalityShell
      section="critical"
      title={point.street}
      subtitle="Consolação · Subprefeitura Sé · últimos 7 dias · dados de exemplo"
    >
      <View style={s.filters}>
        <Badge
          label={`${point.category === 'security' ? 'Segurança' : point.category === 'weather' ? 'Clima' : 'Zeladoria'} · ${point.label.toLowerCase()}`}
          tone={point.category === 'security' ? 'danger' : 'warning'}
        />
        <Badge label={`${rank}º no ranking de risco ilustrativo`} />
      </View>
      <View style={s.metrics}>
        <MunicipalityMetric label="Relatos" value={point.reports} />
        <MunicipalityMetric
          label="SOS no local"
          value={point.category === 'security' ? 11 : 0}
          detail="Dados fictícios"
        />
        <MunicipalityMetric label="Horário crítico" value={point.time} />
        <MunicipalityMetric
          label="Câmeras Smart Sampa"
          value={point.cameras}
          detail="Posições ilustrativas"
        />
      </View>
      <View style={[s.columns, width > 900 && s.columnsWide]}>
        <View style={[s.mainColumn, width > 900 && s.mainColumnWide]}>
          <Card>
            <AppText variant="heading">Relatos por dia</AppText>
            <AppText variant="small" tone="muted">
              Sexta concentra 1 em cada 4 relatos · exemplo
            </AppText>
            <MunicipalityChart
              values={chart}
              color={point.category === 'security' ? colors.danger : colors.primary}
            />
          </Card>
          <Card>
            <AppText variant="heading">Últimos relatos</AppText>
            <Badge label="Eventos fictícios do protótipo" />
            {[
              [
                'Hoje, 22:39',
                point.category === 'security'
                  ? 'Roubo de celular, dois homens de moto'
                  : `${point.label} no trecho`,
                'Relato · 5 confirmações',
              ],
              [
                'Hoje, 21:10',
                'SOS por detecção automática, cancelado com PIN',
                'SafeWalk · exemplo',
              ],
              [
                'Ontem, 19:42',
                point.category === 'security'
                  ? 'Roubo de celular na saída do metrô'
                  : 'Passagem de pedestres prejudicada',
                'Registro ilustrativo',
              ],
              ['Ontem, 18:55', 'Pedestre relatou dificuldade no trecho', 'Relato · 3 confirmações'],
              ['Sex, 20:20', 'Pouca iluminação perto do nº 1200', 'Relato · zeladoria'],
            ].map(([time, title, source]) => (
              <View key={time} style={s.row}>
                <AppText variant="small" tone="muted">
                  {time}
                </AppText>
                <AppText variant="label">{title}</AppText>
                <AppText variant="small" tone="muted">
                  {source}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
        <View style={[s.column, width > 900 && s.columnWide]}>
          <Card>
            <View style={s.map}>
              <MapScene />
              <View style={s.mapLabel}>
                <Badge label="Trecho ilustrativo" />
              </View>
            </View>
          </Card>
          <Card>
            <AppText variant="heading">Encaminhamentos</AppText>
            <MunicipalityLoading
              loading={query.isPending}
              error={query.error}
              onRetry={() => {
                void query.refetch();
              }}
            >
              <ErrorNotice error={update.error} />
              <View style={s.row}>
                <View style={[ui.between, s.wrap]}>
                  <AppText variant="subtitle">GCM · reforço de patrulha</AppText>
                  <Badge
                    label={query.data?.gcm ? 'Registrado na simulação' : 'Em análise'}
                    tone={query.data?.gcm ? 'success' : 'neutral'}
                  />
                </View>
                <AppText tone="muted">
                  Sugestão: patrulha a pé de sexta a domingo, das 18h às 21h.
                </AppText>
                <Button
                  label={
                    query.data?.gcm
                      ? 'Encaminhamento simulado registrado'
                      : 'Simular encaminhamento à GCM'
                  }
                  variant="secondary"
                  disabled={query.data?.gcm}
                  loading={update.isPending}
                  onPress={() => save({ gcm: true })}
                />
              </View>
              <View style={s.row}>
                <View style={[ui.between, s.wrap]}>
                  <AppText variant="subtitle">SP156 · iluminação</AppText>
                  <Badge
                    label={query.data?.sp156 ? 'Solicitação simulada' : 'Sem solicitação'}
                    tone={query.data?.sp156 ? 'success' : 'neutral'}
                  />
                </View>
                <AppText tone="muted">
                  7 relatos citam pouca luz no trecho entre os nº 1100 e 1300.
                </AppText>
                <Button
                  label={
                    query.data?.sp156
                      ? 'Solicitação simulada registrada'
                      : 'Simular solicitação no SP156'
                  }
                  variant="secondary"
                  disabled={query.data?.sp156}
                  loading={update.isPending}
                  onPress={() => save({ sp156: true })}
                />
              </View>
              <Field
                label="Observações da equipe"
                multiline
                maxLength={280}
                value={draftNote ?? query.data?.note ?? ''}
                onChangeText={setDraftNote}
                placeholder="Ex.: comerciantes relatam ação de grupo em bicicletas"
              />
              <Button
                label="Salvar observações"
                loading={update.isPending}
                onPress={() => save({})}
              />
              {feedback ? (
                <AppText accessibilityRole="status" tone="success">
                  {feedback}
                </AppText>
              ) : null}
            </MunicipalityLoading>
          </Card>
        </View>
      </View>
    </MunicipalityShell>
  );
}
