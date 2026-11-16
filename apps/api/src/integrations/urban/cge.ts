import { urbanFloodSummarySchema } from '@safewalk/contracts';
import { publicText } from './public-http.js';

export function parseCgeSummary(html: string) {
  if (!/<title>[^<]*Alagamentos[^<]*CGE/i.test(html))
    throw new Error('URBAN_CGE_UNRECOGNIZED_PAGE');
  const date = html.match(/name=["']dataBusca["'][^>]*value=["'](\d{2})\/(\d{2})\/(\d{4})["']/i);
  const counts = [
    ...html.matchAll(/<h1[^>]*>\s*(?:Intransitáveis|Transitáveis)\s*=\s*(\d+)\s*pts?\s*<\/h1>/gi),
  ].map((match) => Number(match[1]));
  if (!date || counts.length !== 4) throw new Error('URBAN_CGE_LAYOUT_CHANGED');
  const isoDate = `${date[3]}-${date[2]}-${date[1]}`;
  if (new Date(`${isoDate}T00:00:00Z`).toISOString().slice(0, 10) !== isoDate)
    throw new Error('URBAN_CGE_INVALID_DATE');
  return urbanFloodSummarySchema.parse({
    date: isoDate,
    activePassableForVehicles: counts[0],
    activeImpassableForVehicles: counts[1],
    inactivePassableForVehicles: counts[2],
    inactiveImpassableForVehicles: counts[3],
    recordsWithoutCoordinates: counts.reduce((sum, count) => sum + count, 0),
    note: 'Resumo de registros municipais do CGE para a data indicada; não confirma ausência de alagamentos não registrados. Transitabilidade refere-se a veículos. A página consultada não fornece geometria verificada para este integrador; nenhum ponto foi inventado.',
  });
}

export async function fetchCgeSummary() {
  return parseCgeSummary(
    await publicText(new URL('https://www.cgesp.org/v3/alagamentos.jsp'), 2_000_000),
  );
}
