import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { municipalityReportHtml } from './municipality-report-html';
import { municipalityReportCsv } from './municipality-report-data';

export const pdfActionLabel = 'Gerar e compartilhar PDF';
export const csvActionLabel = 'Compartilhar CSV como texto';
export async function exportMunicipalityPdf(month: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
  const result = await Print.printToFileAsync({ html: municipalityReportHtml(month) });
  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    UTI: '.pdf',
    dialogTitle: 'Relatório demonstrativo SafeWalk',
  });
}
export async function exportMunicipalityCsv(month: string): Promise<void> {
  await Share.share({
    title: 'Relatório demonstrativo SafeWalk · CSV',
    message: municipalityReportCsv(month),
  });
}
