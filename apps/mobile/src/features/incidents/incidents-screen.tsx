import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { MapScene } from '@/components/map/map-scene';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { nearbyIncidents } from './demo-incidents';
import { useIncidentFeedback } from './use-incidents';
import { createIncidentStyles } from './incidents.styles';

export function IncidentsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createIncidentStyles(colors), [colors]);
  const [filter, setFilter] = useState<'all' | 'security' | 'city' | 'weather'>('all');
  const incidents = nearbyIncidents.filter(
    (incident) => filter === 'all' || incident.category === filter,
  );
  return (
    <Protected>
      <Screen title="Perto de você">
        <AppText tone="muted">Raio ilustrativo de 1,5 km · Bela Vista</AppText>
        <View accessibilityRole="tablist" style={s.filters}>
          {[
            { value: 'all' as const, label: 'Todos' },
            { value: 'security' as const, label: 'Segurança' },
            { value: 'city' as const, label: 'Cidade' },
            { value: 'weather' as const, label: 'Clima' },
          ].map((item) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === item.value }}
              style={[s.filter, filter === item.value && s.selected]}
              key={item.value}
              onPress={() => setFilter(item.value)}
            >
              <AppText variant="small" tone={filter === item.value ? 'primary' : 'muted'}>
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Badge label="Ocorrências fictícias · demonstração" />
        {incidents.map((incident) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${incident.title}, ${incident.address}`}
            key={incident.id}
            style={s.row}
            onPress={() =>
              router.push({ pathname: '/ocorrencia/[id]', params: { id: incident.id } })
            }
          >
            <View style={s.icon}>
              <Icon
                name={incident.icon}
                color={
                  incident.tone === 'danger'
                    ? colors.danger
                    : incident.tone === 'warning'
                      ? colors.warning
                      : colors.primaryText
                }
              />
            </View>
            <View style={s.grow}>
              <AppText variant="label">{incident.title}</AppText>
              <AppText variant="small" tone="muted">
                {incident.description}
              </AppText>
            </View>
            <View style={s.right}>
              <AppText variant="small" tone="muted">
                {incident.distance}
              </AppText>
              <AppText variant="small" tone="muted">
                {incident.time}
              </AppText>
            </View>
          </Pressable>
        ))}
        <AppText variant="small" tone="muted">
          Fontes representadas no protótipo: relatos, SSP, CGE e Prefeitura. Estes exemplos não
          consultam essas bases em tempo real.
        </AppText>
        <Button
          label="Registrar o que vi"
          variant="secondary"
          onPress={() => router.push('/relatar')}
        />
      </Screen>
    </Protected>
  );
}

export function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const incident = nearbyIncidents.find((item) => item.id === id);
  const { query, mutation } = useIncidentFeedback(incident?.id ?? '');
  const { colors } = useTheme();
  const s = useMemo(() => createIncidentStyles(colors), [colors]);
  if (!incident)
    return (
      <Protected>
        <Screen title="Ocorrência não encontrada">
          <AppText tone="muted">Este ponto não faz parte da demonstração.</AppText>
          <Button label="Ver ocorrências próximas" onPress={() => router.replace('/ocorrencias')} />
        </Screen>
      </Protected>
    );
  return (
    <Protected>
      <Screen scroll={false}>
        <MapScene />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar às ocorrências"
          style={s.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/ocorrencias'))}
        >
          <Icon name="arrow-left" />
        </Pressable>
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          <View style={s.handle} />
          <AppText variant="title">{incident.title}</AppText>
          <AppText tone="muted" variant="small">
            {incident.address} · {incident.distance}
          </AppText>
          <Badge
            label={
              incident.category === 'security'
                ? 'Risco alto · exemplo'
                : incident.category === 'weather'
                  ? 'Atenção · exemplo'
                  : 'Zeladoria · exemplo'
            }
            tone={incident.tone}
          />
          <View style={s.metricRow}>
            <View style={s.metric}>
              <AppText style={s.value}>{incident.time}</AppText>
              <AppText variant="small" tone="muted">
                há · ilustrativo
              </AppText>
            </View>
            <View style={s.metric}>
              <AppText style={s.value}>
                {query.data?.confirmations ?? incident.confirmations}
              </AppText>
              <AppText variant="small" tone="muted">
                confirmações exemplo
              </AppText>
            </View>
            <View style={s.metric}>
              <AppText style={s.value}>{incident.metric}</AppText>
              <AppText variant="small" tone="muted" style={s.centered}>
                {incident.metricLabel}
              </AppText>
            </View>
          </View>
          <AppText variant="small" tone="muted">
            {incident.source}
          </AppText>
          <AppText>{incident.detail}</AppText>
          {incident.category === 'city' && <Badge label="SP156 simulado · nenhum protocolo real" />}
          <View style={s.response}>
            <AppText variant="subtitle">{incident.question}</AppText>
            {query.isPending && <ActivityIndicator color={colors.primary} />}
            <ErrorNotice error={query.error ?? mutation.error} />
            {query.isError && (
              <Button
                label="Recarregar minha resposta"
                variant="ghost"
                onPress={() => {
                  void query.refetch();
                }}
              />
            )}
            {query.data?.choice && (
              <AppText tone="success" variant="small">
                {query.data.choice === 'confirm'
                  ? 'Você confirmou que a situação continua.'
                  : 'Você informou que a situação já passou.'}{' '}
                Sua resposta ficou salva nesta conta de demonstração.
              </AppText>
            )}
            <Button
              label={query.data?.choice === 'confirm' ? 'Confirmado por você' : incident.yes}
              variant="secondary"
              disabled={query.data?.choice === 'confirm'}
              loading={mutation.isPending && mutation.variables === 'confirm'}
              onPress={() => mutation.mutate('confirm')}
            />
            <Button
              label={query.data?.choice === 'resolved' ? 'Resposta salva: já passou' : incident.no}
              variant="ghost"
              disabled={query.data?.choice === 'resolved'}
              loading={mutation.isPending && mutation.variables === 'resolved'}
              onPress={() => mutation.mutate('resolved')}
            />
          </View>
          <Button
            label="Traçar rota evitando este ponto"
            icon="navigation"
            onPress={() =>
              router.push({
                pathname: '/rotas',
                params: { destino: 'Casa', evitar: incident.title },
              })
            }
          />
          <Card>
            <AppText variant="small" tone="muted">
              O mapa e a rota são ilustrativos. As respostas não acionam órgãos públicos nem alteram
              uma rota real nesta etapa.
            </AppText>
          </Card>
        </ScrollView>
      </Screen>
    </Protected>
  );
}
