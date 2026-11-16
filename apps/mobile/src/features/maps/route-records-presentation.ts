import type { RealRoute, RouteDayPeriod, RouteRecordsReading } from '@safewalk/contracts';

type Reading = RouteRecordsReading;
export type RecordsTone = 'neutral' | 'warning';

const levelLabels: Record<Reading['level'], string> = {
  few: 'Poucos registros conhecidos',
  some: 'Alguns registros conhecidos',
  many: 'Muitos registros conhecidos',
  insufficient: 'Dados insuficientes para comparar',
};
const periodLabels: Record<RouteDayPeriod, string> = {
  dawn: 'de madrugada',
  morning: 'de manhã',
  afternoon: 'à tarde',
  night: 'à noite',
};

/** Nunca há tom de sucesso: poucos registros não significam um caminho seguro. */
export const recordsLevelTone = (reading: Reading): RecordsTone =>
  reading.level === 'some' || reading.level === 'many' ? 'warning' : 'neutral';

export const recordsLevelLabel = (reading: Reading): string => levelLabels[reading.level];

export const recordsPeriodText = (reading: Reading): string =>
  `Considerando saída ${periodLabels[reading.period]}`;

/** Motivo mais útil em uma linha: o trecho com mais registros ou o fator mais pesado. */
export function recordsReason(reading: Reading): string {
  if (reading.level === 'insufficient')
    return reading.missingData[0] ?? 'Ainda não há dados suficientes para este percurso.';
  const worst = [...reading.highlights].sort((a, b) => {
    const weight = { many: 2, some: 1, few: 0 };
    return weight[b.level] - weight[a.level];
  })[0];
  if (worst) return worst.reason;
  return (
    reading.factors[0]?.summary ?? 'Nenhum registro encontrado perto do percurso nesta consulta.'
  );
}

export function recordsStepLabel(
  route: Pick<RealRoute, 'instructions'>,
  highlight: Reading['highlights'][number],
): string {
  const step =
    highlight.instructionIndex === null
      ? undefined
      : route.instructions[highlight.instructionIndex];
  const distance = `Entre ${highlight.startMeters} m e ${highlight.endMeters} m do início`;
  // O texto da etapa vem do provedor e pode terminar em ponto; a tela já acrescenta o seu.
  return step ? `${distance}: ${step.text.replace(/\.+\s*$/, '')}` : distance;
}

/** Rótulo curto para comparar opções lado a lado. */
export function recordsCompareLabel(route: Pick<RealRoute, 'recordsReading'>): string {
  const reading = route.recordsReading;
  if (!reading) return 'Sem leitura de registros';
  return reading.fewestRecords ? 'Menos registros conhecidos' : recordsLevelLabel(reading);
}
