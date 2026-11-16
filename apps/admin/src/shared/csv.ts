import { governmentStatusLabels, reportLabels, reportPriorityLabels } from '@safewalk/contracts';
import type { AdminReportItem } from '@safewalk/contracts';

/** Faz o Excel abrir o arquivo como UTF-8, preservando os acentos. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const headers = [
  'Protocolo do painel',
  'Tipo',
  'Andamento',
  'Prioridade sugerida',
  'Endereço',
  'Latitude',
  'Longitude',
  'Recebido em (UTC)',
  'Relatos no mesmo ponto',
  'Descrição',
];

/**
 * Célula de CSV segura para planilha: aspas dobradas e, quando o texto começa como fórmula
 * (= + - @), um apóstrofo na frente para que o Excel não a execute.
 */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function reportsToCsv(items: readonly AdminReportItem[]): string {
  const rows = items.map((item) =>
    [
      item.id,
      reportLabels[item.type],
      governmentStatusLabels[item.status],
      reportPriorityLabels[item.priority],
      item.address,
      item.location.latitude,
      item.location.longitude,
      item.createdAt,
      item.nearbyCount,
      item.description,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `${BYTE_ORDER_MARK}${[headers.map(csvCell).join(';'), ...rows].join('\r\n')}\r\n`;
}
