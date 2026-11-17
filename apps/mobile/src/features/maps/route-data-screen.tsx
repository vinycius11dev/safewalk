import { durationLabel } from '@/lib/duration';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { layerLabels, readableDate } from './map-data';
import { useMapJourney } from './use-map-journey';
import { createUrbanDataStyles } from './urban-data.styles';

export function RouteDataScreen() {
  const { journey } = useMapJourney();
  const route = journey.selectedRoute;
  const context = route?.context;
  const { colors } = useTheme();
  const s = useMemo(() => createUrbanDataStyles(colors), [colors]);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil((context?.nearbyFeatures.length ?? 0) / 20));
  const currentPage = Math.min(page, pages - 1);
  const features = context?.nearbyFeatures.slice(currentPage * 20, (currentPage + 1) * 20) ?? [];
  return (
    <Protected>
      <Screen title="Dados ao longo da rota">
        {!route ? (
          <Card>
            <Icon name="navigation" color={colors.primaryText} />
            <AppText variant="heading">Escolha uma rota primeiro</AppText>
            <AppText tone="muted">
              Ao calcular um caminho, você poderá consultar os registros públicos que já temos perto
              do trajeto.
            </AppText>
            <Button label="Buscar destino" onPress={() => router.push('/buscar')} />
          </Card>
        ) : (
          <>
            <AppText variant="heading">{route.destinationLabel}</AppText>
            <View style={s.summary}>
              <Card style={s.metric}>
                <AppText style={s.metricValue}>
                  {(route.distanceMeters / 1000).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  km
                </AppText>
                <AppText variant="small" tone="muted">
                  distância calculada
                </AppText>
              </Card>
              <Card style={s.metric}>
                <AppText style={s.metricValue}>{durationLabel(route.durationMinutes)}</AppText>
                <AppText variant="small" tone="muted">
                  {route.profile === 'auto' ? 'tempo estimado de carro' : 'tempo estimado a pé'}
                </AppText>
              </Card>
            </View>
            <AppText tone="muted">
              O SafeWalk mostra registros públicos; não avalia nem garante a segurança ou a
              acessibilidade de um caminho. Os registros abaixo ajudam a conhecer o entorno, mas não
              comprovam a condição atual do piso ou se o caminho pode ser percorrido.
            </AppText>
            <Card>
              <AppText variant="subtitle">Como o caminho foi calculado</AppText>
              <AppText>{route.provenance.source}</AppText>
              <AppText variant="small" tone="muted">
                Cálculo: {readableDate(route.provenance.computedAt)}
              </AppText>
              <AppText variant="small" tone="muted">
                {route.provenance.attribution}
              </AppText>
            </Card>
            {!context ? (
              <Card>
                <AppText variant="subtitle">Sem contexto urbano anexado</AppText>
                <AppText tone="muted">
                  Esta rota não possui uma cópia dos dados próximos ao trajeto. Isso não significa
                  que não existam obstáculos.
                </AppText>
                <Button
                  label="Consultar dados da área piloto"
                  variant="secondary"
                  onPress={() => router.push('/dados-urbanos')}
                />
              </Card>
            ) : (
              <>
                <Card>
                  <AppText variant="subtitle">Registros próximos ao traçado</AppText>
                  <AppText>
                    Faixa aproximada de {context.bufferMeters} metros. Usamos somente consultas já
                    armazenadas, sem uma nova vistoria do caminho.
                  </AppText>
                  <AppText variant="small" tone="muted">
                    Consulta do contexto: {readableDate(context.checkedAt)}
                  </AppText>
                  <Badge
                    label={
                      context.truncated
                        ? 'Cobertura parcial · até 100 registros'
                        : 'Amostra de registros armazenados'
                    }
                    tone="warning"
                  />
                  <AppText variant="small">
                    {context.nearbyFeatures.length} registros incluídos no resumo da rota.
                  </AppText>
                </Card>
                {features.map((feature) => (
                  <Pressable
                    key={feature.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir registro da rota: ${feature.properties.title}`}
                    style={s.featureRow}
                    onPress={() =>
                      router.push({
                        pathname: '/dado-urbano/[id]',
                        params: { id: feature.id, type: feature.properties.type, from: 'route' },
                      })
                    }
                  >
                    <View style={s.icon}>
                      <Icon
                        name={feature.properties.category === 'flood' ? 'cloud-rain' : 'map-pin'}
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
                          : ' · data de vistoria desconhecida'}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" color={colors.muted} />
                  </Pressable>
                ))}
                {context.nearbyFeatures.length === 0 && (
                  <Card>
                    <AppText variant="subtitle">Nenhum registro incluído nesta amostra</AppText>
                    <AppText tone="muted">
                      Pode não haver cobertura armazenada suficiente perto do traçado. Não
                      interpretamos a ausência de dados como ausência de risco.
                    </AppText>
                  </Card>
                )}
                {pages > 1 && (
                  <View style={s.pagination}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Página anterior de registros da rota"
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
                      accessibilityLabel="Próxima página de registros da rota"
                      disabled={currentPage === pages - 1}
                      style={[s.pageButton, currentPage === pages - 1 && s.disabled]}
                      onPress={() => setPage(currentPage + 1)}
                    >
                      <Icon name="chevron-right" />
                    </Pressable>
                  </View>
                )}
                {context.coverageWarnings.map((warning) => (
                  <View key={warning} style={s.notice}>
                    <AppText variant="small">{warning}</AppText>
                  </View>
                ))}
                <Card>
                  <AppText variant="heading">Fontes consideradas</AppText>
                  {context.sources.length === 0 && (
                    <AppText tone="muted">
                      Nenhuma fonte disponível na cópia desta consulta.
                    </AppText>
                  )}
                  {context.sources.map((source) => (
                    <View key={source.id} style={s.field}>
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
                      <AppText variant="small" tone="muted">
                        Última consulta/importação: {readableDate(source.fetchedAt)}
                      </AppText>
                      <AppText variant="small">{source.coverage}</AppText>
                      <AppText variant="small" tone="muted">
                        {source.message}
                      </AppText>
                    </View>
                  ))}
                </Card>
              </>
            )}
            <Button
              label="Fontes, datas e limitações"
              variant="secondary"
              onPress={() => router.push('/fontes-dados')}
            />
          </>
        )}
      </Screen>
    </Protected>
  );
}
