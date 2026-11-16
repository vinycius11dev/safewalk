import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText, Badge, Button, Card, ErrorNotice, useUiStyles } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { MunicipalityShell } from './municipality-shell';
import { MunicipalityMetric } from './municipality-components';
import { createChartBarStyles, createMunicipalityStyles } from './municipality.styles';
import { reportSummary, reportWeeks, serviceReportRows } from './municipality-report-data';
import {
  csvActionLabel,
  exportMunicipalityCsv,
  exportMunicipalityPdf,
  pdfActionLabel,
} from './municipality-export';

export function MunicipalityReportScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const ui = useUiStyles();
  const { width } = useWindowDimensions();
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const month = 'outubro de 2026';
  async function exportReport(format: 'pdf' | 'csv') {
    setError(null);
    setBusy(format);
    try {
      await (format === 'pdf' ? exportMunicipalityPdf(month) : exportMunicipalityCsv(month));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error('Não foi possível exportar o relatório.'),
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <MunicipalityShell
      section="report"
      title={`Relatório mensal · ${month}`}
      subtitle="Subprefeitura Sé · Bela Vista e Consolação · dados de exemplo"
    >
      <View style={s.filters}>
        <Badge label="Cenário fixo do protótipo · outubro/2026" tone="warning" />
        <Button
          label={pdfActionLabel}
          icon="printer"
          variant="secondary"
          loading={busy === 'pdf'}
          disabled={busy !== null}
          onPress={() => {
            void exportReport('pdf');
          }}
        />
        <Button
          label={csvActionLabel}
          icon="download"
          variant="secondary"
          loading={busy === 'csv'}
          disabled={busy !== null}
          onPress={() => {
            void exportReport('csv');
          }}
        />
      </View>
      <ErrorNotice error={error} />
      <Card>
        <AppText variant="heading">Resumo</AppText>
        <AppText>{reportSummary}</AppText>
        <AppText variant="small" tone="muted">
          Texto e indicadores ilustrativos do protótipo; não representam resultados reais.
        </AppText>
      </Card>
      <View style={s.metrics}>
        <MunicipalityMetric label="Rotas acompanhadas" value="18.420" detail="Exemplo" />
        <MunicipalityMetric label="Relatos recebidos" value="5.112" detail="Exemplo" />
        <MunicipalityMetric label="SOS encaminhados à GCM" value="41" detail="Simulação" />
        <MunicipalityMetric label="Solicitações SP156 resolvidas" value="61%" detail="Exemplo" />
      </View>
      <View style={[s.columns, width > 900 && s.columnsWide]}>
        <View style={[s.column, width > 900 && s.columnWide]}>
          <Card>
            <AppText variant="heading">Relatos por semana</AppText>
            <View style={ui.row}>
              <Badge label="Segurança" tone="danger" />
              <Badge label="Zeladoria" />
            </View>
            <AppText variant="small" tone="muted">
              Segurança em vermelho, zeladoria em azul
            </AppText>
            <View style={s.chart}>
              {reportWeeks.map((week) => (
                <View key={week.label} style={s.barGroup}>
                  <View style={s.barPair}>
                    <View
                      style={
                        createChartBarStyles((week.security / 1010) * 120, colors.danger).pairedBar
                      }
                    />
                    <View
                      style={
                        createChartBarStyles((week.maintenance / 1010) * 120, colors.primary)
                          .pairedBar
                      }
                    />
                  </View>
                  <AppText variant="small">
                    {week.security} / {week.maintenance}
                  </AppText>
                  <AppText style={s.chartLabel}>{week.label}</AppText>
                </View>
              ))}
            </View>
          </Card>
        </View>
        <View style={[s.column, width > 900 && s.columnWide]}>
          <Card>
            <AppText variant="heading">SP156 por tipo</AppText>
            <ScrollView horizontal>
              <View style={s.reportTable}>
                <View style={[s.tableRow, s.tableHeader]}>
                  <AppText variant="label" style={s.reportType}>
                    Tipo
                  </AppText>
                  <AppText variant="label" style={s.reportCell}>
                    Abertas
                  </AppText>
                  <AppText variant="label" style={s.reportCell}>
                    Resolvidas
                  </AppText>
                  <AppText variant="label" style={s.reportCell}>
                    Prazo médio
                  </AppText>
                </View>
                {serviceReportRows.map((row) => (
                  <View key={row.type} style={s.tableRow}>
                    <AppText style={s.reportType}>{row.type}</AppText>
                    <AppText style={s.reportCell}>{row.opened}</AppText>
                    <AppText style={s.reportCell}>{row.resolved}</AppText>
                    <AppText style={s.reportCell}>{row.average}</AppText>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        </View>
      </View>
    </MunicipalityShell>
  );
}
