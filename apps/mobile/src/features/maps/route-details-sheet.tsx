import { durationLabel } from '@/lib/duration';
import { routeModeShort } from './route-context-summary';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import type { RealRoute } from '@safewalk/contracts';
import { AppText, Badge, Button, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { readableDate } from './map-data';
import { routeEvidence } from './route-evidence';
import {
  recordsLevelLabel,
  recordsLevelTone,
  recordsPeriodText,
  recordsStepLabel,
} from './route-records-presentation';
import { createRouteDetailsStyles } from './route-details-sheet.styles';

export function RouteDetailsSheet({
  route,
  activeIndex,
  onStep,
  onClose,
}: {
  route: RealRoute;
  activeIndex: number | null;
  onStep: (index: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRouteDetailsStyles(colors), [colors]);
  const [tab, setTab] = useState<'steps' | 'conditions'>('steps');
  const evidence = useMemo(() => routeEvidence(route), [route]);
  const active = activeIndex === null ? undefined : route.instructions[activeIndex];
  const reading = route.recordsReading;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet} accessibilityViewIsModal>
          <View style={s.header}>
            <View style={s.grow}>
              <AppText variant="heading">Seu percurso, passo a passo</AppText>
              <AppText variant="small" tone="muted">
                {routeModeShort(route)} · {route.instructions.length} etapas ·{' '}
                {durationLabel(route.durationMinutes)}
              </AppText>
            </View>
            <Pressable
              style={s.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhes da rota"
              onPress={onClose}
            >
              <Icon name="x" />
            </Pressable>
          </View>
          <View style={s.tabs} accessibilityRole="tablist">
            {(
              [
                { value: 'steps', label: 'Etapas' },
                { value: 'conditions', label: 'Condições da rota' },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.value}
                style={[s.tab, tab === item.value && s.selectedTab]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.value }}
                onPress={() => setTab(item.value)}
              >
                <AppText variant="label">{item.label}</AppText>
              </Pressable>
            ))}
          </View>
          {tab === 'steps' ? (
            <>
              <AppText variant="small" tone="muted">
                Confira nesta lista as instruções do percurso planejado. Os pontos coloridos do mapa
                mostram condições urbanas.
              </AppText>
              {active && (
                <View style={s.active}>
                  <AppText variant="label">Etapa {(activeIndex ?? 0) + 1} selecionada</AppText>
                  <AppText>{active.text}</AppText>
                </View>
              )}
              <FlatList
                style={s.list}
                contentContainerStyle={s.listContent}
                data={route.instructions}
                extraData={activeIndex}
                initialNumToRender={8}
                keyExtractor={(step, index) => `${step.beginPointIndex}-${index}`}
                ListEmptyComponent={
                  <AppText tone="muted">O provedor não enviou instruções para esta rota.</AppText>
                }
                renderItem={({ item, index }) => (
                  <Pressable
                    style={[s.row, index === activeIndex && s.selectedRow]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === activeIndex }}
                    accessibilityLabel={`Etapa ${index + 1}: ${item.text}`}
                    onPress={() => onStep(index)}
                  >
                    <View style={s.rail}>
                      <View style={s.circle}>
                        <AppText style={s.number}>{index + 1}</AppText>
                      </View>
                      {index < route.instructions.length - 1 && <View style={s.connector} />}
                    </View>
                    <View style={s.stepText}>
                      <AppText variant="label">{item.text}</AppText>
                      <AppText variant="small" tone="muted">
                        {Math.round(item.distanceMeters)} m ·{' '}
                        {item.durationSeconds < 60
                          ? `${Math.round(item.durationSeconds)} s`
                          : durationLabel(Math.ceil(item.durationSeconds / 60))}{' '}
                        nesta etapa
                      </AppText>
                    </View>
                  </Pressable>
                )}
              />
              <AppText variant="small" tone="muted">
                Roteiro planejado. As etapas não avançam automaticamente; aproxime o mapa para
                separar pontos próximos.
              </AppText>
              <Button label={active ? 'Voltar ao mapa' : 'Voltar ao mapa'} onPress={onClose} />
            </>
          ) : (
            <ScrollView style={s.list} contentContainerStyle={s.listContent}>
              <View style={s.section}>
                <Badge label={evidence.summary} tone="warning" />
                <AppText variant="small" tone="muted">
                  {evidence.notice}
                </AppText>
                {evidence.checkedAt && (
                  <AppText variant="small" tone="muted">
                    Leitura: {readableDate(evidence.checkedAt)}
                  </AppText>
                )}
                {evidence.stale && (
                  <AppText variant="small" tone="muted">
                    Há fontes com atualização vencida nesta consulta.
                  </AppText>
                )}
              </View>
              {reading && (
                <View style={s.section}>
                  <AppText variant="subtitle">Registros conhecidos perto do percurso</AppText>
                  <Badge label={recordsLevelLabel(reading)} tone={recordsLevelTone(reading)} />
                  <AppText variant="small" tone="muted">
                    {recordsPeriodText(reading)}. {reading.notice}
                  </AppText>
                  {reading.factors.map((factor) => (
                    <View key={factor.kind} style={s.bulletRow}>
                      <View style={s.bullet} />
                      <AppText style={s.grow} variant="small">
                        {factor.summary}
                      </AppText>
                    </View>
                  ))}
                  {reading.highlights.map((highlight) => (
                    <View key={highlight.startMeters} style={s.bulletRow}>
                      <View style={s.bullet} />
                      <AppText style={s.grow} variant="small">
                        {recordsStepLabel(route, highlight)}. {highlight.reason}
                      </AppText>
                    </View>
                  ))}
                  {reading.missingData.map((item) => (
                    <AppText key={item} variant="small" tone="muted">
                      {item}
                    </AppText>
                  ))}
                  {reading.sources.map((source) => (
                    <AppText key={source.name} variant="small" tone="muted">
                      {source.name} · importado em {readableDate(source.importedAt)}
                    </AppText>
                  ))}
                </View>
              )}
              {(
                [
                  { title: 'Segurança · sinais disponíveis', lines: evidence.safety },
                  { title: 'Acessibilidade · o que sabemos', lines: evidence.accessibility },
                ] as const
              ).map((section) => (
                <View key={section.title} style={s.section}>
                  <AppText variant="subtitle">{section.title}</AppText>
                  {section.lines.map((line) => (
                    <View key={line} style={s.bulletRow}>
                      <View style={s.bullet} />
                      <AppText style={s.grow} variant="small">
                        {line}
                      </AppText>
                    </View>
                  ))}
                </View>
              ))}
              <View style={s.section}>
                <AppText variant="subtitle">O que ainda falta confirmar</AppText>
                <AppText variant="small" tone="muted">
                  Condições atuais do piso, obstáculos, rampas, travessias e iluminação ao longo de
                  todo o percurso. Menos registros não significa uma rota mais segura.
                </AppText>
              </View>
              <View style={s.section}>
                <AppText variant="subtitle">Fontes e datas</AppText>
                {!evidence.sources.length && (
                  <AppText variant="small" tone="muted">
                    Não há fontes urbanas anexadas a esta rota.
                  </AppText>
                )}
                {evidence.sources.map((source) => (
                  <View key={source.id} style={s.source}>
                    <AppText variant="label">{source.name}</AppText>
                    <AppText variant="small" tone="muted">
                      {source.asOf
                        ? `Referência: ${readableDate(source.asOf)}`
                        : 'Data de referência não informada'}{' '}
                      ·{' '}
                      {source.fetchedAt
                        ? `Consultado: ${readableDate(source.fetchedAt)}`
                        : 'Sem consulta disponível'}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {
                        {
                          available: 'Dados disponíveis · cobertura parcial',
                          stale: 'Atualização vencida',
                          unavailable: 'Fonte indisponível nesta consulta',
                          not_configured: 'Fonte ainda não integrada',
                        }[source.status]
                      }
                    </AppText>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
