import { municipalityReportHtml } from './municipality-report-html';
import { municipalityReportCsv } from './municipality-report-data';

export const pdfActionLabel = 'Imprimir / salvar PDF';
export const csvActionLabel = 'Exportar CSV';
export async function exportMunicipalityPdf(month: string): Promise<void> {
  const report = window.open('', '_blank');
  if (!report)
    throw new Error('Permita a abertura da janela do relatório para imprimir ou salvar em PDF.');
  report.opener = null;
  report.document.open();
  report.document.write(municipalityReportHtml(month));
  report.document.close();
  report.focus();
  report.print();
}
export async function exportMunicipalityCsv(month: string): Promise<void> {
  const blob = new Blob(['\uFEFF', municipalityReportCsv(month)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'safewalk-relatorio-demonstrativo.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
