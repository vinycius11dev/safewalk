import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Badge, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { MunicipalityShell } from './municipality-shell';
import { MunicipalityLoading } from './municipality-components';
import {
  caseOutcomeDescriptions,
  caseOutcomes,
  formatMunicipalityDate,
  illustrativeCases,
} from './municipality.model';
import { useMunicipalityCase } from './use-municipality-case';
import { createMunicipalityStyles } from './municipality.styles';

export function MunicipalityCloseScreen() {
  const { id = 'demo-sos' } = useLocalSearchParams<{ id?: string }>();
  const selected = illustrativeCases.find((item) => item.id === id);
  const { query, update } = useMunicipalityCase(id);
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [outcome, setOutcome] = useState<string>('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const close = () => {
    if (!query.data || !outcome || query.data.status === 'closed') return;
    update.mutate({
      ...query.data,
      status: 'closed',
      closedAt: new Date().toISOString(),
      outcome,
      note: `${note.trim()}${notify ? '\nAviso ao usuário e contatos: simulado; sem envio externo.' : ''}`
        .trim()
        .slice(0, 280),
    });
  };
  return (
    <MunicipalityShell
      section="central"
      title={selected ? `Encerrar alerta · ${selected.address}` : 'Ocorrência não encontrada'}
      subtitle="Desfecho demonstrativo · nenhum atendimento real será registrado"
    >
      {!selected ? (
        <Button label="Voltar à central" onPress={() => router.replace('/prefeitura-central')} />
      ) : (
        <MunicipalityLoading
          loading={query.isPending}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        >
          {query.data?.status === 'closed' ? (
            <View style={s.success}>
              <Icon name="check-circle" size={44} color={colors.success} />
              <AppText variant="heading" style={s.centered}>
                Ocorrência encerrada na demonstração
              </AppText>
              <Badge label={query.data.outcome ?? 'Desfecho registrado'} tone="success" />
              <AppText variant="small" tone="muted">
                {query.data.closedAt ? formatMunicipalityDate(query.data.closedAt) : ''}
              </AppText>
              {query.data.note ? <AppText>{query.data.note}</AppText> : null}
              <AppText style={s.centered} tone="muted">
                O registro ficou salvo localmente. O SOS do pedestre continua sob controle do
                titular e só pode ser cancelado com seu PIN.
              </AppText>
              <Button
                label="Voltar à Central GCM"
                onPress={() => router.replace({ pathname: '/prefeitura-central', params: { id } })}
              />
            </View>
          ) : (
            <View style={[s.columns, width > 900 && s.columnsWide]}>
              <View style={[s.mainColumn, width > 900 && s.mainColumnWide]}>
                <Card>
                  <AppText variant="heading">Desfecho da ocorrência</AppText>
                  {caseOutcomes.map((item, index) => (
                    <Pressable
                      key={item}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: outcome === item }}
                      aria-checked={outcome === item}
                      style={[s.radio, outcome === item && s.radioSelected]}
                      onPress={() => setOutcome(item)}
                    >
                      <Icon
                        name={outcome === item ? 'check-circle' : 'circle'}
                        color={outcome === item ? colors.primaryText : colors.muted}
                      />
                      <View style={s.flex}>
                        <AppText variant="subtitle">{item}</AppText>
                        <AppText variant="small" tone="muted">
                          {caseOutcomeDescriptions[index]}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                  <Field
                    label="Observações"
                    multiline
                    maxLength={200}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Ex.: usuário encontrado na farmácia da R. Augusta, sem ferimentos · simulação"
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: notify }}
                    aria-checked={notify}
                    style={s.checkbox}
                    onPress={() => setNotify((value) => !value)}
                  >
                    <Icon name={notify ? 'check-square' : 'square'} color={colors.primaryText} />
                    <AppText style={s.flex}>
                      Registrar aviso simulado ao usuário e aos contatos
                    </AppText>
                  </Pressable>
                  <AppText variant="small" tone="muted">
                    Nenhuma mensagem será enviada e nenhum trajeto privado será encerrado.
                  </AppText>
                  <ErrorNotice error={update.error} />
                  <Button
                    label="Encerrar ocorrência simulada"
                    disabled={!outcome}
                    loading={update.isPending}
                    onPress={close}
                  />
                  <Button
                    label="Voltar sem encerrar"
                    variant="ghost"
                    onPress={() => router.back()}
                  />
                </Card>
              </View>
              <View style={[s.column, width > 900 && s.columnWide]}>
                <Card>
                  <AppText variant="heading">Linha do tempo</AppText>
                  <Badge label="Roteiro fictício" />
                  <View style={s.timeline}>
                    <AppText style={s.timelineTime}>{selected.time}</AppText>
                    <AppText style={s.flex}>{selected.description}</AppText>
                  </View>
                  {[
                    ['22:41', 'Contatos avisados no roteiro'],
                    ['22:42', 'Ana (personagem fictício) a caminho'],
                    ['22:43', 'Alerta apresentado na central'],
                  ].map(([time, text]) => (
                    <View key={time} style={s.timeline}>
                      <AppText style={s.timelineTime}>{time}</AppText>
                      <AppText style={s.flex}>{text}</AppText>
                    </View>
                  ))}
                  {query.data?.assignedAt ? (
                    <View style={s.timeline}>
                      <Icon name="truck" color={colors.primaryText} />
                      <AppText style={s.flex}>
                        VTR 12 atribuída na simulação ·{' '}
                        {formatMunicipalityDate(query.data.assignedAt)}
                      </AppText>
                    </View>
                  ) : (
                    <AppText tone="muted">Nenhuma viatura atribuída nesta simulação.</AppText>
                  )}
                </Card>
              </View>
            </View>
          )}
        </MunicipalityLoading>
      )}
    </MunicipalityShell>
  );
}
