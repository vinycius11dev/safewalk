import { useMemo } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import type { FloodRouteAssessment, UrbanFeature, UrbanLayersResponse } from '@safewalk/contracts';
import { AppText, Badge, Button, ErrorNotice } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { featureExplanation, layerLabels, readableDate, readableObservation } from './map-data';
import { routeRain, routeFloodTypes } from './route-map-conditions';
import { floodAssessmentBadge } from './route-flood-presentation';
import { createRouteConditionsStyles } from './route-conditions.styles';

export function RouteConditions({
  data,
  assessment,
  refreshing,
  error,
  accessible,
  now,
  onRefresh,
}: {
  data?: UrbanLayersResponse;
  assessment?: FloodRouteAssessment;
  refreshing: boolean;
  error: unknown;
  accessible: boolean;
  now: number;
  onRefresh: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRouteConditionsStyles(colors), [colors]);
  const rain = assessment?.weatherCondition ?? routeRain(data, now);
  const floodCount =
    data?.features.filter((f) => routeFloodTypes.has(f.properties.type)).length ?? 0;
  const cge = data?.floodSummary;
  const cgeActiveCount = cge ? cge.activePassableForVehicles + cge.activeImpassableForVehicles : 0;
  const modelSource = data?.sources
    .filter((source) =>
      ['flood_history', 'flood_risk', 'flood_susceptibility'].includes(source.type),
    )
    .sort((a, b) => Date.parse(b.fetchedAt ?? '') - Date.parse(a.fetchedAt ?? ''))[0];
  const assessmentBadge = assessment ? floodAssessmentBadge(assessment) : null;
  return (
    <View style={s.section}>
      <AppText variant="subtitle">Condições ao longo do percurso</AppText>
      <View style={s.legend}>
        {[
          { color: s.yellow, label: 'Calçada / iluminação' },
          { color: s.red, label: 'Solicitações SP156' },
          { color: s.blue, label: 'Água / travessias' },
          { color: s.gray, label: 'Histórico / modelo' },
        ].map((item) => (
          <View key={item.label} style={s.item}>
            <View style={[s.dot, item.color]} />
            <AppText variant="small">{item.label}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="small" tone="muted">
        Toque em um ponto ou área do mapa para ver o problema, a fonte e a data. Cores identificam
        categorias.
      </AppText>
      {accessible && <Badge label="Acessibilidade: rota para evitar escadas" />}
      <View style={s.weather}>
        {assessmentBadge && <Badge label={assessmentBadge.label} tone={assessmentBadge.tone} />}
        <AppText variant="label">
          {rain === 'raining'
            ? 'Chuva estimada na região do percurso'
            : rain === 'dry'
              ? 'Sem chuva indicada nesta consulta'
              : rain === 'stale'
                ? 'Dados de chuva desatualizados'
                : refreshing
                  ? 'Consultando chuva na região'
                  : 'Chuva indisponível nesta consulta'}
        </AppText>
        <AppText variant="small" tone="muted">
          {assessment?.summary ??
            (rain === 'raining'
              ? `${floodCount} registros de inundação próximos destacados no mapa. São áreas para atenção com chuva; não confirmam água na via.`
              : rain === 'dry'
                ? 'Áreas com histórico ou suscetibilidade a inundação continuam visíveis no mapa.'
                : 'A chuva é estimada por modelo meteorológico. Quando indisponível, o aplicativo mantém os registros conhecidos de inundação.')}
        </AppText>
        {assessment?.recommendation === 'avoid' && (
          <AppText variant="small" tone="danger">
            Confira a ocorrência e a rota alternativa antes de continuar.
          </AppText>
        )}
        {assessment?.sourceStatus === 'aggregate_only' && cge && (
          <AppText variant="small" tone="muted">
            CGE · {readableObservation(cge.date, 'cge-floods')} ·{' '}
            {countLabel(cgeActiveCount, 'ocorrência ativa', 'ocorrências ativas')} na cidade. A
            fonte não informa coordenadas para associá-las a esta rota.
            {assessment.profile === 'pedestrian'
              ? ' A classificação de trânsito vale para veículos, não para calçadas.'
              : ' Os totais não permitem confirmar se há bloqueio neste trajeto.'}
          </AppText>
        )}
        {assessment?.recommendation === 'lower_known_exposure' && (
          <AppText variant="small" tone="muted">
            A preferência considera registros conhecidos nesta consulta, com cobertura parcial; não
            certifica que o caminho esteja livre.
          </AppText>
        )}
        {assessment?.coveragePartial && (
          <AppText variant="small" tone="muted">
            Cobertura parcial. A falta de registros não confirma ausência de alagamento.
          </AppText>
        )}
        {data?.weather && (
          <AppText variant="small" tone="muted">
            Open-Meteo · {readableDate(data.weather.observedAt)}
          </AppText>
        )}
        {modelSource?.fetchedAt && (
          <AppText variant="small" tone="muted">
            Dados históricos/modelados · consultados em {readableDate(modelSource.fetchedAt)}
          </AppText>
        )}
      </View>
      {refreshing && (
        <View style={s.item}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="small" tone="muted">
            Atualizando as fontes deste percurso…
          </AppText>
        </View>
      )}
      <ErrorNotice error={error} />
      {data && (
        <AppText variant="small" tone="muted">
          {data.features.length} registros próximos · faixa aproximada de 50 m · cobertura parcial
          {data.features.length > 300 ? ' · até 300 desenhados por consulta' : ''}.{' '}
          {accessible
            ? 'Rampas, piso e continuidade do caminho ainda dependem da cobertura das bases.'
            : ''}
        </AppText>
      )}
      {!refreshing && (
        <Button label="Atualizar condições do percurso" variant="ghost" onPress={onRefresh} />
      )}
    </View>
  );
}

export function RouteUrbanRecord({
  feature,
  data,
  onClose,
}: {
  feature: UrbanFeature;
  data?: UrbanLayersResponse;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRouteConditionsStyles(colors), [colors]);
  const source = data?.sources.find((item) => item.id === feature.properties.sourceId);
  const area = ['Polygon', 'MultiPolygon'].includes(feature.geometry.type);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, area && s.areaSheet]} accessibilityViewIsModal>
          <ScrollView style={s.scroll} contentContainerStyle={s.body}>
            <Badge label={layerLabels[feature.properties.type]} />
            <AppText variant="heading">{feature.properties.title}</AppText>
            {area && (
              <AppText variant="small" tone="muted">
                Contorno selecionado no mapa. O marcador representa a área cadastrada.
              </AppText>
            )}
            <AppText>{featureExplanation(feature)}</AppText>
            {feature.properties.type === 'crossings' && (
              <>
                {typeof feature.properties.details.signalType === 'string' &&
                  feature.properties.details.signalType.trim() && (
                    <AppText variant="small">
                      Tipo cadastrado: {feature.properties.details.signalType}
                    </AppText>
                  )}
                {typeof feature.properties.details.sourceLoadAt === 'string' && (
                  <AppText variant="small" tone="muted">
                    Atualização cadastral: {readableDate(feature.properties.details.sourceLoadAt)}
                  </AppText>
                )}
                <AppText variant="small" tone="muted">
                  Funcionamento, sinal sonoro e tempo de travessia não informados pela fonte.
                </AppText>
              </>
            )}
            <AppText variant="small" tone="muted">
              Registro:{' '}
              {readableObservation(feature.properties.observedAt, feature.properties.sourceId)}
            </AppText>
            <AppText variant="label">{source?.name ?? feature.properties.sourceId}</AppText>
            {source && (
              <AppText variant="small" tone="muted">
                Consulta: {readableDate(source.fetchedAt)}
                {source.status === 'stale' ? ' · atualização vencida' : ''}
              </AppText>
            )}
            <AppText variant="small" tone="muted">
              O registro está próximo do traçado, mas pode estar em outra calçada ou lado da via.
              Confira a condição no local.
            </AppText>
          </ScrollView>
          <Button label="Voltar ao percurso" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
