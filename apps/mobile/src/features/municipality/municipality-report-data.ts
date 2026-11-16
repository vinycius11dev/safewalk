export const serviceReportRows = [
  { type: 'Calçada quebrada', opened: 96, resolved: 141, average: '7,8 dias' },
  { type: 'Rua sem luz', opened: 58, resolved: 102, average: '4,1 dias' },
  { type: 'Obra na calçada', opened: 37, resolved: 44, average: '9,5 dias' },
  { type: 'Alagamento', opened: 23, resolved: 49, average: '2,3 dias' },
] as const;
export const reportSummary =
  'Os relatos subiram 12% no mês, puxados por roubos de celular na R. Augusta entre 18h e 21h. A zeladoria resolveu 61% das solicitações do SP156, com tempo médio de 6,2 dias. Calçadas quebradas seguem como o pedido mais frequente.';
export const reportWeeks = [
  { label: 'Sem. 1', security: 820, maintenance: 410 },
  { label: 'Sem. 2', security: 870, maintenance: 395 },
  { label: 'Sem. 3', security: 960, maintenance: 420 },
  { label: 'Sem. 4', security: 1010, maintenance: 437 },
] as const;
export function municipalityReportCsv(month: string) {
  const rows: (string | number)[][] = [
    ['SafeWalk - Relatório demonstrativo', month],
    ['Escopo', 'Dados fictícios; nenhuma integração pública acionada'],
    ['Indicador', 'Valor'],
    ['Rotas acompanhadas (exemplo)', 18420],
    ['Relatos recebidos (exemplo)', 5112],
    ['SOS encaminhados à GCM (simulação)', 41],
    ['Solicitações SP156 resolvidas (exemplo)', '61%'],
    [],
    ['Tipo SP156 (exemplo)', 'Abertas', 'Resolvidas', 'Prazo médio'],
    ...serviceReportRows.map((row) => [row.type, row.opened, row.resolved, row.average]),
    [],
    ['Semana (exemplo)', 'Segurança', 'Zeladoria'],
    ...reportWeeks.map((week) => [week.label, week.security, week.maintenance]),
  ];
  return rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
    .join('\r\n');
}
