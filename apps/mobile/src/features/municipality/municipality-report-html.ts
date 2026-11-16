import { municipalityPrintCss } from './municipality-print.styles';
import { reportSummary, reportWeeks, serviceReportRows } from './municipality-report-data';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export function municipalityReportHtml(month: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>SafeWalk — Relatório demonstrativo</title><style>${municipalityPrintCss}</style></head><body><h1>SafeWalk · Relatório mensal</h1><p class="caption">${escapeHtml(month)} · Subprefeitura Sé · Bela Vista e Consolação</p><p class="notice"><strong>DEMONSTRAÇÃO.</strong> Todos os números abaixo são fictícios. Não representam estatísticas oficiais; GCM, Smart Sampa e SP156 não foram acionados.</p><h2>Resumo ilustrativo</h2><p>${escapeHtml(reportSummary)}</p><table><thead><tr><th>Indicador de exemplo</th><th>Valor</th></tr></thead><tbody><tr><td>Rotas acompanhadas</td><td>18.420</td></tr><tr><td>Relatos recebidos</td><td>5.112</td></tr><tr><td>SOS encaminhados à GCM (simulação)</td><td>41</td></tr><tr><td>Solicitações SP156 resolvidas</td><td>61%</td></tr></tbody></table><h2>Relatos por semana · exemplo</h2><table><thead><tr><th>Semana</th><th>Segurança</th><th>Zeladoria</th></tr></thead><tbody>${reportWeeks.map((week) => `<tr><td>${week.label}</td><td>${week.security}</td><td>${week.maintenance}</td></tr>`).join('')}</tbody></table><h2>SP156 por tipo · exemplo</h2><table><thead><tr><th>Tipo</th><th>Abertas</th><th>Resolvidas</th><th>Prazo médio</th></tr></thead><tbody>${serviceReportRows.map((row) => `<tr><td>${row.type}</td><td>${row.opened}</td><td>${row.resolved}</td><td>${row.average}</td></tr>`).join('')}</tbody></table><footer>SafeWalk · protótipo funcional local · sem dados pessoais ou estatísticas de outras contas.</footer></body></html>`;
}
