import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { UrbanFeature, UrbanLayerType } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { layerLabels, readableDate } from './map-data';
import { PILOT_BOUNDS, type MapBounds } from './maps.service';
import { useMapConsent, useUrbanLayers, useUrbanSources } from './use-map-data';
import { useMapLayers } from './use-map-journey';
import { createUrbanDataStyles } from './urban-data.styles';

const icons: Record<UrbanFeature['properties']['category'], ComponentProps<typeof Icon>['name']> = {
  flood: 'cloud-rain',
  sidewalk: 'map',
  lighting: 'sun',
  crossing: 'flag',
  'safe-place': 'plus-square',
  other: 'map-pin',
};
const pageSize = 30;
function requestedBounds(value: string | undefined): MapBounds | null {
  if (!value || value.length > 120) return null;
  const numbers = value.split(',').map(Number);
  if (numbers.length !== 4 || !numbers.every(Number.isFinite)) return null;
  const [west, south, east, north] = numbers as MapBounds;
  if (
    west >= east ||
    south >= north ||
    east - west > 0.080001 ||
    north - south > 0.080001 ||
    west < -46.85 ||
    east > -46.35 ||
    south < -24.05 ||
    north > -23.35
  )
    return null;
  return [west, south, east, north];
}

export function UrbanListScreen() {
  const params = useLocalSearchParams<{ bbox?: string }>();
  const selectedBounds = useMemo(
    () => requestedBounds(typeof params.bbox === 'string' ? params.bbox : undefined),
    [params.bbox],
  );
  const bbox = selectedBounds ?? PILOT_BOUNDS;
  const isPilot = bbox.every(
    (value, index) => Math.abs(value - (PILOT_BOUNDS[index] ?? value)) < 0.00001,
  );
  const { colors } = useTheme();
  const s = useMemo(() => createUrbanDataStyles(colors), [colors]);
  const { layers } = useMapLayers();
  const consent = useMapConsent();
  const query = useUrbanLayers(bbox, layers);
  const provenance = useUrbanSources();
  const [filter, setFilter] = useState<UrbanLayerType | 'all'>('all');
  const [page, setPage] = useState(0);
  const activeFilter = filter === 'all' || layers.includes(filter) ? filter : 'all';
  const features = useMemo(
    () =>
      (query.data?.features ?? [])
        .filter((feature) => activeFilter === 'all' || feature.properties.type === activeFilter)
        .sort(
          (a, b) =>
            (b.properties.observedAt ?? '').localeCompare(a.properties.observedAt ?? '') ||
            a.properties.title.localeCompare(b.properties.title),
        ),
    [query.data?.features, activeFilter],
  );
  const pages = Math.max(1, Math.ceil(features.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = features.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const cge = query.data?.floodSummary;
  const weather = query.data?.weather;
  const sourceStatuses =
    query.data?.sources ??
    provenance.data?.sources.filter((source) => layers.includes(source.type)) ??
    [];
  return (
    <Protected>
      <Screen title="Dados urbanos">
        <AppText variant="heading">O que sabemos sobre a região</AppText>
        <AppText tone="muted">
          {isPilot
            ? 'Bela Vista e entorno · área piloto escolhida.'
            : 'Área selecionada no mapa · região de São Paulo.'}{' '}
          A lista usa dados públicos das camadas que você selecionou.
        </AppText>
        <AppText variant="small" tone="muted">
          Limites aproximados: {Math.abs(bbox[1]).toFixed(3)}° S a {Math.abs(bbox[3]).toFixed(3)}° S
          · {Math.abs(bbox[0]).toFixed(3)}° O a {Math.abs(bbox[2]).toFixed(3)}° O.
        </AppText>
        {params.bbox && !selectedBounds && (
          <View style={s.notice}>
            <AppText variant="small">
              A área recebida é inválida ou excede o limite de consulta. Mostramos a área piloto;
              aproxime o mapa para escolher outra região.
            </AppText>
          </View>
        )}
        <View style={s.row}>
          <View style={s.grow}>
            <Badge
              label={query.data?.truncated ? 'Cobertura parcial' : 'Consulta por área'}
              tone="warning"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher camadas"
            onPress={() => router.push('/camadas-mapa')}
            style={s.pageButton}
          >
            <Icon name="sliders" color={colors.primaryText} />
          </Pressable>
        </View>
        <View style={s.notice}>
          <AppText variant="small">
            Um cadastro ou relato antigo não confirma a condição atual da rua. Nenhum registro aqui
            certifica um trajeto seguro ou acessível.
          </AppText>
        </View>
        {consent.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={consent.error ?? query.error ?? provenance.error} />
        {!consent.isPending && !consent.data?.enabled && (
          <Card>
            <Icon name="map" color={colors.primaryText} />
            <AppText variant="subtitle">Escolha como usar os dados do mapa</AppText>
            <AppText tone="muted">
              Confira os serviços externos e autorize a consulta antes de carregar as camadas.
            </AppText>
            <Button label="Serviços do mapa" onPress={() => router.push('/servicos-mapa')} />
          </Card>
        )}
        {consent.data?.enabled && layers.length === 0 && (
          <Card>
            <AppText variant="subtitle">Nenhuma camada selecionada</AppText>
            <AppText tone="muted">Selecione os dados que quer consultar nesta área.</AppText>
            <Button label="Escolher camadas" onPress={() => router.push('/camadas-mapa')} />
          </Card>
        )}
        {consent.data?.enabled && layers.length > 0 && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {(['all', ...layers] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeFilter === type }}
                  style={[s.chip, activeFilter === type && s.chipSelected]}
                  onPress={() => {
                    setFilter(type);
                    setPage(0);
                  }}
                >
                  <AppText variant="label" tone={activeFilter === type ? 'primary' : 'muted'}>
                    {type === 'all' ? 'Todas as selecionadas' : layerLabels[type]}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
            {query.isFetching && !query.data && (
              <View style={s.loading}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="small" tone="muted">
                  Consultando as fontes desta área…
                </AppText>
              </View>
            )}
            {query.isError && (
              <Button
                label="Tentar novamente"
                variant="secondary"
                onPress={() => {
                  void query.refetch();
                }}
              />
            )}
            <Button
              label="Atualizar consulta"
              variant="ghost"
              icon="refresh-cw"
              loading={query.isFetching}
              onPress={() => {
                void query.refetch();
                void provenance.refetch();
              }}
            />
            {cge && (activeFilter === 'all' || activeFilter === 'floods') && (
              <Card>
                <View style={s.row}>
                  <Icon name="cloud-rain" color={colors.warning} />
                  <AppText variant="subtitle" style={s.grow}>
                    CGE · resumo de São Paulo
                  </AppText>
                </View>
                <AppText variant="small" tone="muted">
                  Data do boletim: {cge.date.split('-').reverse().join('/')}
                </AppText>
                <AppText variant="small" tone="muted">
                  Última consulta:{' '}
                  {readableDate(
                    sourceStatuses.find((source) => source.id === 'cge-floods')?.fetchedAt,
                  )}
                </AppText>
                {sourceStatuses.find((source) => source.id === 'cge-floods')?.status ===
                  'stale' && <Badge label="Última cópia desatualizada" tone="warning" />}
                <View style={s.summary}>
                  <View style={s.metric}>
                    <AppText style={s.metricValue}>
                      {cge.activePassableForVehicles + cge.activeImpassableForVehicles}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      registros ativos
                    </AppText>
                  </View>
                  <View style={s.metric}>
                    <AppText style={s.metricValue}>
                      {cge.inactivePassableForVehicles + cge.inactiveImpassableForVehicles}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      registros inativos
                    </AppText>
                  </View>
                </View>
                <AppText variant="small">
                  {cge.activeImpassableForVehicles} ativos classificados como intransitáveis para
                  veículos. Essa classificação não atesta passagem para pedestres.
                </AppText>
                <AppText variant="small" tone="muted">
                  Resumo municipal, sem coordenadas individuais verificadas. Não desenhamos pontos a
                  partir destas contagens.
                </AppText>
                <AppText variant="small" tone="muted">
                  {cge.note}
                </AppText>
              </Card>
            )}
            {weather && (activeFilter === 'all' || activeFilter === 'weather') && (
              <Card>
                <AppText variant="subtitle">Chuva estimada · Open-Meteo</AppText>
                {sourceStatuses.find((source) => source.id === 'open-meteo')?.status ===
                  'stale' && <Badge label="Última cópia desatualizada" tone="warning" />}
                <AppText style={s.metricValue}>
                  {weather.precipitationMillimeters.toLocaleString('pt-BR')} mm
                </AppText>
                <AppText variant="small">
                  Acumulados em {Math.round(weather.intervalSeconds / 60)} minutos, na célula do
                  modelo.
                </AppText>
                <AppText variant="small" tone="muted">
                  Referência: {readableDate(weather.observedAt)}. Chuva modelada não confirma
                  alagamento.
                </AppText>
              </Card>
            )}
            {query.data && (
              <>
                <AppText variant="label">
                  {features.length.toLocaleString('pt-BR')} registros geográficos nesta consulta
                </AppText>
                {visible.map((feature) => (
                  <Pressable
                    key={feature.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver detalhes: ${feature.properties.title}`}
                    style={s.featureRow}
                    onPress={() =>
                      router.push({
                        pathname: '/dado-urbano/[id]',
                        params: {
                          id: feature.id,
                          type: feature.properties.type,
                          bbox: bbox.join(','),
                        },
                      })
                    }
                  >
                    <View style={s.icon}>
                      <Icon
                        name={icons[feature.properties.category]}
                        color={
                          feature.properties.category === 'flood'
                            ? colors.warning
                            : colors.primaryText
                        }
                      />
                    </View>
                    <View style={s.grow}>
                      <AppText variant="label">{feature.properties.title}</AppText>
                      <AppText variant="small" tone="muted">
                        {layerLabels[feature.properties.type]}
                        {feature.properties.observedAt
                          ? ` · ${feature.properties.observedAt.slice(0, 10).split('-').reverse().join('/')}`
                          : ' · sem data de vistoria'}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" color={colors.muted} />
                  </Pressable>
                ))}
                {features.length === 0 && (
                  <Card>
                    <AppText variant="subtitle">Nenhuma feição geográfica nesta seleção</AppText>
                    <AppText tone="muted">
                      Resumos municipais podem não ter coordenadas individuais. Consulte o estado
                      das fontes; a ausência de registros não comprova ausência de problemas.
                    </AppText>
                  </Card>
                )}
                {features.length > pageSize && (
                  <View style={s.pagination}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Página anterior"
                      accessibilityState={{ disabled: currentPage === 0 }}
                      disabled={currentPage === 0}
                      style={[s.pageButton, currentPage === 0 && s.disabled]}
                      onPress={() => setPage(currentPage - 1)}
                    >
                      <Icon name="chevron-left" />
                    </Pressable>
                    <AppText variant="small">
                      Página {currentPage + 1} de {pages}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Próxima página"
                      accessibilityState={{ disabled: currentPage === pages - 1 }}
                      disabled={currentPage === pages - 1}
                      style={[s.pageButton, currentPage === pages - 1 && s.disabled]}
                      onPress={() => setPage(currentPage + 1)}
                    >
                      <Icon name="chevron-right" />
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}
        {sourceStatuses.length > 0 && (
          <Card>
            <AppText variant="subtitle">Fontes desta seleção</AppText>
            {sourceStatuses.map((source) => (
              <View key={source.id} style={s.field}>
                <AppText variant="label">{source.name}</AppText>
                <AppText variant="small" tone="muted">
                  {source.status === 'available'
                    ? 'Consulta disponível'
                    : source.status === 'stale'
                      ? 'Última cópia desatualizada'
                      : source.status === 'not_configured'
                        ? 'Importação pendente'
                        : 'Origem indisponível'}{' '}
                  · {source.featureCount.toLocaleString('pt-BR')} feições
                </AppText>
                <AppText variant="small">{source.coverage}</AppText>
              </View>
            ))}
          </Card>
        )}
        {query.data?.coverageWarnings.map((warning) => (
          <AppText key={warning} variant="small" tone="muted">
            {warning}
          </AppText>
        ))}
        <Button
          label="Fontes, datas e limitações"
          variant="secondary"
          onPress={() => router.push('/fontes-dados')}
        />
      </Screen>
    </Protected>
  );
}
