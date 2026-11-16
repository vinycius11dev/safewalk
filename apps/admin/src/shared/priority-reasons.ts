import type { AdminReportItem } from '@safewalk/contracts';

const STALE_DAYS = 7;
const riskTypes = new Set(['traffic_light', 'flood']);

/** Em palavras, por que a regra de prioridade deu este resultado (a regra mora na API). */
export function priorityReasons(
  item: Pick<AdminReportItem, 'type' | 'nearbyCount' | 'confirmationCount' | 'createdAt'>,
  now: number = Date.now(),
): string[] {
  const reasons: string[] = [];
  if (riskTypes.has(item.type)) reasons.push('Tipo de maior risco a quem anda a pé');
  if (item.nearbyCount > 1)
    reasons.push(`${item.nearbyCount} relatos em aberto do mesmo tipo a até 100 m`);
  if (item.confirmationCount > 0)
    reasons.push(
      `${item.confirmationCount} ${item.confirmationCount === 1 ? 'pessoa confirmou' : 'pessoas confirmaram'} que continua lá`,
    );
  if ((now - Date.parse(item.createdAt)) / 86_400_000 >= STALE_DAYS)
    reasons.push(`Aberto há mais de ${STALE_DAYS} dias`);
  return reasons;
}
