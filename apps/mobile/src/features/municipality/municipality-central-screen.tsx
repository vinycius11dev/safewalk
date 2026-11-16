import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorNotice,
  Icon,
  useUiStyles,
} from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { MunicipalityShell } from './municipality-shell';
import { MunicipalityFilter, MunicipalityLoading } from './municipality-components';
import { caseStatusLabels, formatMunicipalityDate, illustrativeCases } from './municipality.model';
import { useMunicipalityCase } from './use-municipality-case';
import { createMunicipalityStyles } from './municipality.styles';
import { useTrips } from '@/features/trips/use-trips';
import {
  CAMERA_REQUEST_TITLE,
  CAMERA_SIMULATION_NOTE,
  cameraRequestText,
} from '@/features/trips/camera-request';

const cameras = [
  { id: 'C-1042', distance: '40 m', street: 'R. Caio Prado × R. Marquês de Paranaguá' },
  { id: 'C-1043', distance: '90 m', street: 'R. Caio Prado, 180' },
  { id: 'C-0987', distance: '120 m', street: 'R. Augusta × R. Marquês de Paranaguá' },
];
export function MunicipalityCentralScreen() {
  const { id = 'demo-sos' } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const ui = useUiStyles();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [camera, setCamera] = useState('C-1042');
  const [feedback, setFeedback] = useState('');
  const first = useMunicipalityCase('demo-sos');
  const second = useMunicipalityCase('demo-confirmacao');
  const third = useMunicipalityCase('demo-assedio');
  const cases = [first, second, third];
  const trips = useTrips();
  const ownAlert = trips.data?.find(
    (trip) => (trip.status === 'alerted' || trip.status === 'escalated') && trip.cameraRequest,
  );
  const selectedIndex = illustrativeCases.findIndex((item) => item.id === id);
  const selected = illustrativeCases[selectedIndex];
  const selectedState = cases[selectedIndex];
  const visible = illustrativeCases.filter(
    (_item, index) =>
      filter === 'all' ||
      (filter === 'closed'
        ? cases[index]?.query.data?.status === 'closed'
        : cases[index]?.query.data?.status !== 'closed'),
  );
  const activeCount = cases.filter((item) => item.query.data?.status !== 'closed').length;
  const assign = () => {
    if (!selectedState?.query.data || selectedState.query.data.status !== 'new') return;
    selectedState.update.mutate(
      { ...selectedState.query.data, status: 'assigned', assignedAt: new Date().toISOString() },
      {
        onSuccess: () =>
          setFeedback(
            'VTR 12 adicionada ao roteiro simulado. Nenhuma viatura real foi despachada.',
          ),
      },
    );
  };
  return (
    <MunicipalityShell
      section="central"
      title="Central GCM · Smart Sampa"
      subtitle="Alertas recebidos do SafeWalk · integração simulada · operador fictício 214"
    >
      <View style={s.notice}>
        <Badge label="Cenário de atendimento fictício" tone="warning" />
        <AppText variant="small" tone="muted">
          Os casos abaixo reproduzem o protótipo. Encerrar uma ocorrência aqui registra apenas o
          desfecho da simulação e não cancela um SOS privado do pedestre.
        </AppText>
      </View>
      {ownAlert?.cameraRequest && (
        <Card>
          <View style={[ui.between, s.wrap]}>
            <AppText variant="heading">Alerta do seu trajeto</AppText>
            <Badge label="Sua conta · simulação local" tone="warning" />
          </View>
          <AppText variant="subtitle">{ownAlert.destination}</AppText>
          <View style={s.timeline}>
            <Icon name="video" color={colors.primaryText} />
            <AppText style={s.flex}>
              {CAMERA_REQUEST_TITLE}: {cameraRequestText(ownAlert.cameraRequest)}
            </AppText>
          </View>
          <AppText variant="small" tone="muted">
            {CAMERA_SIMULATION_NOTE} Só aparece aqui o alerta da conta conectada; a central não
            recebe trajetos de outras pessoas.
          </AppText>
          <Button
            label="Abrir o alerta"
            icon="shield"
            variant="secondary"
            onPress={() => router.push({ pathname: '/sos/[id]', params: { id: ownAlert.id } })}
          />
        </Card>
      )}
      <View style={[s.columns, width > 1000 && s.columnsWide]}>
        <View style={[s.column, width > 1000 && s.columnWide]}>
          <View style={ui.between}>
            <AppText variant="heading">Alertas ativos · {activeCount}</AppText>
            <Badge label="Exemplo" />
          </View>
          <MunicipalityFilter
            label="Mostrar"
            value={filter}
            options={[
              { key: 'active', label: 'Ativos' },
              { key: 'closed', label: 'Encerrados' },
              { key: 'all', label: 'Todos' },
            ]}
            onChange={setFilter}
          />
          <MunicipalityLoading
            loading={cases.some((item) => item.query.isPending)}
            error={cases.find((item) => item.query.error)?.query.error}
            onRetry={() => {
              cases.forEach((item) => {
                void item.query.refetch();
              });
            }}
          >
            {visible.length ? (
              visible.map((item) => {
                const state = cases[illustrativeCases.indexOf(item)]?.query.data;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar alerta ${item.address}`}
                    accessibilityState={{ selected: item.id === id }}
                    style={[s.alertCard, item.id === id && s.alertCardSelected]}
                    onPress={() => {
                      router.setParams({ id: item.id });
                      setFeedback('');
                    }}
                  >
                    <View style={[ui.between, s.wrap]}>
                      <AppText variant="label" tone="danger">
                        {item.label}
                      </AppText>
                      <AppText variant="small" tone="muted">
                        {item.age} · exemplo
                      </AppText>
                    </View>
                    <AppText variant="subtitle">{item.address}</AppText>
                    <AppText variant="small" tone="muted">
                      {item.summary}
                    </AppText>
                    <Badge
                      label={state ? caseStatusLabels[state.status] : 'Carregando'}
                      tone={state?.status === 'closed' ? 'success' : 'warning'}
                    />
                  </Pressable>
                );
              })
            ) : (
              <Card>
                <Icon name="check-circle" color={colors.success} />
                <AppText variant="subtitle">Nenhuma ocorrência neste filtro.</AppText>
                <Button
                  label="Ver todos os casos"
                  variant="ghost"
                  onPress={() => setFilter('all')}
                />
              </Card>
            )}
          </MunicipalityLoading>
        </View>
        <View style={[s.mainColumn, width > 1000 && s.mainColumnWide]}>
          {selected && selectedState ? (
            <MunicipalityLoading
              loading={selectedState.query.isPending}
              error={selectedState.query.error}
              onRetry={() => {
                void selectedState.query.refetch();
              }}
            >
              <Card>
                <View style={[ui.between, s.wrap]}>
                  <AppText variant="heading">Localização do cenário</AppText>
                  <Badge label="Posição ilustrativa" />
                </View>
                <AppText variant="small" tone="muted">
                  {selected.address} · 3 câmeras de exemplo em até 120 m
                </AppText>
                <View style={[s.map, s.mapTall]}>
                  <MapScene variant="trip" />
                  <View style={s.mapLabel}>
                    <Badge label={selected.address} />
                  </View>
                </View>
                <View style={s.cameras}>
                  {cameras.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Selecionar câmera ${item.id}`}
                      accessibilityState={{ selected: camera === item.id }}
                      style={[s.camera, camera === item.id && s.radioSelected]}
                      onPress={() => setCamera(item.id)}
                    >
                      <Badge label={camera === item.id ? 'SELECIONADA' : 'SIMULADA'} />
                      <View style={s.cameraImage}>
                        <Icon name="video" size={28} color={colors.muted} />
                        <AppText variant="small" tone="muted">
                          Imagem da câmera (simulada)
                        </AppText>
                      </View>
                      <AppText variant="label">
                        {item.id} · {item.distance}
                      </AppText>
                      <AppText variant="small" tone="muted">
                        {item.street}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </Card>
              <Card>
                <View style={ui.row}>
                  <View style={s.avatar}>
                    <AppText style={s.avatarLetter}>{selected.person.charAt(0)}</AppText>
                  </View>
                  <View style={s.flex}>
                    <AppText variant="heading">{selected.person}</AppText>
                    <AppText variant="small" tone="muted">
                      Personagem fictício · sem telefone real
                    </AppText>
                  </View>
                  <Badge
                    label={caseStatusLabels[selectedState.query.data?.status ?? 'new']}
                    tone={selectedState.query.data?.status === 'closed' ? 'success' : 'danger'}
                  />
                </View>
                <AppText variant="label">Última posição ilustrativa</AppText>
                <AppText>{selected.address} · Consolação</AppText>
                <AppText variant="small" tone="muted">
                  Parado há 4 min · fora da rota · bateria 58% · dados fictícios
                </AppText>
                <AppText variant="subtitle">Linha do tempo da simulação</AppText>
                {[
                  [selected.time, selected.description],
                  ['22:41', 'Sem resposta ao PIN · contatos avisados no roteiro'],
                  ['22:42', 'Ana (contato fictício) está indo até o local'],
                  ['22:43', 'Alerta apresentado na central simulada'],
                ].map(([time, text]) => (
                  <View key={`${time}-${text}`} style={s.timeline}>
                    <AppText style={s.timelineTime}>{time}</AppText>
                    <AppText style={s.flex}>{text}</AppText>
                  </View>
                ))}
                {selectedState.query.data?.assignedAt && (
                  <View style={s.timeline}>
                    <Icon name="truck" color={colors.primaryText} />
                    <AppText style={s.flex}>
                      VTR 12 despachada na simulação ·{' '}
                      {formatMunicipalityDate(selectedState.query.data.assignedAt)}
                    </AppText>
                  </View>
                )}
                {selectedState.query.data?.closedAt && (
                  <View style={s.notice}>
                    <AppText tone="success">
                      Desfecho simulado: {selectedState.query.data.outcome}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {formatMunicipalityDate(selectedState.query.data.closedAt)}
                    </AppText>
                    {selectedState.query.data.note ? (
                      <AppText>{selectedState.query.data.note}</AppText>
                    ) : null}
                  </View>
                )}
                <ErrorNotice error={selectedState.update.error} />
                {feedback ? (
                  <AppText accessibilityRole="status" tone="success">
                    {feedback}
                  </AppText>
                ) : null}
                <View style={s.notice}>
                  <AppText variant="small" tone="muted">
                    Nenhuma imagem, biometria ou localização de outra pessoa foi recebida. A
                    apresentação não confirma atendimento real.
                  </AppText>
                </View>
                <Button
                  label={
                    selectedState.query.data?.status === 'assigned'
                      ? 'Viatura atribuída na simulação'
                      : 'Simular despacho de viatura'
                  }
                  icon="truck"
                  disabled={selectedState.query.data?.status !== 'new'}
                  loading={selectedState.update.isPending}
                  onPress={assign}
                />
                <Button
                  label="Simular ligação para o usuário"
                  icon="phone"
                  variant="secondary"
                  disabled={selectedState.query.data?.status === 'closed'}
                  onPress={() =>
                    setFeedback('Ligação apenas demonstrada. Nenhuma chamada foi iniciada.')
                  }
                />
                <Button
                  label={
                    selectedState.query.data?.status === 'closed'
                      ? 'Ver desfecho da ocorrência'
                      : 'Encerrar ocorrência simulada'
                  }
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/prefeitura-encerrar', params: { id: selected.id } })
                  }
                />
              </Card>
            </MunicipalityLoading>
          ) : (
            <Card>
              <AppText>Ocorrência não encontrada.</AppText>
              <Button
                label="Abrir exemplo principal"
                onPress={() => router.setParams({ id: 'demo-sos' })}
              />
            </Card>
          )}
        </View>
      </View>
    </MunicipalityShell>
  );
}
