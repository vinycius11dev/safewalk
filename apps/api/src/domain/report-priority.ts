import type { ReportPriority, ReportType } from '@safewalk/contracts';

/**
 * Prioridade sugerida ao operador do painel, por regra fixa e explicável. Não é classificação
 * oficial nem substitui o critério da equipe: serve só para ordenar a fila.
 *
 * Pontos: o tipo (o que oferece mais risco a quem anda a pé pesa mais), relatos em aberto do mesmo
 * tipo no mesmo ponto, confirmações de outros usuários e relatos esquecidos há mais de uma semana.
 */
const TYPE_POINTS: Partial<Record<ReportType, number>> = {
  traffic_light: 3,
  flood: 3,
  pothole: 2,
  obstruction: 2,
  lighting: 2,
  sidewalk: 1,
};
const MAX_NEARBY_POINTS = 3;
const MAX_CONFIRMATION_POINTS = 3;
const STALE_AFTER_HOURS = 24 * 7;
const HIGH_FROM = 4;
const MEDIUM_FROM = 3;

export type PriorityInput = {
  type: ReportType;
  /** Relatos em aberto do mesmo tipo no mesmo ponto, contando o próprio. */
  nearbyCount: number;
  confirmationCount: number;
  ageHours: number;
};

export function priorityScore(input: PriorityInput): number {
  return (
    (TYPE_POINTS[input.type] ?? 0) +
    Math.min(Math.max(input.nearbyCount - 1, 0), MAX_NEARBY_POINTS) +
    Math.min(Math.max(input.confirmationCount, 0), MAX_CONFIRMATION_POINTS) +
    (input.ageHours >= STALE_AFTER_HOURS ? 1 : 0)
  );
}

export function reportPriority(input: PriorityInput): ReportPriority {
  const score = priorityScore(input);
  if (score >= HIGH_FROM) return 'high';
  if (score >= MEDIUM_FROM) return 'medium';
  return 'normal';
}
