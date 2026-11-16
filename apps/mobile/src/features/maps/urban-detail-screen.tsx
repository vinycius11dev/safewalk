import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { urbanLayerTypeSchema, type UrbanFeature, type UrbanLayerType } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { RealMap } from '@/components/map/real-map';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { featureLocation, layerLabels, readableDate } from './map-data';
import { PILOT_BOUNDS, type MapBounds } from './maps.service';
import { useMapConsent, useUrbanLayers, useUrbanSources } from './use-map-data';
import { useMapJourney } from './use-map-journey';
import { createUrbanDataStyles } from './urban-data.styles';

const sourceTypes: Record<string, UrbanLayerType> = {
  'geosampa-sidewalks': 'sidewalks',
  'geosampa-lighting': 'lighting',
  'geosampa-crossings': 'crossings',
  'osm-signals': 'crossings',
  'geosampa-flood-history': 'flood_history',
  'geosampa-flood-risk': 'flood_risk',
  'sgb-flood-susceptibility': 'flood_susceptibility',
  'geosampa-accessibility': 'accessibility',
  'geosampa-health': 'health',
  'osm-hospitals': 'health',
  'geosampa-police': 'police',
  'osm-police': 'police',
  sp156: 'sp156',
  infosiga: 'pedestrian_crashes',
};
const fieldLabels: Record<string, string> = {
  minimumWidthMeters: 'Largura mínima cadastrada',
  meanWidthMeters: 'Largura média cadastrada',
  maximumWidthMeters: 'Largura máxima cadastrada',
  minimumInclinePercent: 'Declividade mínima cadastrada',
  meanInclinePercent: 'Declividade média cadastrada',
  maximumInclinePercent: 'Declividade máxima cadastrada',
  sourceSurveyDate: 'Data de vistoria',
  currentSurfaceCondition: 'Conservação atual do piso',
  assessedAccessible: 'Acessibilidade do trecho',
  currentConditionUnknown: 'Condição atual',
  luminaireType: 'Tipo de luminária',
  sourceLoadAt: 'Data de carga do cadastro',
  operatingStatus: 'Funcionamento atual',
  signalType: 'Tipo de semáforo',
  pedestrianAccessibility: 'Acessibilidade da travessia',
  eventStatus: 'Natureza do registro',
  occurrenceType: 'Tipo de ocorrência',
  districtAdministration: 'Subprefeitura',
  liveFlood: 'Alagamento em andamento',
  modelUpdatedAt: 'Atualização do modelo',
  returnPeriodYears: 'Período de retorno do modelo',
  modelDepthMeters: 'Profundidade modelada',
  modelAreaSquareMeters: 'Área modelada',
  susceptibilityClass: 'Classe de suscetibilidade',
  studyYear: 'Ano indicado na base',
  municipality: 'Município',
  sourceExecution: 'Execução informada pela fonte',
  sourceExecutor: 'Executor',
  sourceProject: 'Projeto',
  sourceDescription: 'Descrição da fonte',
  sealYear: 'Ano do selo cadastrado',
  establishmentUse: 'Uso do estabelecimento',
  address: 'Endereço cadastrado',
  safeWalkPartner: 'Parceria SafeWalk',
  routeAccessibility: 'Acessibilidade do caminho',
  equipmentType: 'Tipo de equipamento',
  openingHours: 'Horário informado na base',
  emergencyService: 'Atendimento de emergência',
  attendance: 'Atendimento e plantão',
  service: 'Serviço solicitado',
  subject: 'Assunto',
  status: 'Situação do protocolo na base',
  street: 'Logradouro',
  streetNumber: 'Número',
  closedAt: 'Data de finalização do protocolo',
  datePrecision: 'Precisão da data',
  originalCoordinate: 'Origem da localização',
  repaired: 'Execução do reparo',
  recordType: 'Tipo do registro',
  pedestrianInvolved: 'Pedestre envolvido',
  coordinatePrecision: 'Precisão da localização',
  pedestrianCrossing: 'Travessia de pedestres (cadastro)',
  audibleSignal: 'Sinal sonoro (cadastro)',
  collaborativeSource: 'Origem do cadastro',
};
function calendarDate(value: string): string {
  return value.slice(0, 10).split('-').reverse().join('/');
}
function fieldValue(key: string, value: string | number | boolean | null): string {
  if (value === null || value === '') return 'Não informado pela fonte';
  if (key === 'currentConditionUnknown') return 'Não verificada nesta consulta';
  if (key === 'assessedAccessible') return 'Não avaliada';
  if (key === 'liveFlood') return 'Este registro não confirma alagamento ativo';
  if (key === 'safeWalkPartner') return 'Parceria não verificada';
  if (key === 'originalCoordinate') return 'Coordenada original do recurso público';
  if (key === 'datePrecision') return 'Data civil, sem horário informado';
  if (key === 'recordType') {
    if (value === 'NOTIFICACAO') return 'Notificação; sinistro não confirmado';
    if (value === 'SINISTRO FATAL') return 'Sinistro fatal; não indica quem foi vítima fatal';
    if (value === 'SINISTRO NAO FATAL') return 'Sinistro não fatal';
  }
  if (key === 'coordinatePrecision') return 'Não informada pela fonte';
  if (key === 'collaborativeSource')
    return 'OpenStreetMap, mapeado por voluntários; pode estar incompleto ou desatualizado';
  if (
    typeof value === 'string' &&
    ['sourceSurveyDate', 'sourceLoadAt', 'modelUpdatedAt', 'closedAt'].includes(key)
  )
    return calendarDate(value);
  if (value === 'unknown' || value === 'not_verified') return 'Não verificado';
  if (value === 'not_assessed') return 'Não avaliada';
  if (value === 'historical') return 'Histórico';
  if (typeof value === 'number') {
    if (key === 'sealYear') return String(value);
    const unit = key.endsWith('SquareMeters')
      ? ' m²'
      : key.endsWith('Meters')
        ? ' m'
        : key.endsWith('Percent')
          ? ' %'
          : key === 'returnPeriodYears'
            ? ' anos'
            : '';
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${unit}`;
  }
  return typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value;
}

export function UrbanDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    type?: string;
    bbox?: string;
    from?: string;
  }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const typeResult = urbanLayerTypeSchema.safeParse(params.type);
  const type = typeResult.success ? typeResult.data : sourceTypes[id.split(':')[0] ?? ''];
  const bbox = useMemo<MapBounds>(() => {
    if (typeof params.bbox !== 'string') return PILOT_BOUNDS;
    const values = params.bbox.split(',').map(Number);
    return values.length === 4 && values.every(Number.isFinite)
      ? (values as MapBounds)
      : PILOT_BOUNDS;
  }, [params.bbox]);
  const consent = useMapConsent();
  const query = useUrbanLayers(bbox, type ? [type] : [], Boolean(type && params.from !== 'route'));
  const sources = useUrbanSources();
  const { journey } = useMapJourney();
  const snapshot = journey.selectedRoute?.context;
  const snapshotFeature = snapshot?.nearbyFeatures.find((feature) => feature.id === id);
  const feature =
    params.from === 'route' ? undefined : query.data?.features.find((item) => item.id === id);
  const properties: UrbanFeature['properties'] | undefined =
    feature?.properties ?? snapshotFeature?.properties;
  const source =
    params.from === 'route'
      ? snapshot?.sources.find((item) => item.id === properties?.sourceId)
      : (query.data?.sources.find((item) => item.id === properties?.sourceId) ??
        sources.data?.sources.find((item) => item.id === properties?.sourceId) ??
        snapshot?.sources.find((item) => item.id === properties?.sourceId));
  const { colors } = useTheme();
  const s = useMemo(() => createUrbanDataStyles(colors), [colors]);
  const [linkError, setLinkError] = useState<Error | null>(null);
  const isLoading =
    params.from !== 'route' &&
    Boolean(type) &&
    (consent.isPending || Boolean(consent.data?.enabled && query.isPending));
  return (
    <Protected>
      <Screen title="Detalhes do registro">
        {isLoading && (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} />
            <AppText tone="muted">Carregando o registro e sua origem…</AppText>
          </View>
        )}
        <ErrorNotice error={query.error ?? sources.error ?? consent.error ?? linkError} />
        {query.isError && (
          <Button
            label="Tentar novamente"
            variant="secondary"
            onPress={() => {
              void query.refetch();
            }}
          />
        )}
        {!properties && !isLoading && (
          <Card>
            <Icon name="map-pin" color={colors.primaryText} />
            <AppText variant="heading">Registro não disponível nesta consulta</AppText>
            <AppText tone="muted">
              Ele pode estar fora da área piloto, da seleção atual ou do limite de registros da
              fonte. Isso não significa que a situação foi resolvida.
            </AppText>
            {!consent.data?.enabled && (
              <Button label="Serviços do mapa" onPress={() => router.push('/servicos-mapa')} />
            )}
            <Button
              label="Consultar dados urbanos"
              variant="secondary"
              onPress={() => router.replace('/dados-urbanos')}
            />
          </Card>
        )}
        {properties && (
          <>
            <Badge label={layerLabels[properties.type]} />
            <AppText variant="title">{properties.title}</AppText>
            <AppText tone="muted">
              {properties.type === 'flood_susceptibility'
                ? typeof properties.details.studyYear === 'number'
                  ? `Ano indicado na base: ${properties.details.studyYear}`
                  : 'Ano não informado pela fonte'
                : properties.observedAt
                  ? `Data do registro na fonte: ${calendarDate(properties.observedAt)}`
                  : 'Data de vistoria não informada pela fonte'}
            </AppText>
            <View style={s.notice}>
              <AppText variant="small">
                Condição atual não verificada. Este registro não certifica segurança, passagem livre
                ou acessibilidade do caminho.
              </AppText>
            </View>
            {feature && consent.data?.enabled && (
              <View style={s.map}>
                <RealMap
                  center={featureLocation(feature)}
                  urbanFeatures={{ type: 'FeatureCollection', features: [feature] }}
                  zoom={16}
                  showControls={false}
                  accessibilityLabel={`Geometria original do registro: ${properties.title}`}
                />
              </View>
            )}
            {!feature && snapshotFeature && (
              <Card>
                <AppText variant="subtitle">Registro preservado na consulta da rota</AppText>
                <AppText variant="small" tone="muted">
                  O resumo guarda os atributos próximos ao trajeto, sem a geometria individual. Não
                  criamos um ponto aproximado.
                </AppText>
                <AppText variant="small">
                  Consulta do contexto: {readableDate(snapshot?.checkedAt)}
                </AppText>
              </Card>
            )}
            {properties.type === 'sp156' && (
              <Card>
                <AppText variant="subtitle">O que significa a situação do protocolo</AppText>
                <AppText>
                  “Finalizada” se refere ao encerramento da solicitação no SP156. A base não
                  comprova que o reparo foi realizado ou que o trecho está acessível hoje.
                </AppText>
              </Card>
            )}
            {properties.type === 'pedestrian_crashes' && (
              <Card>
                <AppText variant="subtitle">Como interpretar este registro</AppText>
                <AppText>
                  É um registro histórico envolvendo pedestre. A localização tem precisão
                  desconhecida e pode não corresponder ao ponto exato. Notificações não confirmam
                  sinistro, e um sinistro fatal não identifica quem faleceu. Não indica risco atual.
                </AppText>
              </Card>
            )}
            {properties.type === 'flood_risk' && (
              <Card>
                <AppText variant="subtitle">Esta área é um modelo</AppText>
                <AppText>
                  O período de retorno descreve o cenário hidrológico do estudo. Não indica água
                  observada nem previsão de inundação para hoje.
                </AppText>
              </Card>
            )}
            {properties.type === 'flood_susceptibility' && (
              <Card>
                <AppText variant="subtitle">Carta de suscetibilidade do SGB</AppText>
                <AppText>
                  A classe descreve a suscetibilidade modelada da área na época do estudo. Não
                  indica alagamento atual, previsão imediata ou segurança para pedestres.
                </AppText>
              </Card>
            )}
            {properties.type === 'health' && (
              <Card>
                <AppText variant="subtitle">Equipamento de saúde cadastrado</AppText>
                <AppText>
                  Confirme atendimento, horário e condições de acesso com o estabelecimento. Este
                  cadastro não comprova emergência 24 horas, acolhimento ou parceria SafeWalk. Em
                  emergência médica, ligue 192 (SAMU).
                </AppText>
              </Card>
            )}
            {properties.type === 'police' && (
              <Card>
                <AppText variant="subtitle">Delegacia cadastrada</AppText>
                <AppText>
                  Horário e plantão não foram verificados; algumas delegacias não funcionam 24
                  horas. O boletim de ocorrência também pode ser feito pela Delegacia Eletrônica da
                  Polícia Civil. Em emergência, ligue 190.
                </AppText>
              </Card>
            )}
            <Card>
              <AppText variant="heading">Informações da base</AppText>
              {Object.entries(properties.details)
                .filter(([key]) => fieldLabels[key])
                .map(([key, value]) => (
                  <View key={key} style={s.field}>
                    <AppText variant="small" tone="muted">
                      {fieldLabels[key]}
                    </AppText>
                    <AppText selectable style={s.fieldValue}>
                      {fieldValue(key, value)}
                    </AppText>
                  </View>
                ))}
            </Card>
            {source ? (
              <Card>
                <AppText variant="heading">Fonte e atualização</AppText>
                <AppText variant="subtitle">{source.name}</AppText>
                <Badge
                  label={
                    source.status === 'available'
                      ? 'Consulta disponível'
                      : source.status === 'stale'
                        ? 'Cópia desatualizada'
                        : source.status === 'not_configured'
                          ? 'Importação pendente'
                          : 'Origem indisponível'
                  }
                  tone={source.status === 'available' ? 'neutral' : 'warning'}
                />
                <AppText>{source.message}</AppText>
                <View style={s.field}>
                  <AppText variant="small" tone="muted">
                    Referência da base
                  </AppText>
                  <AppText>
                    {source.asOf
                      ? source.id.startsWith('geosampa-') || source.id === 'cge-floods'
                        ? calendarDate(source.asOf)
                        : readableDate(source.asOf)
                      : 'Não informada pela fonte'}
                  </AppText>
                </View>
                <View style={s.field}>
                  <AppText variant="small" tone="muted">
                    Última consulta ou importação
                  </AppText>
                  <AppText>{readableDate(source.fetchedAt)}</AppText>
                </View>
                <View style={s.field}>
                  <AppText variant="small" tone="muted">
                    Validade desta consulta
                  </AppText>
                  <AppText>{readableDate(source.expiresAt)}</AppText>
                </View>
                <AppText variant="small">{source.coverage}</AppText>
                <AppText variant="small" tone="muted">
                  {source.attribution}
                </AppText>
                <AppText variant="small" tone="muted">
                  Licença: {source.license}
                </AppText>
                <Button
                  label="Abrir fonte oficial"
                  icon="external-link"
                  variant="secondary"
                  onPress={() => {
                    setLinkError(null);
                    void Linking.openURL(source.sourceUrl).catch(() =>
                      setLinkError(new Error('Não foi possível abrir a fonte. Tente novamente.')),
                    );
                  }}
                />
              </Card>
            ) : (
              <Card>
                <AppText tone="muted">
                  A proveniência desta cópia não está disponível. Consulte as fontes antes de
                  interpretar o registro.
                </AppText>
              </Card>
            )}
            {query.data?.truncated && (
              <AppText variant="small" tone="muted">
                A consulta tem limites de área ou paginação; este registro faz parte de uma
                cobertura parcial.
              </AppText>
            )}
            <Button
              label="Ver todas as fontes"
              variant="ghost"
              onPress={() => router.push('/fontes-dados')}
            />
          </>
        )}
      </Screen>
    </Protected>
  );
}
